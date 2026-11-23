import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';

interface NotionRichText { plain_text: string }
interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  last_edited_time?: string;
  icon?: { type: string; emoji?: string };
  toggle?: { rich_text: NotionRichText[] };
  paragraph?: { rich_text: NotionRichText[] };
  image?: { type: string; external?: { url: string }; file?: { url: string; expiry_time?: string } };
  [key: string]: any;
}

export interface NotionIdChangeAlert {
  id: string;
  tipo: 'id_alterado' | 'bloco_removido' | 'caderno_nao_encontrado';
  cadernoId: string;
  cadernoNome: string;
  antigoId: string;
  novoId?: string;
  numero?: string;
  topico?: string;
  casoNome?: string;
  detectedAt: string;
  mensagem: string;
}

const NOTION_VERSION = '2022-06-28';
const ALL_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FEFF}][\uFE0F\u20E3]?/gu;

function cleanId(id: string): string {
  return (id || '').replace(/-/g, '').trim();
}

function richText(rt: NotionRichText[] = []) {
  return rt.map(r => r.plain_text ?? '').join('');
}

function extractAnyBlockText(b: NotionBlock): string {
  return richText(
    b.paragraph?.rich_text ??
    b.callout?.rich_text ??
    b.quote?.rich_text ??
    b.heading_1?.rich_text ??
    b.heading_2?.rich_text ??
    b.heading_3?.rich_text ??
    b.bulleted_list_item?.rich_text ??
    b.numbered_list_item?.rich_text ??
    []
  );
}

function parseTitle(text: string) {
  const t = text.trim();
  const emojis = [...t.matchAll(new RegExp(ALL_EMOJI_RE.source, 'gu'))].map(m => m[0]);
  const stripped = t.replace(new RegExp(ALL_EMOJI_RE.source, 'gu'), '').trim();
  const numM = stripped.match(/(\d+)/);
  const numero = numM ? numM[1] : '';
  const topic = numM ? stripped.slice(stripped.indexOf(numM[1]) + numM[1].length).trim() : stripped;
  return { emojis, numero, topic };
}

const CATEGORIES_EMOJIS: Record<string, string[]> = {
  bonus:     ['🎉','🥳','🎊'],
  faceis:    ['🟢','✅','💚','🍀'],
  atencao:   ['🔵','💙','🌀','🫐'],
  lacuna:    ['⛳','⛳️','🌱','🌿','🪴'],
  media:     ['🟡','💛','⭐','🌟','🟠','🧡'],
  dificil:   ['🔴','❤️','💔','🔥'],
  ultrahard: ['🟣','💜','👾','🫀'],
};

function detectCategory(emojis: string[]): string | null {
  for (const emoji of emojis) {
    for (const [cat, catEmojis] of Object.entries(CATEGORIES_EMOJIS)) {
      if (catEmojis.some(e => e === emoji || emoji.includes(e) || e.includes(emoji))) return cat;
    }
  }
  return null;
}

function isExpiredAwsUrl(url: string): boolean {
  return url.includes('amazonaws.com') || url.includes('prod-files-secure');
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}

async function notionFetch(token: string, path: string, body?: object): Promise<any> {
  const url = `https://api.notion.com/v1/${path}`;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '1', 10) * 1000 + attempts * 300;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `Notion HTTP ${res.status}`);
    }
    return data;
  }
  throw new Error('Notion rate limit esgotado');
}

async function getBlockChildren(token: string, blockId: string): Promise<NotionBlock[]> {
  const clean = cleanId(blockId);
  const all: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionFetch(
      token,
      `blocks/${clean}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    );
    if (data?.results) all.push(...data.results);
    cursor = data?.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

async function uploadImageToStorage(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  imageUrl: string,
  fileName: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${fileName}.${ext}`;

    const { error } = await supabase.storage
      .from('notion-imagens')
      .upload(path, uint8, { contentType, upsert: true });

    if (error) return null;

    const { data: { publicUrl } } = supabase.storage
      .from('notion-imagens')
      .getPublicUrl(path);

    return publicUrl;
  } catch {
    return null;
  }
}

