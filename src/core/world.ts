import { nextRange, normalizeSeed } from './rng.js';
import type {
  Firefly,
  GreatLantern,
  InkShadow,
  InputState,
  Vec3,
  WorldConfig,
  WorldEvent,
  WorldState,
} from './types.js';

export const DEFAULT_CONFIG: WorldConfig = {
  seed: 2026,
  mapRadius: 24,
  fireflyCount: 9,
  lanternCount: 3,
  shadowCount: 2,
};

const PLAYER_SPEED = 6.0;
const PLAYER_SPRINT_MULT = 1.5;
const FIREFLY_PICKUP_RADIUS = 1.4;
const LANTERN_INTERACT_RADIUS = 2.4;
const LANTERN_REQUIRED_FIREFLIES = 3;
const SHADOW_SPEED = 2.6;
const SHADOW_HIT_RADIUS = 1.25;
const PLAYER_START_HP = 3;
const PLAYER_INVULN_SECONDS = 1.2;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function clampToRadius(pos: Vec3, maxRadius: number): Vec3 {
  const d = Math.hypot(pos.x, pos.z);
  if (d <= maxRadius || d === 0) {
    return { x: round4(pos.x), y: round4(pos.y), z: round4(pos.z) };
  }
  const scale = maxRadius / d;
  return {
    x: round4(pos.x * scale),
    y: round4(pos.y),
    z: round4(pos.z * scale),
  };
}

/**
 * Creates an initial deterministic world state for Dao Den Long.
 */
