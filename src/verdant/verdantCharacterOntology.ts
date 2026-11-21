/**
 * Verdant Unified Character Ontology for Frontiers & Foundations.
 *
 * Formally answers and models:
 *  1. Universal Character Invariants vs. Bespoke Differentiation
 *  2. 6 Original Species & 12 Cultural Ethnicities / Homelands across the Six Federated Frontiers
 *  3. Guiding Directives & Worldviews shaping every NPC and Player Character
 *  4. 6 Character Classes with 5 Core Attributes, Derived Stats & 4-Tier Evolution Progression
 *  5. Inventory-to-Character Affinity Engine (Gear & Relics scaling with Class & Attributes)
 *  6. Bespoke NPC Interaction Synthesizer (Lineage, Class, Worldview & Stat-reactive dialogue)
 *  7. High-Definition Painterly SVG Portrait Synthesizer matching the live 3D rig 1:1
 */

import type { DialogueChoice, GameNpc, GearSlotId } from '../game/worldData';
import type {
  ComputedCombatStats,
  EquippedRelic,
  GearUpgradeTiers,
} from '../game/multiplayerTypes';
import { computeCombatStats } from '../game/multiplayerTypes';
import type { RealmThemeId } from './realmModelSchema';
import type {
  CharacterAnatomicalTraits,
  CharacterAttributeKey,
  CharacterAttributes,
  CharacterBeardStyle,
  CharacterClassId,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterSatchelStyle,
  CharacterSpeciesId,
  GuidingDirectiveId,
  PlayerCharacterProfile,
  VerdantCharacterAppearance,
} from './verdantCharacterTypes';

// ── 1. UNIVERSAL CHARACTER INVARIANTS ───────────────────────────────────────

export interface CharacterUniversalInvariant {
  id: string;
  label: string;
  description: string;
  differentiationAxis: string;
}

export const CHARACTER_UNIVERSAL_INVARIANTS: readonly CharacterUniversalInvariant[] = [
  {
    id: 'inv-prism-identity',
    label: 'Prism-Sealed Identity',
    description:
      'Every Waywright and denizen carries a unique name, deterministic UOR genome seed, and cryptographic Prism custody record.',
    differentiationAxis: 'Name, Title, Voice Cadence & Genome Seed',
  },
  {
    id: 'inv-origin-lineage',
    label: 'Origin & Ancestral Lineage',
    description:
      'Every character emerges from one of the Six Federated Frontiers, shaped by their Species biology and Ethnicity homeland craft.',
    differentiationAxis: 'Species Morphology, Homeland Culture & Ecological Adaptation',
  },
  {
    id: 'inv-worldview-directive',
    label: 'Worldview & Guiding Directive',
    description:
      'Every character holds a lived philosophy and an active Guiding Directive that dictates how they interpret the failing Meridian Arch.',
    differentiationAxis: 'Guiding Directive, Harmonic Stance & Concealed Convictions',
  },
  {
    id: 'inv-class-vocation',
    label: 'Class Archetype & Progression Path',
    description:
      'Every character belongs to a martial, alchemical, acoustic, or surveying Class with a 4-tier Evolution Path from Initiate to Sovereign.',
    differentiationAxis: 'Class Specialization, Preferred Instruments & Evolution Rank',
  },
  {
    id: 'inv-core-attributes',
    label: 'Five Universal Core Attributes',
    description:
      'Vigor, Resonance, Wayfinding, Insight, and Conviction universally govern vitality, strike force, healing, traversal speed, and dialogue mastery.',
    differentiationAxis: 'Species Modifiers, Class Base Distribution & Player Allocations',
  },
  {
    id: 'inv-embodied-form',
    label: 'High-Definition Embodied Rig & Portrait',
    description:
      'Every character renders with articulated 3D anatomy, species-specific morphology, multi-layered attire, and a 1:1 painterly portrait.',
    differentiationAxis: 'Build, Garment Cut, Hair/Beard, Palette, Species Crests & Mastery Trim',
  },
  {
    id: 'inv-relational-agency',
    label: 'Inventory Affinity & Social Resonance',
    description:
      'Equipment and relics resonate directly with a character’s Class and Attributes, while NPCs dynamically respond to lineage, class, and directive.',
    differentiationAxis: 'Class-Attuned Gear Synergy, Disposition & Bespoke Dialogue Choices',
  },
];

export const CHARACTER_ATTRIBUTE_META: Record<
  CharacterAttributeKey,
  {
    key: CharacterAttributeKey;
    label: string;
    short: string;
    summary: string;
    gameplayEffect: string;
  }
> = {
  vigor: {
    key: 'vigor',
    label: 'Vigor',
    short: 'VIG',
    summary: 'Physical endurance, load-bearing strength, and poise under seismic impact.',
    gameplayEffect: '+8 Max Vitality, +2% Strike Power, +1.5% Damage Ward per point',
  },
  resonance: {
    key: 'resonance',
    label: 'Resonance',
    short: 'RES',
    summary: 'Harmonic sensitivity to Meridian piers, foundry bells, and restorative mortar.',
    gameplayEffect: '+4 Lantern Mend, +0.2m Bell Shockwave, +2.5% Strike Power per point',
  },
  wayfinding: {
    key: 'wayfinding',
    label: 'Wayfinding',
    short: 'WAY',
    summary: 'Footwork precision, cliff-terrace agility, and fluid dodge recovery.',
    gameplayEffect: '+2% Stride Speed, +5% Stamina Recovery, -2% Dodge Stamina Cost per point',
  },
  insight: {
    key: 'insight',
    label: 'Insight',
    short: 'INS',
    summary: 'Structural reading of ancient stone, ecological lore, and tactical weak points.',
    gameplayEffect: '+2.5% Critical/Strike Precision, unlocks structural & lore dialogue checks',
  },
  conviction: {
    key: 'conviction',
    label: 'Conviction',
    short: 'CON',
    summary: 'Steadfast leadership, guild authority, and harmonic clarity in crisis.',
    gameplayEffect: '+3 Max Vitality, +2 Lantern Mend, unlocks oath & diplomacy dialogue checks',
  },
};

// ── 2. SIX SPECIES & TWELVE CULTURAL ETHNICITIES / HOMELANDS ────────────────

export interface CulturalEthnicitySpec {
  id: string;
  speciesId: CharacterSpeciesId;
  name: string;
  homeland: string;
  realmTheme: RealmThemeId;
  originSummary: string;
  culturalEthos: string;
  signatureCraft: string;
  attributeBonus: Partial<CharacterAttributes>;
  defaultGarmentPrimaryHex: string;
  defaultGarmentSecondaryHex: string;
  defaultTrimHex: string;
  skinSwatches: string[];
  hairSwatches: string[];
  eyeSwatches: string[];
}

export interface CharacterSpeciesSpec {
  id: CharacterSpeciesId;
  name: string;
  pluralName: string;
  ancestralRegion: string;
  realmTheme: RealmThemeId;
  originNarrative: string;
  worldviewLens: string;
  innateTraitName: string;
  innateTraitDescription: string;
  attributeBonuses: Partial<CharacterAttributes>;
  anatomicalDefaults: Omit<CharacterAnatomicalTraits, 'evolutionRank'>;
  defaultBuildPreset: PlayerCharacterProfile['buildPreset'];
  skinPalette: string[];
  hairPalette: string[];
  eyePalette: string[];
  ethnicities: CulturalEthnicitySpec[];
}

