import React, { useState } from 'react';
import {
  FIELD_MANUAL_SECTIONS,
  type FieldManualSection,
} from '../../verdant/verdantJourneyModel';

interface FieldManualModalProps {
  onClose: () => void;
  onWatchPrologue?: () => void;
}

export const FieldManualModal: React.FC<FieldManualModalProps> = ({
  onClose,
  onWatchPrologue,
}) => {
  const [activeId, setActiveId] = useState<FieldManualSection['id']>(FIELD_MANUAL_SECTIONS[0].id);
  const activeSection =
    FIELD_MANUAL_SECTIONS.find((s) => s.id === activeId) ?? FIELD_MANUAL_SECTIONS[0];

  return (
    <div
      data-testid="field-manual-modal"
      role="dialog"
      aria-label="Waywright Field Manual"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#070a0f]/86 select-none"
    >
      <div className="w-full max-w-4xl max-h-[86vh] flex flex-col bg-[#10151d] border border-[#d4a253]/45 rounded-[3px] shadow-[0_28px_80px_rgba(0,0,0,0.88)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#141b25] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d4a253] font-semibold">
              Frontiers &amp; Foundations · Reference Codex
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#f4f0e6] mt-0.5">
              Waywright’s Field Manual
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {onWatchPrologue && (
              <button
                type="button"
                data-testid="manual-watch-prologue-btn"
                onClick={() => {
                  onClose();
                  onWatchPrologue();
                }}
                className="px-3.5 py-2 rounded-[2px] bg-[#1c2533] hover:bg-[#273447] border border-[#d4a253]/35 text-[11px] font-display font-semibold uppercase tracking-[0.12em] text-[#f0cd80] cursor-pointer transition-colors"
              >
                Watch Prologue
              </button>
            )}
            <button
              type="button"
              data-testid="field-manual-close-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-[2px] bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] text-[11px] font-display font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div
          role="tablist"
          aria-label="Field Manual Sections"
          className="px-6 pt-3 bg-[#111720] border-b border-white/10 flex flex-wrap gap-2"
        >
          {FIELD_MANUAL_SECTIONS.map((sec) => {
            const isActive = sec.id === activeSection.id;
            return (
              <button
                key={sec.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`manual-tab-${sec.id}`}
                onClick={() => setActiveId(sec.id)}
                className={`px-3.5 py-2 text-xs font-display font-semibold uppercase tracking-[0.1em] border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#d4a253] text-[#f3e5c3]'
                    : 'border-transparent text-[#8f9cab] hover:text-[#dce4ee]'
                }`}
              >
                {sec.tabLabel}
              </button>
            );
          })}
        </div>

        {/* Section Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="pb-3 border-b border-white/10">
            <h3 className="font-display text-lg font-bold text-[#f3efe6]">{activeSection.title}</h3>
            <p className="text-xs sm:text-sm text-[#b7c2d0] mt-1 leading-relaxed">
              {activeSection.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeSection.entries.map((entry) => (
              <div
                key={entry.heading}
                className="p-4 rounded-[2px] bg-[#161d27] border border-white/10"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-[#f0e9db]">{entry.heading}</h4>
                  {entry.badge && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7fd1b6] shrink-0">
                      {entry.badge}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#c6d0dd]">{entry.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Tip */}
        <div className="px-6 py-3 bg-[#0d1219] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8e9bab]">
          <span>In-world story plays in the Animated Prologue · Controls &amp; systems live here</span>
          <span>Press Esc to Close</span>
        </div>
      </div>
    </div>
  );
};
