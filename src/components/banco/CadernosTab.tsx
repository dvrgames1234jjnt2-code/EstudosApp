"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from "react";
import { createContext, useContext } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Check,
  X,
  Flag,
  Play,
  RotateCcw,
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  HelpCircle,
  Eye,
  EyeOff,
  Flame,
  Clock,
  Sparkles,
  Maximize2,
  BookMarked,
  LayoutGrid,
  Plus,
  FolderPlus,
  GripVertical,
  Layers,
  Folder,
  FolderTree,
  ListTree,
  FileText,
  Pencil,
  Trash2,
  FolderInput,
  Printer,
  AlertTriangle,
  FileJson,
  Ban,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import QuestionResolver from "./QuestionResolver";
import { supabase, supabasePublic } from "../../lib/supabase";
import {
  compareQuestoesByOrdem,
  getQuestionIds,
  isQuestaoAnulada,
  matchesPlataforma,
  sortQuestoesByOrdem,
  type PlataformaFiltro,
} from "../../lib/questionService";
import { ModalEditarQuestao } from "./ModalEditarQuestao";
import { ModalMoverQuestao } from "./ModalMoverQuestao";
import { ModalMoverSubcaso, type SubcasoToMove } from "./ModalMoverSubcaso";
import { ModalExcluirCaderno, type DeleteTargetNode } from "./ModalExcluirCaderno";
import { ModalRenomearPasta } from "./ModalRenomearPasta";
import { PrintSimuladoModal } from "./PrintSimuladoModal";
import { ImportJsonModal } from "./ImportJsonModal";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos & Categorias (Idêntico ao NotionQuestionTab)
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { key: "bonus",     label: "Bônus",     emojis: ["🎉","🥳","🎊"],        icon: "🎉",  color: "#d97706", textColor: "#c69238", dot: false },
  { key: "faceis",    label: "Fáceis",    emojis: ["🟢","✅","💚","🍀"],   icon: null,  color: "#16a34a", textColor: "#479e78", dot: true  },
  { key: "atencao",   label: "Atenção",   emojis: ["🔵","💙","🌀","🫐"],   icon: null,  color: "#2563eb", textColor: "#4a88b5", dot: true  },
  { key: "lacuna",    label: "Lacuna",    emojis: ["⛳","⛳️","🌱","🌿","🪴"], icon: "⛳",  color: "#65a30d", textColor: "#6b9e44", dot: false },
  { key: "media",     label: "Média",     emojis: ["🟡","💛","⭐","🌟","🟠","🧡"],   icon: null,  color: "#ea580c", textColor: "#c69238", dot: true  },
  { key: "dificil",   label: "Difícil",   emojis: ["🔴","❤️","💔","🔥"],   icon: null,  color: "#dc2626", textColor: "#c45454", dot: true  },
  { key: "ultrahard", label: "Ultrahard", emojis: ["🟣","💜","👾","🫀"],   icon: null,  color: "#9333ea", textColor: "#8e66ab", dot: true  },
] as const;

export type CategoryKey = typeof CATEGORIES[number]["key"];

interface QuestionClassificationContextValue {
  difficultyOverrides: Map<string, string>;
  onChangeDifficulty?: (question: BancoQuestion, difficulty: string) => Promise<void>;
}

const QuestionClassificationContext = createContext<QuestionClassificationContextValue>({ difficultyOverrides: new Map() });

const FACE_EMOJI: Record<CategoryKey, string> = {
  bonus: "🎉", faceis: "😊", atencao: "🔵", lacuna: "⛳", media: "😐", dificil: "😞", ultrahard: "🟣",
};

export interface QuestionStats {
  lastAnswer: string;
  isCorrect: boolean;
  totalAttempts: number;
  errorCount: number;
  correctCount: number;
  timestamp: number;
}

export interface OrgNodeDB {
  id: string;
  nome: string;
  tipo?: string | null;
  parent_id?: string | null;
  ordem?: number;
  created_at?: string;
  updated_at?: string;
}

