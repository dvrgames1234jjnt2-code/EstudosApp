"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Loader2,
  BookMarked, RefreshCw, X, Check, Play, Eye, EyeOff,
  Triangle, Flag, History, LayoutGrid
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const CATEGORIES = [
  { key: "bonus",     label: "Bônus",     emojis: ["🎉","🥳","🎊"],        icon: "🎉",  color: "#f59e0b", textColor: "#fbbf24", dot: false },
  { key: "faceis",    label: "Fáceis",    emojis: ["🟢","✅","💚","🍀"],   icon: null,  color: "#22c55e", textColor: "#4ade80", dot: true  },
  { key: "atencao",   label: "Atenção",   emojis: ["🔵","💙","🌀","🫐"],   icon: null,  color: "#3b82f6", textColor: "#60a5fa", dot: true  },
  { key: "lacuna",    label: "Lacuna",    emojis: ["🌱","🌿","🪴"],         icon: "🌱",  color: "#84cc16", textColor: "#a3e635", dot: false },
  { key: "media",     label: "Média",     emojis: ["🟡","💛","⭐","🌟","🟠","🧡"],   icon: null,  color: "#f97316", textColor: "#fb923c", dot: true  },
  { key: "dificil",   label: "Difícil",   emojis: ["🔴","❤️","💔","🔥"],   icon: null,  color: "#ef4444", textColor: "#f87171", dot: true  },
  { key: "ultrahard", label: "Ultrahard", emojis: ["🟣","💜","👾","🫀"],   icon: null,  color: "#a855f7", textColor: "#c084fc", dot: true  },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

const CATEGORY_ORDER: Record<CategoryKey, number> = {
  bonus: 1,
  faceis: 2,
  media: 3,
  atencao: 4,
  lacuna: 5,
  dificil: 6,
  ultrahard: 7,
};

interface NotionBlockRow {
  id: string; block_id: string; nome: string; descricao?: string; materia?: string; created_at: string;
}

interface RichText {
  plain_text: string;
  href?: string | null;
}

interface NotionAPIBlock {
  id: string; type: string; has_children: boolean;
  icon?: { type: "emoji" | "external" | "file"; emoji?: string };
  toggle?: { rich_text: RichText[] };
  paragraph?: { rich_text: RichText[] };
  image?: { type: "external" | "file"; external?: { url: string }; file?: { url: string } };
  parent?: { type: "block_id" | "page_id" | "database_id" | "workspace"; block_id?: string; page_id?: string };
  [key: string]: any;
}

interface Questao {
  id: string;
  numero: string;
  topic: string;
  categoryKey: CategoryKey;
  imageUrls: string[];
  resposta?: string;
  respostaImageUrls: string[];
  caseLabel?: string;
}

interface Caso {
  id: string;
  nome: string;
  questoes: Questao[];
}

// Estatísticas agregadas de todas as tentativas de uma questão (não só a última)
interface QuestaoStats { total: number; corretas: number; ultimo: "acerto" | "erro" }

function richText(rt: RichText[] = []) { return rt.map(r => r.plain_text).join(""); }
function formatDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function imgUrl(b: NotionAPIBlock) {
  const img = b.image;
  if (!img) return undefined;
  return img.type === "external" ? img.external?.url : img.file?.url;
}

const ALL_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FEFF}][\uFE0F\u20E3]?/gu;

function parseQuestaoTitle(text: string): { emojis: string[]; numero: string; topic: string } {
  const t = text.trim();
  const emojis = [...t.matchAll(ALL_EMOJI_RE)].map(m => m[0]);
  const stripped = t.replace(ALL_EMOJI_RE, "").trim();
  const numM = stripped.match(/(\d+)/);
  const numero = numM ? numM[1] : "";
  const topic = numM ? stripped.slice(stripped.indexOf(numM[1]) + numM[1].length).trim() : stripped;
  return { emojis, numero, topic };
}

function detectCategory(emojis: string[]): CategoryKey | null {
  for (const emoji of emojis) {
    for (const cat of CATEGORIES) {
      if ((cat.emojis as readonly string[]).some(e => e === emoji || emoji.includes(e) || e.includes(emoji))) {
        return cat.key;
      }
    }
  }
  return null;
}

// Cache de respostas com expiração de 45 minutos (S3 do Notion expira em 1h) e deduplicação de requests simultâneos
const childrenCache = new Map<string, { data: NotionAPIBlock[]; timestamp: number }>();
const childrenInFlight = new Map<string, Promise<NotionAPIBlock[]>>();

async function fetchChildren(blockId: string): Promise<NotionAPIBlock[]> {
  const clean = blockId.replace(/-/g, "");
  const now = Date.now();

  if (childrenCache.has(clean)) {
    const cached = childrenCache.get(clean)!;
    // Se o cache tem menos de 45 minutos, retorna. Caso contrário, expira e força refetch
    if (now - cached.timestamp < 45 * 60 * 1000) {
      return cached.data;
    } else {
      childrenCache.delete(clean);
    }
  }

  if (childrenInFlight.has(clean)) return childrenInFlight.get(clean)!;

  const req = fetch(`/api/notion/blocks/${clean}/children?page_size=100`)
    .then(async res => {
      if (!res.ok) throw new Error(`Notion ${res.status}`);
      const data: NotionAPIBlock[] = (await res.json()).results ?? [];
      childrenCache.set(clean, { data, timestamp: Date.now() });
      childrenInFlight.delete(clean);
      return data;
    })
    .catch(e => {
      childrenInFlight.delete(clean);
      throw e;
    });

  childrenInFlight.set(clean, req);
  return req;
}

// Cache de informações resolvidas individualmente (usado pelo painel de desempenho,
// que recebe apenas IDs de questão vindos do Supabase, sem a árvore carregada)
interface QuestaoInfo { title: string; emoji?: string; blocoNome?: string }
const questaoInfoCache = new Map<string, QuestaoInfo>();

async function fetchNotionBlock(id: string): Promise<NotionAPIBlock> {
  const res = await fetch(`/api/notion/blocks/${id}`);
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  return res.json();
}

// Sobe a cadeia de "parent" do bloco até encontrar um bloco cadastrado em `notion_blocks`
// (o "caderno"), ou até esgotar o limite de saltos / chegar na página raiz.
async function resolveBlocoNome(
  startParent: NotionAPIBlock["parent"],
  blocksMap: Map<string, string>
): Promise<string | undefined> {
  let parent = startParent;
  const visited = new Set<string>();
  let hops = 0;

  while (parent?.type === "block_id" && parent.block_id && hops < 15) {
    const parentClean = parent.block_id.replace(/-/g, "");
    if (visited.has(parentClean)) break;
    visited.add(parentClean);

    if (blocksMap.has(parentClean)) return blocksMap.get(parentClean);

    try {
      const pData = await fetchNotionBlock(parentClean);
      parent = pData.parent;
    } catch {
      break;
    }
    hops++;
  }
  return undefined;
}

