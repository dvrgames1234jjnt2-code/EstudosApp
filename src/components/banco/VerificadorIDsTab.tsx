"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Sparkles,
  Layers,
  ClipboardPaste,
  FileText,
  Loader2,
  Pencil,
  Play,
  CheckCheck,
  FileJson,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import { fetchQuestoes, getQuestionIds } from "../../lib/questionService";
import { ImportJsonModal } from "./ImportJsonModal";

interface VerificadorIDsTabProps {
  questions: BancoQuestion[];
  onSelectQuestion: (question: BancoQuestion) => void;
  isAdmin?: boolean;
  onEditQuestion?: (question: BancoQuestion) => void;
  onRefreshQuestions?: () => void;
}

type PlataformaConfronto = "todas" | "qconcursos" | "gran" | "tec";
type PlataformaOrigem = "qconcursos" | "gran" | "tec" | "indefinida";
type PlataformaReal = "qconcursos" | "gran" | "tec";

interface EntradaID {
  idOriginal: string;
  idNormalizado: string;
  idBusca: string;
  plataforma: PlataformaOrigem;
  urlOriginal?: string;
}

interface ResultadoItem extends EntradaID {
  encontrada: boolean;
  questao?: BancoQuestion;
  matchedPlatforms: PlataformaReal[];
}

const PLATAFORMA_LABELS: Record<PlataformaReal, string> = {
  qconcursos: "Qconcursos",
  gran: "Gran",
  tec: "TEC",
};

const PLATAFORMA_BADGE_CLASS: Record<PlataformaReal, string> = {
  qconcursos: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  gran: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
  tec: "bg-violet-500/10 text-violet-300 border-violet-500/25",
};

function normalizeIdq(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (!clean) return "";
  if (clean.startsWith("Q")) return clean;
  if (/^\d+$/.test(clean)) return `Q${clean}`;
  return clean;
}

function stripPrefix(raw: string, prefixPattern: RegExp): string {
  const clean = raw.trim().toUpperCase();
  return clean.replace(prefixPattern, "");
}

function getPlatformExternalLink(item: ResultadoItem): string | null {
  if (item.questao?.link) return item.questao.link;
  if (item.urlOriginal) return item.urlOriginal;

  const qIds = item.questao ? getQuestionIds(item.questao) : null;
  if (qIds?.idq) {
    return `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${normalizeIdq(qIds.idq)}`;
  }
  if (qIds?.idtec) {
    return `https://www.tecconcursos.com.br/questoes/${stripPrefix(qIds.idtec, /^(?:TEC|T)[-_:\s]?(?=\d)/i)}`;
  }

  if (item.plataforma === "qconcursos") {
    return `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${item.idNormalizado}`;
  }
  if (item.plataforma === "tec") {
    return `https://www.tecconcursos.com.br/questoes/${item.idBusca}`;
  }
  return null;
}

