"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  FileText,
  Pencil,
  Trash2,
  FolderInput,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import QuestionResolver from "./QuestionResolver";
import { supabase, supabasePublic } from "../../lib/supabase";
import { ModalEditarQuestao } from "./ModalEditarQuestao";
import { ModalMoverQuestao } from "./ModalMoverQuestao";
import { ModalRenomearPasta } from "./ModalRenomearPasta";

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
  onSelectQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onAnswer?: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (questaoId: any) => Promise<void>;
  user: any;
  onShowAuth: () => void;
  onRefreshQuestions?: () => void;
  isAdmin?: boolean;
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

interface CasoGroup {
  id: string;
  nome: string;
  questoes: BancoQuestion[];
}

interface CadernoItem {
  id: string;
  nome: string;
  materia: string;
  casos: CasoGroup[];
  questoes: BancoQuestion[];
}

interface MateriaGroup {
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
// Componente: QuestaoRowItem (Exatamente: N. ≡ [ID] [●Dif] [→ Pasta] [Acertou/Errou])
// Sem enunciado! Suporta arrastar e soltar (Drag and Drop)!
// ─────────────────────────────────────────────────────────────────────────────
function QuestaoRowItem({
  questao,
  numero,
  casoNome,
  stats,
  isDuvida,
  onOpenResolver,
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
  onOpenResolver: () => void;
  isAdmin?: boolean;
  onEdit?: (q: BancoQuestion) => void;
  onMove?: (q: BancoQuestion) => void;
  onDelete?: (q: BancoQuestion) => void;
}) {
  const catKey = resolveCategory(questao);
  const categoryInfo = CATEGORIES.find(c => c.key === catKey);
  const catLabel = categoryInfo?.label || "Média";
  const catColor = categoryInfo?.textColor || "#c69238";

  const isErro = stats?.isCorrect === false;
  const isAcerto = stats?.isCorrect === true;

  // Exibir ID_Qconcursos, Ordem ou ID
  const displayId = (questao as any).ID_Qconcursos || (questao as any).Ordem || questao.id;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(questao.id));
        e.dataTransfer.setData("questao_id", String(questao.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpenResolver}
      className="flex items-center gap-2 py-1 px-2 transition-colors duration-150 rounded-md group cursor-pointer select-none bg-white/[0.015] hover:bg-white/[0.04] border border-white/[0.03] hover:border-white/[0.08]"
    >
      {/* Handle de arrastar */}
      <span className="text-slate-600 group-hover:text-slate-400 cursor-grab shrink-0 p-0.5" title="Arraste para mover para outro caso ou pasta">
        <GripVertical size={12} />
      </span>

      {/* Número da questão */}
      <span className="text-[10.5px] font-light text-slate-500 shrink-0 tabular-nums min-w-[18px]">
        {numero}.
      </span>

      {/* Botão indicador Play */}
      <span className="text-slate-500 hover:text-slate-300 transition-colors w-3.5 h-3.5 flex items-center justify-center shrink-0">
        <Play size={9} className="fill-current text-slate-500 group-hover:text-indigo-400" />
      </span>

      {/* ID_Qconcursos / Número da questão em âmbar */}
      <span className="text-[10.5px] font-mono font-medium text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.2 rounded shrink-0">
        {displayId}
      </span>

      {/* Bolinha com cor da dificuldade */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 select-none opacity-80"
        style={{ backgroundColor: catColor }}
        title={catLabel}
      />

      {/* Pill com nome da categoria */}
      <span
        className="text-[9.5px] font-light px-1.5 py-0.2 rounded bg-black/25 border border-white/[0.05] shrink-0"
        style={{ color: catColor }}
      >
        {catLabel}
      </span>

      {/* Pill com seta e nome da pasta/caso atual */}
      <span className="text-[9.5px] font-light text-slate-400 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-1 max-w-[240px]">
        <span className="text-indigo-400/70">→</span>
        <span className="truncate">{casoNome}</span>
      </span>

      {/* Indicador de Dúvida */}
      {isDuvida && (
        <Flag size={10} className="fill-amber-400/90 text-amber-400/90 shrink-0 ml-0.5" />
      )}

      {/* Indicador de Status Acerto / Erro na direita */}
      {isAcerto && (
        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9.5px] font-light text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 shrink-0 ml-auto">
          <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
          Acertou
        </span>
      )}
      {isErro && (
        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9.5px] font-light text-rose-300/90 bg-rose-950/40 border border-rose-800/40 shrink-0 ml-auto">
          <span className="w-1 h-1 rounded-full bg-rose-500 shrink-0" />
          Errou
        </span>
      )}

      {/* Ações de Administração: Mover, Editar, Excluir */}
      {isAdmin && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onMove?.(questao)}
            title="Mover para outro caso ou pasta"
            className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <FolderInput size={11} />
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(questao)}
            title="Editar questão"
            className="p-1 text-slate-500 hover:text-amber-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(questao)}
            title="Excluir questão"
            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-white/[0.08] rounded transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: Árvore Recursiva de Pastas (Exatamente o print do usuário!)
