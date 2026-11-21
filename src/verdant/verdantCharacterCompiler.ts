import type { GameNpc, GearSlotId } from '../game/worldData';
import type {
  CharacterBeardStyle,
  CharacterClaspKind,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterPropKind,
  CharacterSatchelStyle,
  PlayerCharacterProfile,
  RgbTuple,
  VerdantCharacterAppearance,
} from './verdantCharacterTypes';
import {
  buildPresetToScale,
  getClassSpec,
  getDirectiveSpec,
  getEthnicitySpec,
  getSpeciesSpec,
  hexToLinearRgb,
  renderHdCharacterPortraitSvg,
  resolveNpcCharacterProfile,
} from './verdantCharacterOntology';

export type {
  CharacterBeardStyle,
  CharacterClaspKind,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterPropKind,
  CharacterSatchelStyle,
  PlayerCharacterProfile,
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

function hashGenome(seedText: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic Verdant Character-to-3D Appearance Compiler.
 * Enriches both canonical Vaelmor NPCs and procedurally synthesized outer-realm NPCs
 * with full Species, Ethnicity, Class, Guiding Directive, and High-Definition 3D
 * anatomical traits so 3D rigs, portraits, and dialogue dossiers agree 1:1.
 */
export function compileNpcCharacterAppearance(npc: GameNpc): VerdantCharacterAppearance {
  const npcProfile = resolveNpcCharacterProfile(npc);
  const sp = getSpeciesSpec(npcProfile.speciesId);
  const eth = getEthnicitySpec(npcProfile.speciesId, npcProfile.ethnicityId);
  const cls = getClassSpec(npcProfile.classId);
  const evolutionRank: 1 | 2 | 3 | 4 =
    npcProfile.level >= 12 ? 4 : npcProfile.level >= 8 ? 3 : npcProfile.level >= 4 ? 2 : 1;

  const anatomicalTraits = {
    ...sp.anatomicalDefaults,
    evolutionRank,
  };

  if (npc.appearance) {
    return {
      ...npc.appearance,
      rigId: npc.appearance.rigId || `verdant:rig:${npc.id}`,
      portraitUrl: npc.portraitUrl || npc.appearance.portraitUrl,
      speciesId: npc.appearance.speciesId ?? npcProfile.speciesId,
      ethnicityId: npc.appearance.ethnicityId ?? npcProfile.ethnicityId,
      classId: npc.appearance.classId ?? npcProfile.classId,
      directiveId: npc.appearance.directiveId ?? npcProfile.directiveId,
      anatomicalTraits: npc.appearance.anatomicalTraits ?? anatomicalTraits,
    };
  }

  const url = (npc.portraitUrl || '').toLowerCase();
  const id = (npc.id || '').toLowerCase();
  const cloakOverride = hexToRgb(npc.cloakHex || 0x2f3c48);
  const trimOverride = hexToRgb(npc.trimHex || 0xd4a253);
  const baseSummary = `${sp.name} · ${eth.name} · ${cls.name}`;

  // 1. Magistrate Orenna Vael (Meridian Human · Vaelmor Basalt-Born)
  if (url.includes('orenna') || id.includes('orenna')) {
    const isCanonicalOrenna = id === 'npc-orenna';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'orenna',
      portraitUrl: npc.portraitUrl,
      speciesId: npcProfile.speciesId,
      ethnicityId: npcProfile.ethnicityId,
      classId: npcProfile.classId,
      directiveId: npcProfile.directiveId,
      anatomicalTraits,
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
      genomeSeed: hashGenome(`${npc.id}:orenna`),
      traitSummary: baseSummary,
    };
  }

  // 2. Kaelen of the Salt Loom (Pelagis · Glasswater Spire-Diver)
  if (url.includes('kaelen') || id.includes('kaelen')) {
    const isCanonicalKaelen = id === 'npc-kaelen';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'kaelen',
      portraitUrl: npc.portraitUrl,
      speciesId: npcProfile.speciesId,
      ethnicityId: npcProfile.ethnicityId,
      classId: npcProfile.classId,
      directiveId: npcProfile.directiveId,
      anatomicalTraits,
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
      genomeSeed: hashGenome(`${npc.id}:kaelen`),
      traitSummary: baseSummary,
    };
  }

  // 3. Tarsik the Bell-Maker (Lithborn · Kiln-Strata Forger)
  if (url.includes('tarsik') || id.includes('tarsik')) {
    const isCanonicalTarsik = id === 'npc-tarsik';
    return {
      rigId: `verdant:rig:${npc.id}`,
      portraitArchetype: 'tarsik',
      portraitUrl: npc.portraitUrl,
      speciesId: npcProfile.speciesId,
      ethnicityId: npcProfile.ethnicityId,
      classId: npcProfile.classId,
      directiveId: npcProfile.directiveId,
      anatomicalTraits,
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
      genomeSeed: hashGenome(`${npc.id}:tarsik`),
      traitSummary: baseSummary,
    };
  }

  // 4. Seraia of the Rootward (Sylvan Rootkin · Oakhaven Canopy-Weaver)
  return {
    rigId: `verdant:rig:${npc.id}`,
    portraitArchetype: 'seraia',
    portraitUrl: npc.portraitUrl,
    speciesId: npcProfile.speciesId,
    ethnicityId: npcProfile.ethnicityId,
    classId: npcProfile.classId,
    directiveId: npcProfile.directiveId,
    anatomicalTraits,
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
    genomeSeed: hashGenome(`${npc.id}:seraia`),
    traitSummary: baseSummary,
  };
}

