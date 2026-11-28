"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
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
  BookMarked,
  CheckCheck,
  LampDesk,
  RotateCw,
  SlidersHorizontal,
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";
import QuestionsTable, { BancoQuestion } from "../../components/banco/QuestionsTable";
import QuestionResolver from "../../components/banco/QuestionResolver";
import FixationDashboardView from "../../components/fixacao/FixationDashboardView";
import { PrintSimuladoModal } from "../../components/banco/PrintSimuladoModal";
import NotionQuestionTab from "../../components/banco/NotionQuestionTab";
import CadernosTab from "../../components/banco/CadernosTab";
import { ModalEditarQuestao } from "../../components/banco/ModalEditarQuestao";
import VerificadorIDsTab from "../../components/banco/VerificadorIDsTab";
import StudyCorner3DTab from "../../components/banco/StudyCorner3DTab";
import FlashcardsView from "../../components/flashcards/FlashcardsView";
import SimuladosTab from "../../components/banco/SimuladosTab";
import AdminManagerTab from "../../components/banco/AdminManagerTab";
import {
  DEFAULT_SIMULADOS_CONFIG,
  SIMULADOS_CONFIG_STORAGE_KEY,
  normalizeSimuladosConfig,
  type SimuladosConfig,
} from "../../lib/simuladosConfig";
import { normalizarQuestao, sortQuestoesByOrdem, isQuestaoAnulada } from "../../lib/questionService";
import { PWAInstallButton } from "../../components/PWAInstallButton";

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

