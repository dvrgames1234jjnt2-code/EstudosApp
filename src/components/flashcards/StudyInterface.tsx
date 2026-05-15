'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Info, RotateCcw } from 'lucide-react';
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
      <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
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
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <button 
          onClick={onExit}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-500 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex items-center justify-center p-8">
        <div className="w-full max-w-2xl aspect-[4/3] perspective-2000">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, scale: 0.9, x: 100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -100 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="w-full h-full relative preserve-3d"
            >
              {/* The Card */}
              <motion.div 
                className="w-full h-full relative cursor-pointer"
                onClick={() => !isUpdating && setIsFlipped(!isFlipped)}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-800 to-black border border-white/5 p-12 flex flex-col items-center justify-center text-center shadow-2xl">
                  <div className="absolute top-8 left-12 right-12 flex flex-col items-center gap-1 opacity-40">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{currentCard.materia}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{currentCard.topico}</span>
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-200">
                    {currentCard.pergunta}
                  </h2>

                  <div className="absolute bottom-8 text-[10px] font-bold text-blue-500/50 uppercase tracking-widest animate-pulse">
                    Clique para revelar a resposta
                  </div>
                </div>

                {/* Back */}
                <div 
                  className="absolute inset-0 backface-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] to-black border border-blue-500/20 p-12 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden"
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  {/* Background Decoration */}
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Info className="w-32 h-32" />
                  </div>

                  <div className="w-full h-full flex flex-col">
                    <div className="flex-1 flex flex-col justify-center gap-6">
                      <p className="text-sm font-bold text-blue-400 uppercase tracking-widest opacity-40">RESPOSTA</p>
                      <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
                        {currentCard.resposta}
                      </h2>
                      
                      {currentCard.explicacao && (
                        <div className="mt-4 p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
                          <p className="text-xs font-bold text-blue-400 mb-2">EXPLICAÇÃO</p>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {currentCard.explicacao}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="h-32 px-8 flex items-center justify-center border-t border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0 || isUpdating}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all"
            >
              <ChevronLeft />
            </button>
            <button 
              onClick={() => setIsFlipped(!isFlipped)}
              className="bg-white text-black font-black text-sm px-8 py-3 rounded-2xl hover:scale-105 transition-all uppercase tracking-widest"
            >
              {isFlipped ? 'Ver Pergunta' : 'Ver Resposta'}
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1))}
              disabled={currentIndex === cards.length - 1 || isUpdating}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {configLevels.map(level => (
              <motion.button
                key={level.id}
                whileHover={{ y: -4, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeedback(level.name)}
                disabled={!isFlipped || isUpdating}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 disabled:grayscale`}
                style={{ 
                  backgroundColor: `${level.color}20`,
                  border: `1px solid ${level.color}40`,
                  color: level.color,
                }}
              >
                {level.name}
              </motion.button>
            ))}
          </div>
        </div>
      </footer>

      {/* Inline styles for 3D card effects */}
      <style jsx global>{`
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .perspective-2000 {
          perspective: 2000px;
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
