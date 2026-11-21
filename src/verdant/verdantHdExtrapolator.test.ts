import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DUNGEON_SPECS,
  CANONICAL_REALM_SPECS,
} from './realmModelSchema';
import {
  PROLOGUE_HD_VISUAL_ANCHOR,
  extrapolateAllPartBlueprints,
  extrapolateRealmPointLights,
  extrapolateUnifiedHdBlueprint,
} from './verdantHdExtrapolator';
import { VERDANT_PART_SLOTS } from './verdantModelOfModels';

describe('Verdant HD Visual Extrapolation Engine', () => {
  it('extrapolates concrete HD blueprints across all 8 canonical Verdant Cognitive Parts from the Prologue visual anchor', () => {
    const parts = extrapolateAllPartBlueprints(3, 'citadel-highlands');
    assert.equal(Object.keys(parts).length, 8);
    for (const slot of VERDANT_PART_SLOTS) {
      const p = parts[slot];
      assert.ok(p, `Missing HD extrapolation for part ${slot}`);
      assert.equal(p.partSlot, slot);
      assert.ok(p.extrapolatedFidelityScore >= 88, `Expected fidelity >= 88 on ${slot}, got ${p.extrapolatedFidelityScore}`);
      assert.ok(p.prologueParityRatio >= 0.85, `Expected prologue parity >= 0.85 on ${slot}`);
      assert.ok(p.shaderDirectives.length >= 1);
      assert.ok(p.geometryDirectives.length >= 1);
      assert.ok(p.materialDirectives.length >= 1);
      assert.ok(p.lightingDirectives.length >= 1);
    }
  });

  it('produces distinct cinematic HD lighting & dynamic lantern point-light anchors for Vaelmor, all 6 overworld themes, and 3D dungeons', () => {
    const vaelmor = CANONICAL_REALM_SPECS[0];
    const bp = extrapolateUnifiedHdBlueprint(vaelmor, {
      resolutionTier: 3,
      isSoftwareGl: false,
      timeSec: 1.5,
      playerPos: [0, 1.0, 21.5],
      playerLanternActive: false,
    });

    assert.equal(bp.spec, 'verdant/hd-visual-extrapolation-blueprint/1');
    assert.equal(bp.anchorId, PROLOGUE_HD_VISUAL_ANCHOR.id);
    assert.ok(bp.pointLights.length >= 6 && bp.pointLights.length <= 8);
    assert.equal(bp.shaderUniforms.pointLightCount, bp.pointLights.length);
    assert.equal(bp.shaderUniforms.pointLightPosRad.length, 32);
    assert.equal(bp.shaderUniforms.pointLightColor.length, 24);
    assert.ok(bp.shaderUniforms.bloomStrength > 0.3);
    assert.ok(bp.shaderUniforms.normalRelief >= 1.35);
    assert.ok(bp.overallFidelityScore >= 90);
    assert.match(bp.blueprintDigest, /^hd:[0-9a-f]{8}$/);

    // Verify all 6 canonical realms produce unique HD lighting/color signatures
    const signatures = new Set<string>();
    for (const realm of CANONICAL_REALM_SPECS) {
      const rbp = extrapolateUnifiedHdBlueprint(realm, { resolutionTier: 4 });
      signatures.add(
        `${rbp.shaderUniforms.sunCol.join(',')}|${rbp.shaderUniforms.mistRgb.join(',')}`,
      );
      assert.ok(rbp.pointLights.length >= 3, `Realm ${realm.slug} should have >=3 dynamic point lights`);
    }
    assert.equal(signatures.size, CANONICAL_REALM_SPECS.length, 'Every canonical biome must have distinct HD lighting & mist grading');

    // Verify 3D dungeons extrapolate subterranean torchlit chiaroscuro
    const vault = CANONICAL_DUNGEON_SPECS[0];
    const dbp = extrapolateUnifiedHdBlueprint(vault, { resolutionTier: 3 });
    assert.equal(dbp.isDungeon, true);
    assert.ok(dbp.shaderUniforms.bloomStrength > bp.shaderUniforms.bloomStrength, 'Dungeons should amplify warm brazier bloom');
    assert.ok(dbp.shaderUniforms.sunCol[0] < bp.shaderUniforms.sunCol[0], 'Dungeons should suppress exterior sunlight in favor of local braziers');
    assert.ok(dbp.pointLights.length >= 6);
  });

  it('scales fidelity monotonically from Tier 2 -> Tier 3 -> Tier 4 and boosts player lantern radiance when active', () => {
    const vaelmor = CANONICAL_REALM_SPECS[0];
    const bp2 = extrapolateUnifiedHdBlueprint(vaelmor, { resolutionTier: 2 });
    const bp3 = extrapolateUnifiedHdBlueprint(vaelmor, { resolutionTier: 3 });
    const bp4 = extrapolateUnifiedHdBlueprint(vaelmor, { resolutionTier: 4 });
    assert.ok(bp3.overallFidelityScore > bp2.overallFidelityScore);
    assert.ok(bp4.overallFidelityScore > bp3.overallFidelityScore);
    assert.ok(bp4.characterSubdivSegments >= bp3.characterSubdivSegments);

    const passiveLights = extrapolateRealmPointLights(vaelmor, {
      playerPos: [0, 1, 10],
      playerLanternActive: false,
    });
    const activeLights = extrapolateRealmPointLights(vaelmor, {
      playerPos: [0, 1, 10],
      playerLanternActive: true,
    });
    const passiveWaywright = passiveLights.find((l) => l.id === 'waywright-mortar-lantern');
    const activeWaywright = activeLights.find((l) => l.id === 'waywright-mortar-lantern');
    assert.ok(passiveWaywright && activeWaywright);
    assert.ok(activeWaywright.intensity > passiveWaywright.intensity);
    assert.ok(activeWaywright.radius > passiveWaywright.radius);
  });
});
