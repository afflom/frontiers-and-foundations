import {
  realmRiverCenterZ,
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import { createSeededRng, hashStringSeed } from './verdantCharacterSynthesizer';

export type LayoutArchetypeId =
  | 'citadel-causeway'
  | 'aqueduct-terraces'
  | 'caldera-amphitheater'
  | 'archipelago-atolls'
  | 'caravan-ziggurat'
  | 'aurora-observatory'
  | 'monolith-sanctuary'
  | 'cliffside-bastion';

export type FloraKitId =
  | 'ironwood-conifer'
  | 'weeping-banyan'
  | 'obsidian-vent-spires'
  | 'coral-palm-atoll'
  | 'mesa-hoodoo-juniper'
  | 'frostglass-crystal-pine'
  | 'giant-fungal-canopy'
  | 'petrified-amber-grove';

export type FaunaKitId =
  | 'highland-ironclad'
  | 'verdant-mycelial'
  | 'pyroclastic-forge'
  | 'pelagic-abyssal'
  | 'dune-sandstrider'
  | 'glacial-frostborn';

export type EcosystemPhenomenonId =
  | 'meridian-resonance'
  | 'vital-spore-bloom'
  | 'thermal-updraft'
  | 'tidal-current'
  | 'desert-tailwind'
  | 'aurora-clarity';

export type AmbientParticleKind =
  | 'golden-motes'
  | 'emerald-spores'
  | 'volcanic-embers'
  | 'sea-mist'
  | 'desert-sand'
  | 'aurora-snow';

export interface EcosystemPhenomenonSpec {
  id: EcosystemPhenomenonId;
  title: string;
  effectSummary: string;
  landSpeedMult: number;
  swimSpeedMult: number;
  jumpBoostMult: number;
  dodgeDistMult: number;
  staminaRegenMult: number;
  cooldownMult: number;
  strikeDamageMult: number;
  passiveHpPerSec: number;
  ambientParticleKind: AmbientParticleKind;
  ambientRgb: [number, number, number];
}

export interface StructurePrimitive {
  id: string;
  kind: 'box' | 'cylinder' | 'cone';
  material: 'stone' | 'cobble' | 'timber' | 'accent';
  /** World X, Z center */
  x: number;
  z: number;
  /** Vertical offset relative to local terrain height (or absolute if useAbsoluteY) */
  yOffset: number;
  useAbsoluteY?: boolean;
  /** Dimensions: for box (sx, sy, sz); for cylinder/cone (rBottom=sx, height=sy, rTop=sz) */
  sx: number;
  sy: number;
  sz: number;
  segs?: number;
  yaw?: number;
  rgb?: [number, number, number];
  /** Solid collision footprint synced 1:1 with verdantCollision.ts */
  collider: 'none' | 'box' | 'circle';
  colliderRadius?: number;
  minY?: number;
  maxY?: number;
}

export interface SynthesizedFloraInstance {
  id: string;
  kit: FloraKitId;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number; // 0..1 deterministic botanical variation
  colliderRadius: number;
}

export interface SynthesizedPlazaZone {
  x: number;
  z: number;
  radius: number;
}

export interface SynthesizedEcosystemPlan {
  realmSlug: string;
  theme: RealmThemeId;
  layoutId: LayoutArchetypeId;
  layoutTitle: string;
  floraKit: FloraKitId;
  floraTitle: string;
  faunaKit: FaunaKitId;
  faunaTitle: string;
  phenomenon: EcosystemPhenomenonSpec;
  plazaZones: SynthesizedPlazaZone[];
  structures: StructurePrimitive[];
  floraInstances: SynthesizedFloraInstance[];
  thermalVents: Array<[number, number]>;
  catalogExtensionIds: string[];
}

export interface VerdantCatalogExtensionEntry {
  id: string;
  category: 'layout' | 'flora' | 'fauna' | 'phenomenon' | 'prop-kit' | 'relic-archetype';
  title: string;
  description: string;
  themeAffinity: RealmThemeId[];
  sourceStream: string;
  tags: string[];
  /** Optional custom accent tint override for extended kits */
  accentRgb?: [number, number, number];
}

export const ECOSYSTEM_PHENOMENA: Record<EcosystemPhenomenonId, EcosystemPhenomenonSpec> = {
  'meridian-resonance': {
    id: 'meridian-resonance',
    title: 'Meridian Resonance',
    effectSummary: 'Harmonic stone currents steady stamina & crisp strikes (+10% strike damage)',
    landSpeedMult: 1.0,
    swimSpeedMult: 1.0,
    jumpBoostMult: 1.0,
    dodgeDistMult: 1.0,
    staminaRegenMult: 1.12,
    cooldownMult: 0.94,
    strikeDamageMult: 1.1,
    passiveHpPerSec: 0,
    ambientParticleKind: 'golden-motes',
    ambientRgb: [0.95, 0.80, 0.36],
  },
  'vital-spore-bloom': {
    id: 'vital-spore-bloom',
    title: 'Vital Spore Bloom',
    effectSummary: 'Bioluminescent canopy spores restore vitality (+1.6 HP/s, +30% stamina regen)',
    landSpeedMult: 1.02,
    swimSpeedMult: 1.12,
    jumpBoostMult: 1.0,
    dodgeDistMult: 1.04,
    staminaRegenMult: 1.3,
    cooldownMult: 0.96,
    strikeDamageMult: 1.0,
    passiveHpPerSec: 1.6,
    ambientParticleKind: 'emerald-spores',
    ambientRgb: [0.32, 0.92, 0.56],
  },
  'thermal-updraft': {
    id: 'thermal-updraft',
    title: 'Thermal Caldera Updraft',
    effectSummary: 'Volcanic thermals supercharge leaps (+28% jump) & ignite strikes (+22% dmg)',
    landSpeedMult: 1.04,
    swimSpeedMult: 0.95,
    jumpBoostMult: 1.28,
    dodgeDistMult: 1.08,
    staminaRegenMult: 0.95,
    cooldownMult: 0.92,
    strikeDamageMult: 1.22,
    passiveHpPerSec: 0,
    ambientParticleKind: 'volcanic-embers',
    ambientRgb: [0.98, 0.44, 0.14],
  },
  'tidal-current': {
    id: 'tidal-current',
    title: 'Pelagic Tide Current',
    effectSummary: 'Oceanic currents accelerate swimming (+38% swim speed) & hydro-surge distance',
    landSpeedMult: 1.0,
    swimSpeedMult: 1.38,
    jumpBoostMult: 1.08,
    dodgeDistMult: 1.26,
    staminaRegenMult: 1.16,
    cooldownMult: 0.92,
    strikeDamageMult: 1.04,
    passiveHpPerSec: 0.4,
    ambientParticleKind: 'sea-mist',
    ambientRgb: [0.42, 0.88, 0.96],
  },
  'desert-tailwind': {
    id: 'desert-tailwind',
    title: 'Sirocco Steppe Tailwind',
    effectSummary: 'Warm canyon gusts speed overland travel (+18% run speed, +20% dodge stride)',
    landSpeedMult: 1.18,
    swimSpeedMult: 1.0,
    jumpBoostMult: 1.06,
    dodgeDistMult: 1.2,
    staminaRegenMult: 1.14,
    cooldownMult: 0.95,
    strikeDamageMult: 1.06,
    passiveHpPerSec: 0,
    ambientParticleKind: 'desert-sand',
    ambientRgb: [0.94, 0.72, 0.34],
  },
  'aurora-clarity': {
    id: 'aurora-clarity',
    title: 'Polar Aurora Clarity',
    effectSummary: 'Crystalline frost-light accelerates relic mastery (-28% gear cooldowns)',
    landSpeedMult: 1.03,
    swimSpeedMult: 0.92,
    jumpBoostMult: 1.1,
    dodgeDistMult: 1.06,
    staminaRegenMult: 1.18,
    cooldownMult: 0.72,
    strikeDamageMult: 1.12,
    passiveHpPerSec: 0,
    ambientParticleKind: 'aurora-snow',
    ambientRgb: [0.64, 0.90, 1.0],
  },
};

export const LAYOUT_TITLES: Record<LayoutArchetypeId, string> = {
  'citadel-causeway': 'Meridian Citadel & Causeway',
  'aqueduct-terraces': 'Sunken Aqueduct Cloisters',
  'caldera-amphitheater': 'Obsidian Ring-Forge Amphitheater',
  'archipelago-atolls': 'Pelagic Spire & Atoll Jetties',
  'caravan-ziggurat': 'Sun-Ziggurat & Nomad Oasis Bazaar',
  'aurora-observatory': 'Frostglass Prism Observatory',
  'monolith-sanctuary': 'Megalithic Sundial Sanctuary',
  'cliffside-bastion': 'Terraced Ridge Watch-Bastion',
};

export const FLORA_TITLES: Record<FloraKitId, string> = {
  'ironwood-conifer': 'Amber Ironwood & Alpine Conifers',
  'weeping-banyan': 'Weeping Moss-Banyans & Giant Lotus',
  'obsidian-vent-spires': 'Obsidian Fumarole Spires & Ash-Thorns',
  'coral-palm-atoll': 'Leaning Sea-Palms & Tide-Reef Coral',
  'mesa-hoodoo-juniper': 'Sandstone Hoodoos & Wind-Junipers',
  'frostglass-crystal-pine': 'Frostglass Prisms & Rime-Spruces',
  'giant-fungal-canopy': 'Bioluminescent Shelf-Fungus Canopy',
  'petrified-amber-grove': 'Petrified Resin-Vein Monolith Trees',
};

export const FAUNA_TITLES: Record<FaunaKitId, string> = {
  'highland-ironclad': 'Highland Basalt Stalkers & Bronze Wardens',
  'verdant-mycelial': 'Vine-Prowlers, Spore-Drifters & Root-Treants',
  'pyroclastic-forge': 'Cinder-Hounds, Brazier-Seraphs & Furnace Juggernauts',
  'pelagic-abyssal': 'Tide-Skimmers, Nautilus Weavers & Reef-Leviathans',
  'dune-sandstrider': 'Sun-Scorpids, Solar Djinn & Sphinx Sentinels',
  'glacial-frostborn': 'Frost-Wolves, Aurora Wraiths & Glacier Titans',
};

/**
 * Live, extensible Verdant Ecosystem Catalog registry.
 * Ships with 26 foundational architectural, botanical, fauna, phenomenon, and Poly Haven prop kits,
 * and can be extended dynamically via `registerVerdantCatalogExtension()` or MCP `verdant_catalog_extend`.
 */
const VERDANT_CATALOG_EXTENSIONS: VerdantCatalogExtensionEntry[] = [
  { id: 'verdant:layout:citadel-causeway', category: 'layout', title: LAYOUT_TITLES['citadel-causeway'], description: 'Fortified N-S stone causeway & octagonal highland citadel', themeAffinity: ['citadel-highlands'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'highland', 'fortress'] },
  { id: 'verdant:layout:aqueduct-terraces', category: 'layout', title: LAYOUT_TITLES['aqueduct-terraces'], description: 'Grand multi-arch elevated aqueduct & sunken water cloisters', themeAffinity: ['sunken-aqueducts'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'aqueduct', 'canal'] },
  { id: 'verdant:layout:caldera-amphitheater', category: 'layout', title: LAYOUT_TITLES['caldera-amphitheater'], description: 'Concentric obsidian ring-forge & radial slag viaducts', themeAffinity: ['obsidian-crucible'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'volcanic', 'foundry'] },
  { id: 'verdant:layout:archipelago-atolls', category: 'layout', title: LAYOUT_TITLES['archipelago-atolls'], description: 'Spiral sea-lighthouse, coral tide-arches & timber atoll jetties', themeAffinity: ['pelagic-spires'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'coastal', 'lighthouse'] },
  { id: 'verdant:layout:caravan-ziggurat', category: 'layout', title: LAYOUT_TITLES['caravan-ziggurat'], description: 'Stepped sandstone sun-ziggurat, wind-harp towers & oasis tents', themeAffinity: ['amber-steppe'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'desert', 'ziggurat'] },
  { id: 'verdant:layout:aurora-observatory', category: 'layout', title: LAYOUT_TITLES['aurora-observatory'], description: 'Hexagonal frostglass crystal spires & polar prism causeways', themeAffinity: ['glacial-spire'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'glacial', 'observatory'] },
  { id: 'verdant:layout:monolith-sanctuary', category: 'layout', title: LAYOUT_TITLES['monolith-sanctuary'], description: 'Megalithic astronomical stone ring & dolmen radiating avenues', themeAffinity: ['citadel-highlands', 'amber-steppe', 'sunken-aqueducts'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'megalith', 'procedural'] },
  { id: 'verdant:layout:cliffside-bastion', category: 'layout', title: LAYOUT_TITLES['cliffside-bastion'], description: 'Asymmetric terraced ridge bastion with watch-beacons & switchbacks', themeAffinity: ['citadel-highlands', 'obsidian-crucible', 'glacial-spire'], sourceStream: 'verdant-ecosystem-catalog', tags: ['architecture', 'ridge', 'procedural'] },
  { id: 'verdant:flora:ironwood-conifer', category: 'flora', title: FLORA_TITLES['ironwood-conifer'], description: 'Multi-tiered amber ironwood & highland pine groves', themeAffinity: ['citadel-highlands'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'conifer'] },
  { id: 'verdant:flora:weeping-banyan', category: 'flora', title: FLORA_TITLES['weeping-banyan'], description: 'Broad domed moss-draped banyans, hanging vines & shoreline lily pads', themeAffinity: ['sunken-aqueducts'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'wetland', 'canopy'] },
  { id: 'verdant:flora:obsidian-vent-spires', category: 'flora', title: FLORA_TITLES['obsidian-vent-spires'], description: 'Hexagonal obsidian crystal clusters, fumarole vents & charred thorns', themeAffinity: ['obsidian-crucible'], sourceStream: 'verdant-ecosystem-catalog', tags: ['geological', 'volcanic'] },
  { id: 'verdant:flora:coral-palm-atoll', category: 'flora', title: FLORA_TITLES['coral-palm-atoll'], description: 'Curved leaning sea-palms & branching rose-turquoise coral reefs', themeAffinity: ['pelagic-spires'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'coastal', 'coral'] },
  { id: 'verdant:flora:mesa-hoodoo-juniper', category: 'flora', title: FLORA_TITLES['mesa-hoodoo-juniper'], description: 'Banded sandstone hoodoo pillars, flat-crown junipers & ribbed cacti', themeAffinity: ['amber-steppe'], sourceStream: 'verdant-ecosystem-catalog', tags: ['geological', 'desert'] },
  { id: 'verdant:flora:frostglass-crystal-pine', category: 'flora', title: FLORA_TITLES['frostglass-crystal-pine'], description: 'Translucent azure ice-crystal shards & snow-laden boreal spruces', themeAffinity: ['glacial-spire'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'glacial', 'crystal'] },
  { id: 'verdant:flora:giant-fungal-canopy', category: 'flora', title: FLORA_TITLES['giant-fungal-canopy'], description: 'Towering bioluminescent fluted mushroom trees & spore lanterns', themeAffinity: ['sunken-aqueducts', 'pelagic-spires'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'mycelial', 'procedural'] },
  { id: 'verdant:flora:petrified-amber-grove', category: 'flora', title: FLORA_TITLES['petrified-amber-grove'], description: 'Spiral petrified ancient trunks inlaid with luminous golden resin', themeAffinity: ['amber-steppe', 'citadel-highlands'], sourceStream: 'verdant-ecosystem-catalog', tags: ['botanical', 'petrified', 'procedural'] },
  { id: 'verdant:fauna:highland-ironclad', category: 'fauna', title: FAUNA_TITLES['highland-ironclad'], description: 'Armored basalt stalkers, rune shardcasters & bronze wardens', themeAffinity: ['citadel-highlands'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'highland'] },
  { id: 'verdant:fauna:verdant-mycelial', category: 'fauna', title: FAUNA_TITLES['verdant-mycelial'], description: 'Vine-crested prowlers, floating spore-umbrellas & antlered treants', themeAffinity: ['sunken-aqueducts'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'mycelial'] },
  { id: 'verdant:fauna:pyroclastic-forge', category: 'fauna', title: FAUNA_TITLES['pyroclastic-forge'], description: 'Magma-ridge cinder-hounds, brazier-seraphs & furnace juggernauts', themeAffinity: ['obsidian-crucible'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'volcanic'] },
  { id: 'verdant:fauna:pelagic-abyssal', category: 'fauna', title: FAUNA_TITLES['pelagic-abyssal'], description: 'Fin-crested tide-skimmers, nautilus weavers & reef-leviathans', themeAffinity: ['pelagic-spires'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'aquatic'] },
  { id: 'verdant:fauna:dune-sandstrider', category: 'fauna', title: FAUNA_TITLES['dune-sandstrider'], description: 'Chitin sun-scorpids, brass astrolabe djinn & winged obelisk wardens', themeAffinity: ['amber-steppe'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'desert'] },
  { id: 'verdant:fauna:glacial-frostborn', category: 'fauna', title: FAUNA_TITLES['glacial-frostborn'], description: 'Icicle-spined frost-wolves, diamond wraiths & glacier rift-titans', themeAffinity: ['glacial-spire'], sourceStream: 'verdant-ecosystem-catalog', tags: ['creature', 'glacial'] },
  { id: 'verdant:prop-kit:polyhaven-citadel', category: 'prop-kit', title: 'Poly Haven Highland Masonry & Relics', description: 'gothic_statue, kite_shield, antique_estoc, brass_pot_01, Lantern_01, WoodenTable_02', themeAffinity: ['citadel-highlands'], sourceStream: 'polyhaven-cc0-extended', tags: ['polyhaven', 'cc0', 'props'] },
  { id: 'verdant:prop-kit:polyhaven-botanical', category: 'prop-kit', title: 'Poly Haven Wetland Botanicals & Urns', description: 'fern_02, potted_plant_04, antique_ceramic_vase_01, boulder_01, Barrel_01', themeAffinity: ['sunken-aqueducts', 'pelagic-spires'], sourceStream: 'polyhaven-cc0-extended', tags: ['polyhaven', 'cc0', 'botanical'] },
  { id: 'verdant:prop-kit:polyhaven-foundry', category: 'prop-kit', title: 'Poly Haven Crucible & Caravan Craft', description: 'brass_pot_01, old_military_crate, Barrel_02, moon_rock_01, Lantern_01', themeAffinity: ['obsidian-crucible', 'amber-steppe'], sourceStream: 'polyhaven-cc0-extended', tags: ['polyhaven', 'cc0', 'foundry'] },
  { id: 'verdant:prop-kit:polyhaven-polar', category: 'prop-kit', title: 'Poly Haven Polar Monoliths & Lanterns', description: 'moon_rock_01, gothic_statue, Lantern_01, antique_estoc, boulder_01', themeAffinity: ['glacial-spire'], sourceStream: 'polyhaven-cc0-extended', tags: ['polyhaven', 'cc0', 'polar'] },
];

export function registerVerdantCatalogExtension(entry: VerdantCatalogExtensionEntry): VerdantCatalogExtensionEntry {
  const idx = VERDANT_CATALOG_EXTENSIONS.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    VERDANT_CATALOG_EXTENSIONS[idx] = entry;
  } else {
    VERDANT_CATALOG_EXTENSIONS.push(entry);
  }
  return entry;
}

