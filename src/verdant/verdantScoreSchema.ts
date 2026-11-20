export type MusicalModeId =
  | 'dorian'
  | 'lydian'
  | 'phrygian-dominant'
  | 'mixolydian'
  | 'aeolian'
  | 'harmonic-minor'
  | 'pentatonic-major';

export type AcousticFoleyProfile =
  | 'highland-wind'
  | 'aqueduct-water'
  | 'caldera-forge'
  | 'ocean-surf'
  | 'steppe-chimes'
  | 'glacial-aurora'
  | 'dungeon-cavern';

export type MusicalMeterId = '4/4' | '3/4' | '6/8';

export type SoundtrackCategory = 'exploration' | 'sanctuary' | 'voyage' | 'combat' | 'dungeon';

export interface ScoreStepNote {
  /** Scale degree index (can be negative or >7 for octave shifts), or null for expressive rest */
  degree: number | null;
  /** Note length in 8th-note steps (1..6) */
  lengthSteps: number;
  /** Relative expressive velocity 0.2..1.0 */
  velocity: number;
}

export interface RealmSoundtrackSpec {
  id: string;
  title: string;
  composerNote: string;
  realmSlug: string;
  isDungeon: boolean;
  mode: MusicalModeId;
  /** Time signature / groove feel (defaults to '4/4' for legacy specs) */
  meter?: MusicalMeterId;
  category?: SoundtrackCategory;
  /** Root pitch as MIDI note number (e.g. 50 = D3, 48 = C3, 53 = F3) */
  rootMidi: number;
  bpm: number;
  /** 8-bar harmonic chord progression as scale degrees (0 = I, 3 = IV, 4 = V, etc.) */
  chordProgression: number[];
  /** Primary lyrical melody (Section A) over 16 eighth-note steps (or 12 steps for 3/4 & 6/8) */
  melodyMotif: ScoreStepNote[];
  /** Contrasting Section B melody (French horn / chamber reed) */
  sectionBMelody?: ScoreStepNote[];
  /** Soaring Section C bridge / climax melody */
  sectionCMelody?: ScoreStepNote[];
  /** Counter-melody / harp arpeggio degrees */
  harpArpeggio: Array<number | null>;
  /** Optional pizzicato contrabass pulse degrees */
  bassPattern?: Array<number | null>;
  /** Optional hammered dulcimer / mandolin shimmer degrees */
  dulcimerPattern?: Array<number | null>;
  instrumentation: {
    harp: number;
    strings: number;
    flute: number;
    horn: number;
    percussion: number;
    modalBells: number;
    dulcimer?: number;
    pizzicato?: number;
    reed?: number;
  };
  foleyProfile: AcousticFoleyProfile;
  reverbDecaySec: number;
  workletTuning: {
    fundamentalHz: number;
    rt60Ms: number;
    modeNumers: number[];
    modeDenom: number;
  };
}

export const MODE_INTERVALS: Record<MusicalModeId, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'pentatonic-major': [0, 2, 4, 7, 9, 12, 14],
};

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Resolves a scale degree (including negative or multi-octave degrees) in the given mode
 * relative to rootMidi, returning frequency in Hz.
 */
