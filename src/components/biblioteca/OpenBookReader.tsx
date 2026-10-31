"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  Flag,
  HelpCircle,
  X,
  Volume2,
  VolumeX,
  Folder,
  Layers,
  Sparkles,
  Award,
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

// Síntese de som realista de folhear papel usando Web Audio API
function playPaperFlipSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const duration = 0.22; // 220ms de fricção aveludada
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 1.6);
      data[i] = (Math.random() * 2 - 1) * decay * 0.09;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(700, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.16);
    filter.Q.setValueAtTime(1.4, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch (e) {
    // Silencia se bloqueado por autoplay policy
  }
}

export default function OpenBookReader({
  caderno,
  userAnswers,
  duvidas,
  onClose,
  onAnswer,
  onToggleDuvida,
  isAdmin,
}: OpenBookReaderProps) {
  // Filtros
  const [selectedCasoId, setSelectedCasoId] = useState<string>("todos");
  const [filterMode, setFilterMode] = useState<"todos" | "erros" | "duvidas" | "pendentes">("todos");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Lista de questões filtradas
  const filteredQuestions = useMemo(() => {
    let list = caderno.questoes;
    if (selectedCasoId !== "todos") {
      const caso = caderno.casos.find((c) => c.id === selectedCasoId);
      list = caso ? caso.questoes : list;
    }

    if (filterMode === "erros") {
      list = list.filter((q) => userAnswers[String(q.id)]?.isCorrect === false);
    } else if (filterMode === "duvidas") {
      list = list.filter((q) => duvidas.has(String(q.id)));
    } else if (filterMode === "pendentes") {
      list = list.filter((q) => !userAnswers[String(q.id)]);
    }

    return list;
  }, [caderno, selectedCasoId, filterMode, userAnswers, duvidas]);

  // Índice da página / questão atual
  const [currentIndex, setCurrentIndex] = useState(0);

  // Estados de folheamento 3D
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [flipProgress, setFlipProgress] = useState(0); // 0 a 1
  const [isEdgeHovered, setIsEdgeHovered] = useState<"right" | "left" | null>(null);

  // Questão atual e questão anterior/próxima durante a virada
  const currentQuestion = filteredQuestions[currentIndex];
  const nextQuestion = filteredQuestions[currentIndex + 1];
  const prevQuestion = filteredQuestions[currentIndex - 1];

  // Interação de resposta
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setSelectedAlternative(null);
    setShowExplanation(false);
  }, [currentIndex]);

  // Estatísticas do caderno
  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let totalDuvidas = 0;

    caderno.questoes.forEach((q) => {
      const st = userAnswers[String(q.id)];
      if (st) {
        if (st.isCorrect) acertos++;
        else erros++;
      }
      if (duvidas.has(String(q.id))) totalDuvidas++;
    });

    const respondidas = acertos + erros;
    const taxa = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0;
    return { acertos, erros, respondidas, taxa, totalDuvidas };
  }, [caderno.questoes, userAnswers, duvidas]);

  const currentStats = currentQuestion ? userAnswers[String(currentQuestion.id)] : undefined;
  const isCurrentDuvida = currentQuestion ? duvidas.has(String(currentQuestion.id)) : false;

  const correctLetter = useMemo(() => {
    if (!currentQuestion) return "";
    const g = (currentQuestion.respostaCorreta || currentQuestion.Gabarito || "").trim().toUpperCase();
    return g.charAt(0);
  }, [currentQuestion]);

  // ── Folheamento 3D Avançar ──────────────────────────────────────────────────
  const flipToNext = useCallback(() => {
    if (currentIndex < filteredQuestions.length - 1 && !flipDirection) {
      setFlipDirection("next");
      if (soundEnabled) playPaperFlipSound();

      // Executa animação contínua da folha
      let start: number | null = null;
      const duration = 460; // 460ms de folheamento elegante

      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min(1, (timestamp - start) / duration);
        // Easing bezier de papel
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setFlipProgress(eased);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setFlipDirection(null);
          setFlipProgress(0);
        }
      };

      requestAnimationFrame(step);
    }
  }, [currentIndex, filteredQuestions.length, flipDirection, soundEnabled]);

  // ── Folheamento 3D Voltar ───────────────────────────────────────────────────
  const flipToPrev = useCallback(() => {
    if (currentIndex > 0 && !flipDirection) {
      setFlipDirection("prev");
      if (soundEnabled) playPaperFlipSound();

      let start: number | null = null;
      const duration = 460;

      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min(1, (timestamp - start) / duration);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setFlipProgress(eased);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setCurrentIndex((prev) => prev - 1);
          setFlipDirection(null);
          setFlipProgress(0);
        }
      };

      requestAnimationFrame(step);
    }
  }, [currentIndex, flipDirection, soundEnabled]);

  // ── Atalhos de Teclado ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        flipToNext();
      } else if (e.key === "ArrowLeft") {
        flipToPrev();
      } else if (e.key === "Escape") {
        onClose();
      } else if (["a", "b", "c", "d", "e", "A", "B", "C", "D", "E"].includes(e.key)) {
        if (!currentStats) {
          setSelectedAlternative(e.key.toUpperCase());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipToNext, flipToPrev, onClose, currentStats]);

  // ── Responder Questão ───────────────────────────────────────────────────────
  const handleConfirmAnswer = async (altLetter: string) => {
    if (!currentQuestion || isSubmitting) return;
    setIsSubmitting(true);
    const isCorrect = altLetter.toUpperCase() === correctLetter;

    try {
      await onAnswer(currentQuestion.id, altLetter.toUpperCase(), isCorrect);
    } catch (e) {
      console.error("Erro ao registrar resposta:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const alternatives = useMemo(() => {
    if (!currentQuestion) return [];
    const list: { letter: string; text: string }[] = [];
    const keys: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];
    keys.forEach((k) => {
      const text =
        (currentQuestion as any)[`Alternativa ${k}`] ||
        (currentQuestion as any)[`alternativa_${k.toLowerCase()}`];
      if (text) {
        list.push({ letter: k, text: String(text).trim() });
      }
    });
    return list;
  }, [currentQuestion]);

  // Espessura dinâmica de folhas sobrepostas nas laterais do livro
  const totalCount = Math.max(1, filteredQuestions.length);
  const leftStackRatio = currentIndex / totalCount;
  const rightStackRatio = (totalCount - currentIndex) / totalCount;

  const leftStackPx = Math.round(3 + leftStackRatio * 18);
  const rightStackPx = Math.round(3 + rightStackRatio * 18);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none overflow-hidden"
    >
      {/* ── BARRA DE CONTROLES NO TOPO ──────────────────────────────────────── */}
      <div className="absolute top-3 left-4 right-4 z-50 flex items-center justify-between text-amber-100/90">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition-all text-xs"
          >
            <ChevronLeft size={14} />
            <span>Fechar Livro</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-stone-900/70 border border-stone-700/40 text-xs">
            <span className="text-amber-400 font-serif">✦ {caderno.materia}</span>
            <span className="text-stone-500">/</span>
            <span className="text-stone-300 truncate max-w-[220px]">{caderno.nome}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Desativar som de virar papel" : "Ativar som de virar papel"}
            className="p-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-400 hover:text-amber-300 border border-stone-700/50 shadow transition-all"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-900/90 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 border border-stone-700/50 shadow transition-all"
            title="Fechar Livro e Voltar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── CENÁRIO TRIDIMENSIONAL DO LIVRO ABERTO ──────────────────────────── */}
      <div
        className="relative w-full max-w-6xl h-[86vh] flex items-center justify-center"
        style={{ perspective: "2600px" }}
      >
        {/* Capa de Couro Externa do Livro com Espessura e Cantoneiras Douradas */}
        <div
          className="absolute inset-0 rounded-2xl shadow-[0_35px_100px_rgba(0,0,0,0.95)] -z-10"
          style={{
            backgroundColor: caderno.coverColor || "#1b281f",
            backgroundImage:
              "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08), rgba(0,0,0,0.85))",
            border: "8px solid #141a16",
            boxShadow:
              "0 25px 70px -10px rgba(0, 0, 0, 0.95), 0 0 0 1.5px rgba(212, 175, 55, 0.3) inset",
          }}
        />

        {/* Fita de Cetim Marcadora de Página (Bookmark Ribbon) */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-32 pointer-events-none z-40 transition-all duration-300"
          style={{
            background: "linear-gradient(to right, #80121f, #b31f2f, #80121f)",
            boxShadow: "0 6px 14px rgba(0,0,0,0.6)",
            borderBottom: "12px solid transparent",
            borderLeft: "12px solid #80121f",
            borderRight: "12px solid #80121f",
          }}
        />

        {/* Bloco Lateral de Folhas Empilhadas à Esquerda (Páginas já lidas) */}
        <div
          className="absolute left-3 top-6 bottom-6 rounded-l-md pointer-events-none z-0 transition-all duration-300"
          style={{
            width: `${leftStackPx}px`,
            background:
              "repeating-linear-gradient(to right, #e2d7bd, #e2d7bd 1px, #f2ecdc 1px, #f2ecdc 2px)",
            boxShadow: "inset 4px 0 8px rgba(60,40,20,0.25)",
            borderLeft: "1px solid #c8bc9f",
          }}
        />

        {/* Bloco Lateral de Folhas Empilhadas à Direita (Páginas restantes) */}
        <div
          className="absolute right-3 top-6 bottom-6 rounded-r-md pointer-events-none z-0 transition-all duration-300"
          style={{
            width: `${rightStackPx}px`,
            background:
              "repeating-linear-gradient(to left, #e2d7bd, #e2d7bd 1px, #f2ecdc 1px, #f2ecdc 2px)",
            boxShadow: "inset -4px 0 8px rgba(60,40,20,0.25)",
            borderRight: "1px solid #c8bc9f",
          }}
        />

        {/* ── MIOLO DO LIVRO COM DUAS PÁGINAS EM ARCO 3D ──────────────────────── */}
        <div
          className="relative w-[95%] h-[93%] flex rounded-lg overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            boxShadow: "0 12px 45px rgba(0,0,0,0.6)",
          }}
        >
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA ESQUERDA (VERSO)                                           */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            className="w-1/2 h-full flex flex-col p-6 md:p-8 bg-[#faf7ee] text-stone-800 relative border-r border-amber-900/10 overflow-y-auto"
            style={{
              backgroundImage:
                "linear-gradient(to right, #eae0c8 0%, #faf7ee 10%, #fcfbf6 88%, #ece4cf 100%)",
              boxShadow: "inset 20px 0 30px -10px rgba(70, 45, 15, 0.18)",
              transformOrigin: "right center",
              transform: "rotateY(3deg)",
            }}
          >
            {/* Cabeçalho da Página Esquerda */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-300/80 mb-4">
              <div>
                <span className="text-[10px] font-serif uppercase tracking-widest text-amber-900/70 font-semibold">
                  Caderno de Estudos
                </span>
                <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">
                  {caderno.nome}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-stone-600 block">
                  {stats.respondidas}/{caderno.questoes.length}
                </span>
                <span className="text-[10px] font-semibold text-emerald-800">
                  {stats.taxa}% Acerto
                </span>
              </div>
            </div>

            {/* Painel Estatístico */}
            <div className="grid grid-cols-4 gap-2 mb-4 p-2.5 rounded-lg bg-stone-200/50 border border-stone-300/60 text-center font-serif text-xs">
              <div className="p-1">
                <span className="block text-[10px] text-stone-500 uppercase">Total</span>
                <span className="font-bold text-stone-800 text-sm">{caderno.questoes.length}</span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] text-emerald-700 uppercase">Acertos</span>
                <span className="font-bold text-emerald-800 text-sm">{stats.acertos}</span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] text-rose-700 uppercase">Erros</span>
                <span className="font-bold text-rose-800 text-sm">{stats.erros}</span>
              </div>
              <div className="p-1">
                <span className="block text-[10px] text-amber-700 uppercase">Dúvidas</span>
                <span className="font-bold text-amber-800 text-sm">{stats.totalDuvidas}</span>
              </div>
            </div>

            {/* Seletor de Casos */}
            <div className="mb-4">
              <label className="text-[11px] font-serif text-stone-600 font-semibold mb-1.5 flex items-center gap-1.5">
                <Folder size={12} className="text-amber-800" />
                <span>Casos & Capítulos:</span>
              </label>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                <button
                  onClick={() => {
                    setSelectedCasoId("todos");
                    setCurrentIndex(0);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded text-xs transition-all flex items-center justify-between ${
                    selectedCasoId === "todos"
                      ? "bg-amber-900/15 font-semibold text-amber-950 border border-amber-900/20"
                      : "hover:bg-stone-200/60 text-stone-700"
                  }`}
                >
                  <span className="truncate">Todos os Casos</span>
                  <span className="text-[10px] text-stone-500">{caderno.questoes.length}</span>
                </button>

                {caderno.casos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCasoId(c.id);
                      setCurrentIndex(0);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded text-xs transition-all flex items-center justify-between ${
                      selectedCasoId === c.id
                        ? "bg-amber-900/15 font-semibold text-amber-950 border border-amber-900/20"
                        : "hover:bg-stone-200/60 text-stone-700"
                    }`}
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="text-[10px] text-stone-500">{c.questoes.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros de Questões */}
            <div className="mb-4">
              <div className="flex items-center gap-1 p-1 bg-stone-200/60 rounded-md border border-stone-300/60 text-[11px] font-serif">
                {(
                  [
                    { key: "todos", label: "Todas" },
                    { key: "pendentes", label: "Pendentes" },
                    { key: "erros", label: "Erros" },
                    { key: "duvidas", label: "Dúvidas" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFilterMode(f.key);
                      setCurrentIndex(0);
                    }}
                    className={`flex-1 py-1 rounded text-center transition-all ${
                      filterMode === f.key
                        ? "bg-white font-semibold text-stone-900 shadow-sm"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Minigrid de Questões */}
            <div className="flex-1 overflow-y-auto">
              <span className="text-[10px] font-serif text-stone-500 uppercase block mb-1">
                Folhas de Questões ({filteredQuestions.length}):
              </span>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {filteredQuestions.map((q, idx) => {
                  const st = userAnswers[String(q.id)];
                  const isDuv = duvidas.has(String(q.id));
                  const isCurrent = idx === currentIndex;

                  let badgeColor = "bg-stone-200 text-stone-600 border-stone-300";
                  if (st?.isCorrect) badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
                  else if (st && !st.isCorrect) badgeColor = "bg-rose-100 text-rose-800 border-rose-300";

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        if (idx !== currentIndex) {
                          if (soundEnabled) playPaperFlipSound();
                          setCurrentIndex(idx);
                        }
                      }}
                      className={`relative h-7 rounded text-[11px] font-mono flex items-center justify-center border transition-all ${badgeColor} ${
                        isCurrent
                          ? "ring-2 ring-amber-800 ring-offset-1 font-bold shadow-sm"
                          : "hover:opacity-80"
                      }`}
                    >
                      {idx + 1}
                      {isDuv && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rodapé da Página Esquerda */}
            <div className="pt-3 border-t border-stone-300/80 text-[10px] text-stone-500 font-serif flex items-center justify-between mt-auto">
              <span>Biblioteca de Estudos 3D</span>
              <span className="font-mono">Pág. {currentIndex * 2 + 1}</span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* LOMBADA CENTRAL DO LIVRO (Costura & Sombra Gutter)                */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            className="w-10 shrink-0 h-full relative z-30 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.06) 35%, rgba(0,0,0,0.01) 50%, rgba(0,0,0,0.06) 65%, rgba(0,0,0,0.32) 100%)",
              boxShadow: "inset 0 0 18px rgba(0,0,0,0.4)",
            }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-amber-950/25" />
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA DIREITA (RETO) COM ANIMAÇÃO DE FOLHEAMENTO 3D              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            onMouseEnter={() => setIsEdgeHovered("right")}
            onMouseLeave={() => setIsEdgeHovered(null)}
            className="w-1/2 h-full flex flex-col p-6 md:p-8 bg-[#faf7ee] text-stone-800 relative border-l border-amber-900/10 overflow-y-auto"
            style={{
              backgroundImage:
                "linear-gradient(to left, #eae0c8 0%, #faf7ee 10%, #fcfbf6 88%, #ece4cf 100%)",
              boxShadow: "inset -20px 0 30px -10px rgba(70, 45, 15, 0.18)",
              transformOrigin: "left center",
              transform: "rotateY(-3deg)",
            }}
          >
            {/* ── FOLHA TRIDIMENSIONAL QUE VIRA (PAGE FLIP REALISTA) ──────── */}
            {flipDirection && (
              <div
                className="absolute inset-0 z-40 pointer-events-none origin-left overflow-hidden"
                style={{
                  transform:
                    flipDirection === "next"
                      ? `rotateY(${-flipProgress * 180}deg)`
                      : `rotateY(${(-1 + flipProgress) * 180}deg)`,
                  transformStyle: "preserve-3d",
                  boxShadow:
                    flipProgress > 0.1 && flipProgress < 0.9
                      ? "30px 0 60px rgba(0,0,0,0.45)"
                      : "none",
                  background:
                    "linear-gradient(to right, #ece3cb 0%, #faf7ee 30%, #fcfbf6 90%, #eae0c8 100%)",
                }}
              >
                {/* Sombra Dinâmica na Folha enquanto ela dobra */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `rgba(40, 25, 10, ${Math.sin(flipProgress * Math.PI) * 0.35})`,
                  }}
                />
              </div>
            )}

            {/* ── PEEL CURL NO HOVER DO CANTO INFERIOR DIREITO ────────────── */}
            {isEdgeHovered === "right" && !flipDirection && currentIndex < filteredQuestions.length - 1 && (
              <div
                onClick={flipToNext}
                className="absolute bottom-2 right-2 w-14 h-14 cursor-pointer z-30 flex items-end justify-end p-2 transition-transform duration-200"
                style={{
                  clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
                  background: "linear-gradient(135deg, rgba(200, 180, 140, 0.6), #faf7ee)",
                  boxShadow: "-4px -4px 12px rgba(0,0,0,0.2)",
                  transform: "translateZ(8px) scale(1.05)",
                }}
                title="Clique para virar para a próxima página"
              >
                <ChevronRight size={14} className="text-amber-900" />
              </div>
            )}

            {currentQuestion ? (
              <div className="flex flex-col h-full">
                {/* Cabeçalho da Questão */}
                <div className="flex items-center justify-between pb-3 border-b border-stone-300/80 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-amber-900 text-sm">
                      Questão {currentIndex + 1} de {filteredQuestions.length}
                    </span>
                    {currentQuestion.ID_Qconcursos && (
                      <span className="text-[10.5px] font-mono bg-amber-900/10 text-amber-900 px-1.5 py-0.5 rounded border border-amber-900/20">
                        ID: {currentQuestion.ID_Qconcursos}
                      </span>
                    )}
                    {currentQuestion.dificuldade && (
                      <span className="text-[10px] font-serif uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                        {currentQuestion.dificuldade}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onToggleDuvida(currentQuestion.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-serif transition-all ${
                      isCurrentDuvida
                        ? "bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
                        : "hover:bg-stone-200/80 text-stone-500"
                    }`}
                    title="Marcar questão para revisar depois"
                  >
                    <Flag size={13} className={isCurrentDuvida ? "fill-amber-600 text-amber-600" : ""} />
                    <span>{isCurrentDuvida ? "Dúvida" : "Marcar"}</span>
                  </button>
                </div>

                {/* Área Rolável do Enunciado e Alternativas */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {(currentQuestion["Texto de apoio"] || currentQuestion.perguntaProblema) && (
                    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 font-serif text-xs text-stone-700 leading-relaxed italic">
                      <p className="whitespace-pre-line">
                        {currentQuestion["Texto de apoio"] || currentQuestion.perguntaProblema}
                      </p>
                    </div>
                  )}

                  {currentQuestion.imagemEnunciado && (
                    <div className="my-2 rounded border border-stone-300 overflow-hidden max-h-48 flex justify-center bg-white">
                      <img
                        src={currentQuestion.imagemEnunciado}
                        alt="Imagem da questão"
                        className="object-contain max-h-48"
                      />
                    </div>
                  )}

                  <div className="font-serif text-[13.5px] leading-relaxed text-stone-900">
                    <p className="whitespace-pre-line font-medium">{currentQuestion.title}</p>
                  </div>

                  {/* Alternativas A, B, C, D, E */}
                  <div className="space-y-2 pt-2">
                    {alternatives.map((alt) => {
                      const isSelected = selectedAlternative === alt.letter;
                      const isAnswered = Boolean(currentStats);
                      const isCorrectAlt = alt.letter === correctLetter;
                      const wasUserChoice = currentStats?.lastAnswer?.toUpperCase() === alt.letter;

                      let rowStyle =
                        "bg-white/70 hover:bg-white text-stone-800 border-stone-300 hover:border-amber-700/40";

                      if (isAnswered) {
                        if (isCorrectAlt) {
                          rowStyle =
                            "bg-emerald-100/90 text-emerald-900 border-emerald-400 font-medium shadow-sm";
                        } else if (wasUserChoice && !currentStats?.isCorrect) {
                          rowStyle = "bg-rose-100/90 text-rose-900 border-rose-400 line-through";
                        } else {
                          rowStyle = "bg-stone-100/60 text-stone-500 border-stone-200 opacity-60";
                        }
                      } else if (isSelected) {
                        rowStyle =
                          "bg-amber-100 text-amber-950 border-amber-600 font-medium shadow-sm ring-1 ring-amber-600";
                      }

                      return (
                        <div
                          key={alt.letter}
                          onClick={() => {
                            if (!isAnswered) {
                              setSelectedAlternative(alt.letter);
                              handleConfirmAnswer(alt.letter);
                            }
                          }}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${rowStyle}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 border ${
                              isAnswered && isCorrectAlt
                                ? "bg-emerald-600 text-white border-emerald-700"
                                : isAnswered && wasUserChoice && !currentStats?.isCorrect
                                ? "bg-rose-600 text-white border-rose-700"
                                : isSelected
                                ? "bg-amber-800 text-white border-amber-900"
                                : "bg-stone-200/90 text-stone-700 border-stone-300"
                            }`}
                          >
                            {alt.letter}
                          </span>
                          <span className="text-[12.5px] font-serif leading-relaxed pt-0.5">
                            {alt.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Feedback e Comentário Pedagógico */}
                  {currentStats && (
                    <div className="pt-3">
                      <div
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          currentStats.isCorrect
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                            : "bg-rose-50 border-rose-300 text-rose-900"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {currentStats.isCorrect ? (
                            <CheckCircle2 size={18} className="text-emerald-700" />
                          ) : (
                            <XCircle size={18} className="text-rose-700" />
                          )}
                          <span className="font-serif font-bold text-xs">
                            {currentStats.isCorrect
                              ? "Resposta Correta!"
                              : `Incorreto. Gabarito oficial: Letra ${correctLetter}`}
                          </span>
                        </div>

                        {currentQuestion.explicacao && (
                          <button
                            onClick={() => setShowExplanation((v) => !v)}
                            className="text-xs font-serif underline text-amber-900 hover:text-amber-950 font-medium"
                          >
                            {showExplanation ? "Ocultar Comentário" : "Ver Comentário"}
                          </button>
                        )}
                      </div>

                      {showExplanation && currentQuestion.explicacao && (
                        <div className="mt-2.5 p-3 rounded-lg bg-amber-50/90 border border-amber-300/80 font-serif text-xs text-stone-800 leading-relaxed">
                          <span className="block font-bold text-amber-900 mb-1">
                            Comentário Pedagógico:
                          </span>
                          <p className="whitespace-pre-line">{currentQuestion.explicacao}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé com Botões de Folhear */}
                <div className="pt-3 border-t border-stone-300/80 flex items-center justify-between mt-auto">
                  <button
                    onClick={flipToPrev}
                    disabled={currentIndex === 0 || flipDirection !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300 text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-serif transition-all"
                  >
                    <ChevronLeft size={14} />
                    <span>Pág. Anterior</span>
                  </button>

                  <span className="text-[10px] text-stone-500 font-mono">
                    Pág. {currentIndex * 2 + 2}
                  </span>

                  <button
                    onClick={flipToNext}
                    disabled={currentIndex === filteredQuestions.length - 1 || flipDirection !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/15 hover:bg-amber-900/25 text-amber-950 font-serif font-medium disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-all border border-amber-900/20"
                  >
                    <span>Próxima Pág.</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <BookOpen size={40} className="text-stone-400 mb-3" />
                <h3 className="font-serif font-bold text-stone-800 text-base mb-1">
                  Nenhuma questão encontrada
                </h3>
                <p className="text-xs font-serif text-stone-500 max-w-xs">
                  Não há questões correspondentes ao filtro atual neste caderno.
                </p>
                <button
                  onClick={() => {
                    setFilterMode("todos");
                    setSelectedCasoId("todos");
                  }}
                  className="mt-4 px-3 py-1.5 rounded bg-amber-900/10 text-amber-900 border border-amber-900/20 text-xs font-serif hover:bg-amber-900/20 transition-all"
                >
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
