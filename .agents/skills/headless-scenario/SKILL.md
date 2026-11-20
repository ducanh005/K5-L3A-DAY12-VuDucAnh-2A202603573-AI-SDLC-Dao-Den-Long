---
name: headless-scenario
description: Create and validate a reproducible headless scenario + inputs pair against Test Contract v1.1 (Nights 1–3).
---

# Skill: Headless Scenario

Use this skill whenever a PRD or Ticket adds or modifies gameplay behavior.

## Steps
1. Extract exact Test Contract v1.1 requirements (tuning, 12-step tick order, Nights 1–3 maps, `wind`, `drifters`, `charms`, `dash`, `pause`, event payloads).
2. Create paired JSON files under `tests/scenarios/`: `<name>.scenario.json` and `<name>.inputs.json`.
3. Build and run the headless CLI twice to verify byte-for-byte identical JSONL output:
   ```bash
   npm run build:headless
   node dist-headless/cli.js --seed 2026 --night <1|2|3> --scenario tests/scenarios/<name>.scenario.json --inputs tests/scenarios/<name>.inputs.json --ticks 360 --out /tmp/out.jsonl --snapshot-every 10
   ```
4. Register night/tick defaults in `scripts/verify.mjs` so `npm run verify` checks determinism and v1.1 snapshot fields automatically.
