import { supabase } from "./supabase";

export type BuilderCategoryKey =
  | "bonus"
  | "faceis"
  | "atencao"
  | "lacuna"
  | "media"
  | "dificil"
  | "ultrahard"
  | "dominada"
  | "treinar"
  | "revisar";

export const CATEGORY_EMOJI_MAP: Record<BuilderCategoryKey, string> = {
  bonus: "🎉",
  faceis: "🟢",
  atencao: "🔵",
  lacuna: "⛳",
  media: "🟠",
  dificil: "🔴",
  ultrahard: "🟣",
  dominada: "🏆",
  treinar: "🧠",
  revisar: "🔁",
};

export interface CasoTreeNode {
  id: string;
  nome: string;
  parentId: string;
  depth: number;
  subcasos: CasoTreeNode[];
}

export interface SaveQuestaoInput {
  id?: string; // se fornecido, atualiza questão existente
  rootBlockId: string;
  targetCasoId: string;
  targetCasoNome: string;
  oldCasoId?: string;
  numero: string;
  topico: string;
  categoria: BuilderCategoryKey;
  enunciadoTexto: string;
  imagensUrls: string[];
  gabaritoTexto: string;
  gabaritoImagensUrls: string[];
}

const ALL_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FEFF}][\uFE0F\u20E3]?/gu;

const CATEGORIES_EMOJIS: Record<string, string[]> = {
  bonus: ["🎉", "🥳", "🎊"],
  faceis: ["🟢", "✅", "💚", "🍀"],
  atencao: ["🔵", "💙", "🌀", "🫐"],
  lacuna: ["⛳", "⛳️", "🌱", "🌿", "🪴"],
  media: ["🟡", "💛", "⭐", "🌟", "🟠", "🧡"],
  dificil: ["🔴", "❤️", "💔", "🔥"],
  ultrahard: ["🟣", "💜", "👾", "🫀"],
  dominada: ["🏆"],
  treinar: ["🧠"],
  revisar: ["🔁"],
};

export function cleanBlockId(id: string): string {
  return (id || "").replace(/-/g, "").trim();
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function richTextPlain(rt: Array<{ plain_text?: string; text?: { content?: string } }> = []): string {
  return rt.map((r) => r.plain_text ?? r.text?.content ?? "").join("");
}

function isQuestionBlock(block: any): boolean {
  if (!block || block.type !== "toggle") return false;
  const rawTitle = richTextPlain(block.toggle?.rich_text ?? []);
  const emojis = [...rawTitle.matchAll(new RegExp(ALL_EMOJI_RE.source, "gu"))].map((m) => m[0]);
  if (block.icon?.type === "emoji" && block.icon.emoji) {
    emojis.unshift(block.icon.emoji);
  }
  for (const emoji of emojis) {
    for (const catEmojis of Object.values(CATEGORIES_EMOJIS)) {
      if (catEmojis.some((e) => e === emoji || emoji.includes(e) || e.includes(emoji))) {
        return true;
      }
    }
  }
  return false;
}

function buildToggleBlock(id: string, parentId: string, title: string, iconEmoji?: string) {
  return {
    id,
    object: "block",
    type: "toggle",
    has_children: true,
    parent: { type: "block_id", block_id: parentId },
    ...(iconEmoji ? { icon: { type: "emoji", emoji: iconEmoji } } : {}),
    toggle: {
      color: "default",
      rich_text: [
        {
          type: "text",
          plain_text: title,
          text: { content: title, link: null },
        },
      ],
    },
  };
}

function writeLocalCache(key: string, data: any) {
  try {
    if (typeof window !== "undefined") {
      const payload = JSON.stringify({ data, timestamp: Date.now() });
      localStorage.setItem(`notion_c_${key}`, payload);
      sessionStorage.setItem(`notion_c_${key}`, payload);
    }
  } catch {}
}

function removeLocalCache(key: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`notion_c_${key}`);
      sessionStorage.removeItem(`notion_c_${key}`);
    }
  } catch {}
}

export async function readSupabaseCacheBlocks(blockId: string): Promise<any[] | null> {
  const clean = cleanBlockId(blockId);
  if (!clean) return null;
  try {
    const { data, error } = await supabase
      .from("notion_cache_blocos")
      .select("data_json")
      .eq("block_id", clean)
      .maybeSingle();
    if (!error && data?.data_json) {
      const parsed = typeof data.data_json === "string" ? JSON.parse(data.data_json) : data.data_json;
      return Array.isArray(parsed) ? parsed : null;
    }
  } catch {}
  return null;
}

