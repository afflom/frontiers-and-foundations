import {
  type DungeonArchitecturalStyle,
  type FrontiersRealmSpec,
} from './realmModelSchema';
import {
  ECOSYSTEM_PHENOMENA,
  registerVerdantCatalogExtension,
  type EcosystemPhenomenonSpec,
  type FaunaKitId,
  type StructurePrimitive,
} from './verdantEcosystemCatalog';
import { createSeededRng } from './verdantCharacterSynthesizer';
import {
  dungeonTopologyHeightAt,
  getDungeonTopologyCharter,
  type DungeonHazardZone,
  type DungeonRectZone,
  type DungeonTopologyId,
} from './verdantUnifiedCharter';

export type DungeonChasmVisual =
  | 'dark-water'
  | 'cistern-moss'
  | 'magma-core'
  | 'abyssal-coral'
  | 'amber-mist'
  | 'glacial-rift';

export interface SynthesizedDungeonPlan {
  dungeonSlug: string;
  style: DungeonArchitecturalStyle;
  topologyId: DungeonTopologyId;
  styleTitle: string;
  faunaKit: FaunaKitId;
  phenomenon: EcosystemPhenomenonSpec;
  chasmVisual: DungeonChasmVisual;
  lanternRgb: [number, number, number];
  accentRgb: [number, number, number];
  bannerRgb: [number, number, number];
  walkableZones: DungeonRectZone[];
  hazardZones: DungeonHazardZone[];
  structures: StructurePrimitive[];
  thermalVents: Array<[number, number]>;
  catalogExtensionIds: string[];
}

export const DUNGEON_STYLE_TITLES: Record<DungeonArchitecturalStyle, string> = {
  'catacomb-vault': 'Twin-Span Basalt Reliquary',
  'sunken-cistern': 'Spiral Sluice Rotunda & Flooded Ring',
  'geothermal-depths': 'Crucible Caldera Island & Quench Wings',
  'abyssal-grotto': 'S-Curve Coral Atolls & Shipwreck Shoals',
  'echo-tomb': 'Stepped Sandstone Ziggurat & Wind-Harp Galleries',
  'glacial-crypt': 'Bifurcated Frostglass Cloister & Crevasse Rift',
};

// Register all 6 bespoke 3D Dungeon topology & architectural kits into the live extensible Verdant Catalog
const DUNGEON_CATALOG_KITS: Array<{
  style: DungeonArchitecturalStyle;
  description: string;
  theme: FrontiersRealmSpec['theme'];
  tags: string[];
}> = [
  {
    style: 'catacomb-vault',
    description: 'Dual parallel abyss bridges, twin ossuary reliquary wings & basalt amphitheater dais',
    theme: 'citadel-highlands',
    tags: ['dungeon', 'twin-span-reliquary', 'reliquary'],
  },
  {
    style: 'sunken-cistern',
    description: 'Four-way radial aqueduct causeways around a flooded circular cistern moat & central Lotus Hub',
    theme: 'sunken-aqueducts',
    tags: ['dungeon', 'spiral-sluice-rotunda', 'aqueduct'],
  },
  {
    style: 'geothermal-depths',
    description: 'Suspended central octagonal Forge-Anvil Island over a magma lake with flanking iron Quench Bastions',
    theme: 'obsidian-crucible',
    tags: ['dungeon', 'crucible-island-ring', 'foundry'],
  },
  {
    style: 'abyssal-grotto',
    description: 'Meandering S-curve coral headland stepping-stones, shipwreck cove & bioluminescent reef sanctuary',
    theme: 'pelagic-spires',
    tags: ['dungeon', 'tidal-atoll-stepping-stones', 'coral'],
  },
  {
    style: 'echo-tomb',
    description: 'Dry 3-tier ascending sandstone ziggurat with central acoustic baffle wall & amber-sand resonance well',
    theme: 'amber-steppe',
    tags: ['dungeon', 'stepped-ziggurat-labyrinth', 'acoustic'],
  },
  {
    style: 'glacial-crypt',
    description: 'Twin frostglass nave cloisters split by a central N-S frozen crevasse & joined by a mirror-ice cross span',
    theme: 'glacial-spire',
    tags: ['dungeon', 'bifurcated-prism-cloister', 'crystal'],
  },
];

for (const kit of DUNGEON_CATALOG_KITS) {
  registerVerdantCatalogExtension({
    id: `verdant:dungeon:${kit.style}`,
    category: 'layout',
    title: DUNGEON_STYLE_TITLES[kit.style],
    description: kit.description,
    themeAffinity: [kit.theme],
    sourceStream: 'verdant-ecosystem-catalog',
    tags: kit.tags,
  });
}

const DUNGEON_PLAN_CACHE = new Map<string, SynthesizedDungeonPlan>();

