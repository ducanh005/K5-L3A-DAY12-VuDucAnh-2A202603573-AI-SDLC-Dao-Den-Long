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
  const last = lines[lines.length - 1];
  if (last.type !== 'end' || !['playing', 'won', 'lost'].includes(last.state)) {
    throw new Error(`${label}: last line must be valid end record`);
  }
  return { lineCount: lines.length, end: last, events: lines.filter((l) => l.type === 'event') };
}

function main() {
  const proofPhase = parseWriteProofArg(process.argv.slice(2));
  const sections = [];

  console.log('1. Running TypeScript check (tsc --noEmit)...');
  runCmd('npx tsc --noEmit');
  sections.push({ title: 'TypeScript Check', command: 'npx tsc --noEmit', output: '0 errors' });

  console.log('2. Building headless CLI bundle (npm run build:headless)...');
  runCmd('npm run build:headless');
  sections.push({ title: 'Headless Bundle Build', command: 'npm run build:headless', output: 'Built dist-headless/cli.js' });

  console.log('3. Running Vitest unit tests (npm test)...');
  const testOut = runCmd('npm test');
  console.log(testOut);
  sections.push({ title: 'Unit Tests', command: 'npm test', output: testOut });

  console.log('4. Checking Test Contract v1.0 headless determinism & JSONL schema...');
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
      const scPath = `tests/scenarios/${scFile}`;
      const inPath = `tests/scenarios/${base}.inputs.json`;
      const out1 = join(tmpDir, `${base}-run1.jsonl`);
      const out2 = join(tmpDir, `${base}-run2.jsonl`);

      const cmd1 = `${contract.headless_cmd} --seed 2026 --night 1 --scenario "${scPath}" --inputs "${inPath}" --ticks 300 --out "${out1}" --snapshot-every 10`;
      const cmd2 = `${contract.headless_cmd} --seed 2026 --night 1 --scenario "${scPath}" --inputs "${inPath}" --ticks 300 --out "${out2}" --snapshot-every 10`;

      runCmd(cmd1);
      runCmd(cmd2);

      const content1 = readFileSync(out1, 'utf8');
      const content2 = readFileSync(out2, 'utf8');
      if (content1 !== content2) {
        throw new Error(`Determinism check FAILED for ${base}`);
      }

      const summary = validateJsonl(content1, base);
      console.log(
        `   [OK] ${base} -> deterministic (${summary.lineCount} JSONL lines, end=${JSON.stringify(summary.end)})`,
      );
      sections.push({
        title: `Headless Contract Verification (${base})`,
        command: `${contract.headless_cmd} --seed 2026 --night 1 --scenario ${scPath} --inputs ${inPath} --ticks 300 --out <tmp> --snapshot-every 10 (x2)`,
        output: `Deterministic match: YES (${summary.lineCount} lines)\nEvents: ${summary.events.map((e) => `${e.tick}:${e.name}`).join(', ')}\nEnd: ${JSON.stringify(summary.end)}`,
      });
    }

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
