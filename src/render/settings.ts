export interface KeyBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  jump: string;
  dash: string;
  interact: string;
  pulse: string;
  pause: string;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  colorblindMode: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  subtitles: boolean;
  keyBindings: KeyBindings;
}

export const KEY_ACTION_ORDER: Array<keyof KeyBindings> = [
  'moveForward',
  'moveBackward',
  'moveLeft',
  'moveRight',
  'jump',
  'dash',
  'interact',
  'pulse',
  'pause',
];

export const KEY_ACTION_LABELS: Record<keyof KeyBindings, string> = {
  moveForward: 'Đi thẳng',
  moveBackward: 'Đi lùi',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Thắp / Châm dầu',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng',
};

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyX',
  pause: 'Escape',
};

const STORAGE_KEY = 'dao-den-long-settings-v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  mouseSensitivity: 1.0,
  colorblindMode: false,
  reducedMotion: false,
  largeText: false,
  subtitles: true,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

export function cloneDefaultSettings(): GameSettings {
  return {
    ...DEFAULT_SETTINGS,
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
  };
}

/**
 * Returns groups of actions that share the same KeyboardEvent.code binding.
 */
export function findDuplicateKeys(
  kb: KeyBindings,
): Array<{ code: string; actions: Array<keyof KeyBindings> }> {
  const map = new Map<string, Array<keyof KeyBindings>>();
  for (const action of KEY_ACTION_ORDER) {
    const code = kb[action];
    const list = map.get(code) ?? [];
    list.push(action);
    map.set(code, list);
  }
  const duplicates: Array<{ code: string; actions: Array<keyof KeyBindings> }> = [];
  for (const [code, actions] of map.entries()) {
    if (actions.length > 1) {
      duplicates.push({ code, actions });
    }
  }
  return duplicates;
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  switch (code) {
    case 'Space':
      return 'Space';
    case 'ShiftLeft':
      return 'L-Shift';
    case 'ShiftRight':
      return 'R-Shift';
    case 'ControlLeft':
      return 'L-Ctrl';
    case 'ControlRight':
      return 'R-Ctrl';
    case 'Escape':
      return 'Esc';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    default:
      return code;
  }
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return cloneDefaultSettings();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultSettings();
    const parsed = JSON.parse(raw) as Partial<GameSettings> & {
      keyBindings?: Partial<KeyBindings>;
    };
    const kb: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
    if (parsed.keyBindings && typeof parsed.keyBindings === 'object') {
      for (const action of KEY_ACTION_ORDER) {
        const val = parsed.keyBindings[action];
        if (typeof val === 'string' && val.length > 0) {
          kb[action] = val;
        }
      }
    }
    return {
      masterVolume: clamp(parsed.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clamp(parsed.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
      mouseSensitivity: clamp(parsed.mouseSensitivity, 0.2, 2.5, DEFAULT_SETTINGS.mouseSensitivity),
      colorblindMode: typeof parsed.colorblindMode === 'boolean' ? parsed.colorblindMode : false,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : false,
      largeText: typeof parsed.largeText === 'boolean' ? parsed.largeText : false,
      subtitles: typeof parsed.subtitles === 'boolean' ? parsed.subtitles : true,
      keyBindings: kb,
    };
  } catch {
    return cloneDefaultSettings();
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