async function resolveQuestaoInfo(questaoId: string, blocksMap: Map<string, string>): Promise<QuestaoInfo> {
  const clean = questaoId.replace(/-/g, "");
  if (questaoInfoCache.has(clean)) return questaoInfoCache.get(clean)!;

  const data = await fetchNotionBlock(clean);

  const rawTitle =
    richText(data.toggle?.rich_text) ||
    richText(data.paragraph?.rich_text) ||
    "Questão sem título";
  const { emojis, numero, topic } = parseQuestaoTitle(rawTitle);
  const emoji = (data.icon?.type === "emoji" ? data.icon.emoji : undefined) ?? emojis[0];
  const title = numero ? `Questão ${numero}${topic ? ` — ${topic}` : ""}` : rawTitle;

  const blocoNome = await resolveBlocoNome(data.parent, blocksMap);

  const info: QuestaoInfo = { title, emoji, blocoNome };
  questaoInfoCache.set(clean, info);
  return info;
}

// Varredura recursiva de um caderno (bloco) inteiro para coletar todos os IDs de
// questões (toggles com emoji de categoria reconhecido), reutilizando o cache de
// fetchChildren. Usada para calcular o resumo (total/acertos/erros/dúvidas) sem
// precisar abrir o caderno na tela.
const questoesDoBlocoCache = new Map<string, string[]>();

async function collectQuestaoIds(rootBlockId: string): Promise<string[]> {
  const clean = rootBlockId.replace(/-/g, "");
  if (questoesDoBlocoCache.has(clean)) return questoesDoBlocoCache.get(clean)!;

  const ids: string[] = [];

  async function walk(blockId: string) {
    const children = await fetchChildren(blockId);
    for (const child of children) {
      if (child.type !== "toggle") continue;
      const rawTitle = richText(child.toggle?.rich_text ?? []);
      const { emojis: textEmojis } = parseQuestaoTitle(rawTitle);
      const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
      const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
      if (categoryKey) {
        ids.push(child.id);
      } else if (child.has_children) {
        await walk(child.id);
      }
    }
  }

  await walk(clean);
  questoesDoBlocoCache.set(clean, ids);
  return ids;
}

// Igual à varredura acima, mas coleta os dados necessários para desenhar o
// "Gabarito e Navegação" por caso: número, tópico, categoria e o nome do
// toggle-pai imediato (o "caso"/"subcaso" que agrupa aquele conjunto de questões).
interface QuestaoResumo {
  id: string;
  numero: string;
  topic: string;
  categoryKey: CategoryKey;
  caseLabel: string;
}
interface QuestaoDetalhesResult {
  itens: QuestaoResumo[];
  caseIcons: Record<string, string>;
}
const questoesDetalhesCache = new Map<string, QuestaoDetalhesResult>();

async function collectQuestaoDetails(rootBlockId: string): Promise<QuestaoDetalhesResult> {
  const clean = rootBlockId.replace(/-/g, "");
  if (questoesDetalhesCache.has(clean)) return questoesDetalhesCache.get(clean)!;

  const itens: QuestaoResumo[] = [];
  const caseIcons: Record<string, string> = {};

  async function walk(blockId: string, parentLabel: string) {
    const children = await fetchChildren(blockId);
    for (const child of children) {
      if (child.type !== "toggle") continue;
      const rawTitle = richText(child.toggle?.rich_text ?? []);
      const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
      const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
      const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
      if (categoryKey) {
        itens.push({ id: child.id, numero, topic, categoryKey, caseLabel: parentLabel });
      } else {
        const label = rawTitle || "Sem nome";
        if (!(label in caseIcons) && child.icon?.type === "emoji" && child.icon.emoji) {
          caseIcons[label] = child.icon.emoji;
        }
        if (child.has_children) await walk(child.id, label);
      }
    }
  }

  await walk(clean, "Geral");
  const result: QuestaoDetalhesResult = { itens, caseIcons };
  questoesDetalhesCache.set(clean, result);
  return result;
}

