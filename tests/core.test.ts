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

describe('Phase 2 — Ticket-02 & Test Contract v1.1', () => {
  it('matches tuning values in game.contract.json v1.1 exactly', () => {
    const raw = readFileSync(resolve(process.cwd(), 'game.contract.json'), 'utf8');
    const contract = JSON.parse(raw) as { contract_version: string; tuning: typeof DEFAULT_TUNING };
    expect(contract.contract_version).toBe('1.1');
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
  });

  it('initializes 20 motes at tick 0 (cap 30) and spawns 2 shades at tick 300', () => {
    let world = createWorld({ seed: 2026, night: 1 });
    expect(world.motes.length).toBe(20);
    expect(world.shades.length).toBe(0);
    expect(world.lanterns.length).toBe(5);

    for (let k = 0; k < 300; k++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
    }
    expect(world.sim_tick).toBe(300);
    expect(world.shades.length).toBe(2);
    expect(world.shades.map((s) => s.id)).toEqual(['S1', 'S2']);
    expect(world.motes.length).toBe(21); // +1 spawned at tick 240
  });

  it('normalizes diagonal move > 1, transforms cam_yaw_deg, and dashes 14 m/s for 12 ticks keeping height', () => {
    const w0 = createWorld({
      seed: 1,
      night: 1,
      scenario: { random_motes: false, random_shades: false },
    });
    const wYaw = stepWorld(w0, baseInput({ move: [0, 1], cam_yaw_deg: 90 }), FIXED_DT);
    expect(wYaw.player.pos[0]).toBeCloseTo(6 * FIXED_DT, 5);
    expect(wYaw.player.pos[2]).toBeCloseTo(0, 5);

    // Jump then mid-air dash: height remains frozen for 12 ticks, moves 14 m/s along facing (+Z)
    let wDash = stepWorld(w0, baseInput({ jump: true }), FIXED_DT);
    expect(wDash.player.grounded).toBe(false);
    const heightAtDashStart = wDash.player.pos[1];

    wDash = stepWorld(wDash, baseInput({ dash: true, jump: false }), FIXED_DT);
    expect(wDash.last_events.some((e) => e.name === 'dash')).toBe(true);
    expect(wDash.player.pos[1]).toBeCloseTo(heightAtDashStart, 5);
    for (let i = 0; i < 11; i++) {
      wDash = stepWorld(wDash, baseInput({ dash: false }), FIXED_DT);
      expect(wDash.player.pos[1]).toBeCloseTo(heightAtDashStart, 5);
    }
    expect(wDash.player.pos[2]).toBeCloseTo(14 * 0.2, 4);
    expect(wDash.player.dash_cd_ticks).toBe(90 - 11);
  });

  it('deposits up to lantern_cost=10, awards +10 per deposited mote and +100 per lit lantern, and repels shades out of 6m', () => {
    let world = createWorld({
      seed: 2,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 24], carried: 10, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 22], state: 'chase' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0 }],
      },
    });

    world = stepWorld(world, baseInput({ interact: true }), FIXED_DT);
    expect(world.lanterns[0].lit).toBe(true);
    expect(world.lanterns[0].deposited).toBe(10);
    expect(world.score).toBe(10 * 10 + 100);
    expect(world.last_events.map((e) => e.name)).toContain('deposit');
    expect(world.last_events.map((e) => e.name)).toContain('lantern_lit');

    // Within 30 ticks, S1 is pushed outside safe_radius = 6m without harming player
    for (let i = 0; i < 30; i++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
    }
    const dist = Math.hypot(world.shades[0].pos[0], world.shades[0].pos[2] - 25);
    expect(dist).toBeGreaterThanOrEqual(6 - 0.01);
    expect(world.player.flames).toBe(3);
  });

  it('uses 3D pulse (cost 3, radius 5m from y+0.8, stun 120 ticks, push 4m in 15 ticks) and enforces shade recoil', () => {
    let world = createWorld({
      seed: 3,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 4, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 4], state: 'chase' }],
      },
    });

    world = stepWorld(world, baseInput({ pulse: true }), FIXED_DT);
    expect(world.player.carried).toBe(1);
    expect(world.score).toBe(5);
    expect(world.shades[0].state).toBe('stunned');
    expect(world.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'pulse',
      data: { stunned_ids: ['S1'] },
    });

    for (let i = 0; i < 15; i++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
    }
    expect(world.shades[0].pos[2]).toBeCloseTo(8, 2);

    // Total stun is 120 ticks (15 already elapsed -> 105 more)
    for (let i = 0; i < 104; i++) {
      world = stepWorld(world, baseInput(), FIXED_DT);
    }
    expect(world.shades[0].state).toBe('stunned');
    world = stepWorld(world, baseInput(), FIXED_DT);
    expect(world.shades[0].state).toBe('chase');

    // Shade hit triggers recoil (60 ticks, 2m) and drops floor(carried/2) motes
    let hitWorld = createWorld({
      seed: 4,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0, 0, 0.5], state: 'chase' }],
      },
    });
    hitWorld = stepWorld(hitWorld, baseInput(), FIXED_DT);
    expect(hitWorld.player.flames).toBe(2);
    expect(hitWorld.player.carried).toBe(3); // 5 - floor(5/2)=2 = 3
    expect(hitWorld.motes.filter((m) => m.kind === 'dropped').length).toBe(2);
    expect(hitWorld.shades[0].state).toBe('recoil');
  });

  it('handles Wind Charm (7.2 m/s, zero dash cooldown), Drifter steal/drop, and Night 2 Jump Pad + Fall', () => {
    // Wind Charm on Night 2 bridge (35,0,0)
    let charmW = createWorld({
      seed: 10,
      night: 2,
      scenario: {
        player: { pos: [34.5, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
      },
    });
    charmW = stepWorld(charmW, baseInput(), FIXED_DT);
    expect(charmW.last_events.some((e) => e.name === 'charm_picked')).toBe(true);
    expect(charmW.player.charm_ticks).toBe(600);
    charmW = stepWorld(charmW, baseInput({ move: [1, 0] }), FIXED_DT);
    expect(charmW.player.pos[0]).toBeCloseTo(34.5 + 7.2 * FIXED_DT, 4);

    // Drifter steals when carried >= 5 and drops when hit by Pulse
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
    expect(driftW.drifters[0].stolen).toBe(3);
    expect(driftW.last_events.some((e) => e.name === 'drifter_steal')).toBe(true);

    driftW = stepWorld(driftW, baseInput({ pulse: true }), FIXED_DT);
    expect(driftW.last_events.some((e) => e.name === 'drifter_drop')).toBe(true);
    expect(driftW.motes.filter((m) => m.kind === 'dropped').length).toBe(3);

    // Night 2 Jump Pad launches from (20,0,18) onto Island B (70,0,0)
    let padW = createWorld({
      seed: 12,
      night: 2,
      scenario: {
        player: { pos: [20, 0, 18], carried: 1, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
      },
    });
    for (let i = 0; i < 95; i++) {
      padW = stepWorld(padW, baseInput(), FIXED_DT);
    }
    expect(padW.player.grounded).toBe(true);
    expect(Math.hypot(padW.player.pos[0] - 70, padW.player.pos[2])).toBeLessThanOrEqual(28);
  });

  it('enforces Night 3 tiers, ramps, Bell Tower block, wind schedule, fall respawn, dawn loss, and pause freeze', () => {
    // Ramp continuity from r=30 (Y=0) to r=24 (Y=3) including edge at proj=23.95
    expect(getSupportY(3, 27 * Math.cos(Math.PI / 6), 27 * Math.sin(Math.PI / 6), 1.5)).toBeCloseTo(1.5, 3);
    expect(getSupportY(3, 23.95 * Math.cos(Math.PI / 6) - 1.4 * Math.sin(Math.PI / 6), 23.95 * Math.sin(Math.PI / 6) + 1.4 * Math.cos(Math.PI / 6), 3.0)).toBeCloseTo(3.0, 2);
    expect(isBlockedByObstacle(3, 0.5, 0.5, 6)).toBe(true); // Bell Tower
    expect(isBlockedByObstacle(3, 0, 18, 0)).toBe(true); // Tier 1 vertical cliff away from ramp

    // Default Night 3 spawn [0, 0, 35] is grounded and survives past tick 400
    let defaultN3 = createWorld({ seed: 2026, night: 3 });
    expect(defaultN3.player.grounded).toBe(true);
    expect(defaultN3.player.pos).toEqual([0, 0, 35]);
    for (let i = 0; i < 400; i++) {
      defaultN3 = stepWorld(defaultN3, baseInput(), FIXED_DT);
    }
    expect(defaultN3.state).toBe('playing');
    expect(defaultN3.player.flames).toBe(3);

    // Night 3 Wind activates at sim_tick = 1800 after warning at 1680
    let windW = createWorld({
      seed: 99,
      night: 3,
      scenario: { random_motes: false, random_shades: false, wind_enabled: true },
    });
    for (let i = 0; i < 1680; i++) windW = stepWorld(windW, baseInput(), FIXED_DT);
    expect(windW.wind.warning).toBe(true);
    expect(windW.wind.active).toBe(false);
    for (let i = 0; i < 120; i++) windW = stepWorld(windW, baseInput(), FIXED_DT);
    expect(windW.wind.active).toBe(true);

    // Fall (Y < -10) ignores invuln, loses all carried motes, waits 60 ticks, and respawns with 90 ticks invuln
    let fallW = createWorld({
      seed: 15,
      night: 1,
      scenario: {
        player: { pos: [41, 0, 0], carried: 4, flames: 3, invuln_ticks: 50 },
        random_motes: false,
        random_shades: false,
      },
    });
    let sawFallHit = false;
    for (let i = 0; i < 200; i++) {
      fallW = stepWorld(fallW, baseInput(), FIXED_DT);
      if (fallW.last_events.some((e) => e.name === 'player_hit' && e.data.by === 'fall')) {
        sawFallHit = true;
        expect(fallW.player.carried).toBe(0);
        expect(fallW.player.flames).toBe(2);
      }
    }
    expect(sawFallHit).toBe(true);
    expect(fallW.player.pos).toEqual([0, 0, 0]);
    expect(fallW.player.grounded).toBe(true);

    // Dawn loss when time runs out
    let dawnW = createWorld({
      seed: 16,
      night: 1,
      scenario: { random_motes: false, random_shades: false, time_left_s: FIXED_DT },
    });
    dawnW = stepWorld(dawnW, baseInput(), FIXED_DT);
    expect(dawnW.state).toBe('lost');
    expect(dawnW.last_events).toContainEqual({
      type: 'event',
      tick: 1,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });

    // Pause freezes sim_tick & time_left_s while tick advances
    let w = createWorld({ seed: 20, night: 3, scenario: { random_motes: false, random_shades: false } });
    w = stepWorld(w, baseInput(), FIXED_DT); // tick 1, sim_tick 1
    w = stepWorld(w, baseInput({ pause: true }), FIXED_DT); // tick 2, paused
    expect(w.state).toBe('paused');
    expect(w.tick).toBe(2);
    expect(w.sim_tick).toBe(1);
    const frozenTime = w.time_left_s;
    w = stepWorld(w, baseInput({ pause: false, move: [1, 0] }), FIXED_DT); // tick 3, still paused
    expect(w.tick).toBe(3);
    expect(w.sim_tick).toBe(1);
    expect(w.time_left_s).toBe(frozenTime);
    w = stepWorld(w, baseInput({ pause: true }), FIXED_DT); // tick 4, resumed
    expect(w.state).toBe('playing');
    expect(w.sim_tick).toBe(2);
  });

  it('completes full 21,600-tick Night 3 headless run well under 30s and exits 2 on invalid inputs', () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'ddl-p2-'));
    try {
      const benchScenario = join(tmpDir, 'bench-n3.json');
      writeFileSync(benchScenario, JSON.stringify({ player: { flames: 100 } }), 'utf8');
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
          '21600',
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
      expect(lines[lines.length - 1]).toMatchObject({ type: 'end', ticks: 21600 });

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
