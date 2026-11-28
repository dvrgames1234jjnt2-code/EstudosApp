"use client";

import React from "react";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Sparkles,
  BookOpen,
  Target,
  ArrowLeft,
  Loader2,
  AlertCircle,
  BrainCircuit,
  MessageSquare,
  LayoutGrid,
  ChevronDown,
  RotateCcw,
  History,
  BarChart3,
  Flame,
  Volume2,
  FileText,
  Printer,
  ExternalLink,
  Pencil,
  Columns2,
  X,
  Ban,
  Check
} from "lucide-react";
import { PrintSimuladoModal } from "./PrintSimuladoModal";
import type { BancoQuestion } from "./QuestionsTable";
import { getQuestionIds, isQuestaoAnulada } from "../../lib/questionService";

interface QuestionResolverProps {
  question: BancoQuestion;
  questionIndex: number;
  totalQuestions: number;
  stats?: QuestionStats;
  resolverQueue: BancoQuestion[];
  userAnswers: Record<string, QuestionStats>;
  isDuvida?: boolean;
  onSelectQuestion: (index: number) => void;
  onAnswer: (id: any, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida?: (id: any) => void;
  onNext: () => void;
  onPrev: () => void;
  onBackToBank: () => void;
  onCutQuestion?: (id: any) => void;
  isSaving: boolean;
  provasDisponiveis?: string[];
  onSelectProva?: (prova: string) => void;
  isAdmin?: boolean;
  onEditQuestion?: (q: BancoQuestion) => void;
}

export interface QuestionStats {
  lastAnswer: string;
  isCorrect: boolean;
  totalAttempts: number;
  errorCount: number;
  correctCount: number;
  timestamp: number;
}

const LETTERS = ["A", "B", "C", "D", "E"] as const;

// ── Web Audio Synthesizer Helpers ───────────────────────────
const playSuccessSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  } catch (e) {
    // Ignore audio policy restrictions
  }
};

// ── Formatador de Matemática & Enunciado / Comentários ──────────────────────
function cleanMathLatex(text: string): string {
  if (!text) return "";

  let str = text;

  // Normaliza quebras de linha escapadas
  str = str.replace(/\\n/g, '\n');

  // Remove delimitadores $ ou $$ de LaTeX inline
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  str = str.replace(/\$([\s\S]*?)\$/g, '$1');

  // Fractions: \frac{a}{b} -> (a / b)
  str = str.replace(/\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, '($1 / $2)');

  // Square root: \sqrt[n]{x} -> ⁿ√(x), \sqrt{x} -> √(x)
  str = str.replace(/\\sqrt\[(.*?)\]\s*\{([\s\S]*?)\}/g, '$1√($2)');
  str = str.replace(/\\sqrt\s*\{([\s\S]*?)\}/g, '√($1)');

  // Math operators & symbols
  str = str.replace(/\\cdotp|\\cdot|\\times/g, '·');
  str = str.replace(/\\div/g, '÷');
  str = str.replace(/\\pm/g, '±');
  str = str.replace(/\\approx/g, '≈');
  str = str.replace(/\\neq/g, '≠');
  str = str.replace(/\\leq|\\le/g, '≤');
  str = str.replace(/\\geq|\\ge/g, '≥');
  str = str.replace(/\\infty/g, '∞');
  str = str.replace(/\\pi/g, 'π');
  str = str.replace(/\\Delta/g, 'Δ');
  str = str.replace(/\\theta/g, 'θ');
  str = str.replace(/\\alpha/g, 'α');
  str = str.replace(/\\beta/g, 'β');
  str = str.replace(/\\rightarrow|\\Rightarrow/g, '→');
  str = str.replace(/\\leftarrow|\\Leftarrow/g, '←');
  str = str.replace(/\\in/g, '∈');
  str = str.replace(/\\notin/g, '∉');
  str = str.replace(/\\subset/g, '⊂');
  str = str.replace(/\\cap|\\inter/g, '∩');
  str = str.replace(/\\cup|\\union/g, '∪');
  str = str.replace(/\\sim/g, '~');
  str = str.replace(/\\overline\{([\s\S]*?)\}/g, '$1̄');

  // Formatting environment commands
  str = str.replace(/\\begin\{(?:equation|align|math|center)\*?\}/g, '');
  str = str.replace(/\\end\{(?:equation|align|math|center)\*?\}/g, '');

  // Exponents superscripts: ^2 -> ², ^3 -> ³, ^n -> ⁿ, etc.
  str = str.replace(/\^2\b/g, '²');
  str = str.replace(/\^3\b/g, '³');
  str = str.replace(/\^1\b/g, '¹');
  str = str.replace(/\^0\b/g, '⁰');
  str = str.replace(/\^n\b/g, 'ⁿ');
  str = str.replace(/\^x\b/g, 'ˣ');
  str = str.replace(/\^\+([0-9]+)/g, '⁺$1');
  str = str.replace(/\^-([0-9]+)/g, '⁻$1');
  str = str.replace(/\^\{([\s\S]*?)\}/g, '⁽$1⁾');

  // Subscripts: _0..9 -> ₀..₉
  const subs: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'x': 'ₓ' };
  str = str.replace(/_([0-9nx])/g, (_, match) => subs[match] || `_${match}`);
  str = str.replace(/_\{([\s\S]*?)\}/g, '₍$1₎');

  // Text commands cleanup
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathrm\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathbf\{([\s\S]*?)\}/g, '$1');

  return str;
}

