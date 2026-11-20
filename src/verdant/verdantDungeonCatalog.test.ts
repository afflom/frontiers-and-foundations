import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_DUNGEON_SPECS } from './realmModelSchema';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';
import { listVerdantCatalogExtensions } from './verdantEcosystemCatalog';
import {
  buildRealmCollisionMap,
  isProjectileBlockedByWorld,
  PLAYER_COLLISION_RADIUS,
  resolveCircleVsWorld,
} from './verdantCollision';
import { createInitialEnemies, FAUNA_COMBAT_PROFILES, stepEnemies, type EnemyEntity } from '../game/rpgLogic';

describe('Verdant Bespoke 3D Dungeon Architecture Catalog & Fauna Combat AI', () => {
  it('synthesizes 6 completely bespoke 3D dungeon architectures across all 6 canonical dungeons with zero cloned layouts', () => {
    assert.equal(CANONICAL_DUNGEON_SPECS.length, 6);
    const styles = new Set<string>();
    const faunaKits = new Set<string>();
    const chasmVisuals = new Set<string>();
    const phenomena = new Set<string>();
    const structureSignatures = new Set<string>();

    for (const dg of CANONICAL_DUNGEON_SPECS) {
      const plan = synthesizeDungeonEcosystem(dg);
      styles.add(plan.style);
      faunaKits.add(plan.faunaKit);
      chasmVisuals.add(plan.chasmVisual);
      phenomena.add(plan.phenomenon.id);
      const sig = `${plan.structures.length}:${plan.structures.map((p) => p.kind).slice(0, 40).join(',')}`;
      structureSignatures.add(sig);

      assert.ok(plan.structures.length >= 60, `${dg.slug} must synthesize >= 60 structural primitives, got ${plan.structures.length}`);
      assert.ok(plan.catalogExtensionIds.includes(`verdant:dungeon:${plan.style}`));
    }

    assert.equal(styles.size, 6, 'all 6 canonical dungeons must have unique architectural styles');
    assert.equal(faunaKits.size, 6, 'all 6 canonical dungeons must host distinct fauna families');
    assert.equal(chasmVisuals.size, 6, 'all 6 canonical dungeons must feature distinct abyss chasm visuals');
    assert.equal(phenomena.size, 6, 'all 6 canonical dungeons must apply distinct gameplay phenomena');
    assert.equal(structureSignatures.size, 6, 'all 6 canonical dungeons must produce unique architectural primitive fingerprints');

    const magmaDelve = CANONICAL_DUNGEON_SPECS.find((d) => d.slug === 'cinderfall-magma-delve')!;
    const magmaPlan = synthesizeDungeonEcosystem(magmaDelve);
    assert.ok(magmaPlan.thermalVents.length >= 5, `geothermal-depths must include >= 5 active thermal vents, got ${magmaPlan.thermalVents.length}`);
  });

  it('registers all 6 bespoke dungeon architectural kits into the live extensible Verdant Catalog', () => {
    const extIds = new Set(listVerdantCatalogExtensions().map((e) => e.id));
    for (const style of [
      'catacomb-vault',
      'sunken-cistern',
      'geothermal-depths',
      'abyssal-grotto',
      'echo-tomb',
      'glacial-crypt',
    ]) {
      assert.ok(extIds.has(`verdant:dungeon:${style}`), `Missing Verdant Catalog extension verdant:dungeon:${style}`);
    }
  });

  it('produces 1:1 navigable dungeon collision maps preserving open bridge, open alcoves, solid walls, and open chasm airspace across all 6 dungeons', () => {
    for (const dg of CANONICAL_DUNGEON_SPECS) {
      const map = buildRealmCollisionMap(dg, dg.interactables);
      assert.ok(map.boxes.length >= 12, `${dg.slug} must have solid perimeter & bridge box colliders`);

      // Center of chasm bridge must be smoothly walkable
      const bridgePass = resolveCircleVsWorld(0, 11.0, PLAYER_COLLISION_RADIUS, 1.0, map);
      assert.equal(bridgePass.collided, false, `${dg.slug} bridge center (0, 11) must remain unobstructed`);

      // Stepping into the abyss chasm pit must block player movement, yet allow projectiles to fly across
      const chasmBlock = resolveCircleVsWorld(5.0, 11.0, PLAYER_COLLISION_RADIUS, 1.0, map);
      assert.equal(chasmBlock.collided, true, `${dg.slug} abyss chasm must block player footing`);
      assert.equal(
        isProjectileBlockedByWorld(5.5, 11.0, 1.2, 0.35, map),
        false,
        `${dg.slug} abyss chasm airspace must NOT block projectiles`,
      );

      // East & West alcove passages at z = -6.5 must stay open
      const alcovePass = resolveCircleVsWorld(12.2, -6.5, PLAYER_COLLISION_RADIUS, 1.0, map);
      assert.equal(alcovePass.collided, false, `${dg.slug} east alcove entrance must remain passable`);

      // Outer perimeter wall must block projectiles
      assert.equal(
        isProjectileBlockedByWorld(22.0, -4.0, 1.2, 0.35, map),
        true,
        `${dg.slug} east perimeter wall must block projectiles`,
      );
    }
  });

  it('differentiates combat AI speed and regeneration across ecosystem fauna families', () => {
    assert.ok(
      FAUNA_COMBAT_PROFILES['dune-sandstrider'].speedMult > FAUNA_COMBAT_PROFILES['pyroclastic-forge'].speedMult,
      'dune-sandstrider should move faster than pyroclastic-forge',
    );
    assert.ok(
      FAUNA_COMBAT_PROFILES['verdant-mycelial'].regenPerSec > 0,
      'verdant-mycelial fauna should regenerate HP',
    );

    const baseStalker = createInitialEnemies()[0];
    const mkStalker = (id: string): EnemyEntity => ({
      ...baseStalker,
      id,
      x: 10,
      z: 0,
      homeX: 10,
      homeZ: 0,
      hp: 40,
      maxHp: 65,
      state: 'approach',
      stateTimer: 0,
    });

    const sand = mkStalker('sand');
    const pyro = mkStalker('pyro');
    const myc = mkStalker('myc');
    const iron = mkStalker('iron');

    // Step chasing player at (0, 0)
    stepEnemies([sand], 0, 0, false, 0.5, 0, 'dune-sandstrider');
    stepEnemies([pyro], 0, 0, false, 0.5, 0, 'pyroclastic-forge');
    stepEnemies([myc], 0, 0, false, 1.0, 0, 'verdant-mycelial');
    stepEnemies([iron], 0, 0, false, 1.0, 0, 'highland-ironclad');

    assert.ok(sand.x < pyro.x, `dune-sandstrider (${sand.x}) should close distance faster than pyroclastic-forge (${pyro.x})`);
    assert.ok(myc.hp > 40, `verdant-mycelial should regenerate HP above 40, got ${myc.hp}`);
    assert.equal(iron.hp, 40, 'highland-ironclad should not regenerate HP');
  });
});
