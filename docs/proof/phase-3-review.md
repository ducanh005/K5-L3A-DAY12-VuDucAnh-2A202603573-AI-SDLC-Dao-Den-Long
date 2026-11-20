# Independent Code Review & Browser QA — Phase 3 (`TICKET-03` & Test Contract v1.2)

- **Reviewer Subagent (`research`):** `331feb76-bffa-45ff-a131-16fa04531ad3`
- **Browser QA Subagent (`browser`):** `49ec2f9e-67b4-44b8-a676-86ae14ad757d`
- **Target Scope:** `TICKET-03` ("Đèn cạn dầu") & `Test Contract v1.2` (`game.contract.json`, `src/core/`, `src/headless/cli.ts`, `src/render/`, `tests/`, `docs/`)
- **Overall Verdict:** **PASS**

---

## 1. Independent Reviewer Findings & Resolutions

Initial independent audit (`research` subagent) caught **1 Critical** contract defect and **5 Minor** items, all of which were fixed and re-verified as **PASS**:

1. **[Critical — RESOLVED] Dawn loss `game_over.data.reason` (`'dawn'` → `'lanterns_short'`):**
   - `src/core/world.ts` Step 11 now emits `{ result: 'lost', reason: 'lanterns_short' }` when dawn arrives with `< ceil(0.6 * total)` lit lanterns (`flames <= 0` / `'no_flames'` remains checked first).
   - Synchronized assertions/docs in `tests/core.test.ts`, `docs/notes/adr-001-phase3-lantern-fuel-and-dawn.md`, and `CHANGELOG.md`.
   - Independently spot-checked via `dist-headless/cli.js` (`2/5` lit at dawn → `reason: "lanterns_short"`).

2. **[Minor #1 — RESOLVED] `scenario.lanterns[].fuel > 100` validation & clamping:**
   - `src/headless/cli.ts` now validates `fuel` in `[0, 100]` and exits with code `2` when out of range (spot-checked `fuel: 150` → exit `2`).
   - `src/core/world.ts` clamps scenario `fuel_ticks` into `[0, fuelMaxTicks]`.

3. **[Minor #2 — RESOLVED] `p3-shade-drain-and-dawn-win` scenario Pulse trajectory:**
   - Updated `tests/scenarios/p3-shade-drain-and-dawn-win.inputs.json` so Mây closes in starting tick `30` and casts Pulse at tick `165`, deterministically emitting two `fuel_drain` events (`76`, `136`), `pulse { stunned_ids: ["S1"] }` (`166`), and `game_over { result: "won", reason: "dawn_survived" }` (`180`).

4. **[Minor #3 — RESOLVED] HUD low-fuel boundary & interactable tie-break:**
   - `src/render/hud.ts` now checks `l.fuel_ticks < lowFuelTicks` (`< 1800` ticks) directly instead of post-round percentage and displays `<= 29%` while low; nearby lantern interact prompt now includes ascending ID tie-break matching `world.ts`.

5. **[Minor #4 & #5 — RESOLVED] Cleanups, vertical repel guard & campaign replay score:**
   - Removed stray `-` artifact from repo root; aligned docs (`AGENTS.md`, `scripts/verify.mjs`, `.agents/skills/headless-scenario/SKILL.md`) to `18,000` ticks and `Contract v1.2`.
   - Added `Math.abs(shade.pos[1] - target.pos[1]) <= 3.5` guard on lantern light/refuel repel triggers in `src/core/world.ts`.
   - Replaced additive campaign score with per-night tracking `nightScores[currentNight - 1]` in `src/main.ts` to prevent double-counting on night replay.

---

## 2. Independent Verification Summary (Post-Fix)

- **Core Purity Scan (`src/core/*.ts`):** `0` occurrences of `window`, `document`, `three`, `Math.random`, `Date.now`, `localStorage`, or `console`.
- **Typecheck & Builds (`npm run build`):** `tsc --noEmit` (`0` errors), Vite client bundle (`dist/`), and headless bundle (`dist-headless/cli.js`).
- **Vitest (`npm test`):** `6/6` tests passed in `tests/core.test.ts` (including `game.contract.json` v1.2 sync, fuel decay/refuel/`lantern_out`/`relight`/capacity `10..20`, `drain`/safe radius `< 30`/`+15` drain pulse, `dawn_survived` vs `lanterns_short` vs `no_flames`, Nights 1–3 mechanics, and `18,000`-tick benchmark).
- **Headless Determinism (2x JSONL):** `8/8` scenarios byte-for-byte identical; Night 3 `18,000`-tick benchmark completed in `496 ms` (independent reviewer run) / `652 ms` (final proof on `d2b4df2`), within `<= 30,000 ms`.

---

## 3. Live Chrome Browser QA Summary (`http://localhost:5173/`)

Executed across Main Menu, Intro overlay, active Đêm 1 gameplay, Pause, Settings, and page reload (prior to final non-rendering contract/minor cleanups; full `tsc --noEmit` + `vite build` re-verified after all edits):

- **Runtime Stability:** `0` game JS console errors, `0` WebGL/shader errors, `0` `window.onerror`/unhandled rejections, and `0` HTTP `4xx–5xx` failures across `261` requests.
- **Intro & HUD (Phase 3 Rules):** Verified Ông Đăng Đêm 1 quote (`>= 3/5` lit lanterns to dawn, fuel decay & drain warning), live fuel strip pills (`L1: Tắt` → `L1: 100%` → `95%`... → `⚠ 29%`), progressive carrying slots (`0/10` → `0/12`), dawn counter (`1/5 · Cần ≥ 3`), and `E — Châm dầu` prompt.
- **Non-Color Lantern Distinctions:** Verified unlit lanterns collapsed `~20%` vertically with dark diagonal paper tears; lighting expanded to full height with amber 3D fuel bar and `6m` safe zone ring (releasing when `< 30%`).
- **Colorblind Accessibility & Persistence:** Enabled `"Bảng màu dễ phân biệt (Chế độ mù màu)"` in Settings → confirmed `localStorage['dao-den-long-settings-v1']` stored `"colorblindMode":true` and persisted across full page reload, HUD switched warnings to `#FFFFFF` + `⚠`, and `Fox.glb` Ink Shadows rendered with `#00B3FF` tint; restored toggle cleanly to default (`false`).
