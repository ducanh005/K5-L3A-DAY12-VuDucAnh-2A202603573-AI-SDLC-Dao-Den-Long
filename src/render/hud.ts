import type { NightNumber, WorldState } from '../core/types.js';
import type { LeaderboardEntry } from './leaderboard.js';
import { validateLeaderboardName } from './leaderboard.js';
import type { GameScene } from './scene.js';
import {
  cloneDefaultSettings,
  findDuplicateKeys,
  formatKeyCode,
  type GameSettings,
  KEY_ACTION_LABELS,
  KEY_ACTION_ORDER,
  type KeyBindings,
} from './settings.js';

export type ScreenMode =
  | 'menu'
  | 'intro'
  | 'playing'
  | 'paused'
  | 'settings'
  | 'result'
  | 'dawn'
  | 'leaderboard';

export interface HudCallbacks {
  onStartCampaign: () => void;
  onSelectNight: (night: NightNumber) => void;
  onBeginNight: () => void;
  onResume: () => void;
  onRestartNight: () => void;
  onNextNight: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onSaveSettings: (next: GameSettings) => void;
  onReturnMenu: () => void;
  onOpenLeaderboard: () => void;
  onSaveScore: (name: string) => Promise<void>;
  getLeaderboard: () => LeaderboardEntry[];
}

export interface RunSummaryMeta {
  nightsWon: number;
  seed: number;
  highlightedAchievedAt: string | null;
}

const NIGHT_INTRO_COPY: Record<NightNumber, { title: string; quote: string }> = {
  1: {
    title: 'Đêm 1 — Đảo Bến',
    quote:
      'Ông Đăng: "Mây ơi, đèn thắp rồi vẫn hao dầu theo từng giây và sẽ tắt nếu cạn! Hãy giữ ít nhất 3/5 Đèn Lồng Lớn sáng tới bình minh, châm dầu khi đèn yếu và đừng để Bóng Mực hút cạn!"',
  },
  2: {
    title: 'Đêm 2 — Đảo Cau',
    quote:
      'Ông Đăng: "Đêm nay cần giữ ít nhất 4/6 đèn sáng tới bình minh! Bóng Mực sẽ tìm hút dầu các đèn yếu dưới 30%, còn Gió Lạc vẫn rình cướp đom đóm nếu cháu mang từ 5 con trở lên!"',
  },
  3: {
    title: 'Đêm 3 — Đảo Chuông',
    quote:
      'Ông Đăng: "Đêm cuối rồi! Giữ ít nhất 5/7 đèn sáng qua 300 giây gió mạnh để đón Bình Minh. Đèn tắt rồi thắp lại chỉ tốn 5 đom đóm, và sức chứa túi của cháu sẽ tăng thêm sau mỗi lần thắp!"',
  },
};

/**
 * Full Phase 4 accessible HUD (min >= 18px + x1.25 scale, visual subtitles, shade + lantern arrows,
 * reduced motion, key rebinding with duplicate check, and local top-10 leaderboard flow).
 */
export class HudController {
  private readonly root: HTMLDivElement;
  private readonly hudLayer: HTMLDivElement;
  private readonly flamesEl: HTMLDivElement;
  private readonly timerEl: HTMLDivElement;
  private readonly rightStatsEl: HTMLDivElement;
  private readonly fuelStripEl: HTMLDivElement;
  private readonly moteSlotsEl: HTMLDivElement;
  private readonly cooldownsEl: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly arrowEl: HTMLDivElement;
  private readonly shadeArrowEl: HTMLDivElement;
  private readonly modalLayer: HTMLDivElement;

