import {
  INITIAL_GUILDS,
  INITIAL_QUESTS,
  INITIAL_RELICS,
  type FoundationBanner,
  type GameQuest,
  type RegionId,
} from './worldData';
import type {
  CraftingMaterials,
  EquippedRelic,
  GearUpgradeTiers,
} from './multiplayerTypes';

export const SAVE_SLOTS_STORAGE_KEY = 'frontiers-foundations-slots-v4';
export const LEGACY_SAVE_STORAGE_KEY = 'frontiers-foundations-save-v3';
export const ACTIVE_SLOT_STORAGE_KEY = 'frontiers-foundations-active-slot-v4';

export type SaveSlotId = 'slot-1' | 'slot-2' | 'slot-3';
export const SAVE_SLOT_IDS: readonly SaveSlotId[] = ['slot-1', 'slot-2', 'slot-3'] as const;

export interface SavedJourneyPayload {
  quests: GameQuest[];
  renown: number;
  pledgedGuildId: string;
  banners: FoundationBanner[];
  materials: CraftingMaterials;
  gearTiers: GearUpgradeTiers;
  relics: EquippedRelic[];
  discoveredRegions: RegionId[];
  activeRealmSlug: string;
  activeRealmName: string;
  regionName: string;
  defeatedCount: number;
  hasVisitedDungeon: boolean;
}

export interface SaveSlotRecord {
  slotId: SaveSlotId;
  waywrightName: string;
  pledgedGuildId: string;
  realmSlug: string;
  realmName: string;
  regionName: string;
  renown: number;
  completedQuests: number;
  totalQuests: number;
  bannersCount: number;
  defeatedCount: number;
  playTimeSec: number;
  prologueCompleted: boolean;
  waywrightOath?: 'bridges' | 'abyss' | 'fellowship';
  journeyChapterTitle: string;
  createdAt: number;
  savedAt: number;
  journey: SavedJourneyPayload;
}

