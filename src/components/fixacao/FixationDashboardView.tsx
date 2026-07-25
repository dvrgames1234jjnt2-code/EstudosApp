'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import FixationGame from '@/components/fixacao/FixationGame';
import {
  Flame, BookOpen, Trophy, ChevronRight,
  Loader2, Lock, RefreshCw, Zap, Layers, Filter,
} from 'lucide-react';
import { ChoiceType, FixationDeck, FixationItem } from '@/types/fixation';
import {
  fetchDecks,
  fetchItemsByDeck,
  saveCardProgress,
  saveSessionProgress,
  fetchUserProgress,
  generateSessionId,
} from '@/services/fixationService';
import type { User } from '@supabase/supabase-js';

// Dados de exemplo caso a conexão ainda não retorne
const DEMO_DECKS: FixationDeck[] = [
  { id: 'demo-1', title: 'Open Finance', category: 'Sistema Financeiro', materia: 'Conhecimentos Bancários' },
  { id: 'demo-2', title: 'CRM e Estratégias', category: 'Marketing', materia: 'Vendas e Negociações' },
  { id: 'demo-3', title: 'Ambiente Linux', category: 'Noções de Sistemas Operacionais', materia: 'Informática' },
];

const DEMO_ITEMS: Record<string, FixationItem[]> = {
  'demo-1': [
    { id: 'd1-1', term: 'Consentimento no Open Finance', description: 'Deve incluir identificação do cliente, linguagem clara, prazo limitado a 12 meses, e discriminar a instituição transmissora e os dados compartilhados.', category: 'Open Finance' },
    { id: 'd1-2', term: 'Open Finance', description: 'Sistema que permite o compartilhamento padronizado de dados e serviços financeiros entre instituições autorizadas pelo BACEN, mediante consentimento do cliente.', category: 'Open Finance' },
  ],
  'demo-2': [
    { id: 'd2-1', term: 'CRM Operacional', description: 'Nível responsável pela adaptação e customização prática do sistema de CRM ao modelo de negócios da empresa, incluindo campos personalizados e integrações com sistemas ERP.', category: 'CRM' },
  ],
  'demo-3': [
    { id: 'd3-1', term: 'Diretório /bin', description: 'Contém comandos essenciais do sistema operacionais utilizados por todos os usuários.', category: 'Linux' },
  ],
};

type Screen = 'dashboard' | 'game';

