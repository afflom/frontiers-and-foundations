import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCharacterOntology,
  buildBespokeNpcInteraction,
  CANONICAL_NPC_CHARACTER_PROFILES,
  CHARACTER_ATTRIBUTE_META,
  CHARACTER_CLASSES,
  CHARACTER_SPECIES,
  CHARACTER_UNIVERSAL_INVARIANTS,
  computeCharacterCombatStats,
  computeCharacterProgression,
  createDefaultPlayerProfile,
  evaluateGearAffinity,
  evaluateRelicAffinity,
  normalizePlayerProfile,
  renderHdCharacterPortraitSvg,
  resolveNpcCharacterProfile,
  WORLDVIEW_DIRECTIVES,
} from './verdantCharacterOntology';
import {
  compileNpcCharacterAppearance,
  compilePlayerCharacterAppearance,
} from './verdantCharacterCompiler';
import { VerdantDynamicBatcher } from './verdantDynamicGeometry';
import { CANONICAL_REALM_SPECS, realmSurfaceHeightAt } from './realmModelSchema';
import { INITIAL_INTERACTABLES, INITIAL_NPCS } from '../game/worldData';
import { createInitialEnemies } from '../game/rpgLogic';
import {
  createNewSaveSlot,
  loadSaveSlotStore,
  updateSaveSlotProgress,
} from '../game/saveSlotStorage';
import type { EquippedRelic } from '../game/multiplayerTypes';

