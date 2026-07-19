"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  respostaCorreta?: string;
  Gabarito?: string;
  explicacao?: string;
}

interface UserAnswer {
  isCorrect: boolean;
  answer: string;
  timestamp: number;
}

interface QuestionResolverProps {
  question: BancoQuestion;
  questionIndex: number;
  totalQuestions: number;
  existingAnswer?: UserAnswer;
  onAnswer: (questionId: any, answer: string, isCorrect: boolean) => Promise<void>;
  onNext: () => void;
  onPrev: () => void;
  onBackToBank: () => void;
  isSaving: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E"] as const;

export default function QuestionResolver({
  question,
  questionIndex,
  totalQuestions,
  existingAnswer,
  onAnswer,
  onNext,
  onPrev,
  onBackToBank,
  isSaving,
}: QuestionResolverProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    existingAnswer?.answer ?? null
  );
  const [showFeedback, setShowFeedback] = useState<boolean>(!!existingAnswer);
  const [strikethroughs, setStrikethroughs] = useState<Record<string, boolean>>({});

  // Reset state when question changes
  const currentId = question.id;

  const gabarito = question.respostaCorreta || question.Gabarito || "";

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
  };

  const toggleStrikethrough = (letter: string) => {
    if (showFeedback) return;
    setStrikethroughs(prev => ({ ...prev, [letter]: !prev[letter] }));
  };

  const handleNext = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setStrikethroughs({});
    onNext();
  };

  const handlePrev = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setStrikethroughs({});
    onPrev();
  };

  const isCorrect = showFeedback && selectedOption === gabarito;
  const isWrong = showFeedback && selectedOption !== gabarito;

  const getDifficultyColor = (d?: string) => {
    switch (d) {
      case "Baixa": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "Alta": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "Extra Difícil": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
        <button
          onClick={onBackToBank}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-white transition-all"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Banco
        </button>

        {/* Progress pills */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {questionIndex + 1} / {totalQuestions}
          </span>
          <div className="hidden sm:flex items-center gap-1 max-w-[200px] overflow-hidden">
            {Array.from({ length: Math.min(totalQuestions, 20) }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i < questionIndex
                    ? "bg-blue-500/40"
                    : i === questionIndex
                    ? "bg-blue-500"
                    : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={questionIndex === 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNext}
              disabled={questionIndex === totalQuestions - 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-wider">
            <Target size={10} />
            {question.materia}
          </span>
          {question.tema && (
            <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-slate-400 uppercase">
              {question.tema}
            </span>
          )}
          {question.dificuldade && (
            <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${getDifficultyColor(question.dificuldade)}`}>
              {question.dificuldade}
            </span>
          )}
          {question.prova && (
            <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-slate-500 uppercase">
              {question.prova}
            </span>
          )}
        </div>

        {/* Texto de apoio */}
        {question["Texto de apoio"] && (
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15">
            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
              <BookOpen size={11} />
              Texto de Apoio
            </div>
            <p
              className="text-sm text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: question["Texto de apoio"]
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                  .replace(/\n/g, "<br/>"),
              }}
            />
          </div>
        )}

        {/* Enunciado */}
        <div>
          <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
            {question.title}
          </p>
        </div>

        {/* Alternativas */}
        {hasAlternativas ? (
          <div className="space-y-2.5">
            {LETTERS.filter(l => alternativas[l]).map(letter => {
              const text = alternativas[letter];
              const isSelected = selectedOption === letter;
              const isCorrectAnswer = gabarito === letter;
              const isStriken = strikethroughs[letter];

              let rowStyle = "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]";
              if (showFeedback) {
                if (isCorrectAnswer) rowStyle = "border-emerald-500/40 bg-emerald-500/5 text-emerald-400";
                else if (isSelected && !isCorrectAnswer) rowStyle = "border-rose-500/30 bg-rose-500/5 opacity-70";
                else rowStyle = "border-white/[0.04] opacity-30";
              } else if (isSelected) {
                rowStyle = "border-blue-500/50 bg-blue-500/5";
              }

              let radioStyle = "border-slate-700";
              if (showFeedback && isCorrectAnswer) radioStyle = "border-emerald-500 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
              else if (showFeedback && isSelected && !isCorrectAnswer) radioStyle = "border-rose-500 bg-rose-500";
              else if (isSelected) radioStyle = "border-blue-500 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]";

              return (
                <div key={letter} className="flex items-start group">
                  {/* Eliminator button */}
                  <button
                    onClick={() => toggleStrikethrough(letter)}
                    disabled={showFeedback}
                    className={`mt-3.5 mr-1 w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                      isStriken
                        ? "opacity-100 text-rose-500/60 bg-rose-500/10"
                        : "opacity-0 group-hover:opacity-40 text-slate-600 hover:text-rose-400"
                    }`}
                    title="Eliminar alternativa"
                  >
                    <Scissors size={11} className="-rotate-45" />
                  </button>

                  <button
                    onClick={() => handleSelect(letter)}
                    disabled={showFeedback || isStriken}
                    className={`flex-1 flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all duration-200 ${rowStyle} ${isStriken ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {/* Radio */}
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${radioStyle}`}>
                      {(isSelected || (showFeedback && isCorrectAnswer)) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>

                    <span
                      className={`text-sm leading-relaxed flex-1 transition-colors ${
                        isStriken ? "line-through opacity-20 text-slate-500" :
                        showFeedback && isCorrectAnswer ? "text-emerald-100" :
                        showFeedback && isSelected && !isCorrectAnswer ? "text-rose-300" :
                        isSelected ? "text-white" : "text-slate-400"
                      }`}
                    >
                      <span className="font-black mr-2 text-slate-500 uppercase">{letter})</span>
                      {text}
                      {showFeedback && isCorrectAnswer && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="ml-3 inline-flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                        >
                          ✓ Gabarito
                        </motion.span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-400">
            <AlertCircle size={16} />
            <p className="text-xs font-bold">Alternativas não disponíveis para esta questão.</p>
          </div>
        )}

        {/* Confirm button */}
        <AnimatePresence>
          {!showFeedback && selectedOption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white text-[#020617] font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-[0_0_30px_rgba(255,255,255,0.08)] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving ? (
                  <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                ) : (
                  <><CheckCircle2 size={14} /> Confirmar Resposta</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Panel */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Result card */}
              <div className={`p-5 rounded-2xl border ${isCorrect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                <div className={`flex items-center gap-2 font-black text-base mb-2 ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                  {isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  {isCorrect ? "Você acertou!" : "Você errou."}
                </div>
                {!isCorrect && gabarito && (
                  <p className="text-xs text-slate-300">
                    A resposta correta é a alternativa{" "}
                    <strong className="text-emerald-400">{gabarito}</strong>.
                  </p>
                )}
              </div>

              {/* Explicação */}
              {question.explicacao && (
                <div className="p-5 rounded-2xl border border-indigo-500/15 bg-indigo-500/5">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                    <Sparkles size={11} />
                    Comentário
                  </div>
                  <p className="text-sm text-indigo-200/80 leading-relaxed">{question.explicacao}</p>
                </div>
              )}

              {/* Next button */}
              {questionIndex < totalQuestions - 1 && (
                <button
                  onClick={handleNext}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Próxima Questão <ChevronRight size={14} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
