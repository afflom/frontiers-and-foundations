import type { DialogueChoice, GameNpc, RegionId } from '../game/worldData';
import type { RealmThemeId } from './realmModelSchema';
import type {
  CharacterBeardStyle,
  CharacterClaspKind,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterPropKind,
  CharacterSatchelStyle,
  RgbTuple,
  VerdantCharacterAppearance,
} from './verdantCharacterTypes';

/**
 * Deterministic 32-bit PRNG (Mulberry32) seeded from Verdant cell + character index.
 */
export function createSeededRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function rgbToHexStr(rgb: RgbTuple, mul = 1): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * mul * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

function rgbToNum(rgb: RgbTuple): number {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
  return (r << 16) | (g << 8) | b;
}

const SKIN_PALETTES: readonly RgbTuple[] = [
  [0.86, 0.70, 0.58], // Fair highland ivory
  [0.82, 0.62, 0.49], // Warm sunlit peach
  [0.77, 0.56, 0.42], // Olive ochre
  [0.72, 0.50, 0.36], // Weathered bronze
  [0.62, 0.41, 0.29], // Copper chestnut
  [0.51, 0.33, 0.23], // Deep warm umber
  [0.40, 0.26, 0.19], // Rich mahogany
  [0.83, 0.68, 0.60], // Cool alpine pale
];

const HAIR_PALETTES: readonly RgbTuple[] = [
  [0.14, 0.11, 0.10], // Raven charcoal
  [0.29, 0.19, 0.13], // Dark walnut
  [0.52, 0.26, 0.14], // Burnished copper-auburn
  [0.72, 0.56, 0.31], // Flaxen honey-gold
  [0.67, 0.67, 0.69], // Silver-iron grey
  [0.84, 0.85, 0.88], // Frost white
  [0.24, 0.27, 0.34], // Deep slate-indigo
  [0.44, 0.32, 0.21], // Warm chestnut
];

const EYE_PALETTES: readonly RgbTuple[] = [
  [0.24, 0.20, 0.15], // Warm dark brown
  [0.22, 0.36, 0.44], // Sea-glass slate
  [0.24, 0.46, 0.30], // Moss emerald
  [0.56, 0.38, 0.16], // Amber-gold
  [0.34, 0.28, 0.44], // Storm violet-grey
  [0.42, 0.28, 0.18], // Hazel copper
];

const THEME_GARMENT_PALETTES: Record<RealmThemeId, readonly RgbTuple[]> = {
  'citadel-highlands': [
    [0.20, 0.26, 0.34],
    [0.34, 0.24, 0.22],
    [0.22, 0.32, 0.30],
    [0.30, 0.28, 0.25],
  ],
  'sunken-aqueducts': [
    [0.21, 0.38, 0.32],
    [0.28, 0.42, 0.30],
    [0.20, 0.31, 0.36],
    [0.38, 0.34, 0.24],
  ],
  'obsidian-crucible': [
    [0.42, 0.19, 0.16],
    [0.21, 0.21, 0.24],
    [0.48, 0.28, 0.15],
    [0.32, 0.18, 0.22],
  ],
  'pelagic-spires': [
    [0.16, 0.35, 0.42],
    [0.20, 0.28, 0.44],
    [0.22, 0.38, 0.34],
    [0.42, 0.38, 0.28],
  ],
  'amber-steppe': [
    [0.54, 0.34, 0.19],
    [0.46, 0.24, 0.18],
    [0.34, 0.40, 0.26],
    [0.48, 0.40, 0.25],
  ],
  'glacial-spire': [
    [0.22, 0.34, 0.48],
    [0.32, 0.40, 0.46],
    [0.28, 0.24, 0.40],
    [0.46, 0.48, 0.52],
  ],
};

const TRIM_PALETTES: readonly RgbTuple[] = [
  [0.86, 0.68, 0.30], // Burnished gold
  [0.78, 0.48, 0.24], // Hammered copper
  [0.74, 0.78, 0.84], // Forged silver
  [0.46, 0.76, 0.64], // Verdigris bronze
  [0.84, 0.58, 0.34], // Warm brass
];

const LEATHER_PALETTES: readonly RgbTuple[] = [
  [0.40, 0.25, 0.15],
  [0.32, 0.20, 0.13],
  [0.48, 0.30, 0.17],
  [0.26, 0.19, 0.16],
];

const FIRST_NAMES = [
  'Aldric', 'Bramwell', 'Caelia', 'Davor', 'Elowen', 'Fiora', 'Garrick', 'Haldor',
  'Iona', 'Jorik', 'Kestrel', 'Liora', 'Maren', 'Nolan', 'Orla', 'Perrin',
  'Quillan', 'Rowena', 'Soren', 'Tamsin', 'Ulric', 'Vespera', 'Weylin', 'Yara',
  'Zarek', 'Aveline', 'Corvin', 'Dahlia', 'Evander', 'Freya', 'Gideon', 'Hesper',
] as const;

