import { nextRange, normalizeSeed } from './rng.js';
import type {
  ContractEvent,
  InputState,
  LanternState,
  MoteState,
  ScenarioConfig,
  ShadeState,
  SnapshotRecord,
  TuningConfig,
  Vec3Tuple,
  WorldState,
} from './types.js';

export const FIXED_DT = 1 / 60;
export const ISLAND_RADIUS = 40;
const LANTERN_RING_RADIUS = 25;
const DEFAULT_RANDOM_MOTE_COUNT = 25;
const DEFAULT_RANDOM_SHADE_COUNT = 3;
const JUMP_VELOCITY = 6.5;
const GRAVITY = 18;

export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 0,
    per_flame_left: 50,
  },
};

function round3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return v === 0 ? 0 : v;
}

function decrementTimer(current: number, dt: number): number {
  const next = current - dt;
  return next <= 1e-9 ? 0 : next;
}

export function roundVec3(v: Vec3Tuple): Vec3Tuple {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distanceXZ(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function clampXZ(pos: Vec3Tuple, maxRadius: number): Vec3Tuple {
  const r = Math.hypot(pos[0], pos[2]);
  if (r <= maxRadius || r === 0) {
    return pos;
  }
  const scale = maxRadius / r;
  return [pos[0] * scale, pos[1], pos[2] * scale];
}

function enforceSafeRadius(pos: Vec3Tuple, lanterns: LanternState[], safeRadius: number): Vec3Tuple {
  let x = pos[0];
  let z = pos[2];
  for (const l of lanterns) {
    if (!l.lit) continue;
    const dx = x - l.pos[0];
    const dz = z - l.pos[2];
    const dist = Math.hypot(dx, dz);
    if (dist < safeRadius) {
      if (dist < 1e-6) {
        x = l.pos[0] + safeRadius;
        z = l.pos[2];
      } else {
        const scale = safeRadius / dist;
        x = l.pos[0] + dx * scale;
        z = l.pos[2] + dz * scale;
      }
    }
  }
  return [x, pos[1], z];
}

export interface CreateWorldOptions {
  seed?: number;
  night?: number;
  tuning?: TuningConfig;
  scenario?: ScenarioConfig;
}

/**
 * Creates a deterministic initial WorldState for Night 1 (Đảo Bến),
 * applying optional scenario overrides without emitting events or awarding score.
 */
export function createWorld(options: CreateWorldOptions = {}): WorldState {
  const seed = options.seed ?? 2026;
  const night = options.night ?? 1;
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const scenario = options.scenario;
  let rngState = normalizeSeed(seed);

  const lanterns: LanternState[] = [];
  for (let i = 0; i < tuning.lantern_count_night1; i++) {
    const angle = (i * 2 * Math.PI) / Math.max(1, tuning.lantern_count_night1);
    lanterns.push({
      id: `L${i + 1}`,
      pos: [
        round3(LANTERN_RING_RADIUS * Math.sin(angle)),
        0,
        round3(LANTERN_RING_RADIUS * Math.cos(angle)),
      ],
      lit: false,
      deposited: 0,
    });
  }

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

  let motes: MoteState[] = [];
  if (scenario?.motes !== undefined) {
    motes = scenario.motes.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return { id: `M${idx + 1}`, pos: [entry[0], entry[1], entry[2]], active: true };
      }
      return {
        id: entry.id ?? `M${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        active: true,
      };
    });
  } else if (scenario?.random_motes !== false) {
    for (let i = 0; i < DEFAULT_RANDOM_MOTE_COUNT; i++) {
      let angle: number;
      let r: number;
      [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
      [r, rngState] = nextRange(rngState, 4, 34);
      motes.push({
        id: `M${i + 1}`,
        pos: [round3(Math.cos(angle) * r), 0, round3(Math.sin(angle) * r)],
        active: true,
      });
    }
  }

  let shades: ShadeState[] = [];
  if (scenario?.shades !== undefined) {
    shades = scenario.shades.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return {
          id: `S${idx + 1}`,
          pos: [entry[0], entry[1], entry[2]],
          state: 'chase',
          stun_left_s: 0,
        };
      }
      return {
        id: entry.id ?? `S${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        state: 'chase',
        stun_left_s: 0,
      };
    });
  } else if (scenario?.random_shades !== false) {
    for (let i = 0; i < DEFAULT_RANDOM_SHADE_COUNT; i++) {
      let angle: number;
      let r: number;
      [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
      [r, rngState] = nextRange(rngState, 18, 30);
      shades.push({
        id: `S${i + 1}`,
        pos: [round3(Math.cos(angle) * r), 1.0, round3(Math.sin(angle) * r)],
        state: 'chase',
        stun_left_s: 0,
      });
    }
  }

  const playerPos: Vec3Tuple = scenario?.player?.pos
    ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
    : [0, 0, 0];

  const initialTimeLeft = scenario?.time_left_s ?? tuning.night1_duration_s;

  let maxEntityDist = ISLAND_RADIUS;
  for (const l of lanterns) {
    maxEntityDist = Math.max(maxEntityDist, Math.hypot(l.pos[0], l.pos[2]) + 10);
  }
  for (const m of motes) {
    maxEntityDist = Math.max(maxEntityDist, Math.hypot(m.pos[0], m.pos[2]) + 10);
  }
  for (const s of shades) {
    maxEntityDist = Math.max(maxEntityDist, Math.hypot(s.pos[0], s.pos[2]) + 10);
  }
  maxEntityDist = Math.max(maxEntityDist, Math.hypot(playerPos[0], playerPos[2]) + 10);

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
    score: 0,
    map_radius: maxEntityDist,
    player: {
      pos: playerPos,
      vy: 0,
      yaw_rad: 0,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      invuln_left_s: 0,
      pulse_cd_left_s: 0,
    },
    motes,
    lanterns,
    shades,
    prev_buttons: { jump: false, interact: false, pulse: false, dash: false },
    last_events: [],
    last_pulse_tick: -999,
  };
}

