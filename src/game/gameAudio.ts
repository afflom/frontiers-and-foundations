import type { WorldRegion } from './worldData';

/**
 * Procedural Web Audio API Fantasy Soundtrack & Diegetic RPG SFX Engine.
 * Zero external audio files — adapts dynamically to the player's current Vaelmor region.
 */
export class VaelmorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private musicTimer: number | null = null;
  private step = 0;
  private muted = false;
  private running = false;
  private mood: WorldRegion['ambientMood'] = 'causeway';

  public isMuted(): boolean {
    return this.muted;
  }

  public ensureStarted(): void {
    if (this.running) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0.42, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      // Subtle atmospheric bowed drone
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.06, ctx.currentTime);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, ctx.currentTime);
      droneGain.connect(filter);
      filter.connect(master);
      this.droneGain = droneGain;

      const baseHz = 146.83; // D3 Dorian
      this.droneOscs = [0.5, 1, 1.5].map((ratio, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(baseHz * ratio, ctx.currentTime);
        osc.connect(droneGain);
        osc.start();
        return osc;
      });

      this.running = true;
      this.musicTimer = window.setInterval(() => this.tickAmbientPhrase(), 1450);
    } catch {
      // Headless or blocked autoplay; safe no-op
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
  }

  public setPaused(paused: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(paused || this.muted ? 0 : 0.42, this.ctx.currentTime, 0.08);
  }

  public setRegionMood(mood: WorldRegion['ambientMood']): void {
    if (this.mood === mood) return;
    this.mood = mood;
    if (!this.ctx || this.droneOscs.length === 0) return;
    const roots: Record<WorldRegion['ambientMood'], number> = {
      causeway: 146.83, // D3
      ironwood: 164.81, // E3
      foundry: 130.81, // C3
      coast: 110.0, // A2
    };
    const root = roots[mood];
    const now = this.ctx.currentTime;
    [0.5, 1, 1.5].forEach((r, i) => {
      this.droneOscs[i]?.frequency.setTargetAtTime(root * r, now, 0.8);
    });
  }

  private tickAmbientPhrase(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (this.ctx.state === 'suspended') return;
    const s = this.step++;
    if (s % 3 !== 0) return;

    const scales: Record<WorldRegion['ambientMood'], number[]> = {
      causeway: [293.66, 329.63, 349.23, 440.0, 493.88],
      ironwood: [329.63, 392.0, 440.0, 493.88, 587.33],
      foundry: [261.63, 293.66, 349.23, 392.0, 466.16],
      coast: [220.0, 261.63, 293.66, 329.63, 392.0],
    };
    const notes = scales[this.mood];
    const freq = notes[(s * 5 + 2) % notes.length];
    this.playTone(freq, 0.045, 1.8, 'sine');
  }

  private playTone(freq: number, peak: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  public playSwing(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    const jitter = 0.94 + Math.random() * 0.12;
    osc.frequency.setValueAtTime(420 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(140 * jitter, now + 0.14);
    env.gain.setValueAtTime(0.001, now);
    env.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playBellStrike(baseHz = 174): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const partials = [1, 2.756, 5.404];
    partials.forEach((ratio, idx) => {
      this.playTone(baseHz * ratio, idx === 0 ? 0.24 : idx === 1 ? 0.1 : 0.04, 2.1 / (idx + 1), 'sine');
    });
  }

  public playHit(heavy = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 135 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.22 : 0.12));
    env.gain.setValueAtTime(heavy ? 0.28 : 0.18, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + (heavy ? 0.24 : 0.14));
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playJump(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.11);
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playHealShimmer(): void {
    this.playTone(396, 0.14, 0.7, 'sine');
    window.setTimeout(() => this.playTone(528, 0.12, 0.85, 'sine'), 90);
    window.setTimeout(() => this.playTone(660, 0.1, 1.0, 'sine'), 180);
  }

  public playTelegraphCue(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.28);
    env.gain.setValueAtTime(0.08, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playQuestFanfare(): void {
    const notes = [293.66, 369.99, 440.0, 587.33];
    notes.forEach((n, idx) => {
      window.setTimeout(() => this.playTone(n, 0.16, 1.1, 'triangle'), idx * 110);
    });
  }

  public playDefeatSting(): void {
    this.playTone(196, 0.2, 0.9, 'sawtooth');
    window.setTimeout(() => this.playTone(146.83, 0.22, 1.4, 'sawtooth'), 220);
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.droneOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        // ignore
      }
    });
    this.droneOscs = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.running = false;
  }
}
