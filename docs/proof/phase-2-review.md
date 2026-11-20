# Independent Review & Browser QA Report — Phase 2

- **Independent Code & Contract Reviewer:** `research` subagent (`49afdda6-bdaa-41ed-a6da-4f38611cbed4`)
- **Live Browser & FPS QA:** `browser` subagent (`49ec2f9e-67b4-44b8-a676-86ae14ad757d`)
- **Scope:** `game.contract.json` (`v1.1`), `src/core/`, `src/headless/cli.ts`, `src/render/`, `tests/`, `scripts/verify.mjs`, `docs/notes/assumptions.md`, `docs/proof/phase-2-verification.md`
- **Final Verdict:** **PASS** (after resolving all initial blockers and re-verifying)

## Blockers Caught & Fixed Before Tagging `phase-2`
1. **Night 3 default spawn/respawn `[0, 0, 0]` fell inside Bell Tower void (`src/core/maps.ts`, `src/core/world.ts`):**
   - *Fix:* Added per-map `spawnPos` (`[0, 0, 35]` on Tier 0 for Night 3; `[0, 0, 0]` for Nights 1–2) used by both `createWorld` and fall-respawn.
2. **21,600-tick Night 3 benchmark stopped at tick 302 (`tests/core.test.ts`, `scripts/verify.mjs`):**
   - *Fix:* Updated both benchmarks to run with `{ player: { flames: 100 } }` (all 10 shades, 2 drifters, 30 motes, wind active) and assert `end.ticks === 21600` in `<= 30,000 ms` (observed: `419 ms`).
3. **HUD Main Menu hidden on initial load & Settings modal DOM re-rendered at 60 FPS (`src/render/hud.ts`):**
   - *Fix:* Changed `prevScreenMode` initial value from `'menu'` to `null` and removed the `|| mode === 'settings'` condition.

## Additional Edge Cases Fixed
4. Standalone Night 3 win opens **Bình Minh** screen and hides `"Sang Đêm 4"` (`src/main.ts`, `src/render/hud.ts`).
5. Fixed Night 3 ramp top-corner chord gap (`proj >= 23.9`) and blocked sideways under-ramp penetration (`src/core/maps.ts`).
6. Derived tick durations/speeds from `world.tuning`, added numeric entity-ID sorting (`S2 < S10`), clamped `drifter_drop` to supported floor, required `carried >= 5` on drifter steal, updated `grounded` on air dashes, and scoped `safe_radius` XZ checks by height (`src/core/world.ts`).
7. Cached Three.js mote/shade geometries and tracked shade animation state transitions (`src/render/scene.ts`).
8. Tightened `loadScenario` validation (`src/headless/cli.ts`), bumped `package.json` to `0.3.0-phase2`, and added unit tests for Night 3 spawn, wind, fall respawn, and `dawn` timeout loss.

## Live Browser Verification (`http://localhost:5173/`)
- **Console / Network:** 0 game JS/WebGL errors, 0 404s across 88 requests.
- **UI & Persistence:** Verified Main Menu, Ông Đăng intros, Settings persistence across reload via `localStorage['dao-den-long-settings-v1']`, Pause/Resume (`Esc`), 10-slot firefly HUD, and Dash/Pulse cooldown badges.
- **FPS (`>= 30 FPS`):** Night 1 idle `58.9 FPS`, Night 2 `50.0 FPS` (`100` frames / `2001 ms`), Night 3 `31.3 FPS` (`63` frames / `2010 ms`, even with a duplicate background tab open).
