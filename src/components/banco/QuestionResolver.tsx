"use client";

import React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Printer
} from "lucide-react";
import { PrintSimuladoModal } from "./PrintSimuladoModal";

interface BancoQuestion {
  id: any;
  materia: string;
  tema?: string;
  title: string;
  dificuldade?: string;
  prova?: string;
  "Alternativa A"?: string;
  "Alternativa B"?: string;
  "Alternativa C"?: string;
  "Alternativa D"?: string;
  "Alternativa E"?: string;
  "Texto de apoio"?: string;
  perguntaProblema?: string;
  respostaCorreta?: string;
  Gabarito?: string;
  explicacao?: string;
  comentario?: string;
  "ComentÃ¡rio"?: string;
}

interface QuestionResolverProps {
  question: BancoQuestion;
  questionIndex: number;
  totalQuestions: number;
  existingAnswer?: { isCorrect: boolean; answer: string; timestamp: number };
  stats?: QuestionStats;
  resolverQueue: BancoQuestion[];
  userAnswers: Record<string, QuestionStats>;
  onSelectQuestion: (index: number) => void;
  onAnswer: (id: any, answer: string, isCorrect: boolean) => Promise<void>;
  onNext: () => void;
  onPrev: () => void;
  onBackToBank: () => void;
  onCutQuestion?: (id: any) => void;
  isSaving: boolean;
  provasDisponiveis?: string[];
  onSelectProva?: (prova: string) => void;
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
  existingAnswer,
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
  provasDisponiveis,
  onSelectProva,
}: QuestionResolverProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    existingAnswer?.answer ?? null
  );
  const [showFeedback, setShowFeedback] = useState<boolean>(!!existingAnswer);
  const [showComment, setShowComment] = useState<boolean>(false);
  const [showTextoApoio, setShowTextoApoio] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [strikethroughs, setStrikethroughs] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Sync / Reset state when question changes
  useEffect(() => {
    setSelectedOption(existingAnswer?.answer ?? null);
    setShowFeedback(!!existingAnswer);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
    setIsShaking(false);
  }, [question.id, existingAnswer]);

  const gabarito = question.respostaCorreta || question.Gabarito || "";
  const textoApoio =
    question["Texto de apoio"] ||
    (question as any).texto_apoio ||
    (question as any).textoApoio;
  const comentarioTexto =
    question.explicacao ||
    question.comentario ||
    question["ComentÃ¡rio"] ||
    (question as any).Comentario;

  const alternativas: Record<string, string> = {};
  for (const letter of LETTERS) {
    const val = question[`Alternativa ${letter}` as keyof BancoQuestion] as string | undefined;
    if (val) alternativas[letter] = val;
  }
  const hasAlternativas = Object.keys(alternativas).length > 0;

  const handleSelect = (letter: string) => {
    if (showFeedback || strikethroughs[letter]) return;
    setSelectedOption(letter);
  };

  const handleConfirm = async () => {
    if (!selectedOption) return;
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
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  const toggleStrikethrough = (letter: string) => {
    if (showFeedback) return;
    setStrikethroughs(prev => ({ ...prev, [letter]: !prev[letter] }));
  };

  const handleNext = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
    setIsShaking(false);
    onNext();
  };

  const handlePrev = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setShowComment(false);
    setShowTextoApoio(false);
    setStrikethroughs({});
    setIsShaking(false);
    onPrev();
  };

  const isCorrect = showFeedback && selectedOption === gabarito;
  const isWrong = showFeedback && selectedOption !== gabarito;

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-[#0b0f19]/80 rounded-[2rem] border border-white/[0.04] p-5 sm:p-7 relative overflow-x-hidden">

      <div className="w-full flex flex-col flex-1 min-h-0">

        {/* ── Top bar: progresso + navegação ── */}
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0 pb-3 border-b border-white/[0.05]">

          {/* Esquerda: voltar + número + prova */}
          <div className="flex items-center gap-3">
            <button onClick={onBackToBank} className="text-slate-600 hover:text-white transition-colors p-1">
              <ArrowLeft size={17} />
            </button>
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
              {questionIndex + 1}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-300 max-w-[180px] sm:max-w-xs truncate">
                {question.prova || "Simulado Padrão"}
              </div>
              <div className="text-[10px] text-slate-600 tabular-nums">
                ID {question.id}
              </div>
            </div>
          </div>

          {/* Direita: ações */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Imprimir */}
            <button
              onClick={() => setShowPrintModal(true)}
              title="Imprimir / gerar PDF"
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all flex items-center gap-1.5"
            >
              <Printer size={13} /> Imprimir
            </button>

            {/* Histórico */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  showHistory
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                Histórico <ChevronDown size={11} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full right-0 mt-2 w-60 bg-[#181f2e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Progresso + Prev/Next */}
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1">
              <button onClick={handlePrev} disabled={questionIndex === 0} className="text-slate-500 hover:text-white disabled:opacity-25 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-[11px] font-medium text-slate-500 tabular-nums min-w-[3rem] text-center">
                {questionIndex + 1} / {totalQuestions}
              </span>
              <button onClick={handleNext} disabled={questionIndex === totalQuestions - 1} className="text-slate-500 hover:text-white disabled:opacity-25 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>

          </div>
        </div>

        {/* ── Scroll Area ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          <div className="max-w-3xl mx-auto">

            {/* Barra de progresso fina */}
            <div className="h-0.5 bg-white/[0.05] rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-blue-500/60 rounded-full transition-all duration-500"
                style={{ width: `${totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0}%` }}
              />
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-[11px] font-medium text-slate-300 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-md">
                {question.materia || "Geral"}
              </span>
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
              {textoApoio && (
                <button
                  onClick={() => setShowTextoApoio(!showTextoApoio)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
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
            {textoApoio && (
              <AnimatePresence>
                {showTextoApoio && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    <div className="p-4 sm:p-5 rounded-xl bg-[#111623] border-l-[3px] border-blue-500 border border-white/[0.06]">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-2.5">
                        <FileText size={12} /> Texto de Apoio
                      </div>
                      <div className="text-[13.5px] text-slate-300 leading-relaxed">
                        {formatQuestionText(textoApoio)}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* ── Enunciado ── */}
            <div className="text-[15px] sm:text-[17px] font-semibold text-[#F5F5F5] leading-[1.85] mb-7">
              {formatQuestionText(question.title ?? '')}
            </div>

            {/* Pergunta-Problema */}
            {question.perguntaProblema && (
              <div className="text-[14px] sm:text-[15px] text-[#E0E0E0] font-normal leading-relaxed mb-7 pl-4 border-l-[3px] border-white/[0.1]">
                {formatQuestionText(question.perguntaProblema)}
              </div>
            )}

            {/* Banner de Feedback */}
            <AnimatePresence>
              {showFeedback && selectedOption && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Alternativas ── */}
            <motion.div
              animate={isShaking ? { x: [0, -10, 10, -6, 6, -2, 2, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-2"
            >
              {hasAlternativas ? LETTERS.filter(l => alternativas[l]).map(letter => {
                const text = alternativas[letter];
                const isSelected = selectedOption === letter;
                const isCorrectAnswer = gabarito === letter;

                let cardCls = "border-white/[0.07] bg-transparent hover:bg-white/[0.03] hover:border-white/[0.14] cursor-pointer";
                let badgeCls = "border-white/[0.14] text-slate-400 bg-transparent";
                let textCls = "text-[#D6D6D6]";

                if (showFeedback) {
                  if (isCorrectAnswer) {
                    cardCls = "border-emerald-500/40 bg-emerald-500/[0.07] cursor-default";
                    badgeCls = "border-emerald-400/60 text-emerald-300 bg-emerald-500/10";
                    textCls = "text-emerald-200";
                  } else if (isSelected && !isCorrectAnswer) {
                    cardCls = "border-rose-500/40 bg-rose-500/[0.07] opacity-90 cursor-default";
                    badgeCls = "border-rose-400/60 text-rose-300 bg-rose-500/10";
                    textCls = "text-rose-200";
                  } else {
                    cardCls = "border-transparent opacity-30 cursor-default";
                    badgeCls = "border-white/[0.08] text-slate-600 bg-transparent";
                    textCls = "text-slate-500";
                  }
                } else if (isSelected) {
                  cardCls = "border-blue-500/50 bg-blue-500/[0.08] cursor-pointer";
                  badgeCls = "border-blue-400/60 text-blue-300 bg-blue-500/10";
                  textCls = "text-[#E8F0FE]";
                }

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelect(letter)}
                    disabled={showFeedback}
                    className={`w-full flex items-start gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all duration-150 border outline-none group ${
                      strikethroughs[letter] ? "opacity-30" : ""
                    } ${cardCls}`}
                  >
                    {/* Badge circular */}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-[12px] font-semibold transition-all mt-0.5 ${badgeCls}`}>
                      {letter}
                    </div>

                    {/* Texto */}
                    <span className={`text-[13.5px] leading-relaxed flex-1 font-normal transition-colors pt-1 ${
                      strikethroughs[letter] ? "line-through text-slate-600" : textCls
                    }`}>
                      {formatQuestionText(text)}
                    </span>

                    {/* Ícones feedback */}
                    {showFeedback && isCorrectAnswer && (
                      <CheckCircle2 size={16} className="text-emerald-400 mt-1.5 shrink-0" />
                    )}
                    {showFeedback && isSelected && !isCorrectAnswer && (
                      <XCircle size={16} className="text-rose-400 mt-1.5 shrink-0" />
                    )}

                    {/* Cortar alternativa */}
                    {!showFeedback && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStrikethrough(letter); }}
                        title={strikethroughs[letter] ? "Restaurar alternativa" : "Eliminar alternativa"}
                        className={`mt-1.5 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                          strikethroughs[letter]
                            ? "text-rose-400 opacity-100 bg-rose-500/10"
                            : "text-slate-600 hover:text-rose-400 hover:bg-rose-500/5"
                        }`}
                      >
                        <Scissors size={11} />
                      </button>
                    )}
                  </button>
                );
              }) : null}
            </motion.div>

            {/* ── Botões de Ação ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 pb-2 mt-4 border-t border-white/[0.05]">
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div className="w-4 h-4 rounded border border-white/[0.12] bg-transparent group-hover:bg-white/[0.04] transition-colors" />
                <span className="text-[12px] text-slate-500 group-hover:text-slate-400 transition-colors">Fiquei em dúvida</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {!showFeedback && (
                  <button
                    onClick={handleConfirm}
                    disabled={isSaving || !selectedOption}
                    className={`px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                      selectedOption
                        ? "bg-blue-600 hover:bg-blue-500 text-white active:scale-95"
                        : "bg-white/[0.04] text-slate-600 border border-white/[0.05] cursor-not-allowed"
                    }`}
                  >
                    {isSaving ? "Salvando..." : "Responder"}
                  </button>
                )}

                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="px-4 py-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 text-[13px] font-medium transition-all"
                >
                  {showFeedback ? "Ocultar gabarito" : "Ver gabarito"}
                </button>

                <button
                  onClick={() => setShowComment(!showComment)}
                  className={`px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all flex items-center gap-2 ${
                    showComment
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : "border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
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
            <AnimatePresence>
              {showComment && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-5 rounded-xl bg-[#111623] border-l-[3px] border-purple-500 border border-white/[0.06]">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-3">
                      <BrainCircuit size={13} />
                      Comentário da questão
                    </div>
                    {comentarioTexto ? (
                      <div className="text-[13.5px] text-[#D6D6D6] leading-relaxed">
                        {formatQuestionText(comentarioTexto)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[12px] text-slate-500">
                        <AlertCircle size={13} className="text-amber-400" />
                        Esta questão ainda não possui comentário cadastrado.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-6" />

          </div>{/* /max-w-3xl */}
        </div>{/* /scroll */}

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