export function listVerdantCatalogExtensions(category?: VerdantCatalogExtensionEntry['category']): VerdantCatalogExtensionEntry[] {
  return category
    ? VERDANT_CATALOG_EXTENSIONS.filter((e) => e.category === category)
    : [...VERDANT_CATALOG_EXTENSIONS];
}

function getThemeColors(theme: RealmThemeId): {
  spire: [number, number, number];
  lantern: [number, number, number];
  banner: [number, number, number];
  accent: [number, number, number];
} {
  switch (theme) {
    case 'sunken-aqueducts':
      return {
        spire: [0.18, 0.42, 0.30],
        lantern: [0.34, 0.94, 0.62],
        banner: [0.18, 0.56, 0.40],
        accent: [0.24, 0.52, 0.36],
      };
    case 'obsidian-crucible':
      return {
        spire: [0.22, 0.16, 0.17],
        lantern: [0.98, 0.42, 0.12],
        banner: [0.84, 0.28, 0.12],
        accent: [0.32, 0.20, 0.18],
      };
    case 'pelagic-spires':
      return {
        spire: [0.22, 0.46, 0.56],
        lantern: [0.34, 0.92, 0.96],
        banner: [0.16, 0.48, 0.68],
        accent: [0.76, 0.72, 0.62],
      };
    case 'amber-steppe':
      return {
        spire: [0.68, 0.44, 0.22],
        lantern: [0.98, 0.78, 0.26],
        banner: [0.84, 0.48, 0.16],
        accent: [0.78, 0.58, 0.32],
      };
    case 'glacial-spire':
      return {
        spire: [0.46, 0.72, 0.88],
        lantern: [0.58, 0.92, 1.0],
        banner: [0.24, 0.58, 0.84],
        accent: [0.54, 0.78, 0.94],
      };
    default:
      return {
        spire: [0.24, 0.31, 0.38],
        lantern: [0.96, 0.78, 0.36],
        banner: [0.68, 0.22, 0.18],
        accent: [0.44, 0.46, 0.50],
      };
  }
}