export const CHARACTER_SPECIES: readonly CharacterSpeciesSpec[] = [
  {
    id: 'meridian-human',
    name: 'Meridian Human',
    pluralName: 'Meridian Folk',
    ancestralRegion: 'Highland Citadel of Vaelmor & Coastal Causeways',
    realmTheme: 'citadel-highlands',
    originNarrative:
      'Born atop the basalt keystone terraces of the First Span, Meridian Humans are the original charter-architects who bridged the six distant frontiers through harmonic masonry.',
    worldviewLens:
      'They see civilization as a deliberate pact written in load-bearing stone—enduring only when every generation inspects, mends, and renews what the builders before them raised.',
    innateTraitName: 'Charter Adaptability',
    innateTraitDescription: '+1 Vigor, +1 Wayfinding, +1 Conviction — balanced mastery across every guild discipline.',
    attributeBonuses: { vigor: 1, wayfinding: 1, conviction: 1 },
    anatomicalDefaults: {
      earShape: 'human',
      browCrest: 'none',
      shoulderCrest: 'none',
      markingRgb: [0.83, 0.64, 0.33],
      hasLuminousVeins: false,
    },
    defaultBuildPreset: 'balanced',
    skinPalette: ['#e0b592', '#c7936e', '#9e6b4a', '#6d442d', '#ecc8ab'],
    hairPalette: ['#241d18', '#4f3524', '#8d5b34', '#c9a66b', '#7b8088'],
    eyePalette: ['#4a6b7d', '#5c4632', '#3f6e58', '#8c6e3d', '#3b4d63'],
    ethnicities: [
      {
        id: 'vaelmor-basalt',
        speciesId: 'meridian-human',
        name: 'Vaelmor Basalt-Born',
        homeland: 'Citadel Highlands of Vaelmor',
        realmTheme: 'citadel-highlands',
        originSummary:
          'Raised beneath the bronze bell-towers and terraced arches of Vaelmor, taught to judge stone health by the pitch of a struck hammer.',
        culturalEthos: 'Stewardship is measured in weight borne quietly and promises kept in stone.',
        signatureCraft: 'Keystone Surveying & Resonance Bell Casting',
        attributeBonus: { conviction: 1 },
        defaultGarmentPrimaryHex: '#28454e',
        defaultGarmentSecondaryHex: '#4f3a2a',
        defaultTrimHex: '#d4a253',
        skinSwatches: ['#d6a682', '#b8825e', '#8c5c3e', '#633e28'],
        hairSwatches: ['#251e19', '#4a3122', '#7a5233', '#999da3'],
        eyeSwatches: ['#4a6b7d', '#6e5235', '#3e6e58'],
      },
      {
        id: 'salt-loom-mariner',
        speciesId: 'meridian-human',
        name: 'Salt-Loom Mariners',
        homeland: 'Southern Causeway & Tidal Ports',
        realmTheme: 'pelagic-spires',
        originSummary:
          'Descended from open-water navigators who charted the sea-gates connecting Vaelmor to the outer archipelagos using brass astrolabes and tide-charts.',
        culturalEthos: 'No anchor outlasts the current; survival belongs to those who read the horizon early.',
        signatureCraft: 'Compass Navigation & Gale-Rigging',
        attributeBonus: { wayfinding: 1 },
        defaultGarmentPrimaryHex: '#213c54',
        defaultGarmentSecondaryHex: '#614a35',
        defaultTrimHex: '#c9a25e',
        skinSwatches: ['#c9926c', '#a8714e', '#7d4f33', '#deb28e'],
        hairSwatches: ['#1d1a18', '#3c2b21', '#754e2e', '#b99c6d'],
        eyeSwatches: ['#357082', '#4c5e4b', '#5e442c'],
      },
    ],
  },
  {
    id: 'lithborn',
    name: 'Lithborn',
    pluralName: 'Lithborn',
    ancestralRegion: 'Kar-Veth Monoliths & Deep Kiln Strata',
    realmTheme: 'amber-steppe',
    originNarrative:
      'Forged where living veins of resonant quartz and amber sandstone crossed ancient Meridian ley-seams, the Lithborn possess mineral-faceted brow ridges and warm crystalline inlays along their shoulders.',
    worldviewLens:
      'They experience time in geological strata rather than hurried seasons—revering patience, structural honesty, and promises etched deep enough to survive earthquakes.',
    innateTraitName: 'Bedrock Poise',
    innateTraitDescription: '+2 Vigor, +1 Resonance — mineral-laced stature grants superior resilience and seismic resonance.',
    attributeBonuses: { vigor: 2, resonance: 1 },
    anatomicalDefaults: {
      earShape: 'faceted-stone',
      browCrest: 'mineral-ridge',
      shoulderCrest: 'quartz-pauldrons',
      markingRgb: [0.92, 0.68, 0.28],
      hasLuminousVeins: true,
    },
    defaultBuildPreset: 'stalwart',
    skinPalette: ['#968577', '#7b6f66', '#b09a82', '#645c58', '#8a7664'],
    hairPalette: ['#3b342f', '#6b5a49', '#b88f52', '#262322', '#9c8c7b'],
    eyePalette: ['#e6a844', '#c97b32', '#70c4a8', '#e3c474'],
    ethnicities: [
      {
        id: 'monolith-keepers',
        speciesId: 'lithborn',
        name: 'Monolith Keepers of Kar-Veth',
        homeland: 'Amber Steppe of Kar-Veth',
        realmTheme: 'amber-steppe',
        originSummary:
          'Custodians of wind-carved sandstone obelisks that sing across the golden plains whenever a frontier pier shifts its harmonic pitch.',
        culturalEthos: 'Listen to the earth before lifting a chisel; stone remembers every false strike.',
        signatureCraft: 'Acoustic Masonry & Sun-Dial Cartography',
        attributeBonus: { insight: 1 },
        defaultGarmentPrimaryHex: '#6b4c32',
        defaultGarmentSecondaryHex: '#3c322b',
        defaultTrimHex: '#e6b252',
        skinSwatches: ['#a8927c', '#8c7864', '#706052'],
        hairSwatches: ['#3d3126', '#9e7c4c', '#574a3e'],
        eyeSwatches: ['#eba944', '#d97b36', '#7bc4a4'],
      },
      {
        id: 'kiln-strata-forgers',
        speciesId: 'lithborn',
        name: 'Kiln-Strata Forgers',
        homeland: 'Ashen Kiln Foundry Tiers',
        realmTheme: 'obsidian-crucible',
        originSummary:
          'Deep-terrace metallurgists whose amber-quartz shoulder facets glow softly when tempering resonance bronze beside the great kilns.',
        culturalEthos: 'Pressure does not ruin good alloy—it reveals what is worthy to bear the arch.',
        signatureCraft: 'Bell-Hammer Forging & Slag Refining',
        attributeBonus: { vigor: 1 },
        defaultGarmentPrimaryHex: '#4a2b22',
        defaultGarmentSecondaryHex: '#2f2928',
        defaultTrimHex: '#e89648',
        skinSwatches: ['#736761', '#5c5350', '#8a776b'],
        hairSwatches: ['#252120', '#5e4332', '#9e6e44'],
        eyeSwatches: ['#f28c38', '#e6b850', '#d45a36'],
      },
    ],
  },
  {
    id: 'sylvan-rootkin',
    name: 'Sylvan Rootkin',
    pluralName: 'Rootkin',
    ancestralRegion: 'Sunken Aqueducts of Oakhaven',
    realmTheme: 'sunken-aqueducts',
    originNarrative:
      'Born in symbiotic kinship with the silicate-moss aqueducts of Oakhaven, Sylvan Rootkin bear tapered botanical ears, emerald-veined temples, and woven living-vine brow circlets.',
    worldviewLens:
      'They believe no foundation survives by rigidity alone; living roots flex, heal cracked masonry, and bind disparate worlds into one breathing canopy.',
    innateTraitName: 'Mycelial Symbiosis',
    innateTraitDescription: '+2 Resonance, +1 Insight — deep botanical attunement amplifies restoration and ecological clarity.',
    attributeBonuses: { resonance: 2, insight: 1 },
    anatomicalDefaults: {
      earShape: 'tapered-leaf',
      browCrest: 'vine-circlet',
      shoulderCrest: 'living-mantle',
      markingRgb: [0.36, 0.88, 0.62],
      hasLuminousVeins: true,
    },
    defaultBuildPreset: 'lithe',
    skinPalette: ['#879c7e', '#6f856b', '#a8b093', '#7d745a', '#96a68c'],
    hairPalette: ['#2c4a38', '#4f6e42', '#7d5b34', '#a6b87c', '#26332c'],
    eyePalette: ['#5ee6a0', '#d4b855', '#42b89a', '#8ce06c'],
    ethnicities: [
      {
        id: 'oakhaven-canopy-weavers',
        speciesId: 'sylvan-rootkin',
        name: 'Oakhaven Canopy-Weavers',
        homeland: 'Sunken Aqueducts of Oakhaven',
        realmTheme: 'sunken-aqueducts',
        originSummary:
          'Heirs to the drowned arches of Oakhaven who weave living willow-cables and luminous moss poultices to knit fractured stone back together.',
        culturalEthos: 'What grows together endures storms that shatter lone pillars.',
        signatureCraft: 'Mortar Alchemy & Living Arch-Weaving',
        attributeBonus: { resonance: 1 },
        defaultGarmentPrimaryHex: '#254a3b',
        defaultGarmentSecondaryHex: '#4f422c',
        defaultTrimHex: '#6dd49c',
        skinSwatches: ['#8ba182', '#738a6e', '#a5b092'],
        hairSwatches: ['#2a4a36', '#547344', '#856036'],
        eyeSwatches: ['#5ce69d', '#d9bd58', '#45ba9b'],
      },
      {
        id: 'silicate-moss-walkers',
        speciesId: 'sylvan-rootkin',
        name: 'Silicate Moss-Walkers',
        homeland: 'Misty Cisterns & Mycelial Under-Vaults',
        realmTheme: 'sunken-aqueducts',
        originSummary:
          'Quiet subterranean botanists who follow bioluminescent spore-trails beneath Vaelmor to map hairline fractures before they reach the surface.',
        culturalEthos: 'The quietest root in the dark tells the truest story of the mountain above.',
        signatureCraft: 'Spore Cartography & Bioluminescent Tinctures',
        attributeBonus: { insight: 1 },
        defaultGarmentPrimaryHex: '#1f3d42',
        defaultGarmentSecondaryHex: '#334a39',
        defaultTrimHex: '#59d9b4',
        skinSwatches: ['#70877a', '#88998c', '#5d7368'],
        hairSwatches: ['#1f3834', '#4a6b58', '#98b89b'],
        eyeSwatches: ['#48e0c2', '#7be884', '#d4c96e'],
      },
    ],
  },
  {
    id: 'pelagis',
    name: 'Pelagis',
    pluralName: 'Pelagis',
    ancestralRegion: 'Glasswater Spires & Abyssal Tides',
    realmTheme: 'pelagic-spires',
    originNarrative:
      'Tide-born voyagers of the Glasswater archipelago, the Pelagis are distinguished by swept sea-glass ear-fins, iridescent salt-sheen skin, and faint bioluminescent temple markings.',
    worldviewLens:
      'They understand the world as interlocking currents and harmonic eddies—valuing fluid movement, mutual vigilance, and freedom of passage across every border.',
    innateTraitName: 'Current-Stride Grace',
    innateTraitDescription: '+2 Wayfinding, +1 Resonance — aquatic agility accelerates stride, dodge economy, and tidal clarity.',
    attributeBonuses: { wayfinding: 2, resonance: 1 },
    anatomicalDefaults: {
      earShape: 'fin-crest',
      browCrest: 'tidal-markings',
      shoulderCrest: 'sea-glass-fins',
      markingRgb: [0.32, 0.86, 0.96],
      hasLuminousVeins: true,
    },
    defaultBuildPreset: 'lithe',
    skinPalette: ['#6d95a6', '#537b8f', '#89abb8', '#46687d', '#7da19c'],
    hairPalette: ['#182d3d', '#29576e', '#68b0c4', '#b8dce6', '#1e3d3a'],
    eyePalette: ['#52e6f5', '#f2cf66', '#72f0c8', '#a8ebff'],
    ethnicities: [
      {
        id: 'glasswater-spire-divers',
        speciesId: 'pelagis',
        name: 'Glasswater Spire-Divers',
        homeland: 'Pelagic Spires of Glasswater',
        realmTheme: 'pelagic-spires',
        originSummary:
          'Fearless reef-climbers and current-divers who maintain the submerged sea-piers where Meridian resonance travels fastest through salt water.',
        culturalEthos: 'Yield to the wave’s timing and it will carry you farther than brute muscle ever could.',
        signatureCraft: 'Tidal Harpoonery & Sea-Glass Optics',
        attributeBonus: { wayfinding: 1 },
        defaultGarmentPrimaryHex: '#1d4961',
        defaultGarmentSecondaryHex: '#2e6163',
        defaultTrimHex: '#61dcf0',
        skinSwatches: ['#6b95a6', '#86aab8', '#52798c'],
        hairSwatches: ['#183040', '#316a82', '#79c2d4'],
        eyeSwatches: ['#52e6f5', '#f0cf6b', '#75f0c8'],
      },
      {
        id: 'abyssal-current-singers',
        speciesId: 'pelagis',
        name: 'Abyssal Current-Singers',
        homeland: 'Deep Trench Choirs & Outer Atolls',
        realmTheme: 'pelagic-spires',
        originSummary:
          'Acoustic navigators who echo-sound deep vaults by voice and bronze chime, translating distant tremors into clear warnings for every frontier.',
        culturalEthos: 'Distance is an illusion when the water carries every voice intact.',
        signatureCraft: 'Hydro-Acoustic Divination & Ward-Weaving',
        attributeBonus: { conviction: 1 },
        defaultGarmentPrimaryHex: '#1b314f',
        defaultGarmentSecondaryHex: '#353e5c',
        defaultTrimHex: '#7ccbf5',
        skinSwatches: ['#4a6b80', '#618296', '#3d586e'],
        hairSwatches: ['#142133', '#2c4c6b', '#a9d5e8'],
        eyeSwatches: ['#7de8ff', '#9bf0d8', '#ffd978'],
      },
    ],
  },
  {
    id: 'cinderkin',
    name: 'Cinderkin',
    pluralName: 'Cinderkin',
    ancestralRegion: 'Obsidian Crucible of Ignis',
    realmTheme: 'obsidian-crucible',
    originNarrative:
      'Tempered beside the geothermal vents of the Obsidian Crucible, Cinderkin carry obsidian-warm complexions traced by faint glowing ember-veins and hammered brass gorget crests.',
    worldviewLens:
      'They see every crisis as a crucible that strips away pretense—honoring decisive action, fierce craftsmanship, and the courage to remake what can no longer hold.',
    innateTraitName: 'Crucible Temper',
    innateTraitDescription: '+2 Vigor, +1 Conviction — forge-born grit amplifies strike power and unyielding presence.',
    attributeBonuses: { vigor: 2, conviction: 1 },
    anatomicalDefaults: {
      earShape: 'human',
      browCrest: 'ember-sigil',
      shoulderCrest: 'crucible-gorget',
      markingRgb: [0.98, 0.44, 0.14],
      hasLuminousVeins: true,
    },
    defaultBuildPreset: 'stalwart',
    skinPalette: ['#523c36', '#3e2d2a', '#6e4d41', '#2e2423', '#7d5849'],
    hairPalette: ['#1c1818', '#5e2b1d', '#b84b23', '#e0863a', '#4a4340'],
    eyePalette: ['#ff7a2e', '#f5b841', '#ff5436', '#ffd269'],
    ethnicities: [
      {
        id: 'caldera-bell-casters',
        speciesId: 'cinderkin',
        name: 'Caldera Bell-Casters',
        homeland: 'Obsidian Crucible Foundry',
        realmTheme: 'obsidian-crucible',
        originSummary:
          'Master founders who pour volcanic bronze into the monumental resonance bells that anchor the entire Six-Frontier acoustic lattice.',
        culturalEthos: 'A true bell only rings pure after surviving the hottest pour.',
        signatureCraft: 'Geothermal Metallurgy & Harmonic Bronze',
        attributeBonus: { vigor: 1 },
        defaultGarmentPrimaryHex: '#59251c',
        defaultGarmentSecondaryHex: '#2b2423',
        defaultTrimHex: '#f29544',
        skinSwatches: ['#4a3631', '#382926', '#66473c'],
        hairSwatches: ['#1a1616', '#6b2f1e', '#cc5625'],
        eyeSwatches: ['#ff782b', '#f5b942', '#ff4f33'],
      },
      {
        id: 'ash-steppe-outriders',
        speciesId: 'cinderkin',
        name: 'Ash-Steppe Outriders',
        homeland: 'Basalt Rim & Cinder Passes',
        realmTheme: 'obsidian-crucible',
        originSummary:
          'Swift scouts who patrol the volcanic ridgelines between Ignis and Kar-Veth, breaking colossus vanguard patrols before they reach trade arches.',
        culturalEthos: 'Strike first to shield the road, and never leave a comrade behind the ash-line.',
        signatureCraft: 'Ember-Edged Hookblades & Ridge Reconnaissance',
        attributeBonus: { wayfinding: 1 },
        defaultGarmentPrimaryHex: '#3d2a26',
        defaultGarmentSecondaryHex: '#693a24',
        defaultTrimHex: '#e6a84c',
        skinSwatches: ['#63473c', '#4d3730', '#7a5648'],
        hairSwatches: ['#241e1d', '#8c3c20', '#d67e38'],
        eyeSwatches: ['#ff8a36', '#ffc954', '#e85d38'],
      },
    ],
  },
  {
    id: 'glacian',
    name: 'Glacian',
    pluralName: 'Glacians',
    ancestralRegion: 'Glacial Spire of Borealis',
    realmTheme: 'glacial-spire',
    originNarrative:
      'Born beneath the shimmering aurora prisms of Borealis, Glacians carry frost-pale luminescence, crystalline prism brow circlets, and poised scholarly bearing.',
    worldviewLens:
      'They treat truth as clear crystal—free of panic or superstition—believing exact observation and harmonic geometry can mend even a shattering world.',
    innateTraitName: 'Aurora Clarity',
    innateTraitDescription: '+2 Insight, +1 Resonance — crystalline perception sharpens analysis, precision, and harmonic control.',
    attributeBonuses: { insight: 2, resonance: 1 },
    anatomicalDefaults: {
      earShape: 'tapered-leaf',
      browCrest: 'frost-diadem',
      shoulderCrest: 'aurora-halo',
      markingRgb: [0.54, 0.88, 1.0],
      hasLuminousVeins: true,
    },
    defaultBuildPreset: 'towering',
    skinPalette: ['#c9dbe6', '#aec6d6', '#dce8f0', '#96b1c4', '#bfd0de'],
    hairPalette: ['#e6f2fa', '#a5c6db', '#4a6985', '#2a3d52', '#c8b8e0'],
    eyePalette: ['#78dcff', '#a8b8ff', '#5ee8d4', '#e0f5ff'],
    ethnicities: [
      {
        id: 'frostglass-astromancers',
        speciesId: 'glacian',
        name: 'Frostglass Astromancers',
        homeland: 'Observatory Spires of Borealis',
        realmTheme: 'glacial-spire',
        originSummary:
          'Star-charting geometers who align frost-crystal mirrors with the upper aurora to track harmonic drift across every universe cell.',
        culturalEthos: 'Measure cleanly, speak plainly, and let reason illuminate what fear obscures.',
        signatureCraft: 'Prism Optics & Celestial Meridian Alignment',
        attributeBonus: { insight: 1 },
        defaultGarmentPrimaryHex: '#253954',
        defaultGarmentSecondaryHex: '#3f5975',
        defaultTrimHex: '#94e2ff',
        skinSwatches: ['#cde0eb', '#b4cbd9', '#dfe9f0'],
        hairSwatches: ['#e8f4fc', '#9ec2d9', '#4a6b8a'],
        eyeSwatches: ['#78dcff', '#a6b8ff', '#61ebd6'],
      },
      {
        id: 'rime-watch-sentinels',
        speciesId: 'glacian',
        name: 'Rime-Watch Sentinels',
        homeland: 'Northern Glacier Ramparts',
        realmTheme: 'glacial-spire',
        originSummary:
          'Disciplined wardens who guard the frozen causeways of the far north, meeting relentless colossus sieges with calm, unbroken formation.',
        culturalEthos: 'Stillness is not hesitation—it is readiness honed to a razor edge.',
        signatureCraft: 'Glacial Ward-Plate & Frost-Tempered Resonance',
        attributeBonus: { conviction: 1 },
        defaultGarmentPrimaryHex: '#1f2d42',
        defaultGarmentSecondaryHex: '#4b6078',
        defaultTrimHex: '#b3e8ff',
        skinSwatches: ['#b6ccd9', '#9cb6c7', '#cee0eb'],
        hairSwatches: ['#d9ebf7', '#5f7d99', '#2b3e52'],
        eyeSwatches: ['#63d2ff', '#d4f2ff', '#7ce8d0'],
      },
    ],
  },
];

