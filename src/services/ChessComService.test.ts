/// <reference types="vitest" />

import * as fc from 'fast-check';
import { ChessComService } from './ChessComService';
import { CacheManager } from './CacheManager';
import type { LiveGame } from '../types/LiveGame';

const VALID_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
  });
}

function buildRawGame(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    url: 'https://www.chess.com/game/live/123456789',
    pgn: '1. e4 e5',
    time_control: '600+0',
    time_class: 'rapid',
    rules: 'chess',
    fen: VALID_FEN,
    start_time: 1710000000,
    last_activity: 1710000030,
    white: {
      username: 'whitePlayer',
      rating: 1500,
      result: '',
    },
    black: {
      username: 'blackPlayer',
      rating: 1550,
      result: '',
    },
    ...overrides,
  };
}

describe('ChessComService - unit tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fetch and transform a live game successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ games: [buildRawGame()] }, 200)
    );

    const service = new ChessComService(undefined, { fetchImpl: fetchMock });
    const game = await service.fetchLiveGame('hikaru');

    expect(game).not.toBeNull();
    expect(game?.gameId).toBe('123456789');
    expect(game?.white.username).toBe('whitePlayer');
    expect(game?.black.username).toBe('blackPlayer');
    expect(game?.fen).toBe(VALID_FEN);
    expect(game?.isFinished).toBe(false);
  });

  it('should throw a clear error when user is not found (404)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404)
    );

    const service = new ChessComService(undefined, { fetchImpl: fetchMock });

    await expect(service.fetchCurrentGames('unknown-user')).rejects.toThrow(
      'Failed to fetch games for "unknown-user": HTTP 404'
    );
  });

  it('should retry when receiving 429 and honor Retry-After', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'rate limited' }, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(jsonResponse({ games: [buildRawGame()] }, 200));

    const service = new ChessComService(undefined, {
      fetchImpl: fetchMock,
      sleepFn,
    });

    const games = await service.fetchCurrentGames('hikaru');

    expect(games).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(2000);
  });

  it('should fallback to cached live game when API fails', async () => {
    const cache = new CacheManager();
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchSuccessThenFail = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ games: [buildRawGame()] }, 200))
      .mockRejectedValueOnce(new Error('Network down'));

    const service = new ChessComService(cache, {
      fetchImpl: fetchSuccessThenFail,
      sleepFn,
    });

    const first = await service.fetchLiveGame('magnus');
    const second = await service.fetchLiveGame('magnus');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.gameId).toBe(first?.gameId);
    // 1 successful call + 3 retry attempts on network failure
    expect(fetchSuccessThenFail).toHaveBeenCalledTimes(4);
  });

  it('should throttle when request volume exceeds 300 requests per minute', async () => {
    let now = 0;
    const nowFn = () => now;
    const sleepFn = vi.fn(async (ms: number) => {
      now += ms;
    });

    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ games: [] }, 200)));
    const service = new ChessComService(undefined, { fetchImpl: fetchMock, sleepFn, nowFn });

    for (let i = 0; i < 301; i++) {
      await service.fetchCurrentGames('user');
    }

    expect(fetchMock).toHaveBeenCalledTimes(301);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(60000);
  });
});

describe('ChessComService - property-based tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 6: Game Data Consistency
   * Validates: Requirements 15.1, 15.4, 15.5
   */
  it('Property 6: should preserve consistent game identity and player mapping from API payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 100, max: 3500 }),
        fc.integer({ min: 100, max: 3500 }),
        async (whiteUsername, blackUsername, whiteRating, blackRating) => {
          const rawGame = buildRawGame({
            url: 'https://www.chess.com/game/live/987654321',
            white: { username: whiteUsername, rating: whiteRating, result: '' },
            black: { username: blackUsername, rating: blackRating, result: '' },
          });

          const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ games: [rawGame] }, 200));
          const service = new ChessComService(undefined, { fetchImpl: fetchMock });

          const games = await service.fetchCurrentGames('random-user');
          expect(games).toHaveLength(1);

          const game = games[0];
          expect(game.gameId).toBe('987654321');
          expect(game.white.username).toBe(whiteUsername);
          expect(game.black.username).toBe(blackUsername);
          expect(game.white.rating).toBe(whiteRating);
          expect(game.black.rating).toBe(blackRating);
          expect(game.fen).toBe(VALID_FEN);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 16: Complete Game Data Structure
   * Validates: Requirements 1.2, 15.5
   */
  it('Property 16: should always return fully populated LiveGame objects for valid API games', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<'bullet' | 'blitz' | 'rapid' | 'daily'>('bullet', 'blitz', 'rapid', 'daily'),
        fc.constantFrom<'win' | 'loss' | 'draw' | ''>('win', 'loss', 'draw', ''),
        async (timeClass, whiteResult) => {
          const rawGame = buildRawGame({
            time_class: timeClass,
            white: { username: 'w', rating: 1500, result: whiteResult },
            black: { username: 'b', rating: 1500, result: whiteResult === '' ? '' : 'loss' },
          });

          const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ games: [rawGame] }, 200));
          const service = new ChessComService(undefined, { fetchImpl: fetchMock });
          const [game] = await service.fetchCurrentGames('user');

          expect(typeof game.gameId).toBe('string');
          expect(game.gameId.length).toBeGreaterThan(0);
          expect(game.url.startsWith('https://')).toBe(true);
          expect(game.timeClass).toBe(timeClass);
          expect(game.fen).toBe(VALID_FEN);
          expect(typeof game.startTime).toBe('number');
          expect(typeof game.lastMoveTime).toBe('number');
          expect(typeof game.isFinished).toBe('boolean');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 15: API Fallback to Cache
   * Validates: Requirements 1.4, 8.3, 10.1
   */
  it('Property 15: should always return cached game when fetch fails after cache is warm', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }), async (username) => {
        const cache = new CacheManager();
        const game: LiveGame = {
          gameId: 'cached123',
          url: 'https://www.chess.com/game/live/cached123',
          white: { username: 'cachedW', rating: 1500, color: 'white' },
          black: { username: 'cachedB', rating: 1500, color: 'black' },
          fen: VALID_FEN,
          pgn: '1. e4 e5',
          timeControl: '600+0',
          timeClass: 'rapid',
          rules: 'chess',
          startTime: 1,
          lastMoveTime: 2,
          isFinished: false,
        };

        cache.setGame(`live:${username.toLowerCase()}`, game, 45);

        const fetchMock = vi.fn().mockRejectedValue(new Error('API unavailable'));
        const service = new ChessComService(cache, {
          fetchImpl: fetchMock,
          sleepFn,
        });

        const result = await service.fetchLiveGame(username);
        expect(result).toEqual(game);
      }),
      { numRuns: 50 }
    );
  });
});
