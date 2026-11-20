import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const VALID_NAME_RE = /^[A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]{3,12}$/;

function sanitizeEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { name, score, nights_won, achieved_at, seed } = item;
    if (
      typeof name === 'string' &&
      VALID_NAME_RE.test(name.trim()) &&
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= 0 &&
      typeof nights_won === 'number' &&
      Number.isInteger(nights_won) &&
      nights_won >= 0 &&
      nights_won <= 3 &&
      typeof achieved_at === 'string' &&
      !Number.isNaN(Date.parse(achieved_at)) &&
      typeof seed === 'number' &&
      Number.isFinite(seed)
    ) {
      const normalized = {
        name: name.trim(),
        score: Math.round(score),
        nights_won,
        achieved_at,
        seed: Math.trunc(seed),
      };
      const dedupeKey = `${normalized.name}|${normalized.score}|${normalized.nights_won}|${normalized.achieved_at}|${normalized.seed}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        valid.push(normalized);
      }
    }
  }
  return valid
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.achieved_at.localeCompare(b.achieved_at);
    })
    .slice(0, 10);
}

function main() {
  const argv = process.argv.slice(2);
  const exportIdx = argv.indexOf('--export-leaderboard');
  if (exportIdx !== -1) {
    const outArg = argv[exportIdx + 1];
    if (!outArg) {
      console.error('Error: --export-leaderboard requires an output file path');
      process.exit(2);
    }
    const storePath = resolve(process.cwd(), '.leaderboard.json');
    let entries = [];
    if (existsSync(storePath)) {
      const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
      entries = sanitizeEntries(parsed.entries);
    } else {
      writeFileSync(storePath, JSON.stringify({ entries: [] }, null, 2) + '\n', 'utf8');
    }
    const outPath = resolve(process.cwd(), outArg);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  const viteBin = resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, ...argv], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