export default function FixationDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [decks, setDecks] = useState<FixationDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [selectedMateria, setSelectedMateria] = useState<string>('TODAS');

  const [screen, setScreen] = useState<Screen>('dashboard');
  const [activeDeck, setActiveDeck] = useState<FixationDeck | null>(null);
  const [activeItems, setActiveItems] = useState<FixationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [isNoCommitment, setIsNoCommitment] = useState(false);
  const [sessionId] = useState(generateSessionId);

  // Progresso do usuário por deck (deckId → { mastered, total })
  const [deckProgress, setDeckProgress] = useState<Record<string, { mastered: number; total: number }>>({});

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Carregar decks ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingDecks(true);
      try {
        const data = await fetchDecks();
        setDecks(data.length > 0 ? data : DEMO_DECKS);
      } catch {
        setDecks(DEMO_DECKS);
      } finally {
        setLoadingDecks(false);
      }
    }
    load();
  }, []);

  // ── Lista única de Matérias para filtro ───────────────────────────────────
  const materias = useMemo(() => {
    const set = new Set<string>();
    decks.forEach(d => {
      if (d.materia) set.add(d.materia);
    });
    return Array.from(set).sort();
  }, [decks]);

  // ── Agrupamento por Matéria ───────────────────────────────────────────────
  const groupedDecks = useMemo(() => {
    const map: Record<string, FixationDeck[]> = {};
    decks.forEach(d => {
      const m = d.materia || 'Geral';
      if (selectedMateria !== 'TODAS' && m !== selectedMateria) return;
      if (!map[m]) map[m] = [];
      map[m].push(d);
    });
    return map;
  }, [decks, selectedMateria]);

  // ── Carregar progresso do usuário nos decks ───────────────────────────────
  const loadProgress = useCallback(async () => {
    if (!user || decks.length === 0) return;
    try {
      for (const deck of decks) {
        const items = DEMO_ITEMS[deck.id] ?? await fetchItemsByDeck(deck.id);
        if (items.length === 0) continue;
        const stats = await fetchUserProgress(user.id, items.map(i => i.id));
        const mastered = Object.values(stats).filter(s => s.lastPerformance === 'mastered').length;
        setDeckProgress(prev => ({ ...prev, [deck.id]: { mastered, total: items.length } }));
      }
    } catch { /* silencioso */ }
  }, [user, decks]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // ── Abrir deck ────────────────────────────────────────────────────────────
  const handleOpenDeck = async (deck: FixationDeck) => {
    setLoadingItems(true);
    setActiveDeck(deck);
    try {
      const items = DEMO_ITEMS[deck.id] ?? await fetchItemsByDeck(deck.id);
      setActiveItems(items);
      setScreen('game');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleUpdateCard = useCallback(async (cardId: string, performance: ChoiceType) => {
    if (!user || isNoCommitment) return;
    try {
      await saveCardProgress(user.id, cardId, performance, sessionId);
    } catch (e) {
      console.error('Erro ao salvar card:', e);
    }
  }, [user, isNoCommitment, sessionId]);

  const handleFinish = useCallback(async (feedback: Record<string, ChoiceType>) => {
    if (!user || isNoCommitment) return;
    try {
      await saveSessionProgress(user.id, sessionId, feedback);
      await loadProgress();
    } catch (e) {
      console.error('Erro ao salvar sessão:', e);
    }
  }, [user, isNoCommitment, sessionId, loadProgress]);

  // ── Tela de jogo ──────────────────────────────────────────────────────────
  if (screen === 'game' && activeDeck) {
    return (
      <div className="w-full h-[calc(100vh-140px)] min-h-[550px] bg-zinc-950 rounded-2xl overflow-hidden flex flex-col border border-white/[0.06]">
        <FixationGame
          title={activeDeck.title}
          items={activeItems}
          onUpdateCard={handleUpdateCard}
          isNoCommitment={isNoCommitment}
          onToggleNoCommitment={() => setIsNoCommitment(v => !v)}
          onFinish={handleFinish}
          onBack={() => { setScreen('dashboard'); setActiveDeck(null); loadProgress(); }}
        />
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6">
      {/* Header local */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#0b0f19] border border-white/[0.06] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Flame size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tight">Fixação — Minigames</h2>
            <p className="text-xs text-zinc-400">Separados por Matéria & Tópico</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {([
            { icon: Zap, label: 'Rápido → avança', color: 'text-blue-400' },
            { icon: RefreshCw, label: 'Branco → recomeça', color: 'text-red-400' },
            { icon: Trophy, label: 'Automático → remove', color: 'text-emerald-400' },
          ] as const).map(({ icon: Icon, label, color }) => (
            <span key={label} className={`flex items-center gap-1.5 text-[10px] font-bold ${color} bg-white/[0.02] px-2.5 py-1 rounded-lg border border-white/[0.04]`}>
              <Icon size={12} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Filtro por Matéria */}
      {materias.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 shrink-0 mr-1">
            <Filter size={11} /> Matéria:
          </span>
          <button
            onClick={() => setSelectedMateria('TODAS')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
              selectedMateria === 'TODAS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-[#0b0f19] border border-white/[0.06] text-slate-400 hover:text-white'
            }`}
          >
            Todas ({decks.length})
          </button>
          {materias.map(materia => {
            const count = decks.filter(d => d.materia === materia).length;
            return (
              <button
                key={materia}
                onClick={() => setSelectedMateria(materia)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                  selectedMateria === materia
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-[#0b0f19] border border-white/[0.06] text-slate-400 hover:text-white'
                }`}
              >
                {materia} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Listagem agrupada por Matéria */}
      {loadingDecks ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
      ) : Object.keys(groupedDecks).length === 0 ? (
        <div className="text-center py-16 bg-[#0b0f19] rounded-2xl border border-white/[0.06]">
          <p className="text-sm font-bold text-slate-400">Nenhum deck encontrado para esta matéria.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedDecks).map(([materiaName, deckList]) => (
            <div key={materiaName} className="space-y-4">
              {/* Header da Matéria */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] pb-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Layers size={14} className="text-indigo-400" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {materiaName}
                </h3>
                <span className="text-[9px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md">
                  {deckList.length} {deckList.length === 1 ? 'deck' : 'decks'}
                </span>
              </div>

              {/* Grid dos Decks da Matéria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {deckList.map((deck, i) => {
                    const prog = deckProgress[deck.id];
                    const pct = prog ? Math.round((prog.mastered / prog.total) * 100) : 0;

                    return (
                      <motion.div
                        key={deck.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => !loadingItems && handleOpenDeck(deck)}
                        className="group relative bg-[#0b0f19] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 cursor-pointer hover:border-indigo-500/40 hover:shadow-[0_8px_32px_rgba(99,102,241,0.12)]"
                      >
                        {/* Tópico (Category) */}
                        {deck.category && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full w-fit max-w-full truncate">
                            {deck.category}
                          </span>
                        )}

                        {/* Título do Deck */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                              <BookOpen size={18} className="text-indigo-400" />
                            </div>
                            <h4 className="text-sm font-black text-white leading-snug group-hover:text-indigo-300 transition-colors">
                              {deck.title}
                            </h4>
                          </div>
                          <ChevronRight size={16} className="text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                        </div>

                        {/* Barra de progresso */}
                        {prog ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                {prog.mastered}/{prog.total} dominados
                              </span>
                              <span className={`text-[9px] font-black ${pct === 100 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-500 font-bold">
                            Clique para iniciar a trilha
                          </div>
                        )}

                        {/* Loading overlay ao abrir */}
                        {loadingItems && activeDeck?.id === deck.id && (
                          <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                            <Loader2 size={20} className="animate-spin text-indigo-400" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aviso de visitante */}
      {!loadingUser && !user && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-4">
          <p className="text-xs text-indigo-300 font-medium">
            💡 Você está no modo visitante. Para salvar seu progresso nos decks, faça login.
          </p>
        </div>
      )}
    </div>
  );
}
