'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import FixationGame from '@/components/fixacao/FixationGame';
import {
  Flame, Database, BookOpen, ChevronRight,
  Loader2, Lock, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import {
  ChoiceType,
  FixationCollection,
  FixationSubject,
  FixationTopic,
  FixationDeck,
  FixationItem,
  FeedbackCounts,
} from '@/types/fixation';
import {
  fetchCollections,
  fetchSubjectsByCollection,
  fetchTopicsBySubject,
  fetchDecksByTopic,
  fetchItemsByDeck,
  fetchTopicFeedbackStats,
  saveCardProgress,
  saveSessionProgress,
  generateSessionId,
} from '@/services/fixationService';
import type { User } from '@supabase/supabase-js';

type Step = 'collections' | 'subjects' | 'topics' | 'decks' | 'game';

export default function FixationDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Navegação por passos
  const [step, setStep] = useState<Step>('collections');

  // Seleções ativas
  const [selectedCollection, setSelectedCollection] = useState<FixationCollection | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<FixationSubject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<FixationTopic | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<FixationDeck | null>(null);

  // Listas de dados por nível
  const [collections, setCollections] = useState<FixationCollection[]>([]);
  const [subjects, setSubjects] = useState<FixationSubject[]>([]);
  const [topics, setTopics] = useState<FixationTopic[]>([]);
  const [decks, setDecks] = useState<FixationDeck[]>([]);
  const [gameItems, setGameItems] = useState<FixationItem[]>([]);

  // Feedback stats do tópico selecionado
  const [feedbackCounts, setFeedbackCounts] = useState<FeedbackCounts>({
    forgot: 0, partial: 0, effortful: 0, learning: 0, mastered: 0, newCards: 0,
  });
  const [selectedFeedbackFilter, setSelectedFeedbackFilter] = useState<string | null>(null);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [isNoCommitment, setIsNoCommitment] = useState(false);
  const [sessionId] = useState(generateSessionId);

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

  // ── Carregar Coleções (Passo 1) ───────────────────────────────────────────
  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCollections();
      setCollections(data);
      if (data.length === 1) {
        // Se houver só 1 coleção (ex: Banco do Brasil), já seleciona automaticamente
        const first = data[0];
        setSelectedCollection(first);
        const subData = await fetchSubjectsByCollection(first.id);
        setSubjects(subData);
        setStep('subjects');
      } else {
        setStep('collections');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // ── Selecionar Coleção → carregar Matérias ───────────────────────────────
  const handleSelectCollection = async (col: FixationCollection) => {
    setSelectedCollection(col);
    setLoading(true);
    try {
      const data = await fetchSubjectsByCollection(col.id);
      setSubjects(data);
      setStep('subjects');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Selecionar Matéria → carregar Tópicos ─────────────────────────────────
  const handleSelectSubject = async (sub: FixationSubject) => {
    setSelectedSubject(sub);
    setLoading(true);
    try {
      const data = await fetchTopicsBySubject(sub.id);
      setTopics(data);
      setStep('topics');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Selecionar Tópico → carregar Decks & Feedback Stats ──────────────────
  const handleSelectTopic = async (top: FixationTopic) => {
    setSelectedTopic(top);
    setLoading(true);
    try {
      const decksData = await fetchDecksByTopic(top.id);
      setDecks(decksData);
      const deckIds = decksData.map(d => d.id);
      const { counts } = await fetchTopicFeedbackStats(deckIds);
      setFeedbackCounts(counts);
      setStep('decks');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Selecionar Deck / Pacote → Iniciar Jogo ───────────────────────────────
  const handleSelectDeck = async (deck: FixationDeck) => {
    setSelectedDeck(deck);
    setLoading(true);
    try {
      const items = await fetchItemsByDeck(deck.id);
      setGameItems(items);
      setStep('game');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Callbacks de Progresso ────────────────────────────────────────────────
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
    } catch (e) {
      console.error('Erro ao salvar sessão:', e);
    }
  }, [user, isNoCommitment, sessionId]);

  // ── Tela de Jogo ──────────────────────────────────────────────────────────
  if (step === 'game' && selectedDeck) {
    return (
      <div className="w-full h-[calc(100vh-140px)] min-h-[550px] bg-zinc-950 rounded-2xl overflow-hidden flex flex-col border border-white/[0.06]">
        <FixationGame
          title={selectedDeck.title}
          items={gameItems}
          onUpdateCard={handleUpdateCard}
          isNoCommitment={isNoCommitment}
          onToggleNoCommitment={() => setIsNoCommitment(v => !v)}
          onFinish={handleFinish}
          onBack={() => setStep('decks')}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">

      {/* ── Breadcrumbs no Topo ── */}
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 overflow-x-auto custom-scrollbar pb-1">
        <span
          onClick={() => { setStep('collections'); setSelectedCollection(null); }}
          className={`cursor-pointer transition-colors ${step === 'collections' ? 'text-indigo-400 font-black' : 'hover:text-white'}`}
        >
          COLEÇÕES
        </span>

        {selectedCollection && (
          <>
            <ChevronRight size={10} className="opacity-40 shrink-0" />
            <span
              onClick={() => { setStep('subjects'); setSelectedSubject(null); }}
              className={`cursor-pointer transition-colors shrink-0 ${step === 'subjects' ? 'text-indigo-400 font-black' : 'hover:text-white'}`}
            >
              {selectedCollection.title}
            </span>
          </>
        )}

        {selectedSubject && (
          <>
            <ChevronRight size={10} className="opacity-40 shrink-0" />
            <span
              onClick={() => { setStep('topics'); setSelectedTopic(null); }}
              className={`cursor-pointer transition-colors shrink-0 ${step === 'topics' ? 'text-indigo-400 font-black' : 'hover:text-white'}`}
            >
              {selectedSubject.title}
            </span>
          </>
        )}

        {selectedTopic && (
          <>
            <ChevronRight size={10} className="opacity-40 shrink-0" />
            <span className="text-indigo-400 font-black shrink-0">
              {selectedTopic.title}
            </span>
          </>
        )}
      </div>

      {/* Loader Global */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Carregando...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">

          {/* ──────────────────────────────────────────────────────────────────
              PASSO 1: SUAS COLEÇÕES
             ────────────────────────────────────────────────────────────────── */}
          {step === 'collections' && (
            <motion.div
              key="step-collections"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
                  <Flame size={12} /> FIXAÇÃO MINIGAME
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Suas <span className="text-indigo-400">Coleções</span>
                </h1>
                <p className="text-xs text-slate-400">Escolha uma coleção para começar o seu treinamento.</p>
              </div>

              <div className="space-y-3">
                {collections.map(col => (
                  <motion.div
                    key={col.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                    onClick={() => handleSelectCollection(col)}
                    className="group bg-[#0c101d] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                        <Database size={20} className="text-indigo-400 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                          {col.title}
                        </h3>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-0.5">
                          VER MATÉRIAS
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              PASSO 2: QUAL É A MATÉRIA
             ────────────────────────────────────────────────────────────────── */}
          {step === 'subjects' && (
            <motion.div
              key="step-subjects"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
                  <Flame size={12} /> FIXAÇÃO MINIGAME
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Qual é a <span className="text-indigo-400">Matéria</span>
                </h1>
                <p className="text-xs text-slate-400">Matérias disponíveis em "{selectedCollection?.title}"</p>
              </div>

              <div className="space-y-3">
                {subjects.map(sub => (
                  <motion.div
                    key={sub.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                    onClick={() => handleSelectSubject(sub)}
                    className="group bg-[#0c101d] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 transition-colors">
                        <BookOpen size={20} className="text-emerald-400 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight group-hover:text-emerald-300 transition-colors">
                          {sub.title}
                        </h3>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-0.5">
                          VER TÓPICOS
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              PASSO 3: TÓPICOS DA MATÉRIA
             ────────────────────────────────────────────────────────────────── */}
          {step === 'topics' && (
            <motion.div
              key="step-topics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
                  <BookOpen size={12} /> {selectedSubject?.title}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Selecione o <span className="text-emerald-400">Tópico</span>
                </h1>
                <p className="text-xs text-slate-400">Tópicos disponíveis para treino em "{selectedSubject?.title}"</p>
              </div>

              <div className="space-y-3">
                {topics.map(top => (
                  <motion.div
                    key={top.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                    onClick={() => handleSelectTopic(top)}
                    className="group bg-[#0c101d] border border-white/[0.06] hover:border-emerald-500/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors">
                        <CheckCircle2 size={18} className="text-blue-400 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight group-hover:text-blue-300 transition-colors">
                          {top.title}
                        </h3>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-0.5">
                          VER PACOTES DE PRÁTICA
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────────────────────────
              PASSO 4: FILTRAR FEEDBACKS & ESCOLHER PACOTE (DECKS)
             ────────────────────────────────────────────────────────────────── */}
          {step === 'decks' && (
            <motion.div
              key="step-decks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Card de Filtro de Feedbacks */}
              <div className="bg-[#0c101d] border border-white/[0.06] rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    FILTRAR PARA JOGAR POR FEEDBACKS
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Escolha os tipos de feedback que você deseja revisar na sessão:
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'forgot', label: 'ERREI', count: feedbackCounts.forgot, color: 'border-red-500/30 text-red-400 hover:bg-red-500/10' },
                    { key: 'partial', label: 'QUASE', count: feedbackCounts.partial, color: 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10' },
                    { key: 'effortful', label: 'PENSEI', count: feedbackCounts.effortful, color: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' },
                    { key: 'learning', label: 'RÁPIDO', count: feedbackCounts.learning, color: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' },
                    { key: 'mastered', label: 'AUTOMÁTICO', count: feedbackCounts.mastered, color: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' },
                    { key: 'newCards', label: 'NOVO', count: feedbackCounts.newCards, color: 'border-slate-500/30 text-slate-400 hover:bg-slate-500/10' },
                  ].map(fb => {
                    const isSelected = selectedFeedbackFilter === fb.key;
                    return (
                      <button
                        key={fb.key}
                        onClick={() => setSelectedFeedbackFilter(isSelected ? null : fb.key)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${fb.color} ${
                          isSelected ? 'ring-2 ring-indigo-500 bg-white/5' : 'bg-black/20'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">{fb.label}</span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-white/[0.06]">{fb.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seção Escolha o Pacote para Praticar */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  ESCOLHA O PACOTE PARA PRATICAR
                </h3>

                <div className="space-y-3">
                  {decks.map(deck => (
                    <motion.div
                      key={deck.id}
                      whileHover={{ scale: 1.01, x: 4 }}
                      onClick={() => handleSelectDeck(deck)}
                      className="group bg-[#0c101d] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                          <span className="text-lg">🐧</span>
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
                            {deck.title}
                          </h4>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-0.5">
                            {deck.cardCount ?? 0} CARTÕES
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Banner de aviso para visitante */}
      {!loadingUser && !user && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-4">
          <p className="text-xs text-indigo-300 font-medium">
            💡 Você está no modo visitante. Faça login para registrar seu progresso em cada pacote.
          </p>
        </div>
      )}
    </div>
  );
}
