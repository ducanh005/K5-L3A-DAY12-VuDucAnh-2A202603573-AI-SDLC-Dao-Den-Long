import { getMapSpec, getSupportY, isBlockedByObstacle } from './maps.js';
import { nextRandom, nextRange, normalizeSeed } from './rng.js';
import type {
  CharmState,
  ContractEvent,
  DrifterState,
  InputState,
  LanternState,
  MoteState,
  NightNumber,
  ScenarioConfig,
  ShadeState,
  SnapshotRecord,
  TuningConfig,
  Vec3Tuple,
  WorldState,
} from './types.js';

export const FIXED_DT = 1 / 60;
const JUMP_VELOCITY = 7.0;
const GRAVITY = 20.0;
const CHARM_SPEED = 7.2;
const INVULN_TICKS = 90;
const DASH_TICKS = 12;
const DASH_COOLDOWN_TICKS = 90;
const PULSE_STUN_TICKS = 120;
const PULSE_PUSH_TICKS = 15;
const PULSE_COOLDOWN_TICKS = 180;
const CHARM_DURATION_TICKS = 600;
const CHARM_RESPAWN_TICKS = 2700;
const DROPPED_MOTE_TTL_TICKS = 480;
const FALL_WAIT_TICKS = 60;
const RECOIL_TICKS = 60;
const RECOIL_DIST = 2.0;
const LANTERN_REPEL_TICKS = 30;
const DRIFTER_FLEE_TICKS = 240;
const DRIFTER_DROP_FLEE_TICKS = 120;
const INITIAL_MOTE_COUNT = 20;
const MAX_MOTE_COUNT = 30;
const MOTE_SPAWN_INTERVAL = 240;
const SHADE_DETECT_DIST = 12;
const SHADE_LOSE_DIST = 18;
const SHADE_WANDER_SPEED = 1.5;
const DRIFTER_IDLE_SPEED = 2.0;
const DRIFTER_SPEED = 7.0;
const DRIFTER_DETECT_DIST = 15;
const DRIFTER_STEAL_RADIUS = 1.2;
const DRIFTER_SPAWN_INTERVAL = 1200;
const MAX_DRIFTERS = 2;
const WIND_CYCLE_TICKS = 1800;
const WIND_WARN_OFFSET = 1680;
const WIND_DURATION_TICKS = 300;
const WIND_PUSH_SPEED = 2.0;

export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export function round3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return v === 0 ? 0 : v;
}