export async function writeSupabaseCacheBlocks(blockId: string, blocks: any[]): Promise<void> {
  const clean = cleanBlockId(blockId);
  if (!clean) return;
  await supabase.from("notion_cache_blocos").upsert(
    {
      block_id: clean,
      data_json: blocks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "block_id" }
  );
  writeLocalCache(clean, blocks);
}

export async function invalidateDerivedCaches(rootBlockId: string, questaoId?: string): Promise<void> {
  const cleanRoot = cleanBlockId(rootBlockId);
  const keysToDelete = [`ids_${cleanRoot}`, `det_${cleanRoot}`];
  if (questaoId) {
    keysToDelete.push(`qfull_${cleanBlockId(questaoId)}`);
  }
  for (const k of keysToDelete) {
    removeLocalCache(k);
  }
  try {
    await supabase.from("notion_cache_blocos").delete().in("block_id", keysToDelete);
  } catch {}
}

/**
 * Garante que o cache do bloco raiz exista antes de acrescentar novos casos,
 * preservando quaisquer casos já existentes em notion_questoes_banco.
 */
async function ensureRootCacheSeeded(
  rootBlockId: string,
  existingCasos?: { id: string; nome: string }[]
): Promise<any[]> {
  const existing = await readSupabaseCacheBlocks(rootBlockId);
  if (existing !== null) return existing;

  const cleanRoot = cleanBlockId(rootBlockId);
  const seeded: any[] = [];
  const seen = new Set<string>();

  if (existingCasos && existingCasos.length > 0) {
    for (const c of existingCasos) {
      const cClean = cleanBlockId(c.id);
      if (!seen.has(cClean)) {
        seen.add(cClean);
        seeded.push(buildToggleBlock(c.id, rootBlockId, c.nome));
      }
    }
  } else {
    const { data: rows } = await supabase
      .from("notion_questoes_banco")
      .select("caso_id, caso_nome")
      .or(`bloco_raiz_id.eq.${rootBlockId},bloco_raiz_id.eq.${cleanRoot}`);
    for (const row of rows ?? []) {
      const cid = (row as any).caso_id || (row as any).caso_nome || "geral";
      const cClean = cleanBlockId(cid);
      if (!seen.has(cClean)) {
        seen.add(cClean);
        seeded.push(buildToggleBlock(cid, rootBlockId, (row as any).caso_nome || "Geral"));
      }
    }
  }

  return seeded;
}

/**
 * Faz upload de uma imagem (arquivo ou print colado) para o bucket público `notion-imagens`.
 */
