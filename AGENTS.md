# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Architecture Rules (Strict)
1. **Pure Core (`src/core/`)**: Game rules, physics, RNG (`rng.ts`), and state MUST stay 100% pure TypeScript with ZERO DOM, `window`, `document`, `three`, `Math.random()`, or `Date.now()` calls.
2. **Test Contract (`game.contract.json`)**: `DEFAULT_TUNING` in `src/core/world.ts` MUST match `game.contract.json` (`tuning`), verified by unit test. Client features ("Sáng tạo của tôi") belong ONLY in `src/render/` and must never alter headless outputs.
3. **Determinism**: Fixed `60 tick/s` (`1/60s`). Same `--seed` + scenario + inputs MUST produce byte-for-byte identical JSONL outputs.

## Commands
- `npm install` — Install dependencies and enable `.githooks`.
- `npm run dev` — Start 3D game locally in browser.
- `npm run build` — Typecheck (`tsc --noEmit`) + Vite bundle (`dist/`) + headless bundle (`dist-headless/cli.js`).
- `npm test` — Run Vitest unit & contract tests.
- `npm run verify` — Run typecheck, headless build, unit tests, and 2x Test Contract JSONL determinism checks.
- `npm run verify -- --write-proof <phase>` — Run full verify and save real output to `docs/proof/<phase>-verification.md`.

## SDLC & Evidence Integrity
- Never fabricate test results, skip assertions, or hand-edit proof outputs.
- Write acceptance criteria and verification scenarios BEFORE coding; document replaced tests in `docs/notes/assumptions.md`.
- Keep commits small; `.githooks/pre-commit` blocks commits when `npm test` fails.
- After each phase, run an independent reviewer subagent before tagging `phase-N`.
