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
  type WorldChatMessage,
} from './multiplayerTypes';
import type { FoundationBanner } from './worldData';

test('Idempotent multiplayer reducers prevent duplicate banners and chat messages on reconnect', () => {
  const banner: FoundationBanner = {
    id: 'banner-1',
    name: 'Causeway Waymark',
    guildId: 'guild-causeway',
    builderName: 'Alden',
    position: [4, 12],
    plantedAt: 1000,
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
    x: 0,
    z: 17,
    yaw: 0,
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

  list = upsertRemotePlayer(list, { ...peer, x: 9 }, 'self-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 9);

  list = removeRemotePlayer(list, 'peer-2');
  assert.equal(list.length, 0);
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
