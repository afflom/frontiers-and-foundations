import type { FoundationBanner, GearSlotId, RegionId } from './worldData';

export interface RemotePlayerState {
  id: string;
  name: string;
  guildId: string;
  x: number;
  z: number;
  yaw: number;
  activeGear: GearSlotId;
  regionId: RegionId;
  actionPulseAt?: number;
  lastSeen: number;
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
  players: RemotePlayerState[];
  banners: FoundationBanner[];
  guildProsperity: Record<string, number>;
  chatHistory: WorldChatMessage[];
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
}

export type GearUpgradeTiers = Record<GearSlotId, number>;

export interface ComputedCombatStats {
  maxHp: number;
  damageMultiplier: number;
  speedMultiplier: number;
  staminaRegenMultiplier: number;
  bellRangeBonus: number;
  lanternHealAmount: number;
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

  for (const r of relics) {
    if (!r.equipped) continue;
    if (r.bonusKind === 'maxHp') maxHp += r.bonusValue;
    else if (r.bonusKind === 'damagePct') damagePct += r.bonusValue;
    else if (r.bonusKind === 'speedPct') speedPct += r.bonusValue;
    else if (r.bonusKind === 'staminaRegenPct') staminaRegenPct += r.bonusValue;
    else if (r.bonusKind === 'healPower') healBonus += r.bonusValue;
  }

  return {
    maxHp,
    damageMultiplier: 1 + damagePct / 100,
    speedMultiplier: 1 + speedPct / 100,
    staminaRegenMultiplier: 1 + staminaRegenPct / 100,
    bellRangeBonus,
    lanternHealAmount: 34 + healBonus,
  };
}
