import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_REALM_SPECS } from './realmModelSchema';
import {
  listVerdantCatalogExtensions,
  registerVerdantCatalogExtension,
  synthesizeRealmEcosystem,
} from './verdantEcosystemCatalog';
import { buildRealmCollisionMap } from './verdantCollision';
import { synthesizeUniverseCell } from './verdantUniverseGenerator';

describe('Verdant Extensible Ecosystem Catalog & Bespoke Procedural Synthesis', () => {
  it('assigns 6 completely distinct architectural layouts, flora kits, fauna families, and gameplay phenomena across the 6 canonical realms', () => {
    const plans = CANONICAL_REALM_SPECS.map((spec) => ({
      slug: spec.slug,
      plan: synthesizeRealmEcosystem(spec),
    }));

    const layouts = new Set(plans.map((p) => p.plan.layoutId));
    const floraKits = new Set(plans.map((p) => p.plan.floraKit));
    const faunaKits = new Set(plans.map((p) => p.plan.faunaKit));
    const phenomena = new Set(plans.map((p) => p.plan.phenomenon.id));
    const ambientKinds = new Set(plans.map((p) => p.plan.phenomenon.ambientParticleKind));

    assert.equal(layouts.size, 6, 'Every canonical realm must have its own unique architectural layout archetype');
    assert.equal(floraKits.size, 6, 'Every canonical realm must have its own unique botanical/geological flora kit');
    assert.equal(faunaKits.size, 6, 'Every canonical realm must have its own unique fauna morphology family');
    assert.equal(phenomena.size, 6, 'Every canonical realm must have its own unique live gameplay phenomenon');
    assert.equal(ambientKinds.size, 6, 'Every canonical realm must have its own unique ambient atmospheric particles');

    // Verify no realm clones Vaelmor's structure layout
    const vaelmorPlan = plans.find((p) => p.slug === 'vaelmor')!.plan;
    const vaelmorFingerprint = vaelmorPlan.structures
      .map((s) => `${s.kind}:${Math.round(s.x)},${Math.round(s.z)}`)
      .sort()
      .join('|');

    for (const { slug, plan } of plans) {
      assert.ok(plan.structures.length >= 16, `${slug} must synthesize substantial bespoke architecture`);
      assert.ok(plan.floraInstances.length >= 36, `${slug} must synthesize rich ecological flora`);
      if (slug !== 'vaelmor') {
        const fp = plan.structures
          .map((s) => `${s.kind}:${Math.round(s.x)},${Math.round(s.z)}`)
          .sort()
          .join('|');
        assert.notEqual(fp, vaelmorFingerprint, `${slug} must not clone Vaelmor structure placement`);
      }
    }

    // Verify Cinderfall specifically synthesizes live thermal magma vents
    const cinderfall = plans.find((p) => p.slug === 'cinderfall')!.plan;
    assert.ok(cinderfall.thermalVents.length >= 4, 'Cinderfall caldera must synthesize active thermal updraft vents');
    assert.ok(cinderfall.phenomenon.jumpBoostMult > 1.15, 'Cinderfall thermal updrafts must boost jump impulse');

    // Verify Oakhaven spore bloom provides passive vitality & stamina recovery
    const oakhaven = plans.find((p) => p.slug === 'oakhaven')!.plan;
    assert.ok(oakhaven.phenomenon.passiveHpPerSec > 0, 'Oakhaven spore bloom must provide passive HP regen');
    assert.ok(oakhaven.phenomenon.staminaRegenMult > 1.15, 'Oakhaven spore bloom must boost stamina regeneration');
  });

  it('keeps bespoke collision maps aligned 1:1 with each realm ecosystem plan without cross-realm cloned buildings', () => {
    const vaelmor = CANONICAL_REALM_SPECS.find((r) => r.slug === 'vaelmor')!;
    const oakhaven = CANONICAL_REALM_SPECS.find((r) => r.slug === 'oakhaven')!;
    const cinderfall = CANONICAL_REALM_SPECS.find((r) => r.slug === 'cinderfall')!;

    const vCol = buildRealmCollisionMap(vaelmor, vaelmor.interactables);
    const oCol = buildRealmCollisionMap(oakhaven, oakhaven.interactables);
    const cCol = buildRealmCollisionMap(cinderfall, cinderfall.interactables);

    assert.ok(vCol.circles.length > 35 && vCol.boxes.length >= 10);
    assert.ok(oCol.circles.length > 30 && oCol.boxes.length >= 10);
    assert.ok(cCol.circles.length > 30 && cCol.boxes.length >= 6);

    // Ensure Oakhaven and Cinderfall do NOT contain Vaelmor's cloned Basalt Keep collider at (0, -20.5, r=5.85)
    const hasVaelmorKeep = (col: ReturnType<typeof buildRealmCollisionMap>) =>
      col.circles.some((c) => Math.abs(c.x) < 0.2 && Math.abs(c.z + 20.5) < 0.2 && c.radius > 5.2);

    assert.equal(hasVaelmorKeep(vCol), true, 'Vaelmor must preserve its Basalt Citadel Keep collider');
    assert.equal(hasVaelmorKeep(oCol), false, 'Oakhaven must NOT inherit Vaelmor Keep collider');
    assert.equal(hasVaelmorKeep(cCol), false, 'Cinderfall must NOT inherit Vaelmor Keep collider');
  });

  it('synthesizes diverse, non-repetitive ecosystems across boundless procedural UniverseCells', () => {
    const layouts = new Set<string>();
    const floraKits = new Set<string>();
    const faunaKits = new Set<string>();
    const phenomena = new Set<string>();

    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        if (Math.abs(cx) + Math.abs(cz) <= 1) continue; // skip canonical core cells
        const cell = synthesizeUniverseCell(cx, cz);
        const plan = synthesizeRealmEcosystem(cell);
        layouts.add(plan.layoutId);
        floraKits.add(plan.floraKit);
        faunaKits.add(plan.faunaKit);
        phenomena.add(plan.phenomenon.id);
        assert.ok(plan.structures.length >= 10, `Procedural cell (${cx},${cz}) must synthesize bespoke structures`);
        assert.ok(plan.floraInstances.length >= 30, `Procedural cell (${cx},${cz}) must synthesize ecological flora`);
      }
    }

    assert.ok(layouts.size >= 5, `Expected >=5 distinct architectural layouts across outer frontier cells, got ${layouts.size}`);
    assert.ok(floraKits.size >= 5, `Expected >=5 distinct flora kits across outer frontier cells, got ${floraKits.size}`);
    assert.ok(faunaKits.size >= 4, `Expected >=4 distinct fauna families across outer frontier cells, got ${faunaKits.size}`);
    assert.ok(phenomena.size >= 4, `Expected >=4 distinct gameplay phenomena across outer frontier cells, got ${phenomena.size}`);
  });

  it('supports live runtime extension of the Verdant Ecosystem Catalog beyond default kits', () => {
    const before = listVerdantCatalogExtensions().length;
    assert.ok(before >= 24, `Expected >=24 built-in catalog kits, got ${before}`);

    const added = registerVerdantCatalogExtension({
      id: 'arch-test-skybridge-abbey',
      category: 'layout',
      title: 'Cantilevered Skybridge Abbey',
      description: 'Suspended stone cloisters anchored across canyon wind-columns.',
      themeAffinity: ['amber-steppe', 'citadel-highlands'],
      sourceStream: 'verdant-ecosystem-catalog',
      tags: ['canyon', 'cantilever', 'monastery'],
    });
    assert.equal(added.id, 'arch-test-skybridge-abbey');
    const after = listVerdantCatalogExtensions('layout');
    assert.ok(after.some((e) => e.id === 'arch-test-skybridge-abbey'));
  });
});
