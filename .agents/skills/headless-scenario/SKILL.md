---
name: headless-scenario
description: Create and validate a reproducible headless scenario + inputs pair against Test Contract v1.0.
---

# Skill: Headless Scenario

Use this skill whenever a PRD or Ticket adds or modifies gameplay behavior.

## Steps
1. Extract exact Test Contract requirements (tuning, inputs, scenario overrides, event names, output schema).
2. Create paired JSON files under `tests/scenarios/`: `<name>.scenario.json` and `<name>.inputs.json`.
3. Build and run the headless CLI twice to verify byte-for-byte identical JSONL output:
   ```bash
   npm run build:headless
   node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/<name>.scenario.json --inputs tests/scenarios/<name>.inputs.json --ticks 300 --out /tmp/out.jsonl --snapshot-every 10
   ```
4. Ensure `scripts/verify.mjs` discovers and validates `<name>.scenario.json` automatically during `npm run verify`.
