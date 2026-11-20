import type { NightNumber, WorldState } from '../core/types.js';
import type { GameScene } from './scene.js';
import type { GameSettings } from './settings.js';

export type ScreenMode = 'menu' | 'intro' | 'playing' | 'paused' | 'settings' | 'result' | 'dawn';

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
 * Full Ticket-03 HUD (dynamic capacity, lantern fuel gauges, colorblind alerts, dawn target)
 * + Menu / Intro / Pause / Settings / Dawn campaign flow controller.
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
  private readonly arrowEl: HTMLDivElement;
  private readonly modalLayer: HTMLDivElement;

  private settingsDraft: GameSettings;
  private prevScreenMode: ScreenMode | null = null;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    private readonly callbacks: HudCallbacks,
  ) {
    this.settingsDraft = { ...initialSettings };

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;color:#F5F1E6;';

    this.hudLayer = document.createElement('div');
    this.hudLayer.style.cssText =
      'position:absolute;inset:0;padding:16px;display:flex;flex-direction:column;justify-content:space-between;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    this.flamesEl = document.createElement('div');
    this.flamesEl.style.cssText =
      'background:rgba(14,20,48,0.85);border:1px solid #F2C14E;border-radius:10px;padding:10px 14px;font-size:15px;';

    const centerCol = document.createElement('div');
    centerCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText =
      'background:rgba(14,20,48,0.85);border:1px solid rgba(242,193,78,0.6);border-radius:10px;padding:8px 18px;font-size:22px;font-weight:700;letter-spacing:1px;';

    this.fuelStripEl = document.createElement('div');
    this.fuelStripEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;';

    centerCol.append(this.timerEl, this.fuelStripEl);

    this.rightStatsEl = document.createElement('div');
    this.rightStatsEl.style.cssText =
      'background:rgba(14,20,48,0.85);border:1px solid #F2C14E;border-radius:10px;padding:10px 16px;font-size:15px;text-align:right;';

    topRow.append(this.flamesEl, centerCol, this.rightStatsEl);

    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';

    this.promptEl = document.createElement('div');
    this.promptEl.style.cssText =
      'background:rgba(14,20,48,0.92);border:1px solid #F2C14E;border-radius:10px;padding:8px 16px;font-size:14px;color:#FFE9B0;display:none;';

    const barRow = document.createElement('div');
    barRow.style.cssText = 'width:100%;display:flex;justify-content:center;align-items:flex-end;position:relative;';

    this.moteSlotsEl = document.createElement('div');
    this.moteSlotsEl.style.cssText =
      'display:flex;gap:5px;flex-wrap:wrap;max-width:460px;justify-content:center;align-items:center;background:rgba(14,20,48,0.85);border:1px solid rgba(242,193,78,0.5);border-radius:12px;padding:8px 12px;';

    this.cooldownsEl = document.createElement('div');
    this.cooldownsEl.style.cssText =
      'position:absolute;right:0;bottom:0;display:flex;gap:8px;background:rgba(14,20,48,0.85);border:1px solid rgba(242,193,78,0.5);border-radius:12px;padding:8px 12px;font-size:13px;';

    barRow.append(this.moteSlotsEl, this.cooldownsEl);
    bottomRow.append(this.promptEl, barRow);

    this.hudLayer.append(topRow, bottomRow);

    this.arrowEl = document.createElement('div');
    this.arrowEl.style.cssText =
      'position:fixed;width:36px;height:36px;border-radius:50%;background:rgba(14,20,48,0.88);border:2px solid #F2C14E;color:#FFB347;display:none;align-items:center;justify-content:center;font-size:18px;font-weight:700;transform:translate(-50%,-50%);';
    this.arrowEl.textContent = '➤';

    this.modalLayer = document.createElement('div');
    this.modalLayer.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(14,20,48,0.78);backdrop-filter:blur(6px);pointer-events:auto;';

    this.root.append(this.hudLayer, this.arrowEl, this.modalLayer);
    container.appendChild(this.root);
  }

  update(
    mode: ScreenMode,
    world: WorldState,
    scene: GameScene,
    totalCampaignScore: number,
    settings: GameSettings,
    muted: boolean,
  ): void {
    const showHud = mode === 'playing' || mode === 'paused';
    this.hudLayer.style.display = showHud ? 'flex' : 'none';
    const warnColor = settings.colorblindMode ? '#FFFFFF' : '#FF5A5F';
    const warnPrefix = settings.colorblindMode ? '⚠ ' : '';

    if (showHud) {
      const flameIcons = Array.from({ length: world.tuning.flames }, (_, i) =>
        i < world.player.flames
          ? '<span style="color:#FFB347">🔥</span>'
          : '<span style="color:#5B5F6E">○</span>',
      ).join(' ');
      const charmBadge =
        world.player.charm_ticks > 0
          ? `<div style="color:#F2C14E;font-size:12px;margin-top:4px;">Bùa Gió: ${(world.player.charm_ticks / 60).toFixed(1)}s</div>`
          : '';
      const windBadge = world.wind.active
        ? `<div style="color:#8FA3B8;font-size:12px;margin-top:4px;">Gió mạnh (${Math.round(world.wind.dir_deg)}°)</div>`
        : world.wind.warning
          ? `<div style="color:${warnColor};font-size:12px;margin-top:4px;">${warnPrefix}Sắp có gió mạnh!</div>`
          : '';
      this.flamesEl.innerHTML = `<div>Ngọn Lửa: ${flameIcons}</div>${charmBadge}${windBadge}`;

      const totalSec = Math.ceil(world.time_left_s);
      const mins = Math.floor(totalSec / 60)
        .toString()
        .padStart(2, '0');
      const secs = (totalSec % 60).toString().padStart(2, '0');
      const urgent = world.time_left_s <= 30;
      const blinkHide = urgent && Math.floor(world.tick / 15) % 2 === 1;
      this.timerEl.style.color = urgent ? warnColor : '#F5F1E6';
      this.timerEl.style.opacity = blinkHide ? '0.45' : '1';
      this.timerEl.textContent = `${urgent ? warnPrefix : ''}${mins}:${secs}`;

      const litCount = world.lanterns.filter((l) => l.lit).length;
      const requiredLit = Math.ceil(world.tuning.win_ratio * world.lanterns.length);
      const drainingIds = new Set(
        world.shades.filter((s) => s.state === 'drain' && s.target_lantern_id).map((s) => s.target_lantern_id as string),
      );
      const blink1Hz = Math.sin((world.tick / 60) * Math.PI * 2) >= 0;

      // Per-lantern fuel pills
      const lowFuelTicks = world.tuning.low_fuel_threshold * 60;
      this.fuelStripEl.innerHTML = world.lanterns
        .map((l) => {
          const isLow = l.lit && l.fuel_ticks < lowFuelTicks;
          const fuel = isLow && l.fuel_ticks > 0 ? Math.min(29, Math.round(l.fuel_ticks / 60)) : Math.round(l.fuel_ticks / 60);
          const isDrained = drainingIds.has(l.id);
          const border = l.lit ? (isLow || isDrained ? warnColor : '#FFB347') : '#5B5F6E';
          const opacity = isLow && !blink1Hz ? '0.45' : '1';
          const text = l.lit ? `${l.id}: ${isLow || isDrained ? warnPrefix : ''}${fuel}%` : `${l.id}: Tắt`;
          return `<div style="background:rgba(14,20,48,0.85);border:1px solid ${border};border-radius:6px;padding:2px 7px;font-size:11px;color:${isLow || isDrained ? warnColor : l.lit ? '#FFE9B0' : '#8FA3B8'};opacity:${opacity};">${text}</div>`;
        })
        .join('');

      const litColor = litCount >= requiredLit ? '#8ce99a' : warnColor;
      this.rightStatsEl.innerHTML = `<div>Đêm ${world.night}/3 · Giữ sáng: <strong style="color:${litColor}">${litCount}/${world.lanterns.length}</strong> (Cần ≥ ${requiredLit})</div><div style="color:#F2C14E;font-weight:700;">Điểm: ${world.score}</div>`;

      // Dynamic capacity slots (10 -> max 20) + label
      const slotsHtml = Array.from({ length: world.player.capacity }, (_, i) => {
        const filled = i < world.player.carried;
        return `<div style="width:16px;height:16px;border-radius:50%;border:2px solid #F2C14E;background:${filled ? '#FFF6C2' : 'rgba(27,35,80,0.6)'};box-shadow:${filled ? '0 0 6px #FFE58A' : 'none'};"></div>`;
      }).join('');
      this.moteSlotsEl.innerHTML = `<span style="font-size:12px;color:#FFE9B0;margin-right:4px;">${world.player.carried}/${world.player.capacity}</span>${slotsHtml}`;

      const dashReady = world.player.dash_cd_ticks === 0 || world.player.charm_ticks > 0;
      const pulseReady =
        world.player.carried >= world.tuning.pulse_cost && world.player.pulse_cd_ticks === 0;
      this.cooldownsEl.innerHTML = [
        `<div style="padding:4px 8px;border-radius:6px;border:1px solid ${dashReady ? '#F2C14E' : '#5B5F6E'};color:${dashReady ? '#FFE9B0' : '#8FA3B8'}">Lướt [Shift]: ${dashReady ? 'Sẵn sàng' : `${(world.player.dash_cd_ticks / 60).toFixed(1)}s`}</div>`,
        `<div style="padding:4px 8px;border-radius:6px;border:1px solid ${pulseReady ? '#FFB347' : '#5B5F6E'};color:${pulseReady ? '#FFE9B0' : '#8FA3B8'}">Tỏa Sáng [X]: ${world.player.pulse_cd_ticks > 0 ? `${(world.player.pulse_cd_ticks / 60).toFixed(1)}s` : world.player.carried >= 3 ? 'Sẵn sàng' : `${world.player.carried}/3`}</div>`,
        `<div style="padding:4px 6px;color:#8FA3B8;">Âm [M]: ${muted ? 'Tắt' : 'Bật'}</div>`,
      ].join('');

      // Context prompt: deposit or refuel
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
          this.promptEl.textContent = `E — ${nearby.ever_lit ? 'Thắp lại' : 'Nạp ánh sáng'} ${nearby.id} (${nearby.deposited}/${req})`;
        } else {
          this.promptEl.textContent = `E — Châm dầu ${nearby.id} (${Math.round(nearby.fuel_ticks / 60)}%)`;
        }
      } else if (world.player.carried >= world.player.capacity) {
        this.promptEl.style.display = 'block';
        this.promptEl.textContent = `Túi đom đóm đã đầy (${world.player.carried}/${world.player.capacity})! Mang về đèn thắp hoặc châm dầu.`;
      } else {
        this.promptEl.style.display = 'none';
      }

      // Offscreen arrow: prioritize drained/low-fuel lanterns or unlit lanterns
      const priorityTargets = world.lanterns
        .filter((l) => !l.lit || l.fuel_ticks < world.tuning.low_fuel_threshold * 60 || drainingIds.has(l.id))
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
          const ax = Math.max(52, Math.min(w - 52, proj.x));
          const ay = Math.max(92, Math.min(h - 72, proj.y));
          const isDanger = drainingIds.has(target.id) || (target.lit && target.fuel_ticks < world.tuning.low_fuel_threshold * 60);
          this.arrowEl.style.display = 'flex';
          this.arrowEl.style.borderColor = isDanger ? warnColor : '#F2C14E';
          this.arrowEl.style.color = isDanger ? warnColor : '#FFB347';
          this.arrowEl.style.left = `${ax}px`;
          this.arrowEl.style.top = `${ay}px`;
          this.arrowEl.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
        } else {
          this.arrowEl.style.display = 'none';
        }
      } else {
        this.arrowEl.style.display = 'none';
      }
    } else {
      this.arrowEl.style.display = 'none';
    }

    if (mode !== this.prevScreenMode) {
      if (mode === 'settings') {
        this.settingsDraft = { ...settings };
      }
      this.renderModal(mode, world, totalCampaignScore);
      this.prevScreenMode = mode;
    }
  }

  private renderModal(mode: ScreenMode, world: WorldState, totalCampaignScore: number): void {
    if (mode === 'playing') {
      this.modalLayer.style.display = 'none';
      this.modalLayer.innerHTML = '';
      return;
    }

    this.modalLayer.style.display = 'flex';
    const cardStyle =
      'background:#0E1430;border:2px solid #F2C14E;border-radius:16px;padding:28px 32px;max-width:520px;width:90%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.65);';
    const btnPrimary =
      'background:#FFB347;color:#0E1430;border:none;border-radius:8px;padding:10px 20px;font-weight:700;font-size:15px;cursor:pointer;margin:6px;';
    const btnSecondary =
      'background:#1B2350;color:#F5F1E6;border:1px solid #F2C14E;border-radius:8px;padding:10px 18px;font-weight:600;font-size:14px;cursor:pointer;margin:6px;';

    if (mode === 'menu') {
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h1 style="color:#F2C14E;font-size:28px;margin-bottom:8px;">ĐẢO ĐÈN LỒNG</h1>
        <p style="color:#E8E2D0;font-size:14px;margin-bottom:20px;">Đèn cạn dầu — Giữ ánh đèn sáng qua ba đêm sương mù tới bình minh.</p>
        <div><button id="btn-start-campaign" style="${btnPrimary}">Bắt đầu hành trình (Đêm 1 → 3)</button></div>
        <div style="margin-top:10px;">
          <button id="btn-night-1" style="${btnSecondary}">Đêm 1: Đảo Bến</button>
          <button id="btn-night-2" style="${btnSecondary}">Đêm 2: Đảo Cau</button>
          <button id="btn-night-3" style="${btnSecondary}">Đêm 3: Đảo Chuông</button>
        </div>
        <div style="margin-top:10px;"><button id="btn-open-settings" style="${btnSecondary}">Cài đặt</button></div>
        <p style="color:#8FA3B8;font-size:12px;margin-top:16px;">WASD: Đi · Space: Nhảy · Shift: Lướt · E/F: Thắp/Châm dầu · X/Chuột phải: Tỏa Sáng · Esc/P: Tạm dừng</p>
      </div>`;
      this.modalLayer.querySelector('#btn-start-campaign')?.addEventListener('click', () => this.callbacks.onStartCampaign());
      this.modalLayer.querySelector('#btn-night-1')?.addEventListener('click', () => this.callbacks.onSelectNight(1));
      this.modalLayer.querySelector('#btn-night-2')?.addEventListener('click', () => this.callbacks.onSelectNight(2));
      this.modalLayer.querySelector('#btn-night-3')?.addEventListener('click', () => this.callbacks.onSelectNight(3));
      this.modalLayer.querySelector('#btn-open-settings')?.addEventListener('click', () => this.callbacks.onOpenSettings());
    } else if (mode === 'intro') {
      const copy = NIGHT_INTRO_COPY[world.night];
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;margin-bottom:12px;">${copy.title}</h2>
        <p style="color:#F5F1E6;font-size:15px;line-height:1.6;margin-bottom:22px;">${copy.quote}</p>
        <button id="btn-begin-night" style="${btnPrimary}">Bắt đầu thắp đèn</button>
      </div>`;
      this.modalLayer.querySelector('#btn-begin-night')?.addEventListener('click', () => this.callbacks.onBeginNight());
    } else if (mode === 'paused') {
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;margin-bottom:16px;">Tạm dừng</h2>
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
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:#F2C14E;margin-bottom:16px;">Cài đặt</h2>
        <div style="text-align:left;font-size:14px;line-height:2.1;">
          <label>Âm lượng tổng: <span id="val-master">${Math.round(this.settingsDraft.masterVolume * 100)}%</span><br/>
          <input id="inp-master" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.masterVolume}" style="width:100%"/></label>
          <label>Nhạc nền: <span id="val-music">${Math.round(this.settingsDraft.musicVolume * 100)}%</span><br/>
          <input id="inp-music" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.musicVolume}" style="width:100%"/></label>
          <label>Hiệu ứng (SFX): <span id="val-sfx">${Math.round(this.settingsDraft.sfxVolume * 100)}%</span><br/>
          <input id="inp-sfx" type="range" min="0" max="1" step="0.05" value="${this.settingsDraft.sfxVolume}" style="width:100%"/></label>
          <label>Độ nhạy chuột: <span id="val-sens">${this.settingsDraft.mouseSensitivity.toFixed(1)}x</span><br/>
          <input id="inp-sens" type="range" min="0.2" max="2.5" step="0.1" value="${this.settingsDraft.mouseSensitivity}" style="width:100%"/></label>
          <label style="display:flex;align-items:center;gap:10px;margin-top:8px;cursor:pointer;">
            <input id="inp-colorblind" type="checkbox" ${this.settingsDraft.colorblindMode ? 'checked' : ''} />
            <span>Bảng màu dễ phân biệt (Chế độ mù màu)</span>
          </label>
        </div>
        <div style="margin-top:16px;">
          <button id="btn-apply-settings" style="${btnPrimary}">Áp dụng</button>
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
      const cbInp = this.modalLayer.querySelector('#inp-colorblind') as HTMLInputElement | null;
      cbInp?.addEventListener('change', () => {
        this.settingsDraft.colorblindMode = cbInp.checked;
      });
      this.modalLayer.querySelector('#btn-apply-settings')?.addEventListener('click', () => {
        this.callbacks.onSaveSettings({ ...this.settingsDraft });
      });
      this.modalLayer.querySelector('#btn-back-settings')?.addEventListener('click', () => {
        this.callbacks.onCloseSettings();
      });
    } else if (mode === 'result') {
      const won = world.state === 'won';
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h2 style="color:${won ? '#F2C14E' : '#FF5A5F'};margin-bottom:10px;">${won ? `Đón Bình Minh Đêm ${world.night}!` : `Thất bại ở Đêm ${world.night}`}</h2>
        <p style="font-size:15px;margin-bottom:18px;">Điểm Đêm ${world.night}: <strong style="color:#F2C14E">${world.score}</strong> · Tổng điểm: <strong>${totalCampaignScore}</strong></p>
        <div>
          ${won && world.night < 3 ? `<button id="btn-next-night" style="${btnPrimary}">Sang Đêm ${world.night + 1}</button>` : ''}
          <button id="btn-retry-night" style="${won ? btnSecondary : btnPrimary}">Chơi lại Đêm ${world.night}</button>
          <button id="btn-menu-res" style="${btnSecondary}">Về Menu</button>
        </div>
      </div>`;
      this.modalLayer.querySelector('#btn-next-night')?.addEventListener('click', () => this.callbacks.onNextNight());
      this.modalLayer.querySelector('#btn-retry-night')?.addEventListener('click', () => this.callbacks.onRestartNight());
      this.modalLayer.querySelector('#btn-menu-res')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    } else if (mode === 'dawn') {
      this.modalLayer.innerHTML = `<div style="${cardStyle}">
        <h1 style="color:#FFE9B0;margin-bottom:10px;">BÌNH MINH TRÊN BA HÒN ĐẢO</h1>
        <p style="color:#F5F1E6;font-size:15px;line-height:1.6;margin-bottom:16px;">Mây đã giữ ánh sáng qua ba đêm sương mù trên Đảo Bến, Đảo Cau và Đảo Chuông! Bình minh đã rạng ngời.</p>
        <p style="font-size:18px;color:#F2C14E;font-weight:700;margin-bottom:20px;">Tổng điểm hành trình: ${totalCampaignScore}</p>
        <div>
          <button id="btn-dawn-replay" style="${btnPrimary}">Chơi lại từ Đêm 1</button>
          <button id="btn-dawn-menu" style="${btnSecondary}">Về Menu</button>
        </div>
      </div>`;
      this.modalLayer.querySelector('#btn-dawn-replay')?.addEventListener('click', () => this.callbacks.onStartCampaign());
      this.modalLayer.querySelector('#btn-dawn-menu')?.addEventListener('click', () => this.callbacks.onReturnMenu());
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
