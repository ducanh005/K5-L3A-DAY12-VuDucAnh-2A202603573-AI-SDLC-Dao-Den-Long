export type Vec3Tuple = [number, number, number];
export type NightNumber = 1 | 2 | 3;

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
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  win_ratio: number;
  score: ScoreTuning;
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface FrameInput {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsFile {
  frames: FrameInput[];
}

export type ShadeBehaviorState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterBehaviorState = 'idle' | 'chase' | 'flee';
export type MoteKind = 'random' | 'dropped';
export type GameStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface ScenarioPlayer {
  pos?: Vec3Tuple;
  carried?: number;
  flames?: number;
  successful_lights?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
}

export interface ScenarioMoteObj {
  id?: string;
  pos: Vec3Tuple;
  kind?: MoteKind;
  ttl_s?: number | null;
}

export interface ScenarioShadeObj {
  id?: string;
  pos: Vec3Tuple;
  state?: ShadeBehaviorState;
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioDrifterObj {
  id?: string;
  pos: Vec3Tuple;
  state?: DrifterBehaviorState;
  stolen?: number;
}

export interface ScenarioCharmObj {
  id?: string;
  pos?: Vec3Tuple;
  available?: boolean;
  respawn_s?: number;
}

export interface ScenarioLanternObj {
  id: string;
  pos?: Vec3Tuple;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export interface ScenarioConfig {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Array<Vec3Tuple | ScenarioMoteObj>;
  shades?: Array<Vec3Tuple | ScenarioShadeObj>;
  drifters?: ScenarioDrifterObj[];
  charms?: ScenarioCharmObj[];
  lanterns?: ScenarioLanternObj[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3Tuple;
  vel: Vec3Tuple;
  yaw_rad: number;
  flames: number;
  carried: number;
  successful_lights: number;
  capacity: number;
  grounded: boolean;
  invuln_ticks: number;
  dash_cd_ticks: number;
  dash_ticks_left: number;
  dash_dir: [number, number];
  pulse_cd_ticks: number;
  charm_ticks: number;
  fall_wait_ticks: number;
  launch_active: boolean;
  launch_vel_xz: [number, number];
}

export interface MoteState {
  id: string;
  pos: Vec3Tuple;
  kind: MoteKind;
  ttl_ticks: number | null;
  just_spawned: boolean;
}

export interface LanternState {
  id: string;
  pos: Vec3Tuple;
  lit: boolean;
  deposited: number;
  fuel_ticks: number;
  ever_lit: boolean;
  relit_count: number;
}

export interface ShadeState {
  id: string;
  pos: Vec3Tuple;
  state: ShadeBehaviorState;
  state_ticks_left: number;
  push_ticks_left: number;
  push_dir: [number, number];
  recoil_dir: [number, number];
  repel_lantern_id: string | null;
  repel_ticks_left: number;
  target_lantern_id: string | null;
  drain_ticks: number;
  wander_angle: number;
}

export interface DrifterState {
  id: string;
  pos: Vec3Tuple;
  state: DrifterBehaviorState;
  state_ticks_left: number;
  stolen: number;
  has_stolen: boolean;
  orbit_angle: number;
  just_spawned: boolean;
}

export interface CharmState {
  id: string;
  pos: Vec3Tuple;
  available: boolean;
  respawn_ticks: number;
}

export interface WindState {
  active: boolean;
  warning: boolean;
  dir_deg: number;
  ticks_left: number;
}

export type ContractEventName =
  | 'night_start'
  | 'mote_picked'
  | 'charm_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'refuel'
  | 'lantern_out'
  | 'fuel_drain'
  | 'pulse'
  | 'dash'
  | 'drifter_steal'
  | 'drifter_drop'
  | 'player_hit'
  | 'shade_spawned'
  | 'paused'
  | 'resumed'
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
  night: NightNumber;
  state: GameStatus;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3Tuple;
    vel: Vec3Tuple;
    flames: number;
    carried: number;
    capacity: number;
    grounded: boolean;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3Tuple;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
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
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3Tuple;
    state: DrifterBehaviorState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
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
  pause: boolean;
}

export interface WorldState {
  seed: number;
  night: NightNumber;
  rngState: number;
  tuning: TuningConfig;
  tick: number;
  sim_tick: number;
  initial_time_left_s: number;
  time_left_s: number;
  state: GameStatus;
  paused: boolean;
  night_started_emitted: boolean;
  score: number;
  wind_enabled: boolean;
  wind: WindState;
  player: PlayerState;
  motes: MoteState[];
  lanterns: LanternState[];
  shades: ShadeState[];
  drifters: DrifterState[];
  charms: CharmState[];
  next_mote_seq: number;
  next_shade_seq: number;
  next_drifter_seq: number;
  random_motes: boolean;
  random_shades: boolean;
  random_drifters: boolean;
  prev_buttons: ButtonState;
  last_events: ContractEvent[];
  last_pulse_tick: number;
}
