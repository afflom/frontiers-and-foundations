import {
  CANONICAL_REALM_SPECS,
  realmSurfaceHeightAt,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';

export type HdExtrapolationPartSlot =
  | 'stage-environment'
  | 'character-rigs'
  | 'hero-props'
  | 'surface-materials'
  | 'spatial-acoustics'
  | 'visual-identity'
  | 'cognitive-language'
  | 'runtime-frameworks';

export interface PrologueVisualAnchorSpec {
  id: string;
  title: string;
  referencePaintings: string[];
  lightingGrammar: {
    sunElevationDeg: number;
    sunAzimuthDeg: number;
    sunRadianceRgb: [number, number, number];
    shadowCoolFloorRgb: [number, number, number];
    lanternWarmRgb: [number, number, number];
    chiaroscuroContrast: number;
  };
  atmosphereGrammar: {
    gorgeMistColorRgb: [number, number, number];
    gorgeMistBaseAltitude: number;
    gorgeMistDensity: number;
    horizonHazeScatter: number;
    bloomStrength: number;
    bloomThreshold: number;
    vignetteStrength: number;
  };
  geometryGrammar: {
    canopyClusterLayers: number;
    canopyColorStratification: number;
    citadelTowerSides: number;
    crenellationEnabled: boolean;
    glowingLancetWindows: boolean;
    hangingBridgeLanterns: boolean;
    contactShadowsEnabled: boolean;
  };
  materialGrammar: {
    normalReliefScale: number;
    pbrAtlasResolution: number;
    creviceAoStrength: number;
    waterFresnelReflectivity: number;
    skinSubsurfaceWrap: number;
  };
}

/**
 * Canonical visual fidelity anchor extracted from the high-resolution
 * 5-Scene Prologue artwork (Vaelmor Parabolic Causeway, Great Foundry Bell,
 * Fracturing Meridian, Waywright Vow, and Living Citadel Dawn).
 * Verdant extrapolates every part of the unified Model-of-Models against this bar.
 */
export const PROLOGUE_HD_VISUAL_ANCHOR: PrologueVisualAnchorSpec = {
  id: 'verdant:anchor:prologue-high-definition-grammar-v1',
  title: 'Prologue Golden-Hour Chiaroscuro & Basalt-Lantern HD Visual Grammar',
  referencePaintings: [
    '/prologue/scene-01-vaelmor-citadel.jpg',
    '/prologue/scene-02-foundry-bell.jpg',
    '/prologue/scene-03-meridian-fracture.jpg',
    '/prologue/scene-04-waywright-vow.jpg',
  ],
  lightingGrammar: {
    sunElevationDeg: 22,
    sunAzimuthDeg: 142,
    sunRadianceRgb: [3.25, 2.38, 1.48],
    shadowCoolFloorRgb: [0.065, 0.095, 0.145],
    lanternWarmRgb: [1.0, 0.64, 0.24],
    chiaroscuroContrast: 1.14,
  },
  atmosphereGrammar: {
    gorgeMistColorRgb: [0.58, 0.62, 0.66],
    gorgeMistBaseAltitude: -0.8,
    gorgeMistDensity: 0.44,
    horizonHazeScatter: 0.36,
    bloomStrength: 0.42,
    bloomThreshold: 0.92,
    vignetteStrength: 0.22,
  },
  geometryGrammar: {
    canopyClusterLayers: 7,
    canopyColorStratification: 3,
    citadelTowerSides: 12,
    crenellationEnabled: true,
    glowingLancetWindows: true,
    hangingBridgeLanterns: true,
    contactShadowsEnabled: true,
  },
  materialGrammar: {
    normalReliefScale: 1.42,
    pbrAtlasResolution: 1024,
    creviceAoStrength: 0.44,
    waterFresnelReflectivity: 0.88,
    skinSubsurfaceWrap: 0.42,
  },
};

export interface HdPointLightAnchor {
  id: string;
  label: string;
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  radius: number;
  flickerHz: number;
  flickerAmp: number;
  sourcePart: HdExtrapolationPartSlot;
}

export interface HdPartExtrapolation {
  partSlot: HdExtrapolationPartSlot;
  modelId: string;
  title: string;
  extrapolatedFidelityScore: number;
  prologueParityRatio: number;
  shaderDirectives: string[];
  geometryDirectives: string[];
  materialDirectives: string[];
  lightingDirectives: string[];
  activeTraits: Record<string, string | number | boolean>;
}

export interface HdShaderUniformPayload {
  sunDir: [number, number, number];
  sunCol: [number, number, number];
  mistRgb: [number, number, number];
  mistDensity: number;
  mistBaseY: number;
  mistFalloff: number;
  exposure: number;
  contrast: number;
  normalRelief: number;
  skyExposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  vignetteStrength: number;
  waterReflectivity: number;
  shadowTint: [number, number, number];
  /** Packed up to 8 dynamic point lights: [x, y, z, radius] * 8 */
  pointLightPosRad: number[];
  /** Packed up to 8 dynamic point lights: [r*I, g*I, b*I] * 8 */
  pointLightColor: number[];
  pointLightCount: number;
}

export interface VerdantHdRenderBlueprint {
  spec: 'verdant/hd-visual-extrapolation-blueprint/1';
  anchorId: string;
  realmSlug: string;
  realmName: string;
  theme: RealmThemeId;
  isDungeon: boolean;
  resolutionTier: 1 | 2 | 3 | 4;
  isSoftwareGl: boolean;
  renderScalePermille: number;
  casSharpnessPermille: number;
  lodRank: number;
  csmShadowFar: number;
  canopyClusterDepth: number;
  architecturalOrnamentTier: number;
  characterSubdivSegments: number;
  contactShadowsEnabled: boolean;
  hangingLanternsEnabled: boolean;
  pointLights: HdPointLightAnchor[];
  shaderUniforms: HdShaderUniformPayload;
  partExtrapolations: Record<HdExtrapolationPartSlot, HdPartExtrapolation>;
  overallFidelityScore: number;
  blueprintDigest: string;
}

export interface HdExtrapolationOptions {
  resolutionTier?: 1 | 2 | 3 | 4;
  isSoftwareGl?: boolean;
  timeSec?: number;
  playerPos?: [number, number, number];
  playerLanternActive?: boolean;
  npcPositions?: Array<{ id: string; position: [number, number] }>;
}

function normalizeVec3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [
    Number((x / l).toFixed(4)),
    Number((y / l).toFixed(4)),
    Number((z / l).toFixed(4)),
  ];
}

