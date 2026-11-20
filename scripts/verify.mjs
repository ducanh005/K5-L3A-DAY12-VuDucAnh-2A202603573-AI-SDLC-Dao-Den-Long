import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';

function runCmd(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseWriteProofArg(argv) {
  const idx = argv.indexOf('--write-proof');
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1];
  }
  return null;
}

function getScenarioConfig(base) {
  if (base.includes('night2') || base.includes('dash-and-charm') || base.includes('drifter')) {
    return { night: 2, ticks: 360 };
  }
  if (base.includes('night3')) {
    return { night: 3, ticks: 1900 };
  }
  if (base.includes('p3-')) {
    return { night: 1, ticks: 200 };
  }
  return { night: 1, ticks: 300 };
}

function validateJsonl(jsonlText, label) {
  const lines = jsonlText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (lines.length < 2) {
    throw new Error(`${label}: expected at least 2 JSONL lines`);
  }
  if (lines[0].type !== 'snapshot' || lines[0].tick !== 0) {
    throw new Error(`${label}: first line must be snapshot at tick 0`);
  }
  const snap0 = lines[0];
  if (
    snap0.night === undefined ||
    snap0.wind === undefined ||
    typeof snap0.wind.active !== 'boolean' ||
    typeof snap0.wind.dir_deg !== 'number' ||
    !snap0.player ||
    typeof snap0.player.capacity !== 'number' ||
    !Array.isArray(snap0.player.vel) ||
    typeof snap0.player.grounded !== 'boolean' ||
    typeof snap0.player.invuln !== 'boolean' ||
    typeof snap0.player.dash_cd_s !== 'number' ||
    typeof snap0.player.pulse_cd_s !== 'number' ||
    typeof snap0.player.charm_s !== 'number' ||
    !Array.isArray(snap0.lanterns) ||
    typeof snap0.lanterns[0]?.fuel !== 'number' ||
    typeof snap0.lanterns[0]?.ever_lit !== 'boolean' ||
    typeof snap0.lanterns[0]?.relit_count !== 'number' ||
    !Array.isArray(snap0.motes) ||
    !Array.isArray(snap0.drifters) ||
    !Array.isArray(snap0.charms)
  ) {
    throw new Error(`${label}: snapshot missing Contract v1.2 required fields`);
  }
  const last = lines[lines.length - 1];
  if (last.type !== 'end' || !['playing', 'paused', 'won', 'lost'].includes(last.state)) {
    throw new Error(`${label}: last line must be valid end record`);
  }
  return {
    lineCount: lines.length,
    end: last,
    events: lines.filter((l) => l.type === 'event'),
    snapshots: lines.filter((l) => l.type === 'snapshot'),
  };
}

