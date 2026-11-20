# Changelog

## [1.0.0] - Phase 4 (TICKET-04 "Bình minh: phát hành v1.0.0" & Test Contract v1.3)
### Added
- **Contract v1.3 (`game.contract.json`, `package.json`):** Updated `contract_version` to `"1.3"`, bumped package version to `1.0.0`, and registered `run_cmd`, `bench_cmd`, and `soak_cmd`.
- **Standardized 3D Benchmark Mode (`scripts/bench.mjs`, `createBenchWorld`, `stepBenchWorld`, `GameScene`):** Spawns fixed Night 1 benchmark scene (`1280×720`, vsync off, `200` wander Shades, `100` Motes, `L1..L3` lit with `fuel = 100`, camera orbit radius `30m` at `Y=15m`, 15s/rev CCW, 3s warmup + `--duration` measure), disables creative GLTF skins/particles, uses instanced rendering, and writes `bench.json` (`avg_fps: 175.9`, `p1_low_fps: 78.3`, `load_ms: 543`).
- **10-Night Headless Soak Test (`scripts/soak.mjs`):** Runs 10 consecutive Nights in a single Node process with seeded randomized inputs and `--max-semi-space-size=1`, producing `soak.json` (`0` crashes, `mem_start_mb: 55.48 -> mem_end_mb: 59.73`).
- **Local Top-10 Leaderboard (`src/core/leaderboard.ts`, `src/render/leaderboard.ts`, `scripts/run.mjs`, `vite.config.ts`):** Name entry (`3–12` chars) after Dawn win or any Night loss, persistent local disk storage (`.leaderboard.json` + `localStorage`), main menu Leaderboard table view, and `--export-leaderboard <out.json>` CLI.
- **Accessibility (`src/render/settings.ts`, `src/render/hud.ts`, `src/main.ts`):** Rebindable controls (9 actions) with duplicate detection & "Khôi phục mặc định", visual subtitles + edge directional indicator for Ink Shadows/Wind/Final 10s/Low Fuel `<30`, Reduced Motion mode, and minimum `>= 18px` base UI font with `×1.25` Large Text toggle.
- **Release Documentation & Artifacts:** Updated `README.md`, `CREDITS.md`, `AGENTS.md`, `docs/notes/assumptions.md`, `docs/notes/ai-log.md`, `docs/notes/retrospective.md`, `docs/demo/demo.mp4`, and `docs/proof/phase-4-*`.

## [0.4.0-phase3] - Phase 3 (TICKET-03 "Đèn cạn dầu" & Test Contract v1.2)
### Breaking Changes (Thay đổi phá vỡ tương thích so với v1.1)
- **Replaced early `all_lit` win with dawn survival (`dawn_survived`) / `lanterns_short`:** Lighting all lanterns no longer ends the Night early; players must survive until dawn (`240s / 270s / 300s`) with at least `ceil(0.6 * totalLanterns)` lanterns still lit (`3/5`, `4/6`, `5/7`), otherwise losing with `reason: "lanterns_short"` (replacing `"dawn"`).
- **Replaced static lit lanterns with decaying fuel (`fuel 0..100`):** Lit lanterns decay at `1.0 fuel/s`, extinguish (`lantern_out`, `ever_lit = true`) at `fuel <= 0`, cost `5` motes to relight (vs `10` first time), and accept `refuel` motes (`+10` fuel each).
- **Replaced unconditional `safe_radius`:** Lanterns with `fuel < 30` lose their `6m` safe zone; `wander` shades target weak/unlit lanterns and enter `drain` (`5 fuel/s`, `fuel_drain` event every `60` ticks).
- **Replaced scoring formula:** Deposit mote `+5` (was `+10`), relight `+40`, pulse `+15` against draining shades (was `+5`), dawn bonus `50 + floor(fuel)` per lit lantern + `50` per flame, time bonus removed (`per_second_left: 0`).
- **Contract v1.2 additions:** Progressive capacity `10 + 2 * successful_lights` (max `20`), snapshot fields (`player.capacity`, `lanterns[].{fuel, ever_lit, relit_count}`), scenario fields (`player.successful_lights`, `lanterns[].{fuel, ever_lit}`, `shades[].target_lantern_id`), and events (`refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`).

### Added
- Colorblind accessibility mode ("Bảng màu dễ phân biệt": `#00B3FF` shades, `#FFFFFF` + `⚠` alerts, persisted in `localStorage`) and non-color lantern visual distinction (20% collapsed unlit lanterns with paper tears, 3D fuel bar, 1 Hz low-fuel blink, drain siphon beam).
- ADR [`docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md`](docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md) and Phase 3 scenarios (`p3-fuel-refuel-relight`, `p3-shade-drain-and-dawn-win`).

## [0.3.0-phase2] - Phase 2 (TICKET-02 "Ba hòn đảo" & Test Contract v1.1)
- Standardized tuning, 12-step tick order, 3 island maps, Dash, Wind Charms, Drifters, falling + respawn, Pause, persistent Settings, 10-slot HUD, and standard HEX palette.

## [0.2.1-phase1] - Phase 1 Assets Upgrade & Playtest Fixes
- Integrated CC0/MIT 3D GLTF models and textures, fixed 39m island clamp and pickup prompts.

## [0.2.0-phase1] - Phase 1 (PRD-0 & Test Contract v1.0)
- Added `game.contract.json` (`1.0`), headless CLI, Night 1 simulation, and Three.js client.