function getNotionImageUrl(block: NotionBlock): string | null {
  const img = block.image;
  if (!img) return null;
  return img.type === 'external' ? img.external?.url ?? null : img.file?.url ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO 1: Sincronização completa com a API do Notion (quando NOTION_TOKEN existe)
// ─────────────────────────────────────────────────────────────────────────────
async function syncBlocoWithNotion(
  token: string,
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  blockRow: { id: string; block_id: string; nome: string },
  logs: string[],
  idChanges: NotionIdChangeAlert[]
): Promise<number> {
  logs.push(`📚 Sincronizando via Notion: ${blockRow.nome}`);
  const cleanRoot = cleanId(blockRow.block_id);

  const { data: existentes } = await supabase
    .from('notion_questoes_banco')
    .select('id, caso_id, caso_nome, numero, topico, notion_last_edited_time, imagens_urls, gabarito_imagens_urls')
    .or(`bloco_raiz_id.eq.${blockRow.block_id},bloco_raiz_id.eq.${cleanRoot}`);

  const existentesMap = new Map<string, any>(
    (existentes ?? [])
      .filter((e: any) => e.notion_last_edited_time !== 'local')
      .map((e: any) => [cleanId(e.id), e])
  );

  const foundCleanIds = new Set<string>();
  const newlyFoundQuestions: Array<{ id: string; cleanId: string; casoNome: string; numero: string; topic: string }> = [];
  const toProcess: Array<{ child: NotionBlock; casoId: string | null; casoNome: string }> = [];

  async function walk(parentId: string, casoId: string | null, casoNome: string, depth: number) {
    if (depth > 5) return;
    const children = await getBlockChildren(token, parentId);
    const subWalks: Array<{ id: string; label: string }> = [];

    for (const child of children) {
      if (child.type !== 'toggle') continue;
      const rawTitle = richText(child.toggle?.rich_text ?? []);
      const { emojis: textEmojis, numero, topic } = parseTitle(rawTitle);
      const iconEmoji = child.icon?.type === 'emoji' && child.icon.emoji ? [child.icon.emoji] : [];
      const categoria = detectCategory([...iconEmoji, ...textEmojis]);

      if (categoria) {
        const cClean = cleanId(child.id);
        foundCleanIds.add(cClean);
        const existing = existentesMap.get(cClean);
        if (!existing) {
          newlyFoundQuestions.push({ id: child.id, cleanId: cClean, casoNome, numero, topic });
        }
        const lastEdited = child.last_edited_time ?? '';
        const notionTime = lastEdited ? new Date(lastEdited).getTime() : 0;
        const dbTime = existing?.notion_last_edited_time 
          ? new Date(existing.notion_last_edited_time).getTime() 
          : (existing?.updated_at ? new Date(existing.updated_at).getTime() : 0);

        const hasExpired = [...(existing?.imagens_urls ?? []), ...(existing?.gabarito_imagens_urls ?? [])]
          .some((u: string) => isExpiredAwsUrl(u));

        if (!existing || notionTime > dbTime || hasExpired) {
          if (existing && notionTime > dbTime) {
            logs.push(`  🔄 Atualizado no Notion (superior ao banco): Q${numero || '?'}`);
          }
          toProcess.push({ child, casoId, casoNome });
        } else {
          logs.push(`  ⏸️ Inalterado (Notion anterior ou igual ao banco): Q${numero || '?'}`);
        }
      } else if (child.has_children) {
        subWalks.push({ id: child.id, label: rawTitle || 'Sem nome' });
      }
    }

    await runPool(subWalks, 4, async (sub) => {
      await walk(sub.id, sub.id, sub.label, depth + 1);
    });
  }

  try {
    await walk(blockRow.block_id, null, 'Geral', 0);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.toLowerCase().includes('could not find block') || msg.includes('404') || msg.includes('object_not_found')) {
      idChanges.push({
        id: `caderno:${cleanRoot}`,
        tipo: 'caderno_nao_encontrado',
        cadernoId: blockRow.block_id,
        cadernoNome: blockRow.nome,
        antigoId: blockRow.block_id,
        detectedAt: new Date().toISOString(),
        mensagem: `O bloco raiz do caderno "${blockRow.nome}" não foi encontrado no Notion (ID alterado ou apagado).`,
      });
    }
    throw err;
  }

  let totalUpserted = 0;
  await runPool(toProcess, 4, async ({ child, casoId, casoNome }) => {
    const rawTitle = richText(child.toggle?.rich_text ?? []);
    const { emojis: textEmojis, numero, topic } = parseTitle(rawTitle);
    const iconEmoji = child.icon?.type === 'emoji' && child.icon.emoji ? [child.icon.emoji] : [];
    const categoria = detectCategory([...iconEmoji, ...textEmojis]) || 'media';
    const lastEdited = child.last_edited_time ?? '';

    const questaoChildren = await getBlockChildren(token, child.id);
    const enunciadoImagens: string[] = [];
    const enunciadoTexts: string[] = [];
    let gabaritoTexto: string | null = null;
    const gabaritoImagens: string[] = [];

    for (const qc of questaoChildren) {
      if (qc.type === 'image') {
        const url = getNotionImageUrl(qc);
        if (url) enunciadoImagens.push(url);
      } else if (qc.type === 'toggle') {
        const tText = richText(qc.toggle?.rich_text ?? []).toLowerCase();
        if (tText.includes('resposta') && qc.has_children) {
          const respostaChildren = await getBlockChildren(token, qc.id);
          const texts: string[] = [];
          for (const rc of respostaChildren) {
            if (rc.type === 'image') {
              const url = getNotionImageUrl(rc);
              if (url) gabaritoImagens.push(url);
            } else {
              const t = extractAnyBlockText(rc);
              if (t) texts.push(t);
            }
          }
          if (texts.length) gabaritoTexto = texts.join('\n');
        }
      } else {
        const t = extractAnyBlockText(qc);
        if (t) enunciadoTexts.push(t);
      }
    }

    const cClean = cleanId(child.id);
    const enunciadoUrls: string[] = [];
    for (let i = 0; i < enunciadoImagens.length; i++) {
      const stored = await uploadImageToStorage(supabase, enunciadoImagens[i], `q_${cClean}_e${i}`);
      enunciadoUrls.push(stored ?? enunciadoImagens[i]);
    }

    const gabaritoUrls: string[] = [];
    for (let i = 0; i < gabaritoImagens.length; i++) {
      const stored = await uploadImageToStorage(supabase, gabaritoImagens[i], `q_${cClean}_g${i}`);
      gabaritoUrls.push(stored ?? gabaritoImagens[i]);
    }

    const { error: upsertErr } = await supabase.from('notion_questoes_banco').upsert({
      id: child.id,
      bloco_raiz_id: blockRow.block_id,
      caso_id: casoId,
      caso_nome: casoNome,
      numero,
      topico: topic,
      categoria,
      enunciado_texto: enunciadoTexts.join('\n') || null,
      imagens_urls: enunciadoUrls,
      gabarito_texto: gabaritoTexto,
      gabarito_imagens_urls: gabaritoUrls,
      notion_last_edited_time: lastEdited,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (upsertErr) {
      logs.push(`  ⚠️ Erro Q${numero || '?'}: ${upsertErr.message}`);
    } else {
      totalUpserted++;
    }
  });

  // Detectar e remover questões cujo ID antigo não existe mais no Notion
  const removedRows = [...existentesMap.entries()]
    .filter(([k]) => !foundCleanIds.has(k))
    .map(([, row]) => row);
  const deletedIds = removedRows.map((row: any) => row.id);

  if (removedRows.length > 0) {
    const usedNewIds = new Set<string>();
    const nowIso = new Date().toISOString();
    for (const oldRow of removedRows) {
      const oldNum = (oldRow.numero || '').trim();
      const oldTopic = (oldRow.topico || '').trim().toLowerCase();
      const oldCaso = (oldRow.caso_nome || '').trim().toLowerCase();

      const match = newlyFoundQuestions.find(nq => {
        if (usedNewIds.has(nq.cleanId)) return false;
        const nNum = (nq.numero || '').trim();
        const nTopic = (nq.topic || '').trim().toLowerCase();
        const nCaso = (nq.casoNome || '').trim().toLowerCase();
        if (oldNum && nNum === oldNum && oldCaso && nCaso === oldCaso) return true;
        if (oldNum && nNum === oldNum && oldTopic && nTopic === oldTopic) return true;
        if (!oldNum && oldTopic && nTopic === oldTopic && oldCaso === nCaso) return true;
        return false;
      });

      if (match) {
        usedNewIds.add(match.cleanId);
        idChanges.push({
          id: `${cleanRoot}:${cleanId(oldRow.id)}`,
          tipo: 'id_alterado',
          cadernoId: blockRow.block_id,
          cadernoNome: blockRow.nome,
          antigoId: oldRow.id,
          novoId: match.id,
          numero: oldRow.numero || match.numero || undefined,
          topico: oldRow.topico || match.topic || undefined,
          casoNome: oldRow.caso_nome || match.casoNome || undefined,
          detectedAt: nowIso,
          mensagem: `ID do bloco alterado no Notion (${oldRow.id.slice(0, 8)} → ${match.id.slice(0, 8)})`,
        });
      } else {
        idChanges.push({
          id: `${cleanRoot}:${cleanId(oldRow.id)}`,
          tipo: 'bloco_removido',
          cadernoId: blockRow.block_id,
          cadernoNome: blockRow.nome,
          antigoId: oldRow.id,
          numero: oldRow.numero || undefined,
          topico: oldRow.topico || undefined,
          casoNome: oldRow.caso_nome || undefined,
          detectedAt: nowIso,
          mensagem: `Questão não encontrada mais com o ID ${oldRow.id.slice(0, 8)} no Notion (bloco alterado ou removido).`,
        });
      }
    }

    await supabase.from('notion_questoes_banco').delete().in('id', deletedIds);
    logs.push(`  ⚠️ ${removedRows.length} ID(s) antigo(s) alterado(s) ou removido(s) no Notion!`);
  }

  logs.push(`  ✅ ${totalUpserted} questão(ões) atualizada(s) (${foundCleanIds.size} no caderno)`);
  return totalUpserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO 2: Sincronização via Cache + Storage do Supabase (sem NOTION_TOKEN)
// Reconstrói questões ausentes em notion_questoes_banco, vincula imagens já
// salvas no bucket `notion-imagens` e atualiza os caches derivados `ids_`/`det_`.
// ─────────────────────────────────────────────────────────────────────────────
async function loadStorageIndex(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const index = new Map<string, { e: Array<{ idx: number; url: string }>; g: Array<{ idx: number; url: string }> }>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from('notion-imagens').list('', { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const f of data) {
      const m = f.name.match(/^q_([a-f0-9]{32})_(e|g)(\d+)\./i);
      if (!m) continue;
      const qid = m[1].toLowerCase();
      const kind = m[2].toLowerCase() as 'e' | 'g';
      const num = parseInt(m[3], 10);
      const { data: pub } = supabase.storage.from('notion-imagens').getPublicUrl(f.name);
      if (!index.has(qid)) index.set(qid, { e: [], g: [] });
      index.get(qid)![kind].push({ idx: num, url: pub.publicUrl });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  for (const entry of index.values()) {
    entry.e.sort((a, b) => a.idx - b.idx);
    entry.g.sort((a, b) => a.idx - b.idx);
  }
  return index;
}

async function readCacheMap(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  keys: string[]
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const unique = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await supabase
      .from('notion_cache_blocos')
      .select('block_id, data_json')
      .in('block_id', chunk);
    for (const row of data ?? []) {
      const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
      map.set(row.block_id, parsed);
    }
  }
  return map;
}

async function syncBlocoFromSupabaseCache(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  blockRow: { id: string; block_id: string; nome: string },
  storageIndex: Map<string, { e: Array<{ idx: number; url: string }>; g: Array<{ idx: number; url: string }> }>,
  logs: string[]
): Promise<number> {
  const rootClean = cleanId(blockRow.block_id);
  const { data: existentes } = await supabase
    .from('notion_questoes_banco')
    .select('*')
    .or(`bloco_raiz_id.eq.${blockRow.block_id},bloco_raiz_id.eq.${rootClean}`);

  const existingByClean = new Map<string, any>(
    (existentes ?? []).map((e: any) => [cleanId(e.id), e])
  );

  const collectedQuestions: Array<{
    id: string;
    casoId: string | null;
    casoNome: string;
    numero: string;
    topico: string;
    categoria: string;
    lastEdited: string;
  }> = [];

  const visited = new Set<string>();
  let frontier: Array<{ id: string; casoId: string | null; casoNome: string; depth: number }> = [
    { id: blockRow.block_id, casoId: null, casoNome: 'Geral', depth: 0 },
  ];

  while (frontier.length > 0) {
    const batch = frontier.filter(f => !visited.has(cleanId(f.id)) && f.depth <= 5);
    frontier = [];
    if (batch.length === 0) break;

    for (const f of batch) visited.add(cleanId(f.id));
    const cacheMap = await readCacheMap(supabase, batch.map(b => cleanId(b.id)));

    for (const parent of batch) {
      const children = cacheMap.get(cleanId(parent.id));
      if (!Array.isArray(children)) continue;

      for (const child of children) {
        if (!child || child.type !== 'toggle') continue;
        const rawTitle = richText(child.toggle?.rich_text ?? []);
        const { emojis: textEmojis, numero, topic } = parseTitle(rawTitle);
        const iconEmoji = child.icon?.type === 'emoji' && child.icon.emoji ? [child.icon.emoji] : [];
        const categoria = detectCategory([...iconEmoji, ...textEmojis]);

        if (categoria) {
          collectedQuestions.push({
            id: child.id,
            casoId: parent.casoId,
            casoNome: parent.casoNome,
            numero,
            topico: topic,
            categoria,
            lastEdited: child.last_edited_time || new Date().toISOString(),
          });
        } else {
          frontier.push({
            id: child.id,
            casoId: child.id,
            casoNome: rawTitle || 'Sem nome',
            depth: parent.depth + 1,
          });
        }
      }
    }
  }

  // Buscar dados qfull_ e filhos diretos das questões encontradas
  const qCacheKeys = collectedQuestions.flatMap(q => [cleanId(q.id), `qfull_${cleanId(q.id)}`]);
  const qCacheMap = await readCacheMap(supabase, qCacheKeys);

  let upserted = 0;
  const rowsToUpsert: any[] = [];

  for (const q of collectedQuestions) {
    const qClean = cleanId(q.id);
    const existing = existingByClean.get(qClean);
    if (existing?.notion_last_edited_time === 'local') {
      continue;
    }

    const storageFiles = storageIndex.get(qClean);
    const qfull = qCacheMap.get(`qfull_${qClean}`);
    const qChildren = qCacheMap.get(qClean);

    const existingImgs: string[] = Array.isArray(existing?.imagens_urls)
      ? existing.imagens_urls.filter((u: string) => u && !isExpiredAwsUrl(u))
      : [];
    const existingRespImgs: string[] = Array.isArray(existing?.gabarito_imagens_urls)
      ? existing.gabarito_imagens_urls.filter((u: string) => u && !isExpiredAwsUrl(u))
      : [];

    const storageImgs = storageFiles?.e.map(x => x.url) ?? [];
    const storageRespImgs = storageFiles?.g.map(x => x.url) ?? [];

    const cacheImgs: string[] = Array.isArray(qfull?.imgs)
      ? qfull.imgs.filter((u: string) => u && !isExpiredAwsUrl(u))
      : Array.isArray(qChildren)
      ? qChildren
          .filter((b: NotionBlock) => b.type === 'image')
          .map((b: NotionBlock) => getNotionImageUrl(b))
          .filter((u: string | null): u is string => Boolean(u && !isExpiredAwsUrl(u)))
      : [];

    const cacheRespImgs: string[] = Array.isArray(qfull?.rImgs)
      ? qfull.rImgs.filter((u: string) => u && !isExpiredAwsUrl(u))
      : [];

    const finalImgs = storageImgs.length > 0 ? storageImgs : existingImgs.length > 0 ? existingImgs : cacheImgs;
    const finalRespImgs = storageRespImgs.length > 0 ? storageRespImgs : existingRespImgs.length > 0 ? existingRespImgs : cacheRespImgs;
    const finalEnunciado = existing?.enunciado_texto || qfull?.textEnunciado || null;
    const finalGabarito = existing?.gabarito_texto || qfull?.textResp || null;

    const needsWrite =
      !existing ||
      finalImgs.length > existingImgs.length ||
      finalRespImgs.length > existingRespImgs.length ||
      (!existing.caso_id && q.casoId);

    if (needsWrite) {
      rowsToUpsert.push({
        id: q.id,
        bloco_raiz_id: blockRow.block_id,
        caso_id: q.casoId,
        caso_nome: q.casoNome,
        numero: q.numero || existing?.numero || '1',
        topico: q.topico || existing?.topico || '',
        categoria: q.categoria || existing?.categoria || 'media',
        enunciado_texto: finalEnunciado,
        imagens_urls: finalImgs,
        gabarito_texto: finalGabarito,
        gabarito_imagens_urls: finalRespImgs,
        notion_last_edited_time: existing?.notion_last_edited_time || q.lastEdited,
        updated_at: new Date().toISOString(),
      });
    }
  }

  for (let i = 0; i < rowsToUpsert.length; i += 50) {
    const chunk = rowsToUpsert.slice(i, i + 50);
    const { error } = await supabase
      .from('notion_questoes_banco')
      .upsert(chunk, { onConflict: 'id' });
    if (error) {
      logs.push(`  ⚠️ Erro ao salvar lote em ${blockRow.nome}: ${error.message}`);
    } else {
      upserted += chunk.length;
    }
  }

  // Atualizar caches derivados ids_ e det_ no Supabase
  const allIds = [...new Set([
    ...collectedQuestions.map(q => q.id),
    ...(existentes ?? []).map((e: any) => e.id),
  ])];

  if (allIds.length > 0) {
    const nowIso = new Date().toISOString();
    await supabase.from('notion_cache_blocos').upsert(
      [
        { block_id: `ids_${rootClean}`, data_json: allIds, updated_at: nowIso },
        {
          block_id: `det_${rootClean}`,
          data_json: {
            itens: collectedQuestions.map(q => ({
              id: q.id,
              numero: q.numero,
              topic: q.topico,
              categoryKey: q.categoria,
              caseLabel: q.casoNome,
            })),
            caseIcons: {},
          },
          updated_at: nowIso,
        },
      ],
      { onConflict: 'block_id' }
    );
  }

  logs.push(`📦 ${blockRow.nome}: ${allIds.length} questões mapeadas (${upserted} atualizadas no banco)`);
  return upserted;
}

export async function POST(request: NextRequest) {
  const supabaseClient = createSupabaseServiceClient();
  const body = await request.json().catch(() => ({}));
  const token = body.notionToken || request.headers.get('x-notion-token') || process.env.NOTION_TOKEN;
  const requestedIds: string[] | undefined = Array.isArray(body.blocoIds) ? body.blocoIds : undefined;

  const logs: string[] = [];
  const { data: allBlocos, error: blocoError } = await supabaseClient
    .from('notion_blocks')
    .select('id, block_id, nome');

  if (blocoError || !allBlocos || allBlocos.length === 0) {
    return NextResponse.json({ error: 'Nenhum caderno encontrado no banco.', detail: blocoError }, { status: 400 });
  }

  const wantedClean = requestedIds && requestedIds.length > 0
    ? new Set(requestedIds.map(cleanId))
    : null;

  const blocos = wantedClean
    ? allBlocos.filter((b: any) => wantedClean.has(cleanId(b.block_id)) || wantedClean.has(cleanId(b.id)))
    : allBlocos;

  if (blocos.length === 0) {
    return NextResponse.json({ error: 'Caderno selecionado não encontrado.' }, { status: 400 });
  }

  let totalGeral = 0;
  const idChanges: NotionIdChangeAlert[] = [];

  if (token) {
    for (const bloco of blocos) {
      try {
        const n = await syncBlocoWithNotion(token, supabaseClient, bloco, logs, idChanges);
        totalGeral += n;
      } catch (e: any) {
        logs.push(`❌ Erro no caderno ${bloco.nome}: ${e.message}`);
      }
    }
    logs.push(`\n🎉 Sincronização com Notion concluída! ${totalGeral} questão(ões) atualizada(s).`);
    return NextResponse.json({ success: true, mode: 'notion', total: totalGeral, logs, idChanges });
  }

  // Fallback funcional quando NOTION_TOKEN não está configurado no servidor:
  // consolida cache estrutural (notion_cache_blocos) + bucket notion-imagens -> notion_questoes_banco
  logs.push('ℹ️ Modo Cache & Storage do Supabase (NOTION_TOKEN não configurado no servidor).');
  const storageIndex = await loadStorageIndex(supabaseClient);

  for (const bloco of blocos) {
    try {
      const n = await syncBlocoFromSupabaseCache(supabaseClient, bloco, storageIndex, logs);
      totalGeral += n;
    } catch (e: any) {
      logs.push(`❌ Erro no caderno ${bloco.nome}: ${e.message}`);
    }
  }

  logs.push(`\n🎉 Consolidação concluída! ${totalGeral} registro(s) sincronizado(s) no Supabase.`);
  return NextResponse.json({ success: true, mode: 'supabase-cache', total: totalGeral, logs, idChanges });
}

export async function GET() {
  const supabaseClient = createSupabaseServiceClient();
  const { count } = await supabaseClient
    .from('notion_questoes_banco')
    .select('id', { count: 'exact', head: true });
  return NextResponse.json({
    total: count ?? 0,
    notionConfigured: Boolean(process.env.NOTION_TOKEN),
  });
}