export function scaleDegreeToHz(rootMidi: number, mode: MusicalModeId, degree: number): number {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS.dorian;
  const len = intervals.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return midiToHz(rootMidi + octave * 12 + intervals[idx]);
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Curated 20-Song Orchestral Soundtrack Catalog (Diverse Meters, Modes & Moods)
// ---------------------------------------------------------------------------
export const SOUNDTRACK_CATALOG: RealmSoundtrackSpec[] = [
  // === 1–3: CITADEL HIGHLANDS / VAELMOR SUITE ===
  {
    id: 'ost-vaelmor-overture',
    title: 'Overture of the Shattered Meridian',
    composerNote:
      'Heroic 4/4 Dorian frontier suite: Celtic harp cascades, noble French horn fanfares, wooden flute, and pizzicato pulse.',
    realmSlug: 'vaelmor',
    isDungeon: false,
    mode: 'dorian',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 50, // D3
    bpm: 90,
    chordProgression: [0, 6, 3, 4, 0, 2, 6, 4],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.8 },
      { degree: 9, lengthSteps: 2, velocity: 0.84 },
      { degree: 11, lengthSteps: 3, velocity: 0.88 },
      { degree: 9, lengthSteps: 1, velocity: 0.68 },
      { degree: 8, lengthSteps: 2, velocity: 0.76 },
      { degree: 7, lengthSteps: 2, velocity: 0.74 },
      { degree: 6, lengthSteps: 2, velocity: 0.7 },
      { degree: null, lengthSteps: 2, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 3, velocity: 0.86 },
      { degree: 10, lengthSteps: 1, velocity: 0.72 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 7, lengthSteps: 2, velocity: 0.76 },
      { degree: 9, lengthSteps: 3, velocity: 0.84 },
      { degree: 6, lengthSteps: 1, velocity: 0.68 },
      { degree: 4, lengthSteps: 4, velocity: 0.78 },
    ],
    sectionCMelody: [
      { degree: 4, lengthSteps: 2, velocity: 0.74 },
      { degree: 7, lengthSteps: 2, velocity: 0.82 },
      { degree: 11, lengthSteps: 2, velocity: 0.9 },
      { degree: 14, lengthSteps: 4, velocity: 0.92 },
      { degree: 13, lengthSteps: 2, velocity: 0.78 },
      { degree: 11, lengthSteps: 2, velocity: 0.8 },
      { degree: 9, lengthSteps: 2, velocity: 0.75 },
    ],
    harpArpeggio: [0, 4, 7, 9, 11, 9, 7, 4, 0, 2, 6, 9, 7, 4, 2, 4],
    bassPattern: [0, null, null, 4, 0, null, 2, null],
    dulcimerPattern: [null, 7, null, 11, 9, null, 7, 4],
    instrumentation: {
      harp: 0.88,
      strings: 0.82,
      flute: 0.84,
      horn: 0.78,
      percussion: 0.48,
      modalBells: 0.64,
      dulcimer: 0.62,
      pizzicato: 0.72,
      reed: 0.56,
    },
    foleyProfile: 'highland-wind',
    reverbDecaySec: 3.1,
    workletTuning: { fundamentalHz: 174, rt60Ms: 2150, modeNumers: [100, 276, 540, 893], modeDenom: 100 },
  },
  {
    id: 'ost-vaelmor-hearth-waltz',
    title: 'Lanterns on the Stone Causeway',
    composerNote:
      'Gentle 3/4 Lydian sanctuary waltz: shimmering hammered dulcimer, warm chamber reed, and tender bowed cello swells.',
    realmSlug: 'vaelmor',
    isDungeon: false,
    mode: 'lydian',
    meter: '3/4',
    category: 'sanctuary',
    rootMidi: 53, // F3
    bpm: 76,
    chordProgression: [0, 1, 5, 4, 0, 3, 1, 4],
    melodyMotif: [
      { degree: 7, lengthSteps: 3, velocity: 0.72 },
      { degree: 9, lengthSteps: 1, velocity: 0.64 },
      { degree: 11, lengthSteps: 2, velocity: 0.8 },
      { degree: 10, lengthSteps: 3, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.68 },
      { degree: null, lengthSteps: 1, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 12, lengthSteps: 2, velocity: 0.78 },
      { degree: 11, lengthSteps: 2, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.72 },
      { degree: 7, lengthSteps: 4, velocity: 0.76 },
      { degree: 6, lengthSteps: 2, velocity: 0.66 },
    ],
    sectionCMelody: [
      { degree: 9, lengthSteps: 2, velocity: 0.76 },
      { degree: 11, lengthSteps: 2, velocity: 0.82 },
      { degree: 14, lengthSteps: 4, velocity: 0.84 },
      { degree: 11, lengthSteps: 2, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.7 },
    ],
    harpArpeggio: [0, 4, 7, 9, 7, 4, 0, 2, 6, 9, 6, 2],
    bassPattern: [0, null, 4, null, 2, null],
    dulcimerPattern: [7, null, 11, 9, null, 12],
    instrumentation: {
      harp: 0.92,
      strings: 0.86,
      flute: 0.72,
      horn: 0.25,
      percussion: 0.2,
      modalBells: 0.58,
      dulcimer: 0.86,
      pizzicato: 0.62,
      reed: 0.84,
    },
    foleyProfile: 'highland-wind',
    reverbDecaySec: 3.4,
    workletTuning: { fundamentalHz: 175, rt60Ms: 2250, modeNumers: [100, 250, 480, 790], modeDenom: 100 },
  },
  {
    id: 'ost-vaelmor-waywright-jig',
    title: 'March of the Waywright Guilds',
    composerNote:
      'Buoyant 6/8 Mixolydian frontier jig: spirited wooden flute & oboe-reed duet, lively bodhran cadence, and walking pizzicato bass.',
    realmSlug: 'vaelmor',
    isDungeon: false,
    mode: 'mixolydian',
    meter: '6/8',
    category: 'voyage',
    rootMidi: 55, // G3
    bpm: 108,
    chordProgression: [0, 6, 3, 0, 0, 4, 6, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.84 },
      { degree: 9, lengthSteps: 1, velocity: 0.72 },
      { degree: 11, lengthSteps: 2, velocity: 0.88 },
      { degree: 10, lengthSteps: 1, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.82 },
      { degree: 7, lengthSteps: 1, velocity: 0.7 },
      { degree: 6, lengthSteps: 3, velocity: 0.78 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 1, velocity: 0.82 },
      { degree: 12, lengthSteps: 1, velocity: 0.78 },
      { degree: 14, lengthSteps: 2, velocity: 0.9 },
      { degree: 11, lengthSteps: 2, velocity: 0.8 },
      { degree: 10, lengthSteps: 2, velocity: 0.84 },
      { degree: 9, lengthSteps: 1, velocity: 0.74 },
      { degree: 7, lengthSteps: 3, velocity: 0.82 },
    ],
    sectionCMelody: [
      { degree: 7, lengthSteps: 1, velocity: 0.78 },
      { degree: 6, lengthSteps: 1, velocity: 0.72 },
      { degree: 4, lengthSteps: 2, velocity: 0.82 },
      { degree: 7, lengthSteps: 2, velocity: 0.86 },
      { degree: 9, lengthSteps: 3, velocity: 0.88 },
      { degree: 11, lengthSteps: 3, velocity: 0.9 },
    ],
    harpArpeggio: [0, 4, 7, 0, 6, 9, 0, 3, 7, 4, 7, 10],
    bassPattern: [0, null, null, 4, null, 6],
    dulcimerPattern: [7, 9, 11, 7, 10, 9],
    instrumentation: {
      harp: 0.78,
      strings: 0.62,
      flute: 0.94,
      horn: 0.64,
      percussion: 0.78,
      modalBells: 0.45,
      dulcimer: 0.88,
      pizzicato: 0.86,
      reed: 0.88,
    },
    foleyProfile: 'highland-wind',
    reverbDecaySec: 2.6,
    workletTuning: { fundamentalHz: 196, rt60Ms: 1850, modeNumers: [100, 265, 510, 825], modeDenom: 100 },
  },

  // === 4–6: SUNKEN AQUEDUCTS SUITE ===
  {
    id: 'ost-aqueducts-hymn',
    title: 'Hymn of the Emerald Sluice',
    composerNote:
      'Lydian pastoral 4/4 suite: sparkling harp cascades, breathy flute phrasing, and shimmering modal water chimes.',
    realmSlug: 'emerald-aqueducts',
    isDungeon: false,
    mode: 'lydian',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 53, // F3
    bpm: 86,
    chordProgression: [0, 1, 4, 0, 5, 3, 1, 4],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.78 },
      { degree: 11, lengthSteps: 3, velocity: 0.86 },
      { degree: 10, lengthSteps: 1, velocity: 0.64 },
      { degree: 9, lengthSteps: 2, velocity: 0.74 },
      { degree: 7, lengthSteps: 2, velocity: 0.68 },
      { degree: null, lengthSteps: 2, velocity: 0 },
      { degree: 6, lengthSteps: 2, velocity: 0.7 },
    ],
    sectionBMelody: [
      { degree: 10, lengthSteps: 3, velocity: 0.8 },
      { degree: 11, lengthSteps: 1, velocity: 0.72 },
      { degree: 14, lengthSteps: 4, velocity: 0.86 },
      { degree: 11, lengthSteps: 2, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.72 },
      { degree: 7, lengthSteps: 4, velocity: 0.76 },
    ],
    harpArpeggio: [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2],
    bassPattern: [0, null, null, null, 4, null, 2, null],
    dulcimerPattern: [null, 10, 11, null, 9, null, 7, 10],
    instrumentation: {
      harp: 0.94,
      strings: 0.76,
      flute: 0.9,
      horn: 0.36,
      percussion: 0.34,
      modalBells: 0.62,
      dulcimer: 0.76,
      pizzicato: 0.58,
      reed: 0.68,
    },
    foleyProfile: 'aqueduct-water',
    reverbDecaySec: 3.1,
    workletTuning: { fundamentalHz: 175, rt60Ms: 2100, modeNumers: [100, 250, 480, 790], modeDenom: 100 },
  },
  {
    id: 'ost-aqueducts-nocturne',
    title: 'Silt-Glass Nocturne',
    composerNote:
      'Dreamy 3/4 Dorian evening ballad: bowed viola legato, delicate harp harmonics, and reflective chamber reed.',
    realmSlug: 'emerald-aqueducts',
    isDungeon: false,
    mode: 'dorian',
    meter: '3/4',
    category: 'sanctuary',
    rootMidi: 52, // E3
    bpm: 72,
    chordProgression: [0, 3, 5, 4, 2, 6, 3, 0],
    melodyMotif: [
      { degree: 9, lengthSteps: 3, velocity: 0.7 },
      { degree: 7, lengthSteps: 3, velocity: 0.66 },
      { degree: 6, lengthSteps: 2, velocity: 0.68 },
      { degree: 7, lengthSteps: 2, velocity: 0.74 },
      { degree: 4, lengthSteps: 2, velocity: 0.64 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 3, velocity: 0.76 },
      { degree: 9, lengthSteps: 3, velocity: 0.72 },
      { degree: 8, lengthSteps: 2, velocity: 0.7 },
      { degree: 7, lengthSteps: 4, velocity: 0.74 },
    ],
    harpArpeggio: [0, 2, 4, 7, 4, 2, 0, 3, 7, 9, 7, 3],
    bassPattern: [0, null, null, 3, null, null],
    dulcimerPattern: [null, 9, null, 7, null, 11],
    instrumentation: {
      harp: 0.88,
      strings: 0.92,
      flute: 0.68,
      horn: 0.28,
      percussion: 0.16,
      modalBells: 0.74,
      dulcimer: 0.68,
      pizzicato: 0.52,
      reed: 0.82,
    },
    foleyProfile: 'aqueduct-water',
    reverbDecaySec: 3.6,
    workletTuning: { fundamentalHz: 165, rt60Ms: 2400, modeNumers: [100, 244, 478, 780], modeDenom: 100 },
  },
  {
    id: 'ost-aqueducts-waterwheels',
    title: 'Dance of the Water-Wheels',
    composerNote:
      'Sun-dappled 6/8 Pentatonic acoustic dance: nimble hammered dulcimer runs, wooden flute, and buoyant pizzicato strings.',
    realmSlug: 'emerald-aqueducts',
    isDungeon: false,
    mode: 'pentatonic-major',
    meter: '6/8',
    category: 'voyage',
    rootMidi: 50, // D3
    bpm: 112,
    chordProgression: [0, 3, 4, 0, 2, 4, 3, 0],
    melodyMotif: [
      { degree: 5, lengthSteps: 2, velocity: 0.82 },
      { degree: 7, lengthSteps: 1, velocity: 0.74 },
      { degree: 9, lengthSteps: 2, velocity: 0.88 },
      { degree: 7, lengthSteps: 1, velocity: 0.72 },
      { degree: 6, lengthSteps: 2, velocity: 0.8 },
      { degree: 5, lengthSteps: 1, velocity: 0.72 },
      { degree: 4, lengthSteps: 3, velocity: 0.78 },
    ],
    sectionBMelody: [
      { degree: 9, lengthSteps: 2, velocity: 0.86 },
      { degree: 10, lengthSteps: 1, velocity: 0.78 },
      { degree: 12, lengthSteps: 3, velocity: 0.9 },
      { degree: 10, lengthSteps: 2, velocity: 0.82 },
      { degree: 9, lengthSteps: 1, velocity: 0.74 },
      { degree: 7, lengthSteps: 3, velocity: 0.8 },
    ],
    harpArpeggio: [0, 2, 5, 7, 5, 2, 0, 3, 6, 9, 6, 3],
    bassPattern: [0, null, 2, 4, null, 3],
    dulcimerPattern: [5, 7, 9, 10, 9, 7],
    instrumentation: {
      harp: 0.84,
      strings: 0.58,
      flute: 0.92,
      horn: 0.42,
      percussion: 0.68,
      modalBells: 0.54,
      dulcimer: 0.94,
      pizzicato: 0.84,
      reed: 0.76,
    },
    foleyProfile: 'aqueduct-water',
    reverbDecaySec: 2.5,
    workletTuning: { fundamentalHz: 147, rt60Ms: 1750, modeNumers: [100, 238, 466, 755], modeDenom: 100 },
  },

  // === 7–9: OBSIDIAN CRUCIBLE / CINDERFALL SUITE ===
  {
    id: 'ost-crucible-anvil',
    title: 'Anvil Chorus of the Caldera',
    composerNote:
      'Phrygian Dominant 4/4 forge symphony: driving frame-drum cadence, noble low brass horns, and metallic anvil bell overtones.',
    realmSlug: 'cinderfall-crucible',
    isDungeon: false,
    mode: 'phrygian-dominant',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 48, // C3
    bpm: 102,
    chordProgression: [0, 1, 0, 6, 3, 1, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.84 },
      { degree: 8, lengthSteps: 1, velocity: 0.72 },
      { degree: 9, lengthSteps: 3, velocity: 0.9 },
      { degree: 7, lengthSteps: 2, velocity: 0.76 },
      { degree: 6, lengthSteps: 2, velocity: 0.7 },
      { degree: 4, lengthSteps: 4, velocity: 0.82 },
      { degree: null, lengthSteps: 2, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 9, lengthSteps: 2, velocity: 0.88 },
      { degree: 11, lengthSteps: 2, velocity: 0.92 },
      { degree: 12, lengthSteps: 2, velocity: 0.94 },
      { degree: 11, lengthSteps: 2, velocity: 0.82 },
      { degree: 9, lengthSteps: 3, velocity: 0.86 },
      { degree: 8, lengthSteps: 1, velocity: 0.74 },
      { degree: 7, lengthSteps: 4, velocity: 0.84 },
    ],
    harpArpeggio: [0, 4, 7, 8, 7, 4, 1, 4, 0, 4, 9, 8, 7, 4, 0, null],
    bassPattern: [0, null, 0, 1, 0, null, 4, 1],
    dulcimerPattern: [7, 8, null, 9, 8, 7, null, 4],
    instrumentation: {
      harp: 0.56,
      strings: 0.84,
      flute: 0.34,
      horn: 0.94,
      percussion: 0.88,
      modalBells: 0.86,
      dulcimer: 0.68,
      pizzicato: 0.82,
      reed: 0.62,
    },
    foleyProfile: 'caldera-forge',
    reverbDecaySec: 2.8,
    workletTuning: { fundamentalHz: 131, rt60Ms: 1850, modeNumers: [100, 294, 568, 920], modeDenom: 100 },
  },
  {
    id: 'ost-crucible-sarabande',
    title: 'Ember-Bellows Sarabande',
    composerNote:
      'Solemn 3/4 Harmonic Minor foundry waltz: brooding cello & reed counterpoint over resonant bronze hearth bells.',
    realmSlug: 'cinderfall-crucible',
    isDungeon: false,
    mode: 'harmonic-minor',
    meter: '3/4',
    category: 'sanctuary',
    rootMidi: 45, // A2
    bpm: 78,
    chordProgression: [0, 5, 3, 4, 0, 6, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.78 },
      { degree: 9, lengthSteps: 4, velocity: 0.84 },
      { degree: 8, lengthSteps: 2, velocity: 0.74 },
      { degree: 7, lengthSteps: 2, velocity: 0.76 },
      { degree: 6, lengthSteps: 2, velocity: 0.72 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 3, velocity: 0.86 },
      { degree: 9, lengthSteps: 3, velocity: 0.8 },
      { degree: 7, lengthSteps: 3, velocity: 0.78 },
      { degree: 6, lengthSteps: 3, velocity: 0.82 },
    ],
    harpArpeggio: [0, 4, 7, 6, 4, 2, 0, 3, 7, 8, 7, 4],
    bassPattern: [0, null, 4, null, 3, null],
    dulcimerPattern: [null, 7, 9, null, 8, 6],
    instrumentation: {
      harp: 0.66,
      strings: 0.92,
      flute: 0.44,
      horn: 0.74,
      percussion: 0.48,
      modalBells: 0.82,
      dulcimer: 0.64,
      pizzicato: 0.76,
      reed: 0.86,
    },
    foleyProfile: 'caldera-forge',
    reverbDecaySec: 3.3,
    workletTuning: { fundamentalHz: 110, rt60Ms: 2400, modeNumers: [100, 282, 550, 905], modeDenom: 100 },
  },
  {
    id: 'ost-crucible-hammerstrike',
    title: 'Hammerstrike Processional',
    composerNote:
      'Brisk 4/4 Dorian smith-guild march: crisp pizzicato drive, sparkling dulcimer triplets, and heroic brass swells.',
    realmSlug: 'cinderfall-crucible',
    isDungeon: false,
    mode: 'dorian',
    meter: '4/4',
    category: 'voyage',
    rootMidi: 47, // B2
    bpm: 114,
    chordProgression: [0, 2, 3, 4, 0, 6, 3, 4],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.86 },
      { degree: 7, lengthSteps: 1, velocity: 0.76 },
      { degree: 9, lengthSteps: 1, velocity: 0.82 },
      { degree: 11, lengthSteps: 2, velocity: 0.92 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 7, lengthSteps: 2, velocity: 0.82 },
      { degree: 6, lengthSteps: 2, velocity: 0.76 },
      { degree: 4, lengthSteps: 4, velocity: 0.84 },
    ],
    harpArpeggio: [0, 4, 7, 4, 2, 6, 9, 6, 3, 7, 10, 7, 4, 7, 11, 7],
    bassPattern: [0, 0, 4, null, 2, 2, 6, 4],
    dulcimerPattern: [7, null, 9, 11, 7, null, 6, 9],
    instrumentation: {
      harp: 0.7,
      strings: 0.74,
      flute: 0.62,
      horn: 0.92,
      percussion: 0.86,
      modalBells: 0.78,
      dulcimer: 0.84,
      pizzicato: 0.9,
      reed: 0.72,
    },
    foleyProfile: 'caldera-forge',
    reverbDecaySec: 2.4,
    workletTuning: { fundamentalHz: 123, rt60Ms: 1700, modeNumers: [100, 276, 540, 893], modeDenom: 100 },
  },

  // === 10–12: PELAGIC SPIRES / GLASSWATER SUITE ===
  {
    id: 'ost-pelagic-sextant',
    title: 'Sextant Winds of Glasswater',
    composerNote:
      'Mixolydian 4/4 maritime anthem: rolling harp waves, soaring wooden whistle lines, and open-fifth sea-horn calls.',
    realmSlug: 'glasswater-shoals',
    isDungeon: false,
    mode: 'mixolydian',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 55, // G3
    bpm: 94,
    chordProgression: [0, 6, 3, 0, 0, 4, 6, 3],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.78 },
      { degree: 11, lengthSteps: 2, velocity: 0.84 },
      { degree: 10, lengthSteps: 2, velocity: 0.76 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 7, lengthSteps: 3, velocity: 0.86 },
      { degree: 6, lengthSteps: 1, velocity: 0.65 },
      { degree: 4, lengthSteps: 2, velocity: 0.72 },
      { degree: null, lengthSteps: 2, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 2, velocity: 0.86 },
      { degree: 13, lengthSteps: 2, velocity: 0.88 },
      { degree: 14, lengthSteps: 4, velocity: 0.92 },
      { degree: 13, lengthSteps: 2, velocity: 0.8 },
      { degree: 11, lengthSteps: 2, velocity: 0.82 },
      { degree: 9, lengthSteps: 4, velocity: 0.78 },
    ],
    harpArpeggio: [0, 4, 7, 9, 10, 9, 7, 4, 0, 3, 6, 9, 7, 4, 2, 4],
    bassPattern: [0, null, null, 4, 6, null, 3, null],
    dulcimerPattern: [null, 7, 11, null, 10, 9, null, 7],
    instrumentation: {
      harp: 0.9,
      strings: 0.74,
      flute: 0.94,
      horn: 0.68,
      percussion: 0.56,
      modalBells: 0.52,
      dulcimer: 0.78,
      pizzicato: 0.72,
      reed: 0.74,
    },
    foleyProfile: 'ocean-surf',
    reverbDecaySec: 3.3,
    workletTuning: { fundamentalHz: 196, rt60Ms: 2200, modeNumers: [100, 265, 510, 825], modeDenom: 100 },
  },
  {
    id: 'ost-pelagic-barcarolle',
    title: 'Tide-Bell Barcarolle',
    composerNote:
      'Swaying 6/8 Lydian harbor ballad: gentle rocking harp accompaniment, airy woodwind melody, and distant buoy bells.',
    realmSlug: 'glasswater-shoals',
    isDungeon: false,
    mode: 'lydian',
    meter: '6/8',
    category: 'sanctuary',
    rootMidi: 53, // F3
    bpm: 82,
    chordProgression: [0, 4, 5, 1, 0, 3, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 3, velocity: 0.74 },
      { degree: 11, lengthSteps: 2, velocity: 0.8 },
      { degree: 10, lengthSteps: 1, velocity: 0.68 },
      { degree: 9, lengthSteps: 3, velocity: 0.76 },
      { degree: 7, lengthSteps: 3, velocity: 0.7 },
    ],
    sectionBMelody: [
      { degree: 9, lengthSteps: 3, velocity: 0.78 },
      { degree: 12, lengthSteps: 3, velocity: 0.84 },
      { degree: 11, lengthSteps: 3, velocity: 0.78 },
      { degree: 9, lengthSteps: 3, velocity: 0.74 },
    ],
    harpArpeggio: [0, 4, 7, 11, 7, 4, 0, 3, 7, 10, 7, 3],
    bassPattern: [0, null, null, 4, null, null],
    dulcimerPattern: [7, null, 11, 9, null, 10],
    instrumentation: {
      harp: 0.94,
      strings: 0.84,
      flute: 0.82,
      horn: 0.44,
      percussion: 0.24,
      modalBells: 0.78,
      dulcimer: 0.8,
      pizzicato: 0.56,
      reed: 0.84,
    },
    foleyProfile: 'ocean-surf',
    reverbDecaySec: 3.7,
    workletTuning: { fundamentalHz: 175, rt60Ms: 2550, modeNumers: [100, 250, 480, 790], modeDenom: 100 },
  },
  {
    id: 'ost-pelagic-reel',
    title: "Corsair's Compass Reel",
    composerNote:
      'Brisk 6/8 Dorian seafaring reel: fleet hammered dulcimer, sprightly wooden whistle & reed melody, and stomping frame-drums.',
    realmSlug: 'glasswater-shoals',
    isDungeon: false,
    mode: 'dorian',
    meter: '6/8',
    category: 'voyage',
    rootMidi: 50, // D3
    bpm: 118,
    chordProgression: [0, 6, 0, 4, 3, 6, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 1, velocity: 0.84 },
      { degree: 8, lengthSteps: 1, velocity: 0.78 },
      { degree: 9, lengthSteps: 1, velocity: 0.82 },
      { degree: 11, lengthSteps: 2, velocity: 0.9 },
      { degree: 9, lengthSteps: 1, velocity: 0.76 },
      { degree: 8, lengthSteps: 2, velocity: 0.84 },
      { degree: 7, lengthSteps: 1, velocity: 0.74 },
      { degree: 6, lengthSteps: 3, velocity: 0.82 },
    ],
    harpArpeggio: [0, 4, 7, 6, 4, 2, 0, 3, 7, 9, 7, 4],
    bassPattern: [0, null, 4, 6, null, 4],
    dulcimerPattern: [7, 9, 11, 9, 8, 7],
    instrumentation: {
      harp: 0.74,
      strings: 0.62,
      flute: 0.96,
      horn: 0.68,
      percussion: 0.86,
      modalBells: 0.42,
      dulcimer: 0.94,
      pizzicato: 0.88,
      reed: 0.9,
    },
    foleyProfile: 'ocean-surf',
    reverbDecaySec: 2.3,
    workletTuning: { fundamentalHz: 147, rt60Ms: 1650, modeNumers: [100, 276, 540, 893], modeDenom: 100 },
  },

  // === 13–14: AMBER STEPPE SUITE ===
  {
    id: 'ost-steppe-windharps',
    title: 'Wind-Harps of Kar-Veth',
    composerNote:
      'Sunlit 4/4 Pentatonic frontier ballad: resonant harp strums, hammered dulcimer sparkle, and horizon flute motifs.',
    realmSlug: 'sunspire-steppe',
    isDungeon: false,
    mode: 'pentatonic-major',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 52, // E3
    bpm: 92,
    chordProgression: [0, 3, 4, 2, 0, 4, 3, 0],
    melodyMotif: [
      { degree: 5, lengthSteps: 2, velocity: 0.78 },
      { degree: 7, lengthSteps: 2, velocity: 0.82 },
      { degree: 9, lengthSteps: 3, velocity: 0.88 },
      { degree: 7, lengthSteps: 1, velocity: 0.68 },
      { degree: 6, lengthSteps: 2, velocity: 0.74 },
      { degree: 5, lengthSteps: 2, velocity: 0.7 },
      { degree: 4, lengthSteps: 2, velocity: 0.66 },
      { degree: null, lengthSteps: 2, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 9, lengthSteps: 2, velocity: 0.84 },
      { degree: 10, lengthSteps: 2, velocity: 0.86 },
      { degree: 12, lengthSteps: 4, velocity: 0.9 },
      { degree: 10, lengthSteps: 2, velocity: 0.78 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 7, lengthSteps: 4, velocity: 0.76 },
    ],
    harpArpeggio: [0, 2, 4, 5, 7, 5, 4, 2, 0, 3, 5, 7, 9, 7, 5, 4],
    bassPattern: [0, null, null, 3, 4, null, 2, null],
    dulcimerPattern: [5, null, 9, 7, null, 10, 9, 7],
    instrumentation: {
      harp: 0.94,
      strings: 0.72,
      flute: 0.86,
      horn: 0.64,
      percussion: 0.64,
      modalBells: 0.76,
      dulcimer: 0.88,
      pizzicato: 0.74,
      reed: 0.7,
    },
    foleyProfile: 'steppe-chimes',
    reverbDecaySec: 3.0,
    workletTuning: { fundamentalHz: 165, rt60Ms: 2050, modeNumers: [100, 240, 470, 760], modeDenom: 100 },
  },
  {
    id: 'ost-steppe-twilight-waltz',
    title: 'Caravan Under Copper Stars',
    composerNote:
      'Warm 3/4 Mixolydian desert-twilight waltz: lyrical chamber reed solo over swaying pizzicato & bronze wind-chimes.',
    realmSlug: 'sunspire-steppe',
    isDungeon: false,
    mode: 'mixolydian',
    meter: '3/4',
    category: 'sanctuary',
    rootMidi: 50, // D3
    bpm: 78,
    chordProgression: [0, 6, 3, 0, 4, 6, 3, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.76 },
      { degree: 10, lengthSteps: 4, velocity: 0.82 },
      { degree: 9, lengthSteps: 2, velocity: 0.74 },
      { degree: 7, lengthSteps: 2, velocity: 0.72 },
      { degree: 6, lengthSteps: 2, velocity: 0.7 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 3, velocity: 0.82 },
      { degree: 10, lengthSteps: 3, velocity: 0.78 },
      { degree: 9, lengthSteps: 3, velocity: 0.76 },
      { degree: 7, lengthSteps: 3, velocity: 0.74 },
    ],
    harpArpeggio: [0, 4, 7, 10, 7, 4, 0, 3, 6, 9, 6, 3],
    bassPattern: [0, null, 4, null, 6, null],
    dulcimerPattern: [null, 10, 9, null, 7, 6],
    instrumentation: {
      harp: 0.86,
      strings: 0.82,
      flute: 0.72,
      horn: 0.52,
      percussion: 0.36,
      modalBells: 0.84,
      dulcimer: 0.82,
      pizzicato: 0.72,
      reed: 0.9,
    },
    foleyProfile: 'steppe-chimes',
    reverbDecaySec: 3.4,
    workletTuning: { fundamentalHz: 147, rt60Ms: 2300, modeNumers: [100, 252, 488, 792], modeDenom: 100 },
  },

  // === 15–16: GLACIAL SPIRE SUITE ===
  {
    id: 'ost-glacial-aurora',
    title: 'Aurora Canticle of Borealis',
    composerNote:
      'Crystalline 4/4 Aeolian alpine meditation: shimmering modal glass-bells, spacious legato strings, and solemn distant horns.',
    realmSlug: 'borealis-vault',
    isDungeon: false,
    mode: 'aeolian',
    meter: '4/4',
    category: 'exploration',
    rootMidi: 57, // A3
    bpm: 78,
    chordProgression: [0, 5, 2, 6, 3, 0, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 3, velocity: 0.74 },
      { degree: 9, lengthSteps: 1, velocity: 0.66 },
      { degree: 11, lengthSteps: 4, velocity: 0.82 },
      { degree: 9, lengthSteps: 2, velocity: 0.7 },
      { degree: 7, lengthSteps: 2, velocity: 0.72 },
      { degree: 6, lengthSteps: 2, velocity: 0.64 },
      { degree: null, lengthSteps: 2, velocity: 0 },
    ],
    sectionBMelody: [
      { degree: 12, lengthSteps: 4, velocity: 0.84 },
      { degree: 11, lengthSteps: 2, velocity: 0.76 },
      { degree: 9, lengthSteps: 2, velocity: 0.74 },
      { degree: 7, lengthSteps: 4, velocity: 0.78 },
      { degree: 5, lengthSteps: 4, velocity: 0.72 },
    ],
    harpArpeggio: [0, 4, 7, 11, 9, 7, 4, null, 2, 6, 9, 11, 9, 6, 4, null],
    bassPattern: [0, null, null, null, 5, null, null, null],
    dulcimerPattern: [null, 11, null, 14, null, 11, 9, null],
    instrumentation: {
      harp: 0.88,
      strings: 0.92,
      flute: 0.74,
      horn: 0.7,
      percussion: 0.28,
      modalBells: 0.94,
      dulcimer: 0.84,
      pizzicato: 0.48,
      reed: 0.66,
    },
    foleyProfile: 'glacial-aurora',
    reverbDecaySec: 4.1,
    workletTuning: { fundamentalHz: 220, rt60Ms: 2900, modeNumers: [100, 256, 512, 845], modeDenom: 100 },
  },
  {
    id: 'ost-glacial-minuet',
    title: 'Rime-Glass Chamber Minuet',
    composerNote:
      'Delicate 3/4 Lydian ice-palace minuet: crystalline hammered dulcimer arpeggios, crisp pizzicato cello, and soaring flute.',
    realmSlug: 'borealis-vault',
    isDungeon: false,
    mode: 'lydian',
    meter: '3/4',
    category: 'sanctuary',
    rootMidi: 55, // G3
    bpm: 84,
    chordProgression: [0, 1, 4, 0, 5, 1, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.74 },
      { degree: 10, lengthSteps: 2, velocity: 0.8 },
      { degree: 11, lengthSteps: 2, velocity: 0.84 },
      { degree: 14, lengthSteps: 3, velocity: 0.86 },
      { degree: 11, lengthSteps: 3, velocity: 0.74 },
    ],
    harpArpeggio: [0, 4, 7, 10, 7, 4, 0, 2, 6, 11, 6, 2],
    bassPattern: [0, null, 4, null, 1, null],
    dulcimerPattern: [7, 10, 11, 14, 11, 10],
    instrumentation: {
      harp: 0.86,
      strings: 0.78,
      flute: 0.88,
      horn: 0.34,
      percussion: 0.22,
      modalBells: 0.92,
      dulcimer: 0.94,
      pizzicato: 0.78,
      reed: 0.76,
    },
    foleyProfile: 'glacial-aurora',
    reverbDecaySec: 3.9,
    workletTuning: { fundamentalHz: 196, rt60Ms: 2700, modeNumers: [100, 260, 520, 860], modeDenom: 100 },
  },

  // === 17–18: VAULTED 3D DUNGEON DELVE SUITES ===
  {
    id: 'ost-dungeon-catacombs',
    title: 'Catacombs of the First Kiln',
    composerNote:
      'Cavernous 4/4 Harmonic Minor chamber dirge: deep hall reverb, plucked harp ostinato, dark bowed cellos, and subterranean bells.',
    realmSlug: 'dungeon-vault',
    isDungeon: true,
    mode: 'harmonic-minor',
    meter: '4/4',
    category: 'dungeon',
    rootMidi: 47, // B2
    bpm: 84,
    chordProgression: [0, 5, 3, 4, 0, 6, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 3, velocity: 0.74 },
      { degree: null, lengthSteps: 1, velocity: 0 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 8, lengthSteps: 2, velocity: 0.68 },
      { degree: 7, lengthSteps: 4, velocity: 0.76 },
      { degree: 6, lengthSteps: 2, velocity: 0.64 },
      { degree: 4, lengthSteps: 2, velocity: 0.72 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 2, velocity: 0.82 },
      { degree: 10, lengthSteps: 2, velocity: 0.78 },
      { degree: 9, lengthSteps: 4, velocity: 0.84 },
      { degree: 7, lengthSteps: 2, velocity: 0.74 },
      { degree: 6, lengthSteps: 2, velocity: 0.76 },
      { degree: 7, lengthSteps: 4, velocity: 0.8 },
    ],
    harpArpeggio: [0, 4, 7, 9, 7, 4, 2, 4, 0, 5, 7, 11, 9, 7, 4, null],
    bassPattern: [0, null, null, 0, 5, null, 4, null],
    dulcimerPattern: [null, 7, null, 9, 8, null, 6, null],
    instrumentation: {
      harp: 0.8,
      strings: 0.86,
      flute: 0.44,
      horn: 0.72,
      percussion: 0.68,
      modalBells: 0.8,
      dulcimer: 0.58,
      pizzicato: 0.82,
      reed: 0.78,
    },
    foleyProfile: 'dungeon-cavern',
    reverbDecaySec: 4.4,
    workletTuning: { fundamentalHz: 123, rt60Ms: 3200, modeNumers: [100, 276, 540, 893], modeDenom: 100 },
  },
  {
    id: 'ost-dungeon-abyssal-span',
    title: 'Abyssal Span Processional',
    composerNote:
      'Haunting 3/4 Phrygian Dominant dungeon waltz: echoing reed lament, deep pizzicato pulse, and vaulted stone resonance.',
    realmSlug: 'dungeon-vault',
    isDungeon: true,
    mode: 'phrygian-dominant',
    meter: '3/4',
    category: 'dungeon',
    rootMidi: 45, // A2
    bpm: 88,
    chordProgression: [0, 1, 6, 0, 3, 1, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.78 },
      { degree: 8, lengthSteps: 2, velocity: 0.82 },
      { degree: 9, lengthSteps: 2, velocity: 0.86 },
      { degree: 7, lengthSteps: 3, velocity: 0.76 },
      { degree: 4, lengthSteps: 3, velocity: 0.74 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 2, velocity: 0.84 },
      { degree: 9, lengthSteps: 2, velocity: 0.8 },
      { degree: 8, lengthSteps: 2, velocity: 0.82 },
      { degree: 7, lengthSteps: 6, velocity: 0.86 },
    ],
    harpArpeggio: [0, 4, 7, 8, 7, 4, 1, 4, 7, 9, 7, 1],
    bassPattern: [0, null, 1, null, 4, null],
    dulcimerPattern: [7, 8, null, 9, 8, 4],
    instrumentation: {
      harp: 0.76,
      strings: 0.88,
      flute: 0.4,
      horn: 0.84,
      percussion: 0.72,
      modalBells: 0.86,
      dulcimer: 0.7,
      pizzicato: 0.84,
      reed: 0.88,
    },
    foleyProfile: 'dungeon-cavern',
    reverbDecaySec: 4.5,
    workletTuning: { fundamentalHz: 110, rt60Ms: 3300, modeNumers: [100, 294, 568, 920], modeDenom: 100 },
  },

  // === 19–20: DYNAMIC COMBAT & BOSS ANTHEMS ===
  {
    id: 'ost-combat-bastion-clash',
    title: 'Shattered Bastion — Battle Suite',
    composerNote:
      'High-octane 4/4 Dorian combat anthem: thunderous frame drums, heroic French horns, rapid dulcimer ostinato, and driving pizzicato.',
    realmSlug: 'combat-overworld',
    isDungeon: false,
    mode: 'dorian',
    meter: '4/4',
    category: 'combat',
    rootMidi: 50, // D3
    bpm: 124,
    chordProgression: [0, 6, 3, 4, 0, 5, 6, 4],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.92 },
      { degree: 9, lengthSteps: 1, velocity: 0.86 },
      { degree: 11, lengthSteps: 1, velocity: 0.92 },
      { degree: 14, lengthSteps: 2, velocity: 0.96 },
      { degree: 13, lengthSteps: 2, velocity: 0.88 },
      { degree: 11, lengthSteps: 2, velocity: 0.9 },
      { degree: 9, lengthSteps: 2, velocity: 0.84 },
      { degree: 7, lengthSteps: 4, velocity: 0.9 },
    ],
    sectionBMelody: [
      { degree: 11, lengthSteps: 1, velocity: 0.9 },
      { degree: 11, lengthSteps: 1, velocity: 0.84 },
      { degree: 14, lengthSteps: 2, velocity: 0.96 },
      { degree: 13, lengthSteps: 2, velocity: 0.88 },
      { degree: 11, lengthSteps: 2, velocity: 0.9 },
      { degree: 10, lengthSteps: 2, velocity: 0.86 },
      { degree: 9, lengthSteps: 2, velocity: 0.88 },
      { degree: 7, lengthSteps: 4, velocity: 0.92 },
    ],
    harpArpeggio: [0, 4, 7, 11, 7, 4, 0, 7, 6, 9, 13, 9, 4, 7, 11, 7],
    bassPattern: [0, 0, 4, 0, 6, 6, 3, 4],
    dulcimerPattern: [7, 9, 11, 9, 7, 11, 13, 11],
    instrumentation: {
      harp: 0.72,
      strings: 0.88,
      flute: 0.7,
      horn: 0.98,
      percussion: 0.98,
      modalBells: 0.72,
      dulcimer: 0.9,
      pizzicato: 0.96,
      reed: 0.82,
    },
    foleyProfile: 'highland-wind',
    reverbDecaySec: 2.3,
    workletTuning: { fundamentalHz: 147, rt60Ms: 1650, modeNumers: [100, 276, 540, 893], modeDenom: 100 },
  },
  {
    id: 'ost-combat-colossus-reckoning',
    title: 'Crucible Reckoning — Warden Boss Suite',
    composerNote:
      'Relentless 6/8 Phrygian Dominant boss battle symphony: roaring brass, anvil bell strikes, and frantic chamber strings.',
    realmSlug: 'combat-boss',
    isDungeon: true,
    mode: 'phrygian-dominant',
    meter: '6/8',
    category: 'combat',
    rootMidi: 45, // A2
    bpm: 128,
    chordProgression: [0, 1, 0, 6, 3, 1, 4, 0],
    melodyMotif: [
      { degree: 7, lengthSteps: 2, velocity: 0.94 },
      { degree: 8, lengthSteps: 1, velocity: 0.88 },
      { degree: 9, lengthSteps: 2, velocity: 0.96 },
      { degree: 11, lengthSteps: 1, velocity: 0.9 },
      { degree: 12, lengthSteps: 3, velocity: 0.98 },
      { degree: 11, lengthSteps: 1, velocity: 0.86 },
      { degree: 9, lengthSteps: 2, velocity: 0.92 },
    ],
    sectionBMelody: [
      { degree: 14, lengthSteps: 2, velocity: 0.96 },
      { degree: 12, lengthSteps: 1, velocity: 0.88 },
      { degree: 11, lengthSteps: 2, velocity: 0.92 },
      { degree: 9, lengthSteps: 1, velocity: 0.86 },
      { degree: 8, lengthSteps: 3, velocity: 0.94 },
      { degree: 7, lengthSteps: 3, velocity: 0.92 },
    ],
    harpArpeggio: [0, 4, 7, 8, 7, 4, 1, 4, 8, 11, 8, 4],
    bassPattern: [0, 0, 1, 0, 4, 1],
    dulcimerPattern: [7, 8, 9, 11, 9, 8],
    instrumentation: {
      harp: 0.64,
      strings: 0.94,
      flute: 0.48,
      horn: 1.0,
      percussion: 1.0,
      modalBells: 0.94,
      dulcimer: 0.88,
      pizzicato: 0.98,
      reed: 0.84,
    },
    foleyProfile: 'dungeon-cavern',
    reverbDecaySec: 3.1,
    workletTuning: { fundamentalHz: 110, rt60Ms: 2100, modeNumers: [100, 294, 568, 920], modeDenom: 100 },
  },
];

