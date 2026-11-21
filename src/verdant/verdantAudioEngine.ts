import type { WorldRegion } from '../game/worldData';
import {
  getCanonicalSoundtrackForTheme,
  getCombatTrackForTheme,
  getPlaylistForRealm,
  scaleDegreeToHz,
  SOUNDTRACK_CATALOG,
  type AcousticFoleyProfile,
  type MusicalMeterId,
  type RealmSoundtrackSpec,
} from './verdantScoreSchema';
import { resolvePublicUrl } from '../utils/publicUrl';

export interface SpatialAudioMetrics {
  pan: number;
  gain: number;
  itdMicros: number;
  pavilionContact?: boolean;
  attendedSlot?: number;
}

export interface VerdantAudioState {
  initialized: boolean;
  muted: boolean;
  hasMonotonousDrone: false;
  reverbActive: boolean;
  workletActive: boolean;
  scoreId: string;
  scoreTitle: string;
  composerNote: string;
  mode: string;
  meter: MusicalMeterId;
  bpm: number;
  foleyProfile: AcousticFoleyProfile;
  combatIntensity: number;
  combatThemeActive: boolean;
  activePhraseBar: number;
  section: 'A' | 'B' | 'C';
  trackIndex: number;
  playlistLength: number;
  playlistTitles: string[];
  catalogLength: number;
  voices: string[];
}

/**
 * Create a realistic algorithmic Stereo Hall Impulse Response for Web Audio ConvolverNode.
 * Produces rich early reflections + smooth diffuse exponential late reverb tail so every
 * plucked harp, bowed string, flute, horn, dulcimer, reed, pizzicato bass, and modal bell breathes in 3D space.
 */
function createConcertHallImpulse(
  ctx: AudioContext,
  decaySec: number,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(1.2, Math.min(5.5, decaySec))));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      const damp = 0.25 + (1 - t) * 0.45;
      lp = lp + (white - lp) * damp;
      const env = Math.pow(1 - t, 2.65);
      data[i] = lp * env * 0.42;
    }
    const taps = ch === 0 ? [0.011, 0.023, 0.039, 0.061] : [0.014, 0.029, 0.044, 0.067];
    for (let k = 0; k < taps.length; k++) {
      const idx = Math.min(length - 1, Math.floor(taps[k] * rate));
      data[idx] += (k % 2 === 0 ? 1 : -1) * (0.28 / (k + 1));
    }
  }
  return impulse;
}

/**
 * Verdant High-Definition Adaptive 9-Voice Multi-Song Orchestral & Spatial Audio Engine.
 *
 * Features:
 * 1. Real Verdant Engine AudioWorklet (`verdant-modal-processor`)
 * 2. Algorithmic Stereo Hall Convolution Reverb (`ConvolverNode`)
 * 3. Nine expressive orchestral & folk voices:
 *    - Plucked Celtic Harp / Lute
 *    - Bowed Cello & Viola Ensemble
 *    - Breathy Highland Wooden Flute
 *    - Noble French Horn Brass
 *    - Bodhran Frame Drum & Shaker Percussion
 *    - Verdant Modal Worklet Bells
 *    - Hammered Dulcimer / Acoustic Mandolin
 *    - Pizzicato Contrabass & Cello Pluck
 *    - Warm Chamber Reed (Oboe / Clarinet)
 * 4. Multi-song realm suites (20 curated songs across 4/4, 3/4 waltzes, 6/8 jigs, and dynamic battle anthems)
 *    with automatic A/B/C progression, seamless playlist rotation, and manual jukebox controls.
 */
