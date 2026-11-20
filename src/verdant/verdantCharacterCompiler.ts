import type { GameNpc, GearSlotId } from '../game/worldData';
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

export type {
  CharacterBeardStyle,
  CharacterClaspKind,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterPropKind,
  CharacterSatchelStyle,
  RgbTuple,
  VerdantCharacterAppearance,
};

function hexToRgb(hex: number): RgbTuple {
  return [
    Math.max(0.03, ((hex >> 16) & 255) / 255),
    Math.max(0.03, ((hex >> 8) & 255) / 255),
    Math.max(0.03, (hex & 255) / 255),
  ];
}

function blendRgb(a: RgbTuple, b: RgbTuple, t: number): RgbTuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Deterministic Verdant Character-to-3D Appearance Compiler.
 * For procedurally synthesized NPCs carrying a VerdantCharacterAppearance genome,
 * returns their exact synthesized traits 1:1 (guaranteeing portrait-to-3D parity).
 * For canonical Vaelmor NPCs, maps their portrait artwork faithfully to HD 3D rigs.
 */
export function compileNpcCharacterAppearance(npc: GameNpc): VerdantCharacterAppearance {
  if (npc.appearance) {
    return {
      ...npc.appearance,
      rigId: npc.appearance.rigId || `verdant:rig:${npc.id}`,
      portraitUrl: npc.portraitUrl || npc.appearance.portraitUrl,
    };
  }

  const url = (npc.portraitUrl || '').toLowerCase();
  const id = (npc.id || '').toLowerCase();
  const cloakOverride = hexToRgb(npc.cloakHex || 0x2f3c48);
  const trimOverride = hexToRgb(npc.trimHex || 0xd4a253);

  // 1. Magistrate Orenna Vael portrait archetype (ff_npc_orenna)
  if (url.includes('orenna') || id.includes('orenna')) {
    const isCanonicalOrenna = id === 'npc-orenna';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'orenna',
      portraitUrl: npc.portraitUrl,
      garmentStyle: 'hooded-cloak',
      hairStyle: 'braided-crown',
      beardStyle: 'none',
      satchelStyle: 'twin-scroll',
      signatureProp: 'brass-dividers',
      buildScale: [0.96, 1.0, 0.96],
      bareForearms: false,
      hasHoodDown: true,
      hasPauldrons: false,
      skinRgb: [0.82, 0.62, 0.49],
      hairRgb: [0.68, 0.67, 0.66],
      garmentRgb: isCanonicalOrenna ? [0.19, 0.24, 0.29] : blendRgb([0.19, 0.24, 0.29], cloakOverride, 0.42),
      underTunicRgb: [0.37, 0.25, 0.17],
      trimRgb: isCanonicalOrenna ? [0.84, 0.66, 0.28] : blendRgb([0.84, 0.66, 0.28], trimOverride, 0.35),
      leatherRgb: [0.42, 0.26, 0.15],
      claspRgb: [0.88, 0.71, 0.3],
      claspKind: 'runic-gold',
      eyeRgb: [0.24, 0.2, 0.16],
    };
  }

  // 2. Kaelen of the Salt Loom portrait archetype (ff_npc_kaelen)
  // Windswept silver-grey hair & beard, weathered sea-green oilskin coat with
  // wide upturned collar & capelet, copper-wrapped bracers, chart satchel, open ledger & golden quill.
  if (url.includes('kaelen') || id.includes('kaelen')) {
    const isCanonicalKaelen = id === 'npc-kaelen';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'kaelen',
      portraitUrl: npc.portraitUrl,
      garmentStyle: 'oilskin-coat',
      hairStyle: 'windswept',
      beardStyle: 'trimmed-grey',
      satchelStyle: 'chart-satchel',
      signatureProp: 'ledger-quill',
      buildScale: [1.04, 1.04, 1.02],
      bareForearms: false,
      hasHoodDown: false,
      hasPauldrons: false,
      skinRgb: [0.78, 0.56, 0.45],
      hairRgb: [0.62, 0.63, 0.65],
      garmentRgb: isCanonicalKaelen ? [0.18, 0.33, 0.29] : blendRgb([0.18, 0.33, 0.29], cloakOverride, 0.38),
      underTunicRgb: [0.42, 0.38, 0.32],
      trimRgb: [0.76, 0.45, 0.24],
      leatherRgb: [0.38, 0.23, 0.14],
      claspRgb: [0.78, 0.48, 0.25],
      claspKind: 'copper-buckle',
      eyeRgb: [0.22, 0.32, 0.36],
    };
  }

  // 3. Tarsik the Bell-Maker portrait archetype (ff_npc_tarsik)
  // Broad-shouldered stocky master smith, cropped grey hair + thick grey beard,
  // charcoal rolled-sleeve tunic, bare muscular forearms + leather cuffs,
  // burnished chestnut leather blacksmith apron, holding a golden tuning fork.
  if (url.includes('tarsik') || id.includes('tarsik')) {
    const isCanonicalTarsik = id === 'npc-tarsik';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'tarsik',
      portraitUrl: npc.portraitUrl,
      garmentStyle: 'smith-apron',
      hairStyle: 'cropped-grey',
      beardStyle: 'full-smith',
      satchelStyle: 'smith-belt',
      signatureProp: 'tuning-fork',
      buildScale: [1.18, 1.03, 1.14],
      bareForearms: true,
      hasHoodDown: false,
      hasPauldrons: false,
      skinRgb: [0.79, 0.55, 0.44],
      hairRgb: [0.64, 0.64, 0.65],
      garmentRgb: isCanonicalTarsik ? [0.19, 0.2, 0.22] : blendRgb([0.19, 0.2, 0.22], cloakOverride, 0.32),
      underTunicRgb: [0.16, 0.17, 0.19],
      trimRgb: [0.88, 0.69, 0.29],
      leatherRgb: isCanonicalTarsik ? [0.44, 0.25, 0.14] : blendRgb([0.44, 0.25, 0.14], cloakOverride, 0.25),
      claspRgb: [0.74, 0.58, 0.34],
      claspKind: 'copper-buckle',
      eyeRgb: [0.22, 0.22, 0.24],
    };
  }

  // 4. Seraia of the Rootward portrait archetype (ff_npc_seraia)
  // Deep warm umber skin, long dark braided locs tied back, sage-moss green embroidered
  // high-collar herbalist coat, brown-and-gold trimmed cuffs/pauldrons, leaf clasp,
  // leather vial satchel, holding a glowing cyan-amber bioluminescent specimen jar.
  return {
    rigId: `verdant:rig:${npc.id}`,
    portraitArchetype: 'seraia',
    portraitUrl: npc.portraitUrl,
    garmentStyle: 'herbalist-coat',
    hairStyle: 'braided-locs',
    beardStyle: 'none',
    satchelStyle: 'herb-satchel',
    signatureProp: 'specimen-jar',
    buildScale: [0.95, 1.0, 0.95],
    bareForearms: false,
    hasHoodDown: false,
    hasPauldrons: false,
    skinRgb: [0.51, 0.33, 0.23],
    hairRgb: [0.15, 0.11, 0.09],
    garmentRgb: id === 'npc-seraia' ? [0.31, 0.43, 0.33] : blendRgb([0.31, 0.43, 0.33], cloakOverride, 0.36),
    underTunicRgb: [0.21, 0.25, 0.22],
    trimRgb: [0.78, 0.62, 0.31],
    leatherRgb: [0.45, 0.29, 0.16],
    claspRgb: [0.34, 0.64, 0.28],
    claspKind: 'leaf-emerald',
    eyeRgb: [0.36, 0.22, 0.11],
  };
}

