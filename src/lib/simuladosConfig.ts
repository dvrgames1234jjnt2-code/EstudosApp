export type SimuladoVisibilityMode = "auto" | "force_show" | "hide";
export type SortBancasMode = "alpha" | "cadernos_desc" | "questions_desc";
export type SortBooksMode = "alpha" | "year_desc" | "questions_desc" | "progress_desc";

export interface SimuladoTypeConfig {
  id: string;
  label: string;
  description: string;
  defaultDurationMinutes: number;
  minQuestionsOverride?: number | null;
}

export interface SimuladoBookOverride {
  visibility: SimuladoVisibilityMode;
  customTitle?: string;
  typeId?: string;
  durationMinutes?: number;
  instructions?: string;
  paletteIndex?: number | null;
}

export interface SimuladosConfig {
  minQuestionsToShow: number;
  defaultTreeExpanded: boolean;
  sortBancas: SortBancasMode;
  sortBooks: SortBooksMode;
  hiddenBancas: string[];
  simuladoTypes: SimuladoTypeConfig[];
  bookOverrides: Record<string, SimuladoBookOverride>;
}

export const DEFAULT_SIMULADO_TYPES: SimuladoTypeConfig[] = [
  {
    id: "oficial",
    label: "Prova Oficial",
    description: "Provas reais aplicadas por bancas organizadoras.",
    defaultDurationMinutes: 240,
    minQuestionsOverride: null,
  },
  {
    id: "inedito",
    label: "Simulado Inédito",
    description: "Cadernos inéditos elaborados para treino direcionado.",
    defaultDurationMinutes: 180,
    minQuestionsOverride: null,
  },
  {
    id: "tematico",
    label: "Caderno Temático",
    description: "Seleção focada em uma disciplina ou assunto específico.",
    defaultDurationMinutes: 90,
    minQuestionsOverride: null,
  },
  {
    id: "revisao",
    label: "Simulado de Revisão",
    description: "Bateria mista para revisão espaçada e fixação.",
    defaultDurationMinutes: 60,
    minQuestionsOverride: null,
  },
];

export const DEFAULT_SIMULADOS_CONFIG: SimuladosConfig = {
  // Padrão: exibir apenas simulados com mais de 7 questões (>= 8)
  minQuestionsToShow: 8,
  defaultTreeExpanded: false,
  sortBancas: "alpha",
  sortBooks: "alpha",
  hiddenBancas: [],
  simuladoTypes: DEFAULT_SIMULADO_TYPES,
  bookOverrides: {},
};

export const SIMULADOS_CONFIG_STORAGE_KEY = "simulados_library_config_v1";

export function normalizeSimuladosConfig(raw?: Partial<SimuladosConfig> | null): SimuladosConfig {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_SIMULADOS_CONFIG,
      hiddenBancas: [],
      simuladoTypes: DEFAULT_SIMULADO_TYPES.map((t) => ({ ...t })),
      bookOverrides: {},
    };
  }

  const minQ =
    typeof raw.minQuestionsToShow === "number" &&
    Number.isFinite(raw.minQuestionsToShow) &&
    raw.minQuestionsToShow >= 1
      ? Math.floor(raw.minQuestionsToShow)
      : DEFAULT_SIMULADOS_CONFIG.minQuestionsToShow;

  const validSortBancas: SortBancasMode[] = ["alpha", "cadernos_desc", "questions_desc"];
  const sortBancas = validSortBancas.includes(raw.sortBancas as SortBancasMode)
    ? (raw.sortBancas as SortBancasMode)
    : "alpha";

  const validSortBooks: SortBooksMode[] = ["alpha", "year_desc", "questions_desc", "progress_desc"];
  const sortBooks = validSortBooks.includes(raw.sortBooks as SortBooksMode)
    ? (raw.sortBooks as SortBooksMode)
    : "alpha";

  const simuladoTypes =
    Array.isArray(raw.simuladoTypes) && raw.simuladoTypes.length > 0
      ? raw.simuladoTypes
          .filter((t) => t && typeof t.id === "string" && typeof t.label === "string")
          .map((t) => ({
            id: t.id.trim(),
            label: t.label.trim(),
            description: String(t.description ?? "").trim(),
            defaultDurationMinutes:
              typeof t.defaultDurationMinutes === "number" && t.defaultDurationMinutes > 0
                ? Math.round(t.defaultDurationMinutes)
                : 120,
            minQuestionsOverride:
              typeof t.minQuestionsOverride === "number" && t.minQuestionsOverride >= 1
                ? Math.floor(t.minQuestionsOverride)
                : null,
          }))
      : DEFAULT_SIMULADO_TYPES.map((t) => ({ ...t }));

  const bookOverrides: Record<string, SimuladoBookOverride> = {};
  if (raw.bookOverrides && typeof raw.bookOverrides === "object") {
    for (const [k, v] of Object.entries(raw.bookOverrides)) {
      if (!v || typeof v !== "object") continue;
      const vis: SimuladoVisibilityMode =
        v.visibility === "force_show" || v.visibility === "hide" || v.visibility === "auto"
          ? v.visibility
          : "auto";
      bookOverrides[k] = {
        visibility: vis,
        customTitle: typeof v.customTitle === "string" && v.customTitle.trim() ? v.customTitle.trim() : undefined,
        typeId: typeof v.typeId === "string" && v.typeId.trim() ? v.typeId.trim() : undefined,
        durationMinutes:
          typeof v.durationMinutes === "number" && v.durationMinutes > 0
            ? Math.round(v.durationMinutes)
            : undefined,
        instructions:
          typeof v.instructions === "string" && v.instructions.trim() ? v.instructions.trim() : undefined,
        paletteIndex:
          typeof v.paletteIndex === "number" && v.paletteIndex >= 0 ? Math.floor(v.paletteIndex) : null,
      };
    }
  }

  return {
    minQuestionsToShow: minQ,
    defaultTreeExpanded: Boolean(raw.defaultTreeExpanded),
    sortBancas,
    sortBooks,
    hiddenBancas: Array.isArray(raw.hiddenBancas)
      ? raw.hiddenBancas.map((b) => String(b).trim()).filter(Boolean)
      : [],
    simuladoTypes,
    bookOverrides,
  };
}

export function shouldShowBookInLibrary(
  questionCount: number,
  banca: string,
  bookKey: string,
  config: SimuladosConfig
): boolean {
  if (config.hiddenBancas.includes(banca)) {
    const ov = config.bookOverrides[bookKey];
    if (ov?.visibility !== "force_show") return false;
  }

  const ov = config.bookOverrides[bookKey];
  if (ov?.visibility === "hide") return false;
  if (ov?.visibility === "force_show") return true;

  const typeCfg = ov?.typeId
    ? config.simuladoTypes.find((t) => t.id === ov.typeId)
    : undefined;
  const minThreshold =
    typeCfg?.minQuestionsOverride !== undefined && typeCfg?.minQuestionsOverride !== null
      ? typeCfg.minQuestionsOverride
      : config.minQuestionsToShow;

  return questionCount >= minThreshold;
}
