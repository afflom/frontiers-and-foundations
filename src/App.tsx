import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BANNED_FANTASY_TROPES,
  INITIAL_GUILDS,
  INITIAL_INTERACTABLES,
  INITIAL_NPCS,
  INITIAL_QUESTS,
  INITIAL_RELICS,
  WORLD_REGIONS,
  type DialogueChoice,
  type FoundationBanner,
  type GameNpc,
  type GamePhase,
  type GameQuest,
  type GearSlotId,
  type GuildCharter,
  type RegionId,
  type WorldInteractable,
} from './game/worldData';
import { advanceQuests, createInitialEnemies, type EnemyArchetype } from './game/rpgLogic';
import type { HudSnapshot } from './game/vaelmorRenderer';
import {
  VerdantFrontiersRuntime,
  type VerdantWorldStatus,
} from './verdant/verdantWorldRuntime';
import type {
  ObserverRefinementAgenda,
  ObserverSnapshot,
  VerdantVsmManagerSpec,
} from './verdant/verdantObserverManager';
import type {
  VerdantPartSlot,
  VerdantResolutionTier,
} from './verdant/verdantModelOfModels';
import {
  ALL_CANONICAL_WORLDS,
  CANONICAL_REALM_SPECS,
  type DungeonArchitecturalStyle,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './verdant/realmModelSchema';
import {
  synthesizeProceduralDungeon,
  synthesizeUniverseCell,
} from './verdant/verdantUniverseGenerator';
import { VerdantSpatialAudio, type VerdantAudioState } from './verdant/verdantAudioEngine';
import {
  getPlaylistForRealm,
  synthesizeScoreFromBrief,
  type RealmSoundtrackSpec,
} from './verdant/verdantScoreSchema';
import { isStaticPagesHost } from './utils/publicUrl';
import {
  getRelicArchetypeForTheme,
  renderRelicSigilSvgDataUrl,
  synthesizeBiomeRelic,
} from './verdant/verdantRelicCatalog';
import {
  applyGearUpgrade,
  mergeChatMessage,
  mergeRemoteBanner,
  removeRemotePlayer,
  upsertRemotePlayer,
  type CraftingMaterials,
  type EquippedRelic,
  type GearUpgradeTiers,
  type PartySummon,
  type RemotePlayerState,
  type WorldChatMessage,
  type WorldPing,
  type WorldPingKind,
} from './game/multiplayerTypes';
import {
  mergeWorldPing,
  normalizeCallsign,
  normalizeRoomCode,
  parseCallsignFromSearch,
  parseRoomCodeFromSearch,
} from './game/multiplayerState';
import { VaelmorRealmClient } from './game/multiplayerClient';
import { TitleOverlay } from './components/game/TitleOverlay';
import { PrologueCinematicOverlay } from './components/game/PrologueCinematicOverlay';
import { FieldManualModal } from './components/game/FieldManualModal';
import { GameHud, type CombatCallout } from './components/game/GameHud';
import { DialogueOverlay } from './components/game/DialogueOverlay';
import { JournalMapModal, type AtlasTab } from './components/game/JournalMapModal';
import { StatusModal } from './components/game/StatusModal';
import { CharacterCreatorModal } from './components/game/CharacterCreatorModal';
import {
  DEFAULT_SAVE_GEAR_TIERS,
  DEFAULT_SAVE_MATERIALS,
  createNewSaveSlot,
  deleteSaveSlot,
  getFirstEmptySaveSlotId,
  getMostRecentSaveSlot,
  loadSaveSlotStore,
  renameSaveSlot,
  updateSaveSlotProgress,
  type SaveSlotId,
  type SaveSlotStoreState,
} from './game/saveSlotStorage';
import {
  evaluateJourneyProgress,
  type PrologueCinematicAct,
  type WaywrightOathId,
} from './verdant/verdantJourneyModel';
import type { PlayerCharacterProfile } from './verdant/verdantCharacterTypes';
import {
  computeCharacterCombatStats,
  computeCharacterProgression,
  createDefaultPlayerProfile,
  getClassSpec,
  getSpeciesSpec,
  normalizePlayerProfile,
} from './verdant/verdantCharacterOntology';

const DEFAULT_MATERIALS: CraftingMaterials = { ...DEFAULT_SAVE_MATERIALS };
const DEFAULT_TIERS: GearUpgradeTiers = { ...DEFAULT_SAVE_GEAR_TIERS };

const SLOT_LABELS: Record<SaveSlotId, string> = {
  'slot-1': 'Slot I',
  'slot-2': 'Slot II',
  'slot-3': 'Slot III',
};

function enrichStarterRelics(list: EquippedRelic[]): EquippedRelic[] {
  return list.map((r, idx) => {
    if (r.sigilSvg && r.perkId) return r;
    const theme: RealmThemeId = r.theme ?? (idx === 0 ? 'citadel-highlands' : 'sunken-aqueducts');
    const arch = getRelicArchetypeForTheme(theme);
    const rarity = r.rarity ?? 'Chartered';
    return {
      ...r,
      theme,
      rarity,
      perkId: r.perkId ?? arch.perkId,
      perkLabel: r.perkLabel ?? arch.perkLabel,
      perkDescription: r.perkDescription ?? arch.perkDescription,
      resonanceHz: r.resonanceHz ?? arch.resonanceHz,
      auraRgb: r.auraRgb ?? [...arch.auraRgb],
      sigilSvg: r.sigilSvg ?? renderRelicSigilSvgDataUrl(theme, rarity, 107 + idx * 31),
      catalogId: r.catalogId ?? arch.catalogId,
    };
  });
}

const DEFAULT_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  playerX: 0,
  playerZ: 17.5,
  playerYaw: Math.PI,
  region: WORLD_REGIONS[4],
  activeGear: 'hookblade',
  cooldowns: { hookblade: 0, bellhammer: 0, lantern: 0, compass: 0 },
  proximity: null,
  nearbyEnemies: [],
  defeatedCount: 0,
};

