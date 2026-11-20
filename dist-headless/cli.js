// src/headless/cli.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
var ISLAND_RADIUS = 40;
var LANTERN_RING_RADIUS = 25;
var DEFAULT_RANDOM_MOTE_COUNT = 25;
var DEFAULT_RANDOM_SHADE_COUNT = 3;
var JUMP_VELOCITY = 6.5;
var GRAVITY = 18;
var DEFAULT_TUNING = {
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
    per_flame_left: 50
  }
};
function round3(n) {
  const v = Math.round(n * 1e3) / 1e3;
  return v === 0 ? 0 : v;
}
function decrementTimer(current, dt) {
  const next = current - dt;
  return next <= 1e-9 ? 0 : next;
}
function roundVec3(v) {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}
function distanceXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
function clampXZ(pos, maxRadius) {
  const r = Math.hypot(pos[0], pos[2]);
  if (r <= maxRadius || r === 0) {
    return pos;
  }
  const scale = maxRadius / r;
  return [pos[0] * scale, pos[1], pos[2] * scale];
}
function enforceSafeRadius(pos, lanterns, safeRadius) {
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
function createWorld(options = {}) {
  const seed = options.seed ?? 2026;
  const night = options.night ?? 1;
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const scenario = options.scenario;
  let rngState = normalizeSeed(seed);
  const lanterns = [];
  for (let i = 0; i < tuning.lantern_count_night1; i++) {
    const angle = i * 2 * Math.PI / Math.max(1, tuning.lantern_count_night1);
    lanterns.push({
      id: `L${i + 1}`,
      pos: [
        round3(LANTERN_RING_RADIUS * Math.sin(angle)),
        0,
        round3(LANTERN_RING_RADIUS * Math.cos(angle))
      ],
      lit: false,
      deposited: 0
    });
  }
  if (scenario?.lanterns) {
    for (const override of scenario.lanterns) {
      const target = lanterns.find((l) => l.id === override.id);
      if (!target) continue;
      if (override.pos) {
        target.pos = [override.pos[0], override.pos[1], override.pos[2]];
      }
      if (typeof override.deposited === "number") {
        target.deposited = Math.max(0, override.deposited);
      }
      if (typeof override.lit === "boolean") {
        target.lit = override.lit;
        if (override.lit && override.deposited === void 0 && target.deposited < tuning.lantern_cost) {
          target.deposited = tuning.lantern_cost;
        }
      } else if (target.deposited >= tuning.lantern_cost) {
        target.lit = true;
      }
    }
  }
  let motes = [];
  if (scenario?.motes !== void 0) {
    motes = scenario.motes.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return { id: `M${idx + 1}`, pos: [entry[0], entry[1], entry[2]], active: true };
      }
      return {
        id: entry.id ?? `M${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        active: true
      };
    });
  } else if (scenario?.random_motes !== false) {
    for (let i = 0; i < DEFAULT_RANDOM_MOTE_COUNT; i++) {
      let angle;
      let r;
      [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
      [r, rngState] = nextRange(rngState, 4, 34);
      motes.push({
        id: `M${i + 1}`,
        pos: [round3(Math.cos(angle) * r), 0, round3(Math.sin(angle) * r)],
        active: true
      });
    }
  }
  let shades = [];
  if (scenario?.shades !== void 0) {
    shades = scenario.shades.map((entry, idx) => {
      if (Array.isArray(entry)) {
        return {
          id: `S${idx + 1}`,
          pos: [entry[0], entry[1], entry[2]],
          state: "chase",
          stun_left_s: 0
        };
      }
      return {
        id: entry.id ?? `S${idx + 1}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        state: "chase",
        stun_left_s: 0
      };
    });
  } else if (scenario?.random_shades !== false) {
    for (let i = 0; i < DEFAULT_RANDOM_SHADE_COUNT; i++) {
      let angle;
      let r;
      [angle, rngState] = nextRange(rngState, 0, Math.PI * 2);
      [r, rngState] = nextRange(rngState, 18, 30);
      shades.push({
        id: `S${i + 1}`,
        pos: [round3(Math.cos(angle) * r), 1, round3(Math.sin(angle) * r)],
        state: "chase",
        stun_left_s: 0
      });
    }
  }
  const playerPos = scenario?.player?.pos ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]] : [0, 0, 0];
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
    state: "playing",
    score: 0,
    map_radius: maxEntityDist,
    player: {
      pos: playerPos,
      vy: 0,
      yaw_rad: 0,
      flames: scenario?.player?.flames ?? tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      invuln_left_s: 0,
      pulse_cd_left_s: 0
    },
    motes,
    lanterns,
    shades,
    prev_buttons: { jump: false, interact: false, pulse: false, dash: false },
    last_events: [],
    last_pulse_tick: -999
  };
}
function stepWorld(world, input, dt = FIXED_DT) {
  if (world.state !== "playing") {
    return { ...world, last_events: [] };
  }
  const tuning = world.tuning;
  const nextTick = world.tick + 1;
  const nextTimeLeft = Math.max(0, world.initial_time_left_s - nextTick / 60);
  const events = [];
  let score = world.score;
  let invulnLeft = decrementTimer(world.player.invuln_left_s, dt);
  let pulseCdLeft = decrementTimer(world.player.pulse_cd_left_s, dt);
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
  let px = world.player.pos[0] + wx * tuning.player_speed * dt;
  let py = world.player.pos[1];
  let pz = world.player.pos[2] + wz * tuning.player_speed * dt;
  [px, py, pz] = clampXZ([px, py, pz], world.map_radius);
  const yawRad = Math.hypot(wx, wz) > 1e-5 ? Math.atan2(wx, wz) : world.player.yaw_rad;
  const jumpPressed = input.jump && !world.prev_buttons.jump;
  const interactPressed = input.interact && !world.prev_buttons.interact;
  const pulsePressed = input.pulse && !world.prev_buttons.pulse;
  let vy = world.player.vy;
  if (jumpPressed && py <= 1e-4) {
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
  const nextPlayerPos = [px, py, pz];
  let carried = world.player.carried;
  let flames = world.player.flames;
  let lastPulseTick = world.last_pulse_tick;
  const nextMotes = world.motes.map((mote) => {
    if (mote.active && carried < tuning.carry_capacity && distanceXZ(nextPlayerPos, mote.pos) <= tuning.pickup_radius) {
      carried += 1;
      score += tuning.score.per_mote;
      events.push({
        type: "event",
        tick: nextTick,
        name: "mote_picked",
        data: { carried }
      });
      return { ...mote, active: false };
    }
    return mote;
  });
  const nextLanterns = world.lanterns.map((l) => ({ ...l }));
  if (interactPressed && carried > 0) {
    let bestLantern = null;
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
          type: "event",
          tick: nextTick,
          name: "deposit",
          data: {
            lantern_id: bestLantern.id,
            amount,
            deposited: bestLantern.deposited
          }
        });
        if (bestLantern.deposited >= tuning.lantern_cost) {
          bestLantern.lit = true;
          score += tuning.score.per_lantern;
          events.push({
            type: "event",
            tick: nextTick,
            name: "lantern_lit",
            data: { lantern_id: bestLantern.id }
          });
        }
      }
    }
  }
  const justStunnedIds = /* @__PURE__ */ new Set();
  let nextShades = world.shades.map((s) => ({
    ...s,
    pos: [s.pos[0], s.pos[1], s.pos[2]]
  }));
  if (pulsePressed && carried >= tuning.pulse_cost && pulseCdLeft <= 0) {
    carried -= tuning.pulse_cost;
    pulseCdLeft = tuning.pulse_cooldown_s;
    lastPulseTick = nextTick;
    const stunnedIds = [];
    for (const shade of nextShades) {
      const dist = distanceXZ(nextPlayerPos, shade.pos);
      if (dist <= tuning.pulse_radius) {
        stunnedIds.push(shade.id);
        justStunnedIds.add(shade.id);
        shade.state = "stunned";
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
          shade.pos[2] + dirZ * tuning.pulse_push_m
        ];
      }
    }
    score += stunnedIds.length * tuning.score.per_stun;
    events.push({
      type: "event",
      tick: nextTick,
      name: "pulse",
      data: { stunned_ids: stunnedIds }
    });
  }
  for (const shade of nextShades) {
    if (!justStunnedIds.has(shade.id) && shade.stun_left_s > 0) {
      shade.stun_left_s = decrementTimer(shade.stun_left_s, dt);
      if (shade.stun_left_s <= 0) {
        shade.state = "chase";
      }
    }
    if (shade.state === "chase") {
      const dx = nextPlayerPos[0] - shade.pos[0];
      const dz = nextPlayerPos[2] - shade.pos[2];
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-6) {
        const step = Math.min(dist, tuning.shade_speed * dt);
        shade.pos = [
          shade.pos[0] + dx / dist * step,
          shade.pos[1],
          shade.pos[2] + dz / dist * step
        ];
      }
    }
    shade.pos = enforceSafeRadius(shade.pos, nextLanterns, tuning.safe_radius);
    shade.pos = clampXZ(shade.pos, world.map_radius);
    if (shade.state !== "stunned" && invulnLeft <= 0 && flames > 0 && distanceXZ(nextPlayerPos, shade.pos) <= tuning.shade_hit_radius) {
      const dropped = Math.floor(carried * tuning.hit_drop_ratio);
      carried -= dropped;
      flames = Math.max(0, flames - 1);
      invulnLeft = tuning.invuln_s;
      events.push({
        type: "event",
        tick: nextTick,
        name: "player_hit",
        data: { by: "shade", flames, dropped }
      });
    }
  }
  let nextState = "playing";
  if (nextLanterns.length > 0 && nextLanterns.every((l) => l.lit)) {
    nextState = "won";
    score += Math.floor(nextTimeLeft) * tuning.score.per_second_left + flames * tuning.score.per_flame_left;
    events.push({
      type: "event",
      tick: nextTick,
      name: "game_over",
      data: { result: "won", reason: "all_lit" }
    });
  } else if (flames <= 0) {
    nextState = "lost";
    events.push({
      type: "event",
      tick: nextTick,
      name: "game_over",
      data: { result: "lost", reason: "no_flames" }
    });
  } else if (nextTimeLeft <= 0) {
    nextState = "lost";
    events.push({
      type: "event",
      tick: nextTick,
      name: "game_over",
      data: { result: "lost", reason: "dawn" }
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
      pulse_cd_left_s: pulseCdLeft
    },
    motes: nextMotes,
    lanterns: nextLanterns,
    shades: nextShades,
    prev_buttons: {
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash
    },
    last_events: events,
    last_pulse_tick: lastPulseTick
  };
}
function formatSnapshot(world) {
  const activeMotes = world.motes.filter((m) => m.active);
  return {
    type: "snapshot",
    tick: world.tick,
    sim_tick: world.sim_tick,
    state: world.state,
    time_left_s: round3(world.time_left_s),
    score: world.score,
    player: {
      pos: roundVec3(world.player.pos),
      flames: world.player.flames,
      carried: world.player.carried
    },
    lanterns: world.lanterns.map((l) => ({
      id: l.id,
      pos: roundVec3(l.pos),
      lit: l.lit,
      deposited: l.deposited
    })),
    shades: world.shades.map((s) => ({
      id: s.id,
      pos: roundVec3(s.pos),
      state: s.state
    })),
    motes_active: activeMotes.length,
    motes: activeMotes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos)
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
  if (!Number.isInteger(night) || night < 1) {
    throw new ValidationError("--night must be an integer >= 1", 1);
  }
  if (ticks === void 0 || !Number.isInteger(ticks) || ticks < 0) {
    throw new ValidationError("--ticks <int> is required and must be an integer >= 0", 1);
  }
  if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
    throw new ValidationError("--snapshot-every must be an integer >= 1", 1);
  }
  return { seed, night, ticks, snapshotEvery, scenarioPath, inputsPath, outPath };
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
    if (parsed.player.carried !== void 0 && (typeof parsed.player.carried !== "number" || !Number.isFinite(parsed.player.carried) || parsed.player.carried < 0)) {
      throw new ValidationError("scenario.player.carried must be a non-negative number", 2);
    }
    if (parsed.player.flames !== void 0 && (typeof parsed.player.flames !== "number" || !Number.isFinite(parsed.player.flames) || parsed.player.flames < 0)) {
      throw new ValidationError("scenario.player.flames must be a non-negative number", 2);
    }
  }
  if (parsed.random_motes !== void 0 && typeof parsed.random_motes !== "boolean") {
    throw new ValidationError("scenario.random_motes must be boolean", 2);
  }
  if (parsed.random_shades !== void 0 && typeof parsed.random_shades !== "boolean") {
    throw new ValidationError("scenario.random_shades must be boolean", 2);
  }
  if (parsed.motes !== void 0) {
    if (!Array.isArray(parsed.motes)) {
      throw new ValidationError("scenario.motes must be an array", 2);
    }
    for (const m of parsed.motes) {
      if (!isVec3Tuple(m) && !(isPlainObject(m) && isVec3Tuple(m.pos) && (m.id === void 0 || typeof m.id === "string"))) {
        throw new ValidationError("Each mote in scenario.motes must be [x,y,z] or {id?, pos:[x,y,z]}", 2);
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
    for (const key of ["jump", "interact", "pulse", "dash"]) {
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
      dash: false
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
      }
      world = stepWorld(world, currentInput, FIXED_DT);
      for (const ev of world.last_events) {
        lines.push(JSON.stringify(ev));
      }
      if ((k + 1) % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(formatSnapshot(world)));
      }
      if (world.state !== "playing") {
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
