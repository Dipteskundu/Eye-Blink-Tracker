// src/types.ts

export interface SessionResult {
  totalBlinks: number;
  blinksPerMinute: number;
  score: number;
  duration: number;
}

export type SessionStatus = 'idle' | 'running' | 'done';

export interface DurationOption {
  label: string;
  value: number;
}