function main() {
  const proofPhase = parseWriteProofArg(process.argv.slice(2));
  const sections = [];

  console.log('1. Running TypeScript check (tsc --noEmit)...');
  runCmd('npx tsc --noEmit');
  sections.push({ title: 'TypeScript Check', command: 'npx tsc --noEmit', output: '0 errors' });

  console.log('2. Building headless CLI bundle (npm run build:headless)...');
  runCmd('npm run build:headless');
  sections.push({
    title: 'Headless Bundle Build',
    command: 'npm run build:headless',
    output: 'Built dist-headless/cli.js',
  });

  console.log('3. Running Vitest unit & contract tests (npm test)...');
  const testOut = runCmd('npm test');
  console.log(testOut);
  sections.push({ title: 'Unit & Contract Tests', command: 'npm test', output: testOut });

  console.log('4. Checking Test Contract v1.2 headless determinism & JSONL schema across all scenarios...');
  const contract = JSON.parse(readFileSync(resolve(process.cwd(), 'game.contract.json'), 'utf8'));
  const scenariosDir = resolve(process.cwd(), 'tests/scenarios');
  const scenarioFiles = readdirSync(scenariosDir)
    .filter((f) => f.endsWith('.scenario.json'))
    .sort();

  if (scenarioFiles.length === 0) {
    throw new Error('No *.scenario.json files found in tests/scenarios');
  }

  const tmpDir = mkdtempSync(join(os.tmpdir(), 'ddl-verify-'));
  try {
    for (const scFile of scenarioFiles) {
      const base = scFile.replace(/\.scenario\.json$/, '');
      const { night, ticks } = getScenarioConfig(base);
      const scPath = `tests/scenarios/${scFile}`;
      const inPath = `tests/scenarios/${base}.inputs.json`;
      const out1 = join(tmpDir, `${base}-run1.jsonl`);
      const out2 = join(tmpDir, `${base}-run2.jsonl`);

      const cmd1 = `${contract.headless_cmd} --seed 2026 --night ${night} --scenario "${scPath}" --inputs "${inPath}" --ticks ${ticks} --out "${out1}" --snapshot-every 10`;
      const cmd2 = `${contract.headless_cmd} --seed 2026 --night ${night} --scenario "${scPath}" --inputs "${inPath}" --ticks ${ticks} --out "${out2}" --snapshot-every 10`;

      runCmd(cmd1);
      runCmd(cmd2);

      const content1 = readFileSync(out1, 'utf8');
      const content2 = readFileSync(out2, 'utf8');
      if (content1 !== content2) {
        throw new Error(`Determinism check FAILED for ${base}`);
      }

      const summary = validateJsonl(content1, base);
      console.log(
        `   [OK] ${base} (Night ${night}) -> deterministic (${summary.lineCount} JSONL lines, end=${JSON.stringify(summary.end)})`,
      );
      sections.push({
        title: `Headless Contract Verification (${base})`,
        command: `${contract.headless_cmd} --seed 2026 --night ${night} --scenario ${scPath} --inputs ${inPath} --ticks ${ticks} --out <tmp> --snapshot-every 10 (x2)`,
        output: `Deterministic match: YES (${summary.lineCount} lines)\nEvents: ${summary.events.map((e) => `${e.tick}:${e.name}`).join(', ')}\nEnd: ${JSON.stringify(summary.end)}`,
      });
    }

    // Benchmark full 18,000-tick Night 3 run (must complete all 18,000 ticks in <= 30s)
    const benchScenario = join(tmpDir, 'bench-18000-scenario.json');
    writeFileSync(benchScenario, JSON.stringify({ player: { flames: 300 } }), 'utf8');
    const benchOut = join(tmpDir, 'bench-18000.jsonl');
    const t0 = performance.now();
    runCmd(`${contract.headless_cmd} --seed 2026 --night 3 --scenario "${benchScenario}" --ticks 18000 --out "${benchOut}" --snapshot-every 600`);
    const benchMs = Math.round(performance.now() - t0);
    const benchLines = readFileSync(benchOut, 'utf8').trim().split('\n').filter(Boolean);
    const benchEnd = JSON.parse(benchLines[benchLines.length - 1]);
    if (benchEnd.type !== 'end' || benchEnd.ticks !== 18000) {
      throw new Error(`18,000-tick benchmark stopped early at tick ${benchEnd.ticks}`);
    }
    if (benchMs > 30000) {
      throw new Error(`18,000-tick headless run exceeded 30s budget: ${benchMs}ms`);
    }
    console.log(`   [OK] 18,000-tick Night 3 benchmark (${benchEnd.ticks} ticks) -> ${benchMs}ms (limit <= 30000ms)`);
    sections.push({
      title: 'Full Night Headless Performance Benchmark (18,000 ticks)',
      command: `${contract.headless_cmd} --seed 2026 --night 3 --scenario <flames=300> --ticks 18000 --out <tmp> --snapshot-every 600`,
      output: `Completed ticks: ${benchEnd.ticks}\nElapsed: ${benchMs} ms (Budget <= 30000 ms)`,
    });

    // Verify invalid input triggers exit code 2
    const badFile = join(tmpDir, 'bad-inputs.json');
    writeFileSync(badFile, '{"frames":[{"tick":5},{"tick":2}]}', 'utf8');
    const badCheck = spawnSync(
      'node',
      ['dist-headless/cli.js', '--seed', '1', '--night', '1', '--inputs', badFile, '--ticks', '10', '--out', join(tmpDir, 'bad.jsonl')],
      { encoding: 'utf8' },
    );
    if (badCheck.status !== 2) {
      throw new Error(`Expected exit code 2 for invalid inputs, got ${badCheck.status}`);
    }
    console.log('   [OK] Invalid inputs exit code check -> exit 2');
    sections.push({
      title: 'Malformed Inputs Exit Code Check',
      command: 'node dist-headless/cli.js --seed 1 --night 1 --inputs <bad-inputs.json> --ticks 10 --out <tmp>',
      output: `Exit code: ${badCheck.status}\nStderr: ${badCheck.stderr.trim()}`,
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  if (proofPhase) {
    const proofDir = resolve(process.cwd(), 'docs/proof');
    mkdirSync(proofDir, { recursive: true });
    let gitSha = 'uncommitted';
    try {
      gitSha = runCmd('git rev-parse --short HEAD');
    } catch {
      gitSha = 'uncommitted';
    }

    const lines = [
      `# Verification Proof — ${proofPhase}`,
      '',
      `- **Generated at:** ${new Date().toISOString()}`,
      `- **Git commit:** \`${gitSha}\``,
      `- **Environment:** ${os.platform()} ${os.release()} (${os.arch()}), Node ${process.version}`,
      `- **Status:** ALL CHECKS PASSED`,
      '',
      '## Results',
      '',
    ];

    for (const sec of sections) {
      lines.push(`### ${sec.title}`);
      lines.push(`- **Command:** \`${sec.command}\``);
      lines.push('```text');
      lines.push(sec.output);
      lines.push('```');
      lines.push('');
    }

    const outPath = join(proofDir, `${proofPhase}-verification.md`);
    writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`5. Proof saved to docs/proof/${proofPhase}-verification.md`);
  }

  console.log('ALL VERIFICATION CHECKS PASSED.');
}

main();
