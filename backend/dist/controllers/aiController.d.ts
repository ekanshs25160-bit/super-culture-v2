import { Request, Response } from 'express';
export declare class AIController {
    /**
     * Magic Vibe playlist generator
     * POST /api/ai/vibe
     */
    generateVibe(req: Request, res: Response): Promise<void>;
    /**
     * Log playback history and record taste memory via Memori
     * POST /api/ai/log-history
     */
    logHistory(req: Request, res: Response): Promise<void>;
    /**
     * Personalized AI DJ smart-shuffle recommendations powered by Memori taste memory + Gemini
     * POST /api/ai/dj
     */
    aiDJ(req: Request, res: Response): Promise<void>;
}
export declare const aiController: AIController;