export function getCombatTrackForTheme(isDungeon: boolean): RealmSoundtrackSpec {
  return (
    SOUNDTRACK_CATALOG.find((t) =>
      isDungeon ? t.id === 'ost-combat-colossus-reckoning' : t.id === 'ost-combat-bastion-clash',
    ) ?? SOUNDTRACK_CATALOG[SOUNDTRACK_CATALOG.length - 1]
  );
}

/**
 * Returns a curated multi-song suite (4 distinct songs with contrasting meters, modes, and tempos)
 * tailored to the active Frontier Realm or 3D Dungeon Delve.
 */
export function getPlaylistForRealm(
  theme: string,
  isDungeon: boolean,
  primaryScore?: RealmSoundtrackSpec,
): RealmSoundtrackSpec[] {
  const byId = (id: string) => SOUNDTRACK_CATALOG.find((t) => t.id === id);

  let suiteIds: string[];
  if (isDungeon) {
    suiteIds =
      theme === 'obsidian-crucible'
        ? ['ost-dungeon-abyssal-span', 'ost-dungeon-catacombs', 'ost-crucible-sarabande', 'ost-combat-colossus-reckoning']
        : theme === 'glacial-spire'
          ? ['ost-dungeon-catacombs', 'ost-glacial-aurora', 'ost-dungeon-abyssal-span', 'ost-combat-colossus-reckoning']
          : ['ost-dungeon-catacombs', 'ost-dungeon-abyssal-span', 'ost-aqueducts-nocturne', 'ost-combat-colossus-reckoning'];
  } else {
    switch (theme) {
      case 'sunken-aqueducts':
        suiteIds = ['ost-aqueducts-hymn', 'ost-aqueducts-waterwheels', 'ost-aqueducts-nocturne', 'ost-vaelmor-hearth-waltz'];
        break;
      case 'obsidian-crucible':
        suiteIds = ['ost-crucible-anvil', 'ost-crucible-hammerstrike', 'ost-crucible-sarabande', 'ost-steppe-twilight-waltz'];
        break;
      case 'pelagic-spires':
        suiteIds = ['ost-pelagic-sextant', 'ost-pelagic-reel', 'ost-pelagic-barcarolle', 'ost-vaelmor-waywright-jig'];
        break;
      case 'amber-steppe':
        suiteIds = ['ost-steppe-windharps', 'ost-steppe-twilight-waltz', 'ost-aqueducts-waterwheels', 'ost-vaelmor-overture'];
        break;
      case 'glacial-spire':
        suiteIds = ['ost-glacial-aurora', 'ost-glacial-minuet', 'ost-aqueducts-nocturne', 'ost-pelagic-barcarolle'];
        break;
      default:
        suiteIds = ['ost-vaelmor-overture', 'ost-vaelmor-hearth-waltz', 'ost-vaelmor-waywright-jig', 'ost-steppe-windharps'];
        break;
    }
  }

  const resolved: RealmSoundtrackSpec[] = [];
  const seenTitles = new Set<string>();
  const pushUnique = (track: RealmSoundtrackSpec | undefined) => {
    if (!track || seenTitles.has(track.title)) return;
    seenTitles.add(track.title);
    resolved.push(track);
  };

  // Start with the curated primary suite track (or custom composed score if unique)
  if (primaryScore) {
    // Enrich legacy score from realm.json with meter/sectionB/dulcimer/pizzicato if matching a catalog entry
    const catalogMatch = SOUNDTRACK_CATALOG.find((t) => t.title === primaryScore.title);
    pushUnique(catalogMatch ? { ...catalogMatch, realmSlug: primaryScore.realmSlug } : primaryScore);
  }
  for (const id of suiteIds) {
    pushUnique(byId(id));
  }
  return resolved;
}

