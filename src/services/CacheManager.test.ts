import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CacheManager } from './CacheManager';
import type { LiveGame } from '../types/LiveGame';
import type { AnalysisResult } from '../types/AnalysisResult';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T10:00:00Z'));
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockGame: LiveGame = {
    gameId: 'game123',
    url: 'https://chess.com/game/123',
    white: {
      username: 'player1',
      rating: 1500,
      color: 'white',
    },
    black: {
      username: 'player2',
      rating: 1600,
      color: 'black',
    },
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '1. e4 e5',
    timeControl: '600+0',
    timeClass: 'rapid',
    rules: 'chess',
    startTime: Date.now(),
    lastMoveTime: Date.now(),
    isFinished: false,
  };

  const mockAnalysis: AnalysisResult = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    bestMove: 'e2e4',
    evaluation: 25,
    depth: 20,
    principalVariation: ['e2e4', 'e7e5', 'g1f3'],
    timestamp: Date.now(),
  };

  describe('getGame and setGame', () => {
    it('should return null for non-existent game', () => {
      const result = cacheManager.getGame('nonexistent');
      expect(result).toBeNull();
    });

    it('should store and retrieve a game', () => {
      cacheManager.setGame('player1', mockGame);
      const result = cacheManager.getGame('player1');
      expect(result).toEqual(mockGame);
    });

    it('should return null after TTL expires', () => {
      cacheManager.setGame('player1', mockGame, 30);
      
      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);
      
      const result = cacheManager.getGame('player1');
      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      cacheManager.setGame('player1', mockGame, 10);
      
      // After 9 seconds, should still be cached
      vi.advanceTimersByTime(9000);
      expect(cacheManager.getGame('player1')).toEqual(mockGame);
      
      // After 11 seconds total, should be expired
      vi.advanceTimersByTime(2000);
      expect(cacheManager.getGame('player1')).toBeNull();
    });

    it('should overwrite existing game with same key', () => {
      cacheManager.setGame('player1', mockGame);
      
      const updatedGame = { ...mockGame, isFinished: true };
      cacheManager.setGame('player1', updatedGame);
      
      const result = cacheManager.getGame('player1');
      expect(result?.isFinished).toBe(true);
    });
  });

  describe('getAnalysis and setAnalysis', () => {
    it('should return null for non-existent analysis', () => {
      const result = cacheManager.getAnalysis('invalid-fen');
      expect(result).toBeNull();
    });

    it('should store and retrieve analysis', () => {
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      const result = cacheManager.getAnalysis(mockAnalysis.fen);
      expect(result).toEqual(mockAnalysis);
    });

    it('should return null after TTL expires', () => {
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis, 3600);
      
      // Advance time by 3601 seconds
      vi.advanceTimersByTime(3601000);
      
      const result = cacheManager.getAnalysis(mockAnalysis.fen);
      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis, 60);
      
      // After 59 seconds, should still be cached
      vi.advanceTimersByTime(59000);
      expect(cacheManager.getAnalysis(mockAnalysis.fen)).toEqual(mockAnalysis);
      
      // After 61 seconds total, should be expired
      vi.advanceTimersByTime(2000);
      expect(cacheManager.getAnalysis(mockAnalysis.fen)).toBeNull();
    });

    it('should overwrite existing analysis with same FEN', () => {
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      
      const updatedAnalysis = { ...mockAnalysis, depth: 25, evaluation: 50 };
      cacheManager.setAnalysis(mockAnalysis.fen, updatedAnalysis);
      
      const result = cacheManager.getAnalysis(mockAnalysis.fen);
      expect(result?.depth).toBe(25);
      expect(result?.evaluation).toBe(50);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cacheManager.setGame('player1', mockGame);
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      
      cacheManager.clear();
      
      expect(cacheManager.getGame('player1')).toBeNull();
      expect(cacheManager.getAnalysis(mockAnalysis.fen)).toBeNull();
    });

    it('should reset statistics', () => {
      cacheManager.setGame('player1', mockGame);
      cacheManager.getGame('player1'); // hit
      cacheManager.getGame('player2'); // miss
      
      cacheManager.clear();
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return initial stats with zero values', () => {
      const stats = cacheManager.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should track game cache hits', () => {
      cacheManager.setGame('player1', mockGame);
      cacheManager.getGame('player1'); // hit
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });

    it('should track game cache misses', () => {
      cacheManager.getGame('nonexistent'); // miss
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    it('should track analysis cache hits', () => {
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      cacheManager.getAnalysis(mockAnalysis.fen); // hit
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });

    it('should track analysis cache misses', () => {
      cacheManager.getAnalysis('invalid-fen'); // miss
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate correct hit rate with mixed hits and misses', () => {
      cacheManager.setGame('player1', mockGame);
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      
      cacheManager.getGame('player1'); // hit
      cacheManager.getGame('player2'); // miss
      cacheManager.getAnalysis(mockAnalysis.fen); // hit
      cacheManager.getAnalysis('other-fen'); // miss
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size correctly', () => {
      const stats1 = cacheManager.getStats();
      expect(stats1.size).toBe(0);
      
      cacheManager.setGame('player1', mockGame);
      const stats2 = cacheManager.getStats();
      expect(stats2.size).toBe(1);
      
      cacheManager.setAnalysis(mockAnalysis.fen, mockAnalysis);
      const stats3 = cacheManager.getStats();
      expect(stats3.size).toBe(2);
    });

    it('should report correct maxSize', () => {
      const customCache = new CacheManager(50, 200);
      const stats = customCache.getStats();
      expect(stats.maxSize).toBe(250); // 50 + 200
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used game when max size reached', () => {
      const smallCache = new CacheManager(2, 100);
      
      smallCache.setGame('player1', mockGame);
      smallCache.setGame('player2', { ...mockGame, gameId: 'game2' });
      smallCache.setGame('player3', { ...mockGame, gameId: 'game3' });
      
      // player1 should be evicted (least recently used)
      expect(smallCache.getGame('player1')).toBeNull();
      expect(smallCache.getGame('player2')).not.toBeNull();
      expect(smallCache.getGame('player3')).not.toBeNull();
    });

    it('should evict least recently used analysis when max size reached', () => {
      const smallCache = new CacheManager(100, 2);
      
      const fen1 = 'fen1';
      const fen2 = 'fen2';
      const fen3 = 'fen3';
      
      smallCache.setAnalysis(fen1, { ...mockAnalysis, fen: fen1 });
      smallCache.setAnalysis(fen2, { ...mockAnalysis, fen: fen2 });
      smallCache.setAnalysis(fen3, { ...mockAnalysis, fen: fen3 });
      
      // fen1 should be evicted (least recently used)
      expect(smallCache.getAnalysis(fen1)).toBeNull();
      expect(smallCache.getAnalysis(fen2)).not.toBeNull();
      expect(smallCache.getAnalysis(fen3)).not.toBeNull();
    });

    it('should update LRU order on get', () => {
      const smallCache = new CacheManager(2, 100);
      
      smallCache.setGame('player1', mockGame);
      smallCache.setGame('player2', { ...mockGame, gameId: 'game2' });
      
      // Access player1 to make it recently used
      smallCache.getGame('player1');
      
      // Add player3, should evict player2 (now least recently used)
      smallCache.setGame('player3', { ...mockGame, gameId: 'game3' });
      
      expect(smallCache.getGame('player1')).not.toBeNull();
      expect(smallCache.getGame('player2')).toBeNull();
      expect(smallCache.getGame('player3')).not.toBeNull();
    });
  });

  /**
   * Property 22: Cache Depth Reuse
   * Validates: Requirements 12.4
   *
   * The CacheManager stores and retrieves analysis by FEN key only.
   * Depth comparison (cached.depth >= requested.depth) is the caller's
   * responsibility (AnalysisQueue). This property verifies that once an
   * analysis result is stored at depth D, getAnalysis returns that same
   * result for the same FEN regardless of what depth the caller intends
   * to request — confirming the cache is a pure FEN-keyed store that
   * enables the caller to implement depth-reuse logic.
   */
  describe('Property 22: Cache Depth Reuse', () => {
    it('should return cached analysis for the same FEN regardless of the stored depth', () => {
      fc.assert(
        fc.property(
          // Generate a FEN-like key (arbitrary non-empty string as cache key)
          fc.string({ minLength: 1, maxLength: 100 }),
          // Generate the depth at which the analysis was stored (1–30)
          fc.integer({ min: 1, max: 30 }),
          // Generate a requested depth <= stored depth (simulating depth-reuse scenario)
          fc.integer({ min: 1, max: 30 }),
          (fen, storedDepth, requestedDepth) => {
            const cache = new CacheManager();

            const analysis: AnalysisResult = {
              fen,
              bestMove: 'e2e4',
              evaluation: 25,
              depth: storedDepth,
              principalVariation: ['e2e4', 'e7e5'],
              timestamp: Date.now(),
            };

            cache.setAnalysis(fen, analysis);

            // The cache returns the stored result for the same FEN key.
            // Depth comparison (requestedDepth <= storedDepth) is the caller's
            // responsibility; the cache itself is depth-agnostic.
            const retrieved = cache.getAnalysis(fen);

            // The cache must return the stored result (not null)
            if (retrieved === null) return false;

            // The retrieved result must be identical to what was stored
            if (retrieved.fen !== analysis.fen) return false;
            if (retrieved.bestMove !== analysis.bestMove) return false;
            if (retrieved.evaluation !== analysis.evaluation) return false;
            if (retrieved.depth !== storedDepth) return false;

            // When requestedDepth <= storedDepth the caller CAN reuse this result.
            // Verify the stored depth satisfies the reuse condition when applicable.
            const canReuseForRequestedDepth = retrieved.depth >= requestedDepth;

            // The property holds: if storedDepth >= requestedDepth, the cached
            // result is sufficient; otherwise the caller would need a new analysis.
            // Either way, the cache correctly returns the stored value.
            return canReuseForRequestedDepth === (storedDepth >= requestedDepth);
          }
        )
      );
    });

    it('should return the cached result when stored depth is greater than any lower requested depth', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          // storedDepth in [2..30] so we can always pick a requestedDepth < storedDepth
          fc.integer({ min: 2, max: 30 }),
          (fen, storedDepth) => {
            const cache = new CacheManager();

            const analysis: AnalysisResult = {
              fen,
              bestMove: 'g1f3',
              evaluation: -10,
              depth: storedDepth,
              principalVariation: ['g1f3'],
              timestamp: Date.now(),
            };

            cache.setAnalysis(fen, analysis);

            // For every depth strictly less than storedDepth, the cached result
            // satisfies the depth-reuse condition (cached.depth >= requestedDepth).
            for (let requestedDepth = 1; requestedDepth < storedDepth; requestedDepth++) {
              const retrieved = cache.getAnalysis(fen);
              if (retrieved === null) return false;
              if (retrieved.depth < requestedDepth) return false; // depth-reuse invariant
            }

            return true;
          }
        )
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string keys', () => {
      cacheManager.setGame('', mockGame);
      const result = cacheManager.getGame('');
      expect(result).toEqual(mockGame);
    });

    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(1000);
      cacheManager.setGame(longKey, mockGame);
      const result = cacheManager.getGame(longKey);
      expect(result).toEqual(mockGame);
    });

    it('should handle zero TTL', () => {
      cacheManager.setGame('player1', mockGame, 0);
      // With 0 TTL, entry should expire immediately
      vi.advanceTimersByTime(1);
      expect(cacheManager.getGame('player1')).toBeNull();
    });

    it('should handle multiple gets without affecting stats incorrectly', () => {
      cacheManager.setGame('player1', mockGame);
      
      cacheManager.getGame('player1'); // hit
      cacheManager.getGame('player1'); // hit
      cacheManager.getGame('player1'); // hit
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(0);
    });
  });
});
