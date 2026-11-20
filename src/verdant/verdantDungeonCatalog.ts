import {
  realmTerrainHeightAt,
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
  styleTitle: string;
  faunaKit: FaunaKitId;
  phenomenon: EcosystemPhenomenonSpec;
  chasmVisual: DungeonChasmVisual;
  lanternRgb: [number, number, number];
  accentRgb: [number, number, number];
  bannerRgb: [number, number, number];
  structures: StructurePrimitive[];
  thermalVents: Array<[number, number]>;
  catalogExtensionIds: string[];
}

export const DUNGEON_STYLE_TITLES: Record<DungeonArchitecturalStyle, string> = {
  'catacomb-vault': 'Vaulted Sarcophagus Catacomb',
  'sunken-cistern': 'Flooded Roman Siphon Cistern',
  'geothermal-depths': 'Crucible Core Chain-Forge',
  'abyssal-grotto': 'Bioluminescent Coral Sea-Grotto',
  'echo-tomb': 'Sandstone Sun-Pyramid & Wind-Harp Tomb',
  'glacial-crypt': 'Frostglass Prism Choir Crypt',
};

// Register all 6 bespoke 3D Dungeon architectural kits into the live extensible Verdant Catalog
const DUNGEON_CATALOG_KITS: Array<{
  style: DungeonArchitecturalStyle;
  description: string;
  theme: FrontiersRealmSpec['theme'];
  tags: string[];
}> = [
  {
    style: 'catacomb-vault',
    description: 'Octagonal sarcophagus colonnade, tiered bronze reliquary dais & ossuary wall alcoves',
    theme: 'citadel-highlands',
    tags: ['dungeon', 'catacomb', 'reliquary'],
  },
  {
    style: 'sunken-cistern',
    description: 'Tiered Roman aqueduct cistern arches, subterranean fungal-lotus stalactites & sluice channels',
    theme: 'sunken-aqueducts',
    tags: ['dungeon', 'cistern', 'aqueduct'],
  },
  {
    style: 'geothermal-depths',
    description: 'Suspended iron-grate foundry bridge, twin roaring blast furnaces, active floor magma vents & obsidian stalactites',
    theme: 'obsidian-crucible',
    tags: ['dungeon', 'volcanic', 'foundry'],
  },
  {
    style: 'abyssal-grotto',
    description: 'Organic sea-cavern rib-arches, weathered shipwreck-timber bridge & giant bioluminescent coral spires',
    theme: 'pelagic-spires',
    tags: ['dungeon', 'grotto', 'coral'],
  },
  {
    style: 'echo-tomb',
    description: 'Stepped ochre sandstone pyramid gallery, colossal solar-disk pillars & resonant bronze wind-harp tuning frames',
    theme: 'amber-steppe',
    tags: ['dungeon', 'pyramid', 'acoustic'],
  },
  {
    style: 'glacial-crypt',
    description: 'Hexagonal translucent frostglass cathedral ribs, suspended aurora chandeliers & crystalline mirror obelisks',
    theme: 'glacial-spire',
    tags: ['dungeon', 'glacial', 'crystal'],
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

function addBaseEnclosureAndPortals(
  s: StructurePrimitive[],
  spec: FrontiersRealmSpec,
  lanternRgb: [number, number, number],
  wallMat: StructurePrimitive['material'] = 'stone',
): void {
  // Perimeter Enclosure Walls (absolute Y so heights stay rock-solid across chasm & halls)
  s.push(
    { id: 'dg-wall-s', kind: 'box', material: wallMat, x: 0, yOffset: 7.5, useAbsoluteY: true, z: 34.5, sx: 46.0, sy: 17.0, sz: 3.2, collider: 'box' },
    { id: 'dg-wall-n', kind: 'box', material: wallMat, x: 0, yOffset: 8.2, useAbsoluteY: true, z: -38.5, sx: 46.0, sy: 18.5, sz: 3.4, collider: 'box' },
    { id: 'dg-wall-w', kind: 'box', material: wallMat, x: -22.5, yOffset: 7.8, useAbsoluteY: true, z: -2.0, sx: 3.2, sy: 17.5, sz: 76.0, collider: 'box' },
    { id: 'dg-wall-e', kind: 'box', material: wallMat, x: 22.5, yOffset: 7.8, useAbsoluteY: true, z: -2.0, sx: 3.2, sy: 17.5, sz: 76.0, collider: 'box' },
  );

  // Vestibule Narrowing Curtain Walls & Boss Wing Walls + East/West Alcove Frames (leaving z: -8..0 open!)
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'w' : 'e';
    s.push(
      { id: `dg-vest-wall-${tag}`, kind: 'box', material: wallMat, x: side * 15.5, yOffset: 7.0, useAbsoluteY: true, z: 26.0, sx: 11.0, sy: 15.5, sz: 16.0, collider: 'box' },
      { id: `dg-boss-wing-${tag}`, kind: 'box', material: wallMat, x: side * 16.5, yOffset: 7.5, useAbsoluteY: true, z: -25.5, sx: 9.0, sy: 16.5, sz: 25.0, collider: 'box' },
      { id: `dg-alcove-n-${tag}`, kind: 'box', material: wallMat, x: side * 12.2, yOffset: 4.8, useAbsoluteY: true, z: -9.2, sx: 2.2, sy: 9.6, sz: 2.2, collider: 'box' },
      { id: `dg-alcove-s-${tag}`, kind: 'box', material: wallMat, x: side * 12.2, yOffset: 4.8, useAbsoluteY: true, z: 1.2, sx: 2.2, sy: 9.6, sz: 2.2, collider: 'box' },
      { id: `dg-alcove-lintel-${tag}`, kind: 'box', material: wallMat, x: side * 12.2, yOffset: 9.8, useAbsoluteY: true, z: -4.0, sx: 2.4, sy: 2.2, sz: 12.6, collider: 'none' },
      { id: `dg-alcove-ped-${tag}`, kind: 'box', material: wallMat, x: side * 16.5, yOffset: 1.35, useAbsoluteY: true, z: -4.0, sx: 3.2, sy: 0.7, sz: 3.2, collider: 'none' },
    );
  }

  // Sculpted Ascend Portal Stone Arches at Entry (z = 30.8) & Boss Sanctum (z = -33.8)
  for (const [pz, py, tag] of [
    [30.8, 1.0, 'entry'],
    [-33.8, realmTerrainHeightAt(spec, 0, -33.8), 'sanctum'],
  ] as Array<[number, number, string]>) {
    s.push(
      { id: `dg-portal-w-${tag}`, kind: 'box', material: wallMat, x: -2.5, yOffset: py + 2.8, useAbsoluteY: true, z: pz, sx: 1.35, sy: 5.6, sz: 1.55, collider: 'box' },
      { id: `dg-portal-e-${tag}`, kind: 'box', material: wallMat, x: 2.5, yOffset: py + 2.8, useAbsoluteY: true, z: pz, sx: 1.35, sy: 5.6, sz: 1.55, collider: 'box' },
      { id: `dg-portal-top-${tag}`, kind: 'box', material: wallMat, x: 0, yOffset: py + 5.9, useAbsoluteY: true, z: pz, sx: 6.8, sy: 1.3, sz: 1.8, collider: 'none' },
      { id: `dg-portal-gem-${tag}`, kind: 'cone', material: 'accent', x: 0, yOffset: py + 6.55, useAbsoluteY: true, z: pz, sx: 0.75, sy: 1.3, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
    );
  }
}

function addBridgeDeck(
  s: StructurePrimitive[],
  deckY: number,
  deckMat: StructurePrimitive['material'],
  railMat: StructurePrimitive['material'],
  lanternRgb: [number, number, number],
  postKind: 'block' | 'timber' | 'prism' | 'brazier' | 'obelisk',
): void {
  for (let seg = 0; seg < 6; seg++) {
    const zs = 3.6 + seg * (14.8 / 6);
    const ze = zs + 14.8 / 6;
    s.push({
      id: `dg-bridge-deck-${seg}`,
      kind: 'box',
      material: deckMat,
      x: 0,
      yOffset: deckY - 0.25,
      useAbsoluteY: true,
      z: (zs + ze) * 0.5,
      sx: 5.4,
      sy: 0.52,
      sz: ze - zs + 0.05,
      collider: 'none',
    });
  }
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'w' : 'e';
    const px = side * 2.55;
    s.push({
      id: `dg-bridge-rail-${tag}`,
      kind: 'box',
      material: railMat,
      x: px,
      yOffset: deckY + 0.42,
      useAbsoluteY: true,
      z: 11.0,
      sx: postKind === 'timber' ? 0.28 : 0.38,
      sy: postKind === 'timber' ? 0.68 : 0.85,
      sz: 14.8,
      collider: 'box',
    });
    for (let bi = 0; bi < 4; bi++) {
      const bz = [4.2, 8.8, 13.4, 17.8][bi];
      if (postKind === 'prism') {
        s.push(
          { id: `dg-bpost-${tag}-${bi}`, kind: 'cylinder', material: 'accent', x: px, yOffset: deckY, useAbsoluteY: true, z: bz, sx: 0.42, sy: 2.35, sz: 0.22, segs: 6, rgb: [0.46, 0.78, 0.94], collider: 'none' },
          { id: `dg-blamp-${tag}-${bi}`, kind: 'cone', material: 'accent', x: px, yOffset: deckY + 2.35, useAbsoluteY: true, z: bz, sx: 0.24, sy: 0.78, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      } else if (postKind === 'brazier') {
        s.push(
          { id: `dg-bpost-${tag}-${bi}`, kind: 'cylinder', material: 'stone', x: px, yOffset: deckY, useAbsoluteY: true, z: bz, sx: 0.44, sy: 1.8, sz: 0.56, segs: 6, collider: 'none' },
          { id: `dg-blamp-${tag}-${bi}`, kind: 'cone', material: 'accent', x: px, yOffset: deckY + 1.82, useAbsoluteY: true, z: bz, sx: 0.46, sy: 0.95, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
        );
      } else if (postKind === 'obelisk') {
        s.push(
          { id: `dg-bpost-${tag}-${bi}`, kind: 'cylinder', material: 'stone', x: px, yOffset: deckY, useAbsoluteY: true, z: bz, sx: 0.44, sy: 2.4, sz: 0.24, segs: 4, collider: 'none' },
          { id: `dg-blamp-${tag}-${bi}`, kind: 'cone', material: 'accent', x: px, yOffset: deckY + 2.4, useAbsoluteY: true, z: bz, sx: 0.28, sy: 0.56, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
        );
      } else if (postKind === 'timber') {
        s.push(
          { id: `dg-bpost-${tag}-${bi}`, kind: 'cylinder', material: 'timber', x: px, yOffset: deckY - 0.6, useAbsoluteY: true, z: bz, sx: 0.26, sy: 2.6, sz: 0.22, segs: 7, collider: 'none' },
          { id: `dg-blamp-${tag}-${bi}`, kind: 'box', material: 'accent', x: px, yOffset: deckY + 2.1, useAbsoluteY: true, z: bz, sx: 0.34, sy: 0.42, sz: 0.34, rgb: lanternRgb, collider: 'none' },
        );
      } else {
        s.push(
          { id: `dg-bpost-${tag}-${bi}`, kind: 'box', material: railMat, x: px, yOffset: deckY + 0.88, useAbsoluteY: true, z: bz, sx: 0.68, sy: 1.75, sz: 0.68, collider: 'none' },
          { id: `dg-blamp-${tag}-${bi}`, kind: 'box', material: 'accent', x: px, yOffset: deckY + 1.9, useAbsoluteY: true, z: bz, sx: 0.36, sy: 0.38, sz: 0.36, rgb: lanternRgb, collider: 'none' },
        );
      }
    }
  }
  for (let pi = 0; pi < 3; pi++) {
    const pz = [5.2, 11.0, 16.8][pi];
    s.push({
      id: `dg-bpier-${pi}`,
      kind: 'box',
      material: railMat,
      x: 0,
      yOffset: -2.1,
      useAbsoluteY: true,
      z: pz,
      sx: 5.6,
      sy: 6.2,
      sz: 1.6,
      collider: 'none',
    });
  }
}

/**
 * Synthesizes a completely bespoke 3D Dungeon Delve architecture, chasm aesthetic,
 * fauna family, active thermal/hazard nodes, and gameplay phenomenon from the
 * extensible Verdant Dungeon Catalog.
 */
export function synthesizeDungeonEcosystem(spec: FrontiersRealmSpec): SynthesizedDungeonPlan {
  const style: DungeonArchitecturalStyle = spec.dungeonStyle ?? 'catacomb-vault';
  const cacheKey = `${spec.slug}:${style}:${spec.seed}`;
  const cached = DUNGEON_PLAN_CACHE.get(cacheKey);
  if (cached) return cached;

  const s: StructurePrimitive[] = [];
  const thermalVents: Array<[number, number]> = [];
  const deckY = spec.terrainProfile.bridgeDeckY;
  const bossY = realmTerrainHeightAt(spec, 0, -26);
  const rng = createSeededRng(spec.seed ^ 0x5c31);

  let faunaKit: FaunaKitId = 'highland-ironclad';
  let phenomenon: EcosystemPhenomenonSpec = ECOSYSTEM_PHENOMENA['meridian-resonance'];
  let chasmVisual: DungeonChasmVisual = 'dark-water';
  let lanternRgb: [number, number, number] = [0.94, 0.72, 0.30];
  let accentRgb: [number, number, number] = [0.34, 0.38, 0.44];
  let bannerRgb: [number, number, number] = [0.68, 0.22, 0.18];

  const ribZs = [26, 18.5, 3.2, -4.0, -12.0, -20.0, -28.0];

  if (style === 'sunken-cistern') {
    faunaKit = 'verdant-mycelial';
    phenomenon = ECOSYSTEM_PHENOMENA['vital-spore-bloom'];
    chasmVisual = 'cistern-moss';
    lanternRgb = [0.32, 0.94, 0.62];
    accentRgb = [0.22, 0.48, 0.34];
    bannerRgb = [0.18, 0.56, 0.40];

    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'timber', 'stone', lanternRgb, 'timber');

    // Double-tier Roman vaulted cistern colonnade + overhead aqueduct water-troughs
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          { id: `cis-col-${ri}-${tag}`, kind: 'cylinder', material: 'stone', x: cx, yOffset: fy, useAbsoluteY: true, z: rz, sx: 1.05, sy: 13.4, sz: 0.92, segs: 10, collider: 'circle', colliderRadius: 1.15 },
          // Lower arched spillway buttress
          { id: `cis-spill-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx + side * 1.1, yOffset: fy + 4.2, useAbsoluteY: true, z: rz, sx: 2.0, sy: 8.4, sz: 1.4, collider: 'none' },
          // Bioluminescent moss-vine drape
          { id: `cis-vine-${ri}-${tag}`, kind: 'cylinder', material: 'accent', x: cx - side * 1.05, yOffset: fy + 6.4, useAbsoluteY: true, z: rz, sx: 0.28, sy: 5.4, sz: 0.14, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Twin-tier overhead aqueduct water-trough arch
      s.push(
        { id: `cis-arch-lo-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 13.8, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.6, sy: 1.3, sz: 1.6, collider: 'none' },
        { id: `cis-arch-hi-${ri}`, kind: 'box', material: 'timber', x: 0, yOffset: fy + 15.6, useAbsoluteY: true, z: rz, sx: colX * 2 + 3.0, sy: 0.9, sz: 2.2, collider: 'none' },
        // Hanging glowing fungal-lantern chandelier
        { id: `cis-lamp-${ri}`, kind: 'cone', material: 'accent', x: 0, yOffset: fy + 12.2, useAbsoluteY: true, z: rz, sx: 1.35, sy: 1.4, sz: 0, segs: 8, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Sunken Cistern Circular Lotus-Pool Boss Sanctum + 8 Mossy Sluice Pillars
    s.push(
      { id: 'cis-boss-ring', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -26.0, sx: 10.4, sy: 0.9, sz: 10.0, segs: 16, collider: 'none' },
      { id: 'cis-boss-center', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -26.0, sx: 7.4, sy: 0.25, sz: 7.2, segs: 16, collider: 'none' },
    );
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + (i / 7) * Math.PI;
      const mx = Math.cos(ang) * 10.2;
      const mz = -26.0 + Math.sin(ang) * 8.6;
      s.push(
        { id: `cis-boss-p-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.95, sy: 8.6, sz: 0.78, segs: 10, collider: 'circle', colliderRadius: 1.0 },
        { id: `cis-boss-cap-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY + 8.6, useAbsoluteY: true, z: mz, sx: 1.9, sy: 0.65, sz: 0.9, segs: 8, rgb: [0.16, 0.64, 0.38], collider: 'none' },
      );
    }

    // Giant subterranean fungal-lotus formations rising from the flooded chasm
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (6.2 + rng() * 11.0);
      const fz = 5.2 + rng() * 11.2;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.4;
      const fh = 3.0 + rng() * 4.2;
      s.push(
        { id: `cis-fung-s-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 0.52, sy: fh, sz: 0.36, segs: 7, rgb: [0.46, 0.56, 0.44], collider: 'none' },
        { id: `cis-fung-c-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy + fh, useAbsoluteY: true, z: fz, sx: 1.85, sy: 0.55, sz: 0.75, segs: 9, rgb: lanternRgb, collider: 'none' },
      );
    }
  } else if (style === 'geothermal-depths') {
    faunaKit = 'pyroclastic-forge';
    phenomenon = ECOSYSTEM_PHENOMENA['thermal-updraft'];
    chasmVisual = 'magma-core';
    lanternRgb = [0.98, 0.42, 0.10];
    accentRgb = [0.22, 0.14, 0.14];
    bannerRgb = [0.88, 0.28, 0.10];

    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'stone', 'stone', lanternRgb, 'brazier');

    // Active floor thermal vents inside the rotunda & boss flanks!
    thermalVents.push([-6.5, -2.0], [6.5, -2.0], [-7.5, -18.0], [7.5, -18.0], [0, -14.5]);

    // Heavy Forged-Iron Crucible Buttress Pylons + Overhead Slag-Chain Gantries
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          { id: `geo-pylon-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx, yOffset: fy + 6.8, useAbsoluteY: true, z: rz, sx: 2.3, sy: 13.6, sz: 2.3, collider: 'box' },
          // Blazing crucible furnace bowl bolted to each pylon
          { id: `geo-cruc-${ri}-${tag}`, kind: 'cylinder', material: 'accent', x: cx - side * 1.45, yOffset: fy + 3.2, useAbsoluteY: true, z: rz, sx: 0.9, sy: 1.4, sz: 1.25, segs: 6, rgb: accentRgb, collider: 'none' },
          { id: `geo-fire-${ri}-${tag}`, kind: 'cone', material: 'accent', x: cx - side * 1.45, yOffset: fy + 4.6, useAbsoluteY: true, z: rz, sx: 0.95, sy: 1.9, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Twin-beam iron foundry gantry + suspended molten cauldron
      s.push(
        { id: `geo-gantry-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 14.6, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.8, sy: 1.8, sz: 1.4, collider: 'none' },
        { id: `geo-chain-${ri}`, kind: 'cylinder', material: 'accent', x: 0, yOffset: fy + 11.4, useAbsoluteY: true, z: rz, sx: 0.25, sy: 3.2, sz: 0.25, segs: 6, rgb: [0.16, 0.14, 0.15], collider: 'none' },
        { id: `geo-pot-${ri}`, kind: 'cylinder', material: 'accent', x: 0, yOffset: fy + 10.6, useAbsoluteY: true, z: rz, sx: 1.45, sy: 1.1, sz: 1.0, segs: 8, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Octagonal Anvil-Core Boss Foundry Dais + Twin Roaring Furnace Smokestacks
    s.push(
      { id: 'geo-anvil-base', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -26.0, sx: 9.8, sy: 0.95, sz: 9.2, segs: 8, collider: 'none' },
      { id: 'geo-anvil-ring', kind: 'cylinder', material: 'accent', x: 0, yOffset: bossY + 0.42, useAbsoluteY: true, z: -26.0, sx: 7.8, sy: 0.18, sz: 7.6, segs: 8, rgb: lanternRgb, collider: 'none' },
    );
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 9.8;
      const mz = -26.0 + Math.sin(ang) * 8.4;
      s.push(
        { id: `geo-stack-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 1.35, sy: 9.6, sz: 0.68, segs: 6, collider: 'circle', colliderRadius: 1.25 },
        { id: `geo-flame-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 9.6, useAbsoluteY: true, z: mz, sx: 0.78, sy: 2.6, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Jagged obsidian magma spires thrusting from the lava chasm
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (5.6 + rng() * 12.2);
      const fz = 5.0 + rng() * 11.8;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.8 + rng() * 5.8;
      s.push(
        { id: `geo-ob-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 1.05, sy: fh, sz: 0.18, segs: 5, rgb: [0.14, 0.12, 0.14], collider: 'none' },
        { id: `geo-ob-tip-${i}`, kind: 'cone', material: 'accent', x: fx, yOffset: fy + fh, useAbsoluteY: true, z: fz, sx: 0.34, sy: 1.4, sz: 0, segs: 5, rgb: lanternRgb, collider: 'none' },
      );
    }
  } else if (style === 'abyssal-grotto') {
    faunaKit = 'pelagic-abyssal';
    phenomenon = ECOSYSTEM_PHENOMENA['tidal-current'];
    chasmVisual = 'abyssal-coral';
    lanternRgb = [0.24, 0.94, 0.96];
    accentRgb = [0.84, 0.44, 0.48];
    bannerRgb = [0.14, 0.54, 0.68];

    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'timber', 'timber', lanternRgb, 'timber');

    // Organic Shipwreck-Rib & Coral Sea-Cavern Arches
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          // Curved weathered sea-timber rib pillar
          { id: `aby-rib-${ri}-${tag}`, kind: 'cylinder', material: 'timber', x: cx, yOffset: fy, useAbsoluteY: true, z: rz, sx: 0.95, sy: 12.8, sz: 0.55, segs: 7, collider: 'circle', colliderRadius: 1.0 },
          // Branching rose-gold & aqua coral clusters clinging to each column
          { id: `aby-cor-a-${ri}-${tag}`, kind: 'cylinder', material: 'accent', x: cx - side * 1.1, yOffset: fy + 2.4, useAbsoluteY: true, z: rz, sx: 0.45, sy: 3.4, sz: 0.95, segs: 6, rgb: ri % 2 === 0 ? accentRgb : lanternRgb, collider: 'none' },
          { id: `aby-cor-b-${ri}-${tag}`, kind: 'cone', material: 'accent', x: cx - side * 1.35, yOffset: fy + 5.8, useAbsoluteY: true, z: rz, sx: 0.72, sy: 1.6, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Sweeping organic timber vault beam + hanging pearl-lantern orb
      s.push(
        { id: `aby-beam-${ri}`, kind: 'box', material: 'timber', x: 0, yOffset: fy + 13.6, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.2, sy: 1.2, sz: 1.2, collider: 'none' },
        { id: `aby-pearl-${ri}`, kind: 'cone', material: 'accent', x: 0, yOffset: fy + 11.8, useAbsoluteY: true, z: rz, sx: 0.95, sy: 1.7, sz: 0, segs: 8, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Coral Atoll Boss Sanctum + Giant Branching Reef-Crown
    s.push(
      { id: 'aby-boss-atoll', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY - 0.45, useAbsoluteY: true, z: -26.0, sx: 10.0, sy: 0.85, sz: 9.5, segs: 14, collider: 'none' },
    );
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI + (i / 6) * Math.PI;
      const mx = Math.cos(ang) * 9.8;
      const mz = -26.0 + Math.sin(ang) * 8.4;
      const isRose = i % 2 === 0;
      s.push(
        { id: `aby-reef-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.85, sy: 7.4 + (i % 3) * 1.1, sz: 1.45, segs: 7, rgb: isRose ? accentRgb : [0.18, 0.68, 0.72], collider: 'circle', colliderRadius: 1.0 },
        { id: `aby-reef-glow-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 7.4 + (i % 3) * 1.1, useAbsoluteY: true, z: mz, sx: 1.1, sy: 2.0, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Towering bioluminescent coral spires across the sea-cavern chasm
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (5.8 + rng() * 11.8);
      const fz = 5.0 + rng() * 11.5;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.2 + rng() * 5.0;
      const cRgb: [number, number, number] = i % 3 === 0 ? accentRgb : lanternRgb;
      s.push(
        { id: `aby-chasm-c-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 0.65, sy: fh, sz: 1.15, segs: 6, rgb: cRgb, collider: 'none' },
      );
    }
  } else if (style === 'echo-tomb') {
    faunaKit = 'dune-sandstrider';
    phenomenon = ECOSYSTEM_PHENOMENA['desert-tailwind'];
    chasmVisual = 'amber-mist';
    lanternRgb = [0.98, 0.80, 0.24];
    accentRgb = [0.78, 0.56, 0.26];
    bannerRgb = [0.84, 0.44, 0.16];

    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'cobble', 'stone', lanternRgb, 'obelisk');

    // Stepped Sandstone Pyramid Buttresses & Resonant Bronze Wind-Harp Frames
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          // Stepped sandstone lotus-obelisk column
          { id: `ech-base-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx, yOffset: fy + 1.2, useAbsoluteY: true, z: rz, sx: 2.6, sy: 2.4, sz: 2.6, collider: 'box' },
          { id: `ech-shaft-${ri}-${tag}`, kind: 'cylinder', material: 'stone', x: cx, yOffset: fy + 2.4, useAbsoluteY: true, z: rz, sx: 1.1, sy: 10.6, sz: 0.75, segs: 4, collider: 'none' },
          // Golden solar tuning ring + brass resonance chime
          { id: `ech-chime-${ri}-${tag}`, kind: 'cylinder', material: 'accent', x: cx - side * 1.15, yOffset: fy + 5.8, useAbsoluteY: true, z: rz, sx: 0.14, sy: 3.8, sz: 0.14, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Corbelled sandstone pyramid lintel + central golden sun-disk
      s.push(
        { id: `ech-lintel-a-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 13.8, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.4, sy: 1.4, sz: 1.8, collider: 'none' },
        { id: `ech-lintel-b-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 15.2, useAbsoluteY: true, z: rz, sx: colX * 1.5, sy: 1.2, sz: 1.4, collider: 'none' },
        { id: `ech-sun-${ri}`, kind: 'cylinder', material: 'accent', x: 0, yOffset: fy + 12.1, useAbsoluteY: true, z: rz, sx: 1.2, sy: 0.45, sz: 1.2, segs: 12, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Stepped 3-Tier Sun-Ziggurat Boss Dais + 5 Golden Obelisk Crown
    s.push(
      { id: 'ech-zig-1', kind: 'box', material: 'stone', x: 0, yOffset: bossY - 0.1, useAbsoluteY: true, z: -26.0, sx: 17.5, sy: 0.7, sz: 14.5, collider: 'none' },
      { id: 'ech-zig-2', kind: 'box', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -26.0, sx: 13.5, sy: 0.35, sz: 11.0, collider: 'none' },
    );
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI + (i / 4) * Math.PI;
      const mx = Math.cos(ang) * 9.6;
      const mz = -26.0 + Math.sin(ang) * 8.2;
      s.push(
        { id: `ech-ob-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 1.15, sy: 9.2, sz: 0.58, segs: 4, collider: 'circle', colliderRadius: 1.1 },
        { id: `ech-cap-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 9.2, useAbsoluteY: true, z: mz, sx: 0.65, sy: 2.2, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Banded sandstone echo-columns & golden tuning monoliths in the chasm
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (6.2 + rng() * 11.2);
      const fz = 5.4 + rng() * 10.6;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.8 + rng() * 4.8;
      s.push(
        { id: `ech-chasm-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 0.95, sy: fh, sz: 0.52, segs: 4, rgb: accentRgb, collider: 'none' },
        { id: `ech-chasm-g-${i}`, kind: 'cone', material: 'accent', x: fx, yOffset: fy + fh, useAbsoluteY: true, z: fz, sx: 0.55, sy: 1.4, sz: 0, segs: 4, rgb: lanternRgb, collider: 'none' },
      );
    }
  } else if (style === 'glacial-crypt') {
    faunaKit = 'glacial-frostborn';
    phenomenon = ECOSYSTEM_PHENOMENA['aurora-clarity'];
    chasmVisual = 'glacial-rift';
    lanternRgb = [0.54, 0.92, 1.0];
    accentRgb = [0.46, 0.74, 0.92];
    bannerRgb = [0.22, 0.58, 0.88];

    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'cobble', 'stone', lanternRgb, 'prism');

    // Hexagonal Frostglass Cathedral Prism Pillars + Suspended Aurora Chandeliers
    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          { id: `gla-col-${ri}-${tag}`, kind: 'cylinder', material: 'accent', x: cx, yOffset: fy, useAbsoluteY: true, z: rz, sx: 1.1, sy: 13.4, sz: 0.72, segs: 6, rgb: accentRgb, collider: 'circle', colliderRadius: 1.1 },
          { id: `gla-shard-${ri}-${tag}`, kind: 'cone', material: 'accent', x: cx - side * 1.15, yOffset: fy + 2.8, useAbsoluteY: true, z: rz, sx: 0.55, sy: 4.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        );
      }
      // Pointed cathedral ice-rib arch + crystal chandelier
      s.push(
        { id: `gla-rib-${ri}`, kind: 'box', material: 'accent', x: 0, yOffset: fy + 14.2, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.4, sy: 1.1, sz: 1.2, rgb: accentRgb, collider: 'none' },
        { id: `gla-chand-a-${ri}`, kind: 'cone', material: 'accent', x: 0, yOffset: fy + 11.4, useAbsoluteY: true, z: rz, sx: 1.4, sy: 2.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        { id: `gla-chand-b-${ri}`, kind: 'cone', material: 'accent', x: -3.6, yOffset: fy + 12.2, useAbsoluteY: true, z: rz, sx: 0.65, sy: 1.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
        { id: `gla-chand-c-${ri}`, kind: 'cone', material: 'accent', x: 3.6, yOffset: fy + 12.2, useAbsoluteY: true, z: rz, sx: 0.65, sy: 1.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Hexagonal Mirror-Ice Boss Dais + 8 Towering Translucent Crystal Spires
    s.push(
      { id: 'gla-boss-hex', kind: 'cylinder', material: 'accent', x: 0, yOffset: bossY - 0.45, useAbsoluteY: true, z: -26.0, sx: 10.2, sy: 0.85, sz: 9.8, segs: 6, rgb: accentRgb, collider: 'none' },
      { id: 'gla-boss-core', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -26.0, sx: 7.5, sy: 0.22, sz: 7.3, segs: 6, collider: 'none' },
    );
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + (i / 7) * Math.PI;
      const mx = Math.cos(ang) * 10.0;
      const mz = -26.0 + Math.sin(ang) * 8.5;
      s.push(
        { id: `gla-spire-${i}`, kind: 'cylinder', material: 'accent', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.88, sy: 8.4 + (i % 2) * 2.2, sz: 0.35, segs: 6, rgb: accentRgb, collider: 'circle', colliderRadius: 1.0 },
        { id: `gla-tip-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 8.4 + (i % 2) * 2.2, useAbsoluteY: true, z: mz, sx: 0.45, sy: 2.8, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Cluster of glacial crystal shards bursting from the frozen rift chasm
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (5.6 + rng() * 12.2);
      const fz = 5.0 + rng() * 11.8;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.5 + rng() * 5.4;
      s.push(
        { id: `gla-ice-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 0.72, sy: fh, sz: 0.22, segs: 6, rgb: accentRgb, collider: 'none' },
        { id: `gla-ice-t-${i}`, kind: 'cone', material: 'accent', x: fx, yOffset: fy + fh, useAbsoluteY: true, z: fz, sx: 0.26, sy: 1.7, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }
  } else {
    // Classic catacomb-vault: Vaulted Octagonal Sarcophagus Colonnade & Bronze Reliquary Dais
    addBaseEnclosureAndPortals(s, spec, lanternRgb, 'stone');
    addBridgeDeck(s, deckY, 'cobble', 'stone', lanternRgb, 'block');

    for (let ri = 0; ri < ribZs.length; ri++) {
      const rz = ribZs[ri];
      const fy = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'w' : 'e';
        const cx = side * colX;
        s.push(
          { id: `cat-plinth-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx, yOffset: fy + 0.55, useAbsoluteY: true, z: rz, sx: 2.1, sy: 1.1, sz: 2.1, collider: 'box' },
          { id: `cat-col-${ri}-${tag}`, kind: 'cylinder', material: 'stone', x: cx, yOffset: fy + 1.1, useAbsoluteY: true, z: rz, sx: 0.88, sy: 12.2, sz: 0.78, segs: 8, collider: 'none' },
          { id: `cat-cap-${ri}-${tag}`, kind: 'box', material: 'stone', x: cx, yOffset: fy + 13.5, useAbsoluteY: true, z: rz, sx: 2.2, sy: 1.0, sz: 2.2, collider: 'none' },
          { id: `cat-ban-${ri}-${tag}`, kind: 'box', material: 'accent', x: cx - side * 0.95, yOffset: fy + 6.2, useAbsoluteY: true, z: rz, sx: 0.14, sy: 3.8, sz: 1.25, rgb: bannerRgb, collider: 'none' },
          { id: `cat-bar-${ri}-${tag}`, kind: 'box', material: 'accent', x: cx - side * 0.92, yOffset: fy + 8.15, useAbsoluteY: true, z: rz, sx: 0.24, sy: 0.24, sz: 1.65, rgb: lanternRgb, collider: 'none' },
        );
      }
      s.push(
        { id: `cat-arch-${ri}`, kind: 'box', material: 'stone', x: 0, yOffset: fy + 14.8, useAbsoluteY: true, z: rz, sx: colX * 2 + 2.6, sy: 1.6, sz: 1.45, collider: 'none' },
        { id: `cat-key-${ri}`, kind: 'box', material: 'accent', x: 0, yOffset: fy + 13.8, useAbsoluteY: true, z: rz, sx: 1.4, sy: 0.7, sz: 1.6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Reliquary Amphitheater Boss Dais + 6 Basalt Crown Pillars
    s.push(
      { id: 'cat-boss-dais', kind: 'cylinder', material: 'stone', x: 0, yOffset: bossY - 0.5, useAbsoluteY: true, z: -26.0, sx: 9.6, sy: 0.85, sz: 9.2, segs: 12, collider: 'none' },
      { id: 'cat-boss-floor', kind: 'cylinder', material: 'cobble', x: 0, yOffset: bossY + 0.35, useAbsoluteY: true, z: -26.0, sx: 7.6, sy: 0.22, sz: 7.4, segs: 12, collider: 'none' },
    );
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 9.8;
      const mz = -26.0 + Math.sin(ang) * 8.4;
      s.push(
        { id: `cat-mon-${i}`, kind: 'cylinder', material: 'stone', x: mx, yOffset: bossY, useAbsoluteY: true, z: mz, sx: 0.95, sy: 7.8, sz: 0.72, segs: 8, collider: 'circle', colliderRadius: 1.0 },
        { id: `cat-mon-cap-${i}`, kind: 'cone', material: 'accent', x: mx, yOffset: bossY + 7.8, useAbsoluteY: true, z: mz, sx: 0.82, sy: 1.6, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }

    // Chasm basalt stalagmites
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (6.2 + rng() * 11.0);
      const fz = 5.5 + rng() * 10.5;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.2 + rng() * 4.5;
      s.push(
        { id: `cat-chasm-${i}`, kind: 'cylinder', material: 'accent', x: fx, yOffset: fy, useAbsoluteY: true, z: fz, sx: 0.75, sy: fh, sz: 0.25, segs: 6, rgb: accentRgb, collider: 'none' },
        { id: `cat-chasm-t-${i}`, kind: 'cone', material: 'accent', x: fx, yOffset: fy + fh, useAbsoluteY: true, z: fz, sx: 0.3, sy: 1.1, sz: 0, segs: 6, rgb: lanternRgb, collider: 'none' },
      );
    }
  }

  const plan: SynthesizedDungeonPlan = {
    dungeonSlug: spec.slug,
    style,
    styleTitle: DUNGEON_STYLE_TITLES[style],
    faunaKit,
    phenomenon,
    chasmVisual,
    lanternRgb,
    accentRgb,
    bannerRgb,
    structures: s,
    thermalVents,
    catalogExtensionIds: [`verdant:dungeon:${style}`, `verdant:fauna:${faunaKit}`],
  };

  DUNGEON_PLAN_CACHE.set(cacheKey, plan);
  return plan;
}
