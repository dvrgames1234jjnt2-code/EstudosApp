"use client";

import React, { useState, useCallback } from "react";
import {
  X, FileJson, Upload, CheckCircle2, AlertCircle, Loader2,
  Sparkles, Copy, Check, FileText, FolderTree, AlertTriangle,
  Info, Database,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import {
  resolverCaminhoOrg,
  normalizeDifficultyLabel,
  CADERNO_ERROS_SQL_MIGRATION,
} from "@/lib/questionService";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** Estrutura do JSON de entrada (novo padrão Caderno de Erros + retrocompatível) */
interface QuestaoInput {
  Prova: string;
  Ano?: string;
  Ordem?: number;
  Banca?: string;
  Disciplina?: string;
  Caminho_Organizacao?: string[];
  Idq?: string;
  Idg?: string;
  Idtec?: string;
  link?: string;
  Dificuldade?: string;
  Status?: string;
  Duvida?: boolean;
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

interface QuestaoAnalisada {
  input: QuestaoInput;
  erros: string[];
  avisos: string[];
  status: "nova" | "duplicata" | "erro";
  duplicataMotivo?: string;
}

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
const DIFICULDADES_VALIDAS = ["Fácil", "Média", "Difícil", "Ultrahard"];

function parseOrganizacaoPath(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const arr = raw.map((s) => String(s ?? "").trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (typeof raw === "string") {
    const cleaned = raw.trim();
    if (!cleaned) return undefined;
    // Separa por >, →, ->, |, ; ou " / " (com espaços para preservar nomes como PIS/PASEP)
    const parts = cleaned
      .split(/\s*(?:>|→|->|\||;)\s*|\s+\/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }
  return undefined;
}

function pickField(item: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return undefined;
}

function validarQuestao(q: QuestaoInput): string[] {
  const erros: string[] = [];
  if (!q.Prova?.trim()) erros.push('Campo "Prova" é obrigatório.');
  if (q.Status && !STATUS_VALIDOS.includes(q.Status)) {
    erros.push(`Status "${q.Status}" inválido. Use: ${STATUS_VALIDOS.join(", ")}.`);
  }
  if (q.Dificuldade && !DIFICULDADES_VALIDAS.includes(q.Dificuldade)) {
    erros.push(`Dificuldade "${q.Dificuldade}" inválida. Use: ${DIFICULDADES_VALIDAS.join(", ")}.`);
  }
  if (q.Gabarito && !/^[A-Ea-e]$/.test(q.Gabarito.trim())) {
    erros.push(`Gabarito "${q.Gabarito}" inválido. Use A, B, C, D ou E.`);
  }
  return erros;
}

function avisoQuestao(q: QuestaoInput): string[] {
  const avisos: string[] = [];
  if (!q.Enunciado?.trim() && !q["Pergunta problema"]?.trim() && !q["Texto de apoio"]?.trim() && !q.Imagens_Enunciado?.length) {
    avisos.push("Sem texto de apoio, enunciado, pergunta problema ou imagem.");
  }
  if (!q.Gabarito) avisos.push("Gabarito ausente.");
  if (!q["Alternativa A"]) avisos.push("Sem alternativas.");
  if (!q.Caminho_Organizacao?.length) avisos.push('Sem "Organização nó" — ficará sem pasta.');
  return avisos;
}

function normalizarInput(item: Record<string, any>): QuestaoInput {
  const rawEnunciado = pickField(item, ["Enunciado", "enunciado", "texto"]);
  const enunciado = rawEnunciado !== undefined ? String(rawEnunciado).trim() : "";

  const rawPergunta = pickField(item, ["Pergunta problema", "pergunta problema", "pergunta_problema", "perguntaProblema"]);
  let perguntaProblema = rawPergunta !== undefined ? String(rawPergunta).trim() : undefined;
  if (perguntaProblema && perguntaProblema === enunciado) {
    perguntaProblema = "";
  }

  const rawProva = pickField(item, ["Prova", "PROVA", "prova"]);
  const rawAno = pickField(item, ["Ano", "ano", "Data", "data"]);
  const rawOrdem = pickField(item, ["Ordem", "ordem"]);
  const rawBanca = pickField(item, ["Banca", "banca"]);
  const rawDisciplina = pickField(item, ["Disciplina", "disciplina", "Materia", "materia"]);
  const rawOrg = pickField(item, [
    "Organização nó",
    "Organizacao no",
    "Organização Nó",
    "Organizacao Nó",
    "organizacao_no",
    "Caminho_Organizacao",
    "caminho_organizacao",
  ]);
  const rawIdq = pickField(item, ["Idq", "idq", "ID_Qconcursos", "id_qconcursos"]);
  const rawIdg = pickField(item, ["Idg", "idg", "ID_Gran", "id_gran"]);
  const rawIdtec = pickField(item, ["Idtec", "idtec", "ID_TEC", "id_tec"]);
  const rawDificuldade = pickField(item, ["Dificuldade", "dificuldade"]);
  const rawTextoApoio = pickField(item, ["Texto de apoio", "texto de apoio", "texto_apoio"]);
  const rawLink = pickField(item, ["link", "Link"]);
  const rawComentario = pickField(item, ["Comentário", "Comentario", "comentario", "explicacao"]);
  const rawGabarito = pickField(item, ["Gabarito", "gabarito"]);

  const orgPath = parseOrganizacaoPath(rawOrg);
  const parsedOrdem = rawOrdem !== undefined && String(rawOrdem).trim() !== "" && !Number.isNaN(Number(rawOrdem))
    ? Number(rawOrdem)
    : undefined;

  return {
    Prova: rawProva ? String(rawProva).trim() : "Importado",
    Ano: rawAno !== undefined && String(rawAno).trim() !== "" ? String(rawAno).trim() : undefined,
    Ordem: parsedOrdem,
    Banca: rawBanca ? String(rawBanca).trim() : undefined,
    Disciplina: rawDisciplina ? String(rawDisciplina).trim() : orgPath?.[0] || undefined,
    Caminho_Organizacao: orgPath,
    Idq: rawIdq ? String(rawIdq).trim() : undefined,
    Idg: rawIdg ? String(rawIdg).trim() : undefined,
    Idtec: rawIdtec ? String(rawIdtec).trim() : undefined,
    link: rawLink ? String(rawLink).trim() : undefined,
    Dificuldade: normalizeDifficultyLabel(rawDificuldade),
    Status: item.Status || item.status || "Ativa",
    Duvida: Boolean(item.Duvida ?? item.duvida ?? false),
    "Texto de apoio": rawTextoApoio !== undefined && String(rawTextoApoio).trim() !== "" ? String(rawTextoApoio) : undefined,
    Enunciado: enunciado,
    "Pergunta problema": perguntaProblema && perguntaProblema !== "" ? perguntaProblema : undefined,
    Imagens_Enunciado: Array.isArray(item.Imagens_Enunciado)
      ? item.Imagens_Enunciado.filter(Boolean)
      : item.Imagem_Enunciado
      ? [item.Imagem_Enunciado]
      : [],
    "Alternativa A": item["Alternativa A"] ?? item.alternativa_a ?? undefined,
    "Alternativa B": item["Alternativa B"] ?? item.alternativa_b ?? undefined,
    "Alternativa C": item["Alternativa C"] ?? item.alternativa_c ?? undefined,
    "Alternativa D": item["Alternativa D"] ?? item.alternativa_d ?? undefined,
    "Alternativa E": item["Alternativa E"] ?? item.alternativa_e ?? undefined,
    Gabarito: rawGabarito ? String(rawGabarito).trim().toUpperCase() : undefined,
    "Comentário": rawComentario ? String(rawComentario) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt oficial atualizado
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PROMPT = `Gere uma lista de questões no formato JSON oficial abaixo.

[
  {
    "Prova": "BB",
    "Ano": "23/04/2023",
    "Ordem": 1,
    "Banca": "CESGRANRIO",
    "Disciplina": "Conhecimentos Bancários",
    "Organização nó": "Conhecimentos Bancários / Sistema Financeiro Nacional / ESTRUTURA DO SFN",
    "Idq": "Q2408218",
    "Idg": "",
    "Idtec": "",
    "Dificuldade": "Média",
    "Texto de apoio": "",
    "Enunciado": "Nos conceitos básicos de administração financeira, o Sistema Financeiro Nacional é dividido em dois subsistemas: normativo e operacional.",
    "Pergunta problema": "Fazem parte do subsistema normativo e do subsistema operacional, respectivamente:",
    "Alternativa A": "bancos comerciais e bancos múltiplos",
    "Alternativa B": "BNDES e Conselho Monetário Nacional",
    "Alternativa C": "Banco Central do Brasil e Caixa Econômica Federal",
    "Alternativa D": "bancos de desenvolvimento e Comissão de Valores Mobiliários",
    "Alternativa E": "Conselho Monetário Nacional e Banco Central do Brasil",
    "Gabarito": "C"
  }
]

Regras:
- Prova: órgão abreviado (BB, CEF, BNB, IBGE, PETROBRAS...).
- Ano: data de aplicação da prova (ex: "23/04/2023" ou "2023").
- Ordem: número inteiro definindo a ordem em que a questão aparece no caso.
- Banca: banca oficial ou IA geradora (MANUS, CLAUDE, GPT, HYDROGEN, GEMINI FLASH...).
- Organização nó: caminho hierárquico separado por " / " (ou lista ["Matéria", "Caderno", "Caso"]).
- Idq / Idg / Idtec: preencha o ID correspondente (Qconcursos, Gran ou TEC) ou "" se não houver.
- Dificuldade: Fácil, Média, Difícil ou Ultrahard.
- Texto de apoio e Enunciado são opcionais (nem toda questão possui).
- Gabarito: A, B, C, D ou E.`;

export function ImportJsonModal({ isOpen, onClose, onSuccess }: ImportJsonModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [overrideProva, setOverrideProva] = useState("");

  const copyPrompt = () => {
    navigator.clipboard.writeText(SAMPLE_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copySql = () => {
    navigator.clipboard.writeText(CADERNO_ERROS_SQL_MIGRATION);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // ── FASE 1: Parse + validação + detecção de duplicatas (Idq / Idg / Idtec) ──
  const handleAnalisar = useCallback(async () => {
    setErrorMsg("");
    setShowSqlHelper(false);
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

    if (raw.length === 0) {
      setErrorMsg("O JSON está vazio.");
      return;
    }
    setIsAnalyzing(true);

    try {
      const inputs: QuestaoInput[] = raw.map(normalizarInput);

      const idsQc = Array.from(new Set(inputs.map((q) => q.Idq).filter((v): v is string => Boolean(v))));
      const idsGran = Array.from(new Set(inputs.map((q) => q.Idg).filter((v): v is string => Boolean(v))));
      const idsTec = Array.from(new Set(inputs.map((q) => q.Idtec).filter((v): v is string => Boolean(v))));

      const dupQc = new Map<string, number>();
      const dupGran = new Map<string, number>();
      const dupTec = new Map<string, number>();

      if (idsQc.length > 0) {
        const { data: existingIdq, error: idqErr } = await supabasePublic
          .from("questoes")
          .select('id, "Idq"')
          .in('"Idq"', idsQc);
        if (!idqErr && existingIdq) {
          for (const row of existingIdq) {
            if ((row as any).Idq) dupQc.set(String((row as any).Idq), row.id);
          }
        }
        const { data: existingQc, error: qcErr } = await supabasePublic
          .from("questoes")
          .select('id, "ID_Qconcursos"')
          .in('"ID_Qconcursos"', idsQc);
        if (!qcErr && existingQc) {
          for (const row of existingQc) {
            if (row["ID_Qconcursos"]) dupQc.set(String(row["ID_Qconcursos"]), row.id);
          }
        }
      }

      if (idsGran.length > 0) {
        const { data: existingGran, error: granErr } = await supabasePublic
          .from("questoes")
          .select('id, "Idg"')
          .in('"Idg"', idsGran);
        if (!granErr && existingGran) {
          for (const row of existingGran) {
            if ((row as any).Idg) dupGran.set(String((row as any).Idg), row.id);
          }
        }
      }

      if (idsTec.length > 0) {
        const { data: existingTec, error: tecErr } = await supabasePublic
          .from("questoes")
          .select('id, "Idtec"')
          .in('"Idtec"', idsTec);
        if (!tecErr && existingTec) {
          for (const row of existingTec) {
            if ((row as any).Idtec) dupTec.set(String((row as any).Idtec), row.id);
          }
        }
      }

      const questoesAnalisadas: QuestaoAnalisada[] = inputs.map((q) => {
        const erros = validarQuestao(q);
        const avisos = avisoQuestao(q);

        let dupReason: string | undefined;
        if (q.Idq && dupQc.has(q.Idq)) dupReason = `Idq (${q.Idq} → #${dupQc.get(q.Idq)})`;
        else if (q.Idg && dupGran.has(q.Idg)) dupReason = `Idg (${q.Idg} → #${dupGran.get(q.Idg)})`;
        else if (q.Idtec && dupTec.has(q.Idtec)) dupReason = `Idtec (${q.Idtec} → #${dupTec.get(q.Idtec)})`;

        return {
          input: q,
          erros,
          avisos,
          status: erros.length > 0 ? "erro" : dupReason ? "duplicata" : "nova",
          duplicataMotivo: dupReason,
        };
      });

      setAnalise({
        questoes: questoesAnalisadas,
        totalNova: questoesAnalisadas.filter((q) => q.status === "nova").length,
        totalDuplicata: questoesAnalisadas.filter((q) => q.status === "duplicata").length,
        totalErro: questoesAnalisadas.filter((q) => q.status === "erro").length,
      });
    } catch (e: any) {
      setErrorMsg("Erro durante a análise: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [jsonText]);

  // ── FASE 2: Importação efetiva ────────────────────────────────────────────
  const handleImportar = useCallback(async () => {
    if (!analise) return;
    const paraImportar = analise.questoes.filter((q) => q.status === "nova");
    if (paraImportar.length === 0) return;

    setIsImporting(true);
    setErrorMsg("");
    setShowSqlHelper(false);
    setProgress({ current: 0, total: paraImportar.length });

    const orgCache = new Map<string, string>();
    let insertedTotal = 0;

    try {
      const { supabase } = await import("@/lib/supabase");

      for (const { input: q } of paraImportar) {
        let orgId: string | null = null;
        try {
          if (q.Caminho_Organizacao && q.Caminho_Organizacao.length > 0) {
            orgId = await resolverCaminhoOrg(q.Caminho_Organizacao, orgCache);
          }
        } catch (orgErr: any) {
          console.warn("Aviso ao resolver pasta da questão:", orgErr?.message || orgErr);
        }

        const disciplinaFinal = q.Disciplina || q.Caminho_Organizacao?.[0] || q.Banca || "Geral";

        const fullRow: Record<string, any> = {
          PROVA: overrideProva.trim() || q.Prova,
          Ano: q.Ano ?? null,
          Ordem: q.Ordem ?? null,
          Banca: q.Banca ?? null,
          Disciplina: disciplinaFinal,
          Materia: disciplinaFinal,
          ID_Qconcursos: q.Idq ?? null,
          Idq: q.Idq ?? null,
          Idg: q.Idg ?? null,
          Idtec: q.Idtec ?? null,
          link: q.link !== undefined ? q.link : null,
          Dificuldade: q.Dificuldade ? q.Dificuldade : null,
          Status: q.Status ?? "Ativa",
          "Texto de apoio": q["Texto de apoio"] ?? null,
          Enunciado: q.Enunciado || "",
          "Pergunta problema": q["Pergunta problema"] !== undefined ? q["Pergunta problema"] : null,
          Imagem_Enunciado: q.Imagens_Enunciado?.[0] ?? null,
          "Alternativa A": q["Alternativa A"] ?? null,
          "Alternativa B": itemOrNull(q["Alternativa B"]),
          "Alternativa C": itemOrNull(q["Alternativa C"]),
          "Alternativa D": itemOrNull(q["Alternativa D"]),
          "Alternativa E": itemOrNull(q["Alternativa E"]),
          Gabarito: q.Gabarito ?? null,
          "Comentário": q["Comentário"] ?? null,
          organizacao_id: orgId,
        };

        let insertRes = await supabasePublic.from("questoes").insert(fullRow);
        if (insertRes.error) {
          insertRes = await supabase.from("questoes").insert(fullRow);
        }

        if (insertRes.error) {
          const msg = insertRes.error.message || "";
          const missingCols = /column|schema cache|Idg|Idtec|Idq|ID_Qconcursos|Disciplina/i.test(msg);
          const anoTypeErr = /invalid input syntax for type integer/i.test(msg);

          if ((missingCols || anoTypeErr) && !q.Idg && !q.Idtec) {
            // Fallback seguro caso não tenha Idg/Idtec e alguma coluna opcional ainda não exista
            const fallbackRow = { ...fullRow };
            if (/Idq/i.test(msg)) delete fallbackRow.Idq;
            if (/ID_Qconcursos/i.test(msg)) delete fallbackRow.ID_Qconcursos;
            if (/Idg/i.test(msg)) delete fallbackRow.Idg;
            if (/Idtec/i.test(msg)) delete fallbackRow.Idtec;
            if (anoTypeErr && typeof fallbackRow.Ano === "string") {
              const yrMatch = fallbackRow.Ano.match(/\b(19|20)\d{2}\b/);
              fallbackRow.Ano = yrMatch ? Number(yrMatch[0]) : null;
            }
            if (/Disciplina/i.test(msg)) delete fallbackRow.Disciplina;
            let retry = await supabasePublic.from("questoes").insert(fallbackRow);
            if (retry.error) retry = await supabase.from("questoes").insert(fallbackRow);
            if (!retry.error) {
              insertedTotal++;
              setProgress({ current: insertedTotal, total: paraImportar.length });
              continue;
            }
          }

          if (missingCols || anoTypeErr) {
            setShowSqlHelper(true);
            throw new Error(
              `O banco Supabase precisa das novas colunas (Idq, Idg, Idtec, Ano em texto). Clique em "Copiar SQL" abaixo e execute no SQL Editor do Supabase. Detalhe: ${msg}`
            );
          }

          const preview = (q.Enunciado || q["Pergunta problema"] || q.Prova).slice(0, 40);
          throw new Error(`Questão "${preview}...": ${msg}`);
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
      if (c) {
        setJsonText(c);
        setAnalise(null);
        setErrorMsg("");
        setSuccessCount(null);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const podeImportar = analise && analise.totalNova > 0 && !isImporting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2.5 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0F172A] border border-white/10 rounded-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileJson size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                Importar Questões via JSON
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                  Admin
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Suporta Prova, Ano, Ordem, Banca, Disciplina, Organização nó, Idq/Idg/Idtec, Texto de apoio, Enunciado e Pergunta problema.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Prompt banner */}
          <div className="bg-[#111b33] border border-blue-500/20 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-blue-200">Modelo oficial do novo JSON</h4>
                <p className="text-[11px] text-slate-400">
                  Com Ordem, Banca, Organização nó, Idq/Idg/Idtec, Texto de apoio, Enunciado e Pergunta problema.
                </p>
              </div>
            </div>
            <button
              onClick={copyPrompt}
              className="shrink-0 w-full sm:w-auto justify-center px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-xs font-bold text-blue-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedPrompt ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedPrompt ? "Copiado!" : "Copiar Modelo"}
            </button>
          </div>

          {/* Override PROVA + Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sobrescrever Prova (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: BB, CEF, BNB..."
                value={overrideProva}
                onChange={(e) => setOverrideProva(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Arquivo JSON</label>
              <label className="w-full px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-slate-300 cursor-pointer flex items-center justify-center gap-2 transition-colors">
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
                <span className="text-[11px] text-slate-400">Clique em &ldquo;Analisar JSON&rdquo; para validar</span>
              )}
            </div>
            <textarea
              rows={7}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setAnalise(null);
                setErrorMsg("");
                setSuccessCount(null);
              }}
              placeholder={'[\n  {\n    "Prova": "BB",\n    "Ano": "23/04/2023",\n    "Ordem": 1,\n    "Banca": "CESGRANRIO",\n    "Disciplina": "Matemática",\n    "Organização nó": "Matemática / Juros / Caso 1",\n    "Idq": "Q2408218",\n    "Idg": "",\n    "Idtec": "",\n    "Dificuldade": "Média",\n    "Texto de apoio": "",\n    "Enunciado": "Contexto da questão (opcional)...",\n    "Pergunta problema": "O que de fato pergunta...",\n    "Alternativa A": "...",\n    "Gabarito": "A"\n  }\n]'}
              className="w-full p-3 bg-[#090D16] border border-white/10 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 custom-scrollbar"
            />
          </div>

          {/* PAINEL DE ANÁLISE */}
          {analise && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 sm:p-3 text-center">
                  <p className="text-xl sm:text-2xl font-black text-emerald-400">{analise.totalNova}</p>
                  <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Novas</p>
                </div>
                <div className={`rounded-xl border p-2.5 sm:p-3 text-center ${analise.totalDuplicata > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                  <p className={`text-xl sm:text-2xl font-black ${analise.totalDuplicata > 0 ? "text-amber-400" : "text-slate-500"}`}>{analise.totalDuplicata}</p>
                  <p className="text-[10px] text-amber-300/70 font-semibold uppercase tracking-wider">Duplicatas</p>
                </div>
                <div className={`rounded-xl border p-2.5 sm:p-3 text-center ${analise.totalErro > 0 ? "border-rose-500/20 bg-rose-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                  <p className={`text-xl sm:text-2xl font-black ${analise.totalErro > 0 ? "text-rose-400" : "text-slate-500"}`}>{analise.totalErro}</p>
                  <p className="text-[10px] text-rose-300/70 font-semibold uppercase tracking-wider">Com Erro</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {analise.questoes.map((qa, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      qa.status === "erro"
                        ? "border-rose-500/25 bg-rose-500/5"
                        : qa.status === "duplicata"
                        ? "border-amber-500/25 bg-amber-500/5"
                        : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {qa.status === "nova" && <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />}
                        {qa.status === "duplicata" && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                        {qa.status === "erro" && <AlertCircle size={13} className="text-rose-400 shrink-0" />}

                        {qa.input.Ordem !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 shrink-0">
                            #{qa.input.Ordem}
                          </span>
                        )}
                        <span className="font-semibold text-slate-200 truncate">
                          {qa.input.Prova}
                          {qa.input.Ano ? ` • ${qa.input.Ano}` : ""}
                          {qa.input.Banca ? ` • ${qa.input.Banca}` : ""}
                        </span>
                        {qa.input.Idq && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            QC: {qa.input.Idq}
                          </span>
                        )}
                        {qa.input.Idg && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                            Gran: {qa.input.Idg}
                          </span>
                        )}
                        {qa.input.Idtec && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
                            TEC: {qa.input.Idtec}
                          </span>
                        )}
                      </div>

                      <span
                        className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                          qa.status === "nova"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : qa.status === "duplicata"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {qa.status === "nova" ? "Nova" : qa.status === "duplicata" ? `Duplicata` : "Erro"}
                      </span>
                    </div>

                    {qa.duplicataMotivo && (
                      <div className="text-[10px] text-amber-300/90">Já existe no banco: {qa.duplicataMotivo}</div>
                    )}

                    {qa.input.Caminho_Organizacao?.length ? (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <FolderTree size={11} className="text-blue-400 shrink-0" />
                        <span className="truncate">{qa.input.Caminho_Organizacao.join(" › ")}</span>
                      </div>
                    ) : null}

                    {qa.input["Texto de apoio"] && (
                      <div className="text-[10.5px] text-blue-200/80 pl-2 border-l border-blue-500/40 line-clamp-1">
                        <span className="text-blue-400 font-semibold">Texto de apoio: </span>
                        {qa.input["Texto de apoio"]}
                      </div>
                    )}

                    {qa.input.Enunciado && (
                      <div className="text-[10.5px] text-slate-300/90 pl-2 border-l border-slate-500/40 line-clamp-2">
                        <span className="text-slate-400 font-semibold">Enunciado: </span>
                        {qa.input.Enunciado}
                      </div>
                    )}

                    {qa.input["Pergunta problema"] && (
                      <div className="text-[10.5px] text-slate-200 pl-2 border-l border-indigo-500/40 line-clamp-2">
                        <span className="text-indigo-300 font-semibold">Pergunta: </span>
                        {qa.input["Pergunta problema"]}
                      </div>
                    )}

                    {qa.erros.map((e, i) => (
                      <p key={i} className="text-[10px] text-rose-300 flex items-center gap-1">
                        <AlertCircle size={10} /> {e}
                      </p>
                    ))}
                    {qa.avisos.map((a, i) => (
                      <p key={i} className="text-[10px] text-amber-300/80 flex items-center gap-1">
                        <Info size={10} /> {a}
                      </p>
                    ))}
                  </div>
                ))}
              </div>

              {analise.totalDuplicata > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-[11px] flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    <strong>{analise.totalDuplicata} questão(ões)</strong> já existem no banco (mesmo Idq/Idg/Idtec) e{" "}
                    <strong>não serão sobrescritas</strong>.
                  </span>
                </div>
              )}

              {analise.totalErro > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-[11px] flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>
                    <strong>{analise.totalErro} questão(ões)</strong> com erros de validação{" "}
                    <strong>não serão importadas</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Erros gerais + SQL helper */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {showSqlHelper && (
                <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-200 flex items-center gap-1.5">
                    <Database size={13} className="text-amber-400 shrink-0" />
                    Execute o script SQL aditivo (setup_etapa2_caderno_erros.sql) no Supabase:
                  </span>
                  <button
                    type="button"
                    onClick={copySql}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0"
                  >
                    {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                    {copiedSql ? "SQL Copiado!" : "Copiar SQL"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sucesso */}
          {successCount !== null && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
              <div>
                <p className="font-bold text-sm">Importação concluída!</p>
                <p>{successCount} questão(ões) inserida(s) e organizadas na hierarquia de nós.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
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

          <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {!analise && (
              <button
                onClick={handleAnalisar}
                disabled={!jsonText.trim() || isAnalyzing}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {isAnalyzing ? "Analisando..." : "Analisar JSON"}
              </button>
            )}

            {analise && !isImporting && (
              <button
                onClick={handleAnalisar}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <FileText size={13} /> Re-analisar
              </button>
            )}

            {analise && (
              <button
                onClick={handleImportar}
                disabled={!podeImportar}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {isImporting ? "Importando..." : `Confirmar (${analise.totalNova} novas)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function itemOrNull(val?: string) {
  return val !== undefined && val !== "" ? val : null;
}
