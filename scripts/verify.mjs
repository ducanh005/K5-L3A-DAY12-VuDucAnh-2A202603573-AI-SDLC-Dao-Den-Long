import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

function main() {
  const proofPhase = parseWriteProofArg(process.argv.slice(2));
  const sections = [];

  console.log('1. Running TypeScript check (tsc --noEmit)...');
  runCmd('npx tsc --noEmit');
  sections.push({ title: 'TypeScript Check', command: 'npx tsc --noEmit', output: '0 errors' });

  console.log('2. Running Vitest unit tests (npm test)...');
  const testOut = runCmd('npm test');
  console.log(testOut);
  sections.push({ title: 'Unit Tests', command: 'npm test', output: testOut });

  console.log('3. Checking headless determinism across all scenarios...');
  const scenariosDir = resolve(process.cwd(), 'tests/scenarios');
  const scenarios = readdirSync(scenariosDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (scenarios.length === 0) {
    throw new Error('No scenario files found in tests/scenarios');
  }

  for (const file of scenarios) {
    const relPath = `tests/scenarios/${file}`;
    const cmd = `npx tsx src/headless/cli.ts --scenario "${relPath}"`;
    const run1 = runCmd(cmd);
    const run2 = runCmd(cmd);
    if (run1 !== run2) {
      throw new Error(`Determinism check FAILED for ${relPath}:\nRun 1: ${run1}\nRun 2: ${run2}`);
    }
    console.log(`   [OK] ${relPath} -> deterministic`);
    sections.push({
      title: `Headless Determinism (${file})`,
      command: `npm run --silent headless -- --scenario ${relPath} (x2)`,
      output: run1,
    });
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
    console.log(`4. Proof saved to docs/proof/${proofPhase}-verification.md`);
  }

  console.log('ALL VERIFICATION CHECKS PASSED.');
}

main();
