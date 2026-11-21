import type { EnemyArchetype } from '../game/rpgLogic';
import type { RegionId, WorldInteractable, WorldRegion } from '../game/worldData';
import type { FaunaKitId, FloraKitId } from './verdantEcosystemCatalog';
import type { AcousticFoleyProfile, MusicalModeId } from './verdantScoreSchema';

export type CharterRealmThemeId =
  | 'citadel-highlands'
  | 'sunken-aqueducts'
  | 'obsidian-crucible'
  | 'pelagic-spires'
  | 'amber-steppe'
  | 'glacial-spire';

export type CharterDungeonStyle =
  | 'catacomb-vault'
  | 'geothermal-depths'
  | 'sunken-cistern'
  | 'abyssal-grotto'
  | 'echo-tomb'
  | 'glacial-crypt';

export type TerrainGeomorphologyId =
  | 'twin-ridge-gorge'
  | 'terraced-basin-delta'
  | 'ring-caldera-crater'
  | 'archipelago-atoll-channels'
  | 'stepped-canyon-mesas'
  | 'glacial-fjord-cirque';

export type DungeonTopologyId =
  | 'twin-span-reliquary'
  | 'spiral-sluice-rotunda'
  | 'crucible-island-ring'
  | 'tidal-atoll-stepping-stones'
  | 'stepped-ziggurat-labyrinth'
  | 'bifurcated-prism-cloister';

export interface DungeonRectZone {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  elevation: number;
  material?: 'cobble' | 'stone' | 'timber';
}

export interface DungeonHazardZone {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surfaceY: number;
  bedY: number;
  label: string;
  blocksWalking: boolean;
}

export interface DungeonInteractableSlot {
  idSuffix: string;
  kind: WorldInteractable['kind'];
  name: string;
  promptVerb: string;
  regionId: RegionId;
  position: [number, number];
  requiredGear?: WorldInteractable['requiredGear'];
  isObjectiveTarget?: boolean;
}

export interface DungeonEnemySlot {
  idSuffix: string;
  archetype: EnemyArchetype;
  speciesRole: 'scout' | 'bruiser' | 'caster' | 'hexer' | 'skirmisher' | 'apex';
  position: [number, number];
  hpBase: number;
}

export interface DungeonPropSlot {
  idSuffix: string;
  assetId: string;
  label: string;
  position: [number, number];
  targetHeight: number;
  yaw: number;
  yOffset?: number;
  maxTriangles?: number;
}

export interface DungeonTopologyCharter {
  topologyId: DungeonTopologyId;
  style: CharterDungeonStyle;
  theme: CharterRealmThemeId;
  title: string;
  architecturalSummary: string;
  mechanicSummary: string;
  spawnPoint: [number, number];
  ascendEntryPosition: [number, number];
  ascendBossPosition: [number, number];
  bossPosition: [number, number];
  walkableZones: DungeonRectZone[];
  hazardZones: DungeonHazardZone[];
  regions: Array<{
    id: RegionId;
    name: string;
    subtitle: string;
    center: [number, number];
    radius: number;
    ambientMood: WorldRegion['ambientMood'];
  }>;
  fastTravelPoints: Array<{ regionId: RegionId; name: string; x: number; z: number }>;
  interactableSlots: DungeonInteractableSlot[];
  enemySlots: DungeonEnemySlot[];
  propSlots: DungeonPropSlot[];
  questTemplate: {
    motif: string;
    summaryTemplate: string;
    objective1Description: string;
    objective1Kind: 'calibrate-beacon' | 'ring-bell' | 'collect-relics';
    objective1TargetSuffix: string;
    objective1Coords: [number, number];
    objective1Required: number;
    objective2Template: string;
  };
  thermalVents: Array<[number, number]>;
}

export interface MonsterSpeciesEntry {
  archetype: EnemyArchetype;
  speciesName: string;
  ecologicalNiche: string;
  tacticalSignature: string;
  baseHp: number;
}

export interface StoryStateNode {
  id: string;
  act: 1 | 2 | 3;
  label: string;
  objectiveSummary: string;
}

export interface StoryTransitionEdge {
  from: string;
  to: string;
  condition: string;
  resourceKey: string;
  minted: number;
  burned: number;
}

export interface ConservationLedgerEntry {
  resourceKey: string;
  before: number;
  minted: number;
  burned: number;
  after: number;
}

export interface StoryAutomaton {
  id: string;
  title: string;
  domainId: string;
  motif: string;
  startState: string;
  terminalState: string;
  states: StoryStateNode[];
  edges: StoryTransitionEdge[];
  ledger: ConservationLedgerEntry[];
}

export interface StoryVerificationReport {
  automatonId: string;
  reachableFromStart: boolean;
  terminalReachable: boolean;
  deadlockFree: boolean;
  conservationClosed: boolean;
  unreachableStates: string[];
  ledgerViolations: string[];
  passed: boolean;
}

export interface GeomorphologySpec {
  id: TerrainGeomorphologyId;
  title: string;
  summary: string;
  massifs: Array<{ cx: number; cz: number; rx: number; rz: number; height: number }>;
  basins: Array<{ cx: number; cz: number; spread: number; depth: number }>;
  ridgeFreq: number;
  terraceSteps: number; // 0 = smooth, >0 = stepped mesa/terrace quantization blend
  calderaRingRadius?: number;
  calderaRimHeight?: number;
  waterLevelDefault: number;
}

export interface WorldDifferentiationProfile {
  profileId: string;
  theme: CharterRealmThemeId;
  domainLabel: string;
  authority: string;
  geomorphology: GeomorphologySpec;
  dungeonStyle: CharterDungeonStyle;
  dungeonTopologyId: DungeonTopologyId;
  faunaKit: FaunaKitId;
  floraKit: FloraKitId;
  preferredMode: MusicalModeId;
  foleyProfile: AcousticFoleyProfile;
  acousticAbsorption: number;
  guildId: string;
  guildAffiliationName: string;
  materials: {
    terrain: string;
    masonry: string;
    road: string;
    timber: string;
  };
  monsterRoster: Record<EnemyArchetype, MonsterSpeciesEntry>;
  overworldStory: StoryAutomaton;
  dungeonStory: StoryAutomaton;
  overworldPlotHook: {
    questTitlePrefix: string;
    motif: string;
    primaryVerb: string;
    landmarkFocus: string;
    relicFlavor: string;
  };
  profileKappaHex: string;
}

function fnvHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// =============================================================================
// 1. SIX DISTINCT TERRAIN GEOMORPHOLOGY MODELS (MODEL-FIRST LANDFORMS)
// =============================================================================

export const TERRAIN_GEOMORPHOLOGIES: Record<CharterRealmThemeId, GeomorphologySpec> = {
  'citadel-highlands': {
    id: 'twin-ridge-gorge',
    title: 'Twin-Ridge Basalt Escarpment & River Gorge',
    summary: 'Flanking alpine granite ridges cradling a central terraced citadel and parabolic river gorge.',
    massifs: [
      { cx: -48, cz: -56, rx: 0.82, rz: 0.92, height: 13.8 },
      { cx: -68, cz: -36, rx: 0.85, rz: 0.85, height: 8.4 },
      { cx: 50, cz: -52, rx: 0.84, rz: 0.90, height: 12.6 },
      { cx: 70, cz: -28, rx: 0.90, rz: 0.85, height: 7.8 },
      { cx: -56, cz: 52, rx: 0.85, rz: 0.88, height: 11.4 },
    ],
    basins: [{ cx: 36, cz: 34, spread: 420, depth: 2.8 }],
    ridgeFreq: 0.085,
    terraceSteps: 0,
    waterLevelDefault: -1.65,
  },
  'sunken-aqueducts': {
    id: 'terraced-basin-delta',
    title: 'Terraced Limestone Basin & Flooded Fern Delta',
    summary: 'Broad stepped watershed terraces dropping into twin mossy lagoons and mist-filled aqueduct basins.',
    massifs: [
      { cx: -64, cz: -44, rx: 0.78, rz: 0.78, height: 9.8 },
      { cx: 62, cz: -46, rx: 0.80, rz: 0.78, height: 9.2 },
      { cx: -58, cz: 46, rx: 0.82, rz: 0.84, height: 8.0 },
    ],
    basins: [
      { cx: 32, cz: 30, spread: 480, depth: 3.1 },
      { cx: -36, cz: 26, spread: 360, depth: 2.4 },
      { cx: 40, cz: -24, spread: 310, depth: 2.0 },
    ],
    ridgeFreq: 0.062,
    terraceSteps: 1.4,
    waterLevelDefault: -0.75,
  },
  'obsidian-crucible': {
    id: 'ring-caldera-crater',
    title: 'Obsidian Ring Caldera & Pyroclastic Rim',
    summary: 'A dramatic volcanic crater rim encircling an elevated slag-basalt core with radial magma fissures.',
    massifs: [
      { cx: -42, cz: -62, rx: 0.92, rz: 0.84, height: 15.6 },
      { cx: 44, cz: -60, rx: 0.90, rz: 0.86, height: 15.2 },
      { cx: -66, cz: 18, rx: 0.84, rz: 0.92, height: 12.8 },
      { cx: 64, cz: 22, rx: 0.86, rz: 0.90, height: 13.4 },
    ],
    basins: [
      { cx: 28, cz: 36, spread: 340, depth: 2.2 },
      { cx: -28, cz: -38, spread: 240, depth: 1.6 },
    ],
    ridgeFreq: 0.11,
    terraceSteps: 0,
    calderaRingRadius: 58,
    calderaRimHeight: 5.4,
    waterLevelDefault: -1.45,
  },
  'pelagic-spires': {
    id: 'archipelago-atoll-channels',
    title: 'Pelagic Archipelago & Tidal Sea-Stack Channels',
    summary: 'Low-lying tidal straits weaving between chalk headlands, coral shoals, and steep sea-stack spires.',
    massifs: [
      { cx: -56, cz: -50, rx: 1.05, rz: 1.05, height: 11.2 },
      { cx: 58, cz: -44, rx: 1.12, rz: 1.08, height: 10.6 },
      { cx: -48, cz: 48, rx: 1.05, rz: 1.02, height: 9.8 },
      { cx: 62, cz: 46, rx: 1.15, rz: 1.12, height: 9.4 },
    ],
    basins: [
      { cx: 30, cz: 26, spread: 540, depth: 3.6 },
      { cx: -32, cz: 28, spread: 420, depth: 2.9 },
      { cx: 34, cz: -28, spread: 360, depth: 2.5 },
    ],
    ridgeFreq: 0.072,
    terraceSteps: 0,
    waterLevelDefault: -0.42,
  },
  'amber-steppe': {
    id: 'stepped-canyon-mesas',
    title: 'Stepped Ochre Mesas & Aeolian Wind-Canyons',
    summary: 'Flat-topped sandstone mesas carved by wind-scoured acoustic canyons and dry salt-pan flats.',
    massifs: [
      { cx: -54, cz: -48, rx: 0.72, rz: 0.76, height: 12.2 },
      { cx: 52, cz: -54, rx: 0.74, rz: 0.74, height: 12.8 },
      { cx: 60, cz: 42, rx: 0.76, rz: 0.78, height: 10.6 },
      { cx: -60, cz: 40, rx: 0.78, rz: 0.76, height: 10.2 },
    ],
    basins: [{ cx: 38, cz: 34, spread: 320, depth: 1.6 }],
    ridgeFreq: 0.055,
    terraceSteps: 2.4,
    waterLevelDefault: -1.85,
  },
  'glacial-spire': {
    id: 'glacial-fjord-cirque',
    title: 'Glacial Fjord Cirque & Crystalline Horn Peaks',
    summary: 'Razor-sharp glacial horn peaks towering over a carved U-shaped fjord valley and frozen tarn.',
    massifs: [
      { cx: -44, cz: -54, rx: 0.96, rz: 0.98, height: 17.4 },
      { cx: 46, cz: -52, rx: 0.98, rz: 0.96, height: 16.8 },
      { cx: -64, cz: 36, rx: 0.92, rz: 0.92, height: 14.2 },
      { cx: 64, cz: 34, rx: 0.92, rz: 0.92, height: 13.6 },
      { cx: 0, cz: -72, rx: 0.85, rz: 1.05, height: 13.0 },
    ],
    basins: [
      { cx: 34, cz: 32, spread: 400, depth: 2.6 },
      { cx: -34, cz: -14, spread: 280, depth: 1.8 },
    ],
    ridgeFreq: 0.125,
    terraceSteps: 0,
    waterLevelDefault: -1.35,
  },
};

