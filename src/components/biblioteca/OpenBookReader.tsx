"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Layers,
  Folder,
  Award,
  Bookmark,
  Share2,
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

// Reproduz som sintetizado realista de folha de papel virando
function playPaperFlipSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const bufferSize = ctx.sampleRate * 0.18; // 180ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Ruído suave simulando fricção de pergaminho
      const decay = Math.pow(1 - i / bufferSize, 1.8);
      data[i] = (Math.random() * 2 - 1) * decay * 0.08;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filtro passa-banda para dar timbre aveludado de papel grosso
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.15);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch (e) {
    // Ignora se bloqueado por autoplay policy
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
  // Filtro de caso selecionado
  const [selectedCasoId, setSelectedCasoId] = useState<string>("todos");
  const [filterMode, setFilterMode] = useState<"todos" | "erros" | "duvidas" | "pendentes">("todos");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Lista de questões filtradas para navegar no livro
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

  // Índice da questão atual
  const [currentIndex, setCurrentIndex] = useState(0);

  // Garante que o índice fique dentro do range
  useEffect(() => {
    if (currentIndex >= filteredQuestions.length && filteredQuestions.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredQuestions.length, currentIndex]);

  const currentQuestion: BancoQuestion | undefined = filteredQuestions[currentIndex];

  // Estado de resposta da questão atual
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFlipping, setIsFlipping] = useState<"next" | "prev" | null>(null);

  // Reseta seleção ao mudar de questão
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

  // Status da questão atual
  const currentStats = currentQuestion ? userAnswers[String(currentQuestion.id)] : undefined;
  const isCurrentDuvida = currentQuestion ? duvidas.has(String(currentQuestion.id)) : false;

  // Letra correta da questão
  const correctLetter = useMemo(() => {
    if (!currentQuestion) return "";
    const g = (currentQuestion.respostaCorreta || currentQuestion.Gabarito || "").trim().toUpperCase();
    return g.charAt(0);
  }, [currentQuestion]);

  // Navegação de páginas com efeito de folhear
  const goToNextPage = useCallback(() => {
    if (currentIndex < filteredQuestions.length - 1 && !isFlipping) {
      setIsFlipping("next");
      if (soundEnabled) playPaperFlipSound();
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipping(null);
      }, 260);
    }
  }, [currentIndex, filteredQuestions.length, isFlipping, soundEnabled]);

  const goToPrevPage = useCallback(() => {
    if (currentIndex > 0 && !isFlipping) {
      setIsFlipping("prev");
      if (soundEnabled) playPaperFlipSound();
      setTimeout(() => {
        setCurrentIndex((prev) => prev - 1);
        setIsFlipping(null);
      }, 260);
    }
  }, [currentIndex, isFlipping, soundEnabled]);

  // Atalhos de teclado (Setas Esquerda / Direita e teclas A, B, C, D, E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        goToNextPage();
      } else if (e.key === "ArrowLeft") {
        goToPrevPage();
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
  }, [goToNextPage, goToPrevPage, onClose, currentStats]);

  // Responder a questão
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

  // Alternativas disponíveis na questão
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/85 backdrop-blur-md select-none overflow-hidden"
    >
      {/* ── BARRA SUPERIOR DE CONTROLES DO LEITOR ───────────────────────────── */}
      <div className="absolute top-3 left-4 right-4 z-50 flex items-center justify-between text-amber-100/90 pointer-events-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition-all text-xs"
          >
            <ChevronLeft size={14} />
            <span>Voltar à Biblioteca</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-stone-900/60 border border-stone-700/40 text-xs">
            <span className="text-amber-400 font-serif">✦ {caderno.materia}</span>
            <span className="text-stone-500">/</span>
            <span className="text-stone-300 truncate max-w-[200px]">{caderno.nome}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Som de papel */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Desativar som de virar folha" : "Ativar som de virar folha"}
            className="p-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-amber-300 border border-stone-700/50 shadow transition-all"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Fechar */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-900/80 hover:bg-rose-900/50 text-stone-400 hover:text-rose-300 border border-stone-700/50 shadow transition-all"
            title="Fechar Livro"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── O LIVRO ABERTO EM 3D REALISTA (TWO-PAGE SPREAD) ────────────────── */}
      <div
        className="relative w-full max-w-6xl h-[86vh] flex items-center justify-center"
        style={{ perspective: "2200px" }}
      >
        {/* Capa de Couro Subjacente do Livro (Borda saliente e costura) */}
        <div
          className="absolute inset-0 rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] -z-10"
          style={{
            backgroundColor: caderno.coverColor || "#1b281f",
            backgroundImage:
              "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.06), rgba(0,0,0,0.7))",
            border: "6px solid #141a16",
            boxShadow:
              "0 20px 60px -10px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(212, 175, 55, 0.25) inset",
          }}
        />

        {/* Fita de Cetim Marcadora de Livro (Bookmark Ribbon) */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-28 pointer-events-none z-40 transition-all duration-300"
          style={{
            background: "linear-gradient(to right, #8a1523, #b82333, #8a1523)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            borderBottom: "10px solid transparent",
            borderLeft: "12px solid #8a1523",
            borderRight: "12px solid #8a1523",
          }}
        />

        {/* Miolo Duplo de Páginas em Papel Creme */}
        <div
          className="relative w-[96%] h-[94%] flex rounded-lg overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA ESQUERDA (VERSO) — Sumário, Casos & Progresso              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            className="w-1/2 h-full flex flex-col p-6 md:p-8 bg-[#faf7ee] text-stone-800 relative border-r border-amber-900/10 overflow-y-auto"
            style={{
              backgroundImage:
                "linear-gradient(to right, #ece3cb 0%, #faf7ee 12%, #fbf9f3 85%, #ece4d0 100%)",
              boxShadow: "inset 18px 0 25px -10px rgba(80, 50, 20, 0.15)",
            }}
          >
            {/* Cabeçalho da Página Esquerda */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-300/80 mb-4">
              <div>
                <span className="text-[10px] font-serif uppercase tracking-widest text-amber-900/70 font-semibold">
                  Índice & Progresso
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

            {/* Painel de Estatísticas da Página */}
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

            {/* Seletor de Casos (Subtópicos do Caderno) */}
            <div className="mb-4">
              <label className="text-[11px] font-serif text-stone-600 font-semibold mb-1.5 flex items-center gap-1.5">
                <Folder size={12} className="text-amber-800" />
                <span>Casos & Capítulos:</span>
              </label>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
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
                  <span className="truncate">Todos os Casos do Caderno</span>
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

            {/* Minigrid de Navegação Rápida entre Questões */}
            <div className="flex-1 overflow-y-auto">
              <span className="text-[10px] font-serif text-stone-500 uppercase block mb-1">
                Questões ({filteredQuestions.length}):
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
              <span className="font-mono">Página {currentIndex * 2 + 1}</span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* VINCO CENTRAL DO LIVRO (Lombada com sombras e costura)           */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            className="w-8 shrink-0 h-full relative z-30 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.04) 35%, rgba(0,0,0,0.01) 50%, rgba(0,0,0,0.04) 65%, rgba(0,0,0,0.28) 100%)",
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.35)",
            }}
          >
            {/* Linha vertical sutil da dobra do livro */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-amber-950/20" />
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA DIREITA (RETO) — Questão Ativa, Alternativas & Gabarito    */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div
            className="w-1/2 h-full flex flex-col p-6 md:p-8 bg-[#faf7ee] text-stone-800 relative border-l border-amber-900/10 overflow-y-auto"
            style={{
              backgroundImage:
                "linear-gradient(to left, #ece3cb 0%, #faf7ee 12%, #fbf9f3 85%, #ece4d0 100%)",
              boxShadow: "inset -18px 0 25px -10px rgba(80, 50, 20, 0.15)",
            }}
          >
            {/* Folha de animação de virada 3D */}
            <AnimatePresence>
              {isFlipping && (
                <motion.div
                  initial={{
                    rotateY: isFlipping === "next" ? 0 : -90,
                    opacity: 0.95,
                  }}
                  animate={{
                    rotateY: isFlipping === "next" ? -90 : 0,
                    opacity: 0.3,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="absolute inset-0 z-40 bg-[#f4ebd0] pointer-events-none shadow-2xl origin-left"
                  style={{
                    boxShadow: "inset 30px 0 50px rgba(0,0,0,0.3)",
                  }}
                />
              )}
            </AnimatePresence>

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

                  {/* Botão de Dúvida */}
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
                  {/* Texto de Apoio se houver */}
                  {(currentQuestion["Texto de apoio"] || currentQuestion.perguntaProblema) && (
                    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 font-serif text-xs text-stone-700 leading-relaxed italic">
                      <p className="whitespace-pre-line">
                        {currentQuestion["Texto de apoio"] || currentQuestion.perguntaProblema}
                      </p>
                    </div>
                  )}

                  {/* Imagem do enunciado se houver */}
                  {currentQuestion.imagemEnunciado && (
                    <div className="my-2 rounded border border-stone-300 overflow-hidden max-h-48 flex justify-center bg-white">
                      <img
                        src={currentQuestion.imagemEnunciado}
                        alt="Imagem da questão"
                        className="object-contain max-h-48"
                      />
                    </div>
                  )}

                  {/* Enunciado Principal */}
                  <div className="font-serif text-[13.5px] leading-relaxed text-stone-900">
                    <p className="whitespace-pre-line font-medium">{currentQuestion.title}</p>
                  </div>

                  {/* Lista de Alternativas A, B, C, D, E */}
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

                  {/* Feedback de Acerto / Erro e Comentário Pedagógico */}
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
                              ? "Parabéns! Resposta Correta."
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

                      {/* Caixa de Comentário / Justificativa */}
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

                {/* Rodapé com Navegação de Folhas do Livro */}
                <div className="pt-3 border-t border-stone-300/80 flex items-center justify-between mt-auto">
                  <button
                    onClick={goToPrevPage}
                    disabled={currentIndex === 0 || isFlipping !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300 text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-serif transition-all"
                  >
                    <ChevronLeft size={14} />
                    <span>Pág. Anterior</span>
                  </button>

                  <span className="text-[10px] text-stone-500 font-mono">
                    Página {currentIndex * 2 + 2}
                  </span>

                  <button
                    onClick={goToNextPage}
                    disabled={currentIndex === filteredQuestions.length - 1 || isFlipping !== null}
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
                  Não há questões correspondentes ao filtro atual selecionado neste caso.
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
