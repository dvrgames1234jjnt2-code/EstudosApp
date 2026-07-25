'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import FixationGame from '@/components/fixacao/FixationGame';
import {
  Flame, BookOpen, Trophy, ChevronRight,
  Loader2, Lock, RefreshCw, Zap, Target,
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

// ─────────────────────────────────────────────────────────────────────────────
// Dados de exemplo (usados enquanto o banco não tem conteúdo)
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_DECKS: FixationDeck[] = [
  { id: 'demo-1', title: 'Open Finance', category: 'Sistema Financeiro' },
  { id: 'demo-2', title: 'CRM e Estratégias', category: 'Marketing' },
];

const DEMO_ITEMS: Record<string, FixationItem[]> = {
  'demo-1': [
    { id: 'd1-1', term: 'Consentimento no Open Finance', description: 'Deve incluir identificação do cliente, linguagem clara, prazo limitado a 12 meses, e discriminar a instituição transmissora e os dados compartilhados.', category: 'Open Finance' },
    { id: 'd1-2', term: 'Open Finance', description: 'Sistema que permite o compartilhamento padronizado de dados e serviços financeiros entre instituições autorizadas pelo BACEN, mediante consentimento do cliente.', category: 'Open Finance' },
    { id: 'd1-3', term: 'Prazo do consentimento', description: 'O consentimento no Open Finance é limitado a 12 meses, podendo ser revogado pelo cliente a qualquer momento.', category: 'Open Finance' },
  ],
  'demo-2': [
    { id: 'd2-1', term: 'CRM Operacional', description: 'Nível responsável pela adaptação e customização prática do sistema de CRM ao modelo de negócios da empresa, incluindo campos personalizados e integrações com sistemas ERP.', category: 'CRM' },
    { id: 'd2-2', term: 'Promoção de Vendas', description: 'Premiações vinculadas a grandes gastos podem desestimular consumidores; programas multiníveis com prêmios de baixo valor podem funcionar como motivadores.', category: 'Marketing' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

type Screen = 'dashboard' | 'game';

const PERF_COLORS: Record<ChoiceType, { bg: string; text: string; label: string }> = {
  mastered:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Automático' },
  learning:  { bg: 'bg-blue-500/10',    text: 'text-blue-400',    label: 'Rápido'     },
  effortful: { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  label: 'Pensei'     },
  partial:   { bg: 'bg-orange-500/10',  text: 'text-orange-400',  label: 'Quase'      },
  forgot:    { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Branco'     },
};

export default function FixacaoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [decks, setDecks] = useState<FixationDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);

  const [screen, setScreen] = useState<Screen>('dashboard');
  const [activeDeck, setActiveDeck] = useState<FixationDeck | null>(null);
  const [activeItems, setActiveItems] = useState<FixationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [isNoCommitment, setIsNoCommitment] = useState(false);
  const [sessionId] = useState(generateSessionId);

  // Progresso do usuário por deck (deckId → { masteredCount, total })
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
    if (!user) return;
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

  // ── Callback de card respondido ───────────────────────────────────────────
  const handleUpdateCard = useCallback(async (cardId: string, performance: ChoiceType) => {
    if (!user || isNoCommitment) return;
    try {
      await saveCardProgress(user.id, cardId, performance, sessionId);
    } catch (e) {
      console.error('Erro ao salvar card:', e);
    }
  }, [user, isNoCommitment, sessionId]);

  // ── Callback de fim de sessão ─────────────────────────────────────────────
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
      <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
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
    <div className="min-h-screen bg-[#060912] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/[0.04] bg-[#060912]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Flame size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase">Fixação</h1>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Trilha de Memorização</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Progresso sendo salvo
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Intro */}
        <div className="text-center space-y-2">
          <p className="text-zinc-500 text-sm max-w-lg mx-auto leading-relaxed">
            Escolha um deck abaixo. A cada sessão, os cards se reorganizam para maximizar sua retenção.
          </p>
          <div className="flex items-center justify-center gap-4 pt-1">
            {([
              { icon: Zap, label: 'Rápido → avança', color: 'text-blue-400' },
              { icon: RefreshCw, label: 'Branco → recomeça', color: 'text-red-400' },
              { icon: Trophy, label: 'Automático → remove', color: 'text-emerald-400' },
            ] as const).map(({ icon: Icon, label, color }) => (
              <span key={label} className={`flex items-center gap-1 text-[10px] font-bold ${color}`}>
                <Icon size={11} /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Grid de Decks */}
        {loadingDecks ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {decks.map((deck, i) => {
                const prog = deckProgress[deck.id];
                const pct = prog ? Math.round((prog.mastered / prog.total) * 100) : 0;
                const isLocked = !user;

                return (
                  <motion.div
                    key={deck.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => !isLocked && !loadingItems && handleOpenDeck(deck)}
                    className={`group relative bg-[#0b0f19] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 ${
                      isLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-indigo-500/40 hover:shadow-[0_8px_32px_rgba(99,102,241,0.12)]'
                    }`}
                  >
                    {/* Categoria */}
                    {deck.category && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full w-fit">
                        {deck.category}
                      </span>
                    )}

                    {/* Título */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <BookOpen size={18} className="text-indigo-400" />
                        </div>
                        <h2 className="text-sm font-black text-white leading-snug group-hover:text-indigo-300 transition-colors">
                          {deck.title}
                        </h2>
                      </div>
                      {isLocked ? (
                        <Lock size={16} className="text-zinc-600 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* Barra de progresso */}
                    {prog && (
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
                    )}

                    {/* Loading ao abrir */}
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
        )}

        {/* Login CTA */}
        {!loadingUser && !user && (
          <div className="flex items-center justify-center py-6">
            <div className="bg-[#0b0f19] border border-indigo-500/20 rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
              <Lock size={28} className="text-indigo-400 mx-auto" />
              <h3 className="text-sm font-black text-white">Login necessário</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Faça login para salvar seu progresso e acessar os decks de fixação.
              </p>
              <a
                href="/banco"
                className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest"
              >
                Fazer Login
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