export default function App() {
  const autostart = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('autostart') === '1';
    } catch {
      return false;
    }
  }, []);

  const initialRoom = useMemo(() => {
    try {
      return parseRoomCodeFromSearch(window.location.search);
    } catch {
      return { roomCode: 'MERIDIAN-OPEN', invited: false };
    }
  }, []);

  const defaultBootCallsign = useMemo(() => {
    try {
      const fromUrl = parseCallsignFromSearch(window.location.search);
      if (fromUrl) return fromUrl;
      const stored = window.localStorage.getItem('frontiers-waywright-callsign');
      if (stored && stored.trim().length >= 2) return normalizeCallsign(stored);
    } catch {
      // ignore storage errors
    }
    const names = ['Alden', 'Bryn', 'Corin', 'Dara', 'Elowen', 'Fenn', 'Maren', 'Torin'];
    const suffix = Math.floor(10 + Math.random() * 89);
    return `${names[Math.floor(Math.random() * names.length)]}-${suffix}`;
  }, []);

  const initialSaveStore = useMemo(
    () => loadSaveSlotStore(undefined, defaultBootCallsign),
    [defaultBootCallsign],
  );
  const bootSlotRecord = useMemo(
    () => getMostRecentSaveSlot(initialSaveStore),
    [initialSaveStore],
  );
  const savedOnBoot = bootSlotRecord?.journey ?? null;

  const [saveStore, setSaveStore] = useState<SaveSlotStoreState>(initialSaveStore);
  const [activeSlotId, setActiveSlotId] = useState<SaveSlotId>(
    bootSlotRecord?.slotId ?? initialSaveStore.activeSlotId,
  );
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(autostart);
  const [prologueReturnPhase, setPrologueReturnPhase] = useState<'title' | 'playing'>('playing');
  const [prologueIsReplay, setPrologueIsReplay] = useState<boolean>(false);
  const [fieldManualOpen, setFieldManualOpen] = useState<boolean>(false);
  const [waywrightOath, setWaywrightOath] = useState<WaywrightOathId | null>(
    () => bootSlotRecord?.waywrightOath ?? null,
  );
  const [guideDismissed, setGuideDismissed] = useState<boolean>(false);
  const [hasVisitedDungeon, setHasVisitedDungeon] = useState<boolean>(
    () => Boolean(savedOnBoot?.hasVisitedDungeon),
  );

  const [playerCallsign, setPlayerCallsign] = useState<string>(
    () => bootSlotRecord?.waywrightName ?? defaultBootCallsign,
  );
  const [playerProfile, setPlayerProfile] = useState<PlayerCharacterProfile>(() =>
    normalizePlayerProfile(
      savedOnBoot?.characterProfile ??
        createDefaultPlayerProfile(bootSlotRecord?.waywrightName ?? defaultBootCallsign),
    ),
  );
  const [characterModal, setCharacterModal] = useState<{
    mode: 'create' | 'customize';
    slotId: SaveSlotId;
  } | null>(null);
  const [roomCode, setRoomCode] = useState<string>(initialRoom.roomCode);
  const [worldPings, setWorldPings] = useState<WorldPing[]>([]);
  const [activeSummon, setActiveSummon] = useState<PartySummon | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VerdantFrontiersRuntime | null>(null);
  const audioRef = useRef<VerdantSpatialAudio | null>(null);
  const realmRef = useRef<VaelmorRealmClient | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const calloutSeqRef = useRef<number>(1);

  const [phase, setPhase] = useState<GamePhase>(autostart ? 'playing' : 'title');
  const [hud, setHud] = useState<HudSnapshot>(DEFAULT_HUD);
  const [quests, setQuests] = useState<GameQuest[]>(() =>
    savedOnBoot
      ? savedOnBoot.quests
      : INITIAL_QUESTS.map((q) => ({ ...q, objectives: q.objectives.map((o) => ({ ...o })) })),
  );
  const [trackedQuestId, setTrackedQuestId] = useState<string>(INITIAL_QUESTS[0].id);
  const [renown, setRenown] = useState<number>(() => savedOnBoot?.renown ?? 0);
  const [guilds, setGuilds] = useState<GuildCharter[]>(() => INITIAL_GUILDS.map((g) => ({ ...g })));
  const [pledgedGuildId, setPledgedGuildId] = useState<string>(
    () => savedOnBoot?.pledgedGuildId ?? INITIAL_GUILDS[0].id,
  );
  const [banners, setBanners] = useState<FoundationBanner[]>(() => savedOnBoot?.banners ?? []);
  const [materials, setMaterials] = useState<CraftingMaterials>(
    () => savedOnBoot?.materials ?? DEFAULT_MATERIALS,
  );
  const [gearTiers, setGearTiers] = useState<GearUpgradeTiers>(
    () => savedOnBoot?.gearTiers ?? DEFAULT_TIERS,
  );
  const [relics, setRelics] = useState<EquippedRelic[]>(() =>
    enrichStarterRelics(savedOnBoot?.relics ?? INITIAL_RELICS.map((r) => ({ ...r }))),
  );
  const [discoveredRegions, setDiscoveredRegions] = useState<RegionId[]>(
    () => savedOnBoot?.discoveredRegions ?? ['southern-terrace'],
  );

  // Real-time multiplayer state
  const [realmConnected, setRealmConnected] = useState<boolean>(false);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);
  const [chatMessages, setChatMessages] = useState<WorldChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  // Modals & UI feedback
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [atlasTab, setAtlasTab] = useState<AtlasTab | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<CombatCallout[]>([]);
  const [victoryShown, setVictoryShown] = useState<boolean>(false);
  const [seekingRumor, setSeekingRumor] = useState<boolean>(false);
  const [rumorError, setRumorError] = useState<string | null>(null);
  const [forgingRelic, setForgingRelic] = useState<boolean>(false);
  const [forgeError, setForgeError] = useState<string | null>(null);
  const [_verdantStatus, setVerdantStatus] = useState<VerdantWorldStatus | null>(null);
  const [modelObserverSnapshot, setModelObserverSnapshot] = useState<ObserverSnapshot | null>(null);
  const [refiningWorldModel, setRefiningWorldModel] = useState<boolean>(false);

  // Federated Multi-Realm Universe State (6 Vast Overworld Realms + 6 Playable 3D Dungeons)
  const [realms, setRealms] = useState<FrontiersRealmSpec[]>(() => ALL_CANONICAL_WORLDS);
  const [activeRealmSlug, setActiveRealmSlug] = useState<string>('vaelmor');
  const [activeNpcs, setActiveNpcs] = useState<GameNpc[]>(() => INITIAL_NPCS);
  const [travelingRealm, setTravelingRealm] = useState<boolean>(false);
  const [generatingRealm, setGeneratingRealm] = useState<boolean>(false);
  const [realmGenError, setRealmGenError] = useState<string | null>(null);
  const [generatingDungeon, setGeneratingDungeon] = useState<boolean>(false);
  const [dungeonGenError, setDungeonGenError] = useState<string | null>(null);
  const [composingScore, setComposingScore] = useState<boolean>(false);
  const [audioState, setAudioState] = useState<VerdantAudioState | null>(null);
  const [frontierBanner, setFrontierBanner] = useState<{
    name: string;
    subtitle: string;
    cell: [number, number, number];
  } | null>(null);
  const frontierBannerTimerRef = useRef<number | null>(null);
  const [realmPlaylist, setRealmPlaylist] = useState<RealmSoundtrackSpec[]>(() =>
    getPlaylistForRealm(
      CANONICAL_REALM_SPECS[0].theme,
      Boolean(CANONICAL_REALM_SPECS[0].isDungeon),
      CANONICAL_REALM_SPECS[0].soundtrack,
    ),
  );

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pledgedGuildRef = useRef(pledgedGuildId);
  pledgedGuildRef.current = pledgedGuildId;
  const playerCallsignRef = useRef(playerCallsign);
  playerCallsignRef.current = playerCallsign;
  const victoryShownRef = useRef(victoryShown);
  victoryShownRef.current = victoryShown;
  const realmsRef = useRef(realms);
  realmsRef.current = realms;
  const handleTravelToRealmRef = useRef<
    ((realm: FrontiersRealmSpec, spawnOverride?: { x: number; z: number; yaw?: number }) => Promise<void>) | null
  >(null);
  const handleTravelToCellRef = useRef<
    ((cx: number, cz: number, spawnOverride?: { x: number; z: number; yaw?: number }) => Promise<void>) | null
  >(null);
  const activeRealmRef = useRef<FrontiersRealmSpec>(CANONICAL_REALM_SPECS[0]);
  const addedBannerIdsRef = useRef<Set<string>>(new Set((savedOnBoot?.banners ?? []).map((b) => b.id)));

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const pushCombatCallout = useCallback(
    (text: string, tone: 'damage' | 'heavy' | 'heal' | 'gold') => {
      const id = calloutSeqRef.current++;
      setCallouts((prev) => [...prev.slice(-3), { id, text, tone }]);
      window.setTimeout(() => {
        setCallouts((prev) => prev.filter((c) => c.id !== id));
      }, 1100);
    },
    [],
  );

  const gearUpgradeTotal = useMemo(
    () =>
      Math.max(0, gearTiers.hookblade - 1) +
      Math.max(0, gearTiers.bellhammer - 1) +
      Math.max(0, gearTiers.lantern - 1) +
      Math.max(0, gearTiers.compass - 1),
    [gearTiers],
  );

  const journeySummary = useMemo(
    () =>
      evaluateJourneyProgress({
        quests,
        defeatedCount: hud.defeatedCount,
        bannersCount: banners.length,
        gearUpgradeTotal,
        hasVisitedDungeon,
        discoveredRegions,
        prologueCompleted: Boolean(saveStore.slots[activeSlotId]?.prologueCompleted),
      }),
    [
      quests,
      hud.defeatedCount,
      banners.length,
      gearUpgradeTotal,
      hasVisitedDungeon,
      discoveredRegions,
      saveStore.slots,
      activeSlotId,
    ],
  );

  // Persist active Save Slot whenever player is in an active expedition session
  useEffect(() => {
    if (!hasActiveSession) return;
    setSaveStore((prev) =>
      updateSaveSlotProgress(prev, {
        slotId: activeSlotId,
        waywrightName: playerCallsign,
        journeyChapterTitle: journeySummary.currentChapterTitle,
        journey: {
          quests,
          renown,
          pledgedGuildId,
          banners,
          materials,
          gearTiers,
          relics,
          discoveredRegions,
          activeRealmSlug,
          activeRealmName: activeRealmRef.current.name,
          regionName: hud.region.name,
          defeatedCount: hud.defeatedCount,
          hasVisitedDungeon,
          characterProfile: playerProfile,
        },
      }),
    );
  }, [
    hasActiveSession,
    activeSlotId,
    playerCallsign,
    playerProfile,
    journeySummary.currentChapterTitle,
    quests,
    renown,
    pledgedGuildId,
    banners,
    materials,
    gearTiers,
    relics,
    discoveredRegions,
    activeRealmSlug,
    hud.region.name,
    hud.defeatedCount,
    hasVisitedDungeon,
  ]);

  // Increment active slot play-time cleanly every 10s while actively playing
  useEffect(() => {
    if (phase !== 'playing' || !hasActiveSession) return;
    const id = window.setInterval(() => {
      setSaveStore((prev) => {
        const cur = prev.slots[activeSlotId];
        if (!cur) return prev;
        return updateSaveSlotProgress(prev, {
          slotId: activeSlotId,
          waywrightName: cur.waywrightName,
          journey: cur.journey,
          playTimeDeltaSec: 10,
        });
      });
    }, 10000);
    return () => window.clearInterval(id);
  }, [phase, hasActiveSession, activeSlotId]);

  // Fetch compiled & dynamically generated Federated Realms from Verdant MCP Host
  useEffect(() => {
    if (isStaticPagesHost()) return;
    let cancelled = false;
    fetch('/api/verdant/realms')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.ok && Array.isArray(json.realms) && json.realms.length > 0) {
          setRealms(json.realms as FrontiersRealmSpec[]);
        }
      })
      .catch(() => {
        // Fallback to bundled CANONICAL_REALM_SPECS
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync document.body.dataset.state for deterministic game state lifecycle
  useEffect(() => {
    const mapped = phase === 'victory' ? 'gameover' : phase;
    document.body.dataset.state = mapped;
  }, [phase]);

  // Pause 3D engine simulation while Dialogue, Field Atlas, or Character Atelier is open
  const effectiveEnginePhase: GamePhase =
    phase === 'playing' &&
    (activeNpcId !== null || atlasTab !== null || characterModal !== null)
      ? 'paused'
      : phase;

  useEffect(() => {
    engineRef.current?.setPhase(effectiveEnginePhase);
  }, [effectiveEnginePhase]);

  const completedQuestsCount = useMemo(
    () => quests.filter((q) => q.status === 'completed').length,
    [quests],
  );
  useEffect(() => {
    engineRef.current?.setCompletedQuestsCount(completedQuestsCount);
  }, [completedQuestsCount]);

  // Live Character Progression (Level 1..20, 5 Core Attributes, 4-Tier Evolution)
  const characterProgression = useMemo(
    () =>
      computeCharacterProgression(
        playerProfile,
        renown,
        completedQuestsCount,
        hud.defeatedCount,
      ),
    [playerProfile, renown, completedQuestsCount, hud.defeatedCount],
  );

  // Sync live customized 3D Player Character rig & Sovereign Evolution Rank into Verdant 3D engine
  useEffect(() => {
    engineRef.current?.setPlayerCharacterProfile(
      playerProfile,
      characterProgression.evolutionRank,
    );
  }, [playerProfile, characterProgression.evolutionRank]);

  // Sync computed combat stats (Species + Class + Attributes + Gear Tiers + Relics Synergy) into 3D engine
  const combatStats = useMemo(
    () =>
      computeCharacterCombatStats(
        playerProfile,
        gearTiers,
        relics,
        characterProgression,
      ),
    [playerProfile, gearTiers, relics, characterProgression],
  );
  useEffect(() => {
    engineRef.current?.setPlayerCombatStats(combatStats);
  }, [combatStats]);

  // Sync remote multiplayer avatars into 3D scene
  useEffect(() => {
    engineRef.current?.syncRemotePlayers(remotePlayers);
  }, [remotePlayers]);

  useEffect(() => {
    engineRef.current?.syncWorldPings(worldPings);
  }, [worldPings]);

  // Unlock Codex entries automatically as player enters new regions
  useEffect(() => {
    const rid = hud.region.id;
    setDiscoveredRegions((prev) => (prev.includes(rid) ? prev : [...prev, rid]));
  }, [hud.region.id]);

  // Sync 3D objective waypoint beam with active tracked quest objective
  const trackedQuest = useMemo(
    () =>
      quests.find((q) => q.id === trackedQuestId) ??
      quests.find((q) => q.status === 'active') ??
      null,
    [quests, trackedQuestId],
  );
  useEffect(() => {
    const obj = trackedQuest?.objectives.find((o) => o.currentCount < o.requiredCount);
    engineRef.current?.setTrackedObjectiveCoords(obj ? obj.targetCoords : null);
  }, [trackedQuest]);

  // Quest progression reducer
  const applyQuestProgress = useCallback(
    (kind: Parameters<typeof advanceQuests>[1], targetId: string, amount = 1) => {
      setQuests((prev) => {
        const res = advanceQuests(prev, kind, targetId, amount);
        if (!res.progressed) return prev;

        if (res.newlyCompleted.length > 0) {
          const gained = res.newlyCompleted.reduce((acc, q) => acc + q.renownReward, 0);
          setRenown((r) => r + gained);
          setMaterials((m) => ({
            silicateMoss: m.silicateMoss + 1,
            lodestoneShards: m.lodestoneShards + 2,
            foundrySlag: m.foundrySlag + 1,
          }));
          setGuilds((gs) =>
            gs.map((g) =>
              res.newlyCompleted.some((q) => q.guildId === g.id)
                ? { ...g, prosperity: Math.min(100, g.prosperity + 8) }
                : g,
            ),
          );
          audioRef.current?.playQuestComplete();
          pushCombatCallout(`CHARTER COMPLETE +${gained}`, 'gold');
          showToast(`Charter Complete: ${res.newlyCompleted[0].title} (+${gained} Renown)`);
          realmRef.current?.sendQuestCompleted(
            res.newlyCompleted[0].title,
            res.newlyCompleted[0].guildId,
          );

          const nextActive = res.quests.find((q) => q.status === 'active');
          if (nextActive) {
            setTrackedQuestId(nextActive.id);
          }

          const coreIds = INITIAL_QUESTS.map((q) => q.id);
          const allCoreComplete = coreIds.every(
            (id) => res.quests.find((q) => q.id === id)?.status === 'completed',
          );
          if (allCoreComplete && !victoryShownRef.current) {
            setVictoryShown(true);
            setPhase('victory');
          }
        }
        return res.quests;
      });
    },
    [pushCombatCallout, showToast],
  );

  // Mount real Verdant Engine (verdant-uorc.wasm + scene-hd-renderer.mjs + Prism) & WebSocket Realm
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new VerdantSpatialAudio();
    const initialPlaylist = getPlaylistForRealm(
      CANONICAL_REALM_SPECS[0].theme,
      Boolean(CANONICAL_REALM_SPECS[0].isDungeon),
      CANONICAL_REALM_SPECS[0].soundtrack,
    );
    audio.setOnTrackChange((st) => {
      setAudioState(st);
      setRealmPlaylist(audio.getPlaylist());
    });
    audio.setRealmPlaylist(initialPlaylist);
    setAudioState(audio.getAudioState());
    setRealmPlaylist(audio.getPlaylist());
    audioRef.current = audio;
    (window as unknown as { __VERDANT_AUDIO__?: () => unknown }).__VERDANT_AUDIO__ = () =>
      audio.getAudioState();

    const initialBanners = savedOnBoot?.banners ?? [];
    const engine = new VerdantFrontiersRuntime(
      container,
      INITIAL_NPCS,
      createInitialEnemies(),
      INITIAL_INTERACTABLES.map((i) => ({ ...i })),
      initialBanners.map((b) => ({ ...b })),
      {
        onHudUpdate: (snap) => {
          setHud(snap);
          realmRef.current?.sendMove(
            snap.playerX,
            snap.playerZ,
            snap.playerYaw,
            snap.activeGear,
            snap.region.id,
            snap.hp,
            snap.maxHp,
            snap.waterPosture,
          );
        },
        onPlayerAction: (gear, x, z, yaw) => {
          realmRef.current?.sendAction(gear, x, z, yaw);
        },
        onEnemyDamaged: (payload) => {
          realmRef.current?.sendEnemyDamage({
            enemyId: payload.enemyId,
            enemyName: payload.enemyName,
            archetype: payload.archetype,
            damage: payload.damage,
            maxHp: payload.maxHp,
            realmSlug: activeRealmRef.current.slug,
          });
        },
        onCoopLanternCast: (amount, x, z) => {
          realmRef.current?.sendCoopHeal(amount, x, z, activeRealmRef.current.slug);
        },
        onCombatCallout: (text, tone) => {
          pushCombatCallout(text, tone);
        },
        onInteractNpc: (npcId) => {
          setActiveNpcId(npcId);
          applyQuestProgress('talk-npc', npcId);
        },
        onActivateInteractable: (item: WorldInteractable) => {
          if (item.kind === 'dungeon-portal' || item.kind === 'dungeon-exit') {
            let target = item.targetRealmSlug
              ? realmsRef.current.find((r) => r.slug === item.targetRealmSlug)
              : null;
            if (!target && item.kind === 'dungeon-portal' && activeRealmRef.current.isProceduralCell) {
              target = synthesizeProceduralDungeon(activeRealmRef.current);
              setRealms((prev) =>
                prev.some((r) => r.slug === target!.slug) ? prev : [...prev, target!],
              );
            }
            if (target && handleTravelToRealmRef.current) {
              audio.playPortalTravel(item.kind === 'dungeon-portal');
              void handleTravelToRealmRef.current(target);
            } else {
              showToast(`Portal target ${item.name} is sealing—open Vaults [V] to travel.`);
            }
          } else if (item.kind === 'seal-brazier') {
            applyQuestProgress('calibrate-beacon', item.id);
            const stem = item.id.replace(/-[we]$/, '');
            if (stem !== item.id) {
              applyQuestProgress('calibrate-beacon', stem);
            }
            setMaterials((m) => ({ ...m, foundrySlag: m.foundrySlag + 1 }));
            showToast(`${item.name} ignited (+1 Foundry Slag).`);
          } else if (item.kind === 'vault-chest') {
            setMaterials((m) => ({
              silicateMoss: m.silicateMoss + 2,
              lodestoneShards: m.lodestoneShards + 3,
              foundrySlag: m.foundrySlag + 2,
            }));
            setRenown((r) => r + 60);
            const hostRealm = activeRealmRef.current;
            const vaultRelic = synthesizeBiomeRelic({
              theme: hostRealm.theme,
              realmName: hostRealm.name,
              source: 'vault-chest',
              seed: (Date.now() + item.id.length * 131) >>> 0,
            });
            setRelics((prev) =>
              prev.some((r) => r.name === vaultRelic.name) ? prev : [vaultRelic, ...prev],
            );
            engine.ingestEmergentLore(
              vaultRelic.id,
              `Vault Relic ${vaultRelic.name} (${vaultRelic.rarity} · ${vaultRelic.perkLabel}): ${vaultRelic.description}`,
            );
            audio.playQuestComplete();
            pushCombatCallout(`+60 RENOWN · ${vaultRelic.rarity.toUpperCase()} RELIC`, 'gold');
            showToast(`Unsealed ${item.name} — Recovered ${vaultRelic.name} (${vaultRelic.perkLabel})!`);
          } else if (item.kind === 'resonance-pier' || item.kind === 'forge-bell') {
            applyQuestProgress('ring-bell', item.id);
            const stem = item.id.replace(/-[we]$/, '');
            if (stem !== item.id) {
              applyQuestProgress('ring-bell', stem);
            }
            setMaterials((m) => ({ ...m, foundrySlag: m.foundrySlag + 1 }));
            showToast(`${item.name} resonates across the frontier (+1 Foundry Slag).`);
          } else if (item.kind === 'waystone-beacon') {
            applyQuestProgress('calibrate-beacon', item.id);
            const stem = item.id.replace(/-[we]$/, '');
            if (stem !== item.id) {
              applyQuestProgress('calibrate-beacon', stem);
            }
            setMaterials((m) => ({ ...m, lodestoneShards: m.lodestoneShards + 2 }));
            showToast(`${item.name} attuned to the Meridian network (+2 Lodestone).`);
          } else if (item.kind === 'silicate-relic') {
            applyQuestProgress('collect-relics', 'silicate-relic');
            applyQuestProgress('collect-relics', item.id);
            const stem = item.id.replace(/-[we]$/, '');
            if (stem !== item.id) {
              applyQuestProgress('collect-relics', stem);
            }
            setMaterials((m) => ({ ...m, silicateMoss: m.silicateMoss + 1 }));
            showToast(`Harvested ${item.name} (+1 Silicate Moss).`);
          }
          if (item.kind !== 'dungeon-portal' && item.kind !== 'dungeon-exit') {
            realmRef.current?.sendInteractableActivate(
              item.id,
              item.name,
              activeRealmRef.current.slug,
            );
          }
        },
        onEnemyDefeated: (archetype: EnemyArchetype, name: string) => {
          applyQuestProgress('defeat-archetype', archetype);
          const renownReward = archetype === 'colossus' ? 85 : 25;
          setRenown((r) => r + renownReward);
          setMaterials((m) => ({
            silicateMoss: m.silicateMoss + (archetype === 'colossus' ? 1 : 0),
            lodestoneShards: m.lodestoneShards + (archetype === 'colossus' ? 2 : 1),
            foundrySlag: m.foundrySlag + (archetype === 'colossus' ? 2 : 1),
          }));
          if (archetype === 'colossus') {
            const hostRealm = activeRealmRef.current;
            const bossRelic = synthesizeBiomeRelic({
              theme: hostRealm.theme,
              realmName: hostRealm.name,
              rarity: 'Sovereign',
              source: 'colossus-drop',
              brief: `trophied from ${name}`,
              seed: (Date.now() + name.length * 997) >>> 0,
            });
            setRelics((prev) => [bossRelic, ...prev]);
            engine.ingestEmergentLore(
              bossRelic.id,
              `Sovereign Trophy ${bossRelic.name} (${bossRelic.perkLabel}) claimed from ${name}`,
            );
            audio.playQuestComplete();
            pushCombatCallout(`SOVEREIGN RELIC · ${bossRelic.name.toUpperCase()}`, 'gold');
            showToast(`Vanquished ${name}! Claimed Sovereign Relic: ${bossRelic.name} (${bossRelic.perkLabel}).`);
          } else {
            showToast(`Vanquished ${name} (+25 Renown, +1 Lodestone)`);
          }
        },
        onPlayerDamaged: (_newHp, defeated) => {
          if (defeated && phaseRef.current === 'playing') {
            setActiveNpcId(null);
            setAtlasTab(null);
            setChatOpen(false);
            setPhase('gameover');
          }
        },
        onBannerPlanted: (x, z) => {
          const guild =
            INITIAL_GUILDS.find((g) => g.id === pledgedGuildRef.current) ?? INITIAL_GUILDS[0];
          const banner: FoundationBanner = {
            id: `banner-${Date.now()}-${Math.round(Math.random() * 999)}`,
            name: `${guild.name.split(' ')[0]} Waymark`,
            guildId: guild.id,
            builderName: playerCallsignRef.current,
            position: [x, z],
            plantedAt: Date.now(),
            realmSlug: activeRealmRef.current.slug,
          };
          addedBannerIdsRef.current.add(banner.id);
          engine.addBannerMesh(banner);
          // Cryptographically seal & Stitch 2-of-3 shard the federated Foundation Banner
          void engine.sealStitchPayload({
            kind: 'foundation-banner',
            id: banner.id,
            guildId: banner.guildId,
            builderName: banner.builderName,
            position: banner.position,
          });
          setBanners((prev) => mergeRemoteBanner(prev, banner));
          setGuilds((gs) =>
            gs.map((g) =>
              g.id === guild.id ? { ...g, prosperity: Math.min(100, g.prosperity + 4) } : g,
            ),
          );
          applyQuestProgress('plant-banner', 'any');
          showToast(`Foundation Banner raised for ${guild.name}!`);
          realmRef.current?.sendBannerPlant(banner);
        },
        onGearFeedback: (message) => showToast(message),
        onAudioEvent: (ev) => {
          if (ev.kind === 'region') audio.setRegionMood(ev.mood);
          else if (ev.kind === 'swing') audio.playSwing();
          else if (ev.kind === 'bell') audio.playResonanceBell(ev.hz);
          else if (ev.kind === 'hit') audio.playHit(ev.heavy);
          else if (ev.kind === 'jump') audio.playJump();
          else if (ev.kind === 'heal') audio.playHeal();
          else if (ev.kind === 'telegraph') audio.playTelegraph();
          else if (ev.kind === 'defeat') audio.playDefeat();
        },
      },
      {
        onVerdantReady: (st) => {
          setVerdantStatus(st);
          (window as unknown as { __VERDANT_STATUS__?: VerdantWorldStatus }).__VERDANT_STATUS__ = st;
        },
        onModelObserverChange: (snap) => {
          setModelObserverSnapshot(snap);
        },
        onSpatialAudio: (metrics) => {
          audio.updateSpatialMetrics(metrics);
        },
        onCombatIntensity: (intensity) => {
          audio.setCombatIntensity(intensity);
        },
        onFootstep: (surface) => {
          audio.playFootstep(surface);
        },
        onCrossFrontierBorder: (_dir, nextCell, entryPos, entryYaw) => {
          if (handleTravelToCellRef.current) {
            void handleTravelToCellRef.current(nextCell[0], nextCell[2], {
              x: entryPos[0],
              z: entryPos[1],
              yaw: entryYaw,
            });
          }
        },
      },
    );

    engineRef.current = engine;
    (window as unknown as { __VERDANT_DEBUG__?: () => unknown }).__VERDANT_DEBUG__ = () =>
      engine.getDebugSnapshot();
    (window as unknown as { __VERDANT_ENGINE__?: VerdantFrontiersRuntime }).__VERDANT_ENGINE__ =
      engine;
    engine.setPlayerCombatStats(
      computeCharacterCombatStats(playerProfile, gearTiers, relics, characterProgression),
    );
    engine.setPlayerCharacterProfile(playerProfile, characterProgression.evolutionRank);
    if (autostart) {
      engine.setPhase('playing');
    }

    // Connect real WebSocket multiplayer client (/ws/realm)
    const realm = new VaelmorRealmClient(
      {
        name: playerCallsignRef.current,
        guildId: pledgedGuildRef.current,
        roomCode: initialRoom.roomCode,
        realmSlug: activeRealmRef.current.slug,
        realmName: activeRealmRef.current.name,
      },
      {
        onConnected: (ok) => setRealmConnected(ok),
        onInit: (payload) => {
          selfIdRef.current = payload.selfId;
          setRoomCode(payload.roomCode);
          setRemotePlayers(payload.players);
          setChatMessages(payload.chatHistory);
          setWorldPings(payload.pings ?? []);
          if (payload.activeSummon) {
            setActiveSummon(payload.activeSummon);
          }
          if (payload.guildProsperity) {
            setGuilds((gs) =>
              gs.map((g) =>
                typeof payload.guildProsperity[g.id] === 'number'
                  ? { ...g, prosperity: payload.guildProsperity[g.id] }
                  : g,
              ),
            );
          }
          for (const b of payload.banners) {
            if (!addedBannerIdsRef.current.has(b.id)) {
              addedBannerIdsRef.current.add(b.id);
              engine.addBannerMesh(b);
            }
          }
          setBanners((prev) => payload.banners.reduce((acc, b) => mergeRemoteBanner(acc, b), prev));
          if (payload.realmEnemies) {
            for (const sharedEnemy of Object.values(payload.realmEnemies)) {
              engine.applyRemoteEnemySync(sharedEnemy);
            }
          }
          if (payload.activatedInteractables) {
            for (const itemId of payload.activatedInteractables) {
              engine.applyRemoteInteractableActivated(itemId);
            }
          }
        },
        onRealmSync: (sync) => {
          if (sync.realmSlug !== activeRealmRef.current.slug) return;
          setWorldPings(sync.pings ?? []);
          for (const b of sync.banners) {
            if (!addedBannerIdsRef.current.has(b.id)) {
              addedBannerIdsRef.current.add(b.id);
              engine.addBannerMesh(b);
            }
          }
          setBanners((prev) => sync.banners.reduce((acc, b) => mergeRemoteBanner(acc, b), prev));
          for (const sharedEnemy of Object.values(sync.realmEnemies ?? {})) {
            engine.applyRemoteEnemySync(sharedEnemy);
          }
          for (const itemId of sync.activatedInteractables ?? []) {
            engine.applyRemoteInteractableActivated(itemId);
          }
        },
        onPlayerUpsert: (player) => {
          setRemotePlayers((prev) => upsertRemotePlayer(prev, player, selfIdRef.current));
        },
        onPlayerLeave: (playerId) => {
          setRemotePlayers((prev) => removeRemotePlayer(prev, playerId));
        },
        onPlayerAction: (ev) => {
          engine.spawnRemoteActionVfx(ev);
        },
        onEnemySync: ({ realmSlug, enemy, attackerName, killedNow }) => {
          if (realmSlug !== activeRealmRef.current.slug) return;
          const res = engine.applyRemoteEnemySync(enemy, attackerName);
          if ((killedNow || res.killedLocally) && res.enemy) {
            applyQuestProgress('defeat-archetype', res.enemy.archetype);
            const assistRenown = res.enemy.archetype === 'colossus' ? 60 : 20;
            setRenown((r) => r + assistRenown);
            showToast(
              `${attackerName} felled ${res.enemy.name} — Co-op Assist (+${assistRenown} Renown)!`,
            );
          }
        },
        onInteractableActivated: ({ realmSlug, interactableId, interactableName, activatorName }) => {
          if (realmSlug !== activeRealmRef.current.slug) return;
          const activated = engine.applyRemoteInteractableActivated(interactableId);
          if (activated) {
            if (activated.kind === 'resonance-pier' || activated.kind === 'forge-bell') {
              applyQuestProgress('ring-bell', activated.id);
            } else if (activated.kind === 'waystone-beacon' || activated.kind === 'seal-brazier') {
              applyQuestProgress('calibrate-beacon', activated.id);
            } else if (activated.kind === 'silicate-relic') {
              applyQuestProgress('collect-relics', 'silicate-relic');
            }
            showToast(`${activatorName} activated ${interactableName}!`);
          }
        },
        onCoopHealed: (ev) => {
          if (ev.realmSlug !== activeRealmRef.current.slug) return;
          engine.applyCoopHeal(ev.amount, ev.healerName);
          showToast(`${ev.healerName}'s Mortar Lantern mended you (+${ev.amount} Vitality)!`);
        },
        onWorldPing: (ping) => {
          if (ping.realmSlug !== activeRealmRef.current.slug) return;
          setWorldPings((prev) => mergeWorldPing(prev, ping));
          if (ping.senderId !== selfIdRef.current) {
            audio.playResonanceBell(ping.kind === 'danger' ? 196 : 330);
            showToast(`${ping.senderName} pinged: ${ping.label}`);
          }
        },
        onPartySummon: (summon) => {
          if (summon.senderId === selfIdRef.current) return;
          setActiveSummon(summon);
          audio.playResonanceBell(392);
        },
        onBannerPlanted: (banner) => {
          if (!addedBannerIdsRef.current.has(banner.id)) {
            addedBannerIdsRef.current.add(banner.id);
            engine.addBannerMesh(banner);
          }
          setBanners((prev) => mergeRemoteBanner(prev, banner));
          showToast(`${banner.builderName} raised ${banner.name}!`);
        },
        onGuildProsperity: (prosperity) => {
          setGuilds((gs) =>
            gs.map((g) =>
              typeof prosperity[g.id] === 'number' ? { ...g, prosperity: prosperity[g.id] } : g,
            ),
          );
        },
        onChatMessage: (message) => {
          setChatMessages((prev) => mergeChatMessage(prev, message));
        },
      },
    );
    realmRef.current = realm;

    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (frontierBannerTimerRef.current !== null) {
        window.clearTimeout(frontierBannerTimerRef.current);
      }
      realm.dispose();
      realmRef.current = null;
      audio.dispose();
      audioRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
    // Mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartNewInSlot = useCallback(
    (
      slotId: SaveSlotId,
      waywrightName: string,
      guildId: string = INITIAL_GUILDS[0].id,
      customProfile?: PlayerCharacterProfile,
    ) => {
      void audioRef.current?.ensureStarted();
      const cleanName = normalizeCallsign(waywrightName, defaultBootCallsign);
      const nextProfile = normalizePlayerProfile(
        customProfile
          ? { ...customProfile, name: cleanName }
          : createDefaultPlayerProfile(cleanName),
      );
      const { store: nextStore, record } = createNewSaveSlot(saveStore, {
        slotId,
        waywrightName: cleanName,
        pledgedGuildId: guildId,
        prologueCompleted: false,
        characterProfile: nextProfile,
      });
      setSaveStore(nextStore);
      setActiveSlotId(slotId);
      setHasActiveSession(true);
      setPlayerCallsign(cleanName);
      setPlayerProfile(nextProfile);
      setCharacterModal(null);
      try {
        window.localStorage.setItem('frontiers-waywright-callsign', cleanName);
      } catch {
        // ignore storage errors
      }
      setQuests(record.journey.quests);
      setTrackedQuestId(record.journey.quests[0].id);
      setRenown(0);
      setPledgedGuildId(guildId);
      setBanners([]);
      addedBannerIdsRef.current = new Set();
      setMaterials({ ...DEFAULT_MATERIALS });
      setGearTiers({ ...DEFAULT_TIERS });
      setRelics(enrichStarterRelics(INITIAL_RELICS.map((r) => ({ ...r }))));
      setDiscoveredRegions(['southern-terrace']);
      setHasVisitedDungeon(false);
      setGuideDismissed(false);
      setVictoryShown(false);
      setActiveNpcId(null);
      setAtlasTab(null);
      setChatOpen(false);
      setActiveRealmSlug('vaelmor');
      setActiveNpcs(INITIAL_NPCS);
      realmRef.current?.updateProfile(cleanName, guildId);
      engineRef.current?.setPlayerCharacterProfile(nextProfile, 1);
      if (activeRealmRef.current.slug !== 'vaelmor' && handleTravelToRealmRef.current) {
        void handleTravelToRealmRef.current(CANONICAL_REALM_SPECS[0]);
      } else {
        engineRef.current?.resetRun(createInitialEnemies(), INITIAL_INTERACTABLES);
      }
      setPrologueReturnPhase('playing');
      setPrologueIsReplay(false);
      setPhase('intro');
    },
    [defaultBootCallsign, saveStore],
  );

  const handleRestartActiveSlot = useCallback(() => {
    handleStartNewInSlot(
      activeSlotId,
      playerCallsignRef.current,
      pledgedGuildRef.current,
      playerProfile,
    );
  }, [activeSlotId, handleStartNewInSlot, playerProfile]);

  const handleContinueSlot = useCallback(
    (slotId: SaveSlotId) => {
      const slot = saveStore.slots[slotId];
      if (!slot) {
        setCharacterModal({ mode: 'create', slotId });
        return;
      }
      void audioRef.current?.ensureStarted();
      const restoredProfile = normalizePlayerProfile(
        slot.journey.characterProfile ?? createDefaultPlayerProfile(slot.waywrightName),
      );
      setActiveSlotId(slotId);
      setHasActiveSession(true);
      setPlayerCallsign(slot.waywrightName);
      setPlayerProfile(restoredProfile);
      setPledgedGuildId(slot.pledgedGuildId);
      setQuests(slot.journey.quests);
      const firstActive = slot.journey.quests.find((q) => q.status === 'active') ?? slot.journey.quests[0];
      if (firstActive) setTrackedQuestId(firstActive.id);
      setRenown(slot.journey.renown);
      setBanners(slot.journey.banners);
      addedBannerIdsRef.current = new Set(slot.journey.banners.map((b) => b.id));
      setMaterials(slot.journey.materials);
      setGearTiers(slot.journey.gearTiers);
      setRelics(enrichStarterRelics(slot.journey.relics));
      setDiscoveredRegions(slot.journey.discoveredRegions);
      setHasVisitedDungeon(Boolean(slot.journey.hasVisitedDungeon));
      setWaywrightOath(slot.waywrightOath ?? null);
      setGuideDismissed(false);
      setActiveNpcId(null);
      setAtlasTab(null);
      setCharacterModal(null);
      setChatOpen(false);
      realmRef.current?.updateProfile(slot.waywrightName, slot.pledgedGuildId);
      engineRef.current?.setPlayerCharacterProfile(restoredProfile, 1);

      // Restore saved realm if player last saved outside Vaelmor
      const targetSlug = slot.journey.activeRealmSlug || 'vaelmor';
      if (targetSlug !== activeRealmRef.current.slug && handleTravelToRealmRef.current) {
        const foundRealm = realmsRef.current.find((r) => r.slug === targetSlug);
        if (foundRealm) {
          void handleTravelToRealmRef.current(foundRealm);
        }
      }
      setPhase('playing');
      showToast(`Resumed ${SLOT_LABELS[slotId]} · Waywright ${slot.waywrightName}`);
    },
    [saveStore.slots, showToast],
  );

  const handleRenameSlot = useCallback(
    (slotId: SaveSlotId, nextName: string) => {
      const clean = normalizeCallsign(nextName);
      setSaveStore((prev) => renameSaveSlot(prev, slotId, clean));
      if (slotId === activeSlotId) {
        setPlayerCallsign(clean);
        realmRef.current?.updateProfile(clean, pledgedGuildRef.current);
      }
    },
    [activeSlotId],
  );

  const handleDeleteSlot = useCallback(
    (slotId: SaveSlotId) => {
      setSaveStore((prev) => {
        const next = deleteSaveSlot(prev, slotId);
        if (slotId === activeSlotId) {
          setActiveSlotId(next.activeSlotId);
          setHasActiveSession(false);
        }
        return next;
      });
    },
    [activeSlotId],
  );

  const handleWatchPrologue = useCallback((returnTo: 'title' | 'playing') => {
    void audioRef.current?.ensureStarted();
    setAtlasTab(null);
    setActiveNpcId(null);
    setChatOpen(false);
    setPrologueReturnPhase(returnTo);
    setPrologueIsReplay(true);
    setPhase('intro');
  }, []);

  const handleCompletePrologue = useCallback(() => {
    void audioRef.current?.ensureStarted();
    if (!prologueIsReplay && hasActiveSession) {
      setSaveStore((prev) => {
        const cur = prev.slots[activeSlotId];
        if (!cur) return prev;
        return updateSaveSlotProgress(prev, {
          slotId: activeSlotId,
          waywrightName: cur.waywrightName,
          journey: cur.journey,
          prologueCompleted: true,
          waywrightOath: waywrightOath ?? cur.waywrightOath,
        });
      });
    }
    setPhase(prologueReturnPhase);
    if (prologueReturnPhase === 'playing') {
      showToast('Speak with Magistrate Orenna Vael ahead on the Southern Causeway [E].');
    }
  }, [activeSlotId, hasActiveSession, prologueIsReplay, prologueReturnPhase, showToast, waywrightOath]);

  const handlePrologueActChange = useCallback((act: PrologueCinematicAct) => {
    engineRef.current?.setIntroCameraTarget(
      act.cameraEye,
      act.cameraTarget,
      Boolean(act.live3DReveal),
    );
    audioRef.current?.playPrologueSceneCue(act.vfxPreset);
  }, []);

  const handlePrologueSeismicBeat = useCallback(() => {
    audioRef.current?.playPrologueSeismicCrack();
  }, []);

  const handleSelectWaywrightOath = useCallback(
    (oathId: WaywrightOathId) => {
      setWaywrightOath(oathId);
      audioRef.current?.playResonanceBell(293.66);
      if (hasActiveSession) {
        setSaveStore((prev) => {
          const cur = prev.slots[activeSlotId];
          if (!cur) return prev;
          return updateSaveSlotProgress(prev, {
            slotId: activeSlotId,
            waywrightName: cur.waywrightName,
            journey: cur.journey,
            waywrightOath: oathId,
          });
        });
      }
    },
    [activeSlotId, hasActiveSession],
  );

  const handleRespawnAtCitadel = useCallback(() => {
    audioRef.current?.ensureStarted();
    engineRef.current?.revivePlayer(0, 17.5);
    setPhase('playing');
    showToast('Vitality restored at the Southern Causeway Gate.');
  }, [showToast]);

  const handleToggleMute = useCallback(() => {
    void audioRef.current?.ensureStarted();
    const nextMuted = audioRef.current?.toggleMute() ?? !muted;
    setMuted(nextMuted);
    if (audioRef.current) setAudioState(audioRef.current.getAudioState());
  }, [muted]);

  const handleActivateGear = useCallback((gear: GearSlotId) => {
    void audioRef.current?.ensureStarted();
    engineRef.current?.activateGear(gear);
  }, []);

  const handleTriggerAction = useCallback(() => {
    void audioRef.current?.ensureStarted();
    engineRef.current?.triggerPrimaryAction();
  }, []);

  const handleTriggerDodge = useCallback(() => {
    void audioRef.current?.ensureStarted();
    engineRef.current?.triggerDodge();
  }, []);

  const handleNextTrack = useCallback(() => {
    void audioRef.current?.ensureStarted();
    const st = audioRef.current?.nextTrack();
    if (st) {
      setAudioState(st);
      setRealmPlaylist(audioRef.current?.getPlaylist() ?? []);
      showToast(`Now Playing: ${st.scoreTitle} (${st.meter} · ${st.mode} · ${st.bpm} BPM)`);
    }
  }, [showToast]);

  const handlePrevTrack = useCallback(() => {
    void audioRef.current?.ensureStarted();
    const st = audioRef.current?.prevTrack();
    if (st) {
      setAudioState(st);
      setRealmPlaylist(audioRef.current?.getPlaylist() ?? []);
      showToast(`Now Playing: ${st.scoreTitle} (${st.meter} · ${st.mode} · ${st.bpm} BPM)`);
    }
  }, [showToast]);

  const handleSelectTrack = useCallback(
    (track: RealmSoundtrackSpec) => {
      void audioRef.current?.ensureStarted();
      const st = audioRef.current?.selectTrack(track);
      if (st) {
        setAudioState(st);
        setRealmPlaylist(audioRef.current?.getPlaylist() ?? []);
        showToast(`Now Playing: ${st.scoreTitle} (${st.meter} · ${st.mode} · ${st.bpm} BPM)`);
      }
    },
    [showToast],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        if (e.code === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (fieldManualOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setFieldManualOpen(false);
        }
        return;
      }

      if (characterModal !== null) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setCharacterModal(null);
        }
        return;
      }

      if (phase === 'title') {
        if (e.code === 'Enter') {
          e.preventDefault();
          const latest = getMostRecentSaveSlot(saveStore);
          if (latest) {
            handleContinueSlot(latest.slotId);
          } else {
            const target = getFirstEmptySaveSlotId(saveStore);
            setCharacterModal({ mode: 'create', slotId: target });
          }
        }
        return;
      }

      if (phase === 'intro') {
        // PrologueCinematicOverlay handles Space / Arrows / Escape internally
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (activeNpcId !== null) {
          setActiveNpcId(null);
        } else if (atlasTab !== null) {
          setAtlasTab(null);
        } else if (chatOpen) {
          setChatOpen(false);
        } else if (phase === 'playing') {
          setPhase('paused');
        } else if (phase === 'paused') {
          setPhase('playing');
        }
        return;
      }

      if (phase === 'playing' && activeNpcId === null) {
        if (e.code === 'KeyK') {
          e.preventDefault();
          setAtlasTab(null);
          setCharacterModal({ mode: 'customize', slotId: activeSlotId });
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          setAtlasTab(null);
          setPhase('paused');
        } else if (e.code === 'KeyJ') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'chronicle' ? null : 'chronicle'));
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'map' ? null : 'map'));
        } else if (e.code === 'KeyV') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'dungeons' ? null : 'dungeons'));
        } else if (e.code === 'KeyI') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'forge' ? null : 'forge'));
        } else if (e.code === 'KeyU') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'guilds' ? null : 'guilds'));
        } else if (e.code === 'KeyG' && atlasTab === null) {
          e.preventDefault();
          const snap = engineRef.current?.getDebugSnapshot();
          if (snap) {
            realmRef.current?.sendWorldPing(
              snap.playerX,
              snap.playerZ,
              'rally',
              'Rally Here',
              activeRealmRef.current.slug,
            );
            audioRef.current?.playResonanceBell(330);
            showToast('Rally Beacon dropped for your fellowship!');
          }
        } else if (e.code === 'KeyT' && atlasTab === null) {
          e.preventDefault();
          setChatOpen((o) => !o);
        } else if (e.code === 'KeyN') {
          e.preventDefault();
          handleToggleMute();
        }
      } else if (phase === 'paused' && e.code === 'KeyP') {
        e.preventDefault();
        setPhase('playing');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    fieldManualOpen,
    characterModal,
    activeSlotId,
    activeNpcId,
    atlasTab,
    chatOpen,
    saveStore,
    handleContinueSlot,
    handleToggleMute,
    showToast,
  ]);

  const handleSelectDialogueChoice = useCallback(
    (npc: GameNpc, choice: DialogueChoice) => {
      if (choice.renownGain) {
        setRenown((r) => r + choice.renownGain!);
      }
      if (choice.advancesQuestId) {
        setTrackedQuestId(choice.advancesQuestId);
      }
      engineRef.current?.recordNpcDialogue(npc.id, choice.label, choice.reply);
      applyQuestProgress('talk-npc', npc.id);
    },
    [applyQuestProgress],
  );

  const handleUpgradeGear = useCallback(
    (gearId: GearSlotId) => {
      const res = applyGearUpgrade(materials, gearTiers, gearId);
      if (!res.upgraded) return;
      setMaterials(res.wallet);
      setGearTiers(res.tiers);
      audioRef.current?.playResonanceBell(293.66);
      showToast(`Tempered gear to Tier ${res.tiers[gearId]}!`);
    },
    [materials, gearTiers, showToast],
  );

  const handleToggleRelic = useCallback((relicId: string) => {
    setRelics((prev) =>
      prev.map((r) => (r.id === relicId ? { ...r, equipped: !r.equipped } : r)),
    );
  }, []);

  const handleForgeEmergentRelic = useCallback(async () => {
    if (materials.silicateMoss < 1 || materials.lodestoneShards < 1) return;
    setForgingRelic(true);
    setForgeError(null);
    try {
      const hostRealm = activeRealmRef.current;
      const guild = guilds.find((g) => g.id === pledgedGuildId) ?? guilds[0];
      const newRelic = synthesizeBiomeRelic({
        theme: hostRealm.theme,
        realmName: hostRealm.name,
        existingNames: relics.map((r) => r.name),
        source: 'forge',
        brief: `${guild.name} charter survey`,
        seed: (Date.now() + relics.length * 4099) >>> 0,
      });

      setMaterials((m) => ({
        ...m,
        silicateMoss: Math.max(0, m.silicateMoss - 1),
        lodestoneShards: Math.max(0, m.lodestoneShards - 1),
      }));
      setRelics((prev) => [newRelic, ...prev]);
      engineRef.current?.ingestEmergentLore(
        newRelic.id,
        `${newRelic.name} (${newRelic.rarity} · ${newRelic.origin} · ${newRelic.perkLabel}): ${newRelic.description}`,
      );
      void engineRef.current?.sealStitchPayload({
        kind: 'verdant-relic',
        id: newRelic.id,
        name: newRelic.name,
        theme: newRelic.theme,
        rarity: newRelic.rarity,
        perkId: newRelic.perkId,
        resonanceHz: newRelic.resonanceHz,
      });
      audioRef.current?.playQuestComplete();
      showToast(`Forged & equipped ${newRelic.rarity} ${newRelic.name} (${newRelic.perkLabel})!`);
    } catch (err) {
      setForgeError(
        err instanceof Error ? err.message : 'Unable to forge Verdant relic right now.',
      );
    } finally {
      setForgingRelic(false);
    }
  }, [guilds, materials, pledgedGuildId, relics, showToast]);

  const handleSeekEmergentQuest = useCallback(async () => {
    setSeekingRumor(true);
    setRumorError(null);
    try {
      const guild = guilds.find((g) => g.id === pledgedGuildId) ?? guilds[0];
      const res = await fetch('/api/game/emergent-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingTitles: quests.map((q) => q.title),
          usedMotifs: quests.map((q) => q.motif),
          bannedTropes: BANNED_FANTASY_TROPES,
          playerGuild: guild.name,
        }),
      });
      const json = await res.json();
      if (!json.ok || !json.quest) {
        throw new Error(json.error || 'Unable to consult frontier waystones right now.');
      }

      const qData = json.quest;
      const targetRegion =
        WORLD_REGIONS.find((r) => r.id === qData.regionId) ?? WORLD_REGIONS[2];
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetZ = (Math.random() - 0.5) * 10;
      const tx = Math.round(targetRegion.center[0] + offsetX);
      const tz = Math.round(targetRegion.center[1] + offsetZ);
      const targetId = `emergent-beacon-${Date.now()}`;

      engineRef.current?.spawnEmergentTarget(targetId, qData.targetName, tx, tz);

      const newQuest: GameQuest = {
        id: `quest-emergent-${Date.now()}`,
        title: qData.title,
        giverNpcId: 'npc-orenna',
        guildId: guild.id,
        regionId: targetRegion.id,
        summary: qData.summary,
        motif: qData.motif,
        renownReward: Number(qData.renownReward) || 140,
        status: 'active',
        isEmergent: true,
        objectives: [
          {
            id: `obj-${Date.now()}`,
            description: qData.objectiveDescription,
            kind: 'calibrate-beacon',
            targetId,
            targetCoords: [tx, tz],
            requiredCount: 1,
            currentCount: 0,
          },
        ],
      };

      setQuests((prev) => [newQuest, ...prev]);
      setTrackedQuestId(newQuest.id);
      engineRef.current?.ingestEmergentLore(
        newQuest.id,
        `${newQuest.title} [${newQuest.motif}]: ${newQuest.summary}`,
      );
      showToast(`New Frontier Rumor: ${newQuest.title}`);
    } catch (err) {
      setRumorError(
        err instanceof Error ? err.message : 'Unable to consult frontier waystones right now.',
      );
    } finally {
      setSeekingRumor(false);
    }
  }, [guilds, pledgedGuildId, quests, showToast]);

  const activeRealm = useMemo(
    () => realms.find((r) => r.slug === activeRealmSlug) ?? realms[0] ?? CANONICAL_REALM_SPECS[0],
    [realms, activeRealmSlug],
  );
  activeRealmRef.current = activeRealm;

  const showFrontierDiscoveryBanner = useCallback((realm: FrontiersRealmSpec) => {
    setFrontierBanner({
      name: realm.name,
      subtitle: realm.subtitle,
      cell: realm.cell,
    });
    if (frontierBannerTimerRef.current !== null) {
      window.clearTimeout(frontierBannerTimerRef.current);
    }
    frontierBannerTimerRef.current = window.setTimeout(() => {
      setFrontierBanner(null);
    }, 3600);
  }, []);

  const handleTravelToRealm = useCallback(
    async (realm: FrontiersRealmSpec, spawnOverride?: { x: number; z: number; yaw?: number }) => {
      if (!engineRef.current) return;
      setTravelingRealm(true);
      setRealmGenError(null);
      try {
        const isVaelmor = realm.slug === 'vaelmor';
        const nextNpcs = isVaelmor ? INITIAL_NPCS : realm.npcs;
        const nextEnemies = isVaelmor
          ? createInitialEnemies()
          : realm.enemies.map((e) => ({ ...e }));
        const nextInteractables = isVaelmor
          ? INITIAL_INTERACTABLES.map((i) => ({ ...i }))
          : realm.interactables.map((i) => ({ ...i }));

        await engineRef.current.loadRealm(
          realm,
          nextNpcs,
          nextEnemies,
          nextInteractables,
          spawnOverride,
        );

        setActiveRealmSlug(realm.slug);
        if (realm.isDungeon) {
          setHasVisitedDungeon(true);
        }
        setActiveNpcs(nextNpcs);
        setActiveNpcId(null);
        setWorldPings([]);

        const arrivedX = spawnOverride?.x ?? realm.spawnPoint[0];
        const arrivedZ = spawnOverride?.z ?? realm.spawnPoint[1];
        const arrivedYaw = spawnOverride?.yaw ?? Math.PI;
        realmRef.current?.sendRealmChange(realm.slug, realm.name, arrivedX, arrivedZ, arrivedYaw);

        if (realm.quests.length > 0) {
          setQuests((prev) => {
            const existingIds = new Set(prev.map((q) => q.id));
            const additions = realm.quests
              .filter((q) => !existingIds.has(q.id))
              .map((q) => ({ ...q, objectives: q.objectives.map((o) => ({ ...o })) }));
            return additions.length > 0 ? [...additions, ...prev] : prev;
          });
          setTrackedQuestId(realm.quests[0].id);
        }

        const nextSuite = getPlaylistForRealm(
          realm.theme,
          Boolean(realm.isDungeon),
          realm.soundtrack,
        );
        audioRef.current?.setRealmPlaylist(nextSuite);
        audioRef.current?.setRegionMood(realm.ambientMood);
        audioRef.current?.playPortalTravel(Boolean(realm.isDungeon));
        if (audioRef.current) {
          setAudioState(audioRef.current.getAudioState());
          setRealmPlaylist(audioRef.current.getPlaylist());
        }
        setAtlasTab(null);
        showFrontierDiscoveryBanner(realm);
        showToast(
          realm.isDungeon
            ? `Descended into ${realm.name} — Tier ${realm.dungeonTier ?? 1} 3D Delve`
            : `Arrived at ${realm.name} — Cell (${realm.cell.join(', ')})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to open Meridian portal.';
        setRealmGenError(msg);
        setDungeonGenError(msg);
        showToast(msg);
      } finally {
        setTravelingRealm(false);
      }
    },
    [showFrontierDiscoveryBanner, showToast],
  );
  handleTravelToRealmRef.current = handleTravelToRealm;

  const handleTravelToCell = useCallback(
    async (cx: number, cz: number, spawnOverride?: { x: number; z: number; yaw?: number }) => {
      const existing = realmsRef.current.find(
        (r) => !r.isDungeon && r.cell[0] === cx && r.cell[2] === cz,
      );
      const target = existing ?? synthesizeUniverseCell(cx, cz);
      if (!existing) {
        setRealms((prev) => (prev.some((r) => r.slug === target.slug) ? prev : [...prev, target]));
      }
      await handleTravelToRealm(target, spawnOverride);
    },
    [handleTravelToRealm],
  );
  handleTravelToCellRef.current = handleTravelToCell;

  const handleGenerateRealm = useCallback(
    async (name: string, theme: RealmThemeId, brief: string) => {
      setGeneratingRealm(true);
      setRealmGenError(null);
      try {
        const res = await fetch('/api/verdant/realms/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, theme, brief }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.realm) {
          throw new Error(json.error || 'Failed to synthesize and compile Frontier Realm.');
        }
        const compiled = json.realm as FrontiersRealmSpec;
        setRealms((prev) => {
          const filtered = prev.filter((r) => r.slug !== compiled.slug);
          return [...filtered, compiled];
        });
        showToast(`Compiled ${compiled.name} — opening Meridian portal!`);
        await handleTravelToRealm(compiled);
      } catch (err) {
        setRealmGenError(
          err instanceof Error ? err.message : 'Unable to compile Frontier Realm right now.',
        );
      } finally {
        setGeneratingRealm(false);
      }
    },
    [handleTravelToRealm, showToast],
  );

  const handleGenerateDungeon = useCallback(
    async (name: string, style: DungeonArchitecturalStyle, tier: number, brief: string) => {
      setGeneratingDungeon(true);
      setDungeonGenError(null);
      try {
        const parentSlug = activeRealm.isDungeon
          ? activeRealm.parentRealmSlug || 'vaelmor'
          : activeRealm.slug;
        const res = await fetch('/api/verdant/dungeons/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, style, tier, parentRealmSlug: parentSlug, brief }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.dungeon) {
          throw new Error(json.error || 'Failed to synthesize and compile 3D Dungeon Delve.');
        }
        const compiled = json.dungeon as FrontiersRealmSpec;
        setRealms((prev) => {
          const filtered = prev.filter((r) => r.slug !== compiled.slug);
          return [...filtered, compiled];
        });
        showToast(`Compiled ${compiled.name} — descending into delve!`);
        await handleTravelToRealm(compiled);
      } catch (err) {
        setDungeonGenError(
          err instanceof Error ? err.message : 'Unable to compile 3D Dungeon Delve right now.',
        );
      } finally {
        setGeneratingDungeon(false);
      }
    },
    [activeRealm, handleTravelToRealm, showToast],
  );

  const handleComposeScore = useCallback(async () => {
    setComposingScore(true);
    try {
      let nextScore: RealmSoundtrackSpec | null = null;
      if (!isStaticPagesHost()) {
        try {
          const res = await fetch('/api/verdant/scores/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              realmSlug: activeRealm.slug,
              realmName: activeRealm.name,
              theme: activeRealm.theme,
              isDungeon: Boolean(activeRealm.isDungeon),
              brief: `${activeRealm.name} ${activeRealm.summary} variation ${Date.now() % 97}`,
            }),
          });
          const json = await res.json();
          if (res.ok && json.ok && json.soundtrack) {
            nextScore = json.soundtrack as RealmSoundtrackSpec;
          }
        } catch {
          nextScore = null;
        }
      }
      if (!nextScore) {
        nextScore = synthesizeScoreFromBrief({
          realmSlug: activeRealm.slug,
          realmName: activeRealm.name,
          theme: activeRealm.theme,
          isDungeon: Boolean(activeRealm.isDungeon),
          seed: (Date.now() % 100000) + Math.floor(Math.random() * 997),
        });
      }
      setRealms((prev) =>
        prev.map((r) => (r.slug === activeRealm.slug ? { ...r, soundtrack: nextScore! } : r)),
      );
      audioRef.current?.setSoundtrack(nextScore);
      if (audioRef.current) setAudioState(audioRef.current.getAudioState());
      showToast(`Composed "${nextScore.title}" (${nextScore.meter} · ${nextScore.mode}, ${nextScore.bpm} BPM)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to compose orchestral score.');
    } finally {
      setComposingScore(false);
    }
  }, [activeRealm, showToast]);

  const handleFastTravel = useCallback(
    (_regionId: RegionId, x: number, z: number, label: string) => {
      engineRef.current?.teleportPlayer(x, z);
      setAtlasTab(null);
      showToast(`Arrived at ${label}.`);
    },
    [showToast],
  );

  // Keep live Model-of-Models synced whenever realms, NPCs, quests, guilds, relics, or multiplayer session change
  useEffect(() => {
    if (!engineRef.current) return;
    const currentRealm = realms.find((r) => r.slug === activeRealmSlug) ?? realms[0];
    const sameRealmCount = remotePlayers.filter(
      (p) => !p.realmSlug || p.realmSlug === activeRealmSlug,
    ).length;
    const snap = engineRef.current.syncWorldModelState({
      realms,
      npcs: activeNpcs,
      quests,
      guilds,
      relics,
      multiplayer: {
        roomCode,
        activeRealmSlug,
        activeRealmName: currentRealm?.name ?? 'The Shattered Meridian of Vaelmor',
        onlinePlayers: remotePlayers.length + 1,
        sameRealmAllies: sameRealmCount,
        activePings: worldPings.length,
        activeSummonRealm: activeSummon?.realmSlug ?? null,
      },
    });
    setModelObserverSnapshot(snap);
  }, [
    realms,
    activeRealmSlug,
    activeNpcs,
    quests,
    guilds,
    relics,
    roomCode,
    remotePlayers,
    worldPings,
    activeSummon,
  ]);

  const handleRefineWorldModel = useCallback(
    async (
      targetTier: VerdantResolutionTier = 4,
      partSlot?: VerdantPartSlot,
      modelId?: string,
    ) => {
      if (!engineRef.current) return;
      setRefiningWorldModel(true);
      try {
        const report = await engineRef.current.refineWorldModel({
          targetTier,
          partSlot,
          modelId,
          enforceDiversity: true,
          reason: modelId
            ? `Codex refinement of model ${modelId} to Tier ${targetTier}`
            : partSlot
              ? `Codex refinement of ${partSlot} to Tier ${targetTier}`
              : `Uniform World Charter refinement to Tier ${targetTier}`,
        });
        setModelObserverSnapshot(engineRef.current.getModelObserverSnapshot());
        audioRef.current?.playResonanceBell(modelId ? 349.23 : partSlot ? 329.63 : 392.0);
        showToast(
          modelId
            ? `Refined ${modelId} -> Tier ${report.after.resolutionTier} (Def ${report.after.definitionScore}/100 · Diversity ${report.after.diversityIndex}/100)`
            : partSlot
              ? `Refined ${partSlot} -> Tier ${report.after.resolutionTier} (Def ${report.after.definitionScore}/100 · Diversity ${report.after.diversityIndex}/100)`
              : `World refined to Tier ${report.after.resolutionTier} Sovereign Ultra-Def (${report.modelsRefined} models · Diversity ${report.after.diversityIndex}/100)`,
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Unable to execute Verdant refinement pass.',
        );
      } finally {
        setRefiningWorldModel(false);
      }
    },
    [showToast],
  );

  const handleRunRatchetCycle = useCallback(async () => {
    if (!engineRef.current) return;
    setRefiningWorldModel(true);
    try {
      const cycle = await engineRef.current.runRatchetCycle({
        enforceDiversity: true,
        reason: 'Codex Charter M16 Observer Ratchet Cycle',
      });
      setModelObserverSnapshot(engineRef.current.getModelObserverSnapshot());
      if (!isStaticPagesHost()) {
        void fetch('/api/verdant/observer/ratchet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetTier: cycle.refinementReport.after.resolutionTier,
            reason: 'Codex Charter M16 Observer Ratchet Cycle',
          }),
        }).catch(() => {});
      }
      audioRef.current?.playResonanceBell(440.0);
      showToast(
        `Observer Ratchet Cycle #${cycle.cycleNumber} complete · Cohesion ${cycle.agendaAfter.cohesionIndex}/100 · Diversity ${cycle.agendaAfter.diversityIndex}/100`,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to execute Observer ratchet cycle.',
      );
    } finally {
      setRefiningWorldModel(false);
    }
  }, [showToast]);

  const handleRunAutomate = useCallback(async () => {
    if (!engineRef.current) return;
    setRefiningWorldModel(true);
    try {
      const report = await engineRef.current.runAutomatePipeline({
        enforceDiversity: true,
        reason: 'Codex Charter M17 Verdant Automate Pipeline',
      });
      setModelObserverSnapshot(engineRef.current.getModelObserverSnapshot());
      if (!isStaticPagesHost()) {
        void fetch('/api/verdant/observer/automate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetTier: report.ratchetCycle.refinementReport.after.resolutionTier,
            reason: 'Codex Charter M17 Verdant Automate Pipeline',
          }),
        }).catch(() => {});
      }
      audioRef.current?.playResonanceBell(523.25);
      showToast(
        `Verdant Automate #${report.ratchetCycle.cycleNumber}: ${report.passedStages}/${report.totalStages} stages · Gate ${report.lifecycleGate.passedChecks}/${report.lifecycleGate.totalChecks} · Score ${report.ratchetCycle.agendaAfter.overallRefinementScorePermille}‰`,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to execute Verdant Automate pipeline.',
      );
    } finally {
      setRefiningWorldModel(false);
    }
  }, [showToast]);

  const observerAgenda: ObserverRefinementAgenda | null = useMemo(() => {
    if (!modelObserverSnapshot || !engineRef.current) return null;
    return engineRef.current.getRefinementAgenda();
  }, [modelObserverSnapshot]);

  const observerManagers: VerdantVsmManagerSpec[] = useMemo(() => {
    if (!modelObserverSnapshot || !engineRef.current) return [];
    return engineRef.current.listManagers();
  }, [modelObserverSnapshot]);

  const handleUpdateCallsign = useCallback(
    (nextName: string) => {
      const clean = normalizeCallsign(nextName, playerCallsignRef.current);
      setPlayerCallsign(clean);
      try {
        window.localStorage.setItem('frontiers-waywright-callsign', clean);
      } catch {
        // ignore storage errors
      }
      realmRef.current?.updateProfile(clean, pledgedGuildRef.current);
      showToast(`Waywright callsign updated to ${clean}.`);
    },
    [showToast],
  );

  const handleSwitchRoom = useCallback(
    (nextCode: string) => {
      const normalized = normalizeRoomCode(nextCode);
      setRoomCode(normalized);
      setRemotePlayers([]);
      setWorldPings([]);
      setActiveSummon(null);
      realmRef.current?.switchRoom(normalized);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('room', normalized);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore URL history errors
      }
      showToast(`Joined Expedition Room ${normalized}.`);
    },
    [showToast],
  );

  const handleDropPing = useCallback(
    (kind: WorldPingKind = 'rally', label?: string) => {
      const snap = engineRef.current?.getDebugSnapshot();
      const px = snap ? snap.playerX : hud.playerX;
      const pz = snap ? snap.playerZ : hud.playerZ;
      realmRef.current?.sendWorldPing(px, pz, kind, label, activeRealmRef.current.slug);
      audioRef.current?.playResonanceBell(kind === 'danger' ? 196 : 330);
      showToast(`${label || 'Rally Beacon'} marked for your fellowship!`);
    },
    [hud.playerX, hud.playerZ, showToast],
  );

  const handleSummonParty = useCallback(() => {
    const realm = activeRealmRef.current;
    const snap = engineRef.current?.getDebugSnapshot();
    const px = snap ? snap.playerX : hud.playerX;
    const pz = snap ? snap.playerZ : hud.playerZ;
    realmRef.current?.sendPartySummon({
      realmSlug: realm.slug,
      realmName: realm.name,
      isDungeon: Boolean(realm.isDungeon),
      x: px,
      z: pz,
      cell: realm.cell,
    });
    audioRef.current?.playResonanceBell(392);
    showToast(`Summoned fellowship to ${realm.name}!`);
  }, [hud.playerX, hud.playerZ, showToast]);

  const handleWarpToAlly = useCallback(
    async (ally: RemotePlayerState) => {
      const targetSlug = ally.realmSlug || 'vaelmor';
      const offsetX = ally.x + 2.2;
      const offsetZ = ally.z + 2.2;
      if (targetSlug === activeRealmRef.current.slug) {
        engineRef.current?.teleportPlayer(offsetX, offsetZ);
        setAtlasTab(null);
        showToast(`Rendezvoused with ${ally.name}!`);
        return;
      }
      const targetRealm = realmsRef.current.find((r) => r.slug === targetSlug);
      if (targetRealm) {
        await handleTravelToRealm(targetRealm, { x: offsetX, z: offsetZ });
      } else {
        showToast(`${ally.name} is exploring an uncharted realm (${ally.realmName || targetSlug}).`);
      }
    },
    [handleTravelToRealm, showToast],
  );

  const handleAcceptSummon = useCallback(
    async (summon: PartySummon) => {
      setActiveSummon(null);
      const offsetX = summon.x + 2.0;
      const offsetZ = summon.z + 2.0;
      if (summon.realmSlug === activeRealmRef.current.slug) {
        engineRef.current?.teleportPlayer(offsetX, offsetZ);
        showToast(`Joined ${summon.senderName} in ${summon.realmName}!`);
        return;
      }
      const existing = realmsRef.current.find((r) => r.slug === summon.realmSlug);
      if (existing) {
        await handleTravelToRealm(existing, { x: offsetX, z: offsetZ });
      } else if (summon.cell && !summon.isDungeon) {
        await handleTravelToCell(summon.cell[0], summon.cell[2], { x: offsetX, z: offsetZ });
      } else {
        showToast(`Could not locate realm ${summon.realmName} in current atlas.`);
      }
    },
    [handleTravelToCell, handleTravelToRealm, showToast],
  );

  const activeNpc = useMemo(
    () => activeNpcs.find((n) => n.id === activeNpcId) ?? INITIAL_NPCS.find((n) => n.id === activeNpcId) ?? null,
    [activeNpcs, activeNpcId],
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d1014]">
      {/* Dedicated WebGL Mount Container — Never Re-Parented */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen & 3-Slot Expedition Ledger over Live 3D Vaelmor Flyover */}
      {phase === 'title' && characterModal === null && (
        <TitleOverlay
          saveStore={saveStore}
          defaultCallsign={playerCallsign}
          invitedRoomCode={initialRoom.invited ? roomCode : null}
          onlineCount={1 + remotePlayers.length}
          onOpenCharacterCreator={(slotId) => setCharacterModal({ mode: 'create', slotId })}
          onStartNewInSlot={handleStartNewInSlot}
          onContinueSlot={handleContinueSlot}
          onRenameSlot={handleRenameSlot}
          onDeleteSlot={handleDeleteSlot}
          onWatchPrologue={() => handleWatchPrologue('title')}
          onOpenFieldManual={() => setFieldManualOpen(true)}
        />
      )}

      {/* 5-Scene Multi-Media Animated Prologue with Live VFX, Sound-Design Captions & Live 3D Reveal */}
      {phase === 'intro' && (
        <PrologueCinematicOverlay
          waywrightName={playerCallsign}
          isReplay={prologueIsReplay}
          muted={muted}
          initialOathId={waywrightOath}
          onToggleMute={handleToggleMute}
          onActChange={handlePrologueActChange}
          onSeismicBeat={handlePrologueSeismicBeat}
          onSelectOath={handleSelectWaywrightOath}
          onComplete={handleCompletePrologue}
          onSkip={handleCompletePrologue}
        />
      )}

      {/* Active Playing HUD */}
      {phase === 'playing' && activeNpc === null && atlasTab === null && characterModal === null && (
        <GameHud
          hud={hud}
          activeRealm={activeRealm}
          renown={renown}
          trackedQuest={trackedQuest}
          gearTiers={gearTiers}
          onlineCount={1 + remotePlayers.length}
          roomCode={roomCode}
          realmConnected={realmConnected}
          remotePlayers={remotePlayers}
          worldPings={worldPings}
          activeSummon={activeSummon}
          chatMessages={chatMessages}
          chatOpen={chatOpen}
          callouts={callouts}
          muted={muted}
          activeTrackTitle={audioState?.scoreTitle ?? activeRealm.soundtrack.title}
          toastMessage={toastMessage}
          frontierBanner={frontierBanner}
          journeySummary={journeySummary}
          playerCharacterSummary={{
            name: playerProfile.name,
            speciesName: getSpeciesSpec(playerProfile.speciesId).name,
            className: getClassSpec(playerProfile.classId).name,
            level: characterProgression.level,
            evolutionTitle: characterProgression.evolutionTitle,
            unspentPoints: characterProgression.unspentAttributePoints,
          }}
          guideDismissed={guideDismissed}
          onDismissGuide={() => setGuideDismissed(true)}
          onReplayPrologue={() => handleWatchPrologue('playing')}
          onOpenCharacter={() => {
            setAtlasTab(null);
            setCharacterModal({ mode: 'customize', slotId: activeSlotId });
          }}
          onActivateGear={handleActivateGear}
          onTriggerAction={handleTriggerAction}
          onTriggerDodge={handleTriggerDodge}
          onNextTrack={handleNextTrack}
          onOpenJournal={() => setAtlasTab('chronicle')}
          onOpenMap={() => setAtlasTab('map')}
          onOpenDungeons={() => setAtlasTab('dungeons')}
          onOpenForge={() => setAtlasTab('forge')}
          onOpenParty={() => setAtlasTab('guilds')}
          onDropPing={handleDropPing}
          onWarpToAlly={(ally) => void handleWarpToAlly(ally)}
          onAcceptSummon={(summon) => void handleAcceptSummon(summon)}
          onDismissSummon={() => setActiveSummon(null)}
          onToggleChat={() => setChatOpen((o) => !o)}
          onSendChat={(text) => realmRef.current?.sendChat(text)}
          onToggleMute={handleToggleMute}
          onPause={() => setPhase('paused')}
          onTriggerInteract={() => {
            void audioRef.current?.ensureStarted();
            engineRef.current?.triggerInteract();
          }}
        />
      )}

      {/* Intelligent NPC Dialogue Overlay */}
      {phase === 'playing' && activeNpc && (
        <DialogueOverlay
          npc={activeNpc}
          realmName={activeRealm.name}
          usedMotifs={quests.map((q) => q.motif)}
          playerProfile={playerProfile}
          characterProgression={characterProgression}
          onSelectChoice={handleSelectDialogueChoice}
          onClose={() => setActiveNpcId(null)}
        />
      )}

      {/* Diegetic Field Atlas (Chronicle, World Map, Gear & Forge, Party & Guilds, Lore Codex) */}
      {phase === 'playing' && atlasTab && (
        <JournalMapModal
          initialTab={atlasTab}
          quests={quests}
          trackedQuestId={trackedQuestId}
          npcs={activeNpcs}
          guilds={guilds}
          pledgedGuildId={pledgedGuildId}
          playerCallsign={playerCallsign}
          playerProfile={playerProfile}
          characterProgression={characterProgression}
          roomCode={roomCode}
          realmConnected={realmConnected}
          banners={banners}
          remotePlayers={remotePlayers}
          worldPings={worldPings}
          materials={materials}
          gearTiers={gearTiers}
          relics={relics}
          discoveredRegions={discoveredRegions}
          playerX={hud.playerX}
          playerZ={hud.playerZ}
          playerYaw={hud.playerYaw}
          playerHp={hud.hp}
          playerMaxHp={hud.maxHp}
          renown={renown}
          seekingRumor={seekingRumor}
          rumorError={rumorError}
          forgingRelic={forgingRelic}
          forgeError={forgeError}
          realms={realms}
          activeRealm={activeRealm}
          travelingRealm={travelingRealm}
          generatingRealm={generatingRealm}
          realmGenError={realmGenError}
          generatingDungeon={generatingDungeon}
          dungeonGenError={dungeonGenError}
          composingScore={composingScore}
          audioState={audioState}
          realmPlaylist={realmPlaylist}
          onSelectTrackedQuest={(id) => setTrackedQuestId(id)}
          onSeekEmergentQuest={() => void handleSeekEmergentQuest()}
          onFastTravel={handleFastTravel}
          onTravelToRealm={(realm) => void handleTravelToRealm(realm)}
          onTravelToCell={(cx, cz) => void handleTravelToCell(cx, cz)}
          onGenerateRealm={(name, theme, brief) => void handleGenerateRealm(name, theme, brief)}
          onGenerateDungeon={(name, style, tier, brief) =>
            void handleGenerateDungeon(name, style, tier, brief)
          }
          onComposeScore={() => void handleComposeScore()}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          onSelectTrack={handleSelectTrack}
          onPledgeGuild={(id) => {
            setPledgedGuildId(id);
            realmRef.current?.updateProfile(playerCallsignRef.current, id);
            const g = guilds.find((x) => x.id === id);
            if (g) showToast(`Pledged allegiance to ${g.name}.`);
          }}
          onUpdateCallsign={handleUpdateCallsign}
          onSwitchRoom={handleSwitchRoom}
          onWarpToAlly={(ally) => void handleWarpToAlly(ally)}
          onSummonParty={handleSummonParty}
          onDropPing={handleDropPing}
          onUpgradeGear={handleUpgradeGear}
          onToggleRelic={handleToggleRelic}
          onForgeEmergentRelic={() => void handleForgeEmergentRelic()}
          modelObserverSnapshot={modelObserverSnapshot}
          observerAgenda={observerAgenda}
          observerManagers={observerManagers}
          refiningWorldModel={refiningWorldModel}
          onRefineWorldModel={(tier, slot, modelId) =>
            void handleRefineWorldModel(tier, slot, modelId)
          }
          onRunRatchetCycle={() => void handleRunRatchetCycle()}
          onRunAutomate={() => void handleRunAutomate()}
          onInspectPartModels={(slot) => engineRef.current?.listModelsByPart(slot) ?? []}
          onInspectModelLineage={(id) => engineRef.current?.getModelLineage(id) ?? null}
          journeySummary={journeySummary}
          onReplayPrologue={() => handleWatchPrologue('playing')}
          onClose={() => setAtlasTab(null)}
        />
      )}

      {/* Waywright Character Creation & Live Ongoing Customization Atelier */}
      {characterModal && (
        <CharacterCreatorModal
          mode={characterModal.mode}
          initialProfile={
            characterModal.mode === 'create'
              ? createDefaultPlayerProfile(playerCallsign)
              : playerProfile
          }
          slotLabel={SLOT_LABELS[characterModal.slotId]}
          renown={characterModal.mode === 'create' ? 0 : renown}
          completedQuestsCount={characterModal.mode === 'create' ? 0 : completedQuestsCount}
          defeatedCount={characterModal.mode === 'create' ? 0 : hud.defeatedCount}
          gearTiers={characterModal.mode === 'create' ? DEFAULT_TIERS : gearTiers}
          relics={characterModal.mode === 'create' ? INITIAL_RELICS : relics}
          onCancel={() => setCharacterModal(null)}
          onConfirm={(confirmedProfile) => {
            if (characterModal.mode === 'create') {
              handleStartNewInSlot(
                characterModal.slotId,
                confirmedProfile.name,
                pledgedGuildId,
                confirmedProfile,
              );
            } else {
              const cleanName = normalizeCallsign(confirmedProfile.name, playerCallsign);
              const normalized = normalizePlayerProfile({
                ...confirmedProfile,
                name: cleanName,
              });
              setPlayerCallsign(cleanName);
              setPlayerProfile(normalized);
              setCharacterModal(null);
              realmRef.current?.updateProfile(cleanName, pledgedGuildRef.current);
              audioRef.current?.playResonanceBell(330);
              showToast(
                `Updated ${cleanName} (${getSpeciesSpec(normalized.speciesId).name} · ${getClassSpec(normalized.classId).name})`,
              );
            }
          }}
        />
      )}

      {/* Paused / Victory / Game Over Modal */}
      {(phase === 'paused' || phase === 'victory' || phase === 'gameover') && !fieldManualOpen && (
        <StatusModal
          phase={phase}
          regionName={hud.region.name}
          waywrightName={playerCallsign}
          slotLabel={SLOT_LABELS[activeSlotId]}
          completedQuests={completedQuestsCount}
          totalQuests={quests.length}
          defeatedCount={hud.defeatedCount}
          renown={renown}
          bannersCount={banners.length}
          onResume={() => setPhase('playing')}
          onRespawnAtCitadel={handleRespawnAtCitadel}
          onReplayPrologue={() => handleWatchPrologue('playing')}
          onOpenFieldManual={() => setFieldManualOpen(true)}
          onRestart={handleRestartActiveSlot}
          onReturnToTitle={() => {
            setActiveNpcId(null);
            setAtlasTab(null);
            setCharacterModal(null);
            setChatOpen(false);
            setPhase('title');
          }}
        />
      )}

      {/* Out-of-World Waywright Field Manual (Cleanly Separated from the Dramatic Prologue) */}
      {fieldManualOpen && (
        <FieldManualModal
          onClose={() => setFieldManualOpen(false)}
          onWatchPrologue={() => handleWatchPrologue(phase === 'title' ? 'title' : 'playing')}
        />
      )}
    </div>
  );
}
