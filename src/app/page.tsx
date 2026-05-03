"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  GraduationCap, 
  ArrowRight, 
  Clock, 
  BookOpen, 
  ChevronRight, 
  Trophy,
  User,
  X,
  KeyRound,
  Loader2,
  CheckCircle2,
  Trash2,
  RefreshCw
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { UserHeader } from "../components/UserHeader";
import { AuthModal } from "../components/AuthModal";
import { RankingModal } from "../components/RankingModal";
import { DialogOverlay, initDialog, showAlert, showConfirm } from "../components/Dialog";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const isAdmin = profile?.is_admin === true;
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rankingConfig, setRankingConfig] = useState<{ isOpen: boolean, id: string, title: string }>({
    isOpen: false,
    id: "",
    title: ""
  });
  const [filter, setFilter] = useState("Tudo");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminJson, setAdminJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [adminMetadata, setAdminMetadata] = useState({
    titulo: "",
    autor: "",
    ano: new Date().getFullYear().toString(),
    nivel: "PADRÃO",
    duracaoMinutos: "300"
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogState, setDialogState] = useState<any>({ open: false, type: 'info' });

  // Register the global dialog handler once
  useEffect(() => { initDialog(setDialogState); }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    fetchSimulados();
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
    } else if (error) {
      console.error("Erro ao carregar perfil:", error.message);
    }
  };

  const fetchSimulados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error("Erro ao carregar simulados:", error);
    setSimulados(data || []);
    setLoading(false);
  };

  const handleImportSimulado = async () => {
    try {
      setIsImporting(true);
      const data = JSON.parse(adminJson);
      
      console.log("Fazendo Upsert de novo registro");

      const { error } = await supabase.from('simulados').insert({
        id: `SIM-${Date.now()}`,
        titulo: adminMetadata.titulo || data.titulo || "Novo Simulado",
        duracao_minutos: parseInt(adminMetadata.duracaoMinutos) || data.duracaoMinutos || 300,
        data_json: {
          ...data,
          titulo: adminMetadata.titulo || data.titulo,
          autor: adminMetadata.autor || data.autor,
          ano: parseInt(adminMetadata.ano) || data.ano,
          nivel: adminMetadata.nivel || data.nivel,
          duracaoMinutos: parseInt(adminMetadata.duracaoMinutos) || data.duracaoMinutos
        },
        ano: parseInt(adminMetadata.ano) || data.ano || new Date().getFullYear(),
        autor: adminMetadata.autor || data.autor || "Elite Banker",
        nivel: (adminMetadata.nivel || data.nivel || "PADRÃO").toUpperCase()
      });

      if (error) {
        console.error("Erro Supabase:", error);
        throw error;
      }

      await showAlert("Simulado importado e sincronizado com o banco de dados.", "success", "Importação Concluída");
      setShowAdminModal(false);
      setAdminJson("");
      fetchSimulados();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      await showAlert("Erro ao importar: " + (err.message || "Verifique o console (F12)"), "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportSimulado = async () => {
    try {
      const data = JSON.parse(adminJson);
      const finalData = {
        ...data,
        titulo: adminMetadata.titulo || data.titulo,
        autor: adminMetadata.autor || data.autor,
        ano: parseInt(adminMetadata.ano) || data.ano,
        nivel: adminMetadata.nivel || data.nivel,
        duracaoMinutos: parseInt(adminMetadata.duracaoMinutos) || data.duracaoMinutos
      };

      const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (adminMetadata.titulo || 'simulado').replace(/[^a-z0-9]/gi, '_').toUpperCase();
      a.download = `GABARITO_SIMULADO_${cleanTitle}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      await showAlert("Certifique-se de que o JSON colado é válido antes de exportar.", "error", "Erro ao Exportar");
    }
  };

  const openAdmin = () => {
    setAdminJson("");
    setAdminMetadata({
      titulo: "",
      autor: "",
      ano: new Date().getFullYear().toString(),
      nivel: "PADRÃO",
      duracaoMinutos: "300"
    });
    setShowAdminModal(true);
  };

  const autoFillMetadata = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      setAdminMetadata({
        titulo: data.titulo || adminMetadata.titulo,
        autor: data.autor || adminMetadata.autor,
        ano: (data.ano || adminMetadata.ano).toString(),
        nivel: data.nivel || adminMetadata.nivel,
        duracaoMinutos: (data.duracaoMinutos || adminMetadata.duracaoMinutos).toString()
      });
    } catch (e) {}
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSimuladoClick = (id: string) => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      router.push(`/simulado?id=${id}`);
    }
  };

  const openRanking = (e: React.MouseEvent, sim: any) => {
    e.stopPropagation();
    setRankingConfig({
      isOpen: true,
      id: sim.id,
      title: sim.title
    });
  };

  const handleAuthSuccess = async (email: string, password?: string, mode?: 'password' | 'otp', isSignUp?: boolean) => {
    if (isSignUp) {
      return await supabase.auth.signUp({ 
        email, 
        password: password || "",
        options: {
          data: {
            display_name: email.split('@')[0]
          }
        }
      });
    }

    if (mode === 'otp') {
      return await supabase.auth.signInWithOtp({ email });
    } else {
      return await supabase.auth.signInWithPassword({ email, password: password || "" });
    }
  };

  const filteredSimulados = filter === "Tudo" ? simulados : simulados.filter(s => {
    return s.nivel === filter.toUpperCase();
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/20">
      <nav className="h-24 border-b border-white/[0.05] bg-[#020617]/80 backdrop-blur-md sticky top-0 z-50 px-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tighter leading-none">Elite <span className="text-blue-500">Banker.</span></h1>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Estação de Treinamento</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Refresh button */}
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchSimulados();
              setIsRefreshing(false);
            }}
            title="Atualizar lista"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-600 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button 
              onClick={openAdmin}
              className="px-6 py-2.5 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          {user ? (
            <UserHeader user={user} onLogout={handleLogout} />
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              Acessar Plataforma
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-16 px-12">
        {/* Cabeçalho de Seção Elite */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 relative">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-blue-500/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/60">Catálogo de Operações</span>
            </div>
            <h2 className="text-5xl font-light text-white tracking-tighter leading-none">
              Simulados <span className="font-black text-slate-700 italic">Disponíveis</span>
            </h2>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Selecione seu próximo protocolo de treinamento</p>
          </div>

          <div className="mt-8 md:mt-0 flex items-center gap-1.5 p-1.5 bg-[#0F172A]/40 border border-white/5 rounded-2xl backdrop-blur-xl">
            {["Tudo", "Básico", "Padrão", "Avançado"].map((lvl) => (
              <button 
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`relative px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                  filter === lvl 
                    ? 'text-white' 
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {filter === lvl && (
                  <motion.div 
                    layoutId="filter-bg"
                    className="absolute inset-0 bg-blue-600 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{lvl}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="flex flex-col items-center py-24 gap-6">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <div className="absolute inset-0 bg-blue-600/20 blur-xl animate-pulse" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 animate-pulse">Sincronizando Base de Dados...</p>
            </div>
          ) : filteredSimulados.length === 0 ? (
            <div className="text-center py-24 bg-white/[0.01] rounded-[40px] border-2 border-dashed border-white/[0.03]">
              <BookOpen className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
              <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.2em]">Nenhum protocolo detectado nesta categoria</p>
            </div>
          ) : (
            filteredSimulados.map((sim, i) => {
              const countQ = (obj: any): number => {
                if (!obj) return 0;
                if (Array.isArray(obj)) return obj.length;
                
                // Tenta disciplinas
                if (obj.disciplinas && Array.isArray(obj.disciplinas)) {
                  return obj.disciplinas.reduce((acc: number, d: any) => acc + (d.questoes?.length || 0), 0);
                }
                
                // Tenta questões direto
                if (obj.questoes && Array.isArray(obj.questoes)) {
                  return obj.questoes.length;
                }

                // Se tiver uma sub-chave data_json, mergulha nela
                if (obj.data_json) {
                  return countQ(obj.data_json);
                }

                return 0;
              };

              const qCount = countQ(sim.data_json);
              const level = (sim.nivel || "PADRÃO").toUpperCase();

              return (
                <motion.div 
                  key={sim.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => handleSimuladoClick(sim.id)}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 bg-[#0F172A]/30 border border-white/[0.03] rounded-[24px] hover:border-blue-500/20 hover:bg-[#0F172A]/60 transition-all duration-500 cursor-pointer overflow-hidden"
                >
                   {/* Overlay de Gradiente no Hover */}
                   <div className="absolute inset-0 bg-gradient-to-r from-blue-600/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                   <div className="flex items-center gap-6 relative z-10">
                      <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center border transition-all duration-500 group-hover:scale-105 ${
                        level === 'AVANÇADO' 
                          ? 'bg-purple-500/5 border-purple-500/10 text-purple-500/60 group-hover:text-purple-400 group-hover:border-purple-500/30' 
                          : 'bg-blue-500/5 border-blue-500/10 text-blue-500/60 group-hover:text-blue-400 group-hover:border-blue-500/30'
                      }`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors tracking-tight">
                            {sim.titulo}
                          </h3>
                          {sim.ano && (
                            <span className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded-lg text-[8px] text-slate-600 font-black tracking-widest uppercase">
                              {sim.ano}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-700 uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{qCount} Questões</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-700 uppercase tracking-widest">
                            <Clock className="w-3 h-3" />
                            <span>{Math.floor(sim.duracao_minutos / 60)}h {sim.duracao_minutos % 60}m</span>
                          </div>
                          {sim.autor && (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-500/30 uppercase tracking-widest">
                              <User className="w-3 h-3" />
                              <span>{sim.autor}</span>
                            </div>
                          )}
                        </div>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 mt-4 md:mt-0 relative z-10">
                      <button 
                        onClick={(e) => openRanking(e, sim)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-600 hover:text-yellow-500 hover:bg-yellow-500/5 hover:border-yellow-500/20 transition-all duration-300"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Ranking</span>
                      </button>
                      
                      <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-colors duration-300 ${
                        level === 'AVANÇADO' 
                          ? 'bg-purple-500/5 border-purple-500/10 text-purple-500/60' 
                          : level === 'BÁSICO' 
                            ? 'bg-blue-500/5 border-blue-500/10 text-blue-500/60' 
                            : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/60'
                      }`}>
                        {level}
                      </div>

                      {isAdmin && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await showConfirm(
                              `Essa ação é irreversível. O simulado "${sim.titulo}" será permanentemente removido da base de dados.`,
                              'Excluir Simulado?',
                              'Sim, excluir',
                              'Cancelar'
                            );
                            if (ok) {
                              const { error } = await supabase.from('simulados').delete().eq('id', sim.id);
                              if (!error) {
                                setSimulados(prev => prev.filter(s => s.id !== sim.id));
                              } else {
                                await showAlert('Erro ao excluir: ' + error.message, 'error');
                              }
                            }
                          }}
                          className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300"
                          title="Excluir Simulado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-500">
                        <ChevronRight className="w-4 h-4 text-slate-800 group-hover:text-white transition-all" />
                      </div>
                   </div>
                </motion.div>
              );
            })
          )}
        </div>
      </main>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onAuthSuccess={handleAuthSuccess}
      />

      <RankingModal 
        isOpen={rankingConfig.isOpen}
        onClose={() => setRankingConfig({ ...rankingConfig, isOpen: false })}
        simuladoId={rankingConfig.id}
        simuladoTitle={rankingConfig.title}
      />
  <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminModal(false)} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl"/>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-5xl bg-[#020617] border border-white/10 rounded-[40px] p-10 shadow-2xl flex flex-col max-h-[90vh]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Painel Administrativo</h3>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Gerenciamento e Exportação de Protocolos</p>
                </div>
                <button onClick={() => setShowAdminModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white transition-all"><X className="w-5 h-5"/></button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-y-auto pr-2 custom-scrollbar">
                {/* Coluna do JSON */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fonte de Dados (JSON)</label>
                      {adminJson && (
                        <span className="text-[9px] font-bold text-blue-400 uppercase mt-1">
                          {(() => {
                            try {
                              const data = JSON.parse(adminJson);
                              const root = data.data_json || data;
                              const q = root.questoes || (root.disciplinas?.flatMap((d: any) => d.questoes)) || (Array.isArray(root) ? root : []);
                              return `✓ ${q.length} questões detectadas`;
                            } catch (e) {
                              return "✗ JSON Inválido";
                            }
                          })()}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.readText().then(text => {
                          setAdminJson(text);
                          autoFillMetadata(text);
                        });
                      }}
                      className="text-[9px] font-black text-emerald-500 uppercase hover:text-emerald-400 transition-colors"
                    >
                      Colar do Clipboard
                    </button>
                  </div>
                  <textarea 
                    value={adminJson}
                    onChange={(e) => {
                      setAdminJson(e.target.value);
                      autoFillMetadata(e.target.value);
                    }}
                    placeholder='Cole o JSON aqui...'
                    className="w-full h-[400px] bg-white/[0.02] border border-white/10 rounded-[24px] p-6 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500/50 transition-all resize-none"
                  />
                </div>

                {/* Coluna dos Metadados */}
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Personalização do Simulado</label>
                  
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Nome do Simulado</span>
                      <input 
                        type="text"
                        value={adminMetadata.titulo}
                        onChange={(e) => setAdminMetadata({...adminMetadata, titulo: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                        placeholder="Ex: Simulado BB 2025 - Estratégia"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Autor / Instituição</span>
                        <input 
                          type="text"
                          value={adminMetadata.autor}
                          onChange={(e) => setAdminMetadata({...adminMetadata, autor: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                          placeholder="Ex: Estratégia Concursos"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Ano da Prova</span>
                        <input 
                          type="number"
                          value={adminMetadata.ano}
                          onChange={(e) => setAdminMetadata({...adminMetadata, ano: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Nível de Dificuldade</span>
                        <select 
                          value={adminMetadata.nivel}
                          onChange={(e) => setAdminMetadata({...adminMetadata, nivel: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all appearance-none"
                        >
                          <option value="BÁSICO">Básico</option>
                          <option value="PADRÃO">Padrão</option>
                          <option value="AVANÇADO">Avançado</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Duração (Minutos)</span>
                        <input 
                          type="number"
                          value={adminMetadata.duracaoMinutos}
                          onChange={(e) => setAdminMetadata({...adminMetadata, duracaoMinutos: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 space-y-4">
                    <button 
                      onClick={handleImportSimulado}
                      disabled={isImporting || !adminJson}
                      className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all disabled:opacity-20 flex items-center justify-center gap-3"
                    >
                      {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <> <CheckCircle2 className="w-4 h-4" /> Sincronizar com Banco de Dados </>}
                    </button>

                    <button 
                      onClick={handleExportSimulado}
                      disabled={!adminJson}
                      className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <ArrowRight className="w-4 h-4 rotate-90" /> Gerar e Baixar Arquivo JSON
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom dialog — replaces all native alert/confirm */}
      <DialogOverlay state={dialogState} />
    </div>
  );
}
