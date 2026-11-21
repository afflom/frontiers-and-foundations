import React, { useEffect, useRef } from 'react';
import type { PrologueVfxPreset } from '../../verdant/verdantJourneyModel';

interface PrologueAtmosphereCanvasProps {
  preset: PrologueVfxPreset;
  paused: boolean;
  reducedMotion: boolean;
  tremorPulse: number; // 0..1 intensity spike during seismic crack
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  hue: 'amber' | 'emerald' | 'ash' | 'rain' | 'sun' | 'mist';
}

const MAX_CANVAS_WIDTH = 960;
const FRAME_INTERVAL_MS = 40; // ~25fps smooth atmospheric VFX with tiny CPU footprint

function createRadialSprite(innerRgba: string, midRgba: string, outerRgba: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const sctx = sprite.getContext('2d');
  if (sctx) {
    const g = sctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, innerRgba);
    g.addColorStop(0.45, midRgba);
    g.addColorStop(1, outerRgba);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 64, 64);
  }
  return sprite;
}

function seedParticles(preset: PrologueVfxPreset, w: number, h: number): Particle[] {
  const list: Particle[] = [];
  const count =
    preset === 'pier-fracture'
      ? 68
      : preset === 'vault-awakening'
        ? 60
        : preset === 'workshop-oath'
          ? 52
          : preset === 'dusk-ferry'
            ? 48
            : 44;

  for (let i = 0; i < count; i++) {
    if (preset === 'pier-fracture') {
      const isSilicate = i % 3 === 0;
      list.push({
        x: Math.random() * w,
        y: isSilicate ? h * (0.45 + Math.random() * 0.55) : Math.random() * h,
        vx: isSilicate ? (Math.random() - 0.5) * 20 : -95 - Math.random() * 55,
        vy: isSilicate ? -22 - Math.random() * 38 : 380 + Math.random() * 190,
        size: isSilicate ? 1.6 + Math.random() * 2.2 : 0.9 + Math.random() * 0.6,
        alpha: isSilicate ? 0.45 + Math.random() * 0.45 : 0.22 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        hue: isSilicate ? 'emerald' : 'rain',
      });
    } else if (preset === 'vault-awakening') {
      const isAsh = i % 3 === 0;
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 28,
        vy: isAsh ? -12 - Math.random() * 20 : -36 - Math.random() * 62,
        size: isAsh ? 2.0 + Math.random() * 2.6 : 1.3 + Math.random() * 2.2,
        alpha: isAsh ? 0.22 + Math.random() * 0.22 : 0.52 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        hue: isAsh ? 'ash' : 'amber',
      });
    } else if (preset === 'workshop-oath') {
      list.push({
        x: w * (0.1 + Math.random() * 0.8),
        y: h * (0.35 + Math.random() * 0.65),
        vx: (Math.random() - 0.5) * 22,
        vy: -22 - Math.random() * 44,
        size: 1.3 + Math.random() * 2.1,
        alpha: 0.45 + Math.random() * 0.48,
        phase: Math.random() * Math.PI * 2,
        hue: i % 5 === 0 ? 'emerald' : 'amber',
      });
    } else if (preset === 'dusk-ferry') {
      const isMist = i % 5 === 0;
      list.push({
        x: Math.random() * w,
        y: isMist ? h * (0.58 + Math.random() * 0.38) : Math.random() * h,
        vx: isMist ? 10 + Math.random() * 12 : 9 + Math.random() * 14,
        vy: isMist ? (Math.random() - 0.5) * 3 : -7 - Math.random() * 12,
        size: isMist ? 58 + Math.random() * 76 : 1.2 + Math.random() * 2.0,
        alpha: isMist ? 0.045 + Math.random() * 0.035 : 0.38 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        hue: isMist ? 'mist' : 'amber',
      });
    } else {
      // causeway-dawn: sunlit morning dust motes drifting across the live 3D world
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 10 + Math.random() * 16,
        vy: -5 - Math.random() * 10,
        size: 1.4 + Math.random() * 2.2,
        alpha: 0.34 + Math.random() * 0.44,
        phase: Math.random() * Math.PI * 2,
        hue: 'sun',
      });
    }
  }
  return list;
}