function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `hd:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

interface ThemeHdLightingPreset {
  sunDir: [number, number, number];
  sunCol: [number, number, number];
  mistRgb: [number, number, number];
  mistDensity: number;
  mistBaseYOffset: number;
  mistFalloff: number;
  exposure: number;
  contrast: number;
  normalRelief: number;
  skyExposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  vignetteStrength: number;
  waterReflectivity: number;
  shadowTint: [number, number, number];
  lanternRgb: [number, number, number];
}

const THEME_HD_PRESETS: Record<RealmThemeId, ThemeHdLightingPreset> = {
  // Vaelmor: Directly matched to Prologue Scene I — Golden-Hour Basalt Chiaroscuro,
  // warm low amber sun, drifting silver-slate gorge mist, and glowing iron bridge lanterns.
  'citadel-highlands': {
    sunDir: normalizeVec3(0.56, 0.36, 0.74),
    sunCol: [3.25, 2.38, 1.48],
    mistRgb: [0.52, 0.56, 0.62],
    mistDensity: 0.42,
    mistBaseYOffset: 1.6,
    mistFalloff: 0.14,
    exposure: 1.08,
    contrast: 1.12,
    normalRelief: 1.42,
    skyExposure: 0.94,
    bloomStrength: 0.44,
    bloomThreshold: 0.92,
    vignetteStrength: 0.22,
    waterReflectivity: 0.88,
    shadowTint: [0.068, 0.095, 0.142],
    lanternRgb: [1.0, 0.64, 0.24],
  },
  'sunken-aqueducts': {
    sunDir: normalizeVec3(0.48, 0.52, 0.70),
    sunCol: [2.92, 2.66, 1.94],
    mistRgb: [0.34, 0.54, 0.48],
    mistDensity: 0.48,
    mistBaseYOffset: 2.2,
    mistFalloff: 0.12,
    exposure: 1.06,
    contrast: 1.10,
    normalRelief: 1.38,
    skyExposure: 0.98,
    bloomStrength: 0.46,
    bloomThreshold: 0.88,
    vignetteStrength: 0.20,
    waterReflectivity: 0.92,
    shadowTint: [0.055, 0.115, 0.102],
    lanternRgb: [0.44, 0.98, 0.68],
  },
  'obsidian-crucible': {
    sunDir: normalizeVec3(-0.62, 0.30, 0.72),
    sunCol: [3.10, 1.82, 1.08],
    mistRgb: [0.46, 0.24, 0.16],
    mistDensity: 0.46,
    mistBaseYOffset: 2.0,
    mistFalloff: 0.11,
    exposure: 1.10,
    contrast: 1.18,
    normalRelief: 1.52,
    skyExposure: 0.82,
    bloomStrength: 0.54,
    bloomThreshold: 0.84,
    vignetteStrength: 0.26,
    waterReflectivity: 0.76,
    shadowTint: [0.11, 0.062, 0.058],
    lanternRgb: [1.0, 0.42, 0.12],
  },
  'pelagic-spires': {
    sunDir: normalizeVec3(0.64, 0.46, 0.61),
    sunCol: [3.05, 2.74, 2.26],
    mistRgb: [0.46, 0.68, 0.74],
    mistDensity: 0.34,
    mistBaseYOffset: 1.4,
    mistFalloff: 0.16,
    exposure: 1.05,
    contrast: 1.08,
    normalRelief: 1.34,
    skyExposure: 1.06,
    bloomStrength: 0.38,
    bloomThreshold: 0.96,
    vignetteStrength: 0.18,
    waterReflectivity: 0.96,
    shadowTint: [0.06, 0.115, 0.155],
    lanternRgb: [0.36, 0.94, 0.98],
  },
  'amber-steppe': {
    sunDir: normalizeVec3(0.72, 0.28, 0.63),
    sunCol: [3.42, 2.30, 1.24],
    mistRgb: [0.76, 0.56, 0.34],
    mistDensity: 0.38,
    mistBaseYOffset: 1.8,
    mistFalloff: 0.12,
    exposure: 1.06,
    contrast: 1.14,
    normalRelief: 1.46,
    skyExposure: 0.96,
    bloomStrength: 0.40,
    bloomThreshold: 0.94,
    vignetteStrength: 0.22,
    waterReflectivity: 0.82,
    shadowTint: [0.115, 0.082, 0.068],
    lanternRgb: [1.0, 0.78, 0.28],
  },
  'glacial-spire': {
    sunDir: normalizeVec3(-0.46, 0.38, 0.80),
    sunCol: [2.65, 2.78, 3.15],
    mistRgb: [0.56, 0.74, 0.88],
    mistDensity: 0.40,
    mistBaseYOffset: 1.8,
    mistFalloff: 0.13,
    exposure: 1.05,
    contrast: 1.11,
    normalRelief: 1.36,
    skyExposure: 1.02,
    bloomStrength: 0.48,
    bloomThreshold: 0.90,
    vignetteStrength: 0.20,
    waterReflectivity: 0.94,
    shadowTint: [0.068, 0.112, 0.175],
    lanternRgb: [0.48, 0.92, 1.0],
  },
};

/**
 * Extrapolates up to 8 physically-anchored dynamic point lights for any canonical
 * or procedural Realm/Dungeon, aligned 1:1 with hanging bridge lanterns, citadel
 * forge windows, waystones, thermal vents, dungeon braziers, and the Waywright's lantern.
 */
export function extrapolateRealmPointLights(
  spec: FrontiersRealmSpec,
  options: HdExtrapolationOptions = {},
): HdPointLightAnchor[] {
  const preset = THEME_HD_PRESETS[spec.theme] ?? THEME_HD_PRESETS['citadel-highlands'];
  const lr = preset.lanternRgb;
  const lights: HdPointLightAnchor[] = [];

  if (spec.isDungeon) {
    // Subterranean torchlit chiaroscuro — braziers, portal archway, and sanctum beacon
    const brazierSpots: Array<[string, string, number, number, number, [number, number, number], number]> = [
      ['dg-entry-w', 'Entry Brazier West', -4.2, 2.4, 24.0, [1.0, 0.58, 0.20], 3.2],
      ['dg-entry-e', 'Entry Brazier East', 4.2, 2.4, 24.0, [1.0, 0.58, 0.20], 3.2],
      ['dg-bridge-w', 'Chasm Span Lantern W', -3.6, 2.6, 4.0, lr, 3.6],
      ['dg-bridge-e', 'Chasm Span Lantern E', 3.6, 2.6, 4.0, lr, 3.6],
      ['dg-nave-c', 'Vault Nave Censer', 0.0, 3.8, -10.0, [1.0, 0.62, 0.24], 4.2],
      ['dg-sanctum-c', 'Sanctum Seal Beacon', 0.0, 3.4, -26.0, lr, 4.8],
    ];
    for (const [id, label, x, yOff, z, col, intensity] of brazierSpots) {
      const gy = realmSurfaceHeightAt(spec, x, z);
      lights.push({
        id,
        label,
        position: [x, gy + yOff, z],
        color: col,
        intensity,
        radius: 17.5,
        flickerHz: 4.2,
        flickerAmp: 0.14,
        sourcePart: 'stage-environment',
      });
    }
  } else {
    const tp = spec.terrainProfile;
    const deckY = tp.bridgeDeckY;
    // 1. Parabolic Causeway Hanging Iron Lanterns (exact sync with dynamic lantern geometry!)
    if (tp.hasBridge) {
      const bridgeSpots: Array<[string, string, number, number, number]> = [
        ['bridge-lantern-sw', 'Causeway South Pier West', -2.65, deckY + 2.25, 11.2],
        ['bridge-lantern-se', 'Causeway South Pier East', 2.65, deckY + 2.25, 11.2],
        ['bridge-lantern-nw', 'Causeway North Pier West', -2.65, deckY + 2.25, 1.0],
        ['bridge-lantern-ne', 'Causeway North Pier East', 2.65, deckY + 2.25, 1.0],
      ];
      for (let i = 0; i < bridgeSpots.length; i++) {
        const [id, label, x, y, z] = bridgeSpots[i];
        lights.push({
          id,
          label,
          position: [x, y, z],
          color: lr,
          intensity: 3.15,
          radius: 16.5,
          flickerHz: 3.6 + i * 0.45,
          flickerAmp: 0.11,
          sourcePart: 'stage-environment',
        });
      }
    }

    // 2. Citadel Gatehouse Hearth & Glowing Lancet Archway
    const gateY = realmSurfaceHeightAt(spec, 0, -14.0);
    lights.push({
      id: 'citadel-gate-hearth',
      label: 'Citadel Gatehouse Hearth Glow',
      position: [0, gateY + 5.0, -13.6],
      color: [1.0, 0.66, 0.24],
      intensity: 4.1,
      radius: 22.0,
      flickerHz: 2.8,
      flickerAmp: 0.08,
      sourcePart: 'stage-environment',
    });

    // 3. Southern Waywright Outpost / Magistrate Orenna Brass Lantern
    const firstNpc = options.npcPositions?.[0] ?? spec.npcs[0];
    if (firstNpc) {
      const [nx, nz] = firstNpc.position;
      const ny = realmSurfaceHeightAt(spec, nx, nz);
      lights.push({
        id: `npc-lantern-${firstNpc.id}`,
        label: 'Magistrate Brass Survey Lantern',
        position: [nx + 0.35, ny + 1.55, nz + 0.35],
        color: [1.0, 0.72, 0.32],
        intensity: 2.55,
        radius: 12.5,
        flickerHz: 4.1,
        flickerAmp: 0.09,
        sourcePart: 'character-rigs',
      });
    }

    // 4. Primary Waystone / Resonant Landmark Crystal
    const beacon = spec.interactables.find((it) => it.kind === 'waystone-beacon') ?? spec.interactables[0];
    if (beacon) {
      const [bx, bz] = beacon.position;
      const by = realmSurfaceHeightAt(spec, bx, bz);
      lights.push({
        id: `beacon-glow-${beacon.id}`,
        label: `${beacon.name} Harmonic Glow`,
        position: [bx, by + 2.6, bz],
        color: [0.38, 0.94, 0.88],
        intensity: 3.1,
        radius: 16.0,
        flickerHz: 2.1,
        flickerAmp: 0.14,
        sourcePart: 'hero-props',
      });
    }
  }

  // 5. Player's Waywright Mortar Lantern / Dynamic Fill Light (keeps protagonist richly sculpted!)
  if (options.playerPos) {
    const [px, py, pz] = options.playerPos;
    const boost = options.playerLanternActive ? 3.8 : 1.75;
    lights.push({
      id: 'waywright-mortar-lantern',
      label: 'Waywright Mortar Lantern Aura',
      position: [px, py + 1.85, pz],
      color: options.playerLanternActive ? [0.58, 0.98, 0.84] : [1.0, 0.74, 0.38],
      intensity: boost,
      radius: options.playerLanternActive ? 16.5 : 10.5,
      flickerHz: 3.2,
      flickerAmp: 0.07,
      sourcePart: 'hero-props',
    });
  }

  return lights.slice(0, 8);
}

/**
 * Extrapolates concrete HD rendering specifications across all 8 canonical
 * Verdant Cognitive Parts from the Prologue visual grammar and resolution tier.
 */
export function extrapolateAllPartBlueprints(
  tier: 1 | 2 | 3 | 4 = 3,
  theme: RealmThemeId = 'citadel-highlands',
): Record<HdExtrapolationPartSlot, HdPartExtrapolation> {
  const tierFactor = tier >= 4 ? 1.0 : tier === 3 ? 0.94 : tier === 2 ? 0.82 : 0.68;
  const preset = THEME_HD_PRESETS[theme] ?? THEME_HD_PRESETS['citadel-highlands'];
  const score = (base: number) => Math.min(100, Math.round(base * tierFactor * 10) / 10);
  const parity = (base: number) => Math.min(1, Math.round((base * tierFactor) * 1000) / 1000);

  return {
    'stage-environment': {
      partSlot: 'stage-environment',
      modelId: 'frontiers:hd-extrapolation:stage-environment',
      title: 'HD Stage Geomorphology, Architecture & Canopy Extrapolation',
      extrapolatedFidelityScore: score(98),
      prologueParityRatio: parity(0.96),
      shaderDirectives: [
        'golden-hour-directional-csm-3x3-pcf',
        'altitude-modulated-gorge-mist-volumetric-scatter',
        'dynamic-8-point-lantern-hearth-lighting',
      ],
      geometryDirectives: [
        '12-sided-ribbed-citadel-towers-with-crenellations',
        '7-cluster-asymmetrical-stratified-botanical-canopies',
        'parabolic-arch-voussoirs-buttresses-and-hanging-iron-lanterns',
      ],
      materialDirectives: [
        'wet-basalt-gorge-vertex-darkening',
        'sunlit-moss-ridge-color-stratification',
      ],
      lightingDirectives: [
        `sun-radiance:${preset.sunCol.join(',')}`,
        `mist-density:${preset.mistDensity}`,
      ],
      activeTraits: {
        canopyClusterLayers: tier >= 3 ? 7 : 4,
        citadelTowerSides: tier >= 3 ? 12 : 8,
        crenellationEnabled: true,
        glowingLancetWindows: true,
        hangingBridgeLanterns: true,
        gorgeMistDensity: preset.mistDensity,
      },
    },
    'character-rigs': {
      partSlot: 'character-rigs',
      modelId: 'frontiers:hd-extrapolation:character-rigs',
      title: 'HD Sculpted Anatomical Character & Fauna Extrapolation',
      extrapolatedFidelityScore: score(97),
      prologueParityRatio: parity(0.95),
      shaderDirectives: [
        'subsurface-wrap-skin-and-drapery-shading',
        'golden-rim-silhouette-separation',
        'micro-weave-cloth-grain-modulation',
      ],
      geometryDirectives: [
        `smooth-normal-subdiv-segments:${tier >= 4 ? 16 : tier === 3 ? 14 : 10}`,
        'pleated-cloak-hem-collar-drapery-and-layered-pauldrons',
        'grounded-contact-shadow-discs-on-all-actors',
        'refined-miniature-gilded-survey-chevron-indicator',
      ],
      materialDirectives: [
        'sartorial-material-contrast-wool-leather-burnished-brass',
        'portrait-synchronized-skin-hair-and-garment-palettes',
      ],
      lightingDirectives: [
        'handheld-npc-brass-lantern-point-light',
        'waywright-mortar-lantern-fill-light',
      ],
      activeTraits: {
        subdivSegments: tier >= 4 ? 16 : tier === 3 ? 14 : 10,
        contactShadowsEnabled: true,
        skinSubsurfaceWrap: PROLOGUE_HD_VISUAL_ANCHOR.materialGrammar.skinSubsurfaceWrap,
        npcMarkerStyle: 'refined-gilded-chevron',
      },
    },
    'hero-props': {
      partSlot: 'hero-props',
      modelId: 'frontiers:hd-extrapolation:hero-props',
      title: 'HD Hanging Lanterns, Relics & Forge Props Extrapolation',
      extrapolatedFidelityScore: score(96),
      prologueParityRatio: parity(0.94),
      shaderDirectives: [
        'hdr-emissive-core-overdrive-for-bloom-halo',
        'anisotropic-burnished-bronze-ggx-specular',
      ],
      geometryDirectives: [
        'swaying-wrought-iron-bridge-lantern-cages-and-chains',
        'polyhaven-cc0-customized-props-embedded-in-world-glb',
        'harmonic-waystone-crystals-with-orbiting-brass-rings',
      ],
      materialDirectives: [
        'patinated-iron-vs-molten-amber-flame-contrast',
        'metallic-roughness-calibrated-0.24-bronze',
      ],
      lightingDirectives: [
        'point-light-synchronized-hanging-lantern-anchors',
        'flickering-forge-brazier-radiance',
      ],
      activeTraits: {
        hangingLanternCount: 8,
        emissiveHdrMultiplier: 1.85,
        harmonicAuraRings: tier >= 4 ? 2 : 1,
      },
    },
    'surface-materials': {
      partSlot: 'surface-materials',
      modelId: 'frontiers:hd-extrapolation:surface-materials',
      title: 'HD PBR Micro-Relief, Normal Perturbation & Reflective Water Extrapolation',
      extrapolatedFidelityScore: score(98),
      prologueParityRatio: parity(0.96),
      shaderDirectives: [
        `cotangent-frame-normal-perturbation-scale:${preset.normalRelief}`,
        'dual-frequency-fresnel-reflective-gorge-water',
        'screen-space-crevice-ambient-occlusion',
      ],
      geometryDirectives: [
        'world-space-uv-tiling-aligned-to-masonry-courses',
        'terrain-clipped-depth-graded-hydrology-quads',
      ],
      materialDirectives: [
        'polyhaven-cc0-albedo-arm-normal-atlas-channels',
        'anisotropic-filtering-up-to-8x',
      ],
      lightingDirectives: [
        'hdri-equirectangular-ibl-reflection-sampling',
        'water-sun-and-lantern-specular-glints',
      ],
      activeTraits: {
        normalReliefScale: preset.normalRelief,
        pbrAtlasResolution: PROLOGUE_HD_VISUAL_ANCHOR.materialGrammar.pbrAtlasResolution,
        waterFresnelReflectivity: preset.waterReflectivity,
        creviceAoStrength: PROLOGUE_HD_VISUAL_ANCHOR.materialGrammar.creviceAoStrength,
      },
    },
    'spatial-acoustics': {
      partSlot: 'spatial-acoustics',
      modelId: 'frontiers:hd-extrapolation:spatial-acoustics',
      title: 'HD Spatial Acoustics & Visual-Environmental Resonance Sync',
      extrapolatedFidelityScore: score(95),
      prologueParityRatio: parity(0.93),
      shaderDirectives: [
        'lantern-flicker-and-bell-harmonic-pulse-sync',
      ],
      geometryDirectives: [
        'foundry-bell-and-waystone-spatial-emitter-alignment',
      ],
      materialDirectives: [
        'surface-material-footstep-impedance-stone-earth-water',
      ],
      lightingDirectives: [
        'harmonic-pulse-modulation-on-resonating-beacons',
      ],
      activeTraits: {
        binauralPrecision: 'sub-millisecond-itd',
        convolverHallSynced: true,
        acousticVisualSync: true,
      },
    },
    'visual-identity': {
      partSlot: 'visual-identity',
      modelId: 'frontiers:hd-extrapolation:visual-identity',
      title: 'HD Painterly Color Grading, Bloom & Prologue Aesthetic Cohesion',
      extrapolatedFidelityScore: score(99),
      prologueParityRatio: parity(0.97),
      shaderDirectives: [
        'aces-filmic-hdr-tonemapping-with-chiaroscuro-contrast',
        '9-tap-hdr-bright-pass-warm-lantern-bloom',
        'subtle-cinema-vignette-framing',
      ],
      geometryDirectives: [
        'prologue-to-3d-seamless-color-palette-continuity',
      ],
      materialDirectives: [
        'burnished-gold-basalt-slate-silicate-teal-triad',
      ],
      lightingDirectives: [
        `bloom-strength:${preset.bloomStrength}`,
        `exposure:${preset.exposure}`,
      ],
      activeTraits: {
        bloomStrength: preset.bloomStrength,
        bloomThreshold: preset.bloomThreshold,
        vignetteStrength: preset.vignetteStrength,
        acesFilmicActive: true,
        prologueAnchorId: PROLOGUE_HD_VISUAL_ANCHOR.id,
      },
    },
    'cognitive-language': {
      partSlot: 'cognitive-language',
      modelId: 'frontiers:hd-extrapolation:cognitive-language',
      title: 'HD Narrative Staging, Prologue Continuity & Landmark Legibility',
      extrapolatedFidelityScore: score(96),
      prologueParityRatio: parity(0.95),
      shaderDirectives: [
        'diegetic-warm-light-guidance-toward-story-landmarks',
      ],
      geometryDirectives: [
        'citadel-keep-and-parabolic-causeway-match-prologue-scene-1',
        'foundry-bell-pavilion-matches-prologue-scene-2',
      ],
      materialDirectives: [
        'faction-banner-heraldry-and-guild-material-coding',
      ],
      lightingDirectives: [
        'hearth-light-draws-eye-to-magistrate-orenna-and-citadel-gate',
      ],
      activeTraits: {
        prologueScene1SilhouetteMatch: true,
        diegeticGuidanceLighting: true,
        antiTropeVerified: true,
      },
    },
    'runtime-frameworks': {
      partSlot: 'runtime-frameworks',
      modelId: 'frontiers:hd-extrapolation:runtime-frameworks',
      title: 'HD WebGL2 HDR/CSM/Bloom & Verdant WASM Zero-Copy Extrapolation',
      extrapolatedFidelityScore: score(98),
      prologueParityRatio: parity(0.96),
      shaderDirectives: [
        'rgba16f-hdr-framebuffer-with-cas-sharpening-and-bloom',
        'hardware-pcf-shadow-map-with-texel-snapping',
        'software-webgl-safe-single-pass-post-pipeline',
      ],
      geometryDirectives: [
        'zero-copy-wasm-static-world-split-dynamic-batcher',
      ],
      materialDirectives: [
        '4-channel-pbr-atlas-upload-albedo-mr-normal-emissive',
      ],
      lightingDirectives: [
        '8-light-uniform-array-driven-by-verdant-hd-extrapolator',
      ],
      activeTraits: {
        hdrFloatBuffer: true,
        singlePassHdrBloom: true,
        maxDynamicPointLights: 8,
        zeroCopyWasmPipeline: true,
      },
    },
  };
}

/**
 * Primary Verdant HD Extrapolation Entry Point:
 * Extrapolates a complete, deterministic, runtime-ready `VerdantHdRenderBlueprint`
 * for any Realm or Dungeon directly from the Prologue visual grammar and the
 * unified Model-of-Models resolution tier.
 */
export function extrapolateUnifiedHdBlueprint(
  spec: FrontiersRealmSpec = CANONICAL_REALM_SPECS[0],
  options: HdExtrapolationOptions = {},
): VerdantHdRenderBlueprint {
  const resolutionTier = options.resolutionTier ?? 3;
  const isSoftwareGl = Boolean(options.isSoftwareGl);
  const timeSec = options.timeSec ?? 0;

  const basePreset = THEME_HD_PRESETS[spec.theme] ?? THEME_HD_PRESETS['citadel-highlands'];
  const isDungeon = Boolean(spec.isDungeon);

  const pointLights = extrapolateRealmPointLights(spec, options);
  const pointLightPosRad: number[] = new Array(32).fill(0);
  const pointLightColor: number[] = new Array(24).fill(0);

  for (let i = 0; i < Math.min(8, pointLights.length); i++) {
    const l = pointLights[i];
    const flicker =
      1 +
      Math.sin(timeSec * l.flickerHz + i * 1.9) * l.flickerAmp +
      Math.sin(timeSec * (l.flickerHz * 2.3) + i * 0.7) * (l.flickerAmp * 0.45);
    const effI = l.intensity * flicker;
    pointLightPosRad[i * 4 + 0] = l.position[0];
    pointLightPosRad[i * 4 + 1] = l.position[1];
    pointLightPosRad[i * 4 + 2] = l.position[2];
    pointLightPosRad[i * 4 + 3] = l.radius;
    pointLightColor[i * 3 + 0] = l.color[0] * effI;
    pointLightColor[i * 3 + 1] = l.color[1] * effI;
    pointLightColor[i * 3 + 2] = l.color[2] * effI;
  }

  const waterY = spec.terrainProfile.waterLevel;
  const tierScale = resolutionTier >= 4 ? 1.0 : resolutionTier === 3 ? 0.96 : 0.85;

  const shaderUniforms: HdShaderUniformPayload = {
    sunDir: isDungeon ? normalizeVec3(0.35, 0.82, 0.44) : basePreset.sunDir,
    sunCol: isDungeon
      ? [0.68, 0.56, 0.44]
      : [
          Number((basePreset.sunCol[0] * tierScale).toFixed(3)),
          Number((basePreset.sunCol[1] * tierScale).toFixed(3)),
          Number((basePreset.sunCol[2] * tierScale).toFixed(3)),
        ],
    mistRgb: isDungeon ? [0.09, 0.08, 0.11] : basePreset.mistRgb,
    mistDensity: isDungeon ? 0.52 : basePreset.mistDensity,
    mistBaseY: isDungeon ? -3.0 : waterY + basePreset.mistBaseYOffset,
    mistFalloff: isDungeon ? 0.09 : basePreset.mistFalloff,
    exposure: isDungeon ? 1.14 : basePreset.exposure,
    contrast: isDungeon ? 1.18 : basePreset.contrast,
    normalRelief: Number((basePreset.normalRelief * (resolutionTier >= 4 ? 1.08 : 1.0)).toFixed(3)),
    skyExposure: isDungeon ? 0.25 : basePreset.skyExposure,
    bloomStrength: Number((basePreset.bloomStrength * (isDungeon ? 1.25 : 1.0)).toFixed(3)),
    bloomThreshold: isDungeon ? 0.78 : basePreset.bloomThreshold,
    vignetteStrength: isDungeon ? 0.32 : basePreset.vignetteStrength,
    waterReflectivity: basePreset.waterReflectivity,
    shadowTint: isDungeon ? [0.035, 0.032, 0.048] : basePreset.shadowTint,
    pointLightPosRad,
    pointLightColor,
    pointLightCount: pointLights.length,
  };

  const partExtrapolations = extrapolateAllPartBlueprints(resolutionTier, spec.theme);
  const partValues = Object.values(partExtrapolations);
  const overallFidelityScore =
    Math.round(
      (partValues.reduce((acc, p) => acc + p.extrapolatedFidelityScore, 0) / partValues.length) * 10,
    ) / 10;

  const renderScalePermille = isSoftwareGl
    ? resolutionTier >= 4
      ? 960
      : 920
    : 1000;
  const casSharpnessPermille = resolutionTier >= 4 ? 440 : 360;
  const lodRank = isSoftwareGl ? 2 : 3;

  const blueprintDigest = fnv1aHex(
    `${PROLOGUE_HD_VISUAL_ANCHOR.id}|${spec.slug}|${spec.theme}|t${resolutionTier}|l${pointLights.length}|f${overallFidelityScore}`,
  );

  return {
    spec: 'verdant/hd-visual-extrapolation-blueprint/1',
    anchorId: PROLOGUE_HD_VISUAL_ANCHOR.id,
    realmSlug: spec.slug,
    realmName: spec.name,
    theme: spec.theme,
    isDungeon,
    resolutionTier,
    isSoftwareGl,
    renderScalePermille,
    casSharpnessPermille,
    lodRank,
    csmShadowFar: isDungeon ? 32 : 42,
    canopyClusterDepth: resolutionTier >= 3 ? 7 : 4,
    architecturalOrnamentTier: resolutionTier >= 3 ? 3 : 2,
    characterSubdivSegments: resolutionTier >= 4 ? 16 : resolutionTier === 3 ? 14 : 10,
    contactShadowsEnabled: true,
    hangingLanternsEnabled: !isDungeon,
    pointLights,
    shaderUniforms,
    partExtrapolations,
    overallFidelityScore,
    blueprintDigest,
  };
}
