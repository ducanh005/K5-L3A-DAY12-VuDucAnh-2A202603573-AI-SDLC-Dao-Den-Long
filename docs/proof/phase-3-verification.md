# Verification Proof — phase-3

- **Generated at:** 2026-11-20T09:30:07.612Z
- **Git commit:** `d2b4df2`
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

### Unit & Contract Tests
- **Command:** `npm test`
```text
> dao-den-long@0.4.0-phase3 test
> vitest run


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mD:/AI thuc chien/K5-L3A-DAY12-VuDucAnh-2A202603573-AI-SDLC-Dao-Den-Long[39m

 [32m✓[39m tests/core.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 570[2mms[22m[39m
   [33m[2m✓[22m[39m Phase 3 — Ticket-03 ("Đèn cạn dầu") & Test Contract v1.2[2m > [22mcompletes full 18,000-tick Night 3 run under 30s and exits 2 on invalid inputs [33m560[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m6 passed[39m[22m[90m (6)[39m
[2m   Start at [22m 16:30:04
[2m   Duration [22m 1.16s[2m (transform 86ms, setup 0ms, collect 108ms, tests 570ms, environment 0ms, prepare 157ms)[22m
```

### Headless Contract Verification (p1-collect-and-light)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p1-collect-and-light.scenario.json --inputs tests/scenarios/p1-collect-and-light.inputs.json --ticks 300 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (38 lines)
Events: 1:night_start, 40:mote_picked, 91:mote_picked, 141:mote_picked, 236:deposit, 236:lantern_lit
End: {"type":"end","ticks":300,"state":"playing","score":150}
```

### Headless Contract Verification (p1-pulse-and-win)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p1-pulse-and-win.scenario.json --inputs tests/scenarios/p1-pulse-and-win.inputs.json --ticks 300 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (19 lines)
Events: 1:night_start, 1:pulse, 86:deposit, 86:lantern_lit, 120:game_over
End: {"type":"end","ticks":120,"state":"won","score":991}
```

### Headless Contract Verification (p2-dash-and-charm)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 2 --scenario tests/scenarios/p2-dash-and-charm.scenario.json --inputs tests/scenarios/p2-dash-and-charm.inputs.json --ticks 360 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (42 lines)
Events: 1:night_start, 10:charm_picked, 21:dash, 36:dash
End: {"type":"end","ticks":360,"state":"playing","score":0}
```

### Headless Contract Verification (p2-drifter-steal-and-drop)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 2 --scenario tests/scenarios/p2-drifter-steal-and-drop.scenario.json --inputs tests/scenarios/p2-drifter-steal-and-drop.inputs.json --ticks 360 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (42 lines)
Events: 1:night_start, 33:drifter_steal, 37:drifter_drop, 37:pulse
End: {"type":"end","ticks":360,"state":"playing","score":0}
```

### Headless Contract Verification (p2-night2-jumppad-and-fall)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 2 --scenario tests/scenarios/p2-night2-jumppad-and-fall.scenario.json --inputs tests/scenarios/p2-night2-jumppad-and-fall.inputs.json --ticks 360 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (40 lines)
Events: 1:night_start, 301:player_hit
End: {"type":"end","ticks":360,"state":"playing","score":0}
```

### Headless Contract Verification (p2-night3-tiers-wind-pause)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 3 --scenario tests/scenarios/p2-night3-tiers-wind-pause.scenario.json --inputs tests/scenarios/p2-night3-tiers-wind-pause.inputs.json --ticks 1900 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (197 lines)
Events: 1:night_start, 71:deposit, 71:lantern_lit, 81:paused, 101:resumed
End: {"type":"end","ticks":1900,"state":"playing","score":150}
```

### Headless Contract Verification (p3-fuel-refuel-relight)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p3-fuel-refuel-relight.scenario.json --inputs tests/scenarios/p3-fuel-refuel-relight.inputs.json --ticks 200 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (27 lines)
Events: 1:night_start, 1:refuel, 60:lantern_out, 111:deposit, 111:lantern_lit
End: {"type":"end","ticks":200,"state":"playing","score":75}
```

### Headless Contract Verification (p3-shade-drain-and-dawn-win)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 1 --scenario tests/scenarios/p3-shade-drain-and-dawn-win.scenario.json --inputs tests/scenarios/p3-shade-drain-and-dawn-win.inputs.json --ticks 200 --out <tmp> --snapshot-every 10 (x2)`
```text
Deterministic match: YES (25 lines)
Events: 1:night_start, 76:fuel_drain, 136:fuel_drain, 166:pulse, 180:game_over
End: {"type":"end","ticks":180,"state":"won","score":503}
```

### Full Night Headless Performance Benchmark (18,000 ticks)
- **Command:** `node dist-headless/cli.js --seed 2026 --night 3 --scenario <flames=300> --ticks 18000 --out <tmp> --snapshot-every 600`
```text
Completed ticks: 18000
Elapsed: 652 ms (Budget <= 30000 ms)
```

### Malformed Inputs Exit Code Check
- **Command:** `node dist-headless/cli.js --seed 1 --night 1 --inputs <bad-inputs.json> --ticks 10 --out <tmp>`
```text
Exit code: 2
Stderr: Error: Frame ticks must be strictly increasing (got 2 after 5)
```
