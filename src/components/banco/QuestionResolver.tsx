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

// â”€â”€ Web Audio Synthesizer Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Formatador de MatemÃ¡tica & Enunciado / ComentÃ¡rios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Square root: \sqrt[n]{x} -> â¿âˆš(x), \sqrt{x} -> âˆš(x)
  str = str.replace(/\\sqrt\[(.*?)\]\s*\{([\s\S]*?)\}/g, '$1âˆš($2)');
  str = str.replace(/\\sqrt\s*\{([\s\S]*?)\}/g, 'âˆš($1)');

  // Math operators & symbols
  str = str.replace(/\\cdotp|\\cdot|\\times/g, 'Â·');
  str = str.replace(/\\div/g, 'Ã·');
  str = str.replace(/\\pm/g, 'Â±');
  str = str.replace(/\\approx/g, 'â‰ˆ');
  str = str.replace(/\\neq/g, 'â‰ ');
  str = str.replace(/\\leq|\\le/g, 'â‰¤');
  str = str.replace(/\\geq|\\ge/g, 'â‰¥');
  str = str.replace(/\\infty/g, 'âˆž');
  str = str.replace(/\\pi/g, 'Ï€');
  str = str.replace(/\\Delta/g, 'Î”');
  str = str.replace(/\\theta/g, 'Î¸');
  str = str.replace(/\\alpha/g, 'Î±');
  str = str.replace(/\\beta/g, 'Î²');
  str = str.replace(/\\rightarrow|\\Rightarrow/g, 'â†’');
  str = str.replace(/\\leftarrow|\\Leftarrow/g, 'â†');
  str = str.replace(/\\in/g, 'âˆˆ');
  str = str.replace(/\\notin/g, 'âˆ‰');
  str = str.replace(/\\subset/g, 'âŠ‚');
  str = str.replace(/\\cap|\\inter/g, 'âˆ©');
  str = str.replace(/\\cup|\\union/g, 'âˆª');
  str = str.replace(/\\sim/g, '~');
  str = str.replace(/\\overline\{([\s\S]*?)\}/g, '$1Ì„');

  // Formatting environment commands
  str = str.replace(/\\begin\{(?:equation|align|math|center)\*?\}/g, '');
  str = str.replace(/\\end\{(?:equation|align|math|center)\*?\}/g, '');

  // Exponents superscripts: ^2 -> Â², ^3 -> Â³, ^n -> â¿, etc.
  str = str.replace(/\^2\b/g, 'Â²');
  str = str.replace(/\^3\b/g, 'Â³');
  str = str.replace(/\^1\b/g, 'Â¹');
  str = str.replace(/\^0\b/g, 'â°');
  str = str.replace(/\^n\b/g, 'â¿');
  str = str.replace(/\^x\b/g, 'Ë£');
  str = str.replace(/\^\+([0-9]+)/g, 'âº$1');
  str = str.replace(/\^-([0-9]+)/g, 'â»$1');
  str = str.replace(/\^\{([\s\S]*?)\}/g, 'â½$1â¾');

  // Subscripts: _0..9 -> â‚€..â‚‰
  const subs: Record<string, string> = { '0': 'â‚€', '1': 'â‚', '2': 'â‚‚', '3': 'â‚ƒ', '4': 'â‚„', '5': 'â‚…', '6': 'â‚†', '7': 'â‚‡', '8': 'â‚ˆ', '9': 'â‚‰', 'n': 'â‚™', 'x': 'â‚“' };
  str = str.replace(/_([0-9nx])/g, (_, match) => subs[match] || `_${match}`);
  str = str.replace(/_\{([\s\S]*?)\}/g, 'â‚$1â‚Ž');

  // Text commands cleanup
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathrm\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathbf\{([\s\S]*?)\}/g, '$1');

  return str;
}

