# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Architecture Rules (Strict)
1. **Pure Core (`src/core/`)**: Maps (`maps.ts`), 12-step tick simulation (`world.ts`), RNG (`rng.ts`), leaderboard (`leaderboard.ts`), and types (`types.ts`) MUST stay 100% pure TypeScript with ZERO DOM, `window`, `document`, `three`, `Math.random()`, or `Date.now()` calls.
2. **Test Contract v1.3 (`game.contract.json`)**: `DEFAULT_TUNING` in `src/core/world.ts` MUST match `game.contract.json` (`tuning`), verified by unit test. Use integer tick counters (`fuel_ticks` 1/60, timers) to avoid IEEE-754 boundary drift. Client visuals/audio ("Sáng tạo của tôi") belong ONLY in `src/render/` and MUST be disabled in `benchmarkMode` / headless.
3. **12-Step Tick & Determinism**: Fixed `60 tick/s` (`1/60s`). Same `--seed`, `--night 1|2|3`, scenario, and inputs MUST produce byte-for-byte identical JSONL outputs, and a full Night 3 run (`18,000` ticks) MUST finish in `<= 30s`.

## Commands
- `npm install` — Install dependencies and enable `.githooks`.
- `npm run dev` (or `node scripts/run.mjs`) — Start 3D game locally in browser.
- `npm run build` — Typecheck (`tsc --noEmit`) + Vite bundle (`dist/`) + headless bundle (`dist-headless/cli.js`, `dist-headless/core.js`).
- `npm test` — Run Vitest unit, contract, and 18,000-tick performance tests.
- `npm run bench` — Run standardized 30s 1280×720 3D benchmark (`bench.json`).
- `npm run soak` — Run 10-night headless soak stability test (`soak.json`).
- `npm run verify` — Run typecheck, headless build, unit tests, 2x JSONL determinism, 18,000-tick benchmark, soak smoke, and leaderboard export.
- `npm run verify -- --write-proof <phase>` — Save verified results to `docs/proof/<phase>-verification.md`.

## SDLC & Evidence Integrity
- Never fabricate test results, skip assertions, or hand-edit proof outputs.
- Write acceptance criteria and verification scenarios BEFORE coding; document replaced tests/assumptions in `docs/notes/assumptions.md`.
- Keep commits small; `.githooks/pre-commit` blocks commits when `npm test` fails.
- After each phase, run an independent reviewer subagent before tagging `phase-N`.
