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
  FileText
} from "lucide-react";

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
  "Comentário"?: string;
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

// ── Web Audio Synthesizer Helpers ───────────────────
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

// ── Formatador de Enunciado ────────────────────────────────────────────────
// Detecta itens romanos (I., II., III., ...) no meio do texto e os exibe
// em linhas separadas com recuo e cor diferenciada.
function formatQuestionText(text: string): React.ReactElement {
  if (!text) return <></>

  // Regex que captura o padrão: um ou mais algarismos romanos seguidos de ponto e espaço
  // Exemplos válidos: "I. ", "II. ", "III. ", "IV. ", "V. ", "VI. ", "VII. ", "VIII. ", "IX. ", "X. "
  const romanPattern = /(?<=[\s\S])((?:X{0,3})(?:IX|IV|V?I{0,3}))\.\s/g

  // Divide usando um split que mantém os delimitadores (lookahead)
  // Estratégia: primeiro detectamos se o texto TEM itens romanos
  const hasRoman = /\b(I{1,3}V?|IV|V|VI{0,3}|IX|X)\.\s/.test(text)

  if (!hasRoman) {
    // Texto simples: só exibe normalmente
    return <span>{text}</span>
  }

  // Divide o texto nos marcadores romanos
  // Padrão: "XXXX I. item1 II. item2 III. item3"
  // Separamos em: [introducao, "I", item1, "II", item2, ...]
  const parts = text.split(/\b((?:X{0,3})(?:IX|IV|V?I{0,3}))\.\s/)

  const elements: React.ReactElement[] = []

  // parts[0] = introdução (antes do primeiro numeral)
  if (parts[0].trim()) {
    elements.push(
      <span key="intro" className="block mb-3 leading-relaxed">
        {parts[0].trim()}
      </span>
    )
  }

  // Itens: parts[1]=numeral, parts[2]=texto, parts[3]=numeral, parts[4]=texto...
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const numeral = parts[i]
    const content = parts[i + 1]
    if (!numeral || !content) continue
    elements.push(
      <span
        key={`item-${i}`}
        className="flex gap-2.5 py-1.5 border-l-2 border-indigo-500/20 pl-3 mb-1 leading-relaxed"
      >
        <span className="shrink-0 text-indigo-400 font-black text-[13px] min-w-[1.5rem]">
          {numeral}.
        </span>
        <span className="text-slate-300">{content.trimEnd()}</span>
      </span>
    )
  }

  return <>{elements}</>
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
    question["Comentário"] ||
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
    <div className="flex flex-col h-full min-h-0 w-full bg-[#0b0f19]/80 rounded-[2rem] border border-white/[0.04] p-6 sm:p-8 relative overflow-x-hidden">
      
      <div className="w-full flex flex-col flex-1 min-h-0">
          
          {/* Foco Bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#121626] border border-white/[0.04] rounded-[1.25rem] mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-5 bg-blue-600 rounded-full flex items-center p-0.5 shadow-inner cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
              </div>
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Sparkles size={14} className="text-blue-400" /> Modo Foco
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 bg-[#1e2436] px-3 py-1.5 rounded-lg border border-white/[0.02]">
              Questão {questionIndex + 1} de {totalQuestions}
            </div>
          </div>

          {/* Main Question Content */}
          <div className="flex-1 flex flex-col relative overflow-hidden min-h-0 mt-2">
            
            {/* Header da Questão */}
            <div className="flex flex-row items-center justify-between gap-3 mb-5 shrink-0 relative z-20 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-4">
                <button onClick={onBackToBank} className="text-slate-500 hover:text-white transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] text-sm font-black text-white shrink-0">
                  {questionIndex + 1}
                </div>
                <div>
                  <h2 className="text-[11px] sm:text-xs font-black text-blue-500 uppercase tracking-widest max-w-[200px] sm:max-w-xs truncate">
                    {question.prova || "SIMULADO PADRÃO"}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold mt-1">
                    <Loader2 size={10} className="opacity-50" />
                    ID da Questão: {question.id}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Histórico com painel dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
                      showHistory
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : "bg-[#121626] border-white/[0.04] text-slate-400 hover:text-white"
                    }`}
                  >
                    Histórico <ChevronDown size={10} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
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
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Histórico desta Questão</p>
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
                              <span className="text-[10px] text-slate-400">Última resposta</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                stats.isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                              }`}>{stats.lastAnswer} — {stats.isCorrect ? "Certo" : "Errado"}</span>
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

                {/* Navegação */}
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

            {/* Area de Scroll (Enunciado + Alternativas) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-6">
              
              {/* Tópico & Botão Texto de Apoio */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-lg w-fit">
                  {question.tema || question.materia || "GERAL"}
                </div>

                {textoApoio && (
                  <button
                    onClick={() => setShowTextoApoio(!showTextoApoio)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${
                      showTextoApoio
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                        : "bg-[#121626] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    <FileText size={12} className="text-blue-400" />
                    {showTextoApoio ? "Ocultar Texto de Apoio" : "Ver Texto de Apoio"}
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showTextoApoio ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>

              {/* Texto de Apoio Colapsável (Sempre inicia em oculto) */}
              {textoApoio && (
                <AnimatePresence>
                  {showTextoApoio && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#121626] border border-blue-500/20 my-2 relative overflow-hidden shadow-lg">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                          <FileText size={13} /> Texto de Apoio
                        </div>
                        <p
                          className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium"
                          dangerouslySetInnerHTML={{ __html: textoApoio.replace(/\n/g, "<br/>") }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Enunciado */}
              <div className="text-sm sm:text-[15px] text-slate-400 leading-relaxed font-normal">
                {formatQuestionText(question.title ?? '')}
              </div>

              {/* Pergunta problema */}
              {question.perguntaProblema && (
                <div className="text-sm sm:text-[15px] text-slate-400 leading-relaxed font-normal mt-3">
                  {formatQuestionText(question.perguntaProblema)}
                </div>
              )}

              {/* Banner de Feedback Animado (Certo vs Errado) */}
              <AnimatePresence>
                {showFeedback && selectedOption && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xl ${
                      isCorrect
                        ? "bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-emerald-950/50"
                        : "bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-rose-950/80 border-rose-500/40 text-rose-300 shadow-rose-950/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCorrect ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}>
                        {isCorrect ? <CheckCircle2 size={22} className="animate-bounce" /> : <XCircle size={22} className="animate-pulse" />}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
                          {isCorrect ? (
                            <>
                              <Flame size={14} className="text-emerald-400 animate-pulse" /> Sensacional! Resposta Correta!
                            </>
                          ) : (
                            <>
                              Ops! Não foi desta vez.
                            </>
                          )}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 font-medium">
                          {isCorrect
                            ? "Você dominou essa questão. Parabéns!"
                            : `O gabarito oficial é a alternativa ${gabarito}.`}
                        </p>
                      </div>
                    </div>
                    {comentarioTexto && !showComment && (
                      <button
                        onClick={() => setShowComment(true)}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[11px] font-bold text-white transition-all shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <MessageSquare size={13} /> Ver Comentário
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Alternativas com Efeito de Tremor no Erro */}
              <motion.div
                animate={isShaking ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-3 mt-4"
              >
                {hasAlternativas ? LETTERS.filter(l => alternativas[l]).map(letter => {
                  const text = alternativas[letter];
                  const isSelected = selectedOption === letter;
                  const isCorrectAnswer = gabarito === letter;

                  let boxStyle = "bg-transparent text-slate-300 hover:bg-white/[0.03] border-transparent";
                  let letterStyle = "text-slate-500 font-black";
                  
                  if (showFeedback) {
                    if (isCorrectAnswer) {
                      boxStyle = "bg-emerald-500/[0.12] border-2 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
                      letterStyle = "text-emerald-400 font-black";
                    } else if (isSelected && !isCorrectAnswer) {
                      boxStyle = "bg-rose-500/[0.12] border-2 border-rose-500/50 text-rose-300 opacity-90 shadow-[0_0_20px_rgba(244,63,94,0.15)]";
                      letterStyle = "text-rose-400 font-black";
                    } else {
                      boxStyle = "bg-transparent opacity-40 text-slate-500 border-transparent";
                      letterStyle = "text-slate-600 font-black";
                    }
                  } else if (isSelected) {
                    boxStyle = "bg-blue-500/[0.08] border-2 border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]";
                    letterStyle = "text-blue-400 font-black";
                  }

                  return (
                    <button
                      key={letter}
                      onClick={() => handleSelect(letter)}
                      disabled={showFeedback}
                      className={`w-full flex items-center p-3.5 rounded-2xl text-left transition-all border outline-none group ${
                        strikethroughs[letter] ? "opacity-35" : ""
                      } ${boxStyle}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[13px] mr-3 transition-all ${
                        isSelected || (showFeedback && isCorrectAnswer) ? "bg-white/10" : "bg-white/[0.03]"
                      } ${letterStyle}`}>
                        {letter}
                      </div>
                      <span className={`text-[13px] leading-relaxed flex-1 font-normal ${
                        strikethroughs[letter] ? "line-through text-slate-600" : "text-slate-300"
                      }`}>
                        {text}
                      </span>

                      {/* Ícone Indicador de Feedback */}
                      {showFeedback && isCorrectAnswer && (
                        <CheckCircle2 size={18} className="text-emerald-400 ml-2 shrink-0 animate-pulse" />
                      )}
                      {showFeedback && isSelected && !isCorrectAnswer && (
                        <XCircle size={18} className="text-rose-400 ml-2 shrink-0" />
                      )}

                      {/* Botão de cortar alternativa */}
                      {!showFeedback && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStrikethrough(letter); }}
                          title={strikethroughs[letter] ? "Restaurar alternativa" : "Cortar alternativa"}
                          className={`ml-2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
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

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 pb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="w-4 h-4 rounded-md border border-white/[0.1] bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Fiquei em Dúvida</span>
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
                    {showComment ? "Esconder Comentário" : "Ver Comentário"}
                    {comentarioTexto && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* Seção de Comentário / Resolução */}
              <AnimatePresence>
                {(showFeedback || showComment) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-white/[0.04]"
                  >
                    {/* Bloco do Comentário */}
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
                            Comentário da Questão
                          </div>
                          {comentarioTexto && (
                            <span className="text-[9px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                              Supabase Sync
                            </span>
                          )}
                        </div>

                        {comentarioTexto ? (
                          <p className="text-[13px] text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                            {comentarioTexto}
                          </p>
                        ) : (
                          <div className="py-3 text-center text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
                            <AlertCircle size={14} className="text-amber-400" />
                            Esta questão ainda não possui comentário cadastrado no Supabase.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </div>
  );
}
