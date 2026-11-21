import React, { useEffect, useRef, useState } from 'react';
import { GEAR_LOADOUT, type GameQuest, type GearSlotId } from '../../game/worldData';
import type { HudSnapshot } from '../../game/vaelmorRenderer';
import type {
  GearUpgradeTiers,
  PartySummon,
  RemotePlayerState,
  WorldChatMessage,
  WorldPing,
  WorldPingKind,
} from '../../game/multiplayerTypes';
import type { FrontiersRealmSpec } from '../../verdant/realmModelSchema';
import type { JourneyProgressSummary } from '../../verdant/verdantJourneyModel';

export interface CombatCallout {
  id: number;
  text: string;
  tone: 'damage' | 'heavy' | 'heal' | 'gold';
}

interface GameHudProps {
  hud: HudSnapshot;
  activeRealm?: FrontiersRealmSpec;
  renown: number;
  trackedQuest: GameQuest | null;
  gearTiers: GearUpgradeTiers;
  onlineCount: number;
  roomCode: string;
  realmConnected: boolean;
  remotePlayers: RemotePlayerState[];
  worldPings: WorldPing[];
  activeSummon: PartySummon | null;
  chatMessages: WorldChatMessage[];
  chatOpen: boolean;
  callouts: CombatCallout[];
  muted: boolean;
  activeTrackTitle?: string;
  toastMessage: string | null;
  frontierBanner?: {
    name: string;
    subtitle: string;
    cell: [number, number, number];
  } | null;
  journeySummary?: JourneyProgressSummary | null;
  playerCharacterSummary?: {
    name: string;
    speciesName: string;
    className: string;
    level: number;
    evolutionTitle: string;
    unspentPoints: number;
  };
  guideDismissed?: boolean;
  onDismissGuide?: () => void;
  onReplayPrologue?: () => void;
  onOpenCharacter?: () => void;
  onActivateGear: (gear: GearSlotId) => void;
  onTriggerAction: () => void;
  onTriggerDodge: () => void;
  onNextTrack?: () => void;
  onOpenJournal: () => void;
  onOpenMap: () => void;
  onOpenDungeons?: () => void;
  onOpenForge: () => void;
  onOpenParty: () => void;
  onDropPing: (kind?: WorldPingKind, label?: string) => void;
  onWarpToAlly: (ally: RemotePlayerState) => void;
  onAcceptSummon: (summon: PartySummon) => void;
  onDismissSummon: () => void;
  onToggleChat: () => void;
  onSendChat: (text: string) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onTriggerInteract: () => void;
}

function GearSvgIcon({ gearId, active }: { gearId: GearSlotId; active: boolean }) {
  const stroke = active ? '#14110b' : '#e6decb';
  if (gearId === 'hookblade') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 19L15 9C17.5 6.5 19 4 19 4C19 4 20 8.5 17 11.5L13 15.5"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4 16L8 20" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (gearId === 'bellhammer') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19L14 10" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M11 6L18 13L20.5 10.5C19 7.5 16.5 5 13.5 3.5L11 6Z"
          stroke={stroke}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <circle cx="17.5" cy="6.5" r="1.4" fill={active ? '#14110b' : '#d4a253'} />
      </svg>
    );
  }
  if (gearId === 'lantern') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5H15M10 19H14" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="7" y="8" width="10" height="9" rx="2" stroke={stroke} strokeWidth="1.8" />
        <polygon points="12,10 14,12.5 12,15 10,12.5" fill={active ? '#14110b' : '#5ea38c'} />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.8" />
      <polygon points="12,6 14.5,12 12,18 9.5,12" fill={active ? '#14110b' : '#d4a253'} />
    </svg>
  );
}

const COMPASS_MARKS: Array<{ label: string; angle: number }> = [
  { label: 'N', angle: Math.PI },
  { label: 'NE', angle: Math.PI * 0.75 },
  { label: 'E', angle: Math.PI * 0.5 },
  { label: 'SE', angle: Math.PI * 0.25 },
  { label: 'S', angle: 0 },
  { label: 'SW', angle: -Math.PI * 0.25 },
  { label: 'W', angle: -Math.PI * 0.5 },
  { label: 'NW', angle: -Math.PI * 0.75 },
];