/**
 * Compiles the Player's customized Character Profile (Species, Ethnicity, Class,
 * Guiding Directive, Attire, Hair/Beard, Palettes, Build & Evolution Rank) into
 * the live HD WebGL2 3D Rig & 1:1 painterly SVG portrait!
 */
export function compilePlayerCharacterAppearance(
  activeGear: GearSlotId,
  dodgeActive: boolean,
  profile?: PlayerCharacterProfile | null,
  evolutionRank: 1 | 2 | 3 | 4 = 1,
): VerdantCharacterAppearance {
  if (!profile) {
    return {
      rigId: 'verdant:rig:player-waywright',
      portraitArchetype: 'waywright-hero',
      portraitUrl: '/src/assets/images/ff_world_panorama_1795129454132.jpg',
      speciesId: 'meridian-human',
      ethnicityId: 'vaelmor-basalt',
      classId: 'meridian-surveyor',
      directiveId: 'preserve-arch',
      anatomicalTraits: {
        earShape: 'human',
        browCrest: 'none',
        shoulderCrest: 'none',
        markingRgb: [0.88, 0.7, 0.33],
        hasLuminousVeins: false,
        evolutionRank,
      },
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
      genomeSeed: hashGenome('default:player-waywright'),
      traitSummary: 'Meridian Human · Vaelmor Basalt-Born · Meridian Surveyor',
    };
  }

  const sp = getSpeciesSpec(profile.speciesId);
  const eth = getEthnicitySpec(profile.speciesId, profile.ethnicityId);
  const cls = getClassSpec(profile.classId);
  const dir = getDirectiveSpec(profile.directiveId);
  const garmentBase = hexToLinearRgb(profile.garmentPrimaryHex);
  const garmentRgb: RgbTuple = dodgeActive
    ? blendRgb(garmentBase, [0.46, 0.86, 0.94], 0.48)
    : garmentBase;
  const trimRgb = hexToLinearRgb(profile.trimColorHex);
  const underTunicRgb = hexToLinearRgb(profile.garmentSecondaryHex);
  const leatherRgb = blendRgb(underTunicRgb, [0.36, 0.22, 0.13], 0.55);

  const appearance: VerdantCharacterAppearance = {
    rigId: `verdant:rig:player:${profile.speciesId}:${profile.classId}`,
    portraitArchetype: 'waywright-hero',
    speciesId: profile.speciesId,
    ethnicityId: profile.ethnicityId,
    classId: profile.classId,
    directiveId: profile.directiveId,
    anatomicalTraits: {
      ...sp.anatomicalDefaults,
      evolutionRank,
    },
    garmentStyle: profile.garmentStyle,
    hairStyle: profile.hairStyle,
    beardStyle: profile.beardStyle,
    satchelStyle: profile.satchelStyle,
    signatureProp: activeGear,
    buildScale: buildPresetToScale(profile.buildPreset),
    bareForearms: profile.garmentStyle === 'smith-apron',
    hasHoodDown: profile.hasHoodDown,
    hasPauldrons: profile.hasPauldrons || evolutionRank >= 3,
    skinRgb: hexToLinearRgb(profile.skinColorHex),
    hairRgb: hexToLinearRgb(profile.hairColorHex),
    garmentRgb,
    underTunicRgb,
    trimRgb,
    leatherRgb,
    claspRgb: trimRgb,
    claspKind: cls.claspKind,
    eyeRgb: hexToLinearRgb(profile.eyeColorHex),
    genomeSeed: hashGenome(
      `${profile.name}:${profile.speciesId}:${profile.ethnicityId}:${profile.classId}:${profile.directiveId}:${profile.garmentStyle}:${profile.hairStyle}`,
    ),
    traitSummary: `${sp.name} · ${eth.name} · ${cls.name} · ${dir.name}`,
  };

  appearance.portraitUrl = renderHdCharacterPortraitSvg(appearance, {
    name: profile.name,
    speciesId: profile.speciesId,
    classId: profile.classId,
    evolutionRank,
  });

  return appearance;
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
    speciesId: 'meridian-human',
    ethnicityId: 'vaelmor-basalt',
    classId: 'meridian-surveyor',
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
      `species:${appearance.speciesId ?? 'meridian-human'}`,
      `ethnicity:${appearance.ethnicityId ?? 'vaelmor-basalt'}`,
      `class:${appearance.classId ?? 'meridian-surveyor'}`,
      `garment:${appearance.garmentStyle}`,
      `prop:${appearance.signatureProp}`,
      `realm:${realmSlug}`,
    ],
    propertiesJson: JSON.stringify({
      portraitArchetype: appearance.portraitArchetype,
      portraitUrl: appearance.portraitUrl,
      speciesId: appearance.speciesId ?? 'meridian-human',
      ethnicityId: appearance.ethnicityId ?? 'vaelmor-basalt',
      classId: appearance.classId ?? 'meridian-surveyor',
      directiveId: appearance.directiveId ?? 'preserve-arch',
      garmentStyle: appearance.garmentStyle,
      hairStyle: appearance.hairStyle,
      beardStyle: appearance.beardStyle,
      satchelStyle: appearance.satchelStyle,
      signatureProp: appearance.signatureProp,
      bareForearms: appearance.bareForearms,
      buildScale: appearance.buildScale,
    }),
    commitNote: `Compiled HD portrait-matched 3D character rig for ${npc.name} (${appearance.speciesId ?? 'meridian-human'} · ${appearance.classId ?? 'meridian-surveyor'})`,
  };
}