export function compilePlayerCharacterAppearance(
  activeGear: GearSlotId,
  dodgeActive: boolean,
): VerdantCharacterAppearance {
  return {
    rigId: 'verdant:rig:player-waywright',
    portraitArchetype: 'waywright-hero',
    portraitUrl: '/src/assets/images/ff_world_panorama_1795129454132.jpg',
    garmentStyle: 'waywright-longcoat',
    hairStyle: 'waywright-swept',
    beardStyle: 'none',
    satchelStyle: 'waywright-bandolier',
    signatureProp: activeGear,
    buildScale: [1.04, 1.05, 1.02],
    bareForearms: false,
    hasHoodDown: false,
    hasPauldrons: true,
    skinRgb: [0.81, 0.61, 0.49],
    hairRgb: [0.17, 0.14, 0.12],
    garmentRgb: dodgeActive ? [0.34, 0.58, 0.66] : [0.17, 0.26, 0.36],
    underTunicRgb: [0.28, 0.22, 0.18],
    trimRgb: [0.88, 0.7, 0.33],
    leatherRgb: [0.36, 0.22, 0.13],
    claspRgb: [0.92, 0.74, 0.34],
    claspKind: 'bronze-crest',
    eyeRgb: [0.2, 0.28, 0.34],
  };
}