/**
 * Evaluates the theme-specific geomorphology elevation contribution (massifs, basins,
 * caldera rim, or stepped mesa terraces) so every biome genuinely has a distinct landform
 * silhouette rather than identical mountain coordinates.
 */
export function evaluateGeomorphologyElevation(
  theme: CharterRealmThemeId,
  x: number,
  z: number,
  seedPhase: number,
  coastDipScale: number,
): { mountainLift: number; basinDip: number; terraceSteps: number } {
  const geo = TERRAIN_GEOMORPHOLOGIES[theme] ?? TERRAIN_GEOMORPHOLOGIES['citadel-highlands'];
  const ridgeDetail =
    1.0 +
    Math.sin(x * geo.ridgeFreq + z * (geo.ridgeFreq * 0.92) + seedPhase) * 0.16 +
    Math.cos(x * (geo.ridgeFreq * 1.65) - z * (geo.ridgeFreq * 1.4) + seedPhase * 0.6) * 0.06;

  let mountainLift = 0;
  for (const m of geo.massifs) {
    const d = Math.hypot((x - m.cx) * m.rx, (z - m.cz) * m.rz);
    mountainLift += Math.exp(-(d * d) / 510) * m.height;
  }

  if (geo.calderaRingRadius && geo.calderaRimHeight) {
    const r = Math.hypot(x, z + 6);
    const ringDist = Math.abs(r - geo.calderaRingRadius);
    // Keep cardinal road axes open through the caldera rim
    const roadClear = smoothstep(5, 16, Math.min(Math.abs(x), Math.abs(z)));
    mountainLift += Math.exp(-(ringDist * ringDist) / 145) * geo.calderaRimHeight * roadClear;
  }

  mountainLift *= ridgeDetail;

  let basinDip = 0;
  for (const b of geo.basins) {
    const d = Math.hypot(x - b.cx, z - b.cz);
    basinDip += Math.exp(-(d * d) / b.spread) * -b.depth * Math.max(0.45, coastDipScale * 0.45);
  }

  return { mountainLift, basinDip, terraceSteps: geo.terraceSteps };
}

// =============================================================================
// 2. SIX BESPOKE 3D DUNGEON FLOORPLAN TOPOLOGIES (ZERO CLONE CORRIDORS!)
// =============================================================================