interface CadernosTabProps {
  questions: BancoQuestion[];
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  initialOrgNodes?: OrgNodeDB[];
  onOrgNodesChanged?: (nodes: OrgNodeDB[]) => void;
  onSelectQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onAnswer?: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (questaoId: any) => Promise<void>;
  user: any;
  onShowAuth: () => void;
  onRefreshQuestions?: () => void;
  onPatchQuestionsLocal?: (updates: { id: string | number; patch: Partial<BancoQuestion> }[]) => void;
  onRemoveQuestionsLocal?: (ids: (string | number)[]) => void;
  isAdmin?: boolean;
  userId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrutura hierárquica em árvore
// ─────────────────────────────────────────────────────────────────────────────
interface HierarchyTreeNode {
  id: string;
  nome: string;
  parent_id: string | null;
  tipo?: string | null;
  ordem?: number;
  filhos: HierarchyTreeNode[];
  questoes: BancoQuestion[];
  totalDescendentesQuestoes: number;
}

export interface CasoGroup {
  id: string;
  nome: string;
  questoes: BancoQuestion[];
}

export interface CadernoItem {
  id: string;
  nome: string;
  materia: string;
  casos: CasoGroup[];
  questoes: BancoQuestion[];
}

export interface MateriaGroup {
  id: string;
  nome: string;
  icone: string;
  cadernos: CadernoItem[];
  totalQuestoes: number;
}

const MATERIA_ICON_MAP: Record<string, string> = {
  "conhecimentos bancários": "🏛️",
  "conhecimentos bancarios": "🏛️",
  "português": "📖",
  "portugues": "📖",
  "língua portuguesa": "📖",
  "matemática": "📐",
  "matematica": "📐",
  "matemática financeira": "💹",
  "raciocínio lógico": "🧠",
  "informática": "💻",
  "informatica": "💻",
  "atualidades": "🌐",
  "vendas e negociação": "🤝",
  "vendas e negociações": "🤝",
  "vendas": "🤝",
  "atendimento": "🎧",
  "direito": "⚖️",
  "geral": "📚",
};

function getMateriaIcon(materia: string): string {
  const norm = (materia || "").trim().toLowerCase();
  for (const [key, icon] of Object.entries(MATERIA_ICON_MAP)) {
    if (norm.includes(key)) return icon;
  }
  return "🏛️";
}

function resolveCategory(q: BancoQuestion): CategoryKey {
  const dif = (q.dificuldade || "").toLowerCase();
  if (dif.includes("fácil") || dif.includes("facil")) return "faceis";
  if (dif.includes("difícil") || dif.includes("dificil")) return "dificil";
  if (dif.includes("atenção") || dif.includes("atencao")) return "atencao";
  if (dif.includes("bônus") || dif.includes("bonus")) return "bonus";
  if (dif.includes("ultra")) return "ultrahard";
  return "media";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de Exibição de Plataforma / Colunas
// ─────────────────────────────────────────────────────────────────────────────
function PlatformIdsBadges({ questao, compact = false }: { questao: BancoQuestion; compact?: boolean }) {
  const { idq, idg, idtec } = getQuestionIds(questao);
  const hasAny = Boolean(idq || idg || idtec);

  if (!hasAny) {
    return (
      <span className="inline-flex items-center text-[10px] font-mono font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
        #{questao.id}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {idq && (
        <span
          title={`Qconcursos: ${idq}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded shrink-0"
        >
          <span className="text-[8.5px] font-sans uppercase tracking-wider text-amber-400/80">QC</span>
          <span>{idq}</span>
        </span>
      )}
      {idg && (
        <span
          title={`Gran: ${idg}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-1.5 py-0.5 rounded shrink-0"
        >
          <span className="text-[8.5px] font-sans uppercase tracking-wider text-cyan-400/80">Gran</span>
          <span>{compact && idg.length > 10 ? `${idg.slice(0, 10)}…` : idg}</span>
        </span>
      )}
      {idtec && (
        <span
          title={`TEC Concursos: ${idtec}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-violet-300 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded shrink-0"
        >
          <span className="text-[8.5px] font-sans uppercase tracking-wider text-violet-400/80">TEC</span>
          <span>{compact && idtec.length > 10 ? `${idtec.slice(0, 10)}…` : idtec}</span>
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: QuestaoRowItem — Colunas completas do Caderno de Erros
// Ordem | Plataforma / IDs | Prova / Ano | Banca | Dificuldade | Erros / Status | Ações
// ─────────────────────────────────────────────────────────────────────────────
const QuestaoRowItem = React.memo(function QuestaoRowItem({
  questao,
  numero,
  casoNome,
  stats,
  isDuvida,
  onOpenResolver,
  onOpenQuestion,
  queue,
  isAdmin,
  onEdit,
  onMove,
  onDelete,
}: {
  questao: BancoQuestion;
  numero: number;
  casoNome: string;
  stats?: QuestionStats;
  isDuvida: boolean;
  onOpenResolver?: () => void;
  onOpenQuestion?: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  queue?: BancoQuestion[];
  isAdmin?: boolean;
  onEdit?: (q: BancoQuestion) => void;
  onMove?: (q: BancoQuestion) => void;
  onDelete?: (q: BancoQuestion) => void;
  onChangeDifficulty?: (q: BancoQuestion, difficulty: string) => Promise<void>;
}) {
  const { difficultyOverrides: personalClassifications, onChangeDifficulty: savePersonalClassification } = useContext(QuestionClassificationContext);
  const questionClassification = personalClassifications.get(String(questao.id));
  const displayedQuestion = questionClassification ? { ...questao, dificuldade: questionClassification } : questao;
  const [difficultyMenuOpen, setDifficultyMenuOpen] = useState(false);
  const [savingDifficulty, setSavingDifficulty] = useState(false);
  const difficultyLevels = [
    { label: "Fácil", value: "Fácil", emoji: "🟢" },
    { label: "Média", value: "Média", emoji: "🟡" },
    { label: "Difícil", value: "Difícil", emoji: "🔴" },
    { label: "Ultrahard", value: "Ultrahard", emoji: "🟣" },
    { label: "Atenção", value: "Atenção", emoji: "🔵" },
    { label: "Lacuna", value: "Lacuna", emoji: "⛳" },
    { label: "Treinar", value: "Treinar", emoji: "🧠" },
    { label: "Dominada", value: "Dominada", emoji: "🏆" },
    { label: "Bônus", value: "Bônus", emoji: "🎉" },
  ];
  const currentDifficultyIndex = difficultyLevels.findIndex(
    level => level.value.toLowerCase() === (displayedQuestion.dificuldade || "").toLowerCase()
  );
  const currentDifficulty = currentDifficultyIndex >= 0 ? difficultyLevels[currentDifficultyIndex] : null;
  const catKey = resolveCategory(displayedQuestion);
  const categoryInfo = CATEGORIES.find(c => c.key === catKey);
  const catLabel = displayedQuestion.dificuldade || categoryInfo?.label || "Média";
  const catColor = categoryInfo?.textColor || "#c69238";
  const isAnulada = isQuestaoAnulada(questao);
  const isErro = !isAnulada && stats?.isCorrect === false;
  const isAcerto = !isAnulada && stats?.isCorrect === true;
  const errorCount = stats?.errorCount || 0;
  const ordemVal = questao.Ordem ?? questao.ordem;
  const bancaVal = (questao.Banca || questao.banca || "").trim();
  const provaVal = (questao.prova || "").trim();
  const anoVal = questao.Ano !== undefined && questao.Ano !== null ? String(questao.Ano).trim() : "";

  const changeDifficulty = async (nextIndex: number) => {
    const next = difficultyLevels[nextIndex];
    if (!next || savingDifficulty || next.value === displayedQuestion.dificuldade) return;
    setSavingDifficulty(true);
    try {
      await savePersonalClassification?.(questao, next.value);
      setDifficultyMenuOpen(false);
    } finally {
      setSavingDifficulty(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(questao.id));
        e.dataTransfer.setData("questao_id", String(questao.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => {
        if (onOpenQuestion && queue) onOpenQuestion(questao, queue);
        else onOpenResolver?.();
      }}
      className={`flex flex-col md:grid md:grid-cols-[54px_minmax(130px,1.2fr)_minmax(115px,1fr)_minmax(90px,0.85fr)_110px_118px_auto] md:items-center gap-1.5 md:gap-2.5 py-2 md:py-1.5 px-2.5 transition-colors duration-150 rounded-lg group cursor-pointer select-none border ${
        isErro
          ? "bg-rose-500/[0.045] hover:bg-rose-500/[0.085] border-rose-500/20 hover:border-rose-500/35"
          : "bg-white/[0.015] hover:bg-white/[0.045] border-white/[0.04] hover:border-white/[0.09]"
      }`}
    >
      {/* Coluna 1: Handle + Ordem */}
      <div className="flex items-center justify-between md:justify-start gap-1.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="hidden sm:inline-flex text-slate-600 group-hover:text-slate-400 cursor-grab shrink-0" title="Arraste para mover para outro caso ou pasta">
            <GripVertical size={12} />
          </span>
          <span
            title={ordemVal !== undefined && ordemVal !== null ? `Ordem ${ordemVal}` : `Posição ${numero}`}
            className="inline-flex items-center justify-center text-[10.5px] font-mono font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded tabular-nums shrink-0"
          >
            {ordemVal !== undefined && ordemVal !== null ? `#${ordemVal}` : `${numero}.`}
          </span>
        </div>

        {/* No mobile, Status + Ações ficam alinhados no topo direito do card */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {isDuvida && <Flag size={11} className="fill-amber-400/90 text-amber-400/90 shrink-0" />}
          {isAnulada ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 shrink-0">
              <Ban size={10} className="text-amber-400 shrink-0" />
              Anulada
            </span>
          ) : isErro ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/35 tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              {errorCount > 1 ? `Errou ${errorCount}×` : "Errou"}
            </span>
          ) : isAcerto ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Acertou{errorCount > 0 ? ` (${errorCount}e)` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06]">
              Aberta
            </span>
          )}
        </div>
      </div>

      {/* Coluna 2: Plataforma & IDs (Idq / Idg / Idtec) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Play size={9} className="hidden md:inline-block fill-current text-slate-500 group-hover:text-indigo-400 shrink-0" />
        <PlatformIdsBadges questao={questao} compact />
      </div>

      {/* Coluna 3 (Desktop) / Metadado (Mobile): Prova / Ano */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 text-xs md:text-[10.5px] text-slate-300 min-w-0 md:truncate">
        <span className="break-words md:truncate font-medium text-slate-200/90" title={`${provaVal || "—"} ${anoVal}`}>
          {provaVal || <span className="text-slate-600">—</span>}
        </span>
        {anoVal && (
          <span className="text-[11px] md:text-[10px] text-slate-400 font-mono shrink-0 tabular-nums">
            · {anoVal}
          </span>
        )}
        {/* No mobile exibe Banca inline junto de Prova/Ano */}
        {bancaVal && (
          <span className="md:hidden text-[11px] text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded truncate max-w-[160px]">
            {bancaVal}
          </span>
        )}
      </div>

      {/* Coluna 4 (Desktop): Banca */}
      <div className="hidden md:flex items-center min-w-0">
        {bancaVal ? (
          <span
            title={bancaVal}
            className="text-[10px] font-semibold text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded truncate max-w-full"
          >
            {bancaVal}
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>

      {/* Coluna 5: Dificuldade / Classificação */}
      <div className="flex items-center justify-between md:justify-start gap-2 min-w-0">
        {savePersonalClassification ? (
          <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-expanded={difficultyMenuOpen}
              disabled={savingDifficulty}
              onClick={() => setDifficultyMenuOpen(open => !open)}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/10"
              title="Alterar dificuldade"
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
              <span className="truncate max-w-[78px]">{savingDifficulty ? "Salvando…" : currentDifficulty?.label ?? catLabel}</span>
              <ChevronDown size={10} className={difficultyMenuOpen ? "rotate-180" : ""} />
            </button>
            {difficultyMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-white/10 bg-[#111827] p-2 shadow-lg" onClick={(event) => event.stopPropagation()}>
                <p className="px-1.5 pb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Progressão de dificuldade</p>
                <div className="grid grid-cols-3 gap-1">
                  {difficultyLevels.map((level, index) => {
                    const relation = currentDifficultyIndex < 0 ? "" : index < currentDifficultyIndex ? "anterior" : index > currentDifficultyIndex ? "próximo" : "atual";
                    return (
                      <button
                        key={level.value}
                        type="button"
                        disabled={savingDifficulty || index === currentDifficultyIndex}
                        onClick={() => void changeDifficulty(index)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[9px] transition-colors ${index === currentDifficultyIndex ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200" : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"} disabled:cursor-default`}
                      >
                        <span className="text-sm">{level.emoji}</span>
                        <span>{level.label}</span>
                        {relation && <span className="text-[8px] text-slate-500">{relation}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/25 border border-white/[0.05] shrink-0" style={{ color: catColor }}>
            {catLabel}
          </span>
        )}

        {/* Mobile Admin Actions */}
        {isAdmin && (
          <div
            className="flex md:hidden items-center gap-1 shrink-0 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => onMove?.(questao)} title="Mover pasta" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-400 bg-white/[0.04] rounded">
              <FolderInput size={13} />
            </button>
            <button type="button" onClick={() => onEdit?.(questao)} title="Editar questão" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-400 bg-white/[0.04] rounded">
              <Pencil size={13} />
            </button>
            <button type="button" onClick={() => onDelete?.(questao)} title="Excluir questão" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 bg-white/[0.04] rounded">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Coluna 6 (Desktop): Erros / Status */}
      <div className="hidden md:flex items-center gap-1.5 justify-end tabular-nums">
        {isDuvida && (
          <Flag size={10} className="fill-amber-400/90 text-amber-400/90 shrink-0" />
        )}
        {isAnulada ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 shrink-0">
            <Ban size={10} className="text-amber-400 shrink-0" />
            Anulada
          </span>
        ) : isErro ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/35 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            {errorCount > 1 ? `Errou ${errorCount}×` : "Errou"}
          </span>
        ) : isAcerto ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Acertou{errorCount > 0 ? ` (${errorCount}e)` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] text-slate-500 bg-white/[0.02] border border-white/[0.05] shrink-0">
            Aberta
          </span>
        )}
      </div>

      {/* Coluna 7 (Desktop): Ações Admin */}
      {isAdmin ? (
        <div
          className="hidden md:flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onMove?.(questao)}
            title={`Mover de "${casoNome}" para outra pasta`}
            className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <FolderInput size={12} />
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(questao)}
            title="Editar questão"
            className="p-1 text-slate-500 hover:text-amber-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(questao)}
            title="Excluir questão"
            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <div className="hidden md:flex items-center justify-end text-slate-600 group-hover:text-indigo-400">
          <ChevronRight size={12} />
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente: Árvore Recursiva de Pastas (Exatamente o print do usuário!)
// 📁 Conhecimentos Bancários
//     📁 Mercado de Capitais
//         📁 Underwriting
//             📄 123456
// ─────────────────────────────────────────────────────────────────────────────
const TreeNodeItem = React.memo(function TreeNodeItem({
  node,
  depth = 0,
  ancestors,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onDropQuestion,
  onDropNodeToParent,
  onAddSubfolder,
  onMoveNode,
  onRenameNode,
  onDeleteNode,
  onPrintNode,
  isAdmin,
  onChangeDifficulty,
  getQuestionWithCurrentDifficulty,
}: {
  node: HierarchyTreeNode;
  depth?: number;
  ancestors?: Set<string>;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onDropQuestion: (questaoId: string, targetNodeId: string) => void;
  onDropNodeToParent?: (draggedNodeId: string, targetParentId: string) => void;
  onAddSubfolder: (parentId: string) => void;
  onMoveNode?: (node: HierarchyTreeNode) => void;
  onRenameNode?: (nodeId: string, currentNome: string) => void;
  onDeleteNode?: (node: HierarchyTreeNode) => void;
  onPrintNode?: (node: HierarchyTreeNode) => void;
  isAdmin?: boolean;
  onChangeDifficulty?: (q: BancoQuestion, difficulty: string) => Promise<void>;
  getQuestionWithCurrentDifficulty: (q: BancoQuestion) => BancoQuestion;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [visibleQuestionsLimit, setVisibleQuestionsLimit] = useState(60);

  const nextAncestors = useMemo(() => {
    const next = new Set(ancestors);
    next.add(node.id);
    return next;
  }, [ancestors, node.id]);

  if (ancestors?.has(node.id)) return null;

  const hasChildren = node.filhos.length > 0 || node.questoes.length > 0;

  return (
    <div className="flex flex-col select-none">
      {/* Linha da Pasta */}
      <div
        draggable={Boolean(isAdmin && depth > 0)}
        onDragStart={(e) => {
          if (!isAdmin || depth === 0) return;
          e.stopPropagation();
          e.dataTransfer.setData("application/x-estudos-org-node", node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const movedNodeId = e.dataTransfer.getData("application/x-estudos-org-node");
          if (movedNodeId && movedNodeId !== node.id) {
            onDropNodeToParent?.(movedNodeId, node.id);
            return;
          }
          const qId = e.dataTransfer.getData("questao_id") || e.dataTransfer.getData("text/plain");
          if (qId) {
            onDropQuestion(qId, node.id);
          }
        }}
        className={`flex items-center justify-between gap-2 px-2 py-2 sm:py-1.5 rounded-lg cursor-pointer transition-colors group ${
          isDragOver
            ? "bg-indigo-600/20 border border-indigo-500 text-white"
            : "hover:bg-white/[0.04] text-slate-300 hover:text-white"
        }`}
        onClick={() => setIsOpen(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(v => !v);
            }}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 shrink-0"
          >
            {hasChildren ? (
              <ChevronDown
                size={13}
                className={isOpen ? "" : "-rotate-90"}
              />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 inline-block" />
            )}
          </button>

          <span className="text-amber-400 text-sm shrink-0">📁</span>

          <span className="text-[12.5px] sm:text-[12px] font-normal tracking-wide truncate">
            {node.nome}
          </span>

          <span className="text-[10.5px] text-slate-500 font-mono tabular-nums shrink-0">
            ({node.questoes.length + node.totalDescendentesQuestoes})
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Botão de imprimir questões desta pasta/caso */}
          {node.questoes.length + node.totalDescendentesQuestoes > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrintNode?.(node);
              }}
              title={`Imprimir questões de "${node.nome}" (${node.questoes.length + node.totalDescendentesQuestoes})`}
              className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 sm:w-auto sm:h-auto flex items-center justify-center sm:p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.06] rounded transition-colors shrink-0"
            >
              <Printer size={12} />
            </button>
          )}

          {/* Botão de adicionar subpasta inline */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddSubfolder(node.id);
            }}
            title={`Adicionar subpasta dentro de "${node.nome}"`}
            className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 sm:w-auto sm:h-auto flex items-center justify-center sm:p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.06] rounded transition-colors shrink-0"
          >
            <Plus size={13} />
          </button>

          {isAdmin && depth > 0 && onMoveNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveNode(node);
              }}
              title={`Mover "${node.nome}" para outro caderno`}
              className="opacity-80 sm:opacity-60 sm:group-hover:opacity-100 w-7 h-7 sm:w-auto sm:h-auto flex items-center justify-center sm:p-1 text-slate-400 hover:text-indigo-300 hover:bg-white/[0.06] rounded transition-colors shrink-0"
            >
              <FolderInput size={12} />
            </button>
          )}

          {isAdmin && onRenameNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameNode(node.id, node.nome);
              }}
              title={`Renomear "${node.nome}"`}
              className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 sm:w-auto sm:h-auto flex items-center justify-center sm:p-1 text-slate-500 hover:text-amber-400 hover:bg-white/[0.06] rounded transition-colors shrink-0"
            >
              <Pencil size={12} />
            </button>
          )}

          {isAdmin && onDeleteNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(node);
              }}
              title={`Excluir "${node.nome}"`}
              className="opacity-80 sm:opacity-60 sm:group-hover:opacity-100 w-7 h-7 sm:w-auto sm:h-auto flex items-center justify-center sm:p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors shrink-0"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filhos e Questões — alinhados na mesma linha guia hierárquica */}
      {isOpen && (
        <div
          className={`flex flex-col gap-0.5 my-0.5 border-l border-white/[0.08] ${
            depth >= 3 ? "ml-2.5 sm:ml-3.5 pl-2 sm:pl-2.5" : "ml-3 sm:ml-3.5 pl-2.5 sm:pl-3"
          }`}
        >
          {/* Subpastas */}
          {node.filhos.map(filho => (
            <TreeNodeItem
              key={filho.id}
              node={filho}
              depth={depth + 1}
              ancestors={nextAncestors}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onOpenQuestion={onOpenQuestion}
              onDropQuestion={onDropQuestion}
              onDropNodeToParent={onDropNodeToParent}
              onAddSubfolder={onAddSubfolder}
              onMoveNode={onMoveNode}
              onRenameNode={onRenameNode}
              onDeleteNode={onDeleteNode}
              onPrintNode={onPrintNode}
              isAdmin={isAdmin}
              onChangeDifficulty={onChangeDifficulty}
              getQuestionWithCurrentDifficulty={getQuestionWithCurrentDifficulty}
            />
          ))}

          {/* Questões diretamente vinculadas a este nó */}
          {node.questoes.length > 0 && (
            <div
              className={`flex flex-col gap-1 ${
                node.filhos.length > 0 ? "mt-1 pt-1.5 border-t border-white/[0.05]" : ""
              }`}
            >
              {node.questoes.slice(0, visibleQuestionsLimit).map((q) => {
                q = getQuestionWithCurrentDifficulty(q);
                const catKey = resolveCategory(q);
                const catInfo = CATEGORIES.find(c => c.key === catKey);
                const isAnulada = isQuestaoAnulada(q);
                const st = userAnswers[String(q.id)];
                const isAcerto = !isAnulada && st?.isCorrect === true;
                const isErro = !isAnulada && st?.isCorrect === false;
                const isDuvida = duvidas.has(String(q.id));
                const ordemVal = q.Ordem ?? q.ordem;

                return (
                  <div
                    key={q.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(q.id));
                      e.dataTransfer.setData("questao_id", String(q.id));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onOpenQuestion(q, node.questoes)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-lg border cursor-pointer transition-colors group min-w-0 ${
                      isAnulada
                        ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.07] border-amber-500/15 hover:border-amber-500/30 text-slate-300"
                        : isErro
                        ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08] border-rose-500/20 hover:border-rose-500/35 text-slate-200"
                        : isAcerto
                        ? "bg-emerald-500/[0.025] hover:bg-emerald-500/[0.06] border-emerald-500/15 hover:border-emerald-500/30 text-slate-200"
                        : "bg-white/[0.015] hover:bg-white/[0.045] border-white/[0.04] hover:border-white/[0.10] text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                          isAnulada
                            ? "text-amber-400"
                            : isAcerto
                            ? "text-emerald-400"
                            : isErro
                            ? "text-rose-400"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      >
                        {isAnulada ? <Ban size={12} /> : <FileText size={12} />}
                      </span>

                      <span className="w-8 sm:w-9 text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {ordemVal !== undefined && ordemVal !== null && String(ordemVal).trim() !== ""
                          ? `#${ordemVal}`
                          : "—"}
                      </span>

                      <div className="min-w-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <PlatformIdsBadges questao={q} compact />

                        {(q.prova || q.Banca || q.banca) && (
                          <span className="hidden md:inline text-[11px] text-slate-400 truncate max-w-[220px]">
                            {[q.prova, q.Ano, q.Banca || q.banca].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDuvida && (
                        <Flag size={10} className="fill-amber-400/90 text-amber-400/90 shrink-0" />
                      )}
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: catInfo?.textColor || "#c69238" }}
                        title={catInfo?.label}
                      />
                      {isAnulada ? (
                        <span className="text-[10px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md shrink-0">
                          Anulada
                        </span>
                      ) : isAcerto ? (
                        <span className="text-[10px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-700/40 px-2 py-0.5 rounded-md shrink-0">
                          Acertou
                        </span>
                      ) : isErro ? (
                        <span className="text-[10px] font-medium text-rose-300 bg-rose-950/60 border border-rose-500/35 px-2 py-0.5 rounded-md shrink-0">
                          Errou
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {node.questoes.length > visibleQuestionsLimit && (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 pb-0.5 pl-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleQuestionsLimit(v => v + 80);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] font-normal text-slate-300 transition-colors"
                  >
                    Mostrar mais (+{Math.min(80, node.questoes.length - visibleQuestionsLimit)} de {node.questoes.length - visibleQuestionsLimit})
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleQuestionsLimit(node.questoes.length);
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-normal text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Exibir todas ({node.questoes.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CasoAccordion (Caso / Subpasta que é Drop Target no modo Notion)
// ─────────────────────────────────────────────────────────────────────────────
const CasoAccordion = React.memo(function CasoAccordion({
  caso,
  caderno,
  index,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onDropQuestion,
  isAdmin,
  onEditQuestao,
  onMoveQuestao,
  onDeleteQuestao,
  onChangeDifficulty,
  getQuestionWithCurrentDifficulty,
  onRenameCaso,
  onAddSubfolder,
  onDeleteCaso,
  onPrintCaso,
  onOpenMoverCaso,
}: {
  caso: CasoGroup;
  caderno?: CadernoItem;
  index: number;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onDropQuestion: (questaoId: string, targetCasoId: string) => void;
  isAdmin?: boolean;
  onEditQuestao?: (q: BancoQuestion) => void;
  onMoveQuestao?: (q: BancoQuestion) => void;
  onDeleteQuestao?: (q: BancoQuestion) => void;
  onChangeDifficulty?: (q: BancoQuestion, difficulty: string) => Promise<void>;
  getQuestionWithCurrentDifficulty: (q: BancoQuestion) => BancoQuestion;
  onRenameCaso?: (casoId: string, currentNome: string) => void;
  onAddSubfolder?: (casoId: string) => void;
  onDeleteCaso?: (casoId: string, casoNome: string, questoes?: BancoQuestion[]) => void;
  onPrintCaso?: (caso: CasoGroup) => void;
  onOpenMoverCaso?: (caso: CasoGroup, caderno?: CadernoItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(60);

  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let duvidasCount = 0;

    caso.questoes.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) {
        if (st.isCorrect) acertos++;
        else erros++;
      }
      if (duvidas.has(String(q.id))) duvidasCount++;
    });

    const total = caso.questoes.length;
    const respondidas = acertos + erros;
    const pct = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, pct };
  }, [caso.questoes, userAnswers, duvidas]);

  const aproveitamentoClasses =
    stats.pct === null
      ? "border-white/[0.04] text-slate-500 bg-white/[0.015]"
      : stats.pct >= 70
      ? "border-emerald-500/20 text-emerald-400/90 bg-emerald-500/5"
      : stats.pct >= 50
      ? "border-amber-500/20 text-amber-400/90 bg-amber-500/5"
      : "border-rose-500/20 text-rose-400/90 bg-rose-500/5";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const qId = e.dataTransfer.getData("questao_id") || e.dataTransfer.getData("text/plain");
        if (qId) {
          onDropQuestion(qId, caso.id);
        }
      }}
      className={`relative flex flex-col gap-1 rounded-lg transition-colors ${
        isDragOver ? "ring-1 ring-indigo-500/60 bg-indigo-500/10 p-0.5" : ""
      }`}
    >
      {/* Header do Caso - Compacto, sem negrito e elegante */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(v => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(v => !v);
          }
        }}
        className={`relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5 px-2.5 py-2 sm:py-1.5 rounded-lg border border-white/[0.04] bg-[#0d1220]/80 hover:bg-[#121829] hover:border-white/[0.08] transition-colors text-left cursor-pointer select-none group ${
          isDragOver ? "border-indigo-500" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 min-w-0 flex-1 w-full sm:w-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[12px] opacity-75 shrink-0 select-none">
              📁
            </span>
            <span className="text-[12px] sm:text-[11.5px] font-normal text-slate-300 tracking-wide truncate group-hover:text-slate-100 transition-colors">
              <span className="text-slate-500 font-light mr-1.5">{index + 1}.</span>
              {caso.nome || "Geral"}
            </span>
          </div>
          <ChevronDown
            size={13}
            className={`sm:hidden text-slate-500/80 shrink-0 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>

        {/* Stats inline */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-1.5 sm:gap-2 text-[10px] shrink-0 tabular-nums font-light flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-500 font-light">{stats.total} <span className="hidden sm:inline">quest.</span><span className="sm:hidden">q.</span></span>
            <span className="text-emerald-400/80 font-light flex items-center gap-0.5">
              <Check size={9} className="stroke-[1.5]" />
              {stats.acertos}
            </span>
            <span className="text-rose-400/80 font-light flex items-center gap-0.5">
              <X size={9} className="stroke-[1.5]" />
              {stats.erros}
            </span>
            {stats.duvidasCount > 0 && (
              <span className="text-amber-400/80 font-light flex items-center gap-0.5">
                <Flag size={8} />
                {stats.duvidasCount}
              </span>
            )}
            <span className={`px-1.5 py-0.2 rounded border text-[9px] font-light tabular-nums ${aproveitamentoClasses}`}>
              {stats.pct === null ? "—" : `${stats.pct}%`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Ações de Admin no Caso */}
            {isAdmin && (
              <div className="flex items-center gap-1 opacity-95 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity shrink-0 select-none">
                {onOpenMoverCaso && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenMoverCaso(caso, caderno)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenMoverCaso(caso, caderno); } }}
                    title="Mover este subcaso para outro caderno"
                    className="inline-flex items-center gap-1 px-2 sm:px-1.5 py-1 sm:py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-[10px] sm:text-[9.5px] font-normal text-indigo-300 transition-colors cursor-pointer"
                  >
                    <FolderInput size={11} />
                    <span className="hidden sm:inline">Mover</span>
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => onAddSubfolder?.(caso.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddSubfolder?.(caso.id); } }}
                  title="Adicionar subpasta neste caso"
                  className="p-1.5 sm:p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.08] active:bg-white/[0.12] rounded transition-colors cursor-pointer inline-flex"
                >
                  <FolderPlus size={12} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => onRenameCaso?.(caso.id, caso.nome)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRenameCaso?.(caso.id, caso.nome); } }}
                  title="Renomear este caso"
                  className="p-1.5 sm:p-1 text-slate-500 hover:text-amber-400 hover:bg-white/[0.08] active:bg-white/[0.12] rounded transition-colors cursor-pointer inline-flex"
                >
                  <Pencil size={12} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => onDeleteCaso?.(caso.id, caso.nome, caso.questoes)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDeleteCaso?.(caso.id, caso.nome, caso.questoes); } }}
                  title={caso.questoes.length > 0 ? `Excluir subpasta e suas ${caso.questoes.length} questões` : "Excluir esta subpasta/caso"}
                  className="p-1.5 sm:p-1 text-slate-500 hover:text-rose-400 hover:bg-white/[0.08] active:bg-white/[0.12] rounded transition-colors cursor-pointer inline-flex"
                >
                  <Trash2 size={12} />
                </span>
              </div>
            )}

            {/* Botão rápido para revisar erros deste caso */}
            {stats.erros > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  const errQs = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === false);
                  if (errQs.length > 0) onOpenQuestion(errQs[0], errQs);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    const errQs = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === false);
                    if (errQs.length > 0) onOpenQuestion(errQs[0], errQs);
                  }
                }}
                title={`Revisar ${stats.erros} erro(s) de "${caso.nome}"`}
                className="inline-flex items-center gap-1 px-2 sm:px-1.5 py-1 sm:py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] sm:text-[9.5px] font-semibold text-rose-300 transition-colors cursor-pointer"
              >
                <Play size={8} fill="currentColor" /> Erros
              </span>
            )}

            {/* Imprimir Questões do Caso */}
            {caso.questoes.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onPrintCaso?.(caso);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onPrintCaso?.(caso); } }}
                title={`Imprimir ${caso.questoes.length} questões deste caso (${caso.nome})`}
                className="p-1.5 sm:p-1 text-slate-500 hover:text-indigo-300 hover:bg-white/[0.08] rounded transition-colors cursor-pointer inline-flex"
              >
                <Printer size={12} className="sm:w-[11px] sm:h-[11px]" />
              </span>
            )}

            <ChevronDown
              size={11}
              className={`hidden sm:block text-slate-500/70 shrink-0 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo do Caso expandido */}
      {isOpen && (
        <div className="pl-2 sm:pl-4 pr-1 pb-1 flex flex-col gap-1 border-l border-white/[0.05] ml-2 sm:ml-3.5 my-0.5">
          {caso.questoes.length === 0 ? (
            <div className="py-2 px-3 border border-dashed border-white/[0.05] rounded-md text-center text-slate-500 text-[11px] font-light">
              Nenhuma questão neste caso. Arraste questões para cá.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Cabeçalho das colunas no desktop */}
              <div className="hidden md:grid md:grid-cols-[54px_minmax(130px,1.2fr)_minmax(115px,1fr)_minmax(90px,0.85fr)_110px_118px_auto] items-center gap-2.5 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/[0.05]">
                <span>Ordem</span>
                <span>Plataforma / IDs</span>
                <span>Prova · Ano</span>
                <span>Banca</span>
                <span>Dificuldade</span>
                <span className="text-right">Status / Erros</span>
                <span className="text-right">Ações</span>
              </div>

              {caso.questoes.slice(0, visibleLimit).map((sourceQuestion, qIdx) => {
                const q = getQuestionWithCurrentDifficulty(sourceQuestion);
                return (
                <QuestaoRowItem
                  key={q.id}
                  questao={q}
                  numero={qIdx + 1}
                  casoNome={caso.nome}
                  stats={userAnswers[String(q.id)]}
                  isDuvida={duvidas.has(String(q.id))}
                  onOpenQuestion={onOpenQuestion}
                  queue={caso.questoes}
                  isAdmin={isAdmin}
                  onEdit={onEditQuestao}
                  onMove={onMoveQuestao}
                  onDelete={onDeleteQuestao}
                  onChangeDifficulty={onChangeDifficulty}
                />
                );
              })}

              {caso.questoes.length > visibleLimit && (
                <div className="flex items-center justify-center gap-2 pt-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(v => v + 80)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] font-normal text-slate-300 transition-colors"
                  >
                    Mostrar mais (+{Math.min(80, caso.questoes.length - visibleLimit)} de {caso.questoes.length - visibleLimit})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(caso.questoes.length)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-normal text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Exibir todas ({caso.questoes.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CadernoDedicatedView (Tela focada no Caderno com filtro de Plataforma e Erros)
// ─────────────────────────────────────────────────────────────────────────────
function CadernoDedicatedView({
  caderno,
  onBack,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onTrainAll,
  onDropQuestion,
  onOpenNovaPastaModal,
  isAdmin,
  onEditQuestao,
  onMoveQuestao,
  onDeleteQuestao,
  onChangeDifficulty,
  getQuestionWithCurrentDifficulty,
  onRenameCaso,
  onDeleteCaso,
  onPrintCaderno,
  onPrintCaso,
  onDeleteCaderno,
  onOpenMoverCaso,
  plataformaFiltro,
  onChangePlataformaFiltro,
}: {
  caderno: CadernoItem;
  onBack: () => void;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onTrainAll: (queue: BancoQuestion[]) => void;
  onDropQuestion: (questaoId: string, targetCasoId: string) => void;
  onOpenNovaPastaModal: (parentCadernoId: string) => void;
  isAdmin?: boolean;
  onEditQuestao?: (q: BancoQuestion) => void;
  onMoveQuestao?: (q: BancoQuestion) => void;
  onDeleteQuestao?: (q: BancoQuestion) => void;
  onChangeDifficulty?: (q: BancoQuestion, difficulty: string) => Promise<void>;
  getQuestionWithCurrentDifficulty: (q: BancoQuestion) => BancoQuestion;
  onRenameCaso?: (casoId: string, currentNome: string) => void;
  onDeleteCaso?: (casoId: string, casoNome: string, questoes?: BancoQuestion[]) => void;
  onPrintCaderno?: (caderno: CadernoItem) => void;
  onPrintCaso?: (caso: CasoGroup) => void;
  onDeleteCaderno?: (caderno: CadernoItem) => void;
  onOpenMoverCaso?: (caso: CasoGroup, caderno?: CadernoItem) => void;
  plataformaFiltro: PlataformaFiltro;
  onChangePlataformaFiltro: (plat: PlataformaFiltro) => void;
}) {
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "erros" | "mais_erros" | "nao_feitas" | "duvidas">("todas");
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const questoesPorPlataforma = useMemo(() => {
    return caderno.questoes.filter((q) => matchesPlataforma(q, plataformaFiltro));
  }, [caderno.questoes, plataformaFiltro]);

  const platformCounts = useMemo(() => {
    let qc = 0;
    let gran = 0;
    let tec = 0;
    caderno.questoes.forEach((q) => {
      const { idq, idg, idtec } = getQuestionIds(q);
      if (idq) qc++;
      if (idg) gran++;
      if (idtec) tec++;
    });
    return { todas: caderno.questoes.length, qc, gran, tec };
  }, [caderno.questoes]);

  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let duvidasCount = 0;

    questoesPorPlataforma.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) {
        if (st.isCorrect) acertos++;
        else erros++;
      }
      if (duvidas.has(String(q.id))) duvidasCount++;
    });

    const total = questoesPorPlataforma.length;
    const respondidas = acertos + erros;
    const pct = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, pct };
  }, [questoesPorPlataforma, userAnswers, duvidas]);

  const casosFiltrados = useMemo(() => {
    const mapped = caderno.casos
      .map((c) => {
        let qs = c.questoes.filter((q) => matchesPlataforma(q, plataformaFiltro));
        if (filtroStatus === "erros") {
          qs = qs.filter((q) => userAnswers[String(q.id)] && !userAnswers[String(q.id)].isCorrect);
        } else if (filtroStatus === "mais_erros") {
          qs = qs
            .filter((q) => (userAnswers[String(q.id)]?.errorCount || 0) > 0)
            .sort((a, b) => (userAnswers[String(b.id)]?.errorCount || 0) - (userAnswers[String(a.id)]?.errorCount || 0));
        } else if (filtroStatus === "nao_feitas") {
          qs = qs.filter((q) => !userAnswers[String(q.id)]);
        } else if (filtroStatus === "duvidas") {
          qs = qs.filter((q) => duvidas.has(String(q.id)));
        }
        return { ...c, questoes: filtroStatus === "mais_erros" ? qs : sortQuestoesByOrdem(qs) };
      });

    const hasActiveFilter = filtroStatus !== "todas" || plataformaFiltro !== "todas";
    return hasActiveFilter ? mapped.filter((c) => c.questoes.length > 0) : mapped;
  }, [caderno.casos, filtroStatus, plataformaFiltro, userAnswers, duvidas]);

  const errorQueue = useMemo(() => {
    return sortQuestoesByOrdem(
      questoesPorPlataforma.filter((q) => userAnswers[String(q.id)]?.isCorrect === false)
    );
  }, [questoesPorPlataforma, userAnswers]);

  const allFilteredQueue = useMemo(() => {
    return casosFiltrados.flatMap((c) => c.questoes);
  }, [casosFiltrados]);

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Topo da Visão Dedicada */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#101526] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.08]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={onBack}
            title="Voltar aos Cadernos"
            aria-label="Voltar aos Cadernos"
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] active:bg-white/[0.10] hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft size={18} className="text-indigo-400" />
          </button>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-base sm:text-lg shrink-0">📝</span>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-normal text-white break-words">{caderno.nome}</h3>
                <span className="text-[9px] sm:text-[10px] font-normal text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md shrink-0 uppercase">
                  {caderno.materia}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {casosFiltrados.length} caso(s) · {stats.total} questões
              </p>
            </div>
          </div>
        </div>

        {/* Ações do caderno (Excluir + Revisar Erros + Resolver) */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto flex-wrap">
          {isAdmin && onDeleteCaderno && (
            <button
              type="button"
              onClick={() => onDeleteCaderno(caderno)}
              title="Excluir este caderno"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-normal transition-colors"
            >
              <Trash2 size={12} />
              <span>Excluir</span>
            </button>
          )}
          {errorQueue.length > 0 && (
            <button
              onClick={() => onOpenQuestion(errorQueue[0], errorQueue)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <AlertTriangle size={12} className="text-rose-400" /> Revisar Erros ({errorQueue.length})
            </button>
          )}
          <button
            onClick={() => onTrainAll(allFilteredQueue.length > 0 ? allFilteredQueue : questoesPorPlataforma)}
            disabled={allFilteredQueue.length === 0 && questoesPorPlataforma.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            <Play size={12} /> Resolver ({allFilteredQueue.length})
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Casos + Filtro de Plataforma (Qconcursos / Gran / TEC) */}
      <div className="flex flex-col gap-2.5 bg-[#101526] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-white/[0.06]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono tabular-nums overflow-x-auto custom-scrollbar flex-nowrap py-0.5">
              <span className="text-slate-400">{stats.total} quest.</span>
              <span className="text-emerald-400 flex items-center gap-0.5" title="Acertos"><Check size={11} />{stats.acertos}</span>
              <span className="text-rose-400 flex items-center gap-0.5" title="Erros"><X size={11} />{stats.erros}</span>
              <span className="text-amber-400 flex items-center gap-0.5" title="Dúvidas"><Flag size={10} />{stats.duvidasCount}</span>
              <span
                className={`px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] ${
                  stats.pct === null
                    ? "text-slate-500 border-white/[0.08] bg-white/[0.02]"
                    : stats.pct >= 70
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : stats.pct >= 50
                    ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    : "text-rose-400 border-rose-500/30 bg-rose-500/10"
                }`}
              >
                {stats.pct === null ? "—" : `${stats.pct}%`}
              </span>
            </div>

            <div className="relative flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsActionsOpen(open => !open)}
                aria-label="Mais ações do caderno"
                aria-expanded={isActionsOpen}
                title="Mais ações"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0d1220] text-slate-300 hover:bg-white/[0.08] active:bg-white/[0.12] hover:text-white transition-colors"
              >
                <MoreVertical size={16} />
              </button>

              {isActionsOpen && (
                <div className="absolute right-0 sm:left-0 sm:right-auto top-full z-30 mt-1 flex w-60 max-w-[calc(100vw-32px)] flex-col rounded-xl border border-white/[0.10] bg-[#111827] p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsOpen(false);
                      onOpenNovaPastaModal(caderno.id);
                    }}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2.5 sm:py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <FolderPlus size={14} className="text-indigo-300" /> Nova Subpasta / Caso
                  </button>
                  {caderno.questoes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onPrintCaderno?.(caderno);
                      }}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2.5 sm:py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Printer size={14} className="text-indigo-400" /> Imprimir Caderno ({caderno.questoes.length})
                    </button>
                  )}
                  {isAdmin && onDeleteCaderno && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        onDeleteCaderno(caderno);
                      }}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2.5 sm:py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Trash2 size={14} /> Excluir Caderno
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filtros de Status */}
          <div className="w-full lg:w-auto flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar flex-nowrap">
            {[
              { id: "todas", label: "Todas" },
              { id: "erros", label: "Erros" },
              { id: "mais_erros", label: "Mais Erros" },
              { id: "nao_feitas", label: "Pendentes" },
              { id: "duvidas", label: "Dúvidas" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFiltroStatus(st.id as any)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                  filtroStatus === st.id
                    ? st.id === "erros" || st.id === "mais_erros"
                      ? "bg-rose-600 text-white"
                      : "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: Filtro por ID de Plataforma (Todas | Qconcursos | Gran | TEC) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Filtrar por ID da plataforma:
          </span>
          <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar flex-nowrap max-w-full">
            {[
              { id: "todas" as PlataformaFiltro, label: `Todas (${platformCounts.todas})`, activeCls: "bg-indigo-600 text-white" },
              { id: "qconcursos" as PlataformaFiltro, label: `Qconcursos (${platformCounts.qc})`, activeCls: "bg-amber-600 text-white" },
              { id: "gran" as PlataformaFiltro, label: `Gran (${platformCounts.gran})`, activeCls: "bg-cyan-600 text-white" },
              { id: "tec" as PlataformaFiltro, label: `TEC (${platformCounts.tec})`, activeCls: "bg-violet-600 text-white" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChangePlataformaFiltro(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  plataformaFiltro === p.id ? p.activeCls : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Casos do Caderno */}
      <div className="flex flex-col gap-2 p-2.5 sm:p-3.5 bg-[#0a0e1a]/85 rounded-xl border border-white/[0.04]">
        <h4 className="text-[10px] font-normal text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
          <LayoutGrid size={11} className="text-indigo-400/70" /> Casos & Questões (Ordenados por Ordem)
        </h4>

        {casosFiltrados.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Nenhuma questão encontrada para os filtros selecionados neste caderno.
          </div>
        ) : (
          <div className="relative flex flex-col gap-1.5">
            {casosFiltrados.map((caso, idx) => (
              <CasoAccordion
                key={caso.id}
                caso={caso}
                caderno={caderno}
                index={idx}
                userAnswers={userAnswers}
                duvidas={duvidas}
                onOpenQuestion={onOpenQuestion}
                onDropQuestion={onDropQuestion}
                isAdmin={isAdmin}
                onEditQuestao={onEditQuestao}
                onMoveQuestao={onMoveQuestao}
                onDeleteQuestao={onDeleteQuestao}
                onChangeDifficulty={onChangeDifficulty}
                getQuestionWithCurrentDifficulty={getQuestionWithCurrentDifficulty}
                onRenameCaso={onRenameCaso}
                onAddSubfolder={onOpenNovaPastaModal}
                onDeleteCaso={onDeleteCaso}
                onPrintCaso={onPrintCaso}
                onOpenMoverCaso={onOpenMoverCaso}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: ModalCriarPasta (Cria nós em organizacao_nos)
// ─────────────────────────────────────────────────────────────────────────────
function ModalCriarPasta({
  isOpen,
  onClose,
  parentNodes,
  defaultParentId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  parentNodes: { id: string; nome: string; nivel: string }[];
  defaultParentId?: string;
  onSuccess: () => void;
}) {
  const [nome, setNome] = useState("");
  const [parentId, setParentId] = useState<string>(defaultParentId || "");
  const [tipo, setTipo] = useState<"pasta" | "caderno" | "caso">("pasta");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (defaultParentId) {
      setParentId(defaultParentId);
    }
  }, [defaultParentId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const payload: any = {
        nome: nome.trim(),
        parent_id: parentId ? parentId : null,
        tipo: tipo,
        ordem: 0,
      };

      // Gravação direta na tabela organizacao_nos com parent_id estruturado
      let res = await (supabasePublic.from("organizacao_nos") as any)
        .insert(payload)
        .select("*")
        .single();

      if (res.error && supabase) {
        res = await (supabase.from("organizacao_nos") as any)
          .insert(payload)
          .select("*")
          .single();
      }

      if (res.error) {
        throw new Error(res.error.message || "Erro ao criar pasta no banco");
      }

      setNome("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro desconhecido ao criar pasta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0d1220] border border-white/10 rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col gap-4 my-auto">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderPlus size={16} />
            </span>
            <h3 className="text-sm font-bold text-white">Criar Nova Pasta / Caderno</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nome da Pasta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Mercado de Capitais, Underwriting, etc."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-[#111623] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pasta Pai (Hierarquia de Nós)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="bg-[#111623] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">(Raiz) Nova Matéria Principal</option>
              {parentNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nivel} {n.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-white/[0.10] text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !nome.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {isSubmitting ? "Criando..." : "Criar Pasta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal: CadernosTab
// ─────────────────────────────────────────────────────────────────────────────
export default function CadernosTab({
  questions,
  userAnswers,
  duvidas,
  initialOrgNodes,
  onOrgNodesChanged,
  onSelectQuestion,
  onAnswer,
  onToggleDuvida,
  user,
  userId,
  onShowAuth,
  onRefreshQuestions,
  onPatchQuestionsLocal,
  onRemoveQuestionsLocal,
  isAdmin = false,
}: CadernosTabProps) {
  const [selectedCadernoId, setSelectedCadernoId] = useState<string | null>(null);
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [plataformaFiltro, setPlataformaFiltro] = useState<PlataformaFiltro>("todas");
  const [bancaFiltro, setBancaFiltro] = useState<string>("Todas");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "mais_erros" | "nao_feitas" | "duvidas">("todas");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [expandedCasosView, setExpandedCasosView] = useState<Set<string>>(() => new Set());

  // Alternante de matérias: guarda quais estão ABERTAS (Set vazio = todas fechadas por padrão)
  const [materiasAbertas, setMateriasAbertas] = useState<Set<string>>(new Set());

  const toggleRecolherMateria = useCallback((materiaId: string) => {
    setMateriasAbertas(prev => {
      const next = new Set(prev);
      if (next.has(materiaId)) {
        next.delete(materiaId);
      } else {
        next.add(materiaId);
      }
      return next;
    });
  }, []);

  // Permissão de Administrador resiliente (prop + fallback direto em notion_blocks_admins)
  const [isAdminState, setIsAdminState] = useState<boolean>(!!isAdmin);

  useEffect(() => {
    setIsAdminState(!!isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdminState) return;
    if (!user?.email) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("notion_blocks_admins")
          .select("email")
          .ilike("email", user.email)
          .maybeSingle();
        if (data) setIsAdminState(true);
      } catch (err) {
        // silencioso
      }
    })();
  }, [user?.email, isAdminState]);

  // Alternador de Visualização: "blocos" (Notion Cards) ou "arvore" (Tree Folder)
  const [viewMode, setViewMode] = useState<"blocos" | "arvore" | "mapa" | "caderno_plus">("blocos");
  const [mapaCadernosAbertos, setMapaCadernosAbertos] = useState<Set<string>>(() => new Set());
  const [painelMateriasAbertas, setPainelMateriasAbertas] = useState<Set<string>>(() => new Set());
  const [painelCadernosAbertos, setPainelCadernosAbertos] = useState<Set<string>>(() => new Set());

  // Estado dos nós de organização carregados do Supabase
  const [dbNodes, setDbNodes] = useState<OrgNodeDB[]>(() => initialOrgNodes || []);
  const [questionToDelete, setQuestionToDelete] = useState<BancoQuestion | null>(null);
  const [deletingSingleQuestion, setDeletingSingleQuestion] = useState(false);
  const [difficultyOverrides, setDifficultyOverrides] = useState<Map<string, string>>(new Map());
  const [isNovaPastaModalOpen, setIsNovaPastaModalOpen] = useState(false);
  const [isImportJsonOpen, setIsImportJsonOpen] = useState(false);
  const [modalDefaultParentId, setModalDefaultParentId] = useState<string>("");

  // Override local de organizacao_id para drag and drop instantâneo
  const [orgOverrides, setOrgOverrides] = useState<Map<string, string>>(new Map());
  const [draggingCadernoId, setDraggingCadernoId] = useState<string | null>(null);
  const [dragOverCadernoId, setDragOverCadernoId] = useState<string | null>(null);

  // Administração Avançada (Exclusivo Admin)
  const [editingQuestao, setEditingQuestao] = useState<BancoQuestion | null>(null);
  const [movingQuestaoIds, setMovingQuestaoIds] = useState<(string | number)[]>([]);
  const [movingQuestaoLabel, setMovingQuestaoLabel] = useState<string>("");
  const [renamingNode, setRenamingNode] = useState<{ id: string; nome: string } | null>(null);
  const [subcasoToMove, setSubcasoToMove] = useState<SubcasoToMove | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetNode | null>(null);
  const unfilteredCadernosRef = useRef<CadernoItem[]>([]);
  const unfilteredMateriasRef = useRef<MateriaGroup[]>([]);
  const unfilteredTreeRootsRef = useRef<HierarchyTreeNode[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Estado do Modal de Resolução (exatamente igual à Questão Ativa)
  const [modalQuestion, setModalQuestion] = useState<BancoQuestion | null>(null);
  const [modalQueue, setModalQueue] = useState<BancoQuestion[]>([]);
  const [modalIndex, setModalIndex] = useState(0);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  // Estado do Modal de Impressão de Cadernos e Casos (Banco de Questões)
  const [printModalData, setPrintModalData] = useState<{
    isOpen: boolean;
    questions: BancoQuestion[];
    title: string;
    subTitle: string;
  }>({
    isOpen: false,
    questions: [],
    title: "",
    subTitle: "",
  });

  const handlePrintCaderno = useCallback((cad: CadernoItem) => {
    setPrintModalData({
      isOpen: true,
      questions: cad.questoes,
      title: `CADERNO: ${cad.nome.toUpperCase()}`,
      subTitle: `Matéria: ${cad.materia} • ${cad.casos.length} caso(s) • ${cad.questoes.length} questões`,
    });
  }, []);

  const handlePrintCaso = useCallback((caso: CasoGroup) => {
    setPrintModalData({
      isOpen: true,
      questions: caso.questoes,
      title: `CASO: ${caso.nome.toUpperCase()}`,
      subTitle: `Caderno / Tópico • ${caso.questoes.length} questões selecionadas`,
    });
  }, []);

  const handlePrintNode = useCallback((node: HierarchyTreeNode) => {
    const allNodeQuestions: BancoQuestion[] = [...node.questoes];
    const visited = new Set<string>([node.id]);
    function collect(n: HierarchyTreeNode) {
      for (const child of n.filhos) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        allNodeQuestions.push(...child.questoes);
        collect(child);
      }
    }
    collect(node);

    setPrintModalData({
      isOpen: true,
      questions: allNodeQuestions,
      title: `PASTA: ${node.nome.toUpperCase()}`,
      subTitle: `Estrutura de Pastas do Banco • ${allNodeQuestions.length} questões`,
    });
  }, []);

  // ── 1. Carregar nós da hierarquia (organizacao_nos) ──
  const carregarNos = useCallback(async () => {
    try {
      let res = await supabasePublic
        .from("organizacao_nos")
        .select("*")
        .order("ordem", { ascending: true });

      if (res.error && supabase) {
        res = await supabase
          .from("organizacao_nos")
          .select("*")
          .order("ordem", { ascending: true });
      }

      if (!res.error && res.data) {
        const loaded = res.data as OrgNodeDB[];
        setDbNodes(loaded);
        onOrgNodesChanged?.(loaded);
      }
    } catch (e) {
      console.warn("Aviso ao buscar organizacao_nos:", e);
    }
  }, [onOrgNodesChanged]);

  useEffect(() => {
    if (initialOrgNodes && initialOrgNodes.length > 0 && dbNodes.length === 0) {
      setDbNodes(initialOrgNodes);
    }
  }, [initialOrgNodes, dbNodes.length]);

  useEffect(() => {
    if (!initialOrgNodes || initialOrgNodes.length === 0) {
      void carregarNos();
    }
  }, [carregarNos, initialOrgNodes]);

  // Handlers de Administração de Questões e Casos
  const handleEditQuestao = useCallback((q: BancoQuestion) => {
    if (!isAdminState) return;
    setEditingQuestao(q);
  }, [isAdminState]);

  const handleEditSuccess = useCallback((updated: BancoQuestion) => {
    showToast("Questão atualizada com sucesso!");
    setModalQueue((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setModalQuestion((prev) => (prev && prev.id === updated.id ? updated : prev));
    if (onPatchQuestionsLocal) {
      onPatchQuestionsLocal([{ id: updated.id, patch: updated }]);
    } else if (onRefreshQuestions) {
      onRefreshQuestions();
    }
  }, [onPatchQuestionsLocal, onRefreshQuestions]);

  const handleChangeDifficulty = useCallback(async (question: BancoQuestion, difficulty: string) => {
    if (!userId) {
      onShowAuth();
      return;
    }
    const previous = question.dificuldade;
    const questionId = String(question.id);
    setDifficultyOverrides(current => new Map(current).set(questionId, difficulty));
    try {
      const result = await supabase.from("questao_classificacoes").upsert({
        user_id: userId,
        questao_id: questionId,
        classificacao: difficulty,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,questao_id" });
      if (result.error) throw result.error;
      const updatedQuestion = { ...question, dificuldade: difficulty };
      setModalQueue(queue => queue.map(item => String(item.id) === questionId ? updatedQuestion : item));
      setModalQuestion(current => current && String(current.id) === questionId ? updatedQuestion : current);
      showToast(`Sua classificação foi alterada para ${difficulty}.`);
    } catch (error: any) {
      setDifficultyOverrides(current => {
        const next = new Map(current);
        if (previous) next.set(questionId, previous);
        else next.delete(questionId);
        return next;
      });
      showToast(error?.message || "Não foi possível alterar a dificuldade.", "error");
      throw error;
    }
  }, [userId, onShowAuth]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setDifficultyOverrides(new Map());
      return;
    }
    (async () => {
      const { data, error } = await supabase.from("questao_classificacoes")
        .select("questao_id, classificacao").eq("user_id", userId);
      if (!active) return;
      if (error) {
        console.error("Erro ao carregar classificações pessoais:", error);
        return;
      }
      setDifficultyOverrides(new Map((data ?? []).map(row => [String(row.questao_id), String(row.classificacao)])));
    })();
    return () => { active = false; };
  }, [userId]);

  const getQuestionWithCurrentDifficulty = useCallback((question: BancoQuestion) => {
    const override = difficultyOverrides.get(String(question.id));
    return override ? { ...question, dificuldade: override } : question;
  }, [difficultyOverrides]);

  const handleOpenMoveModal = useCallback((q: BancoQuestion) => {
    if (!isAdminState) return;
    const label = (q as any).ID_Qconcursos || (q as any).Ordem ? `Q${(q as any).ID_Qconcursos || (q as any).Ordem}` : `Questão #${q.id}`;
    setMovingQuestaoIds([q.id]);
    setMovingQuestaoLabel(label);
  }, [isAdminState]);

  const handleMoveSuccess = useCallback((targetNodeId: string, targetNodeName: string) => {
    setOrgOverrides(prev => {
      const next = new Map(prev);
      movingQuestaoIds.forEach(id => next.set(String(id), targetNodeId));
      return next;
    });
    showToast(`Questão movida para "${targetNodeName}" com sucesso!`);
    if (onPatchQuestionsLocal) {
      onPatchQuestionsLocal(
        movingQuestaoIds.map((id) => ({ id, patch: { organizacao_id: targetNodeId } }))
      );
    } else if (onRefreshQuestions) {
      onRefreshQuestions();
    }
  }, [movingQuestaoIds, onPatchQuestionsLocal, onRefreshQuestions]);

  const handleOpenRenameCaso = useCallback((casoId: string, currentNome: string) => {
    if (!isAdminState) return;
    setRenamingNode({ id: casoId, nome: currentNome });
  }, [isAdminState]);

  const handleRenameSuccess = useCallback((nodeId: string, newNome: string) => {
    showToast(`Pasta renomeada para "${newNome}" com sucesso!`);
    setDbNodes((prev) => {
      const next = prev.map((n) => (String(n.id) === String(nodeId) ? { ...n, nome: newNome } : n));
      onOrgNodesChanged?.(next);
      return next;
    });
    void carregarNos();
  }, [carregarNos, onOrgNodesChanged]);

  // Exclusão definitiva de questões em lotes seguros, limpando FKs (duvidas e historico_respostas)
  const deleteQuestionsPermanently = useCallback(async (qIds: (string | number)[]) => {
    if (!qIds || qIds.length === 0) return;
    const CHUNK_SIZE = 30; // Chunks seguros para URL e PostgREST
    for (let i = 0; i < qIds.length; i += CHUNK_SIZE) {
      const chunk = qIds.slice(i, i + CHUNK_SIZE);

      // 1. Limpa registros órfãos na tabela pública `duvidas`
      try {
        await supabase.from("duvidas").delete().in("questao_id", chunk);
      } catch (err) {
        console.warn("Aviso ao limpar duvidas associadas:", err);
      }

      // 2. Limpa registros órfãos na tabela pública `historico_respostas`
      try {
        await supabase.from("historico_respostas").delete().in("questao_id", chunk);
      } catch (err) {
        console.warn("Aviso ao limpar historico_respostas associado:", err);
      }

      // 3. Exclui da tabela `questoes`
      let resQ = await supabase.from("questoes").delete().in("id", chunk);
      if (resQ.error) {
        resQ = await supabasePublic.from("questoes").delete().in("id", chunk);
      }
      if (resQ.error) {
        console.error("Erro ao excluir questoes do banco:", resQ.error);
        throw new Error(`Falha ao excluir questões do banco: ${resQ.error.message}`);
      }
    }
  }, []);

  const handleDeleteQuestao = useCallback((q: BancoQuestion) => {
    if (!isAdminState) {
      showToast("Apenas administradores autorizados podem excluir questões.", "error");
      return;
    }
    setQuestionToDelete(q);
  }, [isAdminState]);

  const confirmDeleteSingleQuestion = useCallback(async () => {
    if (!questionToDelete) return;
    setDeletingSingleQuestion(true);
    try {
      await deleteQuestionsPermanently([questionToDelete.id]);
      showToast("Questão excluída com sucesso!");
      const deletedId = questionToDelete.id;
      setQuestionToDelete(null);
      if (onRemoveQuestionsLocal) onRemoveQuestionsLocal([deletedId]);
      else if (onRefreshQuestions) onRefreshQuestions();
    } catch (e: any) {
      console.error("Erro ao excluir questão:", e);
      showToast(e.message || "Erro ao excluir questão.", "error");
    } finally {
      setDeletingSingleQuestion(false);
    }
  }, [questionToDelete, deleteQuestionsPermanently, onRemoveQuestionsLocal, onRefreshQuestions]);

  // Exclusão recursiva de nós em organizacao_nos (folhas primeiro para não violar parent_id_fkey)
  const deleteOrgNodeHierarchy = useCallback(async (rootNodeId: string, deleteLinkedQuestions = true) => {
    if (!rootNodeId || rootNodeId.startsWith("cad_virt_") || rootNodeId.startsWith("caso_virt_") || rootNodeId.startsWith("root_virt_")) {
      return;
    }

    // Busca nós atuais de organizacao_nos para garantir hierarquia fresca
    let allNodes: { id: string | number; parent_id?: string | number | null }[] = [];
    try {
      const res = await supabase.from("organizacao_nos").select("id, parent_id");
      if (res.data) allNodes = res.data;
    } catch (_) {
      allNodes = dbNodes;
    }
    if (!allNodes || allNodes.length === 0) allNodes = dbNodes;

    // Mapa de pai -> filhos
    const childrenMap = new Map<string, string[]>();
    allNodes.forEach(n => {
      if (n.parent_id) {
        const pid = String(n.parent_id);
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(String(n.id));
      }
    });

    // Coleta pós-ordem (folhas primeiro, depois pais, até o rootNodeId)
    const orderedIds: string[] = [];
    const visited = new Set<string>();

    function traversePostOrder(currId: string) {
      if (visited.has(currId)) return;
      visited.add(currId);
      const kids = childrenMap.get(currId) || [];
      for (const kid of kids) {
        traversePostOrder(kid);
      }
      orderedIds.push(currId);
    }

    traversePostOrder(rootNodeId);

    // 1. Trata questões vinculadas a qualquer um desses nós em `questoes.organizacao_id`
    try {
      const { data: linkedQuestions } = await supabase
        .from("questoes")
        .select("id")
        .in("organizacao_id", orderedIds);
      if (linkedQuestions && linkedQuestions.length > 0) {
        if (deleteLinkedQuestions) {
          await deleteQuestionsPermanently(linkedQuestions.map(q => q.id));
        } else {
          let unlinkRes = await supabase
            .from("questoes")
            .update({ organizacao_id: null })
            .in("organizacao_id", orderedIds);
          if (unlinkRes.error) {
            unlinkRes = await supabasePublic
              .from("questoes")
              .update({ organizacao_id: null })
              .in("organizacao_id", orderedIds);
          }
          if (unlinkRes.error) {
            throw new Error(`Falha ao desvincular questões: ${unlinkRes.error.message}`);
          }
        }
      }
    } catch (err) {
      if (!deleteLinkedQuestions) throw err;
      console.warn("Aviso ao buscar questões associadas aos nós:", err);
    }

    // 2. Deleta os nós de organizacao_nos em ordem estrita de folhas primeiro
    for (const nodeId of orderedIds) {
      let res = await supabase.from("organizacao_nos").delete().eq("id", nodeId);
      if (res.error) {
        res = await supabasePublic.from("organizacao_nos").delete().eq("id", nodeId);
      }
      if (res.error) {
        console.error(`Erro ao excluir nó ${nodeId}:`, res.error);
        throw new Error(`Erro ao excluir nó: ${res.error.message} (code: ${res.error.code})`);
      }
    }
  }, [dbNodes, deleteQuestionsPermanently]);

  const handleDeleteCaso = useCallback((casoId: string, casoNome: string, questoes?: BancoQuestion[]) => {
    if (!isAdminState) {
      showToast("Apenas administradores autorizados podem excluir casos.", "error");
      return;
    }
    setDeleteTarget({
      kind: "subcaso",
      id: casoId,
      nome: casoNome,
      questoes: questoes || [],
    });
  }, [isAdminState]);

  const handleDeleteCaderno = useCallback((caderno: CadernoItem) => {
    if (!isAdminState) {
      showToast("Apenas administradores autorizados podem excluir cadernos.", "error");
      return;
    }
    const fullCaderno = unfilteredCadernosRef.current.find(c => c.id === caderno.id) || caderno;
    setDeleteTarget({
      kind: "caderno",
      id: fullCaderno.id,
      nome: fullCaderno.nome,
      materia: fullCaderno.materia,
      subcasosCount: fullCaderno.casos.length,
      questoes: fullCaderno.questoes,
    });
  }, [isAdminState]);

  const handleDeleteDisciplina = useCallback((mat: MateriaGroup) => {
    if (!isAdminState) {
      showToast("Apenas administradores autorizados podem excluir disciplinas.", "error");
      return;
    }
    const fullMat = unfilteredMateriasRef.current.find(m => m.id === mat.id) || mat;
    const rootNode = unfilteredTreeRootsRef.current.find(r => r.id === mat.id);
    const allQuestions: BancoQuestion[] = [];
    if (rootNode) {
      const visited = new Set<string>();
      const collect = (n: HierarchyTreeNode) => {
        if (visited.has(n.id)) return;
        visited.add(n.id);
        allQuestions.push(...n.questoes);
        for (const f of n.filhos) collect(f);
      };
      collect(rootNode);
    } else {
      fullMat.cadernos.forEach(c => allQuestions.push(...c.questoes));
    }

    setDeleteTarget({
      kind: "disciplina",
      id: fullMat.id,
      nome: fullMat.nome,
      cadernosCount: fullMat.cadernos.length,
      questoes: allQuestions,
    });
  }, [isAdminState]);

  const handleConfirmDeleteTarget = useCallback(async (target: DeleteTargetNode, deleteQuestions: boolean) => {
    if (!isAdminState) {
      throw new Error("Apenas administradores autorizados podem excluir.");
    }

    const qCount = target.questoes.length;
    const isVirtual =
      target.id.startsWith("cad_virt_") ||
      target.id.startsWith("caso_virt_") ||
      target.id.startsWith("root_virt_");

    if (deleteQuestions && qCount > 0) {
      await deleteQuestionsPermanently(target.questoes.map(q => q.id));
    }

    if (!isVirtual) {
      await deleteOrgNodeHierarchy(target.id, deleteQuestions);
    }

    if (selectedCadernoId === target.id || target.kind === "disciplina") {
      setSelectedCadernoId(null);
    }
    if (target.kind === "disciplina" && materiaFiltro === target.nome) {
      setMateriaFiltro("Todas");
    }

    const label =
      target.kind === "disciplina"
        ? "Disciplina"
        : target.kind === "caderno"
        ? "Caderno"
        : target.kind === "subcaso"
        ? "Subcaso"
        : "Pasta";

    showToast(
      deleteQuestions
        ? `${label} "${target.nome}" e questões removidos!`
        : `${label} "${target.nome}" excluído(a)!`
    );
    await carregarNos();
    if (deleteQuestions && qCount > 0 && onRemoveQuestionsLocal) {
      onRemoveQuestionsLocal(target.questoes.map(q => q.id));
    } else if (!deleteQuestions && qCount > 0 && onPatchQuestionsLocal) {
      onPatchQuestionsLocal(target.questoes.map(q => ({ id: q.id, patch: { organizacao_id: undefined } })));
    } else if (onRefreshQuestions) {
      onRefreshQuestions();
    }
  }, [isAdminState, selectedCadernoId, materiaFiltro, deleteQuestionsPermanently, deleteOrgNodeHierarchy, carregarNos, onRemoveQuestionsLocal, onPatchQuestionsLocal, onRefreshQuestions]);

  // Verifica se candidateId é descendente de ancestorId para impedir ciclos na árvore
  const isNodeDescendant = useCallback((ancestorId: string, candidateId: string): boolean => {
    if (ancestorId === candidateId) return true;
    const parentMap = new Map<string, string | null>();
    dbNodes.forEach(n => parentMap.set(String(n.id), n.parent_id ? String(n.parent_id) : null));
    let curr: string | null | undefined = candidateId;
    const visited = new Set<string>();
    while (curr && !visited.has(curr)) {
      if (curr === ancestorId) return true;
      visited.add(curr);
      curr = parentMap.get(curr);
    }
    return false;
  }, [dbNodes]);

  // ── Mover subcaso de um caderno para outro (com suporte a subcasos virtuais e fallback RLS) ──
  const handleConfirmMoveSubcaso = useCallback(async (
    subcaso: SubcasoToMove,
    targetCadernoId: string,
    targetCadernoNome: string
  ) => {
    if (!isAdminState) {
      throw new Error("Apenas administradores podem mover subcasos.");
    }

    const insertOrgNode = async (payload: { nome: string; parent_id: string | null; tipo: string; ordem: number }) => {
      let res = await (supabasePublic.from("organizacao_nos") as any)
        .insert(payload)
        .select("id")
        .single();
      if (res.error && supabase) {
        res = await (supabase.from("organizacao_nos") as any)
          .insert(payload)
          .select("id")
          .single();
      }
      if (res.error || !res.data?.id) {
        throw new Error(res.error?.message || "Não foi possível criar a pasta de destino.");
      }
      return String(res.data.id);
    };

    let realTargetCadernoId = targetCadernoId;
    if (targetCadernoId.startsWith("cad_virt_")) {
      // Materializa o caderno virtual (e sua matéria raiz virtual, se necessário) usando o nome exato da matéria
      const parentMat = unfilteredMateriasRef.current.find(m =>
        m.cadernos.some(c => c.id === targetCadernoId)
      );
      const targetMatName = parentMat?.nome || "Geral";
      const existingRoot = dbNodes.find(
        n => !n.parent_id && n.nome.trim().toLowerCase() === targetMatName.trim().toLowerCase()
      );
      const parentMatId = existingRoot
        ? String(existingRoot.id)
        : await insertOrgNode({ nome: targetMatName, parent_id: null, tipo: "materia", ordem: 0 });
      realTargetCadernoId = await insertOrgNode({
        nome: targetCadernoNome,
        parent_id: parentMatId,
        tipo: "caderno",
        ordem: 0,
      });
    }

    const isVirtualOrDirect =
      subcaso.id.startsWith("caso_virt_") || subcaso.id === subcaso.cadernoId;

    if (isVirtualOrDirect) {
      const newSubcasoId = await insertOrgNode({
        nome: subcaso.nome,
        parent_id: realTargetCadernoId,
        tipo: "caso",
        ordem: 0,
      });

      if (subcaso.questoes.length > 0) {
        const qIds = subcaso.questoes.map(q => Number(q.id) || q.id);
        let qRes = await supabase
          .from("questoes")
          .update({ organizacao_id: newSubcasoId })
          .in("id", qIds);
        if (qRes.error) {
          qRes = await supabasePublic
            .from("questoes")
            .update({ organizacao_id: newSubcasoId })
            .in("id", qIds);
        }
        if (qRes.error) throw new Error(qRes.error.message);
      }
    } else {
      if (isNodeDescendant(subcaso.id, realTargetCadernoId)) {
        throw new Error("Não é possível mover um subcaso para dentro de si mesmo ou de uma subpasta dele.");
      }

      let res = await supabase
        .from("organizacao_nos")
        .update({ parent_id: realTargetCadernoId })
        .eq("id", subcaso.id);
      if (res.error) {
        res = await supabasePublic
          .from("organizacao_nos")
          .update({ parent_id: realTargetCadernoId })
          .eq("id", subcaso.id);
      }
      if (res.error) throw new Error(res.error.message);
    }

    showToast(`Subcaso "${subcaso.nome}" movido para "${targetCadernoNome}"!`);
    await carregarNos();
    if (onRefreshQuestions) onRefreshQuestions();
  }, [isAdminState, dbNodes, isNodeDescendant, carregarNos, onRefreshQuestions]);

  // ── Drag & Drop de pastas/subcasos na visão em Árvore ──
  const handleDropNodeToParent = useCallback(async (draggedNodeId: string, targetParentId: string) => {
    if (!isAdminState) return;
    if (
      draggedNodeId.startsWith("cad_virt_") ||
      draggedNodeId.startsWith("caso_virt_") ||
      draggedNodeId.startsWith("root_virt_") ||
      targetParentId.startsWith("cad_virt_") ||
      targetParentId.startsWith("caso_virt_") ||
      targetParentId.startsWith("root_virt_")
    ) {
      showToast("Pastas automáticas devem ser movidas pelo botão Mover.", "error");
      return;
    }
    if (isNodeDescendant(draggedNodeId, targetParentId)) {
      showToast("Não é possível mover uma pasta para dentro dela mesma.", "error");
      return;
    }
    try {
      let res = await supabase
        .from("organizacao_nos")
        .update({ parent_id: targetParentId })
        .eq("id", draggedNodeId);
      if (res.error) {
        res = await supabasePublic
          .from("organizacao_nos")
          .update({ parent_id: targetParentId })
          .eq("id", draggedNodeId);
      }
      if (res.error) throw res.error;
      const movedName = dbNodes.find(n => String(n.id) === draggedNodeId)?.nome || "Pasta";
      const targetName = dbNodes.find(n => String(n.id) === targetParentId)?.nome || "Destino";
      showToast(`"${movedName}" movido para "${targetName}"!`);
      await carregarNos();
      if (onRefreshQuestions) onRefreshQuestions();
    } catch (e: any) {
      showToast(e?.message || "Erro ao mover pasta.", "error");
    }
  }, [isAdminState, dbNodes, isNodeDescendant, carregarNos, onRefreshQuestions]);

  const questionMatchesFilters = useCallback(
    (q: BancoQuestion) => {
      if (!matchesPlataforma(q, plataformaFiltro)) return false;

      if (bancaFiltro !== "Todas") {
        const qBanca = String((q as any).Banca || (q as any).banca || "").trim();
        if (qBanca !== bancaFiltro) return false;
      }

      if (statusFiltro === "erros") {
        const st = userAnswers[String(q.id)];
        if (!st || st.isCorrect) return false;
      } else if (statusFiltro === "mais_erros") {
        const st = userAnswers[String(q.id)];
        if (!st || (st.errorCount || 0) <= 0) return false;
      } else if (statusFiltro === "nao_feitas") {
        if (userAnswers[String(q.id)]) return false;
      } else if (statusFiltro === "duvidas") {
        if (!duvidas.has(String(q.id))) return false;
      }

      return true;
    },
    [plataformaFiltro, bancaFiltro, statusFiltro, userAnswers, duvidas]
  );

  // ── 2. Montar Estrutura Hierárquica em Árvore Completa (com proteção anti-ciclo e cache separado) ──
  const buildHierarchyFromQuestions = useCallback(
    (sourceQuestions: BancoQuestion[], sortByErrors: boolean, answersMap: Record<string, QuestionStats>) => {
      const sortList = (list: BancoQuestion[]) => {
        if (sortByErrors) {
          return [...list].sort((a, b) => {
            const errDiff = (answersMap[String(b.id)]?.errorCount || 0) - (answersMap[String(a.id)]?.errorCount || 0);
            if (errDiff !== 0) return errDiff;
            return compareQuestoesByOrdem(a, b);
          });
        }
        return sortQuestoesByOrdem(list);
      };

      const nodeMap = new Map<string, HierarchyTreeNode>();
      dbNodes.forEach(n => {
        const idStr = String(n.id);
        const parentStr = n.parent_id ? String(n.parent_id) : null;
        nodeMap.set(idStr, {
          id: idStr,
          nome: n.nome.trim(),
          parent_id: parentStr && parentStr !== idStr ? parentStr : null,
          tipo: n.tipo,
          ordem: n.ordem ?? 0,
          filhos: [],
          questoes: [],
          totalDescendentesQuestoes: 0,
        });
      });

      const roots: HierarchyTreeNode[] = [];
      const rootByLower = new Map<string, HierarchyTreeNode>();
      const attachedIds = new Set<string>();

      nodeMap.forEach(node => {
        if (node.parent_id && nodeMap.has(node.parent_id)) {
          nodeMap.get(node.parent_id)!.filhos.push(node);
        } else {
          roots.push(node);
          attachedIds.add(node.id);
          const key = node.nome.toLowerCase();
          if (!rootByLower.has(key)) rootByLower.set(key, node);
        }
      });

      // Quebra eventuais ciclos desconexos em organizacao_nos promovendo o primeiro nó do ciclo para raiz
      nodeMap.forEach(node => {
        if (attachedIds.has(node.id)) return;
        let curr: string | null = node.parent_id;
        const seen = new Set<string>([node.id]);
        let reachesRoot = false;
        while (curr && nodeMap.has(curr)) {
          if (attachedIds.has(curr)) {
            reachesRoot = true;
            break;
          }
          if (seen.has(curr)) break;
          seen.add(curr);
          curr = nodeMap.get(curr)!.parent_id;
        }
        if (!reachesRoot) {
          node.parent_id = null;
          roots.push(node);
          attachedIds.add(node.id);
        }
      });

      const sortChildren = (node: HierarchyTreeNode, visited = new Set<string>()) => {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        node.filhos = node.filhos.filter(child => !visited.has(child.id));
        node.filhos.sort((a, b) => {
          const orderA = a.ordem && a.ordem > 0 ? a.ordem : Number.MAX_SAFE_INTEGER;
          const orderB = b.ordem && b.ordem > 0 ? b.ordem : Number.MAX_SAFE_INTEGER;
          return orderA - orderB || a.nome.localeCompare(b.nome, "pt-BR");
        });
        node.filhos.forEach(child => sortChildren(child, visited));
      };
      const sortVisited = new Set<string>();
      roots.forEach(r => sortChildren(r, sortVisited));

      const unlinkedQuestions: BancoQuestion[] = [];
      sourceQuestions.forEach(q => {
        const effectiveOrgId = orgOverrides.get(String(q.id)) || (q as any).organizacao_id;
        if (effectiveOrgId && nodeMap.has(String(effectiveOrgId))) {
          nodeMap.get(String(effectiveOrgId))!.questoes.push(q);
        } else {
          unlinkedQuestions.push(q);
        }
      });

      const cadByRootAndLower = new Map<string, Map<string, HierarchyTreeNode>>();
      const casoByCadAndLower = new Map<string, Map<string, HierarchyTreeNode>>();

      const getCadMap = (root: HierarchyTreeNode) => {
        let m = cadByRootAndLower.get(root.id);
        if (!m) {
          m = new Map();
          for (const f of root.filhos) {
            const k = f.nome.toLowerCase();
            if (!m.has(k)) m.set(k, f);
          }
          cadByRootAndLower.set(root.id, m);
        }
        return m;
      };

      const getCasoMap = (cad: HierarchyTreeNode) => {
        let m = casoByCadAndLower.get(cad.id);
        if (!m) {
          m = new Map();
          for (const f of cad.filhos) {
            const k = f.nome.toLowerCase();
            if (!m.has(k)) m.set(k, f);
          }
          casoByCadAndLower.set(cad.id, m);
        }
        return m;
      };

      unlinkedQuestions.forEach(q => {
        const matName = (q.materia || (q as any).Disciplina || "Conhecimentos Bancários").trim();
        const matLower = matName.toLowerCase();
        let root = rootByLower.get(matLower);
        if (!root) {
          root = {
            id: `root_virt_${matLower}`,
            nome: matName,
            parent_id: null,
            tipo: "materia",
            ordem: 0,
            filhos: [],
            questoes: [],
            totalDescendentesQuestoes: 0,
          };
          roots.push(root);
          nodeMap.set(root.id, root);
          rootByLower.set(matLower, root);
        }

        const cadName = ((q as any).topico || (q as any)["Tópico"] || q.tema || (q as any).PROVA || "Geral").trim();
        const cadLower = cadName.toLowerCase();
        const cadMap = getCadMap(root);
        let cad = cadMap.get(cadLower);
        if (!cad) {
          cad = {
            id: `cad_virt_${root.id}_${cadLower}`,
            nome: cadName,
            parent_id: root.id,
            tipo: "caderno",
            ordem: 0,
            filhos: [],
            questoes: [],
            totalDescendentesQuestoes: 0,
          };
          root.filhos.push(cad);
          nodeMap.set(cad.id, cad);
          cadMap.set(cadLower, cad);
        }

        const casoName = ((q as any).assunto || (q as any)["Assunto"] || (q as any)["Pergunta problema"] || "Geral").trim();
        const casoLower = casoName.toLowerCase();
        const casoMap = getCasoMap(cad);
        let caso = casoMap.get(casoLower);
        if (!caso) {
          caso = {
            id: `caso_virt_${cad.id}_${casoLower}`,
            nome: casoName,
            parent_id: cad.id,
            tipo: "caso",
            ordem: 0,
            filhos: [],
            questoes: [],
            totalDescendentesQuestoes: 0,
          };
          cad.filhos.push(caso);
          nodeMap.set(caso.id, caso);
          casoMap.set(casoLower, caso);
        }

        caso.questoes.push(q);
      });

      const countVisited = new Set<string>();
      const sortAndCount = (node: HierarchyTreeNode, filterEmpty: boolean): number => {
        if (countVisited.has(node.id)) return 0;
        countVisited.add(node.id);
        node.questoes = sortList(node.questoes);
        let total = node.questoes.length;
        if (filterEmpty) {
          node.filhos = node.filhos.filter(child => sortAndCount(child, true) > 0);
          total = node.questoes.length + node.filhos.reduce((acc, c) => acc + c.questoes.length + c.totalDescendentesQuestoes, 0);
        } else {
          for (const child of node.filhos) {
            total += sortAndCount(child, false);
          }
        }
        node.totalDescendentesQuestoes = total - node.questoes.length;
        return total;
      };

      const filterEmpty = sourceQuestions.length < questions.length;
      const finalRoots = filterEmpty
        ? roots.filter(r => sortAndCount(r, true) > 0)
        : (roots.forEach(r => sortAndCount(r, false)), roots);

      const materiasList: MateriaGroup[] = [];
      const cadernosList: CadernoItem[] = [];

      finalRoots.forEach(root => {
        const cadList: CadernoItem[] = [];

        root.filhos.forEach(cadNode => {
          const casosList: CasoGroup[] = [];
          const cadAllQuestions: BancoQuestion[] = [...cadNode.questoes];

          if (cadNode.filhos.length > 0) {
            cadNode.filhos.forEach(casoNode => {
              const casoAllQuestions: BancoQuestion[] = [...casoNode.questoes];
              const subVisited = new Set<string>([casoNode.id]);
              function collectSubQuestions(n: HierarchyTreeNode) {
                for (const sub of n.filhos) {
                  if (subVisited.has(sub.id)) continue;
                  subVisited.add(sub.id);
                  casoAllQuestions.push(...sub.questoes);
                  collectSubQuestions(sub);
                }
              }
              collectSubQuestions(casoNode);

              const sortedCasoQs = sortList(casoAllQuestions);
              casosList.push({
                id: casoNode.id,
                nome: casoNode.nome,
                questoes: sortedCasoQs,
              });
              cadAllQuestions.push(...sortedCasoQs);
            });
          } else {
            casosList.push({
              id: cadNode.id,
              nome: cadNode.nome,
              questoes: sortList(cadNode.questoes),
            });
          }

          casosList.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

          const cadItem: CadernoItem = {
            id: cadNode.id,
            nome: cadNode.nome,
            materia: root.nome,
            casos: casosList,
            questoes: sortList(cadAllQuestions),
          };

          cadList.push(cadItem);
          cadernosList.push(cadItem);
        });

        cadList.sort((a, b) => {
          const nodeA = nodeMap.get(a.id);
          const nodeB = nodeMap.get(b.id);
          const orderA = nodeA?.ordem && nodeA.ordem > 0 ? nodeA.ordem : Number.MAX_SAFE_INTEGER;
          const orderB = nodeB?.ordem && nodeB.ordem > 0 ? nodeB.ordem : Number.MAX_SAFE_INTEGER;
          return orderA - orderB || a.nome.localeCompare(b.nome, "pt-BR");
        });

        materiasList.push({
          id: root.id,
          nome: root.nome,
          icone: getMateriaIcon(root.nome),
          cadernos: cadList,
          totalQuestoes: root.questoes.length + root.totalDescendentesQuestoes,
        });
      });

      materiasList.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      cadernosList.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      return { finalRoots, materiasList, cadernosList };
    },
    [dbNodes, orgOverrides, questions.length]
  );

  // Árvore completa cacheada independentemente de respostas/filtros de usuário
  const rawTreeData = useMemo(() => {
    const rawTree = buildHierarchyFromQuestions(questions, false, userAnswers);
    const options: { id: string; nome: string; nivel: string }[] = [];
    rawTree.finalRoots.forEach(rn => {
      options.push({ id: rn.id, nome: rn.nome, nivel: "🏛️ [Matéria Raiz]" });
      rn.filhos.forEach(cn => {
        options.push({ id: cn.id, nome: `${rn.nome} → ${cn.nome}`, nivel: "  📁 [Subpasta / Caderno]" });
        cn.filhos.forEach(sub => {
          options.push({ id: sub.id, nome: `${rn.nome} → ${cn.nome} → ${sub.nome}`, nivel: "    📄 [Caso Folha]" });
        });
      });
    });
    return { rawTree, parentOptions: options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbNodes, questions, orgOverrides]);

  const filteredTree = useMemo(() => {
    const hasActiveQuestionFilter =
      plataformaFiltro !== "todas" || bancaFiltro !== "Todas" || statusFiltro !== "todas";
    if (!hasActiveQuestionFilter) {
      return rawTreeData.rawTree;
    }
    const matched = questions.filter(questionMatchesFilters);
    return buildHierarchyFromQuestions(matched, statusFiltro === "mais_erros", userAnswers);
  }, [rawTreeData.rawTree, plataformaFiltro, bancaFiltro, statusFiltro, questions, questionMatchesFilters, buildHierarchyFromQuestions, userAnswers]);

  const treeRoots = filteredTree.finalRoots;
  const unfilteredTreeRoots = rawTreeData.rawTree.finalRoots;
  const materiasAgrupadas = filteredTree.materiasList;
  const unfilteredMaterias = rawTreeData.rawTree.materiasList;
  const todosCadernos = filteredTree.cadernosList;
  const unfilteredCadernos = rawTreeData.rawTree.cadernosList;
  const parentOptions = rawTreeData.parentOptions;

  useEffect(() => {
    unfilteredCadernosRef.current = unfilteredCadernos;
    unfilteredMateriasRef.current = unfilteredMaterias;
    unfilteredTreeRootsRef.current = unfilteredTreeRoots;
  }, [unfilteredCadernos, unfilteredMaterias, unfilteredTreeRoots]);

  const selectedCaderno = useMemo(() => {
    if (!selectedCadernoId) return null;
    return unfilteredCadernos.find(c => c.id === selectedCadernoId) || null;
  }, [selectedCadernoId, unfilteredCadernos]);

  // Lista de matérias, bancas e contagens por plataforma
  const materiasDisponiveis = useMemo(() => {
    return materiasAgrupadas.map(m => m.nome);
  }, [materiasAgrupadas]);

  const bancasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      const b = String((q as any).Banca || (q as any).banca || "").trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [questions]);

  const platformCounts = useMemo(() => {
    let qc = 0;
    let gran = 0;
    let tec = 0;
    questions.forEach(q => {
      const { idq, idg, idtec } = getQuestionIds(q);
      if (idq) qc++;
      if (idg) gran++;
      if (idtec) tec++;
    });
    return { todas: questions.length, qc, gran, tec };
  }, [questions]);

  const allErrorQueue = useMemo(() => {
    return sortQuestoesByOrdem(
      questions.filter(q => {
        const st = userAnswers[String(q.id)];
        if (!st || st.isCorrect) return false;
        if (!matchesPlataforma(q, plataformaFiltro)) return false;
        if (bancaFiltro !== "Todas") {
          const qb = String((q as any).Banca || (q as any).banca || "").trim();
          if (qb !== bancaFiltro) return false;
        }
        return true;
      })
    );
  }, [questions, userAnswers, plataformaFiltro, bancaFiltro]);

  // Estatísticas globais do usuário
  const { acertadasCount, erradasCount, duvidasCount, respondidasTotal, taxaAcertoGlobal } = useMemo(() => {
    let a = 0;
    let e = 0;
    for (const st of Object.values(userAnswers)) {
      if (st.isCorrect) a++;
      else e++;
    }
    const d = duvidas.size;
    const total = a + e;
    const taxa = total > 0 ? Math.round((a / total) * 100) : 0;
    return {
      acertadasCount: a,
      erradasCount: e,
      duvidasCount: d,
      respondidasTotal: total,
      taxaAcertoGlobal: taxa,
    };
  }, [userAnswers, duvidas]);

  // Pré-computa estatísticas de matérias e cadernos com useMemo para performance fluida 60FPS
  const { materiasStats, cadernosStats } = useMemo(() => {
    const mStats = new Map<string, { acertos: number; erros: number; duvidas: number; pct: number | null }>();
    const cStats = new Map<string, { acertos: number; erros: number; duvidas: number; pct: number | null }>();

    materiasAgrupadas.forEach((mat) => {
      let mAcertos = 0;
      let mErros = 0;
      let mDuvidas = 0;

      mat.cadernos.forEach((cad) => {
        let cAcertos = 0;
        let cErros = 0;
        let cDuvidas = 0;

        cad.questoes.forEach((q) => {
          const st = userAnswers[String(q.id)];
          if (st) {
            if (st.isCorrect) { cAcertos++; mAcertos++; }
            else { cErros++; mErros++; }
          }
          if (duvidas.has(String(q.id))) { cDuvidas++; mDuvidas++; }
        });

        const cResp = cAcertos + cErros;
        cStats.set(cad.id, {
          acertos: cAcertos,
          erros: cErros,
          duvidas: cDuvidas,
          pct: cResp > 0 ? Math.round((cAcertos / cResp) * 100) : null,
        });
      });

      const mResp = mAcertos + mErros;
      mStats.set(mat.id, {
        acertos: mAcertos,
        erros: mErros,
        duvidas: mDuvidas,
        pct: mResp > 0 ? Math.round((mAcertos / mResp) * 100) : null,
      });
    });

    return { materiasStats: mStats, cadernosStats: cStats };
  }, [materiasAgrupadas, userAnswers, duvidas]);

  // ── Drag & Drop: Mover questão para novo nó ──
  const handleDropQuestion = async (questaoId: string, targetNodeId: string) => {
    if (!questaoId || !targetNodeId) return;

    // Atualiza estado local imediatamente (otimista)
    setOrgOverrides(prev => {
      const next = new Map(prev);
      next.set(String(questaoId), targetNodeId);
      return next;
    });

    // Se o targetNodeId for um UUID real, persiste na coluna questoes.organizacao_id
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetNodeId)) {
      try {
        await supabasePublic
          .from("questoes")
          .update({ organizacao_id: targetNodeId })
          .eq("id", Number(questaoId) || questaoId);
      } catch (e) {
        console.warn("Aviso ao persistir organizacao_id no banco:", e);
      }
    }
  };

  const handleReorderCadernos = useCallback(async (materiaId: string, cadernoId: string, targetCadernoId: string) => {
    if (!isAdminState) return;
    const siblings = dbNodes
      .filter(node => node.parent_id === materiaId)
      .sort((a, b) => {
        const orderA = a.ordem && a.ordem > 0 ? a.ordem : Number.MAX_SAFE_INTEGER;
        const orderB = b.ordem && b.ordem > 0 ? b.ordem : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.nome.localeCompare(b.nome, "pt-BR");
      });
    const index = siblings.findIndex(node => node.id === cadernoId);
    const targetIndex = siblings.findIndex(node => node.id === targetCadernoId);
    if (index < 0 || targetIndex < 0 || index === targetIndex) return;

    const [moved] = siblings.splice(index, 1);
    siblings.splice(targetIndex, 0, moved);
    const ordered = siblings.map((node, position) => ({ ...node, ordem: position + 1 }));
    const orderedIds = new Set(ordered.map(node => node.id));
    setDbNodes(current => [...current.filter(node => !orderedIds.has(node.id)), ...ordered]);

    const results = await Promise.all(ordered.map(node =>
      supabase.from("organizacao_nos").update({ ordem: node.ordem }).eq("id", node.id)
    ));
    const failed = results.find(result => result.error);
    if (failed?.error) {
      showToast("Não foi possível salvar a ordem dos cadernos.", "error");
      await carregarNos();
      return;
    }
    showToast("Ordem dos cadernos salva.");
  }, [dbNodes, isAdminState, carregarNos]);

  // Manipulador de abertura de questão em modal QuestionResolver
  const handleOpenQuestionInModal = useCallback((q: BancoQuestion, queue: BancoQuestion[]) => {
    if (!user) {
      onShowAuth();
      return;
    }
    const personalizedQueue = queue.map(getQuestionWithCurrentDifficulty);
    const idx = personalizedQueue.findIndex(item => String(item.id) === String(q.id));
    setModalQueue(personalizedQueue);
    setModalIndex(idx >= 0 ? idx : 0);
    setModalQuestion(personalizedQueue[idx >= 0 ? idx : 0]);
  }, [user, onShowAuth, getQuestionWithCurrentDifficulty]);

  const handleModalAnswer = async (id: any, answer: string, isCorrect: boolean) => {
    if (onAnswer) {
      setIsSavingAnswer(true);
      try {
        await onAnswer(id, answer, isCorrect);
      } finally {
        setIsSavingAnswer(false);
      }
    }
  };

  const handleModalNext = () => {
    if (modalIndex < modalQueue.length - 1) {
      const nextIdx = modalIndex + 1;
      setModalIndex(nextIdx);
      setModalQuestion(modalQueue[nextIdx]);
    }
  };

  const handleModalPrev = () => {
    if (modalIndex > 0) {
      const prevIdx = modalIndex - 1;
      setModalIndex(prevIdx);
      setModalQuestion(modalQueue[prevIdx]);
    }
  };

  const classificationContextValue = useMemo(
    () => ({ difficultyOverrides, onChangeDifficulty: handleChangeDifficulty }),
    [difficultyOverrides, handleChangeDifficulty]
  );

  // Índice de busca pré-computado para evitar recalcular IDs/lowercase a cada tecla digitada
  const questionSearchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of questions) {
      const { idq, idg, idtec } = getQuestionIds(q);
      const banca = String((q as any).Banca || (q as any).banca || "").toLowerCase();
      const prova = String(q.prova || (q as any).PROVA || "").toLowerCase();
      map.set(
        String(q.id),
        `${idq} ${idg} ${idtec} ${banca} ${prova}`.toLowerCase()
      );
    }
    return map;
  }, [questions]);

  // Filtragem de matérias (busca também por IDs QC/Gran/TEC, Banca e Prova)
  const materiasFiltradas = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return materiasAgrupadas.filter(m => {
      if (materiaFiltro !== "Todas" && m.nome !== materiaFiltro) return false;
      if (term) {
        const matchMateria = m.nome.toLowerCase().includes(term);
        if (matchMateria) return true;
        const matchCaderno = m.cadernos.some(c => {
          if (c.nome.toLowerCase().includes(term)) return true;
          return c.questoes.some(q => questionSearchIndex.get(String(q.id))?.includes(term));
        });
        if (!matchCaderno) return false;
      }
      return true;
    });
  }, [materiasAgrupadas, materiaFiltro, deferredSearch, questionSearchIndex]);

  const handleOpenMoverCasoFromDedicated = useCallback((casoObj: CasoGroup, cad?: CadernoItem) => {
    if (!cad) return;
    setSubcasoToMove({
      id: casoObj.id,
      nome: casoObj.nome,
      cadernoId: cad.id,
      cadernoNome: cad.nome,
      questoes: casoObj.questoes,
    });
  }, []);

  const handleBackFromDedicated = useCallback(() => {
    setSelectedCadernoId(null);
    setCadernoFiltro("Todos");
  }, []);

  const handleOpenNovaPastaWithParent = useCallback((parentCadernoId: string) => {
    setModalDefaultParentId(parentCadernoId);
    setIsNovaPastaModalOpen(true);
  }, []);

  // ── Se estiver na visão dedicada de um Caderno Selecionado ──
  if (selectedCaderno) {
    return (
      <div className="flex w-full max-w-[1200px] mx-auto flex-col gap-3 sm:gap-4 bg-[#080d1a] rounded-xl sm:rounded-2xl border border-white/[0.06] p-2.5 sm:p-5 relative overflow-hidden">

          <QuestionClassificationContext.Provider value={classificationContextValue}>
          <CadernoDedicatedView
          caderno={selectedCaderno}
          onBack={handleBackFromDedicated}
          userAnswers={userAnswers}
          duvidas={duvidas}
          onOpenQuestion={handleOpenQuestionInModal}
          onTrainAll={(queue) => {
            if (!user) { onShowAuth(); return; }
            const targetQueue = queue && queue.length > 0 ? queue : selectedCaderno.questoes;
            if (targetQueue.length > 0) {
              handleOpenQuestionInModal(targetQueue[0], targetQueue);
            }
          }}
          onDropQuestion={handleDropQuestion}
          onOpenNovaPastaModal={handleOpenNovaPastaWithParent}
          isAdmin={isAdminState}
          onEditQuestao={handleEditQuestao}
          onMoveQuestao={handleOpenMoveModal}
          onDeleteQuestao={handleDeleteQuestao}
          onChangeDifficulty={handleChangeDifficulty}
          getQuestionWithCurrentDifficulty={getQuestionWithCurrentDifficulty}
          onRenameCaso={handleOpenRenameCaso}
          onDeleteCaso={handleDeleteCaso}
          onPrintCaderno={handlePrintCaderno}
          onPrintCaso={handlePrintCaso}
          onDeleteCaderno={handleDeleteCaderno}
          onOpenMoverCaso={handleOpenMoverCasoFromDedicated}
          plataformaFiltro={plataformaFiltro}
          onChangePlataformaFiltro={setPlataformaFiltro}
        />
          </QuestionClassificationContext.Provider>

        {/* Modal de Criar Pasta */}
        <ModalCriarPasta
          isOpen={isNovaPastaModalOpen}
          onClose={() => setIsNovaPastaModalOpen(false)}
          parentNodes={parentOptions}
          defaultParentId={modalDefaultParentId}
          onSuccess={() => {
            carregarNos();
            if (onRefreshQuestions) onRefreshQuestions();
          }}
        />

        {/* Modal QuestionResolver */}
        {modalQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-1.5 sm:p-4 md:p-6 overflow-y-auto">
            <div className="relative w-full max-w-7xl min-h-[min(78vh,760px)] max-h-[98vh] sm:max-h-[96vh] bg-[#0c101c] border border-white/10 rounded-xl sm:rounded-2xl shadow-lg overflow-y-auto custom-scrollbar p-2.5 sm:p-6 md:p-8 flex flex-col my-auto">
              <QuestionResolver
                question={modalQueue[modalIndex] || modalQuestion}
                questionIndex={modalIndex}
                totalQuestions={modalQueue.length}
                resolverQueue={modalQueue}
                userAnswers={userAnswers}
                onSelectQuestion={(idx) => {
                  setModalIndex(idx);
                  setModalQuestion(modalQueue[idx]);
                }}
                stats={userAnswers[String((modalQueue[modalIndex] || modalQuestion).id)]}
                isDuvida={duvidas.has(String((modalQueue[modalIndex] || modalQuestion).id))}
                onToggleDuvida={onToggleDuvida}
                onAnswer={handleModalAnswer}
                onNext={handleModalNext}
                onPrev={handleModalPrev}
                onBackToBank={() => setModalQuestion(null)}
                isSaving={isSavingAnswer}
                isAdmin={isAdminState}
                onEditQuestion={handleEditQuestao}
              />
            </div>
          </div>
        )}

        {/* ── MODAIS DE ADMINISTRAÇÃO AVANÇADA NO CADERNO SELECIONADO ── */}
        {isAdminState && (
          <>
            <ModalEditarQuestao
              isOpen={!!editingQuestao}
              onClose={() => setEditingQuestao(null)}
              questao={editingQuestao}
              orgNodes={dbNodes}
              onSuccess={handleEditSuccess}
            />

            <ModalMoverQuestao
              isOpen={movingQuestaoIds.length > 0}
              onClose={() => {
                setMovingQuestaoIds([]);
                setMovingQuestaoLabel("");
              }}
              questaoIds={movingQuestaoIds}
              questaoLabel={movingQuestaoLabel}
              orgNodes={dbNodes}
              onSuccess={handleMoveSuccess}
            />

            <ModalRenomearPasta
              isOpen={!!renamingNode}
              onClose={() => setRenamingNode(null)}
              nodeId={renamingNode?.id || ""}
              currentNome={renamingNode?.nome || ""}
              onSuccess={handleRenameSuccess}
            />

            <ModalMoverSubcaso
              isOpen={!!subcasoToMove}
              onClose={() => setSubcasoToMove(null)}
              subcaso={subcasoToMove}
              materias={unfilteredMaterias}
              onConfirmMove={handleConfirmMoveSubcaso}
            />

            <ModalExcluirCaderno
              isOpen={!!deleteTarget}
              onClose={() => setDeleteTarget(null)}
              target={deleteTarget}
              onConfirmDelete={handleConfirmDeleteTarget}
            />
          </>
        )}

        {/* Modal de Impressão de Cadernos e Casos */}
        <PrintSimuladoModal
          isOpen={printModalData.isOpen}
          onClose={() => setPrintModalData(prev => ({ ...prev, isOpen: false }))}
          questions={printModalData.questions}
          title={printModalData.title}
          subTitle={printModalData.subTitle}
        />

        {/* Modal Confirmação Excluir Questão Individual */}
        {questionToDelete && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-[#0c1220] border border-rose-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-normal text-white">
                    Excluir Questão #{questionToDelete.id}?
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                    {questionToDelete.title || questionToDelete.perguntaProblema || "Esta ação não pode ser desfeita."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  disabled={deletingSingleQuestion}
                  onClick={() => setQuestionToDelete(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-white/[0.1] text-xs font-normal text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingSingleQuestion}
                  onClick={() => void confirmDeleteSingleQuestion()}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-normal text-white flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>{deletingSingleQuestion ? "Excluindo..." : "Excluir"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMsg && (
          <div
            className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[120] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium ${
              toastMsg.type === "success"
                ? "bg-[#0d1627] border-emerald-500/40 text-emerald-300"
                : "bg-[#251016] border-rose-500/40 text-rose-300"
            }`}
          >
            {toastMsg.type === "success" ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <QuestionClassificationContext.Provider value={classificationContextValue}>
    <div className="flex w-full min-w-0 max-w-[1200px] mx-auto flex-col gap-3 sm:gap-4 bg-[#0a0e18] rounded-xl sm:rounded-2xl border border-white/[0.07] p-2.5 sm:p-4 relative overflow-x-clip">

      {/* ── Toolbar Superior: Caderno de Erros ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-white/[0.07] relative z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <BookMarked size={14} className="text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight leading-tight">
                Caderno de Erros
              </h2>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                Organização por nós, ordem, banca e plataforma (QC · Gran · TEC)
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-1.5 pl-0 sm:pl-2 sm:border-l sm:border-white/10 w-full sm:w-auto overflow-x-auto custom-scrollbar flex-nowrap py-1">
              {/* Total de questões */}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-300 flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] px-2 sm:px-2.5 py-1 rounded-lg shrink-0 tabular-nums" title="Total de questões cadastradas">
                <BookMarked size={11} className="text-indigo-400/80" />
                <span className="text-indigo-300 font-bold">{questions.length} quest.</span>
              </span>

              {/* Acertos */}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-300 flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] px-2 sm:px-2.5 py-1 rounded-lg shrink-0 tabular-nums" title="Total de acertos">
                <Check size={11} className="text-emerald-400/80 stroke-[2]" />
                <span className="text-emerald-400/90 font-medium">{acertadasCount} acertos</span>
              </span>

              {/* Erros */}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-300 flex items-center gap-1 bg-rose-500/10 border border-rose-500/25 px-2 sm:px-2.5 py-1 rounded-lg shrink-0 tabular-nums" title="Total de erros">
                <X size={11} className="text-rose-400 stroke-[2]" />
                <span className="text-rose-300 font-semibold">{erradasCount} erros</span>
              </span>

              {/* Dúvidas */}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-300 flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] px-2 sm:px-2.5 py-1 rounded-lg shrink-0 tabular-nums" title="Em dúvida">
                <Flag size={11} className="text-amber-400/80 fill-amber-400/10" />
                <span className="text-amber-400/90 font-medium">{duvidasCount} dúvidas</span>
              </span>

              {/* Aproveitamento */}
              {respondidasTotal > 0 && (
                <span
                  className={`text-[10px] sm:text-[11px] font-medium px-2 sm:px-2.5 py-1 rounded-lg border bg-white/[0.03] border-white/[0.07] shrink-0 tabular-nums ${
                    taxaAcertoGlobal >= 70
                      ? "text-emerald-400/90"
                      : taxaAcertoGlobal >= 50
                      ? "text-amber-400/90"
                      : "text-rose-400/90"
                  }`}
                  title="Taxa de aproveitamento"
                >
                  {taxaAcertoGlobal}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ações: Revisar Todos os Erros + Modos de Visualização + Nova Pasta */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full lg:w-auto lg:ml-auto flex-wrap">
          {allErrorQueue.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenQuestionInModal(allErrorQueue[0], allErrorQueue)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 rounded-xl text-[11px] font-bold transition-colors"
              title="Abrir todas as questões erradas em sequência"
            >
              <AlertTriangle size={12} className="text-rose-400" />
              <span>Revisar Erros ({allErrorQueue.length})</span>
            </button>
          )}

          {viewMode === "blocos" && (
            <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setMateriasAbertas(new Set())}
                title="Recolher todos os cadernos das matérias"
                className="px-2 py-1.5 sm:py-1 text-[10px] text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronRight size={11} />
                <span>Recolher</span>
              </button>
              <button
                type="button"
                onClick={() => setMateriasAbertas(new Set(materiasAgrupadas.map(m => m.id)))}
                title="Expandir todos os cadernos das matérias"
                className="px-2 py-1.5 sm:py-1 text-[10px] text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronDown size={11} />
                <span>Expandir</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar flex-nowrap max-w-full">
            <button
              onClick={() => setViewMode("blocos")}
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                viewMode === "blocos"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={12} />
              <span>Notion</span>
            </button>
            <button
              onClick={() => setViewMode("arvore")}
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                viewMode === "arvore"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FolderTree size={12} />
              <span>Árvore</span>
            </button>
            <button
              onClick={() => setViewMode("mapa")}
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                viewMode === "mapa"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              aria-pressed={viewMode === "mapa"}
              title="Visualizar cadernos e casos em trilhas de desempenho"
            >
              <ListTree size={12} />
              <span>Mapa</span>
            </button>
            <button
              onClick={() => setViewMode("caderno_plus")}
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                viewMode === "caderno_plus" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              aria-pressed={viewMode === "caderno_plus"}
              title="Painel completo de cadernos, casos e questões"
            >
              <Layers size={12} />
              <span>Caderno+</span>
            </button>
          </div>

          {isAdminState && (
            <button
              type="button"
              onClick={() => setIsImportJsonOpen(true)}
              className="flex items-center gap-1.5 px-3 min-h-[36px] sm:min-h-0 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/35 text-blue-200 rounded-xl text-xs font-bold transition-colors"
              title="Importar questões em lote via JSON"
            >
              <FileJson size={13} className="text-blue-400" />
              <span className="hidden sm:inline">Importar JSON</span>
              <span className="sm:hidden">JSON</span>
            </button>
          )}

          <button
            onClick={() => {
              setModalDefaultParentId("");
              setIsNovaPastaModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 min-h-[36px] sm:min-h-0 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors ml-auto sm:ml-0"
          >
            <FolderPlus size={13} />
            <span className="hidden sm:inline">Nova Pasta / Caderno</span>
            <span className="sm:hidden">Nova Pasta</span>
          </button>
        </div>
      </div>

      {/* ── Barra Superior de Controles e Filtros ── */}
      <div className="flex flex-col gap-2.5 sm:gap-3 bg-[#0d1220] p-2.5 sm:p-3 rounded-xl border border-white/[0.07] relative z-10">
        {/* Linha 1: Controles de Busca, Caderno e Filtro de Status */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1">
            {/* Campo de Busca (inclui IDs, Banca, Prova e Cadernos) */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar caderno, ID (QC/Gran/TEC) ou banca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#070b14] border border-white/[0.08] hover:border-white/[0.16] rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors font-normal"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Select Dropdown de Cadernos */}
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-white/[0.08] hover:border-white/[0.16] px-2.5 py-1.5 rounded-xl transition-colors w-full sm:w-auto">
              <BookMarked size={13} className="text-indigo-400 shrink-0" />
              <select
                value={cadernoFiltro}
                onChange={e => {
                  const val = e.target.value;
                  setCadernoFiltro(val);
                  if (val !== "Todos") {
                    const found = unfilteredCadernos.find(c => c.nome === val);
                    if (found) setSelectedCadernoId(found.id);
                  }
                }}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer border-none w-full sm:max-w-[200px] truncate"
                style={{ backgroundColor: "#070b14", color: "#e2e8f0" }}
              >
                <option value="Todos" className="bg-[#0d1222] text-slate-200">
                  Todos os Cadernos ({unfilteredCadernos.length})
                </option>
                {unfilteredCadernos.map(c => (
                  <option key={c.id} value={c.nome} className="bg-[#0d1222] text-slate-200">
                    {c.nome} ({c.materia})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Segmented Control de Status com scroll horizontal touch no mobile */}
          <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar flex-nowrap shrink-0">
            <button
              onClick={() => setStatusFiltro("todas")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "todas" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFiltro("erros")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "erros" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-slate-400 hover:text-rose-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>Erros</span>
            </button>
            <button
              onClick={() => setStatusFiltro("mais_erros")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "mais_erros" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-amber-300"
              }`}
            >
              <Flame size={12} className="text-amber-400 shrink-0" />
              <span>Mais Erros</span>
            </button>
            <button
              onClick={() => setStatusFiltro("nao_feitas")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "nao_feitas" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-slate-400 hover:text-purple-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full border border-purple-400 shrink-0" />
              <span>Não Feitas</span>
            </button>
            <button
              onClick={() => setStatusFiltro("duvidas")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFiltro === "duvidas" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-amber-300"
              }`}
            >
              <Flag size={11} className="text-amber-400 fill-amber-400/20 shrink-0" />
              <span>Dúvidas</span>
            </button>
          </div>
        </div>

        {/* Linha 2: Plataforma (Todas / Qconcursos / Gran / TEC) + Matéria + Banca */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-white/[0.06]">
          {/* Filtro de Plataforma por ID */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider shrink-0">
              Plataforma:
            </span>
            <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar flex-nowrap max-w-full">
              {[
                { id: "todas" as PlataformaFiltro, label: `Todas (${platformCounts.todas})`, activeCls: "bg-indigo-600 text-white" },
                { id: "qconcursos" as PlataformaFiltro, label: `Qconcursos (${platformCounts.qc})`, activeCls: "bg-amber-600 text-white" },
                { id: "gran" as PlataformaFiltro, label: `Gran (${platformCounts.gran})`, activeCls: "bg-cyan-600 text-white" },
                { id: "tec" as PlataformaFiltro, label: `TEC (${platformCounts.tec})`, activeCls: "bg-violet-600 text-white" },
              ].map((plat) => (
                <button
                  key={plat.id}
                  type="button"
                  onClick={() => setPlataformaFiltro(plat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    plataformaFiltro === plat.id ? plat.activeCls : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selects de Matéria e Banca */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <label htmlFor="cadernos-materia-filtro" className="text-[10px] font-medium text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Filter size={10} /> Matéria:
              </label>
              <select
                id="cadernos-materia-filtro"
                value={materiaFiltro}
                onChange={e => setMateriaFiltro(e.target.value)}
                className="w-full sm:w-auto max-w-full bg-[#070b14] border border-white/[0.08] hover:border-white/[0.16] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                style={{ backgroundColor: "#070b14", color: "#cbd5e1" }}
              >
                {["Todas", ...materiasDisponiveis].map(m => (
                  <option key={m} value={m} className="bg-[#0d1222] text-slate-200">
                    {m === "Todas" ? "Todas as matérias" : m}
                  </option>
                ))}
              </select>
            </div>

            {bancasDisponiveis.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <label htmlFor="cadernos-banca-filtro" className="text-[10px] font-medium text-slate-500 uppercase tracking-wider shrink-0">
                  Banca:
                </label>
                <select
                  id="cadernos-banca-filtro"
                  value={bancaFiltro}
                  onChange={e => setBancaFiltro(e.target.value)}
                  className="w-full sm:w-auto max-w-full bg-[#070b14] border border-white/[0.08] hover:border-white/[0.16] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  style={{ backgroundColor: "#070b14", color: "#cbd5e1" }}
                >
                  {["Todas", ...bancasDisponiveis].map(b => (
                    <option key={b} value={b} className="bg-[#0d1222] text-slate-200">
                      {b === "Todas" ? "Todas as bancas" : b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODO 1: ÁRVORE HIERÁRQUICA COMPLETA (EXATAMENTE O PRINT DO USUÁRIO) ── */}
      {viewMode === "caderno_plus" ? (
        <div className="relative z-10 rounded-xl border border-white/[0.07] bg-[#0b101a] p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Visão detalhada</p>
              <h3 className="mt-1 text-sm font-medium text-slate-200">Cadernos, casos e questões</h3>
              <p className="mt-1 text-[10px] text-slate-500">Abra uma matéria e depois um caderno para acompanhar o desempenho de cada caso.</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0d1420] p-0.5">
              <button type="button" onClick={() => {
                setPainelMateriasAbertas(new Set(materiasFiltradas.map(m => m.id)));
                setPainelCadernosAbertos(new Set(materiasFiltradas.flatMap(m => m.cadernos.map(c => c.id))));
              }} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200">Expandir tudo</button>
              <button type="button" onClick={() => {
                setPainelMateriasAbertas(new Set());
                setPainelCadernosAbertos(new Set());
              }} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200">Recolher tudo</button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">{materiasFiltradas.length} matérias</span>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">{materiasFiltradas.reduce((n, m) => n + m.cadernos.length, 0)} cadernos</span>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">{materiasFiltradas.reduce((n, m) => n + m.totalQuestoes, 0)} questões</span>
          </div>

          <div className="space-y-2">
            {materiasFiltradas.map((mat) => {
              const isMateriaAberta = painelMateriasAbertas.has(mat.id);
              const materiaStat = materiasStats.get(mat.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
              const materiaRespondidas = materiaStat.acertos + materiaStat.erros;
              const materiaAbertas = Math.max(0, mat.totalQuestoes - materiaRespondidas);
              return (
                <section key={mat.id} className="overflow-hidden rounded-lg border border-white/[0.07] bg-[#0e1420]">
                  <div className="flex w-full items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
                    <button type="button" aria-expanded={isMateriaAberta} onClick={() => setPainelMateriasAbertas(prev => {
                      const next = new Set(prev);
                      if (next.has(mat.id)) next.delete(mat.id); else next.add(mat.id);
                      return next;
                    })} className="flex flex-1 flex-wrap items-center justify-between gap-2 text-left min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronRight size={13} className={`shrink-0 text-slate-500 ${isMateriaAberta ? "rotate-90" : ""}`} />
                        <span className="text-sm">{mat.icone}</span>
                        <span className="truncate text-xs font-normal text-slate-200">{mat.nome}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{mat.totalQuestoes} q.</span>
                      </span>
                      <span className="flex items-center gap-2 text-[10px] tabular-nums">
                        <span className="text-rose-400">× {materiaStat.erros}</span>
                        <span className="text-emerald-400">✓ {materiaStat.acertos}</span>
                        <span className="hidden text-amber-400 sm:inline">⚑ {materiaStat.duvidas}</span>
                        <span className="text-slate-500">{materiaAbertas} abertas</span>
                        <span className="min-w-9 rounded border border-white/[0.08] px-1.5 py-0.5 text-center text-slate-300">{materiaStat.pct === null ? "—" : `${materiaStat.pct}%`}</span>
                      </span>
                    </button>
                    {isAdminState && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDisciplina(mat)}
                        title={`Excluir disciplina "${mat.nome}"`}
                        className="p-1.5 rounded border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  {isMateriaAberta && <div className="space-y-1.5 border-t border-white/[0.05] px-2 py-2 sm:px-3">
                    {mat.cadernos.map((caderno) => {
                      const isCadernoAberto = painelCadernosAbertos.has(caderno.id);
                      const cases = caderno.casos.length ? caderno.casos : [{ id: caderno.id, nome: caderno.nome, questoes: caderno.questoes }];
                      const cStat = cadernosStats.get(caderno.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
                      return (
                        <article key={caderno.id} className="overflow-hidden rounded-md border border-white/[0.06] bg-[#101723]">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                            <button type="button" aria-expanded={isCadernoAberto} onClick={() => setPainelCadernosAbertos(prev => {
                              const next = new Set(prev);
                              if (next.has(caderno.id)) next.delete(caderno.id); else next.add(caderno.id);
                              return next;
                            })} className="flex min-w-0 items-center gap-1.5 text-left">
                              <ChevronRight size={11} className={`shrink-0 text-slate-500 ${isCadernoAberto ? "rotate-90" : ""}`} />
                              <Folder size={12} className="shrink-0 text-indigo-300/80" />
                              <span className="truncate text-[11px] font-normal text-slate-200">{caderno.nome}</span>
                              <span className="shrink-0 text-[9px] text-slate-500">{caderno.questoes.length} q. · {cases.length} casos</span>
                            </button>
                            <div className="flex shrink-0 items-center gap-2 text-[9px] tabular-nums">
                              <span className="text-rose-400">× {cStat.erros}</span><span className="text-emerald-400">✓ {cStat.acertos}</span>
                              <span className="text-amber-400">⚑ {cStat.duvidas}</span>
                              <span className="text-slate-500">{Math.max(0, caderno.questoes.length - cStat.acertos - cStat.erros)} abertas</span>
                              <span className="min-w-8 rounded border border-white/[0.07] px-1 py-0.5 text-center text-slate-300">{cStat.pct === null ? "—" : `${cStat.pct}%`}</span>
                              {isAdminState && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCaderno(caderno)}
                                  title={`Excluir caderno "${caderno.nome}"`}
                                  className="p-1 rounded border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors"
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                          </div>

                          {isCadernoAberto && <div className="space-y-2 border-t border-white/[0.05] p-2.5">
                            {cases.map((caso) => {
                              const correct = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === true).length;
                              const wrong = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === false).length;
                              const doubts = caso.questoes.filter(q => duvidas.has(String(q.id))).length;
                              const open = Math.max(0, caso.questoes.length - correct - wrong);
                              const pct = correct + wrong > 0 ? Math.round(correct / (correct + wrong) * 100) : null;
                              return (
                                <section key={caso.id} className="rounded-md border border-white/[0.05] bg-[#0c121c] p-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <ChevronRight size={10} className="shrink-0 text-slate-600" />
                                      <span className="truncate text-[10px] font-normal text-slate-300" title={caso.nome}>{caso.nome}</span>
                                      <span className="shrink-0 text-[9px] text-slate-500">{caso.questoes.length} q.</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[9px] tabular-nums">
                                      <span className="text-rose-400">× {wrong} erros</span>
                                      <span className="text-emerald-400">✓ {correct} acertos</span>
                                      <span className="text-amber-400">⚑ {doubts} dúvidas</span>
                                      <span className="text-slate-500">{open} abertas</span>
                                      <span className="min-w-8 rounded border border-white/[0.07] px-1 py-0.5 text-center text-slate-300">{pct === null ? "—" : `${pct}%`}</span>
                                      {isAdminState && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSubcasoToMove({
                                              id: caso.id,
                                              nome: caso.nome,
                                              cadernoId: caderno.id,
                                              cadernoNome: caderno.nome,
                                              questoes: caso.questoes,
                                            })
                                          }
                                          title={`Mover subcaso "${caso.nome}" para outro caderno`}
                                          className="inline-flex items-center gap-1 rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                        >
                                          <FolderInput size={10} />
                                          <span>Mover</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {(expandedCasosView.has(`cp:${caso.id}`) ? caso.questoes : caso.questoes.slice(0, 60)).map((q, index) => {
                                      const answer = userAnswers[String(q.id)];
                                      const doubt = duvidas.has(String(q.id));
                                      const qStatus = answer ? (answer.isCorrect ? "Acertou" : "Errou") : doubt ? "Dúvida · não respondida" : "Não respondida";
                                      const { idq, idg, idtec } = getQuestionIds(q);
                                      const ord = (q as any).Ordem ?? (q as any).ordem;
                                      const qId = idq || idg || idtec || `#${q.id}`;
                                      const category = CATEGORIES.find(c => c.key === resolveCategory(q));
                                      return (
                                        <button key={q.id} type="button" onClick={() => handleOpenQuestionInModal(q, caso.questoes)} title={`Ordem #${ord || index + 1} · ${qId} · ${qStatus} · ${category?.label || "Média"}`} className={`inline-flex items-center gap-1 rounded border px-2.5 py-1.5 sm:px-1.5 sm:py-1 text-[10.5px] sm:text-[9px] transition-colors hover:border-indigo-400/40 ${answer ? (answer.isCorrect ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300" : "border-rose-500/20 bg-rose-500/[0.06] text-rose-300") : doubt ? "border-amber-500/20 bg-amber-500/[0.05] text-amber-300" : "border-white/[0.07] bg-white/[0.02] text-slate-400"}`}>
                                          <span className="text-slate-500">#{ord ?? index + 1}</span><span>{qId}</span>
                                          <span className="hidden border-l border-current/20 pl-1 text-[8px] opacity-70 sm:inline">{category?.label || "Média"}</span>
                                        </button>
                                      );
                                    })}
                                    {caso.questoes.length > 60 && !expandedCasosView.has(`cp:${caso.id}`) && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedCasosView(prev => new Set(prev).add(`cp:${caso.id}`))}
                                        className="inline-flex items-center rounded border border-indigo-500/25 bg-indigo-500/10 px-2 py-1 text-[10px] font-normal text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                      >
                                        +{caso.questoes.length - 60} questões
                                      </button>
                                    )}
                                    {caso.questoes.length === 0 && <span className="text-[9px] text-slate-600">Este caso ainda não tem questões.</span>}
                                  </div>
                                </section>
                              );
                            })}
                          </div>}
                        </article>
                      );
                    })}
                    {mat.cadernos.length === 0 && <p className="px-2 py-3 text-[10px] text-slate-500">Nenhum caderno nesta matéria.</p>}
                  </div>}
                </section>
              );
            })}
          </div>
        </div>
      ) : viewMode === "mapa" ? (
        <div className="relative z-10 rounded-xl border border-white/[0.07] bg-[#0b101a] p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.07] pb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cadernos · casos</p>
              <h3 className="mt-1 text-sm font-medium text-slate-200">Mapa de desempenho</h3>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <div className="flex items-center gap-x-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1"><X size={10} className="text-rose-400" /> Erros</span>
              <span className="inline-flex items-center gap-1"><Check size={10} className="text-emerald-400" /> Acertos</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-slate-600" /> Não respondidas</span>
              <span className="inline-flex items-center gap-1"><Flag size={9} className="text-amber-400" /> Dúvidas</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0d1420] p-0.5">
                <button type="button" onClick={() => setMapaCadernosAbertos(new Set(materiasFiltradas.flatMap(mat => mat.cadernos.map(caderno => caderno.id))))} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200">Expandir</button>
                <button type="button" onClick={() => setMapaCadernosAbertos(new Set())} className="rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200">Recolher</button>
              </div>
            </div>
          </div>

          {materiasFiltradas.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">Nenhum caderno encontrado.</p>
          ) : (
            <div className="space-y-5">
              {materiasFiltradas.map((mat) => (
                <section key={mat.id} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs opacity-80">{mat.icone}</span>
                      <h4 className="text-xs font-normal text-slate-200 truncate">{mat.nome}</h4>
                      <span className="text-[10px] text-slate-500 shrink-0">{mat.totalQuestoes} questões</span>
                    </div>
                    {isAdminState && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDisciplina(mat)}
                        title={`Excluir disciplina "${mat.nome}"`}
                        className="p-1 rounded border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  <div className="relative ml-1 space-y-2 border-l border-slate-700/70 pl-4 sm:ml-3 sm:pl-6">
                    {mat.cadernos.map((caderno) => {
                      const stat = cadernosStats.get(caderno.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
                      const totalRespondidas = stat.acertos + stat.erros;
                      const naoRespondidas = Math.max(0, caderno.questoes.length - totalRespondidas);
                      const casos = caderno.casos.length ? caderno.casos : [{ id: caderno.id, nome: caderno.nome, questoes: caderno.questoes }];
                      const isMapaCadernoAberto = mapaCadernosAbertos.has(caderno.id);
                      return (
                        <article key={caderno.id} className="relative rounded-lg border border-white/[0.07] bg-[#101622] px-3 py-2.5 sm:px-4">
                          <span className="absolute -left-[21px] top-4 h-px w-4 bg-slate-700 sm:-left-[25px] sm:w-6" />
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <button type="button" onClick={() => setMapaCadernosAbertos(prev => {
                              const next = new Set(prev);
                              if (next.has(caderno.id)) next.delete(caderno.id);
                              else next.add(caderno.id);
                              return next;
                            })} aria-expanded={isMapaCadernoAberto} className="flex min-w-0 items-center gap-2 text-left">
                              <ChevronRight size={12} className={`shrink-0 text-slate-500 ${isMapaCadernoAberto ? "rotate-90" : ""}`} />
                              <Folder size={13} className="shrink-0 text-indigo-300/80" />
                              <span className="truncate text-xs font-normal text-slate-200">{caderno.nome}</span>
                              <span className="shrink-0 text-[10px] text-slate-500">{caderno.questoes.length} q.</span>
                            </button>
                            <div className="flex shrink-0 items-center gap-2 text-[10px] tabular-nums">
                              <span className="inline-flex items-center gap-1 text-rose-400/90"><X size={10} />{stat.erros}</span>
                              <span className="inline-flex items-center gap-1 text-emerald-400/90"><Check size={10} />{stat.acertos}</span>
                              <span className="text-slate-500">{naoRespondidas} abertas</span>
                              {stat.duvidas > 0 && <span className="inline-flex items-center gap-1 text-amber-400"><Flag size={9} />{stat.duvidas}</span>}
                              <span className="min-w-9 rounded border border-white/[0.08] px-1.5 py-0.5 text-center text-slate-300">{stat.pct === null ? "—" : `${stat.pct}%`}</span>
                              {isAdminState && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCaderno(caderno)}
                                  title={`Excluir caderno "${caderno.nome}"`}
                                  className="p-1 rounded border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {isMapaCadernoAberto && <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-3 border-t border-white/[0.05] pt-2.5">
                            {casos.map((caso) => {
                              const caseCorrect = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === true).length;
                              const caseWrong = caso.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === false).length;
                              const caseDoubt = caso.questoes.filter(q => duvidas.has(String(q.id))).length;
                              const caseOpen = Math.max(0, caso.questoes.length - caseCorrect - caseWrong);
                              return (
                                <div key={caso.id} className="min-w-0 max-w-full">
                                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                                      <ChevronRight size={10} className="shrink-0 text-slate-600" />
                                      <span className="max-w-full sm:max-w-[280px] truncate" title={caso.nome}>{caso.nome}</span>
                                      <span className="shrink-0 text-slate-600">{caso.questoes.length} q.</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 sm:gap-[3px] pl-2 sm:pl-4" aria-label={`${caso.nome}: ${caseCorrect} acertos, ${caseWrong} erros, ${caseOpen} não respondidas${caseDoubt ? `, ${caseDoubt} dúvidas` : ""}`}>
                                      {(expandedCasosView.has(`mp:${caso.id}`) ? caso.questoes : caso.questoes.slice(0, 100)).map((q, idx) => {
                                        const answer = userAnswers[String(q.id)];
                                        const markedDoubt = duvidas.has(String(q.id));
                                        const statusClass = answer
                                          ? answer.isCorrect
                                            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                                            : "border-rose-500/60 bg-rose-500/20 text-rose-300"
                                          : markedDoubt
                                            ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                                            : "border-slate-600/70 bg-[#0b1019] text-slate-600";
                                        return (
                                          <button
                                            key={q.id}
                                            type="button"
                                            onClick={() => handleOpenQuestionInModal(q, caso.questoes)}
                                            title={`Questão ${idx + 1}${answer ? (answer.isCorrect ? " · Acerto" : " · Erro") : markedDoubt ? " · Dúvida" : " · Não respondida"}`}
                                            className={`flex h-7 w-7 sm:h-[15px] sm:w-[15px] items-center justify-center rounded-[4px] sm:rounded-[3px] border transition-colors hover:brightness-125 ${statusClass}`}
                                          >
                                            {answer ? (answer.isCorrect ? <Check size={11} className="sm:w-[9px] sm:h-[9px]" /> : <X size={11} className="sm:w-[9px] sm:h-[9px]" />) : markedDoubt ? <Flag size={9} className="sm:w-[7px] sm:h-[7px]" /> : null}
                                          </button>
                                        );
                                      })}
                                      {caso.questoes.length > 100 && !expandedCasosView.has(`mp:${caso.id}`) && (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedCasosView(prev => new Set(prev).add(`mp:${caso.id}`))}
                                          className="px-1.5 h-7 sm:h-[15px] rounded-[3px] border border-indigo-500/30 bg-indigo-500/10 text-[9px] text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                        >
                                          +{caso.questoes.length - 100}
                                        </button>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "arvore" ? (
        <div className="flex flex-col gap-2 p-3 sm:p-4 bg-[#0d1220] rounded-xl border border-white/[0.07] relative z-10 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/[0.06] pb-2 mb-2">
            <span className="text-xs sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>📁</span> Estrutura Hierárquica de Pastas
            </span>
            <span className="text-[11px] sm:text-[10px] text-slate-400 sm:text-slate-500 italic">
              Arraste e solte questões em qualquer pasta para alterar a vinculação
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {treeRoots.map(rootNode => (
              <TreeNodeItem
                key={rootNode.id}
                node={rootNode}
                depth={0}
                userAnswers={userAnswers}
                duvidas={duvidas}
                onOpenQuestion={handleOpenQuestionInModal}
                onDropQuestion={handleDropQuestion}
                onDropNodeToParent={handleDropNodeToParent}
                onAddSubfolder={handleOpenNovaPastaWithParent}
                onMoveNode={(targetNode) => {
                  const visited = new Set<string>([targetNode.id]);
                  const collectQuestions = (n: HierarchyTreeNode): BancoQuestion[] => {
                    const list = [...n.questoes];
                    for (const child of n.filhos) {
                      if (visited.has(child.id)) continue;
                      visited.add(child.id);
                      list.push(...collectQuestions(child));
                    }
                    return list;
                  };
                  const parentName =
                    dbNodes.find(n => String(n.id) === String(targetNode.parent_id))?.nome ||
                    "Pasta Pai";
                  setSubcasoToMove({
                    id: targetNode.id,
                    nome: targetNode.nome,
                    cadernoId: targetNode.parent_id || "",
                    cadernoNome: parentName,
                    questoes: collectQuestions(targetNode),
                  });
                }}
                onRenameNode={handleOpenRenameCaso}
                onDeleteNode={(targetNode) => {
                  const visited = new Set<string>([targetNode.id]);
                  const collectQuestions = (n: HierarchyTreeNode): BancoQuestion[] => {
                    const list = [...n.questoes];
                    for (const child of n.filhos) {
                      if (visited.has(child.id)) continue;
                      visited.add(child.id);
                      list.push(...collectQuestions(child));
                    }
                    return list;
                  };
                  setDeleteTarget({
                    kind: targetNode.parent_id ? "subcaso" : "disciplina",
                    id: targetNode.id,
                    nome: targetNode.nome,
                    cadernosCount: !targetNode.parent_id ? targetNode.filhos.length : undefined,
                    subcasosCount: targetNode.parent_id ? targetNode.filhos.length : undefined,
                    questoes: collectQuestions(targetNode),
                  });
                }}
                onPrintNode={handlePrintNode}
                isAdmin={isAdminState}
                onChangeDifficulty={handleChangeDifficulty}
                getQuestionWithCurrentDifficulty={getQuestionWithCurrentDifficulty}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ── MODO 2: LISTA DE MATÉRIAS E CADERNOS NOTION ── */
        materiasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
            <BookOpen size={32} className="text-slate-700" />
            <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">
              Nenhum caderno encontrado
            </p>
            <button
              onClick={() => {
                setSearch("");
                setMateriaFiltro("Todas");
                setCadernoFiltro("Todos");
                setPlataformaFiltro("todas");
                setBancaFiltro("Todas");
                setStatusFiltro("todas");
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3 relative z-10">
            {materiasFiltradas.map((mat) => {
              // Estatísticas pré-computadas da matéria (instantâneo)
              const mStat = materiasStats.get(mat.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
              const mAcertos = mStat.acertos;
              const mErros = mStat.erros;
              const mDuvidas = mStat.duvidas;
              const mPct = mStat.pct;
              const mTotal = mat.totalQuestoes;
              const isRecolhido = !materiasAbertas.has(mat.id);

              const mAproveitamentoClasses =
                mPct === null
                  ? "border-white/[0.04] text-slate-500 bg-white/[0.015]"
                  : mPct >= 70
                  ? "border-emerald-500/20 text-emerald-400/90 bg-emerald-500/5 font-light"
                  : mPct >= 50
                  ? "border-amber-500/20 text-amber-400/90 bg-amber-500/5 font-light"
                  : "border-rose-500/20 text-rose-400/90 bg-rose-500/5 font-light";

              return (
                <div
                  key={mat.id}
                  className="flex flex-col bg-[#0d1220] border border-white/[0.07] rounded-xl p-2.5 sm:p-3 gap-1.5 transition-colors hover:border-white/[0.12]"
                >
                  {/* ── CABEÇALHO DA MATÉRIA (recolher/expandir + excluir disciplina para Admin) ── */}
                  <div
                    className={`w-full flex items-center justify-between gap-1.5 sm:gap-2 pb-2 sm:pb-1.5 px-1.5 rounded-lg hover:bg-white/[0.03] transition-colors ${
                      isRecolhido ? "" : "border-b border-white/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRecolherMateria(mat.id)}
                      className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 cursor-pointer select-none text-left min-w-0"
                      title={isRecolhido ? `Expandir ${mat.cadernos.length} cadernos` : "Recolher cadernos"}
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 w-full sm:w-auto">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown
                            size={13}
                            className={`shrink-0 ${
                              isRecolhido ? "-rotate-90 text-slate-500" : "rotate-0 text-indigo-400"
                            }`}
                          />
                          <span className="w-1 h-1 rounded-full bg-indigo-400/80 shrink-0" />
                          <span className="text-xs shrink-0 opacity-80">{mat.icone}</span>
                          <h3 className="text-xs font-normal text-slate-200 truncate">
                            {mat.nome}
                          </h3>
                        </div>

                        {/* No mobile, contagem de cadernos vai ao lado do título */}
                        <span className="sm:hidden text-[9px] font-light text-slate-400 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06] shrink-0">
                          {mat.cadernos.length} cad.
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 flex-nowrap whitespace-nowrap overflow-x-auto custom-scrollbar py-0.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-light shrink-0 select-none flex-nowrap whitespace-nowrap tabular-nums">
                          <span className="text-slate-500 font-light">{mTotal} <span className="hidden sm:inline">quest.</span><span className="sm:hidden">q.</span></span>
                          <span className="text-emerald-400/80 flex items-center gap-0.5">
                            <Check size={9} className="stroke-[1.5]" />
                            {mAcertos}
                          </span>
                          <span className="text-rose-400/80 flex items-center gap-0.5">
                            <X size={9} className="stroke-[1.5]" />
                            {mErros}
                          </span>
                          <span className="text-amber-400/80 flex items-center gap-0.5">
                            <Flag size={8} />
                            {mDuvidas}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded border text-[9px] font-light tabular-nums ${mAproveitamentoClasses}`}>
                            {mPct === null ? "—" : `${mPct}%`}
                          </span>
                        </div>

                        {/* No desktop, contagem de cadernos fica no final */}
                        <span className="hidden sm:inline-block text-[9.5px] font-light text-slate-500 font-mono bg-white/[0.02] px-1.5 py-0.2 rounded border border-white/[0.04] shrink-0">
                          {mat.cadernos.length} caderno{mat.cadernos.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>

                    {isAdminState && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDisciplina(mat)}
                        title={`Excluir disciplina "${mat.nome}" (Admin)`}
                        className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded border border-rose-500/25 bg-rose-500/10 text-rose-400 hover:text-rose-100 active:bg-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/25 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={12} className="sm:w-[10px] sm:h-[10px]" />
                      </button>
                    )}
                  </div>

                  {/* ── LISTA DE CADERNOS DENTRO DA MATÉRIA (Exibe quando não recolhido) ── */}
                  {!isRecolhido && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      {mat.cadernos.map((caderno, cadernoIndex) => {
                      // Estatísticas pré-computadas do caderno (instantâneo)
                      const cStat = cadernosStats.get(caderno.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
                      const cAcertos = cStat.acertos;
                      const cErros = cStat.erros;
                      const cDuvidas = cStat.duvidas;
                      const cPct = cStat.pct;
                      const cTotal = caderno.questoes.length;

                      const cAproveitamentoClasses =
                        cPct === null
                          ? "border-white/[0.04] text-slate-500 bg-white/[0.015]"
                          : cPct >= 70
                          ? "border-emerald-500/20 text-emerald-400/90 bg-emerald-500/5 font-light"
                          : cPct >= 50
                          ? "border-amber-500/20 text-amber-400/90 bg-amber-500/5 font-light"
                          : "border-rose-500/20 text-rose-400/90 bg-rose-500/5 font-light";

                      return (
                        <div
                          key={caderno.id}
                          draggable={isAdminState}
                          onDragStart={(event) => {
                            event.stopPropagation();
                            setDraggingCadernoId(caderno.id);
                            event.dataTransfer.setData("application/x-estudos-caderno", caderno.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingCadernoId(null);
                            setDragOverCadernoId(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            const isCadernoDrag = e.dataTransfer.types.includes("application/x-estudos-caderno");
                            e.dataTransfer.dropEffect = isCadernoDrag ? "move" : "copy";
                            if (isCadernoDrag && draggingCadernoId !== caderno.id) setDragOverCadernoId(caderno.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const movedCadernoId = e.dataTransfer.getData("application/x-estudos-caderno");
                            if (movedCadernoId && movedCadernoId !== caderno.id) {
                              void handleReorderCadernos(mat.id, movedCadernoId, caderno.id);
                              setDraggingCadernoId(null);
                              setDragOverCadernoId(null);
                              return;
                            }
                            const qId = e.dataTransfer.getData("questao_id") || e.dataTransfer.getData("text/plain");
                            if (qId) {
                              handleDropQuestion(qId, caderno.id);
                            }
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverCadernoId(null);
                          }}
                          className={`flex flex-col gap-2 sm:grid min-h-11 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-1.5 rounded-md border-b border-white/[0.05] transition-colors group cursor-pointer ${
                            draggingCadernoId === caderno.id ? "opacity-40" : ""
                          } ${dragOverCadernoId === caderno.id ? "ring-2 ring-indigo-400/70 bg-indigo-500/10" : ""} ${
                            cadernoIndex % 2 === 0
                              ? "bg-[#101623] hover:bg-[#182131]"
                              : "bg-[#0c111c] hover:bg-[#151d2a]"
                          }`}
                          onClick={() => setSelectedCadernoId(caderno.id)}
                        >
                          {/* Nome do caderno */}
                          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] text-slate-600 group-hover:text-slate-400 shrink-0">→</span>
                              <span className="text-[11px] shrink-0 opacity-75">📝</span>
                              <span className="text-[12.5px] sm:text-xs font-normal text-slate-300 group-hover:text-white truncate min-w-0">
                                {caderno.nome}
                              </span>
                            </div>
                            <span className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] leading-none text-slate-500">
                              {cTotal} <span className="hidden sm:inline">quest.</span><span className="sm:hidden">q.</span>
                            </span>
                          </div>

                          {/* Row 2 on mobile: Stats + Actions */}
                          <div className="flex items-center justify-between sm:contents gap-2 w-full">
                            {/* Status em colunas compactas no mobile e fixas no desktop */}
                            <div className="flex sm:grid sm:w-[120px] sm:grid-cols-[28px_28px_28px_36px] items-center gap-2 sm:gap-0 justify-items-center whitespace-nowrap tabular-nums shrink-0">
                              <span className="sm:w-7 text-center text-emerald-400/80 font-light inline-flex justify-center items-center gap-0.5 text-[10px]" title="Acertos">
                                <Check size={9} className="stroke-[1.5]" />{cAcertos}
                              </span>
                              <span className="sm:w-7 text-center text-rose-400/80 font-light inline-flex justify-center items-center gap-0.5 text-[10px]" title="Erros">
                                <X size={9} className="stroke-[1.5]" />{cErros}
                              </span>
                              <span className="sm:w-7 text-center text-amber-400/80 font-light inline-flex justify-center items-center gap-0.5 text-[10px]" title="Dúvidas">
                                {cDuvidas > 0 ? <><Flag size={8} />{cDuvidas}</> : <span className="invisible text-[0px] sm:text-[10px]">0</span>}
                              </span>
                              <span className={`sm:w-9 text-center px-1.5 sm:px-1 py-0.5 sm:py-0.2 rounded border text-[9px] font-light ${cAproveitamentoClasses}`}>
                                {cPct === null ? "—" : `${cPct}%`}
                              </span>
                            </div>

                            {/* Botão revisar erros + abrir + ações administrativas com touch targets confortáveis */}
                            <div className="flex items-center gap-1.5 sm:gap-1 shrink-0">
                              {cErros > 0 && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const errQs = caderno.questoes.filter(q => userAnswers[String(q.id)]?.isCorrect === false);
                                    if (errQs.length > 0) handleOpenQuestionInModal(errQs[0], errQs);
                                  }}
                                  title={`Revisar ${cErros} erro(s) deste caderno`}
                                  className="inline-flex items-center gap-1 px-2 sm:px-1.5 py-1 sm:py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] sm:text-[9.5px] font-semibold text-rose-300 transition-colors"
                                >
                                  <Play size={8} fill="currentColor" /> Erros
                                </button>
                              )}
                              {isAdminState && (
                                <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                                  <span className="flex h-8 w-8 sm:h-6 sm:w-6 cursor-grab items-center justify-center rounded border border-white/[0.08] bg-white/[0.03] text-slate-500 active:cursor-grabbing" title="Arraste para reorganizar este caderno">
                                    <GripVertical size={13} className="sm:w-3 sm:h-3" />
                                  </span>
                                </div>
                              )}
                              <span
                                title="Abrir visão dedicada deste caderno"
                                className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded border border-white/[0.05] bg-white/[0.02] text-slate-500 group-hover:text-slate-300 group-hover:border-white/[0.10] transition-colors"
                              >
                                <ChevronRight size={14} className="sm:w-[11px] sm:h-[11px]" />
                              </span>

                              {isAdminState && (
                                <div
                                  className="flex items-center gap-1 select-none shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRenameCaso(caderno.id, caderno.nome)}
                                    title="Renomear este caderno (Admin)"
                                    className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-amber-300 active:bg-amber-500/20 hover:border-amber-500/30 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                  >
                                    <Pencil size={12} className="sm:w-[10px] sm:h-[10px]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCaderno(caderno)}
                                    title={caderno.questoes.length > 0 ? `Excluir caderno e suas ${caderno.questoes.length} questões (Admin)` : "Excluir este caderno (Admin)"}
                                    className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded border border-rose-500/25 bg-rose-500/10 text-rose-400 hover:text-rose-100 active:bg-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={12} className="sm:w-[10px] sm:h-[10px]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── MODAL DE CRIAR NOVA PASTA / CADERNO ── */}
      <ModalCriarPasta
        isOpen={isNovaPastaModalOpen}
        onClose={() => setIsNovaPastaModalOpen(false)}
        parentNodes={parentOptions}
        defaultParentId={modalDefaultParentId}
        onSuccess={() => {
          carregarNos();
          if (onRefreshQuestions) onRefreshQuestions();
        }}
      />

      {/* ── MODAL DE RESOLUÇÃO FOCADA (IGUAL ABA QUESTÃO ATIVA) ── */}
      {modalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-1.5 sm:p-4 md:p-6 overflow-y-auto">
          <div className="relative w-full max-w-7xl max-h-[94dvh] sm:min-h-[min(78vh,760px)] sm:max-h-[96vh] bg-[#0c101c] border border-white/10 rounded-xl sm:rounded-2xl shadow-lg overflow-y-auto custom-scrollbar p-2 sm:p-6 md:p-8 flex flex-col my-auto">
            <QuestionResolver
              question={modalQueue[modalIndex] || modalQuestion}
              questionIndex={modalIndex}
              totalQuestions={modalQueue.length}
              resolverQueue={modalQueue}
              userAnswers={userAnswers}
              onSelectQuestion={(idx) => {
                setModalIndex(idx);
                setModalQuestion(modalQueue[idx]);
              }}
              stats={userAnswers[String((modalQueue[modalIndex] || modalQuestion).id)]}
              isDuvida={duvidas.has(String((modalQueue[modalIndex] || modalQuestion).id))}
              onToggleDuvida={onToggleDuvida}
              onAnswer={handleModalAnswer}
              onNext={handleModalNext}
              onPrev={handleModalPrev}
              onBackToBank={() => setModalQuestion(null)}
              isSaving={isSavingAnswer}
              isAdmin={isAdminState}
              onEditQuestion={handleEditQuestao}
            />
          </div>
        </div>
      )}

      {/* ── MODAIS DE ADMINISTRAÇÃO AVANÇADA ── */}
      {isAdminState && (
        <>
          <ModalEditarQuestao
            isOpen={!!editingQuestao}
            onClose={() => setEditingQuestao(null)}
            questao={editingQuestao}
            orgNodes={dbNodes}
            onSuccess={handleEditSuccess}
          />

          <ModalMoverQuestao
            isOpen={movingQuestaoIds.length > 0}
            onClose={() => {
              setMovingQuestaoIds([]);
              setMovingQuestaoLabel("");
            }}
            questaoIds={movingQuestaoIds}
            questaoLabel={movingQuestaoLabel}
            orgNodes={dbNodes}
            onSuccess={handleMoveSuccess}
          />

          <ModalRenomearPasta
            isOpen={!!renamingNode}
            onClose={() => setRenamingNode(null)}
            nodeId={renamingNode?.id || ""}
            currentNome={renamingNode?.nome || ""}
            onSuccess={handleRenameSuccess}
          />

          <ModalMoverSubcaso
            isOpen={!!subcasoToMove}
            onClose={() => setSubcasoToMove(null)}
            subcaso={subcasoToMove}
            materias={unfilteredMaterias}
            onConfirmMove={handleConfirmMoveSubcaso}
          />

          <ModalExcluirCaderno
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            target={deleteTarget}
            onConfirmDelete={handleConfirmDeleteTarget}
          />

          <ImportJsonModal
            isOpen={isImportJsonOpen}
            onClose={() => setIsImportJsonOpen(false)}
            onSuccess={() => {
              void carregarNos();
              onRefreshQuestions?.();
            }}
          />
        </>
      )}

      {/* Modal Confirmação Excluir Questão Individual */}
      {questionToDelete && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md bg-[#0c1220] border border-rose-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-normal text-white">
                  Excluir Questão #{questionToDelete.id}?
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                  {questionToDelete.title || questionToDelete.perguntaProblema || "Esta ação não pode ser desfeita."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                disabled={deletingSingleQuestion}
                onClick={() => setQuestionToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg border border-white/[0.1] text-xs font-normal text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingSingleQuestion}
                onClick={() => void confirmDeleteSingleQuestion()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-normal text-white flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>{deletingSingleQuestion ? "Excluindo..." : "Excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[120] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium ${
            toastMsg.type === "success"
              ? "bg-[#0d1627] border-emerald-500/40 text-emerald-300"
              : "bg-[#251016] border-rose-500/40 text-rose-300"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}
    </div>
    </QuestionClassificationContext.Provider>
  );
}