function QuestaoTitleLabel({ questaoId, blocksMap }: { questaoId: string; blocksMap: Map<string, string> }) {
  const [info, setInfo] = useState<QuestaoInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    resolveQuestaoInfo(questaoId, blocksMap)
      .then(res => { if (active) setInfo(res); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [questaoId, blocksMap]);

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 text-[11px] rounded-md hover:bg-white/[0.03] transition-all">
      <span className="shrink-0">{info?.emoji ?? "📄"}</span>
      {failed ? (
        <span className="text-slate-600 italic truncate">Questão indisponível ({questaoId.slice(0, 8)}…)</span>
      ) : (
        <div className="flex flex-col min-w-0">
          <span className="text-[13.5px] font-normal text-[#8E97A8] truncate">{info?.title ?? "Carregando…"}</span>
          {info?.blocoNome && (
            <span className="text-[9px] text-indigo-400/70 font-bold uppercase tracking-wide truncate">
              {info.blocoNome}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function QuestaoRow({ 
  questao, 
  user,
  isDuvida,
  onToggleDuvida,
  onAnswered,
  stats,
  apenasComErros,
  startOpen = false
}: { 
  questao: Questao; 
  user: any;
  isDuvida: boolean;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  stats?: QuestaoStats;
  apenasComErros?: boolean;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [showResp, setShowResp] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>([]);
  const [respostaText, setRespostaText] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<'acerto' | 'erro' | null>(null);
  const [recordingDuvida, setRecordingDuvida] = useState(false);

  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState<{ data: string; horario: string; correto: string }[] | null>(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const fetchHistorico = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("notion_respostas")
        .select("data, horario, correto")
        .eq("questao_id", questao.id)
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .order("horario", { ascending: false });
      if (error) throw error;
      setHistorico(data ?? []);
    } catch (e) {
      console.error("Erro ao buscar histórico de respostas:", e);
    } finally {
      setLoadingHistorico(false);
    }
  }, [user?.id, questao.id]);

  const toggleHistorico = () => {
    setShowHistorico(v => {
      const next = !v;
      if (next && historico === null) fetchHistorico();
      return next;
    });
  };

  const handleRecordAnswer = async (isCorrect: boolean) => {
    if (!user) return;
    setRecording(true);
    setRecorded(null);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8);

    try {
      const { error } = await supabase.from("notion_respostas").insert({
        questao_id: questao.id,
        resposta_usuario: isCorrect ? "Acerto" : "Erro",
        correto: isCorrect ? "Sim" : "Não",
        data: date,
        horario: time,
        status: isCorrect ? "Acertei" : "Errei",
        user_id: user.id,
      });
      if (error) throw error;
      setRecorded(isCorrect ? 'acerto' : 'erro');
      setTimeout(() => setRecorded(null), 3000);
      onAnswered();
      if (historico !== null) fetchHistorico();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar resposta: " + e.message);
    } finally {
      setRecording(false);
    }
  };

  const handleToggleDuvidaLocal = async () => {
    if (!user) return;
    setRecordingDuvida(true);
    try {
      await onToggleDuvida(questao.id, !isDuvida);
    } finally {
      setRecordingDuvida(false);
    }
  };

  const emojiMap: Record<CategoryKey, string> = {
    bonus: "🎉",
    faceis: "🟢",
    atencao: "🔵",
    lacuna: "🌱",
    media: "🟠",
    dificil: "🔴",
    ultrahard: "🟣",
  };

  const catEmoji = emojiMap[questao.categoryKey] || "🟢";
  const categoryInfo = CATEGORIES.find(c => c.key === questao.categoryKey);
  const catLabel = categoryInfo?.label || "Geral";
  const catColor = categoryInfo?.textColor || "#94a3b8";

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded && !loading) {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          console.log(`[QuestaoRow DEBUG] Buscando filhos da questao ${questao.numero} (ID: ${questao.id})`);
          const children = await fetchChildren(questao.id);
          console.log(`[QuestaoRow DEBUG] Filhos recebidos para questao ${questao.numero}:`, children);

          const imgs: string[] = [];
          const rImgs: string[] = [];
          let textResp: string | undefined;

          for (const child of children) {
            if (child.type === "image") {
              const url = imgUrl(child);
              console.log(`[QuestaoRow DEBUG] Bloco de imagem detectado na questao ${questao.numero}:`, child, "URL:", url);
              if (url) imgs.push(url);
            } else if (child.type === "toggle") {
              const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
              if (tText.includes("resposta") && child.has_children) {
                console.log(`[QuestaoRow DEBUG] Toggle de resposta encontrado na questao ${questao.numero} (ID: ${child.id})`);
                const rChildren = await fetchChildren(child.id);
                console.log(`[QuestaoRow DEBUG] Filhos do toggle de resposta da questao ${questao.numero}:`, rChildren);
                const texts: string[] = [];
                for (const rc of rChildren) {
                  if (rc.type === "image") {
                    const url = imgUrl(rc);
                    console.log(`[QuestaoRow DEBUG] Bloco de imagem na resposta da questao ${questao.numero}:`, rc, "URL:", url);
                    if (url) rImgs.push(url);
                  } else {
                    const t = richText(rc.paragraph?.rich_text ?? rc.bulleted_list_item?.rich_text ?? rc.numbered_list_item?.rich_text ?? []);
                    if (t) texts.push(t);
                  }
                }
                textResp = texts.join("\n") || undefined;
              }
            }
          }
          if (active) {
            console.log(`[QuestaoRow DEBUG] Definindo dados da questao ${questao.numero}. Imagens:`, imgs, "Imagens Resposta:", rImgs);
            setImageUrls(imgs);
            setRespostaImageUrls(rImgs);
            setRespostaText(textResp);
            setLoaded(true);
          }
        } catch (e) {
          console.error("Erro ao carregar detalhes da questão:", e);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }
  }, [open, questao.id, loaded]);

  const isErro = stats?.ultimo === "erro";
  const isAcerto = stats?.ultimo === "acerto";

  if (apenasComErros && !isErro) {
    return null;
  }

  const showErroStyle = apenasComErros && isErro;

  return (
    <div className="flex flex-col py-1">
      <div className={`flex items-center gap-3 py-1.5 px-2.5 transition-all rounded-lg ${
        showErroStyle ? "bg-rose-500/[0.03] border border-rose-500/15" : "hover:bg-white/[0.03]"
      }`}>
        <button
          onClick={() => { setOpen(v => !v); setShowResp(false); }}
          className="text-slate-500 hover:text-slate-300 transition-all w-4 h-4 flex items-center justify-center shrink-0"
        >
          {loading ? (
            <Loader2 size={10} className="animate-spin text-slate-500" />
          ) : (
            <span className="text-[10px] select-none">{open ? "▼" : "▶"}</span>
          )}
        </button>

        <span className="text-[11px] font-normal text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md shrink-0 tabular-nums">
          {questao.numero}
        </span>

        <span className="text-sm shrink-0 select-none">{catEmoji}</span>

        <span
          className="text-[11px] font-normal px-2.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] shrink-0"
          style={{ color: catColor }}
        >
          {catLabel}
        </span>

        {questao.topic && (
          <span className="text-[14px] sm:text-[15px] font-normal text-[#8E97A8] leading-relaxed truncate ml-0.5">
            — {questao.topic}
          </span>
        )}

        {questao.caseLabel && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/40 border border-slate-700/50 text-[10px] font-medium text-slate-400 truncate shrink-0 ml-1">
            <span className="text-slate-600 font-normal">in</span> {questao.caseLabel}
          </span>
        )}

        {isDuvida && (
          <Flag size={11} className="fill-red-500 text-red-500 shrink-0 ml-1" />
        )}

        {isErro && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/30 border border-rose-500/20 shrink-0 ml-auto shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            Errou
          </span>
        )}
        {isAcerto && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 shrink-0 ml-auto shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Acertou
          </span>
        )}
      </div>

      {open && (
        <div className="ml-6 pl-4 border-l border-indigo-500/[0.15] my-2 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando detalhes...
            </div>
          ) : (
            <>
              {imageUrls.length > 0 ? (
                imageUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Q${questao.numero} img${i + 1}`} className="w-full max-w-2xl rounded-xl border border-white/[0.06] object-contain bg-white" />
                ))
              ) : (
                <p className="text-[11px] text-slate-700 italic">Sem imagem</p>
              )}

              <button
                onClick={() => setShowResp(v => !v)}
                className="flex items-center gap-2 self-start px-2.5 py-1 rounded-md border border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 text-[10px] font-bold transition-all"
              >
                {showResp ? <EyeOff size={10} /> : <Eye size={10} />}
                {showResp ? "Ocultar Resposta" : "Ver Resposta"}
              </button>

              {user && (
                <button
                  onClick={toggleHistorico}
                  className="flex items-center gap-2 self-start px-2.5 py-1 rounded-md border border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 text-[10px] font-bold transition-all"
                >
                  <History size={10} />
                  {showHistorico ? "Ocultar Histórico" : "Ver Histórico"}
                  {historico && historico.length > 0 && (
                    <span className="text-[9px] text-slate-600">({historico.length})</span>
                  )}
                </button>
              )}

              {showHistorico && (
                <div className="border border-indigo-500/20 rounded-xl p-3 bg-indigo-500/[0.03] flex flex-col gap-2">
                  {loadingHistorico ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-1">
                      <Loader2 size={11} className="animate-spin" /> Carregando histórico...
                    </div>
                  ) : !historico || historico.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">Nenhuma tentativa registrada ainda.</p>
                  ) : (
                    <>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
                        {historico.length} tentativa{historico.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {historico.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                          >
                            <span className="text-slate-500 tabular-nums">
                              {formatDataBR(h.data)} às {h.horario?.slice(0, 5)}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-black uppercase tracking-wide ${
                                h.correto === "Sim" ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {h.correto === "Sim" ? <Check size={10} /> : <X size={10} />}
                              {h.correto === "Sim" ? "Acerto" : "Erro"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {showResp && (
                <div className="border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/[0.03] flex flex-col gap-3">
                  {respostaImageUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Resposta img${i + 1}`} className="w-full max-w-2xl rounded-xl border border-white/[0.06] object-contain bg-white" />
                  ))}
                  {respostaText ? (
                    <p className="text-[14px] sm:text-[15px] font-normal text-[#8E97A8] whitespace-pre-wrap leading-relaxed">{respostaText}</p>
                  ) : respostaImageUrls.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">Sem resposta registrada.</p>
                  ) : null}

                  {user && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-500/10 shrink-0">
                      <span className="text-[10px] text-slate-500 font-bold mr-auto">Registrar tentativa:</span>
                      
                      <button
                        onClick={handleToggleDuvidaLocal}
                        disabled={recordingDuvida}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 ${
                          isDuvida 
                            ? 'bg-red-600/30 border border-red-500/50 text-red-300' 
                            : 'bg-slate-700/20 hover:bg-slate-700/40 text-slate-400'
                        }`}
                      >
                        <Flag size={11} className={isDuvida ? "fill-red-500 text-red-500" : ""} /> Em dúvida
                      </button>

                      <button
                        onClick={() => handleRecordAnswer(true)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95"
                      >
                        <Check size={11} /> Acertei
                      </button>
                      <button
                        onClick={() => handleRecordAnswer(false)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95"
                      >
                        <X size={11} /> Errei
                      </button>
                      {recorded && (
                        <span className={`text-[10px] font-black uppercase tracking-wider ml-1 animate-pulse ${recorded === 'acerto' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {recorded === 'acerto' ? 'Salvo! 🎉' : 'Salvo! ❌'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CasoCard({ 
  caso, 
  depth = 0, 
  user,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros
}: { 
  caso: Caso; 
  depth?: number; 
  user: any;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap?: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [subcasos, setSubcasos] = useState<Caso[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !loaded && !loading) {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const children = await fetchChildren(caso.id);
          const tempQuestoes: Questao[] = [];
          const tempSubcasos: Caso[] = [];

          for (const child of children) {
            if (child.type !== "toggle") continue;

            const rawTitle = richText(child.toggle?.rich_text ?? []);
            const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
            const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
            const emojis = [...iconEmoji, ...textEmojis];
            const categoryKey = detectCategory(emojis);

            if (categoryKey) {
              tempQuestoes.push({ id: child.id, numero, topic, categoryKey, imageUrls: [], respostaImageUrls: [] });
            } else {
              tempSubcasos.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
            }
          }

          if (active) {
            tempQuestoes.sort((a, b) => {
              const valA = CATEGORY_ORDER[a.categoryKey] ?? 99;
              const valB = CATEGORY_ORDER[b.categoryKey] ?? 99;
              if (valA !== valB) return valA - valB;
              return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
            });

            setQuestoes(tempQuestoes);
            setSubcasos(tempSubcasos);
            setLoaded(true);

            for (const q of tempQuestoes) {
              fetchChildren(q.id).then(children => {
                for (const child of children) {
                  if (child.type === "toggle") {
                    const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
                    if (tText.includes("resposta") && child.has_children) {
                      fetchChildren(child.id).catch(() => {});
                    }
                  }
                }
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Erro ao carregar caso:", e);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }
  }, [open, caso.id, loaded]);

  const hasContent = questoes.length > 0 || subcasos.length > 0;
  const total = loaded ? (questoes.length + subcasos.length) || undefined : undefined;

  const errosInCaso = loaded && resultadosMap
    ? questoes.filter(q => resultadosMap.get(q.id)?.ultimo === "erro").length
    : 0;

  if (apenasComErros && loaded && errosInCaso === 0) {
    return null;
  }

  const hasErrosInCaso = apenasComErros && errosInCaso > 0;
  const indent = depth > 0 ? "pl-4 border-l border-indigo-500/[0.15] ml-3" : "";

  return (
    <div className={`flex flex-col gap-0.5 ${indent}`}>
      <div className={`flex items-center justify-between py-1 px-2 transition-all rounded-lg group ${
        hasErrosInCaso ? "bg-rose-500/[0.03] border border-rose-500/20" : "hover:bg-white/[0.02]"
      }`}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {loading ? (
              <Loader2 size={10} className="animate-spin text-slate-500" />
            ) : (
              open ? "▼" : "▶"
            )}
          </span>
          <span className={`font-medium transition-colors ${hasErrosInCaso ? "text-rose-300 font-bold" : "text-[#8E97A8] group-hover:text-white"} ${depth === 0 ? "text-[14px]" : "text-[13px]"}`}>
            {caso.nome}
          </span>

          {hasErrosInCaso && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/30 border border-rose-500/20 shrink-0 ml-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              {errosInCaso} {errosInCaso === 1 ? "erro" : "erros"}
            </span>
          )}
        </button>
        {total !== undefined && (
          <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md tabular-nums shrink-0">
            {total}
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 pl-4 border-l border-indigo-500/[0.15] ml-4 my-0.5">
          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando...
            </div>
          ) : !hasContent ? (
            <div className="text-[11px] text-slate-600 italic py-1 px-2">Sem questões com emoji reconhecido.</div>
          ) : (
            <>
              {subcasos.map(sub => (
                <CasoCard 
                  key={sub.id} 
                  caso={sub} 
                  depth={depth + 1} 
                  user={user} 
                  duvidasIds={duvidasIds}
                  onToggleDuvida={onToggleDuvida}
                  onAnswered={onAnswered}
                  resultadosMap={resultadosMap}
                  apenasComErros={apenasComErros}
                />
              ))}

              {questoes.map((q, idx) => (
                <div key={q.id} className={idx < questoes.length - 1 ? "border-b border-white/[0.06] pb-1 mb-1" : ""}>
                  <QuestaoRow 
                    questao={q} 
                    user={user} 
                    isDuvida={duvidasIds.has(q.id)}
                    onToggleDuvida={onToggleDuvida}
                    onAnswered={onAnswered}
                    stats={resultadosMap?.get(q.id)}
                    apenasComErros={apenasComErros}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BlockViewer({ 
  block, 
  user,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros
}: { 
  block: NotionBlockRow; 
  user: any;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap?: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
}) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [erroItens, setErroItens] = useState<QuestaoResumo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        if (apenasComErros) {
          const details = await collectQuestaoDetails(block.block_id);
          const errs = details.itens.filter(i => resultadosMap?.get(i.id)?.ultimo === "erro");
          if (!cancelled) {
            setErroItens(errs);
            setLoading(false);
          }
          return;
        }

        const rootChildren = await fetchChildren(block.block_id);
        const built: Caso[] = [];

        for (const casoBlock of rootChildren) {
          const casoNome =
            richText(casoBlock.toggle?.rich_text) ||
            richText(casoBlock.heading_1?.rich_text) ||
            richText(casoBlock.heading_2?.rich_text) ||
            richText(casoBlock.heading_3?.rich_text) ||
            richText(casoBlock.paragraph?.rich_text) ||
            casoBlock.child_page?.title || "Sem nome";

          built.push({ id: casoBlock.id, nome: casoNome, questoes: [] });
        }

        if (!cancelled) setCasos(built);

        for (const c of built) {
          fetchChildren(c.id).catch(() => {});
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [block.block_id, apenasComErros, resultadosMap]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
      <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest animate-pulse">Carregando questões...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center py-10 gap-2">
      <p className="text-[11px] text-red-400">{error}</p>
      <p className="text-[10px] text-slate-600">Verifique se a integração Notion tem acesso a este bloco.</p>
    </div>
  );

  if (apenasComErros) {
    if (!erroItens || erroItens.length === 0) {
      return <p className="text-[11px] text-slate-600 italic text-center py-6">Nenhuma questão errada neste caderno.</p>;
    }

    return (
      <div className="flex flex-col gap-1 pl-4 border-l border-red-500/20 ml-4 my-1">
        {erroItens.map((item, idx) => (
          <div key={item.id} className={idx < erroItens.length - 1 ? "border-b border-white/[0.05] pb-1 mb-1" : ""}>
            <QuestaoRow
              questao={{
                id: item.id,
                numero: item.numero,
                topic: item.topic,
                categoryKey: item.categoryKey,
                imageUrls: [],
                respostaImageUrls: [],
                caseLabel: item.caseLabel,
              }}
              user={user}
              isDuvida={duvidasIds.has(item.id)}
              onToggleDuvida={onToggleDuvida}
              onAnswered={onAnswered}
              stats={resultadosMap?.get(item.id)}
              apenasComErros={apenasComErros}
            />
          </div>
        ))}
      </div>
    );
  }

  if (casos.length === 0) return <p className="text-[11px] text-slate-600 italic text-center py-10">Nenhum caso encontrado.</p>;

  return (
    <div className="flex flex-col gap-2 pl-4 border-l border-indigo-500/[0.15] ml-4 mt-1">
      {casos.map(caso => (
        <CasoCard 
          key={caso.id} 
          caso={caso} 
          user={user} 
          duvidasIds={duvidasIds}
          onToggleDuvida={onToggleDuvida}
          onAnswered={onAnswered}
          resultadosMap={resultadosMap}
          apenasComErros={apenasComErros}
        />
      ))}
    </div>
  );
}

function BlocoStatsBadge({
  block,
  resultadosMap,
  duvidasIds,
  onStatsLoaded,
}: {
  block: NotionBlockRow;
  resultadosMap: Map<string, QuestaoStats>;
  duvidasIds: Set<string>;
  onStatsLoaded?: (stats: { acertos: number; erros: number; duvidas: number; total: number }) => void;
}) {
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    setIds(null);
    collectQuestaoIds(block.block_id)
      .then(res => { if (active) setIds(res); })
      .catch(() => { if (active) setIds([]); });
    return () => { active = false; };
  }, [block.block_id]);

  let acertos = 0, erros = 0, duvidas = 0;
  if (ids) {
    for (const id of ids) {
      const status = resultadosMap.get(id)?.ultimo;
      if (status === "acerto") acertos++;
      else if (status === "erro") erros++;
      if (duvidasIds.has(id)) duvidas++;
    }
  }

  useEffect(() => {
    if (ids && onStatsLoaded) {
      onStatsLoaded({ acertos, erros, duvidas, total: ids.length });
    }
  }, [ids, acertos, erros, duvidas, onStatsLoaded]);

  if (ids === null) {
    return <Loader2 size={11} className="animate-spin text-slate-700 shrink-0" />;
  }
  if (ids.length === 0) return null;

  const respondidas = acertos + erros;
  const aproveitamento = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

  const aproveitamentoClasses =
    aproveitamento === null
      ? "border-white/[0.06] text-slate-600 bg-white/[0.02]"
      : aproveitamento >= 70
      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      : aproveitamento >= 40
      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
      : "border-red-500/30 text-red-400 bg-red-500/10";

  return (
    <div className="flex items-center gap-2 text-[10px] font-bold shrink-0 mr-2">
      <span className="text-slate-600">{ids.length} quest.</span>
      <span className="text-emerald-400 flex items-center gap-0.5"><Check size={10} />{acertos}</span>
      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-bold tabular-nums transition-all ${
        erros > 0 
          ? "bg-red-500/15 border-red-500/35 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]" 
          : "border-transparent text-slate-600"
      }`}>
        <X size={10} />{erros}
      </span>
      <span className="text-amber-400 flex items-center gap-0.5"><Flag size={10} />{duvidas}</span>
      <span className={`px-1.5 py-0.5 rounded-md border tabular-nums ${aproveitamentoClasses}`}>
        {aproveitamento === null ? "—" : `${aproveitamento}%`}
      </span>
    </div>
  );
}

// Face/ícone e cor de cada nível de dificuldade, usado no badge do bloquinho
const FACE_EMOJI: Record<CategoryKey, string> = {
  bonus: "🎉", faceis: "😊", atencao: "🔵", lacuna: "🌱", media: "😐", dificil: "😞", ultrahard: "🟣",
};

function QuestaoBloquinho({
  q,
  stats,
  isDuvida,
  isSelected,
  onClick,
}: {
  q: QuestaoResumo;
  stats?: QuestaoStats;
  isDuvida: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const catInfo = CATEGORIES.find(c => c.key === q.categoryKey);
  const pct = stats && stats.total > 0 ? Math.round((stats.corretas / stats.total) * 100) : null;
  const tier: "green" | "amber" | "red" | "neutral" = pct === null ? "neutral" : pct >= 70 ? "green" : pct >= 40 ? "amber" : "red";
  const tierClasses = {
    green: "border-emerald-500/25 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]",
    amber: "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.09]",
    red: "border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/[0.09]",
    neutral: "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
  }[tier];
  const pctColor = { green: "#4ade80", amber: "#fbbf24", red: "#f87171", neutral: "#64748b" }[tier];
  const barColor = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", neutral: "#475569" }[tier];

  return (
    <button
      onClick={onClick}
      title={q.topic || `Questão ${q.numero}`}
      className={`relative flex flex-col gap-1 p-2 rounded-lg border text-left transition-all shrink-0 w-[92px] ${tierClasses} ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[13px] font-black text-white leading-none">{q.numero || "?"}</span>
        {catInfo && (
          <span
            className="text-[8px] leading-none shrink-0"
            title={catInfo.label}
          >
            {FACE_EMOJI[q.categoryKey]}
          </span>
        )}
      </div>
      {q.topic && (
        <span className="text-[8px] text-slate-500 truncate leading-tight">— {q.topic}</span>
      )}
      {pct !== null ? (
        <div className="flex flex-col gap-0.5 mt-0.5">
          <span className="text-[8px] font-black tabular-nums" style={{ color: pctColor }}>{pct}%</span>
          <div className="h-0.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
          </div>
        </div>
      ) : (
        <span className="text-[8px] text-slate-700 italic mt-0.5">sem tentativa</span>
      )}
      {isDuvida && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#111623]" />
      )}
    </button>
  );
}

function GabaritoBloco({
  block,
  user,
  resultadosMap,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
}: {
  block: NotionBlockRow;
  user: any;
  resultadosMap: Map<string, QuestaoStats>;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
}) {
  const [detalhes, setDetalhes] = useState<QuestaoDetalhesResult | null>(null);
  const [selecionada, setSelecionada] = useState<QuestaoResumo | null>(null);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const toggleExpandido = (caseLabel: string) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(caseLabel)) next.delete(caseLabel); else next.add(caseLabel);
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    setDetalhes(null);
    setSelecionada(null);
    setExpandido(new Set());
    collectQuestaoDetails(block.block_id)
      .then(res => { if (active) setDetalhes(res); })
      .catch(() => { if (active) setDetalhes({ itens: [], caseIcons: {} }); });
    return () => { active = false; };
  }, [block.block_id]);

  if (detalhes === null) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-4 px-2">
        <Loader2 size={12} className="animate-spin" /> Carregando gabarito...
      </div>
    );
  }
  if (detalhes.itens.length === 0) {
    return <p className="text-[11px] text-slate-600 italic py-4 px-2">Nenhuma questão encontrada neste caderno.</p>;
  }

  const { itens, caseIcons } = detalhes;

  // Agrupa por caso, preservando a ordem de aparição na árvore
  const grupos = new Map<string, QuestaoResumo[]>();
  for (const it of itens) {
    if (!grupos.has(it.caseLabel)) grupos.set(it.caseLabel, []);
    grupos.get(it.caseLabel)!.push(it);
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-[#0d1220] rounded-xl border border-white/[0.06]">
      <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
        <LayoutGrid size={12} className="text-indigo-400" /> Desempenho por Caso
      </h4>

      <div className="relative flex flex-col gap-2 pl-1">
        {/* Linha do tempo vertical conectando os casos */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/[0.07]" />

        {[...grupos.entries()].map(([caseLabel, qs], idx) => {
          const isOpen = expandido.has(caseLabel);
          const icon = caseIcons[caseLabel] ?? "📁";
          return (
            <div key={caseLabel} className="relative flex flex-col gap-2">
              <button
                onClick={() => toggleExpandido(caseLabel)}
                className="relative z-10 w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border border-white/[0.06] bg-[#111623] hover:border-white/[0.14] transition-all text-left"
              >
                <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">
                  {icon}
                </span>
                <span className="flex-1 text-[11px] font-bold text-slate-200 truncate">
                  {idx + 1}. {caseLabel}
                </span>
                <span className="text-[9px] text-slate-500 bg-white/[0.04] px-2 py-1 rounded-md font-bold shrink-0 tabular-nums">
                  {qs.length} questõe{qs.length !== 1 ? "s" : ""}
                </span>
                <ChevronDown size={13} className={`text-slate-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-1.5 pl-9 pb-1">
                  {qs.map(q => (
                    <QuestaoBloquinho
                      key={q.id}
                      q={q}
                      stats={resultadosMap.get(q.id)}
                      isDuvida={duvidasIds.has(q.id)}
                      isSelected={selecionada?.id === q.id}
                      onClick={() => setSelecionada(selecionada?.id === q.id ? null : q)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selecionada && (
        <div className="border border-indigo-500/20 rounded-xl bg-[#111623] p-2 mt-1">
          <QuestaoRow
            key={selecionada.id}
            questao={{
              id: selecionada.id,
              numero: selecionada.numero,
              topic: selecionada.topic,
              categoryKey: selecionada.categoryKey,
              imageUrls: [],
              respostaImageUrls: [],
            }}
            user={user}
            isDuvida={duvidasIds.has(selecionada.id)}
            onToggleDuvida={onToggleDuvida}
            onAnswered={onAnswered}
            startOpen
          />
        </div>
      )}
    </div>
  );
}

function NotionBlockRowItem({
  block,
  user,
  onDelete,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros
}: {
  block: NotionBlockRow;
  user: any;
  onDelete: (id: string) => void;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showGabarito, setShowGabarito] = useState(false);
  const [blockIcon, setBlockIcon] = useState<string>("📝");
  const [blockStats, setBlockStats] = useState<{ acertos: number; erros: number; duvidas: number; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const clean = block.block_id.replace(/-/g, "");
        const res = await fetch(`/api/notion/blocks/${clean}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.icon?.type === "emoji" && data.icon.emoji) {
            setBlockIcon(data.icon.emoji);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar ícone do Notion:", e);
      }
    })();
    return () => { active = false; };
  }, [block.block_id]);

  if (apenasComErros && blockStats !== null && blockStats.erros === 0) {
    return null;
  }

  const hasErros = blockStats !== null && blockStats.erros > 0;

  return (
    <div className="py-1">
      <div className={`flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap group px-1 rounded-xl transition-all ${
        hasErros ? "bg-rose-500/[0.02] border border-rose-500/15" : "hover:bg-white/[0.02]"
      }`}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-3 text-left py-2 px-2 rounded-lg transition-all flex-1 min-w-0"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-base shrink-0 select-none">{blockIcon}</span>
          <span className={`text-[14px] sm:text-[15px] font-medium transition-colors shrink-0 ${
            hasErros ? "text-rose-300" : "text-[#8E97A8] group-hover:text-white"
          }`}>
            {block.nome}
          </span>
          {block.materia && (
            <span className="text-[11px] font-normal text-blue-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-0.5 rounded-md shrink-0">
              {block.materia}
            </span>
          )}
          {hasErros && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/30 border border-rose-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              {blockStats.erros} {blockStats.erros === 1 ? "erro" : "erros"}
            </span>
          )}
          {block.descricao && (
            <span className="text-[12px] font-normal text-[#8E97A8] truncate hidden md:inline">— {block.descricao}</span>
          )}
        </button>

        <div className="flex items-center gap-2 shrink-0 pr-1">
          <BlocoStatsBadge 
            block={block} 
            resultadosMap={resultadosMap} 
            duvidasIds={duvidasIds}
            onStatsLoaded={setBlockStats}
          />

          <button
            onClick={() => setShowGabarito(v => !v)}
            title="Ver gabarito e navegação"
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 border ${
              showGabarito
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30"
            }`}
          >
            <LayoutGrid size={12} />
          </button>

          {user && (
            <button
              onClick={() => onDelete(block.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {showGabarito && (
        <div className="ml-1 mt-1 mb-2">
          <GabaritoBloco
            block={block}
            user={user}
            resultadosMap={resultadosMap}
            duvidasIds={duvidasIds}
            onToggleDuvida={onToggleDuvida}
            onAnswered={onAnswered}
          />
        </div>
      )}

      {open && (
        <div className="pl-6 border-l border-indigo-500/[0.15] ml-5 mt-1 mb-2">
          <BlockViewer 
            block={block} 
            user={user} 
            duvidasIds={duvidasIds}
            onToggleDuvida={onToggleDuvida}
            onAnswered={onAnswered}
            resultadosMap={resultadosMap}
          />
        </div>
      )}
    </div>
  );
}

function PainelDesempenho({
  user,
  duvidasIds,
  resultadosMap,
  onRefresh,
  blocks,
}: {
  user: any;
  duvidasIds: Set<string>;
  resultadosMap: Map<string, QuestaoStats>;
  onRefresh: () => void;
  blocks: NotionBlockRow[];
}) {
  // Múltiplos cartões podem ficar abertos ao mesmo tempo (não é mais exclusivo)
  const [openSections, setOpenSections] = useState<Set<"acertos" | "erros" | "duvidas">>(new Set());

  const blocksMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of blocks) map.set(b.block_id.replace(/-/g, ""), b.nome);
    return map;
  }, [blocks]);

  const { acertadas, erradas } = useMemo(() => {
    const a: string[] = [], e: string[] = [];
    for (const [id, stats] of resultadosMap.entries()) {
      (stats.ultimo === "acerto" ? a : e).push(id);
    }
    return { acertadas: a, erradas: e };
  }, [resultadosMap]);

  const toggleSection = (key: "acertos" | "erros" | "duvidas") => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (!user) return null;

  const duvidasArr = [...duvidasIds];

  const cards: {
    key: "acertos" | "erros" | "duvidas";
    label: string;
    ids: string[];
    color: "emerald" | "red" | "amber";
    icon: ReactNode;
  }[] = [
    { key: "acertos", label: "Acertadas", ids: acertadas, color: "emerald", icon: <Check size={13} /> },
    { key: "erros", label: "Erradas", ids: erradas, color: "red", icon: <X size={13} /> },
    { key: "duvidas", label: "Em dúvida", ids: duvidasArr, color: "amber", icon: <Flag size={13} /> },
  ];

  const colorClasses: Record<string, { border: string; text: string; iconBg: string }> = {
    emerald: { border: "border-emerald-500/20", text: "text-emerald-400", iconBg: "bg-emerald-500/10" },
    red: { border: "border-red-500/20", text: "text-red-400", iconBg: "bg-red-500/10" },
    amber: { border: "border-amber-500/20", text: "text-amber-400", iconBg: "bg-amber-500/10" },
  };

  return (
    <div className="flex flex-col gap-3 border border-white/[0.06] rounded-2xl bg-[#111623] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Desempenho</p>
        <button onClick={onRefresh} className="text-slate-600 hover:text-blue-400 transition-all">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {cards.map(card => {
          const c = colorClasses[card.color];
          const isOpen = openSections.has(card.key);
          return (
            <div key={card.key} className={`rounded-xl border ${c.border} bg-[#0d1220] overflow-hidden`}>
              <button
                onClick={() => toggleSection(card.key)}
                className="w-full flex items-center justify-between px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-300">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${c.iconBg} ${c.text}`}>{card.icon}</span>
                  {card.label}
                </span>
                <span className={`text-sm font-black tabular-nums ${c.text}`}>{card.ids.length}</span>
              </button>
              {isOpen && (
                <div className="border-t border-white/[0.06] max-h-52 overflow-y-auto custom-scrollbar px-1 py-1">
                  {card.ids.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic px-2 py-2">Nenhuma questão aqui ainda.</p>
                  ) : (
                    card.ids.map(id => <QuestaoTitleLabel key={id} questaoId={id} blocksMap={blocksMap} />)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NotionQuestionTab({ user }: { user: any }) {
  const [blocks, setBlocks] = useState<NotionBlockRow[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [duvidasIds, setDuvidasIds] = useState<Set<string>>(new Set());
  const [resultadosMap, setResultadosMap] = useState<Map<string, QuestaoStats>>(new Map());
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const handleAnswered = useCallback(() => setStatsRefreshTrigger(v => v + 1), []);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState(""); const [formNome, setFormNome] = useState(""); const [formDesc, setFormDesc] = useState(""); const [formMateria, setFormMateria] = useState("");
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [apenasComErros, setApenasComErros] = useState(false);
  const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");

  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const { data, error } = await supabase.from("notion_blocks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setBlocks(data ?? []);
    } catch (e: any) { console.error(e.message); }
    finally { setLoadingBlocks(false); }
  }, []);

  const fetchDuvidas = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("notion_duvidas")
        .select("questao_id")
        .eq("user_id", user.id);
      
      if (error) throw error;
      setDuvidasIds(new Set((data ?? []).map((item: any) => item.questao_id)));
    } catch (e) {
      console.error("Erro ao buscar duvidas do Notion:", e);
    }
  }, [user?.id]);

  // Resultados (acerto/erro mais recente por questão) — buscado uma única vez aqui
  // e compartilhado entre o Painel de Desempenho e o resumo por caderno.
  const fetchResultados = useCallback(async () => {
    if (!user?.id) { setResultadosMap(new Map()); return; }
    try {
      const { data, error } = await supabase
        .from("notion_respostas")
        .select("questao_id, correto, data, horario")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .order("horario", { ascending: false });
      if (error) throw error;

      // Agrega TODAS as tentativas de cada questão: total, corretas e o resultado
      // mais recente (o primeiro que aparece, já que a busca vem ordenada desc).
      const stats = new Map<string, QuestaoStats>();
      for (const row of data ?? []) {
        const isCorrect = row.correto === "Sim";
        const existing = stats.get(row.questao_id);
        if (!existing) {
          stats.set(row.questao_id, { total: 1, corretas: isCorrect ? 1 : 0, ultimo: isCorrect ? "acerto" : "erro" });
        } else {
          existing.total += 1;
          if (isCorrect) existing.corretas += 1;
        }
      }
      setResultadosMap(stats);
    } catch (e) {
      console.error("Erro ao buscar resultados do Notion:", e);
    }
  }, [user?.id]);

  // Verifica se o e-mail do usuário logado está liberado para criar blocos
  const fetchIsAdmin = useCallback(async () => {
    if (!user?.email) { setIsAdmin(false); return; }
    try {
      const { data, error } = await supabase
        .from("notion_blocks_admins")
        .select("email")
        .ilike("email", user.email)
        .maybeSingle();
      if (error) throw error;
      setIsAdmin(!!data);
    } catch (e) {
      console.error("Erro ao verificar permissão de admin:", e);
      setIsAdmin(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  useEffect(() => {
    fetchIsAdmin();
  }, [fetchIsAdmin]);

  useEffect(() => {
    if (user?.id) {
      fetchDuvidas();
      fetchResultados();
    } else {
      setDuvidasIds(new Set());
      setResultadosMap(new Map());
    }
  }, [user?.id, fetchDuvidas, fetchResultados, statsRefreshTrigger]);

  const handleToggleDuvida = async (questaoId: string, marcar: boolean) => {
    if (!user) return;
    try {
      if (marcar) {
        const { error } = await supabase.from("notion_duvidas").insert({
          questao_id: questaoId,
          user_id: user.id
        });
        if (error) throw error;
        setDuvidasIds(prev => {
          const next = new Set(prev);
          next.add(questaoId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from("notion_duvidas")
          .delete()
          .eq("questao_id", questaoId)
          .eq("user_id", user.id);
        if (error) throw error;
        setDuvidasIds(prev => {
          const next = new Set(prev);
          next.delete(questaoId);
          return next;
        });
      }
    } catch (e) {
      console.error("Erro ao alterar estado de dúvida:", e);
      alert("Erro ao salvar dúvida no banco.");
    }
  };

  const handleSave = async () => {
    if (!isAdmin) { setSaveErr("Seu e-mail não tem permissão para cadastrar blocos."); return; }
    if (!formId.trim() || !formNome.trim()) { setSaveErr("Preencha o ID e o nome."); return; }
    setSaving(true); setSaveErr("");
    try {
      const raw = formId.trim().replace(/-/g, "");
      const notionId = raw.length === 32
        ? `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
        : formId.trim();
      const { error } = await supabase.from("notion_blocks").insert({
        block_id: notionId,
        nome: formNome.trim(),
        descricao: formDesc.trim() || null,
        materia: formMateria.trim() || null,
      });
      if (error) throw error;
      setFormId(""); setFormNome(""); setFormDesc(""); setFormMateria(""); setShowForm(false);
      await fetchBlocks();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover?")) return;
    await supabase.from("notion_blocks").delete().eq("id", id);
    await fetchBlocks();
  };

  // Lista de matérias já cadastradas (usada no autocomplete do form e no filtro da lista)
  const materiasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      if (b.materia?.trim()) set.add(b.materia.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [blocks]);

  const blocksFiltrados = useMemo(() => {
    if (materiaFiltro === "Todas") return blocks;
    if (materiaFiltro === "Sem matéria") return blocks.filter(b => !b.materia?.trim());
    return blocks.filter(b => b.materia?.trim() === materiaFiltro);
  }, [blocks, materiaFiltro]);

  return (
    <div className="flex flex-col gap-6 bg-[#0b0f19]/80 rounded-[2rem] border border-white/[0.04] p-5 sm:p-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <BookMarked size={16} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white leading-none">Notion Question</h2>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Questões agrupadas por emoji</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchBlocks} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all">
            <RefreshCw size={13} className={loadingBlocks ? "animate-spin" : ""} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-600/10">
              <Plus size={12} /> Novo Bloco
            </button>
          )}
        </div>
      </div>

      <PainelDesempenho user={user} duvidasIds={duvidasIds} resultadosMap={resultadosMap} onRefresh={fetchResultados} blocks={blocks} />

      {showForm && (
        <div className="border border-indigo-500/20 rounded-2xl bg-[#111623] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">Cadastrar Bloco Notion</p>
            <button onClick={() => setShowForm(false)} className="text-slate-600 hover:text-slate-400"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID do Bloco *</label>
              <input value={formId} onChange={e => setFormId(e.target.value)} placeholder="abc12345-..." className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
              <input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Caderno Azul" className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matéria</label>
              <input
                value={formMateria}
                onChange={e => setFormMateria(e.target.value)}
                placeholder="Ex: Matemática Financeira"
                list="materias-cadastradas"
                className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all"
              />
              <datalist id="materias-cadastradas">
                {materiasDisponiveis.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição (opcional)</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: BB 2024 — Edital completo" className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all" />
            </div>
          </div>
          {saveErr && <p className="text-[11px] text-red-400 font-bold">{saveErr}</p>}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:text-slate-300 transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Salvar
            </button>
          </div>
        </div>
      )}

      {!loadingBlocks && blocks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {["Todas", ...materiasDisponiveis, "Sem matéria"].map(m => (
              <button
                key={m}
                onClick={() => setMateriaFiltro(m)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                  materiaFiltro === m
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-[#111623] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => setApenasComErros(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-medium tracking-wide border transition-all inline-flex items-center gap-2 ${
              apenasComErros
                ? "bg-rose-950/40 border-rose-500/30 text-rose-300 shadow-sm"
                : "bg-[#111623] border-white/[0.07] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${apenasComErros ? "bg-rose-400" : "bg-slate-500"}`} />
            Apenas com Erros
          </button>
        </div>
      )}

      {loadingBlocks ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-[#111623] border border-white/[0.06] rounded-2xl">
          <BookMarked size={32} className="text-slate-800" />
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum bloco cadastrado</p>
          <p className="text-[11px] text-slate-700 max-w-xs">Clique em "Novo Bloco" para cadastrar o ID de um bloco do Notion.</p>
        </div>
      ) : blocksFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center bg-[#111623] border border-white/[0.06] rounded-2xl">
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum caderno em "{materiaFiltro}"</p>
          <button onClick={() => setMateriaFiltro("Todas")} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">Limpar filtro</button>
        </div>
      ) : (
        <div className="flex flex-col bg-[#111623] border border-white/[0.06] rounded-2xl p-2 divide-y divide-white/[0.05]">
          {blocksFiltrados.map(block => (
            <NotionBlockRowItem
              key={block.id}
              block={block}
              user={user}
              onDelete={handleDelete}
              duvidasIds={duvidasIds}
              onToggleDuvida={handleToggleDuvida}
              onAnswered={handleAnswered}
              resultadosMap={resultadosMap}
              apenasComErros={apenasComErros}
            />
          ))}
        </div>
      )}
    </div>
  );
}
