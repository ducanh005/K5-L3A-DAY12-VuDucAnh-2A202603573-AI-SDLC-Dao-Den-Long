export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  colorblindMode: boolean;
}

const STORAGE_KEY = 'dao-den-long-settings-v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  mouseSensitivity: 1.0,
  colorblindMode: false,
};

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      masterVolume: clamp(parsed.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clamp(parsed.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
      mouseSensitivity: clamp(parsed.mouseSensitivity, 0.2, 2.5, DEFAULT_SETTINGS.mouseSensitivity),
      colorblindMode: typeof parsed.colorblindMode === 'boolean' ? parsed.colorblindMode : false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
