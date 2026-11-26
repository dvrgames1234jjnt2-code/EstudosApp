'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Upload,
  Sparkles,
  Copy,
  FolderInput,
  Pencil,
  Trash2,
  Play,
  ArrowUp,
  ArrowDown,
  Download,
} from 'lucide-react';
import {
  DeckRecord,
  DeckTreeNode,
  SearchResultItem,
} from '@/types/flashcardTree';
import { isDeckDescendantOrSelf } from '@/lib/flashcardTreeEngine';

interface DeckTreeSidebarProps {
  roots: DeckTreeNode[];
  allDecks: DeckRecord[];
  selectedDeckId: string | null;
  expandedIds: Set<string>;
  searchQuery: string;
  searchResults: SearchResultItem[];
  onSearchChange: (q: string) => void;
  onSelectDeck: (deckId: string | null) => void;
  onSelectSearchResult: (item: SearchResultItem) => void;
  onToggleExpand: (deckId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCreateDeck: (parentId: string | null) => void;
  onEditDeck: (deck: DeckRecord) => void;
  onDuplicateDeck: (deck: DeckRecord) => void;
  onMoveDeckModal: (deck: DeckRecord) => void;
  onDeleteDeckModal: (deck: DeckRecord) => void;
  onStudyBranch: (deckId: string) => void;
  onExportBranch: (deckId: string | null) => void;
  onOpenImportExport: () => void;
  onSeedExamples: () => void;
  onDropDeck: (movingDeckId: string, targetParentId: string | null) => void;
  onDropCardsToDeck: (cardIds: string[], targetDeckId: string) => void;
  onReorderSibling: (deck: DeckRecord, direction: 'up' | 'down') => void;
  draggingDeckId: string | null;
  setDraggingDeckId: (id: string | null) => void;
  draggingCardIds: string[];
  onCloseMobileDrawer?: () => void;
}

interface TreeNodeProps {
  node: DeckTreeNode;
  allDecks: DeckRecord[];
  siblingsCount: number;
  siblingIndex: number;
  selectedDeckId: string | null;
  expandedIds: Set<string>;
  onSelectDeck: (deckId: string | null) => void;
  onToggleExpand: (deckId: string) => void;
  onCreateDeck: (parentId: string | null) => void;
  onEditDeck: (deck: DeckRecord) => void;
  onDuplicateDeck: (deck: DeckRecord) => void;
  onMoveDeckModal: (deck: DeckRecord) => void;
  onDeleteDeckModal: (deck: DeckRecord) => void;
  onStudyBranch: (deckId: string) => void;
  onExportBranch: (deckId: string | null) => void;
  onDropDeck: (movingDeckId: string, targetParentId: string | null) => void;
  onDropCardsToDeck: (cardIds: string[], targetDeckId: string) => void;
  onReorderSibling: (deck: DeckRecord, direction: 'up' | 'down') => void;
  draggingDeckId: string | null;
  setDraggingDeckId: (id: string | null) => void;
  draggingCardIds: string[];
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onCloseMobileDrawer?: () => void;
}

const DeckTreeNodeItem = React.memo(function DeckTreeNodeItem({
  node,
  allDecks,
  siblingsCount,
  siblingIndex,
  selectedDeckId,
  expandedIds,
  onSelectDeck,
  onToggleExpand,
  onCreateDeck,
  onEditDeck,
  onDuplicateDeck,
  onMoveDeckModal,
  onDeleteDeckModal,
  onStudyBranch,
  onExportBranch,
  onDropDeck,
  onDropCardsToDeck,
  onReorderSibling,
  draggingDeckId,
  setDraggingDeckId,
  draggingCardIds,
  openMenuId,
  setOpenMenuId,
  onCloseMobileDrawer,
}: TreeNodeProps) {
  const [dragState, setDragState] = useState<'none' | 'valid' | 'invalid'>('none');
  const isSelected = selectedDeckId === node.deck.id;
  const isExpanded = expandedIds.has(node.deck.id);
  const hasChildren = node.children.length > 0;
  const isMenuOpen = openMenuId === node.deck.id;

  const canAcceptDrop = useMemo(() => {
    if (draggingCardIds.length > 0) return true;
    if (draggingDeckId) {
      return !isDeckDescendantOrSelf(allDecks, node.deck.id, draggingDeckId);
    }
    return true;
  }, [allDecks, draggingCardIds.length, draggingDeckId, node.deck.id]);

  return (
    <div className="select-none">
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggingDeckId(node.deck.id);
          e.dataTransfer.setData('application/x-deck-id', node.deck.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDraggingDeckId(null);
          setDragState('none');
        }}
        onDragOver={(e) => {
          const types = e.dataTransfer.types;
          if (!types.includes('application/x-deck-id') && !types.includes('application/x-card-ids')) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (!canAcceptDrop) {
            e.dataTransfer.dropEffect = 'none';
            setDragState('invalid');
          } else {
            e.dataTransfer.dropEffect = 'move';
            setDragState('valid');
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragState('none');
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragState('none');

          const rawCards = e.dataTransfer.getData('application/x-card-ids');
          if (rawCards) {
            try {
              const ids = JSON.parse(rawCards) as string[];
              if (Array.isArray(ids) && ids.length > 0) {
                onDropCardsToDeck(ids, node.deck.id);
              }
            } catch {
              // ignore malformed drag payload
            }
            return;
          }

          const movedDeckId = e.dataTransfer.getData('application/x-deck-id');
          if (movedDeckId && movedDeckId !== node.deck.id) {
            onDropDeck(movedDeckId, node.deck.id);
          }
        }}
        className={`group relative flex items-center gap-1 rounded-md px-1.5 py-1.5 sm:py-1 transition-colors cursor-pointer ${
          dragState === 'valid'
            ? 'bg-slate-700/40 ring-1 ring-slate-400/50 text-white'
            : dragState === 'invalid'
            ? 'bg-rose-950/40 ring-1 ring-rose-500/40 text-rose-300'
            : isSelected
            ? 'bg-white/[0.08] text-slate-100'
            : 'text-slate-300 hover:bg-white/[0.04] hover:text-slate-100'
        }`}
        onClick={() => {
          onSelectDeck(node.deck.id);
          onCloseMobileDrawer?.();
        }}
      >
        {/* Indicador de expansão */}
        <button
          type="button"
          aria-label={isExpanded ? 'Recolher subdecks' : 'Expandir subdecks'}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.deck.id);
          }}
          className={`w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 shrink-0 transition-colors ${
            hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight
            size={13}
            className={`transition-transform duration-150 ${isExpanded ? 'rotate-90 text-slate-300' : ''}`}
          />
        </button>

        {/* Ícone discreto */}
        <span className="text-slate-400 shrink-0">
          {isExpanded && hasChildren ? (
            <FolderOpen size={14} className="stroke-[1.6]" />
          ) : (
            <Folder size={14} className="stroke-[1.6]" />
          )}
        </span>

        {/* Nome */}
        <span
          className={`flex-1 min-w-0 truncate text-[12.5px] leading-snug ${
            isSelected ? 'font-medium text-white' : 'font-light text-slate-300'
          }`}
          title={node.fullPath}
        >
          {node.deck.name}
        </span>

        {/* Quantidade de flashcards recursiva */}
        <span
          className="text-[11px] font-light text-slate-500 tabular-nums shrink-0 px-1"
          title={`${node.stats.ownCardsCount} próprios · ${node.stats.totalCardsCount} no ramo`}
        >
          {node.stats.totalCardsCount}
        </span>

        {/* Menu de ações com três pontos */}
        <div
          className="relative shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Ações para ${node.deck.name}`}
            aria-expanded={isMenuOpen}
            onClick={() => setOpenMenuId(isMenuOpen ? null : node.deck.id)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              isMenuOpen
                ? 'bg-white/[0.12] text-white opacity-100'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] opacity-90 lg:opacity-0 lg:group-hover:opacity-100'
            }`}
          >
            <MoreHorizontal size={13} />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-7 z-50 w-52 rounded-lg border border-white/[0.10] bg-[#181b22] py-1 shadow-xl text-xs text-slate-300"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onStudyBranch(node.deck.id);
                }}
                disabled={node.stats.totalCardsCount === 0}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white disabled:opacity-35 transition-colors"
              >
                <Play size={12} />
                <span>Estudar ramo ({node.stats.totalCardsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onCreateDeck(node.deck.id);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Plus size={12} />
                <span>Novo subdeck</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onEditDeck(node.deck);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Pencil size={12} />
                <span>Renomear / editar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onDuplicateDeck(node.deck);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Copy size={12} />
                <span>Duplicar árvore</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onMoveDeckModal(node.deck);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <FolderInput size={12} />
                <span>Mover para...</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                disabled={siblingIndex === 0}
                onClick={() => {
                  setOpenMenuId(null);
                  onReorderSibling(node.deck, 'up');
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white disabled:opacity-35 transition-colors"
              >
                <ArrowUp size={12} />
                <span>Mover acima</span>
              </button>
              <button
                type="button"
                disabled={siblingIndex >= siblingsCount - 1}
                onClick={() => {
                  setOpenMenuId(null);
                  onReorderSibling(node.deck, 'down');
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white disabled:opacity-35 transition-colors"
              >
                <ArrowDown size={12} />
                <span>Mover abaixo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onExportBranch(node.deck.id);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Download size={12} />
                <span>Exportar ramo JSON</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  onDeleteDeckModal(node.deck);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
              >
                <Trash2 size={12} />
                <span>Excluir deck</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filhos recursivos com linha sutil de conexão */}
      {isExpanded && hasChildren && (
        <div className="ml-3 pl-2.5 border-l border-white/[0.07] space-y-0.5 mt-0.5">
          {node.children.map((child, idx) => (
            <DeckTreeNodeItem
              key={child.deck.id}
              node={child}
              allDecks={allDecks}
              siblingsCount={node.children.length}
              siblingIndex={idx}
              selectedDeckId={selectedDeckId}
              expandedIds={expandedIds}
              onSelectDeck={onSelectDeck}
              onToggleExpand={onToggleExpand}
              onCreateDeck={onCreateDeck}
              onEditDeck={onEditDeck}
              onDuplicateDeck={onDuplicateDeck}
              onMoveDeckModal={onMoveDeckModal}
              onDeleteDeckModal={onDeleteDeckModal}
              onStudyBranch={onStudyBranch}
              onExportBranch={onExportBranch}
              onDropDeck={onDropDeck}
              onDropCardsToDeck={onDropCardsToDeck}
              onReorderSibling={onReorderSibling}
              draggingDeckId={draggingDeckId}
              setDraggingDeckId={setDraggingDeckId}
              draggingCardIds={draggingCardIds}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onCloseMobileDrawer={onCloseMobileDrawer}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function DeckTreeSidebar({
  roots,
  allDecks,
  selectedDeckId,
  expandedIds,
  searchQuery,
  searchResults,
  onSearchChange,
  onSelectDeck,
  onSelectSearchResult,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  onCreateDeck,
  onEditDeck,
  onDuplicateDeck,
  onMoveDeckModal,
  onDeleteDeckModal,
  onStudyBranch,
  onExportBranch,
  onOpenImportExport,
  onSeedExamples,
  onDropDeck,
  onDropCardsToDeck,
  onReorderSibling,
  draggingDeckId,
  setDraggingDeckId,
  draggingCardIds,
  onCloseMobileDrawer,
}: DeckTreeSidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="flex flex-col h-full bg-[#12141a] border border-white/[0.06] rounded-xl overflow-hidden"
    >
      {/* Topo da Sidebar */}
      <div className="px-3.5 pt-3.5 pb-3 border-b border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectDeck(null);
              onCloseMobileDrawer?.();
            }}
            className="text-left text-xs font-medium tracking-wide text-slate-200 hover:text-white transition-colors"
          >
            Explorador de Decks
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onCreateDeck(null)}
              title="Novo deck na raiz"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={onExpandAll}
              title="Expandir toda a árvore"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronsUpDown size={13} />
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              title="Recolher árvore"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ChevronsDownUp size={13} />
            </button>
            <button
              type="button"
              onClick={onOpenImportExport}
              title="Importar / Exportar estrutura"
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Upload size={13} />
            </button>
            {onCloseMobileDrawer && (
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                aria-label="Fechar barra lateral"
                className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Busca Global */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar decks, frente ou verso..."
            className="w-full bg-[#0d0f14] border border-white/[0.07] rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-white/20 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar busca global"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Resultados da Busca Global OU Árvore Hierárquica */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {searchQuery.trim() ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Resultados globais</span>
              <span className="tabular-nums">{searchResults.length}</span>
            </div>
            {searchResults.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500 font-light">
                Nenhum deck ou flashcard encontrado.
              </p>
            ) : (
              searchResults.map((res) => (
                <button
                  key={`${res.type}-${res.id}`}
                  type="button"
                  onClick={() => {
                    onSelectSearchResult(res);
                    onCloseMobileDrawer?.();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-white/[0.05] transition-colors space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-slate-200 font-normal truncate">
                      {res.title}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {res.type === 'deck' ? 'Deck' : 'Card'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate font-light">
                    {res.fullPath}
                  </p>
                  {res.subtitle && (
                    <p className="text-[11px] text-slate-400/80 truncate font-light">
                      {res.subtitle}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Área de drop para mover deck para a raiz */}
            {draggingDeckId && (
              <div
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-deck-id')) {
                    e.preventDefault();
                    setRootDropActive(true);
                  }
                }}
                onDragLeave={() => setRootDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRootDropActive(false);
                  const movedId = e.dataTransfer.getData('application/x-deck-id');
                  if (movedId) onDropDeck(movedId, null);
                }}
                className={`mb-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-center text-[11px] transition-colors ${
                  rootDropActive
                    ? 'border-slate-300/60 bg-white/[0.07] text-white'
                    : 'border-white/[0.12] text-slate-400'
                }`}
              >
                Soltar aqui para mover para a raiz
              </div>
            )}

            {roots.length === 0 ? (
              <div className="px-3 py-8 text-center space-y-3">
                <p className="text-xs text-slate-400 font-light">
                  Nenhum deck criado ainda.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onCreateDeck(null)}
                    className="w-full py-1.5 px-3 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-xs text-slate-200 transition-colors"
                  >
                    Criar primeiro deck
                  </button>
                  <button
                    type="button"
                    onClick={onSeedExamples}
                    className="w-full py-1.5 px-3 rounded-md border border-white/[0.08] hover:bg-white/[0.04] text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    <span>Carregar exemplos</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {roots.map((root, idx) => (
                  <DeckTreeNodeItem
                    key={root.deck.id}
                    node={root}
                    allDecks={allDecks}
                    siblingsCount={roots.length}
                    siblingIndex={idx}
                    selectedDeckId={selectedDeckId}
                    expandedIds={expandedIds}
                    onSelectDeck={onSelectDeck}
                    onToggleExpand={onToggleExpand}
                    onCreateDeck={onCreateDeck}
                    onEditDeck={onEditDeck}
                    onDuplicateDeck={onDuplicateDeck}
                    onMoveDeckModal={onMoveDeckModal}
                    onDeleteDeckModal={onDeleteDeckModal}
                    onStudyBranch={onStudyBranch}
                    onExportBranch={onExportBranch}
                    onDropDeck={onDropDeck}
                    onDropCardsToDeck={onDropCardsToDeck}
                    onReorderSibling={onReorderSibling}
                    draggingDeckId={draggingDeckId}
                    setDraggingDeckId={setDraggingDeckId}
                    draggingCardIds={draggingCardIds}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    onCloseMobileDrawer={onCloseMobileDrawer}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Rodapé discreto da sidebar */}
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
        <button
          type="button"
          onClick={() => {
            onSelectDeck(null);
            onCloseMobileDrawer?.();
          }}
          className={`hover:text-slate-200 transition-colors ${
            selectedDeckId === null ? 'text-slate-200 font-medium' : ''
          }`}
        >
          Visão geral
        </button>
        <button
          type="button"
          onClick={onSeedExamples}
          className="hover:text-slate-200 transition-colors"
          title="Adicionar árvore de exemplos Banco do Brasil"
        >
          + Exemplos
        </button>
      </div>
    </aside>
  );
}
