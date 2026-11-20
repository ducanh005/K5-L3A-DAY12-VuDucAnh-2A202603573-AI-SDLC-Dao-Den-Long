// src/headless/cli.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// src/core/maps.ts
function r3(n) {
  const v = Math.round(n * 1e3) / 1e3;
  return v === 0 ? 0 : v;
}
function ringPoints(cx, cz, y, radius, startDeg, stepDeg, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const rad = (startDeg + i * stepDeg) * Math.PI / 180;
    pts.push([r3(cx + radius * Math.cos(rad)), y, r3(cz + radius * Math.sin(rad))]);
  }
  return pts;
}
function normXZ(dx, dz) {
  const len = Math.hypot(dx, dz);
  return len > 1e-6 ? [dx / len, dz / len] : [0, 1];
}
var NIGHT1_MAP = {
  night: 1,
  name: "\u0110\xEAm 1 \u2014 \u0110\u1EA3o B\u1EBFn",
  duration_s: 240,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: "L1", pos: [0, 0, 25] },
    { id: "L2", pos: [23.8, 0, 7.7] },
    { id: "L3", pos: [14.7, 0, -20.2] },
    { id: "L4", pos: [-14.7, 0, -20.2] },
    { id: "L5", pos: [-23.8, 0, 7.7] }
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 12, 0, 45, 8),
    ...ringPoints(0, 0, 0, 33, 0, 22.5, 16)
  ],
  shadeSpawnPoints: ringPoints(0, 0, 0, 37, 15, 30, 12),
  shadeIntervalTicks: 480,
  maxShades: 6,
  shadeSpeed: 4,
  charmPositions: [],
  jumpPads: []
};
var NIGHT2_MAP = {
  night: 2,
  name: "\u0110\xEAm 2 \u2014 \u0110\u1EA3o Cau",
  duration_s: 270,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: "L1", pos: [0, 0, 20] },
    { id: "L2", pos: [17, 0, -10] },
    { id: "L3", pos: [-17, 0, -10] },
    { id: "L4", pos: [70, 0, 20] },
    { id: "L5", pos: [87, 0, -10] },
    { id: "L6", pos: [53, 0, -10] }
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 10, 0, 90, 4),
    ...ringPoints(0, 0, 0, 22, 0, 45, 8),
    ...ringPoints(70, 0, 0, 10, 0, 90, 4),
    ...ringPoints(70, 0, 0, 22, 0, 45, 8)
  ],
  shadeSpawnPoints: [
    ...ringPoints(0, 0, 0, 26, 22.5, 45, 8),
    ...ringPoints(70, 0, 0, 26, 22.5, 45, 8)
  ],
  shadeIntervalTicks: 420,
  maxShades: 8,
  shadeSpeed: 4,
  charmPositions: [{ id: "C1", pos: [35, 0, 0] }],
  jumpPads: [
    { pos: [20, 0, 18], radius: 1, vy: 14, vh: 24, dirXZ: normXZ(70 - 20, 0 - 18) },
    { pos: [50, 0, -18], radius: 1, vy: 14, vh: 24, dirXZ: normXZ(0 - 50, 0 - -18) }
  ]
};
var NIGHT3_MAP = {
  night: 3,
  name: "\u0110\xEAm 3 \u2014 \u0110\u1EA3o Chu\xF4ng",
  duration_s: 300,
  spawnPos: [0, 0, 35],
  lanterns: [
    { id: "L1", pos: [0, 6, 6] },
    { id: "L2", pos: [18, 3, 10] },
    { id: "L3", pos: [-18, 3, 10] },
    { id: "L4", pos: [35, 0, -10] },
    { id: "L5", pos: [-35, 0, -10] },
    { id: "L6", pos: [20, 0, -35] },
    { id: "L7", pos: [-20, 0, -35] }
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 34, 0, 20, 18),
    ...ringPoints(0, 0, 3, 18, 20, 20, 8),
    ...ringPoints(0, 0, 6, 5, 45, 90, 4)
  ],
  shadeSpawnPoints: ringPoints(0, 0, 0, 43, 0, 22.5, 16),
  shadeIntervalTicks: 360,
  maxShades: 10,
  shadeSpeed: 4.5,
  charmPositions: [
    { id: "C1", pos: [30, 0, 25] },
    { id: "C2", pos: [-30, 0, 25] }
  ],
  jumpPads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vh: 8, dirXZ: [0, -1] }]
};
function getMapSpec(night) {
  if (night === 2) return NIGHT2_MAP;
  if (night === 3) return NIGHT3_MAP;
  return NIGHT1_MAP;
}
var RAMP_ANGLES_RAD = [30 * Math.PI / 180, 150 * Math.PI / 180];
function rampSurfaceY(x, z) {
  for (const ang of RAMP_ANGLES_RAD) {
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    const proj = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && proj >= 23.9 && proj <= 30) {
      return Math.min(3, Math.max(0, (30 - proj) * 0.5));
    }
  }
  return null;
}
function getCandidateGroundHeights(night, x, z) {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? [0] : [];
  }
  if (night === 2) {
    const onIslandA = Math.hypot(x, z) <= 28;
    const onIslandB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return onIslandA || onIslandB || onBridge ? [0] : [];
  }
  const r = Math.hypot(x, z);
  if (r > 45) return [];
  const heights = [];
  if (r >= 2 && r <= 8) {
    heights.push(6);
  }
  if (r >= 12 && r <= 24 && z > 0) {
    heights.push(3);
  }
  const ry = rampSurfaceY(x, z);
  if (ry !== null) {
    heights.push(ry);
  }
  if (r >= 2) {
    heights.push(0);
  }
  heights.sort((a, b) => b - a);
  return heights;
}
function getSupportY(night, x, z, currentY) {
  const candidates = getCandidateGroundHeights(night, x, z);
  for (const h of candidates) {
    if (h <= currentY + 0.35) {
      return h;
    }
  }
  return null;
}
function isBlockedByObstacle(night, nx, nz, currentY) {
  if (night !== 3) return false;
  const r = Math.hypot(nx, nz);
  if (r < 2 && currentY < 14) {
    return true;
  }
  if (r <= 8 && currentY < 5.75) {
    return true;
  }
  if (r >= 12 && r <= 24 && nz > 0 && currentY < 2.75) {
    const ry2 = rampSurfaceY(nx, nz);
    if (ry2 === null || ry2 > currentY + 0.35) {
      return true;
    }
  }
  const ry = rampSurfaceY(nx, nz);
  if (ry !== null && ry > currentY + 0.35) {
    return true;
  }
  return false;
}

// src/core/rng.ts
function normalizeSeed(seed) {
  return seed >>> 0 || 1;
}
function nextRandom(state) {
  let t = state + 1831565813 | 0;
  const nextState = t >>> 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const value = ((t ^ t >>> 14) >>> 0) / 4294967296;
  return [value, nextState];
}
function nextRange(state, min, max) {
  const [u, nextState] = nextRandom(state);
  return [min + u * (max - min), nextState];
}