// ── 3. GUIDING DIRECTIVES & WORLDVIEWS ──────────────────────────────────────

export interface GuidingDirectiveSpec {
  id: GuidingDirectiveId;
  name: string;
  worldviewAxis: string;
  creed: string;
  crisisStance: string;
  /** Directives that harmonize naturally (+affinity in dialogue) */
  alliedDirectives: GuidingDirectiveId[];
  /** Directives that create dramatic philosophical friction (unique debate dialogue) */
  contrastingDirectives: GuidingDirectiveId[];
  attributeAffinity: CharacterAttributeKey;
  passiveLabel: string;
}

export const WORLDVIEW_DIRECTIVES: readonly GuidingDirectiveSpec[] = [
  {
    id: 'preserve-arch',
    name: 'Preservation of the Arch',
    worldviewAxis: 'Architectural Continuity',
    creed: 'What our forebears raised in sweat and song must not fall on our watch.',
    crisisStance: 'Stabilize Vaelmor’s Third Pier first; without the keystone, all six frontiers drift apart.',
    alliedDirectives: ['forge-of-merit', 'fellowship-charter'],
    contrastingDirectives: ['boundless-horizon'],
    attributeAffinity: 'vigor',
    passiveLabel: '+5% Damage Mitigation when guarding anchors & piers',
  },
  {
    id: 'boundless-horizon',
    name: 'Boundless Horizon',
    worldviewAxis: 'Frontier Discovery',
    creed: 'Every map ends only where courage stops; the cure for old decay waits beyond the gate.',
    crisisStance: 'Chart new universe cells and outer realms to gather fresh relics and forgotten harmonic craft.',
    alliedDirectives: ['harmonic-truth', 'living-equilibrium'],
    contrastingDirectives: ['preserve-arch'],
    attributeAffinity: 'wayfinding',
    passiveLabel: '+4% Stride Speed across frontier causeways & delves',
  },
  {
    id: 'living-equilibrium',
    name: 'Living Equilibrium',
    worldviewAxis: 'Ecological Symbiosis',
    creed: 'Stone and root, tide and kiln—every frontier thrives only when its living balance is heard.',
    crisisStance: 'Heal the Meridian with silicate-moss alchemy rather than forcing brittle stone by brute force.',
    alliedDirectives: ['fellowship-charter', 'boundless-horizon'],
    contrastingDirectives: ['forge-of-merit'],
    attributeAffinity: 'resonance',
    passiveLabel: '+6 Mortar Lantern Mend potency',
  },
  {
    id: 'forge-of-merit',
    name: 'Forge of Merit',
    worldviewAxis: 'Mastery & Craft',
    creed: 'Titles mean nothing; only tempered bronze, tested resolve, and proven deeds hold weight.',
    crisisStance: 'Temper superior instruments, topple rogue Colossi, and re-cast the failing lattice stronger.',
    alliedDirectives: ['preserve-arch', 'harmonic-truth'],
    contrastingDirectives: ['living-equilibrium'],
    attributeAffinity: 'vigor',
    passiveLabel: '+5% Hookblade & Bell-Hammer Strike Power',
  },
  {
    id: 'fellowship-charter',
    name: 'Fellowship Charter',
    worldviewAxis: 'Collective Stewardship',
    creed: 'No lone Waywright holds six horizons; our strength is the chorus of guilds standing together.',
    crisisStance: 'Unite the Stonebinders, Rootwards, and Foundrywrights and rally fellow explorers in shared cause.',
    alliedDirectives: ['preserve-arch', 'living-equilibrium'],
    contrastingDirectives: ['harmonic-truth'],
    attributeAffinity: 'conviction',
    passiveLabel: '+8 Max Vitality & enhanced fellowship resonance',
  },
  {
    id: 'harmonic-truth',
    name: 'Harmonic Truth',
    worldviewAxis: 'Empirical Clarity',
    creed: 'Unseen cracks destroy kingdoms; measure every tremor until the hidden law stands plain.',
    crisisStance: 'Uncover why the Third Pier slipped out of phase so the catastrophe can never recur.',
    alliedDirectives: ['boundless-horizon', 'forge-of-merit'],
    contrastingDirectives: ['fellowship-charter'],
    attributeAffinity: 'insight',
    passiveLabel: '+6% Stamina Recovery & structural dialogue insight',
  },
];

// ── 4. SIX CHARACTER CLASSES, CORE STATS & 4-TIER EVOLUTION ─────────────────

export interface CharacterClassEvolutionTier {
  rank: 1 | 2 | 3 | 4;
  minLevel: number;
  title: string;
  unlockDescription: string;
}

export interface CharacterClassSpec {
  id: CharacterClassId;
  name: string;
  archetypeRole: string;
  guildTradition: string;
  summary: string;
  primaryAttribute: CharacterAttributeKey;
  secondaryAttribute: CharacterAttributeKey;
  baseAttributes: CharacterAttributes;
  preferredGear: GearSlotId[];
  preferredRelicBonus: EquippedRelic['bonusKind'][];
  startingGarment: CharacterGarmentStyle;
  startingSatchel: CharacterSatchelStyle;
  claspKind: VerdantCharacterAppearance['claspKind'];
  signatureItemName: string;
  signatureItemDescription: string;
  evolutionPath: readonly CharacterClassEvolutionTier[];
}

