import {
  type LeaderboardEntry,
  sanitizeLeaderboardEntries,
  sortLeaderboardEntries,
  validateLeaderboardName,
} from '../core/leaderboard.js';

export { type LeaderboardEntry, validateLeaderboardName };

const LEADERBOARD_STORAGE_KEY = 'dao-den-long-leaderboard-v1';

/**
 * Formats a Date in ISO 8601 format with explicit local timezone offset (e.g. +07:00).
 */
export function formatIsoWithTimezone(d = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const hh = pad(offsetMin / 60);
  const mm = pad(offsetMin % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`
  );
}

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeLeaderboardEntries(parsed);
  } catch {
    return [];
  }
}

function writeLocalLeaderboard(entries: LeaderboardEntry[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export async function syncLeaderboardFromDisk(): Promise<LeaderboardEntry[]> {
  const local = loadLeaderboard();
  if (typeof window === 'undefined' || typeof fetch !== 'function') return local;
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return local;
    const data = (await res.json()) as { entries?: unknown };
    const merged = sanitizeLeaderboardEntries([...local, ...(Array.isArray(data.entries) ? data.entries : [])]);
    writeLocalLeaderboard(merged);
    if (merged.length > 0 && (!Array.isArray(data.entries) || merged.length > data.entries.length)) {
      void fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: merged }),
        keepalive: true,
      }).catch(() => {});
    }
    return merged;
  } catch {
    return local;
  }
}

export async function saveLeaderboardEntry(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  const existing = loadLeaderboard();
  const nextLocal = sortLeaderboardEntries([...existing, entry]);
  writeLocalLeaderboard(nextLocal);

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
        keepalive: true,
      });
      if (res.ok) {
        const data = (await res.json()) as { entries?: unknown };
        const synced = sanitizeLeaderboardEntries(data.entries);
        writeLocalLeaderboard(synced);
        return synced;
      }
    } catch {
      // Static build / offline fallback uses localStorage only
    }
  }
  return nextLocal;
}