function extrairEntradas(raw: string, modo: PlataformaConfronto): EntradaID[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const encontrados: EntradaID[] = [];
  const vistos = new Set<string>();

  const pushEntry = (entry: EntradaID) => {
    if (!entry.idNormalizado) return;
    const dedupKey = `${entry.plataforma}:${entry.idNormalizado.toUpperCase()}`;
    if (vistos.has(dedupKey)) return;
    vistos.add(dedupKey);
    encontrados.push(entry);
  };

  // 1. Tenta interpretar como JSON estruturado (preservando Idq, Idg, Idtec exatos)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let extractedFromJson = false;

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const linkVal =
          typeof rec.Link === "string"
            ? rec.Link.trim()
            : typeof rec.link === "string"
            ? rec.link.trim()
            : undefined;

        const idqVal = rec.Idq ?? rec.idq ?? rec.ID_Qconcursos ?? rec.id_qconcursos;
        const idgVal = rec.Idg ?? rec.idg ?? rec.ID_Gran ?? rec.id_gran;
        const idtecVal = rec.Idtec ?? rec.idtec ?? rec.ID_TEC ?? rec.id_tec;

        if (idqVal && String(idqVal).trim() && (modo === "todas" || modo === "qconcursos")) {
          const val = String(idqVal).trim();
          const norm = normalizeIdq(val);
          pushEntry({
            idOriginal: val,
            idNormalizado: norm,
            idBusca: stripPrefix(norm, /^Q(?=\d)/i),
            plataforma: "qconcursos",
            urlOriginal: linkVal,
          });
          extractedFromJson = true;
        }
        if (idgVal && String(idgVal).trim() && (modo === "todas" || modo === "gran")) {
          const val = String(idgVal).trim();
          const clean = stripPrefix(val, /^(?:GRAN|G)[-_:\s]?(?=\d)/i);
          pushEntry({
            idOriginal: val,
            idNormalizado: clean,
            idBusca: clean,
            plataforma: "gran",
            urlOriginal: linkVal,
          });
          extractedFromJson = true;
        }
        if (idtecVal && String(idtecVal).trim() && (modo === "todas" || modo === "tec")) {
          const val = String(idtecVal).trim();
          const clean = stripPrefix(val, /^(?:TEC|T)[-_:\s]?(?=\d)/i);
          pushEntry({
            idOriginal: val,
            idNormalizado: clean,
            idBusca: clean,
            plataforma: "tec",
            urlOriginal: linkVal,
          });
          extractedFromJson = true;
        }
      }

      if (extractedFromJson) return encontrados;
    } catch {
      // Segue para parser textual quando não for JSON completo válido
    }
  }

  let working = raw;

  // 2. Extrai URLs com identificação automática de plataforma
  working = working.replace(/https?:\/\/[^\s,"'<>]+/gi, (url) => {
    const lower = url.toLowerCase();
    if (lower.includes("qconcursos.com")) {
      const m = url.match(/[?&]q=(Q?\d+)|\/questoes(?:\/[^/]+)*\/(Q?\d+)/i);
      const rawId = m?.[1] || m?.[2];
      if (rawId) {
        const norm = normalizeIdq(rawId);
        pushEntry({
          idOriginal: url,
          idNormalizado: norm,
          idBusca: stripPrefix(norm, /^Q(?=\d)/i),
          plataforma: "qconcursos",
          urlOriginal: url,
        });
      }
      return " ";
    }
    if (lower.includes("grancursos")) {
      const m =
        url.match(/[?&](?:id|codigo|questao)=(\d{3,12})/i) ||
        url.match(/\/(\d{4,12})(?:[/?#]|$)/);
      if (m?.[1]) {
        pushEntry({
          idOriginal: url,
          idNormalizado: m[1],
          idBusca: m[1],
          plataforma: "gran",
          urlOriginal: url,
        });
      }
      return " ";
    }
    if (lower.includes("tecconcursos")) {
      const m =
        url.match(/\/questoes\/(\d{3,12})/i) ||
        url.match(/#(\d{3,12})/) ||
        url.match(/\/(\d{4,12})(?:[/?#]|$)/);
      if (m?.[1]) {
        pushEntry({
          idOriginal: url,
          idNormalizado: m[1],
          idBusca: m[1],
          plataforma: "tec",
          urlOriginal: url,
        });
      }
      return " ";
    }
    return " ";
  });

  // 3. Extrai pares chave:valor parciais de JSON ou texto (ex: "Idg": "123456", Idtec=987654)
  working = working.replace(
    /["']?(Idq|idq|ID_Qconcursos|id_qconcursos|Idg|idg|ID_Gran|id_gran|Idtec|idtec|ID_TEC|id_tec)["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{3,20})["']?/g,
    (_, key: string, val: string) => {
      const kLower = key.toLowerCase();
      if (kLower.includes("idq") || kLower.includes("qconcursos")) {
        const norm = normalizeIdq(val);
        pushEntry({
          idOriginal: val,
          idNormalizado: norm,
          idBusca: stripPrefix(norm, /^Q(?=\d)/i),
          plataforma: "qconcursos",
        });
      } else if (kLower.includes("idg") || kLower.includes("gran")) {
        const clean = stripPrefix(val, /^(?:GRAN|G)[-_:\s]?(?=\d)/i);
        pushEntry({
          idOriginal: val,
          idNormalizado: clean,
          idBusca: clean,
          plataforma: "gran",
        });
      } else if (kLower.includes("idtec") || kLower.includes("tec")) {
        const clean = stripPrefix(val, /^(?:TEC|T)[-_:\s]?(?=\d)/i);
        pushEntry({
          idOriginal: val,
          idNormalizado: clean,
          idBusca: clean,
          plataforma: "tec",
        });
      }
      return " ";
    }
  );

  // 4. Extrai códigos com prefixo explícito (Q..., G.../GRAN..., T.../TEC...)
  working = working.replace(/\b(?:GRAN|G)[-_:\s]?(\d{3,12})\b/gi, (full, digits: string) => {
    pushEntry({
      idOriginal: full.trim(),
      idNormalizado: digits,
      idBusca: digits,
      plataforma: "gran",
    });
    return " ";
  });

  working = working.replace(/\b(?:TEC|T)[-_:\s]?(\d{3,12})\b/gi, (full, digits: string) => {
    pushEntry({
      idOriginal: full.trim(),
      idNormalizado: digits,
      idBusca: digits,
      plataforma: "tec",
    });
    return " ";
  });

  working = working.replace(/\bQ(\d{4,12})\b/gi, (full, digits: string) => {
    const norm = `Q${digits}`;
    pushEntry({
      idOriginal: full.trim(),
      idNormalizado: norm,
      idBusca: digits,
      plataforma: "qconcursos",
    });
    return " ";
  });

  // 5. Extrai números puros sem converter automaticamente para Qconcursos quando modo === "todas"
  working.replace(/(?<![/\-.\d])\b(\d{4,12})\b(?![/\-.\d])/g, (full, digits: string) => {
    if (modo === "qconcursos") {
      const norm = `Q${digits}`;
      pushEntry({
        idOriginal: full,
        idNormalizado: norm,
        idBusca: digits,
        plataforma: "qconcursos",
      });
    } else if (modo === "gran") {
      pushEntry({
        idOriginal: full,
        idNormalizado: digits,
        idBusca: digits,
        plataforma: "gran",
      });
    } else if (modo === "tec") {
      pushEntry({
        idOriginal: full,
        idNormalizado: digits,
        idBusca: digits,
        plataforma: "tec",
      });
    } else {
      pushEntry({
        idOriginal: full,
        idNormalizado: digits,
        idBusca: digits,
        plataforma: "indefinida",
      });
    }
    return " ";
  });

  // 6. Fallback caso o usuário cole IDs alfanuméricos livres
  if (encontrados.length === 0) {
    const tokens = trimmed
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);

    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (modo === "qconcursos") {
        const norm = normalizeIdq(upper);
        pushEntry({
          idOriginal: token,
          idNormalizado: norm,
          idBusca: stripPrefix(norm, /^Q(?=\d)/i),
          plataforma: "qconcursos",
        });
      } else if (modo === "gran") {
        const clean = stripPrefix(upper, /^(?:GRAN|G)[-_:\s]?(?=\d)/i);
        pushEntry({
          idOriginal: token,
          idNormalizado: clean,
          idBusca: clean,
          plataforma: "gran",
        });
      } else if (modo === "tec") {
        const clean = stripPrefix(upper, /^(?:TEC|T)[-_:\s]?(?=\d)/i);
        pushEntry({
          idOriginal: token,
          idNormalizado: clean,
          idBusca: clean,
          plataforma: "tec",
        });
      } else {
        pushEntry({
          idOriginal: token,
          idNormalizado: upper,
          idBusca: upper,
          plataforma: "indefinida",
        });
      }
    }
  }

  return encontrados;
}

export default function VerificadorIDsTab({
  questions,
  onSelectQuestion,
  isAdmin,
  onEditQuestion,
  onRefreshQuestions,
}: VerificadorIDsTabProps) {
  const [textoIds, setTextoIds] = useState("");
  const [plataformaAlvo, setPlataformaAlvo] = useState<PlataformaConfronto>("todas");
  const [analisando, setAnalisando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "faltantes" | "cadastradas">("todos");
  const [buscaResultado, setBuscaResultado] = useState("");
  const [copiadoTipo, setCopiadoTipo] = useState<string | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoItem[] | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const entradasIdentificadas = useMemo(
    () => extrairEntradas(textoIds, plataformaAlvo),
    [textoIds, plataformaAlvo]
  );

  // Executa confronto completo contra Qconcursos (Idq), Gran (Idg) e TEC (Idtec)
  const executarConfrontoComModo = useCallback(
    async (modo: PlataformaConfronto) => {
      const entradas = extrairEntradas(textoIds, modo);
      if (entradas.length === 0) {
        setUltimoResultado([]);
        return;
      }

      setAnalisando(true);
      try {
        const mapaIdq = new Map<string, BancoQuestion>();
        const mapaIdg = new Map<string, BancoQuestion>();
        const mapaIdtec = new Map<string, BancoQuestion>();

        const indexQuestion = (q: BancoQuestion) => {
          const { idq, idg, idtec } = getQuestionIds(q);
          if (idq) {
            const upper = idq.trim().toUpperCase();
            const bare = stripPrefix(upper, /^Q(?=\d)/i);
            mapaIdq.set(upper, q);
            if (bare) mapaIdq.set(bare, q);
            if (/^\d+$/.test(upper)) mapaIdq.set(`Q${upper}`, q);
          }
          if (idg) {
            const upper = idg.trim().toUpperCase();
            const bare = stripPrefix(upper, /^(?:GRAN|G)[-_:\s]?(?=\d)/i);
            mapaIdg.set(upper, q);
            if (bare) mapaIdg.set(bare, q);
          }
          if (idtec) {
            const upper = idtec.trim().toUpperCase();
            const bare = stripPrefix(upper, /^(?:TEC|T)[-_:\s]?(?=\d)/i);
            mapaIdtec.set(upper, q);
            if (bare) mapaIdtec.set(bare, q);
          }
        };

        for (const q of questions) {
          indexQuestion(q);
        }

        // Busca atualizada no Supabase sem filtrar apenas por ID_Qconcursos
        try {
          const fresh = await fetchQuestoes();
          for (const q of fresh) {
            indexQuestion(q);
          }
        } catch (dbErr) {
          console.warn("Aviso ao atualizar questões para confronto:", dbErr);
        }

        const resultados: ResultadoItem[] = entradas.map((entrada) => {
          const keyNorm = entrada.idNormalizado.toUpperCase();
          const keyBusca = entrada.idBusca.toUpperCase();

          const matchQ =
            entrada.plataforma === "qconcursos" || entrada.plataforma === "indefinida"
              ? mapaIdq.get(keyNorm) || mapaIdq.get(keyBusca)
              : undefined;
          const matchG =
            entrada.plataforma === "gran" || entrada.plataforma === "indefinida"
              ? mapaIdg.get(keyNorm) || mapaIdg.get(keyBusca)
              : undefined;
          const matchTEC =
            entrada.plataforma === "tec" || entrada.plataforma === "indefinida"
              ? mapaIdtec.get(keyNorm) || mapaIdtec.get(keyBusca)
              : undefined;

          const matchedPlatforms: PlataformaReal[] = [];
          if (matchQ) matchedPlatforms.push("qconcursos");
          if (matchG) matchedPlatforms.push("gran");
          if (matchTEC) matchedPlatforms.push("tec");

          const primaryMatch =
            entrada.plataforma === "gran"
              ? matchG
              : entrada.plataforma === "tec"
              ? matchTEC
              : entrada.plataforma === "qconcursos"
              ? matchQ
              : matchQ || matchG || matchTEC;

          return {
            ...entrada,
            encontrada: Boolean(primaryMatch),
            questao: primaryMatch,
            matchedPlatforms,
          };
        });

        setUltimoResultado(resultados);
      } catch (err) {
        console.error("Erro ao confrontar IDs:", err);
      } finally {
        setAnalisando(false);
      }
    },
    [textoIds, questions]
  );

  const executarConfronto = useCallback(() => {
    return executarConfrontoComModo(plataformaAlvo);
  }, [executarConfrontoComModo, plataformaAlvo]);

  // Estatísticas do confronto (incluindo cobertura por plataforma no banco)
  const stats = useMemo(() => {
    if (!ultimoResultado) return null;
    const total = ultimoResultado.length;
    const cadastradasList = ultimoResultado.filter((i) => i.encontrada);
    const cadastradas = cadastradasList.length;
    const faltantes = total - cadastradas;
    const pctCadastradas = total > 0 ? Math.round((cadastradas / total) * 100) : 0;
    const pctFaltantes = total > 0 ? Math.round((faltantes / total) * 100) : 0;

    let comIdq = 0;
    let comIdg = 0;
    let comIdtec = 0;
    for (const item of cadastradasList) {
      if (!item.questao) continue;
      const ids = getQuestionIds(item.questao);
      if (ids.idq) comIdq += 1;
      if (ids.idg) comIdg += 1;
      if (ids.idtec) comIdtec += 1;
    }

    return {
      total,
      cadastradas,
      faltantes,
      pctCadastradas,
      pctFaltantes,
      comIdq,
      comIdg,
      comIdtec,
    };
  }, [ultimoResultado]);

  // Lista filtrada
  const itensFiltrados = useMemo(() => {
    if (!ultimoResultado) return [];
    return ultimoResultado.filter((item) => {
      if (filtroStatus === "cadastradas" && !item.encontrada) return false;
      if (filtroStatus === "faltantes" && item.encontrada) return false;

      if (buscaResultado.trim()) {
        const term = buscaResultado.toLowerCase();
        const ids = item.questao ? getQuestionIds(item.questao) : null;
        const bateId =
          item.idNormalizado.toLowerCase().includes(term) ||
          item.idBusca.toLowerCase().includes(term) ||
          (ids?.idq.toLowerCase().includes(term) ?? false) ||
          (ids?.idg.toLowerCase().includes(term) ?? false) ||
          (ids?.idtec.toLowerCase().includes(term) ?? false);
        const bateMateria = item.questao?.materia?.toLowerCase().includes(term) ?? false;
        const bateTema = item.questao?.tema?.toLowerCase().includes(term) ?? false;
        const bateTitulo = item.questao?.title?.toLowerCase().includes(term) ?? false;
        const bateProva = item.questao?.prova?.toLowerCase().includes(term) ?? false;
        return bateId || bateMateria || bateTema || bateTitulo || bateProva;
      }
      return true;
    });
  }, [ultimoResultado, filtroStatus, buscaResultado]);

  // Copiar IDs faltantes
  const handleCopiarFaltantes = () => {
    if (!ultimoResultado) return;
    const faltantes = ultimoResultado
      .filter((i) => !i.encontrada)
      .map((i) => i.idNormalizado)
      .join("\n");

    if (!faltantes) return;
    navigator.clipboard.writeText(faltantes);
    setCopiadoTipo("faltantes");
    setTimeout(() => setCopiadoTipo(null), 2500);
  };

  // Copiar template JSON respeitando a plataforma identificada (Idq, Idg ou Idtec)
  const handleCopiarTemplateJSON = () => {
    if (!ultimoResultado) return;
    const faltantes = ultimoResultado.filter((i) => !i.encontrada);
    if (faltantes.length === 0) return;

    const templates = faltantes.map((i, idx) => {
      const isQ = i.plataforma === "qconcursos";
      const isG = i.plataforma === "gran";
      const isTEC = i.plataforma === "tec";

      const defaultLink =
        i.urlOriginal ||
        (isQ
          ? `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${i.idNormalizado}`
          : isTEC
          ? `https://www.tecconcursos.com.br/questoes/${i.idBusca}`
          : "");

      return {
        Prova: "",
        Ano: "",
        Ordem: idx + 1,
        Banca: "",
        Disciplina: "",
        "Organização nó": "Matéria / Caderno / Caso",
        Idq: isQ ? i.idNormalizado : "",
        Idg: isG ? i.idBusca : "",
        Idtec: isTEC ? i.idBusca : "",
        Link: defaultLink,
        Dificuldade: "Média",
        "Texto de apoio": "",
        Enunciado: "",
        "Pergunta problema": "",
        "Alternativa A": "",
        "Alternativa B": "",
        "Alternativa C": "",
        "Alternativa D": "",
        "Alternativa E": "",
        Gabarito: "A",
      };
    });

    navigator.clipboard.writeText(JSON.stringify(templates, null, 2));
    setCopiadoTipo("json");
    setTimeout(() => setCopiadoTipo(null), 2500);
  };

  // Colar da área de transferência
  const handleColarClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setTextoIds((prev) => (prev ? `${prev}\n${clipText}` : clipText));
      }
    } catch {
      // Navegador não permitiu acesso direto
    }
  };

  // Exemplo de teste multiplataforma
  const handleCarregarExemplo = () => {
    setPlataformaAlvo("todas");
    setTextoIds(
      "Q2408218\nG1849201\nTEC 2049182\n1987321\n9999991\n9999992"
    );
  };

  const renderPlatformBadge = (item: ResultadoItem) => {
    if (item.encontrada && item.matchedPlatforms.length > 0) {
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {item.matchedPlatforms.map((plat) => (
            <span
              key={plat}
              className={`px-1.5 py-0.5 rounded border text-[9.5px] font-medium ${PLATAFORMA_BADGE_CLASS[plat]}`}
            >
              {PLATAFORMA_LABELS[plat]}
            </span>
          ))}
        </div>
      );
    }

    if (item.plataforma !== "indefinida") {
      return (
        <span
          className={`px-1.5 py-0.5 rounded border text-[9.5px] font-medium ${PLATAFORMA_BADGE_CLASS[item.plataforma]}`}
        >
          {PLATAFORMA_LABELS[item.plataforma]}
        </span>
      );
    }

    return (
      <span className="px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] text-slate-400 text-[9.5px] font-medium">
        Q / Gran / TEC
      </span>
    );
  };

  const renderQuestionIdCoverage = (questao: BancoQuestion) => {
    const ids = getQuestionIds(questao);
    return (
      <div className="flex items-center gap-1 flex-wrap mt-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border ${
            ids.idq
              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
              : "bg-white/[0.02] text-slate-600 border-white/[0.05]"
          }`}
        >
          Q: {ids.idq || "—"}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border ${
            ids.idg
              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
              : "bg-white/[0.02] text-slate-600 border-white/[0.05]"
          }`}
        >
          G: {ids.idg || "—"}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border ${
            ids.idtec
              ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
              : "bg-white/[0.02] text-slate-600 border-white/[0.05]"
          }`}
        >
          TEC: {ids.idtec || "—"}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 overflow-x-clip space-y-5 sm:space-y-6">
      {/* ── Top Bar Informativa ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCheck size={14} />
            </div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Confrontar IDs (Qconcursos, Gran e TEC)
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Cole códigos, URLs ou JSON de{" "}
            <span className="text-amber-300">Qconcursos (Idq)</span>,{" "}
            <span className="text-cyan-300">Gran (Idg)</span> ou{" "}
            <span className="text-violet-300">TEC (Idtec)</span> para confrontar no banco e ver quais plataformas já estão vinculadas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <FileJson size={13} />
              <span>Importar Questão</span>
            </button>
          )}
          <button
            onClick={handleCarregarExemplo}
            className="px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-colors"
          >
            Exemplo
          </button>
          {textoIds && (
            <button
              onClick={() => {
                setTextoIds("");
                setUltimoResultado(null);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={11} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Área de Entrada de Texto ── */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-[#0b0f19]/80 border border-white/[0.05] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <FileText size={12} className="text-blue-400 shrink-0" />
            Cole os IDs abaixo (um por linha, URLs, prefixos Q/G/TEC ou JSON)
          </label>
          <button
            onClick={handleColarClipboard}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors shrink-0"
          >
            <ClipboardPaste size={12} />
            Colar da Área de Transferência
          </button>
        </div>

        {/* Seletor de plataforma alvo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-slate-500 mr-1">Plataforma dos códigos:</span>
          {(
            [
              { id: "todas", label: "Auto (Q / Gran / TEC)" },
              { id: "qconcursos", label: "Qconcursos (Idq)" },
              { id: "gran", label: "Gran (Idg)" },
              { id: "tec", label: "TEC (Idtec)" },
            ] as { id: PlataformaConfronto; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPlataformaAlvo(opt.id);
                if (ultimoResultado !== null && textoIds.trim()) {
                  void executarConfrontoComModo(opt.id);
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                plataformaAlvo === opt.id
                  ? opt.id === "gran"
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                    : opt.id === "tec"
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                    : opt.id === "qconcursos"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                    : "bg-blue-500/15 border-blue-500/40 text-blue-200"
                  : "bg-white/[0.02] border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea
          rows={5}
          value={textoIds}
          onChange={(e) => setTextoIds(e.target.value)}
          placeholder={
            "Exemplos:\nQ2408218\nG1849201 (ou selecione Gran e cole apenas 1849201)\nTEC 2049182 (ou selecione TEC e cole apenas 2049182)\nhttps://www.tecconcursos.com.br/questoes/2049182\n\nNo modo Auto, números puros são confrontados em Qconcursos, Gran e TEC."
          }
          className="w-full bg-[#070b14] border border-white/[0.08] rounded-xl px-3.5 py-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 custom-scrollbar resize-y"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-500 font-mono">
            {textoIds.trim() ? (
              <span>{entradasIdentificadas.length} IDs identificados</span>
            ) : (
              <span>Nenhum ID inserido</span>
            )}
          </div>

          <button
            onClick={executarConfronto}
            disabled={analisando || !textoIds.trim()}
            className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium tracking-wide transition-colors flex items-center gap-2"
          >
            {analisando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Verificando Banco...</span>
              </>
            ) : (
              <>
                <Search size={13} />
                <span>Confrontar com o Banco</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Resultados do Confronto ── */}
      {stats && (
        <div className="space-y-4">
          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Analisado */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Total de IDs
                </span>
                <span className="text-xl font-semibold text-white tracking-tight">
                  {stats.total}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400">
                <Layers size={14} />
              </div>
            </div>

            {/* Já Cadastradas */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">
                    No Banco
                  </span>
                  <span className="text-[10px] text-emerald-500 font-mono">
                    ({stats.pctCadastradas}%)
                  </span>
                </div>
                <span className="text-xl font-semibold text-emerald-300 tracking-tight">
                  {stats.cadastradas}
                </span>
                {stats.cadastradas > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Q: {stats.comIdq} · G: {stats.comIdg} · TEC: {stats.comIdtec}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 size={14} />
              </div>
            </div>

            {/* Inéditas / Faltantes */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider block">
                    Inéditas / Faltantes
                  </span>
                  <span className="text-[10px] text-amber-500 font-mono">
                    ({stats.pctFaltantes}%)
                  </span>
                </div>
                <span className="text-xl font-semibold text-amber-300 tracking-tight">
                  {stats.faltantes}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles size={14} />
              </div>
            </div>
          </div>

          {/* Barra de Ações e Filtros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {/* Filtros por status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFiltroStatus("todos")}
                className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs sm:text-[11px] font-medium transition-colors ${
                  filtroStatus === "todos"
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFiltroStatus("faltantes")}
                className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs sm:text-[11px] font-medium transition-colors ${
                  filtroStatus === "faltantes"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Inéditas ({stats.faltantes})
              </button>
              <button
                onClick={() => setFiltroStatus("cadastradas")}
                className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs sm:text-[11px] font-medium transition-colors ${
                  filtroStatus === "cadastradas"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Já no Banco ({stats.cadastradas})
              </button>
            </div>

            {/* Busca + Ações de Cópia */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-auto sm:min-w-[200px] flex-1 sm:flex-initial">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  value={buscaResultado}
                  onChange={(e) => setBuscaResultado(e.target.value)}
                  placeholder="Filtrar por ID ou texto..."
                  className="w-full min-h-[38px] sm:min-h-0 pl-8 pr-3 py-1.5 bg-[#070b14] border border-white/[0.08] rounded-lg text-xs sm:text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40"
                />
              </div>

              {stats.faltantes > 0 && (
                <>
                  <button
                    onClick={handleCopiarFaltantes}
                    title="Copiar lista de IDs faltantes"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-[11px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    {copiadoTipo === "faltantes" ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-300">IDs Copiados!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar IDs Faltantes</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCopiarTemplateJSON}
                    title="Copiar template JSON para importar as questões faltantes"
                    className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 text-[11px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    {copiadoTipo === "json" ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-300">JSON Copiado!</span>
                      </>
                    ) : (
                      <>
                        <FileText size={12} />
                        <span>Template JSON</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lista Mobile (Cards) */}
          <div className="md:hidden divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-[#0b0f19]/70 overflow-hidden">
            {itensFiltrados.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                Nenhum item corresponde ao filtro selecionado.
              </div>
            ) : (
              itensFiltrados.map((item) => {
                const externalLink = getPlatformExternalLink(item);
                const rowKey = `${item.plataforma}-${item.idNormalizado}`;

                return (
                  <div key={`mob-${rowKey}`} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap flex-1">
                        {item.encontrada ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            No Banco
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Inédita
                          </span>
                        )}
                        <span className="font-mono text-[13px] font-semibold text-slate-200 break-all">
                          {item.idNormalizado}
                        </span>
                        {renderPlatformBadge(item)}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {externalLink && (
                          <a
                            href={externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir link da questão"
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-blue-400"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {item.encontrada && item.questao ? (
                          <>
                            {isAdmin && onEditQuestion && (
                              <button
                                onClick={() => onEditQuestion(item.questao!)}
                                title="Editar questão (Admin)"
                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-amber-400"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => onSelectQuestion(item.questao!)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium flex items-center gap-1"
                            >
                              <Play size={11} />
                              <span>Resolver</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => navigator.clipboard.writeText(item.idNormalizado)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 text-xs font-medium"
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>

                    {item.encontrada && item.questao ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="font-medium text-blue-400">
                            {item.questao.materia}
                          </span>
                          {item.questao.tema && (
                            <span className="text-slate-400">• {item.questao.tema}</span>
                          )}
                        </div>
                        <p className="text-[13px] text-slate-200 leading-relaxed line-clamp-3 break-words">
                          {item.questao.perguntaProblema || item.questao.title}
                        </p>
                        {renderQuestionIdCoverage(item.questao)}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Questão ainda não cadastrada no sistema.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Tabela de Confrontação (Desktop) */}
          <div className="hidden md:block rounded-2xl border border-white/[0.06] bg-[#0b0f19]/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[115px]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[170px]">
                      ID / Plataforma
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[180px]">
                      Disciplina / Tema
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                      Enunciado / IDs no Banco
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider text-right w-[160px]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                        Nenhum item corresponde ao filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item) => {
                      const externalLink = getPlatformExternalLink(item);
                      const rowKey = `${item.plataforma}-${item.idNormalizado}`;

                      return (
                        <tr
                          key={rowKey}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Status */}
                          <td className="px-4 py-3 align-middle">
                            {item.encontrada ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                No Banco
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                Inédita
                              </span>
                            )}
                          </td>

                          {/* ID + Plataforma */}
                          <td className="px-4 py-3 align-middle">
                            <div className="space-y-1">
                              <span className="font-mono text-xs font-medium text-slate-200 block">
                                {item.idNormalizado}
                              </span>
                              {renderPlatformBadge(item)}
                            </div>
                          </td>

                          {/* Matéria & Tema */}
                          <td className="px-4 py-3 align-middle">
                            {item.encontrada && item.questao ? (
                              <div>
                                <span className="text-[11px] font-medium text-blue-400 block truncate max-w-[160px]">
                                  {item.questao.materia}
                                </span>
                                {item.questao.tema && (
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">
                                    {item.questao.tema}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-600">—</span>
                            )}
                          </td>

                          {/* Enunciado / Detalhes + Cobertura Q/G/TEC */}
                          <td className="px-4 py-3 align-middle">
                            {item.encontrada && item.questao ? (
                              <div>
                                <p className="text-[11px] text-slate-300 line-clamp-1">
                                  {item.questao.perguntaProblema || item.questao.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                  {item.questao.prova && <span>{item.questao.prova}</span>}
                                  {item.questao.Gabarito && (
                                    <span className="text-emerald-400 font-mono">
                                      Gabarito: {item.questao.Gabarito}
                                    </span>
                                  )}
                                </div>
                                {renderQuestionIdCoverage(item.questao)}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Questão ainda não cadastrada no sistema.
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {externalLink && (
                                <a
                                  href={externalLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir link da questão"
                                  className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-blue-400 hover:bg-white/[0.08] transition-colors"
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}

                              {item.encontrada && item.questao && (
                                <>
                                  {isAdmin && onEditQuestion && (
                                    <button
                                      onClick={() => onEditQuestion(item.questao!)}
                                      title="Editar questão (Admin)"
                                      className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => onSelectQuestion(item.questao!)}
                                    title="Resolver questão"
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium transition-colors flex items-center gap-1"
                                  >
                                    <Play size={10} />
                                    <span>Resolver</span>
                                  </button>
                                </>
                              )}

                              {!item.encontrada && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.idNormalizado);
                                  }}
                                  title="Copiar ID"
                                  className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white text-[10px] font-medium transition-colors"
                                >
                                  Copiar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ImportJsonModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          onRefreshQuestions?.();
        }}
      />
    </div>
  );
}
