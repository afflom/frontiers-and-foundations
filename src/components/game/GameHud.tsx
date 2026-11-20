import React, { useEffect, useRef, useState } from 'react';
import { GEAR_LOADOUT, type GameQuest, type GearSlotId } from '../../game/worldData';
import type { HudSnapshot } from '../../game/vaelmorRenderer';
import type { GearUpgradeTiers, WorldChatMessage } from '../../game/multiplayerTypes';
import type { FrontiersRealmSpec } from '../../verdant/realmModelSchema';

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
  realmConnected: boolean;
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
  onActivateGear: (gear: GearSlotId) => void;
  onTriggerAction: () => void;
  onTriggerDodge: () => void;
  onNextTrack?: () => void;
  onOpenJournal: () => void;
  onOpenMap: () => void;
  onOpenDungeons?: () => void;
  onOpenForge: () => void;
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
  realmConnected,
  chatMessages,
  chatOpen,
  callouts,
  muted,
  activeTrackTitle,
  toastMessage,
  frontierBanner,
  onActivateGear,
  onTriggerAction,
  onTriggerDodge,
  onNextTrack,
  onOpenJournal,
  onOpenMap,
  onOpenDungeons,
  onOpenForge,
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

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 bg-[#d4a253]" />
        </div>

        {primaryEnemy && (
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
        )}
      </div>

      {/* TOP-RIGHT: Utility Actions & Active Charter Tracker */}
      <div className="fixed top-4 right-4 sm:top-5 sm:right-5 flex flex-col items-end gap-2.5 max-w-[295px]">
        <div className="pointer-events-auto flex items-center gap-1.5">
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

      {/* Fleeting Toast Notification */}
      {toastMessage && !frontierBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 max-w-md px-4 py-2 rounded-sm bg-[#141920]/94 border border-[#d4a253]/50 text-[#f3ebd8] text-xs font-medium tracking-wide shadow-[0_10px_28px_rgba(0,0,0,0.55)] text-center">
          {toastMessage}
        </div>
      )}

      {/* BOTTOM-LEFT: Realm Presence & Collapsible Waystone Chat */}
      <div className="fixed bottom-4 left-4 sm:bottom-5 sm:left-5 w-[270px] flex flex-col gap-1.5 pointer-events-auto">
        {chatOpen && (
          <div className="bg-[#11151b]/92 border border-[#d4a253]/35 rounded-sm p-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            <div className="max-h-32 overflow-y-auto space-y-1 mb-2 pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-[11px] text-[#8d99a7]">
                  Waystone frequency quiet. Greet fellow Waywrights in Vaelmor.
                </p>
              ) : (
                chatMessages.slice(-8).map((m) => (
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

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleChat();
          }}
          className="self-start px-3 py-1.5 rounded-sm bg-[#11151b]/88 hover:bg-[#1a212b] border border-white/12 text-[11px] text-[#cfd7e2] inline-flex items-center gap-2 shadow-md cursor-pointer"
        >
          <span
            className={`w-2 h-2 rounded-full ${realmConnected ? 'bg-[#5ea38c]' : 'bg-[#d4a253]'}`}
          />
          <span className="font-mono tabular-nums text-[#f0ebe2] font-semibold">
            {onlineCount}
          </span>
          <span>{onlineCount === 1 ? 'Waywright' : 'Waywrights'}</span>
          <span className="text-white/30">·</span>
          <span className="text-[#d4a253] uppercase tracking-[0.08em] text-[10px] font-semibold">
            Chat [T]
          </span>
        </button>
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
