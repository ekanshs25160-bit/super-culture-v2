import { Request, Response } from 'express';
export declare class MusicController {
    /**
     * Search songs and music tracks
     * GET /api/yt/search?q={query}
     */
    search(req: Request, res: Response): Promise<void>;
    /**
     * Stream audio proxy supporting byte-range headers (206 Partial Content)
     * GET /api/yt/stream/:videoId
     */
    stream(req: Request, res: Response): Promise<void>;
    /**
     * Up next / Watch playlist recommendations for "PLAYING NEXT" pill
     * GET /api/yt/up-next/:videoId
     */
    getUpNext(req: Request, res: Response): Promise<void>;
    /**
     * Pre-warmed home shelves (Trending Worldwide, Curated stacks)
     * GET /api/yt/home-shelves
     */
    getHomeShelves(req: Request, res: Response): Promise<void>;
}
export declare const musicController: MusicController;
