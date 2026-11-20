import type {
  GameNpc,
  GameQuest,
  RegionId,
  WorldInteractable,
  WorldRegion,
} from '../game/worldData';
import type { EnemyArchetype, EnemyEntity } from '../game/rpgLogic';
import {
  getCanonicalSoundtrackForTheme,
  type RealmSoundtrackSpec,
} from './verdantScoreSchema';

export type RealmThemeId =
  | 'citadel-highlands'
  | 'sunken-aqueducts'
  | 'obsidian-crucible'
  | 'pelagic-spires'
  | 'amber-steppe'
  | 'glacial-spire';

export type DungeonArchitecturalStyle =
  | 'catacomb-vault'
  | 'geothermal-depths'
  | 'sunken-cistern'
  | 'abyssal-grotto'
  | 'echo-tomb'
  | 'glacial-crypt';

export interface DungeonEntranceSpec {
  id: string;
  dungeonSlug: string;
  name: string;
  subtitle: string;
  position: [number, number];
  tier: number;
  style: DungeonArchitecturalStyle;
}

export interface RealmTerrainProfile {
  macroAmp: number;
  macroFreq: number;
  gorgeDepth: number;
  gorgeZ: number;
  gorgeWaveAmp: number;
  citadelLift: number;
  citadelZ: number;
  coastDip: number;
  rimStart: number;
  rimHeight: number;
  waterLevel: number;
  hasBridge: boolean;
  bridgeDeckY: number;
  bridgeZMin: number;
  bridgeZMax: number;
  bridgeHalfWidth: number;
}

export interface ImportedCatalogPropPlacement {
  id: string;
  assetId: string;
  source: 'polyhaven' | 'khronos';
  label: string;
  position: [number, number];
  yOffset?: number;
  targetHeight: number;
  yaw: number;
  tintRgb: [number, number, number];
  maxTriangles?: number;
}

export interface RealmFastTravelPoint {
  regionId: RegionId;
  name: string;
  x: number;
  z: number;
}

export interface RealmPrismCustody {
  worldGlbKappa: string;
  vdntKappa: string;
  skyKappa: string;
  triangles: number;
  vertices: number;
  glbBytes: number;
  atlasTileCount: number;
  importedCatalogModelsCount: number;
  importedCatalogAssets: string[];
  projectModelsRegistered: number;
  cognitiveKnowledgeIngested: number;
  operatorAdmitted: boolean;
  stitchRecoveryVerified: boolean;
  stitchShardSizes: number[];
  observerPartsHydrated: number;
}

export interface FrontiersRealmSpec {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  cell: [number, number, number];
  theme: RealmThemeId;
  seed: number;
  summary: string;
  skyAssetId: string;
  skyUrl: string;
  glbUrl: string;
  vdntUrl: string;
  ambientMood: WorldRegion['ambientMood'];
  skyFallbackRgb: [number, number, number];
  fogRgb: [number, number, number];
  spawnPoint: [number, number];
  worldHalfExtent: number;
  isDungeon?: boolean;
  parentRealmSlug?: string;
  dungeonStyle?: DungeonArchitecturalStyle;
  dungeonTier?: number;
  dungeonEntrances: DungeonEntranceSpec[];
  soundtrack: RealmSoundtrackSpec;
  materials: {
    terrain: string;
    masonry: string;
    road: string;
    timber: string;
  };
  terrainProfile: RealmTerrainProfile;
  importedCatalogProps: ImportedCatalogPropPlacement[];
  regions: WorldRegion[];
  fastTravelPoints: RealmFastTravelPoint[];
  npcs: GameNpc[];
  quests: GameQuest[];
  interactables: WorldInteractable[];
  enemies: EnemyEntity[];
  isGenerated?: boolean;
  isProceduralCell?: boolean;
  prismCustody?: RealmPrismCustody;
}

/**
 * Spatial stride (in meters) between adjacent Verdant UniverseCells on the infinite Meridian grid.
 * Cell (cx, 0, cz) spans local coordinates [-96..+96] along X and Z, meeting neighbor (cx+1, 0, cz)
 * at world coordinate cx * CELL_STRIDE + 96 === (cx + 1) * CELL_STRIDE - 96.
 */
export const CELL_STRIDE = 192;
export const CELL_BORDER_HALF = CELL_STRIDE / 2; // 96m
export const CELL_BORDER_TRIGGER = 94;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Single source of truth for a realm's meandering river gorge centerline Z(x).
 * Shared identically by terrain carving, water mesh clipping, and hydrology audio.
 */
export function realmRiverCenterZ(spec: FrontiersRealmSpec, x: number): number {
  const p = spec.terrainProfile;
  const seedPhase = (spec.seed % 997) * 0.017;
  return p.gorgeZ + Math.sin(x * 0.055 + seedPhase) * p.gorgeWaveAmp;
}

/**
 * Continuous world-space elevation field shared identically across ALL UniverseCells (cx, 0, cz).
 * Integrates sweeping continent-scale mountain ranges, alpine passes, foothills, and broad valleys
 * directly into the terrain mesh (ZERO floating cone meshes!) while grading cardinal frontier road
 * passes so players can travel smoothly between cells OR hike directly up into the mountain ranges.
 */
export function worldGlobalHeightAt(worldX: number, worldZ: number): number {
  // Base rolling highland meadows and river valleys
  const macro1 =
    Math.sin(worldX * 0.0085 + 0.4) * Math.cos(worldZ * 0.0079 - 0.3) * 2.15;
  const macro2 =
    Math.sin(worldX * 0.017 - worldZ * 0.014 + 1.1) * 0.92;
  const micro =
    Math.cos(worldX * 0.036 + worldZ * 0.029) * 0.32;

  // Integrated multi-ridge continent mountain ranges (ridged multifractal with climbable foothills)
  const rangeEnvelope = smoothstep(
    0.26,
    0.86,
    Math.sin(worldX * 0.0046 - worldZ * 0.0039 + 1.15) * 0.5 + 0.5,
  );
  const ridgeA = 1 - Math.abs(Math.sin(worldX * 0.0115 + worldZ * 0.0072 + 0.65));
  const ridgeB = 1 - Math.abs(Math.cos(worldX * 0.0078 - worldZ * 0.0108 - 0.35));
  const spur = 1 - Math.abs(Math.sin(worldX * 0.024 + worldZ * 0.021 + 0.2));
  const mountainLift =
    rangeEnvelope * (Math.pow(ridgeA, 1.9) * 11.5 + Math.pow(ridgeB, 2.1) * 7.2 + Math.pow(spur, 2.0) * 2.2);

  let h = 1.2 + macro1 + macro2 + micro + mountainLift;

  // Gently carve mountain passes along cardinal frontier road axes (x ≈ 0 mod 192 or z ≈ 0 mod 192)
  // so every cell boundary road crosses smoothly through open passes while ridges flank both sides!
  const localX = (((worldX + CELL_BORDER_HALF) % CELL_STRIDE) + CELL_STRIDE) % CELL_STRIDE - CELL_BORDER_HALF;
  const localZ = (((worldZ + CELL_BORDER_HALF) % CELL_STRIDE) + CELL_STRIDE) % CELL_STRIDE - CELL_BORDER_HALF;
  const nearRoadAxis = Math.min(Math.abs(localX), Math.abs(localZ));
  if (nearRoadAxis < 14.0) {
    const roadPass = 1 - smoothstep(4.2, 14.0, nearRoadAxis);
    const passElevation = 1.25 + Math.sin(worldX * 0.007 + worldZ * 0.007) * 0.55;
    h = lerp(h, passElevation, roadPass * 0.92);
  }
  return h;
}

/**
 * Parametric deterministic elevation function shared 1:1 between the Verdant
 * GLB World Compiler, Procedural Cell Synthesizer, and browser 3D movement/camera grounder.
 * Mountains are sculpted directly into the terrain with climbable foothills and alpine ridges;
 * overworld cells seamlessly blend into `worldGlobalHeightAt` near their +/-96m boundaries
 * so neighboring UniverseCells connect bit-for-bit continuously.
 */
export function realmTerrainHeightAt(spec: FrontiersRealmSpec, x: number, z: number): number {
  if (spec.isDungeon) {
    // Multi-chamber vaulted interior layout:
    // Entry Vestibule (z: 18..34) -> Abyss Chasm (z: 4..18) -> Seal Rotunda (z: -14..4)
    // -> East/West Treasure Alcoves (|x| > 11, z: -10..2) -> Stepped Boss Sanctum (z: -38..-14)
    const inChasmBand = z > 4.2 && z < 17.8;
    if (inChasmBand) {
      const edgeT = Math.min(z - 4.2, 17.8 - z);
      const drop = Math.min(1, edgeT / 2.4);
      return lerp(1.0, -4.4, drop);
    }
    if (z <= -14) {
      // Gentle stepped rise into the northern Boss Sanctum amphitheater
      const riseT = Math.max(0, Math.min(1, (-14 - z) / 14));
      return 1.0 + riseT * 1.1;
    }
    return 1.0;
  }

  const p = spec.terrainProfile;
  const seedPhase = (spec.seed % 997) * 0.017;

  const macro =
    Math.sin(x * p.macroFreq + seedPhase) * Math.cos(z * (p.macroFreq * 0.92)) * p.macroAmp +
    Math.sin(x * (p.macroFreq * 2.15) + 0.8 + seedPhase) *
      Math.sin(z * (p.macroFreq * 2.0) - 0.5) *
      (p.macroAmp * 0.35);

  // Natural meandering river gorge with smooth walkable/wadeable banks tapering cleanly before borders
  const riverZ = realmRiverCenterZ(spec, x);
  const gorgeDist = Math.abs(z - riverZ);
  const gorgeSpanFade = 1 - smoothstep(52, 82, Math.abs(x));
  // Broad gentle outer bank slope + deeper central swimming channel
  const gorgeCut =
    (Math.exp(-(gorgeDist * gorgeDist) / 42) * -p.gorgeDepth * 0.78 +
      Math.exp(-(gorgeDist * gorgeDist) / 14) * -p.gorgeDepth * 0.28) *
    gorgeSpanFade;

  // Southeastern coastal cove basin sloping naturally into the river mouth (zero sharp edges)
  const coastDist = Math.hypot((x - 36) * 0.92, (z - 34) * 1.05);
  const coastDip = Math.exp(-(coastDist * coastDist) / 420) * -p.coastDip * 1.15;

  const citDist = Math.hypot(x, z - p.citadelZ);
  const citLift = Math.exp(-(citDist * citDist) / 195) * p.citadelLift;

  const northWatchDist = Math.hypot(x, z + 56);
  const northWatchLift = Math.exp(-(northWatchDist * northWatchDist) / 280) * (p.citadelLift * 0.85);

  // Integrated Local Climbable Mountain Massifs & Foothill Ridges (part of the terrain!)
  // Placed in open outer quadrants away from roads, bridge, citadel, and settlement landmarks,
  // with broad walkable foothill approaches (slope ~0.30..0.58) so players can hike UP into them!
  const peakAmp =
    spec.theme === 'glacial-spire'
      ? 1.18
      : spec.theme === 'obsidian-crucible'
        ? 1.12
        : spec.theme === 'pelagic-spires'
          ? 0.88
          : 1.0;

  const nwPeakDist = Math.hypot((x + 48) * 0.82, (z + 56) * 0.92);
  const nwSubRidge = Math.hypot((x + 68) * 0.85, (z + 36) * 0.85);
  const nePeakDist = Math.hypot((x - 50) * 0.84, (z + 52) * 0.90);
  const neSubRidge = Math.hypot((x - 70) * 0.9, (z + 28) * 0.85);
  const swPeakDist = Math.hypot((x + 56) * 0.85, (z - 52) * 0.88);
  const ridgeDetail = 1.0 + Math.sin(x * 0.09 + z * 0.08 + seedPhase) * 0.14;

  const mountainRangeLift =
    peakAmp *
    ridgeDetail *
    (Math.exp(-(nwPeakDist * nwPeakDist) / 560) * 13.8 +
      Math.exp(-(nwSubRidge * nwSubRidge) / 420) * 8.4 +
      Math.exp(-(nePeakDist * nePeakDist) / 520) * 12.6 +
      Math.exp(-(neSubRidge * neSubRidge) / 380) * 7.8 +
      Math.exp(-(swPeakDist * swPeakDist) / 520) * 11.4);

  const spawnDist = Math.hypot(x - spec.spawnPoint[0], z - spec.spawnPoint[1]);
  const spawnFlat = Math.exp(-(spawnDist * spawnDist) / 110);

  const westDist = Math.hypot(x + 26, z + 6);
  const westFlat = Math.exp(-(westDist * westDist) / 130);

  const farWestDist = Math.hypot(x + 54, z + 22);
  const farWestFlat = Math.exp(-(farWestDist * farWestDist) / 190);

  const farEastDist = Math.hypot(x - 54, z - 10);
  const farEastFlat = Math.exp(-(farEastDist * farEastDist) / 190);

  const dungeonEntranceDist = Math.hypot(x + 14, z + 34);
  const dungeonFlat = Math.exp(-(dungeonEntranceDist * dungeonEntranceDist) / 95);

  let h = macro + gorgeCut + coastDip + citLift + northWatchLift + mountainRangeLift;
  h = lerp(h, 0.9, spawnFlat * 0.88);
  h = lerp(h, 0.65, westFlat * 0.82);
  h = lerp(h, 1.85, farWestFlat * 0.82);
  h = lerp(h, 1.45, farEastFlat * 0.82);
  h = lerp(h, 2.2, dungeonFlat * 0.84);

  // Keep cardinal frontier roads smoothly graded through mountain foothills & valleys
  const onNsCorridor = Math.abs(x) < 8.5 && (z > 12 || z < -28);
  const onEwCorridor = Math.abs(z) < 8.5 && Math.abs(x) > 14;
  if (onNsCorridor) {
    const corrBlend = 1 - smoothstep(3.8, 8.5, Math.abs(x));
    const roadTarget = z > 12 ? 0.95 : 1.75;
    h = lerp(h, roadTarget, corrBlend * 0.78);
  } else if (onEwCorridor) {
    const corrBlend = 1 - smoothstep(3.8, 8.5, Math.abs(z));
    // Only flatten mountain lift above water, never erase the river gorge!
    if (h > 1.2) {
      h = lerp(h, 1.45, corrBlend * 0.78);
    }
  }

  // Seamless continuous border blending toward worldGlobalHeightAt so neighboring
  // UniverseCells share exact border elevation (including mountain ranges spanning borders!)
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  const edgeBlend = smoothstep(66, CELL_BORDER_HALF, edgeDist);
  if (edgeBlend > 0) {
    const worldX = spec.cell[0] * CELL_STRIDE + x;
    const worldZ = spec.cell[2] * CELL_STRIDE + z;
    const globalH = worldGlobalHeightAt(worldX, worldZ);
    h = lerp(h, globalH, edgeBlend);
  }

  return h;
}

export function realmSurfaceHeightAt(spec: FrontiersRealmSpec, x: number, z: number): number {
  const p = spec.terrainProfile;
  const base = realmTerrainHeightAt(spec, x, z);
  if (
    p.hasBridge &&
    Math.abs(x) <= p.bridgeHalfWidth &&
    z >= p.bridgeZMin &&
    z <= p.bridgeZMax
  ) {
    return Math.max(base, p.bridgeDeckY);
  }
  return base;
}