const SURNAMES = [
  'Ashford', 'Blackwell', 'Cairnwright', 'Duskmore', 'Emberlyn', 'Fallow', 'Grimshaw', 'Hearthstone',
  'Ironreed', 'Kestrel', 'Loomis', 'Mireholm', 'Northvale', 'Oakhart', 'Pelagis', 'Quarry',
  'Redbrook', 'Saltwind', 'Thornfield', 'Upland', 'Vane', 'Weir', 'Yewcroft', 'Basaltis',
  'Sluiceborn', 'Frostvane', 'Kilnward', 'Strata', 'Pendulum', 'Plumbline', 'Cinderhook', 'Veridian',
] as const;

interface RoleTemplate {
  titlePrefixes: readonly string[];
  guildId: string;
  guildName: string;
  garmentStyles: readonly CharacterGarmentStyle[];
  satchelStyle: CharacterSatchelStyle;
  props: readonly CharacterPropKind[];
  claspKind: CharacterClaspKind;
  hasPauldrons: boolean;
  bareForearmsChance: number;
  drives: readonly string[];
  secrets: readonly string[];
  cadences: readonly string[];
  beliefsPool: readonly string[];
}

const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    titlePrefixes: ['Chief Meridian Surveyor', 'Geodesic Cartographer', 'Arch-Draftsman', 'Boundary Auditor'],
    guildId: 'guild-causeway',
    guildName: 'Charter of the Southern Causeway',
    garmentStyles: ['hooded-cloak', 'archon-vestments', 'waywright-longcoat'],
    satchelStyle: 'twin-scroll',
    props: ['brass-dividers', 'astrolabe-staff', 'ledger-quill'],
    claspKind: 'runic-gold',
    hasPauldrons: false,
    bareForearmsChance: 0.0,
    drives: [
      'Re-triangulate the shifting boundary stones before the seasonal caravans misread the pass.',
      'Audit the subterranean load-bearing vaults beneath the frontier causeway arches.',
      'Link this cell’s waystone bearings into the wider Stitch Meridian atlas.',
    ],
    secrets: [
      'Discovered an older pre-Charter survey marker buried two meters beneath the northern road that contradicts guild tax maps.',
      'Quietly altered the bearing tables so independent freeholders can traverse the ridge without syndicate tolls.',
    ],
    cadences: [
      'Precise and architectural, weighing every claim in span lengths and plumb-line tolerances.',
      'Crisp, curious, sketching sightlines in the air with brass calipers.',
    ],
    beliefsPool: [
      'Every border stone remembers the hands that set it.',
      'Shared coordinates keep the frontier free from toll-monopolies.',
      'Stone shifts slower than politics, so trust the bedrock.',
    ],
  },
  {
    titlePrefixes: ['Master Harmonic Founder', 'Acoustics Metallurgist', 'Kiln Bell-Wright', 'Basalt Mason'],
    guildId: 'guild-kiln',
    guildName: 'Ashen Kiln Conclave',
    garmentStyles: ['smith-apron', 'ranger-brigandine'],
    satchelStyle: 'smith-belt',
    props: ['tuning-fork', 'mason-mallet', 'survey-lantern'],
    claspKind: 'copper-buckle',
    hasPauldrons: true,
    bareForearmsChance: 0.72,
    drives: [
      'Tune the outer frontier fog-bells so caravans can navigate zero-visibility storms by ear alone.',
      'Temper a new phosphor-bronze alloy resilient enough to seal deep tectonic fractures.',
      'Restore the resonant sounding plates silenced by encroaching construct herds.',
    ],
    secrets: [
      'Reforged salvaged pre-Charter vault hinges into acoustic resonators without reporting the find to the Citadel.',
      'Knows a harmonic pitch that temporarily calms slumbering basalt colossi.',
    ],
    cadences: [
      'Deep and rhythmic, testing masonry with a steady knuckle-tap between sentences.',
      'Direct, warm, speaking clearly as though over the hiss of a quenching trough.',
    ],
    beliefsPool: [
      'Good bronze sings true even when the mist blinds the watchtower.',
      'Strength without resonance shatters under the first winter tremor.',
      'Anvil dust teaches patience faster than any council scroll.',
    ],
  },
  {
    titlePrefixes: ['Tide-Loom Navigator', 'Watershed Hydrographer', 'Sluice-Lock Keeper', 'Barometric Scout'],
    guildId: 'guild-tideloom',
    guildName: 'Tide-Loom Cartographers',
    garmentStyles: ['oilskin-coat', 'ranger-brigandine', 'waywright-longcoat'],
    satchelStyle: 'chart-satchel',
    props: ['ledger-quill', 'survey-lantern', 'astrolabe-staff'],
    claspKind: 'bronze-crest',
    hasPauldrons: false,
    bareForearmsChance: 0.15,
    drives: [
      'Chart how the local watershed currents erode the outer frontier piers each solstice.',
      'String tensioned copper signal-wire between this cell’s watchtower and neighboring frontiers.',
      'Track migratory construct packs moving along the river gorges at dusk.',
    ],
    secrets: [
      'Keeps a hidden cache of waterproof wax-sealed charts pointing to an unchartered subterranean cistern.',
      'Diverted a minor overflow sluice to revive a parched orchard beyond the eastern border gate.',
    ],
    cadences: [
      'Brisk and nautical, measuring time in pressure drops and wind shifts.',
      'Observant, laconic, eyes constantly scanning the distant horizon ridges.',
    ],
    beliefsPool: [
      'Ink fades by equinox; live waystones and copper wire keep their word.',
      'Water always finds the oldest seam in the foundation.',
      'A scout who ignores the barometer walks straight into a squall.',
    ],
  },
  {
    titlePrefixes: ['Silicate Botanist', 'Spore-Mortar Alchemist', 'Rootward Ecologist', 'Acoustic Archivist'],
    guildId: 'guild-causeway',
    guildName: 'Fen-Glass Collective',
    garmentStyles: ['herbalist-coat', 'archon-vestments', 'hooded-cloak'],
    satchelStyle: 'herb-satchel',
    props: ['specimen-jar', 'resonance-lute', 'survey-lantern'],
    claspKind: 'leaf-emerald',
    hasPauldrons: false,
    bareForearmsChance: 0.05,
    drives: [
      'Cultivate mineral-drinking moss strains that knit cracked flagstones overnight.',
      'Catalogue how local wildlife responds to the low-frequency hum of frontier waystones.',
      'Preserve rare bioluminescent flora thriving beside the cell’s ancient monolith stones.',
    ],
    secrets: [
      'Her newest mortar culture glows faintly whenever subterranean magma or floodwater shifts below.',
      'Has been exchanging living seed-spores with rangers two cells east against Citadel quarantine rules.',
    ],
    cadences: [
      'Tactile and inquisitive, inspecting soil dust and moss filaments mid-sentence.',
      'Melodic and thoughtful, pausing to listen to wind chimes and distant bird calls.',
    ],
    beliefsPool: [
      'Living foundations repair themselves; dead stone only waits to fracture.',
      'Every biome writes its history in root rings and mineral veins.',
      'Listening to the land is the first duty of a Waywright.',
    ],
  },
];

