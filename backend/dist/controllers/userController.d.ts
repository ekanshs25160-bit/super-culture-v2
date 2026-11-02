import { Request, Response } from 'express';
export declare class UserController {
    /**
     * Library overview (Liked songs count, user playlists, profile settings)
     * GET /api/library/overview
     */
    getLibraryOverview(req: Request, res: Response): Promise<void>;
    /**
     * Toggle like on a track
     * POST /api/library/likes/:videoId
     */
    toggleLike(req: Request, res: Response): Promise<void>;
    /**
     * Create custom playlist
     * POST /api/library/playlists
     */
    createPlaylist(req: Request, res: Response): Promise<void>;
    /**
     * Update mood state (Top Bar & Left Nav synchronization)
     * POST /api/vibe/mood
     */
    updateMood(req: Request, res: Response): Promise<void>;
}
export declare const userController: UserController;
