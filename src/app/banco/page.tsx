"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  ArrowLeft,
  BookOpen,
  Layers,
  Loader2,
  RefreshCw,
  Lock,
  User,
  Sparkles,
  BarChart3,
  ChevronDown,
  RotateCcw,
  Flame,
  Printer,
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";
import QuestionsTable, { BancoQuestion } from "../../components/banco/QuestionsTable";
import QuestionResolver from "../../components/banco/QuestionResolver";
import FixationDashboardView from "../../components/fixacao/FixationDashboardView";
import { PrintSimuladoModal } from "../../components/banco/PrintSimuladoModal";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** O que sabemos sobre as respostas de um usuário para uma questão */
export interface QuestionStats {
  lastAnswer: string;          // última letra escolhida (A-E)
  isCorrect: boolean;          // se a última foi correta
  totalAttempts: number;       // total de tentativas
  errorCount: number;          // quantas vezes errou
  correctCount: number;        // quantas vezes acertou
  timestamp: number;           // epoch da última resposta
}

/** Mapa questao_id → stats (derivado do histórico completo) */
type UserAnswers = Record<string, QuestionStats>;

type ActiveTab = "banco" | "resolver" | "desempenho" | "fixacao";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
/** Agrupa as linhas brutas do historico_respostas em stats por questão */
function buildStatsMap(rows: any[]): UserAnswers {
  const map: Record<string, {
    rows: { correto: string; resposta_usuario: string; data: string; horario: string }[];
  }> = {};

  for (const row of rows) {
    const key = String(row.questao_id);
    if (!map[key]) map[key] = { rows: [] };
    map[key].rows.push(row);
  }

  const result: UserAnswers = {};
  for (const [qid, { rows: qrows }] of Object.entries(map)) {
    // Ordena por data+hora de forma robusta para pegar a última
    const sorted = [...qrows].sort((a, b) => {
      const dateAStr = a.data && a.horario ? `${a.data}T${a.horario}` : a.data || "";
      const dateBStr = b.data && b.horario ? `${b.data}T${b.horario}` : b.data || "";
      const da = dateAStr ? new Date(dateAStr).getTime() : 0;
      const db = dateBStr ? new Date(dateBStr).getTime() : 0;
      return da - db;
    });
    const last = sorted[sorted.length - 1];
    const dateStr = last.data && last.horario ? `${last.data}T${last.horario}` : last.data || "";
    const parsedTime = dateStr ? new Date(dateStr).getTime() : Date.now();
    const errorCount  = qrows.filter(r => r.correto === "Não").length;
    const correctCount = qrows.filter(r => r.correto === "Sim").length;

    result[qid] = {
      lastAnswer: last.resposta_usuario,
      isCorrect: last.correto === "Sim",
      totalAttempts: qrows.length,
      errorCount,
      correctCount,
      timestamp: parsedTime,
    };
  }
  return result;
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function BancoPage() {
  const router = useRouter();

  // Auth
  const [user, setUser]             = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGlobalPrintModal, setShowGlobalPrintModal] = useState(false);

  // Data
  const [questions, setQuestions]   = useState<BancoQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});

  // UI
  const [activeTab, setActiveTab]   = useState<ActiveTab>("banco");
  const [selectedQuestion, setSelectedQuestion] = useState<BancoQuestion | null>(null);
  const [resolverQueue, setResolverQueue] = useState<BancoQuestion[]>([]);
  const [resolverIndex, setResolverIndex] = useState(0);
  // Última lista filtrada pela tabela do Banco — usada como fila quando o usuário entra no resolver via filtro
  const [filteredQuestions, setFilteredQuestions] = useState<BancoQuestion[]>([]);
  const [isSaving, setIsSaving]     = useState(false);

  // ── Auth ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch questions ───────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      // Usa supabasePublic (sem JWT do usuário) para não ser bloqueado pela RLS
      const { data, error } = await supabasePublic
        .from("questoes")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;

      const normalized: BancoQuestion[] = (data || []).map((row: any) => ({
        id: row.id,
        materia:  row.Materia || row.Disciplina || row.materia || row.disciplina || "Geral",
        tema:     row.tema       || row.Tema       || row.Tópico || row.Assunto || undefined,
        title:    row.Enunciado  || row.enunciado  || row.texto      || row.title || "",
        dificuldade: row.dificuldade || row.Dificuldade || undefined,
        prova:    row.PROVA      || row.prova      || undefined,
        dat:      row.created_at || row.dat        || undefined,
        referencia: row.referencia || undefined,
        "Alternativa A": row["Alternativa A"] || row.alternativa_a || undefined,
        "Alternativa B": row["Alternativa B"] || row.alternativa_b || undefined,
        "Alternativa C": row["Alternativa C"] || row.alternativa_c || undefined,
        "Alternativa D": row["Alternativa D"] || row.alternativa_d || undefined,
        "Alternativa E": row["Alternativa E"] || row.alternativa_e || undefined,
        "Texto de apoio": row["Texto de apoio"] || row.texto_apoio || undefined,
        perguntaProblema: row["Pergunta problema"] || row.pergunta_problema || row.perguntaProblema || undefined,
        respostaCorreta: row.respostaCorreta || row.resposta_correta || row.Gabarito || row.gabarito || undefined,
        Gabarito: row.Gabarito || row.gabarito || undefined,
        explicacao: row["Comentário"] || row.Comentário || row.comentario || row.Comentario || row.explicacao || row.Explicacao || undefined,
        created_at: row.created_at || undefined,
      }));
      setQuestions(normalized);
      // Inicializa a fila padrão com todas as questões para que o Desempenho funcione de imediato
      setResolverQueue(normalized);
    } catch (err: any) {
      console.error("Erro ao carregar questões:", err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // ── Fetch histórico do usuário ────────────
  const fetchUserAnswers = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("historico_respostas")
        .select("questao_id, resposta_usuario, correto, data, horario, status")
        .eq("User", userId);          // coluna "User" conforme screenshot

      if (error) throw error;
      setUserAnswers(buildStatsMap(data || []));
    } catch (err: any) {
      console.error("Erro ao carregar histórico:", err.message);
    }
  }, []);

  // Carrega questões no mount
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // Carrega histórico sempre que o usuário mudar
  useEffect(() => {
    if (user) fetchUserAnswers(user.id);
    else setUserAnswers({});
  }, [user, fetchUserAnswers]);

  // ── Selecionar questão ────────────────────
  const handleFilteredQuestionsChange = useCallback((filtered: BancoQuestion[]) => {
    setFilteredQuestions(filtered);
    // Só atualiza a fila do resolver se o usuário não estiver no resolver nesse momento
    // (evita resetar índice enquanto está respondendo)
    setResolverQueue(prev => {
      // se a fila atual é igual ao total de questões ou igual ao filtro anterior, atualiza
      return filtered;
    });
  }, []);

  const handleSelectQuestion = (q: BancoQuestion, filteredList?: BancoQuestion[]) => {
    if (!user) { setShowAuthModal(true); return; }
    // Prioridade: filteredList passada pelo clique > filteredQuestions do filtro ativo > resolverQueue > todas as questões
    const queueToUse = (filteredList && filteredList.length > 0)
      ? filteredList
      : (filteredQuestions.length > 0 ? filteredQuestions : (resolverQueue.length > 0 ? resolverQueue : questions));
    setResolverQueue(queueToUse);
    const idx = queueToUse.findIndex(x => x.id === q.id);
    setResolverIndex(idx >= 0 ? idx : 0);
    setSelectedQuestion(q);
    setActiveTab("resolver");
  };

  const handleGenerateTest = (qs: BancoQuestion[]) => {
    if (!user) { setShowAuthModal(true); return; }
    if (qs.length === 0) return;
    setResolverQueue(qs);
    setResolverIndex(0);
    setSelectedQuestion(qs[0]);
    setActiveTab("resolver");
  };

  // ── Salvar resposta no historico_respostas ─
  const handleAnswer = async (questionId: any, answer: string, isCorrect: boolean) => {
    if (!user) return;
    setIsSaving(true);
    const now   = new Date();
    const date  = now.toISOString().slice(0, 10);          // "2026-07-19"
    const time  = now.toTimeString().slice(0, 8);          // "14:13:00"

    try {
      const { error } = await supabase.from("historico_respostas").insert({
        questao_id:       questionId,
        resposta_usuario: answer,
        correto:          isCorrect ? "Sim" : "Não",
        data:             date,
        horario:          time,
        status:           isCorrect ? "Acertei" : "Errei",
        User:             user.id,
      });
      if (error) throw error;

      // Atualiza estado local imediatamente (sem re-fetch)
      setUserAnswers(prev => {
        const existing = prev[String(questionId)];
        const errorCount   = (existing?.errorCount   ?? 0) + (isCorrect ? 0 : 1);
        const correctCount = (existing?.correctCount  ?? 0) + (isCorrect ? 1 : 0);
        return {
          ...prev,
          [String(questionId)]: {
            lastAnswer:   answer,
            isCorrect,
            totalAttempts: (existing?.totalAttempts ?? 0) + 1,
            errorCount,
            correctCount,
            timestamp:    Date.now(),
          },
        };
      });
    } catch (err: any) {
      console.error("Erro ao salvar resposta:", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Navegação no resolver ─────────────────
  const handleNext = () => {
    if (resolverIndex < resolverQueue.length - 1) {
      const n = resolverIndex + 1;
      setResolverIndex(n);
      setSelectedQuestion(resolverQueue[n]);
    }
  };
  const handlePrev = () => {
    if (resolverIndex > 0) {
      const p = resolverIndex - 1;
      setResolverIndex(p);
      setSelectedQuestion(resolverQueue[p]);
    }
  };

  // ── Auth helper ───────────────────────────
  const handleAuthSuccess = async (
    email: string, password?: string,
    mode?: "password" | "otp", isSignUp?: boolean
  ) => {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    if (isSignUp) return supabase.auth.signUp({ email, password: password || "", options: { emailRedirectTo: redirectTo } });
    if (mode === "otp") return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    return supabase.auth.signInWithPassword({ email, password: password || "" });
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Usuário";

  // QuestionsTable usa { isCorrect, answer, timestamp } — extraímos da última resposta
  const tableAnswers: Record<string, { isCorrect: boolean; answer: string; timestamp: number }> =
    Object.fromEntries(
      Object.entries(userAnswers).map(([k, v]) => [
        k,
        { isCorrect: v.isCorrect, answer: v.lastAnswer, timestamp: v.timestamp },
      ])
    );

  const provasDisponiveis = Array.from(new Set(questions.map(q => q.prova).filter(Boolean))).sort() as string[];

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] bg-blue-600/[0.03] blur-[140px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] h-[50%] bg-indigo-600/[0.03] blur-[140px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 h-16 border-b border-white/[0.05] bg-[#020617]/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30">
              <GraduationCap size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-white tracking-tight leading-none">
                Banco <span className="text-blue-500">de Questões</span>
              </h1>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mt-0.5">
                Estação de Treinamento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão de Destaque Imprimir Simulado na Topbar */}
          <button
            onClick={() => setShowGlobalPrintModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all active:scale-95 shrink-0"
          >
            <Printer size={13} /> Imprimir Simulado
          </button>

          <button
            onClick={() => { fetchQuestions(); if (user) fetchUserAnswers(user.id); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-600 hover:text-blue-400 transition-all"
          >
            <RefreshCw size={13} className={loadingQuestions ? "animate-spin" : ""} />
          </button>



          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center">
                <User size={10} className="text-blue-400" />
              </div>
              <span className="text-[11px] font-bold text-slate-300 max-w-[100px] truncate">{displayName}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <Lock size={11} /> Entrar
            </button>
          )}
        </div>
      </nav>

      {/* Tab bar */}
      <div className="sticky top-16 z-40 border-b border-white/[0.05] bg-[#020617]/90 backdrop-blur-md px-4 sm:px-8">
        <div className="flex items-center gap-1 max-w-7xl mx-auto">
          {[
            { id: "banco",      icon: <BookOpen size={13} />,  label: "Banco de Questões", count: questions.length },
            { id: "resolver",   icon: <Layers size={13} />,    label: "Questão Ativa", badge: selectedQuestion ? "●" : null },
            { id: "desempenho", icon: <BarChart3 size={13} />, label: "Desempenho", badge: resolverQueue.length > 0 ? "●" : null },
            { id: "fixacao",    icon: <Flame size={13} />,     label: "Fixação (Minigame)" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "resolver" && !selectedQuestion) return;
                if (tab.id === "desempenho" && resolverQueue.length === 0) return;
                setActiveTab(tab.id as ActiveTab);
              }}
              disabled={
                (tab.id === "resolver" && !selectedQuestion)
              }
              className={`relative px-4 py-3 text-[11px] font-bold border-b-2 flex items-center gap-2 -mb-px transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-white/[0.06] rounded-md text-slate-500">{tab.count}</span>
              )}
              {tab.badge && (
                <span className="text-[8px] text-blue-400 animate-pulse">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        <AnimatePresence mode="wait">

          {/* ── BANCO ── */}
          {activeTab === "banco" && (
            <motion.div
              key="banco"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {loadingQuestions || loadingUser ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <div className="absolute inset-0 bg-blue-600/20 blur-xl animate-pulse" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 animate-pulse">
                    Carregando Banco de Questões...
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner suave para usuário não logado */}
                  {!user && (
                    <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-600/10 border border-blue-500/20">
                      <div className="flex items-center gap-2.5">
                        <Lock size={14} className="text-blue-400 shrink-0" />
                        <p className="text-[11px] text-slate-400">
                          Faça login para salvar seu progresso e ver seu histórico de respostas.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                      >
                        Entrar
                      </button>
                    </div>
                  )}
                  <QuestionsTable
                    questions={questions}
                    userAnswers={tableAnswers}
                    onSelect={handleSelectQuestion}
                    onGenerateTest={handleGenerateTest}
                    onFilteredQuestionsChange={handleFilteredQuestionsChange}
                  />
                </>
              )}
            </motion.div>
          )}

          {/* ── RESOLVER ── */}
          {activeTab === "resolver" && selectedQuestion && (
            <motion.div
              key={`resolver-${resolverIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-6xl mx-auto px-4"
            >
              <div className="w-full h-full min-h-[calc(100vh-200px)] flex flex-col">
                <QuestionResolver
                  question={resolverQueue[resolverIndex]}
                  questionIndex={resolverIndex}
                  totalQuestions={resolverQueue.length}
                  resolverQueue={resolverQueue}
                  userAnswers={userAnswers}
                  onSelectQuestion={(idx) => setResolverIndex(idx)}
                  existingAnswer={
                    userAnswers[String(resolverQueue[resolverIndex]?.id)]
                      ? {
                          isCorrect: userAnswers[String(resolverQueue[resolverIndex].id)].isCorrect,
                          answer:    userAnswers[String(resolverQueue[resolverIndex].id)].lastAnswer,
                          timestamp: userAnswers[String(resolverQueue[resolverIndex].id)].timestamp,
                        }
                      : undefined
                  }
                  stats={userAnswers[String(resolverQueue[resolverIndex]?.id)]}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  onBackToBank={() => setActiveTab("banco")}
                  isSaving={isSaving}
                  provasDisponiveis={provasDisponiveis}
                  onSelectProva={(provaName) => {
                    const newQueue = questions.filter(q => q.prova === provaName);
                    if (newQueue.length > 0) {
                      setResolverQueue(newQueue);
                      setResolverIndex(0);
                      setSelectedQuestion(newQueue[0]);
                    }
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* ── DESEMPENHO ── */}
          {activeTab === "desempenho" && resolverQueue.length > 0 && (() => {
            const answeredCount = resolverQueue.filter(q => userAnswers[String(q.id)]).length;
            const correctCount = resolverQueue.filter(q => userAnswers[String(q.id)]?.isCorrect).length;
            const errorCount = answeredCount - correctCount;
            const progressPercent = resolverQueue.length > 0 ? Math.round((answeredCount / resolverQueue.length) * 100) : 0;
            const successPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

            const topicsMap: Record<string, { total: number; correct: number }> = {};
            resolverQueue.forEach(q => {
              const t = q.tema || q.materia || "Sem Tópico";
              if (!topicsMap[t]) topicsMap[t] = { total: 0, correct: 0 };
              topicsMap[t].total += 1;
              if (userAnswers[String(q.id)]?.isCorrect) {
                topicsMap[t].correct += 1;
              }
            });

            // Detecta se o resolverQueue é um subconjunto (filtrado) do total
            const isQueueFiltered = resolverQueue.length < questions.length;
            // Exibe a prova única do filtro, ou "Filtro Ativo" se misturadas, ou "Todas as Questões"
            const uniqueProvas = Array.from(new Set(resolverQueue.map(q => q.prova).filter(Boolean)));
            const currentProvaName = uniqueProvas.length === 1
              ? uniqueProvas[0]!
              : (isQueueFiltered ? "Filtro Ativo" : "Todas as Questões");
            const filteredLabel = isQueueFiltered
              ? `${resolverQueue.length} de ${questions.length} questões`
              : `${questions.length} questões`;

            return (
              <motion.div
                key="desempenho"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-6xl mx-auto px-4"
              >
                <div className="flex flex-col h-full min-h-0 w-full bg-[#0b0f19]/80 rounded-[2rem] border border-white/[0.04] p-6 sm:p-8 relative overflow-x-hidden gap-6">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#121626] rounded-2xl border border-white/[0.04] gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#0b0f19] flex items-center justify-center shrink-0">
                        <BarChart3 size={14} className="text-blue-500" />
                      </div>
                      <div className="relative">
                        <h2 className="text-sm font-black text-white leading-none">Desempenho & Resultados</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="relative group cursor-pointer">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${isQueueFiltered ? 'text-blue-300 bg-blue-500/20 border border-blue-500/30' : 'text-slate-400 bg-[#1e2436] hover:text-slate-200'}`}>
                              {isQueueFiltered && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />}
                              {currentProvaName} <ChevronDown size={10} className="opacity-50" />
                            </span>
                            <div className="absolute top-full left-0 mt-1.5 w-max bg-[#1e2436] border border-white/[0.04] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-56 overflow-y-auto custom-scrollbar">
                              <div className="p-1.5 space-y-0.5">
                                {provasDisponiveis?.map((prova) => (
                                  <button key={prova} onClick={() => {
                                    const newQueue = questions.filter(q => q.prova === prova);
                                    if (newQueue.length > 0) {
                                      setResolverQueue(newQueue);
                                      setResolverIndex(0);
                                      setSelectedQuestion(newQueue[0]);
                                    }
                                  }}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                                      prova === currentProvaName ? "text-blue-400 bg-blue-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                                    }`}>{prova}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {/* Badge de quantidade filtrada */}
                          {isQueueFiltered && (
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              {filteredLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botão para limpar filtro (ir para todas as questões) */}
                      {isQueueFiltered && (
                        <button
                          onClick={() => {
                            setResolverQueue(questions);
                            setResolverIndex(0);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-wider text-blue-400 hover:bg-blue-600/20 transition-all flex items-center gap-1.5"
                        >
                          <RefreshCw size={10} /> Ver Todas
                        </button>
                      )}
                      <button onClick={() => {
                        // Limpa respostas locais deste simulado para simular um reinicio
                        const updatedAnswers = { ...userAnswers };
                        resolverQueue.forEach(q => {
                          delete updatedAnswers[String(q.id)];
                        });
                        setUserAnswers(updatedAnswers);
                      }} className="px-3 py-1.5 rounded-xl bg-[#1e2436] border border-white/[0.04] text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-all flex items-center gap-1.5">
                        <RotateCcw size={10} className="opacity-50" /> Reiniciar
                      </button>
                    </div>
                  </div>

                  {/* Cards Rápidos */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Progresso Geral */}
                    <div className="p-3 bg-[#121626] rounded-2xl border border-white/[0.04] flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full border-[3px] border-[#1e2436] flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-white/[0.03]" />
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray={`${progressPercent * 2.64} 264`} className="text-blue-500" strokeLinecap="round" />
                        </svg>
                        <span className="text-[8px] font-black text-white">{progressPercent}%</span>
                      </div>
                      <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Progresso</div>
                        <div className="text-sm font-black text-white leading-tight">{answeredCount}/{resolverQueue.length}</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">respondidas</div>
                      </div>
                    </div>

                    {/* Aproveitamento */}
                    <div className="p-3 bg-[#121626] rounded-2xl border border-white/[0.04] flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full border-[3px] border-[#1e2436] flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-white/[0.03]" />
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray={`${successPercent * 2.64} 264`} className="text-emerald-500" strokeLinecap="round" />
                        </svg>
                        <span className="text-[8px] font-black text-white">{successPercent}%</span>
                      </div>
                      <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Aproveit.</div>
                        <div className="text-sm font-black text-white leading-tight">{correctCount} acertos</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">sobre as respondidas</div>
                      </div>
                    </div>

                    {/* Acertos/Erros */}
                    <div className="p-3 bg-[#121626] rounded-2xl border border-white/[0.04] flex gap-2">
                      <div className="flex-1 rounded-xl bg-[#0b0f19] border border-emerald-500/10 flex flex-col items-center justify-center py-2">
                        <div className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Acertos</div>
                        <div className="text-lg font-black text-emerald-400 leading-tight">{correctCount}</div>
                      </div>
                      <div className="flex-1 rounded-xl bg-[#0b0f19] border border-rose-500/10 flex flex-col items-center justify-center py-2">
                        <div className="text-[8px] font-black uppercase tracking-widest text-rose-500">Erros</div>
                        <div className="text-lg font-black text-rose-400 leading-tight">{errorCount}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Folha de Respostas */}
                    <div className="bg-[#121626] rounded-2xl border border-white/[0.04] p-4 flex flex-col">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white mb-1">Folha de Respostas & Navegação</h3>
                      <p className="text-[10px] text-slate-500 mb-4">Clique em qualquer número para ir diretamente à questão</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {resolverQueue?.map((q, idx) => {
                          const ans = userAnswers?.[String(q.id)];
                          const isCurrent = idx === resolverIndex;
                          
                          let boxStyle = "bg-[#1e2436] text-slate-400 hover:bg-white/[0.06] border border-white/[0.04]";

                          if (ans) {
                            if (ans.isCorrect) {
                              boxStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15";
                            } else {
                              boxStyle = "bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/15";
                            }
                          }
                          
                          if (isCurrent) {
                            boxStyle += " ring-2 ring-blue-500 ring-offset-1 ring-offset-[#121626]";
                          }

                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setResolverIndex(idx);
                                setSelectedQuestion(q);
                                setActiveTab("resolver");
                              }}
                              className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black transition-all border shrink-0 ${boxStyle}`}
                            >
                              {idx + 1}
                              {ans && (
                                <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                                  ans.isCorrect ? "bg-emerald-400" : "bg-rose-400"
                                }`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Desempenho por Tópico */}
                    <div className="bg-[#121626] rounded-2xl border border-white/[0.04] p-4 overflow-hidden flex flex-col">
                      <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-white mb-6">Desempenho por Tópico</h3>
                      
                      <div className="space-y-0 flex-1 overflow-y-auto custom-scrollbar pr-3">
                        {Object.entries(topicsMap).map(([topic, data], idx) => {
                          return (
                            <div key={topic} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0 group">
                              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                                <span className="text-[11px] font-bold text-slate-500">{idx + 1}.</span>
                                <span className="text-[12px] font-bold text-slate-300 truncate group-hover:text-white transition-colors">{topic}</span>
                              </div>
                              <div className="text-[10px] font-black text-slate-500 shrink-0 bg-[#1e2436] px-2.5 py-1.5 rounded-lg">
                                {data.correct}/{data.total} acertos
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* ── FIXAÇÃO ── */}
          {activeTab === "fixacao" && (
            <motion.div
              key="fixacao"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <FixationDashboardView />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <PrintSimuladoModal
        isOpen={showGlobalPrintModal}
        onClose={() => setShowGlobalPrintModal(false)}
        questions={filteredQuestions.length > 0 ? filteredQuestions : questions}
        title="SIMULADO BANCO DE QUESTÕES"
        subTitle="Estação de Treinamento — Todas as Questões"
      />
    </div>
  );
}
