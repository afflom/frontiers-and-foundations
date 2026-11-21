/**
 * Verdant Compiled Character Appearance & High-Definition Anatomical Model Schema.
 * Every canonical NPC, synthesized outer-realm NPC, remote co-op Waywright,
 * and the customizable Player Character compiles to this shared contract so
 * 3D WebGL2 rigs, painterly HD portraits, and Model-of-Models nodes agree 1:1.
 */

export type RgbTuple = [number, number, number];

export type CharacterSpeciesId =
  | 'meridian-human'
  | 'lithborn'
  | 'sylvan-rootkin'
  | 'pelagis'
  | 'cinderkin'
  | 'glacian';

export type CharacterClassId =
  | 'meridian-surveyor'
  | 'foundry-bellwright'
  | 'rootward-alchemist'
  | 'tide-loom-sentinel'
  | 'crucible-vanguard'
  | 'frostglass-astromancer';

export type GuidingDirectiveId =
  | 'preserve-arch'
  | 'boundless-horizon'
  | 'living-equilibrium'
  | 'forge-of-merit'
  | 'fellowship-charter'
  | 'harmonic-truth';

export type CharacterAttributeKey =
  | 'vigor'
  | 'resonance'
  | 'wayfinding'
  | 'insight'
  | 'conviction';

export type CharacterAttributes = Record<CharacterAttributeKey, number>;

export type CharacterEarShape = 'human' | 'tapered-leaf' | 'fin-crest' | 'faceted-stone';

export type CharacterBrowCrest =
  | 'none'
  | 'mineral-ridge'
  | 'vine-circlet'
  | 'tidal-markings'
  | 'ember-sigil'
  | 'frost-diadem';

export type CharacterShoulderCrest =
  | 'none'
  | 'quartz-pauldrons'
  | 'living-mantle'
  | 'sea-glass-fins'
  | 'crucible-gorget'
  | 'aurora-halo';

export interface CharacterAnatomicalTraits {
  earShape: CharacterEarShape;
  browCrest: CharacterBrowCrest;
  shoulderCrest: CharacterShoulderCrest;
  /** Emissive or mineral accent tint for species-specific veins, markings, and crests */
  markingRgb: RgbTuple;
  /** Whether species exhibits subtle bioluminescent or geothermal skin seams */
  hasLuminousVeins: boolean;
  /** Evolution rank 1..4 (Initiate, Chartered, Master, Sovereign) unlocking visual mastery trim */
  evolutionRank: 1 | 2 | 3 | 4;
}

export type CharacterPortraitArchetype =
  | 'orenna'
  | 'kaelen'
  | 'tarsik'
  | 'seraia'
  | 'waywright-hero'
  | 'waywright-peer'
  | 'waywright-player'
  | 'synthesized';

export type CharacterGarmentStyle =
  | 'hooded-cloak'
  | 'oilskin-coat'
  | 'smith-apron'
  | 'herbalist-coat'
  | 'archon-vestments'
  | 'ranger-brigandine'
  | 'waywright-longcoat'
  | 'guild-waywright';

export type CharacterHairStyle =
  | 'braided-crown'
  | 'windswept'
  | 'cropped-grey'
  | 'braided-locs'
  | 'waywright-swept'
  | 'scholar-bun'
  | 'twin-braids'
  | 'horned-circlet';

export type CharacterBeardStyle =
  | 'none'
  | 'trimmed-grey'
  | 'full-smith'
  | 'goatee'
  | 'braided-beard';

export type CharacterSatchelStyle =
  | 'none'
  | 'twin-scroll'
  | 'chart-satchel'
  | 'smith-belt'
  | 'herb-satchel'
  | 'waywright-bandolier';

export type CharacterPropKind =
  | 'none'
  | 'brass-dividers'
  | 'ledger-quill'
  | 'tuning-fork'
  | 'specimen-jar'
  | 'hookblade'
  | 'bellhammer'
  | 'lantern'
  | 'compass'
  | 'astrolabe-staff'
  | 'survey-lantern'
  | 'resonance-lute'
  | 'mason-mallet';

export type CharacterClaspKind =
  | 'none'
  | 'runic-gold'
  | 'leaf-emerald'
  | 'copper-buckle'
  | 'bronze-crest';

export interface VerdantCharacterAppearance {
  rigId: string;
  portraitArchetype: CharacterPortraitArchetype;
  portraitUrl?: string;
  /** Species, ethnicity, class & worldview bindings */
  speciesId?: CharacterSpeciesId;
  ethnicityId?: string;
  classId?: CharacterClassId;
  directiveId?: GuidingDirectiveId;
  anatomicalTraits?: CharacterAnatomicalTraits;

  garmentStyle: CharacterGarmentStyle;
  hairStyle: CharacterHairStyle;
  beardStyle: CharacterBeardStyle;
  satchelStyle: CharacterSatchelStyle;
  signatureProp: CharacterPropKind;
  /** Physical proportions [width, height, depth] */
  buildScale: [number, number, number];
  bareForearms: boolean;
  hasHoodDown: boolean;
  hasPauldrons: boolean;
  skinRgb: RgbTuple;
  hairRgb: RgbTuple;
  garmentRgb: RgbTuple;
  underTunicRgb: RgbTuple;
  trimRgb: RgbTuple;
  leatherRgb: RgbTuple;
  claspRgb: RgbTuple;
  claspKind: CharacterClaspKind;
  eyeRgb: RgbTuple;
  genomeSeed?: number;
  traitSummary?: string;
}

export interface PlayerCharacterProfile {
  name: string;
  speciesId: CharacterSpeciesId;
  ethnicityId: string;
  classId: CharacterClassId;
  directiveId: GuidingDirectiveId;
  allocatedAttributes: CharacterAttributes;
  garmentStyle: CharacterGarmentStyle;
  hairStyle: CharacterHairStyle;
  beardStyle: CharacterBeardStyle;
  satchelStyle: CharacterSatchelStyle;
  hasPauldrons: boolean;
  hasHoodDown: boolean;
  buildPreset: 'lithe' | 'balanced' | 'stalwart' | 'towering';
  skinColorHex: string;
  hairColorHex: string;
  eyeColorHex: string;
  garmentPrimaryHex: string;
  garmentSecondaryHex: string;
  trimColorHex: string;
  activeTitle: string;
  updatedAt: number;
}