export interface SaveSlotStoreState {
  version: 4;
  activeSlotId: SaveSlotId;
  slots: Record<SaveSlotId, SaveSlotRecord | null>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SAVE_MATERIALS: CraftingMaterials = {
  silicateMoss: 2,
  lodestoneShards: 2,
  foundrySlag: 1,
};

export const DEFAULT_SAVE_GEAR_TIERS: GearUpgradeTiers = {
  hookblade: 1,
  bellhammer: 1,
  lantern: 1,
  compass: 1,
};

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function createEmptyStore(): SaveSlotStoreState {
  return {
    version: 4,
    activeSlotId: 'slot-1',
    slots: {
      'slot-1': null,
      'slot-2': null,
      'slot-3': null,
    },
  };
}

export function createFreshJourneyPayload(
  pledgedGuildId: string = INITIAL_GUILDS[0].id,
): SavedJourneyPayload {
  return {
    quests: INITIAL_QUESTS.map((q) => ({
      ...q,
      status: 'active',
      objectives: q.objectives.map((o) => ({ ...o, currentCount: 0 })),
    })),
    renown: 0,
    pledgedGuildId,
    banners: [],
    materials: { ...DEFAULT_SAVE_MATERIALS },
    gearTiers: { ...DEFAULT_SAVE_GEAR_TIERS },
    relics: INITIAL_RELICS.map((r) => ({ ...r })),
    discoveredRegions: ['southern-terrace'],
    activeRealmSlug: 'vaelmor',
    activeRealmName: 'The Shattered Meridian of Vaelmor',
    regionName: 'Southern Causeway',
    defeatedCount: 0,
    hasVisitedDungeon: false,
  };
}

function normalizeSlotRecord(slotId: SaveSlotId, raw: unknown): SaveSlotRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SaveSlotRecord>;
  if (!r.journey || !Array.isArray(r.journey.quests) || r.journey.quests.length === 0) {
    return null;
  }
  const completedQuests = r.journey.quests.filter((q) => q.status === 'completed').length;
  const totalQuests = r.journey.quests.length;
  const now = Date.now();
  return {
    slotId,
    waywrightName:
      typeof r.waywrightName === 'string' && r.waywrightName.trim().length > 0
        ? r.waywrightName.trim().slice(0, 24)
        : 'Waywright',
    pledgedGuildId:
      typeof r.pledgedGuildId === 'string' && r.pledgedGuildId
        ? r.pledgedGuildId
        : r.journey.pledgedGuildId || INITIAL_GUILDS[0].id,
    realmSlug:
      typeof r.realmSlug === 'string' && r.realmSlug
        ? r.realmSlug
        : r.journey.activeRealmSlug || 'vaelmor',
    realmName:
      typeof r.realmName === 'string' && r.realmName
        ? r.realmName
        : r.journey.activeRealmName || 'The Shattered Meridian of Vaelmor',
    regionName:
      typeof r.regionName === 'string' && r.regionName
        ? r.regionName
        : r.journey.regionName || 'Southern Causeway',
    renown: typeof r.renown === 'number' ? r.renown : r.journey.renown ?? 0,
    completedQuests,
    totalQuests,
    bannersCount: Array.isArray(r.journey.banners) ? r.journey.banners.length : 0,
    defeatedCount:
      typeof r.defeatedCount === 'number'
        ? r.defeatedCount
        : typeof r.journey.defeatedCount === 'number'
          ? r.journey.defeatedCount
          : 0,
    playTimeSec: typeof r.playTimeSec === 'number' && r.playTimeSec >= 0 ? Math.floor(r.playTimeSec) : 0,
    prologueCompleted: Boolean(r.prologueCompleted),
    waywrightOath:
      r.waywrightOath === 'bridges' || r.waywrightOath === 'abyss' || r.waywrightOath === 'fellowship'
        ? r.waywrightOath
        : undefined,
    journeyChapterTitle:
      typeof r.journeyChapterTitle === 'string' && r.journeyChapterTitle
        ? r.journeyChapterTitle
        : 'Arrival: Briefing with Magistrate Orenna Vael',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    savedAt: typeof r.savedAt === 'number' ? r.savedAt : now,
    journey: {
      quests: r.journey.quests,
      renown: typeof r.journey.renown === 'number' ? r.journey.renown : 0,
      pledgedGuildId: r.journey.pledgedGuildId || INITIAL_GUILDS[0].id,
      banners: Array.isArray(r.journey.banners) ? r.journey.banners : [],
      materials: r.journey.materials ?? { ...DEFAULT_SAVE_MATERIALS },
      gearTiers: r.journey.gearTiers ?? { ...DEFAULT_SAVE_GEAR_TIERS },
      relics:
        Array.isArray(r.journey.relics) && r.journey.relics.length > 0
          ? r.journey.relics
          : INITIAL_RELICS.map((x) => ({ ...x })),
      discoveredRegions:
        Array.isArray(r.journey.discoveredRegions) && r.journey.discoveredRegions.length > 0
          ? r.journey.discoveredRegions
          : ['southern-terrace'],
      activeRealmSlug: r.journey.activeRealmSlug || 'vaelmor',
      activeRealmName: r.journey.activeRealmName || 'The Shattered Meridian of Vaelmor',
      regionName: r.journey.regionName || 'Southern Causeway',
      defeatedCount: typeof r.journey.defeatedCount === 'number' ? r.journey.defeatedCount : 0,
      hasVisitedDungeon: Boolean(r.journey.hasVisitedDungeon),
    },
  };
}

/**
 * Loads all 3 Expedition Save Slots from storage, migrating any legacy v3 single save into Slot 1.
 */
