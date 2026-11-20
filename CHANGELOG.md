# Changelog

## [0.1.0-cp0] - Checkpoint 0 (Bootstrap)
- Initialized project structure separating pure deterministic core (`src/core/`), headless CLI (`src/headless/`), and Three.js 3D client (`src/render/`).
- Added AI SDLC harness: `AGENTS.md`, skills (`verify-phase`, `headless-scenario`), `.githooks/pre-commit`, `.github/workflows/ci.yml`, and `scripts/verify.mjs`.
- Added unit tests and baseline deterministic smoke scenario (`tests/scenarios/cp0-smoke.json`).
