import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/core/world.js';

describe('Dao Den Long core simulation (CP0 baseline)', () => {
  it('is deterministic across identical seed and input sequence', () => {
    const run = () => {
      let world = createWorld({ seed: 1337 });
      for (let i = 0; i < 180; i++) {
        world = stepWorld(world, { moveX: 0.6, moveZ: 0.8, sprint: i % 3 === 0, interact: true }, 1 / 60);
      }
      return world;
    };

    expect(run()).toEqual(run());
  });

  it('collects nearby firefly and ignites Great Lantern when interacting', () => {
    const base = createWorld({ seed: 42, fireflyCount: 0, lanternCount: 1, shadowCount: 0 });
    const worldWithTargets = {
      ...base,
      fireflies: [{ id: 'ff-test', pos: { x: 0.4, y: 0.75, z: 0 }, collected: false }],
      lanterns: [{ id: 'l-test', pos: { x: 1.0, y: 0, z: 0 }, requiredFireflies: 1, lit: false }],
    };

    const step1 = stepWorld(worldWithTargets, { moveX: 1, moveZ: 0, interact: false }, 1 / 60);
    expect(step1.player.fireflies).toBe(1);
    expect(step1.fireflies[0].collected).toBe(true);

    const step2 = stepWorld(step1, { moveX: 1, moveZ: 0, interact: true }, 1 / 60);
    expect(step2.lanterns[0].lit).toBe(true);
    expect(step2.player.fireflies).toBe(0);
    expect(step2.status).toBe('won');
  });

  it('transitions to lost when player HP reaches zero from Ink Shadow contact', () => {
    const base = createWorld({ seed: 7, fireflyCount: 0, lanternCount: 1, shadowCount: 0 });
    const dangerWorld = {
      ...base,
      player: { ...base.player, hp: 1, invulnTimer: 0 },
      shadows: [{ id: 's-test', pos: { x: 0.2, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, radius: 1.5 }],
    };

    const next = stepWorld(dangerWorld, { moveX: 0, moveZ: 0 }, 1 / 60);
    expect(next.player.hp).toBe(0);
    expect(next.status).toBe('lost');
  });
});