export const PrologueAtmosphereCanvas: React.FC<PrologueAtmosphereCanvasProps> = ({
  preset,
  paused,
  reducedMotion,
  tremorPulse,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tremorRef = useRef<number>(tremorPulse);
  tremorRef.current = tremorPulse;
  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.min(MAX_CANVAS_WIDTH, Math.max(320, window.innerWidth));
    let height = Math.max(240, Math.round((window.innerHeight / Math.max(1, window.innerWidth)) * width));

    const resize = () => {
      const vw = Math.max(320, window.innerWidth);
      const vh = Math.max(240, window.innerHeight);
      const scale = vw > MAX_CANVAS_WIDTH ? MAX_CANVAS_WIDTH / vw : 1;
      width = Math.round(vw * scale);
      height = Math.round(vh * scale);
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = seedParticles(preset, width, height);

    // Pre-rendered 64x64 radial sprites (zero per-frame gradient allocations or full-screen fills)
    const mistSprite =
      preset === 'dusk-ferry'
        ? createRadialSprite(
            'rgba(216, 228, 238, 0.9)',
            'rgba(210, 224, 236, 0.35)',
            'rgba(210, 224, 236, 0)',
          )
        : null;
    const washSprite =
      preset === 'workshop-oath'
        ? createRadialSprite(
            'rgba(245, 162, 68, 1)',
            'rgba(245, 162, 68, 0.32)',
            'rgba(245, 162, 68, 0)',
          )
        : preset === 'pier-fracture'
          ? createRadialSprite(
              'rgba(92, 232, 184, 1)',
              'rgba(52, 190, 148, 0.32)',
              'rgba(40, 160, 128, 0)',
            )
          : preset === 'causeway-dawn'
            ? createRadialSprite(
                'rgba(250, 218, 144, 1)',
                'rgba(248, 212, 134, 0.35)',
                'rgba(248, 212, 134, 0)',
              )
            : null;

    let simTime = 0;
    let lastDrawTs = 0;
    let lastStepTs = performance.now();
    let hasDrawnOnce = false;
    let rafId = 0;

    const renderFrame = (now: number) => {
      rafId = window.requestAnimationFrame(renderFrame);
      if (pausedRef.current && hasDrawnOnce) {
        lastStepTs = now;
        return;
      }
      if (lastDrawTs > 0 && now - lastDrawTs < FRAME_INTERVAL_MS) {
        return;
      }
      const dt = pausedRef.current
        ? 0
        : reducedMotion
          ? Math.min(0.06, (now - lastStepTs) / 1000) * 0.2
          : Math.min(0.06, (now - lastStepTs) / 1000);
      lastDrawTs = now;
      lastStepTs = now;
      simTime += dt;
      hasDrawnOnce = true;

      ctx.clearRect(0, 0, width, height);

      // Cached sprite atmospheric washes (fast drawImage, zero gradient allocations)
      if (preset === 'workshop-oath' && washSprite) {
        const flicker = 0.085 + Math.sin(simTime * 5.2) * 0.025 + Math.sin(simTime * 11.7) * 0.014;
        ctx.save();
        ctx.globalAlpha = flicker;
        const r = width * 0.56;
        ctx.drawImage(washSprite, width * 0.26 - r, height * 0.8 - r, r * 2, r * 2);
        ctx.restore();
      } else if (preset === 'pier-fracture' && washSprite) {
        const seamGlow = 0.1 + Math.sin(simTime * 3.1) * 0.03 + tremorRef.current * 0.28;
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, seamGlow);
        const r = width * 0.36;
        ctx.drawImage(washSprite, width * 0.56 - r, height * 0.78 - r, r * 2, r * 2);
        ctx.restore();
      } else if (preset === 'vault-awakening') {
        const ringT = (simTime * 0.32) % 1;
        const ringR = 32 + ringT * Math.max(width, height) * 0.48;
        const ringAlpha = (1 - ringT) * 0.16;
        ctx.strokeStyle = `rgba(242, 148, 64, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.62, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (preset === 'causeway-dawn' && washSprite) {
        const rayAlpha = 0.08 + Math.sin(simTime * 0.9) * 0.02;
        ctx.save();
        ctx.globalAlpha = rayAlpha;
        const r = width * 0.52;
        ctx.drawImage(washSprite, width * 0.35 - r, height * 0.15 - r, r * 2, r * 2);
        ctx.restore();
      }

      // Draw live atmospheric particles with flat fills/strokes + cached mist sprite
      for (const p of particles) {
        const drift = Math.sin(simTime * 1.4 + p.phase) * (p.hue === 'rain' ? 0 : 10);
        p.x += (p.vx + drift) * dt;
        p.y += p.vy * dt;

        if (p.hue === 'rain') {
          if (p.y > height + 30 || p.x < -30) {
            p.x = Math.random() * (width + 180);
            p.y = -20 - Math.random() * 80;
          }
        } else if (p.hue === 'mist') {
          if (p.x - p.size * 1.8 > width + 40) {
            p.x = -p.size * 1.8 - 30;
            p.y = height * (0.58 + Math.random() * 0.36);
          }
        } else {
          if (p.y < -20 || p.x < -40 || p.x > width + 40) {
            p.x = Math.random() * width;
            p.y = preset === 'pier-fracture' ? height * (0.62 + Math.random() * 0.4) : height + 10;
          }
        }

        const pulse = 0.72 + 0.28 * Math.sin(simTime * 2.8 + p.phase);
        const a = Math.min(0.95, p.alpha * pulse);

        if (p.hue === 'rain') {
          ctx.strokeStyle = `rgba(196, 222, 238, ${a.toFixed(3)})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.035, p.y + p.vy * 0.035);
          ctx.stroke();
        } else if (p.hue === 'mist' && mistSprite) {
          const rx = p.size * 1.75;
          const ry = p.size * 0.55;
          ctx.save();
          ctx.globalAlpha = a * 1.4;
          ctx.drawImage(mistSprite, p.x - rx, p.y - ry, rx * 2, ry * 2);
          ctx.restore();
        } else {
          const rgb =
            p.hue === 'emerald'
              ? '104, 240, 192'
              : p.hue === 'ash'
                ? '168, 152, 142'
                : p.hue === 'sun'
                  ? '252, 228, 162'
                  : '246, 178, 86';
          ctx.fillStyle = `rgba(${rgb}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [preset, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="prologue-vfx-canvas"
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
    />
  );
};