export const DUNGEON_TOPOLOGY_CHARTERS: Record<CharterDungeonStyle, DungeonTopologyCharter> = {
  // 1. CATACOMB-VAULT -> Twin-Span Reliquary (twin parallel abyss bridges + flanking ossuary alcoves)
  'catacomb-vault': {
    topologyId: 'twin-span-reliquary',
    style: 'catacomb-vault',
    theme: 'citadel-highlands',
    title: 'Twin-Span Basalt Reliquary',
    architecturalSummary:
      'Dual parallel stone viaduct spans crossing a deep subterranean chasm into twin ossuary reliquary wings and a raised basalt amphitheater.',
    mechanicSummary:
      'Choose West or East parallel bridge spans, ignite twin Ossuary Seal Braziers, and break the Charter Stone Colossus.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -25.5],
    walkableZones: [
      { id: 'cat-vest', minX: -12, maxX: 12, minZ: 17.5, maxZ: 33.5, elevation: 1.0, material: 'cobble' },
      { id: 'cat-span-w', minX: -7.2, maxX: -2.0, minZ: 4.0, maxZ: 18.2, elevation: 1.15, material: 'cobble' },
      { id: 'cat-span-e', minX: 2.0, maxX: 7.2, minZ: 4.0, maxZ: 18.2, elevation: 1.15, material: 'cobble' },
      { id: 'cat-rotunda', minX: -20.5, maxX: 20.5, minZ: -14.5, maxZ: 4.5, elevation: 1.0, material: 'cobble' },
      { id: 'cat-sanctum', minX: -12.5, maxX: 12.5, minZ: -36.5, maxZ: -14.0, elevation: 2.0, material: 'stone' },
    ],
    hazardZones: [
      { id: 'cat-chasm-w', minX: -21.5, maxX: -7.2, minZ: 4.5, maxZ: 17.5, surfaceY: -2.2, bedY: -4.6, label: 'West Abyss Pit', blocksWalking: true },
      { id: 'cat-chasm-c', minX: -2.0, maxX: 2.0, minZ: 4.5, maxZ: 17.5, surfaceY: -2.2, bedY: -4.6, label: 'Center Split Chasm', blocksWalking: true },
      { id: 'cat-chasm-e', minX: 7.2, maxX: 21.5, minZ: 4.5, maxZ: 17.5, surfaceY: -2.2, bedY: -4.6, label: 'East Abyss Pit', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Ossuary Vestibule', subtitle: 'Twin-Span Entry Threshold', center: [0, 25], radius: 13, ambientMood: 'causeway' },
      { id: 'high-causeway', name: 'Twin-Span Reliquary Hall', subtitle: 'Dual Viaduct & Ossuary Wings', center: [0, -4], radius: 18, ambientMood: 'foundry' },
      { id: 'boss-vault', name: 'Basalt Charter Amphitheater', subtitle: 'Sovereign Guardian Dais', center: [0, -26], radius: 15, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Ossuary Vestibule', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'Reliquary Cross-Hall', x: 0, z: -3.5 },
      { regionId: 'boss-vault', name: 'Charter Dais Steps', x: 0, z: -17.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'seal-brazier', name: 'West Ossuary Resonance Seal', promptVerb: 'Ignite West Seal Brazier', regionId: 'high-causeway', position: [-10.5, -4.5], isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'seal-brazier', name: 'East Ossuary Resonance Seal', promptVerb: 'Ignite East Seal Brazier', regionId: 'high-causeway', position: [10.5, -4.5], isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'West Reliquary Coffer', promptVerb: 'Unseal Reliquary Coffer', regionId: 'high-causeway', position: [-17.5, -4.0] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'East Survey Vault Chest', promptVerb: 'Unseal Vault Chest', regionId: 'high-causeway', position: [17.5, -4.0] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'stalker', speciesRole: 'scout', position: [-4.6, 0.5], hpBase: 64 },
      { idSuffix: 'e2', archetype: 'charger', speciesRole: 'bruiser', position: [4.6, -2.5], hpBase: 92 },
      { idSuffix: 'e3', archetype: 'shardcaster', speciesRole: 'caster', position: [-13.5, -6.5], hpBase: 58 },
      { idSuffix: 'e4', archetype: 'hexweaver', speciesRole: 'hexer', position: [13.5, -6.5], hpBase: 64 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -25.5], hpBase: 195 },
    ],
    propSlots: [
      { idSuffix: 'st-w', assetId: 'gothic_statue', label: 'Vestibule Warden W', position: [-8.0, 21.5], targetHeight: 3.9, yaw: 0.35, maxTriangles: 480 },
      { idSuffix: 'st-e', assetId: 'gothic_statue', label: 'Vestibule Warden E', position: [8.0, 21.5], targetHeight: 3.9, yaw: -0.35, maxTriangles: 480 },
      { idSuffix: 'st-bw', assetId: 'gothic_statue', label: 'Amphitheater Sentinel W', position: [-9.2, -24.0], targetHeight: 4.4, yaw: 0.4, maxTriangles: 500 },
      { idSuffix: 'st-be', assetId: 'gothic_statue', label: 'Amphitheater Sentinel E', position: [9.2, -24.0], targetHeight: 4.4, yaw: -0.4, maxTriangles: 500 },
      { idSuffix: 'lamp-w', assetId: 'brass_diya_lantern', label: 'West Span Lantern', position: [-7.0, 18.2], targetHeight: 1.35, yaw: 0.2, maxTriangles: 340 },
      { idSuffix: 'lamp-e', assetId: 'brass_diya_lantern', label: 'East Span Lantern', position: [7.0, 18.2], targetHeight: 1.35, yaw: -0.2, maxTriangles: 340 },
      { idSuffix: 'estoc', assetId: 'antique_estoc', label: 'Charter Altar Relic Blade', position: [0, -31.8], yOffset: 1.2, targetHeight: 2.6, yaw: 0.0, maxTriangles: 360 },
      { idSuffix: 'vase-w', assetId: 'brass_vase_01', label: 'West Ossuary Urn', position: [-18.5, -6.5], targetHeight: 1.4, yaw: 0.8, maxTriangles: 320 },
    ],
    questTemplate: {
      motif: 'twin-span ossuary triangulation',
      summaryTemplate: 'Cross the Twin Viaduct Spans, ignite both Ossuary Resonance Seals, and topple {bossName}.',
      objective1Description: 'Ignite Twin Ossuary Resonance Seals',
      objective1Kind: 'calibrate-beacon',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-10.5, -4.5],
      objective1Required: 2,
      objective2Template: 'Vanquish {bossName}',
    },
    thermalVents: [],
  },

  // 2. SUNKEN-CISTERN -> Spiral Sluice Rotunda (central circular island + 4-way radial moat bridges)
  'sunken-cistern': {
    topologyId: 'spiral-sluice-rotunda',
    style: 'sunken-cistern',
    theme: 'sunken-aqueducts',
    title: 'Spiral Sluice Rotunda & Flooded Ring',
    architecturalSummary:
      'A grand circular Roman cistern basin where four radial aqueduct causeways converge on a mossy central Lotus Sluice Hub.',
    mechanicSummary:
      'Traverse the four radial weir bridges across the flooded ring moat, strike the East & West Sluice Bells, and break the Siphon Leviathan.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -26.0],
    walkableZones: [
      { id: 'cis-south-quay', minX: -14, maxX: 14, minZ: 15.5, maxZ: 33.5, elevation: 1.0, material: 'cobble' },
      { id: 'cis-bridge-s', minX: -3.0, maxX: 3.0, minZ: 5.0, maxZ: 16.5, elevation: 1.12, material: 'timber' },
      { id: 'cis-hub', minX: -6.8, maxX: 6.8, minZ: -7.5, maxZ: 5.5, elevation: 1.25, material: 'cobble' },
      { id: 'cis-bridge-w', minX: -15.5, maxX: -6.2, minZ: -3.8, maxZ: 1.8, elevation: 1.12, material: 'timber' },
      { id: 'cis-bridge-e', minX: 6.2, maxX: 15.5, minZ: -3.8, maxZ: 1.8, elevation: 1.12, material: 'timber' },
      { id: 'cis-gallery-w', minX: -20.8, maxX: -14.5, minZ: -14.0, maxZ: 12.0, elevation: 1.0, material: 'stone' },
      { id: 'cis-gallery-e', minX: 14.5, maxX: 20.8, minZ: -14.0, maxZ: 12.0, elevation: 1.0, material: 'stone' },
      { id: 'cis-bridge-n', minX: -3.2, maxX: 3.2, minZ: -18.5, maxZ: -6.8, elevation: 1.25, material: 'timber' },
      { id: 'cis-sanctum', minX: -14.0, maxX: 14.0, minZ: -36.5, maxZ: -17.5, elevation: 1.85, material: 'cobble' },
    ],
    hazardZones: [
      { id: 'cis-moat-sw', minX: -14.5, maxX: -3.0, minZ: 1.8, maxZ: 15.5, surfaceY: -1.6, bedY: -4.2, label: 'SW Cistern Moat', blocksWalking: true },
      { id: 'cis-moat-se', minX: 3.0, maxX: 14.5, minZ: 1.8, maxZ: 15.5, surfaceY: -1.6, bedY: -4.2, label: 'SE Cistern Moat', blocksWalking: true },
      { id: 'cis-moat-nw', minX: -14.5, maxX: -3.2, minZ: -17.5, maxZ: -3.8, surfaceY: -1.6, bedY: -4.2, label: 'NW Cistern Moat', blocksWalking: true },
      { id: 'cis-moat-ne', minX: 3.2, maxX: 14.5, minZ: -17.5, maxZ: -3.8, surfaceY: -1.6, bedY: -4.2, label: 'NE Cistern Moat', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Siphon Intake Quay', subtitle: 'Southern Cistern Entry', center: [0, 24], radius: 13, ambientMood: 'ironwood' },
      { id: 'high-causeway', name: 'Lotus Sluice Hub & Ring', subtitle: 'Four-Way Radial Aqueduct Moat', center: [0, -1], radius: 18, ambientMood: 'ironwood' },
      { id: 'boss-vault', name: 'Drowned Weir Rotunda', subtitle: 'Siphon Leviathan Pool', center: [0, -26], radius: 15, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Siphon Intake Quay', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'Central Lotus Hub', x: 0, z: -1.0 },
      { regionId: 'boss-vault', name: 'Weir Rotunda Threshold', x: 0, z: -19.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'forge-bell', name: 'West Aqueduct Sluice Bell', promptVerb: 'Ring West Sluice Bell [Bell-Hammer]', regionId: 'high-causeway', position: [-17.5, -1.0], requiredGear: 'bellhammer', isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'forge-bell', name: 'East Aqueduct Sluice Bell', promptVerb: 'Ring East Sluice Bell [Bell-Hammer]', regionId: 'high-causeway', position: [17.5, -1.0], requiredGear: 'bellhammer', isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'Moss-Grown Sluice Coffer', promptVerb: 'Unseal Sluice Coffer', regionId: 'high-causeway', position: [-17.5, -10.5] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'Lotus Conduit Reliquary', promptVerb: 'Unseal Conduit Reliquary', regionId: 'high-causeway', position: [17.5, -10.5] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'skirmisher', speciesRole: 'skirmisher', position: [0, 1.5], hpBase: 60 },
      { idSuffix: 'e2', archetype: 'hexweaver', speciesRole: 'hexer', position: [-17.2, 5.5], hpBase: 64 },
      { idSuffix: 'e3', archetype: 'shardcaster', speciesRole: 'caster', position: [17.2, 5.5], hpBase: 60 },
      { idSuffix: 'e4', archetype: 'stalker', speciesRole: 'scout', position: [0, -13.5], hpBase: 68 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -26.0], hpBase: 225 },
    ],
    propSlots: [
      { idSuffix: 'fern-1', assetId: 'fern_02', label: 'Cistern Spore Fern W', position: [-5.2, 3.8], targetHeight: 2.0, yaw: 0.4, maxTriangles: 340 },
      { idSuffix: 'fern-2', assetId: 'fern_02', label: 'Cistern Spore Fern E', position: [5.2, 3.8], targetHeight: 2.0, yaw: 1.9, maxTriangles: 340 },
      { idSuffix: 'pot-w', assetId: 'ceramic_pot', label: 'Sluice Amphora W', position: [-19.0, 2.2], targetHeight: 1.35, yaw: 0.7, maxTriangles: 320 },
      { idSuffix: 'pot-e', assetId: 'antique_ceramic_vase_01', label: 'Sluice Amphora E', position: [19.0, 2.2], targetHeight: 1.45, yaw: 1.5, maxTriangles: 320 },
      { idSuffix: 'lamp-w', assetId: 'Lantern_01', label: 'Hub Canal Lamp W', position: [-4.8, -5.2], targetHeight: 1.4, yaw: 0.2, maxTriangles: 340 },
      { idSuffix: 'lamp-e', assetId: 'Lantern_01', label: 'Hub Canal Lamp E', position: [4.8, -5.2], targetHeight: 1.4, yaw: 2.0, maxTriangles: 340 },
      { idSuffix: 'rock-n', assetId: 'boulder_01', label: 'Mossy Weir Outcrop', position: [-11.5, -29.0], targetHeight: 3.1, yaw: 1.1, maxTriangles: 400 },
    ],
    questTemplate: {
      motif: 'hydraulic siphon weir rebalancing',
      summaryTemplate: 'Cross the four radial aqueduct spans around the Lotus Hub, ring both Sluice Bells, and defeat {bossName}.',
      objective1Description: 'Ring West & East Aqueduct Sluice Bells',
      objective1Kind: 'ring-bell',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-17.5, -1.0],
      objective1Required: 2,
      objective2Template: 'Topple {bossName}',
    },
    thermalVents: [],
  },

  // 3. GEOTHERMAL-DEPTHS -> Crucible Island Ring (lava caldera lake + central forge island + flanking quench wings)
  'geothermal-depths': {
    topologyId: 'crucible-island-ring',
    style: 'geothermal-depths',
    theme: 'obsidian-crucible',
    title: 'Crucible Caldera Island & Quench Wings',
    architecturalSummary:
      'An octagonal iron-forged island suspended over a molten magma lake, linked by chain walkways to flanking Quench-Valve Bastions and a roaring Blast Furnace Dais.',
    mechanicSummary:
      'Weave past active magma vents across the central Anvil Island, quench the twin Slag Valves on the East/West platforms, and face the Caldera Warden.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -25.5],
    walkableZones: [
      { id: 'geo-entry', minX: -11, maxX: 11, minZ: 17.0, maxZ: 33.5, elevation: 1.0, material: 'stone' },
      { id: 'geo-span-s', minX: -2.9, maxX: 2.9, minZ: 7.5, maxZ: 17.5, elevation: 1.2, material: 'stone' },
      { id: 'geo-anvil-island', minX: -7.5, maxX: 7.5, minZ: -6.5, maxZ: 8.2, elevation: 1.35, material: 'stone' },
      { id: 'geo-wing-span-w', minX: -14.0, maxX: -7.0, minZ: -2.4, maxZ: 3.0, elevation: 1.35, material: 'stone' },
      { id: 'geo-wing-span-e', minX: 7.0, maxX: 14.0, minZ: -2.4, maxZ: 3.0, elevation: 1.35, material: 'stone' },
      { id: 'geo-quench-w', minX: -20.5, maxX: -13.2, minZ: -7.5, maxZ: 8.0, elevation: 1.5, material: 'cobble' },
      { id: 'geo-quench-e', minX: 13.2, maxX: 20.5, minZ: -7.5, maxZ: 8.0, elevation: 1.5, material: 'cobble' },
      { id: 'geo-span-n', minX: -3.2, maxX: 3.2, minZ: -17.0, maxZ: -6.0, elevation: 1.65, material: 'stone' },
      { id: 'geo-furnace-dais', minX: -13.5, maxX: 13.5, minZ: -36.5, maxZ: -16.5, elevation: 2.2, material: 'stone' },
    ],
    hazardZones: [
      { id: 'geo-lava-sw', minX: -21.5, maxX: -2.9, minZ: 8.0, maxZ: 17.0, surfaceY: -2.1, bedY: -4.8, label: 'SW Magma Lake', blocksWalking: true },
      { id: 'geo-lava-se', minX: 2.9, maxX: 21.5, minZ: 8.0, maxZ: 17.0, surfaceY: -2.1, bedY: -4.8, label: 'SE Magma Lake', blocksWalking: true },
      { id: 'geo-lava-mw', minX: -13.2, maxX: -7.5, minZ: 3.0, maxZ: 8.0, surfaceY: -2.1, bedY: -4.8, label: 'West Forge Channel', blocksWalking: true },
      { id: 'geo-lava-me', minX: 7.5, maxX: 13.2, minZ: 3.0, maxZ: 8.0, surfaceY: -2.1, bedY: -4.8, label: 'East Forge Channel', blocksWalking: true },
      { id: 'geo-lava-nw', minX: -21.5, maxX: -3.2, minZ: -16.5, maxZ: -7.5, surfaceY: -2.1, bedY: -4.8, label: 'NW Caldera Abyss', blocksWalking: true },
      { id: 'geo-lava-ne', minX: 3.2, maxX: 21.5, minZ: -16.5, maxZ: -7.5, surfaceY: -2.1, bedY: -4.8, label: 'NE Caldera Abyss', blocksWalking: true },
      { id: 'geo-lava-cw', minX: -13.2, maxX: -7.5, minZ: -7.5, maxZ: -2.4, surfaceY: -2.1, bedY: -4.8, label: 'West Slag Trench', blocksWalking: true },
      { id: 'geo-lava-ce', minX: 7.5, maxX: 13.2, minZ: -7.5, maxZ: -2.4, surfaceY: -2.1, bedY: -4.8, label: 'East Slag Trench', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Bellows Entry Ledge', subtitle: 'Volcanic Descent', center: [0, 25], radius: 13, ambientMood: 'foundry' },
      { id: 'high-causeway', name: 'Anvil-Core Island & Quench Wings', subtitle: 'Suspended Lava Foundry', center: [0, 0.5], radius: 18, ambientMood: 'foundry' },
      { id: 'boss-vault', name: 'Blast Furnace Sanctum', subtitle: 'Molten Crucible Dais', center: [0, -26], radius: 15, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Bellows Entry Ledge', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'Central Anvil Island', x: 0, z: 0.5 },
      { regionId: 'boss-vault', name: 'Furnace Dais Gate', x: 0, z: -18.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'seal-brazier', name: 'West Crucible Quench Valve', promptVerb: 'Vent West Quench Valve', regionId: 'high-causeway', position: [-16.8, 0.5], isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'seal-brazier', name: 'East Crucible Quench Valve', promptVerb: 'Vent East Quench Valve', regionId: 'high-causeway', position: [16.8, 0.5], isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'Slag-Iron Foundry Cache', promptVerb: 'Unseal Foundry Cache', regionId: 'high-causeway', position: [-17.5, -5.2] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'Obsidian Bellows Coffer', promptVerb: 'Unseal Bellows Coffer', regionId: 'high-causeway', position: [17.5, -5.2] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'charger', speciesRole: 'bruiser', position: [0, 2.5], hpBase: 102 },
      { idSuffix: 'e2', archetype: 'hexweaver', speciesRole: 'hexer', position: [-16.5, 4.2], hpBase: 72 },
      { idSuffix: 'e3', archetype: 'shardcaster', speciesRole: 'caster', position: [16.5, 4.2], hpBase: 68 },
      { idSuffix: 'e4', archetype: 'skirmisher', speciesRole: 'skirmisher', position: [0, -4.0], hpBase: 70 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -25.5], hpBase: 255 },
    ],
    propSlots: [
      { idSuffix: 'kettle-w', assetId: 'brass_pot_01', label: 'Crucible Slag Kettle W', position: [-5.5, 6.2], targetHeight: 1.4, yaw: 0.5, maxTriangles: 320 },
      { idSuffix: 'kettle-e', assetId: 'brass_pot_01', label: 'Crucible Slag Kettle E', position: [5.5, 6.2], targetHeight: 1.4, yaw: 1.8, maxTriangles: 320 },
      { idSuffix: 'lamp-w', assetId: 'brass_diya_lantern', label: 'Anvil Torch W', position: [-5.8, -4.8], targetHeight: 1.4, yaw: 0.4, maxTriangles: 340 },
      { idSuffix: 'lamp-e', assetId: 'brass_diya_lantern', label: 'Anvil Torch E', position: [5.8, -4.8], targetHeight: 1.4, yaw: 2.1, maxTriangles: 340 },
      { idSuffix: 'blade-n', assetId: 'antique_estoc', label: 'Tempered Anvil Relic', position: [0, -31.8], yOffset: 1.2, targetHeight: 2.7, yaw: 0.0, maxTriangles: 360 },
      { idSuffix: 'rock-w', assetId: 'boulder_01', label: 'Obsidian Basalt Crag W', position: [-11.5, -28.0], targetHeight: 3.4, yaw: 0.8, maxTriangles: 400 },
      { idSuffix: 'rock-e', assetId: 'boulder_01', label: 'Obsidian Basalt Crag E', position: [11.5, -28.0], targetHeight: 3.4, yaw: 2.2, maxTriangles: 400 },
    ],
    questTemplate: {
      motif: 'volcanic crucible valve quenching',
      summaryTemplate: 'Cross the lava lake to the central Anvil Island, vent both Quench Valves on the flanking bastions, and shatter {bossName}.',
      objective1Description: 'Vent West & East Crucible Quench Valves',
      objective1Kind: 'calibrate-beacon',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-16.8, 0.5],
      objective1Required: 2,
      objective2Template: 'Quench {bossName}',
    },
    thermalVents: [[-4.8, 0.5], [4.8, 0.5], [-6.5, -20.0], [6.5, -20.0], [0, -14.0]],
  },

  // 4. ABYSSAL-GROTTO -> Tidal Atoll Stepping-Stones (meandering S-curve shipwreck & coral headlands!)
  'abyssal-grotto': {
    topologyId: 'tidal-atoll-stepping-stones',
    style: 'abyssal-grotto',
    theme: 'pelagic-spires',
    title: 'S-Curve Coral Atolls & Shipwreck Shoals',
    architecturalSummary:
      'A winding bioluminescent sea-cavern where driftwood gangplanks zig-zag in a sweeping S-curve from a western shipwreck cove to an eastern coral atoll and reef sanctuary.',
    mechanicSummary:
      'Navigate the S-curve coral stepping-stones, align the Shipwreck & Tide-Bell Sextant Beacons, and defeat the Abyssal Shoal Sentinel.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -26.5],
    walkableZones: [
      { id: 'aby-cove', minX: -12.5, maxX: 12.5, minZ: 17.5, maxZ: 33.5, elevation: 1.0, material: 'cobble' },
      { id: 'aby-plank-sw', minX: -10.5, maxX: -4.2, minZ: 7.5, maxZ: 18.2, elevation: 1.05, material: 'timber' },
      { id: 'aby-shipwreck-w', minX: -19.5, maxX: -2.0, minZ: -3.0, maxZ: 8.5, elevation: 1.15, material: 'cobble' },
      { id: 'aby-reef-cross', minX: -3.5, maxX: 11.5, minZ: -6.5, maxZ: 0.5, elevation: 1.05, material: 'timber' },
      { id: 'aby-atoll-e', minX: 2.0, maxX: 19.5, minZ: -16.0, maxZ: -4.5, elevation: 1.25, material: 'cobble' },
      { id: 'aby-plank-ne', minX: 3.8, maxX: 10.2, minZ: -22.5, maxZ: -15.0, elevation: 1.35, material: 'timber' },
      { id: 'aby-sanctum', minX: -13.5, maxX: 13.5, minZ: -36.5, maxZ: -21.5, elevation: 1.65, material: 'cobble' },
    ],
    hazardZones: [
      { id: 'aby-pool-se', minX: -4.2, maxX: 21.5, minZ: 8.5, maxZ: 17.5, surfaceY: -1.4, bedY: -4.2, label: 'SE Coral Lagoon', blocksWalking: true },
      { id: 'aby-pool-sw', minX: -21.5, maxX: -10.5, minZ: 8.5, maxZ: 17.5, surfaceY: -1.4, bedY: -4.2, label: 'SW Tide Pool', blocksWalking: true },
      { id: 'aby-pool-me', minX: 11.5, maxX: 21.5, minZ: -4.5, maxZ: 8.5, surfaceY: -1.4, bedY: -4.2, label: 'East Kelp Deep', blocksWalking: true },
      { id: 'aby-pool-mc', minX: -2.0, maxX: 11.5, minZ: 0.5, maxZ: 8.5, surfaceY: -1.4, bedY: -4.2, label: 'Central Reef Trench', blocksWalking: true },
      { id: 'aby-pool-nw', minX: -21.5, maxX: 2.0, minZ: -21.5, maxZ: -6.5, surfaceY: -1.4, bedY: -4.2, label: 'NW Abyssal Trench', blocksWalking: true },
      { id: 'aby-pool-ne', minX: 10.2, maxX: 21.5, minZ: -21.5, maxZ: -16.0, surfaceY: -1.4, bedY: -4.2, label: 'NE Reef Drop', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Sea-Cave Entry Cove', subtitle: 'Tidal Landing', center: [0, 25], radius: 13, ambientMood: 'coast' },
      { id: 'high-causeway', name: 'Shipwreck Cove & Coral Atolls', subtitle: 'S-Curve Driftwood Crossing', center: [0, -4], radius: 19, ambientMood: 'coast' },
      { id: 'boss-vault', name: 'Bioluminescent Reef Sanctuary', subtitle: 'Shoal Sentinel Atoll', center: [0, -28], radius: 15, ambientMood: 'coast' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Entry Sea-Cove', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'West Shipwreck Shoal', x: -10.0, z: 2.5 },
      { regionId: 'boss-vault', name: 'Reef Sanctuary', x: 0, z: -22.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'waystone-beacon', name: 'Shipwreck Sextant Waystone', promptVerb: 'Calibrate Shipwreck Sextant', regionId: 'high-causeway', position: [-14.5, 2.5], isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'waystone-beacon', name: 'Tide-Bell Coral Waystone', promptVerb: 'Calibrate Coral Waystone', regionId: 'high-causeway', position: [14.5, -10.5], isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'Sunken Captain Strongbox', promptVerb: 'Unseal Captain Strongbox', regionId: 'high-causeway', position: [-17.0, -1.0] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'Pearl-Lined Chart Coffer', promptVerb: 'Unseal Chart Coffer', regionId: 'high-causeway', position: [17.0, -7.0] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'skirmisher', speciesRole: 'skirmisher', position: [-8.5, 4.0], hpBase: 64 },
      { idSuffix: 'e2', archetype: 'stalker', speciesRole: 'scout', position: [-12.5, -0.5], hpBase: 66 },
      { idSuffix: 'e3', archetype: 'hexweaver', speciesRole: 'hexer', position: [10.5, -9.0], hpBase: 66 },
      { idSuffix: 'e4', archetype: 'charger', speciesRole: 'bruiser', position: [6.5, -13.0], hpBase: 94 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -27.5], hpBase: 230 },
    ],
    propSlots: [
      { idSuffix: 'bar-1', assetId: 'Barrel_01', label: 'Shipwreck Rum Cask', position: [-16.2, 6.0], targetHeight: 1.15, yaw: 0.5, maxTriangles: 320 },
      { idSuffix: 'bar-2', assetId: 'Barrel_01', label: 'Salt-Crusted Barrel', position: [-14.8, 6.6], targetHeight: 1.05, yaw: 1.7, maxTriangles: 320 },
      { idSuffix: 'shield', assetId: 'kite_shield', label: 'Tide-Loom Crest', position: [0, -32.2], yOffset: 1.5, targetHeight: 1.6, yaw: 0.0, maxTriangles: 340 },
      { idSuffix: 'lamp-1', assetId: 'Lantern_01', label: 'Shoal Beacon Lamp W', position: [-6.5, 16.5], targetHeight: 1.35, yaw: 0.3, maxTriangles: 340 },
      { idSuffix: 'lamp-2', assetId: 'Lantern_01', label: 'Atoll Beacon Lamp E', position: [7.0, -14.8], targetHeight: 1.35, yaw: 1.9, maxTriangles: 340 },
      { idSuffix: 'rock-w', assetId: 'boulder_01', label: 'Barnacle Reef Rock', position: [-10.5, -30.0], targetHeight: 3.2, yaw: 1.2, maxTriangles: 400 },
    ],
    questTemplate: {
      motif: 's-curve sextant reef triangulation',
      summaryTemplate: 'Follow the S-curve coral atolls, calibrate both submerged Sextant Waystones, and defeat {bossName}.',
      objective1Description: 'Calibrate Shipwreck & Coral Sextant Waystones',
      objective1Kind: 'calibrate-beacon',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-14.5, 2.5],
      objective1Required: 2,
      objective2Template: 'Defeat {bossName}',
    },
    thermalVents: [],
  },

  // 5. ECHO-TOMB -> Stepped Ziggurat Labyrinth (DRY 3-tier ascending sandstone pyramid + central acoustic pit & baffle walls!)
  'echo-tomb': {
    topologyId: 'stepped-ziggurat-labyrinth',
    style: 'echo-tomb',
    theme: 'amber-steppe',
    title: 'Stepped Sandstone Ziggurat & Wind-Harp Galleries',
    architecturalSummary:
      'A dry three-tier ascending sandstone pyramid with a central baffled monolith splitting travelers onto flanking Wind-Harp terraces around a sunken amber-sand resonance well.',
    mechanicSummary:
      'Ascend the flanking ziggurat ramps past the acoustic baffle wall, harvest Resonant Tuning Shards in the Wind-Harp galleries, and climb to the Solar Summit.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -26.5],
    walkableZones: [
      { id: 'ech-tier1', minX: -16.5, maxX: 16.5, minZ: 15.0, maxZ: 33.5, elevation: 1.0, material: 'cobble' },
      { id: 'ech-ramp-w', minX: -16.5, maxX: -7.5, minZ: 3.5, maxZ: 15.5, elevation: 1.6, material: 'stone' },
      { id: 'ech-ramp-e', minX: 7.5, maxX: 16.5, minZ: 3.5, maxZ: 15.5, elevation: 1.6, material: 'stone' },
      { id: 'ech-gallery-w', minX: -20.0, maxX: -5.5, minZ: -14.5, maxZ: 4.5, elevation: 2.1, material: 'cobble' },
      { id: 'ech-gallery-e', minX: 5.5, maxX: 20.0, minZ: -14.5, maxZ: 4.5, elevation: 2.1, material: 'cobble' },
      { id: 'ech-mid-n', minX: -6.0, maxX: 6.0, minZ: -14.5, maxZ: -8.0, elevation: 2.1, material: 'cobble' },
      { id: 'ech-mid-s', minX: -6.0, maxX: 6.0, minZ: 1.5, maxZ: 5.5, elevation: 2.1, material: 'cobble' },
      { id: 'ech-summit-stair', minX: -5.8, maxX: 5.8, minZ: -20.0, maxZ: -13.5, elevation: 2.8, material: 'stone' },
      { id: 'ech-summit', minX: -14.5, maxX: 14.5, minZ: -36.5, maxZ: -19.5, elevation: 3.3, material: 'cobble' },
    ],
    hazardZones: [
      { id: 'ech-sand-well', minX: -5.5, maxX: 5.5, minZ: -8.0, maxZ: 1.5, surfaceY: -1.1, bedY: -3.2, label: 'Amber Sand Resonance Well', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Lower Sandstone Forecourt', subtitle: 'Tier I Ziggurat Threshold', center: [0, 24], radius: 14, ambientMood: 'ironwood' },
      { id: 'high-causeway', name: 'Aeolian Wind-Harp Galleries', subtitle: 'Tier II Acoustic Terraces', center: [0, -4], radius: 19, ambientMood: 'ironwood' },
      { id: 'boss-vault', name: 'Solar Summit Ziggurat', subtitle: 'Tier III Grand Automaton Altar', center: [0, -27], radius: 15, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Ziggurat Forecourt', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'West Wind-Harp Gallery', x: -12.0, z: -3.5 },
      { regionId: 'boss-vault', name: 'Solar Summit Stair', x: 0, z: -18.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'silicate-relic', name: 'West Aeolian Tuning Shard', promptVerb: 'Harvest West Tuning Shard', regionId: 'high-causeway', position: [-14.0, -3.5], isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'silicate-relic', name: 'East Aeolian Tuning Shard', promptVerb: 'Harvest East Tuning Shard', regionId: 'high-causeway', position: [14.0, -3.5], isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'Caravan Tribute Chest W', promptVerb: 'Unseal Tribute Chest', regionId: 'high-causeway', position: [-17.8, -10.5] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'Sandstone Harp Coffer E', promptVerb: 'Unseal Harp Coffer', regionId: 'high-causeway', position: [17.8, -10.5] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'skirmisher', speciesRole: 'skirmisher', position: [-11.5, 9.5], hpBase: 70 },
      { idSuffix: 'e2', archetype: 'charger', speciesRole: 'bruiser', position: [11.5, 9.5], hpBase: 105 },
      { idSuffix: 'e3', archetype: 'hexweaver', speciesRole: 'hexer', position: [-11.0, -7.0], hpBase: 72 },
      { idSuffix: 'e4', archetype: 'shardcaster', speciesRole: 'caster', position: [11.0, -7.0], hpBase: 70 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -26.5], hpBase: 260 },
    ],
    propSlots: [
      { idSuffix: 'vase-1', assetId: 'brass_vase_01', label: 'Resonance Urn W', position: [-8.5, 19.5], targetHeight: 1.5, yaw: 0.4, maxTriangles: 320 },
      { idSuffix: 'vase-2', assetId: 'brass_vase_01', label: 'Resonance Urn E', position: [8.5, 19.5], targetHeight: 1.5, yaw: 1.6, maxTriangles: 320 },
      { idSuffix: 'crate-w', assetId: 'old_military_crate', label: 'Caravan Archive Crate', position: [-17.5, 1.5], targetHeight: 1.2, yaw: 0.5, maxTriangles: 320 },
      { idSuffix: 'table-e', assetId: 'WoodenTable_02', label: 'Tuner Drafting Bench', position: [17.5, 1.5], targetHeight: 1.1, yaw: 1.4, maxTriangles: 340 },
      { idSuffix: 'blade-n', assetId: 'antique_estoc', label: 'Solar Summit Scepter', position: [0, -32.2], yOffset: 1.2, targetHeight: 2.7, yaw: 0.0, maxTriangles: 360 },
      { idSuffix: 'rock-n', assetId: 'boulder_01', label: 'Ochre Canyon Monolith', position: [11.5, -30.0], targetHeight: 3.4, yaw: 0.9, maxTriangles: 400 },
    ],
    questTemplate: {
      motif: 'aeolian ziggurat harmonic counterpoint',
      summaryTemplate: 'Climb the flanking sandstone ziggurat ramps around the resonance well, harvest both Aeolian Tuning Shards, and silence {bossName}.',
      objective1Description: 'Harvest Aeolian Tuning Shards in the Galleries',
      objective1Kind: 'collect-relics',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-14.0, -3.5],
      objective1Required: 2,
      objective2Template: 'Silence {bossName}',
    },
    thermalVents: [],
  },

  // 6. GLACIAL-CRYPT -> Bifurcated Prism Cloister (central N-S frozen crevasse splitting twin ice galleries!)
  'glacial-crypt': {
    topologyId: 'bifurcated-prism-cloister',
    style: 'glacial-crypt',
    theme: 'glacial-spire',
    title: 'Bifurcated Frostglass Cloister & Crevasse Rift',
    architecturalSummary:
      'A towering crystal cathedral split down its entire spine by a luminous blue-ice crevasse, forcing traversal along mirrored West and East Frostglass Cloisters linked by a central ice-mirror span.',
    mechanicSummary:
      'Traverse the twin crystalline cloisters flanking the central Glacial Rift, attune both Mirror-Ice Choir Prisms, and confront the Choir Archon.',
    spawnPoint: [0, 26.5],
    ascendEntryPosition: [0, 30.8],
    ascendBossPosition: [0, -33.5],
    bossPosition: [0, -26.0],
    walkableZones: [
      { id: 'gla-narthex', minX: -16.5, maxX: 16.5, minZ: 17.5, maxZ: 33.5, elevation: 1.0, material: 'cobble' },
      { id: 'gla-cloister-w', minX: -18.5, maxX: -6.2, minZ: -16.5, maxZ: 18.2, elevation: 1.2, material: 'cobble' },
      { id: 'gla-cloister-e', minX: 6.2, maxX: 18.5, minZ: -16.5, maxZ: 18.2, elevation: 1.2, material: 'cobble' },
      { id: 'gla-mirror-span', minX: -6.8, maxX: 6.8, minZ: -2.6, maxZ: 3.2, elevation: 1.35, material: 'cobble' },
      { id: 'gla-choir-oct', minX: -14.5, maxX: 14.5, minZ: -36.5, maxZ: -16.0, elevation: 2.0, material: 'cobble' },
    ],
    hazardZones: [
      { id: 'gla-rift-s', minX: -6.2, maxX: 6.2, minZ: 3.2, maxZ: 17.5, surfaceY: -2.4, bedY: -5.2, label: 'South Glacial Crevasse', blocksWalking: true },
      { id: 'gla-rift-n', minX: -6.2, maxX: 6.2, minZ: -16.0, maxZ: -2.6, surfaceY: -2.4, bedY: -5.2, label: 'North Glacial Crevasse', blocksWalking: true },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: 'Frostglass Narthex', subtitle: 'Rift Threshold', center: [0, 25], radius: 13, ambientMood: 'coast' },
      { id: 'high-causeway', name: 'Bifurcated Prism Cloisters', subtitle: 'Twin Crystal Galleries & Mirror Span', center: [0, 0.5], radius: 19, ambientMood: 'coast' },
      { id: 'boss-vault', name: 'Aurora Choir Octagon', subtitle: 'Crystalline Archon Sanctum', center: [0, -26], radius: 15, ambientMood: 'coast' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Frostglass Narthex', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'Mirror-Ice Cross Span', x: 0, z: 0.3 },
      { regionId: 'boss-vault', name: 'Aurora Choir Octagon', x: 0, z: -18.5 },
    ],
    interactableSlots: [
      { idSuffix: 'brazier-w', kind: 'waystone-beacon', name: 'West Choir Prism Obelisk', promptVerb: 'Tune West Choir Prism', regionId: 'high-causeway', position: [-13.5, 0.3], isObjectiveTarget: true },
      { idSuffix: 'brazier-e', kind: 'waystone-beacon', name: 'East Choir Prism Obelisk', promptVerb: 'Tune East Choir Prism', regionId: 'high-causeway', position: [13.5, 0.3], isObjectiveTarget: true },
      { idSuffix: 'chest-w', kind: 'vault-chest', name: 'Hoarfrost Reliquary W', promptVerb: 'Unseal Hoarfrost Reliquary', regionId: 'high-causeway', position: [-15.8, -11.5] },
      { idSuffix: 'chest-e', kind: 'vault-chest', name: 'Aurora Lens Coffer E', promptVerb: 'Unseal Aurora Coffer', regionId: 'high-causeway', position: [15.8, -11.5] },
    ],
    enemySlots: [
      { idSuffix: 'e1', archetype: 'stalker', speciesRole: 'scout', position: [-11.5, 9.0], hpBase: 74 },
      { idSuffix: 'e2', archetype: 'skirmisher', speciesRole: 'skirmisher', position: [11.5, 9.0], hpBase: 74 },
      { idSuffix: 'e3', archetype: 'hexweaver', speciesRole: 'hexer', position: [-11.5, -7.5], hpBase: 78 },
      { idSuffix: 'e4', archetype: 'charger', speciesRole: 'bruiser', position: [11.5, -7.5], hpBase: 112 },
      { idSuffix: 'boss', archetype: 'colossus', speciesRole: 'apex', position: [0, -26.0], hpBase: 285 },
    ],
    propSlots: [
      { idSuffix: 'st-w', assetId: 'gothic_statue', label: 'Rime Choir Sentinel W', position: [-11.5, 21.0], targetHeight: 4.1, yaw: 0.25, maxTriangles: 480 },
      { idSuffix: 'st-e', assetId: 'gothic_statue', label: 'Rime Choir Sentinel E', position: [11.5, 21.0], targetHeight: 4.1, yaw: -0.25, maxTriangles: 480 },
      { idSuffix: 'shield-n', assetId: 'kite_shield', label: 'Borealis Prism Shield', position: [0, -32.2], yOffset: 1.5, targetHeight: 1.65, yaw: 0.0, maxTriangles: 340 },
      { idSuffix: 'lamp-w', assetId: 'Lantern_01', label: 'Mirror Span Lamp W', position: [-5.8, 0.3], targetHeight: 1.4, yaw: 0.3, maxTriangles: 340 },
      { idSuffix: 'lamp-e', assetId: 'Lantern_01', label: 'Mirror Span Lamp E', position: [5.8, 0.3], targetHeight: 1.4, yaw: 2.0, maxTriangles: 340 },
      { idSuffix: 'rock-w', assetId: 'boulder_01', label: 'Glacial Slate Spire', position: [-11.5, -29.0], targetHeight: 3.5, yaw: 1.4, maxTriangles: 400 },
    ],
    questTemplate: {
      motif: 'bifurcated frostglass choir alignment',
      summaryTemplate: 'Advance down the twin crystalline cloisters flanking the Glacial Rift, tune both Choir Prism Obelisks, and vanquish {bossName}.',
      objective1Description: 'Tune West & East Choir Prism Obelisks',
      objective1Kind: 'calibrate-beacon',
      objective1TargetSuffix: 'brazier',
      objective1Coords: [-13.5, 0.3],
      objective1Required: 2,
      objective2Template: 'Vanquish {bossName}',
    },
    thermalVents: [],
  },
};

