"use me";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Play, Pause, Square, RotateCcw, Flame, Clock, Coffee, 
  CheckCircle2, AlertCircle, BarChart2, Calendar, BookOpen, 
  Trash2, ShieldCheck, Zap, Tag, Timer, Award, ChevronRight
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface SestudosRow {
  id: string;
  user_id: string;
  materia: string;
  topico: string | null;
  modo: string;
  duracao_minutos: number;
  tempo_pausa_minutos: number;
  eficiencia_pct: number;
  data: string;
  created_at: string;
}

export default function CronometroTab({ 
  user,
  materiasDisponiveis = []
}: { 
  user: any;
  materiasDisponiveis?: string[];
}) {
  // ── Modos & Estados do Cronômetro ──
  const [modo, setModo] = useState<"livre" | "pomodoro">("livre");
  const [status, setStatus] = useState<"parado" | "rodando" | "pausado">("parado");
  const [fasePomodoro, setFasePomodoro] = useState<"foco" | "pausa">("foco");

  // Pomodoro config (em minutos)
  const [pomoFocoMin, setPomoFocoMin] = useState(25);
  const [pomoPausaMin, setPomoPausaMin] = useState(5);
  const [ciclosPomo, setCiclosPomo] = useState(0);

  // Timers em segundos
  const [tempoFocoSec, setTempoFocoSec] = useState(0);
  const [tempoPausaSec, setTempoPausaSec] = useState(0);

  // Formulário da sessão
  const [materia, setMateria] = useState("");
  const [topico, setTopico] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState("");

  // Dados do banco (Histórico & Stats)
  const [sessoes, setSessoes] = useState<SestudosRow[]>([]);
  const [carregandoSessoes, setCarregandoSessoes] = useState(true);

  // Interval Ref
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Buscar Histórico de Sessões do Supabase ──
  const fetchSessoes = useCallback(async () => {
    if (!user?.id) return;
    setCarregandoSessoes(true);
    try {
      const { data, error } = await supabase
        .from("notion_estudo_sessoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        // Se a tabela ainda não existir no banco do usuário
        console.warn("Tabela notion_estudo_sessoes ainda não criada ou erro:", error.message);
        setSessoes([]);
      } else {
        setSessoes(data ?? []);
      }
    } catch (e: any) {
      console.error("Erro ao buscar sessões:", e.message);
    } finally {
      setCarregandoSessoes(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSessoes();
  }, [fetchSessoes]);

  // ── Efeito do Intervalo Principal do Cronômetro ──
  useEffect(() => {
    if (status === "parado") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (status === "rodando") {
        if (modo === "livre") {
          setTempoFocoSec(prev => prev + 1);
        } else {
          // Pomodoro Countdown
          setTempoFocoSec(prev => {
            if (prev <= 1) {
              // Alternar fase no pomodoro
              if (fasePomodoro === "foco") {
                setCiclosPomo(c => c + 1);
                setFasePomodoro("pausa");
                // Som de alerta leve se o navegador permitir
                try { new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3").play().catch(() => {}); } catch {}
                return pomoPausaMin * 60;
              } else {
                setFasePomodoro("foco");
                try { new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3").play().catch(() => {}); } catch {}
                return pomoFocoMin * 60;
              }
            }
            return prev - 1;
          });
        }
      } else if (status === "pausado") {
        // Quando está pausado, conta o tempo de pausa acumulado
        setTempoPausaSec(prev => prev + 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, modo, fasePomodoro, pomoFocoMin, pomoPausaMin]);

  // Controles do Cronômetro
  const handleIniciar = () => {
    if (!materia.trim()) {
      setMensagemStatus("Selecione ou digite a matéria antes de iniciar!");
      setTimeout(() => setMensagemStatus(""), 4000);
      return;
    }
    if (status === "parado") {
      if (modo === "pomodoro") {
        setTempoFocoSec(pomoFocoMin * 60);
        setFasePomodoro("foco");
      } else {
        setTempoFocoSec(0);
      }
      setTempoPausaSec(0);
    }
    setStatus("rodando");
  };

  const handlePausar = () => {
    setStatus("pausado");
  };

  const handleRetomar = () => {
    setStatus("rodando");
  };

  const handleResetar = () => {
    if (status !== "parado" && !confirm("Deseja resetar o cronômetro sem salvar a sessão?")) return;
    setStatus("parado");
    setTempoFocoSec(modo === "pomodoro" ? pomoFocoMin * 60 : 0);
    setTempoPausaSec(0);
    setFasePomodoro("foco");
  };

  const handleFinalizarESalvar = async () => {
    if (!user?.id) return;
    const duracaoMinutos = Math.max(1, Math.round(tempoFocoSec / 60));
    const pausaMinutos = Math.round(tempoPausaSec / 60);
    const tempoTotalMinutos = duracaoMinutos + pausaMinutos;
    const eficiencia = tempoTotalMinutos > 0 ? Math.min(100, Math.round((duracaoMinutos / tempoTotalMinutos) * 100)) : 100;

    setSalvando(true);
    try {
      const { error } = await supabase.from("notion_estudo_sessoes").insert({
        user_id: user.id,
        materia: materia.trim() || "Geral",
        topico: topico.trim() || null,
        modo: modo === "pomodoro" ? `Pomodoro (${pomoFocoMin}/${pomoPausaMin})` : "Livre",
        duracao_minutos: duracaoMinutos,
        tempo_pausa_minutos: pausaMinutos,
        eficiencia_pct: eficiencia,
        data: new Date().toISOString().slice(0, 10),
      });

      if (error) throw error;

      setMensagemStatus("Sessão salva com sucesso! 🎉");
      setTimeout(() => setMensagemStatus(""), 4000);
      
      // Resetar cronômetro
      setStatus("parado");
      setTempoFocoSec(0);
      setTempoPausaSec(0);
      setTopico("");

      await fetchSessoes();
    } catch (e: any) {
      console.error("Erro ao salvar sessão:", e.message);
      alert("Erro ao salvar no banco: " + e.message + "\nCertifique-se de executar o script SQL no Supabase!");
    } finally {
      setSalvando(false);
    }
  };

  const handleDeleteSessao = async (id: string) => {
    if (!confirm("Remover esta sessão do histórico?")) return;
    await supabase.from("notion_estudo_sessoes").delete().eq("id", id);
    await fetchSessoes();
  };

  // ── Formatação de Tempo ──
  const formatSeconds = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ── Métricas e Estatísticas ──
  const hojeIso = new Date().toISOString().slice(0, 10);
  const sessoesHoje = useMemo(() => sessoes.filter(s => s.data === hojeIso), [sessoes, hojeIso]);

  const minutosFocoHoje = useMemo(() => sessoesHoje.reduce((acc, s) => acc + s.duracao_minutos, 0), [sessoesHoje]);
  const minutosPausaHoje = useMemo(() => sessoesHoje.reduce((acc, s) => acc + s.tempo_pausa_minutos, 0), [sessoesHoje]);
  const eficienciaMediaHoje = useMemo(() => {
    if (sessoesHoje.length === 0) return 100;
    return Math.round(sessoesHoje.reduce((acc, s) => acc + s.eficiencia_pct, 0) / sessoesHoje.length);
  }, [sessoesHoje]);

  // Cálculo de Streak (Dias seguidos de estudo)
  const streakDias = useMemo(() => {
    if (sessoes.length === 0) return 0;
    const datasUnicas = [...new Set(sessoes.map(s => s.data))].sort((a, b) => b.localeCompare(a));
    
    let streak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < datasUnicas.length; i++) {
      const d = new Date(datasUnicas[i] + "T00:00:00");
      const diffTime = Math.abs(today.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (i === 0 && diffDays > 1) {
        // Se a última sessão foi há mais de 1 dia, quebrou o streak
        break;
      }
      streak++;
    }
    return streak;
  }, [sessoes]);

  // Distribuição por Matéria
  const porMateriaStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessoes) {
      map.set(s.materia, (map.get(s.materia) || 0) + s.duracao_minutos);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessoes]);

  return (
    <div className="flex flex-col gap-6 bg-[#0b0f19]/90 rounded-[2rem] border border-white/[0.05] p-5 sm:p-8">
      {/* ── CABEÇALHO ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-600/10">
            <Timer size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white leading-none">Cronômetro & Tracker de Estudos</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 uppercase tracking-widest">
                <ShieldCheck size={10} /> Restrito Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Acompanhamento contínuo de foco, pausas, sessões e streaks.</p>
          </div>
        </div>

        {/* Chaveador de Modo */}
        <div className="flex items-center gap-1.5 p-1 bg-[#111623] border border-white/[0.07] rounded-xl">
          <button
            onClick={() => { setModo("livre"); setStatus("parado"); setTempoFocoSec(0); setTempoPausaSec(0); }}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              modo === "livre" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Clock size={12} /> Modo Livre
          </button>
          <button
            onClick={() => { setModo("pomodoro"); setStatus("parado"); setTempoFocoSec(pomoFocoMin * 60); setTempoPausaSec(0); }}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              modo === "pomodoro" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Timer size={12} /> Pomodoro
          </button>
        </div>
      </div>

      {/* ── PAINEL DE ESTATÍSTICAS / METRIC CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-[#111623] border border-white/[0.06] relative overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Flame size={12} className="text-amber-400" /> Streak Atual
          </span>
          <span className="text-xl font-black text-white tabular-nums flex items-baseline gap-1">
            {streakDias} <span className="text-[11px] font-medium text-slate-500">dias</span>
          </span>
          <span className="text-[9px] text-slate-600">Dias seguidos de estudo</span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-[#111623] border border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Zap size={12} className="text-emerald-400" /> Foco Hoje
          </span>
          <span className="text-xl font-black text-emerald-400 tabular-nums">
            {Math.floor(minutosFocoHoje / 60)}h {minutosFocoHoje % 60}m
          </span>
          <span className="text-[9px] text-slate-600">{sessoesHoje.length} sessão(ões) concluída(s)</span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-[#111623] border border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Coffee size={12} className="text-amber-400" /> Pausas Hoje
          </span>
          <span className="text-xl font-black text-amber-300 tabular-nums">
            {minutosPausaHoje}m
          </span>
          <span className="text-[9px] text-slate-600">Tempo descansado</span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-[#111623] border border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <BarChart2 size={12} className="text-indigo-400" /> Rendimento
          </span>
          <span className="text-xl font-black text-indigo-300 tabular-nums">
            {eficienciaMediaHoje}%
          </span>
          <span className="text-[9px] text-slate-600">Foco / Tempo Total</span>
        </div>
      </div>

      {/* ── ÁREA PRINCIPAL DO CRONÔMETRO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DISPLAY DO CRONÔMETRO (Col-span 2) */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-8 bg-[#111623] border border-white/[0.07] rounded-3xl relative overflow-hidden text-center gap-6">
          {/* Status Indicator Pill */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-all ${
              status === "rodando" 
                ? modo === "pomodoro" && fasePomodoro === "pausa"
                  ? "bg-amber-950/40 border border-amber-500/30 text-amber-300"
                  : "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                : status === "pausado"
                ? "bg-amber-950/40 border border-amber-500/30 text-amber-300"
                : "bg-white/[0.04] border border-white/[0.07] text-slate-500"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === "rodando" 
                  ? modo === "pomodoro" && fasePomodoro === "pausa" ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse" 
                  : status === "pausado" ? "bg-amber-400" : "bg-slate-600"
              }`} />
              {status === "parado" && "Pronto para iniciar"}
              {status === "rodando" && (modo === "pomodoro" && fasePomodoro === "pausa" ? "Pausa (Descansando)" : "Em Foco (Estudando)")}
              {status === "pausado" && "Em Pausa (Contando tempo de descanso)"}
            </span>

            {modo === "pomodoro" && (
              <span className="text-[10px] font-bold text-slate-400 bg-white/[0.04] border border-white/[0.07] px-2.5 py-1 rounded-full">
                Ciclo #{ciclosPomo + 1}
              </span>
            )}
          </div>

          {/* MOSTRADOR DE TEMPO GIGANTE */}
          <div className="flex flex-col items-center">
            <h1 className="text-6xl sm:text-7xl font-black text-white font-mono tracking-tight tabular-nums select-none drop-shadow-md">
              {formatSeconds(tempoFocoSec)}
            </h1>
            
            {/* Sub-mostrador de Pausa */}
            <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-amber-400/90">
                <Coffee size={12} /> Pausa: {formatSeconds(tempoPausaSec)}
              </span>
              <span>•</span>
              <span className="text-slate-500">
                Bruto: {formatSeconds(tempoFocoSec + tempoPausaSec)}
              </span>
            </div>
          </div>

          {/* Configuração Rápida de Pomodoro (se estiver parado e no modo pomodoro) */}
          {modo === "pomodoro" && status === "parado" && (
            <div className="flex items-center gap-2 p-1.5 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[11px]">
              <span className="text-slate-500 font-medium px-2">Presets:</span>
              {[
                { foco: 25, pausa: 5, label: "25/5 min" },
                { foco: 50, pausa: 10, label: "50/10 min" },
                { foco: 60, pausa: 15, label: "60/15 min" }
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    setPomoFocoMin(p.foco);
                    setPomoPausaMin(p.pausa);
                    setTempoFocoSec(p.foco * 60);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    pomoFocoMin === p.foco
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* BOTÕES DE AÇÃO DO CRONÔMETRO */}
          <div className="flex items-center gap-3 flex-wrap justify-center mt-2">
            {status === "parado" && (
              <button
                onClick={handleIniciar}
                className="flex items-center gap-2 px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                <Play size={14} className="fill-white" /> Iniciar Estudo
              </button>
            )}

            {status === "rodando" && (
              <button
                onClick={handlePausar}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-600/20"
              >
                <Pause size={14} className="fill-white" /> Pausar
              </button>
            )}

            {status === "pausado" && (
              <button
                onClick={handleRetomar}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                <Play size={14} className="fill-white" /> Retomar
              </button>
            )}

            {status !== "parado" && (
              <button
                onClick={handleFinalizarESalvar}
                disabled={salvando}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Salvar Sessão
              </button>
            )}

            <button
              onClick={handleResetar}
              title="Resetar tempo"
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:border-white/[0.15] transition-all"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {mensagemStatus && (
            <p className="text-[11px] font-bold text-amber-400 animate-pulse mt-1">{mensagemStatus}</p>
          )}
        </div>

        {/* FORMULÁRIO E MATÉRIA (Col-span 1) */}
        <div className="flex flex-col gap-4 p-5 bg-[#111623] border border-white/[0.07] rounded-3xl">
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
            <Tag size={14} className="text-indigo-400" />
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Configurar Sessão</h3>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matéria *</label>
              <input
                value={materia}
                onChange={e => setMateria(e.target.value)}
                placeholder="Ex: Matemática Financeira"
                list="materias-cronometro"
                className="px-3.5 py-2.5 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <datalist id="materias-cronometro">
                {materiasDisponiveis.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tópico / Descrição (opcional)</label>
              <input
                value={topico}
                onChange={e => setTopico(e.target.value)}
                placeholder="Ex: Resolução de 20 questões de MMC"
                className="px-3.5 py-2.5 bg-[#0d1220] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Dicas e Resumo */}
            <div className="p-3 bg-[#0d1220] rounded-xl border border-white/[0.05] mt-2 flex flex-col gap-1.5 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Modo selecionado:</span>
                <strong className="text-slate-200 uppercase font-mono">{modo}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Tempo em foco:</span>
                <strong className="text-emerald-400 font-mono">{formatSeconds(tempoFocoSec)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Tempo em pausa:</span>
                <strong className="text-amber-400 font-mono">{formatSeconds(tempoPausaSec)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HISTÓRICO DE SESSÕES REGISTRADAS ── */}
      <div className="flex flex-col gap-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} className="text-indigo-400" />
            Histórico de Sessões ({sessoes.length})
          </h3>
        </div>

        {carregandoSessoes ? (
          <p className="text-[11px] text-slate-600 italic py-6 text-center">Carregando histórico...</p>
        ) : sessoes.length === 0 ? (
          <div className="p-8 text-center bg-[#111623] border border-white/[0.06] rounded-2xl flex flex-col items-center gap-2">
            <Clock size={28} className="text-slate-700" />
            <p className="text-[12px] font-bold text-slate-500">Nenhuma sessão registrada ainda.</p>
            <p className="text-[11px] text-slate-600 max-w-sm">Inicie o cronômetro, faça seus estudos e clique em "Salvar Sessão" ao terminar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessoes.map(s => (
              <div key={s.id} className="flex flex-col justify-between p-4 bg-[#111623] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl transition-all group">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      {s.materia}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{s.data}</span>
                  </div>

                  {s.topico && (
                    <p className="text-[12px] text-slate-300 font-medium truncate mt-0.5">{s.topico}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.05] text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">⏱️ {s.duracao_minutos}m foco</span>
                    {s.tempo_pausa_minutos > 0 && (
                      <span className="text-amber-400">☕ {s.tempo_pausa_minutos}m pausa</span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteSessao(s.id)}
                    className="text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    title="Excluir sessão"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
