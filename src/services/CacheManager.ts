import { LRUCache } from 'lru-cache';
import type { LiveGame } from '../types/LiveGame';
import type { AnalysisResult } from '../types/AnalysisResult';
import type { CacheStats } from '../types/CacheStats';

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms
}

/**
 * CacheManager handles caching for game data and analysis results.
 * Uses LRU eviction strategy with manual TTL tracking (compatible with fake timers).
 */
export class CacheManager {
  private gameCache: LRUCache<string, CacheEntry<LiveGame>>;
  private analysisCache: LRUCache<string, CacheEntry<AnalysisResult>>;
  private defaultGameTtl: number;    // seconds
  private defaultAnalysisTtl: number; // seconds
  private stats: {
    gameHits: number;
    gameMisses: number;
    analysisHits: number;
    analysisMisses: number;
  };

  constructor(
    gameCacheMaxSize: number = 100,
    analysisCacheMaxSize: number = 1000,
    defaultGameTtl: number = 45,
    defaultAnalysisTtl: number = 3600
  ) {
    this.defaultGameTtl = defaultGameTtl;
    this.defaultAnalysisTtl = defaultAnalysisTtl;

    this.gameCache = new LRUCache<string, CacheEntry<LiveGame>>({ max: gameCacheMaxSize });
    this.analysisCache = new LRUCache<string, CacheEntry<AnalysisResult>>({ max: analysisCacheMaxSize });

    this.stats = { gameHits: 0, gameMisses: 0, analysisHits: 0, analysisMisses: 0 };
  }

  getGame(key: string): LiveGame | null {
    const entry = this.gameCache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      this.stats.gameHits++;
      return entry.value;
    }
    if (entry) this.gameCache.delete(key);
    this.stats.gameMisses++;
    return null;
  }

  setGame(key: string, game: LiveGame, ttl?: number): void {
    const ttlMs = (ttl !== undefined ? ttl : this.defaultGameTtl) * 1000;
    this.gameCache.set(key, { value: game, expiresAt: Date.now() + ttlMs });
  }

  getAnalysis(fen: string): AnalysisResult | null {
    const entry = this.analysisCache.get(fen);
    if (entry && Date.now() < entry.expiresAt) {
      this.stats.analysisHits++;
      return entry.value;
    }
    if (entry) this.analysisCache.delete(fen);
    this.stats.analysisMisses++;
    return null;
  }

  setAnalysis(fen: string, result: AnalysisResult, ttl?: number): void {
    const ttlMs = (ttl !== undefined ? ttl : this.defaultAnalysisTtl) * 1000;
    this.analysisCache.set(fen, { value: result, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.gameCache.clear();
    this.analysisCache.clear();
    this.stats = { gameHits: 0, gameMisses: 0, analysisHits: 0, analysisMisses: 0 };
  }

  getStats(): CacheStats {
    const totalHits = this.stats.gameHits + this.stats.analysisHits;
    const totalMisses = this.stats.gameMisses + this.stats.analysisMisses;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const currentSize = this.gameCache.size + this.analysisCache.size;
    const maxSize = this.gameCache.max + this.analysisCache.max;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: parseFloat(hitRate.toFixed(4)),
      size: currentSize,
      maxSize,
    };
  }
}