describe('Verdant Character Ontology — Species, Ethnicities, Classes, Progression, Inventory Synergy, HD 3D/Portrait Parity & Bespoke Interactions', () => {
  it('passes full ontology audit with 6 species, 12 ethnicities, 6 classes, 6 guiding directives, and 7 universal invariants', () => {
    const audit = auditCharacterOntology();
    assert.equal(audit.allValid, true);
    assert.equal(audit.speciesCount, 6);
    assert.equal(audit.ethnicityCount, 12);
    assert.equal(audit.classCount, 6);
    assert.equal(audit.directiveCount, 6);
    assert.equal(audit.invariantCount, 7);
    assert.equal(CHARACTER_UNIVERSAL_INVARIANTS.length, 7);
    assert.equal(Object.keys(CHARACTER_ATTRIBUTE_META).length, 5);
    assert.equal(CHARACTER_SPECIES.length, 6);
    assert.equal(CHARACTER_CLASSES.length, 6);
    assert.equal(WORLDVIEW_DIRECTIVES.length, 6);
    assert.ok(Object.keys(CANONICAL_NPC_CHARACTER_PROFILES).length >= 4);

    for (const sp of CHARACTER_SPECIES) {
      assert.equal(sp.ethnicities.length, 2, `${sp.name} must define exactly 2 cultural ethnicities`);
      assert.ok(sp.originNarrative.length > 20);
      assert.ok(sp.worldviewLens.length > 20);
      assert.ok(sp.skinPalette.length >= 3);
      assert.ok(sp.hairPalette.length >= 3);
      assert.ok(sp.eyePalette.length >= 3);
    }
  });

  it('computes deterministic Level 1..20 XP progression, allocatable Attribute Points, and 4-Tier Evolution Ranks', () => {
    const profile = createDefaultPlayerProfile('Aurelia', {
      speciesId: 'sylvan-rootkin',
      classId: 'rootward-alchemist',
      directiveId: 'living-equilibrium',
    });
    const progLv1 = computeCharacterProgression(profile, 0, 0, 0);
    assert.equal(progLv1.level, 1);
    assert.equal(progLv1.evolutionRank, 1);
    assert.equal(progLv1.totalAttributePointsEarned, 2);
    assert.equal(progLv1.unspentAttributePoints, 2);

    // Mid-journey progression unlocks Rank 2+ & additional attribute points
    const progMid = computeCharacterProgression(profile, 420, 4, 8);
    assert.ok(progMid.level >= 5, `Expected level >= 5 at mid journey, got ${progMid.level}`);
    assert.ok(progMid.evolutionRank >= 2);
    assert.ok(progMid.totalAttributePointsEarned > progLv1.totalAttributePointsEarned);

    // Late-game Sovereign progression reaches Rank 4
    const progSovereign = computeCharacterProgression(
      { ...profile, allocatedAttributes: { vigor: 2, resonance: 4, wayfinding: 1, insight: 3, conviction: 2 } },
      2800,
      14,
      36,
    );
    assert.equal(progSovereign.evolutionRank, 4);
    assert.ok(progSovereign.level >= 12);
    assert.ok(progSovereign.totalAttributes.resonance > progLv1.totalAttributes.resonance);
  });

  it('binds Class & Species Inventory/Relic Synergy directly into live combat statistics', () => {
    const bellwright = createDefaultPlayerProfile('Doran', {
      speciesId: 'lithborn',
      classId: 'foundry-bellwright',
      directiveId: 'forge-of-merit',
    });
    const astromancer = createDefaultPlayerProfile('Lyra', {
      speciesId: 'glacian',
      classId: 'frostglass-astromancer',
      directiveId: 'harmonic-truth',
    });

    // Bellhammer is signature weapon for Foundry Bellwright
    const bellAffBellwright = evaluateGearAffinity(bellwright, 'bellhammer');
    const bellAffAstro = evaluateGearAffinity(astromancer, 'bellhammer');
    assert.equal(bellAffBellwright.rating, 'resonant');
    assert.ok(bellAffBellwright.synergyBonusPct >= 15);
    assert.equal(bellAffAstro.rating, 'resonant');

    const hookAffAstro = evaluateGearAffinity(astromancer, 'hookblade');
    assert.equal(hookAffAstro.rating, 'compatible');
    assert.equal(hookAffAstro.synergyBonusPct, 0);

    const sampleRelic: EquippedRelic = {
      id: 'rel-amber-1',
      name: 'Monolith-Tuned Prism',
      origin: 'Kar-Veth Monolith',
      theme: 'amber-steppe',
      rarity: 'Sovereign',
      bonusKind: 'damagePct',
      bonusValue: 18,
      description: 'Amplifies resonant strikes.',
      equipped: true,
    };
    const relicAff = evaluateRelicAffinity(bellwright, sampleRelic);
    assert.equal(relicAff.rating, 'resonant');
    assert.equal(relicAff.synergyBonusPct, 25, 'Lithborn + Foundry Bellwright + amber-steppe damagePct relic must trigger full 25% Lineage & Class Resonance');

    const gearTiers = { hookblade: 2, bellhammer: 2, lantern: 1, compass: 1 };
    const progBell = computeCharacterProgression(bellwright, 180, 2, 4);
    const combatWithRelic = computeCharacterCombatStats(bellwright, gearTiers, [sampleRelic], progBell);
    const combatNoRelic = computeCharacterCombatStats(bellwright, gearTiers, [], progBell);

    assert.ok(combatWithRelic.damageMultiplier > combatNoRelic.damageMultiplier);
    assert.ok(combatWithRelic.maxHp >= 110);
    assert.ok(combatWithRelic.speedMultiplier >= 0.9);
  });

  it('compiles all 6 Species into distinct 3D rigs with sculpted species anatomy and matching 1:1 HD SVG portraits', () => {
    const spec = CANONICAL_REALM_SPECS[0];
    const [sx, sz] = spec.spawnPoint;
    const py = realmSurfaceHeightAt(spec, sx, sz);
    const batcher = new VerdantDynamicBatcher();
    const portraits = new Set<string>();
    const vertCounts = new Map<string, number>();

    for (let i = 0; i < CHARACTER_SPECIES.length; i++) {
      const sp = CHARACTER_SPECIES[i];
      const cls = CHARACTER_CLASSES[i % CHARACTER_CLASSES.length];
      const dir = WORLDVIEW_DIRECTIVES[i % WORLDVIEW_DIRECTIVES.length];
      const profile = createDefaultPlayerProfile(`Hero-${sp.id}`, {
        speciesId: sp.id,
        classId: cls.id,
        directiveId: dir.id,
      });
      const rig = compilePlayerCharacterAppearance('hookblade', false, profile, 3);
      assert.equal(rig.speciesId, sp.id);
      assert.equal(rig.anatomicalTraits?.earShape, sp.anatomicalDefaults.earShape);
      assert.equal(rig.anatomicalTraits?.browCrest, sp.anatomicalDefaults.browCrest);

      const svg = renderHdCharacterPortraitSvg(rig, {
        name: profile.name,
        speciesId: sp.id,
        classId: cls.id,
        evolutionRank: 3,
      });
      assert.ok(svg.startsWith('data:image/svg+xml;charset=utf-8,'));
      assert.ok(svg.length > 1200, `HD SVG portrait for ${sp.id} should contain rich painterly layers`);
      portraits.add(svg);

      const out = batcher.build({
        timeSec: 1.2,
        playerX: sx,
        playerY: py,
        playerZ: sz,
        playerYaw: Math.PI,
        playerSpeed: 3.5,
        attackSwing: 0,
        activeGear: 'hookblade',
        dodgeTimer: 0,
        playerProfile: profile,
        playerEvolutionRank: 4,
        npcs: INITIAL_NPCS,
        enemies: createInitialEnemies(),
        interactables: INITIAL_INTERACTABLES,
        banners: [],
        remotePlayers: [],
        projectiles: [],
        particles: [],
        slashes: [],
        trackedCoords: [0, 0],
        highlightInteractableId: null,
        heightAt: (x, z) => realmSurfaceHeightAt(spec, x, z),
        waterLevel: spec.terrainProfile.waterLevel,
        modelResolutionTier: 4,
      });
      assert.ok(out.pos.length > 3000);
      assert.equal(out.pos.length, out.norm.length);
      assert.equal(out.pos.length, out.col.length);
      vertCounts.set(sp.id, out.pos.length / 3);
    }

    assert.equal(portraits.size, 6, 'All 6 species must render unique 1:1 HD SVG portraits');
    // Species with sculpted brow/shoulder/ear crests should differ in vertex geometry from base meridian-human
    assert.notEqual(vertCounts.get('lithborn'), vertCounts.get('meridian-human'));
    assert.notEqual(vertCounts.get('glacian'), vertCounts.get('meridian-human'));
  });

  it('generates bespoke NPC interactions shaped by Species Kinship, Class Discipline, and Guiding Directive', () => {
    const orenna = INITIAL_NPCS.find((n) => n.id === 'npc-orenna')!;
    const tarsik = INITIAL_NPCS.find((n) => n.id === 'npc-tarsik')!;
    const orennaMeta = resolveNpcCharacterProfile(orenna);
    const tarsikMeta = resolveNpcCharacterProfile(tarsik);
    assert.equal(orennaMeta.speciesId, 'meridian-human');
    assert.equal(tarsikMeta.speciesId, 'lithborn');

    // Kinship check: Lithborn player speaking with Lithborn Forge-Dean Tarsik
    const lithPlayer = createDefaultPlayerProfile('Korr', {
      speciesId: 'lithborn',
      classId: 'foundry-bellwright',
      directiveId: 'forge-of-merit',
    });
    const lithProg = computeCharacterProgression(lithPlayer, 200, 2, 4);
    const tarsikInteraction = buildBespokeNpcInteraction(tarsik, lithPlayer, lithProg);
    assert.equal(tarsikInteraction.resonanceRelation, 'kinship');
    assert.equal(tarsikInteraction.bespokeChoices.length, 3);
    assert.ok(tarsikInteraction.bespokeChoices[0].id.startsWith('bespoke-lineage-'));
    assert.ok(tarsikInteraction.bespokeChoices[1].id.startsWith('bespoke-class-'));
    assert.ok(tarsikInteraction.bespokeChoices[2].id.startsWith('bespoke-directive-'));

    // Contrasting worldview check: Boundless Horizon player speaking with Preserve-Arch Orenna
    const sylvanPlayer = createDefaultPlayerProfile('Veyla', {
      speciesId: 'sylvan-rootkin',
      classId: 'rootward-alchemist',
      directiveId: 'boundless-horizon',
    });
    const orennaInteraction = buildBespokeNpcInteraction(orenna, sylvanPlayer, lithProg);
    assert.equal(orennaInteraction.resonanceRelation, 'philosophical-tension');
    assert.equal(orennaInteraction.bespokeChoices.length, 3);
    assert.equal(orennaInteraction.npcSpecies.name, 'Meridian Human');

    // Ensure canonical NPC rig compilation preserves ontology fields
    const compiledTarsik = compileNpcCharacterAppearance(tarsik);
    assert.equal(compiledTarsik.speciesId, 'lithborn');
    assert.equal(compiledTarsik.classId, 'foundry-bellwright');
  });

  it('persists full PlayerCharacterProfile inside Save Slots and restores metadata cleanly', () => {
    const store = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => store.get(k) ?? null,
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const customProfile = normalizePlayerProfile({
      name: 'Nereia',
      speciesId: 'pelagis',
      ethnicityId: 'glasswater-spire-divers',
      classId: 'tide-loom-sentinel',
      directiveId: 'boundless-horizon',
      allocatedAttributes: { vigor: 1, resonance: 2, wayfinding: 3, insight: 0, conviction: 1 },
    });

    const initialStore = loadSaveSlotStore(storage);
    const { store: createdStore, record } = createNewSaveSlot(
      initialStore,
      {
        slotId: 'slot-2',
        waywrightName: 'Nereia',
        pledgedGuildId: 'guild-cartographers',
        characterProfile: customProfile,
        prologueCompleted: true,
      },
      storage,
    );
    assert.equal(record.speciesName, 'Pelagis');
    assert.equal(record.className, 'Tide-Loom Sentinel');

    updateSaveSlotProgress(
      createdStore,
      {
        slotId: 'slot-2',
        waywrightName: 'Nereia',
        journey: {
          ...record.journey,
          renown: 260,
          activeRealmSlug: 'glasswater',
          activeRealmName: 'The Pelagic Spires of Glasswater',
          discoveredRegions: ['southern-terrace', 'ashen-kiln'],
          characterProfile: customProfile,
        },
        prologueCompleted: true,
      },
      storage,
    );

    const reloaded = loadSaveSlotStore(storage);
    const slot2 = reloaded.slots['slot-2']!;
    assert.ok(slot2);
    assert.equal(slot2.speciesName, 'Pelagis');
    assert.equal(slot2.className, 'Tide-Loom Sentinel');
    assert.ok((slot2.characterLevel ?? 0) >= 2);
    assert.equal(slot2.journey.characterProfile?.speciesId, 'pelagis');
    assert.equal(slot2.journey.characterProfile?.ethnicityId, 'glasswater-spire-divers');
    assert.equal(slot2.journey.characterProfile?.allocatedAttributes.wayfinding, 3);
  });
});
