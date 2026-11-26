"use client";

import { useState, useEffect, useCallback, useMemo, memo, createContext, useContext, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Loader2,
  BookMarked, RefreshCw, X, Check, Play, Eye, EyeOff,
  Triangle, Flag, History, LayoutGrid, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Moon, Sun,
  Clock, HelpCircle, Filter, Flame, Calendar, BarChart3, Target, AlertTriangle,
  GripVertical, ArrowUp, ArrowDown, MoreVertical, Database, Printer, ListTree, Tag,
  Ban, Trophy, FolderPlus, FolderInput, Pencil, FilePlus2, Folder, FileText
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SyncBancoModal, type NotionIdChangeAlert } from "./SyncBancoModal";
import { PrintNotionModal, type PrintableNotionQuestion } from "./PrintNotionModal";
import { CreateCasoModal, QuestaoBuilderModal, MoveQuestaoModal, type QuestaoInitialEdit } from "./NotionBuilderModals";
import { deleteCasoOrSubcaso, deleteQuestaoFromCaso, writeSupabaseCacheBlocks, type BuilderCategoryKey } from "../../lib/notionLocalBuilder";

const CATEGORIES = [
  { key: "bonus",     label: "Bônus",     emojis: ["🎉","🥳","🎊"],        icon: "🎉",  color: "#d97706", textColor: "#c69238", dot: false },
  { key: "faceis",    label: "Fáceis",    emojis: ["🟢","✅","💚","🍀"],   icon: null,  color: "#16a34a", textColor: "#479e78", dot: true  },
  { key: "atencao",   label: "Atenção",   emojis: ["🔵","💙","🌀","🫐"],   icon: null,  color: "#2563eb", textColor: "#4a88b5", dot: true  },
  { key: "lacuna",    label: "Lacuna",    emojis: ["⛳","⛳️","🌱","🌿","🪴"], icon: "⛳",  color: "#65a30d", textColor: "#6b9e44", dot: false },
  { key: "media",     label: "Média",     emojis: ["🟡","💛","⭐","🌟","🟠","🧡"],   icon: null,  color: "#ea580c", textColor: "#c69238", dot: true  },
  { key: "dificil",   label: "Difícil",   emojis: ["🔴","❤️","💔","🔥"],   icon: null,  color: "#dc2626", textColor: "#c45454", dot: true  },
  { key: "ultrahard", label: "Ultrahard", emojis: ["🟣","💜","👾","🫀"],   icon: null,  color: "#9333ea", textColor: "#8e66ab", dot: true  },
  { key: "dominada",  label: "Dominada",  emojis: ["🏆"],                   icon: "🏆", color: "#0f766e", textColor: "#48b5a1", dot: false },
  { key: "treinar",   label: "Treinar",   emojis: ["🧠"],                   icon: "🧠", color: "#0891b2", textColor: "#5fb8d0", dot: false },
  { key: "revisar",   label: "Revisar",   emojis: ["🔁"],                   icon: "🔁", color: "#d97706", textColor: "#d6a258", dot: false },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

function ClassificationValidationDropdown({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (val: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedCat = CATEGORIES.find(c => c.key === value);
  const isCustom = value === "personalizadas";
  const isPadrao = value === "padrao";
  const isFiltered = value !== "todas";

  const renderSwatch = (cat: typeof CATEGORIES[number]) => {
    if (cat.icon) return <span className="text-xs leading-none shrink-0">{cat.icon}</span>;
    if (cat.dot) {
      return (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/15"
          style={{ backgroundColor: cat.color }}
        />
      );
    }
    return null;
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full sm:w-auto max-w-full">
      <div
        className={`flex items-center rounded-xl border transition-colors ${
          isFiltered
            ? "bg-indigo-500/10 border-indigo-500/40 text-white"
            : "bg-[#0d1220] border-white/[0.10] hover:border-white/[0.20] text-slate-200"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex items-center justify-between gap-2 text-left focus:outline-none w-full sm:w-auto ${
            compact ? "px-2.5 py-2 sm:py-1.5 min-w-0 sm:min-w-[175px]" : "px-3 py-2 sm:py-1.5 min-w-0 sm:min-w-[225px]"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Tag size={12} className={isFiltered ? "text-amber-400 shrink-0" : "text-indigo-400 shrink-0"} />
            {!compact && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                Classificação:
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[11px] font-semibold truncate">
              {selectedCat ? (
                <>
                  {renderSwatch(selectedCat)}
                  <span style={{ color: selectedCat.textColor }} className="font-bold truncate">
                    {selectedCat.label}
                  </span>
                </>
              ) : isCustom ? (
                <>
                  <span className="text-xs leading-none">✨</span>
                  <span className="text-purple-300 font-bold truncate">Personalizadas</span>
                </>
              ) : isPadrao ? (
                <>
                  <span className="text-xs leading-none">📋</span>
                  <span className="text-slate-200 font-bold truncate">Padrão</span>
                </>
              ) : (
                <span className="text-slate-300 truncate">Todas as classificações</span>
              )}
            </span>
          </span>
          <ChevronDown size={13} className={`text-slate-400 shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("todas");
              setOpen(false);
            }}
            title="Limpar filtro de classificação"
            className="pr-2 pl-0.5 py-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Lista de validação de classificação"
          className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[240px] sm:w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/[0.14] bg-[#0b101c] py-1.5 shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] mb-1">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              Lista de Validação
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  onChange("todas");
                  setOpen(false);
                }}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto px-1 flex flex-col gap-0.5">
            <button
              type="button"
              role="option"
              aria-selected={value === "todas"}
              onClick={() => { onChange("todas"); setOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                value === "todas"
                  ? "bg-indigo-600/20 text-white"
                  : "text-slate-300 hover:bg-white/[0.05]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-500/70 shrink-0" />
                <span>Todas as classificações</span>
              </span>
              {value === "todas" && <Check size={12} className="text-indigo-400 shrink-0" />}
            </button>

            <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Níveis e Marcadores
            </div>

            {CATEGORIES.map(cat => {
              const active = value === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(active ? "todas" : cat.key); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                    active
                      ? "bg-indigo-600/20 text-white font-bold"
                      : "text-slate-200 hover:bg-white/[0.05] font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {renderSwatch(cat)}
                    <span style={{ color: active ? "#ffffff" : cat.textColor }} className="truncate">
                      {cat.label}
                    </span>
                  </span>
                  {active && <Check size={12} className="text-indigo-400 shrink-0" />}
                </button>
              );
            })}

            <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 border-t border-white/[0.06] mt-1">
              Origem da Classificação
            </div>

            <button
              type="button"
              role="option"
              aria-selected={isCustom}
              onClick={() => { onChange(isCustom ? "todas" : "personalizadas"); setOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                isCustom
                  ? "bg-purple-500/20 text-white font-bold"
                  : "text-purple-300 hover:bg-white/[0.05] font-medium"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs leading-none">✨</span>
                <span>Apenas Personalizadas</span>
              </span>
              {isCustom && <Check size={12} className="text-purple-400 shrink-0" />}
            </button>

            <button
              type="button"
              role="option"
              aria-selected={isPadrao}
              onClick={() => { onChange(isPadrao ? "todas" : "padrao"); setOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                isPadrao
                  ? "bg-slate-600/30 text-white font-bold"
                  : "text-slate-300 hover:bg-white/[0.05] font-medium"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs leading-none">📋</span>
                <span>Apenas Padrão</span>
              </span>
              {isPadrao && <Check size={12} className="text-slate-300 shrink-0" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClassificationContextValue {
  overrides: Map<string, CategoryKey>;
  updateClassification: (questionId: string, classification: CategoryKey | null) => Promise<void>;
  canEdit: boolean;
  classificacaoFiltro: string;
  setClassificacaoFiltro: (val: string) => void;
}

const ClassificationContext = createContext<ClassificationContextValue>({
  overrides: new Map(),
  updateClassification: async () => {},
  canEdit: false,
  classificacaoFiltro: "todas",
  setClassificacaoFiltro: () => {},
});

interface BuilderActionsContextValue {
  builderRefreshSeq: number;
  openCreateCaso: (rootBlockId: string, rootNome: string, existingCasos?: { id: string; nome: string }[]) => void;
  openCreateSubcaso: (rootBlockId: string, parentCasoId: string, parentCasoNome: string) => void;
  openCreateQuestao: (rootBlockId?: string, defaultCasoId?: string) => void;
  openEditQuestao: (rootBlockId: string, casoId: string, casoNome: string, questao: Questao) => void;
  openMoveQuestao: (rootBlockId: string, casoId: string, questao: Questao) => void;
  deleteQuestao: (rootBlockId: string, casoId: string, questao: Questao) => Promise<void>;
  deleteCaso: (rootBlockId: string, parentBlockId: string, casoId: string, casoNome: string) => Promise<void>;
}

const BuilderActionsContext = createContext<BuilderActionsContextValue>({
  builderRefreshSeq: 0,
  openCreateCaso: () => {},
  openCreateSubcaso: () => {},
  openCreateQuestao: () => {},
  openEditQuestao: () => {},
  openMoveQuestao: () => {},
  deleteQuestao: async () => {},
  deleteCaso: async () => {},
});

const CATEGORY_ORDER: Record<CategoryKey, number> = {
  faceis: 1,
  media: 2,
  atencao: 3,
  lacuna: 4,
  dificil: 5,
  ultrahard: 6,
  dominada: 0,
  treinar: 7,
  revisar: 8,
  bonus: 9,
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
  enunciadoTexto?: string;
  imageUrls: string[];
  resposta?: string;
  respostaImageUrls: string[];
  caseLabel?: string;
  lastEditedTime?: string;
  forceReload?: boolean;
  tagEmojis?: string[];
}

function sortQuestoesPorDificuldade(questions: Questao[], savedOrderIds: string[] = []): Questao[] {
  const savedOrder = new Map(savedOrderIds.map((id, index) => [id, index]));
  return [...questions].sort((a, b) => {
    const categoryDiff = (CATEGORY_ORDER[a.categoryKey] ?? 99) - (CATEGORY_ORDER[b.categoryKey] ?? 99);
    if (categoryDiff !== 0) return categoryDiff;

    const orderA = savedOrder.get(a.id);
    const orderB = savedOrder.get(b.id);
    if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;

    const numberA = Number.parseInt(a.numero || "0", 10);
    const numberB = Number.parseInt(b.numero || "0", 10);
    return numberA - numberB;
  });
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

const EMOJI_BASE = String.raw`[\u{1F000}-\u{1FAFF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{3030}\u{3297}\u{3299}]`;
const ALL_EMOJI_RE = new RegExp(`${EMOJI_BASE}(?:\\uFE0F|\\u20E3)?(?:\\u200D${EMOJI_BASE}(?:\\uFE0F|\\u20E3)?)*`, "gu");

function normalizeTagEmojiKey(emoji: string): string {
  return emoji.replace(/\uFE0F/g, "");
}

function parseQuestaoTitle(text: string): { emojis: string[]; numero: string; topic: string } {
  const t = text.trim();
  const emojis = [...t.matchAll(ALL_EMOJI_RE)].map(m => m[0]);
  const stripped = t.replace(ALL_EMOJI_RE, "").trim();
  const numM = stripped.match(/(\d+)/);
  const numero = numM ? numM[1] : "";
  const rawTopic = numM ? stripped.slice(stripped.indexOf(numM[1]) + numM[1].length).trim() : stripped;
  const topic = rawTopic.replace(/^[\s\-–—:·•]+|[\s\-–—:·•]+$/g, "").trim();
  return { emojis, numero, topic };
}

function extractQuestionTagEmojis(rawTitle: string, iconEmoji?: string, fallbackTopic?: string): string[] {
  const tags: string[] = [];
  const pushUnique = (e: string) => {
    const norm = normalizeTagEmojiKey(e);
    if (!norm) return;
    if (!tags.some(t => normalizeTagEmojiKey(t) === norm)) {
      tags.push(e);
    }
  };

  if (rawTitle) {
    const { emojis } = parseQuestaoTitle(rawTitle);
    const hasIconCat = Boolean(iconEmoji && detectCategory([iconEmoji]));
    let skippedCategoryEmoji = hasIconCat;
    for (const e of emojis) {
      if (!skippedCategoryEmoji && detectCategory([e])) {
        skippedCategoryEmoji = true;
        continue;
      }
      pushUnique(e);
    }
  } else if (fallbackTopic) {
    const topicEmojis = [...fallbackTopic.matchAll(ALL_EMOJI_RE)].map(m => m[0]);
    for (const e of topicEmojis) {
      pushUnique(e);
    }
  }
  return tags;
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

function getNotionImageFilterStyle(antiBrilho: 'suave' | 'noturno') {
  if (antiBrilho === 'noturno') {
    return {
      filter: 'invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(1.15)',
    };
  }
  return {
    filter: 'brightness(0.85) contrast(1.08)',
  };
}

function useAntiBrilhoMode() {
  const [antiBrilho, setAntiBrilho] = useState<'suave' | 'noturno'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notion_anti_brilho');
      if (saved === 'suave') return 'suave';
    }
    return 'noturno'; // Default NOTURNO (Dark tudo por padrão!)
  });

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('notion_anti_brilho');
      setAntiBrilho(saved === 'suave' ? 'suave' : 'noturno');
    };
    window.addEventListener('notion_anti_brilho_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('notion_anti_brilho_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const toggleAntiBrilho = useCallback(() => {
    setAntiBrilho(prev => {
      const next = prev === 'suave' ? 'noturno' : 'suave';
      if (typeof window !== 'undefined') {
        localStorage.setItem('notion_anti_brilho', next);
        window.dispatchEvent(new Event('notion_anti_brilho_changed'));
      }
      return next;
    });
  }, []);

  return [antiBrilho, toggleAntiBrilho] as const;
}

// Cache de alta performance (SWR: 0ms local/Supabase + revalidação silenciosa no Notion quando configurado)
const childrenCache = new Map<string, { data: NotionAPIBlock[]; timestamp: number }>();
const childrenInFlight = new Map<string, Promise<NotionAPIBlock[]>>();

function getClientNotionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("notion_user_token")?.trim() || "";
  } catch {
    return "";
  }
}

function getNotionHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getClientNotionToken();
  if (token) headers["x-notion-token"] = token;
  return headers;
}

function extractNotionBlockId(rawInput: string): string {
  const trimmed = rawInput.trim();
  const hashMatch = trimmed.match(/#([0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  const candidate = hashMatch ? hashMatch[1] : trimmed;
  const uuidMatches = candidate.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g);
  if (uuidMatches && uuidMatches.length > 0) {
    return uuidMatches[uuidMatches.length - 1].toLowerCase();
  }
  const hexMatches = candidate.match(/[0-9a-fA-F]{32}/g);
  if (hexMatches && hexMatches.length > 0) {
    const raw = hexMatches[hexMatches.length - 1].toLowerCase();
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return trimmed;
}

let serverNotionConfigured: boolean | null = null;
let notionEnabledPromise: Promise<boolean> | null = null;
async function isNotionEnabled(): Promise<boolean> {
  if (getClientNotionToken()) return true;
  if (serverNotionConfigured === true) return true;
  if (!notionEnabledPromise) {
    notionEnabledPromise = fetch("/api/notion/builder", { headers: getNotionHeaders() })
      .then(async res => {
        if (!res.ok) return false;
        const data = await res.json();
        const configured = Boolean(data?.notionConfigured);
        serverNotionConfigured = configured;
        return configured;
      })
      .catch(() => false)
      .finally(() => {
        notionEnabledPromise = null;
      });
  }
  return notionEnabledPromise;
}

function isExpiredAwsUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes("amazonaws.com") || url.includes("prod-files-secure");
}

function hasExpiredAwsUrl(urls?: string[] | null): boolean {
  return Array.isArray(urls) && urls.some(u => isExpiredAwsUrl(u));
}

const preloadedImgUrls = new Set<string>();
function preloadImageUrls(urls?: (string | undefined | null)[]) {
  if (typeof window === "undefined" || !urls || urls.length === 0) return;
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || isExpiredAwsUrl(url) || preloadedImgUrls.has(url)) continue;
    preloadedImgUrls.add(url);
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;
  }
}

const bancoIdsByRootCache = new Map<string, string[]>();
const bancoIdsByCasoCache = new Map<string, string[]>();
let bancoIdsLoadedPromise: Promise<void> | null = null;

async function ensureBancoIdsLoaded(): Promise<void> {
  if (!bancoIdsLoadedPromise) {
    bancoIdsLoadedPromise = (async () => {
      try {
        const allRows: Array<{ id: string; bloco_raiz_id: string | null; caso_id: string | null }> = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("notion_questoes_banco")
            .select("id, bloco_raiz_id, caso_id")
            .range(from, from + pageSize - 1);
          if (error || !data || data.length === 0) break;
          allRows.push(...(data as Array<{ id: string; bloco_raiz_id: string | null; caso_id: string | null }>));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        bancoIdsByRootCache.clear();
        bancoIdsByCasoCache.clear();
        for (const row of allRows) {
          if (row.bloco_raiz_id) {
            const rClean = row.bloco_raiz_id.replace(/-/g, "");
            const arr = bancoIdsByRootCache.get(rClean) ?? [];
            arr.push(row.id);
            bancoIdsByRootCache.set(rClean, arr);
          }
          if (row.caso_id) {
            const cClean = row.caso_id.replace(/-/g, "");
            const arr = bancoIdsByCasoCache.get(cClean) ?? [];
            arr.push(row.id);
            bancoIdsByCasoCache.set(cClean, arr);
          }
        }
      } catch {
        // Ignora erro silenciosamente e permite fallback no cache
      }
    })();
  }
  return bancoIdsLoadedPromise;
}

function getLocalNotionCache(key: string) {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(`notion_c_${key}`) || sessionStorage.getItem(`notion_c_${key}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function setLocalNotionCache(key: string, data: any) {
  try {
    if (typeof window !== "undefined") {
      const payload = JSON.stringify({ data, timestamp: Date.now() });
      localStorage.setItem(`notion_c_${key}`, payload);
      sessionStorage.setItem(`notion_c_${key}`, payload);
    }
  } catch (e) {}
}

function clearLocalNotionCache() {
  try {
    if (typeof window !== "undefined") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("notion_c_")) localStorage.removeItem(k);
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("notion_c_")) sessionStorage.removeItem(k);
      }
    }
  } catch (e) {}
}

async function getSupabaseNotionCache(key: string) {
  try {
    const { data, error } = await supabase
      .from("notion_cache_blocos")
      .select("data_json, updated_at")
      .eq("block_id", key)
      .maybeSingle();

    if (!error && data && data.data_json) {
      const parsedData = typeof data.data_json === "string" ? JSON.parse(data.data_json) : data.data_json;
      const timestamp = data.updated_at ? new Date(data.updated_at).getTime() : Date.now();
      return { data: parsedData, timestamp };
    }
  } catch (e) {}
  return null;
}

async function setSupabaseNotionCache(key: string, data: any) {
  try {
    await supabase.from("notion_cache_blocos").upsert(
      {
        block_id: key,
        data_json: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "block_id" }
    );
  } catch (e) {}
}

export function clearNotionClientCache() {
  childrenCache.clear();
  childrenInFlight.clear();
  fullQuestaoCache.clear();
  fullQuestaoInFlight.clear();
  questoesDoBlocoCache.clear();
  questoesDoBlocoInFlight.clear();
  questoesDetalhesCache.clear();
  questoesDetalhesInFlight.clear();
  bancoIdsLoadedPromise = null;
  bancoIdsByRootCache.clear();
  bancoIdsByCasoCache.clear();
  clearLocalNotionCache();
}

function emitNotionIdChangeAlert(alert: NotionIdChangeAlert) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("notion_id_change_alerts");
    const list: NotionIdChangeAlert[] = raw ? JSON.parse(raw) : [];
    const map = new Map<string, NotionIdChangeAlert>();
    for (const item of list) map.set(item.id, item);
    map.set(alert.id, alert);
    localStorage.setItem("notion_id_change_alerts", JSON.stringify([...map.values()]));
    window.dispatchEvent(new Event("notion-id-alerts-updated"));
  } catch {
    // ignore storage error
  }
}

async function revalidateChildrenInBackground(clean: string, force = false): Promise<NotionAPIBlock[]> {
  if (!force && childrenInFlight.has(clean)) return childrenInFlight.get(clean)!;

  if (!(await isNotionEnabled())) {
    return [];
  }

  const req = (async () => {
    try {
      const data: NotionAPIBlock[] = [];
      let cursor: string | undefined;
      let page = 0;

      do {
        const cursorParam = cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : "";
        const forceParam = force ? `&force=true&t=${Date.now()}` : "";
        const url = `/api/notion/blocks/${clean}/children?page_size=100${cursorParam}${forceParam}`;
        const res = await fetch(url, {
          headers: getNotionHeaders({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 404 || payload?.code === "object_not_found") {
            emitNotionIdChangeAlert({
              id: `missing:${clean}`,
              tipo: "bloco_removido",
              antigoId: clean,
              detectedAt: new Date().toISOString(),
              mensagem: `O bloco ${clean.slice(0, 8)} não foi encontrado no Notion (ID alterado ou bloco removido).`,
            });
          }
          throw new Error(payload?.message || payload?.error || `Notion ${res.status}`);
        }
        if (Array.isArray(payload?.results)) {
          data.push(...payload.results);
        }
        cursor = payload?.has_more && payload?.next_cursor ? String(payload.next_cursor) : undefined;
        page++;
      } while (cursor && page < 15);

      const now = Date.now();
      childrenCache.set(clean, { data, timestamp: now });
      setLocalNotionCache(clean, data);
      setSupabaseNotionCache(clean, data).catch(() => {});
      return data;
    } finally {
      childrenInFlight.delete(clean);
    }
  })();

  childrenInFlight.set(clean, req);
  return req;
}

async function unwrapNotionContainers(blocks: NotionAPIBlock[], force = false, allowNotion = true, depth = 0): Promise<NotionAPIBlock[]> {
  if (depth > 2) return blocks;
  const out: NotionAPIBlock[] = [];
  for (const b of blocks) {
    if (b.type === "column_list" || b.type === "column" || b.type === "synced_block") {
      if (b.has_children) {
        const inner = await fetchChildren(b.id, force, allowNotion).catch(() => [] as NotionAPIBlock[]);
        const unwrapped = await unwrapNotionContainers(inner, force, allowNotion, depth + 1);
        out.push(...unwrapped);
      }
    } else {
      out.push(b);
    }
  }
  return out;
}

async function fetchChildren(blockId: string, force = false, allowNotionFallback = true): Promise<NotionAPIBlock[]> {
  const clean = extractNotionBlockId(blockId).replace(/-/g, "");

  if (force) {
    childrenCache.delete(clean);
    childrenInFlight.delete(clean);
    try {
      localStorage.removeItem(`notion_c_${clean}`);
      sessionStorage.removeItem(`notion_c_${clean}`);
    } catch(e){}
    if (allowNotionFallback && await isNotionEnabled()) {
      return revalidateChildrenInBackground(clean, true);
    }
  }

  // 1. Cache de memória
  if (childrenCache.has(clean)) {
    return childrenCache.get(clean)!.data;
  }

  // 2. Cache localStorage/sessionStorage
  const local = getLocalNotionCache(clean);
  if (local && local.data && Array.isArray(local.data)) {
    childrenCache.set(clean, { data: local.data, timestamp: local.timestamp });
    return local.data;
  }

  // 3. Supabase primeiro (notion_cache_blocos) — sem chamar Notion se já existir no Supabase
  const sbCache = await getSupabaseNotionCache(clean);
  if (sbCache && sbCache.data && Array.isArray(sbCache.data)) {
    childrenCache.set(clean, { data: sbCache.data, timestamp: sbCache.timestamp });
    setLocalNotionCache(clean, sbCache.data);
    return sbCache.data;
  }

  // 4. Somente se não existir no Supabase, busca no Notion
  if (!allowNotionFallback) return [];
  return revalidateChildrenInBackground(clean);
}

interface FullQuestaoData {
  children: NotionAPIBlock[];
  imgs: string[];
  rImgs: string[];
  textEnunciado?: string;
  textResp?: string;
  foundToggleId: string | null;
}

const fullQuestaoCache = new Map<string, { data: FullQuestaoData; timestamp: number }>();
const fullQuestaoInFlight = new Map<string, Promise<FullQuestaoData>>();

async function buildQuestaoFullData(
  clean: string,
  force = false,
  allowNotionFallback = true
): Promise<FullQuestaoData> {
  const children = await fetchChildren(clean, force, allowNotionFallback);
  const imgs: string[] = [];
  const rImgs: string[] = [];
  const enunciadoTexts: string[] = [];
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
    } else {
      const t = richText(
        child.paragraph?.rich_text ??
        child.bulleted_list_item?.rich_text ??
        child.numbered_list_item?.rich_text ??
        child.callout?.rich_text ??
        child.quote?.rich_text ??
        child.heading_1?.rich_text ??
        child.heading_2?.rich_text ??
        child.heading_3?.rich_text ??
        []
      );
      if (t) enunciadoTexts.push(t);
    }
  }
  const textEnunciado = enunciadoTexts.join("\n") || undefined;

  const togglePromises = children
    .filter(child => {
      if (child.type !== "toggle" || !child.has_children) return false;
      const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
      return tText.includes("resposta");
    })
    .map(async child => {
      const rChildren = await fetchChildren(child.id, force, allowNotionFallback);
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

  const result: FullQuestaoData = { children, imgs, rImgs, textEnunciado, textResp, foundToggleId };
  const now = Date.now();
  fullQuestaoCache.set(clean, { data: result, timestamp: now });
  if (hasFullQuestaoContent(result) && !isFullQuestaoExpired(result)) {
    setLocalNotionCache(`qfull_${clean}`, result);
    setSupabaseNotionCache(`qfull_${clean}`, result).catch(() => {});
  }
  return result;
}

async function revalidateQuestaoFullData(clean: string, force = false): Promise<FullQuestaoData> {
  if (!force && fullQuestaoInFlight.has(clean)) return fullQuestaoInFlight.get(clean)!;

  const promise = buildQuestaoFullData(clean, force, true)
    .finally(() => {
      fullQuestaoInFlight.delete(clean);
    });

  fullQuestaoInFlight.set(clean, promise);
  return promise;
}

async function getQuestaoFromBancoTable(id: string): Promise<FullQuestaoData | null> {
  try {
    const clean = id.replace(/-/g, "");
    const { data, error } = await supabase
      .from("notion_questoes_banco")
      .select("*")
      .or(`id.eq.${id},id.eq.${clean}`)
      .maybeSingle();

    if (!error && data) {
      const imgs = Array.isArray(data.imagens_urls) ? data.imagens_urls : [];
      const rImgs = Array.isArray(data.gabarito_imagens_urls) ? data.gabarito_imagens_urls : [];
      const textEnunciado = data.enunciado_texto || undefined;
      const textResp = data.gabarito_texto || undefined;
      return {
        children: [],
        imgs,
        rImgs,
        textEnunciado,
        textResp,
        foundToggleId: null,
      };
    }
  } catch (e) {}
  return null;
}

function isFullQuestaoExpired(data?: FullQuestaoData | null): boolean {
  if (!data) return false;
  return hasExpiredAwsUrl(data.imgs) || hasExpiredAwsUrl(data.rImgs);
}

function hasFullQuestaoContent(data?: FullQuestaoData | null): boolean {
  if (!data) return false;
  return data.imgs.length > 0 || data.rImgs.length > 0 || Boolean(data.textResp) || Boolean(data.textEnunciado);
}

async function fetchQuestaoFullData(blockId: string, force = false): Promise<FullQuestaoData> {
  const normalizedId = extractNotionBlockId(blockId);
  const clean = normalizedId.replace(/-/g, "");
  const now = Date.now();

  if (force) {
    fullQuestaoCache.delete(clean);
    fullQuestaoInFlight.delete(clean);
    try {
      localStorage.removeItem(`notion_c_qfull_${clean}`);
      sessionStorage.removeItem(`notion_c_qfull_${clean}`);
      localStorage.removeItem(`notion_c_${clean}`);
      sessionStorage.removeItem(`notion_c_${clean}`);
    } catch {}
    supabase.from("notion_cache_blocos").delete().in("block_id", [`qfull_${clean}`, clean]).then(() => {}, () => {});
  }

  // 1. Cache de memória da sessão (somente se não for force e sem URLs AWS expiradas)
  if (!force && fullQuestaoCache.has(clean)) {
    const cached = fullQuestaoCache.get(clean)!;
    if (!isFullQuestaoExpired(cached.data)) {
      return cached.data;
    }
  }

  if (!force && fullQuestaoInFlight.has(clean)) {
    return fullQuestaoInFlight.get(clean)!;
  }

  const loadPromise = (async (): Promise<FullQuestaoData> => {
    // 2. Notion primeiro com timeout de 3s; se demorar >3s ou falhar, cai para o Supabase
    if (await isNotionEnabled()) {
      const notionPromise = revalidateQuestaoFullData(clean, true).catch(() => null);
      const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
      const notionRes = await Promise.race([notionPromise, timeoutPromise]);
      if (notionRes !== null && (notionRes.children.length > 0 || hasFullQuestaoContent(notionRes))) {
        return notionRes;
      }
    }

    // 3. Fallback Supabase: tabela estruturada notion_questoes_banco
    const bancoQuestao = await getQuestaoFromBancoTable(normalizedId);
    if (bancoQuestao && hasFullQuestaoContent(bancoQuestao) && !isFullQuestaoExpired(bancoQuestao)) {
      fullQuestaoCache.set(clean, { data: bancoQuestao, timestamp: now });
      setLocalNotionCache(`qfull_${clean}`, bancoQuestao);
      return bancoQuestao;
    }

    // 4. Fallback localStorage / Supabase notion_cache_blocos (qfull_<clean>)
    const local = getLocalNotionCache(`qfull_${clean}`);
    if (local && local.data && hasFullQuestaoContent(local.data) && !isFullQuestaoExpired(local.data)) {
      fullQuestaoCache.set(clean, { data: local.data, timestamp: local.timestamp });
      return local.data;
    }

    const sbCache = await getSupabaseNotionCache(`qfull_${clean}`);
    if (sbCache && sbCache.data && hasFullQuestaoContent(sbCache.data) && !isFullQuestaoExpired(sbCache.data)) {
      fullQuestaoCache.set(clean, { data: sbCache.data, timestamp: sbCache.timestamp });
      setLocalNotionCache(`qfull_${clean}`, sbCache.data);
      return sbCache.data;
    }

    // 5. Fallback Supabase cache bruto de blocos
    const rawFromSb = await buildQuestaoFullData(clean, false, false);
    if (hasFullQuestaoContent(rawFromSb) && !isFullQuestaoExpired(rawFromSb)) {
      return rawFromSb;
    }

    const fallback = bancoQuestao ?? sbCache?.data ?? local?.data ?? rawFromSb ?? {
      children: [],
      imgs: [],
      rImgs: [],
      textEnunciado: undefined,
      textResp: undefined,
      foundToggleId: null,
    };
    fullQuestaoCache.set(clean, { data: fallback, timestamp: now });
    return fallback;
  })().finally(() => {
    fullQuestaoInFlight.delete(clean);
  });

  fullQuestaoInFlight.set(clean, loadPromise);
  return loadPromise;
}


// Cache de informações resolvidas individualmente (usado pelo painel de desempenho,
// que recebe apenas IDs de questão vindos do Supabase, sem a árvore carregada)
interface QuestaoInfo { title: string; emoji?: string; blocoNome?: string }
const questaoInfoCache = new Map<string, QuestaoInfo>();

async function fetchNotionBlock(id: string): Promise<NotionAPIBlock> {
  const clean = extractNotionBlockId(id);
  const res = await fetch(`/api/notion/blocks/${clean}`, { headers: getNotionHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 || data?.code === "object_not_found") {
      emitNotionIdChangeAlert({
        id: `missing:${clean.replace(/-/g, "")}`,
        tipo: "bloco_removido",
        antigoId: clean,
        detectedAt: new Date().toISOString(),
        mensagem: `O bloco ${clean.slice(0, 8)} não foi encontrado no Notion (ID alterado ou removido).`,
      });
    }
    throw new Error(data?.message || data?.error || `Notion ${res.status}`);
  }
  return data;
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
const questoesDoBlocoInFlight = new Map<string, Promise<string[]>>();

function getChildBlockTitle(child: NotionAPIBlock): string {
  return (
    richText(child.toggle?.rich_text) ||
    richText(child.heading_1?.rich_text) ||
    richText(child.heading_2?.rich_text) ||
    richText(child.heading_3?.rich_text) ||
    richText(child.callout?.rich_text) ||
    richText(child.bulleted_list_item?.rich_text) ||
    richText(child.numbered_list_item?.rich_text) ||
    richText(child.paragraph?.rich_text) ||
    child.child_page?.title ||
    ""
  );
}

function isNavigableNotionContainer(child: NotionAPIBlock): boolean {
  if (child.type === "toggle" || child.type === "child_page") return true;
  return Boolean(
    child.has_children &&
      (child.type === "heading_1" ||
        child.type === "heading_2" ||
        child.type === "heading_3" ||
        child.type === "callout" ||
        child.type === "bulleted_list_item" ||
        child.type === "numbered_list_item")
  );
}

async function revalidateQuestaoIds(rootBlockId: string, force = false): Promise<string[]> {
  const clean = extractNotionBlockId(rootBlockId).replace(/-/g, "");
  const ids: string[] = [];

  async function walk(blockId: string) {
    const rawChildren = await fetchChildren(blockId, force, true);
    const children = await unwrapNotionContainers(rawChildren, force, true);
    const promises: Promise<void>[] = [];
    for (const child of children) {
      if (!isNavigableNotionContainer(child)) continue;
      const rawTitle = getChildBlockTitle(child);
      if (rawTitle.toLowerCase().includes("resposta")) continue;
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
  setLocalNotionCache(`ids_${clean}`, ids);
  if (ids.length > 0) {
    setSupabaseNotionCache(`ids_${clean}`, ids).catch(() => {});
  }
  return ids;
}

async function getIdsFromBancoTable(targetId: string): Promise<string[] | null> {
  try {
    await ensureBancoIdsLoaded();
    const clean = extractNotionBlockId(targetId).replace(/-/g, "");
    const byRoot = bancoIdsByRootCache.get(clean);
    if (byRoot && byRoot.length > 0) return byRoot;
    const byCaso = bancoIdsByCasoCache.get(clean);
    if (byCaso && byCaso.length > 0) return byCaso;
  } catch (e) {}
  return null;
}

async function collectQuestaoIds(rootBlockId: string, force = false): Promise<string[]> {
  const clean = extractNotionBlockId(rootBlockId).replace(/-/g, "");

  if (force) {
    questoesDoBlocoCache.delete(clean);
    questoesDoBlocoInFlight.delete(clean);
    try {
      localStorage.removeItem(`notion_c_ids_${clean}`);
      sessionStorage.removeItem(`notion_c_ids_${clean}`);
    } catch(e){}
    if (await isNotionEnabled()) {
      return revalidateQuestaoIds(rootBlockId, true);
    }
  }

  if (questoesDoBlocoCache.has(clean)) {
    return questoesDoBlocoCache.get(clean)!;
  }

  const local = getLocalNotionCache(`ids_${clean}`);
  if (local && local.data && Array.isArray(local.data) && local.data.length > 0) {
    questoesDoBlocoCache.set(clean, local.data);
    return local.data;
  }

  if (!force && questoesDoBlocoInFlight.has(clean)) {
    return questoesDoBlocoInFlight.get(clean)!;
  }

  const loadPromise = (async (): Promise<string[]> => {
    // 1. Supabase primeiro: tabela estruturada notion_questoes_banco (1 query em lote)
    const bancoIds = await getIdsFromBancoTable(rootBlockId);
    if (bancoIds && bancoIds.length > 0) {
      questoesDoBlocoCache.set(clean, bancoIds);
      setLocalNotionCache(`ids_${clean}`, bancoIds);
      return bancoIds;
    }

    // 2. Supabase cache pré-calculado (notion_cache_blocos)
    const sbCache = await getSupabaseNotionCache(`ids_${clean}`);
    if (sbCache && sbCache.data && Array.isArray(sbCache.data)) {
      questoesDoBlocoCache.set(clean, sbCache.data);
      setLocalNotionCache(`ids_${clean}`, sbCache.data);
      return sbCache.data;
    }

    // 3. Somente se não houver no Supabase, varre árvore (e busca do Notion se faltar)
    return revalidateQuestaoIds(rootBlockId, false);
  })().finally(() => {
    questoesDoBlocoInFlight.delete(clean);
  });

  questoesDoBlocoInFlight.set(clean, loadPromise);
  return loadPromise;
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
const questoesDetalhesInFlight = new Map<string, Promise<QuestaoDetalhesResult>>();

async function getDetailsFromBancoTable(rootBlockId: string): Promise<QuestaoDetalhesResult | null> {
  try {
    const clean = extractNotionBlockId(rootBlockId).replace(/-/g, "");
    const { data, error } = await supabase
      .from("notion_questoes_banco")
      .select("id, numero, topico, categoria, caso_nome")
      .or(`bloco_raiz_id.eq.${rootBlockId},bloco_raiz_id.eq.${clean}`);

    if (!error && data && data.length > 0) {
      const itens: QuestaoResumo[] = data.map((d: any) => ({
        id: d.id,
        numero: d.numero || "",
        topic: d.topico || "",
        categoryKey: (d.categoria || "media") as CategoryKey,
        caseLabel: d.caso_nome || "Geral",
      }));
      const caseIcons: Record<string, string> = {};
      return { itens, caseIcons };
    }
  } catch (e) {}
  return null;
}

async function revalidateQuestaoDetails(rootBlockId: string, force = false): Promise<QuestaoDetalhesResult> {
  const clean = extractNotionBlockId(rootBlockId).replace(/-/g, "");
  const itens: QuestaoResumo[] = [];
  const caseIcons: Record<string, string> = {};

  async function walk(blockId: string, parentLabel: string) {
    const rawChildren = await fetchChildren(blockId, force, true);
    const children = await unwrapNotionContainers(rawChildren, force, true);
    const promises: Promise<void>[] = [];
    for (const child of children) {
      if (!isNavigableNotionContainer(child)) continue;
      const rawTitle = getChildBlockTitle(child);
      if (rawTitle.toLowerCase().includes("resposta")) continue;
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
  setLocalNotionCache(`det_${clean}`, result);
  if (itens.length > 0) {
    setSupabaseNotionCache(`det_${clean}`, result).catch(() => {});
  }
  return result;
}

async function collectQuestaoDetails(rootBlockId: string, force = false): Promise<QuestaoDetalhesResult> {
  const clean = extractNotionBlockId(rootBlockId).replace(/-/g, "");

  if (force) {
    questoesDetalhesCache.delete(clean);
    questoesDetalhesInFlight.delete(clean);
    try {
      localStorage.removeItem(`notion_c_det_${clean}`);
      sessionStorage.removeItem(`notion_c_det_${clean}`);
    } catch(e){}
    if (await isNotionEnabled()) {
      return revalidateQuestaoDetails(rootBlockId, true);
    }
  }

  if (questoesDetalhesCache.has(clean)) {
    return questoesDetalhesCache.get(clean)!;
  }

  const local = getLocalNotionCache(`det_${clean}`);
  if (local && local.data && Array.isArray(local.data.itens) && local.data.itens.length > 0) {
    questoesDetalhesCache.set(clean, local.data);
    return local.data;
  }

  if (!force && questoesDetalhesInFlight.has(clean)) {
    return questoesDetalhesInFlight.get(clean)!;
  }

  const loadPromise = (async (): Promise<QuestaoDetalhesResult> => {
    // 1. Supabase primeiro: tabela estruturada notion_questoes_banco
    const bancoDetails = await getDetailsFromBancoTable(rootBlockId);
    if (bancoDetails && bancoDetails.itens.length > 0) {
      questoesDetalhesCache.set(clean, bancoDetails);
      setLocalNotionCache(`det_${clean}`, bancoDetails);
      return bancoDetails;
    }

    // 2. Supabase cache pré-calculado (notion_cache_blocos)
    const sbCache = await getSupabaseNotionCache(`det_${clean}`);
    if (sbCache && sbCache.data) {
      questoesDetalhesCache.set(clean, sbCache.data);
      setLocalNotionCache(`det_${clean}`, sbCache.data);
      return sbCache.data;
    }

    // 3. Somente se não houver no Supabase, varrer e buscar no Notion
    return revalidateQuestaoDetails(rootBlockId);
  })().finally(() => {
    questoesDetalhesInFlight.delete(clean);
  });

  questoesDetalhesInFlight.set(clean, loadPromise);
  return loadPromise;
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
    <div className="flex items-center gap-2 py-1.5 px-2 text-[11px] rounded-md hover:bg-white/[0.03] transition-colors">
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
  imageUrls,
  enunciadoText,
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
  imageUrls?: string[];
  enunciadoText?: string;
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
  const touchStateRef = useRef<{ x: number; y: number; startX: number; startY: number; panning: boolean }>({
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    panning: false,
  });

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<'acerto' | 'erro' | null>(null);
  const [recordingDuvida, setRecordingDuvida] = useState(false);
  const [localDuvida, setLocalDuvida] = useState(isDuvida);

  const [antiBrilho, toggleAntiBrilho] = useAntiBrilhoMode();

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
      return 'bg-[#0b101d] border border-white/10';
    }
    return 'bg-slate-900/95 border border-slate-700/60';
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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStateRef.current = {
      x: t.clientX,
      y: t.clientY,
      startX: t.clientX - position.x,
      startY: t.clientY - position.y,
      panning: scale > 1 || isFullWidth,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (touchStateRef.current.panning) {
      const t = e.touches[0];
      setPosition({
        x: t.clientX - touchStateRef.current.startX,
        y: t.clientY - touchStateRef.current.startY,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStateRef.current.panning || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStateRef.current.x;
    const dy = t.clientY - touchStateRef.current.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && hasNext && onNext) onNext();
      else if (dx > 0 && hasPrev && onPrev) onPrev();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-[#05080f]/95 flex flex-col items-center justify-between select-none"
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
    >
      {/* Top Bar Controls */}
      <div className="w-full px-2 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 bg-[#070b14] border-b border-white/10 z-30 overflow-hidden" style={{ minHeight: 44 }}>
        {/* Left Info — shrink aggressively */}
        <div className="flex items-center gap-1.5 text-white font-bold text-xs shrink min-w-0 overflow-hidden">
          <Maximize2 size={14} className="text-indigo-400 shrink-0 hidden sm:block" />
          <span className="truncate max-w-[78px] sm:max-w-xs">
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
        <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 p-1 rounded-xl border border-white/10 shrink-0 overflow-x-auto no-scrollbar max-w-[calc(100vw-170px)] sm:max-w-none">
          {hasPrev && onPrev && (
            <button
              onClick={onPrev}
              title="Questão Anterior (←)"
              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-colors text-xs font-bold flex items-center gap-1 shrink-0"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          <button
            onClick={handleZoomOut}
            title="Diminuir zoom (-)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <ZoomOut size={14} />
          </button>

          <span className="text-[11px] font-mono font-bold text-slate-200 px-1 min-w-[36px] text-center shrink-0">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            title="Aumentar zoom (+)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <ZoomIn size={14} />
          </button>

          <div className="w-px h-5 bg-white/20 my-auto mx-0.5 shrink-0" />

          {/* Modo Ajustado / 100% Tela Cheia */}
          <button
            onClick={toggleFullWidth}
            title="Alternar Modo de Visualização (Tecla F)"
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 ${
              !isFullWidth
                ? "bg-indigo-600 text-white border border-indigo-400/40"
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
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border shrink-0 ${
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
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <RotateCcw size={12} />
          </button>

          {hasNext && onNext && (
            <button
              onClick={onNext}
              title="Próxima Questão (→)"
              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white border border-indigo-500/40 transition-colors text-xs font-bold flex items-center gap-1 shrink-0"
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
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border shrink-0 ${
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
            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>


      {/* Main Image View & Side-by-Side Split Screen Answer Panel Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col md:flex-row items-center justify-between min-h-0">
        {/* Left/Top Question Image Container */}
        <div
          className={`relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-2 sm:p-4 min-w-0 min-h-0 ${
            scale > 1 || isFullWidth ? "touch-none" : "touch-pan-y"
          } ${
            showResposta
              ? "w-full h-1/2 border-b md:border-b-0 md:h-full md:w-1/2 md:border-r border-white/10"
              : "w-full h-full flex-1"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Floating Side Arrows for Next/Prev (Desktop/Tablet) */}
          {hasPrev && onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              title="Questão Anterior (←)"
              className="hidden sm:flex absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-200 hover:text-white items-center justify-center border border-slate-700 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {hasNext && onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              title="Próxima Questão (→)"
              className="hidden sm:flex absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-200 hover:text-white items-center justify-center border border-slate-700 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-slate-900/95 border border-white/10">
              <Loader2 size={36} className="animate-spin text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Carregando questão...</span>
            </div>
          ) : (() => {
            const allImgs = (imageUrls && imageUrls.length > 0 ? imageUrls : url ? [url] : []).filter(u => u && u.trim() !== "");
            const hasText = Boolean(enunciadoText && enunciadoText.trim() !== "");
            if (!hasText && allImgs.length === 0) {
              return (
                <div className="text-slate-400 italic text-xs bg-slate-900/80 px-4 py-3 rounded-xl border border-white/10">
                  Sem enunciado ou imagem registrada para esta questão
                </div>
              );
            }
            if (hasText && allImgs.length === 0) {
              return (
                <div className="max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar p-6 sm:p-8 rounded-2xl bg-[#0d1323] border border-white/10 select-text">
                  <p className="text-sm sm:text-base text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {enunciadoText}
                  </p>
                </div>
              );
            }
            return (
              <div className={`w-full h-full flex flex-col items-center ${hasText || allImgs.length > 1 ? "overflow-y-auto custom-scrollbar gap-4 py-4 px-2" : "justify-center"}`}>
                {hasText && (
                  <div className="max-w-3xl w-full p-4 sm:p-5 rounded-2xl bg-[#0d1323] border border-white/10 shrink-0 select-text">
                    <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                      {enunciadoText}
                    </p>
                  </div>
                )}
                {allImgs.map((imgSrc, idx) => (
                  <img
                    key={`${imgSrc}-${idx}`}
                    src={imgSrc.trim()}
                    alt={`Imagem da questão ${idx + 1}`}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    style={
                      allImgs.length === 1 && !hasText
                        ? {
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            ...getImageFilterStyle(),
                          }
                        : getImageFilterStyle()
                    }
                    className={`${getImageCardBgClass()} rounded-xl object-contain ${
                      allImgs.length > 1 || hasText
                        ? "max-w-[92%] max-h-[70vh]"
                        : showResposta
                        ? "max-w-[95%] max-h-[82vh]"
                        : isFullWidth
                        ? "w-full h-full max-w-none max-h-none"
                        : "max-w-[95vw] max-h-[85vh]"
                    }`}
                  />
                ))}
              </div>
            );
          })()}
        </div>

        {/* Right/Bottom Answer Screen Panel */}
        {showResposta && (
          <div className="w-full h-1/2 md:h-full md:w-1/2 flex-1 bg-[#0b101d] p-3.5 sm:p-6 z-40 text-white flex flex-col gap-3 sm:gap-4 overflow-y-auto custom-scrollbar shrink-0 min-w-0 border-t md:border-t-0 md:border-l border-white/10">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-white/10 shrink-0 gap-2">
              <span className="text-xs sm:text-base font-bold text-emerald-400 flex items-center gap-1.5 sm:gap-2 truncate">
                <span>✨</span> Resposta e Gabarito {questaoNumero ? `— Q${questaoNumero}` : ""}
              </span>
              <button
                onClick={() => setShowResposta(false)}
                className="text-slate-400 hover:text-white text-xs p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
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
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    style={getImageFilterStyle()}
                    className={`w-full rounded-xl border border-white/10 object-contain max-h-[55vh] ${
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 border ${
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
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-emerald-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Check size={14} className="text-emerald-400" /> Acertei
                </button>
                <button
                  onClick={() => handleRecordAnswer(false)}
                  disabled={recording}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <X size={14} className="text-rose-400" /> Errei
                </button>

                {recorded && (
                  <span className={`text-xs font-bold ml-1 ${recorded === 'acerto' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {recorded === 'acerto' ? 'Salvo! 🎉' : 'Salvo! ❌'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="hidden sm:flex w-full px-4 py-2 bg-[#070b14] border-t border-white/5 text-[11px] text-slate-400 font-medium z-20 items-center justify-center gap-3 sm:gap-6 text-center flex-wrap">
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
  const getCachedZoomData = useCallback((q: Questao) => {
    const cached = fullQuestaoCache.get(q.id.replace(/-/g, ""))?.data;
    const validCached = cached && !isFullQuestaoExpired(cached) ? cached : undefined;
    const imgs = (q.imageUrls && q.imageUrls.length > 0)
      ? q.imageUrls
      : (validCached?.imgs && validCached.imgs.length > 0)
      ? validCached.imgs
      : initialUrl ? [initialUrl] : [];
    const textEnunc = q.enunciadoTexto || validCached?.textEnunciado;
    const rImgs = (q.respostaImageUrls && q.respostaImageUrls.length > 0)
      ? q.respostaImageUrls
      : (validCached?.rImgs && validCached.rImgs.length > 0)
      ? validCached.rImgs
      : initialRespostaImageUrls ?? [];
    const textResp = q.resposta || validCached?.textResp || initialRespostaText;
    return { imgs, textEnunc, rImgs, textResp, hasFullCache: Boolean(validCached && hasFullQuestaoContent(validCached)) };
  }, [initialUrl, initialRespostaImageUrls, initialRespostaText]);

  const initialSeed = getCachedZoomData(questao);
  const [imageUrls, setImageUrls] = useState<string[]>(initialSeed.imgs);
  const [enunciadoText, setEnunciadoText] = useState<string | undefined>(initialSeed.textEnunc);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>(initialSeed.rImgs);
  const [respostaText, setRespostaText] = useState<string | undefined>(initialSeed.textResp);
  const [loading, setLoading] = useState<boolean>(initialSeed.imgs.length === 0 && !initialSeed.textEnunc);

  useEffect(() => {
    let active = true;
    const seed = getCachedZoomData(questao);

    setImageUrls(seed.imgs);
    setEnunciadoText(seed.textEnunc);
    setRespostaImageUrls(seed.rImgs);
    setRespostaText(seed.textResp);
    preloadImageUrls(seed.imgs);
    preloadImageUrls(seed.rImgs);

    const alreadyHasCompleteData =
      seed.hasFullCache ||
      ((seed.imgs.length > 0 || Boolean(seed.textEnunc)) && (seed.rImgs.length > 0 || Boolean(seed.textResp)));

    if (alreadyHasCompleteData) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(seed.imgs.length === 0 && !seed.textEnunc);

    fetchQuestaoFullData(questao.id).then(result => {
      if (!active) return;
      if (result.imgs.length > 0) {
        setImageUrls(result.imgs);
        preloadImageUrls(result.imgs);
      }
      if (result.textEnunciado) setEnunciadoText(result.textEnunciado);
      if (result.rImgs.length > 0) {
        setRespostaImageUrls(result.rImgs);
        preloadImageUrls(result.rImgs);
      }
      if (result.textResp) setRespostaText(result.textResp);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [questao, getCachedZoomData]);


  const mainUrl = imageUrls[0] || initialUrl || "";

  return (
    <ImagemLightbox
      url={mainUrl}
      imageUrls={imageUrls}
      enunciadoText={enunciadoText}
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
  rootBlockId,
  casoId,
  casoNome,
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
  rootBlockId?: string;
  casoId?: string;
  casoNome?: string;
}) {
  const { overrides, updateClassification, canEdit: canEditClassification, classificacaoFiltro } = useContext(ClassificationContext);
  const builder = useContext(BuilderActionsContext);
  const classification = overrides.get(questao.id) ?? null;
  const displayedCategory = classification ?? questao.categoryKey;
  const [antiBrilho] = useAntiBrilhoMode();
  const [open, setOpen] = useState(startOpen);
  const [showResp, setShowResp] = useState(false);
  const [enunciadoTexto, setEnunciadoTexto] = useState<string | undefined>(questao.enunciadoTexto);
  const [imageUrls, setImageUrls] = useState<string[]>(questao.imageUrls ?? []);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomTextOnly, setZoomTextOnly] = useState(false);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>(questao.respostaImageUrls ?? []);
  const [respostaText, setRespostaText] = useState<string | undefined>(questao.resposta);
  const [respostaToggleId, setRespostaToggleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

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
    lacuna: "⛳",
    media: "🟠",
    dificil: "🔴",
    ultrahard: "🟣",
    dominada: "🏆",
    treinar: "🧠",
    revisar: "🔁",
  };

  const catEmoji = emojiMap[displayedCategory] || "🟢";
  const categoryInfo = CATEGORIES.find(c => c.key === displayedCategory);
  const catLabel = categoryInfo?.label || "Geral";
  const catColor = categoryInfo?.textColor || "#94a3b8";

  const hasInlineData = (q: Questao) =>
    (q.imageUrls?.length ?? 0) > 0 ||
    Boolean(q.enunciadoTexto?.trim()) ||
    (q.respostaImageUrls?.length ?? 0) > 0 ||
    Boolean(q.resposta?.trim());

  const [loaded, setLoaded] = useState(() => hasInlineData(questao));
  const prevQuestaoIdRef = useRef(questao.id);

  useEffect(() => {
    const idChanged = prevQuestaoIdRef.current !== questao.id;
    prevQuestaoIdRef.current = questao.id;
    if (idChanged || hasInlineData(questao)) {
      setEnunciadoTexto(questao.enunciadoTexto);
      setImageUrls(questao.imageUrls ?? []);
      setRespostaText(questao.resposta);
      setRespostaImageUrls(questao.respostaImageUrls ?? []);
      setLoaded(hasInlineData(questao));
    }
  }, [questao]);

  useEffect(() => {
    if (!open || loaded || loadingRef.current) return;
    let active = true;
    loadingRef.current = true;
    setLoading(true);
    fetchQuestaoFullData(questao.id, Boolean(questao.forceReload)).then(result => {
      if (!active) return;
      setImageUrls(result.imgs);
      if (result.textEnunciado) setEnunciadoTexto(result.textEnunciado);
      setRespostaImageUrls(result.rImgs);
      setRespostaText(result.textResp);
      setRespostaToggleId(result.foundToggleId);
      preloadImageUrls(result.imgs);
      preloadImageUrls(result.rImgs);
      setLoaded(true);

      // Se carregou direto do Notion e temos o caminho raiz/caso, registra/atualiza no Supabase
      if (rootBlockId && result.children && result.children.length > 0) {
        const cleanRoot = extractNotionBlockId(rootBlockId).replace(/-/g, "");
        supabase.from("notion_questoes_banco").upsert({
          id: questao.id,
          bloco_raiz_id: rootBlockId,
          caso_id: casoId || null,
          caso_nome: casoNome || questao.caseLabel || "Geral",
          numero: questao.numero || "",
          topico: questao.tagEmojis && questao.tagEmojis.length > 0
            ? `${questao.topic ? `${questao.topic} ` : ""}${questao.tagEmojis.join(" ")}`.trim()
            : (questao.topic || ""),
          categoria: questao.categoryKey || "media",
          enunciado_texto: result.textEnunciado || null,
          imagens_urls: result.imgs,
          gabarito_texto: result.textResp || null,
          gabarito_imagens_urls: result.rImgs,
          notion_last_edited_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" }).then(() => {
          bancoIdsLoadedPromise = null;
          questoesDoBlocoCache.delete(cleanRoot);
          questoesDetalhesCache.delete(cleanRoot);
        }, () => {});
      }
    }).catch(e => {
      console.error("Erro ao carregar detalhes da questão:", e);
    }).finally(() => {
      loadingRef.current = false;
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      loadingRef.current = false;
    };
  }, [open, questao.id, questao.forceReload, loaded, rootBlockId, casoId, casoNome, questao.numero, questao.topic, questao.categoryKey, questao.caseLabel]);

  const handlePrefetchQuestao = useCallback(() => {
    preloadImageUrls(questao.imageUrls);
    preloadImageUrls(questao.respostaImageUrls);
    if (!loaded) {
      fetchQuestaoFullData(questao.id).then(result => {
        preloadImageUrls(result.imgs);
        preloadImageUrls(result.rImgs);
      }).catch(() => {});
    }
  }, [questao.id, questao.imageUrls, questao.respostaImageUrls, loaded]);


  const isErro = stats?.ultimo === "erro";
  const isAcerto = stats?.ultimo === "acerto";
  const isRespondida = !!stats;
  const isFeitaHoje = feitasHojeIds.includes(questao.id);

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  if (effectiveStatus === "erros" && !isErro) return null;
  if (effectiveStatus === "mais_erros" && (stats?.totalErros ?? 0) === 0) return null;
  if (effectiveStatus === "nao_feitas" && isRespondida) return null;
  if (effectiveStatus === "feitas_hoje" && !isFeitaHoje) return null;

  if (classificacaoFiltro && classificacaoFiltro !== "todas") {
    if (classificacaoFiltro === "personalizadas" && !overrides.has(questao.id)) return null;
    if (classificacaoFiltro === "padrao" && overrides.has(questao.id)) return null;
    if (classificacaoFiltro !== "personalizadas" && classificacaoFiltro !== "padrao" && displayedCategory !== classificacaoFiltro) return null;
  }

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
  const bgClass = diffBgClasses[displayedCategory] || "hover:bg-white/[0.03]";

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
      className={`flex flex-col py-0 rounded-md ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div
        onMouseEnter={handlePrefetchQuestao}
        className={`flex flex-wrap sm:flex-nowrap items-center gap-x-1.5 gap-y-1 py-1.5 sm:py-[2px] px-2 min-h-[34px] sm:min-h-[24px] rounded-md group ${
        showHighlightStyle ? "bg-rose-500/[0.05]" : bgClass
      }`}>
        {isAdmin && (
          <span 
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-indigo-400 transition-colors shrink-0 select-none" 
            title="Arrastar para reordenar questão"
          >
            <GripVertical size={11} />
          </span>
        )}

        <button
          onClick={() => { setOpen(v => !v); setShowResp(false); }}
          className="text-slate-500 hover:text-slate-300 w-6 h-6 sm:w-3.5 sm:h-3.5 flex items-center justify-center shrink-0"
        >
          {loading && imageUrls.filter(u => u && u.trim() !== "").length === 0 ? (
            <Loader2 size={10} className="animate-spin text-slate-500" />
          ) : (
            <ChevronRight size={11} className={`text-slate-500 shrink-0 ${open ? "rotate-90" : ""}`} />
          )}
        </button>

        <span className="text-[10px] font-normal text-slate-400 bg-white/[0.04] border border-white/[0.07] px-1.5 py-0 rounded leading-[18px] sm:leading-[16px] shrink-0 tabular-nums">
          {questao.numero}
        </span>

        <span className="w-1.5 h-1.5 rounded-full shrink-0 select-none shadow-sm" style={{ backgroundColor: catColor }} title={catLabel} />

        <span
          className="text-[10px] font-normal px-1.5 py-0 leading-[18px] sm:leading-[16px] rounded bg-black/20 border border-white/[0.06] shrink-0"
          style={{ color: catColor }}
        >
          {catLabel}
        </span>

        <select
          aria-label={`Classificação pessoal da questão ${questao.numero}`}
          title={canEditClassification ? "Classificar questão para sua conta" : "Entre na conta para salvar sua classificação"}
          disabled={!canEditClassification}
          value={classification ?? ""}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value as CategoryKey | "";
            void updateClassification(questao.id, value || null);
          }}
          className="h-6 sm:h-[18px] max-w-[92px] sm:max-w-[100px] rounded border border-white/[0.08] bg-[#0b1019] px-1 py-0 text-[9.5px] leading-none text-slate-300 outline-none focus:border-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Padrão</option>
          {CATEGORIES.map(category => (
            <option key={category.key} value={category.key}>{category.label}</option>
          ))}
        </select>

        {questao.tagEmojis && questao.tagEmojis.length > 0 && (
          <span
            className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] leading-[15px] shrink-0"
            title="Questões com este mesmo emoji compartilham a mesma resolução e raciocínio"
          >
            {questao.tagEmojis.map((em, i) => (
              <span key={`${em}-${i}`}>{em}</span>
            ))}
          </span>
        )}

        {questao.topic && (
          <span className="text-[11px] sm:text-[11.5px] font-normal text-slate-300 leading-tight truncate ml-0.5 basis-full sm:basis-auto order-last sm:order-none min-w-0">
            — {questao.topic}
          </span>
        )}

        {questao.caseLabel && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0 leading-[15px] rounded-full bg-slate-800/40 border border-slate-700/50 text-[9.5px] font-medium text-slate-400 truncate shrink-0 ml-0.5 sm:ml-1 max-w-[130px] sm:max-w-none">
            <span className="text-slate-600 font-normal">in</span> {questao.caseLabel}
          </span>
        )}

        {isDuvida && (
          <Flag size={10} className="fill-red-500 text-red-500 shrink-0 ml-1" />
        )}

        {rootBlockId && casoId && (
          <div className="flex items-center gap-0.5 opacity-90 sm:opacity-45 sm:group-hover:opacity-100 ml-auto mr-0.5 sm:mr-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                builder.openMoveQuestao(rootBlockId, casoId, {
                  ...questao,
                  enunciadoTexto,
                  imageUrls,
                  resposta: respostaText,
                  respostaImageUrls,
                });
              }}
              title="Jogar questão em outro Caso ou Subcaso"
              className="flex items-center gap-1 px-1.5 sm:px-1 py-0 h-6 sm:h-4 rounded text-[9.5px] font-medium text-slate-400 hover:text-indigo-300 hover:bg-white/[0.06]"
            >
              <FolderInput size={11} />
              <span className="hidden md:inline">Subcaso</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                builder.openEditQuestao(rootBlockId, casoId, casoNome || questao.caseLabel || "Geral", {
                  ...questao,
                  enunciadoTexto,
                  imageUrls,
                  resposta: respostaText,
                  respostaImageUrls,
                });
              }}
              title="Editar pergunta, imagem ou resposta"
              className="w-6 h-6 sm:w-4 sm:h-4 flex items-center justify-center rounded text-slate-400 hover:text-amber-300 hover:bg-white/[0.06]"
            >
              <Pencil size={10} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void builder.deleteQuestao(rootBlockId, casoId, questao);
              }}
              title="Excluir questão"
              className="w-6 h-6 sm:w-4 sm:h-4 flex items-center justify-center rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}

        {isAdmin && (
          <div className={`flex items-center gap-0.5 opacity-80 sm:opacity-35 sm:group-hover:opacity-100 ${!(rootBlockId && casoId) ? "ml-auto" : ""} mr-1`}>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(questao.id); }}
              disabled={isFirst}
              title="Mover questão para cima"
              className="w-6 h-6 sm:w-4 sm:h-4 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(questao.id); }}
              disabled={isLast}
              title="Mover questão para baixo"
              className="w-6 h-6 sm:w-4 sm:h-4 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent"
            >
              <ArrowDown size={10} />
            </button>
          </div>
        )}

        {stats && stats.totalErros > 0 && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0 leading-[15px] rounded-full text-[9.5px] font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 shrink-0 ${!isAdmin && !isErro && !isAcerto && !(rootBlockId && casoId) ? "ml-auto" : ""}`} title={`${stats.totalErros} erro(s) no histórico`}>
            <span>🔥</span>
            <span>{stats.totalErros} {stats.totalErros === 1 ? "erro" : "erros"}</span>
          </span>
        )}

        {isErro && (
          <span className={`inline-flex items-center gap-1 px-2 py-0 leading-[15px] rounded-full text-[9.5px] font-medium text-rose-300 bg-rose-950/50 border border-rose-700/60 shrink-0 ${!isAdmin && !(stats && stats.totalErros > 0) && !(rootBlockId && casoId) ? "ml-auto" : ""}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 border border-rose-400/50 shrink-0 shadow-sm shadow-rose-500/50" />
            Errou
          </span>
        )}
        {isAcerto && (
          <span className={`inline-flex items-center gap-1 px-2 py-0 leading-[15px] rounded-full text-[9.5px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-700/60 shrink-0 ${!isAdmin && !(stats && stats.totalErros > 0) && !(rootBlockId && casoId) ? "ml-auto" : ""}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-emerald-400/50 shrink-0 shadow-sm shadow-emerald-500/50" />
            Acertou
          </span>
        )}
      </div>

      {open && (
        <div className="ml-2.5 pl-2.5 sm:ml-6 sm:pl-4 border-l border-indigo-500/[0.15] my-2 flex flex-col gap-3">
          {loading && !enunciadoTexto?.trim() && imageUrls.filter(u => u && u.trim() !== "").length === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando detalhes...
            </div>
          ) : (
            <>
              {enunciadoTexto?.trim() && (
                <div className="max-w-2xl p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
                  <p className="text-[13px] sm:text-[14px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {enunciadoTexto}
                  </p>
                  {imageUrls.filter(u => u && u.trim() !== "").length === 0 && (
                    <button
                      type="button"
                      onClick={() => setZoomTextOnly(true)}
                      className="self-start px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-[10px] font-bold flex items-center gap-1.5 border border-white/[0.08] transition-colors"
                    >
                      <Maximize2 size={11} className="text-indigo-400" />
                      Tela Cheia
                    </button>
                  )}
                </div>
              )}

              {imageUrls.filter(u => u && u.trim() !== "").length > 0 ? (
                imageUrls.filter(u => u && u.trim() !== "").map((url, i) => (
                  <div key={i} className="relative group max-w-2xl">
                    <img
                      src={url.trim()}
                      alt={`Q${questao.numero} img${i + 1}`}
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      onClick={() => setZoomedImage(url.trim())}
                      style={getNotionImageFilterStyle(antiBrilho)}
                      className={`w-full rounded-xl border object-contain cursor-zoom-in ${
                        antiBrilho === 'noturno' ? 'bg-[#0b101d] border-white/10' : 'bg-slate-900/90 border-slate-700/60'
                      }`}
                    />
                    <button
                      onClick={() => setZoomedImage(url.trim())}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/85 hover:bg-black text-white text-[10px] font-bold flex items-center gap-1.5 border border-white/20"
                    >
                      <Maximize2 size={12} className="text-indigo-400" />
                      Expandir 100%
                    </button>
                  </div>
                ))
              ) : !enunciadoTexto?.trim() ? (
                <p className="text-[11px] text-slate-700 italic">Sem enunciado ou imagem registrada.</p>
              ) : null}

              <button
                onClick={() => setShowResp(v => !v)}
                className="flex items-center gap-2 self-start px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] text-[11px] font-medium transition-colors"
              >
                {showResp ? <EyeOff size={11} /> : <Eye size={11} />}
                {showResp ? "Ocultar Resposta" : "✨ Ver Resposta"}
              </button>

              {user && (
                <button
                  onClick={toggleHistorico}
                  className="flex items-center gap-2 self-start px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] text-[10px] font-medium transition-colors"
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
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          onClick={() => setZoomedImage(url.trim())}
                          style={getNotionImageFilterStyle(antiBrilho)}
                          className={`w-full rounded-xl border object-contain cursor-zoom-in ${
                            antiBrilho === 'noturno' ? 'bg-[#0b101d] border-white/10' : 'bg-slate-900/90 border-slate-700/60'
                          }`}
                        />
                        <button
                          onClick={() => setZoomedImage(url)}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/85 hover:bg-black text-white text-[10px] font-bold flex items-center gap-1.5 border border-white/20"
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
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-colors disabled:opacity-50 border ${
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
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-300 hover:text-emerald-400 text-[10px] font-medium transition-colors disabled:opacity-50"
                      >
                        <Check size={11} className="text-emerald-400" /> Acertei
                      </button>
                      <button
                        onClick={() => handleRecordAnswer(false)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-300 hover:text-rose-400 text-[10px] font-medium transition-colors disabled:opacity-50"
                      >
                        <X size={11} className="text-rose-400" /> Errei
                      </button>
                      {recorded && (
                        <span className={`text-[10px] font-medium ml-1 ${recorded === 'acerto' ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-colors border ${
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
                                  className={`w-8 h-8 rounded-lg text-[12px] font-black border transition-colors ${
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
                              className="w-full px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 resize-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">URL da Imagem (opcional)</label>
                            <input
                              type="url"
                              value={adminImageUrl}
                              onChange={e => setAdminImageUrl(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 font-mono"
                            />
                            {adminImageUrl?.trim() ? (
                              <img src={adminImageUrl} alt="preview" className="mt-1 max-h-32 rounded-lg border border-white/10 object-contain bg-white/5" />
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            {adminSaved && (
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">✓ Salvo!</span>
                            )}
                            <button
                              onClick={handleAdminSave}
                              disabled={adminSaving}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors"
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
      {(zoomedImage || zoomTextOnly) && (
        <ZoomedQuestaoWrapper
          questao={{ ...questao, enunciadoTexto, imageUrls }}
          user={user}
          isDuvida={isDuvida}
          onToggleDuvida={onToggleDuvida}
          onAnswered={onAnswered}
          initialUrl={zoomedImage ?? undefined}
          initialRespostaText={respostaText}
          initialRespostaImageUrls={respostaImageUrls}
          onClose={() => { setZoomedImage(null); setZoomTextOnly(false); }}
          onNext={onNextQuestion}
          onPrev={onPrevQuestion}
          hasNext={hasNextQuestion}
          hasPrev={hasPrevQuestion}
        />
      )}
    </div>
  );
});

type MapColumnBucket = "nao_dominadas" | "duvidas" | "dominadas";

function getMapRowLookup<T>(map: Map<string, T> | undefined, id: string): T | undefined {
  if (!map) return undefined;
  return map.get(id) ?? map.get(id.replace(/-/g, ""));
}

function hasMapId(set: Set<string> | undefined, id: string): boolean {
  if (!set) return false;
  return set.has(id) || set.has(id.replace(/-/g, ""));
}

function CasoProgressMap({
  questoes,
  originalCategoryById,
  user,
  duvidasIds,
  onToggleDuvida,
  onAnswered,
  resultadosMap,
}: {
  questoes: Questao[];
  originalCategoryById?: Map<string, CategoryKey>;
  casoNome?: string;
  user: { id?: string; email?: string | null } | null;
  duvidasIds: Set<string>;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  onAnswered: () => void;
  resultadosMap?: Map<string, QuestaoStats>;
}) {
  const { overrides } = useContext(ClassificationContext);
  const [zoomSession, setZoomSession] = useState<{ items: Questao[]; index: number } | null>(null);

  const visibleCategories = useMemo(() => {
    const present = new Set<CategoryKey>();
    for (const item of questoes) {
      const overrideCat = getMapRowLookup(overrides, item.id);
      const originalCat = originalCategoryById?.get(item.id) ?? item.categoryKey;
      const effectiveCat = overrideCat ?? originalCat;
      const rowCategoryKey: CategoryKey = overrideCat === "dominada" ? originalCat : effectiveCat;
      present.add(rowCategoryKey);
    }
    return CATEGORIES.filter(c => present.has(c.key));
  }, [questoes, overrides, originalCategoryById]);

  const grouped = useMemo(() => {
    const createRows = (): Record<CategoryKey, Questao[]> => ({
      bonus: [],
      faceis: [],
      atencao: [],
      lacuna: [],
      media: [],
      dificil: [],
      ultrahard: [],
      dominada: [],
      treinar: [],
      revisar: [],
    });

    const columns: Record<MapColumnBucket, Record<CategoryKey, Questao[]>> = {
      nao_dominadas: createRows(),
      duvidas: createRows(),
      dominadas: createRows(),
    };

    for (const item of questoes) {
      const overrideCat = getMapRowLookup(overrides, item.id);
      const originalCat = originalCategoryById?.get(item.id) ?? item.categoryKey;
      const effectiveCat = overrideCat ?? originalCat;
      const rowCategoryKey: CategoryKey = overrideCat === "dominada" ? originalCat : effectiveCat;
      const stats = getMapRowLookup(resultadosMap, item.id);
      const isDuvida = hasMapId(duvidasIds, item.id);

      let bucket: MapColumnBucket;
      if (isDuvida) {
        bucket = "duvidas";
      } else if (
        effectiveCat === "dominada" ||
        (stats?.ultimo === "acerto" && effectiveCat !== "treinar" && effectiveCat !== "revisar")
      ) {
        bucket = "dominadas";
      } else {
        bucket = "nao_dominadas";
      }

      columns[bucket][rowCategoryKey].push({
        ...item,
        categoryKey: effectiveCat,
      });
    }

    return { columns };
  }, [questoes, overrides, originalCategoryById, resultadosMap, duvidasIds]);

  useEffect(() => {
    if (questoes.length === 0) return;
    const firstBatch = questoes.slice(0, 6);
    for (const q of firstBatch) {
      preloadImageUrls(q.imageUrls);
      if ((!q.imageUrls || q.imageUrls.length === 0) && !q.enunciadoTexto) {
        fetchQuestaoFullData(q.id).then(res => {
          preloadImageUrls(res.imgs);
        }).catch(() => {});
      }
    }
  }, [questoes]);

  useEffect(() => {
    if (!zoomSession) return;
    const neighbors = [zoomSession.index - 1, zoomSession.index, zoomSession.index + 1, zoomSession.index + 2];
    for (const ni of neighbors) {
      if (ni >= 0 && ni < zoomSession.items.length) {
        const item = zoomSession.items[ni];
        preloadImageUrls(item.imageUrls);
        preloadImageUrls(item.respostaImageUrls);
        fetchQuestaoFullData(item.id).then(res => {
          preloadImageUrls(res.imgs);
          preloadImageUrls(res.rImgs);
        }).catch(() => {});
      }
    }
  }, [zoomSession]);

  const activeZoomQuestion = zoomSession ? zoomSession.items[zoomSession.index] : null;

  const columnConfigs: Array<{
    key: MapColumnBucket;
    title: string;
    accentText: string;
    accentBar: string;
    badgeBg: string;
    icon: ReactNode;
  }> = [
    {
      key: "nao_dominadas",
      title: "Não Dominadas",
      accentText: "text-slate-200",
      accentBar: "bg-slate-600/80",
      badgeBg: "bg-slate-800/80 text-slate-300 border-white/[0.08]",
      icon: (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-500/15 text-slate-300 border border-slate-400/20">
          <Ban size={11} strokeWidth={2.2} />
        </span>
      ),
    },
    {
      key: "duvidas",
      title: "Dúvidas",
      accentText: "text-amber-300",
      accentBar: "bg-amber-500",
      badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/25",
      icon: (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-[11px] font-bold text-amber-300 border border-amber-500/30">
          ?
        </span>
      ),
    },
    {
      key: "dominadas",
      title: "Dominadas",
      accentText: "text-emerald-300",
      accentBar: "bg-emerald-500",
      badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
      icon: (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
          <Trophy size={11} strokeWidth={2.1} />
        </span>
      ),
    },
  ];

  const columnsWithItems = columnConfigs.map((col) => {
    const colRows = grouped.columns[col.key];
    const colAllItems = visibleCategories.flatMap(cat => colRows[cat.key]);
    return { col, colRows, colAllItems };
  });

  const activeColumns = columnsWithItems.filter(c => c.colAllItems.length > 0);
  const totalCount = questoes.length;
  const dominadasCount = columnsWithItems.find(c => c.col.key === "dominadas")?.colAllItems.length ?? 0;
  const duvidasCount = columnsWithItems.find(c => c.col.key === "duvidas")?.colAllItems.length ?? 0;
  const naoDominadasCount = columnsWithItems.find(c => c.col.key === "nao_dominadas")?.colAllItems.length ?? 0;
  const pctDominadas = totalCount > 0 ? Math.round((dominadasCount / totalCount) * 100) : 0;

  // Detecta grupos com emoji igual para exibir legenda rápida no modo mapa
  const sharedEmojiLegend = useMemo(() => {
    const byKey = new Map<string, { emoji: string; nums: string[] }>();
    for (const q of questoes) {
      const tags = q.tagEmojis && q.tagEmojis.length > 0
        ? q.tagEmojis
        : extractQuestionTagEmojis("", undefined, q.topic);
      for (const em of tags) {
        const key = normalizeTagEmojiKey(em);
        if (!key) continue;
        const curr = byKey.get(key);
        const label = q.numero ? `Q${q.numero}` : "?";
        if (curr) curr.nums.push(label);
        else byKey.set(key, { emoji: em, nums: [label] });
      }
    }
    return [...byKey.values()].filter(g => g.nums.length >= 2);
  }, [questoes]);

  const gridColsClass =
    activeColumns.length <= 1
      ? "grid-cols-1"
      : activeColumns.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="my-1.5 flex flex-col gap-2">
      {/* Barra compacta de resumo e progresso do Caso */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-[#0b111d]/90 px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {columnsWithItems.map(({ col, colAllItems }) => (
              <span
                key={col.key}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                  colAllItems.length > 0
                    ? col.badgeBg
                    : "border-white/[0.05] bg-white/[0.02] text-slate-500"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${colAllItems.length > 0 ? col.accentBar : "bg-slate-700"}`} />
                <span>{col.title}:</span>
                <span className="font-semibold">{colAllItems.length}</span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#22c55e]" /> Acerto
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#b91c1c]" /> Erro
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#ca8a04]" /> Dúvida
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] border border-white/20 bg-slate-800" /> Aberta
            </span>
            <span className="font-semibold text-emerald-400/90 tabular-nums">
              {pctDominadas}% dominado
            </span>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-800/90">
            {dominadasCount > 0 && (
              <div
                className="bg-emerald-500"
                style={{ width: `${(dominadasCount / totalCount) * 100}%` }}
              />
            )}
            {duvidasCount > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${(duvidasCount / totalCount) * 100}%` }}
              />
            )}
            {naoDominadasCount > 0 && (
              <div
                className="bg-slate-600/70"
                style={{ width: `${(naoDominadasCount / totalCount) * 100}%` }}
              />
            )}
          </div>
        )}

        {sharedEmojiLegend.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-amber-300/80 font-medium">Mesma resolução e raciocínio:</span>
            {sharedEmojiLegend.map((g, i) => (
              <span
                key={`${g.emoji}-${i}`}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-1.5 py-0.5 text-[10px] text-amber-200/90 tabular-nums"
              >
                <span>{g.emoji}</span>
                <span className="text-slate-300">{g.nums.join(", ")}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Colunas ativas (apenas colunas com questões para evitar espaços vazios) */}
      <div className={`grid gap-2.5 ${gridColsClass}`}>
        {activeColumns.map(({ col, colRows, colAllItems }) => {
          const nonEmptyCategories = visibleCategories.filter(cat => colRows[cat.key].length > 0);

          return (
            <section
              key={col.key}
              className="flex flex-col rounded-xl border border-white/[0.08] bg-[#0e1523]/95 px-3 py-2.5 shadow-md"
            >
              {/* Cabeçalho compacto da Coluna */}
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {col.icon}
                  <h5 className={`text-[12.5px] font-semibold tracking-tight truncate ${col.accentText}`}>
                    {col.title}
                  </h5>
                </div>
                <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums shrink-0 ${col.badgeBg}`}>
                  {colAllItems.length}
                </span>
              </div>

              {/* Linhas por classificação (somente as que possuem questões) */}
              <div className="flex flex-1 flex-col divide-y divide-white/[0.05]">
                {nonEmptyCategories.map((cat) => {
                  const items = colRows[cat.key];
                  return (
                    <div key={cat.key} className="flex items-center gap-2 sm:gap-2.5 py-2">
                      <div className="flex w-[74px] sm:w-[92px] shrink-0 items-center justify-between gap-1">
                        <span
                          className="flex items-center gap-1.5 text-[11.5px] font-medium truncate"
                          style={{ color: cat.textColor }}
                        >
                          {cat.icon ? (
                            <span className="text-[11px] leading-none shrink-0">{cat.icon}</span>
                          ) : (
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          <span className="truncate">{cat.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                          {items.length}
                        </span>
                      </div>

                      <div className="w-px self-stretch shrink-0 bg-white/[0.08]" />

                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {items.map((item) => {
                          const stats = getMapRowLookup(resultadosMap, item.id);
                          const isDuvida = hasMapId(duvidasIds, item.id);
                          const statusTexto =
                            stats?.ultimo === "acerto"
                              ? "Acertou"
                              : stats?.ultimo === "erro"
                              ? "Errou"
                              : isDuvida
                              ? "Em Dúvida"
                              : "Pendente";

                          const tileClasses =
                            stats?.ultimo === "acerto"
                              ? "bg-[#16a34a]/90 border border-emerald-400/40 text-white shadow-sm hover:brightness-110"
                              : stats?.ultimo === "erro"
                              ? "bg-[#b91c1c]/90 border border-rose-400/40 text-white shadow-sm hover:brightness-110"
                              : isDuvida
                              ? "bg-[#ca8a04] border border-amber-300/40 text-[#111827] shadow-sm hover:brightness-110"
                              : "border border-white/[0.14] bg-slate-800/80 text-slate-200 hover:border-indigo-400/60 hover:bg-slate-700/80 hover:text-white";

                          const numShort = item.numero ? `Q${item.numero}` : "";
                          const tags = item.tagEmojis && item.tagEmojis.length > 0
                            ? item.tagEmojis
                            : extractQuestionTagEmojis("", undefined, item.topic);
                          const tooltipParts = [
                            cat.label,
                            numShort || null,
                            item.topic || null,
                            tags.length > 0 ? `${tags.join(" ")} (Mesma resolução e raciocínio)` : null,
                            statusTexto,
                          ].filter(Boolean);

                          const colIndex = colAllItems.findIndex(q => q.id === item.id);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onMouseEnter={() => {
                                preloadImageUrls(item.imageUrls);
                                preloadImageUrls(item.respostaImageUrls);
                                fetchQuestaoFullData(item.id).then(res => {
                                  preloadImageUrls(res.imgs);
                                  preloadImageUrls(res.rImgs);
                                }).catch(() => {});
                              }}
                              onClick={() => setZoomSession({ items: colAllItems, index: colIndex >= 0 ? colIndex : 0 })}
                              title={tooltipParts.join(" · ")}
                              aria-label={tooltipParts.join(" - ")}
                              className={`inline-flex h-[26px] min-w-[28px] items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-400/70 ${tileClasses}`}
                            >
                              {stats?.ultimo === "acerto" && <Check size={10} strokeWidth={3} className="shrink-0" />}
                              {stats?.ultimo === "erro" && <X size={10} strokeWidth={3} className="shrink-0" />}
                              {isDuvida && stats?.ultimo !== "acerto" && stats?.ultimo !== "erro" && (
                                <span className="text-[10px] font-black leading-none shrink-0">?</span>
                              )}
                              <span>{item.numero ? item.numero.slice(0, 4) : "·"}</span>
                              {tags.length > 0 && (
                                <span className="text-[10px] leading-none shrink-0">{tags[0]}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {activeZoomQuestion && zoomSession && (
        <ZoomedQuestaoWrapper
          questao={activeZoomQuestion}
          user={user}
          duvidasIds={duvidasIds}
          onToggleDuvida={onToggleDuvida}
          onAnswered={onAnswered}
          onClose={() => setZoomSession(null)}
          onNext={() =>
            setZoomSession(prev =>
              prev && prev.index < prev.items.length - 1
                ? { ...prev, index: prev.index + 1 }
                : prev
            )
          }
          onPrev={() =>
            setZoomSession(prev =>
              prev && prev.index > 0
                ? { ...prev, index: prev.index - 1 }
                : prev
            )
          }
          hasNext={zoomSession.index < zoomSession.items.length - 1}
          hasPrev={zoomSession.index > 0}
        />
      )}
    </div>
  );
}

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
  showQuestionMap = false,
  expandSignal,
  onMoveUp,
  onMoveDown,
  onDropCaso,
  isFirst = false,
  isLast = false,
  refreshKey,
  onPrintCaso,
  rootBlockId,
  parentBlockId,
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
  showQuestionMap?: boolean;
  expandSignal?: { mode: "expand" | "collapse"; seq: number } | null;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDropCaso?: (draggedId: string, targetId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  refreshKey?: number;
  onPrintCaso?: (caso: Caso, questoes?: Questao[]) => void;
  rootBlockId?: string;
  parentBlockId?: string;
}) {
  const [openState, setOpenState] = useState<{ open: boolean; seq: number }>({ open: false, seq: 0 });
  const open = expandSignal && expandSignal.seq > openState.seq ? expandSignal.mode === "expand" : openState.open;
  const { overrides, classificacaoFiltro } = useContext(ClassificationContext);
  const { builderRefreshSeq, openCreateSubcaso, openCreateQuestao, deleteCaso } = useContext(BuilderActionsContext);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [subcasos, setSubcasos] = useState<Caso[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [zoomedQuestaoIndex, setZoomedQuestaoIndex] = useState<number | null>(null);
  const [collapsedEmojiGroups, setCollapsedEmojiGroups] = useState<Set<string>>(() => new Set());

  // Reseta estado carregado quando houver sincronização forçada
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      setLoaded(false);
      setQuestoes([]);
      setSubcasos([]);
    }
  }, [refreshKey]);

  // Recarrega suavemente quando houver criação/edição/movimentação local
  useEffect(() => {
    if (builderRefreshSeq > 0) {
      setLoaded(false);
    }
  }, [builderRefreshSeq]);

  // Pre-fetch das questões adjacentes e imagens para navegação instantânea
  useEffect(() => {
    if (zoomedQuestaoIndex === null) return;
    const neighbors = [zoomedQuestaoIndex - 1, zoomedQuestaoIndex, zoomedQuestaoIndex + 1, zoomedQuestaoIndex + 2];
    for (const ni of neighbors) {
      if (ni >= 0 && ni < questoes.length) {
        const q = questoes[ni];
        preloadImageUrls(q.imageUrls);
        preloadImageUrls(q.respostaImageUrls);
        fetchQuestaoFullData(q.id).then(res => {
          preloadImageUrls(res.imgs);
          preloadImageUrls(res.rImgs);
        }).catch(() => {});
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
    if (!open || loaded || loadingRef.current) return;
    let active = true;
    loadingRef.current = true;
    setLoading(true);
    (async () => {
      try {
        const cleanCasoId = caso.id.replace(/-/g, "");

        // Se o caso já recebeu questões diretas da raiz do bloco cadastrado, reconcilia IDs/datas com o Supabase
        if (caso.questoes && caso.questoes.length > 0) {
          const directIds = caso.questoes.map(q => q.id);
          const directCleanIds = new Set(directIds.map(id => id.replace(/-/g, "")));
          const dbRows = await supabase
            .from("notion_questoes_banco")
            .select("*")
            .or(`caso_id.eq.${caso.id},caso_id.eq.${cleanCasoId},id.in.(${directIds.join(",")})`)
            .then(r => r.data ?? [], () => [] as any[]);
          const dbById = new Map<string, any>((dbRows as any[]).map(r => [r.id.replace(/-/g, ""), r]));
          const toDeleteDirect: string[] = (dbRows as any[])
            .filter(r => r.notion_last_edited_time !== "local" && r.caso_id && r.caso_id.replace(/-/g, "") === cleanCasoId && !directCleanIds.has(r.id.replace(/-/g, "")))
            .map(r => r.id);

          const hydrated = caso.questoes.map(q => {
            const qClean = q.id.replace(/-/g, "");
            const dbRow = dbById.get(qClean);
            const notionTime = q.lastEditedTime ? new Date(q.lastEditedTime).getTime() : 0;
            const isLocalRow = dbRow?.notion_last_edited_time === "local";
            const dbTime = dbRow?.notion_last_edited_time && !isLocalRow
              ? new Date(dbRow.notion_last_edited_time).getTime()
              : (dbRow?.updated_at ? new Date(dbRow.updated_at).getTime() : 0);
            const hasExpired = dbRow
              ? hasExpiredAwsUrl(dbRow.imagens_urls) || hasExpiredAwsUrl(dbRow.gabarito_imagens_urls)
              : false;

            const extractedTags = extractQuestionTagEmojis("", undefined, q.topic || dbRow?.topico);
            const cleanedTopic = dbRow?.topico
              ? parseQuestaoTitle(dbRow.topico).topic
              : q.topic;
            if (dbRow && !isLocalRow && notionTime > dbTime) {
              toDeleteDirect.push(dbRow.id);
              fullQuestaoCache.delete(qClean);
              try {
                localStorage.removeItem(`notion_c_qfull_${qClean}`);
                sessionStorage.removeItem(`notion_c_qfull_${qClean}`);
              } catch {}
              return { ...q, tagEmojis: q.tagEmojis?.length ? q.tagEmojis : extractedTags, forceReload: true };
            }
            if (dbRow && !hasExpired) {
              return {
                ...q,
                topic: q.topic || cleanedTopic,
                tagEmojis: q.tagEmojis?.length ? q.tagEmojis : extractedTags,
                enunciadoTexto: dbRow.enunciado_texto || q.enunciadoTexto,
                imageUrls: Array.isArray(dbRow.imagens_urls) ? dbRow.imagens_urls : q.imageUrls,
                resposta: dbRow.gabarito_texto || q.resposta,
                respostaImageUrls: Array.isArray(dbRow.gabarito_imagens_urls) ? dbRow.gabarito_imagens_urls : q.respostaImageUrls,
              };
            }
            return { ...q, tagEmojis: q.tagEmojis?.length ? q.tagEmojis : extractedTags, forceReload: !dbRow || hasExpired };
          });

          if (toDeleteDirect.length > 0) {
            const uniqueDel = [...new Set(toDeleteDirect)];
            const cacheKeysToDel = uniqueDel.flatMap(id => {
              const c = id.replace(/-/g, "");
              return [`qfull_${c}`, c];
            });
            await Promise.allSettled([
              supabase.from("notion_questoes_banco").delete().in("id", uniqueDel),
              supabase.from("notion_cache_blocos").delete().in("block_id", cacheKeysToDel),
            ]);
            if (rootBlockId) {
              const cleanRoot = extractNotionBlockId(rootBlockId).replace(/-/g, "");
              bancoIdsLoadedPromise = null;
              questoesDoBlocoCache.delete(cleanRoot);
              questoesDetalhesCache.delete(cleanRoot);
            }
          }

          if (active) {
            setQuestoes(hydrated);
            setSubcasos([]);
            setLoaded(true);
          }
          return;
        }

        // Busca registros salvos no Supabase para este caso (para usar dados rápidos ou como fallback após 3s)
        const dbPromise = (async () => {
          let rows = await supabase
            .from("notion_questoes_banco")
            .select("*")
            .in("caso_id", [caso.id, cleanCasoId])
            .then(r => r.data ?? [], () => [] as any[]);
          if (rows.length === 0 && rootBlockId && caso.nome) {
            const cleanRoot = extractNotionBlockId(rootBlockId).replace(/-/g, "");
            const byName = await supabase
              .from("notion_questoes_banco")
              .select("*")
              .or(`bloco_raiz_id.eq.${rootBlockId},bloco_raiz_id.eq.${cleanRoot}`)
              .eq("caso_nome", caso.nome)
              .then(r => r.data ?? [], () => [] as any[]);
            if (byName.length > 0) rows = byName;
          }
          return rows as any[];
        })();

        const notionEnabled = await isNotionEnabled();
        let notionChildren: NotionAPIBlock[] | null = null;

        if (notionEnabled) {
          const notionFetchPromise = fetchChildren(caso.id, true, true)
            .then(res => unwrapNotionContainers(res, true, true))
            .catch(() => null);
          const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
          notionChildren = await Promise.race([notionFetchPromise, timeoutPromise]);
        }

        const dbRes = await dbPromise;
        const dbMap = new Map<string, any>(dbRes.map(r => [r.id.replace(/-/g, ""), r]));

        const tempQuestoes: Questao[] = [];
        const tempSubcasos: Caso[] = [];

        if (notionChildren !== null) {
          // Notion respondeu em <= 3s: mostrar SOMENTE o que está no Notion e reconciliar IDs no Supabase
          const foundCleanIds = new Set<string>();
          const outdatedIdsToDelete: string[] = [];

          for (const child of notionChildren) {
            if (!isNavigableNotionContainer(child)) continue;
            const rawTitle = getChildBlockTitle(child);
            const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
            const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
            const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);

            if (categoryKey) {
              const cClean = child.id.replace(/-/g, "");
              foundCleanIds.add(cClean);
              const dbRow = dbMap.get(cClean);
              const tagEmojis = extractQuestionTagEmojis(rawTitle, child.icon?.type === "emoji" ? child.icon.emoji : undefined, dbRow?.topico);

              const notionTime = child.last_edited_time ? new Date(child.last_edited_time).getTime() : 0;
              const isLocalRow = dbRow?.notion_last_edited_time === "local";
              const dbTime = dbRow?.notion_last_edited_time && !isLocalRow
                ? new Date(dbRow.notion_last_edited_time).getTime()
                : (dbRow?.updated_at ? new Date(dbRow.updated_at).getTime() : 0);
              const hasExpired = dbRow
                ? hasExpiredAwsUrl(dbRow.imagens_urls) || hasExpiredAwsUrl(dbRow.gabarito_imagens_urls)
                : false;

              if (dbRow && !isLocalRow && notionTime > dbTime) {
                // Atualização mais recente no Notion: exclui do Supabase para refazer atualizado
                outdatedIdsToDelete.push(dbRow.id);
                fullQuestaoCache.delete(cClean);
                try {
                  localStorage.removeItem(`notion_c_qfull_${cClean}`);
                  sessionStorage.removeItem(`notion_c_qfull_${cClean}`);
                } catch {}
                tempQuestoes.push({
                  id: child.id,
                  numero,
                  topic,
                  categoryKey,
                  imageUrls: [],
                  respostaImageUrls: [],
                  lastEditedTime: child.last_edited_time,
                  forceReload: true,
                  tagEmojis,
                });
              } else if (dbRow && !hasExpired) {
                // ID igual e atualizado no Supabase: usa o registro do Supabase
                const dbTopicParsed = dbRow.topico ? parseQuestaoTitle(dbRow.topico).topic : "";
                const mq: Questao = {
                  id: dbRow.id,
                  numero: numero || dbRow.numero || "",
                  topic: topic || dbTopicParsed || "",
                  categoryKey,
                  enunciadoTexto: dbRow.enunciado_texto || undefined,
                  imageUrls: Array.isArray(dbRow.imagens_urls) ? dbRow.imagens_urls : [],
                  resposta: dbRow.gabarito_texto || undefined,
                  respostaImageUrls: Array.isArray(dbRow.gabarito_imagens_urls) ? dbRow.gabarito_imagens_urls : [],
                  caseLabel: caso.nome,
                  lastEditedTime: child.last_edited_time,
                  tagEmojis,
                };
                tempQuestoes.push(mq);
                const qFull: FullQuestaoData = {
                  children: [],
                  imgs: mq.imageUrls,
                  rImgs: mq.respostaImageUrls ?? [],
                  textEnunciado: mq.enunciadoTexto,
                  textResp: mq.resposta,
                  foundToggleId: null,
                };
                if (hasFullQuestaoContent(qFull)) {
                  fullQuestaoCache.set(cClean, { data: qFull, timestamp: Date.now() });
                }
              } else {
                // Ainda não tem no Supabase (ou imagem expirada): aparece do Notion
                tempQuestoes.push({
                  id: child.id,
                  numero,
                  topic,
                  categoryKey,
                  imageUrls: [],
                  respostaImageUrls: [],
                  lastEditedTime: child.last_edited_time,
                  forceReload: true,
                  tagEmojis,
                });
              }
            } else if (rawTitle || child.has_children) {
              tempSubcasos.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
            }
          }

          // Se este toggle tinha apenas enunciado/imagens/"Resposta" e nenhuma subquestão ou subcaso real,
          // trata o próprio bloco como uma questão única
          const onlyRespostaSub = tempSubcasos.length > 0 && tempSubcasos.every(s => s.nome.toLowerCase().includes("resposta"));
          const hasDirectBody = notionChildren.some(c => c.type === "image" || (c.type === "paragraph" && richText(c.paragraph?.rich_text).trim().length > 0));
          if (tempQuestoes.length === 0 && (onlyRespostaSub || (tempSubcasos.length === 0 && hasDirectBody))) {
            if (onlyRespostaSub) tempSubcasos.length = 0;
            const parsedSelf = parseQuestaoTitle(caso.nome);
            const selfCat = detectCategory(parsedSelf.emojis) || "media";
            foundCleanIds.add(cleanCasoId);
            const selfDbRow = dbMap.get(cleanCasoId);
            const selfTags = extractQuestionTagEmojis(caso.nome, undefined, selfDbRow?.topico);
            const selfHasExpired = selfDbRow
              ? hasExpiredAwsUrl(selfDbRow.imagens_urls) || hasExpiredAwsUrl(selfDbRow.gabarito_imagens_urls)
              : false;
            if (selfDbRow && !selfHasExpired) {
              tempQuestoes.push({
                id: selfDbRow.id,
                numero: parsedSelf.numero || selfDbRow.numero || "",
                topic: parsedSelf.topic || (selfDbRow.topico ? parseQuestaoTitle(selfDbRow.topico).topic : "") || caso.nome,
                categoryKey: selfCat,
                enunciadoTexto: selfDbRow.enunciado_texto || undefined,
                imageUrls: Array.isArray(selfDbRow.imagens_urls) ? selfDbRow.imagens_urls : [],
                resposta: selfDbRow.gabarito_texto || undefined,
                respostaImageUrls: Array.isArray(selfDbRow.gabarito_imagens_urls) ? selfDbRow.gabarito_imagens_urls : [],
                caseLabel: caso.nome,
                tagEmojis: selfTags,
              });
            } else {
              tempQuestoes.push({
                id: caso.id,
                numero: parsedSelf.numero || "",
                topic: parsedSelf.topic || caso.nome,
                categoryKey: selfCat,
                imageUrls: [],
                respostaImageUrls: [],
                forceReload: true,
                tagEmojis: selfTags,
              });
            }
          }

          // Remove do Supabase qualquer questão cujo ID deixou de existir ou foi alterado no Notion
          const staleIds = dbRes
            .filter(r => r.notion_last_edited_time !== "local" && !foundCleanIds.has(r.id.replace(/-/g, "")))
            .map(r => r.id);
          const allToDelete = [...new Set([...staleIds, ...outdatedIdsToDelete])];
          if (allToDelete.length > 0) {
            const cacheKeysToDel = allToDelete.flatMap(id => {
              const c = id.replace(/-/g, "");
              return [`qfull_${c}`, c];
            });
            await Promise.allSettled([
              supabase.from("notion_questoes_banco").delete().in("id", allToDelete),
              supabase.from("notion_cache_blocos").delete().in("block_id", cacheKeysToDel),
            ]);
            if (rootBlockId) {
              const cleanRoot = extractNotionBlockId(rootBlockId).replace(/-/g, "");
              bancoIdsLoadedPromise = null;
              questoesDoBlocoCache.delete(cleanRoot);
              questoesDetalhesCache.delete(cleanRoot);
              try {
                localStorage.removeItem(`notion_c_ids_${cleanRoot}`);
                localStorage.removeItem(`notion_c_det_${cleanRoot}`);
              } catch {}
            }
          }
        } else {
          // Notion demorou > 3s ou indisponível: pega do Supabase
          const mappedDb: Questao[] = dbRes.map((b: any) => {
            const dbTopicParsed = b.topico ? parseQuestaoTitle(b.topico).topic : "";
            const tagEmojis = extractQuestionTagEmojis("", undefined, b.topico);
            return {
              id: b.id,
              numero: b.numero || "",
              topic: dbTopicParsed || "",
              categoryKey: (b.categoria || "media") as CategoryKey,
              enunciadoTexto: b.enunciado_texto || undefined,
              imageUrls: Array.isArray(b.imagens_urls) ? b.imagens_urls : [],
              resposta: b.gabarito_texto || undefined,
              respostaImageUrls: Array.isArray(b.gabarito_imagens_urls) ? b.gabarito_imagens_urls : [],
              caseLabel: b.caso_nome || caso.nome,
              tagEmojis,
            };
          });
          const seedTime = Date.now();
          for (const mq of mappedDb) {
            const qClean = mq.id.replace(/-/g, "");
            const qFull: FullQuestaoData = {
              children: [],
              imgs: mq.imageUrls,
              rImgs: mq.respostaImageUrls ?? [],
              textEnunciado: mq.enunciadoTexto,
              textResp: mq.resposta,
              foundToggleId: null,
            };
            if (hasFullQuestaoContent(qFull) && !isFullQuestaoExpired(qFull)) {
              fullQuestaoCache.set(qClean, { data: qFull, timestamp: seedTime });
            }
          }
          tempQuestoes.push(...mappedDb);

          const rawSbChildren = await fetchChildren(caso.id, false, false).catch(() => [] as NotionAPIBlock[]);
          const sbChildren = await unwrapNotionContainers(rawSbChildren, false, false).catch(() => rawSbChildren);
          const seenIds = new Set(mappedDb.map(q => q.id.replace(/-/g, "")));
          for (const child of sbChildren) {
            if (!isNavigableNotionContainer(child)) continue;
            const rawTitle = getChildBlockTitle(child);
            const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
            const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
            const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
            if (categoryKey) {
              const cClean = child.id.replace(/-/g, "");
              if (!seenIds.has(cClean)) {
                seenIds.add(cClean);
                const tagEmojis = extractQuestionTagEmojis(rawTitle, child.icon?.type === "emoji" ? child.icon.emoji : undefined);
                tempQuestoes.push({ id: child.id, numero, topic, categoryKey, imageUrls: [], respostaImageUrls: [], tagEmojis });
              }
            } else if (rawTitle || child.has_children) {
              tempSubcasos.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
            }
          }
        }

        for (const mq of tempQuestoes.slice(0, 6)) {
          preloadImageUrls(mq.imageUrls);
        }

        if (active) {
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

          let savedQuestionOrder: string[] = [];
          try {
            const savedQ = localStorage.getItem(`notion_questoes_order_${caso.id}`);
            if (savedQ) savedQuestionOrder = JSON.parse(savedQ);
          } catch (e) {
            savedQuestionOrder = [];
          }

          setQuestoes(sortQuestoesPorDificuldade(tempQuestoes, savedQuestionOrder));
          setSubcasos(tempSubcasos);
          setLoaded(true);
        }
      } catch (e) {
        console.error("Erro ao carregar caso:", e);
      } finally {
        loadingRef.current = false;
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      loadingRef.current = false;
    };
  }, [open, caso.id, caso.nome, caso.questoes, loaded, rootBlockId]);

  const effectiveStatus = statusFiltro !== "todas" ? statusFiltro : (apenasComErros ? "erros" : "todas");

  const sortedQuestoes = useMemo(() => {
    const classified = questoes.map(question => ({
      ...question,
      categoryKey: overrides.get(question.id) ?? question.categoryKey,
    }));
    if (effectiveStatus !== "mais_erros" || !resultadosMap) return classified;
    return classified.sort((a, b) => {
      const aErros = resultadosMap.get(a.id)?.totalErros ?? 0;
      const bErros = resultadosMap.get(b.id)?.totalErros ?? 0;
      return bErros - aErros;
    });
  }, [questoes, effectiveStatus, resultadosMap, overrides]);

  const originalCategoryById = useMemo(() => {
    const map = new Map<string, CategoryKey>();
    for (const q of questoes) {
      map.set(q.id, q.categoryKey);
    }
    return map;
  }, [questoes]);

  const filteredQuestoes = useMemo(() => {
    if (classificacaoFiltro === "todas") return sortedQuestoes;
    return sortedQuestoes.filter(q => {
      const currentCat = overrides.get(q.id) ?? q.categoryKey;
      if (classificacaoFiltro === "personalizadas") return overrides.has(q.id);
      if (classificacaoFiltro === "padrao") return !overrides.has(q.id);
      return currentCat === classificacaoFiltro;
    });
  }, [sortedQuestoes, classificacaoFiltro, overrides]);

  type QuestaoRenderEntry =
    | { type: "group"; key: string; emoji: string; items: { q: Questao; flatIdx: number }[] }
    | { type: "single"; q: Questao; flatIdx: number };

  const questaoRenderEntries = useMemo<QuestaoRenderEntry[]>(() => {
    const emojiCounts = new Map<string, { display: string; count: number }>();
    for (const q of filteredQuestoes) {
      const tags = q.tagEmojis && q.tagEmojis.length > 0
        ? q.tagEmojis
        : extractQuestionTagEmojis("", undefined, q.topic);
      const seenInQ = new Set<string>();
      for (const em of tags) {
        const key = normalizeTagEmojiKey(em);
        if (!key || seenInQ.has(key)) continue;
        seenInQ.add(key);
        const curr = emojiCounts.get(key);
        if (curr) curr.count++;
        else emojiCounts.set(key, { display: em, count: 1 });
      }
    }

    const sharedKeys = new Set<string>();
    for (const [k, info] of emojiCounts.entries()) {
      if (info.count >= 2) sharedKeys.add(k);
    }

    if (sharedKeys.size === 0) {
      return filteredQuestoes.map((q, flatIdx) => ({ type: "single", q, flatIdx }));
    }

    const groupBuckets = new Map<string, { emoji: string; items: { q: Questao; flatIdx: number }[] }>();
    const assignedGroupByFlatIdx = new Map<number, string>();

    filteredQuestoes.forEach((q, flatIdx) => {
      const tags = q.tagEmojis && q.tagEmojis.length > 0
        ? q.tagEmojis
        : extractQuestionTagEmojis("", undefined, q.topic);
      const matchedKey = tags.map(normalizeTagEmojiKey).find(k => sharedKeys.has(k));
      if (matchedKey) {
        assignedGroupByFlatIdx.set(flatIdx, matchedKey);
        const existing = groupBuckets.get(matchedKey);
        if (existing) {
          existing.items.push({ q, flatIdx });
        } else {
          groupBuckets.set(matchedKey, {
            emoji: emojiCounts.get(matchedKey)!.display,
            items: [{ q, flatIdx }],
          });
        }
      }
    });

    const entries: QuestaoRenderEntry[] = [];
    const emittedGroups = new Set<string>();
    filteredQuestoes.forEach((q, flatIdx) => {
      const gKey = assignedGroupByFlatIdx.get(flatIdx);
      if (gKey) {
        if (!emittedGroups.has(gKey)) {
          emittedGroups.add(gKey);
          const bucket = groupBuckets.get(gKey)!;
          entries.push({ type: "group", key: gKey, emoji: bucket.emoji, items: bucket.items });
        }
      } else {
        entries.push({ type: "single", q, flatIdx });
      }
    });

    return entries;
  }, [filteredQuestoes]);

  const toggleEmojiGroup = useCallback((groupKey: string) => {
    setCollapsedEmojiGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const errosInCaso = loaded && resultadosMap
    ? (effectiveStatus === "mais_erros"
        ? questoes.filter(q => (resultadosMap.get(q.id)?.totalErros ?? 0) > 0).length
        : questoes.filter(q => resultadosMap.get(q.id)?.ultimo === "erro").length)
    : 0;

  if ((effectiveStatus === "erros" || effectiveStatus === "mais_erros") && loaded && errosInCaso === 0) {
    return null;
  }

  if (classificacaoFiltro !== "todas" && loaded && filteredQuestoes.length === 0 && subcasos.length === 0) {
    return null;
  }

  const hasErrosInCaso = (effectiveStatus === "erros" || effectiveStatus === "mais_erros") && errosInCaso > 0;
  const hasContent = filteredQuestoes.length > 0 || subcasos.length > 0;
  const hasSubcasos = subcasos.length > 0;
  const hasDirectQuestoes = filteredQuestoes.length > 0;
  const isSubcaso = depth > 0;

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
      className={`flex flex-col gap-0.5 ${
        isSubcaso
          ? "rounded-xl border border-indigo-500/20 bg-indigo-950/[0.16] px-1.5 py-1"
          : "rounded-lg"
      } ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      }`}
    >
      <div className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 py-1.5 px-2 sm:px-2.5 min-h-[34px] sm:min-h-[30px] rounded-lg group ${
        hasErrosInCaso ? "bg-rose-500/[0.03] border border-rose-500/20" : "hover:bg-white/[0.02]"
      }`}>
        {isAdmin && (
          <span 
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-indigo-400 shrink-0 select-none" 
            title="Arrastar para reordenar caso"
          >
            <GripVertical size={13} />
          </span>
        )}

        <button
          onClick={() => setOpenState({ open: !open, seq: expandSignal?.seq ?? openState.seq })}
          className="flex items-center gap-2 text-left flex-1 min-w-[160px]"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {loading ? (
              <Loader2 size={10} className="animate-spin text-slate-500" />
            ) : (
              <ChevronRight size={12} className={`text-slate-500 shrink-0 ${open ? "rotate-90" : ""}`} />
            )}
          </span>
          {isSubcaso && (
            <Folder size={13} className="text-indigo-400/80 shrink-0" />
          )}
          <span className={`font-semibold truncate ${hasErrosInCaso ? "text-rose-300 font-bold" : isSubcaso ? "text-indigo-100 group-hover:text-white" : "text-[#a4adc0] group-hover:text-white"} ${depth === 0 ? "text-[13.5px] sm:text-[14px]" : "text-[12.5px] sm:text-[13px]"}`}>
            {caso.nome}
          </span>
          {isSubcaso && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0 leading-[15px] rounded bg-indigo-500/15 border border-indigo-500/25 text-[9px] font-bold uppercase tracking-wider text-indigo-300 shrink-0">
              Subcaso
            </span>
          )}

          {hasErrosInCaso && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/30 border border-rose-500/20 shrink-0 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              {errosInCaso} {errosInCaso === 1 ? "erro" : "erros"}
            </span>
          )}
        </button>

        {isAdmin && (
          <div className="flex items-center gap-0.5 opacity-80 sm:opacity-35 sm:group-hover:opacity-100 ml-1 sm:ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(caso.id); }}
              disabled={isFirst}
              title="Mover caso para cima"
              className="w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(caso.id); }}
              disabled={isLast}
              title="Mover caso para baixo"
              className="w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-300 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-transparent"
            >
              <ArrowDown size={10} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-1">
          {rootBlockId && (
            <div className="flex items-center gap-0.5 opacity-85 sm:opacity-50 sm:group-hover:opacity-100 mr-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateSubcaso(rootBlockId, caso.id, caso.nome);
                }}
                title={`Criar subcaso dentro de "${caso.nome}"`}
                className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-indigo-300 hover:bg-white/[0.06]"
              >
                <FolderPlus size={12} />
                <span className="hidden lg:inline">Subcaso</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateQuestao(rootBlockId, caso.id);
                }}
                title={`Nova questão dentro de "${caso.nome}"`}
                className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-emerald-300 hover:bg-white/[0.06]"
              >
                <FilePlus2 size={12} />
                <span className="hidden lg:inline">Questão</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteCaso(rootBlockId, parentBlockId || rootBlockId, caso.id, caso.nome);
                }}
                title={`Remover "${caso.nome}"`}
                className="p-1.5 sm:p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrintCaso?.(caso, questoes);
            }}
            title={`Imprimir caso "${caso.nome}" (com gabarito no final)`}
            className="opacity-80 sm:opacity-45 hover:opacity-100 sm:group-hover:opacity-80 p-1.5 sm:p-1 text-slate-400 hover:text-indigo-300 hover:bg-white/[0.06] rounded-md"
          >
            <Printer size={12} />
          </button>
          <BlocoStatsBadge
            blockId={caso.id}
            resultadosMap={resultadosMap}
            duvidasIds={duvidasIds}
          />
        </div>
      </div>

      {open && (
        <div className={`flex flex-col gap-1.5 border-l my-1 ${
          isSubcaso
            ? "ml-3 pl-2.5 sm:ml-10 sm:pl-5 border-indigo-400/25"
            : "ml-2 pl-2.5 sm:ml-6 sm:pl-4 border-indigo-500/20"
        }`}>
          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando...
            </div>
          ) : !hasContent ? (
            <div className="flex items-center gap-2 flex-wrap py-1.5 px-2">
              <span className="text-[11px] text-slate-600 italic">
                {classificacaoFiltro !== "todas" ? "Nenhuma questão com esta classificação neste caso." : "Sem questões registradas."}
              </span>
              {rootBlockId && classificacaoFiltro === "todas" && (
                <>
                  <button
                    type="button"
                    onClick={() => openCreateSubcaso(rootBlockId, caso.id, caso.nome)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20"
                  >
                    + Criar Subcaso
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateQuestao(rootBlockId, caso.id)}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                  >
                    + Criar Questão
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {hasSubcasos && (
                <div className="flex flex-col gap-2">
                  {hasDirectQuestoes && (
                    <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
                      <Folder size={11} className="text-indigo-400 shrink-0" />
                      <span>Subcasos ({subcasos.length})</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
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
                        showQuestionMap={showQuestionMap}
                        expandSignal={expandSignal}
                        onMoveUp={(id) => handleMoveSubcaso(id, "up")}
                        onMoveDown={(id) => handleMoveSubcaso(id, "down")}
                        onDropCaso={handleDropSubcaso}
                        isFirst={idx === 0}
                        isLast={idx === subcasos.length - 1}
                        refreshKey={refreshKey}
                        onPrintCaso={onPrintCaso}
                        rootBlockId={rootBlockId}
                        parentBlockId={caso.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {hasDirectQuestoes && (
                <div className={hasSubcasos ? "mt-1 pt-2 border-t border-white/[0.08] flex flex-col gap-1.5" : "flex flex-col gap-0.5"}>
                  {hasSubcasos && (
                    <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <FileText size={11} className="text-slate-500 shrink-0" />
                      <span>Questões diretas de &ldquo;{caso.nome}&rdquo; ({filteredQuestoes.length})</span>
                    </div>
                  )}

                  <div className={hasSubcasos ? "ml-2.5 pl-2.5 sm:ml-8 sm:pl-4 border-l border-white/[0.10] flex flex-col gap-0.5" : "pl-1 sm:pl-2 flex flex-col gap-0.5"}>
                    {showQuestionMap && (
                      <CasoProgressMap
                        questoes={filteredQuestoes}
                        originalCategoryById={originalCategoryById}
                        casoNome={caso.nome}
                        user={user}
                        duvidasIds={duvidasIds}
                        onToggleDuvida={onToggleDuvida}
                        onAnswered={onAnswered}
                        resultadosMap={resultadosMap}
                      />
                    )}

                    {!showQuestionMap && questaoRenderEntries.map((entry, entryIdx) => {
                      if (entry.type === "group") {
                        const isGroupCollapsed = collapsedEmojiGroups.has(entry.key);
                        return (
                          <div
                            key={`emoji-group-${entry.key}`}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-1.5 py-1 my-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleEmojiGroup(entry.key)}
                              className="w-full flex items-center gap-1.5 px-1.5 py-0.5 text-left rounded hover:bg-white/[0.03] transition-colors"
                            >
                              <ChevronRight
                                size={10}
                                className={`text-amber-400/80 shrink-0 ${!isGroupCollapsed ? "rotate-90" : ""}`}
                              />
                              <span className="text-[12px] leading-none shrink-0">{entry.emoji}</span>
                              <span className="text-[10.5px] font-semibold text-amber-300/95 truncate">
                                Mesma resolução e raciocínio
                              </span>
                              <span className="text-[9.5px] text-amber-200/75 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0 leading-[15px] rounded shrink-0 tabular-nums">
                                {entry.items.length} questões
                              </span>
                              <span className="text-[9.5px] text-slate-500 truncate ml-auto hidden sm:inline tabular-nums">
                                Q{entry.items.map(i => i.q.numero || "?").slice(0, 8).join(", ")}
                                {entry.items.length > 8 ? "…" : ""}
                              </span>
                            </button>

                            {!isGroupCollapsed && (
                              <div className="flex flex-col gap-0.5 mt-0.5 pl-2 ml-1.5 sm:pl-3 sm:ml-3 border-l border-amber-500/20">
                                {entry.items.map(({ q, flatIdx }, subIdx) => (
                                  <div
                                    key={q.id}
                                    className={subIdx < entry.items.length - 1 ? "border-b border-white/[0.04]" : ""}
                                  >
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
                                      isFirst={flatIdx === 0}
                                      isLast={flatIdx === filteredQuestoes.length - 1}
                                      onNextQuestion={flatIdx < filteredQuestoes.length - 1 ? () => setZoomedQuestaoIndex(flatIdx + 1) : undefined}
                                      onPrevQuestion={flatIdx > 0 ? () => setZoomedQuestaoIndex(flatIdx - 1) : undefined}
                                      hasNextQuestion={flatIdx < filteredQuestoes.length - 1}
                                      hasPrevQuestion={flatIdx > 0}
                                      rootBlockId={rootBlockId}
                                      casoId={caso.id}
                                      casoNome={caso.nome}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const { q, flatIdx } = entry;
                      return (
                        <div
                          key={q.id}
                          className={entryIdx < questaoRenderEntries.length - 1 ? "border-b border-white/[0.04]" : ""}
                        >
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
                            isFirst={flatIdx === 0}
                            isLast={flatIdx === filteredQuestoes.length - 1}
                            onNextQuestion={flatIdx < filteredQuestoes.length - 1 ? () => setZoomedQuestaoIndex(flatIdx + 1) : undefined}
                            onPrevQuestion={flatIdx > 0 ? () => setZoomedQuestaoIndex(flatIdx - 1) : undefined}
                            hasNextQuestion={flatIdx < filteredQuestoes.length - 1}
                            hasPrevQuestion={flatIdx > 0}
                            rootBlockId={rootBlockId}
                            casoId={caso.id}
                            casoNome={caso.nome}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {zoomedQuestaoIndex !== null && questoes[zoomedQuestaoIndex] && (
        <ZoomedQuestaoWrapper
          questao={questoes[zoomedQuestaoIndex]}
          user={user}
          duvidasIds={duvidasIds}
          onToggleDuvida={onToggleDuvida}
          onAnswered={onAnswered}
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
  showQuestionMap = false,
  refreshKey,
  onPrintCaso,
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
  showQuestionMap?: boolean;
  refreshKey?: number;
  onPrintCaso?: (caso: Caso, questoes?: Questao[]) => void;
}) {
  const { overrides, classificacaoFiltro } = useContext(ClassificationContext);
  const builder = useContext(BuilderActionsContext);
  const prevRefreshKeyRef = useRef(0);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [filteredItens, setFilteredItens] = useState<QuestaoResumo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandSignal, setExpandSignal] = useState<{ mode: "expand" | "collapse"; seq: number } | null>(null);

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
        const blockUuid = extractNotionBlockId(block.block_id);
        const clean = blockUuid.replace(/-/g, "");
        const currentRefreshKey = refreshKey ?? 0;
        const forceFetch = currentRefreshKey > prevRefreshKeyRef.current;
        prevRefreshKeyRef.current = currentRefreshKey;

        if (effectiveStatus !== "todas") {
          const details = await collectQuestaoDetails(blockUuid, forceFetch);
          let filtered: QuestaoResumo[] = [];
          if (effectiveStatus === "erros") {
            filtered = details.itens.filter(i => resultadosMap?.get(i.id)?.ultimo === "erro");
          } else if (effectiveStatus === "mais_erros") {
            filtered = details.itens.filter(i => (resultadosMap?.get(i.id)?.totalErros ?? 0) > 0);
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

        let built: Caso[] = [];

        try {
          let loadedFromNotion = false;
          let notionErrorMsg = "";

          const notionEnabled = await isNotionEnabled();
          if (notionEnabled) {
            const notionPromise = (async () => {
              const rawRoot = await fetchChildren(blockUuid, true, true);
              const notionRootChildren = await unwrapNotionContainers(rawRoot, true, true);
              const casosList: Caso[] = [];
              const directRootQuestions: Questao[] = [];

              for (const child of notionRootChildren) {
                const rawTitle = getChildBlockTitle(child);

                if (child.type === "toggle") {
                  const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
                  const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
                  const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
                  if (categoryKey) {
                    const tagEmojis = extractQuestionTagEmojis(rawTitle, child.icon?.type === "emoji" ? child.icon.emoji : undefined);
                    directRootQuestions.push({
                      id: child.id,
                      numero,
                      topic,
                      categoryKey,
                      imageUrls: [],
                      respostaImageUrls: [],
                      caseLabel: block.nome || "Geral",
                      lastEditedTime: child.last_edited_time,
                      tagEmojis,
                    });
                    continue;
                  }
                  casosList.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
                } else if (isNavigableNotionContainer(child) && (rawTitle || child.has_children)) {
                  const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
                  const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
                  const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
                  if (categoryKey) {
                    const tagEmojis = extractQuestionTagEmojis(rawTitle, child.icon?.type === "emoji" ? child.icon.emoji : undefined);
                    directRootQuestions.push({
                      id: child.id,
                      numero,
                      topic,
                      categoryKey,
                      imageUrls: [],
                      respostaImageUrls: [],
                      caseLabel: block.nome || "Geral",
                      lastEditedTime: child.last_edited_time,
                      tagEmojis,
                    });
                  } else {
                    casosList.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
                  }
                }
              }

              // Se o próprio bloco cadastrado é uma única Questão (ex: link copiado direto de um toggle de questão,
              // cujos filhos são parágrafos/imagens/toggle "Resposta"), encapsula o próprio bloco como questão única.
              const onlyRespostaCasos =
                casosList.length > 0 && casosList.every(c => c.nome.toLowerCase().includes("resposta"));
              const hasQuestionBody = notionRootChildren.some(
                c => c.type === "image" || (c.type === "paragraph" && richText(c.paragraph?.rich_text).trim().length > 0)
              );
              if (directRootQuestions.length === 0 && (onlyRespostaCasos || (casosList.length === 0 && hasQuestionBody))) {
                const selfBlock = await fetchNotionBlock(blockUuid).catch(() => null);
                const selfTitle = selfBlock ? getChildBlockTitle(selfBlock) : block.nome;
                const parsedSelf = parseQuestaoTitle(selfTitle || block.nome);
                const selfIconEmoji = selfBlock?.icon?.type === "emoji" && selfBlock.icon.emoji ? [selfBlock.icon.emoji] : [];
                const selfCategory = detectCategory([...selfIconEmoji, ...parsedSelf.emojis]);
                if (selfCategory || onlyRespostaCasos || hasQuestionBody) {
                  if (onlyRespostaCasos) casosList.length = 0;
                  const selfTags = extractQuestionTagEmojis(selfTitle || block.nome, selfIconEmoji[0]);
                  directRootQuestions.push({
                    id: blockUuid,
                    numero: parsedSelf.numero || "1",
                    topic: parsedSelf.topic || selfTitle || block.nome,
                    categoryKey: selfCategory || "media",
                    imageUrls: [],
                    respostaImageUrls: [],
                    caseLabel: block.nome || "Questão",
                    lastEditedTime: selfBlock?.last_edited_time,
                    forceReload: true,
                    tagEmojis: selfTags,
                  });
                }
              }

              if (directRootQuestions.length > 0) {
                casosList.unshift({
                  id: blockUuid,
                  nome: block.nome || "Questões",
                  questoes: directRootQuestions,
                });
              }

              // Reconcilia em background: remove casos/questões no Supabase que deixaram de existir neste bloco do Notion
              const validCasoCleanIds = new Set(casosList.map(c => c.id.replace(/-/g, "")));
              const validDirectQCleanIds = new Set(directRootQuestions.map(q => q.id.replace(/-/g, "")));
              supabase
                .from("notion_questoes_banco")
                .select("id, caso_id, notion_last_edited_time")
                .or(`bloco_raiz_id.eq.${block.block_id},bloco_raiz_id.eq.${blockUuid},bloco_raiz_id.eq.${clean}`)
                .then(({ data: existingRows }) => {
                  if (!existingRows || existingRows.length === 0) return;
                  const staleIds = existingRows
                    .filter((r: any) => {
                      if (r.notion_last_edited_time === "local") return false;
                      const rClean = String(r.id).replace(/-/g, "");
                      const cClean = r.caso_id ? String(r.caso_id).replace(/-/g, "") : "";
                      if (cClean && cClean !== clean && validCasoCleanIds.has(cClean)) return false;
                      if ((!cClean || cClean === clean) && validDirectQCleanIds.has(rClean)) return false;
                      return true;
                    })
                    .map((r: any) => r.id);
                  if (staleIds.length > 0) {
                    supabase.from("notion_questoes_banco").delete().in("id", staleIds).then(() => {
                      bancoIdsLoadedPromise = null;
                      questoesDoBlocoCache.delete(clean);
                      questoesDetalhesCache.delete(clean);
                      try {
                        localStorage.removeItem(`notion_c_ids_${clean}`);
                        localStorage.removeItem(`notion_c_det_${clean}`);
                      } catch {}
                    }, () => {});
                  }
                }, () => {});

              return casosList;
            })().catch((err: any) => {
              notionErrorMsg = err?.message || "Erro ao consultar o Notion.";
              return null;
            });

            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 3000)
            );

            const result = await Promise.race([notionPromise, timeoutPromise]);
            if (result !== null) {
              built = result;
              loadedFromNotion = true;
            }
          }

          if (!loadedFromNotion) {
            // Se Notion demorou > 3 segundos, falhou ou não está configurado -> pega do Supabase
            const [rawSbRootChildren, dbRows] = await Promise.all([
              fetchChildren(blockUuid, false, false).catch(() => [] as NotionAPIBlock[]),
              supabase
                .from("notion_questoes_banco")
                .select("id, caso_id, caso_nome, numero, topico, categoria")
                .or(`bloco_raiz_id.eq.${block.block_id},bloco_raiz_id.eq.${blockUuid},bloco_raiz_id.eq.${clean}`)
                .then(r => (r.data ?? []) as any[], () => [] as any[]),
            ]);
            const sbRootChildren = await unwrapNotionContainers(rawSbRootChildren, false, false).catch(() => rawSbRootChildren);

            if (sbRootChildren.length > 0) {
              const directRootQuestions: Questao[] = [];
              for (const child of sbRootChildren) {
                const rawTitle = getChildBlockTitle(child);

                if (isNavigableNotionContainer(child)) {
                  const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
                  const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
                  const categoryKey = detectCategory([...iconEmoji, ...textEmojis]);
                  if (categoryKey) {
                    const tagEmojis = extractQuestionTagEmojis(rawTitle, child.icon?.type === "emoji" ? child.icon.emoji : undefined);
                    directRootQuestions.push({
                      id: child.id,
                      numero,
                      topic,
                      categoryKey,
                      imageUrls: [],
                      respostaImageUrls: [],
                      caseLabel: block.nome || "Geral",
                      tagEmojis,
                    });
                    continue;
                  }
                  if (rawTitle || child.has_children) {
                    built.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
                  }
                }
              }
              if (directRootQuestions.length > 0) {
                built.unshift({
                  id: blockUuid,
                  nome: block.nome || "Questões",
                  questoes: directRootQuestions,
                });
              }
            } else if (dbRows.length > 0) {
              const seenCasos = new Map<string, Caso>();
              for (const row of dbRows) {
                const cId = row.caso_id || blockUuid;
                const cNome = row.caso_nome || block.nome || "Geral";
                const key = cId.replace(/-/g, "") || cNome;
                if (!seenCasos.has(key)) {
                  seenCasos.set(key, { id: cId, nome: cNome, questoes: [] });
                }
                if (!row.caso_id || row.caso_id.replace(/-/g, "") === clean) {
                  const tagEmojis = extractQuestionTagEmojis("", undefined, row.topico);
                  const cleanTopic = row.topico ? parseQuestaoTitle(row.topico).topic : "";
                  seenCasos.get(key)!.questoes.push({
                    id: row.id,
                    numero: row.numero || "",
                    topic: cleanTopic || "",
                    categoryKey: (row.categoria || "media") as CategoryKey,
                    imageUrls: [],
                    respostaImageUrls: [],
                    caseLabel: cNome,
                    tagEmojis,
                  });
                }
              }
              built = Array.from(seenCasos.values());
            } else if (notionErrorMsg) {
              if (!cancelled) setError(notionErrorMsg);
            }
          }
        } catch (e: any) {
          if (!cancelled) setError(e.message);
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
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [block.block_id, effectiveStatus, refreshKey, builder.builderRefreshSeq]);

  const displayFilteredItens = useMemo(() => {
    if (!filteredItens) return null;
    if (!classificacaoFiltro || classificacaoFiltro === "todas") return filteredItens;
    return filteredItens.filter(item => {
      const cat = overrides.get(item.id) ?? item.categoryKey;
      if (classificacaoFiltro === "personalizadas") return overrides.has(item.id);
      if (classificacaoFiltro === "padrao") return !overrides.has(item.id);
      return cat === classificacaoFiltro;
    });
  }, [filteredItens, classificacaoFiltro, overrides]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
      <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Carregando questões...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center py-10 gap-2">
      <p className="text-[11px] text-red-400">{error}</p>
      <p className="text-[10px] text-slate-600">Verifique se a integração Notion tem acesso a este bloco.</p>
    </div>
  );

  if (effectiveStatus !== "todas") {
    if (!displayFilteredItens || displayFilteredItens.length === 0) {
      const msgMap: Record<string, string> = {
        erros: "Nenhuma questão errada neste caderno.",
        mais_erros: "Nenhuma questão errada neste caderno.",
        nao_feitas: "Todas as questões deste caderno já foram respondidas!",
        feitas_hoje: "Nenhuma questão respondida hoje neste caderno.",
      };
      return <p className="text-[11px] text-slate-600 italic text-center py-6">{msgMap[effectiveStatus] || "Nenhuma questão encontrada com os filtros selecionados."}</p>;
    }

    if (showQuestionMap) {
      const byCaso = new Map<string, Questao[]>();
      for (const item of displayFilteredItens) {
        const label = item.caseLabel || "Geral";
        const arr = byCaso.get(label) ?? [];
        arr.push({
          id: item.id,
          numero: item.numero,
          topic: item.topic,
          categoryKey: item.categoryKey,
          imageUrls: [],
          respostaImageUrls: [],
          caseLabel: label,
        });
        byCaso.set(label, arr);
      }
      return (
        <div className="flex flex-col gap-4 my-1">
          {[...byCaso.entries()].map(([casoLabel, qList]) => (
            <div key={casoLabel} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-medium text-slate-200">{casoLabel}</span>
                <span className="text-[11px] text-slate-500 tabular-nums">{qList.length} questões</span>
              </div>
              <CasoProgressMap
                questoes={qList}
                casoNome={casoLabel}
                user={user}
                duvidasIds={duvidasIds}
                onToggleDuvida={onToggleDuvida}
                onAnswered={onAnswered}
                resultadosMap={resultadosMap}
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 pl-4 border-l border-indigo-500/20 ml-4 my-1">
        {displayFilteredItens.map((item, idx) => (
          <div key={item.id} className={idx < displayFilteredItens.length - 1 ? "border-b border-white/[0.05] pb-1 mb-1" : ""}>
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => builder.openCreateCaso(block.block_id, block.nome, casos.map(c => ({ id: c.id, nome: c.nome })))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold transition-colors"
          >
            <FolderPlus size={13} />
            <span>+ Novo Caso</span>
          </button>
          <button
            type="button"
            onClick={() => builder.openCreateQuestao(block.block_id, casos[0]?.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-colors"
          >
            <FilePlus2 size={13} />
            <span>+ Nova Questão</span>
          </button>
        </div>

        {showQuestionMap && casos.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpandSignal(prev => ({ mode: "expand", seq: (prev?.seq ?? 0) + 1 }))}
              className="rounded-lg border border-white/[0.08] bg-[#0d1220] px-2.5 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Expandir todos os casos
            </button>
            <button
              type="button"
              onClick={() => setExpandSignal(prev => ({ mode: "collapse", seq: (prev?.seq ?? 0) + 1 }))}
              className="rounded-lg border border-white/[0.08] bg-[#0d1220] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Recolher todos
            </button>
          </div>
        )}
      </div>

      {casos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-[11px] text-slate-500 italic">Nenhum caso criado neste caderno ainda.</p>
          <button
            type="button"
            onClick={() => builder.openCreateCaso(block.block_id, block.nome, [])}
            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25"
          >
            + Criar primeiro Caso
          </button>
        </div>
      ) : (
        casos.map((caso, idx) => (
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
            showQuestionMap={showQuestionMap}
            expandSignal={expandSignal}
            onMoveUp={(id) => handleMoveCaso(id, "up")}
            onMoveDown={(id) => handleMoveCaso(id, "down")}
            onDropCaso={handleDropCaso}
            isFirst={idx === 0}
            isLast={idx === casos.length - 1}
            refreshKey={refreshKey}
            onPrintCaso={onPrintCaso}
            rootBlockId={block.block_id}
            parentBlockId={block.block_id}
          />
        ))
      )}
    </div>
  );
}

function BlocoStatsBadge({
  block,
  blockId,
  resultadosMap,
  duvidasIds,
  onStatsLoaded,
}: {
  block?: NotionBlockRow;
  blockId?: string;
  resultadosMap?: Map<string, QuestaoStats>;
  duvidasIds: Set<string>;
  onStatsLoaded?: (stats: { acertos: number; erros: number; duvidas: number; total: number }) => void;
}) {
  const { builderRefreshSeq } = useContext(BuilderActionsContext);
  const targetId = block?.block_id || blockId || "";
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    if (!targetId) { setIds([]); return; }
    setIds(null);
    collectQuestaoIds(targetId)
      .then(res => { if (active) setIds(res); })
      .catch(() => { if (active) setIds([]); });
    return () => { active = false; };
  }, [targetId, builderRefreshSeq]);

  let acertos = 0, erros = 0, duvidas = 0;
  if (ids && resultadosMap) {
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
  const abertas = Math.max(0, ids.length - respondidas);

  const aproveitamentoClasses =
    aproveitamento === null
      ? "border-slate-800 text-slate-500 bg-slate-900/60"
      : aproveitamento >= 70
      ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
      : aproveitamento >= 50
      ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
      : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-normal shrink-0 select-none flex-nowrap whitespace-nowrap">
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
      <span className="text-slate-500 text-[9px]" title="Questões ainda não respondidas">
        {abertas} abertas
      </span>
      <span className={`px-1.5 py-0.5 rounded border tabular-nums ${aproveitamentoClasses}`} title="Aproveitamento">
        {aproveitamento === null ? "—" : `${aproveitamento}%`}
      </span>
    </div>
  );
}

function MateriaStatsBadge({
  blocks,
  resultadosMap,
  duvidasIds,
}: {
  blocks: NotionBlockRow[];
  resultadosMap?: Map<string, QuestaoStats>;
  duvidasIds: Set<string>;
}) {
  const { builderRefreshSeq } = useContext(BuilderActionsContext);
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    if (!blocks || blocks.length === 0) {
      setIds([]);
      return;
    }
    setIds(null);

    Promise.all(blocks.map(b => collectQuestaoIds(b.block_id)))
      .then(resArrays => {
        if (!active) return;
        const all = resArrays.flat();
        setIds(Array.from(new Set(all)));
      })
      .catch(() => {
        if (active) setIds([]);
      });

    return () => { active = false; };
  }, [blocks, builderRefreshSeq]);

  let acertos = 0, erros = 0, duvidas = 0;
  if (ids && resultadosMap) {
    for (const id of ids) {
      const status = resultadosMap.get(id)?.ultimo;
      if (status === "acerto") acertos++;
      else if (status === "erro") erros++;
      if (duvidasIds.has(id)) duvidas++;
    }
  }

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
    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-normal shrink-0 select-none flex-nowrap whitespace-nowrap">
      <span className="text-slate-400">{ids.length} quest.</span>
      <span className="text-emerald-400/90 flex items-center gap-0.5 font-normal" title="Total de acertos na matéria">
        <Check size={11} className="text-emerald-400/80 stroke-[2]" />
        {acertos}
      </span>
      <span className="text-rose-400/90 flex items-center gap-0.5 font-normal" title="Total de erros na matéria">
        <X size={11} className="text-rose-400/80 stroke-[2]" />
        {erros}
      </span>
      <span className="text-amber-400/90 flex items-center gap-0.5 font-normal" title="Total em dúvida na matéria">
        <Flag size={10} className="text-amber-400/80 fill-amber-400/10" />
        {duvidas}
      </span>
      <span className={`px-1.5 py-0.5 rounded border tabular-nums ${aproveitamentoClasses}`} title="Aproveitamento geral na matéria">
        {aproveitamento === null ? "—" : `${aproveitamento}%`}
      </span>
    </div>
  );
}

function TotalBancoStatsBadge({ blocks }: { blocks: NotionBlockRow[] }) {
  const { builderRefreshSeq } = useContext(BuilderActionsContext);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!blocks || blocks.length === 0) {
      setTotal(0);
      return;
    }
    Promise.all(blocks.map(b => collectQuestaoIds(b.block_id)))
      .then(resArrays => {
        if (!active) return;
        const all = new Set(resArrays.flat());
        setTotal(all.size);
      })
      .catch(() => { if (active) setTotal(0); });
    return () => { active = false; };
  }, [blocks, builderRefreshSeq]);

  if (total === null) {
    return (
      <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de questões cadastradas no banco">
        <BookMarked size={11} className="text-indigo-400/80" />
        <span className="text-indigo-300/80 font-medium">... questões</span>
      </span>
    );
  }

  return (
    <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de questões cadastradas em todos os cadernos">
      <BookMarked size={11} className="text-indigo-400/80" />
      <span className="text-indigo-300 font-bold">{total} questões</span>
    </span>
  );
}

// Face/ícone e cor de cada nível de dificuldade, usado no badge do bloquinho
const FACE_EMOJI: Record<CategoryKey, string> = {
  bonus: "🎉", faceis: "😊", atencao: "🔵", lacuna: "⛳", media: "😐", dificil: "😞", ultrahard: "🟣",
  dominada: "🏆", treinar: "🧠", revisar: "🔁",
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
      className={`relative flex flex-col gap-1 p-2 rounded-lg border text-left transition-colors shrink-0 w-[92px] ${tierClasses} ${
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
  const { builderRefreshSeq } = useContext(BuilderActionsContext);
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
  }, [block.block_id, builderRefreshSeq]);

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
          let cAcertos = 0, cErros = 0, cDuvidas = 0;
          for (const q of qs) {
            const st = resultadosMap.get(q.id)?.ultimo;
            if (st === "acerto") cAcertos++;
            else if (st === "erro") cErros++;
            if (duvidasIds.has(q.id)) cDuvidas++;
          }
          const cRespondidas = cAcertos + cErros;
          const cPct = cRespondidas > 0 ? Math.round((cAcertos / cRespondidas) * 100) : null;
          const aproveitamentoClasses =
            cPct === null
              ? "border-slate-800 text-slate-500 bg-slate-900/60"
              : cPct >= 70
              ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
              : cPct >= 50
              ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
              : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

          return (
            <div key={caseLabel} className="relative flex flex-col gap-2">
              <button
                onClick={() => toggleExpandido(caseLabel)}
                className="relative z-10 w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border border-white/[0.06] bg-[#111623] hover:border-white/[0.14] transition-colors text-left"
              >
                <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">
                  {icon}
                </span>
                <span className="flex-1 text-[11px] font-bold text-slate-200 truncate">
                  {idx + 1}. {caseLabel}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] shrink-0 tabular-nums">
                  <span className="text-slate-400">{qs.length} quest.</span>
                  <span className="text-emerald-400 flex items-center gap-0.5"><Check size={10} />{cAcertos}</span>
                  <span className="text-rose-400 flex items-center gap-0.5"><X size={10} />{cErros}</span>
                  <span className="text-amber-400 flex items-center gap-0.5"><Flag size={9} />{cDuvidas}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] ${aproveitamentoClasses}`}>{cPct === null ? "—" : `${cPct}%`}</span>
                </div>
                <ChevronDown size={13} className={`text-slate-500 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
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
  showQuestionMap = false,
  onPrintCaderno,
  onPrintCaso,
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
  showQuestionMap?: boolean;
  onPrintCaderno?: (block: NotionBlockRow) => void;
  onPrintCaso?: (caso: Caso, questoes?: Questao[]) => void;
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
        // 1. Buscar primeiro no cache local / Supabase
        const localIcon = getLocalNotionCache(`icon_${clean}`);
        if (localIcon?.data && typeof localIcon.data === "string") {
          if (active) setBlockIcon(localIcon.data);
          return;
        }
        const sbIcon = await getSupabaseNotionCache(`icon_${clean}`);
        if (sbIcon?.data && typeof sbIcon.data === "string") {
          setLocalNotionCache(`icon_${clean}`, sbIcon.data);
          if (active) setBlockIcon(sbIcon.data);
          return;
        }

        // 2. Somente se não houver no Supabase e o Notion estiver ativo, consultar o Notion
        if (!(await isNotionEnabled())) return;
        const res = await fetch(`/api/notion/blocks/${clean}`);
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 || data?.code === "object_not_found" || data?.archived || data?.in_trash) {
          emitNotionIdChangeAlert({
            id: `caderno:${clean}`,
            tipo: "caderno_nao_encontrado",
            cadernoId: block.block_id,
            cadernoNome: block.nome,
            antigoId: block.block_id,
            detectedAt: new Date().toISOString(),
            mensagem: `O bloco do caderno "${block.nome}" (${block.block_id.slice(0, 8)}) foi alterado ou removido no Notion.`,
          });
          return;
        }
        if (res.ok && data.icon?.type === "emoji" && data.icon.emoji) {
          setLocalNotionCache(`icon_${clean}`, data.icon.emoji);
          setSupabaseNotionCache(`icon_${clean}`, data.icon.emoji).catch(() => {});
          if (active) setBlockIcon(data.icon.emoji);
        }
      } catch (e) {
        console.error("Erro ao carregar ícone do Notion:", e);
      }
    })();
    return () => { active = false; };
  }, [block.block_id, block.nome]);

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
      className={`flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-xl border transition-colors ${
        isDraggingOver ? "ring-2 ring-indigo-500/50 bg-indigo-500/10" : ""
      } ${
        showRedHighlight
          ? "bg-rose-500/[0.03] border-rose-500/25"
          : "bg-[#111623]/95 border-white/[0.06] hover:border-white/[0.12]"
      }`}
    >
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-1.5 min-w-0">
        <button
          onClick={() => onSelect ? onSelect(block) : setOpen(v => !v)}
          className="flex items-center gap-1.5 text-left flex-1 min-w-0 group overflow-hidden"
        >
          <span className="text-[9px] text-slate-500 w-3.5 h-3.5 flex items-center justify-center shrink-0 select-none">
            {onSelect ? "→" : open ? "▼" : "▶"}
          </span>
          <span className="text-sm shrink-0 select-none">{blockIcon}</span>
          <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden">
            <span className={`text-[13px] font-normal truncate ${
              showRedHighlight ? "text-rose-300" : "text-slate-300 group-hover:text-slate-100"
            }`}>
              {block.nome}
            </span>
            {block.descricao && (
              <span className="hidden sm:inline text-[10px] text-slate-400/70 font-normal truncate shrink min-w-0 whitespace-nowrap">
                {block.descricao}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 flex-nowrap whitespace-nowrap pl-5 sm:pl-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrintCaderno?.(block);
            }}
            title={`Imprimir caderno "${block.nome}" inteiro (com gabarito no final)`}
            className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-indigo-300 hover:bg-white/[0.08] hover:border-white/[0.15] transition-colors"
          >
            <Printer size={12} />
          </button>
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
                className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border transition-colors ${
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
                    className="absolute right-0 top-full mt-1.5 w-60 max-w-[calc(100vw-2.5rem)] z-50 bg-[#111623] border border-white/[0.12] rounded-2xl p-3 shadow-lg flex flex-col gap-2.5"
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
                          className="w-full text-center text-[12px] font-mono font-black text-indigo-300 bg-black/50 border border-indigo-500/30 rounded-lg py-1 focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          onClick={() => {
                            handleSaveOrdem();
                            setShowMenu(false);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0"
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
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#0d1220] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-[#0d1220] transition-colors"
                      >
                        <ArrowUp size={12} className="text-indigo-400" /> Subir
                      </button>
                      <button
                        onClick={() => { onMoveDown?.(block.id); }}
                        disabled={isLast}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#0d1220] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 disabled:opacity-30 disabled:hover:bg-[#0d1220] transition-colors"
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
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold transition-colors"
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
            showQuestionMap={showQuestionMap}
            onPrintCaso={onPrintCaso}
          />
        </div>
      )}
    </div>
  );
});


export default function NotionQuestionTab({ user }: { user: any }) {
  const [antiBrilho, toggleAntiBrilho] = useAntiBrilhoMode();
  const [blocks, setBlocks] = useState<NotionBlockRow[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<NotionBlockRow | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [duvidasIds, setDuvidasIds] = useState<Set<string>>(new Set());
  const [classificationOverrides, setClassificationOverrides] = useState<Map<string, CategoryKey>>(new Map());
  const [resultadosMap, setResultadosMap] = useState<Map<string, QuestaoStats>>(new Map());
  const [feitasHojeIds, setFeitasHojeIds] = useState<string[]>([]);
  const [respostasHojeMap, setRespostasHojeMap] = useState<Map<string, { data: string; horario: string; correto: string }>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);
  const [builderRefreshSeq, setBuilderRefreshSeq] = useState(0);
  
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const handleAnswered = useCallback(() => setStatsRefreshTrigger(v => v + 1), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [idChangeAlerts, setIdChangeAlerts] = useState<NotionIdChangeAlert[]>([]);
  const [orphanIdAlerts, setOrphanIdAlerts] = useState<NotionIdChangeAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("notion_dismissed_id_alerts");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const [migratingAlertId, setMigratingAlertId] = useState<string | null>(null);

  // Carrega avisos salvos de alteração de ID no Notion (via sync ou fallback 404)
  useEffect(() => {
    const loadStoredAlerts = () => {
      try {
        const raw = localStorage.getItem("notion_id_change_alerts");
        setIdChangeAlerts(raw ? JSON.parse(raw) : []);
      } catch {
        setIdChangeAlerts([]);
      }
    };
    loadStoredAlerts();
    window.addEventListener("notion-id-alerts-updated", loadStoredAlerts);
    return () => window.removeEventListener("notion-id-alerts-updated", loadStoredAlerts);
  }, []);

  // Verifica automaticamente no Supabase se algum ID do histórico/dúvidas do usuário não existe mais no banco atual (sem disparar chamadas ao Notion)
  useEffect(() => {
    let active = true;
    if (blocks.length === 0) return;
    if (resultadosMap.size === 0 && duvidasIds.size === 0 && classificationOverrides.size === 0) {
      return;
    }

    (async () => {
      try {
        await ensureBancoIdsLoaded();
        if (!active) return;

        const allCleanKnown = new Set<string>();
        let indexedBlocksCount = 0;

        await Promise.all(
          blocks.map(async b => {
            const clean = b.block_id.replace(/-/g, "");
            const bancoIds = bancoIdsByRootCache.get(clean);
            if (bancoIds && bancoIds.length > 0) {
              indexedBlocksCount++;
              for (const qid of bancoIds) allCleanKnown.add(qid.replace(/-/g, "").toLowerCase());
              return;
            }
            const sbCache = await getSupabaseNotionCache(`ids_${clean}`);
            if (sbCache?.data && Array.isArray(sbCache.data)) {
              indexedBlocksCount++;
              for (const qid of sbCache.data) allCleanKnown.add(String(qid).replace(/-/g, "").toLowerCase());
            }
          })
        );

        if (!active) return;
        // Só valida se todos os cadernos estiverem indexados no Supabase (para evitar falso positivo)
        if (indexedBlocksCount < blocks.length || allCleanKnown.size === 0) {
          setOrphanIdAlerts([]);
          return;
        }

        const userIds = new Set<string>([
          ...resultadosMap.keys(),
          ...duvidasIds,
          ...classificationOverrides.keys(),
        ]);

        const orphans: string[] = [];
        for (const uid of userIds) {
          const cleanUid = uid.replace(/-/g, "").toLowerCase();
          if (!/^[a-f0-9]{32}$/.test(cleanUid)) continue;
          if (!allCleanKnown.has(cleanUid)) {
            orphans.push(uid);
          }
        }

        if (orphans.length > 0 && active) {
          setOrphanIdAlerts([
            {
              id: `orphan-summary:${orphans.length}:${orphans[0].slice(0, 8)}`,
              tipo: "historico_orfao",
              antigoId: orphans[0],
              detectedAt: new Date().toISOString(),
              mensagem: `${orphans.length} questão(ões) do seu histórico/dúvidas não correspondem mais a nenhum bloco atual (${orphans.slice(0, 3).map(o => o.slice(0, 8)).join(", ")}${orphans.length > 3 ? "…" : ""}). O ID do bloco no Notion pode ter sido alterado ou removido.`,
            },
          ]);
        } else if (active) {
          setOrphanIdAlerts([]);
        }
      } catch {
        // ignore check errors
      }
    })();

    return () => { active = false; };
  }, [blocks, resultadosMap, duvidasIds, classificationOverrides]);

  const visibleIdAlerts = useMemo(() => {
    const hasHistory = resultadosMap.size > 0 || duvidasIds.size > 0 || classificationOverrides.size > 0;
    const merged = hasHistory ? [...idChangeAlerts, ...orphanIdAlerts] : [...idChangeAlerts];
    const seen = new Set<string>();
    return merged.filter(a => {
      if (dismissedAlertIds.has(a.id) || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [idChangeAlerts, orphanIdAlerts, dismissedAlertIds, resultadosMap.size, duvidasIds.size, classificationOverrides.size]);

  const handleDismissAlert = useCallback((alertId: string) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem("notion_dismissed_id_alerts", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const handleDismissAllAlerts = useCallback(() => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      for (const a of visibleIdAlerts) next.add(a.id);
      try {
        localStorage.setItem("notion_dismissed_id_alerts", JSON.stringify([...next]));
        localStorage.removeItem("notion_id_change_alerts");
      } catch {}
      return next;
    });
    setIdChangeAlerts([]);
  }, [visibleIdAlerts]);

  const handleMigrateAlertHistory = useCallback(async (alertItem: NotionIdChangeAlert) => {
    if (!user?.id || !alertItem.novoId) return;
    setMigratingAlertId(alertItem.id);
    try {
      await Promise.all([
        supabase
          .from("notion_respostas")
          .update({ questao_id: alertItem.novoId })
          .eq("user_id", user.id)
          .eq("questao_id", alertItem.antigoId),
        supabase
          .from("notion_duvidas")
          .update({ questao_id: alertItem.novoId })
          .eq("user_id", user.id)
          .eq("questao_id", alertItem.antigoId),
        supabase
          .from("notion_classificacoes")
          .update({ questao_id: alertItem.novoId })
          .eq("user_id", user.id)
          .eq("questao_id", alertItem.antigoId),
      ]);
      handleDismissAlert(alertItem.id);
      setStatsRefreshTrigger(v => v + 1);
    } catch (e) {
      console.error("Erro ao migrar histórico para o novo ID:", e);
    } finally {
      setMigratingAlertId(null);
    }
  }, [user?.id, handleDismissAlert]);

  const [createCasoModal, setCreateCasoModal] = useState<{
    isOpen: boolean;
    rootBlockId: string;
    parentBlockId: string;
    parentNome: string;
    isSubcaso: boolean;
    existingCasos?: { id: string; nome: string }[];
  }>({ isOpen: false, rootBlockId: "", parentBlockId: "", parentNome: "", isSubcaso: false });

  const [questaoModal, setQuestaoModal] = useState<{
    isOpen: boolean;
    defaultRootBlockId?: string;
    defaultCasoId?: string;
    editingQuestao?: QuestaoInitialEdit | null;
  }>({ isOpen: false });

  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    rootBlockId: string;
    fromCasoId: string;
    questao: Questao | null;
  }>({ isOpen: false, rootBlockId: "", fromCasoId: "", questao: null });

  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState(""); const [formNome, setFormNome] = useState(""); const [formDesc, setFormDesc] = useState(""); const [formMateria, setFormMateria] = useState("");
  const [isLocalNewBlock, setIsLocalNewBlock] = useState(false);
  
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [notionViewMode, setNotionViewMode] = useState<"quadros" | "lista" | "mapa">("quadros");
  const [materiasListaAbertas, setMateriasListaAbertas] = useState<Set<string>>(() => new Set());
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "nao_feitas" | "feitas_hoje" | "mais_erros">("todas");
  const [classificacaoFiltro, setClassificacaoFiltro] = useState<string>("todas");
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
    const updatedBlocks = newBlocks.map((b, index) => ({ ...b, ordem: index + 1 }));
    const reorderedIds = new Set(updatedBlocks.map(block => block.id));
    setBlocks(prev => [...prev.filter(block => !reorderedIds.has(block.id)), ...updatedBlocks]);
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
      const target = prev.find(b => b.id === blockId);
      if (!target) return prev;
      const subject = target.materia?.trim() || "Sem Matéria";
      const newBlocks = prev.filter(b => (b.materia?.trim() || "Sem Matéria") === subject)
        .sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER));
      const index = newBlocks.findIndex(b => b.id === blockId);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newBlocks.length) return prev;
      
      const [moved] = newBlocks.splice(index, 1);
      newBlocks.splice(newIndex, 0, moved);
      
      handleReorder(newBlocks);
      return newBlocks;
    });
  }, [handleReorder]);

  const handleDropBlock = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setBlocks(prev => {
      const dragged = prev.find(b => b.id === draggedId);
      const target = prev.find(b => b.id === targetId);
      if (!dragged || !target || (dragged.materia?.trim() || "Sem Matéria") !== (target.materia?.trim() || "Sem Matéria")) return prev;
      const subject = target.materia?.trim() || "Sem Matéria";
      const newBlocks = prev.filter(b => (b.materia?.trim() || "Sem Matéria") === subject)
        .sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER));
      const dragIndex = newBlocks.findIndex(b => b.id === draggedId);
      const targetIndex = newBlocks.findIndex(b => b.id === targetId);
      if (dragIndex === -1 || targetIndex === -1) return prev;

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

  const fetchClassifications = useCallback(async () => {
    if (!user?.id) {
      setClassificationOverrides(new Map());
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notion_classificacoes")
        .select("questao_id, classificacao")
        .eq("user_id", user.id);
      if (error) throw error;
      const next = new Map<string, CategoryKey>();
      for (const row of data ?? []) {
        if (CATEGORIES.some(category => category.key === row.classificacao)) {
          next.set(row.questao_id, row.classificacao as CategoryKey);
        }
      }
      setClassificationOverrides(next);
    } catch (error) {
      console.error("Erro ao buscar classificações pessoais:", error);
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

  const handleForceSyncNotion = useCallback(async () => {
    setLoadingBlocks(true);
    clearNotionClientCache();
    setRefreshKey(v => v + 1);
    try {
      await Promise.all([
        fetchBlocks(),
        fetchResultados(),
        fetchDuvidas()
      ]);
    } finally {
      setLoadingBlocks(false);
    }
  }, [fetchBlocks, fetchResultados, fetchDuvidas]);

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
      fetchClassifications();
    } else {
      setDuvidasIds(new Set());
      setClassificationOverrides(new Map());
      setResultadosMap(new Map());
      setFeitasHojeIds([]);
      setRespostasHojeMap(new Map());
    }
  }, [user?.id, fetchDuvidas, fetchResultados, fetchClassifications, statsRefreshTrigger]);

  const handleUpdateClassification = useCallback(async (questionId: string, classification: CategoryKey | null) => {
    if (!user?.id) return;
    const previous = classificationOverrides;
    setClassificationOverrides(current => {
      const next = new Map(current);
      if (classification) next.set(questionId, classification);
      else next.delete(questionId);
      return next;
    });
    try {
      if (classification) {
        const { error } = await supabase.from("notion_classificacoes").upsert({
          questao_id: questionId,
          user_id: user.id,
          classificacao: classification,
        }, { onConflict: "user_id,questao_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notion_classificacoes")
          .delete().eq("questao_id", questionId).eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Erro ao salvar classificação da questão:", error);
      setClassificationOverrides(previous);
      alert("Não foi possível salvar a classificação. Confira a configuração da tabela no Supabase.");
    }
  }, [user?.id, classificationOverrides]);

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
      const notionId = extractNotionBlockId(formId);
      const { error } = await supabase.from("notion_blocks").insert({
        block_id: notionId,
        nome: formNome.trim(),
        descricao: formDesc.trim() || null,
        materia: formMateria.trim() || null,
      });
      if (error) throw error;
      if (isLocalNewBlock) {
        await writeSupabaseCacheBlocks(notionId, []).catch(() => {});
      }
      clearNotionClientCache();
      setFormId(""); setFormNome(""); setFormDesc(""); setFormMateria(""); setIsLocalNewBlock(false); setShowForm(false);
      await fetchBlocks();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const triggerBuilderRefresh = useCallback(() => {
    clearNotionClientCache();
    setBuilderRefreshSeq(v => v + 1);
    setStatsRefreshTrigger(v => v + 1);
  }, []);

  const builderContextValue = useMemo<BuilderActionsContextValue>(() => ({
    builderRefreshSeq,
    openCreateCaso: (rootBlockId, rootNome, existingCasos) => {
      setCreateCasoModal({
        isOpen: true,
        rootBlockId,
        parentBlockId: rootBlockId,
        parentNome: rootNome,
        isSubcaso: false,
        existingCasos,
      });
    },
    openCreateSubcaso: (rootBlockId, parentCasoId, parentCasoNome) => {
      setCreateCasoModal({
        isOpen: true,
        rootBlockId,
        parentBlockId: parentCasoId,
        parentNome: parentCasoNome,
        isSubcaso: true,
      });
    },
    openCreateQuestao: (rootBlockId, defaultCasoId) => {
      setQuestaoModal({
        isOpen: true,
        defaultRootBlockId: rootBlockId || selectedBlock?.block_id || blocks[0]?.block_id,
        defaultCasoId,
        editingQuestao: null,
      });
    },
    openEditQuestao: (rootBlockId, casoId, casoNome, questao) => {
      void (async () => {
        let enriched = questao;
        if (questao.imageUrls.length === 0 && !questao.enunciadoTexto && !questao.resposta) {
          try {
            const full = await fetchQuestaoFullData(questao.id);
            enriched = {
              ...questao,
              enunciadoTexto: full.textEnunciado ?? questao.enunciadoTexto,
              imageUrls: full.imgs.length > 0 ? full.imgs : questao.imageUrls,
              resposta: full.textResp ?? questao.resposta,
              respostaImageUrls: full.rImgs.length > 0 ? full.rImgs : questao.respostaImageUrls,
            };
          } catch {}
        }
        setQuestaoModal({
          isOpen: true,
          defaultRootBlockId: rootBlockId,
          defaultCasoId: casoId,
          editingQuestao: {
            id: enriched.id,
            rootBlockId,
            casoId,
            casoNome,
            numero: enriched.numero,
            topic: enriched.topic,
            categoryKey: enriched.categoryKey as BuilderCategoryKey,
            enunciadoTexto: enriched.enunciadoTexto,
            imageUrls: enriched.imageUrls,
            resposta: enriched.resposta,
            respostaImageUrls: enriched.respostaImageUrls,
          },
        });
      })();
    },
    openMoveQuestao: (rootBlockId, casoId, questao) => {
      setMoveModal({
        isOpen: true,
        rootBlockId,
        fromCasoId: casoId,
        questao,
      });
    },
    deleteQuestao: async (rootBlockId, casoId, questao) => {
      if (!confirm(`Excluir a questão ${questao.numero || ""} "${questao.topic || ""}"?`)) return;
      try {
        await deleteQuestaoFromCaso({
          rootBlockId,
          parentCasoId: casoId,
          questaoId: questao.id,
        });
        triggerBuilderRefresh();
      } catch (e: any) {
        alert(e?.message || "Erro ao excluir questão.");
      }
    },
    deleteCaso: async (rootBlockId, parentBlockId, casoId, casoNome) => {
      if (!confirm(`Remover "${casoNome}"? As questões cadastradas dentro dele também serão removidas.`)) return;
      try {
        await deleteCasoOrSubcaso({
          rootBlockId,
          parentBlockId,
          casoId,
          deleteQuestionsInside: true,
        });
        triggerBuilderRefresh();
      } catch (e: any) {
        alert(e?.message || "Erro ao remover caso.");
      }
    },
  }), [builderRefreshSeq, blocks, selectedBlock?.block_id, triggerBuilderRefresh]);

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
    for (const materiaBlocks of map.values()) {
      materiaBlocks.sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER));
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

  const [printModalState, setPrintModalState] = useState<{
    isOpen: boolean;
    title: string;
    subTitle?: string;
    questions: PrintableNotionQuestion[];
    isLoading: boolean;
    loadingProgress?: string;
  }>({
    isOpen: false,
    title: "",
    questions: [],
    isLoading: false,
  });

  const handlePrintCaderno = useCallback(async (block: NotionBlockRow) => {
    setPrintModalState({
      isOpen: true,
      title: block.nome,
      subTitle: block.materia ? `Caderno: ${block.nome} • Matéria: ${block.materia}` : `Caderno: ${block.nome}`,
      questions: [],
      isLoading: true,
      loadingProgress: "Buscando questões do caderno no banco...",
    });

    try {
      const cleanId = block.block_id.replace(/-/g, "");

      // 1. Tentar buscar direto do Supabase notion_questoes_banco
      const { data: dbQuestoes, error } = await supabase
        .from("notion_questoes_banco")
        .select("*")
        .or(`bloco_raiz_id.eq.${block.block_id},bloco_raiz_id.eq.${cleanId}`)
        .order("caso_nome", { ascending: true })
        .order("numero", { ascending: true });

      if (!error && dbQuestoes && dbQuestoes.length > 0) {
        let sortedQuestoes = [...dbQuestoes];
        try {
          const savedCasoOrder = localStorage.getItem(`notion_casos_order_${block.block_id}`);
          if (savedCasoOrder) {
            const orderIds: string[] = JSON.parse(savedCasoOrder);
            const map = new Map<string, number>();
            orderIds.forEach((id, i) => {
              map.set(id, i);
              map.set(id.replace(/-/g, ""), i);
            });
            sortedQuestoes.sort((a, b) => {
              const casoA = a.caso_id ? (map.get(a.caso_id) ?? 999) : 999;
              const casoB = b.caso_id ? (map.get(b.caso_id) ?? 999) : 999;
              if (casoA !== casoB) return casoA - casoB;
              return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
            });
          } else {
            sortedQuestoes.sort((a, b) => {
              const cComp = (a.caso_nome || "").localeCompare(b.caso_nome || "", "pt-BR");
              if (cComp !== 0) return cComp;
              return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
            });
          }
        } catch (e) {}

        const mapped: PrintableNotionQuestion[] = sortedQuestoes.map((b: any, idx: number) => ({
          id: b.id,
          numero: b.numero || String(idx + 1),
          topic: b.topico || "",
          caseLabel: b.caso_nome || block.nome,
          categoryKey: b.categoria,
          enunciadoTexto: b.enunciado_texto || undefined,
          imageUrls: Array.isArray(b.imagens_urls) ? b.imagens_urls : [],
          respostaText: b.gabarito_texto || undefined,
          respostaImageUrls: Array.isArray(b.gabarito_imagens_urls) ? b.gabarito_imagens_urls : [],
        }));

        setPrintModalState(prev => ({
          ...prev,
          questions: mapped,
          isLoading: false,
        }));
        return;
      }

      // 2. Se não estiver no banco, buscar via Notion API / cache local
      setPrintModalState(prev => ({ ...prev, loadingProgress: "Mapeando estrutura do Notion..." }));
      const details = await collectQuestaoDetails(block.block_id);

      const items = details.itens;
      const mapped: PrintableNotionQuestion[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setPrintModalState(prev => ({
          ...prev,
          loadingProgress: `Carregando questão ${i + 1} de ${items.length}...`,
        }));
        const full = await fetchQuestaoFullData(item.id);
        mapped.push({
          id: item.id,
          numero: item.numero || String(i + 1),
          topic: item.topic || "",
          caseLabel: item.caseLabel || block.nome,
          categoryKey: item.categoryKey,
          enunciadoTexto: full.textEnunciado,
          imageUrls: full.imgs,
          respostaText: full.textResp,
          respostaImageUrls: full.rImgs,
        });
      }

      setPrintModalState(prev => ({
        ...prev,
        questions: mapped,
        isLoading: false,
      }));
    } catch (err: any) {
      console.error("Erro ao preparar impressão do caderno:", err);
      alert("Erro ao carregar questões para impressão: " + (err.message || "Erro desconhecido"));
      setPrintModalState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handlePrintCaso = useCallback(async (caso: Caso, initialQuestoes?: Questao[]) => {
    setPrintModalState({
      isOpen: true,
      title: caso.nome,
      subTitle: `Caso: ${caso.nome}`,
      questions: [],
      isLoading: true,
      loadingProgress: "Buscando questões do caso...",
    });

    try {
      const cleanCasoId = caso.id.replace(/-/g, "");

      // 1. Tentar buscar direto do Supabase notion_questoes_banco
      const { data: dbQuestoes, error } = await supabase
        .from("notion_questoes_banco")
        .select("*")
        .in("caso_id", [caso.id, cleanCasoId])
        .order("numero", { ascending: true });

      if (!error && dbQuestoes && dbQuestoes.length > 0) {
        const mapped: PrintableNotionQuestion[] = dbQuestoes.map((b: any, idx: number) => ({
          id: b.id,
          numero: b.numero || String(idx + 1),
          topic: b.topico || "",
          caseLabel: b.caso_nome || caso.nome,
          categoryKey: b.categoria,
          enunciadoTexto: b.enunciado_texto || undefined,
          imageUrls: Array.isArray(b.imagens_urls) ? b.imagens_urls : [],
          respostaText: b.gabarito_texto || undefined,
          respostaImageUrls: Array.isArray(b.gabarito_imagens_urls) ? b.gabarito_imagens_urls : [],
        })).sort((a, b) => {
          const difficultyDiff = (CATEGORY_ORDER[a.categoryKey as CategoryKey] ?? 99) - (CATEGORY_ORDER[b.categoryKey as CategoryKey] ?? 99);
          return difficultyDiff || Number.parseInt(a.numero || "0", 10) - Number.parseInt(b.numero || "0", 10);
        });

        setPrintModalState(prev => ({
          ...prev,
          questions: mapped,
          isLoading: false,
        }));
        return;
      }

      // 2. Se temos initialQuestoes carregadas no CasoCard
      if (initialQuestoes && initialQuestoes.length > 0) {
        const mapped: PrintableNotionQuestion[] = [];
        for (let i = 0; i < initialQuestoes.length; i++) {
          const q = initialQuestoes[i];
          setPrintModalState(prev => ({
            ...prev,
            loadingProgress: `Carregando questão ${i + 1} de ${initialQuestoes.length}...`,
          }));

          let imgs = q.imageUrls;
          let rImgs = q.respostaImageUrls;
          let textResp = q.resposta;
          let textEnunc = q.enunciadoTexto;

          if (!imgs || imgs.length === 0) {
            const full = await fetchQuestaoFullData(q.id);
            imgs = full.imgs;
            rImgs = full.rImgs;
            textResp = full.textResp;
            textEnunc = full.textEnunciado ?? textEnunc;
          }

          mapped.push({
            id: q.id,
            numero: q.numero || String(i + 1),
            topic: q.topic || "",
            caseLabel: q.caseLabel || caso.nome,
            categoryKey: q.categoryKey,
            enunciadoTexto: textEnunc,
            imageUrls: imgs || [],
            respostaText: textResp,
            respostaImageUrls: rImgs || [],
          });
        }

        setPrintModalState(prev => ({
          ...prev,
          questions: mapped,
          isLoading: false,
        }));
        return;
      }

      // 3. Fallback: buscar via Notion API / árvore recursiva
      setPrintModalState(prev => ({ ...prev, loadingProgress: "Carregando questões do Notion..." }));
      const children = await fetchChildren(caso.id);
      const mapped: PrintableNotionQuestion[] = [];

      async function walk(chList: any[], label: string) {
        for (const child of chList) {
          if (child.type !== "toggle") continue;
          const rawTitle = richText(child.toggle?.rich_text ?? []);
          const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
          const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
          const emojis = [...iconEmoji, ...textEmojis];
          const categoryKey = detectCategory(emojis);

          if (categoryKey) {
            const full = await fetchQuestaoFullData(child.id);
            mapped.push({
              id: child.id,
              numero: numero || String(mapped.length + 1),
              topic,
              caseLabel: label,
              categoryKey,
              enunciadoTexto: full.textEnunciado,
              imageUrls: full.imgs,
              respostaText: full.textResp,
              respostaImageUrls: full.rImgs,
            });
          } else if (child.has_children) {
            const subChildren = await fetchChildren(child.id);
            await walk(subChildren, rawTitle || label);
          }
        }
      }

      await walk(children, caso.nome);

      setPrintModalState(prev => ({
        ...prev,
        questions: mapped,
        isLoading: false,
      }));
    } catch (err: any) {
      console.error("Erro ao preparar impressão do caso:", err);
      alert("Erro ao carregar questões para impressão: " + (err.message || "Erro desconhecido"));
      setPrintModalState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  return (
    <BuilderActionsContext.Provider value={builderContextValue}>
    <ClassificationContext.Provider value={{ overrides: classificationOverrides, updateClassification: handleUpdateClassification, canEdit: !!user?.id, classificacaoFiltro, setClassificacaoFiltro }}>
    <div className="flex flex-col gap-3 sm:gap-4 bg-[#080d1a] rounded-2xl border border-white/[0.06] p-2.5 sm:p-5 relative overflow-x-clip">

      {/* Sleek Ultra-Compact Header Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2.5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <BookMarked size={14} className="text-indigo-400" />
            </div>
            <h2 className="text-sm font-black text-white tracking-tight">Notion Question</h2>
          </div>

          {user && (
            <div className="flex items-center gap-1.5 sm:pl-2 sm:border-l sm:border-white/10 flex-wrap">
              <TotalBancoStatsBadge blocks={blocks} />
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

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {blocks.length > 0 && (
            <button
              type="button"
              onClick={() => builderContextValue.openCreateQuestao(selectedBlock?.block_id ?? blocks[0]?.block_id)}
              title="Criar questão (em Caso ou Subcaso), anexar imagem, escrever enunciado e resposta"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0"
            >
              <FilePlus2 size={13} />
              <span>+ Nova Questão</span>
            </button>
          )}
          <button
            onClick={toggleAntiBrilho}
            title={antiBrilho === 'noturno' ? "Modo Escuro (Dark Invertido) ativo para imagens — clique para alternar" : "Modo Original ativo para imagens — clique para alternar"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors shrink-0 ${
              antiBrilho === 'noturno'
                ? 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-500/40'
                : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border-slate-700'
            }`}
          >
            <Moon size={13} className={antiBrilho === 'noturno' ? "text-purple-400 fill-purple-400/20" : "text-slate-400"} />
            <span>🌙 Dark Imagens: {antiBrilho === 'noturno' ? "ON" : "OFF"}</span>
          </button>
          <button
            onClick={handleForceSyncNotion}
            title="Forçar sincronização em tempo real com o Notion (Limpa todos os caches)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors shrink-0"
          >
            <RefreshCw size={13} className={loadingBlocks ? "animate-spin text-indigo-400" : "text-indigo-400"} />
            <span className="hidden sm:inline">Sincronizar Notion</span>
          </button>
          <button
            onClick={() => setShowSyncModal(true)}
            title="Espelhar questões e salvar imagens permanentemente no Supabase (Carregamento ultra-rápido de 0ms)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shrink-0"
          >
            <Database size={13} className="text-white" />
            <span>Sincronizar Banco</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <Plus size={11} /> Novo Bloco
            </button>
          )}
        </div>
      </div>

      {showSyncModal && (
        <SyncBancoModal
          blocos={blocks}
          onClose={() => {
            setShowSyncModal(false);
            handleForceSyncNotion();
          }}
        />
      )}

      {/* Aviso de alteração ou remoção de ID de bloco no Notion */}
      {visibleIdAlerts.length > 0 && (
        <div className="relative z-10 flex flex-col gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-950/25 p-3.5 shadow-lg">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span>
                Aviso: Modificação de ID de bloco do Notion detectada ({visibleIdAlerts.length})
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/35 text-amber-200 text-[10px] font-bold transition-colors"
              >
                Sincronizar Banco
              </button>
              <button
                type="button"
                onClick={handleDismissAllAlerts}
                className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white text-[10px] font-medium transition-colors"
              >
                Dispensar todos
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {visibleIdAlerts.map(alertItem => (
              <div
                key={alertItem.id}
                className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-amber-500/20 bg-black/30 px-3 py-2 text-[11px]"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-semibold text-amber-200 truncate">
                    {alertItem.cadernoNome ? `${alertItem.cadernoNome}` : "Bloco Notion"}
                    {alertItem.casoNome ? ` • ${alertItem.casoNome}` : ""}
                    {alertItem.numero ? ` • Questão ${alertItem.numero}` : ""}
                    {alertItem.topico ? ` — ${alertItem.topico}` : ""}
                  </span>
                  <span className="text-[10.5px] text-amber-100/80 break-words">
                    {alertItem.mensagem}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {alertItem.novoId && user?.id && (
                    <button
                      type="button"
                      disabled={migratingAlertId === alertItem.id}
                      onClick={() => handleMigrateAlertHistory(alertItem)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition-colors disabled:opacity-50"
                    >
                      {migratingAlertId === alertItem.id ? "Atualizando..." : "Atualizar meu histórico"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDismissAlert(alertItem.id)}
                    title="Dispensar este aviso"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PrintNotionModal
        isOpen={printModalState.isOpen}
        onClose={() => setPrintModalState(prev => ({ ...prev, isOpen: false }))}
        title={printModalState.title}
        subTitle={printModalState.subTitle}
        questions={printModalState.questions}
        isLoading={printModalState.isLoading}
        loadingProgress={printModalState.loadingProgress}
      />

      {showForm && (
        <div className="border border-indigo-500/20 rounded-2xl bg-[#101526] p-5 flex flex-col gap-4 relative z-10 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">
              Cadastrar Bloco Notion
            </p>
            <button onClick={() => setShowForm(false)} className="text-slate-600 hover:text-slate-400"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID do Bloco *</label>
                <button
                  type="button"
                  onClick={() => {
                    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                      ? crypto.randomUUID()
                      : `${Date.now().toString(16)}-4000-8000-000000000000`;
                    setFormId(id);
                    setIsLocalNewBlock(true);
                  }}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Gerar ID local
                </button>
              </div>
              <input value={formId} onChange={e => { setFormId(e.target.value); setIsLocalNewBlock(false); }} placeholder="abc12345-... ou gere um ID local" className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
              <input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Caderno Azul" className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matéria</label>
              <input
                value={formMateria}
                onChange={e => setFormMateria(e.target.value)}
                placeholder="Ex: Matemática Financeira"
                list="materias-cadastradas"
                className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40"
              />
              <datalist id="materias-cadastradas">
                {materiasDisponiveis.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição (opcional)</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: BB 2024 — Edital completo" className="px-3 py-2 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40" />
            </div>
          </div>
          {saveErr && <p className="text-[11px] text-red-400 font-bold">{saveErr}</p>}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:text-slate-300 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Salvar
            </button>
          </div>
        </div>
      )}

      {!selectedBlock && !loadingBlocks && blocks.length > 0 && (
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-between bg-[#101526] p-2.5 sm:p-3 rounded-2xl border border-white/[0.08] relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto flex-1 min-w-0">
            {/* Filtro por Caderno */}
            <div className="flex items-center gap-1.5 bg-[#0d1220] border border-white/[0.08] hover:border-white/[0.18] px-3 py-2 sm:py-1.5 rounded-xl transition-colors w-full sm:w-auto">
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
                className="bg-[#0d1220] text-slate-200 text-[11px] font-bold focus:outline-none cursor-pointer border-none w-full sm:w-auto sm:min-w-[140px] sm:max-w-[240px]"
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

            {/* Filtro por Matéria em lista suspensa */}
            <label className="flex items-center gap-1.5 bg-[#0d1220] border border-white/[0.08] hover:border-white/[0.18] px-2.5 py-2 sm:py-1.5 rounded-xl transition-colors w-full sm:w-auto">
              <Filter size={12} className="text-indigo-400 shrink-0" />
              <span className="text-[10px] text-slate-500 shrink-0">Matéria</span>
              <select
                value={materiaFiltro}
                onChange={e => setMateriaFiltro(e.target.value)}
                aria-label="Filtrar por matéria"
                className="bg-transparent text-slate-200 text-[11px] focus:outline-none cursor-pointer border-none w-full sm:w-auto sm:max-w-[190px]"
                style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}
              >
                {["Todas", ...materiasDisponiveis, "Sem matéria"].map(m => (
                  <option key={m} value={m} style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}>
                    {m === "Todas" ? `Todas as matérias (${materiasDisponiveis.length})` : m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Filtro por Status da Questão */}
          <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] w-full sm:w-auto overflow-x-auto no-scrollbar sm:flex-wrap shrink-0">
            <button
              onClick={() => setStatusFiltro("todas")}
              className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "todas" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFiltro("erros")}
              className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "erros" ? "bg-rose-600 text-white" : "text-rose-400/70 hover:text-rose-300"
              }`}
            >
              🔴 Últs. Erros
            </button>
            <button
              onClick={() => setStatusFiltro("mais_erros")}
              className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "mais_erros" ? "bg-amber-600 text-white" : "text-amber-400/70 hover:text-amber-300"
              }`}
            >
              🔥 Mais Erros
            </button>
            <button
              onClick={() => setStatusFiltro("nao_feitas")}
              className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "nao_feitas" ? "bg-purple-600 text-white" : "text-purple-400/70 hover:text-purple-300"
              }`}
            >
              ⭕ Não Feitas
            </button>
            <button
              onClick={() => setStatusFiltro("feitas_hoje")}
              className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "feitas_hoje" ? "bg-sky-600 text-white" : "text-sky-400/70 hover:text-sky-300"
              }`}
            >
              ⚡ Feitas Hoje
            </button>
          </div>

          {/* Filtro por Classificação (Lista de Validação de Dados) */}
          <div className="shrink-0 relative z-30">
            <ClassificationValidationDropdown
              value={classificacaoFiltro}
              onChange={setClassificacaoFiltro}
              compact
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0d1220] p-1 shrink-0">
            <button type="button" onClick={() => setNotionViewMode("quadros")} aria-pressed={notionViewMode === "quadros"} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${notionViewMode === "quadros" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              <LayoutGrid size={11} /> Quadros
            </button>
            <button type="button" onClick={() => setNotionViewMode("lista")} aria-pressed={notionViewMode === "lista"} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${notionViewMode === "lista" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              <ListTree size={11} /> Lista
            </button>
            <button type="button" onClick={() => setNotionViewMode("mapa")} aria-pressed={notionViewMode === "mapa"} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${notionViewMode === "mapa" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              <BarChart3 size={11} /> Mapa
            </button>
          </div>
          {notionViewMode !== "quadros" && (
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0d1220] p-1 shrink-0">
              <button type="button" onClick={() => setMateriasListaAbertas(new Set(blocksPorMateria.keys()))} className="rounded-lg px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">Expandir</button>
              <button type="button" onClick={() => setMateriasListaAbertas(new Set())} className="rounded-lg px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">Recolher</button>
            </div>
          )}
        </div>
      )}

      {selectedBlock ? (
        <div className="flex flex-col gap-4 relative z-10">
          {/* Header da visão dedicada do caderno */}
          <div className="flex items-center justify-between gap-3 bg-[#101526] p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedBlock(null);
                  setCadernoFiltro("Todos");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-bold transition-colors shrink-0"
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

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0d1220] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setNotionViewMode("quadros")}
                  aria-pressed={notionViewMode !== "mapa"}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    notionViewMode !== "mapa" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ListTree size={11} /> Caderno
                </button>
                <button
                  type="button"
                  onClick={() => setNotionViewMode("mapa")}
                  aria-pressed={notionViewMode === "mapa"}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    notionViewMode === "mapa" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <BarChart3 size={11} /> Mapa
                </button>
              </div>
              <button
                type="button"
                onClick={() => handlePrintCaderno(selectedBlock)}
                title="Imprimir caderno inteiro com máximo de questões por folha e gabarito no final"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.18] text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <Printer size={13} className="text-indigo-400" />
                <span>Imprimir Caderno</span>
              </button>
              <BlocoStatsBadge
                block={selectedBlock}
                resultadosMap={resultadosMap}
                duvidasIds={duvidasIds}
              />
            </div>
          </div>

          {/* Barra de Filtro interna do Caderno */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap bg-[#101526] p-2.5 sm:p-3 rounded-2xl border border-white/[0.06] relative z-20">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                <Filter size={14} className="text-indigo-400" />
                Filtrar questões:
              </span>

              <ClassificationValidationDropdown
                value={classificacaoFiltro}
                onChange={setClassificacaoFiltro}
              />

              {(statusFiltro !== "todas" || classificacaoFiltro !== "todas") && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFiltro("todas");
                    setClassificacaoFiltro("todas");
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                >
                  <X size={11} />
                  Limpar
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] w-full sm:w-auto overflow-x-auto no-scrollbar sm:flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setStatusFiltro("todas")}
                className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                  statusFiltro === "todas" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setStatusFiltro("erros")}
                className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                  statusFiltro === "erros" ? "bg-rose-600 text-white" : "text-rose-400/70 hover:text-rose-300"
                }`}
              >
                🔴 Últs. Erros
              </button>
              <button
                type="button"
                onClick={() => setStatusFiltro("mais_erros")}
                className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                  statusFiltro === "mais_erros" ? "bg-amber-600 text-white" : "text-amber-400/70 hover:text-amber-300"
                }`}
              >
                🔥 Mais Erros
              </button>
              <button
                type="button"
                onClick={() => setStatusFiltro("nao_feitas")}
                className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                  statusFiltro === "nao_feitas" ? "bg-purple-600 text-white" : "text-purple-400/70 hover:text-purple-300"
                }`}
              >
                ⭕ Não Feitas
              </button>
              <button
                type="button"
                onClick={() => setStatusFiltro("feitas_hoje")}
                className={`px-3 py-1.5 sm:py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                  statusFiltro === "feitas_hoje" ? "bg-sky-600 text-white" : "text-sky-400/70 hover:text-sky-300"
                }`}
              >
                ⚡ Feitas Hoje
              </button>
            </div>
          </div>

          {/* Conteúdo do caderno selecionado */}
          <div className="bg-[#101526] border border-white/[0.06] rounded-2xl p-2.5 sm:p-5 ml-0 sm:ml-5">
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
              showQuestionMap={notionViewMode === "mapa"}
              refreshKey={refreshKey}
              onPrintCaso={handlePrintCaso}
            />
          </div>
        </div>
      ) : (
        <>
          {isAdmin && !loadingBlocks && blocksFiltrados.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-[#101526]/80 px-3.5 py-2 rounded-xl border border-white/[0.06] relative z-10">
              <MoreVertical size={12} className="text-indigo-400 shrink-0" />
              <span>Modo Admin: arraste os cadernos ou use as setas no menu para organizar a ordem dentro de cada matéria.</span>
            </div>
          )}

          {loadingBlocks ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
              <BookMarked size={32} className="text-slate-800" />
              <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum bloco cadastrado</p>
              <p className="text-[11px] text-slate-700 max-w-xs">Clique em &ldquo;Novo Bloco&rdquo; para cadastrar o ID de um bloco do Notion.</p>
            </div>
          ) : blocksFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
              <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum caderno encontrado</p>
              <button onClick={() => { setMateriaFiltro("Todas"); setCadernoFiltro("Todos"); setStatusFiltro("todas"); setClassificacaoFiltro("todas"); }} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold">Limpar filtros</button>
            </div>
          ) : (
            notionViewMode !== "quadros" ? (
              <div className="flex flex-col gap-2 relative z-10">
                {[...blocksPorMateria.entries()].map(([materiaName, mBlocks]) => {
                  const isOpen = materiasListaAbertas.has(materiaName);
                  return (
                    <section key={materiaName} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1320]">
                      <button type="button" aria-expanded={isOpen} onClick={() => setMateriasListaAbertas(prev => {
                        const next = new Set(prev);
                        if (next.has(materiaName)) next.delete(materiaName); else next.add(materiaName);
                        return next;
                      })} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChevronRight size={12} className={`shrink-0 text-slate-500 ${isOpen ? "rotate-90" : ""}`} />
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-300">{materiaName}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">{mBlocks.length} cadernos</span>
                        </span>
                        <MateriaStatsBadge blocks={mBlocks} resultadosMap={resultadosMap} duvidasIds={duvidasIds} />
                      </button>
                      {isOpen && <div className="flex flex-col gap-1.5 border-t border-white/[0.05] p-2 sm:p-2.5">
                        {notionViewMode === "mapa" ? mBlocks.map((block, index) => (
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
                            showQuestionMap
                            onPrintCaderno={handlePrintCaderno}
                            onPrintCaso={handlePrintCaso}
                          />
                        )) : mBlocks.map((block, index) => (
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
                            onPrintCaderno={handlePrintCaderno}
                            onPrintCaso={handlePrintCaso}
                          />
                        ))}
                      </div>}
                    </section>
                  );
                })}
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
              {[...blocksPorMateria.entries()].map(([materiaName, mBlocks]) => (
                <div 
                  key={materiaName} 
                  className="flex flex-col bg-[#101526]/90 border border-white/[0.06] rounded-xl p-2.5 sm:p-3 gap-1.5 transition-colors hover:border-white/[0.10]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 px-0.5 flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <h3 className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider truncate">
                        {materiaName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MateriaStatsBadge
                        blocks={mBlocks}
                        resultadosMap={resultadosMap}
                        duvidasIds={duvidasIds}
                      />
                      <span className="text-[9.5px] font-normal text-slate-500 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04] shrink-0">
                        {mBlocks.length} caderno{mBlocks.length > 1 ? "s" : ""}
                      </span>
                    </div>
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
                        onPrintCaderno={handlePrintCaderno}
                        onPrintCaso={handlePrintCaso}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )
          )}
        </>
      )}
    </div>

    <CreateCasoModal
      isOpen={createCasoModal.isOpen}
      onClose={() => setCreateCasoModal(prev => ({ ...prev, isOpen: false }))}
      rootBlockId={createCasoModal.rootBlockId}
      parentBlockId={createCasoModal.parentBlockId}
      parentNome={createCasoModal.parentNome}
      isSubcaso={createCasoModal.isSubcaso}
      existingCasos={createCasoModal.existingCasos}
      onCreated={() => {
        triggerBuilderRefresh();
      }}
    />

    <QuestaoBuilderModal
      isOpen={questaoModal.isOpen}
      onClose={() => setQuestaoModal(prev => ({ ...prev, isOpen: false }))}
      blocks={blocks}
      defaultRootBlockId={questaoModal.defaultRootBlockId}
      defaultCasoId={questaoModal.defaultCasoId}
      editingQuestao={questaoModal.editingQuestao}
      onSaved={() => {
        triggerBuilderRefresh();
      }}
    />

    <MoveQuestaoModal
      isOpen={moveModal.isOpen}
      onClose={() => setMoveModal(prev => ({ ...prev, isOpen: false }))}
      rootBlockId={moveModal.rootBlockId}
      fromCasoId={moveModal.fromCasoId}
      questao={moveModal.questao ? {
        id: moveModal.questao.id,
        numero: moveModal.questao.numero,
        topic: moveModal.questao.topic,
        categoryKey: moveModal.questao.categoryKey as BuilderCategoryKey,
        enunciadoTexto: moveModal.questao.enunciadoTexto,
        imageUrls: moveModal.questao.imageUrls,
        resposta: moveModal.questao.resposta,
        respostaImageUrls: moveModal.questao.respostaImageUrls,
      } : null}
      onMoved={() => {
        triggerBuilderRefresh();
      }}
    />
    </ClassificationContext.Provider>
    </BuilderActionsContext.Provider>
  );
}
