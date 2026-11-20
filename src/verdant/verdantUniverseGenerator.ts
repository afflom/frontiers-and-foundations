import {
  CANONICAL_REALM_SPECS,
  makeEnemy,
  type DungeonArchitecturalStyle,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import {
  createSeededRng,
  hashStringSeed,
  synthesizeVerdantCharacter,
} from './verdantCharacterSynthesizer';
import { synthesizeScoreFromBrief } from './verdantScoreSchema';
import type { GameNpc, GameQuest, WorldInteractable, WorldRegion } from '../game/worldData';

export interface MacroClimateSample {
  temperature: number; // 0 (glacial) .. 1 (volcanic/arid)
  moisture: number; // 0 (steppe/crucible) .. 1 (pelagic/aqueduct)
  elevation: number; // 0 (coastal) .. 1 (highland)
  theme: RealmThemeId;
  ambientMood: WorldRegion['ambientMood'];
  skyFallbackRgb: [number, number, number];
  fogRgb: [number, number, number];
  dungeonStyle: DungeonArchitecturalStyle;
  biomeTitle: string;
}

export interface AdjacentCellPreview {
  dir: 'N' | 'S' | 'E' | 'W';
  cell: [number, number, number];
  key: string;
  slug: string;
  name: string;
  theme: RealmThemeId;
  biomeTitle: string;
  isCanonical: boolean;
}

export function getCellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * Continuous spatial macro-climate field over infinite Meridian UniverseCells (cx, 0, cz).
 * Neighboring cells smoothly share continental climate bands instead of noisy random jumping.
 */
export function sampleMacroClimate(
  cx: number,
  cz: number,
  worldSeed = 7777,
): MacroClimateSample {
  const phase = (worldSeed % 389) * 0.013;
  // Smooth continental climate waves calibrated so traveling 1-2 cells transitions naturally across all 6 biomes
  const tempRaw =
    0.5 +
    0.38 * Math.sin(cx * 0.72 + cz * 0.34 + phase) +
    0.18 * Math.cos(cz * 0.68 - cx * 0.25 + 0.7);
  const moistRaw =
    0.5 +
    0.38 * Math.cos(cx * 0.58 - cz * 0.64 + phase * 1.4) +
    0.18 * Math.sin((cx + cz) * 0.45);
  const elevRaw =
    0.5 +
    0.36 * Math.sin(cx * 0.49 - cz * 0.51 + 1.9) +
    0.16 * Math.cos(cx * 0.83 + cz * 0.67);

  const temperature = Math.max(0, Math.min(1, tempRaw));
  const moisture = Math.max(0, Math.min(1, moistRaw));
  const elevation = Math.max(0, Math.min(1, elevRaw));

  let theme: RealmThemeId;
  if (temperature < 0.31) {
    theme = 'glacial-spire';
  } else if (temperature > 0.69 && moisture < 0.52) {
    theme = 'obsidian-crucible';
  } else if (moisture > 0.64 && elevation < 0.56) {
    theme = 'pelagic-spires';
  } else if (moisture > 0.56) {
    theme = 'sunken-aqueducts';
  } else if (temperature > 0.48 && moisture <= 0.56) {
    theme = 'amber-steppe';
  } else {
    theme = 'citadel-highlands';
  }

  // Slight per-cell atmospheric variation so adjacent same-biome cells still feel distinct
  const cellSeed = hashStringSeed(`climate:${worldSeed}:${cx}:${cz}`);
  const rng = createSeededRng(cellSeed);
  const shift = (rng() - 0.5) * 0.06;

  const palette: Record<
    RealmThemeId,
    {
      sky: [number, number, number];
      fog: [number, number, number];
      mood: WorldRegion['ambientMood'];
      dungeonStyle: DungeonArchitecturalStyle;
      biomeTitle: string;
    }
  > = {
    'citadel-highlands': {
      sky: [0.46, 0.54, 0.64],
      fog: [0.62, 0.64, 0.66],
      mood: 'causeway',
      dungeonStyle: 'catacomb-vault',
      biomeTitle: 'Basalt Highlands',
    },
    'sunken-aqueducts': {
      sky: [0.42, 0.56, 0.58],
      fog: [0.58, 0.66, 0.63],
      mood: 'ironwood',
      dungeonStyle: 'sunken-cistern',
      biomeTitle: 'Verdant Aqueducts',
    },
    'obsidian-crucible': {
      sky: [0.48, 0.34, 0.28],
      fog: [0.56, 0.42, 0.34],
      mood: 'foundry',
      dungeonStyle: 'geothermal-depths',
      biomeTitle: 'Obsidian Caldera',
    },
    'pelagic-spires': {
      sky: [0.38, 0.56, 0.70],
      fog: [0.60, 0.69, 0.75],
      mood: 'coast',
      dungeonStyle: 'sunken-cistern',
      biomeTitle: 'Pelagic Archipelago',
    },
    'amber-steppe': {
      sky: [0.56, 0.45, 0.34],
      fog: [0.70, 0.58, 0.44],
      mood: 'ironwood',
      dungeonStyle: 'catacomb-vault',
      biomeTitle: 'Amber Wind-Steppe',
    },
    'glacial-spire': {
      sky: [0.36, 0.48, 0.64],
      fog: [0.64, 0.72, 0.80],
      mood: 'coast',
      dungeonStyle: 'glacial-crypt',
      biomeTitle: 'Frostglass Reaches',
    },
  };

  const p = palette[theme];
  const clamp01 = (v: number) => Number(Math.max(0.15, Math.min(0.92, v)).toFixed(3));
  return {
    temperature,
    moisture,
    elevation,
    theme,
    ambientMood: p.mood,
    skyFallbackRgb: [clamp01(p.sky[0] + shift), clamp01(p.sky[1] + shift * 0.7), clamp01(p.sky[2] - shift * 0.5)],
    fogRgb: [clamp01(p.fog[0] + shift * 0.8), clamp01(p.fog[1] + shift * 0.6), clamp01(p.fog[2] - shift * 0.4)],
    dungeonStyle: p.dungeonStyle,
    biomeTitle: p.biomeTitle,
  };
}

const THEME_LEXICON: Record<
  RealmThemeId,
  {
    prefixes: string[];
    landforms: string[];
    rootNames: string[];
    keepNames: string[];
    basinNames: string[];
    groveNames: string[];
    dungeonNames: string[];
    enemyPrefixes: string[];
    materials: FrontiersRealmSpec['materials'];
    questMotifs: string[];
  }
> = {
  'citadel-highlands': {
    prefixes: ['High', 'Iron', 'Sovereign', 'Cairn', 'Gale', 'Keystone', 'Aegis', 'Granite'],
    landforms: ['Bastion', 'Terraces', 'Escarpment', 'Reach', 'Ramparts', 'Moor', 'Crest'],
    rootNames: ['Vaelen', 'Korath', 'Haldrin', 'Mirek', 'Ostrava', 'Brecken', 'Talmar', 'Serris'],
    keepNames: ['Keystone Bastion', 'Highland Watch-Keep', 'Sovereign Citadel', 'Cairn Rotunda'],
    basinNames: ['Anvil Hollow', 'Bell-Foundry Basin', 'Quarry Terraces', 'Smelter Ridge'],
    groveNames: ['Ironwood Copse', 'Wind-Bent Pines', 'Granite Orchard', 'Moorland Pines'],
    dungeonNames: ['The Sunken Charter Vault', 'The Basalt Reliquary', 'The Deep Survey Cistern'],
    enemyPrefixes: ['Basalt', 'Cairn', 'Highland', 'Rift-Iron'],
    materials: {
      terrain: 'rocky_terrain_02',
      masonry: 'castle_brick_01',
      road: 'cobblestone_01',
      timber: 'brown_planks_03',
    },
    questMotifs: ['meridian keystone alignment', 'highland watch-bell resonance', 'frontier charter restoration'],
  },
  'sunken-aqueducts': {
    prefixes: ['Moss', 'Sylvan', 'Fern', 'Weeping', 'Willow', 'Sluice', 'Emerald', 'Bramble'],
    landforms: ['Aqueducts', 'Weald', 'Terraces', 'Glades', 'Basins', 'Arches', 'Springs'],
    rootNames: ['Oakhaven', 'Linden', 'Vespera', 'Aldermere', 'Thornwell', 'Berylia', 'Sylvar', 'Glimmer'],
    keepNames: ['Aqueduct Rotunda', 'Sluice-Gate Keep', 'Canopy Arches', 'Moss-Stone Spire'],
    basinNames: ['Cistern Spillway', 'Fern-Sluice Basin', 'Sunken Mill-Race', 'Waterwheel Terrace'],
    groveNames: ['Ancient Cedar Stand', 'Luminous Ferns', 'Root-Arch Groves', 'Willow Canopy'],
    dungeonNames: ['The Drowned Sluice Vault', 'The Root-Bound Cistern', 'The Emerald Conduit'],
    enemyPrefixes: ['Moss-Plate', 'Sluice', 'Bramble', 'Verdant'],
    materials: {
      terrain: 'forest_ground_04',
      masonry: 'stone_wall',
      road: 'cobblestone_floor_01',
      timber: 'brown_planks_03',
    },
    questMotifs: ['aqueduct weir rebalancing', 'canopy spore harmonics', 'sluice-gate irrigation pact'],
  },
  'obsidian-crucible': {
    prefixes: ['Cinder', 'Basalt', 'Ember', 'Slag', 'Searing', 'Pyre', 'Anvil', 'Magma'],
    landforms: ['Caldera', 'Crucible', 'Fissure', 'Spire', 'Forge-Steppe', 'Trench', 'Kilns'],
    rootNames: ['Kragor', 'Vulketh', 'Ignar', 'Sinder', 'Malthor', 'Pyrrha', 'Brimstone', 'Dross'],
    keepNames: ['Obsidian Crucible Keep', 'Bellows Citadel', 'Slag-Crown Spire', 'Forge-Heart Bastion'],
    basinNames: ['Geothermal Vents', 'Quench-Trough Basin', 'Ash-Kiln Hollow', 'Smelting Ravine'],
    groveNames: ['Charred Pillar Field', 'Glass-Needle Flats', 'Fumarole Ridge', 'Scoria Columns'],
    dungeonNames: ['The Crucible Magma-Vault', 'The Deep Bellows Sanctum', 'The Obsidian Furnace'],
    enemyPrefixes: ['Cinder', 'Slag-Iron', 'Magma', 'Obsidian'],
    materials: {
      terrain: 'volcanic_rock',
      masonry: 'dark_brick',
      road: 'cobblestone_01',
      timber: 'charred_planks',
    },
    questMotifs: ['caldera vent venting', 'bronze bellows harmonic quench', 'obsidian rift containment'],
  },
  'pelagic-spires': {
    prefixes: ['Tidal', 'Pelagic', 'Salt', 'Brine', 'Coral', 'Sextant', 'Mist', 'Shoal'],
    landforms: ['Spires', 'Archipelago', 'Headlands', 'Atoll', 'Strait', 'Breakwater', 'Stacks'],
    rootNames: ['Glasswater', 'Nereia', 'Pelagis', 'Calyx', 'Tidewatch', 'Maris', 'Orellia', 'Vane'],
    keepNames: ['Tidal Lighthouse Keep', 'Sextant Spire', 'Breakwater Citadel', 'Beacon Headland'],
    basinNames: ['Tide-Bell Shoals', 'Salt-Pan Terraces', 'Sea-Arch Lagoon', 'Barnacle Quay'],
    groveNames: ['Driftwood Promontory', 'Salt-Cedar Bluff', 'Kelp-Mist Cliffs', 'Gale-Bent Pines'],
    dungeonNames: ['The Drowned Sextant Grotto', 'The Tidal Bell-Vault', 'The Abyssal Cistern'],
    enemyPrefixes: ['Reef-Scale', 'Tide-Glass', 'Brine', 'Shoal'],
    materials: {
      terrain: 'coast_sand_rocks_02',
      masonry: 'castle_brick_01',
      road: 'cobblestone_floor_01',
      timber: 'brown_planks_03',
    },
    questMotifs: ['tidal shoal triangulation', 'lighthouse prism realignment', 'salt-fog acoustic buoyage'],
  },
  'amber-steppe': {
    prefixes: ['Amber', 'Saffron', 'Sun-Carved', 'Ochre', 'Aeolian', 'Dune', 'Mirage', 'Bronze'],
    landforms: ['Monoliths', 'Steppe', 'Canyons', 'Mesas', 'Flats', 'Arches', 'Badlands'],
    rootNames: ['Kar-Veth', 'Sahrin', 'Zephira', 'Al-Kesh', 'Tamaris', 'Ophir', 'Solis', 'Qadim'],
    keepNames: ['Sun-Terrace Ziggurat', 'Wind-Harp Citadel', 'Amber Stepped Keep', 'Caravan Sanctuary'],
    basinNames: ['Bronze Wind-Harp Basin', 'Ochre Amphitheater', 'Mirage Salt-Pan', 'Canyon Cistern'],
    groveNames: ['Sandstone Hoodoos', 'Dry Cedar Canyon', 'Amber Pillar Field', 'Red-Mesa Scrub'],
    dungeonNames: ['The Resonance Hall', 'The Buried Caravan Vault', 'The Aeolian Tomb'],
    enemyPrefixes: ['Dune-Shale', 'Mirage', 'Sandstone', 'Sun-Glass'],
    materials: {
      terrain: 'aerial_sand',
      masonry: 'large_sandstone_blocks_01',
      road: 'cobblestone_01',
      timber: 'brown_planks_03',
    },
    questMotifs: ['aeolian wind-harp tuning', 'caravan meridian beacon', 'sandstone acoustic relay'],
  },
  'glacial-spire': {
    prefixes: ['Frostglass', 'Aurora', 'Rime', 'Glacial', 'Crystalline', 'Winter', 'Hoarfrost', 'Boreal'],
    landforms: ['Spires', 'Bastion', 'Crevasse', 'Shelf', 'Peaks', 'Tundra', 'Cirque'],
    rootNames: ['Borealis', 'Skadi', 'Vintar', 'Kaldor', 'Norrheim', 'Glacis', 'Aurelia', 'Svalen'],
    keepNames: ['Frostglass Fortress', 'Aurora Prism-Keep', 'Rime-Crown Spire', 'Glacial Observatory'],
    basinNames: ['Rime-Bell Cirque', 'Frozen Spillway', 'Ice-Lens Hollow', 'Sub-Zero Forge'],
    groveNames: ['Snow-Laden Spruces', 'Crystal Needle Field', 'Hoarfrost Ridge', 'Blue-Ice Pillars'],
    dungeonNames: ['The Frozen Meridian Crypt', 'The Aurora Prism-Vault', 'The Glacial Reliquary'],
    enemyPrefixes: ['Rime-Plate', 'Aurora', 'Glacial', 'Frostglass'],
    materials: {
      terrain: 'snow_02',
      masonry: 'castle_brick_01',
      road: 'cobblestone_floor_01',
      timber: 'brown_planks_03',
    },
    questMotifs: ['aurora lens calibration', 'glacial acoustic beacon', 'permafrost meridian thaw'],
  },
};

const CANONICAL_OVERWORLD_BY_CELL = new Map<string, FrontiersRealmSpec>();
for (const spec of CANONICAL_REALM_SPECS) {
  if (!spec.isDungeon) {
    CANONICAL_OVERWORLD_BY_CELL.set(getCellKey(spec.cell[0], spec.cell[2]), spec);
  }
}

const PROCEDURAL_CELL_CACHE = new Map<string, FrontiersRealmSpec>();

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

export function findCanonicalCell(cx: number, cz: number): FrontiersRealmSpec | undefined {
  return CANONICAL_OVERWORLD_BY_CELL.get(getCellKey(cx, cz));
}

/**
 * Deterministically synthesizes a complete, endlessly discoverable Verdant UniverseCell
 * for ANY integer coordinate (cx, 0, cz).
 *
 * - Canonical Meridian Cells (0,0), (-1,0), (1,0), (0,-1), (0,1), (-1,-1) return their
 *   hand-tuned + Poly Haven pre-compiled HD realms.
 * - Every other (cx, 0, cz) coordinate across the infinite world is procedurally synthesized
 *   with continuous macro-climate biome differentiation, unique toponymy, 3 fully differentiated
 *   synthesized NPCs (with 1:1 matching SVG portraits & 3D rigs), procedural 3-stage quests,
 *   interactables, enemies, and a bespoke procedural orchestral soundtrack.
 */
export function synthesizeUniverseCell(
  cx: number,
  cz: number,
  options?: { worldSeed?: number; forceProcedural?: boolean },
): FrontiersRealmSpec {
  const worldSeed = options?.worldSeed ?? 7777;
  const key = getCellKey(cx, cz);

  if (!options?.forceProcedural) {
    const canonical = CANONICAL_OVERWORLD_BY_CELL.get(key);
    if (canonical) return canonical;
    const cached = PROCEDURAL_CELL_CACHE.get(`${worldSeed}:${key}`);
    if (cached) return cached;
  }

  const climate = sampleMacroClimate(cx, cz, worldSeed);
  const lex = THEME_LEXICON[climate.theme];
  const cellSeed = hashStringSeed(`cell:${worldSeed}:${cx}:${cz}`);
  const rng = createSeededRng(cellSeed);

  const prefix = pick(rng, lex.prefixes);
  const landform = pick(rng, lex.landforms);
  const root = pick(rng, lex.rootNames);
  const name = `The ${prefix} ${landform} of ${root}`;
  const slug = `cell-${cx < 0 ? `w${Math.abs(cx)}` : `e${cx}`}-${cz < 0 ? `n${Math.abs(cz)}` : `s${cz}`}`;
  const keepName = pick(rng, lex.keepNames);
  const basinName = pick(rng, lex.basinNames);
  const groveName = pick(rng, lex.groveNames);
  const dungeonName = pick(rng, lex.dungeonNames);
  const motif = pick(rng, lex.questMotifs);

  const tier = Math.min(5, Math.max(1, Math.round(Math.hypot(cx, cz))));
  const dungeonSlug = `${slug}-vault`;

  // Synthesize 3 fully differentiated Verdant NPCs with guaranteed unique genomes + 1:1 SVG portraits
  const npcSlots: Array<{ role: 'warden' | 'scholar' | 'artisan'; regionId: WorldRegion['id']; pos: [number, number] }> = [
    { role: 'warden', regionId: 'southern-terrace', pos: [-3.4, 15.6] },
    { role: 'artisan', regionId: 'ashen-kiln', pos: [-22.4, -4.6] },
    { role: 'scholar', regionId: 'eastern-ridge', pos: [47.5, 11.2] },
  ];

  const npcs: GameNpc[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < npcSlots.length; i++) {
    const slot = npcSlots[i];
    const synth = synthesizeVerdantCharacter({
      id: `npc-${slug}-${i + 1}`,
      seed: hashStringSeed(`${cellSeed}:npc:${i}`),
      theme: climate.theme,
      realmName: name,
      regionId: slot.regionId,
      position: slot.pos,
      biomeSkyRgb: climate.skyFallbackRgb,
      questId: `quest-${slug}`,
      roleHint: slot.role,
      avoidNames: usedNames,
    });
    usedNames.add(synth.npc.name);
    npcs.push(synth.npc);
  }

  const regions: WorldRegion[] = [
    { id: 'high-causeway', name: keepName, subtitle: `${climate.biomeTitle} Meridian Keep`, center: [0, -14], radius: 18, ambientMood: climate.ambientMood },
    { id: 'ashen-kiln', name: basinName, subtitle: 'Resonance Bell Basin', center: [-25, -6], radius: 18, ambientMood: climate.ambientMood },
    { id: 'ironwood-reaches', name: groveName, subtitle: 'Outer Frontier Wilds', center: [25, -6], radius: 18, ambientMood: climate.ambientMood },
    { id: 'salt-loom', name: `${root} Lower Basin`, subtitle: 'Southern Frontier Shoals', center: [24, 24], radius: 20, ambientMood: climate.ambientMood },
    { id: 'southern-terrace', name: `${root} Causeway Approach`, subtitle: `Cell (${cx}, 0, ${cz}) Arrival`, center: [0, 19], radius: 16, ambientMood: climate.ambientMood },
    { id: 'northern-watch', name: `${root} North Gate`, subtitle: 'Northern Frontier Crossing', center: [0, -56], radius: 24, ambientMood: climate.ambientMood },
    { id: 'western-ruins', name: `${root} Monolith Ring`, subtitle: 'Western Frontier Crossing', center: [-54, -22], radius: 24, ambientMood: climate.ambientMood },
    { id: 'eastern-ridge', name: `${root} Caravan Camp`, subtitle: 'Eastern Frontier Crossing', center: [54, 10], radius: 24, ambientMood: climate.ambientMood },
  ];

  const interactables: WorldInteractable[] = [
    {
      id: `int-${slug}-pier`,
      kind: 'resonance-pier',
      name: `${root} Causeway Pier`,
      promptVerb: 'Sound Causeway Pier [Bell-Hammer]',
      regionId: 'high-causeway',
      position: [0, 5.2],
      requiredGear: 'bellhammer',
      activated: false,
    },
    {
      id: `int-${slug}-waystone`,
      kind: 'waystone-beacon',
      name: `${keepName} Waystone`,
      promptVerb: `Attune ${keepName} Waystone`,
      regionId: 'high-causeway',
      position: [0, -10.5],
      activated: false,
    },
    {
      id: `int-${slug}-bell`,
      kind: 'forge-bell',
      name: `${basinName} Bell`,
      promptVerb: `Ring ${basinName} Bell [Bell-Hammer]`,
      regionId: 'ashen-kiln',
      position: [-25, -8],
      requiredGear: 'bellhammer',
      activated: false,
    },
    {
      id: `int-${slug}-relic-1`,
      kind: 'silicate-relic',
      name: `${prefix} Meridian Core`,
      promptVerb: `Harvest ${prefix} Core`,
      regionId: 'ironwood-reaches',
      position: [26, -8],
      activated: false,
    },
    {
      id: `int-${slug}-relic-2`,
      kind: 'silicate-relic',
      name: `${root} Harmonic Shard`,
      promptVerb: 'Harvest Harmonic Shard',
      regionId: 'western-ruins',
      position: [-52, -22],
      activated: false,
    },
    {
      id: `int-${slug}-chest`,
      kind: 'vault-chest',
      name: `${root} Frontier Strongbox`,
      promptVerb: 'Unseal Frontier Strongbox',
      regionId: 'eastern-ridge',
      position: [54, 10],
      activated: false,
    },
    {
      id: `int-${slug}-dungeon`,
      kind: 'dungeon-portal',
      name: dungeonName,
      promptVerb: `Descend into ${dungeonName}`,
      regionId: 'northern-watch',
      position: [-14, -34],
      activated: false,
      targetRealmSlug: dungeonSlug,
    },
  ];

  const primaryNpc = npcs[0];
  const quests: GameQuest[] = [
    {
      id: `quest-${slug}`,
      title: `Charter of ${root}`,
      giverNpcId: primaryNpc.id,
      guildId: primaryNpc.guildId,
      regionId: 'high-causeway',
      summary: `Survey Cell (${cx}, 0, ${cz}) in ${name}: consult ${primaryNpc.name}, attune the ${keepName} Waystone, and ring the ${basinName} Bell to anchor this frontier to the Stitch network.`,
      motif,
      renownReward: 180 + tier * 35,
      status: 'active',
      objectives: [
        {
          id: `obj-${slug}-1`,
          description: `Speak with ${primaryNpc.name}`,
          kind: 'talk-npc',
          targetId: primaryNpc.id,
          targetCoords: primaryNpc.position,
          requiredCount: 1,
          currentCount: 0,
        },
        {
          id: `obj-${slug}-2`,
          description: `Attune the ${keepName} Waystone`,
          kind: 'calibrate-beacon',
          targetId: `int-${slug}-waystone`,
          targetCoords: [0, -10.5],
          requiredCount: 1,
          currentCount: 0,
        },
        {
          id: `obj-${slug}-3`,
          description: `Ring the ${basinName} Bell [Bell-Hammer]`,
          kind: 'ring-bell',
          targetId: `int-${slug}-bell`,
          targetCoords: [-25, -8],
          requiredCount: 1,
          currentCount: 0,
        },
      ],
    },
  ];

  const hpScale = 1 + (tier - 1) * 0.16;
  const ePre1 = pick(rng, lex.enemyPrefixes);
  const ePre2 = pick(rng, lex.enemyPrefixes);
  const enemies = [
    makeEnemy(`${slug}-e1`, 'stalker', `${ePre1} Stalker`, 12, -8, Math.round(58 * hpScale)),
    makeEnemy(`${slug}-e2`, 'shardcaster', `${ePre2} Prism-Weaver`, -15, -7, Math.round(54 * hpScale)),
    makeEnemy(`${slug}-e3`, 'colossus', `${root} Boundary Colossus`, 21, 16, Math.round(165 * hpScale)),
    makeEnemy(`${slug}-e4`, 'stalker', `${ePre2} Outrider`, -46, -20, Math.round(64 * hpScale)),
    makeEnemy(`${slug}-e5`, 'shardcaster', `${ePre1} Resonance Caster`, 46, 8, Math.round(62 * hpScale)),
    makeEnemy(`${slug}-e6`, 'stalker', `${root} Gate-Prowler`, 6, -48, Math.round(66 * hpScale)),
  ];

  const soundtrack = synthesizeScoreFromBrief({
    realmSlug: slug,
    realmName: name,
    theme: climate.theme,
    isDungeon: false,
    seed: cellSeed,
  });

  const spec: FrontiersRealmSpec = {
    id: `realm-${slug}`,
    slug,
    name,
    subtitle: `Cell (${cx}, 0, ${cz}) · ${climate.biomeTitle} · Uncharted Frontier`,
    cell: [cx, 0, cz],
    theme: climate.theme,
    seed: cellSeed,
    worldHalfExtent: 112,
    isGenerated: true,
    isProceduralCell: true,
    summary: `A procedurally synthesized Verdant frontier in ${climate.biomeTitle}. Open meridian roads lead north, south, east, and west to neighboring UniverseCells.`,
    skyAssetId: `procedural-${climate.theme}`,
    skyUrl: '',
    glbUrl: `/api/verdant/cell/${cx}/${cz}/world.glb`,
    vdntUrl: `/api/verdant/cell/${cx}/${cz}/world.vdnt`,
    ambientMood: climate.ambientMood,
    skyFallbackRgb: climate.skyFallbackRgb,
    fogRgb: climate.fogRgb,
    spawnPoint: [0, 20.5],
    soundtrack,
    dungeonEntrances: [
      {
        id: `ent-${slug}`,
        dungeonSlug,
        name: dungeonName,
        subtitle: `Tier ${tier} ${climate.biomeTitle} Vault`,
        position: [-14, -34],
        tier,
        style: climate.dungeonStyle,
      },
    ],
    materials: lex.materials,
    terrainProfile: {
      macroAmp: Number((1.7 + rng() * 1.1).toFixed(2)),
      macroFreq: Number((0.042 + rng() * 0.01).toFixed(4)),
      gorgeDepth: Number((3.8 + rng() * 1.4).toFixed(2)),
      gorgeZ: 5.0,
      gorgeWaveAmp: Number((2.4 + rng() * 1.2).toFixed(2)),
      citadelLift: Number((3.6 + rng() * 0.9).toFixed(2)),
      citadelZ: -18,
      coastDip: climate.theme === 'pelagic-spires' || climate.theme === 'sunken-aqueducts' ? 2.8 : 1.4,
      rimStart: 999, // No artificial mountain rim wall
      rimHeight: 0,
      waterLevel:
        climate.theme === 'pelagic-spires'
          ? -0.45
          : climate.theme === 'sunken-aqueducts'
            ? -0.75
            : -1.35,
      hasBridge: true,
      bridgeDeckY: 1.58,
      bridgeZMin: -3.4,
      bridgeZMax: 13.4,
      bridgeHalfWidth: 2.85,
    },
    importedCatalogProps: [],
    regions,
    fastTravelPoints: [
      { regionId: 'southern-terrace', name: `${root} Causeway`, x: 0, z: 17.5 },
      { regionId: 'high-causeway', name: keepName, x: 0, z: -8.5 },
      { regionId: 'northern-watch', name: 'North Frontier Gate', x: 0, z: -76 },
      { regionId: 'western-ruins', name: 'West Monolith Ring', x: -50, z: -18 },
      { regionId: 'eastern-ridge', name: 'East Caravan Camp', x: 48, z: 10 },
    ],
    npcs,
    quests,
    interactables,
    enemies,
  };

  if (!options?.forceProcedural) {
    PROCEDURAL_CELL_CACHE.set(`${worldSeed}:${key}`, spec);
  }
  return spec;
}

/**
 * Synthesizes a linked procedural 3D dungeon for any procedural UniverseCell's dungeon portal.
 */
export function synthesizeProceduralDungeon(parentRealm: FrontiersRealmSpec): FrontiersRealmSpec {
  const entrance = parentRealm.dungeonEntrances[0];
  const dungeonSlug = entrance?.dungeonSlug ?? `${parentRealm.slug}-vault`;
  const dungeonName = entrance?.name ?? `${parentRealm.name} — Deep Vault`;
  const tier = entrance?.tier ?? 2;
  const style = entrance?.style ?? 'catacomb-vault';
  const dSeed = hashStringSeed(`dungeon:${parentRealm.seed}:${dungeonSlug}`);

  const soundtrack = synthesizeScoreFromBrief({
    realmSlug: dungeonSlug,
    realmName: dungeonName,
    theme: parentRealm.theme,
    isDungeon: true,
    seed: dSeed,
  });

  const hpScale = 1 + (tier - 1) * 0.22;
  return {
    id: `realm-${dungeonSlug}`,
    slug: dungeonSlug,
    name: dungeonName,
    subtitle: `Tier ${tier} Vault · Beneath ${parentRealm.name}`,
    cell: [parentRealm.cell[0], -1, parentRealm.cell[2]],
    theme: parentRealm.theme,
    seed: dSeed,
    worldHalfExtent: 42,
    isDungeon: true,
    isGenerated: true,
    isProceduralCell: true,
    parentRealmSlug: parentRealm.slug,
    dungeonStyle: style,
    dungeonTier: tier,
    summary: `A vaulted subterranean Meridian sanctum beneath ${parentRealm.name}.`,
    skyAssetId: `procedural-dungeon-${style}`,
    skyUrl: '',
    glbUrl: `/api/verdant/cell/${parentRealm.cell[0]}/${parentRealm.cell[2]}/dungeon.glb`,
    vdntUrl: `/api/verdant/cell/${parentRealm.cell[0]}/${parentRealm.cell[2]}/dungeon.vdnt`,
    ambientMood: 'foundry',
    skyFallbackRgb: [0.06, 0.08, 0.11],
    fogRgb: [0.09, 0.11, 0.15],
    spawnPoint: [0, 23.0],
    soundtrack,
    dungeonEntrances: [],
    materials: parentRealm.materials,
    terrainProfile: {
      macroAmp: 0,
      macroFreq: 0.05,
      gorgeDepth: 0,
      gorgeZ: 11,
      gorgeWaveAmp: 0,
      citadelLift: 0,
      citadelZ: -24,
      coastDip: 0,
      rimStart: 42,
      rimHeight: 0,
      waterLevel: -4.2,
      hasBridge: true,
      bridgeDeckY: 1.05,
      bridgeZMin: 3.6,
      bridgeZMax: 18.4,
      bridgeHalfWidth: 2.8,
    },
    importedCatalogProps: [],
    regions: [
      { id: 'southern-terrace', name: 'Vault Entry Vestibule', subtitle: 'Ascent Portal', center: [0, 24], radius: 14, ambientMood: 'foundry' },
      { id: 'high-causeway', name: 'Central Seal Rotunda', subtitle: 'Resonant Chamber', center: [0, -5], radius: 16, ambientMood: 'foundry' },
      { id: 'northern-watch', name: 'Sanctum Amphitheater', subtitle: 'Guardian Dais', center: [0, -26], radius: 16, ambientMood: 'foundry' },
    ],
    fastTravelPoints: [{ regionId: 'southern-terrace', name: 'Vault Entry', x: 0, z: 23.0 }],
    npcs: [],
    quests: [],
    interactables: [
      {
        id: `int-${dungeonSlug}-exit`,
        kind: 'dungeon-exit',
        name: `Ascend to ${parentRealm.name}`,
        promptVerb: `Return to ${parentRealm.name}`,
        regionId: 'southern-terrace',
        position: [0, 28.5],
        activated: false,
        targetRealmSlug: parentRealm.slug,
      },
      {
        id: `int-${dungeonSlug}-seal`,
        kind: 'waystone-beacon',
        name: 'Rotunda Keystone Seal',
        promptVerb: 'Attune Keystone Seal',
        regionId: 'high-causeway',
        position: [0, -5.0],
        activated: false,
      },
      {
        id: `int-${dungeonSlug}-chest`,
        kind: 'vault-chest',
        name: 'Sanctum Reliquary Chest',
        promptVerb: 'Unseal Reliquary Chest',
        regionId: 'northern-watch',
        position: [0, -30.5],
        activated: false,
      },
    ],
    enemies: [
      makeEnemy(`${dungeonSlug}-e1`, 'stalker', 'Vault Sentinel', -5.5, -4.0, Math.round(70 * hpScale)),
      makeEnemy(`${dungeonSlug}-e2`, 'shardcaster', 'Crypt Prism-Acolyte', 6.0, -7.5, Math.round(66 * hpScale)),
      makeEnemy(`${dungeonSlug}-boss`, 'colossus', 'Warden of the Deep Meridian', 0, -25.0, Math.round(210 * hpScale)),
    ],
  };
}

/**
 * Returns preview descriptors for the 4 cardinal neighbors around UniverseCell (cx, 0, cz).
 */
export function getAdjacentCellsSummary(
  cx: number,
  cz: number,
  worldSeed = 7777,
): AdjacentCellPreview[] {
  const dirs: Array<{ dir: 'N' | 'S' | 'E' | 'W'; dx: number; dz: number }> = [
    { dir: 'N', dx: 0, dz: -1 },
    { dir: 'S', dx: 0, dz: 1 },
    { dir: 'E', dx: 1, dz: 0 },
    { dir: 'W', dx: -1, dz: 0 },
  ];

  return dirs.map(({ dir, dx, dz }) => {
    const nx = cx + dx;
    const nz = cz + dz;
    const canonical = findCanonicalCell(nx, nz);
    const climate = sampleMacroClimate(nx, nz, worldSeed);
    if (canonical) {
      return {
        dir,
        cell: canonical.cell,
        key: getCellKey(nx, nz),
        slug: canonical.slug,
        name: canonical.name,
        theme: canonical.theme,
        biomeTitle: climate.biomeTitle,
        isCanonical: true,
      };
    }
    const spec = synthesizeUniverseCell(nx, nz, { worldSeed });
    return {
      dir,
      cell: spec.cell,
      key: getCellKey(nx, nz),
      slug: spec.slug,
      name: spec.name,
      theme: spec.theme,
      biomeTitle: climate.biomeTitle,
      isCanonical: false,
    };
  });
}
