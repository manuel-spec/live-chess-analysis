export interface AnalysisResult {
  fen: string;
  bestMove: string;
  evaluation: number;
  depth: number;
  principalVariation: string[];
  mate?: number;
  timestamp: number;
  engineVersion?: string;
}
