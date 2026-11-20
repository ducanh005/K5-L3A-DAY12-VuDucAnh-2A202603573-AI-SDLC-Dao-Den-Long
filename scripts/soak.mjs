import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';

function getGcFn() {
  if (typeof globalThis.gc === 'function') return globalThis.gc;
  try {
    v8.setFlagsFromString('--expose_gc');
    return vm.runInNewContext('gc');
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  let seed = 7;
  let nights = 10;
  let out = 'soak.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed') {
      if (!next || !Number.isInteger(Number(next))) {
        throw new Error('--seed must be an integer');
      }
      seed = Number(next);
      i++;
    } else if (arg === '--nights') {
      if (!next || !Number.isInteger(Number(next)) || Number(next) < 1) {
        throw new Error('--nights must be a positive integer');
      }
      nights = Number(next);
      i++;
    } else if (arg === '--out') {
      if (!next) throw new Error('Missing path for --out');
      out = next;
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { seed, nights, out };
}

function getRssMb() {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 100) / 100;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  const coreBundlePath = resolve(process.cwd(), 'dist-headless/core.js');
  if (!existsSync(coreBundlePath)) {
    execSync('npm run build:headless', { stdio: 'inherit' });
  }

  const { createWorld, stepWorld, FIXED_DT, normalizeSeed, nextRandom } = await import(
    new URL(`file:///${coreBundlePath.replace(/\\/g, '/')}`).href
  );

  const t0 = performance.now();
  const gc = getGcFn();
  const results = [];
  let crashes = 0;
  let memStartMb = 0;
  let currentWorld = null;

  for (let i = 0; i < opts.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = opts.seed + i;
    currentWorld = createWorld({ seed: nightSeed, night });
    if (i === 0) {
      if (gc) gc();
      memStartMb = getRssMb();
    }

    let rngState = normalizeSeed(nightSeed ^ 0x5a5a5a5a);
    let moveX = 0;
    let moveZ = 0;

    try {
      let guard = 0;
      while (currentWorld.state === 'playing' && guard < 25000) {
        guard++;
        if (currentWorld.sim_tick % 30 === 0) {
          let uAngle;
          [uAngle, rngState] = nextRandom(rngState);
          const theta = uAngle * Math.PI * 2;
          moveX = Math.cos(theta);
          moveZ = Math.sin(theta);
        }

        let uJump;
        let uDash;
        let uPulse;
        let uInteract;
        [uJump, rngState] = nextRandom(rngState);
        [uDash, rngState] = nextRandom(rngState);
        [uPulse, rngState] = nextRandom(rngState);
        [uInteract, rngState] = nextRandom(rngState);

        currentWorld = stepWorld(
          currentWorld,
          {
            move: [moveX, moveZ],
            cam_yaw_deg: 0,
            jump: uJump < 0.05,
            dash: uDash < 0.03,
            pulse: uPulse < 0.02,
            interact: uInteract < 0.1,
            pause: false,
          },
          FIXED_DT,
        );
      }
      results.push(currentWorld.state === 'won' ? 'won' : 'lost');
    } catch (err) {
      crashes++;
      results.push('lost');
      console.error(`Soak crash on night ${i + 1}: ${err.message}`);
    }
  }

  // Reset cleanly back to initial state after final night before measuring mem_end_mb
  currentWorld = createWorld({ seed: opts.seed, night: 1 });
  void currentWorld;
  if (gc) gc();

  const memEndMb = getRssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const report = {
    nights: opts.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const outPath = resolve(process.cwd(), opts.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Soak report written to ${opts.out}: ${JSON.stringify(report)}`);
  process.exit(crashes > 0 ? 1 : 0);
}

main();
