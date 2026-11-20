import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { defineConfig, type Connect } from 'vite';
import { sanitizeLeaderboardEntries } from './src/core/leaderboard.js';

const LEADERBOARD_PATH = resolve(process.cwd(), '.leaderboard.json');

function readDiskLeaderboard() {
  if (!existsSync(LEADERBOARD_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LEADERBOARD_PATH, 'utf8')) as { entries?: unknown };
    return sanitizeLeaderboardEntries(parsed.entries);
  } catch {
    return [];
  }
}

function attachLeaderboardMiddleware(middlewares: Connect.Server): void {
  middlewares.use('/api/leaderboard', (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    if (req.method === 'GET') {
      const entries = readDiskLeaderboard();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ entries }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}') as { entry?: unknown; entries?: unknown };
          const current = readDiskLeaderboard();
          const mergedRaw = Array.isArray(parsed.entries)
            ? [...current, ...parsed.entries]
            : parsed.entry
              ? [...current, parsed.entry]
              : current;
          const nextEntries = sanitizeLeaderboardEntries(mergedRaw);
          writeFileSync(LEADERBOARD_PATH, JSON.stringify({ entries: nextEntries }, null, 2) + '\n', 'utf8');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ entries: nextEntries }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }
    next();
  });
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  plugins: [
    {
      name: 'dao-den-long-leaderboard-api',
      configureServer(server) {
        attachLeaderboardMiddleware(server.middlewares);
      },
      configurePreviewServer(server) {
        attachLeaderboardMiddleware(server.middlewares);
      },
    },
  ],
});
