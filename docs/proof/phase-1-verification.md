# Verification Proof — phase-1

- **Generated at:** 2026-11-20T08:15:56.268Z
- **Git commit:** `f8e53d3`
- **Environment:** win32 10.0.26200 (x64), Node v24.19.0
- **Status:** ALL CHECKS PASSED

## Results

### TypeScript Check
- **Command:** `npx tsc --noEmit`
```text
0 errors
```

### Headless Bundle Build
- **Command:** `npm run build:headless`
```text
Built dist-headless/cli.js
```

### Unit Tests
- **Command:** `npm test`
```text
> dao-den-long@0.2.0-phase1 test
> vitest run


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mD:/AI thuc chien/K5-L3A-DAY12-VuDucAnh-2A202603573-AI-SDLC-Dao-Den-Long[39m

 [32m✓[39m tests/core.test.ts [2m([22m[2m9 tests[22m[2m)[22m[33m 2745[2mms[22m[39m
   [33m[2m✓[22m[39m Phase 1 — PRD-0 & Test Contract v1.0[2m > [22mheadless CLI outputs valid JSONL and exits with code 2 on malformed inputs [33m2728[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m9 passed[39m[22m[90m (9)[39m
[2m   Start at [22m 15:15:52
[2m   Duration [22m 3.30s[2m (transform 57ms, setup 0ms, collect 72ms, tests 2.74s, environment 0ms, prepare 148ms)[22m
```

### Headless Contract Verification (p1-collect-and-light)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p1-collect-and-light.scenario.json --inputs tests/scenarios/p1-collect-and-light.inputs.json --ticks 300 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (37 lines)
Events: 26:mote_picked, 77:mote_picked, 127:mote_picked, 231:deposit, 231:lantern_lit
End: {"type":"end","ticks":300,"state":"playing","score":130}
```

### Headless Contract Verification (p1-pulse-and-win)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p1-pulse-and-win.scenario.json --inputs tests/scenarios/p1-pulse-and-win.inputs.json --ticks 300 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (14 lines)
Events: 1:pulse, 86:deposit, 86:lantern_lit, 86:game_over
End: {"type":"end","ticks":86,"state":"won","score":275}
```

### Malformed Inputs Exit Code Check
- **Command:** `node dist-headless/cli.js --seed 1 --night 1 --inputs <bad-inputs.json> --ticks 10 --out <tmp>`
```text
Exit code: 2
Stderr: Error: Frame ticks must be strictly increasing (got 2 after 5)
```