export function selectEcosystemIdentity(spec: FrontiersRealmSpec): {
  layoutId: LayoutArchetypeId;
  floraKit: FloraKitId;
  faunaKit: FaunaKitId;
  phenomenonId: EcosystemPhenomenonId;
} {
  // Canonical realms each receive a 100% distinct bespoke ecosystem identity!
  if (!spec.isProceduralCell) {
    switch (spec.theme) {
      case 'sunken-aqueducts':
        return {
          layoutId: 'aqueduct-terraces',
          floraKit: 'weeping-banyan',
          faunaKit: 'verdant-mycelial',
          phenomenonId: 'vital-spore-bloom',
        };
      case 'obsidian-crucible':
        return {
          layoutId: 'caldera-amphitheater',
          floraKit: 'obsidian-vent-spires',
          faunaKit: 'pyroclastic-forge',
          phenomenonId: 'thermal-updraft',
        };
      case 'pelagic-spires':
        return {
          layoutId: 'archipelago-atolls',
          floraKit: 'coral-palm-atoll',
          faunaKit: 'pelagic-abyssal',
          phenomenonId: 'tidal-current',
        };
      case 'amber-steppe':
        return {
          layoutId: 'caravan-ziggurat',
          floraKit: 'mesa-hoodoo-juniper',
          faunaKit: 'dune-sandstrider',
          phenomenonId: 'desert-tailwind',
        };
      case 'glacial-spire':
        return {
          layoutId: 'aurora-observatory',
          floraKit: 'frostglass-crystal-pine',
          faunaKit: 'glacial-frostborn',
          phenomenonId: 'aurora-clarity',
        };
      default:
        return {
          layoutId: 'citadel-causeway',
          floraKit: 'ironwood-conifer',
          faunaKit: 'highland-ironclad',
          phenomenonId: 'meridian-resonance',
        };
    }
  }

  // Procedural cells procedurally recombine architectural layouts, flora kits, fauna, & phenomena
  // from the extended Verdant Catalog so neighboring procedural cells never feel like clones!
  const rng = createSeededRng(hashStringSeed(`eco:${spec.slug}:${spec.seed}:${spec.cell.join(',')}`));

  const layoutsByTheme: Record<RealmThemeId, LayoutArchetypeId[]> = {
    'citadel-highlands': ['cliffside-bastion', 'monolith-sanctuary', 'citadel-causeway'],
    'sunken-aqueducts': ['aqueduct-terraces', 'monolith-sanctuary', 'archipelago-atolls'],
    'obsidian-crucible': ['caldera-amphitheater', 'cliffside-bastion', 'monolith-sanctuary'],
    'pelagic-spires': ['archipelago-atolls', 'aqueduct-terraces', 'cliffside-bastion'],
    'amber-steppe': ['caravan-ziggurat', 'monolith-sanctuary', 'cliffside-bastion'],
    'glacial-spire': ['aurora-observatory', 'cliffside-bastion', 'monolith-sanctuary'],
  };

  const floraByTheme: Record<RealmThemeId, FloraKitId[]> = {
    'citadel-highlands': ['ironwood-conifer', 'petrified-amber-grove', 'weeping-banyan'],
    'sunken-aqueducts': ['weeping-banyan', 'giant-fungal-canopy', 'ironwood-conifer'],
    'obsidian-crucible': ['obsidian-vent-spires', 'petrified-amber-grove'],
    'pelagic-spires': ['coral-palm-atoll', 'giant-fungal-canopy', 'weeping-banyan'],
    'amber-steppe': ['mesa-hoodoo-juniper', 'petrified-amber-grove'],
    'glacial-spire': ['frostglass-crystal-pine', 'ironwood-conifer'],
  };

  const faunaByTheme: Record<RealmThemeId, FaunaKitId> = {
    'citadel-highlands': 'highland-ironclad',
    'sunken-aqueducts': 'verdant-mycelial',
    'obsidian-crucible': 'pyroclastic-forge',
    'pelagic-spires': 'pelagic-abyssal',
    'amber-steppe': 'dune-sandstrider',
    'glacial-spire': 'glacial-frostborn',
  };

  const phenomByTheme: Record<RealmThemeId, EcosystemPhenomenonId> = {
    'citadel-highlands': 'meridian-resonance',
    'sunken-aqueducts': 'vital-spore-bloom',
    'obsidian-crucible': 'thermal-updraft',
    'pelagic-spires': 'tidal-current',
    'amber-steppe': 'desert-tailwind',
    'glacial-spire': 'aurora-clarity',
  };

  const lPool = layoutsByTheme[spec.theme] ?? ['monolith-sanctuary'];
  const fPool = floraByTheme[spec.theme] ?? ['ironwood-conifer'];
  const layoutId = lPool[Math.floor(rng() * lPool.length)];
  const floraKit = fPool[Math.floor(rng() * fPool.length)];
  const faunaKit = faunaByTheme[spec.theme] ?? 'highland-ironclad';
  const phenomenonId = phenomByTheme[spec.theme] ?? 'meridian-resonance';
  return { layoutId, floraKit, faunaKit, phenomenonId };
}

function isNearProtectedSpot(spec: FrontiersRealmSpec, x: number, z: number, minClear: number): boolean {
  const [sx, sz] = spec.spawnPoint;
  if (Math.hypot(x - sx, z - sz) < minClear + 2.5) return true;
  for (const n of spec.npcs) {
    if (Math.hypot(x - n.position[0], z - n.position[1]) < minClear) return true;
  }
  for (const it of spec.interactables) {
    if (Math.hypot(x - it.position[0], z - it.position[1]) < minClear) return true;
  }
  for (const ent of spec.dungeonEntrances) {
    if (Math.hypot(x - ent.position[0], z - ent.position[1]) < minClear + 3.5) return true;
  }
  // Keep main road corridors clear
  if (Math.abs(x) < 4.5 && z > -28 && z < 88) return true;
  if (Math.abs(z) < 4.2 && Math.abs(x) > 12 && Math.abs(x) < 88) return true;
  return false;
}

// ============================================================================
// 8 BESPOKE ARCHITECTURAL LAYOUT GENERATORS (ZERO CLONED FLOORPLANS!)
// ============================================================================

