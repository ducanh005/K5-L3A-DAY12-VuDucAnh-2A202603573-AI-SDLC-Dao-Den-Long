# Independent Review Report — Phase 1

- **Reviewer:** Independent `research` subagent (`6af7f446-2a8e-4f43-9c36-121793dd0ca5`)
- **Scope:** `game.contract.json`, `src/core/`, `src/headless/cli.ts`, `src/render/`, `tests/`, `docs/notes/assumptions.md`, `docs/proof/phase-1-verification.md`
- **Verdict:** **PASS** (after resolving 2 minor edge-case observations below)

## Verified Requirements
1. **Pure Core (`src/core/`):** Zero DOM, `window`, `document`, `three`, `Math.random()`, or `Date.now()` calls.
2. **Contract Sync (`game.contract.json`):** `tuning` matches `DEFAULT_TUNING` in `src/core/world.ts` 100%, enforced by `tests/core.test.ts`.
3. **Tick Model & Transforms:** Snapshot tick 0 occurs after scenario setup before inputs; step `k` produces `tick = k+1`; `move` normalizes lengths `> 1` and transforms via `cam_yaw_deg`; `jump`/`interact`/`pulse` trigger exclusively on `false -> true` transitions.
4. **Scenario Overrides & Validation:** Setup emits zero events/score; invalid `inputs`/`scenario` JSON or non-strictly-increasing frame ticks return exit code `2`.
5. **Output JSONL:** Emits `snapshot` every `--snapshot-every` ticks, rounds positions and `time_left_s` to 3 decimal places, formats all contract events (`mote_picked`, `deposit`, `lantern_lit`, `pulse`, `player_hit`, `game_over`), and terminates with `end`.

## Fixes Applied from Reviewer Observations
1. **IEEE-754 float drift on `invuln_left_s` (`1.5s`) and `stun_left_s` (`3.0s`):**
   - *Finding:* Repeatedly subtracting `dt = 1/60` left residuals (`~1e-16`), causing invulnerability/stun to last 1 extra tick (`91`/`181` instead of `90`/`180`).
   - *Fix:* Added `decrementTimer()` snapping residuals `<= 1e-9` to `0` in `src/core/world.ts`, and added an exact 180-tick boundary assertion in `tests/core.test.ts`.
2. **Strict scenario schema validation:**
   - *Finding:* `scenario.motes[].id`, `scenario.shades[].id` type checks and `scenario.lanterns[].deposited < 0` check were permissive.
   - *Fix:* Tightened validation in `src/headless/cli.ts` to exit with code `2` on invalid `id` types or negative `deposited` values.
