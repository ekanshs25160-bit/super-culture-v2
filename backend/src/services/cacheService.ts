import { LRUCache } from 'lru-cache';

export interface CacheEntry<T> {
  data: T;
  freshUntil: number;
}

export interface CacheResult<T> {
  data: T;
  cached: boolean;
  stale: boolean;
}

export class CacheService {
  private cache: LRUCache<string, CacheEntry<any>>;
  private inFlightPromises = new Map<string, Promise<any>>();

  // TTL Presets (in milliseconds)
  public static readonly TTL = {
    HOME_SHELVES: 15 * 60 * 1000, // 15 minutes
    SEARCH: 5 * 60 * 1000, // 5 minutes
    ARTIST: 30 * 60 * 1000, // 30 minutes
    UP_NEXT: 30 * 60 * 1000, // 30 minutes
  };

  constructor() {
    this.cache = new LRUCache<string, CacheEntry<any>>({
      max: 5000,
      // Allow stale entries to be retained in RAM for background revalidation
      ttl: 60 * 60 * 1000 * 4, // 4 hours maximum memory residency
    });
  }

  public normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Stale-while-revalidate fetcher with concurrent in-flight request deduplication.
   */
  public async getOrFetch<T>(
    key: string,
    freshTtlMs: number,
    fetcher: () => Promise<T>
  ): Promise<CacheResult<T>> {
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    // 1. Fresh Cache Hit -> Instant return
    if (existing && now < existing.freshUntil) {
      return { data: existing.data, cached: true, stale: false };
    }

    // 2. Stale Cache Hit -> Return instantly and refresh in background (Stale-While-Revalidate)
    if (existing) {
      if (!this.inFlightPromises.has(key)) {
        const refreshPromise = fetcher()
          .then((freshData) => {
            this.set(key, freshData, freshTtlMs);
            return freshData;
          })
          .catch((err) => {
            console.warn(`[CacheService] Background SWR refresh failed for ${key}:`, err.message || err);
          })
          .finally(() => {
            this.inFlightPromises.delete(key);
          });

        this.inFlightPromises.set(key, refreshPromise);
      }
      return { data: existing.data, cached: true, stale: true };
    }

    // 3. Cold Cache Miss -> De-duplicate concurrent in-flight fetches
    let inFlight = this.inFlightPromises.get(key) as Promise<T> | undefined;
    if (!inFlight) {
      inFlight = fetcher()
        .then((freshData) => {
          this.set(key, freshData, freshTtlMs);
          return freshData;
        })
        .finally(() => {
          this.inFlightPromises.delete(key);
        });

      this.inFlightPromises.set(key, inFlight);
    }

    const data = await inFlight;
    return { data, cached: false, stale: false };
  }

  public set<T>(key: string, data: T, freshTtlMs: number): void {
    this.cache.set(key, {
      data,
      freshUntil: Date.now() + freshTtlMs,
    });
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    return entry ? (entry.data as T) : undefined;
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.inFlightPromises.clear();
  }
}

export const cacheService = new CacheService();
