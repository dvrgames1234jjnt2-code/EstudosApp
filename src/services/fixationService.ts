import { supabase } from '@/lib/supabase';
import { ChoiceType, FixationDeck, FixationItem, ItemStats } from '@/types/fixation';

// ─── Decks (deck_minigames + topics) ────────────────────────────────────────

/**
 * Busca todos os decks da tabela `deck_minigames`.
 * Tenta relacionar com `topics` para pegar a categoria (nome do assunto/tópico).
 */
export async function fetchDecks(): Promise<FixationDeck[]> {
  try {
    const { data, error } = await supabase
      .from('deck_minigames')
      .select('id, title, description, position, topic_id, created_at, topics(title)')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      // Fallback: se a relação de FK não estiver nomeada como `topics` no schema
      const { data: simpleData, error: simpleError } = await supabase
        .from('deck_minigames')
        .select('id, title, description, position, topic_id, created_at')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (simpleError) throw new Error(`Erro ao buscar decks: ${simpleError.message}`);

      return (simpleData ?? []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        position: row.position,
        topic_id: row.topic_id,
        category: 'Minigame',
        created_at: row.created_at,
      }));
    }

    return (data ?? []).map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      position: row.position,
      topic_id: row.topic_id,
      category: (row.topics as any)?.title || 'Minigame',
      created_at: row.created_at,
    }));
  } catch (err: any) {
    console.error("Erro em fetchDecks:", err);
    throw err;
  }
}

// ─── Itens (cards_minigames) ────────────────────────────────────────────────

/**
 * Busca todos os cards de um deck da tabela `cards_minigames` (ou `cards_minigame`).
 */
export async function fetchItemsByDeck(deckId: string | number): Promise<FixationItem[]> {
  // Primeiro tenta a tabela no plural `cards_minigames`
  let { data, error } = await supabase
    .from('cards_minigames')
    .select('id, deck_minigame_id, title, front, back, explanation, position')
    .eq('deck_minigame_id', deckId)
    .order('position', { ascending: true });

  if (error) {
    // Fallback se a tabela no banco for `cards_minigame` (singular)
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

// ─── Progresso (card_progress) ───────────────────────────────────────────────

const OPTION_MAP: Record<ChoiceType, number> = {
  forgot: 1,
  partial: 2,
  effortful: 3,
  learning: 4,
  mastered: 4,
};

/**
 * Salva ou atualiza a revisão na tabela `card_progress`.
 */
export async function saveCardProgress(
  userId: string,
  itemId: string | number,
  performance: ChoiceType,
  sessionId: string
): Promise<void> {
  const optionId = OPTION_MAP[performance];
  const cardIdNum = typeof itemId === 'number' ? itemId : parseInt(itemId, 10);
  const validCardId = isNaN(cardIdNum) ? itemId : cardIdNum;

  // Tenta realizar upsert baseado na chave `card_id`
  const { error } = await supabase.from('card_progress').upsert(
    {
      card_id: validCardId,
      last_review_option_id: optionId,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'card_id' }
  );

  if (error) {
    // Se upsert com onConflict falhar, faz um insert comum
    await supabase.from('card_progress').insert({
      card_id: validCardId,
      last_review_option_id: optionId,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

/**
 * Salva progresso de múltiplos cards da sessão em batch.
 */
export async function saveSessionProgress(
  userId: string,
  sessionId: string,
  feedback: Record<string | number, ChoiceType>
): Promise<void> {
  for (const [cardId, perf] of Object.entries(feedback)) {
    await saveCardProgress(userId, cardId, perf, sessionId).catch(() => {});
  }
}

/**
 * Busca estatísticas de progresso para a lista de card IDs da tabela `card_progress`.
 */
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

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
