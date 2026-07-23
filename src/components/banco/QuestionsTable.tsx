"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Target,
  Layers,
  Award,
  Play,
  RotateCcw,
  SlidersHorizontal,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Edit3,
  Sparkles,
  Trash2,
  Pencil,
  Calendar,
  ChevronDown,
} from 'lucide-react';

export interface BancoQuestion {
  id: any;
  materia: string;
  tema?: string;
  title: string;
  dificuldade?: string;
  status?: string;
  dat?: string;
  referencia?: string;
  prova?: string;
  created_at?: string;
  // Raw fields from DB
  "Alternativa A"?: string;
  "Alternativa B"?: string;
  "Alternativa C"?: string;
  "Alternativa D"?: string;
  "Alternativa E"?: string;
  "Texto de apoio"?: string;
  perguntaProblema?: string;
  respostaCorreta?: string;
  Gabarito?: string;
  explicacao?: string;
  comentario?: string;
  "Comentário"?: string;
}

interface UserAnswers {
  [key: string]: {
    isCorrect: boolean;
    answer: string;
    timestamp: number;
  };
}

interface QuestionsTableProps {
  questions: BancoQuestion[];
  userAnswers: UserAnswers;
  onSelect: (q: BancoQuestion) => void;
  onGenerateTest: (questions: BancoQuestion[]) => void;
}

