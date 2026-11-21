import type { FoundationBanner, GearSlotId, RegionId } from './worldData';
import type { RealmThemeId } from '../verdant/realmModelSchema';
import type { RelicPerkId, RelicRarity } from '../verdant/verdantRelicCatalog';

export type RemoteWaterPosture = 'dry' | 'wading' | 'swimming';

export interface RemotePlayerState {
  id: string;
  name: string;
  guildId: string;
  roomCode?: string;
  realmSlug?: string;
  realmName?: string;
  x: number;
  z: number;
  yaw: number;
  hp?: number;
  maxHp?: number;
  waterPosture?: RemoteWaterPosture;
  activeGear: GearSlotId;
  regionId: RegionId;
  actionPulseAt?: number;
  lastSeen: number;
}

export type WorldPingKind = 'rally' | 'danger' | 'loot';

export interface WorldPing {
  id: string;
  senderId: string;
  senderName: string;
  guildId: string;
  realmSlug: string;
  x: number;
  z: number;
  kind: WorldPingKind;
  label: string;
  createdAt: number;
  expiresAt: number;
}

export interface SharedEnemyState {
  id: string;
  hp: number;
  maxHp: number;
  defeated: boolean;
  lastHitBy?: string;
  lastHitAt?: number;
}

export interface PartySummon {
  id: string;
  senderId: string;
  senderName: string;
  realmSlug: string;
  realmName: string;
  isDungeon: boolean;
  x: number;
  z: number;
  cell?: [number, number, number];
  createdAt: number;
}

export interface CoopHealEvent {
  id: string;
  healerId: string;
  healerName: string;
  amount: number;
  realmSlug: string;
  x: number;
  z: number;
  timestamp: number;
}

export interface RemoteActionEvent {
  playerId: string;
  playerName: string;
  activeGear: GearSlotId;
  realmSlug: string;
  x: number;
  z: number;
  yaw: number;
  timestamp: number;
}

export interface ProjectedAllyScreenPos {
  id: string;
  name: string;
  guildId: string;
  hp: number;
  maxHp: number;
  screenX: number;
  screenY: number;
  distance: number;
  visible: boolean;
  activeGear: GearSlotId;
  actionPulseAt?: number;
}

export interface WorldChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  guildId: string;
  text: string;
  kind: 'chat' | 'event';
  timestamp: number;
}

export interface RealmInitPayload {
  selfId: string;
  roomCode: string;
  realmSlug: string;
  players: RemotePlayerState[];
  banners: FoundationBanner[];
  guildProsperity: Record<string, number>;
  chatHistory: WorldChatMessage[];
  realmEnemies?: Record<string, SharedEnemyState>;
  activatedInteractables?: string[];
  pings?: WorldPing[];
  activeSummon?: PartySummon | null;
}

export interface RealmSyncPayload {
  realmSlug: string;
  banners: FoundationBanner[];
  realmEnemies: Record<string, SharedEnemyState>;
  activatedInteractables: string[];
  pings: WorldPing[];
}

export interface CraftingMaterials {
  silicateMoss: number;
  lodestoneShards: number;
  foundrySlag: number;
}

export type RelicBonusKind = 'maxHp' | 'damagePct' | 'speedPct' | 'staminaRegenPct' | 'healPower';

export interface EquippedRelic {
  id: string;
  name: string;
  origin: string;
  description: string;
  bonusKind: RelicBonusKind;
  bonusValue: number;
  equipped: boolean;
  isEmergent?: boolean;
  theme?: RealmThemeId;
  rarity?: RelicRarity;
  perkId?: RelicPerkId;
  perkLabel?: string;
  perkDescription?: string;
  resonanceHz?: number;
  auraRgb?: [number, number, number];
  sigilSvg?: string;
  catalogId?: string;
}

export type GearUpgradeTiers = Record<GearSlotId, number>;

export interface ComputedCombatStats {
  maxHp: number;
  damageMultiplier: number;
  speedMultiplier: number;
  staminaRegenMultiplier: number;
  bellRangeBonus: number;
  lanternHealAmount: number;
  activePerks: RelicPerkId[];
  relicAuraRgb: [number, number, number] | null;
  damageReductionPct: number;
  killHealAmount: number;
  reachBonus: number;
  dodgeStaminaDiscount: number;
  emberBonusPct: number;
  frostSlowActive: boolean;
}

export function mergeRemoteBanner(
  existing: FoundationBanner[],
  incoming: FoundationBanner,
): FoundationBanner[] {
  if (existing.some((b) => b.id === incoming.id)) {
    return existing;
  }
  return [incoming, ...existing].slice(0, 40);
}

