export type Vec3Tuple = [number, number, number];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface TuningConfig {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface FrameInput {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export interface InputsFile {
  frames: FrameInput[];
}

export interface ScenarioPlayer {
  pos?: Vec3Tuple;
  carried?: number;
  flames?: number;
}

export interface ScenarioMoteObj {
  id?: string;
  pos: Vec3Tuple;
}

export interface ScenarioShadeObj {
  id?: string;
  pos: Vec3Tuple;
}

export interface ScenarioLanternObj {
  id: string;
  pos?: Vec3Tuple;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioConfig {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Array<Vec3Tuple | ScenarioMoteObj>;
  shades?: Array<Vec3Tuple | ScenarioShadeObj>;
  lanterns?: ScenarioLanternObj[];
  time_left_s?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';
export type ShadeBehaviorState = 'chase' | 'stunned';

export interface PlayerState {
  pos: Vec3Tuple;
  vy: number;
  yaw_rad: number;
  flames: number;
  carried: number;
  invuln_left_s: number;
  pulse_cd_left_s: number;
}

export interface MoteState {
  id: string;
  pos: Vec3Tuple;
  active: boolean;
}

export interface LanternState {
  id: string;
  pos: Vec3Tuple;
  lit: boolean;
  deposited: number;
}

export interface ShadeState {
  id: string;
  pos: Vec3Tuple;
  state: ShadeBehaviorState;
  stun_left_s: number;
}

export type ContractEventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
  | 'game_over';

export interface ContractEvent {
  type: 'event';
  tick: number;
  name: ContractEventName;
  data: Record<string, unknown>;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameStatus;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3Tuple;
    flames: number;
    carried: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3Tuple;
    lit: boolean;
    deposited: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3Tuple;
    state: ShadeBehaviorState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3Tuple;
  }>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameStatus;
  score: number;
}

export interface ButtonState {
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface WorldState {
  seed: number;
  night: number;
  rngState: number;
  tuning: TuningConfig;
  tick: number;
  sim_tick: number;
  initial_time_left_s: number;
  time_left_s: number;
  state: GameStatus;
  score: number;
  map_radius: number;
  player: PlayerState;
  motes: MoteState[];
  lanterns: LanternState[];
  shades: ShadeState[];
  prev_buttons: ButtonState;
  last_events: ContractEvent[];
  last_pulse_tick: number;
}
