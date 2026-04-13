import type { LiveGame } from '../types/LiveGame';
import type { PlayerProfile } from '../types/PlayerProfile';
import type { Player } from '../types/Player';
import { CacheManager } from './CacheManager';
import { isValidFen } from '../utils/fenValidator';

const BASE_URL = 'https://api.chess.com/pub';
const GAME_CACHE_TTL = 45; // seconds (within 30-60s range)
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;
const MAX_FETCH_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;

interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/** Raw game object returned by Chess.com API */
interface ChessComGame {
  url: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  rules?: string;
  fen?: string;
  start_time?: number;
  last_activity?: number;
  end_time?: number;
  white: {
    username: string;
    rating?: number;
    result?: string;
  };
  black: {
    username: string;
    rating?: number;
    result?: string;
  };
}

/** Raw player profile returned by Chess.com API */
interface ChessComPlayerProfile {
  player_id: number;
  '@id': string;
  url: string;
  username: string;
  name?: string;
  avatar?: string;
  followers: number;
  country: string;
  last_online: number;
  joined: number;
  status: string;
  is_streamer: boolean;
}

export class ChessComService {
  private cache: CacheManager;
  private readonly fetchImpl: FetchLike;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;
  private requestTimestamps: number[] = [];

  constructor(
    cache?: CacheManager,
    deps?: {
      fetchImpl?: FetchLike;
      sleepFn?: (ms: number) => Promise<void>;
      nowFn?: () => number;
    }
  ) {
    this.cache = cache ?? new CacheManager();
    this.fetchImpl = deps?.fetchImpl ?? fetch;
    this.sleepFn = deps?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.nowFn = deps?.nowFn ?? Date.now;
  }

  /**
   * Fetches the first in-progress live game for the given username.
   * Returns null if no live game is found.
   * Falls back to cached data if the API is unavailable.
   */
  async fetchLiveGame(username: string): Promise<LiveGame | null> {
    const cacheKey = `live:${username.toLowerCase()}`;

    try {
      const games = await this.fetchCurrentGames(username);
      const liveGame = games.find((g) => this.isGameInProgress(g)) ?? null;

      if (liveGame) {
        this.cache.setGame(cacheKey, liveGame, GAME_CACHE_TTL);
      }

      return liveGame;
    } catch {
      // Fallback to cache on API failure (Requirement 1.4)
      return this.cache.getGame(cacheKey);
    }
  }

  /**
   * Fetches the player profile for the given username.
   */
  async fetchPlayerProfile(username: string): Promise<PlayerProfile> {
    const data = await this.fetchJsonWithRetry<ChessComPlayerProfile>(
      `${BASE_URL}/player/${encodeURIComponent(username)}`,
      `Failed to fetch player profile for "${username}"`
    );
    return this.transformPlayerProfile(data);
  }

  /**
   * Fetches all current (ongoing) games for the given username.
   */
  async fetchCurrentGames(username: string): Promise<LiveGame[]> {
    const data = await this.fetchJsonWithRetry<{ games: ChessComGame[] }>(
      `${BASE_URL}/player/${encodeURIComponent(username)}/games`,
      `Failed to fetch games for "${username}"`
    );
    const games: LiveGame[] = [];

    for (const raw of data.games ?? []) {
      const game = this.transformGame(raw);
      if (game) {
        games.push(game);
      }
    }

    return games;
  }

