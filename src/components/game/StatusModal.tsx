import React from 'react';
import type { GamePhase } from '../../game/worldData';

interface StatusModalProps {
  phase: Extract<GamePhase, 'paused' | 'victory' | 'gameover'>;
  regionName: string;
  waywrightName?: string;
  slotLabel?: string;
  completedQuests: number;
  totalQuests: number;
  defeatedCount: number;
  renown: number;
  bannersCount: number;
  onResume: () => void;
  onRespawnAtCitadel: () => void;
  onReplayPrologue?: () => void;
  onOpenFieldManual?: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  phase,
  regionName,
  waywrightName,
  slotLabel,
  completedQuests,
  totalQuests,
  defeatedCount,
  renown,
  bannersCount,
  onResume,
  onRespawnAtCitadel,
  onReplayPrologue,
  onOpenFieldManual,
  onRestart,
  onReturnToTitle,
}) => {
  const title =
    phase === 'paused'
      ? 'Journey Paused'
      : phase === 'victory'
        ? 'Meridian Foundations Secured'
        : 'Fallen on the Frontier';

  const subtitle =
    phase === 'paused'
      ? `Standing in ${regionName}${waywrightName ? ` · Waywright ${waywrightName}` : ''}`
      : phase === 'victory'
        ? 'Every foundational charter across Vaelmor now rings true.'
        : `Overwhelmed in ${regionName}. Rise at the Citadel or forge a fresh charter.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0d12]/78">
      <div className="w-full max-w-md bg-[#131820] border border-[#d4a253]/45 rounded-sm p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.82)] text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#d4a253] font-semibold">
          {phase === 'victory'
            ? 'Charter Complete'
            : phase === 'gameover'
              ? 'Defeat'
              : slotLabel
                ? `Frontiers & Foundations · ${slotLabel}`
                : 'Frontiers & Foundations'}
        </p>
        <h2 className="font-display text-2xl font-bold text-[#f3efe6] mt-1.5">{title}</h2>
        <p className="text-xs text-[#aab5c4] mt-2 leading-relaxed">{subtitle}</p>

        {/* Mastery / Progress Metrics */}
        <div className="grid grid-cols-2 gap-2.5 my-6 text-left">
          <div className="bg-[#19202a] border border-white/10 rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#98a4b3]">Quests</p>
            <p className="font-mono text-base font-bold tabular-nums text-[#f2eee6] mt-0.5">
              {completedQuests} / {totalQuests}
            </p>
          </div>
          <div className="bg-[#19202a] border border-white/10 rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#98a4b3]">Renown</p>
            <p className="font-mono text-base font-bold tabular-nums text-[#d4a253] mt-0.5">
              {renown}
            </p>
          </div>
          <div className="bg-[#19202a] border border-white/10 rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#98a4b3]">Foes Vanquished</p>
            <p className="font-mono text-base font-bold tabular-nums text-[#f2eee6] mt-0.5">
              {defeatedCount}
            </p>
          </div>
          <div className="bg-[#19202a] border border-white/10 rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#98a4b3]">Banners Raised</p>
            <p className="font-mono text-base font-bold tabular-nums text-[#5ea38c] mt-0.5">
              {bannersCount}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {phase === 'paused' && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] font-display text-xs font-bold uppercase tracking-[0.14em] cursor-pointer"
            >
              Resume Journey
            </button>
          )}

          {phase === 'victory' && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-sm bg-[#5ea38c] hover:bg-[#6eb59e] text-[#0e1513] font-display text-xs font-bold uppercase tracking-[0.14em] cursor-pointer"
            >
              Continue Exploring Vaelmor
            </button>
          )}

          {phase === 'gameover' && (
            <button
              type="button"
              onClick={onRespawnAtCitadel}
              className="w-full py-3 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] font-display text-xs font-bold uppercase tracking-[0.14em] cursor-pointer"
            >
              Rise at Citadel
            </button>
          )}

          {phase === 'paused' && (onReplayPrologue || onOpenFieldManual) && (
            <div className="grid grid-cols-2 gap-2">
              {onOpenFieldManual && (
                <button
                  type="button"
                  data-testid="pause-field-manual-btn"
                  onClick={onOpenFieldManual}
                  className="py-2.5 rounded-sm bg-[#16202a] hover:bg-[#1f2c3a] border border-[#5ea38c]/35 text-[#cde8de] font-display text-[11px] font-semibold uppercase tracking-[0.11em] cursor-pointer"
                >
                  Field Manual
                </button>
              )}
              {onReplayPrologue && (
                <button
                  type="button"
                  data-testid="pause-replay-prologue-btn"
                  onClick={onReplayPrologue}
                  className="py-2.5 rounded-sm bg-[#16202a] hover:bg-[#1f2c3a] border border-[#d4a253]/35 text-[#f0cd80] font-display text-[11px] font-semibold uppercase tracking-[0.11em] cursor-pointer"
                >
                  Replay Prologue
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            data-start={phase !== 'paused' ? 'true' : undefined}
            onClick={onRestart}
            className="w-full py-2.5 rounded-sm bg-[#1c242f] hover:bg-[#263140] border border-white/12 text-[#ece8df] font-display text-xs font-semibold uppercase tracking-[0.12em] cursor-pointer"
          >
            {phase === 'victory' ? 'Play Again' : 'Restart Active Slot'}
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full py-2 text-xs text-[#9ca7b5] hover:text-[#ece8df] uppercase tracking-[0.12em] font-semibold cursor-pointer"
          >
            Save &amp; Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
