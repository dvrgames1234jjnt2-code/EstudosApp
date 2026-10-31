"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Flag,
  X,
  Volume2,
  VolumeX,
  Folder,
  BookOpen,
  Target,
  RotateCcw,
} from "lucide-react";
import type { BancoQuestion } from "../banco/QuestionsTable";
import type { QuestionStats } from "../banco/CadernosTab";
import type { Caderno3DItem } from "./types";

interface OpenBookReaderProps {
  caderno: Caderno3DItem;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onClose: () => void;
  onAnswer: (questionId: string | number, answer: string, isCorrect: boolean) => Promise<void>;
  onToggleDuvida: (questionId: string | number) => Promise<void>;
  isAdmin?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Som realista de papel sendo virado
// ─────────────────────────────────────────────────────────────────────────────
function playPaperFlipSound(volume = 0.5) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const duration = 0.24;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Envelope: ramp up rapidamente, decay exponencial — simula impacto de papel
      const envelope = Math.pow(1 - t, 1.4) * Math.pow(t * 12, 0.3);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.12;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Filtro bandpass para timbre de papel aveludado
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.setValueAtTime(900, ctx.currentTime);
    bpf.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.12);
    bpf.Q.setValueAtTime(1.6, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(bpf);
    bpf.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente PageFlip — folha voando de um lado ao outro
// ─────────────────────────────────────────────────────────────────────────────
function PageFlipEffect({
  direction,
  progress,
  frontContent,
  backContent,
}: {
  direction: "next" | "prev";
  progress: number; // 0→1
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
}) {
  // Curva de Bézier simulando rigidez suave do papel
  const ease =
    progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const rotateY = direction === "next" ? -ease * 180 : ease * 180 - 180;

  // Curvatura 3D do papel: perspectiva de dobragem
  const skewX = Math.sin(ease * Math.PI) * (direction === "next" ? -14 : 14);

  // Sombra dinâmica entre folhas: máximo no meio da virada
  const shadowIntensity = Math.sin(ease * Math.PI);
  const shadowSpread = Math.round(shadowIntensity * 40);
  const shadowAlpha = (shadowIntensity * 0.55).toFixed(2);

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: direction === "next" ? "left center" : "right center",
        transform: `perspective(2400px) rotateY(${rotateY}deg) skewX(${skewX}deg)`,
        transition: "none",
        boxShadow:
          shadowIntensity > 0.05
            ? `${direction === "next" ? "" : "-"}${shadowSpread}px 0 ${shadowSpread * 2}px rgba(20, 12, 4, ${shadowAlpha})`
            : "none",
      }}
    >
      {/* Frente da folha (conteúdo saindo) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backfaceVisibility: "hidden",
          background:
            "linear-gradient(to right, #ece3cb 0%, #faf7ee 8%, #fcfbf6 90%, #ece4cf 100%)",
        }}
      >
        {/* Gradiente de sombra de dobragem na borda que se aproxima da lombada */}
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            width: "60px",
            [direction === "next" ? "left" : "right"]: 0,
            background: `linear-gradient(${direction === "next" ? "to right" : "to left"}, rgba(40,22,8,${(shadowIntensity * 0.45).toFixed(2)}), transparent)`,
          }}
        />
        {frontContent}
      </div>

      {/* Verso da folha (conteúdo que vai aparecer) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background:
            "linear-gradient(to left, #ece3cb 0%, #faf7ee 8%, #fcfbf6 90%, #ece4cf 100%)",
        }}
      >
        {backContent}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteúdo de uma única página de questão
// ─────────────────────────────────────────────────────────────────────────────
function QuestionPageContent({
  question,
  questionNumber,
  totalQuestions,
  userAnswers,
  duvidas,
  onAnswer,
  onToggleDuvida,
  pageNumber,
}: {
  question: BancoQuestion | undefined;
  questionNumber: number;
  totalQuestions: number;
  userAnswers: Record<string, QuestionStats>;
  duvidas: Set<string>;
  onAnswer: (altLetter: string) => void;
  onToggleDuvida: () => void;
  pageNumber: number;
}) {
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    setShowExplanation(false);
  }, [question?.id]);

  const currentStats = question ? userAnswers[String(question.id)] : undefined;
  const isCurrentDuvida = question ? duvidas.has(String(question.id)) : false;

  const correctLetter = useMemo(() => {
    if (!question) return "";
    return (question.respostaCorreta || question.Gabarito || "")
      .trim()
      .toUpperCase()
      .charAt(0);
  }, [question]);

  const alternatives = useMemo(() => {
    if (!question) return [];
    const keys: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];
    return keys
      .map((k) => {
        const text =
          (question as any)[`Alternativa ${k}`] ||
          (question as any)[`alternativa_${k.toLowerCase()}`];
        return text ? { letter: k, text: String(text).trim() } : null;
      })
      .filter(Boolean) as { letter: string; text: string }[];
  }, [question]);

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <BookOpen size={36} className="text-stone-400 mb-3" />
        <p className="font-serif text-stone-600 text-sm">Caderno vazio</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-5 md:p-7 overflow-y-auto">
      {/* Cabeçalho da Questão */}
      <div className="flex items-center justify-between pb-2.5 border-b border-stone-300/80 mb-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-serif font-bold text-amber-900 text-[13px]">
            Questão {questionNumber} de {totalQuestions}
          </span>
          {question.ID_Qconcursos && (
            <span className="text-[10px] font-mono bg-amber-900/10 text-amber-900 px-1.5 py-0.5 rounded border border-amber-900/20">
              {question.ID_Qconcursos}
            </span>
          )}
          {question.dificuldade && (
            <span className="text-[10px] font-serif uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 border border-stone-300/60">
              {question.dificuldade}
            </span>
          )}
        </div>

        <button
          onClick={onToggleDuvida}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-serif transition-all shrink-0 ${
            isCurrentDuvida
              ? "bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
              : "text-stone-500 hover:bg-stone-200/80"
          }`}
          title="Marcar dúvida"
        >
          <Flag size={12} className={isCurrentDuvida ? "fill-amber-600 text-amber-600" : ""} />
          <span className="hidden sm:inline">{isCurrentDuvida ? "Dúvida" : "Marcar"}</span>
        </button>
      </div>

      {/* Texto de Apoio */}
      {(question["Texto de apoio"] || question.perguntaProblema) && (
        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/50 font-serif text-[11.5px] text-stone-700 leading-relaxed italic mb-3 shrink-0">
          <p className="whitespace-pre-line">
            {question["Texto de apoio"] || question.perguntaProblema}
          </p>
        </div>
      )}

      {/* Imagem do enunciado */}
      {question.imagemEnunciado && (
        <div className="mb-3 rounded border border-stone-300 overflow-hidden max-h-36 flex justify-center bg-white shrink-0">
          <img
            src={question.imagemEnunciado}
            alt="Imagem da questão"
            className="object-contain max-h-36"
          />
        </div>
      )}

      {/* Enunciado */}
      <div className="font-serif text-[12.5px] leading-relaxed text-stone-900 mb-4">
        <p className="whitespace-pre-line">{question.title}</p>
      </div>

      {/* Alternativas */}
      <div className="space-y-1.5 flex-1">
        {alternatives.map((alt) => {
          const isAnswered = Boolean(currentStats);
          const isCorrectAlt = alt.letter === correctLetter;
          const wasUserChoice = currentStats?.lastAnswer?.toUpperCase() === alt.letter;

          let rowStyle =
            "bg-white/80 hover:bg-white text-stone-800 border-stone-300/80 hover:border-amber-700/50 cursor-pointer";

          if (isAnswered) {
            if (isCorrectAlt) {
              rowStyle = "bg-emerald-50 text-emerald-900 border-emerald-400 cursor-default";
            } else if (wasUserChoice && !currentStats?.isCorrect) {
              rowStyle = "bg-rose-50 text-rose-800 border-rose-300 line-through opacity-80 cursor-default";
            } else {
              rowStyle = "bg-stone-100/50 text-stone-400 border-stone-200/60 opacity-50 cursor-default";
            }
          }

          return (
            <div
              key={alt.letter}
              onClick={() => !isAnswered && onAnswer(alt.letter)}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all ${rowStyle}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5 border ${
                  isAnswered && isCorrectAlt
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : isAnswered && wasUserChoice && !currentStats?.isCorrect
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-stone-200/90 text-stone-700 border-stone-300"
                }`}
              >
                {alt.letter}
              </span>
              <span className="text-[12px] font-serif leading-relaxed">{alt.text}</span>
            </div>
          );
        })}
      </div>

      {/* Resultado e Comentário */}
      {currentStats && (
        <div className="mt-3 shrink-0">
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between ${
              currentStats.isCorrect
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {currentStats.isCorrect ? (
                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
              ) : (
                <XCircle size={15} className="text-rose-700 shrink-0" />
              )}
              <span className="font-serif font-bold text-[11px]">
                {currentStats.isCorrect
                  ? "Correto!"
                  : `Gabarito: Letra ${correctLetter}`}
              </span>
            </div>

            {question.explicacao && (
              <button
                onClick={() => setShowExplanation((v) => !v)}
                className="text-[10px] font-serif underline text-amber-900 hover:text-amber-950 font-medium shrink-0 ml-2"
              >
                {showExplanation ? "Ocultar" : "Comentário"}
              </button>
            )}
          </div>

          {showExplanation && question.explicacao && (
            <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50/90 border border-amber-300/60 font-serif text-[11px] text-stone-800 leading-relaxed">
              <span className="block font-bold text-amber-900 mb-0.5">Comentário:</span>
              <p className="whitespace-pre-line">{question.explicacao}</p>
            </div>
          )}
        </div>
      )}

      {/* Rodapé da página com número */}
      <div className="mt-2 pt-2 border-t border-stone-300/60 text-[9px] text-stone-400 font-mono text-right shrink-0">
        Pág. {pageNumber}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal: Leitor de Livro Aberto 3D
// ─────────────────────────────────────────────────────────────────────────────
export default function OpenBookReader({
  caderno,
  userAnswers,
  duvidas,
  onClose,
  onAnswer,
  onToggleDuvida,
  isAdmin,
}: OpenBookReaderProps) {
  const [selectedCasoId, setSelectedCasoId] = useState<string>("todos");
  const [filterMode, setFilterMode] = useState<"todos" | "erros" | "duvidas" | "pendentes">("todos");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Estado de virada de página
  const [flip, setFlip] = useState<{ direction: "next" | "prev"; progress: number } | null>(null);
  const flipRafRef = useRef<number | null>(null);

  // Edge hover para corner peel
  const [edgeHover, setEdgeHover] = useState<"right" | "left" | null>(null);

  // Mostrar/esconder o sumário lateral
  const [showSummary, setShowSummary] = useState(false);

  // Lista filtrada de questões
  const filteredQuestions = useMemo(() => {
    let list = caderno.questoes;
    if (selectedCasoId !== "todos") {
      const caso = caderno.casos.find((c) => c.id === selectedCasoId);
      list = caso ? caso.questoes : list;
    }
    if (filterMode === "erros") list = list.filter((q) => userAnswers[String(q.id)]?.isCorrect === false);
    else if (filterMode === "duvidas") list = list.filter((q) => duvidas.has(String(q.id)));
    else if (filterMode === "pendentes") list = list.filter((q) => !userAnswers[String(q.id)]);
    return list;
  }, [caderno, selectedCasoId, filterMode, userAnswers, duvidas]);

  // Garante índice válido ao mudar filtro
  useEffect(() => {
    if (currentIndex >= filteredQuestions.length && filteredQuestions.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredQuestions.length, currentIndex]);

  // Questão atual, anterior e próxima
  const currentQ = filteredQuestions[currentIndex];
  const nextQ = filteredQuestions[currentIndex + 1];
  const prevQ = filteredQuestions[currentIndex - 1];

  // Estatísticas do caderno
  const stats = useMemo(() => {
    let acertos = 0, erros = 0, totalDuvidas = 0;
    caderno.questoes.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) { if (st.isCorrect) acertos++; else erros++; }
      if (duvidas.has(String(q.id))) totalDuvidas++;
    });
    const respondidas = acertos + erros;
    const taxa = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0;
    return { acertos, erros, respondidas, taxa, totalDuvidas };
  }, [caderno.questoes, userAnswers, duvidas]);

  // ── Animação de folheamento via rAF ──────────────────────────────────────
  const FLIP_DURATION = 480; // ms

  const executeFlip = useCallback(
    (direction: "next" | "prev") => {
      if (flip) return;
      const canGo = direction === "next"
        ? currentIndex < filteredQuestions.length - 1
        : currentIndex > 0;
      if (!canGo) return;

      if (soundEnabled) playPaperFlipSound();

      const start = performance.now();
      setFlip({ direction, progress: 0 });

      const step = (now: number) => {
        const raw = Math.min(1, (now - start) / FLIP_DURATION);
        const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;

        setFlip({ direction, progress: eased });

        if (raw < 1) {
          flipRafRef.current = requestAnimationFrame(step);
        } else {
          setCurrentIndex((prev) => (direction === "next" ? prev + 1 : prev - 1));
          setFlip(null);
        }
      };

      flipRafRef.current = requestAnimationFrame(step);
    },
    [flip, currentIndex, filteredQuestions.length, soundEnabled]
  );

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") executeFlip("next");
      else if (e.key === "ArrowLeft") executeFlip("prev");
      else if (e.key === "Escape") onClose();
      else if (["a", "b", "c", "d", "e"].includes(e.key.toLowerCase())) {
        const qid = currentQ?.id;
        if (qid && !userAnswers[String(qid)]) {
          handleAnswerQuestion(e.key.toUpperCase());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [executeFlip, onClose, currentQ, userAnswers]);

  // Cleanup rAF ao desmontar
  useEffect(() => {
    return () => {
      if (flipRafRef.current) cancelAnimationFrame(flipRafRef.current);
    };
  }, []);

  const handleAnswerQuestion = async (letter: string) => {
    if (!currentQ) return;
    const correct = (currentQ.respostaCorreta || currentQ.Gabarito || "").trim().toUpperCase().charAt(0);
    const isCorrect = letter === correct;
    try {
      await onAnswer(currentQ.id, letter, isCorrect);
    } catch (e) {
      console.error(e);
    }
  };

  // Pilhas laterais de folhas (espessura visual proporcional ao progresso)
  const total = Math.max(1, filteredQuestions.length);
  const leftPx = Math.round(4 + (currentIndex / total) * 20);
  const rightPx = Math.round(4 + ((total - currentIndex) / total) * 20);

  // Percentual de progresso no anel de progresso
  const progressAngle = (stats.respondidas / Math.max(1, caderno.questoes.length)) * 360;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-md overflow-hidden select-none"
    >
      {/* ── BARRA DE CONTROLES ──────────────────────────────────────────────── */}
      <div className="absolute top-3 inset-x-4 z-60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Fechar */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition-all text-xs"
          >
            <ChevronLeft size={13} />
            <span>Fechar Livro</span>
          </button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-stone-900/70 border border-stone-700/40 text-xs">
            <span className="text-amber-400 font-serif">✦ {caderno.materia}</span>
            <span className="text-stone-600">/</span>
            <span className="text-stone-300 truncate max-w-[200px]">{caderno.nome}</span>
          </div>

          {/* Botão sumário */}
          <button
            onClick={() => setShowSummary((v) => !v)}
            className={`p-1.5 rounded-lg border shadow transition-all text-xs ${
              showSummary
                ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                : "bg-stone-900/90 text-stone-400 hover:text-amber-300 border-stone-700/50"
            }`}
            title="Abrir/fechar sumário"
          >
            <Folder size={15} />
          </button>
        </div>

        {/* Controles direita */}
        <div className="flex items-center gap-2">
          {/* Progresso */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-stone-900/80 border border-stone-700/50 text-[10px] font-serif text-stone-400">
            <Target size={12} className="text-amber-400" />
            <span>{stats.acertos}/{stats.respondidas}</span>
            <span className="text-emerald-400 font-bold">{stats.taxa}%</span>
          </div>

          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="p-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-400 hover:text-amber-300 border border-stone-700/50 shadow transition-all"
            title={soundEnabled ? "Desativar som de papel" : "Ativar som de papel"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-900/90 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 border border-stone-700/50 shadow transition-all"
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── SUMÁRIO LATERAL (Drawer) ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-stone-900/98 border-r border-stone-700/60 shadow-2xl overflow-y-auto flex flex-col"
          >
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h3 className="font-serif font-bold text-stone-100 text-sm">{caderno.nome}</h3>
              <button
                onClick={() => setShowSummary(false)}
                className="p-1 rounded hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Estatísticas resumidas */}
            <div className="grid grid-cols-2 gap-2 p-4 border-b border-stone-800">
              <div className="text-center p-2 bg-stone-800/60 rounded-lg">
                <span className="block text-[10px] text-stone-500 uppercase mb-0.5">Acertos</span>
                <span className="font-bold text-emerald-400">{stats.acertos}</span>
              </div>
              <div className="text-center p-2 bg-stone-800/60 rounded-lg">
                <span className="block text-[10px] text-stone-500 uppercase mb-0.5">Erros</span>
                <span className="font-bold text-rose-400">{stats.erros}</span>
              </div>
              <div className="text-center p-2 bg-stone-800/60 rounded-lg">
                <span className="block text-[10px] text-stone-500 uppercase mb-0.5">Dúvidas</span>
                <span className="font-bold text-amber-400">{stats.totalDuvidas}</span>
              </div>
              <div className="text-center p-2 bg-stone-800/60 rounded-lg">
                <span className="block text-[10px] text-stone-500 uppercase mb-0.5">Taxa</span>
                <span className="font-bold text-blue-400">{stats.taxa}%</span>
              </div>
            </div>

            {/* Casos */}
            <div className="p-4 border-b border-stone-800">
              <span className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Casos</span>
              <div className="space-y-1">
                <button
                  onClick={() => { setSelectedCasoId("todos"); setCurrentIndex(0); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all flex items-center justify-between ${
                    selectedCasoId === "todos"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                  }`}
                >
                  <span>Todos os casos</span>
                  <span className="text-[10px] text-stone-500">{caderno.questoes.length}</span>
                </button>
                {caderno.casos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCasoId(c.id); setCurrentIndex(0); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all flex items-center justify-between ${
                      selectedCasoId === c.id
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                    }`}
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="text-[10px] text-stone-500 shrink-0 ml-1">{c.questoes.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div className="p-4 border-b border-stone-800">
              <span className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Filtro</span>
              <div className="grid grid-cols-2 gap-1">
                {(["todos", "pendentes", "erros", "duvidas"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilterMode(f); setCurrentIndex(0); }}
                    className={`py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                      filterMode === f
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "text-stone-500 hover:bg-stone-800 hover:text-stone-300"
                    }`}
                  >
                    {f === "todos" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de questões */}
            <div className="p-4 flex-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase block mb-2">
                {filteredQuestions.length} questões
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {filteredQuestions.map((q, idx) => {
                  const st = userAnswers[String(q.id)];
                  const isDuv = duvidas.has(String(q.id));
                  const isCur = idx === currentIndex;

                  let cls = "bg-stone-800 text-stone-500 border-stone-700";
                  if (st?.isCorrect) cls = "bg-emerald-900/50 text-emerald-300 border-emerald-700/50";
                  else if (st) cls = "bg-rose-900/50 text-rose-300 border-rose-700/50";

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        if (soundEnabled) playPaperFlipSound(0.3);
                        setCurrentIndex(idx);
                        setShowSummary(false);
                      }}
                      className={`relative h-7 rounded text-[10px] font-mono flex items-center justify-center border transition-all ${cls} ${
                        isCur ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-stone-900" : "hover:opacity-80"
                      }`}
                    >
                      {idx + 1}
                      {isDuv && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── O LIVRO ABERTO ──────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-[90vw] md:max-w-6xl h-[87vh] mt-10 flex items-center justify-center"
        style={{ perspective: "2800px" }}
      >
        {/* Capa de couro do livro — fundo visual */}
        <div
          className="absolute inset-0 rounded-xl shadow-[0_40px_120px_rgba(0,0,0,0.98)] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${caderno.accentColor || "#244d3e"} 0%, ${caderno.coverColor || "#162f26"} 70%, #080a0e 100%)`,
            border: "7px solid #0d1209",
            boxShadow: `0 30px 80px -10px rgba(0,0,0,0.96), 0 0 0 1.5px ${caderno.goldTone || "#d4af37"}40 inset`,
          }}
        />

        {/* Fita Marcadora */}
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-28 pointer-events-none z-40"
          style={{
            background: "linear-gradient(to right, #7a0f1c, #b31f2f, #7a0f1c)",
            boxShadow: "0 5px 12px rgba(0,0,0,0.7)",
            borderBottom: "11px solid transparent",
            borderLeft: "10px solid #7a0f1c",
            borderRight: "10px solid #7a0f1c",
          }}
        />

        {/* Pilha de folhas à esquerda (já lidas) */}
        <div
          className="absolute left-4 top-6 bottom-6 rounded-l pointer-events-none transition-all duration-500"
          style={{
            width: `${leftPx}px`,
            background: "repeating-linear-gradient(to right, #d9cfb3, #d9cfb3 1px, #f0e8d4 1px, #f0e8d4 2px)",
            boxShadow: "inset 5px 0 10px rgba(50,30,10,0.3)",
            borderLeft: "1px solid #c0b08a",
          }}
        />

        {/* Pilha de folhas à direita (por ler) */}
        <div
          className="absolute right-4 top-6 bottom-6 rounded-r pointer-events-none transition-all duration-500"
          style={{
            width: `${rightPx}px`,
            background: "repeating-linear-gradient(to left, #d9cfb3, #d9cfb3 1px, #f0e8d4 1px, #f0e8d4 2px)",
            boxShadow: "inset -5px 0 10px rgba(50,30,10,0.3)",
            borderRight: "1px solid #c0b08a",
          }}
        />

        {/* ── SPREAD DE DUAS PÁGINAS ──────────────────────────────────────────── */}
        <div
          className="relative w-[93%] h-[92%] flex overflow-hidden rounded-lg"
          style={{ transformStyle: "preserve-3d", boxShadow: "0 15px 50px rgba(0,0,0,0.6)" }}
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PÁGINA ESQUERDA — Questão atual (coluna da esquerda no spread)  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div
            className="w-[calc(50%-20px)] h-full bg-[#faf7ee] overflow-hidden relative"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e8dcc6 0%, #faf7ee 9%, #fcfbf6 90%, #ece4cf 100%)",
              boxShadow: "inset 22px 0 32px -10px rgba(60,38,12,0.2)",
              transformOrigin: "right center",
              transform: "perspective(900px) rotateY(4deg)",
            }}
            onMouseEnter={() => setEdgeHover("left")}
            onMouseLeave={() => setEdgeHover(null)}
          >
            {/* Corner peel na borda esquerda ao hover — volta página */}
            {edgeHover === "left" && currentIndex > 0 && !flip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute bottom-2 left-2 w-12 h-12 z-30 cursor-pointer flex items-end justify-start p-1.5"
                style={{
                  clipPath: "polygon(0 0, 0 100%, 100% 100%)",
                  background: "linear-gradient(315deg, #f0e8d4, #faf7ee)",
                  boxShadow: "4px -4px 12px rgba(0,0,0,0.18)",
                }}
                onClick={() => executeFlip("prev")}
                title="Clique para voltar"
              >
                <ChevronLeft size={12} className="text-amber-900" />
              </motion.div>
            )}

            <QuestionPageContent
              question={currentQ}
              questionNumber={currentIndex + 1}
              totalQuestions={filteredQuestions.length}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onAnswer={handleAnswerQuestion}
              onToggleDuvida={() => currentQ && onToggleDuvida(currentQ.id)}
              pageNumber={currentIndex * 2 + 1}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* VINCO CENTRAL (Gutter / Lombada interna)                        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div
            className="w-10 shrink-0 h-full z-20 pointer-events-none relative"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.01) 50%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.35) 100%)",
              boxShadow: "inset 0 0 22px rgba(0,0,0,0.5)",
            }}
          >
            <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-amber-950/20 -translate-x-1/2" />
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PÁGINA DIREITA — Próxima questão (coluna da direita no spread)  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div
            className="w-[calc(50%-20px)] h-full bg-[#faf7ee] overflow-hidden relative"
            style={{
              backgroundImage:
                "linear-gradient(to left, #e8dcc6 0%, #faf7ee 9%, #fcfbf6 90%, #ece4cf 100%)",
              boxShadow: "inset -22px 0 32px -10px rgba(60,38,12,0.2)",
              transformOrigin: "left center",
              transform: "perspective(900px) rotateY(-4deg)",
            }}
            onMouseEnter={() => setEdgeHover("right")}
            onMouseLeave={() => setEdgeHover(null)}
          >
            {/* Corner peel na borda direita ao hover — avança página */}
            {edgeHover === "right" && currentIndex < filteredQuestions.length - 1 && !flip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute bottom-2 right-2 w-12 h-12 z-30 cursor-pointer flex items-end justify-end p-1.5"
                style={{
                  clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
                  background: "linear-gradient(135deg, #f0e8d4, #faf7ee)",
                  boxShadow: "-4px -4px 12px rgba(0,0,0,0.18)",
                }}
                onClick={() => executeFlip("next")}
                title="Clique para virar"
              >
                <ChevronRight size={12} className="text-amber-900" />
              </motion.div>
            )}

            <QuestionPageContent
              question={nextQ}
              questionNumber={currentIndex + 2}
              totalQuestions={filteredQuestions.length}
              userAnswers={userAnswers}
              duvidas={duvidas}
              onAnswer={handleAnswerQuestion}
              onToggleDuvida={() => nextQ && onToggleDuvida(nextQ.id)}
              pageNumber={currentIndex * 2 + 2}
            />

            {/* ── FOLHA VOANDO (Page Flip Effect 3D) ────────────────────── */}
            {flip && (
              <PageFlipEffect
                direction={flip.direction}
                progress={flip.progress}
                frontContent={
                  <QuestionPageContent
                    question={flip.direction === "next" ? nextQ : prevQ}
                    questionNumber={flip.direction === "next" ? currentIndex + 2 : currentIndex}
                    totalQuestions={filteredQuestions.length}
                    userAnswers={userAnswers}
                    duvidas={duvidas}
                    onAnswer={handleAnswerQuestion}
                    onToggleDuvida={() => {}}
                    pageNumber={flip.direction === "next" ? currentIndex * 2 + 2 : currentIndex * 2}
                  />
                }
                backContent={
                  <QuestionPageContent
                    question={flip.direction === "next" ? filteredQuestions[currentIndex + 2] : currentQ}
                    questionNumber={flip.direction === "next" ? currentIndex + 3 : currentIndex + 1}
                    totalQuestions={filteredQuestions.length}
                    userAnswers={userAnswers}
                    duvidas={duvidas}
                    onAnswer={handleAnswerQuestion}
                    onToggleDuvida={() => {}}
                    pageNumber={flip.direction === "next" ? currentIndex * 2 + 3 : currentIndex * 2 + 1}
                  />
                }
              />
            )}
          </div>
        </div>

        {/* ── BARRA DE NAVEGAÇÃO INFERIOR ───────────────────────────────────── */}
        <div className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-4">
          <button
            onClick={() => executeFlip("prev")}
            disabled={currentIndex === 0 || !!flip}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-stone-900/85 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition-all text-xs disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
            <span>Anterior</span>
          </button>

          <span className="text-[10px] font-mono text-stone-500 px-3 py-1 bg-stone-900/70 rounded-full border border-stone-700/40">
            {currentIndex + 1} – {Math.min(currentIndex + 2, filteredQuestions.length)} / {filteredQuestions.length}
          </span>

          <button
            onClick={() => executeFlip("next")}
            disabled={currentIndex >= filteredQuestions.length - 1 || !!flip}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-900/20 hover:bg-amber-900/35 text-amber-200 border border-amber-800/40 shadow-lg transition-all text-xs font-medium disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <span>Próxima</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Dicas de atalho de teclado */}
        <div className="absolute -bottom-14 left-0 right-0 flex items-center justify-center gap-3 text-[9px] text-stone-600">
          <span>← → Navegar</span>
          <span>·</span>
          <span>A–E Responder</span>
          <span>·</span>
          <span>Esc Fechar</span>
        </div>
      </div>
    </motion.div>
  );
}
