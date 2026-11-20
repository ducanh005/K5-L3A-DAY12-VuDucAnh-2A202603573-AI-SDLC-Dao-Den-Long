# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Architecture Rules (Strict)
1. **Pure Core (`src/core/`)**: Game rules, physics, RNG (`rng.ts`), and state MUST stay 100% pure TypeScript with ZERO DOM, `window`, `document`, `three`, `Math.random()`, or `Date.now()` calls.
2. **Headless Contract (`src/headless/cli.ts`)**: Exposes the deterministic headless interface. Any client feature ("Sáng tạo của tôi") belongs ONLY in `src/render/` and must never alter headless outputs.
3. **Determinism**: Same `seed` + same `dt` + same `InputState` sequence MUST produce identical outputs across repeated runs and OS platforms.

## Commands
- `npm install` — Install dependencies and enable `.githooks`.
- `npm run dev` — Start 3D game locally in browser.
- `npm run build` — Typecheck (`tsc --noEmit`) + production static bundle (`dist/`).
- `npm test` — Run Vitest unit & core tests.
- `npm run --silent headless -- --scenario tests/scenarios/cp0-smoke.json` — Run deterministic headless simulation.
- `npm run verify` — Run typecheck, unit tests, and 2x headless determinism verification.
- `npm run verify -- --write-proof <phase>` — Run full verify and save real output to `docs/proof/<phase>-verification.md`.

## SDLC & Evidence Integrity
- Never fabricate test results, skip assertions, or hand-edit headless proof outputs.
- Read requirements and write acceptance criteria + verification scenarios BEFORE coding.
- When a later ticket changes an old rule, update or remove affected old tests with a documented reason in `docs/notes/assumptions.md`.
- Keep commits small, focused, and blocked by `.githooks/pre-commit` if `npm test` fails.
- After implementing each phase, use a separate reviewer subagent (`research` or independent review pass) before tagging `phase-N`.
