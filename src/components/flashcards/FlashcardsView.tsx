'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PanelLeft,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  DeckRecord,
  DeckTreeNode,
  FlashcardRecord,
  FlashcardTreeSnapshot,
  ReviewStatus,
  SearchResultItem,
  TreeExportPayload,
} from '@/types/flashcardTree';
import {
  buildDeckTree,
  collectSubtreeDeckIds,
  isDeckDescendantOrSelf,
  searchTree,
  sortDecks,
} from '@/lib/flashcardTreeEngine';
import {
  apiCreateCard,
  apiCreateDeck,
  apiDeleteCards,
  apiDeleteDeck,
  apiDuplicateDeck,
  apiImportTree,
  apiMoveCards,
  apiMoveDeck,
  apiRecordReview,
  apiReorderDecks,
  apiSeedExamples,
  apiUpdateCard,
  apiUpdateDeck,
  exportTreeJson,
  fetchTreeSnapshot,
  readSnapshotFromCache,
} from '@/services/flashcardTreeClient';
import DeckTreeSidebar from './DeckTreeSidebar';
import DeckContentPanel from './DeckContentPanel';
import DeckStudySession, { StudyQueueItem } from './DeckStudySession';
import {
  CardFormModal,
  CardQuickPreviewModal,
  DeckFormModal,
  DeleteDeckModal,
  ImportExportModal,
  RecursivePickerModal,
} from './FlashcardTreeModals';

type ModalState =
  | { type: 'none' }
  | { type: 'create-deck'; parentId: string | null }
  | { type: 'edit-deck'; deck: DeckRecord }
  | { type: 'move-deck'; deck: DeckRecord }
  | { type: 'delete-deck'; node: DeckTreeNode }
  | { type: 'create-card'; deckId: string }
  | { type: 'edit-card'; card: FlashcardRecord }
  | { type: 'move-cards'; cardIds: string[] }
  | { type: 'preview-card'; card: FlashcardRecord; deckPath: string }
  | { type: 'import-export' };

function computeDefaultExpanded(decks: DeckRecord[]): Set<string> {
  const expanded = new Set<string>();
  const roots = decks.filter((d) => !d.parent_id);
  for (const r of roots) {
    expanded.add(r.id);
    for (const child of decks) {
      if (child.parent_id === r.id) {
        expanded.add(child.id);
      }
    }
  }
  return expanded;
}

