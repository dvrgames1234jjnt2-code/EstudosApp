import {
  CardReviewRecord,
  DeckRecord,
  DeckStats,
  DeckTreeNode,
  FlashcardRecord,
  SearchResultItem,
  TreeExportDeckNode,
  TreeExportPayload,
} from '@/types/flashcardTree';

export interface BuiltTreeResult {
  roots: DeckTreeNode[];
  nodeMap: Map<string, DeckTreeNode>;
  deckMap: Map<string, DeckRecord>;
  reviewByCardId: Map<string, CardReviewRecord>;
  globalStats: {
    totalDecks: number;
    totalCards: number;
    masteredCards: number;
    lastActivityAt: string | null;
  };
}

/**
 * Ordena decks irmãos por `position` ascendente, depois `created_at` e `name`.
 */
export function sortDecks(decks: DeckRecord[]): DeckRecord[] {
  return [...decks].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const tA = Date.parse(a.created_at) || 0;
    const tB = Date.parse(b.created_at) || 0;
    if (tA !== tB) return tA - tB;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Verifica se `candidateParentId` é o próprio `movingDeckId` ou qualquer descendente dele.
 * Essencial para evitar ciclos na árvore (ex.: mover pai para dentro de filho/neto).
 */
export function isDeckDescendantOrSelf(
  decks: DeckRecord[],
  candidateParentId: string | null,
  movingDeckId: string
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === movingDeckId) return true;

  const byId = new Map<string, DeckRecord>();
  for (const d of decks) byId.set(d.id, d);

  const visited = new Set<string>();
  let cursor: string | null = candidateParentId;

  while (cursor) {
    if (cursor === movingDeckId) return true;
    if (visited.has(cursor)) return true; // ciclo pré-existente protegido
    visited.add(cursor);
    cursor = byId.get(cursor)?.parent_id ?? null;
  }

  return false;
}

/**
 * Coleta recursivamente todos os IDs da subárvore iniciada em `rootDeckId` (incluindo `rootDeckId`).
 */
export function collectSubtreeDeckIds(decks: DeckRecord[], rootDeckId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const deck of decks) {
    if (deck.parent_id) {
      const list = childrenByParent.get(deck.parent_id) ?? [];
      list.push(deck.id);
      childrenByParent.set(deck.parent_id, list);
    }
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [rootDeckId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    const children = childrenByParent.get(id) ?? [];
    for (const childId of children) {
      stack.push(childId);
    }
  }

  return result;
}

/**
 * Retorna o caminho hierárquico clicável (raiz -> deck atual).
 */
export function getBreadcrumb(decks: DeckRecord[], deckId: string | null): DeckRecord[] {
  if (!deckId) return [];
  const byId = new Map<string, DeckRecord>();
  for (const d of decks) byId.set(d.id, d);

  const trail: DeckRecord[] = [];
  const visited = new Set<string>();
  let cursor: string | null = deckId;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const current = byId.get(cursor);
    if (!current) break;
    trail.unshift(current);
    cursor = current.parent_id;
  }

  return trail;
}

function maxTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Constrói a árvore recursiva completa com estatísticas próprias e consolidadas de descendentes.
 */
