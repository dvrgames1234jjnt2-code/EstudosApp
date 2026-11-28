"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  Hash,
  Layers,
  Loader2,
  Merge,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import { safeInsertQuestao, safeUpdateQuestoesByIds } from "../../lib/questoesMutation";
import {
  getQuestionIds,
  isQuestaoAnulada,
  matchesPlataforma,
  sortQuestoesByOrdem,
  type PlataformaFiltro,
} from "../../lib/questionService";
import {
  DEFAULT_SIMULADOS_CONFIG,
  shouldShowBookInLibrary,
  type SimuladoBookOverride,
  type SimuladoTypeConfig,
  type SimuladoVisibilityMode,
  type SimuladosConfig,
  type SortBancasMode,
  type SortBooksMode,
} from "../../lib/simuladosConfig";
import type { BancoQuestion } from "./QuestionsTable";
import type { OrgNodeDB } from "./CadernosTab";
import { ImportJsonModal } from "./ImportJsonModal";
import { ModalNovaQuestao } from "./ModalNovaQuestao";

type AdminSubTab = "questoes" | "simulados_biblioteca" | "tipos_regras";

interface AdminManagerTabProps {
  questions: BancoQuestion[];
  orgNodes: OrgNodeDB[];
  simuladosConfig: SimuladosConfig;
  onSaveSimuladosConfig: (next: SimuladosConfig) => Promise<void>;
  onRefreshQuestions: () => void;
  onPatchQuestionsLocal?: (updates: { id: string | number; patch: Partial<BancoQuestion> }[]) => void;
  onRemoveQuestionsLocal?: (ids: (string | number)[]) => void;
  onEditQuestion: (q: BancoQuestion) => void;
  onOpenResolver: (q: BancoQuestion, queue: BancoQuestion[]) => void;
  onOpenSimuladoInLibrary: (key: string) => void;
}

interface SimuladoGroup {
  key: string;
  banca: string;
  provaName: string;
  ano?: string;
  disciplinaPrincipal: string;
  questions: BancoQuestion[];
  withOrderCount: number;
  isVisibleInLibrary: boolean;
  override?: SimuladoBookOverride;
}

interface TimedSimuladoRow {
  id: string;
  titulo?: string | null;
  title?: string | null;
  autor?: string | null;
  ano?: string | number | null;
  duracao_minutos?: number | null;
  data_json?: unknown;
  created_at?: string;
}

interface ToastState {
  type: "success" | "error";
  text: string;
}

const PALETTE_LABELS = [
  "Automática (pela banca)",
  "Azul Noturno",
  "Verde Esmeralda",
  "Vinho Clássico",
  "Âmbar Escuro",
  "Índigo Profundo",
  "Ardósia Neutra",
];

function getBanca(q: BancoQuestion): string {
  return String(q.Banca ?? q.banca ?? "").trim();
}

function getDisciplina(q: BancoQuestion): string {
  return String(q.Disciplina ?? q.disciplina ?? q.materia ?? "Geral").trim() || "Geral";
}

function getOrdemNum(q: BancoQuestion): number | null {
  const raw = q.Ordem ?? q.ordem;
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

async function updateQuestaoByIds(
  ids: (string | number)[],
  payload: Record<string, string | number | boolean | null>
): Promise<string | null> {
  const nextPayload =
    Object.prototype.hasOwnProperty.call(payload, "Banca") &&
    !Object.prototype.hasOwnProperty.call(payload, "banca")
      ? { ...payload, banca: payload.Banca }
      : payload;
  return safeUpdateQuestoesByIds(ids, nextPayload);
}

async function deleteQuestoesByIds(ids: (string | number)[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const CHUNK_SIZE = 80;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    let res = await supabase.from("questoes").delete().in("id", chunk);
    if (res.error) {
      res = await supabasePublic.from("questoes").delete().in("id", chunk);
    }
    if (res.error) return res.error.message;
  }
  return null;
}

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<string | null>
): Promise<string | null> {
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const results = await Promise.all(slice.map((item, offset) => worker(item, i + offset)));
    const firstErr = results.find((r) => r !== null);
    if (firstErr) return firstErr;
  }
  return null;
}

interface AdminQuestionRowProps {
  q: BancoQuestion;
  isSel: boolean;
  draftOrdVal: string | undefined;
  onToggleSelect: (qKey: string) => void;
  onDraftChange: (qKey: string, val: string) => void;
  onSaveInlineOrdem: (q: BancoQuestion) => void;
  onEditQuestion: (q: BancoQuestion) => void;
  onDuplicateQuestion: (q: BancoQuestion) => void;
  onOpenResolverSingle: (q: BancoQuestion) => void;
  onRequestDelete: (q: BancoQuestion) => void;
}

