import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRealmCollisionMap,
  getEnemyCollisionRadius,
  isProjectileBlockedByWorld,
  NPC_COLLISION_RADIUS,
  PLAYER_COLLISION_RADIUS,
  resolveCircleVsWorld,
  resolveDynamicBodySeparation,
} from './verdantCollision';
import { ALL_CANONICAL_WORLDS, CANONICAL_DUNGEON_SPECS, CANONICAL_REALM_SPECS } from './realmModelSchema';
import { INITIAL_INTERACTABLES, INITIAL_NPCS } from '../game/worldData';
import { createInitialEnemies } from '../game/rpgLogic';
import {
  getCombatTrackForTheme,
  getPlaylistForRealm,
  SOUNDTRACK_CATALOG,
} from './verdantScoreSchema';

describe('Verdant Solid Collision Engine', () => {
  it('blocks player from passing through Vaelmor Citadel keep, gatehouse piers, and obelisks while leaving gate archway open', () => {
    const vaelmor = CANONICAL_REALM_SPECS[0];
    const map = buildRealmCollisionMap(vaelmor, INITIAL_INTERACTABLES);
    assert.ok(map.boxes.length >= 12, 'expected overworld architectural box colliders');
    assert.ok(map.circles.length >= 60, 'expected keep, bastions, trees, and imported prop colliders');

    // Attempt to walk straight into the octagonal Basalt Keep center (0, -20.5, r=5.85)
    const keepHit = resolveCircleVsWorld(0, -17.0, PLAYER_COLLISION_RADIUS, 2.0, map);
    assert.equal(keepHit.collided, true);
    assert.ok(
      Math.hypot(keepHit.x - 0, keepHit.z - -20.5) >= 5.85 + PLAYER_COLLISION_RADIUS - 0.01,
      'player must be pushed outside the basalt keep masonry',
    );

    // Attempt to walk into the west Gatehouse pier (-3.2, -14.0)
    const pierHit = resolveCircleVsWorld(-3.2, -14.0, PLAYER_COLLISION_RADIUS, 2.0, map);
    assert.equal(pierHit.collided, true);

    // Central Gatehouse archway (0, -14.0) must remain unobstructed
    const gatePass = resolveCircleVsWorld(0, -14.0, PLAYER_COLLISION_RADIUS, 2.0, map);
    assert.equal(gatePass.collided, false);

    // Southern gateway obelisk (4.4, 14.0) must be solid
    const obeliskHit = resolveCircleVsWorld(4.4, 14.0, PLAYER_COLLISION_RADIUS, 1.0, map);
    assert.equal(obeliskHit.collided, true);
  });

  it('blocks player from walking through 3D dungeon pillars, walls, and abyss chasm pits while keeping bridge and alcoves open', () => {
    const dungeon = CANONICAL_DUNGEON_SPECS[0];
    const map = buildRealmCollisionMap(dungeon, dungeon.interactables);

    // Colonnade pillar at (10.6, -4.0) must block player
    const pillarHit = resolveCircleVsWorld(10.6, -4.0, PLAYER_COLLISION_RADIUS, 1.0, map);
    assert.equal(pillarHit.collided, true);
    assert.ok(Math.hypot(pillarHit.x - 10.6, pillarHit.z - -4.0) > 1.0);

    // Stepping off the stone bridge into the Abyss Chasm (x=5.0, z=11.0) must be blocked
    const chasmHit = resolveCircleVsWorld(5.0, 11.0, PLAYER_COLLISION_RADIUS, 1.0, map);
    assert.equal(chasmHit.collided, true);

    // Center of the stone bridge (x=0, z=11.0) must be smoothly walkable
    const bridgePass = resolveCircleVsWorld(0, 11.0, PLAYER_COLLISION_RADIUS, 1.0, map);
    assert.equal(bridgePass.collided, false);

    // Alcove passage at (12.2, -6.5) between north jamb (-9.2) and central column (-4.0) must be passable
    const alcovePass = resolveCircleVsWorld(12.2, -6.5, PLAYER_COLLISION_RADIUS, 1.0, map);
    assert.equal(alcovePass.collided, false);
  });

  it('enforces solid body separation between player, NPCs, and enemies so entities never overlap', () => {
    const npc = INITIAL_NPCS[0];
    const enemies = createInitialEnemies();
    const stalker = enemies[0];
    const shard = enemies[1];

    // Place player directly on top of Magistrate Orenna Vael
    const resNpc = resolveDynamicBodySeparation(
      { x: npc.position[0] + 0.05, z: npc.position[1] },
      [],
      INITIAL_NPCS,
    );
    const distNpc = Math.hypot(resNpc.playerX - npc.position[0], resNpc.playerZ - npc.position[1]);
    assert.ok(
      distNpc >= PLAYER_COLLISION_RADIUS + NPC_COLLISION_RADIUS - 0.01,
      `player must not pass through NPC (dist=${distNpc})`,
    );

    // Place two enemies on top of each other and player overlapping the first enemy
    stalker.x = 5.0;
    stalker.z = 5.0;
    shard.x = 5.05;
    shard.z = 5.0;
    const resCombat = resolveDynamicBodySeparation({ x: 5.0, z: 5.1 }, [stalker, shard], []);
    const pToStalker = Math.hypot(resCombat.playerX - stalker.x, resCombat.playerZ - stalker.z);
    const enemySep = Math.hypot(stalker.x - shard.x, stalker.z - shard.z);
    assert.ok(
      pToStalker >= PLAYER_COLLISION_RADIUS + getEnemyCollisionRadius(stalker.archetype) - 0.15,
      'player and enemy must separate cleanly',
    );
    assert.ok(
      enemySep >= getEnemyCollisionRadius(stalker.archetype) + getEnemyCollisionRadius(shard.archetype) - 0.02,
      'enemies must separate and never stack inside each other',
    );
  });

  it('stops projectiles on solid masonry walls and pillars while allowing flight across open chasms', () => {
    const dungeon = CANONICAL_DUNGEON_SPECS[0];
    const map = buildRealmCollisionMap(dungeon, dungeon.interactables);

    // Solid colonnade pillar blocks projectile
    assert.equal(isProjectileBlockedByWorld(10.6, -4.0, 1.2, 0.35, map), true);
    // Open chasm airspace does NOT block flying projectile
    assert.equal(isProjectileBlockedByWorld(5.5, 11.0, 1.2, 0.35, map), false);
    // Dungeon outer wall blocks projectile
    assert.equal(isProjectileBlockedByWorld(22.0, -4.0, 1.2, 0.35, map), true);
  });
});

