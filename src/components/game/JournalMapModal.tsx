import React, { useState } from 'react';
import {
  CODEX_ENTRIES,
  GEAR_LOADOUT,
  WORLD_REGIONS,
  type FoundationBanner,
  type GameNpc,
  type GameQuest,
  type GearSlotId,
  type GuildCharter,
  type RegionId,
} from '../../game/worldData';
import {
  canAffordMaterials,
  getUpgradeCost,
  type CraftingMaterials,
  type EquippedRelic,
  type GearUpgradeTiers,
  type RemotePlayerState,
  type WorldPing,
  type WorldPingKind,
} from '../../game/multiplayerTypes';
import {
  DEFAULT_ROOM_CODE,
  buildInviteUrl,
  filterSameRealmBanners,
  filterSameRealmPlayers,
  generatePrivateRoomCode,
} from '../../game/multiplayerState';

import type {
  DungeonArchitecturalStyle,
  FrontiersRealmSpec,
  RealmThemeId,
} from '../../verdant/realmModelSchema';
import {
  SOUNDTRACK_CATALOG,
  type RealmSoundtrackSpec,
} from '../../verdant/verdantScoreSchema';
import { sampleMacroClimate } from '../../verdant/verdantUniverseGenerator';
import type { VerdantAudioState } from '../../verdant/verdantAudioEngine';
import type {
  ObserverRefinementAgenda,
  ObserverSnapshot,
  VerdantVsmManagerSpec,
} from '../../verdant/verdantObserverManager';
import {
  SEMANTIC_VECTOR_AXES,
  type ModelLineageReport,
  type VerdantModelNode,
  type VerdantPartSlot,
  type VerdantResolutionTier,
} from '../../verdant/verdantModelOfModels';
import {
  DIRECTED_JOURNEY_MILESTONES,
  type JourneyProgressSummary,
} from '../../verdant/verdantJourneyModel';
import type { PlayerCharacterProfile } from '../../verdant/verdantCharacterTypes';
import {
  evaluateGearAffinity,
  evaluateRelicAffinity,
  type CharacterProgressionState,
} from '../../verdant/verdantCharacterOntology';

export type AtlasTab = 'chronicle' | 'map' | 'dungeons' | 'forge' | 'guilds' | 'codex';

interface JournalMapModalProps {
  initialTab: AtlasTab;
  quests: GameQuest[];
  trackedQuestId: string;
  npcs: GameNpc[];
  guilds: GuildCharter[];
  pledgedGuildId: string;
  playerCallsign: string;
  playerProfile?: PlayerCharacterProfile;
  characterProgression?: CharacterProgressionState;
  roomCode: string;
  realmConnected: boolean;
  banners: FoundationBanner[];
  remotePlayers: RemotePlayerState[];
  worldPings: WorldPing[];
  materials: CraftingMaterials;
  gearTiers: GearUpgradeTiers;
  relics: EquippedRelic[];
  discoveredRegions: RegionId[];
  playerX: number;
  playerZ: number;
  playerYaw: number;
  playerHp: number;
  playerMaxHp: number;
  renown: number;
  seekingRumor: boolean;
  rumorError: string | null;
  forgingRelic: boolean;
  forgeError: string | null;
  realms: FrontiersRealmSpec[];
  activeRealm: FrontiersRealmSpec;
  travelingRealm: boolean;
  generatingRealm: boolean;
  realmGenError: string | null;
  generatingDungeon: boolean;
  dungeonGenError: string | null;
  composingScore: boolean;
  audioState?: VerdantAudioState | null;
  realmPlaylist?: RealmSoundtrackSpec[];
  onSelectTrackedQuest: (questId: string) => void;
  onSeekEmergentQuest: () => void;
  onFastTravel: (regionId: RegionId, x: number, z: number, label: string) => void;
  onTravelToRealm: (realm: FrontiersRealmSpec) => void;
  onTravelToCell?: (cx: number, cz: number) => void;
  onGenerateRealm: (name: string, theme: RealmThemeId, brief: string) => void;
  onGenerateDungeon: (
    name: string,
    style: DungeonArchitecturalStyle,
    tier: number,
    brief: string,
  ) => void;
  onComposeScore: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  onSelectTrack?: (track: RealmSoundtrackSpec) => void;
  onPledgeGuild: (guildId: string) => void;
  onUpdateCallsign: (nextName: string) => void;
  onSwitchRoom: (nextRoomCode: string) => void;
  onWarpToAlly: (ally: RemotePlayerState) => void;
  onSummonParty: () => void;
  onDropPing: (kind?: WorldPingKind, label?: string) => void;
  onUpgradeGear: (gearId: GearSlotId) => void;
  onToggleRelic: (relicId: string) => void;
  onForgeEmergentRelic: () => void;
  modelObserverSnapshot?: ObserverSnapshot | null;
  observerAgenda?: ObserverRefinementAgenda | null;
  observerManagers?: VerdantVsmManagerSpec[];
  refiningWorldModel?: boolean;
  onRefineWorldModel?: (
    targetTier?: VerdantResolutionTier,
    partSlot?: VerdantPartSlot,
    modelId?: string,
  ) => void;
  onRunRatchetCycle?: () => void;
  onRunAutomate?: () => void;
  onInspectPartModels?: (partSlot: VerdantPartSlot) => VerdantModelNode[];
  onInspectModelLineage?: (modelId: string) => ModelLineageReport | null;
  journeySummary?: JourneyProgressSummary | null;
  onReplayPrologue?: () => void;
  onClose: () => void;
}

const REALM_THEME_OPTIONS: Array<{ id: RealmThemeId; label: string }> = [
  { id: 'sunken-aqueducts', label: 'Sunken Aqueducts' },
  { id: 'obsidian-crucible', label: 'Obsidian Crucible' },
  { id: 'pelagic-spires', label: 'Pelagic Spires' },
  { id: 'amber-steppe', label: 'Amber Steppe' },
  { id: 'glacial-spire', label: 'Glacial Spire' },
  { id: 'citadel-highlands', label: 'Citadel Highlands' },
];

const THEME_LABELS: Record<RealmThemeId, string> = {
  'citadel-highlands': 'Citadel Highlands',
  'sunken-aqueducts': 'Sunken Aqueducts',
  'obsidian-crucible': 'Obsidian Crucible',
  'pelagic-spires': 'Pelagic Spires',
  'amber-steppe': 'Amber Steppe',
  'glacial-spire': 'Glacial Spire',
};

const DUNGEON_STYLE_OPTIONS: Array<{ id: DungeonArchitecturalStyle; label: string }> = [
  { id: 'catacomb-vault', label: 'Catacomb Vault' },
  { id: 'geothermal-depths', label: 'Geothermal Depths' },
  { id: 'sunken-cistern', label: 'Sunken Cistern' },
  { id: 'abyssal-grotto', label: 'Abyssal Grotto' },
  { id: 'echo-tomb', label: 'Echo Tomb' },
  { id: 'glacial-crypt', label: 'Glacial Crypt' },
];

const DUNGEON_STYLE_LABELS: Record<DungeonArchitecturalStyle, string> = {
  'catacomb-vault': 'Catacomb Vault',
  'geothermal-depths': 'Geothermal Depths',
  'sunken-cistern': 'Sunken Cistern',
  'abyssal-grotto': 'Abyssal Grotto',
  'echo-tomb': 'Echo Tomb',
  'glacial-crypt': 'Glacial Crypt',
};

function mapCoord(val: number, halfSpan = 64): number {
  const clamped = Math.max(-halfSpan, Math.min(halfSpan, val));
  return ((clamped + halfSpan) / (halfSpan * 2)) * 400;
}

function formatRelicBonus(relic: EquippedRelic): string {
  switch (relic.bonusKind) {
    case 'maxHp':
      return `+${relic.bonusValue} Max Vitality`;
    case 'damagePct':
      return `+${relic.bonusValue}% Strike Power`;
    case 'speedPct':
      return `+${relic.bonusValue}% Stride Speed`;
    case 'staminaRegenPct':
      return `+${relic.bonusValue}% Stamina Recovery`;
    case 'healPower':
      return `+${relic.bonusValue} Lantern Mend`;
  }
}

