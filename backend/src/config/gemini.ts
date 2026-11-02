import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';

let geminiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (geminiInstance) {
    return geminiInstance;
  }

  if (!env.geminiApiKey) {
    console.warn('[Gemini] WARNING: GEMINI_API_KEY is not configured in environment.');
    return null;
  }

  try {
    geminiInstance = new GoogleGenAI({ apiKey: env.geminiApiKey });
    console.log('[Gemini] Initialized Gemini SDK client.');
    return geminiInstance;
  } catch (error) {
    console.error('[Gemini] Failed to initialize Gemini client:', error);
    return null;
  }
}