export function loadSaveSlotStore(
  storage: StorageLike | null = getDefaultStorage(),
  fallbackCallsign = 'Waywright',
): SaveSlotStoreState {
  const empty = createEmptyStore();
  if (!storage) return empty;

  try {
    const raw = storage.getItem(SAVE_SLOTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveSlotStoreState>;
      const slots: Record<SaveSlotId, SaveSlotRecord | null> = {
        'slot-1': normalizeSlotRecord('slot-1', parsed.slots?.['slot-1']),
        'slot-2': normalizeSlotRecord('slot-2', parsed.slots?.['slot-2']),
        'slot-3': normalizeSlotRecord('slot-3', parsed.slots?.['slot-3']),
      };
      const activeSlotId: SaveSlotId =
        parsed.activeSlotId && SAVE_SLOT_IDS.includes(parsed.activeSlotId)
          ? parsed.activeSlotId
          : 'slot-1';
      return { version: 4, activeSlotId, slots };
    }

    // Automatic seamless migration from legacy single save (`frontiers-foundations-save-v3`)
    const legacyRaw = storage.getItem(LEGACY_SAVE_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<SavedJourneyPayload>;
      if (Array.isArray(legacy.quests) && legacy.quests.length > 0) {
        const now = Date.now();
        const migratedJourney: SavedJourneyPayload = {
          quests: legacy.quests,
          renown: typeof legacy.renown === 'number' ? legacy.renown : 0,
          pledgedGuildId:
            typeof legacy.pledgedGuildId === 'string' ? legacy.pledgedGuildId : INITIAL_GUILDS[0].id,
          banners: Array.isArray(legacy.banners) ? legacy.banners : [],
          materials: legacy.materials ?? { ...DEFAULT_SAVE_MATERIALS },
          gearTiers: legacy.gearTiers ?? { ...DEFAULT_SAVE_GEAR_TIERS },
          relics:
            Array.isArray(legacy.relics) && legacy.relics.length > 0
              ? legacy.relics
              : INITIAL_RELICS.map((r) => ({ ...r })),
          discoveredRegions:
            Array.isArray(legacy.discoveredRegions) && legacy.discoveredRegions.length > 0
              ? legacy.discoveredRegions
              : ['southern-terrace'],
          activeRealmSlug: 'vaelmor',
          activeRealmName: 'The Shattered Meridian of Vaelmor',
          regionName: 'Southern Causeway',
          defeatedCount: 0,
          hasVisitedDungeon: false,
        };
        const migratedSlot: SaveSlotRecord = {
          slotId: 'slot-1',
          waywrightName: fallbackCallsign,
          pledgedGuildId: migratedJourney.pledgedGuildId,
          realmSlug: migratedJourney.activeRealmSlug,
          realmName: migratedJourney.activeRealmName,
          regionName: migratedJourney.regionName,
          renown: migratedJourney.renown,
          completedQuests: migratedJourney.quests.filter((q) => q.status === 'completed').length,
          totalQuests: migratedJourney.quests.length,
          bannersCount: migratedJourney.banners.length,
          defeatedCount: 0,
          playTimeSec: 0,
          prologueCompleted: true,
          journeyChapterTitle: 'Continued Meridian Expedition',
          createdAt: now,
          savedAt: now,
          journey: migratedJourney,
        };
        const migratedStore: SaveSlotStoreState = {
          version: 4,
          activeSlotId: 'slot-1',
          slots: {
            'slot-1': migratedSlot,
            'slot-2': null,
            'slot-3': null,
          },
        };
        persistSaveSlotStore(migratedStore, storage);
        return migratedStore;
      }
    }
  } catch {
    return empty;
  }
  return empty;
}

export function persistSaveSlotStore(
  store: SaveSlotStoreState,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_SLOTS_STORAGE_KEY, JSON.stringify(store));
    storage.setItem(ACTIVE_SLOT_STORAGE_KEY, store.activeSlotId);
  } catch {
    // ignore storage quota errors
  }
}

export function getMostRecentSaveSlot(store: SaveSlotStoreState): SaveSlotRecord | null {
  const populated = SAVE_SLOT_IDS.map((id) => store.slots[id]).filter(
    (s): s is SaveSlotRecord => s !== null,
  );
  if (populated.length === 0) return null;
  return populated.sort((a, b) => b.savedAt - a.savedAt)[0];
}

export function getFirstEmptySaveSlotId(store: SaveSlotStoreState): SaveSlotId {
  for (const id of SAVE_SLOT_IDS) {
    if (!store.slots[id]) return id;
  }
  return store.activeSlotId;
}

export function countOccupiedSaveSlots(store: SaveSlotStoreState): number {
  return SAVE_SLOT_IDS.filter((id) => store.slots[id] !== null).length;
}

export function createNewSaveSlot(
  store: SaveSlotStoreState,
  params: {
    slotId: SaveSlotId;
    waywrightName: string;
    pledgedGuildId?: string;
    prologueCompleted?: boolean;
    now?: number;
  },
  storage: StorageLike | null = getDefaultStorage(),
): { store: SaveSlotStoreState; record: SaveSlotRecord } {
  const now = params.now ?? Date.now();
  const guildId = params.pledgedGuildId ?? INITIAL_GUILDS[0].id;
  const cleanName = params.waywrightName.trim().slice(0, 24) || 'Waywright';
  const journey = createFreshJourneyPayload(guildId);
  const record: SaveSlotRecord = {
    slotId: params.slotId,
    waywrightName: cleanName,
    pledgedGuildId: guildId,
    realmSlug: journey.activeRealmSlug,
    realmName: journey.activeRealmName,
    regionName: journey.regionName,
    renown: 0,
    completedQuests: 0,
    totalQuests: journey.quests.length,
    bannersCount: 0,
    defeatedCount: 0,
    playTimeSec: 0,
    prologueCompleted: Boolean(params.prologueCompleted),
    journeyChapterTitle: 'Arrival: Briefing with Magistrate Orenna Vael',
    createdAt: now,
    savedAt: now,
    journey,
  };
  const nextStore: SaveSlotStoreState = {
    version: 4,
    activeSlotId: params.slotId,
    slots: {
      ...store.slots,
      [params.slotId]: record,
    },
  };
  persistSaveSlotStore(nextStore, storage);
  return { store: nextStore, record };
}

