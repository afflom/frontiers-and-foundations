import { kappa } from './prism-id.mjs';
import {
  ALL_CANONICAL_WORLDS,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import {
  synthesizeRealmEcosystem,
  type FaunaKitId,
} from './verdantEcosystemCatalog';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';
import { compileNpcCharacterAppearance } from './verdantCharacterCompiler';
import {
  BIOME_RELIC_ARCHETYPES,
  renderRelicSigilSvgDataUrl,
} from './verdantRelicCatalog';
import { SOUNDTRACK_CATALOG, type AcousticFoleyProfile } from './verdantScoreSchema';
import {
  GEAR_LOADOUT,
  INITIAL_GUILDS,
  INITIAL_NPCS,
  INITIAL_QUESTS,
  type GameNpc,
  type GameQuest,
  type GuildCharter,
} from '../game/worldData';
import { getBossSignatureProfile } from '../game/rpgLogic';
import type { EquippedRelic } from '../game/multiplayerTypes';
import { auditAntiTropeNovelty } from '../engine/cognitiveNovelty';
import {
  DUNGEON_TOPOLOGY_CHARTERS,
  TERRAIN_GEOMORPHOLOGIES,
  WORLD_DIFFERENTIATION_PROFILES,
  getAllStoryAutomata,
  getDungeonTopologyCharter,
  getWorldDifferentiationProfile,
  verifyStoryAutomaton,
} from './verdantUnifiedCharter';
import {
  DIRECTED_JOURNEY_MILESTONES,
  FIELD_MANUAL_SECTIONS,
  JOURNEY_FLOW_EDGES,
  JOURNEY_FLOW_STATES,
  PROLOGUE_CINEMATIC_ACTS,
  WAYWRIGHT_OATH_CHOICES,
  verifyGamerJourneyGraph,
} from './verdantJourneyModel';

/**
 * Exact 8 Canonical Cognitive Part Slots exposed by `verdant-uorc.wasm`
 * (`verdant_wasm_cognitive_resolution_aux`).
 */
export const VERDANT_PART_SLOTS = [
  'stage-environment',
  'character-rigs',
  'hero-props',
  'surface-materials',
  'spatial-acoustics',
  'visual-identity',
  'cognitive-language',
  'runtime-frameworks',
] as const;

export type VerdantPartSlot = (typeof VERDANT_PART_SLOTS)[number];

/**
 * Uniform Verdant definition & fidelity tier across every model & sub-model:
 *  - 1: Sketch / Draft Proxy
 *  - 2: Field Charter (Standard Playable)
 *  - 3: High-Definition Meridian (Default Live Build)
 *  - 4: Sovereign Ultra-Def (Escalated Uniform Refinement)
 */
export type VerdantResolutionTier = 1 | 2 | 3 | 4;

export const RESOLUTION_TIER_LABELS: Record<VerdantResolutionTier, string> = {
  1: 'Sketch Proxy',
  2: 'Field Charter',
  3: 'High-Definition Meridian',
  4: 'Sovereign Ultra-Def',
};

export const SEMANTIC_VECTOR_AXES = [
  'terrain',
  'ecology',
  'morphology',
  'materiality',
  'acoustics',
  'identity',
  'narrative',
  'fidelity',
] as const;

export type SemanticVectorAxis = (typeof SEMANTIC_VECTOR_AXES)[number];

export type VerdantModelKind =
  | 'root'
  | 'part'
  | 'realm'
  | 'dungeon'
  | 'ecosystem'
  | 'geomorphology'
  | 'dungeon-topology'
  | 'character'
  | 'fauna'
  | 'monster-species'
  | 'gear'
  | 'relic-archetype'
  | 'relic'
  | 'material-palette'
  | 'score'
  | 'foley-profile'
  | 'visual-crest'
  | 'quest'
  | 'guild'
  | 'story-automaton'
  | 'prologue-act'
  | 'journey-milestone'
  | 'journey-flow'
  | 'field-manual'
  | 'differentiation-profile'
  | 'expedition-session'
  | 'framework';

export type VerdantEdgeRelation =
  | 'uses-geomorphology'
  | 'uses-topology'
  | 'delves-beneath'
  | 'governed-by'
  | 'uses-materials'
  | 'scored-by'
  | 'uses-foley'
  | 'narrated-by'
  | 'inhabited-by'
  | 'spawns-fauna'
  | 'chartered-by'
  | 'crested-by'
  | 'hosts-expedition'
  | 'introduces-realm'
  | 'introduces-npc'
  | 'guides-quest'
  | 'directs-journey';

export interface VerdantModelEdge {
  edgeId: string;
  fromId: string;
  toId: string;
  relation: VerdantEdgeRelation;
  crossPart: boolean;
}

export interface VerdantModelGraph {
  edges: VerdantModelEdge[];
  crossPartEdges: number;
  danglingEdges: Array<{ fromId: string; toId: string; relation: VerdantEdgeRelation }>;
  integrityRatio: number; // 0..1
}

export interface ModelLineageReport {
  model: VerdantModelNode;
  upstream: Array<{ relation: VerdantEdgeRelation; node: VerdantModelNode }>;
  downstream: Array<{ relation: VerdantEdgeRelation; node: VerdantModelNode }>;
  crossPartDegree: number;
}

export interface VerdantGenerativeGenome {
  seed: number;
  generator: string;
  catalogRef: string;
  traits: Record<string, string | number | boolean>;
  refinementPass: number;
  diversifiedFrom?: string;
}

/**
 * Uniform composable Model-of-Models node implemented by every entity,
 * subsystem, biome, character, artifact, score, expedition, and framework in
 * Frontiers and Foundations.
 */
export interface VerdantModelNode {
  modelId: string;
  parentId: string | null;
  kind: VerdantModelKind;
  partSlot: VerdantPartSlot | 'root';
  title: string;
  schemaType: string;
  resolutionTier: VerdantResolutionTier;
  definitionScore: number; // 0..100
  generativeGenome: VerdantGenerativeGenome;
  featureSignature: string[];
  semanticVector: number[]; // 8D normalized vTensor feature embedding in [0, 1]
  tags: string[];
  version: number;
  kappaDigest: string;
  children: VerdantModelNode[];
}

export interface MultiplayerSessionModelInput {
  roomCode: string;
  activeRealmSlug: string;
  activeRealmName: string;
  onlinePlayers: number;
  sameRealmAllies: number;
  activePings: number;
  activeSummonRealm?: string | null;
}

export interface ModelOfModelsBuildInput {
  realms?: FrontiersRealmSpec[];
  npcs?: GameNpc[];
  quests?: GameQuest[];
  guilds?: GuildCharter[];
  relics?: EquippedRelic[];
  multiplayer?: MultiplayerSessionModelInput;
  baseResolutionTier?: VerdantResolutionTier;
}

export interface PartModelSummary {
  partSlot: VerdantPartSlot;
  title: string;
  modelCount: number;
  meanResolutionTier: number;
  meanDefinitionScore: number;
  uniqueFeatureTokens: number;
  vectorCentroid: number[];
}

export interface ModelOfModelsSummary {
  rootModelId: string;
  title: string;
  version: number;
  resolutionTier: VerdantResolutionTier;
  definitionScore: number;
  totalModels: number;
  partsPopulated: number;
  totalParts: number;
  graphEdgeCount: number;
  crossPartEdgeCount: number;
  kappaDigest: string;
  parts: PartModelSummary[];
}

const PART_TITLES: Record<VerdantPartSlot, string> = {
  'stage-environment': 'Stage Environment & Bespoke Ecosystems',
  'character-rigs': 'Portrait-Matched Character Rigs & Apex Fauna',
  'hero-props': 'Hero Props, Field Gear & Biome Relics',
  'surface-materials': 'PBR Surface Materials & Hydro-Terrain Palettes',
  'spatial-acoustics': 'Orchestral Repertoire & Spatial Foley Acoustics',
  'visual-identity': 'Procedural Sigils, Portraits & Atmospheric Identity',
  'cognitive-language': 'Anti-Trope Narrative Quests & Guild Charters',
  'runtime-frameworks': 'Verdant WASM, WebGL2 & Prism-Stitch Runtime Frameworks',
};

const ALL_FAUNA_KITS: FaunaKitId[] = [
  'highland-ironclad',
  'verdant-mycelial',
  'pyroclastic-forge',
  'pelagic-abyssal',
  'dune-sandstrider',
  'glacial-frostborn',
];

const ALL_FOLEY_PROFILES: Array<{ id: AcousticFoleyProfile; title: string; signature: string[] }> = [
  { id: 'highland-wind', title: 'Highland Basalt Wind & Bell Overtones', signature: ['foley:highland-wind', 'band:mid-air', 'resonance:bronze'] },
  { id: 'aqueduct-water', title: 'Aqueduct Cistern Cascades & Spore Rustle', signature: ['foley:aqueduct-water', 'band:fluid-shimmer', 'resonance:limestone'] },
  { id: 'caldera-forge', title: 'Caldera Magma Crackle & Bellows Pulse', signature: ['foley:caldera-forge', 'band:sub-thermal', 'resonance:obsidian'] },
  { id: 'ocean-surf', title: 'Pelagic Tidal Swell & Sea-Glass Spray', signature: ['foley:ocean-surf', 'band:broad-swell', 'resonance:coral'] },
  { id: 'steppe-chimes', title: 'Amber Steppe Sand-Harp & Wind Chimes', signature: ['foley:steppe-chimes', 'band:harmonic-bell', 'resonance:sandstone'] },
  { id: 'glacial-aurora', title: 'Glacial Crevasse Shimmer & Aurora Crackle', signature: ['foley:glacial-aurora', 'band:crystalline-high', 'resonance:ice'] },
  { id: 'dungeon-cavern', title: 'Subterranean Vault Drip & Deep Modal Echo', signature: ['foley:dungeon-cavern', 'band:deep-reverb', 'resonance:vault-stone'] },
];

export function hashModelSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function computeSyncDigest(input: string): string {
  const h1 = hashModelSeed(input);
  const h2 = hashModelSeed(`verdant:${input}:${h1}`);
  return `fnv:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function computeNodeDefinitionScore(
  tier: VerdantResolutionTier,
  traitCount: number,
  featureCount: number,
  refinementPass: number,
): number {
  const tierBase = tier === 4 ? 86 : tier === 3 ? 72 : tier === 2 ? 54 : 34;
  const traitBonus = Math.min(8, Math.floor(traitCount * 1.1));
  const featureBonus = Math.min(4, Math.floor(featureCount * 0.55));
  const passBonus = Math.min(4, refinementPass * 2);
  return Math.max(20, Math.min(100, tierBase + traitBonus + featureBonus + passBonus));
}

/**
 * Computes a deterministic 8-dimensional vTensor semantic embedding in [0, 1]^8
 * aligned with the 8 Verdant Cognitive axes:
 * [terrain, ecology, morphology, materiality, acoustics, identity, narrative, fidelity].
 */
export function computeSemanticVector(params: {
  modelId: string;
  partSlot: VerdantPartSlot | 'root';
  resolutionTier: VerdantResolutionTier;
  traits: Record<string, string | number | boolean>;
  featureSignature: string[];
  seed: number;
}): number[] {
  const slotIndex =
    params.partSlot === 'root'
      ? -1
      : VERDANT_PART_SLOTS.indexOf(params.partSlot);
  const vec = [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18];

  // Primary slot affinity establishes structural axis dominance
  if (slotIndex >= 0 && slotIndex < 8) {
    vec[slotIndex] += 0.42;
  } else {
    for (let i = 0; i < 8; i++) vec[i] += 0.28;
  }

  // Project each feature signature token deterministically into orthogonal axes
  for (const token of params.featureSignature) {
    const h = hashModelSeed(token);
    const axisA = h % 8;
    const axisB = (h >>> 5) % 8;
    const weightA = 0.08 + ((h >>> 11) % 100) / 380;
    const weightB = 0.04 + ((h >>> 19) % 100) / 520;
    vec[axisA] += weightA;
    vec[axisB] += weightB;
  }

  // Incorporate quantitative trait signals (bpm, waterLevel, hp, tier, counts)
  const tr = params.traits;
  if (typeof tr.waterLevel === 'number') {
    vec[0] += Math.min(0.24, Math.abs(tr.waterLevel) * 0.06);
  }
  if (typeof tr.massifCount === 'number') {
    vec[0] += Math.min(0.25, tr.massifCount * 0.03);
  }
  if (typeof tr.bpm === 'number') {
    vec[4] += Math.min(0.32, Math.max(0.05, (tr.bpm - 60) / 140));
  }
  if (typeof tr.baseHp === 'number') {
    vec[2] += Math.min(0.28, tr.baseHp / 360);
  }
  if (typeof tr.renownReward === 'number') {
    vec[6] += Math.min(0.24, tr.renownReward / 240);
  }
  if (typeof tr.resonanceHz === 'number') {
    vec[4] += Math.min(0.24, (tr.resonanceHz % 320) / 640);
    vec[5] += 0.14;
  }
  if (typeof tr.onlinePlayers === 'number') {
    vec[7] += Math.min(0.26, 0.1 + tr.onlinePlayers * 0.04);
  }

  // Fidelity axis reflects resolution tier & genome density
  vec[7] += params.resolutionTier * 0.12 + Math.min(0.16, Object.keys(tr).length * 0.015);

  // Subtle deterministic micro-dispersion from genome seed so sibling archetypes remain distinct
  for (let i = 0; i < 8; i++) {
    const jitter = (((params.seed >>> (i * 3)) & 0x1f) / 31 - 0.5) * 0.08;
    vec[i] = Math.round(Math.max(0.05, Math.min(0.99, vec[i] + jitter)) * 1000) / 1000;
  }

  return vec;
}

function makeNode(params: {
  modelId: string;
  parentId: string | null;
  kind: VerdantModelKind;
  partSlot: VerdantPartSlot | 'root';
  title: string;
  schemaType: string;
  resolutionTier: VerdantResolutionTier;
  generator: string;
  catalogRef: string;
  traits: Record<string, string | number | boolean>;
  featureSignature: string[];
  tags: string[];
  children?: VerdantModelNode[];
  refinementPass?: number;
}): VerdantModelNode {
  const refinementPass = params.refinementPass ?? 0;
  const uniqueSig = Array.from(new Set(params.featureSignature.filter(Boolean)));
  const uniqueTags = Array.from(new Set(params.tags.filter(Boolean)));
  const seed = hashModelSeed(`${params.modelId}|${params.catalogRef}|${uniqueSig.join(',')}`);
  const definitionScore = computeNodeDefinitionScore(
    params.resolutionTier,
    Object.keys(params.traits).length,
    uniqueSig.length,
    refinementPass,
  );
  const semanticVector = computeSemanticVector({
    modelId: params.modelId,
    partSlot: params.partSlot,
    resolutionTier: params.resolutionTier,
    traits: params.traits,
    featureSignature: uniqueSig,
    seed,
  });
  const digestInput = JSON.stringify({
    id: params.modelId,
    tier: params.resolutionTier,
    score: definitionScore,
    sig: uniqueSig,
    vec: semanticVector,
    traits: params.traits,
  });
  return {
    modelId: params.modelId,
    parentId: params.parentId,
    kind: params.kind,
    partSlot: params.partSlot,
    title: params.title,
    schemaType: params.schemaType,
    resolutionTier: params.resolutionTier,
    definitionScore,
    generativeGenome: {
      seed,
      generator: params.generator,
      catalogRef: params.catalogRef,
      traits: { ...params.traits },
      refinementPass,
    },
    featureSignature: uniqueSig,
    semanticVector,
    tags: uniqueTags,
    version: 1,
    kappaDigest: computeSyncDigest(digestInput),
    children: params.children ?? [],
  };
}

/**
 * Builds the single unified Model-of-Models tree for the entire
 * Frontiers and Foundations game across all 8 canonical Verdant Cognitive Parts.
 */
export function buildFrontiersModelOfModels(
  input: ModelOfModelsBuildInput = {},
): VerdantModelNode {
  const tier: VerdantResolutionTier = input.baseResolutionTier ?? 3;
  const realms = input.realms && input.realms.length > 0 ? input.realms : ALL_CANONICAL_WORLDS;
  const guilds = input.guilds && input.guilds.length > 0 ? input.guilds : INITIAL_GUILDS;
  const activeRelics = input.relics ?? [];

  // Deduplicate NPCs across canonical INITIAL_NPCS + all realms + caller overrides
  const npcMap = new Map<string, { npc: GameNpc; realmSlug: string }>();
  for (const n of INITIAL_NPCS) npcMap.set(n.id, { npc: n, realmSlug: 'vaelmor' });
  for (const r of realms) {
    for (const n of r.npcs) {
      if (!npcMap.has(n.id)) npcMap.set(n.id, { npc: n, realmSlug: r.slug });
    }
  }
  if (input.npcs) {
    for (const n of input.npcs) {
      npcMap.set(n.id, { npc: n, realmSlug: npcMap.get(n.id)?.realmSlug ?? 'active' });
    }
  }

  // Deduplicate Quests across INITIAL_QUESTS + all realms + caller overrides
  const questMap = new Map<string, GameQuest>();
  for (const q of INITIAL_QUESTS) questMap.set(q.id, q);
  for (const r of realms) {
    for (const q of r.quests) {
      if (!questMap.has(q.id)) questMap.set(q.id, q);
    }
  }
  if (input.quests) {
    for (const q of input.quests) questMap.set(q.id, q);
  }

  const rootId = 'frontiers:root:game-model';

  // -------------------------------------------------------------------------
  // PART 1: stage-environment (All Realms, Ecosystems, 3D Dungeons, 6 Geomorphologies, 6 Dungeon Topologies)
  // -------------------------------------------------------------------------
  const stagePartId = 'frontiers:part:stage-environment';
  const stageChildren: VerdantModelNode[] = realms.map((spec) => {
    const profile = getWorldDifferentiationProfile(spec.theme);
    if (spec.isDungeon) {
      const dgPlan = synthesizeDungeonEcosystem(spec);
      const dgCharter = getDungeonTopologyCharter(dgPlan.style);
      const dgId = `frontiers:dungeon:${spec.slug}`;
      const blueprintNode = makeNode({
        modelId: `${dgId}:blueprint`,
        parentId: dgId,
        kind: 'ecosystem',
        partSlot: 'stage-environment',
        title: `${spec.name} — ${dgPlan.styleTitle}`,
        schemaType: 'DungeonBlueprint',
        resolutionTier: tier,
        generator: 'verdantDungeonCatalog.synthesizeDungeonEcosystem',
        catalogRef: `verdant:dungeon-topology:${dgPlan.topologyId}`,
        traits: {
          style: dgPlan.style,
          topologyId: dgPlan.topologyId,
          chasmVisual: dgPlan.chasmVisual,
          faunaKit: dgPlan.faunaKit,
          phenomenon: dgPlan.phenomenon.id,
          structures: dgPlan.structures.length,
          walkableZones: dgPlan.walkableZones.length,
          hazardZones: dgPlan.hazardZones.length,
          thermalVents: dgPlan.thermalVents.length,
          cohesionProfileId: profile.profileId,
        },
        featureSignature: [
          `dungeon-style:${dgPlan.style}`,
          `topology:${dgPlan.topologyId}`,
          `chasm:${dgPlan.chasmVisual}`,
          `fauna:${dgPlan.faunaKit}`,
          `phenomenon:${dgPlan.phenomenon.id}`,
          `ambient:${dgPlan.phenomenon.ambientParticleKind}`,
        ],
        tags: ['dungeon-blueprint', dgPlan.style, dgPlan.topologyId, spec.theme],
      });
      return makeNode({
        modelId: dgId,
        parentId: stagePartId,
        kind: 'dungeon',
        partSlot: 'stage-environment',
        title: spec.name,
        schemaType: '3DModel',
        resolutionTier: tier,
        generator: 'realmModelSchema.CANONICAL_DUNGEON_SPECS',
        catalogRef: `verdant:realm:${spec.slug}`,
        traits: {
          slug: spec.slug,
          theme: spec.theme,
          dungeonStyle: dgPlan.style,
          topologyId: dgPlan.topologyId,
          chasmVisual: dgPlan.chasmVisual,
          tier: spec.dungeonTier ?? 1,
          parentRealm: spec.parentRealmSlug ?? 'vaelmor',
          worldSpanMeters: (spec.worldHalfExtent || 48) * 2,
          cohesionProfileId: profile.profileId,
          expectedDungeonStyle: profile.dungeonStyle,
          storyAutomatonId: profile.dungeonStory.id,
          walkableZonesCount: dgCharter.walkableZones.length,
          hazardZonesCount: dgCharter.hazardZones.length,
        },
        featureSignature: [
          `theme:${spec.theme}`,
          `dungeon-style:${dgPlan.style}`,
          `topology:${dgPlan.topologyId}`,
          `chasm:${dgPlan.chasmVisual}`,
          `fauna:${dgPlan.faunaKit}`,
          `phenomenon:${dgPlan.phenomenon.id}`,
          `tier:${spec.dungeonTier ?? 1}`,
        ],
        tags: ['dungeon', spec.theme, dgPlan.style, dgPlan.topologyId],
        children: [blueprintNode],
      });
    }

    const eco = synthesizeRealmEcosystem(spec);
    const realmId = `frontiers:realm:${spec.slug}`;
    const ecoNode = makeNode({
      modelId: `${realmId}:ecosystem`,
      parentId: realmId,
      kind: 'ecosystem',
      partSlot: 'stage-environment',
      title: `${spec.name} — ${eco.layoutTitle}`,
      schemaType: 'EcosystemBlueprint',
      resolutionTier: tier,
      generator: 'verdantEcosystemCatalog.synthesizeRealmEcosystem',
      catalogRef: `verdant:layout:${eco.layoutId}`,
      traits: {
        layoutId: eco.layoutId,
        geomorphologyId: profile.geomorphology.id,
        floraKit: eco.floraKit,
        faunaKit: eco.faunaKit,
        phenomenon: eco.phenomenon.id,
        structures: eco.structures.length,
        floraInstances: eco.floraInstances.length,
        thermalVents: eco.thermalVents.length,
        cohesionProfileId: profile.profileId,
      },
      featureSignature: [
        `layout:${eco.layoutId}`,
        `geo:${profile.geomorphology.id}`,
        `flora:${eco.floraKit}`,
        `fauna:${eco.faunaKit}`,
        `phenomenon:${eco.phenomenon.id}`,
        `ambient:${eco.phenomenon.ambientParticleKind}`,
      ],
      tags: ['ecosystem', eco.layoutId, profile.geomorphology.id, eco.floraKit, eco.faunaKit],
    });

    return makeNode({
      modelId: realmId,
      parentId: stagePartId,
      kind: 'realm',
      partSlot: 'stage-environment',
      title: spec.name,
      schemaType: '3DModel',
      resolutionTier: tier,
      generator: spec.isProceduralCell
        ? 'verdantUniverseGenerator.synthesizeUniverseCell'
        : 'realmModelSchema.CANONICAL_REALM_SPECS',
      catalogRef: `verdant:realm:${spec.slug}`,
      traits: {
        slug: spec.slug,
        theme: spec.theme,
        cell: spec.cell.join(','),
        layoutId: eco.layoutId,
        geomorphologyId: profile.geomorphology.id,
        floraKit: eco.floraKit,
        faunaKit: eco.faunaKit,
        cohesionProfileId: profile.profileId,
        expectedFaunaKit: profile.faunaKit,
        expectedFloraKit: profile.floraKit,
        storyAutomatonId: profile.overworldStory.id,
        waterLevel: Number(spec.terrainProfile.waterLevel.toFixed(2)),
        worldSpanMeters: (spec.worldHalfExtent || 112) * 2,
      },
      featureSignature: [
        `theme:${spec.theme}`,
        `layout:${eco.layoutId}`,
        `geo:${profile.geomorphology.id}`,
        `flora:${eco.floraKit}`,
        `fauna:${eco.faunaKit}`,
        `phenomenon:${eco.phenomenon.id}`,
        `mood:${spec.ambientMood}`,
      ],
      tags: ['overworld-realm', spec.theme, eco.layoutId, profile.geomorphology.id],
      children: [ecoNode],
    });
  });

  // Register the 6 Terrain Geomorphology Models & 6 Bespoke Dungeon Topology Models
  for (const [theme, geo] of Object.entries(TERRAIN_GEOMORPHOLOGIES)) {
    stageChildren.push(
      makeNode({
        modelId: `frontiers:geomorphology:${geo.id}`,
        parentId: stagePartId,
        kind: 'geomorphology',
        partSlot: 'stage-environment',
        title: geo.title,
        schemaType: 'TerrainGeomorphology',
        resolutionTier: tier,
        generator: 'verdantUnifiedCharter.TERRAIN_GEOMORPHOLOGIES',
        catalogRef: `verdant:geomorphology:${geo.id}`,
        traits: {
          theme,
          geomorphologyId: geo.id,
          massifCount: geo.massifs.length,
          basinCount: geo.basins.length,
          ridgeFreq: geo.ridgeFreq,
          terraceSteps: geo.terraceSteps,
          hasCalderaRing: Boolean(geo.calderaRingRadius),
          waterLevelDefault: geo.waterLevelDefault,
        },
        featureSignature: [
          `geo:${geo.id}`,
          `geo-theme:${theme}`,
          `massifs:${geo.massifs.length}`,
          `basins:${geo.basins.length}`,
          `terrace:${geo.terraceSteps}`,
          `caldera:${Boolean(geo.calderaRingRadius)}`,
        ],
        tags: ['geomorphology', theme, geo.id],
      }),
    );
  }

  for (const charter of Object.values(DUNGEON_TOPOLOGY_CHARTERS)) {
    stageChildren.push(
      makeNode({
        modelId: `frontiers:dungeon-topology:${charter.topologyId}`,
        parentId: stagePartId,
        kind: 'dungeon-topology',
        partSlot: 'stage-environment',
        title: charter.title,
        schemaType: 'DungeonTopologyCharter',
        resolutionTier: tier,
        generator: 'verdantUnifiedCharter.DUNGEON_TOPOLOGY_CHARTERS',
        catalogRef: `verdant:dungeon-topology:${charter.topologyId}`,
        traits: {
          topologyId: charter.topologyId,
          style: charter.style,
          theme: charter.theme,
          walkableZones: charter.walkableZones.length,
          hazardZones: charter.hazardZones.length,
          interactableSlots: charter.interactableSlots.length,
          enemySlots: charter.enemySlots.length,
          mechanicSummary: charter.mechanicSummary,
        },
        featureSignature: [
          `topology:${charter.topologyId}`,
          `dungeon-style:${charter.style}`,
          `topology-theme:${charter.theme}`,
          `walkables:${charter.walkableZones.length}`,
          `hazards:${charter.hazardZones.length}`,
          `quest-kind:${charter.questTemplate.objective1Kind}`,
        ],
        tags: ['dungeon-topology', charter.style, charter.topologyId, charter.theme],
      }),
    );
  }

  // -------------------------------------------------------------------------
  // PART 2: character-rigs (All Portrait-Matched NPCs + All 6 Apex Fauna Kits)
  // -------------------------------------------------------------------------
  const charPartId = 'frontiers:part:character-rigs';
  const charChildren: VerdantModelNode[] = [];
  for (const { npc, realmSlug } of npcMap.values()) {
    const app = compileNpcCharacterAppearance(npc);
    charChildren.push(
      makeNode({
        modelId: `frontiers:character:${npc.id}`,
        parentId: charPartId,
        kind: 'character',
        partSlot: 'character-rigs',
        title: `${npc.name} — ${npc.title}`,
        schemaType: 'CharacterRig',
        resolutionTier: tier,
        generator:
          app.portraitArchetype === 'synthesized'
            ? 'verdantCharacterSynthesizer.synthesizeVerdantCharacter'
            : 'verdantCharacterCompiler.compileNpcCharacterAppearance',
        catalogRef: `verdant:character-archetype:${app.portraitArchetype}`,
        traits: {
          realmSlug,
          portraitArchetype: app.portraitArchetype,
          garmentStyle: app.garmentStyle,
          hairStyle: app.hairStyle,
          beardStyle: app.beardStyle,
          signatureProp: app.signatureProp,
          satchelStyle: app.satchelStyle,
          bareForearms: app.bareForearms,
          guildId: npc.guildId,
        },
        featureSignature: [
          `archetype:${app.portraitArchetype}`,
          `garment:${app.garmentStyle}`,
          `hair:${app.hairStyle}`,
          `beard:${app.beardStyle}`,
          `prop:${app.signatureProp}`,
          `satchel:${app.satchelStyle}`,
          `realm:${realmSlug}`,
        ],
        tags: ['character-rig', app.garmentStyle, app.signatureProp, realmSlug],
      }),
    );
  }

  for (const faunaKit of ALL_FAUNA_KITS) {
    const bossProfile = getBossSignatureProfile(faunaKit);
    charChildren.push(
      makeNode({
        modelId: `frontiers:fauna:${faunaKit}`,
        parentId: charPartId,
        kind: 'fauna',
        partSlot: 'character-rigs',
        title: `Apex Morphology · ${bossProfile.phase2Title}`,
        schemaType: 'CreatureRig',
        resolutionTier: tier,
        generator: 'rpgLogic.getBossSignatureProfile',
        catalogRef: `verdant:fauna-kit:${faunaKit}`,
        traits: {
          faunaKit,
          archetypeTitle: bossProfile.archetypeTitle,
          phase2Title: bossProfile.phase2Title,
          signatureMove: bossProfile.signatureMoveName,
          projectilePattern: bossProfile.projectilePattern,
          projectileCount: bossProfile.projectileCount,
          phase2SpeedBoost: bossProfile.phase2SpeedBoost,
          slamRadiusBonus: bossProfile.slamRadiusBonus,
        },
        featureSignature: [
          `fauna-kit:${faunaKit}`,
          `boss-archetype:${bossProfile.archetypeTitle}`,
          `boss-phase2:${bossProfile.phase2Title}`,
          `boss-move:${bossProfile.signatureMoveName}`,
          `pattern:${bossProfile.projectilePattern}`,
          `burst:${bossProfile.projectileCount}`,
          `speed:${bossProfile.phase2SpeedBoost}`,
        ],
        tags: ['fauna-rig', 'apex-boss', faunaKit, bossProfile.projectilePattern],
      }),
    );
  }

  // Register all 36 Biome-Cohesive Monster Species (6 Biomes x 6 Combat Archetypes)
  for (const profile of Object.values(WORLD_DIFFERENTIATION_PROFILES)) {
    for (const species of Object.values(profile.monsterRoster)) {
      charChildren.push(
        makeNode({
          modelId: `frontiers:monster:${profile.theme}:${species.archetype}`,
          parentId: charPartId,
          kind: 'monster-species',
          partSlot: 'character-rigs',
          title: `${species.speciesName} (${profile.domainLabel})`,
          schemaType: 'MonsterSpeciesModel',
          resolutionTier: tier,
          generator: 'verdantUnifiedCharter.WORLD_DIFFERENTIATION_PROFILES',
          catalogRef: `verdant:monster-species:${profile.theme}:${species.archetype}`,
          traits: {
            theme: profile.theme,
            faunaKit: profile.faunaKit,
            archetype: species.archetype,
            speciesName: species.speciesName,
            ecologicalNiche: species.ecologicalNiche,
            tacticalSignature: species.tacticalSignature,
            baseHp: species.baseHp,
            cohesionProfileId: profile.profileId,
          },
          featureSignature: [
            `species:${profile.theme}:${species.archetype}`,
            `archetype:${species.archetype}`,
            `fauna-kit:${profile.faunaKit}`,
            `niche:${species.ecologicalNiche}`,
            `tactic:${species.tacticalSignature}`,
          ],
          tags: ['monster-species', profile.theme, species.archetype, profile.faunaKit],
        }),
      );
    }
  }

  // -------------------------------------------------------------------------
  // PART 3: hero-props (Field Gear + 6 Biome Relic Archetypes + Active Relics)
  // -------------------------------------------------------------------------
  const propsPartId = 'frontiers:part:hero-props';
  const propChildren: VerdantModelNode[] = [];
  for (const gear of GEAR_LOADOUT) {
    propChildren.push(
      makeNode({
        modelId: `frontiers:gear:${gear.id}`,
        parentId: propsPartId,
        kind: 'gear',
        partSlot: 'hero-props',
        title: gear.name,
        schemaType: 'ToolArtifact',
        resolutionTier: tier,
        generator: 'worldData.GEAR_LOADOUT',
        catalogRef: `verdant:gear:${gear.id}`,
        traits: {
          slotKey: gear.slotKey,
          roleClue: gear.roleClue,
          damage: gear.damage,
          range: gear.range,
          cooldownSec: gear.cooldownSec,
          staminaCost: gear.staminaCost,
        },
        featureSignature: [
          `gear:${gear.id}`,
          `role:${gear.roleClue}`,
          `range:${Math.round(gear.range)}`,
          `accent:${gear.accentHex}`,
        ],
        tags: ['hero-prop', 'waywright-gear', gear.id],
      }),
    );
  }

  for (const theme of Object.keys(BIOME_RELIC_ARCHETYPES) as RealmThemeId[]) {
    const arch = BIOME_RELIC_ARCHETYPES[theme];
    propChildren.push(
      makeNode({
        modelId: `frontiers:relic-archetype:${theme}`,
        parentId: propsPartId,
        kind: 'relic-archetype',
        partSlot: 'hero-props',
        title: `${arch.forgeSchool} · ${arch.perkLabel}`,
        schemaType: 'RelicArchetype',
        resolutionTier: tier,
        generator: 'verdantRelicCatalog.BIOME_RELIC_ARCHETYPES',
        catalogRef: arch.catalogId,
        traits: {
          theme,
          forgeSchool: arch.forgeSchool,
          perkId: arch.perkId,
          perkLabel: arch.perkLabel,
          primaryBonus: arch.primaryBonusKind,
          secondaryBonus: arch.secondaryBonusKind,
          resonanceHz: arch.resonanceHz,
        },
        featureSignature: [
          `relic-theme:${theme}`,
          `perk:${arch.perkId}`,
          `primary-stat:${arch.primaryBonusKind}`,
          `secondary-stat:${arch.secondaryBonusKind}`,
          `hz:${arch.resonanceHz}`,
        ],
        tags: ['relic-archetype', theme, arch.perkId],
      }),
    );
  }

  for (const relic of activeRelics) {
    propChildren.push(
      makeNode({
        modelId: `frontiers:relic:${relic.id}`,
        parentId: propsPartId,
        kind: 'relic',
        partSlot: 'hero-props',
        title: relic.name,
        schemaType: 'RelicArtifact',
        resolutionTier: tier,
        generator: 'verdantRelicCatalog.synthesizeBiomeRelic',
        catalogRef: relic.catalogId ?? `verdant:relic:${relic.theme ?? 'citadel-highlands'}`,
        traits: {
          origin: relic.origin,
          bonusKind: relic.bonusKind,
          bonusValue: relic.bonusValue,
          rarity: relic.rarity ?? 'Chartered',
          perkId: relic.perkId ?? 'meridian-ward',
          equipped: relic.equipped,
        },
        featureSignature: [
          `relic-theme:${relic.theme ?? 'citadel-highlands'}`,
          `perk:${relic.perkId ?? 'meridian-ward'}`,
          `bonus:${relic.bonusKind}`,
          `rarity:${relic.rarity ?? 'Chartered'}`,
        ],
        tags: ['active-relic', relic.bonusKind, relic.rarity ?? 'Chartered'],
      }),
    );
  }

  // -------------------------------------------------------------------------
  // PART 4: surface-materials (PBR Palettes for Realms & Dungeons)
  // -------------------------------------------------------------------------
  const matPartId = 'frontiers:part:surface-materials';
  const matChildren: VerdantModelNode[] = realms.map((spec) => {
    const mats = spec.materials;
    const skyRgbKey = spec.skyFallbackRgb.map((c) => Math.round(c * 255)).join(',');
    const surfaceMode = spec.isDungeon ? `cavern:${spec.dungeonStyle ?? 'vault'}` : `overworld:${spec.theme}`;
    return makeNode({
      modelId: `frontiers:material:${spec.slug}`,
      parentId: matPartId,
      kind: 'material-palette',
      partSlot: 'surface-materials',
      title: `${spec.name} PBR Material Atlas`,
      schemaType: 'MaterialPalette',
      resolutionTier: tier,
      generator: 'verdantCatalogCompiler.PolyHavenPbrAtlas',
      catalogRef: `verdant:pbr-atlas:${spec.slug}`,
      traits: {
        terrain: mats.terrain,
        masonry: mats.masonry,
        road: mats.road,
        timber: mats.timber,
        surfaceMode,
        pbrChannels: 3,
        waterLevel: Number(spec.terrainProfile.waterLevel.toFixed(2)),
        skyRgb: skyRgbKey,
      },
      featureSignature: [
        `terrain:${mats.terrain}`,
        `masonry:${mats.masonry}`,
        `road:${mats.road}`,
        `timber:${mats.timber}`,
        `surface-mode:${surfaceMode}`,
        `sky:${skyRgbKey}`,
      ],
      tags: ['surface-materials', 'pbr-atlas', spec.theme, spec.isDungeon ? 'dungeon' : 'overworld'],
    });
  });

  // -------------------------------------------------------------------------
  // PART 5: spatial-acoustics (20 Orchestral Scores + 7 Acoustic Foley Profiles)
  // -------------------------------------------------------------------------
  const audioPartId = 'frontiers:part:spatial-acoustics';
  const audioChildren: VerdantModelNode[] = [
    ...SOUNDTRACK_CATALOG.map((score) =>
      makeNode({
        modelId: `frontiers:score:${score.id}`,
        parentId: audioPartId,
        kind: 'score',
        partSlot: 'spatial-acoustics',
        title: score.title,
        schemaType: 'MusicComposition',
        resolutionTier: tier,
        generator: 'verdantScoreSchema.SOUNDTRACK_CATALOG',
        catalogRef: `verdant:score:${score.id}`,
        traits: {
          realmSlug: score.realmSlug,
          mode: score.mode,
          meter: score.meter ?? '4/4',
          category: score.category ?? 'exploration',
          bpm: score.bpm,
          rootMidi: score.rootMidi,
          foleyProfile: score.foleyProfile,
          reverbDecaySec: score.reverbDecaySec,
          sections: 1 + (score.sectionBMelody ? 1 : 0) + (score.sectionCMelody ? 1 : 0),
        },
        featureSignature: [
          `mode:${score.mode}`,
          `meter:${score.meter ?? '4/4'}`,
          `category:${score.category ?? 'exploration'}`,
          `foley:${score.foleyProfile}`,
          `tempo-band:${score.bpm < 84 ? 'slow' : score.bpm < 104 ? 'moderate' : 'driving'}`,
          `root-midi:${score.rootMidi}`,
        ],
        tags: ['orchestral-score', score.mode, score.meter ?? '4/4', score.foleyProfile],
      }),
    ),
    ...ALL_FOLEY_PROFILES.map((fp) =>
      makeNode({
        modelId: `frontiers:foley:${fp.id}`,
        parentId: audioPartId,
        kind: 'foley-profile',
        partSlot: 'spatial-acoustics',
        title: fp.title,
        schemaType: 'AcousticProfile',
        resolutionTier: tier,
        generator: 'verdantAudioEngine.BiomeFoleySynthesizer',
        catalogRef: `verdant:foley:${fp.id}`,
        traits: {
          foleyProfile: fp.id,
          binauralWasmItd: true,
        },
        featureSignature: fp.signature,
        tags: ['spatial-foley', fp.id],
      }),
    ),
  ];

  // -------------------------------------------------------------------------
  // PART 6: visual-identity (Procedural SVG Relic Crests & Biome Visual Kits)
  // -------------------------------------------------------------------------
  const visualPartId = 'frontiers:part:visual-identity';
  const visualChildren: VerdantModelNode[] = (
    Object.keys(BIOME_RELIC_ARCHETYPES) as RealmThemeId[]
  ).map((theme) => {
    const arch = BIOME_RELIC_ARCHETYPES[theme];
    const sampleSvg = renderRelicSigilSvgDataUrl(theme, 'Sovereign', hashModelSeed(theme));
    return makeNode({
      modelId: `frontiers:visual:crest:${theme}`,
      parentId: visualPartId,
      kind: 'visual-crest',
      partSlot: 'visual-identity',
      title: `${arch.forgeSchool} Procedural Crest`,
      schemaType: 'VisualIdentity',
      resolutionTier: tier,
      generator: 'verdantRelicCatalog.renderRelicSigilSvgDataUrl',
      catalogRef: `verdant:visual-crest:${theme}`,
      traits: {
        theme,
        sigilStroke: arch.sigilStroke,
        sigilAccent: arch.sigilAccent,
        sigilBg: arch.sigilBg,
        svgBytes: sampleSvg.length,
        proceduralVector: true,
      },
      featureSignature: [
        `crest-theme:${theme}`,
        `stroke:${arch.sigilStroke}`,
        `accent:${arch.sigilAccent}`,
        `bg:${arch.sigilBg}`,
      ],
      tags: ['visual-identity', 'svg-crest', theme],
    });
  });

  // Register 5 Bespoke Multi-Media Prologue Cinematic Scenes under visual-identity
  for (const act of PROLOGUE_CINEMATIC_ACTS) {
    visualChildren.push(
      makeNode({
        modelId: `frontiers:prologue:${act.actId}`,
        parentId: visualPartId,
        kind: 'prologue-act',
        partSlot: 'visual-identity',
        title: `${act.chapterNumeral}: ${act.title}`,
        schemaType: 'CinematicPrologueScene',
        resolutionTier: tier,
        generator: 'verdantJourneyModel.PROLOGUE_CINEMATIC_ACTS',
        catalogRef: `verdant:prologue-scene:${act.actId}`,
        traits: {
          actIndex: act.actIndex,
          chapterNumeral: act.chapterNumeral,
          subtitleLocation: act.subtitleLocation,
          durationMs: act.durationMs,
          captionCount: act.captions.length,
          hasClosedCaptions: act.captions.length >= 2,
          hasSoundDesignCaptions: act.captions.some((c) => Boolean(c.ambientSoundCue)),
          hasBespokeArtwork: act.imageUrl.length > 0,
          vfxPreset: act.vfxPreset,
          audioCueLabel: act.audioCueLabel,
          live3DReveal: Boolean(act.live3DReveal),
          interactiveOathBeat: Boolean(act.interactiveOathBeat),
          primaryRealmSlug: act.linkedRealmSlugs[0] ?? 'vaelmor',
          primaryNpcId: act.linkedNpcIds[0] ?? 'npc-orenna',
        },
        featureSignature: [
          `prologue-scene:${act.actId}`,
          `vfx:${act.vfxPreset}`,
          `audio-cue:${act.audioCueLabel}`,
          `captions:${act.captions.length}`,
          `live-3d-reveal:${Boolean(act.live3DReveal)}`,
          `camera-focus:${act.linkedRealmSlugs[0] ?? 'vaelmor'}`,
        ],
        tags: [
          'prologue-cinematic',
          'multi-media',
          'closed-captioned',
          act.vfxPreset,
          act.live3DReveal ? 'live-3d-reveal' : 'painted-cinema',
        ],
      }),
    );
  }

  // -------------------------------------------------------------------------
  // PART 7: cognitive-language (Quests with Anti-Trope Audit + Guild Charters)
  // -------------------------------------------------------------------------
  const langPartId = 'frontiers:part:cognitive-language';
  const langChildren: VerdantModelNode[] = [
    ...Array.from(questMap.values()).map((q) => {
      const novelty = auditAntiTropeNovelty(
        `${q.title} ${q.summary} ${q.motif}`,
        ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
        [],
      );
      return makeNode({
        modelId: `frontiers:quest:${q.id}`,
        parentId: langPartId,
        kind: 'quest',
        partSlot: 'cognitive-language',
        title: q.title,
        schemaType: 'NarrativeQuest',
        resolutionTier: tier,
        generator: q.isEmergent ? 'verdantMcpHost.generateQuestline' : 'worldData.INITIAL_QUESTS',
        catalogRef: `verdant:quest:${q.id}`,
        traits: {
          motif: q.motif,
          regionId: q.regionId,
          guildId: q.guildId,
          objectivesCount: q.objectives.length,
          renownReward: q.renownReward,
          noveltyVerdict: novelty.verdict,
          clicheHitsCount: novelty.clicheHits.length,
          distinctiveSignalsCount: novelty.distinctiveSignals.length,
        },
        featureSignature: [
          `motif:${q.motif}`,
          `region:${q.regionId}`,
          `guild:${q.guildId}`,
          `novelty:${novelty.verdict}`,
          ...q.objectives.map((o) => `obj-kind:${o.kind}`),
        ],
        tags: ['quest', q.regionId, novelty.verdict],
      });
    }),
    ...guilds.map((g) =>
      makeNode({
        modelId: `frontiers:guild:${g.id}`,
        parentId: langPartId,
        kind: 'guild',
        partSlot: 'cognitive-language',
        title: g.name,
        schemaType: 'OrganizationCharter',
        resolutionTier: tier,
        generator: 'worldData.INITIAL_GUILDS',
        catalogRef: `verdant:guild:${g.id}`,
        traits: {
          homeRegion: g.homeRegion,
          accentHex: g.accentHex,
          prosperity: g.prosperity,
          motto: g.motto,
        },
        featureSignature: [
          `guild:${g.id}`,
          `home:${g.homeRegion}`,
          `accent:${g.accentHex}`,
        ],
        tags: ['guild-charter', g.homeRegion],
      }),
    ),
    ...getAllStoryAutomata().map((auto) => {
      const report = verifyStoryAutomaton(auto);
      return makeNode({
        modelId: `frontiers:story:${auto.id}`,
        parentId: langPartId,
        kind: 'story-automaton',
        partSlot: 'cognitive-language',
        title: auto.title,
        schemaType: 'StoryAutomaton',
        resolutionTier: tier,
        generator: 'verdantUnifiedCharter.StoryAutomaton',
        catalogRef: `verdant:story-automaton:${auto.id}`,
        traits: {
          domainId: auto.domainId,
          motif: auto.motif,
          statesCount: auto.states.length,
          edgesCount: auto.edges.length,
          reachableFromStart: report.reachableFromStart,
          terminalReachable: report.terminalReachable,
          deadlockFree: report.deadlockFree,
          conservationClosed: report.conservationClosed,
          verifiedPassed: report.passed,
        },
        featureSignature: [
          `story:${auto.id}`,
          `story-domain:${auto.domainId}`,
          `story-motif:${auto.motif}`,
          `conservation:${report.conservationClosed ? 'closed' : 'open'}`,
          `deadlock-free:${report.deadlockFree}`,
        ],
        tags: ['story-automaton', auto.domainId, report.passed ? 'verified' : 'unverified'],
      });
    }),
    ...DIRECTED_JOURNEY_MILESTONES.map((ms) =>
      makeNode({
        modelId: `frontiers:journey:milestone:${ms.id}`,
        parentId: langPartId,
        kind: 'journey-milestone',
        partSlot: 'cognitive-language',
        title: `Step ${ms.stepNumber} · ${ms.title}`,
        schemaType: 'DirectedJourneyMilestone',
        resolutionTier: tier,
        generator: 'verdantJourneyModel.DIRECTED_JOURNEY_MILESTONES',
        catalogRef: `verdant:journey-milestone:${ms.id}`,
        traits: {
          stepNumber: ms.stepNumber,
          actLabel: ms.actLabel,
          keybindBadge: ms.keybindBadge,
          linkedQuestId: ms.linkedQuestId ?? '',
          hasStoryContext: ms.storyContext.length > 20,
          hasControlHint: ms.controlHint.length > 15,
        },
        featureSignature: [
          `milestone:${ms.id}`,
          `act:${ms.actLabel}`,
          `step:${ms.stepNumber}`,
          `keybind:${ms.keybindBadge}`,
        ],
        tags: ['gamer-journey', 'directed-onboarding', ms.actLabel.toLowerCase()],
      }),
    ),
    (() => {
      const journeyAudit = verifyGamerJourneyGraph();
      return makeNode({
        modelId: 'frontiers:journey:experience-flow',
        parentId: langPartId,
        kind: 'journey-flow',
        partSlot: 'cognitive-language',
        title: 'Frontiers & Foundations — Menu-to-Gameplay Gamer Journey Graph',
        schemaType: 'GamerJourneyStateMachine',
        resolutionTier: tier,
        generator: 'verdantJourneyModel.JOURNEY_FLOW_STATES',
        catalogRef: 'verdant:journey-flow:canonical',
        traits: {
          totalStates: JOURNEY_FLOW_STATES.length,
          totalEdges: JOURNEY_FLOW_EDGES.length,
          reachableStates: journeyAudit.reachableStates,
          prologueActCount: journeyAudit.prologueActCount,
          totalCaptionCues: journeyAudit.totalCaptionCues,
          milestoneCount: journeyAudit.milestoneCount,
          fieldManualSectionCount: journeyAudit.fieldManualSectionCount,
          oathChoiceCount: WAYWRIGHT_OATH_CHOICES.length,
          inWorldPrologueOnly: journeyAudit.inWorldPrologueOnly,
          hasLive3DRevealScene: journeyAudit.hasLive3DRevealScene,
          hasNewGameToPrologueEdge: journeyAudit.hasNewGameToPrologueEdge,
          hasSaveSlotResumeEdge: journeyAudit.hasSaveSlotResumeEdge,
          verifiedPassed: journeyAudit.passed,
        },
        featureSignature: [
          `journey-states:${JOURNEY_FLOW_STATES.length}`,
          `journey-edges:${JOURNEY_FLOW_EDGES.length}`,
          `prologue-scenes:${journeyAudit.prologueActCount}`,
          `directed-milestones:${journeyAudit.milestoneCount}`,
          `in-world-prologue:${journeyAudit.inWorldPrologueOnly}`,
          `journey-verified:${journeyAudit.passed}`,
        ],
        tags: ['gamer-journey', 'ux-architecture', journeyAudit.passed ? 'verified' : 'unverified'],
      });
    })(),
    makeNode({
      modelId: 'frontiers:journey:field-manual',
      parentId: langPartId,
      kind: 'field-manual',
      partSlot: 'cognitive-language',
      title: 'Waywright Field Manual (Out-of-World Gameplay Reference)',
      schemaType: 'FieldManualReference',
      resolutionTier: tier,
      generator: 'verdantJourneyModel.FIELD_MANUAL_SECTIONS',
      catalogRef: 'verdant:journey:field-manual',
      traits: {
        sectionCount: FIELD_MANUAL_SECTIONS.length,
        totalEntries: FIELD_MANUAL_SECTIONS.reduce((acc, s) => acc + s.entries.length, 0),
        separatedFromPrologue: true,
      },
      featureSignature: [
        `manual-sections:${FIELD_MANUAL_SECTIONS.length}`,
        ...FIELD_MANUAL_SECTIONS.map((s) => `manual-tab:${s.id}`),
      ],
      tags: ['field-manual', 'gameplay-reference', 'ux-separation'],
    }),
  ];

  // -------------------------------------------------------------------------
  // PART 8: runtime-frameworks (Engine & Simulation Sub-Models)
  // -------------------------------------------------------------------------
  const fwPartId = 'frontiers:part:runtime-frameworks';
  const frameworkSpecs: Array<{
    id: string;
    title: string;
    generator: string;
    traits: Record<string, string | number | boolean>;
    sig: string[];
  }> = [
    {
      id: 'verdant-uorc-wasm',
      title: 'Verdant UORC WebAssembly Kernel (176 Exports · v2.7.0 M16)',
      generator: 'public/verdant/verdant-uorc.wasm',
      traits: { exports: 176, nativeVsmManagers: 13, frontiersManagers: 8, totalVsmManagers: 21, canonicalPartSlots: 8, blankStageOnly: true },
      sig: ['fw:wasm-kernel', 'vsm:21-managers', 'parts:8-cognitive', 'release:v2.7.0-m16'],
    },
    {
      id: 'webgl2-csm-ggx',
      title: 'Verdant WebGL2 3-Pass CSM / GGX / ACES HD Renderer',
      generator: 'public/verdant/scene-hd-renderer.mjs',
      traits: { csmCascades: 4, toneMapper: 'ACES', casSharpening: true, pbrChannels: 3 },
      sig: ['fw:webgl2-hd', 'lighting:csm-ggx-aces', 'shader:pbr-atlas'],
    },
    {
      id: 'dynamic-geometry-batcher',
      title: 'Zero-GC High-Definition Dynamic Geometry Batcher',
      generator: 'src/verdant/verdantDynamicGeometry.ts',
      traits: { smoothNormalOrganicSkin: true, maxVerts: 76000, biomeAtmosphere: true, enemyArchetypes: 6, topologyHazards: true },
      sig: ['fw:dynamic-batcher', 'shading:smooth-normal-mat4', 'fx:biome-ambience', 'archetypes:6'],
    },
    {
      id: 'hydro-terrain-physics',
      title: 'Continuous Mountain-Range & Hydrodynamic Water Physics',
      generator: 'src/verdant/verdantEnvironmentPhysics.ts',
      traits: { slopeClimbing: true, wadingSwimPostures: true, terrainClippedWaterQuads: true, geomorphologies: 6 },
      sig: ['fw:hydro-physics', 'terrain:6-geomorphologies', 'water:wade-swim'],
    },
    {
      id: 'spring-arm-controls',
      title: 'Velocity-Damped Movement & Ray-Marched Spring-Arm Camera',
      generator: 'src/verdant/verdantControls.ts',
      traits: { coyoteTime: true, inputBuffering: true, softTargetLock: true, wallOcclusionAvoidance: true },
      sig: ['fw:controls', 'camera:spring-arm', 'combat:input-buffer'],
    },
    {
      id: 'prism-stitch-custody',
      title: 'Prism SHA-256 Content Custody & Stitch 2-of-3 Reed-Solomon',
      generator: 'src/verdant/prism-id.mjs',
      traits: { contentAddressing: 'kappa-sha256', reedSolomonShards: 3, recoveryThreshold: 2 },
      sig: ['fw:prism-stitch', 'custody:kappa-sha256', 'resilience:stitch-2-of-3'],
    },
    {
      id: 'multiplayer-expedition-protocol',
      title: 'Room- & Realm-Scoped Server-Authoritative Co-op WebSocket Protocol',
      generator: 'src/game/multiplayerState.ts',
      traits: {
        transport: 'ws:/ws/realm',
        roomIsolation: true,
        realmScoping: true,
        sharedEnemyCombat: true,
        coopLanternHealing: true,
        worldPings3D: true,
        partySummonWarp: true,
      },
      sig: [
        'fw:multiplayer-coop',
        'scope:room-and-realm',
        'combat:shared-authoritative',
        'support:lantern-mend-pings-summon',
      ],
    },
    {
      id: 'multi-slot-save-charter',
      title: '3-Slot Expedition Save Ledger & Legacy Migration Protocol',
      generator: 'src/game/saveSlotStorage.ts',
      traits: {
        maxSaveSlots: 3,
        storageVersion: 4,
        supportsCreateContinueRenameDelete: true,
        legacyV3AutoMigration: true,
        tracksPrologueCompletion: true,
        tracksPlayTimeAndChapter: true,
      },
      sig: [
        'fw:save-slots-v4',
        'slots:3-expeditions',
        'migration:v3-to-v4',
        'prologue:persisted-per-slot',
      ],
    },
  ];
  const mpSession: MultiplayerSessionModelInput = input.multiplayer ?? {
    roomCode: 'MERIDIAN-OPEN',
    activeRealmSlug: realms[0]?.slug ?? 'vaelmor',
    activeRealmName: realms[0]?.name ?? 'The Shattered Meridian of Vaelmor',
    onlinePlayers: 1,
    sameRealmAllies: 0,
    activePings: 0,
    activeSummonRealm: null,
  };
  const fwChildren: VerdantModelNode[] = [
    ...frameworkSpecs.map((fw) =>
      makeNode({
        modelId: `frontiers:framework:${fw.id}`,
        parentId: fwPartId,
        kind: 'framework',
        partSlot: 'runtime-frameworks',
        title: fw.title,
        schemaType: 'RuntimeFramework',
        resolutionTier: tier,
        generator: fw.generator,
        catalogRef: `verdant:framework:${fw.id}`,
        traits: fw.traits,
        featureSignature: fw.sig,
        tags: ['runtime-framework', fw.id],
      }),
    ),
    makeNode({
      modelId: 'frontiers:expedition:active-session',
      parentId: fwPartId,
      kind: 'expedition-session',
      partSlot: 'runtime-frameworks',
      title: `Expedition Session · Room ${mpSession.roomCode}`,
      schemaType: 'CoopExpeditionSession',
      resolutionTier: tier,
      generator: 'src/game/multiplayerClient.ts',
      catalogRef: `verdant:expedition-room:${mpSession.roomCode}`,
      traits: {
        roomCode: mpSession.roomCode,
        activeRealmSlug: mpSession.activeRealmSlug,
        activeRealmName: mpSession.activeRealmName,
        onlinePlayers: mpSession.onlinePlayers,
        sameRealmAllies: mpSession.sameRealmAllies,
        activePings: mpSession.activePings,
        hasActiveSummon: Boolean(mpSession.activeSummonRealm),
      },
      featureSignature: [
        `room:${mpSession.roomCode}`,
        `realm:${mpSession.activeRealmSlug}`,
        `party-mode:${mpSession.onlinePlayers > 1 ? 'coop-fellowship' : 'solo-open'}`,
        `realm-scoped:true`,
      ],
      tags: ['multiplayer', 'expedition-session', mpSession.roomCode, mpSession.activeRealmSlug],
    }),
    ...Object.values(WORLD_DIFFERENTIATION_PROFILES).map((prof) =>
      makeNode({
        modelId: `frontiers:profile:${prof.theme}`,
        parentId: fwPartId,
        kind: 'differentiation-profile',
        partSlot: 'runtime-frameworks',
        title: `${prof.domainLabel} Differentiation Charter`,
        schemaType: 'WorldDifferentiationProfile',
        resolutionTier: tier,
        generator: 'verdantUnifiedCharter.WORLD_DIFFERENTIATION_PROFILES',
        catalogRef: `verdant:differentiation-profile:${prof.profileId}`,
        traits: {
          profileId: prof.profileId,
          theme: prof.theme,
          geomorphologyId: prof.geomorphology.id,
          dungeonStyle: prof.dungeonStyle,
          dungeonTopologyId: prof.dungeonTopologyId,
          faunaKit: prof.faunaKit,
          floraKit: prof.floraKit,
          preferredMode: prof.preferredMode,
          foleyProfile: prof.foleyProfile,
          guildId: prof.guildId,
          monsterSpeciesCount: Object.keys(prof.monsterRoster).length,
          profileKappaHex: prof.profileKappaHex,
        },
        featureSignature: [
          `profile:${prof.profileId}`,
          `geo:${prof.geomorphology.id}`,
          `topology:${prof.dungeonTopologyId}`,
          `fauna:${prof.faunaKit}`,
          `flora:${prof.floraKit}`,
          `mode:${prof.preferredMode}`,
          `foley:${prof.foleyProfile}`,
        ],
        tags: ['differentiation-profile', prof.theme, prof.dungeonTopologyId],
      }),
    ),
  ];

  // Assemble the 8 Canonical Part Container Nodes
  const partMap: Record<VerdantPartSlot, VerdantModelNode[]> = {
    'stage-environment': stageChildren,
    'character-rigs': charChildren,
    'hero-props': propChildren,
    'surface-materials': matChildren,
    'spatial-acoustics': audioChildren,
    'visual-identity': visualChildren,
    'cognitive-language': langChildren,
    'runtime-frameworks': fwChildren,
  };

  const partNodes: VerdantModelNode[] = VERDANT_PART_SLOTS.map((slot) => {
    const children = partMap[slot];
    const partId = `frontiers:part:${slot}`;
    const childSigTokens = Array.from(
      new Set(children.flatMap((c) => c.featureSignature).slice(0, 24)),
    );
    return makeNode({
      modelId: partId,
      parentId: rootId,
      kind: 'part',
      partSlot: slot,
      title: PART_TITLES[slot],
      schemaType: 'VerdantCognitivePart',
      resolutionTier: tier,
      generator: 'verdantModelOfModels.buildFrontiersModelOfModels',
      catalogRef: `verdant:cognitive-part:${slot}`,
      traits: {
        partSlot: slot,
        childCount: children.length,
        uniformApi: true,
      },
      featureSignature: [`part:${slot}`, ...childSigTokens.slice(0, 8)],
      tags: ['verdant-part', slot],
      children,
    });
  });

  // Root Model-of-Models Node
  const root = makeNode({
    modelId: rootId,
    parentId: null,
    kind: 'root',
    partSlot: 'root',
    title: 'Frontiers and Foundations — Unified Verdant Model of Models',
    schemaType: 'VideoGameModelOfModels',
    resolutionTier: tier,
    generator: 'verdantModelOfModels.buildFrontiersModelOfModels',
    catalogRef: 'verdant:game:frontiers-and-foundations',
    traits: {
      architecture: 'single-model-of-models',
      cognitiveParts: VERDANT_PART_SLOTS.length,
      overworldRealms: realms.filter((r) => !r.isDungeon).length,
      dungeons: realms.filter((r) => r.isDungeon).length,
      differentiationProfiles: Object.keys(WORLD_DIFFERENTIATION_PROFILES).length,
      dungeonTopologies: Object.keys(DUNGEON_TOPOLOGY_CHARTERS).length,
      geomorphologies: Object.keys(TERRAIN_GEOMORPHOLOGIES).length,
      monsterSpecies: Object.values(WORLD_DIFFERENTIATION_PROFILES).reduce(
        (acc, p) => acc + Object.keys(p.monsterRoster).length,
        0,
      ),
      storyAutomata: getAllStoryAutomata().length,
      characters: npcMap.size,
      orchestralScores: SOUNDTRACK_CATALOG.length,
      uniformRefinementApi: true,
    },
    featureSignature: [
      'model-of-models:v1',
      ...VERDANT_PART_SLOTS.map((s) => `part:${s}`),
    ],
    tags: ['frontiers-and-foundations', 'model-of-models', 'verdant-generative'],
    children: partNodes,
  });

  recomputeAggregatedScores(root);
  return root;
}

/**
 * Recursively updates parent container `definitionScore`, `resolutionTier`,
 * and deterministic sync digests from children upward so the Root Model
 * always reflects the exact state of every sub-model.
 */
export function recomputeAggregatedScores(node: VerdantModelNode): void {
  if (node.children.length === 0) {
    node.definitionScore = computeNodeDefinitionScore(
      node.resolutionTier,
      Object.keys(node.generativeGenome.traits).length,
      node.featureSignature.length,
      node.generativeGenome.refinementPass,
    );
    node.semanticVector = computeSemanticVector({
      modelId: node.modelId,
      partSlot: node.partSlot,
      resolutionTier: node.resolutionTier,
      traits: node.generativeGenome.traits,
      featureSignature: node.featureSignature,
      seed: node.generativeGenome.seed,
    });
    node.kappaDigest = computeSyncDigest(
      JSON.stringify({
        id: node.modelId,
        v: node.version,
        t: node.resolutionTier,
        s: node.definitionScore,
        sig: node.featureSignature,
        vec: node.semanticVector,
        tr: node.generativeGenome.traits,
      }),
    );
    return;
  }

  for (const child of node.children) {
    recomputeAggregatedScores(child);
  }

  const avgScore =
    node.children.reduce((acc, c) => acc + c.definitionScore, 0) / node.children.length;
  const avgTier =
    node.children.reduce((acc, c) => acc + c.resolutionTier, 0) / node.children.length;
  node.definitionScore = Math.round(avgScore * 10) / 10;
  node.resolutionTier = Math.max(
    1,
    Math.min(4, Math.round(avgTier)),
  ) as VerdantResolutionTier;
  node.semanticVector = computeVectorCentroid(node.children.map((c) => c.semanticVector));
  node.kappaDigest = computeSyncDigest(
    JSON.stringify({
      id: node.modelId,
      v: node.version,
      t: node.resolutionTier,
      s: node.definitionScore,
      vec: node.semanticVector,
      kids: node.children.map((c) => c.kappaDigest),
    }),
  );
}

export function computeVectorCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const sums = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const v of vectors) {
    for (let i = 0; i < 8; i++) {
      sums[i] += v[i] ?? 0;
    }
  }
  return sums.map((s) => Math.round((s / vectors.length) * 1000) / 1000);
}

/**
 * Cryptographically seals the Root Model-of-Models (and its 8 Cognitive Parts)
 * using Prism `kappa()` (SHA-256 canonical content addressing).
 */
export async function sealModelOfModelsKappa(root: VerdantModelNode): Promise<string> {
  recomputeAggregatedScores(root);
  const graph = buildModelRelationGraph(root);
  for (const part of root.children) {
    part.kappaDigest = await kappa({
      modelId: part.modelId,
      version: part.version,
      resolutionTier: part.resolutionTier,
      definitionScore: Math.round(part.definitionScore * 10),
      centroidPermille: part.semanticVector.map((v) => Math.round(v * 1000)),
      children: part.children.map((c) => ({
        id: c.modelId,
        v: c.version,
        tier: c.resolutionTier,
        score: Math.round(c.definitionScore * 10),
        digest: c.kappaDigest,
      })),
    });
  }
  root.kappaDigest = await kappa({
    modelId: root.modelId,
    version: root.version,
    resolutionTier: root.resolutionTier,
    definitionScore: Math.round(root.definitionScore * 10),
    graphEdges: graph.edges.length,
    crossPartEdges: graph.crossPartEdges,
    parts: root.children.map((p) => ({
      slot: p.partSlot,
      digest: p.kappaDigest,
      count: p.children.length,
    })),
  });
  return root.kappaDigest;
}

export function flattenModelTree(root: VerdantModelNode): VerdantModelNode[] {
  const out: VerdantModelNode[] = [];
  const visit = (n: VerdantModelNode) => {
    out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

export function getModelById(
  root: VerdantModelNode,
  modelId: string,
): VerdantModelNode | null {
  if (root.modelId === modelId) return root;
  for (const child of root.children) {
    const found = getModelById(child, modelId);
    if (found) return found;
  }
  return null;
}

export function listModelsByPart(
  root: VerdantModelNode,
  partSlot: VerdantPartSlot,
): VerdantModelNode[] {
  const partNode = root.children.find((c) => c.partSlot === partSlot);
  if (!partNode) return [];
  return flattenModelTree(partNode).filter((n) => n.kind !== 'part');
}

export function listModelsByKind(
  root: VerdantModelNode,
  kind: VerdantModelKind,
): VerdantModelNode[] {
  return flattenModelTree(root).filter((n) => n.kind === kind);
}

/**
 * Derives the cross-part semantic dependency graph across all models in the
 * unified Model-of-Models tree and audits every link for dangling references.
 */
export function buildModelRelationGraph(root: VerdantModelNode): VerdantModelGraph {
  const all = flattenModelTree(root);
  const byId = new Map<string, VerdantModelNode>();
  for (const n of all) byId.set(n.modelId, n);

  const edges: VerdantModelEdge[] = [];
  const danglingEdges: Array<{ fromId: string; toId: string; relation: VerdantEdgeRelation }> = [];
  const seen = new Set<string>();

  const link = (from: VerdantModelNode, toId: string, relation: VerdantEdgeRelation) => {
    if (!toId || from.modelId === toId) return;
    const key = `${from.modelId}|${relation}|${toId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const target = byId.get(toId);
    if (!target) {
      danglingEdges.push({ fromId: from.modelId, toId, relation });
      return;
    }
    edges.push({
      edgeId: `edge:${hashModelSeed(key).toString(16).padStart(8, '0')}`,
      fromId: from.modelId,
      toId,
      relation,
      crossPart: from.partSlot !== target.partSlot,
    });
  };

  // Index scores by realmSlug for clean realm -> score linking
  const scoreByRealm = new Map<string, string[]>();
  for (const n of all) {
    if (n.kind === 'score') {
      const slug = String(n.generativeGenome.traits.realmSlug ?? '');
      if (slug) {
        const list = scoreByRealm.get(slug) ?? [];
        list.push(n.modelId);
        scoreByRealm.set(slug, list);
      }
      const foley = String(n.generativeGenome.traits.foleyProfile ?? '');
      if (foley) link(n, `frontiers:foley:${foley}`, 'uses-foley');
    }
  }

  for (const n of all) {
    const tr = n.generativeGenome.traits;
    if (n.kind === 'realm') {
      const slug = String(tr.slug ?? '');
      const theme = String(tr.theme ?? '');
      const geoId = String(tr.geomorphologyId ?? '');
      const faunaKit = String(tr.faunaKit ?? '');
      const storyId = String(tr.storyAutomatonId ?? '');
      if (geoId) link(n, `frontiers:geomorphology:${geoId}`, 'uses-geomorphology');
      if (theme) link(n, `frontiers:profile:${theme}`, 'governed-by');
      if (slug) link(n, `frontiers:material:${slug}`, 'uses-materials');
      if (faunaKit) link(n, `frontiers:fauna:${faunaKit}`, 'spawns-fauna');
      if (storyId) link(n, `frontiers:story:${storyId}`, 'narrated-by');
      for (const scoreId of scoreByRealm.get(slug) ?? []) {
        link(n, scoreId, 'scored-by');
      }
    } else if (n.kind === 'dungeon') {
      const slug = String(tr.slug ?? '');
      const theme = String(tr.theme ?? '');
      const topologyId = String(tr.topologyId ?? '');
      const parentRealm = String(tr.parentRealm ?? '');
      const storyId = String(tr.storyAutomatonId ?? '');
      if (topologyId) link(n, `frontiers:dungeon-topology:${topologyId}`, 'uses-topology');
      if (parentRealm && byId.has(`frontiers:realm:${parentRealm}`)) {
        link(n, `frontiers:realm:${parentRealm}`, 'delves-beneath');
      }
      if (theme) link(n, `frontiers:profile:${theme}`, 'governed-by');
      if (slug) link(n, `frontiers:material:${slug}`, 'uses-materials');
      if (storyId) link(n, `frontiers:story:${storyId}`, 'narrated-by');
      for (const scoreId of scoreByRealm.get(slug) ?? []) {
        link(n, scoreId, 'scored-by');
      }
    } else if (n.kind === 'character') {
      const realmSlug = String(tr.realmSlug ?? '');
      const guildId = String(tr.guildId ?? '');
      if (realmSlug && byId.has(`frontiers:realm:${realmSlug}`)) {
        link(byId.get(`frontiers:realm:${realmSlug}`)!, n.modelId, 'inhabited-by');
      }
      if (guildId && byId.has(`frontiers:guild:${guildId}`)) {
        link(n, `frontiers:guild:${guildId}`, 'chartered-by');
      }
    } else if (n.kind === 'monster-species') {
      const theme = String(tr.theme ?? '');
      const faunaKit = String(tr.faunaKit ?? '');
      if (theme) link(n, `frontiers:profile:${theme}`, 'governed-by');
      if (faunaKit) link(n, `frontiers:fauna:${faunaKit}`, 'spawns-fauna');
    } else if (n.kind === 'relic-archetype') {
      const theme = String(tr.theme ?? '');
      if (theme) link(n, `frontiers:visual:crest:${theme}`, 'crested-by');
    } else if (n.kind === 'quest') {
      const guildId = String(tr.guildId ?? '');
      if (guildId && byId.has(`frontiers:guild:${guildId}`)) {
        link(n, `frontiers:guild:${guildId}`, 'chartered-by');
      }
    } else if (n.kind === 'differentiation-profile') {
      const geoId = String(tr.geomorphologyId ?? '');
      const topoId = String(tr.dungeonTopologyId ?? '');
      const foley = String(tr.foleyProfile ?? '');
      const fauna = String(tr.faunaKit ?? '');
      const guild = String(tr.guildId ?? '');
      if (geoId) link(n, `frontiers:geomorphology:${geoId}`, 'uses-geomorphology');
      if (topoId) link(n, `frontiers:dungeon-topology:${topoId}`, 'uses-topology');
      if (foley) link(n, `frontiers:foley:${foley}`, 'uses-foley');
      if (fauna) link(n, `frontiers:fauna:${fauna}`, 'spawns-fauna');
      if (guild && byId.has(`frontiers:guild:${guild}`)) {
        link(n, `frontiers:guild:${guild}`, 'chartered-by');
      }
    } else if (n.kind === 'expedition-session') {
      const activeSlug = String(tr.activeRealmSlug ?? '');
      if (byId.has(`frontiers:realm:${activeSlug}`)) {
        link(n, `frontiers:realm:${activeSlug}`, 'hosts-expedition');
      } else if (byId.has(`frontiers:dungeon:${activeSlug}`)) {
        link(n, `frontiers:dungeon:${activeSlug}`, 'hosts-expedition');
      }
      link(n, 'frontiers:framework:multiplayer-expedition-protocol', 'governed-by');
    } else if (n.kind === 'prologue-act') {
      const realmSlug = String(tr.primaryRealmSlug ?? '');
      const npcId = String(tr.primaryNpcId ?? '');
      if (realmSlug && byId.has(`frontiers:realm:${realmSlug}`)) {
        link(n, `frontiers:realm:${realmSlug}`, 'introduces-realm');
      }
      if (npcId && byId.has(`frontiers:character:${npcId}`)) {
        link(n, `frontiers:character:${npcId}`, 'introduces-npc');
      }
      link(n, 'frontiers:journey:experience-flow', 'directs-journey');
    } else if (n.kind === 'journey-milestone') {
      const questId = String(tr.linkedQuestId ?? '');
      if (questId && byId.has(`frontiers:quest:${questId}`)) {
        link(n, `frontiers:quest:${questId}`, 'guides-quest');
      }
      link(n, 'frontiers:journey:experience-flow', 'directs-journey');
    } else if (n.kind === 'journey-flow') {
      link(n, 'frontiers:framework:multi-slot-save-charter', 'governed-by');
      link(n, 'frontiers:expedition:active-session', 'hosts-expedition');
    } else if (n.kind === 'field-manual') {
      link(n, 'frontiers:journey:experience-flow', 'directs-journey');
    }
  }

  const totalAttempted = edges.length + danglingEdges.length;
  return {
    edges,
    crossPartEdges: edges.filter((e) => e.crossPart).length,
    danglingEdges,
    integrityRatio: totalAttempted > 0 ? edges.length / totalAttempted : 1,
  };
}

/**
 * Traverses upstream dependencies and downstream dependents of any model node
 * across the 8 Verdant Cognitive Parts.
 */
export function getModelLineage(
  root: VerdantModelNode,
  modelId: string,
): ModelLineageReport | null {
  const model = getModelById(root, modelId);
  if (!model) return null;

  const all = flattenModelTree(root);
  const byId = new Map<string, VerdantModelNode>();
  for (const n of all) byId.set(n.modelId, n);

  const graph = buildModelRelationGraph(root);
  const upstream: Array<{ relation: VerdantEdgeRelation; node: VerdantModelNode }> = [];
  const downstream: Array<{ relation: VerdantEdgeRelation; node: VerdantModelNode }> = [];
  let crossPartDegree = 0;

  for (const edge of graph.edges) {
    if (edge.fromId === modelId) {
      const target = byId.get(edge.toId);
      if (target) {
        upstream.push({ relation: edge.relation, node: target });
        if (edge.crossPart) crossPartDegree += 1;
      }
    } else if (edge.toId === modelId) {
      const source = byId.get(edge.fromId);
      if (source) {
        downstream.push({ relation: edge.relation, node: source });
        if (edge.crossPart) crossPartDegree += 1;
      }
    }
  }

  return { model, upstream, downstream, crossPartDegree };
}

export function summarizeModelOfModels(root: VerdantModelNode): ModelOfModelsSummary {
  const all = flattenModelTree(root);
  const graph = buildModelRelationGraph(root);
  const parts: PartModelSummary[] = VERDANT_PART_SLOTS.map((slot) => {
    const models = listModelsByPart(root, slot);
    const count = models.length;
    const meanTier =
      count > 0
        ? Math.round((models.reduce((a, m) => a + m.resolutionTier, 0) / count) * 100) / 100
        : 0;
    const meanDef =
      count > 0
        ? Math.round((models.reduce((a, m) => a + m.definitionScore, 0) / count) * 10) / 10
        : 0;
    const uniqueTokens = new Set(models.flatMap((m) => m.featureSignature)).size;
    return {
      partSlot: slot,
      title: PART_TITLES[slot],
      modelCount: count,
      meanResolutionTier: meanTier,
      meanDefinitionScore: meanDef,
      uniqueFeatureTokens: uniqueTokens,
      vectorCentroid: computeVectorCentroid(models.map((m) => m.semanticVector)),
    };
  });

  return {
    rootModelId: root.modelId,
    title: root.title,
    version: root.version,
    resolutionTier: root.resolutionTier,
    definitionScore: root.definitionScore,
    totalModels: all.length,
    partsPopulated: parts.filter((p) => p.modelCount > 0).length,
    totalParts: VERDANT_PART_SLOTS.length,
    graphEdgeCount: graph.edges.length,
    crossPartEdgeCount: graph.crossPartEdges,
    kappaDigest: root.kappaDigest,
    parts,
  };
}