export function buildDeckTree(
  decks: DeckRecord[],
  flashcards: FlashcardRecord[],
  reviews: CardReviewRecord[]
): BuiltTreeResult {
  const sortedDecks = sortDecks(decks);
  const deckMap = new Map<string, DeckRecord>();
  for (const d of sortedDecks) deckMap.set(d.id, d);

  const reviewByCardId = new Map<string, CardReviewRecord>();
  for (const r of reviews) {
    const existing = reviewByCardId.get(r.card_id);
    if (!existing || Date.parse(r.reviewed_at) >= Date.parse(existing.reviewed_at)) {
      reviewByCardId.set(r.card_id, r);
    }
  }

  const cardsByDeckId = new Map<string, FlashcardRecord[]>();
  for (const c of flashcards) {
    const list = cardsByDeckId.get(c.deck_id) ?? [];
    list.push(c);
    cardsByDeckId.set(c.deck_id, list);
  }

  const childrenByParentId = new Map<string | null, DeckRecord[]>();
  for (const d of sortedDecks) {
    const parentKey = d.parent_id && deckMap.has(d.parent_id) ? d.parent_id : null;
    const list = childrenByParentId.get(parentKey) ?? [];
    list.push(d);
    childrenByParentId.set(parentKey, list);
  }

  const nodeMap = new Map<string, DeckTreeNode>();

  function buildNode(
    deck: DeckRecord,
    depth: number,
    ancestors: DeckRecord[],
    visited: Set<string>
  ): DeckTreeNode {
    const breadcrumb = [...ancestors, deck];
    const fullPath = breadcrumb.map(b => b.name).join(' / ');
    const nextVisited = new Set(visited);
    nextVisited.add(deck.id);

    const rawChildren = (childrenByParentId.get(deck.id) ?? []).filter(
      child => !nextVisited.has(child.id)
    );
    const children = rawChildren.map(child =>
      buildNode(child, depth + 1, breadcrumb, nextVisited)
    );

    const ownCards = cardsByDeckId.get(deck.id) ?? [];
    let ownMastered = 0;
    let ownLearning = 0;
    let lastActivityAt: string | null = deck.updated_at || deck.created_at || null;

    for (const card of ownCards) {
      lastActivityAt = maxTimestamp(lastActivityAt, card.updated_at || card.created_at);
      const rev = reviewByCardId.get(card.id);
      if (rev) {
        lastActivityAt = maxTimestamp(lastActivityAt, rev.reviewed_at);
        if (rev.review_status === 'mastered') ownMastered += 1;
        else if (rev.review_status === 'learning' || rev.review_status === 'reviewing') {
          ownLearning += 1;
        }
      }
    }

    let descendantCardsCount = 0;
    let totalSubdecksCount = children.length;
    let masteredCount = ownMastered;
    let learningCount = ownLearning;

    for (const child of children) {
      descendantCardsCount += child.stats.totalCardsCount;
      totalSubdecksCount += child.stats.totalSubdecksCount;
      masteredCount += child.stats.masteredCount;
      learningCount += child.stats.learningCount;
      lastActivityAt = maxTimestamp(lastActivityAt, child.stats.lastActivityAt);
    }

    const stats: DeckStats = {
      ownCardsCount: ownCards.length,
      descendantCardsCount,
      totalCardsCount: ownCards.length + descendantCardsCount,
      directSubdecksCount: children.length,
      totalSubdecksCount,
      masteredCount,
      learningCount,
      lastActivityAt,
    };

    const node: DeckTreeNode = {
      deck,
      depth,
      children,
      stats,
      breadcrumb,
      fullPath,
    };

    nodeMap.set(deck.id, node);
    return node;
  }

  const rootDecks = childrenByParentId.get(null) ?? [];
  const roots = rootDecks.map(d => buildNode(d, 0, [], new Set()));

  let globalMastered = 0;
  let globalLast: string | null = null;
  for (const r of roots) {
    globalMastered += r.stats.masteredCount;
    globalLast = maxTimestamp(globalLast, r.stats.lastActivityAt);
  }

  return {
    roots,
    nodeMap,
    deckMap,
    reviewByCardId,
    globalStats: {
      totalDecks: sortedDecks.length,
      totalCards: flashcards.length,
      masteredCards: globalMastered,
      lastActivityAt: globalLast,
    },
  };
}

/**
 * Pesquisa global ou contextual (filtrada por subárvore quando `scopeDeckId` é informado).
 * Localiza decks, subdecks, conteúdo da frente e conteúdo do verso com caminho completo.
 */
