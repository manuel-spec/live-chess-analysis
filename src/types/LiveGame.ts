import { Player } from './Player';

export interface LiveGame {
  gameId: string;
  url: string;
  white: Player;
  black: Player;
  fen: string;
  pgn: string;
  timeControl: string;
  timeClass: 'bullet' | 'blitz' | 'rapid' | 'daily';
  rules: string;
  startTime: number;
  lastMoveTime: number;
  isFinished: boolean;
  result?: string;
}
