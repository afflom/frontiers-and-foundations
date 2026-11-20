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
import {
  ALL_CANONICAL_WORLDS,
  CANONICAL_REALM_SPECS,
  type DungeonArchitecturalStyle,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './verdant/realmModelSchema';
import { VerdantSpatialAudio, type VerdantAudioState } from './verdant/verdantAudioEngine';
import {
  getPlaylistForRealm,
  synthesizeScoreFromBrief,
  type RealmSoundtrackSpec,
} from './verdant/verdantScoreSchema';
import { isStaticPagesHost } from './utils/publicUrl';
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
  type RelicBonusKind,
  type RemotePlayerState,
  type WorldChatMessage,
} from './game/multiplayerTypes';
import { VaelmorRealmClient } from './game/multiplayerClient';
import { TitleOverlay } from './components/game/TitleOverlay';
import { GameHud, type CombatCallout } from './components/game/GameHud';
import { DialogueOverlay } from './components/game/DialogueOverlay';
import { JournalMapModal, type AtlasTab } from './components/game/JournalMapModal';
import { StatusModal } from './components/game/StatusModal';

const STORAGE_KEY = 'frontiers-foundations-save-v3';

interface SavedJourney {
  quests: GameQuest[];
  renown: number;
  pledgedGuildId: string;
  banners: FoundationBanner[];
  materials: CraftingMaterials;
  gearTiers: GearUpgradeTiers;
  relics: EquippedRelic[];
  discoveredRegions: RegionId[];
}

const DEFAULT_MATERIALS: CraftingMaterials = {
  silicateMoss: 2,
  lodestoneShards: 2,
  foundrySlag: 1,
};

const DEFAULT_TIERS: GearUpgradeTiers = {
  hookblade: 1,
  bellhammer: 1,
  lantern: 1,
  compass: 1,
};