// src/core/world.ts
var FIXED_DT = 1 / 60;
var JUMP_VELOCITY = 7;
var GRAVITY = 20;
var CHARM_SPEED = 7.2;
var PULSE_PUSH_TICKS = 15;
var CHARM_DURATION_TICKS = 600;
var CHARM_RESPAWN_TICKS = 2700;
var DROPPED_MOTE_TTL_TICKS = 480;
var FALL_WAIT_TICKS = 60;
var RECOIL_TICKS = 60;
var RECOIL_DIST = 2;
var LANTERN_REPEL_TICKS = 30;
var DRIFTER_FLEE_TICKS = 240;
var DRIFTER_DROP_FLEE_TICKS = 120;
var INITIAL_MOTE_COUNT = 20;
var MAX_MOTE_COUNT = 30;
var MOTE_SPAWN_INTERVAL = 240;
var SHADE_DETECT_DIST = 12;
var SHADE_LOSE_DIST = 18;
var SHADE_WANDER_SPEED = 1.5;
var SHADE_DRAIN_RADIUS = 2;
var SHADE_DRAIN_AGGRO_RADIUS = 6;
var DRIFTER_IDLE_SPEED = 2;
var DRIFTER_SPEED = 7;
var DRIFTER_DETECT_DIST = 15;
var DRIFTER_STEAL_RADIUS = 1.2;
var DRIFTER_SPAWN_INTERVAL = 1200;
var MAX_DRIFTERS = 2;
var WIND_CYCLE_TICKS = 1800;
var WIND_WARN_OFFSET = 1680;
var WIND_DURATION_TICKS = 300;
var WIND_PUSH_SPEED = 2;
var DEFAULT_TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  capacity_max: 20,
  lantern_cost: 10,
  relight_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
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
  fuel_max: 100,
  fuel_decay_per_s: 1,
  fuel_per_mote: 10,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  win_ratio: 0.6,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 0,
    per_flame_left: 50
  }
};
function round3(n) {
  const v = Math.round(n * 1e3) / 1e3;
  return v === 0 ? 0 : v;
}
function round1(n) {
  const v = Math.round(n * 10) / 10;
  return v === 0 ? 0 : v;
}
function roundVec3(v) {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}
function distanceXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
function distance3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function normDirXZ(dx, dz, fallback = [1, 0]) {
  const len = Math.hypot(dx, dz);
  return len > 1e-6 ? [dx / len, dz / len] : fallback;
}
function compareEntityId(a, b) {
  const pa = a.id.charAt(0);
  const pb = b.id.charAt(0);
  if (pa !== pb) return pa.localeCompare(pb);
  const na = Number(a.id.slice(1));
  const nb = Number(b.id.slice(1));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.id.localeCompare(b.id);
}
function enforceSafeRadiusXZ(night, pos, lanterns, safeRadius, lowFuelTicks) {
  let x = pos[0];
  let z = pos[2];
  for (const l of lanterns) {
    if (!l.lit || l.fuel_ticks < lowFuelTicks || Math.abs(pos[1] - l.pos[1]) > 3.5) continue;
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
function moveWithObstacles(night, pos, dx, dz, allowVoid) {
  const nx = pos[0] + dx;
  const nz = pos[2] + dz;
  const canEnter = (x, z) => {
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
function createWorld(options = {}) {
  const seed = options.seed ?? 2026;
  const night = options.night ?? 1;
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const scenario = options.scenario;
  const mapSpec = getMapSpec(night);
  let rngState = normalizeSeed(seed);
  const fuelMaxTicks = Math.round(tuning.fuel_max * 60);
  const lanterns = mapSpec.lanterns.map((spec) => ({
    id: spec.id,
    pos: [spec.pos[0], spec.pos[1], spec.pos[2]],
    lit: false,
    deposited: 0,
    fuel_ticks: 0,
    ever_lit: false,
    relit_count: 0
  }));
  if (scenario?.lanterns) {
    for (const override of scenario.lanterns) {
      const target = lanterns.find((l) => l.id === override.id);
      if (!target) continue;
      if (override.pos) {
        target.pos = [override.pos[0], override.pos[1], override.pos[2]];
      }
      if (typeof override.ever_lit === "boolean") {
        target.ever_lit = override.ever_lit;
      }
      if (typeof override.deposited === "number") {
        target.deposited = Math.max(0, override.deposited);
      }
      const reqCost = target.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
      if (override.lit === true) {
        target.lit = true;
        target.ever_lit = override.ever_lit ?? true;
        target.fuel_ticks = override.fuel !== void 0 ? Math.min(fuelMaxTicks, Math.max(0, Math.round(override.fuel * 60))) : fuelMaxTicks;
        if (override.deposited === void 0 && target.deposited < reqCost) {
          target.deposited = reqCost;
        }
      } else if (override.lit === false) {
        target.lit = false;
        target.fuel_ticks = 0;
      } else if (override.fuel !== void 0 && override.fuel > 0) {
        target.lit = true;
        target.ever_lit = override.ever_lit ?? true;
        target.fuel_ticks = Math.min(fuelMaxTicks, Math.max(0, Math.round(override.fuel * 60)));
      } else if (target.deposited >= reqCost) {
        target.lit = true;
        target.ever_lit = true;
        target.fuel_ticks = fuelMaxTicks;
      }
    }
  }
  const playerPos = scenario?.player?.pos ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]] : [mapSpec.spawnPos[0], mapSpec.spawnPos[1], mapSpec.spawnPos[2]];
  let motes = [];
  if (scenario?.motes !== void 0) {
    motes = scenario.motes.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return {
          id: `M${idx + 1}`,
          pos: [entry[0], entry[1], entry[2]],
          kind: "random",
          ttl_ticks: null,
          just_spawned: false
        };
      }
      const ttl = entry.ttl_s !== void 0 && entry.ttl_s !== null ? Math.round(entry.ttl_s * 60) : null;
      return {
        id: entry.id ?? `M${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        kind: entry.kind ?? "random",
        ttl_ticks: ttl,
        just_spawned: false
      };
    });
  } else if (scenario?.random_motes !== false) {
    const indices = mapSpec.moteSpawnPoints.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      let rVal;
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
        kind: "random",
        ttl_ticks: null,
        just_spawned: false
      });
    }
  }
  let shades = [];
  if (scenario?.shades !== void 0) {
    shades = scenario.shades.map((entry, idx) => {
      const pos = Array.isArray(entry) ? [entry[0], entry[1], entry[2]] : [entry.pos[0], entry.pos[1], entry.pos[2]];
      const defaultState = distanceXZ(playerPos, pos) <= SHADE_DETECT_DIST ? "chase" : "wander";
      const st = Array.isArray(entry) ? defaultState : entry.state ?? defaultState;
      const stTicks = Array.isArray(entry) ? 0 : entry.state_ticks_left ?? 0;
      let targetLanternId = Array.isArray(entry) ? null : entry.target_lantern_id ?? null;
      if (st === "drain" && !targetLanternId) {
        const nearest = lanterns.filter((l) => l.lit).sort((a, b) => distanceXZ(pos, a.pos) - distanceXZ(pos, b.pos))[0];
        targetLanternId = nearest ? nearest.id : null;
      }
      return {
        id: (Array.isArray(entry) ? void 0 : entry.id) ?? `S${idx + 1}`,
        pos,
        state: st,
        state_ticks_left: stTicks,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [1, 0],
        repel_lantern_id: null,
        repel_ticks_left: 0,
        target_lantern_id: targetLanternId,
        drain_ticks: 0,
        wander_angle: idx * 1.1
      };
    });
  }
  let drifters = [];
  if (scenario?.drifters !== void 0) {
    drifters = scenario.drifters.map((d, idx) => ({
      id: d.id ?? `D${idx + 1}`,
      pos: [d.pos[0], d.pos[1], d.pos[2]],
      state: d.state ?? "idle",
      state_ticks_left: d.state === "flee" ? DRIFTER_FLEE_TICKS : 0,
      stolen: d.stolen ?? 0,
      has_stolen: (d.stolen ?? 0) > 0,
      orbit_angle: idx * 1.5,
      just_spawned: false
    }));
  }
  let charms = mapSpec.charmPositions.map((c) => ({
    id: c.id,
    pos: [c.pos[0], c.pos[1], c.pos[2]],
    available: true,
    respawn_ticks: 0
  }));
  if (scenario?.charms !== void 0) {
    charms = scenario.charms.map((c, idx) => {
      const id = c.id ?? `C${idx + 1}`;
      const mapMatch = mapSpec.charmPositions.find((mc) => mc.id === id);
      const pos = c.pos ? [c.pos[0], c.pos[1], c.pos[2]] : mapMatch ? [mapMatch.pos[0], mapMatch.pos[1], mapMatch.pos[2]] : [0, 0, 0];
      return {
        id,
        pos,
        available: c.available ?? true,
        respawn_ticks: c.respawn_s !== void 0 ? Math.round(c.respawn_s * 60) : 0
      };
    });
  }
  const successfulLights = scenario?.player?.successful_lights ?? 0;
  const capacity = Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * successfulLights);
  const supportAtStart = getSupportY(night, playerPos[0], playerPos[2], playerPos[1]);
  const groundedStart = supportAtStart !== null && Math.abs(playerPos[1] - supportAtStart) <= 0.05;
  const defaultDuration = night === 2 ? tuning.night2_duration_s : night === 3 ? tuning.night3_duration_s : tuning.night1_duration_s;
  const initialTimeLeft = scenario?.time_left_s ?? defaultDuration;
  return {
    seed,
    night,
    rngState,
    tuning,
    tick: 0,
    sim_tick: 0,
    initial_time_left_s: initialTimeLeft,
    time_left_s: initialTimeLeft,
    state: "playing",
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
      successful_lights: successfulLights,
      capacity,
      grounded: groundedStart,
      invuln_ticks: scenario?.player?.invuln_ticks ?? 0,
      dash_cd_ticks: scenario?.player?.dash_cd_ticks ?? 0,
      dash_ticks_left: 0,
      dash_dir: [0, 1],
      pulse_cd_ticks: scenario?.player?.pulse_cd_ticks ?? 0,
      charm_ticks: scenario?.player?.charm_ticks ?? 0,
      fall_wait_ticks: 0,
      launch_active: false,
      launch_vel_xz: [0, 0]
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
    last_pulse_tick: -999
  };
}
function stepWorld(world, input, dt = FIXED_DT) {
  if (world.state === "won" || world.state === "lost") {
    return { ...world, last_events: [] };
  }
  const nextTick = world.tick + 1;
  const events = [];
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
    pause: input.pause
  };
  if (pausePressed) {
    if (!world.paused) {
      events.push({ type: "event", tick: nextTick, name: "paused", data: {} });
      return {
        ...world,
        tick: nextTick,
        paused: true,
        state: "paused",
        prev_buttons: nextPrevButtons,
        last_events: events
      };
    }
    events.push({ type: "event", tick: nextTick, name: "resumed", data: {} });
  } else if (world.paused) {
    return {
      ...world,
      tick: nextTick,
      prev_buttons: nextPrevButtons,
      last_events: []
    };
  }
  let nightStarted = world.night_started_emitted;
  if (!nightStarted) {
    events.push({
      type: "event",
      tick: nextTick,
      name: "night_start",
      data: { night: world.night }
    });
    nightStarted = true;
  }
  const tuning = world.tuning;
  const mapSpec = getMapSpec(world.night);
  const nextSimTick = world.sim_tick + 1;
  const nextTimeLeft = Math.max(0, world.initial_time_left_s - nextSimTick / 60);
  let rngState = world.rngState;
  let score = world.score;
  const fuelMaxTicks = Math.round(tuning.fuel_max * 60);
  const lowFuelTicks = Math.round(tuning.low_fuel_threshold * 60);
  const fuelPerMoteTicks = Math.round(tuning.fuel_per_mote * 60);
  const decayPerTick = Math.round(tuning.fuel_decay_per_s);
  const drainPerTick = Math.round(tuning.drain_per_s);
  const invulnDurationTicks = Math.max(1, Math.round(tuning.invuln_s * 60));
  const dashDurationTicks = Math.max(1, Math.round(tuning.dash_duration_s * 60));
  const dashCooldownTicks = Math.max(0, Math.round(tuning.dash_cooldown_s * 60));
  const pulseStunDurationTicks = Math.max(1, Math.round(tuning.pulse_stun_s * 60));
  const pulseCooldownTicks = Math.max(0, Math.round(tuning.pulse_cooldown_s * 60));
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
  let successfulLights = world.player.successful_lights;
  let capacity = world.player.capacity;
  let dashDir = [world.player.dash_dir[0], world.player.dash_dir[1]];
  let launchActive = world.player.launch_active;
  let launchVelXZ = [world.player.launch_vel_xz[0], world.player.launch_vel_xz[1]];
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
  let nextMotes = [];
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
      just_spawned: false
    });
  }
  const nextCharms = world.charms.map((c) => {
    if (!c.available && c.respawn_ticks > 0) {
      const rem = c.respawn_ticks - 1;
      return {
        ...c,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: rem === 0,
        respawn_ticks: rem
      };
    }
    return { ...c, pos: [c.pos[0], c.pos[1], c.pos[2]] };
  });
  const nextShades = world.shades.map((s) => {
    let state = s.state;
    let stateTicks = Math.max(0, s.state_ticks_left - 1);
    const pushTicks = Math.max(0, s.push_ticks_left - 1);
    let repelTicks = Math.max(0, s.repel_ticks_left - 1);
    let repelId = repelTicks > 0 ? s.repel_lantern_id : null;
    let targetLanternId = s.target_lantern_id;
    let drainTicks = s.drain_ticks;
    if (s.state_ticks_left > 0 && stateTicks === 0) {
      if (state === "spawning") {
        state = distanceXZ([px, py, pz], s.pos) <= SHADE_DETECT_DIST ? "chase" : "wander";
      } else if (state === "stunned") {
        state = "wander";
        targetLanternId = null;
        drainTicks = 0;
      } else if (state === "recoil") {
        state = distanceXZ([px, py, pz], s.pos) <= SHADE_LOSE_DIST ? "chase" : "wander";
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
      target_lantern_id: targetLanternId,
      drain_ticks: drainTicks
    };
  });
  const nextLanterns = world.lanterns.map((l) => ({ ...l }));
  for (const l of nextLanterns) {
    if (!l.lit) continue;
    const drainingShades = nextShades.filter(
      (s) => s.state === "drain" && s.target_lantern_id === l.id && distanceXZ(s.pos, l.pos) <= SHADE_DRAIN_RADIUS
    ).sort(compareEntityId);
    const totalDrop = decayPerTick + drainingShades.length * drainPerTick;
    l.fuel_ticks = Math.max(0, l.fuel_ticks - totalDrop);
    for (const s of drainingShades) {
      s.drain_ticks += 1;
      if (s.drain_ticks % 60 === 0) {
        events.push({
          type: "event",
          tick: nextTick,
          name: "fuel_drain",
          data: {
            lantern_id: l.id,
            shade_id: s.id,
            fuel: round1(l.fuel_ticks / 60)
          }
        });
      }
    }
    if (l.fuel_ticks <= 0) {
      l.lit = false;
      l.fuel_ticks = 0;
      l.deposited = 0;
      l.ever_lit = true;
      events.push({
        type: "event",
        tick: nextTick,
        name: "lantern_out",
        data: { lantern_id: l.id }
      });
      for (const s of nextShades) {
        if (s.state === "drain" && s.target_lantern_id === l.id) {
          s.state = "wander";
          s.target_lantern_id = null;
          s.drain_ticks = 0;
        }
      }
    }
  }
  let nextDrifters = [];
  for (const d of world.drifters) {
    if (d.state === "flee" && d.state_ticks_left > 0) {
      const rem = d.state_ticks_left - 1;
      if (rem <= 0) continue;
      nextDrifters.push({
        ...d,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        state_ticks_left: rem,
        just_spawned: false
      });
    } else {
      nextDrifters.push({
        ...d,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        just_spawned: false
      });
    }
  }
  const nextWind = { ...world.wind };
  if (world.night === 3 && world.wind_enabled) {
    const modTick = nextSimTick % WIND_CYCLE_TICKS;
    if (modTick === WIND_WARN_OFFSET) {
      let randVal;
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
  if (fallWaitTicks === 0 && !justRespawned) {
    let mx = input.move[0];
    let mz = input.move[1];
    const moveLen = Math.hypot(mx, mz);
    if (moveLen > 1) {
      mx /= moveLen;
      mz /= moveLen;
    }
    const theta = input.cam_yaw_deg * Math.PI / 180;
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
      dashDir = hasMoveInput ? normDirXZ(wx, wz) : normDirXZ(Math.sin(yawRad), Math.cos(yawRad), [0, 1]);
      launchActive = false;
      events.push({ type: "event", tick: nextTick, name: "dash", data: {} });
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
        const wRad = nextWind.dir_deg * Math.PI / 180;
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
      for (const pad of mapSpec.jumpPads) {
        if (Math.hypot(px - pad.pos[0], pz - pad.pos[2]) <= pad.radius && Math.abs(py - pad.pos[1]) <= 0.5 && vy <= 0.1) {
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
        type: "event",
        tick: nextTick,
        name: "player_hit",
        data: { by: "fall", flames, dropped: 0, lost }
      });
      if (flames > 0) {
        fallWaitTicks = FALL_WAIT_TICKS;
      }
    }
  }
  const playerPos = [px, py, pz];
  if (fallWaitTicks === 0 && py >= -10) {
    const remainingMotes = [];
    for (const mote of nextMotes) {
      if (!mote.just_spawned && carried < capacity && distanceXZ(playerPos, mote.pos) <= tuning.pickup_radius && Math.abs(playerPos[1] - mote.pos[1]) <= 1.5) {
        carried += 1;
        events.push({
          type: "event",
          tick: nextTick,
          name: "mote_picked",
          data: { carried }
        });
      } else {
        remainingMotes.push(mote);
      }
    }
    nextMotes = remainingMotes;
    for (const charm of nextCharms) {
      if (charm.available && distanceXZ(playerPos, charm.pos) <= tuning.pickup_radius && Math.abs(playerPos[1] - charm.pos[1]) <= 1.5) {
        charm.available = false;
        charm.respawn_ticks = CHARM_RESPAWN_TICKS;
        charmTicks = CHARM_DURATION_TICKS;
        dashCdTicks = 0;
        events.push({
          type: "event",
          tick: nextTick,
          name: "charm_picked",
          data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS }
        });
      }
    }
  }
  if (fallWaitTicks === 0 && interactPressed && carried > 0) {
    const candidates = nextLanterns.filter(
      (l) => (!l.lit || l.fuel_ticks < fuelMaxTicks) && distanceXZ(playerPos, l.pos) <= tuning.interact_radius && Math.abs(playerPos[1] - l.pos[1]) <= 2
    ).sort((a, b) => {
      const da = distanceXZ(playerPos, a.pos);
      const db = distanceXZ(playerPos, b.pos);
      if (Math.abs(da - db) > 1e-6) return da - db;
      return compareEntityId(a, b);
    });
    const target = candidates[0];
    if (target) {
      if (!target.lit) {
        const reqCost = target.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
        const amount = Math.min(carried, reqCost - target.deposited);
        if (amount > 0) {
          carried -= amount;
          target.deposited += amount;
          score += amount * tuning.score.per_mote;
          events.push({
            type: "event",
            tick: nextTick,
            name: "deposit",
            data: { lantern_id: target.id, amount, deposited: target.deposited }
          });
          if (target.deposited >= reqCost) {
            const relight = target.ever_lit;
            target.lit = true;
            target.fuel_ticks = fuelMaxTicks;
            target.ever_lit = true;
            if (relight) {
              target.relit_count += 1;
              score += 40;
            } else {
              score += tuning.score.per_lantern;
            }
            successfulLights += 1;
            capacity = Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * successfulLights);
            for (const shade of nextShades) {
              if (Math.abs(shade.pos[1] - target.pos[1]) <= 3.5 && distanceXZ(shade.pos, target.pos) < tuning.safe_radius) {
                shade.repel_lantern_id = target.id;
                shade.repel_ticks_left = LANTERN_REPEL_TICKS;
                if (shade.state === "drain") {
                  shade.state = "wander";
                  shade.target_lantern_id = null;
                  shade.drain_ticks = 0;
                }
              }
            }
            events.push({
              type: "event",
              tick: nextTick,
              name: "lantern_lit",
              data: { lantern_id: target.id, relight }
            });
          }
        }
      } else {
        const needed = Math.ceil((fuelMaxTicks - target.fuel_ticks) / fuelPerMoteTicks);
        const used = Math.min(carried, needed);
        if (used > 0) {
          const wasLow = target.fuel_ticks < lowFuelTicks;
          carried -= used;
          target.fuel_ticks = Math.min(fuelMaxTicks, target.fuel_ticks + used * fuelPerMoteTicks);
          score += used * tuning.score.per_mote;
          if (wasLow && target.fuel_ticks >= lowFuelTicks) {
            for (const shade of nextShades) {
              if (Math.abs(shade.pos[1] - target.pos[1]) <= 3.5 && distanceXZ(shade.pos, target.pos) < tuning.safe_radius) {
                shade.repel_lantern_id = target.id;
                shade.repel_ticks_left = LANTERN_REPEL_TICKS;
                if (shade.state === "drain") {
                  shade.state = "wander";
                  shade.target_lantern_id = null;
                  shade.drain_ticks = 0;
                }
              }
            }
          }
          events.push({
            type: "event",
            tick: nextTick,
            name: "refuel",
            data: {
              lantern_id: target.id,
              amount: used,
              fuel: round1(target.fuel_ticks / 60)
            }
          });
        }
      }
    }
  }
  for (const shade of nextShades) {
    if (shade.state === "spawning") continue;
    if (shade.repel_ticks_left > 0 && shade.repel_lantern_id) {
      const lantern = nextLanterns.find((l) => l.id === shade.repel_lantern_id);
      if (lantern && lantern.lit && lantern.fuel_ticks >= lowFuelTicks) {
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
      } else {
        shade.repel_ticks_left = 0;
        shade.repel_lantern_id = null;
      }
    } else {
      shade.pos = enforceSafeRadiusXZ(world.night, shade.pos, nextLanterns, tuning.safe_radius, lowFuelTicks);
    }
  }
  let nextMoteSeq = world.next_mote_seq;
  let lastPulseTick = world.last_pulse_tick;
  if (fallWaitTicks === 0 && pulsePressed && carried >= tuning.pulse_cost && pulseCdTicks === 0) {
    carried -= tuning.pulse_cost;
    pulseCdTicks = pulseCooldownTicks;
    lastPulseTick = nextSimTick;
    const pulseCenter = [playerPos[0], playerPos[1] + 0.8, playerPos[2]];
    const stunnedIds = [];
    for (const shade of nextShades) {
      if (shade.state === "spawning") continue;
      if (distance3D(pulseCenter, shade.pos) <= tuning.pulse_radius) {
        const wasDraining = shade.state === "drain";
        stunnedIds.push(shade.id);
        shade.state = "stunned";
        shade.state_ticks_left = pulseStunDurationTicks;
        shade.push_ticks_left = PULSE_PUSH_TICKS;
        shade.push_dir = normDirXZ(shade.pos[0] - playerPos[0], shade.pos[2] - playerPos[2], [1, 0]);
        shade.target_lantern_id = null;
        shade.drain_ticks = 0;
        score += wasDraining ? 15 : tuning.score.per_stun;
      }
    }
    for (const drifter of nextDrifters) {
      if (drifter.just_spawned) continue;
      if (distance3D(pulseCenter, drifter.pos) <= tuning.pulse_radius) {
        if (drifter.state === "chase") {
          drifter.state = "flee";
          drifter.state_ticks_left = DRIFTER_FLEE_TICKS;
        } else if (drifter.state === "flee" && drifter.stolen > 0) {
          const dropCount = drifter.stolen;
          const dropCenterFloor = getSupportY(world.night, drifter.pos[0], drifter.pos[2], drifter.pos[1]);
          for (let i = 0; i < dropCount; i++) {
            const ang = i / Math.max(1, dropCount) * Math.PI * 2;
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
              kind: "dropped",
              ttl_ticks: DROPPED_MOTE_TTL_TICKS,
              just_spawned: true
            });
          }
          events.push({
            type: "event",
            tick: nextTick,
            name: "drifter_drop",
            data: { drifter_id: drifter.id, amount: dropCount }
          });
          drifter.stolen = 0;
          drifter.state_ticks_left = DRIFTER_DROP_FLEE_TICKS;
        }
      }
    }
    events.push({
      type: "event",
      tick: nextTick,
      name: "pulse",
      data: { stunned_ids: stunnedIds }
    });
  }
  const shadeSpeed = world.night === 3 ? 4.5 : tuning.shade_speed;
  for (const shade of nextShades) {
    if (shade.state === "spawning") continue;
    if (shade.push_ticks_left > 0) {
      const pushStep = tuning.pulse_push_m / PULSE_PUSH_TICKS;
      shade.pos = moveWithObstacles(
        world.night,
        shade.pos,
        shade.push_dir[0] * pushStep,
        shade.push_dir[1] * pushStep,
        false
      );
    }
    if (shade.state === "drain") {
      if (distanceXZ(playerPos, shade.pos) <= SHADE_DRAIN_AGGRO_RADIUS) {
        shade.state = "chase";
        shade.target_lantern_id = null;
        shade.drain_ticks = 0;
      } else {
        const target = nextLanterns.find((l) => l.id === shade.target_lantern_id);
        if (!target || !target.lit || target.fuel_ticks >= lowFuelTicks || distanceXZ(shade.pos, target.pos) > SHADE_DRAIN_RADIUS) {
          shade.state = "wander";
          shade.target_lantern_id = null;
          shade.drain_ticks = 0;
        }
      }
    }
    if (shade.state === "stunned" || shade.state === "drain") {
    } else if (shade.state === "recoil") {
      const recoilStep = RECOIL_DIST / RECOIL_TICKS;
      shade.pos = moveWithObstacles(
        world.night,
        shade.pos,
        shade.recoil_dir[0] * recoilStep,
        shade.recoil_dir[1] * recoilStep,
        false
      );
    } else if (shade.state === "chase") {
      const dist = distanceXZ(playerPos, shade.pos);
      if (dist > SHADE_LOSE_DIST) {
        shade.state = "wander";
      } else if (dist > 1e-6) {
        const step = Math.min(dist, shadeSpeed * dt);
        const [ux, uz] = normDirXZ(playerPos[0] - shade.pos[0], playerPos[2] - shade.pos[2]);
        shade.pos = moveWithObstacles(world.night, shade.pos, ux * step, uz * step, false);
      }
    } else if (shade.state === "wander") {
      const dist = distanceXZ(playerPos, shade.pos);
      if (dist <= SHADE_DETECT_DIST) {
        shade.state = "chase";
        shade.target_lantern_id = null;
        shade.drain_ticks = 0;
      } else {
        const weakLanterns = nextLanterns.filter((l) => l.lit && l.fuel_ticks < lowFuelTicks).sort((a, b) => {
          const da = distanceXZ(shade.pos, a.pos);
          const db = distanceXZ(shade.pos, b.pos);
          if (Math.abs(da - db) > 1e-6) return da - db;
          return compareEntityId(a, b);
        });
        if (weakLanterns.length > 0) {
          const weak = weakLanterns[0];
          shade.target_lantern_id = weak.id;
          const dw = distanceXZ(shade.pos, weak.pos);
          if (dw <= SHADE_DRAIN_RADIUS) {
            shade.state = "drain";
            shade.drain_ticks = 0;
          } else {
            const step = Math.min(dw, shadeSpeed * dt);
            const [ux, uz] = normDirXZ(weak.pos[0] - shade.pos[0], weak.pos[2] - shade.pos[2]);
            shade.pos = moveWithObstacles(world.night, shade.pos, ux * step, uz * step, false);
            if (distanceXZ(shade.pos, weak.pos) <= SHADE_DRAIN_RADIUS) {
              shade.state = "drain";
              shade.drain_ticks = 0;
            }
          }
        } else {
          const unlitLanterns = nextLanterns.filter((l) => !l.lit).sort((a, b) => {
            const da = distanceXZ(shade.pos, a.pos);
            const db = distanceXZ(shade.pos, b.pos);
            if (Math.abs(da - db) > 1e-6) return da - db;
            return compareEntityId(a, b);
          });
          if (unlitLanterns.length > 0) {
            const unlit = unlitLanterns[0];
            const du = distanceXZ(shade.pos, unlit.pos);
            if (du > 1) {
              const step = Math.min(du, SHADE_WANDER_SPEED * dt);
              const [ux, uz] = normDirXZ(unlit.pos[0] - shade.pos[0], unlit.pos[2] - shade.pos[2]);
              shade.pos = moveWithObstacles(world.night, shade.pos, ux * step, uz * step, false);
            }
          } else {
            shade.wander_angle += 0.025;
            const step = SHADE_WANDER_SPEED * dt;
            shade.pos = moveWithObstacles(
              world.night,
              shade.pos,
              Math.cos(shade.wander_angle) * step,
              Math.sin(shade.wander_angle) * step,
              false
            );
          }
        }
      }
    }
    if (shade.repel_ticks_left === 0 && shade.state !== "drain") {
      shade.pos = enforceSafeRadiusXZ(world.night, shade.pos, nextLanterns, tuning.safe_radius, lowFuelTicks);
    }
  }
  for (const drifter of nextDrifters) {
    if (drifter.just_spawned) continue;
    if (drifter.state === "idle" || drifter.state === "chase") {
      const dist = distanceXZ(playerPos, drifter.pos);
      drifter.state = carried >= 5 && dist <= DRIFTER_DETECT_DIST ? "chase" : "idle";
    }
    if (drifter.state === "idle") {
      drifter.orbit_angle += 0.04;
      const step = DRIFTER_IDLE_SPEED * dt;
      drifter.pos = [
        drifter.pos[0] + Math.cos(drifter.orbit_angle) * step,
        drifter.pos[1],
        drifter.pos[2] + Math.sin(drifter.orbit_angle) * step
      ];
    } else if (drifter.state === "chase") {
      const dist = distanceXZ(playerPos, drifter.pos);
      if (dist > 1e-6) {
        const step = Math.min(dist, DRIFTER_SPEED * dt);
        const [ux, uz] = normDirXZ(playerPos[0] - drifter.pos[0], playerPos[2] - drifter.pos[2]);
        drifter.pos = [
          drifter.pos[0] + ux * step,
          drifter.pos[1],
          drifter.pos[2] + uz * step
        ];
      }
    } else if (drifter.state === "flee") {
      const [ux, uz] = normDirXZ(drifter.pos[0] - playerPos[0], drifter.pos[2] - playerPos[2], [1, 0]);
      const step = DRIFTER_SPEED * dt;
      drifter.pos = [
        drifter.pos[0] + ux * step,
        drifter.pos[1],
        drifter.pos[2] + uz * step
      ];
    }
  }
  if (fallWaitTicks === 0 && py >= -10) {
    const sortedDrifters = [...nextDrifters].sort(compareEntityId);
    for (const drifter of sortedDrifters) {
      if (!drifter.just_spawned && !drifter.has_stolen && drifter.state !== "flee" && carried >= 5 && distanceXZ(playerPos, drifter.pos) <= DRIFTER_STEAL_RADIUS && Math.abs(playerPos[1] - drifter.pos[1]) <= 2) {
        const amount = Math.min(3, carried);
        carried -= amount;
        drifter.stolen = amount;
        drifter.has_stolen = true;
        drifter.state = "flee";
        drifter.state_ticks_left = DRIFTER_FLEE_TICKS;
        events.push({
          type: "event",
          tick: nextTick,
          name: "drifter_steal",
          data: { drifter_id: drifter.id, amount, carried }
        });
      }
    }
    const sortedShades = [...nextShades].sort(compareEntityId);
    let hitTakenThisTick = false;
    for (const shade of sortedShades) {
      if (hitTakenThisTick || invulnTicks > 0 || flames <= 0) break;
      if ((shade.state === "chase" || shade.state === "wander") && shade.repel_ticks_left === 0 && distanceXZ(playerPos, shade.pos) <= tuning.shade_hit_radius && Math.abs(playerPos[1] - shade.pos[1]) <= 1.5) {
        hitTakenThisTick = true;
        flames = Math.max(0, flames - 1);
        invulnTicks = invulnDurationTicks;
        const dropped = Math.floor(carried * tuning.hit_drop_ratio);
        carried -= dropped;
        const baseFloorY = getSupportY(world.night, playerPos[0], playerPos[2], playerPos[1]) ?? 0;
        for (let i = 0; i < dropped; i++) {
          let ang;
          let ringR;
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
            kind: "dropped",
            ttl_ticks: DROPPED_MOTE_TTL_TICKS,
            just_spawned: true
          });
        }
        shade.state = "recoil";
        shade.state_ticks_left = RECOIL_TICKS;
        shade.recoil_dir = normDirXZ(shade.pos[0] - playerPos[0], shade.pos[2] - playerPos[2], [1, 0]);
        events.push({
          type: "event",
          tick: nextTick,
          name: "player_hit",
          data: { by: "shade", flames, dropped }
        });
      }
    }
  }
  if (world.random_motes && nextSimTick % MOTE_SPAWN_INTERVAL === 0 && nextMotes.length < MAX_MOTE_COUNT) {
    const emptyPts = mapSpec.moteSpawnPoints.filter(
      (pt) => nextMotes.every((m) => distanceXZ(m.pos, pt) > 0.5)
    );
    if (emptyPts.length > 0) {
      let rVal;
      [rVal, rngState] = nextRandom(rngState);
      const pt = emptyPts[Math.floor(rVal * emptyPts.length)];
      nextMotes.push({
        id: `M${nextMoteSeq++}`,
        pos: [pt[0], pt[1], pt[2]],
        kind: "random",
        ttl_ticks: null,
        just_spawned: true
      });
    }
  }
  let nextShadeSeq = world.next_shade_seq;
  if (world.random_shades && nextSimTick >= 300) {
    const shouldSpawnCount = nextSimTick === 300 ? Math.min(2, mapSpec.maxShades - nextShades.length) : (nextSimTick - 300) % mapSpec.shadeIntervalTicks === 0 && nextShades.length < mapSpec.maxShades ? 1 : 0;
    for (let k = 0; k < shouldSpawnCount; k++) {
      const validPts = mapSpec.shadeSpawnPoints.filter(
        (pt2) => distanceXZ(pt2, playerPos) >= 15 && nextLanterns.every(
          (l) => !l.lit || l.fuel_ticks < lowFuelTicks || distanceXZ(pt2, l.pos) >= tuning.safe_radius
        ) && nextShades.every((s) => distanceXZ(s.pos, pt2) > 1.5)
      );
      if (validPts.length === 0) break;
      let rVal;
      [rVal, rngState] = nextRandom(rngState);
      const pt = validPts[Math.floor(rVal * validPts.length)];
      const newId = `S${nextShadeSeq++}`;
      nextShades.push({
        id: newId,
        pos: [pt[0], pt[1], pt[2]],
        state: "spawning",
        state_ticks_left: 1,
        push_ticks_left: 0,
        push_dir: [1, 0],
        recoil_dir: [1, 0],
        repel_lantern_id: null,
        repel_ticks_left: 0,
        target_lantern_id: null,
        drain_ticks: 0,
        wander_angle: nextShadeSeq * 0.9
      });
      events.push({
        type: "event",
        tick: nextTick,
        name: "shade_spawned",
        data: { id: newId }
      });
    }
  }
  let nextDrifterSeq = world.next_drifter_seq;
  if (world.night >= 2 && world.random_drifters && nextSimTick % DRIFTER_SPAWN_INTERVAL === 0 && nextDrifters.length < MAX_DRIFTERS) {
    const pts = mapSpec.shadeSpawnPoints;
    if (pts.length > 0) {
      let rVal;
      [rVal, rngState] = nextRandom(rngState);
      const pt = pts[Math.floor(rVal * pts.length)];
      const newId = `D${nextDrifterSeq++}`;
      nextDrifters.push({
        id: newId,
        pos: [pt[0], pt[1] + 1, pt[2]],
        state: "idle",
        state_ticks_left: 0,
        stolen: 0,
        has_stolen: false,
        orbit_angle: nextDrifterSeq * 1.2,
        just_spawned: true
      });
    }
  }
  let nextState = "playing";
  if (flames <= 0) {
    nextState = "lost";
    events.push({
      type: "event",
      tick: nextTick,
      name: "game_over",
      data: { result: "lost", reason: "no_flames" }
    });
  } else if (nextTimeLeft <= 0) {
    const litLanterns = nextLanterns.filter((l) => l.lit);
    const requiredLit = Math.ceil(tuning.win_ratio * nextLanterns.length);
    if (litLanterns.length >= requiredLit) {
      nextState = "won";
      for (const l of litLanterns) {
        score += 50 + Math.floor(l.fuel_ticks / 60);
      }
      score += flames * tuning.score.per_flame_left;
      events.push({
        type: "event",
        tick: nextTick,
        name: "game_over",
        data: { result: "won", reason: "dawn_survived" }
      });
    } else {
      nextState = "lost";
      events.push({
        type: "event",
        tick: nextTick,
        name: "game_over",
        data: { result: "lost", reason: "lanterns_short" }
      });
    }
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
      successful_lights: successfulLights,
      capacity,
      grounded,
      invuln_ticks: invulnTicks,
      dash_cd_ticks: dashCdTicks,
      dash_ticks_left: dashTicksLeft,
      dash_dir: dashDir,
      pulse_cd_ticks: pulseCdTicks,
      charm_ticks: charmTicks,
      fall_wait_ticks: fallWaitTicks,
      launch_active: launchActive,
      launch_vel_xz: launchVelXZ
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
    last_pulse_tick: lastPulseTick
  };
}
function formatSnapshot(world) {
  return {
    type: "snapshot",
    tick: world.tick,
    sim_tick: world.sim_tick,
    night: world.night,
    state: world.state,
    time_left_s: round3(world.time_left_s),
    score: world.score,
    wind: {
      active: world.wind.active,
      dir_deg: round3(world.wind.dir_deg)
    },
    player: {
      pos: roundVec3(world.player.pos),
      vel: roundVec3(world.player.vel),
      flames: world.player.flames,
      carried: world.player.carried,
      capacity: world.player.capacity,
      grounded: world.player.grounded,
      invuln: world.player.invuln_ticks > 0,
      dash_cd_s: round3(world.player.dash_cd_ticks / 60),
      pulse_cd_s: round3(world.player.pulse_cd_ticks / 60),
      charm_s: round3(world.player.charm_ticks / 60)
    },
    lanterns: world.lanterns.map((l) => ({
      id: l.id,
      pos: roundVec3(l.pos),
      lit: l.lit,
      deposited: l.deposited,
      fuel: l.lit ? round1(l.fuel_ticks / 60) : 0,
      ever_lit: l.ever_lit,
      relit_count: l.relit_count
    })),
    shades: world.shades.map((s) => ({
      id: s.id,
      pos: roundVec3(s.pos),
      state: s.state
    })),
    motes_active: world.motes.length,
    motes: world.motes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos),
      kind: m.kind,
      ttl_s: m.ttl_ticks !== null ? round3(m.ttl_ticks / 60) : null
    })),
    drifters: world.drifters.map((d) => ({
      id: d.id,
      pos: roundVec3(d.pos),
      state: d.state,
      stolen: d.stolen
    })),
    charms: world.charms.map((c) => ({
      id: c.id,
      available: c.available,
      respawn_s: round3(c.respawn_ticks / 60)
    }))
  };
}

// src/headless/cli.ts
var ValidationError = class extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
  exitCode;
};
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isVec3Tuple(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}
function parseArgs(argv) {
  let seed;
  let night = 1;
  let ticks;
  let snapshotEvery = 10;
  let scenarioPath;
  let inputsPath;
  let outPath;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--seed") {
      if (!next) throw new ValidationError("Missing value for --seed", 1);
      seed = Number(next);
      i++;
    } else if (arg === "--night") {
      if (!next) throw new ValidationError("Missing value for --night", 1);
      night = Number(next);
      i++;
    } else if (arg === "--ticks") {
      if (!next) throw new ValidationError("Missing value for --ticks", 1);
      ticks = Number(next);
      i++;
    } else if (arg === "--snapshot-every") {
      if (!next) throw new ValidationError("Missing value for --snapshot-every", 1);
      snapshotEvery = Number(next);
      i++;
    } else if (arg === "--scenario") {
      if (!next) throw new ValidationError("Missing value for --scenario", 1);
      scenarioPath = next;
      i++;
    } else if (arg === "--inputs") {
      if (!next) throw new ValidationError("Missing value for --inputs", 1);
      inputsPath = next;
      i++;
    } else if (arg === "--out") {
      if (!next) throw new ValidationError("Missing value for --out", 1);
      outPath = next;
      i++;
    } else {
      throw new ValidationError(`Unknown argument: ${arg}`, 1);
    }
  }
  if (seed === void 0 || !Number.isInteger(seed)) {
    throw new ValidationError("--seed <int> is required and must be an integer", 1);
  }
  if (!Number.isInteger(night) || night < 1 || night > 3) {
    throw new ValidationError("--night must be 1, 2, or 3", 1);
  }
  if (ticks === void 0 || !Number.isInteger(ticks) || ticks < 0) {
    throw new ValidationError("--ticks <int> is required and must be an integer >= 0", 1);
  }
  if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
    throw new ValidationError("--snapshot-every must be an integer >= 1", 1);
  }
  return {
    seed,
    night,
    ticks,
    snapshotEvery,
    scenarioPath,
    inputsPath,
    outPath
  };
}
function loadScenario(filePath) {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), "utf8");
  } catch (err) {
    throw new ValidationError(`Cannot read scenario file ${filePath}: ${err.message}`, 2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in scenario file ${filePath}: ${err.message}`, 2);
  }
  if (!isPlainObject(parsed)) {
    throw new ValidationError("Scenario must be a JSON object", 2);
  }
  if (parsed.player !== void 0) {
    if (!isPlainObject(parsed.player)) {
      throw new ValidationError("scenario.player must be an object", 2);
    }
    if (parsed.player.pos !== void 0 && !isVec3Tuple(parsed.player.pos)) {
      throw new ValidationError("scenario.player.pos must be [x, y, z]", 2);
    }
    for (const k of [
      "carried",
      "flames",
      "successful_lights",
      "invuln_ticks",
      "dash_cd_ticks",
      "pulse_cd_ticks",
      "charm_ticks"
    ]) {
      if (parsed.player[k] !== void 0 && (typeof parsed.player[k] !== "number" || !Number.isFinite(parsed.player[k]) || parsed.player[k] < 0)) {
        throw new ValidationError(`scenario.player.${k} must be a non-negative number`, 2);
      }
    }
  }
  for (const b of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (parsed[b] !== void 0 && typeof parsed[b] !== "boolean") {
      throw new ValidationError(`scenario.${b} must be boolean`, 2);
    }
  }
  if (parsed.motes !== void 0) {
    if (!Array.isArray(parsed.motes)) {
      throw new ValidationError("scenario.motes must be an array", 2);
    }
    for (const m of parsed.motes) {
      if (!isVec3Tuple(m) && !(isPlainObject(m) && isVec3Tuple(m.pos) && (m.id === void 0 || typeof m.id === "string"))) {
        throw new ValidationError("Each mote in scenario.motes must be [x,y,z] or {id?, pos:[x,y,z]}", 2);
      }
      if (isPlainObject(m)) {
        if (m.kind !== void 0 && m.kind !== "random" && m.kind !== "dropped") {
          throw new ValidationError('scenario.motes[].kind must be "random" or "dropped"', 2);
        }
        if (m.ttl_s !== void 0 && m.ttl_s !== null && (typeof m.ttl_s !== "number" || !Number.isFinite(m.ttl_s) || m.ttl_s < 0)) {
          throw new ValidationError("scenario.motes[].ttl_s must be null or non-negative number", 2);
        }
      }
    }
  }
  if (parsed.shades !== void 0) {
    if (!Array.isArray(parsed.shades)) {
      throw new ValidationError("scenario.shades must be an array", 2);
    }
    for (const s of parsed.shades) {
      if (!isVec3Tuple(s) && !(isPlainObject(s) && isVec3Tuple(s.pos) && (s.id === void 0 || typeof s.id === "string"))) {
        throw new ValidationError("Each shade in scenario.shades must be {id?, pos:[x,y,z]} or [x,y,z]", 2);
      }
      if (isPlainObject(s) && s.state !== void 0 && !["spawning", "wander", "chase", "recoil", "stunned", "drain"].includes(String(s.state))) {
        throw new ValidationError("Invalid shade state in scenario.shades", 2);
      }
      if (isPlainObject(s) && s.target_lantern_id !== void 0 && typeof s.target_lantern_id !== "string") {
        throw new ValidationError("scenario.shades[].target_lantern_id must be a string", 2);
      }
    }
  }
  if (parsed.drifters !== void 0) {
    if (!Array.isArray(parsed.drifters)) {
      throw new ValidationError("scenario.drifters must be an array", 2);
    }
    for (const d of parsed.drifters) {
      if (!isPlainObject(d) || !isVec3Tuple(d.pos)) {
        throw new ValidationError("Each drifter in scenario.drifters must have pos:[x,y,z]", 2);
      }
      if (d.state !== void 0 && !["idle", "chase", "flee"].includes(String(d.state))) {
        throw new ValidationError("scenario.drifters[].state must be idle, chase, or flee", 2);
      }
      if (d.stolen !== void 0 && (typeof d.stolen !== "number" || !Number.isFinite(d.stolen) || d.stolen < 0)) {
        throw new ValidationError("scenario.drifters[].stolen must be a non-negative number", 2);
      }
    }
  }
  if (parsed.charms !== void 0) {
    if (!Array.isArray(parsed.charms)) {
      throw new ValidationError("scenario.charms must be an array", 2);
    }
    for (const c of parsed.charms) {
      if (!isPlainObject(c)) {
        throw new ValidationError("Each charm in scenario.charms must be an object", 2);
      }
      if (c.pos !== void 0 && !isVec3Tuple(c.pos)) {
        throw new ValidationError("scenario.charms[].pos must be [x, y, z]", 2);
      }
      if (c.available !== void 0 && typeof c.available !== "boolean") {
        throw new ValidationError("scenario.charms[].available must be boolean", 2);
      }
      if (c.respawn_s !== void 0 && (typeof c.respawn_s !== "number" || !Number.isFinite(c.respawn_s) || c.respawn_s < 0)) {
        throw new ValidationError("scenario.charms[].respawn_s must be a non-negative number", 2);
      }
    }
  }
  if (parsed.lanterns !== void 0) {
    if (!Array.isArray(parsed.lanterns)) {
      throw new ValidationError("scenario.lanterns must be an array", 2);
    }
    for (const l of parsed.lanterns) {
      if (!isPlainObject(l) || typeof l.id !== "string") {
        throw new ValidationError("Each lantern in scenario.lanterns must have string id", 2);
      }
      if (l.pos !== void 0 && !isVec3Tuple(l.pos)) {
        throw new ValidationError("scenario.lanterns[].pos must be [x, y, z]", 2);
      }
      if (l.deposited !== void 0 && (typeof l.deposited !== "number" || !Number.isFinite(l.deposited) || l.deposited < 0)) {
        throw new ValidationError("scenario.lanterns[].deposited must be a non-negative number", 2);
      }
      if (l.lit !== void 0 && typeof l.lit !== "boolean") {
        throw new ValidationError("scenario.lanterns[].lit must be a boolean", 2);
      }
      if (l.fuel !== void 0 && (typeof l.fuel !== "number" || !Number.isFinite(l.fuel) || l.fuel < 0 || l.fuel > 100)) {
        throw new ValidationError("scenario.lanterns[].fuel must be a number in [0, 100]", 2);
      }
      if (l.ever_lit !== void 0 && typeof l.ever_lit !== "boolean") {
        throw new ValidationError("scenario.lanterns[].ever_lit must be a boolean", 2);
      }
    }
  }
  if (parsed.time_left_s !== void 0 && (typeof parsed.time_left_s !== "number" || !Number.isFinite(parsed.time_left_s) || parsed.time_left_s < 0)) {
    throw new ValidationError("scenario.time_left_s must be a non-negative number", 2);
  }
  return parsed;
}
function loadInputs(filePath) {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), "utf8");
  } catch (err) {
    throw new ValidationError(`Cannot read inputs file ${filePath}: ${err.message}`, 2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in inputs file ${filePath}: ${err.message}`, 2);
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.frames)) {
    throw new ValidationError("Inputs file must be an object with a frames array", 2);
  }
  let prevTick = -1;
  for (const frame of parsed.frames) {
    if (!isPlainObject(frame)) {
      throw new ValidationError("Each frame in inputs.frames must be an object", 2);
    }
    if (typeof frame.tick !== "number" || !Number.isInteger(frame.tick) || frame.tick < 0) {
      throw new ValidationError("Each frame.tick must be a non-negative integer", 2);
    }
    if (frame.tick <= prevTick) {
      throw new ValidationError(
        `Frame ticks must be strictly increasing (got ${frame.tick} after ${prevTick})`,
        2
      );
    }
    prevTick = frame.tick;
    if (frame.move !== void 0) {
      if (!Array.isArray(frame.move) || frame.move.length !== 2 || frame.move.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < -1 || n > 1)) {
        throw new ValidationError("frame.move must be [x, z] with numbers in [-1, 1]", 2);
      }
    }
    if (frame.cam_yaw_deg !== void 0 && (typeof frame.cam_yaw_deg !== "number" || !Number.isFinite(frame.cam_yaw_deg))) {
      throw new ValidationError("frame.cam_yaw_deg must be a finite number", 2);
    }
    for (const key of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (frame[key] !== void 0 && typeof frame[key] !== "boolean") {
        throw new ValidationError(`frame.${key} must be a boolean`, 2);
      }
    }
  }
  return parsed.frames;
}
function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const scenario = args.scenarioPath ? loadScenario(args.scenarioPath) : void 0;
    const frames = args.inputsPath ? loadInputs(args.inputsPath) : [];
    let world = createWorld({
      seed: args.seed,
      night: args.night,
      scenario
    });
    const lines = [];
    lines.push(JSON.stringify(formatSnapshot(world)));
    const currentInput = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false
    };
    let frameIdx = 0;
    for (let k = 0; k < args.ticks; k++) {
      while (frameIdx < frames.length && frames[frameIdx].tick === k) {
        const f = frames[frameIdx++];
        if (f.move !== void 0) currentInput.move = [f.move[0], f.move[1]];
        if (f.cam_yaw_deg !== void 0) currentInput.cam_yaw_deg = f.cam_yaw_deg;
        if (f.jump !== void 0) currentInput.jump = f.jump;
        if (f.interact !== void 0) currentInput.interact = f.interact;
        if (f.pulse !== void 0) currentInput.pulse = f.pulse;
        if (f.dash !== void 0) currentInput.dash = f.dash;
        if (f.pause !== void 0) currentInput.pause = f.pause;
      }
      world = stepWorld(world, currentInput, FIXED_DT);
      for (const ev of world.last_events) {
        lines.push(JSON.stringify(ev));
      }
      if ((k + 1) % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(formatSnapshot(world)));
      }
      if (world.state === "won" || world.state === "lost") {
        break;
      }
    }
    const endRecord = {
      type: "end",
      ticks: world.tick,
      state: world.state,
      score: world.score
    };
    lines.push(JSON.stringify(endRecord));
    const outputText = lines.join("\n") + "\n";
    if (args.outPath) {
      const resolvedOut = resolve(process.cwd(), args.outPath);
      mkdirSync(dirname(resolvedOut), { recursive: true });
      writeFileSync(resolvedOut, outputText, "utf8");
    } else {
      process.stdout.write(outputText);
    }
    process.exit(0);
  } catch (err) {
    if (err instanceof ValidationError) {
      process.stderr.write(`Error: ${err.message}
`);
      process.exit(err.exitCode);
    }
    process.stderr.write(`Error: ${err.message}
`);
    process.exit(1);
  }
}
main();
