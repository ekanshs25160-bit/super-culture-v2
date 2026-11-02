import { Request, Response } from 'express';
export declare class JamController {
    /**
     * Create a new Jam Room (adapted from Aurevon pattern)
     * POST /api/jam/create
     */
    createRoom(req: Request, res: Response): Promise<void>;
    /**
     * Join an existing Jam Room by 6-char code
     * POST /api/jam/join
     */
    joinRoom(req: Request, res: Response): Promise<void>;
    /**
     * Get active public rooms for Live Jam Rooms sidebar card
     * GET /api/jam/active/public
     */
    getActivePublicRooms(req: Request, res: Response): Promise<void>;
    /**
     * Append a song to the room queue
     * POST /api/jam/:roomId/queue
     */
    addToQueue(req: Request, res: Response): Promise<void>;
    /**
     * Heartbeat to keep listener active status updated
     * POST /api/jam/:roomId/heartbeat
     */
    heartbeat(req: Request, res: Response): Promise<void>;
}
export declare const jamController: JamController;