export const JournalMapModal: React.FC<JournalMapModalProps> = ({
  initialTab,
  quests,
  trackedQuestId,
  npcs,
  guilds,
  pledgedGuildId,
  playerCallsign,
  roomCode,
  realmConnected,
  banners,
  remotePlayers,
  worldPings,
  materials,
  gearTiers,
  relics,
  discoveredRegions,
  playerX,
  playerZ,
  playerYaw,
  playerHp,
  playerMaxHp,
  renown,
  seekingRumor,
  rumorError,
  forgingRelic,
  forgeError,
  realms,
  activeRealm,
  travelingRealm,
  generatingRealm,
  realmGenError,
  generatingDungeon,
  dungeonGenError,
  composingScore,
  audioState,
  realmPlaylist,
  onSelectTrackedQuest,
  onSeekEmergentQuest,
  onFastTravel,
  onTravelToRealm,
  onTravelToCell,
  onGenerateRealm,
  onGenerateDungeon,
  onComposeScore,
  onPrevTrack,
  onNextTrack,
  onSelectTrack,
  onPledgeGuild,
  onUpdateCallsign,
  onSwitchRoom,
  onWarpToAlly,
  onSummonParty,
  onDropPing,
  onUpgradeGear,
  onToggleRelic,
  onForgeEmergentRelic,
  modelObserverSnapshot,
  observerAgenda,
  observerManagers,
  refiningWorldModel,
  onRefineWorldModel,
  onRunRatchetCycle,
  onRunAutomate,
  onInspectPartModels,
  onInspectModelLineage,
  journeySummary,
  playerProfile,
  characterProgression,
  onReplayPrologue,
  onClose,
}) => {
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [showManagers, setShowManagers] = useState(false);
  const [showAuditLedger, setShowAuditLedger] = useState(false);
  const [inspectedPart, setInspectedPart] = useState<VerdantPartSlot | null>(null);
  const [inspectedModelId, setInspectedModelId] = useState<string | null>(null);
  const [tab, setTab] = useState<AtlasTab>(initialTab);
  const [callsignDraft, setCallsignDraft] = useState(playerCallsign);
  const [roomInput, setRoomInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [newRealmName, setNewRealmName] = useState('');
  const [newRealmTheme, setNewRealmTheme] = useState<RealmThemeId>('glacial-spire');
  const [newRealmBrief, setNewRealmBrief] = useState('');
  const [newDungeonName, setNewDungeonName] = useState('');
  const [newDungeonStyle, setNewDungeonStyle] = useState<DungeonArchitecturalStyle>('catacomb-vault');
  const [newDungeonTier, setNewDungeonTier] = useState<number>(2);
  const [newDungeonBrief, setNewDungeonBrief] = useState('');
  const trackedQuest = quests.find((q) => q.id === trackedQuestId) ?? quests[0];
  const activeObj = trackedQuest?.objectives.find((o) => o.currentCount < o.requiredCount);
  const activeRegions = activeRealm.regions.length > 0 ? activeRealm.regions : WORLD_REGIONS;
  const activeFastTravelPoints = activeRealm.fastTravelPoints;
  const overworldRealms = realms.filter((r) => !r.isDungeon);
  const dungeons = realms.filter((r) => r.isDungeon);
  const sameRealmAllies = filterSameRealmPlayers(remotePlayers, activeRealm.slug);
  const sameRealmBanners = filterSameRealmBanners(banners, activeRealm.slug);
  const sameRealmPings = worldPings.filter(
    (p) => p.realmSlug === activeRealm.slug && p.expiresAt > Date.now(),
  );
  const inviteUrl =
    typeof window !== 'undefined'
      ? buildInviteUrl(window.location.origin, window.location.pathname, roomCode)
      : `?room=${roomCode}`;
  const mapHalfSpan = activeRealm.isDungeon
    ? 42
    : Math.max(58, Math.min(82, (activeRealm.worldHalfExtent || 112) * 0.68));
  const mc = (v: number) => mapCoord(v, mapHalfSpan);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-[#0a0d12]/78">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-[#131820] border border-[#d4a253]/40 rounded-sm shadow-[0_24px_64px_rgba(0,0,0,0.82)] overflow-hidden">
        {/* Atlas Header */}
        <div className="px-5 py-3 bg-[#0f131a] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['chronicle', 'Chronicle'],
                ['map', 'World Map'],
                ['dungeons', 'Dungeons'],
                ['forge', 'Forge'],
                ['guilds', `Party & Guilds (${1 + remotePlayers.length})`],
                ['codex', 'Codex'],
              ] as Array<[AtlasTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-2.5 py-1.5 rounded-sm font-display text-xs font-bold uppercase tracking-[0.1em] transition-colors cursor-pointer ${
                  tab === id
                    ? 'bg-[#d4a253] text-[#14110b]'
                    : 'bg-[#19202a] hover:bg-[#222c38] text-[#c7d0dc]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs tabular-nums text-[#d4a253]">
              Renown: {renown}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-sm bg-[#1c232d] hover:bg-[#27313f] text-xs font-semibold text-[#ece8df] uppercase tracking-[0.1em] cursor-pointer"
            >
              Return [Esc]
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'chronicle' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#f3efe6]">
                    Waywright’s Chronicle
                  </h2>
                  <p className="text-xs text-[#9ca7b5] mt-0.5">
                    Stabilize Vaelmor’s failing Meridian Arch, fulfill regional charters, or seek emergent frontier rumors.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onReplayPrologue && (
                    <button
                      type="button"
                      data-testid="chronicle-replay-prologue-btn"
                      onClick={onReplayPrologue}
                      className="px-3.5 py-2 rounded-sm bg-[#19222d] hover:bg-[#233040] border border-[#d4a253]/35 text-[#ece8df] font-display text-xs font-semibold uppercase tracking-[0.09em] cursor-pointer"
                    >
                      Replay Prologue
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={seekingRumor}
                    onClick={onSeekEmergentQuest}
                    className="px-4 py-2 rounded-sm bg-[#5ea38c] hover:bg-[#6eb59e] disabled:opacity-50 text-[#0e1513] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                  >
                    {seekingRumor ? 'Consulting Waystones...' : 'Seek Frontier Rumor'}
                  </button>
                </div>
              </div>

              {journeySummary && (
                <div
                  data-testid="chronicle-journey-roadmap"
                  className="p-3.5 rounded-sm bg-[#10161f] border border-[#d4a253]/28 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
                        Waywright Expedition Roadmap · {journeySummary.completedCount}/{journeySummary.totalCount} Complete ({journeySummary.completionPct}%)
                      </p>
                      <p className="text-xs text-[#c7d1dd] mt-0.5">
                        {journeySummary.currentChapterTitle}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {DIRECTED_JOURNEY_MILESTONES.map((m) => {
                      const done = journeySummary.completedIds.includes(m.id);
                      const isCurrent = journeySummary.activeMilestone?.id === m.id;
                      return (
                        <div
                          key={m.id}
                          className={`px-3 py-2 rounded-sm border text-xs ${
                            done
                              ? 'bg-[#121c1a] border-[#5ea38c]/40 text-[#bce3d5]'
                              : isCurrent
                                ? 'bg-[#1b222c] border-[#d4a253]/65 text-[#f3efe6]'
                                : 'bg-[#131922] border-white/10 text-[#97a4b3]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.12em]">
                            <span>
                              {done ? '✓ ' : `${m.stepNumber}. `}
                              {m.actLabel}
                            </span>
                            <span className={isCurrent ? 'text-[#e8c378]' : 'opacity-75'}>
                              {m.keybindBadge}
                            </span>
                          </div>
                          <p className="font-display font-semibold text-[11px] mt-0.5 text-[#f3efe6]">
                            {m.title}
                          </p>
                          <p className="text-[11px] opacity-85 leading-snug mt-0.5">
                            {m.controlHint}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rumorError && (
                <div className="px-3.5 py-2 rounded-sm bg-[#2b1a1a] border border-[#d96b6b]/40 text-xs text-[#f0b4b4]">
                  {rumorError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {quests.map((q) => {
                  const isTracked = q.id === trackedQuestId;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-sm border transition-colors ${
                        q.status === 'completed'
                          ? 'bg-[#121a19] border-[#5ea38c]/35'
                          : isTracked
                            ? 'bg-[#1a2028] border-[#d4a253]/65'
                            : 'bg-[#151b23] border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#d4a253] font-semibold">
                            {q.isEmergent ? 'Frontier Rumor' : q.motif}
                          </span>
                          <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-0.5">
                            {q.title}
                          </h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase ${
                            q.status === 'completed'
                              ? 'bg-[#5ea38c]/20 text-[#7fd1b6]'
                              : 'bg-[#d4a253]/15 text-[#e5be75]'
                          }`}
                        >
                          {q.status === 'completed' ? 'Completed' : `+${q.renownReward} Renown`}
                        </span>
                      </div>

                      <p className="text-xs text-[#b5c0cd] leading-relaxed mt-2">{q.summary}</p>

                      <ul className="mt-3 space-y-1.5">
                        {q.objectives.map((obj) => {
                          const done = obj.currentCount >= obj.requiredCount;
                          return (
                            <li
                              key={obj.id}
                              className={`text-xs flex items-center justify-between gap-2 ${
                                done ? 'text-[#7fd1b6] line-through opacity-80' : 'text-[#e8e3d8]'
                              }`}
                            >
                              <span>
                                {done ? '✓ ' : '• '}
                                {obj.description}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums shrink-0">
                                {obj.currentCount}/{obj.requiredCount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {q.status === 'active' && !isTracked && (
                        <button
                          type="button"
                          onClick={() => onSelectTrackedQuest(q.id)}
                          className="mt-3 px-3 py-1.5 rounded-sm bg-[#212936] hover:bg-[#2c3747] text-[11px] font-semibold text-[#e5be75] uppercase tracking-[0.1em] cursor-pointer"
                        >
                          Track Charter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'map' && (
            <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
              {/* Left Column: Active Realm Cartography + Local Waystones */}
              <div className="space-y-3.5 min-w-0">
                <div className="bg-[#0e1319] border border-[#d4a253]/30 rounded-sm p-2">
                  <div className="px-2 pb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[#d4a253]">
                    <span className="font-display font-bold truncate pr-2">{activeRealm.name}</span>
                    <span className="font-mono text-[#9ca7b5] shrink-0">
                      Cell ({activeRealm.cell.join(', ')})
                    </span>
                  </div>
                  <svg viewBox="0 0 400 400" className="w-full h-auto block rounded-sm bg-[#162029]">
                    <path
                      d="M 0 218 Q 100 202 200 220 T 400 226 L 400 248 Q 300 240 200 242 T 0 240 Z"
                      fill="#23485a"
                      opacity="0.82"
                    />
                    <circle cx="328" cy="320" r="68" fill="#1e4254" opacity="0.72" />

                    {activeRegions.map((r) => (
                      <g key={r.id}>
                        <circle
                          cx={mc(r.center[0])}
                          cy={mc(r.center[1])}
                          r={Math.min(46, (r.radius / mapHalfSpan) * 180)}
                          fill="#d4a253"
                          fillOpacity="0.06"
                          stroke="#d4a253"
                          strokeOpacity="0.22"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={mc(r.center[0])}
                          y={
                            r.id === 'southern-terrace'
                              ? mc(r.center[1]) + 28
                              : Math.max(14, mc(r.center[1]) - Math.min(28, (r.radius / mapHalfSpan) * 110))
                          }
                          textAnchor="middle"
                          fill="#b8c3d0"
                          fontSize="9.5"
                          fontFamily="Cinzel, serif"
                        >
                          {r.name}
                        </text>
                      </g>
                    ))}

                    {activeRealm.terrainProfile.hasBridge && (
                      <rect
                        x="188"
                        y="186"
                        width="24"
                        height="68"
                        fill="#7d776a"
                        stroke="#d4a253"
                        strokeWidth="1"
                      />
                    )}

                    {/* Dungeon Portal Entrance Markers */}
                    {(activeRealm.dungeonEntrances ?? []).map((ent) => (
                      <g key={ent.dungeonSlug}>
                        <polygon
                          points={`${mc(ent.position[0])},${mc(ent.position[1]) - 7} ${mc(ent.position[0]) + 7},${mc(ent.position[1])} ${mc(ent.position[0])},${mc(ent.position[1]) + 7} ${mc(ent.position[0]) - 7},${mc(ent.position[1])}`}
                          fill="#52d6f4"
                          stroke="#0d1014"
                          strokeWidth="1.5"
                        />
                      </g>
                    ))}

                    {/* NPC Pins */}
                    {npcs.map((n) => (
                      <circle
                        key={n.id}
                        cx={mc(n.position[0])}
                        cy={mc(n.position[1])}
                        r="5"
                        fill="#5ea38c"
                        stroke="#0d1014"
                        strokeWidth="1.5"
                      />
                    ))}

                    {/* Live Remote Multiplayer Waywrights (Same Realm) */}
                    {sameRealmAllies.map((rp) => (
                      <g key={rp.id}>
                        <circle
                          cx={mc(rp.x)}
                          cy={mc(rp.z)}
                          r="5.5"
                          fill="#78d5f5"
                          stroke="#0d1014"
                          strokeWidth="1.5"
                        />
                        <text
                          x={mc(rp.x)}
                          y={mc(rp.z) - 10}
                          textAnchor="middle"
                          fill="#a9e6fa"
                          stroke="#0d1014"
                          strokeWidth="3"
                          paintOrder="stroke"
                          fontSize="9"
                        >
                          {rp.name}
                        </text>
                      </g>
                    ))}

                    {/* Active Tactical World Pings (Same Realm) */}
                    {sameRealmPings.map((ping) => {
                      const col =
                        ping.kind === 'danger' ? '#f2604b' : ping.kind === 'loot' ? '#f2c96b' : '#52d6f4';
                      return (
                        <g key={ping.id}>
                          <circle
                            cx={mc(ping.x)}
                            cy={mc(ping.z)}
                            r="10"
                            fill="none"
                            stroke={col}
                            strokeWidth="2"
                            strokeDasharray="3 2"
                          />
                          <circle cx={mc(ping.x)} cy={mc(ping.z)} r="3" fill={col} />
                        </g>
                      );
                    })}

                    {/* Foundation Banners (Same Realm) */}
                    {sameRealmBanners.map((b) => (
                      <polygon
                        key={b.id}
                        points={`${mc(b.position[0])},${mc(b.position[1]) - 6} ${mc(b.position[0]) + 5},${mc(b.position[1]) + 4} ${mc(b.position[0]) - 5},${mc(b.position[1]) + 4}`}
                        fill={b.remote ? '#7fd1b6' : '#f0c36d'}
                      />
                    ))}

                    {/* Active Objective Marker */}
                    {activeObj && (
                      <g>
                        <circle
                          cx={mc(activeObj.targetCoords[0])}
                          cy={mc(activeObj.targetCoords[1])}
                          r="11"
                          fill="none"
                          stroke="#d4a253"
                          strokeWidth="2"
                        />
                        <circle
                          cx={mc(activeObj.targetCoords[0])}
                          cy={mc(activeObj.targetCoords[1])}
                          r="3.5"
                          fill="#d4a253"
                        />
                      </g>
                    )}

                    {/* Player Position & Heading */}
                    <g
                      transform={`translate(${mc(playerX)}, ${mc(playerZ)}) rotate(${
                        (-playerYaw * 180) / Math.PI + 180
                      })`}
                    >
                      <polygon points="0,-8 6,6 0,3 -6,6" fill="#ffffff" stroke="#11151b" strokeWidth="1.4" />
                    </g>
                  </svg>
                </div>

                {/* Local Waystone Fast Travel */}
                <div className="space-y-1.5">
                  <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[#d4a253]">
                    Local Waystones
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                    {activeFastTravelPoints.map((pt) => (
                      <button
                        key={`${pt.regionId}-${pt.name}`}
                        type="button"
                        onClick={() => onFastTravel(pt.regionId, pt.x, pt.z, pt.name)}
                        className="w-full px-3 py-2 rounded-sm bg-[#181f29] hover:bg-[#222c3a] border border-white/10 hover:border-[#d4a253]/50 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-display text-xs font-bold text-[#f2eee6]">{pt.name}</p>
                          <p className="font-mono text-[10px] text-[#98a4b3] tabular-nums">
                            ({pt.x}, {pt.z})
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-[#d4a253] font-semibold">
                          Travel
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Boundless Meridian Cell Grid + Chartered Realms & Live Synthesis */}
              <div className="space-y-3 min-w-0">
                <div>
                  <h2 className="font-display text-base font-bold text-[#f3efe6]">
                    Boundless Meridian Atlas
                  </h2>
                  <p className="text-xs text-[#9ca7b5] mt-0.5">
                    Walk past any N / S / E / W frontier gate (±96m) to cross seamlessly into uncharted cells, or click any coordinate below to synthesize &amp; explore via Verdant.
                  </p>
                </div>

                {/* Interactive 5x5 Boundless UniverseCell Grid centered on active cell */}
                {onTravelToCell && (
                  <div
                    data-testid="boundless-meridian-grid"
                    className="p-3 rounded-sm bg-[#0f151d] border border-[#d4a253]/35 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]">
                      <span className="font-display font-bold text-[#d4a253]">
                        Continuous Universe Grid · Centered ({activeRealm.cell[0]}, {activeRealm.cell[2]})
                      </span>
                      <span className="font-mono text-[#7fd1b6]">
                        {overworldRealms.length} Charted · Endless Beyond
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[-2, -1, 0, 1, 2].map((dz) =>
                        [-2, -1, 0, 1, 2].map((dx) => {
                          const gx = activeRealm.cell[0] + dx;
                          const gz = activeRealm.cell[2] + dz;
                          const isHere = !activeRealm.isDungeon && dx === 0 && dz === 0;
                          const charted = overworldRealms.find(
                            (r) => r.cell[0] === gx && r.cell[2] === gz,
                          );
                          const climate = sampleMacroClimate(gx, gz);
                          const theme = charted?.theme ?? climate.theme;
                          const dotColor: Record<RealmThemeId, string> = {
                            'citadel-highlands': '#9eb08a',
                            'sunken-aqueducts': '#5ea38c',
                            'obsidian-crucible': '#d96b43',
                            'pelagic-spires': '#52b4d9',
                            'amber-steppe': '#d9a452',
                            'glacial-spire': '#a6d2f0',
                          };
                          return (
                            <button
                              key={`${gx},${gz}`}
                              type="button"
                              data-cell-coord={`${gx},${gz}`}
                              disabled={isHere || travelingRealm || generatingRealm}
                              onClick={() => onTravelToCell(gx, gz)}
                              title={
                                charted
                                  ? `${charted.name} — Cell (${gx}, 0, ${gz})`
                                  : `Synthesize Uncharted ${climate.biomeTitle} — Cell (${gx}, 0, ${gz})`
                              }
                              className={`px-1.5 py-2 rounded-sm border text-left transition-colors ${
                                isHere
                                  ? 'bg-[#2a2215] border-[#d4a253] text-[#f8ecd2] cursor-default'
                                  : charted
                                    ? 'bg-[#17202b] hover:bg-[#223040] border-[#5ea38c]/45 text-[#e6edf5] cursor-pointer'
                                    : 'bg-[#111720] hover:bg-[#1a2431] border-white/10 hover:border-[#d4a253]/50 text-[#9aa7b6] cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-[9px] tabular-nums">
                                  {gx},{gz}
                                </span>
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: dotColor[theme] }}
                                />
                              </div>
                              <p className="font-display text-[9px] font-bold truncate mt-1">
                                {isHere
                                  ? 'You'
                                  : charted
                                    ? charted.name.replace(/^The\s+/i, '')
                                    : climate.biomeTitle.split(' ')[0]}
                              </p>
                              <p className="text-[8px] uppercase tracking-[0.08em] opacity-75 truncate">
                                {isHere ? 'Active' : charted ? 'Charted' : 'Uncharted'}
                              </p>
                            </button>
                          );
                        }),
                      )}
                    </div>
                  </div>
                )}

                <div className="max-h-[210px] overflow-y-auto pr-1 space-y-1.5">
                  {overworldRealms.map((realm) => {
                    const isCurrent = realm.slug === activeRealm.slug;
                    const catalogCount =
                      realm.prismCustody?.importedCatalogAssets?.length ??
                      new Set(realm.importedCatalogProps.map((p) => p.assetId)).size;
                    return (
                      <div
                        key={realm.slug}
                        data-realm-slug={realm.slug}
                        className={`px-3 py-2.5 rounded-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0 ${
                          isCurrent
                            ? 'bg-[#1a222b] border-[#d4a253]/65'
                            : 'bg-[#151b23] border-white/10'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-[#0f141c] text-[#d4a253] border border-[#d4a253]/25">
                              Cell ({realm.cell.join(', ')})
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[#7fd1b6] font-semibold">
                              {THEME_LABELS[realm.theme] ?? realm.theme}
                            </span>
                            {catalogCount > 0 && (
                              <span className="font-mono text-[10px] text-[#98a4b3]">
                                · {catalogCount} HD Assets
                              </span>
                            )}
                          </div>
                          <h3 className="font-display text-xs font-bold text-[#f3efe6] mt-0.5">
                            {realm.name}
                          </h3>
                          <p className="text-[11px] text-[#aeb9c6] truncate">
                            {realm.summary}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isCurrent || travelingRealm || generatingRealm}
                          onClick={() => onTravelToRealm(realm)}
                          className={`shrink-0 px-3 py-1.5 rounded-sm font-display text-[11px] font-bold uppercase tracking-[0.09em] transition-colors ${
                            isCurrent
                              ? 'bg-[#2a333f] text-[#98a4b3] cursor-default'
                              : 'bg-[#d4a253] hover:bg-[#e1b366] disabled:opacity-45 text-[#14110b] cursor-pointer'
                          }`}
                        >
                          {isCurrent
                            ? 'Current Realm'
                            : travelingRealm
                              ? 'Opening Portal...'
                              : 'Portal Travel'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Chart New Frontier Realm (Automated Verdant Synthesis) */}
                <div className="p-3.5 rounded-sm bg-[#10161f] border border-[#5ea38c]/40 space-y-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#7fd1b6] font-semibold">
                      Autonomous Verdant World Synthesis
                    </p>
                    <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-0.5">
                      Chart New Frontier Realm
                    </h3>
                  </div>

                  {realmGenError && (
                    <div className="px-3 py-1.5 rounded-sm bg-[#2b1a1a] border border-[#d96b6b]/40 text-xs text-[#f0b4b4]">
                      {realmGenError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newRealmName}
                      onChange={(e) => setNewRealmName(e.target.value)}
                      placeholder="Realm Name (e.g. Basalt Cloisters of Veren)"
                      className="min-w-0 w-full px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] placeholder:text-[#6f7b8a] focus:outline-none focus:border-[#5ea38c]"
                    />
                    <select
                      value={newRealmTheme}
                      onChange={(e) => setNewRealmTheme(e.target.value as RealmThemeId)}
                      className="min-w-0 w-full px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] focus:outline-none focus:border-[#5ea38c]"
                    >
                      {REALM_THEME_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newRealmBrief}
                      onChange={(e) => setNewRealmBrief(e.target.value)}
                      placeholder="Optional frontier brief (geology, acoustics, guild craft...)"
                      className="min-w-0 flex-1 px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] placeholder:text-[#6f7b8a] focus:outline-none focus:border-[#5ea38c]"
                    />
                    <button
                      type="button"
                      disabled={generatingRealm || travelingRealm || newRealmName.trim().length < 3}
                      onClick={() => {
                        const cleanName = newRealmName.trim();
                        if (cleanName.length < 3) return;
                        onGenerateRealm(cleanName, newRealmTheme, newRealmBrief.trim());
                        setNewRealmName('');
                        setNewRealmBrief('');
                      }}
                      className="px-4 py-1.5 rounded-sm bg-[#5ea38c] hover:bg-[#6eb59e] disabled:opacity-45 text-[#0e1513] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer shrink-0"
                    >
                      {generatingRealm ? 'Compiling Realm...' : 'Chart & Compile'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex flex-wrap gap-4 text-[11px] text-[#a9b4c2]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-white inline-block" /> You
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#78d5f5] inline-block" /> Allies Here ({sameRealmAllies.length}/{remotePlayers.length})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5ea38c] inline-block" /> Waywright NPC
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rotate-45 bg-[#52d6f4] inline-block" /> Dungeon Portal
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'dungeons' && (
            <div className="space-y-5">
              {/* Active Orchestral Soundtrack Suite & Multi-Song Jukebox */}
              <div className="p-4 rounded-sm bg-[#101720] border border-[#d4a253]/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
                        Verdant Orchestral Suite
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-[#1a2430] text-[#7fd1b6] border border-[#5ea38c]/30">
                        {audioState?.meter ?? activeRealm.soundtrack.meter ?? '4/4'} ·{' '}
                        {audioState?.mode ?? activeRealm.soundtrack.mode} ·{' '}
                        {audioState?.bpm ?? activeRealm.soundtrack.bpm} BPM
                      </span>
                      <span className="font-mono text-[10px] text-[#98a4b3]">
                        Track {(audioState?.trackIndex ?? 0) + 1} /{' '}
                        {audioState?.playlistLength ?? realmPlaylist?.length ?? 4} ·{' '}
                        {SOUNDTRACK_CATALOG.length}-Song Repertoire
                      </span>
                    </div>
                    <h2
                      data-testid="active-score-title"
                      className="font-display text-base font-bold text-[#f3efe6] mt-0.5"
                    >
                      {audioState?.scoreTitle ?? activeRealm.soundtrack.title}
                    </h2>
                    <p className="text-xs text-[#aeb9c6] mt-0.5">
                      {audioState?.composerNote ?? activeRealm.soundtrack.composerNote}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {onPrevTrack && (
                      <button
                        type="button"
                        data-action="atlas-prev-track"
                        onClick={onPrevTrack}
                        className="px-2.5 py-2 rounded-sm bg-[#19222d] hover:bg-[#243140] border border-white/15 text-[#ece8df] font-display text-[11px] font-bold uppercase tracking-[0.08em] cursor-pointer"
                      >
                        Prev
                      </button>
                    )}
                    {onNextTrack && (
                      <button
                        type="button"
                        data-action="atlas-next-track"
                        onClick={onNextTrack}
                        className="px-2.5 py-2 rounded-sm bg-[#19222d] hover:bg-[#243140] border border-white/15 text-[#ece8df] font-display text-[11px] font-bold uppercase tracking-[0.08em] cursor-pointer"
                      >
                        Next Song
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={composingScore}
                      onClick={onComposeScore}
                      className="px-3.5 py-2 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] disabled:opacity-45 text-[#14110b] font-display text-xs font-bold uppercase tracking-[0.09em] cursor-pointer"
                    >
                      {composingScore ? 'Composing...' : 'Compose Fresh'}
                    </button>
                  </div>
                </div>

                {/* Realm Suite Movements + Expandable Full 20-Song Repertoire */}
                {onSelectTrack && (
                  <div className="pt-2.5 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#98a4b3] font-semibold">
                        {showAllSongs
                          ? `Complete Soundtrack Repertoire (${SOUNDTRACK_CATALOG.length} Movements)`
                          : `Active Realm Suite (${(realmPlaylist ?? SOUNDTRACK_CATALOG.slice(0, 4)).length} Movements · Auto-Rotates)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllSongs((v) => !v)}
                        className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#d4a253] hover:text-[#f0c778] cursor-pointer"
                      >
                        {showAllSongs ? 'Show Realm Suite' : `Browse All ${SOUNDTRACK_CATALOG.length} Songs`}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {(showAllSongs
                        ? SOUNDTRACK_CATALOG
                        : realmPlaylist && realmPlaylist.length > 0
                          ? realmPlaylist
                          : SOUNDTRACK_CATALOG.slice(0, 4)
                      ).map((song) => {
                        const isPlaying =
                          (audioState?.scoreTitle ?? activeRealm.soundtrack.title) === song.title;
                        return (
                          <button
                            key={song.id}
                            type="button"
                            data-track-id={song.id}
                            onClick={() => onSelectTrack(song)}
                            className={`text-left px-2.5 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                              isPlaying
                                ? 'bg-[#262015] border-[#d4a253]/75 text-[#f7ebd1]'
                                : 'bg-[#151d26] hover:bg-[#1d2734] border-white/10 text-[#cbd4df]'
                            }`}
                          >
                            <p className="font-display text-[11px] font-bold truncate">
                              {song.title}
                            </p>
                            <p className="font-mono text-[9px] text-[#8ea0b2] truncate">
                              {song.meter ?? '4/4'} · {song.mode} · {song.bpm} BPM
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Compiled Playable 3D Dungeons Grid */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#f3efe6]">
                      Vaulted 3D Dungeons &amp; Frontier Delves ({dungeons.length})
                    </h2>
                    <p className="text-xs text-[#9ca7b5] mt-0.5">
                      Each delve is a dedicated multi-chamber 3D interior compiled through Verdant with abyss bridges, seal braziers, treasure alcoves, and colossus sanctums.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dungeons.map((dg) => {
                    const isCurrent = dg.slug === activeRealm.slug;
                    const boss = dg.enemies.find((e) => e.archetype === 'colossus');
                    const parentRealm = overworldRealms.find((r) => r.slug === dg.parentRealmSlug);
                    const catalogCount =
                      dg.prismCustody?.importedCatalogAssets?.length ??
                      new Set(dg.importedCatalogProps.map((p) => p.assetId)).size;
                    return (
                      <div
                        key={dg.slug}
                        data-dungeon-slug={dg.slug}
                        className={`p-3.5 rounded-sm border flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? 'bg-[#1a222b] border-[#52d6f4]/70'
                            : 'bg-[#151b23] border-white/10'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-[#0f161f] text-[#52d6f4] border border-[#52d6f4]/30">
                              Tier {dg.dungeonTier ?? 1} ·{' '}
                              {DUNGEON_STYLE_LABELS[dg.dungeonStyle ?? 'catacomb-vault']}
                            </span>
                            <span className="font-mono text-[10px] text-[#98a4b3]">
                              {catalogCount} HD Assets
                            </span>
                          </div>
                          <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-1.5">
                            {dg.name}
                          </h3>
                          <p className="text-[11px] text-[#aeb9c6] mt-1 leading-relaxed">
                            {dg.summary}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#cfd7e2]">
                            {parentRealm && (
                              <span>
                                Entrance: <strong className="text-[#d4a253]">{parentRealm.name}</strong>
                              </span>
                            )}
                            {boss && (
                              <span>
                                Warden: <strong className="text-[#e09f5a]">{boss.name}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[#7fd1b6] truncate">
                            Score: {dg.soundtrack.title}
                          </span>
                          <button
                            type="button"
                            disabled={isCurrent || travelingRealm || generatingDungeon}
                            onClick={() => onTravelToRealm(dg)}
                            className={`shrink-0 px-3 py-1.5 rounded-sm font-display text-[11px] font-bold uppercase tracking-[0.09em] transition-colors ${
                              isCurrent
                                ? 'bg-[#2a333f] text-[#98a4b3] cursor-default'
                                : 'bg-[#5ea38c] hover:bg-[#6eb59e] disabled:opacity-45 text-[#0e1513] cursor-pointer'
                            }`}
                          >
                            {isCurrent
                              ? 'Inside Delve'
                              : travelingRealm
                                ? 'Descending...'
                                : 'Descend Into Delve'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Autonomous Verdant 3D Dungeon Synthesis Form */}
              <div className="p-4 rounded-sm bg-[#10161f] border border-[#52d6f4]/35 space-y-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#52d6f4] font-semibold">
                    Autonomous Verdant Delve Generator
                  </p>
                  <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-0.5">
                    Chart New 3D Dungeon Delve
                  </h3>
                </div>

                {dungeonGenError && (
                  <div className="px-3 py-1.5 rounded-sm bg-[#2b1a1a] border border-[#d96b6b]/40 text-xs text-[#f0b4b4]">
                    {dungeonGenError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newDungeonName}
                    onChange={(e) => setNewDungeonName(e.target.value)}
                    placeholder="Delve Name (e.g. Vault of Ash & Brass)"
                    className="min-w-0 w-full px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] placeholder:text-[#6f7b8a] focus:outline-none focus:border-[#52d6f4]"
                  />
                  <select
                    value={newDungeonStyle}
                    onChange={(e) => setNewDungeonStyle(e.target.value as DungeonArchitecturalStyle)}
                    className="min-w-0 w-full px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] focus:outline-none focus:border-[#52d6f4]"
                  >
                    {DUNGEON_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newDungeonTier}
                    onChange={(e) => setNewDungeonTier(Number(e.target.value))}
                    className="min-w-0 w-full px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] focus:outline-none focus:border-[#52d6f4]"
                  >
                    <option value={1}>Depth Tier I (Surveyor)</option>
                    <option value={2}>Depth Tier II (Warden)</option>
                    <option value={3}>Depth Tier III (Abyssal)</option>
                    <option value={4}>Depth Tier IV (Mythic)</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newDungeonBrief}
                    onChange={(e) => setNewDungeonBrief(e.target.value)}
                    placeholder="Optional architectural brief (chasm, seals, acoustics, boss...)"
                    className="min-w-0 flex-1 px-3 py-1.5 rounded-sm bg-[#171f2a] border border-white/15 text-xs text-[#f3efe6] placeholder:text-[#6f7b8a] focus:outline-none focus:border-[#52d6f4]"
                  />
                  <button
                    type="button"
                    disabled={generatingDungeon || travelingRealm || newDungeonName.trim().length < 3}
                    onClick={() => {
                      const clean = newDungeonName.trim();
                      if (clean.length < 3) return;
                      onGenerateDungeon(clean, newDungeonStyle, newDungeonTier, newDungeonBrief.trim());
                      setNewDungeonName('');
                      setNewDungeonBrief('');
                    }}
                    className="px-4 py-1.5 rounded-sm bg-[#52d6f4] hover:bg-[#72e0f8] disabled:opacity-45 text-[#0a1318] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer shrink-0"
                  >
                    {generatingDungeon ? 'Compiling Delve...' : 'Compile & Descend'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'forge' && (
            <div className="space-y-5">
              {/* Material Satchel */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#f3efe6]">
                    Waywright’s Arsenal &amp; Relic Forge
                  </h2>
                  <p className="text-xs text-[#9ca7b5] mt-0.5">
                    Temper your tools with frontier salvage or forge unique survey relics.
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                  <span className="px-2.5 py-1.5 rounded-sm bg-[#16211e] border border-[#5ea38c]/35 text-[#8ee3c5]">
                    Silicate Moss: {materials.silicateMoss}
                  </span>
                  <span className="px-2.5 py-1.5 rounded-sm bg-[#211d16] border border-[#d4a253]/35 text-[#f0cb7e]">
                    Lodestone: {materials.lodestoneShards}
                  </span>
                  <span className="px-2.5 py-1.5 rounded-sm bg-[#231917] border border-[#d98657]/35 text-[#f0ae86]">
                    Foundry Slag: {materials.foundrySlag}
                  </span>
                </div>
              </div>

              {/* 4 Equipable Weapons Tempering Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {GEAR_LOADOUT.map((gear) => {
                  const tier = gearTiers[gear.id] ?? 1;
                  const cost = getUpgradeCost(tier);
                  const affordable = canAffordMaterials(materials, cost);
                  const affinity =
                    playerProfile
                      ? evaluateGearAffinity(playerProfile, gear.id)
                      : null;
                  return (
                    <div
                      key={gear.id}
                      className={`p-4 rounded-sm border flex flex-col justify-between gap-3 ${
                        affinity?.rating === 'resonant'
                          ? 'bg-[#192029] border-[#d4a253]/45'
                          : 'bg-[#161c25] border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-bold text-[#f3efe6]">
                            {gear.name}
                          </h3>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-sm bg-[#d4a253]/18 text-[#e8c374]">
                            Tier {tier} / 3
                          </span>
                        </div>
                        <p className="text-[11px] text-[#d4a253] mt-0.5">{gear.roleClue}</p>
                        {affinity && (
                          <p
                            className={`text-[11px] mt-1 font-medium tabular-nums ${
                              affinity.rating === 'resonant' ? 'text-[#7fd1b6]' : 'text-[#9aa7b6]'
                            }`}
                          >
                            {affinity.label} · {affinity.reason}
                          </p>
                        )}
                        <p className="text-xs text-[#b2bdc9] mt-2 leading-relaxed">
                          {gear.description}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                        {cost ? (
                          <>
                            <span className="font-mono text-[10px] text-[#9aa6b5] tabular-nums">
                              Cost: {cost.silicateMoss} Moss · {cost.lodestoneShards} Lodestone · {cost.foundrySlag} Slag
                            </span>
                            <button
                              type="button"
                              disabled={!affordable}
                              onClick={() => onUpgradeGear(gear.id)}
                              className="px-3 py-1.5 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] disabled:opacity-35 text-[#14110b] font-display text-[11px] font-bold uppercase tracking-[0.08em] cursor-pointer"
                            >
                              Temper
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#5ea38c]">
                            Masterwork Tier Reached
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Survey Relics & Emergent Relic Forge */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#f3efe6]">
                      Equipped Survey Relics
                    </h3>
                    <p className="text-xs text-[#9ca7b5]">
                      Toggle passive relics or synthesize a new non-repeating frontier relic (1 Moss + 1 Lodestone).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      forgingRelic || materials.silicateMoss < 1 || materials.lodestoneShards < 1
                    }
                    onClick={onForgeEmergentRelic}
                    className="px-4 py-2 rounded-sm bg-[#5ea38c] hover:bg-[#6eb59e] disabled:opacity-40 text-[#0e1513] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                  >
                    {forgingRelic ? 'Forging Relic...' : 'Forge Emergent Relic'}
                  </button>
                </div>

                {forgeError && (
                  <div className="px-3.5 py-2 rounded-sm bg-[#2b1a1a] border border-[#d96b6b]/40 text-xs text-[#f0b4b4]">
                    {forgeError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {relics.map((r) => {
                    const rarityTone =
                      r.rarity === 'Sovereign'
                        ? 'bg-[#362614] border-[#f0bd5e]/60 text-[#ffd784]'
                        : r.rarity === 'Resonant'
                          ? 'bg-[#162724] border-[#5ea38c]/55 text-[#8ee3c5]'
                          : 'bg-[#1d222c] border-white/15 text-[#c0cbd8]';
                    return (
                      <div
                        key={r.id}
                        data-testid={`relic-card-${r.id}`}
                        className={`p-3.5 rounded-sm border flex items-start justify-between gap-3 ${
                          r.equipped
                            ? 'bg-[#1a222b] border-[#d4a253]/55 shadow-[0_6px_18px_rgba(0,0,0,0.35)]'
                            : 'bg-[#151b23] border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {r.sigilSvg ? (
                            <img
                              src={r.sigilSvg}
                              alt={`${r.name} sigil`}
                              className="w-12 h-12 rounded-sm shrink-0 border border-white/12 bg-[#12161d]"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-sm shrink-0 border border-[#d4a253]/35 bg-[#1b2029] flex items-center justify-center font-mono text-[10px] text-[#e8c374]">
                              {r.resonanceHz ? `${r.resonanceHz}Hz` : 'SIGIL'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {r.rarity && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-mono font-bold uppercase tracking-[0.1em] ${rarityTone}`}
                                >
                                  {r.rarity}
                                </span>
                              )}
                              {r.resonanceHz && (
                                <span className="font-mono text-[9px] text-[#8fa0b2]">
                                  {r.resonanceHz} Hz
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5ea38c] font-semibold mt-1 truncate">
                              {r.origin}
                            </p>
                            <h4 className="font-display text-xs font-bold text-[#f3efe6] mt-0.5">
                              {r.name}
                            </h4>
                            <p className="text-[11px] text-[#aeb9c6] mt-1 leading-snug">
                              {r.description}
                            </p>
                            <p className="font-mono text-[11px] text-[#e8c374] mt-1.5">
                              {formatRelicBonus(r)}
                            </p>
                            {playerProfile && (() => {
                              const rAff = evaluateRelicAffinity(playerProfile, r);
                              return (
                                <p
                                  className={`text-[10px] mt-1 ${
                                    rAff.rating === 'resonant' ? 'text-[#7fd1b6] font-medium' : 'text-[#8ea0b2]'
                                  }`}
                                >
                                  {rAff.label}
                                </p>
                              );
                            })()}
                            {r.perkLabel && (
                              <div className="mt-1.5 pt-1.5 border-t border-white/8">
                                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#7ad8eb] font-semibold">
                                  Active Perk · {r.perkLabel}
                                </p>
                                {r.perkDescription && (
                                  <p className="text-[10px] text-[#9cb0c2] mt-0.5 leading-snug">
                                    {r.perkDescription}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleRelic(r.id)}
                          className={`shrink-0 px-2.5 py-1.5 rounded-sm text-[10px] font-display font-bold uppercase tracking-[0.08em] cursor-pointer ${
                            r.equipped
                              ? 'bg-[#2a333f] text-[#cfd7e2] hover:bg-[#34404f]'
                              : 'bg-[#d4a253] text-[#14110b] hover:bg-[#e1b366]'
                          }`}
                        >
                          {r.equipped ? 'Equipped' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'guilds' && (
            <div className="space-y-6">
              {/* Live Co-op Fellowship, Expedition Room & Invite Controls */}
              <div
                data-testid="fellowship-panel"
                className="rounded-sm border border-[#52d6f4]/35 bg-[#111822] p-4 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${realmConnected ? 'bg-[#5ea38c]' : 'bg-[#d4a253]'}`}
                      />
                      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#7ed9ee] font-semibold">
                        Live Co-op Expedition · Room {roomCode}
                      </p>
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#f3efe6] mt-0.5">
                      Fellowship &amp; Shared Meridian
                    </h2>
                    <p className="text-xs text-[#9eb0c2] mt-0.5">
                      Share your Expedition link so friends join your exact room. Fight bosses together,
                      mend nearby allies with your Mortar Lantern [3], drop Rally Beacons [G], and warp into
                      each other&apos;s realms or 3D dungeons.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="copy-invite-btn"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          void navigator.clipboard.writeText(inviteUrl).catch(() => {});
                        }
                        setCopiedInvite(true);
                        window.setTimeout(() => setCopiedInvite(false), 2200);
                      }}
                      className="px-3.5 py-2 rounded-sm bg-[#52d6f4] hover:bg-[#70e1fa] text-[#0c141c] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                    >
                      {copiedInvite ? 'Invite Link Copied' : 'Copy Invite Link'}
                    </button>
                    <button
                      type="button"
                      data-testid="summon-party-btn"
                      onClick={onSummonParty}
                      className="px-3.5 py-2 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                    >
                      Summon Party Here
                    </button>
                    <button
                      type="button"
                      onClick={() => onDropPing('rally', 'Rally Here')}
                      className="px-3 py-2 rounded-sm bg-[#192531] hover:bg-[#223344] border border-[#52d6f4]/35 text-[#88dff5] font-display text-xs font-semibold uppercase tracking-[0.08em] cursor-pointer"
                    >
                      Rally Ping [G]
                    </button>
                  </div>
                </div>

                {/* Callsign & Private/Public Room Switcher */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <form
                    className="bg-[#151d28] border border-white/10 rounded-sm p-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (callsignDraft.trim().length >= 2) {
                        onUpdateCallsign(callsignDraft.trim());
                      }
                    }}
                  >
                    <label
                      htmlFor="waywright-callsign-input"
                      className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#b4c2d1]"
                    >
                      Your Waywright Callsign
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="waywright-callsign-input"
                        data-testid="callsign-input"
                        type="text"
                        maxLength={24}
                        value={callsignDraft}
                        onChange={(e) => setCallsignDraft(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-sm bg-[#0d1218] border border-white/15 focus:border-[#d4a253] text-xs text-[#f3efe6] outline-none"
                      />
                      <button
                        type="submit"
                        data-testid="save-callsign-btn"
                        className="px-3 py-1.5 rounded-sm bg-[#25303f] hover:bg-[#314054] border border-[#d4a253]/40 text-xs font-semibold text-[#f0cd80] cursor-pointer"
                      >
                        Update Name
                      </button>
                    </div>
                  </form>

                  <form
                    className="bg-[#151d28] border border-white/10 rounded-sm p-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (roomInput.trim().length >= 3) {
                        onSwitchRoom(roomInput.trim());
                        setRoomInput('');
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="expedition-room-input"
                        className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#b4c2d1]"
                      >
                        Expedition Room Code
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="create-private-room-btn"
                          onClick={() => onSwitchRoom(generatePrivateRoomCode())}
                          className="text-[10px] font-mono text-[#7ed9ee] hover:text-[#b4effc] underline cursor-pointer"
                        >
                          New Private Room
                        </button>
                        {roomCode !== DEFAULT_ROOM_CODE && (
                          <button
                            type="button"
                            onClick={() => onSwitchRoom(DEFAULT_ROOM_CODE)}
                            className="text-[10px] font-mono text-[#d4a253] hover:text-[#f0c778] underline cursor-pointer"
                          >
                            Open Meridian
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="expedition-room-input"
                        data-testid="room-code-input"
                        type="text"
                        maxLength={18}
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                        placeholder={`Current: ${roomCode}`}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-sm bg-[#0d1218] border border-white/15 focus:border-[#52d6f4] font-mono text-xs text-[#f3efe6] placeholder:text-[#6f7e8f] outline-none"
                      />
                      <button
                        type="submit"
                        data-testid="join-room-btn"
                        disabled={roomInput.trim().length < 3}
                        className="px-3 py-1.5 rounded-sm bg-[#233342] hover:bg-[#2d4357] disabled:opacity-40 border border-[#52d6f4]/40 text-xs font-semibold text-[#9be8fb] cursor-pointer"
                      >
                        Join Room
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Party Roster */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[#7ed9ee]">
                      Active Waywrights in {roomCode} ({1 + remotePlayers.length})
                    </h3>
                    <span className="font-mono text-[10px] text-[#8fa0b2] truncate max-w-[320px]">
                      {inviteUrl}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Local Player Card */}
                    <div className="px-3 py-2.5 rounded-sm bg-[#17202b] border border-[#d4a253]/45 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#d4a253]" />
                          <span className="text-xs font-bold text-[#f6f1e6] truncate">
                            {playerCallsign}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#d4a253]/20 text-[9px] font-mono uppercase text-[#f0cd80]">
                            You
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9fb0c2] mt-0.5 truncate">
                          {activeRealm.name} · ({Math.round(playerX)}, {Math.round(playerZ)})
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[10px] text-[#7fd1b6] tabular-nums">
                          {Math.round(playerHp)}/{playerMaxHp} HP
                        </p>
                      </div>
                    </div>

                    {/* Connected Remote Allies */}
                    {remotePlayers.length === 0 ? (
                      <div className="px-3 py-2.5 rounded-sm bg-[#151b23] border border-white/8 flex items-center text-xs text-[#94a3b4]">
                        No other Waywrights in {roomCode} yet — copy the invite link above to play
                        together!
                      </div>
                    ) : (
                      remotePlayers.map((ally) => {
                        const inSameRealm = (ally.realmSlug || 'vaelmor') === activeRealm.slug;
                        const dist = Math.round(Math.hypot(ally.x - playerX, ally.z - playerZ));
                        const allyHp = ally.hp ?? 100;
                        const allyMaxHp = Math.max(1, ally.maxHp ?? 100);
                        return (
                          <div
                            key={ally.id}
                            data-testid={`roster-ally-${ally.id}`}
                            className="px-3 py-2.5 rounded-sm bg-[#151d26] border border-[#52d6f4]/30 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    inSameRealm ? 'bg-[#52d6f4]' : 'bg-[#d4a253]'
                                  }`}
                                />
                                <span className="text-xs font-bold text-[#edf5fa] truncate">
                                  {ally.name}
                                </span>
                                <span className="font-mono text-[10px] text-[#7fd1b6] tabular-nums">
                                  {allyHp}/{allyMaxHp} HP
                                </span>
                              </div>
                              <p className="text-[11px] text-[#9cb0c4] mt-0.5 truncate">
                                {ally.realmName || ally.realmSlug || 'Vaelmor Meridian'}
                                {inSameRealm ? ` · ${dist}m away` : ' · Different Realm'}
                              </p>
                            </div>
                            <button
                              type="button"
                              data-testid={`warp-ally-${ally.id}`}
                              onClick={() => onWarpToAlly(ally)}
                              className="px-2.5 py-1.5 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] font-display text-[10px] font-bold uppercase tracking-[0.08em] cursor-pointer shrink-0"
                            >
                              {inSameRealm ? 'Meet Up' : 'Warp To'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-[#f3efe6]">
                  Federated Frontier Guilds
                </h2>
                <p className="text-xs text-[#9ca7b5] mt-0.5">
                  Pledge allegiance and raise Foundation Banners with your Brass Way-Compass [4].
                  Guild prosperity and banners sync live across your Expedition Room.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {guilds.map((g) => {
                  const pledged = g.id === pledgedGuildId;
                  return (
                    <div
                      key={g.id}
                      className={`p-4 rounded-sm border flex flex-col justify-between gap-3 ${
                        pledged
                          ? 'bg-[#1a222b] border-[#d4a253]/65'
                          : 'bg-[#151b23] border-white/10'
                      }`}
                    >
                      <div>
                        <p
                          className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                          style={{ color: g.accentHex }}
                        >
                          {pledged ? 'Pledged Guild' : 'Federated Charter'}
                        </p>
                        <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-1">
                          {g.name}
                        </h3>
                        <p className="text-xs italic text-[#a8b3c2] mt-1.5">“{g.motto}”</p>
                        <p className="text-xs text-[#cfd7e2] mt-2.5 leading-relaxed">
                          {g.expeditionGoal}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#b5c0cd]">
                          <span>Prosperity {g.prosperity}%</span>
                          <span>{g.activeWaywrights} Allies</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onPledgeGuild(g.id)}
                          disabled={pledged}
                          className={`w-full py-2 rounded-sm text-xs font-display font-bold uppercase tracking-[0.1em] cursor-pointer ${
                            pledged
                              ? 'bg-[#2a333f] text-[#98a4b3] cursor-default'
                              : 'bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b]'
                          }`}
                        >
                          {pledged ? 'Current Banner' : 'Pledge Charter'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-white/10">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[#d4a253] mb-2">
                  Shared Foundation Banners ({banners.length})
                </h3>
                {banners.length === 0 ? (
                  <p className="text-xs text-[#95a1b0]">
                    No Foundation Banners planted yet. Equip your Brass Way-Compass [4] and press F or
                    Click to claim frontier ground.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {banners.map((b) => (
                      <div
                        key={b.id}
                        className="px-3 py-2 rounded-sm bg-[#161c25] border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#ece8df]">{b.name}</p>
                          <p className="text-[11px] text-[#95a1b0]">
                            Raised by {b.builderName}
                            {b.remote ? ' (Live Realm)' : ''}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-[#d4a253]">
                          ({Math.round(b.position[0])}, {Math.round(b.position[1])})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'codex' && (
            <div className="space-y-5">
              {/* Unified World Charter — Single Model of Models & Verdant Observer/Manager Refinement */}
              {modelObserverSnapshot && (
                <div className="rounded-sm border border-[#d4a253]/35 bg-[#151b24] p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#d4a253] font-semibold">
                        Verdant Generative Charter · Model of Models
                      </p>
                      <h2 className="font-display text-base font-bold text-[#f3efe6] mt-0.5">
                        Tier {modelObserverSnapshot.summary.resolutionTier} · {modelObserverSnapshot.kpis.resolutionLabel}
                      </h2>
                      <p className="text-xs text-[#9ca7b5] mt-1">
                        {modelObserverSnapshot.summary.totalModels} composed models ·{' '}
                        {modelObserverSnapshot.graphEdgeCount} semantic links (
                        {modelObserverSnapshot.crossPartEdgeCount} cross-part) ·{' '}
                        {modelObserverSnapshot.summary.partsPopulated}/{modelObserverSnapshot.summary.totalParts} Verdant Cognitive Parts ·{' '}
                        {modelObserverSnapshot.managersCount} VSM Managers ({modelObserverSnapshot.wasmManagersCount} Engine +{' '}
                        {modelObserverSnapshot.frontiersManagersCount} Frontiers)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onRunAutomate && (
                        <button
                          type="button"
                          data-testid="run-automate-btn"
                          disabled={Boolean(refiningWorldModel)}
                          onClick={() => onRunAutomate()}
                          className="px-3.5 py-2 rounded-sm border border-[#7ad4f7]/65 bg-[#7ad4f7]/16 hover:bg-[#7ad4f7]/26 text-[#d9f3ff] text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {refiningWorldModel ? 'Automating…' : 'Run Verdant Automate'}
                        </button>
                      )}
                      {onRunRatchetCycle && (
                        <button
                          type="button"
                          data-testid="run-ratchet-btn"
                          disabled={Boolean(refiningWorldModel)}
                          onClick={() => onRunRatchetCycle()}
                          className="px-3.5 py-2 rounded-sm border border-[#66dc9d]/60 bg-[#66dc9d]/14 hover:bg-[#66dc9d]/24 text-[#c8f7dc] text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {refiningWorldModel ? 'Running Ratchet…' : 'Run Ratchet Cycle'}
                        </button>
                      )}
                      {onRefineWorldModel && (
                        <button
                          type="button"
                          data-testid="uniform-refine-btn"
                          disabled={Boolean(refiningWorldModel)}
                          onClick={() => onRefineWorldModel(4)}
                          className="px-3.5 py-2 rounded-sm border border-[#d4a253]/70 bg-[#d4a253]/18 hover:bg-[#d4a253]/28 text-[#f5dfb0] text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {refiningWorldModel
                            ? 'Refining…'
                            : modelObserverSnapshot.summary.resolutionTier < 4
                              ? 'Refine to Tier 4'
                              : 'Sovereign Pass'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* M16/M17 Lifecycle Gate, Constructive Health Score & Monotonic Watermark Bar */}
                  <div
                    data-testid="codex-lifecycle-gate-bar"
                    className="rounded-sm bg-[#0f141b] border border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        data-testid="codex-lifecycle-gate-badge"
                        className={`font-mono font-semibold ${
                          modelObserverSnapshot.lifecycleGatePassed
                            ? 'text-[#66dc9d]'
                            : 'text-[#f28749]'
                        }`}
                      >
                        Lifecycle Gate {modelObserverSnapshot.lifecycleChecksPassed}/
                        {modelObserverSnapshot.lifecycleChecksTotal}
                      </span>
                      <span className="text-[#8d99a8]">·</span>
                      <span className="font-mono text-[#7ad4f7] tabular-nums">
                        Refinement Score{' '}
                        {modelObserverSnapshot.overallRefinementScorePermille}‰
                      </span>
                      <span className="text-[#8d99a8]">·</span>
                      <span className="font-mono text-[#c2ccd8] tabular-nums">
                        Watermarks: Div ≥{modelObserverSnapshot.watermarks.minDiversityIndex} · Coh ≥
                        {modelObserverSnapshot.watermarks.minCohesionIndex} · Def ≥
                        {modelObserverSnapshot.watermarks.minDefinitionScore}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#8e9aa9]">
                      {modelObserverSnapshot.watermarks.spec}
                    </span>
                  </div>

                  {/* Summary Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Cohesion KPI</p>
                      <p className="font-mono text-lg font-bold text-[#7ad4f7] tabular-nums mt-0.5">
                        {modelObserverSnapshot.kpis.cohesionIndex}
                        <span className="text-xs text-[#8d99a8] font-normal">/100</span>
                      </p>
                    </div>
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Diversity KPI</p>
                      <p className="font-mono text-lg font-bold text-[#66dc9d] tabular-nums mt-0.5">
                        {modelObserverSnapshot.kpis.diversityIndex}
                        <span className="text-xs text-[#8d99a8] font-normal">/100</span>
                      </p>
                    </div>
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Definition</p>
                      <p className="font-mono text-lg font-bold text-[#e8c468] tabular-nums mt-0.5">
                        {modelObserverSnapshot.summary.definitionScore}
                        <span className="text-xs text-[#8d99a8] font-normal">/100</span>
                      </p>
                    </div>
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Graph Links</p>
                      <p
                        data-testid="codex-graph-edge-count"
                        className="font-mono text-lg font-bold text-[#a9c7ff] tabular-nums mt-0.5"
                      >
                        {modelObserverSnapshot.graphEdgeCount}
                        <span className="text-[10px] text-[#8d99a8] font-normal ml-1">
                          ({modelObserverSnapshot.crossPartEdgeCount} x-part)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Clones</p>
                      <p className="font-mono text-lg font-bold text-[#f3efe6] tabular-nums mt-0.5">
                        {modelObserverSnapshot.kpis.clonePairsTotal}
                        <span className="text-xs text-[#66dc9d] font-normal ml-1.5">
                          {modelObserverSnapshot.kpis.clonePairsTotal === 0 ? 'Bespoke' : 'Needs Pass'}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-sm bg-[#0f141b] border border-white/10 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d99a8]">Root Seal</p>
                      <p
                        data-testid="codex-root-kappa"
                        className="font-mono text-[11px] text-[#c2ccd8] truncate mt-1.5"
                        title={modelObserverSnapshot.summary.kappaDigest}
                      >
                        {modelObserverSnapshot.summary.kappaDigest.slice(0, 14)}…
                      </p>
                    </div>
                  </div>

                  {/* 12 Diversity, Cohesion, Graph & vTensor KPI Gates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="codex-kpi-grid">
                    {modelObserverSnapshot.kpis.kpis.map((kpi) => (
                      <div
                        key={kpi.id}
                        className="rounded-sm bg-[#10151d] border border-white/8 px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#e6dfd1] truncate">{kpi.label}</p>
                          <p className="text-[11px] text-[#8e9aa9] truncate">{kpi.detail}</p>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                            kpi.passed ? 'text-[#66dc9d]' : 'text-[#f28749]'
                          }`}
                        >
                          {kpi.value}
                          {kpi.unit === '%' ? '%' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* M16 Observer Refinement Agenda */}
                  {observerAgenda && observerAgenda.proposals.length > 0 && (
                    <div className="rounded-sm bg-[#10151d] border border-white/10 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
                          Observer Refinement Agenda · {observerAgenda.proposals.length}{' '}
                          {observerAgenda.proposals.length === 1 ? 'Proposal' : 'Proposals'}
                        </p>
                        <span className="text-[10px] font-mono text-[#8e9aa9] tabular-nums">
                          {observerAgenda.criticalCount} critical · {observerAgenda.highCount} high
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {observerAgenda.proposals.slice(0, 4).map((prop) => (
                          <div
                            key={prop.proposalId}
                            className="rounded-sm bg-[#151b24] border border-white/8 px-2.5 py-2 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm border ${
                                    prop.priority === 'critical'
                                      ? 'border-[#f26b5b]/50 text-[#f7a298] bg-[#f26b5b]/12'
                                      : prop.priority === 'high'
                                        ? 'border-[#f2b349]/50 text-[#f6d08b] bg-[#f2b349]/12'
                                        : 'border-[#66dc9d]/40 text-[#9cecc0] bg-[#66dc9d]/10'
                                  }`}
                                >
                                  {prop.priority}
                                </span>
                                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm border border-white/12 text-[#b8c4d4]">
                                  {prop.vsmSystem}
                                </span>
                                <span className="font-mono text-[10px] text-[#8e9aa9] truncate">
                                  {prop.owningManagerId}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-[#e6dfd1] mt-1">{prop.title}</p>
                            </div>
                            <span className="font-mono text-[11px] tabular-nums text-[#d4a253] shrink-0">
                              {prop.currentValue} → {prop.targetValue}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* M16/M17 Pinpoint Observer Diagnoses (Click to jump straight into Model Inspector) */}
                      {observerAgenda.pinpointDiagnoses.length > 0 && (
                        <div className="pt-2 border-t border-white/8 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-[#7ad4f7] font-semibold">
                            Pinpoint Observer Diagnoses ({observerAgenda.pinpointDiagnoses.length})
                          </p>
                          <div className="space-y-1">
                            {observerAgenda.pinpointDiagnoses.slice(0, 3).map((diag) => (
                              <button
                                key={diag.diagnosisId}
                                type="button"
                                onClick={() => {
                                  setInspectedPart(diag.partSlot);
                                  setInspectedModelId(diag.modelId);
                                }}
                                className="w-full text-left rounded-sm bg-[#131922] hover:bg-[#192230] border border-white/8 hover:border-[#7ad4f7]/45 px-2.5 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-[#e6dfd1] truncate">
                                    <span className="font-mono text-[#7ad4f7] mr-1.5">
                                      [{diag.partSlot}]
                                    </span>
                                    {diag.modelTitle} — {diag.cause}
                                  </p>
                                  <p className="text-[10px] text-[#8e9aa9] truncate">
                                    {diag.recommendedAction}
                                  </p>
                                </div>
                                <span className="font-mono text-[10px] text-[#e8c468] shrink-0 tabular-nums">
                                  {diag.currentScore} → {diag.targetScore}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 21 VSM S1-S5 Managers Orchestration Strip */}
                  {observerManagers && observerManagers.length > 0 && (
                    <div className="rounded-sm bg-[#10151d] border border-white/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#9ca7b5] font-semibold">
                          VSM Manager Orchestration ({observerManagers.length} Managers · S1–S5)
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowManagers((v) => !v)}
                          className="text-[11px] font-mono text-[#d4a253] hover:text-[#f0c77c] cursor-pointer"
                        >
                          {showManagers ? 'Hide Roster' : 'Inspect Roster'}
                        </button>
                      </div>
                      {showManagers && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {observerManagers
                            .filter((m) => m.origin === 'frontiers-extension')
                            .map((mgr) => (
                              <div
                                key={mgr.managerId}
                                className="rounded-sm bg-[#151b24] border border-white/8 px-2.5 py-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[#e6dfd1] truncate">
                                    {mgr.name}
                                  </span>
                                  <span className="font-mono text-[9px] text-[#7ad4f7] shrink-0">
                                    {mgr.vsmSystem} · p={mgr.basisPrime}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#8e9aa9] truncate mt-0.5">
                                  {mgr.citedAuthority}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sealed Prism Refinement Audit Ledger */}
                  {modelObserverSnapshot.recentAuditEntries.length > 0 && (
                    <div
                      data-testid="codex-audit-ledger"
                      className="rounded-sm bg-[#10151d] border border-[#66dc9d]/30 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#66dc9d] font-semibold">
                          Sealed Prism Refinement Ledger ({modelObserverSnapshot.auditLedgerCount}{' '}
                          {modelObserverSnapshot.auditLedgerCount === 1 ? 'Pass' : 'Passes'})
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAuditLedger((v) => !v)}
                          className="text-[11px] font-mono text-[#66dc9d] hover:text-[#a9f5cd] cursor-pointer"
                        >
                          {showAuditLedger ? 'Collapse Ledger' : 'Inspect Seals'}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(showAuditLedger
                          ? modelObserverSnapshot.recentAuditEntries
                          : modelObserverSnapshot.recentAuditEntries.slice(0, 2)
                        ).map((entry) => (
                          <div
                            key={`${entry.passNumber}-${entry.nextKappaDigest}`}
                            className="rounded-sm bg-[#151b24] border border-white/8 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-[#d4a253] font-semibold mr-2">
                                Pass #{entry.passNumber}
                              </span>
                              <span className="text-[#e6dfd1]">{entry.scope}</span>
                              <span className="text-[#8e9aa9] ml-2">
                                ({entry.modelsRefined} models · {entry.graphEdgesVerified} links)
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[#7ad4f7] tabular-nums">
                              {entry.prevKappaDigest.slice(0, 10)} → {entry.nextKappaDigest.slice(0, 12)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 8 Canonical Verdant Cognitive Parts (Clickable for Live Sub-Model & Lineage Inspection) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modelObserverSnapshot.summary.parts.map((part) => {
                      const isSelected = inspectedPart === part.partSlot;
                      return (
                        <div
                          key={part.partSlot}
                          className={`rounded-sm bg-[#10151d] border p-2.5 flex items-center justify-between gap-2 transition-colors ${
                            isSelected ? 'border-[#7ad4f7]/65 bg-[#131c27]' : 'border-white/10'
                          }`}
                        >
                          <button
                            type="button"
                            data-testid={`inspect-part-${part.partSlot}`}
                            onClick={() => {
                              if (isSelected) {
                                setInspectedPart(null);
                                setInspectedModelId(null);
                              } else {
                                setInspectedPart(part.partSlot);
                                const firstModel = onInspectPartModels?.(part.partSlot)?.[0];
                                setInspectedModelId(firstModel?.modelId ?? null);
                              }
                            }}
                            className="min-w-0 text-left flex-1 cursor-pointer"
                          >
                            <p className="text-[10px] font-mono uppercase tracking-wider text-[#d4a253]">
                              {part.partSlot}
                            </p>
                            <p className="text-xs font-medium text-[#e6dfd1] truncate">{part.title}</p>
                            <p className="text-[11px] text-[#8e9aa9] mt-0.5 tabular-nums">
                              {part.modelCount} models · Tier {part.meanResolutionTier} · Def{' '}
                              {part.meanDefinitionScore} · {part.uniqueFeatureTokens} traits
                            </p>
                          </button>
                          {onRefineWorldModel && (
                            <button
                              type="button"
                              disabled={Boolean(refiningWorldModel)}
                              onClick={() => onRefineWorldModel(4, part.partSlot)}
                              className="shrink-0 px-2.5 py-1 rounded-sm border border-white/15 bg-white/5 hover:border-[#d4a253]/50 hover:text-[#f5dfb0] text-[11px] text-[#c2ccd8] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Refine
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Sub-Model, 8D vTensor Vector & Cross-Part Lineage Inspector */}
                  {inspectedPart && onInspectPartModels && (() => {
                    const partModels = onInspectPartModels(inspectedPart);
                    const activeModelId =
                      inspectedModelId && partModels.some((m) => m.modelId === inspectedModelId)
                        ? inspectedModelId
                        : (inspectedModelId ?? partModels[0]?.modelId ?? null);
                    const lineage =
                      activeModelId && onInspectModelLineage
                        ? onInspectModelLineage(activeModelId)
                        : null;
                    const activeModel = lineage?.model ?? partModels[0] ?? null;

                    return (
                      <div
                        data-testid="codex-model-inspector"
                        className="rounded-sm bg-[#0d1219] border border-[#7ad4f7]/40 p-3.5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-[#7ad4f7] font-semibold">
                              Model Graph &amp; Lineage Inspector · {inspectedPart} ({partModels.length})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedPart(null);
                              setInspectedModelId(null);
                            }}
                            className="text-[11px] font-mono text-[#9ca7b5] hover:text-[#f3efe6] cursor-pointer"
                          >
                            Close Inspector
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {/* Sub-model selector list */}
                          <div className="md:col-span-5 max-h-56 overflow-y-auto space-y-1 pr-1">
                            {partModels.slice(0, 24).map((m) => {
                              const selected = activeModel?.modelId === m.modelId;
                              return (
                                <button
                                  key={m.modelId}
                                  type="button"
                                  data-testid={`model-node-${m.modelId}`}
                                  onClick={() => setInspectedModelId(m.modelId)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-[#172331] border-[#7ad4f7]/60 text-[#f3efe6]'
                                      : 'bg-[#121822] border-white/8 hover:border-white/20 text-[#b8c4d4]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium truncate">{m.title}</span>
                                    <span className="font-mono text-[10px] text-[#e8c468] shrink-0 tabular-nums">
                                      T{m.resolutionTier} · {m.definitionScore}
                                    </span>
                                  </div>
                                  <p className="font-mono text-[10px] text-[#7d8a9a] truncate">
                                    {m.kind} · {m.modelId}
                                  </p>
                                </button>
                              );
                            })}
                          </div>

                          {/* Selected model details: 8D vTensor vector, genome & relational lineage */}
                          {activeModel && (
                            <div className="md:col-span-7 rounded-sm bg-[#131923] border border-white/10 p-3 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-mono text-[10px] text-[#d4a253] truncate">
                                    {activeModel.modelId} · v{activeModel.version}
                                  </p>
                                  <h3 className="font-display text-sm font-bold text-[#f3efe6]">
                                    {activeModel.title}
                                  </h3>
                                  <p className="text-[11px] text-[#8e9aa9] mt-0.5 truncate">
                                    Generator: {activeModel.generativeGenome.generator} · Seed #
                                    {activeModel.generativeGenome.seed.toString(16).slice(0, 8)}
                                  </p>
                                </div>
                                {onRefineWorldModel && (
                                  <button
                                    type="button"
                                    data-testid="refine-single-model-btn"
                                    disabled={Boolean(refiningWorldModel)}
                                    onClick={() => onRefineWorldModel(4, undefined, activeModel.modelId)}
                                    className="shrink-0 px-2.5 py-1 rounded-sm border border-[#d4a253]/60 bg-[#d4a253]/15 hover:bg-[#d4a253]/25 text-[#f5dfb0] text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Refine Model
                                  </button>
                                )}
                              </div>

                              {/* 8D vTensor Semantic Vector Profile */}
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.14em] text-[#9ca7b5] font-semibold mb-1.5">
                                  8D vTensor Semantic Vector
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                  {SEMANTIC_VECTOR_AXES.map((axis, idx) => {
                                    const val = activeModel.semanticVector[idx] ?? 0;
                                    const pct = Math.round(val * 100);
                                    return (
                                      <div
                                        key={axis}
                                        className="rounded-sm bg-[#0f141c] border border-white/8 px-2 py-1"
                                      >
                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className="text-[#9ca7b5] capitalize">{axis}</span>
                                          <span className="font-mono text-[#7ad4f7] tabular-nums">
                                            {val.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="mt-1 h-1 rounded-sm bg-white/10 overflow-hidden">
                                          <div
                                            className="h-full bg-[#7ad4f7]"
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Cross-Part Relational Lineage */}
                              {lineage && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/8">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#66dc9d] font-semibold mb-1">
                                      Dependencies ({lineage.upstream.length})
                                    </p>
                                    {lineage.upstream.length === 0 ? (
                                      <p className="text-[11px] text-[#7d8a9a]">Root leaf primitive</p>
                                    ) : (
                                      <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {lineage.upstream.slice(0, 8).map((u, idx) => (
                                          <button
                                            key={`${u.node.modelId}-${u.relation}-${idx}`}
                                            type="button"
                                            onClick={() => {
                                              if (u.node.partSlot !== 'root') {
                                                setInspectedPart(u.node.partSlot);
                                              }
                                              setInspectedModelId(u.node.modelId);
                                            }}
                                            className="w-full text-left text-[11px] px-2 py-1 rounded-sm bg-[#0f141c] hover:bg-[#182230] border border-white/8 flex items-center justify-between gap-2 cursor-pointer"
                                          >
                                            <span className="text-[#c8d4e3] truncate">
                                              {u.node.title}
                                            </span>
                                            <span className="font-mono text-[9px] text-[#66dc9d] shrink-0">
                                              {u.relation}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#d4a253] font-semibold mb-1">
                                      Dependents ({lineage.downstream.length})
                                    </p>
                                    {lineage.downstream.length === 0 ? (
                                      <p className="text-[11px] text-[#7d8a9a]">Terminal consumer</p>
                                    ) : (
                                      <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {lineage.downstream.slice(0, 8).map((d, idx) => (
                                          <button
                                            key={`${d.node.modelId}-${d.relation}-${idx}`}
                                            type="button"
                                            onClick={() => {
                                              if (d.node.partSlot !== 'root') {
                                                setInspectedPart(d.node.partSlot);
                                              }
                                              setInspectedModelId(d.node.modelId);
                                            }}
                                            className="w-full text-left text-[11px] px-2 py-1 rounded-sm bg-[#0f141c] hover:bg-[#182230] border border-white/8 flex items-center justify-between gap-2 cursor-pointer"
                                          >
                                            <span className="text-[#c8d4e3] truncate">
                                              {d.node.title}
                                            </span>
                                            <span className="font-mono text-[9px] text-[#d4a253] shrink-0">
                                              {d.relation}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <h2 className="font-display text-lg font-bold text-[#f3efe6]">
                  Codex of the Shattered Meridian
                </h2>
                <p className="text-xs text-[#9ca7b5] mt-0.5">
                  Overarching chronicle of Vaelmor’s geology, federated charters, and acoustic craft.
                  Explore each region to unlock all entries ({discoveredRegions.length}/{WORLD_REGIONS.length} regions discovered).
                </p>
              </div>

              <div className="space-y-4">
                {CODEX_ENTRIES.map((entry) => {
                  const unlocked = discoveredRegions.includes(entry.regionId) || entry.regionId === 'southern-terrace';
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-sm border overflow-hidden ${
                        unlocked
                          ? 'bg-[#161c25] border-[#d4a253]/30'
                          : 'bg-[#12161d] border-white/8 opacity-70'
                      }`}
                    >
                      {unlocked && entry.artUrl && (
                        <img
                          src={entry.artUrl}
                          alt={entry.title}
                          className="w-full h-44 object-cover border-b border-white/10"
                        />
                      )}
                      <div className="p-4">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
                          {entry.eraLabel}
                        </p>
                        <h3 className="font-display text-sm font-bold text-[#f3efe6] mt-0.5">
                          {unlocked ? entry.title : 'Undiscovered Frontier Record'}
                        </h3>
                        <p className="text-xs text-[#c2ccd8] leading-relaxed mt-2">
                          {unlocked
                            ? entry.body
                            : 'Travel to this region of Vaelmor to uncover its structural history.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
