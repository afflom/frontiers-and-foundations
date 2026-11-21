import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGearUpgrade,
  computeCombatStats,
  mergeChatMessage,
  mergeRemoteBanner,
  removeRemotePlayer,
  upsertRemotePlayer,
  type CraftingMaterials,
  type EquippedRelic,
  type GearUpgradeTiers,
  type RemotePlayerState,
  type SharedEnemyState,
  type WorldChatMessage,
  type WorldPing,
} from './multiplayerTypes';
import {
  DEFAULT_ROOM_CODE,
  applyAuthoritativeEnemyDamage,
  buildInviteUrl,
  computeCoopHealAmount,
  computeCoopHealRecipients,
  filterSameRealmBanners,
  filterSameRealmPlayers,
  generatePrivateRoomCode,
  interpolateRemotePlayer,
  mergeWorldPing,
  normalizeCallsign,
  normalizeRoomCode,
  parseCallsignFromSearch,
  parseRoomCodeFromSearch,
  projectWorldToScreen,
  pruneExpiredPings,
} from './multiplayerState';
import type { FoundationBanner } from './worldData';

test('Idempotent multiplayer reducers prevent duplicate banners and chat messages on reconnect', () => {
  const banner: FoundationBanner = {
    id: 'banner-1',
    name: 'Causeway Waymark',
    guildId: 'guild-causeway',
    builderName: 'Alden',
    position: [4, 12],
    plantedAt: 1000,
    realmSlug: 'vaelmor',
  };
  const once = mergeRemoteBanner([], banner);
  const twice = mergeRemoteBanner(once, banner);
  assert.equal(twice.length, 1);

  const msg: WorldChatMessage = {
    id: 'msg-1',
    senderId: 'p1',
    senderName: 'Alden',
    guildId: 'guild-causeway',
    text: 'Meet at the Ashen Kiln bell!',
    kind: 'chat',
    timestamp: 2000,
  };
  const c1 = mergeChatMessage([], msg);
  const c2 = mergeChatMessage(c1, msg);
  assert.equal(c2.length, 1);
});