export function getCanonicalSoundtrackForTheme(
  theme: string,
  isDungeon: boolean,
  realmSlug: string,
  realmName: string,
  seed = 7777,
): RealmSoundtrackSpec {
  if (isDungeon) {
    const template =
      theme === 'obsidian-crucible'
        ? SOUNDTRACK_CATALOG.find((t) => t.id === 'ost-dungeon-abyssal-span')!
        : SOUNDTRACK_CATALOG.find((t) => t.id === 'ost-dungeon-catacombs')!;
    const isGlacial = theme === 'glacial-spire';
    return {
      ...template,
      id: `score-${realmSlug}`,
      title: `Echoes of ${realmName}`,
      realmSlug,
      isDungeon: true,
      mode: isGlacial ? 'aeolian' : template.mode,
      rootMidi: isGlacial ? 48 : template.rootMidi,
    };
  }

  const map: Record<string, string> = {
    'sunken-aqueducts': 'ost-aqueducts-hymn',
    'obsidian-crucible': 'ost-crucible-anvil',
    'pelagic-spires': 'ost-pelagic-sextant',
    'amber-steppe': 'ost-steppe-windharps',
    'glacial-spire': 'ost-glacial-aurora',
  };
  const baseId = map[theme] ?? 'ost-vaelmor-overture';
  const base = SOUNDTRACK_CATALOG.find((t) => t.id === baseId) ?? SOUNDTRACK_CATALOG[0];
  const r = seededRand(seed);
  return {
    ...base,
    id: `score-${realmSlug}`,
    realmSlug,
    bpm: theme === 'citadel-highlands' ? 88 + Math.round(r() * 6) : base.bpm,
  };
}