  /**
   * Returns true when the game has not yet finished.
   */
  isGameInProgress(game: LiveGame): boolean {
    return !game.isFinished;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private transformGame(raw: ChessComGame): LiveGame | null {
    // Derive a stable gameId from the URL
    const gameId = raw.url?.split('/').pop() ?? '';
    if (!gameId) return null;

    const fen = raw.fen ?? '';
    if (!isValidFen(fen)) return null;

    const white: Player = {
      username: raw.white?.username ?? '',
      rating: raw.white?.rating ?? 0,
      color: 'white',
      result: this.normalizeResult(raw.white?.result),
    };

    const black: Player = {
      username: raw.black?.username ?? '',
      rating: raw.black?.rating ?? 0,
      color: 'black',
      result: this.normalizeResult(raw.black?.result),
    };

    if (!white.username || !black.username) return null;

    const whiteResult = raw.white?.result;
    const blackResult = raw.black?.result;
    const isFinished =
      (whiteResult ? this.isTerminalResult(whiteResult) : false) ||
      (blackResult ? this.isTerminalResult(blackResult) : false);

    const timeClass = this.normalizeTimeClass(raw.time_class);

    return {
      gameId,
      url: raw.url,
      white,
      black,
      fen,
      pgn: raw.pgn ?? '',
      timeControl: raw.time_control ?? '',
      timeClass,
      rules: raw.rules ?? 'chess',
      startTime: raw.start_time ?? 0,
      lastMoveTime: raw.last_activity ?? raw.end_time ?? 0,
      isFinished,
      result: isFinished ? (whiteResult ?? blackResult) : undefined,
    };
  }

  private transformPlayerProfile(raw: ChessComPlayerProfile): PlayerProfile {
    return {
      username: raw.username,
      playerId: String(raw.player_id),
      url: raw.url,
      name: raw.name,
      avatar: raw.avatar,
      followers: raw.followers ?? 0,
      country: raw.country ?? '',
      lastOnline: raw.last_online ?? 0,
      joined: raw.joined ?? 0,
      status: raw.status ?? '',
      isStreaming: raw.is_streamer ?? false,
    };
  }

  private normalizeResult(
    result?: string
  ): Player['result'] | undefined {
    if (!result) return undefined;
    const map: Record<string, Player['result']> = {
      win: 'win',
      loss: 'loss',
      draw: 'draw',
      timeout: 'timeout',
      resigned: 'resigned',
      abandoned: 'abandoned',
      checkmated: 'loss',
      stalemate: 'draw',
      agreed: 'draw',
      repetition: 'draw',
      insufficient: 'draw',
      '50move': 'draw',
      timevsinsufficient: 'draw',
    };
    return map[result.toLowerCase()];
  }

  private isTerminalResult(result: string): boolean {
    const terminal = new Set([
      'win', 'loss', 'draw', 'timeout', 'resigned', 'abandoned',
      'checkmated', 'stalemate', 'agreed', 'repetition', 'insufficient',
      '50move', 'timevsinsufficient',
    ]);
    return terminal.has(result.toLowerCase());
  }

  private async fetchJsonWithRetry<T>(url: string, errorContext: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      await this.enforceRateLimit();

      try {
        const response = await this.fetchImpl(url);

        if (response.status === 429) {
          if (attempt === MAX_FETCH_ATTEMPTS) {
            throw new Error(`${errorContext}: HTTP 429`);
          }

          const retryAfterMs = this.parseRetryAfterMs(response.headers.get('Retry-After'));
          const fallbackBackoff = this.getExponentialBackoffMs(attempt);
          await this.sleepFn(retryAfterMs ?? fallbackBackoff);
          continue;
        }

        if (!response.ok) {
          // Retry on transient server errors only.
          if (response.status >= 500 && attempt < MAX_FETCH_ATTEMPTS) {
            await this.sleepFn(this.getExponentialBackoffMs(attempt));
            continue;
          }

          throw new Error(`${errorContext}: HTTP ${response.status}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (/HTTP\s\d+$/i.test(lastError.message)) {
          throw lastError;
        }
        if (attempt === MAX_FETCH_ATTEMPTS) {
          break;
        }

        await this.sleepFn(this.getExponentialBackoffMs(attempt));
      }
    }

    throw lastError ?? new Error(`${errorContext}: request failed`);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = this.nowFn();
    this.requestTimestamps = this.requestTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = this.requestTimestamps[0];
      const waitMs = oldest + RATE_LIMIT_WINDOW_MS - now;
      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      }
    }

    const recordedAt = this.nowFn();
    this.requestTimestamps.push(recordedAt);
  }

  private parseRetryAfterMs(retryAfterHeader: string | null): number | null {
    if (!retryAfterHeader) return null;

    const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1000;
    }

    const retryAfterDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(retryAfterDate)) {
      return Math.max(0, retryAfterDate - this.nowFn());
    }

    return null;
  }

  private getExponentialBackoffMs(attempt: number): number {
    const boundedAttempt = Math.max(1, attempt);
    return BASE_BACKOFF_MS * 2 ** (boundedAttempt - 1);
  }

  private normalizeTimeClass(
    timeClass?: string
  ): LiveGame['timeClass'] {
    const valid = new Set<LiveGame['timeClass']>(['bullet', 'blitz', 'rapid', 'daily']);
    const tc = (timeClass ?? '').toLowerCase() as LiveGame['timeClass'];
    return valid.has(tc) ? tc : 'rapid';
  }
}
