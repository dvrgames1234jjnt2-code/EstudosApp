// ─── Tipos do módulo de Fixação ──────────────────────────────────────────────

export type ChoiceType = 'forgot' | 'partial' | 'effortful' | 'learning' | 'mastered';

export interface FixationItem {
  id: string;
  deck_id?: string;
  term: string;
  description: string;
  category?: string;
  // campos computados localmente (não vêm do banco)
  originalIndex?: number;
  _stableId?: string | number;
}

export interface FixationDeck {
  id: string;
  title: string;
  category?: string;
  created_at?: string;
  // campos de progresso calculados pelo service
  totalItems?: number;
  masteredCount?: number;
  lastStudied?: string | null;
}

export interface FixationProgress {
  id?: string;
  user_id: string;
  item_id: string;
  performance: ChoiceType;
  session_id: string;
  answered_at?: string;
}

// Resumo agregado por item para exibição no Dashboard
export interface ItemStats {
  item_id: string;
  lastPerformance: ChoiceType | null;
  timesStudied: number;
}
