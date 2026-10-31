"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Printer,
  FileJson,
  X,
  AlertTriangle,
  Loader2,
  Flag,
} from 'lucide-react';
import { supabase, supabasePublic } from '../../lib/supabase';
import { PrintSimuladoModal } from './PrintSimuladoModal';
import { ImportJsonModal } from './ImportJsonModal';

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
  imagemEnunciado?: string;
  // Campos da nova arquitetura (Etapa 1)
  Ano?: number;
  ID_Qconcursos?: string;
  link?: string;
  organizacao_id?: string;
  Duvida?: boolean;
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
  duvidas?: Set<string>;
  onToggleDuvida?: (questaoId: string | number) => void;
  onSelect: (q: BancoQuestion, filtered?: BancoQuestion[]) => void;
  onGenerateTest: (questions: BancoQuestion[]) => void;
  onFilteredQuestionsChange?: (filtered: BancoQuestion[]) => void;
  isAdmin?: boolean;
  onRefresh?: () => void;
  onEdit?: (q: BancoQuestion) => void;
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
  duvidas,
  onToggleDuvida,
  onSelect,
  onGenerateTest,
  onFilteredQuestionsChange,
  isAdmin,
  onRefresh,
  onEdit,
}: QuestionsTableProps) {
  // searchTerm tem input imediato (para UX responsiva) + valor debounced (para filtro pesado)
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('Todas');
  const [provaFilter, setProvaFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'category'>('list');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(40);

  // Seleção múltipla de questões
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Exclusão de questões (Admin)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<BancoQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Debounce de 220ms no searchTerm para não filtrar 830 questões a cada keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, materiaFilter, provaFilter, statusFilter]);

  const getStatus = useCallback((id: any) => {
    const answer = userAnswers[String(id)];
    if (answer) return answer.isCorrect ? 'Acertei' : 'Errei';
    return 'Pendente';
  }, [userAnswers]);

  const norm = (s?: string) => (s || '').trim().toLowerCase();

  const filteredQuestions = useMemo(() => {
    const term = norm(searchTerm);
    return questions.filter(q => {
      const matchesSearch =
        !term ||
        norm(q.title).includes(term) ||
        norm(q.materia).includes(term) ||
        norm(q.tema).includes(term) ||
        String(q.id || "").includes(term);

      const matchesMateria = materiaFilter === 'Todas' || norm(q.materia) === norm(materiaFilter);
      const matchesProva = provaFilter === 'Todas' || norm(q.prova) === norm(provaFilter);

      const status = getStatus(q.id);
      const isDuv = duvidas ? duvidas.has(String(q.id)) : false;
      const matchesStatus =
        statusFilter === 'Todos' ||
        (statusFilter === 'Duvidas' && isDuv) ||
        (statusFilter === 'Acertadas' && status === 'Acertei') ||
        (statusFilter === 'Erradas' && status === 'Errei') ||
        (statusFilter === 'Pendente' && status === 'Pendente');

      return matchesSearch && matchesMateria && matchesProva && matchesStatus;
    });
  }, [questions, searchTerm, materiaFilter, provaFilter, statusFilter, getStatus, duvidas]);

  // Previne loop de renderização infinita checando assinatura do array
  const prevFilterSig = useRef("");
  useEffect(() => {
    const sig = `${filteredQuestions.length}-${filteredQuestions[0]?.id || ''}-${filteredQuestions[filteredQuestions.length - 1]?.id || ''}`;
    if (prevFilterSig.current !== sig) {
      prevFilterSig.current = sig;
      if (onFilteredQuestionsChange) {
        onFilteredQuestionsChange(filteredQuestions);
      }
    }
  }, [filteredQuestions, onFilteredQuestionsChange]);

  // Paginação inteligente para renderização 60FPS sem travamento
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  // Stats (Dinâmicos conforme filtro) memoizados
  const isFiltered = materiaFilter !== 'Todas' || provaFilter !== 'Todas' || statusFilter !== 'Todos' || searchTerm.trim() !== '';
  const currentTotal = filteredQuestions.length;
  const answeredCount = useMemo(() => filteredQuestions.filter(q => userAnswers[String(q.id)]).length, [filteredQuestions, userAnswers]);
  const correctCount = useMemo(() => filteredQuestions.filter(q => userAnswers[String(q.id)]?.isCorrect).length, [filteredQuestions, userAnswers]);
  const incorrectCount = answeredCount - correctCount;
  const rate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const handleSelectQuestion = (q: BancoQuestion) => {
    onSelect(q, filteredQuestions);
  };

  // Alternar seleção de uma questão
  const toggleSelectOne = useCallback((id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Verificar se todas da página atual estão selecionadas
  const isAllPageSelected = useMemo(() => {
    if (paginatedQuestions.length === 0) return false;
    return paginatedQuestions.every(q => selectedIds.has(q.id));
  }, [paginatedQuestions, selectedIds]);

  // Alternar seleção de todas da página atual
  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = paginatedQuestions.every(q => next.has(q.id));
      if (allSelected) {
        paginatedQuestions.forEach(q => next.delete(q.id));
      } else {
        paginatedQuestions.forEach(q => next.add(q.id));
      }
      return next;
    });
  }, [paginatedQuestions]);

  // Limpar seleção
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Questões atualmente selecionadas
  const selectedQuestionsList = useMemo(() => {
    return questions.filter(q => selectedIds.has(q.id));
  }, [questions, selectedIds]);

  // Modal de impressão para questões selecionadas
  const [showSelectedPrintModal, setShowSelectedPrintModal] = useState(false);

  const handlePrintSelected = () => {
    if (selectedQuestionsList.length === 0) return;
    setShowSelectedPrintModal(true);
  };

  const handleResolveSelected = () => {
    if (selectedQuestionsList.length === 0) return;
    onGenerateTest(selectedQuestionsList);
  };

  // Abrir confirmação de exclusão individual
  const handlePromptDeleteSingle = useCallback((q: BancoQuestion) => {
    if (!isAdmin) return;
    setQuestionToDelete(q);
    setShowDeleteModal(true);
  }, [isAdmin]);

  // Abrir confirmação de exclusão em massa
  const handlePromptDeleteBulk = () => {
    if (!isAdmin || selectedIds.size === 0) return;
    setQuestionToDelete(null);
    setShowDeleteModal(true);
  };

  // Executar exclusão real no Supabase
  const handleConfirmDelete = async () => {
    if (!isAdmin) return;
    setIsDeleting(true);

    const idsToDelete: (string | number)[] = questionToDelete
      ? [questionToDelete.id]
      : Array.from(selectedIds);

    try {
      let res = await supabase.from('questoes').delete().in('id', idsToDelete);
      
      if (res.error) {
        res = await supabasePublic.from('questoes').delete().in('id', idsToDelete);
      }

      if (res.error) {
        throw new Error(res.error.message || 'Erro ao excluir questões do banco.');
      }

      showToast(
        idsToDelete.length === 1
          ? 'Questão excluída com sucesso!'
          : `${idsToDelete.length} questões excluídas com sucesso!`,
        'success'
      );

      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
      setShowDeleteModal(false);
      setQuestionToDelete(null);

      onRefresh?.();
    } catch (err: any) {
      console.error('Erro na exclusão:', err);
      showToast(err.message || 'Falha ao excluir questão(ões). Verifique as permissões.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Opções interdependentes memoizadas
  const materias = useMemo(() => Array.from(
    new Set(
      questions
        .filter(q => provaFilter === 'Todas' || norm(q.prova) === norm(provaFilter))
        .map(q => (q.materia || '').trim())
        .filter(Boolean)
    )
  ).sort(), [questions, provaFilter]);

  const provas = useMemo(() => Array.from(
    new Set(
      questions
        .filter(q => materiaFilter === 'Todas' || norm(q.materia) === norm(materiaFilter))
        .map(q => (q.prova || '').trim())
        .filter(Boolean)
    )
  ).sort(), [questions, materiaFilter]);

  return (
    <div className="space-y-5">
      {/* Mini Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <BookOpen size={16} />, color: 'text-blue-400 bg-blue-500/10', label: isFiltered ? 'Filtradas' : 'Banco Total', value: isFiltered ? `${currentTotal} / ${questions.length}` : `${questions.length} Questões` },
          { icon: <HelpCircle size={16} />, color: 'text-purple-400 bg-purple-500/10', label: 'Resolvidas', value: `${answeredCount} (${Math.round(currentTotal > 0 ? (answeredCount / currentTotal) * 100 : 0)}%)` },
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

      {/* View Switch & Action Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-px flex-wrap gap-2">
        <div className="flex items-center gap-1">
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

        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2"
            >
              <FileJson size={14} /> Importar JSON
            </button>
          )}

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Printer size={14} /> Imprimir Simulado ({filteredQuestions.length})
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/[0.02] border border-white/[0.06] p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Pesquisar enunciados, temas ou matérias..."
            className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
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
                { value: 'Duvidas', label: 'Status: Com Dúvida 🚩' },
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

          {/* Botão de Imprimir Simulado */}
          <button
            onClick={() => setShowPrintModal(true)}
            title="Imprimir simulado / gerar PDF organizado"
            className="px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-xl text-[11px] font-black text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 uppercase tracking-wider"
          >
            <Printer size={13} /> Imprimir Simulado
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.05] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-3.5 w-[70px] text-center">
                  <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={toggleSelectAllPage}
                      title={isAllPageSelected ? "Desmarcar página" : "Selecionar todas as 40 questões desta página"}
                      className="w-3.5 h-3.5 rounded bg-slate-900 border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                    />
                    <span>#</span>
                  </div>
                </th>
                <th className="px-4 py-3.5 w-[180px]">Matéria</th>
                <th className="px-4 py-3.5">Enunciado</th>
                <th className="px-3 py-3.5 w-[120px] text-center">Status</th>
                <th className="px-4 py-3.5 w-[130px]">Simulado</th>
                <th className="px-4 py-3.5 w-[140px] text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {viewMode === 'list'
                ? paginatedQuestions.map((q, idx) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      idx={(currentPage - 1) * pageSize + idx}
                      getStatus={getStatus}
                      getDifficultyStyles={getDifficultyStyles}
                      getDifficultyDot={getDifficultyDot}
                      onSelect={handleSelectQuestion}
                      isAdmin={isAdmin}
                      onEdit={onEdit}
                      isSelected={selectedIds.has(q.id)}
                      onToggleSelect={toggleSelectOne}
                      onDelete={handlePromptDeleteSingle}
                      isDuvida={duvidas?.has(String(q.id))}
                      onToggleDuvida={onToggleDuvida}
                    />
                  ))
                : materias
                    .filter(m => materiaFilter === 'Todas' || m === materiaFilter)
                    .map(materia => {
                      const mqs = paginatedQuestions.filter(q => q.materia === materia);
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
                              idx={(currentPage - 1) * pageSize + idx}
                              getStatus={getStatus}
                              getDifficultyStyles={getDifficultyStyles}
                              getDifficultyDot={getDifficultyDot}
                              onSelect={handleSelectQuestion}
                              isAdmin={isAdmin}
                              onEdit={onEdit}
                              isSelected={selectedIds.has(q.id)}
                              onToggleSelect={toggleSelectOne}
                              onDelete={handlePromptDeleteSingle}
                              isDuvida={duvidas?.has(String(q.id))}
                              onToggleDuvida={onToggleDuvida}
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
          {paginatedQuestions.map((q, idx) => (
            <MobileQuestionRow
              key={q.id || idx}
              q={q}
              onSelect={handleSelectQuestion}
              getStatus={getStatus}
              getDifficultyStyles={getDifficultyStyles}
              isAdmin={isAdmin}
              onEdit={onEdit}
              isSelected={selectedIds.has(q.id)}
              onToggleSelect={toggleSelectOne}
              onDelete={handlePromptDeleteSingle}
              isDuvida={duvidas?.has(String(q.id))}
              onToggleDuvida={onToggleDuvida}
            />
          ))}
        </div>

        {/* Paginação Ultrarrápida */}
        {filteredQuestions.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.05] bg-white/[0.015]">
            <div className="text-[11px] text-slate-400">
              Mostrando <span className="text-white font-medium">{(currentPage - 1) * pageSize + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * pageSize, filteredQuestions.length)}</span> de <span className="text-white font-medium">{filteredQuestions.length}</span> questões
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed text-xs text-slate-300 transition-all flex items-center gap-1"
              >
                <ChevronLeft size={13} />
                <span>Anterior</span>
              </button>

              <span className="text-[11px] font-mono px-2 text-slate-400">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed text-xs text-slate-300 transition-all flex items-center gap-1"
              >
                <span>Próxima</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

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

      <PrintSimuladoModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        questions={filteredQuestions}
        title={provaFilter !== 'Todas' ? provaFilter.toUpperCase() : "SIMULADO BANCO DE QUESTÕES"}
        subTitle={materiaFilter !== 'Todas' ? `Matéria: ${materiaFilter}` : "Questões Selecionadas para Treinamento"}
      />

      {/* Modal de Impressão de Questões Selecionadas */}
      <PrintSimuladoModal
        isOpen={showSelectedPrintModal}
        onClose={() => setShowSelectedPrintModal(false)}
        questions={selectedQuestionsList}
        title={`SIMULADO SELECIONADO (${selectedQuestionsList.length} QUESTÕES)`}
        subTitle="Questões Selecionadas Manualmente no Banco de Questões"
      />

      <ImportJsonModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* ── BARRA FLUTUANTE DE AÇÕES EM LOTE (SELEÇÃO MÚLTIPLA) ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0c1220]/95 border border-blue-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.7)] rounded-2xl px-4 py-2.5 flex items-center gap-2.5 backdrop-blur-xl flex-wrap max-w-[95vw]"
          >
            <div className="flex items-center gap-2 pr-3 border-r border-white/10 text-xs font-bold text-white shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}</span>
            </div>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] transition-all shrink-0"
            >
              Desmarcar
            </button>

            <button
              type="button"
              onClick={handlePrintSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-xs font-bold text-slate-200 border border-white/[0.08] transition-all shrink-0"
              title="Imprimir simulado com as questões selecionadas"
            >
              <Printer size={13} />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleResolveSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow transition-all shrink-0 active:scale-95"
              title="Iniciar resolução com as questões selecionadas"
            >
              <Play size={12} fill="currentColor" />
              <span>Resolver</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handlePromptDeleteBulk}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all ml-1 shrink-0 active:scale-95"
                title="Excluir permanentemente todas as questões selecionadas (Admin)"
              >
                <Trash2 size={13} />
                <span>Excluir</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ADMIN) ── */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#0c1220] border border-rose-500/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-left"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">
                    {questionToDelete
                      ? `Excluir Questão #${questionToDelete.id}?`
                      : `Excluir ${selectedIds.size} Questões Selecionadas?`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Esta ação é <strong className="text-rose-400">permanente e irreversível</strong>. As questões serão removidas definitivamente do banco de dados Supabase.
                  </p>
                  {questionToDelete && (
                    <div className="mt-2.5 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-[11px] text-slate-300 line-clamp-2">
                      <span className="text-slate-500 font-mono">[{questionToDelete.materia}]</span> {questionToDelete.title || questionToDelete.perguntaProblema}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setQuestionToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-white/[0.10] text-slate-400 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 active:scale-95"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Sim, Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TOAST NOTIFICATION ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className={`fixed bottom-6 right-6 z-[110] flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-medium ${
              toastMsg.type === 'success'
                ? 'bg-[#0b1628] border-emerald-500/40 text-emerald-300'
                : 'bg-[#251016] border-rose-500/40 text-rose-300'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <XCircle size={15} className="text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────
// Desktop Row — memoizado para evitar re-render de todas as linhas
// quando só uma questão muda de status
// ──────────────────────────────────────────────
const QuestionRow = memo(function QuestionRow({
  q,
  idx,
  getStatus,
  getDifficultyStyles,
  getDifficultyDot,
  onSelect,
  isAdmin,
  onEdit,
  isSelected,
  onToggleSelect,
  onDelete,
  isDuvida,
  onToggleDuvida,
}: any) {
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
      className={`group transition-all duration-150 cursor-pointer ${
        isSelected ? 'bg-blue-600/[0.08] hover:bg-blue-600/[0.12]' : 'hover:bg-blue-500/5'
      }`}
    >
      <td className="px-3 py-3.5 text-center text-xs font-semibold text-slate-500 w-[70px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect?.(q.id)}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
          />
          <span className="tabular-nums text-slate-500 font-normal">{idx + 1}</span>
        </div>
      </td>
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
          {q.title || q.perguntaProblema || "Sem enunciado"}
        </p>
      </td>
      <td className="px-3 py-3.5 text-center w-[130px]">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.bg}`}>
            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          {onToggleDuvida && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDuvida(q.id);
              }}
              title={isDuvida ? "Em Dúvida (Clique para desmarcar)" : "Marcar dúvida nesta questão"}
              className={`p-1 rounded-md transition-all ${
                isDuvida
                  ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30"
                  : "text-slate-600 hover:text-slate-400 opacity-40 hover:opacity-100"
              }`}
            >
              <Flag size={11} className={isDuvida ? "fill-amber-400" : ""} />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 w-[130px]">
        {q.prova ? (
          <span className="text-[10px] font-bold text-slate-400 truncate block max-w-[120px]">{q.prova}</span>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right w-[140px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(q)}
              title="Editar questão (Admin)"
              className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
            >
              <Pencil size={11} />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(q)}
              title="Excluir questão permanentemente (Admin)"
              className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            onClick={() => onSelect(q)}
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 ${
              status === 'Pendente'
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95'
                : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] active:scale-95'
            }`}
          >
            {status === 'Pendente' ? <><Play size={9} fill="currentColor" /> Responder</> : <><RotateCcw size={9} /> Refazer</>}
          </button>
        </div>
      </td>
    </tr>
  );
});