export function createWorld(overrides: Partial<WorldConfig> = {}): WorldState {
  const cfg: WorldConfig = { ...DEFAULT_CONFIG, ...overrides };
  let rngState = normalizeSeed(cfg.seed);

  const lanterns: GreatLantern[] = [];
  const lanternRing = cfg.mapRadius * 0.58;
  for (let i = 0; i < cfg.lanternCount; i++) {
    const angle = (i / Math.max(1, cfg.lanternCount)) * Math.PI * 2;
    lanterns.push({
      id: `lantern-${i + 1}`,
      pos: {
        x: round4(Math.cos(angle) * lanternRing),
        y: 0,
        z: round4(Math.sin(angle) * lanternRing),
      },
      requiredFireflies: LANTERN_REQUIRED_FIREFLIES,
      lit: false,
    });
  }

  const fireflies: Firefly[] = [];
  for (let i = 0; i < cfg.fireflyCount; i++) {
    let angle: number;
    let r: number;
    [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
    [r, rngState] = nextRange(rngState, 3.0, cfg.mapRadius * 0.85);
    fireflies.push({
      id: `firefly-${i + 1}`,
      pos: {
        x: round4(Math.cos(angle) * r),
        y: 0.75,
        z: round4(Math.sin(angle) * r),
      },
      collected: false,
    });
  }

  const shadows: InkShadow[] = [];
  for (let i = 0; i < cfg.shadowCount; i++) {
    let angle: number;
    let dirAngle: number;
    [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
    [dirAngle, rngState] = nextRange(rngState, 0, Math.PI * 2);
    const r = cfg.mapRadius * 0.45;
    shadows.push({
      id: `shadow-${i + 1}`,
      pos: {
        x: round4(Math.cos(angle) * r),
        y: 0,
        z: round4(Math.sin(angle) * r),
      },
      vel: {
        x: round4(Math.cos(dirAngle) * SHADOW_SPEED),
        y: 0,
        z: round4(Math.sin(dirAngle) * SHADOW_SPEED),
      },
      radius: SHADOW_HIT_RADIUS,
    });
  }

  return {
    seed: cfg.seed,
    rngState,
    tick: 0,
    time: 0,
    status: 'playing',
    mapRadius: cfg.mapRadius,
    player: {
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      fireflies: 0,
      hp: PLAYER_START_HP,
      stamina: 100,
      invulnTimer: 0,
    },
    fireflies,
    lanterns,
    shadows,
    lastEvents: [],
  };
}

/**
 * Advances the simulation by one deterministic step without DOM/WebGL side effects.
 */
export function stepWorld(state: WorldState, input: InputState, dt: number): WorldState {
  if (state.status !== 'playing') {
    return { ...state, lastEvents: [] };
  }

  const clampedDt = Math.max(0, Math.min(dt, 0.1));
  const events: WorldEvent[] = [];

  const moveLen = Math.hypot(input.moveX, input.moveZ);
  const nx = moveLen > 1 ? input.moveX / moveLen : input.moveX;
  const nz = moveLen > 1 ? input.moveZ / moveLen : input.moveZ;

  const isSprinting = Boolean(input.sprint) && state.player.stamina > 0 && moveLen > 0.05;
  const speed = PLAYER_SPEED * (isSprinting ? PLAYER_SPRINT_MULT : 1);

  const nextPos = clampToRadius(
    {
      x: state.player.pos.x + nx * speed * clampedDt,
      y: state.player.pos.y,
      z: state.player.pos.z + nz * speed * clampedDt,
    },
    state.mapRadius - 0.5,
  );

  const nextYaw = moveLen > 0.05 ? round4(Math.atan2(nx, nz)) : state.player.yaw;
  const nextStamina = isSprinting
    ? Math.max(0, round4(state.player.stamina - 28 * clampedDt))
    : Math.min(100, round4(state.player.stamina + 16 * clampedDt));

  let firefliesHeld = state.player.fireflies;
  let hp = state.player.hp;
  let invulnTimer = Math.max(0, round4(state.player.invulnTimer - clampedDt));

  const nextFireflies = state.fireflies.map((ff) => {
    if (!ff.collected && distanceXZ(nextPos, ff.pos) <= FIREFLY_PICKUP_RADIUS) {
      firefliesHeld += 1;
      events.push({ type: 'firefly_collected', targetId: ff.id });
      return { ...ff, collected: true };
    }
    return ff;
  });

  const nextLanterns = state.lanterns.map((lantern) => {
    if (
      !lantern.lit &&
      input.interact &&
      firefliesHeld >= lantern.requiredFireflies &&
      distanceXZ(nextPos, lantern.pos) <= LANTERN_INTERACT_RADIUS
    ) {
      firefliesHeld -= lantern.requiredFireflies;
      events.push({ type: 'lantern_lit', targetId: lantern.id });
      return { ...lantern, lit: true };
    }
    return lantern;
  });

  const shadowBound = state.mapRadius - 1.0;
  const nextShadows = state.shadows.map((shadow) => {
    let sx = shadow.pos.x + shadow.vel.x * clampedDt;
    let sz = shadow.pos.z + shadow.vel.z * clampedDt;
    let vx = shadow.vel.x;
    let vz = shadow.vel.z;

    const distFromOrigin = Math.hypot(sx, sz);
    if (distFromOrigin > shadowBound && distFromOrigin > 0) {
      const rx = sx / distFromOrigin;
      const rz = sz / distFromOrigin;
      const dot = vx * rx + vz * rz;
      if (dot > 0) {
        vx = vx - 2 * dot * rx;
        vz = vz - 2 * dot * rz;
      }
      sx = rx * shadowBound;
      sz = rz * shadowBound;
    }

    const updated: InkShadow = {
      ...shadow,
      pos: { x: round4(sx), y: shadow.pos.y, z: round4(sz) },
      vel: { x: round4(vx), y: shadow.vel.y, z: round4(vz) },
    };

    if (invulnTimer <= 0 && distanceXZ(nextPos, updated.pos) <= updated.radius) {
      hp = Math.max(0, hp - 1);
      invulnTimer = PLAYER_INVULN_SECONDS;
      events.push({ type: 'shadow_hit', targetId: updated.id });
    }

    return updated;
  });

  let nextStatus: WorldState['status'] = 'playing';
  if (hp <= 0) {
    nextStatus = 'lost';
    events.push({ type: 'game_lost' });
  } else if (nextLanterns.every((l) => l.lit)) {
    nextStatus = 'won';
    events.push({ type: 'game_won' });
  }

  return {
    ...state,
    tick: state.tick + 1,
    time: round4(state.time + clampedDt),
    status: nextStatus,
    player: {
      pos: nextPos,
      yaw: nextYaw,
      fireflies: firefliesHeld,
      hp,
      stamina: nextStamina,
      invulnTimer,
    },
    fireflies: nextFireflies,
    lanterns: nextLanterns,
    shadows: nextShadows,
    lastEvents: events,
  };
}