/**
 * Advances the simulation by exactly one fixed 1/60s step.
 */
export function stepWorld(
  world: WorldState,
  input: InputState,
  dt: number = FIXED_DT,
): WorldState {
  if (world.state !== 'playing') {
    return { ...world, last_events: [] };
  }

  const tuning = world.tuning;
  const nextTick = world.tick + 1;
  const nextTimeLeft = Math.max(0, world.initial_time_left_s - nextTick / 60);
  const events: ContractEvent[] = [];
  let score = world.score;

  // 1. Player timers
  let invulnLeft = decrementTimer(world.player.invuln_left_s, dt);
  let pulseCdLeft = decrementTimer(world.player.pulse_cd_left_s, dt);

  // 2. Player movement rotated by cam_yaw_deg
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

  let px = world.player.pos[0] + wx * tuning.player_speed * dt;
  let py = world.player.pos[1];
  let pz = world.player.pos[2] + wz * tuning.player_speed * dt;

  [px, py, pz] = clampXZ([px, py, pz], world.map_radius);

  const yawRad = Math.hypot(wx, wz) > 1e-5 ? Math.atan2(wx, wz) : world.player.yaw_rad;

  // Jump edge trigger
  const jumpPressed = input.jump && !world.prev_buttons.jump;
  const interactPressed = input.interact && !world.prev_buttons.interact;
  const pulsePressed = input.pulse && !world.prev_buttons.pulse;

  let vy = world.player.vy;
  if (jumpPressed && py <= 0.0001) {
    vy = JUMP_VELOCITY;
  }
  if (py > 0 || vy !== 0) {
    py += vy * dt;
    if (py <= 0) {
      py = 0;
      vy = 0;
    } else {
      vy -= GRAVITY * dt;
    }
  }

  const nextPlayerPos: Vec3Tuple = [px, py, pz];
  let carried = world.player.carried;
  let flames = world.player.flames;
  let lastPulseTick = world.last_pulse_tick;

  // 3. Mote pickup (XZ distance <= pickup_radius)
  const nextMotes: MoteState[] = world.motes.map((mote) => {
    if (
      mote.active &&
      carried < tuning.carry_capacity &&
      distanceXZ(nextPlayerPos, mote.pos) <= tuning.pickup_radius
    ) {
      carried += 1;
      score += tuning.score.per_mote;
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'mote_picked',
        data: { carried },
      });
      return { ...mote, active: false };
    }
    return mote;
  });

  // 4. Deposit / light nearest unlit lantern in interact_radius
  const nextLanterns: LanternState[] = world.lanterns.map((l) => ({ ...l }));
  if (interactPressed && carried > 0) {
    let bestLantern: LanternState | null = null;
    let bestDist = Infinity;
    for (const l of nextLanterns) {
      if (l.lit) continue;
      const d = distanceXZ(nextPlayerPos, l.pos);
      if (d <= tuning.interact_radius && d < bestDist) {
        bestDist = d;
        bestLantern = l;
      }
    }
    if (bestLantern) {
      const amount = Math.min(carried, tuning.lantern_cost - bestLantern.deposited);
      if (amount > 0) {
        carried -= amount;
        bestLantern.deposited += amount;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'deposit',
          data: {
            lantern_id: bestLantern.id,
            amount,
            deposited: bestLantern.deposited,
          },
        });
        if (bestLantern.deposited >= tuning.lantern_cost) {
          bestLantern.lit = true;
          score += tuning.score.per_lantern;
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'lantern_lit',
            data: { lantern_id: bestLantern.id },
          });
        }
      }
    }
  }

  // 5. Pulse (stun + push shades within pulse_radius)
  const justStunnedIds = new Set<string>();
  let nextShades: ShadeState[] = world.shades.map((s) => ({
    ...s,
    pos: [s.pos[0], s.pos[1], s.pos[2]],
  }));

  if (pulsePressed && carried >= tuning.pulse_cost && pulseCdLeft <= 0) {
    carried -= tuning.pulse_cost;
    pulseCdLeft = tuning.pulse_cooldown_s;
    lastPulseTick = nextTick;
    const stunnedIds: string[] = [];

    for (const shade of nextShades) {
      const dist = distanceXZ(nextPlayerPos, shade.pos);
      if (dist <= tuning.pulse_radius) {
        stunnedIds.push(shade.id);
        justStunnedIds.add(shade.id);
        shade.state = 'stunned';
        shade.stun_left_s = tuning.pulse_stun_s;

        let dirX = shade.pos[0] - nextPlayerPos[0];
        let dirZ = shade.pos[2] - nextPlayerPos[2];
        if (dist < 1e-6) {
          dirX = Math.sin(yawRad);
          dirZ = Math.cos(yawRad);
        } else {
          dirX /= dist;
          dirZ /= dist;
        }
        shade.pos = [
          shade.pos[0] + dirX * tuning.pulse_push_m,
          shade.pos[1],
          shade.pos[2] + dirZ * tuning.pulse_push_m,
        ];
      }
    }

    score += stunnedIds.length * tuning.score.per_stun;
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'pulse',
      data: { stunned_ids: stunnedIds },
    });
  }

  // 6. Update shades, enforce safe_radius, check player_hit
  for (const shade of nextShades) {
    if (!justStunnedIds.has(shade.id) && shade.stun_left_s > 0) {
      shade.stun_left_s = decrementTimer(shade.stun_left_s, dt);
      if (shade.stun_left_s <= 0) {
        shade.state = 'chase';
      }
    }

    if (shade.state === 'chase') {
      const dx = nextPlayerPos[0] - shade.pos[0];
      const dz = nextPlayerPos[2] - shade.pos[2];
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-6) {
        const step = Math.min(dist, tuning.shade_speed * dt);
        shade.pos = [
          shade.pos[0] + (dx / dist) * step,
          shade.pos[1],
          shade.pos[2] + (dz / dist) * step,
        ];
      }
    }

    shade.pos = enforceSafeRadius(shade.pos, nextLanterns, tuning.safe_radius);
    shade.pos = clampXZ(shade.pos, world.map_radius);

    if (
      shade.state !== 'stunned' &&
      invulnLeft <= 0 &&
      flames > 0 &&
      distanceXZ(nextPlayerPos, shade.pos) <= tuning.shade_hit_radius
    ) {
      const dropped = Math.floor(carried * tuning.hit_drop_ratio);
      carried -= dropped;
      flames = Math.max(0, flames - 1);
      invulnLeft = tuning.invuln_s;
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'player_hit',
        data: { by: 'shade', flames, dropped },
      });
    }
  }

  // 7. Win / loss state transitions
  let nextState: WorldState['state'] = 'playing';
  if (nextLanterns.length > 0 && nextLanterns.every((l) => l.lit)) {
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
  } else if (flames <= 0) {
    nextState = 'lost';
    events.push({
      type: 'event',
      tick: nextTick,
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
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
    tick: nextTick,
    sim_tick: nextTick,
    time_left_s: nextTimeLeft,
    state: nextState,
    score,
    player: {
      pos: nextPlayerPos,
      vy,
      yaw_rad: yawRad,
      flames,
      carried,
      invuln_left_s: invulnLeft,
      pulse_cd_left_s: pulseCdLeft,
    },
    motes: nextMotes,
    lanterns: nextLanterns,
    shades: nextShades,
    prev_buttons: {
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
    },
    last_events: events,
    last_pulse_tick: lastPulseTick,
  };
}

/**
 * Formats a SnapshotRecord conforming strictly to Test Contract v1.0 Section E.
 */
export function formatSnapshot(world: WorldState): SnapshotRecord {
  const activeMotes = world.motes.filter((m) => m.active);
  return {
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.sim_tick,
    state: world.state,
    time_left_s: round3(world.time_left_s),
    score: world.score,
    player: {
      pos: roundVec3(world.player.pos),
      flames: world.player.flames,
      carried: world.player.carried,
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
    motes_active: activeMotes.length,
    motes: activeMotes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos),
    })),
  };
}