describe('Verdant Multi-Song Soundtrack Diversity', () => {
  it('provides at least 20 distinct curated songs across 4/4, 3/4, and 6/8 meters and >= 6 musical modes', () => {
    assert.ok(SOUNDTRACK_CATALOG.length >= 20, `expected >= 20 tracks, got ${SOUNDTRACK_CATALOG.length}`);
    const uniqueTitles = new Set(SOUNDTRACK_CATALOG.map((t) => t.title));
    assert.equal(uniqueTitles.size, SOUNDTRACK_CATALOG.length, 'all song titles must be unique');

    const meters = new Set(SOUNDTRACK_CATALOG.map((t) => t.meter ?? '4/4'));
    assert.ok(meters.has('4/4') && meters.has('3/4') && meters.has('6/8'), 'must include 4/4, 3/4, and 6/8 songs');

    const modes = new Set(SOUNDTRACK_CATALOG.map((t) => t.mode));
    assert.ok(modes.size >= 6, `expected >= 6 distinct musical modes, got ${modes.size}`);
  });

  it('builds a distinct 4-song playlist for every canonical realm and dungeon plus dynamic combat anthems', () => {
    for (const world of ALL_CANONICAL_WORLDS) {
      const playlist = getPlaylistForRealm(world.theme, Boolean(world.isDungeon), world.soundtrack);
      assert.ok(
        playlist.length >= 4,
        `expected >= 4 tracks for ${world.slug}, got ${playlist.length}`,
      );
      const unique = new Set(playlist.map((t) => t.title));
      assert.equal(unique.size, playlist.length, `playlist titles for ${world.slug} must be unique`);
    }
    const overworldCombat = getCombatTrackForTheme(false);
    const bossCombat = getCombatTrackForTheme(true);
    assert.notEqual(overworldCombat.id, bossCombat.id);
    assert.ok(overworldCombat.bpm >= 120 && bossCombat.bpm >= 124);
  });
});
