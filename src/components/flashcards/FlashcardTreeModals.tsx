'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  ChevronRight,
  AlertTriangle,
  Download,
  Upload,
  Database,
  Check,
  Copy,
  Layers,
} from 'lucide-react';
import {
  DeckRecord,
  DeckTreeNode,
  FlashcardRecord,
  TreeExportPayload,
} from '@/types/flashcardTree';
import {
  getBreadcrumb,
  isDeckDescendantOrSelf,
} from '@/lib/flashcardTreeEngine';
import Flashcard3D from './Flashcard3D';

/* ─────────────────────────────────────────────────────────────
 * 1. Modal Criar / Editar Deck
 * ───────────────────────────────────────────────────────────── */
interface DeckFormModalProps {
  mode: 'create' | 'edit';
  initialDeck?: DeckRecord | null;
  parentId: string | null;
  allDecks: DeckRecord[];
  onSubmit: (values: { name: string; description: string }) => Promise<void>;
  onClose: () => void;
}

export function DeckFormModal({
  mode,
  initialDeck,
  parentId,
  allDecks,
  onSubmit,
  onClose,
}: DeckFormModalProps) {
  const [name, setName] = useState(mode === 'edit' ? initialDeck?.name ?? '' : '');
  const [description, setDescription] = useState(
    mode === 'edit' ? initialDeck?.description ?? '' : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentTrail = useMemo(
    () => (parentId ? getBreadcrumb(allDecks, parentId) : []),
    [allDecks, parentId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe um nome para o deck.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, description: description.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar deck.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#14171d] border border-white/[0.09] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-100">
              {mode === 'create'
                ? parentId
                  ? 'Novo subdeck'
                  : 'Novo deck na raiz'
                : 'Editar deck'}
            </h2>
            {parentTrail.length > 0 && (
              <p className="text-[11px] text-slate-400 font-light mt-0.5 truncate max-w-[320px]">
                Em: {parentTrail.map((d) => d.name).join(' / ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-normal">
              Nome do deck
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Sistema Financeiro Nacional"
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-white/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-normal">
              Descrição (opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo do conteúdo ou foco de revisão..."
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-light">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Salvando...' : mode === 'create' ? 'Criar deck' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2. Modal Criar / Editar Flashcard
 * ───────────────────────────────────────────────────────────── */
interface CardFormModalProps {
  mode: 'create' | 'edit';
  initialCard?: FlashcardRecord | null;
  defaultDeckId: string;
  allDecks: DeckRecord[];
  nodeMap: Map<string, DeckTreeNode>;
  onSubmit: (values: { front: string; back: string; deck_id: string }) => Promise<void>;
  onClose: () => void;
}

export function CardFormModal({
  mode,
  initialCard,
  defaultDeckId,
  allDecks,
  nodeMap,
  onSubmit,
  onClose,
}: CardFormModalProps) {
  const [front, setFront] = useState(mode === 'edit' ? initialCard?.front ?? '' : '');
  const [back, setBack] = useState(mode === 'edit' ? initialCard?.back ?? '' : '');
  const [deckId, setDeckId] = useState(
    mode === 'edit' ? initialCard?.deck_id ?? defaultDeckId : defaultDeckId
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deckOptions = useMemo(() => {
    return allDecks
      .map((d) => ({
        id: d.id,
        path: nodeMap.get(d.id)?.fullPath ?? d.name,
      }))
      .sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));
  }, [allDecks, nodeMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError('Preencha a frente e o verso do flashcard.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        front: front.trim(),
        back: back.trim(),
        deck_id: deckId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar flashcard.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#14171d] border border-white/[0.09] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-100">
            {mode === 'create' ? 'Novo flashcard' : 'Editar flashcard'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-normal">
              Deck de destino
            </label>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-white/25"
            >
              {deckOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.path}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-normal">
              Frente (pergunta)
            </label>
            <textarea
              rows={3}
              autoFocus
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Digite a pergunta ou conceito..."
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-white/25 resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-normal">
              Verso (resposta)
            </label>
            <textarea
              rows={4}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Digite a resposta objetiva..."
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-white/25 resize-y"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-light">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {submitting
                ? 'Salvando...'
                : mode === 'create'
                ? 'Adicionar card'
                : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3. Modal Seletor Recursivo (Mover Deck ou Mover Cards)
 * ───────────────────────────────────────────────────────────── */
interface RecursivePickerModalProps {
  mode: 'move-deck' | 'move-cards';
  title: string;
  subtitle: string;
  roots: DeckTreeNode[];
  allDecks: DeckRecord[];
  movingDeckId?: string;
  initialTargetId?: string | null;
  onConfirm: (targetDeckId: string | null) => Promise<void>;
  onClose: () => void;
}

export function RecursivePickerModal({
  mode,
  title,
  subtitle,
  roots,
  allDecks,
  movingDeckId,
  initialTargetId = null,
  onConfirm,
  onClose,
}: RecursivePickerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialTargetId);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(allDecks.map((d) => d.id))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: DeckTreeNode) => {
    const isInvalidForDeck =
      mode === 'move-deck' &&
      !!movingDeckId &&
      isDeckDescendantOrSelf(allDecks, node.deck.id, movingDeckId);

    const isExp = expanded.has(node.deck.id);
    const hasChildren = node.children.length > 0;
    const isChosen = selectedId === node.deck.id;

    return (
      <div key={node.deck.id} className="select-none">
        <div
          onClick={() => {
            if (!isInvalidForDeck) setSelectedId(node.deck.id);
          }}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
            isInvalidForDeck
              ? 'opacity-40 cursor-not-allowed text-slate-500'
              : isChosen
              ? 'bg-white/[0.11] text-white cursor-pointer'
              : 'text-slate-300 hover:bg-white/[0.05] cursor-pointer'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggle(node.deck.id);
            }}
            className={`w-4 h-4 flex items-center justify-center text-slate-500 ${
              hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${isExp ? 'rotate-90' : ''}`}
            />
          </button>

          {isExp && hasChildren ? (
            <FolderOpen size={13} className="text-slate-400 shrink-0" />
          ) : (
            <Folder size={13} className="text-slate-400 shrink-0" />
          )}

          <span className="flex-1 truncate font-light">{node.deck.name}</span>

          {isInvalidForDeck ? (
            <span className="text-[10px] text-rose-400/90 shrink-0">
              Mesmo ramo
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
              {node.stats.totalCardsCount}
            </span>
          )}
        </div>

        {isExp && hasChildren && (
          <div className="ml-3 pl-2.5 border-l border-white/[0.07] space-y-0.5 mt-0.5">
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  const canConfirm = mode === 'move-deck' ? true : selectedId !== null;

  const handleConfirm = async () => {
    if (!canConfirm) {
      setError('Selecione um deck de destino.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#14171d] border border-white/[0.09] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-slate-100 truncate">{title}</h2>
            <p className="text-[11px] text-slate-400 font-light truncate mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-1">
          {mode === 'move-deck' && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-left transition-colors ${
                selectedId === null
                  ? 'bg-white/[0.11] text-white'
                  : 'text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              <Layers size={13} className="text-slate-400 shrink-0" />
              <span className="font-normal">Raiz (nível principal)</span>
            </button>
          )}

          <div className="space-y-0.5">{roots.map(renderNode)}</div>
        </div>

        {error && (
          <p className="px-5 pb-2 text-xs text-rose-400 font-light">{error}</p>
        )}

        <div className="px-5 py-3.5 border-t border-white/[0.07] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm || submitting}
            onClick={() => void handleConfirm()}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Movendo...' : 'Mover para destino'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4. Modal Excluir Deck (tratando descendentes com segurança)
 * ───────────────────────────────────────────────────────────── */
interface DeleteDeckModalProps {
  node: DeckTreeNode;
  onConfirm: (mode: 'cascade' | 'promote_children') => Promise<void>;
  onClose: () => void;
}

export function DeleteDeckModal({
  node,
  onConfirm,
  onClose,
}: DeleteDeckModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSubdecks = node.stats.totalSubdecksCount > 0;
  const hasCards = node.stats.totalCardsCount > 0;
  const isRootWithOwnCards =
    node.deck.parent_id === null && node.stats.ownCardsCount > 0;

  const runDelete = async (mode: 'cascade' | 'promote_children') => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(mode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir deck.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#14171d] border border-white/[0.09] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle size={15} />
            <h2 className="text-sm font-medium text-slate-100">Excluir deck</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-200 font-normal">
              {node.deck.name}
            </p>
            <p className="text-xs text-slate-400 font-light">
              {hasSubdecks || hasCards
                ? `Este deck contém ${node.stats.ownCardsCount} cards próprios, ${node.stats.totalSubdecksCount} subdecks e ${node.stats.descendantCardsCount} cards descendentes.`
                : 'Este deck está vazio e será removido permanentemente.'}
            </p>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-light">{error}</p>
          )}

          <div className="space-y-2 pt-1">
            {(hasSubdecks || hasCards) && (
              <button
                type="button"
                disabled={submitting || isRootWithOwnCards}
                onClick={() => void runDelete('promote_children')}
                className="w-full text-left px-3.5 py-2.5 rounded-lg border border-white/[0.09] bg-[#0e1015] hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
              >
                <div className="text-xs font-medium text-slate-100">
                  Manter descendentes (promover para o nível pai)
                </div>
                <div className="text-[11px] text-slate-400 font-light mt-0.5">
                  {isRootWithOwnCards
                    ? 'Indisponível porque este deck está na raiz e possui cards próprios sem deck pai.'
                    : node.deck.parent_id
                    ? 'Move subdecks e cards próprios diretamente para o deck pai.'
                    : 'Promove todos os subdecks filhos para a raiz.'}
                </div>
              </button>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void runDelete('cascade')}
              className="w-full text-left px-3.5 py-2.5 rounded-lg border border-rose-500/30 bg-rose-950/25 hover:bg-rose-950/45 disabled:opacity-40 transition-colors"
            >
              <div className="text-xs font-medium text-rose-300">
                {hasSubdecks || hasCards
                  ? `Excluir tudo (${node.stats.totalSubdecksCount} subdecks e ${node.stats.totalCardsCount} cards)`
                  : 'Confirmar exclusão do deck'}
              </div>
              <div className="text-[11px] text-rose-300/70 font-light mt-0.5">
                Remove permanentemente este deck e todo o conteúdo vinculado.
              </div>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 5. Modal Preview 3D rápido de um Card
 * ───────────────────────────────────────────────────────────── */
interface CardQuickPreviewModalProps {
  card: FlashcardRecord;
  deckPath: string;
  onClose: () => void;
}

export function CardQuickPreviewModal({
  card,
  deckPath,
  onClose,
}: CardQuickPreviewModalProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-400 font-light truncate">{deckPath}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar pré-visualização"
            className="w-8 h-8 rounded-lg bg-[#14171d] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <Flashcard3D
          front={card.front}
          back={card.back}
          flipped={flipped}
          onFlip={setFlipped}
          frontLabel="Pergunta"
          backLabel="Resposta"
          hint="Toque no cartão para girar em 3D"
          className="h-[340px] sm:h-[380px]"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 6. Modal Importar / Exportar & Banco SQL
 * ───────────────────────────────────────────────────────────── */
interface ImportExportModalProps {
  selectedDeckId: string | null;
  allDecks: DeckRecord[];
  nodeMap: Map<string, DeckTreeNode>;
  storageBackend: 'supabase' | 'local-file';
  onExportJson: (rootDeckId: string | null) => Promise<void>;
  onImportJson: (payload: TreeExportPayload, targetParentId: string | null) => Promise<void>;
  onClose: () => void;
}

const SQL_MIGRATION_HINT = `-- Execute no SQL Editor do Supabase usando o arquivo setup_flashcards_hierarquia.sql na raiz do projeto:
-- Cria tabelas: public.decks (parent_id recursivo), public.flashcards, public.card_reviews
-- Inclui índices, triggers de proteção contra ciclos e função get_deck_descendants(UUID).`;

export function ImportExportModal({
  selectedDeckId,
  allDecks,
  nodeMap,
  storageBackend,
  onExportJson,
  onImportJson,
  onClose,
}: ImportExportModalProps) {
  const [targetParentId, setTargetParentId] = useState<string | null>(selectedDeckId);
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const deckOptions = useMemo(() => {
    return allDecks
      .map((d) => ({
        id: d.id,
        path: nodeMap.get(d.id)?.fullPath ?? d.name,
      }))
      .sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));
  }, [allDecks, nodeMap]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonText(reader.result);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError('Cole um JSON exportado ou selecione um arquivo .json.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonText) as TreeExportPayload;
      if (!parsed || !Array.isArray(parsed.decks)) {
        throw new Error('JSON inválido: é esperado o formato { decks: [...] }.');
      }
      await onImportJson(parsed, targetParentId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar estrutura.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[#14171d] border border-white/[0.09] shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-slate-100">
            Importar, Exportar & Persistência
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar space-y-5">
          {/* Exportar */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-slate-200">
              Exportar estrutura JSON
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onExportJson(null)}
                className="px-3.5 py-2 rounded-lg border border-white/[0.09] bg-[#0e1015] hover:bg-white/[0.05] text-xs text-slate-200 flex items-center gap-2 transition-colors"
              >
                <Download size={13} />
                <span>Exportar árvore completa</span>
              </button>
              {selectedDeckId && (
                <button
                  type="button"
                  onClick={() => void onExportJson(selectedDeckId)}
                  className="px-3.5 py-2 rounded-lg border border-white/[0.09] bg-[#0e1015] hover:bg-white/[0.05] text-xs text-slate-200 flex items-center gap-2 transition-colors"
                >
                  <Download size={13} />
                  <span>Exportar deck selecionado</span>
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Importar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-slate-200">
                Importar árvore JSON
              </h3>
              <label className="cursor-pointer text-[11px] text-slate-300 hover:text-white underline underline-offset-2">
                Selecionar arquivo .json
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400">
                Inserir dentro de
              </label>
              <select
                value={targetParentId ?? ''}
                onChange={(e) => setTargetParentId(e.target.value || null)}
                className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-white/25"
              >
                <option value="">Raiz (nível principal)</option>
                {deckOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.path}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={5}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='Cole o JSON exportado aqui: { "version": 1, "decks": [...] }'
              className="w-full bg-[#0e1015] border border-white/[0.09] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/25"
            />

            {error && (
              <p className="text-xs text-rose-400 font-light">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleImport()}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <Upload size={13} />
                <span>{submitting ? 'Importando...' : 'Importar estrutura'}</span>
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Info esquema SQL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Database size={13} className="text-slate-400" />
                <span>
                  Armazenamento ativo:{' '}
                  {storageBackend === 'supabase'
                    ? 'Supabase PostgreSQL'
                    : 'Persistência local (JSON)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(SQL_MIGRATION_HINT);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 1800);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {copiedSql ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedSql ? 'Copiado' : 'Copiar nota SQL'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-light leading-relaxed">
              O esquema relacional completo com <code className="text-slate-400">decks</code>,{' '}
              <code className="text-slate-400">flashcards</code> e{' '}
              <code className="text-slate-400">card_reviews</code> está pronto em{' '}
              <code className="text-slate-400">setup_flashcards_hierarquia.sql</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