/**
 * Exact deterministic floor elevation function shared 1:1 across dungeon terrain height,
 * compiled GLB meshes, dynamic geometry grounders, and physics!
 */
export function dungeonTopologyHeightAt(
  style: CharterDungeonStyle,
  x: number,
  z: number,
): number {
  const charter = DUNGEON_TOPOLOGY_CHARTERS[style] ?? DUNGEON_TOPOLOGY_CHARTERS['catacomb-vault'];

  // Walkable zones take precedence so bridges/causeways always sit cleanly over hazards
  let bestWalkableY = -Infinity;
  for (const w of charter.walkableZones) {
    if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) {
      let y = w.elevation;
      // Smooth ramp transition on ascending ziggurat / sanctum steps
      if (w.id === 'ech-ramp-w' || w.id === 'ech-ramp-e') {
        const t = Math.max(0, Math.min(1, (15.5 - z) / 12.0));
        y = 1.0 + t * 1.1;
      } else if (w.id === 'ech-summit-stair') {
        const t = Math.max(0, Math.min(1, (-13.5 - z) / 6.5));
        y = 2.1 + t * 1.2;
      } else if (w.id === 'cat-sanctum' || w.id === 'cis-sanctum' || w.id === 'geo-furnace-dais' || w.id === 'gla-choir-oct') {
        const riseT = Math.max(0, Math.min(1, (-15.0 - z) / 10.0));
        y = 1.05 + riseT * (w.elevation - 1.05);
      }
      if (y > bestWalkableY) bestWalkableY = y;
    }
  }
  if (bestWalkableY > -Infinity) return bestWalkableY;

  // Check hazard pits/chasms
  for (const hz of charter.hazardZones) {
    if (x >= hz.minX && x <= hz.maxX && z >= hz.minZ && z <= hz.maxZ) {
      const edgeDist = Math.min(x - hz.minX, hz.maxX - x, z - hz.minZ, hz.maxZ - z);
      const drop = Math.min(1, edgeDist / 1.8);
      return 1.0 + (hz.bedY - 1.0) * drop;
    }
  }

  return 1.0;
}

