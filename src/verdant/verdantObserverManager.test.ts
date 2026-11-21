import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrontiersModelOfModels,
  buildModelRelationGraph,
  flattenModelTree,
  getModelById,
  getModelLineage,
  listModelsByPart,
  summarizeModelOfModels,
  VERDANT_PART_SLOTS,
  type VerdantModelNode,
} from './verdantModelOfModels';
import {
  computeCenteredSemanticSpread,
  computeCosineDistance,
  computeJaccardDistance,
  computeNormalizedShannonEntropy,
  FRONTIERS_DOMAIN_MANAGERS,
  FrontiersVerdantObserver,
} from './verdantObserverManager';
import { VerdantDynamicBatcher } from './verdantDynamicGeometry';
import { CANONICAL_REALM_SPECS, realmSurfaceHeightAt } from './realmModelSchema';
import { INITIAL_INTERACTABLES, INITIAL_NPCS } from '../game/worldData';
import { createInitialEnemies } from '../game/rpgLogic';

describe('Single Model-of-Models & Extended Verdant Observer/Manager Pattern', () => {
  it('composes the entire game into a single unified Model-of-Models spanning all 8 canonical Verdant Cognitive Parts', () => {
    const root = buildFrontiersModelOfModels();
    assert.equal(root.modelId, 'frontiers:root:game-model');
    assert.equal(root.parentId, null);
    assert.equal(root.children.length, 8);

    const summary = summarizeModelOfModels(root);
    assert.equal(summary.partsPopulated, 8);
    assert.equal(summary.totalParts, 8);
    assert.ok(summary.totalModels >= 70, `Expected >=70 composed models, got ${summary.totalModels}`);

    for (const slot of VERDANT_PART_SLOTS) {
      const partModels = listModelsByPart(root, slot);
      assert.ok(partModels.length >= 4, `Expected >=4 models in part ${slot}, got ${partModels.length}`);
    }

    // Verify every single node implements uniform Verdant generative characteristics & 8D vTensor vectors
    const allNodes = flattenModelTree(root);
    for (const node of allNodes) {
      assert.ok(node.modelId.length > 0);
      assert.ok(node.resolutionTier >= 1 && node.resolutionTier <= 4);
      assert.ok(node.definitionScore >= 20 && node.definitionScore <= 100);
      assert.ok(node.generativeGenome.generator.length > 0);
      assert.ok(node.featureSignature.length > 0);
      assert.equal(node.semanticVector.length, 8, `Expected 8D semanticVector on ${node.modelId}`);
      for (const v of node.semanticVector) {
        assert.ok(v >= 0 && v <= 1, `Semantic vector component out of [0,1] on ${node.modelId}: ${v}`);
      }
      assert.ok(node.kappaDigest.length > 8);
    }

    assert.ok(getModelById(root, 'frontiers:realm:vaelmor'));
    assert.ok(getModelById(root, 'frontiers:dungeon:vault-of-vaelmor'));
    assert.ok(getModelById(root, 'frontiers:character:npc-orenna'));
    assert.ok(getModelById(root, 'frontiers:fauna:glacial-frostborn'));
    assert.ok(getModelById(root, 'frontiers:relic-archetype:obsidian-crucible'));
    assert.ok(getModelById(root, 'frontiers:framework:multiplayer-expedition-protocol'));
    assert.ok(getModelById(root, 'frontiers:expedition:active-session'));

    // Verify cross-part semantic relational graph & lineage traversal
    const graph = buildModelRelationGraph(root);
    assert.equal(graph.danglingEdges.length, 0, `Unexpected dangling graph edges: ${JSON.stringify(graph.danglingEdges)}`);
    assert.equal(graph.integrityRatio, 1);
    assert.ok(graph.crossPartEdges >= 60, `Expected >=60 cross-part edges, got ${graph.crossPartEdges}`);

    const vaelmorLineage = getModelLineage(root, 'frontiers:realm:vaelmor');
    assert.ok(vaelmorLineage);
    assert.ok(vaelmorLineage.upstream.some((u) => u.relation === 'uses-geomorphology'));
    assert.ok(vaelmorLineage.upstream.some((u) => u.relation === 'governed-by'));
    assert.ok(vaelmorLineage.upstream.some((u) => u.relation === 'uses-materials'));
    assert.ok(vaelmorLineage.upstream.some((u) => u.relation === 'narrated-by'));
    assert.ok(vaelmorLineage.downstream.some((d) => d.relation === 'delves-beneath'));
    assert.ok(vaelmorLineage.crossPartDegree >= 4);
  });

  it('registers 12 Frontiers Domain Managers with unique prime basis continuing Verdant WASM primes (113..179) and enforces differentiation rules', () => {
    assert.equal(FRONTIERS_DOMAIN_MANAGERS.length, 12);
    const primes = FRONTIERS_DOMAIN_MANAGERS.map((m) => m.basisPrime);
    assert.deepEqual(primes, [113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179]);
    assert.equal(new Set(primes).size, 12);
    assert.ok(
      FRONTIERS_DOMAIN_MANAGERS.some((m) => m.managerId === 'mgr-frontiers-multiplayer'),
      'Must include Multiplayer Co-op Federation Manager',
    );
    assert.ok(
      FRONTIERS_DOMAIN_MANAGERS.some((m) => m.managerId === 'mgr-frontiers-journey'),
      'Must include Gamer Journey & Narrative Onboarding Manager',
    );
    assert.ok(
      FRONTIERS_DOMAIN_MANAGERS.some((m) => m.managerId === 'mgr-frontiers-hd-extrapolation'),
      'Must include HD Visual Extrapolation & Painterly Shader Director',
    );
    assert.ok(
      FRONTIERS_DOMAIN_MANAGERS.some((m) => m.managerId === 'mgr-frontiers-character-ontology'),
      'Must include Character Ontology, Species, Class & Progression Manager',
    );

    const coveredSlots = new Set(FRONTIERS_DOMAIN_MANAGERS.flatMap((m) => m.ownedSlots));
    for (const slot of VERDANT_PART_SLOTS) {
      assert.ok(coveredSlots.has(slot), `Verdant Cognitive Part ${slot} must be owned by a Frontiers Domain Manager`);
    }
    for (const m of FRONTIERS_DOMAIN_MANAGERS) {
      assert.ok(
        m.differentiationRequirements.some((r) => r.includes('Executive internals never render directly')),
        `Manager ${m.managerId} must enforce Verdant executive differentiation requirement`,
      );
    }
  });

  it('measures Diversity, Graph Integrity & 8D vTensor Spread accurately and passes all 15 baseline KPIs', () => {
    assert.equal(computeNormalizedShannonEntropy(['a', 'b', 'c', 'd']), 1);
    assert.equal(computeNormalizedShannonEntropy(['a', 'a', 'a', 'a']), 0);
    assert.equal(computeJaccardDistance(['a', 'b'], ['c', 'd']), 1);
    assert.equal(computeJaccardDistance(['a', 'b'], ['a', 'b']), 0);
    assert.equal(computeCosineDistance([1, 0], [0, 1]), 1);
    assert.equal(computeCosineDistance([1, 1], [1, 1]), 0);
    assert.equal(computeCenteredSemanticSpread([0.2, 0.8], [0.2, 0.8]), 0);
    assert.ok(computeCenteredSemanticSpread([0.2, 0.8], [0.8, 0.2]) > 0.9);

    const observer = new FrontiersVerdantObserver();
    const kpis = observer.observeKpis();
    assert.equal(kpis.spec, 'frontiers/verdant-observer-kpi-report/2');
    assert.equal(kpis.kpis.length, 15);
    assert.equal(kpis.clonePairsTotal, 0, 'Canonical world must have 0 clone pairs');
    assert.ok(kpis.diversityIndex >= 80, `Expected high diversityIndex >=80, got ${kpis.diversityIndex}`);
    assert.ok(kpis.cohesionIndex >= 90, `Expected high cohesionIndex >=90, got ${kpis.cohesionIndex}`);
    assert.equal(
      kpis.allPassed,
      true,
      `Expected all 15 baseline Observer KPIs to pass: ${JSON.stringify(kpis.kpis.filter((k) => !k.passed))}`,
    );
  });

  it('detects injected clones across realms AND monster-species, auto-diversifies them, records Prism kappa audit ledger, and honors targeted partSlot ratchet cycles', async () => {
    const observer = new FrontiersVerdantObserver();
    const vaelmor = observer.getModel('frontiers:realm:vaelmor');
    const stalker = observer.getModel('frontiers:monster:citadel-highlands:stalker');
    assert.ok(vaelmor);
    assert.ok(stalker);

    // Deliberately inject clones in both stage-environment (realm) and character-rigs (monster-species)
    const cloneRealm: VerdantModelNode = {
      ...vaelmor,
      modelId: 'frontiers:realm:vaelmor-duplicate-test',
      title: 'Duplicate Highland Test',
      featureSignature: [...vaelmor.featureSignature],
      semanticVector: [...vaelmor.semanticVector],
      generativeGenome: {
        ...vaelmor.generativeGenome,
        traits: { ...vaelmor.generativeGenome.traits },
      },
      children: [],
    };
    const cloneMonster: VerdantModelNode = {
      ...stalker,
      modelId: 'frontiers:monster:citadel-highlands:stalker-clone-test',
      title: 'Duplicate Stalker Test',
      featureSignature: [...stalker.featureSignature],
      semanticVector: [...stalker.semanticVector],
      generativeGenome: {
        ...stalker.generativeGenome,
        traits: { ...stalker.generativeGenome.traits },
      },
      children: [],
    };
    observer.registerModel('stage-environment', cloneRealm);
    observer.registerModel('character-rigs', cloneMonster);

    const beforeKpis = observer.observeKpis();
    assert.ok(beforeKpis.clonePairsTotal >= 2, `Expected >=2 detected clones, got ${beforeKpis.clonePairsTotal}`);
    const uniquenessBefore = beforeKpis.kpis.find((k) => k.id === 'KPI-SIBLING-UNIQUENESS');
    assert.equal(uniquenessBefore?.passed, false, 'Sibling uniqueness KPI must fail when clones exist');

    // Run Uniform Refinement API to Tier 4 Sovereign Ultra-Def with enforceDiversity: true
    const report = await observer.refine({
      targetTier: 4,
      enforceDiversity: true,
      reason: 'Unit test uniform Tier 4 escalation & multi-domain clone resolution',
    });

    assert.equal(report.ok, true);
    assert.equal(report.after.resolutionTier, 4);
    assert.ok(report.after.definitionScore > report.before.definitionScore);
    assert.ok(report.clonesDiversified >= 2, `Expected >=2 auto-diversified clones, got ${report.clonesDiversified}`);
    assert.equal(report.after.clonePairsTotal, 0, 'Zero clone pairs should remain after auto-diversification');
    assert.equal(report.kpis.allPassed, true, 'All 15 Observer KPIs must pass after Uniform Refinement');
    assert.match(report.after.rootKappaDigest, /^sha256:[0-9a-f]{64}$/);
    assert.notEqual(report.after.rootKappaDigest, report.before.rootKappaDigest);
    assert.equal(report.managersInvoked.length, 12);

    const diversifiedRealm = observer.getModel('frontiers:realm:vaelmor-duplicate-test');
    const diversifiedMonster = observer.getModel('frontiers:monster:citadel-highlands:stalker-clone-test');
    assert.equal(diversifiedRealm?.generativeGenome.diversifiedFrom, 'frontiers:realm:vaelmor');
    assert.equal(diversifiedMonster?.generativeGenome.diversifiedFrom, 'frontiers:monster:citadel-highlands:stalker');

    // Verify targeted partSlot ratchet cycle + live multiplayer session sync + immutable Audit Ledger
    observer.syncWorldState({
      multiplayer: {
        roomCode: 'VAEL-TEST',
        activeRealmSlug: 'vault-of-vaelmor',
        activeRealmName: 'The Sunken Meridian Vault',
        onlinePlayers: 3,
        sameRealmAllies: 2,
        activePings: 1,
        activeSummonRealm: 'vault-of-vaelmor',
      },
    });
    const sessionNode = observer.getModel('frontiers:expedition:active-session');
    assert.equal(sessionNode?.generativeGenome.traits.roomCode, 'VAEL-TEST');
    assert.equal(sessionNode?.generativeGenome.traits.onlinePlayers, 3);
    const sessionLineage = observer.getModelLineage('frontiers:expedition:active-session');
    assert.ok(sessionLineage?.upstream.some((u) => u.node.modelId === 'frontiers:dungeon:vault-of-vaelmor'));

    const scopedCycle = await observer.runRatchetCycle({
      partSlot: 'spatial-acoustics',
      targetTier: 4,
      reason: 'Targeted acoustics ratchet test',
    });
    assert.equal(scopedCycle.refinementReport.scope, 'part:spatial-acoustics');
    const ledger = observer.getAuditLedger();
    assert.equal(ledger.length, 2, 'Audit ledger must retain both refinement passes');
    assert.equal(ledger[1].scope, 'part:spatial-acoustics');
    assert.match(ledger[1].nextKappaDigest, /^sha256:[0-9a-f]{64}$/);
  });

  it('scales dynamic 3D mesh tessellation and sovereign flourishes monotonically when modelResolutionTier escalates from Tier 2 -> Tier 3 -> Tier 4', () => {
    const spec = CANONICAL_REALM_SPECS[0];
    const [sx, sz] = spec.spawnPoint;
    const py = realmSurfaceHeightAt(spec, sx, sz);
    const batcher = new VerdantDynamicBatcher();
    const baseInput = {
      timeSec: 2.0,
      playerX: sx,
      playerY: py,
      playerZ: sz,
      playerYaw: Math.PI,
      playerSpeed: 4.5,
      attackSwing: 0,
      activeGear: 'hookblade' as const,
      dodgeTimer: 0,
      npcs: INITIAL_NPCS,
      enemies: createInitialEnemies(),
      interactables: INITIAL_INTERACTABLES,
      banners: [],
      remotePlayers: [],
      projectiles: [],
      particles: [],
      slashes: [],
      trackedCoords: [0, 0] as [number, number],
      highlightInteractableId: null,
      heightAt: (x: number, z: number) => realmSurfaceHeightAt(spec, x, z),
      waterLevel: spec.terrainProfile.waterLevel,
      ambientParticleKind: 'golden-motes' as const,
      ambientRgb: [0.95, 0.82, 0.46] as [number, number, number],
      playerRelicAuraRgb: [0.95, 0.78, 0.34] as [number, number, number],
    };

    const vertsT2 = batcher.build({ ...baseInput, modelResolutionTier: 2 }).pos.length / 3;
    const vertsT3 = batcher.build({ ...baseInput, modelResolutionTier: 3 }).pos.length / 3;
    const vertsT4 = batcher.build({ ...baseInput, modelResolutionTier: 4 }).pos.length / 3;

    assert.ok(vertsT3 > vertsT2, `Expected Tier 3 verts (${vertsT3}) > Tier 2 (${vertsT2})`);
    assert.ok(vertsT4 > vertsT3, `Expected Tier 4 Sovereign verts (${vertsT4}) > Tier 3 (${vertsT3})`);
  });

  it('executes M16/M17 lifted Lifecycle Gate (7/7), Pinpoint Diagnoses, Monotonic Parametric Watermarks, and Self-Automation Pipeline', async () => {
    const observer = new FrontiersVerdantObserver();

    // 1. Agenda includes constructive per-manager health, pinpoint diagnoses, and sealed agendaKappaHex
    const agendaBefore = observer.synthesizeRefinementAgenda();
    assert.equal(agendaBefore.managerHealth.length, 12);
    for (const mh of agendaBefore.managerHealth) {
      assert.ok(mh.healthScorePermille >= 0 && mh.healthScorePermille <= 1000);
    }
    assert.ok(agendaBefore.overallRefinementScorePermille >= 700 && agendaBefore.overallRefinementScorePermille <= 1000);
    assert.match(agendaBefore.agendaKappaHex, /^agenda:[0-9a-f]{8}$/);
    assert.equal(agendaBefore.pinpointDiagnoses.length, 8, 'Every Cognitive Part should have a pinpoint diagnosis');

    // 2. Lifted 7-gate Lifecycle Gate passes cleanly
    const gateBefore = observer.executeLifecycleGate();
    assert.equal(gateBefore.spec, 'verdant/lifecycle-gate-report/1');
    assert.equal(gateBefore.totalChecks, 7);
    assert.equal(gateBefore.passedChecks, 7);
    assert.equal(gateBefore.allPassed, true);
    assert.match(gateBefore.gateKappaHex, /^gate:[0-9a-f]{8}$/);

    // 3. Monotonic watermarks capture baseline floors and only tighten upward
    const wmBefore = observer.getMonotonicWatermarks();
    assert.equal(wmBefore.spec, 'prism/parametric-ratchet/2');
    assert.ok(wmBefore.minTotalModels >= 70);

    // 4. Execute full M16/M17 Automate Pipeline
    const autoReport = await observer.executeAutomatePipeline({
      reason: 'Unit test M17 lifted automate pipeline',
    });
    assert.equal(autoReport.spec, 'verdant/automate-report/1');
    assert.equal(autoReport.ratchetCycle.cycleNumber, 1);
    assert.equal(autoReport.totalStages, 4);
    assert.equal(autoReport.passedStages, 4);
    assert.equal(autoReport.allPassed, true);
    assert.equal(autoReport.lifecycleGate.allPassed, true);
    assert.equal(autoReport.lifecycleGate.passedChecks, 7);
    assert.match(autoReport.automateKappaHex, /^auto:[0-9a-f]{8}$/);
    assert.ok(autoReport.watermarks.minDiversityIndex >= wmBefore.minDiversityIndex);
    assert.ok(autoReport.watermarks.minCohesionIndex >= wmBefore.minCohesionIndex);
    assert.ok(autoReport.watermarks.minDefinitionScore >= wmBefore.minDefinitionScore);
    assert.ok(
      autoReport.ratchetCycle.agendaAfter.overallRefinementScorePermille >=
        agendaBefore.overallRefinementScorePermille,
      'Overall refinement score must not regress after automate pipeline',
    );
    assert.equal(observer.getAuditLedger().length, 1);
  });
});
