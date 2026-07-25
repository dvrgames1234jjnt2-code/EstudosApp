import { supabase } from '@/lib/supabase';
import {
  ChoiceType,
  FixationCollection,
  FixationSubject,
  FixationTopic,
  FixationDeck,
  FixationPackage,
  FixationItem,
  ItemStats,
  FeedbackCounts,
} from '@/types/fixation';

// ─── Coleções (`collections`) ────────────────────────────────────────────────

export async function fetchCollections(): Promise<FixationCollection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('id, title, description, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erro ao buscar collections:", error);
    return [{ id: 22, title: 'Banco do Brasil', description: 'Simulados e Fixação para Banco do Brasil' }];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    created_at: row.created_at,
  }));
}

// ─── Matérias (`subjects`) ───────────────────────────────────────────────────

export async function fetchSubjectsByCollection(collectionId?: string | number): Promise<FixationSubject[]> {
  let query = supabase.from('subjects').select('id, collection_id, title, created_at').order('id', { ascending: true });

  if (collectionId) {
    const colIdNum = typeof collectionId === 'number' ? collectionId : parseInt(String(collectionId), 10);
    if (!isNaN(colIdNum)) {
      query = query.eq('collection_id', colIdNum);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar subjects:", error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    collection_id: row.collection_id,
    title: row.title,
    created_at: row.created_at,
  }));
}

// ─── Tópicos (`topics`) ──────────────────────────────────────────────────────

export async function fetchTopicsBySubject(subjectId?: string | number): Promise<FixationTopic[]> {
  let query = supabase.from('topics').select('id, subject_id, title, position, created_at').order('position', { ascending: true }).order('id', { ascending: true });

  if (subjectId) {
    const subIdNum = typeof subjectId === 'number' ? subjectId : parseInt(String(subjectId), 10);
    if (!isNaN(subIdNum)) {
      query = query.eq('subject_id', subIdNum);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar topics:", error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    subject_id: row.subject_id,
    title: row.title,
    position: row.position,
    created_at: row.created_at,
  }));
}

// ─── Decks (`deck_minigames`) ────────────────────────────────────────────────

export async function fetchDecksByTopic(topicId?: string | number): Promise<FixationDeck[]> {
  let query = supabase.from('deck_minigames').select('id, title, description, position, topic_id, created_at').order('position', { ascending: true }).order('created_at', { ascending: true });

  if (topicId) {
    const topIdNum = typeof topicId === 'number' ? topicId : parseInt(String(topicId), 10);
    if (!isNaN(topIdNum)) {
      query = query.eq('topic_id', topIdNum);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar decks pelo tópico:", error);
    return [];
  }

  const rawDecks = data ?? [];

  const deckIds = rawDecks.map(d => d.id);
  const cardCountsMap: Record<string, number> = {};

  if (deckIds.length > 0) {
    try {
      const { data: cardsData } = await supabase
        .from('cards_minigames')
        .select('id, deck_minigame_id')
        .in('deck_minigame_id', deckIds);

      (cardsData ?? []).forEach(c => {
        const k = String(c.deck_minigame_id);
        cardCountsMap[k] = (cardCountsMap[k] || 0) + 1;
      });
    } catch { /* silencioso */ }
  }

  return rawDecks.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    position: row.position,
    topic_id: row.topic_id,
    created_at: row.created_at,
    cardCount: cardCountsMap[String(row.id)] || 0,
  }));
}

// ─── Pacotes de Prática agrupados por `title` do card ────────────────────────

/**
 * Agrupa os cartões de um tópico pelo campo `title` da tabela `cards_minigames`.
 * Ex: Se um deck possui vários cards com title="Atalhos", eles formam um pacote "Atalhos" com a contagem exata de cartões!
 */
