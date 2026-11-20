export type CharacterGarmentStyle =
  | 'hooded-cloak'
  | 'oilskin-coat'
  | 'smith-apron'
  | 'herbalist-coat'
  | 'waywright-longcoat'
  | 'guild-waywright'
  | 'archon-vestments'
  | 'ranger-brigandine';

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
  | 'twin-scroll'
  | 'chart-satchel'
  | 'smith-belt'
  | 'herb-satchel'
  | 'waywright-bandolier';

export type CharacterPropKind =
  | 'brass-dividers'
  | 'ledger-quill'
  | 'tuning-fork'
  | 'specimen-jar'
  | 'astrolabe-staff'
  | 'survey-lantern'
  | 'resonance-lute'
  | 'mason-mallet'
  | 'hookblade'
  | 'bellhammer'
  | 'lantern'
  | 'compass'
  | 'none';

export type CharacterClaspKind =
  | 'runic-gold'
  | 'leaf-emerald'
  | 'copper-buckle'
  | 'bronze-crest';

export type RgbTuple = [number, number, number];

export interface VerdantCharacterAppearance {
  rigId: string;
  portraitArchetype:
    | 'orenna'
    | 'kaelen'
    | 'tarsik'
    | 'seraia'
    | 'waywright-hero'
    | 'waywright-peer'
    | 'synthesized';
  portraitUrl: string;
  garmentStyle: CharacterGarmentStyle;
  hairStyle: CharacterHairStyle;
  beardStyle: CharacterBeardStyle;
  satchelStyle: CharacterSatchelStyle;
  signatureProp: CharacterPropKind;
  buildScale: [number, number, number]; // [widthMul, heightMul, depthMul]
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
