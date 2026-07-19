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
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";
import QuestionsTable, { BancoQuestion } from "../../components/banco/QuestionsTable";
import QuestionResolver from "../../components/banco/QuestionResolver";

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

type ActiveTab = "banco" | "resolver";

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
    // Ordena por data+hora para pegar a última
    const sorted = [...qrows].sort((a, b) => {
      const da = new Date(`${a.data}T${a.horario}`).getTime();
      const db = new Date(`${b.data}T${b.horario}`).getTime();
      return da - db;
    });
    const last = sorted[sorted.length - 1];
    const errorCount  = qrows.filter(r => r.correto === "Não").length;
    const correctCount = qrows.filter(r => r.correto === "Sim").length;

    result[qid] = {
      lastAnswer: last.resposta_usuario,
      isCorrect: last.correto === "Sim",
      totalAttempts: qrows.length,
      errorCount,
      correctCount,
      timestamp: new Date(`${last.data}T${last.horario}`).getTime(),
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

  // Data
  const [questions, setQuestions]   = useState<BancoQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});

  // UI
  const [activeTab, setActiveTab]   = useState<ActiveTab>("banco");
  const [selectedQuestion, setSelectedQuestion] = useState<BancoQuestion | null>(null);
  const [resolverQueue, setResolverQueue] = useState<BancoQuestion[]>([]);
  const [resolverIndex, setResolverIndex] = useState(0);
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
      const { data, error } = await supabase
        .from("questoes")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;

      const normalized: BancoQuestion[] = (data || []).map((row: any) => ({
        id: row.id,
        materia:  row.Disciplina || row.materia   || row.disciplina || "Geral",
        tema:     row.tema       || row.Tema       || undefined,
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
        respostaCorreta: row.respostaCorreta || row.resposta_correta || row.Gabarito || row.gabarito || undefined,
        Gabarito: row.Gabarito || row.gabarito || undefined,
        explicacao: row.explicacao || row.Explicacao || undefined,
        created_at: row.created_at || undefined,
      }));
      setQuestions(normalized);
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
  const handleSelectQuestion = (q: BancoQuestion) => {
    if (!user) { setShowAuthModal(true); return; }
    setResolverQueue(questions);
    setResolverIndex(questions.findIndex(x => x.id === q.id));
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

  // ── Adapta userAnswers para o formato que QuestionsTable espera ──
  // QuestionsTable usa { isCorrect, answer, timestamp } — extraímos da última resposta
  const tableAnswers: Record<string, { isCorrect: boolean; answer: string; timestamp: number }> =
    Object.fromEntries(
      Object.entries(userAnswers).map(([k, v]) => [
        k,
        { isCorrect: v.isCorrect, answer: v.lastAnswer, timestamp: v.timestamp },
      ])
    );

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
          <button onClick={() => router.push("/")} className="group flex items-center gap-2 text-slate-500 hover:text-white transition-all">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div className="h-5 w-px bg-white/10" />
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
            { id: "banco",    icon: <BookOpen size={13} />, label: "Banco de Questões", count: questions.length },
            { id: "resolver", icon: <Layers   size={13} />, label: "Resolver Questão",  badge: selectedQuestion ? "●" : null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "resolver" && !selectedQuestion) return;
                setActiveTab(tab.id as ActiveTab);
              }}
              disabled={tab.id === "resolver" && !selectedQuestion}
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
              {loadingQuestions ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <div className="absolute inset-0 bg-blue-600/20 blur-xl animate-pulse" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 animate-pulse">
                    Carregando Banco de Questões...
                  </p>
                </div>
              ) : !user ? (
                <div className="mt-10 flex flex-col items-center gap-6 py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                    <Lock size={28} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white mb-2">Acesso Necessário</h2>
                    <p className="text-sm text-slate-500 max-w-sm">
                      Faça login para acessar o banco de questões e ter seu progresso salvo automaticamente.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                  >
                    Entrar Agora
                  </button>
                  {/* Preview desfocado */}
                  <div className="w-full mt-6 opacity-30 pointer-events-none select-none">
                    <QuestionsTable
                      questions={questions.slice(0, 5)}
                      userAnswers={{}}
                      onSelect={() => {}}
                      onGenerateTest={() => {}}
                    />
                  </div>
                </div>
              ) : (
                <QuestionsTable
                  questions={questions}
                  userAnswers={tableAnswers}
                  onSelect={handleSelectQuestion}
                  onGenerateTest={handleGenerateTest}
                  questionStats={userAnswers}
                />
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
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 sm:p-8 min-h-[calc(100vh-200px)] flex flex-col">
                <QuestionResolver
                  question={resolverQueue[resolverIndex]}
                  questionIndex={resolverIndex}
                  totalQuestions={resolverQueue.length}
                  existingAnswer={
                    userAnswers[String(resolverQueue[resolverIndex]?.id)]
                      ? {
                          isCorrect: userAnswers[String(resolverQueue[resolverIndex].id)].isCorrect,
                          answer:    userAnswers[String(resolverQueue[resolverIndex].id)].lastAnswer,
                          timestamp: userAnswers[String(resolverQueue[resolverIndex].id)].timestamp,
                        }
                      : undefined
                  }
                  questionStats={userAnswers[String(resolverQueue[resolverIndex]?.id)]}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  onBackToBank={() => setActiveTab("banco")}
                  isSaving={isSaving}
                />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
