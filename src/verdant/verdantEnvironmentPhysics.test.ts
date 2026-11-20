import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_REALM_SPECS,
  CELL_BORDER_HALF,
  realmRiverCenterZ,
  realmTerrainHeightAt,
} from './realmModelSchema';
import {
  evaluateWaterImmersion,
  MAX_CLIMBABLE_SLOPE,
  resolveTerrainSlopeStep,
  sampleTerrainClippedWaterQuads,
  sampleTerrainSlope,
} from './verdantEnvironmentPhysics';
import { synthesizeUniverseCell } from './verdantUniverseGenerator';

describe('Verdant Environment Physics: Integrated Mountains & Terrain-Clipped Water', () => {
  it('transitions cleanly between dry land, depth-scaled wading, buoyant swimming, and dry bridge decks', () => {
    const waterY = -1.75;

    // Dry ground above waterline
    const dry = evaluateWaterImmersion(0.5, waterY, false, 1.0);
    assert.equal(dry.posture, 'dry');
    assert.equal(dry.depth, 0);
    assert.equal(dry.speedMultiplier, 1.0);
    assert.equal(dry.canHeavyMelee, true);

    // Standing on a bridge deck over a deep river channel keeps character dry
    const onBridge = evaluateWaterImmersion(-3.8, waterY, true, 1.0);
    assert.equal(onBridge.posture, 'dry');
    assert.equal(onBridge.depth, 0);
    assert.equal(onBridge.canHeavyMelee, true);

    // Shallow ankle-to-knee wading slows movement smoothly while keeping heavy melee available
    const shallowWade = evaluateWaterImmersion(waterY - 0.28, waterY, false, 1.0);
    const waistWade = evaluateWaterImmersion(waterY - 0.80, waterY, false, 1.0);
    assert.equal(shallowWade.posture, 'wading');
    assert.equal(waistWade.posture, 'wading');
    assert.ok(shallowWade.speedMultiplier < 1.0 && shallowWade.speedMultiplier > waistWade.speedMultiplier);
    assert.equal(waistWade.canHeavyMelee, true);

    // Deep water triggers buoyant swimming posture, slower stroke speed, and sheathed heavy melee
    const swim = evaluateWaterImmersion(waterY - 1.65, waterY, false, 0.0);
    assert.equal(swim.posture, 'swimming');
    assert.ok(swim.depth > 1.6);
    assert.ok(swim.speedMultiplier < 0.6);
    assert.equal(swim.canHeavyMelee, false);
    assert.ok(
      Math.abs(swim.swimFloatY - (waterY - 1.04)) < 0.08,
      `Expected buoyant swimFloatY near ${waterY - 1.04}, got ${swim.swimFloatY}`,
    );
  });

  it('allows climbing walkable mountain slopes with realistic uphill modulation while deflecting off sheer cliffs', () => {
    // Smooth mountain foothill (slope = 0.40 <= MAX_CLIMBABLE_SLOPE)
    const foothillHeight = (x: number, _z: number) => Math.max(0, x * 0.4);
    const foothillInfo = sampleTerrainSlope(foothillHeight, 10, 0);
    assert.equal(foothillInfo.climbable, true);
    assert.ok(Math.abs(foothillInfo.slope - 0.4) < 0.02);

    const climbStep = resolveTerrainSlopeStep(foothillHeight, 10, 0, 11, 0);
    assert.equal(climbStep.blockedByCliff, false);
    assert.ok(climbStep.x > 10.6 && climbStep.x < 11.0, `Expected uphill stride modulation, got x=${climbStep.x}`);
    assert.ok(climbStep.slopeSpeedFactor > 0.65 && climbStep.slopeSpeedFactor < 1.0);

    // Sheer alpine cliff wall (slope = 1.6 > MAX_CLIMBABLE_SLOPE)
    const cliffHeight = (x: number, _z: number) => (x > 10 ? (x - 10) * 1.6 : 0);
    const cliffInfo = sampleTerrainSlope(cliffHeight, 11, 0);
    assert.equal(cliffInfo.climbable, false);
    assert.ok(cliffInfo.slope > MAX_CLIMBABLE_SLOPE);

    // Attempting to walk diagonally into the cliff slides along the contour (z moves, x blocked)
    const cliffSlide = resolveTerrainSlopeStep(cliffHeight, 10.6, 0, 11.4, 0.8);
    assert.equal(cliffSlide.blockedByCliff, true);
    assert.ok(cliffSlide.x < 10.75, `Expected sheer cliff to block uphill x advance, got x=${cliffSlide.x}`);
    assert.ok(cliffSlide.z > 0.5, `Expected smooth lateral contour slide along cliff face, got z=${cliffSlide.z}`);

    // Descending off the cliff is always allowed
    const descendStep = resolveTerrainSlopeStep(cliffHeight, 11.4, 0, 10.6, 0);
    assert.equal(descendStep.blockedByCliff, false);
    assert.equal(descendStep.x, 10.6);
  });

  it('sculpts climbable mountain ranges directly into the continuous terrain field of Vaelmor and procedural realms', () => {
    const vaelmor = CANONICAL_REALM_SPECS.find((r) => r.slug === 'vaelmor');
    assert.ok(vaelmor, 'Vaelmor canonical realm must exist');

    let maxPeak = -Infinity;
    let climbableHighSamples = 0;
    for (let x = -88; x <= 88; x += 4) {
      for (let z = -88; z <= 88; z += 4) {
        const h = realmTerrainHeightAt(vaelmor, x, z);
        if (h > maxPeak) maxPeak = h;
        if (h > 7.5) {
          const s = sampleTerrainSlope((sx, sz) => realmTerrainHeightAt(vaelmor, sx, sz), x, z);
          if (s.climbable) climbableHighSamples++;
        }
      }
    }

    assert.ok(maxPeak > 10.5, `Expected real terrain-integrated mountain peaks > 10.5m, got ${maxPeak.toFixed(2)}m`);
    assert.ok(
      climbableHighSamples >= 15,
      `Expected walkable mountain ridges/foothills above 7.5m so players can climb into ranges, got ${climbableHighSamples}`,
    );

    // Also confirm procedural realms integrate mountain ridges seamlessly across borders
    const procCell = synthesizeUniverseCell(1, -1, { forceProcedural: true });
    let procMax = -Infinity;
    for (let x = -CELL_BORDER_HALF; x <= CELL_BORDER_HALF; x += 6) {
      for (let z = -CELL_BORDER_HALF; z <= CELL_BORDER_HALF; z += 6) {
        procMax = Math.max(procMax, realmTerrainHeightAt(procCell, x, z));
      }
    }
    assert.ok(procMax > 7.5, `Expected procedural realm mountain/ridge relief > 7.5m, got ${procMax.toFixed(2)}m`);
  });

  it('emits strictly terrain-clipped water tiles with zero floating slabs over dry land', () => {
    const vaelmor = CANONICAL_REALM_SPECS.find((r) => r.slug === 'vaelmor')!;
    const waterY = vaelmor.terrainProfile.waterLevel;
    const tiles = sampleTerrainClippedWaterQuads(vaelmor, 100, 4);

    assert.ok(tiles.length > 80, `Expected substantial river & cove water coverage, got ${tiles.length} tiles`);

    let shorelineCount = 0;
    let deepCount = 0;
    for (const tile of tiles) {
      assert.equal(tile.y, waterY, 'Every water tile must sit strictly at the unified realm waterLevel');
      const h00 = realmTerrainHeightAt(vaelmor, tile.x0, tile.z0);
      const h10 = realmTerrainHeightAt(vaelmor, tile.x1, tile.z0);
      const h01 = realmTerrainHeightAt(vaelmor, tile.x0, tile.z1);
      const h11 = realmTerrainHeightAt(vaelmor, tile.x1, tile.z1);
      const minH = Math.min(h00, h10, h01, h11);
      assert.ok(
        minH < waterY - 0.02,
        `Floating water tile detected at (${tile.x0},${tile.z0}): min terrain height ${minH.toFixed(3)} >= waterY ${waterY}`,
      );
      if (tile.isShoreline) shorelineCount++;
      if (tile.avgDepth > 0.95) deepCount++;
    }

    assert.ok(shorelineCount > 20, `Expected smooth shoreline edge tiles, got ${shorelineCount}`);
    assert.ok(deepCount > 20, `Expected swimmable deep channel tiles, got ${deepCount}`);

    // Verify the meandering river centerline itself is genuinely submerged (swimmable)
    const sampleRiverX = 16;
    const riverZ = realmRiverCenterZ(vaelmor, sampleRiverX);
    const bedH = realmTerrainHeightAt(vaelmor, sampleRiverX, riverZ);
    const immersion = evaluateWaterImmersion(bedH, waterY, false, 0);
    assert.equal(
      immersion.posture,
      'swimming',
      `Expected river channel at (${sampleRiverX}, ${riverZ.toFixed(1)}) to be swimmable (bed=${bedH.toFixed(2)}, water=${waterY})`,
    );
  });
});
