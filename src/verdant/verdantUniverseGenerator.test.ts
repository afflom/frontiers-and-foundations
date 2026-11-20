import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CELL_BORDER_HALF,
  realmTerrainHeightAt,
} from './realmModelSchema';
import {
  getAdjacentCellsSummary,
  sampleMacroClimate,
  synthesizeProceduralDungeon,
  synthesizeUniverseCell,
} from './verdantUniverseGenerator';
import { buildProceduralCellGlb } from './verdantProceduralGlb';
import { compileNpcCharacterAppearance } from './verdantCharacterCompiler';
import { VerdantDynamicBatcher } from './verdantDynamicGeometry';

describe('Verdant Boundless Procedural Universe & Character Synthesizer', () => {
  it('synthesizes 25 distinct boundless UniverseCells with macro-climate biome diversity, complete differentiated NPCs, and 1:1 SVG portraits', () => {
    const themes = new Set<string>();
    const names = new Set<string>();
    const garments = new Set<string>();
    const hairs = new Set<string>();
    const props = new Set<string>();
    const npcNames = new Set<string>();

    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const cell = synthesizeUniverseCell(cx, cz, { forceProcedural: true });
        assert.deepEqual(cell.cell, [cx, 0, cz]);
        assert.equal(cell.isProceduralCell, true);
        assert.equal(cell.terrainProfile.rimHeight, 0, 'No artificial mountain rim wall allowed');
        assert.equal(cell.npcs.length, 3, `Cell (${cx},${cz}) must have 3 synthesized NPCs`);
        assert.ok(cell.quests.length >= 1, `Cell (${cx},${cz}) must have a procedural quest`);
        assert.ok(cell.interactables.length >= 6, `Cell (${cx},${cz}) must have rich interactables`);
        assert.ok(cell.enemies.length >= 5, `Cell (${cx},${cz}) must have frontier enemies`);
        assert.ok(cell.soundtrack.title.length > 4, `Cell (${cx},${cz}) must have a bespoke soundtrack`);

        themes.add(cell.theme);
        names.add(cell.name);

        const localNames = new Set<string>();
        for (const npc of cell.npcs) {
          assert.ok(npc.appearance, `Synthesized NPC ${npc.name} must carry complete appearance genome`);
          assert.equal(npc.appearance!.portraitArchetype, 'synthesized');
          assert.ok(
            npc.portraitUrl.startsWith('data:image/svg+xml;charset=utf-8,'),
            `NPC ${npc.name} must have synchronized SVG portrait data URI`,
          );
          assert.ok(npc.cognitiveDrive.length > 10);
          assert.ok(npc.concealedSecret.length > 10);
          assert.ok(npc.speechCadence.length > 6);
          assert.ok(npc.beliefs.length >= 2);
          assert.ok(npc.choices.length >= 3);
          assert.ok(!localNames.has(npc.name), `Duplicate NPC name ${npc.name} inside same cell`);
          localNames.add(npc.name);
          npcNames.add(npc.name);

          // Compiler must preserve the exact synthesized genome 1:1
          const compiled = compileNpcCharacterAppearance(npc);
          assert.equal(compiled.garmentStyle, npc.appearance!.garmentStyle);
          assert.equal(compiled.hairStyle, npc.appearance!.hairStyle);
          assert.equal(compiled.beardStyle, npc.appearance!.beardStyle);
          assert.equal(compiled.signatureProp, npc.appearance!.signatureProp);
          garments.add(compiled.garmentStyle);
          hairs.add(compiled.hairStyle);
          props.add(compiled.signatureProp);
        }
      }
    }

    assert.ok(themes.size >= 4, `Expected >=4 distinct biomes across 5x5 grid, got ${themes.size}`);
    assert.ok(names.size >= 18, `Expected high toponymy diversity across 25 cells, got ${names.size}`);
    assert.ok(garments.size >= 5, `Expected >=5 distinct garment styles, got ${garments.size}`);
    assert.ok(hairs.size >= 5, `Expected >=5 distinct hair styles, got ${hairs.size}`);
    assert.ok(props.size >= 5, `Expected >=5 distinct signature props, got ${props.size}`);
    assert.ok(npcNames.size >= 40, `Expected >=40 unique synthesized characters across 75 NPCs, got ${npcNames.size}`);
  });

  it('maintains bit-for-bit continuous border elevation across adjacent UniverseCells with zero cliff seam or mountain rim', () => {
    const cellA = synthesizeUniverseCell(0, 0);
    const cellEast = synthesizeUniverseCell(1, 0);
    const cellFarEast = synthesizeUniverseCell(2, 0);
    const cellSouth = synthesizeUniverseCell(0, 1);
    const cellNorth = synthesizeUniverseCell(0, -1);

    // Check East-West border continuity between (0,0) and (1,0), and between (1,0) and (2,0)
    for (let z = -88; z <= 88; z += 8) {
      const hRightA = realmTerrainHeightAt(cellA, CELL_BORDER_HALF, z);
      const hLeftEast = realmTerrainHeightAt(cellEast, -CELL_BORDER_HALF, z);
      assert.ok(
        Math.abs(hRightA - hLeftEast) < 1e-6,
        `E/W seam mismatch at z=${z}: ${hRightA} vs ${hLeftEast}`,
      );

      const hRightEast = realmTerrainHeightAt(cellEast, CELL_BORDER_HALF, z);
      const hLeftFarEast = realmTerrainHeightAt(cellFarEast, -CELL_BORDER_HALF, z);
      assert.ok(
        Math.abs(hRightEast - hLeftFarEast) < 1e-6,
        `E/W seam mismatch (1,0)->(2,0) at z=${z}: ${hRightEast} vs ${hLeftFarEast}`,
      );

      // Verify natural terrain bounds at border and navigable low frontier road pass near z=0
      assert.ok(hRightA > -5 && hRightA < 26, `Border elevation out of natural terrain bounds: ${hRightA}`);
      if (Math.abs(z) <= 8) {
        assert.ok(hRightA > -3 && hRightA < 7, `Cardinal frontier road pass at z=${z} should stay gently navigable, got ${hRightA}`);
      }
    }

    // Check North-South border continuity between (0,0) and (0,1) and (0,-1)
    for (let x = -88; x <= 88; x += 8) {
      const hSouthA = realmTerrainHeightAt(cellA, x, CELL_BORDER_HALF);
      const hNorthSouth = realmTerrainHeightAt(cellSouth, x, -CELL_BORDER_HALF);
      assert.ok(
        Math.abs(hSouthA - hNorthSouth) < 1e-6,
        `N/S seam mismatch (0,0)->(0,1) at x=${x}: ${hSouthA} vs ${hNorthSouth}`,
      );

      const hNorthA = realmTerrainHeightAt(cellA, x, -CELL_BORDER_HALF);
      const hSouthNorth = realmTerrainHeightAt(cellNorth, x, CELL_BORDER_HALF);
      assert.ok(
        Math.abs(hNorthA - hSouthNorth) < 1e-6,
        `N/S seam mismatch (0,0)->(0,-1) at x=${x}: ${hNorthA} vs ${hSouthNorth}`,
      );
    }
  });

  it('compiles procedural UniverseCells and linked procedural Dungeons into binary glTF 2.0 (.glb) that imports cleanly into real verdant-uorc.wasm', async () => {
    const wasmBytes = readFileSync(join(process.cwd(), 'public', 'verdant', 'verdant-uorc.wasm'));
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = instance.exports as Record<string, any> & { memory: WebAssembly.Memory };

    ex.verdant_wasm_init(7777n);
    ex.verdant_wasm_update_host_envelope_uhd(2048, 0, 4, 8000, 1440, 900);

    const cell = synthesizeUniverseCell(2, 0);
    const glb = buildProceduralCellGlb(cell);
    assert.ok(glb.byteLength > 20000, `Expected substantial binary GLB, got ${glb.byteLength} bytes`);

    ex.verdant_wasm_studio_load_blank_stage();
    const ptr = ex.verdant_wasm_io_resize(glb.byteLength >>> 0) >>> 0;
    new Uint8Array(ex.memory.buffer, ptr, glb.byteLength).set(glb);
    const tris = ex.verdant_wasm_glb_import_io() >>> 0;
    assert.ok(tris > 5000, `Expected >5000 imported triangles for procedural UniverseCell, got ${tris}`);

    // Also verify procedural dungeon GLB import
    const dungeon = synthesizeProceduralDungeon(cell);
    const dGlb = buildProceduralCellGlb(dungeon);
    ex.verdant_wasm_studio_load_blank_stage();
    const dPtr = ex.verdant_wasm_io_resize(dGlb.byteLength >>> 0) >>> 0;
    new Uint8Array(ex.memory.buffer, dPtr, dGlb.byteLength).set(dGlb);
    const dTris = ex.verdant_wasm_glb_import_io() >>> 0;
    assert.ok(dTris > 200, `Expected >200 imported triangles for procedural Dungeon, got ${dTris}`);
  });

  it('packs dynamic geometry for synthesized characters & cardinal border waygates and previews adjacent cells', () => {
    const cell = synthesizeUniverseCell(3, -2);
    const adj = getAdjacentCellsSummary(3, -2);
    assert.equal(adj.length, 4);
    assert.deepEqual(
      adj.map((a) => a.dir),
      ['N', 'S', 'E', 'W'],
    );
    const climate = sampleMacroClimate(3, -2);
    assert.equal(climate.theme, cell.theme);

    const batcher = new VerdantDynamicBatcher();
    const out = batcher.build({
      timeSec: 2.0,
      playerX: 0,
      playerY: 1.0,
      playerZ: 18,
      playerYaw: Math.PI,
      playerSpeed: 4.0,
      attackSwing: 0,
      activeGear: 'hookblade',
      dodgeTimer: 0,
      npcs: cell.npcs,
      enemies: cell.enemies,
      interactables: cell.interactables,
      banners: [],
      remotePlayers: [],
      projectiles: [],
      particles: [],
      slashes: [],
      trackedCoords: cell.npcs[0].position,
      highlightInteractableId: null,
      heightAt: (x, z) => realmTerrainHeightAt(cell, x, z),
      waterLevel: cell.terrainProfile.waterLevel,
      isDungeon: false,
    });
    assert.ok(out.pos.length > 6000, `Expected rich dynamic geometry with synthesized NPCs & waygates, got ${out.pos.length}`);
    assert.equal(out.pos.length, out.norm.length);
    assert.equal(out.pos.length, out.col.length);
  });
});
