import type { AudioRoomPreset } from './verdantModel';

/**
 * Procedural Web Audio API Adaptive Soundtrack & Acoustic Room Synthesizer
 * for Frontiers and Foundations. Zero external audio files (zero 404s).
 */
export class FrontierAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private bellGain: GainNode | null = null;
  private drumGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private reverbDelay: DelayNode | null = null;
  private reverbFeedback: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private windSource: AudioBufferSourceNode | null = null;
  private stepTimer: number | null = null;
  private stepIndex = 0;
  private playing = false;
  private currentPreset: AudioRoomPreset | null = null;

  public isPlaying(): boolean {
    return this.playing;
  }

  public start(preset: AudioRoomPreset): void {
    this.stop();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;
    this.currentPreset = preset;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.45, ctx.currentTime);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(preset.brightnessHz, ctx.currentTime);

    // Simple stereo-style FDN-inspired feedback delay reverb
    const reverbDelay = ctx.createDelay(1.5);
    reverbDelay.delayTime.setValueAtTime(0.28, ctx.currentTime);
    const reverbFeedback = ctx.createGain();
    reverbFeedback.gain.setValueAtTime(Math.min(0.68, preset.reverbDecaySec / 5.5), ctx.currentTime);

    masterFilter.connect(masterGain);
    masterFilter.connect(reverbDelay);
    reverbDelay.connect(reverbFeedback);
    reverbFeedback.connect(reverbDelay);
    reverbDelay.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.masterGain = masterGain;
    this.masterFilter = masterFilter;
    this.reverbDelay = reverbDelay;
    this.reverbFeedback = reverbFeedback;

    // 1. Bowed Basalt Drone Stem
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(preset.droneLevel * 0.16, ctx.currentTime);
    droneGain.connect(masterFilter);
    this.droneGain = droneGain;

    const droneRatios = [0.5, 1.0, 1.5];
    this.droneOscs = droneRatios.map((ratio, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(preset.rootHz * ratio, ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1) * 4, ctx.currentTime);
      osc.connect(droneGain);
      osc.start();
      return osc;
    });

    // 2. Canyon Wind Bed Stem (filtered procedural noise buffer)
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(preset.windLevel * 0.08, ctx.currentTime);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(420, ctx.currentTime);
    windFilter.Q.setValueAtTime(1.6, ctx.currentTime);
    windFilter.connect(windGain);
    windGain.connect(masterFilter);
    this.windGain = windGain;

    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windSource.connect(windFilter);
    windSource.start();
    this.windSource = windSource;

    // 3. Modal Bronze Bell & Frame-Drum Bus
    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(preset.bellLevel * 0.28, ctx.currentTime);
    bellGain.connect(masterFilter);
    this.bellGain = bellGain;

    const drumGain = ctx.createGain();
    drumGain.gain.setValueAtTime(preset.drumLevel * 0.32, ctx.currentTime);
    drumGain.connect(masterFilter);
    this.drumGain = drumGain;

    this.playing = true;
    this.stepIndex = 0;

    const beatMs = Math.max(240, Math.round((60 / preset.bpm) * 500));
    this.triggerStep();
    this.stepTimer = window.setInterval(() => this.triggerStep(), beatMs);
  }

  public updateMix(preset: AudioRoomPreset): void {
    this.currentPreset = preset;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.droneGain?.gain.setTargetAtTime(preset.droneLevel * 0.16, now, 0.08);
    this.bellGain?.gain.setTargetAtTime(preset.bellLevel * 0.28, now, 0.08);
    this.drumGain?.gain.setTargetAtTime(preset.drumLevel * 0.32, now, 0.08);
    this.windGain?.gain.setTargetAtTime(preset.windLevel * 0.08, now, 0.08);
    this.masterFilter?.frequency.setTargetAtTime(preset.brightnessHz, now, 0.1);
    this.reverbFeedback?.gain.setTargetAtTime(Math.min(0.68, preset.reverbDecaySec / 5.5), now, 0.1);
  }

  public strikeResonanceBell(hz: number): void {
    if (!this.ctx || !this.bellGain) return;
    const now = this.ctx.currentTime;
    const partials = [1, 2.756, 5.404]; // Cast-bronze bell modal ratios
    partials.forEach((ratio, idx) => {
      if (!this.ctx || !this.bellGain) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz * ratio, now);
      const peak = idx === 0 ? 0.45 : idx === 1 ? 0.18 : 0.07;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(peak, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + (2.4 / (idx + 1)));
      osc.connect(env);
      env.connect(this.bellGain);
      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  private triggerStep(): void {
    if (!this.ctx || !this.currentPreset) return;
    const preset = this.currentPreset;
    const step = this.stepIndex++;

    // Modal bell phrase on evocative frontier beats
    if (step % 4 === 0 || step % 7 === 0) {
      const interval = preset.scaleIntervals[(step * 3 + 1) % preset.scaleIntervals.length];
      const freq = preset.rootHz * 2 * Math.pow(2, interval / 12);
      this.strikeResonanceBell(freq);
    }

    // Frame-drum pulse
    if (this.drumGain && (step % 2 === 0 || step % 8 === 5)) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      const accent = step % 4 === 0 ? 1.0 : 0.55;
      osc.frequency.setValueAtTime(step % 4 === 0 ? 112 : 148, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.45 * accent, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(env);
      env.connect(this.drumGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  public stop(): void {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    this.droneOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        // already stopped
      }
    });
    this.droneOscs = [];
    if (this.windSource) {
      try {
        this.windSource.stop();
      } catch {
        // already stopped
      }
      this.windSource = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.playing = false;
  }
}
