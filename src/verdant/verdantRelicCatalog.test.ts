import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOME_RELIC_ARCHETYPES,
  renderRelicSigilSvgDataUrl,
  synthesizeBiomeRelic,
} from './verdantRelicCatalog';
import { listVerdantCatalogExtensions } from './verdantEcosystemCatalog';
import { computeCombatStats } from '../game/multiplayerTypes';
import {
  BOSS_SIGNATURE_PROFILES,
  createInitialEnemies,
  stepEnemies,
} from '../game/rpgLogic';
import type { RealmThemeId } from './realmModelSchema';

const ALL_THEMES: RealmThemeId[] = [
  'citadel-highlands',
  'sunken-aqueducts',
  'obsidian-crucible',
  'pelagic-spires',
  'amber-steppe',
  'glacial-spire',
];

describe('Verdant Procedural Relic & Artifact Catalog', () => {
  it('registers all 6 bespoke biome relic archetypes into the live extensible Verdant Catalog', () => {
    const ext = listVerdantCatalogExtensions('relic-archetype');
    assert.ok(ext.length >= 6, `Expected >= 6 relic-archetype extensions, got ${ext.length}`);
    for (const theme of ALL_THEMES) {
      assert.ok(
        ext.some((e) => e.id === `verdant:relic:${theme}`),
        `Missing live catalog extension for theme ${theme}`,
      );
    }

    const perks = new Set(ALL_THEMES.map((t) => BIOME_RELIC_ARCHETYPES[t].perkId));
    assert.equal(perks.size, 6, 'Every biome must have a unique active resonance perk');

    const sigils = new Set(ALL_THEMES.map((t) => renderRelicSigilSvgDataUrl(t, 'Sovereign', 42)));
    assert.equal(sigils.size, 6, 'Every biome must synthesize a visually distinct procedural SVG sigil');
    for (const svg of sigils) {
      assert.ok(svg.startsWith('data:image/svg+xml;utf8,'), 'Sigil must be a valid inline SVG data URL');
    }
  });

  it('synthesizes non-repeating biome relics and guarantees Sovereign rarity on Colossus trophies', () => {
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = synthesizeBiomeRelic({
        theme: 'obsidian-crucible',
        realmName: 'Cinderfall Caldera',
        existingNames: seen,
        seed: 1000 + i * 73,
        source: i === 0 ? 'colossus-drop' : 'forge',
      });
      assert.ok(!seen.includes(r.name), `Duplicate relic name generated: ${r.name}`);
      const words = r.name.toLowerCase().split(/\s+/);
      assert.equal(new Set(words).size, words.length, `Repeated word inside relic name: ${r.name}`);
      seen.push(r.name);
      if (i === 0) {
        assert.equal(r.rarity, 'Sovereign');
      }
      assert.equal(r.perkId, 'ember-cleave');
      assert.equal(r.auraRgb.length, 3);
      assert.ok(r.sigilSvg.includes('svg'));
    }
  });

  it('computes active perk combat stats and prioritizes Sovereign Waywright aura RGB', () => {
    const highland = synthesizeBiomeRelic({
      theme: 'citadel-highlands',
      realmName: 'Vaelmor',
      rarity: 'Chartered',
      seed: 11,
    });
    const crucible = synthesizeBiomeRelic({
      theme: 'obsidian-crucible',
      realmName: 'Cinderfall',
      rarity: 'Sovereign',
      seed: 22,
    });
    const glacial = synthesizeBiomeRelic({
      theme: 'glacial-spire',
      realmName: 'Borealis',
      rarity: 'Resonant',
      seed: 33,
    });
    const aqueduct = synthesizeBiomeRelic({
      theme: 'sunken-aqueducts',
      realmName: 'Oakhaven',
      rarity: 'Resonant',
      seed: 44,
    });
    const pelagic = synthesizeBiomeRelic({
      theme: 'pelagic-spires',
      realmName: 'Glasswater',
      rarity: 'Resonant',
      seed: 55,
    });
    const steppe = synthesizeBiomeRelic({
      theme: 'amber-steppe',
      realmName: 'Kar-Veth',
      rarity: 'Resonant',
      seed: 66,
    });

    const stats = computeCombatStats(
      { hookblade: 1, bellhammer: 1, lantern: 1, compass: 1 },
      [highland, crucible, glacial, aqueduct, pelagic, steppe],
    );

    assert.equal(stats.activePerks.length, 6);
    assert.equal(stats.damageReductionPct, 16);
    assert.equal(stats.emberBonusPct, 15);
    assert.equal(stats.killHealAmount, 12);
    assert.equal(stats.reachBonus, 0.9);
    assert.equal(stats.dodgeStaminaDiscount, 0.3);
    assert.equal(stats.frostSlowActive, true);
    assert.deepEqual(stats.relicAuraRgb, crucible.auraRgb, 'Sovereign relic should supply dominant Waywright aura RGB');
  });
});

describe('Bespoke Ecosystem Apex Colossus Phase-2 Mechanics', () => {
  it('defines 6 distinct biome boss signature kits and triggers Phase-2 awakening & signature attacks', () => {
    const kits = Object.keys(BOSS_SIGNATURE_PROFILES);
    assert.equal(kits.length, 6);
    const titles = new Set(kits.map((k) => BOSS_SIGNATURE_PROFILES[k].signatureMoveName));
    assert.equal(titles.size, 6, 'Each biome Colossus must have a unique Phase-2 signature move');

    for (const kit of kits) {
      const colossus = createInitialEnemies().find((e) => e.archetype === 'colossus')!;
      // Drop Colossus below 50% HP near the player to trigger Phase-2 awakening
      colossus.hp = Math.floor(colossus.maxHp * 0.45);
      colossus.x = 0;
      colossus.z = 0;
      colossus.state = 'telegraph';
      colossus.stateTimer = 0.01;
      colossus.hasAttackToken = true;

      const ev = stepEnemies([colossus], 0, 3.0, false, 0.05, 1, kit);
      assert.equal(colossus.phase2, true, `Colossus in ${kit} must awaken into Phase 2`);
      assert.ok(ev.bossPhase2TriggeredIds.includes(colossus.id));
      assert.ok(ev.bossSignatureCasts.length >= 2, 'Should emit awakening + signature strike casts');
      assert.equal(
        ev.spawnedProjectiles.length,
        BOSS_SIGNATURE_PROFILES[kit].projectileCount,
        `${kit} Phase-2 strike must emit ${BOSS_SIGNATURE_PROFILES[kit].projectileCount} signature projectiles`,
      );
    }
  });

  it('slows enemies cleanly when Frostglass Nova slowTimer is active', () => {
    const fast = createInitialEnemies().find((e) => e.archetype === 'colossus')!;
    const chilled = { ...fast, slowTimer: 3.5 };
    fast.x = 0;
    fast.z = 0;
    fast.state = 'approach';
    fast.stateTimer = 2.0;
    chilled.x = 0;
    chilled.z = 0;
    chilled.state = 'approach';
    chilled.stateTimer = 2.0;

    stepEnemies([fast], 0, 12, false, 0.2, 0, 'highland-ironclad');
    stepEnemies([chilled], 0, 12, false, 0.2, 0, 'highland-ironclad');

    assert.ok(chilled.z < fast.z * 0.65, 'Chilled enemy must advance significantly slower than unchilled enemy');
    assert.ok((chilled.slowTimer ?? 0) < 3.5, 'slowTimer must decay with dt');
  });
});
