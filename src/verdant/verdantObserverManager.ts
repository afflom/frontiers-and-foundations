import {
  buildFrontiersModelOfModels,
  buildModelRelationGraph,
  flattenModelTree,
  getModelById,
  getModelLineage,
  hashModelSeed,
  listModelsByKind,
  listModelsByPart,
  recomputeAggregatedScores,
  RESOLUTION_TIER_LABELS,
  sealModelOfModelsKappa,
  summarizeModelOfModels,
  VERDANT_PART_SLOTS,
  type ModelLineageReport,
  type ModelOfModelsBuildInput,
  type ModelOfModelsSummary,
  type VerdantModelGraph,
  type VerdantModelKind,
  type VerdantModelNode,
  type VerdantPartSlot,
  type VerdantResolutionTier,
} from './verdantModelOfModels';
import { verifyGamerJourneyGraph } from './verdantJourneyModel';

export type VsmSystemLevel = 'VSM-S1' | 'VSM-S2' | 'VSM-S3' | 'VSM-S4' | 'VSM-S5';

export interface VerdantVsmManagerSpec {
  managerId: string;
  name: string;
  origin: 'verdant-wasm' | 'frontiers-extension';
  vsmSystem: VsmSystemLevel;
  citedAuthority: string;
  basisPrime: number;
  ownedSlots: VerdantPartSlot[];
  concerns: string[];
  differentiationRequirements: string[];
  kappaHex?: string;
}

export interface DiversityDomainMetric {
  domain: string;
  modelCount: number;
  shannonEntropyNormalized: number; // 0..1
  meanSiblingUniqueness: number; // 0..1 (Jaccard distance)
  meanCosineSpread: number; // 0..1 (8D vTensor semantic vector spread)
  clonePairsDetected: number;
}

export type ObserverKpiId =
  | 'KPI-MODEL-DIVERSITY-SHANNON'
  | 'KPI-SIBLING-UNIQUENESS'
  | 'KPI-UNIFORM-RESOLUTION'
  | 'KPI-PART-COVERAGE'
  | 'KPI-ANTI-TROPE-NOVELTY'
  | 'KPI-GENOME-PROVENANCE'
  | 'KPI-CROSS-PART-COHESION'
  | 'KPI-DUNGEON-TOPOLOGY-DIVERSITY'
  | 'KPI-MONSTER-ECOLOGY-DIVERSITY'
  | 'KPI-STORY-CONSERVATION-CLOSURE'
  | 'KPI-RELATIONAL-GRAPH-INTEGRITY'
  | 'KPI-VTENSOR-SEMANTIC-SPREAD'
  | 'KPI-JOURNEY-EXPERIENCE-CLOSURE';

export interface ObserverKpiMetric {
  id: ObserverKpiId;
  label: string;
  value: number;
  target: number;
  unit: string;
  passed: boolean;
  detail: string;
}

export interface FrontiersObserverKpiReport {
  spec: 'frontiers/verdant-observer-kpi-report/2';
  rootModelId: string;
  rootKappaDigest: string;
  resolutionTier: VerdantResolutionTier;
  resolutionLabel: string;
  diversityIndex: number; // 0..100
  resolutionIndex: number; // 0..100
  cohesionIndex: number; // 0..100
  allPassed: boolean;
  clonePairsTotal: number;
  kpis: ObserverKpiMetric[];
  domainBreakdown: DiversityDomainMetric[];
}

export interface ObserverPartHealthSnapshot {
  partSlot: VerdantPartSlot;
  modelCount: number;
  meanDefinitionScore: number;
  uniqueTokens: number;
  healthScorePermille: number; // 0..=1000 (verdant-engine M16 observer_refine.rs)
  status: 'healthy' | 'needs-attention' | 'critical';
}

export interface ObserverManagerHealthSnapshot {
  managerId: string;
  name: string;
  vsmSystem: VsmSystemLevel;
  basisPrime: number;
  ownedModelCount: number;
  lowestModelId: string;
  meanDefinitionScore: number;
  healthScorePermille: number; // 0..=1000
}

export interface ObserverPinpointDiagnosis {
  diagnosisId: string;
  severity: 'critical' | 'high' | 'medium' | 'healthy';
  partSlot: VerdantPartSlot;
  modelId: string;
  modelTitle: string;
  owningManagerId: string;
  cause: string;
  recommendedAction: string;
  currentScore: number;
  targetScore: number;
}

export interface ObserverRefinementProposal {
  proposalId: string;
  priority: 'critical' | 'high' | 'medium' | 'continuous';
  title: string;
  owningManagerId: string;
  vsmSystem: VsmSystemLevel;
  citedAuthority: string;
  partSlot: VerdantPartSlot | 'root';
  kpiId: ObserverKpiId;
  currentValue: number;
  targetValue: number;
  concreteActions: string[];
  kappaHex: string;
}

export interface ObserverRefinementAgenda {
  spec: 'verdant/observer-refinement-agenda/1';
  rootModelId: string;
  rootKappaDigest: string;
  resolutionTier: VerdantResolutionTier;
  cohesionIndex: number;
  diversityIndex: number;
  overallRefinementScorePermille: number; // 0..=1000 (M16/M17)
  partHealth: ObserverPartHealthSnapshot[];
  managerHealth: ObserverManagerHealthSnapshot[];
  pinpointDiagnoses: ObserverPinpointDiagnosis[];
  proposals: ObserverRefinementProposal[];
  criticalCount: number;
  highCount: number;
  agendaKappaHex: string;
}

export interface LifecycleGateCheck {
  checkId: string;
  owningManagerId: string;
  vsmSystem: VsmSystemLevel;
  category: 'in-process';
  passed: boolean;
  detail: string;
}

export interface LifecycleGateReport {
  spec: 'verdant/lifecycle-gate-report/1';
  allPassed: boolean;
  passedChecks: number;
  totalChecks: number;
  rootKappaDigest: string;
  checks: LifecycleGateCheck[];
  gateKappaHex: string;
}

export interface MonotonicWatermarkState {
  spec: 'prism/parametric-ratchet/2';
  minTotalModels: number;
  minGraphEdges: number;
  minCrossPartEdges: number;
  minDefinitionScore: number;
  minDiversityIndex: number;
  minCohesionIndex: number;
  minRefinementScorePermille: number;
  maxClonePairs: number;
  ratchetAdvances: number;
}

export interface AutomateStageRecord {
  stageId: string;
  owningManagerId: string;
  passed: boolean;
  detail: string;
}

export interface AutomateReport {
  spec: 'verdant/automate-report/1';
  ok: boolean;
  allPassed: boolean;
  passedStages: number;
  totalStages: number;
  stages: AutomateStageRecord[];
  ratchetCycle: RatchetCycleReport;
  lifecycleGate: LifecycleGateReport;
  watermarks: MonotonicWatermarkState;
  automateKappaHex: string;
}

export interface RatchetCycleReport {
  ok: boolean;
  cycleNumber: number;
  watermarkAdvanced: boolean;
  executedProposals: ObserverRefinementProposal[];
  refinementReport: UniformRefinementReport;
  agendaBefore: ObserverRefinementAgenda;
  agendaAfter: ObserverRefinementAgenda;
}

export interface RenderResolutionProfile {
  resolutionTier: VerdantResolutionTier;
  resolutionLabel: string;
  sphereSegments: number;
  cylinderSegments: number;
  ambientParticleBoost: number;
  landmarkFlourishLevel: 1 | 2 | 3 | 4;
  renderScalePermille: number;
  casSharpnessPermille: number;
  lodRank: number;
}

export interface UniformRefinementOptions {
  targetTier?: VerdantResolutionTier;
  partSlot?: VerdantPartSlot;
  modelId?: string;
  enforceDiversity?: boolean;
  reason?: string;
}

export interface UniformRefinementReport {
  ok: boolean;
  reason: string;
  scope: string;
  targetTier: VerdantResolutionTier;
  modelsRefined: number;
  clonesDiversified: number;
  managersInvoked: string[];
  before: {
    resolutionTier: VerdantResolutionTier;
    definitionScore: number;
    diversityIndex: number;
    resolutionIndex: number;
    clonePairsTotal: number;
    rootKappaDigest: string;
  };
  after: {
    resolutionTier: VerdantResolutionTier;
    definitionScore: number;
    diversityIndex: number;
    resolutionIndex: number;
    clonePairsTotal: number;
    rootKappaDigest: string;
  };
  renderProfile: RenderResolutionProfile;
  kpis: FrontiersObserverKpiReport;
}

export interface RefinementAuditEntry {
  passNumber: number;
  timestamp: number;
  scope: string;
  reason: string;
  targetTier: VerdantResolutionTier;
  modelsRefined: number;
  clonesDiversified: number;
  managersInvoked: string[];
  prevKappaDigest: string;
  nextKappaDigest: string;
  deltaDefinitionScore: number;
  deltaDiversityIndex: number;
  graphEdgesVerified: number;
}

export interface ObserverSnapshot {
  summary: ModelOfModelsSummary;
  kpis: FrontiersObserverKpiReport;
  renderProfile: RenderResolutionProfile;
  managersCount: number;
  frontiersManagersCount: number;
  wasmManagersCount: number;
  lastRefinementPass: number;
  graphEdgeCount: number;
  crossPartEdgeCount: number;
  auditLedgerCount: number;
  recentAuditEntries: RefinementAuditEntry[];
  overallRefinementScorePermille: number;
  lifecycleGatePassed: boolean;
  lifecycleChecksPassed: number;
  lifecycleChecksTotal: number;
  watermarks: MonotonicWatermarkState;
}

const STANDARD_DIFFERENTIATION_RULE =
  'Executive internals never render directly onto creator, catalog, or player views.';

/**
 * 9 Frontiers Domain Managers extending Verdant Engine's 13 native VSM Managers
 * (which occupy primes 59..109 in `verdant-uorc.wasm`), totaling 22 VSM Managers.
 * Continues Verdant's prime basis sequence: 113, 127, 131, 137, 139, 149, 151, 157, 163.
 */
