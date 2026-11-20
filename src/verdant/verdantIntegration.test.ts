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

describe('Verdant Engine (verdant-uorc.wasm) + 12-World Federation + 16 MCP Tools + Orchestral Score + Prism + Stitch', () => {
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
  });

  it('exposes all 16 real verdant-uorc.wasm-backed MCP tools including score, questline, NPC cast, relic arsenal, and Stitch tools', async () => {
    assert.equal(VERDANT_MCP_TOOLS.length, 16, 'Expected 16 Verdant MCP tools');

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


