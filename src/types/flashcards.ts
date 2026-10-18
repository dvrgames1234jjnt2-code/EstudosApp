export interface Flashcard {
  id: string;
  pergunta: string;
  resposta: string;
  referencia?: string;
  explicacao?: string;
  deck?: string;
  deckPai?: string;
  materia?: string;
  topico?: string;
  assunto?: string;
  subAssunto?: string;
  categoria?: string;
  srsLevel?: string;
  feedback?: string;
  proximaRevisao?: string | null;
  ultimaRevisao?: string | null;
  frente?: string; // Fallback from Notion extractor
  verso?: string;  // Fallback from Notion extractor
}

export interface SRSConfig {
  id: string;
  name: string;
  color: string;
  order: number;
  days: number;
}