// 📁 Conhecimentos Bancários
//     📁 Mercado de Capitais
//         📁 Underwriting
//             📄 123456
// ─────────────────────────────────────────────────────────────────────────────
function TreeNodeItem({
  node,
  depth = 0,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onDropQuestion,
  onAddSubfolder,
}: {
  node: HierarchyTreeNode;
  depth?: number;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onDropQuestion: (questaoId: string, targetNodeId: string) => void;
  onAddSubfolder: (parentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasChildren = node.filhos.length > 0 || node.questoes.length > 0;

  return (
    <div className="flex flex-col select-none">
      {/* Linha da Pasta */}
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
            onDropQuestion(qId, node.id);
          }
        }}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        className={`flex items-center justify-between gap-2 py-1.5 pr-3 rounded-lg cursor-pointer transition-all group ${
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
                className={`transition-transform duration-150 ${isOpen ? "" : "-rotate-90"}`}
              />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
            )}
          </button>

          {/* Ícone de pasta dourada conforme a imagem do usuário */}
          <span className="text-amber-400 text-sm shrink-0">📁</span>

          <span className="text-[12px] font-semibold tracking-wide truncate">
            {node.nome}
          </span>

          <span className="text-[10px] text-slate-500 font-mono">
            ({node.questoes.length + node.totalDescendentesQuestoes})
          </span>
        </div>

        {/* Botão de adicionar subpasta inline */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSubfolder(node.id);
          }}
          title={`Adicionar subpasta dentro de "${node.nome}"`}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.06] rounded transition-all shrink-0"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Filhos e Questões */}
      {isOpen && (
        <div className="flex flex-col">
          {/* Subpastas */}
          {node.filhos.map(filho => (
            <TreeNodeItem
              key={filho.id}
              node={filho}
              depth={depth + 1}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onOpenQuestion={onOpenQuestion}
              onDropQuestion={onDropQuestion}
              onAddSubfolder={onAddSubfolder}
            />
          ))}

          {/* Questões diretamente vinculadas a este nó */}
          {node.questoes.map((q, idx) => {
            const displayId = (q as any).ID_Qconcursos || (q as any).Ordem || q.id;
            const catKey = resolveCategory(q);
            const catInfo = CATEGORIES.find(c => c.key === catKey);
            const st = userAnswers[String(q.id)];
            const isAcerto = st?.isCorrect === true;
            const isErro = st?.isCorrect === false;

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
                style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
                className="flex items-center justify-between gap-2 py-1 pr-3 rounded-lg hover:bg-white/[0.04] cursor-pointer text-slate-300 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-500 group-hover:text-slate-300 shrink-0">📄</span>
                  <span className="text-[11px] font-mono font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.2 rounded shrink-0">
                    {displayId}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: catInfo?.textColor || "#c69238" }}
                    title={catInfo?.label}
                  />
                </div>

                {isAcerto && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.2 rounded-full shrink-0">
                    Acertou
                  </span>
                )}
                {isErro && (
                  <span className="text-[9px] font-bold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.2 rounded-full shrink-0">
                    Errou
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CasoAccordion (Caso / Subpasta que é Drop Target no modo Notion)
// ─────────────────────────────────────────────────────────────────────────────
function CasoAccordion({
  caso,
  index,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onDropQuestion,
  isAdmin,
  onEditQuestao,
  onMoveQuestao,
  onDeleteQuestao,
  onRenameCaso,
  onAddSubfolder,
  onDeleteCaso,
}: {
  caso: CasoGroup;
  index: number;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onDropQuestion: (questaoId: string, targetCasoId: string) => void;
  isAdmin?: boolean;
  onEditQuestao?: (q: BancoQuestion) => void;
  onMoveQuestao?: (q: BancoQuestion) => void;
  onDeleteQuestao?: (q: BancoQuestion) => void;
  onRenameCaso?: (casoId: string, currentNome: string) => void;
  onAddSubfolder?: (casoId: string) => void;
  onDeleteCaso?: (casoId: string, casoNome: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const [isDragOver, setIsDragOver] = useState(false);

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
      className={`relative flex flex-col gap-1 rounded-lg transition-all ${
        isDragOver ? "ring-1 ring-indigo-500/60 bg-indigo-500/10 p-0.5" : ""
      }`}
    >
      {/* Botão do Caso Header - Compacto, sem negrito e elegante */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`relative z-10 w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg border border-white/[0.04] bg-[#0d1220]/80 hover:bg-[#121829] hover:border-white/[0.08] transition-all text-left group ${
          isDragOver ? "border-indigo-500" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[12px] opacity-75 shrink-0 select-none">
            📁
          </span>
          <span className="text-[11.5px] font-normal text-slate-300 tracking-wide truncate group-hover:text-slate-100 transition-colors">
            <span className="text-slate-500 font-light mr-1.5">{index + 1}.</span>
            {caso.nome || "Geral"}
          </span>
        </div>

        {/* Stats inline */}
        <div className="flex items-center gap-2 text-[10px] shrink-0 tabular-nums font-light">
          <span className="text-slate-500 font-light">{stats.total} quest.</span>
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

          {/* Ações de Admin no Caso */}
          {isAdmin && (
            <div
              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onAddSubfolder?.(caso.id)}
                title="Adicionar subpasta neste caso"
                className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-white/[0.08] rounded transition-colors"
              >
                <FolderPlus size={11} />
              </button>
              <button
                type="button"
                onClick={() => onRenameCaso?.(caso.id, caso.nome)}
                title="Renomear este caso"
                className="p-1 text-slate-500 hover:text-amber-400 hover:bg-white/[0.08] rounded transition-colors"
              >
                <Pencil size={11} />
              </button>
              {caso.questoes.length === 0 && (
                <button
                  type="button"
                  onClick={() => onDeleteCaso?.(caso.id, caso.nome)}
                  title="Excluir este caso vazio"
                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-white/[0.08] rounded transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )}

          <ChevronDown
            size={11}
            className={`text-slate-500/70 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Conteúdo do Caso expandido */}
      {isOpen && (
        <div className="pl-4 pr-1 pb-1 flex flex-col gap-1 animate-in fade-in duration-150 border-l border-white/[0.05] ml-3.5 my-0.5">
          {caso.questoes.length === 0 ? (
            <div className="py-2 px-3 border border-dashed border-white/[0.05] rounded-md text-center text-slate-500 text-[11px] font-light">
              Nenhuma questão neste caso. Arraste questões para cá.
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {caso.questoes.map((q, qIdx) => (
                <QuestaoRowItem
                  key={q.id}
                  questao={q}
                  numero={qIdx + 1}
                  casoNome={caso.nome}
                  stats={userAnswers[String(q.id)]}
                  isDuvida={duvidas.has(String(q.id))}
                  onOpenResolver={() => onOpenQuestion(q, caso.questoes)}
                  isAdmin={isAdmin}
                  onEdit={onEditQuestao}
                  onMove={onMoveQuestao}
                  onDelete={onDeleteQuestao}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CadernoDedicatedView (Tela focada no Caderno com timeline de Casos)
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
  onRenameCaso,
  onDeleteCaso,
}: {
  caderno: CadernoItem;
  onBack: () => void;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onTrainAll: () => void;
  onDropQuestion: (questaoId: string, targetCasoId: string) => void;
  onOpenNovaPastaModal: (parentCadernoId: string) => void;
  isAdmin?: boolean;
  onEditQuestao?: (q: BancoQuestion) => void;
  onMoveQuestao?: (q: BancoQuestion) => void;
  onDeleteQuestao?: (q: BancoQuestion) => void;
  onRenameCaso?: (casoId: string, currentNome: string) => void;
  onDeleteCaso?: (casoId: string, casoNome: string) => void;
}) {
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "erros" | "nao_feitas" | "duvidas">("todas");

  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let duvidasCount = 0;

    caderno.questoes.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) {
        if (st.isCorrect) acertos++;
        else erros++;
      }
      if (duvidas.has(String(q.id))) duvidasCount++;
    });

    const total = caderno.questoes.length;
    const respondidas = acertos + erros;
    const pct = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, pct };
  }, [caderno.questoes, userAnswers, duvidas]);

  const casosFiltrados = useMemo(() => {
    if (filtroStatus === "todas") return caderno.casos;

    return caderno.casos
      .map((c) => {
        const filteredQs = c.questoes.filter((q) => {
          const st = userAnswers[String(q.id)];
          if (filtroStatus === "erros") return st && !st.isCorrect;
          if (filtroStatus === "nao_feitas") return !st;
          if (filtroStatus === "duvidas") return duvidas.has(String(q.id));
          return true;
        });
        return { ...c, questoes: filteredQs };
      })
      .filter((c) => c.questoes.length > 0);
  }, [caderno.casos, filtroStatus, userAnswers, duvidas]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Topo da Visão Dedicada */}
      <div className="flex items-center justify-between gap-3 bg-[#101526] p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] shadow-xl flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
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
                <h3 className="text-sm sm:text-base font-bold text-white truncate">{caderno.nome}</h3>
                <span className="text-[10px] font-bold text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md shrink-0 uppercase">
                  {caderno.materia}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {caderno.casos.length} caso(s) · {caderno.questoes.length} questões
              </p>
            </div>
          </div>
        </div>

        {/* Stats + Botão Iniciar Treino */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums bg-[#080d1a] border border-white/[0.08] px-3 py-1.5 rounded-xl">
            <span className="text-slate-400">{stats.total} quest.</span>
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <Check size={11} /> {stats.acertos}
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-0.5">
              <X size={11} /> {stats.erros}
            </span>
            <span className="text-amber-400 font-bold flex items-center gap-0.5">
              <Flag size={10} /> {stats.duvidasCount}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                stats.pct === null
                  ? "text-slate-500 border-slate-800 bg-slate-900"
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

          <button
            onClick={() => onOpenNovaPastaModal(caderno.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-indigo-300 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <FolderPlus size={13} /> Nova Subpasta / Caso
          </button>

          <button
            onClick={onTrainAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-600/20"
          >
            <Play size={12} /> Resolver Caderno
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Casos */}
      <div className="flex items-center justify-between gap-3 bg-[#101526] p-3 rounded-2xl border border-white/[0.06] flex-wrap">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Filter size={14} className="text-indigo-400" />
          Filtrar questões:
        </span>

        <div className="flex items-center gap-1 bg-[#0d1220] p-1 rounded-xl border border-white/[0.08] shrink-0 flex-wrap">
          {[
            { id: "todas", label: "Todas" },
            { id: "erros", label: "🔴 Com Erros" },
            { id: "nao_feitas", label: "⭕ Pendentes" },
            { id: "duvidas", label: "⚑ Dúvidas" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFiltroStatus(st.id as any)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                filtroStatus === st.id
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Casos do Caderno - Compacto e elegante */}
      <div className="flex flex-col gap-2 p-3 sm:p-3.5 bg-[#0a0e1a]/85 rounded-xl border border-white/[0.04]">
        <h4 className="text-[10px] font-normal text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
          <LayoutGrid size={11} className="text-indigo-400/70" /> Desempenho por Caso (Subpastas)
        </h4>

        <div className="relative flex flex-col gap-1">
          {casosFiltrados.map((caso, idx) => (
            <CasoAccordion
              key={caso.id}
              caso={caso}
              index={idx}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onOpenQuestion={onOpenQuestion}
              onDropQuestion={onDropQuestion}
              isAdmin={isAdmin}
              onEditQuestao={onEditQuestao}
              onMoveQuestao={onMoveQuestao}
              onDeleteQuestao={onDeleteQuestao}
              onRenameCaso={onRenameCaso}
              onAddSubfolder={onOpenNovaPastaModal}
              onDeleteCaso={onDeleteCaso}
            />
          ))}
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0d1220] border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderPlus size={16} />
            </span>
            <h3 className="text-sm font-bold text-white">Criar Nova Pasta / Caderno</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] text-slate-400 hover:text-white flex items-center justify-center transition-all"
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
              className="bg-[#111623] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pasta Pai (Hierarquia de Nós)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="bg-[#111623] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
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
              className="px-3.5 py-1.5 rounded-xl border border-white/[0.10] text-slate-400 hover:text-white text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !nome.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
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
  onSelectQuestion,
  onAnswer,
  onToggleDuvida,
  user,
  onShowAuth,
  onRefreshQuestions,
  isAdmin = false,
}: CadernosTabProps) {
  const [selectedCaderno, setSelectedCaderno] = useState<CadernoItem | null>(null);
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "mais_erros" | "nao_feitas" | "duvidas">("todas");
  const [search, setSearch] = useState("");

  // Alternador de Visualização: "blocos" (Notion Cards) ou "arvore" (Tree Folder)
  const [viewMode, setViewMode] = useState<"blocos" | "arvore">("blocos");

  // Estado dos nós de organização carregados do Supabase
  const [dbNodes, setDbNodes] = useState<OrgNodeDB[]>([]);
  const [isNovaPastaModalOpen, setIsNovaPastaModalOpen] = useState(false);
  const [modalDefaultParentId, setModalDefaultParentId] = useState<string>("");

  // Override local de organizacao_id para drag and drop instantâneo
  const [orgOverrides, setOrgOverrides] = useState<Map<string, string>>(new Map());

  // Administração Avançada (Exclusivo Admin)
  const [editingQuestao, setEditingQuestao] = useState<BancoQuestion | null>(null);
  const [movingQuestaoIds, setMovingQuestaoIds] = useState<(string | number)[]>([]);
  const [movingQuestaoLabel, setMovingQuestaoLabel] = useState<string>("");
  const [renamingNode, setRenamingNode] = useState<{ id: string; nome: string } | null>(null);
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
        setDbNodes(res.data as OrgNodeDB[]);
      }
    } catch (e) {
      console.warn("Aviso ao buscar organizacao_nos:", e);
    }
  }, []);

  useEffect(() => {
    carregarNos();
  }, [carregarNos]);

  // Handlers de Administração de Questões e Casos
  const handleEditQuestao = useCallback((q: BancoQuestion) => {
    if (!isAdmin) return;
    setEditingQuestao(q);
  }, [isAdmin]);

  const handleEditSuccess = useCallback((updated: BancoQuestion) => {
    showToast("Questão atualizada com sucesso!");
    if (onRefreshQuestions) onRefreshQuestions();
    if (modalQuestion && modalQuestion.id === updated.id) {
      setModalQuestion(updated);
    }
  }, [onRefreshQuestions, modalQuestion]);

  const handleOpenMoveModal = useCallback((q: BancoQuestion) => {
    if (!isAdmin) return;
    const label = (q as any).ID_Qconcursos || (q as any).Ordem ? `Q${(q as any).ID_Qconcursos || (q as any).Ordem}` : `Questão #${q.id}`;
    setMovingQuestaoIds([q.id]);
    setMovingQuestaoLabel(label);
  }, [isAdmin]);

  const handleMoveSuccess = useCallback((targetNodeId: string, targetNodeName: string) => {
    setOrgOverrides(prev => {
      const next = new Map(prev);
      movingQuestaoIds.forEach(id => next.set(String(id), targetNodeId));
      return next;
    });
    showToast(`Questão movida para "${targetNodeName}" com sucesso!`);
    carregarNos();
    if (onRefreshQuestions) onRefreshQuestions();
  }, [movingQuestaoIds, carregarNos, onRefreshQuestions]);

  const handleOpenRenameCaso = useCallback((casoId: string, currentNome: string) => {
    if (!isAdmin) return;
    setRenamingNode({ id: casoId, nome: currentNome });
  }, [isAdmin]);

  const handleRenameSuccess = useCallback((nodeId: string, newNome: string) => {
    showToast(`Pasta renomeada para "${newNome}" com sucesso!`);
    carregarNos();
    if (onRefreshQuestions) onRefreshQuestions();
  }, [carregarNos, onRefreshQuestions]);

  const handleDeleteQuestao = useCallback(async (q: BancoQuestion) => {
    if (!isAdmin) return;
    const confirmDel = window.confirm(
      `Deseja realmente excluir a questão #${q.id}${(q as any).ID_Qconcursos ? ` (${(q as any).ID_Qconcursos})` : ""}? Esta ação não pode ser desfeita.`
    );
    if (!confirmDel) return;

    try {
      let res = await supabase.from("questoes").delete().eq("id", q.id);
      if (res.error) {
        res = await supabasePublic.from("questoes").delete().eq("id", q.id);
      }
      if (res.error) throw new Error(res.error.message);

      showToast("Questão excluída com sucesso!");
      if (onRefreshQuestions) onRefreshQuestions();
    } catch (e: any) {
      console.error("Erro ao excluir questão:", e);
      showToast(e.message || "Erro ao excluir questão.", "error");
    }
  }, [isAdmin, onRefreshQuestions]);

  const handleDeleteCaso = useCallback(async (casoId: string, casoNome: string) => {
    if (!isAdmin) return;
    const confirmDel = window.confirm(`Deseja realmente excluir o caso/pasta "${casoNome}"?`);
    if (!confirmDel) return;

    try {
      let res = await supabase.from("organizacao_nos").delete().eq("id", casoId);
      if (res.error) {
        res = await supabasePublic.from("organizacao_nos").delete().eq("id", casoId);
      }
      if (res.error) throw new Error(res.error.message);

      showToast(`Caso "${casoNome}" excluído.`);
      carregarNos();
      if (onRefreshQuestions) onRefreshQuestions();
    } catch (e: any) {
      console.error("Erro ao excluir caso:", e);
      showToast(e.message || "Erro ao excluir caso.", "error");
    }
  }, [isAdmin, carregarNos, onRefreshQuestions]);

  // ── 2. Montar Estrutura Hierárquica em Árvore Completa ──
  const { treeRoots, materiasAgrupadas, todosCadernos, parentOptions } = useMemo(() => {
    // Mapa de nós por ID (UUID)
    const nodeMap = new Map<string, HierarchyTreeNode>();

    dbNodes.forEach(n => {
      nodeMap.set(String(n.id), {
        id: String(n.id),
        nome: n.nome.trim(),
        parent_id: n.parent_id ? String(n.parent_id) : null,
        tipo: n.tipo,
        ordem: n.ordem ?? 0,
        filhos: [],
        questoes: [],
        totalDescendentesQuestoes: 0,
      });
    });

    // Função para subir a cadeia ancestral de qualquer nó
    function getAncestry(nodeId: string): HierarchyTreeNode[] {
      const chain: HierarchyTreeNode[] = [];
      let cur = nodeMap.get(nodeId);
      const visited = new Set<string>();
      while (cur && !visited.has(cur.id)) {
        visited.add(cur.id);
        chain.unshift(cur);
        cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined;
      }
      return chain;
    }

    // Vincular filhos aos pais para formar a árvore recursiva
    const roots: HierarchyTreeNode[] = [];
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.filhos.push(node);
      } else {
        roots.push(node);
      }
    });

    // Mapear cada questão para o nó final em organizacao_nos através de organizacao_id
    const unlinkedQuestions: BancoQuestion[] = [];

    questions.forEach(q => {
      const effectiveOrgId = orgOverrides.get(String(q.id)) || (q as any).organizacao_id;
      if (effectiveOrgId && nodeMap.has(String(effectiveOrgId))) {
        // Encontra o nó final exato correspondente ao UUID
        const targetNode = nodeMap.get(String(effectiveOrgId))!;
        targetNode.questoes.push(q);
      } else {
        unlinkedQuestions.push(q);
      }
    });

    // Se houver questões sem organizacao_id, agrupa em nós virtuais correspondentes à Matéria
    unlinkedQuestions.forEach(q => {
      const matName = (q.materia || (q as any).Disciplina || "Conhecimentos Bancários").trim();
      let root = roots.find(r => r.nome.toLowerCase() === matName.toLowerCase());
      if (!root) {
        root = {
          id: `root_virt_${matName.toLowerCase()}`,
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
      }

      const cadName = ((q as any).topico || (q as any)["Tópico"] || q.tema || (q as any).PROVA || "Geral").trim();
      let cad = root.filhos.find(f => f.nome.toLowerCase() === cadName.toLowerCase());
      if (!cad) {
        cad = {
          id: `cad_virt_${root.id}_${cadName.toLowerCase()}`,
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
      }

      const casoName = ((q as any).assunto || (q as any)["Assunto"] || (q as any)["Pergunta problema"] || "Geral").trim();
      let caso = cad.filhos.find(f => f.nome.toLowerCase() === casoName.toLowerCase());
      if (!caso) {
        caso = {
          id: `caso_virt_${cad.id}_${casoName.toLowerCase()}`,
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
      }

      caso.questoes.push(q);
    });

    // Calcular contagem de descendentes recursivamente
    function computeDescendants(node: HierarchyTreeNode): number {
      let count = node.questoes.length;
      for (const child of node.filhos) {
        count += computeDescendants(child);
      }
      node.totalDescendentesQuestoes = count - node.questoes.length;
      return count;
    }
    roots.forEach(r => computeDescendants(r));

    // ── Converter a árvore em blocos Notion para o modo Cadernos ──
    const materiasList: MateriaGroup[] = [];
    const cadernosList: CadernoItem[] = [];

    roots.forEach(root => {
      const cadList: CadernoItem[] = [];

      // Cada filho direto da raiz é um Caderno
      root.filhos.forEach(cadNode => {
        const casosList: CasoGroup[] = [];
        const cadAllQuestions: BancoQuestion[] = [...cadNode.questoes];

        // Filhos do caderno são os Casos
        if (cadNode.filhos.length > 0) {
          cadNode.filhos.forEach(casoNode => {
            const casoAllQuestions: BancoQuestion[] = [...casoNode.questoes];
            // Coleta questões de sub-subpastas se houver
            function collectSubQuestions(n: HierarchyTreeNode) {
              for (const sub of n.filhos) {
                casoAllQuestions.push(...sub.questoes);
                collectSubQuestions(sub);
              }
            }
            collectSubQuestions(casoNode);

            casosList.push({
              id: casoNode.id,
              nome: casoNode.nome,
              questoes: casoAllQuestions,
            });
            cadAllQuestions.push(...casoAllQuestions);
          });
        } else {
          // Se o caderno não tem subpastas filhas, ele mesmo é um caso
          casosList.push({
            id: cadNode.id,
            nome: cadNode.nome,
            questoes: cadNode.questoes,
          });
        }

        casosList.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        const cadItem: CadernoItem = {
          id: cadNode.id,
          nome: cadNode.nome,
          materia: root.nome,
          casos: casosList,
          questoes: cadAllQuestions,
        };

        cadList.push(cadItem);
        cadernosList.push(cadItem);
      });

      cadList.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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

    // Opções para o select de criar pasta
    const options: { id: string; nome: string; nivel: string }[] = [];
    roots.forEach(rn => {
      options.push({ id: rn.id, nome: rn.nome, nivel: "🏛️ [Matéria Raiz]" });
      rn.filhos.forEach(cn => {
        options.push({ id: cn.id, nome: `${rn.nome} → ${cn.nome}`, nivel: "  📁 [Subpasta / Caderno]" });
        cn.filhos.forEach(sub => {
          options.push({ id: sub.id, nome: `${rn.nome} → ${cn.nome} → ${sub.nome}`, nivel: "    📄 [Caso Folha]" });
        });
      });
    });

    return {
      treeRoots: roots,
      materiasAgrupadas: materiasList,
      todosCadernos: cadernosList,
      parentOptions: options,
    };
  }, [dbNodes, questions, orgOverrides]);

  // Lista de matérias para filtros em pills
  const materiasDisponiveis = useMemo(() => {
    return materiasAgrupadas.map(m => m.nome);
  }, [materiasAgrupadas]);

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

  // Manipulador de abertura de questão em modal QuestionResolver
  const handleOpenQuestionInModal = useCallback((q: BancoQuestion, queue: BancoQuestion[]) => {
    if (!user) {
      onShowAuth();
      return;
    }
    const idx = queue.findIndex(item => String(item.id) === String(q.id));
    setModalQueue(queue);
    setModalIndex(idx >= 0 ? idx : 0);
    setModalQuestion(q);
  }, [user, onShowAuth]);

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

  // ── Se estiver na visão dedicada de um Caderno Selecionado ──
  if (selectedCaderno) {
    return (
      <div className="flex flex-col gap-4 bg-[#080d1a] rounded-2xl border border-white/[0.06] p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-600/[0.03] blur-[120px] rounded-full pointer-events-none" />

        <CadernoDedicatedView
          caderno={selectedCaderno}
          onBack={() => {
            setSelectedCaderno(null);
            setCadernoFiltro("Todos");
          }}
          userAnswers={userAnswers}
          duvidas={duvidas}
          onOpenQuestion={handleOpenQuestionInModal}
          onTrainAll={() => {
            if (!user) { onShowAuth(); return; }
            if (selectedCaderno.questoes.length > 0) {
              handleOpenQuestionInModal(selectedCaderno.questoes[0], selectedCaderno.questoes);
            }
          }}
          onDropQuestion={handleDropQuestion}
          onOpenNovaPastaModal={(parentCadernoId) => {
            setModalDefaultParentId(parentCadernoId);
            setIsNovaPastaModalOpen(true);
          }}
          isAdmin={isAdmin}
          onEditQuestao={handleEditQuestao}
          onMoveQuestao={handleOpenMoveModal}
          onDeleteQuestao={handleDeleteQuestao}
          onRenameCaso={handleOpenRenameCaso}
          onDeleteCaso={handleDeleteCaso}
        />

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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="relative w-full max-w-6xl max-h-[96vh] bg-[#0c101c] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto custom-scrollbar p-4 sm:p-8 flex flex-col">
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
                isAdmin={isAdmin}
                onEditQuestion={handleEditQuestao}
              />
            </div>
          </div>
        )}

        {/* ── MODAIS DE ADMINISTRAÇÃO AVANÇADA NO CADERNO SELECIONADO ── */}
        {isAdmin && (
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
          </>
        )}

        {/* Toast Notification */}
        {toastMsg && (
          <div
            className={`fixed bottom-6 right-6 z-[120] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 ${
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

  // Filtragem de matérias
  const materiasFiltradas = materiasAgrupadas.filter(m => {
    if (materiaFiltro !== "Todas" && m.nome !== materiaFiltro) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchMateria = m.nome.toLowerCase().includes(term);
      const matchCaderno = m.cadernos.some(c => c.nome.toLowerCase().includes(term));
      if (!matchMateria && !matchCaderno) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 bg-[#080d1a] rounded-2xl border border-white/[0.06] p-4 sm:p-5 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow idêntico ao NotionQuestionTab */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-600/[0.03] blur-[120px] rounded-full pointer-events-none" />

      {/* ── Toolbar Superior Ultra-Compacta ── */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2.5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <BookMarked size={14} className="text-indigo-400" />
            </div>
            <h2 className="text-sm font-black text-white tracking-tight">Cadernos de Questões</h2>
          </div>

          {user && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 flex-wrap">
              {/* Total de questões */}
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de questões cadastradas">
                <BookMarked size={11} className="text-indigo-400/80" />
                <span className="text-indigo-300 font-bold">{questions.length} questões</span>
              </span>

              {/* Acertos */}
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de acertos">
                <Check size={11} className="text-emerald-400/80 stroke-[2]" />
                <span className="text-emerald-400/90 font-medium">{acertadasCount} acertos</span>
              </span>

              {/* Erros */}
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Total de erros">
                <X size={11} className="text-rose-400/80 stroke-[2]" />
                <span className="text-rose-400/90 font-medium">{erradasCount} erros</span>
              </span>

              {/* Dúvidas */}
              <span className="text-[10px] font-normal text-slate-300 flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded-lg" title="Em dúvida">
                <Flag size={11} className="text-amber-400/80 fill-amber-400/10" />
                <span className="text-amber-400/90 font-medium">{duvidasCount} dúvidas</span>
              </span>

              {/* Aproveitamento */}
              {respondidasTotal > 0 && (
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border bg-slate-900/60 border-slate-800 ${
                    taxaAcertoGlobal >= 70
                      ? "text-emerald-400/90"
                      : taxaAcertoGlobal >= 50
                      ? "text-amber-400/90"
                      : "text-rose-400/90"
                  }`}
                  title="Taxa de aproveitamento"
                >
                  🎯 {taxaAcertoGlobal}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Alternador de Modo de Visualização (Notion Cards x Árvore) + Botão Nova Pasta */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setViewMode("blocos")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                viewMode === "blocos"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={12} />
              <span>Cadernos Notion</span>
            </button>
            <button
              onClick={() => setViewMode("arvore")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                viewMode === "arvore"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FolderTree size={12} />
              <span>Árvore de Pastas</span>
            </button>
          </div>

          <button
            onClick={() => {
              setModalDefaultParentId("");
              setIsNovaPastaModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <FolderPlus size={13} />
            <span>Nova Pasta / Caderno</span>
          </button>
        </div>
      </div>

      {/* ── Barra de Filtros e Busca (Idêntica ao Notion) ── */}
      <div className="flex items-center gap-3 flex-wrap justify-between bg-[#101526] p-3 rounded-2xl border border-white/[0.08] relative z-10 shadow-xl">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Busca */}
          <div className="relative min-w-[160px] max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar caderno ou pasta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0d1220] border border-white/[0.08] rounded-xl pl-8 pr-7 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 transition-all"
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

          {/* Select de Cadernos */}
          <div className="flex items-center gap-1.5 bg-[#0d1220] border border-white/[0.08] hover:border-white/[0.18] px-3 py-1.5 rounded-xl transition-all">
            <BookMarked size={13} className="text-indigo-400 shrink-0" />
            <select
              value={cadernoFiltro}
              onChange={e => {
                const val = e.target.value;
                setCadernoFiltro(val);
                if (val !== "Todos") {
                  const found = todosCadernos.find(c => c.nome === val);
                  if (found) setSelectedCaderno(found);
                }
              }}
              className="bg-[#0d1220] text-slate-200 text-[11px] font-bold focus:outline-none cursor-pointer border-none min-w-[140px] max-w-[220px]"
              style={{ backgroundColor: "#0d1220", color: "#e2e8f0" }}
            >
              <option value="Todos" className="bg-[#0d1220] text-slate-200 py-1">
                Todos os Cadernos ({todosCadernos.length})
              </option>
              {todosCadernos.map(c => (
                <option key={c.id} value={c.nome} className="bg-[#0d1220] text-slate-200 py-1">
                  {c.nome} ({c.materia})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Matéria em Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {["Todas", ...materiasDisponiveis].map(m => (
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

        {/* Filtro por Status */}
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
            🔴 Erros
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
            onClick={() => setStatusFiltro("duvidas")}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              statusFiltro === "duvidas" ? "bg-amber-500 text-white shadow" : "text-amber-400/70 hover:text-amber-300"
            }`}
          >
            ⚑ Dúvidas
          </button>
        </div>
      </div>

      {/* ── MODO 1: ÁRVORE HIERÁRQUICA COMPLETA (EXATAMENTE O PRINT DO USUÁRIO) ── */}
      {viewMode === "arvore" ? (
        <div className="flex flex-col gap-2 p-4 bg-[#0d1220] rounded-2xl border border-white/[0.08] relative z-10 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>📁</span> Estrutura Hierárquica de Pastas (organizacao_nos)
            </span>
            <span className="text-[10px] text-slate-500 italic">
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
                onAddSubfolder={(parentId) => {
                  setModalDefaultParentId(parentId);
                  setIsNovaPastaModalOpen(true);
                }}
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
                setStatusFiltro("todas");
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 relative z-10">
            {materiasFiltradas.map((mat) => {
              // Estatísticas pré-computadas da matéria (instantâneo)
              const mStat = materiasStats.get(mat.id) || { acertos: 0, erros: 0, duvidas: 0, pct: null };
              const mAcertos = mStat.acertos;
              const mErros = mStat.erros;
              const mDuvidas = mStat.duvidas;
              const mPct = mStat.pct;
              const mTotal = mat.totalQuestoes;

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
                  className="flex flex-col bg-[#0b0f19]/85 border border-white/[0.04] rounded-xl p-2 sm:p-2.5 gap-1.5 transition-all hover:border-white/[0.08]"
                >
                  {/* ── CABEÇALHO DA MATÉRIA (Compacto, sem negrito, letras finas e elegantes) ── */}
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5 px-1 flex-nowrap gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                      <span className="w-1 h-1 rounded-full bg-indigo-400/80 shrink-0" />
                      <span className="text-xs shrink-0 opacity-80">{mat.icone}</span>
                      <h3 className="text-[11px] font-normal text-slate-300 uppercase tracking-wider truncate">
                        {mat.nome}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-light shrink-0 select-none flex-nowrap whitespace-nowrap tabular-nums">
                        <span className="text-slate-500 font-light">{mTotal} quest.</span>
                        <span className="text-emerald-400/80 flex items-center gap-0.5" title="Total de acertos na matéria">
                          <Check size={9} className="stroke-[1.5]" />
                          {mAcertos}
                        </span>
                        <span className="text-rose-400/80 flex items-center gap-0.5" title="Total de erros na matéria">
                          <X size={9} className="stroke-[1.5]" />
                          {mErros}
                        </span>
                        <span className="text-amber-400/80 flex items-center gap-0.5" title="Total em dúvida na matéria">
                          <Flag size={8} />
                          {mDuvidas}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-light tabular-nums ${mAproveitamentoClasses}`}>
                          {mPct === null ? "—" : `${mPct}%`}
                        </span>
                      </div>

                      <span className="text-[9.5px] font-light text-slate-500 font-mono bg-white/[0.02] px-1.5 py-0.2 rounded border border-white/[0.04] shrink-0">
                        {mat.cadernos.length} caderno{mat.cadernos.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* ── LISTA DE CADERNOS DENTRO DA MATÉRIA (Compacto e elegante) ── */}
                  <div className="flex flex-col gap-1">
                    {mat.cadernos.map((caderno) => {
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
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const qId = e.dataTransfer.getData("questao_id") || e.dataTransfer.getData("text/plain");
                            if (qId) {
                              handleDropQuestion(qId, caderno.id);
                            }
                          }}
                          className="flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg border transition-all bg-[#0e1322]/80 border-white/[0.04] hover:bg-[#13192b] hover:border-white/[0.08] group cursor-pointer"
                          onClick={() => setSelectedCaderno(caderno)}
                        >
                          {/* Lado Esquerdo: Ícone + Título */}
                          <div className="flex items-center gap-2 min-w-0 flex-nowrap truncate flex-1">
                            <span className="text-[10px] text-slate-600 group-hover:text-slate-400 w-3 h-3 flex items-center justify-center shrink-0">
                              →
                            </span>
                            <span className="text-xs shrink-0 opacity-75">📝</span>
                            <span className="text-[11.5px] font-normal text-slate-300 tracking-wide group-hover:text-slate-100 truncate">
                              {caderno.nome}
                            </span>
                          </div>

                          {/* Lado Direito: Stats do Caderno + Botão Abrir */}
                          <div className="flex items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap">
                            <span className="text-[10px] font-light text-slate-500 tabular-nums">{cTotal} quest.</span>
                            <span className="text-emerald-400/80 font-light flex items-center gap-0.5 text-[10px]" title="Total de acertos">
                              <Check size={9} className="stroke-[1.5]" />
                              {cAcertos}
                            </span>
                            <span className="text-rose-400/80 font-light flex items-center gap-0.5 text-[10px]" title="Total de erros">
                              <X size={9} className="stroke-[1.5]" />
                              {cErros}
                            </span>
                            <span className="text-amber-400/80 font-light flex items-center gap-0.5 text-[10px]" title="Em dúvida">
                              <Flag size={8} />
                              {cDuvidas}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded border text-[9px] font-light tabular-nums ${cAproveitamentoClasses}`}>
                              {cPct === null ? "—" : `${cPct}%`}
                            </span>

                            <span
                              title="Abrir visão dedicada deste caderno"
                              className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.05] bg-white/[0.02] text-slate-500 group-hover:text-slate-300 group-hover:border-white/[0.10] transition-all ml-0.5"
                            >
                              <ChevronRight size={11} />
                            </span>

                            {isAdmin && (
                              <div
                                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleOpenRenameCaso(caderno.id, caderno.nome)}
                                  title="Renomear este caderno"
                                  className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.05] bg-white/[0.02] text-slate-500 hover:text-amber-300 hover:border-white/[0.12] transition-all"
                                >
                                  <Pencil size={10} />
                                </button>
                                {caderno.questoes.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCaso(caderno.id, caderno.nome)}
                                    title="Excluir este caderno vazio"
                                    className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.05] bg-white/[0.02] text-slate-500 hover:text-rose-400 hover:border-white/[0.12] transition-all"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="relative w-full max-w-6xl max-h-[96vh] bg-[#0c101c] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto custom-scrollbar p-4 sm:p-8 flex flex-col">
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
              isAdmin={isAdmin}
              onEditQuestion={handleEditQuestao}
            />
          </div>
        </div>
      )}

      {/* ── MODAIS DE ADMINISTRAÇÃO AVANÇADA ── */}
      {isAdmin && (
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
        </>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-[120] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 ${
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
