"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Sparkles, Search, Loader2, CheckCircle2, Play, RotateCcw,
  Database, ChevronDown, Target, BarChart3, RefreshCw,
  AlertTriangle, BookOpen, Eye, ArrowLeft, GraduationCap,
  Zap, FileText, X, Settings2, ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface NotionPage {
  id: string;
  title: string;
  url?: string;
}

interface FlatBlock {
  id: string;
  content: string;
  type: string;
  path: string[];
  depth: number;
}

interface StudyUnit {
  id: string;
  blockId: string;
  pageId: string;
  pageTitle: string;
  path: string[];
  label: string;
  content: string;
  score: number;
  wordCount: number;
}

interface GeneratedQuestion {
  PROVA?: string;
  Disciplina?: string;
  Topico?: string;
  Assunto?: string;
  Enunciado: string;
  Pergunta_problema?: string;
  Alternativa_A: string;
  Alternativa_B: string;
  Alternativa_C: string;
  Alternativa_D: string;
  Alternativa_E: string;
  Gabarito: string;
  Comentario?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function scoreContent(content: string): number {
  if (!content || content.length < 100) return 0;
  let s = 0;
  const boldTerms = (content.match(/\*\*[^*\n]+\*\*/g) || []).length;
  s += Math.min(boldTerms, 10) * 1.5;
  const numericFacts = (content.match(/\d+\s*(membros?|presidentes?|anos?|meses?|dias?|%|R\$|votos?)/gi) || []).length;
  s += Math.min(numericFacts, 8) * 2.5;
  s += Math.min(content.length / 200, 8);
  const bullets = (content.match(/^[\s]*[-*•]\s/gm) || []).length;
  s += Math.min(bullets, 8) * 0.8;
  return Math.round(s * 10) / 10;
}

function buildStudyUnits(blocks: FlatBlock[], pageId: string, pageTitle: string): StudyUnit[] {
  const units: StudyUnit[] = [];
  const MIN = 120;

  for (const block of blocks) {
    if (block.content.trim().length < MIN) continue;
    const score = scoreContent(block.content);
    if (score < 1) continue;
    units.push({
      id: `unit_${block.id}`,
      blockId: block.id,
      pageId,
      pageTitle,
      path: block.path,
      label: block.path[block.path.length - 1] || pageTitle,
      content: block.content,
      score,
      wordCount: block.content.split(/\s+/).filter(w => w.length > 2).length,
    });
  }
  return units.sort((a, b) => b.score - a.score);
}

const GABARITOS = ["A", "B", "C", "D", "E"];
function pickGabarito(recent: string[]): string {
  const recent2 = recent.slice(-2);
  const available = GABARITOS.filter(l => !recent2.includes(l));
  const pool = available.length > 0 ? available : GABARITOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES MENORES
// ─────────────────────────────────────────────────────────────────────────────
function UnitCard({
  unit,
  isSelected,
  onSelect,
}: {
  unit: StudyUnit;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pct = Math.min(100, Math.round((unit.score / 20) * 100));
  return (
    <motion.button
      layout
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-white/[0.06] bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-200 truncate">{unit.label}</p>
          {unit.path.length > 1 && (
            <p className="text-[9px] text-slate-500 mt-0.5 truncate">
              {unit.path.slice(0, -1).join(" › ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-black text-slate-500">{unit.wordCount}p</span>
          {isSelected && <CheckCircle2 size={12} className="text-blue-400" />}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
            className={`h-full rounded-full ${pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-slate-600"}`}
          />
        </div>
        <span className={`text-[9px] font-black ${pct >= 60 ? "text-emerald-400" : pct >= 30 ? "text-amber-400" : "text-slate-500"}`}>
          {pct}%
        </span>
      </div>
    </motion.button>
  );
}

function QuestionCard({
  question,
  onSave,
  onRegenerate,
  isSaving,
  saved,
}: {
  question: GeneratedQuestion;
  onSave: () => void;
  onRegenerate: () => void;
  isSaving: boolean;
  saved: boolean;
}) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const alts = [
    { key: "A", text: question.Alternativa_A },
    { key: "B", text: question.Alternativa_B },
    { key: "C", text: question.Alternativa_C },
    { key: "D", text: question.Alternativa_D },
    { key: "E", text: question.Alternativa_E },
  ].filter(a => a.text?.trim());

  const gabarito = (question.Gabarito || "A").toString().trim().toUpperCase()[0];

  const getAltStyle = (key: string) => {
    if (!revealed) {
      return selectedAnswer === key
        ? "border-blue-500 bg-blue-500/10 text-blue-300"
        : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-blue-500/40";
    }
    if (key === gabarito) return "border-emerald-500 bg-emerald-500/10 text-emerald-300";
    if (key === selectedAnswer) return "border-rose-500 bg-rose-500/10 text-rose-300 line-through opacity-60";
    return "border-white/[0.04] bg-transparent text-slate-600 opacity-40";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Sparkles size={12} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Questão Gerada</p>
            {question.Disciplina && (
              <p className="text-[9px] text-slate-500">{question.Disciplina} {question.Topico ? `· ${question.Topico}` : ""}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all text-slate-400 hover:text-slate-200"
            title="Gerar nova questão"
          >
            <RotateCcw size={12} />
          </button>
          {!saved ? (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
            >
              {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Database size={10} />}
              {isSaving ? "Salvando..." : "Salvar no Banco"}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
              <CheckCircle2 size={10} />
              Salva!
            </div>
          )}
        </div>
      </div>

      {/* Enunciado */}
      <div className="px-5 py-4">
        <p className="text-sm text-slate-300 leading-relaxed font-medium">{question.Enunciado}</p>
        {question.Pergunta_problema && (
          <p className="text-xs text-slate-400 mt-2 italic">{question.Pergunta_problema}</p>
        )}
      </div>

      {/* Alternativas */}
      <div className="px-5 pb-4 flex flex-col gap-2">
        {alts.map(({ key, text }) => (
          <button
            key={key}
            onClick={() => {
              if (revealed) return;
              setSelectedAnswer(key);
            }}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border text-xs transition-all ${getAltStyle(key)}`}
          >
            <span className="font-black shrink-0 w-4">{key})</span>
            <span className="leading-relaxed">{text}</span>
            {revealed && key === gabarito && (
              <CheckCircle2 size={14} className="text-emerald-400 ml-auto shrink-0 mt-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Revelar / Comentário */}
      <div className="px-5 pb-5 flex flex-col gap-3">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            disabled={!selectedAnswer}
            className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-slate-300 rounded-xl text-xs font-bold border border-white/[0.06] transition-all"
          >
            {selectedAnswer ? "Ver gabarito" : "Selecione uma alternativa"}
          </button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
            >
              <p className="text-[10px] font-black uppercase text-emerald-400 mb-1.5">
                Gabarito: {gabarito} · {selectedAnswer === gabarito ? "✓ Você acertou!" : "✗ Resposta incorreta"}
              </p>
              {question.Comentario && (
                <p className="text-xs text-slate-300 leading-relaxed">{question.Comentario}</p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function GeradorPage() {
  const router = useRouter();

  // Notion
  const [notionPages, setNotionPages] = useState<NotionPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [searchPage, setSearchPage] = useState("");
  const [selectedPage, setSelectedPage] = useState<NotionPage | null>(null);

  // Unidades de estudo
  const [units, setUnits] = useState<StudyUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<StudyUnit | null>(null);

  // Configurações de geração
  const [materia, setMateria] = useState("");
  const [topico, setTopico] = useState("");
  const [recentGabaritos, setRecentGabaritos] = useState<string[]>([]);

  // Questão
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stats
  const [generatedCount, setGeneratedCount] = useState(0);

  // ── Buscar páginas Notion ──────────────────────────────────────────────────
  const fetchPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const res = await axios.post("/api/notion/search", {
        filter: { value: "page", property: "object" },
        page_size: 50,
      });
      const pages: NotionPage[] = (res.data?.results || [])
        .filter((p: any) => p.object === "page")
        .map((p: any) => ({
          id: p.id,
          title:
            p.properties?.title?.title?.[0]?.plain_text ||
            p.properties?.Name?.title?.[0]?.plain_text ||
            "Sem título",
          url: p.url,
        }));
      setNotionPages(pages);
    } catch {
      setNotionPages([]);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // ── Buscar unidades de estudo da página ────────────────────────────────────
  const fetchUnits = useCallback(async (page: NotionPage) => {
    setLoadingUnits(true);
    setUnits([]);
    setSelectedUnit(null);
    setQuestion(null);
    try {
      const res = await axios.get(`/api/blocks/${page.id}/subtree-data`);
      const blocks: FlatBlock[] = res.data?.blocks || [];
      const built = buildStudyUnits(blocks, page.id, page.title);
      setUnits(built);
      if (built.length > 0) {
        setSelectedUnit(built[0]);
        setMateria(page.title);
        setTopico(built[0].label);
      }
    } catch (e: any) {
      setUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPage) fetchUnits(selectedPage);
  }, [selectedPage, fetchUnits]);

  // ── Gerar questão ──────────────────────────────────────────────────────────
  const generateQuestion = useCallback(async () => {
    if (!selectedUnit) return;
    setGenerating(true);
    setGenerationError("");
    setQuestion(null);
    setSaved(false);

    const gabarito = pickGabarito(recentGabaritos);

    try {
      const res = await axios.post("/api/gerador/gerar-questao", {
        conteudo: selectedUnit.content,
        materia: materia || selectedUnit.pageTitle,
        topico: topico || selectedUnit.label,
        gabarito,
        estrategia: "CONCEITUAL CLÁSSICA",
      });

      const q: GeneratedQuestion = res.data?.questao;
      if (!q) throw new Error("Questão inválida retornada.");

      setQuestion(q);
      setRecentGabaritos(prev => [...prev.slice(-4), gabarito]);
      setGeneratedCount(c => c + 1);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || "Erro ao gerar questão.";
      setGenerationError(msg);
    } finally {
      setGenerating(false);
    }
  }, [selectedUnit, materia, topico, recentGabaritos]);

  // ── Salvar no banco Supabase ───────────────────────────────────────────────
  const saveQuestion = useCallback(async () => {
    if (!question || !supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("questoes").insert({
        Enunciado: question.Enunciado,
        Disciplina: question.Disciplina || materia || "Geral",
        Materia: question.Disciplina || materia || "Geral",
        PROVA: question.PROVA || `${materia} - ${topico}`,
        "Alternativa A": question.Alternativa_A,
        "Alternativa B": question.Alternativa_B,
        "Alternativa C": question.Alternativa_C,
        "Alternativa D": question.Alternativa_D,
        "Alternativa E": question.Alternativa_E,
        Gabarito: question.Gabarito,
        explicacao: question.Comentario || null,
        tema: question.Topico || topico || null,
      });
      if (error) throw error;
      setSaved(true);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  }, [question, materia, topico]);

  const filteredPages = notionPages.filter(p =>
    p.title.toLowerCase().includes(searchPage.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] bg-purple-600/[0.03] blur-[140px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] h-[50%] bg-blue-600/[0.03] blur-[140px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 h-16 border-b border-white/[0.05] bg-[#020617]/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/banco")}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-white transition-all"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-white tracking-tight leading-none">
                Gerador <span className="text-purple-400">de Questões</span>
              </h1>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mt-0.5">
                IA · Notion · Concurso
              </p>
            </div>
          </div>
        </div>

        {generatedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/10 border border-purple-500/20 rounded-xl">
            <Sparkles size={12} className="text-purple-400" />
            <span className="text-[11px] font-black text-purple-300">{generatedCount} geradas</span>
          </div>
        )}
      </nav>

      {/* Layout principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── SIDEBAR ESQUERDA ────────────────────────────────────────────── */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4">

          {/* Páginas Notion */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <BookOpen size={13} className="text-orange-400" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Páginas Notion
                </p>
              </div>
              <button
                onClick={fetchPages}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-500 hover:text-slate-200 transition-all"
              >
                <RefreshCw size={11} className={loadingPages ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
              <input
                type="text"
                placeholder="Buscar página..."
                value={searchPage}
                onChange={e => setSearchPage(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {loadingPages ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-purple-400" />
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-slate-500">
                  {notionPages.length === 0
                    ? "Configure NOTION_TOKEN no .env.local"
                    : "Nenhuma página encontrada"}
                </div>
              ) : (
                filteredPages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPage(page)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                      selectedPage?.id === page.id
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <FileText size={10} className="inline mr-1.5 opacity-50" />
                    {page.title}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Unidades de Estudo */}
          {selectedPage && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Target size={13} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Unidades de Estudo
                  </p>
                  {units.length > 0 && (
                    <p className="text-[9px] text-slate-600">{units.length} trechos mapeados</p>
                  )}
                </div>
              </div>

              {loadingUnits ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 size={20} className="animate-spin text-blue-400" />
                  <p className="text-[10px] text-slate-500">Analisando conteúdo...</p>
                </div>
              ) : units.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-slate-500">
                  Nenhum trecho com conteúdo suficiente encontrado.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                  {units.map(unit => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      isSelected={selectedUnit?.id === unit.id}
                      onSelect={() => {
                        setSelectedUnit(unit);
                        setTopico(unit.label);
                        setQuestion(null);
                        setSaved(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Config */}
          {selectedUnit && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Settings2 size={13} className="text-slate-400" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Configuração</p>
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Disciplina</label>
                  <input
                    type="text"
                    value={materia}
                    onChange={e => setMateria(e.target.value)}
                    placeholder="Ex: Direito Constitucional"
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Tópico</label>
                  <input
                    type="text"
                    value={topico}
                    onChange={e => setTopico(e.target.value)}
                    placeholder="Ex: Poderes da República"
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── ÁREA PRINCIPAL ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col gap-4">

          {!selectedPage ? (
            // Estado vazio
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 gap-6 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
                <Sparkles size={32} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Gerador de Questões com IA</h2>
                <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                  Selecione uma página do Notion ao lado. A IA irá analisar o conteúdo e gerar questões estilo concurso automaticamente.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { icon: <BookOpen size={16} />, label: "Importa do Notion", color: "text-orange-400" },
                  { icon: <Zap size={16} />, label: "Gemini 2.0 Flash", color: "text-yellow-400" },
                  { icon: <Database size={16} />, label: "Salva no banco", color: "text-blue-400" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <span className={item.color}>{item.icon}</span>
                    <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {/* Botão gerar */}
              {selectedUnit && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                        Unidade selecionada
                      </p>
                      <p className="text-sm font-bold text-white">{selectedUnit.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {selectedUnit.wordCount} palavras · Score {selectedUnit.score.toFixed(1)}
                      </p>
                    </div>
                    <button
                      onClick={generateQuestion}
                      disabled={generating}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-900/20 active:scale-95 whitespace-nowrap"
                    >
                      {generating
                        ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                        : <><Sparkles size={14} /> Gerar Questão</>
                      }
                    </button>
                  </div>

                  {/* Preview do conteúdo */}
                  <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <p className="text-[9px] font-black uppercase text-slate-600 mb-1.5">Trecho base</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-4">
                      {selectedUnit.content.replace(/\*\*/g, "").slice(0, 400)}...
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {generationError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                  <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-rose-300">Erro ao gerar questão</p>
                    <p className="text-[11px] text-rose-400/80 mt-0.5">{generationError}</p>
                    {generationError.includes("GEMINI_API_KEY") && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Adicione <code className="text-amber-400">GEMINI_API_KEY=sua_chave</code> no arquivo <code className="text-amber-400">.env.local</code>
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Loading */}
              {generating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 gap-4"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center">
                      <Sparkles size={28} className="text-purple-400 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 bg-purple-600/10 blur-xl animate-pulse" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 animate-pulse">
                    Gemini está gerando...
                  </p>
                </motion.div>
              )}

              {/* Questão gerada */}
              <AnimatePresence mode="wait">
                {question && !generating && (
                  <QuestionCard
                    key={JSON.stringify(question)}
                    question={question}
                    onSave={saveQuestion}
                    onRegenerate={generateQuestion}
                    isSaving={isSaving}
                    saved={saved}
                  />
                )}
              </AnimatePresence>

              {/* Estado sem unidade selecionada */}
              {!selectedUnit && !loadingUnits && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <Target size={32} className="text-slate-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-500">Selecione uma unidade de estudo</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      As unidades são trechos do Notion com conteúdo suficiente para gerar questões.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
