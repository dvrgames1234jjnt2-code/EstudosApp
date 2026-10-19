"use client";

import React, { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import QuestionResolver from "./QuestionResolver";

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

interface CadernosTabProps {
  questions: BancoQuestion[];
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onSelectQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onAnswer?: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (questaoId: any) => Promise<void>;
  user: any;
  onShowAuth: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrutura hierárquica: Matéria -> Tópicos (Cadernos) -> Assuntos (Casos) -> Questões
// ─────────────────────────────────────────────────────────────────────────────
interface CasoGroup {
  nome: string; // Assunto = "Caso"
  questoes: BancoQuestion[];
}

interface CadernoItem {
  id: string;
  nome: string; // Tópico = "Caderno"
  materia: string;
  casos: CasoGroup[];
  questoes: BancoQuestion[];
}

interface MateriaGroup {
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
  "vendas": "🤝",
  "atendimento": "🎧",
  "direito": "⚖️",
  "geral": "📚",
};

function getMateriaIcon(materia: string): string {
  const norm = materia.trim().toLowerCase();
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
// Componente: QuestaoBloquinho (Idêntico ao NotionQuestionTab)
// ─────────────────────────────────────────────────────────────────────────────
function QuestaoBloquinho({
  q,
  numero,
  stats,
  isDuvida,
  onClick,
}: {
  q: BancoQuestion;
  numero: number;
  stats?: QuestionStats;
  isDuvida: boolean;
  onClick: () => void;
}) {
  const catKey = resolveCategory(q);
  const catInfo = CATEGORIES.find(c => c.key === catKey);

  const pct = stats && stats.totalAttempts > 0
    ? Math.round((stats.correctCount / stats.totalAttempts) * 100)
    : null;

  const tier: "green" | "amber" | "red" | "neutral" =
    pct === null ? "neutral" : pct >= 70 ? "green" : pct >= 40 ? "amber" : "red";

  const tierClasses = {
    green: "border-emerald-500/25 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]",
    amber: "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.09]",
    red: "border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/[0.09]",
    neutral: "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
  }[tier];

  const pctColor = { green: "#4ade80", amber: "#fbbf24", red: "#f87171", neutral: "#64748b" }[tier];
  const barColor = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", neutral: "#475569" }[tier];

  const topicText = q.tema || q.perguntaProblema || q.title || "";

  return (
    <button
      onClick={onClick}
      title={topicText || `Questão ${numero}`}
      className={`relative flex flex-col gap-1 p-2 rounded-lg border text-left transition-all shrink-0 w-[92px] ${tierClasses} active:scale-95`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[13px] font-black text-white leading-none">{numero}</span>
        {catInfo && (
          <span className="text-[8px] leading-none shrink-0" title={catInfo.label}>
            {FACE_EMOJI[catKey]}
          </span>
        )}
      </div>

      {topicText && (
        <span className="text-[8px] text-slate-500 truncate leading-tight">
          — {topicText}
        </span>
      )}

      {pct !== null ? (
        <div className="flex flex-col gap-0.5 mt-0.5">
          <span className="text-[8px] font-black tabular-nums" style={{ color: pctColor }}>
            {pct}%
          </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Componente: QuestaoRowItem (Linha com design 100% igual ao Notion)
// ─────────────────────────────────────────────────────────────────────────────
function QuestaoRowItem({
  questao,
  numero,
  stats,
  isDuvida,
  onOpenResolver,
}: {
  questao: BancoQuestion;
  numero: number;
  stats?: QuestionStats;
  isDuvida: boolean;
  onOpenResolver: () => void;
}) {
  const catKey = resolveCategory(questao);
  const categoryInfo = CATEGORIES.find(c => c.key === catKey);
  const catLabel = categoryInfo?.label || "Média";
  const catColor = categoryInfo?.textColor || "#c69238";

  const isErro = stats?.isCorrect === false;
  const isAcerto = stats?.isCorrect === true;

  const diffBgClasses: Record<string, string> = {
    faceis: "bg-[#0b1612]/60 hover:bg-[#0f1d18]",
    lacuna: "bg-[#0b1612]/60 hover:bg-[#0f1d18]",
    media: "bg-[#16120b]/60 hover:bg-[#1d180f]",
    atencao: "bg-[#0b1216]/60 hover:bg-[#0f181d]",
    dificil: "bg-[#160b0d]/60 hover:bg-[#1d0f11]",
    ultrahard: "bg-[#120b16]/60 hover:bg-[#180f1d]",
    bonus: "bg-[#120b16]/60 hover:bg-[#180f1d]",
  };
  const bgClass = diffBgClasses[catKey] || "hover:bg-white/[0.03]";

  return (
    <div
      onClick={onOpenResolver}
      className={`flex items-center gap-2 py-1 px-2.5 transition-colors duration-150 rounded-lg group cursor-pointer select-none ${bgClass}`}
    >
      {/* Botão indicador */}
      <span className="text-slate-500 hover:text-slate-300 transition-colors w-4 h-4 flex items-center justify-center shrink-0">
        <Play size={10} className="fill-current text-slate-500 group-hover:text-indigo-400" />
      </span>

      {/* Número da questão */}
      <span className="text-[11px] font-normal text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md shrink-0 tabular-nums">
        {numero}
      </span>

      {/* Bolinha com cor da dificuldade */}
      <span
        className="w-2 h-2 rounded-full shrink-0 select-none shadow-sm"
        style={{ backgroundColor: catColor }}
        title={catLabel}
      />

      {/* Pill com nome da categoria */}
      <span
        className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-black/20 border border-white/[0.06] shrink-0"
        style={{ color: catColor }}
      >
        {catLabel}
      </span>

      {/* Tópico / Enunciado resumido */}
      <span className="text-[12px] sm:text-[13px] font-normal text-slate-300 leading-relaxed truncate ml-0.5 flex-1 min-w-0">
        — {questao.perguntaProblema || questao.title}
      </span>

      {/* Indicador de Dúvida */}
      {isDuvida && (
        <Flag size={11} className="fill-red-500 text-red-500 shrink-0 ml-1" />
      )}

      {/* Indicador de Status Acerto / Erro */}
      {isErro && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-rose-300 bg-rose-950/50 border border-rose-700/60 shrink-0 ml-auto">
          <span className="w-2 h-2 rounded-full bg-rose-500 border border-rose-400/50 shrink-0 shadow-sm shadow-rose-500/50" />
          Errou
        </span>
      )}
      {isAcerto && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-700/60 shrink-0 ml-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-400/50 shrink-0 shadow-sm shadow-emerald-500/50" />
          Acertou
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CasoAccordion (Caso com Gabarito em timeline, bloquinhos e lista)
// ─────────────────────────────────────────────────────────────────────────────
function CasoAccordion({
  caso,
  index,
  userAnswers,
  duvidas,
  onOpenQuestion,
  allCadernoQuestions,
}: {
  caso: CasoGroup;
  index: number;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  allCadernoQuestions: BancoQuestion[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"bloquinhos" | "lista">("bloquinhos");

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
      ? "border-slate-800 text-slate-500 bg-slate-900/60"
      : stats.pct >= 70
      ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
      : stats.pct >= 50
      ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
      : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

  return (
    <div className="relative flex flex-col gap-2">
      {/* Botão do Caso */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="relative z-10 w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border border-white/[0.06] bg-[#111623] hover:border-white/[0.14] transition-all text-left group"
      >
        <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">
          📁
        </span>
        <span className="flex-1 text-[11px] font-bold text-slate-200 truncate">
          {index + 1}. {caso.nome || "Geral"}
        </span>

        {/* Stats inline */}
        <div className="flex items-center gap-1.5 text-[10px] shrink-0 tabular-nums">
          <span className="text-slate-400">{stats.total} quest.</span>
          <span className="text-emerald-400 flex items-center gap-0.5">
            <Check size={10} />
            {stats.acertos}
          </span>
          <span className="text-rose-400 flex items-center gap-0.5">
            <X size={10} />
            {stats.erros}
          </span>
          <span className="text-amber-400 flex items-center gap-0.5">
            <Flag size={9} />
            {stats.duvidasCount}
          </span>
          <span className={`px-1.5 py-0.5 rounded border text-[9px] ${aproveitamentoClasses}`}>
            {stats.pct === null ? "—" : `${stats.pct}%`}
          </span>
        </div>

        <ChevronDown
          size={13}
          className={`text-slate-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Conteúdo do Caso expandido */}
      {isOpen && (
        <div className="pl-9 pb-2 flex flex-col gap-2.5 animate-in fade-in duration-150">
          {/* Alternador de exibição (Bloquinhos / Lista) */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Questões ({caso.questoes.length})
            </span>
            <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[0.05]">
              <button
                onClick={(e) => { e.stopPropagation(); setViewMode("bloquinhos"); }}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === "bloquinhos" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Bloquinhos
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setViewMode("lista"); }}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === "lista" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {/* Modo Bloquinhos */}
          {viewMode === "bloquinhos" ? (
            <div className="flex flex-wrap gap-1.5">
              {caso.questoes.map((q, qIdx) => (
                <QuestaoBloquinho
                  key={q.id}
                  q={q}
                  numero={qIdx + 1}
                  stats={userAnswers[String(q.id)]}
                  isDuvida={duvidas.has(String(q.id))}
                  onClick={() => onOpenQuestion(q, caso.questoes)}
                />
              ))}
            </div>
          ) : (
            /* Modo Lista de Linhas */
            <div className="flex flex-col gap-1">
              {caso.questoes.map((q, qIdx) => (
                <QuestaoRowItem
                  key={q.id}
                  questao={q}
                  numero={qIdx + 1}
                  stats={userAnswers[String(q.id)]}
                  isDuvida={duvidas.has(String(q.id))}
                  onOpenResolver={() => onOpenQuestion(q, caso.questoes)}
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
// Componente: CadernoCardItem (Card idêntico ao BlocoCard / NotionBlockRowItem)
// ─────────────────────────────────────────────────────────────────────────────
function CadernoCardItem({
  caderno,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onSelectDedicated,
}: {
  caderno: CadernoItem;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onSelectDedicated: () => void;
}) {
  const [open, setOpen] = useState(false);

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

  const aproveitamentoClasses =
    stats.pct === null
      ? "border-slate-800 text-slate-500 bg-slate-900/60"
      : stats.pct >= 70
      ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
      : stats.pct >= 50
      ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
      : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

  return (
    <div className="flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-xl border transition-all bg-[#111623]/90 border-white/[0.06] hover:border-white/[0.12] shadow-sm">
      {/* Header do Card */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 flex-nowrap whitespace-nowrap overflow-hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 text-left transition-all flex-1 min-w-0 group flex-nowrap whitespace-nowrap overflow-hidden"
        >
          <span className="text-[9px] text-slate-500 w-3.5 h-3.5 flex items-center justify-center shrink-0 select-none">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-sm shrink-0 select-none">📝</span>
          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap whitespace-nowrap overflow-hidden">
            <span className="text-[12px] sm:text-[13px] font-normal transition-colors truncate shrink-0 text-slate-400 group-hover:text-slate-200">
              {caderno.nome}
            </span>
            <span className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-wide truncate">
              {caderno.materia}
            </span>
          </div>
        </button>

        {/* Stats compactas à direita */}
        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap whitespace-nowrap">
          <span className="text-[10px] font-normal text-slate-400 font-sans">{stats.total} quest.</span>
          <span className="text-emerald-400/90 flex items-center gap-0.5 font-sans" title="Total de acertos">
            <Check size={11} className="text-emerald-400/80 stroke-[2]" />
            {stats.acertos}
          </span>
          <span className="text-rose-400/90 flex items-center gap-0.5 font-sans" title="Total de erros">
            <X size={11} className="text-rose-400/80 stroke-[2]" />
            {stats.erros}
          </span>
          <span className="text-amber-400/90 flex items-center gap-0.5 font-sans" title="Em dúvida">
            <Flag size={10} className="text-amber-400/80 fill-amber-400/10" />
            {stats.duvidasCount}
          </span>
          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${aproveitamentoClasses}`}>
            {stats.pct === null ? "—" : `${stats.pct}%`}
          </span>

          <button
            onClick={onSelectDedicated}
            title="Abrir visão dedicada deste caderno"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-indigo-300 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all ml-1"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Seção Desempenho por Caso (Linha do tempo vertical idêntica ao Notion) */}
      {open && (
        <div className="flex flex-col gap-2 p-3 bg-[#0d1220] rounded-xl border border-white/[0.06] mt-1">
          <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <LayoutGrid size={12} className="text-indigo-400" /> Desempenho por Caso
          </h4>

          <div className="relative flex flex-col gap-2 pl-1">
            {/* Linha do tempo vertical conectando os casos */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/[0.07]" />

            {caderno.casos.map((caso, idx) => (
              <CasoAccordion
                key={caso.nome}
                caso={caso}
                index={idx}
                userAnswers={userAnswers}
                duvidas={duvidas}
                onOpenQuestion={onOpenQuestion}
                allCadernoQuestions={caderno.questoes}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CadernoDedicatedView (Tela focada no Caderno Selecionado)
// ─────────────────────────────────────────────────────────────────────────────
function CadernoDedicatedView({
  caderno,
  onBack,
  userAnswers,
  duvidas,
  onOpenQuestion,
  onTrainAll,
}: {
  caderno: CadernoItem;
  onBack: () => void;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onOpenQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onTrainAll: () => void;
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
              className={`px-1.5 py-0.2 rounded border text-[10px] font-bold ${
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
          Filtrar casos e questões:
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

      {/* Lista de Casos do Caderno */}
      <div className="flex flex-col gap-2 p-3 bg-[#0d1220] rounded-xl border border-white/[0.06]">
        <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
          <LayoutGrid size={12} className="text-indigo-400" /> Desempenho por Caso
        </h4>

        <div className="relative flex flex-col gap-2 pl-1">
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/[0.07]" />

          {casosFiltrados.map((caso, idx) => (
            <CasoAccordion
              key={caso.nome}
              caso={caso}
              index={idx}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onOpenQuestion={onOpenQuestion}
              allCadernoQuestions={caderno.questoes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal: CadernosTab (Design idêntico ao NotionQuestionTab)
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
}: CadernosTabProps) {
  const [selectedCaderno, setSelectedCaderno] = useState<CadernoItem | null>(null);
  const [cadernoFiltro, setCadernoFiltro] = useState("Todos");
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");
  const [statusFiltro, setStatusFiltro] = useState<"todas" | "erros" | "mais_erros" | "nao_feitas" | "duvidas">("todas");
  const [search, setSearch] = useState("");

  // Estado do Modal de Resolução (exatamente igual à Questão Ativa)
  const [modalQuestion, setModalQuestion] = useState<BancoQuestion | null>(null);
  const [modalQueue, setModalQueue] = useState<BancoQuestion[]>([]);
  const [modalIndex, setModalIndex] = useState(0);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  // ── Agrupamento estruturado: Matéria -> Cadernos -> Casos -> Questões ─────
  const { materiasAgrupadas, todosCadernos } = useMemo(() => {
    const materiaMap = new Map<string, Map<string, Map<string, BancoQuestion[]>>>();

    for (const q of questions) {
      const materia = (q.materia || (q as any).Disciplina || (q as any).disciplina || "Geral").trim();
      const rawTopico = ((q as any).topico || (q as any)["Tópico"] || q.tema || (q as any).PROVA || "Caderno Geral").trim();
      const rawAssunto = ((q as any).assunto || (q as any)["Assunto"] || (q as any)["Pergunta problema"] || "Caso Geral").trim();

      if (!materiaMap.has(materia)) materiaMap.set(materia, new Map());
      const topicoMap = materiaMap.get(materia)!;

      if (!topicoMap.has(rawTopico)) topicoMap.set(rawTopico, new Map());
      const assuntoMap = topicoMap.get(rawTopico)!;

      if (!assuntoMap.has(rawAssunto)) assuntoMap.set(rawAssunto, []);
      assuntoMap.get(rawAssunto)!.push(q);
    }

    const materias: MateriaGroup[] = [];
    const allCadernos: CadernoItem[] = [];

    for (const [materiaNome, topicoMap] of materiaMap) {
      const cadernos: CadernoItem[] = [];
      let totalMateriaQuestoes = 0;

      for (const [topicoNome, assuntoMap] of topicoMap) {
        const casos: CasoGroup[] = [];
        const topicoQuestoes: BancoQuestion[] = [];

        for (const [assuntoNome, qs] of assuntoMap) {
          casos.push({ nome: assuntoNome, questoes: qs });
          topicoQuestoes.push(...qs);
        }

        casos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        const cadernoItem: CadernoItem = {
          id: `${materiaNome}_${topicoNome}`,
          nome: topicoNome,
          materia: materiaNome,
          casos,
          questoes: topicoQuestoes,
        };

        cadernos.push(cadernoItem);
        allCadernos.push(cadernoItem);
        totalMateriaQuestoes += topicoQuestoes.length;
      }

      cadernos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      materias.push({
        nome: materiaNome,
        icone: getMateriaIcon(materiaNome),
        cadernos,
        totalQuestoes: totalMateriaQuestoes,
      });
    }

    materias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    allCadernos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return { materiasAgrupadas: materias, todosCadernos: allCadernos };
  }, [questions]);

  // Lista de matérias para filtros
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

  // Filtro de cadernos
  const cadernosFiltrados = useMemo(() => {
    let list = todosCadernos;

    if (materiaFiltro !== "Todas") {
      list = list.filter(c => c.materia === materiaFiltro);
    }

    if (cadernoFiltro !== "Todos") {
      list = list.filter(c => c.nome === cadernoFiltro);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(term) ||
        c.materia.toLowerCase().includes(term) ||
        c.casos.some(a => a.nome.toLowerCase().includes(term))
      );
    }

    if (statusFiltro !== "todas") {
      list = list.filter(c => {
        return c.questoes.some(q => {
          const st = userAnswers[String(q.id)];
          if (statusFiltro === "erros") return st && !st.isCorrect;
          if (statusFiltro === "mais_erros") return st && st.errorCount > 0;
          if (statusFiltro === "nao_feitas") return !st;
          if (statusFiltro === "duvidas") return duvidas.has(String(q.id));
          return true;
        });
      });
    }

    return list;
  }, [todosCadernos, materiaFiltro, cadernoFiltro, search, statusFiltro, userAnswers, duvidas]);

  // Manipulador de abertura de questão em modal
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

  // Se estiver na visão dedicada de um caderno
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
            handleOpenQuestionInModal(selectedCaderno.questoes[0], selectedCaderno.questoes);
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
              />
            </div>
          </div>
        )}
      </div>
    );
  }

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
      </div>

      {/* ── Barra de Filtros e Busca (Idêntica ao Notion) ── */}
      <div className="flex items-center gap-3 flex-wrap justify-between bg-[#101526] p-3 rounded-2xl border border-white/[0.08] relative z-10 shadow-xl">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Busca */}
          <div className="relative min-w-[160px] max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar caderno..."
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
            onClick={() => setStatusFiltro("duvidas")}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              statusFiltro === "duvidas" ? "bg-amber-500 text-white shadow" : "text-amber-400/70 hover:text-amber-300"
            }`}
          >
            ⚑ Dúvidas
          </button>
        </div>
      </div>

      {/* ── Lista de Cadernos (Blocos) ── */}
      {cadernosFiltrados.length === 0 ? (
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
        <div className="flex flex-col gap-2 relative z-10">
          {cadernosFiltrados.map((caderno) => (
            <CadernoCardItem
              key={caderno.id}
              caderno={caderno}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onOpenQuestion={handleOpenQuestionInModal}
              onSelectDedicated={() => setSelectedCaderno(caderno)}
            />
          ))}
        </div>
      )}

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
            />
          </div>
        </div>
      )}
    </div>
  );
}
