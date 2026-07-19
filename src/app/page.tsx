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
  RefreshCw,
  BarChart3,
  PieChart,
  Target,
  Flame,
  Laptop,
  Briefcase,
  Building2,
  Globe2,
  BookA,
  Calculator,
  DollarSign,
  Languages,
  Library,
  Brain,
  PenLine,
  Database
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { UserHeader } from "../components/UserHeader";
import { AuthModal } from "../components/AuthModal";
import { RankingModal } from "../components/RankingModal";
import { DialogOverlay, initDialog, showAlert, showConfirm } from "../components/Dialog";
import { LinuxMemorization } from "../components/LinuxMemorization";
import FlashcardDashboard from "../components/flashcards/FlashcardDashboard";
import StudyInterface from "../components/flashcards/StudyInterface";
import { fetchFlashcards, fetchSRSConfig } from "../services/notionService";
import { Flashcard, SRSConfig } from "../types/flashcards";

const ANALYSIS_DATA: Record<string, {
  subjects: { subject: string, q: number, p: number }[],
  attention: string,
  color: string
}> = {
  "Português": {
    color: "rose",
    subjects: [
      { subject: "Interpretação de Textos", q: 115, p: 24.06 },
      { subject: "Concordância (Verbal e Nominal)", q: 53, p: 11.09 },
      { subject: "Pontuação (Vírgula, etc.)", q: 41, p: 8.58 },
      { subject: "Crase", q: 33, p: 6.90 },
      { subject: "Coerência e Coesão", q: 28, p: 5.86 },
      { subject: "Reescrita de Frases", q: 24, p: 5.02 },
      { subject: "Colocação Pronominal", q: 18, p: 3.77 },
      { subject: "Sinônimos e Antônimos", q: 18, p: 3.77 },
      { subject: "Conjunção", q: 18, p: 3.77 },
      { subject: "Acentuação", q: 14, p: 2.93 },
    ],
    attention: "Interpretação e Concordância somam 35% da prova de Português."
  },
  "Matemática": {
    color: "amber",
    subjects: [
      { subject: "Porcentagem", q: 46, p: 20.00 },
      { subject: "Análise Combinatória", q: 15, p: 6.52 },
      { subject: "Equações de 1º Grau", q: 14, p: 6.09 },
      { subject: "Frações e Dízimas", q: 14, p: 6.09 },
      { subject: "Operações Básicas", q: 11, p: 4.78 },
      { subject: "Regra de Três Simples", q: 11, p: 4.78 },
      { subject: "Unidades de Medida", q: 10, p: 4.35 },
      { subject: "Progressão Aritmética (PA)", q: 9, p: 3.91 },
      { subject: "Operações com Decimais", q: 9, p: 3.91 },
      { subject: "Progressão Geométrica (PG)", q: 8, p: 3.48 },
    ],
    attention: "Porcentagem é o tema rei, caindo em praticamente todas as provas."
  },
  "Informática": {
    color: "blue",
    subjects: [
      { subject: "Windows 10", q: 18, p: 8.87 },
      { subject: "Protocolos de Redes", q: 12, p: 5.91 },
      { subject: "Mozilla Firefox", q: 11, p: 5.42 },
      { subject: "Linux / Unix", q: 10, p: 4.93 },
      { subject: "Ameaças (Vírus, Worms, Trojans)", q: 9, p: 4.43 },
      { subject: "Excel 2019", q: 9, p: 4.43 },
      { subject: "Segurança da Informação", q: 6, p: 2.96 },
      { subject: "Sistemas Operacionais", q: 6, p: 2.96 },
      { subject: "Conceitos de Internet", q: 6, p: 2.96 },
      { subject: "Word 2019 / 2013", q: 12, p: 5.92 },
      { subject: "Computação em Nuvem", q: 6, p: 2.96 },
    ],
    attention: "Windows 10 e Protocolos representam ~15% da prova. Foco total."
  },
  "Vendas": {
    color: "emerald",
    subjects: [
      { subject: "Marketing (4 P's, Digital, Relacionamento)", q: 40, p: 19.05 },
      { subject: "Técnicas de Vendas (Setor Bancário)", q: 26, p: 12.38 },
      { subject: "Gestão da Qualidade nos Serviços", q: 16, p: 7.62 },
      { subject: "Estratégia Empresarial", q: 13, p: 6.19 },
      { subject: "Satisfação e Retenção de Clientes", q: 12, p: 5.71 },
      { subject: "Etiqueta Empresarial", q: 6, p: 2.86 },
      { subject: "Resolução CMN nº 4.860/2020", q: 6, p: 2.86 },
      { subject: "Vendas Remotas e Telemarketing", q: 5, p: 2.38 },
      { subject: "Imaterialidade e Variabilidade", q: 5, p: 2.38 },
      { subject: "Igualdade e Não Discriminação", q: 5, p: 2.38 },
    ],
    attention: "Marketing e Técnicas de Vendas dominam mais de 30% do conteúdo."
  },
  "Bancários": {
    color: "orange",
    subjects: [
      { subject: "Mercado Cambial", q: 37, p: 11.53 },
      { subject: "Outros Serviços e Produtos Financeiros", q: 13, p: 4.05 },
      { subject: "BACEN (Banco Central)", q: 12, p: 3.74 },
      { subject: "Blockchain, Bitcoin e Criptomoedas", q: 12, p: 3.74 },
      { subject: "Bancos Comerciais", q: 11, p: 3.43 },
      { subject: "Operações de Crédito", q: 10, p: 3.12 },
      { subject: "Mercado Monetário", q: 10, p: 3.12 },
      { subject: "Fintechs, Startups e Big Techs", q: 10, p: 3.12 },
      { subject: "Bancos na Era Digital", q: 10, p: 3.12 },
      { subject: "CVM e Crédito Rural", q: 16, p: 4.98 },
    ],
    attention: "Mercado Cambial é disparado o tema mais frequente nesta disciplina."
  },
  "Atualidades": {
    color: "cyan",
    subjects: [
      { subject: "Blockchain, Bitcoin e Cripto", q: 12, p: 18.18 },
      { subject: "Fintechs, Startups e Big Techs", q: 10, p: 15.15 },
      { subject: "Bancos na Era Digital", q: 10, p: 15.15 },
      { subject: "PIX (Pagamentos Instantâneos)", q: 7, p: 10.61 },
      { subject: "Open Finance / Open Banking", q: 6, p: 9.09 },
      { subject: "Shadow Banking", q: 5, p: 7.58 },
      { subject: "Novos Modelos de Negócios", q: 5, p: 7.58 },
      { subject: "Segmentação e Interações Digitais", q: 3, p: 4.55 },
      { subject: "Transformação Digital", q: 2, p: 3.03 },
      { subject: "Arranjos de Pagamentos", q: 2, p: 3.03 },
    ],
    attention: "A Era Digital e Criptoativos dominam quase 50% das atualidades."
  },
  "Financeira": {
    color: "purple",
    subjects: [
      { subject: "Juros Compostos", q: 30, p: 28.85 },
      { subject: "Juros Simples", q: 15, p: 14.42 },
      { subject: "Sistema de Amortização Constante (SAC)", q: 11, p: 10.58 },
      { subject: "Taxas Efetivas e Nominais", q: 10, p: 9.62 },
      { subject: "Equivalência de Capitais", q: 8, p: 7.69 },
      { subject: "Sistema Francês (Price)", q: 8, p: 7.69 },
      { subject: "Inflação e Juros Reais", q: 3, p: 2.88 },
      { subject: "Série de Pagamentos (Valor Atual)", q: 3, p: 2.88 },
      { subject: "Conceitos Iniciais (Capital, Montante)", q: 3, p: 2.88 },
      { subject: "Desconto Racional Composto", q: 2, p: 1.92 },
    ],
    attention: "Juros Compostos e Simples sozinhos somam 43% da prova de exatas."
  },
  "Inglês": {
    color: "indigo",
    subjects: [
      { subject: "Interpretação de Textos", q: 60, p: 46.15 },
      { subject: "Substituição e Reescrita", q: 19, p: 14.62 },
      { subject: "Anáfora e Catáfora", q: 18, p: 13.85 },
      { subject: "Significado de Palavras", q: 18, p: 13.85 },
      { subject: "Conjunções e Conectivos", q: 8, p: 6.15 },
      { subject: "Advérbios (Adverbs)", q: 2, p: 1.54 },
      { subject: "Pronomes (Pronouns)", q: 2, p: 1.54 },
      { subject: "Verbos (Verbs)", q: 2, p: 1.54 },
      { subject: "Forma Condicional", q: 1, p: 0.77 },
      { subject: "Vocabulário Técnico", q: 1, p: 0.77 },
    ],
    attention: "Quase metade da prova de Inglês é pura interpretação de texto."
  }
};

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
  const [activeView, setActiveView] = useState<"simulados" | "analises" | "memorizacao" | "flashcards">("simulados");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [srsConfig, setSrsConfig] = useState<SRSConfig[]>([]);
  const [loadingFlashcards, setLoadingFlashcards] = useState(false);
  const [isFlashcardStudyMode, setIsFlashcardStudyMode] = useState(false);
  const [studyFlashcards, setStudyFlashcards] = useState<Flashcard[]>([]);
  const [activeSubject, setActiveSubject] = useState("Informática");
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
    loadFlashcards();
    return () => subscription.unsubscribe();
  }, []);

  const loadFlashcards = async () => {
    setLoadingFlashcards(true);
    const [cards, config] = await Promise.all([
      fetchFlashcards(),
      fetchSRSConfig()
    ]);
    setFlashcards(cards);
    setSrsConfig(config);
    setLoadingFlashcards(false);
  };

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
    try {
      const { data, error } = await supabase
        .from('simulados')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn("Aviso ao carregar simulados:", error?.message || error?.code || "Verifique a conexão com o banco de dados.");
      }
      setSimulados(data || []);
    } catch (err: any) {
      console.warn("Erro inesperado ao carregar simulados:", err?.message || err);
      setSimulados([]);
    } finally {
      setLoading(false);
    }
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
    // Pega a URL base (sem barras extras no final para não dar erro de match no Supabase)
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

    if (isSignUp) {
      return await supabase.auth.signUp({ 
        email, 
        password: password || "",
        options: {
          data: {
            display_name: email.split('@')[0]
          },
          emailRedirectTo: redirectTo
        }
      });
    }

    if (mode === 'otp') {
      return await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      });
    } else {
      return await supabase.auth.signInWithPassword({ email, password: password || "" });
    }
  };


  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/20">
      <nav className="h-20 sm:h-24 border-b border-white/[0.05] bg-[#020617]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <GraduationCap className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tighter leading-none">Elite <span className="text-blue-500">Banker.</span></h1>
            <p className="text-[10px] sm:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Estação de Treinamento</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Banco de Questões */}
          <button
            onClick={() => { window.location.href = '/banco'; }}
            title="Banco de Questões"
            className="px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-emerald-900/30 flex items-center gap-2 active:scale-95 cursor-pointer hidden sm:flex"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Banco</span>
          </button>

          {/* Anotações & Desenhos tab */}
          <button
            onClick={() => { window.location.href = '/draw'; }}
            title="Área de Anotações e Desenhos"
            className="px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-blue-900/30 flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Anotações</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchSimulados();
              setIsRefreshing(false);
            }}
            title="Atualizar lista"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-600 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button 
              onClick={openAdmin}
              className="px-4 sm:px-6 py-2.5 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 hidden sm:block" />
              Admin
            </button>
          )}
          {user ? (
            <UserHeader user={user} onLogout={handleLogout} />
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="px-4 sm:px-8 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              Acessar
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-6 sm:py-16 px-6 sm:px-12">

        <div>
              {/* Cabeçalho de Seção */}
              <div className="mb-10 sm:mb-14">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px w-8 bg-blue-500/50" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/60">Catálogo de Operações</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-light text-white tracking-tighter leading-none mb-3">
                  Simulados <span className="font-black text-slate-700 italic">Disponíveis</span>
                </h2>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Selecione seu próximo protocolo de treinamento</p>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                  <div className="col-span-full flex flex-col items-center py-24 gap-6">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                      <div className="absolute inset-0 bg-blue-600/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 animate-pulse">Sincronizando Base de Dados...</p>
                  </div>
                ) : simulados.length === 0 ? (
                  <div className="col-span-full text-center py-24 bg-white/[0.01] rounded-[40px] border-2 border-dashed border-white/[0.03]">
                    <BookOpen className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
                    <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.2em]">Nenhum protocolo detectado</p>
                  </div>
                ) : (
                  simulados.map((sim, i) => {
                    const countQ = (obj: any): number => {
                      if (!obj) return 0;
                      if (Array.isArray(obj)) return obj.length;
                      if (obj.disciplinas && Array.isArray(obj.disciplinas)) {
                        return obj.disciplinas.reduce((acc: number, d: any) => acc + (d.questoes?.length || 0), 0);
                      }
                      if (obj.questoes && Array.isArray(obj.questoes)) {
                        return obj.questoes.length;
                      }
                      if (obj.data_json) return countQ(obj.data_json);
                      return 0;
                    };

                    const qCount = countQ(sim.data_json);
                    const level = (sim.nivel || "PADRÃO").toUpperCase();
                    const levelColor = level === 'AVANÇADO'
                      ? { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', glow: 'group-hover:shadow-purple-500/10', icon: 'bg-purple-500/10 border-purple-500/15 text-purple-400/80' }
                      : level === 'BÁSICO'
                      ? { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', glow: 'group-hover:shadow-sky-500/10', icon: 'bg-sky-500/10 border-sky-500/15 text-sky-400/80' }
                      : { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/10', icon: 'bg-blue-500/10 border-blue-500/15 text-blue-400/80' };

                    return (
                      <motion.div
                        key={sim.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4 }}
                        onClick={() => handleSimuladoClick(sim.id)}
                        className={`group relative flex flex-col p-6 bg-[#0B1224] border rounded-[28px] hover:border-white/10 transition-all duration-500 cursor-pointer overflow-hidden shadow-xl ${levelColor.glow} hover:shadow-2xl ${levelColor.border} hover:bg-[#0D1528]`}
                      >
                        {/* Subtle top glow line */}
                        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent`} />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                        {/* Header row */}
                        <div className="flex items-start justify-between mb-5 relative z-10">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 ${levelColor.icon}`}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            {sim.ano && (
                              <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[9px] text-slate-600 font-black tracking-widest uppercase">
                                {sim.ano}
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${levelColor.bg} ${levelColor.border} ${levelColor.text}`}>
                              {level}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1 relative z-10 mb-5">
                          <h3 className="text-sm sm:text-[15px] font-bold text-slate-200 group-hover:text-white transition-colors tracking-tight leading-snug line-clamp-2">
                            {sim.titulo}
                          </h3>
                          {sim.autor && (
                            <p className="text-[10px] text-blue-500/40 font-bold uppercase tracking-wider mt-2 flex items-center gap-1.5">
                              <User className="w-3 h-3" />
                              {sim.autor}
                            </p>
                          )}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 relative z-10 mb-5 pt-4 border-t border-white/[0.04]">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500/50" />
                            <span>{qCount} Questões</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5 text-blue-500/50" />
                            <span>{Math.floor(sim.duracao_minutos / 60)}h {sim.duracao_minutos % 60}m</span>
                          </div>
                        </div>

                        {/* Action row */}
                        <div className="flex items-center gap-2 relative z-10">
                          <button
                            onClick={(e) => openRanking(e, sim)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-slate-600 hover:text-yellow-500 hover:bg-yellow-500/5 hover:border-yellow-500/20 transition-all duration-300 text-[10px] font-black uppercase tracking-widest"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            Ranking
                          </button>

                          {isAdmin && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await showConfirm(`Deseja excluir "${sim.titulo}"?`, 'Excluir?', 'Sim', 'Não');
                                if (ok) {
                                  const { error } = await supabase.from('simulados').delete().eq('id', sim.id);
                                  if (!error) setSimulados((prev: any) => prev.filter((s: any) => s.id !== sim.id));
                                }
                              }}
                              className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <div className="ml-auto w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-300">
                            <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
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
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowAdminModal(false)} 
            className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="relative w-full max-w-5xl bg-[#020617] border border-white/10 rounded-2xl sm:rounded-[40px] p-6 sm:p-10 shadow-2xl flex flex-col max-h-[90vh]"
          >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
              
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Painel Administrativo</h3>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Gerenciamento e Exportação de Protocolos</p>
                </div>
                <button onClick={() => setShowAdminModal(false)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white transition-all"><X className="w-5 h-5"/></button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 overflow-y-auto pr-2 custom-scrollbar">
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

      <AnimatePresence>
        {isFlashcardStudyMode && (
          <StudyInterface 
            cards={studyFlashcards}
            configLevels={srsConfig}
            onExit={() => {
              setIsFlashcardStudyMode(false);
              loadFlashcards(); // Refresh cards status
            }}
          />
        )}
      </AnimatePresence>

      {/* Custom dialog — replaces all native alert/confirm */}
      <DialogOverlay state={dialogState} />
    </div>
  );
}