type ActiveTab = "banco" | "resolver" | "simulados" | "fixacao" | "notion" | "flashcards" | "cadernos" | "verificador" | "admin";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

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
  const [activeTab, setActiveTab]   = useState<ActiveTab>("simulados");
  const [selectedQuestion, setSelectedQuestion] = useState<BancoQuestion | null>(null);
  const [resolverQueue, setResolverQueue] = useState<BancoQuestion[]>([]);
  const [resolverIndex, setResolverIndex] = useState(0);
  // Última lista filtrada pela tabela do Banco — usada como fila quando o usuário entra no resolver via filtro
  const [filteredQuestions, setFilteredQuestions] = useState<BancoQuestion[]>([]);
  const [isSaving, setIsSaving]     = useState(false);
  const [selectedSimulado, setSelectedSimulado] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BancoQuestion | null>(null);
  const [orgNodes, setOrgNodes]     = useState<any[]>([]);
  const [simuladosConfig, setSimuladosConfig] = useState<SimuladosConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(SIMULADOS_CONFIG_STORAGE_KEY);
        if (raw) return normalizeSimuladosConfig(JSON.parse(raw));
      } catch {
        // ignore storage errors
      }
    }
    return DEFAULT_SIMULADOS_CONFIG;
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/simulados-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const normalized = normalizeSimuladosConfig(data);
        setSimuladosConfig(normalized);
        try {
          window.localStorage.setItem(SIMULADOS_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // fallback to local/default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveSimuladosConfig = useCallback(async (next: SimuladosConfig) => {
    const normalized = normalizeSimuladosConfig(next);
    setSimuladosConfig(normalized);
    try {
      window.localStorage.setItem(SIMULADOS_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }
    try {
      await fetch("/api/simulados-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
    } catch (err) {
      console.error("Erro ao salvar configurações de simulados:", err);
    }
  }, []);

  const fetchOrgNodes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("organizacao_nos")
        .select("*")
        .order("ordem", { ascending: true });
      if (data) setOrgNodes(data);
    } catch (err) {
      console.error("Erro ao carregar nós de organização:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrgNodes();
  }, [fetchOrgNodes]);

  useEffect(() => {
    if (!user?.email) { setIsAdmin(false); return; }
    (async () => {
      try {
        const { data } = await supabase.from("notion_blocks_admins")
          .select("email")
          .ilike("email", user.email)
          .maybeSingle();
        setIsAdmin(!!data);
      } catch (e) {
        setIsAdmin(false);
      }
    })();
  }, [user?.email]);

  // ── Auth ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoadingUser(false);
      })
      .catch(() => {
        setUser(null);
        setLoadingUser(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch questions ───────────────────────
  const fetchQuestions = useCallback(async (silent = false) => {
    if (!silent) setLoadingQuestions(true);
    try {
      // Usa supabasePublic (sem JWT do usuário) para não ser bloqueado pela RLS
      const { data, error } = await supabasePublic
        .from("questoes")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;

      const normalized: BancoQuestion[] = (data || []).map(normalizarQuestao);
      const byId = new Map(normalized.map((q) => [String(q.id), q]));
      setQuestions(normalized);
      setResolverQueue((prev) =>
        prev.length === 0 ? normalized : prev.map((item) => byId.get(String(item.id)) ?? item)
      );
      setSelectedQuestion((prev) => (prev ? (byId.get(String(prev.id)) ?? prev) : null));
    } catch (err: any) {
      console.error("Erro ao carregar questões:", err.message);
    } finally {
      if (!silent) setLoadingQuestions(false);
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

  // ── Toggle dúvida (estritamente por usuário na tabela pública `duvidas`) ────
  const handleToggleDuvida = useCallback(async (questaoId: any) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const key = String(questaoId);
    const numId = Number(questaoId);
    const isMarked = duvidas.has(key);

    // Atualização otimista na interface do usuário
    setDuvidas(prev => {
      const next = new Set(prev);
      if (isMarked) next.delete(key); else next.add(key);
      return next;
    });

    try {
      if (isMarked) {
        // Remove da tabela `duvidas` do usuário logado
        let res = await supabase.from("duvidas").delete().eq("user_id", user.id).eq("questao_id", key);
        if (res.error && !isNaN(numId)) {
          await supabase.from("duvidas").delete().eq("user_id", user.id).eq("questao_id", numId);
        }
      } else {
        // Insere na tabela `duvidas` do usuário logado
        const payloadId = !isNaN(numId) ? numId : key;
        const res = await supabase.from("duvidas").insert({ user_id: user.id, questao_id: payloadId });
        if (res.error) {
          // Fallback se a coluna for do tipo text
          await supabase.from("duvidas").insert({ user_id: user.id, questao_id: key });
        }
      }
    } catch (err: any) {
      console.error("Erro ao salvar dúvida do usuário:", err.message);
      // Reverte em caso de erro
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
    setFilteredQuestions(prev => {
      if (
        prev.length === filtered.length &&
        prev[0]?.id === filtered[0]?.id &&
        prev[prev.length - 1]?.id === filtered[filtered.length - 1]?.id
      ) {
        return prev;
      }
      return filtered;
    });
    setResolverQueue(prev => {
      if (
        prev.length === filtered.length &&
        prev[0]?.id === filtered[0]?.id &&
        prev[prev.length - 1]?.id === filtered[filtered.length - 1]?.id
      ) {
        return prev;
      }
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
    const targetQ =
      questions.find((item) => String(item.id) === String(questionId)) ?? selectedQuestion;
    if (isQuestaoAnulada(targetQ)) return;
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

  const handleRefreshQuestionsSilent = useCallback(() => {
    void fetchQuestions(true);
  }, [fetchQuestions]);

  const handlePatchQuestionsLocal = useCallback(
    (updates: { id: string | number; patch: Partial<BancoQuestion> }[]) => {
      if (updates.length === 0) return;
      const patchMap = new Map<string, Partial<BancoQuestion>>();
      for (const item of updates) {
        patchMap.set(String(item.id), item.patch);
      }
      const applyPatch = (list: BancoQuestion[]) =>
        list.map((q) => {
          const p = patchMap.get(String(q.id));
          return p ? { ...q, ...p } : q;
        });

      setQuestions(applyPatch);
      setFilteredQuestions(applyPatch);
      setResolverQueue(applyPatch);
      setSelectedQuestion((prev) => {
        if (!prev) return null;
        const p = patchMap.get(String(prev.id));
        return p ? { ...prev, ...p } : prev;
      });
    },
    []
  );

  const handleRemoveQuestionsLocal = useCallback((ids: (string | number)[]) => {
    if (ids.length === 0) return;
    const removed = new Set(ids.map((id) => String(id)));
    const keep = (list: BancoQuestion[]) => list.filter((q) => !removed.has(String(q.id)));
    setQuestions(keep);
    setFilteredQuestions(keep);
    setResolverQueue(keep);
    setSelectedQuestion((prev) => (prev && removed.has(String(prev.id)) ? null : prev));
  }, []);

  const handleShowAuthModal = useCallback(() => setShowAuthModal(true), []);
  const handleEditQuestionFromChild = useCallback((q: BancoQuestion) => setEditingQuestion(q), []);

  const handleSelectQuestionForCadernos = useCallback(
    (q: BancoQuestion, queue: BancoQuestion[]) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      setResolverQueue(queue);
      const idx = queue.findIndex((x) => x.id === q.id);
      setResolverIndex(idx >= 0 ? idx : 0);
      setSelectedQuestion(q);
      setActiveTab("resolver");
    },
    [user]
  );

  const handleOpenResolverFromAdmin = useCallback(
    (q: BancoQuestion, queue: BancoQuestion[]) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      const qList = queue.length > 0 ? queue : [q];
      const idx = qList.findIndex((item) => item.id === q.id);
      setResolverQueue(qList);
      setResolverIndex(idx >= 0 ? idx : 0);
      setSelectedQuestion(q);
      setActiveTab("resolver");
    },
    [user]
  );

  const handleOpenSimuladoInLibrary = useCallback((key: string) => {
    setSelectedSimulado(key);
    setActiveTab("simulados");
  }, []);

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
    useMemo(
      () =>
        Object.fromEntries(
          Object.entries(userAnswers).map(([k, v]) => [
            k,
            { isCorrect: v.isCorrect, answer: v.lastAnswer, timestamp: v.timestamp },
          ])
        ),
      [userAnswers]
    );

  const provasDisponiveis = useMemo(
    () => Array.from(new Set(questions.map(q => q.prova).filter(Boolean))).sort() as string[],
    [questions]
  );

  const ADMIN_ONLY_TABS: ActiveTab[] = ["notion", "flashcards", "cadernos", "verificador", "admin"];
  const effectiveTab: ActiveTab =
    !isAdmin && ADMIN_ONLY_TABS.includes(activeTab) ? "simulados" : activeTab;

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#020617] text-slate-200 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 h-14 sm:h-16 border-b border-white/[0.05] bg-[#020617] px-2.5 sm:px-8 flex items-center justify-between gap-1.5 sm:gap-4 w-full">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="hidden xs:inline sm:hidden text-xs font-normal text-white tracking-tight truncate">
              Banco
            </span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-normal text-white tracking-tight leading-none">
                Banco <span className="text-blue-500">de Questões</span>
              </h1>
              <p className="text-[9px] font-normal text-slate-600 uppercase tracking-[0.2em] mt-0.5">
                Estação de Treinamento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Botão Baixar Aplicativo (PWA) */}
          <PWAInstallButton />

          {/* Botão de Destaque Imprimir Simulado na Topbar */}
          <button
            onClick={() => setShowGlobalPrintModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 min-h-[36px] py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-normal uppercase tracking-wider transition-colors shrink-0"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Imprimir Simulado</span>
            <span className="sm:hidden">PDF</span>
          </button>

          <button
            onClick={() => { fetchQuestions(); if (user) fetchUserAnswers(user.id); }}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-600 hover:text-blue-400 transition-colors shrink-0"
            title="Atualizar"
          >
            <RefreshCw size={13} className={loadingQuestions ? "animate-spin" : ""} />
          </button>

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 min-h-[36px] py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center shrink-0">
                <User size={10} className="text-blue-400" />
              </div>
              <span className="hidden sm:inline text-[11px] font-normal text-slate-300 max-w-[110px] truncate">{displayName}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 min-h-[36px] py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-normal uppercase tracking-widest transition-colors shrink-0"
            >
              <Lock size={11} /> Entrar
            </button>
          )}
        </div>
      </nav>

      {/* Sub-navbar / Tab Bar Sutil */}
      <div className="sticky top-14 sm:top-16 z-40 border-b border-white/[0.06] bg-[#020617] px-2.5 sm:px-8">
        <div className="flex items-center gap-1 sm:gap-1.5 w-full max-w-[1920px] mx-auto overflow-x-auto py-2 no-scrollbar">
          {[
            { id: "resolver",   icon: <Layers size={13} />,         label: "Questão Ativa", badge: selectedQuestion ? "●" : null },
            { id: "simulados",  icon: <ClipboardList size={13} />,  label: "Simulados", count: provasDisponiveis.length },
            ...(isAdmin ? [
              { id: "notion",      icon: <BookMarked size={13} />,  label: "Notion Question" },
              { id: "flashcards",  icon: <RotateCw size={13} />,    label: "Flashcards 3D" },
              { id: "cadernos",    icon: <Layers size={13} />,           label: "Cadernos" },
              { id: "verificador", icon: <CheckCheck size={13} />,       label: "Confrontar IDs" },
              { id: "admin",       icon: <SlidersHorizontal size={13} />, label: "Admin" },
            ] : []),
          ].map(tab => {
            const isSelected = effectiveTab === tab.id;
            const isDisabled = (tab.id === "resolver" && !selectedQuestion);

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isDisabled) return;
                  if (tab.id === "desempenho" && resolverQueue.length === 0) return;
                  if (!isAdmin && ADMIN_ONLY_TABS.includes(tab.id as ActiveTab)) return;
                  setActiveTab(tab.id as ActiveTab);
                }}
                disabled={isDisabled}
                className={`relative px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-[11px] font-normal flex items-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                  isSelected
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <span className={isSelected ? "text-blue-400" : "text-slate-500"}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-normal tabular-nums ${
                    isSelected ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.06] text-slate-400"
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[8px] text-blue-400">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <main className="w-full max-w-[1920px] min-w-0 mx-auto px-2.5 sm:px-8 py-3 sm:py-6 overflow-x-clip">
          {/* ── BANCO ── */}
          {effectiveTab === "banco" && (
            <div>
              {loadingQuestions || loadingUser ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">
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
                        className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors"
                      >
                        Entrar
                      </button>
                    </div>
                  )}
                  <QuestionsTable
                    questions={questions}
                    userAnswers={tableAnswers}
                    duvidas={duvidas}
                    onToggleDuvida={handleToggleDuvida}
                    onSelect={handleSelectQuestion}
                    onGenerateTest={handleGenerateTest}
                    onFilteredQuestionsChange={handleFilteredQuestionsChange}
                    isAdmin={isAdmin}
                    onRefresh={() => fetchQuestions(true)}
                    onEdit={(q) => setEditingQuestion(q)}
                  />
                </>
              )}
            </div>
          )}

          {/* ── RESOLVER ── */}
          {effectiveTab === "resolver" && selectedQuestion && (
            <div className="w-full max-w-[1750px] min-w-0 mx-auto px-0 sm:px-4">
              <div className="w-full min-w-0 flex flex-col">
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
                  onBackToBank={() => setActiveTab("simulados")}
                  isSaving={isSaving}
                  provasDisponiveis={provasDisponiveis}
                  isAdmin={isAdmin}
                  onEditQuestion={(q) => setEditingQuestion(q)}
                  onSelectProva={(provaName) => {
                    const newQueue = sortQuestoesByOrdem(questions.filter(q => q.prova === provaName));
                    if (newQueue.length > 0) {
                      setResolverQueue(newQueue);
                      setResolverIndex(0);
                      setSelectedQuestion(newQueue[0]);
                    }
                  }}
                />
              </div>
            </div>
          )}



          {/* ── SIMULADOS ── */}
          {effectiveTab === "simulados" && (
            <SimuladosTab
              questions={questions}
              userAnswers={userAnswers}
              selectedSimuladoKey={selectedSimulado}
              onSelectSimuladoKey={setSelectedSimulado}
              config={simuladosConfig}
              onStartSimulado={(orderedQuestions, startIdx) => {
                if (!user) { setShowAuthModal(true); return; }
                if (orderedQuestions.length === 0) return;
                const safeIdx = Math.max(0, Math.min(startIdx, orderedQuestions.length - 1));
                setResolverQueue(orderedQuestions);
                setResolverIndex(safeIdx);
                setSelectedQuestion(orderedQuestions[safeIdx]);
                setActiveTab("resolver");
              }}
              onOpenDesempenho={(orderedQuestions) => {
                if (orderedQuestions.length === 0) return;
                setResolverQueue(orderedQuestions);
                setResolverIndex(0);
                setSelectedQuestion(orderedQuestions[0]);
                setActiveTab("resolver");
              }}
            />
          )}

          {/* ── FIXAÇÃO (oculta) ── */}
          {effectiveTab === "fixacao" && (
            <div>
              <FixationDashboardView />
            </div>
          )}

          {/* ── NOTION QUESTION (ADMIN APENAS) ── */}
          {effectiveTab === "notion" && isAdmin && (
            <div>
              <NotionQuestionTab user={user} />
            </div>
          )}



          {/* ── FLASHCARDS 3D (ADMIN APENAS) ── */}
          {effectiveTab === "flashcards" && isAdmin && (
            <div className="w-full max-w-[1600px] mx-auto">
              <FlashcardsView />
            </div>
          )}

          {/* ── CADERNOS (ADMIN APENAS) ── */}
          {effectiveTab === "cadernos" && isAdmin && (
            <div>
              {loadingQuestions ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">
                    Carregando Cadernos...
                  </p>
                </div>
              ) : (
                <CadernosTab
                  questions={questions}
                  userAnswers={userAnswers}
                  duvidas={duvidas}
                  initialOrgNodes={orgNodes}
                  onOrgNodesChanged={setOrgNodes}
                  onSelectQuestion={handleSelectQuestionForCadernos}
                  onAnswer={handleAnswer}
                  onToggleDuvida={handleToggleDuvida}
                  user={user}
                  userId={user?.id}
                  onShowAuth={handleShowAuthModal}
                  onRefreshQuestions={handleRefreshQuestionsSilent}
                  onPatchQuestionsLocal={handlePatchQuestionsLocal}
                  onRemoveQuestionsLocal={handleRemoveQuestionsLocal}
                  isAdmin={isAdmin}
                />
              )}
            </div>
          )}

          {/* ── VERIFICADOR / CONFRONTAR IDS (ADMIN APENAS) ── */}
          {effectiveTab === "verificador" && isAdmin && (
            <div className="w-full max-w-6xl mx-auto">
              <VerificadorIDsTab
                questions={questions}
                isAdmin={isAdmin}
                onSelectQuestion={(q) => {
                  setSelectedQuestion(q);
                  setResolverQueue([q]);
                  setResolverIndex(0);
                  setActiveTab("resolver");
                }}
                onEditQuestion={handleEditQuestionFromChild}
                onRefreshQuestions={handleRefreshQuestionsSilent}
              />
            </div>
          )}

          {/* ── PAINEL ADMIN (ADMIN APENAS) ── */}
          {effectiveTab === "admin" && isAdmin && (
            <div className="w-full max-w-[1680px] mx-auto">
              <AdminManagerTab
                questions={questions}
                orgNodes={orgNodes}
                simuladosConfig={simuladosConfig}
                onSaveSimuladosConfig={handleSaveSimuladosConfig}
                onRefreshQuestions={handleRefreshQuestionsSilent}
                onPatchQuestionsLocal={handlePatchQuestionsLocal}
                onRemoveQuestionsLocal={handleRemoveQuestionsLocal}
                onEditQuestion={handleEditQuestionFromChild}
                onOpenResolver={handleOpenResolverFromAdmin}
                onOpenSimuladoInLibrary={handleOpenSimuladoInLibrary}
              />
            </div>
          )}
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

      {editingQuestion && (
        <ModalEditarQuestao
          isOpen={!!editingQuestion}
          onClose={() => setEditingQuestion(null)}
          questao={editingQuestion}
          orgNodes={orgNodes}
          onSuccess={(updated) => {
            setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setFilteredQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setResolverQueue((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setSelectedQuestion((prev) => (prev && prev.id === updated.id ? updated : prev));
            void fetchQuestions(true);
          }}
        />
      )}
    </div>
  );
}
