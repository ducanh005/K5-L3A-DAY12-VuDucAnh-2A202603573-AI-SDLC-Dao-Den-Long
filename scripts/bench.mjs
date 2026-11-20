import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

function parseArgs(argv) {
  let seed = 42;
  let duration = 30;
  let out = 'bench.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed') {
      if (!next || !Number.isInteger(Number(next))) {
        throw new Error('--seed must be an integer');
      }
      seed = Number(next);
      i++;
    } else if (arg === '--duration') {
      if (!next || !Number.isFinite(Number(next)) || Number(next) <= 0) {
        throw new Error('--duration must be a positive number');
      }
      duration = Number(next);
      i++;
    } else if (arg === '--out') {
      if (!next) throw new Error('Missing path for --out');
      out = next;
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { seed, duration, out };
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'chrome', 'msedge']) {
    try {
      const cmd = process.platform === 'win32' ? `where ${bin}` : `which ${bin}`;
      const found = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)[0]
        ?.trim();
      if (found) return found;
    } catch {
      // Ignore missing candidates
    }
  }
  return null;
}

function measureWindowsTreeRssMb(rootPid) {
  try {
    const cmd = `powershell -NoProfile -Command "$all=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize; $pids=@(${rootPid}); $changed=$true; while($changed){$changed=$false; foreach($p in $all){if($pids -contains $p.ParentProcessId -and -not ($pids -contains $p.ProcessId)){$pids+=$p.ProcessId; $changed=$true}}}; $sum=($all | Where-Object {$pids -contains $_.ProcessId} | Measure-Object WorkingSetSize -Sum).Sum; [math]::Round($sum / 1MB, 1)"`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2500 }).trim();
    const val = Number.parseFloat(out);
    return Number.isFinite(val) && val > 0 ? val : null;
  } catch {
    return null;
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  const tStart = performance.now();
  const distDir = resolve(process.cwd(), 'dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    execSync('npx vite build', { stdio: 'inherit' });
  }

  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    console.error('Error: Chrome/Chromium/Edge browser binary not found on PATH or standard locations.');
    process.exit(1);
  }

  let firstFrameAt = null;
  let peakMemMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  let benchDoneResolve;
  let benchDoneReject;
  const benchDonePromise = new Promise((res, rej) => {
    benchDoneResolve = res;
    benchDoneReject = rej;
  });

  const server = createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (req.method === 'POST' && urlPath === '/api/first-frame') {
      if (firstFrameAt === null) {
        firstFrameAt = performance.now();
      }
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
      return;
    }
    if (req.method === 'POST' && urlPath === '/api/bench-done') {
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
        try {
          benchDoneResolve(JSON.parse(body));
        } catch (e) {
          benchDoneReject(e);
        }
      });
      return;
    }

    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = join(distDir, rel);
    if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = extname(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(readFileSync(filePath));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const profileDir = mkdtempSync(join(os.tmpdir(), 'ddl-bench-'));

  const targetUrl = `http://127.0.0.1:${port}/?bench=1&seed=${opts.seed}&duration=${opts.duration}`;
  const child = spawn(
    browserExe,
    [
      `--user-data-dir=${profileDir}`,
      '--window-size=1280,720',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--no-first-run',
      '--no-default-browser-check',
      `--app=${targetUrl}`,
    ],
    { stdio: 'ignore' },
  );

  const sampleMemory = () => {
    if (child.pid && process.platform === 'win32') {
      const browserMb = measureWindowsTreeRssMb(child.pid);
      const nodeMb = process.memoryUsage().rss / (1024 * 1024);
      if (browserMb !== null) {
        peakMemMb = Math.max(peakMemMb, Math.round(browserMb + nodeMb));
      }
    }
  };

  // Sample memory during initial 3s warmup (not during active GPU frame measurement)
  const warmupMemTimer = setTimeout(sampleMemory, 1500);

  const timeoutHandle = setTimeout(() => {
    benchDoneReject(new Error(`Benchmark timed out after ${opts.duration + 45}s`));
  }, (opts.duration + 45) * 1000);

  try {
    const pageMetrics = await benchDonePromise;
    const loadMs = Math.round((firstFrameAt ?? performance.now()) - tStart);
    sampleMemory();

    const output = {
      contract_version: '1.3',
      avg_fps: pageMetrics.avg_fps,
      p1_low_fps: pageMetrics.p1_low_fps,
      frame_ms_p95: pageMetrics.frame_ms_p95,
      frames: pageMetrics.frames,
      load_ms: loadMs,
      peak_mem_mb: peakMemMb,
      vsync_off: true,
      renderer: pageMetrics.renderer,
      os: `${os.platform()} ${os.release()} (${os.arch()})`,
    };

    const outPath = resolve(process.cwd(), opts.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Benchmark complete -> ${opts.out}: ${JSON.stringify(output)}`);
  } finally {
    clearTimeout(warmupMemTimer);
    clearTimeout(timeoutHandle);
    try {
      if (child.pid && process.platform === 'win32') {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
    } catch {
      // Ignore already exited child
    }
    server.close();
    await new Promise((r) => setTimeout(r, 200));
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Windows Chrome background handles may linger briefly
    }
  }
}

main().catch((err) => {
  console.error(`Benchmark failed: ${err.message}`);
  process.exit(1);
});
