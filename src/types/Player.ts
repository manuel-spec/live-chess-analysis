export interface Player {
  username: string;
  rating: number;
  result?: 'win' | 'loss' | 'draw' | 'timeout' | 'resigned' | 'abandoned';
  color: 'white' | 'black';
}
