'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Brain, Layers, Lightbulb, Zap, Rocket,
  ChevronLeft, RefreshCw, Trophy,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import { ChoiceType, FixationItem } from '@/types/fixation';

// ─── Props ───────────────────────────────────────────────────────────────────

interface FixationGameProps {
  /** Título exibido no cabeçalho */
  title: string;
  /** Lista de itens a estudar */
  items: FixationItem[];
  /** Chamado toda vez que o usuário avalia um card (somente primeira avaliação por sessão) */
  onUpdateCard?: (cardId: string, performance: ChoiceType) => void | Promise<void>;
  /** Quando true, não persiste respostas no banco */
  isNoCommitment?: boolean;
  /** Alterna o modo sem compromisso */
  onToggleNoCommitment?: () => void;
  /** Chamado ao finalizar a sessão com o mapa completo de feedbacks */
  onFinish?: (feedback: Record<string, ChoiceType>) => void;
  /** Volta para a tela anterior */
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toStable(item: FixationItem, index: number): FixationItem {
  return { ...item, originalIndex: index, _stableId: item.id || `${item.term}-${index}` };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FixationGame({
  title,
  items,
  onUpdateCard,
  isNoCommitment = false,
  onToggleNoCommitment,
  onFinish,
  onBack,
}: FixationGameProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [studyQueue, setStudyQueue] = useState<FixationItem[]>(() =>
    shuffle(items.map(toStable))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const [currentCognitiveLoad, setCurrentCognitiveLoad] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);
  const [shake, setShake] = useState(false);
  const [isCracked, setIsCracked] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  const [isInverted, setIsInverted] = useState(false);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [userInput, setUserInput] = useState('');

  const [answeredCardIds, setAnsweredCardIds] = useState<Set<string>>(new Set());
  const [sessionFeedback, setSessionFeedback] = useState<Record<string, ChoiceType>>({});

  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [cardStartTime, setCardStartTime] = useState(Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const maxCognitiveLoad = items.length * 5;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setStudyQueue(shuffle(items.map(toStable)));
  }, [items]);

  useEffect(() => {
    setCardStartTime(Date.now());
  }, [currentIndex]);

  // Auto-scroll para o card ativo
  useEffect(() => {
    const timer = setTimeout(() => {
      const active = scrollRef.current?.querySelector('[data-active="true"]');
      active?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentIndex, studyQueue]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleManualShuffle = () => {
    setStudyQueue(prev => shuffle(prev));
    setCurrentIndex(0);
    setRevealed(false);
    setCardStartTime(Date.now());
  };

  const persistChoice = (cardId: string, type: ChoiceType): Record<string, ChoiceType> => {
    if (isNoCommitment || answeredCardIds.has(cardId)) return sessionFeedback;
    const updated = { ...sessionFeedback, [cardId]: type };
    setSessionFeedback(updated);
    setAnsweredCardIds(prev => new Set(prev).add(cardId));
    if (onUpdateCard) {
      const result = onUpdateCard(cardId, type);
      if (result instanceof Promise) result.catch(console.error);
    }
    return updated;
  };

  const handleChoice = (type: ChoiceType) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const currentItem = studyQueue[currentIndex];
    const cardId = currentItem?.id ? String(currentItem.id) : null;

    // Persiste somente a primeira avaliação por card por sessão
    let updatedFeedback = sessionFeedback;
    if (cardId) updatedFeedback = persistChoice(cardId, type);

    // Carga cognitiva
    const loadMap: Record<ChoiceType, number> = { forgot: 3, partial: 2, effortful: 2, learning: 1, mastered: 0 };
    setCurrentCognitiveLoad(prev => {
      const next = prev + loadMap[type];
      if (next >= maxCognitiveLoad) setIsExhausted(true);
      return next;
    });

    // Confetti nos acertos
    if (type === 'mastered' || type === 'learning') {
      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.6 },
        colors: type === 'mastered' ? ['#10b981', '#34d399'] : ['#3b82f6', '#60a5fa'],
      });
    }

    if (type === 'forgot') {
      // Branco: embaralha tudo e volta ao início
      setShake(true);
      setIsCracked(true);
      setTimeout(() => {
        setShake(false);
        setIsCracked(false);
        setStudyQueue(prev => shuffle(prev));
        setCurrentIndex(0);
        setRevealed(false);
        setIsProcessing(false);
        setCardStartTime(Date.now());
      }, 1000);

    } else if (type === 'partial') {
      // Quase: volta uma posição
      setCurrentIndex(prev => {
        if (prev > 0) {
          setIsReversing(true);
          setTimeout(() => setIsReversing(false), 500);
          return prev - 1;
        }
        return prev;
      });
      setRevealed(false);
      setIsProcessing(false);

    } else if (type === 'effortful') {
      // Pensei: adiciona clone no final e avança
      setStudyQueue(prev => [
        ...prev,
        { ...currentItem, _stableId: `${currentItem._stableId}-r-${Date.now()}` },
      ]);
      setCurrentIndex(currentIndex + 1);
      setRevealed(false);
      setIsProcessing(false);

    } else if (type === 'mastered') {
      // Automático: remove da fila
      setMasteredIds(prev => new Set(prev).add(String(currentItem.id)));
      const newQueue = studyQueue.filter(c => c._stableId !== currentItem._stableId);
      setStudyQueue(newQueue);

      if (newQueue.length === 0) {
        setIsFinished(true);
        onFinish?.(updatedFeedback);
      } else {
        setCurrentIndex(i => Math.min(i, newQueue.length - 1));
      }
      setRevealed(false);
      setIsProcessing(false);

    } else {
      // learning: avança normalmente
      if (currentIndex < studyQueue.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsFinished(true);
        onFinish?.(updatedFeedback);
      }
      setRevealed(false);
      setIsProcessing(false);
    }
  };