const AdminQuestionRow = React.memo(function AdminQuestionRow({
  q,
  isSel,
  draftOrdVal,
  onToggleSelect,
  onDraftChange,
  onSaveInlineOrdem,
  onEditQuestion,
  onDuplicateQuestion,
  onOpenResolverSingle,
  onRequestDelete,
}: AdminQuestionRowProps) {
  const qKey = String(q.id);
  const curOrd = getOrdemNum(q);
  const curOrdStr = curOrd !== null ? String(curOrd) : "";
  const draftOrd = draftOrdVal !== undefined ? draftOrdVal : curOrdStr;
  const ordDirty = draftOrdVal !== undefined && draftOrdVal !== curOrdStr;
  const ids = getQuestionIds(q);

  return (
    <tr
      className={`transition-colors ${
        isSel ? "bg-blue-600/[0.08]" : "hover:bg-white/[0.025]"
      }`}
    >
      <td className="py-2 px-3 text-center">
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => onToggleSelect(qKey)}
          aria-label={`Selecionar questão ${q.id}`}
          className="rounded border-white/20 bg-slate-900 accent-blue-600"
        />
      </td>
      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400 tabular-nums">
        #{q.id}
      </td>
      <td className="py-2 px-2.5">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={draftOrd}
            onChange={(e) => onDraftChange(qKey, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveInlineOrdem(q);
            }}
            placeholder="—"
            className="w-14 bg-[#0d0f14] border border-white/[0.08] rounded px-1.5 py-1 text-[11px] text-slate-200 font-mono tabular-nums focus:outline-none focus:border-blue-500"
          />
          {ordDirty && (
            <button
              type="button"
              onClick={() => onSaveInlineOrdem(q)}
              title="Salvar Ordem"
              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
            >
              <Check size={11} />
            </button>
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="truncate max-w-[180px] text-slate-200 font-normal">
          {q.prova || <span className="text-slate-500 font-normal">Sem Prova</span>}
        </div>
        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
          {getBanca(q) || "Sem Banca"}
          {q.Ano ? ` · ${q.Ano}` : ""}
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="truncate max-w-[165px] text-slate-300">
          {getDisciplina(q)}
        </div>
        {q.tema && (
          <div className="text-[11px] text-slate-500 truncate max-w-[165px]">
            {q.tema}
          </div>
        )}
      </td>
      <td className="py-2 px-3">
        <p className="text-slate-300 line-clamp-2 max-w-[340px] leading-snug">
          {q.title || q.perguntaProblema || "Sem enunciado"}
        </p>
      </td>
      <td className="py-2 px-2.5 text-[11px] tabular-nums">
        <div className="font-mono text-emerald-400">
          {q.Gabarito || q.respostaCorreta || "—"}
        </div>
        {isQuestaoAnulada(q) ? (
          <span className="inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30">
            Anulada
          </span>
        ) : (
          <div className="text-slate-400 truncate max-w-[95px]">
            {q.dificuldade || q.status || "—"}
          </div>
        )}
      </td>
      <td className="py-2 px-2.5 font-mono text-[10.5px] text-slate-400">
        <div className="truncate max-w-[115px]">
          {ids.idq ? `Q:${ids.idq}` : ""}
          {ids.idg ? ` G:${ids.idg}` : ""}
          {ids.idtec ? ` T:${ids.idtec}` : ""}
          {!ids.idq && !ids.idg && !ids.idtec ? "—" : ""}
        </div>
      </td>
      <td className="py-2 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEditQuestion(q)}
            title="Editar questão"
            className="p-1.5 rounded-md text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateQuestion(q)}
            title="Duplicar questão"
            className="p-1.5 rounded-md text-slate-400 hover:text-blue-300 hover:bg-white/[0.06] transition-colors"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={() => onOpenResolverSingle(q)}
            title="Abrir no resolvedor"
            className="p-1.5 rounded-md text-slate-400 hover:text-emerald-300 hover:bg-white/[0.06] transition-colors"
          >
            <Play size={13} />
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(q)}
            title="Excluir questão"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function AdminManagerTab({
  questions,
  orgNodes,
  simuladosConfig,
  onSaveSimuladosConfig,
  onRefreshQuestions,
  onPatchQuestionsLocal,
  onRemoveQuestionsLocal,
  onEditQuestion,
  onOpenResolver,
  onOpenSimuladoInLibrary,
}: AdminManagerTabProps) {
  const [subTab, setSubTab] = useState<AdminSubTab>("questoes");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 3800);
  }, []);

  // Modais compartilhados
  const [showImportJson, setShowImportJson] = useState(false);
  const [novaQuestaoModal, setNovaQuestaoModal] = useState<{
    open: boolean;
    prova?: string;
    banca?: string;
    disciplina?: string;
    ordem?: number;
  }>({ open: false });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTADO: GESTÃO DE QUESTÕES
  // ───────────────────────────────────────────────────────────────────────────
  const [qSearch, setQSearch] = useState("");
  const deferredQSearch = useDeferredValue(qSearch);
  const [qBanca, setQBanca] = useState("todas");
  const [qProva, setQProva] = useState("todas");
  const [qDisciplina, setQDisciplina] = useState("todas");
  const [qDificuldade, setQDificuldade] = useState("todas");
  const [qStatus, setQStatus] = useState("todas");
  const [qPlataforma, setQPlataforma] = useState<PlataformaFiltro>("todas");
  const [qOrdemFilter, setQOrdemFilter] = useState<"todas" | "com_ordem" | "sem_ordem">("todas");
  const [qSort, setQSort] = useState<"id_desc" | "id_asc" | "ordem_asc" | "prova_asc" | "banca_asc">("id_desc");
  const [qPage, setQPage] = useState(1);
  const PAGE_SIZE = 40;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inlineOrdemDraft, setInlineOrdemDraft] = useState<Record<string, string>>({});

  // Bulk edit fields
  const [bulkProva, setBulkProva] = useState("");
  const [bulkBanca, setBulkBanca] = useState("");
  const [bulkDisciplina, setBulkDisciplina] = useState("");
  const [bulkTema, setBulkTema] = useState("");
  const [bulkAno, setBulkAno] = useState("");
  const [bulkDificuldade, setBulkDificuldade] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkOrgId, setBulkOrgId] = useState("__keep__");
  const [bulkStartOrdem, setBulkStartOrdem] = useState("1");

  // Confirm delete modal
  const [deleteTarget, setDeleteTarget] = useState<{
    title: string;
    description: string;
    ids: (string | number)[];
  } | null>(null);

  // Índice pré-computado para busca instantânea sem alocar strings por tecla
  const questionSearchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of questions) {
      const ids = getQuestionIds(q);
      map.set(
        String(q.id),
        [
          String(q.id),
          ids.idq,
          ids.idg,
          ids.idtec,
          q.title || "",
          q.perguntaProblema || "",
          getDisciplina(q),
          q.tema || "",
          q.prova || "",
          getBanca(q),
        ]
          .join(" ")
          .toLowerCase()
      );
    }
    return map;
  }, [questions]);

  // Opções únicas para filtros
  const { allBancasList, allProvasList, allDisciplinasList, allDificuldadesList, allStatusList } =
    useMemo(() => {
      const bancas = new Set<string>();
      const provas = new Set<string>();
      const discs = new Set<string>();
      const difs = new Set<string>();
      const sts = new Set<string>();

      for (const q of questions) {
        const b = getBanca(q);
        if (b) bancas.add(b);
        if (q.prova) provas.add(String(q.prova).trim());
        discs.add(getDisciplina(q));
        if (q.dificuldade) difs.add(String(q.dificuldade).trim());
        if (q.status) sts.add(String(q.status).trim());
      }

      return {
        allBancasList: Array.from(bancas).sort((a, b) => a.localeCompare(b, "pt-BR")),
        allProvasList: Array.from(provas).sort((a, b) => a.localeCompare(b, "pt-BR")),
        allDisciplinasList: Array.from(discs).sort((a, b) => a.localeCompare(b, "pt-BR")),
        allDificuldadesList: Array.from(difs).sort((a, b) => a.localeCompare(b, "pt-BR")),
        allStatusList: Array.from(sts).sort((a, b) => a.localeCompare(b, "pt-BR")),
      };
    }, [questions]);

  const filteredQuestions = useMemo(() => {
    const term = deferredQSearch.trim().toLowerCase();
    const list = questions.filter((q) => {
      if (qBanca !== "todas" && getBanca(q) !== qBanca) return false;
      if (qProva !== "todas" && String(q.prova ?? "").trim() !== qProva) return false;
      if (qDisciplina !== "todas" && getDisciplina(q) !== qDisciplina) return false;
      if (qDificuldade !== "todas" && String(q.dificuldade ?? "").trim() !== qDificuldade) return false;
      if (qStatus !== "todas" && String(q.status ?? "").trim() !== qStatus) return false;
      if (!matchesPlataforma(q, qPlataforma)) return false;

      const ord = getOrdemNum(q);
      if (qOrdemFilter === "com_ordem" && ord === null) return false;
      if (qOrdemFilter === "sem_ordem" && ord !== null) return false;

      if (term) {
        const hay = questionSearchIndex.get(String(q.id));
        if (!hay || !hay.includes(term)) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (qSort === "id_asc") return (Number(a.id) || 0) - (Number(b.id) || 0);
      if (qSort === "id_desc") return (Number(b.id) || 0) - (Number(a.id) || 0);
      if (qSort === "ordem_asc") {
        const oa = getOrdemNum(a) ?? Number.MAX_SAFE_INTEGER;
        const ob = getOrdemNum(b) ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      }
      if (qSort === "prova_asc") {
        return String(a.prova ?? "").localeCompare(String(b.prova ?? ""), "pt-BR", { numeric: true });
      }
      return getBanca(a).localeCompare(getBanca(b), "pt-BR");
    });
  }, [
    questions,
    questionSearchIndex,
    deferredQSearch,
    qBanca,
    qProva,
    qDisciplina,
    qDificuldade,
    qStatus,
    qPlataforma,
    qOrdemFilter,
    qSort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const safePage = Math.min(qPage, totalPages);
  const pagedQuestions = useMemo(
    () => filteredQuestions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredQuestions, safePage]
  );

  const selectedQuestoesArray = useMemo(
    () => filteredQuestions.filter((q) => selectedIds.has(String(q.id))),
    [filteredQuestions, selectedIds]
  );

  const applyLocalPatch = useCallback(
    (updates: { id: string | number; patch: Partial<BancoQuestion> }[]) => {
      if (onPatchQuestionsLocal) onPatchQuestionsLocal(updates);
      else onRefreshQuestions();
    },
    [onPatchQuestionsLocal, onRefreshQuestions]
  );

  const applyLocalRemove = useCallback(
    (ids: (string | number)[]) => {
      if (onRemoveQuestionsLocal) onRemoveQuestionsLocal(ids);
      else onRefreshQuestions();
    },
    [onRemoveQuestionsLocal, onRefreshQuestions]
  );

  const handleSaveInlineOrdem = useCallback(
    async (q: BancoQuestion) => {
      const key = String(q.id);
      const raw = inlineOrdemDraft[key];
      if (raw === undefined) return;
      const trimmed = raw.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);
      if (trimmed !== "" && (parsed === null || Number.isNaN(parsed))) {
        showToast("error", "Ordem deve ser um número válido.");
        return;
      }
      setBusy(true);
      const err = await updateQuestaoByIds([q.id], { Ordem: parsed });
      setBusy(false);
      if (err) {
        showToast("error", `Erro ao atualizar Ordem: ${err}`);
        return;
      }
      setInlineOrdemDraft((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      showToast("success", `Ordem da questão #${q.id} atualizada.`);
      applyLocalPatch([{ id: q.id, patch: { Ordem: parsed ?? undefined, ordem: parsed ?? undefined } }]);
    },
    [inlineOrdemDraft, showToast, applyLocalPatch]
  );

  const handleDuplicateQuestion = useCallback(
    async (q: BancoQuestion) => {
      setBusy(true);
      const ids = getQuestionIds(q);
      const payload: Record<string, string | number | null> = {
        Enunciado: q.title || null,
        "Pergunta problema": q.perguntaProblema || null,
        "Texto de apoio": q["Texto de apoio"] || null,
        link: q.link || null,
        ID_Qconcursos: ids.idq || null,
        Idq: ids.idq || null,
        Idg: ids.idg || null,
        Idtec: ids.idtec || null,
        Ordem: getOrdemNum(q) !== null ? Number(getOrdemNum(q)) + 1 : null,
        Materia: getDisciplina(q),
        Disciplina: getDisciplina(q),
        tema: q.tema || null,
        PROVA: q.prova || null,
        Ano: q.Ano !== undefined && q.Ano !== null ? String(q.Ano) : null,
        Banca: getBanca(q) || null,
        Dificuldade: q.dificuldade || null,
        Status: q.status || "Ativa",
        Gabarito: q.Gabarito || q.respostaCorreta || null,
        "Alternativa A": q["Alternativa A"] || null,
        "Alternativa B": q["Alternativa B"] || null,
        "Alternativa C": q["Alternativa C"] || null,
        "Alternativa D": q["Alternativa D"] || null,
        "Alternativa E": q["Alternativa E"] || null,
        "Comentário": q.comentario || q["Comentário"] || q.explicacao || null,
        organizacao_id: q.organizacao_id || null,
      };

      const insertErr = await safeInsertQuestao(payload);
      setBusy(false);

      if (insertErr) {
        showToast("error", `Erro ao duplicar questão: ${insertErr}`);
        return;
      }
      showToast("success", `Questão #${q.id} duplicada com sucesso.`);
      onRefreshQuestions();
    },
    [showToast, onRefreshQuestions]
  );

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return;
    const payload: Record<string, string | number | null> = {};
    const localPatch: Partial<BancoQuestion> = {};
    if (bulkProva.trim()) {
      payload.PROVA = bulkProva.trim();
      localPatch.prova = bulkProva.trim();
    }
    if (bulkBanca.trim()) {
      payload.Banca = bulkBanca.trim();
      localPatch.Banca = bulkBanca.trim();
      localPatch.banca = bulkBanca.trim();
    }
    if (bulkDisciplina.trim()) {
      payload.Materia = bulkDisciplina.trim();
      payload.Disciplina = bulkDisciplina.trim();
      localPatch.materia = bulkDisciplina.trim();
      localPatch.Disciplina = bulkDisciplina.trim();
      localPatch.disciplina = bulkDisciplina.trim();
    }
    if (bulkTema.trim()) {
      payload.tema = bulkTema.trim();
      localPatch.tema = bulkTema.trim();
    }
    if (bulkAno.trim()) {
      payload.Ano = bulkAno.trim();
      localPatch.Ano = bulkAno.trim();
    }
    if (bulkDificuldade) {
      const difVal = bulkDificuldade === "__clear__" ? null : bulkDificuldade;
      payload.Dificuldade = difVal;
      localPatch.dificuldade = difVal ?? undefined;
    }
    if (bulkStatus) {
      const stVal = bulkStatus === "__clear__" ? null : bulkStatus;
      payload.Status = stVal;
      localPatch.status = stVal ?? undefined;
    }
    if (bulkOrgId !== "__keep__") {
      payload.organizacao_id = bulkOrgId || null;
      localPatch.organizacao_id = bulkOrgId || undefined;
    }

    if (Object.keys(payload).length === 0) {
      showToast("error", "Preencha ao menos um campo para aplicar em lote.");
      return;
    }

    setBusy(true);
    const idMap = new Map(questions.map((q) => [String(q.id), q.id]));
    const ids = Array.from(selectedIds).map((sid) => idMap.get(sid) ?? sid);
    const err = await updateQuestaoByIds(ids, payload);
    setBusy(false);

    if (err) {
      showToast("error", `Erro na edição em lote: ${err}`);
      return;
    }

    showToast("success", `${ids.length} questões atualizadas em lote.`);
    setBulkProva("");
    setBulkBanca("");
    setBulkDisciplina("");
    setBulkTema("");
    setBulkAno("");
    setBulkDificuldade("");
    setBulkStatus("");
    setBulkOrgId("__keep__");
    applyLocalPatch(ids.map((id) => ({ id, patch: localPatch })));
  };

  const handleBulkRenumberOrdem = async () => {
    if (selectedQuestoesArray.length === 0) return;
    const start = Number(bulkStartOrdem);
    if (Number.isNaN(start)) {
      showToast("error", "Número inicial de Ordem inválido.");
      return;
    }
    setBusy(true);
    const updates: { id: string | number; patch: Partial<BancoQuestion> }[] = [];
    const err = await runInBatches(selectedQuestoesArray, 8, async (q, i) => {
      const nextOrd = start + i;
      const e = await updateQuestaoByIds([q.id], { Ordem: nextOrd });
      if (!e) updates.push({ id: q.id, patch: { Ordem: nextOrd, ordem: nextOrd } });
      return e;
    });
    setBusy(false);
    if (updates.length > 0) applyLocalPatch(updates);
    if (err) {
      showToast("error", `Erro ao renumerar: ${err}`);
      return;
    }
    showToast("success", `Ordem renumerada (${start} até ${start + selectedQuestoesArray.length - 1}).`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const err = await deleteQuestoesByIds(deleteTarget.ids);
    setBusy(false);
    if (err) {
      showToast("error", `Erro ao excluir: ${err}`);
      return;
    }
    const deletedIds = deleteTarget.ids;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(String(id));
      return next;
    });
    showToast("success", `${deletedIds.length} ${deletedIds.length === 1 ? "questão excluída" : "questões excluídas"}.`);
    setDeleteTarget(null);
    applyLocalRemove(deletedIds);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ESTADO: GESTÃO DE SIMULADOS DA BIBLIOTECA (eBooks 3D)
  // ───────────────────────────────────────────────────────────────────────────
  const [simSearch, setSimSearch] = useState("");
  const deferredSimSearch = useDeferredValue(simSearch);
  const [simBancaFilter, setSimBancaFilter] = useState("todas");
  const [simVisFilter, setSimVisFilter] = useState<"todos" | "visiveis" | "abaixo" | "ocultos" | "forcados">("todos");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [simListLimit, setSimListLimit] = useState(80);
  const [activeGroupQuestionsLimit, setActiveGroupQuestionsLimit] = useState(80);

  // Edição de metadados em lote do simulado selecionado
  const [editSimProva, setEditSimProva] = useState("");
  const [editSimBanca, setEditSimBanca] = useState("");
  const [editSimAno, setEditSimAno] = useState("");
  const [mergeTargetKey, setMergeTargetKey] = useState("");

  // Override config do simulado selecionado
  const [ovVisibility, setOvVisibility] = useState<SimuladoVisibilityMode>("auto");
  const [ovCustomTitle, setOvCustomTitle] = useState("");
  const [ovTypeId, setOvTypeId] = useState("");
  const [ovDuration, setOvDuration] = useState("");
  const [ovInstructions, setOvInstructions] = useState("");
  const [ovPaletteIdx, setOvPaletteIdx] = useState<string>("auto");

  // Adicionar questões existentes ao simulado selecionado
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachSearch, setAttachSearch] = useState("");
  const deferredAttachSearch = useDeferredValue(attachSearch);

  // Modal Criar Novo Simulado (agrupando questões do banco)
  const [showCreateSimModal, setShowCreateSimModal] = useState(false);
  const [newSimProva, setNewSimProva] = useState("");
  const [newSimBanca, setNewSimBanca] = useState("");
  const [newSimAno, setNewSimAno] = useState("");
  const [newSimTypeId, setNewSimTypeId] = useState("inedito");
  const [newSimSourceFilter, setNewSimSourceFilter] = useState("");
  const deferredNewSimSourceFilter = useDeferredValue(newSimSourceFilter);
  const [newSimPickIds, setNewSimPickIds] = useState<Set<string>>(new Set());

  // Agrupamento base cacheado somente por `questions`
  const baseSimuladoGroups = useMemo(() => {
    const byProva = new Map<string, BancoQuestion[]>();
    for (const q of questions) {
      const provaName = String(q.prova ?? "").trim() || "Sem Prova";
      const arr = byProva.get(provaName);
      if (arr) arr.push(q);
      else byProva.set(provaName, [q]);
    }

    const groups: Omit<SimuladoGroup, "isVisibleInLibrary" | "override">[] = [];

    for (const [provaName, pList] of byProva.entries()) {
      const bancaCounts = new Map<string, number>();
      for (const q of pList) {
        const b = getBanca(q);
        if (b) bancaCounts.set(b, (bancaCounts.get(b) || 0) + 1);
      }
      const distinctBancas = Array.from(bancaCounts.keys());
      const byBanca = new Map<string, BancoQuestion[]>();

      if (distinctBancas.length <= 1) {
        byBanca.set(distinctBancas[0] || "Outras Bancas", pList);
      } else {
        const dom =
          Array.from(bancaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Outras Bancas";
        for (const q of pList) {
          const b = getBanca(q) || dom;
          const arr = byBanca.get(b);
          if (arr) arr.push(q);
          else byBanca.set(b, [q]);
        }
      }

      for (const [banca, rawList] of byBanca.entries()) {
        const ordered = sortQuestoesByOrdem(rawList);
        const key = `${banca}:::${provaName}`;
        const discCounts = new Map<string, number>();
        const anoCounts = new Map<string, number>();
        let withOrderCount = 0;

        for (const q of ordered) {
          if (getOrdemNum(q) !== null) withOrderCount += 1;
          const d = getDisciplina(q);
          discCounts.set(d, (discCounts.get(d) || 0) + 1);
          const rawAno = String(q.Ano ?? "").trim();
          if (rawAno) {
            const m = rawAno.match(/\b(19|20)\d{2}\b/);
            const yl = m ? m[0] : rawAno;
            anoCounts.set(yl, (anoCounts.get(yl) || 0) + 1);
          }
        }

        const disciplinaPrincipal =
          discCounts.size > 1
            ? `${Array.from(discCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]} (+${
                discCounts.size - 1
              })`
            : Array.from(discCounts.keys())[0] || "Geral";
        const ano =
          anoCounts.size > 0
            ? Array.from(anoCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
            : undefined;

        groups.push({
          key,
          banca,
          provaName,
          ano,
          disciplinaPrincipal,
          questions: ordered,
          withOrderCount,
        });
      }
    }

    return groups.sort((a, b) => {
      const bCmp = a.banca.localeCompare(b.banca, "pt-BR");
      if (bCmp !== 0) return bCmp;
      return a.provaName.localeCompare(b.provaName, "pt-BR", { numeric: true });
    });
  }, [questions]);

  const allSimuladoGroups = useMemo<SimuladoGroup[]>(
    () =>
      baseSimuladoGroups.map((g) => ({
        ...g,
        isVisibleInLibrary: shouldShowBookInLibrary(
          g.questions.length,
          g.banca,
          g.key,
          simuladosConfig
        ),
        override: simuladosConfig.bookOverrides[g.key],
      })),
    [baseSimuladoGroups, simuladosConfig]
  );

  const filteredSimuladoGroups = useMemo(() => {
    const term = deferredSimSearch.trim().toLowerCase();
    return allSimuladoGroups.filter((g) => {
      if (simBancaFilter !== "todas" && g.banca !== simBancaFilter) return false;
      const visMode = g.override?.visibility ?? "auto";
      if (simVisFilter === "visiveis" && !g.isVisibleInLibrary) return false;
      if (simVisFilter === "abaixo" && (g.isVisibleInLibrary || visMode === "hide")) return false;
      if (simVisFilter === "ocultos" && visMode !== "hide" && !simuladosConfig.hiddenBancas.includes(g.banca)) {
        return false;
      }
      if (simVisFilter === "forcados" && visMode !== "force_show") return false;

      if (term) {
        const hay = `${g.banca} ${g.provaName} ${g.override?.customTitle || ""} ${g.disciplinaPrincipal} ${g.ano || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [allSimuladoGroups, deferredSimSearch, simBancaFilter, simVisFilter, simuladosConfig.hiddenBancas]);

  const activeGroup = useMemo(
    () => allSimuladoGroups.find((g) => g.key === selectedGroupKey) || null,
    [allSimuladoGroups, selectedGroupKey]
  );

  const selectGroupForEdit = (group: SimuladoGroup) => {
    setSelectedGroupKey(group.key);
    setActiveGroupQuestionsLimit(80);
    setEditSimProva(group.provaName === "Sem Prova" ? "" : group.provaName);
    setEditSimBanca(group.banca === "Outras Bancas" ? "" : group.banca);
    setEditSimAno(group.ano || "");
    setMergeTargetKey("");

    const ov = simuladosConfig.bookOverrides[group.key];
    setOvVisibility(ov?.visibility ?? "auto");
    setOvCustomTitle(ov?.customTitle || "");
    setOvTypeId(ov?.typeId || "");
    setOvDuration(ov?.durationMinutes ? String(ov.durationMinutes) : "");
    setOvInstructions(ov?.instructions || "");
    setOvPaletteIdx(
      ov?.paletteIndex !== undefined && ov?.paletteIndex !== null ? String(ov.paletteIndex) : "auto"
    );
    setShowAttachPanel(false);
    setAttachSearch("");
  };

  const handleSaveSimuladoBatchMetadata = async () => {
    if (!activeGroup) return;
    if (!editSimProva.trim()) {
      showToast("error", "Informe o nome da Prova / Simulado.");
      return;
    }

    setBusy(true);
    const ids = activeGroup.questions.map((q) => q.id);
    const cleanProva = editSimProva.trim();
    const cleanBanca = editSimBanca.trim() || null;
    const payload: Record<string, string | null> = {
      PROVA: cleanProva,
      Banca: cleanBanca,
    };
    const localPatch: Partial<BancoQuestion> = {
      prova: cleanProva,
      Banca: cleanBanca ?? undefined,
      banca: cleanBanca ?? undefined,
    };
    if (editSimAno.trim()) {
      payload.Ano = editSimAno.trim();
      localPatch.Ano = editSimAno.trim();
    }

    const err = await updateQuestaoByIds(ids, payload);
    if (err) {
      setBusy(false);
      showToast("error", `Erro ao atualizar metadados: ${err}`);
      return;
    }

    // Migra override para a nova chave se mudou Banca/Prova
    const newBanca = editSimBanca.trim() || "Outras Bancas";
    const newProva = cleanProva;
    const newKey = `${newBanca}:::${newProva}`;
    if (newKey !== activeGroup.key && simuladosConfig.bookOverrides[activeGroup.key]) {
      const nextOverrides = { ...simuladosConfig.bookOverrides };
      nextOverrides[newKey] = nextOverrides[activeGroup.key];
      delete nextOverrides[activeGroup.key];
      await onSaveSimuladosConfig({ ...simuladosConfig, bookOverrides: nextOverrides });
    }

    setBusy(false);
    setSelectedGroupKey(newKey);
    showToast("success", `Metadados atualizados em ${ids.length} questões.`);
    applyLocalPatch(ids.map((id) => ({ id, patch: localPatch })));
  };

  const handleMergeSimulado = async () => {
    if (!activeGroup || !mergeTargetKey) return;
    const target = allSimuladoGroups.find((g) => g.key === mergeTargetKey);
    if (!target || target.key === activeGroup.key) return;

    setBusy(true);
    const ids = activeGroup.questions.map((q) => q.id);
    const targetProva = target.provaName === "Sem Prova" ? null : target.provaName;
    const targetBanca = target.banca === "Outras Bancas" ? null : target.banca;
    const payload: Record<string, string | null> = {
      PROVA: targetProva,
      Banca: targetBanca,
    };
    const err = await updateQuestaoByIds(ids, payload);
    setBusy(false);
    if (err) {
      showToast("error", `Erro ao mesclar simulados: ${err}`);
      return;
    }
    showToast("success", `${ids.length} questões movidas para "${target.provaName}".`);
    setSelectedGroupKey(target.key);
    applyLocalPatch(
      ids.map((id) => ({
        id,
        patch: {
          prova: targetProva ?? undefined,
          Banca: targetBanca ?? undefined,
          banca: targetBanca ?? undefined,
        },
      }))
    );
  };

  const handleSaveGroupOverride = async () => {
    if (!activeGroup) return;
    setBusy(true);
    const nextOverrides = { ...simuladosConfig.bookOverrides };
    const cleanDuration = ovDuration.trim() ? Number(ovDuration.trim()) : undefined;
    const nextOv: SimuladoBookOverride = {
      visibility: ovVisibility,
      customTitle: ovCustomTitle.trim() || undefined,
      typeId: ovTypeId || undefined,
      durationMinutes:
        cleanDuration && !Number.isNaN(cleanDuration) && cleanDuration > 0
          ? Math.round(cleanDuration)
          : undefined,
      instructions: ovInstructions.trim() || undefined,
      paletteIndex: ovPaletteIdx !== "auto" ? Number(ovPaletteIdx) : null,
    };

    const isDefault =
      nextOv.visibility === "auto" &&
      !nextOv.customTitle &&
      !nextOv.typeId &&
      !nextOv.durationMinutes &&
      !nextOv.instructions &&
      nextOv.paletteIndex === null;

    if (isDefault) {
      delete nextOverrides[activeGroup.key];
    } else {
      nextOverrides[activeGroup.key] = nextOv;
    }

    await onSaveSimuladosConfig({
      ...simuladosConfig,
      bookOverrides: nextOverrides,
    });
    setBusy(false);
    showToast("success", `Configuração de "${activeGroup.provaName}" salva.`);
  };

  const handleRenumberGroupQuestions = async () => {
    if (!activeGroup) return;
    setBusy(true);
    const updates: { id: string | number; patch: Partial<BancoQuestion> }[] = [];
    const err = await runInBatches(activeGroup.questions, 8, async (q, i) => {
      const nextOrd = i + 1;
      const e = await updateQuestaoByIds([q.id], { Ordem: nextOrd });
      if (!e) updates.push({ id: q.id, patch: { Ordem: nextOrd, ordem: nextOrd } });
      return e;
    });
    setBusy(false);
    if (updates.length > 0) applyLocalPatch(updates);
    if (err) {
      showToast("error", `Erro ao numerar questões: ${err}`);
      return;
    }
    showToast("success", `Questões numeradas sequencialmente de 1 a ${activeGroup.questions.length}.`);
  };

  const handleSwapQuestionOrder = async (idxA: number, idxB: number) => {
    if (!activeGroup) return;
    const list = activeGroup.questions;
    if (idxA < 0 || idxB < 0 || idxA >= list.length || idxB >= list.length) return;
    const qA = list[idxA];
    const qB = list[idxB];

    const ordA = getOrdemNum(qA) ?? idxA + 1;
    const ordB = getOrdemNum(qB) ?? idxB + 1;

    setBusy(true);
    const updates: { id: string | number; patch: Partial<BancoQuestion> }[] = [];
    if (ordA === ordB) {
      const err = await runInBatches(list, 8, async (item, i) => {
        const targetPos = i === idxA ? idxB + 1 : i === idxB ? idxA + 1 : i + 1;
        const e = await updateQuestaoByIds([item.id], { Ordem: targetPos });
        if (!e) updates.push({ id: item.id, patch: { Ordem: targetPos, ordem: targetPos } });
        return e;
      });
      setBusy(false);
      if (updates.length > 0) applyLocalPatch(updates);
      if (err) showToast("error", `Erro ao reordenar: ${err}`);
      return;
    } else {
      const [errA, errB] = await Promise.all([
        updateQuestaoByIds([qA.id], { Ordem: ordB }),
        updateQuestaoByIds([qB.id], { Ordem: ordA }),
      ]);
      setBusy(false);
      if (!errA) updates.push({ id: qA.id, patch: { Ordem: ordB, ordem: ordB } });
      if (!errB) updates.push({ id: qB.id, patch: { Ordem: ordA, ordem: ordA } });
      if (updates.length > 0) applyLocalPatch(updates);
      if (errA || errB) showToast("error", `Erro ao trocar ordem: ${errA || errB}`);
    }
  };

  const handleDetachFromSimulado = async (q: BancoQuestion) => {
    setBusy(true);
    const err = await updateQuestaoByIds([q.id], { PROVA: null });
    setBusy(false);
    if (err) {
      showToast("error", `Erro ao desvincular questão: ${err}`);
      return;
    }
    showToast("success", `Questão #${q.id} removida deste simulado.`);
    applyLocalPatch([{ id: q.id, patch: { prova: undefined } }]);
  };

  const handleAttachQuestionToGroup = async (q: BancoQuestion) => {
    if (!activeGroup) return;
    const maxOrdem = activeGroup.questions.reduce((max, item) => {
      const o = getOrdemNum(item);
      return o !== null && o > max ? o : max;
    }, activeGroup.questions.length);

    const targetProva = activeGroup.provaName === "Sem Prova" ? null : activeGroup.provaName;
    const targetBanca = activeGroup.banca === "Outras Bancas" ? null : activeGroup.banca;
    const nextOrd = maxOrdem + 1;

    setBusy(true);
    const err = await updateQuestaoByIds([q.id], {
      PROVA: targetProva,
      Banca: targetBanca,
      Ordem: nextOrd,
    });
    setBusy(false);
    if (err) {
      showToast("error", `Erro ao vincular questão: ${err}`);
      return;
    }
    showToast("success", `Questão #${q.id} adicionada na posição ${nextOrd}.`);
    applyLocalPatch([
      {
        id: q.id,
        patch: {
          prova: targetProva ?? undefined,
          Banca: targetBanca ?? undefined,
          banca: targetBanca ?? undefined,
          Ordem: nextOrd,
          ordem: nextOrd,
        },
      },
    ]);
  };

  const handleCreateCustomSimulado = async () => {
    if (!newSimProva.trim()) {
      showToast("error", "Informe o nome da prova/simulado.");
      return;
    }
    if (newSimPickIds.size === 0) {
      showToast("error", "Selecione pelo menos 1 questão para compor o simulado.");
      return;
    }

    setBusy(true);
    const picked = questions.filter((q) => newSimPickIds.has(String(q.id)));
    const cleanProva = newSimProva.trim();
    const cleanBanca = newSimBanca.trim() || null;
    const cleanAno = newSimAno.trim() || null;
    const updates: { id: string | number; patch: Partial<BancoQuestion> }[] = [];

    const err = await runInBatches(picked, 8, async (q, i) => {
      const nextOrd = i + 1;
      const payload: Record<string, string | number | null> = {
        PROVA: cleanProva,
        Banca: cleanBanca,
        Ordem: nextOrd,
      };
      if (cleanAno) payload.Ano = cleanAno;
      const e = await updateQuestaoByIds([q.id], payload);
      if (!e) {
        updates.push({
          id: q.id,
          patch: {
            prova: cleanProva,
            Banca: cleanBanca ?? undefined,
            banca: cleanBanca ?? undefined,
            Ordem: nextOrd,
            ordem: nextOrd,
            ...(cleanAno ? { Ano: cleanAno } : {}),
          },
        });
      }
      return e;
    });

    if (err) {
      setBusy(false);
      if (updates.length > 0) applyLocalPatch(updates);
      showToast("error", `Erro ao criar simulado: ${err}`);
      return;
    }

    const newKey = `${cleanBanca || "Outras Bancas"}:::${cleanProva}`;
    if (newSimTypeId) {
      await onSaveSimuladosConfig({
        ...simuladosConfig,
        bookOverrides: {
          ...simuladosConfig.bookOverrides,
          [newKey]: {
            visibility: picked.length < simuladosConfig.minQuestionsToShow ? "force_show" : "auto",
            typeId: newSimTypeId,
          },
        },
      });
    }

    setBusy(false);
    setShowCreateSimModal(false);
    setNewSimProva("");
    setNewSimBanca("");
    setNewSimAno("");
    setNewSimPickIds(new Set());
    setSelectedGroupKey(newKey);
    showToast("success", `Simulado "${cleanProva}" criado com ${picked.length} questões.`);
    applyLocalPatch(updates);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ESTADO: CONFIGURAÇÕES GLOBAIS, TIPOS E SIMULADOS CRONOMETRADOS (/simulado)
  // ───────────────────────────────────────────────────────────────────────────
  const [cfgMinQuestions, setCfgMinQuestions] = useState(String(simuladosConfig.minQuestionsToShow));
  const [cfgTreeExpanded, setCfgTreeExpanded] = useState(simuladosConfig.defaultTreeExpanded);
  const [cfgSortBancas, setCfgSortBancas] = useState<SortBancasMode>(simuladosConfig.sortBancas);
  const [cfgSortBooks, setCfgSortBooks] = useState<SortBooksMode>(simuladosConfig.sortBooks);
  const [cfgHiddenBancas, setCfgHiddenBancas] = useState<string[]>(simuladosConfig.hiddenBancas);
  const [cfgTypes, setCfgTypes] = useState<SimuladoTypeConfig[]>(simuladosConfig.simuladoTypes);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");
  const [newTypeDuration, setNewTypeDuration] = useState("120");
  const [newTypeMinQ, setNewTypeMinQ] = useState("");

  // Timed simulados (tabela `simulados` do Supabase)
  const [timedSimulados, setTimedSimulados] = useState<TimedSimuladoRow[]>([]);
  const [loadingTimed, setLoadingTimed] = useState(false);
  const [timedError, setTimedError] = useState<string | null>(null);
  const [editingTimed, setEditingTimed] = useState<{
    isNew: boolean;
    id: string;
    titulo: string;
    autor: string;
    ano: string;
    duracao_minutos: string;
    jsonText: string;
  } | null>(null);

  const fetchTimedSimulados = useCallback(async () => {
    setLoadingTimed(true);
    setTimedError(null);
    try {
      const { data, error } = await supabase
        .from("simulados")
        .select("id, titulo, autor, ano, duracao_minutos, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        setTimedError(error.message);
      } else {
        setTimedSimulados((data || []) as TimedSimuladoRow[]);
      }
    } catch (err) {
      setTimedError(err instanceof Error ? err.message : "Tabela simulados indisponível.");
    } finally {
      setLoadingTimed(false);
    }
  }, []);

  const handleOpenEditTimedSimulado = useCallback(
    async (sim: TimedSimuladoRow) => {
      setBusy(true);
      const { data, error } = await supabase
        .from("simulados")
        .select("data_json")
        .eq("id", sim.id)
        .maybeSingle();
      setBusy(false);
      if (error) {
        showToast("error", `Erro ao carregar JSON do simulado: ${error.message}`);
        return;
      }
      setEditingTimed({
        isNew: false,
        id: sim.id,
        titulo: sim.titulo || sim.title || "",
        autor: sim.autor || "",
        ano: sim.ano ? String(sim.ano) : "",
        duracao_minutos: String(sim.duracao_minutos ?? 240),
        jsonText: JSON.stringify(data?.data_json ?? sim.data_json ?? {}, null, 2),
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (subTab !== "tipos_regras") return;
    let cancelled = false;
    supabase
      .from("simulados")
      .select("id, titulo, autor, ano, duracao_minutos, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setTimedError(error.message);
        } else {
          setTimedError(null);
          setTimedSimulados((data || []) as TimedSimuladoRow[]);
        }
        setLoadingTimed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subTab]);

  const handleSaveGlobalRules = async () => {
    const minQ = Math.max(1, Math.floor(Number(cfgMinQuestions) || 8));
    setBusy(true);
    await onSaveSimuladosConfig({
      ...simuladosConfig,
      minQuestionsToShow: minQ,
      defaultTreeExpanded: cfgTreeExpanded,
      sortBancas: cfgSortBancas,
      sortBooks: cfgSortBooks,
      hiddenBancas: cfgHiddenBancas,
      simuladoTypes: cfgTypes,
    });
    setBusy(false);
    showToast("success", "Regras e tipos de simulado salvos e aplicados na biblioteca.");
  };

  const handleResetDefaultRules = async () => {
    setCfgMinQuestions(String(DEFAULT_SIMULADOS_CONFIG.minQuestionsToShow));
    setCfgTreeExpanded(DEFAULT_SIMULADOS_CONFIG.defaultTreeExpanded);
    setCfgSortBancas(DEFAULT_SIMULADOS_CONFIG.sortBancas);
    setCfgSortBooks(DEFAULT_SIMULADOS_CONFIG.sortBooks);
    setCfgHiddenBancas([]);
    setCfgTypes(DEFAULT_SIMULADOS_CONFIG.simuladoTypes);
    setBusy(true);
    await onSaveSimuladosConfig({
      ...DEFAULT_SIMULADOS_CONFIG,
      bookOverrides: simuladosConfig.bookOverrides,
    });
    setBusy(false);
    showToast("success", "Regras globais restauradas para o padrão (mínimo 8 questões).");
  };

  const handleAddSimuladoType = () => {
    const label = newTypeName.trim();
    if (!label) {
      showToast("error", "Informe o nome do tipo de simulado.");
      return;
    }
    const id = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!id || cfgTypes.some((t) => t.id === id)) {
      showToast("error", "Já existe um tipo com esse identificador.");
      return;
    }
    const minOverride =
      newTypeMinQ.trim() && Number(newTypeMinQ.trim()) >= 1
        ? Math.floor(Number(newTypeMinQ.trim()))
        : null;
    setCfgTypes((prev) => [
      ...prev,
      {
        id,
        label,
        description: newTypeDesc.trim(),
        defaultDurationMinutes: Math.max(10, Math.round(Number(newTypeDuration) || 120)),
        minQuestionsOverride: minOverride,
      },
    ]);
    setNewTypeName("");
    setNewTypeDesc("");
    setNewTypeDuration("120");
    setNewTypeMinQ("");
  };

  const handleExportGroupToTimedSimulado = async (group: SimuladoGroup) => {
    const slug = `${group.banca}-${group.provaName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const byDisc = new Map<string, BancoQuestion[]>();
    for (const q of group.questions) {
      const d = getDisciplina(q);
      const arr = byDisc.get(d);
      if (arr) arr.push(q);
      else byDisc.set(d, [q]);
    }

    const dataJson = {
      disciplinas: Array.from(byDisc.entries()).map(([nome, list]) => ({
        nome,
        questoes: list.map((q, idx) => ({
          id: q.id,
          numero: getOrdemNum(q) ?? idx + 1,
          texto: [q["Texto de apoio"], q.title, q.perguntaProblema].filter(Boolean).join("\n\n"),
          alternativas: {
            A: q["Alternativa A"] || "",
            B: q["Alternativa B"] || "",
            C: q["Alternativa C"] || "",
            D: q["Alternativa D"] || "",
            E: q["Alternativa E"] || "",
          },
          respostaCorreta: q.Gabarito || q.respostaCorreta || "A",
          explicacao: q.comentario || q["Comentário"] || q.explicacao || "",
          disciplina: nome,
        })),
      })),
    };

    const duration =
      group.override?.durationMinutes ||
      simuladosConfig.simuladoTypes.find((t) => t.id === group.override?.typeId)
        ?.defaultDurationMinutes ||
      Math.max(30, group.questions.length * 3);

    setBusy(true);
    const { error } = await supabase.from("simulados").upsert({
      id: slug || `simulado-${Date.now()}`,
      titulo: group.override?.customTitle || `${group.banca} - ${group.provaName}`,
      autor: group.banca,
      ano: group.ano || String(new Date().getFullYear()),
      duracao_minutos: duration,
      data_json: dataJson,
    });
    setBusy(false);

    if (error) {
      showToast("error", `Erro ao publicar simulado cronometrado: ${error.message}`);
      return;
    }
    showToast("success", `Publicado em /simulado?id=${slug}`);
    void fetchTimedSimulados();
  };

  const handleSaveTimedSimulado = async () => {
    if (!editingTimed) return;
    const cleanId = editingTimed.id.trim();
    if (!cleanId) {
      showToast("error", "Informe o ID único do simulado (ex: BB-2026-01).");
      return;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(editingTimed.jsonText || "{}");
    } catch {
      showToast("error", "JSON de questões inválido.");
      return;
    }

    setBusy(true);
    const payload = {
      id: cleanId,
      titulo: editingTimed.titulo.trim() || cleanId,
      autor: editingTimed.autor.trim() || null,
      ano: editingTimed.ano.trim() || null,
      duracao_minutos: Math.max(5, Math.round(Number(editingTimed.duracao_minutos) || 180)),
      data_json: parsedJson,
    };

    const { error } = editingTimed.isNew
      ? await supabase.from("simulados").insert(payload)
      : await supabase.from("simulados").upsert(payload);
    setBusy(false);

    if (error) {
      showToast("error", `Erro ao salvar simulado cronometrado: ${error.message}`);
      return;
    }
    setEditingTimed(null);
    showToast("success", `Simulado "${payload.titulo}" salvo.`);
    void fetchTimedSimulados();
  };

  const handleDeleteTimedSimulado = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("simulados").delete().eq("id", id);
    setBusy(false);
    if (error) {
      showToast("error", `Erro ao excluir simulado: ${error.message}`);
      return;
    }
    showToast("success", `Simulado "${id}" removido.`);
    void fetchTimedSimulados();
  };

  // Questões disponíveis para vincular ao simulado ativo
  const attachCandidates = useMemo(() => {
    if (!showAttachPanel || !activeGroup) return [];
    const currentSet = new Set(activeGroup.questions.map((q) => String(q.id)));
    const term = deferredAttachSearch.trim().toLowerCase();
    const out: BancoQuestion[] = [];
    for (const q of questions) {
      if (currentSet.has(String(q.id))) continue;
      if (term) {
        const hay = questionSearchIndex.get(String(q.id));
        if (!hay || !hay.includes(term)) continue;
      }
      out.push(q);
      if (out.length >= 30) break;
    }
    return out;
  }, [showAttachPanel, activeGroup, questions, questionSearchIndex, deferredAttachSearch]);

  // Questões para o modal "Criar Novo Simulado"
  const newSimCandidates = useMemo(() => {
    if (!showCreateSimModal) return [];
    const term = deferredNewSimSourceFilter.trim().toLowerCase();
    const out: BancoQuestion[] = [];
    for (const q of questions) {
      if (term) {
        const hay = questionSearchIndex.get(String(q.id));
        if (!hay || !hay.includes(term)) continue;
      }
      out.push(q);
      if (out.length >= 80) break;
    }
    return out;
  }, [showCreateSimModal, questions, questionSearchIndex, deferredNewSimSourceFilter]);

  // Callbacks estáveis para linhas memoizadas da tabela de questões
  const handleToggleSelectRow = useCallback((qKey: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qKey)) next.delete(qKey);
      else next.add(qKey);
      return next;
    });
  }, []);

  const handleDraftOrdemChange = useCallback((qKey: string, val: string) => {
    setInlineOrdemDraft((prev) => ({ ...prev, [qKey]: val }));
  }, []);

  const handleOpenResolverFromRow = useCallback(
    (q: BancoQuestion) => {
      onOpenResolver(q, filteredQuestions);
    },
    [onOpenResolver, filteredQuestions]
  );

  const handleRequestDeleteRow = useCallback((q: BancoQuestion) => {
    setDeleteTarget({
      title: `Excluir Questão #${q.id}?`,
      description: q.title || q.perguntaProblema || "Remoção permanente.",
      ids: [q.id],
    });
  }, []);

  return (
    <div className="w-full min-w-0 overflow-x-clip space-y-4">
      {/* Painel Principal Admin (Estilo SaaS Limpo) */}
      <div className="bg-[#12141a] border border-white/[0.06] rounded-xl overflow-x-clip w-full min-w-0">
        {/* Topbar de Navegação do Painel Admin */}
        <div className="px-4 py-3.5 border-b border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-blue-400" />
              <h2 className="text-sm sm:text-base font-normal text-white tracking-tight">
                Painel Administrativo
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-light tabular-nums">
              {questions.length} questões no banco · {allSimuladoGroups.length} simulados mapeados ·
              mínimo público {simuladosConfig.minQuestionsToShow} questões
            </p>
          </div>

          <div className="flex items-center bg-[#0d0f14] border border-white/[0.07] rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "questoes", label: "Questões", icon: Database },
                {
                  id: "simulados_biblioteca",
                  label: "Simulados da Biblioteca",
                  icon: BookOpen,
                },
                {
                  id: "tipos_regras",
                  label: "Tipos, Regras & Cronometrados",
                  icon: Settings2,
                },
              ] as { id: AdminSubTab; label: string; icon: React.ComponentType<{ size?: number }> }[]
            ).map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-white/[0.1] text-white font-normal"
                      : "text-slate-400 hover:text-slate-200 font-light"
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-ABA 1: GESTÃO COMPLETA DE QUESTÕES
           ═══════════════════════════════════════════════════════════════════ */}
        {subTab === "questoes" && (
          <div className="p-3 sm:p-4 space-y-4">
            {/* Ações primárias e busca */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={qSearch}
                  onChange={(e) => {
                    setQSearch(e.target.value);
                    setQPage(1);
                  }}
                  placeholder="Buscar por ID, Idq/Idg/Idtec, enunciado, prova, banca ou disciplina..."
                  className="w-full min-h-[38px] bg-[#0d0f14] border border-white/[0.08] rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
                />
                {qSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setQSearch("");
                      setQPage(1);
                    }}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNovaQuestaoModal({ open: true })}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Plus size={14} />
                  <span>Nova Questão</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportJson(true)}
                  className="px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <FileJson size={14} />
                  <span>Importar JSON</span>
                </button>

                <button
                  type="button"
                  onClick={onRefreshQuestions}
                  className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                  title="Recarregar questões do banco"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Grade de Filtros */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <select
                value={qBanca}
                onChange={(e) => {
                  setQBanca(e.target.value);
                  setQPage(1);
                }}
                aria-label="Filtrar por banca"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Banca: Todas</option>
                {allBancasList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={qProva}
                onChange={(e) => {
                  setQProva(e.target.value);
                  setQPage(1);
                }}
                aria-label="Filtrar por prova"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Prova: Todas</option>
                {allProvasList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={qDisciplina}
                onChange={(e) => {
                  setQDisciplina(e.target.value);
                  setQPage(1);
                }}
                aria-label="Filtrar por disciplina"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Disciplina: Todas</option>
                {allDisciplinasList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={qDificuldade}
                onChange={(e) => {
                  setQDificuldade(e.target.value);
                  setQPage(1);
                }}
                aria-label="Filtrar por dificuldade"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Dificuldade: Todas</option>
                {allDificuldadesList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={qStatus}
                onChange={(e) => {
                  setQStatus(e.target.value);
                  setQPage(1);
                }}
                aria-label="Filtrar por status"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Status: Todos</option>
                {allStatusList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={qPlataforma}
                onChange={(e) => {
                  setQPlataforma(e.target.value as PlataformaFiltro);
                  setQPage(1);
                }}
                aria-label="Filtrar por plataforma"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">ID: Todos</option>
                <option value="qconcursos">Qconcursos</option>
                <option value="gran">Gran</option>
                <option value="tec">TEC</option>
              </select>

              <select
                value={qOrdemFilter}
                onChange={(e) => {
                  setQOrdemFilter(e.target.value as "todas" | "com_ordem" | "sem_ordem");
                  setQPage(1);
                }}
                aria-label="Filtrar por Ordem"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="todas">Ordem: Todas</option>
                <option value="com_ordem">Com Ordem</option>
                <option value="sem_ordem">Sem Ordem</option>
              </select>

              <select
                value={qSort}
                onChange={(e) =>
                  setQSort(
                    e.target.value as
                      | "id_desc"
                      | "id_asc"
                      | "ordem_asc"
                      | "prova_asc"
                      | "banca_asc"
                  )
                }
                aria-label="Ordenar lista"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="id_desc">Mais recentes (ID ↓)</option>
                <option value="id_asc">Mais antigas (ID ↑)</option>
                <option value="ordem_asc">Coluna Ordem ↑</option>
                <option value="prova_asc">Prova A–Z</option>
                <option value="banca_asc">Banca A–Z</option>
              </select>
            </div>

            {/* Resumo & Seleção */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-3 tabular-nums">
                <span>
                  <span className="text-slate-200 font-normal">{filteredQuestions.length}</span>{" "}
                  questões encontradas
                </span>
                {selectedIds.size > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-400 font-normal">
                      {selectedIds.size} selecionadas
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedIds);
                    for (const q of pagedQuestions) next.add(String(q.id));
                    setSelectedIds(next);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Selecionar página
                </button>
                <span aria-hidden="true" className="text-white/15">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(new Set(filteredQuestions.map((q) => String(q.id))))
                  }
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Selecionar todas filtradas ({filteredQuestions.length})
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span aria-hidden="true" className="text-white/15">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Limpar seleção
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Painel de Manipulação em Lote */}
            {selectedIds.size > 0 && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-[#0d111a] border border-blue-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-xs font-normal text-blue-300">
                    Edição em lote ({selectedIds.size}{" "}
                    {selectedIds.size === 1 ? "questão" : "questões"})
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Ordem inicial:</span>
                      <input
                        type="number"
                        value={bulkStartOrdem}
                        onChange={(e) => setBulkStartOrdem(e.target.value)}
                        className="w-20 sm:w-16 bg-[#121622] border border-white/[0.1] rounded px-2 py-1 text-xs text-slate-200 tabular-nums"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleBulkRenumberOrdem()}
                        className="min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs flex items-center gap-1 transition-colors"
                      >
                        <Hash size={12} />
                        <span>Numerar Ordem</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setDeleteTarget({
                          title: `Excluir ${selectedIds.size} questões selecionadas?`,
                          description:
                            "Todas as questões marcadas serão removidas permanentemente da tabela public.questoes.",
                          ids: selectedQuestoesArray.map((q) => q.id),
                        })
                      }
                      className="min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Excluir Lote</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <input
                    type="text"
                    value={bulkProva}
                    onChange={(e) => setBulkProva(e.target.value)}
                    placeholder="Definir PROVA..."
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={bulkBanca}
                    onChange={(e) => setBulkBanca(e.target.value)}
                    placeholder="Definir Banca..."
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={bulkDisciplina}
                    onChange={(e) => setBulkDisciplina(e.target.value)}
                    placeholder="Disciplina..."
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={bulkTema}
                    onChange={(e) => setBulkTema(e.target.value)}
                    placeholder="Tema..."
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={bulkAno}
                    onChange={(e) => setBulkAno(e.target.value)}
                    placeholder="Ano..."
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                  />
                  <select
                    value={bulkDificuldade}
                    onChange={(e) => setBulkDificuldade(e.target.value)}
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-300"
                  >
                    <option value="">Dificuldade (manter)</option>
                    <option value="Fácil">Fácil</option>
                    <option value="Média">Média</option>
                    <option value="Difícil">Difícil</option>
                    <option value="Ultrahard">Ultrahard</option>
                    <option value="Atenção">Atenção</option>
                    <option value="Lacuna">Lacuna</option>
                    <option value="Bônus">Bônus</option>
                    <option value="__clear__">Limpar dificuldade</option>
                  </select>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-300"
                  >
                    <option value="">Status (manter)</option>
                    <option value="Ativa">Ativa</option>
                    <option value="Arquivada">Arquivada</option>
                    <option value="Anulada">Anulada</option>
                    <option value="Inativa">Inativa</option>
                    <option value="__clear__">Limpar status</option>
                  </select>
                  <select
                    value={bulkOrgId}
                    onChange={(e) => setBulkOrgId(e.target.value)}
                    className="bg-[#121622] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-300"
                  >
                    <option value="__keep__">Pasta (manter)</option>
                    <option value="">Sem pasta</option>
                    {orgNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleBulkApply()}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-normal flex items-center gap-1.5 transition-colors"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>Aplicar Alterações em Lote</span>
                  </button>
                </div>
              </div>
            )}

            {/* Lista Mobile (Cards responsivos para celular) */}
            <div className="md:hidden divide-y divide-white/[0.06] border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0f14]">
              {pagedQuestions.length === 0 ? (
                <div className="py-10 px-4 text-center text-sm text-slate-500">
                  Nenhuma questão encontrada com esses filtros.
                </div>
              ) : (
                pagedQuestions.map((q) => {
                  const qKey = String(q.id);
                  const isSel = selectedIds.has(qKey);
                  const curOrd = getOrdemNum(q);
                  const curOrdStr = curOrd !== null ? String(curOrd) : "";
                  const draftOrdVal = inlineOrdemDraft[qKey];
                  const draftOrd = draftOrdVal !== undefined ? draftOrdVal : curOrdStr;
                  const ordDirty = draftOrdVal !== undefined && draftOrdVal !== curOrdStr;
                  const ids = getQuestionIds(q);
                  const anulada = isQuestaoAnulada(q);

                  return (
                    <div
                      key={`mob-${qKey}`}
                      className={`p-3.5 space-y-2.5 transition-colors ${
                        isSel ? "bg-blue-600/[0.08]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => handleToggleSelectRow(qKey)}
                            aria-label={`Selecionar questão ${q.id}`}
                            className="mt-1 w-4 h-4 rounded border-white/20 bg-slate-900 accent-blue-600 shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center flex-wrap gap-1.5 text-xs">
                              <span className="font-mono text-slate-400 tabular-nums">#{q.id}</span>
                              <span className="font-mono text-emerald-400">
                                Gab: {q.Gabarito || q.respostaCorreta || "—"}
                              </span>
                              {anulada ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30">
                                  Anulada
                                </span>
                              ) : (q.dificuldade || q.status) ? (
                                <span className="text-[11px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                                  {q.dificuldade || q.status}
                                </span>
                              ) : null}
                            </div>

                            <div className="text-xs text-slate-200 font-normal break-words">
                              {q.prova || <span className="text-slate-500">Sem Prova</span>}
                              {getBanca(q) ? ` · ${getBanca(q)}` : ""}
                              {q.Ano ? ` · ${q.Ano}` : ""}
                            </div>

                            <div className="text-xs text-blue-400/90 break-words">
                              {getDisciplina(q)}
                              {q.tema ? ` · ${q.tema}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-slate-200 leading-relaxed line-clamp-3 break-words">
                        {q.title || q.perguntaProblema || "Sem enunciado"}
                      </p>

                      {(ids.idq || ids.idg || ids.idtec) && (
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-400">
                          {ids.idq && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Q:{ids.idq}</span>}
                          {ids.idg && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">G:{ids.idg}</span>}
                          {ids.idtec && <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">T:{ids.idtec}</span>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/[0.05]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Ordem:</span>
                          <input
                            type="number"
                            value={draftOrd}
                            onChange={(e) => handleDraftOrdemChange(qKey, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleSaveInlineOrdem(q);
                            }}
                            placeholder="—"
                            className="w-16 bg-[#121622] border border-white/[0.1] rounded px-2 py-1 text-slate-200 font-mono tabular-nums focus:outline-none focus:border-blue-500"
                          />
                          {ordDirty && (
                            <button
                              type="button"
                              onClick={() => void handleSaveInlineOrdem(q)}
                              title="Salvar Ordem"
                              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-500"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditQuestion(q)}
                            title="Editar questão"
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-amber-300"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicateQuestion(q)}
                            title="Duplicar questão"
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-blue-300"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenResolverFromRow(q)}
                            title="Abrir no resolvedor"
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-emerald-300"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteRow(q)}
                            title="Excluir questão"
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tabela de Alta Densidade (Desktop) */}
            <div className="hidden md:block border border-white/[0.06] rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[920px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#0d0f14] text-[11px] font-normal text-slate-400">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          pagedQuestions.length > 0 &&
                          pagedQuestions.every((q) => selectedIds.has(String(q.id)))
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            for (const q of pagedQuestions) {
                              if (checked) next.add(String(q.id));
                              else next.delete(String(q.id));
                            }
                            return next;
                          });
                        }}
                        aria-label="Selecionar página atual"
                        className="rounded border-white/20 bg-slate-900 accent-blue-600"
                      />
                    </th>
                    <th className="py-2.5 px-2.5 w-20">ID</th>
                    <th className="py-2.5 px-2.5 w-28">Ordem</th>
                    <th className="py-2.5 px-3 w-48">Banca · Prova · Ano</th>
                    <th className="py-2.5 px-3 w-44">Disciplina · Tema</th>
                    <th className="py-2.5 px-3">Enunciado / Pergunta</th>
                    <th className="py-2.5 px-2.5 w-28">Gab. / Dif.</th>
                    <th className="py-2.5 px-2.5 w-32">IDs</th>
                    <th className="py-2.5 px-3 w-36 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-xs">
                  {pagedQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        Nenhuma questão encontrada com esses filtros.
                      </td>
                    </tr>
                  ) : (
                    pagedQuestions.map((q) => {
                      const qKey = String(q.id);
                      return (
                        <AdminQuestionRow
                          key={qKey}
                          q={q}
                          isSel={selectedIds.has(qKey)}
                          draftOrdVal={inlineOrdemDraft[qKey]}
                          onToggleSelect={handleToggleSelectRow}
                          onDraftChange={handleDraftOrdemChange}
                          onSaveInlineOrdem={(item) => void handleSaveInlineOrdem(item)}
                          onEditQuestion={onEditQuestion}
                          onDuplicateQuestion={(item) => void handleDuplicateQuestion(item)}
                          onOpenResolverSingle={handleOpenResolverFromRow}
                          onRequestDelete={handleRequestDeleteRow}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1 text-xs text-slate-400 tabular-nums">
                <span>
                  Página {safePage} de {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setQPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-[#0d0f14] border border-white/[0.07] disabled:opacity-35 hover:text-white transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setQPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-[#0d0f14] border border-white/[0.07] disabled:opacity-35 hover:text-white transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-ABA 2: SIMULADOS DA BIBLIOTECA (eBooks 3D)
           ═══════════════════════════════════════════════════════════════════ */}
        {subTab === "simulados_biblioteca" && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={simSearch}
                    onChange={(e) => setSimSearch(e.target.value)}
                    placeholder="Buscar simulado, banca, disciplina ou ano..."
                    className="w-full min-h-[38px] bg-[#0d0f14] border border-white/[0.07] rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <select
                  value={simBancaFilter}
                  onChange={(e) => setSimBancaFilter(e.target.value)}
                  aria-label="Filtrar por banca"
                  className="min-h-[38px] bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                >
                  <option value="todas">Todas as bancas</option>
                  {Array.from(new Set(allSimuladoGroups.map((g) => g.banca))).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={simVisFilter}
                  onChange={(e) =>
                    setSimVisFilter(
                      e.target.value as "todos" | "visiveis" | "abaixo" | "ocultos" | "forcados"
                    )
                  }
                  aria-label="Filtrar por visibilidade"
                  className="min-h-[38px] bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                >
                  <option value="todos">Visibilidade: Todos</option>
                  <option value="visiveis">Visíveis na biblioteca</option>
                  <option value="abaixo">
                    Abaixo do mínimo (&lt; {simuladosConfig.minQuestionsToShow} qs)
                  </option>
                  <option value="ocultos">Ocultos manualmente</option>
                  <option value="forcados">Forçados a exibir</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateSimModal(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus size={14} />
                <span>Criar Simulado com Questões</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Lista de todos os Simulados */}
              <div className="lg:col-span-5 border border-white/[0.06] rounded-xl bg-[#0d0f14] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400 tabular-nums">
                  <span>{filteredSimuladoGroups.length} simulados listados</span>
                  <span>Mínimo público: {simuladosConfig.minQuestionsToShow} qs</span>
                </div>
                <div className="max-h-[640px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.05]">
                  {filteredSimuladoGroups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Nenhum simulado encontrado.
                    </div>
                  ) : (
                    <>
                      {filteredSimuladoGroups.slice(0, simListLimit).map((g) => {
                        const isSelected = activeGroup?.key === g.key;
                        const typeLabel = g.override?.typeId
                          ? simuladosConfig.simuladoTypes.find((t) => t.id === g.override?.typeId)
                              ?.label
                          : undefined;
                        const visMode = g.override?.visibility ?? "auto";
                        const statusText =
                          visMode === "hide" || simuladosConfig.hiddenBancas.includes(g.banca)
                            ? "Oculto"
                            : visMode === "force_show"
                            ? "Forçado"
                            : g.isVisibleInLibrary
                            ? "Visível"
                            : `Oculto (< ${simuladosConfig.minQuestionsToShow} qs)`;

                        return (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => selectGroupForEdit(g)}
                            className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-start justify-between gap-2 ${
                              isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs font-normal text-slate-100 truncate">
                                {g.override?.customTitle || g.provaName}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {g.banca}
                                {g.ano ? ` · ${g.ano}` : ""}
                                {typeLabel ? ` · ${typeLabel}` : ""}
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5 tabular-nums">
                              <div className="text-xs font-mono text-slate-200">
                                {g.questions.length} qs
                              </div>
                              <div
                                className={`text-[10.5px] ${
                                  g.isVisibleInLibrary ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                {statusText}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {filteredSimuladoGroups.length > simListLimit && (
                        <div className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSimListLimit((v) => v + 80)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-xs font-normal text-slate-300"
                          >
                            Mostrar mais (+{Math.min(80, filteredSimuladoGroups.length - simListLimit)})
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Editor do Simulado Selecionado */}
              <div className="lg:col-span-7 border border-white/[0.06] rounded-xl bg-[#0d0f14] p-4 space-y-5">
                {!activeGroup ? (
                  <div className="py-20 text-center space-y-2">
                    <ClipboardList className="w-7 h-7 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      Selecione um simulado à esquerda para editar metadados, tipo, visibilidade e
                      reordenar questões.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Cabeçalho do Simulado Selecionado */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">
                          {activeGroup.banca} · {activeGroup.questions.length} questões (
                          {activeGroup.withOrderCount} com Ordem)
                        </div>
                        <h3 className="text-base font-normal text-white truncate">
                          {activeGroup.override?.customTitle || activeGroup.provaName}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {activeGroup.isVisibleInLibrary && (
                          <button
                            type="button"
                            onClick={() => onOpenSimuladoInLibrary(activeGroup.key)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Eye size={13} />
                            <span>Abrir na Biblioteca</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleExportGroupToTimedSimulado(activeGroup)}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Timer size={13} />
                          <span>Publicar em /simulado</span>
                        </button>
                      </div>
                    </div>

                    {/* Bloco 1: Metadados em Lote no Supabase */}
                    <div className="space-y-3 pb-4 border-b border-white/[0.06]">
                      <div className="text-xs font-normal text-slate-200">
                        Dados nas Questões (atualiza todas as {activeGroup.questions.length} questões
                        no banco)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Nome da Prova (PROVA)
                          </label>
                          <input
                            type="text"
                            value={editSimProva}
                            onChange={(e) => setEditSimProva(e.target.value)}
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Banca</label>
                          <input
                            type="text"
                            value={editSimBanca}
                            onChange={(e) => setEditSimBanca(e.target.value)}
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Ano</label>
                          <input
                            type="text"
                            value={editSimAno}
                            onChange={(e) => setEditSimAno(e.target.value)}
                            placeholder="Opcional"
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <select
                            value={mergeTargetKey}
                            onChange={(e) => setMergeTargetKey(e.target.value)}
                            aria-label="Mesclar com outro simulado"
                            className="bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 w-full sm:w-auto sm:max-w-[220px]"
                          >
                            <option value="">Mesclar com outro simulado...</option>
                            {allSimuladoGroups
                              .filter((g) => g.key !== activeGroup.key)
                              .map((g) => (
                                <option key={g.key} value={g.key}>
                                  {g.banca} · {g.provaName}
                                </option>
                              ))}
                          </select>
                          {mergeTargetKey && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleMergeSimulado()}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-slate-200 text-xs flex items-center gap-1"
                            >
                              <Merge size={12} />
                              <span>Mesclar</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setDeleteTarget({
                                title: `Excluir todas as ${activeGroup.questions.length} questões de "${activeGroup.provaName}"?`,
                                description:
                                  "Todas as questões deste simulado serão excluídas permanentemente do banco.",
                                ids: activeGroup.questions.map((q) => q.id),
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            <span>Excluir Simulado</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSaveSimuladoBatchMetadata()}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal flex items-center gap-1.5"
                          >
                            <Save size={12} />
                            <span>Salvar no Banco</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Configurações Individuais do Tipo e Exibição */}
                    <div className="space-y-3 pb-4 border-b border-white/[0.06]">
                      <div className="text-xs font-normal text-slate-200">
                        Configuração na Biblioteca (Tipo, Visibilidade e Capa)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Tipo de Simulado
                          </label>
                          <select
                            value={ovTypeId}
                            onChange={(e) => setOvTypeId(e.target.value)}
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="">Padrão (sem tipo específico)</option>
                            {simuladosConfig.simuladoTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Regra de Visibilidade
                          </label>
                          <select
                            value={ovVisibility}
                            onChange={(e) =>
                              setOvVisibility(e.target.value as SimuladoVisibilityMode)
                            }
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="auto">
                              Automática (&ge; {simuladosConfig.minQuestionsToShow} qs)
                            </option>
                            <option value="force_show">Forçar exibir sempre</option>
                            <option value="hide">Ocultar da biblioteca</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Cor da Capa 3D
                          </label>
                          <select
                            value={ovPaletteIdx}
                            onChange={(e) => setOvPaletteIdx(e.target.value)}
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            <option value="auto">{PALETTE_LABELS[0]}</option>
                            {PALETTE_LABELS.slice(1).map((label, idx) => (
                              <option key={label} value={String(idx)}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Título Personalizado na Estante (Opcional)
                          </label>
                          <input
                            type="text"
                            value={ovCustomTitle}
                            onChange={(e) => setOvCustomTitle(e.target.value)}
                            placeholder={activeGroup.provaName}
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Duração Sugerida (min)
                          </label>
                          <input
                            type="number"
                            value={ovDuration}
                            onChange={(e) => setOvDuration(e.target.value)}
                            placeholder="Ex: 240"
                            className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Descrição / Instruções ao Aluno (Opcional)
                        </label>
                        <input
                          type="text"
                          value={ovInstructions}
                          onChange={(e) => setOvInstructions(e.target.value)}
                          placeholder="Observações exibidas ao abrir o caderno..."
                          className="w-full bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSaveGroupOverride()}
                          className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-normal flex items-center gap-1.5 transition-colors"
                        >
                          <Save size={12} />
                          <span>Salvar Configuração do Simulado</span>
                        </button>
                      </div>
                    </div>

                    {/* Bloco 3: Questões e Sequência (Ordem) dentro do Simulado */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-normal text-slate-200">
                          Questões e Ordem ({activeGroup.questions.length})
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRenumberGroupQuestions()}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Hash size={12} />
                            <span>Numerar 1..N</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAttachPanel((p) => !p)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Layers size={12} />
                            <span>Vincular Existente</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNovaQuestaoModal({
                                open: true,
                                prova:
                                  activeGroup.provaName === "Sem Prova"
                                    ? ""
                                    : activeGroup.provaName,
                                banca:
                                  activeGroup.banca === "Outras Bancas" ? "" : activeGroup.banca,
                                ordem: activeGroup.questions.length + 1,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 transition-colors"
                          >
                            <Plus size={12} />
                            <span>Nova neste Simulado</span>
                          </button>
                        </div>
                      </div>

                      {showAttachPanel && (
                        <div className="p-3 rounded-lg bg-[#12141a] border border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={attachSearch}
                              onChange={(e) => setAttachSearch(e.target.value)}
                              placeholder="Pesquisar questão do banco para adicionar a este simulado..."
                              className="flex-1 bg-[#0d0f14] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAttachPanel(false)}
                              className="p-1 text-slate-400 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-white/[0.05]">
                            {attachCandidates.map((cand) => (
                              <div
                                key={cand.id}
                                className="py-1.5 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="text-slate-200 truncate">
                                    #{cand.id} · {cand.title || cand.perguntaProblema || "Sem texto"}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {getDisciplina(cand)} · {cand.prova || "Sem prova"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleAttachQuestionToGroup(cand)}
                                  className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 text-[11px] shrink-0"
                                >
                                  + Adicionar
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="max-h-[360px] overflow-y-auto custom-scrollbar border border-white/[0.06] rounded-lg divide-y divide-white/[0.05]">
                        {activeGroup.questions.slice(0, activeGroupQuestionsLimit).map((q, idx) => {
                          const ord = getOrdemNum(q);
                          return (
                            <div
                              key={q.id}
                              className="px-3 py-2.5 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.025] text-xs"
                            >
                              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                <span className="w-8 font-mono text-[11px] text-slate-400 tabular-nums shrink-0 pt-0.5 sm:pt-0">
                                  {ord !== null ? `#${ord}` : "—"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-slate-200 line-clamp-2 sm:truncate">
                                    {q.title || q.perguntaProblema || `Questão #${q.id}`}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate tabular-nums flex flex-wrap items-center gap-1.5">
                                    <span>
                                      ID {q.id} · {getDisciplina(q)} · Gab:{" "}
                                      {q.Gabarito || q.respostaCorreta || "—"}
                                    </span>
                                    {isQuestaoAnulada(q) && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium text-amber-300 bg-amber-500/15 border border-amber-500/30 shrink-0">
                                        Anulada
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={busy || idx === 0}
                                  onClick={() => void handleSwapQuestionOrder(idx, idx - 1)}
                                  title="Subir na ordem"
                                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1 rounded text-slate-400 hover:text-white disabled:opacity-25"
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || idx === activeGroup.questions.length - 1}
                                  onClick={() => void handleSwapQuestionOrder(idx, idx + 1)}
                                  title="Descer na ordem"
                                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1 rounded text-slate-400 hover:text-white disabled:opacity-25"
                                >
                                  <ArrowDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditQuestion(q)}
                                  title="Editar questão"
                                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1 rounded text-slate-400 hover:text-amber-300"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleDetachFromSimulado(q)}
                                  title="Remover deste simulado (limpa PROVA)"
                                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1 rounded text-slate-400 hover:text-rose-400"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {activeGroup.questions.length > activeGroupQuestionsLimit && (
                          <div className="p-2.5 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveGroupQuestionsLimit((v) => v + 80)}
                              className="px-3 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-xs font-normal text-slate-300"
                            >
                              Mostrar mais (+{Math.min(80, activeGroup.questions.length - activeGroupQuestionsLimit)})
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveGroupQuestionsLimit(activeGroup.questions.length)}
                              className="px-2.5 py-1 rounded text-xs font-normal text-blue-400 hover:text-blue-300"
                            >
                              Exibir todas ({activeGroup.questions.length})
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-ABA 3: TIPOS, REGRAS GLOBAIS & SIMULADOS CRONOMETRADOS
           ═══════════════════════════════════════════════════════════════════ */}
        {subTab === "tipos_regras" && (
          <div className="p-4 space-y-6">
            {/* Seção 1: Regras da Biblioteca */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6 border-b border-white/[0.06]">
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-normal text-white">
                    Regras da Biblioteca de Simulados
                  </h3>
                  <p className="text-xs text-slate-400 font-light">
                    Controle quais cadernos aparecem automaticamente e como a árvore é ordenada.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Mínimo de questões para exibir
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={cfgMinQuestions}
                      onChange={(e) => setCfgMinQuestions(e.target.value)}
                      className="w-full bg-[#0d0f14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200 tabular-nums"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Padrão 8 (exibe apenas simulados com mais de 7 questões).
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Estado inicial da árvore
                    </label>
                    <select
                      value={cfgTreeExpanded ? "expanded" : "collapsed"}
                      onChange={(e) => setCfgTreeExpanded(e.target.value === "expanded")}
                      className="w-full bg-[#0d0f14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="collapsed">Recolhida por padrão</option>
                      <option value="expanded">Expandida por padrão</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Ordenação das Bancas
                    </label>
                    <select
                      value={cfgSortBancas}
                      onChange={(e) => setCfgSortBancas(e.target.value as SortBancasMode)}
                      className="w-full bg-[#0d0f14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="alpha">Alfabética (A–Z)</option>
                      <option value="cadernos_desc">Mais cadernos primeiro</option>
                      <option value="questions_desc">Mais questões primeiro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Ordenação dos Cadernos
                    </label>
                    <select
                      value={cfgSortBooks}
                      onChange={(e) => setCfgSortBooks(e.target.value as SortBooksMode)}
                      className="w-full bg-[#0d0f14] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="alpha">Alfabética (A–Z)</option>
                      <option value="year_desc">Mais recentes (Ano ↓)</option>
                      <option value="questions_desc">Mais questões primeiro</option>
                      <option value="progress_desc">Maior progresso primeiro</option>
                    </select>
                  </div>
                </div>

                {/* Visibilidade por Banca */}
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400">
                    Visibilidade por Banca (clique para ocultar ou exibir na aba Simulados)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(allSimuladoGroups.map((g) => g.banca))).map((banca) => {
                      const isHidden = cfgHiddenBancas.includes(banca);
                      return (
                        <button
                          key={banca}
                          type="button"
                          onClick={() =>
                            setCfgHiddenBancas((prev) =>
                              prev.includes(banca)
                                ? prev.filter((item) => item !== banca)
                                : [...prev, banca]
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                            isHidden
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                              : "bg-[#0d0f14] border-white/[0.08] text-slate-300 hover:border-white/20"
                          }`}
                        >
                          {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                          <span>{banca}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveGlobalRules()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal flex items-center gap-1.5"
                  >
                    <Save size={13} />
                    <span>Salvar Regras & Tipos</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResetDefaultRules()}
                    className="px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>Restaurar Padrão</span>
                  </button>
                </div>
              </div>

              {/* Seção 2: Tipos de Simulado */}
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-normal text-white">Tipos de Simulado</h3>
                  <p className="text-xs text-slate-400 font-light">
                    Defina categorias com duração padrão e regra mínima própria de questões.
                  </p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {cfgTypes.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-[#0d0f14] border border-white/[0.07] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-normal text-slate-100">{t.label}</div>
                        {t.description && (
                          <div className="text-[11px] text-slate-400">{t.description}</div>
                        )}
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          Duração padrão: {t.defaultDurationMinutes} min · Mínimo:{" "}
                          {t.minQuestionsOverride ?? `Global (${cfgMinQuestions})`} qs
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCfgTypes((prev) => prev.filter((item) => item.id !== t.id))
                        }
                        title="Remover tipo"
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-[#0d0f14] border border-white/[0.07] space-y-2.5">
                  <div className="text-xs font-normal text-slate-300">Adicionar novo tipo</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Nome (ex: Simulado Final)"
                      className="bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      value={newTypeDesc}
                      onChange={(e) => setNewTypeDesc(e.target.value)}
                      placeholder="Descrição breve..."
                      className="bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    />
                    <input
                      type="number"
                      value={newTypeDuration}
                      onChange={(e) => setNewTypeDuration(e.target.value)}
                      placeholder="Duração padrão (min)"
                      className="bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 tabular-nums"
                    />
                    <input
                      type="number"
                      value={newTypeMinQ}
                      onChange={(e) => setNewTypeMinQ(e.target.value)}
                      placeholder="Mín. questões (opcional)"
                      className="bg-[#12141a] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSimuladoType}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    <span>Adicionar Tipo (salve as regras ao lado)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Seção 3: Simulados Cronometrados (/simulado?id=...) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-normal text-white">
                    Simulados Cronometrados (Tabela simulados · rota /simulado)
                  </h3>
                  <p className="text-xs text-slate-400 font-light">
                    Gerencie provas completas com cronômetro, tentativas ativas e ranking.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchTimedSimulados()}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={loadingTimed ? "animate-spin" : ""} />
                    <span>Atualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTimed({
                        isNew: true,
                        id: `simulado-${Date.now()}`,
                        titulo: "",
                        autor: "CESGRANRIO",
                        ano: String(new Date().getFullYear()),
                        duracao_minutos: "240",
                        jsonText: JSON.stringify({ disciplinas: [] }, null, 2),
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-normal flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    <span>Novo Simulado Cronometrado</span>
                  </button>
                </div>
              </div>

              {timedError && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300">
                  Aviso ao consultar tabela <code>simulados</code>: {timedError}
                </div>
              )}

              {/* Lista Mobile de Simulados Cronometrados */}
              <div className="md:hidden divide-y divide-white/[0.05] border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0f14]">
                {timedSimulados.length === 0 ? (
                  <div className="py-8 px-4 text-center text-sm text-slate-500">
                    {loadingTimed
                      ? "Carregando simulados cronometrados..."
                      : "Nenhum simulado cronometrado cadastrado na tabela simulados."}
                  </div>
                ) : (
                  timedSimulados.map((sim) => (
                    <div key={`mob-timed-${sim.id}`} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm text-slate-100 font-normal break-words">
                            {sim.titulo || sim.title || "Sem título"}
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-slate-500">{sim.id}</span>
                            <span>·</span>
                            <span>{sim.autor || "—"}</span>
                            {sim.ano ? <span>· {sim.ano}</span> : null}
                            <span>·</span>
                            <span className="font-mono text-slate-300 tabular-nums">
                              {sim.duracao_minutos ?? 300} min
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <a
                          href={`/simulado?id=${encodeURIComponent(sim.id)}`}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs inline-flex items-center gap-1.5"
                        >
                          <ExternalLink size={12} />
                          <span>Abrir</span>
                        </a>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleOpenEditTimedSimulado(sim)}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-amber-300"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTimedSimulado(sim.id)}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-rose-400"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tabela Desktop de Simulados Cronometrados */}
              <div className="hidden md:block border border-white/[0.06] rounded-xl overflow-x-auto bg-[#0d0f14]">
                <table className="w-full text-left border-collapse min-w-[680px] text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] font-normal text-slate-400">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Título</th>
                      <th className="py-2.5 px-3">Autor / Ano</th>
                      <th className="py-2.5 px-3">Duração</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {timedSimulados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          {loadingTimed
                            ? "Carregando simulados cronometrados..."
                            : "Nenhum simulado cronometrado cadastrado na tabela simulados."}
                        </td>
                      </tr>
                    ) : (
                      timedSimulados.map((sim) => (
                        <tr key={sim.id} className="hover:bg-white/[0.025]">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                            {sim.id}
                          </td>
                          <td className="py-2.5 px-3 text-slate-100 font-normal">
                            {sim.titulo || sim.title || "Sem título"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {sim.autor || "—"} {sim.ano ? `· ${sim.ano}` : ""}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 tabular-nums">
                            {sim.duracao_minutos ?? 300} min
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/simulado?id=${encodeURIComponent(sim.id)}`}
                                className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-[11px] inline-flex items-center gap-1"
                              >
                                <ExternalLink size={11} />
                                <span>Abrir</span>
                              </a>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleOpenEditTimedSimulado(sim)}
                                className="p-1.5 rounded text-slate-400 hover:text-amber-300 hover:bg-white/[0.06]"
                                title="Editar"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteTimedSimulado(sim.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar Novo Simulado (a partir de questões do banco) */}
      {showCreateSimModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-black/80">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-normal text-white">
                Criar Novo Simulado com Questões do Banco
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateSimModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nome do Simulado</label>
                  <input
                    type="text"
                    value={newSimProva}
                    onChange={(e) => setNewSimProva(e.target.value)}
                    placeholder="Ex: Simulado Revisão Final"
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Banca</label>
                  <input
                    type="text"
                    value={newSimBanca}
                    onChange={(e) => setNewSimBanca(e.target.value)}
                    placeholder="Ex: CESGRANRIO"
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Ano</label>
                  <input
                    type="text"
                    value={newSimAno}
                    onChange={(e) => setNewSimAno(e.target.value)}
                    placeholder="2026"
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tipo de Simulado</label>
                  <select
                    value={newSimTypeId}
                    onChange={(e) => setNewSimTypeId(e.target.value)}
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    {simuladosConfig.simuladoTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    Selecionar questões ({newSimPickIds.size} marcadas)
                  </span>
                  <input
                    type="text"
                    value={newSimSourceFilter}
                    onChange={(e) => setNewSimSourceFilter(e.target.value)}
                    placeholder="Filtrar questões..."
                    className="w-56 bg-[#111623] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-slate-200"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar border border-white/[0.06] rounded-lg divide-y divide-white/[0.05]">
                  {newSimCandidates.map((q) => {
                    const key = String(q.id);
                    const checked = newSimPickIds.has(key);
                    return (
                      <label
                        key={key}
                        className="px-3 py-2 flex items-start gap-2.5 cursor-pointer hover:bg-white/[0.03] text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setNewSimPickIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          className="mt-0.5 rounded accent-blue-600"
                        />
                        <div className="min-w-0">
                          <div className="text-slate-200 line-clamp-1">
                            #{q.id} · {q.title || q.perguntaProblema || "Sem enunciado"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {getDisciplina(q)} · {getBanca(q) || "Sem banca"} ·{" "}
                            {q.prova || "Sem prova"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-white/[0.06] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateSimModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateCustomSimulado()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-normal flex items-center gap-1.5"
              >
                <Plus size={13} />
                <span>Criar Simulado</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Simulado Cronometrado (/simulado) */}
      {editingTimed && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-black/80">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-normal text-white">
                {editingTimed.isNew
                  ? "Novo Simulado Cronometrado"
                  : `Editar Simulado: ${editingTimed.id}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTimed(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">ID (URL ?id=...)</label>
                  <input
                    type="text"
                    disabled={!editingTimed.isNew}
                    value={editingTimed.id}
                    onChange={(e) =>
                      setEditingTimed((prev) => (prev ? { ...prev, id: e.target.value } : null))
                    }
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Título</label>
                  <input
                    type="text"
                    value={editingTimed.titulo}
                    onChange={(e) =>
                      setEditingTimed((prev) => (prev ? { ...prev, titulo: e.target.value } : null))
                    }
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Autor / Banca</label>
                  <input
                    type="text"
                    value={editingTimed.autor}
                    onChange={(e) =>
                      setEditingTimed((prev) => (prev ? { ...prev, autor: e.target.value } : null))
                    }
                    className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Ano</label>
                    <input
                      type="text"
                      value={editingTimed.ano}
                      onChange={(e) =>
                        setEditingTimed((prev) => (prev ? { ...prev, ano: e.target.value } : null))
                      }
                      className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Duração (min)</label>
                    <input
                      type="number"
                      value={editingTimed.duracao_minutos}
                      onChange={(e) =>
                        setEditingTimed((prev) =>
                          prev ? { ...prev, duracao_minutos: e.target.value } : null
                        )
                      }
                      className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 tabular-nums"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Estrutura JSON (data_json)
                </label>
                <textarea
                  rows={12}
                  value={editingTimed.jsonText}
                  onChange={(e) =>
                    setEditingTimed((prev) => (prev ? { ...prev, jsonText: e.target.value } : null))
                  }
                  className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-3 text-[11px] font-mono text-slate-200 leading-relaxed"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-white/[0.06] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTimed(null)}
                className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSaveTimedSimulado()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-normal flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>Salvar Simulado</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md bg-[#0c1220] border border-rose-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-normal text-white">{deleteTarget.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                  {deleteTarget.description}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-white/[0.1] text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-normal flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais Nova Questão & Importar JSON */}
      <ModalNovaQuestao
        isOpen={novaQuestaoModal.open}
        onClose={() => setNovaQuestaoModal({ open: false })}
        orgNodes={orgNodes}
        defaultProva={novaQuestaoModal.prova}
        defaultBanca={novaQuestaoModal.banca}
        defaultDisciplina={novaQuestaoModal.disciplina}
        defaultOrdem={novaQuestaoModal.ordem}
        onCreated={() => {
          showToast("success", "Nova questão adicionada ao banco.");
          onRefreshQuestions();
        }}
      />

      <ImportJsonModal
        isOpen={showImportJson}
        onClose={() => setShowImportJson(false)}
        onSuccess={() => {
          showToast("success", "Questões importadas com sucesso.");
          onRefreshQuestions();
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[120] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-normal shadow-lg ${
            toast.type === "success"
              ? "bg-[#0b1628] border-emerald-500/40 text-emerald-300"
              : "bg-[#251016] border-rose-500/40 text-rose-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <XCircle size={15} className="text-rose-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