export async function uploadNotionImageFile(file: File | Blob, prefix = "img"): Promise<string> {
  const mime = file.type || "image/png";
  const ext = mime.includes("webp")
    ? "webp"
    : mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("gif")
    ? "gif"
    : "png";

  const randomPart = Math.random().toString(36).slice(2, 8);
  const filePath = `manual_${prefix}_${Date.now()}_${randomPart}.${ext}`;

  const { error } = await supabase.storage
    .from("notion-imagens")
    .upload(filePath, file, { contentType: mime, upsert: true });

  if (error) {
    throw new Error(`Erro ao enviar imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from("notion-imagens").getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Cria um Caso (dentro de um Caderno) ou um Subcaso (dentro de um Caso).
 */
export async function createCasoOrSubcaso(params: {
  rootBlockId: string;
  parentBlockId: string;
  nome: string;
  isRootCaso?: boolean;
  existingCasos?: { id: string; nome: string }[];
}): Promise<{ id: string; nome: string; syncedToNotion: boolean }> {
  const nome = params.nome.trim();
  if (!nome) throw new Error("Informe o nome do caso.");

  let createdId: string | null = null;
  let syncedToNotion = false;

  try {
    const res = await fetch("/api/notion/builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_caso",
        parentBlockId: params.parentBlockId,
        nome,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.syncedToNotion && data?.blockId) {
      createdId = data.blockId;
      syncedToNotion = true;
    }
  } catch {}

  const finalId = createdId || generateUuid();
  const newToggle = buildToggleBlock(finalId, params.parentBlockId, nome);

  const parentBlocks = params.isRootCaso
    ? await ensureRootCacheSeeded(params.rootBlockId, params.existingCasos)
    : (await readSupabaseCacheBlocks(params.parentBlockId)) ?? [];

  const alreadyExists = parentBlocks.some(
    (b: any) => cleanBlockId(b.id) === cleanBlockId(finalId)
  );
  const updatedParentBlocks = alreadyExists ? parentBlocks : [...parentBlocks, newToggle];

  await writeSupabaseCacheBlocks(params.parentBlockId, updatedParentBlocks);
  await writeSupabaseCacheBlocks(finalId, []);
  await invalidateDerivedCaches(params.rootBlockId);

  return { id: finalId, nome, syncedToNotion };
}

/**
 * Remove um Caso ou Subcaso do cache estrutural (e suas questões em notion_questoes_banco, se solicitado).
 */
export async function deleteCasoOrSubcaso(params: {
  rootBlockId: string;
  parentBlockId: string;
  casoId: string;
  deleteQuestionsInside?: boolean;
}): Promise<void> {
  const targetClean = cleanBlockId(params.casoId);
  const parentBlocks = (await readSupabaseCacheBlocks(params.parentBlockId)) ?? [];
  const filtered = parentBlocks.filter((b: any) => cleanBlockId(b.id) !== targetClean);
  await writeSupabaseCacheBlocks(params.parentBlockId, filtered);

  if (params.deleteQuestionsInside) {
    await supabase
      .from("notion_questoes_banco")
      .delete()
      .or(`caso_id.eq.${params.casoId},caso_id.eq.${targetClean}`);
  }

  await invalidateDerivedCaches(params.rootBlockId);
}

/**
 * Cria ou atualiza uma Questão completa (título/número, tópico, categoria, texto escrito,
 * imagens da pergunta, gabarito escrito e imagens da resposta) dentro de um Caso ou Subcaso.
 */
export async function saveQuestaoToCaso(input: SaveQuestaoInput): Promise<{
  id: string;
  syncedToNotion: boolean;
}> {
  const isEditing = Boolean(input.id);
  const emoji = CATEGORY_EMOJI_MAP[input.categoria] || "🟢";
  const numeroClean = input.numero.trim();
  const topicoClean = input.topico.trim();
  const titleParts = [emoji, numeroClean, topicoClean].filter(Boolean);
  const toggleTitle = titleParts.join(" ");

  let finalId = input.id || "";
  let syncedToNotion = false;

  if (!isEditing) {
    try {
      const res = await fetch("/api/notion/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_questao",
          parentBlockId: input.targetCasoId,
          title: toggleTitle,
          enunciadoTexto: input.enunciadoTexto,
          imagensUrls: input.imagensUrls,
          gabaritoTexto: input.gabaritoTexto,
          gabaritoImagensUrls: input.gabaritoImagensUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.syncedToNotion && data?.blockId) {
        finalId = data.blockId;
        syncedToNotion = true;
      }
    } catch {}
  }

  if (!finalId) {
    finalId = generateUuid();
  }

  const nowIso = new Date().toISOString();

  // 1. Upsert completo na tabela estruturada notion_questoes_banco
  const { error } = await supabase.from("notion_questoes_banco").upsert(
    {
      id: finalId,
      bloco_raiz_id: input.rootBlockId,
      caso_id: input.targetCasoId,
      caso_nome: input.targetCasoNome,
      numero: numeroClean || "1",
      topico: topicoClean,
      categoria: input.categoria,
      enunciado_texto: input.enunciadoTexto.trim() || null,
      imagens_urls: input.imagensUrls.filter((u) => u && u.trim() !== ""),
      gabarito_texto: input.gabaritoTexto.trim() || null,
      gabarito_imagens_urls: input.gabaritoImagensUrls.filter((u) => u && u.trim() !== ""),
      notion_last_edited_time: syncedToNotion ? nowIso : "local",
      updated_at: nowIso,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Erro ao salvar questão: ${error.message}`);
  }

  // 2. Se moveu de outro caso durante edição, remove do cache do caso antigo
  const targetClean = cleanBlockId(input.targetCasoId);
  const oldClean = input.oldCasoId ? cleanBlockId(input.oldCasoId) : null;
  if (oldClean && oldClean !== targetClean) {
    const oldParentBlocks = await readSupabaseCacheBlocks(input.oldCasoId!);
    if (oldParentBlocks) {
      const cleaned = oldParentBlocks.filter((b: any) => cleanBlockId(b.id) !== cleanBlockId(finalId));
      await writeSupabaseCacheBlocks(input.oldCasoId!, cleaned);
    }
  }

  // 3. Atualiza/adiciona no cache do caso destino (para manter consistência caso cache exista)
  const targetParentBlocks = (await readSupabaseCacheBlocks(input.targetCasoId)) ?? [];
  const qBlock = buildToggleBlock(finalId, input.targetCasoId, toggleTitle, emoji);
  const idx = targetParentBlocks.findIndex((b: any) => cleanBlockId(b.id) === cleanBlockId(finalId));
  const nextParentBlocks =
    idx >= 0
      ? targetParentBlocks.map((b: any, i: number) => (i === idx ? qBlock : b))
      : [...targetParentBlocks, qBlock];
  await writeSupabaseCacheBlocks(input.targetCasoId, nextParentBlocks);

  await invalidateDerivedCaches(input.rootBlockId, finalId);

  return { id: finalId, syncedToNotion };
}

