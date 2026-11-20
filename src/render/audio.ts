import type { ContractEvent, WorldState } from '../core/types.js';
import type { GameSettings } from './settings.js';
import { DEFAULT_SETTINGS } from './settings.js';

/**
 * Procedural WebAudio synthesizer for ambient night music and all Phase 2 SFX
 * (zero external copyrighted audio files).
 */
export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private musicTimer: number | null = null;
  private musicStep = 0;
  private lastCountdownSec = -1;
  private lastWindWarn = false;

  unlock(): void {
    if (this.ctx || typeof window === 'undefined') {
      return;
    }
    const AudioCtor = window.AudioContext;
    if (AudioCtor) {
      this.ctx = new AudioCtor();
      this.startAmbientLoop();
    }
  }

  applySettings(settings: GameSettings): void {
    this.settings = { ...settings };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private get sfxVol(): number {
    return this.muted ? 0 : this.settings.masterVolume * this.settings.sfxVolume;
  }

  private get musicVol(): number {
    return this.muted ? 0 : this.settings.masterVolume * this.settings.musicVolume;
  }

  private startAmbientLoop(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 246.94];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const vol = this.musicVol * 0.025;
      if (vol <= 0.0005) return;
      const freq = notes[this.musicStep % notes.length];
      this.musicStep++;
      this.playTone(freq, 1.35, 'sine', vol, freq * 0.995);
    }, 1100);
  }

  playJump(): void {
    const vol = this.sfxVol * 0.07;
    if (vol <= 0 || !this.ctx) return;
    this.playTone(320, 0.14, 'sine', vol, 520);
  }

  updateTickFeedback(world: WorldState, events: ContractEvent[]): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const vol = this.sfxVol;
    if (vol <= 0) return;

    for (const ev of events) {
      if (ev.name === 'mote_picked') {
        this.playTone(720, 0.13, 'sine', vol * 0.08, 960);
      } else if (ev.name === 'charm_picked') {
        this.playTone(587.33, 0.25, 'triangle', vol * 0.1, 880);
      } else if (ev.name === 'deposit') {
        this.playTone(440, 0.16, 'triangle', vol * 0.09, 587.33);
      } else if (ev.name === 'lantern_lit') {
        this.playTone(392, 0.42, 'triangle', vol * 0.12, 587.33);
        this.playTone(587.33, 0.5, 'sine', vol * 0.1, 783.99);
      } else if (ev.name === 'pulse') {
        this.playTone(540, 0.3, 'sine', vol * 0.12, 210);
      } else if (ev.name === 'dash') {
        this.playTone(480, 0.12, 'triangle', vol * 0.08, 220);
      } else if (ev.name === 'drifter_steal') {
        this.playTone(620, 0.22, 'sawtooth', vol * 0.07, 290);
      } else if (ev.name === 'drifter_drop') {
        this.playTone(520, 0.2, 'sine', vol * 0.09, 760);
      } else if (ev.name === 'shade_spawned') {
        this.playTone(110, 0.35, 'sawtooth', vol * 0.06, 72);
      } else if (ev.name === 'player_hit') {
        this.playTone(135, 0.28, 'sawtooth', vol * 0.11, 68);
      } else if (ev.name === 'game_over') {
        if (ev.data.result === 'won') {
          this.playTone(523.25, 0.55, 'sine', vol * 0.13, 1046.5);
        } else {
          this.playTone(185, 0.55, 'triangle', vol * 0.12, 88);
        }
      }
    }

    // Wind warning cue
    if (world.wind.warning && !this.lastWindWarn) {
      this.playTone(290, 0.4, 'sine', vol * 0.08, 410);
    }
    this.lastWindWarn = world.wind.warning;

    // Last 10 seconds countdown cue
    if (world.state === 'playing' && world.time_left_s > 0 && world.time_left_s <= 10) {
      const sec = Math.ceil(world.time_left_s);
      if (sec !== this.lastCountdownSec) {
        this.lastCountdownSec = sec;
        this.playTone(880, 0.08, 'sine', vol * 0.07, 880);
      }
    } else {
      this.lastCountdownSec = -1;
    }
  }

  private playTone(
    startFreq: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number,
    endFreq: number,
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(Math.max(0.0001, gainLevel), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
