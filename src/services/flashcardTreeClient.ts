import {
  FlashcardTreeSnapshot,
  ReviewStatus,
  TreeExportPayload,
} from '@/types/flashcardTree';

const API_ENDPOINT = '/api/flashcards-tree';
const CACHE_KEY = 'flashcards-tree-snapshot-v1';

async function postAction<T extends { snapshot: FlashcardTreeSnapshot }>(
  payload: Record<string, unknown>
): Promise<T> {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao executar operação');
  }
  saveSnapshotToCache(data.snapshot);
  return data as T;
}

export function saveSnapshotToCache(snapshot: FlashcardTreeSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors
  }
}

export function readSnapshotFromCache(): FlashcardTreeSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FlashcardTreeSnapshot;
  } catch {
    return null;
  }
}

export async function fetchTreeSnapshot(): Promise<FlashcardTreeSnapshot> {
  const res = await fetch(API_ENDPOINT, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao carregar decks');
  }
  saveSnapshotToCache(data as FlashcardTreeSnapshot);
  return data as FlashcardTreeSnapshot;
}

export async function exportTreeJson(rootDeckId?: string | null): Promise<TreeExportPayload> {
  const qs = rootDeckId ? `?exportDeckId=${encodeURIComponent(rootDeckId)}` : '?export=1';
  const res = await fetch(`${API_ENDPOINT}${qs}`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao exportar estrutura');
  }
  return data as TreeExportPayload;
}

export function apiCreateDeck(input: {
  name: string;
  parent_id?: string | null;
  description?: string;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot; createdId: string }>({
    action: 'createDeck',
    ...input,
  });
}

export function apiUpdateDeck(input: {
  id: string;
  name?: string;
  description?: string;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'updateDeck',
    ...input,
  });
}

export function apiMoveDeck(input: {
  id: string;
  target_parent_id: string | null;
  target_position?: number;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'moveDeck',
    ...input,
  });
}

export function apiReorderDecks(input: {
  parent_id: string | null;
  ordered_ids: string[];
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'reorderDecks',
    ...input,
  });
}

export function apiDuplicateDeck(input: {
  id: string;
  target_parent_id?: string | null;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot; duplicatedRootId: string }>({
    action: 'duplicateDeck',
    ...input,
  });
}

export function apiDeleteDeck(input: {
  id: string;
  mode: 'cascade' | 'promote_children';
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'deleteDeck',
    ...input,
  });
}

export function apiCreateCard(input: {
  deck_id: string;
  front: string;
  back: string;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot; createdId: string }>({
    action: 'createCard',
    ...input,
  });
}

export function apiUpdateCard(input: {
  id: string;
  front?: string;
  back?: string;
  deck_id?: string;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'updateCard',
    ...input,
  });
}

export function apiMoveCards(input: {
  card_ids: string[];
  target_deck_id: string;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'moveCards',
    ...input,
  });
}

export function apiDeleteCards(input: { card_ids: string[] }) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'deleteCards',
    ...input,
  });
}

export function apiRecordReview(input: {
  card_id: string;
  review_status: ReviewStatus;
  confidence: number;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'recordReview',
    ...input,
  });
}

export function apiImportTree(input: {
  payload: TreeExportPayload;
  target_parent_id?: string | null;
}) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'importTree',
    ...input,
  });
}

export function apiSeedExamples(reset = false) {
  return postAction<{ snapshot: FlashcardTreeSnapshot }>({
    action: 'seedExamples',
    reset,
  });
}