function formatQuestionText(text: string): React.ReactElement {
  if (!text) return <></>;

  const cleaned = cleanMathLatex(text);

  // Verifica se o texto possui marcação HTML (ex: <br>, <b>, <span>, <p>)
  const hasHtml = /<[a-z][\s\S]*>/i.test(cleaned);

  // Verifica se possui itens romanos (I., II., III., etc.)
  const hasRoman = /\b(I{1,3}V?|IV|V|VI{0,3}|IX|X)\.\s/.test(cleaned);

  if (hasRoman) {
    const parts = cleaned.split(/\b((?:X{0,3})(?:IX|IV|V?I{0,3}))\.\s/);
    const elements: React.ReactElement[] = [];

    if (parts[0].trim()) {
      elements.push(
        <span key="intro" className="block mb-3 leading-relaxed">
          {parts[0].trim()}
        </span>
      );
    }

    for (let i = 1; i + 1 < parts.length; i += 2) {
      const numeral = parts[i];
      const content = parts[i + 1];
      if (!numeral || !content) continue;
      elements.push(
        <span
          key={`item-${i}`}
          className="flex gap-2.5 py-1.5 border-l-2 border-indigo-500/20 pl-3 mb-1.5 leading-relaxed"
        >
          <span className="shrink-0 text-indigo-400 font-black text-[13px] min-w-[1.5rem]">
            {numeral}.
          </span>
          <span className="text-slate-300">{content.trimEnd()}</span>
        </span>
      );
    }

    return <>{elements}</>;
  }

  if (hasHtml) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: cleaned.replace(/\n/g, '<br/>') }}
      />
    );
  }

  return (
    <span className="whitespace-pre-line leading-relaxed">
      {cleaned}
    </span>
  );
}

const playErrorSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {
    // Ignore audio policy restrictions
  }
};

