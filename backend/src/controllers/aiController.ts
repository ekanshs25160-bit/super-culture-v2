import { Request, Response } from 'express';
import { z } from 'zod';
import { getGeminiClient } from '../config/gemini.js';
import { memoriService } from '../services/memoriService.js';
import { aiBudgetService } from '../services/aiBudgetService.js';
import { AIDJRecommendation } from '../types/index.js';

export const vibeSchema = z.object({
  mood: z.string().trim().max(100, 'Mood must be at most 100 characters').optional().default('Any'),
  genre: z.string().trim().max(100, 'Genre must be at most 100 characters').optional().default('Any'),
  language: z.string().trim().max(100, 'Language must be at most 100 characters').optional().default('Any'),
  referenceSongs: z.string().trim().max(200, 'Reference songs must be at most 200 characters').optional().default('Modern trending tracks'),
});

export const logHistorySchema = z.object({
  song: z.object({
    videoId: z.string().max(100).optional(),
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    artist: z.string().trim().max(200).optional().default('Unknown Artist'),
    album: z.string().trim().max(200).optional(),
    duration: z.number().int().nonnegative().max(86400).optional(),
    thumbnailUrl: z.string().max(1000).optional(),
    cover: z.string().max(1000).optional(),
  }),
});

export class AIController {
  /**
   * Magic Vibe playlist generator
   * POST /api/ai/vibe
   */
  public async generateVibe(req: Request, res: Response): Promise<void> {
    try {
      const parsed = vibeSchema.safeParse(req.body || {});
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid vibe request parameters',
          details: parsed.error.flatten(),
        });
        return;
      }

      // Check and consume daily AI call budget
      const budget = aiBudgetService.consumeBudget();
      if (!budget.allowed) {
        res.status(429).json({
          error: 'Daily AI call budget exceeded',
          limit: budget.status.limit,
          current: budget.status.count,
        });
        return;
      }

      const { mood, genre, language, referenceSongs } = parsed.data;
      const gemini = getGeminiClient();

      if (!gemini) {
        // Fallback response if GEMINI_API_KEY is not configured
        res.json([
          { title: 'Starboy', artist: 'The Weeknd', reason: 'Modern nocturnal pop benchmark' },
          { title: 'Blinding Lights', artist: 'The Weeknd', reason: 'High-energy 80s synth pulse' },
          { title: 'As It Was', artist: 'Harry Styles', reason: 'Breezy indie pop vibe' },
        ]);
        return;
      }

      // Cap prompt inputs to prevent prompt injection and token bloat
      const safeMood = mood.slice(0, 100);
      const safeGenre = genre.slice(0, 100);
      const safeLanguage = language.slice(0, 100);
      const safeReference = referenceSongs.slice(0, 200);

      const prompt = `Act as an avant-garde AI DJ and music tastemaker for an editorial music publication.
Create a highly curated, personalized "vibe" tracklist based on these criteria:
- Target Mood: ${safeMood}
- Target Genre: ${safeGenre}
- Preferred Language: ${safeLanguage}
- Aesthetic Reference: ${safeReference}

Return EXACTLY 15 songs.
Respond ONLY with a valid JSON array of objects:
[ { "title": "Song Title", "artist": "Artist Name", "reason": "Short vibe aesthetic rationale" } ]`.slice(0, 2000);

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      });

      const responseText = response.text || '[]';
      const recommendations: AIDJRecommendation[] = JSON.parse(responseText);
      res.json(recommendations);
    } catch (error: any) {
      console.error('[AIController] generateVibe error:', error.message || 'Unknown error');
      res.status(500).json({ error: 'Failed to generate vibe playlist', details: error.message });
    }
  }

  /**
   * Log playback history and record taste memory via Memori
   * POST /api/ai/log-history
   */
  public async logHistory(req: Request, res: Response): Promise<void> {
    try {
      const parsed = logHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Valid song object required with non-empty title',
          details: parsed.error.flatten(),
        });
        return;
      }

      const guestId = (req.headers['x-guest-id'] as string) || 'default-guest';
      const { song } = parsed.data;

      memoriService.logTrackPlay(guestId, song as any);
      res.json({ status: 'logged', song: song.title, user: guestId });
    } catch (error: any) {
      console.error('[AIController] logHistory error:', error.message || 'Unknown error');
      res.status(500).json({ error: 'Failed to record playback memory' });
    }
  }

  /**
   * Personalized AI DJ smart-shuffle recommendations powered by Memori taste memory + Gemini
   * POST /api/ai/dj
   */
  public async aiDJ(req: Request, res: Response): Promise<void> {
    try {
      // Check and consume daily AI call budget
      const budget = aiBudgetService.consumeBudget();
      if (!budget.allowed) {
        res.status(429).json({
          error: 'Daily AI call budget exceeded',
          limit: budget.status.limit,
          current: budget.status.count,
        });
        return;
      }

      const guestId = (req.headers['x-guest-id'] as string) || 'default-guest';
      const tasteContext = memoriService.getTasteProfileContext(guestId);
      const gemini = getGeminiClient();

      if (!gemini) {
        res.json([
          { title: 'Cruel Summer', artist: 'Taylor Swift', reason: 'Upbeat modern pop baseline' },
          { title: 'Levitating', artist: 'Dua Lipa', reason: 'High-energy groove' },
        ]);
        return;
      }

      // Cap prompt length and taste context to 1500 chars max
      const safeTasteContext = tasteContext.slice(0, 1500);
      const prompt = `Act as a world-class personalized AI DJ.
Here is the user's recent listening history and musical taste memory:
${safeTasteContext}

Based heavily on this taste profile, generate a smart shuffle of 10 recommended songs that fit their exact vibe while introducing them to exciting new discoveries.
Respond ONLY with a valid JSON array of objects:
[ { "title": "Song Title", "artist": "Artist Name", "reason": "Why this matches your taste memory" } ]`.slice(0, 2500);

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      });

      const responseText = response.text || '[]';
      const recommendations: AIDJRecommendation[] = JSON.parse(responseText);
      res.json(recommendations);
    } catch (error: any) {
      console.error('[AIController] aiDJ error:', error.message || 'Unknown error');
      res.status(500).json({ error: 'Failed to run AI DJ', details: error.message });
    }
  }
}

export const aiController = new AIController();
