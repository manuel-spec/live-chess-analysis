import type { LiveGame } from '../types/LiveGame';
import type { PlayerProfile } from '../types/PlayerProfile';
import type { Player } from '../types/Player';
import { CacheManager } from './CacheManager';
import { isValidFen } from '../utils/fenValidator';

const BASE_URL = 'https://api.chess.com/pub';
const GAME_CACHE_TTL = 45; // seconds (within 30-60s range)

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

  constructor(cache?: CacheManager) {
    this.cache = cache ?? new CacheManager();
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
    const response = await fetch(`${BASE_URL}/player/${encodeURIComponent(username)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch player profile for "${username}": HTTP ${response.status}`);
    }

    const data: ChessComPlayerProfile = await response.json();
    return this.transformPlayerProfile(data);
  }

  /**
   * Fetches all current (ongoing) games for the given username.
   */
  async fetchCurrentGames(username: string): Promise<LiveGame[]> {
    const response = await fetch(
      `${BASE_URL}/player/${encodeURIComponent(username)}/games`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch games for "${username}": HTTP ${response.status}`
      );
    }

    const data: { games: ChessComGame[] } = await response.json();
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

    const isFinished =
      raw.white?.result !== undefined &&
      raw.white.result !== 'timeout' &&
      raw.white.result !== '' &&
      // Chess.com marks ongoing games with no result or specific values
      this.isTerminalResult(raw.white.result);

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
      result: isFinished ? raw.white?.result : undefined,
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

  private normalizeTimeClass(
    timeClass?: string
  ): LiveGame['timeClass'] {
    const valid = new Set<LiveGame['timeClass']>(['bullet', 'blitz', 'rapid', 'daily']);
    const tc = (timeClass ?? '').toLowerCase() as LiveGame['timeClass'];
    return valid.has(tc) ? tc : 'rapid';
  }
}
