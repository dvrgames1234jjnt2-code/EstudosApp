'use client';

import React, { useState, useMemo } from 'react';
import { LayoutGrid, ListOrdered, Search, Play, BookOpen } from 'lucide-react';
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
}: FlashcardDashboardProps) {
  const [viewMode, setViewMode] = useState<'decks' | 'list'>('decks');
  const [searchTerm, setSearchTerm] = useState('');

  const isReadyForToday = (nextReviewStr: string | null | undefined) => {
    if (!nextReviewStr) return true;
    const next = new Date(nextReviewStr);
    const now = new Date();
    return next <= now;
  };

  const dueCards = useMemo(
    () => flashcards.filter(c => isReadyForToday(c.proximaRevisao)),
    [flashcards]
  );

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <div className="bg-[#14171d] border border-white/[0.07] rounded-2xl p-4 sm:p-6">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Total de Cards
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums">
            {flashcards.length}
          </p>
        </div>
        <div className="bg-[#14171d] border border-white/[0.07] rounded-2xl p-4 sm:p-6">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Prontos para Revisão
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-slate-100 tabular-nums">
            {dueCards.length}
          </p>
        </div>
        <div className="bg-[#14171d] border border-white/[0.07] rounded-2xl p-4 sm:p-6">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Aprendidos
          </p>
          <p className="text-2xl sm:text-3xl font-semibold text-emerald-400 tabular-nums">
            {flashcards.filter(c => c.feedback && c.feedback !== 'Novo').length}
          </p>
        </div>
      </div>

      {/* Header with Search and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Sua Agenda</h2>
          <p className="text-slate-400 text-xs sm:text-sm font-light">
            {dueCards.length} cartões aguardando revisão hoje
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-slate-300 transition-colors" />
            <input
              type="text"
              placeholder="Buscar cards..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 min-h-[42px] bg-[#14171d] border border-white/[0.08] rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-[#14171d] p-1 rounded-xl border border-white/[0.08] flex shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('decks')}
                aria-label="Visualizar em decks"
                className={`min-w-[38px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${
                  viewMode === 'decks'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="Visualizar em lista"
                className={`min-w-[38px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onStartStudy(dueCards)}
              disabled={dueCards.length === 0}
              className="flex-1 sm:flex-initial min-h-[42px] bg-slate-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs sm:text-sm py-2 px-5 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              Estudar Tudo
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'decks' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {Object.entries(groupedCards).map(([materia, cards]) => (
            <button
              key={materia}
              type="button"
              onClick={() => onStartStudy(cards)}
              className="group text-left h-36 sm:h-44 bg-[#14171d] rounded-2xl sm:rounded-3xl border border-white/[0.08] p-5 flex flex-col justify-between transition-colors hover:border-white/[0.18]"
            >
              <div className="flex justify-between items-start w-full">
                <span className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-slate-300">
                  <BookOpen className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-slate-300 tabular-nums">
                  {cards.length} cards
                </span>
              </div>

              <h3 className="text-white font-medium text-base sm:text-lg leading-snug line-clamp-2">
                {materia}
              </h3>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-[#14171d] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full text-left min-w-[520px]">
              <thead className="sticky top-0 bg-[#101319] border-b border-white/[0.08] z-10">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Pergunta
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Matéria
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredFlashcards.map(card => (
                  <tr
                    key={card.id}
                    onClick={() => onStartStudy([card])}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-3.5">
                      <p className="text-slate-100 text-sm font-light line-clamp-1">
                        {card.pergunta}
                      </p>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5">
                      <span className="text-xs text-slate-400">
                        {card.materia || 'Geral'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5">
                      <span
                        className={`text-xs font-medium ${
                          card.feedback === 'Automático'
                            ? 'text-emerald-400'
                            : card.feedback === 'Esqueci'
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {card.feedback || 'Novo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
