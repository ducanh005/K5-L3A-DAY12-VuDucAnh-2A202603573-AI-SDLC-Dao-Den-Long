# Changelog

## [0.2.1-phase1] - Phase 1 Assets Upgrade & Playtest Fixes
- Integrated CC0/MIT 3D GLTF models (`RobotExpressive.glb`, `Lantern.glb`, `Fox.glb`) and textures (`grasslight-big.jpg`, `spark1.png`) in `public/assets/`, documented in `CREDITS.md`.
- Fixed out-of-bounds movement bug by clamping default playable island radius to `39m` (`< 40m` island mesh) and adding a visible perimeter stone fence.
- Improved firefly pickup ergonomics (`pickup_radius: 2.4`, `carry_capacity: 8`, `interact_radius: 3.0`), added ground beacon rings under motes, and added HUD prompts when bag is full or near a lantern.
- Added `public/favicon.svg` to eliminate browser 404 console warning.

## [0.2.0-phase1] - Phase 1 (PRD-0 & Test Contract v1.0)
- Added `game.contract.json` (`contract_version: "1.0"`) and bundled headless binary build (`dist-headless/cli.js`).
- Implemented complete Phase 1 gameplay in `src/core/`: 5 Great Lanterns on Đêm 1 – Đảo Bến, mote pickup (`carry_capacity: 5`), partial/full deposit, `pulse` stun/pushback/cooldown, `safe_radius` around lit lanterns, `player_hit` drop ratio + invulnerability, jump physics, `cam_yaw_deg` movement transform, and win/loss conditions (`all_lit`, `no_flames`, `dawn`).
- Updated `src/headless/cli.ts` to strictly satisfy Test Contract v1.0 flags, JSONL schema (`snapshot`, `event`, `end`), 3-decimal coordinate rounding, and exit code `2` on invalid input/scenario files.
- Updated Three.js visuals (`src/render/`): Mây wearing a conical leaf hat (nón lá) with a hanging small lantern, warm golden lighting progression, purple-black Ink Shadows, pulse shockwave, HUD, and procedural WebAudio feedback.
- Added contract-driven tests (`tests/core.test.ts`), paired headless scenarios (`tests/scenarios/p1-*.json`), and automated proof generation (`docs/proof/phase-1-verification.md`).

## [0.1.0-cp0] - Checkpoint 0 (Bootstrap)
- Initialized project structure separating pure deterministic core (`src/core/`), headless CLI (`src/headless/`), and Three.js 3D client (`src/render/`).
- Added AI SDLC harness: `AGENTS.md`, skills, `.githooks/pre-commit`, `.github/workflows/ci.yml`, and `scripts/verify.mjs`.
