// ─── Tipos do módulo de Fixação ──────────────────────────────────────────────

export type ChoiceType = 'forgot' | 'partial' | 'effortful' | 'learning' | 'mastered';

export interface FixationCollection {
  id: string | number;
  title: string;
  description?: string;
  created_at?: string;
}

export interface FixationSubject {
  id: string | number;
  collection_id?: string | number;
  title: string;
  created_at?: string;
}

export interface FixationTopic {
  id: string | number;
  subject_id?: string | number;
  title: string;
  position?: number;
  created_at?: string;
}

export interface FixationItem {
  id: string | number;
  deck_id?: string | number;
  term: string;        // Mapeado da coluna `front` (ou `title`) da tabela `cards_minigames`
  description: string; // Mapeado da coluna `back` da tabela `cards_minigames`
  explanation?: string; // Mapeado da coluna `explanation` da tabela `cards_minigames`
  category?: string;
  // Campos computados localmente
  originalIndex?: number;
  _stableId?: string | number;
}

export interface FixationDeck {
  id: string | number;
  title: string;       // Mapeado da coluna `title` da tabela `deck_minigames`
  description?: string;// Mapeado da coluna `description` da tabela `deck_minigames`
  category?: string;   // Derivado do tópico (tabela `topics.title`)
  materia?: string;    // Derivado da matéria (tabela `subjects.title`)
  topic_id?: number;
  position?: number;
  created_at?: string;
  cardCount?: number;  // Contagem real de cartões neste deck
  // Campos de progresso
  totalItems?: number;
  masteredCount?: number;
}

export interface FixationProgress {
  id?: string | number;
  card_id: string | number;
  last_review_option_id: number;
  next_review_at?: string;
  reviews_count?: number;
  created_at?: string;
}

export interface ItemStats {
  item_id: string;
  lastPerformance: ChoiceType | null;
  timesStudied: number;
}

export interface FeedbackCounts {
  forgot: number;    // ERREI (1)
  partial: number;   // QUASE (2)
  effortful: number; // PENSEI (3)
  learning: number;  // RÁPIDO (4)
  mastered: number;  // AUTOMÁTICO (4 - dominados)
  newCards: number;  // NOVO (sem registro)
}