export class VerdantSpatialAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private modalNode: AudioWorkletNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private foleySource: AudioBufferSourceNode | null = null;
  private foleyFilter: BiquadFilterNode | null = null;
  private foleyLfo: OscillatorNode | null = null;
  private foleyGain: GainNode | null = null;

  private playlist: RealmSoundtrackSpec[] = getPlaylistForRealm('citadel-highlands', false);
  private trackIndex = 0;
  private activeScore: RealmSoundtrackSpec =
    this.playlist[0] ??
    getCanonicalSoundtrackForTheme(
      'citadel-highlands',
      false,
      'vaelmor',
      'The Shattered Meridian of Vaelmor',
      7777,
    );
  private explorationScoreBeforeCombat: RealmSoundtrackSpec | null = null;
  private combatThemeActive = false;
  private calmBarsCount = 0;
  private trackChangeListener: ((state: VerdantAudioState) => void) | null = null;

  private muted = false;
  private initialized = false;
  private initializing = false;
  private schedulerTimer: number | null = null;
  private stepIndex = 0;
  private barIndex = 0;
  private nextStepTime = 0;
  private combatIntensity = 0;
  private targetCombatIntensity = 0;
  private lastFootstepTime = 0;

  public async ensureStarted(wasmParams?: {
    modeNumers?: number[];
    modeDenom?: number;
    rt60Ms?: number;
    fundamentalHz?: number;
  }): Promise<void> {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }
      return;
    }
    if (this.initializing) return;
    this.initializing = true;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master dynamics compressor prevents any clipping during intense orchestral + boss moments
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.008;
      comp.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.62;
      comp.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.72;
      this.musicBus.connect(comp);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(comp);

      // Stereo Concert Hall / Stone Vault Convolution Reverb
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = createConcertHallImpulse(this.ctx, this.activeScore.reverbDecaySec);
      this.reverbWetGain = this.ctx.createGain();
      this.reverbWetGain.gain.value = 0.36;
      this.reverbNode.connect(this.reverbWetGain);
      this.reverbWetGain.connect(comp);

      this.musicBus.connect(this.reverbNode);
      this.sfxBus.connect(this.reverbNode);

      // Shared 3-second pink noise buffer for breath chiff, percussion brushes, wind & water foley
      this.noiseBuffer = this.createPinkNoiseBuffer(this.ctx, 3.0);

      // Load real Verdant Engine AudioWorklet (`verdant-modal-processor`)
      if (this.ctx.audioWorklet) {
        try {
          await this.ctx.audioWorklet.addModule(resolvePublicUrl('/verdant/audio-worklet.mjs'));
          this.modalNode = new AudioWorkletNode(this.ctx, 'verdant-modal-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            processorOptions: {
              modeNumers: wasmParams?.modeNumers ?? this.activeScore.workletTuning.modeNumers,
              modeDenom: wasmParams?.modeDenom ?? this.activeScore.workletTuning.modeDenom,
              rt60Ms: wasmParams?.rt60Ms ?? this.activeScore.workletTuning.rt60Ms,
              fundamentalHz: wasmParams?.fundamentalHz ?? this.activeScore.workletTuning.fundamentalHz,
            },
          });
          const modalGain = this.ctx.createGain();
          modalGain.gain.value = 0.48;
          this.modalNode.connect(modalGain);
          modalGain.connect(comp);
        } catch {
          this.modalNode = null;
        }
      }

      // Gentle modulated atmospheric wind/water foley bed (NO pitched drone!)
      this.startAtmosphericFoleyBed();

      // Launch expressive multi-voice orchestral score scheduler
      this.stepIndex = 0;
      this.barIndex = 0;
      this.nextStepTime = this.ctx.currentTime + 0.12;
      this.schedulerTimer = window.setInterval(() => this.scheduleOrchestralLookahead(), 75);

      this.initialized = true;
    } catch {
      // AudioContext unavailable in restricted headless context
    } finally {
      this.initializing = false;
    }
  }

  private createPinkNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const out = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    return buf;
  }

  private startAtmosphericFoleyBed(): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.4;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);

    src.start();
    lfo.start();

    this.foleySource = src;
    this.foleyFilter = filter;
    this.foleyLfo = lfo;
    this.foleyGain = gain;
    this.applyFoleyProfile(this.activeScore.foleyProfile);
  }

  private applyFoleyProfile(profile: AcousticFoleyProfile): void {
    if (!this.ctx || !this.foleyFilter || !this.foleyGain || !this.foleyLfo) return;
    const now = this.ctx.currentTime;
    const cfg: Record<AcousticFoleyProfile, { freq: number; q: number; lfoHz: number; gain: number }> = {
      'highland-wind': { freq: 440, q: 1.5, lfoHz: 0.12, gain: 0.048 },
      'aqueduct-water': { freq: 720, q: 0.9, lfoHz: 0.24, gain: 0.058 },
      'caldera-forge': { freq: 260, q: 1.8, lfoHz: 0.18, gain: 0.052 },
      'ocean-surf': { freq: 380, q: 0.85, lfoHz: 0.09, gain: 0.064 },
      'steppe-chimes': { freq: 520, q: 1.4, lfoHz: 0.15, gain: 0.044 },
      'glacial-aurora': { freq: 860, q: 2.2, lfoHz: 0.08, gain: 0.042 },
      'dungeon-cavern': { freq: 210, q: 2.4, lfoHz: 0.07, gain: 0.050 },
    };
    const c = cfg[profile] ?? cfg['highland-wind'];
    this.foleyFilter.frequency.setTargetAtTime(c.freq, now, 0.8);
    this.foleyFilter.Q.setTargetAtTime(c.q, now, 0.8);
    this.foleyLfo.frequency.setTargetAtTime(c.lfoHz, now, 0.8);
    this.foleyGain.gain.setTargetAtTime(c.gain, now, 0.8);
  }

  public setOnTrackChange(listener: ((state: VerdantAudioState) => void) | null): void {
    this.trackChangeListener = listener;
  }

  private emitTrackChange(): void {
    this.trackChangeListener?.(this.getAudioState());
  }

  private applyActiveScore(score: RealmSoundtrackSpec, playChime = true): void {
    this.activeScore = score;
    this.barIndex = 0;
    this.stepIndex = 0;
    if (this.ctx) {
      this.applyFoleyProfile(score.foleyProfile);
      if (this.reverbNode && this.reverbWetGain) {
        this.reverbNode.buffer = createConcertHallImpulse(this.ctx, score.reverbDecaySec);
        this.reverbWetGain.gain.setTargetAtTime(
          score.isDungeon ? 0.46 : 0.34,
          this.ctx.currentTime,
          0.45,
        );
      }
      if (playChime && this.modalNode && !this.muted) {
        this.modalNode.port.postMessage({ kind: 'strike', modeIndex: score.isDungeon ? 0 : 2 });
      }
      if (playChime && !this.muted && this.musicBus) {
        const now = this.ctx.currentTime;
        const rootHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, 0);
        const fifthHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, 4);
        this.playPluckedHarp(now + 0.02, rootHz, 1.3, 0.06, -0.25);
        this.playPluckedHarp(now + 0.12, fifthHz, 1.5, 0.055, 0.25);
      }
    }
    this.emitTrackChange();
  }

  public setSoundtrack(score: RealmSoundtrackSpec): void {
    this.combatThemeActive = false;
    this.explorationScoreBeforeCombat = null;
    const existingIdx = this.playlist.findIndex((t) => t.id === score.id || t.title === score.title);
    if (existingIdx >= 0) {
      this.playlist[existingIdx] = score;
      this.trackIndex = existingIdx;
    } else {
      this.playlist = [score, ...this.playlist];
      this.trackIndex = 0;
    }
    this.applyActiveScore(score, true);
  }

  public setRealmPlaylist(tracks: RealmSoundtrackSpec[]): void {
    if (tracks.length === 0) return;
    this.playlist = tracks.slice();
    this.trackIndex = 0;
    this.combatThemeActive = false;
    this.explorationScoreBeforeCombat = null;
    this.calmBarsCount = 0;
    this.applyActiveScore(this.playlist[0], true);
  }

  public nextTrack(): VerdantAudioState {
    if (this.playlist.length === 0) return this.getAudioState();
    this.combatThemeActive = false;
    this.explorationScoreBeforeCombat = null;
    this.trackIndex = (this.trackIndex + 1) % this.playlist.length;
    this.applyActiveScore(this.playlist[this.trackIndex], true);
    return this.getAudioState();
  }

  public prevTrack(): VerdantAudioState {
    if (this.playlist.length === 0) return this.getAudioState();
    this.combatThemeActive = false;
    this.explorationScoreBeforeCombat = null;
    this.trackIndex = (this.trackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.applyActiveScore(this.playlist[this.trackIndex], true);
    return this.getAudioState();
  }

  public selectTrack(trackIdOrSpec: string | RealmSoundtrackSpec): VerdantAudioState {
    const resolved =
      typeof trackIdOrSpec === 'string'
        ? this.playlist.find((t) => t.id === trackIdOrSpec) ??
          SOUNDTRACK_CATALOG.find((t) => t.id === trackIdOrSpec)
        : trackIdOrSpec;
    if (!resolved) return this.getAudioState();

    this.combatThemeActive = resolved.category === 'combat';
    this.explorationScoreBeforeCombat = null;
    const idx = this.playlist.findIndex((t) => t.id === resolved.id);
    if (idx >= 0) {
      this.trackIndex = idx;
    } else {
      this.playlist = [...this.playlist, resolved];
      this.trackIndex = this.playlist.length - 1;
    }
    this.applyActiveScore(resolved, true);
    return this.getAudioState();
  }

  public getPlaylist(): RealmSoundtrackSpec[] {
    return this.playlist.slice();
  }

  public setCombatIntensity(intensity: number): void {
    this.targetCombatIntensity = Math.max(0, Math.min(1, intensity));
  }

  public getAudioState(): VerdantAudioState {
    const section: 'A' | 'B' | 'C' = this.barIndex >= 16 ? 'C' : this.barIndex >= 8 ? 'B' : 'A';
    return {
      initialized: this.initialized,
      muted: this.muted,
      hasMonotonousDrone: false,
      reverbActive: Boolean(this.reverbNode),
      workletActive: Boolean(this.modalNode),
      scoreId: this.activeScore.id,
      scoreTitle: this.activeScore.title,
      composerNote: this.activeScore.composerNote,
      mode: this.activeScore.mode,
      meter: this.activeScore.meter ?? '4/4',
      bpm: this.activeScore.bpm,
      foleyProfile: this.activeScore.foleyProfile,
      combatIntensity: Number(this.combatIntensity.toFixed(2)),
      combatThemeActive: this.combatThemeActive,
      activePhraseBar: this.barIndex % 8,
      section,
      trackIndex: this.trackIndex,
      playlistLength: this.playlist.length,
      playlistTitles: this.playlist.map((t) => t.title),
      catalogLength: SOUNDTRACK_CATALOG.length,
      voices: [
        'Plucked Celtic Harp / Lute',
        'Bowed Cello & Viola Ensemble',
        'Breathy Highland Wooden Flute',
        'Noble French Horn Brass',
        'Bodhran Frame Drum Percussion',
        'Verdant Modal Worklet Bells',
        'Hammered Dulcimer / Mandolin',
        'Pizzicato Contrabass Pluck',
        'Warm Chamber Reed (Oboe/Clarinet)',
      ],
    };
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.62, this.ctx.currentTime, 0.06);
    }
    return this.muted;
  }

  public updateSpatialMetrics(metrics: SpatialAudioMetrics): void {
    if (!this.modalNode || this.muted) return;
    this.modalNode.port.postMessage({
      kind: 'spatial',
      pan: metrics.pan,
      gain: metrics.gain,
      itdMicros: metrics.itdMicros,
      pavilionContact: Boolean(metrics.pavilionContact),
      attendedSlot: metrics.attendedSlot ?? 0,
    });
  }

  public setRegionMood(mood: WorldRegion['ambientMood']): void {
    const foleyMap: Record<WorldRegion['ambientMood'], AcousticFoleyProfile> = {
      causeway: 'highland-wind',
      ironwood: 'aqueduct-water',
      foundry: 'caldera-forge',
      coast: 'ocean-surf',
    };
    if (!this.activeScore.isDungeon) {
      this.applyFoleyProfile(foleyMap[mood] ?? this.activeScore.foleyProfile);
    }
    if (this.modalNode && !this.muted) {
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: mood === 'foundry' ? 0 : 1 });
    }
  }

  // ---------------------------------------------------------------------------
  // Adaptive 9-Voice Multi-Song Orchestral Sequencer (4/4, 3/4, 6/8 + A/B/C)
  // ---------------------------------------------------------------------------
  private scheduleOrchestralLookahead(): void {
    if (!this.ctx || !this.musicBus || this.muted || this.ctx.state !== 'running') return;

    this.combatIntensity += (this.targetCombatIntensity - this.combatIntensity) * 0.14;

    const meter = this.activeScore.meter ?? '4/4';
    const stepsPerBar = meter === '4/4' ? 8 : 6;
    const effectiveBpm =
      this.activeScore.bpm * (this.combatThemeActive ? 1.0 : 1 + this.combatIntensity * 0.1);
    const eighthSec = 60 / effectiveBpm / 2;
    const lookahead = 0.22;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.nextStepTime, this.stepIndex, this.barIndex, stepsPerBar, eighthSec);
      this.nextStepTime += eighthSec;
      this.stepIndex = (this.stepIndex + 1) % stepsPerBar;
      if (this.stepIndex === 0) {
        this.barIndex += 1;

        // Dynamic combat anthem shift when heavy battle engages
        if (!this.combatThemeActive && this.combatIntensity > 0.65 && this.activeScore.category !== 'combat') {
          this.explorationScoreBeforeCombat = this.activeScore;
          this.combatThemeActive = true;
          this.calmBarsCount = 0;
          const battleTrack = getCombatTrackForTheme(this.activeScore.isDungeon);
          this.applyActiveScore(battleTrack, false);
          return;
        }
        if (this.combatThemeActive && this.explorationScoreBeforeCombat) {
          if (this.combatIntensity < 0.24) {
            this.calmBarsCount += 1;
            if (this.calmBarsCount >= 4) {
              const resumeTrack = this.explorationScoreBeforeCombat;
              this.explorationScoreBeforeCombat = null;
              this.combatThemeActive = false;
              this.calmBarsCount = 0;
              this.applyActiveScore(resumeTrack, false);
              return;
            }
          } else {
            this.calmBarsCount = 0;
          }
        }

        // Auto-rotate to next song in the realm's suite after 24 bars (A -> B -> C full movement!)
        if (this.barIndex >= 24) {
          this.barIndex = 0;
          if (!this.combatThemeActive && this.playlist.length > 1) {
            this.trackIndex = (this.trackIndex + 1) % this.playlist.length;
            this.applyActiveScore(this.playlist[this.trackIndex], false);
            return;
          }
        }
      }
    }
  }

  private scheduleStep(
    time: number,
    stepInBar: number,
    bar: number,
    stepsPerBar: number,
    eighthSec: number,
  ): void {
    const score = this.activeScore;
    const inst = score.instrumentation;
    const meter = score.meter ?? '4/4';
    const chordDeg = score.chordProgression[bar % score.chordProgression.length] ?? 0;
    const phraseStep = (bar % 2) * stepsPerBar + stepInBar;
    const section: 'A' | 'B' | 'C' = bar >= 16 ? 'C' : bar >= 8 ? 'B' : 'A';
    const combat = this.combatIntensity;

    const dulcimerAmt = inst.dulcimer ?? 0.55;
    const pizzicatoAmt = inst.pizzicato ?? 0.62;
    const reedAmt = inst.reed ?? 0.58;

    // 1. Bowed Cello & Viola Ensemble (breathing harmonic phrases, never a static drone)
    if (stepInBar === 0 && inst.strings > 0.05) {
      const rootHz = scaleDegreeToHz(score.rootMidi, score.mode, chordDeg);
      const fifthHz = scaleDegreeToHz(score.rootMidi, score.mode, chordDeg + 4);
      const colorInterval = section === 'C' ? 9 : section === 'B' ? 7 : 2;
      const colorHz = scaleDegreeToHz(score.rootMidi, score.mode, chordDeg + colorInterval);
      const dur = eighthSec * (stepsPerBar - 0.55);
      const vol = 0.052 * inst.strings * (0.84 + combat * 0.22);
      this.playBowedStringVoice(time, rootHz, dur, vol, -0.35);
      this.playBowedStringVoice(time + 0.04, fifthHz, dur * 0.94, vol * 0.72, 0.34);
      if (bar % 2 === 0 || section !== 'A' || combat > 0.35) {
        this.playBowedStringVoice(time + 0.08, colorHz, dur * 0.88, vol * 0.54, 0.06);
      }
    }

    // 2. Pizzicato Contrabass & Cello Walking Pulse (anchors 3/4 waltzes, 6/8 jigs, and 4/4 marches!)
    if (pizzicatoAmt > 0.1) {
      const bassPattern =
        score.bassPattern ?? (stepsPerBar === 6 ? [0, null, 4, null, 2, null] : [0, null, null, 4, 0, null, 2, null]);
      const bassStep = bassPattern[stepInBar % bassPattern.length];
      if (bassStep !== null && bassStep !== undefined) {
        const bassHz = scaleDegreeToHz(score.rootMidi - 12, score.mode, chordDeg + bassStep);
        const vel = (stepInBar === 0 ? 0.12 : 0.085) * pizzicatoAmt;
        this.playPizzicatoBass(time, bassHz, eighthSec * 2.4, vel, -0.14);
      }
    }

    // 3. Plucked Harp / Lute Arpeggio
    const arpDeg = score.harpArpeggio[phraseStep % score.harpArpeggio.length];
    if (arpDeg !== null && arpDeg !== undefined && inst.harp > 0.05) {
      const skipGentle = section === 'A' && combat < 0.2 && stepInBar === stepsPerBar - 1;
      if (!skipGentle) {
        const deg = chordDeg + arpDeg + (section === 'C' && stepInBar % 2 === 1 ? 2 : 0);
        const hz = scaleDegreeToHz(score.rootMidi + 12, score.mode, deg);
        const pan = -0.55 + ((stepInBar % 4) / 3) * 1.1;
        const accentStep = meter === '6/8' ? stepInBar === 0 || stepInBar === 3 : stepInBar === 0 || stepInBar === 4;
        const vel = (accentStep ? 0.082 : 0.052) * inst.harp;
        this.playPluckedHarp(time, hz, eighthSec * 3.6, vel, pan);
      }
    }

    // 4. Hammered Dulcimer / Acoustic Mandolin Shimmer Counter-Voice
    if (dulcimerAmt > 0.15 && (section !== 'A' || bar >= 4 || score.category === 'voyage' || score.category === 'combat')) {
      const dulcPattern =
        score.dulcimerPattern ?? (stepsPerBar === 6 ? [7, null, 9, 11, null, 9] : [null, 7, null, 11, 9, null, 7, 4]);
      const dDeg = dulcPattern[stepInBar % dulcPattern.length];
      if (dDeg !== null && dDeg !== undefined) {
        const hz = scaleDegreeToHz(score.rootMidi + 12, score.mode, chordDeg + dDeg);
        const pan = stepInBar % 2 === 0 ? 0.36 : -0.32;
        this.playHammeredDulcimer(time, hz, eighthSec * 2.2, 0.048 * dulcimerAmt, pan);
      }
    }

    // 5. Evolving 3-Section Lead Voices: Wooden Flute (A), Chamber Reed & Horn (B), Full Soaring Ensemble (C)
    const activeMotif =
      section === 'C' && score.sectionCMelody
        ? score.sectionCMelody
        : section === 'B' && score.sectionBMelody
          ? score.sectionBMelody
          : score.melodyMotif;

    let accum = 0;
    for (const note of activeMotif) {
      if (accum === phraseStep && note.degree !== null) {
        const barShift =
          section === 'C' && !score.sectionCMelody
            ? 3
            : section === 'B' && !score.sectionBMelody
              ? 2
              : bar % 8 >= 4
                ? 1
                : 0;
        const deg = note.degree + barShift;
        const dur = note.lengthSteps * eighthSec * 0.94;

        if (section === 'A') {
          if (inst.flute > 0.1) {
            const fluteHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, deg);
            this.playWoodenFlute(time, fluteHz, dur, 0.072 * note.velocity * inst.flute, -0.22);
          }
          if (bar >= 4 && reedAmt > 0.4 && score.category === 'sanctuary') {
            const reedHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, deg - 2);
            this.playChamberReed(time, reedHz, dur, 0.045 * note.velocity * reedAmt, 0.24);
          }
        } else if (section === 'B') {
          if (reedAmt > 0.2) {
            const reedHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, deg);
            this.playChamberReed(time, reedHz, dur, 0.068 * note.velocity * reedAmt, 0.2);
          }
          if ((inst.horn > 0.3 || combat > 0.4) && bar % 2 === 0) {
            const hornHz = scaleDegreeToHz(score.rootMidi, score.mode, deg);
            this.playFrenchHorn(time, hornHz, dur, 0.076 * note.velocity * inst.horn, -0.18);
          }
        } else {
          // Section C climax: heroic French horn + soaring wooden flute octave doubling
          if (inst.horn > 0.15) {
            const hornHz = scaleDegreeToHz(score.rootMidi, score.mode, deg);
            this.playFrenchHorn(
              time,
              hornHz,
              dur,
              0.084 * note.velocity * inst.horn * (0.9 + combat * 0.3),
              0.18,
            );
          }
          if (inst.flute > 0.15) {
            const fluteHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, deg);
            this.playWoodenFlute(time, fluteHz, dur, 0.068 * note.velocity * inst.flute, -0.24);
          }
        }
        break;
      }
      accum += note.lengthSteps;
    }

    // 6. Meter-Aware Bodhran Frame Drum & Brush Shaker Percussion
    const percLevel = inst.percussion * (score.isDungeon || score.category === 'combat' ? 0.72 : 0.38) + combat * 0.6;
    if (percLevel > 0.16) {
      const hitDownbeat = stepInBar === 0;
      const hitMid =
        meter === '6/8'
          ? stepInBar === 3
          : meter === '3/4'
            ? stepInBar === 4 && (section !== 'A' || combat > 0.3)
            : stepInBar === 4 && (section !== 'A' || combat > 0.25);
      const hitSyncopated = combat > 0.35 && stepInBar === 3;
      if (hitDownbeat || hitMid || hitSyncopated) {
        const accent = hitDownbeat ? 1.0 : 0.72;
        this.playFrameDrum(time, 72 + (hitDownbeat ? 0 : 20), 0.11 * percLevel * accent);
      }
      const shakerStep =
        meter === '3/4'
          ? stepInBar === 2 || stepInBar === 4
          : meter === '6/8'
            ? stepInBar === 2 || stepInBar === 5
            : stepInBar === 2 || stepInBar === 6;
      if (shakerStep || (combat > 0.45 && stepInBar % 2 === 1)) {
        this.playBrushShaker(time, 0.036 * percLevel);
      }
    }

    // 7. Verdant Modal Bar Harmonic Bell Accent
    if (stepInBar === 0 && bar % 4 === 0 && inst.modalBells > 0.2) {
      const bellHz = scaleDegreeToHz(score.rootMidi + 24, score.mode, chordDeg + 4);
      this.playPluckedHarp(time, bellHz, eighthSec * 5.2, 0.042 * inst.modalBells, 0.38);
      if (this.modalNode) {
        this.modalNode.port.postMessage({ kind: 'strike', modeIndex: (bar / 4) % 4 });
      }
    }

    // 8. Bespoke Generative Biome Soundscape Events (zero monotonous drone — organic acoustic accents)
    if (stepInBar === Math.min(stepsPerBar - 1, 5) && bar % 3 === 1) {
      if (score.foleyProfile === 'dungeon-cavern' || score.foleyProfile === 'aqueduct-water') {
        this.playWaterDrop(time, 680 + (bar % 5) * 140);
      } else if (score.foleyProfile === 'steppe-chimes' || score.foleyProfile === 'glacial-aurora') {
        const chimeHz = scaleDegreeToHz(score.rootMidi + 24, score.mode, (bar * 3) % 7);
        this.playHammeredDulcimer(time, chimeHz, 1.5, 0.034, -0.45);
      } else if (score.foleyProfile === 'caldera-forge') {
        this.playEmberCrackle(time, 0.042);
      } else if (score.foleyProfile === 'ocean-surf') {
        this.playSurfWaveSwell(time, 2.2, 0.046);
      } else if (score.foleyProfile === 'highland-wind') {
        const windHz = scaleDegreeToHz(score.rootMidi + 12, score.mode, 4);
        this.playAeolianGust(time, windHz, 1.8, 0.026);
      }
    }
    if (score.foleyProfile === 'caldera-forge' && stepInBar === 2 && bar % 2 === 0) {
      this.playEmberCrackle(time + eighthSec * 0.35, 0.028);
    }
  }

  // ---------------------------------------------------------------------------
  // Physical-Model & Expressive Orchestral Voices
  // ---------------------------------------------------------------------------
  private playPluckedHarp(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(hz, time);
    osc2.frequency.setValueAtTime(hz * 2.0, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5800, hz * 7.5), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, hz * 1.4), time + dur * 0.75);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.linearRampToValueAtTime(gainPeak, time + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const g2 = this.ctx.createGain();
    g2.gain.value = 0.28;

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(g1);
    g1.connect(panner);
    panner.connect(this.musicBus);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.05);
    osc2.stop(time + dur + 0.05);
  }

  private playBowedStringVoice(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(hz * 0.997, time);
    oscB.frequency.setValueAtTime(hz * 1.003, time);

    // Subtle expressive vibrato LFO
    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.setValueAtTime(4.9, time);
    vibGain.gain.setValueAtTime(hz * 0.0055, time);
    vib.connect(vibGain);
    vibGain.connect(oscA.frequency);
    vibGain.connect(oscB.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(hz * 1.8, time);
    filter.frequency.linearRampToValueAtTime(Math.min(2600, hz * 4.2), time + dur * 0.42);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, hz * 1.6), time + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + Math.min(0.65, dur * 0.32));
    env.gain.setValueAtTime(gainPeak * 0.88, time + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    oscA.start(time);
    oscB.start(time);
    vib.start(time);
    oscA.stop(time + dur + 0.06);
    oscB.stop(time + dur + 0.06);
    vib.stop(time + dur + 0.06);
  }

  private playWoodenFlute(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    // Gentle grace-note scoop into pitch
    osc.frequency.setValueAtTime(hz * 0.975, time);
    osc.frequency.exponentialRampToValueAtTime(hz, time + 0.065);

    const overtone = this.ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(hz * 2, time);
    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.14;

    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.setValueAtTime(5.4, time);
    vibGain.gain.setValueAtTime(0.0001, time);
    vibGain.gain.linearRampToValueAtTime(hz * 0.008, time + 0.25);
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.09);
    env.gain.setValueAtTime(gainPeak * 0.85, time + Math.max(0.12, dur - 0.16));
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    // Subtle wooden breath chiff transient at note onset
    if (this.noiseBuffer) {
      const chiff = this.ctx.createBufferSource();
      chiff.buffer = this.noiseBuffer;
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.setValueAtTime(hz * 2.2, time);
      cf.Q.value = 3.5;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.0001, time);
      cg.gain.linearRampToValueAtTime(gainPeak * 0.42, time + 0.025);
      cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
      chiff.connect(cf);
      cf.connect(cg);
      cg.connect(panner);
      chiff.start(time);
      chiff.stop(time + 0.14);
    }

    osc.start(time);
    overtone.start(time);
    vib.start(time);
    osc.stop(time + dur + 0.05);
    overtone.stop(time + dur + 0.05);
    vib.stop(time + dur + 0.05);
  }

  private playFrenchHorn(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(hz * 1.4, time);
    filter.frequency.linearRampToValueAtTime(Math.min(1800, hz * 4.5), time + Math.min(0.28, dur * 0.35));
    filter.frequency.exponentialRampToValueAtTime(hz * 1.5, time + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.14);
    env.gain.setValueAtTime(gainPeak * 0.82, time + Math.max(0.18, dur - 0.18));
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playHammeredDulcimer(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    // Double-course slightly detuned struck steel strings with sparkling overtone ring
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const chime = this.ctx.createOscillator();
    oscA.type = 'triangle';
    oscB.type = 'triangle';
    chime.type = 'sine';
    oscA.frequency.setValueAtTime(hz * 0.9985, time);
    oscB.frequency.setValueAtTime(hz * 1.0018, time);
    chime.frequency.setValueAtTime(hz * 3.0, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(Math.min(7200, hz * 9.5), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(480, hz * 1.8), time + dur * 0.85);

    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.24, time);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.45, dur * 0.5));

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    oscA.connect(filter);
    oscB.connect(filter);
    chime.connect(chimeGain);
    chimeGain.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    oscA.start(time);
    oscB.start(time);
    chime.start(time);
    oscA.stop(time + dur + 0.05);
    oscB.stop(time + dur + 0.05);
    chime.stop(time + dur + 0.05);
  }

  private playPizzicatoBass(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    // Natural acoustic finger-pluck pitch drop
    osc.frequency.setValueAtTime(hz * 1.028, time);
    osc.frequency.exponentialRampToValueAtTime(hz, time + 0.032);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(hz, time);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(1100, hz * 5.2), time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(110, hz * 1.45), time + Math.min(0.32, dur));

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.65, dur));

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(lp);
    sub.connect(lp);
    lp.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    osc.start(time);
    sub.start(time);
    osc.stop(time + Math.min(0.7, dur) + 0.04);
    sub.stop(time + Math.min(0.7, dur) + 0.04);
  }

  private playChamberReed(
    time: number,
    hz: number,
    dur: number,
    gainPeak: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    // Warm double-reed / oboe-clarinet woodwind timbre using formant bandpass over sawtooth
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, time);

    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.setValueAtTime(5.1, time);
    vibGain.gain.setValueAtTime(0.0001, time);
    vibGain.gain.linearRampToValueAtTime(hz * 0.0065, time + 0.22);
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(Math.min(2200, Math.max(680, hz * 2.4)), time);
    formant.Q.value = 1.9;

    const warmth = this.ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.setValueAtTime(Math.min(2800, hz * 4.5), time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.07);
    env.gain.setValueAtTime(gainPeak * 0.84, time + Math.max(0.11, dur - 0.14));
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(formant);
    formant.connect(warmth);
    warmth.connect(env);
    env.connect(panner);
    panner.connect(this.musicBus);

    osc.start(time);
    vib.start(time);
    osc.stop(time + dur + 0.05);
    vib.stop(time + dur + 0.05);
  }

  private playFrameDrum(time: number, startHz: number, gainPeak: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz * 1.65, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(42, startHz * 0.72), time + 0.16);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(env);
    env.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private playBrushShaker(time: number, gainPeak: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3600, time);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.065);
    src.connect(hp);
    hp.connect(env);
    env.connect(this.musicBus);
    src.start(time, Math.random() * 1.2, 0.08);
  }

  private playWaterDrop(time: number, hz: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz * 0.72, time);
    osc.frequency.exponentialRampToValueAtTime(hz * 1.45, time + 0.085);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.032, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    osc.connect(env);
    env.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.13);
  }

  private playEmberCrackle(time: number, gainPeak: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900 + Math.random() * 1400, time);
    bp.Q.value = 3.2;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);
    const pan = this.ctx.createStereoPanner();
    pan.pan.setValueAtTime((Math.random() - 0.5) * 1.1, time);
    src.connect(bp);
    bp.connect(env);
    env.connect(pan);
    pan.connect(this.musicBus);
    src.start(time, Math.random() * 1.4, 0.06);
  }

  private playSurfWaveSwell(time: number, dur: number, gainPeak: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, time);
    lp.frequency.linearRampToValueAtTime(760, time + dur * 0.45);
    lp.frequency.exponentialRampToValueAtTime(180, time + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + dur * 0.42);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(lp);
    lp.connect(env);
    env.connect(this.musicBus);
    src.start(time, Math.random() * 0.5, dur + 0.05);
  }

  private playAeolianGust(time: number, hz: number, dur: number, gainPeak: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz * 0.96, time);
    osc.frequency.linearRampToValueAtTime(hz * 1.02, time + dur * 0.5);
    osc.frequency.linearRampToValueAtTime(hz * 0.98, time + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + dur * 0.48);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const pan = this.ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.38, time);
    pan.pan.linearRampToValueAtTime(0.38, time + dur);
    osc.connect(env);
    env.connect(pan);
    pan.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.04);
  }

  // ---------------------------------------------------------------------------
  // High-Definition Interactive Gameplay, Combat, Footstep & Portal Foley
  // ---------------------------------------------------------------------------
  public playFootstep(surface: 'stone' | 'earth' | 'water' = 'stone'): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootstepTime < 0.31) return;
    this.lastFootstepTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = surface === 'water' ? 1150 : surface === 'earth' ? 520 : 880;
    filter.Q.value = surface === 'stone' ? 2.4 : 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(now, Math.random() * 1.5, 0.09);
  }

  public playResonanceBell(hz = 174): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    if (this.modalNode) {
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 0 });
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 2 });
    }
    const now = this.ctx.currentTime;
    // Rich bronze bell partial series (fundamental, hum, minor third, fifth, nominal)
    const partials: Array<[number, number, number]> = [
      [1.0, 0.22, 2.6],
      [2.0, 0.12, 1.9],
      [2.4, 0.08, 1.5],
      [3.0, 0.06, 1.2],
      [4.2, 0.035, 0.85],
    ];
    for (const [ratio, amp, dur] of partials) {
      this.playSfxTone(now, hz * ratio, 'sine', dur, amp, hz * ratio * 0.998);
    }
  }

  public playSwing(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    // Crisp aerodynamic steel whoosh + subtle blade sing
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.2;
      bp.frequency.setValueAtTime(1400, now);
      bp.frequency.exponentialRampToValueAtTime(340, now + 0.15);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxBus);
      src.start(now, Math.random(), 0.18);
    }
    this.playSfxTone(now, 640, 'triangle', 0.11, 0.045, 290);
  }

  public playHit(heavy = false): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    if (this.modalNode) {
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: heavy ? 0 : 1 });
    }
    const now = this.ctx.currentTime;
    // Sub punch + metallic clang
    this.playSfxTone(now, heavy ? 115 : 155, 'sine', heavy ? 0.32 : 0.16, heavy ? 0.28 : 0.18, heavy ? 38 : 65);
    this.playSfxTone(now, heavy ? 412 : 680, 'triangle', heavy ? 0.24 : 0.12, 0.11, heavy ? 220 : 380);
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(heavy ? 1800 : 2800, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(heavy ? 0.24 : 0.16, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (heavy ? 0.18 : 0.09));
      src.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      src.start(now, Math.random(), 0.2);
    }
  }

  public playJump(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    this.playFootstep('earth');
    this.playSfxTone(now, 160, 'sine', 0.13, 0.06, 260);
  }

  public playHeal(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    if (this.modalNode) {
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 2 });
    }
    const now = this.ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((hz, i) => {
      this.playPluckedHarp(now + i * 0.075, hz, 1.1, 0.11, -0.3 + i * 0.2);
    });
  }

  public playPortalTravel(descendingDungeon = false): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = descendingDungeon
      ? [146.83, 174.61, 220.0, 293.66]
      : [220.0, 293.66, 329.63, 440.0, 587.33];
    chord.forEach((hz, i) => {
      this.playPluckedHarp(now + i * 0.065, hz, 2.2, 0.12, -0.5 + i * 0.25);
    });
    this.playResonanceBell(descendingDungeon ? 130.81 : 174.61);
  }

  public playTelegraph(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    this.playSfxTone(now, 240, 'triangle', 0.22, 0.08, 360);
  }

  public playDefeat(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    this.playFrenchHorn(now, 146.83, 0.75, 0.16, 0);
    this.playFrenchHorn(now + 0.45, 130.81, 1.1, 0.18, 0);
  }

  public playQuestComplete(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    if (this.modalNode) {
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 1 });
      this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 3 });
    }
    const now = this.ctx.currentTime;
    // Noble brass + sparkling harp cadence
    const fanfare = [293.66, 369.99, 440.0, 587.33];
    fanfare.forEach((hz, i) => {
      this.playPluckedHarp(now + i * 0.11, hz * 2, 1.5, 0.11, -0.4 + i * 0.26);
      this.playFrenchHorn(now + i * 0.11, hz, 0.85, 0.09, 0.15);
    });
  }

  public playPrologueSceneCue(
    preset: 'dusk-ferry' | 'pier-fracture' | 'vault-awakening' | 'workshop-oath' | 'causeway-dawn',
  ): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;

    if (preset === 'dusk-ferry') {
      // Warm evening cello fifth + distant Meridian bronze bell + water swell
      this.playBowedStringVoice(now, 146.83, 3.6, 0.08, -0.35);
      this.playBowedStringVoice(now + 0.12, 220.0, 3.4, 0.062, 0.35);
      this.playResonanceBell(174.61);
      this.playSurfWaveSwell(now + 0.15, 2.8, 0.042);
      return;
    }

    if (preset === 'pier-fracture') {
      // Rain wind wash + tense minor-second strings + somber low bell
      this.playBowedStringVoice(now, 130.81, 3.2, 0.075, -0.28);
      this.playBowedStringVoice(now + 0.08, 155.56, 3.0, 0.06, 0.28);
      this.playResonanceBell(130.81);
      return;
    }

    if (preset === 'vault-awakening') {
      // Deep subterranean horn fifth + cavernous rumble + modal vault ring
      this.playFrenchHorn(now, 98.0, 2.8, 0.13, -0.2);
      this.playFrenchHorn(now + 0.35, 146.83, 2.6, 0.11, 0.24);
      this.playSfxTone(now, 68, 'sine', 2.2, 0.22, 34);
      if (this.modalNode) {
        this.modalNode.port.postMessage({ kind: 'strike', modeIndex: 0 });
      }
      return;
    }

    if (preset === 'workshop-oath') {
      // Crisp anvil hammer ring + warm hearth crackle + rising Lydian harp motif
      this.playSfxTone(now, 880, 'triangle', 0.45, 0.12, 860);
      this.playSfxTone(now, 1760, 'sine', 0.38, 0.065, 1720);
      this.playEmberCrackle(now + 0.18, 0.055);
      const motif = [293.66, 369.99, 440.0, 554.37, 587.33];
      motif.forEach((hz, i) => {
        this.playPluckedHarp(now + 0.25 + i * 0.14, hz, 1.8, 0.095, -0.4 + i * 0.2);
      });
      return;
    }

    // causeway-dawn: Radiant sunrise swell resolving cleanly into live 3D Vaelmor
    this.playBowedStringVoice(now, 146.83, 3.8, 0.085, -0.4);
    this.playBowedStringVoice(now + 0.08, 220.0, 3.8, 0.075, 0.36);
    this.playBowedStringVoice(now + 0.16, 293.66, 3.6, 0.062, 0.0);
    const dawn = [293.66, 369.99, 440.0, 587.33, 739.99];
    dawn.forEach((hz, i) => {
      this.playHammeredDulcimer(now + 0.15 + i * 0.12, hz, 2.2, 0.072, -0.45 + i * 0.22);
    });
    this.playResonanceBell(293.66);
  }

  public playPrologueSeismicCrack(): void {
    void this.ensureStarted();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    // Deep sub-bass pitch drop + filtered rock-fracture burst + detuned bell overtone
    this.playSfxTone(now, 64, 'sine', 1.45, 0.34, 24);
    this.playSfxTone(now + 0.04, 118, 'triangle', 0.65, 0.18, 36);
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(140, now + 1.15);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.32, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      src.start(now, Math.random() * 0.8, 1.3);
    }
    this.playResonanceBell(123.47);
  }

  private playSfxTone(
    startTime: number,
    startHz: number,
    type: OscillatorType,
    durationSec: number,
    gainPeak: number,
    endHz?: number,
  ): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, startTime);
    if (endHz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), startTime + durationSec);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.03);
  }

  public dispose(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    try {
      this.foleySource?.stop();
      this.foleyLfo?.stop();
      this.modalNode?.disconnect();
      void this.ctx?.close();
    } catch {
      // ignore close errors
    }
    this.ctx = null;
    this.modalNode = null;
    this.reverbNode = null;
    this.initialized = false;
  }
}
