import { Innertube } from 'youtubei.js';
import { TrackMeta, StreamEntry } from '../types/index.js';
export declare class YouTubeService {
    private yt;
    private streamCache;
    private isInitializing;
    constructor();
    /**
     * Lazy-initialize YouTube.js client
     */
    getClient(): Promise<Innertube>;
    /**
     * Enforces PRD high-fashion editorial 544x544 upscaled artwork
     */
    upscaleThumbnail(url?: string): string;
    /**
     * Search tracks via YouTube Music
     */
    searchTracks(query: string): Promise<TrackMeta[]>;
    /**
     * Resolve audio stream URL with LRU caching
     */
    resolveAudioStream(videoId: string): Promise<StreamEntry>;
    /**
     * Fetch Watch Next / Radio playlist for "PLAYING NEXT" pill
     */
    getUpNext(videoId: string): Promise<TrackMeta[]>;
}
export declare const ytService: YouTubeService;