  const handleTypeSubmit = () => {
    const currentItem = studyQueue[currentIndex];
    const target = isInverted ? currentItem.term : currentItem.description;
    const elapsedSeconds = (Date.now() - cardStartTime) / 1000;

    const normalize = (s: string) =>
      s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,/#!$%^&*;:{}=_`~()?"']/g, '')
        .replace(/\b(to|o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|no|na|nos|nas|com|por|em)\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedUser = normalize(userInput);
    if (!normalizedUser) return;

    const targetOptions = target
      .replace(/<[^>]*>/g, '')
      .split(/[/,;]/)
      .map(o => normalize(o))
      .filter(o => o.length > 0);

    const isCorrect = targetOptions.some(opt => {
      if (opt === normalizedUser) return true;
      const tw = opt.split(/\s+/).filter(w => w.length > 2);
      const uw = normalizedUser.split(/\s+/).filter(w => w.length > 2);
      if (tw.length > 0 && uw.length > 0) {
        const allMatch = uw.every(u => tw.some(t => t.includes(u) || u.includes(t)));
        if (allMatch && (uw.length / tw.length >= 0.4 || opt.includes(normalizedUser))) return true;
      }
      return opt.includes(normalizedUser) && normalizedUser.length > 3;
    });

    setRevealed(true);
    if (isCorrect) {
      setTimeout(() => {
        handleChoice(elapsedSeconds < 3 ? 'mastered' : 'learning');
        setUserInput('');
      }, 900);
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        handleChoice('forgot');
        setUserInput('');
      }, 1800);
    }
  };

  // ── Tela de Exaustão ───────────────────────────────────────────────────────

  if (isExhausted) {
    const pct = Math.min((currentCognitiveLoad / maxCognitiveLoad) * 100, 100);
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-red-500/10 border border-red-500/50 rounded-full flex items-center justify-center mb-6"
        >
          <Brain size={40} className="text-red-500 animate-pulse" />
        </motion.div>
        <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">Sessão Encerrada</h2>
        <p className="text-red-400 font-bold uppercase tracking-widest text-xs mb-6">Limite de Carga Cognitiva Atingido</p>
        <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] mb-8">
          <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
            Forçar o estudo com a mente saturada não gera aprendizado — apenas frustração. Descanse e volte depois.
          </p>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
            <span className="text-red-500">Exaustão</span>
            <span className="text-white">{Math.round(pct)}%</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-red-500" />
          </div>
        </div>
        <button onClick={onBack} className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all active:scale-95">
          Voltar e Descansar
        </button>
      </div>
    );
  }

  // ── Tela de Conclusão ──────────────────────────────────────────────────────

  if (isFinished) {
    const masteredCount = Object.values(sessionFeedback).filter(v => v === 'mastered').length;
    const learningCount = Object.values(sessionFeedback).filter(v => v === 'learning').length;
    const total = Object.keys(sessionFeedback).length;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          <Trophy size={32} className="text-white" />
        </motion.div>

        <h2 className="text-xl font-black text-white mb-1">Trilha Concluída! 🏆</h2>
        <p className="text-zinc-400 text-xs mb-6">Você percorreu todo o deck de <span className="text-white font-bold">{title}</span></p>

        {/* Mini stats */}
        <div className="flex gap-3 mb-6">
          {[
            { label: 'Automático', value: masteredCount, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Rápido', value: learningCount, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            { label: 'Total', value: total, color: 'text-white bg-white/5 border-white/10' },
          ].map(s => (
            <div key={s.label} className={`px-4 py-3 rounded-2xl border ${s.color} flex flex-col items-center`}>
              <span className="text-xl font-black">{s.value}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setStudyQueue(shuffle(items.map(toStable)));
              setCurrentIndex(0);
              setIsFinished(false);
              setAnsweredCardIds(new Set());
              setMasteredIds(new Set());
              setSessionFeedback({});
              setCurrentCognitiveLoad(0);
              setRevealed(false);
            }}
            className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> Recomeçar
          </button>
          <button onClick={onBack} className="px-6 py-2.5 bg-white text-black text-xs font-black rounded-xl hover:scale-105 active:scale-95 transition-all">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── Tela Principal de Estudo ───────────────────────────────────────────────

  const loadPct = Math.min((currentCognitiveLoad / maxCognitiveLoad) * 100, 100);
  const loadColor = loadPct > 75 ? '#ef4444' : loadPct > 40 ? '#f97316' : '#3b82f6';

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white min-h-0 overflow-hidden">
      {/* ── Header ── */}
      <div className="p-3 md:p-4 flex items-center gap-2 md:gap-3 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-colors shrink-0">
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm md:text-base font-black tracking-tight truncate uppercase">
              Fixação: {title}
            </h1>
            <button
              onClick={onToggleNoCommitment}
              className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all shrink-0 ${
                isNoCommitment
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {isNoCommitment ? 'Sem Compromisso' : 'Registrando'}
            </button>
          </div>
          <p className="text-[8px] text-zinc-500 font-bold font-mono uppercase tracking-widest">
            Errou? Zera. Quase? Volta uma.
          </p>
        </div>

        {/* Toggle de modo */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full border border-white/5">
          <span className={`text-[8px] font-black uppercase tracking-widest ${!isTypingMode ? 'text-indigo-400' : 'text-zinc-500'}`}>Revelar</span>
          <button
            onClick={() => { setIsTypingMode(v => !v); setRevealed(false); setUserInput(''); }}
            className="w-8 h-4 bg-zinc-800 rounded-full relative p-0.5 border border-white/10"
          >
            <motion.div animate={{ x: isTypingMode ? 16 : 0 }} className="w-3 h-3 bg-white rounded-full shadow-sm" />
          </button>
          <span className={`text-[8px] font-black uppercase tracking-widest ${isTypingMode ? 'text-indigo-400' : 'text-zinc-500'}`}>Digitar</span>
        </div>

        {/* Barra de fadiga */}
        <div className="hidden md:flex flex-col items-end gap-1 w-32 lg:w-40">
          <div className="flex items-center justify-between w-full">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
              <Brain size={10} /> Fadiga
            </span>
            <span className="text-[9px] font-black" style={{ color: loadColor }}>
              {Math.round(loadPct)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
            <motion.div
              animate={{ width: `${loadPct}%`, backgroundColor: loadColor }}
              className="h-full transition-all duration-500"
            />
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button onClick={handleManualShuffle} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500 hover:text-white" title="Embaralhar">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { setIsInverted(v => !v); setCurrentIndex(0); setRevealed(false); }}
            className={`px-2.5 py-1 rounded-full text-[8px] font-black transition-all border ${
              isInverted ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {isInverted ? 'MODO: CONCEITO' : 'MODO: TERMO'}
          </button>
        </div>
      </div>

      {/* ── Trilha Vertical ── */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto no-scrollbar p-3 md:p-6 pb-32 transition-all duration-500 ${
          isCracked ? 'scale-95 blur-sm grayscale opacity-30 rotate-1' : ''
        } ${isReversing ? 'blur-[1px] opacity-80' : ''}`}
      >
        <div className="max-w-xl mx-auto relative">
          {/* Linha de conexão */}
          <div className="absolute left-[27px] md:left-[31px] top-6 bottom-6 w-0.5 bg-zinc-900/50 z-0" />

          <div className="space-y-3 md:space-y-4 relative z-10">
            {studyQueue.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              const isPast = idx < currentIndex;

              return (
                <motion.div
                  key={`${item._stableId}-${idx}`}
                  data-active={isCurrent}
                  initial={false}
                  animate={{ opacity: isCurrent || isPast ? 1 : 0.2, scale: isCurrent ? 1 : 0.98, x: isCurrent ? 0 : isPast ? 0 : 4 }}
                  className={`flex gap-3 md:gap-4 rounded-xl md:rounded-[1.5rem] p-3 md:p-5 border-2 transition-all duration-500 ${
                    isCurrent
                      ? `bg-zinc-900 border-indigo-500/40 shadow-[0_15px_40px_rgba(0,0,0,0.6)] ring-4 ring-indigo-500/10 ${shake ? 'animate-shake' : ''}`
                      : isPast
                      ? 'bg-emerald-500/5 border-emerald-500/10 opacity-40 grayscale-[0.3]'
                      : 'bg-transparent border-transparent'
                  }`}
                >
                  {/* Indicador de passo */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-xs md:text-sm transition-all duration-500 shadow-lg ${
                      isPast ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/20' :
                      'bg-zinc-800 text-zinc-600'
                    }`}>
                      {isPast ? <CheckCircle2 size={16} /> : (item.originalIndex !== undefined ? item.originalIndex + 1 : idx + 1)}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-base md:text-xl font-black tracking-tight transition-colors duration-500 block mb-1 ${
                        isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-zinc-700'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: isInverted ? (isCurrent || isPast ? item.description : '???') : item.term,
                      }}
                    />

                    {isCurrent && (
                      <div className="space-y-3 pt-1">
                        {/* Prompt da descrição no modo invertido (antes de revelar) */}
                        {isInverted && !revealed && (
                          <div className="text-zinc-300 text-xs font-medium leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 italic">
                            <div dangerouslySetInnerHTML={{ __html: item.description }} />
                            <motion.span
                              animate={{ opacity: [0.4, 0.8, 0.4] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="block mt-2 text-indigo-400 font-black uppercase text-[8px] tracking-widest text-center"
                            >
                              {isTypingMode ? 'Digite o termo' : 'Qual é o termo?'}
                            </motion.span>
                          </div>
                        )}

                        {!revealed ? (
                          /* ── Antes de revelar ── */
                          <div className="space-y-3">
                            {isTypingMode ? (
                              <div className="space-y-2">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleTypeSubmit()}
                                    placeholder="Digite sua resposta..."
                                    className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-xl px-4 py-3 pr-14 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-zinc-700"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleTypeSubmit}
                                    className="absolute right-2 w-9 h-9 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all flex items-center justify-center active:scale-90"
                                  >
                                    <ArrowRight size={18} />
                                  </button>
                                </div>
                                <button
                                  onClick={() => { setRevealed(true); setTimeout(() => { handleChoice('forgot'); setUserInput(''); }, 2000); }}
                                  className="w-full text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors text-center"
                                >
                                  Não sei, mostrar resposta
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRevealed(true)}
                                className="w-full py-2.5 md:py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest ring-4 ring-indigo-500/10"
                              >
                                Revelar
                              </button>
                            )}
                          </div>
                        ) : (
                          /* ── Depois de revelar ── */
                          <motion.div
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                          >
                            <div className="p-3 md:p-5 bg-zinc-950 border border-indigo-500/20 rounded-xl text-center shadow-inner space-y-2">
                              <span
                                className="text-xs md:text-lg font-black text-indigo-100 leading-relaxed block"
                                dangerouslySetInnerHTML={{ __html: isInverted ? item.term : item.description }}
                              />
                              {item.explanation && (
                                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-left text-xs text-blue-200">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-1">Explicação:</span>
                                  <span dangerouslySetInnerHTML={{ __html: item.explanation }} />
                                </div>
                              )}
                            </div>

                            {!isTypingMode && (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  {([
                                    { type: 'forgot' as ChoiceType, label: 'Branco', Icon: Brain, color: '#ef4444' },
                                    { type: 'partial' as ChoiceType, label: 'Quase', Icon: Layers, color: '#f97316' },
                                    { type: 'effortful' as ChoiceType, label: 'Pensei', Icon: Lightbulb, color: '#eab308' },
                                    { type: 'learning' as ChoiceType, label: 'Rápido', Icon: Zap, color: '#3b82f6' },
                                  ] as const).map(({ type, label, Icon, color }) => (
                                    <button
                                      key={type}
                                      onClick={() => handleChoice(type)}
                                      className="h-[65px] rounded-2xl border flex flex-col items-center justify-center group transition-all shadow-lg"
                                      style={{
                                        background: `${color}0d`,
                                        borderColor: `${color}33`,
                                        color,
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = `${color}33`)}
                                      onMouseLeave={e => (e.currentTarget.style.background = `${color}0d`)}
                                    >
                                      <Icon size={18} className="mb-1 group-hover:scale-110 transition-transform opacity-70" />
                                      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => handleChoice('mastered')}
                                  className="w-full h-[60px] bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-3 group"
                                >
                                  <Rocket size={20} className="group-hover:scale-110 group-hover:-rotate-12 transition-transform" />
                                  <span className="text-xs md:text-sm font-black uppercase tracking-widest">Automático</span>
                                </button>
                              </>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}

                    {isPast && (
                      <div
                        className="text-zinc-500 text-[10px] md:text-sm mt-1 line-clamp-2 italic opacity-60"
                        dangerouslySetInnerHTML={{ __html: isInverted ? item.term : item.description }}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Overlay de Reset ── */}
      <AnimatePresence>
        {isCracked && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="text-white font-black text-4xl md:text-6xl tracking-tighter drop-shadow-[0_0_20px_rgba(255,165,0,0.5)]"
            >
              RECOMEÇANDO...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
