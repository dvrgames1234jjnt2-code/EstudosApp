"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  FolderOpen,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  BinderRightMode,
  StudyCornerBlock,
  StudyCornerCasoGroup,
  StudyCornerQuestion,
  UserAnswerStat,
} from "./types";

export const CATEGORY_META: Record<string, { label: string; emoji: string; accent: string }> = {
  bonus: { label: "Bônus", emoji: "🎉", accent: "#f59e0b" },
  faceis: { label: "Fácil", emoji: "🟢", accent: "#10b981" },
  atencao: { label: "Atenção", emoji: "🔵", accent: "#38bdf8" },
  lacuna: { label: "Lacuna", emoji: "⛳", accent: "#f97316" },
  media: { label: "Média", emoji: "🟠", accent: "#fb923c" },
  dificil: { label: "Difícil", emoji: "🔴", accent: "#f43f5e" },
  ultrahard: { label: "Ultra Hard", emoji: "🟣", accent: "#c084fc" },
  dominada: { label: "Dominada", emoji: "🏆", accent: "#fbbf24" },
  treinar: { label: "Treinar", emoji: "🧠", accent: "#60a5fa" },
  revisar: { label: "Revisar", emoji: "🔁", accent: "#a78bfa" },
};

const CARD_PALETTES = [
  "from-[#492246] to-[#231029]",
  "from-[#1f3b5c] to-[#101c33]",
  "from-[#513122] to-[#26160f]",
  "from-[#1f493d] to-[#0f2620]",
  "from-[#3a2859] to-[#1b122e]",
  "from-[#542838] to-[#29111b]",
];

const cleanId = (id: string) => id.replace(/-/g, "").toLowerCase();

export interface UseBinderStudyStateParams {
  blocks: StudyCornerBlock[];
  questions: StudyCornerQuestion[];
  resultadosMap: Map<string, UserAnswerStat>;
  duvidasIds: Set<string>;
  onRecordAnswer: (questaoId: string, isCorrect: boolean) => Promise<void>;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

export function useBinderStudyState({
  blocks,
  questions,
  resultadosMap,
  duvidasIds,
  onRecordAnswer,
  isAuthenticated,
  onRequireAuth,
}: UseBinderStudyStateParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMateria, setSelectedMateria] = useState<string>("Todas");
  const [rightMode, setRightMode] = useState<BinderRightMode>("cadernos");
  const [pageIndex, setPageIndex] = useState(0);
  const [onlyAnswered, setOnlyAnswered] = useState(false);

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [expandedCasos, setExpandedCasos] = useState<Set<string>>(new Set());
  const [sheetFilter, setSheetFilter] = useState<"todos" | "erros" | "duvidas" | "pendentes">("todos");
  const [showGabarito, setShowGabarito] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const questionsByBlock = useMemo(() => {
    const map = new Map<string, StudyCornerQuestion[]>();
    for (const q of questions) {
      const key = cleanId(q.bloco_raiz_id || "");
      const arr = map.get(key) ?? [];
      arr.push(q);
      map.set(key, arr);
    }
    return map;
  }, [questions]);

  const materiasList = useMemo(() => {
    const map = new Map<
      string,
      {
        materia: string;
        blocks: StudyCornerBlock[];
        totalQ: number;
        answeredQ: number;
        correctQ: number;
      }
    >();

    for (const b of blocks) {
      const mat = b.materia?.trim() || "Geral";
      const entry = map.get(mat) ?? {
        materia: mat,
        blocks: [],
        totalQ: 0,
        answeredQ: 0,
        correctQ: 0,
      };
      entry.blocks.push(b);
      const qs = questionsByBlock.get(cleanId(b.block_id)) ?? [];
      entry.totalQ += qs.length;
      for (const q of qs) {
        const st = resultadosMap.get(q.id);
        if (st) {
          entry.answeredQ++;
          if (st.ultimo === "acerto") entry.correctQ++;
        }
      }
      map.set(mat, entry);
    }

    return Array.from(map.values());
  }, [blocks, questionsByBlock, resultadosMap]);

  const globalTotals = useMemo(() => {
    let answered = 0;
    let acertos = 0;
    let duvidas = 0;
    for (const q of questions) {
      const st = resultadosMap.get(q.id);
      if (st) {
        answered++;
        if (st.ultimo === "acerto") acertos++;
      }
      if (duvidasIds.has(q.id)) duvidas++;
    }
    return {
      total: questions.length,
      answered,
      acertos,
      duvidas,
      cadernos: blocks.length,
    };
  }, [questions, blocks.length, resultadosMap, duvidasIds]);