test('Remote player presence skips selfId and cleanly updates and removes peers', () => {
  const self: RemotePlayerState = {
    id: 'self-1',
    name: 'Waywright',
    guildId: 'guild-causeway',
    realmSlug: 'vaelmor',
    x: 0,
    z: 17,
    yaw: 0,
    hp: 100,
    maxHp: 100,
    activeGear: 'hookblade',
    regionId: 'southern-terrace',
    lastSeen: 100,
  };
  const peer: RemotePlayerState = {
    ...self,
    id: 'peer-2',
    name: 'Lyra',
    x: 5,
    z: 10,
  };

  let list = upsertRemotePlayer([], self, 'self-1');
  assert.equal(list.length, 0);

  list = upsertRemotePlayer(list, peer, 'self-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 5);

  list = upsertRemotePlayer(list, { ...peer, x: 9, hp: 74 }, 'self-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 9);
  assert.equal(list[0].hp, 74);

  list = removeRemotePlayer(list, 'peer-2');
  assert.equal(list.length, 0);
});

test('Room code normalization, private code generation, and URL invite parsing work reliably', () => {
  assert.equal(normalizeRoomCode(''), DEFAULT_ROOM_CODE);
  assert.equal(normalizeRoomCode('  vael-7k4!! '), 'VAEL-7K4');
  assert.equal(normalizeRoomCode('ab'), DEFAULT_ROOM_CODE);
  assert.equal(normalizeCallsign('  Lyra   Vane  '), 'Lyra Vane');

  const priv = generatePrivateRoomCode(() => 0.25);
  assert.match(priv, /^[A-Z]+-[A-Z0-9]{4}$/);

  const invite = buildInviteUrl('https://vaelmor.example/', '/play', 'kiln-9m2');
  assert.equal(invite, 'https://vaelmor.example/play?room=KILN-9M2');

  const parsedInvite = parseRoomCodeFromSearch('?room=kiln-9m2&autostart=1');
  assert.equal(parsedInvite.roomCode, 'KILN-9M2');
  assert.equal(parsedInvite.invited, true);

  const parsedDefault = parseRoomCodeFromSearch('?autostart=1');
  assert.equal(parsedDefault.roomCode, DEFAULT_ROOM_CODE);
  assert.equal(parsedDefault.invited, false);

  assert.equal(parseCallsignFromSearch('?name=Torin%20Vael'), 'Torin Vael');
  assert.equal(parseCallsignFromSearch('?autostart=1'), null);
});

test('Realm scoping isolates players and banners to their active overworld or 3D dungeon', () => {
  const players: RemotePlayerState[] = [
    {
      id: 'p-overworld',
      name: 'Alden',
      guildId: 'guild-causeway',
      realmSlug: 'vaelmor',
      x: 1,
      z: 10,
      yaw: 0,
      activeGear: 'hookblade',
      regionId: 'southern-terrace',
      lastSeen: 100,
    },
    {
      id: 'p-dungeon',
      name: 'Lyra',
      guildId: 'guild-kiln',
      realmSlug: 'vaelmor-crypt',
      x: 2,
      z: 18,
      yaw: 0,
      activeGear: 'bellhammer',
      regionId: 'southern-terrace',
      lastSeen: 100,
    },
  ];
  assert.deepEqual(
    filterSameRealmPlayers(players, 'vaelmor').map((p) => p.id),
    ['p-overworld'],
  );
  assert.deepEqual(
    filterSameRealmPlayers(players, 'vaelmor-crypt').map((p) => p.id),
    ['p-dungeon'],
  );

  const banners: FoundationBanner[] = [
    {
      id: 'b1',
      name: 'Highland Mark',
      guildId: 'guild-causeway',
      builderName: 'Alden',
      position: [0, 0],
      plantedAt: 1,
      realmSlug: 'vaelmor',
    },
    {
      id: 'b2',
      name: 'Crypt Mark',
      guildId: 'guild-kiln',
      builderName: 'Lyra',
      position: [0, 0],
      plantedAt: 2,
      realmSlug: 'vaelmor-crypt',
    },
  ];
  assert.equal(filterSameRealmBanners(banners, 'vaelmor').length, 1);
  assert.equal(filterSameRealmBanners(banners, 'vaelmor-crypt')[0].id, 'b2');
});

test('Server-authoritative shared enemy damage clamps HP and credits kill exactly once', () => {
  const map = new Map<string, SharedEnemyState>();
  const hit1 = applyAuthoritativeEnemyDamage(map, 'enemy-colossus-1', 45, 120, 'Alden', 1000);
  assert.equal(hit1.state.hp, 75);
  assert.equal(hit1.state.defeated, false);
  assert.equal(hit1.killedNow, false);

  const hit2 = applyAuthoritativeEnemyDamage(map, 'enemy-colossus-1', 80, 120, 'Lyra', 1100);
  assert.equal(hit2.state.hp, 0);
  assert.equal(hit2.state.defeated, true);
  assert.equal(hit2.killedNow, true);

  // Subsequent duplicate/late hit must NOT re-trigger killedNow
  const hit3 = applyAuthoritativeEnemyDamage(map, 'enemy-colossus-1', 30, 120, 'Alden', 1200);
  assert.equal(hit3.state.hp, 0);
  assert.equal(hit3.state.defeated, true);
  assert.equal(hit3.killedNow, false);
});

test('Co-op Mortar Lantern healing selects only nearby same-realm allies and scales cleanly', () => {
  const healer = { id: 'p1', realmSlug: 'vaelmor', x: 0, z: 10 };
  const peers = [
    { id: 'p1', realmSlug: 'vaelmor', x: 0, z: 10 }, // self excluded
    { id: 'p2', realmSlug: 'vaelmor', x: 4, z: 12 }, // within 12.5m
    { id: 'p3', realmSlug: 'vaelmor', x: 30, z: 10 }, // too far
    { id: 'p4', realmSlug: 'vaelmor-crypt', x: 1, z: 10 }, // different realm
  ];
  const targets = computeCoopHealRecipients(healer, peers);
  assert.deepEqual(
    targets.map((t) => t.id),
    ['p2'],
  );
  assert.equal(computeCoopHealAmount(40), 30);
});

test('Remote player interpolation smoothly advances pose and snaps across long teleports', () => {
  const pose0 = interpolateRemotePlayer(undefined, { x: 0, z: 0, yaw: 0 }, 0.016);
  assert.equal(pose0.x, 0);
  assert.equal(pose0.speed, 0);

  const pose1 = interpolateRemotePlayer(pose0, { x: 4, z: 0, yaw: Math.PI / 2 }, 0.05);
  assert.ok(pose1.x > 1.0 && pose1.x < 4.0);
  assert.ok(pose1.speed > 0.5);

  // Teleport (>14m) snaps immediately without dragging across the map
  const snapped = interpolateRemotePlayer(pose1, { x: 45, z: -20, yaw: 1.2 }, 0.05);
  assert.equal(snapped.x, 45);
  assert.equal(snapped.z, -20);
  assert.equal(snapped.speed, 0);
});

test('World ping deduplication replaces older ping from same sender and prunes expired beacons', () => {
  const p1: WorldPing = {
    id: 'ping-1',
    senderId: 'u1',
    senderName: 'Alden',
    guildId: 'guild-causeway',
    realmSlug: 'vaelmor',
    x: 2,
    z: 8,
    kind: 'rally',
    label: 'Rally Here',
    createdAt: 1000,
    expiresAt: 15000,
  };
  const p2: WorldPing = { ...p1, id: 'ping-2', x: 10, z: 14, createdAt: 2000, expiresAt: 16000 };
  const merged = mergeWorldPing([p1], p2, 2000);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'ping-2');
  assert.equal(pruneExpiredPings(merged, 17000).length, 0);
});

test('3D world-to-screen projection maps center frustum cleanly and culls behind-camera targets', () => {
  // Identity MVP maps (0,0,0,1) -> screen center
  const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
  const center = projectWorldToScreen([0, 0, 0], identity, 1440, 900);
  assert.equal(center.visible, true);
  assert.equal(center.screenX, 720);
  assert.equal(center.screenY, 450);

  // Negative clipW (behind camera) must be marked invisible
  const behindMvp = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, -1,
  ]);
  const behind = projectWorldToScreen([0, 0, 0], behindMvp, 1440, 900);
  assert.equal(behind.visible, false);
});

