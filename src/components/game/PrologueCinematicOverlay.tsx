import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PROLOGUE_CINEMATIC_ACTS,
  WAYWRIGHT_OATH_CHOICES,
  resolvePrologueCaptionAt,
  type PrologueCinematicAct,
  type WaywrightOathId,
} from '../../verdant/verdantJourneyModel';
import { PrologueAtmosphereCanvas } from './PrologueAtmosphereCanvas';

interface PrologueCinematicOverlayProps {
  waywrightName: string;
  isReplay?: boolean;
  muted?: boolean;
  initialOathId?: WaywrightOathId | null;
  onToggleMute?: () => void;
  onActChange?: (act: PrologueCinematicAct) => void;
  onSeismicBeat?: () => void;
  onSelectOath?: (oathId: WaywrightOathId) => void;
  onComplete: () => void;
  onSkip: () => void;
}

const CROSSFADE_MS = 950;

export const PrologueCinematicOverlay: React.FC<PrologueCinematicOverlayProps> = ({
  waywrightName,
  isReplay = false,
  muted = false,
  initialOathId = null,
  onToggleMute,
  onActChange,
  onSeismicBeat,
  onSelectOath,
  onComplete,
  onSkip,
}) => {
  const [actIdx, setActIdx] = useState<number>(0);
  const [prevAct, setPrevAct] = useState<PrologueCinematicAct | null>(null);
  const [transitionElapsedMs, setTransitionElapsedMs] = useState<number>(CROSSFADE_MS);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [largeCaptions, setLargeCaptions] = useState<boolean>(false);
  const [selectedOath, setSelectedOath] = useState<WaywrightOathId | null>(initialOathId);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const lastTickRef = useRef<number>(performance.now());
  const seismicFiredRef = useRef<string | null>(null);
  const act = PROLOGUE_CINEMATIC_ACTS[actIdx] ?? PROLOGUE_CINEMATIC_ACTS[0];
  const progress01 = Math.max(0, Math.min(1, elapsedMs / Math.max(1, act.durationMs)));
  const isFinalAct = actIdx === PROLOGUE_CINEMATIC_ACTS.length - 1;
  const crossfadeAlpha = Math.min(1, transitionElapsedMs / CROSSFADE_MS);

  const transitionToAct = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(PROLOGUE_CINEMATIC_ACTS.length - 1, nextIdx));
    if (clamped === actIdx) {
      setElapsedMs(0);
      return;
    }
    setPrevAct(act);
    setTransitionElapsedMs(0);
    setActIdx(clamped);
    setElapsedMs(0);
    seismicFiredRef.current = null;
  };

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = () => setReducedMotion(mq.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      return undefined;
    }
  }, []);

  // Notify 3D runtime camera & procedural soundscape on every scene transition
  useEffect(() => {
    onActChange?.(act);
  }, [act, onActChange]);

  // Fire timed seismic stone-crack audio beat in Scene II
  useEffect(() => {
    if (
      act.cameraTremorAtPct !== undefined &&
      progress01 >= act.cameraTremorAtPct &&
      seismicFiredRef.current !== act.actId
    ) {
      seismicFiredRef.current = act.actId;
      onSeismicBeat?.();
    }
  }, [act.actId, act.cameraTremorAtPct, onSeismicBeat, progress01]);

  // Lightweight 180ms timeline tick (~5.5Hz React commits) paired with smooth 200ms CSS interpolation
  useEffect(() => {
    if (paused) return;
    lastTickRef.current = performance.now();

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(260, Math.max(0, now - lastTickRef.current));
      lastTickRef.current = now;
      setTransitionElapsedMs((t) => (t < CROSSFADE_MS ? Math.min(CROSSFADE_MS, t + dt) : t));
      setElapsedMs((prev) => {
        const next = prev + dt;
        if (next >= act.durationMs) {
          if (actIdx < PROLOGUE_CINEMATIC_ACTS.length - 1) {
            setPrevAct(PROLOGUE_CINEMATIC_ACTS[actIdx]);
            setTransitionElapsedMs(0);
            setActIdx((i) => Math.min(PROLOGUE_CINEMATIC_ACTS.length - 1, i + 1));
            seismicFiredRef.current = null;
            return 0;
          }
          return act.durationMs;
        }
        return next;
      });
    }, 180);

    return () => window.clearInterval(intervalId);
  }, [act.durationMs, actIdx, paused]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (actIdx < PROLOGUE_CINEMATIC_ACTS.length - 1) {
          transitionToAct(actIdx + 1);
        } else {
          onComplete();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (elapsedMs > 1800) {
          setElapsedMs(0);
        } else if (actIdx > 0) {
          transitionToAct(actIdx - 1);
        }
      } else if (e.code === 'Enter' && isFinalAct && progress01 >= 0.6) {
        e.preventDefault();
        onComplete();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actIdx, elapsedMs, isFinalAct, onComplete, onSkip, progress01]);

  const activeCaption = useMemo(
    () =>
      resolvePrologueCaptionAt(act, progress01, {
        waywrightName,
        oathId: selectedOath,
      }),
    [act, progress01, waywrightName, selectedOath],
  );

  // Compute seismic tremor intensity around Scene II fracture beat
  const tremorPulse = useMemo(() => {
    if (reducedMotion || act.cameraTremorAtPct === undefined) return 0;
    const delta = progress01 - act.cameraTremorAtPct;
    if (delta < 0 || delta > 0.14) return 0;
    return Math.pow(1 - delta / 0.14, 1.6);
  }, [act.cameraTremorAtPct, progress01, reducedMotion]);

  const stageTransform = useMemo(() => {
    if (reducedMotion) return 'scale(1.03) translate3d(0%, 0%, 0)';
    const kb = act.kenBurns;
    const t = progress01;
    const scale = kb.fromScale + (kb.toScale - kb.fromScale) * t;
    let tx = kb.fromX + (kb.toX - kb.fromX) * t;
    let ty = kb.fromY + (kb.toY - kb.fromY) * t;
    // Gentle ferry sway on Scene I
    if (act.vfxPreset === 'dusk-ferry') {
      ty += Math.sin(t * Math.PI * 5) * 0.45;
      tx += Math.cos(t * Math.PI * 3) * 0.28;
    }
    // Sharp seismic camera shudder on Scene II fracture beat
    if (tremorPulse > 0.01) {
      tx += Math.sin(elapsedMs * 0.095) * tremorPulse * 1.1;
      ty += Math.cos(elapsedMs * 0.12) * tremorPulse * 0.85;
    }
    return `scale(${scale.toFixed(4)}) translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, 0)`;
  }, [act.kenBurns, act.vfxPreset, elapsedMs, progress01, reducedMotion, tremorPulse]);

  // Scene V dissolves smoothly from dawn painting directly into the live 3D WebGL2 Vaelmor engine!
  const paintedBackdropOpacity = useMemo(() => {
    if (!act.live3DReveal) return crossfadeAlpha;
    // Start revealing the live 3D causeway cleanly across the first 34% of Scene V
    const fadeOut = 1 - Math.min(1, progress01 / 0.34);
    return Math.max(0, fadeOut * crossfadeAlpha);
  }, [act.live3DReveal, crossfadeAlpha, progress01]);

  const actFinished = isFinalAct && progress01 >= 0.98;
  const showOathChoices = Boolean(act.interactiveOathBeat) && progress01 >= 0.32;

  return (
    <div
      data-testid="prologue-cinematic-overlay"
      role="dialog"
      aria-label="Frontiers and Foundations Animated Prologue"
      className="fixed inset-0 z-40 flex flex-col justify-between text-[#f3efe6] select-none overflow-hidden"
    >
      {/* FULL-BLEED CINEMATIC BACKDROP STAGE (Transparent in Scene V to Reveal Live 3D Vaelmor!) */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{
          backgroundColor: act.live3DReveal ? 'transparent' : '#06080c',
        }}
      >
        {/* Outgoing Scene during 950ms Film Crossfade Dissolve */}
        {prevAct && crossfadeAlpha < 0.99 && (
          <div
            className="absolute inset-0"
            style={{
              background: prevAct.fallbackGradient,
              opacity: act.live3DReveal ? Math.max(0, 1 - crossfadeAlpha) : 1,
            }}
          >
            {!failedImages[prevAct.actId] && (
              <img
                src={prevAct.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{
                  transform: `scale(${prevAct.kenBurns.toScale}) translate3d(${prevAct.kenBurns.toX}%, ${prevAct.kenBurns.toY}%, 0)`,
                }}
              />
            )}
          </div>
        )}

        {/* Active Animated Scene Painting (Dissolves to 0% in Scene V for Live 3D Reveal!) */}
        {paintedBackdropOpacity > 0.005 && (
          <div
            data-testid="prologue-painted-backdrop"
            className="absolute inset-0 transition-opacity duration-200 ease-linear"
            style={{
              background: act.fallbackGradient,
              opacity: paintedBackdropOpacity,
            }}
          >
            {!failedImages[act.actId] && (
              <img
                key={act.actId}
                src={act.imageUrl}
                alt={`${act.title} — ${act.subtitleLocation}`}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [act.actId]: true }))
                }
                className="w-full h-full object-cover transition-transform duration-200 ease-linear"
                style={{ transform: stageTransform }}
              />
            )}
          </div>
        )}

        {/* Real-Time 60fps Atmospheric VFX Layer (Rain, Embers, Silicate Dust, Volcanic Ash, Dawn Pollen) */}
        <PrologueAtmosphereCanvas
          preset={act.vfxPreset}
          paused={paused}
          reducedMotion={reducedMotion}
          tremorPulse={tremorPulse}
        />

        {/* Subtle Cinema Edge Vignette (Keeps Live 3D World Luminous in Scene V) */}
        <div
          className="absolute inset-0"
          style={{
            background: act.live3DReveal
              ? 'radial-gradient(ellipse at center, rgba(6,8,12,0) 48%, rgba(6,8,12,0.52) 100%)'
              : 'radial-gradient(ellipse at center, rgba(6,8,12,0.04) 38%, rgba(6,8,12,0.62) 100%)',
          }}
        />
      </div>

      {/* TOP ANAMORPHIC LETTERBOX BAR (Cinema Framing + Scene Timeline + Controls) */}
      <header className="relative z-20 px-6 sm:px-10 pt-4 pb-3.5 bg-[#05070a]/96 border-b border-white/8">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#d4a253] font-semibold">
                {act.chapterNumeral} of V
              </span>
              <span className="text-white/25">·</span>
              <span
                data-testid="prologue-location-subtitle"
                className="text-xs text-[#c7d0dc] truncate"
              >
                {act.subtitleLocation}
              </span>
              {act.live3DReveal && paintedBackdropOpacity < 0.25 && (
                <>
                  <span className="text-white/25 hidden sm:inline">·</span>
                  <span
                    data-testid="prologue-live-3d-badge"
                    className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-[#7fd1b6]"
                  >
                    Live in Vaelmor
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onToggleMute && (
                <button
                  type="button"
                  data-testid="prologue-mute-btn"
                  onClick={onToggleMute}
                  className="px-2.5 py-1.5 rounded-[2px] bg-[#121720] hover:bg-[#1c2432] border border-white/14 text-[11px] font-mono text-[#dce3ec] cursor-pointer transition-colors"
                >
                  {muted ? 'Audio: Muted' : 'Audio: On'}
                </button>
              )}

              <button
                type="button"
                data-testid="prologue-caption-size-btn"
                onClick={() => setLargeCaptions((v) => !v)}
                className="px-2.5 py-1.5 rounded-[2px] bg-[#121720] hover:bg-[#1c2432] border border-white/14 text-[11px] font-mono text-[#dce3ec] cursor-pointer transition-colors"
              >
                CC: {largeCaptions ? 'Large' : 'Standard'}
              </button>

              <button
                type="button"
                data-testid="prologue-pause-btn"
                onClick={() => setPaused((p) => !p)}
                className="px-3 py-1.5 rounded-[2px] bg-[#121720] hover:bg-[#1c2432] border border-white/14 text-[11px] font-mono uppercase tracking-[0.1em] text-[#ece8df] cursor-pointer transition-colors"
              >
                {paused ? 'Resume' : 'Pause'}
              </button>

              <button
                type="button"
                data-testid="prologue-skip-btn"
                onClick={onSkip}
                className="px-3.5 py-1.5 rounded-[2px] bg-[#1b222d] hover:bg-[#273242] border border-[#d4a253]/45 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#f0cd80] cursor-pointer transition-colors"
              >
                {isReplay ? 'Close Prologue' : 'Skip Prologue'}
              </button>
            </div>
          </div>

          {/* 5-Scene Film Scrub Bar */}
          <div className="grid grid-cols-5 gap-2" role="tablist" aria-label="Prologue Scenes">
            {PROLOGUE_CINEMATIC_ACTS.map((item, idx) => {
              const fillPct =
                idx < actIdx ? 100 : idx === actIdx ? Math.round(progress01 * 100) : 0;
              return (
                <button
                  key={item.actId}
                  type="button"
                  role="tab"
                  aria-selected={idx === actIdx}
                  data-testid={`prologue-act-tab-${idx + 1}`}
                  onClick={() => transitionToAct(idx)}
                  className="group text-left cursor-pointer focus:outline-none"
                >
                  <div className="h-1 w-full bg-white/12 rounded-[1px] overflow-hidden">
                    <div
                      className="h-full bg-[#d4a253] transition-[width] duration-75"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] truncate">
                    <span
                      className={`font-display font-semibold tracking-[0.06em] ${
                        idx === actIdx
                          ? 'text-[#f3efe6]'
                          : idx < actIdx
                            ? 'text-[#c3b28e]'
                            : 'text-[#778495] group-hover:text-[#b4bfcd]'
                      }`}
                    >
                      {item.chapterNumeral} · {item.shortLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* CENTER OPEN WIDESCREEN VIEWPORT (Clean Cinema — No Boxed Frames or Keybind Cards!) */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-between px-6 sm:px-12 py-6 pointer-events-none">
        {/* Top-Left Scene Title Card (Fades gently in and settles) */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-[0.26em] text-[#e6be72] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {act.chapterNumeral}
          </p>
          <h2
            data-testid="prologue-act-title"
            className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-[0.04em] text-[#f7f2e8] mt-1 drop-shadow-[0_4px_22px_rgba(0,0,0,0.92)]"
          >
            {act.title}
          </h2>
        </div>

        {/* Paused Watermark */}
        {paused && (
          <div className="self-center px-5 py-2.5 rounded-[2px] bg-[#090d13]/92 border border-[#d4a253]/50 font-display text-xs uppercase tracking-[0.24em] text-[#f0cd80]">
            Prologue Paused · Press Space to Resume
          </div>
        )}

        {/* Scene IV Interactive In-World Waywright Vow Selector */}
        {showOathChoices ? (
          <div
            data-testid="prologue-oath-choices"
            className="pointer-events-auto max-w-4xl mx-auto w-full"
          >
            <div className="flex justify-center mb-2">
              <p className="inline-block px-3.5 py-1 rounded-[2px] bg-[#070a0f]/90 border border-[#d4a253]/40 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f0cd80]">
                Swear Your Waywright Vow · Shapes Orenna’s Greeting at Dawn
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {WAYWRIGHT_OATH_CHOICES.map((choice) => {
                const isSelected = selectedOath === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`prologue-oath-${choice.id}`}
                    onClick={() => {
                      setSelectedOath(choice.id);
                      onSelectOath?.(choice.id);
                    }}
                    className={`text-left px-4 py-3 rounded-[2px] border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1c1a13]/95 border-[#e8be6c] shadow-[0_8px_28px_rgba(212,162,83,0.28)]'
                        : 'bg-[#0b0f15]/88 hover:bg-[#141b25]/92 border-white/18'
                    }`}
                  >
                    <p
                      className={`font-display text-xs font-bold uppercase tracking-[0.08em] ${
                        isSelected ? 'text-[#f4d48e]' : 'text-[#f1ede4]'
                      }`}
                    >
                      {choice.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-[#c5cedb] italic">
                      “{choice.vowLine}”
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* BOTTOM ANAMORPHIC LETTERBOX BAR (Sound-Design & Dialogue Closed Captions + Film Controls) */}
      <footer className="relative z-20 px-6 sm:px-10 pt-3.5 pb-4 bg-[#05070a]/96 border-t border-white/8">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          {/* Prestige Cinema Closed-Caption Strip */}
          <div
            data-testid="prologue-caption-box"
            aria-live="polite"
            className="w-full max-w-4xl mx-auto text-center px-3 sm:px-6"
          >
            {activeCaption.ambientSoundCue && (
              <p
                data-testid="prologue-sound-cue"
                className="text-[11px] sm:text-xs font-mono italic text-[#9ec7b8] mb-1 tracking-[0.03em]"
              >
                {activeCaption.ambientSoundCue}
              </p>
            )}
            <p
              data-testid="prologue-caption-text"
              className={`leading-relaxed text-[#f5f2eb] ${
                largeCaptions ? 'text-lg sm:text-xl font-medium' : 'text-sm sm:text-[15px]'
              }`}
            >
              <span
                data-testid="prologue-caption-speaker"
                className="font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em] text-[#e8be6c] mr-2.5"
              >
                {activeCaption.speaker}:
              </span>
              {activeCaption.text}
            </p>
          </div>

          {/* Minimal Cinema Transport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/8">
            <div className="flex items-center gap-4 text-[11px] font-mono text-[#8e9bab]">
              <span>Space: {paused ? 'Resume' : 'Pause'}</span>
              <span>← / →: Previous / Next Scene</span>
              <span className="hidden md:inline text-[#7a8999]">{act.audioCueLabel}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-testid="prologue-prev-btn"
                disabled={actIdx === 0 && elapsedMs < 800}
                onClick={() => (actIdx > 0 ? transitionToAct(actIdx - 1) : setElapsedMs(0))}
                className="px-4 py-2 rounded-[2px] bg-[#121720] hover:bg-[#1c2432] disabled:opacity-40 border border-white/14 text-xs font-display font-semibold uppercase tracking-[0.12em] text-[#e5e1d8] cursor-pointer transition-colors"
              >
                Previous
              </button>

              {!isFinalAct ? (
                <button
                  type="button"
                  data-testid="prologue-next-btn"
                  onClick={() => transitionToAct(actIdx + 1)}
                  className="px-5 py-2 rounded-[2px] bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] text-xs font-display font-bold uppercase tracking-[0.14em] cursor-pointer transition-colors"
                >
                  Next Scene
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="prologue-begin-btn"
                  onClick={onComplete}
                  className={`px-6 py-2.5 rounded-[2px] bg-[#d4a253] hover:bg-[#e1b366] text-[#14110b] text-xs font-display font-bold uppercase tracking-[0.14em] cursor-pointer transition-colors shadow-[0_6px_24px_rgba(212,162,83,0.35)] ${
                    actFinished ? 'ring-2 ring-[#f3d48c]/70' : ''
                  }`}
                >
                  {isReplay ? 'Return to Expedition' : 'Step Onto the Causeway'}
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
