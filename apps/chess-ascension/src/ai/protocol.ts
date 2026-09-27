import type { PositionData } from '../engine/position';
import type { CompiledRules } from '../engine/rules';
import type { AiSettings } from './search';

export interface AiRequest {
  id: number;
  position: PositionData;
  rules: CompiledRules;
  settings: AiSettings;
}

export interface AiMove {
  from: number;
  to: number;
  promo: number;
  flags: number;
}

export interface AiResponse {
  id: number;
  move: AiMove | null;
  score: number;
  depth: number;
  nodes: number;
  error?: string;
}
