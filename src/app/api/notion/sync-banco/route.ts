import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';
const ALL_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FEFF}][\uFE0F\u20E3]?/gu;

function richText(rt: NotionRichText[] = []) { return rt.map(r => r.plain_text).join(''); }

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

async function notionFetch(path: string, body?: object): Promise<any> {
  const url = `https://api.notion.com/v1/${path}`;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
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
    return res.json();
  }
  throw new Error('Notion rate limit esgotado');
}

async function getBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const clean = blockId.replace(/-/g, '');
  const all: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionFetch(
      `blocks/${clean}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    );
    if (data?.results) all.push(...data.results);
    cursor = data?.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Download e upload de imagem para o Supabase Storage
// ─────────────────────────────────────────────────────────────────────────────
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
  } catch (e) {
    return null;
  }
}

function getNotionImageUrl(block: NotionBlock): string | null {
  const img = block.image;
  if (!img) return null;
  return img.type === 'external' ? img.external?.url ?? null : img.file?.url ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincronizar um único caderno
// ─────────────────────────────────────────────────────────────────────────────
async function syncBloco(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  blockRow: { id: string; block_id: string; nome: string },
  logs: string[]
): Promise<number> {
  logs.push(`📚 Sincronizando caderno: ${blockRow.nome}`);
  let totalUpserted = 0;

  // IDs já existentes no banco com seus last_edited_time (para evitar re-processar)
  const { data: existentes } = await supabase
    .from('notion_questoes_banco')
    .select('id, notion_last_edited_time')
    .eq('bloco_raiz_id', blockRow.block_id);

  const existentesMap = new Map<string, string>(
    (existentes ?? []).map((e: any) => [e.id, e.notion_last_edited_time])
  );

  // IDs encontrados nessa sync (para detectar deletados)
  const foundIds = new Set<string>();

  async function walk(
    parentId: string,
    casoId: string | null,
    casoNome: string,
    depth: number
  ) {
    if (depth > 5) return;
    const children = await getBlockChildren(parentId);

    for (const child of children) {
      if (child.type !== 'toggle') continue;

      const rawTitle = richText(child.toggle?.rich_text ?? []);
      const { emojis: textEmojis, numero, topic } = parseTitle(rawTitle);
      const iconEmoji = child.icon?.type === 'emoji' && child.icon.emoji ? [child.icon.emoji] : [];
      const categoria = detectCategory([...iconEmoji, ...textEmojis]);

      if (categoria) {
        // É uma QUESTÃO
        foundIds.add(child.id);
        const lastEdited = child.last_edited_time ?? '';
        const jaExiste = existentesMap.get(child.id);

        // Só re-processa se foi editado ou não existe
        if (jaExiste && jaExiste === lastEdited) continue;

        logs.push(`  ⚙️  Q${numero || '?'} (${categoria}) — ${topic?.slice(0, 40) || 'sem tópico'}`);

        // Buscar filhos (imagens do enunciado + toggle de resposta)
        const questaoChildren = await getBlockChildren(child.id);
        const enunciadoImagens: string[] = [];
        let gabaritoTexto: string | null = null;
        const gabaritoImagens: string[] = [];

        for (const qc of questaoChildren) {
          if (qc.type === 'image') {
            const url = getNotionImageUrl(qc);
            if (url) enunciadoImagens.push(url);
          }
          if (qc.type === 'toggle') {
            const tText = richText(qc.toggle?.rich_text ?? []).toLowerCase();
            if (tText.includes('resposta') && qc.has_children) {
              const respostaChildren = await getBlockChildren(qc.id);
              const texts: string[] = [];
              for (const rc of respostaChildren) {
                if (rc.type === 'image') {
                  const url = getNotionImageUrl(rc);
                  if (url) gabaritoImagens.push(url);
                } else {
                  const t = richText(
                    rc.paragraph?.rich_text ??
                    rc.callout?.rich_text ??
                    rc.quote?.rich_text ??
                    rc.heading_1?.rich_text ??
                    rc.heading_2?.rich_text ??
                    rc.heading_3?.rich_text ??
                    rc.bulleted_list_item?.rich_text ??
                    rc.numbered_list_item?.rich_text ??
                    []
                  );
                  if (t) texts.push(t);
                }
              }
              if (texts.length) gabaritoTexto = texts.join('\n');
            }
          }
        }

        // Upload das imagens para o Supabase Storage
        const cleanId = child.id.replace(/-/g, '');
        const enunciadoUrls: string[] = [];
        for (let i = 0; i < enunciadoImagens.length; i++) {
          const stored = await uploadImageToStorage(supabase, enunciadoImagens[i], `q_${cleanId}_e${i}`);
          enunciadoUrls.push(stored ?? enunciadoImagens[i]); // fallback para URL original
        }

        const gabaritoUrls: string[] = [];
        for (let i = 0; i < gabaritoImagens.length; i++) {
          const stored = await uploadImageToStorage(supabase, gabaritoImagens[i], `q_${cleanId}_g${i}`);
          gabaritoUrls.push(stored ?? gabaritoImagens[i]);
        }

        // Upsert no banco
        await supabase.from('notion_questoes_banco').upsert({
          id: child.id,
          bloco_raiz_id: blockRow.block_id,
          caso_id: casoId,
          caso_nome: casoNome,
          numero,
          topico: topic,
          categoria,
          imagens_urls: enunciadoUrls,
          gabarito_texto: gabaritoTexto,
          gabarito_imagens_urls: gabaritoUrls,
          notion_last_edited_time: lastEdited,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        totalUpserted++;
      } else {
        // É um CASO / subcaso — desce recursivamente
        const label = rawTitle || 'Sem nome';
        if (child.has_children) {
          await walk(child.id, child.id, label, depth + 1);
        }
      }
    }
  }

  await walk(blockRow.block_id, null, 'Geral', 0);

  // Remover questões deletadas do Notion
  const deletedIds = [...existentesMap.keys()].filter(id => !foundIds.has(id));
  if (deletedIds.length > 0) {
    await supabase.from('notion_questoes_banco').delete().in('id', deletedIds);
    logs.push(`  🗑️  ${deletedIds.length} questão(ões) removida(s) (não encontrada(s) no Notion)`);
  }

  logs.push(`  ✅ ${totalUpserted} questão(ões) sincronizada(s)`);
  return totalUpserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint POST: /api/notion/sync-banco
// Body: { blocoIds?: string[] }  — se omitido, sincroniza todos os cadernos
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!NOTION_TOKEN) {
    return NextResponse.json({ error: 'NOTION_TOKEN não configurado' }, { status: 500 });
  }

  const supabaseClient = createSupabaseServiceClient();
  const body = await request.json().catch(() => ({}));
  const blocoIds: string[] | undefined = body.blocoIds;

  const logs: string[] = [];
  let query = supabaseClient.from('notion_blocks').select('id, block_id, nome');
  if (blocoIds && blocoIds.length > 0) {
    query = query.in('block_id', blocoIds);
  }
  const { data: blocos, error: blocoError } = await query;

  if (blocoError || !blocos || blocos.length === 0) {
    return NextResponse.json({ error: 'Nenhum caderno encontrado', detail: blocoError }, { status: 400 });
  }

  let totalGeral = 0;
  for (const bloco of blocos) {
    try {
      const n = await syncBloco(supabaseClient, bloco, logs);
      totalGeral += n;
    } catch (e: any) {
      logs.push(`❌ Erro no caderno ${bloco.nome}: ${e.message}`);
    }
  }

  logs.push(`\n🎉 Sincronização concluída! ${totalGeral} questões salvas no Supabase.`);
  return NextResponse.json({ success: true, total: totalGeral, logs });
}

// GET: status rápido (quantas questões já estão no banco)
export async function GET() {
  const supabaseClient = createSupabaseServiceClient();
  const { count } = await supabaseClient
    .from('notion_questoes_banco')
    .select('id', { count: 'exact', head: true });
  return NextResponse.json({ total: count ?? 0 });
}
