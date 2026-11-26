export type ReviewStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

export interface DeckRecord {
  id: string;
  name: string;
  parent_id: string | null;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FlashcardRecord {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewResponseEntry {
  reviewed_at: string;
  review_status: ReviewStatus;
  confidence: number;
}

export interface CardReviewRecord {
  id: string;
  card_id: string;
  review_status: ReviewStatus;
  confidence: number;
  reviewed_at: string;
  response_history: ReviewResponseEntry[];
}

export interface DeckStats {
  ownCardsCount: number;
  descendantCardsCount: number;
  totalCardsCount: number;
  directSubdecksCount: number;
  totalSubdecksCount: number;
  masteredCount: number;
  learningCount: number;
  lastActivityAt: string | null;
}

export interface DeckTreeNode {
  deck: DeckRecord;
  depth: number;
  children: DeckTreeNode[];
  stats: DeckStats;
  breadcrumb: DeckRecord[];
  fullPath: string;
}

export interface SearchResultItem {
  type: 'deck' | 'card';
  id: string;
  deckId: string;
  title: string;
  subtitle?: string;
  fullPath: string;
  breadcrumb: DeckRecord[];
  matchedFields: string[];
}

export interface TreeExportDeckNode {
  name: string;
  description: string;
  position: number;
  cards: { front: string; back: string }[];
  children: TreeExportDeckNode[];
}

export interface TreeExportPayload {
  version: 1;
  exported_at: string;
  decks: TreeExportDeckNode[];
}

export interface FlashcardTreeSnapshot {
  decks: DeckRecord[];
  flashcards: FlashcardRecord[];
  reviews: CardReviewRecord[];
  storageBackend: 'supabase' | 'local-file';
}
