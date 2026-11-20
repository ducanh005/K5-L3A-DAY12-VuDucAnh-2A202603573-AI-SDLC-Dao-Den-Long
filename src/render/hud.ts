import type { WorldState } from '../core/types.js';

/**
 * Lightweight DOM HUD overlay showing Mây's status, story cues, and controls.
 */
export class HudController {
  private readonly root: HTMLDivElement;
  private readonly statsEl: HTMLDivElement;
  private readonly loreEl: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;padding:16px;display:flex;flex-direction:column;justify-content:space-between;';

    const topBar = document.createElement('div');
    topBar.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText =
      'background:rgba(10,14,24,0.78);border:1px solid rgba(255,210,125,0.3);border-radius:10px;padding:12px 16px;font-size:14px;line-height:1.5;backdrop-filter:blur(6px);';

    this.loreEl = document.createElement('div');
    this.loreEl.style.cssText =
      'background:rgba(10,14,24,0.72);border:1px solid rgba(180,200,255,0.2);border-radius:10px;padding:10px 14px;font-size:13px;max-width:340px;color:#d6e0f5;';
    this.loreEl.textContent =
      'Mây: "Sương đen đang nuốt chửng Đảo Đèn Lồng. Hãy gom đom đóm để thắp sáng các Đèn Lồng Lớn!"';

    topBar.append(this.statsEl, this.loreEl);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText =
      'align-self:center;background:rgba(10,14,24,0.88);border:1px solid rgba(255,210,125,0.5);border-radius:12px;padding:14px 22px;font-size:16px;display:none;text-align:center;';

    const footer = document.createElement('div');
    footer.style.cssText =
      'align-self:flex-start;background:rgba(10,14,24,0.7);border-radius:8px;padding:8px 12px;font-size:12px;color:#b8c4db;';
    footer.textContent = 'Di chuyển: WASD / Phím mũi tên | Chạy nhanh: Shift | Thắp đèn: E / Space | Chơi lại: R | Âm thanh: M';

    this.root.append(topBar, this.statusEl, footer);
    container.appendChild(this.root);
  }

  update(state: WorldState, muted: boolean): void {
    const litCount = state.lanterns.filter((l) => l.lit).length;
    const totalLanterns = state.lanterns.length;

    this.statsEl.innerHTML = [
      `<div><strong>Đảo Đèn Lồng</strong> · Seed ${state.seed}</div>`,
      `<div>Đom đóm: <strong>${state.player.fireflies}</strong> · Đèn Lồng Lớn: <strong>${litCount}/${totalLanterns}</strong></div>`,
      `<div>Sinh lực: <strong>${state.player.hp}</strong> · Thể lực: <strong>${Math.round(state.player.stamina)}%</strong> · Âm: ${muted ? 'Tắt' : 'Bật'}</div>`,
    ].join('');

    if (state.status === 'won') {
      this.statusEl.style.display = 'block';
      this.statusEl.innerHTML = '<strong>Chiến thắng!</strong> Ánh sáng đã trở lại trên Đảo Đèn Lồng. Nhấn <code>R</code> để chơi lại.';
    } else if (state.status === 'lost') {
      this.statusEl.style.display = 'block';
      this.statusEl.innerHTML = '<strong>Bóng Mực đã nuốt lấy ngọn đèn!</strong> Nhấn <code>R</code> để thử lại.';
    } else {
      this.statusEl.style.display = 'none';
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
