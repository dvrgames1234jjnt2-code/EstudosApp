'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Flashcard, SRSConfig } from '@/types/flashcards';
import SubtleFeedbackEffects, { FeedbackEvent } from './SubtleFeedbackEffects';
import Flashcard3D from './Flashcard3D';
import { updateCardSRS } from '@/services/notionService';

interface StudyInterfaceProps {
  cards: Flashcard[];
  onExit: () => void;
  configLevels: SRSConfig[];
}

export default function StudyInterface({ cards, onExit, configLevels }: StudyInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState<FeedbackEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const feedbackSeqRef = useRef(0);

  const currentCard = cards[currentIndex];

  const handleFlip = useCallback(
    (next: boolean) => {
      if (isUpdating) return;
      setIsFlipped(next);
    },
    [isUpdating]
  );

  const goToPrev = useCallback(() => {
    if (isUpdating) return;
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setIsFlipped(false);
  }, [isUpdating]);

  const goToNext = useCallback(() => {
    if (isUpdating) return;
    setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1));
    setIsFlipped(false);
  }, [cards.length, isUpdating]);

  const handleFeedback = async (level: string) => {
    if (isUpdating || !currentCard) return;

    setIsUpdating(true);
    feedbackSeqRef.current += 1;
    setFeedbackEvent({ timestamp: feedbackSeqRef.current, label: level });

    try {
      await updateCardSRS(currentCard.id, level);

      setTimeout(() => {
        setIsFlipped(false);
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setIsCompleted(true);
        }
        setIsUpdating(false);
      }, 480);
    } catch (error) {
      console.error('Erro ao salvar feedback:', error);
      setIsUpdating(false);
    }
  };

  if (isCompleted || !currentCard) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b0d12] text-slate-100 flex flex-col items-center justify-center p-5 text-center">
        <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#161920] border border-white/[0.08] p-6 sm:p-8 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-medium text-white">Sessão finalizada</h2>
            <p className="text-sm text-slate-400 font-light">
              Você concluiu todos os {cards.length} flashcards desta fila.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                setIsCompleted(false);
              }}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Revisar Novamente
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-colors"
            >
              Voltar aos Decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const frontSubtitle = [currentCard.materia, currentCard.topico].filter(Boolean).join(' · ');

  const backContent = (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center gap-5">
      <p className="text-lg sm:text-2xl md:text-[26px] font-light leading-relaxed tracking-[0.005em] text-slate-100 text-center break-words whitespace-pre-wrap">
        {currentCard.resposta || currentCard.verso}
      </p>

      {currentCard.explicacao && (
        <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 text-left">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1.5">
            Explicação
          </p>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light whitespace-pre-wrap">
            {currentCard.explicacao}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d12] text-slate-100 flex flex-col font-sans overflow-hidden">
      <SubtleFeedbackEffects event={feedbackEvent} />

      {/* Header responsivo */}
      <header className="shrink-0 px-3 sm:px-6 py-3 border-b border-white/[0.06] bg-[#0e1015] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-medium text-slate-100 tracking-tight truncate">
              Flashcards
            </h1>
            {frontSubtitle && (
              <p className="text-[11px] text-slate-400 truncate font-light">
                {frontSubtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-xs sm:max-w-md px-1 sm:px-4">
          <div className="space-y-1.5 text-center">
            <div className="text-[11px] font-normal text-slate-400 tabular-nums">
              <span className="text-slate-100 font-medium">{currentIndex + 1}</span> / {cards.length}
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-300/80 transition-[width] duration-300"
                style={{ width: `${((currentIndex + 1) / Math.max(1, cards.length)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          aria-label="Fechar sessão de flashcards"
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content com Flashcard3D */}
      <main className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <Flashcard3D
            key={currentCard.id}
            front={currentCard.pergunta || currentCard.frente || ''}
            back={backContent}
            flipped={isFlipped}
            onFlip={handleFlip}
            frontLabel={frontSubtitle || 'Pergunta'}
            backLabel="Resposta"
            hint="Toque no cartão para virar"
            disabled={isUpdating}
            className="h-[min(56dvh,420px)] sm:h-[400px]"
          />
        </div>
      </main>

      {/* Footer Controls 100% responsivo no celular */}
      <footer className="shrink-0 px-3 sm:px-8 py-3 sm:py-4 border-t border-white/[0.06] bg-[#0e1015]">
        <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrev}
              disabled={currentIndex === 0 || isUpdating}
              aria-label="Cartão anterior"
              className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleFlip(!isFlipped)}
              disabled={isUpdating}
              className="flex-1 md:flex-initial min-h-[44px] bg-slate-100 text-slate-950 font-medium text-xs sm:text-sm px-6 py-2.5 rounded-xl hover:bg-white transition-colors"
            >
              {isFlipped ? 'Ver Pergunta' : 'Ver Resposta'}
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={currentIndex === cards.length - 1 || isUpdating}
              aria-label="Próximo cartão"
              className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] disabled:opacity-25 transition-colors shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {configLevels.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
              {configLevels.map(level => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => handleFeedback(level.name)}
                  disabled={!isFlipped || isUpdating}
                  className="min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors disabled:opacity-25 disabled:grayscale"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#e2e8f0',
                  }}
                >
                  {level.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