function addOuterEnclosureAndPortals(
  s: StructurePrimitive[],
  style: DungeonArchitecturalStyle,
  lanternRgb: [number, number, number],
  wallMat: StructurePrimitive['material'] = 'stone',
): void {
  const charter = getDungeonTopologyCharter(style);
  // Outer cavern/vault perimeter walls enclosing [-22..22] x [-38..35]
  s.push(
    { id: 'dg-wall-s', kind: 'box', material: wallMat, x: 0, yOffset: 8.0, useAbsoluteY: true, z: 35.0, sx: 47.0, sy: 18.0, sz: 3.2, collider: 'box' },
    { id: 'dg-wall-n', kind: 'box', material: wallMat, x: 0, yOffset: 8.6, useAbsoluteY: true, z: -38.0, sx: 47.0, sy: 19.2, sz: 3.4, collider: 'box' },
    { id: 'dg-wall-w', kind: 'box', material: wallMat, x: -22.5, yOffset: 8.2, useAbsoluteY: true, z: -1.5, sx: 3.2, sy: 18.4, sz: 76.0, collider: 'box' },
    { id: 'dg-wall-e', kind: 'box', material: wallMat, x: 22.5, yOffset: 8.2, useAbsoluteY: true, z: -1.5, sx: 3.2, sy: 18.4, sz: 76.0, collider: 'box' },
  );

  // Sculpted Ascend Portal Arches at Entry & Boss Sanctum
  const portals: Array<[[number, number], string]> = [
    [charter.ascendEntryPosition, 'entry'],
    [charter.ascendBossPosition, 'sanctum'],
  ];
  for (const [[px, pz], tag] of portals) {
    const py = dungeonTopologyHeightAt(style, px, pz);
    s.push(
      { id: `dg-portal-w-${tag}`, kind: 'box', material: wallMat, x: px - 2.5, yOffset: py + 2.8, useAbsoluteY: true, z: pz, sx: 1.35, sy: 5.6, sz: 1.55, collider: 'box' },
      { id: `dg-portal-e-${tag}`, kind: 'box', material: wallMat, x: px + 2.5, yOffset: py + 2.8, useAbsoluteY: true, z: pz, sx: 1.35, sy: 5.6, sz: 1.55, collider: 'box' },
      { id: `dg-portal-top-${tag}`, kind: 'box', material: wallMat, x: px, yOffset: py + 5.9, useAbsoluteY: true, z: pz, sx: 6.8, sy: 1.3, sz: 1.8, collider: 'none' },
      { id: `dg-portal-gem-${tag}`, kind: 'cone', material: 'accent', x: px, yOffset: py + 6.55, useAbsoluteY: true, z: pz, sx: 0.78, sy: 1.35, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
    );
  }
}

function addBridgeSlab(
  s: StructurePrimitive[],
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  deckY: number,
  deckMat: StructurePrimitive['material'],
  railMat: StructurePrimitive['material'],
  lanternRgb: [number, number, number],
  railAxis: 'ns' | 'ew' | 'none',
): void {
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const sx = maxX - minX;
  const sz = maxZ - minZ;
  s.push({
    id: `${id}-deck`,
    kind: 'box',
    material: deckMat,
    x: cx,
    yOffset: deckY - 0.24,
    useAbsoluteY: true,
    z: cz,
    sx,
    sy: 0.48,
    sz,
    collider: 'none',
  });
  // Support pier reaching down into chasm
  s.push({
    id: `${id}-pier`,
    kind: 'box',
    material: railMat,
    x: cx,
    yOffset: deckY - 3.3,
    useAbsoluteY: true,
    z: cz,
    sx: Math.min(sx * 0.65, 3.4),
    sy: 5.8,
    sz: Math.min(sz * 0.45, 2.6),
    collider: 'none',
  });
  if (railAxis === 'ns') {
    for (const side of [-1, 1]) {
      const rx = side < 0 ? minX + 0.18 : maxX - 0.18;
      s.push({
        id: `${id}-rail-${side < 0 ? 'w' : 'e'}`,
        kind: 'box',
        material: railMat,
        x: rx,
        yOffset: deckY + 0.36,
        useAbsoluteY: true,
        z: cz,
        sx: 0.32,
        sy: 0.72,
        sz: Math.max(1.0, sz - 0.8),
        collider: 'none',
      });
      s.push({
        id: `${id}-lamp-${side < 0 ? 'w' : 'e'}`,
        kind: 'cone',
        material: 'accent',
        x: rx,
        yOffset: deckY + 0.95,
        useAbsoluteY: true,
        z: cz,
        sx: 0.3,
        sy: 0.65,
        sz: 0,
        segs: 6,
        rgb: lanternRgb,
        collider: 'none',
      });
    }
  } else if (railAxis === 'ew') {
    for (const side of [-1, 1]) {
      const rz = side < 0 ? minZ + 0.18 : maxZ - 0.18;
      s.push({
        id: `${id}-rail-${side < 0 ? 'n' : 's'}`,
        kind: 'box',
        material: railMat,
        x: cx,
        yOffset: deckY + 0.36,
        useAbsoluteY: true,
        z: rz,
        sx: Math.max(1.0, sx - 0.8),
        sy: 0.72,
        sz: 0.32,
        collider: 'none',
      });
    }
  }
}

/**
 * Synthesizes one of 6 genuinely distinct, floorplan-bespoke 3D Dungeon Delve architectures
 * driven directly by `DUNGEON_TOPOLOGY_CHARTERS` in `verdantUnifiedCharter.ts`.
 */
export function synthesizeDungeonEcosystem(spec: FrontiersRealmSpec): SynthesizedDungeonPlan {
  const style: DungeonArchitecturalStyle = spec.dungeonStyle ?? 'catacomb-vault';
  const cacheKey = `${spec.slug}:${style}:${spec.seed}`;
  const cached = DUNGEON_PLAN_CACHE.get(cacheKey);
  if (cached) return cached;

  const charter = getDungeonTopologyCharter(style);
  const s: StructurePrimitive[] = [];
  const thermalVents: Array<[number, number]> = charter.thermalVents.map((v) => [v[0], v[1]]);
  const bossY = dungeonTopologyHeightAt(style, charter.bossPosition[0], charter.bossPosition[1]);
  const rng = createSeededRng(spec.seed ^ 0x5c31);

  let faunaKit: FaunaKitId = 'highland-ironclad';
  let phenomenon: EcosystemPhenomenonSpec = ECOSYSTEM_PHENOMENA['meridian-resonance'];
  let chasmVisual: DungeonChasmVisual = 'dark-water';
  let lanternRgb: [number, number, number] = [0.94, 0.72, 0.30];
  let accentRgb: [number, number, number] = [0.34, 0.38, 0.44];
  let bannerRgb: [number, number, number] = [0.68, 0.22, 0.18];

  // ===========================================================================
  // 1. SUNKEN-CISTERN -> Spiral Sluice Rotunda (Central Island + 4 Radial Causeways)
  // ===========================================================================
  if (style === 'sunken-cistern') {
    faunaKit = 'verdant-mycelial';
    phenomenon = ECOSYSTEM_PHENOMENA['vital-spore-bloom'];
    chasmVisual = 'cistern-moss';
    lanternRgb = [0.32, 0.94, 0.62];
    accentRgb = [0.22, 0.48, 0.34];
    bannerRgb = [0.18, 0.56, 0.40];

    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // Four radial timber-and-stone aqueduct bridges converging on the central Lotus Sluice Hub
    addBridgeSlab(s, 'cis-br-s', -3.0, 3.0, 5.2, 16.2, 1.12, 'timber', 'stone', lanternRgb, 'ns');
    addBridgeSlab(s, 'cis-br-n', -3.2, 3.2, -18.0, -7.0, 1.25, 'timber', 'stone', lanternRgb, 'ns');
    addBridgeSlab(s, 'cis-br-w', -15.2, -6.4, -3.8, 1.8, 1.12, 'timber', 'stone', lanternRgb, 'ew');
    addBridgeSlab(s, 'cis-br-e', 6.4, 15.2, -3.8, 1.8, 1.12, 'timber', 'stone', lanternRgb, 'ew');

    // Central Octagonal Lotus Sluice Hub Island & Aqueduct Water-Trough Ring Canopy
    s.push(
      { id: 'cis-hub-base', kind: 'cylinder', material: 'stone', x: 0, yOffset: -1.8, useAbsoluteY: true, z: -1.0, sx: 7.4, sy: 3.1, sz: 7.2, segs: 12, collider: 'none' },
      { id: 'cis-hub-fountain', kind: 'cylinder', material: 'accent', x: 0, yOffset: 1.25, useAbsoluteY: true, z: -1.0, sx: 1.75, sy: 1.1, sz: 1.5, segs: 10, rgb: accentRgb, collider: 'circle', colliderRadius: 1.65 },
      { id: 'cis-hub-spire', kind: 'cone', material: 'accent', x: 0, yOffset: 2.35, useAbsoluteY: true, z: -1.0, sx: 1.1, sy: 2.6, sz: 0, segs: 8, rgb: lanternRgb, collider: 'none' },
    );

    // Ring of 8 towering Roman aqueduct columns encircling the central flooded moat
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8 + Math.PI / 8;
      const cx = Math.cos(ang) * 14.8;
      const cz = -1.0 + Math.sin(ang) * 14.8;
      s.push(
        { id: `cis-ring-col-${i}`, kind: 'cylinder', material: 'stone', x: cx, yOffset: -1.8, useAbsoluteY: true, z: cz, sx: 1.05, sy: 15.5, sz: 0.92, segs: 10, collider: 'circle', colliderRadius: 1.1 },
        { id: `cis-ring-vine-${i}`, kind: 'cylinder', material: 'accent', x: cx * 0.92, yOffset: 6.2, useAbsoluteY: true, z: cz, sx: 0.28, sy: 6.4, sz: 0.14, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }
    // Overhead cross-aqueduct water troughs
    s.push(
      { id: 'cis-trough-ns', kind: 'box', material: 'stone', x: 0, yOffset: 14.4, useAbsoluteY: true, z: -1.0, sx: 3.2, sy: 1.6, sz: 34.0, collider: 'none' },
      { id: 'cis-trough-ew', kind: 'box', material: 'stone', x: 0, yOffset: 14.4, useAbsoluteY: true, z: -1.0, sx: 34.0, sy: 1.6, sz: 3.2, collider: 'none' },
      { id: 'cis-chandel', kind: 'cone', material: 'accent', x: 0, yOffset: 11.8, useAbsoluteY: true, z: -1.0, sx: 2.0, sy: 2.2, sz: 0, segs: 10, rgb: lanternRgb, collider: 'none' },
    );

    // Northern Drowned Weir Rotunda Boss Sanctum
    s.push(
      { id: 'cis-boss-ring', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -26.0, sx: 10.6, sy: 0.9, sz: 10.2, segs: 16, collider: 'none' },
      { id: 'cis-boss-center', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.32, useAbsoluteY: true, z: -26.0, sx: 7.4, sy: 0.24, sz: 7.2, segs: 16, collider: 'none' },
    );
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + (i / 7) * Math.PI;
      const mx = Math.cos(ang) * 10.4;
      const mz = -26.0 + Math.sin(ang) * 8.6;
      s.push(
        { id: `cis-boss-p-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.95, sy: 8.8, sz: 0.78, segs: 10, collider: 'circle', colliderRadius: 1.0 },
        { id: `cis-boss-cap-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY + 8.8, useAbsoluteY: true, z: mz, sx: 1.9, sy: 0.65, sz: 0.9, segs: 8, rgb: [0.16, 0.64, 0.38], collider: 'none' },
      );
    }

    // Giant glowing fungal-lotus mushrooms rising inside the 4 moat quadrants
    for (let qi = 0; qi < charter.hazardZones.length; qi++) {
      const hz = charter.hazardZones[qi];
      for (let m = 0; m < 4; m++) {
        const fx = hz.minX + 1.6 + rng() * Math.max(1, hz.maxX - hz.minX - 3.2);
        const fz = hz.minZ + 1.6 + rng() * Math.max(1, hz.maxZ - hz.minZ - 3.2);
        const fh = 2.6 + rng() * 3.8;
        s.push(
          { id: `cis-fung-s-${qi}-${m}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: hz.bedY, useAbsoluteY: true, z: fz, sx: 0.5, sy: fh, sz: 0.34, segs: 7, rgb: [0.44, 0.56, 0.42], collider: 'none' },
          { id: `cis-fung-c-${qi}-${m}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: hz.bedY + fh, useAbsoluteY: true, z: fz, sx: 1.9, sy: 0.55, sz: 0.75, segs: 9, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }
  // ===========================================================================
  // 2. GEOTHERMAL-DEPTHS -> Crucible Island Ring (Central Forge Island + Quench Wings)
  // ===========================================================================
  else if (style === 'geothermal-depths') {
    faunaKit = 'pyroclastic-forge';
    phenomenon = ECOSYSTEM_PHENOMENA['thermal-updraft'];
    chasmVisual = 'magma-core';
    lanternRgb = [0.98, 0.42, 0.10];
    accentRgb = [0.22, 0.14, 0.14];
    bannerRgb = [0.88, 0.28, 0.10];

    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // Forged-iron chain bridges linking Entry -> Central Anvil Island -> Quench Wings -> Blast Furnace Dais
    addBridgeSlab(s, 'geo-br-s', -2.9, 2.9, 7.6, 17.4, 1.2, 'stone', 'stone', lanternRgb, 'ns');
    addBridgeSlab(s, 'geo-br-n', -3.2, 3.2, -16.8, -6.2, 1.65, 'stone', 'stone', lanternRgb, 'ns');
    addBridgeSlab(s, 'geo-br-w', -13.8, -7.2, -2.4, 3.0, 1.35, 'stone', 'stone', lanternRgb, 'ew');
    addBridgeSlab(s, 'geo-br-e', 7.2, 13.8, -2.4, 3.0, 1.35, 'stone', 'stone', lanternRgb, 'ew');

    // Central Octagonal Forge-Anvil Island Pedestal & Overhead Suspended Molten Crucible Cauldron
    s.push(
      { id: 'geo-island-core', kind: 'cylinder', material: 'stone', x: 0, yOffset: -2.2, useAbsoluteY: true, z: 0.5, sx: 8.2, sy: 3.55, sz: 7.8, segs: 8, collider: 'none' },
      { id: 'geo-island-trim', kind: 'cylinder', material: 'accent', x: 0, yOffset: 1.32, useAbsoluteY: true, z: 0.5, sx: 7.6, sy: 0.16, sz: 7.4, segs: 8, rgb: lanternRgb, collider: 'none' },
      // Overhead diagonal slag-chain gantry crossing the entire magma lake
      { id: 'geo-gantry-ew', kind: 'box', material: 'stone', x: 0, yOffset: 15.0, useAbsoluteY: true, z: 0.5, sx: 41.0, sy: 1.8, sz: 2.0, collider: 'none' },
      { id: 'geo-gantry-ns', kind: 'box', material: 'stone', x: 0, yOffset: 15.0, useAbsoluteY: true, z: -6.0, sx: 2.0, sy: 1.8, sz: 46.0, collider: 'none' },
      { id: 'geo-caul-chain', kind: 'cylinder', material: 'accent', x: 0, yOffset: 10.6, useAbsoluteY: true, z: 0.5, sx: 0.35, sy: 4.5, sz: 0.35, segs: 6, rgb: [0.16, 0.14, 0.15], collider: 'none' },
      { id: 'geo-caul-pot', kind: 'cylinder', material: 'accent', x: 0, yOffset: 9.4, useAbsoluteY: true, z: 0.5, sx: 2.2, sy: 1.6, sz: 1.5, segs: 8, rgb: lanternRgb, collider: 'none' },
    );

    // Four Corner Furnace Smokestack Pylons framing the central Anvil Island
    for (const [px, pz, tag] of [
      [-6.2, -5.0, 'nw'],
      [6.2, -5.0, 'ne'],
      [-6.2, 6.2, 'sw'],
      [6.2, 6.2, 'se'],
    ] as Array<[number, number, string]>) {
      s.push(
        { id: `geo-isl-pyl-${tag}`, kind: 'box', material: 'stone', x: px, yOffset: 7.6, useAbsoluteY: true, z: pz, sx: 1.6, sy: 14.5, sz: 1.6, collider: 'box' },
        { id: `geo-isl-flm-${tag}`, kind: 'cone', material: 'accent', x: px, yOffset: 15.0, useAbsoluteY: true, z: pz, sx: 0.9, sy: 2.2, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
      );
    }

    // West & East Flanking Quench-Valve Bastion Stacks
    for (const side of [-1, 1]) {
      const tag = side < 0 ? 'w' : 'e';
      s.push(
        { id: `geo-qstack-${tag}-a`, kind: 'cylinder', material: 'stone', x: side * 19.2, yOffset: 1.5, useAbsoluteY: true, z: 5.5, sx: 1.35, sy: 12.2, sz: 0.78, segs: 6, collider: 'circle', colliderRadius: 1.2 },
        { id: `geo-qstack-${tag}-b`, kind: 'cylinder', material: 'stone', x: side * 19.2, yOffset: 1.5, useAbsoluteY: true, z: -5.5, sx: 1.35, sy: 12.2, sz: 0.78, segs: 6, collider: 'circle', colliderRadius: 1.2 },
        { id: `geo-qflame-${tag}-a`, kind: 'cone', material: 'accent', x: side * 19.2, yOffset: 13.7, useAbsoluteY: true, z: 5.5, sx: 0.85, sy: 2.4, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
        { id: `geo-qflame-${tag}-b`, kind: 'cone', material: 'accent', x: side * 19.2, yOffset: 13.7, useAbsoluteY: true, z: -5.5, sx: 0.85, sy: 2.4, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Northern Octagonal Blast-Furnace Boss Dais + 6 Roaring Forge Chimneys
    s.push(
      { id: 'geo-anvil-base', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -25.5, sx: 10.2, sy: 0.95, sz: 9.6, segs: 8, collider: 'none' },
      { id: 'geo-anvil-ring', kind: 'cylinder', material: 'accent', x: 0, yOffset: bossY + 0.42, useAbsoluteY: true, z: -25.5, sx: 8.0, sy: 0.18, sz: 7.8, segs: 8, rgb: lanternRgb, collider: 'none' },
    );
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 10.2;
      const mz = -25.5 + Math.sin(ang) * 8.6;
      s.push(
        { id: `geo-stack-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 1.35, sy: 9.8, sz: 0.68, segs: 6, collider: 'circle', colliderRadius: 1.25 },
        { id: `geo-flame-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 9.8, useAbsoluteY: true, z: mz, sx: 0.82, sy: 2.7, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Jagged obsidian magma spires thrusting from the lava caldera lake
    for (let qi = 0; qi < charter.hazardZones.length; qi++) {
      const hz = charter.hazardZones[qi];
      for (let m = 0; m < 3; m++) {
        const fx = hz.minX + 1.2 + rng() * Math.max(1, hz.maxX - hz.minX - 2.4);
        const fz = hz.minZ + 1.2 + rng() * Math.max(1, hz.maxZ - hz.minZ - 2.4);
        const fh = 3.2 + rng() * 5.2;
        s.push(
          { id: `geo-ob-${qi}-${m}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: hz.bedY, useAbsoluteY: true, z: fz, sx: 0.95, sy: fh, sz: 0.18, segs: 5, rgb: [0.14, 0.12, 0.14], collider: 'none' },
          { id: `geo-ob-tip-${qi}-${m}`, kind: 'cone', material: 'accent', x: fx, yOffset: hz.bedY + fh, useAbsoluteY: true, z: fz, sx: 0.34, sy: 1.4, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }
  // ===========================================================================
  // 3. ABYSSAL-GROTTO -> Tidal Atoll Stepping-Stones (Sweeping S-Curve Shipwreck & Coral Atolls)
  // ===========================================================================
  else if (style === 'abyssal-grotto') {
    faunaKit = 'pelagic-abyssal';
    phenomenon = ECOSYSTEM_PHENOMENA['tidal-current'];
    chasmVisual = 'abyssal-coral';
    lanternRgb = [0.24, 0.94, 0.96];
    accentRgb = [0.84, 0.44, 0.48];
    bannerRgb = [0.14, 0.54, 0.68];

    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // S-curve driftwood gangplanks connecting Cove -> West Shipwreck -> East Coral Atoll -> Reef Sanctuary
    addBridgeSlab(s, 'aby-plank-sw', -10.4, -4.2, 7.6, 18.0, 1.05, 'timber', 'timber', lanternRgb, 'ns');
    addBridgeSlab(s, 'aby-plank-mid', -3.2, 11.2, -6.2, 0.2, 1.05, 'timber', 'timber', lanternRgb, 'ew');
    addBridgeSlab(s, 'aby-plank-ne', 4.0, 10.0, -22.2, -15.2, 1.35, 'timber', 'timber', lanternRgb, 'ns');

    // Shipwreck Rib-Cage Hull Framing the Western Shipwreck Shoal Island!
    for (let ri = 0; ri < 5; ri++) {
      const rz = -2.0 + ri * 2.5;
      s.push(
        { id: `aby-hull-w-${ri}`, kind: 'cylinder', material: 'timber', x: -18.8, yOffset: 1.15, useAbsoluteY: true, z: rz, sx: 0.72, sy: 10.5, sz: 0.35, segs: 7, collider: 'circle', colliderRadius: 0.85 },
        { id: `aby-hull-beam-${ri}`, kind: 'box', material: 'timber', x: -12.0, yOffset: 11.8, useAbsoluteY: true, z: rz, sx: 14.0, sy: 0.9, sz: 0.8, collider: 'none' },
      );
    }
    // Giant Mast + Crows-Nest Lantern rising on the West Shipwreck Shoal
    s.push(
      { id: 'aby-mast', kind: 'cylinder', material: 'timber', x: -10.5, yOffset: 1.15, useAbsoluteY: true, z: 6.8, sx: 0.68, sy: 14.5, sz: 0.45, segs: 8, collider: 'circle', colliderRadius: 0.8 },
      { id: 'aby-mast-lamp', kind: 'cone', material: 'accent', x: -10.5, yOffset: 15.6, useAbsoluteY: true, z: 6.8, sx: 1.2, sy: 2.0, sz: 0, segs: 8, rgb: lanternRgb, collider: 'none' },
    );

    // Towering Branching Coral Archway Crown on the Eastern Tide-Bell Atoll
    for (let ci = 0; ci < 5; ci++) {
      const cz = -15.0 + ci * 2.6;
      const isRose = ci % 2 === 0;
      s.push(
        { id: `aby-ecol-${ci}`, kind: 'cylinder', material: 'accent', x: 18.8, yOffset: 1.25, useAbsoluteY: true, z: cz, sx: 0.9, sy: 9.8 + (ci % 2) * 2.0, sz: 1.3, segs: 7, rgb: isRose ? accentRgb : [0.18, 0.66, 0.74], collider: 'circle', colliderRadius: 1.0 },
        { id: `aby-etip-${ci}`, kind: 'cone', material: 'accent', x: 18.8, yOffset: 11.0 + (ci % 2) * 2.0, useAbsoluteY: true, z: cz, sx: 1.1, sy: 2.1, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Northern Bioluminescent Coral Atoll Boss Sanctum
    s.push(
      { id: 'aby-boss-atoll', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY - 0.45, useAbsoluteY: true, z: -27.5, sx: 10.6, sy: 0.85, sz: 10.0, segs: 14, collider: 'none' },
    );
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI + (i / 6) * Math.PI;
      const mx = Math.cos(ang) * 10.4;
      const mz = -27.5 + Math.sin(ang) * 8.4;
      s.push(
        { id: `aby-reef-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.88, sy: 7.8 + (i % 3) * 1.1, sz: 1.45, segs: 7, rgb: i % 2 === 0 ? accentRgb : [0.18, 0.68, 0.72], collider: 'circle', colliderRadius: 1.0 },
        { id: `aby-reef-glow-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 7.8 + (i % 3) * 1.1, useAbsoluteY: true, z: mz, sx: 1.15, sy: 2.0, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Bioluminescent coral pillars rising from the surrounding lagoon pools
    for (let qi = 0; qi < charter.hazardZones.length; qi++) {
      const hz = charter.hazardZones[qi];
      for (let m = 0; m < 4; m++) {
        const fx = hz.minX + 1.4 + rng() * Math.max(1, hz.maxX - hz.minX - 2.8);
        const fz = hz.minZ + 1.4 + rng() * Math.max(1, hz.maxZ - hz.minZ - 2.8);
        const fh = 3.0 + rng() * 5.0;
        s.push({
          id: `aby-chasm-c-${qi}-${m}`,
          kind: 'cylinder',
          material: 'accent',
          x: fx,
          yOffset: hz.bedY,
          useAbsoluteY: true,
          z: fz,
          sx: 0.65,
          sy: fh,
          sz: 1.15,
          segs: 6,
          rgb: (qi + m) % 3 === 0 ? accentRgb : lanternRgb,
          collider: 'none',
        });
      }
    }
  }
  // ===========================================================================
  // 4. ECHO-TOMB -> Stepped Ziggurat Labyrinth (Dry 3-Tier Ascending Pyramid + Acoustic Baffle Wall)
  // ===========================================================================
  else if (style === 'echo-tomb') {
    faunaKit = 'dune-sandstrider';
    phenomenon = ECOSYSTEM_PHENOMENA['desert-tailwind'];
    chasmVisual = 'amber-mist';
    lanternRgb = [0.98, 0.80, 0.24];
    accentRgb = [0.78, 0.56, 0.26];
    bannerRgb = [0.84, 0.44, 0.16];

    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // Monumental Central Acoustic Baffle Monolith Wall (z = 11.0) forcing travelers up the West or East Sandstone Ramps!
    s.push(
      { id: 'ech-baffle-wall', kind: 'box', material: 'stone', x: 0, yOffset: 6.2, useAbsoluteY: true, z: 10.5, sx: 13.8, sy: 11.4, sz: 3.4, collider: 'box' },
      { id: 'ech-baffle-crown', kind: 'box', material: 'stone', x: 0, yOffset: 12.6, useAbsoluteY: true, z: 10.5, sx: 9.8, sy: 1.6, sz: 2.6, collider: 'none' },
      { id: 'ech-baffle-sun', kind: 'cylinder', material: 'accent', x: 0, yOffset: 7.5, useAbsoluteY: true, z: 12.4, sx: 2.4, sy: 0.45, sz: 2.4, segs: 14, rgb: lanternRgb, collider: 'none' },
    );

    // Flanked Stepped Sandstone Ziggurat Terraces + Golden Bronze Wind-Harp Tuning Frames
    for (const side of [-1, 1]) {
      const tag = side < 0 ? 'w' : 'e';
      // Tier II Flanking Wind-Harp Galleries with giant vertical bronze harp strings
      for (let hi = 0; hi < 4; hi++) {
        const hz = -12.0 + hi * 4.8;
        s.push(
          { id: `ech-harp-p-${tag}-${hi}`, kind: 'cylinder', material: 'stone', x: side * 18.8, yOffset: 2.1, useAbsoluteY: true, z: hz, sx: 1.05, sy: 12.2, sz: 0.72, segs: 4, collider: 'circle', colliderRadius: 1.05 },
          { id: `ech-harp-str-${tag}-${hi}`, kind: 'cylinder', material: 'accent', x: side * 17.4, yOffset: 4.5, useAbsoluteY: true, z: hz, sx: 0.14, sy: 7.4, sz: 0.14, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Inner colonnade flanking the central Amber Sand Resonance Well
      for (const wz of [-8.4, 1.8]) {
        s.push(
          { id: `ech-well-ob-${tag}-${wz}`, kind: 'cylinder', material: 'stone', x: side * 6.0, yOffset: 2.1, useAbsoluteY: true, z: wz, sx: 0.9, sy: 8.6, sz: 0.52, segs: 4, collider: 'circle', colliderRadius: 0.9 },
          { id: `ech-well-cap-${tag}-${wz}`, kind: 'cone', material: 'accent', x: side * 6.0, yOffset: 10.7, useAbsoluteY: true, z: wz, sx: 0.62, sy: 1.9, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
        );
      }
    }

    // Sunken Central Amber-Sand Resonance Monolith rising inside the pit
    s.push(
      { id: 'ech-well-mono', kind: 'cylinder', material: 'accent', x: 0, yOffset: -3.2, useAbsoluteY: true, z: -3.2, sx: 1.5, sy: 9.8, sz: 0.65, segs: 4, rgb: accentRgb, collider: 'none' },
      { id: 'ech-well-halo', kind: 'cone', material: 'accent', x: 0, yOffset: 6.6, useAbsoluteY: true, z: -3.2, sx: 0.9, sy: 2.6, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
    );

    // Tier III Elevated Solar Summit Ziggurat Altar + 5 Golden Obelisk Crown
    s.push(
      { id: 'ech-zig-1', kind: 'box', material: 'stone', x: 0, yOffset: bossY - 0.15, useAbsoluteY: true, z: -26.5, sx: 19.0, sy: 0.7, sz: 15.0, collider: 'none' },
      { id: 'ech-zig-2', kind: 'box', material: 'cobble', x: 0, yOffset: bossY + 0.3, useAbsoluteY: true, z: -26.5, sx: 14.0, sy: 0.35, sz: 11.2, collider: 'none' },
      { id: 'ech-summit-lintel', kind: 'box', material: 'stone', x: 0, yOffset: bossY + 13.5, useAbsoluteY: true, z: -20.0, sx: 26.0, sy: 1.6, sz: 2.2, collider: 'none' },
    );
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI + (i / 4) * Math.PI;
      const mx = Math.cos(ang) * 10.4;
      const mz = -26.5 + Math.sin(ang) * 8.4;
      s.push(
        { id: `ech-ob-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 1.15, sy: 9.8, sz: 0.58, segs: 4, collider: 'circle', colliderRadius: 1.1 },
        { id: `ech-cap-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 9.8, useAbsoluteY: true, z: mz, sx: 0.68, sy: 2.3, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
      );
    }
    // Flanking acoustic relief ribs & golden sand-brazier plinths along the sandstone gallery walls
    for (const [idx, rz] of [18.5, 4.5, -10.5, -18.0].entries()) {
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const ry = rz < -14 ? bossY : rz < 2 ? 1.8 : 1.0;
        s.push(
          { id: `ech-rib-${idx}-${tag}`, kind: 'box', material: 'stone', x: side * 20.6, yOffset: ry + 4.8, useAbsoluteY: true, z: rz, sx: 1.1, sy: 9.6, sz: 1.6, collider: 'none' },
          { id: `ech-urn-${idx}-${tag}`, kind: 'cone', material: 'accent', x: side * 19.8, yOffset: ry + 2.2, useAbsoluteY: true, z: rz, sx: 0.48, sy: 1.1, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }
  // ===========================================================================
  // 5. GLACIAL-CRYPT -> Bifurcated Prism Cloister (Central N-S Crevasse Splitting Twin Ice Cloisters)
  // ===========================================================================
  else if (style === 'glacial-crypt') {
    faunaKit = 'glacial-frostborn';
    phenomenon = ECOSYSTEM_PHENOMENA['aurora-clarity'];
    chasmVisual = 'glacial-rift';
    lanternRgb = [0.54, 0.92, 1.0];
    accentRgb = [0.46, 0.74, 0.92];
    bannerRgb = [0.22, 0.58, 0.88];

    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // Central East-West Mirror-Ice Cross Span bridging the massive N-S Frozen Crevasse Rift
    addBridgeSlab(s, 'gla-mirror-span', -6.6, 6.6, -2.5, 3.1, 1.35, 'cobble', 'stone', lanternRgb, 'ew');

    // Mirrored West & East Hexagonal Frostglass Nave Cloister Pillars flanking the N-S Crevasse
    const cloisterZs = [15.5, 9.0, 3.2, -2.8, -9.2, -15.5];
    for (let ci = 0; ci < cloisterZs.length; ci++) {
      const cz = cloisterZs[ci];
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        // Outer cloister cathedral pillar
        s.push(
          { id: `gla-out-${ci}-${tag}`, kind: 'cylinder', material: 'accent', x: side * 18.0, yOffset: 1.2, useAbsoluteY: true, z: cz, sx: 1.12, sy: 13.8, sz: 0.72, segs: 6, rgb: accentRgb, collider: 'circle', colliderRadius: 1.1 },
          { id: `gla-sh-${ci}-${tag}`, kind: 'cone', material: 'accent', x: side * 16.8, yOffset: 4.0, useAbsoluteY: true, z: cz, sx: 0.56, sy: 4.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
          // Inner rift-edge crystal balustrade obelisk (skipping mirror-span crossing z: -2.8..3.2)
          ...(Math.abs(cz - 0.3) > 3.5
            ? [
                { id: `gla-in-${ci}-${tag}`, kind: 'cylinder' as const, material: 'accent' as const, x: side * 6.5, yOffset: 1.2, useAbsoluteY: true, z: cz, sx: 0.65, sy: 9.4, sz: 0.32, segs: 6, rgb: accentRgb, collider: 'circle' as const, colliderRadius: 0.72 },
                { id: `gla-in-tip-${ci}-${tag}`, kind: 'cone' as const, material: 'accent' as const, x: side * 6.5, yOffset: 10.6, useAbsoluteY: true, z: cz, sx: 0.38, sy: 1.9, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' as const },
              ]
            : []),
        );
      }
      // Pointed cathedral ice-rib arch spanning the entire bifurcated nave + suspended aurora chandelier
      s.push(
        { id: `gla-rib-${ci}`, kind: 'box', material: 'accent', x: 0, yOffset: 15.2, useAbsoluteY: true, z: cz, sx: 38.0, sy: 1.1, sz: 1.1, rgb: accentRgb, collider: 'none' },
        { id: `gla-chand-${ci}`, kind: 'cone', material: 'accent', x: 0, yOffset: 11.8, useAbsoluteY: true, z: cz, sx: 1.6, sy: 3.4, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Northern Hexagonal Aurora Choir Octagon Boss Sanctum
    s.push(
      { id: 'gla-boss-hex', kind: 'cylinder', material: 'accent', x: 0, yOffset: bossY - 0.45, useAbsoluteY: true, z: -26.0, sx: 10.8, sy: 0.85, sz: 10.2, segs: 6, rgb: accentRgb, collider: 'none' },
      { id: 'gla-boss-core', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -26.0, sx: 7.8, sy: 0.22, sz: 7.6, segs: 6, collider: 'none' },
    );
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + (i / 7) * Math.PI;
      const mx = Math.cos(ang) * 10.4;
      const mz = -26.0 + Math.sin(ang) * 8.6;
      s.push(
        { id: `gla-spire-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.88, sy: 8.8 + (i % 2) * 2.2, sz: 0.35, segs: 6, rgb: accentRgb, collider: 'circle', colliderRadius: 1.0 },
        { id: `gla-tip-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 8.8 + (i % 2) * 2.2, useAbsoluteY: true, z: mz, sx: 0.46, sy: 2.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Jagged blue-ice prism shards bursting from the central N-S Frozen Crevasse Rift
    for (let qi = 0; qi < charter.hazardZones.length; qi++) {
      const hz = charter.hazardZones[qi];
      for (let m = 0; m < 10; m++) {
        const fx = hz.minX + 1.1 + rng() * Math.max(1, hz.maxX - hz.minX - 2.2);
        const fz = hz.minZ + 1.1 + rng() * Math.max(1, hz.maxZ - hz.minZ - 2.2);
        const fh = 3.2 + rng() * 5.8;
        s.push(
          { id: `gla-ice-${qi}-${m}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: hz.bedY, useAbsoluteY: true, z: fz, sx: 0.72, sy: fh, sz: 0.22, segs: 6, rgb: accentRgb, collider: 'none' },
          { id: `gla-ice-t-${qi}-${m}`, kind: 'cone', material: 'accent', x: fx, yOffset: hz.bedY + fh, useAbsoluteY: true, z: fz, sx: 0.28, sy: 1.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }
  // ===========================================================================
  // 6. CATACOMB-VAULT -> Twin-Span Reliquary (Dual Parallel Abyss Bridges + Ossuary Wings)
  // ===========================================================================
  else {
    addOuterEnclosureAndPortals(s, style, lanternRgb, 'stone');

    // Twin Parallel Stone Viaduct Spans crossing the southern abyss (x = -4.6 and x = +4.6)
    addBridgeSlab(s, 'cat-span-w', -7.2, -2.0, 4.2, 18.0, 1.15, 'cobble', 'stone', lanternRgb, 'ns');
    addBridgeSlab(s, 'cat-span-e', 2.0, 7.2, 4.2, 18.0, 1.15, 'cobble', 'stone', lanternRgb, 'ns');

    // Central Chasm Monolith Pillar rising from the split between the twin bridges
    s.push(
      { id: 'cat-center-mono', kind: 'cylinder', material: 'stone', x: 0, yOffset: -4.6, useAbsoluteY: true, z: 11.0, sx: 1.5, sy: 15.8, sz: 1.1, segs: 8, collider: 'none' },
      { id: 'cat-center-bra', kind: 'cone', material: 'accent', x: 0, yOffset: 11.2, useAbsoluteY: true, z: 11.0, sx: 1.2, sy: 2.2, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
    );

    // Vaulted Octagonal Sarcophagus Colonnade & Ossuary Wing Banners
    const ribZs = [26.0, 18.2, 3.5, -4.5, -12.5, -20.0, -28.0];
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = dungeonTopologyHeightAt(style, -10.5, rz);
      const colX = rz > 16 || rz < -14 ? 11.4 : 13.8;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          { id: `cat-plinth-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx, yOffset: fy + 0.55, useAbsoluteY: true, z: rz, sx: 2.1, sy: 1.1, sz: 2.1, collider: 'box' },
          { id: `cat-col-${ri}-${tag}`, kind: 'cylinder', material: 'stone', x: cx, yOffset: fy + 1.1, useAbsoluteY: true, z: rz, sx: 0.88, sy: 12.6, sz: 0.78, segs: 8, collider: 'none' },
          { id: `cat-ban-${ri}-${tag}`, kind: 'box', material: 'accent', x: cx - side * 0.95, yOffset: fy + 6.4, useAbsoluteY: true, z: rz, sx: 0.14, sy: 3.9, sz: 1.25, rgb: bannerRgb, collider: 'none' },
          { id: `cat-bar-${ri}-${tag}`, kind: 'box', material: 'accent', x: cx - side * 0.92, yOffset: fy + 8.35, useAbsoluteY: true, z: rz, sx: 0.24, sy: 0.24, sz: 1.65, rgb: lanternRgb, collider: 'none' },
        );
      }
      s.push(
        { id: `cat-arch-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 14.8, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.6, sy: 1.6, sz: 1.45, collider: 'none' },
        { id: `cat-key-${ri}`, kind: 'box', material: 'accent', x: 0, yOffset: fy + 13.8, useAbsoluteY: true, z: rz, sx: 1.5, sy: 0.75, sz: 1.6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Reliquary Amphitheater Boss Dais + 6 Basalt Crown Pillars
    s.push(
      { id: 'cat-boss-dais', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -25.5, sx: 9.8, sy: 0.85, sz: 9.4, segs: 12, collider: 'none' },
      { id: 'cat-boss-floor', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -25.5, sx: 7.8, sy: 0.22, sz: 7.6, segs: 12, collider: 'none' },
    );
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 10.0;
      const mz = -25.5 + Math.sin(ang) * 8.4;
      s.push(
        { id: `cat-mon-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.95, sy: 8.0, sz: 0.72, segs: 8, collider: 'circle', colliderRadius: 1.0 },
        { id: `cat-mon-cap-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 8.0, useAbsoluteY: true, z: mz, sx: 0.82, sy: 1.6, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Basalt chasm stalagmites in West & East pits
    for (let qi = 0; qi < charter.hazardZones.length; qi++) {
      const hz = charter.hazardZones[qi];
      if (hz.id === 'cat-chasm-c') continue;
      for (let m = 0; m < 6; m++) {
        const fx = hz.minX + 1.2 + rng() * Math.max(1, hz.maxX - hz.minX - 2.4);
        const fz = hz.minZ + 1.2 + rng() * Math.max(1, hz.maxZ - hz.minZ - 2.4);
        const fh = 3.2 + rng() * 4.5;
        s.push(
          { id: `cat-chasm-${qi}-${m}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: hz.bedY, useAbsoluteY: true, z: fz, sx: 0.75, sy: fh, sz: 0.25, segs: 6, rgb: accentRgb, collider: 'none' },
          { id: `cat-chasm-t-${qi}-${m}`, kind: 'cone', material: 'accent', x: fx, yOffset: hz.bedY + fh, useAbsoluteY: true, z: fz, sx: 0.3, sy: 1.1, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }

  const plan: SynthesizedDungeonPlan = {
    dungeonSlug: spec.slug,
    style,
    topologyId: charter.topologyId,
    styleTitle: DUNGEON_STYLE_TITLES[style],
    faunaKit,
    phenomenon,
    chasmVisual,
    lanternRgb,
    accentRgb,
    bannerRgb,
    walkableZones: charter.walkableZones,
    hazardZones: charter.hazardZones,
    structures: s,
    thermalVents,
    catalogExtensionIds: [`verdant:dungeon:${style}`, `verdant:topology:${charter.topologyId}`, `verdant:fauna:${faunaKit}`],
  };

  DUNGEON_PLAN_CACHE.set(cacheKey, plan);
  return plan;
}
