"use client";

import { useState, useMemo, useCallback } from "react";
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
  Maximize2
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";

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
interface AssuntoGroup {
  nome: string; // Assunto = "Caso"
  questoes: BancoQuestion[];
}

interface CadernoTopico {
  nome: string; // Tópico = "Caderno"
  materia: string;
  assuntos: AssuntoGroup[];
  questoes: BancoQuestion[];
}

interface MateriaGroup {
  nome: string;
  icone: string;
  cadernos: CadernoTopico[];
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

// ─────────────────────────────────────────────────────────────────────────────
// Componente: QuestaoRowItem (Visão no estilo Notion para cada questão do caso)
// ─────────────────────────────────────────────────────────────────────────────
function QuestaoRowItem({
  questao,
  index,
  stats,
  isDuvida,
  onToggleDuvida,
  onAnswer,
  onOpenResolver,
  user,
  onShowAuth,
}: {
  questao: BancoQuestion;
  index: number;
  stats?: QuestionStats;
  isDuvida: boolean;
  onToggleDuvida?: (id: any) => Promise<void>;
  onAnswer?: (id: any, answer: string, isCorrect: boolean) => Promise<void>;
  onOpenResolver: () => void;
  user: any;
  onShowAuth: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(stats?.lastAnswer || null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [showGabarito, setShowGabarito] = useState(false);

  const isAcerto = stats?.isCorrect === true;
  const isErro = stats?.isCorrect === false;

  const alternativas = useMemo(() => {
    const list: { letter: string; text: string }[] = [];
    ["A", "B", "C", "D", "E"].forEach((letter) => {
      const text =
        (questao as any)[`Alternativa ${letter}`] ||
        (questao as any)[`alternativa_${letter.toLowerCase()}`];
      if (text) list.push({ letter, text });
    });
    return list;
  }, [questao]);

  const gabaritoOficial = (questao.Gabarito || questao.respostaCorreta || "").trim().toUpperCase();

  const handleSelectOption = async (letter: string) => {
    if (!user) {
      onShowAuth();
      return;
    }
    if (isAnswering) return;
    setSelectedLetter(letter);

    const isCorrect = letter.toUpperCase() === gabaritoOficial;
    if (onAnswer) {
      setIsAnswering(true);
      try {
        await onAnswer(questao.id, letter, isCorrect);
      } finally {
        setIsAnswering(false);
      }
    }
  };

  const dificuldadeColor = {
    Fácil: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Facil: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Média: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Media: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Difícil: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    Dificil: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  }[questao.dificuldade || ""] || "text-slate-400 bg-white/[0.03] border-white/[0.06]";

  return (
    <div className="flex flex-col border border-white/[0.06] rounded-xl bg-[#0c1222]/70 overflow-hidden transition-all hover:border-white/[0.12]">
      {/* Linha Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2.5 transition-colors group">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors w-4 h-4 flex items-center justify-center shrink-0"
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-150 ${open ? "rotate-90 text-slate-300" : ""}`}
          />
        </button>

        <span className="text-[11px] font-mono font-bold text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md shrink-0">
          Q{index + 1}
        </span>

        {questao.dificuldade && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${dificuldadeColor}`}>
            {questao.dificuldade}
          </span>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left text-[12px] text-slate-300 hover:text-white transition-colors truncate"
        >
          {questao.perguntaProblema || questao.title || "Sem enunciado"}
        </button>

        {/* Indicador de Acerto / Erro */}
        {isAcerto && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Acertou
          </span>
        )}
        {isErro && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-300 bg-rose-950/50 border border-rose-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Errou
          </span>
        )}

        {/* Botão de Dúvida */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!user) {
              onShowAuth();
              return;
            }
            onToggleDuvida?.(questao.id);
          }}
          title={isDuvida ? "Marcada como dúvida (clique para remover)" : "Marcar como dúvida"}
          className={`p-1.5 rounded-lg border transition-all shrink-0 ${
            isDuvida
              ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
              : "bg-white/[0.02] border-transparent text-slate-600 hover:text-amber-400 hover:bg-white/[0.05]"
          }`}
        >
          <Flag size={11} className={isDuvida ? "fill-amber-400" : ""} />
        </button>

