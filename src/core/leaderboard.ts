export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export const LEADERBOARD_LIMIT = 10;

const VALID_NAME_RE = /^[A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]{3,12}$/;

/**
 * Validates player name (3-12 alphanumeric, underscore, or accented Vietnamese letters).
 */
export function validateLeaderboardName(name: string): boolean {
  return VALID_NAME_RE.test(name.trim());
}

/**
 * Sorts leaderboard entries by score descending; ties break by earlier timestamp ascending, kept to top 10.
 */
export function sortLeaderboardEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return ta - tb;
      }
      return a.achieved_at.localeCompare(b.achieved_at);
    })
    .slice(0, LEADERBOARD_LIMIT);
}

/**
 * Filters raw JSON array into valid, sorted top-10 LeaderboardEntry items.
 */
export function sanitizeLeaderboardEntries(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: LeaderboardEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (
      typeof e.name === 'string' &&
      validateLeaderboardName(e.name) &&
      typeof e.score === 'number' &&
      Number.isFinite(e.score) &&
      e.score >= 0 &&
      typeof e.nights_won === 'number' &&
      Number.isInteger(e.nights_won) &&
      e.nights_won >= 0 &&
      e.nights_won <= 3 &&
      typeof e.achieved_at === 'string' &&
      !Number.isNaN(Date.parse(e.achieved_at)) &&
      typeof e.seed === 'number' &&
      Number.isFinite(e.seed)
    ) {
      const normalized: LeaderboardEntry = {
        name: e.name.trim(),
        score: Math.round(e.score),
        nights_won: e.nights_won,
        achieved_at: e.achieved_at,
        seed: Math.trunc(e.seed),
      };
      const dedupeKey = `${normalized.name}|${normalized.score}|${normalized.nights_won}|${normalized.achieved_at}|${normalized.seed}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        valid.push(normalized);
      }
    }
  }
  return sortLeaderboardEntries(valid);
}
