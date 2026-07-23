'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, ListOrdered, Search, Shuffle, Play, CheckSquare, Square, X } from 'lucide-react';
import { Flashcard, SRSConfig } from '@/types/flashcards';

interface FlashcardDashboardProps {
  flashcards: Flashcard[];
  onStartStudy: (cards: Flashcard[]) => void;
  isLoading: boolean;
  configLevels: SRSConfig[];
}

export default function FlashcardDashboard({ 
  flashcards, 
  onStartStudy, 
  isLoading, 
  configLevels 
}: FlashcardDashboardProps) {
  const [viewMode, setViewMode] = useState<'decks' | 'list'>('decks');
  const [searchTerm, setSearchTerm] = useState('');

  const isReadyForToday = (nextReviewStr: string | null | undefined) => {
    if (!nextReviewStr) return true;
    const next = new Date(nextReviewStr);
    const now = new Date();
    return next <= now;
  };

  const dueCards = useMemo(() => flashcards.filter(c => isReadyForToday(c.proximaRevisao)), [flashcards]);

  const groupedCards = useMemo(() => {
    return dueCards.reduce((groups, card) => {
      const m = card.materia || 'Geral';
      if (!groups[m]) groups[m] = [];
      groups[m].push(card);
      return groups;
    }, {} as Record<string, Flashcard[]>);
  }, [dueCards]);

  const filteredFlashcards = useMemo(() => {
    if (!searchTerm) return flashcards;
    const q = searchTerm.toLowerCase();
    return flashcards.filter(c => 
      (c.pergunta + ' ' + c.resposta + ' ' + (c.materia || '')).toLowerCase().includes(q)
    );
  }, [flashcards, searchTerm]);

  const SUBJECT_ICONS: Record<string, string> = {
    'Conhecimentos Bancários': '🏛️',
    'Direito': '⚖️',
    'Informática': '💻',
    'Matemática': '🔢',
    'Língua Portuguesa': '✍️',
    'Raciocínio Lógico': '🧠',
    'Geral': '📚'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total de Cards</p>
          <p className="text-3xl font-black text-white">{flashcards.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 backdrop-blur-xl">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Prontos para Revisão</p>
          <p className="text-3xl font-black text-blue-400">{dueCards.length}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 backdrop-blur-xl">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-1">Aprendidos</p>
          <p className="text-3xl font-black text-green-400">
            {flashcards.filter(c => c.feedback && c.feedback !== 'Novo').length}
          </p>
        </div>
      </div>

      {/* Header with Search and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Sua Agenda</h2>
          <p className="text-gray-400 text-sm">
            {dueCards.length} cartões aguardando revisão hoje
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 transition-all"
            />
          </div>

          <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex">
            <button 
              onClick={() => setViewMode('decks')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'decks' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => onStartStudy(dueCards)}
            disabled={dueCards.length === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Estudar Tudo
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'decks' ? (
          <motion.div 
            key="decks"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"
          >
            {Object.entries(groupedCards).map(([materia, cards]) => (
              <motion.div
                key={materia}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => onStartStudy(cards)}
                className="group cursor-pointer"
              >
                <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl border border-white/5 p-6 flex flex-col justify-between overflow-hidden shadow-2xl transition-all group-hover:border-blue-500/50">
                  {/* Decorative card stack effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex justify-between items-start">
                    <span className="text-4xl">{SUBJECT_ICONS[materia] || '📚'}</span>
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
                      {cards.length}
                    </span>
                  </div>
                  
                  <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
                    {materia}
                  </h3>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gray-900 border-b border-white/10 z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Pergunta</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Matéria</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredFlashcards.map(card => (
                    <tr key={card.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-white text-sm font-medium line-clamp-1">{card.pergunta}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-lg">
                          {card.materia || '---'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-tighter ${
                          card.feedback === 'Automático' ? 'bg-green-500/20 text-green-400' :
                          card.feedback === 'Esqueci' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {card.feedback || 'Novo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