export async function fetchPackagesByTopic(topicId: string | number): Promise<FixationPackage[]> {
  const decks = await fetchDecksByTopic(topicId);
  if (decks.length === 0) return [];

  const deckIds = decks.map(d => d.id);
  const deckTitleMap: Record<string, string> = {};
  decks.forEach(d => { deckTitleMap[String(d.id)] = d.title; });

  let { data: cardsData } = await supabase
    .from('cards_minigames')
    .select('id, deck_minigame_id, title, front, back, explanation, position')
    .in('deck_minigame_id', deckIds)
    .order('position', { ascending: true });

  if (!cardsData || cardsData.length === 0) {
    const { data: singularData } = await supabase
      .from('cards_minigame')
      .select('id, deck_minigame_id, title, front, back, explanation, position')
      .in('deck_minigame_id', deckIds)
      .order('position', { ascending: true });
    cardsData = singularData || [];
  }

  const packageMap: Record<string, FixationItem[]> = {};

  (cardsData || []).forEach(row => {
    const item: FixationItem = {
      id: row.id,
      deck_id: row.deck_minigame_id,
      term: row.front || row.title || 'Termo',
      description: row.back || '',
      explanation: row.explanation || undefined,
      category: row.title || undefined,
    };

    // O título do pacote é o `card.title` se preenchido, ou o `deck.title`
    const packageTitle = (row.title && row.title.trim())
      ? row.title.trim()
      : (deckTitleMap[String(row.deck_minigame_id)] || 'Pacote de Estudo');

    if (!packageMap[packageTitle]) {
      packageMap[packageTitle] = [];
    }
    packageMap[packageTitle].push(item);
  });

  return Object.entries(packageMap).map(([title, items]) => ({
    id: `pkg-${title}`,
    title,
    cardCount: items.length,
    deck_id: items[0]?.deck_id || 0,
    cards: items,
  }));
}

// ─── Todos os Decks (Modo geral com fallback) ───────────────────────────────

export async function fetchDecks(): Promise<FixationDeck[]> {
  try {
    const [decksRes, topicsRes, subjectsRes] = await Promise.all([
      supabase.from('deck_minigames').select('id, title, description, position, topic_id, created_at').order('position', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('topics').select('id, title, subject_id'),
      supabase.from('subjects').select('id, title'),
    ]);

    if (decksRes.error) throw new Error(`Erro ao buscar decks: ${decksRes.error.message}`);

    const rawDecks = decksRes.data ?? [];
    const rawTopics = topicsRes.data ?? [];
    const rawSubjects = subjectsRes.data ?? [];

    const subjectsMap: Record<number, string> = {};
    for (const sub of rawSubjects) {
      subjectsMap[sub.id] = sub.title;
    }

    const topicsMap: Record<number, { title: string; subject_id: number | null }> = {};
    for (const top of rawTopics) {
      topicsMap[top.id] = { title: top.title, subject_id: top.subject_id };
    }

    return rawDecks.map(row => {
      const topicInfo = row.topic_id ? topicsMap[row.topic_id] : null;
      const topicTitle = topicInfo?.title || undefined;
      const subjectTitle = topicInfo?.subject_id ? subjectsMap[topicInfo.subject_id] : undefined;

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        position: row.position,
        topic_id: row.topic_id,
        category: topicTitle || 'Geral',
        materia: subjectTitle || 'Geral',
        created_at: row.created_at,
      };
    });
  } catch (err: any) {
    console.error("Erro em fetchDecks:", err);
    throw err;
  }
}

// ─── Cards (`cards_minigames`) ──────────────────────────────────────────────

export async function fetchItemsByDeck(deckId: string | number): Promise<FixationItem[]> {
  let { data, error } = await supabase
    .from('cards_minigames')
    .select('id, deck_minigame_id, title, front, back, explanation, position')
    .eq('deck_minigame_id', deckId)
    .order('position', { ascending: true });

  if (error) {
    const { data: singularData, error: singularError } = await supabase
      .from('cards_minigame')
      .select('id, deck_minigame_id, title, front, back, explanation, position')
      .eq('deck_minigame_id', deckId)
      .order('position', { ascending: true });

    if (singularError) throw new Error(`Erro ao buscar cards: ${error.message}`);
    data = singularData;
  }

  return (data ?? []).map(row => ({
    id: row.id,
    deck_id: row.deck_minigame_id,
    term: row.front || row.title || 'Termo',
    description: row.back || '',
    explanation: row.explanation || undefined,
    category: row.title || undefined,
  }));
}

