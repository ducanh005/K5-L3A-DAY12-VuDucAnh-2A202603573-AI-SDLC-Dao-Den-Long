export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface InputState {
  moveX: number;
  moveZ: number;
  sprint?: boolean;
  interact?: boolean;
}

export interface Firefly {
  id: string;
  pos: Vec3;
  collected: boolean;
}

export interface GreatLantern {
  id: string;
  pos: Vec3;
  requiredFireflies: number;
  lit: boolean;
}

export interface InkShadow {
  id: string;
  pos: Vec3;
  vel: Vec3;
  radius: number;
}

export interface PlayerState {
  pos: Vec3;
  yaw: number;
  fireflies: number;
  hp: number;
  stamina: number;
  invulnTimer: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type WorldEventType =
  | 'firefly_collected'
  | 'lantern_lit'
  | 'shadow_hit'
  | 'game_won'
  | 'game_lost';

export interface WorldEvent {
  type: WorldEventType;
  targetId?: string;
}

export interface WorldConfig {
  seed: number;
  mapRadius: number;
  fireflyCount: number;
  lanternCount: number;
  shadowCount: number;
}

export interface WorldState {
  seed: number;
  rngState: number;
  tick: number;
  time: number;
  status: GameStatus;
  mapRadius: number;
  player: PlayerState;
  fireflies: Firefly[];
  lanterns: GreatLantern[];
  shadows: InkShadow[];
  lastEvents: WorldEvent[];
}
