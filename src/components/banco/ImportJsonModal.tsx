"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileJson, Upload, CheckCircle2, AlertCircle, Loader2,
  Sparkles, Copy, Check, FileText, FolderTree, AlertTriangle,
  Info,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import { resolverCaminhoOrg } from "@/lib/questionService";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** Estrutura do JSON de entrada (formato oficial v2) */
interface QuestaoInput {
  PROVA: string;
  Ano?: number;
  Ordem?: number;
  Banca?: string;
  ID_Qconcursos?: string;
  link?: string;
  Dificuldade?: string;
  Status?: string;
  Duvida?: boolean;
  Caminho_Organizacao?: string[];
  "Texto de apoio"?: string;
  Enunciado: string;
  "Pergunta problema"?: string;
  Imagens_Enunciado?: string[];
  "Alternativa A"?: string;
  "Alternativa B"?: string;
  "Alternativa C"?: string;
  "Alternativa D"?: string;
  "Alternativa E"?: string;
  Gabarito?: string;
  "Comentário"?: string;
}

/** Resultado da análise de cada questão antes de importar */
interface QuestaoAnalisada {
  input: QuestaoInput;
  erros: string[];
  avisos: string[];
  status: "nova" | "duplicata" | "erro";
  duplicataId?: number;   // id da questão existente com mesmo ID_Qconcursos
}