function formatQuestionText(text: string): React.ReactElement {
  if (!text) return <></>;

  const cleaned = cleanMathLatex(text);

  // Verifica se o texto possui marcaÃ§Ã£o HTML (ex: <br>, <b>, <span>, <p>)
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
    setShowComment(true); // Exibe o comentÃ¡rio automaticamente ao responder

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

        {/* â”€â”€ Foco Bar (compacta + barra de progresso) â”€â”€ */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111623] border border-white/[0.05] rounded-2xl mb-3 shrink-0 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 bg-blue-600 rounded-full flex items-center p-0.5 shadow-inner cursor-pointer shrink-0" style={{ height: '18px' }}>
              <div className="w-3.5 h-3.5 bg-white rounded-full ml-auto shadow-sm" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-blue-400" /> Modo Foco
            </span>
          </div>
          <div className="flex flex-1 items-center gap-3 max-w-xs ml-4">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500 shrink-0 tabular-nums">
              {questionIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>

        {/* â”€â”€ Main Content â”€â”€ */}
        <div className="flex-1 flex flex-col relative overflow-hidden min-h-0 mt-1">

          {/* Header da QuestÃ£o */}
          <div className="flex flex-row items-center justify-between gap-3 mb-4 shrink-0 relative z-20 pb-3 border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <button onClick={onBackToBank} className="text-slate-600 hover:text-white transition-colors">
                <ArrowLeft size={17} />
              </button>
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_16px_rgba(37,99,235,0.3)] text-xs font-black text-white shrink-0">
                {questionIndex + 1}
              </div>
              <div>
                <h2 className="text-[10px] sm:text-[11px] font-black text-blue-500 uppercase tracking-widest max-w-[160px] sm:max-w-xs truncate">
                  {question.prova || "SIMULADO PADRÃƒO"}
                </h2>
                <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-bold mt-0.5">
                  <Loader2 size={9} className="opacity-40" />
                  ID: {question.id}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Imprimir */}
              <button
                onClick={() => setShowPrintModal(true)}
                title="Imprimir este simulado ou gerar PDF"
                className="px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Printer size={10} /> Imprimir
              </button>

              {/* HistÃ³rico */}
              <div className="relative">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    showHistory
                      ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                      : "bg-[#121626] border-white/[0.04] text-slate-400 hover:text-white"
                  }`}
                >
                  HistÃ³rico <ChevronDown size={10} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full right-0 mt-2 w-64 bg-[#1e2436] border border-white/[0.06] rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-white/[0.04]">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">HistÃ³rico desta QuestÃ£o</p>
                      </div>
                      {stats ? (
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Tentativas</span>
                            <span className="text-[10px] font-black text-white">{stats.totalAttempts}x</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Acertos</span>
                            <span className="text-[10px] font-black text-emerald-400">{stats.correctCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Erros</span>
                            <span className="text-[10px] font-black text-rose-400">{stats.errorCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Ãšltima resposta</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              stats.isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}>{stats.lastAnswer} â€” {stats.isCorrect ? "Certo" : "Errado"}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-[11px] text-slate-500">Nenhuma resposta registrada ainda.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* NavegaÃ§Ã£o Prev/Next */}
              <div className="flex items-center gap-1 bg-[#121626] border border-white/[0.04] p-1 rounded-lg">
                <button onClick={handlePrev} disabled={questionIndex === 0} className="w-6 h-5 flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <div className="w-[1px] h-3 bg-white/[0.06]" />
                <button onClick={handleNext} disabled={questionIndex === totalQuestions - 1} className="w-6 h-5 flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* â”€â”€ Scroll Area â€“ coluna de leitura centrada max-w-3xl â”€â”€ */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
            <div className="max-w-3xl mx-auto">

              {/* TÃ³pico & Texto de Apoio toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-lg w-fit">
                  {question.tema || question.materia || "GERAL"}
                </div>
                {textoApoio && (
                  <button
                    onClick={() => setShowTextoApoio(!showTextoApoio)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${
                      showTextoApoio
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                        : "bg-[#121626] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    <FileText size={12} className="text-blue-400" />
                    {showTextoApoio ? "Ocultar Texto de Apoio" : "Ver Texto de Apoio"}
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showTextoApoio ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>

              {/* Texto de Apoio colapsÃ¡vel */}
              {textoApoio && (
                <AnimatePresence>
                  {showTextoApoio && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mb-5"
                    >
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#121626] border border-blue-500/20 relative overflow-hidden shadow-lg">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                          <FileText size={13} /> Texto de Apoio
                        </div>
                        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                          {formatQuestionText(textoApoio)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* â”€â”€ Enunciado â€” branco suave, 17px, semibold â”€â”€ */}
              <div className="text-[15px] sm:text-[17px] font-semibold text-[#F0F0F0] leading-[1.75] tracking-[0.01em] mb-1">
                {formatQuestionText(question.title ?? '')}
              </div>

              {/* Pergunta-Problema (se houver) */}
              {question.perguntaProblema && (
                <div className="text-[15px] sm:text-[16px] text-[#F0F0F0] font-semibold leading-relaxed mt-2">
                  {formatQuestionText(question.perguntaProblema)}
                </div>
              )}

              {/* â”€â”€ Separador de 28px entre enunciado e alternativas â”€â”€ */}
              <div className="h-7" />

              {/* Banner de Feedback (Certo / Errado) */}
              <AnimatePresence>
                {showFeedback && selectedOption && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xl mb-4 ${
                      isCorrect
                        ? "bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 border-emerald-500/40 shadow-emerald-950/50"
                        : "bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-rose-950/80 border-rose-500/40 shadow-rose-950/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCorrect ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}>
                        {isCorrect ? <CheckCircle2 size={22} className="animate-bounce" /> : <XCircle size={22} className="animate-pulse" />}
                      </div>
                      <div>
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}>
                          {isCorrect ? (
                            <><Flame size={14} className="text-emerald-400 animate-pulse" /> Sensacional! Resposta Correta!</>
                          ) : (
                            <>Ops! NÃ£o foi desta vez.</>
                          )}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 font-medium">
                          {isCorrect
                            ? "VocÃª dominou essa questÃ£o. ParabÃ©ns!"
                            : `O gabarito oficial Ã© a alternativa ${gabarito}.`}
                        </p>
                      </div>
                    </div>
                    {comentarioTexto && !showComment && (
                      <button
                        onClick={() => setShowComment(true)}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[11px] font-bold text-white transition-all shrink-0 flex items-center gap-1.5 active:scale-95"
                      >
                        <MessageSquare size={13} /> Ver ComentÃ¡rio
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* â”€â”€ Alternativas â€” cards full-width clicÃ¡veis â”€â”€ */}
              <motion.div
                animate={isShaking ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-2.5"
              >
                {hasAlternativas ? LETTERS.filter(l => alternativas[l]).map(letter => {
                  const text = alternativas[letter];
                  const isSelected = selectedOption === letter;
                  const isCorrectAnswer = gabarito === letter;

                  /* Estilos do card */
                  let cardStyle = "bg-[#0f1422] border-white/[0.06] hover:border-blue-500/40 hover:bg-[#131929]";
                  let letterBg  = "bg-white/[0.05] text-slate-400";
                  let textColor = "text-[#D6D6D6]";

                  if (showFeedback) {
                    if (isCorrectAnswer) {
                      cardStyle = "bg-emerald-500/[0.12] border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
                      letterBg  = "bg-emerald-500/20 text-emerald-300";
                      textColor = "text-emerald-200";
                    } else if (isSelected && !isCorrectAnswer) {
                      cardStyle = "bg-rose-500/[0.12] border-2 border-rose-500/50 opacity-90 shadow-[0_0_20px_rgba(244,63,94,0.15)]";
                      letterBg  = "bg-rose-500/20 text-rose-300";
                      textColor = "text-rose-200";
                    } else {
                      cardStyle = "bg-transparent opacity-35 border-transparent";
                      letterBg  = "bg-white/[0.03] text-slate-600";
                      textColor = "text-slate-500";
                    }
                  } else if (isSelected) {
                    cardStyle = "bg-blue-500/[0.10] border-2 border-blue-500/50 shadow-[0_0_18px_rgba(59,130,246,0.12)]";
                    letterBg  = "bg-blue-500/25 text-blue-200";
                    textColor = "text-blue-100";
                  }

                  return (
                    <button
                      key={letter}
                      onClick={() => handleSelect(letter)}
                      disabled={showFeedback}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 border outline-none group ${
                        strikethroughs[letter] ? "opacity-30" : ""
                      } ${cardStyle}`}
                    >
                      {/* Badge circular da letra */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-black transition-all ${letterBg}`}>
                        {letter}
                      </div>

                      {/* Texto da alternativa */}
                      <span className={`text-[13.5px] leading-relaxed flex-1 font-normal transition-colors ${
                        strikethroughs[letter] ? "line-through text-slate-600" : textColor
                      }`}>
                        {formatQuestionText(text)}
                      </span>

                      {/* Ãcones de feedback */}
                      {showFeedback && isCorrectAnswer && (
                        <CheckCircle2 size={18} className="text-emerald-400 ml-1 shrink-0 animate-pulse" />
                      )}
                      {showFeedback && isSelected && !isCorrectAnswer && (
                        <XCircle size={18} className="text-rose-400 ml-1 shrink-0" />
                      )}

                      {/* BotÃ£o cortar alternativa */}
                      {!showFeedback && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStrikethrough(letter); }}
                          title={strikethroughs[letter] ? "Restaurar alternativa" : "Cortar alternativa"}
                          className={`ml-1 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                            strikethroughs[letter]
                              ? "text-rose-400 opacity-100 bg-rose-500/10"
                              : "text-slate-600 hover:text-rose-400 hover:bg-rose-500/5"
                          }`}
                        >
                          <Scissors size={12} />
                        </button>
                      )}
                    </button>
                  );
                }) : null}
              </motion.div>

              {/* â”€â”€ BotÃµes de AÃ§Ã£o â”€â”€ */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-7 pb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="w-4 h-4 rounded-md border border-white/[0.1] bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Fiquei em DÃºvida</span>
                </label>

                <div className="flex flex-wrap items-center gap-2.5">
                  {!showFeedback && (
                    <button
                      onClick={handleConfirm}
                      disabled={isSaving || !selectedOption}
                      className={`px-8 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                        selectedOption
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30 shadow-blue-600/20"
                          : "bg-[#121626] text-slate-600 border border-white/[0.02] cursor-not-allowed"
                      }`}
                    >
                      {isSaving ? "Processando..." : "Responder"}
                    </button>
                  )}

                  <button
                    onClick={() => setShowFeedback(!showFeedback)}
                    className="px-5 py-3.5 rounded-xl border border-[#1e2638] hover:bg-[#1e2638]/60 text-blue-400 font-black text-[11px] uppercase tracking-widest transition-all"
                  >
                    {showFeedback ? "Esconder Gabarito" : "Ver Gabarito"}
                  </button>

                  <button
                    onClick={() => setShowComment(!showComment)}
                    className={`px-5 py-3.5 rounded-xl border transition-all font-black text-[11px] uppercase tracking-widest flex items-center gap-2 ${
                      showComment
                        ? "bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "border-[#1e2638] hover:bg-[#1e2638]/60 text-purple-400"
                    }`}
                  >
                    <MessageSquare size={13} />
                    {showComment ? "Esconder ComentÃ¡rio" : "Ver ComentÃ¡rio"}
                    {comentarioTexto && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* â”€â”€ SeÃ§Ã£o de ComentÃ¡rio â”€â”€ */}
              <AnimatePresence>
                {(showFeedback || showComment) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-white/[0.04]"
                  >
                    {showComment && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[#16192e] to-[#111425] relative overflow-hidden shadow-xl"
                      >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-500" />
                        <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-black text-purple-400 uppercase tracking-widest">
                            <BrainCircuit size={15} className="text-purple-400 animate-pulse" />
                            ComentÃ¡rio da QuestÃ£o
                          </div>
                          {comentarioTexto && (
                            <span className="text-[9px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                              Supabase Sync
                            </span>
                          )}
                        </div>
                        {comentarioTexto ? (
                          <div className="text-[13px] text-slate-200 leading-relaxed font-medium">
                            {formatQuestionText(comentarioTexto)}
                          </div>
                        ) : (
                          <div className="py-3 text-center text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
                            <AlertCircle size={14} className="text-amber-400" />
                            Esta questÃ£o ainda nÃ£o possui comentÃ¡rio cadastrado no Supabase.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-6" />

            </div>{/* /max-w-3xl */}
          </div>{/* /scroll */}

        </div>{/* /main content */}
      </div>{/* /flex col */}

      <PrintSimuladoModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        questions={resolverQueue.length > 0 ? resolverQueue : [question]}
        title={question.prova ? question.prova.toUpperCase() : "SIMULADO BANCO DE QUESTÃ•ES"}
        subTitle={`MatÃ©ria: ${question.materia || "Geral"}`}
      />
    </div>
  );
}

