import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceQuests,
  applyPlayerDamage,
  createInitialEnemies,
  MAX_CONCURRENT_ATTACKERS,
  resolvePlayerAttack,
  stepEnemies,
} from './rpgLogic';
import { GEAR_LOADOUT, getRegionAt, INITIAL_QUESTS } from './worldData';

test('All 3 enemy archetypes obey distinct movement & attack policies and respect attack token pool', () => {
  const enemies = createInitialEnemies();
  const stalker = enemies.find((e) => e.archetype === 'stalker')!;
  const shardcaster = enemies.find((e) => e.archetype === 'shardcaster')!;
  const colossus = enemies.find((e) => e.archetype === 'colossus')!;

  // Place shardcaster close to player -> must kite/retreat away
  shardcaster.x = 4;
  shardcaster.z = 0;
  shardcaster.state = 'approach';
  shardcaster.stateTimer = 5;
  const distBefore = Math.hypot(shardcaster.x, shardcaster.z);
  stepEnemies([shardcaster], 0, 0, false, 0.25, 0);
  const distAfter = Math.hypot(shardcaster.x, shardcaster.z);
  assert.ok(distAfter > distBefore, 'Shardcaster should retreat when player is too close');

  // Place stalker at medium range -> should move tangentially (orbit/flank)
  stalker.x = 4.5;
  stalker.z = 0;
  stalker.state = 'orbit';
  stalker.stateTimer = 5;
  stepEnemies([stalker], 0, 0, false, 0.2, 0);
  assert.ok(Math.abs(stalker.z) > 0.3, 'Stalker should strafe laterally to flank');

  // Place colossus directly ahead -> should telegraph and then emit a heavy slam
  colossus.x = 3.5;
  colossus.z = 0;
  colossus.state = 'approach';
  colossus.stateTimer = 0;
  const ev1 = stepEnemies([colossus], 0, 0, false, 0.05, 0);
  assert.equal(colossus.state, 'telegraph');
  assert.ok(ev1.telegraphStartedIds.includes(colossus.id));
  const ev2 = stepEnemies([colossus], 0, 0, false, colossus.telegraphDuration + 0.05, 0);
  assert.equal(colossus.state, 'attack');
  assert.equal(ev2.heavySlamPositions.length, 1);
  assert.ok(ev2.playerDamaged > 0);

  // Verify token budget limits concurrent attackers when 4 enemies are adjacent
  const crowd = createInitialEnemies().map((e, i) => ({
    ...e,
    x: 2.5 + i * 0.2,
    z: 0,
    state: 'approach' as const,
    stateTimer: 0,
  }));
  stepEnemies(crowd, 0, 0, false, 0.05, 0);
  const tokenCount = crowd.filter((e) => e.hasAttackToken).length;
  assert.ok(tokenCount <= MAX_CONCURRENT_ATTACKERS, `Expected <= ${MAX_CONCURRENT_ATTACKERS} attackers, got ${tokenCount}`);
});

test('Bell-Hammer radial shockwave damages surrounding foes, triggers hitstop, and KOs defeated enemies cleanly', () => {
  const enemies = createInitialEnemies().slice(0, 2).map((e, i) => ({
    ...e,
    x: i === 0 ? 0 : 0,
    z: i === 0 ? 3.2 : -3.2,
    hp: i === 0 ? 30 : 65,
  }));
  const bellHammer = GEAR_LOADOUT.find((g) => g.id === 'bellhammer')!;
  const result = resolvePlayerAttack(0, 0, 0, bellHammer, enemies);

  assert.equal(result.hitEnemyIds.length, 2, 'Radial bell-hammer should strike foes in front and behind');
  assert.equal(result.killedEnemyIds.length, 1);
  assert.ok(result.hitstopSec >= 0.05);
  assert.equal(enemies[0].state, 'ko');
  assert.ok(enemies[0].koTimer > 0, 'Defeated enemy should play KO transition timer');
});

test('Player HP loss reaches defeat cleanly at 0 with no hidden floor', () => {
  const hit1 = applyPlayerDamage(40, 25);
  assert.equal(hit1.nextHp, 15);
  assert.equal(hit1.defeated, false);

  const hit2 = applyPlayerDamage(hit1.nextHp, 20);
  assert.equal(hit2.nextHp, 0);
  assert.equal(hit2.defeated, true);
});

test('Multi-stage quest progression completes quest once all objectives finish', () => {
  let quests = INITIAL_QUESTS;
  const s1 = advanceQuests(quests, 'talk-npc', 'npc-orenna');
  assert.equal(s1.progressed, true);
  assert.equal(s1.newlyCompleted.length, 0);

  const s2 = advanceQuests(s1.quests, 'ring-bell', 'int-bridge-pier');
  assert.equal(s2.progressed, true);
  assert.equal(s2.newlyCompleted.length, 0);

  const s3 = advanceQuests(s2.quests, 'calibrate-beacon', 'int-citadel-beacon');
  assert.equal(s3.newlyCompleted.length, 1);
  assert.equal(s3.newlyCompleted[0].id, 'quest-sinking-pier');
});

test('World region detector resolves all 5 Vaelmor biomes accurately', () => {
  assert.equal(getRegionAt(0, -16).id, 'high-causeway');
  assert.equal(getRegionAt(-26, -6).id, 'ashen-kiln');
  assert.equal(getRegionAt(26, -6).id, 'ironwood-reaches');
  assert.equal(getRegionAt(24, 24).id, 'salt-loom');
  assert.equal(getRegionAt(0, 18).id, 'southern-terrace');
});
