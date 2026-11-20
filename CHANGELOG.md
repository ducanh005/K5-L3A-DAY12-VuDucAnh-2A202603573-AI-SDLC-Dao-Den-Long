# Changelog

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
