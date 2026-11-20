import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sanitizeLeaderboardEntries } from '../core/leaderboard.js';
import type {
  EndRecord,
  FrameInput,
  InputState,
  InputsFile,
  NightNumber,
  ScenarioConfig,
  Vec3Tuple,
} from '../core/types.js';
import { createWorld, FIXED_DT, formatSnapshot, stepWorld } from '../core/world.js';

function tryHandleLeaderboardExport(argv: string[]): boolean {
  const idx = argv.indexOf('--export-leaderboard');
  if (idx === -1) return false;
  const outPath = argv[idx + 1];
  if (!outPath) {
    throw new ValidationError('Missing value for --export-leaderboard', 1);
  }
  const storePath = resolve(process.cwd(), '.leaderboard.json');
  let entries = [] as ReturnType<typeof sanitizeLeaderboardEntries>;
  if (existsSync(storePath)) {
    const raw = JSON.parse(readFileSync(storePath, 'utf8')) as { entries?: unknown };
    entries = sanitizeLeaderboardEntries(raw.entries);
  }
  const resolvedOut = resolve(process.cwd(), outPath);
  mkdirSync(dirname(resolvedOut), { recursive: true });
  writeFileSync(resolvedOut, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
  return true;
}

interface CliArgs {
  seed: number;
  night: NightNumber;
  ticks: number;
  snapshotEvery: number;
  scenarioPath?: string;
  inputsPath?: string;
  outPath?: string;
}

class ValidationError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(message);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isVec3Tuple(v: unknown): v is Vec3Tuple {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function parseArgs(argv: string[]): CliArgs {
  let seed: number | undefined;
  let night = 1;
  let ticks: number | undefined;
  let snapshotEvery = 10;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let outPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed') {
      if (!next) throw new ValidationError('Missing value for --seed', 1);
      seed = Number(next);
      i++;
    } else if (arg === '--night') {
      if (!next) throw new ValidationError('Missing value for --night', 1);
      night = Number(next);
      i++;
    } else if (arg === '--ticks') {
      if (!next) throw new ValidationError('Missing value for --ticks', 1);
      ticks = Number(next);
      i++;
    } else if (arg === '--snapshot-every') {
      if (!next) throw new ValidationError('Missing value for --snapshot-every', 1);
      snapshotEvery = Number(next);
      i++;
    } else if (arg === '--scenario') {
      if (!next) throw new ValidationError('Missing value for --scenario', 1);
      scenarioPath = next;
      i++;
    } else if (arg === '--inputs') {
      if (!next) throw new ValidationError('Missing value for --inputs', 1);
      inputsPath = next;
      i++;
    } else if (arg === '--out') {
      if (!next) throw new ValidationError('Missing value for --out', 1);
      outPath = next;
      i++;
    } else {
      throw new ValidationError(`Unknown argument: ${arg}`, 1);
    }
  }

  if (seed === undefined || !Number.isInteger(seed)) {
    throw new ValidationError('--seed <int> is required and must be an integer', 1);
  }
  if (!Number.isInteger(night) || night < 1 || night > 3) {
    throw new ValidationError('--night must be 1, 2, or 3', 1);
  }
  if (ticks === undefined || !Number.isInteger(ticks) || ticks < 0) {
    throw new ValidationError('--ticks <int> is required and must be an integer >= 0', 1);
  }
  if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
    throw new ValidationError('--snapshot-every must be an integer >= 1', 1);
  }

  return {
    seed,
    night: night as NightNumber,
    ticks,
    snapshotEvery,
    scenarioPath,
    inputsPath,
    outPath,
  };
}

