const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 200;

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class LRUCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.store.size >= MAX_ENTRIES) {
      // Evict oldest entry
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { data, expires: Date.now() + TTL_MS });
  }

  size(): number {
    return this.store.size;
  }
}

// Module-level singleton — persists across requests in same function instance
export const analysisCache = new LRUCache<unknown>();

const CACHE_VERSION = 'v2'; // bump to invalidate all cached results

export function makeAnalysisCacheKey(
  make: string,
  model: string,
  year: number,
  mileage: number
): string {
  const roundedMileage = Math.floor(mileage / 10_000) * 10_000;
  return `${CACHE_VERSION}:${make.trim().toLowerCase()}:${model.trim().toLowerCase()}:${year}:${roundedMileage}`;
}

// Simple counter for "total analyses" — resets on cold start, that's fine for MVP
let _analysisCount = 1000;

export function incrementAnalysisCount(): number {
  return ++_analysisCount;
}

export function getAnalysisCount(): number {
  return _analysisCount;
}