const ALL_HAIR_STYLES: readonly CharacterHairStyle[] = [
  'braided-crown',
  'windswept',
  'cropped-grey',
  'braided-locs',
  'waywright-swept',
  'scholar-bun',
  'twin-braids',
  'horned-circlet',
];

const ALL_BEARD_STYLES: readonly CharacterBeardStyle[] = [
  'none',
  'none',
  'none',
  'trimmed-grey',
  'full-smith',
  'goatee',
  'braided-beard',
];

/**
 * Synthesizes a high-definition, painterly SVG data-URI portrait rendered DIRECTLY
 * from a character's exact VerdantCharacterAppearance traits, guaranteeing 100%
 * visual parity between the menu portrait and the in-world 3D character rig for
 * infinite procedurally generated NPCs across the boundless universe!
 */
export function synthesizeCharacterPortraitDataUri(
  app: VerdantCharacterAppearance,
  biomeSkyRgb: RgbTuple = [0.28, 0.39, 0.48],
  characterName = 'Waywright',
): string {
  const skyTop = rgbToHexStr(biomeSkyRgb, 0.65);
  const skyMid = rgbToHexStr(biomeSkyRgb, 1.05);
  const skyGlow = rgbToHexStr(app.trimRgb, 0.92);
  const skin = rgbToHexStr(app.skinRgb, 1.02);
  const skinShadow = rgbToHexStr(app.skinRgb, 0.78);
  const skinHi = rgbToHexStr(app.skinRgb, 1.14);
  const hair = rgbToHexStr(app.hairRgb, 1.0);
  const hairHi = rgbToHexStr(app.hairRgb, 1.24);
  const hairDark = rgbToHexStr(app.hairRgb, 0.68);
  const garment = rgbToHexStr(app.garmentRgb, 1.0);
  const garmentDark = rgbToHexStr(app.garmentRgb, 0.68);
  const garmentHi = rgbToHexStr(app.garmentRgb, 1.22);
  const under = rgbToHexStr(app.underTunicRgb, 1.0);
  const trim = rgbToHexStr(app.trimRgb, 1.05);
  const leather = rgbToHexStr(app.leatherRgb, 1.0);
  const clasp = rgbToHexStr(app.claspRgb, 1.05);
  const eye = rgbToHexStr(app.eyeRgb, 1.0);
  const isBroad = app.buildScale[0] >= 1.1;
  const shoulderW = isBroad ? 104 : 92;

  // Hair back layer (behind head & shoulders)
  let hairBackSvg = '';
  if (app.hairStyle === 'braided-locs') {
    hairBackSvg = `
      <g fill="${hair}" stroke="${hairDark}" stroke-width="1.5">
        <path d="M98,108 C86,138 82,175 88,215 L104,215 C100,178 104,145 110,118 Z"/>
        <path d="M158,108 C170,138 174,175 168,215 L152,215 C156,178 152,145 146,118 Z"/>
        <circle cx="94" cy="148" r="8"/><circle cx="91" cy="168" r="7.5"/><circle cx="90" cy="188" r="7"/>
        <circle cx="162" cy="148" r="8"/><circle cx="165" cy="168" r="7.5"/><circle cx="166" cy="188" r="7"/>
      </g>`;
  } else if (app.hairStyle === 'twin-braids') {
    hairBackSvg = `
      <g fill="${hair}" stroke="${hairDark}" stroke-width="1.4">
        <ellipse cx="92" cy="144" rx="9" ry="12"/><ellipse cx="89" cy="164" rx="8.5" ry="11"/><ellipse cx="87" cy="184" rx="7.5" ry="10"/>
        <ellipse cx="164" cy="144" rx="9" ry="12"/><ellipse cx="167" cy="164" rx="8.5" ry="11"/><ellipse cx="169" cy="184" rx="7.5" ry="10"/>
        <rect x="81" y="191" width="12" height="5" rx="2" fill="${trim}"/>
        <rect x="163" y="191" width="12" height="5" rx="2" fill="${trim}"/>
      </g>`;
  } else if (app.hairStyle === 'scholar-bun') {
    hairBackSvg = `
      <circle cx="128" cy="54" r="22" fill="${hair}" stroke="${hairDark}" stroke-width="2"/>
      <path d="M104,54 L152,54" stroke="${trim}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="154" cy="54" r="4" fill="${trim}"/>`;
  } else if (app.hairStyle === 'windswept') {
    hairBackSvg = `
      <path d="M84,92 C72,72 95,46 132,48 C166,50 184,74 176,104 C172,118 164,132 158,142 L94,138 C86,124 80,108 84,92 Z" fill="${hair}"/>`;
  }

  // Garment torso & collar layer
  let garmentSvg = '';
  if (app.garmentStyle === 'hooded-cloak') {
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},198 88,166 128,166 C168,166 ${128 + shoulderW},198 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <path d="M96,174 Q128,202 160,174 L152,256 L104,256 Z" fill="${under}"/>
      <path d="M74,174 C90,152 166,152 182,174 C168,196 88,196 74,174 Z" fill="${garmentHi}" stroke="${garmentDark}" stroke-width="2"/>
      <path d="M96,184 L112,256 M160,184 L144,256" stroke="${leather}" stroke-width="9" stroke-linecap="round"/>`;
  } else if (app.garmentStyle === 'oilskin-coat') {
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},194 86,166 128,166 C170,166 ${128 + shoulderW},194 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <polygon points="112,172 144,172 136,256 120,256" fill="${under}"/>
      <path d="M78,192 L96,152 L114,180 Z" fill="${garmentHi}" stroke="${garmentDark}" stroke-width="2"/>
      <path d="M178,192 L160,152 L142,180 Z" fill="${garmentHi}" stroke="${garmentDark}" stroke-width="2"/>
      <path d="M84,210 L176,244" stroke="${leather}" stroke-width="10"/>`;
  } else if (app.garmentStyle === 'smith-apron') {
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},190 82,164 128,164 C174,164 ${128 + shoulderW},190 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <rect x="94" y="184" width="68" height="72" rx="4" fill="${leather}" stroke="${garmentDark}" stroke-width="2"/>
      <path d="M102,166 L102,190 M154,166 L154,190" stroke="${leather}" stroke-width="9"/>
      <circle cx="102" cy="190" r="4" fill="${trim}"/><circle cx="154" cy="190" r="4" fill="${trim}"/>`;
  } else if (app.garmentStyle === 'herbalist-coat') {
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},196 86,166 128,166 C170,166 ${128 + shoulderW},196 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <path d="M100,158 L156,158 L152,188 L104,188 Z" fill="${garmentHi}" stroke="${trim}" stroke-width="2"/>
      <path d="M106,184 L128,244 L150,184" fill="none" stroke="${trim}" stroke-width="3.2"/>
      <ellipse cx="78" cy="194" rx="22" ry="13" fill="${leather}" stroke="${trim}" stroke-width="1.6"/>
      <ellipse cx="178" cy="194" rx="22" ry="13" fill="${leather}" stroke="${trim}" stroke-width="1.6"/>`;
  } else if (app.garmentStyle === 'archon-vestments') {
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},194 86,166 128,166 C170,166 ${128 + shoulderW},194 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <path d="M98,170 L128,256 L158,170 Z" fill="${under}" stroke="${trim}" stroke-width="3"/>
      <path d="M84,178 Q128,208 172,178" fill="none" stroke="${trim}" stroke-width="6"/>
      <path d="M94,164 Q128,176 162,164" fill="none" stroke="${trim}" stroke-width="3"/>`;
  } else {
    // ranger-brigandine / waywright-longcoat / guild-waywright
    garmentSvg = `
      <path d="M${128 - shoulderW},256 C${128 - shoulderW},194 84,166 128,166 C172,166 ${128 + shoulderW},194 ${128 + shoulderW},256 Z" fill="${garment}"/>
      <path d="M104,174 L128,232 L152,174" fill="${under}" stroke="${trim}" stroke-width="2.4"/>
      <path d="M84,176 L172,252" stroke="${leather}" stroke-width="10"/>
      ${app.hasPauldrons ? `<ellipse cx="72" cy="198" rx="24" ry="15" fill="${trim}" stroke="${garmentDark}" stroke-width="2"/><ellipse cx="184" cy="198" rx="24" ry="15" fill="${trim}" stroke="${garmentDark}" stroke-width="2"/>` : ''}`;
  }

  // Chest Clasp / Brooch
  let claspSvg = '';
  if (app.claspKind === 'leaf-emerald') {
    claspSvg = `<path d="M128,176 C137,183 137,196 128,204 C119,196 119,183 128,176 Z" fill="${clasp}" stroke="${trim}" stroke-width="1.6"/>`;
  } else if (app.claspKind === 'runic-gold') {
    claspSvg = `<rect x="114" y="180" width="28" height="14" rx="3" fill="${clasp}" stroke="${garmentDark}" stroke-width="1.5"/><circle cx="128" cy="187" r="3.5" fill="${garmentDark}"/>`;
  } else {
    claspSvg = `<polygon points="128,176 138,187 128,198 118,187" fill="${clasp}" stroke="${garmentDark}" stroke-width="1.5"/>`;
  }

  // Hair front crown layer
  let hairFrontSvg = '';
  if (app.hairStyle === 'braided-crown') {
    hairFrontSvg = `
      <path d="M86,108 C86,66 170,66 170,108 C164,86 148,78 128,78 C108,78 92,86 86,108 Z" fill="${hair}"/>
      <path d="M90,82 Q128,60 166,82" fill="none" stroke="${hairHi}" stroke-width="10" stroke-linecap="round"/>
      <g fill="${hair}" stroke="${hairDark}" stroke-width="1.2">
        <circle cx="92" cy="146" r="9"/><circle cx="89" cy="162" r="8.5"/><circle cx="88" cy="178" r="8"/><circle cx="90" cy="194" r="7"/>
      </g>`;
  } else if (app.hairStyle === 'windswept') {
    hairFrontSvg = `
      <path d="M84,110 C82,66 122,52 162,68 C176,74 178,94 170,112 C164,90 144,80 120,84 C102,86 92,98 84,110 Z" fill="${hair}"/>
      <path d="M98,74 Q134,58 164,76" fill="none" stroke="${hairHi}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (app.hairStyle === 'cropped-grey') {
    hairFrontSvg = `
      <path d="M88,104 C88,68 168,68 168,104 C162,86 146,80 128,80 C110,80 94,86 88,104 Z" fill="${hair}"/>`;
  } else if (app.hairStyle === 'horned-circlet') {
    hairFrontSvg = `
      <path d="M86,106 C86,66 170,66 170,106 C162,84 146,78 128,78 C110,78 94,84 86,106 Z" fill="${hair}"/>
      <path d="M86,88 Q128,76 170,88" fill="none" stroke="${trim}" stroke-width="5"/>
      <polygon points="128,64 134,82 122,82" fill="${trim}" stroke="${garmentDark}" stroke-width="1.2"/>`;
  } else {
    hairFrontSvg = `
      <path d="M86,108 C86,64 170,64 170,108 C162,86 144,78 126,80 C106,82 94,90 86,108 Z" fill="${hair}"/>
      <path d="M96,76 Q128,64 156,78" fill="none" stroke="${hairHi}" stroke-width="3.5" stroke-linecap="round"/>`;
  }

  // Facial hair / beard layer
  let beardSvg = '';
  if (app.beardStyle === 'trimmed-grey') {
    beardSvg = `
      <path d="M95,126 C95,152 112,164 128,164 C144,164 161,152 161,126 C154,142 142,148 128,148 C114,148 102,142 95,126 Z" fill="${hair}" opacity="0.94"/>
      <path d="M114,138 Q128,133 142,138" fill="none" stroke="${hairHi}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (app.beardStyle === 'full-smith') {
    beardSvg = `
      <path d="M92,122 C90,158 108,176 128,178 C148,176 166,158 164,122 C154,140 144,144 128,144 C112,144 102,140 92,122 Z" fill="${hair}"/>
      <path d="M108,136 Q128,129 148,136" fill="none" stroke="${hairHi}" stroke-width="5.5" stroke-linecap="round"/>`;
  } else if (app.beardStyle === 'goatee') {
    beardSvg = `
      <path d="M115,146 Q128,166 141,146 Q128,152 115,146 Z" fill="${hair}"/>
      <path d="M116,138 Q128,134 140,138" fill="none" stroke="${hair}" stroke-width="3.2" stroke-linecap="round"/>`;
  } else if (app.beardStyle === 'braided-beard') {
    beardSvg = `
      <path d="M94,124 C96,154 110,168 128,172 C146,168 160,154 162,124 C150,142 140,145 128,145 C116,145 106,142 94,124 Z" fill="${hair}"/>
      <ellipse cx="128" cy="176" rx="10" ry="8" fill="${hairDark}"/>
      <rect x="119" y="180" width="18" height="5" rx="2" fill="${trim}"/>`;
  }

  // Signature prop rendered in the foreground right/left corner
  let propSvg = '';
  if (app.signatureProp === 'brass-dividers') {
    propSvg = `
      <g transform="translate(196,192) rotate(-14)">
        <circle cx="0" cy="-22" r="7" fill="${trim}" stroke="#1a150e" stroke-width="1.5"/>
        <path d="M-2,-16 L-14,34 M2,-16 L14,34" stroke="${trim}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M-10,6 Q0,12 10,6" fill="none" stroke="${trim}" stroke-width="2.5"/>
      </g>`;
  } else if (app.signatureProp === 'tuning-fork') {
    propSvg = `
      <g transform="translate(206,196) rotate(10)">
        <path d="M0,12 L0,42 M-10,-28 L-10,4 Q-10,14 0,14 Q10,14 10,4 L10,-28" fill="none" stroke="${trim}" stroke-width="5" stroke-linecap="round"/>
      </g>`;
  } else if (app.signatureProp === 'specimen-jar') {
    propSvg = `
      <g transform="translate(204,202)">
        <rect x="-15" y="-22" width="30" height="44" rx="7" fill="#2cd4b8" fill-opacity="0.35" stroke="#7ef5de" stroke-width="2"/>
        <polygon points="0,-10 9,2 0,14 -9,2" fill="#f5c451"/>
        <rect x="-11" y="-30" width="22" height="9" rx="2" fill="${leather}"/>
      </g>`;
  } else if (app.signatureProp === 'astrolabe-staff') {
    propSvg = `
      <g transform="translate(208,184)">
        <line x1="0" y1="-26" x2="0" y2="70" stroke="${leather}" stroke-width="6"/>
        <circle cx="0" cy="-30" r="18" fill="none" stroke="${trim}" stroke-width="3.5"/>
        <circle cx="0" cy="-30" r="10" fill="none" stroke="${trim}" stroke-width="2"/>
        <circle cx="0" cy="-30" r="4.5" fill="#6be8d4"/>
      </g>`;
  } else if (app.signatureProp === 'survey-lantern') {
    propSvg = `
      <g transform="translate(206,204)">
        <rect x="-13" y="-18" width="26" height="32" rx="3" fill="#2a2219" stroke="${trim}" stroke-width="2.5"/>
        <polygon points="0,-10 8,0 0,10 -8,0" fill="#ffd97d"/>
        <path d="M-9,-18 Q0,-30 9,-18" fill="none" stroke="${trim}" stroke-width="2.5"/>
      </g>`;
  } else if (app.signatureProp === 'resonance-lute') {
    propSvg = `
      <g transform="translate(204,206) rotate(-18)">
        <ellipse cx="0" cy="14" rx="18" ry="24" fill="${leather}" stroke="${trim}" stroke-width="2"/>
        <rect x="-4" y="-38" width="8" height="34" fill="${leather}"/>
        <circle cx="0" cy="12" r="6" fill="#1a120c" stroke="${trim}" stroke-width="1.5"/>
      </g>`;
  } else if (app.signatureProp === 'mason-mallet') {
    propSvg = `
      <g transform="translate(206,200) rotate(-22)">
        <rect x="-4" y="-14" width="8" height="58" rx="2" fill="${leather}"/>
        <rect x="-18" y="-30" width="36" height="20" rx="3" fill="${trim}" stroke="#1c1610" stroke-width="1.8"/>
      </g>`;
  } else {
    // ledger-quill
    propSvg = `
      <g transform="translate(202,212) rotate(-8)">
        <rect x="-20" y="-16" width="38" height="28" rx="2" fill="${leather}" stroke="${trim}" stroke-width="1.5"/>
        <rect x="-16" y="-12" width="30" height="20" fill="#efe4cb"/>
        <path d="M10,-32 C22,-22 18,-4 6,4" fill="none" stroke="${trim}" stroke-width="4" stroke-linecap="round"/>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${characterName.replace(/["<>]/g, '')}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="68%" stop-color="${skyMid}"/>
      <stop offset="100%" stop-color="#141921"/>
    </linearGradient>
    <radialGradient id="rim" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="${skyGlow}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${skyGlow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="faceGrad" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="${skinHi}"/>
      <stop offset="55%" stop-color="${skin}"/>
      <stop offset="100%" stop-color="${skinShadow}"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#bg)"/>
  <rect width="256" height="256" fill="url(#rim)"/>
  <path d="M0,192 L38,162 L76,178 L128,154 L182,174 L224,158 L256,184 L256,256 L0,256 Z" fill="#0d1218" opacity="0.45"/>
  ${hairBackSvg}
  ${garmentSvg}
  ${claspSvg}
  <!-- Neck -->
  <path d="M111,148 L145,148 L148,176 Q128,186 108,176 Z" fill="${skinShadow}"/>
  <!-- Ears -->
  <ellipse cx="90" cy="116" rx="7" ry="12" fill="${skinShadow}"/>
  <ellipse cx="166" cy="116" rx="7" ry="12" fill="${skinShadow}"/>
  <!-- Sculpted Head & Jawline -->
  <path d="M92,102 C92,68 164,68 164,102 C164,132 152,154 128,158 C104,154 92,132 92,102 Z" fill="url(#faceGrad)"/>
  <!-- Cheek & Nose contour -->
  <path d="M128,104 L125,126 L133,127" fill="none" stroke="${skinShadow}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Eyes -->
  <ellipse cx="111" cy="111" rx="8.5" ry="4.6" fill="#f5f2ec"/>
  <ellipse cx="145" cy="111" rx="8.5" ry="4.6" fill="#f5f2ec"/>
  <circle cx="111" cy="111" r="4.1" fill="${eye}"/>
  <circle cx="145" cy="111" r="4.1" fill="${eye}"/>
  <circle cx="109.5" cy="109.5" r="1.4" fill="#ffffff"/>
  <circle cx="143.5" cy="109.5" r="1.4" fill="#ffffff"/>
  <!-- Eyebrows -->
  <path d="M101,102 Q111,98 121,102" fill="none" stroke="${hairDark}" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M135,102 Q145,98 155,102" fill="none" stroke="${hairDark}" stroke-width="3.2" stroke-linecap="round"/>
  <!-- Mouth -->
  <path d="M117,139 Q128,144 139,139" fill="none" stroke="${skinShadow}" stroke-width="2.8" stroke-linecap="round"/>
  ${beardSvg}
  ${hairFrontSvg}
  ${propSvg}
  <rect x="4" y="4" width="248" height="248" fill="none" stroke="${trim}" stroke-opacity="0.35" stroke-width="2"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface SynthesizeCharacterOptions {
  seed: number;
  id?: string;
  cellKey?: string;
  realmName: string;
  theme: RealmThemeId;
  biomeSkyRgb: RgbTuple;
  regionId: RegionId;
  position: [number, number];
  roleIndex?: number;
  roleHint?: 'warden' | 'artisan' | 'scholar' | 'navigator' | 'scout';
  avoidNames?: Set<string>;
  questId?: string;
  dungeonName?: string;
  brief?: string;
}

const ROLE_HINT_INDEX: Record<NonNullable<SynthesizeCharacterOptions['roleHint']>, number> = {
  warden: 0,
  artisan: 1,
  scholar: 2,
  navigator: 3,
  scout: 4,
};

/**
 * Verdant Procedural Character Synthesizer.
 * Deterministically synthesizes a complete, differentiated RPG character with ALL
 * physical, sartorial, cognitive, and narrative characteristics AND a 1:1 synchronized
 * painterly portrait rendered directly from their exact genome traits.
 */
export function synthesizeVerdantCharacter(opts: SynthesizeCharacterOptions): {
  npc: GameNpc;
  appearance: VerdantCharacterAppearance;
} {
  const rng = createSeededRng(opts.seed);
  const resolvedRoleIdx =
    opts.roleIndex !== undefined
      ? opts.roleIndex
      : opts.roleHint !== undefined
        ? ROLE_HINT_INDEX[opts.roleHint]
        : Math.floor(rng() * ROLE_TEMPLATES.length);
  const role = ROLE_TEMPLATES[Math.abs(resolvedRoleIdx) % ROLE_TEMPLATES.length];

  let firstName = pick(rng, FIRST_NAMES);
  let surname = pick(rng, SURNAMES);
  let name = `${firstName} ${surname}`;
  if (opts.avoidNames) {
    for (let tries = 0; tries < 12 && opts.avoidNames.has(name); tries++) {
      firstName = pick(rng, FIRST_NAMES);
      surname = pick(rng, SURNAMES);
      name = `${firstName} ${surname}`;
    }
  }
  const title = pick(rng, role.titlePrefixes);

  const skinRgb = pick(rng, SKIN_PALETTES);
  const hairRgb = pick(rng, HAIR_PALETTES);
  const eyeRgb = pick(rng, EYE_PALETTES);
  const garmentRgb = pick(rng, THEME_GARMENT_PALETTES[opts.theme] ?? THEME_GARMENT_PALETTES['citadel-highlands']);
  const underTunicRgb: RgbTuple = [
    Math.max(0.12, garmentRgb[0] * 0.7 + 0.10),
    Math.max(0.12, garmentRgb[1] * 0.68 + 0.08),
    Math.max(0.12, garmentRgb[2] * 0.65 + 0.06),
  ];
  const trimRgb = pick(rng, TRIM_PALETTES);
  const leatherRgb = pick(rng, LEATHER_PALETTES);
  const claspRgb: RgbTuple =
    role.claspKind === 'leaf-emerald'
      ? [0.34, 0.72, 0.42]
      : role.claspKind === 'copper-buckle'
        ? [0.82, 0.50, 0.25]
        : trimRgb;

  const garmentStyle = pick(rng, role.garmentStyles);
  const hairStyle = pick(rng, ALL_HAIR_STYLES);
  const beardStyle = pick(rng, ALL_BEARD_STYLES);
  const signatureProp = pick(rng, role.props);
  const bareForearms = garmentStyle === 'smith-apron' || rng() < role.bareForearmsChance;
  const hasHoodDown = garmentStyle === 'hooded-cloak' || rng() < 0.25;
  const hasPauldrons = role.hasPauldrons || garmentStyle === 'ranger-brigandine';

  const wScale = garmentStyle === 'smith-apron' ? 1.12 + rng() * 0.08 : 0.94 + rng() * 0.14;
  const hScale = 0.96 + rng() * 0.10;
  const dScale = garmentStyle === 'smith-apron' ? 1.08 + rng() * 0.08 : 0.95 + rng() * 0.10;

  const safeCellKey = (opts.cellKey ?? 'frontier').replace(/[^a-z0-9-]/gi, '');
  const id =
    opts.id ||
    `npc-synth-${safeCellKey}-${resolvedRoleIdx}-${(opts.seed >>> 0).toString(36).slice(0, 5)}`;

  const baseAppearance: VerdantCharacterAppearance = {
    rigId: `verdant:rig:${id}`,
    portraitArchetype: 'synthesized',
    portraitUrl: '',
    garmentStyle,
    hairStyle,
    beardStyle,
    satchelStyle: role.satchelStyle,
    signatureProp,
    buildScale: [Number(wScale.toFixed(2)), Number(hScale.toFixed(2)), Number(dScale.toFixed(2))],
    bareForearms,
    hasHoodDown,
    hasPauldrons,
    skinRgb,
    hairRgb,
    garmentRgb,
    underTunicRgb,
    trimRgb,
    leatherRgb,
    claspRgb,
    claspKind: role.claspKind,
    eyeRgb,
    genomeSeed: opts.seed >>> 0,
    traitSummary: `${garmentStyle} · ${hairStyle}${beardStyle !== 'none' ? ` · ${beardStyle}` : ''} · ${signatureProp}`,
  };

  const portraitUrl = synthesizeCharacterPortraitDataUri(baseAppearance, opts.biomeSkyRgb, name);
  const appearance: VerdantCharacterAppearance = {
    ...baseAppearance,
    portraitUrl,
  };

  const cognitiveDrive = pick(rng, role.drives);
  const concealedSecret = pick(rng, role.secrets);
  const speechCadence = pick(rng, role.cadences);
  const beliefs = [...role.beliefsPool];
  const dungeonPhrase = opts.dungeonName
    ? ` and keep an ear on the ${opts.dungeonName} northwest of the plaza`
    : '';
  const briefPhrase = opts.brief ? ` Word reached us about ${opts.brief}.` : '';

  const choices: DialogueChoice[] = [
    {
      id: `${id}-c1`,
      label: `What survey work is urgent here in ${opts.realmName}?`,
      reply: `${cognitiveDrive} Sound the central resonance pier with your Bell-Hammer, attune the northern waystone${dungeonPhrase}.`,
      thought: `Evaluating whether this Waywright reads the terrain of ${opts.realmName} accurately.`,
      advancesQuestId: opts.questId,
      renownGain: 25,
    },
    {
      id: `${id}-c2`,
      label: `Your guild gear is tuned differently than Vaelmor’s. What lies past these borders?`,
      reply: `Every cardinal road here leads straight into the next Meridian Cell—north, south, east, or west. Walk past the boundary gates and you will step into fresh frontiers without a single mountain wall barring your stride.`,
      thought: `Hoping this traveler charts the outer frontier cells honestly.`,
      renownGain: 20,
    },
    {
      id: `${id}-c3`,
      label: `You keep glancing toward the ledger—is there something off in the guild records?`,
      reply: `You notice more than most surveyors. ${concealedSecret} Keep it between us until the foundations settle.`,
      thought: `Deciding to trust this Waywright with an unlogged field observation.`,
      renownGain: 30,
    },
  ];

  const npc: GameNpc = {
    id,
    name,
    title,
    guildId: role.guildId,
    guildName: role.guildName,
    regionId: opts.regionId,
    portraitUrl,
    position: opts.position,
    cloakHex: rgbToNum(garmentRgb),
    trimHex: rgbToNum(trimRgb),
    greeting: `Well met in ${opts.realmName}, Waywright.${briefPhrase} ${cognitiveDrive}`,
    cognitiveDrive,
    concealedSecret,
    speechCadence,
    beliefs,
    choices,
    appearance,
  };

  return { npc, appearance };
}