export function isOnDungeonWalkableFloor(
  style: CharterDungeonStyle,
  x: number,
  z: number,
): boolean {
  const charter = DUNGEON_TOPOLOGY_CHARTERS[style] ?? DUNGEON_TOPOLOGY_CHARTERS['catacomb-vault'];
  return charter.walkableZones.some(
    (w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
  );
}

// =============================================================================
// 3. CONSERVATION-VERIFIED NARRATIVE AUTOMATA (verdant-core/src/narrative.rs)
// =============================================================================

export function verifyStoryAutomaton(automaton: StoryAutomaton): StoryVerificationReport {
  const stateIds = new Set(automaton.states.map((s) => s.id));
  const visited = new Set<string>();
  const queue: string[] = [];

  if (stateIds.has(automaton.startState)) {
    visited.add(automaton.startState);
    queue.push(automaton.startState);
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of automaton.edges) {
      if (edge.from === cur && stateIds.has(edge.to) && !visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  const unreachableStates = automaton.states
    .map((s) => s.id)
    .filter((id) => !visited.has(id));
  const terminalReachable = visited.has(automaton.terminalState);
  const reachableFromStart = unreachableStates.length === 0;

  // Every non-terminal state must have at least one outgoing transition (deadlock-free)
  const deadlockFree = automaton.states.every(
    (s) =>
      s.id === automaton.terminalState ||
      automaton.edges.some((e) => e.from === s.id && stateIds.has(e.to)),
  );

  // Conservation ledger invariant: before + minted - burned === after
  const ledgerViolations: string[] = [];
  for (const row of automaton.ledger) {
    if (row.before + row.minted - row.burned !== row.after) {
      ledgerViolations.push(
        `${row.resourceKey}: ${row.before}+${row.minted}-${row.burned}!=${row.after}`,
      );
    }
  }
  const conservationClosed = automaton.ledger.length > 0 && ledgerViolations.length === 0;

  return {
    automatonId: automaton.id,
    reachableFromStart,
    terminalReachable,
    deadlockFree,
    conservationClosed,
    unreachableStates,
    ledgerViolations,
    passed: reachableFromStart && terminalReachable && deadlockFree && conservationClosed,
  };
}

function buildStoryAutomaton(params: {
  id: string;
  title: string;
  domainId: string;
  motif: string;
  act1: string;
  act2: string;
  act3: string;
  resourceKey: string;
  minted: number;
  burned: number;
}): StoryAutomaton {
  const before = 100;
  const after = before + params.minted - params.burned;
  return {
    id: params.id,
    title: params.title,
    domainId: params.domainId,
    motif: params.motif,
    startState: 'arrival',
    terminalState: 'resolution',
    states: [
      { id: 'arrival', act: 1, label: 'Field Survey Arrival', objectiveSummary: params.act1 },
      { id: 'investigation', act: 2, label: 'Harmonic Calibration', objectiveSummary: params.act2 },
      { id: 'climax', act: 3, label: 'Apex Trial', objectiveSummary: params.act3 },
      { id: 'resolution', act: 3, label: 'Charter Ratified', objectiveSummary: `Seal ${params.title} in the Meridian Ledger.` },
    ],
    edges: [
      { from: 'arrival', to: 'investigation', condition: params.act1, resourceKey: params.resourceKey, minted: Math.round(params.minted * 0.4), burned: 0 },
      { from: 'investigation', to: 'climax', condition: params.act2, resourceKey: params.resourceKey, minted: Math.round(params.minted * 0.6), burned: Math.round(params.burned * 0.5) },
      { from: 'climax', to: 'resolution', condition: params.act3, resourceKey: params.resourceKey, minted: 0, burned: params.burned - Math.round(params.burned * 0.5) },
    ],
    ledger: [
      {
        resourceKey: params.resourceKey,
        before,
        minted: params.minted,
        burned: params.burned,
        after,
      },
    ],
  };
}

// =============================================================================
// 4. SIX COHESIVE WORLD DIFFERENTIATION PROFILES (SINGLE MODEL-FIRST TRUTH)
// =============================================================================

function createProfile(
  raw: Omit<WorldDifferentiationProfile, 'profileKappaHex'>,
): WorldDifferentiationProfile {
  const profileKappaHex = fnvHex(
    JSON.stringify({
      id: raw.profileId,
      theme: raw.theme,
      geo: raw.geomorphology.id,
      dg: raw.dungeonTopologyId,
      fauna: raw.faunaKit,
      flora: raw.floraKit,
      mode: raw.preferredMode,
      foley: raw.foleyProfile,
      species: Object.values(raw.monsterRoster).map((m) => m.speciesName),
      story: [raw.overworldStory.id, raw.dungeonStory.id],
    }),
  );
  return { ...raw, profileKappaHex };
}

export const WORLD_DIFFERENTIATION_PROFILES: Record<CharterRealmThemeId, WorldDifferentiationProfile> = {
  'citadel-highlands': createProfile({
    profileId: 'wdp-citadel-highlands',
    theme: 'citadel-highlands',
    domainLabel: 'Basalt Highlands & Causeway Charter',
    authority: 'AUTH-FRONTIERS-HIGHLANDS',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['citadel-highlands'],
    dungeonStyle: 'catacomb-vault',
    dungeonTopologyId: 'twin-span-reliquary',
    faunaKit: 'highland-ironclad',
    floraKit: 'ironwood-conifer',
    preferredMode: 'dorian',
    foleyProfile: 'highland-wind',
    acousticAbsorption: 0.42,
    guildId: 'guild-causeway',
    guildAffiliationName: 'Charter of the Southern Causeway',
    materials: {
      terrain: 'aerial_grass_rock',
      masonry: 'castle_brick_01',
      road: 'mossy_cobblestone',
      timber: 'dark_wooden_planks',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Shale-Husk Stalker', ecologicalNiche: 'Ridge pack flanker', tacticalSignature: 'Tangential circling lunge', baseHp: 65 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Cinder-Glass Shardcaster', ecologicalNiche: 'Quarry resonance sentinel', tacticalSignature: 'Long-range silicate bolt kiter', baseHp: 58 },
      charger: { archetype: 'charger', speciesName: 'Basalt-Horn Ram', ecologicalNiche: 'Highland territorial bull', tacticalSignature: 'Telegraphed linear horn rush', baseHp: 94 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Lodestone Bell-Cantor', ecologicalNiche: 'Acoustic ward weaver', tacticalSignature: 'Tri-bolt harmonic spread volley', baseHp: 64 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Slate-Talon Outrider', ecologicalNiche: 'Canyon rim ambusher', tacticalSignature: 'Dart-in slash + evasive backstep', baseHp: 60 },
      colossus: { archetype: 'colossus', speciesName: 'Basalt Tide-Colossus', ecologicalNiche: 'Apex foundation warden', tacticalSignature: 'Seismic basalt quake + radial shock', baseHp: 195 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-citadel-highlands',
      title: 'Structural Audit of the Third Pier',
      domainId: 'citadel-highlands',
      motif: 'civic load-tolerance masonry audit',
      act1: 'Consult Magistrate surveyor on viaduct resonance drop',
      act2: 'Sound the Third Pier with 174 Hz Bell-Hammer & attune Charter Waystone',
      act3: 'Topple the Basalt Tide-Colossus threatening the foundry basin',
      resourceKey: 'viaduct-bearing-integrity',
      minted: 45,
      burned: 15,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-catacomb-vault',
      title: 'Triangulation of the Twin-Span Reliquary',
      domainId: 'catacomb-vault',
      motif: 'twin-span ossuary resonance alignment',
      act1: 'Cross West or East parallel viaduct spans above the chasm',
      act2: 'Ignite both Ossuary Seal Braziers across the cross-hall',
      act3: 'Break the Charter Stone Colossus in the basalt amphitheater',
      resourceKey: 'ossuary-harmonic-charge',
      minted: 60,
      burned: 20,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Load-Bearing Survey of',
      motif: 'highland viaduct resonance audit',
      primaryVerb: 'Sound Causeway Pier',
      landmarkFocus: 'Parabolic Causeway Arch',
      relicFlavor: 'Lodestone Plumb-Weight',
    },
  }),

  'sunken-aqueducts': createProfile({
    profileId: 'wdp-sunken-aqueducts',
    theme: 'sunken-aqueducts',
    domainLabel: 'Verdant Aqueducts & Spore-Sluice Delta',
    authority: 'AUTH-FRONTIERS-AQUEDUCTS',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['sunken-aqueducts'],
    dungeonStyle: 'sunken-cistern',
    dungeonTopologyId: 'spiral-sluice-rotunda',
    faunaKit: 'verdant-mycelial',
    floraKit: 'weeping-banyan',
    preferredMode: 'lydian',
    foleyProfile: 'aqueduct-water',
    acousticAbsorption: 0.56,
    guildId: 'guild-causeway',
    guildAffiliationName: 'Fen-Glass Hydraulic Collective',
    materials: {
      terrain: 'brown_mud_leaves_01',
      masonry: 'brick_moss_001',
      road: 'cobblestone_02',
      timber: 'brown_planks_05',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Spore-Antler Stag', ecologicalNiche: 'Flooded glade grazer-predator', tacticalSignature: 'Regenerative flanking charge', baseHp: 68 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Mycelial Bell-Medusa', ecologicalNiche: 'Floating canopy spore caster', tacticalSignature: 'Drifting bioluminescent spore bolts', baseHp: 60 },
      charger: { archetype: 'charger', speciesName: 'Moss-Shell Terrapin', ecologicalNiche: 'Aqueduct spillway juggernaut', tacticalSignature: 'Armored bull-rush across canal decks', baseHp: 100 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Root-Siphon Weaver', ecologicalNiche: 'Lichen acoustic spore-caster', tacticalSignature: '3-way creeping spore fan', baseHp: 66 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Fern-Dart Hopper', ecologicalNiche: 'Canopy reed ambusher', tacticalSignature: 'Springing ambush strike + leap retreat', baseHp: 58 },
      colossus: { archetype: 'colossus', speciesName: 'Canopy Treant Sovereign', ecologicalNiche: 'Apex living-mortar guardian', tacticalSignature: 'Mycelial spore bloom + vitality surge', baseHp: 215 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-sunken-aqueducts',
      title: 'Hydraulic Rebalancing of the Terraced Sluices',
      domainId: 'sunken-aqueducts',
      motif: 'silicate-mortar aqueduct hydrology',
      act1: 'Meet the Hydraulic Botanist along the moss terraces',
      act2: 'Harvest bioluminescent silicate clusters & ring the Sluice Weir Bell',
      act3: 'Pacify the Canopy Treant Sovereign guarding the aqueduct spillway',
      resourceKey: 'aqueduct-head-pressure',
      minted: 50,
      burned: 18,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-sunken-cistern',
      title: 'Counterweight of the Spiral Sluice Rotunda',
      domainId: 'sunken-cistern',
      motif: 'four-way radial cistern weir tuning',
      act1: 'Cross the southern aqueduct span onto the central Lotus Hub',
      act2: 'Ring the West and East Sluice Bells across the flooded ring moat',
      act3: 'Shatter the Siphon-Core Leviathan Golem in the Drowned Weir',
      resourceKey: 'cistern-siphon-flow',
      minted: 65,
      burned: 25,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Weir Calibration of',
      motif: 'botanical silicate aqueduct irrigation',
      primaryVerb: 'Rebalance Sluice Weir',
      landmarkFocus: 'Moss-Arched Spillway',
      relicFlavor: 'Living Silicate Vial',
    },
  }),

  'obsidian-crucible': createProfile({
    profileId: 'wdp-obsidian-crucible',
    theme: 'obsidian-crucible',
    domainLabel: 'Obsidian Ring Caldera & Slag-Foundry',
    authority: 'AUTH-FRONTIERS-CRUCIBLE',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['obsidian-crucible'],
    dungeonStyle: 'geothermal-depths',
    dungeonTopologyId: 'crucible-island-ring',
    faunaKit: 'pyroclastic-forge',
    floraKit: 'obsidian-vent-spires',
    preferredMode: 'phrygian-dominant',
    foleyProfile: 'caldera-forge',
    acousticAbsorption: 0.31,
    guildId: 'guild-kiln',
    guildAffiliationName: 'Ashen Kiln Foundry Conclave',
    materials: {
      terrain: 'cliff_side',
      masonry: 'castle_wall_slates',
      road: 'cobblestone_04',
      timber: 'black_painted_planks',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Magma-Scale Salamander', ecologicalNiche: 'Fumarole lava-edge prowler', tacticalSignature: 'Blazing low-profile flank lunge', baseHp: 72 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Crucible Censer-Construct', ecologicalNiche: 'Floating slag-chain kiln drone', tacticalSignature: 'Superheated ember bolt barrage', baseHp: 64 },
      charger: { archetype: 'charger', speciesName: 'Slag-Anvil Battering Bull', ecologicalNiche: 'Caldera floor iron-ox', tacticalSignature: 'Incandescent furnace rush + slam', baseHp: 112 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Cinder-Bellows Pyromancer', ecologicalNiche: 'Vent pressure channeler', tacticalSignature: 'Triple molten arc spread', baseHp: 70 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Obsidian-Flint Skitterer', ecologicalNiche: 'Scoria ridge sprinter', tacticalSignature: 'Blistering slash + recoil backstep', baseHp: 64 },
      colossus: { archetype: 'colossus', speciesName: 'Caldera Furnace Titan', ecologicalNiche: 'Apex geothermal smelter', tacticalSignature: 'Caldera magma barrage + blast slam', baseHp: 245 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-obsidian-crucible',
      title: 'Venting the Caldera Bellows Ring',
      domainId: 'obsidian-crucible',
      motif: 'geothermal pressure acoustics',
      act1: 'Consult the Kiln Founder on rising caldera tremor harmonics',
      act2: 'Strike the Caldera Forge Bell & bleed the Obsidian Slag Waystone',
      act3: 'Subdue the Caldera Furnace Titan before the basin fractures',
      resourceKey: 'caldera-thermal-equilibrium',
      minted: 55,
      burned: 22,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-geothermal-depths',
      title: 'Quenching the Crucible Island Core',
      domainId: 'geothermal-depths',
      motif: 'suspended lava-island valve quenching',
      act1: 'Cross the molten lake onto the central Anvil-Core Island',
      act2: 'Vent both Crucible Quench Valves on the flanking slag bastions',
      act3: 'Break the Anvil-Heart Caldera Warden at the Blast Furnace Dais',
      resourceKey: 'furnace-quench-pressure',
      minted: 70,
      burned: 30,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Thermal Quench of',
      motif: 'caldera slag-vent acoustic forging',
      primaryVerb: 'Quench Magma Vent',
      landmarkFocus: 'Obsidian Bellows Bastion',
      relicFlavor: 'Quenched Slag Ingot',
    },
  }),

  'pelagic-spires': createProfile({
    profileId: 'wdp-pelagic-spires',
    theme: 'pelagic-spires',
    domainLabel: 'Pelagic Sea-Stacks & Copper Tide-Loom',
    authority: 'AUTH-FRONTIERS-PELAGIC',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['pelagic-spires'],
    dungeonStyle: 'abyssal-grotto',
    dungeonTopologyId: 'tidal-atoll-stepping-stones',
    faunaKit: 'pelagic-abyssal',
    floraKit: 'coral-palm-atoll',
    preferredMode: 'mixolydian',
    foleyProfile: 'ocean-surf',
    acousticAbsorption: 0.48,
    guildId: 'guild-tideloom',
    guildAffiliationName: 'Tide-Loom Cartographers',
    materials: {
      terrain: 'coast_sand_rocks_02',
      masonry: 'castle_brick_01',
      road: 'cobblestone_floor_01',
      timber: 'brown_planks_03',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Coral-Shell Tide-Crab', ecologicalNiche: 'Intertidal shoal scavenger', tacticalSignature: 'Scuttling pincer flank strike', baseHp: 66 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Abyssal Drift-Manta', ecologicalNiche: 'Bioluminescent sea-mist glider', tacticalSignature: 'High-velocity brine prism bolts', baseHp: 60 },
      charger: { archetype: 'charger', speciesName: 'Barnacle-Ram Dugong', ecologicalNiche: 'Breakwater surf bull', tacticalSignature: 'Tidal surge ramming rush', baseHp: 98 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Sextant Jelly-Cantor', ecologicalNiche: 'Current-reading shoal caster', tacticalSignature: '3-way luminescent undertow arc', baseHp: 66 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Sea-Glass Skimmer', ecologicalNiche: 'Tidepool ambush dart', tacticalSignature: 'Swift brine-blade pass + splash retreat', baseHp: 62 },
      colossus: { archetype: 'colossus', speciesName: 'Reef-Spire Leviathan', ecologicalNiche: 'Apex archipelago guardian', tacticalSignature: 'Maelstrom tide volley + undertow slam', baseHp: 220 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-pelagic-spires',
      title: 'Eleven-Year Drift of the Copper Shoals',
      domainId: 'pelagic-spires',
      motif: 'tectonic tide-wire navigation',
      act1: 'Take low-water sextant bearings with the Tide-Loom Cartographer',
      act2: 'Calibrate the Headland Lighthouse Waystone & tension the shore beacon',
      act3: 'Drive back the Reef-Spire Leviathan disrupting the shipping strait',
      resourceKey: 'navigational-wire-tension',
      minted: 48,
      burned: 16,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-abyssal-grotto',
      title: 'Bearings of the S-Curve Coral Grotto',
      domainId: 'abyssal-grotto',
      motif: 'submerged atoll sextant alignment',
      act1: 'Cross the driftwood gangplanks to the Western Shipwreck Shoal',
      act2: 'Calibrate the Shipwreck and East Coral Sextant Waystones',
      act3: 'Defeat the Abyssal Shoal Sentinel in the Bioluminescent Reef',
      resourceKey: 'sextant-bearing-lock',
      minted: 62,
      burned: 22,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Tidal Triangulation of',
      motif: 'ephemeral copper-wire sea cartography',
      primaryVerb: 'Calibrate Sextant Spire',
      landmarkFocus: 'Breakwater Lighthouse',
      relicFlavor: 'Sea-Glass Astrolabe Lens',
    },
  }),

  'amber-steppe': createProfile({
    profileId: 'wdp-amber-steppe',
    theme: 'amber-steppe',
    domainLabel: 'Amber Steppe Mesas & Aeolian Wind-Harps',
    authority: 'AUTH-FRONTIERS-STEPPE',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['amber-steppe'],
    dungeonStyle: 'echo-tomb',
    dungeonTopologyId: 'stepped-ziggurat-labyrinth',
    faunaKit: 'dune-sandstrider',
    floraKit: 'mesa-hoodoo-juniper',
    preferredMode: 'harmonic-minor',
    foleyProfile: 'steppe-chimes',
    acousticAbsorption: 0.28,
    guildId: 'guild-kiln',
    guildAffiliationName: 'Aeolian Caravan Tuners',
    materials: {
      terrain: 'aerial_sand',
      masonry: 'large_sandstone_blocks_01',
      road: 'cobblestone_01',
      timber: 'brown_planks_03',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Dune-Chitin Sandstrider', ecologicalNiche: 'Arid canyon stalker-scorpion', tacticalSignature: 'High-speed tail-lash flank', baseHp: 70 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Sun-Djinn Astrolabe', ecologicalNiche: 'Gyroscopic brass mirage construct', tacticalSignature: 'Focused solar lens beams', baseHp: 64 },
      charger: { archetype: 'charger', speciesName: 'Ochre-Crest Sand-Bull', ecologicalNiche: 'Mesa canyon breaker', tacticalSignature: 'Dust-storm straight-line horn charge', baseHp: 106 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Wind-Harp Mirage Cantor', ecologicalNiche: 'Canyon echo illusionist', tacticalSignature: 'Tri-chord golden sonic spread', baseHp: 70 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Saffron-Scythe Strider', ecologicalNiche: 'Dune crest skirmisher', tacticalSignature: 'Blinding sand-dart strike + spring back', baseHp: 66 },
      colossus: { archetype: 'colossus', speciesName: 'Sun-Disk Sandstone Colossus', ecologicalNiche: 'Apex ziggurat automaton', tacticalSignature: 'Mirage sun-lance charge + solar fan', baseHp: 245 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-amber-steppe',
      title: 'Counterpoint of the Caravan Wind-Harps',
      domainId: 'amber-steppe',
      motif: 'aeolian sandstone acoustic relay',
      act1: 'Inspect the detuned bronze harp frame with the Caravan Tuner',
      act2: 'Harvest resonant canyon amber shards & attune the Mesa Relay',
      act3: 'Silence the Sun-Disk Sandstone Colossus blocking the trade pass',
      resourceKey: 'aeolian-harmonic-drift',
      minted: 52,
      burned: 19,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-echo-tomb',
      title: 'Ascent of the Three-Tier Resonance Ziggurat',
      domainId: 'echo-tomb',
      motif: 'dry stepped-ziggurat wind-harp counterpoint',
      act1: 'Split around the central baffle wall up the West or East ziggurat ramps',
      act2: 'Harvest both Aeolian Tuning Shards framing the Amber Sand Well',
      act3: 'Climb to Tier III and defeat the Grand Wind-Harp Automaton',
      resourceKey: 'ziggurat-acoustic-pitch',
      minted: 68,
      burned: 24,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Wind-Harp Tuning of',
      motif: 'aeolian sandstone canyon harmonics',
      primaryVerb: 'Tune Bronze Wind-Harp',
      landmarkFocus: 'Stepped Sandstone Ziggurat',
      relicFlavor: 'Ochre Resonance Chime',
    },
  }),

  'glacial-spire': createProfile({
    profileId: 'wdp-glacial-spire',
    theme: 'glacial-spire',
    domainLabel: 'Borealis Glacial Cirque & Frostglass Choir',
    authority: 'AUTH-FRONTIERS-GLACIAL',
    geomorphology: TERRAIN_GEOMORPHOLOGIES['glacial-spire'],
    dungeonStyle: 'glacial-crypt',
    dungeonTopologyId: 'bifurcated-prism-cloister',
    faunaKit: 'glacial-frostborn',
    floraKit: 'frostglass-crystal-pine',
    preferredMode: 'aeolian',
    foleyProfile: 'glacial-aurora',
    acousticAbsorption: 0.22,
    guildId: 'guild-tideloom',
    guildAffiliationName: 'Borealis Prism Choir',
    materials: {
      terrain: 'snow_02',
      masonry: 'castle_wall_slates',
      road: 'asphalt_snow',
      timber: 'dark_wooden_planks',
    },
    monsterRoster: {
      stalker: { archetype: 'stalker', speciesName: 'Rime-Fang Frost-Wolf', ecologicalNiche: 'Glacial ridge pack hunter', tacticalSignature: 'Crystalline flank lunge', baseHp: 74 },
      shardcaster: { archetype: 'shardcaster', speciesName: 'Aurora Prism-Wraith', ecologicalNiche: 'Refractive ice-lens sentinel', tacticalSignature: 'Piercing frostglass beam kiter', baseHp: 68 },
      charger: { archetype: 'charger', speciesName: 'Glacier-Horn Tusk-Ram', ecologicalNiche: 'Cirque avalanche bruiser', tacticalSignature: 'Permafrost horn-charge + knockback', baseHp: 116 },
      hexweaver: { archetype: 'hexweaver', speciesName: 'Hoarfrost Choir Cantor', ecologicalNiche: 'Crevasse echo weaver', tacticalSignature: 'Triple frost-prism spread volley', baseHp: 76 },
      skirmisher: { archetype: 'skirmisher', speciesName: 'Icicle-Talon Stalker', ecologicalNiche: 'Snow-drift ambusher', tacticalSignature: 'Flash-freeze cut + agile back-vault', baseHp: 68 },
      colossus: { archetype: 'colossus', speciesName: 'Aurora Obelisk Sovereign', ecologicalNiche: 'Apex permafrost choir guardian', tacticalSignature: 'Frostglass prism fan + glacial slam', baseHp: 270 },
    },
    overworldStory: buildStoryAutomaton({
      id: 'story-ow-glacial-spire',
      title: 'Refraction of the Polar Aurora Lens',
      domainId: 'glacial-spire',
      motif: 'cryogenic crystal optics & aurora harmonics',
      act1: 'Consult the Borealis Prism Keeper on creeping permafrost drift',
      act2: 'Ring the Rime-Bell Cirque & calibrate the Aurora Prism Spire',
      act3: 'Shatter the Aurora Obelisk Sovereign atop the frozen fjord',
      resourceKey: 'aurora-refraction-index',
      minted: 58,
      burned: 21,
    }),
    dungeonStory: buildStoryAutomaton({
      id: 'story-dg-glacial-crypt',
      title: 'Canticle of the Bifurcated Prism Cloisters',
      domainId: 'glacial-crypt',
      motif: 'crevasse-split mirror-ice choir tuning',
      act1: 'Enter the Frostglass Narthex and choose West or East crystal cloisters',
      act2: 'Tune both Choir Prism Obelisks flanking the central Glacial Rift',
      act3: 'Confront the Frostglass Choir Archon in the Aurora Octagon',
      resourceKey: 'choir-crystal-coherence',
      minted: 75,
      burned: 28,
    }),
    overworldPlotHook: {
      questTitlePrefix: 'Aurora Refraction of',
      motif: 'frostglass optical beacon calibration',
      primaryVerb: 'Focus Aurora Prism',
      landmarkFocus: 'Frostglass Choir Spire',
      relicFlavor: 'Boreal Refraction Prism',
    },
  }),
};

export function getWorldDifferentiationProfile(
  theme: CharterRealmThemeId,
): WorldDifferentiationProfile {
  return (
    WORLD_DIFFERENTIATION_PROFILES[theme] ??
    WORLD_DIFFERENTIATION_PROFILES['citadel-highlands']
  );
}

export function getDungeonTopologyCharter(
  style: CharterDungeonStyle,
): DungeonTopologyCharter {
  return (
    DUNGEON_TOPOLOGY_CHARTERS[style] ??
    DUNGEON_TOPOLOGY_CHARTERS['catacomb-vault']
  );
}

export function getAllStoryAutomata(): StoryAutomaton[] {
  const out: StoryAutomaton[] = [];
  for (const prof of Object.values(WORLD_DIFFERENTIATION_PROFILES)) {
    out.push(prof.overworldStory, prof.dungeonStory);
  }
  return out;
}

export function getMonsterSpeciesForTheme(
  theme: CharterRealmThemeId,
  archetype: EnemyArchetype,
): MonsterSpeciesEntry {
  const prof = getWorldDifferentiationProfile(theme);
  return prof.monsterRoster[archetype] ?? prof.monsterRoster.stalker;
}
