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
  Brain
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
  const [filter, setFilter] = useState("Tudo");
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

  const [simuladoSubject, setSimuladoSubject] = useState("Todos");

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

  const filteredSimulados = simulados.filter((s: any) => {
    const matchLevel = filter === "Tudo" || s.nivel === filter.toUpperCase();
    
    let matchSubject = true;
    if (simuladoSubject !== "Todos") {
      const normalize = (str: string) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      
      const titleUpper = normalize(s.titulo);
      const materiaUpper = normalize(s.materia);
      const subjectUpper = normalize(simuladoSubject);
      
      // Termos de busca equivalentes
      let searchTerms = [subjectUpper];
      if (subjectUpper === "PORTUGUESA") searchTerms.push("PORTUGUES");
      if (subjectUpper === "MATEMATICA FINANCEIRA") searchTerms.push("FINANCEIRA");
      if (subjectUpper === "CONHECIMENTOS BANCARIOS") searchTerms.push("BANCARIO");
      
      // Filtra ESTRITAMENTE pela coluna matéria do Supabase
      matchSubject = searchTerms.some(term => materiaUpper === term || materiaUpper.includes(term));
    }

    return matchLevel && matchSubject;
  });

  const SUBJECTS = [
    { name: "Todos", icon: <BookOpen className="w-4 h-4" />, color: "from-slate-600 to-slate-400" },
    { name: "Geral", icon: <Library className="w-4 h-4" />, color: "from-slate-500 to-slate-300" },
    { name: "Informática", icon: <Laptop className="w-4 h-4" />, color: "from-blue-600 to-cyan-400" },
    { name: "Vendas e Negociações", icon: <Briefcase className="w-4 h-4" />, color: "from-emerald-600 to-teal-400" },
    { name: "Conhecimentos Bancários", icon: <Building2 className="w-4 h-4" />, color: "from-orange-600 to-amber-400" },
    { name: "Atualidades", icon: <Globe2 className="w-4 h-4" />, color: "from-pink-600 to-rose-400" },
    { name: "Portuguesa", icon: <BookA className="w-4 h-4" />, color: "from-purple-600 to-fuchsia-400" },
    { name: "Matemática", icon: <Calculator className="w-4 h-4" />, color: "from-yellow-600 to-orange-400" },
    { name: "Matemática Financeira", icon: <DollarSign className="w-4 h-4" />, color: "from-green-600 to-emerald-400" },
    { name: "Inglês", icon: <Languages className="w-4 h-4" />, color: "from-indigo-600 to-blue-400" },
  ];

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
        {/* Main Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-[#0F172A]/40 border border-white/5 rounded-2xl mb-12 max-w-fit mx-auto sm:mx-0">
          <button 
            onClick={() => setActiveView("simulados")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "simulados" ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Simulados
          </button>
          <button 
            onClick={() => setActiveView("analises")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "analises" ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Análises
          </button>
          <button 
            onClick={() => setActiveView("memorizacao")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "memorizacao" ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Brain className="w-3.5 h-3.5" />
            Memorização
          </button>
          <button 
            onClick={() => setActiveView("flashcards")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "flashcards" ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Flame className="w-3.5 h-3.5" />
            Flashcards
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeView === "simulados" ? (
            <motion.div
              key="simulados-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Cabeçalho de Seção Elite */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 sm:mb-16 relative gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-px w-8 bg-blue-500/50" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/60">Catálogo de Operações</span>
                  </div>
                <h2 className="text-2xl sm:text-5xl font-light text-white tracking-tighter leading-none">
                    Simulados <span className="font-black text-slate-700 italic">Disponíveis</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Selecione seu próximo protocolo de treinamento</p>
                </div>

                <div className="flex flex-col gap-4 items-end">
                  <div className="flex items-center gap-2 p-1 bg-[#0F172A]/40 border border-white/5 rounded-2xl backdrop-blur-xl overflow-x-auto no-scrollbar max-w-full">
                    {["Tudo", "Básico", "Padrão", "Avançado"].map((lvl) => (
                      <button 
                        key={lvl}
                        onClick={() => setFilter(lvl)}
                        className={`relative px-5 sm:px-6 py-3 text-xs sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 shrink-0 ${
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
              </div>

              {/* Filtro de Matérias Premium */}
              <div className="mb-10 w-full">
                <div className="flex flex-wrap items-center gap-3 py-2">
                  {SUBJECTS.map((sub) => {
                    const isActive = simuladoSubject === sub.name;
                    return (
                      <button
                        key={sub.name}
                        onClick={() => setSimuladoSubject(sub.name)}
                        className={`relative group px-4 py-3 rounded-2xl border transition-all duration-300 flex items-center gap-3 overflow-hidden
                          ${isActive 
                            ? 'bg-white/[0.05] border-white/10 text-white shadow-xl' 
                            : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                          }
                        `}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-300 ${isActive ? 'opacity-20 ' + sub.color : 'opacity-0'}`} />
                        
                        <div className={`relative z-10 p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-gradient-to-br shadow-lg text-white scale-105 ' + sub.color : 'bg-white/5 text-slate-400 group-hover:scale-105 group-hover:text-white'}`}>
                          {sub.icon}
                        </div>
                        <span className="relative z-10 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap">
                          {sub.name}
                        </span>
                      </button>
                    );
                  })}
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

                    return (
                      <motion.div 
                        key={sim.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => handleSimuladoClick(sim.id)}
                        className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 bg-[#0F172A]/30 border border-white/[0.03] rounded-[24px] hover:border-blue-500/20 hover:bg-[#0F172A]/60 transition-all duration-500 cursor-pointer overflow-hidden"
                      >
                         <div className="absolute inset-0 bg-gradient-to-r from-blue-600/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 relative z-10 w-full">
                            <div className={`w-12 h-12 shrink-0 rounded-[18px] flex items-center justify-center border transition-all duration-500 group-hover:scale-105 ${
                              level === 'AVANÇADO' ? 'bg-purple-500/5 border-purple-500/10 text-purple-500/60' : 'bg-blue-500/5 border-blue-500/10 text-blue-500/60'
                            }`}>
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="text-sm sm:text-base font-semibold text-slate-200 group-hover:text-blue-400 transition-colors tracking-tight truncate">{sim.titulo}</h3>
                                {sim.ano && <span className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded-lg text-[8px] text-slate-600 font-black tracking-widest uppercase">{sim.ano}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500/50" /><span>{qCount} Questões</span></div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider"><Clock className="w-3.5 h-3.5 text-blue-500/50" /><span>{Math.floor(sim.duracao_minutos / 60)}h {sim.duracao_minutos % 60}m</span></div>
                                {sim.autor && <div className="flex items-center gap-2 text-xs font-bold text-blue-500/40 uppercase tracking-wider"><User className="w-3.5 h-3.5" /><span>{sim.autor}</span></div>}
                              </div>
                            </div>
                         </div>
                         <div className="flex flex-wrap items-center gap-3 mt-6 sm:mt-0 relative z-10 sm:justify-end w-full sm:w-auto">
                            <button onClick={(e) => openRanking(e, sim)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-600 hover:text-yellow-500 hover:bg-yellow-500/5 hover:border-yellow-500/20 transition-all duration-300"><Trophy className="w-3.5 h-3.5" /><span className="text-xs sm:text-[9px] font-black uppercase tracking-widest">Ranking</span></button>
                            <div className={`hidden xs:flex px-4 py-2.5 rounded-xl text-xs sm:text-[9px] font-black uppercase tracking-widest border ${level === 'AVANÇADO' ? 'bg-purple-500/5 border-purple-500/10 text-purple-500/60' : level === 'BÁSICO' ? 'bg-blue-500/5 border-blue-500/10 text-blue-500/60' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/60'}`}>{level}</div>
                            {isAdmin && (
                              <button onClick={async (e) => { e.stopPropagation(); const ok = await showConfirm(`Deseja excluir "${sim.titulo}"?`, 'Excluir?', 'Sim', 'Não'); if (ok) { const { error } = await supabase.from('simulados').delete().eq('id', sim.id); if (!error) setSimulados((prev: any) => prev.filter((s: any) => s.id !== sim.id)); } }} className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                            )}
                            <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all ml-auto sm:ml-0"><ChevronRight className="w-4 h-4 text-slate-800 group-hover:text-white" /></div>
                         </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          ) : activeView === "analises" ? (
            <motion.div
              key="analises-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              {/* ... (existing analises content) ... */}
              <div className="flex items-center justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3"><div className="h-px w-8 bg-orange-500/50" /><span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500/60">Inteligência Competitiva</span></div>
                  <h2 className="text-2xl sm:text-5xl font-light text-white tracking-tighter leading-none">Engenharia de <span className="font-black text-slate-700 italic">Dados</span></h2>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em]">O que realmente cai na sua prova (Top Assuntos)</p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                {Object.keys(ANALYSIS_DATA).map((subj) => {
                  const color = ANALYSIS_DATA[subj].color;
                  const isActive = activeSubject === subj;
                  const colorClasses: Record<string, string> = {
                    blue: isActive ? 'bg-blue-600 shadow-blue-900/20 text-white' : 'text-slate-500',
                    emerald: isActive ? 'bg-emerald-600 shadow-emerald-900/20 text-white' : 'text-slate-500',
                    purple: isActive ? 'bg-purple-600 shadow-purple-900/20 text-white' : 'text-slate-500',
                    orange: isActive ? 'bg-orange-600 shadow-orange-900/20 text-white' : 'text-slate-500',
                    rose: isActive ? 'bg-rose-600 shadow-rose-900/20 text-white' : 'text-slate-500',
                    amber: isActive ? 'bg-amber-600 shadow-amber-900/20 text-white' : 'text-slate-500',
                    cyan: isActive ? 'bg-cyan-600 shadow-cyan-900/20 text-white' : 'text-slate-500',
                    indigo: isActive ? 'bg-indigo-600 shadow-indigo-900/20 text-white' : 'text-slate-500',
                  };
                  return (
                    <button key={subj} onClick={() => setActiveSubject(subj)} className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg whitespace-nowrap border ${isActive ? 'border-transparent' : 'bg-white/[0.03] border-white/5 hover:bg-white/10'} ${colorClasses[color]}`}>
                      {subj === 'Vendas' ? 'Vendas' : subj === 'Financeira' ? 'Mat. Fin.' : subj}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {ANALYSIS_DATA[activeSubject].subjects.slice(0, 5).map((item, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="p-5 bg-[#0B1224]/60 border border-white/5 rounded-3xl group hover:border-white/20 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-white/5 text-slate-500'}`}>#{idx + 1}</div>
                          <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate max-w-[150px] sm:max-w-none">{item.subject}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-slate-400 group-hover:text-white transition-colors">{item.p}%</span>
                      </div>
                      <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(item.p / (ANALYSIS_DATA[activeSubject].subjects[0].p * 1.1)) * 100}%` }} transition={{ duration: 1, delay: 0.5 }} className={`absolute top-0 left-0 h-full rounded-full ${idx === 0 ? 'bg-yellow-500' : 'bg-blue-600'}`} />
                      </div>
                      <div className="mt-2"><span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">{item.q} Questões Mapeadas</span></div>
                    </motion.div>
                  ))}
                </div>
                <div className="space-y-4">
                  {ANALYSIS_DATA[activeSubject].subjects.slice(5, 10).map((item, idx) => (
                    <motion.div key={idx + 5} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (idx + 5) * 0.05 }} className="p-5 bg-[#0B1224]/40 border border-white/5 rounded-3xl group hover:border-slate-500/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-slate-500">#{idx + 6}</div>
                          <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors truncate max-w-[200px] sm:max-w-none">{item.subject}</span>
                        </div>
                        <span className="text-xs font-black text-slate-500">{item.p}%</span>
                      </div>
                      <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(item.p / (ANALYSIS_DATA[activeSubject].subjects[0].p * 1.1)) * 100}%` }} transition={{ duration: 1, delay: 0.5 }} className="absolute top-0 left-0 h-full bg-slate-700 rounded-full" />
                      </div>
                      <div className="mt-2"><span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">{item.q} Questões Mapeadas</span></div>
                    </motion.div>
                  ))}
                  
                  <div className={`p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-dashed flex flex-col items-center text-center gap-4 ${
                    activeSubject === 'Informática' ? 'bg-blue-600/5 border-blue-500/10' :
                    activeSubject === 'Vendas' ? 'bg-emerald-600/5 border-emerald-500/10' :
                    activeSubject === 'Financeira' ? 'bg-purple-600/5 border-purple-500/10' :
                    activeSubject === 'Bancários' ? 'bg-orange-600/5 border-orange-500/10' :
                    activeSubject === 'Português' ? 'bg-rose-600/5 border-rose-500/10' :
                    activeSubject === 'Matemática' ? 'bg-amber-600/5 border-amber-500/10' :
                    activeSubject === 'Atualidades' ? 'bg-cyan-600/5 border-cyan-500/10' :
                    'bg-indigo-600/5 border-indigo-500/10'
                  }`}>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-inner">
                      <Flame className={`w-6 h-6 animate-pulse ${
                        activeSubject === 'Informática' ? 'text-blue-500' :
                        activeSubject === 'Vendas' ? 'text-emerald-500' :
                        activeSubject === 'Financeira' ? 'text-purple-500' :
                        activeSubject === 'Bancários' ? 'text-orange-500' :
                        activeSubject === 'Português' ? 'text-rose-500' :
                        activeSubject === 'Matemática' ? 'text-amber-500' :
                        activeSubject === 'Atualidades' ? 'text-cyan-500' :
                        'text-indigo-500'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-[10px] sm:text-sm font-black text-white uppercase tracking-widest italic">Foco Recomendado</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-1 sm:mt-2 font-medium leading-relaxed">
                        {ANALYSIS_DATA[activeSubject].attention}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeView === "memorizacao" ? (
            <motion.div
              key="memorizacao-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <LinuxMemorization />
            </motion.div>
          ) : (
            <motion.div
              key="flashcards-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-10">
                <div className="h-px w-8 bg-blue-500/50" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/60">Sistema de Repetição Espaçada</span>
              </div>
              <FlashcardDashboard 
                flashcards={flashcards}
                configLevels={srsConfig}
                isLoading={loadingFlashcards}
                onStartStudy={(selectedCards) => {
                  setStudyFlashcards(selectedCards);
                  setIsFlashcardStudyMode(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
