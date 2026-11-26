import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CardReviewRecord,
  DeckRecord,
  FlashcardRecord,
  FlashcardTreeSnapshot,
  ReviewResponseEntry,
  ReviewStatus,
  TreeExportDeckNode,
  TreeExportPayload,
} from '@/types/flashcardTree';
import {
  collectSubtreeDeckIds,
  createBancoBrasilExampleSeed,
  isDeckDescendantOrSelf,
  sortDecks,
} from '@/lib/flashcardTreeEngine';

interface LocalStoreData {
  decks: DeckRecord[];
  flashcards: FlashcardRecord[];
  reviews: CardReviewRecord[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'flashcards-tree.json');

let cachedSupabaseReady: boolean | null = null;
let lastSupabaseCheck = 0;

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder')) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function isSupabaseHierarchicalReady(): Promise<boolean> {
  const now = Date.now();
  if (cachedSupabaseReady !== null && now - lastSupabaseCheck < 15000) {
    return cachedSupabaseReady;
  }

  const sb = getServerSupabase();
  if (!sb) {
    cachedSupabaseReady = false;
    lastSupabaseCheck = now;
    return false;
  }

  try {
    const [dRes, fRes, rRes] = await Promise.all([
      sb.from('decks').select('id, name, parent_id, description, position').limit(1),
      sb.from('flashcards').select('id, deck_id, front, back').limit(1),
      sb.from('card_reviews').select('id, card_id, review_status, confidence').limit(1),
    ]);

    const ok = !dRes.error && !fRes.error && !rRes.error;
    cachedSupabaseReady = ok;
    lastSupabaseCheck = now;
    return ok;
  } catch {
    cachedSupabaseReady = false;
    lastSupabaseCheck = now;
    return false;
  }
}

async function readLocalStore(): Promise<LocalStoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
    if (Array.isArray(parsed.decks) && Array.isArray(parsed.flashcards)) {
      return {
        decks: parsed.decks,
        flashcards: parsed.flashcards,
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      };
    }
  } catch {
    // Arquivo ainda não existe — cria seed inicial
  }

  const seeded = createBancoBrasilExampleSeed(() => crypto.randomUUID());
  const initial: LocalStoreData = {
    decks: seeded.decks,
    flashcards: seeded.flashcards,
    reviews: [],
  };
  await writeLocalStore(initial);
  return initial;
}

async function writeLocalStore(data: LocalStoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmpFile, DATA_FILE);
}

export class StoreValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// READ SNAPSHOT
// ──────────────────────────────────────────────────────────────────────────────

