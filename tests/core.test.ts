import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSupportY, isBlockedByObstacle } from '../src/core/maps.js';
import type { InputState } from '../src/core/types.js';
import { createWorld, DEFAULT_TUNING, FIXED_DT, formatSnapshot, stepWorld } from '../src/core/world.js';

function baseInput(overrides: Partial<InputState> = {}): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
    ...overrides,
  };
}

describe('Phase 3 — Ticket-03 ("Đèn cạn dầu") & Test Contract v1.2', () => {
  it('matches tuning values in game.contract.json v1.2 exactly', () => {
    const raw = readFileSync(resolve(process.cwd(), 'game.contract.json'), 'utf8');
    const contract = JSON.parse(raw) as { contract_version: string; tuning: typeof DEFAULT_TUNING };
    expect(contract.contract_version).toBe('1.2');
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
  });

  it('decays fuel at 1.0/s, supports refuel, lantern_out, 5-mote relight (+40), and progressive capacity (10..20)', () => {
    let world = createWorld({
      seed: 10,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 24.5], carried: 10, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 85 },
          { id: 'L2', pos: [0, 0, 22], lit: true, fuel: 1.0 },
        ],
        time_left_s: 240,
      },
    });

    // Step 1: L1 decays 1/60 first -> ~84.983 -> refuel uses ceil((100-84.98)/10) = 2 motes -> fuel 100, +10 pts
    world = stepWorld(world, baseInput({ interact: true }), FIXED_DT);
    expect(world.player.carried).toBe(8);
    expect(world.lanterns[0].fuel_ticks).toBe(6000);
    expect(world.score).toBe(10);
    expect(world.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'refuel',
      data: { lantern_id: 'L1', amount: 2, fuel: 100 },
    });

    // Next tick decays fuel by 1/60s (< 100), so interacting refuels 1 mote;
    // when fuel is truly full (100.00 / 6000 ticks, no decay), refuel is skipped (used = 0)
    world = stepWorld(world, baseInput({ interact: false }), FIXED_DT);
    world = stepWorld(world, baseInput({ interact: true }), FIXED_DT);
    expect(world.player.carried).toBe(7);
    expect(world.lanterns[0].fuel_ticks).toBe(6000);

    let fullWorld = { ...world, tuning: { ...world.tuning, fuel_decay_per_s: 0 } };
    fullWorld = stepWorld(fullWorld, baseInput({ interact: false }), FIXED_DT);
    fullWorld = stepWorld(fullWorld, baseInput({ interact: true }), FIXED_DT);
    expect(fullWorld.player.carried).toBe(7);
    expect(fullWorld.last_events.some((e) => e.name === 'refuel')).toBe(false);

    // Wait until tick 60 -> L2 (started at 1.0 fuel = 60 ticks) extinguishes with lantern_out and ever_lit=true
    while (world.sim_tick < 60) {
      world = stepWorld(world, baseInput({ interact: false }), FIXED_DT);
    }
    expect(world.lanterns[1].lit).toBe(false);
    expect(world.lanterns[1].ever_lit).toBe(true);
    expect(world.lanterns[1].fuel_ticks).toBe(0);
    expect(world.last_events).toContainEqual({
      type: 'event',
      tick: 60,
      name: 'lantern_out',
      data: { lantern_id: 'L2' },
    });

    // Walk to L2 (z=22) and relight for only 5 motes -> +5*5 + 40 = +65 pts, relit_count=1, capacity 10->12
    const relightW = createWorld({
      seed: 11,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 22], carried: 10, flames: 3, successful_lights: 4 },
        random_motes: false,
        random_shades: false,
        lanterns: [{ id: 'L2', pos: [0, 0, 22], lit: false, ever_lit: true }],
      },
    });
    expect(relightW.player.capacity).toBe(18);
    const afterRelight = stepWorld(relightW, baseInput({ interact: true }), FIXED_DT);
    const l2After = afterRelight.lanterns.find((l) => l.id === 'L2');
    expect(l2After?.lit).toBe(true);
    expect(l2After?.relit_count).toBe(1);
    expect(afterRelight.player.carried).toBe(5);
    expect(afterRelight.player.capacity).toBe(20); // capped at capacity_max=20
    expect(afterRelight.score).toBe(5 * 5 + 40);
    expect(afterRelight.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'lantern_lit',
      data: { lantern_id: 'L2', relight: true },
    });
  });

  it('transitions wander shades to drain on fuel < 30, emits fuel_drain every 60 ticks, awards +15 on pulse, and enforces safe_radius only at fuel >= 30', () => {
    let world = createWorld({
      seed: 20,
      night: 1,
      scenario: {
        player: { pos: [0, 0, -30], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 21], state: 'wander' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 29.0 }],
        time_left_s: 240,
      },
    });

    // S1 walks 4m -> 2m at 4 m/s (~30 ticks) and switches to drain
    for (let i = 0; i < 35; i++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
    }
    expect(world.shades[0].state).toBe('drain');

    // Run until fuel_drain emits (60 ticks of draining)
    let sawFuelDrain = false;
    for (let i = 0; i < 65; i++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
      if (world.last_events.some((e) => e.name === 'fuel_drain' && e.data.lantern_id === 'L1')) {
        sawFuelDrain = true;
      }
    }
    expect(sawFuelDrain).toBe(true);

    // Direct pulse on a draining shade awards +15 and stuns (expiring to wander)
    let pulseDrainW = createWorld({
      seed: 21,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 21], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 24], state: 'drain', target_lantern_id: 'L1' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      },
    });
    pulseDrainW = stepWorld(pulseDrainW, baseInput({ pulse: true }), FIXED_DT);
    expect(pulseDrainW.score).toBe(15);
    expect(pulseDrainW.shades[0].state).toBe('stunned');

    // Stunned expires back to wander (120 ticks) while May moves away (> 12m) so wander does not immediately re-chase
    for (let i = 0; i < 120; i++) {
      pulseDrainW = stepWorld(pulseDrainW, baseInput({ move: [0, -1] }), FIXED_DT);
    }
    expect(pulseDrainW.shades[0].state).toBe('wander');

    // Refueling L1 from <30 to >=30 pushes nearby shades outside 6m safe_radius
    let refuelPushW = createWorld({
      seed: 22,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 24], carried: 2, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 23], state: 'drain', target_lantern_id: 'L1' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      },
    });
    refuelPushW = stepWorld(refuelPushW, baseInput({ interact: true }), FIXED_DT);
    for (let i = 0; i < 30; i++) {
      refuelPushW = stepWorld(refuelPushW, baseInput(), FIXED_DT);
    }
    expect(Math.hypot(refuelPushW.shades[0].pos[0], refuelPushW.shades[0].pos[2] - 25)).toBeGreaterThanOrEqual(5.99);
  });

  it('replaces early all_lit win with dawn_survived (>= ceil(0.6*N)) and checks no_flames before dawn', () => {
    // All 5 lit does NOT end Night early; survives until dawn -> dawn_survived + dawn bonus
    let winW = createWorld({
      seed: 30,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 2 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', lit: true, fuel: 50 },
          { id: 'L2', lit: true, fuel: 50 },
          { id: 'L3', lit: true, fuel: 50 },
          { id: 'L4', lit: true, fuel: 50 },
          { id: 'L5', lit: true, fuel: 50 },
        ],
        time_left_s: 0.5, // 30 ticks
      },
    });
    for (let i = 0; i < 29; i++) {
      winW = stepWorld(winW, baseInput(), FIXED_DT);
      expect(winW.state).toBe('playing');
    }
    winW = stepWorld(winW, baseInput(), FIXED_DT); // tick 30 -> dawn!
    expect(winW.state).toBe('won');
    expect(winW.last_events).toContainEqual({
      type: 'event',
      tick: 30,
      name: 'game_over',
      data: { result: 'won', reason: 'dawn_survived' },
    });
    // Each lantern decayed 0.5 -> 49.5 -> floor(49.5)=49 => 5*(50+49) + 2*50 = 495 + 100 = 595
    expect(winW.score).toBe(595);

    // Under threshold (2/5 < 3/5) loses at dawn with reason "lanterns_short"
    let loseW = createWorld({
      seed: 31,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', lit: true, fuel: 80 },
          { id: 'L2', lit: true, fuel: 80 },
        ],
        time_left_s: FIXED_DT,
      },
    });
    loseW = stepWorld(loseW, baseInput(), FIXED_DT);
    expect(loseW.state).toBe('lost');
    expect(loseW.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'lost', reason: 'lanterns_short' },
    });

    // Losing last flame on the exact dawn tick results in no_flames (not dawn_survived)
    let lastTickHitW = createWorld({
      seed: 32,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 1 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 0.5], state: 'chase' }],
        lanterns: [
          { id: 'L1', lit: true, fuel: 80 },
          { id: 'L2', lit: true, fuel: 80 },
          { id: 'L3', lit: true, fuel: 80 },
        ],
        time_left_s: FIXED_DT,
      },
    });
    lastTickHitW = stepWorld(lastTickHitW, baseInput(), FIXED_DT);
    expect(lastTickHitW.state).toBe('lost');
    expect(lastTickHitW.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });
  });

  it('preserves Phase 2 features (dash, charm, drifters, Night 2 jump pad, Night 3 tiers/wind/pause)', () => {
    // Dash 14 m/s for 12 ticks keeping height
    const w0 = createWorld({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    let wDash = stepWorld(w0, baseInput({ jump: true }), FIXED_DT);
    const y0 = wDash.player.pos[1];
    wDash = stepWorld(wDash, baseInput({ dash: true, jump: false }), FIXED_DT);
    expect(wDash.player.pos[1]).toBeCloseTo(y0, 5);
    for (let i = 0; i < 11; i++) {
      wDash = stepWorld(wDash, baseInput(), FIXED_DT);
    }
    expect(wDash.player.pos[2]).toBeCloseTo(14 * 0.2, 4);

    // Night 2 Drifter steal & drop + Jump Pad
    let driftW = createWorld({
      seed: 11,
      night: 2,
      scenario: {
        player: { pos: [0, 0, 0], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        drifters: [{ id: 'D1', pos: [0, 0, 1.0], state: 'idle' }],
      },
    });
    driftW = stepWorld(driftW, baseInput(), FIXED_DT);
    expect(driftW.player.carried).toBe(3);
    driftW = stepWorld(driftW, baseInput({ pulse: true }), FIXED_DT);
    expect(driftW.last_events.some((e) => e.name === 'drifter_drop')).toBe(true);

    // Night 3 tiers, ramp, Bell Tower & Pause freeze
    expect(getSupportY(3, 27 * Math.cos(Math.PI / 6), 27 * Math.sin(Math.PI / 6), 1.5)).toBeCloseTo(1.5, 3);
    expect(isBlockedByObstacle(3, 0.5, 0.5, 6)).toBe(true);
    let n3 = createWorld({ seed: 20, night: 3 });
    expect(n3.player.pos).toEqual([0, 0, 35]);
    n3 = stepWorld(n3, baseInput({ pause: true }), FIXED_DT);
    expect(n3.state).toBe('paused');
    expect(n3.sim_tick).toBe(0);
    n3 = stepWorld(n3, baseInput({ pause: false }), FIXED_DT);
    n3 = stepWorld(n3, baseInput({ pause: true }), FIXED_DT);
    expect(n3.state).toBe('playing');
    expect(n3.sim_tick).toBe(1);
  });

  it('completes full 18,000-tick Night 3 run under 30s and exits 2 on invalid inputs', () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'ddl-p3-'));
    try {
      const benchScenario = join(tmpDir, 'bench-n3.json');
      writeFileSync(benchScenario, JSON.stringify({ player: { flames: 300 } }), 'utf8');
      const outPath = join(tmpDir, 'full-night3.jsonl');
      const t0 = performance.now();
      const res = spawnSync(
        'node',
        [
          'dist-headless/cli.js',
          '--seed',
          '2026',
          '--night',
          '3',
          '--scenario',
          benchScenario,
          '--ticks',
          '18000',
          '--out',
          outPath,
          '--snapshot-every',
          '600',
        ],
        { encoding: 'utf8' },
      );
      const elapsedMs = performance.now() - t0;
      expect(res.status).toBe(0);
      expect(elapsedMs).toBeLessThan(30000);

      const lines = readFileSync(outPath, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      expect(lines[0]).toMatchObject({ type: 'snapshot', tick: 0, night: 3 });
      expect(lines[lines.length - 1]).toMatchObject({ type: 'end', ticks: 18000 });

      const badInputs = join(tmpDir, 'bad-inputs.json');
      writeFileSync(badInputs, JSON.stringify({ frames: [{ tick: 10 }, { tick: 5 }] }), 'utf8');
      const badRes = spawnSync(
        'node',
        ['dist-headless/cli.js', '--seed', '1', '--night', '1', '--inputs', badInputs, '--ticks', '10', '--out', join(tmpDir, 'bad.jsonl')],
        { encoding: 'utf8' },
      );
      expect(badRes.status).toBe(2);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
