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
  Target,
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  Clock3,
  Search,
  Filter,
  X,
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

type ActiveTab = "banco" | "resolver" | "simulados" | "desempenho" | "fixacao";

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
  const [duvidas, setDuvidas] = useState<Set<string>>(new Set());

  // UI
  const [activeTab, setActiveTab]   = useState<ActiveTab>("banco");
  const [selectedQuestion, setSelectedQuestion] = useState<BancoQuestion | null>(null);
  const [resolverQueue, setResolverQueue] = useState<BancoQuestion[]>([]);
  const [resolverIndex, setResolverIndex] = useState(0);
  // Última lista filtrada pela tabela do Banco — usada como fila quando o usuário entra no resolver via filtro
  const [filteredQuestions, setFilteredQuestions] = useState<BancoQuestion[]>([]);
  const [isSaving, setIsSaving]     = useState(false);
  const [selectedSimulado, setSelectedSimulado] = useState<string | null>(null);
  const [simuladoSearch, setSimuladoSearch]     = useState("");
  const [simuladoStatusFilter, setSimuladoStatusFilter] = useState<"todos" | "concluidos" | "em_andamento" | "nao_iniciados">("todos");
  const [simuladoFamiliaFilter, setSimuladoFamiliaFilter] = useState<string>("todas");

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

  // ── Fetch dúvidas do usuário ───────────────
  const fetchDuvidas = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("duvidas")
        .select("questao_id")
        .eq("user_id", userId);
      if (error) throw error;
      setDuvidas(new Set((data || []).map((r: any) => String(r.questao_id))));
    } catch (err: any) {
      console.error("Erro ao carregar dúvidas:", err.message);
    }
  }, []);

  // ── Toggle dúvida ─────────────────────────
  const handleToggleDuvida = useCallback(async (questaoId: any) => {
    if (!user) return;
    const key = String(questaoId);
    const isMarked = duvidas.has(key);
    // Optimistic update
    setDuvidas(prev => {
      const next = new Set(prev);
      if (isMarked) next.delete(key); else next.add(key);
      return next;
    });
    try {
      if (isMarked) {
        await supabase.from("duvidas").delete().eq("user_id", user.id).eq("questao_id", key);
      } else {
        await supabase.from("duvidas").insert({ user_id: user.id, questao_id: key });
      }
    } catch (err: any) {
      console.error("Erro ao salvar dúvida:", err.message);
      // Revert on error
      setDuvidas(prev => {
        const next = new Set(prev);
        if (isMarked) next.add(key); else next.delete(key);
        return next;
      });
    }
  }, [user, duvidas]);

  // Carrega questões no mount
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // Carrega histórico e dúvidas sempre que o usuário mudar
  useEffect(() => {
    if (user) { fetchUserAnswers(user.id); fetchDuvidas(user.id); }
    else { setUserAnswers({}); setDuvidas(new Set()); }
  }, [user, fetchUserAnswers, fetchDuvidas]);

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
            { id: "banco",      icon: <BookOpen size={13} />,       label: "Banco de Questões", count: questions.length },
            { id: "resolver",   icon: <Layers size={13} />,         label: "Questão Ativa", badge: selectedQuestion ? "●" : null },
            { id: "simulados",  icon: <ClipboardList size={13} />,  label: "Simulados", count: provasDisponiveis.length },
            { id: "desempenho", icon: <BarChart3 size={13} />,      label: "Desempenho", badge: resolverQueue.length > 0 ? "●" : null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "resolver" && !selectedQuestion) return;
                if (tab.id === "desempenho" && resolverQueue.length === 0) return;
                setActiveTab(tab.id as ActiveTab);
              }}
              disabled={(tab.id === "resolver" && !selectedQuestion)}
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
                  stats={userAnswers[String(resolverQueue[resolverIndex]?.id)]}
                  isDuvida={duvidas.has(String(resolverQueue[resolverIndex]?.id))}
                  onToggleDuvida={handleToggleDuvida}
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
                      <div>
                        <h2 className="text-sm font-semibold text-white">Desempenho & Resultados</h2>
                        <span className="text-[10px] text-slate-500">{currentProvaName}</span>
                      </div>
                    </div>
                    {isQueueFiltered && (
                      <button
                        onClick={() => { setResolverQueue(questions); setResolverIndex(0); }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-[10px] font-medium text-blue-400 hover:bg-blue-600/20 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw size={10} /> Ver Todas
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-[#111623] rounded-xl border border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Progresso Geral</div>
                        <div className="text-xl font-normal text-slate-200 mt-1 tabular-nums">
                          {answeredCount} <span className="text-xs text-slate-500">/ {resolverQueue.length} respondidas</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-blue-400 tabular-nums">{progressPercent}%</span>
                      </div>
                    </div>

                    <div className="p-4 bg-[#111623] rounded-xl border border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Taxa de Acerto</div>
                        <div className="text-xl font-normal text-slate-200 mt-1 tabular-nums">
                          {correctCount} <span className="text-xs text-slate-500">acertos</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-semibold tabular-nums ${successPercent >= 70 ? 'text-emerald-400' : successPercent >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {successPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#111623] rounded-xl border border-white/[0.06] flex items-center justify-between gap-3">
                      <div className="flex gap-2 flex-1">
                        <div className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <div className="text-[9px] font-medium text-emerald-400 uppercase">Acertos</div>
                          <div className="text-base font-semibold text-emerald-300 tabular-nums">{correctCount}</div>
                        </div>
                        <div className="flex-1 py-1.5 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                          <div className="text-[9px] font-medium text-rose-400 uppercase">Erros</div>
                          <div className="text-base font-semibold text-rose-300 tabular-nums">{errorCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 p-3 bg-[#111623] rounded-xl border border-white/[0.06]">
                    <span className="text-[11px] text-slate-400 font-medium mr-2 flex items-center gap-1.5">
                      <Target size={13} className="text-blue-400" /> Ações Rápidas:
                    </span>
                    {errorCount > 0 && (
                      <button
                        onClick={() => {
                          const errQueue = resolverQueue.filter(q => userAnswers[String(q.id)] && !userAnswers[String(q.id)]?.isCorrect);
                          setResolverQueue(errQueue); setResolverIndex(0); setSelectedQuestion(errQueue[0]); setActiveTab("resolver");
                        }}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-[11px] font-medium text-rose-300 transition-all flex items-center gap-1.5 outline-none"
                      >
                        Refazer Erros ({errorCount})
                      </button>
                    )}
                    {resolverQueue.length - answeredCount > 0 && (
                      <button
                        onClick={() => {
                          const unQueue = resolverQueue.filter(q => !userAnswers[String(q.id)]);
                          setResolverQueue(unQueue); setResolverIndex(0); setSelectedQuestion(unQueue[0]); setActiveTab("resolver");
                        }}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-[11px] font-medium text-blue-300 transition-all flex items-center gap-1.5 outline-none"
                      >
                        Resolver Pendentes ({resolverQueue.length - answeredCount})
                      </button>
                    )}
                    {Array.from(duvidas).length > 0 && (
                      <button
                        onClick={() => {
                          const duvQueue = resolverQueue.filter(q => duvidas.has(String(q.id)));
                          setResolverQueue(duvQueue); setResolverIndex(0); setSelectedQuestion(duvQueue[0]); setActiveTab("resolver");
                        }}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-[11px] font-medium text-amber-300 transition-all flex items-center gap-1.5 outline-none"
                      >
                        Praticar Dúvidas ({resolverQueue.filter(q => duvidas.has(String(q.id))).length})
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    <div className="bg-[#111623] rounded-xl border border-white/[0.06] p-5 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-slate-200">Gabarito e Navegação</h3>
                        <span className="text-[10px] text-slate-500 font-medium">Agrupado por Matéria</span>
                      </div>
                      <div className="space-y-3 pt-1">
                        {(() => {
                          const gabaritoPorMateria: Record<string, { q: BancoQuestion; idx: number }[]> = {};
                          resolverQueue?.forEach((q, idx) => {
                            const mat = q.materia || "Geral";
                            if (!gabaritoPorMateria[mat]) gabaritoPorMateria[mat] = [];
                            gabaritoPorMateria[mat].push({ q, idx });
                          });

                          return Object.entries(gabaritoPorMateria).map(([mat, items]) => {
                            const feitasMat = items.filter(i => userAnswers?.[String(i.q.id)]).length;
                            const acertosMat = items.filter(i => userAnswers?.[String(i.q.id)]?.isCorrect).length;

                            return (
                              <div key={mat} className="space-y-1.5 border-b border-white/[0.04] pb-2.5 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                                  <span className="truncate flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                                    {mat}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono font-normal">
                                    {feitasMat}/{items.length} feitas {feitasMat > 0 && `(${acertosMat} acertos)`}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {items.map(({ q, idx }) => {
                                    const ans = userAnswers?.[String(q.id)];
                                    const isCurrent = idx === resolverIndex;
                                    const isMarkedDuvida = duvidas.has(String(q.id));
                                    
                                    let boxStyle = "bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] border-white/[0.08]";
                                    if (ans) {
                                      boxStyle = ans.isCorrect
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-rose-500/10 text-rose-400 border-rose-500/30";
                                    }
                                    if (isCurrent) {
                                      boxStyle = isCurrent
                                        ? ans
                                          ? ans.isCorrect
                                            ? "bg-emerald-500/20 text-emerald-300 border-2 border-blue-500"
                                            : "bg-rose-500/20 text-rose-300 border-2 border-blue-500"
                                          : "bg-blue-500/20 text-blue-300 border-2 border-blue-500"
                                        : boxStyle;
                                    }

                                    return (
                                      <button
                                        key={q.id}
                                        onClick={() => { setResolverIndex(idx); setSelectedQuestion(q); setActiveTab("resolver"); }}
                                        className={`relative w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-medium transition-all border shrink-0 outline-none ${boxStyle}`}
                                      >
                                        {idx + 1}
                                        {isMarkedDuvida && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#111623]" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="bg-[#111623] rounded-xl border border-white/[0.06] p-5 overflow-hidden flex flex-col">
                      <h3 className="text-xs font-semibold text-slate-200 mb-4">Desempenho por Tópico</h3>
                      <div className="space-y-3.5 flex-1 overflow-y-auto custom-scrollbar pr-2">
                        {Object.entries(topicsMap).map(([topic, data], idx) => {
                          const topicAcc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                          return (
                            <div key={topic} className="space-y-1.5">
                              <div className="flex items-center justify-between text-[12px]">
                                <span className="text-slate-300 font-normal truncate max-w-[70%]">{idx + 1}. {topic}</span>
                                <span className="text-[11px] text-slate-400 tabular-nums">
                                  {data.correct}/{data.total} <span className="text-slate-500">({topicAcc}%)</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    topicAcc >= 70 ? "bg-emerald-500" : topicAcc >= 50 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${topicAcc}%` }}
                                />
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

          {/* ── SIMULADOS ── */}
          {activeTab === "simulados" && (() => {
            // ─── 1. Estruturação e Parser das Provas ──────────────────────────
            interface ProvaData {
              rawName: string;
              familia: string;
              numero: string;
              tipo: string;
              concurso: string;
              questions: typeof questions;
              answered: number;
              correct: number;
            }

            function parseProvaDetails(rawName: string): { familia: string; numero: string; tipo: string; concurso: string } {
              const parts = rawName.split(/\s*[-–]\s*/).map(s => s.trim()).filter(Boolean);

              let familia = "Geral";
              let numero = "01";
              let tipo = "SIMULADO";
              let concurso = "GERAL";

              if (parts.length >= 4) {
                if (/^\d+$/.test(parts[1])) {
                  familia = parts[0];
                  numero = parts[1].padStart(2, '0');
                  tipo = parts[2].toUpperCase();
                  concurso = parts[3];
                } else if (/^\d+$/.test(parts[2])) {
                  familia = parts[0];
                  tipo = parts[1].toUpperCase();
                  numero = parts[2].padStart(2, '0');
                  concurso = parts[3];
                } else {
                  familia = parts[0];
                  tipo = (parts[2] || parts[1]).toUpperCase();
                  concurso = parts[3];
                  const num = rawName.match(/\b\d+\b/);
                  if (num) numero = num[0].padStart(2, '0');
                }
              } else if (parts.length === 3) {
                familia = parts[0];
                concurso = parts[2];
                const num = parts[1].match(/\d+/);
                if (num) {
                  numero = num[0].padStart(2, '0');
                  tipo = parts[1].replace(/\d+/, '').trim().toUpperCase() || "SIMULADO";
                } else {
                  tipo = parts[1].toUpperCase();
                }
              } else if (parts.length === 2) {
                familia = parts[0];
                const num = parts[1].match(/\d+/);
                if (num) {
                  numero = num[0].padStart(2, '0');
                  tipo = parts[1].replace(/\d+/, '').trim().toUpperCase() || "SIMULADO";
                } else {
                  tipo = parts[1].toUpperCase();
                }
              } else {
                const num = rawName.match(/\d+/);
                if (num) numero = num[0].padStart(2, '0');
                familia = rawName.replace(/\d+/, '').trim() || "Geral";
              }

              return { familia, numero, tipo, concurso };
            }

            const mapaProvas: Record<string, ProvaData> = {};
            for (const q of questions) {
              const provaName = q.prova ?? "Sem Prova";
              if (!mapaProvas[provaName]) {
                const meta = parseProvaDetails(provaName);
                mapaProvas[provaName] = {
                  rawName: provaName,
                  ...meta,
                  questions: [],
                  answered: 0,
                  correct: 0,
                };
              }
              mapaProvas[provaName].questions.push(q);
              const ans = userAnswers[String(q.id)];
              if (ans) {
                mapaProvas[provaName].answered++;
                if (ans.isCorrect) mapaProvas[provaName].correct++;
              }
            }

            const blocos: Record<string, { familia: string; concurso: string; tipos: Record<string, ProvaData[]> }> = {};
            for (const p of Object.values(mapaProvas)) {
              const blocoKey = `${p.familia} · ${p.concurso}`;
              if (!blocos[blocoKey]) {
                blocos[blocoKey] = { familia: p.familia, concurso: p.concurso, tipos: {} };
              }
              if (!blocos[blocoKey].tipos[p.tipo]) {
                blocos[blocoKey].tipos[p.tipo] = [];
              }
              blocos[blocoKey].tipos[p.tipo].push(p);
            }

            for (const b of Object.values(blocos)) {
              for (const t of Object.keys(b.tipos)) {
                b.tipos[t].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
              }
            }

            if (selectedSimulado && mapaProvas[selectedSimulado]) {
              const d = mapaProvas[selectedSimulado];
              const total = d.questions.length;
              const answered = d.answered;
              const correct = d.correct;
              const errors = answered - correct;
              const remaining = total - answered;
              const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
              const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
              const status = answered === 0 ? "nao_iniciado" : answered === total ? "concluido" : "em_andamento";

              return (
                <motion.div key="simulado-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      onClick={() => setSelectedSimulado(null)}
                      className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-200">{selectedSimulado}</h2>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => {
                          if (!user) { setShowAuthModal(true); return; }
                          const qi = status === "concluido" ? 0 : d.questions.findIndex(q => !userAnswers[String(q.id)]);
                          const startIdx = qi >= 0 ? qi : 0;
                          setResolverQueue(d.questions);
                          setResolverIndex(startIdx);
                          setSelectedQuestion(d.questions[startIdx]);
                          setActiveTab("resolver");
                        }}
                        className={`px-4 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                          status === "nao_iniciado" ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : status === "concluido" ? "bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-slate-300"
                          : "bg-amber-500/20 border border-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                        }`}
                      >
                        {status === "nao_iniciado" && <><PlayCircle size={13} /> Iniciar Prova</>}
                        {status === "em_andamento" && <><Clock3 size={13} /> Continuar ({remaining} restantes)</>}
                        {status === "concluido" && <><CheckCircle2 size={13} /> Rever Respostas</>}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "Total Questões", value: total, color: "text-slate-200", bg: "bg-white/[0.03]" },
                      { label: "Respondidas", value: answered, color: "text-slate-200", bg: "bg-white/[0.03]" },
                      { label: "Acertos", value: correct, color: "text-emerald-300", bg: "bg-emerald-500/10 border border-emerald-500/10" },
                      { label: "Erros", value: errors, color: "text-rose-300", bg: "bg-rose-500/10 border border-rose-500/10" },
                    ].map(m => (
                      <div key={m.label} className={`rounded-xl p-4 text-center ${m.bg}`}>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                        <div className={`text-2xl font-semibold tabular-nums ${m.color}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-6 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{progress}% concluído</span>
                      <span className={`tabular-nums ${accuracy >= 70 ? "text-emerald-400" : accuracy >= 50 ? "text-amber-400" : answered === 0 ? "text-slate-500" : "text-rose-400"}`}>
                        {answered > 0 ? `${accuracy}% de acerto` : "—"}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${accuracy >= 70 ? "bg-emerald-500" : accuracy >= 50 ? "bg-amber-500" : answered === 0 ? "bg-slate-700" : "bg-rose-500"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#0c1120] border border-white/[0.08] rounded-2xl p-5">
                    <p className="text-[11px] text-slate-500 mb-4">Clique em uma questão para responder ou visualizar</p>
                    <div className="flex flex-wrap gap-2">
                      {d.questions.map((q, qi) => {
                        const ans = userAnswers[String(q.id)];
                        let cls = "bg-white/[0.04] text-slate-500 border-white/[0.05] hover:bg-white/[0.08]";
                        if (ans) cls = ans.isCorrect
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30";
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              if (!user) { setShowAuthModal(true); return; }
                              setResolverQueue(d.questions);
                              setResolverIndex(qi);
                              setSelectedQuestion(q);
                              setActiveTab("resolver");
                            }}
                            className={`w-9 h-9 rounded-xl border text-[11px] font-bold transition-all hover:scale-110 ${cls}`}
                          >
                            {qi + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            }

            // ─── Lista de Famílias Únicas para o Filtro ───────────────────────
            const todasFamilias = Array.from(new Set(Object.values(mapaProvas).map(p => p.familia))).sort();

            // ─── Renderização Principal: Réplica idêntica do Dashboard da Imagem (Versão Compacta + Filtros) ─────
            return (
              <motion.div key="simulados-dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
                {/* BARRA DE FILTROS SUPERIOR COMPACTA */}
                <div className="bg-[#0b0f1d] border border-white/[0.08] rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
                  {/* Busca por texto */}
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por prova, nº, concurso, família..."
                      value={simuladoSearch}
                      onChange={(e) => setSimuladoSearch(e.target.value)}
                      className="w-full bg-[#151b2d] border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                    {simuladoSearch && (
                      <button
                        onClick={() => setSimuladoSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtro de Família */}
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                      value={simuladoFamiliaFilter}
                      onChange={(e) => setSimuladoFamiliaFilter(e.target.value)}
                      className="bg-[#151b2d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 transition-all"
                    >
                      <option value="todas">Todas as Famílias</option>
                      {todasFamilias.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>

                    {/* Filtro de Status (Pills) */}
                    <div className="flex items-center bg-[#151b2d] border border-white/10 rounded-xl p-1 gap-1">
                      {[
                        { id: "todos", label: "Todos" },
                        { id: "concluidos", label: "🟢 Feitos" },
                        { id: "em_andamento", label: "🔴 Andamento" },
                        { id: "nao_iniciados", label: "⚪ Virgens" },
                      ].map(st => (
                        <button
                          key={st.id}
                          onClick={() => setSimuladoStatusFilter(st.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            simuladoStatusFilter === st.id
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* LISTAGEM DE BLOCOS */}
                {Object.entries(blocos).map(([blocoKey, bloco]) => {
                  // Filtrar provas pela busca, família e status
                  if (simuladoFamiliaFilter !== "todas" && bloco.familia !== simuladoFamiliaFilter) {
                    return null;
                  }

                  const tiposFiltrados: Record<string, ProvaData[]> = {};

                  for (const [tipoNome, provasDoTipo] of Object.entries(bloco.tipos)) {
                    const provasMatching = provasDoTipo.filter(p => {
                      // Busca por texto
                      if (simuladoSearch.trim()) {
                        const term = simuladoSearch.toLowerCase();
                        const matchName = p.rawName.toLowerCase().includes(term);
                        const matchNum = p.numero.includes(term);
                        const matchFam = p.familia.toLowerCase().includes(term);
                        const matchConc = p.concurso.toLowerCase().includes(term);
                        if (!matchName && !matchNum && !matchFam && !matchConc) return false;
                      }

                      // Filtro de Status
                      const qTot = p.questions.length;
                      const isConcluida = p.answered === qTot && qTot > 0;
                      const isEmAndamento = p.answered > 0 && !isConcluida;
                      const isNaoIniciada = p.answered === 0;

                      if (simuladoStatusFilter === "concluidos" && !isConcluida) return false;
                      if (simuladoStatusFilter === "em_andamento" && !isEmAndamento) return false;
                      if (simuladoStatusFilter === "nao_iniciados" && !isNaoIniciada) return false;

                      return true;
                    });

                    if (provasMatching.length > 0) {
                      tiposFiltrados[tipoNome] = provasMatching;
                    }
                  }

                  if (Object.keys(tiposFiltrados).length === 0) return null;

                  const todasProvas = Object.values(tiposFiltrados).flat();
                  let concluidasCount = 0;
                  let emAndamentoCount = 0;
                  let naoIniciadasCount = 0;
                  let totalQuestõesBloco = 0;
                  let respondidasQuestõesBloco = 0;
                  let acertosQuestõesBloco = 0;

                  todasProvas.forEach(p => {
                    const qTot = p.questions.length;
                    totalQuestõesBloco += qTot;
                    respondidasQuestõesBloco += p.answered;
                    acertosQuestõesBloco += p.correct;
                    if (p.answered === 0) naoIniciadasCount++;
                    else if (p.answered === qTot) concluidasCount++;
                    else emAndamentoCount++;
                  });

                  const pendentesQuestõesBloco = totalQuestõesBloco - respondidasQuestõesBloco;
                  const aproveitamentoGeral = respondidasQuestõesBloco > 0 
                    ? Math.round((acertosQuestõesBloco / respondidasQuestõesBloco) * 100) 
                    : 0;

                  return (
                    <div
                      key={blocoKey}
                      className="bg-[#0b0f1d] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl backdrop-blur-xl"
                    >
                      {/* 1. TOPO SUPERIOR (Familiaridade / Concurso | Status Globais) */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
                        {/* Seletor Pill (2G | BLOCO) */}
                        <div className="flex items-center bg-[#151b2d] border border-white/10 rounded-xl p-1 shadow-inner">
                          <span className="bg-blue-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                            {bloco.familia}
                          </span>
                          <span className="text-slate-400 font-bold text-[10px] px-2.5 py-1 uppercase tracking-wider">
                            {bloco.concurso}
                          </span>
                        </div>

                        {/* Indicadores no canto superior direito (LOTADOS / DISPONÍVEIS / VAZIOS / OCUPAÇÃO) */}
                        <div className="flex items-center gap-4 sm:gap-6 ml-auto">
                          <div className="flex items-center gap-1.5 text-right">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <div>
                              <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">CONCLUÍDOS</div>
                              <div className="text-sm font-black text-slate-100 tabular-nums leading-tight">{concluidasCount}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-right">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">EM ANDAMENTO</div>
                              <div className="text-sm font-black text-slate-100 tabular-nums leading-tight">{emAndamentoCount}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-right">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                            <div>
                              <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">NÃO INICIADOS</div>
                              <div className="text-sm font-black text-slate-100 tabular-nums leading-tight">{naoIniciadasCount}</div>
                            </div>
                          </div>

                          <div className="pl-3 border-l border-white/10 text-right">
                            <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">APROVEITAMENTO</div>
                            <div className="text-lg font-black text-white tabular-nums leading-none tracking-tight">
                              {aproveitamentoGeral}<span className="text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. LINHA DE CAPACIDADES GERAIS (CAPACIDADE TOTAL / EM USO / ESPAÇO LIVRE) */}
                      <div className="bg-[#070a14] border border-white/[0.05] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-6 w-full sm:w-auto justify-around sm:justify-start">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CAPACIDADE TOTAL</div>
                            <div className="text-base sm:text-lg font-black text-white tabular-nums">
                              {totalQuestõesBloco} <span className="text-[10px] font-bold text-slate-500">QUESTÕES</span>
                            </div>
                          </div>

                          <div className="h-6 w-px bg-white/10" />

                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RESPONDIDAS</div>
                            <div className="text-base sm:text-lg font-black text-emerald-400 tabular-nums">
                              {respondidasQuestõesBloco} <span className="text-[10px] font-bold text-emerald-500/70">RES</span>
                            </div>
                          </div>

                          <div className="h-6 w-px bg-white/10" />

                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PENDENTES</div>
                            <div className="text-base sm:text-lg font-black text-blue-400 tabular-nums">
                              {pendentesQuestõesBloco} <span className="text-[10px] font-bold text-blue-500/70">PEND</span>
                            </div>
                          </div>
                        </div>

                        {/* STATUS GLOBAL BADGE */}
                        <div className="self-end sm:self-center">
                          <span className="px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                            STATUS GLOBAL: {aproveitamentoGeral >= 70 ? "ALTO RENDIMENTO" : "EM ANDAMENTO"}
                          </span>
                        </div>
                      </div>

                      {/* 3. SEÇÕES DE TIPOS (SIMULADO, PROVAS, etc.) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                        {Object.entries(tiposFiltrados).map(([tipoNome, provasDoTipo]) => {
                          const tipoTotalQ = provasDoTipo.reduce((s, p) => s + p.questions.length, 0);
                          const tipoAnsweredQ = provasDoTipo.reduce((s, p) => s + p.answered, 0);
                          const tipoPendingQ = tipoTotalQ - tipoAnsweredQ;

                          // Agrupar provas pela matéria dominante
                          const porMateria: Record<string, ProvaData[]> = {};
                          for (const prova of provasDoTipo) {
                            const freq: Record<string, number> = {};
                            prova.questions.forEach(q => {
                              const m = q.materia || "Geral";
                              freq[m] = (freq[m] || 0) + 1;
                            });
                            const matDom = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || "Geral";
                            if (!porMateria[matDom]) porMateria[matDom] = [];
                            porMateria[matDom].push(prova);
                          }
                          const materias = Object.keys(porMateria).sort();

                          return (
                            <div key={tipoNome} className="space-y-2 bg-[#080c18] border border-white/[0.04] rounded-xl p-3.5">
                              {/* Cabeçalho do Tipo */}
                              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                                <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                                  <span className="w-1 h-2.5 bg-blue-500 rounded-full" />
                                  {tipoNome}
                                </h4>
                                <div className="flex items-center gap-2.5 text-[10px] font-mono">
                                  <span className="text-slate-400">TOT: <strong className="text-slate-200 font-bold">{tipoTotalQ}</strong></span>
                                  <span className="text-slate-400">FEITOS: <strong className="text-emerald-400 font-bold">{tipoAnsweredQ}</strong></span>
                                  <span className="text-slate-400">PEND: <strong className="text-blue-400 font-bold">{tipoPendingQ}</strong></span>
                                </div>
                              </div>

                              {/* GRID DE PROVAS agrupadas por Matéria dominante */}
                              <div className="space-y-2 pt-0.5">
                                {materias.map(mat => {
                                  const provasMat = porMateria[mat];
                                  const matAnswered = provasMat.reduce((s, p) => s + p.answered, 0);
                                  const matTotal   = provasMat.reduce((s, p) => s + p.questions.length, 0);
                                  return (
                                    <div key={mat}>
                                      {/* Sub-header da Matéria — só aparece se há mais de 1 matéria */}
                                      {materias.length > 1 && (
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 truncate max-w-[65%]">{mat}</span>
                                          <span className="text-[9px] font-mono text-slate-600 tabular-nums">{matAnswered}/{matTotal}</span>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-1.5">
                                        {provasMat.map(prova => {
                                          const qTot = prova.questions.length;
                                          const isConcluida = prova.answered === qTot && qTot > 0;
                                          const isEmAndamento = prova.answered > 0 && !isConcluida;

                                          let tileStyle = "bg-[#0f1422] border-white/[0.08] text-slate-500 hover:border-slate-500 hover:text-slate-300";
                                          if (isConcluida) {
                                            tileStyle = "bg-[#0a2318] border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
                                          } else if (isEmAndamento) {
                                            tileStyle = "bg-[#271018] border-rose-500/50 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)]";
                                          }

                                          return (
                                            <button
                                              key={prova.rawName}
                                              onClick={() => {
                                                setResolverQueue(prova.questions);
                                                setResolverIndex(0);
                                                setSelectedQuestion(prova.questions[0]);
                                                setActiveTab("desempenho");
                                              }}
                                              title={`${prova.rawName} — ${prova.answered}/${qTot} feitas · clique para ver o desempenho`}
                                              className={`w-10 h-8 rounded-lg border-2 font-mono font-black text-[10px] transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${tileStyle}`}
                                            >
                                              {prova.numero}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            );
          })()}

          {/* ── FIXAÇÃO (oculta) ── */}
          {activeTab === "fixacao" && (
            <motion.div key="fixacao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