// ─── Progresso e Feedback Stats ─────────────────────────────────────────────

const OPTION_MAP: Record<ChoiceType, number> = {
  forgot: 1,
  partial: 2,
  effortful: 3,
  learning: 4,
  mastered: 4,
};

export async function saveCardProgress(
  userId: string,
  itemId: string | number,
  performance: ChoiceType,
  sessionId: string
): Promise<void> {
  const optionId = OPTION_MAP[performance];
  const cardIdNum = typeof itemId === 'number' ? itemId : parseInt(String(itemId), 10);
  const validCardId = isNaN(cardIdNum) ? itemId : cardIdNum;

  const { error } = await supabase.from('card_progress').upsert(
    {
      card_id: validCardId,
      last_review_option_id: optionId,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'card_id' }
  );

  if (error) {
    await supabase.from('card_progress').insert({
      card_id: validCardId,
      last_review_option_id: optionId,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

export async function saveSessionProgress(
  userId: string,
  sessionId: string,
  feedback: Record<string | number, ChoiceType>
): Promise<void> {
  for (const [cardId, perf] of Object.entries(feedback)) {
    await saveCardProgress(userId, cardId, perf, sessionId).catch(() => {});
  }
}

export async function fetchUserProgress(
  userId: string,
  itemIds: (string | number)[]
): Promise<Record<string, ItemStats>> {
  if (itemIds.length === 0) return {};

  const numIds = itemIds
    .map(id => (typeof id === 'number' ? id : parseInt(String(id), 10)))
    .filter(id => !isNaN(id));

  const { data, error } = await supabase
    .from('card_progress')
    .select('card_id, last_review_option_id, created_at')
    .in('card_id', numIds.length > 0 ? numIds : itemIds);

  if (error) return {};

  const statsMap: Record<string, ItemStats> = {};
  const optionToChoice: Record<number, ChoiceType> = {
    1: 'forgot',
    2: 'partial',
    3: 'effortful',
    4: 'mastered',
  };

  for (const row of data ?? []) {
    const key = String(row.card_id);
    const choice = optionToChoice[row.last_review_option_id] || 'learning';

    statsMap[key] = {
      item_id: key,
      lastPerformance: choice,
      timesStudied: 1,
    };
  }

  return statsMap;
}

export async function fetchTopicFeedbackStats(
  deckIds: (string | number)[]
): Promise<{ counts: FeedbackCounts; cardsByFeedback: Record<string, (string | number)[]> }> {
  const counts: FeedbackCounts = { forgot: 0, partial: 0, effortful: 0, learning: 0, mastered: 0, newCards: 0 };
  const cardsByFeedback: Record<string, (string | number)[]> = {
    forgot: [],
    partial: [],
    effortful: [],
    learning: [],
    mastered: [],
    newCards: [],
  };

  if (deckIds.length === 0) return { counts, cardsByFeedback };

  const { data: cardsData } = await supabase
    .from('cards_minigames')
    .select('id')
    .in('deck_minigame_id', deckIds);

  const cardIds = (cardsData ?? []).map(c => c.id);
  if (cardIds.length === 0) return { counts, cardsByFeedback };

  const { data: progressData } = await supabase
    .from('card_progress')
    .select('card_id, last_review_option_id')
    .in('card_id', cardIds);

  const progressMap: Record<string, number> = {};
  (progressData ?? []).forEach(p => {
    progressMap[String(p.card_id)] = p.last_review_option_id;
  });

  for (const cid of cardIds) {
    const optId = progressMap[String(cid)];
    if (!optId) {
      counts.newCards += 1;
      cardsByFeedback.newCards.push(cid);
    } else if (optId === 1) {
      counts.forgot += 1;
      cardsByFeedback.forgot.push(cid);
    } else if (optId === 2) {
      counts.partial += 1;
      cardsByFeedback.partial.push(cid);
    } else if (optId === 3) {
      counts.effortful += 1;
      cardsByFeedback.effortful.push(cid);
    } else if (optId === 4) {
      counts.mastered += 1;
      cardsByFeedback.mastered.push(cid);
    }
  }

  return { counts, cardsByFeedback };
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
