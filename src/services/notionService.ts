/**
 * Serviço de Integração com o Notion (Portado para Next.js)
 * Responsável por conectar a interface de estudo (Flashcards) ao banco real do Notion.
 */

const NOTION_DATABASE_ID = process.env.NEXT_PUBLIC_NOTION_DATABASE_ID || '332885d5-a0e3-8083-bacb-d7298cedf9fb';
const CONFIG_DATABASE_ID = process.env.NEXT_PUBLIC_CONFIG_DATABASE_ID || '332885d5-a0e3-809f-a459-ea05d36a3c5e';

const BASE_URL = '/api/notion';

// Retorna os headers padrão necessários para a API do Notion
function getHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

// -----------------------------------------------------
// 1. EXTRACTORS
// -----------------------------------------------------

const extractText = (property: any) => {
  if (!property) return '';
  const arr = property.title || property.rich_text || [];
  return arr.map((t: any) => t.plain_text).join('');
};

const extractUrl = (property: any) => {
  if (!property || property.url == null) return '';
  return property.url;
};

const extractFlexible = (property: any) => {
  if (!property) return '';
  if (property.select) return property.select.name || '';
  if (property.multi_select && property.multi_select.length > 0) {
    return property.multi_select[0].name || '';
  }
  if (property.formula) {
    return String(property.formula.string || property.formula.number || '');
  }
  const textArr = property.rich_text || property.title || [];
  if (textArr.length > 0) {
    return textArr.map((t: any) => t.plain_text).join('');
  }
  return '';
};

// -----------------------------------------------------
// 2. PARSER
// -----------------------------------------------------

export function parseNotionCard(page: any) {
  const props = page.properties;
  
  return {
    id: page.id,
    pergunta: extractText(props['Pergunta']),
    resposta: extractText(props['Resposta']),
    referencia: extractUrl(props['Referencia']),
    explicacao: extractText(props['Explicacao']),
    deck: extractFlexible(props['Deck']),
    deckPai: extractFlexible(props['Deck_pai']),
    materia: extractFlexible(props['Materia']),
    topico: extractFlexible(props['Topico']),
    assunto: extractFlexible(props['Assunto']),
    subAssunto: extractFlexible(props['Sub_Assunto']),
    categoria: extractFlexible(props['Categoria']),
    srsLevel: extractFlexible(props['Score']), // Mapping Score to SRS level
    feedback: extractFlexible(props['Feedback']),
    proximaRevisao: props['Proxima_Revisao']?.date?.start || null,
    ultimaRevisao: props['Ultima_Revisao']?.date?.start || null,
  };
}

// -----------------------------------------------------
// 3. API CALLS
// -----------------------------------------------------

export async function fetchFlashcards() {
  try {
    const response = await fetch(`${BASE_URL}/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        page_size: 100,
        sorts: [{ property: 'Proxima_Revisao', direction: 'ascending' }]
      })
    });
    const data = await response.json();
    if (!data.results) return [];
    return data.results.map(parseNotionCard);
  } catch (error) {
    console.error("Erro ao buscar flashcards:", error);
    return [];
  }
}

export async function updateCardSRS(cardId: string, feedback: string) {
  try {
    const response = await fetch(`${BASE_URL}/pages/${cardId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        properties: {
          'Feedback': { select: { name: feedback } },
          'Ultima_Revisao': { date: { start: new Date().toISOString() } }
        }
      })
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao atualizar card:", error);
    throw error;
  }
}

export async function fetchSRSConfig() {
  try {
    const response = await fetch(`${BASE_URL}/databases/${CONFIG_DATABASE_ID}/query`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await response.json();
    if (!data.results) return [];
    
    return data.results.map((page: any) => ({
      id: page.id,
      name: extractText(page.properties['Nivel']),
      color: 'blue', 
      order: parseInt(extractText(page.properties['Carga'])) || 0,
      days: page.properties['Fato de dias']?.number || 0,
    })).sort((a: any, b: any) => a.order - b.order);
  } catch (error) {
    console.error("Erro ao buscar config SRS:", error);
    return [];
  }
}