export default function QuestionResolver({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  onNext,
  onPrev,
  onBackToBank,
  onCutQuestion,
  isSaving,
  stats,
  resolverQueue,
  userAnswers,
  onSelectQuestion,
  isDuvida = false,
  onToggleDuvida,
  provasDisponiveis,
  onSelectProva,
  isAdmin,
  onEditQuestion,
}: QuestionResolverProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [showComment, setShowComment] = useState<boolean>(false);
  const [showTextoApoio, setShowTextoApoio] = useState<boolean>(false);
  const [strikethroughs, setStrikethroughs] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [splitView, setSplitView] = useState(false);

  // URL para exibição integrada do Qconcursos
  const targetQconcursosUrl =
    question.link ||
    (question.ID_Qconcursos
      ? `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${question.ID_Qconcursos}`
      : null);

  // Reset state when question changes — always start fresh visually
  useEffect(() => {
    setSelectedOption(null);
    setShowFeedback(false);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
  }, [question.id]);

  const gabarito = question.respostaCorreta || question.Gabarito || "";
  const textoApoio =
    question["Texto de apoio"] ||
    (question as any).texto_apoio ||
    (question as any).textoApoio;
  const comentarioTexto =
    question.explicacao ||
    question.comentario ||
    question["Comentário"] ||
    (question as any).Comentario;

  const isAnulada = isQuestaoAnulada(question);
  const alternativas: Record<string, string> = {};
  for (const letter of LETTERS) {
    const val = question[`Alternativa ${letter}` as keyof BancoQuestion] as string | undefined;
    if (val) alternativas[letter] = val;
  }
  const hasAlternativas = Object.keys(alternativas).length > 0;

  const handleSelect = (letter: string) => {
    if (isAnulada || showFeedback || strikethroughs[letter]) return;
    setSelectedOption(letter);
  };

  const handleConfirm = async () => {
    if (isAnulada || !selectedOption) return;
    const isCorrect = selectedOption === gabarito;
    await onAnswer(question.id, selectedOption, isCorrect);
    setShowFeedback(true);
    setShowComment(true); // Exibe o comentário automaticamente ao responder

    if (isCorrect) {
      playSuccessSound();
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#10B981", "#3B82F6", "#6366F1", "#F59E0B", "#EC4899"],
          disableForReducedMotion: true,
        });
      } catch (e) {
        // Fallback safely if confetti is blocked
      }
    } else {
      playErrorSound();
    }
  };

  const toggleStrikethrough = (letter: string) => {
    if (isAnulada || showFeedback) return;
    setStrikethroughs(prev => ({ ...prev, [letter]: !prev[letter] }));
  };

  const handleNext = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
    onNext();
  };

  const handlePrev = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
    onPrev();
  };

  const isCorrect = showFeedback && selectedOption === gabarito;
  const isWrong = showFeedback && selectedOption !== gabarito;

  return (
    <div className="flex flex-col w-full min-w-0 overflow-x-clip bg-[#0b0d12] rounded-xl border border-white/[0.08] p-2.5 sm:p-5 relative">

      <div className="w-full min-w-0 flex flex-col">

        {/* ── Top bar: progresso + navegação ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 shrink-0 px-1 sm:px-2 pb-2.5 border-b border-white/[0.08]">

          {/* Esquerda: voltar + número + prova */}
            <div className="flex items-start sm:items-center gap-2 min-w-0 w-full sm:w-auto">
            <button onClick={onBackToBank} className="text-slate-500 hover:text-white transition-colors p-2 sm:p-1 shrink-0" aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className="w-8 h-8 rounded-md bg-emerald-400/10 border border-emerald-300/20 flex items-center justify-center text-xs font-medium text-emerald-200 shrink-0">
              {questionIndex + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-[11px] font-medium text-slate-200 break-words sm:max-w-xs sm:truncate">
                {question.prova || "Simulado Padrão"}
                {question.Ano ? ` · ${question.Ano}` : ""}
              </div>
              <div className="text-[11px] sm:text-[10px] text-slate-400 sm:text-slate-500 tabular-nums flex items-center gap-1.5 flex-wrap">
                <span>ID {question.id}</span>
                {(question.Ordem ?? question.ordem) !== undefined && (question.Ordem ?? question.ordem) !== null && (
                  <span className="text-indigo-300/90">· Ordem #{question.Ordem ?? question.ordem}</span>
                )}
                {(question.Banca || question.banca) && (
                  <span className="text-slate-400">· {question.Banca || question.banca}</span>
                )}
                {isAnulada && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    <Ban size={9} />
                    Anulada
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Direita: ações */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">

            {/* Imprimir */}
            <button
              onClick={() => setShowPrintModal(true)}
              title="Imprimir / gerar PDF"
              className="min-h-[36px] sm:min-h-0 px-2.5 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-300 sm:text-slate-400 hover:text-slate-200 text-xs sm:text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
              <Printer size={13} /> Imprimir
            </button>

            {/* Histórico */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`min-h-[36px] sm:min-h-0 px-2.5 py-1.5 rounded-lg border text-xs sm:text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  showHistory
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.08] hover:bg-white/[0.04] text-slate-300 sm:text-slate-400 hover:text-slate-200"
                }`}
              >
                Histórico <ChevronDown size={11} className={showHistory ? "rotate-180" : ""} />
              </button>
              {showHistory && (
                <div
                  className="absolute top-full right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] bg-[#181f2e] border border-white/[0.08] rounded-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-white/[0.06]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Histórico desta questão</p>
                  </div>
                  {stats ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Tentativas</span>
                        <span className="text-[11px] font-semibold text-white">{stats.totalAttempts}×</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Acertos</span>
                        <span className="text-[11px] font-semibold text-emerald-400">{stats.correctCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Erros</span>
                        <span className="text-[11px] font-semibold text-rose-400">{stats.errorCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Última resposta</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          stats.isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>{stats.lastAnswer} – {stats.isCorrect ? "Certo" : "Errado"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-[12px] text-slate-500">Nenhuma resposta registrada ainda.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Progresso + Prev/Next */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 ml-auto sm:ml-0">
              <button onClick={handlePrev} disabled={questionIndex === 0} aria-label="Questão anterior" className="p-1.5 sm:p-0.5 text-slate-400 hover:text-white disabled:opacity-25 transition-colors">
                <ChevronLeft size={17} className="sm:w-[15px] sm:h-[15px]" />
              </button>
              <span className="text-xs sm:text-[11px] font-medium text-slate-300 sm:text-slate-500 tabular-nums min-w-[3rem] text-center">
                {questionIndex + 1} / {totalQuestions}
              </span>
              <button onClick={handleNext} disabled={questionIndex === totalQuestions - 1} aria-label="Próxima questão" className="p-1.5 sm:p-0.5 text-slate-400 hover:text-white disabled:opacity-25 transition-colors">
                <ChevronRight size={17} className="sm:w-[15px] sm:h-[15px]" />
              </button>
            </div>

          </div>
        </div>

        {/* ── Content / Split View Container ── */}
        <div className="flex flex-col lg:flex-row gap-4 w-full min-w-0">

          {/* Coluna Esquerda: Resolução da Questão */}
          <div className={`w-full min-w-0 ${splitView ? "lg:w-1/2" : ""}`}>
            <div className={`${splitView ? "w-full" : "w-full max-w-4xl mx-auto"} min-w-0 rounded-2xl border border-white/[0.07] bg-[#101319] p-3.5 sm:p-7 shadow-xl`}>

            {/* Barra de progresso fina */}
            <div className="h-0.5 bg-white/[0.06] rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-emerald-300/70 rounded-full"
                style={{ width: `${totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0}%` }}
              />
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-white/[0.07]">
              <span className="text-[11px] font-normal text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2.5 py-1 rounded-md">
                {question.Disciplina || question.materia || "Geral"}
              </span>
              {isAnulada && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/35 px-2.5 py-1 rounded-md">
                  <Ban size={11} />
                  Questão Anulada
                </span>
              )}
              {(question.Banca || question.banca) && (
                <span className="text-[11px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
                  {question.Banca || question.banca}
                </span>
              )}
              {question.tema && question.tema !== question.materia && (
                <span className="text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-md">
                  {question.tema}
                </span>
              )}
              {question.dificuldade && (
                <span className="text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-md">
                  {question.dificuldade}
                </span>
              )}
              {(() => {
                const { idq, idg, idtec } = getQuestionIds(question);
                return (
                  <>
                    {idq && (
                      <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
                        QC: {idq}
                      </span>
                    )}
                    {idg && (
                      <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-md">
                        Gran: {idg}
                      </span>
                    )}
                    {idtec && (
                      <span className="text-[11px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-md">
                        TEC: {idtec}
                      </span>
                    )}
                  </>
                );
              })()}
              {question.link && (
                <a
                  href={question.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                  title="Abrir página original da questão"
                >
                  <ExternalLink size={11} />
                  Link da Questão
                </a>
              )}
              {isAdmin && onEditQuestion && (
                <button
                  onClick={() => onEditQuestion(question)}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                  title="Editar esta questão (Admin)"
                >
                  <Pencil size={11} />
                  Editar Questão
                </button>
              )}
              {textoApoio && (
                <button
                  onClick={() => setShowTextoApoio(!showTextoApoio)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 ${
                    showTextoApoio
                      ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                      : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText size={11} />
                  {showTextoApoio ? "Ocultar texto de apoio" : "Texto de apoio"}
                </button>
              )}
            </div>

            {/* Texto de Apoio colapsável */}
            {textoApoio && showTextoApoio && (
              <div className="overflow-hidden mb-5">
                <div className="p-3.5 sm:p-5 rounded-xl bg-[#111623] border-l-[3px] border-blue-500 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-2">
                    <FileText size={12} /> Texto de Apoio
                  </div>
                  <div className="question-rich-text text-[14.5px] sm:text-[13.5px] text-slate-200/90 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {formatQuestionText(textoApoio)}
                  </div>
                </div>
              </div>
            )}

            {/* ── Enunciado ── */}
            {question.title && question.title.trim() && (
              <div className="question-rich-text text-[15px] sm:text-[13.5px] font-normal text-slate-200/85 leading-relaxed mb-3 break-words [overflow-wrap:anywhere]">
                {formatQuestionText(question.title)}
              </div>
            )}

            {/* Pergunta-Problema */}
            {question.perguntaProblema && question.perguntaProblema.trim() && question.perguntaProblema.trim() !== question.title?.trim() && (
              <div className="question-rich-text text-[15px] sm:text-[13.5px] text-slate-200/85 font-normal leading-relaxed mb-3.5 pl-3 border-l border-white/15 break-words [overflow-wrap:anywhere]">
                {formatQuestionText(question.perguntaProblema)}
              </div>
            )}

            {/* Aviso de Questão Anulada */}
            {isAnulada && (
              <div className="flex items-start sm:items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-200 mb-4 text-xs font-normal">
                <Ban size={15} className="text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Questão anulada pela banca. Ela permanece visível na lista e aqui para consulta, mas não é possível respondê-la.
                </span>
              </div>
            )}

            {/* Banner de Feedback */}
            {showFeedback && selectedOption && !isAnulada && (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 text-[13px] font-medium ${
                  isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {isCorrect
                  ? <CheckCircle2 size={17} className="shrink-0" />
                  : <XCircle size={17} className="shrink-0" />
                }
                <span>
                  {isCorrect
                    ? "Resposta correta!"
                    : `Incorreto. O gabarito é a alternativa ${gabarito}.`}
                </span>
              </div>
            )}

            {/* ── Alternativas ── */}
            <div className="overflow-hidden rounded-lg border border-white/[0.07]">
              {hasAlternativas ? LETTERS.filter(l => alternativas[l]).map(letter => {
                const text = alternativas[letter];
                const isSelected = selectedOption === letter;
                const isCorrectAnswer = gabarito === letter;

                let cardCls = "bg-[#11161e] border-transparent hover:bg-[#1a2029] cursor-pointer";
                let badgeCls = "border-white/[0.10] text-slate-400/80 bg-black/10";
                let textCls = "text-slate-200/75";

                if (isAnulada) {
                  cardCls = "bg-[#11161e]/80 border-transparent opacity-65 cursor-not-allowed";
                  badgeCls = "border-amber-500/25 text-amber-300/80 bg-amber-500/[0.06]";
                  textCls = "text-slate-400";
                } else if (showFeedback) {
                  if (isCorrectAnswer) {
                      cardCls = "border-transparent bg-emerald-300/[0.08] cursor-default";
                    badgeCls = "border-emerald-300/40 text-emerald-200 bg-emerald-300/[0.08]";
                    textCls = "text-emerald-100/90";
                  } else if (isSelected && !isCorrectAnswer) {
                      cardCls = "border-transparent bg-rose-500/[0.08] opacity-90 cursor-default";
                    badgeCls = "border-rose-400/60 text-rose-300 bg-rose-500/10";
                    textCls = "text-rose-200";
                  } else {
                    cardCls = "border-transparent opacity-30 cursor-default";
                    badgeCls = "border-white/[0.08] text-slate-600 bg-transparent";
                    textCls = "text-slate-500";
                  }
                } else if (isSelected) {
                  cardCls = "border-transparent bg-emerald-300/[0.09] cursor-pointer";
                  badgeCls = "border-emerald-300/40 text-emerald-200 bg-emerald-300/[0.08]";
                  textCls = "text-[#E8F0FE]";
                }

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelect(letter)}
                    disabled={showFeedback || isAnulada}
                    className={`w-full flex items-start gap-3 px-3 sm:px-3.5 py-3 sm:py-2.5 min-h-[48px] sm:min-h-11 rounded-none text-left transition-colors duration-150 border-b border-white/[0.06] outline-none group ${
                      strikethroughs[letter] ? "opacity-30" : ""
                    } ${cardCls}`}
                  >
                    {/* Badge circular */}
                    <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-sm border flex items-center justify-center shrink-0 text-xs sm:text-[10px] font-normal mt-0.5 ${badgeCls}`}>
                      {letter}
                    </div>

                    {/* Texto */}
                      <span className={`question-rich-text text-[14px] sm:text-[12.5px] leading-relaxed flex-1 font-normal pt-0.5 break-words [overflow-wrap:anywhere] ${
                        strikethroughs[letter] ? "line-through text-slate-700" : textCls
                      }`}>
                      {formatQuestionText(text)}
                    </span>

                    {/* Ícones feedback */}
                    {showFeedback && isCorrectAnswer && !isAnulada && (
                      <CheckCircle2 size={16} className="text-emerald-400 mt-1.5 shrink-0" />
                    )}
                    {showFeedback && isSelected && !isCorrectAnswer && !isAnulada && (
                      <XCircle size={16} className="text-rose-400 mt-1.5 shrink-0" />
                    )}

                    {/* Cortar alternativa */}
                    {!showFeedback && !isAnulada && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleStrikethrough(letter); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleStrikethrough(letter); } }}
                        title={strikethroughs[letter] ? "Restaurar alternativa" : "Eliminar alternativa"}
                        className={`mt-1 p-2 sm:p-1.5 rounded-lg opacity-60 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shrink-0 ${
                          strikethroughs[letter]
                            ? "text-rose-400 !opacity-100 bg-rose-500/10"
                            : "text-slate-500 sm:text-slate-600 hover:text-rose-400 hover:bg-rose-500/5"
                        }`}
                      >
                        <Scissors size={13} />
                      </span>
                    )}
                  </button>
                );
              }) : null}
            </div>

            {/* ── Botões de Ação ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3.5 pb-1 mt-3 border-t border-white/[0.05]">
              <label
                onClick={() => onToggleDuvida?.(question.id)}
                className="flex items-center gap-2 cursor-pointer group select-none min-h-[36px] sm:min-h-0"
              >
                <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                  isDuvida
                    ? "border-amber-500/60 bg-amber-500/20"
                    : "border-white/[0.12] bg-transparent group-hover:bg-white/[0.04]"
                }`}>
                  {isDuvida && (
                    <Check size={11} className="text-amber-400" />
                  )}
                </div>
                <span className={`text-[13px] sm:text-[12px] transition-colors ${
                  isDuvida ? "text-amber-400" : "text-slate-400 sm:text-slate-500 group-hover:text-slate-300"
                }`}>
                  Fiquei em dúvida
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {isAnulada ? (
                  <span className="min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial cursor-not-allowed">
                    <Ban size={13} />
                    Questão Anulada
                  </span>
                ) : !showFeedback && (
                  <button
                    onClick={handleConfirm}
                    disabled={isSaving || !selectedOption}
                    className={`min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg text-[13px] sm:text-xs font-medium transition-colors flex-1 sm:flex-initial justify-center flex items-center ${
                      selectedOption
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-white/[0.04] text-slate-600 border border-white/[0.05] cursor-not-allowed"
                    }`}
                  >
                    {isSaving ? "Salvando..." : "Responder"}
                  </button>
                )}

                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-300 sm:text-slate-400 hover:text-slate-200 text-[13px] sm:text-xs font-medium transition-colors"
                >
                  {showFeedback ? "Ocultar gabarito" : "Ver gabarito"}
                </button>

                <button
                  onClick={() => setShowComment(!showComment)}
                  className={`min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border text-[13px] sm:text-xs font-medium transition-colors flex items-center gap-2 ${
                    showComment
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : "border-white/[0.08] hover:bg-white/[0.04] text-slate-300 sm:text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare size={13} />
                  {showComment ? "Ocultar comentário" : "Ver comentário"}
                  {comentarioTexto && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Comentário ── */}
            {showComment && (
              <div className="overflow-hidden">
                <div className="mt-4 p-4 sm:p-5 rounded-xl bg-[#111623] border-l-[3px] border-purple-500 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-3">
                    <BrainCircuit size={13} />
                    Comentário da questão
                  </div>
                  {comentarioTexto ? (
                    <div className="question-rich-text text-[14.5px] sm:text-[13.5px] text-[#D6D6D6] leading-relaxed break-words [overflow-wrap:anywhere]">
                      {formatQuestionText(comentarioTexto)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <AlertCircle size={13} className="text-amber-400" />
                      Esta questão ainda não possui comentário cadastrado.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="h-6" />

          </div>{/* /max-w-3xl */}
        </div>{/* /scroll */}

        {/* Coluna Direita: Qconcursos Lado a Lado */}
        {splitView && targetQconcursosUrl && (
          <div className="w-full lg:w-1/2 flex flex-col h-[65vh] lg:h-full rounded-2xl border border-white/[0.08] bg-[#0c1220] overflow-hidden shrink-0">
            {/* Header da divisão */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-300 truncate">
                  Qconcursos Integrado
                </span>
                {question.ID_Qconcursos && (
                  <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                    {question.ID_Qconcursos}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    window.open(targetQconcursosUrl, "_blank", "width=780,height=900,left=800,top=50");
                  }}
                  title="Abrir em janela destacada lado a lado"
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                >
                  <ExternalLink size={10} />
                  <span className="hidden sm:inline">Janela Pop-up</span>
                </button>
                <a
                  href={targetQconcursosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir em nova aba do navegador"
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                >
                  <ExternalLink size={10} />
                  <span className="hidden sm:inline">Nova Aba</span>
                </a>
                <button
                  onClick={() => {
                    const frame = document.getElementById("qconcursos-iframe") as HTMLIFrameElement;
                    if (frame) frame.src = targetQconcursosUrl;
                  }}
                  title="Recarregar quadro"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onClick={() => setSplitView(false)}
                  title="Fechar visualização lado a lado"
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors ml-1"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Dica amigável do iframe */}
            <div className="px-3 py-1.5 bg-blue-950/30 border-b border-blue-500/10 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span className="truncate">
                Dica: Se a página bloquear o carregamento interno, clique em <strong>Janela Pop-up</strong> acima para visualizá-la lado a lado.
              </span>
            </div>

            {/* Iframe */}
            <div className="flex-1 w-full bg-white relative">
              <iframe
                id="qconcursos-iframe"
                key={targetQconcursosUrl}
                src={targetQconcursosUrl}
                loading="lazy"
                className="w-full h-full border-0"
                title="Qconcursos"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>
          </div>
        )}

      </div>{/* /flex row split */}

      </div>{/* /flex col */}

      <PrintSimuladoModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        questions={resolverQueue.length > 0 ? resolverQueue : [question]}
        title={question.prova ? question.prova.toUpperCase() : "SIMULADO BANCO DE QUESTÕES"}
        subTitle={`Matéria: ${question.materia || "Geral"}`}
      />
    </div>
  );
}