function loadSavedJourney(): SavedJourney | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedJourney>;
    if (!Array.isArray(parsed.quests) || parsed.quests.length === 0) return null;
    return {
      quests: parsed.quests,
      renown: typeof parsed.renown === 'number' ? parsed.renown : 0,
      pledgedGuildId:
        typeof parsed.pledgedGuildId === 'string' ? parsed.pledgedGuildId : INITIAL_GUILDS[0].id,
      banners: Array.isArray(parsed.banners) ? parsed.banners : [],
      materials: parsed.materials ?? DEFAULT_MATERIALS,
      gearTiers: parsed.gearTiers ?? DEFAULT_TIERS,
      relics: Array.isArray(parsed.relics) && parsed.relics.length > 0 ? parsed.relics : INITIAL_RELICS,
      discoveredRegions:
        Array.isArray(parsed.discoveredRegions) && parsed.discoveredRegions.length > 0
          ? parsed.discoveredRegions
          : ['southern-terrace'],
    };
  } catch {
    return null;
  }
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
  const savedOnBoot = useMemo(() => loadSavedJourney(), []);
  const autostart = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('autostart') === '1';
    } catch {
      return false;
    }
  }, []);

  const playerCallsign = useMemo(() => {
    const names = ['Alden', 'Bryn', 'Corin', 'Dara', 'Elowen', 'Fenn', 'Maren', 'Torin'];
    const suffix = Math.floor(10 + Math.random() * 89);
    return `${names[Math.floor(Math.random() * names.length)]}-${suffix}`;
  }, []);

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
  const [relics, setRelics] = useState<EquippedRelic[]>(
    () => savedOnBoot?.relics ?? INITIAL_RELICS.map((r) => ({ ...r })),
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
  const victoryShownRef = useRef(victoryShown);
  victoryShownRef.current = victoryShown;
  const realmsRef = useRef(realms);
  realmsRef.current = realms;
  const handleTravelToRealmRef = useRef<((realm: FrontiersRealmSpec) => Promise<void>) | null>(null);
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

  // Persist journey locally
  useEffect(() => {
    try {
      const payload: SavedJourney = {
        quests,
        renown,
        pledgedGuildId,
        banners,
        materials,
        gearTiers,
        relics,
        discoveredRegions,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota
    }
  }, [quests, renown, pledgedGuildId, banners, materials, gearTiers, relics, discoveredRegions]);

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

  // Pause 3D engine simulation while Dialogue or Field Atlas is open
  const effectiveEnginePhase: GamePhase =
    phase === 'playing' && (activeNpcId !== null || atlasTab !== null) ? 'paused' : phase;

  useEffect(() => {
    engineRef.current?.setPhase(effectiveEnginePhase);
  }, [effectiveEnginePhase]);

  // Sync computed combat stats (weapon tiers + equipped relics) into 3D engine
  const combatStats = useMemo(() => computeCombatStats(gearTiers, relics), [gearTiers, relics]);
  useEffect(() => {
    engineRef.current?.setPlayerCombatStats(combatStats);
  }, [combatStats]);

  // Sync remote multiplayer avatars into 3D scene
  useEffect(() => {
    engineRef.current?.syncRemotePlayers(remotePlayers);
  }, [remotePlayers]);

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

  const completedQuestsCount = useMemo(
    () => quests.filter((q) => q.status === 'completed').length,
    [quests],
  );
  useEffect(() => {
    engineRef.current?.setCompletedQuestsCount(completedQuestsCount);
  }, [completedQuestsCount]);

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
          );
        },
        onPlayerAction: (gear) => {
          realmRef.current?.sendAction(gear);
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
            const target = item.targetRealmSlug
              ? realmsRef.current.find((r) => r.slug === item.targetRealmSlug)
              : null;
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
            audio.playQuestComplete();
            pushCombatCallout('+60 RENOWN · VAULT UNSEALED', 'gold');
            showToast(`Unsealed ${item.name} (+2 Moss, +3 Lodestone, +2 Slag, +60 Renown).`);
          } else if (item.kind === 'resonance-pier' || item.kind === 'forge-bell') {
            applyQuestProgress('ring-bell', item.id);
            setMaterials((m) => ({ ...m, foundrySlag: m.foundrySlag + 1 }));
            showToast(`${item.name} resonates across the frontier (+1 Foundry Slag).`);
          } else if (item.kind === 'waystone-beacon') {
            applyQuestProgress('calibrate-beacon', item.id);
            setMaterials((m) => ({ ...m, lodestoneShards: m.lodestoneShards + 2 }));
            showToast(`${item.name} attuned to the Meridian network (+2 Lodestone).`);
          } else if (item.kind === 'silicate-relic') {
            applyQuestProgress('collect-relics', 'silicate-relic');
            setMaterials((m) => ({ ...m, silicateMoss: m.silicateMoss + 1 }));
            showToast(`Harvested ${item.name} (+1 Silicate Moss).`);
          }
        },
        onEnemyDefeated: (archetype: EnemyArchetype, name: string) => {
          applyQuestProgress('defeat-archetype', archetype);
          setRenown((r) => r + 25);
          setMaterials((m) => ({
            silicateMoss: m.silicateMoss,
            lodestoneShards: m.lodestoneShards + 1,
            foundrySlag: m.foundrySlag + (archetype === 'colossus' ? 2 : 1),
          }));
          showToast(`Vanquished ${name} (+25 Renown, +1 Lodestone)`);
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
            builderName: playerCallsign,
            position: [x, z],
            plantedAt: Date.now(),
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
        onSpatialAudio: (metrics) => {
          audio.updateSpatialMetrics(metrics);
        },
        onCombatIntensity: (intensity) => {
          audio.setCombatIntensity(intensity);
        },
        onFootstep: (surface) => {
          audio.playFootstep(surface);
        },
      },
    );

    engineRef.current = engine;
    (window as unknown as { __VERDANT_DEBUG__?: () => unknown }).__VERDANT_DEBUG__ = () =>
      engine.getDebugSnapshot();
    (window as unknown as { __VERDANT_ENGINE__?: VerdantFrontiersRuntime }).__VERDANT_ENGINE__ =
      engine;
    engine.setPlayerCombatStats(computeCombatStats(gearTiers, relics));
    if (autostart) {
      engine.setPhase('playing');
    }

    // Connect real WebSocket multiplayer client (/ws/realm)
    const realm = new VaelmorRealmClient(
      { name: playerCallsign, guildId: pledgedGuildRef.current },
      {
        onConnected: (ok) => setRealmConnected(ok),
        onInit: (payload) => {
          selfIdRef.current = payload.selfId;
          setRemotePlayers(payload.players);
          setChatMessages(payload.chatHistory);
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
        },
        onPlayerUpsert: (player) => {
          setRemotePlayers((prev) => upsertRemotePlayer(prev, player, selfIdRef.current));
        },
        onPlayerLeave: (playerId) => {
          setRemotePlayers((prev) => removeRemotePlayer(prev, playerId));
        },
        onBannerPlanted: (banner) => {
          if (!addedBannerIdsRef.current.has(banner.id)) {
            addedBannerIdsRef.current.add(banner.id);
            engine.addBannerMesh(banner);
          }
          setBanners((prev) => mergeRemoteBanner(prev, banner));
          showToast(`${banner.builderName} raised ${banner.name} across Vaelmor!`);
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

  const handleStartNew = useCallback(() => {
    audioRef.current?.ensureStarted();
    const freshQuests = INITIAL_QUESTS.map((q) => ({
      ...q,
      objectives: q.objectives.map((o) => ({ ...o, currentCount: 0 })),
      status: 'active' as const,
    }));
    setQuests(freshQuests);
    setTrackedQuestId(freshQuests[0].id);
    setRenown(0);
    setMaterials(DEFAULT_MATERIALS);
    setGearTiers(DEFAULT_TIERS);
    setRelics(INITIAL_RELICS.map((r) => ({ ...r })));
    setVictoryShown(false);
    setActiveNpcId(null);
    setAtlasTab(null);
    setChatOpen(false);
    engineRef.current?.resetRun(createInitialEnemies(), INITIAL_INTERACTABLES);
    setPhase('playing');
    showToast('Speak with Magistrate Orenna Vael ahead on the Southern Causeway.');
  }, [showToast]);

  const handleContinue = useCallback(() => {
    audioRef.current?.ensureStarted();
    setActiveNpcId(null);
    setAtlasTab(null);
    setPhase('playing');
  }, []);

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

      if (phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (savedOnBoot) {
            handleContinue();
          } else {
            handleStartNew();
          }
        }
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
        if (e.code === 'KeyP') {
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
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          setAtlasTab((cur) => (cur === 'guilds' ? null : 'guilds'));
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
  }, [phase, activeNpcId, atlasTab, chatOpen, savedOnBoot, handleContinue, handleStartNew, handleToggleMute]);

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
      const guild = guilds.find((g) => g.id === pledgedGuildId) ?? guilds[0];
      const res = await fetch('/api/game/forge-relic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingNames: relics.map((r) => r.name),
          bannedTropes: BANNED_FANTASY_TROPES,
          playerGuild: guild.name,
          regionName: hud.region.name,
        }),
      });
      const json = await res.json();
      if (!json.ok || !json.relic) {
        throw new Error(json.error || 'Unable to forge emergent relic right now.');
      }
      const validKinds: RelicBonusKind[] = [
        'maxHp',
        'damagePct',
        'speedPct',
        'staminaRegenPct',
        'healPower',
      ];
      const kind: RelicBonusKind = validKinds.includes(json.relic.bonusKind)
        ? json.relic.bonusKind
        : 'damagePct';
      const newRelic: EquippedRelic = {
        id: `relic-forged-${Date.now()}`,
        name: String(json.relic.name),
        origin: String(json.relic.origin || hud.region.name),
        description: String(json.relic.description),
        bonusKind: kind,
        bonusValue: Math.max(8, Math.min(35, Number(json.relic.bonusValue) || 15)),
        equipped: true,
        isEmergent: true,
      };
      setMaterials((m) => ({
        ...m,
        silicateMoss: Math.max(0, m.silicateMoss - 1),
        lodestoneShards: Math.max(0, m.lodestoneShards - 1),
      }));
      setRelics((prev) => [newRelic, ...prev]);
      engineRef.current?.ingestEmergentLore(
        newRelic.id,
        `${newRelic.name} (${newRelic.origin}): ${newRelic.description}`,
      );
      audioRef.current?.playQuestComplete();
      showToast(`Forged & equipped ${newRelic.name}!`);
    } catch (err) {
      setForgeError(
        err instanceof Error ? err.message : 'Unable to forge emergent relic right now.',
      );
    } finally {
      setForgingRelic(false);
    }
  }, [guilds, hud.region.name, materials, pledgedGuildId, relics, showToast]);

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

  const handleTravelToRealm = useCallback(
    async (realm: FrontiersRealmSpec) => {
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

        await engineRef.current.loadRealm(realm, nextNpcs, nextEnemies, nextInteractables);

        setActiveRealmSlug(realm.slug);
        setActiveNpcs(nextNpcs);
        setActiveNpcId(null);

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
    [showToast],
  );
  handleTravelToRealmRef.current = handleTravelToRealm;

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

  const activeNpc = useMemo(
    () => activeNpcs.find((n) => n.id === activeNpcId) ?? INITIAL_NPCS.find((n) => n.id === activeNpcId) ?? null,
    [activeNpcs, activeNpcId],
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d1014]">
      {/* Dedicated WebGL Mount Container — Never Re-Parented */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen over Live 3D Vaelmor World Flyover */}
      {phase === 'title' && (
        <TitleOverlay
          hasSavedJourney={Boolean(savedOnBoot)}
          onStartNew={handleStartNew}
          onContinue={handleContinue}
        />
      )}

      {/* Active Playing HUD */}
      {phase === 'playing' && activeNpc === null && atlasTab === null && (
        <GameHud
          hud={hud}
          activeRealm={activeRealm}
          renown={renown}
          trackedQuest={trackedQuest}
          gearTiers={gearTiers}
          onlineCount={1 + remotePlayers.length}
          realmConnected={realmConnected}
          chatMessages={chatMessages}
          chatOpen={chatOpen}
          callouts={callouts}
          muted={muted}
          activeTrackTitle={audioState?.scoreTitle ?? activeRealm.soundtrack.title}
          toastMessage={toastMessage}
          onActivateGear={handleActivateGear}
          onTriggerAction={handleTriggerAction}
          onTriggerDodge={handleTriggerDodge}
          onNextTrack={handleNextTrack}
          onOpenJournal={() => setAtlasTab('chronicle')}
          onOpenMap={() => setAtlasTab('map')}
          onOpenDungeons={() => setAtlasTab('dungeons')}
          onOpenForge={() => setAtlasTab('forge')}
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
          usedMotifs={quests.map((q) => q.motif)}
          onSelectChoice={handleSelectDialogueChoice}
          onClose={() => setActiveNpcId(null)}
        />
      )}

      {/* Diegetic Field Atlas (Chronicle, World Map, Gear & Forge, Guilds, Lore Codex) */}
      {phase === 'playing' && atlasTab && (
        <JournalMapModal
          initialTab={atlasTab}
          quests={quests}
          trackedQuestId={trackedQuestId}
          npcs={activeNpcs}
          guilds={guilds}
          pledgedGuildId={pledgedGuildId}
          banners={banners}
          remotePlayers={remotePlayers}
          materials={materials}
          gearTiers={gearTiers}
          relics={relics}
          discoveredRegions={discoveredRegions}
          playerX={hud.playerX}
          playerZ={hud.playerZ}
          playerYaw={hud.playerYaw}
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
            realmRef.current?.updateProfile(playerCallsign, id);
            const g = guilds.find((x) => x.id === id);
            if (g) showToast(`Pledged allegiance to ${g.name}.`);
          }}
          onUpgradeGear={handleUpgradeGear}
          onToggleRelic={handleToggleRelic}
          onForgeEmergentRelic={() => void handleForgeEmergentRelic()}
          onClose={() => setAtlasTab(null)}
        />
      )}

      {/* Paused / Victory / Game Over Modal */}
      {(phase === 'paused' || phase === 'victory' || phase === 'gameover') && (
        <StatusModal
          phase={phase}
          regionName={hud.region.name}
          completedQuests={completedQuestsCount}
          totalQuests={quests.length}
          defeatedCount={hud.defeatedCount}
          renown={renown}
          bannersCount={banners.length}
          onResume={() => setPhase('playing')}
          onRespawnAtCitadel={handleRespawnAtCitadel}
          onRestart={handleStartNew}
          onReturnToTitle={() => {
            setActiveNpcId(null);
            setAtlasTab(null);
            setChatOpen(false);
            setPhase('title');
          }}
        />
      )}
    </div>
  );
}
