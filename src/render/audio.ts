import type { WorldEvent } from '../core/types.js';

/**
 * Procedural WebAudio synthesizer for game feedback (zero external copyrighted audio files).
 */
export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  unlock(): void {
    if (this.ctx || typeof window === 'undefined') {
      return;
    }
    const AudioCtor = window.AudioContext;
    if (AudioCtor) {
      this.ctx = new AudioCtor();
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playEvents(events: WorldEvent[]): void {
    if (this.muted || !this.ctx || events.length === 0) {
      return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    for (const ev of events) {
      if (ev.type === 'firefly_collected') {
        this.playTone(660, 0.14, 'sine', 0.08, 880);
      } else if (ev.type === 'lantern_lit') {
        this.playTone(392, 0.35, 'triangle', 0.12, 587.33);
      } else if (ev.type === 'shadow_hit') {
        this.playTone(130, 0.25, 'sawtooth', 0.09, 85);
      } else if (ev.type === 'game_won') {
        this.playTone(523.25, 0.45, 'sine', 0.12, 783.99);
      }
    }
  }

  private playTone(
    startFreq: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number,
    endFreq: number,
  ): void {
    if (!this.ctx) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}
