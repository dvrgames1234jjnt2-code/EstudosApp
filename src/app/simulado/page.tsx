"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, GraduationCap, Clock, CheckCircle2, User, LogOut, Mail, KeyRound, Loader2, Lock, X, ShieldCheck, Timer, AlertCircle, Bookmark, ArrowLeft, History, Trophy, Target, Zap, Shield, Activity, Edit2, Check, Scissors, FileText } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import simuladoData from "../../data/simulado.json";
import { DialogOverlay, initDialog, showConfirm } from "../../components/Dialog";
import { Rascunho } from "../../components/Rascunho";
import { DrawOverlay } from "../../components/DrawOverlay";

// --- Components ---
const AlternativeItem = ({ id, text, isSelected, onClick, isStrikethrough, onToggleStrikethrough, showFeedback, isCorrectAnswer }: any) => {
  let feedbackStyle = "";
  let radioColor = "border-slate-700";
  
  if (showFeedback) {
    if (isCorrectAnswer) {
      feedbackStyle = "bg-emerald-500/5 border-emerald-500/20 text-emerald-400";
      radioColor = "border-emerald-500 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
    } else if (isSelected) {
      feedbackStyle = "bg-red-500/5 border-red-500/20 text-red-400";
      radioColor = "border-red-500 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
    }
  } else if (isSelected) {
    radioColor = "border-blue-500 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]";
  }

  return (
    <div className="flex items-start group transition-all duration-300">
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleStrikethrough(); }} 
        className={`mt-4 mr-1 w-8 h-8 flex items-center justify-center transition-all ${
          isStrikethrough ? 'opacity-100 text-red-500/50' : 'opacity-0 group-hover:opacity-40 text-slate-600 hover:text-red-500/50'
        }`}
        title="Eliminar alternativa"
        disabled={showFeedback}
      >
        <Scissors className="w-3 h-3 -rotate-45" />
      </button>

      <button 
        onClick={onClick} 
        disabled={showFeedback || isStrikethrough}
        className={`flex-1 flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${
          isSelected && !showFeedback ? 'bg-white/[0.03] border-white/10' : 
          feedbackStyle ? feedbackStyle : 'bg-transparent border-transparent hover:bg-white/[0.02]'
        } ${isStrikethrough ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${radioColor}`}>
          {(isSelected || (showFeedback && isCorrectAnswer)) && (
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </div>
        
        <span className={`text-[15px] font-normal leading-relaxed flex-1 transition-colors ${
          isSelected && !showFeedback ? 'text-white' : 
          showFeedback && isCorrectAnswer ? 'text-emerald-50' :
          'text-slate-400'
        } ${isStrikethrough ? 'line-through opacity-20' : ''}`}>
          {text}
          {showFeedback && isCorrectAnswer && (
            <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="ml-3 inline-flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Gabarito
            </motion.span>
          )}
        </span>
      </button>
    </div>
  );
};








function SimuladoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const simuladoId = searchParams.get('id') || "BB-2025-01";
  
  const [user, setUser] = useState<any>(null);
  const [simuladoDb, setSimuladoDb] = useState<any>(null);
  const [loadingSimulado, setLoadingSimulado] = useState(true);
  const [gameState, setGameState] = useState<'prep' | 'playing' | 'finished'>('prep');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [strikethroughs, setStrikethroughs] = useState<Record<string, boolean>>({});
  const [estudoMode, setEstudoMode] = useState(true);
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});
  const [showTextoApoio, setShowTextoApoio] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300 * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [showMobileGabarito, setShowMobileGabarito] = useState(false);

  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [authStep, setAuthStep] = useState<'input' | 'verify_otp' | 'success'>('input');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [dialogState, setDialogState] = useState<any>({ open: false, type: 'info' });

  useEffect(() => { initDialog(setDialogState); }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { display_name: authEmail.split('@')[0] },
            emailRedirectTo: redirectTo
          }
        });
        if (error) throw error;
        setAuthStep('success');
      } else if (authMode === 'otp') {
        const { error } = await supabase.auth.signInWithOtp({
          email: authEmail,
          options: { emailRedirectTo: redirectTo }
        });
        if (error) throw error;
        setAuthStep('success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setShowAuthModal(false);
        window.location.reload();
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro ao autenticar");
    } finally {
      setAuthLoading(false);
    }
  };
  
  const formatMarkdown = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const questoesProcessadas = useMemo(() => {
    // PRIORIDADE: Se for o simulado completo 2026, usa o arquivo local que atualizamos
    if (simuladoId === "simulado-completo-2026" || simuladoId === "BB-2025-01") {
      if (simuladoData && simuladoData.disciplinas) {
        return simuladoData.disciplinas.flatMap((disc: any) => 
          (disc.questoes || []).map((q: any) => ({ ...q, disciplina: disc.nome || "Geral" }))
        );
      }
    }

    if (!simuladoDb || !simuladoDb.data_json) return [];
    
    // Helper para extrair questões de uma estrutura de disciplinas
    const fromDisciplinas = (obj: any) => {
      if (obj?.disciplinas && Array.isArray(obj.disciplinas)) {
        return obj.disciplinas.flatMap((disc: any) => 
          (disc.questoes || []).map((q: any) => ({ ...q, disciplina: disc.nome || "Geral" }))
        );
      }
      return null;
    };

    // Helper para extrair questões de uma lista direta
    const fromDirect = (obj: any) => {
      if (obj?.questoes && Array.isArray(obj.questoes)) {
        return obj.questoes.map((q: any) => ({ ...q, disciplina: q.disciplina || "Geral" }));
      }
      return null;
    };

    // Tenta em diferentes níveis (para casos de JSON aninhado)
    const root = simuladoDb.data_json;
    
    // 1. Tenta no nível raiz do data_json
    let results = fromDisciplinas(root) || fromDirect(root);
    if (results && results.length > 0) return results;

    // 2. Tenta dentro de uma sub-chave data_json (caso comum de importação duplicada)
    if (root.data_json) {
      results = fromDisciplinas(root.data_json) || fromDirect(root.data_json);
      if (results && results.length > 0) return results;
    }

    // 3. Caso o objeto seja o array diretamente
    if (Array.isArray(root)) {
      return root.map((q: any) => ({ ...q, disciplina: q.disciplina || "Geral" }));
    }

    return [];
  }, [simuladoDb, simuladoId]);

  const tempoTotal = useMemo(() => {
    return (simuladoDb?.duracao_minutos || 300) * 60;
  }, [simuladoDb]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchHistory(session.user.id);
        setNewName(session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || "");
      }
    });

    const fetchSimulado = async () => {
      setLoadingSimulado(true);
      setSimuladoDb(null);
      try {
        const { data, error } = await supabase.from('simulados').select('*').eq('id', simuladoId).maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          setSimuladoDb(data);
          setTimeLeft(data.duracao_minutos * 60);
        } else {
          console.error("Simulado não encontrado:", simuladoId);
        }
      } catch (err: any) {
        console.error("Erro ao carregar simulado:", err.message);
      } finally {
        setLoadingSimulado(false);
      }
    };

    fetchSimulado();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchHistory(session.user.id);
        fetchActiveAttempt(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, [simuladoId]);

  const fetchActiveAttempt = async (userId: string) => {
    setLoadingAttempt(true);
    const { data } = await supabase
      .from('tentativas_ativas')
      .select('*')
      .eq('user_id', userId)
      .eq('simulado_id', simuladoId)
      .single();
    
    setActiveAttempt(data);
    setLoadingAttempt(false);
  };

  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && !isPaused) {
      if (timeLeft > 0) {
        timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      } else {
        handleFinish();
      }
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isPaused]);

  const fetchHistory = async (userId: string) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('resultados')
      .select('*')
      .eq('user_id', userId)
      .eq('simulado_id', simuladoId)
      .order('created_at', { ascending: false })
      .limit(5);
    setHistory(data ?? []);
    setLoadingHistory(false);
  };

  const saveProgress = async (currentAnswers = answers, currentT = timeLeft, currentQ = currentQuestion) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('tentativas_ativas').upsert({
        user_id: user.id,
        simulado_id: simuladoId,
        answers: currentAnswers,
        time_left: currentT,
        current_question: currentQ,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,simulado_id' });
      
      if (error) throw error;
      console.log("Progresso salvo com sucesso.");
    } catch (err: any) {
      console.error("Erro ao salvar progresso:", err.message);
      // Opcional: alert("Erro ao salvar progresso: " + err.message);
    }
  };

  const loadProgress = async () => {
    if (!user || !activeAttempt) return false;
    
    setAnswers(activeAttempt.answers || {});
    setTimeLeft(activeAttempt.time_left);
    setCurrentQuestion(activeAttempt.current_question || 0);
    setGameState('playing');
    return true;
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (!error) {
      setUser(data.user);
      setIsEditingName(false);
    }
    setSavingName(false);
  };

  const handleStart = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    // Se clicar em iniciar novo, limpa qualquer progresso anterior
    if (activeAttempt) {
      const ok = await showConfirm(
        'Você já possui um progresso salvo neste simulado. Iniciar novamente irá apagar o progresso anterior.',
        'Progresso Existente',
        'Iniciar Novo',
        'Continuar de onde parei'
      );
      if (ok) {
        await supabase.from('tentativas_ativas').delete().eq('user_id', user.id).eq('simulado_id', simuladoId);
        setActiveAttempt(null);
      } else {
        return;
      }
    }
    
    setGameState('playing');
  };

  // Salvar progresso a cada 30 segundos automaticamente
  useEffect(() => {
    let interval: any;
    if (gameState === 'playing' && !isPaused) {
      interval = setInterval(() => saveProgress(), 30000);
    }
    return () => clearInterval(interval);
  }, [gameState, isPaused, answers, timeLeft, currentQuestion]);

  const handleFinish = async () => {
    // Pesos Oficiais Banco do Brasil (Cesgranrio)
    const pesos: Record<string, number> = {
      "LÍNGUA PORTUGUESA": 1.5,
      "LÍNGUA INGLESA": 1.0,
      "MATEMÁTICA": 1.5,
      "ATUALIDADES DO MERCADO FINANCEIRO": 1.0,
      "MATEMÁTICA FINANCEIRA": 1.5,
      "CONHECIMENTOS BANCÁRIOS": 1.5,
      "CONHECIMENTOS DE INFORMÁTICA": 1.5,
      "VENDAS E NEGOCIAÇÃO": 1.5,
      "INFORMÁTICA": 1.5
    };

    let totalPoints = 0;
    let absoluteScore = 0;

    questoesProcessadas.forEach((q: any, idx: number) => {
      if (answers[idx] === q.respostaCorreta) {
        absoluteScore += 1;
        const weight = pesos[q.disciplina.toUpperCase()] || 1.5;
        totalPoints += weight;
      }
    });

    if (user) {
      await supabase.from('resultados').insert({
        user_id: user.id,
        user_name: user.user_metadata?.display_name || user.email?.split('@')[0] || "Anônimo",
        simulado_id: simuladoId,
        points: totalPoints,
        score: absoluteScore,
        total_questions: questoesProcessadas.length,
        answers: answers
      });

      // Limpar tentativa ativa
      await supabase.from('tentativas_ativas').delete().eq('user_id', user.id).eq('simulado_id', simuladoId);
    }
    setGameState('finished');
  };

  const renderPrep = () => {
    const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Candidato');

    return (
      <div className="min-h-screen bg-[#020617] relative overflow-hidden selection:bg-blue-500/30">
        {/* Elementos de Fundo */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto py-8 lg:py-12 px-4 sm:px-8 relative z-10">
          {/* Barra Superior */}
          <div className="flex items-center justify-between mb-20">
            <button onClick={() => router.push('/')} className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Início
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                {simuladoDb?.autor || 'Operação Oficial'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            {/* Conteúdo Esquerdo: Título da Missão */}
            <div className="lg:col-span-7 space-y-12">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px w-8 bg-blue-500/50" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/60">Protocolo {simuladoDb?.ano || '2024'}</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-light text-white tracking-tighter leading-[1.1] max-w-2xl">
                  {(simuladoDb?.titulo || simuladoDb?.title || 'Simulado').split(' - ')[0]} <br />
                  <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                    {(simuladoDb?.titulo || simuladoDb?.title || 'Banco do Brasil').split(' - ')[1] || ''}
                  </span>
                </h2>
                {questoesProcessadas.length === 0 ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-widest">Atenção: Este simulado não possui questões configuradas ou o formato do arquivo é inválido.</p>
                  </div>
                ) : (
                  <p className="max-w-md text-slate-500 text-sm leading-relaxed font-medium">
                    Você está prestes a iniciar um protocolo de simulação de alta intensidade. 
                    Mantenha o foco, gerencie seu tempo e execute com precisão.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                {activeAttempt ? (
                  <>
                    <button 
                      onClick={loadProgress} 
                      className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-blue-500 hover:shadow-[0_20px_40px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                      <Timer className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Retomar Simulado
                    </button>
                    <button 
                      onClick={handleStart} 
                      className="w-full sm:w-auto px-10 py-5 bg-white/[0.03] border border-white/5 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                      Reiniciar do Zero
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleStart} 
                    disabled={questoesProcessadas.length === 0}
                    className="w-full sm:w-auto px-12 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-blue-500 hover:shadow-[0_20px_40px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group disabled:opacity-20 disabled:pointer-events-none"
                  >
                    Iniciar Simulado <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/[0.03]">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-700" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Ambiente Seguro</span>
                    </div>
                    <p className="text-[10px] text-slate-700 font-medium uppercase tracking-tight">Criptografia end-to-end ativa</p>
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-slate-700" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Feedback Real-time</span>
                    </div>
                    <p className="text-[10px] text-slate-700 font-medium uppercase tracking-tight">Análise granular de desempenho</p>
                 </div>
              </div>
            </div>

            {/* Conteúdo Direito: Card de Identificação */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
              
              <div className="relative p-10 bg-[#0F172A]/40 border border-white/[0.05] backdrop-blur-2xl rounded-[40px] shadow-2xl space-y-10">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">Identificação do Candidato</p>
                    <div className="flex items-center gap-4 group">
                      {isEditingName ? (
                        <div className="flex items-center gap-2 w-full">
                          <input autoFocus value={newName} onChange={(e)=>setNewName(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && handleUpdateName()} className="bg-transparent border-b border-blue-500/50 text-white outline-none text-xl font-bold py-1 w-full" placeholder="Seu nome..." />
                          <button onClick={handleUpdateName} disabled={savingName} className="p-2 bg-blue-600 rounded-xl text-white">
                            {savingName ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-2xl font-bold text-slate-200 tracking-tight capitalize">{displayName}</h4>
                          <button onClick={()=>setIsEditingName(true)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-blue-500 transition-all"><Edit2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Sessão Autenticada</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-2xl border border-white/5 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t border-white/[0.05]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <History className="w-3.5 h-3.5" /> Últimos Resultados
                    </p>
                    {history.length > 0 && <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{history.length} Registros</span>}
                  </div>

                  <div className="space-y-3">
                    {loadingHistory ? (
                      <div className="flex items-center gap-3 py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Acessando Arquivos...</span>
                      </div>
                    ) : history.length > 0 ? (
                      history.map((h, i) => (
                        <div key={i} className="group flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.05] hover:border-white/[0.05] transition-all cursor-default">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter group-hover:text-slate-400 transition-colors">TENTATIVA {history.length - i}</span>
                            <span className="text-[9px] text-slate-800 font-bold uppercase tracking-widest">Consolidada</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="h-8 w-px bg-white/[0.05]" />
                            <div className="text-right">
                              <span className="text-base font-bold text-blue-400/80 tracking-tighter">{h.points.toFixed(1)}</span>
                              <span className="text-[9px] font-black text-slate-700 ml-1.5 uppercase">PTS</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed border-white/[0.02] rounded-[32px]">
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Nenhum histórico detectado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card */}
                <div className="pt-6 text-center">
                   <p className="text-[8px] font-black text-slate-800 uppercase tracking-[0.3em]">Protocolo Elite Banker v2.4.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPlaying = () => {
    const q = questoesProcessadas[currentQuestion];
    const totalQuestions = questoesProcessadas.length;
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;

    if (!q) return null;

    return (
      <div className="min-h-screen bg-[#020617] flex flex-col">
        <header className="h-20 border-b border-white/[0.05] bg-[#020617]/80 backdrop-blur-md sticky top-0 z-[60] px-4 sm:px-8 flex items-center justify-between gap-4">
           <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Progresso</span>
                <span className="text-xs sm:text-sm font-bold text-white tracking-tighter">{currentQuestion + 1} de {totalQuestions}</span>
              </div>
              <div className="flex-1 max-w-[200px] h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-blue-600 to-indigo-600" />
              </div>
           </div>
           
           <div className="flex items-center gap-3 sm:gap-8">
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest hidden sm:flex items-center gap-2"><Timer className="w-3 h-3" /> Cronômetro</span>
                <span className={`text-base sm:text-xl font-mono font-bold tracking-tighter ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                  {Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m {timeLeft % 60}s
                </span>
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                <button 
                  onClick={() => setEstudoMode(!estudoMode)}
                  className={`px-3 sm:px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                    estudoMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                  }`}
                  title={estudoMode ? "Modo Estudo Ativado" : "Modo Simulado Ativado"}
                >
                  <Zap className={`w-3.5 h-3.5 ${estudoMode ? 'fill-amber-500' : ''}`} />
                  <span className="hidden md:inline">{estudoMode ? 'Modo Estudo' : 'Modo Simulado'}</span>
                </button>
                <button 
                  onClick={async () => {
                    const ok = await showConfirm(
                      "Deseja realmente sair? Seu progresso será salvo para que você possa continuar de onde parou.",
                      "Sair do Simulado",
                      "Sair e Salvar",
                      "Continuar"
                    );
                    if (ok) {
                      await saveProgress();
                      router.push('/');
                    }
                  }}
                  className="px-3 sm:px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 transition-all border border-red-500/20 flex items-center justify-center"
                >
                  <span className="hidden xs:inline">Cancelar</span>
                  <LogOut className="w-4 h-4 xs:hidden" />
                </button>
                <button 
                  onClick={() => setShowMobileGabarito(!showMobileGabarito)} 
                  className={`lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all border ${
                    showMobileGabarito ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                  title="Gabarito"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button onClick={() => {
                  setIsPaused(true);
                  saveProgress();
                }} className="w-9 h-9 sm:w-10 sm:h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/5" title="Pausar"><Lock className="w-4 h-4" /></button>
                <button onClick={handleFinish} className="px-3 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center min-w-[70px]">
                  <span className="hidden xs:inline">Finalizar</span>
                  <span className="xs:hidden">Fim</span>
                </button>
              </div>
           </div>
        </header>

        <AnimatePresence>
          {isPaused && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#020617]/90 backdrop-blur-md flex items-center justify-center p-6">
              <div className="max-w-sm w-full text-center space-y-8">
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-600/20">
                  <Lock className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Simulado Pausado</h3>
                  <p className="text-slate-500 text-sm">O tempo foi congelado. Respire fundo e volte quando estiver pronto.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => setIsPaused(false)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all">Continuar Simulado</button>
                  <button onClick={async () => {
                    await saveProgress();
                    router.push('/');
                  }} className="w-full py-5 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-[0.3em] text-xs hover:bg-white/10 hover:text-white transition-all">Salvar e Sair</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex overflow-hidden relative">
           <div className="flex-1 overflow-y-auto p-6 pb-48 sm:p-16 bg-white/[0.01] custom-scrollbar">
              <div className="max-w-3xl mx-auto relative">

                <div className="flex items-center gap-3 mb-10">
                  <span className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.2em]">{q.disciplina}</span>
                </div>

                {q.texto_apoio && (
                  <div className="mb-8">
                    <button 
                      onClick={() => setShowTextoApoio(!showTextoApoio)}
                      className="flex items-center gap-2 mb-4 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600/20 transition-all"
                    >
                      {showTextoApoio ? (
                        <><X className="w-3 h-3" /> Ocultar Texto de Apoio</>
                      ) : (
                        <><FileText className="w-3 h-3" /> Mostrar Texto de Apoio</>
                      )}
                    </button>

                    <AnimatePresence>
                      {showTextoApoio && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 sm:p-10 bg-white/[0.02] border-l-4 border-blue-600/30 rounded-r-[32px] space-y-6 relative group mb-4">
                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                              <FileText className="w-24 h-24" />
                            </div>
                            <div className="space-y-4">
                              {q.texto_apoio.split('\n\n').map((part: string, idx: number) => (
                                <p key={idx} className="text-sm sm:text-base leading-relaxed text-slate-400 italic font-medium selection:bg-blue-500/30" dangerouslySetInnerHTML={{ __html: formatMarkdown(part) }} />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                 <div className="flex gap-6 items-start mb-12">
                   <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-sm font-bold text-slate-400">
                     {currentQuestion + 1}
                   </div>
                   <div className="space-y-4 pt-2">
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Questão {currentQuestion + 1}</span>
                     <div className="space-y-6">
                        {(() => {
                          const parts = (q.texto || q.enunciado || "").split('\n\n');
                          return parts.map((part: any, idx: any) => {
                            return (
                              <p 
                                key={idx} 
                                className="text-[16px] leading-[1.7] font-normal text-slate-300 selection:bg-blue-500/30"
                                dangerouslySetInnerHTML={{ __html: part }}
                              />
                            );
                          });
                        })()}
                     </div>
                   </div>
                 </div>

                <div className="space-y-1">
                    {Object.entries(q.alternativas).map(([id, text]: any) => {
                      const isSelected = answers[currentQuestion] === id;
                      const isCut = strikethroughs[`${currentQuestion}-${id}`];

                      return (
                        <AlternativeItem 
                           key={id} id={id} text={text} 
                           isSelected={isSelected} 
                           showFeedback={estudoMode && showFeedback[currentQuestion]}
                           isCorrectAnswer={q.respostaCorreta === id}
                           onClick={() => {
                             if (isCut) return; // Não deixa marcar se estiver riscada
                             if (isSelected) {
                               // Desmarcar
                               const newAnswers = {...answers};
                               delete newAnswers[currentQuestion];
                               setAnswers(newAnswers);
                             } else {
                               // Marcar
                               const newAnswers = {...answers, [currentQuestion]: id};
                               setAnswers(newAnswers);
                             }
                           }}
                           isStrikethrough={isCut}
                           onToggleStrikethrough={() => {
                             const newStatus = !isCut;
                             setStrikethroughs({...strikethroughs, [`${currentQuestion}-${id}`]: newStatus});
                             // Se estiver riscando e for a selecionada, desmarca
                             if (newStatus && isSelected) {
                               const newAnswers = {...answers};
                               delete newAnswers[currentQuestion];
                               setAnswers(newAnswers);
                             }
                           }}
                        />
                      );
                    })}
                 </div>

                 <AnimatePresence>
                   {estudoMode && answers[currentQuestion] && !showFeedback[currentQuestion] && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: 10 }}
                       className="mt-8 flex justify-center"
                     >
                       <button 
                         onClick={() => {
                           setShowFeedback({...showFeedback, [currentQuestion]: true});
                           saveProgress(answers);
                         }}
                         className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_20px_40px_rgba(16,185,129,0.2)] active:scale-95 transition-all flex items-center gap-2"
                       >
                         <CheckCircle2 className="w-4 h-4" /> Confirmar Resposta
                       </button>
                     </motion.div>
                   )}
                 </AnimatePresence>

                <DrawOverlay questionKey={currentQuestion} />
                <div className="flex flex-col sm:flex-row items-center justify-between mt-20 pt-10 border-t border-white/[0.05] gap-8 sm:gap-0">
                    <button disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(curr => curr - 1)} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white/[0.02] sm:bg-transparent border border-white/5 sm:border-0 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white disabled:opacity-0 transition-all active:scale-95"><ArrowLeft className="w-4 h-4" /> Anterior</button>
                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] order-first sm:order-none">Questão {currentQuestion + 1} de {totalQuestions}</div>
                    <button disabled={currentQuestion === totalQuestions - 1} onClick={() => setCurrentQuestion(curr => curr + 1)} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 sm:bg-transparent sm:text-blue-500 border border-blue-600/20 sm:border-0 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all active:scale-95">Próxima <ChevronRight className="w-4 h-4" /></button>
                 </div>
              </div>
           </div>

           <div className={`
              fixed lg:relative inset-y-0 right-0 w-80 sm:w-96 border-l border-white/5 p-6 sm:p-8 bg-[#020617] overflow-y-auto custom-scrollbar transition-transform duration-300 z-50
              ${showMobileGabarito ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Folha de Respostas
                </h3>
                <button onClick={() => setShowMobileGabarito(false)} className="lg:hidden p-2 text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-10">
                {Array.from(new Set(questoesProcessadas.map((q: any) => q.disciplina))).map((disciplina: any) => {
                  const discQuestions = questoesProcessadas.filter((q: any) => q.disciplina === disciplina);
                  const firstIdx = questoesProcessadas.findIndex((qp: any) => qp === discQuestions[0]);
                  return (
                  <div key={disciplina} className="space-y-4">
                    <button 
                       onClick={() => setCurrentQuestion(firstIdx)}
                       className="w-full flex items-center gap-3 group/disc"
                    >
                      <div className="h-px flex-1 bg-white/[0.03] group-hover/disc:bg-blue-500/30 transition-all" />
                      <span className="text-[9px] font-black text-slate-700 group-hover/disc:text-blue-500 uppercase tracking-[0.2em] transition-all">{disciplina}</span>
                      <div className="h-px flex-1 bg-white/[0.03] group-hover/disc:bg-blue-500/30 transition-all" />
                    </button>
                    
                    <div className="space-y-2">
                      {discQuestions.map((q: any) => {
                        const idx = questoesProcessadas.findIndex((qp: any) => qp === q);
                        return (
                          <div key={idx} className={`flex items-center justify-between p-2 rounded-xl transition-all ${currentQuestion === idx ? 'bg-blue-600/5 ring-1 ring-blue-500/20' : 'hover:bg-white/[0.02]'}`}>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setCurrentQuestion(idx)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${currentQuestion === idx ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                              >
                                {idx + 1}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 sm:gap-1.5">
                              {['A', 'B', 'C', 'D', 'E'].map((alt) => {
                                const isSelected = answers[idx] === alt;
                                const isCorrect = questoesProcessadas[idx].respostaCorreta === alt;
                                const showSidebarFeedback = estudoMode && showFeedback[idx];

                                let buttonStyle = "bg-white/5 border-white/5 text-slate-700 hover:border-slate-600 hover:text-slate-400";
                                if (isSelected) {
                                  if (showSidebarFeedback) {
                                    buttonStyle = isCorrect 
                                      ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                                      : "bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20";
                                  } else {
                                    buttonStyle = "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20";
                                  }
                                } else if (showSidebarFeedback && isCorrect) {
                                  buttonStyle = "border-emerald-600/50 text-emerald-500/70";
                                }

                                return (
                                  <button
                                    key={alt}
                                    onClick={() => {
                                      const newAnswers = {...answers, [idx]: alt};
                                      setAnswers(newAnswers);
                                      saveProgress(newAnswers);
                                    }}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black border transition-all ${buttonStyle}`}
                                  >
                                    {alt}
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

        </div>
      </div>
    );
  };

  const renderFinished = () => {
    // Pesos Oficiais Banco do Brasil (Cesgranrio)
    const pesos: Record<string, number> = {
      "LÍNGUA PORTUGUESA": 1.5,
      "LÍNGUA INGLESA": 1.0,
      "MATEMÁTICA": 1.5,
      "ATUALIDADES DO MERCADO FINANCEIRO": 1.0,
      "MATEMÁTICA FINANCEIRA": 1.5,
      "CONHECIMENTOS BANCÁRIOS": 1.5,
      "CONHECIMENTOS DE INFORMÁTICA": 1.5,
      "VENDAS E NEGOCIAÇÃO": 1.5,
      "INFORMÁTICA": 1.5
    };

    const stats = Array.from(new Set(questoesProcessadas.map((q: any) => q.disciplina))).map((disciplina: any) => {
      const qMat = questoesProcessadas.filter((q: any) => q.disciplina === disciplina);
      const indices = qMat.map((q: any) => questoesProcessadas.findIndex((qp: any) => qp === q));
      const correct = indices.filter((idx: any) => answers[idx] === questoesProcessadas[idx].respostaCorreta).length;
      return {
        disciplina,
        total: qMat.length,
        acertos: correct,
        percent: (correct / qMat.length) * 100,
        peso: pesos[disciplina.toUpperCase()] || 1.5
      };
    });

    const totalAcertos = stats.reduce((acc: number, s: any) => acc + s.acertos, 0);
    const pontuacaoTotal = stats.reduce((acc: number, s: any) => acc + (s.acertos * s.peso), 0);
    const pontuacaoMaxima = stats.reduce((acc: number, s: any) => acc + (s.total * s.peso), 0);
    const aproveitamentoGeral = (pontuacaoTotal / pontuacaoMaxima) * 100;

    return (
      <div className="min-h-screen bg-[#020617] py-10 px-6 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-[#0F172A] rounded-[32px] p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
          
          {/* Header Performance */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              {aproveitamentoGeral >= 70 ? 'Bom Desempenho! No caminho certo.' : 'Continue focado!'}
            </h2>
            <p className="text-slate-500 text-xs mb-6 opacity-80">
              {aproveitamentoGeral < 70 && 'Cada erro é uma aprendizagem.'}
            </p>
            
            <div className="relative w-36 h-36 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90">
                <circle cx="72" cy="72" r="66" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle cx="72" cy="72" r="66" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-500" strokeDasharray={414.69} strokeDashoffset={414.69 - (414.69 * aproveitamentoGeral / 100)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-white tracking-tighter">{totalAcertos}</span>
                <span className="text-slate-500 text-[9px] uppercase font-black tracking-widest text-center leading-none mt-1">de {questoesProcessadas.length}</span>
              </div>
            </div>
          </div>

          {/* Tabela de Disciplinas Compacta */}
          <div className="bg-[#020617]/40 rounded-2xl p-5 border border-white/5">
            <div className="grid grid-cols-12 gap-2 mb-4 px-3 text-[8px] font-black text-slate-600 uppercase tracking-widest">
              <div className="col-span-7 text-left">Disciplina</div>
              <div className="col-span-3 text-center">Acertos</div>
              <div className="col-span-2 text-right">%</div>
            </div>

            <div className="space-y-0.5">
              {stats.map((s: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-white/[0.02] transition-all border-b border-white/[0.02] last:border-0">
                  <div className="col-span-7 text-[13px] font-medium text-slate-400 leading-tight truncate">{s.disciplina}</div>
                  <div className="col-span-3 text-center text-sm font-mono font-bold text-slate-300">{s.acertos} / {s.total}</div>
                  <div className={`col-span-2 text-right text-[13px] font-black ${s.percent >= 70 ? 'text-green-500' : s.percent >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {Math.round(s.percent)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Pontuação Final Ponderada Impactante */}
            <div className="mt-5 pt-5 border-t border-white/10 flex justify-between items-end px-3">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Nota Final</span>
                <span className="text-[10px] text-slate-500">Pesos oficiais</span>
              </div>
              <div className="text-4xl font-black text-blue-500 tracking-tighter">
                {pontuacaoTotal.toFixed(1)} <span className="text-slate-800 text-sm">/ {pontuacaoMaxima.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button onClick={() => setShowReview(!showReview)} className={`flex-1 py-4 border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${showReview ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              {showReview ? 'Fechar Revisão' : 'Revisar Desempenho'}
            </button>
            <button onClick={() => window.location.reload()} className="flex-1 py-4 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Refazer</button>
            <button onClick={() => router.push('/')} className="flex-1 py-4 bg-white/5 text-white border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Sair</button>
          </div>

          <AnimatePresence>
            {showReview && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-8 space-y-6 pt-8 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Análise de Questões</h3>
                  <div className="flex p-1 bg-[#020617]/60 rounded-xl border border-white/5">
                    <button onClick={() => setReviewFilter('all')} className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${reviewFilter === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-600'}`}>Todas</button>
                    <button onClick={() => setReviewFilter('wrong')} className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${reviewFilter === 'wrong' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-slate-600'}`}>Erros</button>
                  </div>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {questoesProcessadas.map((q: any, idx: number) => {
                    const isCorrect = answers[idx] === q.respostaCorreta;
                    if (reviewFilter === 'wrong' && isCorrect) return null;

                    return (
                      <div key={idx} className={`p-6 rounded-[24px] border transition-all ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Questão {idx + 1} • {q.disciplina}</span>
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed mb-6">{q.texto}</p>
                        <div className="space-y-3">
                          {Object.entries(q.alternativas).map(([letter, text]: any) => {
                            const isUserChoice = answers[idx] === letter;
                            const isCorrectAnswer = q.respostaCorreta === letter;
                            
                            let style = "bg-white/[0.02] border-white/5 text-slate-500";
                            if (isCorrectAnswer) style = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold";
                            if (isUserChoice && !isCorrectAnswer) style = "bg-red-500/10 border-red-500/20 text-red-400 font-bold";

                            return (
                              <div key={letter} className={`p-4 rounded-xl border text-[13px] flex gap-3 transition-all ${style}`}>
                                <span className="font-black opacity-50">{letter})</span>
                                <span>{text as string}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };


  if (loadingSimulado) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mb-8 border border-blue-600/20 animate-pulse">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tighter">Sincronizando Simulado</h2>
        <p className="text-slate-500 text-sm max-w-xs">Preparando questões e critérios de avaliação do Banco do Brasil...</p>
      </div>
    );
  }

  if (!simuladoDb) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 border border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tighter">Simulado Não Encontrado</h2>
        <p className="text-slate-500 text-sm mb-8 max-w-xs">Este conteúdo pode ter sido removido ou o link está incorreto.</p>
        <button onClick={() => router.push('/')} className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/10 transition-all">Voltar para Início</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/20">
      {gameState === 'prep' && renderPrep()}
      {gameState === 'playing' && renderPlaying()}
      {gameState === 'finished' && renderFinished()}

      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAuthModal(false)} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl"/>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-[#020617] border border-white/10 rounded-[32px] p-10 shadow-2xl flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              <button onClick={() => {setShowAuthModal(false); setAuthStep('input');}} className="absolute right-6 top-6 text-slate-600 hover:text-white"><X className="w-5 h-5"/></button>
              
              <AnimatePresence mode="wait">
                {authStep === 'success' ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20"><Mail className="w-8 h-8 text-emerald-500" /></div>
                    <h3 className="text-xl font-bold text-white mb-2">Verifique seu E-mail</h3>
                    <p className="text-xs text-slate-400 mb-8 leading-relaxed">Enviamos um link para:<br/><span className="text-blue-400 font-bold">{authEmail}</span></p>
                    <button onClick={() => setShowAuthModal(false)} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Entendi</button>
                  </motion.div>
                ) : (
                  <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="text-center mb-8">
                      <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-600/20"><Lock className="w-5 h-5 text-blue-500" /></div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{isSignUp ? 'Nova Identidade' : 'Acesso Restrito'}</h3>
                    </div>
                    <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-xl mb-6">
                      <button onClick={() => {setAuthMode('password'); setAuthStep('input');}} className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${authMode==='password' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Senha</button>
                      <button onClick={() => {setAuthMode('otp'); setAuthStep('input'); setIsSignUp(false);}} className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${authMode==='otp' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Código</button>
                    </div>
                    {authError && <p className="text-[10px] text-red-500 font-bold mb-4 text-center">{authError}</p>}
                    <form onSubmit={handleAuth} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-700 uppercase tracking-widest ml-1">E-mail</label>
                        <input type="email" placeholder="nome@exemplo.com" required value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-3.5 px-4 text-sm outline-none focus:border-blue-600/50 transition-all"/>
                      </div>
                      {authMode === 'password' || isSignUp ? (
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-700 uppercase tracking-widest ml-1">Senha</label>
                          <input type="password" placeholder="••••••••" required value={authPassword} onChange={(e)=>setAuthPassword(e.target.value)} className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-3.5 px-4 text-sm outline-none focus:border-blue-600/50 transition-all"/>
                        </div>
                      ) : null}
                      <button type="submit" disabled={authLoading} className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-xl shadow-blue-900/30 active:scale-[0.98] flex items-center justify-center">
                        {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'Finalizar Cadastro' : 'Entrar Agora')}
                      </button>
                      {authMode === 'password' && (
                        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-[8px] font-black text-slate-600 uppercase tracking-widest mt-4 hover:text-slate-400 transition-colors">
                          {isSignUp ? 'Já tenho uma conta' : 'Criar nova conta'}
                        </button>
                      )}
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom dialog — replaces all native alert/confirm */}
      <DialogOverlay state={dialogState} />

      {/* Rascunho — floating tldraw pad */}
      {gameState === 'playing' && <Rascunho />}
    </div>
  );
}
export default function SimuladoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    }>
      <SimuladoContent />
    </Suspense>
  );
}
