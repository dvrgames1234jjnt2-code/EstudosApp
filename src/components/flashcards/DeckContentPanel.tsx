'use client';

import React, { useMemo } from 'react';
import {
  ChevronRight,
  Folder,
  Plus,
  Play,
  Pencil,
  Trash2,
  FolderInput,
  Copy,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Eye,
  Sparkles,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';
import {
  CardReviewRecord,
  DeckRecord,
  DeckTreeNode,
  FlashcardRecord,
} from '@/types/flashcardTree';
import {
  BuiltTreeResult,
  collectSubtreeDeckIds,
} from '@/lib/flashcardTreeEngine';

interface DeckContentPanelProps {
  selectedNode: DeckTreeNode | null;
  tree: BuiltTreeResult;
  allDecks: DeckRecord[];
  allFlashcards: FlashcardRecord[];
  cardScopeMode: 'own' | 'consolidated';
  onChangeCardScopeMode: (mode: 'own' | 'consolidated') => void;
  contextualQuery: string;
  onContextualQueryChange: (q: string) => void;
  selectedCardIds: Set<string>;
  onToggleCardSelect: (cardId: string) => void;
  onSelectAllCards: (cardIds: string[]) => void;
  onClearCardSelection: () => void;
  onSelectDeck: (deckId: string | null) => void;
  onCreateDeck: (parentId: string | null) => void;
  onEditDeck: (deck: DeckRecord) => void;
  onDuplicateDeck: (deck: DeckRecord) => void;
  onMoveDeckModal: (deck: DeckRecord) => void;
  onDeleteDeckModal: (node: DeckTreeNode) => void;
  onReorderSibling: (deck: DeckRecord, direction: 'up' | 'down') => void;
  onCreateCard: (deckId: string) => void;
  onEditCard: (card: FlashcardRecord) => void;
  onPreviewCard: (card: FlashcardRecord, deckPath: string) => void;
  onMoveCardsModal: (cardIds: string[]) => void;
  onDeleteCards: (cardIds: string[]) => void;
  onStudyCards: (title: string, cards: FlashcardRecord[]) => void;
  onSeedExamples: () => void;
  setDraggingCardIds: (ids: string[]) => void;
}

function formatActivityDate(iso: string | null): string {
  if (!iso) return 'Sem atividade';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Sem atividade';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatReviewLabel(review: CardReviewRecord | undefined): {
  label: string;
  tone: string;
} {
  if (!review) {
    return { label: 'Novo', tone: 'text-slate-500' };
  }
  if (review.review_status === 'mastered') {
    return { label: 'Dominado', tone: 'text-emerald-400' };
  }
  if (review.review_status === 'reviewing') {
    return { label: 'Em revisão', tone: 'text-slate-300' };
  }
  return { label: 'Aprendendo', tone: 'text-amber-400' };
}

export default function DeckContentPanel({
  selectedNode,
  tree,
  allDecks,
  allFlashcards,
  cardScopeMode,
  onChangeCardScopeMode,
  contextualQuery,
  onContextualQueryChange,
  selectedCardIds,
  onToggleCardSelect,
  onSelectAllCards,
  onClearCardSelection,
  onSelectDeck,
  onCreateDeck,
  onEditDeck,
  onDuplicateDeck,
  onMoveDeckModal,
  onDeleteDeckModal,
  onReorderSibling,
  onCreateCard,
  onEditCard,
  onPreviewCard,
  onMoveCardsModal,
  onDeleteCards,
  onStudyCards,
  onSeedExamples,
  setDraggingCardIds,
}: DeckContentPanelProps) {
  // Cards pertencentes ao ramo do deck selecionado (próprios ou consolidados)
  const branchDeckIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(collectSubtreeDeckIds(allDecks, selectedNode.deck.id));
  }, [allDecks, selectedNode]);

  const ownCards = useMemo(() => {
    if (!selectedNode) return [];
    return allFlashcards.filter((c) => c.deck_id === selectedNode.deck.id);
  }, [allFlashcards, selectedNode]);

  const branchCards = useMemo(() => {
    if (!selectedNode) return [];
    return allFlashcards.filter((c) => branchDeckIds.has(c.deck_id));
  }, [allFlashcards, branchDeckIds, selectedNode]);

  const visibleCards = useMemo(() => {
    if (!selectedNode) return [];
    const base = cardScopeMode === 'own' ? ownCards : branchCards;
    const q = contextualQuery.trim().toLowerCase();
    if (!q) return base;

    return base.filter((card) => {
      const originPath = tree.nodeMap.get(card.deck_id)?.fullPath ?? '';
      return (
        card.front.toLowerCase().includes(q) ||
        card.back.toLowerCase().includes(q) ||
        originPath.toLowerCase().includes(q)
      );
    });
  }, [
    selectedNode,
    cardScopeMode,
    ownCards,
    branchCards,
    contextualQuery,
    tree.nodeMap,
  ]);

  const matchingSubdecksInContext = useMemo(() => {
    if (!selectedNode) return [];
    const q = contextualQuery.trim().toLowerCase();
    if (!q) return [];
    return allDecks
      .filter((d) => d.id !== selectedNode.deck.id && branchDeckIds.has(d.id))
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
      )
      .map((d) => tree.nodeMap.get(d.id))
      .filter((n): n is DeckTreeNode => Boolean(n));
  }, [allDecks, branchDeckIds, contextualQuery, selectedNode, tree.nodeMap]);

  const visibleCardIds = useMemo(
    () => visibleCards.map((c) => c.id),
    [visibleCards]
  );

  const allVisibleSelected =
    visibleCardIds.length > 0 &&
    visibleCardIds.every((id) => selectedCardIds.has(id));

  /* ──────────────────────────────────────────────────────────
   * MODO VISÃO GERAL (nenhum deck selecionado)
   * ────────────────────────────────────────────────────────── */
  if (!selectedNode) {
    return (
      <section className="flex-1 min-w-0 bg-[#12141a] border border-white/[0.06] rounded-xl p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-light tracking-tight text-white">
              Flashcards Hierárquicos
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-light tabular-nums">
              <span>{tree.globalStats.totalDecks} decks</span>
              <span className="text-slate-600">·</span>
              <span>{tree.globalStats.totalCards} cards</span>
              <span className="text-slate-600">·</span>
              <span>{tree.globalStats.masteredCards} dominados</span>
              <span className="text-slate-600">·</span>
              <span>
                Última atividade: {formatActivityDate(tree.globalStats.lastActivityAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCreateDeck(null)}
              className="px-3.5 py-2 rounded-lg border border-white/[0.09] bg-[#161922] hover:bg-white/[0.07] text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} />
              <span>Novo deck raiz</span>
            </button>
            <button
              type="button"
              onClick={onSeedExamples}
              className="px-3.5 py-2 rounded-lg border border-white/[0.09] bg-[#161922] hover:bg-white/[0.07] text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles size={13} />
              <span>Exemplos Banco do Brasil</span>
            </button>
            <button
              type="button"
              disabled={allFlashcards.length === 0}
              onClick={() => onStudyCards('Todos os Decks', allFlashcards)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 transition-colors"
            >
              <Play size={13} />
              <span>Estudar todos ({allFlashcards.length})</span>
            </button>
          </div>
        </div>

        {tree.roots.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Layers size={24} className="mx-auto text-slate-500 stroke-[1.4]" />
            <p className="text-sm text-slate-300 font-light">
              Crie um deck raiz ou carregue a estrutura de exemplo para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 px-1">
              Decks principais
            </div>
            <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-lg overflow-hidden bg-[#0f1116]">
              {tree.roots.map((root, idx) => (
                <div
                  key={root.deck.id}
                  onClick={() => onSelectDeck(root.deck.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder size={14} className="text-slate-400 shrink-0 stroke-[1.6]" />
                      <span className="text-sm font-normal text-slate-100 truncate">
                        {root.deck.name}
                      </span>
                    </div>
                    {root.deck.description && (
                      <p className="text-xs text-slate-500 font-light truncate pl-6">
                        {root.deck.description}
                      </p>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between sm:justify-end gap-3 pl-6 sm:pl-0 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-slate-400 font-light tabular-nums">
                      {root.stats.totalSubdecksCount} subdecks ·{' '}
                      {root.stats.totalCardsCount} cards
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onReorderSibling(root.deck, 'up')}
                        title="Mover acima"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-25"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= tree.roots.length - 1}
                        onClick={() => onReorderSibling(root.deck, 'down')}
                        title="Mover abaixo"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-25"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={root.stats.totalCardsCount === 0}
                        onClick={() => {
                          const ids = new Set(
                            collectSubtreeDeckIds(allDecks, root.deck.id)
                          );
                          onStudyCards(
                            root.deck.name,
                            allFlashcards.filter((c) => ids.has(c.deck_id))
                          );
                        }}
                        title="Estudar este ramo"
                        className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-xs text-slate-200 disabled:opacity-30 flex items-center gap-1"
                      >
                        <Play size={11} />
                        <span>Estudar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ──────────────────────────────────────────────────────────
   * MODO DECK SELECIONADO
   * ────────────────────────────────────────────────────────── */
  const { deck, stats, breadcrumb, children } = selectedNode;

  return (
    <section className="flex-1 min-w-0 bg-[#12141a] border border-white/[0.06] rounded-xl p-4 sm:p-6 space-y-6">
      {/* Breadcrumb clicável */}
      <nav
        aria-label="Caminho hierárquico"
        className="flex items-center flex-wrap gap-1 text-xs text-slate-400 font-light"
      >
        <button
          type="button"
          onClick={() => onSelectDeck(null)}
          className="hover:text-white transition-colors"
        >
          Início
        </button>
        {breadcrumb.map((item, idx) => {
          const isLast = idx === breadcrumb.length - 1;
          return (
            <React.Fragment key={item.id}>
              <ChevronRight size={12} className="text-slate-600 shrink-0" />
              <button
                type="button"
                onClick={() => onSelectDeck(item.id)}
                className={`truncate max-w-[200px] sm:max-w-[260px] transition-colors ${
                  isLast
                    ? 'text-slate-100 font-normal'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.name}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Cabeçalho do Deck + Estatísticas individuais e consolidadas */}
      <div className="border-b border-white/[0.06] pb-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg sm:text-xl font-light tracking-tight text-white truncate">
                {deck.name}
              </h2>
              <button
                type="button"
                onClick={() => onEditDeck(deck)}
                title="Renomear ou editar descrição"
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] shrink-0"
              >
                <Pencil size={13} />
              </button>
            </div>
            {deck.description && (
              <p className="text-xs sm:text-[13px] text-slate-400 font-light max-w-2xl">
                {deck.description}
              </p>
            )}

            {/* Estatísticas enxutas em linha sem pílulas */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-xs text-slate-400 font-light tabular-nums">
              <span>
                <strong className="font-normal text-slate-200">
                  {stats.ownCardsCount}
                </strong>{' '}
                cards próprios
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-normal text-slate-200">
                  {stats.descendantCardsCount}
                </strong>{' '}
                de subdecks
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-normal text-slate-200">
                  {stats.totalCardsCount}
                </strong>{' '}
                no ramo
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-normal text-slate-200">
                  {stats.directSubdecksCount}
                </strong>{' '}
                subdecks diretos ({stats.totalSubdecksCount} totais)
              </span>
              <span className="text-slate-600">·</span>
              <span>
                Última atividade: {formatActivityDate(stats.lastActivityAt)}
              </span>
            </div>
          </div>

          {/* Ações do Deck */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onCreateCard(deck.id)}
              className="px-3 py-2 rounded-lg border border-white/[0.09] bg-[#161922] hover:bg-white/[0.07] text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} />
              <span>Novo card</span>
            </button>

            <button
              type="button"
              onClick={() => onCreateDeck(deck.id)}
              className="px-3 py-2 rounded-lg border border-white/[0.09] bg-[#161922] hover:bg-white/[0.07] text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} />
              <span>Novo subdeck</span>
            </button>

            {stats.ownCardsCount > 0 && stats.descendantCardsCount > 0 && (
              <button
                type="button"
                onClick={() => onStudyCards(`${deck.name} (Próprios)`, ownCards)}
                className="px-3 py-2 rounded-lg border border-white/[0.09] bg-[#161922] hover:bg-white/[0.07] text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <Play size={12} />
                <span>Só próprios ({ownCards.length})</span>
              </button>
            )}

            <button
              type="button"
              disabled={branchCards.length === 0}
              onClick={() => onStudyCards(deck.name, branchCards)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-35 flex items-center gap-1.5 transition-colors"
            >
              <Play size={13} />
              <span>Estudar ramo ({branchCards.length})</span>
            </button>
          </div>
        </div>

        {/* Ações secundárias discretas do deck */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => onDuplicateDeck(deck)}
            className="hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <Copy size={11} />
            <span>Duplicar subárvore</span>
          </button>
          <button
            type="button"
            onClick={() => onMoveDeckModal(deck)}
            className="hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <FolderInput size={11} />
            <span>Mover deck</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteDeckModal(selectedNode)}
            className="hover:text-rose-400 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={11} />
            <span>Excluir deck</span>
          </button>
        </div>
      </div>

      {/* Subdecks diretos */}
      {children.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Subdecks ({children.length})
            </h3>
          </div>

          <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-lg overflow-hidden bg-[#0f1116]">
            {children.map((child, idx) => (
              <div
                key={child.deck.id}
                onClick={() => onSelectDeck(child.deck.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Folder size={13} className="text-slate-400 shrink-0 stroke-[1.6]" />
                  <span className="text-[13px] font-normal text-slate-200 truncate">
                    {child.deck.name}
                  </span>
                  {child.deck.description && (
                    <span className="hidden md:inline text-xs text-slate-500 font-light truncate">
                      — {child.deck.description}
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center justify-between sm:justify-end gap-3 pl-5 sm:pl-0 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-slate-500 font-light tabular-nums">
                    {child.stats.ownCardsCount} próprios ·{' '}
                    {child.stats.totalCardsCount} no ramo
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onReorderSibling(child.deck, 'up')}
                      title="Mover acima"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-25"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx >= children.length - 1}
                      onClick={() => onReorderSibling(child.deck, 'down')}
                      title="Mover abaixo"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-25"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={child.stats.totalCardsCount === 0}
                      onClick={() => {
                        const ids = new Set(
                          collectSubtreeDeckIds(allDecks, child.deck.id)
                        );
                        onStudyCards(
                          child.deck.name,
                          allFlashcards.filter((c) => ids.has(c.deck_id))
                        );
                      }}
                      title="Estudar subdeck"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-25"
                    >
                      <Play size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de controle dos Flashcards (Próprios vs Consolidado + Busca contextual) */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Distinção explícita: Próprios vs Consolidado */}
          <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#0e1015] p-0.5 self-start">
            <button
              type="button"
              onClick={() => onChangeCardScopeMode('own')}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors tabular-nums ${
                cardScopeMode === 'own'
                  ? 'bg-white/[0.1] text-white font-normal'
                  : 'text-slate-400 hover:text-slate-200 font-light'
              }`}
            >
              Cards próprios ({ownCards.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeCardScopeMode('consolidated')}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors tabular-nums ${
                cardScopeMode === 'consolidated'
                  ? 'bg-white/[0.1] text-white font-normal'
                  : 'text-slate-400 hover:text-slate-200 font-light'
              }`}
            >
              Consolidado com subdecks ({branchCards.length})
            </button>
          </div>

          {/* Pesquisa contextual no ramo */}
          <div className="relative w-full md:w-72">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={contextualQuery}
              onChange={(e) => onContextualQueryChange(e.target.value)}
              placeholder="Filtrar neste deck e subdecks..."
              className="w-full bg-[#0e1015] border border-white/[0.08] rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-white/20"
            />
            {contextualQuery && (
              <button
                type="button"
                onClick={() => onContextualQueryChange('')}
                aria-label="Limpar busca contextual"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Subdecks correspondentes na busca contextual */}
        {matchingSubdecksInContext.length > 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-[#0f1116] p-3 space-y-1.5">
            <p className="text-[11px] text-slate-500">
              Subdecks encontrados neste ramo ({matchingSubdecksInContext.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {matchingSubdecksInContext.map((m) => (
                <button
                  key={m.deck.id}
                  type="button"
                  onClick={() => onSelectDeck(m.deck.id)}
                  className="text-left px-2.5 py-1 rounded border border-white/[0.08] bg-[#151821] hover:bg-white/[0.06] text-xs text-slate-200 transition-colors"
                >
                  {m.fullPath}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Barra de seleção múltipla em lote */}
        {selectedCardIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-white/[0.12] bg-[#171a22]">
            <span className="text-xs text-slate-200 tabular-nums">
              {selectedCardIds.size}{' '}
              {selectedCardIds.size === 1 ? 'card selecionado' : 'cards selecionados'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const chosen = allFlashcards.filter((c) =>
                    selectedCardIds.has(c.id)
                  );
                  onStudyCards(`Seleção (${chosen.length})`, chosen);
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium flex items-center gap-1"
              >
                <Play size={11} />
                <span>Estudar</span>
              </button>
              <button
                type="button"
                onClick={() => onMoveCardsModal(Array.from(selectedCardIds))}
                className="px-2.5 py-1.5 rounded-md border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-xs text-slate-200 flex items-center gap-1"
              >
                <FolderInput size={11} />
                <span>Mover em lote</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteCards(Array.from(selectedCardIds))}
                className="px-2.5 py-1.5 rounded-md border border-rose-500/30 bg-rose-950/30 hover:bg-rose-950/50 text-xs text-rose-300 flex items-center gap-1"
              >
                <Trash2 size={11} />
                <span>Excluir</span>
              </button>
              <button
                type="button"
                onClick={onClearCardSelection}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Lista de Flashcards */}
        {visibleCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] py-12 px-4 text-center space-y-2.5">
            <p className="text-xs sm:text-sm text-slate-400 font-light">
              {contextualQuery
                ? 'Nenhum flashcard corresponde ao filtro neste ramo.'
                : cardScopeMode === 'own' && stats.descendantCardsCount > 0
                ? 'Este deck não possui cards diretos, mas possui cards nos subdecks.'
                : 'Nenhum flashcard neste deck ainda.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onCreateCard(deck.id)}
                className="px-3 py-1.5 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-xs text-slate-200 transition-colors"
              >
                Criar flashcard aqui
              </button>
              {cardScopeMode === 'own' && stats.descendantCardsCount > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeCardScopeMode('consolidated')}
                  className="px-3 py-1.5 rounded-md border border-white/[0.08] hover:bg-white/[0.05] text-xs text-slate-300 transition-colors"
                >
                  Ver {stats.descendantCardsCount} cards herdados de subdecks
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-white/[0.06] rounded-lg overflow-hidden bg-[#0f1116]">
            {/* Cabeçalho de seleção */}
            <div className="px-3.5 py-2 border-b border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => {
                  if (allVisibleSelected) {
                    onClearCardSelection();
                  } else {
                    onSelectAllCards(visibleCardIds);
                  }
                }}
                className="flex items-center gap-2 hover:text-slate-200 transition-colors"
              >
                {allVisibleSelected ? (
                  <CheckSquare size={13} className="text-slate-200" />
                ) : (
                  <Square size={13} />
                )}
                <span>
                  {allVisibleSelected
                    ? 'Desmarcar visíveis'
                    : `Selecionar todos (${visibleCards.length})`}
                </span>
              </button>
              <span className="hidden sm:inline">
                Arraste pelo ícone lateral para mover para outro deck
              </span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {visibleCards.map((card) => {
                const isOwn = card.deck_id === deck.id;
                const originNode = tree.nodeMap.get(card.deck_id);
                const originPath = originNode?.fullPath ?? deck.name;
                const isChecked = selectedCardIds.has(card.id);
                const reviewInfo = formatReviewLabel(
                  tree.reviewByCardId.get(card.id)
                );

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => {
                      const idsToDrag =
                        isChecked && selectedCardIds.size > 0
                          ? Array.from(selectedCardIds)
                          : [card.id];
                      setDraggingCardIds(idsToDrag);
                      e.dataTransfer.setData(
                        'application/x-card-ids',
                        JSON.stringify(idsToDrag)
                      );
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDraggingCardIds([])}
                    className={`group px-3.5 py-3 flex items-start gap-2.5 transition-colors ${
                      isChecked ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    {/* Drag & Checkbox */}
                    <div className="flex items-center gap-1 pt-0.5 shrink-0">
                      <span
                        title="Arrastar para outro deck na barra lateral"
                        className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing hidden sm:inline-flex"
                      >
                        <GripVertical size={13} />
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleCardSelect(card.id)}
                        aria-label="Selecionar card"
                        className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-200"
                      >
                        {isChecked ? (
                          <CheckSquare size={14} className="text-slate-100" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    </div>

                    {/* Conteúdo Frente / Verso + Origem Próprio vs Herdado */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-normal ${
                            isOwn
                              ? 'bg-white/[0.08] text-slate-200'
                              : 'bg-[#1a1f29] text-slate-400 border border-white/[0.07]'
                          }`}
                        >
                          {isOwn ? 'Próprio' : 'Herdado de subdeck'}
                        </span>

                        {!isOwn && (
                          <button
                            type="button"
                            onClick={() => onSelectDeck(card.deck_id)}
                            className="text-slate-400 hover:text-slate-200 truncate max-w-full sm:max-w-md text-left transition-colors"
                            title={originPath}
                          >
                            {originPath}
                          </button>
                        )}

                        <span className={`ml-auto text-[11px] ${reviewInfo.tone}`}>
                          {reviewInfo.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-5">
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Frente
                          </div>
                          <p className="text-[13px] text-slate-100 font-light leading-relaxed break-words whitespace-pre-wrap">
                            {card.front}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-0.5 md:border-l md:border-white/[0.06] md:pl-4">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Verso
                          </div>
                          <p className="text-[13px] text-slate-300 font-light leading-relaxed break-words whitespace-pre-wrap">
                            {card.back}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ações do Card */}
                    <div className="flex flex-col sm:flex-row items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPreviewCard(card, originPath)}
                        title="Visualizar flashcard 3D"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditCard(card)}
                        title="Editar card"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveCardsModal([card.id])}
                        title="Mover para outro deck"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors"
                      >
                        <FolderInput size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCards([card.id])}
                        title="Excluir card"
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