export function searchTree(
  query: string,
  decks: DeckRecord[],
  flashcards: FlashcardRecord[],
  nodeMap: Map<string, DeckTreeNode>,
  scopeDeckId?: string | null
): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const allowedDeckIds = scopeDeckId
    ? new Set(collectSubtreeDeckIds(decks, scopeDeckId))
    : null;

  const results: SearchResultItem[] = [];

  for (const deck of sortDecks(decks)) {
    if (allowedDeckIds && !allowedDeckIds.has(deck.id)) continue;
    const node = nodeMap.get(deck.id);
    if (!node) continue;

    const matchedFields: string[] = [];
    if (deck.name.toLowerCase().includes(q)) matchedFields.push('Nome do deck');
    if (deck.description.toLowerCase().includes(q)) matchedFields.push('Descrição');

    if (matchedFields.length > 0) {
      results.push({
        type: 'deck',
        id: deck.id,
        deckId: deck.id,
        title: deck.name,
        subtitle: deck.description || `${node.stats.totalCardsCount} cards no ramo`,
        fullPath: node.fullPath,
        breadcrumb: node.breadcrumb,
        matchedFields,
      });
    }
  }

  for (const card of flashcards) {
    if (allowedDeckIds && !allowedDeckIds.has(card.deck_id)) continue;
    const node = nodeMap.get(card.deck_id);
    if (!node) continue;

    const matchedFields: string[] = [];
    if (card.front.toLowerCase().includes(q)) matchedFields.push('Frente');
    if (card.back.toLowerCase().includes(q)) matchedFields.push('Verso');

    if (matchedFields.length > 0) {
      results.push({
        type: 'card',
        id: card.id,
        deckId: card.deck_id,
        title: card.front,
        subtitle: card.back,
        fullPath: node.fullPath,
        breadcrumb: node.breadcrumb,
        matchedFields,
      });
    }
  }

  return results;
}

/**
 * Serializa a árvore inteira ou uma subárvore para exportação JSON estruturada.
 */
export function exportSubtreeToJson(
  decks: DeckRecord[],
  flashcards: FlashcardRecord[],
  rootDeckId?: string | null
): TreeExportPayload {
  const tree = buildDeckTree(decks, flashcards, []);
  const cardsByDeck = new Map<string, FlashcardRecord[]>();
  for (const c of flashcards) {
    const arr = cardsByDeck.get(c.deck_id) ?? [];
    arr.push(c);
    cardsByDeck.set(c.deck_id, arr);
  }

  function serializeNode(node: DeckTreeNode): TreeExportDeckNode {
    const cards = (cardsByDeck.get(node.deck.id) ?? []).map(c => ({
      front: c.front,
      back: c.back,
    }));
    return {
      name: node.deck.name,
      description: node.deck.description,
      position: node.deck.position,
      cards,
      children: node.children.map(serializeNode),
    };
  }

  let targetNodes: DeckTreeNode[] = tree.roots;
  if (rootDeckId) {
    const found = tree.nodeMap.get(rootDeckId);
    targetNodes = found ? [found] : [];
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    decks: targetNodes.map(serializeNode),
  };
}

/**
 * Gera a estrutura de exemplo completa de Concurso Banco do Brasil com múltiplos níveis e cards de estudo.
 */
