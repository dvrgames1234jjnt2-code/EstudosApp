import { supabase } from '@/lib/supabase';
import { ChoiceType, FixationDeck, FixationItem, FixationProgress, ItemStats } from '@/types/fixation';

// ─── Decks ───────────────────────────────────────────────────────────────────

/**
 * Busca todos os decks de fixação disponíveis.
 */
export async function fetchDecks(): Promise<FixationDeck[]> {
  const { data, error } = await supabase
    .from('fixation_decks')
    .select('id, title, category, created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erro ao buscar decks: ${error.message}`);
  return data ?? [];
}

// ─── Itens ───────────────────────────────────────────────────────────────────

/**
 * Busca todos os itens de um deck específico.
 */
export async function fetchItemsByDeck(deckId: string): Promise<FixationItem[]> {
  const { data, error } = await supabase
    .from('fixation_items')
    .select('id, deck_id, term, description, category')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erro ao buscar itens: ${error.message}`);
  return data ?? [];
}

// ─── Progresso ───────────────────────────────────────────────────────────────

/**
 * Salva (ou atualiza) o desempenho do usuário em um card dentro de uma sessão.
 * Usa UPSERT para garantir que apenas uma resposta por (user, item, session) é armazenada.
 */
export async function saveCardProgress(
  userId: string,
  itemId: string,
  performance: ChoiceType,
  sessionId: string
): Promise<void> {
  const { error } = await supabase.from('fixation_progress').upsert(
    {
      user_id: userId,
      item_id: itemId,
      performance,
      session_id: sessionId,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,item_id,session_id' }
  );

  if (error) throw new Error(`Erro ao salvar progresso: ${error.message}`);
}

/**
 * Salva o progresso de múltiplos cards de uma vez (batch) ao final da sessão.
 */
export async function saveSessionProgress(
  userId: string,
  sessionId: string,
  feedback: Record<string, ChoiceType>
): Promise<void> {
  const rows: Omit<FixationProgress, 'id' | 'answered_at'>[] = Object.entries(feedback).map(
    ([itemId, performance]) => ({
      user_id: userId,
      item_id: itemId,
      performance,
      session_id: sessionId,
    })
  );

  if (rows.length === 0) return;

  const { error } = await supabase.from('fixation_progress').upsert(rows, {
    onConflict: 'user_id,item_id,session_id',
  });

  if (error) throw new Error(`Erro ao salvar sessão: ${error.message}`);
}

/**
 * Busca as estatísticas de progresso do usuário para um deck inteiro.
 * Retorna o último desempenho e o número de vezes que cada item foi estudado.
 */
export async function fetchUserProgress(
  userId: string,
  itemIds: string[]
): Promise<Record<string, ItemStats>> {
  if (itemIds.length === 0) return {};

  const { data, error } = await supabase
    .from('fixation_progress')
    .select('item_id, performance, answered_at')
    .eq('user_id', userId)
    .in('item_id', itemIds)
    .order('answered_at', { ascending: false });

  if (error) throw new Error(`Erro ao buscar progresso: ${error.message}`);

  const statsMap: Record<string, ItemStats> = {};

  for (const row of data ?? []) {
    if (!statsMap[row.item_id]) {
      // Primeira ocorrência (mais recente por causa do order)
      statsMap[row.item_id] = {
        item_id: row.item_id,
        lastPerformance: row.performance as ChoiceType,
        timesStudied: 1,
      };
    } else {
      statsMap[row.item_id].timesStudied += 1;
    }
  }

  return statsMap;
}

/**
 * Gera um ID único de sessão para agrupar os resultados de uma rodada.
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