        {/* Botão para abrir no QuestionResolver dedicado */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenResolver();
          }}
          title="Abrir no modo focado"
          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 hover:text-white transition-all shrink-0"
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {/* Conteúdo Expandido (Enunciado + Alternativas + Comentário) */}
      {open && (
        <div className="p-4 pt-2 border-t border-white/[0.06] bg-[#090e1a]/80 space-y-4">
          {/* Texto de apoio se existir */}
          {questao["Texto de apoio"] && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-slate-400 leading-relaxed italic">
              <span className="text-[10px] font-bold text-slate-500 uppercase not-italic block mb-1">
                Texto de Apoio:
              </span>
              {questao["Texto de apoio"]}
            </div>
          )}

          {/* Enunciado Completo */}
          <div className="text-[13px] text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
            {questao.title}
          </div>

          {/* Imagem do enunciado se houver */}
          {questao.imagemEnunciado && (
            <div className="max-w-2xl rounded-xl overflow-hidden border border-white/[0.08]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={questao.imagemEnunciado}
                alt="Enunciado"
                className="w-full h-auto object-contain bg-white"
              />
            </div>
          )}

          {/* Alternativas A, B, C, D, E */}
          {alternativas.length > 0 && (
            <div className="space-y-2 pt-1">
              {alternativas.map(({ letter, text }) => {
                const isSelected = selectedLetter === letter;
                const isCorrectOption = letter.toUpperCase() === gabaritoOficial;
                const answered = !!stats || selectedLetter !== null;

                let optStyle = "bg-[#0c1222] border-white/[0.07] text-slate-300 hover:border-white/[0.2] hover:bg-[#11192e]";

                if (answered) {
                  if (isCorrectOption) {
                    optStyle = "bg-emerald-950/40 border-emerald-500/50 text-emerald-200";
                  } else if (isSelected && !isCorrectOption) {
                    optStyle = "bg-rose-950/40 border-rose-500/50 text-rose-200";
                  } else {
                    optStyle = "bg-[#0c1222]/50 border-white/[0.04] text-slate-500 opacity-60";
                  }
                }

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelectOption(letter)}
                    disabled={isAnswering}
                    className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all active:scale-[0.99] ${optStyle}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border ${
                        answered && isCorrectOption
                          ? "bg-emerald-500 text-white border-emerald-400"
                          : answered && isSelected && !isCorrectOption
                          ? "bg-rose-500 text-white border-rose-400"
                          : "bg-white/[0.05] border-white/[0.1] text-slate-300"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-[12px] leading-relaxed flex-1 pt-0.5">{text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Gabarito e Comentário Revelável */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGabarito((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-slate-300 transition-all"
              >
                {showGabarito ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showGabarito ? "Ocultar Gabarito" : "✨ Ver Gabarito & Comentário"}</span>
              </button>

              {stats && (
                <span className="text-[10px] text-slate-500 ml-auto">
                  {stats.totalAttempts} tentativa(s) · {stats.correctCount} acerto(s)
                </span>
              )}
            </div>

            {showGabarito && (
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-blue-500/20 space-y-2 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Gabarito Oficial:
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 font-black text-emerald-400 text-xs">
                    {gabaritoOficial || "Não informado"}
                  </span>
                </div>
                {(questao.explicacao || questao.comentario || (questao as any)["Comentário"]) && (
                  <div className="pt-1 text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-white/[0.06]">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">
                      Comentário do Professor:
                    </span>
                    {questao.explicacao || questao.comentario || (questao as any)["Comentário"]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: AssuntoAccordion (Caso / Bloco de agrupamento)
// ─────────────────────────────────────────────────────────────────────────────
function AssuntoAccordion({
  assunto,
  userAnswers,
  duvidas,
  onSelectQuestion,
  onAnswer,
  onToggleDuvida,
  user,
  onShowAuth,
}: {
  assunto: AssuntoGroup;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onSelectQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onAnswer?: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (questaoId: any) => Promise<void>;
  user: any;
  onShowAuth: () => void;
}) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let duvidasCount = 0;

    assunto.questoes.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) {
        if (st.isCorrect) acertos++;
        else erros++;
      }
      if (duvidas.has(String(q.id))) duvidasCount++;
    });

    const total = assunto.questoes.length;
    const respondidas = acertos + erros;
    const aproveitamento = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, aproveitamento };
  }, [assunto.questoes, userAnswers, duvidas]);

  return (
    <div className="flex flex-col border border-white/[0.07] rounded-xl overflow-hidden bg-[#090d18]/60">
      {/* Header do Caso / Assunto */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-slate-500 text-xs w-4 flex items-center justify-center">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="text-sm shrink-0">📁</span>
          <span className="text-[12.5px] font-medium text-slate-300 truncate">
            {assunto.nome || "Geral"}
          </span>
        </div>

        {/* Stats inline do caso */}
        <div className="flex items-center gap-2 shrink-0 text-[10px] tabular-nums">
          <span className="text-slate-400">{stats.total} quest.</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
            <Check size={10} />
            {stats.acertos}
          </span>
          <span className="text-rose-400 font-semibold flex items-center gap-0.5">
            <X size={10} />
            {stats.erros}
          </span>
          <span className="text-amber-400 font-semibold flex items-center gap-0.5">
            <Flag size={9} />
            {stats.duvidasCount}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
              stats.aproveitamento === null
                ? "border-slate-800 text-slate-500 bg-slate-900/60"
                : stats.aproveitamento >= 70
                ? "border-slate-800 text-emerald-400 bg-slate-900/60"
                : stats.aproveitamento >= 50
                ? "border-slate-800 text-amber-400 bg-slate-900/60"
                : "border-slate-800 text-rose-400 bg-slate-900/60"
            }`}
          >
            {stats.aproveitamento === null ? "—" : `${stats.aproveitamento}%`}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!user) {
                onShowAuth();
                return;
              }
              onSelectQuestion(assunto.questoes[0], assunto.questoes);
            }}
            title="Resolver este caso"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition-all ml-1"
          >
            <Play size={9} /> Treinar
          </button>
        </div>
      </div>

      {/* Lista de Questões do Caso */}
      {open && (
        <div className="p-2 sm:p-3 space-y-1.5 border-t border-white/[0.05] bg-[#070b14]/70">
          {assunto.questoes.map((q, idx) => (
            <QuestaoRowItem
              key={q.id}
              questao={q}
              index={idx}
              stats={userAnswers[String(q.id)]}
              isDuvida={duvidas.has(String(q.id))}
              onToggleDuvida={onToggleDuvida}
              onAnswer={onAnswer}
              onOpenResolver={() => onSelectQuestion(q, assunto.questoes)}
              user={user}
              onShowAuth={onShowAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CadernoDetalheView (Tela interna ao clicar em um caderno)
// ─────────────────────────────────────────────────────────────────────────────
function CadernoDetalheView({
  caderno,
  onBack,
  userAnswers,
  duvidas,
  onSelectQuestion,
  onAnswer,
  onToggleDuvida,
  user,
  onShowAuth,
}: {
  caderno: CadernoTopico;
  onBack: () => void;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onSelectQuestion: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onAnswer?: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (questaoId: any) => Promise<void>;
  user: any;
  onShowAuth: () => void;
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
    const pendentes = total - respondidas;
    const aproveitamento = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, pendentes, aproveitamento };
  }, [caderno.questoes, userAnswers, duvidas]);

  const assuntosFiltrados = useMemo(() => {
    if (filtroStatus === "todas") return caderno.assuntos;

    return caderno.assuntos
      .map((a) => {
        const filteredQs = a.questoes.filter((q) => {
          const st = userAnswers[String(q.id)];
          if (filtroStatus === "erros") return st && !st.isCorrect;
          if (filtroStatus === "nao_feitas") return !st;
          if (filtroStatus === "duvidas") return duvidas.has(String(q.id));
          return true;
        });
        return { ...a, questoes: filteredQs };
      })
      .filter((a) => a.questoes.length > 0);
  }, [caderno.assuntos, filtroStatus, userAnswers, duvidas]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Barra de Topo do Caderno Selecionado */}
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
                {caderno.assuntos.length} caso(s) · {caderno.questoes.length} questões
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
                stats.aproveitamento === null
                  ? "text-slate-500 border-slate-800 bg-slate-900"
                  : stats.aproveitamento >= 70
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : stats.aproveitamento >= 50
                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  : "text-rose-400 border-rose-500/30 bg-rose-500/10"
              }`}
            >
              {stats.aproveitamento === null ? "—" : `${stats.aproveitamento}%`}
            </span>
          </div>

          <button
            onClick={() => {
              if (!user) {
                onShowAuth();
                return;
              }
              onSelectQuestion(caderno.questoes[0], caderno.questoes);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-600/20"
          >
            <Play size={12} /> Resolver Caderno
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Questões no Caderno */}
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

      {/* Lista dos Casos (Assuntos) */}
      {assuntosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 bg-[#101526]/80 rounded-2xl border border-white/[0.06] text-slate-500">
          <p className="text-xs font-bold">Nenhum caso ou questão atende a este filtro.</p>
          <button
            onClick={() => setFiltroStatus("todas")}
            className="text-[11px] text-indigo-400 font-bold hover:underline"
          >
            Ver todas as questões
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {assuntosFiltrados.map((assunto) => (
            <AssuntoAccordion
              key={assunto.nome}
              assunto={assunto}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onSelectQuestion={onSelectQuestion}
              onAnswer={onAnswer}
              onToggleDuvida={onToggleDuvida}
              user={user}
              onShowAuth={onShowAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: CadernoRowItem (Linha idêntica à do print da imagem enviada)
// ─────────────────────────────────────────────────────────────────────────────
function CadernoRowItem({
  caderno,
  userAnswers,
  duvidas,
  onSelect,
  onQuickPlay,
}: {
  caderno: CadernoTopico;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onSelect: () => void;
  onQuickPlay: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

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
    const aproveitamento = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : null;

    return { total, acertos, erros, duvidasCount, respondidas, aproveitamento };
  }, [caderno.questoes, userAnswers, duvidas]);

  const aproveitamentoClasses =
    stats.aproveitamento === null
      ? "border-slate-800 text-slate-500 bg-slate-900/60"
      : stats.aproveitamento >= 70
      ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
      : stats.aproveitamento >= 50
      ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
      : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

  return (
    <div className="relative flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl border border-white/[0.06] bg-[#111623]/90 hover:border-white/[0.12] hover:bg-[#151c2d] transition-all group">
      {/* Esquerda: Seta + Ícone + Nome do Caderno */}
      <button
        onClick={onSelect}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
      >
        <span className="text-[11px] text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0">
          →
        </span>
        <span className="text-sm shrink-0">📝</span>
        <span className="text-[12.5px] sm:text-[13px] font-normal text-slate-300 group-hover:text-white transition-colors truncate">
          {caderno.nome}
        </span>
      </button>

      {/* Direita: Estatísticas com formatação exata do print */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-[10px] tabular-nums font-mono">
        <span className="text-slate-400 font-sans">{stats.total} quest.</span>

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

        {/* Badge com a porcentagem */}
        <span
          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${aproveitamentoClasses}`}
          title="Aproveitamento no caderno"
        >
          {stats.aproveitamento === null ? "—" : `${stats.aproveitamento}%`}
        </span>

        {/* Menu de 3 pontinhos */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            title="Ações do Caderno"
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
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div
                className="absolute right-0 top-full mt-1.5 w-48 z-50 bg-[#111623] border border-white/[0.12] rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSelect();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors text-left"
                >
                  <BookOpen size={12} className="text-indigo-400" /> Abrir Casos
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onQuickPlay();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors text-left"
                >
                  <Play size={12} className="text-emerald-400" /> Resolver Todas
                </button>
              </div>
            </>
          )}
        </div>
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
}: CadernosTabProps) {
  const [selectedCaderno, setSelectedCaderno] = useState<CadernoTopico | null>(null);
  const [search, setSearch] = useState("");
  const [materiaFiltro, setMateriaFiltro] = useState("Todas");

  // ── Agrupamento: Matéria -> Tópicos -> Assuntos -> Questões ─────────────
  const materiasAgrupadas = useMemo<MateriaGroup[]>(() => {
    const materiaMap = new Map<string, Map<string, Map<string, BancoQuestion[]>>>();

    for (const q of questions) {
      const materia = (q.materia || (q as any).Disciplina || (q as any).disciplina || "Geral").trim();
      const rawTopico = ((q as any).topico || (q as any)["Tópico"] || q.tema || "Geral").trim();
      const rawAssunto = ((q as any).assunto || (q as any)["Assunto"] || "Geral").trim();

      if (!materiaMap.has(materia)) materiaMap.set(materia, new Map());
      const topicoMap = materiaMap.get(materia)!;

      if (!topicoMap.has(rawTopico)) topicoMap.set(rawTopico, new Map());
      const assuntoMap = topicoMap.get(rawTopico)!;

      if (!assuntoMap.has(rawAssunto)) assuntoMap.set(rawAssunto, []);
      assuntoMap.get(rawAssunto)!.push(q);
    }

    const result: MateriaGroup[] = [];

    for (const [materiaNome, topicoMap] of materiaMap) {
      const cadernos: CadernoTopico[] = [];
      let totalMateriaQuestoes = 0;

      for (const [topicoNome, assuntoMap] of topicoMap) {
        const assuntos: AssuntoGroup[] = [];
        const topicoQuestoes: BancoQuestion[] = [];

        for (const [assuntoNome, qs] of assuntoMap) {
          assuntos.push({ nome: assuntoNome, questoes: qs });
          topicoQuestoes.push(...qs);
        }

        assuntos.sort((a, b) => a.nome.localeCompare(b.nome));
        cadernos.push({
          nome: topicoNome,
          materia: materiaNome,
          assuntos,
          questoes: topicoQuestoes,
        });

        totalMateriaQuestoes += topicoQuestoes.length;
      }

      cadernos.sort((a, b) => a.nome.localeCompare(b.nome));

      result.push({
        nome: materiaNome,
        icone: getMateriaIcon(materiaNome),
        cadernos,
        totalQuestoes: totalMateriaQuestoes,
      });
    }

    result.sort((a, b) => a.nome.localeCompare(b.nome));
    return result;
  }, [questions]);

  // Lista de matérias para filtro
  const listaMaterias = useMemo(
    () => ["Todas", ...materiasAgrupadas.map((m) => m.nome)],
    [materiasAgrupadas]
  );

  // Filtragem
  const materiasFiltradas = useMemo(() => {
    return materiasAgrupadas
      .filter((m) => materiaFiltro === "Todas" || m.nome === materiaFiltro)
      .map((m) => {
        if (!search.trim()) return m;
        const term = search.toLowerCase();
        const cadernosFiltrados = m.cadernos.filter(
          (c) =>
            c.nome.toLowerCase().includes(term) ||
            c.assuntos.some((a) => a.nome.toLowerCase().includes(term))
        );
        return {
          ...m,
          cadernos: cadernosFiltrados,
        };
      })
      .filter((m) => m.cadernos.length > 0);
  }, [materiasAgrupadas, materiaFiltro, search]);

  // Se o usuário selecionou um caderno, exibe a visão detalhada
  if (selectedCaderno) {
    return (
      <CadernoDetalheView
        caderno={selectedCaderno}
        onBack={() => setSelectedCaderno(null)}
        userAnswers={userAnswers}
        duvidas={duvidas}
        onSelectQuestion={onSelectQuestion}
        onAnswer={onAnswer}
        onToggleDuvida={onToggleDuvida}
        user={user}
        onShowAuth={onShowAuth}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de Filtros Superior */}
      <div className="flex items-center gap-3 flex-wrap justify-between bg-[#101526] p-3 rounded-2xl border border-white/[0.08] relative z-10 shadow-xl">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Busca por texto */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar caderno ou assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0d1220] border border-white/[0.08] rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Matéria */}
          <div className="flex items-center gap-1 flex-wrap">
            {listaMaterias.map((m) => (
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
      </div>

      {/* Grid de Cards de Matérias (idêntico ao layout da imagem enviada) */}
      {materiasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-[#101526]/80 border border-white/[0.06] rounded-2xl relative z-10">
          <BookOpen size={32} className="text-slate-700" />
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">
            Nenhum caderno encontrado
          </p>
          <button
            onClick={() => {
              setSearch("");
              setMateriaFiltro("Todas");
            }}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {materiasFiltradas.map((materia) => {
            // Cálculos da matéria
            let matAcertos = 0;
            let matErros = 0;
            let matDuvidas = 0;
            let matTotalQ = 0;

            materia.cadernos.forEach((c) => {
              matTotalQ += c.questoes.length;
              c.questoes.forEach((q) => {
                const st = userAnswers[String(q.id)];
                if (st) {
                  if (st.isCorrect) matAcertos++;
                  else matErros++;
                }
                if (duvidas.has(String(q.id))) matDuvidas++;
              });
            });

            const matRespondidas = matAcertos + matErros;
            const matAproveitamento =
              matRespondidas > 0 ? Math.round((matAcertos / matRespondidas) * 100) : null;

            const matAproveitamentoClasses =
              matAproveitamento === null
                ? "border-slate-800 text-slate-500 bg-slate-900/60"
                : matAproveitamento >= 70
                ? "border-slate-800 text-emerald-400/90 bg-slate-900/60 font-medium"
                : matAproveitamento >= 50
                ? "border-slate-800 text-amber-400/90 bg-slate-900/60 font-medium"
                : "border-slate-800 text-rose-400/90 bg-slate-900/60 font-medium";

            return (
              <div
                key={materia.nome}
                className="flex flex-col bg-[#101526]/90 border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xl gap-3 transition-all hover:border-white/[0.12]"
              >
                {/* 1. Header da Matéria (Ícone + Título em CAIXA ALTA) */}
                <div className="flex flex-col gap-1.5 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{materia.icone}</span>
                    <h2 className="text-[14px] font-black text-slate-200 uppercase tracking-wider">
                      {materia.nome}
                    </h2>
                  </div>

                  {/* Subheader: X quest. ✓ Y ✕ Z ⚑ W [86%] [7 cadernos] */}
                  <div className="flex items-center gap-2.5 text-[11px] font-mono tabular-nums flex-wrap">
                    <span className="text-slate-400 font-sans">{matTotalQ} quest.</span>

                    <span className="text-emerald-400/90 flex items-center gap-0.5 font-sans" title="Total de acertos na matéria">
                      <Check size={11} className="text-emerald-400/80 stroke-[2]" />
                      {matAcertos}
                    </span>

                    <span className="text-rose-400/90 flex items-center gap-0.5 font-sans" title="Total de erros na matéria">
                      <X size={11} className="text-rose-400/80 stroke-[2]" />
                      {matErros}
                    </span>

                    <span className="text-amber-400/90 flex items-center gap-0.5 font-sans" title="Dúvidas marcadas">
                      <Flag size={10} className="text-amber-400/80 fill-amber-400/10" />
                      {matDuvidas}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${matAproveitamentoClasses}`}
                      title="Aproveitamento na matéria"
                    >
                      {matAproveitamento === null ? "—" : `${matAproveitamento}%`}
                    </span>

                    <span className="text-[10px] text-slate-400 font-mono bg-white/[0.03] px-2 py-0.5 rounded-lg border border-white/[0.05]">
                      {materia.cadernos.length} caderno{materia.cadernos.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* 2. Lista de Cadernos (linhas horizontais idênticas ao print) */}
                <div className="flex flex-col gap-1.5">
                  {materia.cadernos.map((caderno) => (
                    <CadernoRowItem
                      key={caderno.nome}
                      caderno={caderno}
                      userAnswers={userAnswers}
                      duvidas={duvidas}
                      onSelect={() => setSelectedCaderno(caderno)}
                      onQuickPlay={() => {
                        if (!user) {
                          onShowAuth();
                          return;
                        }
                        onSelectQuestion(caderno.questoes[0], caderno.questoes);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