export const CHARACTER_CLASSES: readonly CharacterClassSpec[] = [
  {
    id: 'meridian-surveyor',
    name: 'Meridian Surveyor',
    archetypeRole: 'Agile Skirmisher & Pathfinder',
    guildTradition: 'Charter of the First Span',
    summary:
      'Versatile frontier scouts who pair quick Hookblade parries with Meridian Compass precision to outmaneuver stalkers and chart distant cells.',
    primaryAttribute: 'wayfinding',
    secondaryAttribute: 'insight',
    baseAttributes: { vigor: 6, resonance: 6, wayfinding: 9, insight: 8, conviction: 6 },
    preferredGear: ['hookblade', 'compass'],
    preferredRelicBonus: ['speedPct', 'staminaRegenPct'],
    startingGarment: 'waywright-longcoat',
    startingSatchel: 'chart-satchel',
    claspKind: 'bronze-crest',
    signatureItemName: 'Astrolabe Hookblade',
    signatureItemDescription: 'Balanced bronze-edged blade with an inset compass bearing for swift lunges.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Chartered Scout', unlockDescription: 'Standard Waywright survey kit & balanced field poise.' },
      { rank: 2, minLevel: 4, title: 'Meridian Pathfinder', unlockDescription: 'Enhanced Hookblade & Compass class synergy (+15%).' },
      { rank: 3, minLevel: 8, title: 'Horizon Cartographer', unlockDescription: 'Unlocks golden shoulder trim & heightened stamina recovery.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Waywright', unlockDescription: 'Radiant meridian mantle & supreme frontier velocity.' },
    ],
  },
  {
    id: 'foundry-bellwright',
    name: 'Foundry Bellwright',
    archetypeRole: 'Seismic Bruiser & Acoustic Tank',
    guildTradition: 'Ashen Kiln Foundrywrights',
    summary:
      'Armored acoustic smiths who wield tuned Bell-Hammers to shatter enemy formations with 360-degree resonance shockwaves and re-tune failing piers.',
    primaryAttribute: 'vigor',
    secondaryAttribute: 'resonance',
    baseAttributes: { vigor: 9, resonance: 8, wayfinding: 5, insight: 6, conviction: 7 },
    preferredGear: ['bellhammer', 'hookblade'],
    preferredRelicBonus: ['maxHp', 'damagePct'],
    startingGarment: 'smith-apron',
    startingSatchel: 'smith-belt',
    claspKind: 'copper-buckle',
    signatureItemName: 'Harmonic Foundry Mallet',
    signatureItemDescription: 'Bell-bronze maul tuned to 293 Hz that rings through basalt and enemy armor alike.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Kiln Apprentice', unlockDescription: 'Tempered apron & foundational Bell-Hammer cadence.' },
      { rank: 2, minLevel: 4, title: 'Resonance Bellwright', unlockDescription: 'Expanded seismic shockwave radius & sturdy ward.' },
      { rank: 3, minLevel: 8, title: 'Grand Tunersmith', unlockDescription: 'Hammered bronze shoulder crest & heavy cleave poise.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Bell-Lord', unlockDescription: 'Masterwork sovereign mantle & colossus-breaking impact.' },
    ],
  },
  {
    id: 'rootward-alchemist',
    name: 'Rootward Alchemist',
    archetypeRole: 'Vitality Mender & Ecological Tactician',
    guildTradition: 'Rootward Collective of Oakhaven',
    summary:
      'Botanical stewards who channel silicate moss through their Mortar Lantern to mend allies, sustain prolonged delves, and harmonize resonant relics.',
    primaryAttribute: 'resonance',
    secondaryAttribute: 'insight',
    baseAttributes: { vigor: 6, resonance: 9, wayfinding: 6, insight: 8, conviction: 6 },
    preferredGear: ['lantern', 'compass'],
    preferredRelicBonus: ['healPower', 'maxHp'],
    startingGarment: 'herbalist-coat',
    startingSatchel: 'herb-satchel',
    claspKind: 'leaf-emerald',
    signatureItemName: 'Silicate Mortar Censer',
    signatureItemDescription: 'Luminous emerald-glass lantern dispersing living restorative mortar spores.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Moss-Tincturer', unlockDescription: 'Living silicate lantern & herbal vitality restoration.' },
      { rank: 2, minLevel: 4, title: 'Aqueduct Alchemist', unlockDescription: 'Potent Lantern Mend synergy & restorative relic mastery.' },
      { rank: 3, minLevel: 8, title: 'Canopy Harmonist', unlockDescription: 'Luminous botanical shoulders & resilient poise.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Rootwarden', unlockDescription: 'Radiant living mantle & unyielding vitality aura.' },
    ],
  },
  {
    id: 'tide-loom-sentinel',
    name: 'Tide-Loom Sentinel',
    archetypeRole: 'Evasive Duelist & Counter-Striker',
    guildTradition: 'Glasswater Watch',
    summary:
      'Fluid coastal defenders who weave through telegraphed boss strikes with low-cost dodges and deliver rapid precision counter-cleaves.',
    primaryAttribute: 'wayfinding',
    secondaryAttribute: 'vigor',
    baseAttributes: { vigor: 8, resonance: 5, wayfinding: 9, insight: 6, conviction: 7 },
    preferredGear: ['hookblade', 'lantern'],
    preferredRelicBonus: ['speedPct', 'damagePct'],
    startingGarment: 'oilskin-coat',
    startingSatchel: 'chart-satchel',
    claspKind: 'bronze-crest',
    signatureItemName: 'Tide-Curved Cutlass',
    signatureItemDescription: 'Light salt-tempered hookblade engineered for sweeping parries and rapid recovery.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Reef-Line Watcher', unlockDescription: 'Swift dodge footwork & agile Hookblade cadence.' },
      { rank: 2, minLevel: 4, title: 'Current Sentinel', unlockDescription: 'Reduced dodge stamina burn & boosted cleave tempo.' },
      { rank: 3, minLevel: 8, title: 'Gale-Arch Duelist', unlockDescription: 'Sea-glass shoulder trim & high stride momentum.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Tideblade', unlockDescription: 'Shimmering wave-crest mantle & unmatched evasion.' },
    ],
  },
  {
    id: 'crucible-vanguard',
    name: 'Crucible Vanguard',
    archetypeRole: 'Frontline Champion & Colossus-Breaker',
    guildTradition: 'Stonebinder Bastion',
    summary:
      'Stalwart wardens clad in layered basalt-steel plate who stand firm against Colossus shockwaves and lead fellowship charges into Tier-3 vaults.',
    primaryAttribute: 'vigor',
    secondaryAttribute: 'conviction',
    baseAttributes: { vigor: 9, resonance: 5, wayfinding: 6, insight: 6, conviction: 9 },
    preferredGear: ['bellhammer', 'hookblade'],
    preferredRelicBonus: ['maxHp', 'damagePct'],
    startingGarment: 'ranger-brigandine',
    startingSatchel: 'smith-belt',
    claspKind: 'runic-gold',
    signatureItemName: 'Keystone Bulwark Maul',
    signatureItemDescription: 'Weighted bastion hammer engraved with Stonebinder load-bearing runes.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Bastion Sworn', unlockDescription: 'Heavy sentinel brigandine & high starting vitality.' },
      { rank: 2, minLevel: 4, title: 'Crucible Breaker', unlockDescription: 'Elevated damage mitigation & commanding presence.' },
      { rank: 3, minLevel: 8, title: 'Arch-Warden', unlockDescription: 'Gilded pauldron crest & towering battlefield authority.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Bulwark', unlockDescription: 'Golden bastion mantle & indomitable vitality.' },
    ],
  },
  {
    id: 'frostglass-astromancer',
    name: 'Frostglass Astromancer',
    archetypeRole: 'Harmonic Scholar & Relic Specialist',
    guildTradition: 'Borealis Meridian Conclave',
    summary:
      'Celestial resonance theorists who amplify equipped Survey Relics, decipher concealed NPC motives, and weave rapid harmonic pulses.',
    primaryAttribute: 'insight',
    secondaryAttribute: 'resonance',
    baseAttributes: { vigor: 5, resonance: 9, wayfinding: 6, insight: 9, conviction: 6 },
    preferredGear: ['lantern', 'bellhammer'],
    preferredRelicBonus: ['staminaRegenPct', 'healPower'],
    startingGarment: 'archon-vestments',
    startingSatchel: 'twin-scroll',
    claspKind: 'runic-gold',
    signatureItemName: 'Prism Tuning Scepter',
    signatureItemDescription: 'Faceted borealis glass rod that focuses harmonic energy across relics.',
    evolutionPath: [
      { rank: 1, minLevel: 1, title: 'Prism Reader', unlockDescription: 'High Insight & Resonance for relic and dialogue mastery.' },
      { rank: 2, minLevel: 4, title: 'Meridian Astromancer', unlockDescription: 'Amplified relic synergy & crisp stamina regeneration.' },
      { rank: 3, minLevel: 8, title: 'Aurora Theorist', unlockDescription: 'Crystalline shoulder halo & deeper structural vision.' },
      { rank: 4, minLevel: 12, title: 'Sovereign Savant', unlockDescription: 'Luminous prism mantle & pinnacle harmonic command.' },
    ],
  },
];

// ── LOOKUP HELPERS ──────────────────────────────────────────────────────────

export function getSpeciesSpec(speciesId: CharacterSpeciesId): CharacterSpeciesSpec {
  return CHARACTER_SPECIES.find((s) => s.id === speciesId) ?? CHARACTER_SPECIES[0];
}

export function getEthnicitySpec(
  speciesId: CharacterSpeciesId,
  ethnicityId: string,
): CulturalEthnicitySpec {
  const sp = getSpeciesSpec(speciesId);
  return sp.ethnicities.find((e) => e.id === ethnicityId) ?? sp.ethnicities[0];
}

export function getClassSpec(classId: CharacterClassId): CharacterClassSpec {
  return CHARACTER_CLASSES.find((c) => c.id === classId) ?? CHARACTER_CLASSES[0];
}

export function getDirectiveSpec(directiveId: GuidingDirectiveId): GuidingDirectiveSpec {
  return WORLDVIEW_DIRECTIVES.find((d) => d.id === directiveId) ?? WORLDVIEW_DIRECTIVES[0];
}

export function listAllEthnicities(): CulturalEthnicitySpec[] {
  return CHARACTER_SPECIES.flatMap((s) => s.ethnicities);
}