export async function getTreeSnapshot(): Promise<FlashcardTreeSnapshot> {
  const useSupabase = await isSupabaseHierarchicalReady();
  if (useSupabase) {
    const sb = getServerSupabase()!;
    const [dRes, fRes, rRes] = await Promise.all([
      sb.from('decks').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
      sb.from('flashcards').select('*').order('created_at', { ascending: true }),
      sb.from('card_reviews').select('*').order('reviewed_at', { ascending: false }),
    ]);

    if (!dRes.error && !fRes.error && !rRes.error) {
      let decks = (dRes.data ?? []) as DeckRecord[];
      let flashcards = (fRes.data ?? []) as FlashcardRecord[];
      const reviews = (rRes.data ?? []) as CardReviewRecord[];

      if (decks.length === 0) {
        const seeded = createBancoBrasilExampleSeed(() => crypto.randomUUID());
        await sb.from('decks').insert(seeded.decks);
        await sb.from('flashcards').insert(seeded.flashcards);
        decks = seeded.decks;
        flashcards = seeded.flashcards;
      }

      return { decks, flashcards, reviews, storageBackend: 'supabase' };
    }
  }

  const local = await readLocalStore();
  return {
    decks: sortDecks(local.decks),
    flashcards: local.flashcards,
    reviews: local.reviews,
    storageBackend: 'local-file',
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// DECK CRUD & HIERARCHY OPS
// ──────────────────────────────────────────────────────────────────────────────

export async function createDeck(input: {
  name: string;
  parent_id?: string | null;
  description?: string;
  position?: number;
}): Promise<{ snapshot: FlashcardTreeSnapshot; createdId: string }> {
  const name = (input.name || '').trim();
  if (!name) throw new StoreValidationError('O nome do deck é obrigatório.');

  const parentId = input.parent_id || null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const description = (input.description || '').trim();

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    if (parentId) {
      const { data: parent } = await sb.from('decks').select('id').eq('id', parentId).maybeSingle();
      if (!parent) throw new StoreValidationError('Deck pai não encontrado.', 404);
    }

    let position = input.position;
    if (position === undefined) {
      const q = parentId
        ? sb.from('decks').select('position').eq('parent_id', parentId)
        : sb.from('decks').select('position').is('parent_id', null);
      const { data: siblings } = await q;
      position = (siblings ?? []).reduce((m, r) => Math.max(m, (r.position ?? -1) + 1), 0);
    }

    const { error } = await sb.from('decks').insert({
      id,
      name,
      parent_id: parentId,
      description,
      position,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new StoreValidationError(error.message, 500);
    return { snapshot: await getTreeSnapshot(), createdId: id };
  }

  const store = await readLocalStore();
  if (parentId && !store.decks.some(d => d.id === parentId)) {
    throw new StoreValidationError('Deck pai não encontrado.', 404);
  }
  const siblings = store.decks.filter(d => d.parent_id === parentId);
  const position =
    input.position ??
    siblings.reduce((maxPos, d) => Math.max(maxPos, d.position + 1), 0);

  store.decks.push({
    id,
    name,
    parent_id: parentId,
    description,
    position,
    created_at: now,
    updated_at: now,
  });
  await writeLocalStore(store);
  return { snapshot: await getTreeSnapshot(), createdId: id };
}

export async function updateDeck(input: {
  id: string;
  name?: string;
  description?: string;
}): Promise<FlashcardTreeSnapshot> {
  const now = new Date().toISOString();

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const patch: Partial<DeckRecord> = { updated_at: now };
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new StoreValidationError('O nome do deck não pode ficar vazio.');
      patch.name = trimmed;
    }
    if (input.description !== undefined) {
      patch.description = input.description.trim();
    }
    const { error } = await sb.from('decks').update(patch).eq('id', input.id);
    if (error) throw new StoreValidationError(error.message, 500);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  const deck = store.decks.find(d => d.id === input.id);
  if (!deck) throw new StoreValidationError('Deck não encontrado.', 404);

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new StoreValidationError('O nome do deck não pode ficar vazio.');
    deck.name = trimmed;
  }
  if (input.description !== undefined) {
    deck.description = input.description.trim();
  }
  deck.updated_at = now;

  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function moveDeck(input: {
  id: string;
  target_parent_id: string | null;
  target_position?: number;
}): Promise<FlashcardTreeSnapshot> {
  const targetParentId = input.target_parent_id || null;
  const snapshot = await getTreeSnapshot();

  const movingDeck = snapshot.decks.find(d => d.id === input.id);
  if (!movingDeck) throw new StoreValidationError('Deck de origem não encontrado.', 404);

  if (targetParentId && !snapshot.decks.some(d => d.id === targetParentId)) {
    throw new StoreValidationError('Deck de destino não encontrado.', 404);
  }

  if (isDeckDescendantOrSelf(snapshot.decks, targetParentId, input.id)) {
    throw new StoreValidationError(
      'Operação bloqueada: um deck não pode ser movido para dentro de si mesmo ou de seus próprios subdecks.'
    );
  }

  const now = new Date().toISOString();
  const targetSiblings = sortDecks(
    snapshot.decks.filter(d => d.parent_id === targetParentId && d.id !== input.id)
  );
  const insertAt = Math.max(
    0,
    Math.min(
      input.target_position ?? targetSiblings.length,
      targetSiblings.length
    )
  );
  targetSiblings.splice(insertAt, 0, { ...movingDeck, parent_id: targetParentId });

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { error: moveErr } = await sb
      .from('decks')
      .update({ parent_id: targetParentId, position: insertAt, updated_at: now })
      .eq('id', input.id);
    if (moveErr) throw new StoreValidationError(moveErr.message, 400);

    await Promise.all(
      targetSiblings.map((sib, idx) =>
        sb.from('decks').update({ position: idx }).eq('id', sib.id)
      )
    );
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  const targetInStore = store.decks.find(d => d.id === input.id);
  if (targetInStore) {
    targetInStore.parent_id = targetParentId;
    targetInStore.updated_at = now;
  }
  targetSiblings.forEach((sib, idx) => {
    const found = store.decks.find(d => d.id === sib.id);
    if (found) found.position = idx;
  });

  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function reorderDecks(input: {
  parent_id: string | null;
  ordered_ids: string[];
}): Promise<FlashcardTreeSnapshot> {
  const now = new Date().toISOString();

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    await Promise.all(
      input.ordered_ids.map((id, idx) =>
        sb.from('decks').update({ position: idx, updated_at: now }).eq('id', id)
      )
    );
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  input.ordered_ids.forEach((id, idx) => {
    const found = store.decks.find(d => d.id === id && d.parent_id === (input.parent_id || null));
    if (found) {
      found.position = idx;
      found.updated_at = now;
    }
  });
  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function duplicateDeckSubtree(input: {
  id: string;
  target_parent_id?: string | null;
}): Promise<{ snapshot: FlashcardTreeSnapshot; duplicatedRootId: string }> {
  const snapshot = await getTreeSnapshot();
  const sourceDeck = snapshot.decks.find(d => d.id === input.id);
  if (!sourceDeck) throw new StoreValidationError('Deck não encontrado para duplicação.', 404);

  const destinationParentId =
    input.target_parent_id !== undefined ? input.target_parent_id : sourceDeck.parent_id;

  if (destinationParentId && isDeckDescendantOrSelf(snapshot.decks, destinationParentId, sourceDeck.id)) {
    throw new StoreValidationError(
      'Não é possível duplicar um deck diretamente dentro de um de seus próprios descendentes.'
    );
  }

  const now = new Date().toISOString();
  const newDecks: DeckRecord[] = [];
  const newCards: FlashcardRecord[] = [];

  const siblingsCount = snapshot.decks.filter(d => d.parent_id === destinationParentId).length;

  function cloneBranch(original: DeckRecord, newParentId: string | null, pos: number, isRoot: boolean): string {
    const newId = crypto.randomUUID();
    newDecks.push({
      id: newId,
      name: isRoot ? `${original.name} (Cópia)` : original.name,
      parent_id: newParentId,
      description: original.description,
      position: pos,
      created_at: now,
      updated_at: now,
    });

    const originalCards = snapshot.flashcards.filter(c => c.deck_id === original.id);
    for (const card of originalCards) {
      newCards.push({
        id: crypto.randomUUID(),
        deck_id: newId,
        front: card.front,
        back: card.back,
        created_at: now,
        updated_at: now,
      });
    }

    const children = sortDecks(snapshot.decks.filter(d => d.parent_id === original.id));
    children.forEach((child, idx) => cloneBranch(child, newId, idx, false));
    return newId;
  }

  const duplicatedRootId = cloneBranch(sourceDeck, destinationParentId ?? null, siblingsCount, true);

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    if (newDecks.length > 0) {
      const { error: dErr } = await sb.from('decks').insert(newDecks);
      if (dErr) throw new StoreValidationError(dErr.message, 500);
    }
    if (newCards.length > 0) {
      const { error: cErr } = await sb.from('flashcards').insert(newCards);
      if (cErr) throw new StoreValidationError(cErr.message, 500);
    }
    return { snapshot: await getTreeSnapshot(), duplicatedRootId };
  }

  const store = await readLocalStore();
  store.decks.push(...newDecks);
  store.flashcards.push(...newCards);
  await writeLocalStore(store);
  return { snapshot: await getTreeSnapshot(), duplicatedRootId };
}

export async function deleteDeck(input: {
  id: string;
  mode: 'cascade' | 'promote_children';
}): Promise<FlashcardTreeSnapshot> {
  const snapshot = await getTreeSnapshot();
  const target = snapshot.decks.find(d => d.id === input.id);
  if (!target) throw new StoreValidationError('Deck não encontrado.', 404);

  const now = new Date().toISOString();

  if (input.mode === 'promote_children') {
    const fallbackParent = target.parent_id;
    const directChildren = snapshot.decks.filter(d => d.parent_id === target.id);
    const directCards = snapshot.flashcards.filter(c => c.deck_id === target.id);

    if (fallbackParent === null && directCards.length > 0) {
      throw new StoreValidationError(
        'Um deck raiz com flashcards próprios não pode promover cards para fora de um deck. Exclua em cascata ou mova os cards antes.'
      );
    }

    if (await isSupabaseHierarchicalReady()) {
      const sb = getServerSupabase()!;
      if (directChildren.length > 0) {
        await sb
          .from('decks')
          .update({ parent_id: fallbackParent, updated_at: now })
          .eq('parent_id', target.id);
      }
      if (fallbackParent && directCards.length > 0) {
        await sb
          .from('flashcards')
          .update({ deck_id: fallbackParent, updated_at: now })
          .eq('deck_id', target.id);
      }
      const { error } = await sb.from('decks').delete().eq('id', target.id);
      if (error) throw new StoreValidationError(error.message, 500);
      return getTreeSnapshot();
    }

    const store = await readLocalStore();
    for (const d of store.decks) {
      if (d.parent_id === target.id) {
        d.parent_id = fallbackParent;
        d.updated_at = now;
      }
    }
    if (fallbackParent) {
      for (const c of store.flashcards) {
        if (c.deck_id === target.id) {
          c.deck_id = fallbackParent;
          c.updated_at = now;
        }
      }
    }
    store.decks = store.decks.filter(d => d.id !== target.id);
    await writeLocalStore(store);
    return getTreeSnapshot();
  }

  // Cascade deletion of deck + all descendants + cards + reviews
  const subtreeIds = new Set(collectSubtreeDeckIds(snapshot.decks, target.id));

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { error } = await sb.from('decks').delete().eq('id', target.id);
    if (error) throw new StoreValidationError(error.message, 500);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  const removedCardIds = new Set(
    store.flashcards.filter(c => subtreeIds.has(c.deck_id)).map(c => c.id)
  );
  store.decks = store.decks.filter(d => !subtreeIds.has(d.id));
  store.flashcards = store.flashcards.filter(c => !subtreeIds.has(c.deck_id));
  store.reviews = store.reviews.filter(r => !removedCardIds.has(r.card_id));
  await writeLocalStore(store);
  return getTreeSnapshot();
}

// ──────────────────────────────────────────────────────────────────────────────
// FLASHCARDS CRUD & BATCH OPS
// ──────────────────────────────────────────────────────────────────────────────

export async function createCard(input: {
  deck_id: string;
  front: string;
  back: string;
}): Promise<{ snapshot: FlashcardTreeSnapshot; createdId: string }> {
  const front = (input.front || '').trim();
  const back = (input.back || '').trim();
  if (!front || !back) {
    throw new StoreValidationError('Frente e verso do flashcard são obrigatórios.');
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { error } = await sb.from('flashcards').insert({
      id,
      deck_id: input.deck_id,
      front,
      back,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new StoreValidationError(error.message, 500);
    return { snapshot: await getTreeSnapshot(), createdId: id };
  }

  const store = await readLocalStore();
  if (!store.decks.some(d => d.id === input.deck_id)) {
    throw new StoreValidationError('Deck de destino não encontrado.', 404);
  }
  store.flashcards.push({
    id,
    deck_id: input.deck_id,
    front,
    back,
    created_at: now,
    updated_at: now,
  });
  await writeLocalStore(store);
  return { snapshot: await getTreeSnapshot(), createdId: id };
}

export async function updateCard(input: {
  id: string;
  front?: string;
  back?: string;
  deck_id?: string;
}): Promise<FlashcardTreeSnapshot> {
  const now = new Date().toISOString();

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const patch: Partial<FlashcardRecord> = { updated_at: now };
    if (input.front !== undefined) {
      const f = input.front.trim();
      if (!f) throw new StoreValidationError('A frente do card não pode ficar vazia.');
      patch.front = f;
    }
    if (input.back !== undefined) {
      const b = input.back.trim();
      if (!b) throw new StoreValidationError('O verso do card não pode ficar vazio.');
      patch.back = b;
    }
    if (input.deck_id !== undefined) patch.deck_id = input.deck_id;

    const { error } = await sb.from('flashcards').update(patch).eq('id', input.id);
    if (error) throw new StoreValidationError(error.message, 500);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  const card = store.flashcards.find(c => c.id === input.id);
  if (!card) throw new StoreValidationError('Flashcard não encontrado.', 404);

  if (input.front !== undefined) {
    const f = input.front.trim();
    if (!f) throw new StoreValidationError('A frente do card não pode ficar vazia.');
    card.front = f;
  }
  if (input.back !== undefined) {
    const b = input.back.trim();
    if (!b) throw new StoreValidationError('O verso do card não pode ficar vazio.');
    card.back = b;
  }
  if (input.deck_id !== undefined) {
    if (!store.decks.some(d => d.id === input.deck_id)) {
      throw new StoreValidationError('Deck de destino não encontrado.', 404);
    }
    card.deck_id = input.deck_id;
  }
  card.updated_at = now;
  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function moveCards(input: {
  card_ids: string[];
  target_deck_id: string;
}): Promise<FlashcardTreeSnapshot> {
  if (!input.card_ids.length) throw new StoreValidationError('Nenhum card selecionado.');
  const now = new Date().toISOString();
  const idSet = new Set(input.card_ids);

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { error } = await sb
      .from('flashcards')
      .update({ deck_id: input.target_deck_id, updated_at: now })
      .in('id', input.card_ids);
    if (error) throw new StoreValidationError(error.message, 500);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  if (!store.decks.some(d => d.id === input.target_deck_id)) {
    throw new StoreValidationError('Deck de destino não encontrado.', 404);
  }
  for (const card of store.flashcards) {
    if (idSet.has(card.id)) {
      card.deck_id = input.target_deck_id;
      card.updated_at = now;
    }
  }
  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function deleteCards(input: { card_ids: string[] }): Promise<FlashcardTreeSnapshot> {
  if (!input.card_ids.length) throw new StoreValidationError('Nenhum card selecionado.');
  const idSet = new Set(input.card_ids);

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { error } = await sb.from('flashcards').delete().in('id', input.card_ids);
    if (error) throw new StoreValidationError(error.message, 500);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  store.flashcards = store.flashcards.filter(c => !idSet.has(c.id));
  store.reviews = store.reviews.filter(r => !idSet.has(r.card_id));
  await writeLocalStore(store);
  return getTreeSnapshot();
}

// ──────────────────────────────────────────────────────────────────────────────
// REVIEWS (CARD_REVIEWS)
// ──────────────────────────────────────────────────────────────────────────────

export async function recordCardReview(input: {
  card_id: string;
  review_status: ReviewStatus;
  confidence: number;
}): Promise<FlashcardTreeSnapshot> {
  const now = new Date().toISOString();
  const confidence = Math.max(0, Math.min(4, Math.round(input.confidence)));
  const entry: ReviewResponseEntry = {
    reviewed_at: now,
    review_status: input.review_status,
    confidence,
  };

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    const { data: existing } = await sb
      .from('card_reviews')
      .select('*')
      .eq('card_id', input.card_id)
      .maybeSingle();

    if (existing) {
      const prevHistory = Array.isArray(existing.response_history)
        ? (existing.response_history as ReviewResponseEntry[])
        : [];
      await sb
        .from('card_reviews')
        .update({
          review_status: input.review_status,
          confidence,
          reviewed_at: now,
          response_history: [...prevHistory.slice(-24), entry],
        })
        .eq('id', existing.id);
    } else {
      await sb.from('card_reviews').insert({
        id: crypto.randomUUID(),
        card_id: input.card_id,
        review_status: input.review_status,
        confidence,
        reviewed_at: now,
        response_history: [entry],
      });
    }
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  const existing = store.reviews.find(r => r.card_id === input.card_id);
  if (existing) {
    existing.review_status = input.review_status;
    existing.confidence = confidence;
    existing.reviewed_at = now;
    existing.response_history = [...existing.response_history.slice(-24), entry];
  } else {
    store.reviews.push({
      id: crypto.randomUUID(),
      card_id: input.card_id,
      review_status: input.review_status,
      confidence,
      reviewed_at: now,
      response_history: [entry],
    });
  }
  await writeLocalStore(store);
  return getTreeSnapshot();
}

// ──────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT / SEED EXAMPLES
// ──────────────────────────────────────────────────────────────────────────────

export async function importTreeStructure(input: {
  payload: TreeExportPayload;
  target_parent_id?: string | null;
}): Promise<FlashcardTreeSnapshot> {
  if (!input.payload || !Array.isArray(input.payload.decks)) {
    throw new StoreValidationError('Formato JSON inválido. Esperado campo "decks" em array.');
  }

  const snapshot = await getTreeSnapshot();
  const parentId = input.target_parent_id || null;
  if (parentId && !snapshot.decks.some(d => d.id === parentId)) {
    throw new StoreValidationError('Deck de destino para importação não encontrado.', 404);
  }

  const now = new Date().toISOString();
  const decksToInsert: DeckRecord[] = [];
  const cardsToInsert: FlashcardRecord[] = [];
  const startPos = snapshot.decks.filter(d => d.parent_id === parentId).length;

  function walkImport(node: TreeExportDeckNode, curParentId: string | null, pos: number) {
    const deckId = crypto.randomUUID();
    const deckName = (node.name || '').trim() || 'Deck Importado';
    decksToInsert.push({
      id: deckId,
      name: deckName,
      parent_id: curParentId,
      description: (node.description || '').trim(),
      position: pos,
      created_at: now,
      updated_at: now,
    });

    if (Array.isArray(node.cards)) {
      for (const c of node.cards) {
        const front = (c.front || '').trim();
        const back = (c.back || '').trim();
        if (front && back) {
          cardsToInsert.push({
            id: crypto.randomUUID(),
            deck_id: deckId,
            front,
            back,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child, idx) => walkImport(child, deckId, idx));
    }
  }

  input.payload.decks.forEach((rootNode, idx) =>
    walkImport(rootNode, parentId, startPos + idx)
  );

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    if (decksToInsert.length > 0) await sb.from('decks').insert(decksToInsert);
    if (cardsToInsert.length > 0) await sb.from('flashcards').insert(cardsToInsert);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  store.decks.push(...decksToInsert);
  store.flashcards.push(...cardsToInsert);
  await writeLocalStore(store);
  return getTreeSnapshot();
}

export async function seedExampleTree(reset = false): Promise<FlashcardTreeSnapshot> {
  const seeded = createBancoBrasilExampleSeed(() => crypto.randomUUID());

  if (await isSupabaseHierarchicalReady()) {
    const sb = getServerSupabase()!;
    if (reset) {
      await sb.from('decks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    await sb.from('decks').insert(seeded.decks);
    await sb.from('flashcards').insert(seeded.flashcards);
    return getTreeSnapshot();
  }

  const store = await readLocalStore();
  if (reset) {
    store.decks = seeded.decks;
    store.flashcards = seeded.flashcards;
    store.reviews = [];
  } else {
    store.decks.push(...seeded.decks);
    store.flashcards.push(...seeded.flashcards);
  }
  await writeLocalStore(store);
  return getTreeSnapshot();
}