function wrapAngleDiff(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  activeRealm,
  renown,
  trackedQuest,
  gearTiers,
  onlineCount,
  roomCode,
  realmConnected,
  remotePlayers,
  worldPings,
  activeSummon,
  chatMessages,
  chatOpen,
  callouts,
  muted,
  activeTrackTitle,
  toastMessage,
  frontierBanner,
  journeySummary,
  playerCharacterSummary,
  guideDismissed = false,
  onDismissGuide,
  onReplayPrologue,
  onOpenCharacter,
  onActivateGear,
  onTriggerAction,
  onTriggerDodge,
  onNextTrack,
  onOpenJournal,
  onOpenMap,
  onOpenDungeons,
  onOpenForge,
  onOpenParty,
  onDropPing,
  onWarpToAlly,
  onAcceptSummon,
  onDismissSummon,
  onToggleChat,
  onSendChat,
  onToggleMute,
  onPause,
  onTriggerInteract,
}) => {
  const [ghostHp, setGhostHp] = useState(hud.hp);
  const [chatDraft, setChatDraft] = useState('');
  const ghostTimerRef = useRef<number | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (chatOpen) {
      window.setTimeout(() => chatInputRef.current?.focus(), 30);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (hud.hp >= ghostHp) {
      setGhostHp(hud.hp);
      return;
    }
    if (ghostTimerRef.current !== null) {
      window.clearTimeout(ghostTimerRef.current);
    }
    ghostTimerRef.current = window.setTimeout(() => {
      setGhostHp(hud.hp);
    }, 360);
    return () => {
      if (ghostTimerRef.current !== null) window.clearTimeout(ghostTimerRef.current);
    };
  }, [hud.hp, ghostHp]);

  const hpPct = Math.max(0, Math.min(100, Math.round((hud.hp / Math.max(1, hud.maxHp)) * 100)));
  const ghostPct = Math.max(hpPct, Math.min(100, Math.round((ghostHp / Math.max(1, hud.maxHp)) * 100)));
  const stamPct = Math.max(0, Math.min(100, Math.round((hud.stamina / Math.max(1, hud.maxStamina)) * 100)));

  const activeObjective = trackedQuest?.objectives.find((o) => o.currentCount < o.requiredCount) ?? null;
  const distToObjective = activeObjective
    ? Math.round(
        Math.hypot(
          activeObjective.targetCoords[0] - hud.playerX,
          activeObjective.targetCoords[1] - hud.playerZ,
        ),
      )
    : null;

  const objAngle = activeObjective
    ? Math.atan2(
        activeObjective.targetCoords[0] - hud.playerX,
        activeObjective.targetCoords[1] - hud.playerZ,
      )
    : null;
  const objRel = objAngle !== null ? wrapAngleDiff(objAngle, hud.playerYaw) : null;
  const objPct = objRel !== null ? Math.max(4, Math.min(96, 50 - (objRel / (Math.PI * 0.65)) * 50)) : null;

  const activeGearDef = GEAR_LOADOUT.find((g) => g.id === hud.activeGear) ?? GEAR_LOADOUT[0];
  const activeTier = gearTiers[activeGearDef.id] ?? 1;
  const primaryEnemy = hud.nearbyEnemies[0] ?? null;
  const activeSlug = activeRealm?.slug ?? 'vaelmor';
  const sameRealmAllies = remotePlayers.filter((rp) => (rp.realmSlug || 'vaelmor') === activeSlug);
  const sameRealmPings = worldPings.filter((p) => p.realmSlug === activeSlug && p.expiresAt > Date.now());
  const visibleProjectedAllies = (hud.projectedAllies ?? []).filter((a) => a.visible);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* 3D World-Projected Floating Ally Nameplates & Mini Vitality Bars */}
      {visibleProjectedAllies.map((ally) => {
        const allyHpPct = Math.max(0, Math.min(100, Math.round((ally.hp / Math.max(1, ally.maxHp)) * 100)));
        return (
          <div
            key={ally.id}
            data-testid={`ally-nameplate-${ally.id}`}
            className="fixed -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center gap-0.5"
            style={{
              left: `${Math.round(ally.screenX)}px`,
              top: `${Math.round(ally.screenY)}px`,
            }}
          >
            <div className="px-2 py-0.5 rounded-[2px] bg-[#0e141c]/88 border border-[#52d6f4]/45 shadow-[0_3px_10px_rgba(0,0,0,0.65)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52d6f4]" />
              <span className="font-display text-[10px] font-bold tracking-[0.06em] text-[#e8f8fd] whitespace-nowrap">
                {ally.name}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-[#8ec8dc]">{ally.distance}m</span>
            </div>
            <div className="w-16 h-1 bg-[#121922] rounded-[1px] overflow-hidden border border-white/15">
              <div
                className={`h-full ${allyHpPct <= 35 ? 'bg-[#e06658]' : 'bg-[#5ea38c]'}`}
                style={{ width: `${allyHpPct}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Subtle low-health peripheral warning vignette */}
      {hud.hp <= 30 && hud.hp > 0 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 110px 26px rgba(186, 46, 46, 0.42)',
          }}
        />
      )}

      {/* TOP-LEFT: Vitality, Stamina, Region & Renown */}
      <div className="fixed top-4 left-4 sm:top-5 sm:left-5 flex flex-col gap-2 w-[264px]">
        <div className="bg-[#11151b]/90 border border-[#d4a253]/30 rounded-sm px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.48)]">
          {playerCharacterSummary && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-character-summary"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCharacter?.();
              }}
              className="pointer-events-auto mb-2 pb-1.5 w-full border-b border-white/10 flex items-center justify-between gap-2 text-left cursor-pointer group"
              title="Open Character Sheet & Live Customization Atelier (K)"
            >
              <div className="min-w-0">
                <p className="font-display text-[11px] font-bold text-[#f3efe6] group-hover:text-[#f0c778] truncate">
                  {playerCharacterSummary.name}
                </p>
                <p className="text-[10px] text-[#9eb2c6] truncate tabular-nums">
                  Lv.{playerCharacterSummary.level} · {playerCharacterSummary.speciesName} ·{' '}
                  {playerCharacterSummary.className}
                </p>
              </div>
              {playerCharacterSummary.unspentPoints > 0 && (
                <span className="shrink-0 font-mono text-[10px] font-bold text-[#f0c778] tabular-nums">
                  +{playerCharacterSummary.unspentPoints} pt
                </span>
              )}
            </button>
          )}
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <polygon
                  points="8,1 14,5 12,14 4,14 2,5"
                  fill="#d4a253"
                  fillOpacity="0.22"
                  stroke="#d4a253"
                  strokeWidth="1.2"
                />
                <circle cx="8" cy="8" r="2.2" fill="#d4a253" />
              </svg>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[#d8cfc0] font-semibold">
                Vitality
              </span>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#f0ebe1]">
              {Math.round(hud.hp)} / {hud.maxHp}
            </span>
          </div>

          <div className="relative h-2.5 w-full bg-[#1e2530] rounded-[2px] overflow-hidden border border-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-[#f0c778]/75 transition-all duration-500"
              style={{ width: `${ghostPct}%` }}
            />
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-150 ${
                hpPct <= 30 ? 'bg-[#d9534f]' : 'bg-[#c9624c]'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-[#1e2530] rounded-[2px] overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.waterPosture === 'swimming' ? 'bg-[#52c7e0]' : 'bg-[#5ea38c]'
                }`}
                style={{ width: `${stamPct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] tabular-nums text-[#96b8aa] w-7 text-right">
              {Math.round(hud.stamina)}
            </span>
          </div>
          {hud.waterPosture && hud.waterPosture !== 'dry' && (
            <div
              data-testid="water-posture-indicator"
              className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[#7ad8eb] border-t border-white/8 pt-1"
            >
              <span>{hud.waterPosture === 'swimming' ? 'Swimming' : 'Wading'}</span>
              <span className="font-mono text-[9px] text-[#9ecad4]">
                {hud.waterPosture === 'swimming' ? 'Space: Breach · Shift: Surge' : 'Water Drag'}
              </span>
            </div>
          )}
        </div>

        {/* Region + Renown */}
        <div className="bg-[#11151b]/86 border border-white/12 rounded-sm px-3.5 py-2 flex items-center justify-between gap-3 shadow-[0_6px_18px_rgba(0,0,0,0.4)]">
          <div className="min-w-0">
            {activeRealm?.isDungeon ? (
              <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#52d6f4] font-semibold">
                Tier {activeRealm.dungeonTier ?? 1} · 3D Dungeon Delve
              </p>
            ) : activeRealm ? (
              <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#7fd1b6] font-semibold truncate">
                {activeRealm.name} · Cell ({activeRealm.cell[0]}, {activeRealm.cell[2]})
              </p>
            ) : null}
            <p className="font-display text-xs font-bold tracking-[0.06em] text-[#ece8df] truncate">
              {hud.region.name}
            </p>
            <p className="text-[10px] text-[#9aa5b3] truncate">{hud.region.subtitle}</p>
            {hud.ecosystemBadge && (
              <p
                data-testid="ecosystem-phenomenon-badge"
                title={hud.ecosystemBadge.summary}
                className="mt-1 pt-1 border-t border-white/8 text-[9px] font-mono uppercase tracking-[0.1em] text-[#e0b86c] truncate"
              >
                {hud.ecosystemBadge.title}
              </p>
            )}
          </div>
          <div className="shrink-0 pl-2.5 border-l border-white/12 text-right">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#d4a253]">Renown</p>
            <p className="font-mono text-xs font-bold tabular-nums text-[#f2e8d2]">{renown}</p>
          </div>
        </div>

        {/* Compact Co-op Party Frames (rendered only when fellow Waywrights are connected) */}
        {remotePlayers.length > 0 && (
          <div
            data-testid="hud-party-frames"
            className="pointer-events-auto bg-[#11151b]/88 border border-[#52d6f4]/28 rounded-sm px-2.5 py-2 space-y-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.44)]"
          >
            <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-[#7ed9ee]">
              <span>Fellowship ({remotePlayers.length})</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenParty();
                }}
                className="text-[#d4a253] hover:text-[#f0c778] cursor-pointer"
              >
                Manage [U]
              </button>
            </div>
            {remotePlayers.slice(0, 4).map((ally) => {
              const inSameRealm = (ally.realmSlug || 'vaelmor') === activeSlug;
              const dist = Math.round(Math.hypot(ally.x - hud.playerX, ally.z - hud.playerZ));
              const allyHp = ally.hp ?? 100;
              const allyMaxHp = Math.max(1, ally.maxHp ?? 100);
              const allyPct = Math.max(0, Math.min(100, Math.round((allyHp / allyMaxHp) * 100)));
              return (
                <div
                  key={ally.id}
                  data-testid={`party-frame-${ally.id}`}
                  className="bg-[#161c24] border border-white/8 rounded-[2px] px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          inSameRealm ? 'bg-[#52d6f4]' : 'bg-[#d4a253]'
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-[#edf2f7] truncate">
                        {ally.name}
                      </span>
                    </div>
                    {inSameRealm ? (
                      <span className="font-mono text-[9px] tabular-nums text-[#8ec8dc] shrink-0">
                        {dist}m
                      </span>
                    ) : (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onWarpToAlly(ally);
                        }}
                        title={`Warp to ${ally.name} in ${ally.realmName || ally.realmSlug}`}
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#d4a253]/20 hover:bg-[#d4a253]/35 border border-[#d4a253]/45 text-[9px] font-mono font-bold uppercase text-[#f0cd80] cursor-pointer shrink-0"
                      >
                        Warp
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1 flex-1 bg-[#222a35] rounded-[1px] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          allyPct <= 35 ? 'bg-[#d9534f]' : 'bg-[#5ea38c]'
                        }`}
                        style={{ width: `${allyPct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] tabular-nums text-[#9eb0c0] truncate max-w-[110px]">
                      {inSameRealm ? `${allyHp}/${allyMaxHp}` : ally.realmName || ally.realmSlug}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP-CENTER: Waywright Compass Ribbon & Engaged Enemy Vitality */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[300px] sm:w-[350px]">
        <div className="relative w-full h-7 bg-[#11151b]/84 border border-[#d4a253]/28 rounded-sm overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
          {COMPASS_MARKS.map((m) => {
            const diff = wrapAngleDiff(m.angle, hud.playerYaw);
            if (Math.abs(diff) > Math.PI * 0.62) return null;
            const leftPct = 50 - (diff / (Math.PI * 0.65)) * 50;
            const isMajor = m.label.length === 1;
            return (
              <span
                key={m.label}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 font-display ${
                  isMajor ? 'text-[11px] font-bold text-[#ece8df]' : 'text-[9px] text-[#8f9ba8]'
                }`}
                style={{ left: `${leftPct}%` }}
              >
                {m.label}
              </span>
            );
          })}
          {objPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${objPct}%` }}
              title="Tracked Charter Direction"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <polygon points="6,1 11,6 6,11 1,6" fill="#d4a253" stroke="#11151b" strokeWidth="1" />
              </svg>
            </div>
          )}
          {/* Same-Realm Ally Directional Pips on Compass */}
          {sameRealmAllies.map((ally) => {
            const angle = Math.atan2(ally.x - hud.playerX, ally.z - hud.playerZ);
            const rel = wrapAngleDiff(angle, hud.playerYaw);
            const pct = Math.max(4, Math.min(96, 50 - (rel / (Math.PI * 0.65)) * 50));
            return (
              <div
                key={`cmp-${ally.id}`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${pct}%` }}
                title={`Ally: ${ally.name}`}
              >
                <span className="block w-2 h-2 rounded-full bg-[#52d6f4] border border-[#0d1116]" />
              </div>
            );
          })}
          {/* Active World Ping Pips on Compass */}
          {sameRealmPings.map((ping) => {
            const angle = Math.atan2(ping.x - hud.playerX, ping.z - hud.playerZ);
            const rel = wrapAngleDiff(angle, hud.playerYaw);
            const pct = Math.max(4, Math.min(96, 50 - (rel / (Math.PI * 0.65)) * 50));
            const color =
              ping.kind === 'danger' ? '#f2604b' : ping.kind === 'loot' ? '#f2c96b' : '#52d6f4';
            return (
              <div
                key={`cmp-ping-${ping.id}`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${pct}%` }}
                title={`${ping.senderName}: ${ping.label}`}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <polygon points="6,1 11,10 1,10" fill={color} stroke="#0d1116" strokeWidth="1" />
                </svg>
              </div>
            );
          })}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 bg-[#d4a253]" />
        </div>

        {primaryEnemy &&
          (primaryEnemy.archetype === 'colossus' ? (
            <div
              data-testid="boss-vitality-bar"
              className={`w-[360px] sm:w-[430px] bg-[#11141a]/94 rounded-sm px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.62)] border ${
                primaryEnemy.phase2 ? 'border-[#f07638]/75' : 'border-[#d4a253]/55'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs font-bold tracking-[0.08em] uppercase text-[#f6efe2] truncate">
                      {primaryEnemy.name}
                    </span>
                    {primaryEnemy.phase2 && (
                      <span
                        data-testid="boss-phase2-badge"
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#d95226]/30 border border-[#f28444]/60 text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-[#ffbc8a]"
                      >
                        Phase II
                      </span>
                    )}
                  </div>
                  {(primaryEnemy.bossTitle || primaryEnemy.signatureMove) && (
                    <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#c7b391] truncate">
                      {primaryEnemy.bossTitle}
                      {primaryEnemy.signatureMove ? ` · ${primaryEnemy.signatureMove}` : ''}
                    </p>
                  )}
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#f0cb8b] shrink-0">
                  {primaryEnemy.hp} / {primaryEnemy.maxHp}
                </span>
              </div>
              <div className="relative h-2.5 bg-[#221918] rounded-[2px] overflow-hidden border border-white/12">
                <div
                  className={`h-full transition-all duration-150 ${
                    primaryEnemy.phase2
                      ? 'bg-gradient-to-r from-[#d94826] via-[#f07638] to-[#f4ba54]'
                      : 'bg-gradient-to-r from-[#b84e34] to-[#e0894c]'
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round((primaryEnemy.hp / primaryEnemy.maxHp) * 100)))}%`,
                  }}
                />
                {/* 50% Phase-II Awakening threshold notch */}
                <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-[#f5e7c8]/65 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#12161c]/92 border border-[#d98657]/45 rounded-sm px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-semibold tracking-[0.06em] text-[#f3e6d6]">
                  {primaryEnemy.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-[#e6ad83]">
                  {primaryEnemy.hp} / {primaryEnemy.maxHp}
                </span>
              </div>
              <div className="h-2 bg-[#231d1c] rounded-[2px] overflow-hidden border border-white/10">
                <div
                  className="h-full bg-[#d96b43] transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round((primaryEnemy.hp / primaryEnemy.maxHp) * 100)))}%`,
                  }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* TOP-RIGHT: Utility Actions & Active Charter Tracker */}
      <div className="fixed top-4 right-4 sm:top-5 sm:right-5 flex flex-col items-end gap-2.5 max-w-[310px]">
        <div className="pointer-events-auto flex items-center gap-1.5">
          {onOpenCharacter && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-character-btn"
              title="Character Sheet & Live Customization Atelier (K)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCharacter();
              }}
              className="relative h-9 px-2.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#d4a253]/45 text-[#ece8df] text-[11px] font-semibold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5.2" r="2.6" stroke="#d4a253" strokeWidth="1.3" />
                <path d="M3 13.5C3.4 10.6 5.4 9.2 8 9.2C10.6 9.2 12.6 10.6 13 13.5" stroke="#ece8df" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span>K</span>
              {(playerCharacterSummary?.unspentPoints ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f0c778] border border-[#11151b]" />
              )}
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            title="Chronicle & Quests (J)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenJournal();
            }}
            className="h-9 px-2.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#d4a253]/30 text-[#ece8df] text-[11px] font-semibold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 2.5H12.5V13.5H3V2.5Z" stroke="#d4a253" strokeWidth="1.3" />
              <path d="M5.5 5.5H10M5.5 8H10M5.5 10.5H8.5" stroke="#ece8df" strokeWidth="1.2" />
            </svg>
            <span>J</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            title="World Map & Waystones (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMap();
            }}
            className="h-9 px-2.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#d4a253]/30 text-[#ece8df] text-[11px] font-semibold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4L6 2.5L10 4L14 2.5V12L10 13.5L6 12L2 13.5V4Z" stroke="#5ea38c" strokeWidth="1.3" />
            </svg>
            <span>M</span>
          </button>

          {onOpenDungeons && (
            <button
              type="button"
              tabIndex={-1}
              title="Dungeons, Delves & Score (V)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenDungeons();
              }}
              className="h-9 px-2.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#52d6f4]/35 text-[#ece8df] text-[11px] font-semibold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 13V7C3 4.2 5.2 2 8 2C10.8 2 13 4.2 13 7V13H3Z" stroke="#52d6f4" strokeWidth="1.3" />
                <path d="M6.5 13V8.5C6.5 7.7 7.2 7 8 7C8.8 7 9.5 7.7 9.5 8.5V13" stroke="#d4a253" strokeWidth="1.2" />
              </svg>
              <span>V</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            title="Gear, Relics & Forge (I)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenForge();
            }}
            className="h-9 px-2.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#d4a253]/30 text-[#ece8df] text-[11px] font-semibold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 12.5L8.5 7M10 3L13 6L11 8L8 5L10 3Z" stroke="#e09f5a" strokeWidth="1.3" />
            </svg>
            <span>I</span>
          </button>

          {onNextTrack && (
            <button
              type="button"
              tabIndex={-1}
              data-action="next-track"
              title={
                activeTrackTitle
                  ? `Now Playing: ${activeTrackTitle} — Click for Next Song`
                  : 'Next Soundtrack Movement'
              }
              onClick={(e) => {
                e.currentTarget.blur();
                onNextTrack();
              }}
              className="h-9 w-9 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-[#d4a253]/28 text-[#ece8df] inline-flex items-center justify-center shadow-md cursor-pointer"
              aria-label="Next soundtrack song"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4L9 8L3 12V4Z" fill="#d4a253" />
                <rect x="11" y="4" width="2" height="8" fill="#ece8df" />
              </svg>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            title={muted ? 'Unmute Audio (N)' : 'Mute Audio (N)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="h-9 w-9 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-white/15 text-[#ece8df] inline-flex items-center justify-center shadow-md cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 6H6L9.5 3V13L6 10H3V6Z" stroke="#9aa5b3" strokeWidth="1.3" />
                <path d="M11.5 6L14.5 10M14.5 6L11.5 10" stroke="#d96b6b" strokeWidth="1.4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 6H6L9.5 3V13L6 10H3V6Z" stroke="#d4a253" strokeWidth="1.3" />
                <path d="M12 5.5C13.2 6.8 13.2 9.2 12 10.5" stroke="#ece8df" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            title="Pause Menu (Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="h-9 w-9 rounded-sm bg-[#11151b]/90 hover:bg-[#1d242e] border border-white/15 text-[#ece8df] inline-flex items-center justify-center shadow-md cursor-pointer"
            aria-label="Pause game"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="4" y="3" width="2.8" height="10" fill="#ece8df" />
              <rect x="9.2" y="3" width="2.8" height="10" fill="#ece8df" />
            </svg>
          </button>
        </div>

        {trackedQuest && (
          <div className="w-full bg-[#11151b]/88 border-r-2 border-r-[#d4a253] border-y border-l border-white/12 rounded-sm px-3.5 py-2.5 text-right shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
              Active Charter
            </p>
            <p className="font-display text-xs font-bold text-[#f2eee6] mt-0.5">
              {trackedQuest.title}
            </p>
            {activeObjective ? (
              <div className="mt-1.5 text-[11px] text-[#c7d0dc] leading-snug">
                <span>{activeObjective.description}</span>
                <div className="mt-1 flex items-center justify-end gap-2 font-mono text-[10px] tabular-nums">
                  {activeObjective.requiredCount > 1 && (
                    <span className="text-[#5ea38c] font-semibold">
                      {activeObjective.currentCount}/{activeObjective.requiredCount}
                    </span>
                  )}
                  {distToObjective !== null && (
                    <span className="text-[#d4a253]">{distToObjective}m away</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[#5ea38c] font-medium">All objectives complete</p>
            )}
          </div>
        )}

        {/* Compact, Dismissible Waywright Field Guide (Directed Journey Milestone) */}
        {journeySummary?.activeMilestone && !guideDismissed && (
          <div
            data-testid="hud-journey-guide"
            className="pointer-events-auto w-full bg-[#10151d]/90 border border-[#5ea38c]/35 rounded-sm px-3.5 py-2.5 text-left shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7fd1b6] font-semibold">
                Field Guide · Step {journeySummary.activeMilestone.stepNumber}/{journeySummary.totalCount}
              </span>
              <div className="flex items-center gap-2">
                {onReplayPrologue && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onReplayPrologue();
                    }}
                    className="text-[10px] font-mono text-[#d4a253] hover:text-[#f0cd80] cursor-pointer"
                    title="Replay 5-Act Narrated Prologue"
                  >
                    Prologue
                  </button>
                )}
                {onDismissGuide && (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="dismiss-journey-guide-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onDismissGuide();
                    }}
                    className="text-[10px] font-mono text-[#8f9cab] hover:text-[#f3efe6] cursor-pointer"
                    aria-label="Hide Field Guide"
                  >
                    Hide
                  </button>
                )}
              </div>
            </div>
            <p className="font-display text-xs font-bold text-[#f2eee6] mt-1">
              {journeySummary.activeMilestone.title}
            </p>
            <p className="text-[11px] text-[#b4c0ce] leading-snug mt-1">
              {journeySummary.activeMilestone.storyContext}
            </p>
            <p className="mt-1.5 pt-1.5 border-t border-white/8 text-[10px] font-mono text-[#e8c378]">
              {journeySummary.activeMilestone.controlHint}
            </p>
          </div>
        )}
      </div>

      {/* Floating Combat Callouts (mid-upper-center, brief) */}
      {callouts.length > 0 && (
        <div className="fixed top-[27%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
          {callouts.slice(-3).map((c) => (
            <span
              key={c.id}
              className={`font-display text-sm font-bold tracking-[0.1em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] ${
                c.tone === 'heal'
                  ? 'text-[#74e8be]'
                  : c.tone === 'gold'
                    ? 'text-[#f2cc79]'
                    : c.tone === 'heavy'
                      ? 'text-[#ff9c57]'
                      : 'text-[#f6f1e7]'
              }`}
            >
              {c.text}
            </span>
          ))}
        </div>
      )}

      {/* Fleeting Frontier Discovery Banner on UniverseCell Crossing */}
      {frontierBanner && (
        <div
          data-testid="frontier-discovery-banner"
          className="fixed top-14 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-sm bg-[#10151c]/94 border-y border-[#d4a253]/65 text-center shadow-[0_12px_36px_rgba(0,0,0,0.68)]"
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#7fd1b6]">
            Frontier Discovered · Cell ({frontierBanner.cell.join(', ')})
          </p>
          <p className="font-display text-base sm:text-lg font-bold tracking-[0.06em] text-[#f6eedc] mt-0.5">
            {frontierBanner.name}
          </p>
          <p className="text-[11px] text-[#b4bfcd] mt-0.5">{frontierBanner.subtitle}</p>
        </div>
      )}

      {/* Live Co-op Party Travel Summon Prompt */}
      {activeSummon && (
        <div
          data-testid="party-summon-banner"
          className="pointer-events-auto fixed top-24 left-1/2 -translate-x-1/2 w-[360px] sm:w-[420px] px-4 py-3 rounded-sm bg-[#111822]/96 border border-[#52d6f4]/65 shadow-[0_14px_38px_rgba(0,0,0,0.72)] flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-[#52d6f4] font-semibold">
              {activeSummon.isDungeon ? 'Dungeon Delve Summon' : 'Party Rendezvous Summon'}
            </p>
            <p className="text-xs font-semibold text-[#f3eee4] truncate mt-0.5">
              {activeSummon.senderName} calls you to {activeSummon.realmName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              data-testid="accept-summon-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onAcceptSummon(activeSummon);
              }}
              className="px-3 py-1.5 rounded-[2px] bg-[#52d6f4] hover:bg-[#70e1fa] text-[#0c141c] font-display text-[10px] font-bold uppercase tracking-[0.08em] cursor-pointer"
            >
              Join
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onDismissSummon();
              }}
              className="px-2 py-1.5 rounded-[2px] bg-[#1c2430] hover:bg-[#273242] text-[#a7b4c4] text-[10px] font-mono uppercase cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Fleeting Toast Notification */}
      {toastMessage && !frontierBanner && !activeSummon && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 max-w-md px-4 py-2 rounded-sm bg-[#141920]/94 border border-[#d4a253]/50 text-[#f3ebd8] text-xs font-medium tracking-wide shadow-[0_10px_28px_rgba(0,0,0,0.55)] text-center">
          {toastMessage}
        </div>
      )}

      {/* BOTTOM-LEFT: Realm Presence, Quick Ping/Party Controls & Collapsible Waystone Chat */}
      <div className="fixed bottom-4 left-4 sm:bottom-5 sm:left-5 w-[290px] flex flex-col gap-1.5 pointer-events-auto">
        {chatOpen && (
          <div className="bg-[#11151b]/94 border border-[#d4a253]/35 rounded-sm p-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/8">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#7ed9ee]">
                Room · {roomCode}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDropPing('rally', 'Rally Here')}
                  className="px-1.5 py-0.5 rounded-[2px] bg-[#182833] hover:bg-[#213847] border border-[#52d6f4]/35 text-[9px] font-mono text-[#7ed9ee] cursor-pointer"
                >
                  Rally
                </button>
                <button
                  type="button"
                  onClick={() => onDropPing('danger', 'Threat Here')}
                  className="px-1.5 py-0.5 rounded-[2px] bg-[#2c1918] hover:bg-[#3d2220] border border-[#e06658]/35 text-[9px] font-mono text-[#f2a096] cursor-pointer"
                >
                  Danger
                </button>
                <button
                  type="button"
                  onClick={() => onSendChat('Need Lantern Mend!')}
                  className="px-1.5 py-0.5 rounded-[2px] bg-[#162722] hover:bg-[#1e372f] border border-[#5ea38c]/35 text-[9px] font-mono text-[#88dfc0] cursor-pointer"
                >
                  Mend
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 mb-2 pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-[11px] text-[#8d99a7]">
                  Waystone frequency quiet. Greet fellow Waywrights in {roomCode}.
                </p>
              ) : (
                chatMessages.slice(-10).map((m) => (
                  <p
                    key={m.id}
                    className={`text-[11px] leading-snug ${
                      m.kind === 'event' ? 'text-[#d4a253] italic' : 'text-[#e6e2d8]'
                    }`}
                  >
                    {m.kind === 'chat' && (
                      <strong className="text-[#7fd1b6] mr-1">{m.senderName}:</strong>
                    )}
                    {m.text}
                  </p>
                ))
              )}
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatDraft.trim()) return;
                onSendChat(chatDraft);
                setChatDraft('');
              }}
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.code === 'Escape') {
                    e.stopPropagation();
                    onToggleChat();
                  }
                }}
                placeholder="Speak on Waystone channel..."
                className="flex-1 min-w-0 bg-[#0c1015] border border-white/15 focus:border-[#d4a253] rounded-[2px] px-2 py-1 text-[11px] text-[#f0ebe2] outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-[2px] bg-[#d4a253] text-[#14110b] font-display text-[10px] font-bold uppercase cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-party-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenParty();
            }}
            title={`Expedition Party & Invite Link (${roomCode}) [U]`}
            className="px-2.5 py-1.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1a212b] border border-[#52d6f4]/30 text-[11px] text-[#cfd7e2] inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${realmConnected ? 'bg-[#5ea38c]' : 'bg-[#d4a253]'}`}
            />
            <span data-testid="hud-online-count" className="font-mono tabular-nums text-[#f0ebe2] font-semibold">
              {onlineCount}
            </span>
            <span>{onlineCount === 1 ? 'Waywright' : 'Waywrights'}</span>
            <span className="text-white/25">·</span>
            <span className="text-[#7ed9ee] uppercase tracking-[0.08em] text-[10px] font-semibold">
              Party [U]
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-ping-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onDropPing('rally', 'Rally Here');
            }}
            title="Drop Tactical Rally Beacon [G]"
            className="px-2 py-1.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1a212b] border border-white/12 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7ed9ee] shadow-md cursor-pointer"
          >
            Ping [G]
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-chat-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleChat();
            }}
            title="Toggle Waystone Chat [T]"
            className="px-2 py-1.5 rounded-sm bg-[#11151b]/90 hover:bg-[#1a212b] border border-white/12 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#d4a253] shadow-md cursor-pointer"
          >
            Chat [T]
          </button>
        </div>
      </div>

      {/* BOTTOM-CENTER: Contextual Interact Prompt + 4-Slot Gear Hotbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5">
        {hud.proximity && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerInteract();
            }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-sm bg-[#141920]/95 hover:bg-[#1e2630] border border-[#d4a253]/65 shadow-[0_8px_24px_rgba(0,0,0,0.55)] cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-[2px] bg-[#d4a253] text-[#14110b] font-mono text-xs font-bold">
              E
            </span>
            <div className="text-left">
              <p className="text-xs font-semibold text-[#f3eee4] leading-tight">
                {hud.proximity.label}
              </p>
              <p className="text-[10px] text-[#a7b2c0] leading-tight">{hud.proximity.sublabel}</p>
            </div>
          </button>
        )}

        {/* Active Gear Role Clue */}
        <div className="text-[11px] tracking-[0.08em] text-[#e5dcc9] drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
          <span className="font-display font-semibold text-[#f2d085]">
            {activeGearDef.name} {activeTier > 1 ? `Mk.${activeTier}` : ''}
          </span>
          <span className="mx-2 text-white/35">·</span>
          <span>{activeGearDef.roleClue}</span>
        </div>

        {/* 4-Slot Gear Hotbar + Tactile Strike/Use & Dodge Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#11151b]/92 border border-white/14 p-1.5 rounded-sm shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
          {GEAR_LOADOUT.map((gear) => {
            const active = hud.activeGear === gear.id;
            const tier = gearTiers[gear.id] ?? 1;
            const cd = hud.cooldowns[gear.id] ?? 0;
            const cdFrac = Math.max(0, Math.min(1, cd / gear.cooldownSec));
            return (
              <button
                key={gear.id}
                type="button"
                tabIndex={-1}
                data-gear-slot={gear.id}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onActivateGear(gear.id);
                }}
                title={`${gear.name} (Tier ${tier}) — Click to use (${gear.roleClue}) [${gear.slotKey}]`}
                className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-[2px] flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer overflow-hidden ${
                  active
                    ? 'bg-[#d4a253] text-[#14110b] border border-[#f5d896]'
                    : 'bg-[#192029] hover:bg-[#232c38] text-[#e6decb] border border-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-1 font-mono text-[9px] font-bold ${
                    active ? 'text-[#14110b]/80' : 'text-[#9aa5b3]'
                  }`}
                >
                  {gear.slotKey}
                </span>
                {tier > 1 && (
                  <span
                    className={`absolute bottom-0.5 right-1 font-mono text-[8px] font-bold ${
                      active ? 'text-[#14110b]' : 'text-[#d4a253]'
                    }`}
                  >
                    T{tier}
                  </span>
                )}
                <GearSvgIcon gearId={gear.id} active={active} />
                {cd > 0.05 && (
                  <>
                    <div
                      className="absolute inset-x-0 bottom-0 bg-[#0b0e12]/76 pointer-events-none"
                      style={{ height: `${Math.round(cdFrac * 100)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-[#f4ead6] drop-shadow">
                      {cd.toFixed(1)}
                    </span>
                  </>
                )}
              </button>
            );
          })}

          <div className="w-px h-9 bg-white/14 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            tabIndex={-1}
            data-action="primary"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerAction();
            }}
            title={`Execute ${activeGearDef.name} [Click / F]`}
            className="h-12 sm:h-13 px-3 rounded-[2px] bg-[#2a2216] hover:bg-[#3a2f1d] active:scale-95 border border-[#d4a253]/60 text-[#f4e5c3] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer min-w-[78px]"
          >
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none">
              {hud.waterPosture === 'swimming' &&
              (activeGearDef.id === 'hookblade' || activeGearDef.id === 'bellhammer')
                ? 'Surge'
                : activeGearDef.id === 'hookblade'
                  ? 'Strike'
                  : activeGearDef.id === 'bellhammer'
                    ? 'Smash'
                    : activeGearDef.id === 'lantern'
                      ? 'Mend'
                      : 'Banner'}
            </span>
            <span className="font-mono text-[9px] text-[#d4a253] leading-none">
              {(hud.cooldowns[activeGearDef.id] ?? 0) > 0.05
                ? `${hud.cooldowns[activeGearDef.id].toFixed(1)}s`
                : 'Click / F'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-action="dodge"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerDodge();
            }}
            title={hud.waterPosture === 'swimming' ? 'Swim Surge Burst [Shift]' : 'Evasive Dodge Dash [Shift]'}
            className="h-12 sm:h-13 px-2.5 rounded-[2px] bg-[#162229] hover:bg-[#20313b] active:scale-95 border border-[#5ea38c]/45 text-[#d7ebe3] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
          >
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none">
              {hud.waterPosture === 'swimming' ? 'Surge' : 'Dodge'}
            </span>
            <span className="font-mono text-[9px] text-[#7fd1b6] leading-none">Shift</span>
          </button>
        </div>
      </div>
    </div>
  );
};
