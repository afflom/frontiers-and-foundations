import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPrism, kappa } from './prism-id.mjs';
import { VerdantDynamicBatcher } from './verdantDynamicGeometry';
import {
  ALL_CANONICAL_WORLDS,
  CANONICAL_DUNGEON_SPECS,
  CANONICAL_REALM_SPECS,
  getRealmRegionAt,
  realmSurfaceHeightAt,
} from './realmModelSchema';
import {
  getCanonicalSoundtrackForTheme,
  synthesizeScoreFromBrief,
} from './verdantScoreSchema';
import { VERDANT_MCP_TOOLS, VerdantMcpHost } from './verdantMcpHost';
import { INITIAL_INTERACTABLES, INITIAL_NPCS } from '../game/worldData';
import { createInitialEnemies } from '../game/rpgLogic';

describe('Verdant Engine (verdant-uorc.wasm) + 12-World Federation + 23 MCP Tools + Bespoke Ecosystems & Dungeons + Procedural Universe & Characters + Orchestral Score + Prism + Stitch', () => {
  it('boots blank stage, imports vast 224m Frontiers & Foundations PBR GLB, verifies Stitch 2-of-3 recovery, and seals Prism identity', async () => {
    const verdantDir = join(process.cwd(), 'public', 'verdant');
    const wasmBytes = readFileSync(join(verdantDir, 'verdant-uorc.wasm'));
    const glbBytes = readFileSync(join(verdantDir, 'frontiers-world.glb'));
    const manifest = JSON.parse(readFileSync(join(verdantDir, 'prism-world-manifest.json'), 'utf8'));

    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = instance.exports as Record<string, any> & { memory: WebAssembly.Memory };

    const stageIo = (bytes: Uint8Array) => {
      const ptr = ex.verdant_wasm_io_resize(bytes.byteLength >>> 0) >>> 0;
      new Uint8Array(ex.memory.buffer, ptr, bytes.byteLength).set(bytes);
    };
    const readAux = () => {
      const len = ex.verdant_wasm_aux_len() >>> 0;
      const ptr = ex.verdant_wasm_aux_ptr() >>> 0;
      return new Uint8Array(ex.memory.buffer, ptr, len).slice();
    };

    ex.verdant_wasm_init(7777n);
    ex.verdant_wasm_update_host_envelope_uhd(2048, 0, 4, 8000, 1440, 900);
    assert.ok((ex.verdant_wasm_studio_load_blank_stage() >>> 0) > 0, 'Blank stage must load cleanly');

    stageIo(glbBytes);
    const tris = ex.verdant_wasm_glb_import_io() >>> 0;
    assert.ok(tris > 18000, `Expected >18k triangles for vast 224m Vaelmor with imported 3D models, got ${tris}`);
    assert.equal(ex.verdant_wasm_glb_atlas_tile_count() >>> 0, 4, 'Expected 4 Poly Haven PBR atlas tiles');
    assert.ok((ex.verdant_wasm_scene_pbr_tex_width(0) >>> 0) >= 512, 'Albedo atlas must be decoded');
    assert.ok((ex.verdant_wasm_scene_pbr_tex_width(1) >>> 0) >= 512, 'Metallic-Roughness atlas must be decoded');
    assert.ok((ex.verdant_wasm_scene_pbr_tex_width(2) >>> 0) >= 512, 'Normal map atlas must be decoded');

    const snapshot = readAux();
    assert.ok(snapshot.byteLength > 100, 'Authenticated VDNT snapshot must be emitted');

    // Stitch 2-of-3 Reed-Solomon sharding & lossless recovery
    const shards: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      stageIo(snapshot);
      const sLen = ex.verdant_wasm_stitch_shard_io(i) >>> 0;
      assert.ok(sLen > 0, `Shard ${i} must be generated`);
      shards.push(readAux());
    }
    const pair = new Uint8Array(shards[0].byteLength + shards[2].byteLength);
    pair.set(shards[0], 0);
    pair.set(shards[2], shards[0].byteLength);
    stageIo(pair);
    const recLen = ex.verdant_wasm_stitch_recover_io(shards[0].byteLength) >>> 0;
    assert.equal(recLen, snapshot.byteLength, 'Recovered length must match original snapshot');
    assert.deepEqual(readAux(), snapshot, 'Stitch 2-of-3 recovery must be bit-exact');

    // Prism cryptographic identity & kappa content addressing
    const prismSession = await createPrism({ deviceClass: 'native', protection: 'software' });
    assert.match(prismSession.prism, /^sha256:[0-9a-f]{64}$/, 'Prism identity must be a valid sha256 root');
    const digest = await kappa({ title: manifest.title, tris });
    assert.match(digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(manifest.engine.defaultStudioContentExcluded, true);
  });

  it('compiles all 12 Federated Worlds (6 vast 224m Realms + 6 playable 3D Dungeons) with Poly Haven CC0 3D models, 8-part hydration, and Stitch verification', () => {
    const verdantDir = join(process.cwd(), 'public', 'verdant');
    const manifest = JSON.parse(readFileSync(join(verdantDir, 'prism-world-manifest.json'), 'utf8'));
    assert.ok(Array.isArray(manifest.federatedRealms), 'Manifest must list federatedRealms');
    assert.equal(manifest.overworldRealmsCount, 6, 'Expected 6 vast overworld realms');
    assert.equal(manifest.dungeonsCount, 6, 'Expected 6 playable 3D dungeons');
    assert.ok(manifest.federatedRealms.length >= 12, 'Expected at least 12 compiled federated worlds');

    const expectedRealms = ['vaelmor', 'oakhaven', 'cinderfall', 'glasswater', 'kar-veth', 'borealis'];
    const expectedDungeons = [
      'vault-of-vaelmor',
      'oakhaven-cistern-labyrinth',
      'cinderfall-magma-delve',
      'glasswater-abyssal-grotto',
      'karveth-echo-tomb',
      'borealis-frostglass-crypt',
    ];

    for (const expectedSlug of [...expectedRealms, ...expectedDungeons]) {
      const entry = manifest.federatedRealms.find((r: { slug: string }) => r.slug === expectedSlug);
      assert.ok(entry, `Missing compiled world ${expectedSlug}`);
      const c = entry.custody;
      assert.ok(c, `Missing custody record for ${expectedSlug}`);
      assert.ok(c.triangles > 8000, `${expectedSlug} must have >8k triangles, got ${c.triangles}`);
      assert.ok(c.importedCatalogModelsCount >= 4, `${expectedSlug} must import >=4 real Poly Haven 3D models`);
      assert.equal(c.observerPartsHydrated, 8, `${expectedSlug} must hydrate all 8 ObserverPartSlots`);
      assert.equal(c.operatorAdmitted, true, `${expectedSlug} must be admitted by Verdant Operator`);
      assert.equal(c.stitchRecoveryVerified, true, `${expectedSlug} must pass Stitch 2-of-3 recovery`);
      assert.ok(
        existsSync(join(verdantDir, 'realms', expectedSlug, 'world.glb')),
        `${expectedSlug} world.glb must exist on disk`,
      );
      assert.ok(
        existsSync(join(verdantDir, 'realms', expectedSlug, 'realm.json')),
        `${expectedSlug} realm.json must exist on disk`,
      );
    }

    // Verify the 6 compiled 3D dungeons are architecturally bespoke (distinct triangle counts, never 6 identical clones!)
    const dungeonTris = new Set(
      expectedDungeons.map(
        (slug) => manifest.federatedRealms.find((r: { slug: string }) => r.slug === slug)?.custody?.triangles,
      ),
    );
    assert.ok(
      dungeonTris.size >= 5,
      `Expected >= 5 distinct compiled 3D dungeon triangle counts across 6 dungeons, got ${dungeonTris.size}`,
    );
  });

  it('exposes all 33 real verdant-uorc.wasm-backed MCP tools including unified Model-of-Models, Character Ontology, HD Visual Extrapolation, 25-Manager Extended Observer Diversity & Cohesion KPIs, M16/M17 Lifecycle Gate, Refinement Agenda, Ratchet Cycle & Verdant Automate, Uniform Refinement API, extensible catalogs, procedural UniverseCell & character synthesis, HD rigs, score, questline, NPC cast, relic arsenal, and Stitch tools', async () => {
    assert.equal(VERDANT_MCP_TOOLS.length, 33, 'Expected 33 Verdant MCP tools');

    const mcp = new VerdantMcpHost(process.cwd());
    await mcp.ensureReady();

    const status = (await mcp.handleToolCall('verdant_status', {}, null)) as {
      engine: string;
      compiledRealmsCount: number;
      overworldRealmsCount: number;
      dungeonsCount: number;
      blankStageVerified: boolean;
      defaultStudioContentExcluded: boolean;
      projectModelsCount: number;
    };
    assert.ok(status.engine.includes('verdant-uorc.wasm'));
    assert.equal(status.blankStageVerified, true);
    assert.equal(status.defaultStudioContentExcluded, true);
    assert.ok(status.overworldRealmsCount >= 6);
    assert.ok(status.dungeonsCount >= 6);
    assert.ok(status.compiledRealmsCount >= 12);
    assert.ok(status.projectModelsCount >= 12);

    const directiveRes = (await mcp.handleToolCall(
      'verdant_operator_directive',
      { directive: 'Verify Frontiers and Foundations 12-world federation compliance', viewpoint: 'auto' },
      null,
    )) as { admitted?: boolean };
    assert.equal(directiveRes.admitted, true, 'Verdant Wasm Operator Channel must admit governance directive');

    const scoreRes = (await mcp.handleToolCall(
      'verdant_compose_score',
      {
        realmSlug: 'borealis',
        realmName: 'The Frostglass Bastion of Borealis',
        theme: 'glacial-spire',
        brief: 'aurora harmonics crystalline flute and cello',
      },
      null,
    )) as { realmSlug: string; soundtrack: { title: string; mode: string; bpm: number; reverbDecaySec: number; melodyMotif: unknown[] }; projectModel: unknown };
    assert.equal(scoreRes.realmSlug, 'borealis');
    assert.ok(scoreRes.soundtrack.title.length > 4);
    assert.ok(scoreRes.soundtrack.reverbDecaySec > 1.0);
    assert.ok(scoreRes.soundtrack.melodyMotif.length > 0);
    assert.ok(scoreRes.projectModel, 'Score must be registered as a MusicComposition Project Model in Wasm');

    const questRes = (await mcp.handleToolCall(
      'verdant_generate_questline',
      { realmSlug: 'kar-veth', brief: 'Stabilize monolith wind relays across the amber steppe' },
      null,
    )) as { quest: { title: string; objectives: unknown[] }; noveltyAudit: { verdict: string } };
    assert.ok(questRes.quest.title.length > 4);
    assert.equal(questRes.quest.objectives.length, 3);
    assert.equal(questRes.noveltyAudit.verdict, 'original');

    const npcRes = (await mcp.handleToolCall(
      'verdant_generate_npc_cast',
      { realmSlug: 'borealis', count: 3 },
      null,
    )) as { npcs: unknown[]; noveltyAudit: { verdict: string } };
    assert.equal(npcRes.npcs.length, 3);
    assert.equal(npcRes.noveltyAudit.verdict, 'original');

    const relicRes = (await mcp.handleToolCall(
      'verdant_generate_relic_arsenal',
      { realmSlug: 'vaelmor', count: 3 },
      null,
    )) as { relics: unknown[]; noveltyAudit: { verdict: string } };
    assert.equal(relicRes.relics.length, 3);
    assert.equal(relicRes.noveltyAudit.verdict, 'original');

    const payload = 'Frontiers-and-Foundations-Meridian-Charter-Seal-v3';
    const sealed = (await mcp.handleToolCall('verdant_stitch_seal', { payload }, null)) as {
      shardsBase64: string[];
      kappaDigest: string;
    };
    assert.equal(sealed.shardsBase64.length, 3);
    assert.match(sealed.kappaDigest, /^sha256:[0-9a-f]{64}$/);

    const recovered = (await mcp.handleToolCall(
      'verdant_stitch_recover',
      { shardA: sealed.shardsBase64[0], shardB: sealed.shardsBase64[2] },
      null,
    )) as { payload: string };
    assert.equal(recovered.payload, payload, 'Verdant Wasm Stitch 2-of-3 recovery must match bit-for-bit');

    // Verify portrait-matched HD CharacterRig compilation via Verdant API
    const tarsikRig = (await mcp.handleToolCall(
      'verdant_compile_character_rig',
      { npcId: 'npc-tarsik', realmSlug: 'vaelmor' },
      null,
    )) as {
      npcId: string;
      appearance: {
        portraitArchetype: string;
        garmentStyle: string;
        bareForearms: boolean;
        signatureProp: string;
      };
      projectModel: unknown;
    };
    assert.equal(tarsikRig.npcId, 'npc-tarsik');
    assert.equal(tarsikRig.appearance.portraitArchetype, 'tarsik');
    assert.equal(tarsikRig.appearance.garmentStyle, 'smith-apron');
    assert.equal(tarsikRig.appearance.bareForearms, true);
    assert.equal(tarsikRig.appearance.signatureProp, 'tuning-fork');
    assert.ok(tarsikRig.projectModel, 'CharacterRig must be registered in verdant-uorc.wasm');

    // Verify automated HD refinement across all 12 federated realms via Verdant API
    const hdRefine = (await mcp.handleToolCall('verdant_refine_world_hd', {}, null)) as {
      realmsRefined: number;
      rigsCompiled: number;
      distinctArchetypes: string[];
      refinementKappa: string;
      operatorDecision: { admitted?: boolean };
    };
    assert.ok(hdRefine.realmsRefined >= 12, `Expected >=12 realms refined, got ${hdRefine.realmsRefined}`);
    assert.ok(hdRefine.rigsCompiled >= 10, `Expected >=10 HD rigs compiled, got ${hdRefine.rigsCompiled}`);
    assert.ok(hdRefine.distinctArchetypes.length >= 4, 'All 4 canonical portrait archetypes plus synthesized outer-realm genomes must be compiled');
    assert.equal(hdRefine.operatorDecision?.admitted, true);
    assert.match(hdRefine.refinementKappa, /^sha256:[0-9a-f]{64}$/);

    // Verify HD Visual Extrapolation MCP tool backed by verdant-uorc.wasm
    const hdExtrap = (await mcp.handleToolCall(
      'verdant_extrapolate_hd_profile',
      { realmSlug: 'vaelmor', resolutionTier: 4 },
      null,
    )) as {
      blueprint: {
        spec: string;
        overallFidelityScore: number;
        pointLights: unknown[];
        partExtrapolations: Record<string, unknown>;
      };
      projectModel: unknown;
    };
    assert.equal(hdExtrap.blueprint.spec, 'verdant/hd-visual-extrapolation-blueprint/1');
    assert.equal(Object.keys(hdExtrap.blueprint.partExtrapolations).length, 8);
    assert.ok(hdExtrap.blueprint.overallFidelityScore >= 92);
    assert.ok(hdExtrap.blueprint.pointLights.length >= 5);
    assert.ok(hdExtrap.projectModel, 'HD blueprint must be registered as a Project Model in verdant-uorc.wasm');

    // Verify boundless procedural UniverseCell synthesis via Verdant MCP + real WASM GLB import
    const synthCell = (await mcp.handleToolCall(
      'verdant_synthesize_universe_cell',
      { cx: 2, cz: -1 },
      null,
    )) as {
      triangles: number;
      cellKappa: string;
      realm: { cell: number[]; isProceduralCell: boolean; npcs: Array<{ portraitUrl: string; appearance?: unknown }> };
    };
    assert.deepEqual(synthCell.realm.cell, [2, 0, -1]);
    assert.equal(synthCell.realm.isProceduralCell, true);
    assert.ok(synthCell.triangles > 5000, `Expected >5000 triangles for synthesized cell, got ${synthCell.triangles}`);
    assert.equal(synthCell.realm.npcs.length, 3);
    assert.ok(synthCell.realm.npcs[0].portraitUrl.startsWith('data:image/svg+xml'));
    assert.ok(synthCell.realm.npcs[0].appearance);
    assert.match(synthCell.cellKappa, /^sha256:[0-9a-f]{64}$/);

    // Verify procedural character synthesis via Verdant MCP
    const synthChar = (await mcp.handleToolCall(
      'verdant_synthesize_character',
      { theme: 'amber-steppe', realmName: 'Saffron Reaches', roleHint: 'scholar', seed: 9191 },
      null,
    )) as {
      npc: { name: string; portraitUrl: string; cognitiveDrive: string; choices: unknown[] };
      appearance: { portraitArchetype: string; traitSummary?: string };
      projectModel: unknown;
    };
    assert.ok(synthChar.npc.name.length > 4);
    assert.ok(synthChar.npc.portraitUrl.startsWith('data:image/svg+xml'));
    assert.equal(synthChar.appearance.portraitArchetype, 'synthesized');
    assert.ok(synthChar.npc.choices.length >= 3);
    assert.ok(synthChar.projectModel);

    // Verify live Verdant Catalog extension & bespoke Ecosystem synthesis via Verdant MCP
    const extRes = (await mcp.handleToolCall(
      'verdant_catalog_extend',
      {
        id: 'arch-integration-wind-monastery',
        category: 'layout',
        title: 'Aeolian Wind-Monastery',
        summary: 'Cliffside resonant bells and stepped viaduct arches.',
        tags: ['aeolian', 'monastery'],
      },
      null,
    )) as {
      extension: { id: string; category: string };
      totalCatalogExtensions: number;
      catalogKappa: string;
      projectModel: unknown;
    };
    assert.equal(extRes.extension.id, 'arch-integration-wind-monastery');
    assert.ok(extRes.totalCatalogExtensions >= 26);
    assert.match(extRes.catalogKappa, /^sha256:[0-9a-f]{64}$/);
    assert.ok(extRes.projectModel);

    const oakhavenEco = (await mcp.handleToolCall(
      'verdant_synthesize_ecosystem',
      { realmSlug: 'oakhaven' },
      null,
    )) as {
      ecosystem: { layoutId: string; floraKit: string; faunaKit: string; phenomenon: { id: string }; structureCount: number };
      ecosystemKappa: string;
    };
    const cinderfallEco = (await mcp.handleToolCall(
      'verdant_synthesize_ecosystem',
      { realmSlug: 'cinderfall' },
      null,
    )) as {
      ecosystem: { layoutId: string; floraKit: string; faunaKit: string; phenomenon: { id: string }; thermalVentCount: number };
      ecosystemKappa: string;
    };
    assert.notEqual(oakhavenEco.ecosystem.layoutId, cinderfallEco.ecosystem.layoutId);
    assert.notEqual(oakhavenEco.ecosystem.floraKit, cinderfallEco.ecosystem.floraKit);
    assert.notEqual(oakhavenEco.ecosystem.faunaKit, cinderfallEco.ecosystem.faunaKit);
    assert.notEqual(oakhavenEco.ecosystem.phenomenon.id, cinderfallEco.ecosystem.phenomenon.id);
    assert.ok(cinderfallEco.ecosystem.thermalVentCount >= 4);
    assert.match(oakhavenEco.ecosystemKappa, /^sha256:[0-9a-f]{64}$/);

    // Verify bespoke 3D Dungeon Architecture synthesis via Verdant MCP tool #23
    const grottoDg = (await mcp.handleToolCall(
      'verdant_synthesize_dungeon_architecture',
      { dungeonSlug: 'glasswater-abyssal-grotto' },
      null,
    )) as {
      dungeonArchitecture: { style: string; faunaKit: string; chasmVisual: string; structureCount: number };
      dungeonKappa: string;
      projectModel: unknown;
    };
    const magmaDg = (await mcp.handleToolCall(
      'verdant_synthesize_dungeon_architecture',
      { dungeonSlug: 'cinderfall-magma-delve' },
      null,
    )) as {
      dungeonArchitecture: { style: string; faunaKit: string; chasmVisual: string; thermalVentCount: number };
      dungeonKappa: string;
      projectModel: unknown;
    };
    assert.equal(grottoDg.dungeonArchitecture.style, 'abyssal-grotto');
    assert.equal(magmaDg.dungeonArchitecture.style, 'geothermal-depths');
    assert.notEqual(grottoDg.dungeonArchitecture.faunaKit, magmaDg.dungeonArchitecture.faunaKit);
    assert.notEqual(grottoDg.dungeonArchitecture.chasmVisual, magmaDg.dungeonArchitecture.chasmVisual);
    assert.ok(magmaDg.dungeonArchitecture.thermalVentCount >= 5);
    assert.match(grottoDg.dungeonKappa, /^sha256:[0-9a-f]{64}$/);
    assert.ok(grottoDg.projectModel);

    // Verify bespoke Biome Relic synthesis via Verdant MCP tool #24
    const synthRelic = (await mcp.handleToolCall(
      'verdant_synthesize_relic',
      { realmSlug: 'cinderfall', rarity: 'Sovereign', seed: 7777, brief: 'caldera assault' },
      null,
    )) as {
      relic: { name: string; rarity: string; perkId: string; sigilSvg: string; auraRgb: number[] };
      relicKappa: string;
      projectModel: unknown;
    };
    assert.equal(synthRelic.relic.rarity, 'Sovereign');
    assert.equal(synthRelic.relic.perkId, 'ember-cleave');
    assert.ok(synthRelic.relic.sigilSvg.startsWith('data:image/svg+xml;utf8,'));
    assert.equal(synthRelic.relic.auraRgb.length, 3);
    assert.match(synthRelic.relicKappa, /^sha256:[0-9a-f]{64}$/);
    assert.ok(synthRelic.projectModel);

    // Verify unified Model-of-Models inspection (MCP tool #25)
    const modelInspect = (await mcp.handleToolCall(
      'verdant_inspect_model_of_models',
      { partSlot: 'stage-environment' },
      null,
    )) as {
      summary: { rootModelId: string; totalModels: number; partsPopulated: number; totalParts: number };
      partModels: unknown[];
    };
    assert.equal(modelInspect.summary.rootModelId, 'frontiers:root:game-model');
    assert.equal(modelInspect.summary.partsPopulated, 8);
    assert.equal(modelInspect.summary.totalParts, 8);
    assert.ok(modelInspect.summary.totalModels >= 70);
    assert.ok(modelInspect.partModels.length >= 12);

    // Verify Extended Verdant Observer/Manager Pattern + Diversity & Cohesion KPIs (MCP tool #26)
    const kpiRes = (await mcp.handleToolCall(
      'verdant_observer_diversity_kpis',
      { includeManagers: true },
      null,
    )) as {
      managersCount: number;
      wasmManagersCount: number;
      frontiersManagersCount: number;
      kpis: { allPassed: boolean; diversityIndex: number; cohesionIndex: number; clonePairsTotal: number; kpis: unknown[] };
    };
    assert.equal(kpiRes.wasmManagersCount, 13, 'Must merge all 13 native verdant-uorc.wasm VSM Managers');
    assert.equal(kpiRes.frontiersManagersCount, 12, 'Must register all 12 Frontiers Domain Managers');
    assert.equal(kpiRes.managersCount, 25, 'Expected 25 total VSM Managers');
    assert.equal(kpiRes.kpis.kpis.length, 15);
    assert.equal(kpiRes.kpis.allPassed, true);
    assert.equal(kpiRes.kpis.clonePairsTotal, 0);
    assert.ok(kpiRes.kpis.diversityIndex >= 80);
    assert.ok(kpiRes.kpis.cohesionIndex >= 90);

    // Verify M16 Observer Refinement Agenda (MCP tool #27)
    const agendaRes = (await mcp.handleToolCall(
      'verdant_observer_refinement_agenda',
      { includeManagers: false },
      null,
    )) as {
      agenda: { spec: string; cohesionIndex: number; partHealth: unknown[]; proposals: unknown[] };
      managersCount: number;
    };
    assert.equal(agendaRes.agenda.spec, 'verdant/observer-refinement-agenda/1');
    assert.equal(agendaRes.agenda.partHealth.length, 8);
    assert.ok(agendaRes.agenda.proposals.length >= 1);
    assert.equal(agendaRes.managersCount, 25);

    // Verify M16 Observer Ratchet Cycle (MCP tool #28)
    const ratchetRes = (await mcp.handleToolCall(
      'verdant_run_ratchet_cycle',
      { targetTier: 4, reason: 'Integration test M16 Observer Ratchet Cycle' },
      null,
    )) as {
      report: {
        ok: boolean;
        cycleNumber: number;
        watermarkAdvanced: boolean;
        refinementReport: { after: { resolutionTier: number; definitionScore: number; rootKappaDigest: string } };
      };
      projectModel: unknown;
    };
    assert.equal(ratchetRes.report.ok, true);
    assert.equal(ratchetRes.report.cycleNumber, 1);
    assert.equal(ratchetRes.report.watermarkAdvanced, true);
    assert.equal(ratchetRes.report.refinementReport.after.resolutionTier, 4);
    assert.ok(ratchetRes.projectModel, 'Ratchet cycle snapshot must be registered in verdant-uorc.wasm');

    // Verify Uniform Refinement API via MCP tool #29 (Tier 4 Sovereign Ultra-Def)
    const uniformRefine = (await mcp.handleToolCall(
      'verdant_refine_model_api',
      { targetTier: 4, enforceDiversity: true, reason: 'Integration test uniform Tier 4 escalation' },
      null,
    )) as {
      report: {
        ok: boolean;
        modelsRefined: number;
        after: { resolutionTier: number; definitionScore: number; diversityIndex: number; rootKappaDigest: string };
      };
      projectModel: unknown;
    };
    assert.equal(uniformRefine.report.ok, true);
    assert.equal(uniformRefine.report.after.resolutionTier, 4);
    assert.ok(uniformRefine.report.after.definitionScore >= 90);
    assert.ok(uniformRefine.report.modelsRefined >= 60);
    assert.match(uniformRefine.report.after.rootKappaDigest, /^sha256:[0-9a-f]{64}$/);
    assert.ok(uniformRefine.projectModel, 'Sealed Model-of-Models must be registered in verdant-uorc.wasm');

    // Verify M16/M17 Lifecycle Gate MCP tool
    const gateRes = (await mcp.handleToolCall('verdant_lifecycle_gate', {}, null)) as {
      report: { spec: string; passedChecks: number; totalChecks: number; allPassed: boolean };
      watermarks: { spec: string; minTotalModels: number };
    };
    assert.equal(gateRes.report.spec, 'verdant/lifecycle-gate-report/1');
    assert.equal(gateRes.report.totalChecks, 7);
    assert.equal(gateRes.report.passedChecks, 7);
    assert.equal(gateRes.report.allPassed, true);
    assert.equal(gateRes.watermarks.spec, 'prism/parametric-ratchet/2');

    // Verify M16/M17 Verdant Automate Pipeline MCP tool
    const autoRes = (await mcp.handleToolCall(
      'verdant_automate',
      { targetTier: 4, reason: 'Integration test M17 automate pipeline' },
      null,
    )) as {
      report: {
        spec: string;
        allPassed: boolean;
        passedStages: number;
        totalStages: number;
        automateKappaHex: string;
        lifecycleGate: { allPassed: boolean; passedChecks: number; totalChecks: number };
      };
      projectModel: unknown;
    };
    assert.equal(autoRes.report.spec, 'verdant/automate-report/1');
    assert.equal(autoRes.report.allPassed, true);
    assert.equal(autoRes.report.passedStages, 4);
    assert.equal(autoRes.report.totalStages, 4);
    assert.equal(autoRes.report.lifecycleGate.allPassed, true);
    assert.match(autoRes.report.automateKappaHex, /^auto:[0-9a-f]{8}$/);
    assert.ok(autoRes.projectModel, 'M17 Automate snapshot must be registered in verdant-uorc.wasm');

    // Verify Character Ontology MCP tool #33
    const charOntology = (await mcp.handleToolCall(
      'verdant_character_ontology',
      { action: 'compile-player', speciesId: 'lithborn', classId: 'foundry-bellwright', directiveId: 'forge-of-merit', name: 'Bramwell' },
      null,
    )) as {
      audit: { allValid: boolean; speciesCount: number; ethnicityCount: number; classCount: number; directiveCount: number };
      profile: { speciesId: string; classId: string };
      appearance: { portraitUrl: string };
      characterKappa: string;
      projectModel: unknown;
    };
    assert.equal(charOntology.audit.allValid, true);
    assert.equal(charOntology.audit.speciesCount, 6);
    assert.equal(charOntology.audit.ethnicityCount, 12);
    assert.equal(charOntology.audit.classCount, 6);
    assert.equal(charOntology.audit.directiveCount, 6);
    assert.equal(charOntology.profile.speciesId, 'lithborn');
    assert.equal(charOntology.profile.classId, 'foundry-bellwright');
    assert.ok(charOntology.appearance.portraitUrl.startsWith('data:image/svg+xml'));
    assert.match(charOntology.characterKappa, /^sha256:[0-9a-f]{64}$/);
    assert.ok(charOntology.projectModel, 'Character Ontology model must be registered in verdant-uorc.wasm');
  });

  it('produces distinct orchestral soundtracks across themes and dungeons without monotonous drones', () => {
    const vaelmorScore = getCanonicalSoundtrackForTheme('citadel-highlands', false, 'vaelmor', 'Vaelmor');
    const borealisScore = getCanonicalSoundtrackForTheme('glacial-spire', false, 'borealis', 'Borealis');
    const dungeonScore = getCanonicalSoundtrackForTheme('obsidian-crucible', true, 'cinderfall-magma-delve', 'Magma Delve');
    const customScore = synthesizeScoreFromBrief({
      realmSlug: 'vault-of-glass',
      realmName: 'Vault of Glass & Brass',
      theme: 'pelagic-spires',
      isDungeon: true,
      composerNote: 'echoing harp and horn',
      seed: 4242,
    });

    assert.notEqual(vaelmorScore.title, borealisScore.title);
    assert.notEqual(vaelmorScore.mode, dungeonScore.mode);
    assert.ok(customScore.bpm >= 68 && customScore.bpm <= 126);
    assert.ok(customScore.reverbDecaySec >= 1.5);
    assert.ok(customScore.chordProgression.length >= 4);
    assert.ok(customScore.melodyMotif.length >= 4);
  });

  it('packs dynamic water, abyss chasms, portals, chests, braziers, player, NPCs, and enemies across all 12 Worlds', () => {
    const batcher = new VerdantDynamicBatcher();
    assert.equal(CANONICAL_REALM_SPECS.length, 6);
    assert.equal(CANONICAL_DUNGEON_SPECS.length, 6);
    assert.equal(ALL_CANONICAL_WORLDS.length, 12);

    for (const spec of ALL_CANONICAL_WORLDS) {
      const [sx, sz] = spec.spawnPoint;
      const py = realmSurfaceHeightAt(spec, sx, sz);
      assert.ok(Number.isFinite(py), `Surface height must be finite for ${spec.slug}`);
      const region = getRealmRegionAt(spec, sx, sz);
      assert.ok(region.name.length > 0);

      const out = batcher.build({
        timeSec: 1.5,
        playerX: sx,
        playerY: py,
        playerZ: sz,
        playerYaw: Math.PI,
        playerSpeed: 6.0,
        attackSwing: 0.5,
        activeGear: 'hookblade',
        dodgeTimer: 0,
        npcs: spec.slug === 'vaelmor' ? INITIAL_NPCS : spec.npcs,
        enemies: spec.slug === 'vaelmor' ? createInitialEnemies() : spec.enemies,
        interactables: spec.slug === 'vaelmor' ? INITIAL_INTERACTABLES : spec.interactables,
        banners: [],
        remotePlayers: [],
        projectiles: [],
        particles: [],
        slashes: [],
        trackedCoords: [0, 0],
        highlightInteractableId: null,
        heightAt: (x, z) => realmSurfaceHeightAt(spec, x, z),
        waterLevel: spec.terrainProfile.waterLevel,
        isDungeon: Boolean(spec.isDungeon),
        dungeonStyle: spec.dungeonStyle,
      });
      assert.ok(out.pos.length > 2000, `Dynamic geometry must pack vertices for ${spec.slug}`);
      assert.equal(out.pos.length, out.norm.length);
      assert.equal(out.pos.length, out.col.length);
    }
  });
});


