import { AnalysisResult } from './AnalysisResult';

export interface AnalysisRequest {
  id: string;
  fen: string;
  depth: number;
  priority: number;
  timestamp: number;
  callback: (result: AnalysisResult) => void;
}
