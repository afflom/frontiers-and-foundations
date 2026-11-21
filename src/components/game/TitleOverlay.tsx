import React, { useMemo, useState } from 'react';
import { INITIAL_GUILDS } from '../../game/worldData';
import {
  SAVE_SLOT_IDS,
  formatPlayTime,
  formatSaveTimestamp,
  getFirstEmptySaveSlotId,
  getMostRecentSaveSlot,
  type SaveSlotId,
  type SaveSlotStoreState,
} from '../../game/saveSlotStorage';

interface TitleOverlayProps {
  saveStore: SaveSlotStoreState;
  defaultCallsign: string;
  invitedRoomCode?: string | null;
  onlineCount?: number;
  onOpenCharacterCreator: (slotId: SaveSlotId) => void;
  onStartNewInSlot: (slotId: SaveSlotId, waywrightName: string, guildId: string) => void;
  onContinueSlot: (slotId: SaveSlotId) => void;
  onRenameSlot: (slotId: SaveSlotId, nextName: string) => void;
  onDeleteSlot: (slotId: SaveSlotId) => void;
  onWatchPrologue: () => void;
  onOpenFieldManual: () => void;
}

const SLOT_ROMAN: Record<SaveSlotId, string> = {
  'slot-1': 'I',
  'slot-2': 'II',
  'slot-3': 'III',
};

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  saveStore,
  defaultCallsign,
  invitedRoomCode,
  onlineCount = 1,
  onOpenCharacterCreator,
  onStartNewInSlot: _onStartNewInSlot,
  onContinueSlot,
  onRenameSlot,
  onDeleteSlot,
  onWatchPrologue,
  onOpenFieldManual,
}) => {
  const mostRecent = useMemo(() => getMostRecentSaveSlot(saveStore), [saveStore]);
  const [renamingSlotId, setRenamingSlotId] = useState<SaveSlotId | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<SaveSlotId | null>(null);

  const openCreatorForSlot = (slotId: SaveSlotId) => {
    setRenamingSlotId(null);
    setConfirmDeleteSlotId(null);
    onOpenCharacterCreator(slotId);
  };

  const handleHeroPrimary = () => {
    if (mostRecent) {
      onContinueSlot(mostRecent.slotId);
    } else {
      const targetSlot = getFirstEmptySaveSlotId(saveStore);
      onOpenCharacterCreator(targetSlot);
    }
  };

  return (
    <div
      data-testid="title-screen-overlay"
      className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-none select-none overflow-y-auto"
      style={{
        background:
          'linear-gradient(102deg, rgba(10,13,18,0.88) 0%, rgba(10,13,18,0.52) 44%, rgba(10,13,18,0.22) 64%, rgba(10,13,18,0.78) 100%)',
      }}
    >
      {/* Main Split Stage: Left Story Hero Lockup + Right 3-Slot Expedition Ledger */}
      <div className="flex-1 w-full max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-14 pt-8 sm:pt-12 pb-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-8 lg:gap-10 items-start lg:items-center">
        {/* LEFT COLUMN: Title Crest, Clear Setting Premise & Primary Actions */}
        <div className="max-w-xl pointer-events-auto">
          <div className="flex items-center gap-3.5 mb-4">
            {/* Bespoke Waywright Meridian & Arch Crest */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="22" cy="22" r="20" stroke="#D4A253" strokeWidth="1.5" strokeOpacity="0.82" />
              <circle cx="22" cy="22" r="15" stroke="#5EA38C" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M22 4V11M22 33V40M4 22H11M33 22H40" stroke="#D4A253" strokeWidth="1.4" />
              <path
                d="M11 28C14 19 30 19 33 28"
                stroke="#ECEAE4"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <polygon points="22,12 26,22 22,26 18,22" fill="#D4A253" />
            </svg>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#d4a253] font-semibold">
                The Shattered Meridian of Vaelmor
              </p>
              <p className="text-xs text-[#b7c0cc] mt-0.5">
                Co-op Open-World Action RPG · Six Federated Frontiers
              </p>
            </div>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl xl:text-[54px] font-bold tracking-[0.06em] leading-[1.04] text-[#f3efe6] drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]">
            FRONTIERS
            <span className="block text-[#d4a253] text-2xl sm:text-3xl tracking-[0.2em] my-1 font-medium">
              &amp;
            </span>
            FOUNDATIONS
          </h1>

          {/* Clear, Grounded Plot Premise so players immediately understand the world & stakes */}
          <div className="mt-5 max-w-lg space-y-2.5 text-sm leading-relaxed text-[#d7dde6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            <p>
              Vaelmor’s load-bearing <strong className="text-[#f3e5c3] font-semibold">Third Pier</strong> is
              slipping out of harmonic phase, threatening the subterranean Meridian Arch that binds six distant
              frontiers together.
            </p>
            <p className="text-[#b8c3d1] text-[13px]">
              Commissioned as a sworn Waywright, you will sound failing stone, descend into awakening vaults,
              temper resonance instruments, and plant living Foundation Banners alone or with fellow explorers.
            </p>
          </div>

          {(invitedRoomCode || onlineCount > 1) && (
            <div
              data-testid="title-multiplayer-notice"
              className="mt-4 inline-flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-[2px] bg-[#111720]/92 border border-[#52d6f4]/40 text-xs text-[#d7eef7]"
            >
              {invitedRoomCode ? (
                <span>
                  Expedition Invite:{' '}
                  <strong className="font-mono text-[#f0cd80] tracking-wider">{invitedRoomCode}</strong>
                </span>
              ) : (
                <span>
                  <strong className="font-mono text-[#7fd1b6]">{onlineCount}</strong> Waywrights active on the
                  Meridian
                </span>
              )}
            </div>
          )}

          {/* Primary Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              data-testid="title-primary-cta"
              onClick={(e) => {
                e.currentTarget.blur();
                handleHeroPrimary();
              }}
              className="inline-flex items-center gap-3 px-7 py-3.5 rounded-[2px] bg-[#d4a253] hover:bg-[#e1b366] active:bg-[#c08f42] text-[#14110b] font-display font-bold text-sm tracking-[0.14em] uppercase transition-colors shadow-[0_8px_28px_rgba(212,162,83,0.32)] cursor-pointer"
            >
              <span>
                {invitedRoomCode
                  ? mostRecent
                    ? `Join as ${mostRecent.waywrightName}`
                    : 'Begin Invited Expedition'
                  : mostRecent
                    ? `Continue · ${mostRecent.waywrightName}`
                    : 'Begin New Expedition'}
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8H13M9 4L13 8L9 12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              data-testid="title-watch-prologue-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onWatchPrologue();
              }}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-[2px] bg-[#141a23]/92 hover:bg-[#1e2633] text-[#eceae4] border border-[#d4a253]/38 font-display text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer"
            >
              <span>Watch Prologue</span>
            </button>

            <button
              type="button"
              data-testid="title-field-manual-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenFieldManual();
              }}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-[2px] bg-[#121820]/92 hover:bg-[#1b2430] text-[#cfe4dc] border border-[#5ea38c]/38 font-display text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer"
            >
              <span>Field Manual</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 3-Slot Expedition Save Ledger */}
        <section
          data-testid="save-slots-panel"
          aria-label="Expedition Save Slots"
          className="pointer-events-auto w-full bg-[#0e131a]/92 border border-[#d4a253]/35 rounded-[3px] p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
        >
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4a253] font-semibold">
                Waywright Ledger
              </p>
              <h2 className="font-display text-base font-bold tracking-[0.06em] text-[#f3efe6] mt-0.5">
                Expedition Save Slots
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[#98a5b5]">
              {SAVE_SLOT_IDS.filter((id) => saveStore.slots[id] !== null).length} / 3 Active
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {SAVE_SLOT_IDS.map((slotId) => {
              const slot = saveStore.slots[slotId];
              const isRenaming = renamingSlotId === slotId;
              const isConfirmingDelete = confirmDeleteSlotId === slotId;
              const guild = slot
                ? INITIAL_GUILDS.find((g) => g.id === slot.pledgedGuildId) ?? INITIAL_GUILDS[0]
                : null;
              const isLatest = mostRecent?.slotId === slotId;

              if (!slot) {
                return (
                  <div
                    key={slotId}
                    data-testid={`save-slot-${slotId}`}
                    className="rounded-[2px] bg-[#131922] border border-white/10 p-3.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d9aa9]">
                          Charter Slot {SLOT_ROMAN[slotId]} · Empty
                        </p>
                        <p className="text-xs text-[#c5ceda] mt-0.5">
                          Create your Waywright character &amp; launch the 5-scene Prologue
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid={`start-new-${slotId}`}
                        onClick={() => openCreatorForSlot(slotId)}
                        className="shrink-0 px-3.5 py-2 rounded-[2px] bg-[#1e2633] hover:bg-[#d4a253] text-[#ece8df] hover:text-[#14110b] border border-[#d4a253]/40 font-display text-[11px] font-bold uppercase tracking-[0.1em] transition-colors cursor-pointer"
                      >
                        New Journey
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={slotId}
                  data-testid={`save-slot-${slotId}`}
                  className={`rounded-[2px] p-3.5 border transition-colors ${
                    isLatest
                      ? 'bg-[#171e28] border-[#d4a253]/60'
                      : 'bg-[#131922] border-white/12'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em]">
                        <span className="text-[#d4a253] font-semibold">
                          Slot {SLOT_ROMAN[slotId]}
                        </span>
                        {isLatest && (
                          <>
                            <span className="text-white/25">·</span>
                            <span className="text-[#7fd1b6]">Most Recent</span>
                          </>
                        )}
                        <span className="text-white/25">·</span>
                        <span className="text-[#8e9bab]">{formatSaveTimestamp(slot.savedAt)}</span>
                      </div>

                      {isRenaming ? (
                        <form
                          className="mt-1.5 flex items-center gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (renameDraft.trim().length >= 2) {
                              onRenameSlot(slotId, renameDraft.trim());
                            }
                            setRenamingSlotId(null);
                          }}
                        >
                          <input
                            type="text"
                            maxLength={24}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            className="w-36 px-2 py-1 rounded-[2px] bg-[#0b0f15] border border-[#d4a253] text-xs text-[#f3efe6] outline-none"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="px-2 py-1 rounded-[2px] bg-[#d4a253] text-[#14110b] text-[10px] font-bold uppercase cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingSlotId(null)}
                            className="px-2 py-1 text-[10px] text-[#9aa7b6] hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <h3
                          data-testid={`slot-waywright-${slotId}`}
                          className="font-display text-sm font-bold text-[#f3efe6] mt-0.5 truncate"
                        >
                          {slot.waywrightName}
                        </h3>
                      )}

                      <p className="text-[11px] text-[#d4a253] truncate mt-0.5 tabular-nums">
                        Lv.{slot.characterLevel ?? 1} · {slot.speciesName ?? 'Meridian Human'} ·{' '}
                        {slot.className ?? 'Meridian Surveyor'}
                      </p>
                      <p className="text-[11px] text-[#bcc7d4] truncate mt-0.5">
                        {slot.regionName} · {guild?.name ?? 'Stonebinder Guild'}
                      </p>
                      <p className="text-[11px] text-[#8fa0b3] truncate mt-0.5">
                        {slot.journeyChapterTitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid={`continue-${slotId}`}
                      onClick={() => onContinueSlot(slotId)}
                      className="shrink-0 px-3.5 py-2 rounded-[2px] bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] font-display text-[11px] font-bold uppercase tracking-[0.1em] cursor-pointer transition-colors"
                    >
                      Continue
                    </button>
                  </div>

                  {/* Clean inline metric strip (zero pill clutter) */}
                  <div className="mt-2.5 pt-2 border-t border-white/8 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#a6b2c0]">
                    <span>
                      Quests {slot.completedQuests}/{slot.totalQuests} · Renown {slot.renown} · Banners{' '}
                      {slot.bannersCount} · {formatPlayTime(slot.playTimeSec)}
                    </span>

                    {!isConfirmingDelete ? (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteSlotId(null);
                            setRenamingSlotId(slotId);
                            setRenameDraft(slot.waywrightName);
                          }}
                          className="text-[#c5d0dd] hover:text-[#f0cd80] cursor-pointer"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          data-testid={`delete-btn-${slotId}`}
                          onClick={() => {
                            setRenamingSlotId(null);
                            setConfirmDeleteSlotId(slotId);
                          }}
                          className="text-[#c9857d] hover:text-[#f09a90] cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[#f09a90]">Clear slot?</span>
                        <button
                          type="button"
                          data-testid={`confirm-delete-${slotId}`}
                          onClick={() => {
                            onDeleteSlot(slotId);
                            setConfirmDeleteSlotId(null);
                          }}
                          className="px-2 py-0.5 rounded-[2px] bg-[#b53e38] hover:bg-[#cc4a44] text-white font-semibold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlotId(null)}
                          className="text-[#aeb9c6] hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom flat borderless control legend */}
      <div className="px-6 sm:px-10 lg:px-14 pt-6 pb-5 bg-gradient-to-t from-[#0b0e12]/92 via-[#0b0e12]/50 to-transparent flex flex-wrap items-center justify-between gap-4 text-[11px] tracking-[0.08em] text-[#dce2eb] drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span><strong className="text-[#f0cd80]">WASD</strong> Move</span>
          <span><strong className="text-[#f0cd80]">Drag / Scroll / C</strong> Orbit · Zoom · Center</span>
          <span><strong className="text-[#f0cd80]">Space / Shift</strong> Jump · Dodge</span>
          <span><strong className="text-[#f0cd80]">1-4 · Click/F</strong> Gear &amp; Action</span>
          <span><strong className="text-[#f0cd80]">E</strong> Interact</span>
          <span><strong className="text-[#f0cd80]">K</strong> Character Atelier</span>
          <span><strong className="text-[#f0cd80]">J / M / V / I / U</strong> Atlas · Party</span>
        </div>
        <span className="text-[#e7c06f] uppercase tracking-[0.18em] font-semibold">
          {mostRecent ? 'Press Enter to Continue' : 'Select a Slot or Press Enter'}
        </span>
      </div>
    </div>
  );
};
