# Changelog

## [0.3.0-phase2] - Phase 2 (TICKET-02 "Ba hòn đảo" & Test Contract v1.1)
- Standardized all tuning values, strict 12-step tick execution order, and scoring formula (`contract_version: "1.1"`).
- Added 3 complete island maps in `src/core/maps.ts`: Đêm 1 – Đảo Bến, Đêm 2 – Đảo Cau (twin islands, bamboo bridge, jump pads), and Đêm 3 – Đảo Chuông (3-tier island, 2 ramps, jump pad, Bell Tower, periodic wind).
- Implemented Dash (`14 m/s`, `0.2s`, `1.5s` cooldown), Wind Charms (`7.2 m/s`, zero dash cooldown), Drifters (`Gió Lạc` steal & pulse drop), falling (`Y < -10`) + 60-tick respawn, shade states (`spawning`, `wander`, `chase`, `recoil`, `stunned`), and `pause`/`resumed`.
- Upgraded 3D visuals to the Ticket-02 standard HEX palette and ambient lighting curve (`0.15 + 0.55 * litRatio`), full 3-night campaign flow (Main Menu, Ông Đăng intros, Pause, persistent `localStorage` Settings, Dawn ending), 10-slot firefly HUD + off-screen lantern indicator, and full WebAudio music/SFX.
- Added 4 Phase 2 headless scenarios, comprehensive unit tests, and 21,600-tick performance benchmark (`docs/proof/phase-2-verification.md`).

## [0.2.1-phase1] - Phase 1 Assets Upgrade & Playtest Fixes
- Integrated CC0/MIT 3D GLTF models (`RobotExpressive.glb`, `Lantern.glb`, `Fox.glb`) and textures (`grasslight-big.jpg`, `spark1.png`) in `public/assets/`, documented in `CREDITS.md`.
- Fixed out-of-bounds movement bug and improved firefly pickup ergonomics.

## [0.2.0-phase1] - Phase 1 (PRD-0 & Test Contract v1.0)
- Added `game.contract.json` (`contract_version: "1.0"`), bundled headless CLI, Night 1 simulation, and Three.js visuals.

## [0.1.0-cp0] - Checkpoint 0 (Bootstrap)
- Initialized project structure, AI harness, hooks, and CI pipeline.