export function createBancoBrasilExampleSeed(
  generateId: () => string
): { decks: DeckRecord[]; flashcards: FlashcardRecord[] } {
  const now = new Date().toISOString();
  const decks: DeckRecord[] = [];
  const flashcards: FlashcardRecord[] = [];

  interface SeedNode {
    name: string;
    description?: string;
    cards?: { front: string; back: string }[];
    children?: SeedNode[];
  }

  const seedTree: SeedNode[] = [
    {
      name: 'CONCURSO BANCO DO BRASIL',
      description: 'Estrutura completa de revisão com níveis hierárquicos ilimitados',
      cards: [
        {
          front: 'Qual é a natureza jurídica do Banco do Brasil S.A.?',
          back: 'Sociedade de economia mista, integrante da Administração Pública Indireta, com controle acionário da União e ações negociadas em bolsa.',
        },
      ],
      children: [
        {
          name: 'Conhecimentos Bancários',
          description: 'SFN, produtos financeiros e prevenção à lavagem de dinheiro',
          cards: [
            {
              front: 'Como se divide estruturalmente o Sistema Financeiro Nacional (SFN)?',
              back: 'Em órgãos normativos (CMN, CNSP, CNPC), entidades supervisoras (BACEN, CVM, SUSEP, PREVIC) e operadores (bancos, corretoras, seguradoras, etc.).',
            },
          ],
          children: [
            {
              name: 'Sistema Financeiro Nacional',
              description: 'Órgãos normativos, supervisores e executores',
              children: [
                {
                  name: 'CMN',
                  description: 'Conselho Monetário Nacional — órgão máximo normativo',
                  cards: [
                    {
                      front: 'O Conselho Monetário Nacional (CMN) executa operações bancárias ou fiscaliza bancos?',
                      back: 'Não. O CMN é um órgão exclusivamente normativo e deliberativo; a execução e fiscalização cabem ao Banco Central (BACEN) e à CVM.',
                    },
                  ],
                  children: [
                    {
                      name: 'Competências',
                      description: 'Atribuições legais do CMN',
                      cards: [
                        {
                          front: 'Quem define a meta para a inflação no Brasil e quem a persegue?',
                          back: 'O CMN define a meta de inflação (junto ao intervalo de tolerância), e o Banco Central (via COPOM/Selic) executa a política monetária para cumpri-la.',
                        },
                        {
                          front: 'Cite 3 competências centrais do CMN.',
                          back: '1) Adaptar o volume dos meios de pagamento; 2) Regular o valor interno e externo da moeda; 3) Disciplinar o crédito e normatizar as instituições financeiras.',
                        },
                      ],
                    },
                    {
                      name: 'Composição',
                      description: 'Membros atuais do Conselho Monetário Nacional',
                      cards: [
                        {
                          front: 'Quem compõe atualmente o Conselho Monetário Nacional (CMN)?',
                          back: 'Três membros: Ministro da Fazenda (Presidente do Conselho), Ministro do Planejamento e Orçamento, e Presidente do Banco Central do Brasil.',
                        },
                      ],
                    },
                  ],
                },
                {
                  name: 'Banco Central',
                  description: 'Autoridade monetária e supervisora prudencial',
                  cards: [
                    {
                      front: 'Quais são os 3 instrumentos clássicos de política monetária do BACEN?',
                      back: '1) Recolhimento compulsório; 2) Operações de redesconto (empréstimos de liquidez); 3) Operações de mercado aberto (Open Market — compra e venda de títulos públicos).',
                    },
                    {
                      front: 'Para conter a inflação (política monetária contracionista), o que o BACEN faz com a taxa Selic e o compulsório?',
                      back: 'Eleva a taxa básica de juros (Selic) e aumenta a alíquota do depósito compulsório, reduzindo a liquidez e a demanda agregada.',
                    },
                  ],
                },
                {
                  name: 'CVM',
                  description: 'Comissão de Valores Mobiliários',
                  cards: [
                    {
                      front: 'Qual é o foco principal de fiscalização da Comissão de Valores Mobiliários (CVM)?',
                      back: 'O mercado de capitais e valores mobiliários (ações, debêntures, fundos de investimento, derivativos e companhias abertas).',
                    },
                  ],
                },
              ],
            },
            {
              name: 'Produtos Bancários',
              description: 'Operações ativas de crédito e captação/investimentos',
              children: [
                {
                  name: 'Crédito',
                  description: 'Modalidades de crédito e garantias',
                  cards: [
                    {
                      front: 'Qual a diferença jurídica entre Aval e Fiança em garantias pessoais?',
                      back: 'O aval é garantia típica de títulos de crédito (autônoma, solidária e formal); a fiança decorre de contrato acessório e admite benefício de ordem (se não renunciado).',
                    },
                    {
                      front: 'Na alienação fiduciária de imóvel, com quem fica a propriedade resolúvel até a quitação?',
                      back: 'Com o credor fiduciário (banco), enquanto o devedor fiduciante permanece com a posse direta do bem.',
                    },
                  ],
                },
                {
                  name: 'Investimentos',
                  description: 'Renda fixa, títulos bancários e tributação',
                  cards: [
                    {
                      front: 'Quais títulos de captação imobiliária e do agronegócio possuem isenção de IR para Pessoa Física?',
                      back: 'LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio), além de contarem com cobertura do FGC dentro do limite regulamentar.',
                    },
                    {
                      front: 'Qual é o limite padrão de cobertura do FGC por CPF/CNPJ e instituição financeira?',
                      back: 'Até R$ 250.000,00 por CPF/CNPJ por instituição ou conglomerado financeiro, observado o teto global de R$ 1 milhão a cada 4 anos.',
                    },
                  ],
                },
              ],
            },
            {
              name: 'Lavagem de Dinheiro',
              description: 'Lei nº 9.613/1998 e Circular BACEN nº 3.978/2020',
              children: [
                {
                  name: 'Conceitos',
                  description: 'Definição do crime e papel do COAF',
                  cards: [
                    {
                      front: 'O que caracteriza o crime de lavagem de dinheiro segundo a Lei nº 9.613/1998?',
                      back: 'Ocultar ou dissimular a natureza, origem, localização, disposição, movimentação ou propriedade de bens, direitos ou valores provenientes de infração penal.',
                    },
                  ],
                },
                {
                  name: 'Fases',
                  description: 'Etapas clássicas do processo de lavagem',
                  cards: [
                    {
                      front: 'Quais são as 3 fases da lavagem de dinheiro (modelo COI)?',
                      back: '1) Colocação (Placement): inserção no sistema financeiro; 2) Ocultação/Estratificação (Layering): quebra de rastreio em múltiplas transações; 3) Integração (Integration): retorno à economia com aparência lícita.',
                    },
                  ],
                },
                {
                  name: 'Legislação',
                  description: 'Obrigações de compliance e prazos de guarda',
                  cards: [
                    {
                      front: 'Qual é o prazo máximo para comunicar operações suspeitas ao COAF e o prazo de guarda cadastral na Circular BACEN 3.978/20?',
                      back: 'Comunicação ao COAF até o dia útil seguinte à decisão (24h após análise conclusiva); guarda de registros e cadastros por no mínimo 10 anos.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: 'Matemática',
          description: 'Fundamentos aritméticos e matemática financeira aplicada',
          children: [
            {
              name: 'Matemática Básica',
              description: 'Porcentagem, razão, proporção e conjuntos',
              cards: [
                {
                  front: 'Dois descontos sucessivos de 20% equivalem a um desconto único de quanto?',
                  back: '36% — pois (1 − 0,20) × (1 − 0,20) = 0,80 × 0,80 = 0,64, ou seja, redução total de 1 − 0,64 = 0,36 (36%).',
                },
              ],
            },
            {
              name: 'Matemática Financeira',
              description: 'Regimes de capitalização e sistemas de amortização',
              cards: [
                {
                  front: 'Qual é a principal diferença entre o sistema SAC e a Tabela Price (Sistema Francês)?',
                  back: 'No SAC a amortização é constante e as prestações são decrescentes; na Tabela Price a prestação é constante, com juros decrescentes e amortização crescente.',
                },
                {
                  front: 'Como converter uma taxa nominal anual de 24% a.a. capitalizada mensalmente em taxa efetiva mensal?',
                  back: 'Divide-se proporcionalmente pelo número de períodos de capitalização no ano: 24% / 12 = 2% ao mês (taxa efetiva mensal).',
                },
              ],
            },
          ],
        },
        {
          name: 'Português',
          description: 'Gramática aplicada a textos e interpretação',
          children: [
            {
              name: 'Morfologia',
              description: 'Classes gramaticais e pronomes',
              cards: [
                {
                  front: 'Quando o pronome relativo "cujo" deve ser utilizado e por que não admite artigo depois dele?',
                  back: '"Cujo" indica posse entre dois substantivos (antecedente possuidor e consequente possuído) e já traz valor determinativo, sendo incorreto escrever "cujo o" ou "cujo a".',
                },
              ],
            },
            {
              name: 'Sintaxe',
              description: 'Regência, crase e pontuação',
              cards: [
                {
                  front: 'Qual a diferença de regência do verbo "assistir" nos sentidos de "ver/presenciar" e "ajudar/prestar assistência"?',
                  back: 'No sentido de ver/presenciar é VTI com preposição "a" (assistir ao filme); no sentido de ajudar/socorrer é VTD (assistir o paciente).',
                },
              ],
            },
            {
              name: 'Ortografia',
              description: 'Porquês, acentuação e emprego do hífen',
              cards: [
                {
                  front: 'Quando se usa "por quê" (separado e com acento)?',
                  back: 'Em final de frase ou isolado antes de pontuação (ex.: "Não veio por quê?"), pois o "que" torna-se tônico em posição final.',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  function walk(node: SeedNode, parentId: string | null, position: number) {
    const deckId = generateId();
    decks.push({
      id: deckId,
      name: node.name,
      parent_id: parentId,
      description: node.description ?? '',
      position,
      created_at: now,
      updated_at: now,
    });

    if (node.cards) {
      for (const c of node.cards) {
        flashcards.push({
          id: generateId(),
          deck_id: deckId,
          front: c.front,
          back: c.back,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (node.children) {
      node.children.forEach((child, idx) => walk(child, deckId, idx));
    }
  }

  seedTree.forEach((root, idx) => walk(root, null, idx));

  return { decks, flashcards };
}