  const filteredCadernos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return blocks
      .filter((b) => {
        const mat = b.materia?.trim() || "Geral";
        if (selectedMateria !== "Todas" && mat !== selectedMateria) return false;
        const bQs = questionsByBlock.get(cleanId(b.block_id)) ?? [];
        if (onlyAnswered && !bQs.some((item) => resultadosMap.has(item.id))) return false;
        if (!q) return true;
        if (b.nome.toLowerCase().includes(q) || mat.toLowerCase().includes(q)) return true;
        return bQs.some(
          (item) =>
            item.caso_nome.toLowerCase().includes(q) ||
            item.topico.toLowerCase().includes(q) ||
            item.numero.toLowerCase().includes(q)
        );
      })
      .map((b) => {
        const bQs = questionsByBlock.get(cleanId(b.block_id)) ?? [];
        const casosSet = new Set(bQs.map((item) => item.caso_nome || "Geral"));
        let answered = 0;
        let correct = 0;
        for (const item of bQs) {
          const st = resultadosMap.get(item.id);
          if (st) {
            answered++;
            if (st.ultimo === "acerto") correct++;
          }
        }
        return {
          block: b,
          questions: bQs,
          casosCount: casosSet.size,
          answered,
          correct,
        };
      });
  }, [blocks, selectedMateria, searchQuery, onlyAnswered, questionsByBlock, resultadosMap]);

  const filteredQuestionCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const blockByCleanId = new Map(blocks.map((b) => [cleanId(b.block_id), b]));
    return questions.filter((item) => {
      const parentBlock = blockByCleanId.get(cleanId(item.bloco_raiz_id));
      const mat = parentBlock?.materia?.trim() || "Geral";
      if (selectedMateria !== "Todas" && mat !== selectedMateria) return false;
      if (onlyAnswered && !resultadosMap.has(item.id)) return false;
      if (!q) return true;
      return (
        item.numero.toLowerCase().includes(q) ||
        item.topico.toLowerCase().includes(q) ||
        item.caso_nome.toLowerCase().includes(q) ||
        (parentBlock?.nome.toLowerCase().includes(q) ?? false)
      );
    });
  }, [questions, blocks, selectedMateria, onlyAnswered, searchQuery, resultadosMap]);

  const itemsPerPage = 9;
  const currentTotalItems = rightMode === "cadernos" ? filteredCadernos.length : filteredQuestionCards.length;
  const totalPages = Math.max(1, Math.ceil(currentTotalItems / itemsPerPage));
  const safePage = Math.min(pageIndex, totalPages - 1);
  const visibleCadernos = filteredCadernos.slice(safePage * itemsPerPage, (safePage + 1) * itemsPerPage);
  const visibleQuestions = filteredQuestionCards.slice(safePage * itemsPerPage, (safePage + 1) * itemsPerPage);

  const activeBlock = useMemo(
    () => blocks.find((b) => cleanId(b.block_id) === cleanId(activeBlockId || "")) ?? null,
    [blocks, activeBlockId]
  );

  const activeBlockCasos = useMemo<StudyCornerCasoGroup[]>(() => {
    if (!activeBlock) return [];
    const list = questionsByBlock.get(cleanId(activeBlock.block_id)) ?? [];
    const groups = new Map<string, StudyCornerCasoGroup>();

    for (const q of list) {
      const st = resultadosMap.get(q.id);
      const isDuvida = duvidasIds.has(q.id);
      if (sheetFilter === "erros" && st?.ultimo !== "erro") continue;
      if (sheetFilter === "duvidas" && !isDuvida) continue;
      if (sheetFilter === "pendentes" && st) continue;

      const cKey = q.caso_id || q.caso_nome || "geral";
      const g = groups.get(cKey) ?? {
        casoId: cKey,
        casoNome: q.caso_nome || "Geral",
        questions: [],
      };
      g.questions.push(q);
      groups.set(cKey, g);
    }

    for (const g of groups.values()) {
      g.questions.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    }

    return Array.from(groups.values());
  }, [activeBlock, questionsByBlock, resultadosMap, duvidasIds, sheetFilter]);

  const activeQuestion = useMemo(() => {
    if (!activeQuestionId) return null;
    return questions.find((q) => q.id === activeQuestionId) ?? null;
  }, [questions, activeQuestionId]);

  const openBlockSheet = (block: StudyCornerBlock, focusQuestion?: StudyCornerQuestion) => {
    const qs = questionsByBlock.get(cleanId(block.block_id)) ?? [];
    const allCasoKeys = new Set(qs.map((q) => q.caso_id || q.caso_nome || "geral"));
    setActiveBlockId(block.block_id);
    setExpandedCasos(allCasoKeys);
    setSheetFilter("todos");
    setShowGabarito(false);
    if (focusQuestion) {
      setActiveQuestionId(focusQuestion.id);
    } else if (qs.length > 0) {
      setActiveQuestionId(qs[0].id);
    } else {
      setActiveQuestionId(null);
    }
  };

  const handleOpenQuestionCard = (q: StudyCornerQuestion) => {
    const parent = blocks.find((b) => cleanId(b.block_id) === cleanId(q.bloco_raiz_id));
    if (parent) {
      openBlockSheet(parent, q);
    } else {
      setActiveBlockId(q.bloco_raiz_id);
      setActiveQuestionId(q.id);
      setExpandedCasos(new Set([q.caso_id || q.caso_nome || "geral"]));
      setShowGabarito(false);
    }
  };

  const closeSheet = () => {
    setActiveBlockId(null);
    setActiveQuestionId(null);
    setShowGabarito(false);
  };

  const handleAnswer = async (isCorrect: boolean) => {
    if (!activeQuestion) return;
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setSavingAnswer(true);
    try {
      await onRecordAnswer(activeQuestion.id, isCorrect);
    } finally {
      setSavingAnswer(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedMateria,
    setSelectedMateria,
    rightMode,
    setRightMode,
    pageIndex,
    setPageIndex,
    onlyAnswered,
    setOnlyAnswered,
    activeBlockId,
    activeBlock,
    activeQuestion,
    activeBlockCasos,
    expandedCasos,
    setExpandedCasos,
    sheetFilter,
    setSheetFilter,
    showGabarito,
    setShowGabarito,
    savingAnswer,
    zoomImg,
    setZoomImg,
    materiasList,
    globalTotals,
    filteredCadernos,
    filteredQuestionCards,
    visibleCadernos,
    visibleQuestions,
    safePage,
    totalPages,
    openBlockSheet,
    handleOpenQuestionCard,
    setActiveQuestionId,
    closeSheet,
    handleAnswer,
  };
}

export type BinderStudyState = ReturnType<typeof useBinderStudyState>;

/* ── 3D SurfaceGui Left Page (mounted inside left CSS3DObject) ─────────────── */
export function BinderLeftSurface({ state }: { state: BinderStudyState }) {
  const { globalTotals, materiasList, selectedMateria, setSelectedMateria, setPageIndex } = state;

  return (
    <div className="w-[480px] h-[622px] bg-[#2d1328] text-[#fbf2e1] p-6 pr-8 flex flex-col justify-between select-none border border-[#56274d] rounded-[10px]">
      <div className="min-h-0 flex flex-col flex-1">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#d6b782]/90 font-medium">
          Notion Questions
        </div>
        <div className="mt-1 flex items-baseline gap-2 tabular-nums">
          <span className="text-[32px] leading-none font-light text-[#fbf2e1]">
            {globalTotals.answered}
          </span>
          <span className="text-xs text-[#cbb18b]">/ {globalTotals.total} respondidas</span>
        </div>

        <div className="mt-3 h-1.5 w-full rounded-full bg-[#1a0b17] overflow-hidden border border-[#e3be76]/25">
          <div
            className="h-full bg-[#e3be76] transition-all duration-300"
            style={{
              width: `${globalTotals.total > 0 ? Math.min(100, (globalTotals.answered / globalTotals.total) * 100) : 0}%`,
            }}
          />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1.5 space-y-2">
          <button
            type="button"
            onClick={() => {
              setSelectedMateria("Todas");
              setPageIndex(0);
            }}
            className={`w-full text-left py-1.5 border-b transition-colors cursor-pointer ${
              selectedMateria === "Todas"
                ? "border-[#e7c47a] text-[#fff6e5]"
                : "border-[#e7c47a]/25 text-[#d7be9b] hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium">
              <span>Todas as Matérias</span>
              <span className="tabular-nums text-[11px]">
                {globalTotals.answered} / {globalTotals.total}
              </span>
            </div>
          </button>

          {materiasList.map((m) => {
            const isSelected = selectedMateria === m.materia;
            const pct = m.totalQ > 0 ? Math.round((m.answeredQ / m.totalQ) * 100) : 0;
            return (
              <button
                key={m.materia}
                type="button"
                onClick={() => {
                  setSelectedMateria(m.materia);
                  setPageIndex(0);
                }}
                className={`w-full text-left py-1 transition-colors cursor-pointer ${
                  isSelected ? "text-[#fff4df]" : "text-[#d5bc99]/85 hover:text-[#fff4df]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`truncate ${isSelected ? "font-semibold" : "font-normal"}`}>
                    {m.materia}
                  </span>
                  <span className="tabular-nums text-[11px] shrink-0">
                    {m.answeredQ} / {m.totalQ}
                  </span>
                </div>
                <div className="mt-1 h-[2px] w-full bg-[#4a2342] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isSelected ? "bg-[#f0cb7e]" : "bg-[#c79e59]/75"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-[#e3be76]/25 grid grid-cols-2 gap-4 text-[#f5e7cf]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#c7ac85]">
            Taxa de Acerto
          </div>
          <div className="text-base font-medium tabular-nums mt-0.5">
            {globalTotals.answered > 0
              ? `${Math.round((globalTotals.acertos / globalTotals.answered) * 100)}%`
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#c7ac85]">
            Cadernos Ativos
          </div>
          <div className="text-base font-medium tabular-nums mt-0.5">{globalTotals.cadernos}</div>
        </div>
      </div>
    </div>
  );
}

/* ── 3D SurfaceGui Right Page (mounted inside right CSS3DObject) ───────────── */
export function BinderRightSurface({
  state,
  resultadosMap,
  duvidasIds,
}: {
  state: BinderStudyState;
  resultadosMap: Map<string, UserAnswerStat>;
  duvidasIds: Set<string>;
}) {
  const {
    rightMode,
    setRightMode,
    setPageIndex,
    onlyAnswered,
    setOnlyAnswered,
    filteredCadernos,
    filteredQuestionCards,
    visibleCadernos,
    visibleQuestions,
    safePage,
    totalPages,
    openBlockSheet,
    handleOpenQuestionCard,
  } = state;

  const currentTotalItems =
    rightMode === "cadernos" ? filteredCadernos.length : filteredQuestionCards.length;

  return (
    <div className="w-[480px] h-[622px] bg-[#0d0a0f] text-[#fbf2e1] p-4 pl-7 flex flex-col justify-between select-none border border-[#2f1d2f] rounded-[10px]">
      {/* Right Top Controls */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1 bg-[#18121d] p-0.5 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => {
              setRightMode("cadernos");
              setPageIndex(0);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              rightMode === "cadernos"
                ? "bg-[#e3be76] text-[#1f121e]"
                : "text-[#cdb79a] hover:text-white"
            }`}
          >
            Cadernos ({filteredCadernos.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setRightMode("questoes");
              setPageIndex(0);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              rightMode === "questoes"
                ? "bg-[#e3be76] text-[#1f121e]"
                : "text-[#cdb79a] hover:text-white"
            }`}
          >
            Questões ({filteredQuestionCards.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setOnlyAnswered((v) => !v);
            setPageIndex(0);
          }}
          className={`px-2 py-1 rounded-md text-[10px] border transition-colors cursor-pointer whitespace-nowrap ${
            onlyAnswered
              ? "bg-[#e3be76]/20 border-[#e3be76]/60 text-[#f6ddab]"
              : "border-white/10 text-[#b7a38a] hover:text-white"
          }`}
        >
          Respondidos
        </button>
      </div>

      {/* 3x3 Card Pockets Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-3 gap-2">
        {rightMode === "cadernos"
          ? visibleCadernos.map((entry, idx) => {
              const palette = CARD_PALETTES[(safePage * 9 + idx) % CARD_PALETTES.length];
              const pct =
                entry.questions.length > 0
                  ? Math.round((entry.answered / entry.questions.length) * 100)
                  : 0;
              const acc =
                entry.answered > 0 ? Math.round((entry.correct / entry.answered) * 100) : null;

              return (
                <button
                  key={entry.block.id}
                  type="button"
                  onClick={() => openBlockSheet(entry.block)}
                  className={`group rounded-lg border border-[#e3be76]/28 hover:border-[#f0ce86] bg-gradient-to-br ${palette} p-2.5 flex flex-col justify-between text-left transition-transform hover:-translate-y-0.5 cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[9px] text-[#e7cf9e]/85 truncate">
                      {entry.block.materia || "Geral"}
                    </span>
                    {acc !== null && (
                      <span className="text-[9px] font-semibold text-emerald-300 tabular-nums shrink-0">
                        {acc}%
                      </span>
                    )}
                  </div>

                  <div className="my-1">
                    <div className="text-[11px] font-semibold text-[#fbf3e4] leading-snug line-clamp-2 group-hover:text-[#ffe4aa]">
                      {entry.block.nome}
                    </div>
                    <div className="mt-1 text-[9px] text-[#d4bfa2]/80 tabular-nums">
                      {entry.casosCount} casos · {entry.questions.length} q
                    </div>
                  </div>

                  <div className="h-1 w-full rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-[#ecc87c] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })
          : visibleQuestions.map((q, idx) => {
              const st = resultadosMap.get(q.id);
              const isDuvida = duvidasIds.has(q.id);
              const cat = CATEGORY_META[q.categoria] ?? CATEGORY_META.media;
              const palette = CARD_PALETTES[(safePage * 9 + idx) % CARD_PALETTES.length];

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleOpenQuestionCard(q)}
                  className={`group rounded-lg border p-2.5 flex flex-col justify-between text-left transition-transform hover:-translate-y-0.5 cursor-pointer bg-gradient-to-br ${palette} ${
                    st?.ultimo === "acerto"
                      ? "border-emerald-400/55"
                      : st?.ultimo === "erro"
                      ? "border-rose-400/55"
                      : "border-[#e3be76]/28 hover:border-[#f0ce86]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[9px]">
                    <span className="truncate">
                      {cat.emoji} {cat.label}
                    </span>
                    {isDuvida && <Flag size={9} className="text-amber-300 fill-amber-300/30 shrink-0" />}
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-[#fbf3e4] group-hover:text-[#ffe4aa] tabular-nums">
                      Questão {q.numero || "—"}
                    </div>
                    <div className="text-[9px] text-[#e1cdb1]/85 truncate mt-0.5">{q.caso_nome}</div>
                    {q.topico && (
                      <div className="text-[9px] text-[#cbb69a]/75 truncate">{q.topico}</div>
                    )}
                  </div>

                  <div className="text-[9px] font-medium">
                    {st?.ultimo === "acerto" ? (
                      <span className="text-emerald-300">Acertou</span>
                    ) : st?.ultimo === "erro" ? (
                      <span className="text-rose-300">Errou</span>
                    ) : (
                      <span className="text-[#c5b093]">Pendente</span>
                    )}
                  </div>
                </button>
              );
            })}

        {currentTotalItems === 0 && (
          <div className="col-span-3 row-span-3 flex items-center justify-center text-xs text-[#9e8a72]">
            Nenhum item encontrado.
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-[#d6be9c]">
        <button
          type="button"
          disabled={safePage === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="tabular-nums text-[11px]">
          {safePage + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
          className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 cursor-pointer"
          aria-label="Próxima página"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Minimal Floating HUD (when 3D binder is open) + Case Study Sheet ──────── */
export function BinderHudAndSheet({
  state,
  resultadosMap,
  duvidasIds,
  onCloseToDesk,
  onToggleDuvida,
  isAuthenticated,
  onRequireAuth,
  zoomedIn,
  onToggleZoom,
}: {
  state: BinderStudyState;
  resultadosMap: Map<string, UserAnswerStat>;
  duvidasIds: Set<string>;
  onCloseToDesk: () => void;
  onToggleDuvida: (questaoId: string, marcar: boolean) => Promise<void>;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  zoomedIn?: boolean;
  onToggleZoom?: () => void;
}) {
  const {
    searchQuery,
    setSearchQuery,
    selectedMateria,
    setSelectedMateria,
    setPageIndex,
    materiasList,
    globalTotals,
    activeBlockId,
    activeBlock,
    activeQuestion,
    activeBlockCasos,
    expandedCasos,
    setExpandedCasos,
    sheetFilter,
    setSheetFilter,
    showGabarito,
    setShowGabarito,
    savingAnswer,
    zoomImg,
    setZoomImg,
    setActiveQuestionId,
    closeSheet,
    handleAnswer,
  } = state;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none select-none">
      {/* Top Bar over 3D Desk (Escrivaninha / Zoom / Search / Stats) */}
      <div className="flex items-center justify-between gap-3 flex-wrap pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (activeBlockId) closeSheet();
              else onCloseToDesk();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1019]/95 hover:bg-[#2a1929] border border-[#d4af6a]/35 text-[#f4e6cc] text-xs font-medium transition-colors shadow-lg cursor-pointer"
          >
            <ArrowLeft size={14} className="text-[#e7c47a]" />
            <span>{activeBlockId ? "Voltar ao Caderno" : "Escrivaninha"}</span>
          </button>

          {!activeBlockId && onToggleZoom && (
            <button
              type="button"
              onClick={onToggleZoom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#1a1019]/95 hover:bg-[#2a1929] border border-[#d4af6a]/35 text-[#f4e6cc] text-xs font-medium transition-colors shadow-lg cursor-pointer"
              title={zoomedIn ? "Afastar câmera" : "Aproximar caderno"}
            >
              {zoomedIn ? (
                <ZoomOut size={14} className="text-[#e7c47a]" />
              ) : (
                <ZoomIn size={14} className="text-[#e7c47a]" />
              )}
              <span>{zoomedIn ? "Afastar" : "Aproximar"}</span>
            </button>
          )}
        </div>

        {!activeBlockId && (
          <div className="flex-1 max-w-md mx-auto pointer-events-auto">
            <label className="relative flex items-center w-full">
              <Search size={14} className="absolute left-3.5 text-[#d8b982]/70 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPageIndex(0);
                }}
                placeholder="Pesquise matérias, cadernos ou questões..."
                className="w-full pl-9 pr-8 py-2 rounded-full bg-[#170f17]/92 border border-[#d4af6a]/30 text-xs text-[#f6ead3] placeholder-[#b9a080]/60 focus:outline-none focus:border-[#e7c47a]/70 shadow-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-[#b9a080] hover:text-white cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </label>
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-[#1a1019]/92 border border-[#d4af6a]/25 text-xs text-[#f2e2c6] shadow-lg tabular-nums">
          <span>
            <strong className="text-[#e8c67c] font-semibold">{globalTotals.acertos}</strong> acertos
          </span>
          <span className="text-[#d4af6a]/40">·</span>
          <span>
            <strong className="text-amber-300 font-semibold">{globalTotals.duvidas}</strong> dúvidas
          </span>
        </div>
      </div>

      {/* Center: ONLY shown when user clicked a Caderno / Questão to open the Case Sheet ("Folha") */}
      {activeBlockId && (
        <div className="flex-1 min-h-0 flex items-center justify-center my-2 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-6xl h-full max-h-[680px] rounded-2xl bg-[#19121e]/98 border border-[#d4af6a]/35 shadow-2xl flex flex-col overflow-hidden">
            {/* Sheet Header */}
            <div className="px-5 py-3.5 border-b border-[#d4af6a]/20 bg-[#231426] flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-[#d6b782]">
                  <span>{activeBlock?.materia || "Caderno"}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeBlockCasos.length} casos</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-[#fbf2e1] truncate">
                  {activeBlock?.nome || "Folha de Casos"}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 bg-[#130c16] p-1 rounded-lg border border-[#d4af6a]/20">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "erros", label: "Erros" },
                  { id: "duvidas", label: "Dúvidas" },
                  { id: "pendentes", label: "Pendentes" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSheetFilter(f.id as typeof sheetFilter)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      sheetFilter === f.id
                        ? "bg-[#d4af6a] text-[#1f121e]"
                        : "text-[#cdb593] hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Sheet Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#d4af6a]/15 overflow-y-auto p-4 space-y-3 bg-[#150e19]">
                {activeBlockCasos.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#b59d82]">
                    Nenhum caso encontrado com o filtro selecionado.
                  </div>
                ) : (
                  activeBlockCasos.map((caso) => {
                    const isExpanded = expandedCasos.has(caso.casoId);
                    let cAcertos = 0;
                    let cErros = 0;
                    for (const q of caso.questions) {
                      const st = resultadosMap.get(q.id);
                      if (st?.ultimo === "acerto") cAcertos++;
                      else if (st?.ultimo === "erro") cErros++;
                    }
                    return (
                      <div
                        key={caso.casoId}
                        className="rounded-xl border border-[#d4af6a]/20 bg-[#1e1424] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCasos((prev) => {
                              const next = new Set(prev);
                              if (next.has(caso.casoId)) next.delete(caso.casoId);
                              else next.add(caso.casoId);
                              return next;
                            })
                          }
                          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen size={14} className="text-[#e2be79] shrink-0" />
                            <span className="text-xs font-medium text-[#f5e9d4] truncate">
                              {caso.casoNome}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] shrink-0 tabular-nums text-[#bfa98c]">
                            <span className="text-emerald-400">{cAcertos}✓</span>
                            <span className="text-rose-400">{cErros}✕</span>
                            <span>{caso.questions.length} q</span>
                            <ChevronDown
                              size={13}
                              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-[#d4af6a]/10">
                            {caso.questions.map((q) => {
                              const st = resultadosMap.get(q.id);
                              const isDuvida = duvidasIds.has(q.id);
                              const isCurrent = activeQuestion?.id === q.id;
                              const cat = CATEGORY_META[q.categoria] ?? CATEGORY_META.media;

                              let tileClass =
                                "bg-[#120b16] border-[#d4af6a]/20 text-[#dcd0be] hover:border-[#e6c47e]/60";
                              if (st?.ultimo === "acerto") {
                                tileClass =
                                  "bg-emerald-950/70 border-emerald-500/45 text-emerald-200";
                              } else if (st?.ultimo === "erro") {
                                tileClass = "bg-rose-950/70 border-rose-500/45 text-rose-200";
                              }
                              if (isCurrent) {
                                tileClass += " ring-2 ring-[#ecc982]";
                              }

                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveQuestionId(q.id);
                                    setShowGabarito(false);
                                  }}
                                  title={`Questão ${q.numero || "?"} ${q.topico ? "— " + q.topico : ""}`}
                                  className={`relative px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${tileClass}`}
                                >
                                  <span>{cat.emoji}</span>
                                  <span>{q.numero || "Q"}</span>
                                  {q.topico && (
                                    <span className="max-w-[95px] truncate text-[10px] opacity-80">
                                      {q.topico}
                                    </span>
                                  )}
                                  {isDuvida && (
                                    <Flag size={10} className="text-amber-300 fill-amber-300/30" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Active Question Cream Paper Sheet */}
              <div className="lg:col-span-7 overflow-y-auto p-5 sm:p-6 bg-[#f7f0e3] text-[#281e19] flex flex-col gap-4">
                {!activeQuestion ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-[#766353]">
                    <BookOpen size={28} className="opacity-50" />
                    <p className="text-sm font-medium">
                      Selecione uma questão ao lado para abrir na folha
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 border-b border-[#d9cbb5] pb-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-[#755f4c]">
                          <span>{activeQuestion.caso_nome}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {(CATEGORY_META[activeQuestion.categoria] ?? CATEGORY_META.media).emoji}{" "}
                            {(CATEGORY_META[activeQuestion.categoria] ?? CATEGORY_META.media).label}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-[#221814] mt-0.5">
                          Questão {activeQuestion.numero || "—"}
                          {activeQuestion.topico ? ` — ${activeQuestion.topico}` : ""}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingAnswer}
                          onClick={() => handleAnswer(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            resultadosMap.get(activeQuestion.id)?.ultimo === "acerto"
                              ? "bg-emerald-700 border-emerald-700 text-white"
                              : "bg-white border-emerald-600/40 text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          <Check size={13} /> Acertei
                        </button>
                        <button
                          type="button"
                          disabled={savingAnswer}
                          onClick={() => handleAnswer(false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            resultadosMap.get(activeQuestion.id)?.ultimo === "erro"
                              ? "bg-rose-700 border-rose-700 text-white"
                              : "bg-white border-rose-600/40 text-rose-800 hover:bg-rose-50"
                          }`}
                        >
                          <X size={13} /> Errei
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthenticated) {
                              onRequireAuth();
                              return;
                            }
                            onToggleDuvida(
                              activeQuestion.id,
                              !duvidasIds.has(activeQuestion.id)
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            duvidasIds.has(activeQuestion.id)
                              ? "bg-amber-500 border-amber-600 text-white"
                              : "bg-white border-amber-600/40 text-amber-800 hover:bg-amber-50"
                          }`}
                        >
                          <Flag size={12} /> Dúvida
                        </button>
                      </div>
                    </div>

                    {activeQuestion.enunciado_texto && (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#2b2019] bg-white/75 rounded-xl p-4 border border-[#e3d7c3]">
                        {activeQuestion.enunciado_texto}
                      </div>
                    )}

                    {activeQuestion.imagens_urls.length > 0 && (
                      <div className="space-y-3">
                        {activeQuestion.imagens_urls.map((url, idx) => (
                          <div
                            key={`${url}-${idx}`}
                            className="relative group rounded-xl overflow-hidden border border-[#d8cbb4] bg-white"
                          >
                            <img
                              src={url}
                              alt={`Enunciado da questão ${activeQuestion.numero}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-auto max-h-[380px] object-contain mx-auto"
                            />
                            <button
                              type="button"
                              onClick={() => setZoomImg(url)}
                              className="absolute bottom-2.5 right-2.5 p-2 rounded-lg bg-[#1d141c]/85 text-[#f7ecd7] opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                              title="Ampliar imagem"
                            >
                              <ZoomIn size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {!activeQuestion.enunciado_texto &&
                      activeQuestion.imagens_urls.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[#cbbba2] p-6 text-center text-xs text-[#7c6957]">
                          Esta questão ainda não possui imagem ou enunciado sincronizado no Supabase.
                        </div>
                      )}

                    <div className="pt-2 border-t border-[#dfd2bc]">
                      <button
                        type="button"
                        onClick={() => setShowGabarito((v) => !v)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2e1b2c] hover:bg-[#3f243c] text-[#f7e7c8] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {showGabarito ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showGabarito ? "Ocultar Gabarito" : "Ver Gabarito / Resposta"}</span>
                      </button>

                      {showGabarito && (
                        <div className="mt-3 rounded-xl bg-white border border-[#d8cbb4] p-4 space-y-3">
                          {activeQuestion.gabarito_texto && (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#241a15]">
                              {activeQuestion.gabarito_texto}
                            </p>
                          )}
                          {activeQuestion.gabarito_imagens_urls.map((url, idx) => (
                            <div
                              key={`${url}-${idx}`}
                              className="relative rounded-lg overflow-hidden border border-[#e3d7c3]"
                            >
                              <img
                                src={url}
                                alt={`Gabarito da questão ${activeQuestion.numero}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-auto max-h-[340px] object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => setZoomImg(url)}
                                className="absolute bottom-2 right-2 p-1.5 rounded-md bg-[#1d141c]/85 text-white cursor-pointer"
                                title="Ampliar gabarito"
                              >
                                <ZoomIn size={13} />
                              </button>
                            </div>
                          ))}
                          {!activeQuestion.gabarito_texto &&
                            activeQuestion.gabarito_imagens_urls.length === 0 && (
                              <p className="text-xs text-[#7b6857]">
                                Nenhum gabarito registrado para esta questão ainda.
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Subject Quick Strip (over desk when SurfaceGui binder is open) */}
      {!activeBlockId && (
        <div className="flex items-center justify-center gap-3 flex-wrap pointer-events-auto pb-1 mt-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedMateria("Todas");
              setPageIndex(0);
            }}
            className={`text-xs pb-0.5 border-b transition-colors cursor-pointer whitespace-nowrap ${
              selectedMateria === "Todas"
                ? "text-[#fff3da] border-[#e7c47a]"
                : "text-[#cbb597]/75 border-transparent hover:text-white"
            }`}
          >
            Todas
          </button>
          {materiasList.slice(0, 7).map((m) => (
            <button
              key={m.materia}
              type="button"
              onClick={() => {
                setSelectedMateria(m.materia);
                setPageIndex(0);
              }}
              className={`text-xs pb-0.5 border-b transition-colors cursor-pointer whitespace-nowrap max-w-[140px] truncate ${
                selectedMateria === m.materia
                  ? "text-[#fff3da] border-[#e7c47a]"
                  : "text-[#cbb597]/75 border-transparent hover:text-white"
              }`}
            >
              {m.materia}
            </button>
          ))}
        </div>
      )}

      {/* Image Zoom Lightbox */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 pointer-events-auto cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setZoomImg(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Fechar ampliação"
          >
            <X size={18} />
          </button>
          <img
            src={zoomImg}
            alt="Ampliação da questão"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
