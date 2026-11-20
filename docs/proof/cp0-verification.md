# Verification Proof — cp0

- **Generated at:** 2026-11-20T07:41:31.331Z
- **Git commit:** `uncommitted`
- **Environment:** win32 10.0.26200 (x64), Node v24.19.0
- **Status:** ALL CHECKS PASSED

## Results

### TypeScript Check
- **Command:** `npx tsc --noEmit`
```text
0 errors
```

### Unit Tests
- **Command:** `npm test`
```text
> dao-den-long@0.1.0 test
> vitest run


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mD:/AI thuc chien/K5-L3A-DAY12-VuDucAnh-2A202603573-AI-SDLC-Dao-Den-Long[39m

 [32m✓[39m tests/core.test.ts [2m([22m[2m3 tests[22m[2m)[22m[90m 6[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m3 passed[39m[22m[90m (3)[39m
[2m   Start at [22m 14:41:28
[2m   Duration [22m 473ms[2m (transform 53ms, setup 0ms, collect 55ms, tests 6ms, environment 0ms, prepare 159ms)[22m
```

### Headless Determinism (cp0-smoke.json)
- **Command:** `npm run --silent headless -- --scenario tests/scenarios/cp0-smoke.json (x2)`
```text
{"seed":2026,"tick":210,"time":3.507,"status":"playing","player":{"pos":{"x":4.5,"y":0,"z":5.7},"yaw":3.1416,"fireflies":2,"hp":3,"stamina":100,"invulnTimer":0},"firefliesCollected":2,"lanternsLit":0,"shadowPositions":[{"id":"shadow-1","pos":{"x":-0.8171,"y":0,"z":-4.1881}},{"id":"shadow-2","pos":{"x":1.5983,"y":0,"z":19.3367}}]}
```
