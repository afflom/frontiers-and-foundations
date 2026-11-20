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
} from '../../game/multiplayerTypes';

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

export type AtlasTab = 'chronicle' | 'map' | 'dungeons' | 'forge' | 'guilds' | 'codex';

interface JournalMapModalProps {
  initialTab: AtlasTab;
  quests: GameQuest[];
  trackedQuestId: string;
  npcs: GameNpc[];
  guilds: GuildCharter[];
  pledgedGuildId: string;
  banners: FoundationBanner[];
  remotePlayers: RemotePlayerState[];
  materials: CraftingMaterials;
  gearTiers: GearUpgradeTiers;
  relics: EquippedRelic[];
  discoveredRegions: RegionId[];
  playerX: number;
  playerZ: number;
  playerYaw: number;
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
  onUpgradeGear: (gearId: GearSlotId) => void;
  onToggleRelic: (relicId: string) => void;
  onForgeEmergentRelic: () => void;
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
  banners,
  remotePlayers,
  materials,
  gearTiers,
  relics,
  discoveredRegions,
  playerX,
  playerZ,
  playerYaw,
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
  onUpgradeGear,
  onToggleRelic,
  onForgeEmergentRelic,
  onClose,
}) => {
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [tab, setTab] = useState<AtlasTab>(initialTab);
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
                ['guilds', 'Guilds'],
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
                    Track chartered quests across Vaelmor or seek fresh emergent frontier rumors.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={seekingRumor}
                  onClick={onSeekEmergentQuest}
                  className="px-4 py-2 rounded-sm bg-[#5ea38c] hover:bg-[#6eb59e] disabled:opacity-50 text-[#0e1513] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                >
                  {seekingRumor ? 'Consulting Waystones...' : 'Seek Frontier Rumor'}
                </button>
              </div>

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

                    {/* Live Remote Multiplayer Waywrights */}
                    {remotePlayers.map((rp) => (
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

                    {/* Foundation Banners */}
                    {banners.map((b) => (
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
                    <span className="w-2.5 h-2.5 rounded-full bg-[#78d5f5] inline-block" /> Live Allies ({remotePlayers.length})
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
                  return (
                    <div
                      key={gear.id}
                      className="p-4 rounded-sm bg-[#161c25] border border-white/10 flex flex-col justify-between gap-3"
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
                  {relics.map((r) => (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-sm border flex items-start justify-between gap-3 ${
                        r.equipped
                          ? 'bg-[#1a222b] border-[#d4a253]/55'
                          : 'bg-[#151b23] border-white/10'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#5ea38c] font-semibold">
                          {r.origin}
                        </p>
                        <h4 className="font-display text-xs font-bold text-[#f3efe6] mt-0.5">
                          {r.name}
                        </h4>
                        <p className="text-[11px] text-[#aeb9c6] mt-1">{r.description}</p>
                        <p className="font-mono text-[11px] text-[#e8c374] mt-1.5">
                          {formatRelicBonus(r)}
                        </p>
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
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'guilds' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-[#f3efe6]">
                  Federated Frontier Guilds
                </h2>
                <p className="text-xs text-[#9ca7b5] mt-0.5">
                  Pledge allegiance and raise Foundation Banners with your Brass Way-Compass [4].
                  Guild prosperity and banners sync live across all connected Waywrights.
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
            <div className="space-y-4">
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
