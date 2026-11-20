import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputState } from '../core/types.js';
import { createWorld, stepWorld } from '../core/world.js';

interface ScenarioBlock {
  ticks: number;
  input: InputState;
}

interface ScenarioFile {
  name?: string;
  seed?: number;
  dt?: number;
  steps: ScenarioBlock[];
}

function parseArgs(argv: string[]): {
  seed: number;
  ticks: number;
  dt: number;
  scenarioPath?: string;
  pretty: boolean;
} {
  let seed = 2026;
  let ticks = 120;
  let dt = 1 / 60;
  let scenarioPath: string | undefined;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--seed' && argv[i + 1]) {
      seed = Number(argv[++i]);
    } else if (arg === '--ticks' && argv[i + 1]) {
      ticks = Number(argv[++i]);
    } else if (arg === '--dt' && argv[i + 1]) {
      dt = Number(argv[++i]);
    } else if (arg === '--scenario' && argv[i + 1]) {
      scenarioPath = argv[++i];
    } else if (arg === '--pretty') {
      pretty = true;
    }
  }

  return { seed, ticks, dt, scenarioPath, pretty };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  let world = createWorld({ seed: args.seed });
  let dt = args.dt;

  if (args.scenarioPath) {
    const raw = readFileSync(resolve(process.cwd(), args.scenarioPath), 'utf8');
    const scenario = JSON.parse(raw) as ScenarioFile;
    world = createWorld({ seed: scenario.seed ?? args.seed });
    dt = scenario.dt ?? args.dt;
    for (const block of scenario.steps) {
      for (let t = 0; t < block.ticks; t++) {
        world = stepWorld(world, block.input, dt);
      }
    }
  } else {
    const defaultInput: InputState = { moveX: 0, moveZ: 1, interact: true };
    for (let t = 0; t < args.ticks; t++) {
      world = stepWorld(world, defaultInput, dt);
    }
  }

  const summary = {
    seed: world.seed,
    tick: world.tick,
    time: world.time,
    status: world.status,
    player: world.player,
    firefliesCollected: world.fireflies.filter((f) => f.collected).length,
    lanternsLit: world.lanterns.filter((l) => l.lit).length,
    shadowPositions: world.shadows.map((s) => ({ id: s.id, pos: s.pos })),
  };

  process.stdout.write(JSON.stringify(summary, null, args.pretty ? 2 : 0) + '\n');
}

main();
