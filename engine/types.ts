export type EngineSnapshot = {
  level: number;
  levelName: string;
  health: number;
  ammo: number;
  kills: number;
  fps: number;
  soundEnabled: boolean;
  muted: boolean;
  status: 'loading' | 'ready' | 'running' | 'gameover';
  wave?: number;
  score?: number;
};