const CustomDropdown = ({ value, onChange, options }: any) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);
  
  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-[#0F172A] border border-white/[0.08] rounded-xl text-[11px] font-bold text-slate-300 hover:bg-white/[0.06] hover:text-white transition-all flex items-center justify-between gap-2 min-w-[120px]"
      >
        <span className="truncate max-w-[150px] text-left">{selectedOption.label}</span> 
        <ChevronDown size={12} className={`opacity-50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="absolute top-full mt-1 right-0 w-72 max-w-[calc(100vw-2rem)] bg-[#1e2436] border border-white/[0.08] rounded-xl overflow-hidden z-50 shadow-xl max-h-64 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1.5 space-y-0.5">
              {options.map((o: any) => (
                <button 
                  key={o.value} 
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-colors block truncate ${o.value === value ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'}`}
                  title={o.label}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function QuestionsTable({
  questions,
  userAnswers,
  onSelect,
  onGenerateTest,
}: QuestionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('Todas');
  const [provaFilter, setProvaFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'category'>('list');

  const getStatus = (id: any) => {
    const answer = userAnswers[String(id)];
    if (answer) return answer.isCorrect ? 'Acertei' : 'Errei';
    return 'Pendente';
  };

  // Stats
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => userAnswers[String(q.id)]).length;
  const correctCount = questions.filter(q => userAnswers[String(q.id)]?.isCorrect).length;
  const incorrectCount = answeredCount - correctCount;
  const rate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const filteredQuestions = questions.filter(q => {
    const matchesSearch =
      (q.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.materia || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.tema || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(q.id || "").includes(searchTerm);

    const matchesMateria = materiaFilter === 'Todas' || q.materia === materiaFilter;
    const matchesProva = provaFilter === 'Todas' || q.prova === provaFilter;

    const status = getStatus(q.id);
    const matchesStatus =
      statusFilter === 'Todos' ||
      (statusFilter === 'Acertadas' && status === 'Acertei') ||
      (statusFilter === 'Erradas' && status === 'Errei') ||
      (statusFilter === 'Pendente' && status === 'Pendente');

    return matchesSearch && matchesMateria && matchesProva && matchesStatus;
  });

  const getDifficultyStyles = (diff?: string) => {
    switch (diff) {
      case 'Baixa': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15';
      case 'Média': return 'bg-amber-500/10 text-amber-400 border-amber-500/15';
      case 'Alta': return 'bg-rose-500/10 text-rose-400 border-rose-500/15';
      case 'Atenção': return 'bg-blue-500/10 text-blue-400 border-blue-500/15';
      case 'Extra Difícil': return 'bg-purple-500/10 text-purple-400 border-purple-500/15';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/15';
    }
  };

  const getDifficultyDot = (diff?: string) => {
    switch (diff) {
      case 'Baixa': return 'bg-emerald-500';
      case 'Média': return 'bg-amber-500';
      case 'Alta': return 'bg-rose-500';
      case 'Atenção': return 'bg-blue-500';
      case 'Extra Difícil': return 'bg-purple-500';
      default: return 'bg-slate-600';
    }
  };

  const materias = Array.from(new Set(questions.map(q => q.materia).filter(Boolean))).sort();
  const provas = Array.from(new Set(questions.map(q => q.prova).filter(Boolean))).sort();

  return (
    <div className="space-y-5">
      {/* Mini Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <BookOpen size={16} />, color: 'text-blue-400 bg-blue-500/10', label: 'Banco Total', value: `${totalQuestions} Questões` },
          { icon: <HelpCircle size={16} />, color: 'text-purple-400 bg-purple-500/10', label: 'Resolvidas', value: `${answeredCount} (${Math.round(totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0)}%)` },
          { icon: <CheckCircle size={16} />, color: 'text-emerald-400 bg-emerald-500/10', label: 'Acertos', value: `${correctCount} (${rate}%)` },
          { icon: <XCircle size={16} />, color: 'text-rose-400 bg-rose-500/10', label: 'Erros', value: `${incorrectCount} Questões` },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{stat.label}</div>
              <div className="text-sm font-bold text-white leading-tight">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Guide tip */}
      <div className="bg-blue-500/5 border border-blue-500/15 p-3 rounded-xl flex items-center gap-3 text-xs text-blue-300">
        <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        </span>
        <span className="leading-relaxed">
          <strong>Banco Interativo:</strong> Clique em qualquer questão para abrí-la na aba de resolução.
        </span>
      </div>

      {/* View Switch */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-px">
        {[
          { mode: 'list', icon: <Award size={13} />, label: 'Todas as questões' },
          { mode: 'category', icon: <Layers size={13} />, label: 'Agrupar por Matéria' },
        ].map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode as any)}
            className={`px-4 py-2.5 text-[11px] font-bold transition-all border-b-2 flex items-center gap-2 -mb-px ${
              viewMode === mode
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white/[0.02] border border-white/[0.06] p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Pesquisar enunciados, temas ou matérias..."
            className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
          {[
            {
              value: materiaFilter,
              onChange: setMateriaFilter,
              options: [{ value: 'Todas', label: 'Matéria: Tudo' }, ...materias.map(m => ({ value: m, label: m }))],
            },
            {
              value: provaFilter,
              onChange: setProvaFilter,
              options: [{ value: 'Todas', label: 'Simulado: Tudo' }, ...provas.map(p => ({ value: p, label: p }))],
            },
            {
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'Todos', label: 'Status: Tudo' },
                { value: 'Acertadas', label: 'Acertadas' },
                { value: 'Erradas', label: 'Erradas' },
                { value: 'Pendente', label: 'Pendentes' },
              ],
            },
          ].map((sel, i) => (
            <CustomDropdown
              key={i}
              value={sel.value}
              onChange={sel.onChange}
              options={sel.options}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.05] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-2 py-3.5 w-[50px] text-center">#</th>
                <th className="px-4 py-3.5 w-[180px]">Matéria</th>
                <th className="px-4 py-3.5">Enunciado</th>
                <th className="px-3 py-3.5 w-[120px] text-center">Status</th>
                <th className="px-4 py-3.5 w-[130px]">Simulado</th>
                <th className="px-4 py-3.5 w-[130px] text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {viewMode === 'list'
                ? filteredQuestions.map((q, idx) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      idx={idx}
                      getStatus={getStatus}
                      getDifficultyStyles={getDifficultyStyles}
                      getDifficultyDot={getDifficultyDot}
                      onSelect={onSelect}
                    />
                  ))
                : materias
                    .filter(m => materiaFilter === 'Todas' || m === materiaFilter)
                    .map(materia => {
                      const mqs = filteredQuestions.filter(q => q.materia === materia);
                      if (mqs.length === 0) return null;
                      return (
                        <React.Fragment key={materia}>
                          <tr className="bg-white/[0.015]">
                            <td colSpan={6} className="px-5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                              {materia} •{' '}
                              <span className="text-blue-400 font-bold">{mqs.length} questões</span>
                            </td>
                          </tr>
                          {mqs.map((q, idx) => (
                            <QuestionRow
                              key={q.id}
                              q={q}
                              idx={idx}
                              getStatus={getStatus}
                              getDifficultyStyles={getDifficultyStyles}
                              getDifficultyDot={getDifficultyDot}
                              onSelect={onSelect}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-white/[0.05]">
          {filteredQuestions.map((q, idx) => (
            <MobileQuestionRow
              key={q.id || idx}
              q={q}
              onSelect={onSelect}
              getStatus={getStatus}
              getDifficultyStyles={getDifficultyStyles}
            />
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-slate-500">
              <Filter size={22} />
            </div>
            <div className="max-w-xs mx-auto">
              <h4 className="text-sm font-bold text-white">Nenhum Resultado</h4>
              <p className="text-xs text-slate-500 mt-1">Refine os filtros ou o termo de busca.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Desktop Row
// ──────────────────────────────────────────────
function QuestionRow({ q, idx, getStatus, getDifficultyStyles, getDifficultyDot, onSelect }: any) {
  const status = getStatus(q.id);

  const statusCfg = (() => {
    switch (status) {
      case 'Acertei': return { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500', label: 'Acertada', icon: <CheckCircle2 size={10} /> };
      case 'Errei': return { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-500', label: 'Incorreta', icon: <XCircle size={10} /> };
      default: return { bg: 'bg-white/[0.04] text-slate-400 border-transparent', dot: 'bg-slate-600', label: 'Pendente', icon: <Calendar size={10} /> };
    }
  })();

  return (
    <tr
      onClick={() => onSelect(q)}
      className="group hover:bg-blue-500/5 transition-all duration-150 cursor-pointer"
    >
      <td className="px-2 py-3.5 text-center text-xs font-semibold text-slate-500 w-[50px]">{idx + 1}</td>
      <td className="px-4 py-3.5 w-[180px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-slate-200 truncate flex items-center gap-1.5 uppercase tracking-wide">
            <Target size={10} className="text-emerald-400 shrink-0" />
            {q.materia}
          </span>
          {q.tema && <span className="text-[10px] text-slate-500 font-medium truncate">{q.tema}</span>}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-xs font-medium text-slate-400 leading-relaxed group-hover:text-blue-300 transition-colors line-clamp-2 max-w-[500px]">
          {q.title}
        </p>
      </td>
      <td className="px-3 py-3.5 text-center w-[120px]">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.bg}`}>
          <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3.5 w-[130px]">
        {q.prova ? (
          <span className="text-[10px] font-bold text-slate-400 truncate block max-w-[120px]">{q.prova}</span>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right w-[130px]" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onSelect(q)}
          className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 ml-auto ${
            status === 'Pendente'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95'
              : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] active:scale-95'
          }`}
        >
          {status === 'Pendente' ? <><Play size={9} fill="currentColor" /> Responder</> : <><RotateCcw size={9} /> Refazer</>}
        </button>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────
// Mobile Row
// ──────────────────────────────────────────────
function MobileQuestionRow({ q, onSelect, getStatus, getDifficultyStyles }: any) {
  const status = getStatus(q.id);
  const statusCfg = (() => {
    switch (status) {
      case 'Acertei': return { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500', label: 'Acertada' };
      case 'Errei': return { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-500', label: 'Incorreta' };
      default: return { bg: 'bg-white/[0.04] text-slate-400 border-transparent', dot: 'bg-slate-600', label: 'Pendente' };
    }
  })();

  return (
    <div
      onClick={() => onSelect(q)}
      className="p-4 space-y-2.5 active:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">{q.materia}</span>
          <p className="text-xs font-bold text-slate-200 leading-relaxed mt-0.5 line-clamp-2">{q.title}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusCfg.bg}`}>
            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSelect(q); }}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
        >
          {status === 'Pendente' ? 'Responder' : 'Refazer'}
        </button>
      </div>
    </div>
  );
}