/** Resultado geral da análise do lote */
interface Analise {
  questoes: QuestaoAnalisada[];
  totalNova: number;
  totalDuplicata: number;
  totalErro: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_VALIDOS = ["Ativa", "Arquivada", "Anulada", "Inativa"];
const DIFICULDADES_VALIDAS = ["Fácil", "Média", "Difícil"];

function validarQuestao(q: QuestaoInput): string[] {
  const erros: string[] = [];
  if (!q.PROVA?.trim())      erros.push('Campo "PROVA" é obrigatório.');
  if (!q.Enunciado?.trim())  erros.push('Campo "Enunciado" é obrigatório.');
  if (q.Status && !STATUS_VALIDOS.includes(q.Status))
    erros.push(`Status "${q.Status}" inválido. Use: ${STATUS_VALIDOS.join(", ")}.`);
  if (q.Dificuldade && !DIFICULDADES_VALIDAS.includes(q.Dificuldade))
    erros.push(`Dificuldade "${q.Dificuldade}" inválida. Use: ${DIFICULDADES_VALIDAS.join(", ")}.`);
  if (q.Gabarito && !/^[A-Ea-e]$/.test(q.Gabarito.trim()))
    erros.push(`Gabarito "${q.Gabarito}" inválido. Use A, B, C, D ou E.`);
  return erros;
}

function avisoQuestao(q: QuestaoInput): string[] {
  const avisos: string[] = [];
  if (!q.Gabarito)               avisos.push("Gabarito ausente.");
  if (!q["Alternativa A"])       avisos.push("Sem alternativas (questão discursiva?).");
  if (!q.Caminho_Organizacao?.length) avisos.push("Sem Caminho_Organizacao — ficará sem pasta.");
  return avisos;
}

/** Normaliza o JSON de entrada para o formato oficial */
function normalizarInput(item: any): QuestaoInput {
  const enunciado = (item.Enunciado || item.enunciado || item.texto || "").trim();

  // Preserva o texto original de "Pergunta problema", sem resumir ou modificar
  let perguntaProblema: string | undefined = undefined;
  if (item["Pergunta problema"] !== undefined && item["Pergunta problema"] !== null) {
    perguntaProblema = String(item["Pergunta problema"]);
  } else if (item.pergunta_problema !== undefined && item.pergunta_problema !== null) {
    perguntaProblema = String(item.pergunta_problema);
  }

  // Não duplicar o enunciado no campo Pergunta problema
  if (perguntaProblema && perguntaProblema.trim() === enunciado) {
    perguntaProblema = "";
  }

  // Campo link em minúsculas com URL completa (sem inventar URL)
  let link: string | undefined = undefined;
  if (item.link !== undefined && item.link !== null) {
    link = String(item.link).trim();
  }

  return {
    PROVA:         (item.PROVA || item.prova || "Importado").trim(),
    Ano:           item.Ano !== undefined && item.Ano !== null && item.Ano !== "" ? Number(item.Ano) : undefined,
    Ordem:         item.Ordem !== undefined && item.Ordem !== null && item.Ordem !== "" ? Number(item.Ordem) : undefined,
    Banca:         item.Banca  || item.banca  || undefined,
    ID_Qconcursos: item.ID_Qconcursos ? String(item.ID_Qconcursos).trim() : undefined,
    link,
    Dificuldade:   item.Dificuldade || item.dificuldade || undefined,
    Status:        item.Status  || item.status  || "Ativa",
    Duvida:        Boolean(item.Duvida ?? item.duvida ?? false),
    Caminho_Organizacao: Array.isArray(item.Caminho_Organizacao)
      ? item.Caminho_Organizacao.map((s: any) => String(s).trim()).filter(Boolean)
      : undefined,
    "Texto de apoio":    item["Texto de apoio"] !== undefined ? String(item["Texto de apoio"]) : (item.texto_apoio !== undefined ? String(item.texto_apoio) : undefined),
    Enunciado:           enunciado,
    "Pergunta problema": perguntaProblema,
    Imagens_Enunciado:   Array.isArray(item.Imagens_Enunciado)
      ? item.Imagens_Enunciado.filter(Boolean)
      : item.Imagem_Enunciado ? [item.Imagem_Enunciado] : [],
    "Alternativa A": item["Alternativa A"] || item.alternativa_a || undefined,
    "Alternativa B": item["Alternativa B"] || item.alternativa_b || undefined,
    "Alternativa C": item["Alternativa C"] || item.alternativa_c || undefined,
    "Alternativa D": item["Alternativa D"] || item.alternativa_d || undefined,
    "Alternativa E": item["Alternativa E"] || item.alternativa_e || undefined,
    Gabarito:  item.Gabarito  ? String(item.Gabarito).trim().toUpperCase() : undefined,
    "Comentário": item["Comentário"] || item.comentario || item.explicacao || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt atualizado para IA
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PROMPT = `Gere uma lista de questões no formato JSON oficial abaixo.

[
  {
    "PROVA": "Concurso Câmara de São Gonçalo - RJ - Assistente Técnico Legislativo",
    "Ano": 2022,
    "Ordem": 1,
    "Banca": "SELECON",
    "ID_Qconcursos": "Q2408218",
    "link": "https://www.qconcursos.com/questoes-de-concursos/questoes/eea8383ca35",
    "Dificuldade": "Média",
    "Status": "Ativa",
    "Duvida": false,
    "Caminho_Organizacao": [
      "Conhecimentos Bancários",
      "Sistema Financeiro Nacional",
      "ESTRUTURA DO SFN"
    ],
    "Texto de apoio": "",
    "Enunciado": "Nos conceitos básicos de administração financeira, o Sistema Financeiro Nacional é dividido em dois subsistemas: normativo e operacional.",
    "Pergunta problema": "Fazem parte do subsistema normativo e do subsistema operacional, respectivamente:",
    "Imagens_Enunciado": [],
    "Alternativa A": "bancos comerciais e bancos múltiplos",
    "Alternativa B": "BNDES e Conselho Monetário Nacional",
    "Alternativa C": "Banco Central do Brasil e Caixa Econômica Federal",
    "Alternativa D": "bancos de desenvolvimento e Comissão de Valores Mobiliários",
    "Alternativa E": "",
    "Gabarito": "C",
    "Comentário": "Explicação da resposta correta."
  }
]

Regras:
- Status deve ser: Ativa, Arquivada, Anulada ou Inativa.
- Dificuldade pode ser: Fácil, Média, Difícil ou vazia ("").
- Gabarito deve ser uma única letra: A, B, C, D ou E (opcional para discursivas).
- Caminho_Organizacao é uma lista hierárquica de pastas do geral para o específico.
- link: URL completa da questão (em minúsculas).
- Pergunta problema: pergunta específica complementar (não duplicar o enunciado).
- id não deve ser incluído (gerado pelo banco).`;

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export function ImportJsonModal({ isOpen, onClose, onSuccess }: ImportJsonModalProps) {
  const [jsonText,       setJsonText]       = useState("");
  const [analise,        setAnalise]        = useState<Analise | null>(null);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [isAnalyzing,    setIsAnalyzing]    = useState(false);
  const [isImporting,    setIsImporting]    = useState(false);
  const [progress,       setProgress]       = useState<{ current: number; total: number } | null>(null);
  const [successCount,   setSuccessCount]   = useState<number | null>(null);
  const [copiedPrompt,   setCopiedPrompt]   = useState(false);
  const [overrideProva,  setOverrideProva]  = useState("");

  const copyPrompt = () => {
    navigator.clipboard.writeText(SAMPLE_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // ── FASE 1: Parse + validação local + detecção de duplicatas ──────────────
  const handleAnalisar = useCallback(async () => {
    setErrorMsg("");
    setAnalise(null);
    setSuccessCount(null);

    let raw: any[];
    try {
      const parsed = JSON.parse(jsonText);
      raw = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e: any) {
      setErrorMsg("JSON inválido: " + e.message);
      return;
    }

    if (raw.length === 0) { setErrorMsg("O JSON está vazio."); return; }
    setIsAnalyzing(true);

    try {
      const inputs: QuestaoInput[] = raw.map(normalizarInput);

      // Coletar IDs_Qconcursos para checar duplicatas em lote
      const idsQc = inputs
        .map(q => q.ID_Qconcursos)
        .filter((v): v is string => Boolean(v));

      let duplicatasMap = new Map<string, number>(); // ID_Qconcursos → questoes.id
      if (idsQc.length > 0) {
        const { data: existing } = await supabasePublic
          .from("questoes")
          .select("id, \"ID_Qconcursos\"")
          .in("\"ID_Qconcursos\"", idsQc);
        for (const row of existing ?? []) {
          if (row["ID_Qconcursos"]) duplicatasMap.set(String(row["ID_Qconcursos"]), row.id);
        }
      }

      // Analisar cada questão
      const questoesAnalisadas: QuestaoAnalisada[] = inputs.map(q => {
        const erros  = validarQuestao(q);
        const avisos = avisoQuestao(q);
        const isDup  = q.ID_Qconcursos ? duplicatasMap.has(q.ID_Qconcursos) : false;
        return {
          input: q,
          erros,
          avisos,
          status: erros.length > 0 ? "erro" : isDup ? "duplicata" : "nova",
          duplicataId: isDup ? duplicatasMap.get(q.ID_Qconcursos!) : undefined,
        };
      });

      setAnalise({
        questoes:       questoesAnalisadas,
        totalNova:      questoesAnalisadas.filter(q => q.status === "nova").length,
        totalDuplicata: questoesAnalisadas.filter(q => q.status === "duplicata").length,
        totalErro:      questoesAnalisadas.filter(q => q.status === "erro").length,
      });
    } catch (e: any) {
      setErrorMsg("Erro durante a análise: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [jsonText]);

  // ── FASE 2: Importação efetiva (apenas questões novas) ────────────────────
  const handleImportar = useCallback(async () => {
    if (!analise) return;
    const paraImportar = analise.questoes.filter(q => q.status === "nova");
    if (paraImportar.length === 0) return;

    setIsImporting(true);
    setErrorMsg("");
    setProgress({ current: 0, total: paraImportar.length });

    const orgCache = new Map<string, string>();
    let insertedTotal = 0;

    try {
      for (const { input: q } of paraImportar) {
        // Resolve a pasta com proteção contra falhas de RLS
        let orgId: string | null = null;
        try {
          if (q.Caminho_Organizacao && q.Caminho_Organizacao.length > 0) {
            orgId = await resolverCaminhoOrg(q.Caminho_Organizacao, orgCache);
          }
        } catch (orgErr: any) {
          console.warn("Aviso ao resolver pasta da questão:", orgErr?.message || orgErr);
        }

        // Monta o registro preservando tipos e valores originais
        const row: Record<string, any> = {
          PROVA:               overrideProva.trim() || q.PROVA,
          Ano:                 q.Ano               ?? null,
          Ordem:               q.Ordem             ?? null,
          Banca:               q.Banca             ?? null,
          ID_Qconcursos:       q.ID_Qconcursos     ?? null,
          link:                q.link              !== undefined ? q.link : null,
          Dificuldade:         q.Dificuldade       ? q.Dificuldade : null,
          Status:              q.Status            ?? "Ativa",
          "Texto de apoio":    q["Texto de apoio"] ?? null,
          Enunciado:           q.Enunciado,
          "Pergunta problema": q["Pergunta problema"] !== undefined ? q["Pergunta problema"] : null,
          // Primeira imagem em Imagem_Enunciado (compatibilidade com coluna TEXT atual)
          Imagem_Enunciado:    q.Imagens_Enunciado?.[0] ?? null,
          "Alternativa A":     q["Alternativa A"]  ?? null,
          "Alternativa B":     q["Alternativa B"]  ?? null,
          "Alternativa C":     q["Alternativa C"]  ?? null,
          "Alternativa D":     q["Alternativa D"]  ?? null,
          "Alternativa E":     q["Alternativa E"]  ?? null,
          Gabarito:            q.Gabarito          ?? null,
          "Comentário":        q["Comentário"]      ?? null,
          Duvida:              q.Duvida            ?? false,
          Materia:             q.Caminho_Organizacao?.[0] || q.Banca || "Geral",
          organizacao_id:      orgId,
        };

        let insertRes = await supabasePublic.from("questoes").insert(row);
        if (insertRes.error) {
          // Fallback para cliente com sessão de auth se o público falhar
          const { supabase } = await import("@/lib/supabase");
          insertRes = await supabase.from("questoes").insert(row);
        }

        if (insertRes.error) {
          throw new Error(`Questão "${q.Enunciado.slice(0, 40)}...": ${insertRes.error.message}`);
        }

        insertedTotal++;
        setProgress({ current: insertedTotal, total: paraImportar.length });
      }

      setSuccessCount(insertedTotal);
      setJsonText("");
      setAnalise(null);
      onSuccess();
    } catch (e: any) {
      setErrorMsg(e.message || "Erro durante a importação.");
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  }, [analise, overrideProva, onSuccess]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const c = evt.target?.result as string;
      if (c) { setJsonText(c); setAnalise(null); setErrorMsg(""); setSuccessCount(null); }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const podeImportar = analise && analise.totalNova > 0 && !isImporting;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-4xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8"
        >
          {/* ── Header ── */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileJson size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Importar Questões via JSON
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Admin</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Valida, detecta duplicatas e organiza hierarquicamente antes de salvar.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

            {/* Prompt banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-blue-200">Precisa do modelo para a IA?</h4>
                  <p className="text-[11px] text-slate-400">Formato oficial com Caminho_Organizacao, Ano e Imagens_Enunciado.</p>
                </div>
              </div>
              <button onClick={copyPrompt} className="shrink-0 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-xs font-bold text-blue-200 flex items-center gap-1.5 transition-all">
                {copiedPrompt ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedPrompt ? "Copiado!" : "Copiar Prompt"}
              </button>
            </div>

            {/* Override PROVA + Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sobrescrever PROVA (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Simulado 01 — BB 2026"
                  value={overrideProva}
                  onChange={e => setOverrideProva(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Arquivo JSON</label>
                <label className="w-full px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-slate-300 cursor-pointer flex items-center justify-center gap-2 transition-all">
                  <Upload size={14} className="text-blue-400" />
                  <span>Escolher arquivo .json</span>
                  <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Cole o JSON abaixo:</label>
                {jsonText.trim() && !analise && (
                  <span className="text-[11px] text-slate-400">Clique em "Analisar" para validar</span>
                )}
              </div>
              <textarea
                rows={7}
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setAnalise(null); setErrorMsg(""); setSuccessCount(null); }}
                placeholder={'[\n  {\n    "PROVA": "BB 2023",\n    "Enunciado": "...",\n    "Caminho_Organizacao": ["Matemática", "Juros"],\n    "Gabarito": "A"\n  }\n]'}
                className="w-full p-3 bg-[#090D16] border border-white/10 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 custom-scrollbar"
              />
            </div>

            {/* ── PAINEL DE ANÁLISE ── */}
            <AnimatePresence>
              {analise && (
                <motion.div
                  key="analise"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Resumo do lote */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                      <p className="text-2xl font-black text-emerald-400">{analise.totalNova}</p>
                      <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Novas</p>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${analise.totalDuplicata > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                      <p className={`text-2xl font-black ${analise.totalDuplicata > 0 ? "text-amber-400" : "text-slate-500"}`}>{analise.totalDuplicata}</p>
                      <p className="text-[10px] text-amber-300/70 font-semibold uppercase tracking-wider">Duplicatas</p>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${analise.totalErro > 0 ? "border-rose-500/20 bg-rose-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                      <p className={`text-2xl font-black ${analise.totalErro > 0 ? "text-rose-400" : "text-slate-500"}`}>{analise.totalErro}</p>
                      <p className="text-[10px] text-rose-300/70 font-semibold uppercase tracking-wider">Com Erro</p>
                    </div>
                  </div>

                  {/* Lista de questões */}
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {analise.questoes.map((qa, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          qa.status === "erro"       ? "border-rose-500/25 bg-rose-500/5" :
                          qa.status === "duplicata"  ? "border-amber-500/25 bg-amber-500/5" :
                                                       "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        {/* Cabeçalho */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {qa.status === "nova"       && <CheckCircle2  size={13} className="text-emerald-400 shrink-0" />}
                            {qa.status === "duplicata"  && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                            {qa.status === "erro"       && <AlertCircle   size={13} className="text-rose-400 shrink-0" />}
                            <span className="font-semibold text-slate-200 truncate">
                              Q{idx + 1} — {qa.input.Enunciado.slice(0, 60)}{qa.input.Enunciado.length > 60 ? "…" : ""}
                            </span>
                          </div>
                          <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            qa.status === "nova"      ? "bg-emerald-500/20 text-emerald-300" :
                            qa.status === "duplicata" ? "bg-amber-500/20 text-amber-300"     :
                                                        "bg-rose-500/20 text-rose-300"
                          }`}>
                            {qa.status === "nova"       ? "Nova"      :
                             qa.status === "duplicata"  ? `Duplicata (id=${qa.duplicataId})` : "Erro"}
                          </span>
                        </div>

                        {/* Caminho */}
                        {qa.input.Caminho_Organizacao?.length ? (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <FolderTree size={11} className="text-blue-400 shrink-0" />
                            {qa.input.Caminho_Organizacao.join(" › ")}
                          </div>
                        ) : null}

                        {/* Pergunta problema */}
                        {qa.input["Pergunta problema"] ? (
                          <div className="text-[10px] text-indigo-300/90 italic pl-2 border-l border-indigo-500/40">
                            {qa.input["Pergunta problema"]}
                          </div>
                        ) : null}

                        {/* Link */}
                        {qa.input.link ? (
                          <div className="text-[10px] text-slate-400 truncate font-mono">
                            🔗 {qa.input.link}
                          </div>
                        ) : null}

                        {/* Erros */}
                        {qa.erros.map((e, i) => (
                          <p key={i} className="text-[10px] text-rose-300 flex items-center gap-1">
                            <AlertCircle size={10} /> {e}
                          </p>
                        ))}

                        {/* Avisos */}
                        {qa.avisos.map((a, i) => (
                          <p key={i} className="text-[10px] text-amber-300/80 flex items-center gap-1">
                            <Info size={10} /> {a}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Info sobre duplicatas */}
                  {analise.totalDuplicata > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-[11px] flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>{analise.totalDuplicata} questão(ões)</strong> já existem no banco (mesmo ID_Qconcursos) e <strong>não serão sobrescritas</strong>. Apenas as {analise.totalNova} novas serão importadas.
                      </span>
                    </div>
                  )}

                  {analise.totalErro > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-[11px] flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                      <span>
                        <strong>{analise.totalErro} questão(ões)</strong> com erros de validação <strong>não serão importadas</strong>. Corrija o JSON e analise novamente.
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Erros gerais */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Sucesso */}
            {successCount !== null && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                <div>
                  <p className="font-bold text-sm">Importação concluída!</p>
                  <p>{successCount} questão(ões) inserida(s) e organizadas na hierarquia.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {progress ? (
                <span className="flex items-center gap-2 text-blue-400 font-bold">
                  <Loader2 size={14} className="animate-spin" />
                  Importando {progress.current} de {progress.total}...
                </span>
              ) : analise ? (
                <span>
                  {analise.totalNova} novas · {analise.totalDuplicata} ignoradas · {analise.totalErro} com erro
                </span>
              ) : (
                <span className="text-slate-500">Cole o JSON e clique em Analisar.</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>

              {/* Botão Analisar — sempre visível quando há JSON e ainda não analisou */}
              {!analise && (
                <button
                  onClick={handleAnalisar}
                  disabled={!jsonText.trim() || isAnalyzing}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  {isAnalyzing ? "Analisando..." : "Analisar JSON"}
                </button>
              )}

              {/* Re-analisar */}
              {analise && !isImporting && (
                <button
                  onClick={handleAnalisar}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <FileText size={13} /> Re-analisar
                </button>
              )}

              {/* Confirmar Importação */}
              {analise && (
                <button
                  onClick={handleImportar}
                  disabled={!podeImportar}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {isImporting ? "Importando..." : `Confirmar (${analise.totalNova} novas)`}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
