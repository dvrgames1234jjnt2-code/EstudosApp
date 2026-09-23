"use client";

import { useState, useEffect, useCallback, useMemo, memo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Loader2,
  BookMarked, RefreshCw, X, Check, Play, Eye, EyeOff,
  Triangle, Flag, History, LayoutGrid, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Moon, Sun,
  Clock, HelpCircle, Filter, Flame, Calendar, BarChart3, Target, AlertTriangle,
  GripVertical, ArrowUp, ArrowDown, MoreVertical
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const CATEGORIES = [
  { key: "bonus",     label: "Bônus",     emojis: ["🎉","🥳","🎊"],        icon: "🎉",  color: "#d97706", textColor: "#c69238", dot: false },
  { key: "faceis",    label: "Fáceis",    emojis: ["🟢","✅","💚","🍀"],   icon: null,  color: "#16a34a", textColor: "#479e78", dot: true  },
  { key: "atencao",   label: "Atenção",   emojis: ["🔵","💙","🌀","🫐"],   icon: null,  color: "#2563eb", textColor: "#4a88b5", dot: true  },
  { key: "lacuna",    label: "Lacuna",    emojis: ["🌱","🌿","🪴"],         icon: "🌱",  color: "#65a30d", textColor: "#6b9e44", dot: false },
  { key: "media",     label: "Média",     emojis: ["🟡","💛","⭐","🌟","🟠","🧡"],   icon: null,  color: "#ea580c", textColor: "#c69238", dot: true  },
  { key: "dificil",   label: "Difícil",   emojis: ["🔴","❤️","💔","🔥"],   icon: null,  color: "#dc2626", textColor: "#c45454", dot: true  },
  { key: "ultrahard", label: "Ultrahard", emojis: ["🟣","💜","👾","🫀"],   icon: null,  color: "#9333ea", textColor: "#8e66ab", dot: true  },
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
  id: string; block_id: string; nome: string; descricao?: string; materia?: string; created_at: string; ordem?: number;
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
interface QuestaoStats { total: number; corretas: number; totalErros: number; ultimo: "acerto" | "erro"; ultimaData?: string }

function richText(rt: RichText[] = []) { return rt.map(r => r.plain_text).join(""); }
function formatDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function imgUrl(b: NotionAPIBlock) {
  const img = b.image;
  if (!img) return undefined;
  const rawUrl = img.type === "external" ? img.external?.url : img.file?.url;
  return rawUrl && rawUrl.trim() !== "" ? rawUrl.trim() : undefined;
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

const fullQuestaoInFlight = new Map<string, Promise<{ children: NotionAPIBlock[]; imgs: string[]; rImgs: string[]; textResp?: string; foundToggleId: string | null }>>();

async function fetchQuestaoFullData(blockId: string) {
  const clean = blockId.replace(/-/g, "");
  if (fullQuestaoInFlight.has(clean)) {
    return fullQuestaoInFlight.get(clean)!;
  }

  const promise = (async () => {
    const children = await fetchChildren(clean);
    const imgs: string[] = [];
    const rImgs: string[] = [];
    let textResp: string | undefined;
    let foundToggleId: string | null = null;

    for (const child of children) {
      if (child.type === "image") {
        const url = imgUrl(child);
        if (url) imgs.push(url);
      } else if (child.type === "toggle") {
        const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
        if (tText.includes("resposta")) {
          foundToggleId = child.id;
        }
      }
    }

    const togglePromises = children
      .filter(child => {
        if (child.type !== "toggle" || !child.has_children) return false;
        const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
        return tText.includes("resposta");
      })
      .map(async child => {
        const rChildren = await fetchChildren(child.id);
        const childImgs: string[] = [];
        const texts: string[] = [];
        for (const rc of rChildren) {
          if (rc.type === "image") {
            const url = imgUrl(rc);
            if (url) childImgs.push(url);
          } else {
            const icon = rc.callout?.icon?.type === "emoji" ? `${rc.callout.icon.emoji} ` : "";
            const t = richText(
              rc.paragraph?.rich_text ??
              rc.bulleted_list_item?.rich_text ??
              rc.numbered_list_item?.rich_text ??
              rc.callout?.rich_text ??
              rc.quote?.rich_text ??
              rc.heading_1?.rich_text ??
              rc.heading_2?.rich_text ??
              rc.heading_3?.rich_text ??
              []
            );
            if (t) texts.push(icon + t);
          }
        }
        return { imgs: childImgs, text: texts.join("\n") || undefined };
      });

    const toggleResults = await Promise.all(togglePromises);
    for (const res of toggleResults) {
      rImgs.push(...res.imgs);
      if (res.text && !textResp) textResp = res.text;
    }

    fullQuestaoInFlight.delete(clean);
    return { children, imgs, rImgs, textResp, foundToggleId };
  })().catch(err => {
    fullQuestaoInFlight.delete(clean);
    throw err;
  });

  fullQuestaoInFlight.set(clean, promise);
  return promise;
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
    const promises: Promise<void>[] = [];
    for (const child of children) {
      if (child.type !== "toggle") continue;
      const rawTitle = richText(child.toggle?.rich_text ?? []);
      const { emojis: textEmojis } = parseQuestaoTitle(rawTitle);
      const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
      const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
      if (categoryKey) {
        ids.push(child.id);
      } else if (child.has_children) {
        promises.push(walk(child.id));
      }
    }
    if (promises.length > 0) await Promise.all(promises);
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
    const promises: Promise<void>[] = [];
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
        if (child.has_children) promises.push(walk(child.id, label));
      }
    }
    if (promises.length > 0) await Promise.all(promises);
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

function ImagemLightbox({
  url,
  loading = false,
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
  questaoNumero,
  questaoTopic,
  caseLabel,
  respostaText,
  respostaImageUrls,
  user,
  questaoId,
  isDuvida = false,
  onToggleDuvida,
  onAnswered,
}: {
  url: string;
  loading?: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  questaoNumero?: string;
  questaoTopic?: string;
  caseLabel?: string;
  respostaText?: string;
  respostaImageUrls?: string[];
  user?: any;
  questaoId?: string;
  isDuvida?: boolean;
  onToggleDuvida?: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered?: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [isFullWidth, setIsFullWidth] = useState(false); // Default to Modo Ajustado!
  const [showResposta, setShowResposta] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<'acerto' | 'erro' | null>(null);
  const [recordingDuvida, setRecordingDuvida] = useState(false);
  const [localDuvida, setLocalDuvida] = useState(isDuvida);

  const [antiBrilho, setAntiBrilho] = useState<'suave' | 'noturno'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notion_anti_brilho');
      if (saved === 'noturno') return 'noturno';
    }
    return 'suave';
  });

  const toggleAntiBrilho = () => {
    setAntiBrilho(prev => {
      const next = prev === 'suave' ? 'noturno' : 'suave';
      if (typeof window !== 'undefined') {
        localStorage.setItem('notion_anti_brilho', next);
      }
      return next;
    });
  };

  useEffect(() => {
    setLocalDuvida(isDuvida);
  }, [isDuvida, questaoId]);

  // Fecha o painel de resposta ao navegar para outra questão
  useEffect(() => {
    setShowResposta(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [questaoId]);

  const handleRecordAnswer = async (isCorrect: boolean) => {
    if (!questaoId) return;
    setRecording(true);
    setRecorded(null);

    let currentUser = user;
    if (!currentUser) {
      try {
        const { data } = await supabase.auth.getUser();
        currentUser = data?.user;
      } catch (e) {}
    }

    if (!currentUser) {
      alert("Por favor, faça login para registrar sua resposta.");
      setRecording(false);
      return;
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8);

    try {
      const { error } = await supabase.from("notion_respostas").insert({
        questao_id: questaoId,
        resposta_usuario: isCorrect ? "Acerto" : "Erro",
        correto: isCorrect ? "Sim" : "Não",
        data: date,
        horario: time,
        status: isCorrect ? "Acertei" : "Errei",
        user_id: currentUser.id,
      });
      if (error) throw error;
      setRecorded(isCorrect ? 'acerto' : 'erro');
      setTimeout(() => setRecorded(null), 3000);
      onAnswered?.();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar resposta: " + e.message);
    } finally {
      setRecording(false);
    }
  };

  const handleToggleDuvidaLocal = async () => {
    if (!user || !questaoId || !onToggleDuvida) return;
    setRecordingDuvida(true);
    try {
      await onToggleDuvida(questaoId, !localDuvida);
      setLocalDuvida(prev => !prev);
    } finally {
      setRecordingDuvida(false);
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); setIsFullWidth(false); };

  const toggleFullWidth = () => {
    setIsFullWidth(prev => !prev);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleReset();
      if (e.key.toLowerCase() === "f") toggleFullWidth();
      if (e.key.toLowerCase() === "r") setShowResposta(prev => !prev);
      if (e.key.toLowerCase() === "b") toggleAntiBrilho();
      if ((e.key === "ArrowRight" || e.key === "PageDown") && hasNext && onNext) {
        onNext();
      }
      if ((e.key === "ArrowLeft" || e.key === "PageUp") && hasPrev && onPrev) {
        onPrev();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onNext, onPrev, hasNext, hasPrev, antiBrilho]);

  const getImageFilterStyle = () => {
    if (antiBrilho === 'noturno') {
      return {
        filter: 'invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(1.15)',
      };
    }
    return {
      filter: 'brightness(0.83) contrast(1.1) saturate(0.9)',
    };
  };

  const getImageCardBgClass = () => {
    if (antiBrilho === 'noturno') {
      return 'bg-[#0b101d] border border-white/10 shadow-2xl';
    }
    return 'bg-slate-900/90 border border-slate-700/60 shadow-2xl opacity-95';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setScale(prev => Math.min(prev + 0.15, 4));
    } else {
      setScale(prev => Math.max(prev - 0.15, 0.5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1 || isFullWidth) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-3xl flex flex-col items-center justify-between select-none animate-in fade-in duration-200"
      style={{
        backdropFilter: "blur(30px) brightness(0.7)",
        WebkitBackdropFilter: "blur(30px) brightness(0.7)",
        backgroundColor: "rgba(5, 8, 15, 0.85)",
      }}
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
    >
      {/* Top Bar Controls */}
      <div className="w-full px-2 sm:px-4 py-2 flex items-center gap-2 bg-black/70 backdrop-blur-md border-b border-white/10 z-30 overflow-hidden" style={{ minHeight: 44 }}>
        {/* Left Info — shrink aggressively */}
        <div className="flex items-center gap-1.5 text-white font-bold text-xs shrink min-w-0 overflow-hidden">
          <Maximize2 size={14} className="text-indigo-400 shrink-0" />
          <span className="truncate max-w-[120px] sm:max-w-xs">
            {questaoNumero ? `Q${questaoNumero}` : "Imagem"}
            {questaoTopic ? ` — ${questaoTopic}` : ""}
          </span>
          {caseLabel && (
            <span className="hidden md:inline-block px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-normal shrink-0 truncate max-w-[100px]">
              {caseLabel}
            </span>
          )}
        </div>

        {/* Toolbar Center — scrollable horizontally, no wrap */}
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/10 shrink-0 overflow-x-auto max-w-[55vw] sm:max-w-none" style={{ scrollbarWidth: 'none' }}>
          {hasPrev && onPrev && (
            <button
              onClick={onPrev}
              title="Questão Anterior (←)"
              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all text-xs font-bold flex items-center gap-1 active:scale-95 shrink-0"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          <button
            onClick={handleZoomOut}
            title="Diminuir zoom (-)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-all shrink-0"
          >
            <ZoomOut size={14} />
          </button>

          <span className="text-[11px] font-mono font-bold text-slate-200 px-1 min-w-[36px] text-center shrink-0">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            title="Aumentar zoom (+)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-all shrink-0"
          >
            <ZoomIn size={14} />
          </button>

          <div className="w-px h-5 bg-white/20 my-auto mx-0.5 shrink-0" />

          {/* Modo Ajustado / 100% Tela Cheia */}
          <button
            onClick={toggleFullWidth}
            title="Alternar Modo de Visualização (Tecla F)"
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 ${
              !isFullWidth
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40"
                : "hover:bg-white/20 text-slate-200"
            }`}
          >
            {!isFullWidth ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span className="hidden sm:inline">{!isFullWidth ? "Ajustado" : "Tela Cheia"}</span>
          </button>

          {/* Anti-Brilho / Filtro Noturno */}
          <button
            onClick={toggleAntiBrilho}
            title="Alternar Filtro Anti-Brilho / Modo Noturno (Tecla B)"
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 border shrink-0 ${
              antiBrilho === 'noturno'
                ? "bg-indigo-500/25 text-indigo-300 border-indigo-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {antiBrilho === 'noturno' ? (
              <Moon size={12} className="text-indigo-400" />
            ) : (
              <Sun size={12} className="text-amber-400" />
            )}
            <span className="hidden sm:inline">{antiBrilho === 'noturno' ? "Noturno" : "Anti-Brilho"}</span>
          </button>

          <button
            onClick={handleReset}
            title="Resetar Zoom (0)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-slate-400 hover:text-white transition-all shrink-0"
          >
            <RotateCcw size={12} />
          </button>

          {hasNext && onNext && (
            <button
              onClick={onNext}
              title="Próxima Questão (→)"
              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all text-xs font-bold flex items-center gap-1 active:scale-95 shrink-0"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Action Right: Revelar Resposta & Close — always pinned right, never hidden */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            onClick={() => setShowResposta(v => !v)}
            title="Revelar ou Ocultar Resposta (Tecla R)"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 border shrink-0 ${
              showResposta
                ? "bg-slate-800 text-emerald-400 border-slate-700"
                : "bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border-slate-700"
            }`}
          >
            {showResposta ? <EyeOff size={14} className="text-emerald-400" /> : <Eye size={14} className="text-slate-400" />}
            <span className="hidden sm:inline">{showResposta ? "Ocultar" : "✨ Revelar Resposta"}</span>
            <span className="sm:hidden">{showResposta ? <EyeOff size={14} /> : <Eye size={14} />}</span>
          </button>

          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 transition-all active:scale-95 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>


      {/* Main Image View & Side-by-Side Split Screen Answer Panel Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-row items-center justify-between min-h-0">
        {/* Left Question Image Container (Fixed 50% when showResposta is true) */}
        <div
          className={`relative h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-2 sm:p-4 min-w-0 transition-all ${
            showResposta ? "w-1/2 flex-1 border-r border-white/10" : "w-full flex-1"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Floating Side Arrows for Next/Prev (Absolute to Question Container) */}
          {hasPrev && onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              title="Questão Anterior (←)"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700 shadow-xl backdrop-blur-md transition-all active:scale-90 group"
            >
              <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {hasNext && onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              title="Próxima Questão (→)"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700 shadow-xl backdrop-blur-md transition-all active:scale-90 group"
            >
              <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-md">
              <Loader2 size={36} className="animate-spin text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300 animate-pulse">Carregando imagem da questão...</span>
            </div>
          ) : url && url.trim() !== "" ? (
            <img
              src={url.trim()}
              alt="Imagem da questão"
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? "none" : "transform 0.15s ease-out",
                ...getImageFilterStyle(),
              }}
              className={`${getImageCardBgClass()} rounded-xl object-contain transition-all ${
                showResposta
                  ? "max-w-[95%] max-h-[82vh]"
                  : isFullWidth
                  ? "w-full h-full max-w-none max-h-none"
                  : "max-w-[95vw] max-h-[85vh]"
              }`}
            />
          ) : (
            <div className="text-slate-400 italic text-xs bg-slate-900/80 px-4 py-3 rounded-xl border border-white/10">
              Sem imagem registrada para esta questão
            </div>
          )}
        </div>

        {/* Right Side Answer Screen Panel (Fixed 50% Width, Scrollable Content) */}
        {showResposta && (
          <div className="w-1/2 flex-1 h-full bg-[#0b101d] backdrop-blur-2xl p-4 sm:p-6 shadow-2xl z-40 text-white flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 min-w-0 border-l border-white/10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <span className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2">
                <span>✨</span> Resposta e Gabarito {questaoNumero ? `— Questão ${questaoNumero}` : ""}
              </span>
              <button
                onClick={() => setShowResposta(false)}
                className="text-slate-400 hover:text-white text-xs p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Respostas com Imagem */}
            {respostaImageUrls && respostaImageUrls.filter(u => u && u.trim() !== "").length > 0 && (
              <div className="flex flex-col gap-4">
                {respostaImageUrls.filter(u => u && u.trim() !== "").map((rUrl, i) => (
                  <img
                    key={i}
                    src={rUrl.trim()}
                    alt={`Resposta ${i + 1}`}
                    style={getImageFilterStyle()}
                    className={`w-full rounded-xl border border-white/10 object-contain shadow-md max-h-[55vh] ${
                      antiBrilho === 'noturno' ? 'bg-[#0b101d]' : 'bg-slate-900/90'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Resposta em Texto / Explicação */}
            {respostaText ? (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-sm sm:text-base font-normal text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {respostaText}
                </p>
              </div>
            ) : (!respostaImageUrls || respostaImageUrls.length === 0) ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                <p className="text-xs text-slate-400 italic">Nenhuma resposta registrada no Notion.</p>
              </div>
            ) : null}

            {/* Registro de Tentativas do Usuário no Rodapé do Painel */}
            {questaoId && (
              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/10 flex-wrap shrink-0">
                <span className="text-xs text-slate-300 font-semibold mr-auto">Registrar tentativa:</span>
                
                {onToggleDuvida && (
                  <button
                    onClick={handleToggleDuvidaLocal}
                    disabled={recordingDuvida}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 active:scale-95 border ${
                      localDuvida 
                        ? 'bg-slate-800 text-amber-300 border-slate-700' 
                        : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    <Flag size={12} className={localDuvida ? "fill-amber-400 text-amber-400" : "text-slate-400"} /> Em dúvida
                  </button>
                )}

                <button
                  onClick={() => handleRecordAnswer(true)}
                  disabled={recording}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-emerald-400 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
                >
                  <Check size={14} className="text-emerald-400" /> Acertei
                </button>
                <button
                  onClick={() => handleRecordAnswer(false)}
                  disabled={recording}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-rose-400 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
                >
                  <X size={14} className="text-rose-400" /> Errei
                </button>

                {recorded && (
                  <span className={`text-xs font-bold ml-1 animate-pulse ${recorded === 'acerto' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {recorded === 'acerto' ? 'Salvo! 🎉' : 'Salvo! ❌'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="w-full px-4 py-2 bg-black/85 backdrop-blur-md text-[11px] text-slate-400 font-medium z-20 flex items-center justify-center gap-3 sm:gap-6 text-center flex-wrap">
        <span>💡 Dica: <span className="text-indigo-300 font-bold">Modo Ajustado</span> ativo por padrão</span>
        <span>• <kbd className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono">B</kbd> Anti-Brilho</span>
        <span>• <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-slate-200">←</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-slate-200">→</kbd> Pular Questão</span>
        <span>• Aperte <kbd className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono">R</kbd> para Revelar Resposta</span>
      </div>
    </div>,
    document.body
  );
}

function ZoomedQuestaoWrapper({
  questao,
  user,
  isDuvida,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  initialUrl,
  initialRespostaText,
  initialRespostaImageUrls,
}: {
  questao: Questao;
  user?: any;
  isDuvida?: boolean;
  duvidasIds?: Set<string>;
  onToggleDuvida?: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered?: () => void;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  initialUrl?: string;
  initialRespostaText?: string;
  initialRespostaImageUrls?: string[];
}) {
  const initialImgs = (questao.imageUrls && questao.imageUrls.length > 0)
    ? questao.imageUrls
    : initialUrl ? [initialUrl] : [];

  const [imageUrls, setImageUrls] = useState<string[]>(initialImgs);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>(
    (questao.respostaImageUrls && questao.respostaImageUrls.length > 0)
      ? questao.respostaImageUrls
      : initialRespostaImageUrls ?? []
  );
  const [respostaText, setRespostaText] = useState<string | undefined>(questao.resposta || initialRespostaText);
  const [loading, setLoading] = useState<boolean>(initialImgs.length === 0);

  useEffect(() => {
    let active = true;
    const currentImgs = (questao.imageUrls && questao.imageUrls.length > 0)
      ? questao.imageUrls
      : initialUrl ? [initialUrl] : [];
    
    setImageUrls(currentImgs);
    setRespostaImageUrls(
      (questao.respostaImageUrls && questao.respostaImageUrls.length > 0)
        ? questao.respostaImageUrls
        : initialRespostaImageUrls ?? []
    );
    setRespostaText(questao.resposta || initialRespostaText);
    setLoading(currentImgs.length === 0);

    fetchQuestaoFullData(questao.id).then(result => {
      if (!active) return;
      if (result.imgs.length > 0) setImageUrls(result.imgs);
      if (result.rImgs.length > 0) setRespostaImageUrls(result.rImgs);
      if (result.textResp) setRespostaText(result.textResp);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [questao.id, initialUrl]);


  const mainUrl = imageUrls[0] || initialUrl || "";

  return (
    <ImagemLightbox
      url={mainUrl}
      loading={loading}
      onClose={onClose}
      onNext={onNext}
      onPrev={onPrev}
      hasNext={hasNext}
      hasPrev={hasPrev}
      questaoNumero={questao.numero}
      questaoTopic={questao.topic}
      caseLabel={questao.caseLabel}
      respostaText={respostaText}
      respostaImageUrls={respostaImageUrls}
      user={user}
      questaoId={questao.id}
      isDuvida={isDuvida ?? duvidasIds?.has(questao.id)}
      onToggleDuvida={onToggleDuvida}
      onAnswered={onAnswered}
    />
  );
}

const QuestaoRow = memo(function QuestaoRow({ 
  questao, 
  user,
  isDuvida,
  onToggleDuvida,
  onAnswered,
  stats,
  apenasComErros,
  statusFiltro = "todas",
  feitasHojeIds = [],
  startOpen = false,
  isAdmin = false,
  onMoveUp,
  onMoveDown,
  onDropQuestao,
  isFirst = false,
  isLast = false,
  onNextQuestion,
  onPrevQuestion,
  hasNextQuestion,
  hasPrevQuestion,
}: { 
  questao: Questao; 
  user: any;
  isDuvida: boolean;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  stats?: QuestaoStats;
  apenasComErros?: boolean;
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros";
  feitasHojeIds?: string[];
  startOpen?: boolean;
  isAdmin?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDropQuestao?: (draggedId: string, targetId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  onNextQuestion?: () => void;
  onPrevQuestion?: () => void;
  hasNextQuestion?: boolean;
  hasPrevQuestion?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [showResp, setShowResp] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>([]);
  const [respostaText, setRespostaText] = useState<string | undefined>();
  const [respostaToggleId, setRespostaToggleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<'acerto' | 'erro' | null>(null);
  const [recordingDuvida, setRecordingDuvida] = useState(false);

  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState<{ data: string; horario: string; correto: string }[] | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Admin edit panel states
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminText, setAdminText] = useState('');
  const [adminImageUrl, setAdminImageUrl] = useState('');
  const [adminGabarito, setAdminGabarito] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);

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

  const handleAdminSave = async () => {
    if (!adminGabarito && !adminText.trim() && !adminImageUrl.trim()) {
      alert("Preencha ao menos um campo (Gabarito, Texto ou Imagem) para salvar no Notion.");
      return;
    }

    setAdminSaving(true);
    setAdminSaved(false);

    try {
      const newBlocks: any[] = [];

      if (adminGabarito) {
        newBlocks.push({
          object: "block",
          type: "callout",
          callout: {
            rich_text: [
              {
                type: "text",
                text: { content: `Gabarito: ${adminGabarito}` },
                annotations: { bold: true }
              }
            ],
            icon: { type: "emoji", emoji: "✅" }
          }
        });
      }

      if (adminText.trim()) {
        newBlocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: adminText.trim() }
              }
            ]
          }
        });
      }

      if (adminImageUrl.trim()) {
        newBlocks.push({
          object: "block",
          type: "image",
          image: {
            type: "external",
            external: { url: adminImageUrl.trim() }
          }
        });
      }

      const questaoClean = questao.id.replace(/-/g, "");
      const targetToggleId = respostaToggleId ? respostaToggleId.replace(/-/g, "") : null;

      if (targetToggleId) {
        const res = await fetch(`/api/notion/blocks/${targetToggleId}/children`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ children: newBlocks })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || `Notion HTTP ${res.status}`);
        }
        childrenCache.delete(targetToggleId);
      } else {
        const res = await fetch(`/api/notion/blocks/${questaoClean}/children`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            children: [
              {
                object: "block",
                type: "toggle",
                toggle: {
                  rich_text: [{ type: "text", text: { content: "Resposta 💡" } }],
                  children: newBlocks
                }
              }
            ]
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || `Notion HTTP ${res.status}`);
        }
      }

      childrenCache.delete(questaoClean);

      setAdminSaved(true);
      setAdminText("");
      setAdminImageUrl("");
      setAdminGabarito("");

      setLoaded(false);
      setShowResp(true);

      setTimeout(() => setAdminSaved(false), 4000);
    } catch (e: any) {
      console.error("Erro ao salvar resposta no Notion:", e);
      alert("Erro ao salvar no Notion: " + (e.message || e));
    } finally {
      setAdminSaving(false);
    }
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
      setLoading(true);
      fetchQuestaoFullData(questao.id).then(result => {
        if (!active) return;
        setImageUrls(result.imgs);
        setRespostaImageUrls(result.rImgs);
        setRespostaText(result.textResp);
        setRespostaToggleId(result.foundToggleId);
        setLoaded(true);
      }).catch(e => {
        console.error("Erro ao carregar detalhes da questão:", e);
      }).finally(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }
  }, [open, questao.id, loaded]);


  const isErro = stats?.ultimo === "erro";
  const isAcerto = stats?.ultimo === "acerto";
  const isRespondida = !!stats;
  const isFeitaHoje = feitasHojeIds.includes(questao.id);

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  if (effectiveStatus === "erros" && !isErro) return null;
  if (effectiveStatus === "mais_erros" && (stats?.totalErros ?? 0) === 0) return null;
  if (effectiveStatus === "nao_feitas" && isRespondida) return null;
  if (effectiveStatus === "feitas_hoje" && !isFeitaHoje) return null;

  const showHighlightStyle = (effectiveStatus === "erros" && isErro) || (effectiveStatus === "mais_erros" && (stats?.totalErros ?? 0) > 0) || (effectiveStatus === "feitas_hoje" && isFeitaHoje);

  const diffBgClasses: Record<string, string> = {
    faceis: "bg-[#0b1612]/60 hover:bg-[#0f1d18]",
    lacuna: "bg-[#0b1612]/60 hover:bg-[#0f1d18]",
    media: "bg-[#16120b]/60 hover:bg-[#1d180f]",
    atencao: "bg-[#0b1216]/60 hover:bg-[#0f181d]",
    dificil: "bg-[#160b0d]/60 hover:bg-[#1d0f11]",
    ultrahard: "bg-[#120b16]/60 hover:bg-[#180f1d]",
    bonus: "bg-[#120b16]/60 hover:bg-[#180f1d]",
  };
  const bgClass = diffBgClasses[questao.categoryKey] || "hover:bg-white/[0.03]";

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        if (!isAdmin) return;
        e.dataTransfer.setData("text/plain", questao.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (isAdmin) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setIsDraggingOver(false);
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== questao.id && onDropQuestao) {
            onDropQuestao(draggedId, questao.id);
          }
        }
      }}
      className={`flex flex-col py-0.5 rounded-lg ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div className={`flex items-center gap-2 py-1 px-2.5 transition-colors duration-150 rounded-lg group ${
        showHighlightStyle ? "bg-rose-500/[0.05]" : bgClass
      }`}>
        {isAdmin && (
          <span 
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-indigo-400 transition-colors shrink-0 select-none" 
            title="Arrastar para reordenar questão"
          >
            <GripVertical size={13} />
          </span>
        )}

        <button
          onClick={() => { setOpen(v => !v); setShowResp(false); }}
          className="text-slate-500 hover:text-slate-300 transition-colors w-4 h-4 flex items-center justify-center shrink-0"
        >
          {loading ? (
            <Loader2 size={10} className="animate-spin text-slate-500" />
          ) : (
            <ChevronRight size={12} className={`text-slate-500 transition-transform duration-150 shrink-0 ${open ? "rotate-90" : ""}`} />
          )}
        </button>

        <span className="text-[11px] font-normal text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md shrink-0 tabular-nums">
          {questao.numero}
        </span>

        <span className="w-2 h-2 rounded-full shrink-0 select-none shadow-sm" style={{ backgroundColor: catColor }} title={catLabel} />

        <span
          className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-black/20 border border-white/[0.06] shrink-0"
          style={{ color: catColor }}
        >
          {catLabel}
        </span>

        {questao.topic && (
          <span className="text-[12px] sm:text-[13px] font-normal text-slate-300 leading-relaxed truncate ml-0.5">
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

        {isAdmin && (
          <div className="flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity ml-auto mr-1">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(questao.id); }}
              disabled={isFirst}
              title="Mover questão para cima"
              className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(questao.id); }}
              disabled={isLast}
              title="Mover questão para baixo"
              className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <ArrowDown size={10} />
            </button>
          </div>
        )}

        {stats && stats.totalErros > 0 && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 shrink-0 ${!isAdmin && !isErro && !isAcerto ? "ml-auto" : ""}`} title={`${stats.totalErros} erro(s) no histórico`}>
            <span>🔥</span>
            <span>{stats.totalErros} {stats.totalErros === 1 ? "erro" : "erros"}</span>
          </span>
        )}

        {isErro && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/50 border border-rose-700/60 shrink-0 ${!isAdmin && !(stats && stats.totalErros > 0) ? "ml-auto" : ""}`}>
            <span className="w-2 h-2 rounded-full bg-rose-500 border border-rose-400/50 shrink-0 shadow-sm shadow-rose-500/50" />
            Errou
          </span>
        )}
        {isAcerto && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-700/60 shrink-0 ${!isAdmin && !(stats && stats.totalErros > 0) ? "ml-auto" : ""}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-400/50 shrink-0 shadow-sm shadow-emerald-500/50" />
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
              {imageUrls.filter(u => u && u.trim() !== "").length > 0 ? (
                imageUrls.filter(u => u && u.trim() !== "").map((url, i) => (
                  <div key={i} className="relative group max-w-2xl">
                    <img
                      src={url.trim()}
                      alt={`Q${questao.numero} img${i + 1}`}
                      onClick={() => setZoomedImage(url.trim())}
                      style={{ filter: 'brightness(0.85) contrast(1.08)' }}
                      className="w-full rounded-xl border border-slate-700/60 object-contain bg-slate-900/90 cursor-zoom-in hover:brightness-105 transition-all shadow-md"
                    />
                    <button
                      onClick={() => setZoomedImage(url.trim())}
                      className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition-all px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black/95 text-white text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/20 shadow-xl active:scale-95"
                    >
                      <Maximize2 size={12} className="text-indigo-400" />
                      Expandir 100%
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-700 italic">Sem imagem</p>
              )}

              <button
                onClick={() => setShowResp(v => !v)}
                className="flex items-center gap-2 self-start px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] text-[11px] font-medium transition-all shadow-sm active:scale-95"
              >
                {showResp ? <EyeOff size={11} /> : <Eye size={11} />}
                {showResp ? "Ocultar Resposta" : "✨ Ver Resposta"}
              </button>

              {user && (
                <button
                  onClick={toggleHistorico}
                  className="flex items-center gap-2 self-start px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] text-[10px] font-medium transition-all"
                >
                  <History size={10} />
                  {showHistorico ? "Ocultar Histórico" : "Ver Histórico de Tentativas"}
                  {historico && historico.length > 0 && (
                    <span className="text-[9px] text-slate-400 font-bold ml-0.5">({historico.length})</span>
                  )}
                </button>
              )}

              {showHistorico && (
                <div className="border border-white/[0.08] rounded-2xl p-3.5 bg-[#0d1424] flex flex-col gap-2">
                  {loadingHistorico ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-1">
                      <Loader2 size={11} className="animate-spin" /> Carregando histórico...
                    </div>
                  ) : !historico || historico.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">Nenhuma tentativa registrada ainda.</p>
                  ) : (
                    <>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {historico.length} tentativa{historico.length > 1 ? "s" : ""} registrada{historico.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {historico.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                          >
                            <span className="text-slate-400 tabular-nums">
                              {formatDataBR(h.data)} às {h.horario?.slice(0, 5)}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-bold uppercase tracking-wide text-[10px] ${
                                h.correto === "Sim" ? "text-emerald-400" : "text-rose-400"
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
                <div className="border border-white/[0.08] rounded-2xl p-4 bg-[#0d1424] flex flex-col gap-3 my-1">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] flex-wrap gap-2">
                    <span className="text-xs font-semibold text-slate-200">✨ Resposta e Gabarito</span>
                    <span className="text-[10px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5 rounded-full">
                      Questão {questao.numero || "1"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {respostaImageUrls.filter(u => u && u.trim() !== "").map((url, i) => (
                      <div key={i} className="relative group max-w-2xl">
                        <img
                          src={url.trim()}
                          alt={`Resposta img${i + 1}`}
                          onClick={() => setZoomedImage(url.trim())}
                          style={{ filter: 'brightness(0.85) contrast(1.08)' }}
                          className="w-full rounded-xl border border-slate-700/60 object-contain bg-slate-900/90 cursor-zoom-in hover:brightness-105 transition-all shadow-md"
                        />
                        <button
                          onClick={() => setZoomedImage(url)}
                          className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition-all px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black/95 text-white text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/20 shadow-xl active:scale-95"
                        >
                          <Maximize2 size={12} className="text-emerald-400" />
                          Expandir 100%
                        </button>
                      </div>
                    ))}
                    {respostaText ? (
                      <p className="text-[13px] sm:text-[14px] font-normal text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {respostaText}
                      </p>
                    ) : respostaImageUrls.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">Sem resposta escrita registrada no Notion.</p>
                    ) : null}
                  </div>

                  {user && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06] flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium mr-auto">Registrar tentativa:</span>
                      
                      <button
                        onClick={handleToggleDuvidaLocal}
                        disabled={recordingDuvida}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95 border ${
                          isDuvida 
                            ? 'bg-slate-800 text-amber-300 border-slate-700' 
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Flag size={11} className={isDuvida ? "fill-amber-400 text-amber-400" : "text-slate-400"} /> Em dúvida
                      </button>

                      <button
                        onClick={() => handleRecordAnswer(true)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-300 hover:text-emerald-400 text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95"
                      >
                        <Check size={11} className="text-emerald-400" /> Acertei
                      </button>
                      <button
                        onClick={() => handleRecordAnswer(false)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-300 hover:text-rose-400 text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95"
                      >
                        <X size={11} className="text-rose-400" /> Errei
                      </button>
                      {recorded && (
                        <span className={`text-[10px] font-medium ml-1 animate-pulse ${recorded === 'acerto' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {recorded === 'acerto' ? 'Salvo! 🎉' : 'Salvo! ❌'}
                        </span>
                      )}
                    </div>
                  )}

                    {/* Admin edit panel */}
                    {isAdmin && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20 pl-4">
                        <button
                          onClick={() => setShowAdminPanel(v => !v)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                            showAdminPanel
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          <span className="text-[12px]">🛠️</span> Editar Resposta (Admin)
                        </button>

                        {showAdminPanel && (
                          <div className="mt-2 flex flex-col gap-3 p-3 bg-amber-500/[0.04] border border-amber-500/20 rounded-xl">
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Painel Administrativo — Questão {questao.numero || questao.id.slice(0, 8)}</p>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gabarito (letra)</label>
                            <div className="flex items-center gap-1.5">
                              {['A','B','C','D','E'].map(l => (
                                <button
                                  key={l}
                                  onClick={() => setAdminGabarito(adminGabarito === l ? '' : l)}
                                  className={`w-8 h-8 rounded-lg text-[12px] font-black border transition-all active:scale-95 ${
                                    adminGabarito === l
                                      ? 'bg-amber-500/30 border-amber-400/60 text-amber-200'
                                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-amber-500/30 hover:text-amber-300'
                                  }`}
                                >
                                  {l}
                                </button>
                              ))}
                              {adminGabarito && (
                                <span className="text-[11px] text-amber-300 font-bold ml-1">✓ {adminGabarito}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Texto / Comentário</label>
                            <textarea
                              value={adminText}
                              onChange={e => setAdminText(e.target.value)}
                              placeholder="Digite a explicação ou comentário da resposta..."
                              rows={3}
                              className="w-full px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all resize-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">URL da Imagem (opcional)</label>
                            <input
                              type="url"
                              value={adminImageUrl}
                              onChange={e => setAdminImageUrl(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all font-mono"
                            />
                            {adminImageUrl?.trim() ? (
                              <img src={adminImageUrl} alt="preview" className="mt-1 max-h-32 rounded-lg border border-white/10 object-contain bg-white/5" />
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            {adminSaved && (
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider animate-pulse">✓ Salvo!</span>
                            )}
                            <button
                              onClick={handleAdminSave}
                              disabled={adminSaving}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                              {adminSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Salvar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {zoomedImage && (
        <ZoomedQuestaoWrapper
          questao={questao}
          initialUrl={zoomedImage}
          initialRespostaText={respostaText}
          initialRespostaImageUrls={respostaImageUrls}
          onClose={() => setZoomedImage(null)}
          onNext={onNextQuestion}
          onPrev={onPrevQuestion}
          hasNext={hasNextQuestion}
          hasPrev={hasPrevQuestion}
        />
      )}
    </div>
  );
});

const CasoCard = memo(function CasoCard({ 
  caso, 
  depth = 0, 
  user,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros,
  statusFiltro = "todas",
  feitasHojeIds = [],
  isAdmin = false,
  onMoveUp,
  onMoveDown,
  onDropCaso,
  isFirst = false,
  isLast = false,
}: { 
  caso: Caso; 
  depth?: number; 
  user: any;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap?: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros";
  feitasHojeIds?: string[];
  isAdmin?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDropCaso?: (draggedId: string, targetId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [subcasos, setSubcasos] = useState<Caso[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [zoomedQuestaoIndex, setZoomedQuestaoIndex] = useState<number | null>(null);

  // Pre-fetch das questões adjacentes para navegação instantânea
  useEffect(() => {
    if (zoomedQuestaoIndex === null) return;
    const neighbors = [zoomedQuestaoIndex - 1, zoomedQuestaoIndex + 1];
    for (const ni of neighbors) {
      if (ni >= 0 && ni < questoes.length) {
        fetchQuestaoFullData(questoes[ni].id).catch(() => {});
      }
    }
  }, [zoomedQuestaoIndex, questoes]);

  const handleReorderSubcasos = (newSubcasos: Caso[]) => {
    setSubcasos(newSubcasos);
    try {
      const idOrder = newSubcasos.map(s => s.id);
      localStorage.setItem(`notion_subcasos_order_${caso.id}`, JSON.stringify(idOrder));
    } catch (e) {}
  };

  const handleMoveSubcaso = (subId: string, direction: "up" | "down") => {
    setSubcasos(prev => {
      const idx = prev.findIndex(s => s.id === subId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);
      handleReorderSubcasos(copy);
      return copy;
    });
  };

  const handleDropSubcaso = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setSubcasos(prev => {
      const dragIdx = prev.findIndex(s => s.id === draggedId);
      const targetIdx = prev.findIndex(s => s.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(targetIdx, 0, moved);
      handleReorderSubcasos(copy);
      return copy;
    });
  };

  const handleReorderQuestoes = (newQuestoes: Questao[]) => {
    setQuestoes(newQuestoes);
    try {
      const idOrder = newQuestoes.map(q => q.id);
      localStorage.setItem(`notion_questoes_order_${caso.id}`, JSON.stringify(idOrder));
    } catch (e) {}
  };

  const handleMoveQuestao = (qId: string, direction: "up" | "down") => {
    setQuestoes(prev => {
      const idx = prev.findIndex(q => q.id === qId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);
      handleReorderQuestoes(copy);
      return copy;
    });
  };

  const handleDropQuestao = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setQuestoes(prev => {
      const dragIdx = prev.findIndex(q => q.id === draggedId);
      const targetIdx = prev.findIndex(q => q.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(targetIdx, 0, moved);
      handleReorderQuestoes(copy);
      return copy;
    });
  };

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
            // Ordenar subcasos se houver ordem salva
            try {
              const savedSub = localStorage.getItem(`notion_subcasos_order_${caso.id}`);
              if (savedSub) {
                const orderIds: string[] = JSON.parse(savedSub);
                const map = new Map<string, number>();
                orderIds.forEach((id, i) => map.set(id, i));
                tempSubcasos.sort((a, b) => {
                  const idxA = map.has(a.id) ? map.get(a.id)! : 999;
                  const idxB = map.has(b.id) ? map.get(b.id)! : 999;
                  return idxA - idxB;
                });
              }
            } catch (e) {}

            // Ordenar questões se houver ordem salva
            try {
              const savedQ = localStorage.getItem(`notion_questoes_order_${caso.id}`);
              if (savedQ) {
                const orderIds: string[] = JSON.parse(savedQ);
                const map = new Map<string, number>();
                orderIds.forEach((id, i) => map.set(id, i));
                tempQuestoes.sort((a, b) => {
                  const idxA = map.has(a.id) ? map.get(a.id)! : 999;
                  const idxB = map.has(b.id) ? map.get(b.id)! : 999;
                  if (idxA !== 999 || idxB !== 999) return idxA - idxB;
                  const valA = CATEGORY_ORDER[a.categoryKey] ?? 99;
                  const valB = CATEGORY_ORDER[b.categoryKey] ?? 99;
                  if (valA !== valB) return valA - valB;
                  return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
                });
              } else {
                tempQuestoes.sort((a, b) => {
                  const valA = CATEGORY_ORDER[a.categoryKey] ?? 99;
                  const valB = CATEGORY_ORDER[b.categoryKey] ?? 99;
                  if (valA !== valB) return valA - valB;
                  return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
                });
              }
            } catch (e) {
              tempQuestoes.sort((a, b) => {
                const valA = CATEGORY_ORDER[a.categoryKey] ?? 99;
                const valB = CATEGORY_ORDER[b.categoryKey] ?? 99;
                if (valA !== valB) return valA - valB;
                return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
              });
            }

            setQuestoes(tempQuestoes);
            setSubcasos(tempSubcasos);
            setLoaded(true);
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

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  const sortedQuestoes = useMemo(() => {
    if (effectiveStatus !== "mais_erros" || !resultadosMap) return questoes;
    return [...questoes].sort((a, b) => {
      const aErros = resultadosMap.get(a.id)?.totalErros ?? 0;
      const bErros = resultadosMap.get(b.id)?.totalErros ?? 0;
      return bErros - aErros;
    });
  }, [questoes, effectiveStatus, resultadosMap]);

  const errosInCaso = loaded && resultadosMap
    ? (effectiveStatus === "mais_erros"
        ? questoes.filter(q => (resultadosMap.get(q.id)?.totalErros ?? 0) > 0).length
        : questoes.filter(q => resultadosMap.get(q.id)?.ultimo === "erro").length)
    : 0;

  if ((effectiveStatus === "erros" || effectiveStatus === "mais_erros") && loaded && errosInCaso === 0) {
    return null;
  }

  const hasErrosInCaso = (effectiveStatus === "erros" || effectiveStatus === "mais_erros") && errosInCaso > 0;
  const hasContent = sortedQuestoes.length > 0 || subcasos.length > 0;
  const total = loaded ? (sortedQuestoes.length + subcasos.length) || undefined : undefined;
  const indent = depth > 0 ? "pl-4 border-l border-indigo-500/[0.15] ml-3" : "";

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        if (!isAdmin) return;
        e.dataTransfer.setData("text/plain", caso.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (isAdmin) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setIsDraggingOver(false);
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== caso.id && onDropCaso) {
            onDropCaso(draggedId, caso.id);
          }
        }
      }}
      className={`flex flex-col gap-0.5 ${indent} rounded-lg ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div className={`flex items-center justify-between py-1 px-2 transition-colors duration-150 rounded-lg group ${
        hasErrosInCaso ? "bg-rose-500/[0.03] border border-rose-500/20" : "hover:bg-white/[0.02]"
      }`}>
        {isAdmin && (
          <span 
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-indigo-400 transition-colors shrink-0 select-none" 
            title="Arrastar para reordenar caso"
          >
            <GripVertical size={13} />
          </span>
        )}

        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {loading ? (
              <Loader2 size={10} className="animate-spin text-slate-500" />
            ) : (
              <ChevronRight size={12} className={`text-slate-500 transition-transform duration-150 shrink-0 ${open ? "rotate-90" : ""}`} />
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

        {isAdmin && (
          <div className="flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(caso.id); }}
              disabled={isFirst}
              title="Mover caso para cima"
              className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(caso.id); }}
              disabled={isLast}
              title="Mover caso para baixo"
              className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent transition-all"
            >
              <ArrowDown size={10} />
            </button>
          </div>
        )}

        {total !== undefined && (
          <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md tabular-nums shrink-0 ml-1">
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
            <div className="text-[11px] text-slate-600 italic py-1 px-2">Sem questões registradas.</div>
          ) : (
            <>
              {subcasos.map((sub, idx) => (
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
                  statusFiltro={statusFiltro}
                  feitasHojeIds={feitasHojeIds}
                  isAdmin={isAdmin}
                  onMoveUp={(id) => handleMoveSubcaso(id, "up")}
                  onMoveDown={(id) => handleMoveSubcaso(id, "down")}
                  onDropCaso={handleDropSubcaso}
                  isFirst={idx === 0}
                  isLast={idx === subcasos.length - 1}
                />
              ))}

              {sortedQuestoes.map((q, idx) => (
                <div key={q.id} className={idx < questoes.length - 1 ? "border-b border-white/[0.06] pb-1 mb-1" : ""}>
                  <QuestaoRow 
                    questao={q} 
                    user={user} 
                    isDuvida={duvidasIds.has(q.id)}
                    onToggleDuvida={onToggleDuvida}
                    onAnswered={onAnswered}
                    stats={resultadosMap?.get(q.id)}
                    apenasComErros={apenasComErros}
                    statusFiltro={statusFiltro}
                    feitasHojeIds={feitasHojeIds}
                    isAdmin={isAdmin}
                    onMoveUp={(id) => handleMoveQuestao(id, "up")}
                    onMoveDown={(id) => handleMoveQuestao(id, "down")}
                    onDropQuestao={handleDropQuestao}
                    isFirst={idx === 0}
                    isLast={idx === questoes.length - 1}
                    onNextQuestion={idx < questoes.length - 1 ? () => setZoomedQuestaoIndex(idx + 1) : undefined}
                    onPrevQuestion={idx > 0 ? () => setZoomedQuestaoIndex(idx - 1) : undefined}
                    hasNextQuestion={idx < questoes.length - 1}
                    hasPrevQuestion={idx > 0}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {zoomedQuestaoIndex !== null && questoes[zoomedQuestaoIndex] && (
        <ZoomedQuestaoWrapper
          questao={questoes[zoomedQuestaoIndex]}
          onClose={() => setZoomedQuestaoIndex(null)}
          onNext={zoomedQuestaoIndex < questoes.length - 1 ? () => setZoomedQuestaoIndex(zoomedQuestaoIndex + 1) : undefined}
          onPrev={zoomedQuestaoIndex > 0 ? () => setZoomedQuestaoIndex(zoomedQuestaoIndex - 1) : undefined}
          hasNext={zoomedQuestaoIndex < questoes.length - 1}
          hasPrev={zoomedQuestaoIndex > 0}
        />
      )}
    </div>
  );
});

function BlockViewer({ 
  block, 
  user,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros,
  statusFiltro = "todas",
  feitasHojeIds = [],
  isAdmin = false,
}: { 
  block: NotionBlockRow; 
  user: any;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap?: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros";
  feitasHojeIds?: string[];
  isAdmin?: boolean;
}) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [filteredItens, setFilteredItens] = useState<QuestaoResumo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  const handleReorderCasos = (newCasos: Caso[]) => {
    setCasos(newCasos);
    try {
      const idOrder = newCasos.map(c => c.id);
      localStorage.setItem(`notion_casos_order_${block.block_id}`, JSON.stringify(idOrder));
    } catch (e) {}
  };

  const handleMoveCaso = (casoId: string, direction: "up" | "down") => {
    setCasos(prev => {
      const idx = prev.findIndex(c => c.id === casoId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);
      handleReorderCasos(copy);
      return copy;
    });
  };

  const handleDropCaso = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setCasos(prev => {
      const dragIdx = prev.findIndex(c => c.id === draggedId);
      const targetIdx = prev.findIndex(c => c.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(targetIdx, 0, moved);
      handleReorderCasos(copy);
      return copy;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        if (effectiveStatus !== "todas") {
          const details = await collectQuestaoDetails(block.block_id);
          let filtered: QuestaoResumo[] = [];
          if (effectiveStatus === "erros") {
            filtered = details.itens.filter(i => resultadosMap?.get(i.id)?.ultimo === "erro");
          } else if (effectiveStatus === "nao_feitas") {
            filtered = details.itens.filter(i => !resultadosMap?.has(i.id));
          } else if (effectiveStatus === "feitas_hoje") {
            filtered = details.itens.filter(i => feitasHojeIds.includes(i.id));
          }
          if (!cancelled) {
            setFilteredItens(filtered);
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

        // Ordenar casos com base na ordem salva
        try {
          const savedCasoOrder = localStorage.getItem(`notion_casos_order_${block.block_id}`);
          if (savedCasoOrder) {
            const orderIds: string[] = JSON.parse(savedCasoOrder);
            const map = new Map<string, number>();
            orderIds.forEach((id, i) => map.set(id, i));
            built.sort((a, b) => {
              const idxA = map.has(a.id) ? map.get(a.id)! : 999;
              const idxB = map.has(b.id) ? map.get(b.id)! : 999;
              return idxA - idxB;
            });
          }
        } catch (e) {}

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
  }, [block.block_id, effectiveStatus, resultadosMap, feitasHojeIds]);

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

  if (effectiveStatus !== "todas") {
    if (!filteredItens || filteredItens.length === 0) {
      const msgMap: Record<string, string> = {
        erros: "Nenhuma questão errada neste caderno.",
        nao_feitas: "Todas as questões deste caderno já foram respondidas!",
        feitas_hoje: "Nenhuma questão respondida hoje neste caderno.",
      };
      return <p className="text-[11px] text-slate-600 italic text-center py-6">{msgMap[effectiveStatus] || "Nenhuma questão encontrada."}</p>;
    }

    return (
      <div className="flex flex-col gap-1 pl-4 border-l border-indigo-500/20 ml-4 my-1">
        {filteredItens.map((item, idx) => (
          <div key={item.id} className={idx < filteredItens.length - 1 ? "border-b border-white/[0.05] pb-1 mb-1" : ""}>
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
              statusFiltro={statusFiltro}
              feitasHojeIds={feitasHojeIds}
              isAdmin={isAdmin}
            />
          </div>
        ))}
      </div>
    );
  }

  if (casos.length === 0) return <p className="text-[11px] text-slate-600 italic text-center py-10">Nenhum caso encontrado.</p>;

  return (
    <div className="flex flex-col gap-2">
      {casos.map((caso, idx) => (
        <CasoCard 
          key={caso.id} 
          caso={caso} 
          user={user} 
          duvidasIds={duvidasIds}
          onToggleDuvida={onToggleDuvida}
          onAnswered={onAnswered}
          resultadosMap={resultadosMap}
          apenasComErros={apenasComErros}
          statusFiltro={statusFiltro}
          feitasHojeIds={feitasHojeIds}
          isAdmin={isAdmin}
          onMoveUp={(id) => handleMoveCaso(id, "up")}
          onMoveDown={(id) => handleMoveCaso(id, "down")}
          onDropCaso={handleDropCaso}
          isFirst={idx === 0}
          isLast={idx === casos.length - 1}
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
      ? "border-slate-800 text-slate-500 bg-slate-900/60"
      : aproveitamento >= 70
      ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
      : aproveitamento >= 50
      ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
      : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

  return (
    <div className="flex items-center gap-2 text-[10px] font-normal shrink-0 select-none">
      <span className="text-slate-400">{ids.length} quest.</span>
      <span className="text-emerald-400/90 flex items-center gap-0.5 font-normal" title="Acertos">
        <Check size={11} className="text-emerald-400/80 stroke-[2]" />
        {acertos}
      </span>
      <span className="text-rose-400/90 flex items-center gap-0.5 font-normal" title="Erros">
        <X size={11} className="text-rose-400/80 stroke-[2]" />
        {erros}
      </span>
      <span className="text-amber-400/90 flex items-center gap-0.5 font-normal" title="Em Dúvida">
        <Flag size={10} className="text-amber-400/80 fill-amber-400/10" />
        {duvidas}
      </span>
      <span className={`px-1.5 py-0.5 rounded border tabular-nums ${aproveitamentoClasses}`} title="Aproveitamento">
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
  isAdmin = false,
}: {
  block: NotionBlockRow;
  user: any;
  resultadosMap: Map<string, QuestaoStats>;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  isAdmin?: boolean;
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
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}

const NotionBlockRowItem = memo(function NotionBlockRowItem({
  block,
  user,
  onDelete,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
  apenasComErros,
  statusFiltro = "todas",
  feitasHojeIds = [],
  isAdmin = false,
  onMoveUp,
  onMoveDown,
  onDropBlock,
  onUpdateOrdem,
  isFirst = false,
  isLast = false,
  onSelect,
}: {
  block: NotionBlockRow;
  user: any;
  onDelete: (id: string) => void;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros";
  feitasHojeIds?: string[];
  isAdmin?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDropBlock?: (draggedId: string, targetId: string) => void;
  onUpdateOrdem?: (id: string, newOrdem: number | null) => void;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect?: (block: NotionBlockRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showGabarito, setShowGabarito] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [blockIcon, setBlockIcon] = useState<string>("📝");
  const [blockStats, setBlockStats] = useState<{ acertos: number; erros: number; duvidas: number; total: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingOrdem, setEditingOrdem] = useState<string | number | null>(block.ordem ?? null);

  useEffect(() => {
    setEditingOrdem(block.ordem ?? null);
  }, [block.ordem]);

  const handleSaveOrdem = () => {
    if (editingOrdem === null || editingOrdem === "" || isNaN(Number(editingOrdem))) {
      onUpdateOrdem?.(block.id, null);
    } else {
      const val = Number(editingOrdem);
      if (val !== block.ordem) {
        onUpdateOrdem?.(block.id, val);
      }
    }
  };

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

  const isFilteringErros = statusFiltro === "erros" || apenasComErros;

  if (isFilteringErros && blockStats !== null && blockStats.erros === 0) {
    return null;
  }

  // A marcação em vermelho SÓ aparece quando o usuário está filtrando por erros especificamente
  const showRedHighlight = isFilteringErros && blockStats !== null && blockStats.erros > 0;

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        if (!isAdmin) return;
        e.dataTransfer.setData("text/plain", block.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (isAdmin) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setIsDraggingOver(false);
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== block.id && onDropBlock) {
            onDropBlock(draggedId, block.id);
          }
        }
      }}
      className={`flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-xl border transition-all ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      } ${
        showRedHighlight
          ? "bg-rose-500/[0.03] border-rose-500/25 shadow-md shadow-rose-500/5"
          : "bg-[#111623]/90 border-white/[0.06] hover:border-white/[0.12] shadow-sm"
      }`}
    >
      {/* Header do Card */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 flex-nowrap whitespace-nowrap overflow-hidden">
        <button
          onClick={() => onSelect ? onSelect(block) : setOpen(v => !v)}
          className="flex items-center gap-1.5 text-left transition-all flex-1 min-w-0 group flex-nowrap whitespace-nowrap overflow-hidden"
        >
          <span className="text-[9px] text-slate-500 w-3.5 h-3.5 flex items-center justify-center shrink-0 select-none">
            {onSelect ? "→" : open ? "▼" : "▶"}
          </span>
          <span className="text-sm shrink-0 select-none">{blockIcon}</span>
          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap whitespace-nowrap overflow-hidden">
            <span className={`text-[12px] sm:text-[13px] font-normal transition-colors truncate shrink-0 ${
              showRedHighlight ? "text-rose-300" : "text-slate-400 group-hover:text-slate-200"
            }`}>
              {block.nome}
            </span>
            {block.descricao && (
              <span className="text-[10px] text-slate-400/70 font-normal truncate shrink min-w-0 whitespace-nowrap">
                {block.descricao}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap whitespace-nowrap">
          <BlocoStatsBadge 
            block={block} 
            resultadosMap={resultadosMap} 
            duvidasIds={duvidasIds}
            onStatsLoaded={setBlockStats}
          />

          {/* Menu de 3 Pontinhos (Admin) */}
          {isAdmin && (
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(v => !v);
                }}
                title="Opções do Caderno (Admin)"
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                  showMenu
                    ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                    : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-200 hover:border-white/[0.15]"
                }`}
              >
                <MoreVertical size={13} />
              </button>

              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
                  />
                  
                  <div 
                    className="absolute right-0 top-full mt-1.5 w-60 z-50 bg-[#111623] border border-white/[0.12] rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5 backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span>⚙️</span> Opções de Admin
                      </span>
                      <button 
                        onClick={() => setShowMenu(false)}
                        className="text-slate-500 hover:text-slate-300 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Campo de Alterar Ordem */}
                    <div className="flex flex-col gap-1 bg-[#0d1220] p-2.5 rounded-xl border border-white/[0.06]">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Ordem no Banco (Supabase)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editingOrdem ?? ""}
                          onChange={(e) => setEditingOrdem(e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveOrdem();
                              setShowMenu(false);
                            }
                          }}
                          placeholder="Ex: 1"
                          className="w-full text-center text-[12px] font-mono font-black text-indigo-300 bg-black/50 border border-indigo-500/30 rounded-lg py-1 focus:outline-none focus:border-indigo-400 transition-all"
                        />
                        <button
                          onClick={() => {
                            handleSaveOrdem();
                            setShowMenu(false);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>

                    {/* Botões Mover Para Cima / Baixo */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { onMoveUp?.(block.id); }}
                        disabled={isFirst}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#0d1220] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-[#0d1220] transition-all"
                      >
                        <ArrowUp size={12} className="text-indigo-400" /> Subir
                      </button>
                      <button
                        onClick={() => { onMoveDown?.(block.id); }}
                        disabled={isLast}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#0d1220] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-[#0d1220] transition-all"
                      >
                        <ArrowDown size={12} className="text-indigo-400" /> Descer
                      </button>
                    </div>

                    {/* Botão Excluir Caderno */}
                    <div className="border-t border-white/[0.06] pt-2">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete(block.id);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold transition-all"
                      >
                        <Trash2 size={12} /> Excluir Caderno
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>



      {showGabarito && (
        <div className="mt-1">
          <GabaritoBloco
            block={block}
            user={user}
            resultadosMap={resultadosMap}
            duvidasIds={duvidasIds}
            onToggleDuvida={onToggleDuvida}
            onAnswered={onAnswered}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {open && (
        <div className="mt-1 pl-3 border-l border-indigo-500/[0.2]">
          <BlockViewer 
            block={block} 
            user={user} 
            duvidasIds={duvidasIds}
            onToggleDuvida={onToggleDuvida}
            onAnswered={onAnswered}
            resultadosMap={resultadosMap}
            apenasComErros={apenasComErros}
            statusFiltro={statusFiltro}
            feitasHojeIds={feitasHojeIds}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
});


export default function NotionQuestionTab({ user }: { user: any }) {
  const [blocks, setBlocks] = useState<NotionBlockRow[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<NotionBlockRow | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [duvidasIds, setDuvidasIds] = useState<Set<string>>(new Set());
  const [resultadosMap, setResultadosMap] = useState<Map<string, QuestaoStats>>(new Map());
  const [feitasHojeIds, setFeitasHojeIds] = useState<string[]>([]);
  const [respostasHojeMap, setRespostasHojeMap] = useState<Map<string, { data: string; horario: string; correto: string }>>(new Map());
  
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const handleAnswered = useCallback(() => setStatsRefreshTrigger(v => v + 1), []);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState(""); const [formNome, setFormNome] = useState(""); const [formDesc, setFormDesc] = useState(""); const [formMateria, setFormMateria] = useState("");
  
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros">("todas");
  const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");

  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      // Buscar blocos ordenados primariamente pela coluna 'ordem' do banco no Supabase
      const { data, error } = await supabase
        .from("notion_blocks")
        .select("*")
        .order("ordem", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setBlocks(data ?? []);
    } catch (e: any) { console.error(e.message); }
    finally { setLoadingBlocks(false); }
  }, []);

  const handleReorder = useCallback(async (newBlocks: NotionBlockRow[]) => {
    // Atribui números ordinais (1, 2, 3...) para o estado local
    const updatedBlocks = newBlocks.map((b, index) => ({ ...b, ordem: index + 1 }));
    setBlocks(updatedBlocks);

    // ATUALIZA A COLUNA 'ordem' NA TABELA 'notion_blocks' NO SUPABASE PARA TODOS OS USUÁRIOS
    try {
      const updates = updatedBlocks.map((b) => 
        supabase.from("notion_blocks").update({ ordem: b.ordem }).eq("id", b.id)
      );
      await Promise.allSettled(updates);
      await fetchBlocks();
    } catch (e) {
      console.error("Erro ao salvar coluna ordem no Supabase:", e);
    }
  }, [fetchBlocks]);

  const handleSingleOrdemChange = useCallback(async (blockId: string, newOrdem: number | null) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ordem: newOrdem ?? undefined } : b));
    try {
      const { error } = await supabase
        .from("notion_blocks")
        .update({ ordem: newOrdem })
        .eq("id", blockId);
      if (error) throw error;
      await fetchBlocks();
    } catch (e) {
      console.error("Erro ao atualizar ordem do bloco no Supabase:", e);
    }
  }, [fetchBlocks]);

  const handleMoveBlock = useCallback((blockId: string, direction: "up" | "down") => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newBlocks = [...prev];
      const [moved] = newBlocks.splice(index, 1);
      newBlocks.splice(newIndex, 0, moved);
      
      handleReorder(newBlocks);
      return newBlocks;
    });
  }, [handleReorder]);

  const handleDropBlock = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setBlocks(prev => {
      const dragIndex = prev.findIndex(b => b.id === draggedId);
      const targetIndex = prev.findIndex(b => b.id === targetId);
      if (dragIndex === -1 || targetIndex === -1) return prev;

      const newBlocks = [...prev];
      const [moved] = newBlocks.splice(dragIndex, 1);
      newBlocks.splice(targetIndex, 0, moved);

      handleReorder(newBlocks);
      return newBlocks;
    });
  }, [handleReorder]);

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

  const fetchResultados = useCallback(async () => {
    if (!user?.id) {
      setResultadosMap(new Map());
      setFeitasHojeIds([]);
      setRespostasHojeMap(new Map());
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notion_respostas")
        .select("questao_id, correto, data, horario")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .order("horario", { ascending: false });
      if (error) throw error;

      const now = new Date();
      const hojeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const stats = new Map<string, QuestaoStats>();
      const hojeSet = new Set<string>();
      const hojeMap = new Map<string, { data: string; horario: string; correto: string }>();

      for (const row of data ?? []) {
        if (row.data === hojeStr) {
          hojeSet.add(row.questao_id);
          if (!hojeMap.has(row.questao_id)) {
            hojeMap.set(row.questao_id, { data: row.data, horario: row.horario, correto: row.correto });
          }
        }

        const isCorrect = row.correto === "Sim";
        const existing = stats.get(row.questao_id);
        if (!existing) {
          stats.set(row.questao_id, {
            total: 1,
            corretas: isCorrect ? 1 : 0,
            totalErros: isCorrect ? 0 : 1,
            ultimo: isCorrect ? "acerto" : "erro",
            ultimaData: row.data,
          });
        } else {
          existing.total += 1;
          if (isCorrect) existing.corretas += 1;
          else existing.totalErros += 1;
        }
      }

      setResultadosMap(stats);
      setFeitasHojeIds(Array.from(hojeSet));
      setRespostasHojeMap(hojeMap);
    } catch (e) {
      console.error("Erro ao buscar resultados do Notion:", e);
    }
  }, [user?.id]);

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
      setFeitasHojeIds([]);
      setRespostasHojeMap(new Map());
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

  const materiasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      if (b.materia?.trim()) set.add(b.materia.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [blocks]);

  const blocksFiltrados = useMemo(() => {
    let result = blocks;
    if (materiaFiltro !== "Todas") {
      if (materiaFiltro === "Sem matéria") {
        result = result.filter(b => !b.materia?.trim());
      } else {
        result = result.filter(b => b.materia?.trim() === materiaFiltro);
      }
    }
    if (cadernoFiltro !== "Todos") {
      result = result.filter(b => b.id === cadernoFiltro || b.block_id === cadernoFiltro);
    }
    return result;
  }, [blocks, materiaFiltro, cadernoFiltro]);

  const blocksPorMateria = useMemo(() => {
    const map = new Map<string, NotionBlockRow[]>();
    for (const b of blocksFiltrados) {
      const mat = b.materia?.trim() || "Sem Matéria";
      if (!map.has(mat)) map.set(mat, []);
      map.get(mat)!.push(b);
    }
    return map;
  }, [blocksFiltrados]);

  const { acertadas, erradas } = useMemo(() => {
    const a: string[] = [], e: string[] = [];
    for (const [id, stats] of resultadosMap.entries()) {
      (stats.ultimo === "acerto" ? a : e).push(id);
    }
    return { acertadas: a, erradas: e };
  }, [resultadosMap]);

  const duvidasArr = useMemo(() => [...duvidasIds], [duvidasIds]);
  const totalRespondidas = acertadas.length + erradas.length;
  const taxaAcerto = totalRespondidas > 0 ? Math.round((acertadas.length / totalRespondidas) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 bg-[#080d1a] rounded-2xl border border-white/[0.06] p-4 sm:p-5 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-600/[0.03] blur-[120px] rounded-full pointer-events-none" />

      {/* Sleek Ultra-Compact Header Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2.5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <BookMarked size={14} className="text-indigo-400" />
            </div>
            <h2 className="text-sm font-black text-white tracking-tight">Notion Question</h2>
          </div>

          {user && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 flex-wrap">
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Feitas hoje">
                <Clock size={11} className="text-sky-400/80" /> <span className="text-sky-400/90 font-medium">{feitasHojeIds.length} hoje</span>
              </span>
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de acertos">
                <Check size={11} className="text-emerald-400/80 stroke-[2]" /> <span className="text-emerald-400/90 font-medium">{acertadas.length} acertos</span>
              </span>
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Com erros">
                <X size={11} className="text-rose-400/80 stroke-[2]" /> <span className="text-rose-400/90 font-medium">{erradas.length} erros</span>
              </span>
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Em dúvida">
                <Flag size={11} className="text-amber-400/80 fill-amber-400/10" /> <span className="text-amber-400/90 font-medium">{duvidasArr.length} dúvidas</span>
              </span>
              {totalRespondidas > 0 && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border bg-slate-900/60 border-slate-800 ${
                  taxaAcerto >= 70
                    ? "text-emerald-400/90"
                    : taxaAcerto >= 50
                    ? "text-amber-400/90"
                    : "text-rose-400/90"
                }`} title="Taxa de acertos">
                  🎯 {taxaAcerto}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { fetchBlocks(); fetchResultados(); }}
            title="Atualizar estatísticas e cadernos"
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-all"
          >
            <RefreshCw size={12} className={loadingBlocks ? "animate-spin" : ""} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-indigo-600/20"
            >
              <Plus size={11} /> Novo Bloco
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="border border-indigo-500/20 rounded-2xl bg-[#101526]/90 p-5 flex flex-col gap-4 backdrop-blur-xl relative z-10 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">
              Cadastrar Bloco Notion
            </p>
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

      {!selectedBlock && !loadingBlocks && blocks.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap justify-between bg-[#101526] p-3 rounded-2xl border border-white/[0.08] relative z-10 shadow-xl">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Filtro por Caderno */}
            <div className="flex items-center gap-1.5 bg-[#0d1220] border border-white/[0.08] hover:border-white/[0.18] px-3 py-1.5 rounded-xl transition-all">
              <BookMarked size={13} className="text-indigo-400 shrink-0" />
              <select
                value={cadernoFiltro}
                onChange={e => {
                  const val = e.target.value;
                  setCadernoFiltro(val);
                  if (val === "Todos") {
                    setSelectedBlock(null);
                  } else {
                    const found = blocks.find(b => b.id === val || b.block_id === val);
                    if (found) setSelectedBlock(found);
                  }
                }}
                className="bg-[#0d1220] text-slate-200 text-[11px] font-bold focus:outline-none cursor-pointer border-none min-w-[140px] max-w-[240px]"
                style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}
              >
                <option
                  value="Todos"
                  className="bg-[#0d1220] text-slate-200 py-1"
                  style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}
                >
                  Todos os Cadernos ({blocks.length})
                </option>
                {blocks.map(b => (
                  <option
                    key={b.id}
                    value={b.id}
                    className="bg-[#0d1220] text-slate-200 py-1"
                    style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}
                  >
                    {b.nome} {b.materia ? `(${b.materia})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Matéria */}
            <div className="flex items-center gap-1 flex-wrap">
              {["Todas", ...materiasDisponiveis, "Sem matéria"].map(m => (
                <button
                  key={m}
                  onClick={() => setMateriaFiltro(m)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    materiaFiltro === m
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                      : "bg-[#0d1220] border-white/[0.07] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por Status da Questão */}
          <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] shrink-0 flex-wrap">
            <button
              onClick={() => setStatusFiltro("todas")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "todas" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFiltro("erros")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "erros" ? "bg-rose-600 text-white shadow" : "text-rose-400/70 hover:text-rose-300"
              }`}
            >
              🔴 Últs. Erros
            </button>
            <button
              onClick={() => setStatusFiltro("mais_erros")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "mais_erros" ? "bg-amber-600 text-white shadow" : "text-amber-400/70 hover:text-amber-300"
              }`}
            >
              🔥 Mais Erros
            </button>
            <button
              onClick={() => setStatusFiltro("nao_feitas")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "nao_feitas" ? "bg-purple-600 text-white shadow" : "text-purple-400/70 hover:text-purple-300"
              }`}
            >
              ⭕ Não Feitas
            </button>
            <button
              onClick={() => setStatusFiltro("feitas_hoje")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "feitas_hoje" ? "bg-sky-600 text-white shadow" : "text-sky-400/70 hover:text-sky-300"
              }`}
            >
              ⚡ Feitas Hoje
            </button>
          </div>
        </div>
      )}

      {selectedBlock ? (
        <div className="flex flex-col gap-4 relative z-10 animate-in fade-in duration-200">
          {/* Header da visão dedicada do caderno */}
          <div className="flex items-center justify-between gap-3 bg-[#101526] p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] shadow-xl flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedBlock(null);
                  setCadernoFiltro("Todos");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0"
              >
                <ChevronLeft size={15} className="text-indigo-400" />
                <span>Voltar aos Cadernos</span>
              </button>

              <div className="h-5 w-px bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">📝</span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">{selectedBlock.nome}</h3>
                    {selectedBlock.materia && (
                      <span className="text-[10px] font-bold text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md shrink-0">
                        {selectedBlock.materia}
                      </span>
                    )}
                  </div>
                  {selectedBlock.descricao && (
                    <p className="text-[11px] text-slate-400 truncate">{selectedBlock.descricao}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <BlocoStatsBadge
                block={selectedBlock}
                resultadosMap={resultadosMap}
                duvidasIds={duvidasIds}
              />
            </div>
          </div>

          {/* Barra de Filtro interna do Caderno */}
          <div className="flex items-center justify-between gap-3 bg-[#101526] p-3 rounded-2xl border border-white/[0.06] flex-wrap">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Filter size={14} className="text-indigo-400" />
              Filtrar questões neste caderno:
            </span>
            <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] shrink-0 flex-wrap">
              <button
                onClick={() => setStatusFiltro("todas")}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFiltro === "todas" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFiltro("erros")}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFiltro === "erros" ? "bg-rose-600 text-white shadow" : "text-rose-400/70 hover:text-rose-300"
                }`}
              >
                🔴 Últs. Erros
              </button>
              <button
                onClick={() => setStatusFiltro("mais_erros")}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFiltro === "mais_erros" ? "bg-amber-600 text-white shadow" : "text-amber-400/70 hover:text-amber-300"
                }`}
              >
                🔥 Mais Erros
              </button>
              <button
                onClick={() => setStatusFiltro("nao_feitas")}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFiltro === "nao_feitas" ? "bg-purple-600 text-white shadow" : "text-purple-400/70 hover:text-purple-300"
                }`}
              >
                ⭕ Não Feitas
              </button>
              <button
                onClick={() => setStatusFiltro("feitas_hoje")}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFiltro === "feitas_hoje" ? "bg-sky-600 text-white shadow" : "text-sky-400/70 hover:text-sky-300"
                }`}
              >
                ⚡ Feitas Hoje
              </button>
            </div>
          </div>

          {/* Conteúdo do caderno selecionado */}
          <div className="bg-[#101526]/80 border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-2xl ml-2 sm:ml-5">
            <BlockViewer
              block={selectedBlock}
              user={user}
              duvidasIds={duvidasIds}
              onToggleDuvida={handleToggleDuvida}
              onAnswered={handleAnswered}
              resultadosMap={resultadosMap}
              statusFiltro={statusFiltro}
              feitasHojeIds={feitasHojeIds}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      ) : (
        <>
          {isAdmin && !loadingBlocks && blocksFiltrados.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-[#101526]/80 px-3.5 py-2 rounded-xl border border-white/[0.06] relative z-10">
              <MoreVertical size={12} className="text-indigo-400 shrink-0" />
              <span>Modo Admin: Clique no menu de 3 pontinhos (⋮) no caderno para alterar a ordem no banco ou reordenar.</span>
            </div>
          )}

          {loadingBlocks ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
              <BookMarked size={32} className="text-slate-800" />
              <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum bloco cadastrado</p>
              <p className="text-[11px] text-slate-700 max-w-xs">Clique em "Novo Bloco" para cadastrar o ID de um bloco do Notion.</p>
            </div>
          ) : blocksFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
              <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum caderno encontrado</p>
              <button onClick={() => { setMateriaFiltro("Todas"); setCadernoFiltro("Todos"); setStatusFiltro("todas"); }} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">Limpar filtros</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
              {[...blocksPorMateria.entries()].map(([materiaName, mBlocks]) => (
                <div 
                  key={materiaName} 
                  className="flex flex-col bg-[#101526]/80 border border-white/[0.06] rounded-xl p-2.5 sm:p-3 shadow-lg gap-1.5 transition-all hover:border-white/[0.10]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <h3 className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
                        {materiaName}
                      </h3>
                    </div>
                    <span className="text-[9.5px] font-normal text-slate-500 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
                      {mBlocks.length} caderno{mBlocks.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-0.5">
                    {mBlocks.map((block, index) => (
                      <NotionBlockRowItem
                        key={block.id}
                        block={block}
                        user={user}
                        onDelete={handleDelete}
                        duvidasIds={duvidasIds}
                        onToggleDuvida={handleToggleDuvida}
                        onAnswered={handleAnswered}
                        resultadosMap={resultadosMap}
                        statusFiltro={statusFiltro}
                        feitasHojeIds={feitasHojeIds}
                        isAdmin={isAdmin}
                        onMoveUp={(id) => handleMoveBlock(id, "up")}
                        onMoveDown={(id) => handleMoveBlock(id, "down")}
                        onDropBlock={handleDropBlock}
                        onUpdateOrdem={handleSingleOrdemChange}
                        isFirst={index === 0}
                        isLast={index === mBlocks.length - 1}
                        onSelect={(b) => setSelectedBlock(b)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