/**
 * Move ("joga") uma questão existente para dentro de outro Caso ou Subcaso.
 */
export async function moveQuestaoToCaso(params: {
  rootBlockId: string;
  questao: {
    id: string;
    numero: string;
    topic: string;
    categoryKey: BuilderCategoryKey;
    enunciadoTexto?: string;
    imageUrls: string[];
    resposta?: string;
    respostaImageUrls: string[];
  };
  fromCasoId: string;
  toCasoId: string;
  toCasoNome: string;
}): Promise<void> {
  const { rootBlockId, questao, fromCasoId, toCasoId, toCasoNome } = params;
  if (cleanBlockId(fromCasoId) === cleanBlockId(toCasoId)) return;

  const qClean = cleanBlockId(questao.id);

  // Tenta recuperar dados completos da tabela caso imageUrls/resposta ainda não tenham sido carregados
  let enunciadoTexto = questao.enunciadoTexto || "";
  let imagensUrls = questao.imageUrls || [];
  let gabaritoTexto = questao.resposta || "";
  let gabaritoImagensUrls = questao.respostaImageUrls || [];
  let existingEditTime = "local";

  const { data: existingRow } = await supabase
    .from("notion_questoes_banco")
    .select("*")
    .or(`id.eq.${questao.id},id.eq.${qClean}`)
    .maybeSingle();

  if (existingRow) {
    enunciadoTexto = existingRow.enunciado_texto || enunciadoTexto;
    imagensUrls = Array.isArray(existingRow.imagens_urls) && existingRow.imagens_urls.length > 0
      ? existingRow.imagens_urls
      : imagensUrls;
    gabaritoTexto = existingRow.gabarito_texto || gabaritoTexto;
    gabaritoImagensUrls = Array.isArray(existingRow.gabarito_imagens_urls) && existingRow.gabarito_imagens_urls.length > 0
      ? existingRow.gabarito_imagens_urls
      : gabaritoImagensUrls;
    if (existingRow.notion_last_edited_time) {
      existingEditTime = existingRow.notion_last_edited_time;
    }
  } else {
    // Tenta buscar do cache qfull_ se ainda não estiver na tabela estruturada
    const qfull = await supabase
      .from("notion_cache_blocos")
      .select("data_json")
      .eq("block_id", `qfull_${qClean}`)
      .maybeSingle();
    if (qfull.data?.data_json) {
      const parsed = typeof qfull.data.data_json === "string"
        ? JSON.parse(qfull.data.data_json)
        : qfull.data.data_json;
      if (Array.isArray(parsed?.imgs) && imagensUrls.length === 0) imagensUrls = parsed.imgs;
      if (Array.isArray(parsed?.rImgs) && gabaritoImagensUrls.length === 0) gabaritoImagensUrls = parsed.rImgs;
      if (parsed?.textResp && !gabaritoTexto) gabaritoTexto = parsed.textResp;
      if (parsed?.textEnunciado && !enunciadoTexto) enunciadoTexto = parsed.textEnunciado;
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("notion_questoes_banco").upsert(
    {
      id: existingRow?.id || questao.id,
      bloco_raiz_id: rootBlockId,
      caso_id: toCasoId,
      caso_nome: toCasoNome,
      numero: questao.numero || existingRow?.numero || "1",
      topico: questao.topic ?? existingRow?.topico ?? "",
      categoria: questao.categoryKey || existingRow?.categoria || "media",
      enunciado_texto: enunciadoTexto || null,
      imagens_urls: imagensUrls,
      gabarito_texto: gabaritoTexto || null,
      gabarito_imagens_urls: gabaritoImagensUrls,
      notion_last_edited_time: existingEditTime,
      updated_at: nowIso,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Erro ao mover questão: ${error.message}`);
  }

  // Atualiza cache do caso de origem e destino
  const fromBlocks = await readSupabaseCacheBlocks(fromCasoId);
  let movedBlock: any = null;
  if (fromBlocks) {
    movedBlock = fromBlocks.find((b: any) => cleanBlockId(b.id) === qClean) ?? null;
    await writeSupabaseCacheBlocks(
      fromCasoId,
      fromBlocks.filter((b: any) => cleanBlockId(b.id) !== qClean)
    );
  }

  const toBlocks = (await readSupabaseCacheBlocks(toCasoId)) ?? [];
  const emoji = CATEGORY_EMOJI_MAP[questao.categoryKey] || "🟢";
  const title = [emoji, questao.numero, questao.topic].filter(Boolean).join(" ");
  const blockToInsert = movedBlock
    ? { ...movedBlock, parent: { type: "block_id", block_id: toCasoId } }
    : buildToggleBlock(questao.id, toCasoId, title, emoji);

  if (!toBlocks.some((b: any) => cleanBlockId(b.id) === qClean)) {
    await writeSupabaseCacheBlocks(toCasoId, [...toBlocks, blockToInsert]);
  }

  await invalidateDerivedCaches(rootBlockId, questao.id);
}

/**
 * Exclui uma questão do banco e do cache do caso pai.
 */
export async function deleteQuestaoFromCaso(params: {
  rootBlockId: string;
  parentCasoId: string;
  questaoId: string;
}): Promise<void> {
  const qClean = cleanBlockId(params.questaoId);
  await supabase
    .from("notion_questoes_banco")
    .delete()
    .or(`id.eq.${params.questaoId},id.eq.${qClean}`);

  const parentBlocks = await readSupabaseCacheBlocks(params.parentCasoId);
  if (parentBlocks) {
    await writeSupabaseCacheBlocks(
      params.parentCasoId,
      parentBlocks.filter((b: any) => cleanBlockId(b.id) !== qClean)
    );
  }

  await invalidateDerivedCaches(params.rootBlockId, params.questaoId);
}

/**
 * Carrega a árvore de Casos e Subcasos de um Caderno para os seletores dos modais.
 */
export async function fetchCadernoCasoTree(rootBlockId: string): Promise<CasoTreeNode[]> {
  const cleanRoot = cleanBlockId(rootBlockId);
  const visited = new Set<string>();

  async function walk(parentId: string, depth: number): Promise<CasoTreeNode[]> {
    if (depth > 3) return [];
    const blocks = await readSupabaseCacheBlocks(parentId);
    if (!blocks) return [];

    const nodes: CasoTreeNode[] = [];
    for (const b of blocks) {
      if (b.type !== "toggle") continue;
      if (isQuestionBlock(b)) continue;
      const bClean = cleanBlockId(b.id);
      if (visited.has(bClean)) continue;
      visited.add(bClean);
      const nome = richTextPlain(b.toggle?.rich_text ?? []) || "Sem nome";
      const subcasos = await walk(b.id, depth + 1);
      nodes.push({
        id: b.id,
        nome,
        parentId,
        depth,
        subcasos,
      });
    }
    return nodes;
  }

  const tree = await walk(rootBlockId, 0);

  // Mescla quaisquer casos que existam apenas em notion_questoes_banco e não estejam na árvore
  const knownIds = new Set<string>();
  const collectIds = (list: CasoTreeNode[]) => {
    for (const n of list) {
      knownIds.add(cleanBlockId(n.id));
      collectIds(n.subcasos);
    }
  };
  collectIds(tree);

  const { data: rows } = await supabase
    .from("notion_questoes_banco")
    .select("caso_id, caso_nome")
    .or(`bloco_raiz_id.eq.${rootBlockId},bloco_raiz_id.eq.${cleanRoot}`);

  for (const r of rows ?? []) {
    const cid = (r as any).caso_id;
    if (!cid) continue;
    const cClean = cleanBlockId(cid);
    if (!knownIds.has(cClean)) {
      knownIds.add(cClean);
      tree.push({
        id: cid,
        nome: (r as any).caso_nome || "Geral",
        parentId: rootBlockId,
        depth: 0,
        subcasos: [],
      });
    }
  }

  return tree;
}