// ──────────────────────────────────────────────
// Mobile Row — memoizado
// ──────────────────────────────────────────────
const MobileQuestionRow = memo(function MobileQuestionRow({
  q,
  onSelect,
  getStatus,
  getDifficultyStyles,
  isAdmin,
  onEdit,
  isSelected,
  onToggleSelect,
  onDelete,
  isDuvida,
  onToggleDuvida,
}: any) {
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
      className={`p-4 space-y-2.5 transition-colors ${
        isSelected ? 'bg-blue-600/[0.08]' : 'active:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect?.(q.id)}
            className="w-4 h-4 rounded bg-slate-900 border-white/20 text-blue-500 focus:ring-0 cursor-pointer accent-blue-600"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">{q.materia}</span>
          <p className="text-xs font-bold text-slate-200 leading-relaxed mt-0.5 line-clamp-2">{q.title || q.perguntaProblema || "Sem enunciado"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusCfg.bg}`}>
            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          {onToggleDuvida && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDuvida(q.id);
              }}
              title={isDuvida ? "Em Dúvida" : "Marcar Dúvida"}
              className={`p-1 rounded text-xs transition-colors ${
                isDuvida ? "text-amber-400 bg-amber-400/10" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Flag size={11} className={isDuvida ? "fill-amber-400" : ""} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(q); }}
              title="Editar questão (Admin)"
              className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-amber-400 transition-colors"
            >
              <Pencil size={11} />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(q); }}
              title="Excluir questão (Admin)"
              className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onSelect(q); }}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            {status === 'Pendente' ? 'Responder' : 'Refazer'}
          </button>
        </div>
      </div>
    </div>
  );
});