function loadScenario(filePath: string): ScenarioConfig {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  } catch (err) {
    throw new ValidationError(`Cannot read scenario file ${filePath}: ${(err as Error).message}`, 2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in scenario file ${filePath}: ${(err as Error).message}`, 2);
  }

  if (!isPlainObject(parsed)) {
    throw new ValidationError('Scenario must be a JSON object', 2);
  }

  if (parsed.player !== undefined) {
    if (!isPlainObject(parsed.player)) {
      throw new ValidationError('scenario.player must be an object', 2);
    }
    if (parsed.player.pos !== undefined && !isVec3Tuple(parsed.player.pos)) {
      throw new ValidationError('scenario.player.pos must be [x, y, z]', 2);
    }
    for (const k of [
      'carried',
      'flames',
      'successful_lights',
      'invuln_ticks',
      'dash_cd_ticks',
      'pulse_cd_ticks',
      'charm_ticks',
    ] as const) {
      if (
        parsed.player[k] !== undefined &&
        (typeof parsed.player[k] !== 'number' || !Number.isFinite(parsed.player[k]) || (parsed.player[k] as number) < 0)
      ) {
        throw new ValidationError(`scenario.player.${k} must be a non-negative number`, 2);
      }
    }
  }

  for (const b of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (parsed[b] !== undefined && typeof parsed[b] !== 'boolean') {
      throw new ValidationError(`scenario.${b} must be boolean`, 2);
    }
  }

  if (parsed.motes !== undefined) {
    if (!Array.isArray(parsed.motes)) {
      throw new ValidationError('scenario.motes must be an array', 2);
    }
    for (const m of parsed.motes) {
      if (
        !isVec3Tuple(m) &&
        !(isPlainObject(m) && isVec3Tuple(m.pos) && (m.id === undefined || typeof m.id === 'string'))
      ) {
        throw new ValidationError('Each mote in scenario.motes must be [x,y,z] or {id?, pos:[x,y,z]}', 2);
      }
      if (isPlainObject(m)) {
        if (m.kind !== undefined && m.kind !== 'random' && m.kind !== 'dropped') {
          throw new ValidationError('scenario.motes[].kind must be "random" or "dropped"', 2);
        }
        if (m.ttl_s !== undefined && m.ttl_s !== null && (typeof m.ttl_s !== 'number' || !Number.isFinite(m.ttl_s) || m.ttl_s < 0)) {
          throw new ValidationError('scenario.motes[].ttl_s must be null or non-negative number', 2);
        }
      }
    }
  }

  if (parsed.shades !== undefined) {
    if (!Array.isArray(parsed.shades)) {
      throw new ValidationError('scenario.shades must be an array', 2);
    }
    for (const s of parsed.shades) {
      if (
        !isVec3Tuple(s) &&
        !(isPlainObject(s) && isVec3Tuple(s.pos) && (s.id === undefined || typeof s.id === 'string'))
      ) {
        throw new ValidationError('Each shade in scenario.shades must be {id?, pos:[x,y,z]} or [x,y,z]', 2);
      }
      if (
        isPlainObject(s) &&
        s.state !== undefined &&
        !['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(String(s.state))
      ) {
        throw new ValidationError('Invalid shade state in scenario.shades', 2);
      }
      if (isPlainObject(s) && s.target_lantern_id !== undefined && typeof s.target_lantern_id !== 'string') {
        throw new ValidationError('scenario.shades[].target_lantern_id must be a string', 2);
      }
    }
  }

  if (parsed.drifters !== undefined) {
    if (!Array.isArray(parsed.drifters)) {
      throw new ValidationError('scenario.drifters must be an array', 2);
    }
    for (const d of parsed.drifters) {
      if (!isPlainObject(d) || !isVec3Tuple(d.pos)) {
        throw new ValidationError('Each drifter in scenario.drifters must have pos:[x,y,z]', 2);
      }
      if (d.state !== undefined && !['idle', 'chase', 'flee'].includes(String(d.state))) {
        throw new ValidationError('scenario.drifters[].state must be idle, chase, or flee', 2);
      }
      if (d.stolen !== undefined && (typeof d.stolen !== 'number' || !Number.isFinite(d.stolen) || d.stolen < 0)) {
        throw new ValidationError('scenario.drifters[].stolen must be a non-negative number', 2);
      }
    }
  }

  if (parsed.charms !== undefined) {
    if (!Array.isArray(parsed.charms)) {
      throw new ValidationError('scenario.charms must be an array', 2);
    }
    for (const c of parsed.charms) {
      if (!isPlainObject(c)) {
        throw new ValidationError('Each charm in scenario.charms must be an object', 2);
      }
      if (c.pos !== undefined && !isVec3Tuple(c.pos)) {
        throw new ValidationError('scenario.charms[].pos must be [x, y, z]', 2);
      }
      if (c.available !== undefined && typeof c.available !== 'boolean') {
        throw new ValidationError('scenario.charms[].available must be boolean', 2);
      }
      if (c.respawn_s !== undefined && (typeof c.respawn_s !== 'number' || !Number.isFinite(c.respawn_s) || c.respawn_s < 0)) {
        throw new ValidationError('scenario.charms[].respawn_s must be a non-negative number', 2);
      }
    }
  }

  if (parsed.lanterns !== undefined) {
    if (!Array.isArray(parsed.lanterns)) {
      throw new ValidationError('scenario.lanterns must be an array', 2);
    }
    for (const l of parsed.lanterns) {
      if (!isPlainObject(l) || typeof l.id !== 'string') {
        throw new ValidationError('Each lantern in scenario.lanterns must have string id', 2);
      }
      if (l.pos !== undefined && !isVec3Tuple(l.pos)) {
        throw new ValidationError('scenario.lanterns[].pos must be [x, y, z]', 2);
      }
      if (
        l.deposited !== undefined &&
        (typeof l.deposited !== 'number' || !Number.isFinite(l.deposited) || l.deposited < 0)
      ) {
        throw new ValidationError('scenario.lanterns[].deposited must be a non-negative number', 2);
      }
      if (l.lit !== undefined && typeof l.lit !== 'boolean') {
        throw new ValidationError('scenario.lanterns[].lit must be a boolean', 2);
      }
      if (l.fuel !== undefined && (typeof l.fuel !== 'number' || !Number.isFinite(l.fuel) || l.fuel < 0 || l.fuel > 100)) {
        throw new ValidationError('scenario.lanterns[].fuel must be a number in [0, 100]', 2);
      }
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') {
        throw new ValidationError('scenario.lanterns[].ever_lit must be a boolean', 2);
      }
    }
  }

  if (
    parsed.time_left_s !== undefined &&
    (typeof parsed.time_left_s !== 'number' || !Number.isFinite(parsed.time_left_s) || parsed.time_left_s < 0)
  ) {
    throw new ValidationError('scenario.time_left_s must be a non-negative number', 2);
  }

  return parsed as unknown as ScenarioConfig;
}

function loadInputs(filePath: string): FrameInput[] {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  } catch (err) {
    throw new ValidationError(`Cannot read inputs file ${filePath}: ${(err as Error).message}`, 2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in inputs file ${filePath}: ${(err as Error).message}`, 2);
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.frames)) {
    throw new ValidationError('Inputs file must be an object with a frames array', 2);
  }

  let prevTick = -1;
  for (const frame of parsed.frames) {
    if (!isPlainObject(frame)) {
      throw new ValidationError('Each frame in inputs.frames must be an object', 2);
    }
    if (typeof frame.tick !== 'number' || !Number.isInteger(frame.tick) || frame.tick < 0) {
      throw new ValidationError('Each frame.tick must be a non-negative integer', 2);
    }
    if (frame.tick <= prevTick) {
      throw new ValidationError(
        `Frame ticks must be strictly increasing (got ${frame.tick} after ${prevTick})`,
        2,
      );
    }
    prevTick = frame.tick;

    if (frame.move !== undefined) {
      if (
        !Array.isArray(frame.move) ||
        frame.move.length !== 2 ||
        frame.move.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < -1 || n > 1)
      ) {
        throw new ValidationError('frame.move must be [x, z] with numbers in [-1, 1]', 2);
      }
    }
    if (
      frame.cam_yaw_deg !== undefined &&
      (typeof frame.cam_yaw_deg !== 'number' || !Number.isFinite(frame.cam_yaw_deg))
    ) {
      throw new ValidationError('frame.cam_yaw_deg must be a finite number', 2);
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (frame[key] !== undefined && typeof frame[key] !== 'boolean') {
        throw new ValidationError(`frame.${key} must be a boolean`, 2);
      }
    }
  }

  return (parsed as unknown as InputsFile).frames;
}