/**
 * Generates a fresh, musically coherent non-repeating orchestral score blueprint
 * from a seed, mode, tempo, and creative brief (used by Verdant MCP `verdant_compose_score`).
 */
export function synthesizeScoreFromBrief(params: {
  realmSlug: string;
  realmName: string;
  theme: string;
  isDungeon?: boolean;
  title?: string;
  composerNote?: string;
  mode?: MusicalModeId;
  bpm?: number;
  seed?: number;
}): RealmSoundtrackSpec {
  const seed = params.seed ?? (Date.now() % 100000);
  const rand = seededRand(seed);
  const base = getCanonicalSoundtrackForTheme(
    params.theme,
    Boolean(params.isDungeon),
    params.realmSlug,
    params.realmName,
    seed,
  );
  const modes: MusicalModeId[] = [
    'dorian',
    'lydian',
    'mixolydian',
    'aeolian',
    'pentatonic-major',
    'harmonic-minor',
    'phrygian-dominant',
  ];
  const meters: MusicalMeterId[] = ['4/4', '3/4', '6/8'];
  const meter = meters[Math.floor(rand() * meters.length)];
  const phraseSteps = meter === '4/4' ? 16 : 12;
  const mode = params.mode ?? modes[Math.floor(rand() * modes.length)];
  const bpm = Math.max(70, Math.min(126, Math.round(params.bpm ?? base.bpm + (rand() - 0.5) * 20)));
  const rootOffsets = [-2, 0, 2, 3, 5, -3];
  const rootMidi = Math.max(43, Math.min(58, base.rootMidi + rootOffsets[Math.floor(rand() * rootOffsets.length)]));

  const chordTemplates = [
    [0, 6, 3, 4, 0, 5, 3, 4],
    [0, 3, 5, 4, 2, 6, 4, 0],
    [0, 2, 4, 3, 5, 2, 6, 4],
    [0, 5, 6, 3, 0, 4, 2, 0],
  ];
  const chordProgression = chordTemplates[Math.floor(rand() * chordTemplates.length)];

  const buildPhrase = (startDeg: number): ScoreStepNote[] => {
    const notes: ScoreStepNote[] = [];
    let cursor = 0;
    const melodicPool = [4, 5, 6, 7, 8, 9, 10, 11, 12];
    let lastDeg = startDeg;
    while (cursor < phraseSteps) {
      const remaining = phraseSteps - cursor;
      const isRest = cursor > 3 && cursor < phraseSteps - 2 && rand() < 0.2;
      const len = Math.min(remaining, rand() < 0.35 ? 3 : rand() < 0.7 ? 2 : 1);
      if (isRest) {
        notes.push({ degree: null, lengthSteps: len, velocity: 0 });
      } else {
        const stepDelta = Math.floor(rand() * 5) - 2;
        const idx = Math.max(0, Math.min(melodicPool.length - 1, melodicPool.indexOf(lastDeg) + stepDelta));
        lastDeg = melodicPool[idx] ?? 7;
        notes.push({
          degree: lastDeg,
          lengthSteps: len,
          velocity: Number((0.66 + rand() * 0.26).toFixed(2)),
        });
      }
      cursor += len;
    }
    return notes;
  };

  const arpPatterns =
    meter === '4/4'
      ? [
          [0, 4, 7, 9, 7, 4, 2, 4, 0, 5, 7, 11, 9, 7, 4, 2],
          [0, 2, 4, 7, 11, 9, 7, 4, 0, 4, 6, 9, 7, 4, null, 2],
        ]
      : [
          [0, 4, 7, 9, 7, 4, 0, 3, 7, 10, 7, 3],
          [0, 2, 4, 7, 4, 2, 0, 5, 7, 11, 7, 5],
        ];

  return {
    ...base,
    id: `score-${params.realmSlug}-${seed}`,
    title: params.title || `${params.realmName} — Movement ${1 + (seed % 7)}`,
    composerNote:
      params.composerNote ||
      `Verdant ${meter} ${mode} movement at ${bpm} BPM with hammered dulcimer, pizzicato bass, wooden flute, and chamber reed.`,
    mode,
    meter,
    rootMidi,
    bpm,
    chordProgression,
    melodyMotif: buildPhrase(7),
    sectionBMelody: buildPhrase(10),
    sectionCMelody: buildPhrase(9),
    harpArpeggio: arpPatterns[Math.floor(rand() * arpPatterns.length)],
    bassPattern: meter === '4/4' ? [0, null, 4, null, 0, null, 2, 4] : [0, null, 4, null, 2, null],
    dulcimerPattern: meter === '4/4' ? [7, null, 9, 11, null, 9, 7, 4] : [7, 9, null, 11, 9, 7],
    instrumentation: {
      ...base.instrumentation,
      dulcimer: Number((0.55 + rand() * 0.4).toFixed(2)),
      pizzicato: Number((0.55 + rand() * 0.35).toFixed(2)),
      reed: Number((0.5 + rand() * 0.4).toFixed(2)),
    },
    workletTuning: {
      ...base.workletTuning,
      fundamentalHz: Math.round(midiToHz(rootMidi + 12)),
    },
  };
}
