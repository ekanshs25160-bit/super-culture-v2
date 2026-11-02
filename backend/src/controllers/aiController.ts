import { Request, Response } from 'express';
import { getGeminiClient } from '../config/gemini.js';
import { memoriService } from '../services/memoriService.js';
import { AIDJRecommendation, VibeRequest } from '../types/index.js';

export class AIController {
  /**
   * Magic Vibe playlist generator
   * POST /api/ai/vibe
   */
  public async generateVibe(req: Request, res: Response): Promise<void> {
    try {
      const { mood = 'Any', genre = 'Any', language = 'Any', referenceSongs = 'Modern trending tracks' }: VibeRequest = req.body;
      const gemini = getGeminiClient();

      if (!gemini) {
        // Fallback response if GEMINI_API_KEY is not set
        res.json([
          { title: 'Starboy', artist: 'The Weeknd' },
          { title: 'Blinding Lights', artist: 'The Weeknd' },
          { title: 'As It Was', artist: 'Harry Styles' },
        ]);
        return;
      }

      const prompt = `Act as an avant-garde AI DJ and music tastemaker for an editorial music publication.
Create a highly curated, personalized "vibe" tracklist based on these criteria:
- Target Mood: ${mood}
- Target Genre: ${genre}
- Preferred Language: ${language}
- Aesthetic Reference: ${referenceSongs}

Return EXACTLY 15 songs.
Respond ONLY with a valid JSON array of objects:
[ { "title": "Song Title", "artist": "Artist Name", "reason": "Short vibe aesthetic rationale" } ]`;

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
      console.error('[AIController] generateVibe error:', error);
      res.status(500).json({ error: 'Failed to generate vibe playlist', details: error.message });
    }
  }

  /**
   * Log playback history and record taste memory via Memori
   * POST /api/ai/log-history
   */
  public async logHistory(req: Request, res: Response): Promise<void> {
    try {
      const guestId = (req.headers['x-guest-id'] as string) || 'default-guest';
      const { song } = req.body;

      if (!song || !song.title) {
        res.status(400).json({ error: 'Valid song object required' });
        return;
      }

      memoriService.logTrackPlay(guestId, song);
      res.json({ status: 'logged', song: song.title, user: guestId });
    } catch (error: any) {
      console.error('[AIController] logHistory error:', error);
      res.status(500).json({ error: 'Failed to record playback memory' });
    }
  }

  /**
   * Personalized AI DJ smart-shuffle recommendations powered by Memori taste memory + Gemini
   * POST /api/ai/dj
   */
  public async aiDJ(req: Request, res: Response): Promise<void> {
    try {
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

      const prompt = `Act as a world-class personalized AI DJ.
Here is the user's recent listening history and musical taste memory:
${tasteContext}

Based heavily on this taste profile, generate a smart shuffle of 10 recommended songs that fit their exact vibe while introducing them to exciting new discoveries.
Respond ONLY with a valid JSON array of objects:
[ { "title": "Song Title", "artist": "Artist Name", "reason": "Why this matches your taste memory" } ]`;

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
      console.error('[AIController] aiDJ error:', error);
      res.status(500).json({ error: 'Failed to run AI DJ', details: error.message });
    }
  }
}

export const aiController = new AIController();