export function hexToLinearRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '').trim();
  const full = clean.length === 3
    ? clean
        .split('')
        .map((c) => c + c)
        .join('')
    : clean.padEnd(6, '8').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [0.5, 0.5, 0.5];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export function rgbToHex(rgb: [number, number, number]): string {
  const toByte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(rgb[0])}${toByte(rgb[1])}${toByte(rgb[2])}`;
}

export function buildPresetToScale(
  preset: PlayerCharacterProfile['buildPreset'],
): [number, number, number] {
  switch (preset) {
    case 'lithe':
      return [0.98, 0.92, 0.93];
    case 'stalwart':
      return [1.05, 1.14, 1.09];
    case 'towering':
      return [1.11, 1.04, 1.02];
    case 'balanced':
    default:
      return [1.02, 1.02, 1.0];
  }
}

export function createDefaultPlayerProfile(
  name = 'Waywright',
  overrides?: Partial<PlayerCharacterProfile>,
): PlayerCharacterProfile {
  const speciesId: CharacterSpeciesId = overrides?.speciesId ?? 'meridian-human';
  const sp = getSpeciesSpec(speciesId);
  const eth = getEthnicitySpec(speciesId, overrides?.ethnicityId ?? sp.ethnicities[0].id);
  const classId: CharacterClassId = overrides?.classId ?? 'meridian-surveyor';
  const cls = getClassSpec(classId);
  const directiveId: GuidingDirectiveId = overrides?.directiveId ?? 'preserve-arch';

  return {
    name: name.trim() || 'Waywright',
    speciesId,
    ethnicityId: eth.id,
    classId,
    directiveId,
    allocatedAttributes: {
      vigor: 0,
      resonance: 0,
      wayfinding: 0,
      insight: 0,
      conviction: 0,
      ...(overrides?.allocatedAttributes ?? {}),
    },
    garmentStyle: overrides?.garmentStyle ?? cls.startingGarment,
    hairStyle: overrides?.hairStyle ?? 'waywright-swept',
    beardStyle: overrides?.beardStyle ?? 'none',
    satchelStyle: overrides?.satchelStyle ?? cls.startingSatchel,
    hasPauldrons: overrides?.hasPauldrons ?? (classId === 'crucible-vanguard' || classId === 'foundry-bellwright'),
    hasHoodDown: overrides?.hasHoodDown ?? true,
    buildPreset: overrides?.buildPreset ?? sp.defaultBuildPreset,
    skinColorHex: overrides?.skinColorHex ?? eth.skinSwatches[0] ?? sp.skinPalette[0],
    hairColorHex: overrides?.hairColorHex ?? eth.hairSwatches[0] ?? sp.hairPalette[0],
    eyeColorHex: overrides?.eyeColorHex ?? eth.eyeSwatches[0] ?? sp.eyePalette[0],
    garmentPrimaryHex: overrides?.garmentPrimaryHex ?? eth.defaultGarmentPrimaryHex,
    garmentSecondaryHex: overrides?.garmentSecondaryHex ?? eth.defaultGarmentSecondaryHex,
    trimColorHex: overrides?.trimColorHex ?? eth.defaultTrimHex,
    activeTitle: overrides?.activeTitle ?? cls.evolutionPath[0].title,
    updatedAt: overrides?.updatedAt ?? Date.now(),
  };
}

export function normalizePlayerProfile(
  raw: Partial<PlayerCharacterProfile> | undefined | null,
  fallbackName = 'Waywright',
): PlayerCharacterProfile {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPlayerProfile(fallbackName);
  }
  const validSpecies = CHARACTER_SPECIES.some((s) => s.id === raw.speciesId)
    ? (raw.speciesId as CharacterSpeciesId)
    : 'meridian-human';
  const sp = getSpeciesSpec(validSpecies);
  const validEth = sp.ethnicities.some((e) => e.id === raw.ethnicityId)
    ? (raw.ethnicityId as string)
    : sp.ethnicities[0].id;
  const validClass = CHARACTER_CLASSES.some((c) => c.id === raw.classId)
    ? (raw.classId as CharacterClassId)
    : 'meridian-surveyor';
  const validDirective = WORLDVIEW_DIRECTIVES.some((d) => d.id === raw.directiveId)
    ? (raw.directiveId as GuidingDirectiveId)
    : 'preserve-arch';

  const alloc = raw.allocatedAttributes ?? ({} as Partial<CharacterAttributes>);
  return createDefaultPlayerProfile(raw.name || fallbackName, {
    ...raw,
    speciesId: validSpecies,
    ethnicityId: validEth,
    classId: validClass,
    directiveId: validDirective,
    allocatedAttributes: {
      vigor: Math.max(0, Math.min(25, Math.floor(Number(alloc.vigor) || 0))),
      resonance: Math.max(0, Math.min(25, Math.floor(Number(alloc.resonance) || 0))),
      wayfinding: Math.max(0, Math.min(25, Math.floor(Number(alloc.wayfinding) || 0))),
      insight: Math.max(0, Math.min(25, Math.floor(Number(alloc.insight) || 0))),
      conviction: Math.max(0, Math.min(25, Math.floor(Number(alloc.conviction) || 0))),
    },
  });
}

// ── 5. CHARACTER PROGRESSION, DERIVED STATS & INVENTORY SYNERGY ─────────────

export interface CharacterProgressionState {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  evolutionRank: 1 | 2 | 3 | 4;
  evolutionTitle: string;
  nextEvolutionTitle: string | null;
  totalAttributePointsEarned: number;
  spentAttributePoints: number;
  unspentAttributePoints: number;
  totalAttributes: CharacterAttributes;
}

export function computeCharacterProgression(
  profile: PlayerCharacterProfile,
  renown: number,
  completedQuests: number,
  defeatedCount: number,
): CharacterProgressionState {
  // XP integrates every meaningful gameplay loop: Renown, completed Charters, and vanquished threats
  const totalXp = Math.max(
    0,
    Math.round(renown * 1.2 + completedQuests * 110 + defeatedCount * 30),
  );
  // Smooth escalating level curve: Level 1 at 0 XP, Level 2 at 120 XP, etc. up to Level 20
  let level = 1;
  let thresholdAccum = 0;
  let stepSize = 120;
  while (level < 20 && totalXp >= thresholdAccum + stepSize) {
    thresholdAccum += stepSize;
    level += 1;
    stepSize = Math.round(120 + (level - 1) * 55);
  }
  const xpIntoLevel = level >= 20 ? stepSize : Math.max(0, totalXp - thresholdAccum);
  const progressPct = Math.max(0, Math.min(100, Math.round((xpIntoLevel / Math.max(1, stepSize)) * 100)));

  const cls = getClassSpec(profile.classId);
  let evolution = cls.evolutionPath[0];
  for (const tier of cls.evolutionPath) {
    if (level >= tier.minLevel) evolution = tier;
  }
  const nextEvolution = cls.evolutionPath.find((t) => t.rank === evolution.rank + 1) ?? null;

  // Players start with 2 bonus customization points at Level 1, +2 per level up!
  const totalAttributePointsEarned = 2 + (level - 1) * 2;
  const alloc = profile.allocatedAttributes;
  const spentAttributePoints =
    alloc.vigor + alloc.resonance + alloc.wayfinding + alloc.insight + alloc.conviction;
  const unspentAttributePoints = Math.max(0, totalAttributePointsEarned - spentAttributePoints);

  const sp = getSpeciesSpec(profile.speciesId);
  const eth = getEthnicitySpec(profile.speciesId, profile.ethnicityId);

  const keys: CharacterAttributeKey[] = [
    'vigor',
    'resonance',
    'wayfinding',
    'insight',
    'conviction',
  ];
  const totalAttributes = {} as CharacterAttributes;
  for (const k of keys) {
    totalAttributes[k] =
      cls.baseAttributes[k] +
      (sp.attributeBonuses[k] ?? 0) +
      (eth.attributeBonus[k] ?? 0) +
      (alloc[k] ?? 0);
  }

  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForNextLevel: stepSize,
    progressPct,
    evolutionRank: evolution.rank,
    evolutionTitle: evolution.title,
    nextEvolutionTitle: nextEvolution ? `${nextEvolution.title} (Lv.${nextEvolution.minLevel})` : null,
    totalAttributePointsEarned,
    spentAttributePoints,
    unspentAttributePoints,
    totalAttributes,
  };
}

export interface ItemAffinityAssessment {
  rating: 'resonant' | 'compatible';
  synergyBonusPct: number;
  label: string;
  reason: string;
}

export function evaluateGearAffinity(
  profile: PlayerCharacterProfile,
  gearId: GearSlotId,
): ItemAffinityAssessment {
  const cls = getClassSpec(profile.classId);
  if (cls.preferredGear.includes(gearId)) {
    return {
      rating: 'resonant',
      synergyBonusPct: 15,
      label: `Class Signature (+15%)`,
      reason: `Attuned to ${cls.name} mastery (${CHARACTER_ATTRIBUTE_META[cls.primaryAttribute].label}).`,
    };
  }
  return {
    rating: 'compatible',
    synergyBonusPct: 0,
    label: 'Charter Standard',
    reason: 'Standard Waywright proficiency.',
  };
}

export function evaluateRelicAffinity(
  profile: PlayerCharacterProfile,
  relic: EquippedRelic,
): ItemAffinityAssessment {
  const cls = getClassSpec(profile.classId);
  const sp = getSpeciesSpec(profile.speciesId);
  const classMatch = cls.preferredRelicBonus.includes(relic.bonusKind);
  const homelandMatch = relic.theme && relic.theme === sp.realmTheme;
  if (classMatch && homelandMatch) {
    return {
      rating: 'resonant',
      synergyBonusPct: 25,
      label: 'Lineage & Class Resonance (+25%)',
      reason: `Matches both ${sp.name} homeland acoustics and ${cls.name} discipline.`,
    };
  }
  if (classMatch) {
    return {
      rating: 'resonant',
      synergyBonusPct: 15,
      label: `${cls.name} Synergy (+15%)`,
      reason: `Amplified by your ${cls.name} training.`,
    };
  }
  if (homelandMatch) {
    return {
      rating: 'resonant',
      synergyBonusPct: 10,
      label: `${sp.name} Kinship (+10%)`,
      reason: `Resonates with your ${sp.name} ancestral frequency.`,
    };
  }
  return {
    rating: 'compatible',
    synergyBonusPct: 0,
    label: 'Compatible',
    reason: 'Active whenever equipped.',
  };
}

/**
 * Full unified combat stats computation fusing Gear Tiers + Equipped Relics +
 * Species/Ethnicity/Class Core Attributes + Guiding Directive passive + Class/Inventory Synergy!
 */
export function computeCharacterCombatStats(
  profile: PlayerCharacterProfile,
  gearTiers: GearUpgradeTiers,
  relics: EquippedRelic[],
  progression: CharacterProgressionState,
): ComputedCombatStats {
  const base = computeCombatStats(gearTiers, relics);
  const attrs = progression.totalAttributes;
  const cls = getClassSpec(profile.classId);

  // Baseline attribute reference is 6 per stat so class/species specialization immediately feels distinct
  const dVig = attrs.vigor - 6;
  const dRes = attrs.resonance - 6;
  const dWay = attrs.wayfinding - 6;
  const dIns = attrs.insight - 6;
  const dCon = attrs.conviction - 6;

  // Inventory-to-Character Class Synergy bonus from equipped resonant relics & preferred gear tiers
  let synergyDamagePct = 0;
  let synergyHp = 0;
  let synergyHeal = 0;
  let synergySpeedPct = 0;
  for (const r of relics) {
    if (!r.equipped) continue;
    const aff = evaluateRelicAffinity(profile, r);
    if (aff.synergyBonusPct > 0) {
      const mult = aff.synergyBonusPct / 100;
      if (r.bonusKind === 'maxHp') synergyHp += Math.round(r.bonusValue * mult);
      else if (r.bonusKind === 'damagePct') synergyDamagePct += Math.round(r.bonusValue * mult);
      else if (r.bonusKind === 'speedPct') synergySpeedPct += Math.round(r.bonusValue * mult);
      else if (r.bonusKind === 'healPower') synergyHeal += Math.round(r.bonusValue * mult);
    }
  }

  // Preferred weapon mastery scales with gear tier & evolution rank
  const prefWeaponTierBonus = cls.preferredGear.reduce(
    (sum, gid) => sum + (gearTiers[gid] ?? 1),
    0,
  );
  const classMasteryDamagePct = prefWeaponTierBonus * 4 + (progression.evolutionRank - 1) * 6;

  // Guiding Directive passive flavor
  const dirHp = profile.directiveId === 'fellowship-charter' ? 8 : 0;
  const dirDmgPct = profile.directiveId === 'forge-of-merit' ? 5 : 0;
  const dirSpeedPct = profile.directiveId === 'boundless-horizon' ? 4 : 0;
  const dirHeal = profile.directiveId === 'living-equilibrium' ? 6 : 0;
  const dirWardPct = profile.directiveId === 'preserve-arch' ? 5 : 0;
  const dirStamPct = profile.directiveId === 'harmonic-truth' ? 6 : 0;

  const maxHp = Math.max(85, Math.round(base.maxHp + dVig * 8 + dCon * 3 + synergyHp + dirHp));
  const extraDmgPct =
    dVig * 2 + dRes * 2.5 + dIns * 2.5 + synergyDamagePct + classMasteryDamagePct + dirDmgPct;
  const extraSpeedPct = dWay * 2 + synergySpeedPct + dirSpeedPct;
  const extraStamPct = dWay * 5 + dirStamPct;
  const extraWardPct = Math.max(0, Math.round(dVig * 1.5 + dirWardPct));
  const extraDodgeDiscount = Math.max(0, Math.min(0.45, dWay * 0.02));

  return {
    ...base,
    maxHp,
    damageMultiplier: Number((base.damageMultiplier + extraDmgPct / 100).toFixed(3)),
    speedMultiplier: Number(Math.max(0.88, base.speedMultiplier + extraSpeedPct / 100).toFixed(3)),
    staminaRegenMultiplier: Number(
      Math.max(0.85, base.staminaRegenMultiplier + extraStamPct / 100).toFixed(3),
    ),
    bellRangeBonus: Number((base.bellRangeBonus + Math.max(0, dRes * 0.18)).toFixed(2)),
    lanternHealAmount: Math.max(24, Math.round(base.lanternHealAmount + dRes * 4 + dCon * 2 + synergyHeal + dirHeal)),
    damageReductionPct: Math.min(45, base.damageReductionPct + extraWardPct),
    dodgeStaminaDiscount: Number(
      Math.min(0.55, base.dodgeStaminaDiscount + extraDodgeDiscount).toFixed(3),
    ),
  };
}

// ── 6. CANONICAL NPC CHARACTER LINEAGE PROFILES & BESPOKE INTERACTIONS ──────

export interface NpcCharacterProfile {
  npcId: string;
  speciesId: CharacterSpeciesId;
  ethnicityId: string;
  classId: CharacterClassId;
  directiveId: GuidingDirectiveId;
  level: number;
  attributes: CharacterAttributes;
  originNote: string;
}

export const CANONICAL_NPC_CHARACTER_PROFILES: Record<string, NpcCharacterProfile> = {
  'npc-orenna': {
    npcId: 'npc-orenna',
    speciesId: 'meridian-human',
    ethnicityId: 'vaelmor-basalt',
    classId: 'meridian-surveyor',
    directiveId: 'preserve-arch',
    level: 9,
    attributes: { vigor: 8, resonance: 8, wayfinding: 9, insight: 10, conviction: 12 },
    originNote: 'Third-generation Stonebinder magistrate raised in the Upper Citadel of Vaelmor.',
  },
  'npc-kaelen': {
    npcId: 'npc-kaelen',
    speciesId: 'pelagis',
    ethnicityId: 'glasswater-spire-divers',
    classId: 'tide-loom-sentinel',
    directiveId: 'boundless-horizon',
    level: 9,
    attributes: { vigor: 8, resonance: 9, wayfinding: 12, insight: 10, conviction: 8 },
    originNote: 'Seasoned Tide-Loom cartographer from Glasswater charting Vaelmor’s salt-currents and outer gates.',
  },
  'npc-tarsik': {
    npcId: 'npc-tarsik',
    speciesId: 'lithborn',
    ethnicityId: 'kiln-strata-forgers',
    classId: 'foundry-bellwright',
    directiveId: 'forge-of-merit',
    level: 10,
    attributes: { vigor: 13, resonance: 10, wayfinding: 6, insight: 8, conviction: 9 },
    originNote: 'Broad-shouldered Lithborn bell-maker tempered beside the Ashen Kiln to tune Vaelmor’s great piers.',
  },
  'npc-seraia': {
    npcId: 'npc-seraia',
    speciesId: 'sylvan-rootkin',
    ethnicityId: 'oakhaven-canopy-weavers',
    classId: 'rootward-alchemist',
    directiveId: 'living-equilibrium',
    level: 10,
    attributes: { vigor: 6, resonance: 13, wayfinding: 7, insight: 12, conviction: 9 },
    originNote: 'Rootward botanist from Oakhaven cultivating bioluminescent silicate moss to heal fractured arches.',
  },
};

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function resolveNpcCharacterProfile(npc: GameNpc): NpcCharacterProfile {
  const existing = CANONICAL_NPC_CHARACTER_PROFILES[npc.id];
  if (existing) return existing;

  // Deterministic species/ethnicity/class/directive assignment for any synthesized realm NPC
  const seed = hashSeed(`${npc.id}:${npc.name}:${npc.guildName}`);
  const spIdx = npc.appearance?.speciesId
    ? CHARACTER_SPECIES.findIndex((s) => s.id === npc.appearance!.speciesId)
    : seed % CHARACTER_SPECIES.length;
  const sp = CHARACTER_SPECIES[spIdx >= 0 ? spIdx : seed % CHARACTER_SPECIES.length];
  const eth = sp.ethnicities[(seed >>> 4) % sp.ethnicities.length];
  const clsIdx = npc.appearance?.classId
    ? CHARACTER_CLASSES.findIndex((c) => c.id === npc.appearance!.classId)
    : (seed >>> 8) % CHARACTER_CLASSES.length;
  const cls = CHARACTER_CLASSES[clsIdx >= 0 ? clsIdx : (seed >>> 8) % CHARACTER_CLASSES.length];
  const dir = WORLDVIEW_DIRECTIVES[(seed >>> 12) % WORLDVIEW_DIRECTIVES.length];
  const level = 4 + ((seed >>> 16) % 9);

  const attrs: CharacterAttributes = {
    vigor: cls.baseAttributes.vigor + (sp.attributeBonuses.vigor ?? 0) + (eth.attributeBonus.vigor ?? 0) + (level > 7 ? 2 : 1),
    resonance: cls.baseAttributes.resonance + (sp.attributeBonuses.resonance ?? 0) + (eth.attributeBonus.resonance ?? 0) + 1,
    wayfinding: cls.baseAttributes.wayfinding + (sp.attributeBonuses.wayfinding ?? 0) + (eth.attributeBonus.wayfinding ?? 0) + 1,
    insight: cls.baseAttributes.insight + (sp.attributeBonuses.insight ?? 0) + (eth.attributeBonus.insight ?? 0) + 1,
    conviction: cls.baseAttributes.conviction + (sp.attributeBonuses.conviction ?? 0) + (eth.attributeBonus.conviction ?? 0) + 1,
  };

  return {
    npcId: npc.id,
    speciesId: sp.id,
    ethnicityId: eth.id,
    classId: cls.id,
    directiveId: dir.id,
    level,
    attributes: attrs,
    originNote: `${eth.name} of ${eth.homeland}, serving ${npc.guildName}.`,
  };
}

export interface BespokeNpcInteractionContext {
  npcProfile: NpcCharacterProfile;
  npcSpecies: CharacterSpeciesSpec;
  npcEthnicity: CulturalEthnicitySpec;
  npcClass: CharacterClassSpec;
  npcDirective: GuidingDirectiveSpec;
  resonanceRelation: 'kinship' | 'harmonious' | 'curious' | 'philosophical-tension';
  resonanceLabel: string;
  bespokeOpeningNote: string;
  bespokeChoices: DialogueChoice[];
}

const NPC_HONORIFICS = new Set([
  'magistrate',
  'forge-dean',
  'quartermaster',
  'herbalist',
  'warden',
  'archivist',
  'navigator',
  'captain',
  'elder',
  'master',
  'dean',
  'lord',
  'lady',
  'lady-warden',
  'surveyor',
]);

function extractNpcPersonalName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Waywright';
  if (parts.length > 1 && NPC_HONORIFICS.has(parts[0].toLowerCase())) {
    return parts[1];
  }
  return parts[0];
}

export function buildBespokeNpcInteraction(
  npc: GameNpc,
  playerProfile: PlayerCharacterProfile,
  progression: CharacterProgressionState,
): BespokeNpcInteractionContext {
  const npcProfile = resolveNpcCharacterProfile(npc);
  const npcSpecies = getSpeciesSpec(npcProfile.speciesId);
  const npcEthnicity = getEthnicitySpec(npcProfile.speciesId, npcProfile.ethnicityId);
  const npcClass = getClassSpec(npcProfile.classId);
  const npcDirective = getDirectiveSpec(npcProfile.directiveId);
  const npcShortName = extractNpcPersonalName(npc.name);

  const pSpecies = getSpeciesSpec(playerProfile.speciesId);
  const pEthnicity = getEthnicitySpec(playerProfile.speciesId, playerProfile.ethnicityId);
  const pClass = getClassSpec(playerProfile.classId);
  const pDirective = getDirectiveSpec(playerProfile.directiveId);

  const sameSpecies = playerProfile.speciesId === npcProfile.speciesId;
  const sameClass = playerProfile.classId === npcProfile.classId;
  const alliedDirective =
    playerProfile.directiveId === npcProfile.directiveId ||
    npcDirective.alliedDirectives.includes(playerProfile.directiveId);
  const contrastingDirective = npcDirective.contrastingDirectives.includes(playerProfile.directiveId);

  let resonanceRelation: BespokeNpcInteractionContext['resonanceRelation'] = 'curious';
  let resonanceLabel = 'Curious Accord';
  let bespokeOpeningNote = `${npcShortName} notes your ${pEthnicity.name} bearing and ${pClass.name} insignia with measured interest.`;

  if (sameSpecies) {
    resonanceRelation = 'kinship';
    resonanceLabel = `${pSpecies.name} Kinship`;
    bespokeOpeningNote = `${npcShortName} offers a quiet ${pSpecies.name} greeting of shared ancestry: "Good to see another of ${pSpecies.pluralName} walking the Span as ${progression.evolutionTitle}."`;
  } else if (alliedDirective) {
    resonanceRelation = 'harmonious';
    resonanceLabel = `Harmonic Worldview · ${pDirective.name}`;
    bespokeOpeningNote = `${npcShortName} recognizes your commitment to ${pDirective.name}—an ethos closely aligned with their own drive toward ${npcDirective.name}.`;
  } else if (contrastingDirective) {
    resonanceRelation = 'philosophical-tension';
    resonanceLabel = `Debate · ${pDirective.name} vs ${npcDirective.name}`;
    bespokeOpeningNote = `${npcShortName} studies your ${pDirective.name} seal thoughtfully: "We read the Meridian’s crisis differently, ${playerProfile.name}—yet both truths may be needed before the arch settles."`;
  }

  const bespokeChoices: DialogueChoice[] = [];

  // 1. Species / Ethnicity Kinship or Homeland Perspective choice
  bespokeChoices.push({
    id: `bespoke-lineage-${npc.id}-${playerProfile.speciesId}`,
    label: sameSpecies
      ? `[${pEthnicity.name}] Speak in the old ${pSpecies.name} cadence about ${pEthnicity.homeland}.`
      : `[${pSpecies.name} · ${pEthnicity.name}] Share how ${pEthnicity.homeland} reads tremors like Vaelmor’s.`,
    reply: sameSpecies
      ? `${npcShortName}’s guard softens immediately. "It steadies the heart to hear ${pEthnicity.homeland} remembered here. Take this mark of trust—${npc.beliefs[0] || npcDirective.creed}"`
      : `${npcShortName} leans in with genuine respect. "I have heard tales of ${pEthnicity.signatureCraft}. Combining ${pSpecies.name} wisdom with our ${npcEthnicity.signatureCraft} may save the Third Pier yet."`,
    thought: `Lineage exchange deepened rapport between ${pEthnicity.name} and ${npcEthnicity.name}.`,
    renownGain: 20,
  });

  // 2. Class & Core Attribute Check choice
  const primaryAttrKey = pClass.primaryAttribute;
  const primaryAttrScore = progression.totalAttributes[primaryAttrKey];
  const primaryAttrMeta = CHARACTER_ATTRIBUTE_META[primaryAttrKey];
  bespokeChoices.push({
    id: `bespoke-class-${npc.id}-${playerProfile.classId}`,
    label: sameClass
      ? `[${pClass.name} · ${primaryAttrMeta.short} ${primaryAttrScore}] Compare field craft as fellow ${pClass.name}s.`
      : `[${pClass.name} · ${primaryAttrMeta.short} ${primaryAttrScore}] Offer a ${pClass.name} assessment using your ${pClass.signatureItemName}.`,
    reply: sameClass
      ? `${npcShortName} smiles sharply. "You hold your stance like a true ${progression.evolutionTitle}. Watch the resonance harmonics near the outer stones—your ${primaryAttrMeta.label} (${primaryAttrScore}) will catch what novices miss."`
      : `${npcShortName} nods approvingly at your ${pClass.signatureItemName}. "A ${pClass.name}’s eye is rare on this causeway. With ${primaryAttrMeta.label} at ${primaryAttrScore}, you’ll feel the fault-line before the next Colossus rises."`,
    thought: `Class mastery (${pClass.name}, ${primaryAttrMeta.label} ${primaryAttrScore}) revealed tactical insight.`,
    renownGain: 25,
  });

  // 3. Worldview / Guiding Directive dialogue choice
  bespokeChoices.push({
    id: `bespoke-directive-${npc.id}-${playerProfile.directiveId}`,
    label: contrastingDirective
      ? `[${pDirective.name}] Challenge ${npcShortName}’s reliance on ${npcDirective.name}.`
      : `[${pDirective.name}] Affirm your Guiding Directive: "${pDirective.creed}"`,
    reply: contrastingDirective
      ? `${npcShortName} exhales slowly and meets your gaze. "Boldly spoken, ${playerProfile.name}. Perhaps ${npcDirective.name} alone grows rigid without ${pDirective.name} to test it. Prove your path on the field, and I will stand beside you."`
      : `${npcShortName} places a hand over their guild clasp. "Then our charters run in unison. Keep faith with ${pDirective.name}, and ${npc.guildName} will remember your name in stone."`,
    thought: contrastingDirective
      ? `Philosophical tension respected — earned grudging admiration from ${npc.name}.`
      : `Shared worldview strengthened alliance with ${npc.guildName}.`,
    renownGain: 20,
  });

  return {
    npcProfile,
    npcSpecies,
    npcEthnicity,
    npcClass,
    npcDirective,
    resonanceRelation,
    resonanceLabel,
    bespokeOpeningNote,
    bespokeChoices,
  };
}

// ── 7. HIGH-DEFINITION PAINTERLY SVG PORTRAIT SYNTHESIZER ───────────────────

function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexToLinearRgb(hex);
  return rgbToHex([
    Math.max(0, Math.min(1, r * factor)),
    Math.max(0, Math.min(1, g * factor)),
    Math.max(0, Math.min(1, b * factor)),
  ]);
}

/**
 * Generates a crisp, painterly high-definition character portrait SVG data URI
 * reflecting Species anatomy (ears, mineral facets, leaf crowns, tidal fins, ember veins,
 * aurora diadem), Hair/Beard, Eyes, Garment cut, Pauldrons, Clasp, and Realm backdrop.
 */
export function renderHdCharacterPortraitSvg(
  appearance: VerdantCharacterAppearance,
  opts?: {
    name?: string;
    speciesId?: CharacterSpeciesId;
    classId?: CharacterClassId;
    evolutionRank?: 1 | 2 | 3 | 4;
  },
): string {
  const speciesId = opts?.speciesId ?? appearance.speciesId ?? 'meridian-human';
  const sp = getSpeciesSpec(speciesId);
  const anatomy = appearance.anatomicalTraits ?? {
    ...sp.anatomicalDefaults,
    evolutionRank: opts?.evolutionRank ?? 1,
  };

  const skinHex = rgbToHex(appearance.skinRgb);
  const skinShadow = shadeHex(skinHex, 0.72);
  const skinDeepShadow = shadeHex(skinHex, 0.56);
  const skinLight = shadeHex(skinHex, 1.18);
  const hairHex = rgbToHex(appearance.hairRgb);
  const hairDark = shadeHex(hairHex, 0.62);
  const hairHi = shadeHex(hairHex, 1.38);
  const eyeHex = rgbToHex(appearance.eyeRgb);
  const eyeDark = shadeHex(eyeHex, 0.55);
  const garbHex = rgbToHex(appearance.garmentRgb);
  const garbDark = shadeHex(garbHex, 0.54);
  const garbLight = shadeHex(garbHex, 1.24);
  const garbSecHex = rgbToHex(appearance.underTunicRgb);
  const garbSecDark = shadeHex(garbSecHex, 0.62);
  const trimHex = rgbToHex(appearance.trimRgb);
  const trimHi = shadeHex(trimHex, 1.32);
  const trimDark = shadeHex(trimHex, 0.62);
  const markHex = rgbToHex(anatomy.markingRgb);
  const markHi = shadeHex(markHex, 1.38);
  const auraHex = rgbToHex(appearance.claspRgb);

  // Atmospheric Frontier Backdrop derived from species ancestral homeland
  const bgTop: Record<CharacterSpeciesId, string> = {
    'meridian-human': '#253242',
    lithborn: '#3b2b1e',
    'sylvan-rootkin': '#18362a',
    pelagis: '#123347',
    cinderkin: '#3b1b15',
    glacian: '#162b42',
  };
  const bgMid: Record<CharacterSpeciesId, string> = {
    'meridian-human': '#19212c',
    lithborn: '#261b14',
    'sylvan-rootkin': '#12241c',
    pelagis: '#0e2230',
    cinderkin: '#24110e',
    glacian: '#111f30',
  };
  const bgBot: Record<CharacterSpeciesId, string> = {
    'meridian-human': '#0d1118',
    lithborn: '#140f0c',
    'sylvan-rootkin': '#0a1410',
    pelagis: '#08131c',
    cinderkin: '#120908',
    glacian: '#09111c',
  };
  const lanternHex: Record<CharacterSpeciesId, string> = {
    'meridian-human': '#f2b857',
    lithborn: '#f5b041',
    'sylvan-rootkin': '#6ee7b7',
    pelagis: '#4fd1e6',
    cinderkin: '#ff7b3b',
    glacian: '#8ce2ff',
  };
  const keyGlow = lanternHex[speciesId];

  // Species-specific sculpted ears
  let earsSvg = `
    <path d="M104 134 Q92 138 94 156 Q98 168 108 164 Z" fill="${skinShadow}" stroke="${skinDeepShadow}" stroke-width="1"/>
    <path d="M98 144 Q97 152 103 156" fill="none" stroke="${skinDeepShadow}" stroke-width="1.3" opacity="0.65"/>
    <path d="M216 134 Q228 138 226 156 Q222 168 212 164 Z" fill="${skinShadow}" stroke="${skinDeepShadow}" stroke-width="1"/>
    <path d="M222 144 Q223 152 217 156" fill="none" stroke="${skinDeepShadow}" stroke-width="1.3" opacity="0.65"/>
  `;
  if (anatomy.earShape === 'tapered-leaf') {
    earsSvg = `
      <path d="M106 136 Q78 124 64 106 Q78 146 104 160 Z" fill="url(#skin)" stroke="${markHex}" stroke-opacity="0.55" stroke-width="1.2"/>
      <path d="M102 142 Q82 130 72 116" fill="none" stroke="${markHi}" stroke-opacity="0.65" stroke-width="1.1"/>
      <path d="M214 136 Q242 124 256 106 Q242 146 216 160 Z" fill="url(#skin)" stroke="${markHex}" stroke-opacity="0.55" stroke-width="1.2"/>
      <path d="M218 142 Q238 130 248 116" fill="none" stroke="${markHi}" stroke-opacity="0.65" stroke-width="1.1"/>
    `;
  } else if (anatomy.earShape === 'fin-crest') {
    earsSvg = `
      <path d="M105 134 L66 116 L76 138 L64 150 L78 158 L104 162 Z" fill="${markHex}" fill-opacity="0.68" stroke="${markHi}" stroke-width="1.2"/>
      <path d="M102 140 L72 125 M102 148 L70 148 M102 155 L80 156" stroke="${markHi}" stroke-opacity="0.7" stroke-width="1"/>
      <path d="M215 134 L254 116 L244 138 L256 150 L242 158 L216 162 Z" fill="${markHex}" fill-opacity="0.68" stroke="${markHi}" stroke-width="1.2"/>
      <path d="M218 140 L248 125 M218 148 L250 148 M218 155 L240 156" stroke="${markHi}" stroke-opacity="0.7" stroke-width="1"/>
    `;
  } else if (anatomy.earShape === 'faceted-stone') {
    earsSvg = `
      <polygon points="106,130 84,139 87,160 105,160" fill="${skinShadow}" stroke="${markHex}" stroke-width="1.3"/>
      <polygon points="106,130 84,139 96,147" fill="${markHex}" fill-opacity="0.45"/>
      <polygon points="214,130 236,139 233,160 215,160" fill="${skinShadow}" stroke="${markHex}" stroke-width="1.3"/>
      <polygon points="214,130 236,139 224,147" fill="${markHex}" fill-opacity="0.45"/>
    `;
  }

  // Species brow/crest & luminous markings with painterly bevels
  let browCrestSvg = '';
  if (anatomy.browCrest === 'mineral-ridge') {
    browCrestSvg = `
      <polygon points="160,88 172,103 160,116 148,103" fill="${markHex}" stroke="${trimDark}" stroke-width="1.1"/>
      <polygon points="160,88 160,116 148,103" fill="${markHi}" fill-opacity="0.58"/>
      <polygon points="122,114 136,105 142,116 128,119" fill="${markHex}" fill-opacity="0.75"/>
      <polygon points="198,114 184,105 178,116 192,119" fill="${markHex}" fill-opacity="0.75"/>
      <path d="M116 154 L126 164 L132 160 M204 154 L194 164 L188 160" fill="none" stroke="${markHi}" stroke-opacity="0.55" stroke-width="1.4"/>
    `;
  } else if (anatomy.browCrest === 'vine-circlet') {
    browCrestSvg = `
      <path d="M104 116 Q160 92 216 116" fill="none" stroke="#2f5e3e" stroke-width="5" stroke-linecap="round"/>
      <path d="M106 114 Q160 90 214 114" fill="none" stroke="${markHex}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
      <path d="M124 106 Q132 90 144 98 Q134 108 124 106 Z M196 106 Q188 90 176 98 Q186 108 196 106 Z" fill="${markHex}"/>
      <circle cx="160" cy="99" r="5" fill="${markHi}" stroke="#1c3d28" stroke-width="1.2"/>
    `;
  } else if (anatomy.browCrest === 'tidal-markings') {
    browCrestSvg = `
      <path d="M146 108 Q160 99 174 108" fill="none" stroke="${markHi}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="116" cy="155" r="2.4" fill="${markHi}" opacity="0.92"/>
      <circle cx="123" cy="162" r="1.8" fill="${markHex}" opacity="0.8"/>
      <circle cx="131" cy="166" r="1.3" fill="${markHi}" opacity="0.65"/>
      <circle cx="204" cy="155" r="2.4" fill="${markHi}" opacity="0.92"/>
      <circle cx="197" cy="162" r="1.8" fill="${markHex}" opacity="0.8"/>
      <circle cx="189" cy="166" r="1.3" fill="${markHi}" opacity="0.65"/>
    `;
  } else if (anatomy.browCrest === 'ember-sigil') {
    browCrestSvg = `
      <path d="M151 98 L160 116 L169 98" fill="none" stroke="${markHi}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="160" cy="104" r="2.4" fill="#ffe4b8"/>
      <path d="M114 152 L127 165 M118 162 L126 170 M206 152 L193 165 M202 162 L194 170" stroke="${markHi}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>
    `;
  } else if (anatomy.browCrest === 'frost-diadem') {
    browCrestSvg = `
      <polygon points="160,78 170,103 160,115 150,103" fill="${markHi}" fill-opacity="0.92" stroke="#ffffff" stroke-width="1.2"/>
      <polygon points="160,78 160,115 150,103" fill="#ffffff" fill-opacity="0.45"/>
      <path d="M112 108 L150 103 M208 108 L170 103" stroke="${markHi}" stroke-width="2" opacity="0.85"/>
    `;
  }

  // Painterly Hair Layer with directional highlights
  let backHairSvg = '';
  let frontHairSvg = '';
  if (appearance.hairStyle === 'braided-locs') {
    backHairSvg = `
      <path d="M88 124 Q80 206 96 270 L118 270 Q114 200 116 134 Z M232 124 Q240 206 224 270 L202 270 Q206 200 204 134 Z" fill="url(#hairGrad)"/>
      <path d="M98 140 Q94 204 104 260 M222 140 Q226 204 216 260" fill="none" stroke="${hairHi}" stroke-opacity="0.38" stroke-width="2"/>
    `;
    frontHairSvg = `
      <path d="M94 124 Q112 68 160 66 Q208 68 226 124 Q198 92 160 94 Q122 92 94 124 Z" fill="url(#hairGrad)"/>
      <path d="M114 82 Q160 72 206 84" fill="none" stroke="${hairHi}" stroke-opacity="0.42" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="106" cy="252" r="4.5" fill="${trimHex}" stroke="${trimDark}" stroke-width="1"/>
      <circle cx="214" cy="252" r="4.5" fill="${trimHex}" stroke="${trimDark}" stroke-width="1"/>
    `;
  } else if (appearance.hairStyle === 'twin-braids') {
    backHairSvg = `<path d="M92 124 Q86 196 102 256 L118 256 Q114 194 116 134 Z M228 124 Q234 196 218 256 L202 256 Q206 194 204 134 Z" fill="url(#hairGrad)"/>`;
    frontHairSvg = `
      <path d="M95 124 Q112 70 160 68 Q208 70 225 124 Q198 92 160 94 Q122 92 95 124 Z" fill="url(#hairGrad)"/>
      <rect x="98" y="244" width="18" height="6" rx="2" fill="${trimHex}" stroke="${trimDark}" stroke-width="1"/>
      <rect x="204" y="244" width="18" height="6" rx="2" fill="${trimHex}" stroke="${trimDark}" stroke-width="1"/>
    `;
  } else if (appearance.hairStyle === 'scholar-bun') {
    backHairSvg = `<circle cx="160" cy="52" r="24" fill="url(#hairGrad)" stroke="${trimHex}" stroke-width="2.4"/><line x1="126" y1="50" x2="194" y2="54" stroke="${trimHi}" stroke-width="2.4" stroke-linecap="round"/>`;
    frontHairSvg = `<path d="M96 124 Q114 70 160 68 Q206 70 224 124 Q198 92 160 92 Q122 92 96 124 Z" fill="url(#hairGrad)"/>`;
  } else if (appearance.hairStyle === 'horned-circlet') {
    backHairSvg = `<path d="M86 124 Q84 180 104 206 L216 206 Q236 180 234 124 Q220 66 160 62 Q100 66 86 124 Z" fill="url(#hairGrad)"/>`;
    frontHairSvg = `
      <path d="M96 124 Q124 88 174 88 Q206 90 224 124 Q208 68 160 66 Q112 68 96 124 Z" fill="url(#hairGrad)"/>
      <path d="M98 94 Q160 80 222 94" fill="none" stroke="${trimHex}" stroke-width="4.5"/>
      <polygon points="160,62 169,86 151,86" fill="${trimHi}" stroke="${trimDark}" stroke-width="1.2"/>
    `;
  } else if (appearance.hairStyle === 'cropped-grey') {
    frontHairSvg = `
      <path d="M97 124 Q106 72 160 70 Q214 72 223 124 Q198 92 160 94 Q122 92 97 124 Z" fill="url(#hairGrad)"/>
      <path d="M114 82 Q158 72 204 82" fill="none" stroke="${hairHi}" stroke-opacity="0.45" stroke-width="2.4" stroke-linecap="round"/>
    `;
  } else if (appearance.hairStyle === 'braided-crown') {
    backHairSvg = `<path d="M86 126 Q84 186 104 214 L216 214 Q236 186 234 126 Q220 66 160 62 Q100 66 86 126 Z" fill="url(#hairGrad)"/>`;
    frontHairSvg = `
      <path d="M95 124 Q120 82 160 82 Q200 82 225 124 Q208 66 160 62 Q112 66 95 124 Z" fill="url(#hairGrad)"/>
      <path d="M104 84 Q160 62 216 84" fill="none" stroke="${hairHi}" stroke-width="8.5" stroke-linecap="round"/>
      <path d="M112 82 Q160 66 208 82" fill="none" stroke="${hairDark}" stroke-width="1.6" stroke-dasharray="8 6" opacity="0.5"/>
    `;
  } else {
    backHairSvg = `<path d="M84 126 Q82 182 104 208 L216 208 Q238 182 236 126 Q222 64 160 60 Q98 64 84 126 Z" fill="url(#hairGrad)"/>`;
    frontHairSvg = `
      <path d="M95 124 Q124 88 176 88 Q206 90 225 124 Q208 68 160 64 Q112 68 95 124 Z" fill="url(#hairGrad)"/>
      <path d="M116 82 Q160 70 202 84 M128 90 Q162 82 192 92" fill="none" stroke="${hairHi}" stroke-opacity="0.44" stroke-width="2.2" stroke-linecap="round"/>
    `;
  }

  // Sculpted Beard Layer
  let beardSvg = '';
  if (appearance.beardStyle === 'trimmed-grey') {
    beardSvg = `
      <path d="M112 164 Q124 210 160 214 Q196 210 208 164 Q190 190 160 194 Q130 190 112 164 Z" fill="url(#hairGrad)" opacity="0.95"/>
      <path d="M138 176 Q160 182 182 176" fill="none" stroke="${hairHi}" stroke-opacity="0.35" stroke-width="2"/>
    `;
  } else if (appearance.beardStyle === 'full-smith') {
    beardSvg = `
      <path d="M110 158 Q116 222 142 244 L160 228 L178 244 Q204 222 210 158 Q188 190 160 192 Q132 190 110 158 Z" fill="url(#hairGrad)"/>
      <path d="M132 192 L138 228 M160 196 L160 224 M188 192 L182 228" stroke="${hairHi}" stroke-opacity="0.32" stroke-width="1.8" stroke-linecap="round"/>
    `;
  } else if (appearance.beardStyle === 'goatee') {
    beardSvg = `<path d="M140 182 Q160 228 180 182 Q160 194 140 182 Z" fill="url(#hairGrad)"/>`;
  } else if (appearance.beardStyle === 'braided-beard') {
    beardSvg = `
      <path d="M114 164 Q130 212 150 252 L170 252 Q190 212 206 164 Q184 192 160 194 Q136 192 114 164 Z" fill="url(#hairGrad)"/>
      <path d="M146 206 L174 216 M174 206 L146 216 M148 220 L172 230 M172 220 L148 230" stroke="${hairDark}" stroke-width="1.6" opacity="0.65"/>
      <rect x="148" y="234" width="24" height="8" rx="2" fill="${trimHex}" stroke="${trimDark}" stroke-width="1.2"/>
    `;
  }

  // Sculpted Hood Drape
  const hoodBackSvg = appearance.hasHoodDown
    ? `<path d="M72 232 Q112 196 160 202 Q208 196 248 232 L236 254 Q160 232 84 254 Z" fill="${garbDark}" stroke="${trimHex}" stroke-opacity="0.35" stroke-width="1.5"/>`
    : '';

  // Pauldrons & Shoulder Crest
  const pauldronSvg =
    appearance.hasPauldrons || anatomy.evolutionRank >= 3
      ? `
        <path d="M36 264 Q58 216 114 222 L106 274 Q62 280 36 264 Z" fill="url(#pauldronGrad)" stroke="${trimHex}" stroke-width="2.2"/>
        <path d="M48 256 Q72 232 104 236" fill="none" stroke="${trimHi}" stroke-opacity="0.55" stroke-width="1.6"/>
        <path d="M284 264 Q262 216 206 222 L214 274 Q258 280 284 264 Z" fill="url(#pauldronGrad)" stroke="${trimHex}" stroke-width="2.2"/>
        <path d="M272 256 Q248 232 216 236" fill="none" stroke="${trimHi}" stroke-opacity="0.55" stroke-width="1.6"/>
      `
      : '';

  // Species Shoulder Crest Accents (mineral crystal, glowing embers, living mantle, sea-glass fins)
  let shoulderCrestSvg = '';
  if (anatomy.shoulderCrest === 'quartz-pauldrons') {
    shoulderCrestSvg = `
      <polygon points="62,226 76,204 88,228" fill="${markHex}" stroke="${markHi}" stroke-width="1"/>
      <polygon points="258,226 244,204 232,228" fill="${markHex}" stroke="${markHi}" stroke-width="1"/>
    `;
  } else if (anatomy.shoulderCrest === 'crucible-gorget') {
    shoulderCrestSvg = `
      <path d="M114 226 Q160 248 206 226" fill="none" stroke="${markHi}" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>
    `;
  } else if (anatomy.shoulderCrest === 'living-mantle') {
    shoulderCrestSvg = `
      <path d="M74 236 Q92 214 118 228 Q94 242 74 236 Z M246 236 Q228 214 202 228 Q226 242 246 236 Z" fill="${markHex}" fill-opacity="0.72"/>
    `;
  } else if (anatomy.shoulderCrest === 'sea-glass-fins') {
    shoulderCrestSvg = `
      <path d="M58 232 Q76 206 96 226 Q78 236 58 232 Z M262 232 Q244 206 224 226 Q242 236 262 232 Z" fill="${markHi}" fill-opacity="0.65" stroke="${markHex}" stroke-width="1"/>
    `;
  }

  const auraSvg =
    anatomy.evolutionRank >= 3 || anatomy.shoulderCrest === 'aurora-halo'
      ? `<circle cx="160" cy="144" r="102" fill="none" stroke="${markHi}" stroke-opacity="0.32" stroke-width="1.8" stroke-dasharray="6 7"/>`
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="320" height="360">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="${bgTop[speciesId]}"/>
        <stop offset="58%" stop-color="${bgMid[speciesId]}"/>
        <stop offset="100%" stop-color="${bgBot[speciesId]}"/>
      </linearGradient>
      <radialGradient id="lanternLight" cx="18%" cy="46%" r="58%">
        <stop offset="0%" stop-color="${keyGlow}" stop-opacity="0.44"/>
        <stop offset="48%" stop-color="${keyGlow}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="${keyGlow}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="rimLight" cx="84%" cy="28%" r="48%">
        <stop offset="0%" stop-color="${auraHex}" stop-opacity="0.26"/>
        <stop offset="100%" stop-color="${auraHex}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="skin" x1="0.12" y1="0.08" x2="0.88" y2="0.96">
        <stop offset="0%" stop-color="${skinLight}"/>
        <stop offset="48%" stop-color="${skinHex}"/>
        <stop offset="100%" stop-color="${skinShadow}"/>
      </linearGradient>
      <linearGradient id="hairGrad" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0%" stop-color="${hairHi}"/>
        <stop offset="35%" stop-color="${hairHex}"/>
        <stop offset="100%" stop-color="${hairDark}"/>
      </linearGradient>
      <linearGradient id="coat" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="${garbLight}"/>
        <stop offset="42%" stop-color="${garbHex}"/>
        <stop offset="100%" stop-color="${garbDark}"/>
      </linearGradient>
      <linearGradient id="pauldronGrad" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="${garbSecHex}"/>
        <stop offset="100%" stop-color="${garbSecDark}"/>
      </linearGradient>
      <radialGradient id="vignette" cx="50%" cy="45%" r="68%">
        <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#05070b" stop-opacity="0.62"/>
      </radialGradient>
    </defs>

    <!-- Atmospheric Frontier Backdrop & Architectural Archway -->
    <rect width="320" height="360" fill="url(#bg)"/>
    <path d="M18 350 L18 118 Q160 12 302 118 L302 350" fill="none" stroke="${trimHex}" stroke-opacity="0.16" stroke-width="6"/>
    <path d="M36 350 L36 130 Q160 36 284 130 L284 350" fill="none" stroke="${trimHex}" stroke-opacity="0.11" stroke-width="2"/>
    <rect width="320" height="360" fill="url(#lanternLight)"/>
    <rect width="320" height="360" fill="url(#rimLight)"/>
    <!-- Subtle Atmospheric Motes -->
    <circle cx="48" cy="148" r="2.2" fill="${keyGlow}" opacity="0.65"/>
    <circle cx="64" cy="108" r="1.4" fill="${keyGlow}" opacity="0.45"/>
    <circle cx="264" cy="122" r="1.8" fill="${auraHex}" opacity="0.5"/>
    <circle cx="250" cy="196" r="1.3" fill="${keyGlow}" opacity="0.38"/>
    ${auraSvg}

    <!-- Back Hair & Draped Hood -->
    ${backHairSvg}
    ${hoodBackSvg}

    <!-- Torso, Layered Tunic & Sculpted Mantle Folds -->
    <path d="M26 360 L48 244 Q86 218 130 214 L190 214 Q234 218 272 244 L294 360 Z" fill="url(#coat)" stroke="${trimHex}" stroke-opacity="0.45" stroke-width="1.8"/>
    <!-- Fabric shadow folds -->
    <path d="M68 246 L58 358 M98 248 L96 358 M252 246 L262 358 M222 248 L224 358" stroke="#080a0f" stroke-opacity="0.32" stroke-width="5" stroke-linecap="round"/>
    <path d="M122 216 L160 332 L198 216 Z" fill="url(#pauldronGrad)"/>
    <!-- Inner stitched vest lines -->
    <path d="M160 238 L160 326" stroke="${trimHex}" stroke-opacity="0.35" stroke-width="1.6"/>
    <!-- Sculpted Lapels & Embroidered Trim -->
    <path d="M108 216 L156 312 L134 222 Z" fill="url(#coat)" stroke="${trimHex}" stroke-width="2"/>
    <path d="M212 216 L164 312 L186 222 Z" fill="url(#coat)" stroke="${trimHex}" stroke-width="2"/>
    <!-- Cross-belt Bandolier -->
    <path d="M84 228 L234 338 L220 356 L70 246 Z" fill="${garbSecDark}" stroke="${trimDark}" stroke-width="1.4" opacity="0.88"/>
    <rect x="134" y="274" width="16" height="12" rx="2" fill="${trimHex}" stroke="${trimDark}" stroke-width="1.2" transform="rotate(36 142 280)"/>
    ${pauldronSvg}
    ${shoulderCrestSvg}

    <!-- Guild Clasp Medallion -->
    <polygon points="160,260 172,274 160,288 148,274" fill="${trimHex}" stroke="#14110b" stroke-width="1.6"/>
    <polygon points="160,260 160,288 148,274" fill="${trimHi}" fill-opacity="0.55"/>
    <circle cx="160" cy="274" r="3.6" fill="${markHi}" stroke="${trimDark}" stroke-width="0.8"/>

    <!-- Neck & Clavicle Shadow -->
    <path d="M137 190 L135 232 Q160 248 185 232 L183 190 Z" fill="${skinShadow}"/>
    <path d="M139 194 Q160 218 181 194 L181 214 Q160 228 139 214 Z" fill="${skinDeepShadow}" opacity="0.65"/>

    <!-- Ears (Species-specific) -->
    ${earsSvg}

    <!-- Sculpted Head & Jawline -->
    <path d="M104 128 Q104 74 160 74 Q216 74 216 128 Q214 176 192 197 Q176 211 160 213 Q144 211 128 197 Q106 176 104 128 Z" fill="url(#skin)"/>
    <!-- Warm directional rim light on left cheek + soft shadow on right cheek -->
    <path d="M106 128 Q108 172 132 196 Q116 174 114 130 Z" fill="${keyGlow}" opacity="0.22"/>
    <path d="M214 128 Q212 174 188 196 Q204 174 206 130 Z" fill="${skinDeepShadow}" opacity="0.34"/>
    <!-- Brow Ridge & Nose Bridge Shading -->
    <path d="M118 130 Q140 124 156 132 M202 130 Q180 124 164 132" fill="none" stroke="${skinShadow}" stroke-opacity="0.48" stroke-width="2"/>
    <path d="M161 132 L164 158 L155 162" fill="none" stroke="${skinDeepShadow}" stroke-opacity="0.55" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M158 134 L156 156" fill="none" stroke="${skinLight}" stroke-opacity="0.55" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M116 154 Q124 169 138 174 M204 154 Q196 169 182 174" fill="none" stroke="${skinShadow}" stroke-opacity="0.4" stroke-width="2.2"/>

    <!-- Expressive Eyes (Shaded Lids, Layered Iris, Dual Catchlights) -->
    <path d="M117 132 Q132 124 147 131" fill="none" stroke="${hairDark}" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M173 131 Q188 124 203 132" fill="none" stroke="${hairDark}" stroke-width="3.6" stroke-linecap="round"/>
    <ellipse cx="133" cy="144" rx="11.5" ry="6.2" fill="#ece8df"/>
    <ellipse cx="187" cy="144" rx="11.5" ry="6.2" fill="#ece8df"/>
    <circle cx="133" cy="144" r="5.4" fill="${eyeHex}" stroke="${eyeDark}" stroke-width="1.1"/>
    <circle cx="187" cy="144" r="5.4" fill="${eyeHex}" stroke="${eyeDark}" stroke-width="1.1"/>
    <circle cx="133" cy="144" r="2.6" fill="#0f131a"/>
    <circle cx="187" cy="144" r="2.6" fill="#0f131a"/>
    <circle cx="131" cy="142" r="1.6" fill="#ffffff"/>
    <circle cx="185" cy="142" r="1.6" fill="#ffffff"/>
    <circle cx="136" cy="146" r="0.8" fill="${keyGlow}" opacity="0.85"/>
    <circle cx="190" cy="146" r="0.8" fill="${keyGlow}" opacity="0.85"/>
    <path d="M120 142 Q133 134 146 142" fill="none" stroke="#161920" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M174 142 Q187 134 200 142" fill="none" stroke="#161920" stroke-width="2.4" stroke-linecap="round"/>

    <!-- Sculpted Mouth -->
    <path d="M145 178 Q160 183 175 178" fill="none" stroke="${skinDeepShadow}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M150 182 Q160 186 170 182" fill="none" stroke="${skinLight}" stroke-opacity="0.45" stroke-width="1.4" stroke-linecap="round"/>

    <!-- Species Brow Crest & Markings -->
    ${browCrestSvg}

    <!-- Beard & Front Hair -->
    ${beardSvg}
    ${frontHairSvg}

    <!-- Painterly Vignette & Gilded Portrait Frame -->
    <rect width="320" height="360" fill="url(#vignette)"/>
    <rect x="6" y="6" width="308" height="348" fill="none" stroke="${trimHex}" stroke-opacity="0.48" stroke-width="1.8"/>
    <rect x="11" y="11" width="298" height="338" fill="none" stroke="${trimHex}" stroke-opacity="0.18" stroke-width="1"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

export interface CharacterOntologyAuditSummary {
  speciesCount: number;
  ethnicityCount: number;
  classCount: number;
  directiveCount: number;
  invariantCount: number;
  canonicalNpcProfileCount: number;
  allValid: boolean;
}

export function auditCharacterOntology(): CharacterOntologyAuditSummary {
  const speciesCount = CHARACTER_SPECIES.length;
  const ethnicityCount = listAllEthnicities().length;
  const classCount = CHARACTER_CLASSES.length;
  const directiveCount = WORLDVIEW_DIRECTIVES.length;
  const invariantCount = CHARACTER_UNIVERSAL_INVARIANTS.length;
  const canonicalNpcProfileCount = Object.keys(CANONICAL_NPC_CHARACTER_PROFILES).length;
  const allValid =
    speciesCount >= 6 &&
    ethnicityCount >= 12 &&
    classCount >= 6 &&
    directiveCount >= 6 &&
    invariantCount >= 7 &&
    canonicalNpcProfileCount >= 4;

  return {
    speciesCount,
    ethnicityCount,
    classCount,
    directiveCount,
    invariantCount,
    canonicalNpcProfileCount,
    allValid,
  };
}
