"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock3,
  Folder,
  FolderOpen,
  PlayCircle,
  Search,
  X,
  AlertCircle,
  Circle,
  Ban,
  Printer,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import { PrintSimuladoModal } from "./PrintSimuladoModal";
import { isQuestaoAnulada, sortQuestoesByOrdem } from "../../lib/questionService";
import {
  DEFAULT_SIMULADOS_CONFIG,
  shouldShowBookInLibrary,
  type SimuladosConfig,
} from "../../lib/simuladosConfig";

export interface SimuladoUserAnswer {
  isCorrect: boolean;
  lastAnswer: string;
  errorCount: number;
  timestamp: number;
}

interface SimuladosTabProps {
  questions: BancoQuestion[];
  userAnswers: Record<string, SimuladoUserAnswer>;
  selectedSimuladoKey: string | null;
  onSelectSimuladoKey: (key: string | null) => void;
  onStartSimulado: (orderedQuestions: BancoQuestion[], startIndex: number) => void;
  onOpenDesempenho: (orderedQuestions: BancoQuestion[]) => void;
  config?: SimuladosConfig;
}

type StatusSimulado = "nao_iniciado" | "em_andamento" | "concluido";
type StatusFilter = "todos" | "nao_iniciados" | "em_andamento" | "concluidos";

interface SimuladoBook {
  key: string;
  banca: string;
  provaName: string;
  displayTitle: string;
  typeLabel?: string;
  durationMinutes?: number;
  instructions?: string;
  paletteIndex?: number | null;
  ano?: string;
  disciplinaPrincipal: string;
  questions: BancoQuestion[];
  answered: number;
  correct: number;
  errors: number;
  remaining: number;
  progress: number;
  accuracy: number;
  status: StatusSimulado;
}

interface BancaShelf {
  banca: string;
  books: SimuladoBook[];
  totalQuestoes: number;
  respondidas: number;
  acertos: number;
  concluidos: number;
}

interface CoverPalette {
  coverBg: string;
  spineBg: string;
  accentLine: string;
  bancaText: string;
}

const COVER_PALETTES: CoverPalette[] = [
  {
    coverBg: "from-[#162136] via-[#101829] to-[#0a101d]",
    spineBg: "bg-[#090e1a]",
    accentLine: "bg-sky-400/35",
    bancaText: "text-sky-300/80",
  },
  {
    coverBg: "from-[#152824] via-[#0f1d1a] to-[#091311]",
    spineBg: "bg-[#08100e]",
    accentLine: "bg-emerald-400/35",
    bancaText: "text-emerald-300/80",
  },
  {
    coverBg: "from-[#271b24] via-[#1c131a] to-[#120c11]",
    spineBg: "bg-[#0e090d]",
    accentLine: "bg-rose-400/35",
    bancaText: "text-rose-300/80",
  },
  {
    coverBg: "from-[#262016] via-[#1c1710] to-[#120e0a]",
    spineBg: "bg-[#0e0b08]",
    accentLine: "bg-amber-400/35",
    bancaText: "text-amber-300/80",
  },
  {
    coverBg: "from-[#1e1d33] via-[#151426] to-[#0d0c18]",
    spineBg: "bg-[#090913]",
    accentLine: "bg-indigo-400/35",
    bancaText: "text-indigo-300/80",
  },
  {
    coverBg: "from-[#1b222c] via-[#131921] to-[#0c1016]",
    spineBg: "bg-[#090c11]",
    accentLine: "bg-slate-400/35",
    bancaText: "text-slate-300/80",
  },
];

