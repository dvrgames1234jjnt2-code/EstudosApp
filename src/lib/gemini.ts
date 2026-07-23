import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export { GoogleGenAI };
export const genAI = new GoogleGenAI({ apiKey });
