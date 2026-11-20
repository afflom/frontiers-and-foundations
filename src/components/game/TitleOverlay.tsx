import React from 'react';

interface TitleOverlayProps {
  hasSavedJourney: boolean;
  onStartNew: () => void;
  onContinue: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSavedJourney,
  onStartNew,
  onContinue,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-none select-none"
      style={{
        background:
          'linear-gradient(100deg, rgba(11,14,19,0.82) 0%, rgba(11,14,19,0.44) 42%, rgba(11,14,19,0.06) 78%, rgba(11,14,19,0.18) 100%)',
      }}
    >
      {/* Upper-left hero lockup sitting cleanly over calm negative space */}
      <div className="px-10 pt-12 md:px-16 md:pt-16 max-w-xl pointer-events-auto">
        <div className="flex items-center gap-3.5 mb-5">
          {/* Bespoke Waywright Meridian & Arch Crest */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="22" cy="22" r="20" stroke="#D4A253" strokeWidth="1.5" strokeOpacity="0.8" />
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
              Open-World Fantasy Action RPG
            </p>
          </div>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-[54px] font-bold tracking-[0.06em] leading-[1.06] text-[#f3efe6] drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]">
          FRONTIERS
          <span className="block text-[#d4a253] text-2xl sm:text-3xl md:text-[32px] tracking-[0.2em] my-1 font-medium">
            &amp;
          </span>
          FOUNDATIONS
        </h1>

        <p className="mt-5 text-sm sm:text-[15px] leading-relaxed text-[#cfd6df] max-w-md drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          Sound the failing piers of the High Basalt Citadel, chart shifting obsidian coasts, and raise
          living foundations across an untamed frontier.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              if (hasSavedJourney) {
                onContinue();
              } else {
                onStartNew();
              }
            }}
            className="group relative inline-flex items-center gap-3 px-7 py-3.5 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] active:bg-[#c08f42] text-[#14110b] font-display font-bold text-sm tracking-[0.14em] uppercase transition-colors shadow-[0_8px_28px_rgba(212,162,83,0.3)] cursor-pointer"
          >
            <span>{hasSavedJourney ? 'Continue Journey' : 'Enter Vaelmor'}</span>
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

          {hasSavedJourney && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartNew();
              }}
              className="inline-flex items-center px-5 py-3.5 rounded-sm bg-[#161b22]/90 hover:bg-[#202731] text-[#eceae4] border border-[#d4a253]/35 font-display text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer"
            >
              New Journey
            </button>
          )}
        </div>
      </div>

      {/* Bottom flat borderless control legend with subtle contrast scrim */}
      <div className="px-10 pt-10 pb-6 md:px-16 bg-gradient-to-t from-[#0b0e12]/90 via-[#0b0e12]/45 to-transparent flex flex-wrap items-center justify-between gap-4 text-[11px] tracking-[0.08em] text-[#dce2eb] drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span><strong className="text-[#f0cd80]">WASD</strong> Move</span>
          <span><strong className="text-[#f0cd80]">Drag / Q R</strong> Camera</span>
          <span><strong className="text-[#f0cd80]">Space</strong> Jump</span>
          <span><strong className="text-[#f0cd80]">Shift</strong> Dodge</span>
          <span><strong className="text-[#f0cd80]">Right-Click / F</strong> Gear Action</span>
          <span><strong className="text-[#f0cd80]">1-4</strong> Switch Gear</span>
          <span><strong className="text-[#f0cd80]">E</strong> Interact</span>
          <span><strong className="text-[#f0cd80]">J / M</strong> Chronicle &amp; Map</span>
        </div>
        <span className="text-[#e7c06f] uppercase tracking-[0.18em] font-semibold">
          Press Enter to Begin
        </span>
      </div>
    </div>
  );
};
