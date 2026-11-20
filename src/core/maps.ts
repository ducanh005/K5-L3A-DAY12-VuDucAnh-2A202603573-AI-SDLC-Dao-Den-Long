import type { NightNumber, Vec3Tuple } from './types.js';

export interface JumpPadSpec {
  pos: Vec3Tuple;
  radius: number;
  vy: number;
  vh: number;
  dirXZ: [number, number];
}

export interface NightMapSpec {
  night: NightNumber;
  name: string;
  duration_s: number;
  spawnPos: Vec3Tuple;
  lanterns: Array<{ id: string; pos: Vec3Tuple }>;
  moteSpawnPoints: Vec3Tuple[];
  shadeSpawnPoints: Vec3Tuple[];
  shadeIntervalTicks: number;
  maxShades: number;
  shadeSpeed: number;
  charmPositions: Array<{ id: string; pos: Vec3Tuple }>;
  jumpPads: JumpPadSpec[];
}

function r3(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return v === 0 ? 0 : v;
}

function ringPoints(
  cx: number,
  cz: number,
  y: number,
  radius: number,
  startDeg: number,
  stepDeg: number,
  count: number,
): Vec3Tuple[] {
  const pts: Vec3Tuple[] = [];
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * stepDeg) * Math.PI) / 180;
    pts.push([r3(cx + radius * Math.cos(rad)), y, r3(cz + radius * Math.sin(rad))]);
  }
  return pts;
}

function normXZ(dx: number, dz: number): [number, number] {
  const len = Math.hypot(dx, dz);
  return len > 1e-6 ? [dx / len, dz / len] : [0, 1];
}

const NIGHT1_MAP: NightMapSpec = {
  night: 1,
  name: 'Đêm 1 — Đảo Bến',
  duration_s: 300,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 12, 0, 45, 8),
    ...ringPoints(0, 0, 0, 33, 0, 22.5, 16),
  ],
  shadeSpawnPoints: ringPoints(0, 0, 0, 37, 15, 30, 12),
  shadeIntervalTicks: 480,
  maxShades: 6,
  shadeSpeed: 4.0,
  charmPositions: [],
  jumpPads: [],
};

const NIGHT2_MAP: NightMapSpec = {
  night: 2,
  name: 'Đêm 2 — Đảo Cau',
  duration_s: 330,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 10, 0, 90, 4),
    ...ringPoints(0, 0, 0, 22, 0, 45, 8),
    ...ringPoints(70, 0, 0, 10, 0, 90, 4),
    ...ringPoints(70, 0, 0, 22, 0, 45, 8),
  ],
  shadeSpawnPoints: [
    ...ringPoints(0, 0, 0, 26, 22.5, 45, 8),
    ...ringPoints(70, 0, 0, 26, 22.5, 45, 8),
  ],
  shadeIntervalTicks: 420,
  maxShades: 8,
  shadeSpeed: 4.0,
  charmPositions: [{ id: 'C1', pos: [35, 0, 0] }],
  jumpPads: [
    { pos: [20, 0, 18], radius: 1, vy: 14, vh: 24, dirXZ: normXZ(70 - 20, 0 - 18) },
    { pos: [50, 0, -18], radius: 1, vy: 14, vh: 24, dirXZ: normXZ(0 - 50, 0 - -18) },
  ],
};

const NIGHT3_MAP: NightMapSpec = {
  night: 3,
  name: 'Đêm 3 — Đảo Chuông',
  duration_s: 360,
  spawnPos: [0, 0, 35],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  moteSpawnPoints: [
    ...ringPoints(0, 0, 0, 34, 0, 20, 18),
    ...ringPoints(0, 0, 3, 18, 20, 20, 8),
    ...ringPoints(0, 0, 6, 5, 45, 90, 4),
  ],
  shadeSpawnPoints: ringPoints(0, 0, 0, 43, 0, 22.5, 16),
  shadeIntervalTicks: 360,
  maxShades: 10,
  shadeSpeed: 4.5,
  charmPositions: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  jumpPads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vh: 8, dirXZ: [0, -1] }],
};

export function getMapSpec(night: NightNumber): NightMapSpec {
  if (night === 2) return NIGHT2_MAP;
  if (night === 3) return NIGHT3_MAP;
  return NIGHT1_MAP;
}

const RAMP_ANGLES_RAD = [(30 * Math.PI) / 180, (150 * Math.PI) / 180];

function rampSurfaceY(x: number, z: number): number | null {
  for (const ang of RAMP_ANGLES_RAD) {
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    const proj = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && proj >= 23.9 && proj <= 30) {
      return Math.min(3, Math.max(0, (30 - proj) * 0.5));
    }
  }
  return null;
}

/**
 * Returns all candidate ground heights at (x, z) sorted descending.
 */
export function getCandidateGroundHeights(night: NightNumber, x: number, z: number): number[] {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? [0] : [];
  }
  if (night === 2) {
    const onIslandA = Math.hypot(x, z) <= 28;
    const onIslandB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return onIslandA || onIslandB || onBridge ? [0] : [];
  }

  // Night 3: multi-tier island + ramps + central bell tower (radius 2m at center)
  const r = Math.hypot(x, z);
  if (r > 45) return [];

  const heights: number[] = [];
  if (r >= 2 && r <= 8) {
    heights.push(6);
  }
  if (r >= 12 && r <= 24 && z > 0) {
    heights.push(3);
  }
  const ry = rampSurfaceY(x, z);
  if (ry !== null) {
    heights.push(ry);
  }
  if (r >= 2) {
    heights.push(0);
  }
  heights.sort((a, b) => b - a);
  return heights;
}

/**
 * Finds the highest walkable floor at (x, z) reachable from currentY.
 */
export function getSupportY(night: NightNumber, x: number, z: number, currentY: number): number | null {
  const candidates = getCandidateGroundHeights(night, x, z);
  for (const h of candidates) {
    if (h <= currentY + 0.35) {
      return h;
    }
  }
  return null;
}

/**
 * Checks whether moving horizontally to (nx, nz) at altitude currentY hits a vertical cliff or Bell Tower.
 */
export function isBlockedByObstacle(night: NightNumber, nx: number, nz: number, currentY: number): boolean {
  if (night !== 3) return false;
  const r = Math.hypot(nx, nz);
  // Central Bell Tower column (radius 2m, height 8m on Tier 2)
  if (r < 2.0 && currentY < 14) {
    return true;
  }
  // Vertical cliff of Tier 2 (r <= 8, Y=6)
  if (r <= 8 && currentY < 5.75) {
    return true;
  }
  // Vertical cliff of Tier 1 (r in [12, 24], z > 0, Y=3) unless riding one of the ramps
  if (r >= 12 && r <= 24 && nz > 0 && currentY < 2.75) {
    const ry = rampSurfaceY(nx, nz);
    if (ry === null || ry > currentY + 0.35) {
      return true;
    }
  }
  // Prevent sideways penetration underneath ramp wedge when walking on Tier 0
  const ry = rampSurfaceY(nx, nz);
  if (ry !== null && ry > currentY + 0.35) {
    return true;
  }
  return false;
}