export function updateSaveSlotProgress(
  store: SaveSlotStoreState,
  params: {
    slotId: SaveSlotId;
    waywrightName: string;
    journey: SavedJourneyPayload;
    playTimeDeltaSec?: number;
    prologueCompleted?: boolean;
    waywrightOath?: 'bridges' | 'abyss' | 'fellowship';
    journeyChapterTitle?: string;
    now?: number;
  },
  storage: StorageLike | null = getDefaultStorage(),
): SaveSlotStoreState {
  const now = params.now ?? Date.now();
  const prev = store.slots[params.slotId];
  const completedQuests = params.journey.quests.filter((q) => q.status === 'completed').length;
  const totalQuests = params.journey.quests.length;
  const nextRecord: SaveSlotRecord = {
    slotId: params.slotId,
    waywrightName: params.waywrightName.trim().slice(0, 24) || prev?.waywrightName || 'Waywright',
    pledgedGuildId: params.journey.pledgedGuildId,
    realmSlug: params.journey.activeRealmSlug,
    realmName: params.journey.activeRealmName,
    regionName: params.journey.regionName,
    renown: params.journey.renown,
    completedQuests,
    totalQuests,
    bannersCount: params.journey.banners.length,
    defeatedCount: params.journey.defeatedCount,
    playTimeSec: (prev?.playTimeSec ?? 0) + Math.max(0, Math.floor(params.playTimeDeltaSec ?? 0)),
    prologueCompleted:
      params.prologueCompleted !== undefined
        ? params.prologueCompleted
        : (prev?.prologueCompleted ?? false),
    waywrightOath: params.waywrightOath ?? prev?.waywrightOath,
    journeyChapterTitle:
      params.journeyChapterTitle ??
      prev?.journeyChapterTitle ??
      'Arrival: Briefing with Magistrate Orenna Vael',
    createdAt: prev?.createdAt ?? now,
    savedAt: now,
    journey: params.journey,
  };
  const nextStore: SaveSlotStoreState = {
    version: 4,
    activeSlotId: params.slotId,
    slots: {
      ...store.slots,
      [params.slotId]: nextRecord,
    },
  };
  persistSaveSlotStore(nextStore, storage);
  return nextStore;
}

export function renameSaveSlot(
  store: SaveSlotStoreState,
  slotId: SaveSlotId,
  nextName: string,
  storage: StorageLike | null = getDefaultStorage(),
): SaveSlotStoreState {
  const existing = store.slots[slotId];
  if (!existing) return store;
  const trimmed = nextName.trim().slice(0, 24);
  if (trimmed.length < 2) return store;
  const nextStore: SaveSlotStoreState = {
    ...store,
    slots: {
      ...store.slots,
      [slotId]: {
        ...existing,
        waywrightName: trimmed,
        savedAt: Date.now(),
      },
    },
  };
  persistSaveSlotStore(nextStore, storage);
  return nextStore;
}

export function deleteSaveSlot(
  store: SaveSlotStoreState,
  slotId: SaveSlotId,
  storage: StorageLike | null = getDefaultStorage(),
): SaveSlotStoreState {
  const nextSlots: Record<SaveSlotId, SaveSlotRecord | null> = {
    ...store.slots,
    [slotId]: null,
  };
  const nextMostRecent = SAVE_SLOT_IDS.map((id) => nextSlots[id])
    .filter((s): s is SaveSlotRecord => s !== null)
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  const nextStore: SaveSlotStoreState = {
    version: 4,
    activeSlotId: nextMostRecent ? nextMostRecent.slotId : 'slot-1',
    slots: nextSlots,
  };
  persistSaveSlotStore(nextStore, storage);
  return nextStore;
}

export function formatPlayTime(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return '<1m';
}

export function formatSaveTimestamp(savedAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const d = new Date(savedAt);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