function main(): void {
  try {
    const argv = process.argv.slice(2);
    if (tryHandleLeaderboardExport(argv)) {
      process.exit(0);
    }
    const args = parseArgs(argv);
    const scenario = args.scenarioPath ? loadScenario(args.scenarioPath) : undefined;
    const frames = args.inputsPath ? loadInputs(args.inputsPath) : [];

    let world = createWorld({
      seed: args.seed,
      night: args.night,
      scenario,
    });

    const lines: string[] = [];
    lines.push(JSON.stringify(formatSnapshot(world)));

    const currentInput: InputState = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };

    let frameIdx = 0;
    for (let k = 0; k < args.ticks; k++) {
      while (frameIdx < frames.length && frames[frameIdx].tick === k) {
        const f = frames[frameIdx++];
        if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
        if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
        if (f.jump !== undefined) currentInput.jump = f.jump;
        if (f.interact !== undefined) currentInput.interact = f.interact;
        if (f.pulse !== undefined) currentInput.pulse = f.pulse;
        if (f.dash !== undefined) currentInput.dash = f.dash;
        if (f.pause !== undefined) currentInput.pause = f.pause;
      }

      world = stepWorld(world, currentInput, FIXED_DT);

      for (const ev of world.last_events) {
        lines.push(JSON.stringify(ev));
      }

      if ((k + 1) % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(formatSnapshot(world)));
      }

      if (world.state === 'won' || world.state === 'lost') {
        break;
      }
    }

    const endRecord: EndRecord = {
      type: 'end',
      ticks: world.tick,
      state: world.state,
      score: world.score,
    };
    lines.push(JSON.stringify(endRecord));

    const outputText = lines.join('\n') + '\n';
    if (args.outPath) {
      const resolvedOut = resolve(process.cwd(), args.outPath);
      mkdirSync(dirname(resolvedOut), { recursive: true });
      writeFileSync(resolvedOut, outputText, 'utf8');
    } else {
      process.stdout.write(outputText);
    }

    process.exit(0);
  } catch (err) {
    if (err instanceof ValidationError) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(err.exitCode);
    }
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