  private currentSettings: GameSettings;
  private settingsDraft: GameSettings;
  private prevScreenMode: ScreenMode | null = null;
  private prevLargeText: boolean;
  private listeningAction: keyof KeyBindings | null = null;
  private lastKnownShadeIds = new Set<string>();
  private lastAlertSimTick = -1;
  private shadeAlertUntilTick = 0;
  private scoreSavedThisRun = false;
  private scoreSaveMessage = '';

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    private readonly callbacks: HudCallbacks,
  ) {
    this.currentSettings = {
      ...initialSettings,
      keyBindings: { ...initialSettings.keyBindings },
    };
    this.settingsDraft = {
      ...initialSettings,
      keyBindings: { ...initialSettings.keyBindings },
    };
    this.prevLargeText = initialSettings.largeText;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;color:#F5F1E6;font-size:18px;';

    this.hudLayer = document.createElement('div');
    this.hudLayer.style.cssText =
      'position:absolute;inset:0;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    this.flamesEl = document.createElement('div');
    this.flamesEl.style.cssText =
      'background:rgba(14,20,48,0.86);border:1px solid #F2C14E;border-radius:10px;padding:8px 14px;font-size:18px;';

    const centerCol = document.createElement('div');
    centerCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;max-width:46%;';

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText =
      'background:rgba(14,20,48,0.86);border:1px solid rgba(242,193,78,0.65);border-radius:10px;padding:6px 18px;font-size:24px;font-weight:700;letter-spacing:1px;';

    this.fuelStripEl = document.createElement('div');
    this.fuelStripEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;';

    centerCol.append(this.timerEl, this.fuelStripEl);

    this.rightStatsEl = document.createElement('div');
    this.rightStatsEl.style.cssText =
      'background:rgba(14,20,48,0.86);border:1px solid #F2C14E;border-radius:10px;padding:8px 14px;font-size:18px;text-align:right;';

    topRow.append(this.flamesEl, centerCol, this.rightStatsEl);

    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;';

    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText =
      'background:rgba(14,20,48,0.92);border:1px solid #FFB347;border-radius:10px;padding:6px 16px;font-size:18px;color:#FFE9B0;display:none;text-align:center;max-width:85%;';

    this.promptEl = document.createElement('div');
    this.promptEl.style.cssText =
      'background:rgba(14,20,48,0.92);border:1px solid #F2C14E;border-radius:10px;padding:8px 16px;font-size:18px;color:#FFE9B0;display:none;text-align:center;';

    const barRow = document.createElement('div');
    barRow.style.cssText =
      'width:100%;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;';

    this.moteSlotsEl = document.createElement('div');
    this.moteSlotsEl.style.cssText =
      'display:flex;gap:5px;flex-wrap:wrap;max-width:560px;justify-content:center;align-items:center;background:rgba(14,20,48,0.86);border:1px solid rgba(242,193,78,0.55);border-radius:12px;padding:8px 12px;font-size:18px;';

    this.cooldownsEl = document.createElement('div');
    this.cooldownsEl.style.cssText =
      'display:flex;gap:8px;flex-wrap:wrap;background:rgba(14,20,48,0.86);border:1px solid rgba(242,193,78,0.55);border-radius:12px;padding:8px 12px;font-size:18px;';

    barRow.append(this.moteSlotsEl, this.cooldownsEl);
    bottomRow.append(this.subtitleEl, this.promptEl, barRow);

    this.hudLayer.append(topRow, bottomRow);

    this.arrowEl = document.createElement('div');
    this.arrowEl.style.cssText =
      'position:fixed;padding:4px 10px;border-radius:999px;background:rgba(14,20,48,0.9);border:2px solid #F2C14E;color:#FFB347;display:none;align-items:center;justify-content:center;font-size:18px;font-weight:700;transform:translate(-50%,-50%);white-space:nowrap;';
    this.arrowEl.textContent = '➤';

    this.shadeArrowEl = document.createElement('div');
    this.shadeArrowEl.style.cssText =
      'position:fixed;padding:4px 10px;border-radius:999px;background:rgba(18,10,26,0.92);border:2px solid #7A3CFF;color:#FFFFFF;display:none;align-items:center;justify-content:center;font-size:18px;font-weight:700;transform:translate(-50%,-50%);white-space:nowrap;';
    this.shadeArrowEl.textContent = '➤ Bóng Mực';

    this.modalLayer = document.createElement('div');
    this.modalLayer.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(14,20,48,0.8);backdrop-filter:blur(6px);pointer-events:auto;';

    this.root.append(this.hudLayer, this.arrowEl, this.shadeArrowEl, this.modalLayer);
    container.appendChild(this.root);

    window.addEventListener('keydown', this.handleCaptureKeydown, { capture: true });
  }

  private handleCaptureKeydown = (e: KeyboardEvent): void => {
    if (!this.listeningAction) return;
    e.preventDefault();
    e.stopPropagation();
    this.settingsDraft.keyBindings[this.listeningAction] = e.code;
    this.listeningAction = null;
    if (this.lastModalWorld && this.lastModalMeta) {
      this.renderModal('settings', this.lastModalWorld, this.lastTotalScore, this.lastModalMeta);
    }
  };

  private lastModalWorld: WorldState | null = null;
  private lastTotalScore = 0;
  private lastModalMeta: RunSummaryMeta | null = null;

  isTextInputOrRebindFocused(): boolean {
    if (this.listeningAction !== null) return true;
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  resetRunSaveState(): void {
    this.scoreSavedThisRun = false;
    this.scoreSaveMessage = '';
    this.lastKnownShadeIds.clear();
    this.lastAlertSimTick = -1;
    this.shadeAlertUntilTick = 0;
  }

  private fpx(basePx: number): string {
    const mult = this.currentSettings.largeText ? 1.25 : 1;
    const val = Math.round(Math.max(18, basePx) * mult * 10) / 10;
    return `${val}px`;
  }

  update(
    mode: ScreenMode,
    world: WorldState,
    scene: GameScene,
    totalCampaignScore: number,
    settings: GameSettings,
    muted: boolean,
    runMeta: RunSummaryMeta,
  ): void {
    this.currentSettings = settings;
    this.lastModalWorld = world;
    this.lastTotalScore = totalCampaignScore;
    this.lastModalMeta = runMeta;

    if (settings.largeText !== this.prevLargeText) {
      this.prevLargeText = settings.largeText;
      if (mode !== 'playing') {
        this.renderModal(mode, world, totalCampaignScore, runMeta);
      }
    }

    const showHud = mode === 'playing' || mode === 'paused';
    this.hudLayer.style.display = showHud ? 'flex' : 'none';
    const warnColor = settings.colorblindMode ? '#FFFFFF' : '#FF5A5F';
    const warnPrefix = settings.colorblindMode ? '⚠ ' : '';

    if (showHud) {
      this.flamesEl.style.fontSize = this.fpx(18);
      this.timerEl.style.fontSize = this.fpx(24);
      this.rightStatsEl.style.fontSize = this.fpx(18);
      this.moteSlotsEl.style.fontSize = this.fpx(18);
      this.cooldownsEl.style.fontSize = this.fpx(18);
      this.promptEl.style.fontSize = this.fpx(19);
      this.subtitleEl.style.fontSize = this.fpx(18);

      // Track newly spawned shades for visual alert + directional edge arrow
      if (world.sim_tick < this.lastAlertSimTick) {
        this.lastKnownShadeIds.clear();
        this.shadeAlertUntilTick = 0;
      }
      this.lastAlertSimTick = world.sim_tick;
      const spawnedEvent = world.last_events.some((ev) => ev.name === 'shade_spawned');
      let newShadeAppeared = false;
      for (const s of world.shades) {
        if (!this.lastKnownShadeIds.has(s.id)) {
          this.lastKnownShadeIds.add(s.id);
          if (world.sim_tick > 1) newShadeAppeared = true;
        }
      }
      if (spawnedEvent || newShadeAppeared) {
        this.shadeAlertUntilTick = world.sim_tick + 210;
      }

      const flameIcons = Array.from({ length: world.tuning.flames }, (_, i) =>
        i < world.player.flames
          ? '<span style="color:#FFB347">🔥</span>'
          : '<span style="color:#5B5F6E">○</span>',
      ).join(' ');
      const charmBadge =
        world.player.charm_ticks > 0
          ? `<div style="color:#F2C14E;font-size:${this.fpx(18)};margin-top:2px;">Bùa Gió: ${(world.player.charm_ticks / 60).toFixed(1)}s</div>`
          : '';
      const windBadge = world.wind.active
        ? `<div style="color:#8FA3B8;font-size:${this.fpx(18)};margin-top:2px;">Gió (${Math.round(world.wind.dir_deg)}°)</div>`
        : world.wind.warning
          ? `<div style="color:${warnColor};font-size:${this.fpx(18)};margin-top:2px;">${warnPrefix}Gió sắp thổi!</div>`
          : '';
      this.flamesEl.innerHTML = `<div>Ngọn Lửa: ${flameIcons}</div>${charmBadge}${windBadge}`;

      const totalSec = Math.ceil(world.time_left_s);
      const mins = Math.floor(totalSec / 60)
        .toString()
        .padStart(2, '0');
      const secs = (totalSec % 60).toString().padStart(2, '0');
      const urgent = world.time_left_s <= 10;
      const blinkHide = !settings.reducedMotion && urgent && Math.floor(world.tick / 15) % 2 === 1;
      this.timerEl.style.color = urgent ? warnColor : '#F5F1E6';
      this.timerEl.style.opacity = blinkHide ? '0.5' : '1';
      this.timerEl.textContent = `${urgent ? warnPrefix : ''}${mins}:${secs}`;

      const litCount = world.lanterns.filter((l) => l.lit).length;
      const requiredLit = Math.ceil(world.tuning.win_ratio * world.lanterns.length);
      const drainingIds = new Set(
        world.shades
          .filter((s) => s.state === 'drain' && s.target_lantern_id)
          .map((s) => s.target_lantern_id as string),
      );
      const blink1Hz = settings.reducedMotion ? true : Math.sin((world.tick / 60) * Math.PI * 2) >= 0;

      // Per-lantern fuel pills (font >= 18px)
      const lowFuelTicks = world.tuning.low_fuel_threshold * 60;
      const lowLanternIds: string[] = [];
      this.fuelStripEl.innerHTML = world.lanterns
        .map((l) => {
          const isLow = l.lit && l.fuel_ticks < lowFuelTicks;
          if (isLow) lowLanternIds.push(l.id);
          const fuel =
            isLow && l.fuel_ticks > 0 ? Math.min(29, Math.round(l.fuel_ticks / 60)) : Math.round(l.fuel_ticks / 60);
          const isDrained = drainingIds.has(l.id);
          const border = l.lit ? (isLow || isDrained ? warnColor : '#FFB347') : '#5B5F6E';
          const opacity = isLow && !blink1Hz ? '0.55' : '1';
          const text = l.lit ? `${l.id}: ${isLow || isDrained ? warnPrefix : ''}${fuel}%` : `${l.id}: Tắt`;
          return `<div style="background:rgba(14,20,48,0.86);border:1px solid ${border};border-radius:6px;padding:2px 8px;font-size:${this.fpx(18)};color:${isLow || isDrained ? warnColor : l.lit ? '#FFE9B0' : '#8FA3B8'};opacity:${opacity};">${text}</div>`;
        })
        .join('');

      const litColor = litCount >= requiredLit ? '#8ce99a' : warnColor;
      this.rightStatsEl.innerHTML = `<div>Đêm ${world.night}/3 · Sáng: <strong style="color:${litColor}">${litCount}/${world.lanterns.length}</strong> (≥${requiredLit})</div><div style="color:#F2C14E;font-weight:700;">Điểm: ${world.score}</div>`;

      // Dynamic capacity slots (10 -> max 20) + label (>= 18px)
      const slotsHtml = Array.from({ length: world.player.capacity }, (_, i) => {
        const filled = i < world.player.carried;
        return `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #F2C14E;background:${filled ? '#FFF6C2' : 'rgba(27,35,80,0.6)'};box-shadow:${filled ? '0 0 6px #FFE58A' : 'none'};"></div>`;
      }).join('');
      this.moteSlotsEl.innerHTML = `<span style="font-size:${this.fpx(18)};color:#FFE9B0;margin-right:4px;">${world.player.carried}/${world.player.capacity}</span>${slotsHtml}`;

      const dashReady = world.player.dash_cd_ticks === 0 || world.player.charm_ticks > 0;
      const pulseReady = world.player.carried >= world.tuning.pulse_cost && world.player.pulse_cd_ticks === 0;
      const dashKey = formatKeyCode(settings.keyBindings.dash);
      const pulseKey = formatKeyCode(settings.keyBindings.pulse);
      this.cooldownsEl.innerHTML = [
        `<div style="padding:3px 8px;border-radius:6px;border:1px solid ${dashReady ? '#F2C14E' : '#5B5F6E'};color:${dashReady ? '#FFE9B0' : '#8FA3B8'};font-size:${this.fpx(18)};">Lướt [${dashKey}]: ${dashReady ? 'Sẵn' : `${(world.player.dash_cd_ticks / 60).toFixed(1)}s`}</div>`,
        `<div style="padding:3px 8px;border-radius:6px;border:1px solid ${pulseReady ? '#FFB347' : '#5B5F6E'};color:${pulseReady ? '#FFE9B0' : '#8FA3B8'};font-size:${this.fpx(18)};">Tỏa [${pulseKey}]: ${world.player.pulse_cd_ticks > 0 ? `${(world.player.pulse_cd_ticks / 60).toFixed(1)}s` : world.player.carried >= 3 ? 'Sẵn' : `${world.player.carried}/3`}</div>`,
        `<div style="padding:3px 6px;color:#8FA3B8;font-size:${this.fpx(18)};">Âm [M]: ${muted ? 'Tắt' : 'Bật'}</div>`,
      ].join('');

      // Accessible Visual Subtitles: Bóng Mực xuất hiện, Gió sắp thổi, 10s cuối, Đèn < 30
      if (settings.subtitles && mode === 'playing') {
        const subMsgs: string[] = [];
        const hasChasingOrNewShade =
          world.sim_tick <= this.shadeAlertUntilTick ||
          world.shades.some((s) => s.state === 'chase' || s.state === 'spawning');
        if (hasChasingOrNewShade) {
          subMsgs.push(`${warnPrefix}Bóng Mực xuất hiện gần đây!`);
        }
        if (world.wind.warning) {
          subMsgs.push(`${warnPrefix}Gió mạnh sắp thổi (${Math.round(world.wind.dir_deg)}°)!`);
        } else if (world.wind.active) {
          subMsgs.push(`🌬 Gió mạnh đang thổi (${Math.round(world.wind.dir_deg)}°)!`);
        }
        if (world.time_left_s > 0 && world.time_left_s <= 10) {
          subMsgs.push(`⏱ 10 giây cuối (${Math.ceil(world.time_left_s)}s)!`);
        }
        if (lowLanternIds.length > 0) {
          subMsgs.push(`${warnPrefix}Đèn yếu (<30%): ${lowLanternIds.join(', ')}`);
        }
        if (subMsgs.length > 0) {
          this.subtitleEl.style.display = 'block';
          this.subtitleEl.style.color = warnColor === '#FFFFFF' ? '#FFFFFF' : '#FFE9B0';
          this.subtitleEl.style.borderColor = lowLanternIds.length > 0 || world.time_left_s <= 10 ? warnColor : '#FFB347';
          this.subtitleEl.textContent = subMsgs.join(' · ');
        } else {
          this.subtitleEl.style.display = 'none';
        }
      } else {
        this.subtitleEl.style.display = 'none';
      }

      // Context prompt: deposit or refuel
      const interactKey = formatKeyCode(settings.keyBindings.interact);
      const nearby = world.lanterns
        .filter(
          (l) =>
            (!l.lit || l.fuel_ticks < world.tuning.fuel_max * 60) &&
            Math.hypot(world.player.pos[0] - l.pos[0], world.player.pos[2] - l.pos[2]) <=
              world.tuning.interact_radius &&
            Math.abs(world.player.pos[1] - l.pos[1]) <= 2.0,
        )
        .sort((a, b) => {
          const da = Math.hypot(world.player.pos[0] - a.pos[0], world.player.pos[2] - a.pos[2]);
          const db = Math.hypot(world.player.pos[0] - b.pos[0], world.player.pos[2] - b.pos[2]);
          if (Math.abs(da - db) > 1e-6) return da - db;
          return a.id.localeCompare(b.id);
        })[0];

      if (nearby) {
        this.promptEl.style.display = 'block';
        if (!nearby.lit) {
          const req = nearby.ever_lit ? world.tuning.relight_cost : world.tuning.lantern_cost;
          this.promptEl.textContent = `${interactKey} — ${nearby.ever_lit ? 'Thắp lại' : 'Nạp ánh sáng'} ${nearby.id} (${nearby.deposited}/${req})`;
        } else {
          this.promptEl.textContent = `${interactKey} — Châm dầu ${nearby.id} (${Math.round(nearby.fuel_ticks / 60)}%)`;
        }
      } else if (world.player.carried >= world.player.capacity) {
        this.promptEl.style.display = 'block';
        this.promptEl.textContent = `Túi đầy (${world.player.carried}/${world.player.capacity})! Hãy thắp hoặc châm dầu đèn.`;
      } else {
        this.promptEl.style.display = 'none';
      }

      // Offscreen arrow 1: priority lantern (drained/low-fuel or unlit)
      const priorityTargets = world.lanterns
        .filter((l) => !l.lit || l.fuel_ticks < lowFuelTicks || drainingIds.has(l.id))
        .sort(
          (a, b) =>
            Math.hypot(a.pos[0] - world.player.pos[0], a.pos[2] - world.player.pos[2]) -
            Math.hypot(b.pos[0] - world.player.pos[0], b.pos[2] - world.player.pos[2]),
        );

      if (priorityTargets.length > 0 && mode === 'playing') {
        const target = priorityTargets[0];
        const proj = scene.projectToScreen(target.pos);
        if (!proj.onScreen) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const ang = Math.atan2(proj.y - h / 2, proj.x - w / 2);
          const ax = Math.max(70, Math.min(w - 70, proj.x));
          const ay = Math.max(96, Math.min(h - 96, proj.y));
          const isDanger = drainingIds.has(target.id) || (target.lit && target.fuel_ticks < lowFuelTicks);
          this.arrowEl.style.display = 'flex';
          this.arrowEl.style.fontSize = this.fpx(18);
          this.arrowEl.style.borderColor = isDanger ? warnColor : '#F2C14E';
          this.arrowEl.style.color = isDanger ? warnColor : '#FFB347';
          this.arrowEl.innerHTML = `<span style="margin-right:4px;">${target.id}</span><span style="display:inline-block;transform:rotate(${ang}rad)">➤</span>`;
          this.arrowEl.style.left = `${ax}px`;
          this.arrowEl.style.top = `${ay}px`;
          this.arrowEl.style.transform = 'translate(-50%,-50%)';
        } else {
          this.arrowEl.style.display = 'none';
        }
      } else {
        this.arrowEl.style.display = 'none';
      }

      // Offscreen arrow 2: Bóng Mực indicator at screen edge
      const activeShades = [...world.shades]
        .filter((s) => s.state !== 'stunned')
        .sort(
          (a, b) =>
            Math.hypot(a.pos[0] - world.player.pos[0], a.pos[2] - world.player.pos[2]) -
            Math.hypot(b.pos[0] - world.player.pos[0], b.pos[2] - world.player.pos[2]),
        );
      if (activeShades.length > 0 && mode === 'playing') {
        const nearestShade = activeShades[0];
        const dist = Math.hypot(
          nearestShade.pos[0] - world.player.pos[0],
          nearestShade.pos[2] - world.player.pos[2],
        );
        const sProj = scene.projectToScreen(nearestShade.pos);
        if (!sProj.onScreen && (world.sim_tick <= this.shadeAlertUntilTick || dist <= 20)) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const ang = Math.atan2(sProj.y - h / 2, sProj.x - w / 2);
          const ax = Math.max(85, Math.min(w - 85, sProj.x));
          let ay = Math.max(100, Math.min(h - 100, sProj.y));
          if (this.arrowEl.style.display === 'flex') {
            const lanternAx = Number.parseFloat(this.arrowEl.style.left) || 0;
            const lanternAy = Number.parseFloat(this.arrowEl.style.top) || 0;
            if (Math.hypot(ax - lanternAx, ay - lanternAy) < 60) {
              ay = ay > h / 2 ? Math.max(100, ay - 46) : Math.min(h - 100, ay + 46);
            }
          }
          this.shadeArrowEl.style.display = 'flex';
          this.shadeArrowEl.style.fontSize = this.fpx(18);
          this.shadeArrowEl.style.borderColor = settings.colorblindMode ? '#00B3FF' : '#7A3CFF';
          this.shadeArrowEl.style.color = '#FFFFFF';
          this.shadeArrowEl.innerHTML = `<span style="margin-right:4px;">${warnPrefix}Bóng Mực</span><span style="display:inline-block;transform:rotate(${ang}rad)">➤</span>`;
          this.shadeArrowEl.style.left = `${ax}px`;
          this.shadeArrowEl.style.top = `${ay}px`;
        } else {
          this.shadeArrowEl.style.display = 'none';
        }
      } else {
        this.shadeArrowEl.style.display = 'none';
      }
    } else {
      this.arrowEl.style.display = 'none';
      this.shadeArrowEl.style.display = 'none';
    }

    if (mode !== this.prevScreenMode) {
      if (mode === 'settings') {
        this.listeningAction = null;
        this.settingsDraft = {
          ...settings,
          keyBindings: { ...settings.keyBindings },
        };
      }
      this.renderModal(mode, world, totalCampaignScore, runMeta);
      this.prevScreenMode = mode;
    }
  }

  private renderModal(
    mode: ScreenMode,
    world: WorldState,
    totalCampaignScore: number,
    runMeta: RunSummaryMeta,
  ): void {
    if (mode === 'playing') {
      this.modalLayer.style.display = 'none';
      this.modalLayer.innerHTML = '';
      return;
    }

    this.modalLayer.style.display = 'flex';
    const cardStyle =
      `background:#0E1430;border:2px solid #F2C14E;border-radius:16px;padding:24px 28px;max-width:720px;width:92%;max-height:90vh;overflow-y:auto;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.65);font-size:${this.fpx(18)};`;
    const btnPrimary =
      `background:#FFB347;color:#0E1430;border:none;border-radius:8px;padding:10px 20px;font-weight:700;font-size:${this.fpx(18)};cursor:pointer;margin:6px;`;
    const btnSecondary =
      `background:#1B2350;color:#F5F1E6;border:1px solid #F2C14E;border-radius:8px;padding:10px 18px;font-weight:600;font-size:${this.fpx(18)};cursor:pointer;margin:6px;`;

    if (mode === 'menu') {
      const kb = this.currentSettings.keyBindings;
      const moveDesc = `${formatKeyCode(kb.moveForward)}/${formatKeyCode(kb.moveLeft)}/${formatKeyCode(kb.moveBackward)}/${formatKeyCode(kb.moveRight)}`;
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h1 style="color:#F2C14E;font-size:${this.fpx(32)};margin:0 0 8px 0;">ĐẢO ĐÈN LỒNG</h1>
        <p style="color:#E8E2D0;font-size:${this.fpx(18)};margin:0 0 18px 0;">Đèn cạn dầu — Giữ ánh đèn sáng qua ba đêm sương mù tới bình minh.</p>
        <div><button id="btn-start-campaign" style="${btnPrimary}">Bắt đầu hành trình (Đêm 1 → 3)</button></div>
        <div style="margin-top:8px;">
          <button id="btn-night-1" style="${btnSecondary}">Đêm 1: Đảo Bến</button>
          <button id="btn-night-2" style="${btnSecondary}">Đêm 2: Đảo Cau</button>
          <button id="btn-night-3" style="${btnSecondary}">Đêm 3: Đảo Chuông</button>
        </div>
        <div style="margin-top:8px;">
          <button id="btn-open-leaderboard" style="${btnSecondary}">Bảng xếp hạng</button>
          <button id="btn-open-settings" style="${btnSecondary}">Cài đặt & Tiếp cận</button>
        </div>
        <p style="color:#8FA3B8;font-size:${this.fpx(18)};margin:16px 0 0 0;line-height:1.45;">
          ${moveDesc}: Đi · ${formatKeyCode(kb.jump)}: Nhảy · ${formatKeyCode(kb.dash)}: Lướt · ${formatKeyCode(kb.interact)}: Thắp/Châm · ${formatKeyCode(kb.pulse)}: Tỏa Sáng · ${formatKeyCode(kb.pause)}: Tạm dừng
        </p>
      </div>`;
      this.modalLayer.querySelector('#btn-start-campaign')?.addEventListener('click', () => this.callbacks.onStartCampaign());
      this.modalLayer.querySelector('#btn-night-1')?.addEventListener('click', () => this.callbacks.onSelectNight(1));
      this.modalLayer.querySelector('#btn-night-2')?.addEventListener('click', () => this.callbacks.onSelectNight(2));
      this.modalLayer.querySelector('#btn-night-3')?.addEventListener('click', () => this.callbacks.onSelectNight(3));
      this.modalLayer.querySelector('#btn-open-leaderboard')?.addEventListener('click', () => this.callbacks.onOpenLeaderboard());
      this.modalLayer.querySelector('#btn-open-settings')?.addEventListener('click', () => this.callbacks.onOpenSettings());
    } else if (mode === 'intro') {
      const copy = NIGHT_INTRO_COPY[world.night];
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;font-size:${this.fpx(26)};margin:0 0 12px 0;">${copy.title}</h2>
        <p style="color:#F5F1E6;font-size:${this.fpx(19)};line-height:1.6;margin:0 0 22px 0;">${copy.quote}</p>
        <button id="btn-begin-night" style="${btnPrimary}">Bắt đầu thắp đèn</button>
      </div>`;
      this.modalLayer.querySelector('#btn-begin-night')?.addEventListener('click', () => this.callbacks.onBeginNight());
    } else if (mode === 'paused') {
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;font-size:${this.fpx(26)};margin:0 0 16px 0;">Tạm dừng</h2>
        <div>
          <button id="btn-resume" style="${btnPrimary}">Tiếp tục</button>
          <button id="btn-restart" style="${btnSecondary}">Chơi lại Đêm</button>
          <button id="btn-settings" style="${btnSecondary}">Cài đặt</button>
          <button id="btn-menu" style="${btnSecondary}">Về Menu</button>
        </div>
      </div>`;
      this.modalLayer.querySelector('#btn-resume')?.addEventListener('click', () => this.callbacks.onResume());
      this.modalLayer.querySelector('#btn-restart')?.addEventListener('click', () => this.callbacks.onRestartNight());
      this.modalLayer.querySelector('#btn-settings')?.addEventListener('click', () => this.callbacks.onOpenSettings());
      this.modalLayer.querySelector('#btn-menu')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    } else if (mode === 'settings') {
      const duplicates = findDuplicateKeys(this.settingsDraft.keyBindings);
      const dupHtml =
        duplicates.length > 0
          ? `<div id="keybind-warning" style="background:rgba(255,90,95,0.2);border:1px solid #FF5A5F;border-radius:8px;padding:8px 12px;margin:10px 0;color:#FFFFFF;font-size:${this.fpx(18)};">⚠ Trùng phím: ${duplicates.map((d) => `${formatKeyCode(d.code)} (${d.actions.map((a) => KEY_ACTION_LABELS[a]).join(', ')})`).join(' · ')}. Vui lòng chọn phím khác!</div>`
          : '';

      const keyRowsHtml = KEY_ACTION_ORDER.map((action) => {
        const isListening = this.listeningAction === action;
        const codeLabel = isListening ? 'Nhấn phím mới...' : formatKeyCode(this.settingsDraft.keyBindings[action]);
        const activeBorder = isListening ? '#FFB347' : '#F2C14E';
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
          <span style="font-size:${this.fpx(18)};">${KEY_ACTION_LABELS[action]}</span>
          <button class="btn-rebind" data-action="${action}" style="background:${isListening ? '#FFB347' : '#1B2350'};color:${isListening ? '#0E1430' : '#F5F1E6'};border:1px solid ${activeBorder};border-radius:6px;padding:4px 12px;font-size:${this.fpx(18)};font-weight:600;cursor:pointer;min-width:130px;">${codeLabel}</button>
        </div>`;
      }).join('');

      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;font-size:${this.fpx(26)};margin:0 0 12px 0;">Cài đặt & Tiếp cận</h2>
        <div style="text-align:left;font-size:${this.fpx(18)};line-height:1.7;">
          <label>Âm lượng tổng: <span id="val-master">${Math.round(this.settingsDraft.masterVolume * 100)}%</span><br/>
          <input id="inp-master" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.masterVolume}" style="width:100%"/></label>
          <label>Nhạc nền: <span id="val-music">${Math.round(this.settingsDraft.musicVolume * 100)}%</span><br/>
          <input id="inp-music" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.musicVolume}" style="width:100%"/></label>
          <label>Hiệu ứng (SFX): <span id="val-sfx">${Math.round(this.settingsDraft.sfxVolume * 100)}%</span><br/>
          <input id="inp-sfx" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.sfxVolume}" style="width:100%"/></label>
          <label>Độ nhạy chuột: <span id="val-sens">${this.settingsDraft.mouseSensitivity.toFixed(1)}x</span><br/>
          <input id="inp-sens" type="range" min="0.2" max="2.5" step="0.1" value="${this.settingsDraft.mouseSensitivity}" style="width:100%"/></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:${this.fpx(18)};">
              <input id="inp-colorblind" type="checkbox" ${this.settingsDraft.colorblindMode ? 'checked' : ''} />
              <span>Bảng màu dễ phân biệt</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:${this.fpx(18)};">
              <input id="inp-reduced-motion" type="checkbox" ${this.settingsDraft.reducedMotion ? 'checked' : ''} />
              <span>Giảm chuyển động</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:${this.fpx(18)};">
              <input id="inp-large-text" type="checkbox" ${this.settingsDraft.largeText ? 'checked' : ''} />
              <span>Chữ lớn (×1.25)</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:${this.fpx(18)};">
              <input id="inp-subtitles" type="checkbox" ${this.settingsDraft.subtitles ? 'checked' : ''} />
              <span>Phụ đề sự kiện</span>
            </label>
          </div>
          <div style="margin-top:12px;border-top:1px solid rgba(242,193,78,0.35);padding-top:10px;">
            <div style="color:#F2C14E;font-weight:700;margin-bottom:4px;font-size:${this.fpx(18)};">Tùy chỉnh phím điều khiển</div>
            ${dupHtml}
            ${keyRowsHtml}
          </div>
        </div>
        <div style="margin-top:14px;">
          <button id="btn-apply-settings" style="${btnPrimary}${duplicates.length > 0 ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${duplicates.length > 0 ? 'disabled' : ''}>Áp dụng</button>
          <button id="btn-reset-defaults" style="${btnSecondary}">Khôi phục mặc định</button>
          <button id="btn-back-settings" style="${btnSecondary}">Quay lại</button>
        </div>
      </div>`;

      const bindSlider = (id: string, valId: string, onChange: (n: number) => string) => {
        const inp = this.modalLayer.querySelector(id) as HTMLInputElement | null;
        const val = this.modalLayer.querySelector(valId);
        inp?.addEventListener('input', () => {
          if (val) val.textContent = onChange(Number(inp.value));
        });
      };
      bindSlider('#inp-master', '#val-master', (n) => {
        this.settingsDraft.masterVolume = n;
        return `${Math.round(n * 100)}%`;
      });
      bindSlider('#inp-music', '#val-music', (n) => {
        this.settingsDraft.musicVolume = n;
        return `${Math.round(n * 100)}%`;
      });
      bindSlider('#inp-sfx', '#val-sfx', (n) => {
        this.settingsDraft.sfxVolume = n;
        return `${Math.round(n * 100)}%`;
      });
      bindSlider('#inp-sens', '#val-sens', (n) => {
        this.settingsDraft.mouseSensitivity = n;
        return `${n.toFixed(1)}x`;
      });

      const bindCheckbox = (id: string, setter: (v: boolean) => void) => {
        const inp = this.modalLayer.querySelector(id) as HTMLInputElement | null;
        inp?.addEventListener('change', () => setter(inp.checked));
      };
      bindCheckbox('#inp-colorblind', (v) => {
        this.settingsDraft.colorblindMode = v;
      });
      bindCheckbox('#inp-reduced-motion', (v) => {
        this.settingsDraft.reducedMotion = v;
      });
      bindCheckbox('#inp-large-text', (v) => {
        this.settingsDraft.largeText = v;
      });
      bindCheckbox('#inp-subtitles', (v) => {
        this.settingsDraft.subtitles = v;
      });

      this.modalLayer.querySelectorAll('.btn-rebind').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = (btn as HTMLElement).dataset.action as keyof KeyBindings | undefined;
          if (action) {
            this.listeningAction = action;
            this.renderModal('settings', world, totalCampaignScore, runMeta);
          }
        });
      });

      this.modalLayer.querySelector('#btn-reset-defaults')?.addEventListener('click', () => {
        this.listeningAction = null;
        this.settingsDraft = cloneDefaultSettings();
        this.renderModal('settings', world, totalCampaignScore, runMeta);
      });

      this.modalLayer.querySelector('#btn-apply-settings')?.addEventListener('click', () => {
        if (findDuplicateKeys(this.settingsDraft.keyBindings).length > 0) return;
        this.listeningAction = null;
        this.callbacks.onSaveSettings({
          ...this.settingsDraft,
          keyBindings: { ...this.settingsDraft.keyBindings },
        });
      });
      this.modalLayer.querySelector('#btn-back-settings')?.addEventListener('click', () => {
        this.listeningAction = null;
        this.callbacks.onCloseSettings();
      });
    } else if (mode === 'result') {
      const won = world.state === 'won';
      const saveSection = !won
        ? this.buildLeaderboardFormHtml(totalCampaignScore, runMeta.nightsWon)
        : '';
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:${won ? '#F2C14E' : '#FF5A5F'};font-size:${this.fpx(26)};margin:0 0 10px 0;">${won ? `Đón Bình Minh Đêm ${world.night}!` : `Thất bại ở Đêm ${world.night}`}</h2>
        <p style="font-size:${this.fpx(18)};margin:0 0 14px 0;">Điểm Đêm ${world.night}: <strong style="color:#F2C14E">${world.score}</strong> · Tổng điểm Đêm thắng: <strong>${totalCampaignScore}</strong> (${runMeta.nightsWon}/3 Đêm)</p>
        ${saveSection}
        <div>
          ${won && world.night < 3 ? `<button id="btn-next-night" style="${btnPrimary}">Sang Đêm ${world.night + 1}</button>` : ''}
          <button id="btn-retry-night" style="${won ? btnSecondary : btnPrimary}">Chơi lại Đêm ${world.night}</button>
          ${!won ? `<button id="btn-view-lb" style="${btnSecondary}">Bảng xếp hạng</button>` : ''}
          <button id="btn-menu-res" style="${btnSecondary}">Về Menu</button>
        </div>
      </div>`;
      if (!won) {
        this.bindLeaderboardForm(world, totalCampaignScore, runMeta);
      }
      this.modalLayer.querySelector('#btn-next-night')?.addEventListener('click', () => this.callbacks.onNextNight());
      this.modalLayer.querySelector('#btn-retry-night')?.addEventListener('click', () => this.callbacks.onRestartNight());
      this.modalLayer.querySelector('#btn-view-lb')?.addEventListener('click', () => this.callbacks.onOpenLeaderboard());
      this.modalLayer.querySelector('#btn-menu-res')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    } else if (mode === 'dawn') {
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h1 style="color:#FFE9B0;font-size:${this.fpx(28)};margin:0 0 10px 0;">BÌNH MINH TRÊN BA HÒN ĐẢO</h1>
        <p style="color:#F5F1E6;font-size:${this.fpx(18)};line-height:1.55;margin:0 0 12px 0;">Mây đã giữ ánh sáng qua ba đêm sương mù trên Đảo Bến, Đảo Cau và Đảo Chuông! Bình minh đã rạng ngời.</p>
        <p style="font-size:${this.fpx(20)};color:#F2C14E;font-weight:700;margin:0 0 14px 0;">Tổng điểm Đêm thắng: ${totalCampaignScore} (${runMeta.nightsWon}/3 Đêm)</p>
        ${this.buildLeaderboardFormHtml(totalCampaignScore, runMeta.nightsWon)}
        <div>
          <button id="btn-dawn-lb" style="${btnSecondary}">Bảng xếp hạng</button>
          <button id="btn-dawn-replay" style="${btnPrimary}">Chơi lại từ Đêm 1</button>
          <button id="btn-dawn-menu" style="${btnSecondary}">Về Menu</button>
        </div>
      </div>`;
      this.bindLeaderboardForm(world, totalCampaignScore, runMeta);
      this.modalLayer.querySelector('#btn-dawn-lb')?.addEventListener('click', () => this.callbacks.onOpenLeaderboard());
      this.modalLayer.querySelector('#btn-dawn-replay')?.addEventListener('click', () => this.callbacks.onStartCampaign());
      this.modalLayer.querySelector('#btn-dawn-menu')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    } else if (mode === 'leaderboard') {
      const entries = this.callbacks.getLeaderboard();
      const rowsHtml =
        entries.length > 0
          ? entries
              .map((entry, idx) => {
                const isNew = runMeta.highlightedAchievedAt && entry.achieved_at === runMeta.highlightedAchievedAt;
                const bg = isNew ? 'background:rgba(242,193,78,0.22);font-weight:700;' : '';
                const dtText = entry.achieved_at.slice(0, 16).replace('T', ' ');
                return `<tr style="${bg}border-bottom:1px solid rgba(242,193,78,0.22);">
                  <td style="padding:6px 8px;">#${idx + 1}</td>
                  <td style="padding:6px 8px;color:#FFE9B0;">${entry.name}${isNew ? ' ★' : ''}</td>
                  <td style="padding:6px 8px;color:#F2C14E;font-weight:700;">${entry.score}</td>
                  <td style="padding:6px 8px;">${entry.nights_won}/3</td>
                  <td style="padding:6px 8px;color:#8FA3B8;">${entry.seed}</td>
                  <td style="padding:6px 8px;color:#8FA3B8;">${dtText}</td>
                </tr>`;
              })
              .join('')
          : `<tr><td colspan="6" style="padding:16px;color:#8FA3B8;">Chưa có kỷ lục nào được lưu.</td></tr>`;

      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;font-size:${this.fpx(26)};margin:0 0 12px 0;">BẢNG XẾP HẠNG (TOP 10)</h2>
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:${this.fpx(18)};margin-bottom:16px;">
          <thead>
            <tr style="border-bottom:2px solid #F2C14E;color:#F2C14E;">
              <th style="padding:6px 8px;">Hạng</th>
              <th style="padding:6px 8px;">Tên</th>
              <th style="padding:6px 8px;">Điểm</th>
              <th style="padding:6px 8px;">Đêm</th>
              <th style="padding:6px 8px;">Seed</th>
              <th style="padding:6px 8px;">Ngày</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <button id="btn-lb-menu" style="${btnPrimary}">Về Menu</button>
      </div>`;
      this.modalLayer.querySelector('#btn-lb-menu')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    }
  }

  private buildLeaderboardFormHtml(totalScore: number, nightsWon: number): string {
    if (this.scoreSavedThisRun) {
      return `<div id="lb-save-msg" style="color:#8ce99a;font-size:${this.fpx(18)};margin:8px 0 14px 0;">✓ Đã lưu điểm (${totalScore} đ · ${nightsWon}/3 Đêm) vào Bảng xếp hạng!</div>`;
    }
    return `<div style="background:rgba(27,35,80,0.6);border:1px solid rgba(242,193,78,0.45);border-radius:10px;padding:12px;margin:0 0 14px 0;">
      <label style="display:block;font-size:${this.fpx(18)};margin-bottom:8px;">Lưu kỷ lục (3–12 ký tự chữ/số/_):<br/>
        <input id="inp-lb-name" type="text" maxlength="12" placeholder="VD: May_01" style="margin-top:6px;padding:8px 12px;border-radius:6px;border:1px solid #F2C14E;background:#0E1430;color:#F5F1E6;font-size:${this.fpx(18)};width:220px;text-align:center;" />
        <button id="btn-save-score" style="background:#FFB347;color:#0E1430;border:none;border-radius:6px;padding:8px 16px;font-weight:700;font-size:${this.fpx(18)};cursor:pointer;margin-left:8px;">Lưu điểm</button>
      </label>
      <div id="lb-save-msg" style="color:#FF5A5F;font-size:${this.fpx(18)};min-height:24px;">${this.scoreSaveMessage}</div>
    </div>`;
  }

  private bindLeaderboardForm(world: WorldState, totalScore: number, runMeta: RunSummaryMeta): void {
    const inp = this.modalLayer.querySelector('#inp-lb-name') as HTMLInputElement | null;
    const btn = this.modalLayer.querySelector('#btn-save-score') as HTMLButtonElement | null;
    const msg = this.modalLayer.querySelector('#lb-save-msg') as HTMLDivElement | null;
    btn?.addEventListener('click', async () => {
      const name = (inp?.value ?? '').trim();
      if (!validateLeaderboardName(name)) {
        if (msg) msg.textContent = 'Tên cần 3–12 ký tự (A-Z, a-z, 0-9, _ hoặc chữ Việt).';
        return;
      }
      this.scoreSavedThisRun = true;
      this.scoreSaveMessage = '';
      await this.callbacks.onSaveScore(name);
      this.renderModal(this.prevScreenMode ?? 'result', world, totalScore, runMeta);
    });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleCaptureKeydown, { capture: true });
    this.root.remove();
  }
}