export function getRealmRegionAt(spec: FrontiersRealmSpec, x: number, z: number): WorldRegion {
  let best = spec.regions[0];
  let bestDist = Infinity;
  for (const r of spec.regions) {
    const d = Math.hypot(x - r.center[0], z - r.center[1]);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

export function makeEnemy(
  id: string,
  archetype: EnemyArchetype,
  name: string,
  x: number,
  z: number,
  hp: number,
): EnemyEntity {
  const isColossus = archetype === 'colossus';
  const isCaster = archetype === 'shardcaster';
  return {
    id,
    archetype,
    name,
    x,
    z,
    homeX: x,
    homeZ: z,
    vx: 0,
    vz: 0,
    yaw: 0,
    hp,
    maxHp: hp,
    state: 'idle',
    stateTimer: 0,
    orbitSign: x >= 0 ? 1 : -1,
    hitFlashTimer: 0,
    koTimer: 0,
    attackDamage: isColossus ? 26 : isCaster ? 15 : 11,
    attackRadius: isColossus ? 4.4 : isCaster ? 12.0 : 2.7,
    moveSpeed: isColossus ? 3.3 : isCaster ? 4.5 : 6.2,
    aggroRadius: isColossus ? 20 : 17,
    preferredRange: isColossus ? 3.6 : isCaster ? 9.5 : 2.2,
    telegraphDuration: isColossus ? 0.95 : 0.6,
    hasAttackToken: false,
  };
}

/**
 * Six vast canonical Federated Meridian Realms (each 224m x 224m) declared via Verdant's
 * Model-Centric schema. Every Realm imports 14–18 real Poly Haven CC0 3D models, 4 PBR
 * texture sets, a photographic HDRI sky dome, bespoke orchestral soundtrack, outer frontier
 * districts, and a sculpted enterable 3D Dungeon Vault Gateway!
 */
export const CANONICAL_REALM_SPECS: FrontiersRealmSpec[] = [
  {
    id: 'realm-vaelmor',
    slug: 'vaelmor',
    name: 'The Shattered Meridian of Vaelmor',
    subtitle: 'Cell (0, 0, 0) · High Basalt Citadel & Outer Frontier Reaches',
    cell: [0, 0, 0],
    theme: 'citadel-highlands',
    seed: 7777,
    worldHalfExtent: 112,
    summary:
      'The vast chartered heart of the Meridian: twin parabolic basalt arches spanning the river gorge, flanked by the Ashen Kiln Foundry, Amber Ironwood Reaches, Northern Watch Spire, Western Monolith Ruins, and the Sunken Meridian Vault.',
    skyAssetId: 'belfast_sunset_puresky',
    skyUrl: '/verdant/realms/vaelmor/sky.jpg',
    glbUrl: '/verdant/realms/vaelmor/world.glb',
    vdntUrl: '/verdant/realms/vaelmor/world.vdnt',
    ambientMood: 'causeway',
    skyFallbackRgb: [0.34, 0.44, 0.56],
    fogRgb: [0.58, 0.52, 0.44],
    spawnPoint: [0, 21.5],
    soundtrack: getCanonicalSoundtrackForTheme('citadel-highlands', false, 'vaelmor', 'The Shattered Meridian of Vaelmor', 7777),
    dungeonEntrances: [
      {
        id: 'ent-vaelmor-vault',
        dungeonSlug: 'vault-of-vaelmor',
        name: 'The Sunken Meridian Vault',
        subtitle: 'Tier I Acoustic Catacomb · Beneath High Basalt Citadel',
        position: [-14, -34],
        tier: 1,
        style: 'catacomb-vault',
      },
    ],
    materials: {
      terrain: 'aerial_grass_rock',
      masonry: 'castle_brick_01',
      road: 'mossy_cobblestone',
      timber: 'dark_wooden_planks',
    },
    terrainProfile: {
      macroAmp: 2.8,
      macroFreq: 0.052,
      gorgeDepth: 4.8,
      gorgeZ: 5.0,
      gorgeWaveAmp: 3.4,
      citadelLift: 3.9,
      citadelZ: -18,
      coastDip: 2.5,
      rimStart: 92,
      rimHeight: 3.2,
      waterLevel: -0.95,
      hasBridge: true,
      bridgeDeckY: 1.55,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: [
      { id: 'vaelmor-statue-w', assetId: 'gothic_statue', source: 'polyhaven', label: 'Citadel Sentinel West', position: [-5.4, -10.2], targetHeight: 3.6, yaw: 0.25, tintRgb: [0.52, 0.51, 0.49], maxTriangles: 520 },
      { id: 'vaelmor-statue-e', assetId: 'gothic_statue', source: 'polyhaven', label: 'Citadel Sentinel East', position: [5.4, -10.2], targetHeight: 3.6, yaw: -0.25, tintRgb: [0.52, 0.51, 0.49], maxTriangles: 520 },
      { id: 'vaelmor-barrel-1', assetId: 'Barrel_01', source: 'polyhaven', label: 'Surveyor Cask', position: [-4.6, 17.6], targetHeight: 1.1, yaw: 0.4, tintRgb: [0.52, 0.36, 0.22], maxTriangles: 340 },
      { id: 'vaelmor-barrel-2', assetId: 'Barrel_02', source: 'polyhaven', label: 'Resin Cask', position: [-5.5, 18.2], targetHeight: 1.05, yaw: 1.7, tintRgb: [0.46, 0.32, 0.2], maxTriangles: 340 },
      { id: 'vaelmor-table-1', assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Charter Drafting Table', position: [-6.4, 16.6], targetHeight: 1.05, yaw: 0.0, tintRgb: [0.48, 0.34, 0.22], maxTriangles: 360 },
      { id: 'vaelmor-crate-1', assetId: 'old_military_crate', source: 'polyhaven', label: 'Causeway Supply Crate', position: [5.8, 16.2], targetHeight: 1.0, yaw: 0.5, tintRgb: [0.44, 0.4, 0.32], maxTriangles: 340 },
      { id: 'vaelmor-shield-1', assetId: 'kite_shield', source: 'polyhaven', label: 'Waywright Heraldic Shield', position: [-4.4, 14.8], yOffset: 1.4, targetHeight: 1.35, yaw: 0.0, tintRgb: [0.76, 0.62, 0.32], maxTriangles: 340 },
      { id: 'vaelmor-pot-1', assetId: 'brass_pot_01', source: 'polyhaven', label: 'Foundry Crucible', position: [-23.4, -5.2], targetHeight: 1.2, yaw: 0.8, tintRgb: [0.78, 0.58, 0.26], maxTriangles: 340 },
      { id: 'vaelmor-lantern-1', assetId: 'Lantern_01', source: 'polyhaven', label: 'Kiln Resonance Lamp', position: [-24.8, -6.8], targetHeight: 1.15, yaw: 0.2, tintRgb: [0.85, 0.64, 0.28], maxTriangles: 340 },
      { id: 'vaelmor-rock-1', assetId: 'boulder_01', source: 'polyhaven', label: 'Gorge Basalt Tor W', position: [-10.5, 7.2], targetHeight: 2.8, yaw: 0.6, tintRgb: [0.34, 0.35, 0.38], maxTriangles: 420 },
      { id: 'vaelmor-rock-2', assetId: 'moon_rock_01', source: 'polyhaven', label: 'Gorge Basalt Tor E', position: [11.2, 6.4], targetHeight: 3.1, yaw: 2.1, tintRgb: [0.32, 0.34, 0.37], maxTriangles: 420 },
      { id: 'vaelmor-fern-1', assetId: 'fern_02', source: 'polyhaven', label: 'Ironwood Fern Cluster', position: [19.4, -6.4], targetHeight: 1.5, yaw: 0.7, tintRgb: [0.24, 0.48, 0.24], maxTriangles: 340 },
      // Outer Vast Frontier & Dungeon Portal Props
      { id: 'vaelmor-vault-guard-w', assetId: 'gothic_statue', source: 'polyhaven', label: 'Vault Keeper West', position: [-17.4, -32.2], targetHeight: 3.8, yaw: 0.35, tintRgb: [0.44, 0.46, 0.50], maxTriangles: 480 },
      { id: 'vaelmor-vault-guard-e', assetId: 'gothic_statue', source: 'polyhaven', label: 'Vault Keeper East', position: [-10.6, -32.2], targetHeight: 3.8, yaw: -0.35, tintRgb: [0.44, 0.46, 0.50], maxTriangles: 480 },
      { id: 'vaelmor-north-estoc', assetId: 'antique_estoc', source: 'polyhaven', label: 'Northern Watch Monument Blade', position: [0, -56.5], yOffset: 1.2, targetHeight: 2.6, yaw: 0.2, tintRgb: [0.82, 0.76, 0.64], maxTriangles: 360 },
      { id: 'vaelmor-west-vase', assetId: 'antique_ceramic_vase_01', source: 'polyhaven', label: 'Monolith Offering Urn', position: [-51.5, -20.5], targetHeight: 1.45, yaw: 0.9, tintRgb: [0.64, 0.52, 0.38], maxTriangles: 340 },
      { id: 'vaelmor-east-camp-table', assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Eastern Caravan Table', position: [51.5, 11.5], targetHeight: 1.05, yaw: 0.4, tintRgb: [0.52, 0.36, 0.22], maxTriangles: 340 },
      { id: 'vaelmor-east-boulder', assetId: 'boulder_01', source: 'polyhaven', label: 'Ridge Monolith Boulder', position: [48.0, -14.0], targetHeight: 3.6, yaw: 1.5, tintRgb: [0.36, 0.35, 0.38], maxTriangles: 420 },
    ],
    regions: [
      { id: 'high-causeway', name: 'High Basalt Citadel', subtitle: 'Chartered Archway & Northern Plaza', center: [0, -14], radius: 18, ambientMood: 'causeway' },
      { id: 'ashen-kiln', name: 'Ashen Kiln Foundry', subtitle: 'Geothermal Bell Basin', center: [-26, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'ironwood-reaches', name: 'Amber Ironwood Reaches', subtitle: 'Bioluminescent Silicate Canopy', center: [26, -6], radius: 18, ambientMood: 'ironwood' },
      { id: 'salt-loom', name: 'Salt Loom Coast', subtitle: 'Obsidian Sea-Stacks & Tidal Pier', center: [26, 26], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: 'Southern Causeway', subtitle: 'Frontier Gateway', center: [0, 20], radius: 16, ambientMood: 'causeway' },
      { id: 'northern-watch', name: 'Northern Watch & Vault Approach', subtitle: 'Sunken Meridian Vault & Watchtower Ridge', center: [-6, -46], radius: 24, ambientMood: 'causeway' },
      { id: 'western-ruins', name: 'Western Monolith Circle', subtitle: 'Pre-Charter Standing Stones', center: [-54, -22], radius: 24, ambientMood: 'foundry' },
      { id: 'eastern-ridge', name: 'Eastern Caravan Ridge', subtitle: 'Timber Overlook & Frontier Reliquary', center: [54, 10], radius: 24, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Southern Causeway Gate', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'High Basalt Citadel', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Sunken Meridian Vault Gate', x: -14, z: -29.5 },
      { regionId: 'ashen-kiln', name: 'Ashen Kiln Foundry', x: -20.5, z: -4.5 },
      { regionId: 'ironwood-reaches', name: 'Amber Ironwood Reaches', x: 20.5, z: -5.0 },
      { regionId: 'western-ruins', name: 'Western Monolith Circle', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Eastern Caravan Ridge', x: 48, z: 10 },
    ],
    npcs: [], // Hydrated from canonical INITIAL_NPCS in App.tsx for Cell (0,0,0)
    quests: [],
    interactables: [],
    enemies: [],
  },
  {
    id: 'realm-oakhaven',
    slug: 'oakhaven',
    name: 'The Sunken Aqueducts of Oakhaven',
    subtitle: 'Cell (-1, 0, 0) · Moss-Draped Viaducts & Silicate Cisterns',
    cell: [-1, 0, 0],
    theme: 'sunken-aqueducts',
    seed: 1409,
    worldHalfExtent: 112,
    summary:
      'Vast flooded multi-tiered limestone aqueducts reclaimed by luminous emerald ferns, spanning hydraulic turbine basins, western cistern ruins, and the Flooded Siphon Catacombs.',
    skyAssetId: 'autumn_field_puresky',
    skyUrl: '/verdant/realms/oakhaven/sky.jpg',
    glbUrl: '/verdant/realms/oakhaven/world.glb',
    vdntUrl: '/verdant/realms/oakhaven/world.vdnt',
    ambientMood: 'ironwood',
    skyFallbackRgb: [0.38, 0.50, 0.46],
    fogRgb: [0.52, 0.58, 0.50],
    spawnPoint: [0, 20.5],
    soundtrack: getCanonicalSoundtrackForTheme('sunken-aqueducts', false, 'oakhaven', 'The Sunken Aqueducts of Oakhaven', 1409),
    dungeonEntrances: [
      {
        id: 'ent-oakhaven-cistern',
        dungeonSlug: 'oakhaven-cistern-labyrinth',
        name: 'The Flooded Siphon Catacombs',
        subtitle: 'Tier II Hydraulic Labyrinth · Beneath Crown Cistern',
        position: [-14, -34],
        tier: 2,
        style: 'sunken-cistern',
      },
    ],
    materials: {
      terrain: 'brown_mud_leaves_01',
      masonry: 'brick_moss_001',
      road: 'cobblestone_02',
      timber: 'brown_planks_05',
    },
    terrainProfile: {
      macroAmp: 2.3,
      macroFreq: 0.048,
      gorgeDepth: 5.2,
      gorgeZ: 4.5,
      gorgeWaveAmp: 3.6,
      citadelLift: 3.4,
      citadelZ: -17,
      coastDip: 2.8,
      rimStart: 92,
      rimHeight: 3.0,
      waterLevel: -0.65,
      hasBridge: true,
      bridgeDeckY: 1.6,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.9,
    },
    importedCatalogProps: [
      { id: 'oak-statue-1', assetId: 'gothic_statue', source: 'polyhaven', label: 'Aqueduct Lock-Saint W', position: [-5.8, -10.5], targetHeight: 3.8, yaw: 0.3, tintRgb: [0.42, 0.50, 0.40], maxTriangles: 480 },
      { id: 'oak-statue-2', assetId: 'gothic_statue', source: 'polyhaven', label: 'Aqueduct Lock-Saint E', position: [5.8, -10.5], targetHeight: 3.8, yaw: -0.3, tintRgb: [0.42, 0.50, 0.40], maxTriangles: 480 },
      { id: 'oak-fern-1', assetId: 'fern_02', source: 'polyhaven', label: 'Cistern Frond W', position: [-6.5, 14.5], targetHeight: 1.7, yaw: 0.2, tintRgb: [0.22, 0.52, 0.25], maxTriangles: 340 },
      { id: 'oak-fern-2', assetId: 'fern_02', source: 'polyhaven', label: 'Cistern Frond E', position: [6.8, 13.8], targetHeight: 1.85, yaw: 1.9, tintRgb: [0.20, 0.48, 0.24], maxTriangles: 340 },
      { id: 'oak-fern-3', assetId: 'fern_02', source: 'polyhaven', label: 'Aqueduct Moss Fern', position: [14.5, -4.5], targetHeight: 1.9, yaw: 0.9, tintRgb: [0.25, 0.55, 0.27], maxTriangles: 340 },
      { id: 'oak-pot-1', assetId: 'ceramic_pot', source: 'polyhaven', label: 'Silicate Filtration Urn', position: [-4.2, 16.5], targetHeight: 1.15, yaw: 0.5, tintRgb: [0.64, 0.46, 0.32], maxTriangles: 300 },
      { id: 'oak-pot-2', assetId: 'antique_ceramic_vase_01', source: 'polyhaven', label: 'Rain-Gauge Amphora', position: [4.6, 16.0], targetHeight: 1.25, yaw: 2.1, tintRgb: [0.60, 0.44, 0.30], maxTriangles: 320 },
      { id: 'oak-barrel-1', assetId: 'Barrel_01', source: 'polyhaven', label: 'Sluice Lime Barrel', position: [-7.2, 17.5], targetHeight: 1.1, yaw: 1.1, tintRgb: [0.48, 0.35, 0.22], maxTriangles: 300 },
      { id: 'oak-rock-1', assetId: 'boulder_01', source: 'polyhaven', label: 'Mossy Limestone Outcrop', position: [-14.0, -5.0], targetHeight: 3.2, yaw: 1.3, tintRgb: [0.36, 0.42, 0.34], maxTriangles: 420 },
      { id: 'oak-table-1', assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Hydraulic Survey Bench', position: [-5.8, 17.2], targetHeight: 1.0, yaw: 0.1, tintRgb: [0.44, 0.33, 0.21], maxTriangles: 320 },
      { id: 'oak-lantern-1', assetId: 'Lantern_01', source: 'polyhaven', label: 'Siphon Gate Lamp', position: [-11.5, -31.5], targetHeight: 1.3, yaw: 0.2, tintRgb: [0.46, 0.82, 0.62], maxTriangles: 320 },
      { id: 'oak-west-boulder', assetId: 'boulder_01', source: 'polyhaven', label: 'Fen Monolith Stone', position: [-52, -20], targetHeight: 3.4, yaw: 0.8, tintRgb: [0.35, 0.44, 0.34], maxTriangles: 400 },
      { id: 'oak-east-fern', assetId: 'fern_02', source: 'polyhaven', label: 'Highland Spore Fern', position: [51, 9], targetHeight: 2.1, yaw: 1.2, tintRgb: [0.22, 0.56, 0.30], maxTriangles: 340 },
    ],
    regions: [
      { id: 'high-causeway', name: 'Oakhaven Crown Cistern', subtitle: 'Great Moss Aqueduct & Sluice Keep', center: [0, -14], radius: 18, ambientMood: 'ironwood' },
      { id: 'ashen-kiln', name: 'Silt-Wheel Mill', subtitle: 'Western Hydraulic Turbine Basin', center: [-25, -6], radius: 18, ambientMood: 'causeway' },
      { id: 'ironwood-reaches', name: 'Emerald Fern Terrace', subtitle: 'Bioluminescent Root Conduit', center: [25, -6], radius: 18, ambientMood: 'ironwood' },
      { id: 'salt-loom', name: 'Spillway Fen', subtitle: 'Flooded Archway Delta', center: [24, 24], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: 'Oakhaven Lock Gate', subtitle: 'Western Meridian Entry', center: [0, 19], radius: 16, ambientMood: 'ironwood' },
      { id: 'northern-watch', name: 'Siphon Catacomb Overlook', subtitle: 'Flooded Siphon Vault Entrance', center: [-6, -46], radius: 24, ambientMood: 'ironwood' },
      { id: 'western-ruins', name: 'Old Reservoir Ring', subtitle: 'Collapsed Artesian Cisterns', center: [-54, -22], radius: 24, ambientMood: 'causeway' },
      { id: 'eastern-ridge', name: 'Moss-Arch Overlook', subtitle: 'Upper Watershed Timber Camp', center: [54, 10], radius: 24, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Oakhaven Lock Gate', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'Oakhaven Crown Cistern', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Siphon Catacomb Portal', x: -14, z: -29.5 },
      { regionId: 'ashen-kiln', name: 'Silt-Wheel Mill', x: -20, z: -5 },
      { regionId: 'western-ruins', name: 'Old Reservoir Ring', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Moss-Arch Overlook', x: 48, z: 10 },
    ],
    npcs: [
      {
        id: 'npc-maren',
        name: 'Lock-Keeper Maren Holt',
        title: 'Chief Hydraulic Engineer',
        guildId: 'guild-causeway',
        guildName: 'Oakhaven Sluice Guild',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_orenna_1795129454002.jpg',
        position: [-3.2, 15.6],
        cloakHex: 0x3f7b65,
        trimHex: 0xd4a253,
        greeting:
          'Step lightly across the mossy sluice, Waywright. The Crown Cistern dropped four palms overnight—and the Flooded Siphon Catacombs north of the keep have begun vibrating.',
        cognitiveDrive: 'Maintain clean artesian head pressure across Oakhaven without draining the fern terraces.',
        concealedSecret: 'She diverted a hidden siphon toward the dry eastern villages against Citadel toll decrees.',
        speechCadence: 'Calm, practical, measured in water levels and masonry joints.',
        beliefs: [
          'Water belongs to the watershed before any charter tax.',
          'Moss binds mortar longer than iron clamps if kept wet.',
        ],
        choices: [
          {
            id: 'maren-1',
            label: 'Where is the aqueduct losing head pressure?',
            reply:
              'Sound the Sunken Sluice Arch on the bridge with your Bell-Hammer, then explore the Siphon Catacombs northwest of the Crown Cistern.',
            thought: 'Checking whether the Waywright notices the eastern overflow diversion.',
            renownGain: 25,
            advancesQuestId: 'quest-oak-sluice',
          },
          {
            id: 'maren-2',
            label: 'Why does the fern moss glow emerald after dusk?',
            reply:
              'Dissolved feldspar from the upper watershed feeds its spores. Harvest nodules along the Fern Terrace and our mortar seals underwater.',
            thought: 'Hoping this Waywright values ecological repair over salvage tolls.',
            renownGain: 20,
          },
        ],
      },
      {
        id: 'npc-haldor',
        name: 'Sluice-Wright Haldor',
        title: 'Turbine Brass-Turner',
        guildId: 'guild-kiln',
        guildName: 'Oakhaven Sluice Guild',
        regionId: 'ashen-kiln',
        portraitUrl: '/src/assets/images/ff_npc_tarsik_1795130893764.jpg',
        position: [-22.5, -5.2],
        cloakHex: 0x5c5548,
        trimHex: 0x75b89e,
        greeting:
          'Hear that rhythmic clack? A limestone wedge jammed the Silt-Wheel bronze impeller. Strike the Spillway Bell once you scatter the Shardcasters.',
        cognitiveDrive: 'Keep Oakhaven grain mills turning cleanly on spring melt.',
        concealedSecret: 'He smelts salvaged aqueduct coins into corrosion-proof bearings.',
        speechCadence: 'Brisk workshop cadence, taps rhythmically on bronze calipers.',
        beliefs: ['A balanced wheel outlives three kings.'],
        choices: [
          {
            id: 'haldor-1',
            label: 'I will calibrate the Silt-Wheel and strike the Spillway Bell.',
            reply: 'Fine work! Strike true at 174 Hz so the sluice valves seat flush.',
            thought: 'Quietly tucking away his tray of shaved bronze mintings.',
            renownGain: 25,
          },
        ],
      },
    ],
    quests: [
      {
        id: 'quest-oak-sluice',
        title: 'The Sunken Sluice of Oakhaven',
        giverNpcId: 'npc-maren',
        guildId: 'guild-causeway',
        regionId: 'high-causeway',
        summary:
          'Inspect Oakhaven’s flooded aqueduct piers, sound the Sunken Sluice Arch, and attune the Crown Cistern Waystone.',
        motif: 'hydraulic siphon masonry',
        renownReward: 165,
        status: 'active',
        objectives: [
          { id: 'obj-oak-1', description: 'Speak with Lock-Keeper Maren Holt', kind: 'talk-npc', targetId: 'npc-maren', targetCoords: [-3.2, 15.6], requiredCount: 1, currentCount: 0 },
          { id: 'obj-oak-2', description: 'Sound the Sunken Sluice Arch [Bell-Hammer]', kind: 'ring-bell', targetId: 'int-oak-pier', targetCoords: [0, 5.2], requiredCount: 1, currentCount: 0 },
          { id: 'obj-oak-3', description: 'Attune the Crown Cistern Waystone', kind: 'calibrate-beacon', targetId: 'int-oak-waystone', targetCoords: [0, -10.5], requiredCount: 1, currentCount: 0 },
        ],
      },
      {
        id: 'quest-oak-harvest',
        title: 'Spore-Lime of the Fern Terrace',
        giverNpcId: 'npc-haldor',
        guildId: 'guild-tideloom',
        regionId: 'ironwood-reaches',
        summary:
          'Gather aquatic silicate moss nodules along the Emerald Fern Terrace and drive off Fen Stalkers threatening the outer reservoir.',
        motif: 'aquatic moss filtration',
        renownReward: 175,
        status: 'active',
        objectives: [
          { id: 'obj-oak-4', description: 'Harvest Silicate Spore Nodules', kind: 'collect-relics', targetId: 'silicate-relic', targetCoords: [22, -6], requiredCount: 2, currentCount: 0 },
          { id: 'obj-oak-5', description: 'Vanquish Fen Stalkers', kind: 'defeat-archetype', targetId: 'stalker', targetCoords: [-14, -7], requiredCount: 2, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: 'int-oak-pier', kind: 'resonance-pier', name: 'Sunken Sluice Arch', promptVerb: 'Sound Sluice [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
      { id: 'int-oak-waystone', kind: 'waystone-beacon', name: 'Crown Cistern Waystone', promptVerb: 'Attune Cistern Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
      { id: 'int-oak-bell', kind: 'forge-bell', name: 'Silt-Wheel Resonance Bell', promptVerb: 'Ring Spillway Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
      { id: 'int-oak-moss-1', kind: 'silicate-relic', name: 'Aquatic Silicate Nodule', promptVerb: 'Harvest Silicate Nodule', regionId: 'ironwood-reaches', position: [21, -7], activated: false },
      { id: 'int-oak-moss-2', kind: 'silicate-relic', name: 'Cistern Spore Cluster', promptVerb: 'Harvest Spore Cluster', regionId: 'ironwood-reaches', position: [26, -3], activated: false },
      { id: 'int-oak-dungeon', kind: 'dungeon-portal', name: 'The Flooded Siphon Catacombs', promptVerb: 'Descend into Siphon Catacombs', regionId: 'northern-watch', position: [-14, -34], activated: false, targetRealmSlug: 'oakhaven-cistern-labyrinth' },
      { id: 'int-oak-chest', kind: 'vault-chest', name: 'Reservoir Sluice Coffer', promptVerb: 'Unseal Sluice Coffer', regionId: 'western-ruins', position: [-54, -22], activated: false },
    ],
    enemies: [
      makeEnemy('oak-e1', 'stalker', 'Fen Root-Stalker', -13, -7, 62),
      makeEnemy('oak-e2', 'stalker', 'Sluice Crawler', 12, -9, 62),
      makeEnemy('oak-e3', 'shardcaster', 'Cistern Prism-Weaver', -22, -11, 56),
      makeEnemy('oak-e4', 'colossus', 'Moss-Bound Aqueduct Golem', 24, 15, 165),
      makeEnemy('oak-e5', 'stalker', 'Reservoir Stalker', -46, -19, 68),
      makeEnemy('oak-e6', 'shardcaster', 'Spillway Arc-Channeler', 46, 8, 64),
    ],
  },
  {
    id: 'realm-cinderfall',
    slug: 'cinderfall',
    name: 'The Obsidian Crucible of Cinderfall',
    subtitle: 'Cell (1, 0, 0) · Volcanic Caldera & Forged Iron Causeway',
    cell: [1, 0, 0],
    theme: 'obsidian-crucible',
    seed: 3307,
    worldHalfExtent: 112,
    summary:
      'A vast volcanic caldera bridged by dark riveted ironworks, spanning geothermal vent basins, obsidian basalt ridges, and the molten Crucible Core Depths.',
    skyAssetId: 'dikhololo_sunset',
    skyUrl: '/verdant/realms/cinderfall/sky.jpg',
    glbUrl: '/verdant/realms/cinderfall/world.glb',
    vdntUrl: '/verdant/realms/cinderfall/world.vdnt',
    ambientMood: 'foundry',
    skyFallbackRgb: [0.42, 0.24, 0.18],
    fogRgb: [0.56, 0.34, 0.24],
    spawnPoint: [0, 21.0],
    soundtrack: getCanonicalSoundtrackForTheme('obsidian-crucible', false, 'cinderfall', 'The Obsidian Crucible of Cinderfall', 3307),
    dungeonEntrances: [
      {
        id: 'ent-cinderfall-delve',
        dungeonSlug: 'cinderfall-magma-delve',
        name: 'The Crucible Core Depths',
        subtitle: 'Tier III Geothermal Forge Vault · Beneath Anvil Keep',
        position: [-14, -34],
        tier: 3,
        style: 'geothermal-depths',
      },
    ],
    materials: {
      terrain: 'cliff_side',
      masonry: 'castle_wall_slates',
      road: 'cobblestone_04',
      timber: 'black_painted_planks',
    },
    terrainProfile: {
      macroAmp: 3.2,
      macroFreq: 0.052,
      gorgeDepth: 5.6,
      gorgeZ: 5.0,
      gorgeWaveAmp: 2.6,
      citadelLift: 4.4,
      citadelZ: -18,
      coastDip: 2.2,
      rimStart: 92,
      rimHeight: 3.5,
      waterLevel: -1.15,
      hasBridge: true,
      bridgeDeckY: 1.65,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: [
      { id: 'cin-rock-1', assetId: 'moon_rock_01', source: 'polyhaven', label: 'Obsidian Caldera Tor W', position: [-9.5, 9.5], targetHeight: 3.6, yaw: 0.4, tintRgb: [0.22, 0.20, 0.22], maxTriangles: 440 },
      { id: 'cin-rock-2', assetId: 'boulder_01', source: 'polyhaven', label: 'Obsidian Caldera Tor E', position: [10.4, 8.8], targetHeight: 3.9, yaw: 1.9, tintRgb: [0.24, 0.21, 0.21], maxTriangles: 440 },
      { id: 'cin-lantern-1', assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Crucible Brazier W', position: [-4.2, 14.2], targetHeight: 1.35, yaw: 0.2, tintRgb: [0.88, 0.56, 0.22], maxTriangles: 340 },
      { id: 'cin-lantern-2', assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Crucible Brazier E', position: [4.2, 14.2], targetHeight: 1.35, yaw: 1.4, tintRgb: [0.88, 0.56, 0.22], maxTriangles: 340 },
      { id: 'cin-pot-1', assetId: 'brass_pot_01', source: 'polyhaven', label: 'Quenching Cauldron', position: [-6.0, 16.5], targetHeight: 1.25, yaw: 0.7, tintRgb: [0.76, 0.48, 0.24], maxTriangles: 320 },
      { id: 'cin-vase-1', assetId: 'brass_vase_01', source: 'polyhaven', label: 'Tempered Alloy Urn', position: [-23.0, -6.0], targetHeight: 1.3, yaw: 0.3, tintRgb: [0.84, 0.58, 0.26], maxTriangles: 320 },
      { id: 'cin-estoc-1', assetId: 'antique_estoc', source: 'polyhaven', label: 'Tempered Blade Monument', position: [0, -13.2], yOffset: 1.2, targetHeight: 2.4, yaw: 0.4, tintRgb: [0.82, 0.76, 0.68], maxTriangles: 360 },
      { id: 'cin-crate-1', assetId: 'old_military_crate', source: 'polyhaven', label: 'Slag Ingot Chest', position: [6.2, 16.4], targetHeight: 1.05, yaw: 0.3, tintRgb: [0.34, 0.30, 0.28], maxTriangles: 340 },
      { id: 'cin-statue-1', assetId: 'gothic_statue', source: 'polyhaven', label: 'Smelter Warden W', position: [-6.4, -10.4], targetHeight: 3.9, yaw: 0.2, tintRgb: [0.28, 0.26, 0.27], maxTriangles: 480 },
      { id: 'cin-statue-2', assetId: 'gothic_statue', source: 'polyhaven', label: 'Smelter Warden E', position: [6.4, -10.4], targetHeight: 3.9, yaw: -0.2, tintRgb: [0.28, 0.26, 0.27], maxTriangles: 480 },
      { id: 'cin-west-rock', assetId: 'boulder_01', source: 'polyhaven', label: 'Caldera Rim Monolith', position: [-52, -21], targetHeight: 4.2, yaw: 0.9, tintRgb: [0.22, 0.18, 0.19], maxTriangles: 420 },
      { id: 'cin-east-lantern', assetId: 'Lantern_01', source: 'polyhaven', label: 'Lodestone Ridge Signal', position: [51, 9], targetHeight: 1.4, yaw: 0.5, tintRgb: [0.92, 0.52, 0.20], maxTriangles: 320 },
    ],
    regions: [
      { id: 'high-causeway', name: 'Cinderfall Anvil Keep', subtitle: 'Caldera Crown & Quench Spire', center: [0, -14], radius: 18, ambientMood: 'foundry' },
      { id: 'ashen-kiln', name: 'Smelter Vent Basin', subtitle: 'Geothermal Forge Furnaces', center: [-25, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'ironwood-reaches', name: 'Scorched Basalt Ridge', subtitle: 'Magnetic Lodestone Veins', center: [25, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'salt-loom', name: 'Sulfur Steam Flats', subtitle: 'Hardened Lava Shelf', center: [24, 24], radius: 20, ambientMood: 'foundry' },
      { id: 'southern-terrace', name: 'Cinderfall Iron Gate', subtitle: 'Eastern Meridian Crossing', center: [0, 19], radius: 16, ambientMood: 'foundry' },
      { id: 'northern-watch', name: 'Crucible Core Descent', subtitle: 'Volcanic Forge Vault Approach', center: [-6, -46], radius: 24, ambientMood: 'foundry' },
      { id: 'western-ruins', name: 'Slag-Crown Monoliths', subtitle: 'Ancient Quench Pillars', center: [-54, -22], radius: 24, ambientMood: 'foundry' },
      { id: 'eastern-ridge', name: 'Bellows Overlook', subtitle: 'Lodestone Smelting Camp', center: [54, 10], radius: 24, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Cinderfall Iron Gate', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'Cinderfall Anvil Keep', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Crucible Core Portal', x: -14, z: -29.5 },
      { regionId: 'ashen-kiln', name: 'Smelter Vent Basin', x: -20, z: -5 },
      { regionId: 'western-ruins', name: 'Slag-Crown Monoliths', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Bellows Overlook', x: 48, z: 10 },
    ],
    npcs: [
      {
        id: 'npc-brenna',
        name: 'Forge-Warden Brenna Ash',
        title: 'Caldera Vent Architect',
        guildId: 'guild-kiln',
        guildName: 'Ashen Kiln Crucible',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_tarsik_1795130893764.jpg',
        position: [-3.4, 15.4],
        cloakHex: 0x7a3425,
        trimHex: 0xe8b04b,
        greeting:
          'Keep your boots on the riveted plates, Waywright. The caldera’s pressure chime stopped an hour ago—if the Crucible Core Depths seal shut, the whole ridge fractures.',
        cognitiveDrive: 'Keep Cinderfall’s geothermal relief bells ringing in harmonic balance.',
        concealedSecret: 'She found an ancient pre-Charter lodestone core beneath the Anvil Keep that magnetizes compasses.',
        speechCadence: 'Crisp, resonant, speaks like someone shouting clearly over bellows.',
        beliefs: ['Pressure ignored becomes ruin; pressure vented becomes steel.'],
        choices: [
          {
            id: 'brenna-1',
            label: 'How do we relieve the Anvil Keep pressure?',
            reply:
              'Strike the Iron Causeway Relief Pier with your Bell-Hammer, vanquish the Cinder Colossus, and descend into the Crucible Core Depths north of the keep.',
            thought: 'Calculating whether the Waywright’s compass will deflect near the buried lodestone core.',
            renownGain: 30,
            advancesQuestId: 'quest-cinder-vent',
          },
        ],
      },
    ],
    quests: [
      {
        id: 'quest-cinder-vent',
        title: 'Harmonics of the Caldera Vent',
        giverNpcId: 'npc-brenna',
        guildId: 'guild-kiln',
        regionId: 'high-causeway',
        summary:
          'Vent tectonic steam across Cinderfall by sounding the Iron Causeway Pier and toppling the Magma-Veined Colossus guarding the eastern shelf.',
        motif: 'geothermal relief metallurgy',
        renownReward: 210,
        status: 'active',
        objectives: [
          { id: 'obj-cin-1', description: 'Speak with Forge-Warden Brenna Ash', kind: 'talk-npc', targetId: 'npc-brenna', targetCoords: [-3.4, 15.4], requiredCount: 1, currentCount: 0 },
          { id: 'obj-cin-2', description: 'Sound the Iron Causeway Pier [Bell-Hammer]', kind: 'ring-bell', targetId: 'int-cin-pier', targetCoords: [0, 5.2], requiredCount: 1, currentCount: 0 },
          { id: 'obj-cin-3', description: 'Vanquish the Cinder Caldera Colossus', kind: 'defeat-archetype', targetId: 'colossus', targetCoords: [20, 14], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: 'int-cin-pier', kind: 'resonance-pier', name: 'Iron Causeway Relief Pier', promptVerb: 'Strike Relief Pier [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
      { id: 'int-cin-waystone', kind: 'waystone-beacon', name: 'Anvil Keep Waystone', promptVerb: 'Attune Anvil Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
      { id: 'int-cin-bell', kind: 'forge-bell', name: 'Caldera Vent Bell', promptVerb: 'Ring Vent Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
      { id: 'int-cin-dungeon', kind: 'dungeon-portal', name: 'The Crucible Core Depths', promptVerb: 'Descend into Crucible Core Depths', regionId: 'northern-watch', position: [-14, -34], activated: false, targetRealmSlug: 'cinderfall-magma-delve' },
      { id: 'int-cin-chest', kind: 'vault-chest', name: 'Tempered Ingot Vault', promptVerb: 'Unseal Ingot Vault', regionId: 'western-ruins', position: [-54, -22], activated: false },
    ],
    enemies: [
      makeEnemy('cin-e1', 'stalker', 'Slag-Hound Skirmisher', -11, -7, 68),
      makeEnemy('cin-e2', 'shardcaster', 'Obsidian Prism-Caster', 14, -8, 62),
      makeEnemy('cin-e3', 'shardcaster', 'Ember Refractory', -20, -10, 62),
      makeEnemy('cin-e4', 'colossus', 'Cinder Caldera Colossus', 20, 14, 190),
      makeEnemy('cin-e5', 'stalker', 'Basalt Vent-Runner', -48, -18, 72),
      makeEnemy('cin-e6', 'shardcaster', 'Bellows Arc-Smith', 48, 8, 68),
    ],
  },
  {
    id: 'realm-glasswater',
    slug: 'glasswater',
    name: 'The Pelagic Spires of Glasswater',
    subtitle: 'Cell (0, 0, -1) · Tidal Archipelago & Limestone Watchtowers',
    cell: [0, 0, -1],
    theme: 'pelagic-spires',
    seed: 5519,
    worldHalfExtent: 112,
    summary:
      'Sun-bleached limestone sea-arches and weathered cedar piers overlooking crystalline tidal straits, distant shoal watchtowers, and the Drowned Sextant Grotto.',
    skyAssetId: 'aristea_wreck_puresky',
    skyUrl: '/verdant/realms/glasswater/sky.jpg',
    glbUrl: '/verdant/realms/glasswater/world.glb',
    vdntUrl: '/verdant/realms/glasswater/world.vdnt',
    ambientMood: 'coast',
    skyFallbackRgb: [0.40, 0.56, 0.68],
    fogRgb: [0.64, 0.70, 0.74],
    spawnPoint: [0, 20.5],
    soundtrack: getCanonicalSoundtrackForTheme('pelagic-spires', false, 'glasswater', 'The Pelagic Spires of Glasswater', 5519),
    dungeonEntrances: [
      {
        id: 'ent-glasswater-grotto',
        dungeonSlug: 'glasswater-abyssal-grotto',
        name: 'The Drowned Sextant Grotto',
        subtitle: 'Tier II Tidal Sea-Vault · Beneath Lighthouse Keep',
        position: [-14, -34],
        tier: 2,
        style: 'sunken-cistern',
      },
    ],
    materials: {
      terrain: 'coast_sand_rocks_02',
      masonry: 'castle_brick_01',
      road: 'cobblestone_floor_01',
      timber: 'brown_planks_03',
    },
    terrainProfile: {
      macroAmp: 2.1,
      macroFreq: 0.046,
      gorgeDepth: 4.8,
      gorgeZ: 5.0,
      gorgeWaveAmp: 3.4,
      citadelLift: 4.0,
      citadelZ: -18,
      coastDip: 3.4,
      rimStart: 94,
      rimHeight: 2.4,
      waterLevel: -0.55,
      hasBridge: true,
      bridgeDeckY: 1.55,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: [
      { id: 'gw-barrel-1', assetId: 'Barrel_01', source: 'polyhaven', label: 'Salt-Brine Cask', position: [-5.2, 17.4], targetHeight: 1.1, yaw: 0.5, tintRgb: [0.58, 0.44, 0.28], maxTriangles: 320 },
      { id: 'gw-barrel-2', assetId: 'Barrel_02', source: 'polyhaven', label: 'Tar Pitch Cask', position: [5.4, 16.8], targetHeight: 1.1, yaw: 2.0, tintRgb: [0.46, 0.36, 0.26], maxTriangles: 320 },
      { id: 'gw-table-1', assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Chart-Maker’s Table', position: [-6.4, 16.4], targetHeight: 1.0, yaw: 0.0, tintRgb: [0.56, 0.45, 0.32], maxTriangles: 320 },
      { id: 'gw-lantern-1', assetId: 'Lantern_01', source: 'polyhaven', label: 'Harbor Signal Lamp W', position: [-4.4, 14.0], targetHeight: 1.25, yaw: 0.0, tintRgb: [0.86, 0.72, 0.34], maxTriangles: 320 },
      { id: 'gw-lantern-2', assetId: 'Lantern_01', source: 'polyhaven', label: 'Harbor Signal Lamp E', position: [4.4, 14.0], targetHeight: 1.25, yaw: 0.0, tintRgb: [0.86, 0.72, 0.34], maxTriangles: 320 },
      { id: 'gw-shield-1', assetId: 'kite_shield', source: 'polyhaven', label: 'Tide-Loom Crest', position: [0, -13.0], yOffset: 1.8, targetHeight: 1.5, yaw: 0.0, tintRgb: [0.34, 0.68, 0.74], maxTriangles: 320 },
      { id: 'gw-rock-1', assetId: 'boulder_01', source: 'polyhaven', label: 'Tidal Headland Boulder', position: [14.5, 16.5], targetHeight: 3.4, yaw: 1.2, tintRgb: [0.48, 0.49, 0.47], maxTriangles: 420 },
      { id: 'gw-rock-2', assetId: 'moon_rock_01', source: 'polyhaven', label: 'Shoal Sea-Rock', position: [-14.2, 13.5], targetHeight: 3.0, yaw: 2.4, tintRgb: [0.45, 0.47, 0.48], maxTriangles: 420 },
      { id: 'gw-pot-1', assetId: 'antique_ceramic_vase_01', source: 'polyhaven', label: 'Sea-Salt Amphora', position: [19.0, 21.5], targetHeight: 1.25, yaw: 0.9, tintRgb: [0.72, 0.64, 0.52], maxTriangles: 300 },
      { id: 'gw-west-rock', assetId: 'boulder_01', source: 'polyhaven', label: 'Breakwater Stack', position: [-52, -20], targetHeight: 4.0, yaw: 1.1, tintRgb: [0.44, 0.48, 0.50], maxTriangles: 400 },
      { id: 'gw-east-crate', assetId: 'old_military_crate', source: 'polyhaven', label: 'Navigator Supply Crate', position: [51, 10], targetHeight: 1.1, yaw: 0.6, tintRgb: [0.54, 0.48, 0.38], maxTriangles: 320 },
    ],
    regions: [
      { id: 'high-causeway', name: 'Glasswater Lighthouse Keep', subtitle: 'Northern Triangulation Spire', center: [0, -14], radius: 18, ambientMood: 'coast' },
      { id: 'ashen-kiln', name: 'West Breakwater Shoals', subtitle: 'Resonant Tide Bells', center: [-25, -6], radius: 18, ambientMood: 'coast' },
      { id: 'ironwood-reaches', name: 'Driftwood Promontory', subtitle: 'Sea-Cedar Groves', center: [25, -6], radius: 18, ambientMood: 'coast' },
      { id: 'salt-loom', name: 'Glasswater Deep Wharf', subtitle: 'Pelagic Timber Pier', center: [24, 24], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: 'Tidal Causeway Quay', subtitle: 'Northern Meridian Strait', center: [0, 19], radius: 16, ambientMood: 'coast' },
      { id: 'northern-watch', name: 'Abyssal Grotto Headland', subtitle: 'Drowned Sextant Vault Entry', center: [-6, -46], radius: 24, ambientMood: 'coast' },
      { id: 'western-ruins', name: 'Sunken Beacon Ring', subtitle: 'Old Shoal Standing Stones', center: [-54, -22], radius: 24, ambientMood: 'coast' },
      { id: 'eastern-ridge', name: 'East Strait Watch', subtitle: 'Pelagic Signal Camp', center: [54, 10], radius: 24, ambientMood: 'coast' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Tidal Causeway Quay', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'Glasswater Lighthouse Keep', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Drowned Sextant Grotto', x: -14, z: -29.5 },
      { regionId: 'salt-loom', name: 'Glasswater Deep Wharf', x: 19, z: 19.5 },
      { regionId: 'western-ruins', name: 'Sunken Beacon Ring', x: -49, z: -18 },
    ],
    npcs: [
      {
        id: 'npc-soren',
        name: 'Harbor-Sextant Soren Vane',
        title: 'Pelagic Shoal Navigator',
        guildId: 'guild-tideloom',
        guildName: 'Tide-Loom Navigators',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_seraia_1795130893399.jpg',
        position: [-3.2, 15.5],
        cloakHex: 0x295772,
        trimHex: 0xe2bd6d,
        greeting:
          'Clear horizon, Waywright. The spring shoals shifted forty fathoms west—and the low tide uncovered the gate to the Drowned Sextant Grotto.',
        cognitiveDrive: 'Keep the Glasswater straits safely charted through shifting obsidian tides.',
        concealedSecret: 'He charted a submerged stone causeway linking Glasswater directly to Borealis.',
        speechCadence: 'Breezy, exact, speaks in bearings, knots, and tide tables.',
        beliefs: ['Charts are living promises, not dead ink.'],
        choices: [
          {
            id: 'soren-1',
            label: 'Where are the triangulation beacons failing?',
            reply:
              'Attune the Lighthouse Keep Waystone across the causeway and sound the Breakwater Tide-Bell—then inspect the Drowned Sextant Grotto northwest.',
            thought: 'Keeping his sounding chart for the submerged causeway folded beneath his sleeve.',
            renownGain: 25,
            advancesQuestId: 'quest-gw-shoals',
          },
        ],
      },
    ],
    quests: [
      {
        id: 'quest-gw-shoals',
        title: 'Bearings of the Glasswater Strait',
        giverNpcId: 'npc-soren',
        guildId: 'guild-tideloom',
        regionId: 'high-causeway',
        summary:
          'Recalibrate Glasswater’s coastal navigation network by attuning the Lighthouse Waystone and sounding the West Breakwater Tide-Bell.',
        motif: 'pelagic tide triangulation',
        renownReward: 175,
        status: 'active',
        objectives: [
          { id: 'obj-gw-1', description: 'Speak with Harbor-Sextant Soren Vane', kind: 'talk-npc', targetId: 'npc-soren', targetCoords: [-3.2, 15.5], requiredCount: 1, currentCount: 0 },
          { id: 'obj-gw-2', description: 'Attune the Lighthouse Keep Waystone', kind: 'calibrate-beacon', targetId: 'int-gw-waystone', targetCoords: [0, -10.5], requiredCount: 1, currentCount: 0 },
          { id: 'obj-gw-3', description: 'Ring the West Breakwater Bell [Bell-Hammer]', kind: 'ring-bell', targetId: 'int-gw-bell', targetCoords: [-25, -8], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: 'int-gw-pier', kind: 'resonance-pier', name: 'Strait Tide-Arch Pier', promptVerb: 'Sound Tide-Arch [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
      { id: 'int-gw-waystone', kind: 'waystone-beacon', name: 'Lighthouse Keep Waystone', promptVerb: 'Attune Lighthouse Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
      { id: 'int-gw-bell', kind: 'forge-bell', name: 'West Breakwater Tide-Bell', promptVerb: 'Ring Breakwater Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
      { id: 'int-gw-dungeon', kind: 'dungeon-portal', name: 'The Drowned Sextant Grotto', promptVerb: 'Descend into Drowned Sextant Grotto', regionId: 'northern-watch', position: [-14, -34], activated: false, targetRealmSlug: 'glasswater-abyssal-grotto' },
      { id: 'int-gw-chest', kind: 'vault-chest', name: 'Shoal Navigator Strongbox', promptVerb: 'Unseal Navigator Strongbox', regionId: 'eastern-ridge', position: [54, 10], activated: false },
    ],
    enemies: [
      makeEnemy('gw-e1', 'stalker', 'Reef-Scale Stalker', 12, -8, 60),
      makeEnemy('gw-e2', 'shardcaster', 'Salt-Prism Caster', -15, -7, 58),
      makeEnemy('gw-e3', 'colossus', 'Shoal Basalt Guardian', 20, 16, 170),
      makeEnemy('gw-e4', 'stalker', 'Breakwater Skirmisher', -46, -20, 66),
      makeEnemy('gw-e5', 'shardcaster', 'Tide-Glass Weaver', 48, 8, 64),
    ],
  },
  {
    id: 'realm-kar-veth',
    slug: 'kar-veth',
    name: 'The Amber Monoliths of Kar-Veth',
    subtitle: 'Cell (0, 0, 1) · Sandstone Wind-Harps & Caravan Steppe',
    cell: [0, 0, 1],
    theme: 'amber-steppe',
    seed: 6823,
    worldHalfExtent: 112,
    summary:
      'Sun-gilded sandstone canyons where bronze wind-harps sing across terraced caravan citadels, monolith circles, and the subterranean Resonance Hall of Kar-Veth.',
    skyAssetId: 'grasslands_sunset',
    skyUrl: '/verdant/realms/kar-veth/sky.jpg',
    glbUrl: '/verdant/realms/kar-veth/world.glb',
    vdntUrl: '/verdant/realms/kar-veth/world.vdnt',
    ambientMood: 'ironwood',
    skyFallbackRgb: [0.52, 0.44, 0.34],
    fogRgb: [0.68, 0.56, 0.42],
    spawnPoint: [0, 21.0],
    soundtrack: getCanonicalSoundtrackForTheme('amber-steppe', false, 'kar-veth', 'The Amber Monoliths of Kar-Veth', 6823),
    dungeonEntrances: [
      {
        id: 'ent-karveth-tomb',
        dungeonSlug: 'karveth-echo-tomb',
        name: 'The Resonance Hall of Kar-Veth',
        subtitle: 'Tier III Sandstone Acoustic Vault · Beneath Sun-Terrace Keep',
        position: [-14, -34],
        tier: 3,
        style: 'catacomb-vault',
      },
    ],
    materials: {
      terrain: 'aerial_sand',
      masonry: 'large_sandstone_blocks_01',
      road: 'cobblestone_01',
      timber: 'brown_planks_03',
    },
    terrainProfile: {
      macroAmp: 2.6,
      macroFreq: 0.044,
      gorgeDepth: 4.5,
      gorgeZ: 5.0,
      gorgeWaveAmp: 3.0,
      citadelLift: 4.2,
      citadelZ: -18,
      coastDip: 1.8,
      rimStart: 94,
      rimHeight: 2.9,
      waterLevel: -1.2,
      hasBridge: true,
      bridgeDeckY: 1.6,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.9,
    },
    importedCatalogProps: [
      { id: 'kv-statue-1', assetId: 'gothic_statue', source: 'polyhaven', label: 'Steppe Choir Sentinel W', position: [-5.6, -10.4], targetHeight: 3.8, yaw: 0.2, tintRgb: [0.74, 0.62, 0.44], maxTriangles: 480 },
      { id: 'kv-statue-2', assetId: 'gothic_statue', source: 'polyhaven', label: 'Steppe Choir Sentinel E', position: [5.6, -10.4], targetHeight: 3.8, yaw: -0.2, tintRgb: [0.74, 0.62, 0.44], maxTriangles: 480 },
      { id: 'kv-table-1', assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Caravan Astrolabe Table', position: [-6.2, 16.5], targetHeight: 1.05, yaw: 0.1, tintRgb: [0.58, 0.42, 0.26], maxTriangles: 340 },
      { id: 'kv-crate-1', assetId: 'old_military_crate', source: 'polyhaven', label: 'Spice & Brass Supply Crate', position: [5.6, 16.4], targetHeight: 1.05, yaw: 0.6, tintRgb: [0.56, 0.46, 0.34], maxTriangles: 340 },
      { id: 'kv-vase-1', assetId: 'brass_vase_01', source: 'polyhaven', label: 'Wind-Harp Resonator Urn', position: [-4.2, 14.4], targetHeight: 1.35, yaw: 0.2, tintRgb: [0.88, 0.68, 0.32], maxTriangles: 340 },
      { id: 'kv-vase-2', assetId: 'antique_ceramic_vase_01', source: 'polyhaven', label: 'Steppe Ochre Vessel', position: [4.4, 14.4], targetHeight: 1.35, yaw: 1.5, tintRgb: [0.76, 0.52, 0.34], maxTriangles: 340 },
      { id: 'kv-estoc-1', assetId: 'antique_estoc', source: 'polyhaven', label: 'Charter Waymarker Blade', position: [0, -13.0], yOffset: 1.2, targetHeight: 2.5, yaw: 0.3, tintRgb: [0.86, 0.78, 0.60], maxTriangles: 360 },
      { id: 'kv-rock-1', assetId: 'boulder_01', source: 'polyhaven', label: 'Amber Canyon Boulder W', position: [-11.0, 8.2], targetHeight: 3.4, yaw: 0.7, tintRgb: [0.64, 0.50, 0.34], maxTriangles: 420 },
      { id: 'kv-rock-2', assetId: 'boulder_01', source: 'polyhaven', label: 'Amber Canyon Boulder E', position: [12.0, 7.6], targetHeight: 3.6, yaw: 2.0, tintRgb: [0.62, 0.48, 0.32], maxTriangles: 420 },
      { id: 'kv-lantern-1', assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Caravan Sun-Lamp', position: [-23.8, -6.4], targetHeight: 1.3, yaw: 0.5, tintRgb: [0.90, 0.68, 0.28], maxTriangles: 320 },
      { id: 'kv-barrel-1', assetId: 'Barrel_02', source: 'polyhaven', label: 'Water Cistern Cask', position: [50.5, 10.5], targetHeight: 1.15, yaw: 0.8, tintRgb: [0.54, 0.38, 0.24], maxTriangles: 320 },
    ],
    regions: [
      { id: 'high-causeway', name: 'Sun-Terrace Ziggurat', subtitle: 'Sandstone Choir & Caravan Keep', center: [0, -14], radius: 18, ambientMood: 'causeway' },
      { id: 'ashen-kiln', name: 'Bronze Wind-Harp Basin', subtitle: 'Acoustic Canyon Amphitheater', center: [-25, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'ironwood-reaches', name: 'Ochre Pillar Groves', subtitle: 'Wind-Carved Sandstone Hoodoos', center: [25, -6], radius: 18, ambientMood: 'ironwood' },
      { id: 'salt-loom', name: 'Mirage Salt Flats', subtitle: 'Dry Crystalline Basin', center: [24, 24], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: 'Kar-Veth Caravan Gate', subtitle: 'Southern Steppe Approach', center: [0, 19], radius: 16, ambientMood: 'causeway' },
      { id: 'northern-watch', name: 'Echo Tomb Escarpment', subtitle: 'Resonance Hall Descent', center: [-6, -46], radius: 24, ambientMood: 'causeway' },
      { id: 'western-ruins', name: 'Whispering Monolith Ring', subtitle: 'Harmonic Stone Circle', center: [-54, -22], radius: 24, ambientMood: 'foundry' },
      { id: 'eastern-ridge', name: 'Saffron Ridge Outpost', subtitle: 'Highland Caravan Depot', center: [54, 10], radius: 24, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Kar-Veth Caravan Gate', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'Sun-Terrace Ziggurat', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Resonance Hall Portal', x: -14, z: -29.5 },
      { regionId: 'western-ruins', name: 'Whispering Monolith Ring', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Saffron Ridge Outpost', x: 48, z: 10 },
    ],
    npcs: [
      {
        id: 'npc-zara',
        name: 'Cantor Zara Al-Keth',
        title: 'Wind-Harp Acoustic Master',
        guildId: 'guild-causeway',
        guildName: 'Kar-Veth Caravan Compact',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_kaelen_1795129454573.jpg',
        position: [-3.2, 15.6],
        cloakHex: 0x9b662b,
        trimHex: 0xf0ca74,
        greeting:
          'Welcome to the amber canyons, Waywright. When the trade winds blow north, Kar-Veth’s monoliths sing caravan bearings for twenty leagues—unless sand-stalkers fracture the tuning pins.',
        cognitiveDrive: 'Preserve the acoustic wind-harp network guiding merchants safely across the dry steppe.',
        concealedSecret: 'She discovered that the Resonance Hall beneath the Ziggurat amplifies voices across Meridian Cells.',
        speechCadence: 'Warm, rhythmic, pauses to listen to wind gusts.',
        beliefs: ['A road heard in a sandstorm saves more lives than a wall.'],
        choices: [
          {
            id: 'zara-1',
            label: 'How can I retune the Wind-Harp network?',
            reply:
              'Sound the Caravan Bridge Pier with your Bell-Hammer, attune the Sun-Terrace Waystone, and descend into the Resonance Hall northwest of the Ziggurat.',
            thought: 'Wondering if the Waywright will recognize the Meridian acoustic relay inside the vault.',
            renownGain: 30,
            advancesQuestId: 'quest-karveth-harps',
          },
        ],
      },
    ],
    quests: [
      {
        id: 'quest-karveth-harps',
        title: 'Chords of the Amber Monoliths',
        giverNpcId: 'npc-zara',
        guildId: 'guild-causeway',
        regionId: 'high-causeway',
        summary:
          'Restore Kar-Veth’s acoustic caravan bearings by sounding the Sandstone Causeway Pier, ringing the Wind-Harp Basin Bell, and clearing Mirage Colossi.',
        motif: 'aeolian wind-harp acoustics',
        renownReward: 220,
        status: 'active',
        objectives: [
          { id: 'obj-kv-1', description: 'Speak with Cantor Zara Al-Keth', kind: 'talk-npc', targetId: 'npc-zara', targetCoords: [-3.2, 15.6], requiredCount: 1, currentCount: 0 },
          { id: 'obj-kv-2', description: 'Sound the Sandstone Causeway Pier [Bell-Hammer]', kind: 'ring-bell', targetId: 'int-kv-pier', targetCoords: [0, 5.2], requiredCount: 1, currentCount: 0 },
          { id: 'obj-kv-3', description: 'Attune the Sun-Terrace Waystone', kind: 'calibrate-beacon', targetId: 'int-kv-waystone', targetCoords: [0, -10.5], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: 'int-kv-pier', kind: 'resonance-pier', name: 'Sandstone Causeway Pier', promptVerb: 'Sound Pier [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
      { id: 'int-kv-waystone', kind: 'waystone-beacon', name: 'Sun-Terrace Waystone', promptVerb: 'Attune Sun-Terrace Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
      { id: 'int-kv-bell', kind: 'forge-bell', name: 'Wind-Harp Basin Bell', promptVerb: 'Ring Wind-Harp Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
      { id: 'int-kv-dungeon', kind: 'dungeon-portal', name: 'The Resonance Hall of Kar-Veth', promptVerb: 'Descend into Resonance Hall', regionId: 'northern-watch', position: [-14, -34], activated: false, targetRealmSlug: 'karveth-echo-tomb' },
      { id: 'int-kv-chest', kind: 'vault-chest', name: 'Saffron Caravan Strongbox', promptVerb: 'Unseal Caravan Strongbox', regionId: 'eastern-ridge', position: [54, 10], activated: false },
    ],
    enemies: [
      makeEnemy('kv-e1', 'stalker', 'Dune-Shale Stalker', -12, -8, 70),
      makeEnemy('kv-e2', 'shardcaster', 'Mirage Prism-Singer', 15, -9, 64),
      makeEnemy('kv-e3', 'colossus', 'Sandstone Choir Colossus', 22, 16, 195),
      makeEnemy('kv-e4', 'stalker', 'Canyon Wind-Runner', -48, -20, 74),
      makeEnemy('kv-e5', 'shardcaster', 'Steppe Glass-Caster', 46, 8, 68),
    ],
  },
  {
    id: 'realm-borealis',
    slug: 'borealis',
    name: 'The Frostglass Bastion of Borealis',
    subtitle: 'Cell (-1, 0, -1) · Alpine Glacial Spires & Aurora Watch',
    cell: [-1, 0, -1],
    theme: 'glacial-spire',
    seed: 9103,
    worldHalfExtent: 112,
    summary:
      'High-altitude snowfields crowned by crystalline ice-spires, dark slate fortresses under starry aurora skies, alpine relay watchtowers, and the Frostglass Choir Crypt.',
    skyAssetId: 'blaubeuren_night',
    skyUrl: '/verdant/realms/borealis/sky.jpg',
    glbUrl: '/verdant/realms/borealis/world.glb',
    vdntUrl: '/verdant/realms/borealis/world.vdnt',
    ambientMood: 'causeway',
    skyFallbackRgb: [0.16, 0.24, 0.38],
    fogRgb: [0.28, 0.38, 0.50],
    spawnPoint: [0, 21.0],
    soundtrack: getCanonicalSoundtrackForTheme('glacial-spire', false, 'borealis', 'The Frostglass Bastion of Borealis', 9103),
    dungeonEntrances: [
      {
        id: 'ent-borealis-crypt',
        dungeonSlug: 'borealis-frostglass-crypt',
        name: 'The Frostglass Choir Crypt',
        subtitle: 'Tier IV Glacial Sanctum · Beneath Aurora Citadel',
        position: [-14, -34],
        tier: 4,
        style: 'glacial-crypt',
      },
    ],
    materials: {
      terrain: 'snow_02',
      masonry: 'castle_wall_slates',
      road: 'asphalt_snow',
      timber: 'dark_wooden_planks',
    },
    terrainProfile: {
      macroAmp: 3.1,
      macroFreq: 0.048,
      gorgeDepth: 5.2,
      gorgeZ: 5.0,
      gorgeWaveAmp: 2.8,
      citadelLift: 4.5,
      citadelZ: -18,
      coastDip: 2.6,
      rimStart: 92,
      rimHeight: 3.8,
      waterLevel: -0.95,
      hasBridge: true,
      bridgeDeckY: 1.65,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: [
      { id: 'bor-statue-1', assetId: 'gothic_statue', source: 'polyhaven', label: 'Frostglass Sentinel W', position: [-5.6, -10.4], targetHeight: 4.0, yaw: 0.22, tintRgb: [0.68, 0.80, 0.92], maxTriangles: 500 },
      { id: 'bor-statue-2', assetId: 'gothic_statue', source: 'polyhaven', label: 'Frostglass Sentinel E', position: [5.6, -10.4], targetHeight: 4.0, yaw: -0.22, tintRgb: [0.68, 0.80, 0.92], maxTriangles: 500 },
      { id: 'bor-lantern-1', assetId: 'Lantern_01', source: 'polyhaven', label: 'Aurora Beacon Lamp W', position: [-4.4, 14.2], targetHeight: 1.35, yaw: 0.1, tintRgb: [0.56, 0.88, 0.98], maxTriangles: 340 },
      { id: 'bor-lantern-2', assetId: 'Lantern_01', source: 'polyhaven', label: 'Aurora Beacon Lamp E', position: [4.4, 14.2], targetHeight: 1.35, yaw: 1.6, tintRgb: [0.56, 0.88, 0.98], maxTriangles: 340 },
      { id: 'bor-rock-1', assetId: 'boulder_01', source: 'polyhaven', label: 'Glacial Slate Outcrop W', position: [-10.2, 8.8], targetHeight: 3.6, yaw: 0.5, tintRgb: [0.56, 0.66, 0.76], maxTriangles: 440 },
      { id: 'bor-rock-2', assetId: 'moon_rock_01', source: 'polyhaven', label: 'Glacial Slate Outcrop E', position: [10.8, 8.2], targetHeight: 3.8, yaw: 1.8, tintRgb: [0.58, 0.68, 0.78], maxTriangles: 440 },
      { id: 'bor-shield-1', assetId: 'kite_shield', source: 'polyhaven', label: 'Borealis Bastion Crest', position: [0, -13.0], yOffset: 1.8, targetHeight: 1.5, yaw: 0.0, tintRgb: [0.58, 0.82, 0.94], maxTriangles: 340 },
      { id: 'bor-crate-1', assetId: 'old_military_crate', source: 'polyhaven', label: 'Alpine Expedition Chest', position: [5.8, 16.2], targetHeight: 1.05, yaw: 0.4, tintRgb: [0.46, 0.52, 0.60], maxTriangles: 340 },
      { id: 'bor-barrel-1', assetId: 'Barrel_01', source: 'polyhaven', label: 'Glacier Oil Cask', position: [-5.2, 17.5], targetHeight: 1.1, yaw: 1.2, tintRgb: [0.44, 0.46, 0.52], maxTriangles: 320 },
      { id: 'bor-estoc-1', assetId: 'antique_estoc', source: 'polyhaven', label: 'Rime-Forged Obelisk Blade', position: [0, -56.0], yOffset: 1.2, targetHeight: 2.8, yaw: 0.2, tintRgb: [0.76, 0.90, 0.98], maxTriangles: 360 },
      { id: 'bor-west-rock', assetId: 'boulder_01', source: 'polyhaven', label: 'Frost Ring Monolith', position: [-52, -20], targetHeight: 4.1, yaw: 1.0, tintRgb: [0.52, 0.64, 0.76], maxTriangles: 420 },
    ],
    regions: [
      { id: 'high-causeway', name: 'Aurora Spire Bastion', subtitle: 'Frostglass Citadel & Starry Keep', center: [0, -14], radius: 18, ambientMood: 'causeway' },
      { id: 'ashen-kiln', name: 'Rime-Bell Hearth', subtitle: 'Thermal Meltwater Foundry', center: [-25, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'ironwood-reaches', name: 'Crystal Pine Reaches', subtitle: 'Frost-Rimed Timber Ridge', center: [25, -6], radius: 18, ambientMood: 'ironwood' },
      { id: 'salt-loom', name: 'Frozen Fjord Shelf', subtitle: 'Glacial Ice-Stacks & Pier', center: [24, 24], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: 'Borealis Snow-Gate', subtitle: 'High-Altitude Meridian Pass', center: [0, 19], radius: 16, ambientMood: 'causeway' },
      { id: 'northern-watch', name: 'Frostglass Crypt Approach', subtitle: 'Glacial Choir Sanctum Entry', center: [-6, -46], radius: 24, ambientMood: 'causeway' },
      { id: 'western-ruins', name: 'Star-Dial Monoliths', subtitle: 'Ancient Alpine Stone Circle', center: [-54, -22], radius: 24, ambientMood: 'causeway' },
      { id: 'eastern-ridge', name: 'Glacier Watch Camp', subtitle: 'Northern Survey Outpost', center: [54, 10], radius: 24, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: 'Borealis Snow-Gate', x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: 'Aurora Spire Bastion', x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'Frostglass Choir Crypt', x: -14, z: -29.5 },
      { regionId: 'western-ruins', name: 'Star-Dial Monoliths', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Glacier Watch Camp', x: 48, z: 10 },
    ],
    npcs: [
      {
        id: 'npc-astrid',
        name: 'Ice-Warden Astrid Sol',
        title: 'Borealis Glaciologist',
        guildId: 'guild-tideloom',
        guildName: 'Borealis Spire Watch',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_orenna_1795129454002.jpg',
        position: [-3.2, 15.6],
        cloakHex: 0x2c4e6e,
        trimHex: 0x9cd8f5,
        greeting:
          'Breathe slow in the thin air, Waywright. The glacier shifted three spans under the Aurora Bastion—opening the sealed doors of the Frostglass Choir Crypt.',
        cognitiveDrive: 'Stabilize Borealis’s glacial foundations using acoustic resonance before spring thaw.',
        concealedSecret: 'She recorded a harmonic echo beneath the ice sheet matching Vaelmor’s 174 Hz bronze bells.',
        speechCadence: 'Measured, crystal-clear, observant of barometric pressure and ice acoustics.',
        beliefs: ['Ice remembers every footstep and every storm for a thousand winters.'],
        choices: [
          {
            id: 'astrid-1',
            label: 'How do we stabilize the Aurora Spire foundations?',
            reply:
              'Strike the Ice-Arch Bridge Pier with your Bell-Hammer, attune the Aurora Waystone, and venture into the Frostglass Choir Crypt northwest of the keep.',
            thought: 'Hoping the Waywright can silence the Rime Colossus stirring inside the crypt.',
            renownGain: 35,
            advancesQuestId: 'quest-borealis-spire',
          },
        ],
      },
    ],
    quests: [
      {
        id: 'quest-borealis-spire',
        title: 'Harmonics of the Frostglass Spire',
        giverNpcId: 'npc-astrid',
        guildId: 'guild-tideloom',
        regionId: 'high-causeway',
        summary:
          'Sound Borealis’s glacial stress pier, attune the Aurora Spire Waystone, and vanquish the Rime-Bound Colossus prowling the frozen fjord.',
        motif: 'glacial ice acoustics',
        renownReward: 240,
        status: 'active',
        objectives: [
          { id: 'obj-bor-1', description: 'Speak with Ice-Warden Astrid Sol', kind: 'talk-npc', targetId: 'npc-astrid', targetCoords: [-3.2, 15.6], requiredCount: 1, currentCount: 0 },
          { id: 'obj-bor-2', description: 'Sound the Glacial Causeway Pier [Bell-Hammer]', kind: 'ring-bell', targetId: 'int-bor-pier', targetCoords: [0, 5.2], requiredCount: 1, currentCount: 0 },
          { id: 'obj-bor-3', description: 'Vanquish the Rime-Bound Colossus', kind: 'defeat-archetype', targetId: 'colossus', targetCoords: [22, 16], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: 'int-bor-pier', kind: 'resonance-pier', name: 'Glacial Causeway Pier', promptVerb: 'Sound Pier [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
      { id: 'int-bor-waystone', kind: 'waystone-beacon', name: 'Aurora Spire Waystone', promptVerb: 'Attune Aurora Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
      { id: 'int-bor-bell', kind: 'forge-bell', name: 'Rime-Bell Hearth Chime', promptVerb: 'Ring Rime-Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
      { id: 'int-bor-dungeon', kind: 'dungeon-portal', name: 'The Frostglass Choir Crypt', promptVerb: 'Descend into Frostglass Choir Crypt', regionId: 'northern-watch', position: [-14, -34], activated: false, targetRealmSlug: 'borealis-frostglass-crypt' },
      { id: 'int-bor-chest', kind: 'vault-chest', name: 'Star-Dial Relic Coffer', promptVerb: 'Unseal Relic Coffer', regionId: 'western-ruins', position: [-54, -22], activated: false },
    ],
    enemies: [
      makeEnemy('bor-e1', 'stalker', 'Rime-Fang Stalker', -12, -8, 74),
      makeEnemy('bor-e2', 'shardcaster', 'Frostglass Prism-Caster', 14, -9, 68),
      makeEnemy('bor-e3', 'colossus', 'Rime-Bound Glacier Colossus', 22, 16, 210),
      makeEnemy('bor-e4', 'stalker', 'Fjord Stalker', -46, -20, 76),
      makeEnemy('bor-e5', 'shardcaster', 'Aurora Refraction Sentinel', 48, 8, 72),
    ],
  },
];

/**
 * Pure model-centric 3D Dungeon Delve Synthesizer.
 * Generates a complete, playable multi-chamber vaulted 3D Dungeon spec with
 * Poly Haven stone/slate PBR materials, imported guardian statues & lanterns,
 * 3 Seal Braziers, 2 Treasure Vault Chests, Guardian Waves + Apex Boss,
 * an Ascend Portal back to the parent Realm, and a bespoke cavernous orchestral score!
 */
export function synthesizeProceduralDungeonSpec(params: {
  name: string;
  slug?: string;
  parentRealmSlug: string;
  parentRealmName?: string;
  style?: DungeonArchitecturalStyle;
  tier?: number;
  summary?: string;
  bossName?: string;
  questTitle?: string;
  seed?: number;
}): FrontiersRealmSpec {
  const slug =
    params.slug ||
    params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36) ||
    `delve-${Date.now()}`;

  const seed = params.seed ?? (slug.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 77) % 85000 + 4000);
  const style: DungeonArchitecturalStyle = params.style ?? 'catacomb-vault';
  const tier = Math.max(1, Math.min(5, params.tier ?? 2));
  const themeByStyle: Record<DungeonArchitecturalStyle, RealmThemeId> = {
    'catacomb-vault': 'citadel-highlands',
    'geothermal-depths': 'obsidian-crucible',
    'sunken-cistern': 'sunken-aqueducts',
    'abyssal-grotto': 'pelagic-spires',
    'echo-tomb': 'amber-steppe',
    'glacial-crypt': 'glacial-spire',
  };
  const theme = themeByStyle[style];

  const matByStyle: Record<
    DungeonArchitecturalStyle,
    {
      skyAssetId: string;
      materials: FrontiersRealmSpec['materials'];
      skyFallbackRgb: [number, number, number];
      fogRgb: [number, number, number];
      statueTint: [number, number, number];
      lampTint: [number, number, number];
    }
  > = {
    'catacomb-vault': {
      skyAssetId: 'dikhololo_night',
      materials: { terrain: 'cobblestone_04', masonry: 'castle_brick_01', road: 'mossy_cobblestone', timber: 'dark_wooden_planks' },
      skyFallbackRgb: [0.08, 0.10, 0.14],
      fogRgb: [0.12, 0.14, 0.18],
      statueTint: [0.46, 0.48, 0.52],
      lampTint: [0.92, 0.68, 0.28],
    },
    'geothermal-depths': {
      skyAssetId: 'dikhololo_night',
      materials: { terrain: 'cliff_side', masonry: 'castle_wall_slates', road: 'cobblestone_04', timber: 'black_painted_planks' },
      skyFallbackRgb: [0.16, 0.08, 0.06],
      fogRgb: [0.24, 0.12, 0.09],
      statueTint: [0.34, 0.28, 0.26],
      lampTint: [0.98, 0.48, 0.18],
    },
    'sunken-cistern': {
      skyAssetId: 'blue_lagoon_night',
      materials: { terrain: 'cobblestone_02', masonry: 'brick_moss_001', road: 'mossy_cobblestone', timber: 'brown_planks_05' },
      skyFallbackRgb: [0.06, 0.14, 0.16],
      fogRgb: [0.10, 0.20, 0.22],
      statueTint: [0.38, 0.52, 0.46],
      lampTint: [0.36, 0.88, 0.68],
    },
    'abyssal-grotto': {
      skyAssetId: 'blue_lagoon_night',
      materials: { terrain: 'coast_sand_rocks_02', masonry: 'stone_wall', road: 'cobblestone_02', timber: 'weathered_brown_planks' },
      skyFallbackRgb: [0.05, 0.14, 0.20],
      fogRgb: [0.08, 0.20, 0.28],
      statueTint: [0.32, 0.62, 0.68],
      lampTint: [0.28, 0.94, 0.96],
    },
    'echo-tomb': {
      skyAssetId: 'dikhololo_night',
      materials: { terrain: 'red_sand', masonry: 'red_brick', road: 'cobblestone_04', timber: 'brown_planks_05' },
      skyFallbackRgb: [0.18, 0.12, 0.07],
      fogRgb: [0.26, 0.18, 0.10],
      statueTint: [0.76, 0.58, 0.34],
      lampTint: [0.98, 0.80, 0.28],
    },
    'glacial-crypt': {
      skyAssetId: 'blaubeuren_night',
      materials: { terrain: 'asphalt_snow', masonry: 'castle_wall_slates', road: 'snow_02', timber: 'dark_wooden_planks' },
      skyFallbackRgb: [0.08, 0.14, 0.24],
      fogRgb: [0.16, 0.24, 0.36],
      statueTint: [0.64, 0.80, 0.94],
      lampTint: [0.54, 0.88, 0.98],
    },
  };

  const cfg = matByStyle[style];
  const bossName =
    params.bossName ||
    (style === 'geothermal-depths'
      ? 'Magma-Heart Foundry Warden'
      : style === 'sunken-cistern'
        ? 'Abyssal Sluice Leviathan-Golem'
        : style === 'abyssal-grotto'
          ? 'Abyssal Shoal Leviathan'
          : style === 'echo-tomb'
            ? 'Grand Wind-Harp Automaton'
            : style === 'glacial-crypt'
              ? 'Frostglass Choir Archon'
              : 'The Meridian Vault Colossus');
  const questId = `quest-delve-${slug}`;
  const bossHp = 195 + tier * 35;

  return {
    id: `dungeon-${slug}`,
    slug,
    name: params.name,
    subtitle: `Tier ${tier} 3D Dungeon Delve · Beneath ${params.parentRealmName || params.parentRealmSlug}`,
    cell: [0, -tier, 0],
    theme,
    seed,
    worldHalfExtent: 46,
    isDungeon: true,
    parentRealmSlug: params.parentRealmSlug,
    dungeonStyle: style,
    dungeonTier: tier,
    dungeonEntrances: [],
    summary:
      params.summary ||
      `A subterranean vaulted sanctuary beneath ${params.parentRealmName || params.parentRealmSlug}. Cross the glowing abyss bridge, ignite the three Resonant Seal Braziers, unseal the alcove vaults, and defeat ${bossName}.`,
    skyAssetId: cfg.skyAssetId,
    skyUrl: `/verdant/realms/${slug}/sky.jpg`,
    glbUrl: `/verdant/realms/${slug}/world.glb`,
    vdntUrl: `/verdant/realms/${slug}/world.vdnt`,
    ambientMood: style === 'geothermal-depths' ? 'foundry' : 'causeway',
    skyFallbackRgb: cfg.skyFallbackRgb,
    fogRgb: cfg.fogRgb,
    spawnPoint: [0, 26.5],
    soundtrack: getCanonicalSoundtrackForTheme(theme, true, slug, params.name, seed),
    materials: cfg.materials,
    terrainProfile: {
      macroAmp: 0,
      macroFreq: 0.05,
      gorgeDepth: 5.0,
      gorgeZ: 11.0,
      gorgeWaveAmp: 0,
      citadelLift: 0,
      citadelZ: -26,
      coastDip: 0,
      rimStart: 42,
      rimHeight: 2.0,
      waterLevel: -2.2,
      hasBridge: true,
      bridgeDeckY: 1.15,
      bridgeZMin: 3.6,
      bridgeZMax: 18.4,
      bridgeHalfWidth: 2.65,
    },
    importedCatalogProps: [
      { id: `${slug}-st-w`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Vestibule Warden W', position: [-6.0, 21.0], targetHeight: 3.8, yaw: 0.3, tintRgb: cfg.statueTint, maxTriangles: 480 },
      { id: `${slug}-st-e`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Vestibule Warden E', position: [6.0, 21.0], targetHeight: 3.8, yaw: -0.3, tintRgb: cfg.statueTint, maxTriangles: 480 },
      { id: `${slug}-st-bw`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Sanctum Sentinel W', position: [-9.0, -24.0], targetHeight: 4.4, yaw: 0.4, tintRgb: cfg.statueTint, maxTriangles: 500 },
      { id: `${slug}-st-be`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Sanctum Sentinel E', position: [9.0, -24.0], targetHeight: 4.4, yaw: -0.4, tintRgb: cfg.statueTint, maxTriangles: 500 },
      { id: `${slug}-lamp-1`, assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Bridge Torch W', position: [-3.4, 18.2], targetHeight: 1.35, yaw: 0.1, tintRgb: cfg.lampTint, maxTriangles: 340 },
      { id: `${slug}-lamp-2`, assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Bridge Torch E', position: [3.4, 18.2], targetHeight: 1.35, yaw: 1.5, tintRgb: cfg.lampTint, maxTriangles: 340 },
      { id: `${slug}-lamp-3`, assetId: 'Lantern_01', source: 'polyhaven', label: 'Rotunda Lantern W', position: [-8.5, -3.0], targetHeight: 1.35, yaw: 0.3, tintRgb: cfg.lampTint, maxTriangles: 340 },
      { id: `${slug}-lamp-4`, assetId: 'Lantern_01', source: 'polyhaven', label: 'Rotunda Lantern E', position: [8.5, -3.0], targetHeight: 1.35, yaw: 1.9, tintRgb: cfg.lampTint, maxTriangles: 340 },
      { id: `${slug}-estoc`, assetId: 'antique_estoc', source: 'polyhaven', label: 'Boss Altar Relic Blade', position: [0, -32.0], yOffset: 1.2, targetHeight: 2.6, yaw: 0.0, tintRgb: [0.88, 0.80, 0.56], maxTriangles: 360 },
      { id: `${slug}-vase-w`, assetId: 'brass_vase_01', source: 'polyhaven', label: 'West Alcove Reliquary', position: [-18.5, -4.0], targetHeight: 1.4, yaw: 0.8, tintRgb: cfg.lampTint, maxTriangles: 320 },
      { id: `${slug}-crate-e`, assetId: 'old_military_crate', source: 'polyhaven', label: 'East Alcove Vault Crate', position: [18.5, -4.0], targetHeight: 1.15, yaw: 0.4, tintRgb: [0.44, 0.38, 0.32], maxTriangles: 320 },
      { id: `${slug}-rock-1`, assetId: 'boulder_01', source: 'polyhaven', label: 'Vault Cavern Outcrop', position: [-14.0, -29.0], targetHeight: 3.2, yaw: 0.9, tintRgb: cfg.statueTint, maxTriangles: 400 },
    ],
    regions: [
      { id: 'dungeon-sanctum', name: `${params.name} — Vestibule`, subtitle: `Tier ${tier} Subterranean Vault`, center: [0, 22], radius: 14, ambientMood: 'causeway' },
      { id: 'high-causeway', name: 'Abyss Span & Seal Rotunda', subtitle: 'Pillared Acoustic Hall & Treasure Alcoves', center: [0, -4], radius: 18, ambientMood: 'foundry' },
      { id: 'boss-vault', name: `${bossName} Sanctum`, subtitle: 'Inner Boss Amphitheater & Ascend Portal', center: [0, -26], radius: 16, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [
      { regionId: 'dungeon-sanctum', name: 'Dungeon Entry Vestibule', x: 0, z: 26.5 },
      { regionId: 'high-causeway', name: 'Central Seal Rotunda', x: 0, z: -2.0 },
      { regionId: 'boss-vault', name: 'Boss Sanctum Threshold', x: 0, z: -18.0 },
    ],
    npcs: [],
    quests: [
      {
        id: questId,
        title: params.questTitle || `Delve: ${params.name}`,
        giverNpcId: 'npc-orenna',
        guildId: 'guild-kiln',
        regionId: 'boss-vault',
        summary: `Conquer ${params.name}: ignite the Resonant Seal Braziers, plunder the side treasure vaults, and defeat ${bossName} in the northern Sanctum.`,
        motif: `subterranean ${style} delve`,
        renownReward: 220 + tier * 45,
        status: 'active',
        objectives: [
          { id: `obj-${slug}-brazier`, description: 'Ignite Resonant Seal Braziers', kind: 'calibrate-beacon', targetId: `${slug}-brazier`, targetCoords: [0, -4], requiredCount: 2, currentCount: 0 },
          { id: `obj-${slug}-boss`, description: `Vanquish ${bossName}`, kind: 'defeat-archetype', targetId: 'colossus', targetCoords: [0, -26], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables: [
      { id: `${slug}-brazier-w`, kind: 'seal-brazier', name: 'West Resonant Seal Brazier', promptVerb: 'Ignite Seal Brazier', regionId: 'high-causeway', position: [-8.5, -4.5], activated: false },
      { id: `${slug}-brazier-e`, kind: 'seal-brazier', name: 'East Resonant Seal Brazier', promptVerb: 'Ignite Seal Brazier', regionId: 'high-causeway', position: [8.5, -4.5], activated: false },
      { id: `${slug}-chest-w`, kind: 'vault-chest', name: 'West Alcove Relic Chest', promptVerb: 'Unseal Vault Chest', regionId: 'high-causeway', position: [-16.5, -4.0], activated: false },
      { id: `${slug}-chest-e`, kind: 'vault-chest', name: 'East Alcove Foundry Coffer', promptVerb: 'Unseal Vault Coffer', regionId: 'high-causeway', position: [16.5, -4.0], activated: false },
      {
        id: `${slug}-ascend-entry`,
        kind: 'dungeon-exit',
        name: `Ascend to ${params.parentRealmName || params.parentRealmSlug}`,
        promptVerb: `Return to ${params.parentRealmName || 'Surface Realm'}`,
        regionId: 'dungeon-sanctum',
        position: [0, 30.5],
        activated: false,
        targetRealmSlug: params.parentRealmSlug,
      },
      {
        id: `${slug}-ascend-boss`,
        kind: 'dungeon-exit',
        name: `Sanctum Ascend Portal (${params.parentRealmName || params.parentRealmSlug})`,
        promptVerb: `Ascend to ${params.parentRealmName || 'Surface Realm'}`,
        regionId: 'boss-vault',
        position: [0, -33.5],
        activated: false,
        targetRealmSlug: params.parentRealmSlug,
      },
    ],
    enemies: [
      makeEnemy(`${slug}-e1`, 'stalker', 'Vault Stone-Stalker', -6.5, 0.5, 64 + tier * 10),
      makeEnemy(`${slug}-e2`, 'stalker', 'Rotunda Skirmisher', 6.5, 0.5, 64 + tier * 10),
      makeEnemy(`${slug}-e3`, 'shardcaster', 'Alcove Prism-Sentinel', -12.5, -5.5, 60 + tier * 10),
      makeEnemy(`${slug}-e4`, 'shardcaster', 'Sanctum Arc-Weaver', 12.5, -5.5, 60 + tier * 10),
      makeEnemy(`${slug}-boss`, 'colossus', bossName, 0, -25.5, bossHp),
    ],
  };
}

/**
 * Six pre-compiled playable 3D Signature Dungeons — one linked to each of the 6
 * canonical Federated Meridian Realms!
 */
export const CANONICAL_DUNGEON_SPECS: FrontiersRealmSpec[] = [
  synthesizeProceduralDungeonSpec({
    name: 'The Sunken Meridian Vault',
    slug: 'vault-of-vaelmor',
    parentRealmSlug: 'vaelmor',
    parentRealmName: 'Vaelmor',
    style: 'catacomb-vault',
    tier: 1,
    bossName: 'The Charter Stone Colossus',
    questTitle: 'Secrets of the Sunken Meridian Vault',
    seed: 17701,
  }),
  synthesizeProceduralDungeonSpec({
    name: 'The Flooded Siphon Catacombs',
    slug: 'oakhaven-cistern-labyrinth',
    parentRealmSlug: 'oakhaven',
    parentRealmName: 'Oakhaven',
    style: 'sunken-cistern',
    tier: 2,
    bossName: 'Siphon-Core Leviathan Golem',
    questTitle: 'Heart of the Flooded Siphon',
    seed: 17702,
  }),
  synthesizeProceduralDungeonSpec({
    name: 'The Crucible Core Depths',
    slug: 'cinderfall-magma-delve',
    parentRealmSlug: 'cinderfall',
    parentRealmName: 'Cinderfall',
    style: 'geothermal-depths',
    tier: 3,
    bossName: 'Anvil-Heart Caldera Warden',
    questTitle: 'Quenching the Crucible Core',
    seed: 17703,
  }),
  synthesizeProceduralDungeonSpec({
    name: 'The Drowned Sextant Grotto',
    slug: 'glasswater-abyssal-grotto',
    parentRealmSlug: 'glasswater',
    parentRealmName: 'Glasswater',
    style: 'abyssal-grotto',
    tier: 2,
    bossName: 'Abyssal Shoal Sentinel',
    questTitle: 'Bearings of the Drowned Grotto',
    seed: 17704,
  }),
  synthesizeProceduralDungeonSpec({
    name: 'The Resonance Hall of Kar-Veth',
    slug: 'karveth-echo-tomb',
    parentRealmSlug: 'kar-veth',
    parentRealmName: 'Kar-Veth',
    style: 'echo-tomb',
    tier: 3,
    bossName: 'Grand Wind-Harp Automaton',
    questTitle: 'Silence in the Resonance Hall',
    seed: 17705,
  }),
  synthesizeProceduralDungeonSpec({
    name: 'The Frostglass Choir Crypt',
    slug: 'borealis-frostglass-crypt',
    parentRealmSlug: 'borealis',
    parentRealmName: 'Borealis',
    style: 'glacial-crypt',
    tier: 4,
    bossName: 'Frostglass Choir Archon',
    questTitle: 'Canticle of the Frozen Crypt',
    seed: 17706,
  }),
];

export const ALL_CANONICAL_WORLDS: FrontiersRealmSpec[] = [
  ...CANONICAL_REALM_SPECS,
  ...CANONICAL_DUNGEON_SPECS,
];

/**
 * Pure model-centric synthesizer that turns any arbitrary cell (cx, cy, cz) +
 * Frontier theme brief into a complete, vast 224m x 224m FrontiersRealmSpec
 * with bespoke orchestral score, outer frontier districts, NPCs, quests, and
 * imported external Poly Haven 3D catalog props!
 */
export function synthesizeProceduralRealmSpec(params: {
  name: string;
  cell: [number, number, number];
  theme?: RealmThemeId;
  summary?: string;
  npcName?: string;
  npcTitle?: string;
  npcGreeting?: string;
  questTitle?: string;
  questSummary?: string;
  questMotif?: string;
  linkedDungeonSlug?: string;
  linkedDungeonName?: string;
}): FrontiersRealmSpec {
  const [cx, cy, cz] = params.cell;
  const seed = (Math.abs((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) % 90000) + 1000;
  const slug =
    params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || `frontier-${cx}-${cz}`;

  const themes: RealmThemeId[] = [
    'sunken-aqueducts',
    'obsidian-crucible',
    'pelagic-spires',
    'citadel-highlands',
    'amber-steppe',
    'glacial-spire',
  ];
  const theme = params.theme ?? themes[seed % themes.length];

  const paletteByTheme: Record<
    RealmThemeId,
    {
      skyAssetId: string;
      materials: FrontiersRealmSpec['materials'];
      ambientMood: WorldRegion['ambientMood'];
      skyFallbackRgb: [number, number, number];
      fogRgb: [number, number, number];
      props: ImportedCatalogPropPlacement[];
    }
  > = {
    'citadel-highlands': {
      skyAssetId: 'belfast_sunset_puresky',
      materials: { terrain: 'aerial_grass_rock', masonry: 'castle_brick_01', road: 'mossy_cobblestone', timber: 'dark_wooden_planks' },
      ambientMood: 'causeway',
      skyFallbackRgb: [0.34, 0.44, 0.56],
      fogRgb: [0.58, 0.52, 0.44],
      props: [
        { id: `${slug}-p1`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Frontier Sentinel W', position: [-5.4, -10.4], targetHeight: 3.6, yaw: 0.2, tintRgb: [0.50, 0.50, 0.48], maxTriangles: 480 },
        { id: `${slug}-p2`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Frontier Sentinel E', position: [5.4, -10.4], targetHeight: 3.6, yaw: -0.2, tintRgb: [0.50, 0.50, 0.48], maxTriangles: 480 },
        { id: `${slug}-p3`, assetId: 'Barrel_01', source: 'polyhaven', label: 'Expedition Cask', position: [-4.8, 17.2], targetHeight: 1.1, yaw: 0.6, tintRgb: [0.52, 0.36, 0.22], maxTriangles: 320 },
        { id: `${slug}-p4`, assetId: 'boulder_01', source: 'polyhaven', label: 'Highland Tor', position: [10.8, 7.0], targetHeight: 3.2, yaw: 1.4, tintRgb: [0.35, 0.36, 0.39], maxTriangles: 420 },
        { id: `${slug}-p5`, assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Surveyor Drafting Table', position: [-6.2, 16.5], targetHeight: 1.05, yaw: 0.0, tintRgb: [0.48, 0.34, 0.22], maxTriangles: 340 },
        { id: `${slug}-p6`, assetId: 'Lantern_01', source: 'polyhaven', label: 'Watchtower Lamp', position: [-50, -20], targetHeight: 1.35, yaw: 0.4, tintRgb: [0.88, 0.68, 0.32], maxTriangles: 320 },
      ],
    },
    'sunken-aqueducts': {
      skyAssetId: 'autumn_field_puresky',
      materials: { terrain: 'brown_mud_leaves_01', masonry: 'brick_moss_001', road: 'cobblestone_02', timber: 'brown_planks_05' },
      ambientMood: 'ironwood',
      skyFallbackRgb: [0.38, 0.50, 0.46],
      fogRgb: [0.52, 0.58, 0.50],
      props: [
        { id: `${slug}-p1`, assetId: 'fern_02', source: 'polyhaven', label: 'Silicate Fern W', position: [-6.2, 14.8], targetHeight: 1.8, yaw: 0.4, tintRgb: [0.22, 0.52, 0.26], maxTriangles: 340 },
        { id: `${slug}-p2`, assetId: 'ceramic_pot', source: 'polyhaven', label: 'Aqueduct Vessel', position: [4.8, 16.2], targetHeight: 1.1, yaw: 1.2, tintRgb: [0.64, 0.46, 0.32], maxTriangles: 320 },
        { id: `${slug}-p3`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Moss Guardian', position: [5.6, -10.5], targetHeight: 3.7, yaw: -0.3, tintRgb: [0.42, 0.50, 0.40], maxTriangles: 480 },
        { id: `${slug}-p4`, assetId: 'boulder_01', source: 'polyhaven', label: 'Mossy Cistern Boulder', position: [-12.0, 8.0], targetHeight: 3.2, yaw: 0.9, tintRgb: [0.36, 0.44, 0.36], maxTriangles: 420 },
        { id: `${slug}-p5`, assetId: 'antique_ceramic_vase_01', source: 'polyhaven', label: 'Sluice Offering Urn', position: [-50, -20], targetHeight: 1.35, yaw: 0.7, tintRgb: [0.60, 0.46, 0.32], maxTriangles: 320 },
      ],
    },
    'obsidian-crucible': {
      skyAssetId: 'dikhololo_sunset',
      materials: { terrain: 'cliff_side', masonry: 'castle_wall_slates', road: 'cobblestone_04', timber: 'black_painted_planks' },
      ambientMood: 'foundry',
      skyFallbackRgb: [0.42, 0.24, 0.18],
      fogRgb: [0.56, 0.34, 0.24],
      props: [
        { id: `${slug}-p1`, assetId: 'boulder_01', source: 'polyhaven', label: 'Obsidian Spire Rock', position: [-9.8, 9.2], targetHeight: 3.6, yaw: 0.8, tintRgb: [0.22, 0.20, 0.22], maxTriangles: 440 },
        { id: `${slug}-p2`, assetId: 'brass_diya_lantern', source: 'polyhaven', label: 'Caldera Signal Lamp', position: [-4.2, 14.4], targetHeight: 1.3, yaw: 0.2, tintRgb: [0.88, 0.58, 0.22], maxTriangles: 340 },
        { id: `${slug}-p3`, assetId: 'brass_pot_01', source: 'polyhaven', label: 'Crucible Kettle', position: [5.6, 16.5], targetHeight: 1.2, yaw: 1.0, tintRgb: [0.78, 0.52, 0.24], maxTriangles: 320 },
        { id: `${slug}-p4`, assetId: 'antique_estoc', source: 'polyhaven', label: 'Forge Monument Blade', position: [0, -13.0], yOffset: 1.2, targetHeight: 2.4, yaw: 0.3, tintRgb: [0.84, 0.74, 0.64], maxTriangles: 360 },
        { id: `${slug}-p5`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Caldera Sentinel', position: [-6.0, -10.4], targetHeight: 3.8, yaw: 0.2, tintRgb: [0.28, 0.26, 0.27], maxTriangles: 480 },
      ],
    },
    'pelagic-spires': {
      skyAssetId: 'aristea_wreck_puresky',
      materials: { terrain: 'coast_sand_rocks_02', masonry: 'castle_brick_01', road: 'cobblestone_floor_01', timber: 'brown_planks_03' },
      ambientMood: 'coast',
      skyFallbackRgb: [0.40, 0.56, 0.68],
      fogRgb: [0.64, 0.70, 0.74],
      props: [
        { id: `${slug}-p1`, assetId: 'Barrel_01', source: 'polyhaven', label: 'Harbor Cask', position: [-5.0, 17.0], targetHeight: 1.1, yaw: 0.4, tintRgb: [0.56, 0.42, 0.26], maxTriangles: 320 },
        { id: `${slug}-p2`, assetId: 'kite_shield', source: 'polyhaven', label: 'Pelagic Crest', position: [0, -13.0], yOffset: 1.6, targetHeight: 1.45, yaw: 0.0, tintRgb: [0.34, 0.68, 0.74], maxTriangles: 340 },
        { id: `${slug}-p3`, assetId: 'boulder_01', source: 'polyhaven', label: 'Headland Shoal', position: [14.0, 16.0], targetHeight: 3.3, yaw: 1.7, tintRgb: [0.48, 0.50, 0.48], maxTriangles: 420 },
        { id: `${slug}-p4`, assetId: 'Lantern_01', source: 'polyhaven', label: 'Pier Signal Lamp', position: [-4.4, 14.0], targetHeight: 1.25, yaw: 0.0, tintRgb: [0.88, 0.74, 0.34], maxTriangles: 320 },
      ],
    },
    'amber-steppe': {
      skyAssetId: 'grasslands_sunset',
      materials: { terrain: 'aerial_sand', masonry: 'large_sandstone_blocks_01', road: 'cobblestone_01', timber: 'brown_planks_03' },
      ambientMood: 'ironwood',
      skyFallbackRgb: [0.50, 0.44, 0.34],
      fogRgb: [0.66, 0.56, 0.42],
      props: [
        { id: `${slug}-p1`, assetId: 'WoodenTable_02', source: 'polyhaven', label: 'Steppe Survey Bench', position: [-6.2, 16.5], targetHeight: 1.0, yaw: 0.2, tintRgb: [0.54, 0.38, 0.24], maxTriangles: 340 },
        { id: `${slug}-p2`, assetId: 'old_military_crate', source: 'polyhaven', label: 'Caravan Crate', position: [5.4, 16.6], targetHeight: 1.0, yaw: 0.8, tintRgb: [0.48, 0.42, 0.32], maxTriangles: 340 },
        { id: `${slug}-p3`, assetId: 'antique_estoc', source: 'polyhaven', label: 'Charter Waymarker Blade', position: [0, -13.0], yOffset: 1.1, targetHeight: 2.4, yaw: 0.3, tintRgb: [0.80, 0.74, 0.62], maxTriangles: 360 },
        { id: `${slug}-p4`, assetId: 'brass_vase_01', source: 'polyhaven', label: 'Wind-Harp Resonator', position: [-4.4, 14.4], targetHeight: 1.3, yaw: 0.4, tintRgb: [0.88, 0.66, 0.30], maxTriangles: 320 },
        { id: `${slug}-p5`, assetId: 'boulder_01', source: 'polyhaven', label: 'Canyon Sandstone Tor', position: [11.0, 8.0], targetHeight: 3.4, yaw: 1.2, tintRgb: [0.62, 0.48, 0.34], maxTriangles: 420 },
      ],
    },
    'glacial-spire': {
      skyAssetId: 'blaubeuren_night',
      materials: { terrain: 'snow_02', masonry: 'castle_wall_slates', road: 'asphalt_snow', timber: 'dark_wooden_planks' },
      ambientMood: 'causeway',
      skyFallbackRgb: [0.16, 0.24, 0.38],
      fogRgb: [0.28, 0.38, 0.50],
      props: [
        { id: `${slug}-p1`, assetId: 'gothic_statue', source: 'polyhaven', label: 'Glacial Sentinel W', position: [-5.6, -10.4], targetHeight: 3.9, yaw: 0.2, tintRgb: [0.68, 0.80, 0.92], maxTriangles: 480 },
        { id: `${slug}-p2`, assetId: 'Lantern_01', source: 'polyhaven', label: 'Aurora Relay Lamp', position: [-4.4, 14.2], targetHeight: 1.35, yaw: 0.2, tintRgb: [0.56, 0.88, 0.98], maxTriangles: 340 },
        { id: `${slug}-p3`, assetId: 'boulder_01', source: 'polyhaven', label: 'Glacial Slate Outcrop', position: [10.5, 8.5], targetHeight: 3.5, yaw: 1.5, tintRgb: [0.56, 0.66, 0.76], maxTriangles: 440 },
        { id: `${slug}-p4`, assetId: 'kite_shield', source: 'polyhaven', label: 'Frostglass Crest', position: [0, -13.0], yOffset: 1.6, targetHeight: 1.5, yaw: 0.0, tintRgb: [0.58, 0.82, 0.94], maxTriangles: 340 },
      ],
    },
  };

  const pal = paletteByTheme[theme];
  const npcId = `npc-${slug}-warden`;
  const npcName = params.npcName || `Surveyor ${params.name.split(' ')[0]} Vane`;
  const npcTitle = params.npcTitle || 'Frontier Cell Cartographer';
  const questId = `quest-${slug}-charter`;
  const dungeonEntrances: DungeonEntranceSpec[] = params.linkedDungeonSlug
    ? [
        {
          id: `ent-${slug}-vault`,
          dungeonSlug: params.linkedDungeonSlug,
          name: params.linkedDungeonName || `${params.name} Subterranean Vault`,
          subtitle: `Tier 2 Vault · Beneath ${params.name}`,
          position: [-14, -34],
          tier: 2,
          style: theme === 'obsidian-crucible' ? 'geothermal-depths' : theme === 'glacial-spire' ? 'glacial-crypt' : 'catacomb-vault',
        },
      ]
    : [];

  const interactables: WorldInteractable[] = [
    { id: `int-${slug}-pier`, kind: 'resonance-pier', name: `${params.name} Causeway Pier`, promptVerb: 'Sound Causeway Pier [Bell-Hammer]', regionId: 'high-causeway', position: [0, 5.2], requiredGear: 'bellhammer', activated: false },
    { id: `int-${slug}-waystone`, kind: 'waystone-beacon', name: `${params.name} Crown Waystone`, promptVerb: 'Attune Meridian Waystone', regionId: 'high-causeway', position: [0, -10.5], activated: false },
    { id: `int-${slug}-bell`, kind: 'forge-bell', name: `${params.name} Frontier Bell`, promptVerb: 'Ring Frontier Bell [Bell-Hammer]', regionId: 'ashen-kiln', position: [-25, -8], requiredGear: 'bellhammer', activated: false },
    { id: `int-${slug}-chest`, kind: 'vault-chest', name: `${params.name} Frontier Coffer`, promptVerb: 'Unseal Frontier Coffer', regionId: 'western-ruins', position: [-54, -22], activated: false },
  ];

  if (params.linkedDungeonSlug) {
    interactables.push({
      id: `int-${slug}-dungeon`,
      kind: 'dungeon-portal',
      name: params.linkedDungeonName || `${params.name} Vault`,
      promptVerb: `Descend into ${params.linkedDungeonName || 'Vault'}`,
      regionId: 'northern-watch',
      position: [-14, -34],
      activated: false,
      targetRealmSlug: params.linkedDungeonSlug,
    });
  }

  return {
    id: `realm-${slug}`,
    slug,
    name: params.name,
    subtitle: `Cell (${cx}, ${cy}, ${cz}) · Autonomous Verdant Frontier`,
    cell: [cx, cy, cz],
    theme,
    seed,
    worldHalfExtent: 112,
    isGenerated: true,
    dungeonEntrances,
    soundtrack: getCanonicalSoundtrackForTheme(theme, false, slug, params.name, seed),
    summary:
      params.summary ||
      `An expansive Frontier Meridian Cell charted at (${cx}, ${cy}, ${cz}), compiled with Poly Haven CC0 PBR geology, customized photogrammetry landmarks, outer frontier monoliths, and Stitch 2-of-3 parity custody.`,
    skyAssetId: pal.skyAssetId,
    skyUrl: `/verdant/realms/${slug}/sky.jpg`,
    glbUrl: `/verdant/realms/${slug}/world.glb`,
    vdntUrl: `/verdant/realms/${slug}/world.vdnt`,
    ambientMood: pal.ambientMood,
    skyFallbackRgb: pal.skyFallbackRgb,
    fogRgb: pal.fogRgb,
    spawnPoint: [0, 21.0],
    materials: pal.materials,
    terrainProfile: {
      macroAmp: 2.3 + (seed % 9) * 0.14,
      macroFreq: 0.048,
      gorgeDepth: 4.5 + (seed % 5) * 0.25,
      gorgeZ: 5.0,
      gorgeWaveAmp: 2.6 + (seed % 4) * 0.35,
      citadelLift: 3.9,
      citadelZ: -18,
      coastDip: 2.5,
      rimStart: 92,
      rimHeight: 3.0,
      waterLevel: -0.85,
      hasBridge: true,
      bridgeDeckY: 1.6,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: pal.props,
    regions: [
      { id: 'high-causeway', name: `${params.name} Crown`, subtitle: 'Northern Citadel & Waystone', center: [0, -14], radius: 18, ambientMood: pal.ambientMood },
      { id: 'ashen-kiln', name: 'Western Resonance Basin', subtitle: 'Frontier Foundry & Bell Pavilion', center: [-25, -6], radius: 18, ambientMood: 'foundry' },
      { id: 'ironwood-reaches', name: 'Eastern Frontier Reaches', subtitle: 'Wilderness Grove & Outpost', center: [25, -6], radius: 18, ambientMood: 'ironwood' },
      { id: 'salt-loom', name: 'Southeastern Shoal', subtitle: 'Tidal Headland & Pier', center: [24, 24], radius: 20, ambientMood: 'coast' },
      { id: 'southern-terrace', name: `${params.name} Gate`, subtitle: `Meridian Portal (${cx},${cy},${cz})`, center: [0, 19], radius: 16, ambientMood: pal.ambientMood },
      { id: 'northern-watch', name: 'Northern Watch Ridge', subtitle: 'Outer Frontier Spire', center: [-6, -46], radius: 24, ambientMood: pal.ambientMood },
      { id: 'western-ruins', name: 'Western Standing Stones', subtitle: 'Pre-Charter Monolith Ring', center: [-54, -22], radius: 24, ambientMood: 'foundry' },
      { id: 'eastern-ridge', name: 'Eastern Survey Overlook', subtitle: 'Caravan Ridge Depot', center: [54, 10], radius: 24, ambientMood: 'ironwood' },
    ],
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: `${params.name} Gate`, x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: `${params.name} Crown`, x: 0, z: -8.5 },
      { regionId: 'ashen-kiln', name: 'Western Resonance Basin', x: -20, z: -5 },
      { regionId: 'western-ruins', name: 'Western Standing Stones', x: -49, z: -18 },
      { regionId: 'eastern-ridge', name: 'Eastern Survey Overlook', x: 48, z: 10 },
    ],
    npcs: [
      {
        id: npcId,
        name: npcName,
        title: npcTitle,
        guildId: 'guild-causeway',
        guildName: 'Meridian Waywright Compact',
        regionId: 'southern-terrace',
        portraitUrl: '/src/assets/images/ff_npc_kaelen_1795129454573.jpg',
        position: [-3.2, 15.6],
        cloakHex: 0x3b6778,
        trimHex: 0xe0b35a,
        greeting:
          params.npcGreeting ||
          `You made it through the Stitch meridian to ${params.name}. Help us anchor the Crown Waystone and sound the Causeway Pier before the dusk tremor hits.`,
        cognitiveDrive: `Establish a permanent federated survey charter across ${params.name}.`,
        concealedSecret: `Detected an unrecorded acoustic echo linking Cell (${cx},${cy},${cz}) to Vaelmor’s subterranean vaults.`,
        speechCadence: 'Measured, enthusiastic, speaks in surveyor bearings and stone acoustics.',
        beliefs: ['Every uncharted cell becomes a foundation once its waystone sings.'],
        choices: [
          {
            id: `${slug}-c1`,
            label: 'Where should we begin anchoring this frontier?',
            reply:
              'Cross the Causeway Pier and sound it with your Bell-Hammer, then attune the Crown Waystone on the northern terrace.',
            thought: 'Recording the Waywright’s bearing onto the Meridian ledger.',
            renownGain: 30,
            advancesQuestId: questId,
          },
        ],
      },
    ],
    quests: [
      {
        id: questId,
        title: params.questTitle || `Anchoring ${params.name}`,
        giverNpcId: npcId,
        guildId: 'guild-causeway',
        regionId: 'high-causeway',
        summary:
          params.questSummary ||
          `Survey the newly compiled cell of ${params.name}: sound the Causeway Pier with your Bell-Hammer and attune the Crown Waystone.`,
        motif: params.questMotif || 'meridian frontier cartography',
        renownReward: 200,
        status: 'active',
        objectives: [
          { id: `obj-${slug}-1`, description: `Speak with ${npcName}`, kind: 'talk-npc', targetId: npcId, targetCoords: [-3.2, 15.6], requiredCount: 1, currentCount: 0 },
          { id: `obj-${slug}-2`, description: 'Sound the Causeway Pier [Bell-Hammer]', kind: 'ring-bell', targetId: `int-${slug}-pier`, targetCoords: [0, 5.2], requiredCount: 1, currentCount: 0 },
          { id: `obj-${slug}-3`, description: 'Attune the Crown Waystone', kind: 'calibrate-beacon', targetId: `int-${slug}-waystone`, targetCoords: [0, -10.5], requiredCount: 1, currentCount: 0 },
        ],
      },
    ],
    interactables,
    enemies: [
      makeEnemy(`${slug}-e1`, 'stalker', `${params.name.split(' ')[0]} Skirmisher`, -13, -8, 66),
      makeEnemy(`${slug}-e2`, 'shardcaster', 'Meridian Prism-Caster', 14, -7, 62),
      makeEnemy(`${slug}-e3`, 'colossus', 'Frontier Basalt Warden', 20, 15, 185),
      makeEnemy(`${slug}-e4`, 'stalker', 'Outer Ridge Stalker', -46, -18, 70),
      makeEnemy(`${slug}-e5`, 'shardcaster', 'Monolith Arc-Weaver', 48, 8, 66),
    ],
  };
}
