import { NextRequest, NextResponse } from 'next/server';
import {
  createCard,
  createDeck,
  deleteCards,
  deleteDeck,
  duplicateDeckSubtree,
  getTreeSnapshot,
  importTreeStructure,
  moveCards,
  moveDeck,
  recordCardReview,
  reorderDecks,
  seedExampleTree,
  StoreValidationError,
  updateCard,
  updateDeck,
} from '@/lib/flashcardTreeStore';
import { exportSubtreeToJson } from '@/lib/flashcardTreeEngine';

export async function GET(req: NextRequest) {
  try {
    const snapshot = await getTreeSnapshot();
    const exportDeckId = req.nextUrl.searchParams.get('exportDeckId');
    const exportAll = req.nextUrl.searchParams.get('export') === '1';

    if (exportAll || exportDeckId) {
      const payload = exportSubtreeToJson(
        snapshot.decks,
        snapshot.flashcards,
        exportDeckId || null
      );
      return NextResponse.json(payload);
    }

    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar árvore de flashcards';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'createDeck': {
        const res = await createDeck(body);
        return NextResponse.json(res);
      }
      case 'updateDeck': {
        const snapshot = await updateDeck(body);
        return NextResponse.json({ snapshot });
      }
      case 'moveDeck': {
        const snapshot = await moveDeck(body);
        return NextResponse.json({ snapshot });
      }
      case 'reorderDecks': {
        const snapshot = await reorderDecks(body);
        return NextResponse.json({ snapshot });
      }
      case 'duplicateDeck': {
        const res = await duplicateDeckSubtree(body);
        return NextResponse.json(res);
      }
      case 'deleteDeck': {
        const snapshot = await deleteDeck(body);
        return NextResponse.json({ snapshot });
      }
      case 'createCard': {
        const res = await createCard(body);
        return NextResponse.json(res);
      }
      case 'updateCard': {
        const snapshot = await updateCard(body);
        return NextResponse.json({ snapshot });
      }
      case 'moveCards': {
        const snapshot = await moveCards(body);
        return NextResponse.json({ snapshot });
      }
      case 'deleteCards': {
        const snapshot = await deleteCards(body);
        return NextResponse.json({ snapshot });
      }
      case 'recordReview': {
        const snapshot = await recordCardReview(body);
        return NextResponse.json({ snapshot });
      }
      case 'importTree': {
        const snapshot = await importTreeStructure(body);
        return NextResponse.json({ snapshot });
      }
      case 'seedExamples': {
        const snapshot = await seedExampleTree(Boolean(body.reset));
        return NextResponse.json({ snapshot });
      }
      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof StoreValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erro interno no servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
