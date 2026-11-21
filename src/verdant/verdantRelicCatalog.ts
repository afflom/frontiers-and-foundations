import type { RealmThemeId } from './realmModelSchema';
import { registerVerdantCatalogExtension } from './verdantEcosystemCatalog';

export type RelicRarity = 'Chartered' | 'Resonant' | 'Sovereign';

export type RelicPerkId =
  | 'meridian-ward'
  | 'spore-siphon'
  | 'ember-cleave'
  | 'tidal-surge'
  | 'solar-pierce'
  | 'frost-nova';

export type RelicStatKind = 'maxHp' | 'damagePct' | 'speedPct' | 'staminaRegenPct' | 'healPower';

export interface BiomeRelicArchetype {
  theme: RealmThemeId;
  catalogId: string;
  forgeSchool: string;
  perkId: RelicPerkId;
  perkLabel: string;
  perkDescription: string;
  primaryBonusKind: RelicStatKind;
  secondaryBonusKind: RelicStatKind;
  resonanceHz: number;
  auraRgb: [number, number, number];
  sigilStroke: string;
  sigilAccent: string;
  sigilBg: string;
  prefixes: string[];
  cores: string[];
  craftMaterials: string[];
}

export interface SynthesizedVerdantRelic {
  id: string;
  name: string;
  origin: string;
  description: string;
  bonusKind: RelicStatKind;
  bonusValue: number;
  equipped: boolean;
  isEmergent: boolean;
  theme: RealmThemeId;
  rarity: RelicRarity;
  perkId: RelicPerkId;
  perkLabel: string;
  perkDescription: string;
  resonanceHz: number;
  auraRgb: [number, number, number];
  sigilSvg: string;
  catalogId: string;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const BIOME_RELIC_ARCHETYPES: Record<RealmThemeId, BiomeRelicArchetype> = {
  'citadel-highlands': {
    theme: 'citadel-highlands',
    catalogId: 'verdant:relic:citadel-highlands',
    forgeSchool: 'Vaelmor Acoustic Foundry',
    perkId: 'meridian-ward',
    perkLabel: 'Meridian Ward',
    perkDescription: 'Reduces incoming enemy strike damage by 16% through resonant bronze plating.',
    primaryBonusKind: 'maxHp',
    secondaryBonusKind: 'damagePct',
    resonanceHz: 174,
    auraRgb: [0.95, 0.78, 0.34],
    sigilStroke: '#e5be6a',
    sigilAccent: '#78cbb2',
    sigilBg: '#1b1d24',
    prefixes: ['Calibrated', 'Basalt-Bound', 'Surveyor', 'Causeway', 'Meridian', 'Bell-Tempered'],
    cores: ['Tuning Fork', 'Plumb-Weight', 'Resonance Seal', 'Keystone Compass', 'Anvil Chime', 'Survey Lens'],
    craftMaterials: ['phosphor-bronze', 'columnar basalt', 'tempered bridge iron', 'resonant lodestone'],
  },
  'sunken-aqueducts': {
    theme: 'sunken-aqueducts',
    catalogId: 'verdant:relic:sunken-aqueducts',
    forgeSchool: 'Oakhaven Sluice Guild',
    perkId: 'spore-siphon',
    perkLabel: 'Mycelial Siphon',
    perkDescription: 'Restores +12 Vitality whenever you vanquish a frontier creature.',
    primaryBonusKind: 'healPower',
    secondaryBonusKind: 'maxHp',
    resonanceHz: 196,
    auraRgb: [0.34, 0.94, 0.62],
    sigilStroke: '#66dc9d',
    sigilAccent: '#c4e87a',
    sigilBg: '#12211b',
    prefixes: ['Luminous', 'Cistern-Grown', 'Canopy', 'Root-Woven', 'Aqueduct', 'Mycelial'],
    cores: ['Spore Vial', 'Sluice Gauge', 'Heartwood Chalice', 'Moss Barometer', 'Lotus Siphon', 'Tide-Filter'],
    craftMaterials: ['bioluminescent shelf-amber', 'aged bog-oak', 'verdigris copper', 'limestone sinter'],
  },
  'obsidian-crucible': {
    theme: 'obsidian-crucible',
    catalogId: 'verdant:relic:obsidian-crucible',
    forgeSchool: 'Cinderfall Slag-Smelters',
    perkId: 'ember-cleave',
    perkLabel: 'Ember Cleave',
    perkDescription: 'Hookblade & Bell-Hammer strikes deal +15% thermal burn damage with molten sparks.',
    primaryBonusKind: 'damagePct',
    secondaryBonusKind: 'maxHp',
    resonanceHz: 146,
    auraRgb: [0.98, 0.44, 0.14],
    sigilStroke: '#f28749',
    sigilAccent: '#ffd166',
    sigilBg: '#241412',
    prefixes: ['Quenched', 'Caldera', 'Pyroclastic', 'Crucible', 'Smelter', 'Obsidian-Edged'],
    cores: ['Slag Chain', 'Bellows Core', 'Tongs Sigil', 'Thermal Crucible', 'Magma Astrolabe', 'Furnace Bell'],
    craftMaterials: ['vitreous obsidian', 'quenched hearth-steel', 'volcanic pumice', 'gilded sulfur glass'],
  },
  'pelagic-spires': {
    theme: 'pelagic-spires',
    catalogId: 'verdant:relic:pelagic-spires',
    forgeSchool: 'Glasswater Sounding Mariners',
    perkId: 'tidal-surge',
    perkLabel: 'Tidal Surge',
    perkDescription: 'Reduces dodge stamina cost by 30% and amplifies swim & surge velocity by 18%.',
    primaryBonusKind: 'speedPct',
    secondaryBonusKind: 'staminaRegenPct',
    resonanceHz: 220,
    auraRgb: [0.28, 0.9, 0.96],
    sigilStroke: '#5ad8ea',
    sigilAccent: '#f0b88a',
    sigilBg: '#112129',
    prefixes: ['Pelagic', 'Reef-Calibrated', 'Tide-Glass', 'Abyssal', 'Sounding', 'Coral-Inlaid'],
    cores: ['Sextant Core', 'Bathymeter', 'Kelp Chronometer', 'Tide-Bell', 'Spire Prism', 'Current Vane'],
    craftMaterials: ['sea-glass quartz', 'salt-cured brass', 'calcified reef-coral', 'nacre pearl'],
  },
  'amber-steppe': {
    theme: 'amber-steppe',
    catalogId: 'verdant:relic:amber-steppe',
    forgeSchool: 'Kar-Veth Caravan Astrolabers',
    perkId: 'solar-pierce',
    perkLabel: 'Solar Reach',
    perkDescription: 'Extends Hookblade cleave and Bell-Hammer shockwave reach by +0.9m.',
    primaryBonusKind: 'staminaRegenPct',
    secondaryBonusKind: 'damagePct',
    resonanceHz: 165,
    auraRgb: [0.98, 0.76, 0.24],
    sigilStroke: '#f4c860',
    sigilAccent: '#e87e4d',
    sigilBg: '#231b12',
    prefixes: ['Aeolian', 'Sun-Dialed', 'Caravan', 'Steppe-Wind', 'Ochre-Carved', 'Meridian'],
    cores: ['Wind-Harp Seal', 'Solar Astrolabe', 'Sandstone Quadrant', 'Amber Diptych', 'Dune Pendulum', 'Mirage Lens'],
    craftMaterials: ['honeyed steppe-amber', 'burnished desert brass', 'banded sandstone', 'fulgurite glass'],
  },
  'glacial-spire': {
    theme: 'glacial-spire',
    catalogId: 'verdant:relic:glacial-spire',
    forgeSchool: 'Borealis Crown Observers',
    perkId: 'frost-nova',
    perkLabel: 'Frostglass Nova',
    perkDescription: 'Heavy Bell-Hammer shockwaves chill struck foes, slowing their movement & strikes for 3.5s.',
    primaryBonusKind: 'staminaRegenPct',
    secondaryBonusKind: 'healPower',
    resonanceHz: 261,
    auraRgb: [0.5, 0.92, 0.99],
    sigilStroke: '#8de4fc',
    sigilAccent: '#b8a2ff',
    sigilBg: '#121d2b',
    prefixes: ['Frostglass', 'Aurora-Tuned', 'Glacial', 'Barometric', 'Permafrost', 'Crown-Spire'],
    cores: ['Prism Lens', 'Ice Chronometer', 'Rime Tuning Bar', 'Cryo-Compass', 'Aurora Dial', 'Quartz Pendulum'],
    craftMaterials: ['faceted frost-quartz', 'cold-forged silver', 'glacial blue-ice glass', 'magnetic nickel'],
  },
};

/**
 * Register all 6 bespoke biome relic synthesis archetypes into the live extensible Verdant Catalog.
 */
for (const arch of Object.values(BIOME_RELIC_ARCHETYPES)) {
  registerVerdantCatalogExtension({
    id: arch.catalogId,
    category: 'relic-archetype',
    title: `${arch.forgeSchool} · ${arch.perkLabel}`,
    description: arch.perkDescription,
    themeAffinity: [arch.theme],
    sourceStream: 'verdant-relic-catalog',
    tags: ['relic', arch.theme, arch.perkId, `${arch.resonanceHz}hz`],
    accentRgb: [...arch.auraRgb],
  });
}

/**
 * Procedurally synthesizes a high-definition vector SVG crest for a Verdant Relic,
 * using ecosystem-specific architectural geometry and rarity flourishes.
 */
export function renderRelicSigilSvgDataUrl(
  theme: RealmThemeId,
  rarity: RelicRarity,
  seed: number,
): string {
  const arch = BIOME_RELIC_ARCHETYPES[theme] ?? BIOME_RELIC_ARCHETYPES['citadel-highlands'];
  const rot = (seed % 6) * 15;
  const outerRing =
    rarity === 'Sovereign'
      ? `<circle cx="32" cy="32" r="27" fill="none" stroke="${arch.sigilAccent}" stroke-width="1.5" stroke-dasharray="4 3"/>`
      : rarity === 'Resonant'
        ? `<circle cx="32" cy="32" r="26" fill="none" stroke="${arch.sigilStroke}" stroke-width="1.2" opacity="0.65"/>`
        : '';

  let motif = '';
  if (theme === 'citadel-highlands') {
    motif = `
      <polygon points="32,11 49,21 49,43 32,53 15,43 15,21" fill="none" stroke="${arch.sigilStroke}" stroke-width="2"/>
      <path d="M24 22 V36 C24 41 40 41 40 36 V22" fill="none" stroke="${arch.sigilAccent}" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="32" y1="39" x2="32" y2="50" stroke="${arch.sigilStroke}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="32" cy="24" r="3.4" fill="${arch.sigilAccent}"/>`;
  } else if (theme === 'sunken-aqueducts') {
    motif = `
      <path d="M16 42 Q32 14 48 42 Z" fill="none" stroke="${arch.sigilStroke}" stroke-width="2"/>
      <path d="M22 44 C22 30 42 30 42 44" fill="none" stroke="${arch.sigilAccent}" stroke-width="2"/>
      <circle cx="32" cy="23" r="4.5" fill="${arch.sigilStroke}" opacity="0.88"/>
      <circle cx="23" cy="31" r="2.4" fill="${arch.sigilAccent}"/>
      <circle cx="41" cy="31" r="2.4" fill="${arch.sigilAccent}"/>`;
  } else if (theme === 'obsidian-crucible') {
    motif = `
      <polygon points="32,10 50,32 32,54 14,32" fill="none" stroke="${arch.sigilStroke}" stroke-width="2.1"/>
      <path d="M32 18 C38 25 41 31 37 39 C35 42 29 42 27 39 C23 31 26 25 32 18 Z" fill="${arch.sigilAccent}" opacity="0.82"/>
      <circle cx="32" cy="34" r="3.2" fill="${arch.sigilBg}"/>`;
  } else if (theme === 'pelagic-spires') {
    motif = `
      <circle cx="32" cy="32" r="18" fill="none" stroke="${arch.sigilStroke}" stroke-width="2"/>
      <path d="M14 36 Q23 29 32 36 T50 36" fill="none" stroke="${arch.sigilAccent}" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="32,13 37,30 32,34 27,30" fill="${arch.sigilStroke}"/>
      <circle cx="32" cy="32" r="2.8" fill="${arch.sigilAccent}"/>`;
  } else if (theme === 'amber-steppe') {
    motif = `
      <circle cx="32" cy="32" r="15" fill="none" stroke="${arch.sigilStroke}" stroke-width="2"/>
      <g transform="rotate(${rot} 32 32)">
        <line x1="32" y1="10" x2="32" y2="54" stroke="${arch.sigilAccent}" stroke-width="1.6"/>
        <line x1="10" y1="32" x2="54" y2="32" stroke="${arch.sigilAccent}" stroke-width="1.6"/>
      </g>
      <polygon points="32,20 40,32 32,44 24,32" fill="${arch.sigilStroke}" opacity="0.85"/>`;
  } else {
    motif = `
      <polygon points="32,9 41,24 53,32 41,40 32,55 23,40 11,32 23,24" fill="none" stroke="${arch.sigilStroke}" stroke-width="1.9"/>
      <polygon points="32,17 39,32 32,47 25,32" fill="${arch.sigilAccent}" opacity="0.72"/>
      <circle cx="32" cy="32" r="3" fill="#ffffff"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect x="2" y="2" width="60" height="60" rx="6" fill="${arch.sigilBg}" stroke="${arch.sigilStroke}" stroke-opacity="0.45" stroke-width="1.5"/>
    ${outerRing}
    ${motif}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function synthesizeBiomeRelic(options: {
  theme: RealmThemeId;
  realmName: string;
  seed?: number;
  rarity?: RelicRarity;
  existingNames?: string[];
  source?: 'forge' | 'vault-chest' | 'colossus-drop' | 'mcp';
  brief?: string;
}): SynthesizedVerdantRelic {
  const arch = BIOME_RELIC_ARCHETYPES[options.theme] ?? BIOME_RELIC_ARCHETYPES['citadel-highlands'];
  const existing = new Set((options.existingNames ?? []).map((n) => n.toLowerCase()));
  const baseSeed =
    options.seed ??
    hashSeed(`${options.theme}:${options.realmName}:${options.source ?? 'forge'}:${existing.size}:${options.brief ?? ''}`);

  let chosenName = '';
  let attempt = 0;
  while (attempt < 48) {
    const h = hashSeed(`${baseSeed}:${attempt}`);
    const p = arch.prefixes[h % arch.prefixes.length];
    const c = arch.cores[(h >>> 4) % arch.cores.length];
    const pRoot = p.toLowerCase().split('-')[0];
    const cWords = c.toLowerCase().split(/[\s-]+/);
    const overlaps = cWords.some((w) => w === pRoot || w.startsWith(pRoot) || pRoot.startsWith(w));
    const candidate = `${p} ${c}`;
    if (!overlaps && !existing.has(candidate.toLowerCase())) {
      chosenName = candidate;
      break;
    }
    attempt += 1;
  }
  if (!chosenName) {
    chosenName = `${arch.prefixes[baseSeed % arch.prefixes.length]} ${arch.cores[(baseSeed >>> 3) % arch.cores.length]} Mk.${existing.size + 1}`;
  }

  const rarity: RelicRarity =
    options.rarity ??
    (options.source === 'colossus-drop'
      ? 'Sovereign'
      : options.source === 'vault-chest'
        ? baseSeed % 3 === 0
          ? 'Sovereign'
          : 'Resonant'
        : baseSeed % 4 === 0
          ? 'Sovereign'
          : 'Resonant');

  const usePrimary = baseSeed % 3 !== 2;
  const bonusKind = usePrimary ? arch.primaryBonusKind : arch.secondaryBonusKind;
  const rarityMult = rarity === 'Sovereign' ? 1.35 : rarity === 'Resonant' ? 1.1 : 0.9;
  const baseValues: Record<RelicStatKind, number> = {
    maxHp: 22,
    damagePct: 14,
    speedPct: 10,
    staminaRegenPct: 18,
    healPower: 14,
  };
  const bonusValue = Math.round(baseValues[bonusKind] * rarityMult + (baseSeed % 5));
  const craftMat = arch.craftMaterials[(baseSeed >>> 6) % arch.craftMaterials.length];
  const briefSuffix = options.brief ? ` Calibrated for ${options.brief.trim()}.` : '';
  const description = `Crafted from ${craftMat} at ${arch.forgeSchool}. Tuned to ${arch.resonanceHz} Hz — grants ${arch.perkLabel}.${briefSuffix}`;

  const slug = chosenName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: `relic-verdant-${options.theme}-${slug}-${baseSeed.toString(36).slice(0, 5)}`,
    name: chosenName,
    origin: `${options.realmName} · ${arch.forgeSchool}`,
    description,
    bonusKind,
    bonusValue,
    equipped: true,
    isEmergent: true,
    theme: options.theme,
    rarity,
    perkId: arch.perkId,
    perkLabel: arch.perkLabel,
    perkDescription: arch.perkDescription,
    resonanceHz: arch.resonanceHz,
    auraRgb: [...arch.auraRgb],
    sigilSvg: renderRelicSigilSvgDataUrl(options.theme, rarity, baseSeed),
    catalogId: arch.catalogId,
  };
}

export function getRelicArchetypeForTheme(theme: RealmThemeId): BiomeRelicArchetype {
  return BIOME_RELIC_ARCHETYPES[theme] ?? BIOME_RELIC_ARCHETYPES['citadel-highlands'];
}
