"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Sparkles,
  Layers,
  ArrowRight,
  ClipboardPaste,
  FileText,
  Loader2,
  Pencil,
  Play,
  Filter,
  RefreshCw,
  CheckCheck
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import { supabasePublic } from "../../lib/supabase";

interface VerificadorIDsTabProps {
  questions: BancoQuestion[];
  onSelectQuestion: (question: BancoQuestion) => void;
  isAdmin?: boolean;
  onEditQuestion?: (question: BancoQuestion) => void;
}

interface ResultadoItem {
  idOriginal: string;
  idNormalizado: string;
  encontrada: boolean;
  questao?: BancoQuestion;
}

export default function VerificadorIDsTab({
  questions,
  onSelectQuestion,
  isAdmin,
  onEditQuestion,
}: VerificadorIDsTabProps) {
  const [textoIds, setTextoIds] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "faltantes" | "cadastradas">("todos");
  const [buscaResultado, setBuscaResultado] = useState("");
  const [copiadoTipo, setCopiadoTipo] = useState<string | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoItem[] | null>(null);

  // Normalizador auxiliar
  const normalizarID = (id: string) => {
    const limpo = id.trim().toUpperCase();
    if (limpo.startsWith("Q")) return limpo;
    // Se for puramente dígitos, adiciona Q
    if (/^\d+$/.test(limpo)) return `Q${limpo}`;
    return limpo;
  };

  // Parser inteligente de texto para extrair IDs
  const extrairIDs = useCallback((raw: string): string[] => {
    if (!raw.trim()) return [];

    // Tenta regex para encontrar padrões Q + dígitos ou números isolados de 5 a 10 dígitos
    const regex = /(Q\d{4,10}|\b\d{5,10}\b)/gi;
    const matches = raw.match(regex);

    let ids: string[] = [];
    if (matches && matches.length > 0) {
      ids = matches;
    } else {
      // Divide por quebras de linha, vírgulas, ponto-e-vírgula ou espaços
      ids = raw
        .split(/[\n,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4);
    }

    // Normaliza e desduplica preservando a ordem
    const vistos = new Set<string>();
    const unicos: string[] = [];

    for (const item of ids) {
      const norm = normalizarID(item);
      if (norm && !vistos.has(norm)) {
        vistos.add(norm);
        unicos.push(norm);
      }
    }

    return unicos;
  }, []);

  // Executa confronto
  const executarConfronto = useCallback(async () => {
    const ids = extrairIDs(textoIds);
    if (ids.length === 0) {
      setUltimoResultado([]);
      return;
    }

    setAnalisando(true);
    try {
      // Mapa local de questões por ID_Qconcursos
      const mapaQuestoes = new Map<string, BancoQuestion>();

      // Popula a partir das questões passadas via props
      for (const q of questions) {
        if (q.ID_Qconcursos) {
          const norm = normalizarID(q.ID_Qconcursos);
          mapaQuestoes.set(norm, q);
          // também adiciona a versão sem o Q para garantir cruzamento flexível
          mapaQuestoes.set(norm.replace(/^Q/, ""), q);
        }
      }

      // Busca também no Supabase para garantir completude em tempo real
      const { data, error } = await supabasePublic
        .from("questoes")
        .select("*")
        .not("ID_Qconcursos", "is", null);

      if (!error && data) {
        for (const row of data) {
          const norm = normalizarID(row.ID_Qconcursos);
          const qNorm: BancoQuestion = {
            id: row.id,
            materia: row.Materia || row.Disciplina || "Geral",
            tema: row.tema || row.Tema || row.Assunto || undefined,
            title: row.Enunciado || row.enunciado || "",
            dificuldade: row.dificuldade || row.Dificuldade || undefined,
            prova: row.PROVA || row.prova || undefined,
            "Alternativa A": row["Alternativa A"] || undefined,
            "Alternativa B": row["Alternativa B"] || undefined,
            "Alternativa C": row["Alternativa C"] || undefined,
            "Alternativa D": row["Alternativa D"] || undefined,
            "Alternativa E": row["Alternativa E"] || undefined,
            "Texto de apoio": row["Texto de apoio"] || undefined,
            perguntaProblema: row["Pergunta problema"] || undefined,
            Gabarito: row.Gabarito || row.gabarito || undefined,
            explicacao: row["Comentário"] || row.comentario || undefined,
            Ano: row.Ano ? Number(row.Ano) : undefined,
            ID_Qconcursos: row.ID_Qconcursos || undefined,
            link: row.link || undefined,
            organizacao_id: row.organizacao_id || undefined,
          };
          mapaQuestoes.set(norm, qNorm);
          mapaQuestoes.set(norm.replace(/^Q/, ""), qNorm);
        }
      }

      // Cruzamento
      const resultados: ResultadoItem[] = ids.map((idNorm) => {
        const idSemQ = idNorm.replace(/^Q/, "");
        const match = mapaQuestoes.get(idNorm) || mapaQuestoes.get(idSemQ);
        return {
          idOriginal: idNorm,
          idNormalizado: idNorm,
          encontrada: !!match,
          questao: match,
        };
      });

      setUltimoResultado(resultados);
    } catch (err) {
      console.error("Erro ao confrontar IDs:", err);
    } finally {
      setAnalisando(false);
    }
  }, [textoIds, questions, extrairIDs]);

  // Estatísticas do confronto
  const stats = useMemo(() => {
    if (!ultimoResultado) return null;
    const total = ultimoResultado.length;
    const cadastradas = ultimoResultado.filter((i) => i.encontrada).length;
    const faltantes = total - cadastradas;
    const pctCadastradas = total > 0 ? Math.round((cadastradas / total) * 100) : 0;
    const pctFaltantes = total > 0 ? Math.round((faltantes / total) * 100) : 0;
    return { total, cadastradas, faltantes, pctCadastradas, pctFaltantes };
  }, [ultimoResultado]);

  // Lista filtrada
  const itensFiltrados = useMemo(() => {
    if (!ultimoResultado) return [];
    return ultimoResultado.filter((item) => {
      // Filtro de status
      if (filtroStatus === "cadastradas" && !item.encontrada) return false;
      if (filtroStatus === "faltantes" && item.encontrada) return false;

      // Filtro de texto de busca
      if (buscaResultado.trim()) {
        const term = buscaResultado.toLowerCase();
        const bateId = item.idNormalizado.toLowerCase().includes(term);
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

  // Copiar template JSON para as questões faltantes
  const handleCopiarTemplateJSON = () => {
    if (!ultimoResultado) return;
    const faltantes = ultimoResultado.filter((i) => !i.encontrada);
    if (faltantes.length === 0) return;

    const templates = faltantes.map((i, idx) => ({
      PROVA: "",
      Ano: new Date().getFullYear(),
      Ordem: idx + 1,
      Banca: "",
      ID_Qconcursos: i.idNormalizado,
      link: `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${i.idNormalizado}`,
      Dificuldade: "Média",
      Status: "Ativa",
      Duvida: false,
      Caminho_Organizacao: ["Matéria", "Tópico", "Caso"],
      "Texto de apoio": "",
      Enunciado: "",
      "Pergunta problema": "",
      "Alternativa A": "",
      "Alternativa B": "",
      "Alternativa C": "",
      "Alternativa D": "",
      "Alternativa E": "",
      Gabarito: "A",
      "Comentário": ""
    }));

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

  // Exemplo de teste
  const handleCarregarExemplo = () => {
    setTextoIds(
      "Q2408218\nQ2104921\nQ1987321\nQ1876543\nQ9999991\nQ9999992\nQ9999993"
    );
  };

  return (
    <div className="w-full space-y-6">

      {/* ── Top Bar Informativa ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCheck size={14} />
            </div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Confrontar IDs do Qconcursos
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Cole uma lista de códigos (ex: <code className="text-blue-300 bg-white/[0.04] px-1 py-0.5 rounded font-mono">Q2408218</code>) para confrontar instantaneamente quais questões já existem no banco e quais são inéditas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCarregarExemplo}
            className="px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all"
          >
            Exemplo
          </button>
          {textoIds && (
            <button
              onClick={() => {
                setTextoIds("");
                setUltimoResultado(null);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-all flex items-center gap-1.5"
            >
              <Trash2 size={11} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Área de Entrada de Texto ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0b0f19]/80 border border-white/[0.05] space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <FileText size={12} className="text-blue-400" />
            Cole os IDs abaixo (um por linha, separados por vírgula, espaço ou texto/JSON)
          </label>
          <button
            onClick={handleColarClipboard}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <ClipboardPaste size={12} />
            Colar da Área de Transferência
          </button>
        </div>

        <textarea
          rows={5}
          value={textoIds}
          onChange={(e) => setTextoIds(e.target.value)}
          placeholder="Exemplo:&#10;Q2408218&#10;Q1987321&#10;Q2104921&#10;Q9999991&#10;&#10;Dica: Aceita listas do Excel, URLs ou trechos de JSON."
          className="w-full bg-[#070b14] border border-white/[0.08] rounded-xl px-3.5 py-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all custom-scrollbar resize-y"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-500 font-mono">
            {textoIds.trim() ? (
              <span>{extrairIDs(textoIds).length} IDs identificados</span>
            ) : (
              <span>Nenhum ID inserido</span>
            )}
          </div>

          <button
            onClick={executarConfronto}
            disabled={analisando || !textoIds.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium tracking-wide transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center gap-2"
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
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total de IDs</span>
                <span className="text-xl font-semibold text-white tracking-tight">{stats.total}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400">
                <Layers size={14} />
              </div>
            </div>

            {/* Já Cadastradas */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">No Banco</span>
                  <span className="text-[10px] text-emerald-500 font-mono">({stats.pctCadastradas}%)</span>
                </div>
                <span className="text-xl font-semibold text-emerald-300 tracking-tight">{stats.cadastradas}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={14} />
              </div>
            </div>

            {/* Inéditas / Faltantes */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider block">Inéditas / Faltantes</span>
                  <span className="text-[10px] text-amber-500 font-mono">({stats.pctFaltantes}%)</span>
                </div>
                <span className="text-xl font-semibold text-amber-300 tracking-tight">{stats.faltantes}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles size={14} />
              </div>
            </div>

          </div>

          {/* Barra de Ações e Filtros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            
            {/* Filtros por status */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFiltroStatus("todos")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  filtroStatus === "todos"
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFiltroStatus("faltantes")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  filtroStatus === "faltantes"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Inéditas ({stats.faltantes})
              </button>
              <button
                onClick={() => setFiltroStatus("cadastradas")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  filtroStatus === "cadastradas"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white bg-transparent"
                }`}
              >
                Já no Banco ({stats.cadastradas})
              </button>
            </div>

            {/* Busca + Ações de Cópia */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={buscaResultado}
                  onChange={(e) => setBuscaResultado(e.target.value)}
                  placeholder="Filtrar por ID ou texto..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#070b14] border border-white/[0.08] rounded-lg text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
                />
              </div>

              {stats.faltantes > 0 && (
                <>
                  <button
                    onClick={handleCopiarFaltantes}
                    title="Copiar lista de IDs faltantes"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-[11px] font-medium transition-all flex items-center gap-1.5"
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
                    className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 text-[11px] font-medium transition-all flex items-center gap-1.5"
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

          {/* Tabela de Confrontação */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0b0f19]/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[120px]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[130px]">
                      ID Qconcursos
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-[180px]">
                      Disciplina / Tema
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                      Enunciado / Detalhes
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
                      const linkQC =
                        item.questao?.link ||
                        `https://www.qconcursos.com/questoes-de-concursos/questoes?q=${item.idNormalizado}`;

                      return (
                        <tr
                          key={item.idNormalizado}
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

                          {/* ID */}
                          <td className="px-4 py-3 align-middle">
                            <span className="font-mono text-xs font-medium text-slate-200">
                              {item.idNormalizado}
                            </span>
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

                          {/* Enunciado / Detalhes */}
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
                              {/* Link externo para Qconcursos */}
                              <a
                                href={linkQC}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir no Qconcursos"
                                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-blue-400 hover:bg-white/[0.08] transition-colors"
                              >
                                <ExternalLink size={11} />
                              </a>

                              {/* Se encontrada: Resolver & Editar */}
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
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium transition-all active:scale-95 flex items-center gap-1"
                                  >
                                    <Play size={10} />
                                    <span>Resolver</span>
                                  </button>
                                </>
                              )}

                              {/* Se não encontrada: botão rápido de copiar ID */}
                              {!item.encontrada && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.idNormalizado);
                                  }}
                                  title="Copiar ID"
                                  className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white text-[10px] font-medium transition-all"
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

    </div>
  );
}
