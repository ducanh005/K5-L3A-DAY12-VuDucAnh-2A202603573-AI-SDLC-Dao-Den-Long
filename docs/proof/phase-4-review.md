# Independent Code Review & Browser QA — Phase 4 (`TICKET-04` / `v1.0.0` / Contract v1.3)

- **Reviewer Subagent (`research`):** `331feb76-bffa-45ff-a131-16fa04531ad3`
- **Browser QA Subagent (`browser`):** `49ec2f9e-67b4-44b8-a676-86ae14ad757d`
- **Target Scope:** `TICKET-04` ("Bình minh: phát hành v1.0.0") & `Test Contract v1.3`
- **Overall Verdict:** **PASS**

---

## 1. Independent Reviewer Audit (`research` Subagent) — **PASS**

Independent audit confirmed **0 Critical** and **0 Major** defects across Contract v1.3, Core purity, Benchmark/Soak correctness, Accessibility, Leaderboard, Tests, and Release Documentation, plus 4 Minor polish items that were all resolved prior to tagging:

1. **[Resolved — Minor #1] `reducedMotion` in 3D Scene (`src/render/scene.ts`):** Updated `blinkOn` to remain steady (`true`) when `reducedMotion === true` so weak lanterns `< 30` do not pulse/blink in Reduced Motion mode.
2. **[Resolved — Minor #2] Leaderboard Sanitizer Parity (`scripts/run.mjs`):** Aligned `scripts/run.mjs` `--export-leaderboard` sanitizer with `VALID_NAME_RE` and duplicate-entry deduplication matching `src/core/leaderboard.ts`.
3. **[Resolved — Minor #3] Offscreen Shade Directional Arrow (`src/render/hud.ts`):** Kept `➤` rotated arrow glyph inside `shadeArrowEl` with upright label text and added vertical collision avoidance (`46px` offset) when adjacent to the offscreen lantern indicator.
4. **[Resolved — Minor #4] Final Phase 4 Verification Proof:** Executed `npm run build` + `npm run verify -- --write-proof phase-4` on the committed code state prior to tagging `phase-4` and `v1.0.0`.

---

## 2. Live Chrome QA at `1280×720` (`browser` Subagent) — **PASS**

Two Chrome QA passes on `http://localhost:5173/` verified runtime stability, accessibility, and persistence (and caught a real sync-duplication bug in the first pass that was fixed and verified fixed on reload in the second pass):

- **Runtime Stability:** `0` game JS console errors, `0` WebGL console errors, `0` uncaught page/promise errors, and `0` failed HTTP `4xx–5xx` responses across `279` requests.
- **UI Font Size & Large Text (`×1.25`) at `1280×720`:**
  - Normal UI computed minimum font size: **`18px`** (`Main Menu`: `18px`, `H1`: `32px`; `Settings`: `18px`).
  - With **`Chữ lớn (×1.25)`** enabled: minimum scaled cleanly to **`22.5px`** (`H1: 40px`, `Timer: 30px`, `Leaderboard: 22.5px`) with zero overlap between bottom HUD bars.
- **Accessibility Controls:**
  - Verified all 9 rebindable controls; rebinding `Nhảy` to `W` triggered duplicate warning `#keybind-warning` and disabled `#btn-apply-settings`; `"Khôi phục mặc định"` restored `Space` and cleared warning.
  - Verified `"Giảm chuyển động"`, `"Phụ đề sự kiện"` (`"Bóng Mực xuất hiện gần đây!"`), and offscreen lantern/Shade edge indicators (including upright `L1` text on rotated `➤` arrow).
- **Leaderboard Persistence & Deduplication:**
  - Short invalid name `"ab"` blocked with inline validation error (`localStorage` stayed empty).
  - Valid entries (`"May_QA01"`, `"May_v100"`) persisted across **two hard reloads** (`ignoreCache: true`), displayed with the `Seed` column (`Hạng, Tên, Điểm, Đêm, Seed, Ngày`), and remained deduplicated (`1` row per entry) across DOM, `localStorage`, and `/api/leaderboard`.

---

## 3. Automated Benchmark, Soak & Contract Verification Summary

- **Pure Core Scan (`src/core/*.ts`):** `0` DOM / `window` / `document` / `three` / `Math.random` / `Date.now` matches across `types.ts`, `rng.ts`, `maps.ts`, `world.ts`, and `leaderboard.ts`.
- **3D Benchmark (`bench.json`, `1280×720`, `30s` measure + `3s` warmup, vsync off, `200` Shades, `100` Motes, `L1..L3` lit):**
  - `avg_fps`: **`175.9`** (`>= 60` required)
  - `p1_low_fps`: **`78.3`** (`>= 30` required)
  - `frame_ms_p95`: **`8`** ms · `frames`: **`5279`** · `load_ms`: **`543`** (`<= 10000` required) · `peak_mem_mb`: **`841`**
  - `renderer`: `"ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11) (Three.js r170)"`
- **Soak Test (`soak.json`, `10` Nights seed `7+i`):** `crashes: 0`, `mem_start_mb: 55.48 -> mem_end_mb: 59.73` (`1.077x <= 1.2x`), `duration_s: 0.25s`.
- **Full Harness (`docs/proof/phase-4-verification.md`):** Recorded after final code commits (`npm run build && npm run verify -- --write-proof phase-4`).