export function roundVec3(v: Vec3Tuple): Vec3Tuple {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distanceXZ(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function distance3D(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normDirXZ(dx: number, dz: number, fallback: [number, number] = [1, 0]): [number, number] {
  const len = Math.hypot(dx, dz);
  return len > 1e-6 ? [dx / len, dz / len] : fallback;
}

function compareEntityId(a: { id: string }, b: { id: string }): number {
  const pa = a.id.charAt(0);
  const pb = b.id.charAt(0);
  if (pa !== pb) return pa.localeCompare(pb);
  const na = Number(a.id.slice(1));
  const nb = Number(b.id.slice(1));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.id.localeCompare(b.id);
}

function enforceSafeRadiusXZ(
  night: NightNumber,
  pos: Vec3Tuple,
  lanterns: LanternState[],
  safeRadius: number,
): Vec3Tuple {
  let x = pos[0];
  let z = pos[2];
  for (const l of lanterns) {
    if (!l.lit || Math.abs(pos[1] - l.pos[1]) > 3.5) continue;
    const dx = x - l.pos[0];
    const dz = z - l.pos[2];
    const dist = Math.hypot(dx, dz);
    if (dist < safeRadius) {
      const [ux, uz] = normDirXZ(dx, dz, [1, 0]);
      const candX = l.pos[0] + ux * safeRadius;
      const candZ = l.pos[2] + uz * safeRadius;
      if (!isBlockedByObstacle(night, candX, candZ, pos[1]) && getSupportY(night, candX, candZ, pos[1]) !== null) {
        x = candX;
        z = candZ;
      }
    }
  }
  return [x, pos[1], z];
}

function moveWithObstacles(
  night: NightNumber,
  pos: Vec3Tuple,
  dx: number,
  dz: number,
  allowVoid: boolean,
): Vec3Tuple {
  const nx = pos[0] + dx;
  const nz = pos[2] + dz;

  const canEnter = (x: number, z: number): boolean => {
    if (isBlockedByObstacle(night, x, z, pos[1])) return false;
    if (!allowVoid && getSupportY(night, x, z, pos[1]) === null) return false;
    return true;
  };

  if (canEnter(nx, nz)) {
    return [nx, pos[1], nz];
  }
  if (canEnter(nx, pos[2])) {
    return [nx, pos[1], pos[2]];
  }
  if (canEnter(pos[0], nz)) {
    return [pos[0], pos[1], nz];
  }
  return pos;
}

export interface CreateWorldOptions {
  seed?: number;
  night?: NightNumber;
  tuning?: TuningConfig;
  scenario?: ScenarioConfig;
}

/**
 * Creates a deterministic initial WorldState for Night 1, 2, or 3 conforming to Contract v1.1.
 */
export function createWorld(options: CreateWorldOptions = {}): WorldState {
  const seed = options.seed ?? 2026;
  const night: NightNumber = options.night ?? 1;
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const scenario = options.scenario;
  const mapSpec = getMapSpec(night);
  let rngState = normalizeSeed(seed);

  const lanterns: LanternState[] = mapSpec.lanterns.map((spec) => ({
    id: spec.id,
    pos: [spec.pos[0], spec.pos[1], spec.pos[2]],
    lit: false,
    deposited: 0,
  }));

  if (scenario?.lanterns) {
    for (const override of scenario.lanterns) {
      const target = lanterns.find((l) => l.id === override.id);
      if (!target) continue;
      if (override.pos) {
        target.pos = [override.pos[0], override.pos[1], override.pos[2]];
      }
      if (typeof override.deposited === 'number') {
        target.deposited = Math.max(0, override.deposited);
      }
      if (typeof override.lit === 'boolean') {
        target.lit = override.lit;
        if (override.lit && override.deposited === undefined && target.deposited < tuning.lantern_cost) {
          target.deposited = tuning.lantern_cost;
        }
      } else if (target.deposited >= tuning.lantern_cost) {
        target.lit = true;
      }
    }
  }

  const playerPos: Vec3Tuple = scenario?.player?.pos
    ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
    : [mapSpec.spawnPos[0], mapSpec.spawnPos[1], mapSpec.spawnPos[2]];

  // Motes setup
  let motes: MoteState[] = [];
  if (scenario?.motes !== undefined) {
    motes = scenario.motes.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return {
          id: `M${idx + 1}`,
          pos: [entry[0], entry[1], entry[2]],
          kind: 'random',
          ttl_ticks: null,
          just_spawned: false,
        };
      }
      const ttl = entry.ttl_s !== undefined && entry.ttl_s !== null ? Math.round(entry.ttl_s * 60) : null;
      return {
        id: entry.id ?? `M${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        kind: entry.kind ?? 'random',
        ttl_ticks: ttl,
        just_spawned: false,
      };
    });
  } else if (scenario?.random_motes !== false) {
    const indices = mapSpec.moteSpawnPoints.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      let rVal: number;
      [rVal, rngState] = nextRandom(rngState);
      const j = Math.floor(rVal * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const count = Math.min(INITIAL_MOTE_COUNT, indices.length);
    for (let i = 0; i < count; i++) {
      const pt = mapSpec.moteSpawnPoints[indices[i]];
      motes.push({
        id: `M${i + 1}`,
        pos: [pt[0], pt[1], pt[2]],
        kind: 'random',
        ttl_ticks: null,
        just_spawned: false,
      });
    }
  }

  // Shades setup (empty at tick 0 unless overridden by scenario; scheduled spawn starts at tick 300)
  let shades: ShadeState[] = [];
  if (scenario?.shades !== undefined) {
    shades = scenario.shades.map((entry, idx) => {
      const pos: Vec3Tuple = Array.isArray(entry)
        ? [entry[0], entry[1], entry[2]]
        : [entry.pos[0], entry.pos[1], entry.pos[2]];
      const defaultState = distanceXZ(playerPos, pos) <= SHADE_DETECT_DIST ? 'chase' : 'wander';
      const st = Array.isArray(entry) ? defaultState : (entry.state ?? defaultState);
      const stTicks = Array.isArray(entry) ? 0 : (entry.state_ticks_left ?? 0);
      return {
        id: (Array.isArray(entry) ? undefined : entry.id) ?? `S${idx + 1}`,
        pos,
        state: st,
        state_ticks_left: stTicks,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [1, 0],
        repel_lantern_id: null,
        repel_ticks_left: 0,
        wander_angle: idx * 1.1,
      };
    });
  }

  // Drifters setup (empty at tick 0 unless overridden; scheduled spawn at tick 1200, 2400... on Night 2/3)
  let drifters: DrifterState[] = [];
  if (scenario?.drifters !== undefined) {
    drifters = scenario.drifters.map((d, idx) => ({
      id: d.id ?? `D${idx + 1}`,
      pos: [d.pos[0], d.pos[1], d.pos[2]],
      state: d.state ?? 'idle',
      state_ticks_left: d.state === 'flee' ? DRIFTER_FLEE_TICKS : 0,
      stolen: d.stolen ?? 0,
      has_stolen: (d.stolen ?? 0) > 0,
      orbit_angle: idx * 1.5,
      just_spawned: false,
    }));
  }

  // Charms setup
  let charms: CharmState[] = mapSpec.charmPositions.map((c) => ({
    id: c.id,
    pos: [c.pos[0], c.pos[1], c.pos[2]],
    available: true,
    respawn_ticks: 0,
  }));
  if (scenario?.charms !== undefined) {
    charms = scenario.charms.map((c, idx) => {
      const id = c.id ?? `C${idx + 1}`;
      const mapMatch = mapSpec.charmPositions.find((mc) => mc.id === id);
      const pos: Vec3Tuple = c.pos
        ? [c.pos[0], c.pos[1], c.pos[2]]
        : mapMatch
          ? [mapMatch.pos[0], mapMatch.pos[1], mapMatch.pos[2]]
          : [0, 0, 0];
      return {
        id,
        pos,
        available: c.available ?? true,
        respawn_ticks: c.respawn_s !== undefined ? Math.round(c.respawn_s * 60) : 0,
      };
    });
  }

  const supportAtStart = getSupportY(night, playerPos[0], playerPos[2], playerPos[1]);
  const groundedStart = supportAtStart !== null && Math.abs(playerPos[1] - supportAtStart) <= 0.05;
  const initialTimeLeft = scenario?.time_left_s ?? mapSpec.duration_s;

  return {
    seed,
    night,
    rngState,
    tuning,
    tick: 0,
    sim_tick: 0,
    initial_time_left_s: initialTimeLeft,
    time_left_s: initialTimeLeft,
    state: 'playing',
    paused: false,
    night_started_emitted: false,
    score: 0,
    wind_enabled: scenario?.wind_enabled ?? night === 3,
    wind: { active: false, warning: false, dir_deg: 0, ticks_left: 0 },
    player: {
      pos: playerPos,
      vel: [0, 0, 0],
      yaw_rad: 0,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      grounded: groundedStart,
      invuln_ticks: scenario?.player?.invuln_ticks ?? 0,
      dash_cd_ticks: scenario?.player?.dash_cd_ticks ?? 0,
      dash_ticks_left: 0,
      dash_dir: [0, 1],
      pulse_cd_ticks: scenario?.player?.pulse_cd_ticks ?? 0,
      charm_ticks: scenario?.player?.charm_ticks ?? 0,
      fall_wait_ticks: 0,
      launch_active: false,
      launch_vel_xz: [0, 0],
    },
    motes,
    lanterns,
    shades,
    drifters,
    charms,
    next_mote_seq: motes.length + 1,
    next_shade_seq: shades.length + 1,
    next_drifter_seq: drifters.length + 1,
    random_motes: scenario?.random_motes ?? true,
    random_shades: scenario?.random_shades ?? true,
    random_drifters: scenario?.random_drifters ?? true,
    prev_buttons: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    last_events: [],
    last_pulse_tick: -999,
  };
}

/**
 * Advances the simulation by one fixed 1/60s tick obeying Ticket-02's strict 12-step order.
 */
export function stepWorld(
  world: WorldState,
  input: InputState,
  dt: number = FIXED_DT,
): WorldState {
  if (world.state === 'won' || world.state === 'lost') {
    return { ...world, last_events: [] };
  }

  const nextTick = world.tick + 1;
  const events: ContractEvent[] = [];

  // === Step 1: Read input & handle pause ===
  const pausePressed = input.pause && !world.prev_buttons.pause;
  const jumpPressed = input.jump && !world.prev_buttons.jump;
  const interactPressed = input.interact && !world.prev_buttons.interact;
  const pulsePressed = input.pulse && !world.prev_buttons.pulse;
  const dashPressed = input.dash && !world.prev_buttons.dash;

  const nextPrevButtons = {
    jump: input.jump,
    interact: input.interact,
    pulse: input.pulse,
    dash: input.dash,
    pause: input.pause,
  };

  if (pausePressed) {
    if (!world.paused) {
      events.push({ type: 'event', tick: nextTick, name: 'paused', data: {} });
      return {
        ...world,
        tick: nextTick,
        paused: true,
        state: 'paused',
        prev_buttons: nextPrevButtons,
        last_events: events,
      };
    }
    events.push({ type: 'event', tick: nextTick, name: 'resumed', data: {} });
  } else if (world.paused) {
    return {
      ...world,
      tick: nextTick,
      prev_buttons: nextPrevButtons,
      last_events: [],
    };
  }

  let nightStarted = world.night_started_emitted;
  if (!nightStarted) {
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'night_start',
      data: { night: world.night },
    });
    nightStarted = true;
  }

  // === Step 2: Decrement counters ===
  const tuning = world.tuning;
  const mapSpec = getMapSpec(world.night);
  const nextSimTick = world.sim_tick + 1;
  const nextTimeLeft = Math.max(0, world.initial_time_left_s - nextSimTick / 60);
  let rngState = world.rngState;
  let score = world.score;

  let invulnTicks = Math.max(0, world.player.invuln_ticks - 1);
  let dashCdTicks = Math.max(0, world.player.dash_cd_ticks - 1);
  let dashTicksLeft = Math.max(0, world.player.dash_ticks_left - 1);
  let pulseCdTicks = Math.max(0, world.player.pulse_cd_ticks - 1);
  let charmTicks = Math.max(0, world.player.charm_ticks - 1);
  let fallWaitTicks = world.player.fall_wait_ticks;

  let px = world.player.pos[0];
  let py = world.player.pos[1];
  let pz = world.player.pos[2];
  let vx = world.player.vel[0];
  let vy = world.player.vel[1];
  let vz = world.player.vel[2];
  let yawRad = world.player.yaw_rad;
  let grounded = world.player.grounded;
  let flames = world.player.flames;
  let carried = world.player.carried;
  let dashDir: [number, number] = [world.player.dash_dir[0], world.player.dash_dir[1]];
  let launchActive = world.player.launch_active;
  let launchVelXZ: [number, number] = [world.player.launch_vel_xz[0], world.player.launch_vel_xz[1]];

  const invulnDurationTicks = Math.max(1, Math.round(tuning.invuln_s * 60));
  const dashDurationTicks = Math.max(1, Math.round(tuning.dash_duration_s * 60));
  const dashCooldownTicks = Math.max(0, Math.round(tuning.dash_cooldown_s * 60));
  const pulseStunDurationTicks = Math.max(1, Math.round(tuning.pulse_stun_s * 60));
  const pulseCooldownTicks = Math.max(0, Math.round(tuning.pulse_cooldown_s * 60));

  let justRespawned = false;
  if (fallWaitTicks > 0) {
    fallWaitTicks -= 1;
    if (fallWaitTicks === 0) {
      px = mapSpec.spawnPos[0];
      py = mapSpec.spawnPos[1];
      pz = mapSpec.spawnPos[2];
      vx = 0;
      vy = 0;
      vz = 0;
      yawRad = 0;
      grounded = true;
      invulnTicks = invulnDurationTicks;
      launchActive = false;
      justRespawned = true;
    }
  }

  let nextMotes: MoteState[] = [];
  for (const m of world.motes) {
    let nextTtl = m.ttl_ticks;
    if (nextTtl !== null) {
      nextTtl -= 1;
      if (nextTtl <= 0) continue;
    }
    nextMotes.push({
      ...m,
      pos: [m.pos[0], m.pos[1], m.pos[2]],
      ttl_ticks: nextTtl,
      just_spawned: false,
    });
  }

  const nextCharms: CharmState[] = world.charms.map((c) => {
    if (!c.available && c.respawn_ticks > 0) {
      const rem = c.respawn_ticks - 1;
      return {
        ...c,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: rem === 0,
        respawn_ticks: rem,
      };
    }
    return { ...c, pos: [c.pos[0], c.pos[1], c.pos[2]] };
  });

  const nextShades: ShadeState[] = world.shades.map((s) => {
    let state = s.state;
    let stateTicks = Math.max(0, s.state_ticks_left - 1);
    const pushTicks = Math.max(0, s.push_ticks_left - 1);
    let repelTicks = Math.max(0, s.repel_ticks_left - 1);
    let repelId = repelTicks > 0 ? s.repel_lantern_id : null;

    if (s.state_ticks_left > 0 && stateTicks === 0) {
      if (state === 'spawning' || state === 'stunned') {
        state = distanceXZ([px, py, pz], s.pos) <= SHADE_DETECT_DIST ? 'chase' : 'wander';
      } else if (state === 'recoil') {
        state = distanceXZ([px, py, pz], s.pos) <= SHADE_LOSE_DIST ? 'chase' : 'wander';
      }
    }

    return {
      ...s,
      pos: [s.pos[0], s.pos[1], s.pos[2]],
      state,
      state_ticks_left: stateTicks,
      push_ticks_left: pushTicks,
      repel_lantern_id: repelId,
      repel_ticks_left: repelTicks,
    };
  });

  let nextDrifters: DrifterState[] = [];
  for (const d of world.drifters) {
    if (d.state === 'flee' && d.state_ticks_left > 0) {
      const rem = d.state_ticks_left - 1;
      if (rem <= 0) continue; // removed
      nextDrifters.push({
        ...d,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        state_ticks_left: rem,
        just_spawned: false,
      });
    } else {
      nextDrifters.push({
        ...d,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        just_spawned: false,
      });
    }
  }

  // Wind schedule for Night 3
  const nextWind = { ...world.wind };
  if (world.night === 3 && world.wind_enabled) {
    const modTick = nextSimTick % WIND_CYCLE_TICKS;
    if (modTick === WIND_WARN_OFFSET) {
      let randVal: number;
      [randVal, rngState] = nextRandom(rngState);
      nextWind.dir_deg = round3(randVal * 360);
      nextWind.warning = true;
      nextWind.active = false;
    } else if (nextSimTick > 0 && modTick === 0) {
      nextWind.warning = false;
      nextWind.active = true;
      nextWind.ticks_left = WIND_DURATION_TICKS;
    } else if (nextWind.active && nextWind.ticks_left > 0) {
      nextWind.ticks_left -= 1;
      if (nextWind.ticks_left === 0) {
        nextWind.active = false;
      }
    }
  } else {
    nextWind.active = false;
    nextWind.warning = false;
    nextWind.ticks_left = 0;
  }

  // === Step 3: Player movement, jump, dash, jump pad, wind, fall check ===
  if (fallWaitTicks === 0 && !justRespawned) {
    let mx = input.move[0];
    let mz = input.move[1];
    const moveLen = Math.hypot(mx, mz);
    if (moveLen > 1) {
      mx /= moveLen;
      mz /= moveLen;
    }

    const theta = (input.cam_yaw_deg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const wx = mx * cosT + mz * sinT;
    const wz = -mx * sinT + mz * cosT;
    const hasMoveInput = Math.hypot(wx, wz) > 1e-5;

    if (hasMoveInput) {
      yawRad = Math.atan2(wx, wz);
    }

    if (dashPressed && dashTicksLeft === 0 && (dashCdTicks === 0 || charmTicks > 0)) {
      dashTicksLeft = dashDurationTicks;
      dashCdTicks = charmTicks > 0 ? 0 : dashCooldownTicks;
      dashDir = hasMoveInput
        ? normDirXZ(wx, wz)
        : normDirXZ(Math.sin(yawRad), Math.cos(yawRad), [0, 1]);
      launchActive = false;
      events.push({ type: 'event', tick: nextTick, name: 'dash', data: {} });
    }

    if (dashTicksLeft > 0) {
      vx = dashDir[0] * tuning.dash_speed;
      vz = dashDir[1] * tuning.dash_speed;
      vy = 0;
    } else {
      if (launchActive) {
        vx = launchVelXZ[0];
        vz = launchVelXZ[1];
      } else {
        const moveSpeed = charmTicks > 0 ? CHARM_SPEED : tuning.player_speed;
        vx = wx * moveSpeed;
        vz = wz * moveSpeed;
      }

      if (nextWind.active) {
        const wRad = (nextWind.dir_deg * Math.PI) / 180;
        vx += Math.cos(wRad) * WIND_PUSH_SPEED;
        vz += Math.sin(wRad) * WIND_PUSH_SPEED;
      }

      if (jumpPressed && grounded) {
        vy = JUMP_VELOCITY;
        grounded = false;
      }
      if (!grounded) {
        vy -= GRAVITY * dt;
      }
    }

    const movedPos = moveWithObstacles(world.night, [px, py, pz], vx * dt, vz * dt, true);
    px = movedPos[0];
    pz = movedPos[2];

    if (dashTicksLeft > 0) {
      // Keep altitude during dash unless ground rises beneath onto a ramp
      const sup = getSupportY(world.night, px, pz, py);
      if (sup !== null && py < sup) {
        py = sup;
        grounded = true;
      } else {
        grounded = sup !== null && Math.abs(py - sup) <= 0.05;
      }
    } else {
      const ny = py + vy * dt;
      const sup = getSupportY(world.night, px, pz, py);
      if (sup !== null && ny <= sup && vy <= 0) {
        py = sup;
        vy = 0;
        grounded = true;
        launchActive = false;
      } else if (sup !== null && grounded && Math.abs(py - sup) <= 0.35 && vy === 0) {
        py = sup;
        grounded = true;
      } else {
        py = ny;
        grounded = false;
      }

      // Check Jump Pads
      for (const pad of mapSpec.jumpPads) {
        if (
          Math.hypot(px - pad.pos[0], pz - pad.pos[2]) <= pad.radius &&
          Math.abs(py - pad.pos[1]) <= 0.5 &&
          vy <= 0.1
        ) {
          vy = pad.vy;
          grounded = false;
          launchActive = true;
          launchVelXZ = [pad.dirXZ[0] * pad.vh, pad.dirXZ[1] * pad.vh];
          vx = launchVelXZ[0];
          vz = launchVelXZ[1];
          break;
        }
      }
    }

    // Fall out of island check (Y < -10)
    if (tuning.fall_enabled && py < -10) {
      const lost = carried;
      carried = 0;
      flames = Math.max(0, flames - 1);
      vx = 0;
      vy = 0;
      vz = 0;
      dashTicksLeft = 0;
      launchActive = false;
      grounded = false;
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'player_hit',
        data: { by: 'fall', flames, dropped: 0, lost },
      });
      if (flames > 0) {
        fallWaitTicks = FALL_WAIT_TICKS;
      }
    }
  }

  const playerPos: Vec3Tuple = [px, py, pz];

  // === Step 4: Pickup motes and Wind Charms ===
  if (fallWaitTicks === 0 && py >= -10) {
    const remainingMotes: MoteState[] = [];
    for (const mote of nextMotes) {
      if (
        !mote.just_spawned &&
        carried < tuning.carry_capacity &&
        distanceXZ(playerPos, mote.pos) <= tuning.pickup_radius &&
        Math.abs(playerPos[1] - mote.pos[1]) <= 1.5
      ) {
        carried += 1;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'mote_picked',
          data: { carried },
        });
      } else {
        remainingMotes.push(mote);
      }
    }
    nextMotes = remainingMotes;

    for (const charm of nextCharms) {
      if (
        charm.available &&
        distanceXZ(playerPos, charm.pos) <= tuning.pickup_radius &&
        Math.abs(playerPos[1] - charm.pos[1]) <= 1.5
      ) {
        charm.available = false;
        charm.respawn_ticks = CHARM_RESPAWN_TICKS;
        charmTicks = CHARM_DURATION_TICKS;
        dashCdTicks = 0;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'charm_picked',
          data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS },
        });
      }
    }
  }

  // === Step 5: Interact with Great Lanterns ===
  const nextLanterns: LanternState[] = world.lanterns.map((l) => ({ ...l }));
  if (fallWaitTicks === 0 && interactPressed && carried > 0) {
    const candidates = nextLanterns
      .filter(
        (l) =>
          !l.lit &&
          distanceXZ(playerPos, l.pos) <= tuning.interact_radius &&
          Math.abs(playerPos[1] - l.pos[1]) <= 2.0,
      )
      .sort((a, b) => {
        const da = distanceXZ(playerPos, a.pos);
        const db = distanceXZ(playerPos, b.pos);
        if (Math.abs(da - db) > 1e-6) return da - db;
        return a.id.localeCompare(b.id);
      });

    const target = candidates[0];
    if (target) {
      const amount = Math.min(carried, tuning.lantern_cost - target.deposited);
      if (amount > 0) {
        carried -= amount;
        target.deposited += amount;
        score += amount * tuning.score.per_mote;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'deposit',
          data: { lantern_id: target.id, amount, deposited: target.deposited },
        });
        if (target.deposited >= tuning.lantern_cost) {
          target.lit = true;
          score += tuning.score.per_lantern;
          for (const shade of nextShades) {
            if (distanceXZ(shade.pos, target.pos) < tuning.safe_radius) {
              shade.repel_lantern_id = target.id;
              shade.repel_ticks_left = LANTERN_REPEL_TICKS;
            }
          }
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'lantern_lit',
            data: { lantern_id: target.id },
          });
        }
      }
    }
  }

  // === Step 6: Update safe_radius ===
  for (const shade of nextShades) {
    if (shade.state === 'spawning') continue;
    if (shade.repel_ticks_left > 0 && shade.repel_lantern_id) {
      const lantern = nextLanterns.find((l) => l.id === shade.repel_lantern_id);
      if (lantern) {
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < tuning.safe_radius) {
          const [ux, uz] = normDirXZ(dx, dz, [1, 0]);
          const step = (tuning.safe_radius - d) / shade.repel_ticks_left;
          const nextD = Math.min(tuning.safe_radius, d + Math.max(step, 0.25));
          shade.pos = [lantern.pos[0] + ux * nextD, shade.pos[1], lantern.pos[2] + uz * nextD];
        } else {
          shade.repel_ticks_left = 0;
          shade.repel_lantern_id = null;
        }
      }
    } else {
      shade.pos = enforceSafeRadiusXZ(world.night, shade.pos, nextLanterns, tuning.safe_radius);
    }
  }

  // === Step 7: Pulse (Tỏa Sáng) ===
  let nextMoteSeq = world.next_mote_seq;
  let lastPulseTick = world.last_pulse_tick;
  if (fallWaitTicks === 0 && pulsePressed && carried >= tuning.pulse_cost && pulseCdTicks === 0) {
    carried -= tuning.pulse_cost;
    pulseCdTicks = pulseCooldownTicks;
    lastPulseTick = nextSimTick;

    const pulseCenter: Vec3Tuple = [playerPos[0], playerPos[1] + 0.8, playerPos[2]];
    const stunnedIds: string[] = [];

    for (const shade of nextShades) {
      if (shade.state === 'spawning') continue;
      if (distance3D(pulseCenter, shade.pos) <= tuning.pulse_radius) {
        stunnedIds.push(shade.id);
        shade.state = 'stunned';
        shade.state_ticks_left = pulseStunDurationTicks;
        shade.push_ticks_left = PULSE_PUSH_TICKS;
        shade.push_dir = normDirXZ(shade.pos[0] - playerPos[0], shade.pos[2] - playerPos[2], [1, 0]);
        score += tuning.score.per_stun;
      }
    }

    for (const drifter of nextDrifters) {
      if (drifter.just_spawned) continue;
      if (distance3D(pulseCenter, drifter.pos) <= tuning.pulse_radius) {
        if (drifter.state === 'chase') {
          drifter.state = 'flee';
          drifter.state_ticks_left = DRIFTER_FLEE_TICKS;
        } else if (drifter.state === 'flee' && drifter.stolen > 0) {
          const dropCount = drifter.stolen;
          const dropCenterFloor = getSupportY(world.night, drifter.pos[0], drifter.pos[2], drifter.pos[1]);
          for (let i = 0; i < dropCount; i++) {
            const ang = (i / Math.max(1, dropCount)) * Math.PI * 2;
            let mx = drifter.pos[0] + Math.cos(ang) * 0.6;
            let mz = drifter.pos[2] + Math.sin(ang) * 0.6;
            let dropFloor = getSupportY(world.night, mx, mz, (dropCenterFloor ?? 0) + 0.5);
            if (dropFloor === null) {
              mx = dropCenterFloor !== null ? drifter.pos[0] : playerPos[0];
              mz = dropCenterFloor !== null ? drifter.pos[2] : playerPos[2];
              dropFloor = dropCenterFloor ?? (getSupportY(world.night, playerPos[0], playerPos[2], playerPos[1]) ?? 0);
            }
            nextMotes.push({
              id: `M${nextMoteSeq++}`,
              pos: [mx, dropFloor, mz],
              kind: 'dropped',
              ttl_ticks: DROPPED_MOTE_TTL_TICKS,
              just_spawned: true,
            });
          }
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'drifter_drop',
            data: { drifter_id: drifter.id, amount: dropCount },
          });
          drifter.stolen = 0;
          drifter.state_ticks_left = DRIFTER_DROP_FLEE_TICKS;
        }
      }
    }

    events.push({
      type: 'event',
      tick: nextTick,
      name: 'pulse',
      data: { stunned_ids: stunnedIds },
    });
  }

  // === Step 8: Move Shades & Drifters ===
  const shadeSpeed = world.night === 3 ? 4.5 : tuning.shade_speed;
  for (const shade of nextShades) {
    if (shade.state === 'spawning') continue;

    if (shade.push_ticks_left > 0) {
      const pushStep = tuning.pulse_push_m / PULSE_PUSH_TICKS;
      shade.pos = moveWithObstacles(
        world.night,
        shade.pos,
        shade.push_dir[0] * pushStep,
        shade.push_dir[1] * pushStep,
        false,
      );
    }

    if (shade.state === 'stunned') {
      // Stunned shades do not chase
    } else if (shade.state === 'recoil') {
      const recoilStep = RECOIL_DIST / RECOIL_TICKS;
      shade.pos = moveWithObstacles(
        world.night,
        shade.pos,
        shade.recoil_dir[0] * recoilStep,
        shade.recoil_dir[1] * recoilStep,
        false,
      );
    } else if (shade.state === 'chase') {
      const dist = distanceXZ(playerPos, shade.pos);
      if (dist > SHADE_LOSE_DIST) {
        shade.state = 'wander';
      } else if (dist > 1e-6) {
        const step = Math.min(dist, shadeSpeed * dt);
        const [ux, uz] = normDirXZ(playerPos[0] - shade.pos[0], playerPos[2] - shade.pos[2]);
        shade.pos = moveWithObstacles(world.night, shade.pos, ux * step, uz * step, false);
      }
    } else if (shade.state === 'wander') {
      const dist = distanceXZ(playerPos, shade.pos);
      if (dist <= SHADE_DETECT_DIST) {
        shade.state = 'chase';
      } else {
        shade.wander_angle += 0.025;
        const step = SHADE_WANDER_SPEED * dt;
        shade.pos = moveWithObstacles(
          world.night,
          shade.pos,
          Math.cos(shade.wander_angle) * step,
          Math.sin(shade.wander_angle) * step,
          false,
        );
      }
    }

    if (shade.repel_ticks_left === 0) {
      shade.pos = enforceSafeRadiusXZ(world.night, shade.pos, nextLanterns, tuning.safe_radius);
    }
  }

  for (const drifter of nextDrifters) {
    if (drifter.just_spawned) continue;
    if (drifter.state === 'idle' || drifter.state === 'chase') {
      const dist = distanceXZ(playerPos, drifter.pos);
      drifter.state = carried >= 5 && dist <= DRIFTER_DETECT_DIST ? 'chase' : 'idle';
    }

    if (drifter.state === 'idle') {
      drifter.orbit_angle += 0.04;
      const step = DRIFTER_IDLE_SPEED * dt;
      drifter.pos = [
        drifter.pos[0] + Math.cos(drifter.orbit_angle) * step,
        drifter.pos[1],
        drifter.pos[2] + Math.sin(drifter.orbit_angle) * step,
      ];
    } else if (drifter.state === 'chase') {
      const dist = distanceXZ(playerPos, drifter.pos);
      if (dist > 1e-6) {
        const step = Math.min(dist, DRIFTER_SPEED * dt);
        const [ux, uz] = normDirXZ(playerPos[0] - drifter.pos[0], playerPos[2] - drifter.pos[2]);
        drifter.pos = [
          drifter.pos[0] + ux * step,
          drifter.pos[1],
          drifter.pos[2] + uz * step,
        ];
      }
    } else if (drifter.state === 'flee') {
      const [ux, uz] = normDirXZ(drifter.pos[0] - playerPos[0], drifter.pos[2] - playerPos[2], [1, 0]);
      const step = DRIFTER_SPEED * dt;
      drifter.pos = [
        drifter.pos[0] + ux * step,
        drifter.pos[1],
        drifter.pos[2] + uz * step,
      ];
    }
  }

  // === Step 9: Collisions — Drifters steal first, then Shades hit (ascending id) ===
  if (fallWaitTicks === 0 && py >= -10) {
    const sortedDrifters = [...nextDrifters].sort(compareEntityId);
    for (const drifter of sortedDrifters) {
      if (
        !drifter.just_spawned &&
        !drifter.has_stolen &&
        drifter.state !== 'flee' &&
        carried >= 5 &&
        distanceXZ(playerPos, drifter.pos) <= DRIFTER_STEAL_RADIUS &&
        Math.abs(playerPos[1] - drifter.pos[1]) <= 2.0
      ) {
        const amount = Math.min(3, carried);
        carried -= amount;
        drifter.stolen = amount;
        drifter.has_stolen = true;
        drifter.state = 'flee';
        drifter.state_ticks_left = DRIFTER_FLEE_TICKS;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'drifter_steal',
          data: { drifter_id: drifter.id, amount, carried },
        });
      }
    }

    const sortedShades = [...nextShades].sort(compareEntityId);
    let hitTakenThisTick = false;
    for (const shade of sortedShades) {
      if (hitTakenThisTick || invulnTicks > 0 || flames <= 0) break;
      if (
        (shade.state === 'chase' || shade.state === 'wander') &&
        shade.repel_ticks_left === 0 &&
        distanceXZ(playerPos, shade.pos) <= tuning.shade_hit_radius &&
        Math.abs(playerPos[1] - shade.pos[1]) <= 1.5
      ) {
        hitTakenThisTick = true;
        flames = Math.max(0, flames - 1);
        invulnTicks = invulnDurationTicks;
        const dropped = Math.floor(carried * tuning.hit_drop_ratio);
        carried -= dropped;

        const baseFloorY = getSupportY(world.night, playerPos[0], playerPos[2], playerPos[1]) ?? 0;
        for (let i = 0; i < dropped; i++) {
          let ang: number;
          let ringR: number;
          [ang, rngState] = nextRange(rngState, 0, Math.PI * 2);
          [ringR, rngState] = nextRange(rngState, 1.5, 2.5);
          let mx = playerPos[0] + Math.cos(ang) * ringR;
          let mz = playerPos[2] + Math.sin(ang) * ringR;
          const dropFloor = getSupportY(world.night, mx, mz, baseFloorY + 0.5);
          if (dropFloor === null) {
            mx = playerPos[0];
            mz = playerPos[2];
          }
          nextMotes.push({
            id: `M${nextMoteSeq++}`,
            pos: [mx, dropFloor ?? baseFloorY, mz],
            kind: 'dropped',
            ttl_ticks: DROPPED_MOTE_TTL_TICKS,
            just_spawned: true,
          });
        }

        shade.state = 'recoil';
        shade.state_ticks_left = RECOIL_TICKS;
        shade.recoil_dir = normDirXZ(shade.pos[0] - playerPos[0], shade.pos[2] - playerPos[2], [1, 0]);

        events.push({
          type: 'event',
          tick: nextTick,
          name: 'player_hit',
          data: { by: 'shade', flames, dropped },
        });
      }
    }
  }

  // === Step 10: Scheduled spawns (motes, shades, drifters — interactive from next tick) ===
  if (world.random_motes && nextSimTick % MOTE_SPAWN_INTERVAL === 0 && nextMotes.length < MAX_MOTE_COUNT) {
    const emptyPts = mapSpec.moteSpawnPoints.filter((pt) =>
      nextMotes.every((m) => distanceXZ(m.pos, pt) > 0.5),
    );
    if (emptyPts.length > 0) {
      let rVal: number;
      [rVal, rngState] = nextRandom(rngState);
      const pt = emptyPts[Math.floor(rVal * emptyPts.length)];
      nextMotes.push({
        id: `M${nextMoteSeq++}`,
        pos: [pt[0], pt[1], pt[2]],
        kind: 'random',
        ttl_ticks: null,
        just_spawned: true,
      });
    }
  }

  let nextShadeSeq = world.next_shade_seq;
  if (world.random_shades && nextSimTick >= 300) {
    const shouldSpawnCount =
      nextSimTick === 300
        ? Math.min(2, mapSpec.maxShades - nextShades.length)
        : (nextSimTick - 300) % mapSpec.shadeIntervalTicks === 0 && nextShades.length < mapSpec.maxShades
          ? 1
          : 0;

    for (let k = 0; k < shouldSpawnCount; k++) {
      const validPts = mapSpec.shadeSpawnPoints.filter(
        (pt) =>
          distanceXZ(pt, playerPos) >= 15 &&
          nextLanterns.every((l) => !l.lit || distanceXZ(pt, l.pos) >= tuning.safe_radius) &&
          nextShades.every((s) => distanceXZ(s.pos, pt) > 1.5),
      );
      if (validPts.length === 0) break;
      let rVal: number;
      [rVal, rngState] = nextRandom(rngState);
      const pt = validPts[Math.floor(rVal * validPts.length)];
      const newId = `S${nextShadeSeq++}`;
      nextShades.push({
        id: newId,
        pos: [pt[0], pt[1], pt[2]],
        state: 'spawning',
        state_ticks_left: 1,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [1, 0],
        repel_lantern_id: null,
        repel_ticks_left: 0,
        wander_angle: nextShadeSeq * 0.9,
      });
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'shade_spawned',
        data: { id: newId },
      });
    }
  }

  let nextDrifterSeq = world.next_drifter_seq;
  if (
    world.night >= 2 &&
    world.random_drifters &&
    nextSimTick % DRIFTER_SPAWN_INTERVAL === 0 &&
    nextDrifters.length < MAX_DRIFTERS
  ) {
    const pts = mapSpec.shadeSpawnPoints;
    if (pts.length > 0) {
      let rVal: number;
      [rVal, rngState] = nextRandom(rngState);
      const pt = pts[Math.floor(rVal * pts.length)];
      const newId = `D${nextDrifterSeq++}`;
      nextDrifters.push({
        id: newId,
        pos: [pt[0], pt[1] + 1.0, pt[2]],
        state: 'idle',
        state_ticks_left: 0,
        stolen: 0,
        has_stolen: false,
        orbit_angle: nextDrifterSeq * 1.2,
        just_spawned: true,
      });
    }
  }

  // === Step 11: Evaluate win/loss conditions ===
  let nextState: WorldState['state'] = 'playing';
  if (flames <= 0) {
    nextState = 'lost';
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });
  } else if (nextLanterns.length > 0 && nextLanterns.every((l) => l.lit)) {
    nextState = 'won';
    score +=
      Math.floor(nextTimeLeft) * tuning.score.per_second_left +
      flames * tuning.score.per_flame_left;
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'game_over',
      data: { result: 'won', reason: 'all_lit' },
    });
  } else if (nextTimeLeft <= 0) {
    nextState = 'lost';
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });
  }

  return {
    ...world,
    rngState,
    tick: nextTick,
    sim_tick: nextSimTick,
    time_left_s: nextTimeLeft,
    state: nextState,
    paused: false,
    night_started_emitted: nightStarted,
    score,
    wind: nextWind,
    player: {
      pos: playerPos,
      vel: [vx, vy, vz],
      yaw_rad: yawRad,
      flames,
      carried,
      grounded,
      invuln_ticks: invulnTicks,
      dash_cd_ticks: dashCdTicks,
      dash_ticks_left: dashTicksLeft,
      dash_dir: dashDir,
      pulse_cd_ticks: pulseCdTicks,
      charm_ticks: charmTicks,
      fall_wait_ticks: fallWaitTicks,
      launch_active: launchActive,
      launch_vel_xz: launchVelXZ,
    },
    motes: nextMotes,
    lanterns: nextLanterns,
    shades: nextShades,
    drifters: nextDrifters,
    charms: nextCharms,
    next_mote_seq: nextMoteSeq,
    next_shade_seq: nextShadeSeq,
    next_drifter_seq: nextDrifterSeq,
    prev_buttons: nextPrevButtons,
    last_events: events,
    last_pulse_tick: lastPulseTick,
  };
}

/**
 * Formats a SnapshotRecord conforming strictly to Test Contract v1.1.
 */
export function formatSnapshot(world: WorldState): SnapshotRecord {
  return {
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.sim_tick,
    night: world.night,
    state: world.state,
    time_left_s: round3(world.time_left_s),
    score: world.score,
    wind: {
      active: world.wind.active,
      dir_deg: round3(world.wind.dir_deg),
    },
    player: {
      pos: roundVec3(world.player.pos),
      vel: roundVec3(world.player.vel),
      flames: world.player.flames,
      carried: world.player.carried,
      grounded: world.player.grounded,
      invuln: world.player.invuln_ticks > 0,
      dash_cd_s: round3(world.player.dash_cd_ticks / 60),
      pulse_cd_s: round3(world.player.pulse_cd_ticks / 60),
      charm_s: round3(world.player.charm_ticks / 60),
    },
    lanterns: world.lanterns.map((l) => ({
      id: l.id,
      pos: roundVec3(l.pos),
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: world.shades.map((s) => ({
      id: s.id,
      pos: roundVec3(s.pos),
      state: s.state,
    })),
    motes_active: world.motes.length,
    motes: world.motes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos),
      kind: m.kind,
      ttl_s: m.ttl_ticks !== null ? round3(m.ttl_ticks / 60) : null,
    })),
    drifters: world.drifters.map((d) => ({
      id: d.id,
      pos: roundVec3(d.pos),
      state: d.state,
      stolen: d.stolen,
    })),
    charms: world.charms.map((c) => ({
      id: c.id,
      available: c.available,
      respawn_s: round3(c.respawn_ticks / 60),
    })),
  };
}