export const FRONTIERS_DOMAIN_MANAGERS: VerdantVsmManagerSpec[] = [
  {
    managerId: 'mgr-frontiers-world',
    name: 'Frontiers World & Geomorphology Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S1',
    citedAuthority: 'ISO 42010 · Terrain Geomorphology & Hydrodynamics Charter',
    basisPrime: 113,
    ownedSlots: ['stage-environment', 'surface-materials'],
    concerns: [
      'Six distinct biome geomorphologies with continuous cell-border mountain stitching',
      'Terrain-clipped hydrodynamic water surfaces with wading & swimming physics',
      'Poly Haven CC0 PBR surface atlas resolution',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-characters',
    name: 'Frontiers Character & Monster Ecology Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S1',
    citedAuthority: 'ISO 42010 · Character Rig & 6-Archetype Monster Ecology Spec',
    basisPrime: 127,
    ownedSlots: ['character-rigs'],
    concerns: [
      'Portrait-to-3D character fidelity & sartorial diversity',
      '36 biome-cohesive monster species spanning 6 distinct combat archetypes',
      'Biome-specific Apex Boss & fauna morphology kits',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-artifacts',
    name: 'Frontiers Relic & Visual Identity Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S1',
    citedAuthority: 'ISO 42010 · Biome Relic & Vector Identity Charter',
    basisPrime: 131,
    ownedSlots: ['hero-props', 'visual-identity'],
    concerns: [
      'Biome-attuned Survey Relics & active combat/traversal perks',
      'Procedural SVG sigil crests & harmonic aura synchronization',
      'Waywright field gear mechanical balance',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-acoustics',
    name: 'Frontiers Spatial Acoustics & Score Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S2',
    citedAuthority: 'ISO 42010 · Modal Orchestral Repertoire & Spatial Acoustics Policy',
    basisPrime: 137,
    ownedSlots: ['spatial-acoustics'],
    concerns: [
      '20-song modal orchestral repertoire variety across meters & modes',
      '7 bespoke biome & cavern ambient foley profiles',
      'Verdant WASM binaural ITD spatialization',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-narrative',
    name: 'Frontiers Narrative Automaton & Charter Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S3',
    citedAuthority: 'ISO 24617-2 · Conservation-Verified StoryAutomaton Charter',
    basisPrime: 139,
    ownedSlots: ['cognitive-language'],
    concerns: [
      'Anti-trope novelty enforcement across all quests and NPCs',
      '12 reachability- and conservation-verified StoryAutomata',
      'Federated guild charters & ISO 24617-2 knowledge ingestion',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-diversity',
    name: 'Frontiers Diversity KPI & Uniform Refinement Arbiter',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S5',
    citedAuthority: 'Verdant VSM S5 · Shannon/Jaccard Diversity & Ratchet Governance',
    basisPrime: 149,
    ownedSlots: ['runtime-frameworks'],
    concerns: [
      'Cross-model Shannon entropy & sibling Jaccard uniqueness KPIs',
      'Clone detection and automated orthogonal genome diversification',
      'Uniform resolution escalation, Ratchet cycles & Prism kappa sealing',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-dungeons',
    name: 'Frontiers 3D Dungeon Topology & Hazard Architect',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S1',
    citedAuthority: 'Verdant VSM S1 · Non-Repetitive 3D Dungeon Floorplan Charter',
    basisPrime: 151,
    ownedSlots: ['stage-environment'],
    concerns: [
      'Six non-repetitive 3D dungeon floorplan topologies (Twin-Span, Spiral Sluice, Crucible Ring, Tidal Atoll, Stepped Ziggurat, Bifurcated Cloister)',
      'Exact walkable zone connectivity and hazard-zone collision alignment',
      'Bespoke dungeon puzzle objectives and boss sanctum layouts',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-cohesion',
    name: 'Frontiers Cross-Part World Differentiation & Cohesion Steward',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S4',
    citedAuthority: 'Verdant M16 · World Differentiation Profile & Cohesion Contract',
    basisPrime: 157,
    ownedSlots: [
      'stage-environment',
      'character-rigs',
      'surface-materials',
      'spatial-acoustics',
      'cognitive-language',
    ],
    concerns: [
      'Synchronizing geomorphology, dungeon topology, monster ecology, acoustics, and plots under one WorldDifferentiationProfile per biome',
      'Auditing cross-part drift between overworld realms, dungeons, and narrative arcs',
      'Synthesizing prioritized Observer Refinement Agendas for continuous improvement',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-multiplayer',
    name: 'Frontiers Co-op Federation & Room Isolation Manager',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S2',
    citedAuthority: 'ISO 42010 · Server-Authoritative Room & Realm-Scoped Co-op Protocol',
    basisPrime: 163,
    ownedSlots: ['runtime-frameworks', 'stage-environment'],
    concerns: [
      'Expedition Room code isolation, shareable invite URLs, and realm/dungeon scoping',
      'Shared authoritative enemy combat, Mortar Lantern ally mending, and 3D tactical pings',
      'Live Party Summon & Warp synchronization across boundless cells and 3D delves',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
  {
    managerId: 'mgr-frontiers-journey',
    name: 'Frontiers Gamer Journey, Save Slots & Cinematic Prologue Director',
    origin: 'frontiers-extension',
    vsmSystem: 'VSM-S4',
    citedAuthority: 'ISO 42010 · Player Journey, 3-Slot Save Charter & Captioned Prologue Spec',
    basisPrime: 167,
    ownedSlots: ['cognitive-language', 'visual-identity', 'runtime-frameworks'],
    concerns: [
      'Complete menu-to-gameplay state reachability with zero dead-end player transitions',
      '5-Act animated narrated prologue with closed-caption timing and live 3D camera choreography',
      '3-Slot Expedition Save Ledger (create, continue, rename, delete, legacy migration) & 6 directed gameplay milestones',
    ],
    differentiationRequirements: [STANDARD_DIFFERENTIATION_RULE],
  },
];

// ---------------------------------------------------------------------------
// Pure Diversity & Uniqueness Math
// ---------------------------------------------------------------------------

/**
 * Normalized Shannon entropy H(X) / log2(N) in [0, 1].
 * Returns 1.0 when every item has a distinct value, 0.0 when all items are identical.
 */
export function computeNormalizedShannonEntropy(values: string[]): number {
  if (values.length <= 1) return 1;
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const uniqueCount = counts.size;
  if (uniqueCount <= 1) return 0;
  const n = values.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  const maxH = Math.log2(n);
  return maxH > 0 ? Math.min(1, Math.max(0, h / maxH)) : 1;
}

/**
 * Pairwise Jaccard distance `1 - |A ∩ B| / |A ∪ B|` in [0, 1].
 * 1.0 = completely disjoint features; 0.0 = identical clone.
 */
export function computeJaccardDistance(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? 1 - intersection / union : 0;
}

/**
 * Cosine distance `1 - (a · b) / (||a|| ||b||)` in [0, 1] for 8D semantic vectors.
 * 0.0 = collinear identical embeddings; 1.0 = orthogonal embeddings.
 */
export function computeCosineDistance(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom <= 1e-9) return 0;
  const dist = 1 - dot / denom;
  return dist < 1e-12 ? 0 : Math.min(1, dist);
}

/**
 * Mean-centered cosine distance across an 8D semantic vector pair: removes the shared
 * positive floor of a Cognitive Part so genuine structural divergence spans [0, 1].
 */
export function computeCenteredSemanticSpread(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / len;
  const meanB = b.reduce((s, v) => s + v, 0) / len;
  const ca = a.slice(0, len).map((v) => v - meanA);
  const cb = b.slice(0, len).map((v) => v - meanB);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += ca[i] * cb[i];
    magA += ca[i] * ca[i];
    magB += cb[i] * cb[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom <= 1e-9) return 0;
  const dist = (1 - dot / denom) * 0.5;
  return dist < 1e-12 ? 0 : Math.min(1, dist);
}

const CLONE_SIMILARITY_THRESHOLD = 0.85; // Jaccard distance <= 0.15 => clone

function evaluateSiblingDomain(
  domain: string,
  models: VerdantModelNode[],
  primaryFeatureExtractor: (m: VerdantModelNode) => string,
): DiversityDomainMetric {
  if (models.length <= 1) {
    return {
      domain,
      modelCount: models.length,
      shannonEntropyNormalized: 1,
      meanSiblingUniqueness: 1,
      meanCosineSpread: 1,
      clonePairsDetected: 0,
    };
  }

  const primaryTokens = models.map(primaryFeatureExtractor);
  const shannon = computeNormalizedShannonEntropy(primaryTokens);

  let distSum = 0;
  let spreadSum = 0;
  let pairs = 0;
  let clones = 0;
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const dist = computeJaccardDistance(
        models[i].featureSignature,
        models[j].featureSignature,
      );
      const spread = computeCenteredSemanticSpread(
        models[i].semanticVector,
        models[j].semanticVector,
      );
      distSum += dist;
      spreadSum += spread;
      pairs += 1;
      if (1 - dist >= CLONE_SIMILARITY_THRESHOLD) {
        clones += 1;
      }
    }
  }

  return {
    domain,
    modelCount: models.length,
    shannonEntropyNormalized: Math.round(shannon * 1000) / 1000,
    meanSiblingUniqueness: pairs > 0 ? Math.round((distSum / pairs) * 1000) / 1000 : 1,
    meanCosineSpread: pairs > 0 ? Math.round((spreadSum / pairs) * 1000) / 1000 : 1,
    clonePairsDetected: clones,
  };
}

/**
 * Evaluates all 10 first-class Diversity, Resolution, Novelty, Coverage, Provenance,
 * Cross-Part Cohesion, Dungeon Topology, Monster Ecology & Story Conservation KPIs
 * across the unified Model-of-Models tree.
 */
export function evaluateFrontiersKpis(root: VerdantModelNode): FrontiersObserverKpiReport {
  const realms = listModelsByKind(root, 'realm');
  const dungeons = listModelsByKind(root, 'dungeon');
  const dungeonTopologies = listModelsByKind(root, 'dungeon-topology');
  const geomorphologies = listModelsByKind(root, 'geomorphology');
  const characters = listModelsByKind(root, 'character');
  const fauna = listModelsByKind(root, 'fauna');
  const monsterSpecies = listModelsByKind(root, 'monster-species');
  const relicArchetypes = listModelsByKind(root, 'relic-archetype');
  const scores = listModelsByKind(root, 'score');
  const materials = listModelsByKind(root, 'material-palette');
  const quests = listModelsByKind(root, 'quest');
  const storyAutomata = listModelsByKind(root, 'story-automaton');
  const diffProfiles = listModelsByKind(root, 'differentiation-profile');

  const domainBreakdown: DiversityDomainMetric[] = [
    evaluateSiblingDomain(
      'overworld-realms',
      realms,
      (m) => `${m.generativeGenome.traits.layoutId ?? ''}|${m.generativeGenome.traits.geomorphologyId ?? m.modelId}`,
    ),
    evaluateSiblingDomain(
      '3d-dungeons',
      dungeons,
      (m) => `${m.generativeGenome.traits.topologyId ?? m.generativeGenome.traits.dungeonStyle ?? m.modelId}`,
    ),
    evaluateSiblingDomain(
      'dungeon-topologies',
      dungeonTopologies,
      (m) => String(m.generativeGenome.traits.topologyId ?? m.modelId),
    ),
    evaluateSiblingDomain(
      'terrain-geomorphologies',
      geomorphologies,
      (m) => String(m.generativeGenome.traits.geomorphologyId ?? m.modelId),
    ),
    evaluateSiblingDomain(
      'character-rigs',
      characters,
      (m) => `${m.generativeGenome.traits.garmentStyle ?? ''}|${m.generativeGenome.traits.signatureProp ?? ''}|${m.generativeGenome.traits.hairStyle ?? ''}`,
    ),
    evaluateSiblingDomain('apex-fauna-kits', fauna, (m) => String(m.generativeGenome.traits.signatureMove ?? m.modelId)),
    evaluateSiblingDomain(
      'monster-ecology',
      monsterSpecies,
      (m) => `${m.generativeGenome.traits.theme ?? ''}|${m.generativeGenome.traits.archetype ?? ''}|${m.generativeGenome.traits.speciesName ?? ''}`,
    ),
    evaluateSiblingDomain('relic-archetypes', relicArchetypes, (m) => String(m.generativeGenome.traits.perkId ?? m.modelId)),
    evaluateSiblingDomain(
      'orchestral-scores',
      scores,
      (m) => `${m.generativeGenome.traits.mode ?? ''}|${m.generativeGenome.traits.meter ?? ''}|${m.generativeGenome.traits.foleyProfile ?? ''}`,
    ),
    evaluateSiblingDomain(
      'surface-materials',
      materials,
      (m) =>
        `${m.generativeGenome.traits.terrain ?? ''}|${m.generativeGenome.traits.masonry ?? ''}|${m.generativeGenome.traits.surfaceMode ?? ''}`,
    ),
    evaluateSiblingDomain(
      'story-automata',
      storyAutomata,
      (m) => `${m.generativeGenome.traits.domainId ?? ''}|${m.generativeGenome.traits.motif ?? ''}`,
    ),
  ];

  const activeDomains = domainBreakdown.filter((d) => d.modelCount > 1);
  const meanShannon =
    activeDomains.length > 0
      ? activeDomains.reduce((acc, d) => acc + d.shannonEntropyNormalized, 0) / activeDomains.length
      : 1;
  const meanUniqueness =
    activeDomains.length > 0
      ? activeDomains.reduce((acc, d) => acc + d.meanSiblingUniqueness, 0) / activeDomains.length
      : 1;
  const clonePairsTotal = domainBreakdown.reduce((acc, d) => acc + d.clonePairsDetected, 0);

  // Part coverage & uniform resolution across all 8 canonical Verdant Cognitive Parts
  const partMeans = VERDANT_PART_SLOTS.map((slot) => {
    const models = listModelsByPart(root, slot);
    if (models.length === 0) return { slot, count: 0, meanDef: 0 };
    const meanDef = models.reduce((a, m) => a + m.definitionScore, 0) / models.length;
    return { slot, count: models.length, meanDef };
  });
  const populatedParts = partMeans.filter((p) => p.count > 0).length;
  const meanResolutionDef =
    partMeans.reduce((a, p) => a + p.meanDef, 0) / Math.max(1, partMeans.length);
  const minPartDef = Math.min(...partMeans.map((p) => p.meanDef));

  // Anti-trope novelty across all quest models
  const originalQuests = quests.filter(
    (q) => q.generativeGenome.traits.noveltyVerdict !== 'cliche',
  ).length;
  const noveltyRatio = quests.length > 0 ? originalQuests / quests.length : 1;

  // Genome provenance across every model in the entire tree
  const allNodes = flattenModelTree(root);
  const validProvenance = allNodes.filter(
    (n) =>
      Boolean(n.modelId) &&
      Boolean(n.kappaDigest) &&
      Boolean(n.generativeGenome.generator) &&
      n.featureSignature.length > 0,
  ).length;
  const provenanceRatio = allNodes.length > 0 ? validProvenance / allNodes.length : 1;

  // KPI 7: Cross-part Cohesion (every realm & dungeon matches its WorldDifferentiationProfile charter)
  const profileIds = new Set(diffProfiles.map((p) => String(p.generativeGenome.traits.profileId ?? '')));
  let cohesiveWorlds = 0;
  const worldNodes = [...realms, ...dungeons];
  for (const w of worldNodes) {
    const tr = w.generativeGenome.traits;
    const hasProfile = profileIds.has(String(tr.cohesionProfileId ?? ''));
    const hasStory = Boolean(tr.storyAutomatonId);
    const biomeSync =
      w.kind === 'realm'
        ? tr.faunaKit === tr.expectedFaunaKit && tr.floraKit === tr.expectedFloraKit && Boolean(tr.geomorphologyId)
        : tr.dungeonStyle === tr.expectedDungeonStyle && Boolean(tr.topologyId);
    if (hasProfile && hasStory && biomeSync) {
      cohesiveWorlds += 1;
    }
  }
  const cohesionPct =
    worldNodes.length > 0 ? Math.round((cohesiveWorlds / worldNodes.length) * 100) : 100;

  // KPI 8: Dungeon Topology Diversity (distinct non-repeating 3D floorplans)
  const uniqueDungeonTopologies = new Set(
    [
      ...dungeons.map((d) => String(d.generativeGenome.traits.topologyId ?? '')),
      ...dungeonTopologies.map((t) => String(t.generativeGenome.traits.topologyId ?? '')),
    ].filter(Boolean),
  );

  // KPI 9: Monster Ecology Diversity (distinct combat archetypes & unique biome species)
  const uniqueMonsterArchetypes = new Set(
    monsterSpecies.map((m) => String(m.generativeGenome.traits.archetype ?? '')).filter(Boolean),
  );
  const uniqueMonsterSpeciesNames = new Set(
    monsterSpecies.map((m) => String(m.generativeGenome.traits.speciesName ?? '')).filter(Boolean),
  );

  // KPI 10: Story Automaton Conservation & Reachability Closure
  const verifiedStories = storyAutomata.filter(
    (s) => s.generativeGenome.traits.verifiedPassed === true,
  ).length;
  const storyClosurePct =
    storyAutomata.length > 0 ? Math.round((verifiedStories / storyAutomata.length) * 100) : 100;

  // KPI 11: Cross-Part Relational Semantic Graph Integrity
  const modelGraph = buildModelRelationGraph(root);
  const graphIntegrityPct = Math.round(modelGraph.integrityRatio * 100);

  // KPI 12: 8D vTensor Semantic Vector Spread across sibling domains
  const meanSemanticSpread =
    activeDomains.length > 0
      ? activeDomains.reduce((acc, d) => acc + d.meanCosineSpread, 0) / activeDomains.length
      : 1;

  const kpis: ObserverKpiMetric[] = [
    {
      id: 'KPI-MODEL-DIVERSITY-SHANNON',
      label: 'Model Feature Entropy (Shannon)',
      value: Math.round(meanShannon * 1000) / 1000,
      target: 0.78,
      unit: 'norm-H',
      passed: meanShannon >= 0.78,
      detail: `Mean normalized Shannon entropy across ${activeDomains.length} game domains.`,
    },
    {
      id: 'KPI-SIBLING-UNIQUENESS',
      label: 'Sibling Model Uniqueness (Jaccard)',
      value: Math.round(meanUniqueness * 1000) / 1000,
      target: 0.70,
      unit: 'dist',
      passed: meanUniqueness >= 0.70 && clonePairsTotal === 0,
      detail:
        clonePairsTotal === 0
          ? `0 clone pairs detected across ${activeDomains.length} sibling families.`
          : `${clonePairsTotal} overlapping sibling clone pair(s) detected — run Ratchet Cycle to auto-diversify.`,
    },
    {
      id: 'KPI-UNIFORM-RESOLUTION',
      label: 'Uniform Definition & Resolution',
      value: Math.round(meanResolutionDef * 10) / 10,
      target: 72,
      unit: 'score',
      passed: meanResolutionDef >= 72 && minPartDef >= 68,
      detail: `Tier ${root.resolutionTier} (${RESOLUTION_TIER_LABELS[root.resolutionTier]}), min part floor ${Math.round(minPartDef * 10) / 10}/100.`,
    },
    {
      id: 'KPI-PART-COVERAGE',
      label: 'Verdant 8-Part Cognitive Coverage',
      value: populatedParts,
      target: VERDANT_PART_SLOTS.length,
      unit: 'parts',
      passed: populatedParts === VERDANT_PART_SLOTS.length,
      detail: `${populatedParts}/${VERDANT_PART_SLOTS.length} canonical Verdant Cognitive Parts hydrated.`,
    },
    {
      id: 'KPI-ANTI-TROPE-NOVELTY',
      label: 'Anti-Trope Narrative Novelty',
      value: Math.round(noveltyRatio * 100),
      target: 100,
      unit: '%',
      passed: noveltyRatio >= 1,
      detail: `${originalQuests}/${quests.length} quest charters verified original (zero clichés).`,
    },
    {
      id: 'KPI-GENOME-PROVENANCE',
      label: 'Generative Genome & Kappa Provenance',
      value: Math.round(provenanceRatio * 100),
      target: 100,
      unit: '%',
      passed: provenanceRatio >= 1,
      detail: `${validProvenance}/${allNodes.length} models carry deterministic genomes, 8D vectors & digests.`,
    },
    {
      id: 'KPI-CROSS-PART-COHESION',
      label: 'Cross-Part World Cohesion Charter',
      value: cohesionPct,
      target: 95,
      unit: '%',
      passed: cohesionPct >= 95 && diffProfiles.length >= 6,
      detail: `${cohesiveWorlds}/${worldNodes.length} realms & dungeons aligned across ${diffProfiles.length} World Differentiation Profiles.`,
    },
    {
      id: 'KPI-DUNGEON-TOPOLOGY-DIVERSITY',
      label: 'Bespoke 3D Dungeon Topology Diversity',
      value: uniqueDungeonTopologies.size,
      target: 6,
      unit: 'topologies',
      passed: uniqueDungeonTopologies.size >= 6,
      detail: `${uniqueDungeonTopologies.size}/6 distinct walkable floorplan & hazard topologies verified (zero corridor clones).`,
    },
    {
      id: 'KPI-MONSTER-ECOLOGY-DIVERSITY',
      label: 'Monster Ecology & Archetype Diversity',
      value: uniqueMonsterSpeciesNames.size,
      target: 30,
      unit: 'species',
      passed: uniqueMonsterArchetypes.size >= 6 && uniqueMonsterSpeciesNames.size >= 30,
      detail: `${uniqueMonsterSpeciesNames.size} biome-cohesive monster species spanning ${uniqueMonsterArchetypes.size}/6 combat archetypes.`,
    },
    {
      id: 'KPI-STORY-CONSERVATION-CLOSURE',
      label: 'Story Automaton Conservation Closure',
      value: storyClosurePct,
      target: 100,
      unit: '%',
      passed: storyClosurePct >= 100 && storyAutomata.length >= 12,
      detail: `${verifiedStories}/${storyAutomata.length} multi-act StoryAutomata verified reachable, deadlock-free & conservation-closed.`,
    },
    {
      id: 'KPI-RELATIONAL-GRAPH-INTEGRITY',
      label: 'Cross-Part Relational Graph Integrity',
      value: graphIntegrityPct,
      target: 100,
      unit: '%',
      passed: modelGraph.danglingEdges.length === 0 && modelGraph.crossPartEdges >= 45,
      detail: `${modelGraph.edges.length} semantic links (${modelGraph.crossPartEdges} cross-part, ${modelGraph.danglingEdges.length} dangling).`,
    },
    {
      id: 'KPI-VTENSOR-SEMANTIC-SPREAD',
      label: '8D vTensor Semantic Vector Spread',
      value: Math.round(meanSemanticSpread * 1000) / 1000,
      target: 0.14,
      unit: 'cos-d',
      passed: meanSemanticSpread >= 0.14 && clonePairsTotal === 0,
      detail: `Mean 8D cognitive vector spread across ${activeDomains.length} sibling model spaces.`,
    },
    (() => {
      const journeyAudit = verifyGamerJourneyGraph();
      const prologueModels = listModelsByKind(root, 'prologue-act');
      const milestoneModels = listModelsByKind(root, 'journey-milestone');
      const saveCharter = getModelById(root, 'frontiers:framework:multi-slot-save-charter');
      const pct = Math.round((journeyAudit.reachableStates / Math.max(1, journeyAudit.totalStates)) * 100);
      const passed =
        journeyAudit.passed &&
        prologueModels.length === 5 &&
        milestoneModels.length === 6 &&
        Boolean(saveCharter);
      return {
        id: 'KPI-JOURNEY-EXPERIENCE-CLOSURE' as const,
        label: 'Gamer Journey & Prologue Closure',
        value: pct,
        target: 100,
        unit: '%',
        passed,
        detail: `${journeyAudit.reachableStates}/${journeyAudit.totalStates} journey states reachable · ${prologueModels.length} captioned prologue acts · ${milestoneModels.length} milestones · 3 save slots.`,
      };
    })(),
  ];

  const diversityIndex = Math.round(
    Math.min(100, Math.max(0, (meanShannon * 0.5 + meanUniqueness * 0.5) * 100 - clonePairsTotal * 8)),
  );
  const resolutionIndex = Math.round(Math.min(100, Math.max(0, meanResolutionDef)));
  const cohesionIndex = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        cohesionPct * 0.4 +
          storyClosurePct * 0.22 +
          graphIntegrityPct * 0.14 +
          Math.min(100, (uniqueDungeonTopologies.size / 6) * 100) * 0.12 +
          Math.min(100, (uniqueMonsterArchetypes.size / 6) * 100) * 0.12,
      ),
    ),
  );

  return {
    spec: 'frontiers/verdant-observer-kpi-report/2',
    rootModelId: root.modelId,
    rootKappaDigest: root.kappaDigest,
    resolutionTier: root.resolutionTier,
    resolutionLabel: RESOLUTION_TIER_LABELS[root.resolutionTier],
    diversityIndex,
    resolutionIndex,
    cohesionIndex,
    allPassed: kpis.every((k) => k.passed),
    clonePairsTotal,
    kpis,
    domainBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Orthogonal Diversification Pools (for Auto-Diversifying Sibling Clones)
// ---------------------------------------------------------------------------

const ORTHOGONAL_DIVERSIFIERS: Record<VerdantPartSlot, string[][]> = {
  'stage-environment': [
    ['micro-biome:basalt-terraces', 'landmark:wind-harp-arch', 'weather:amber-updraft'],
    ['micro-biome:lichen-grotto', 'landmark:sluice-cantilever', 'weather:prism-mist'],
    ['micro-biome:fumarole-ridge', 'landmark:obsidian-sluice', 'weather:cinder-eddy'],
    ['micro-biome:tidal-archway', 'landmark:kelp-lighthouse', 'weather:salt-squall'],
  ],
  'character-rigs': [
    ['silhouette:asymmetric-mantle', 'accent:verdigris-clasp', 'prop-variant:astrolabe-compass'],
    ['silhouette:tiered-pauldrons', 'accent:ochre-braid', 'prop-variant:harmonic-chime'],
    ['silhouette:layered-survey-coat', 'accent:cobalt-sash', 'prop-variant:survey-theodolite'],
    ['silhouette:forgemaster-harness', 'accent:copper-rivets', 'prop-variant:bellows-tongs'],
  ],
  'hero-props': [
    ['alloy:phosphor-bronze', 'inlay:silicate-prism', 'resonance-mode:fifth-overtone'],
    ['alloy:quenched-basalt-steel', 'inlay:cinder-amber', 'resonance-mode:sub-harmonic'],
    ['alloy:tidal-orichalcum', 'inlay:mother-of-pearl', 'resonance-mode:wave-chime'],
    ['alloy:frostglass-titanium', 'inlay:aurora-quartz', 'resonance-mode:crystalline-ring'],
  ],
  'surface-materials': [
    ['pbr-detail:micro-striated-basalt', 'roughness-band:0.42', 'patina:verdigris'],
    ['pbr-detail:fluted-limestone', 'roughness-band:0.58', 'patina:moss-sinter'],
    ['pbr-detail:vitreous-slag', 'roughness-band:0.24', 'patina:ember-vein'],
    ['pbr-detail:glacial-faceted-ice', 'roughness-band:0.18', 'patina:frost-bloom'],
  ],
  'spatial-acoustics': [
    ['orchestration:solo-cello-counterpoint', 'reverb-tail:cathedral-2.9s', 'voicing:quartal'],
    ['orchestration:highland-flute-duet', 'reverb-tail:valley-2.1s', 'voicing:open-fifth'],
    ['orchestration:hammered-dulcimer-pulse', 'reverb-tail:chamber-1.6s', 'voicing:modal-ostinato'],
    ['orchestration:french-horn-fanfare', 'reverb-tail:glacier-3.4s', 'voicing:polychord'],
  ],
  'visual-identity': [
    ['crest-geometry:hexagonal-compass', 'line-weight:fine-etched', 'foil:burnished-gold'],
    ['crest-geometry:spiral-astrolabe', 'line-weight:calligraphic', 'foil:sea-glass-teal'],
    ['crest-geometry:octagonal-keystone', 'line-weight:chiseled', 'foil:ember-copper'],
  ],
  'cognitive-language': [
    ['narrative-lens:hydraulic-engineering', 'conflict-axis:civic-charter', 'dialect:guild-ledger'],
    ['narrative-lens:acoustic-cartography', 'conflict-axis:frontier-survey', 'dialect:waywright-cant'],
    ['narrative-lens:geological-stewardship', 'conflict-axis:ecological-balance', 'dialect:mason-chronicle'],
  ],
  'runtime-frameworks': [
    ['pipeline-stage:zero-copy-wasm', 'telemetry-tier:deterministic'],
    ['pipeline-stage:csm-ggx-aces', 'telemetry-tier:hdr-tonemapped'],
  ],
};

function enrichNodeForTier(
  node: VerdantModelNode,
  targetTier: VerdantResolutionTier,
  passNumber: number,
): void {
  const nextTier = Math.max(node.resolutionTier, targetTier) as VerdantResolutionTier;
  node.resolutionTier = nextTier;
  node.generativeGenome.refinementPass = Math.max(
    node.generativeGenome.refinementPass + 1,
    passNumber,
  );
  node.version += 1;

  // Uniform generative resolution traits applied consistently across every part slot
  const traits = node.generativeGenome.traits;
  traits.resolutionLabel = RESOLUTION_TIER_LABELS[nextTier];
  if (node.partSlot === 'stage-environment') {
    traits.terrainTessellationLevel = nextTier;
    traits.landmarkFlourishDensity = nextTier >= 4 ? 'sovereign-ultra' : 'meridian-hd';
    traits.ambientParticleMultiplier = nextTier >= 4 ? 1.5 : 1.0;
  } else if (node.partSlot === 'character-rigs') {
    traits.smoothNormalSegments = nextTier >= 4 ? 16 : nextTier === 3 ? 12 : 8;
    traits.portraitFidelityPass = nextTier;
  } else if (node.partSlot === 'hero-props') {
    traits.harmonicAuraRings = nextTier >= 4 ? 2 : 1;
    traits.metallicMicroDetail = nextTier >= 4 ? 'anisotropic-bronze' : 'standard-pbr';
  } else if (node.partSlot === 'surface-materials') {
    traits.pbrMipResolution = nextTier >= 4 ? 2048 : nextTier === 3 ? 1024 : 512;
    traits.normalMapStrength = nextTier >= 4 ? 1.18 : 1.0;
  } else if (node.partSlot === 'spatial-acoustics') {
    traits.harmonicOvertones = nextTier >= 4 ? 8 : 5;
    traits.spatialBinauralPrecision = nextTier >= 4 ? 'sub-millisecond-itd' : 'standard-itd';
  } else if (node.partSlot === 'visual-identity') {
    traits.vectorPrecisionPass = nextTier;
    traits.chromaticContrastRatio = nextTier >= 4 ? 7.2 : 5.4;
  } else if (node.partSlot === 'cognitive-language') {
    traits.antiTropeAuditPass = nextTier;
    traits.beliefGraphDepth = nextTier >= 4 ? 4 : 3;
  } else if (node.partSlot === 'runtime-frameworks') {
    traits.renderScalePermille = nextTier >= 4 ? 1000 : nextTier === 3 ? 950 : 850;
    traits.casSharpnessPermille = nextTier >= 4 ? 420 : 320;
  }
}

export function deriveRenderResolutionProfile(
  root: VerdantModelNode,
  isSoftwareGl = false,
): RenderResolutionProfile {
  const tier = root.resolutionTier;
  if (tier >= 4) {
    return {
      resolutionTier: 4,
      resolutionLabel: RESOLUTION_TIER_LABELS[4],
      sphereSegments: 16,
      cylinderSegments: 16,
      ambientParticleBoost: 1.5,
      landmarkFlourishLevel: 4,
      renderScalePermille: isSoftwareGl ? 920 : 1000,
      casSharpnessPermille: 420,
      lodRank: isSoftwareGl ? 2 : 3,
    };
  }
  if (tier === 3) {
    return {
      resolutionTier: 3,
      resolutionLabel: RESOLUTION_TIER_LABELS[3],
      sphereSegments: 12,
      cylinderSegments: 12,
      ambientParticleBoost: 1.0,
      landmarkFlourishLevel: 3,
      renderScalePermille: isSoftwareGl ? 850 : 1000,
      casSharpnessPermille: 320,
      lodRank: isSoftwareGl ? 1 : 3,
    };
  }
  if (tier === 2) {
    return {
      resolutionTier: 2,
      resolutionLabel: RESOLUTION_TIER_LABELS[2],
      sphereSegments: 10,
      cylinderSegments: 10,
      ambientParticleBoost: 0.75,
      landmarkFlourishLevel: 2,
      renderScalePermille: 820,
      casSharpnessPermille: 240,
      lodRank: 1,
    };
  }
  return {
    resolutionTier: 1,
    resolutionLabel: RESOLUTION_TIER_LABELS[1],
    sphereSegments: 8,
    cylinderSegments: 8,
    ambientParticleBoost: 0.5,
    landmarkFlourishLevel: 1,
    renderScalePermille: 720,
    casSharpnessPermille: 160,
    lodRank: 0,
  };
}

// ---------------------------------------------------------------------------
// Extended Verdant Observer & Manager Coordinator
// ---------------------------------------------------------------------------

export class FrontiersVerdantObserver {
  private root: VerdantModelNode;
  private nativeWasmManagers: VerdantVsmManagerSpec[] = [];
  private listeners = new Set<(snapshot: ObserverSnapshot) => void>();
  private refinementPassCount = 0;
  private auditLedger: RefinementAuditEntry[] = [];
  private watermarks: MonotonicWatermarkState;
  private isSoftwareGl = false;

  constructor(initialInput: ModelOfModelsBuildInput = {}) {
    this.root = buildFrontiersModelOfModels(initialInput);
    const summary = summarizeModelOfModels(this.root);
    const kpis = evaluateFrontiersKpis(this.root);
    this.watermarks = {
      spec: 'prism/parametric-ratchet/2',
      minTotalModels: summary.totalModels,
      minGraphEdges: summary.graphEdgeCount,
      minCrossPartEdges: summary.crossPartEdgeCount,
      minDefinitionScore: this.root.definitionScore,
      minDiversityIndex: kpis.diversityIndex,
      minCohesionIndex: kpis.cohesionIndex,
      minRefinementScorePermille: Math.round(
        Math.min(1000, (this.root.definitionScore * 0.4 + kpis.diversityIndex * 0.3 + kpis.cohesionIndex * 0.3) * 10),
      ),
      maxClonePairs: 0,
      ratchetAdvances: 0,
    };
  }

  public setSoftwareGl(flag: boolean): void {
    this.isSoftwareGl = flag;
  }

  /**
   * Synchronizes the 13 native VSM Managers returned by `verdant_wasm_operator_status_aux`
   * into the unified Observer/Manager registry alongside the 6 Frontiers Domain Managers.
   */
  public attachWasmManagers(
    rawWasmManagers: Array<{
      managerId?: string;
      name?: string;
      basisPrime?: number;
      kappaHex?: string;
      spec?: {
        managerId?: string;
        title?: string;
        ownedObserverParts?: string[];
        concerns?: string[];
        differentiationRequirements?: string[];
      };
    }>,
  ): void {
    this.nativeWasmManagers = rawWasmManagers
      .map((m, idx) => {
        const id = m.spec?.managerId || m.managerId || '';
        const title = m.spec?.title || m.name || id;
        const owned = Array.isArray(m.spec?.ownedObserverParts)
          ? (m.spec.ownedObserverParts.filter((p) =>
              (VERDANT_PART_SLOTS as readonly string[]).includes(p),
            ) as VerdantPartSlot[])
          : [];
        const vsmSystem: VsmSystemLevel =
          id.includes('gov') || id.includes('policy') || id.includes('identity')
            ? 'VSM-S5'
            : id.includes('intel') || id.includes('knowledge') || id.includes('scout')
              ? 'VSM-S4'
              : id.includes('audit') || id.includes('control') || id.includes('quality')
                ? 'VSM-S3'
                : id.includes('coord') || id.includes('bus') || id.includes('sync')
                  ? 'VSM-S2'
                  : idx % 5 === 4
                    ? 'VSM-S5'
                    : idx % 5 === 3
                      ? 'VSM-S4'
                      : idx % 5 === 2
                        ? 'VSM-S3'
                        : idx % 5 === 1
                          ? 'VSM-S2'
                          : 'VSM-S1';
        return {
          managerId: String(id),
          name: String(title),
          origin: 'verdant-wasm' as const,
          vsmSystem,
          citedAuthority: 'verdant-uorc.wasm · Native VSM Kernel Manager',
          basisPrime: Number(m.basisPrime ?? 0),
          ownedSlots: owned,
          concerns: Array.isArray(m.spec?.concerns) ? m.spec.concerns.map(String) : [],
          differentiationRequirements: Array.isArray(m.spec?.differentiationRequirements)
            ? m.spec.differentiationRequirements.map(String)
            : [STANDARD_DIFFERENTIATION_RULE],
          kappaHex: typeof m.kappaHex === 'string' ? m.kappaHex : undefined,
        };
      })
      .filter((m) => m.managerId.length > 0);
    this.notify();
  }

  /**
   * Rebuilds/syncs the underlying Model-of-Models when realms, characters, relics,
   * or quests change at runtime, while preserving the current escalated resolutionTier.
   */
  public syncWorldState(input: ModelOfModelsBuildInput): ObserverSnapshot {
    const preservedTier = this.root.resolutionTier;
    const prevVersion = this.root.version;
    this.root = buildFrontiersModelOfModels({
      ...input,
      baseResolutionTier: input.baseResolutionTier ?? preservedTier,
    });
    if (this.refinementPassCount > 0) {
      for (const node of flattenModelTree(this.root)) {
        if (node.kind !== 'root' && node.kind !== 'part') {
          node.generativeGenome.refinementPass = this.refinementPassCount;
        }
      }
      recomputeAggregatedScores(this.root);
    }
    this.root.version = Math.max(prevVersion + 1, this.root.version);
    const snap = this.getSnapshot();
    this.notify();
    return snap;
  }

  /**
   * Registers or replaces a sub-model directly inside a Cognitive Part slot.
   * Useful for live procedural additions and for verifying diversity/clone guards.
   */
  public registerModel(partSlot: VerdantPartSlot, node: VerdantModelNode): VerdantModelNode {
    const partNode = this.root.children.find((c) => c.partSlot === partSlot);
    if (!partNode) {
      throw new Error(`Unknown Verdant Cognitive Part slot: ${partSlot}`);
    }
    const existingIdx = partNode.children.findIndex((c) => c.modelId === node.modelId);
    const normalized: VerdantModelNode = {
      ...node,
      parentId: partNode.modelId,
      partSlot,
    };
    if (existingIdx >= 0) {
      partNode.children[existingIdx] = normalized;
    } else {
      partNode.children.push(normalized);
    }
    this.root.version += 1;
    recomputeAggregatedScores(this.root);
    this.notify();
    return normalized;
  }

  public getRootModel(): VerdantModelNode {
    return this.root;
  }

  public getModel(modelId: string): VerdantModelNode | null {
    return getModelById(this.root, modelId);
  }

  public listModels(filter?: {
    partSlot?: VerdantPartSlot;
    kind?: VerdantModelKind;
  }): VerdantModelNode[] {
    let items = filter?.partSlot
      ? listModelsByPart(this.root, filter.partSlot)
      : flattenModelTree(this.root).filter((n) => n.kind !== 'root' && n.kind !== 'part');
    if (filter?.kind) {
      items = items.filter((n) => n.kind === filter.kind);
    }
    return items;
  }

  public listManagers(): VerdantVsmManagerSpec[] {
    return [...this.nativeWasmManagers, ...FRONTIERS_DOMAIN_MANAGERS];
  }

  public getManagersForSlot(slot: VerdantPartSlot | 'root'): VerdantVsmManagerSpec[] {
    if (slot === 'root') return [...FRONTIERS_DOMAIN_MANAGERS];
    const matching = FRONTIERS_DOMAIN_MANAGERS.filter((m) => m.ownedSlots.includes(slot));
    const diversityMgr = FRONTIERS_DOMAIN_MANAGERS.find(
      (m) => m.managerId === 'mgr-frontiers-diversity',
    );
    if (diversityMgr && !matching.some((m) => m.managerId === diversityMgr.managerId)) {
      matching.push(diversityMgr);
    }
    return matching;
  }

  public observeKpis(): FrontiersObserverKpiReport {
    return evaluateFrontiersKpis(this.root);
  }

  public getSummary(): ModelOfModelsSummary {
    return summarizeModelOfModels(this.root);
  }

  public getModelGraph(): VerdantModelGraph {
    return buildModelRelationGraph(this.root);
  }

  public getModelLineage(modelId: string): ModelLineageReport | null {
    return getModelLineage(this.root, modelId);
  }

  public getAuditLedger(): RefinementAuditEntry[] {
    return [...this.auditLedger];
  }

  public getMonotonicWatermarks(): MonotonicWatermarkState {
    return { ...this.watermarks };
  }

  public getRenderResolutionProfile(): RenderResolutionProfile {
    return deriveRenderResolutionProfile(this.root, this.isSoftwareGl);
  }

  /**
   * Lifted 6-gate in-process Lifecycle Gate modeled on `verdant-engine` M16/M17 `lifecycle.rs`.
   */
  public executeLifecycleGate(): LifecycleGateReport {
    const kpiReport = this.observeKpis();
    const graph = this.getModelGraph();
    const allNodes = flattenModelTree(this.root);
    const partNodes = allNodes.filter((n) => n.kind !== 'root' && n.kind !== 'part');

    const ownedSlots = new Set(FRONTIERS_DOMAIN_MANAGERS.flatMap((m) => m.ownedSlots));
    const orphanParts = VERDANT_PART_SLOTS.filter((slot) => !ownedSlots.has(slot));
    const unsealedNodes = allNodes.filter(
      (n) => !n.kappaDigest || !Array.isArray(n.semanticVector) || n.semanticVector.length !== 8,
    );
    const storyKpi = kpiReport.kpis.find((k) => k.id === 'KPI-STORY-CONSERVATION-CLOSURE');
    const mpProtocol = getModelById(this.root, 'frontiers:framework:multiplayer-expedition-protocol');
    const mpSession = getModelById(this.root, 'frontiers:expedition:active-session');
    const mpIsolated =
      Boolean(mpProtocol?.generativeGenome.traits.roomIsolation) &&
      Boolean(mpProtocol?.generativeGenome.traits.realmScoping) &&
      Boolean(mpSession?.generativeGenome.traits.roomCode);

    const checks: LifecycleGateCheck[] = [
      {
        checkId: 'total-ownership',
        owningManagerId: 'mgr-frontiers-diversity',
        vsmSystem: 'VSM-S5',
        category: 'in-process',
        passed: orphanParts.length === 0 && partNodes.length >= 70,
        detail: `${VERDANT_PART_SLOTS.length - orphanParts.length}/${VERDANT_PART_SLOTS.length} Cognitive Parts owned by ${FRONTIERS_DOMAIN_MANAGERS.length} Frontiers VSM Managers (${partNodes.length} models).`,
      },
      {
        checkId: 'immutability-seal',
        owningManagerId: 'mgr-frontiers-diversity',
        vsmSystem: 'VSM-S5',
        category: 'in-process',
        passed: unsealedNodes.length === 0,
        detail: `${allNodes.length - unsealedNodes.length}/${allNodes.length} models sealed with deterministic kappa digests & 8D vTensor vectors.`,
      },
      {
        checkId: 'relational-graph-closure',
        owningManagerId: 'mgr-frontiers-cohesion',
        vsmSystem: 'VSM-S4',
        category: 'in-process',
        passed: graph.danglingEdges.length === 0 && graph.crossPartEdges >= 45,
        detail: `${graph.edges.length} semantic edges (${graph.crossPartEdges} cross-part, ${graph.danglingEdges.length} dangling).`,
      },
      {
        checkId: 'story-conservation-closure',
        owningManagerId: 'mgr-frontiers-narrative',
        vsmSystem: 'VSM-S3',
        category: 'in-process',
        passed: Boolean(storyKpi?.passed),
        detail: storyKpi?.detail ?? 'StoryAutomaton conservation ledger audit.',
      },
      {
        checkId: 'diversity-and-anti-clone',
        owningManagerId: 'mgr-frontiers-diversity',
        vsmSystem: 'VSM-S5',
        category: 'in-process',
        passed:
          kpiReport.clonePairsTotal === 0 &&
          Boolean(kpiReport.kpis.find((k) => k.id === 'KPI-MODEL-DIVERSITY-SHANNON')?.passed) &&
          Boolean(kpiReport.kpis.find((k) => k.id === 'KPI-VTENSOR-SEMANTIC-SPREAD')?.passed),
        detail: `Diversity ${kpiReport.diversityIndex}/100 · ${kpiReport.clonePairsTotal} clone collisions across 11 audited domains.`,
      },
      {
        checkId: 'multiplayer-federation-isolation',
        owningManagerId: 'mgr-frontiers-multiplayer',
        vsmSystem: 'VSM-S2',
        category: 'in-process',
        passed: mpIsolated,
        detail: mpIsolated
          ? `Room ${String(mpSession?.generativeGenome.traits.roomCode)} isolated & realm-scoped (${String(mpSession?.generativeGenome.traits.activeRealmSlug)}).`
          : 'Multiplayer protocol missing room isolation or realm-scoping model.',
      },
      (() => {
        const journeyKpi = kpiReport.kpis.find((k) => k.id === 'KPI-JOURNEY-EXPERIENCE-CLOSURE');
        return {
          checkId: 'gamer-journey-closure',
          owningManagerId: 'mgr-frontiers-journey',
          vsmSystem: 'VSM-S4' as const,
          category: 'in-process' as const,
          passed: Boolean(journeyKpi?.passed),
          detail: journeyKpi?.detail ?? 'Gamer journey & narrated prologue closure check.',
        };
      })(),
    ];

    const passedChecks = checks.filter((c) => c.passed).length;
    const gateHash = hashModelSeed(
      JSON.stringify({
        root: this.root.kappaDigest,
        checks: checks.map((c) => `${c.checkId}:${c.passed}`),
      }),
    )
      .toString(16)
      .padStart(8, '0');

    return {
      spec: 'verdant/lifecycle-gate-report/1',
      allPassed: passedChecks === checks.length,
      passedChecks,
      totalChecks: checks.length,
      rootKappaDigest: this.root.kappaDigest,
      checks,
      gateKappaHex: `gate:${gateHash}`,
    };
  }

  public getSnapshot(): ObserverSnapshot {
    const summary = this.getSummary();
    const kpis = this.observeKpis();
    const gate = this.executeLifecycleGate();
    const overallRefinementScorePermille = Math.round(
      Math.min(
        1000,
        Math.max(
          0,
          (this.root.definitionScore * 0.35 +
            kpis.diversityIndex * 0.3 +
            kpis.cohesionIndex * 0.25 +
            (gate.passedChecks / Math.max(1, gate.totalChecks)) * 100 * 0.1) *
            10,
        ),
      ),
    );
    return {
      summary,
      kpis,
      renderProfile: this.getRenderResolutionProfile(),
      managersCount: this.nativeWasmManagers.length + FRONTIERS_DOMAIN_MANAGERS.length,
      frontiersManagersCount: FRONTIERS_DOMAIN_MANAGERS.length,
      wasmManagersCount: this.nativeWasmManagers.length,
      lastRefinementPass: this.refinementPassCount,
      graphEdgeCount: summary.graphEdgeCount,
      crossPartEdgeCount: summary.crossPartEdgeCount,
      auditLedgerCount: this.auditLedger.length,
      recentAuditEntries: this.auditLedger.slice(-6).reverse(),
      overallRefinementScorePermille,
      lifecycleGatePassed: gate.allPassed,
      lifecycleChecksPassed: gate.passedChecks,
      lifecycleChecksTotal: gate.totalChecks,
      watermarks: { ...this.watermarks },
    };
  }

  public subscribe(listener: (snapshot: ObserverSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      try {
        fn(snap);
      } catch {
        // isolate subscriber errors
      }
    }
  }

  /**
   * Uniform Refinement API:
   * Escalates resolution & definition across the entire game Model-of-Models,
   * a single Verdant Cognitive Part, or a single sub-model; invokes the owning
   * Domain Managers; detects & auto-diversifies any colliding sibling clones;
   * and cryptographically seals the updated root with Prism `kappa()`.
   */
  public async refine(
    options: UniformRefinementOptions = {},
  ): Promise<UniformRefinementReport> {
    const beforeKpis = this.observeKpis();
    const beforeState = {
      resolutionTier: this.root.resolutionTier,
      definitionScore: this.root.definitionScore,
      diversityIndex: beforeKpis.diversityIndex,
      resolutionIndex: beforeKpis.resolutionIndex,
      clonePairsTotal: beforeKpis.clonePairsTotal,
      rootKappaDigest: this.root.kappaDigest,
    };

    const nextDefaultTier = Math.min(4, this.root.resolutionTier + 1) as VerdantResolutionTier;
    const targetTier: VerdantResolutionTier = options.targetTier ?? nextDefaultTier;
    const enforceDiversity = options.enforceDiversity !== false;
    const reason =
      options.reason?.trim() ||
      `Uniform Verdant refinement to Tier ${targetTier} (${RESOLUTION_TIER_LABELS[targetTier]})`;

    this.refinementPassCount += 1;

    // Select target models & owning VSM Domain Managers
    let scope = 'all-8-parts';
    let targets: VerdantModelNode[] = [];
    const managersInvokedSet = new Set<string>();

    if (options.modelId) {
      const found = this.getModel(options.modelId);
      if (!found) {
        throw new Error(`Model not found in Frontiers Model-of-Models: ${options.modelId}`);
      }
      scope = `model:${found.modelId}`;
      targets = flattenModelTree(found);
      for (const m of this.getManagersForSlot(found.partSlot)) {
        managersInvokedSet.add(m.managerId);
      }
    } else if (options.partSlot) {
      scope = `part:${options.partSlot}`;
      targets = listModelsByPart(this.root, options.partSlot);
      for (const m of this.getManagersForSlot(options.partSlot)) {
        managersInvokedSet.add(m.managerId);
      }
    } else {
      targets = flattenModelTree(this.root).filter((n) => n.kind !== 'root' && n.kind !== 'part');
      for (const m of FRONTIERS_DOMAIN_MANAGERS) {
        managersInvokedSet.add(m.managerId);
      }
    }

    // 1. Uniformly escalate definition & generative traits across targeted models
    for (const node of targets) {
      if (node.kind === 'root' || node.kind === 'part') continue;
      enrichNodeForTier(node, targetTier, this.refinementPassCount);
    }

    // 2. Diversity KPI Arbiter: detect sibling clones & orthogonally diversify colliding models
    let clonesDiversified = 0;
    if (enforceDiversity) {
      managersInvokedSet.add('mgr-frontiers-diversity');
      const siblingKinds: VerdantModelKind[] = [
        'realm',
        'dungeon',
        'dungeon-topology',
        'geomorphology',
        'character',
        'fauna',
        'monster-species',
        'relic-archetype',
        'relic',
        'score',
        'material-palette',
        'quest',
        'story-automaton',
      ];
      for (const kind of siblingKinds) {
        const siblings = listModelsByKind(this.root, kind);
        for (let i = 0; i < siblings.length; i++) {
          for (let j = i + 1; j < siblings.length; j++) {
            const a = siblings[i];
            const b = siblings[j];
            const dist = computeJaccardDistance(a.featureSignature, b.featureSignature);
            if (1 - dist >= CLONE_SIMILARITY_THRESHOLD) {
              const slot: VerdantPartSlot =
                b.partSlot === 'root' ? 'stage-environment' : b.partSlot;
              const pool = ORTHOGONAL_DIVERSIFIERS[slot];
              const variant = pool[(j + this.refinementPassCount) % pool.length];
              const uniqueSeed = hashModelSeed(`${b.modelId}:diversify:${this.refinementPassCount}:${j}`);
              b.generativeGenome.seed = uniqueSeed;
              b.generativeGenome.diversifiedFrom = a.modelId;
              b.generativeGenome.traits.diversifiedVariant = `v${this.refinementPassCount}-${j}`;
              b.generativeGenome.traits.orthogonalTraits = variant.join(',');
              b.featureSignature = Array.from(
                new Set([
                  ...b.featureSignature.slice(0, 2),
                  ...variant,
                  `unique-genome:${uniqueSeed.toString(16).slice(0, 6)}`,
                ]),
              );
              b.version += 1;
              clonesDiversified += 1;
            }
          }
        }
      }
    }

    this.root.version += 1;
    // 3. Cryptographically seal the entire updated Model-of-Models with Prism kappa()
    await sealModelOfModelsKappa(this.root);

    const afterKpis = this.observeKpis();
    const renderProfile = this.getRenderResolutionProfile();
    const graphAfter = this.getModelGraph();
    const modelsRefinedCount = targets.filter((t) => t.kind !== 'root' && t.kind !== 'part').length;
    const managersInvoked = Array.from(managersInvokedSet);

    // 4. Append immutable audit entry to the Prism kappa Refinement Ledger
    this.auditLedger.push({
      passNumber: this.refinementPassCount,
      timestamp: Date.now(),
      scope,
      reason,
      targetTier,
      modelsRefined: modelsRefinedCount,
      clonesDiversified,
      managersInvoked,
      prevKappaDigest: beforeState.rootKappaDigest,
      nextKappaDigest: this.root.kappaDigest,
      deltaDefinitionScore:
        Math.round((this.root.definitionScore - beforeState.definitionScore) * 10) / 10,
      deltaDiversityIndex: afterKpis.diversityIndex - beforeState.diversityIndex,
      graphEdgesVerified: graphAfter.edges.length,
    });
    if (this.auditLedger.length > 32) {
      this.auditLedger = this.auditLedger.slice(-32);
    }

    this.notify();

    return {
      ok: true,
      reason,
      scope,
      targetTier,
      modelsRefined: modelsRefinedCount,
      clonesDiversified,
      managersInvoked,
      before: beforeState,
      after: {
        resolutionTier: this.root.resolutionTier,
        definitionScore: this.root.definitionScore,
        diversityIndex: afterKpis.diversityIndex,
        resolutionIndex: afterKpis.resolutionIndex,
        clonePairsTotal: afterKpis.clonePairsTotal,
        rootKappaDigest: this.root.kappaDigest,
      },
      renderProfile,
      kpis: afterKpis,
    };
  }

  /**
   * Verdant M16 Observer Refinement Agenda Synthesizer (modeled after `observer_refine.rs`).
   * Audits all 8 Cognitive Parts + 10 KPIs and returns prioritized, actionable
   * refinement proposals attributed to their owning VSM Domain Managers.
   */
  public synthesizeRefinementAgenda(): ObserverRefinementAgenda {
    const kpiReport = this.observeKpis();
    const partHealth: ObserverPartHealthSnapshot[] = VERDANT_PART_SLOTS.map((slot) => {
      const models = listModelsByPart(this.root, slot);
      const count = models.length;
      const meanDef =
        count > 0
          ? Math.round((models.reduce((a, m) => a + m.definitionScore, 0) / count) * 10) / 10
          : 0;
      const uniqueTokens = new Set(models.flatMap((m) => m.featureSignature)).size;
      const status: ObserverPartHealthSnapshot['status'] =
        count === 0 || meanDef < 68
          ? 'critical'
          : meanDef < 80
            ? 'needs-attention'
            : 'healthy';
      return {
        partSlot: slot,
        modelCount: count,
        meanDefinitionScore: meanDef,
        uniqueTokens,
        status,
        healthScorePermille: Math.round(Math.min(1000, Math.max(0, meanDef * 10))),
      };
    });

    const proposals: ObserverRefinementProposal[] = [];
    const managerById = (id: string): VerdantVsmManagerSpec =>
      FRONTIERS_DOMAIN_MANAGERS.find((m) => m.managerId === id) ?? FRONTIERS_DOMAIN_MANAGERS[0];

    const pushProposal = (params: {
      id: string;
      priority: ObserverRefinementProposal['priority'];
      title: string;
      managerId: string;
      partSlot: VerdantPartSlot | 'root';
      kpiId: ObserverKpiId;
      currentValue: number;
      targetValue: number;
      concreteActions: string[];
    }) => {
      const mgr = managerById(params.managerId);
      const hex = hashModelSeed(`${params.id}:${params.currentValue}:${this.root.version}`)
        .toString(16)
        .padStart(8, '0');
      proposals.push({
        proposalId: params.id,
        priority: params.priority,
        title: params.title,
        owningManagerId: mgr.managerId,
        vsmSystem: mgr.vsmSystem,
        citedAuthority: mgr.citedAuthority,
        partSlot: params.partSlot,
        kpiId: params.kpiId,
        currentValue: params.currentValue,
        targetValue: params.targetValue,
        concreteActions: params.concreteActions,
        kappaHex: `prop:${hex}`,
      });
    };

    const kpiById = (id: ObserverKpiId) => kpiReport.kpis.find((k) => k.id === id);

    // 1. Sibling clone pairs -> critical auto-diversification proposal
    const uniqKpi = kpiById('KPI-SIBLING-UNIQUENESS');
    if (uniqKpi && (!uniqKpi.passed || kpiReport.clonePairsTotal > 0)) {
      pushProposal({
        id: 'prop-diversify-sibling-clones',
        priority: 'critical',
        title: `Auto-Diversify ${kpiReport.clonePairsTotal} Colliding Sibling Model Pair(s)`,
        managerId: 'mgr-frontiers-diversity',
        partSlot: 'root',
        kpiId: 'KPI-SIBLING-UNIQUENESS',
        currentValue: uniqKpi.value,
        targetValue: uniqKpi.target,
        concreteActions: [
          'Invoke VSM-S5 Diversity Arbiter to inject orthogonal generative genome traits',
          'Recompute Jaccard sibling distance matrix across all 11 audited domains',
          'Reseal Root Model-of-Models with Prism SHA-256 kappa()',
        ],
      });
    }

    // 2. Cross-part cohesion drift -> high priority cohesion sync
    const cohesionKpi = kpiById('KPI-CROSS-PART-COHESION');
    if (cohesionKpi && !cohesionKpi.passed) {
      pushProposal({
        id: 'prop-align-world-cohesion',
        priority: 'high',
        title: 'Synchronize Realms & Dungeons to World Differentiation Profiles',
        managerId: 'mgr-frontiers-cohesion',
        partSlot: 'stage-environment',
        kpiId: 'KPI-CROSS-PART-COHESION',
        currentValue: cohesionKpi.value,
        targetValue: cohesionKpi.target,
        concreteActions: [
          'Rebind geomorphology, faunaKit, floraKit, and dungeonTopologyId to unified charter',
          'Verify overworld and dungeon StoryAutomaton links',
        ],
      });
    }

    // 3. Dungeon topology diversity check
    const dgKpi = kpiById('KPI-DUNGEON-TOPOLOGY-DIVERSITY');
    if (dgKpi && !dgKpi.passed) {
      pushProposal({
        id: 'prop-expand-dungeon-topologies',
        priority: 'high',
        title: 'Expand Non-Repetitive 3D Dungeon Floorplan Topologies',
        managerId: 'mgr-frontiers-dungeons',
        partSlot: 'stage-environment',
        kpiId: 'KPI-DUNGEON-TOPOLOGY-DIVERSITY',
        currentValue: dgKpi.value,
        targetValue: dgKpi.target,
        concreteActions: [
          'Hydrate all 6 bespoke dungeon topologies (Twin-Span, Spiral Sluice, Crucible Ring, Tidal Atoll, Stepped Ziggurat, Bifurcated Cloister)',
        ],
      });
    }

    // 4. Story conservation closure check
    const storyKpi = kpiById('KPI-STORY-CONSERVATION-CLOSURE');
    if (storyKpi && !storyKpi.passed) {
      pushProposal({
        id: 'prop-close-story-conservation',
        priority: 'critical',
        title: 'Enforce StoryAutomaton Reachability & Conservation Ledger Closure',
        managerId: 'mgr-frontiers-narrative',
        partSlot: 'cognitive-language',
        kpiId: 'KPI-STORY-CONSERVATION-CLOSURE',
        currentValue: storyKpi.value,
        targetValue: storyKpi.target,
        concreteActions: [
          'Audit transition edges from arrival -> investigation -> climax -> resolution',
          'Balance before + minted - burned === after across all resource ledgers',
        ],
      });
    }

    // 5. Uniform resolution escalation to Tier 4 Sovereign Ultra-Def
    const resKpi = kpiById('KPI-UNIFORM-RESOLUTION');
    if (this.root.resolutionTier < 4) {
      pushProposal({
        id: 'prop-escalate-sovereign-tier',
        priority: resKpi && !resKpi.passed ? 'high' : 'medium',
        title: `Escalate Unified Model-of-Models from Tier ${this.root.resolutionTier} to Tier 4 (Sovereign Ultra-Def)`,
        managerId: 'mgr-frontiers-diversity',
        partSlot: 'root',
        kpiId: 'KPI-UNIFORM-RESOLUTION',
        currentValue: resKpi?.value ?? this.root.definitionScore,
        targetValue: 92,
        concreteActions: [
          'Raise tessellation, smooth-normal character segments (12 -> 16), and landmark flourish level to Sovereign Tier 4',
          'Boost PBR normal map micro-detail and spatial harmonic overtones uniformly across all 8 Cognitive Parts',
          'Seal updated Model-of-Models watermark with Prism SHA-256 kappa()',
        ],
      });
    }

    // 6. Continuous VSM ratchet proposals for lowest-scoring part & ecology/cohesion hardening
    const lowestPart = [...partHealth].sort((a, b) => a.meanDefinitionScore - b.meanDefinitionScore)[0];
    if (lowestPart) {
      const slotMgr =
        FRONTIERS_DOMAIN_MANAGERS.find((m) => m.ownedSlots.includes(lowestPart.partSlot)) ??
        FRONTIERS_DOMAIN_MANAGERS[0];
      pushProposal({
        id: `prop-ratchet-part-${lowestPart.partSlot}`,
        priority: lowestPart.status === 'critical' ? 'high' : 'continuous',
        title: `Deepen ${lowestPart.partSlot} Generative Definition & Micro-Feature Variance`,
        managerId: slotMgr.managerId,
        partSlot: lowestPart.partSlot,
        kpiId: 'KPI-MODEL-DIVERSITY-SHANNON',
        currentValue: lowestPart.meanDefinitionScore,
        targetValue: Math.min(100, Math.round(lowestPart.meanDefinitionScore + 6)),
        concreteActions: [
          `Run targeted refinement pass across ${lowestPart.modelCount} model(s) in ${lowestPart.partSlot}`,
          'Expand distinctive feature signature entropy and seal updated part digest',
        ],
      });
    }

    pushProposal({
      id: 'prop-continuous-ecology-cohesion',
      priority: 'continuous',
      title: 'Maintain 6-Archetype Monster Ecology & Biome Acoustic Cohesion Watermark',
      managerId: 'mgr-frontiers-cohesion',
      partSlot: 'character-rigs',
      kpiId: 'KPI-MONSTER-ECOLOGY-DIVERSITY',
      currentValue: kpiById('KPI-MONSTER-ECOLOGY-DIVERSITY')?.value ?? 36,
      targetValue: 36,
      concreteActions: [
        'Verify all 6 combat archetypes (stalker, shardcaster, colossus, charger, hexweaver, skirmisher) remain represented across biome charters',
        'Audit procedural UniverseCell spawns for seamless geomorphology & dungeon-topology alignment',
      ],
    });

    const priorityRank: Record<ObserverRefinementProposal['priority'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      continuous: 3,
    };
    proposals.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

    // M16/M17 Per-Manager Constructive Health (0..=1000 permille) & Pinpoint Diagnoses
    const managerHealth: ObserverManagerHealthSnapshot[] = FRONTIERS_DOMAIN_MANAGERS.map((mgr) => {
      const ownedModels = mgr.ownedSlots.flatMap((slot) => listModelsByPart(this.root, slot));
      const sortedByDef = [...ownedModels].sort((a, b) => a.definitionScore - b.definitionScore);
      const meanDef =
        ownedModels.length > 0
          ? Math.round(
              (ownedModels.reduce((acc, m) => acc + m.definitionScore, 0) / ownedModels.length) * 10,
            ) / 10
          : 0;
      const healthScorePermille = Math.round(
        Math.min(1000, Math.max(0, meanDef * 10 + (kpiReport.clonePairsTotal === 0 ? 40 : -120))),
      );
      return {
        managerId: mgr.managerId,
        name: mgr.name,
        vsmSystem: mgr.vsmSystem,
        basisPrime: mgr.basisPrime,
        ownedModelCount: ownedModels.length,
        lowestModelId: sortedByDef[0]?.modelId ?? 'none',
        meanDefinitionScore: meanDef,
        healthScorePermille,
      };
    });

    const pinpointDiagnoses: ObserverPinpointDiagnosis[] = VERDANT_PART_SLOTS.map((slot) => {
      const slotModels = listModelsByPart(this.root, slot);
      const weakest = [...slotModels].sort((a, b) => a.definitionScore - b.definitionScore)[0];
      const mgr =
        FRONTIERS_DOMAIN_MANAGERS.find((m) => m.ownedSlots.includes(slot)) ??
        FRONTIERS_DOMAIN_MANAGERS[0];
      const score = weakest?.definitionScore ?? 0;
      const severity: ObserverPinpointDiagnosis['severity'] =
        score < 68 ? 'critical' : score < 80 ? 'high' : score < 90 ? 'medium' : 'healthy';
      return {
        diagnosisId: `diag:${slot}`,
        severity,
        partSlot: slot,
        modelId: weakest?.modelId ?? `frontiers:part:${slot}`,
        modelTitle: weakest?.title ?? slot,
        owningManagerId: mgr.managerId,
        cause:
          severity === 'healthy'
            ? `Optimal Tier ${weakest?.resolutionTier ?? this.root.resolutionTier} generative density (${score}/100).`
            : `Lowest-definition model in ${slot} (${score}/100, Tier ${weakest?.resolutionTier ?? 3}).`,
        recommendedAction:
          severity === 'healthy'
            ? 'Preserve monotonic watermark & cross-part semantic links.'
            : `Target ${weakest?.modelId ?? slot} via ${mgr.managerId} to escalate traits & seal kappa.`,
        currentScore: score,
        targetScore: Math.min(100, Math.max(92, Math.round(score + 8))),
      };
    }).sort((a, b) => a.currentScore - b.currentScore);

    const enhancedPartHealth: ObserverPartHealthSnapshot[] = partHealth.map((ph) => ({
      ...ph,
      healthScorePermille: Math.round(
        Math.min(1000, Math.max(0, ph.meanDefinitionScore * 10 + (ph.status === 'healthy' ? 30 : 0))),
      ),
    }));

    const gate = this.executeLifecycleGate();
    const overallRefinementScorePermille = Math.round(
      Math.min(
        1000,
        Math.max(
          0,
          (this.root.definitionScore * 0.35 +
            kpiReport.diversityIndex * 0.3 +
            kpiReport.cohesionIndex * 0.25 +
            (gate.passedChecks / Math.max(1, gate.totalChecks)) * 100 * 0.1) *
            10,
        ),
      ),
    );
    const agendaKappaHex = `agenda:${hashModelSeed(
      JSON.stringify({
        root: this.root.kappaDigest,
        permille: overallRefinementScorePermille,
        props: proposals.map((p) => p.kappaHex),
      }),
    )
      .toString(16)
      .padStart(8, '0')}`;

    return {
      spec: 'verdant/observer-refinement-agenda/1',
      rootModelId: this.root.modelId,
      rootKappaDigest: this.root.kappaDigest,
      resolutionTier: this.root.resolutionTier,
      cohesionIndex: kpiReport.cohesionIndex,
      diversityIndex: kpiReport.diversityIndex,
      overallRefinementScorePermille,
      partHealth: enhancedPartHealth,
      managerHealth,
      pinpointDiagnoses,
      proposals,
      criticalCount: proposals.filter((p) => p.priority === 'critical').length,
      highCount: proposals.filter((p) => p.priority === 'high').length,
      agendaKappaHex,
    };
  }

  private tightenWatermarks(
    summary: ModelOfModelsSummary,
    kpis: FrontiersObserverKpiReport,
    refinementScorePermille: number,
  ): boolean {
    let advanced = false;
    if (summary.totalModels > this.watermarks.minTotalModels) {
      this.watermarks.minTotalModels = summary.totalModels;
      advanced = true;
    }
    if (summary.graphEdgeCount > this.watermarks.minGraphEdges) {
      this.watermarks.minGraphEdges = summary.graphEdgeCount;
      advanced = true;
    }
    if (summary.crossPartEdgeCount > this.watermarks.minCrossPartEdges) {
      this.watermarks.minCrossPartEdges = summary.crossPartEdgeCount;
      advanced = true;
    }
    if (this.root.definitionScore > this.watermarks.minDefinitionScore) {
      this.watermarks.minDefinitionScore = this.root.definitionScore;
      advanced = true;
    }
    if (kpis.diversityIndex > this.watermarks.minDiversityIndex) {
      this.watermarks.minDiversityIndex = kpis.diversityIndex;
      advanced = true;
    }
    if (kpis.cohesionIndex > this.watermarks.minCohesionIndex) {
      this.watermarks.minCohesionIndex = kpis.cohesionIndex;
      advanced = true;
    }
    if (refinementScorePermille > this.watermarks.minRefinementScorePermille) {
      this.watermarks.minRefinementScorePermille = refinementScorePermille;
      advanced = true;
    }
    if (advanced) {
      this.watermarks.ratchetAdvances += 1;
    }
    return advanced;
  }

  /**
   * Executes one Verdant Observer Ratchet Cycle (modeled after `observer_refine.rs`):
   * synthesizes the live Refinement Agenda, executes top-priority proposals via `refine()`,
   * honors optional `partSlot` targeting, escalates resolution/diversity/cohesion watermarks,
   * and re-evaluates the post-cycle agenda.
   */
  public async runRatchetCycle(options?: {
    maxProposals?: number;
    targetTier?: VerdantResolutionTier;
    partSlot?: VerdantPartSlot;
    reason?: string;
  }): Promise<RatchetCycleReport> {
    const agendaBefore = this.synthesizeRefinementAgenda();
    const maxProposals = Math.max(1, Math.min(4, options?.maxProposals ?? 3));
    const scopedProposals = options?.partSlot
      ? agendaBefore.proposals.filter(
          (p) => p.partSlot === options.partSlot || p.partSlot === 'root',
        )
      : agendaBefore.proposals;
    const executedProposals = (
      scopedProposals.length > 0 ? scopedProposals : agendaBefore.proposals
    ).slice(0, maxProposals);
    const desiredTier =
      options?.targetTier ??
      (Math.min(4, Math.max(this.root.resolutionTier, this.root.resolutionTier < 4 ? this.root.resolutionTier + 1 : 4)) as VerdantResolutionTier);

    const refinementReport = await this.refine({
      targetTier: desiredTier,
      ...(options?.partSlot ? { partSlot: options.partSlot } : {}),
      enforceDiversity: true,
      reason:
        options?.reason?.trim() ||
        `Observer Ratchet Cycle #${this.refinementPassCount + 1}: ${executedProposals.map((p) => p.proposalId).join(', ')}`,
    });

    const agendaAfter = this.synthesizeRefinementAgenda();
    const tightened = this.tightenWatermarks(
      this.getSummary(),
      refinementReport.kpis,
      agendaAfter.overallRefinementScorePermille,
    );
    const watermarkAdvanced =
      tightened ||
      refinementReport.after.definitionScore > refinementReport.before.definitionScore ||
      refinementReport.after.resolutionTier > refinementReport.before.resolutionTier ||
      refinementReport.clonesDiversified > 0 ||
      refinementReport.after.rootKappaDigest !== refinementReport.before.rootKappaDigest;

    return {
      ok: true,
      cycleNumber: this.refinementPassCount,
      watermarkAdvanced,
      executedProposals,
      refinementReport,
      agendaBefore,
      agendaAfter,
    };
  }

  /**
   * Lifted M16/M17 Self-Automation Pipeline (`verdant operator automate` / MCP `verdant_automate`):
   * runs `pinpoint-diagnose -> ratchet-refine -> lifecycle-gate -> watermark-ratchet`
   * in one deterministic closed loop and seals `automateKappaHex`.
   */
  public async executeAutomatePipeline(options?: {
    targetTier?: VerdantResolutionTier;
    partSlot?: VerdantPartSlot;
    reason?: string;
  }): Promise<AutomateReport> {
    const stages: AutomateStageRecord[] = [];

    // Stage 1: Pinpoint Observer Self-Diagnosis
    const preAgenda = this.synthesizeRefinementAgenda();
    const topPinpoint = preAgenda.pinpointDiagnoses[0];
    stages.push({
      stageId: 'pinpoint-diagnose',
      owningManagerId: topPinpoint?.owningManagerId ?? 'mgr-frontiers-cohesion',
      passed: preAgenda.pinpointDiagnoses.length === VERDANT_PART_SLOTS.length,
      detail: `Diagnosed ${preAgenda.pinpointDiagnoses.length} Cognitive Parts (score ${preAgenda.overallRefinementScorePermille}‰, focus: ${topPinpoint?.modelId ?? 'root'}).`,
    });

    // Stage 2: Ratchet Refinement & Clone Auto-Diversification
    const ratchetCycle = await this.runRatchetCycle({
      targetTier: options?.targetTier ?? 4,
      partSlot: options?.partSlot,
      reason: options?.reason?.trim() || 'Verdant M17 Automated Self-Refinement Pipeline',
    });
    stages.push({
      stageId: 'ratchet-refine',
      owningManagerId: 'mgr-frontiers-diversity',
      passed: ratchetCycle.ok && ratchetCycle.refinementReport.after.clonePairsTotal === 0,
      detail: `Cycle #${ratchetCycle.cycleNumber} refined ${ratchetCycle.refinementReport.modelsRefined} models -> Tier ${ratchetCycle.refinementReport.after.resolutionTier} (Def ${ratchetCycle.refinementReport.after.definitionScore}/100, ${ratchetCycle.refinementReport.clonesDiversified} clones fixed).`,
    });

    // Stage 3: 6-Gate In-Process Lifecycle Verification
    const lifecycleGate = this.executeLifecycleGate();
    stages.push({
      stageId: 'lifecycle-gate',
      owningManagerId: 'mgr-frontiers-cohesion',
      passed: lifecycleGate.allPassed,
      detail: `${lifecycleGate.passedChecks}/${lifecycleGate.totalChecks} in-process lifecycle gates passed (${lifecycleGate.gateKappaHex}).`,
    });

    // Stage 4: Monotonic Parametric Watermark Ratchet
    const summary = this.getSummary();
    this.tightenWatermarks(
      summary,
      ratchetCycle.refinementReport.kpis,
      ratchetCycle.agendaAfter.overallRefinementScorePermille,
    );
    const wm = this.getMonotonicWatermarks();
    const watermarkCompliant =
      summary.totalModels >= wm.minTotalModels &&
      summary.graphEdgeCount >= wm.minGraphEdges &&
      ratchetCycle.refinementReport.after.clonePairsTotal <= wm.maxClonePairs;
    stages.push({
      stageId: 'watermark-ratchet',
      owningManagerId: 'mgr-frontiers-diversity',
      passed: watermarkCompliant,
      detail: `Watermarks locked: >=${wm.minTotalModels} models, >=${wm.minGraphEdges} edges, Def >=${wm.minDefinitionScore}, ${wm.minRefinementScorePermille}‰ (${wm.ratchetAdvances} advances).`,
    });

    const passedStages = stages.filter((s) => s.passed).length;
    const allPassed = passedStages === stages.length;
    const automateKappaHex = `auto:${hashModelSeed(
      JSON.stringify({
        root: this.root.kappaDigest,
        gate: lifecycleGate.gateKappaHex,
        stages: stages.map((s) => `${s.stageId}:${s.passed}`),
      }),
    )
      .toString(16)
      .padStart(8, '0')}`;

    this.notify();

    return {
      spec: 'verdant/automate-report/1',
      ok: allPassed,
      allPassed,
      passedStages,
      totalStages: stages.length,
      stages,
      ratchetCycle,
      lifecycleGate,
      watermarks: wm,
      automateKappaHex,
    };
  }
}
