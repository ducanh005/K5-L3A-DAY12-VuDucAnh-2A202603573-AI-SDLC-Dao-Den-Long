import type { WorldState } from '../core/types.js';

/**
 * Lightweight DOM HUD overlay displaying Night 1 progress, score, flames, motes, and context prompts.
 */
export class HudController {
  private readonly root: HTMLDivElement;
  private readonly statsEl: HTMLDivElement;
  private readonly loreEl: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;padding:16px;display:flex;flex-direction:column;justify-content:space-between;';

    const topBar = document.createElement('div');
    topBar.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText =
      'background:rgba(14,10,24,0.82);border:1px solid rgba(255,190,100,0.38);border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.55;backdrop-filter:blur(6px);';

    this.loreEl = document.createElement('div');
    this.loreEl.style.cssText =
      'background:rgba(14,10,24,0.75);border:1px solid rgba(190,150,255,0.25);border-radius:12px;padding:10px 14px;font-size:13px;max-width:340px;color:#e8def8;';
    this.loreEl.textContent =
      'Mây: "Sương tím đen đang phủ kín Đảo Bến. Hãy gom đom đóm thắp lại 5 Đèn Lồng Lớn!"';

    topBar.append(this.statsEl, this.loreEl);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText =
      'align-self:center;background:rgba(14,10,24,0.92);border:1px solid rgba(255,190,100,0.65);border-radius:14px;padding:18px 26px;font-size:16px;display:none;text-align:center;';

    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';

    this.promptEl = document.createElement('div');
    this.promptEl.style.cssText =
      'background:rgba(28,16,44,0.9);border:1px solid rgba(255,210,125,0.65);border-radius:10px;padding:8px 16px;font-size:14px;color:#ffe299;display:none;text-align:center;';

    const footer = document.createElement('div');
    footer.style.cssText =
      'align-self:flex-start;background:rgba(14,10,24,0.75);border-radius:8px;padding:8px 12px;font-size:12px;color:#d0c4e2;';
    footer.textContent =
      'Di chuyển: WASD / Mũi tên | Nhảy: Space | Xoay Camera: Q/C hoặc Kéo chuột | Nạp đèn: E / F | Tỏa sáng xua Bóng Mực: Shift / X | Chơi lại: R | Âm: M';

    bottomSection.append(this.promptEl, footer);
    this.root.append(topBar, this.statusEl, bottomSection);
    container.appendChild(this.root);
  }

  update(state: WorldState, muted: boolean): void {
    const litCount = state.lanterns.filter((l) => l.lit).length;
    const totalLanterns = state.lanterns.length;
    const mins = Math.floor(state.time_left_s / 60);
    const secs = Math.floor(state.time_left_s % 60)
      .toString()
      .padStart(2, '0');
    const pulseReady =
      state.player.carried >= state.tuning.pulse_cost && state.player.pulse_cd_left_s <= 0;

    this.statsEl.innerHTML = [
      `<div><strong>Đêm 1 – Đảo Bến</strong> · Điểm: <strong style="color:#ffd27d">${state.score}</strong> · Còn lại: <strong>${mins}:${secs}</strong></div>`,
      `<div>Đom đóm: <strong style="color:#ffd27d">${state.player.carried}/${state.tuning.carry_capacity}</strong> · Đèn Lồng Lớn: <strong style="color:#ffd27d">${litCount}/${totalLanterns}</strong></div>`,
      `<div>Ngọn lửa (Máu): <strong style="color:#ff9e64">${state.player.flames}/${state.tuning.flames}</strong> · Tỏa sáng: ${pulseReady ? '<span style="color:#8ce99a">Sẵn sàng</span>' : '<span style="color:#aaa">Cần 1 đom đóm / hồi</span>'} · Âm: ${muted ? 'Tắt' : 'Bật'}</div>`,
    ].join('');

    if (litCount === 0) {
      this.loreEl.textContent =
        'Mây: "Nhặt đốm sáng vàng cam và mang về 5 Đèn Lồng Lớn. Bóng Mực rất sợ ánh sáng đèn!"';
    } else if (litCount < totalLanterns) {
      this.loreEl.textContent = `Mây: "Đã thắp ${litCount}/${totalLanterns} Đèn Lồng Lớn! Vùng quanh đèn đã sáng an toàn trước Bóng Mực."`;
    } else {
      this.loreEl.textContent = 'Mây: "Cả Đảo Bến đã rực sáng trở lại!"';
    }

    // Contextual action prompt to prevent confusion when carry bag is full or near a lantern
    const nearbyUnlit = state.lanterns.find(
      (l) =>
        !l.lit &&
        Math.hypot(state.player.pos[0] - l.pos[0], state.player.pos[2] - l.pos[2]) <=
          state.tuning.interact_radius,
    );

    if (state.state !== 'playing') {
      this.promptEl.style.display = 'none';
    } else if (nearbyUnlit) {
      this.promptEl.style.display = 'block';
      if (state.player.carried > 0) {
        this.promptEl.textContent = `Đèn Lồng ${nearbyUnlit.id} (${nearbyUnlit.deposited}/${state.tuning.lantern_cost}) — Nhấn [E] hoặc [F] để nạp đom đóm!`;
      } else {
        this.promptEl.textContent = `Đèn Lồng ${nearbyUnlit.id} (${nearbyUnlit.deposited}/${state.tuning.lantern_cost}) — Cần gom thêm đom đóm để thắp sáng!`;
      }
    } else if (state.player.carried >= state.tuning.carry_capacity) {
      this.promptEl.style.display = 'block';
      this.promptEl.textContent = `Túi đom đóm đã đầy (${state.player.carried}/${state.tuning.carry_capacity})! Hãy mang về Đèn Lồng Lớn để nạp ánh sáng.`;
    } else {
      this.promptEl.style.display = 'none';
    }

    if (state.state === 'won') {
      this.statusEl.style.display = 'block';
      this.statusEl.innerHTML = `<strong>Chiến thắng Đêm 1 – Đảo Bến!</strong><br/>Tổng điểm: <strong>${state.score}</strong> · Nhấn <code>R</code> để chơi lại.`;
    } else if (state.state === 'lost') {
      this.statusEl.style.display = 'block';
      const reasonText =
        state.player.flames <= 0 ? 'Ngọn lửa của Mây đã tắt!' : 'Bình minh đã tới trước khi đảo sáng!';
      this.statusEl.innerHTML = `<strong>Thất bại — ${reasonText}</strong><br/>Điểm: <strong>${state.score}</strong> · Nhấn <code>R</code> để chơi lại.`;
    } else {
      this.statusEl.style.display = 'none';
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