test('Gear tempering deducts materials accurately and boosts computed combat stats with equipped relics', () => {
  const wallet: CraftingMaterials = {
    silicateMoss: 2,
    lodestoneShards: 3,
    foundrySlag: 2,
  };
  const tiers: GearUpgradeTiers = {
    hookblade: 1,
    bellhammer: 1,
    lantern: 1,
    compass: 1,
  };

  const res = applyGearUpgrade(wallet, tiers, 'bellhammer');
  assert.equal(res.upgraded, true);
  assert.equal(res.tiers.bellhammer, 2);
  assert.equal(res.wallet.silicateMoss, 1);
  assert.equal(res.wallet.lodestoneShards, 1);
  assert.equal(res.wallet.foundrySlag, 1);

  const relics: EquippedRelic[] = [
    {
      id: 'rel-1',
      name: 'Salt-Loom Astrolabe Pin',
      origin: 'Salt Loom Coast',
      description: 'Balances stride across shifting shale.',
      bonusKind: 'maxHp',
      bonusValue: 25,
      equipped: true,
    },
    {
      id: 'rel-2',
      name: 'Kiln-Bronze Resonator',
      origin: 'Ashen Kiln',
      description: 'Amplifies 174 Hz shockwaves.',
      bonusKind: 'damagePct',
      bonusValue: 15,
      equipped: true,
    },
  ];

  const stats = computeCombatStats(res.tiers, relics);
  assert.equal(stats.maxHp, 125);
  assert.ok(stats.damageMultiplier > 1.25);
  assert.equal(stats.bellRangeBonus, 0.75);
});
