import { TrackMeta } from '../types/index.js';
export interface UserMemory {
    id: string;
    userId: string;
    content: string;
    category: string;
    createdAt: string;
}
export declare class MemoriService {
    /**
     * Capture a track listening event as a user taste memory turn
     */
    logTrackPlay(userId: string, track: TrackMeta): void;
    /**
     * Save an explicit user preference or vibe input
     */
    saveTasteFact(userId: string, fact: string, category?: string): void;
    /**
     * Recall user's recent music taste facts and listening memory
     */
    recallMemories(userId: string, limit?: number): UserMemory[];
    /**
     * Build a summarized musical profile prompt based on recalled memories
     */
    getTasteProfileContext(userId: string): string;
}
export declare const memoriService: MemoriService;
