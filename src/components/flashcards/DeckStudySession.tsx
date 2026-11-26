'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { DeckRecord, FlashcardRecord, ReviewStatus } from '@/types/flashcardTree';
import Flashcard3D from './Flashcard3D';

export interface StudyQueueItem {
  card: FlashcardRecord;
  deckPath: string;
  deckName: string;
}

interface DeckStudySessionProps {
  title: string;
  items: StudyQueueItem[];
  allDecks: DeckRecord[];
  onRecordReview: (
    cardId: string,
    reviewStatus: ReviewStatus,
    confidence: number
  ) => Promise<void>;
  onExit: () => void;
}

const CONFIDENCE_OPTIONS: {
  confidence: number;
  status: ReviewStatus;
  label: string;
  shortcut: string;
}[] = [
  { confidence: 1, status: 'learning', label: 'Difícil', shortcut: '1' },
  { confidence: 2, status: 'reviewing', label: 'Bom', shortcut: '2' },
  { confidence: 3, status: 'reviewing', label: 'Fácil', shortcut: '3' },
  { confidence: 4, status: 'mastered', label: 'Dominado', shortcut: '4' },
];

export default function DeckStudySession({
  title,
  items,
  onRecordReview,
  onExit,
}: DeckStudySessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [ratedCounts, setRatedCounts] = useState<Record<number, number>>({});

  const currentItem = items[currentIndex];

  const handleFlip = useCallback(
    (next: boolean) => {
      if (isSaving) return;
      setIsFlipped(next);
    },
    [isSaving]
  );

  const goToPrev = useCallback(() => {
    if (isSaving || currentIndex === 0) return;
    setCurrentIndex(prev => prev - 1);
    setIsFlipped(false);
  }, [currentIndex, isSaving]);

  const goToNext = useCallback(() => {
    if (isSaving || currentIndex >= items.length - 1) return;
    setCurrentIndex(prev => prev + 1);
    setIsFlipped(false);
  }, [currentIndex, isSaving, items.length]);

  const handleRate = useCallback(
    async (status: ReviewStatus, confidence: number) => {
      if (isSaving || !currentItem) return;
      setIsSaving(true);
      setRatedCounts(prev => ({
        ...prev,
        [confidence]: (prev[confidence] ?? 0) + 1,
      }));
      try {
        await onRecordReview(currentItem.card.id, status, confidence);
      } catch (err) {
        console.error('Erro ao registrar revisão:', err);
      } finally {
        setTimeout(() => {
          setIsFlipped(false);
          if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            setIsCompleted(true);
          }
          setIsSaving(false);
        }, 280);
      }
    },
    [currentIndex, currentItem, isSaving, items.length, onRecordReview]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip(!isFlipped);
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        const opt = CONFIDENCE_OPTIONS.find(o => o.shortcut === e.key);
        if (opt) void handleRate(opt.status, opt.confidence);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToNext, goToPrev, handleFlip, handleRate, isCompleted, isFlipped, onExit]);

  if (isCompleted || !currentItem) {
    const totalRated = Object.values(ratedCounts).reduce((a, b) => a + b, 0);
    return (
      <div className="fixed inset-0 z-[110] bg-[#0b0d12] text-slate-100 flex flex-col items-center justify-center p-5 text-center">
        <div className="w-full max-w-md rounded-2xl bg-[#14171d] border border-white/[0.08] p-6 sm:p-8 space-y-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-normal text-white">Sessão concluída</h2>
            <p className="text-xs sm:text-sm text-slate-400 font-light">
              {items.length} flashcards estudados em {title}
              {totalRated > 0 ? ` · ${totalRated} avaliações salvas` : ''}.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                setIsCompleted(false);
                setRatedCounts({});
              }}
              className="flex-1 min-h-[42px] px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-normal flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Estudar novamente
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex-1 min-h-[42px] px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium transition-colors"
            >
              Voltar ao deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-[#0b0d12] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header minimalista */}
      <header className="shrink-0 px-3 sm:px-6 py-3 border-b border-white/[0.06] bg-[#0f1116] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xs sm:text-sm font-normal text-slate-100 truncate">
            {title}
          </h1>
          <p className="text-[11px] text-slate-400 truncate font-light">
            {currentItem.deckPath}
          </p>
        </div>

        <div className="flex-1 max-w-xs sm:max-w-md px-1 sm:px-4">
          <div className="space-y-1.5 text-center">
            <div className="text-[11px] text-slate-400 tabular-nums font-light">
              <span className="text-slate-100 font-normal">{currentIndex + 1}</span> / {items.length}
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-300/80 transition-[width] duration-300"
                style={{ width: `${((currentIndex + 1) / Math.max(1, items.length)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          aria-label="Fechar estudo"
          className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Flashcard 3D central */}
      <main className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <Flashcard3D
            key={currentItem.card.id}
            front={currentItem.card.front}
            back={currentItem.card.back}
            flipped={isFlipped}
            onFlip={handleFlip}
            frontLabel={currentItem.deckName}
            backLabel="Resposta"
            hint="Toque no cartão ou pressione Espaço para virar"
            disabled={isSaving}
            className="h-[min(56dvh,420px)] sm:h-[400px]"
          />
        </div>
      </main>

      {/* Rodapé com navegação e registro em CARD_REVIEWS */}
      <footer className="shrink-0 px-3 sm:px-8 py-3 sm:py-4 border-t border-white/[0.06] bg-[#0f1116]">
        <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrev}
              disabled={currentIndex === 0 || isSaving}
              aria-label="Cartão anterior"
              className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleFlip(!isFlipped)}
              disabled={isSaving}
              className="flex-1 md:flex-initial min-h-[44px] bg-slate-100 text-slate-950 font-medium text-xs sm:text-sm px-6 py-2 rounded-lg hover:bg-white transition-colors"
            >
              {isFlipped ? 'Ver pergunta' : 'Ver resposta'}
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={currentIndex === items.length - 1 || isSaving}
              aria-label="Próximo cartão"
              className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.confidence}
                type="button"
                onClick={() => void handleRate(opt.status, opt.confidence)}
                disabled={!isFlipped || isSaving}
                className="min-h-[42px] px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.09] hover:bg-white/[0.09] text-slate-200 text-xs font-normal whitespace-nowrap shrink-0 transition-colors disabled:opacity-25 flex items-center gap-1.5"
              >
                <span className="text-[10px] text-slate-500 tabular-nums">{opt.shortcut}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