function buildCitadelCausewayStructures(
  spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: 0, z: -16, radius: 11 },
    { x: 0, z: 17, radius: 7.2 },
    { x: -54, z: -22, radius: 9.5 },
    { x: 54, z: 10, radius: 8.5 },
    { x: 0, z: -56, radius: 8.5 },
  ];
  // Sculpted 12-Sided Basalt Citadel Keep (0, -20.5) with Cornice, Buttresses, Crenellations & Ribbed Slate Spire
  s.push(
    { id: 'citadel-plinth', kind: 'box', material: 'stone', x: 0, yOffset: 0.5, z: -18.5, sx: 20.5, sy: 2.6, sz: 15.8, collider: 'none' },
    { id: 'citadel-plinth-step', kind: 'box', material: 'cobble', x: 0, yOffset: 0.15, z: -11.4, sx: 11.2, sy: 0.9, sz: 2.8, collider: 'none' },
    { id: 'citadel-keep-base', kind: 'cylinder', material: 'stone', x: 0, yOffset: 1.4, z: -20.5, sx: 6.9, sy: 2.4, sz: 6.5, segs: 12, collider: 'none' },
    { id: 'citadel-keep', kind: 'cylinder', material: 'stone', x: 0, yOffset: 1.5, z: -20.5, sx: 6.4, sy: 12.6, sz: 5.85, segs: 12, collider: 'circle', colliderRadius: 5.85 },
    { id: 'citadel-keep-belt', kind: 'cylinder', material: 'cobble', x: 0, yOffset: 8.2, z: -20.5, sx: 6.45, sy: 0.55, sz: 6.45, segs: 12, collider: 'none' },
    { id: 'citadel-crown', kind: 'cylinder', material: 'stone', x: 0, yOffset: 13.7, z: -20.5, sx: 6.55, sy: 1.65, sz: 6.65, segs: 12, collider: 'none' },
    { id: 'citadel-roof-eave', kind: 'cylinder', material: 'accent', x: 0, yOffset: 15.2, z: -20.5, sx: 6.8, sy: 0.45, sz: 6.2, segs: 12, rgb: cols.spire, collider: 'none' },
    { id: 'citadel-roof', kind: 'cone', material: 'accent', x: 0, yOffset: 15.5, z: -20.5, sx: 6.3, sy: 7.4, sz: 0, segs: 12, rgb: cols.spire, collider: 'none' },
    { id: 'citadel-lantern-cage', kind: 'cylinder', material: 'accent', x: 0, yOffset: 22.3, z: -20.5, sx: 0.65, sy: 1.1, sz: 0.52, segs: 8, rgb: [0.22, 0.20, 0.19], collider: 'none' },
    { id: 'citadel-finial', kind: 'cone', material: 'accent', x: 0, yOffset: 23.3, z: -20.5, sx: 0.52, sy: 2.6, sz: 0, segs: 8, rgb: cols.lantern, collider: 'none' },
    // Gatehouse Piers (open portal at x=0, z=-14) with buttresses & gothic crenellations
    { id: 'citadel-gatehouse-w', kind: 'box', material: 'stone', x: -3.2, yOffset: 4.4, z: -14.0, sx: 2.3, sy: 6.8, sz: 2.4, collider: 'box' },
    { id: 'citadel-gatehouse-e', kind: 'box', material: 'stone', x: 3.2, yOffset: 4.4, z: -14.0, sx: 2.3, sy: 6.8, sz: 2.4, collider: 'box' },
    { id: 'citadel-gatehouse-lintel', kind: 'box', material: 'stone', x: 0, yOffset: 7.7, z: -14.0, sx: 9.4, sy: 2.1, sz: 2.7, collider: 'none' },
    { id: 'citadel-gatehouse-cornice', kind: 'box', material: 'cobble', x: 0, yOffset: 8.9, z: -14.0, sx: 9.8, sy: 0.42, sz: 3.0, collider: 'none' },
    { id: 'citadel-gatehouse-arch-w', kind: 'box', material: 'stone', x: -1.65, yOffset: 6.35, z: -14.0, sx: 1.15, sy: 0.95, sz: 2.55, yaw: 0, collider: 'none' },
    { id: 'citadel-gatehouse-arch-e', kind: 'box', material: 'stone', x: 1.65, yOffset: 6.35, z: -14.0, sx: 1.15, sy: 0.95, sz: 2.55, yaw: 0, collider: 'none' },
    { id: 'citadel-gatehouse-crest', kind: 'cone', material: 'accent', x: 0, yOffset: 9.2, z: -13.9, sx: 1.35, sy: 2.4, sz: 0, segs: 4, rgb: cols.spire, collider: 'none' },
  );
  // Keep vertical buttresses & parapet merlons (crenellations)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const mx = Math.cos(a) * 6.2;
    const mz = -20.5 + Math.sin(a) * 6.2;
    s.push({ id: `citadel-keep-merlon-${i}`, kind: 'box', material: 'stone', x: mx, yOffset: 15.65, z: mz, sx: 1.15, sy: 0.95, sz: 0.72, yaw: -a + Math.PI / 2, collider: 'none' });
    if (i % 2 === 0) {
      const bx = Math.cos(a) * 6.15;
      const bz = -20.5 + Math.sin(a) * 6.15;
      s.push({ id: `citadel-keep-buttress-${i}`, kind: 'box', material: 'stone', x: bx, yOffset: 6.4, z: bz, sx: 1.05, sy: 10.6, sz: 1.35, yaw: -a + Math.PI / 2, collider: 'none' });
    }
  }
  // Gatehouse crenellation merlons
  for (const mx of [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0]) {
    s.push({ id: `citadel-gate-merlon-${mx}`, kind: 'box', material: 'stone', x: mx, yOffset: 9.45, z: -12.85, sx: 0.92, sy: 0.88, sz: 0.55, collider: 'none' });
  }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'w' : 'e';
    const tx = side * 9.8;
    s.push(
      { id: `citadel-bastion-plinth-${tag}`, kind: 'cylinder', material: 'stone', x: tx, yOffset: -0.9, z: -17.0, sx: 3.65, sy: 2.2, sz: 3.3, segs: 12, collider: 'none' },
      { id: `citadel-bastion-${tag}`, kind: 'cylinder', material: 'stone', x: tx, yOffset: -0.8, z: -17.0, sx: 3.25, sy: 11.8, sz: 2.95, segs: 12, collider: 'circle', colliderRadius: 3.2 },
      { id: `citadel-bastion-crown-${tag}`, kind: 'cylinder', material: 'cobble', x: tx, yOffset: 10.6, z: -17.0, sx: 3.35, sy: 0.95, sz: 3.45, segs: 12, collider: 'none' },
      { id: `citadel-bastion-cap-${tag}`, kind: 'cone', material: 'accent', x: tx, yOffset: 11.45, z: -17.0, sx: 3.65, sy: 5.1, sz: 0, segs: 12, rgb: cols.spire, collider: 'none' },
      { id: `citadel-bastion-spire-${tag}`, kind: 'cone', material: 'accent', x: tx, yOffset: 16.4, z: -17.0, sx: 0.34, sy: 1.65, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
      { id: `citadel-curtain-${tag}`, kind: 'box', material: 'stone', x: side * 6.0, yOffset: 3.4, z: -17.8, sx: 5.2, sy: 6.8, sz: 2.0, collider: 'box' },
      { id: `citadel-curtain-m1-${tag}`, kind: 'box', material: 'stone', x: side * 5.0, yOffset: 7.2, z: -16.95, sx: 1.1, sy: 0.95, sz: 0.55, collider: 'none' },
      { id: `citadel-curtain-m2-${tag}`, kind: 'box', material: 'stone', x: side * 7.0, yOffset: 7.2, z: -16.95, sx: 1.1, sy: 0.95, sz: 0.55, collider: 'none' },
      { id: `citadel-banner-${tag}`, kind: 'box', material: 'accent', x: tx, yOffset: 6.4, z: -13.95, sx: 1.4, sy: 3.8, sz: 0.14, rgb: cols.banner, collider: 'none' },
      // Secondary outer turret flanking each bastion (echoing Scene I's multi-spire silhouette)
      { id: `citadel-turret-${tag}`, kind: 'cylinder', material: 'stone', x: side * 13.6, yOffset: -0.6, z: -20.2, sx: 2.1, sy: 13.4, sz: 1.85, segs: 10, collider: 'none' },
      { id: `citadel-turret-roof-${tag}`, kind: 'cone', material: 'accent', x: side * 13.6, yOffset: 12.7, z: -20.2, sx: 2.35, sy: 4.6, sz: 0, segs: 10, rgb: cols.spire, collider: 'none' },
    );
    // Flanking bastion parapet merlons
    for (let m = 0; m < 6; m++) {
      const a = (m / 6) * Math.PI * 2;
      s.push({
        id: `citadel-bastion-m-${tag}-${m}`,
        kind: 'box',
        material: 'stone',
        x: tx + Math.cos(a) * 3.18,
        yOffset: 11.75,
        z: -17.0 + Math.sin(a) * 3.18,
        sx: 0.82,
        sy: 0.78,
        sz: 0.48,
        yaw: -a + Math.PI / 2,
        collider: 'none',
      });
    }
  }
  // Northern Watchtower (0, -56) with 12-sided shaft, crown cornice & bronze spire
  s.push(
    { id: 'north-watchtower', kind: 'cylinder', material: 'stone', x: 0, yOffset: -0.6, z: -56, sx: 4.9, sy: 14.2, sz: 3.15, segs: 12, collider: 'circle', colliderRadius: 4.9 },
    { id: 'north-watch-crown', kind: 'cylinder', material: 'cobble', x: 0, yOffset: 13.3, z: -56, sx: 3.6, sy: 1.0, sz: 3.7, segs: 12, collider: 'none' },
    { id: 'north-watch-roof', kind: 'cone', material: 'accent', x: 0, yOffset: 14.2, z: -56, sx: 4.2, sy: 5.6, sz: 0, segs: 12, rgb: cols.spire, collider: 'none' },
    { id: 'north-watch-lantern', kind: 'cone', material: 'accent', x: 0, yOffset: 19.6, z: -56, sx: 0.6, sy: 1.9, sz: 0, segs: 8, rgb: cols.lantern, collider: 'none' },
  );
  // Western Monolith Stone Circle (-54, -22)
  s.push(
    { id: 'west-circle-dais', kind: 'cylinder', material: 'cobble', x: -54, yOffset: -0.2, z: -22, sx: 8.2, sy: 0.55, sz: 8.0, segs: 12, collider: 'none' },
    { id: 'west-circle-altar', kind: 'box', material: 'stone', x: -54, yOffset: 0.6, z: -22, sx: 2.8, sy: 1.0, sz: 2.8, collider: 'box' },
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const mx = -54 + Math.cos(a) * 7.2;
    const mz = -22 + Math.sin(a) * 7.2;
    const mh = 5.2 + (i % 3) * 1.4;
    s.push({ id: `west-monolith-${i}`, kind: 'box', material: 'stone', x: mx, yOffset: mh * 0.5, z: mz, sx: 1.45, sy: mh, sz: 1.05, yaw: a, collider: 'circle', colliderRadius: 0.92 });
    if (i % 2 === 0) {
      s.push({ id: `west-monolith-cap-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: mh, z: mz, sx: 0.52, sy: 1.1, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' });
    }
  }
  // Eastern Caravan Bastion (54, 10)
  s.push(
    { id: 'east-pav-base', kind: 'box', material: 'stone', x: 54, yOffset: 0.4, z: 10, sx: 10.5, sy: 1.2, sz: 8.5, collider: 'none' },
    { id: 'east-pav-roof', kind: 'cone', material: 'accent', x: 54, yOffset: 5.8, z: 10, sx: 5.8, sy: 2.8, sz: 0, segs: 4, rgb: cols.spire, collider: 'none' },
  );
  for (const [dx, dz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
    s.push({ id: `east-pav-post-${dx}-${dz}`, kind: 'box', material: 'timber', x: 54 + dx, yOffset: 3.2, z: 10 + dz, sx: 0.42, sy: 4.6, sz: 0.42, collider: 'circle', colliderRadius: 0.42 });
  }
  // Southern Outpost (-6.4, 16.6) & Gateway Obelisks (±4.4, 14.0)
  s.push(
    { id: 'south-outpost-base', kind: 'box', material: 'stone', x: -6.4, yOffset: 0.3, z: 16.6, sx: 5.4, sy: 0.9, sz: 4.4, collider: 'none' },
    { id: 'south-outpost-roof', kind: 'box', material: 'timber', x: -6.4, yOffset: 4.2, z: 16.6, sx: 5.8, sy: 0.3, sz: 4.8, collider: 'none' },
  );
  for (const [dx, dz] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) {
    s.push({ id: `outpost-post-${dx}-${dz}`, kind: 'box', material: 'timber', x: -6.4 + dx, yOffset: 2.3, z: 16.6 + dz, sx: 0.32, sy: 3.6, sz: 0.32, collider: 'circle', colliderRadius: 0.34 });
  }
  for (const side of [-1, 1]) {
    s.push(
      { id: `south-obelisk-${side < 0 ? 'w' : 'e'}`, kind: 'box', material: 'stone', x: side * 4.4, yOffset: 2.1, z: 14.0, sx: 1.4, sy: 4.6, sz: 1.4, collider: 'box' },
      { id: `south-obelisk-cap-${side < 0 ? 'w' : 'e'}`, kind: 'cone', material: 'accent', x: side * 4.4, yOffset: 4.4, z: 14.0, sx: 0.85, sy: 1.1, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' },
    );
  }
  // West Basin Bell Pavilion (-26, -8) & Smelter (-29.5, -1.5)
  s.push(
    { id: 'foundry-base', kind: 'cylinder', material: 'stone', x: -26, yOffset: -0.6, z: -8, sx: 6.8, sy: 1.2, sz: 6.5, segs: 8, collider: 'none' },
    { id: 'foundry-roof', kind: 'cone', material: 'accent', x: -26, yOffset: 7.5, z: -8, sx: 6.1, sy: 3.6, sz: 0, segs: 6, rgb: [0.34, 0.22, 0.17], collider: 'none' },
    { id: 'foundry-smelter', kind: 'box', material: 'stone', x: -29.5, yOffset: 2.5, z: -1.5, sx: 6.2, sy: 5.4, sz: 4.8, collider: 'box' },
    { id: 'foundry-chimney', kind: 'cylinder', material: 'stone', x: -31.2, yOffset: 5.0, z: -2.5, sx: 1.25, sy: 6.2, sz: 0.9, segs: 8, collider: 'none' },
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    s.push({ id: `foundry-pillar-${i}`, kind: 'box', material: 'timber', x: -26 + Math.cos(a) * 4.8, yOffset: 3.8, z: -8 + Math.sin(a) * 4.8, sx: 0.52, sy: 6.8, sz: 0.52, collider: 'circle', colliderRadius: 0.46 });
  }
  // East Shelter (20, -3.5) + Coastal Arch & Wharf (24.5, 23.8)
  s.push(
    { id: 'east-sh-roof', kind: 'box', material: 'timber', x: 20.0, yOffset: 3.6, z: -3.5, sx: 4.8, sy: 0.25, sz: 4.0, collider: 'none' },
    { id: 'coastal-arch-w', kind: 'box', material: 'stone', x: 22.8, yOffset: 2.2, z: 23.8, sx: 1.5, sy: 5.2, sz: 1.5, collider: 'box' },
    { id: 'coastal-arch-e', kind: 'box', material: 'stone', x: 26.2, yOffset: 2.2, z: 23.8, sx: 1.5, sy: 5.2, sz: 1.5, collider: 'box' },
    { id: 'coastal-arch-top', kind: 'box', material: 'stone', x: 24.5, yOffset: 4.9, z: 23.8, sx: 5.2, sy: 1.2, sz: 1.7, collider: 'none' },
  );
  for (const [dx, dz] of [[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.4], [1.8, 1.4]]) {
    s.push({ id: `east-sh-post-${dx}-${dz}`, kind: 'box', material: 'timber', x: 20.0 + dx, yOffset: 1.9, z: -3.5 + dz, sx: 0.28, sy: 3.2, sz: 0.28, collider: 'circle', colliderRadius: 0.32 });
  }
  const pierY = Math.max(spec.terrainProfile.waterLevel + 0.55, realmTerrainHeightAt(spec, 19.5, 22.5));
  s.push({ id: 'coastal-wharf-deck', kind: 'box', material: 'timber', x: 20.5, yOffset: pierY + 0.2, useAbsoluteY: true, z: 24.0, sx: 2.6, sy: 0.35, sz: 6.2, yaw: 0.35, collider: 'none' });
  for (const [sx, sz, sr, sh] of [[33, 28, 2.4, 7.8], [37, 32, 3.1, 11.4], [29, 34, 2.0, 6.2], [39, 24, 2.6, 9.0]]) {
    s.push(
      { id: `sea-stack-${sx}`, kind: 'cylinder', material: 'accent', x: sx, yOffset: -1.5, z: sz, sx: sr, sy: sh, sz: sr * 0.72, segs: 6, rgb: [0.15, 0.18, 0.22], collider: 'circle', colliderRadius: sr },
      { id: `sea-stack-top-${sx}`, kind: 'cone', material: 'accent', x: sx, yOffset: sh - 1.5, z: sz, sx: sr * 0.72, sy: sh * 0.22, sz: 0, segs: 6, rgb: [0.20, 0.25, 0.30], collider: 'none' },
    );
  }
  return { structures: s, plazas, vents: [[-30, -10], [-26, -13], [-33, -6]] };
}

function buildAqueductTerracesStructures(
  spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: 0, z: -22, radius: 13 },
    { x: -30, z: -12, radius: 9 },
    { x: 28, z: 16, radius: 9 },
    { x: 0, z: 22, radius: 8 },
  ];
  // Sweeping Grand Elevated Roman-Style Mossy Aqueduct Arcade spanning X = -48..+48 at Z = -24!
  const aqY = realmTerrainHeightAt(spec, 0, -24);
  for (let ax = -42; ax <= 42; ax += 7) {
    if (Math.abs(ax) < 4) continue; // Wide grand central canal arch!
    s.push(
      { id: `aqueduct-pier-${ax}`, kind: 'box', material: 'stone', x: ax, yOffset: 6.2, z: -24, sx: 2.0, sy: 12.8, sz: 2.4, collider: 'box' },
      { id: `aqueduct-capital-${ax}`, kind: 'box', material: 'cobble', x: ax, yOffset: 12.4, z: -24, sx: 2.8, sy: 0.7, sz: 2.9, collider: 'none' },
    );
  }
  // Upper aqueduct stone water channel spanning across all piers
  s.push(
    { id: 'aqueduct-channel-bed', kind: 'box', material: 'stone', x: 0, yOffset: aqY + 13.0, useAbsoluteY: true, z: -24, sx: 88, sy: 1.6, sz: 3.1, collider: 'none' },
    { id: 'aqueduct-channel-water', kind: 'box', material: 'accent', x: 0, yOffset: aqY + 14.0, useAbsoluteY: true, z: -24, sx: 86, sy: 0.45, sz: 1.7, rgb: [0.16, 0.66, 0.56], collider: 'none' },
  );
  // Central Sunken Water-Garden Rotunda Gazebo (0, -14.5) — open colonnade you can walk right through!
  s.push(
    { id: 'garden-dais', kind: 'cylinder', material: 'cobble', x: 0, yOffset: -0.1, z: -14.5, sx: 8.6, sy: 0.45, sz: 8.4, segs: 12, collider: 'none' },
    { id: 'garden-dome', kind: 'cone', material: 'accent', x: 0, yOffset: 7.4, z: -14.5, sx: 8.2, sy: 3.8, sz: 0, segs: 12, rgb: cols.spire, collider: 'none' },
    { id: 'garden-finial', kind: 'cone', material: 'accent', x: 0, yOffset: 11.2, z: -14.5, sx: 0.7, sy: 1.9, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * 6.8;
    const pz = -14.5 + Math.sin(a) * 6.8;
    s.push({ id: `garden-col-${i}`, kind: 'cylinder', material: 'stone', x: px, yOffset: 0.2, z: pz, sx: 0.58, sy: 7.2, sz: 0.5, segs: 8, collider: 'circle', colliderRadius: 0.62 });
  }
  // West Botanical Conservatory Cloister (-32, -10) — stepped glass/timber greenhouse arches
  s.push(
    { id: 'cloister-w-plinth', kind: 'box', material: 'cobble', x: -32, yOffset: 0.3, z: -10, sx: 12.0, sy: 0.8, sz: 10.0, collider: 'none' },
    { id: 'cloister-w-roof', kind: 'box', material: 'accent', x: -32, yOffset: 5.6, z: -10, sx: 11.6, sy: 0.4, sz: 9.6, rgb: [0.22, 0.54, 0.40], collider: 'none' },
  );
  for (const [dx, dz] of [[-5, -4], [0, -4], [5, -4], [-5, 4], [0, 4], [5, 4]]) {
    s.push({ id: `cloister-w-post-${dx}-${dz}`, kind: 'cylinder', material: 'stone', x: -32 + dx, yOffset: 0.6, z: -10 + dz, sx: 0.46, sy: 5.0, sz: 0.42, segs: 8, collider: 'circle', colliderRadius: 0.5 });
  }
  // East Sunken Cistern Waterwheel Tower (30, -14)
  s.push(
    { id: 'cistern-tower', kind: 'cylinder', material: 'stone', x: 30, yOffset: -0.4, z: -14, sx: 4.4, sy: 10.2, sz: 3.8, segs: 10, collider: 'circle', colliderRadius: 4.4 },
    { id: 'cistern-roof', kind: 'cone', material: 'accent', x: 30, yOffset: 9.8, z: -14, sx: 4.8, sy: 3.6, sz: 0, segs: 10, rgb: cols.spire, collider: 'none' },
    { id: 'cistern-wheel', kind: 'cylinder', material: 'timber', x: 25.4, yOffset: 2.2, z: -14, sx: 2.8, sy: 0.6, sz: 2.8, segs: 12, collider: 'none' },
  );
  // Southern Mossy Canal Tea-Pavilion (16, 22) & North-West Sluice Gatehouse (-44, -46)
  s.push(
    { id: 'canal-pav-base', kind: 'cylinder', material: 'timber', x: 16, yOffset: 0.2, z: 22, sx: 5.2, sy: 0.6, sz: 5.2, segs: 8, collider: 'none' },
    { id: 'canal-pav-roof', kind: 'cone', material: 'accent', x: 16, yOffset: 4.8, z: 22, sx: 5.8, sy: 2.4, sz: 0, segs: 8, rgb: cols.banner, collider: 'none' },
    { id: 'sluice-gate-w', kind: 'box', material: 'stone', x: -46, yOffset: 4.0, z: -46, sx: 2.4, sy: 8.4, sz: 2.4, collider: 'box' },
    { id: 'sluice-gate-e', kind: 'box', material: 'stone', x: -40, yOffset: 4.0, z: -46, sx: 2.4, sy: 8.4, sz: 2.4, collider: 'box' },
    { id: 'sluice-gate-top', kind: 'box', material: 'stone', x: -43, yOffset: 8.4, z: -46, sx: 9.2, sy: 1.5, sz: 2.8, collider: 'none' },
  );
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    s.push({ id: `canal-pav-p-${i}`, kind: 'box', material: 'timber', x: 16 + Math.cos(a) * 4.1, yOffset: 2.6, z: 22 + Math.sin(a) * 4.1, sx: 0.34, sy: 4.2, sz: 0.34, collider: 'circle', colliderRadius: 0.38 });
  }
  // Twin Emerald Lantern Arches flanking the Southern Entrance (±5.2, 16.5)
  for (const side of [-1, 1]) {
    s.push(
      { id: `aq-lantern-pillar-${side}`, kind: 'cylinder', material: 'stone', x: side * 5.4, yOffset: 0, z: 16.5, sx: 0.72, sy: 4.8, sz: 0.56, segs: 8, collider: 'circle', colliderRadius: 0.75 },
      { id: `aq-lantern-bulb-${side}`, kind: 'cone', material: 'accent', x: side * 5.4, yOffset: 4.8, z: 16.5, sx: 0.72, sy: 1.1, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
    );
  }
  return { structures: s, plazas, vents: [] };
}

function buildCalderaAmphitheaterStructures(
  _spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: 0, z: -22, radius: 16 },
    { x: -34, z: -18, radius: 9 },
    { x: 34, z: -18, radius: 9 },
    { x: 0, z: 18, radius: 8 },
  ];
  // Concentric Obsidian Ring-Forge Amphitheater centered at (0, -24) with open south & east/west gates!
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // Leave wide southern entry (sin > 0.78) and cardinal passages open
    if (Math.sin(a) > 0.78 && Math.abs(Math.cos(a)) < 0.55) continue;
    const rx = Math.cos(a) * 14.5;
    const rz = -24 + Math.sin(a) * 14.5;
    const h = 7.5 + (i % 2) * 3.8;
    s.push(
      { id: `caldera-pylon-${i}`, kind: 'box', material: 'stone', x: rx, yOffset: h * 0.5, z: rz, sx: 2.6, sy: h, sz: 2.2, yaw: -a, collider: 'box' },
      { id: `caldera-pylon-glow-${i}`, kind: 'cone', material: 'accent', x: rx, yOffset: h, z: rz, sx: 1.1, sy: 2.4, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' },
    );
  }
  // Towering Central Crucible Anvil Furnace Chimney at (0, -26.5) with glowing molten core collar!
  s.push(
    { id: 'crucible-hearth', kind: 'cylinder', material: 'stone', x: 0, yOffset: -0.4, z: -26.5, sx: 5.4, sy: 4.2, sz: 4.8, segs: 6, collider: 'circle', colliderRadius: 5.4 },
    { id: 'crucible-core-ring', kind: 'cylinder', material: 'accent', x: 0, yOffset: 3.8, z: -26.5, sx: 4.9, sy: 1.5, sz: 4.6, segs: 6, rgb: cols.lantern, collider: 'none' },
    { id: 'crucible-stack', kind: 'cylinder', material: 'stone', x: 0, yOffset: 5.3, z: -26.5, sx: 4.2, sy: 11.5, sz: 2.6, segs: 6, collider: 'none' },
    { id: 'crucible-crown', kind: 'cone', material: 'accent', x: 0, yOffset: 16.8, z: -26.5, sx: 3.1, sy: 2.8, sz: 0, segs: 6, rgb: cols.banner, collider: 'none' },
  );
  // Twin Smelting Kiln Chimneys on West (-34, -18) and East (34, -16) Ridges
  for (const [kx, kz, tag] of [[-34, -18, 'west'], [34, -16, 'east'], [-28, 22, 'sw']] as Array<[number, number, string]>) {
    s.push(
      { id: `kiln-base-${tag}`, kind: 'box', material: 'stone', x: kx, yOffset: 2.6, z: kz, sx: 7.2, sy: 5.4, sz: 6.4, collider: 'box' },
      { id: `kiln-flue-${tag}`, kind: 'cylinder', material: 'stone', x: kx, yOffset: 5.2, z: kz, sx: 2.1, sy: 9.8, sz: 1.4, segs: 6, collider: 'none' },
      { id: `kiln-ember-${tag}`, kind: 'cone', material: 'accent', x: kx, yOffset: 15.0, z: kz, sx: 1.5, sy: 2.2, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
    );
  }
  // Stepped Basalt Slag Cooling Terraces & Iron Gantry Arch at Southern Approach (0, 14.5)
  s.push(
    { id: 'gantry-pier-w', kind: 'box', material: 'stone', x: -4.8, yOffset: 3.4, z: 14.5, sx: 1.8, sy: 7.2, sz: 2.0, collider: 'box' },
    { id: 'gantry-pier-e', kind: 'box', material: 'stone', x: 4.8, yOffset: 3.4, z: 14.5, sx: 1.8, sy: 7.2, sz: 2.0, collider: 'box' },
    { id: 'gantry-beam', kind: 'box', material: 'accent', x: 0, yOffset: 7.2, z: 14.5, sx: 12.2, sy: 1.2, sz: 1.6, rgb: cols.spire, collider: 'none' },
    { id: 'gantry-beacon-w', kind: 'cone', material: 'accent', x: -4.8, yOffset: 7.8, z: 14.5, sx: 0.75, sy: 1.6, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' },
    { id: 'gantry-beacon-e', kind: 'cone', material: 'accent', x: 4.8, yOffset: 7.8, z: 14.5, sx: 0.75, sy: 1.6, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' },
  );
  // Northern Lava-Observation Citadel Tower (16, -54)
  s.push(
    { id: 'caldera-watch', kind: 'cylinder', material: 'stone', x: 16, yOffset: -0.5, z: -54, sx: 4.4, sy: 13.5, sz: 3.4, segs: 6, collider: 'circle', colliderRadius: 4.4 },
    { id: 'caldera-watch-top', kind: 'cone', material: 'accent', x: 16, yOffset: 13.0, z: -54, sx: 3.8, sy: 4.2, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
  );
  const vents: Array<[number, number]> = [
    [-16, -16], [16, -16], [-12, -34], [14, -32], [-24, -6], [24, -8], [0, -10],
  ];
  return { structures: s, plazas, vents };
}

function buildArchipelagoAtollsStructures(
  spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: 0, z: -20, radius: 11 },
    { x: -24, z: 18, radius: 8 },
    { x: 26, z: -12, radius: 9 },
  ];
  // Towering Spiral Limestone Sea-Lighthouse on Central Sea-Rock (0, -21)
  s.push(
    { id: 'lighthouse-base', kind: 'cylinder', material: 'stone', x: 0, yOffset: -0.6, z: -21, sx: 6.2, sy: 4.5, sz: 5.2, segs: 12, collider: 'circle', colliderRadius: 6.0 },
    { id: 'lighthouse-shaft', kind: 'cylinder', material: 'stone', x: 0, yOffset: 3.9, z: -21, sx: 4.6, sy: 13.5, sz: 3.2, segs: 12, collider: 'none' },
    { id: 'lighthouse-gallery', kind: 'cylinder', material: 'cobble', x: 0, yOffset: 17.4, z: -21, sx: 4.4, sy: 0.8, sz: 4.4, segs: 12, collider: 'none' },
    { id: 'lighthouse-lantern', kind: 'cylinder', material: 'accent', x: 0, yOffset: 18.2, z: -21, sx: 2.6, sy: 3.2, sz: 2.6, segs: 10, rgb: cols.lantern, collider: 'none' },
    { id: 'lighthouse-dome', kind: 'cone', material: 'accent', x: 0, yOffset: 21.4, z: -21, sx: 3.6, sy: 4.2, sz: 0, segs: 10, rgb: cols.spire, collider: 'none' },
  );
  // Sweeping Sea-Arch Tidal Viaducts framing East & West Atolls
  for (const [ax, az, yaw, tag] of [[-24, -14, 0.45, 'west'], [26, -12, -0.45, 'east'], [24, 24, 0.25, 'se']] as Array<[number, number, number, string]>) {
    s.push(
      { id: `atoll-arch-l-${tag}`, kind: 'cylinder', material: 'stone', x: ax - 3.6, yOffset: -0.6, z: az, sx: 1.4, sy: 7.4, sz: 1.1, segs: 8, collider: 'circle', colliderRadius: 1.4 },
      { id: `atoll-arch-r-${tag}`, kind: 'cylinder', material: 'stone', x: ax + 3.6, yOffset: -0.6, z: az, sx: 1.4, sy: 7.4, sz: 1.1, segs: 8, collider: 'circle', colliderRadius: 1.4 },
      { id: `atoll-arch-span-${tag}`, kind: 'box', material: 'stone', x: ax, yOffset: 7.2, z: az, sx: 9.8, sy: 1.5, sz: 2.0, yaw, collider: 'none' },
      { id: `atoll-arch-sail-${tag}`, kind: 'cone', material: 'accent', x: ax, yOffset: 8.0, z: az, sx: 2.4, sy: 3.4, sz: 0, segs: 4, rgb: cols.banner, collider: 'none' },
    );
  }
  // Curved Timber Stilt-Wharf Villages & Hanging Lantern Jetties extending over the water!
  const waterY = spec.terrainProfile.waterLevel;
  for (const [jx, jz, rot, tag] of [[-18, 12, 0.25, 'w'], [18, 14, -0.32, 'e'], [-34, 4, 0.5, 'farw']] as Array<[number, number, number, string]>) {
    const deckY = Math.max(waterY + 0.65, realmTerrainHeightAt(spec, jx, jz) + 0.4);
    s.push(
      { id: `jetty-deck-${tag}`, kind: 'box', material: 'timber', x: jx, yOffset: deckY, useAbsoluteY: true, z: jz, sx: 3.8, sy: 0.35, sz: 10.5, yaw: rot, collider: 'none' },
      { id: `jetty-awning-${tag}`, kind: 'cone', material: 'accent', x: jx, yOffset: deckY + 3.6, useAbsoluteY: true, z: jz, sx: 3.2, sy: 1.8, sz: 0, segs: 4, rgb: cols.banner, collider: 'none' },
      { id: `jetty-post-a-${tag}`, kind: 'cylinder', material: 'timber', x: jx - 1.5, yOffset: deckY - 2.4, useAbsoluteY: true, z: jz - 3.6, sx: 0.24, sy: 6.0, sz: 0.2, segs: 6, collider: 'circle', colliderRadius: 0.3 },
      { id: `jetty-post-b-${tag}`, kind: 'cylinder', material: 'timber', x: jx + 1.5, yOffset: deckY - 2.4, useAbsoluteY: true, z: jz + 3.6, sx: 0.24, sy: 6.0, sz: 0.2, segs: 6, collider: 'circle', colliderRadius: 0.3 },
    );
  }
  // Towering Limestone Sea-Stacks around the outer bay
  for (const [sx, sz, sr, sh] of [[-42, -38, 3.6, 13.5], [44, -36, 4.1, 15.2], [38, 30, 3.2, 11.0], [-40, 28, 2.9, 9.8], [0, -58, 4.8, 16.5]]) {
    s.push(
      { id: `pelagic-stack-${sx}-${sz}`, kind: 'cylinder', material: 'accent', x: sx, yOffset: -1.8, z: sz, sx: sr, sy: sh, sz: sr * 0.62, segs: 7, rgb: cols.accent, collider: 'circle', colliderRadius: sr },
      { id: `pelagic-cap-${sx}-${sz}`, kind: 'cone', material: 'accent', x: sx, yOffset: sh - 1.8, z: sz, sx: sr * 0.64, sy: sh * 0.28, sz: 0, segs: 7, rgb: cols.spire, collider: 'none' },
    );
  }
  return { structures: s, plazas, vents: [] };
}

function buildCaravanZigguratStructures(
  _spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: -16, z: -24, radius: 14 },
    { x: 20, z: 18, radius: 11 },
    { x: 24, z: -18, radius: 9 },
  ];
  // Monumental Stepped Sandstone Sun-Ziggurat offset to the NW Mesa (-16, -24)!
  s.push(
    { id: 'zig-tier1', kind: 'box', material: 'stone', x: -16, yOffset: 2.2, z: -24, sx: 17.0, sy: 4.4, sz: 14.0, collider: 'box' },
    { id: 'zig-tier2', kind: 'box', material: 'stone', x: -16, yOffset: 6.0, z: -24, sx: 12.6, sy: 3.6, sz: 10.4, collider: 'none' },
    { id: 'zig-tier3', kind: 'box', material: 'cobble', x: -16, yOffset: 9.2, z: -24, sx: 8.2, sy: 3.0, sz: 7.0, collider: 'none' },
    { id: 'zig-sanctum', kind: 'cylinder', material: 'accent', x: -16, yOffset: 10.7, z: -24, sx: 2.8, sy: 5.5, sz: 1.6, segs: 6, rgb: cols.accent, collider: 'none' },
    { id: 'zig-sun-finial', kind: 'cone', material: 'accent', x: -16, yOffset: 16.2, z: -24, sx: 1.8, sy: 3.6, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
  );
  // Avenue of Singing Bronze Wind-Harp Monoliths lining the diagonal caravan road
  for (const [mx, mz, idx] of [[-8, 18, 0], [8, 18, 1], [14, -8, 2], [24, -18, 3], [-32, 8, 4], [36, -34, 5]] as Array<[number, number, number]>) {
    s.push(
      { id: `windharp-base-${idx}`, kind: 'box', material: 'stone', x: mx, yOffset: 4.8, z: mz, sx: 1.6, sy: 9.8, sz: 1.6, collider: 'box' },
      { id: `windharp-chime-${idx}`, kind: 'box', material: 'accent', x: mx, yOffset: 10.6, z: mz, sx: 0.65, sy: 2.8, sz: 0.65, rgb: cols.lantern, collider: 'none' },
    );
  }
  // Circular Nomadic Silk-and-Timber Bazaar Pavilions in the SE Oasis (18..32, 16..28)
  for (const [tx, tz, rad, tint, tag] of [
    [22, 20, 4.8, cols.banner, 'main'],
    [32, 14, 3.8, cols.spire, 'spice'],
    [16, 30, 3.6, [0.76, 0.34, 0.18] as [number, number, number], 'loom'],
    [-22, 20, 4.0, cols.banner, 'west'],
  ] as Array<[number, number, number, [number, number, number], string]>) {
    s.push(
      { id: `tent-canopy-${tag}`, kind: 'cone', material: 'accent', x: tx, yOffset: 3.8, z: tz, sx: rad, sy: 2.9, sz: 0, segs: 8, rgb: tint, collider: 'none' },
      { id: `tent-spire-${tag}`, kind: 'cylinder', material: 'timber', x: tx, yOffset: 0, z: tz, sx: 0.24, sy: 6.9, sz: 0.18, segs: 6, collider: 'circle', colliderRadius: 0.35 },
    );
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      s.push({ id: `tent-pole-${tag}-${i}`, kind: 'cylinder', material: 'timber', x: tx + Math.cos(a) * (rad * 0.78), yOffset: 0, z: tz + Math.sin(a) * (rad * 0.78), sx: 0.16, sy: 3.9, sz: 0.14, segs: 6, collider: 'circle', colliderRadius: 0.26 });
    }
  }
  // Northern Canyon Sun-Arch Gate (0, -48)
  s.push(
    { id: 'sun-arch-w', kind: 'box', material: 'stone', x: -6.5, yOffset: 5.5, z: -48, sx: 3.2, sy: 11.4, sz: 3.0, collider: 'box' },
    { id: 'sun-arch-e', kind: 'box', material: 'stone', x: 6.5, yOffset: 5.5, z: -48, sx: 3.2, sy: 11.4, sz: 3.0, collider: 'box' },
    { id: 'sun-arch-top', kind: 'box', material: 'stone', x: 0, yOffset: 11.6, z: -48, sx: 17.0, sy: 2.4, sz: 3.2, collider: 'none' },
    { id: 'sun-arch-disc', kind: 'cylinder', material: 'accent', x: 0, yOffset: 12.8, z: -48, sx: 2.2, sy: 0.8, sz: 2.2, segs: 12, rgb: cols.lantern, collider: 'none' },
  );
  return { structures: s, plazas, vents: [] };
}

function buildAuroraObservatoryStructures(
  _spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const plazas: SynthesizedPlazaZone[] = [
    { x: 0, z: -22, radius: 14 },
    { x: -30, z: -20, radius: 9 },
    { x: 30, z: -20, radius: 9 },
  ];
  // Hexagonal Frostglass Crystal Observatory Complex (0, -22)
  s.push(
    { id: 'obs-dais', kind: 'cylinder', material: 'cobble', x: 0, yOffset: -0.2, z: -22, sx: 11.5, sy: 0.8, sz: 11.0, segs: 6, collider: 'none' },
    { id: 'obs-core', kind: 'cylinder', material: 'stone', x: 0, yOffset: 0.6, z: -22, sx: 5.8, sy: 9.2, sz: 4.8, segs: 6, collider: 'circle', colliderRadius: 5.8 },
    { id: 'obs-crystal-spire', kind: 'cone', material: 'accent', x: 0, yOffset: 9.8, z: -22, sx: 4.9, sy: 13.8, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
  );
  // 6 Radiating Aurora Prism-Mirror Pylons forming a star-ring around the Observatory
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * 15.5;
    const pz = -22 + Math.sin(a) * 15.5;
    s.push(
      { id: `prism-base-${i}`, kind: 'cylinder', material: 'stone', x: px, yOffset: -0.4, z: pz, sx: 1.8, sy: 5.6, sz: 1.2, segs: 6, collider: 'circle', colliderRadius: 1.8 },
      { id: `prism-needle-${i}`, kind: 'cone', material: 'accent', x: px, yOffset: 5.2, z: pz, sx: 1.2, sy: 6.4, sz: 0, segs: 6, rgb: cols.spire, collider: 'none' },
    );
  }
  // Twin Flanking Polar Astrolabe Relay Domes (-32, -16) & (32, -16)
  for (const side of [-1, 1]) {
    const rx = side * 32;
    const tag = side < 0 ? 'w' : 'e';
    s.push(
      { id: `relay-drum-${tag}`, kind: 'cylinder', material: 'stone', x: rx, yOffset: -0.4, z: -16, sx: 5.2, sy: 5.4, sz: 4.8, segs: 8, collider: 'circle', colliderRadius: 5.2 },
      { id: `relay-dome-${tag}`, kind: 'cone', material: 'accent', x: rx, yOffset: 5.0, z: -16, sx: 5.1, sy: 5.8, sz: 0, segs: 8, rgb: cols.accent, collider: 'none' },
      { id: `relay-lens-${tag}`, kind: 'cone', material: 'accent', x: rx, yOffset: 10.8, z: -16, sx: 0.9, sy: 2.6, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
    );
  }
  // Glacial Ice-Arch Viaduct flanking Southern Mirror Pool (-16, 18) & (16, 18)
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'w' : 'e';
    s.push(
      { id: `ice-arch-a-${tag}`, kind: 'cylinder', material: 'accent', x: side * 14, yOffset: -0.5, z: 18, sx: 1.4, sy: 8.2, sz: 0.85, segs: 6, rgb: cols.spire, collider: 'circle', colliderRadius: 1.4 },
      { id: `ice-arch-b-${tag}`, kind: 'cylinder', material: 'accent', x: side * 21, yOffset: -0.5, z: 18, sx: 1.4, sy: 8.2, sz: 0.85, segs: 6, rgb: cols.spire, collider: 'circle', colliderRadius: 1.4 },
      { id: `ice-arch-span-${tag}`, kind: 'box', material: 'accent', x: side * 17.5, yOffset: 7.9, z: 18, sx: 9.2, sy: 1.3, sz: 1.6, rgb: cols.lantern, collider: 'none' },
    );
  }
  return { structures: s, plazas, vents: [] };
}

function buildMonolithSanctuaryStructures(
  spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const rng = createSeededRng(spec.seed ^ 0x44f1);
  const cx = Math.round((rng() - 0.5) * 18);
  const cz = -20 - Math.round(rng() * 14);
  const plazas: SynthesizedPlazaZone[] = [
    { x: cx, z: cz, radius: 15 },
    { x: -28, z: 18, radius: 8 },
    { x: 28, z: -12, radius: 8 },
  ];
  // Outer Megalithic Astronomical Stone Ring (10 standing trilithon stones + central sundial spire)
  s.push(
    { id: 'sanctuary-floor', kind: 'cylinder', material: 'cobble', x: cx, yOffset: -0.15, z: cz, sx: 14.5, sy: 0.5, sz: 14.2, segs: 16, collider: 'none' },
    { id: 'sanctuary-gnomon', kind: 'cylinder', material: 'stone', x: cx, yOffset: 0.3, z: cz, sx: 2.2, sy: 11.5, sz: 0.9, segs: 6, collider: 'circle', colliderRadius: 2.2 },
    { id: 'sanctuary-orb', kind: 'cone', material: 'accent', x: cx, yOffset: 11.8, z: cz, sx: 1.2, sy: 2.8, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
  );
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.sin(a) > 0.85) continue; // Wide south portal
    const mx = cx + Math.cos(a) * 12.2;
    const mz = cz + Math.sin(a) * 12.2;
    const h = 6.2 + (i % 3) * 1.9;
    s.push(
      { id: `mega-stone-${i}`, kind: 'box', material: 'stone', x: mx, yOffset: h * 0.5, z: mz, sx: 2.0, sy: h, sz: 1.4, yaw: -a, collider: 'box' },
      { id: `mega-rune-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: h, z: mz, sx: 0.72, sy: 1.5, sz: 0, segs: 4, rgb: cols.spire, collider: 'none' },
    );
  }
  // 3 Dolmen Shrine Chambers scattered on outer hills
  for (const [dx, dz, tag] of [[-32, -16, 'nw'], [32, -18, 'ne'], [24, 24, 'se']] as Array<[number, number, string]>) {
    s.push(
      { id: `dolmen-l-${tag}`, kind: 'box', material: 'stone', x: dx - 2.6, yOffset: 2.4, z: dz, sx: 1.5, sy: 5.0, sz: 2.4, collider: 'box' },
      { id: `dolmen-r-${tag}`, kind: 'box', material: 'stone', x: dx + 2.6, yOffset: 2.4, z: dz, sx: 1.5, sy: 5.0, sz: 2.4, collider: 'box' },
      { id: `dolmen-cap-${tag}`, kind: 'box', material: 'stone', x: dx, yOffset: 5.4, z: dz, sx: 8.4, sy: 1.4, sz: 3.4, collider: 'none' },
      { id: `dolmen-gem-${tag}`, kind: 'cone', material: 'accent', x: dx, yOffset: 6.1, z: dz, sx: 0.9, sy: 1.9, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
    );
  }
  return { structures: s, plazas, vents: [] };
}

function buildCliffsideBastionStructures(
  spec: FrontiersRealmSpec,
  cols: ReturnType<typeof getThemeColors>,
): { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> } {
  const s: StructurePrimitive[] = [];
  const rng = createSeededRng(spec.seed ^ 0x9931);
  const sideFlip = rng() > 0.5 ? 1 : -1;
  const plazas: SynthesizedPlazaZone[] = [
    { x: sideFlip * 18, z: -22, radius: 13 },
    { x: -sideFlip * 22, z: -14, radius: 10 },
    { x: sideFlip * 16, z: 20, radius: 9 },
  ];
  // Asymmetric Terraced Ridge Keep perched on the East or West flank!
  const kx = sideFlip * 20;
  const kz = -24;
  s.push(
    { id: 'ridge-terrace', kind: 'box', material: 'stone', x: kx, yOffset: 1.5, z: kz, sx: 16.0, sy: 3.2, sz: 14.0, collider: 'none' },
    { id: 'ridge-keep', kind: 'box', material: 'stone', x: kx, yOffset: 6.4, z: kz - 2, sx: 9.2, sy: 10.6, sz: 8.6, collider: 'box' },
    { id: 'ridge-roof', kind: 'cone', material: 'accent', x: kx, yOffset: 11.7, z: kz - 2, sx: 7.2, sy: 5.4, sz: 0, segs: 4, rgb: cols.spire, collider: 'none' },
    { id: 'ridge-banner', kind: 'box', material: 'accent', x: kx, yOffset: 7.2, z: kz + 2.4, sx: 1.8, sy: 4.4, sz: 0.16, rgb: cols.banner, collider: 'none' },
  );
  // Opposite-Bank Signal Beacon Tower + Timber Hall
  const bx = -sideFlip * 24;
  s.push(
    { id: 'signal-tower', kind: 'cylinder', material: 'stone', x: bx, yOffset: -0.4, z: -16, sx: 3.8, sy: 12.6, sz: 2.8, segs: 8, collider: 'circle', colliderRadius: 3.8 },
    { id: 'signal-fire', kind: 'cone', material: 'accent', x: bx, yOffset: 12.2, z: -16, sx: 1.8, sy: 3.0, sz: 0, segs: 6, rgb: cols.lantern, collider: 'none' },
    { id: 'timber-hall', kind: 'box', material: 'timber', x: bx + sideFlip * 6, yOffset: 2.2, z: 20, sx: 9.2, sy: 4.4, sz: 6.4, collider: 'box' },
    { id: 'timber-hall-roof', kind: 'cone', material: 'accent', x: bx + sideFlip * 6, yOffset: 4.4, z: 20, sx: 6.4, sy: 2.8, sz: 0, segs: 4, rgb: cols.spire, collider: 'none' },
  );
  // Watch-Archway along the North Pass
  s.push(
    { id: 'pass-arch-w', kind: 'box', material: 'stone', x: -5.2, yOffset: 4.2, z: -44, sx: 2.2, sy: 8.8, sz: 2.4, collider: 'box' },
    { id: 'pass-arch-e', kind: 'box', material: 'stone', x: 5.2, yOffset: 4.2, z: -44, sx: 2.2, sy: 8.8, sz: 2.4, collider: 'box' },
    { id: 'pass-arch-top', kind: 'box', material: 'stone', x: 0, yOffset: 8.8, z: -44, sx: 13.4, sy: 1.8, sz: 2.6, collider: 'none' },
  );
  return { structures: s, plazas, vents: [] };
}

// ============================================================================
// PROCEDURAL ECOLOGICAL FLORA DISTRIBUTION (NO HARDCODED CLONED 50 TREE COORDS!)
// ============================================================================

function synthesizeEcologicalFlora(
  spec: FrontiersRealmSpec,
  floraKit: FloraKitId,
  structures: StructurePrimitive[],
): SynthesizedFloraInstance[] {
  const rng = createSeededRng(hashStringSeed(`flora:${spec.slug}:${spec.seed}:${floraKit}`));
  const flora: SynthesizedFloraInstance[] = [];
  const waterY = spec.terrainProfile.waterLevel;

  const isBlockedByStructure = (x: number, z: number): boolean => {
    for (const st of structures) {
      if (st.collider === 'none') continue;
      const rad = st.collider === 'circle' ? (st.colliderRadius ?? st.sx) : Math.max(st.sx, st.sz) * 0.55;
      if (Math.hypot(x - st.x, z - st.z) < rad + 2.6) return true;
    }
    return false;
  };

  // Generate ecological clusters tailored to each flora kit's habitat preference!
  const targetCount = 58;
  let attempts = 0;

  // Create 7 deterministic ecological grove centers unique to this realm's seed
  const groveCenters: Array<[number, number, number]> = [];
  for (let g = 0; g < 7; g++) {
    const ang = (g / 7) * Math.PI * 2 + rng() * 0.7;
    const dist = 20 + rng() * 54;
    groveCenters.push([Math.cos(ang) * dist, Math.sin(ang) * dist, 10 + rng() * 14]);
  }

  while (flora.length < targetCount && attempts < 620) {
    attempts++;
    const useCluster = rng() < 0.72;
    let x: number;
    let z: number;
    if (useCluster) {
      const [gx, gz, gRad] = groveCenters[Math.floor(rng() * groveCenters.length)];
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * gRad;
      x = gx + Math.cos(a) * r;
      z = gz + Math.sin(a) * r;
    } else {
      x = (rng() - 0.5) * 164;
      z = (rng() - 0.5) * 164;
    }

    if (Math.abs(x) > 84 || Math.abs(z) > 84) continue;
    if (isNearProtectedSpot(spec, x, z, 4.2)) continue;
    if (isBlockedByStructure(x, z)) continue;

    const ty = realmTerrainHeightAt(spec, x, z);
    const slope = Math.hypot(
      (realmTerrainHeightAt(spec, x + 1, z) - realmTerrainHeightAt(spec, x - 1, z)) * 0.5,
      (realmTerrainHeightAt(spec, x, z + 1) - realmTerrainHeightAt(spec, x, z - 1)) * 0.5,
    );

    // Ecological habitat rules per flora kit!
    const distRiver = Math.abs(z - realmRiverCenterZ(spec, x));
    if (floraKit === 'coral-palm-atoll') {
      // Allow shallow-water coral clusters right near shoreline, and palms on dry coastal dunes!
      if (ty < waterY - 0.65 || slope > 0.48) continue;
    } else if (floraKit === 'weeping-banyan' || floraKit === 'giant-fungal-canopy') {
      // Lush wetland flora prefers moist lower elevations and near riverbanks
      if (ty < waterY + 0.12 || slope > 0.46) continue;
      if (ty > 8.5 && rng() < 0.7) continue;
    } else if (floraKit === 'obsidian-vent-spires' || floraKit === 'mesa-hoodoo-juniper') {
      // Volcanic spires & sandstone hoodoos thrive on arid slopes & mesas away from river
      if (ty < waterY + 0.4 || slope > 0.56) continue;
      if (distRiver < 5.5) continue;
    } else {
      // Conifers, frostglass pines, petrified amber groves
      if (ty < waterY + 0.25 || slope > 0.50) continue;
    }

    // Keep clean natural spacing between flora instances
    let tooClose = false;
    for (const prev of flora) {
      if (Math.hypot(prev.x - x, prev.z - z) < 5.2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const scale = 0.8 + rng() * 0.75;
    const colliderRadius =
      floraKit === 'obsidian-vent-spires' || floraKit === 'mesa-hoodoo-juniper'
        ? 1.15
        : floraKit === 'weeping-banyan' || floraKit === 'giant-fungal-canopy'
          ? 0.92
          : 0.65;

    flora.push({
      id: `eco-flora-${spec.slug}-${flora.length}`,
      kit: floraKit,
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      scale: Number(scale.toFixed(3)),
      yaw: Number((rng() * Math.PI * 2).toFixed(3)),
      variant: Number(rng().toFixed(3)),
      colliderRadius,
    });
  }

  return flora;
}

const PLAN_CACHE = new Map<string, SynthesizedEcosystemPlan>();

/**
 * Deterministic Verdant Ecosystem Synthesizer:
 * Generates a complete, bespoke, non-cloned architectural layout, botanical/geological flora field,
 * fauna morphology kit, and live gameplay phenomenon from the extended Verdant Catalog for ANY realm
 * (canonical or infinite procedural cell).
 */
export function synthesizeRealmEcosystem(spec: FrontiersRealmSpec): SynthesizedEcosystemPlan {
  const cacheKey = `${spec.slug}:${spec.seed}:${spec.theme}:${spec.isDungeon ? 'd' : 'o'}`;
  const cached = PLAN_CACHE.get(cacheKey);
  if (cached) return cached;

  const { layoutId, floraKit, faunaKit, phenomenonId } = selectEcosystemIdentity(spec);
  const cols = getThemeColors(spec.theme);
  const phenomenon = ECOSYSTEM_PHENOMENA[phenomenonId];

  if (spec.isDungeon) {
    const plan: SynthesizedEcosystemPlan = {
      realmSlug: spec.slug,
      theme: spec.theme,
      layoutId,
      layoutTitle: LAYOUT_TITLES[layoutId],
      floraKit,
      floraTitle: FLORA_TITLES[floraKit],
      faunaKit,
      faunaTitle: FAUNA_TITLES[faunaKit],
      phenomenon,
      plazaZones: [],
      structures: [],
      floraInstances: [],
      thermalVents: [],
      catalogExtensionIds: [`verdant:fauna:${faunaKit}`],
    };
    PLAN_CACHE.set(cacheKey, plan);
    return plan;
  }

  let built: { structures: StructurePrimitive[]; plazas: SynthesizedPlazaZone[]; vents: Array<[number, number]> };
  switch (layoutId) {
    case 'aqueduct-terraces':
      built = buildAqueductTerracesStructures(spec, cols);
      break;
    case 'caldera-amphitheater':
      built = buildCalderaAmphitheaterStructures(spec, cols);
      break;
    case 'archipelago-atolls':
      built = buildArchipelagoAtollsStructures(spec, cols);
      break;
    case 'caravan-ziggurat':
      built = buildCaravanZigguratStructures(spec, cols);
      break;
    case 'aurora-observatory':
      built = buildAuroraObservatoryStructures(spec, cols);
      break;
    case 'monolith-sanctuary':
      built = buildMonolithSanctuaryStructures(spec, cols);
      break;
    case 'cliffside-bastion':
      built = buildCliffsideBastionStructures(spec, cols);
      break;
    default:
      built = buildCitadelCausewayStructures(spec, cols);
      break;
  }

  // Always add sculpted Dungeon Vault Gateways for this realm's entrances
  for (const ent of spec.dungeonEntrances) {
    const [dx, dz] = ent.position;
    built.structures.push(
      { id: `vault-gate-w-${ent.dungeonSlug}`, kind: 'box', material: 'stone', x: dx - 3.0, yOffset: 3.2, z: dz, sx: 1.9, sy: 6.8, sz: 2.8, collider: 'box' },
      { id: `vault-gate-e-${ent.dungeonSlug}`, kind: 'box', material: 'stone', x: dx + 3.0, yOffset: 3.2, z: dz, sx: 1.9, sy: 6.8, sz: 2.8, collider: 'box' },
      { id: `vault-gate-lintel-${ent.dungeonSlug}`, kind: 'box', material: 'stone', x: dx, yOffset: 6.9, z: dz, sx: 8.6, sy: 2.0, sz: 3.2, collider: 'none' },
      { id: `vault-gate-back-${ent.dungeonSlug}`, kind: 'box', material: 'stone', x: dx, yOffset: 3.2, z: dz - 1.6, sx: 5.6, sy: 6.4, sz: 1.4, collider: 'box' },
      { id: `vault-gate-rune-${ent.dungeonSlug}`, kind: 'cone', material: 'accent', x: dx, yOffset: 7.9, z: dz, sx: 1.05, sy: 2.2, sz: 0, segs: 4, rgb: cols.lantern, collider: 'none' },
    );
  }

  const floraInstances = synthesizeEcologicalFlora(spec, floraKit, built.structures);

  const plan: SynthesizedEcosystemPlan = {
    realmSlug: spec.slug,
    theme: spec.theme,
    layoutId,
    layoutTitle: LAYOUT_TITLES[layoutId],
    floraKit,
    floraTitle: FLORA_TITLES[floraKit],
    faunaKit,
    faunaTitle: FAUNA_TITLES[faunaKit],
    phenomenon,
    plazaZones: built.plazas,
    structures: built.structures,
    floraInstances,
    thermalVents: built.vents,
    catalogExtensionIds: [
      `verdant:layout:${layoutId}`,
      `verdant:flora:${floraKit}`,
      `verdant:fauna:${faunaKit}`,
      ...VERDANT_CATALOG_EXTENSIONS
        .filter((e) => e.category === 'prop-kit' && e.themeAffinity.includes(spec.theme))
        .map((e) => e.id),
    ],
  };

  PLAN_CACHE.set(cacheKey, plan);
  return plan;
}
