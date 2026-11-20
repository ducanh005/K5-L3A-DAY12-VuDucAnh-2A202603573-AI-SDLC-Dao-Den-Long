import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
    ...overrides,
  };
}

describe('Phase 1 — PRD-0 & Test Contract v1.0', () => {
  it('matches tuning values in game.contract.json exactly', () => {
    const raw = readFileSync(resolve(process.cwd(), 'game.contract.json'), 'utf8');
    const contract = JSON.parse(raw) as { contract_version: string; tuning: typeof DEFAULT_TUNING };
    expect(contract.contract_version).toBe('1.0');
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
  });

  it('produces identical snapshots and events across repeated deterministic runs', () => {
    const run = () => {
      let world = createWorld({ seed: 777, night: 1 });
      const logs = [JSON.stringify(formatSnapshot(world))];
      for (let k = 0; k < 180; k++) {
        world = stepWorld(
          world,
          baseInput({
            move: [0.8, 0.8],
            cam_yaw_deg: 45,
            jump: k === 10,
            interact: k % 30 === 0,
            pulse: k === 60,
          }),
          FIXED_DT,
        );
        for (const ev of world.last_events) logs.push(JSON.stringify(ev));
        if ((k + 1) % 30 === 0) logs.push(JSON.stringify(formatSnapshot(world)));
      }
      return logs.join('\n');
    };

    expect(run()).toBe(run());
  });

  it('normalizes diagonal move > 1 and applies cam_yaw_deg rotation formula', () => {
    const world0 = createWorld({
      seed: 1,
      scenario: { random_motes: false, random_shades: false },
    });

    // At yaw = 90 deg, move = [0, 1] -> x' = sin(90) = 1, z' = cos(90) = 0 -> +X direction
    const s1 = stepWorld(world0, baseInput({ move: [0, 1], cam_yaw_deg: 90 }), FIXED_DT);
    expect(s1.player.pos[0]).toBeCloseTo(DEFAULT_TUNING.player_speed * FIXED_DT, 5);
    expect(s1.player.pos[2]).toBeCloseTo(0, 5);

    // Diagonal [1, 1] has length sqrt(2) > 1 -> must normalize to length 1
    const s2 = stepWorld(world0, baseInput({ move: [1, 1], cam_yaw_deg: 0 }), FIXED_DT);
    const dist = Math.hypot(s2.player.pos[0], s2.player.pos[2]);
    expect(dist).toBeCloseTo(DEFAULT_TUNING.player_speed * FIXED_DT, 5);
  });

  it('handles jump on false->true edge and returns to ground Y=0', () => {
    let world = createWorld({
      seed: 1,
      scenario: { random_motes: false, random_shades: false },
    });
    world = stepWorld(world, baseInput({ jump: true }), FIXED_DT);
    expect(world.player.pos[1]).toBeGreaterThan(0);

    for (let i = 0; i < 60; i++) {
      world = stepWorld(world, baseInput({ jump: true }), FIXED_DT);
    }
    expect(world.player.pos[1]).toBe(0);
  });

  it('clamps player movement strictly inside PLAYABLE_RADIUS (39m) during normal play', () => {
    let world = createWorld({ seed: 99, night: 1 });
    expect(world.map_radius).toBe(39);
    for (let i = 0; i < 600; i++) {
      world = stepWorld(world, baseInput({ move: [0, 1] }), FIXED_DT);
    }
    const dist = Math.hypot(world.player.pos[0], world.player.pos[2]);
    expect(dist).toBeLessThanOrEqual(39.0001);
  });

  it('picks motes up to carry_capacity and deposits/lights Great Lanterns', () => {
    let world = createWorld({
      seed: 2,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [
          [0, 0, 0.5],
          [0, 0, 0.6],
          [0, 0, 0.7],
          [0, 0, 0.8],
          [0, 0, 0.9],
          [0, 0, 1.0],
          [0, 0, 1.1],
          [0, 0, 1.2],
          [0, 0, 1.3],
        ],
        lanterns: [{ id: 'L1', pos: [0, 0, 2.0], deposited: 0 }],
      },
    });

    // Step 1 picks up first 8 motes (carry_capacity = 8), leaving 1 active
    world = stepWorld(world, baseInput({ interact: false }), FIXED_DT);
    expect(world.player.carried).toBe(8);
    expect(world.motes.filter((m) => m.active).length).toBe(1);
    expect(world.score).toBe(8 * DEFAULT_TUNING.score.per_mote);
    expect(world.last_events.filter((e) => e.name === 'mote_picked').length).toBe(8);

    // Step 2 interacts with L1 (cost = 3) -> deposits 3, lights L1, score += 100
    world = stepWorld(world, baseInput({ interact: true }), FIXED_DT);
    expect(world.player.carried).toBe(5);
    expect(world.lanterns[0].lit).toBe(true);
    expect(world.lanterns[0].deposited).toBe(3);
    expect(world.last_events.map((e) => e.name)).toContain('deposit');
    expect(world.last_events.map((e) => e.name)).toContain('lantern_lit');
    expect(world.score).toBe(8 * 10 + 100);
  });

  it('stuns and pushes shades with pulse and enforces cooldown + safe_radius', () => {
    let world = createWorld({
      seed: 3,
      scenario: {
        player: { pos: [0, 0, 0], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 4] }],
        lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }],
      },
    });

    // Trigger pulse at tick 1
    world = stepWorld(world, baseInput({ pulse: true }), FIXED_DT);
    expect(world.player.carried).toBe(2);
    expect(world.shades[0].state).toBe('stunned');
    expect(world.shades[0].pos[2]).toBeCloseTo(8, 3);
    expect(world.last_events).toEqual([{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }]);

    // Cooldown prevents immediate re-pulse even if toggled false->true within 1s
    world = stepWorld(world, baseInput({ pulse: false }), FIXED_DT);
    world = stepWorld(world, baseInput({ pulse: true }), FIXED_DT);
    expect(world.player.carried).toBe(2);

    // Exact 3s (180 ticks) stun boundary without IEEE-754 drift
    let stunCheck = createWorld({
      seed: 30,
      scenario: {
        player: { pos: [0, 0, 0], carried: 1, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 4] }],
      },
    });
    stunCheck = stepWorld(stunCheck, baseInput({ pulse: true }), FIXED_DT); // tick 1
    for (let i = 0; i < 179; i++) {
      stunCheck = stepWorld(stunCheck, baseInput(), FIXED_DT);
    }
    expect(stunCheck.tick).toBe(180);
    expect(stunCheck.shades[0].state).toBe('stunned');
    stunCheck = stepWorld(stunCheck, baseInput(), FIXED_DT); // tick 181 = 3.0s elapsed
    expect(stunCheck.shades[0].state).toBe('chase');

    // Move player inside L1 safe_radius and verify chasing shade stays outside safe_radius (5m)
    let safeTest = createWorld({
      seed: 4,
      scenario: {
        player: { pos: [0, 0, 20], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 12] }],
        lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }],
      },
    });
    for (let i = 0; i < 180; i++) {
      safeTest = stepWorld(safeTest, baseInput(), FIXED_DT);
    }
    const distFromLantern = Math.hypot(safeTest.shades[0].pos[0], safeTest.shades[0].pos[2] - 20);
    expect(distFromLantern).toBeGreaterThanOrEqual(DEFAULT_TUNING.safe_radius - 0.001);
    expect(safeTest.player.flames).toBe(3);
  });

  it('applies player_hit drop ratio + invulnerability and triggers game_over loss/win reasons', () => {
    // Hit drop & no_flames loss
    let hitWorld = createWorld({
      seed: 5,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 2 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 0.5] }],
      },
    });
    hitWorld = stepWorld(hitWorld, baseInput(), FIXED_DT);
    expect(hitWorld.player.flames).toBe(1);
    expect(hitWorld.player.carried).toBe(3); // floor(5 * 0.5) = 2 dropped -> 3 left
    expect(hitWorld.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'player_hit',
      data: { by: 'shade', flames: 1, dropped: 2 },
    });

    // Invulnerable on next tick
    hitWorld = stepWorld(hitWorld, baseInput(), FIXED_DT);
    expect(hitWorld.player.flames).toBe(1);

    // Dawn loss
    let dawnWorld = createWorld({
      seed: 6,
      scenario: { random_motes: false, random_shades: false, time_left_s: FIXED_DT },
    });
    dawnWorld = stepWorld(dawnWorld, baseInput(), FIXED_DT);
    expect(dawnWorld.state).toBe('lost');
    expect(dawnWorld.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });

    // All lit win
    let winWorld = createWorld({
      seed: 7,
      scenario: {
        player: { pos: [0, 0, 24], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
      },
    });
    winWorld = stepWorld(winWorld, baseInput({ interact: true }), FIXED_DT);
    expect(winWorld.state).toBe('won');
    expect(winWorld.score).toBe(100 + 3 * 50);
    expect(winWorld.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'won', reason: 'all_lit' },
    });
  });

  it('headless CLI outputs valid JSONL and exits with code 2 on malformed inputs', () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'ddl-test-'));
    try {
      const outPath = join(tmpDir, 'out.jsonl');
      const res = spawnSync(
        'npx',
        [
          'tsx',
          'src/headless/cli.ts',
          '--seed',
          '101',
          '--night',
          '1',
          '--scenario',
          'tests/scenarios/p1-pulse-and-win.scenario.json',
          '--inputs',
          'tests/scenarios/p1-pulse-and-win.inputs.json',
          '--ticks',
          '200',
          '--out',
          outPath,
          '--snapshot-every',
          '10',
        ],
        { shell: process.platform === 'win32', encoding: 'utf8' },
      );
      expect(res.status).toBe(0);
      const lines = readFileSync(outPath, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      expect(lines[0]).toMatchObject({ type: 'snapshot', tick: 0, sim_tick: 0, state: 'playing' });
      expect(lines[lines.length - 1]).toMatchObject({ type: 'end', state: 'won' });

      // Invalid inputs (non-increasing ticks) must return exit code 2
      const badInputs = join(tmpDir, 'bad-inputs.json');
      writeFileSync(
        badInputs,
        JSON.stringify({ frames: [{ tick: 10 }, { tick: 5 }] }),
        'utf8',
      );
      const badRes = spawnSync(
        'npx',
        [
          'tsx',
          'src/headless/cli.ts',
          '--seed',
          '101',
          '--night',
          '1',
          '--inputs',
          badInputs,
          '--ticks',
          '20',
          '--out',
          join(tmpDir, 'bad.jsonl'),
        ],
        { shell: process.platform === 'win32', encoding: 'utf8' },
      );
      expect(badRes.status).toBe(2);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
