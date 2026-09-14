"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Loader2,
  BookMarked, RefreshCw, X, Check, Play, Eye, EyeOff,
  Triangle, Flag, History, LayoutGrid, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw,
  Clock, HelpCircle, Filter, Flame, Calendar, BarChart3, Target, AlertTriangle,
  GripVertical, ArrowUp, ArrowDown, MoreVertical
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
interface QuestaoStats { total: number; corretas: number; ultimo: "acerto" | "erro"; ultimaData?: string }

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

function ImagemLightbox({
  url,
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
}: {
  url: string;
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
}) {
  const [scale, setScale] = useState(1);
  const [isFullWidth, setIsFullWidth] = useState(false); // Default to Modo Ajustado!
  const [showResposta, setShowResposta] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

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
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-between select-none animate-in fade-in duration-200"
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
    >
      {/* Top Bar Controls */}
      <div className="w-full px-3 sm:px-6 py-2.5 flex items-center justify-between bg-black/85 backdrop-blur-md border-b border-white/10 z-30 flex-wrap gap-2">
        {/* Left Info */}
        <div className="flex items-center gap-2 text-white font-bold text-xs truncate max-w-xs sm:max-w-md">
          <Maximize2 size={16} className="text-indigo-400 shrink-0" />
          <span className="truncate">
            {questaoNumero ? `Questão ${questaoNumero}` : "Visualizador de Imagem"}
            {questaoTopic ? ` — ${questaoTopic}` : ""}
          </span>
          {caseLabel && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-normal shrink-0">
              {caseLabel}
            </span>
          )}
        </div>

        {/* Toolbar Center */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/10">
          {hasPrev && onPrev && (
            <button
              onClick={onPrev}
              title="Questão Anterior (←)"
              className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all text-xs font-bold flex items-center gap-1 active:scale-95"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Anterior</span>
            </button>
          )}

          <button
            onClick={handleZoomOut}
            title="Diminuir zoom (-)"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-all"
          >
            <ZoomOut size={15} />
          </button>

          <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200 px-1 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            title="Aumentar zoom (+)"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-all"
          >
            <ZoomIn size={15} />
          </button>

          <div className="w-px h-5 bg-white/20 my-auto mx-0.5" />

          {/* Modo Ajustado / 100% Tela Cheia */}
          <button
            onClick={toggleFullWidth}
            title="Alternar Modo de Visualização (Tecla F)"
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all ${
              !isFullWidth
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40"
                : "hover:bg-white/20 text-slate-200"
            }`}
          >
            {!isFullWidth ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{!isFullWidth ? "Modo Ajustado" : "100% Tela Cheia"}</span>
          </button>

          <button
            onClick={handleReset}
            title="Resetar Zoom (0)"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-slate-400 hover:text-white transition-all"
          >
            <RotateCcw size={13} />
          </button>

          {hasNext && onNext && (
            <button
              onClick={onNext}
              title="Próxima Questão (→)"
              className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-all text-xs font-bold flex items-center gap-1 active:scale-95"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Action Right: Revelar Resposta & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResposta(v => !v)}
            title="Revelar ou Ocultar Resposta (Tecla R)"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border ${
              showResposta
                ? "bg-emerald-600 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/30"
                : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30"
            }`}
          >
            {showResposta ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showResposta ? "Ocultar Resposta" : "✨ Revelar Resposta"}</span>
          </button>

          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 transition-all active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Floating Side Arrows for Next/Prev */}
      {hasPrev && onPrev && (
        <button
          onClick={onPrev}
          title="Questão Anterior (←)"
          className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/70 hover:bg-indigo-600 text-white flex items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-90 group"
        >
          <ChevronLeft size={26} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {hasNext && onNext && (
        <button
          onClick={onNext}
          title="Próxima Questão (→)"
          className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/70 hover:bg-indigo-600 text-white flex items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-90 group"
        >
          <ChevronRight size={26} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Main Image View Container */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-1 sm:p-4"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={url}
          alt="Imagem em tela cheia"
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className={`bg-white rounded-xl shadow-2xl object-contain ${
            isFullWidth
              ? "w-full h-full max-w-none max-h-none"
              : "max-w-[95vw] max-h-[85vh]"
          }`}
        />
      </div>

      {/* Slide-Up Answer Panel */}
      {showResposta && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[92vw] max-w-3xl max-h-[48vh] overflow-y-auto bg-[#0b101d]/95 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl p-4 shadow-2xl z-40 text-white animate-in slide-in-from-bottom duration-200 custom-scrollbar">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
            <span className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-2">
              <span>✨</span> Resposta e Gabarito {questaoNumero ? `— Questão ${questaoNumero}` : ""}
            </span>
            <button
              onClick={() => setShowResposta(false)}
              className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {respostaImageUrls && respostaImageUrls.length > 0 && (
            <div className="flex flex-col gap-3 mb-3">
              {respostaImageUrls.map((rUrl, i) => (
                <img
                  key={i}
                  src={rUrl}
                  alt={`Resposta ${i + 1}`}
                  className="w-full rounded-xl border border-white/10 object-contain bg-white shadow-md max-h-[35vh]"
                />
              ))}
            </div>
          )}

          {respostaText ? (
            <p className="text-xs sm:text-sm font-normal text-slate-200 whitespace-pre-wrap leading-relaxed">
              {respostaText}
            </p>
          ) : (!respostaImageUrls || respostaImageUrls.length === 0) ? (
            <p className="text-xs text-slate-400 italic">Nenhuma resposta registrada no Notion.</p>
          ) : null}
        </div>
      )}

      {/* Footer hint */}
      <div className="w-full px-4 py-2 bg-black/85 backdrop-blur-md text-[11px] text-slate-400 font-medium z-20 flex items-center justify-center gap-3 sm:gap-6 text-center flex-wrap">
        <span>💡 Dica: <span className="text-indigo-300 font-bold">Modo Ajustado</span> ativo por padrão</span>
        <span>• Use <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-slate-200">←</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-slate-200">→</kbd> para Pular Questão</span>
        <span>• Aperte <kbd className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono">R</kbd> para Revelar Resposta</span>
      </div>
    </div>,
    document.body
  );
}

function ZoomedQuestaoWrapper({
  questao,
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
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  initialUrl?: string;
  initialRespostaText?: string;
  initialRespostaImageUrls?: string[];
}) {
  const [imageUrls, setImageUrls] = useState<string[]>(initialUrl ? [initialUrl] : []);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>(initialRespostaImageUrls ?? []);
  const [respostaText, setRespostaText] = useState<string | undefined>(initialRespostaText);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const children = await fetchChildren(questao.id);
        const imgs: string[] = [];
        const rImgs: string[] = [];
        let textResp: string | undefined;

        for (const child of children) {
          if (child.type === "image") {
            const url = imgUrl(child);
            if (url) imgs.push(url);
          } else if (child.type === "toggle") {
            const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
            if (tText.includes("resposta") && child.has_children) {
              const rChildren = await fetchChildren(child.id);
              const texts: string[] = [];
              for (const rc of rChildren) {
                if (rc.type === "image") {
                  const url = imgUrl(rc);
                  if (url) rImgs.push(url);
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
              textResp = texts.join("\n") || undefined;
            }
          }
        }
        if (active) {
          if (imgs.length > 0) setImageUrls(imgs);
          setRespostaImageUrls(rImgs);
          setRespostaText(textResp);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false; };
  }, [questao.id]);

  const mainUrl = imageUrls[0] || initialUrl || "";

  return (
    <ImagemLightbox
      url={mainUrl}
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
    />
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
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje";
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
      (async () => {
        setLoading(true);
        try {
          console.log(`[QuestaoRow DEBUG] Buscando filhos da questao ${questao.numero} (ID: ${questao.id})`);
          const children = await fetchChildren(questao.id);
          console.log(`[QuestaoRow DEBUG] Filhos recebidos para questao ${questao.numero}:`, children);

          const imgs: string[] = [];
          const rImgs: string[] = [];
          let textResp: string | undefined;
          let foundToggleId: string | null = null;

          for (const child of children) {
            if (child.type === "image") {
              const url = imgUrl(child);
              console.log(`[QuestaoRow DEBUG] Bloco de imagem detectado na questao ${questao.numero}:`, child, "URL:", url);
              if (url) imgs.push(url);
            } else if (child.type === "toggle") {
              const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
              if (tText.includes("resposta")) {
                foundToggleId = child.id;
                if (child.has_children) {
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
                  textResp = texts.join("\n") || undefined;
                }
              }
            }
          }
          if (active) {
            console.log(`[QuestaoRow DEBUG] Definindo dados da questao ${questao.numero}. Imagens:`, imgs, "Imagens Resposta:", rImgs);
            setImageUrls(imgs);
            setRespostaImageUrls(rImgs);
            setRespostaText(textResp);
            setRespostaToggleId(foundToggleId);
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
  const isRespondida = !!stats;
  const isFeitaHoje = feitasHojeIds.includes(questao.id);

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  if (effectiveStatus === "erros" && !isErro) return null;
  if (effectiveStatus === "nao_feitas" && isRespondida) return null;
  if (effectiveStatus === "feitas_hoje" && !isFeitaHoje) return null;

  const showHighlightStyle = (effectiveStatus === "erros" && isErro) || (effectiveStatus === "feitas_hoje" && isFeitaHoje);

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
      className={`flex flex-col py-1 transition-all rounded-lg ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div className={`flex items-center gap-2.5 sm:gap-3 py-1.5 px-2.5 transition-all rounded-lg group ${
        showHighlightStyle ? "bg-rose-500/[0.03] border border-rose-500/15" : "hover:bg-white/[0.03]"
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

        {isErro && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/30 border border-rose-500/20 shrink-0 shadow-sm ${!isAdmin ? "ml-auto" : ""}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            Errou
          </span>
        )}
        {isAcerto && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 shrink-0 shadow-sm ${!isAdmin ? "ml-auto" : ""}`}>
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
                  <div key={i} className="relative group max-w-2xl">
                    <img
                      src={url}
                      alt={`Q${questao.numero} img${i + 1}`}
                      onClick={() => setZoomedImage(url)}
                      className="w-full rounded-xl border border-white/[0.06] object-contain bg-white cursor-zoom-in hover:brightness-95 transition-all shadow-md"
                    />
                    <button
                      onClick={() => setZoomedImage(url)}
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
                    {respostaImageUrls.map((url, i) => (
                      <div key={i} className="relative group max-w-2xl">
                        <img
                          src={url}
                          alt={`Resposta img${i + 1}`}
                          onClick={() => setZoomedImage(url)}
                          className="w-full rounded-xl border border-white/[0.08] object-contain bg-white cursor-zoom-in hover:brightness-95 transition-all shadow-md"
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
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95 ${
                          isDuvida 
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' 
                            : 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-400'
                        }`}
                      >
                        <Flag size={11} className={isDuvida ? "fill-amber-400 text-amber-400" : ""} /> Em dúvida
                      </button>

                      <button
                        onClick={() => handleRecordAnswer(true)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95"
                      >
                        <Check size={11} /> Acertei
                      </button>
                      <button
                        onClick={() => handleRecordAnswer(false)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 text-[10px] font-medium transition-all disabled:opacity-50 active:scale-95"
                      >
                        <X size={11} /> Errei
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
                            {adminImageUrl && (
                              <img src={adminImageUrl} alt="preview" className="mt-1 max-h-32 rounded-lg border border-white/10 object-contain bg-white/5" />
                            )}
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
}

function CasoCard({ 
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
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje";
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

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  if (effectiveStatus === "erros" && loaded && errosInCaso === 0) {
    return null;
  }

  const hasErrosInCaso = effectiveStatus === "erros" && errosInCaso > 0;
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
      className={`flex flex-col gap-0.5 ${indent} transition-all rounded-lg ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div className={`flex items-center justify-between py-1 px-2 transition-all rounded-lg group ${
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
            <div className="text-[11px] text-slate-600 italic py-1 px-2">Sem questões com emoji reconhecido.</div>
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
}

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
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje";
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
    <div className="flex flex-col gap-2 pl-4 border-l border-indigo-500/[0.15] ml-4 mt-1">
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

function NotionBlockRowItem({
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
}: {
  block: NotionBlockRow;
  user: any;
  onDelete: (id: string) => void;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap: Map<string, QuestaoStats>;
  apenasComErros?: boolean;
  statusFiltro?: "todas" | "erros" | "nao_feitas" | "feitas_hoje";
  feitasHojeIds?: string[];
  isAdmin?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDropBlock?: (draggedId: string, targetId: string) => void;
  onUpdateOrdem?: (id: string, newOrdem: number | null) => void;
  isFirst?: boolean;
  isLast?: boolean;
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
      className={`flex flex-col gap-2 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      } ${
        showRedHighlight
          ? "bg-rose-500/[0.03] border-rose-500/25 shadow-md shadow-rose-500/5"
          : "bg-[#111623] border-white/[0.06] hover:border-white/[0.12] shadow-md"
      }`}
    >
      {/* Header do Card */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-left transition-all flex-1 min-w-0 group"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-base shrink-0 select-none">{blockIcon}</span>
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <span className={`text-[13px] sm:text-[14px] font-black transition-colors truncate ${
              showRedHighlight ? "text-rose-300" : "text-slate-200 group-hover:text-white"
            }`}>
              {block.nome}
            </span>
            {block.materia && (
              <span className="text-[10px] font-bold text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md shrink-0">
                {block.materia}
              </span>
            )}
            {block.descricao && (
              <span className="text-[11px] text-slate-400/70 font-normal truncate shrink-0">
                {block.descricao}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
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
}

function PainelDesempenho({
  user,
  duvidasIds,
  resultadosMap,
  feitasHojeIds,
  onRefresh,
}: {
  user: any;
  duvidasIds: Set<string>;
  resultadosMap: Map<string, QuestaoStats>;
  feitasHojeIds: string[];
  respostasHojeMap?: Map<string, { data: string; horario: string; correto: string }>;
  onRefresh: () => void;
  blocks?: NotionBlockRow[];
}) {
  const { acertadas, erradas } = useMemo(() => {
    const a: string[] = [], e: string[] = [];
    for (const [id, stats] of resultadosMap.entries()) {
      (stats.ultimo === "acerto" ? a : e).push(id);
    }
    return { acertadas: a, erradas: e };
  }, [resultadosMap]);

  if (!user) return null;

  const duvidasArr = [...duvidasIds];

  const cards: {
    key: string;
    label: string;
    sublabel: string;
    count: number;
    color: "blue" | "emerald" | "red" | "amber";
    icon: ReactNode;
  }[] = [
    { key: "feitas_hoje", label: "Feitas Hoje", sublabel: `${feitasHojeIds.length} hoje`, count: feitasHojeIds.length, color: "blue", icon: <Clock size={13} /> },
    { key: "acertos", label: "Acertadas", sublabel: `${acertadas.length} acertos`, count: acertadas.length, color: "emerald", icon: <Check size={13} /> },
    { key: "erros", label: "Erradas", sublabel: `${erradas.length} com erro`, count: erradas.length, color: "red", icon: <X size={13} /> },
    { key: "duvidas", label: "Em Dúvida", sublabel: `${duvidasArr.length} marcadas`, count: duvidasArr.length, color: "amber", icon: <Flag size={13} /> },
  ];

  const colorClasses: Record<string, { border: string; text: string; iconBg: string; bg: string }> = {
    blue: { border: "border-blue-500/25", text: "text-blue-400", iconBg: "bg-blue-500/10", bg: "bg-blue-500/[0.02]" },
    emerald: { border: "border-emerald-500/25", text: "text-emerald-400", iconBg: "bg-emerald-500/10", bg: "bg-emerald-500/[0.02]" },
    red: { border: "border-red-500/25", text: "text-red-400", iconBg: "bg-red-500/10", bg: "bg-red-500/[0.02]" },
    amber: { border: "border-amber-500/25", text: "text-amber-400", iconBg: "bg-amber-500/10", bg: "bg-amber-500/[0.02]" },
  };

  return (
    <div className="flex flex-col gap-3.5 border border-white/[0.06] rounded-2xl bg-[#111623] p-4 sm:p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-indigo-400" />
          <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Painel de Desempenho</p>
        </div>
        <button onClick={onRefresh} title="Atualizar estatísticas" className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-indigo-400 transition-all">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Grid de estatísticas estáticas limpas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {cards.map(card => {
          const c = colorClasses[card.color];
          return (
            <div key={card.key} className={`rounded-xl border ${c.border} ${c.bg} px-3.5 py-3 flex items-center justify-between transition-all`}>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 truncate">
                  <span className={`w-4 h-4 rounded-md flex items-center justify-center ${c.iconBg} ${c.text} shrink-0`}>{card.icon}</span>
                  <span className="truncate">{card.label}</span>
                </span>
                <span className="text-[9px] text-slate-500 font-bold truncate">{card.sublabel}</span>
              </div>
              <span className={`text-lg font-black tabular-nums ml-2 ${c.text}`}>{card.count}</span>
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
  const [feitasHojeIds, setFeitasHojeIds] = useState<string[]>([]);
  const [respostasHojeMap, setRespostasHojeMap] = useState<Map<string, { data: string; horario: string; correto: string }>>(new Map());
  
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const handleAnswered = useCallback(() => setStatsRefreshTrigger(v => v + 1), []);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState(""); const [formNome, setFormNome] = useState(""); const [formDesc, setFormDesc] = useState(""); const [formMateria, setFormMateria] = useState("");
  
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "nao_feitas" | "feitas_hoje">("todas");
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
            ultimo: isCorrect ? "acerto" : "erro",
            ultimaData: row.data,
          });
        } else {
          existing.total += 1;
          if (isCorrect) existing.corretas += 1;
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

      <PainelDesempenho 
        user={user} 
        duvidasIds={duvidasIds} 
        resultadosMap={resultadosMap} 
        feitasHojeIds={feitasHojeIds}
        respostasHojeMap={respostasHojeMap}
        onRefresh={fetchResultados} 
        blocks={blocks} 
      />

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
        <div className="flex items-center gap-3 flex-wrap justify-between bg-[#111623] p-3 rounded-2xl border border-white/[0.06]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Filtro por Caderno */}
            <div className="flex items-center gap-1.5 bg-[#0d1220] border border-white/[0.08] px-2.5 py-1 rounded-xl">
              <BookMarked size={12} className="text-indigo-400 shrink-0" />
              <select
                value={cadernoFiltro}
                onChange={e => setCadernoFiltro(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="Todos" className="bg-[#0d1220]">Todos os Cadernos ({blocks.length})</option>
                {blocks.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#0d1220]">{b.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Matéria */}
            <div className="flex items-center gap-1 flex-wrap">
              {["Todas", ...materiasDisponiveis, "Sem matéria"].map(m => (
                <button
                  key={m}
                  onClick={() => setMateriaFiltro(m)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                    materiaFiltro === m
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-[#0d1220] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por Status da Questão */}
          <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] shrink-0">
            <button
              onClick={() => setStatusFiltro("todas")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "todas" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFiltro("erros")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "erros" ? "bg-rose-600 text-white" : "text-rose-400/70 hover:text-rose-300"
              }`}
            >
              🔴 Erros
            </button>
            <button
              onClick={() => setStatusFiltro("nao_feitas")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "nao_feitas" ? "bg-purple-600 text-white" : "text-purple-400/70 hover:text-purple-300"
              }`}
            >
              ⭕ Não Feitas
            </button>
            <button
              onClick={() => setStatusFiltro("feitas_hoje")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFiltro === "feitas_hoje" ? "bg-blue-600 text-white" : "text-blue-400/70 hover:text-blue-300"
              }`}
            >
              ⚡ Feitas Hoje
            </button>
          </div>
        </div>
      )}

      {isAdmin && !loadingBlocks && blocksFiltrados.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-[#111623] px-3 py-1.5 rounded-xl border border-white/[0.05]">
          <MoreVertical size={12} className="text-indigo-400 shrink-0" />
          <span>Modo Admin: Clique no menu de 3 pontinhos (⋮) no caderno para alterar a ordem no banco ou reordenar.</span>
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
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum caderno encontrado</p>
          <button onClick={() => { setMateriaFiltro("Todas"); setCadernoFiltro("Todos"); setStatusFiltro("todas"); }} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">Limpar filtros</button>
        </div>
      ) : (
        <div className="flex flex-col bg-[#111623] border border-white/[0.06] rounded-2xl p-2 divide-y divide-white/[0.05]">
          {blocksFiltrados.map((block, index) => (
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
              isLast={index === blocksFiltrados.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