export function mergeChatMessage(
  existing: WorldChatMessage[],
  incoming: WorldChatMessage,
): WorldChatMessage[] {
  if (existing.some((m) => m.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming].slice(-40);
}

export function upsertRemotePlayer(
  existing: RemotePlayerState[],
  incoming: RemotePlayerState,
  selfId: string | null,
): RemotePlayerState[] {
  if (selfId && incoming.id === selfId) return existing;
  const idx = existing.findIndex((p) => p.id === incoming.id);
  if (idx === -1) {
    return [...existing, incoming];
  }
  const next = existing.slice();
  next[idx] = { ...next[idx], ...incoming };
  return next;
}

export function removeRemotePlayer(
  existing: RemotePlayerState[],
  playerId: string,
): RemotePlayerState[] {
  if (!existing.some((p) => p.id === playerId)) return existing;
  return existing.filter((p) => p.id !== playerId);
}

export function getUpgradeCost(currentTier: number): CraftingMaterials | null {
  if (currentTier >= 3) return null;
  if (currentTier === 1) {
    return { silicateMoss: 1, lodestoneShards: 2, foundrySlag: 1 };
  }
  return { silicateMoss: 2, lodestoneShards: 3, foundrySlag: 2 };
}

export function canAffordMaterials(
  wallet: CraftingMaterials,
  cost: CraftingMaterials | null,
): boolean {
  if (!cost) return false;
  return (
    wallet.silicateMoss >= cost.silicateMoss &&
    wallet.lodestoneShards >= cost.lodestoneShards &&
    wallet.foundrySlag >= cost.foundrySlag
  );
}

export function applyGearUpgrade(
  wallet: CraftingMaterials,
  tiers: GearUpgradeTiers,
  gearId: GearSlotId,
): { upgraded: boolean; wallet: CraftingMaterials; tiers: GearUpgradeTiers } {
  const currentTier = tiers[gearId] ?? 1;
  const cost = getUpgradeCost(currentTier);
  if (!cost || !canAffordMaterials(wallet, cost)) {
    return { upgraded: false, wallet, tiers };
  }
  return {
    upgraded: true,
    wallet: {
      silicateMoss: wallet.silicateMoss - cost.silicateMoss,
      lodestoneShards: wallet.lodestoneShards - cost.lodestoneShards,
      foundrySlag: wallet.foundrySlag - cost.foundrySlag,
    },
    tiers: {
      ...tiers,
      [gearId]: currentTier + 1,
    },
  };
}

export function computeCombatStats(
  tiers: GearUpgradeTiers,
  relics: EquippedRelic[],
): ComputedCombatStats {
  let maxHp = 100;
  let damagePct = 0;
  let speedPct = 0;
  let staminaRegenPct = 0;
  let healBonus = 0;

  // Weapon tier upgrades
  const hookBonus = Math.max(0, (tiers.hookblade ?? 1) - 1);
  const bellBonus = Math.max(0, (tiers.bellhammer ?? 1) - 1);
  const lanternBonus = Math.max(0, (tiers.lantern ?? 1) - 1);
  const compassBonus = Math.max(0, (tiers.compass ?? 1) - 1);

  damagePct += hookBonus * 18 + bellBonus * 12;
  speedPct += compassBonus * 8;
  healBonus += lanternBonus * 12;
  const bellRangeBonus = bellBonus * 0.75;

  const activePerks = new Set<RelicPerkId>();
  let relicAuraRgb: [number, number, number] | null = null;
  let auraPriority = -1;

  for (const r of relics) {
    if (!r.equipped) continue;
    if (r.bonusKind === 'maxHp') maxHp += r.bonusValue;
    else if (r.bonusKind === 'damagePct') damagePct += r.bonusValue;
    else if (r.bonusKind === 'speedPct') speedPct += r.bonusValue;
    else if (r.bonusKind === 'staminaRegenPct') staminaRegenPct += r.bonusValue;
    else if (r.bonusKind === 'healPower') healBonus += r.bonusValue;

    if (r.perkId) {
      activePerks.add(r.perkId);
    }
    if (r.auraRgb) {
      const prio = r.rarity === 'Sovereign' ? 3 : r.rarity === 'Resonant' ? 2 : 1;
      if (prio > auraPriority) {
        auraPriority = prio;
        relicAuraRgb = [r.auraRgb[0], r.auraRgb[1], r.auraRgb[2]];
      }
    }
  }

  const perkList = Array.from(activePerks);
  const emberBonusPct = activePerks.has('ember-cleave') ? 15 : 0;
  const damageReductionPct = activePerks.has('meridian-ward') ? 16 : 0;
  const killHealAmount = activePerks.has('spore-siphon') ? 12 : 0;
  const reachBonus = activePerks.has('solar-pierce') ? 0.9 : 0;
  const dodgeStaminaDiscount = activePerks.has('tidal-surge') ? 0.3 : 0;
  const frostSlowActive = activePerks.has('frost-nova');
  if (activePerks.has('tidal-surge')) {
    speedPct += 8;
  }

  return {
    maxHp,
    damageMultiplier: 1 + (damagePct + emberBonusPct) / 100,
    speedMultiplier: 1 + speedPct / 100,
    staminaRegenMultiplier: 1 + staminaRegenPct / 100,
    bellRangeBonus: bellRangeBonus + reachBonus,
    lanternHealAmount: 34 + healBonus,
    activePerks: perkList,
    relicAuraRgb,
    damageReductionPct,
    killHealAmount,
    reachBonus,
    dodgeStaminaDiscount,
    emberBonusPct,
    frostSlowActive,
  };
}
