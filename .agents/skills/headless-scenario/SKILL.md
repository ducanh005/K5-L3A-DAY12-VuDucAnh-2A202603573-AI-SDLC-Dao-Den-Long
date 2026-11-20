---
name: headless-scenario
description: Create and validate a reproducible headless scenario JSON file against the Test Contract.
---

# Skill: Headless Scenario

Use this skill whenever a new PRD or Ticket adds or modifies gameplay behavior.

## Steps
1. Extract exact Test Contract requirements (inputs, tick rate, entity states, output schema).
2. Create a minimal JSON scenario under `tests/scenarios/<name>.json` containing `seed`, `dt`, and `steps`.
3. Run the headless CLI twice to confirm identical JSON output:
   ```bash
   npm run --silent headless -- --scenario tests/scenarios/<name>.json
   ```
4. Register the scenario in `scripts/verify.mjs` so every future regression run checks it automatically.
