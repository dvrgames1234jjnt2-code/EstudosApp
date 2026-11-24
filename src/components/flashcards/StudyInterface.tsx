'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Flashcard, SRSConfig } from '@/types/flashcards';
import SubtleFeedbackEffects, { FeedbackEvent } from './SubtleFeedbackEffects';
import { updateCardSRS } from '@/services/notionService';

interface StudyInterfaceProps {
  cards: Flashcard[];
  onExit: () => void;
  configLevels: SRSConfig[];
}

export default function StudyInterface({ cards, onExit, configLevels }: StudyInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState<FeedbackEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    setIsFlipped(false);
    setShowExplanation(false);
  }, [currentIndex]);

  const handleFeedback = async (level: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    setFeedbackEvent({ timestamp: Date.now(), label: level });

    try {
      await updateCardSRS(currentCard.id, level);
      
      // Move to next card after a small delay to show feedback effects
      setTimeout(() => {
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // Finished the deck
          alert("Sessão finalizada!");
          onExit();
        }
        setIsUpdating(false);
      }, 800);
    } catch (error) {
      console.error("Erro ao salvar feedback:", error);
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#06070a] text-white flex flex-col font-sans overflow-hidden">
      <SubtleFeedbackEffects event={feedbackEvent} />

      {/* Header */}
      <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-black/80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="font-black text-xs">BB</span>
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight">FLASHCARDS BB</h1>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Módulo de Memorização</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl px-12">
          <div className="space-y-2 text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Progresso: <span className="text-white">{currentIndex + 1}</span> / {cards.length}
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <button 
          onClick={onExit}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex items-center justify-center p-8">
        <div className="w-full max-w-2xl aspect-[4/3] perspective-2000">
          <div
            key={currentCard.id}
            className="w-full h-full relative preserve-3d"
          >
            {/* The Card */}
            <div
              className="w-full h-full relative preserve-3d cursor-pointer"
              onClick={() => !isUpdating && setIsFlipped(!isFlipped)}
              style={{ transform: `rotateY(${isFlipped ? 180 : 0}deg)` }}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 p-12 flex flex-col items-center justify-center text-center shadow-lg">
                <div className="absolute top-10 flex flex-col items-center gap-1 opacity-60">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">{currentCard.materia}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentCard.topico}</span>
                </div>
                
                <h2 className="text-2xl md:text-4xl font-black leading-tight text-white max-w-lg">
                  {currentCard.pergunta}
                </h2>

                <div className="absolute bottom-10 text-[10px] font-black text-blue-500/40 uppercase tracking-[0.4em]">
                  Toque para girar
                </div>
              </div>

              {/* Back */}
              <div 
                className="absolute inset-0 backface-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] to-[#020617] border border-blue-500/30 p-12 flex flex-col items-center justify-center text-center shadow-lg overflow-hidden"
                style={{ transform: 'rotateY(180deg)' }}
              >
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 flex flex-col justify-center gap-8">
                    <div>
                      <p className="text-[10px] font-black text-blue-400/50 uppercase tracking-[0.4em] mb-4">RESPOSTA</p>
                      <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
                        {currentCard.resposta}
                      </h2>
                    </div>
                    
                    {currentCard.explicacao && (
                      <div className="mt-4 p-6 bg-blue-500/5 border border-blue-500/20 rounded-3xl text-left max-h-[40%] overflow-y-auto custom-scrollbar">
                        <p className="text-[9px] font-black text-blue-400 mb-3 uppercase tracking-widest">Explicação</p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                          {currentCard.explicacao}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="h-32 px-8 flex items-center justify-center border-t border-white/5 bg-black/80">
        <div className="w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0 || isUpdating}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft />
            </button>
            <button 
              onClick={() => setIsFlipped(!isFlipped)}
              className="bg-white text-black font-black text-sm px-8 py-3 rounded-2xl hover:bg-slate-200 transition-colors uppercase tracking-widest"
            >
              {isFlipped ? 'Ver Pergunta' : 'Ver Resposta'}
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1))}
              disabled={currentIndex === cards.length - 1 || isUpdating}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-colors"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {configLevels.map(level => (
              <button
                key={level.id}
                onClick={() => handleFeedback(level.name)}
                disabled={!isFlipped || isUpdating}
                className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-20 disabled:grayscale"
                style={{ 
                  backgroundColor: `${level.color}20`,
                  border: `1px solid ${level.color}40`,
                  color: level.color,
                }}
              >
                {level.name}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Inline styles for 3D card effects */}
      <style jsx global>{`
        .preserve-3d {
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .perspective-2000 {
          perspective: 2000px;
          -webkit-perspective: 2000px;
        }
        @keyframes juice-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-10px) rotate(-1deg); }
          50% { transform: translateX(10px) rotate(1deg); }
          75% { transform: translateX(-10px) rotate(-1deg); }
          100% { transform: translateX(0); }
        }
        .juice-shake {
          animation: juice-shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