function getPaletteForBanca(banca: string, paletteIndex?: number | null): CoverPalette {
  if (
    typeof paletteIndex === "number" &&
    paletteIndex >= 0 &&
    paletteIndex < COVER_PALETTES.length
  ) {
    return COVER_PALETTES[paletteIndex];
  }
  let hash = 0;
  for (let i = 0; i < banca.length; i += 1) {
    hash = (hash * 31 + banca.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTES[hash % COVER_PALETTES.length];
}

function getBancaName(q: BancoQuestion): string {
  const raw = String(q.Banca ?? q.banca ?? "").trim();
  return raw;
}

function getDisciplinaName(q: BancoQuestion): string {
  return String(q.Disciplina ?? q.disciplina ?? q.materia ?? "Geral").trim() || "Geral";
}

function Ebook3DCard({
  book,
  palette,
  onClick,
}: {
  book: SimuladoBook;
  palette: CoverPalette;
  onClick: () => void;
}) {
  const statusLabel =
    book.status === "concluido"
      ? "Concluído"
      : book.status === "em_andamento"
      ? "Em andamento"
      : "Não iniciado";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left pt-1 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-lg"
    >
      {/* Palco com perspectiva 3D compacto */}
      <div
        className="relative mx-auto w-full max-w-full sm:max-w-[138px] aspect-[3/4]"
        style={{ perspective: "950px" }}
      >
        {/* Sombra na prateleira */}
        <div
          aria-hidden="true"
          className="hidden sm:block absolute -bottom-2 left-2.5 right-1 h-3 rounded-full bg-black/75 blur-[6px] transition-transform duration-300 ease-out group-hover:scale-x-105 group-hover:opacity-90 motion-reduce:transition-none"
        />

        {/* Volume 3D do eBook (reto no mobile para leitura sem zoom; inclinado no desktop) */}
        <div
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-full h-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [transform:none] sm:[transform:rotateY(-15deg)_rotateX(3deg)] sm:group-hover:[transform:rotateY(-3deg)_rotateX(0deg)_translateY(-5px)]"
        >
          {/* Contracapa (fundo traseiro com leve saliência) */}
          <div
            aria-hidden="true"
            style={{ transform: "translateZ(-6px)" }}
            className={`hidden sm:block absolute inset-0 rounded-r-[7px] rounded-l-[2px] border border-white/[0.08] ${palette.spineBg}`}
          />

          {/* Bloco lateral de páginas (espessura 3D real no eixo X+) */}
          <div
            aria-hidden="true"
            style={{
              transformOrigin: "right center",
              transform: "translateZ(6px) rotateY(-90deg)",
              backgroundImage:
                "repeating-linear-gradient(to right, #d4cec2 0px, #d4cec2 1px, #b4ada0 1px, #b4ada0 2px)",
            }}
            className="hidden sm:block absolute top-[3px] bottom-[3px] right-[1.5px] w-[12px] rounded-r-[2px] shadow-inner"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
          </div>

          {/* Fita marcadora para provas iniciadas ou concluídas */}
          {book.status !== "nao_iniciado" && (
            <div
              aria-hidden="true"
              style={{
                transform: "translateZ(4px)",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
              }}
              className={`absolute -bottom-2 right-3.5 w-2.5 h-3.5 ${
                book.status === "concluido" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          )}

          {/* Capa frontal do eBook */}
          <div
            style={{ transform: "translateZ(6px)" }}
            className={`relative w-full h-full rounded-lg sm:rounded-r-[7px] sm:rounded-l-[2px] bg-gradient-to-br ${palette.coverBg} border border-white/[0.11] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col justify-between p-3 sm:p-2.5`}
          >
            {/* Vinco físico da lombada */}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/45 via-black/15 to-transparent pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-[8px] w-[1.5px] bg-gradient-to-r from-black/50 to-white/[0.1] pointer-events-none"
            />

            {/* Brilho diagonal sutil de capa dura */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-black/25 pointer-events-none"
            />

            {/* Cabeçalho da capa: Banca e Ano */}
            <div className="relative pl-1.5 space-y-1">
              <div className="flex items-center justify-between gap-1 text-[10.5px] sm:text-[8.5px] tracking-[0.06em] sm:tracking-[0.1em] uppercase">
                <span className={`truncate font-normal ${palette.bancaText}`}>
                  {book.banca}
                </span>
                {book.ano && (
                  <span className="text-white/55 sm:text-white/45 font-mono tabular-nums shrink-0">
                    {book.ano}
                  </span>
                )}
              </div>
              <div className={`h-[1px] w-7 ${palette.accentLine}`} />
            </div>

            {/* Título central da Prova */}
            <div className="relative pl-1.5 my-auto py-1 space-y-1">
              <h3 className="text-[13px] sm:text-[11px] font-normal text-slate-100 leading-[1.35] sm:leading-[1.3] line-clamp-3 [text-wrap:balance] group-hover:text-white transition-colors">
                {book.displayTitle}
              </h3>
              <p className="text-[11px] sm:text-[9.5px] text-slate-400 truncate">
                {book.typeLabel ? `${book.typeLabel} · ${book.disciplinaPrincipal}` : book.disciplinaPrincipal}
              </p>
            </div>

            {/* Rodapé da capa: Progresso e Status */}
            <div className="relative pl-1.5 space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-[9px] text-slate-300 sm:text-slate-400 tabular-nums">
                <span>
                  {book.questions.length} {book.questions.length === 1 ? "q." : "qs."}
                </span>
                <span className="font-mono text-slate-200 sm:text-slate-300">{book.progress}%</span>
              </div>

              <div className="h-[3px] sm:h-[2.5px] w-full rounded-full bg-black/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    book.status === "concluido"
                      ? "bg-emerald-400"
                      : book.status === "em_andamento"
                      ? "bg-amber-400"
                      : "bg-slate-600"
                  }`}
                  style={{ width: `${book.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1 text-[10.5px] sm:text-[8.5px]">
                <span
                  className={`flex items-center gap-1 truncate ${
                    book.status === "concluido"
                      ? "text-emerald-300"
                      : book.status === "em_andamento"
                      ? "text-amber-300"
                      : "text-slate-300 sm:text-slate-400"
                  }`}
                >
                  {book.status === "concluido" ? (
                    <CheckCircle2 size={10} className="shrink-0 sm:w-[9px] sm:h-[9px]" />
                  ) : book.status === "em_andamento" ? (
                    <Clock3 size={10} className="shrink-0 sm:w-[9px] sm:h-[9px]" />
                  ) : (
                    <BookOpen size={10} className="shrink-0 sm:w-[9px] sm:h-[9px]" />
                  )}
                  <span className="truncate">{statusLabel}</span>
                </span>
                {book.answered > 0 && (
                  <span className="text-slate-300 sm:text-slate-400 font-mono tabular-nums shrink-0">
                    {book.accuracy}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SimuladosTab({
  questions,
  userAnswers,
  selectedSimuladoKey,
  onSelectSimuladoKey,
  onStartSimulado,
  onOpenDesempenho,
  config,
}: SimuladosTabProps) {
  const activeConfig = config ?? DEFAULT_SIMULADOS_CONFIG;
  const [searchTerm, setSearchTerm] = useState("");
  const [bancaFilter, setBancaFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [expandedBancas, setExpandedBancas] = useState<Record<string, boolean>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);

  const hasActiveFilter =
    Boolean(searchTerm.trim()) || bancaFilter !== "todas" || statusFilter !== "todos";

  const toggleBanca = (banca: string) => {
    setExpandedBancas((prev) => {
      const current = prev[banca] !== undefined ? prev[banca] : activeConfig.defaultTreeExpanded;
      return {
        ...prev,
        [banca]: !current,
      };
    });
  };

  // 1. Agrupa questões por Banca + Nome da Prova e ordena cada prova pela coluna Ordem
  const { booksByKey, bancaShelves, allBancas, overview } = useMemo(() => {
    const byProva = new Map<string, BancoQuestion[]>();

    for (const q of questions) {
      const provaName = String(q.prova ?? "").trim() || "Sem Prova";
      const list = byProva.get(provaName);
      if (list) list.push(q);
      else byProva.set(provaName, [q]);
    }

    const booksMap = new Map<string, SimuladoBook>();

    for (const [provaName, provaQuestions] of byProva.entries()) {
      // Verifica quais bancas não vazias aparecem nessa prova
      const bancaCounts = new Map<string, number>();
      for (const q of provaQuestions) {
        const b = getBancaName(q);
        if (b) bancaCounts.set(b, (bancaCounts.get(b) || 0) + 1);
      }

      const distinctBancas = Array.from(bancaCounts.keys());

      // Se a prova só tem 1 banca (ou nenhuma), mantém todas as questões juntas naquela prova
      // Se tiver mais de 1 banca distinta no mesmo nome de prova, separa por banca
      const gruposPorBanca = new Map<string, BancoQuestion[]>();

      if (distinctBancas.length <= 1) {
        const bancaLabel = distinctBancas[0] || "Outras Bancas";
        gruposPorBanca.set(bancaLabel, provaQuestions);
      } else {
        const dominantBanca =
          Array.from(bancaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Outras Bancas";
        for (const q of provaQuestions) {
          const b = getBancaName(q) || dominantBanca;
          const arr = gruposPorBanca.get(b);
          if (arr) arr.push(q);
          else gruposPorBanca.set(b, [q]);
        }
      }

      for (const [banca, rawList] of gruposPorBanca.entries()) {
        // Ordena estritamente pela coluna Ordem (fallback id)
        const orderedQuestions = sortQuestoesByOrdem(rawList);
        const key = `${banca}:::${provaName}`;

        if (!shouldShowBookInLibrary(orderedQuestions.length, banca, key, activeConfig)) {
          continue;
        }

        const override = activeConfig.bookOverrides[key];
        const typeCfg = override?.typeId
          ? activeConfig.simuladoTypes.find((t) => t.id === override.typeId)
          : undefined;

        let answered = 0;
        let correct = 0;
        const discCounts = new Map<string, number>();
        const anoCounts = new Map<string, number>();

        for (const q of orderedQuestions) {
          const ans = userAnswers[String(q.id)];
          if (ans) {
            answered += 1;
            if (ans.isCorrect) correct += 1;
          }
          const d = getDisciplinaName(q);
          discCounts.set(d, (discCounts.get(d) || 0) + 1);

          const rawAno = String(q.Ano ?? "").trim();
          if (rawAno) {
            const yearMatch = rawAno.match(/\b(19|20)\d{2}\b/);
            const yearLabel = yearMatch ? yearMatch[0] : rawAno;
            anoCounts.set(yearLabel, (anoCounts.get(yearLabel) || 0) + 1);
          }
        }

        const total = orderedQuestions.length;
        const answerableTotal = orderedQuestions.filter(
          (q) => !isQuestaoAnulada(q) || Boolean(userAnswers[String(q.id)])
        ).length;
        const errors = answered - correct;
        const remaining = Math.max(0, answerableTotal - answered);
        const progress =
          answerableTotal > 0
            ? Math.min(100, Math.round((answered / answerableTotal) * 100))
            : total > 0
            ? 100
            : 0;
        const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
        const status: StatusSimulado =
          answered === 0
            ? "nao_iniciado"
            : answerableTotal > 0 && answered >= answerableTotal
            ? "concluido"
            : "em_andamento";

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

        booksMap.set(key, {
          key,
          banca,
          provaName,
          displayTitle: override?.customTitle || provaName,
          typeLabel: typeCfg?.label,
          durationMinutes: override?.durationMinutes ?? typeCfg?.defaultDurationMinutes,
          instructions: override?.instructions,
          paletteIndex: override?.paletteIndex ?? null,
          ano,
          disciplinaPrincipal,
          questions: orderedQuestions,
          answered,
          correct,
          errors,
          remaining,
          progress,
          accuracy,
          status,
        });
      }
    }

    // Agrupa os livros nas estantes por Banca
    const shelfMap = new Map<string, SimuladoBook[]>();
    for (const book of booksMap.values()) {
      const arr = shelfMap.get(book.banca);
      if (arr) arr.push(book);
      else shelfMap.set(book.banca, [book]);
    }

    const shelves: BancaShelf[] = Array.from(shelfMap.entries())
      .map(([banca, books]) => {
        const sortedBooks = [...books].sort((a, b) => {
          if (activeConfig.sortBooks === "questions_desc") {
            if (b.questions.length !== a.questions.length) {
              return b.questions.length - a.questions.length;
            }
          } else if (activeConfig.sortBooks === "year_desc") {
            const ya = Number(a.ano) || 0;
            const yb = Number(b.ano) || 0;
            if (yb !== ya) return yb - ya;
          } else if (activeConfig.sortBooks === "progress_desc") {
            if (b.progress !== a.progress) return b.progress - a.progress;
          }
          return a.displayTitle.localeCompare(b.displayTitle, "pt-BR", { numeric: true });
        });
        return {
          banca,
          books: sortedBooks,
          totalQuestoes: sortedBooks.reduce((s, b) => s + b.questions.length, 0),
          respondidas: sortedBooks.reduce((s, b) => s + b.answered, 0),
          acertos: sortedBooks.reduce((s, b) => s + b.correct, 0),
          concluidos: sortedBooks.filter((b) => b.status === "concluido").length,
        };
      })
      .sort((a, b) => {
        if (a.banca === "Outras Bancas" && b.banca !== "Outras Bancas") return 1;
        if (b.banca === "Outras Bancas" && a.banca !== "Outras Bancas") return -1;
        if (activeConfig.sortBancas === "cadernos_desc" && b.books.length !== a.books.length) {
          return b.books.length - a.books.length;
        }
        if (activeConfig.sortBancas === "questions_desc" && b.totalQuestoes !== a.totalQuestoes) {
          return b.totalQuestoes - a.totalQuestoes;
        }
        return a.banca.localeCompare(b.banca, "pt-BR");
      });

    const totalProvas = booksMap.size;
    const totalQuestoes = shelves.reduce((s, sh) => s + sh.totalQuestoes, 0);
    const totalRespondidas = shelves.reduce((s, sh) => s + sh.respondidas, 0);
    const totalAcertos = shelves.reduce((s, sh) => s + sh.acertos, 0);
    const aproveitamento =
      totalRespondidas > 0 ? Math.round((totalAcertos / totalRespondidas) * 100) : 0;

    return {
      booksByKey: booksMap,
      bancaShelves: shelves,
      allBancas: shelves.map((s) => s.banca),
      overview: {
        totalProvas,
        totalBancas: shelves.length,
        totalQuestoes,
        totalRespondidas,
        aproveitamento,
      },
    };
  }, [questions, userAnswers, activeConfig]);

  // 2. Filtragem por busca, banca e status
  const filteredShelves = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return bancaShelves
      .filter((shelf) => bancaFilter === "todas" || shelf.banca === bancaFilter)
      .map((shelf) => {
        const filteredBooks = shelf.books.filter((book) => {
          if (statusFilter === "concluidos" && book.status !== "concluido") return false;
          if (statusFilter === "em_andamento" && book.status !== "em_andamento") return false;
          if (statusFilter === "nao_iniciados" && book.status !== "nao_iniciado") return false;

          if (term) {
            const matchProva =
              book.provaName.toLowerCase().includes(term) ||
              book.displayTitle.toLowerCase().includes(term);
            const matchBanca = book.banca.toLowerCase().includes(term);
            const matchDisc = book.disciplinaPrincipal.toLowerCase().includes(term);
            const matchAno = book.ano ? book.ano.includes(term) : false;
            const matchType = book.typeLabel ? book.typeLabel.toLowerCase().includes(term) : false;
            if (!matchProva && !matchBanca && !matchDisc && !matchAno && !matchType) return false;
          }

          return true;
        });

        return {
          ...shelf,
          books: filteredBooks,
        };
      })
      .filter((shelf) => shelf.books.length > 0);
  }, [bancaShelves, bancaFilter, statusFilter, searchTerm]);

  // 3. Visão detalhada de um simulado (eBook aberto)
  const selectedBook = useMemo(() => {
    if (!selectedSimuladoKey) return null;
    if (booksByKey.has(selectedSimuladoKey)) return booksByKey.get(selectedSimuladoKey) || null;
    // Retrocompatibilidade caso selectedSimuladoKey tenha sido apenas provaName
    for (const book of booksByKey.values()) {
      if (book.provaName === selectedSimuladoKey) return book;
    }
    return null;
  }, [selectedSimuladoKey, booksByKey]);

  if (selectedBook) {
    const palette = getPaletteForBanca(selectedBook.banca, selectedBook.paletteIndex);
    const nextUnansweredIdx = selectedBook.questions.findIndex(
      (q) => !isQuestaoAnulada(q) && !userAnswers[String(q.id)]
    );
    const startIdx =
      selectedBook.status === "concluido" || nextUnansweredIdx < 0
        ? 0
        : nextUnansweredIdx;

    return (
      <div className="w-full min-w-0 space-y-5 sm:space-y-6">
        {/* Cabeçalho do Simulado Aberto */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onSelectSimuladoKey(null)}
              className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
              aria-label="Voltar para lista de simulados"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0 space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                <span className={palette.bancaText}>{selectedBook.banca}</span>
                {selectedBook.typeLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-300">{selectedBook.typeLabel}</span>
                  </>
                )}
                {selectedBook.ano && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedBook.ano}</span>
                  </>
                )}
                {selectedBook.durationMinutes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedBook.durationMinutes} min</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="break-words">{selectedBook.disciplinaPrincipal}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-normal text-white tracking-tight [text-wrap:balance] break-words">
                {selectedBook.displayTitle}
              </h2>
              {selectedBook.instructions && (
                <p className="text-xs sm:text-sm text-slate-400 pt-0.5 max-w-2xl leading-relaxed break-words">
                  {selectedBook.instructions}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="min-h-[44px] sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-normal flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              title="Imprimir este simulado em formato compacto"
            >
              <Printer size={14} />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDesempenho(selectedBook.questions)}
              className="min-h-[44px] sm:min-h-0 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-normal flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <BarChart3 size={14} />
              <span>Desempenho</span>
            </button>

            <button
              type="button"
              onClick={() => onStartSimulado(selectedBook.questions, startIdx)}
              className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {selectedBook.status === "nao_iniciado" && (
                <>
                  <PlayCircle size={14} />
                  <span>Iniciar Prova</span>
                </>
              )}
              {selectedBook.status === "em_andamento" && (
                <>
                  <Clock3 size={14} />
                  <span>Continuar ({selectedBook.remaining} restantes)</span>
                </>
              )}
              {selectedBook.status === "concluido" && (
                <>
                  <CheckCircle2 size={14} />
                  <span>Rever Respostas</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Métricas do Simulado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 bg-[#0b101d] border border-white/[0.06]">
            <div className="text-xs text-slate-400 mb-1">Total de questões</div>
            <div className="text-2xl font-normal text-white tabular-nums">
              {selectedBook.questions.length}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-[#0b101d] border border-white/[0.06]">
            <div className="text-xs text-slate-400 mb-1">Respondidas</div>
            <div className="text-2xl font-normal text-slate-100 tabular-nums">
              {selectedBook.answered}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-[#0b101d] border border-white/[0.06]">
            <div className="text-xs text-slate-400 mb-1">Acertos</div>
            <div className="text-2xl font-normal text-emerald-400 tabular-nums">
              {selectedBook.correct}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-[#0b101d] border border-white/[0.06]">
            <div className="text-xs text-slate-400 mb-1">Erros</div>
            <div className="text-2xl font-normal text-rose-400 tabular-nums">
              {selectedBook.errors}
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 tabular-nums">
              {selectedBook.progress}% concluído
            </span>
            <span
              className={`tabular-nums font-normal ${
                selectedBook.answered === 0
                  ? "text-slate-500"
                  : selectedBook.accuracy >= 70
                  ? "text-emerald-400"
                  : selectedBook.accuracy >= 50
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {selectedBook.answered > 0 ? `${selectedBook.accuracy}% de acerto` : "Sem respostas"}
            </span>
          </div>
          <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                selectedBook.answered === 0
                  ? "bg-slate-700"
                  : selectedBook.accuracy >= 70
                  ? "bg-emerald-500"
                  : selectedBook.accuracy >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${selectedBook.progress}%` }}
            />
          </div>
        </div>

        {/* Grade de Questões seguindo a coluna Ordem */}
        <div className="bg-[#0b101d] border border-white/[0.07] rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-normal text-white">
                Caderno de Questões
              </h3>
              <p className="text-xs text-slate-400">
                Sequência ordenada pela coluna Ordem da prova. Clique para abrir a questão.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                Acertou
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle size={12} className="text-rose-400" />
                Errou
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Ban size={11} className="text-amber-400" />
                Anulada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Circle size={10} className="text-slate-500" />
                Pendente
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {selectedBook.questions.map((q, qi) => {
              const ans = userAnswers[String(q.id)];
              const anulada = isQuestaoAnulada(q);
              const ordemNum = q.Ordem ?? q.ordem;
              const displayNumber =
                ordemNum !== undefined && ordemNum !== null && String(ordemNum).trim() !== ""
                  ? String(ordemNum)
                  : String(qi + 1);
              const disc = getDisciplinaName(q);

              let cls =
                "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20";
              if (anulada) {
                cls =
                  "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25";
              } else if (ans) {
                cls = ans.isCorrect
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onStartSimulado(selectedBook.questions, qi)}
                  title={`Questão ${displayNumber} · ${disc}${anulada ? " · Anulada" : ""}`}
                  className={`min-h-[42px] px-2 py-1.5 rounded-xl border text-xs font-mono tabular-nums transition-colors flex items-center justify-center gap-1.5 ${cls}`}
                >
                  {anulada ? (
                    <Ban size={11} className="text-amber-400 shrink-0" />
                  ) : ans ? (
                    ans.isCorrect ? (
                      <Check size={11} className="text-emerald-400 shrink-0" />
                    ) : (
                      <X size={11} className="text-rose-400 shrink-0" />
                    )
                  ) : null}
                  <span>{displayNumber}</span>
                </button>
              );
            })}
          </div>
        </div>

        <PrintSimuladoModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          questions={selectedBook.questions}
          title={selectedBook.displayTitle}
          subTitle={[selectedBook.banca, selectedBook.typeLabel, selectedBook.ano].filter(Boolean).join(" · ")}
        />
      </div>
    );
  }

  // 4. Estante Principal de eBooks 3D agrupados por Banca e Nome da Prova
  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">
      {/* Árvore de Bancas no estilo do Explorador de Decks (Flashcards 3D) */}
      <div className="bg-[#12141a] border border-white/[0.06] rounded-xl overflow-hidden w-full min-w-0">
        {/* Barra superior da árvore + busca e filtros */}
        <div className="px-3 sm:px-3.5 pt-3.5 pb-3 border-b border-white/[0.06] space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-sm sm:text-xs font-normal tracking-wide text-slate-200 truncate">
                Explorador de Simulados
              </span>
              <span className="text-xs sm:text-[11px] font-light text-slate-400 sm:text-slate-500 tabular-nums break-words">
                {overview.totalBancas} {overview.totalBancas === 1 ? "banca" : "bancas"} ·{" "}
                {overview.totalProvas} {overview.totalProvas === 1 ? "caderno" : "cadernos"} ·{" "}
                {overview.totalRespondidas}/{overview.totalQuestoes} resp.
                {overview.totalRespondidas > 0 ? ` · ${overview.aproveitamento}% acerto` : ""}
              </span>
            </div>

            {!hasActiveFilter && filteredShelves.length > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const allOpen: Record<string, boolean> = {};
                    for (const sh of filteredShelves) {
                      allOpen[sh.banca] = true;
                    }
                    setExpandedBancas(allOpen);
                  }}
                  title="Expandir toda a árvore"
                  aria-label="Expandir toda a árvore"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <ChevronsUpDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allClosed: Record<string, boolean> = {};
                    for (const sh of filteredShelves) {
                      allClosed[sh.banca] = false;
                    }
                    setExpandedBancas(allClosed);
                  }}
                  title="Recolher árvore"
                  aria-label="Recolher árvore"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <ChevronsDownUp size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar prova, banca, ano ou disciplina..."
                className="w-full bg-[#0d0f14] border border-white/[0.07] rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-white/20 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={bancaFilter}
                onChange={(e) => setBancaFilter(e.target.value)}
                aria-label="Filtrar por banca"
                className="bg-[#0d0f14] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-white/20 transition-colors"
              >
                <option value="todas">Todas as bancas</option>
                {allBancas.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <div className="flex items-center bg-[#0d0f14] border border-white/[0.07] rounded-lg p-0.5 gap-0.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: "todos", label: "Todos" },
                    { id: "nao_iniciados", label: "Não iniciados" },
                    { id: "em_andamento", label: "Em andamento" },
                    { id: "concluidos", label: "Concluídos" },
                  ] as { id: StatusFilter; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-[11.5px] transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === opt.id
                        ? "bg-white/[0.1] text-white font-normal"
                        : "text-slate-400 hover:text-slate-200 font-light"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Corpo da Árvore */}
        <div className="p-2 space-y-0.5">
          {filteredShelves.length === 0 ? (
            <div className="py-14 text-center space-y-1.5">
              <p className="text-xs text-slate-400 font-light">
                Nenhum simulado disponível encontrado com esses filtros.
              </p>
              <p className="text-[11px] text-slate-500 font-light">
                Tente ajustar a banca, o status ou o termo pesquisado.
              </p>
            </div>
          ) : (
            filteredShelves.map((shelf) => {
              const shelfQuestoes = shelf.books.reduce((s, b) => s + b.questions.length, 0);
              const shelfRespondidas = shelf.books.reduce((s, b) => s + b.answered, 0);
              const shelfAcertos = shelf.books.reduce((s, b) => s + b.correct, 0);
              const shelfAcc =
                shelfRespondidas > 0 ? Math.round((shelfAcertos / shelfRespondidas) * 100) : 0;
              const explicitToggle = expandedBancas[shelf.banca];
              const isExpanded =
                hasActiveFilter ||
                (explicitToggle !== undefined ? explicitToggle : activeConfig.defaultTreeExpanded);

              return (
                <section key={shelf.banca} className="select-none">
                  {/* Linha da Banca no mesmo visual do DeckTreeNodeItem */}
                  <button
                    type="button"
                    onClick={() => toggleBanca(shelf.banca)}
                    aria-expanded={isExpanded}
                    className={`w-full group relative flex items-center gap-1 rounded-md px-1.5 py-1.5 sm:py-1 text-left transition-colors cursor-pointer ${
                      isExpanded
                        ? "bg-white/[0.08] text-slate-100"
                        : "text-slate-300 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded text-slate-500 group-hover:text-slate-200 shrink-0 transition-colors">
                      <ChevronRight
                        size={13}
                        className={`transition-transform duration-150 ${
                          isExpanded ? "rotate-90 text-slate-300" : ""
                        }`}
                      />
                    </span>

                    <span className="text-slate-400 shrink-0">
                      {isExpanded ? (
                        <FolderOpen size={14} className="stroke-[1.6]" />
                      ) : (
                        <Folder size={14} className="stroke-[1.6]" />
                      )}
                    </span>

                    <span
                      className={`flex-1 min-w-0 truncate text-[12.5px] leading-snug pl-0.5 ${
                        isExpanded ? "font-normal text-white" : "font-light text-slate-300"
                      }`}
                    >
                      {shelf.banca}
                    </span>

                    <span className="hidden sm:inline text-[11px] font-light text-slate-500 tabular-nums shrink-0 pr-1.5">
                      {shelfQuestoes} qs · {shelfRespondidas} resp.
                      {shelfRespondidas > 0 ? ` · ${shelfAcc}%` : ""}
                    </span>

                    <span
                      className="text-[11px] font-light text-slate-500 tabular-nums shrink-0 px-1"
                      title={`${shelf.books.length} ${
                        shelf.books.length === 1 ? "caderno" : "cadernos"
                      }`}
                    >
                      {shelf.books.length}
                    </span>
                  </button>

                  {/* Ramo da árvore com linha sutil de conexão e cadernos 3D */}
                  {isExpanded && (
                    <div className="ml-1.5 sm:ml-3 pl-2.5 sm:pl-3 border-l border-white/[0.07] mt-1 mb-2.5 pt-2 pb-1 pr-0.5 sm:pr-1">
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-x-4 sm:gap-y-5">
                        {shelf.books.map((book) => (
                          <Ebook3DCard
                            key={book.key}
                            book={book}
                            palette={getPaletteForBanca(shelf.banca, book.paletteIndex)}
                            onClick={() => onSelectSimuladoKey(book.key)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* Rodapé discreto */}
        <div className="px-3.5 py-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-light">
          <span>
            Exibindo provas com {activeConfig.minQuestionsToShow}+ questões, ordenadas pela coluna Ordem
          </span>
          <span className="tabular-nums">
            {filteredShelves.reduce((acc, sh) => acc + sh.books.length, 0)} cadernos visíveis
          </span>
        </div>
      </div>
    </div>
  );
}