export default function FlashcardsView() {
  const [snapshot, setSnapshot] = useState<FlashcardTreeSnapshot | null>(() =>
    readSnapshotFromCache()
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => readSnapshotFromCache() === null
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() => {
    const cached = readSnapshotFromCache();
    if (!cached || cached.decks.length === 0) return null;
    const roots = sortDecks(cached.decks.filter((d) => !d.parent_id));
    return roots[0]?.id ?? cached.decks[0]?.id ?? null;
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const cached = readSnapshotFromCache();
    return cached ? computeDefaultExpanded(cached.decks) : new Set();
  });

  const [globalSearch, setGlobalSearch] = useState('');
  const [contextualSearch, setContextualSearch] = useState('');
  const [cardScopeMode, setCardScopeMode] = useState<'own' | 'consolidated'>(
    'consolidated'
  );
  const [rawSelectedCardIds, setRawSelectedCardIds] = useState<Set<string>>(
    () => new Set()
  );

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [draggingDeckId, setDraggingDeckId] = useState<string | null>(null);
  const [draggingCardIds, setDraggingCardIds] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [studySession, setStudySession] = useState<{
    title: string;
    items: StudyQueueItem[];
  } | null>(null);

  const loadSnapshot = useCallback(async () => {
    setErrorBanner(null);
    try {
      const fresh = await fetchTreeSnapshot();
      setSnapshot(fresh);
      setExpandedIds((prev) =>
        prev.size > 0 ? prev : computeDefaultExpanded(fresh.decks)
      );
      setSelectedDeckId((prev) => {
        if (prev && fresh.decks.some((d) => d.id === prev)) return prev;
        const roots = sortDecks(fresh.decks.filter((d) => !d.parent_id));
        return roots[0]?.id ?? null;
      });
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao carregar os flashcards.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchTreeSnapshot()
      .then((fresh) => {
        if (!active) return;
        setSnapshot(fresh);
        setExpandedIds((prev) =>
          prev.size > 0 ? prev : computeDefaultExpanded(fresh.decks)
        );
        setSelectedDeckId((prev) => {
          if (prev && fresh.decks.some((d) => d.id === prev)) return prev;
          const roots = sortDecks(fresh.decks.filter((d) => !d.parent_id));
          return roots[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!active) return;
        setErrorBanner(
          err instanceof Error ? err.message : 'Falha ao carregar os flashcards.'
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const decks = useMemo(() => snapshot?.decks ?? [], [snapshot]);
  const flashcards = useMemo(() => snapshot?.flashcards ?? [], [snapshot]);
  const reviews = useMemo(() => snapshot?.reviews ?? [], [snapshot]);

  const tree = useMemo(
    () => buildDeckTree(decks, flashcards, reviews),
    [decks, flashcards, reviews]
  );

  const selectedNode = useMemo(
    () => (selectedDeckId ? tree.nodeMap.get(selectedDeckId) ?? null : null),
    [selectedDeckId, tree.nodeMap]
  );

  // Garante que apenas IDs existentes permaneçam selecionados
  const selectedCardIds = useMemo(() => {
    if (rawSelectedCardIds.size === 0) return rawSelectedCardIds;
    const existing = new Set(flashcards.map((c) => c.id));
    const filtered = new Set<string>();
    for (const id of rawSelectedCardIds) {
      if (existing.has(id)) filtered.add(id);
    }
    return filtered;
  }, [flashcards, rawSelectedCardIds]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    return searchTree(globalSearch, decks, flashcards, tree.nodeMap);
  }, [globalSearch, decks, flashcards, tree.nodeMap]);

  const expandAncestorsOf = useCallback(
    (deckId: string | null, sourceDecks: DeckRecord[]) => {
      if (!deckId) return;
      const byId = new Map(sourceDecks.map((d) => [d.id, d]));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        let cur: string | null = deckId;
        const visited = new Set<string>();
        while (cur && !visited.has(cur)) {
          visited.add(cur);
          next.add(cur);
          cur = byId.get(cur)?.parent_id ?? null;
        }
        return next;
      });
    },
    []
  );

  const handleToggleExpand = useCallback((deckId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(decks.map((d) => d.id)));
  }, [decks]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleSelectDeck = useCallback((deckId: string | null) => {
    setSelectedDeckId(deckId);
    setRawSelectedCardIds(new Set());
    setContextualSearch('');
  }, []);

  const handleSelectSearchResult = useCallback(
    (item: SearchResultItem) => {
      expandAncestorsOf(item.deckId, decks);
      setSelectedDeckId(item.deckId);
      setRawSelectedCardIds(new Set());
      if (item.type === 'card') {
        setContextualSearch(item.title.slice(0, 48));
        setCardScopeMode('own');
      } else {
        setContextualSearch('');
      }
      setGlobalSearch('');
    },
    [decks, expandAncestorsOf]
  );

  /* ── Operações de Decks ─────────────────────────────────── */
  const handleCreateOrEditDeck = async (values: {
    name: string;
    description: string;
  }) => {
    setErrorBanner(null);
    if (modal.type === 'create-deck') {
      const res = await apiCreateDeck({
        name: values.name,
        description: values.description,
        parent_id: modal.parentId,
      });
      setSnapshot(res.snapshot);
      expandAncestorsOf(res.createdId, res.snapshot.decks);
      setSelectedDeckId(res.createdId);
    } else if (modal.type === 'edit-deck') {
      const res = await apiUpdateDeck({
        id: modal.deck.id,
        name: values.name,
        description: values.description,
      });
      setSnapshot(res.snapshot);
    }
  };

  const handleMoveDeck = async (
    movingDeckId: string,
    targetParentId: string | null
  ) => {
    if (movingDeckId === targetParentId) return;
    if (isDeckDescendantOrSelf(decks, targetParentId, movingDeckId)) {
      setErrorBanner(
        'Não é possível mover um deck para dentro dele mesmo ou de um subdeck.'
      );
      return;
    }
    setErrorBanner(null);
    try {
      const res = await apiMoveDeck({
        id: movingDeckId,
        target_parent_id: targetParentId,
      });
      setSnapshot(res.snapshot);
      if (targetParentId) {
        expandAncestorsOf(targetParentId, res.snapshot.decks);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao mover deck.'
      );
    }
  };

  const handleDuplicateDeck = async (deck: DeckRecord) => {
    setErrorBanner(null);
    try {
      const res = await apiDuplicateDeck({
        id: deck.id,
        target_parent_id: deck.parent_id,
      });
      setSnapshot(res.snapshot);
      expandAncestorsOf(res.duplicatedRootId, res.snapshot.decks);
      setSelectedDeckId(res.duplicatedRootId);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao duplicar deck.'
      );
    }
  };

  const handleReorderSibling = async (
    deck: DeckRecord,
    direction: 'up' | 'down'
  ) => {
    const siblings = sortDecks(
      decks.filter((d) => (d.parent_id ?? null) === (deck.parent_id ?? null))
    );
    const idx = siblings.findIndex((s) => s.id === deck.id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= siblings.length) return;

    const ordered = [...siblings];
    const [moved] = ordered.splice(idx, 1);
    ordered.splice(swapWith, 0, moved);

    setErrorBanner(null);
    try {
      const res = await apiReorderDecks({
        parent_id: deck.parent_id,
        ordered_ids: ordered.map((d) => d.id),
      });
      setSnapshot(res.snapshot);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao reordenar decks.'
      );
    }
  };

  const handleDeleteDeck = async (
    deckId: string,
    mode: 'cascade' | 'promote_children'
  ) => {
    setErrorBanner(null);
    const target = decks.find((d) => d.id === deckId);
    const res = await apiDeleteDeck({ id: deckId, mode });
    setSnapshot(res.snapshot);
    if (
      selectedDeckId &&
      !res.snapshot.decks.some((d) => d.id === selectedDeckId)
    ) {
      setSelectedDeckId(target?.parent_id ?? null);
    }
  };

  /* ── Operações de Cards ─────────────────────────────────── */
  const handleCreateOrEditCard = async (values: {
    front: string;
    back: string;
    deck_id: string;
  }) => {
    setErrorBanner(null);
    if (modal.type === 'create-card') {
      const res = await apiCreateCard(values);
      setSnapshot(res.snapshot);
      expandAncestorsOf(values.deck_id, res.snapshot.decks);
    } else if (modal.type === 'edit-card') {
      const res = await apiUpdateCard({
        id: modal.card.id,
        ...values,
      });
      setSnapshot(res.snapshot);
    }
  };

  const handleMoveCards = async (cardIds: string[], targetDeckId: string) => {
    if (cardIds.length === 0) return;
    setErrorBanner(null);
    try {
      const res = await apiMoveCards({
        card_ids: cardIds,
        target_deck_id: targetDeckId,
      });
      setSnapshot(res.snapshot);
      setRawSelectedCardIds(new Set());
      expandAncestorsOf(targetDeckId, res.snapshot.decks);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao mover flashcards.'
      );
    }
  };

  const handleDeleteCards = async (cardIds: string[]) => {
    if (cardIds.length === 0) return;
    setErrorBanner(null);
    try {
      const res = await apiDeleteCards({ card_ids: cardIds });
      setSnapshot(res.snapshot);
      setRawSelectedCardIds((prev) => {
        const next = new Set(prev);
        for (const id of cardIds) next.delete(id);
        return next;
      });
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao excluir flashcards.'
      );
    }
  };

  /* ── Estudo 3D ──────────────────────────────────────────── */
  const startStudy = useCallback(
    (title: string, cardsToStudy: FlashcardRecord[]) => {
      if (cardsToStudy.length === 0) return;
      const items: StudyQueueItem[] = cardsToStudy.map((card) => {
        const node = tree.nodeMap.get(card.deck_id);
        return {
          card,
          deckName: node?.deck.name ?? 'Flashcard',
          deckPath: node?.fullPath ?? 'Raiz',
        };
      });
      setStudySession({ title, items });
    },
    [tree.nodeMap]
  );

  const handleStudyBranch = useCallback(
    (deckId: string) => {
      const node = tree.nodeMap.get(deckId);
      if (!node) return;
      const branchIds = new Set(collectSubtreeDeckIds(decks, deckId));
      const branchCards = flashcards.filter((c) => branchIds.has(c.deck_id));
      startStudy(node.deck.name, branchCards);
    },
    [decks, flashcards, startStudy, tree.nodeMap]
  );

  const handleRecordReview = useCallback(
    async (
      cardId: string,
      reviewStatus: ReviewStatus,
      confidence: number
    ) => {
      const res = await apiRecordReview({
        card_id: cardId,
        review_status: reviewStatus,
        confidence,
      });
      setSnapshot(res.snapshot);
    },
    []
  );

  /* ── Import / Export / Exemplos ─────────────────────────── */
  const handleExportJson = async (rootDeckId: string | null) => {
    setErrorBanner(null);
    try {
      const payload = await exportTreeJson(rootDeckId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const slug = rootDeckId
        ? (tree.deckMap.get(rootDeckId)?.name ?? 'deck')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')
        : 'flashcards-arvore-completa';
      anchor.href = url;
      anchor.download = `${slug}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao exportar estrutura.'
      );
    }
  };

  const handleImportJson = async (
    payload: TreeExportPayload,
    targetParentId: string | null
  ) => {
    const res = await apiImportTree({
      payload,
      target_parent_id: targetParentId,
    });
    setSnapshot(res.snapshot);
    if (targetParentId) {
      expandAncestorsOf(targetParentId, res.snapshot.decks);
    } else {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const r of computeDefaultExpanded(res.snapshot.decks)) {
          next.add(r);
        }
        return next;
      });
    }
  };

  const handleSeedExamples = async () => {
    setErrorBanner(null);
    try {
      const res = await apiSeedExamples(false);
      setSnapshot(res.snapshot);
      const nextExpanded = computeDefaultExpanded(res.snapshot.decks);
      setExpandedIds((prev) => new Set([...prev, ...nextExpanded]));
      if (!selectedDeckId) {
        const roots = sortDecks(res.snapshot.decks.filter((d) => !d.parent_id));
        if (roots[0]) setSelectedDeckId(roots[0].id);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Falha ao carregar exemplos.'
      );
    }
  };

  if (isLoading && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        <p className="text-xs font-light">Carregando árvore de decks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-slate-200">
      {/* Barra superior no mobile para abrir a árvore de decks */}
      <div className="lg:hidden flex items-center justify-between gap-2 bg-[#12141a] border border-white/[0.06] rounded-xl px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2 text-xs text-slate-200 hover:text-white min-w-0"
        >
          <PanelLeft size={15} className="text-slate-400 shrink-0" />
          <span className="truncate font-normal">
            {selectedNode ? selectedNode.deck.name : 'Árvore de decks'}
          </span>
        </button>

        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
          {tree.globalStats.totalDecks} decks · {tree.globalStats.totalCards} cards
        </span>
      </div>

      {/* Banner de erro inline (sem window.alert) */}
      {errorBanner && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-rose-950/35 border border-rose-500/30 text-xs text-rose-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">{errorBanner}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              className="hover:text-white flex items-center gap-1"
            >
              <RefreshCw size={12} />
              <span>Atualizar</span>
            </button>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              aria-label="Fechar aviso"
              className="hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Workspace principal: Sidebar hierárquica + Painel de conteúdo */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4">
        {/* Sidebar Desktop */}
        <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-20 h-[calc(100dvh-7rem)]">
          <DeckTreeSidebar
            roots={tree.roots}
            allDecks={decks}
            selectedDeckId={selectedDeckId}
            expandedIds={expandedIds}
            searchQuery={globalSearch}
            searchResults={globalSearchResults}
            onSearchChange={setGlobalSearch}
            onSelectDeck={handleSelectDeck}
            onSelectSearchResult={handleSelectSearchResult}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onCreateDeck={(parentId) => setModal({ type: 'create-deck', parentId })}
            onEditDeck={(deck) => setModal({ type: 'edit-deck', deck })}
            onDuplicateDeck={(deck) => void handleDuplicateDeck(deck)}
            onMoveDeckModal={(deck) => setModal({ type: 'move-deck', deck })}
            onDeleteDeckModal={(deck) => {
              const node = tree.nodeMap.get(deck.id);
              if (node) setModal({ type: 'delete-deck', node });
            }}
            onStudyBranch={handleStudyBranch}
            onExportBranch={(id) => void handleExportJson(id)}
            onOpenImportExport={() => setModal({ type: 'import-export' })}
            onSeedExamples={() => void handleSeedExamples()}
            onDropDeck={(movingId, targetParentId) =>
              void handleMoveDeck(movingId, targetParentId)
            }
            onDropCardsToDeck={(ids, targetDeckId) =>
              void handleMoveCards(ids, targetDeckId)
            }
            onReorderSibling={(deck, dir) => void handleReorderSibling(deck, dir)}
            draggingDeckId={draggingDeckId}
            setDraggingDeckId={setDraggingDeckId}
            draggingCardIds={draggingCardIds}
          />
        </div>

        {/* Drawer Mobile */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-[105] bg-black/75 lg:hidden flex"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div
              className="w-[86vw] max-w-xs h-full p-2 bg-[#0b0d12]"
              onClick={(e) => e.stopPropagation()}
            >
              <DeckTreeSidebar
                roots={tree.roots}
                allDecks={decks}
                selectedDeckId={selectedDeckId}
                expandedIds={expandedIds}
                searchQuery={globalSearch}
                searchResults={globalSearchResults}
                onSearchChange={setGlobalSearch}
                onSelectDeck={handleSelectDeck}
                onSelectSearchResult={handleSelectSearchResult}
                onToggleExpand={handleToggleExpand}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onCreateDeck={(parentId) =>
                  setModal({ type: 'create-deck', parentId })
                }
                onEditDeck={(deck) => setModal({ type: 'edit-deck', deck })}
                onDuplicateDeck={(deck) => void handleDuplicateDeck(deck)}
                onMoveDeckModal={(deck) => setModal({ type: 'move-deck', deck })}
                onDeleteDeckModal={(deck) => {
                  const node = tree.nodeMap.get(deck.id);
                  if (node) setModal({ type: 'delete-deck', node });
                }}
                onStudyBranch={handleStudyBranch}
                onExportBranch={(id) => void handleExportJson(id)}
                onOpenImportExport={() => setModal({ type: 'import-export' })}
                onSeedExamples={() => void handleSeedExamples()}
                onDropDeck={(movingId, targetParentId) =>
                  void handleMoveDeck(movingId, targetParentId)
                }
                onDropCardsToDeck={(ids, targetDeckId) =>
                  void handleMoveCards(ids, targetDeckId)
                }
                onReorderSibling={(deck, dir) =>
                  void handleReorderSibling(deck, dir)
                }
                draggingDeckId={draggingDeckId}
                setDraggingDeckId={setDraggingDeckId}
                draggingCardIds={draggingCardIds}
                onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Conteúdo do Deck Selecionado */}
        <DeckContentPanel
          selectedNode={selectedNode}
          tree={tree}
          allDecks={decks}
          allFlashcards={flashcards}
          cardScopeMode={cardScopeMode}
          onChangeCardScopeMode={setCardScopeMode}
          contextualQuery={contextualSearch}
          onContextualQueryChange={setContextualSearch}
          selectedCardIds={selectedCardIds}
          onToggleCardSelect={(cardId) =>
            setRawSelectedCardIds((prev) => {
              const next = new Set(prev);
              if (next.has(cardId)) next.delete(cardId);
              else next.add(cardId);
              return next;
            })
          }
          onSelectAllCards={(ids) => setRawSelectedCardIds(new Set(ids))}
          onClearCardSelection={() => setRawSelectedCardIds(new Set())}
          onSelectDeck={handleSelectDeck}
          onCreateDeck={(parentId) => setModal({ type: 'create-deck', parentId })}
          onEditDeck={(deck) => setModal({ type: 'edit-deck', deck })}
          onDuplicateDeck={(deck) => void handleDuplicateDeck(deck)}
          onMoveDeckModal={(deck) => setModal({ type: 'move-deck', deck })}
          onDeleteDeckModal={(node) => setModal({ type: 'delete-deck', node })}
          onReorderSibling={(deck, dir) => void handleReorderSibling(deck, dir)}
          onCreateCard={(deckId) => setModal({ type: 'create-card', deckId })}
          onEditCard={(card) => setModal({ type: 'edit-card', card })}
          onPreviewCard={(card, deckPath) =>
            setModal({ type: 'preview-card', card, deckPath })
          }
          onMoveCardsModal={(cardIds) => setModal({ type: 'move-cards', cardIds })}
          onDeleteCards={(cardIds) => void handleDeleteCards(cardIds)}
          onStudyCards={startStudy}
          onSeedExamples={() => void handleSeedExamples()}
          setDraggingCardIds={setDraggingCardIds}
        />
      </div>

      {/* Modais */}
      {modal.type === 'create-deck' && (
        <DeckFormModal
          key={`create-deck-${modal.parentId ?? 'root'}`}
          mode="create"
          parentId={modal.parentId}
          allDecks={decks}
          onSubmit={handleCreateOrEditDeck}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'edit-deck' && (
        <DeckFormModal
          key={`edit-deck-${modal.deck.id}`}
          mode="edit"
          initialDeck={modal.deck}
          parentId={modal.deck.parent_id}
          allDecks={decks}
          onSubmit={handleCreateOrEditDeck}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'create-card' && (
        <CardFormModal
          key={`create-card-${modal.deckId}`}
          mode="create"
          defaultDeckId={modal.deckId}
          allDecks={decks}
          nodeMap={tree.nodeMap}
          onSubmit={handleCreateOrEditCard}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'edit-card' && (
        <CardFormModal
          key={`edit-card-${modal.card.id}`}
          mode="edit"
          initialCard={modal.card}
          defaultDeckId={modal.card.deck_id}
          allDecks={decks}
          nodeMap={tree.nodeMap}
          onSubmit={handleCreateOrEditCard}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'move-deck' && (
        <RecursivePickerModal
          key={`move-deck-${modal.deck.id}`}
          mode="move-deck"
          title={`Mover "${modal.deck.name}"`}
          subtitle="Escolha o deck pai de destino (ou Raiz)"
          roots={tree.roots}
          allDecks={decks}
          movingDeckId={modal.deck.id}
          initialTargetId={modal.deck.parent_id}
          onConfirm={(targetParentId) =>
            handleMoveDeck(modal.deck.id, targetParentId)
          }
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'move-cards' && (
        <RecursivePickerModal
          key={`move-cards-${modal.cardIds.join(',')}`}
          mode="move-cards"
          title={`Mover ${modal.cardIds.length} ${
            modal.cardIds.length === 1 ? 'flashcard' : 'flashcards'
          }`}
          subtitle="Selecione o deck de destino na árvore"
          roots={tree.roots}
          allDecks={decks}
          initialTargetId={selectedDeckId}
          onConfirm={async (targetDeckId) => {
            if (targetDeckId) {
              await handleMoveCards(modal.cardIds, targetDeckId);
            }
          }}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'delete-deck' && (
        <DeleteDeckModal
          key={`delete-deck-${modal.node.deck.id}`}
          node={modal.node}
          onConfirm={(mode) => handleDeleteDeck(modal.node.deck.id, mode)}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'preview-card' && (
        <CardQuickPreviewModal
          key={`preview-${modal.card.id}`}
          card={modal.card}
          deckPath={modal.deckPath}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'import-export' && (
        <ImportExportModal
          key="import-export-modal"
          selectedDeckId={selectedDeckId}
          allDecks={decks}
          nodeMap={tree.nodeMap}
          storageBackend={snapshot?.storageBackend ?? 'local-file'}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {/* Sessão de Estudo 3D */}
      {studySession && studySession.items.length > 0 && (
        <DeckStudySession
          title={studySession.title}
          items={studySession.items}
          allDecks={decks}
          onRecordReview={handleRecordReview}
          onExit={() => setStudySession(null)}
        />
      )}
    </div>
  );
}