export function compileRemoteWaywrightAppearance(
  playerId: string,
  guildId: string | undefined,
  activeGear: GearSlotId,
): VerdantCharacterAppearance {
  const guildColors: Record<string, RgbTuple> = {
    'guild-basalt': [0.24, 0.36, 0.46],
    'guild-rootward': [0.24, 0.44, 0.34],
    'guild-foundry': [0.48, 0.26, 0.19],
    'guild-loom': [0.2, 0.42, 0.46],
  };
  const garmentRgb = (guildId && guildColors[guildId]) || [0.22, 0.46, 0.42];
  return {
    rigId: `verdant:rig:remote:${playerId}`,
    portraitArchetype: 'waywright-peer',
    portraitUrl: '/src/assets/images/ff_world_panorama_1795129454132.jpg',
    garmentStyle: 'guild-waywright',
    hairStyle: 'waywright-swept',
    beardStyle: 'none',
    satchelStyle: 'waywright-bandolier',
    signatureProp: activeGear,
    buildScale: [1.02, 1.03, 1.0],
    bareForearms: false,
    hasHoodDown: true,
    hasPauldrons: true,
    skinRgb: [0.76, 0.56, 0.45],
    hairRgb: [0.26, 0.2, 0.16],
    garmentRgb,
    underTunicRgb: [0.24, 0.22, 0.2],
    trimRgb: [0.86, 0.72, 0.36],
    leatherRgb: [0.34, 0.21, 0.13],
    claspRgb: [0.88, 0.74, 0.38],
    claspKind: 'bronze-crest',
    eyeRgb: [0.22, 0.24, 0.26],
  };
}

/**
 * Produces the exact Verdant WASM Project Model JSON payload for registering
 * a compiled portrait-matched CharacterRig into `verdant-uorc.wasm` via
 * `verdant_wasm_import_project_model_io`.
 */
export function buildCharacterProjectModelPayload(
  npc: GameNpc,
  appearance: VerdantCharacterAppearance,
  realmSlug: string,
): Record<string, unknown> {
  return {
    modelId: `frontiers:character:${realmSlug}:${npc.id}`,
    title: `${npc.name} — HD Portrait-Matched Rig`,
    schemaType: 'CharacterRig',
    mediaType: 'application/vnd.verdant.character-rig+json',
    targetSlot: 'character-actor',
    sourceStream: 'verdant-portrait-compiler',
    sourceUri: `urn:frontiers:character:${realmSlug}:${npc.id}`,
    licenseSpdx: 'CC0-1.0',
    tags: [
      'character-rig',
      'hd-smooth-normals',
      `portrait:${appearance.portraitArchetype}`,
      `garment:${appearance.garmentStyle}`,
      `prop:${appearance.signatureProp}`,
      `realm:${realmSlug}`,
    ],
    propertiesJson: JSON.stringify({
      portraitArchetype: appearance.portraitArchetype,
      portraitUrl: appearance.portraitUrl,
      garmentStyle: appearance.garmentStyle,
      hairStyle: appearance.hairStyle,
      beardStyle: appearance.beardStyle,
      satchelStyle: appearance.satchelStyle,
      signatureProp: appearance.signatureProp,
      bareForearms: appearance.bareForearms,
      buildScale: appearance.buildScale,
    }),
    commitNote: `Compiled HD portrait-matched 3D character rig for ${npc.name} (${appearance.portraitArchetype})`,
  };
}
