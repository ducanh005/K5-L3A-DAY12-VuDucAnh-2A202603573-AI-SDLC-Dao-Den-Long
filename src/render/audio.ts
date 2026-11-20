import type { ContractEvent } from '../core/types.js';

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

  playEvents(events: ContractEvent[]): void {
    if (this.muted || !this.ctx || events.length === 0) {
      return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    for (const ev of events) {
      if (ev.name === 'mote_picked') {
        this.playTone(680, 0.14, 'sine', 0.08, 920);
      } else if (ev.name === 'deposit') {
        this.playTone(440, 0.18, 'triangle', 0.09, 554.37);
      } else if (ev.name === 'lantern_lit') {
        this.playTone(392, 0.4, 'triangle', 0.12, 587.33);
        this.playTone(587.33, 0.45, 'sine', 0.1, 783.99);
      } else if (ev.name === 'pulse') {
        this.playTone(520, 0.28, 'sine', 0.11, 220);
      } else if (ev.name === 'player_hit') {
        this.playTone(130, 0.28, 'sawtooth', 0.1, 75);
      } else if (ev.name === 'game_over') {
        if (ev.data.result === 'won') {
          this.playTone(523.25, 0.5, 'sine', 0.12, 1046.5);
        } else {
          this.playTone(180, 0.5, 'triangle', 0.11, 90);
        }
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
