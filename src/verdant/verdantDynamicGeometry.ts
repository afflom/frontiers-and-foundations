import { surfaceHeightAt, vaelmorHeightAt } from '../game/vaelmorRenderer';
import type { EnemyEntity, ProjectileEntity } from '../game/rpgLogic';
import type { FoundationBanner, GameNpc, GearSlotId, WorldInteractable } from '../game/worldData';
import type { RemotePlayerState } from '../game/multiplayerTypes';
import {
  compileNpcCharacterAppearance,
  compilePlayerCharacterAppearance,
  compileRemoteWaywrightAppearance,
  type VerdantCharacterAppearance,
} from './verdantCharacterCompiler';
import type { WaterPosture, WaterQuadTile } from './verdantEnvironmentPhysics';
import type { AmbientParticleKind, FaunaKitId } from './verdantEcosystemCatalog';

export interface DynamicParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  r: number;
  g: number;
  b: number;
  matCode: number; // 0 matte, 2 metal, 3 emissive, 4 organic skin/cloth
}

export interface SlashEffect {
  active: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  age: number;
  duration: number;
  isRadial: boolean;
  r: number;
  g: number;
  b: number;
}

export interface DynamicSceneInput {
  timeSec: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  playerSpeed: number;
  attackSwing: number; // 0..1
  activeGear: GearSlotId;
  dodgeTimer: number;
  npcs: GameNpc[];
  enemies: EnemyEntity[];
  interactables: WorldInteractable[];
  banners: FoundationBanner[];
  remotePlayers: RemotePlayerState[];
  projectiles: ProjectileEntity[];
  particles: DynamicParticle[];
  slashes: SlashEffect[];
  trackedCoords: [number, number] | null;
  highlightInteractableId: string | null;
  heightAt?: (x: number, z: number) => number;
  waterLevel?: number;
  waterTiles?: WaterQuadTile[];
  playerWaterPosture?: WaterPosture;
  gorgeZ?: number;
  gorgeWaveAmp?: number;
  showMagmaSeams?: boolean;
  showCoastalInlet?: boolean;
  isDungeon?: boolean;
  dungeonStyle?: string;
  faunaKit?: FaunaKitId;
  thermalVents?: Array<[number, number]>;
  ambientParticleKind?: AmbientParticleKind;
  ambientRgb?: [number, number, number];
}

export interface DynamicBuffers {
  pos: Float32Array;
  norm: Float32Array;
  col: Float32Array;
  idx: Uint32Array;
}

/**
 * Reusable zero-GC high-definition dynamic mesh packer targeting Verdant's
 * `scene-hd-renderer.mjs` WebGL2 3-pass CSM/GGX/ACES shader.
 *
 * Encodes Verdant material classes directly into vertex color `r` channel:
 *  - `mat = 0`: matte stone/wood/leather
 *  - `mat = 1`: animated reflective Fresnel water (`v_m == 1.0`)
 *  - `mat = 2`: metallic bronze/gold/copper/steel (`v_m == 2.0`)
 *  - `mat = 3`: luminous emissive runes/magma/crystals/bioluminescence (`v_m == 3.0`)
 *  - `mat = 4`: HD organic skin & layered woven fabric with wrap lighting + rim (`v_m == 4.0`)
 */
export class VerdantDynamicBatcher {
  private pos: Float32Array;
  private norm: Float32Array;
  private col: Float32Array;
  private idx: Uint32Array;
  private vCount = 0;
  private iCount = 0;
  private maxVerts: number;
  private maxIdx: number;

  constructor(maxVerts = 76000, maxIdx = 152000) {
    this.maxVerts = maxVerts;
    this.maxIdx = maxIdx;
    this.pos = new Float32Array(maxVerts * 3);
    this.norm = new Float32Array(maxVerts * 3);
    this.col = new Float32Array(maxVerts * 3);
    this.idx = new Uint32Array(maxIdx);
  }

  private reset(): void {
    this.vCount = 0;
    this.iCount = 0;
  }

  private ensureSpace(addV: number, addI: number): boolean {
    return this.vCount + addV <= this.maxVerts && this.iCount + addI <= this.maxIdx;
  }

  private pushV(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    r: number,
    g: number,
    b: number,
    matCode = 0,
  ): number {
    const vi = this.vCount++;
    const o = vi * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    const nl = Math.hypot(nx, ny, nz) || 1;
    this.norm[o] = nx / nl;
    this.norm[o + 1] = ny / nl;
    this.norm[o + 2] = nz / nl;
    const cr = Math.max(0.01, Math.min(0.985, r));
    this.col[o] = matCode + cr;
    this.col[o + 1] = Math.max(0.01, Math.min(0.99, g));
    this.col[o + 2] = Math.max(0.01, Math.min(0.99, b));
    return vi;
  }

  private addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    r: number,
    g: number,
    b: number,
    matCode = 0,
  ): void {
    if (!this.ensureSpace(4, 6)) return;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const i0 = this.pushV(p0[0], p0[1], p0[2], nx, ny, nz, r, g, b, matCode);
    const i1 = this.pushV(p1[0], p1[1], p1[2], nx, ny, nz, r, g, b, matCode);
    const i2 = this.pushV(p2[0], p2[1], p2[2], nx, ny, nz, r, g, b, matCode);
    const i3 = this.pushV(p3[0], p3[1], p3[2], nx, ny, nz, r, g, b, matCode);
    this.idx[this.iCount++] = i0;
    this.idx[this.iCount++] = i1;
    this.idx[this.iCount++] = i2;
    this.idx[this.iCount++] = i0;
    this.idx[this.iCount++] = i2;
    this.idx[this.iCount++] = i3;
  }

  private addBox(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
    r: number,
    g: number,
    b: number,
    matCode = 0,
    pitch = 0,
    roll = 0,
  ): void {
    if (!this.ensureSpace(24, 36)) return;
    const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const cpi = Math.cos(pitch), spi = Math.sin(pitch);
    const crl = Math.cos(roll), srl = Math.sin(roll);
    const xf = (lx: number, ly: number, lz: number): [number, number, number] => {
      const rx = lx * crl - ly * srl;
      const ry = lx * srl + ly * crl;
      const py = ry * cpi - lz * spi;
      const pz = ry * spi + lz * cpi;
      return [cx + rx * cyw + pz * syw, cy + py, cz - rx * syw + pz * cyw];
    };
    const p000 = xf(-hx, -hy, -hz);
    const p100 = xf(hx, -hy, -hz);
    const p110 = xf(hx, hy, -hz);
    const p010 = xf(-hx, hy, -hz);
    const p001 = xf(-hx, -hy, hz);
    const p101 = xf(hx, -hy, hz);
    const p111 = xf(hx, hy, hz);
    const p011 = xf(-hx, hy, hz);
    this.addQuad(p001, p101, p111, p011, r, g, b, matCode);
    this.addQuad(p100, p000, p010, p110, r, g, b, matCode);
    this.addQuad(p101, p100, p110, p111, r, g, b, matCode);
    this.addQuad(p000, p001, p011, p010, r, g, b, matCode);
    this.addQuad(p011, p111, p110, p010, r, g, b, matCode);
    this.addQuad(p000, p100, p101, p001, r, g, b, matCode);
  }

  private addOctahedron(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    yaw: number,
    r: number,
    g: number,
    b: number,
    matCode = 3,
  ): void {
    if (!this.ensureSpace(24, 24)) return;
    const top: [number, number, number] = [cx, cy + ry, cz];
    const bot: [number, number, number] = [cx, cy - ry, cz];
    const ring: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const a = yaw + (i * Math.PI) / 2;
      ring.push([cx + Math.cos(a) * rx, cy, cz + Math.sin(a) * rx]);
    }
    const addTri = (a: [number, number, number], p: [number, number, number], c: [number, number, number]) => {
      const ux = p[0] - a[0], uy = p[1] - a[1], uz = p[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const i0 = this.pushV(a[0], a[1], a[2], nx, ny, nz, r, g, b, matCode);
      const i1 = this.pushV(p[0], p[1], p[2], nx, ny, nz, r, g, b, matCode);
      const i2 = this.pushV(c[0], c[1], c[2], nx, ny, nz, r, g, b, matCode);
      this.idx[this.iCount++] = i0;
      this.idx[this.iCount++] = i1;
      this.idx[this.iCount++] = i2;
    };
    for (let i = 0; i < 4; i++) {
      const n = (i + 1) % 4;
      addTri(ring[n], ring[i], top);
      addTri(ring[i], ring[n], bot);
    }
  }

  private addRing(
    cx: number,
    cy: number,
    cz: number,
    rInner: number,
    rOuter: number,
    segs: number,
    r: number,
    g: number,
    b: number,
    matCode = 3,
  ): void {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.addQuad(
        [cx + c0 * rInner, cy, cz + s0 * rInner],
        [cx + c0 * rOuter, cy, cz + s0 * rOuter],
        [cx + c1 * rOuter, cy, cz + s1 * rOuter],
        [cx + c1 * rInner, cy, cz + s1 * rInner],
        r,
        g,
        b,
        matCode,
      );
    }
  }

  /**
   * High-definition smooth-normal tapered cylinder (shared smooth ring normals + optional caps)
   * eliminating faceted low-poly striping on limbs, torsos, cloaks, and architectural columns.
   */
  private addSmoothCylinder(
    cx: number,
    y0: number,
    cz: number,
    rBot: number,
    rTop: number,
    height: number,
    segs: number,
    r: number,
    g: number,
    b: number,
    matCode = 4,
    yaw = 0,
    tiltX = 0,
    tiltZ = 0,
    ellipZ = 1.0,
  ): void {
    const ringVerts = (segs + 1) * 2;
    const triIdx = segs * 6 + segs * 6;
    if (!this.ensureSpace(ringVerts + (segs + 2) * 2, triIdx)) return;

    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const ct = Math.cos(tiltX), st = Math.sin(tiltX);
    const czr = Math.cos(tiltZ), szr = Math.sin(tiltZ);

    const xfP = (lx: number, ly: number, lz: number): [number, number, number] => {
      const rx = lx * czr - ly * szr;
      const ry = lx * szr + ly * czr;
      const ty = ry * ct - lz * st;
      const tz = ry * st + lz * ct;
      return [cx + rx * cyw + tz * syw, y0 + ty, cz - rx * syw + tz * cyw];
    };
    const xfN = (lx: number, ly: number, lz: number): [number, number, number] => {
      const rx = lx * czr - ly * szr;
      const ry = lx * szr + ly * czr;
      const ty = ry * ct - lz * st;
      const tz = ry * st + lz * ct;
      return [rx * cyw + tz * syw, ty, -rx * syw + tz * cyw];
    };

    const slopeY = (rBot - rTop) / Math.max(0.01, height);
    const baseV = this.vCount;

    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const bp = xfP(ca * rBot, 0, sa * rBot * ellipZ);
      const tp = xfP(ca * rTop, height, sa * rTop * ellipZ);
      const n = xfN(ca, slopeY, sa / Math.max(0.4, ellipZ));
      this.pushV(bp[0], bp[1], bp[2], n[0], n[1], n[2], r, g, b, matCode);
      this.pushV(tp[0], tp[1], tp[2], n[0], n[1], n[2], r, g, b, matCode);
    }

    for (let i = 0; i < segs; i++) {
      const b0 = baseV + i * 2;
      const t0 = b0 + 1;
      const b1 = b0 + 2;
      const t1 = b0 + 3;
      this.idx[this.iCount++] = b1;
      this.idx[this.iCount++] = b0;
      this.idx[this.iCount++] = t0;
      this.idx[this.iCount++] = b1;
      this.idx[this.iCount++] = t0;
      this.idx[this.iCount++] = t1;
    }

    // Smooth top & bottom caps
    const topN = xfN(0, 1, 0);
    const botN = xfN(0, -1, 0);
    const topCenter = xfP(0, height, 0);
    const botCenter = xfP(0, 0, 0);
    const tcIdx = this.pushV(topCenter[0], topCenter[1], topCenter[2], topN[0], topN[1], topN[2], r, g, b, matCode);
    const bcIdx = this.pushV(botCenter[0], botCenter[1], botCenter[2], botN[0], botN[1], botN[2], r, g, b, matCode);
    const capStart = this.vCount;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const tp = xfP(ca * rTop, height, sa * rTop * ellipZ);
      const bp = xfP(ca * rBot, 0, sa * rBot * ellipZ);
      this.pushV(tp[0], tp[1], tp[2], topN[0], topN[1], topN[2], r, g, b, matCode);
      this.pushV(bp[0], bp[1], bp[2], botN[0], botN[1], botN[2], r, g, b, matCode);
    }
    for (let i = 0; i < segs; i++) {
      const t0 = capStart + i * 2;
      const b0 = t0 + 1;
      const t1 = t0 + 2;
      const b1 = t0 + 3;
      this.idx[this.iCount++] = tcIdx;
      this.idx[this.iCount++] = t1;
      this.idx[this.iCount++] = t0;
      this.idx[this.iCount++] = bcIdx;
      this.idx[this.iCount++] = b0;
      this.idx[this.iCount++] = b1;
    }
  }

  /**
   * High-definition smooth-normal UV ellipsoid (analytical vertex normals)
   * for sculpted character heads, facial anatomy, braided hair, beards, and pauldrons.
   */
  private addSmoothSphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    r: number,
    g: number,
    b: number,
    matCode = 4,
    yaw = 0,
    segs = 12,
    rings = 6,
  ): void {
    const vNeeded = (segs + 1) * (rings + 1);
    const iNeeded = segs * rings * 6;
    if (!this.ensureSpace(vNeeded, iNeeded)) return;

    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const baseV = this.vCount;
    const invRx = 1 / Math.max(0.005, rx);
    const invRy = 1 / Math.max(0.005, ry);
    const invRz = 1 / Math.max(0.005, rz);

    for (let ri = 0; ri <= rings; ri++) {
      const phi = -Math.PI * 0.5 + (ri / rings) * Math.PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let si = 0; si <= segs; si++) {
        const theta = (si / segs) * Math.PI * 2;
        const ct = Math.cos(theta), st = Math.sin(theta);
        const lx = ct * cp * rx;
        const ly = sp * ry;
        const lz = st * cp * rz;
        const wx = cx + lx * cyw + lz * syw;
        const wy = cy + ly;
        const wz = cz - lx * syw + lz * cyw;
        const nlx = lx * invRx * invRx;
        const nly = ly * invRy * invRy;
        const nlz = lz * invRz * invRz;
        const nwx = nlx * cyw + nlz * syw;
        const nwz = -nlx * syw + nlz * cyw;
        this.pushV(wx, wy, wz, nwx, nly, nwz, r, g, b, matCode);
      }
    }

    const row = segs + 1;
    for (let ri = 0; ri < rings; ri++) {
      for (let si = 0; si < segs; si++) {
        const a = baseV + ri * row + si;
        const bIdx = a + 1;
        const c = a + row;
        const d = c + 1;
        this.idx[this.iCount++] = bIdx;
        this.idx[this.iCount++] = a;
        this.idx[this.iCount++] = c;
        this.idx[this.iCount++] = bIdx;
        this.idx[this.iCount++] = c;
        this.idx[this.iCount++] = d;
      }
    }
  }

  /**
   * Renders a full High-Definition, Portrait-Matched 3D Character compiled by
   * `verdantCharacterCompiler.ts` and registered through Verdant's WASM Project Model API.
   */
  private addCompiledCharacter(
    x: number,
    y: number,
    z: number,
    yaw: number,
    app: VerdantCharacterAppearance,
    stridePhase: number,
    strideAmp: number,
    swingAmt: number,
    timeSec: number,
    waterPosture: WaterPosture = 'dry',
  ): void {
    const [bw, bh, bd] = app.buildScale;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const isSwimming = waterPosture === 'swimming';
    const swimTilt = isSwimming ? 0.68 : 0;
    const cosTilt = Math.cos(swimTilt);
    const sinTilt = Math.sin(swimTilt);

    const local = (lx: number, ly: number, lz: number): [number, number, number] => {
      let adjY = ly;
      let adjZ = lz;
      if (isSwimming && ly < 1.42) {
        // Pitch torso & legs into horizontal swimming posture around chest pivot while keeping head clear above water
        const py = ly - 1.24;
        adjY = 1.24 + py * cosTilt - lz * sinTilt;
        adjZ = py * sinTilt + lz * cosTilt;
      }
      return [
        x + (lx * bw * cyw + adjZ * bd * syw),
        y + adjY * bh,
        z + (-lx * bw * syw + adjZ * bd * cyw),
      ];
    };

    const swimCycle = timeSec * (3.6 + strideAmp * 3.8);
    const legSwing = isSwimming
      ? Math.sin(swimCycle * 1.4) * (0.28 + strideAmp * 0.25)
      : Math.sin(stridePhase) * 0.44 * strideAmp;
    const armSwing = isSwimming
      ? Math.sin(swimCycle) * (0.55 + strideAmp * 0.55)
      : -legSwing * 0.72;
    const breathe = Math.sin(timeSec * 2.1 + x * 0.7) * 0.014;
    const bob = isSwimming
      ? Math.sin(timeSec * 2.8) * 0.04
      : Math.abs(Math.sin(stridePhase)) * 0.055 * strideAmp + breathe;

    const [sr, sg, sb] = app.skinRgb;
    const [hr, hg, hb] = app.hairRgb;
    const [gr, gg, gb] = app.garmentRgb;
    const [ur, ug, ub] = app.underTunicRgb;
    const [tr, tg, tb] = app.trimRgb;
    const [lr, lg, lb] = app.leatherRgb;
    const [cr, cg, cb] = app.claspRgb;

    // 1. Sculpted Boots, Calves & Thighs (heroic RPG proportions)
    const lFoot = local(-0.125, 0.0 + bob * 0.35, legSwing * 0.24);
    const rFoot = local(0.125, 0.0 + bob * 0.35, -legSwing * 0.24);
    this.addSmoothCylinder(lFoot[0], lFoot[1], lFoot[2], 0.078 * bw, 0.095 * bw, 0.44 * bh, 10, lr * 0.52, lg * 0.48, lb * 0.46, 4, yaw, legSwing * 0.42);
    this.addSmoothCylinder(rFoot[0], rFoot[1], rFoot[2], 0.078 * bw, 0.095 * bw, 0.44 * bh, 10, lr * 0.52, lg * 0.48, lb * 0.46, 4, yaw, -legSwing * 0.42);
    // Boot toe caps & knee guards
    const lToe = local(-0.125, 0.055, 0.075 + legSwing * 0.22);
    const rToe = local(0.125, 0.055, 0.075 - legSwing * 0.22);
    this.addSmoothSphere(lToe[0], lToe[1], lToe[2], 0.072 * bw, 0.052 * bh, 0.11 * bd, lr * 0.48, lg * 0.45, lb * 0.43, 4, yaw, 8, 4);
    this.addSmoothSphere(rToe[0], rToe[1], rToe[2], 0.072 * bw, 0.052 * bh, 0.11 * bd, lr * 0.48, lg * 0.45, lb * 0.43, 4, yaw, 8, 4);
    // Upper legs / tailored trousers
    const lThigh = local(-0.125, 0.4 + bob * 0.55, legSwing * 0.14);
    const rThigh = local(0.125, 0.4 + bob * 0.55, -legSwing * 0.14);
    this.addSmoothCylinder(lThigh[0], lThigh[1], lThigh[2], 0.098 * bw, 0.112 * bw, 0.44 * bh, 10, ur * 0.72, ug * 0.72, ub * 0.74, 4, yaw, legSwing * 0.28);
    this.addSmoothCylinder(rThigh[0], rThigh[1], rThigh[2], 0.098 * bw, 0.112 * bw, 0.44 * bh, 10, ur * 0.72, ug * 0.72, ub * 0.74, 4, yaw, -legSwing * 0.28);

    // 2. Portrait-Matched Garment Silhouette (Refined V-taper waist-to-shoulder anatomy)
    const waist = local(0, 0.82 + bob, 0);
    const chest = local(0, 0.92 + bob, 0);

    if (app.garmentStyle === 'hooded-cloak') {
      // ORENNA VAEL: Brown leather inner tunic + sweeping dark slate travel cloak + folded hood + gold runic chest brooch
      this.addSmoothCylinder(waist[0], waist[1] - 0.36 * bh, waist[2], 0.29 * bw, 0.20 * bw, 0.44 * bh, 14, ur, ug, ub, 4, yaw, 0, 0, 0.82);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.20 * bw, 0.26 * bw, 0.56 * bh, 14, ur * 0.95, ug * 0.95, ub * 0.95, 4, yaw, 0, 0, 0.78);
      // Sweeping dark slate hooded cloak mantle draped cleanly around shoulders and back
      const cloakLow = local(0, 0.24 + bob, -0.055);
      this.addSmoothCylinder(cloakLow[0], cloakLow[1], cloakLow[2], 0.37 * bw, 0.29 * bw, 0.68 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.84);
      const cloakUpper = local(0, 0.90 + bob, -0.045);
      this.addSmoothCylinder(cloakUpper[0], cloakUpper[1], cloakUpper[2], 0.30 * bw, 0.29 * bw, 0.54 * bh, 14, gr * 1.04, gg * 1.04, gb * 1.06, 4, yaw, 0, 0, 0.85);
      // Folded cowl/hood collar framing neck & shoulders
      const cowl = local(0, 1.42 + bob, -0.025);
      this.addSmoothSphere(cowl[0], cowl[1], cowl[2], 0.28 * bw, 0.115 * bh, 0.23 * bd, gr * 1.08, gg * 1.08, gb * 1.1, 4, yaw, 14, 5);
      const hoodBack = local(0, 1.58 + bob, -0.13);
      this.addSmoothSphere(hoodBack[0], hoodBack[1], hoodBack[2], 0.20 * bw, 0.17 * bh, 0.14 * bd, gr * 0.96, gg * 0.96, gb * 1.0, 4, yaw, 12, 5);
      // Prominent embossed gold runic brooch at collar front
      const brooch = local(0, 1.39 + bob, 0.205);
      this.addBox(brooch[0], brooch[1], brooch[2], 0.18 * bw, 0.068 * bh, 0.045 * bd, yaw, cr, cg, cb, 2);
      // Cross-body leather harness straps
      const strapL = local(-0.085, 1.14 + bob, 0.185);
      const strapR = local(0.085, 1.14 + bob, 0.185);
      this.addBox(strapL[0], strapL[1], strapL[2], 0.046 * bw, 0.48 * bh, 0.036 * bd, yaw, lr, lg, lb, 4, 0, 0.26);
      this.addBox(strapR[0], strapR[1], strapR[2], 0.046 * bw, 0.48 * bh, 0.036 * bd, yaw, lr, lg, lb, 4, 0, -0.26);
    } else if (app.garmentStyle === 'oilskin-coat') {
      // KAELEN OF THE SALT LOOM: Sea-green weathered oilskin coat + wide upturned storm collar + shoulder capelet
      const coatLow = local(0, 0.28 + bob, -0.02);
      this.addSmoothCylinder(coatLow[0], coatLow[1], coatLow[2], 0.34 * bw, 0.24 * bw, 0.58 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.84);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.23 * bw, 0.30 * bw, 0.58 * bh, 14, gr * 1.05, gg * 1.05, gb * 1.05, 4, yaw, 0, 0, 0.80);
      // Inner wool vest visible at open chest V
      const vest = local(0, 1.21 + bob, 0.185);
      this.addBox(vest[0], vest[1], vest[2], 0.14 * bw, 0.40 * bh, 0.055 * bd, yaw, ur, ug, ub, 4);
      // Weathered shoulder storm capelet
      const capelet = local(0, 1.28 + bob, -0.02);
      this.addSmoothCylinder(capelet[0], capelet[1], capelet[2], 0.37 * bw, 0.26 * bw, 0.22 * bh, 14, gr * 0.94, gg * 0.96, gb * 0.95, 4, yaw, 0, 0, 0.80);
      // Wide upturned storm collar behind jaw
      const collarL = local(-0.145, 1.50 + bob, 0.025);
      const collarR = local(0.145, 1.50 + bob, 0.025);
      const collarB = local(0, 1.52 + bob, -0.12);
      this.addBox(collarL[0], collarL[1], collarL[2], 0.055 * bw, 0.16 * bh, 0.20 * bd, yaw + 0.25, gr * 1.1, gg * 1.1, gb * 1.08, 4, 0, -0.28);
      this.addBox(collarR[0], collarR[1], collarR[2], 0.055 * bw, 0.16 * bh, 0.20 * bd, yaw - 0.25, gr * 1.1, gg * 1.1, gb * 1.08, 4, 0, 0.28);
      this.addBox(collarB[0], collarB[1], collarB[2], 0.28 * bw, 0.18 * bh, 0.055 * bd, yaw, gr * 1.05, gg * 1.05, gb * 1.05, 4, -0.16);
      // Leather cross-strap
      const strap = local(0, 1.18 + bob, 0.20);
      this.addBox(strap[0], strap[1], strap[2], 0.055 * bw, 0.58 * bh, 0.036 * bd, yaw, lr, lg, lb, 4, 0, 0.40);
    } else if (app.garmentStyle === 'smith-apron') {
      // TARSIK THE BELL-MAKER: Broad stocky charcoal tunic + burnished chestnut leather blacksmith apron + straps
      this.addSmoothCylinder(chest[0], chest[1] - 0.06 * bh, chest[2], 0.25 * bw, 0.32 * bw, 0.64 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.82);
      // Full chestnut leather blacksmith apron bib & lower skirt
      const apronLow = local(0, 0.36 + bob, 0.115);
      this.addBox(apronLow[0], apronLow[1], apronLow[2], 0.40 * bw, 0.56 * bh, 0.14 * bd, yaw, lr, lg, lb, 4);
      const apronBib = local(0, 1.12 + bob, 0.19);
      this.addBox(apronBib[0], apronBib[1], apronBib[2], 0.31 * bw, 0.50 * bh, 0.11 * bd, yaw, lr * 1.06, lg * 1.04, lb * 1.02, 4);
      // Leather apron shoulder straps
      const sL = local(-0.135, 1.40 + bob, 0.105);
      const sR = local(0.135, 1.40 + bob, 0.105);
      this.addBox(sL[0], sL[1], sL[2], 0.044 * bw, 0.24 * bh, 0.19 * bd, yaw, lr * 0.9, lg * 0.88, lb * 0.85, 4);
      this.addBox(sR[0], sR[1], sR[2], 0.044 * bw, 0.24 * bh, 0.19 * bd, yaw, lr * 0.9, lg * 0.88, lb * 0.85, 4);
    } else if (app.garmentStyle === 'herbalist-coat') {
      // SERAIA OF THE ROOTWARD: Tailored sage-moss embroidered high-collar jacket + brown/gold shoulder lapels + leaf clasp
      const coatLow = local(0, 0.36 + bob, 0);
      this.addSmoothCylinder(coatLow[0], coatLow[1], coatLow[2], 0.31 * bw, 0.20 * bw, 0.48 * bh, 14, gr * 0.95, gg * 0.95, gb * 0.95, 4, yaw, 0, 0, 0.82);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.195 * bw, 0.255 * bw, 0.56 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.78);
      // Embroidered high collar
      const hiCollar = local(0, 1.46 + bob, -0.015);
      this.addSmoothCylinder(hiCollar[0], hiCollar[1], hiCollar[2], 0.165 * bw, 0.188 * bw, 0.13 * bh, 14, gr * 1.08, gg * 1.08, gb * 1.06, 4, yaw, 0, 0, 0.84);
      // Brown & gold trimmed leather shoulder epaulets
      const shL = local(-0.255, 1.42 + bob, 0);
      const shR = local(0.255, 1.42 + bob, 0);
      this.addSmoothSphere(shL[0], shL[1], shL[2], 0.125 * bw, 0.08 * bh, 0.14 * bd, lr, lg, lb, 4, yaw, 10, 4);
      this.addSmoothSphere(shR[0], shR[1], shR[2], 0.125 * bw, 0.08 * bh, 0.14 * bd, lr, lg, lb, 4, yaw, 10, 4);
      // Gold lapel piping & emerald leaf clasp at collar
      const leaf = local(0, 1.38 + bob, 0.20);
      this.addOctahedron(leaf[0], leaf[1], leaf[2], 0.052 * bw, 0.072 * bh, yaw, cr, cg, cb, 4);
      const goldTrimL = local(-0.095, 1.26 + bob, 0.19);
      const goldTrimR = local(0.095, 1.26 + bob, 0.19);
      this.addBox(goldTrimL[0], goldTrimL[1], goldTrimL[2], 0.03 * bw, 0.32 * bh, 0.034 * bd, yaw, tr, tg, tb, 2, 0, 0.2);
      this.addBox(goldTrimR[0], goldTrimR[1], goldTrimR[2], 0.03 * bw, 0.32 * bh, 0.034 * bd, yaw, tr, tg, tb, 2, 0, -0.2);
    } else if (app.garmentStyle === 'archon-vestments') {
      // Ceremonial meridian surveyor/archon robes with gold shoulder stole and pleated hem
      const robeLow = local(0, 0.24 + bob, 0);
      this.addSmoothCylinder(robeLow[0], robeLow[1], robeLow[2], 0.36 * bw, 0.22 * bw, 0.62 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.84);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.21 * bw, 0.27 * bw, 0.58 * bh, 14, gr * 1.05, gg * 1.05, gb * 1.05, 4, yaw, 0, 0, 0.80);
      // Draped embroidered ceremonial stole across shoulders & chest V
      const stole = local(0, 1.38 + bob, 0.02);
      this.addSmoothSphere(stole[0], stole[1], stole[2], 0.31 * bw, 0.095 * bh, 0.23 * bd, tr, tg, tb, 2, yaw, 14, 5);
      const tabard = local(0, 0.86 + bob, 0.19);
      this.addBox(tabard[0], tabard[1], tabard[2], 0.16 * bw, 0.96 * bh, 0.04 * bd, yaw, ur, ug, ub, 4);
      const brooch = local(0, 1.38 + bob, 0.21);
      this.addOctahedron(brooch[0], brooch[1], brooch[2], 0.062 * bw, 0.072 * bh, yaw, cr, cg, cb, 2);
    } else if (app.garmentStyle === 'ranger-brigandine') {
      // Layered frontier brigandine jerkin + armored shoulder plates + weathered travel mantle
      const skirt = local(0, 0.42 + bob, 0);
      this.addSmoothCylinder(skirt[0], skirt[1], skirt[2], 0.28 * bw, 0.21 * bw, 0.42 * bh, 14, lr, lg, lb, 4, yaw, 0, 0, 0.82);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.22 * bw, 0.29 * bw, 0.58 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.80);
      // Studded leather brigandine chest cuirass & armored pauldrons
      const cuirass = local(0, 1.18 + bob, 0.18);
      this.addBox(cuirass[0], cuirass[1], cuirass[2], 0.32 * bw, 0.44 * bh, 0.08 * bd, yaw, lr * 0.92, lg * 0.9, lb * 0.88, 4);
      const lP = local(-0.29, 1.43 + bob, 0);
      const rP = local(0.29, 1.43 + bob, 0);
      this.addSmoothSphere(lP[0], lP[1], lP[2], 0.13 * bw, 0.09 * bh, 0.14 * bd, tr, tg, tb, 2, yaw, 10, 4);
      this.addSmoothSphere(rP[0], rP[1], rP[2], 0.13 * bw, 0.09 * bh, 0.14 * bd, tr, tg, tb, 2, yaw, 10, 4);
      const cape = local(0, 1.02 + bob, -0.21);
      this.addBox(cape[0], cape[1], cape[2], 0.40 * bw, 0.84 * bh, 0.036 * bd, yaw, gr * 0.82, gg * 0.82, gb * 0.85, 4, -0.16);
    } else {
      // PLAYER WAYWRIGHT & GUILD PEERS: Tailored frontier longcoat, sculpted bronze pauldrons, leather bandolier, dynamic cloak
      const coatLow = local(0, 0.40 + bob, 0);
      this.addSmoothCylinder(coatLow[0], coatLow[1], coatLow[2], 0.30 * bw, 0.21 * bw, 0.44 * bh, 14, gr * 0.88, gg * 0.88, gb * 0.92, 4, yaw, 0, 0, 0.80);
      this.addSmoothCylinder(chest[0], chest[1], chest[2], 0.21 * bw, 0.285 * bw, 0.58 * bh, 14, gr, gg, gb, 4, yaw, 0, 0, 0.80);
      // Articulated bronze shoulder pauldrons
      if (app.hasPauldrons) {
        const lP = local(-0.295, 1.43 + bob, 0);
        const rP = local(0.295, 1.43 + bob, 0);
        this.addSmoothSphere(lP[0], lP[1], lP[2], 0.135 * bw, 0.095 * bh, 0.145 * bd, tr, tg, tb, 2, yaw, 12, 5);
        this.addSmoothSphere(rP[0], rP[1], rP[2], 0.135 * bw, 0.095 * bh, 0.145 * bd, tr, tg, tb, 2, yaw, 12, 5);
      }
      // Bronze mantle collar & chest crest
      const collar = local(0, 1.46 + bob, 0);
      this.addSmoothCylinder(collar[0], collar[1], collar[2], 0.22 * bw, 0.165 * bw, 0.10 * bh, 14, lr, lg, lb, 4, yaw, 0, 0, 0.82);
      const crest = local(0, 1.34 + bob, 0.22);
      this.addOctahedron(crest[0], crest[1], crest[2], 0.068 * bw, 0.078 * bh, yaw, cr, cg, cb, 2);
      // Leather cross-bandolier
      const bandolier = local(0, 1.18 + bob, 0.195);
      this.addBox(bandolier[0], bandolier[1], bandolier[2], 0.048 * bw, 0.58 * bh, 0.036 * bd, yaw, lr, lg, lb, 4, 0, -0.44);
      // Dynamic split traveler cloak trailing smoothly behind shoulders
      const capeSway = 0.18 + strideAmp * 0.34 + Math.sin(stridePhase * 0.65) * 0.06;
      const cape = local(0, 0.98 + bob, -0.22 - capeSway * 0.18);
      this.addBox(cape[0], cape[1], cape[2], 0.44 * bw, 0.90 * bh, 0.04 * bd, yaw, gr * 0.78, gg * 0.8, gb * 0.86, 4, -capeSway);
    }

    // Smooth shoulder deltoid caps blending torso into upper arms
    const upperSleeveRgb = app.garmentStyle === 'hooded-cloak' ? app.underTunicRgb : app.garmentRgb;
    const capL = local(-0.275, 1.38 + bob, 0.01);
    const capR = local(0.275, 1.38 + bob, 0.01);
    this.addSmoothSphere(capL[0], capL[1], capL[2], 0.095 * bw, 0.095 * bh, 0.105 * bd, upperSleeveRgb[0], upperSleeveRgb[1], upperSleeveRgb[2], 4, yaw, 10, 4);
    this.addSmoothSphere(capR[0], capR[1], capR[2], 0.095 * bw, 0.095 * bh, 0.105 * bd, upperSleeveRgb[0], upperSleeveRgb[1], upperSleeveRgb[2], 4, yaw, 10, 4);

    // 3. Waist Belt & Portrait-Matched Satchels / Scroll Pouches
    const belt = local(0, 0.86 + bob, 0);
    this.addSmoothCylinder(belt[0], belt[1], belt[2], 0.235 * bw, 0.235 * bw, 0.08 * bh, 14, lr * 0.82, lg * 0.78, lb * 0.75, 4, yaw, 0, 0, 0.82);
    const buckle = local(0, 0.90 + bob, 0.205);
    this.addBox(buckle[0], buckle[1], buckle[2], 0.075 * bw, 0.068 * bh, 0.04 * bd, yaw, tr, tg, tb, 2);

    if (app.satchelStyle === 'twin-scroll') {
      const satL = local(-0.23, 0.76 + bob, 0.09);
      const satR = local(0.23, 0.76 + bob, 0.09);
      this.addBox(satL[0], satL[1], satL[2], 0.135 * bw, 0.20 * bh, 0.12 * bd, yaw + 0.3, lr, lg, lb, 4);
      this.addBox(satR[0], satR[1], satR[2], 0.135 * bw, 0.20 * bh, 0.12 * bd, yaw - 0.3, lr, lg, lb, 4);
      const scr = local(0.21, 0.87 + bob, 0.12);
      this.addSmoothCylinder(scr[0], scr[1], scr[2], 0.026, 0.026, 0.16, 8, 0.86, 0.78, 0.62, 4, yaw, 0.4, -0.3);
    } else if (app.satchelStyle === 'chart-satchel') {
      const sat = local(-0.25, 0.72 + bob, 0.04);
      this.addBox(sat[0], sat[1], sat[2], 0.15 * bw, 0.22 * bh, 0.18 * bd, yaw + 0.15, lr, lg, lb, 4);
      const map1 = local(-0.27, 0.85 + bob, -0.02);
      this.addSmoothCylinder(map1[0], map1[1], map1[2], 0.028, 0.028, 0.22, 8, 0.84, 0.76, 0.6, 4, yaw, -0.35, 0.35);
    } else if (app.satchelStyle === 'herb-satchel') {
      const sat = local(0.24, 0.74 + bob, 0.07);
      this.addBox(sat[0], sat[1], sat[2], 0.14 * bw, 0.20 * bh, 0.17 * bd, yaw - 0.2, lr, lg, lb, 4);
      const vial = local(0.27, 0.83 + bob, 0.14);
      this.addSmoothCylinder(vial[0], vial[1], vial[2], 0.021, 0.021, 0.11, 8, 0.36, 0.88, 0.74, 3, yaw);
    }

    // 4. Sculpted Neck, Heroic Oval Head, Defined Jawline, Eyes, Brows & Portrait-Matched Hair/Beard
    const neck = local(0, 1.48 + bob, 0.01);
    this.addSmoothCylinder(neck[0], neck[1], neck[2], 0.075 * bw, 0.068 * bw, 0.14 * bh, 10, sr * 0.93, sg * 0.92, sb * 0.91, 4, yaw);
    // Cranium + tapered sculpted jaw/chin for refined RPG facial structure
    const head = local(0, 1.70 + bob, 0.015);
    this.addSmoothSphere(head[0], head[1], head[2], 0.132 * bw, 0.158 * bh, 0.145 * bd, sr, sg, sb, 4, yaw, 14, 7);
    const jaw = local(0, 1.60 + bob, 0.042);
    this.addSmoothSphere(jaw[0], jaw[1], jaw[2], 0.095 * bw, 0.078 * bh, 0.105 * bd, sr * 0.98, sg * 0.97, sb * 0.96, 4, yaw, 10, 5);
    // Ears
    const earL = local(-0.128, 1.68 + bob, 0.01);
    const earR = local(0.128, 1.68 + bob, 0.01);
    this.addSmoothSphere(earL[0], earL[1], earL[2], 0.024 * bw, 0.036 * bh, 0.028 * bd, sr * 0.92, sg * 0.9, sb * 0.88, 4, yaw, 6, 4);
    this.addSmoothSphere(earR[0], earR[1], earR[2], 0.024 * bw, 0.036 * bh, 0.028 * bd, sr * 0.92, sg * 0.9, sb * 0.88, 4, yaw, 6, 4);
    // Sculpted nose bridge, subtle sclera + iris eyes, contoured eyebrows & lip shadow
    const nose = local(0, 1.67 + bob, 0.155);
    this.addSmoothSphere(nose[0], nose[1], nose[2], 0.019 * bw, 0.034 * bh, 0.026 * bd, sr * 0.94, sg * 0.91, sb * 0.89, 4, yaw, 8, 4);
    const scleraL = local(-0.048, 1.705 + bob, 0.132);
    const scleraR = local(0.048, 1.705 + bob, 0.132);
    this.addSmoothSphere(scleraL[0], scleraL[1], scleraL[2], 0.019 * bw, 0.012 * bh, 0.012 * bd, 0.92, 0.91, 0.89, 4, yaw, 8, 4);
    this.addSmoothSphere(scleraR[0], scleraR[1], scleraR[2], 0.019 * bw, 0.012 * bh, 0.012 * bd, 0.92, 0.91, 0.89, 4, yaw, 8, 4);
    const eyeL = local(-0.048, 1.705 + bob, 0.141);
    const eyeR = local(0.048, 1.705 + bob, 0.141);
    this.addSmoothSphere(eyeL[0], eyeL[1], eyeL[2], 0.012 * bw, 0.011 * bh, 0.010 * bd, app.eyeRgb[0], app.eyeRgb[1], app.eyeRgb[2], 4, yaw, 8, 4);
    this.addSmoothSphere(eyeR[0], eyeR[1], eyeR[2], 0.012 * bw, 0.011 * bh, 0.010 * bd, app.eyeRgb[0], app.eyeRgb[1], app.eyeRgb[2], 4, yaw, 8, 4);
    const browL = local(-0.050, 1.734 + bob, 0.140);
    const browR = local(0.050, 1.734 + bob, 0.140);
    this.addBox(browL[0], browL[1], browL[2], 0.046 * bw, 0.011 * bh, 0.016 * bd, yaw, hr * 0.82, hg * 0.82, hb * 0.82, 4, 0, -0.06);
    this.addBox(browR[0], browR[1], browR[2], 0.046 * bw, 0.011 * bh, 0.016 * bd, yaw, hr * 0.82, hg * 0.82, hb * 0.82, 4, 0, 0.06);
    if (app.beardStyle === 'none') {
      const mouth = local(0, 1.615 + bob, 0.136);
      this.addBox(mouth[0], mouth[1], mouth[2], 0.046 * bw, 0.012 * bh, 0.014 * bd, yaw, sr * 0.76, sg * 0.62, sb * 0.58, 4);
    }

    // Hair styles matching portraits!
    if (app.hairStyle === 'braided-crown') {
      // Orenna: Silver-grey crown hair + sculpted 6-link braid cascading gracefully over left shoulder
      const crown = local(0, 1.755 + bob, -0.015);
      this.addSmoothSphere(crown[0], crown[1], crown[2], 0.148 * bw, 0.125 * bh, 0.16 * bd, hr, hg, hb, 4, yaw, 14, 6);
      const band = local(0, 1.79 + bob, 0.025);
      this.addSmoothCylinder(band[0], band[1], band[2], 0.142 * bw, 0.132 * bw, 0.052 * bh, 14, hr * 1.07, hg * 1.07, hb * 1.07, 4, yaw, 0.24);
      for (let bi = 0; bi < 6; bi++) {
        const bp = local(-0.125 - bi * 0.01, 1.66 - bi * 0.072 + bob, 0.03 + bi * 0.036);
        const br = (0.044 - bi * 0.0035) * bw;
        this.addSmoothSphere(bp[0], bp[1], bp[2], br, 0.042 * bh, br, hr * (0.94 + (bi % 2) * 0.08), hg * (0.94 + (bi % 2) * 0.08), hb * (0.94 + (bi % 2) * 0.08), 4, yaw, 8, 4);
      }
    } else if (app.hairStyle === 'windswept') {
      // Kaelen: Windswept silver-streaked mane sweeping dramatically back & right
      const mane = local(0, 1.77 + bob, -0.025);
      this.addSmoothSphere(mane[0], mane[1], mane[2], 0.152 * bw, 0.122 * bh, 0.172 * bd, hr, hg, hb, 4, yaw, 14, 6);
      const sweep1 = local(-0.07, 1.78 + bob, -0.115);
      const sweep2 = local(0.095, 1.76 + bob, -0.105);
      this.addSmoothSphere(sweep1[0], sweep1[1], sweep1[2], 0.115 * bw, 0.085 * bh, 0.135 * bd, hr * 1.08, hg * 1.08, hb * 1.1, 4, yaw, 8, 4);
      this.addSmoothSphere(sweep2[0], sweep2[1], sweep2[2], 0.105 * bw, 0.092 * bh, 0.125 * bd, hr * 0.9, hg * 0.92, hb * 0.94, 4, yaw, 8, 4);
    } else if (app.hairStyle === 'cropped-grey') {
      // Tarsik: Short cropped iron-grey hair
      const cap = local(0, 1.77 + bob, -0.01);
      this.addSmoothSphere(cap[0], cap[1], cap[2], 0.142 * bw, 0.105 * bh, 0.152 * bd, hr, hg, hb, 4, yaw, 12, 5);
    } else if (app.hairStyle === 'braided-locs') {
      // Seraia: Sculpted dark braided locs swept back into cascading rear braids with bronze cuff
      const crown = local(0, 1.755 + bob, -0.015);
      this.addSmoothSphere(crown[0], crown[1], crown[2], 0.146 * bw, 0.122 * bh, 0.16 * bd, hr, hg, hb, 4, yaw, 14, 6);
      for (const side of [-0.06, 0.0, 0.06]) {
        for (let bi = 0; bi < 4; bi++) {
          const lp = local(side * (1 + bi * 0.14), 1.65 - bi * 0.09 + bob, -0.135 - bi * 0.026);
          this.addSmoothSphere(lp[0], lp[1], lp[2], 0.038 * bw, 0.054 * bh, 0.038 * bd, hr, hg, hb, 4, yaw, 8, 4);
        }
      }
      const cuff = local(0, 1.56 + bob, -0.16);
      this.addSmoothCylinder(cuff[0], cuff[1], cuff[2], 0.058, 0.054, 0.044, 10, tr, tg, tb, 2, yaw, -0.3);
    } else if (app.hairStyle === 'scholar-bun') {
      const cap = local(0, 1.76 + bob, -0.015);
      this.addSmoothSphere(cap[0], cap[1], cap[2], 0.144 * bw, 0.115 * bh, 0.156 * bd, hr, hg, hb, 4, yaw, 12, 5);
      const bun = local(0, 1.88 + bob, -0.08);
      this.addSmoothSphere(bun[0], bun[1], bun[2], 0.078 * bw, 0.072 * bh, 0.078 * bd, hr * 0.95, hg * 0.95, hb * 0.95, 4, yaw, 10, 4);
      const pin = local(0, 1.88 + bob, -0.08);
      this.addBox(pin[0], pin[1], pin[2], 0.22 * bw, 0.014 * bh, 0.014 * bd, yaw, tr, tg, tb, 2);
    } else if (app.hairStyle === 'twin-braids') {
      const cap = local(0, 1.76 + bob, -0.015);
      this.addSmoothSphere(cap[0], cap[1], cap[2], 0.146 * bw, 0.118 * bh, 0.158 * bd, hr, hg, hb, 4, yaw, 12, 5);
      for (const side of [-1, 1]) {
        for (let bi = 0; bi < 4; bi++) {
          const bp = local(side * (0.135 + bi * 0.012), 1.66 - bi * 0.08 + bob, 0.02 + bi * 0.024);
          this.addSmoothSphere(bp[0], bp[1], bp[2], 0.036 * bw, 0.042 * bh, 0.036 * bd, hr, hg, hb, 4, yaw, 8, 4);
        }
        const claspTip = local(side * 0.17, 1.38 + bob, 0.09);
        this.addSmoothCylinder(claspTip[0], claspTip[1], claspTip[2], 0.024, 0.022, 0.035, 8, tr, tg, tb, 2, yaw);
      }
    } else if (app.hairStyle === 'horned-circlet') {
      const cap = local(0, 1.76 + bob, -0.015);
      this.addSmoothSphere(cap[0], cap[1], cap[2], 0.145 * bw, 0.116 * bh, 0.158 * bd, hr, hg, hb, 4, yaw, 12, 5);
      const circlet = local(0, 1.76 + bob, 0.01);
      this.addSmoothCylinder(circlet[0], circlet[1], circlet[2], 0.152 * bw, 0.152 * bw, 0.028 * bh, 14, tr, tg, tb, 2, yaw);
      const crest = local(0, 1.83 + bob, 0.145);
      this.addOctahedron(crest[0], crest[1], crest[2], 0.032 * bw, 0.068 * bh, yaw, tr, tg, tb, 2);
    } else {
      // Waywright Hero & Peers: Sculpted swept frontier traveler hair framing forehead & nape
      const cap = local(0, 1.76 + bob, -0.015);
      this.addSmoothSphere(cap[0], cap[1], cap[2], 0.144 * bw, 0.115 * bh, 0.158 * bd, hr, hg, hb, 4, yaw, 12, 6);
      const nape = local(0, 1.68 + bob, -0.11);
      this.addSmoothSphere(nape[0], nape[1], nape[2], 0.115 * bw, 0.095 * bh, 0.075 * bd, hr * 0.92, hg * 0.92, hb * 0.94, 4, yaw, 10, 4);
    }

    // Beards matching portraits!
    if (app.beardStyle === 'trimmed-grey') {
      const beard = local(0, 1.585 + bob, 0.10);
      this.addSmoothSphere(beard[0], beard[1], beard[2], 0.102 * bw, 0.082 * bh, 0.085 * bd, hr * 0.94, hg * 0.94, hb * 0.95, 4, yaw, 10, 4);
    } else if (app.beardStyle === 'full-smith') {
      const beard = local(0, 1.56 + bob, 0.11);
      this.addSmoothSphere(beard[0], beard[1], beard[2], 0.118 * bw, 0.115 * bh, 0.10 * bd, hr * 0.96, hg * 0.96, hb * 0.96, 4, yaw, 12, 5);
      const stache = local(0, 1.62 + bob, 0.155);
      this.addBox(stache[0], stache[1], stache[2], 0.115 * bw, 0.032 * bh, 0.04 * bd, yaw, hr * 1.04, hg * 1.04, hb * 1.04, 4);
    } else if (app.beardStyle === 'goatee') {
      const chin = local(0, 1.565 + bob, 0.125);
      this.addSmoothSphere(chin[0], chin[1], chin[2], 0.056 * bw, 0.068 * bh, 0.055 * bd, hr * 0.95, hg * 0.95, hb * 0.95, 4, yaw, 8, 4);
    } else if (app.beardStyle === 'braided-beard') {
      const beard = local(0, 1.56 + bob, 0.11);
      this.addSmoothSphere(beard[0], beard[1], beard[2], 0.108 * bw, 0.105 * bh, 0.092 * bd, hr * 0.95, hg * 0.95, hb * 0.95, 4, yaw, 10, 4);
      const tail = local(0, 1.42 + bob, 0.145);
      this.addSmoothCylinder(tail[0], tail[1], tail[2], 0.036 * bw, 0.055 * bw, 0.14 * bh, 8, hr * 0.9, hg * 0.9, hb * 0.9, 4, yaw);
      const band = local(0, 1.44 + bob, 0.145);
      this.addSmoothCylinder(band[0], band[1], band[2], 0.044 * bw, 0.044 * bw, 0.03 * bh, 8, tr, tg, tb, 2, yaw);
    }

    // 5. Articulated Upper Arms, Forearms (bare muscular forearms for Tarsik!), Cuffs & Hands
    const forearmRgb = app.bareForearms ? app.skinRgb : upperSleeveRgb;
    const lArmPitch = isSwimming
      ? -1.05 + armSwing * 0.85
      : app.signatureProp === 'ledger-quill' || app.signatureProp === 'brass-dividers'
        ? -0.58
        : armSwing;
    const rArmPitch = isSwimming
      ? -1.05 - armSwing * 0.85
      : swingAmt > 0
        ? -1.1 + swingAmt * 2.2
        : app.signatureProp === 'tuning-fork' || app.signatureProp === 'specimen-jar'
          ? -0.78
          : app.signatureProp === 'brass-dividers' || app.signatureProp === 'ledger-quill'
            ? -0.64
            : -armSwing - 0.24;

    // Left Arm (upper + forearm + hand)
    const lSh = local(-0.29, 1.10 + bob, 0.03);
    this.addSmoothCylinder(lSh[0], lSh[1], lSh[2], 0.072 * bw, 0.086 * bw, 0.31 * bh, 10, upperSleeveRgb[0], upperSleeveRgb[1], upperSleeveRgb[2], 4, yaw, lArmPitch * 0.55);
    const lFore = local(-0.30, 0.87 + bob, 0.065 - lArmPitch * 0.16);
    this.addSmoothCylinder(lFore[0], lFore[1], lFore[2], 0.058 * bw, 0.068 * bw, 0.27 * bh, 10, forearmRgb[0], forearmRgb[1], forearmRgb[2], 4, yaw, lArmPitch);
    const lHand = local(-0.295, 0.88 + bob - lArmPitch * 0.14, 0.11 - lArmPitch * 0.30);
    this.addSmoothSphere(lHand[0], lHand[1], lHand[2], 0.054 * bw, 0.054 * bh, 0.06 * bd, sr, sg, sb, 4, yaw, 8, 4);

    // Right Arm (upper + forearm + hand)
    const rSh = local(0.29, 1.10 + bob, 0.04);
    this.addSmoothCylinder(rSh[0], rSh[1], rSh[2], 0.072 * bw, 0.086 * bw, 0.31 * bh, 10, upperSleeveRgb[0], upperSleeveRgb[1], upperSleeveRgb[2], 4, yaw, rArmPitch * 0.55);
    const rFore = local(0.30, 0.88 + bob, 0.095 - rArmPitch * 0.16 + swingAmt * 0.16);
    this.addSmoothCylinder(rFore[0], rFore[1], rFore[2], 0.058 * bw, 0.068 * bw, 0.27 * bh, 10, forearmRgb[0], forearmRgb[1], forearmRgb[2], 4, yaw, rArmPitch);
    const rHand = local(0.295, 0.90 + bob - rArmPitch * 0.16 + (swingAmt > 0 ? 0.14 : 0), 0.13 - rArmPitch * 0.30 + swingAmt * 0.22);
    this.addSmoothSphere(rHand[0], rHand[1], rHand[2], 0.054 * bw, 0.054 * bh, 0.06 * bd, sr, sg, sb, 4, yaw, 8, 4);

    // Portrait-matched wrist bracers (copper-wrapped for Kaelen, leather cuffs for Tarsik, embroidered cuffs for Seraia)
    if (app.garmentStyle === 'oilskin-coat' || app.garmentStyle === 'smith-apron' || app.garmentStyle === 'herbalist-coat') {
      const cuffMat = app.garmentStyle === 'oilskin-coat' ? 2 : 4;
      const cuffCol = app.garmentStyle === 'oilskin-coat' ? app.trimRgb : app.leatherRgb;
      const cL = local(-0.295, 0.90 + bob - lArmPitch * 0.09, 0.09 - lArmPitch * 0.22);
      const cR = local(0.295, 0.91 + bob - rArmPitch * 0.09, 0.105 - rArmPitch * 0.22);
      this.addSmoothCylinder(cL[0], cL[1], cL[2], 0.066 * bw, 0.072 * bw, 0.11 * bh, 10, cuffCol[0], cuffCol[1], cuffCol[2], cuffMat, yaw, lArmPitch);
      this.addSmoothCylinder(cR[0], cR[1], cR[2], 0.066 * bw, 0.072 * bw, 0.11 * bh, 10, cuffCol[0], cuffCol[1], cuffCol[2], cuffMat, yaw, rArmPitch);
    }

    // 6. Portrait-Matched Held Signature Props & High-Definition Player Weapons (sheathed while swimming!)
    const rawProp = app.signatureProp;
    const prop =
      isSwimming && (rawProp === 'hookblade' || rawProp === 'bellhammer')
        ? 'none'
        : rawProp;
    if (prop === 'brass-dividers') {
      const hinge = local(0.05, 1.32 + bob, 0.39);
      this.addSmoothSphere(hinge[0], hinge[1], hinge[2], 0.048, 0.048, 0.048, 0.9, 0.72, 0.3, 2, yaw, 8, 4);
      const legA = local(-0.04, 1.06 + bob, 0.39);
      const legB = local(0.14, 1.06 + bob, 0.39);
      this.addBox(legA[0], legA[1], legA[2], 0.026, 0.34, 0.022, yaw, 0.88, 0.7, 0.28, 2, 0, -0.28);
      this.addBox(legB[0], legB[1], legB[2], 0.026, 0.34, 0.022, yaw, 0.88, 0.7, 0.28, 2, 0, 0.28);
      const arc = local(0.05, 1.16 + bob, 0.39);
      this.addBox(arc[0], arc[1], arc[2], 0.18, 0.022, 0.018, yaw, 0.86, 0.68, 0.26, 2);
    } else if (prop === 'ledger-quill') {
      const book = local(-0.16, 1.08 + bob, 0.40);
      this.addBox(book[0], book[1], book[2], 0.32, 0.036, 0.24, yaw + 0.15, lr * 0.8, lg * 0.75, lb * 0.7, 4, 0.24);
      this.addBox(book[0], book[1] + 0.024, book[2], 0.28, 0.026, 0.21, yaw + 0.15, 0.92, 0.86, 0.72, 4, 0.24);
      const quill = local(0.04, 1.21 + bob, 0.40);
      this.addBox(quill[0], quill[1], quill[2], 0.024, 0.26, 0.048, yaw - 0.2, 0.92, 0.76, 0.32, 2, -0.25, 0.22);
    } else if (prop === 'tuning-fork') {
      const base = local(0.30, 1.14 + bob, 0.38);
      this.addSmoothCylinder(base[0], base[1], base[2], 0.019, 0.021, 0.15, 8, 0.92, 0.74, 0.3, 2, yaw);
      const tineL = local(0.265, 1.38 + bob, 0.38);
      const tineR = local(0.335, 1.38 + bob, 0.38);
      this.addBox(tineL[0], tineL[1], tineL[2], 0.019, 0.22, 0.019, yaw, 0.96, 0.78, 0.32, 2);
      this.addBox(tineR[0], tineR[1], tineR[2], 0.019, 0.22, 0.019, yaw, 0.96, 0.78, 0.32, 2);
      const bridge = local(0.30, 1.28 + bob, 0.38);
      this.addBox(bridge[0], bridge[1], bridge[2], 0.088, 0.022, 0.022, yaw, 0.92, 0.74, 0.3, 2);
    } else if (prop === 'specimen-jar') {
      const jar = local(0.25, 1.12 + bob, 0.39);
      const pulse = 0.88 + Math.sin(timeSec * 3.4 + x) * 0.12;
      this.addSmoothCylinder(jar[0], jar[1], jar[2], 0.074, 0.074, 0.20, 10, 0.32 * pulse, 0.9 * pulse, 0.84 * pulse, 3, yaw);
      this.addOctahedron(jar[0], jar[1] + 0.10, jar[2], 0.04, 0.072, timeSec * 1.4, 0.98, 0.76, 0.22, 3);
      this.addSmoothCylinder(jar[0], jar[1] + 0.20, jar[2], 0.042, 0.050, 0.05, 8, 0.62, 0.44, 0.26, 4, yaw);
    } else if (prop === 'hookblade') {
      // HD Lodestone Hookblade: anchored at right hand, projecting FORWARD & slightly OUT (never cutting through torso!)
      const bYaw = yaw + (swingAmt > 0 ? swingAmt * 1.65 - 0.55 : 0.14);
      const fwdBx = Math.sin(bYaw);
      const fwdBz = Math.cos(bYaw);
      const hx = rHand[0], hy = rHand[1], hz = rHand[2];
      // Leather hilt + bronze pommel + crossguard right at hand
      this.addBox(hx - fwdBx * 0.06, hy - 0.02, hz - fwdBz * 0.06, 0.036, 0.042, 0.20, bYaw, lr, lg, lb, 4);
      this.addSmoothSphere(hx - fwdBx * 0.16, hy - 0.03, hz - fwdBz * 0.16, 0.034, 0.034, 0.034, 0.9, 0.7, 0.28, 2, bYaw, 8, 4);
      this.addBox(hx + fwdBx * 0.06, hy + 0.01, hz + fwdBz * 0.06, 0.18, 0.04, 0.045, bYaw, 0.9, 0.7, 0.28, 2);
      // Tapered steel blade + glowing lodestone fuller extending forward from crossguard
      this.addBox(hx + fwdBx * 0.38, hy + 0.06, hz + fwdBz * 0.38, 0.028, 0.068, 0.58, bYaw, 0.84, 0.86, 0.9, 2, -0.14);
      this.addBox(hx + fwdBx * 0.38, hy + 0.075, hz + fwdBz * 0.38, 0.016, 0.026, 0.50, bYaw, 0.96, 0.78, 0.32, 3, -0.14);
      // Curved hooked tip projecting forward-up
      this.addBox(hx + fwdBx * 0.74, hy + 0.14, hz + fwdBz * 0.74, 0.024, 0.056, 0.26, bYaw, 0.88, 0.9, 0.94, 2, -0.42);
    } else if (prop === 'bellhammer') {
      const hx = rHand[0], hy = rHand[1], hz = rHand[2];
      const bYaw = yaw + (swingAmt > 0 ? swingAmt * 1.4 - 0.4 : 0.1);
      const fwdBx = Math.sin(bYaw);
      const fwdBz = Math.cos(bYaw);
      this.addSmoothCylinder(hx, hy - 0.12, hz, 0.028, 0.034, 0.98, 8, 0.44, 0.3, 0.18, 4, bYaw, 0.85);
      const bx = hx + fwdBx * 0.62;
      const by = hy + 0.42;
      const bz = hz + fwdBz * 0.62;
      this.addSmoothCylinder(bx, by - 0.18, bz, 0.19, 0.12, 0.36, 12, 0.9, 0.68, 0.28, 2, bYaw);
      this.addOctahedron(bx, by - 0.18, bz, 0.08, 0.10, timeSec * 3, 0.98, 0.76, 0.3, 3);
    } else if (prop === 'lantern') {
      const lan = local(0.35, 0.96 + bob, 0.42);
      this.addSmoothCylinder(lan[0], lan[1] - 0.05, lan[2], 0.12, 0.12, 0.045, 10, 0.86, 0.68, 0.3, 2, yaw);
      this.addOctahedron(lan[0], lan[1] + 0.12, lan[2], 0.12, 0.18, timeSec * 2, 0.38, 0.94, 0.78, 3);
      this.addSmoothCylinder(lan[0], lan[1] + 0.27, lan[2], 0.13, 0.065, 0.075, 10, 0.86, 0.68, 0.3, 2, yaw);
    } else if (prop === 'astrolabe-staff') {
      const staff = local(0.32, 0.25 + bob, 0.34);
      this.addSmoothCylinder(staff[0], staff[1], staff[2], 0.025, 0.028, 1.65, 8, lr, lg, lb, 4, yaw);
      const orb = local(0.32, 1.98 + bob, 0.34);
      this.addRing(orb[0], orb[1], orb[2], 0.11, 0.15, 12, tr, tg, tb, 2);
      this.addOctahedron(orb[0], orb[1], orb[2], 0.06, 0.09, timeSec * 2.2, 0.38, 0.92, 0.86, 3);
    } else if (prop === 'survey-lantern') {
      const lan = local(0.32, 0.96 + bob, 0.39);
      this.addSmoothCylinder(lan[0], lan[1] - 0.04, lan[2], 0.10, 0.10, 0.04, 10, tr, tg, tb, 2, yaw);
      this.addOctahedron(lan[0], lan[1] + 0.10, lan[2], 0.09, 0.14, timeSec * 1.8, 0.98, 0.82, 0.34, 3);
      this.addSmoothCylinder(lan[0], lan[1] + 0.22, lan[2], 0.11, 0.055, 0.06, 10, tr, tg, tb, 2, yaw);
    } else if (prop === 'resonance-lute') {
      const lute = local(0.16, 1.06 + bob, 0.38);
      this.addSmoothSphere(lute[0], lute[1], lute[2], 0.14, 0.19, 0.08, lr, lg, lb, 4, yaw + 0.3, 10, 5);
      const neckL = local(0.28, 1.24 + bob, 0.38);
      this.addBox(neckL[0], neckL[1], neckL[2], 0.042, 0.42, 0.028, yaw + 0.3, lr * 0.85, lg * 0.85, lb * 0.85, 4, 0, -0.45);
    } else if (prop === 'mason-mallet') {
      const mal = local(0.32, 1.04 + bob, 0.38);
      this.addSmoothCylinder(mal[0], mal[1], mal[2], 0.022, 0.024, 0.42, 8, lr, lg, lb, 4, yaw);
      this.addBox(mal[0], mal[1] + 0.40, mal[2], 0.22, 0.11, 0.11, yaw, tr, tg, tb, 2);
    } else if (prop === 'compass') {
      const cmp = local(0.34, 1.04 + bob, 0.42);
      this.addRing(cmp[0], cmp[1], cmp[2], 0.10, 0.16, 12, 0.92, 0.74, 0.32, 2);
      this.addOctahedron(cmp[0], cmp[1] + 0.035, cmp[2], 0.065, 0.11, timeSec * 2.5, 0.42, 0.92, 0.88, 3);
    }
  }

  public build(input: DynamicSceneInput): DynamicBuffers {
    this.reset();
    const t = input.timeSec;
    const hAt = input.heightAt ?? surfaceHeightAt;
    const waterY = input.waterLevel ?? -1.75;

    // 1. Animated Reflective Water / 6 Bespoke Dungeon Abyss Chasms (v_m = 1.0 or 3.0)
    if (input.isDungeon) {
      const style = input.dungeonStyle ?? 'catacomb-vault';
      const isMagma = style === 'geothermal-depths';
      const isGlacial = style === 'glacial-crypt';
      const isAbyssal = style === 'abyssal-grotto';
      const isEcho = style === 'echo-tomb';
      const isCistern = style === 'sunken-cistern';
      const chasmMat = isMagma || isGlacial || isEcho ? 3 : 1;
      const pulse = 0.86 + Math.sin(t * 2.2) * 0.14;
      const [cr, cg, cb]: [number, number, number] = isMagma
        ? [0.96 * pulse, 0.34 * pulse, 0.08]
        : isGlacial
          ? [0.24 * pulse, 0.78 * pulse, 0.98]
          : isAbyssal
            ? [0.10, 0.56 * pulse, 0.64 * pulse]
            : isEcho
              ? [0.76 * pulse, 0.54 * pulse, 0.22]
              : isCistern
                ? [0.12, 0.48 * pulse, 0.38]
                : [0.12, 0.24, 0.42];
      for (let gx = -21; gx < 21; gx += 7) {
        this.addQuad(
          [gx, waterY, 4.2],
          [gx, waterY, 17.8],
          [gx + 7, waterY, 17.8],
          [gx + 7, waterY, 4.2],
          cr,
          cg,
          cb,
          chasmMat,
        );
      }
      // Subtle animated chasm surface accent wisps/rings for visual depth
      for (let ci = 0; ci < 6; ci++) {
        const cx = -16 + ci * 6.4;
        const cz = 11.0 + Math.sin(t * 0.9 + ci * 1.4) * 3.8;
        if (Math.abs(cx) < 3.6) continue;
        const rPulse = 0.85 + ((t * 0.6 + ci * 0.29) % 1) * 1.1;
        this.addRing(cx, waterY + 0.08, cz, Math.max(0.2, rPulse - 0.18), rPulse, 14, Math.min(1, cr * 1.25), Math.min(1, cg * 1.25), Math.min(1, cb * 1.25), 3);
      }
    } else if (input.waterTiles && input.waterTiles.length > 0) {
      // Terrain-clipped unified hydrology: water ONLY renders inside submerged riverbeds,
      // gorges, and coves (ZERO floating water slabs, ZERO abrupt cutoffs!), with depth-graded
      // sapphire-to-turquoise tinting and gentle shoreline foam wave glints.
      for (const tile of input.waterTiles) {
        const depthT = Math.min(1, tile.avgDepth / 2.2);
        const cx = (tile.x0 + tile.x1) * 0.5;
        const cz = (tile.z0 + tile.z1) * 0.5;
        const shimmer = tile.isShoreline
          ? (Math.sin(t * 2.1 + cx * 0.28 + cz * 0.24) * 0.5 + 0.5) * 0.09 + 0.04
          : Math.sin(t * 1.4 + cx * 0.16 - cz * 0.18) * 0.018;
        const r = Math.min(0.68, 0.16 - depthT * 0.09 + shimmer);
        const g = Math.min(0.84, 0.43 - depthT * 0.18 + shimmer * 1.15);
        const b = Math.min(0.88, 0.50 - depthT * 0.11 + shimmer * 1.05);
        this.addQuad(
          [tile.x0, tile.y, tile.z0],
          [tile.x0, tile.y, tile.z1],
          [tile.x1, tile.y, tile.z1],
          [tile.x1, tile.y, tile.z0],
          r,
          g,
          b,
          1,
        );
      }
    } else {
      // Fallback terrain-clipped water pass when caller passes heightAt without precomputed waterTiles
      const step = 6;
      for (let gx = -96; gx < 96; gx += step) {
        for (let gz = -96; gz < 96; gz += step) {
          const h00 = hAt(gx, gz);
          const h10 = hAt(gx + step, gz);
          const h01 = hAt(gx, gz + step);
          const h11 = hAt(gx + step, gz + step);
          const minH = Math.min(h00, h10, h01, h11);
          if (minH >= waterY - 0.02) continue;
          const avgD =
            (Math.max(0, waterY - h00) +
              Math.max(0, waterY - h10) +
              Math.max(0, waterY - h01) +
              Math.max(0, waterY - h11)) *
            0.25;
          const depthT = Math.min(1, avgD / 2.2);
          this.addQuad(
            [gx, waterY, gz],
            [gx, waterY, gz + step],
            [gx + step, waterY, gz + step],
            [gx + step, waterY, gz],
            0.17 - depthT * 0.10,
            0.44 - depthT * 0.19,
            0.50 - depthT * 0.11,
            1,
          );
        }
      }
    }

    // 2. Ecosystem & Dungeon Active Thermal Vents / Geothermal Magma Fissure Seams
    if (input.thermalVents && input.thermalVents.length > 0) {
      for (let vi = 0; vi < input.thermalVents.length; vi++) {
        const [vx, vz] = input.thermalVents[vi];
        const vy = hAt(vx, vz) + 0.08;
        const pulse = 0.8 + Math.sin(t * 3.1 + vi * 1.4) * 0.2;
        this.addRing(vx, vy + 0.04, vz, 0.9, 1.55, 16, 0.98 * pulse, 0.36 * pulse, 0.08, 3);
        this.addSmoothCylinder(vx, vy - 0.1, vz, 0.95, 0.72, 0.22, 10, 0.14, 0.12, 0.13, 0);
        // Rising ember plume core above active thermal vent
        const plumeH = 1.4 + ((t * 1.8 + vi * 0.37) % 1) * 1.6;
        this.addOctahedron(vx, vy + plumeH, vz, 0.28, 0.55, t * 2.4 + vi, 0.98 * pulse, 0.52 * pulse, 0.12, 3);
      }
    } else if (input.showMagmaSeams !== false && !input.isDungeon) {
      const magmaSpots: Array<[number, number, number]> = [
        [-30, -10, 3.6],
        [-26, -13, 2.8],
        [-33, -6, 3.2],
        [-23, -9, 2.2],
      ];
      for (const [mx, mz, len] of magmaSpots) {
        const my = (input.heightAt ? hAt(mx, mz) : vaelmorHeightAt(mx, mz)) + 0.08;
        const pulse = 0.85 + Math.sin(t * 2.6 + mx) * 0.15;
        this.addBox(mx, my, mz, len, 0.12, 0.65, 0.5, 0.96 * pulse, 0.36 * pulse, 0.1, 3);
      }
    }

    // 3. High-Definition Articulated Player Chartered Waywright (with Wading & Swimming Postures!)
    const strideAmp = Math.min(1, input.playerSpeed / 7.5);
    const stridePhase = t * 11.5;
    const playerApp = compilePlayerCharacterAppearance(input.activeGear, input.dodgeTimer > 0);
    const waterPosture: WaterPosture = input.playerWaterPosture ?? 'dry';
    this.addCompiledCharacter(
      input.playerX,
      input.playerY,
      input.playerZ,
      input.playerYaw,
      playerApp,
      stridePhase,
      strideAmp,
      input.attackSwing,
      t,
      waterPosture,
    );

    // Expanding concentric water ripples & swim wake rings when wading or swimming
    if (!input.isDungeon && waterPosture !== 'dry') {
      const rippleCycle = (t * (waterPosture === 'swimming' ? 1.55 : 1.15)) % 1;
      const rOuter = (waterPosture === 'swimming' ? 0.65 : 0.42) + rippleCycle * (waterPosture === 'swimming' ? 1.45 : 0.85);
      const rInner = Math.max(0.18, rOuter - 0.16);
      this.addRing(input.playerX, waterY + 0.045, input.playerZ, rInner, rOuter, 16, 0.78, 0.92, 0.96, 3);
      if (waterPosture === 'swimming') {
        const wakeCycle = (rippleCycle + 0.5) % 1;
        const wOuter = 0.55 + wakeCycle * 1.35;
        const bx = input.playerX - Math.sin(input.playerYaw) * 0.55;
        const bz = input.playerZ - Math.cos(input.playerYaw) * 0.55;
        this.addRing(bx, waterY + 0.04, bz, Math.max(0.15, wOuter - 0.14), wOuter, 14, 0.56, 0.84, 0.92, 1);
      }
    }

    // 4. Portrait-Matched High-Definition Realm NPCs (Compiled via Verdant Character Compiler)
    for (const npc of input.npcs) {
      const [nx, nz] = npc.position;
      const ny = hAt(nx, nz);
      const toPlayer = Math.atan2(input.playerX - nx, input.playerZ - nz);
      const appearance = compileNpcCharacterAppearance(npc);
      this.addCompiledCharacter(nx, ny, nz, toPlayer, appearance, t * 1.4, 0.05, 0, t);
      // Floating golden dialogue beacon diamond overhead
      const bobY = ny + 2.55 + Math.sin(t * 2.8 + nx) * 0.14;
      this.addOctahedron(nx, bobY, nz, 0.22, 0.34, t * 1.5, 0.96, 0.78, 0.32, 3);
    }

    // 5. High-Definition Bespoke Ecosystem Fauna (6 Distinct Morphology Families)
    const faunaKit: FaunaKitId = input.faunaKit ?? 'highland-ironclad';
    const faunaPalette: Record<
      FaunaKitId,
      { body: [number, number, number]; accent: [number, number, number]; glow: [number, number, number]; mat: number }
    > = {
      'highland-ironclad': { body: [0.24, 0.27, 0.33], accent: [0.68, 0.54, 0.28], glow: [0.96, 0.56, 0.2], mat: 4 },
      'verdant-mycelial': { body: [0.22, 0.36, 0.24], accent: [0.46, 0.32, 0.22], glow: [0.32, 0.96, 0.58], mat: 4 },
      'pyroclastic-forge': { body: [0.16, 0.14, 0.16], accent: [0.48, 0.26, 0.18], glow: [0.98, 0.42, 0.1], mat: 2 },
      'pelagic-abyssal': { body: [0.16, 0.34, 0.42], accent: [0.76, 0.52, 0.42], glow: [0.26, 0.94, 0.92], mat: 4 },
      'dune-sandstrider': { body: [0.62, 0.46, 0.28], accent: [0.76, 0.6, 0.34], glow: [0.98, 0.78, 0.24], mat: 4 },
      'glacial-frostborn': { body: [0.56, 0.74, 0.88], accent: [0.78, 0.88, 0.96], glow: [0.44, 0.92, 0.98], mat: 2 },
    };
    const fp = faunaPalette[faunaKit];

    for (const e of input.enemies) {
      if (e.state === 'ko' && e.koTimer <= 0) continue;
      const ey = hAt(e.x, e.z);
      const flash = e.hitFlashTimer > 0;
      const tele = e.state === 'telegraph';
      const koScale = e.state === 'ko' ? Math.max(0.15, e.koTimer / 0.45) : 1.0;
      const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
      const bR = flash ? 0.98 : tele ? 0.94 : fp.body[0];
      const bG = flash ? 0.96 : tele ? 0.46 : fp.body[1];
      const bB = flash ? 0.92 : tele ? 0.22 : fp.body[2];
      const gR = tele ? 0.98 : fp.glow[0];
      const gG = tele ? 0.48 : fp.glow[1];
      const gB = tele ? 0.16 : fp.glow[2];
      const mat = flash ? 3 : fp.mat;

      if (e.archetype === 'stalker') {
        const crouch = tele ? -0.15 : Math.sin(t * 8.5 + e.x) * 0.05;
        if (faunaKit === 'verdant-mycelial') {
          // Spore-Stag Quadruped with bioluminescent branching antlers & fungal back-cap
          this.addSmoothSphere(e.x, ey + (0.86 + crouch) * koScale, e.z, 0.36 * koScale, 0.34 * koScale, 0.68 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          this.addSmoothCylinder(e.x, ey + (1.12 + crouch) * koScale, e.z, 0.56 * koScale, 0.24 * koScale, 0.24 * koScale, 10, gR * 0.72, gG * 0.86, gB * 0.65, 3, e.yaw);
          const hx = e.x + sy * 0.72 * koScale;
          const hz = e.z + cy * 0.72 * koScale;
          this.addSmoothSphere(hx, ey + (1.18 + crouch) * koScale, hz, 0.22 * koScale, 0.22 * koScale, 0.3 * koScale, bR, bG, bB, mat, e.yaw, 8, 4);
          // Glowing antlers
          for (const side of [-1, 1]) {
            this.addBox(hx + side * 0.26 * cy * koScale, ey + (1.58 + crouch) * koScale, hz - side * 0.26 * sy * koScale, 0.08 * koScale, 0.62 * koScale, 0.08 * koScale, e.yaw + side * 0.35, gR, gG, gB, 3);
            this.addBox(hx + side * 0.42 * cy * koScale, ey + (1.76 + crouch) * koScale, hz - side * 0.42 * sy * koScale, 0.07 * koScale, 0.34 * koScale, 0.07 * koScale, e.yaw + side * 0.7, gR, gG, gB, 3);
          }
          for (const [lx, lz] of [[-0.24, 0.44], [0.24, 0.44], [-0.24, -0.44], [0.24, -0.44]]) {
            this.addSmoothCylinder(e.x + lx * cy + lz * sy, ey, e.z - lx * sy + lz * cy, 0.07 * koScale, 0.09 * koScale, 0.78 * koScale, 8, fp.accent[0], fp.accent[1], fp.accent[2], 4, e.yaw);
          }
        } else if (faunaKit === 'pyroclastic-forge') {
          // Magma-Armored Salamander Drake with broad anvil head & blazing furnace tail
          this.addSmoothSphere(e.x, ey + (0.58 + crouch) * koScale, e.z, 0.5 * koScale, 0.28 * koScale, 0.82 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          this.addBox(e.x, ey + (0.86 + crouch) * koScale, e.z, 0.56 * koScale, 0.14 * koScale, 1.05 * koScale, e.yaw, gR, gG, gB, 3);
          const hx = e.x + sy * 0.88 * koScale;
          const hz = e.z + cy * 0.88 * koScale;
          this.addBox(hx, ey + (0.68 + crouch) * koScale, hz, 0.46 * koScale, 0.28 * koScale, 0.44 * koScale, e.yaw, bR, bG, bB, 2);
          this.addOctahedron(e.x - sy * 0.92 * koScale, ey + (0.64 + crouch) * koScale, e.z - cy * 0.92 * koScale, 0.26 * koScale, 0.48 * koScale, t * 3, gR, gG, gB, 3);
          for (const [lx, lz] of [[-0.42, 0.44], [0.42, 0.44], [-0.42, -0.44], [0.42, -0.44]]) {
            this.addSmoothCylinder(e.x + lx * cy + lz * sy, ey, e.z - lx * sy + lz * cy, 0.11 * koScale, 0.14 * koScale, 0.52 * koScale, 8, 0.22, 0.16, 0.14, 2, e.yaw);
          }
        } else if (faunaKit === 'pelagic-abyssal') {
          // Coral-Armored Tide-Crab with twin pincer claws & bioluminescent shell
          this.addSmoothSphere(e.x, ey + (0.66 + crouch) * koScale, e.z, 0.68 * koScale, 0.34 * koScale, 0.54 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          this.addRing(e.x, ey + (0.86 + crouch) * koScale, e.z, 0.32 * koScale, 0.52 * koScale, 12, gR, gG, gB, 3);
          for (const side of [-1, 1]) {
            const cx = e.x + side * 0.62 * cy * koScale + sy * 0.56 * koScale;
            const cz = e.z - side * 0.62 * sy * koScale + cy * 0.56 * koScale;
            this.addSmoothSphere(cx, ey + (0.66 + crouch) * koScale, cz, 0.24 * koScale, 0.18 * koScale, 0.34 * koScale, fp.accent[0], fp.accent[1], fp.accent[2], 4, e.yaw, 8, 4);
            this.addSmoothCylinder(e.x + side * 0.56 * cy * koScale, ey, e.z - side * 0.56 * sy * koScale, 0.06 * koScale, 0.08 * koScale, 0.58 * koScale, 6, bR, bG, bB, 4, e.yaw);
          }
        } else if (faunaKit === 'dune-sandstrider') {
          // Chitinous Desert Scorpion with arched venomous stinger tail
          this.addSmoothSphere(e.x, ey + (0.56 + crouch) * koScale, e.z, 0.44 * koScale, 0.24 * koScale, 0.78 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          // Curved stinger tail rising over back
          for (let seg = 0; seg < 4; seg++) {
            const tx = e.x - sy * (0.68 - seg * 0.22) * koScale;
            const tz = e.z - cy * (0.68 - seg * 0.22) * koScale;
            const ty = ey + (0.72 + seg * 0.34 + crouch) * koScale;
            this.addSmoothSphere(tx, ty, tz, (0.18 - seg * 0.025) * koScale, 0.16 * koScale, 0.18 * koScale, seg === 3 ? gR : fp.accent[0], seg === 3 ? gG : fp.accent[1], seg === 3 ? gB : fp.accent[2], seg === 3 ? 3 : 4, e.yaw, 8, 4);
          }
          for (const [lx, lz] of [[-0.38, 0.38], [0.38, 0.38], [-0.44, 0], [0.44, 0], [-0.36, -0.38], [0.36, -0.38]]) {
            this.addSmoothCylinder(e.x + lx * cy + lz * sy, ey, e.z - lx * sy + lz * cy, 0.06 * koScale, 0.08 * koScale, 0.48 * koScale, 6, fp.accent[0], fp.accent[1], fp.accent[2], 4, e.yaw);
          }
        } else if (faunaKit === 'glacial-frostborn') {
          // Crystalline Frost-Wolf with faceted ice-shard mane & aurora eyes
          this.addSmoothSphere(e.x, ey + (0.78 + crouch) * koScale, e.z, 0.36 * koScale, 0.32 * koScale, 0.76 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          this.addOctahedron(e.x + sy * 0.34 * koScale, ey + (1.16 + crouch) * koScale, e.z + cy * 0.34 * koScale, 0.38 * koScale, 0.48 * koScale, e.yaw, gR, gG, gB, 3);
          this.addOctahedron(e.x - sy * 0.36 * koScale, ey + (1.08 + crouch) * koScale, e.z - cy * 0.36 * koScale, 0.26 * koScale, 0.4 * koScale, e.yaw + 0.5, fp.accent[0], fp.accent[1], fp.accent[2], 2);
          const hx = e.x + sy * 0.82 * koScale;
          const hz = e.z + cy * 0.82 * koScale;
          this.addSmoothSphere(hx, ey + (0.94 + crouch) * koScale, hz, 0.22 * koScale, 0.22 * koScale, 0.34 * koScale, fp.accent[0], fp.accent[1], fp.accent[2], 2, e.yaw, 8, 4);
          for (const [lx, lz] of [[-0.26, 0.46], [0.26, 0.46], [-0.26, -0.46], [0.26, -0.46]]) {
            this.addSmoothCylinder(e.x + lx * cy + lz * sy, ey, e.z - lx * sy + lz * cy, 0.08 * koScale, 0.1 * koScale, 0.68 * koScale, 8, fp.accent[0], fp.accent[1], fp.accent[2], 2, e.yaw);
          }
        } else {
          // Highland Ironclad Slate Hound
          this.addSmoothSphere(e.x, ey + (0.72 + crouch) * koScale, e.z, 0.38 * koScale, 0.32 * koScale, 0.72 * koScale, bR, bG, bB, mat, e.yaw, 10, 5);
          const hx = e.x + sy * 0.76 * koScale;
          const hz = e.z + cy * 0.76 * koScale;
          this.addSmoothSphere(hx, ey + (0.86 + crouch) * koScale, hz, 0.24 * koScale, 0.22 * koScale, 0.32 * koScale, bR * 0.9, bG * 0.9, bB * 0.95, mat, e.yaw, 10, 5);
          for (const side of [-0.11, 0.11]) {
            this.addSmoothSphere(hx + side * cy * koScale + sy * 0.2 * koScale, ey + (0.91 + crouch) * koScale, hz - side * sy * koScale + cy * 0.2 * koScale, 0.04 * koScale, 0.03 * koScale, 0.04 * koScale, gR, gG, gB, 3, e.yaw, 6, 4);
          }
          this.addOctahedron(e.x, ey + (1.16 + crouch) * koScale, e.z, 0.22 * koScale, 0.42 * koScale, e.yaw, gR, gG, gB, 3);
          this.addOctahedron(e.x - sy * 0.4 * koScale, ey + (1.02 + crouch) * koScale, e.z - cy * 0.4 * koScale, 0.16 * koScale, 0.3 * koScale, e.yaw, gR, gG * 0.85, gB, 3);
          for (const [lx, lz] of [[-0.28, 0.44], [0.28, 0.44], [-0.28, -0.44], [0.28, -0.44]]) {
            this.addSmoothCylinder(e.x + lx * cy + lz * sy, ey, e.z - lx * sy + lz * cy, 0.08 * koScale, 0.11 * koScale, 0.64 * koScale, 8, 0.18, 0.19, 0.23, 4, e.yaw);
          }
        }
        if (tele) {
          this.addRing(e.x, ey + 0.12, e.z, 1.2, 1.65, 16, 0.96, 0.42, 0.14, 3);
        }
      } else if (e.archetype === 'shardcaster') {
        const hover = ey + 1.48 + Math.sin(t * 3.1 + e.z) * 0.24;
        if (faunaKit === 'verdant-mycelial') {
          // Floating Bioluminescent Spore-Jellyfish with trailing tendrils
          this.addSmoothSphere(e.x, hover + 0.36 * koScale, e.z, 0.72 * koScale, 0.38 * koScale, 0.72 * koScale, gR * 0.85, gG, gB * 0.8, 3, e.yaw, 12, 6);
          for (let ti = 0; ti < 5; ti++) {
            const ang = t * 1.1 + (ti * Math.PI * 2) / 5;
            this.addSmoothCylinder(e.x + Math.cos(ang) * 0.36 * koScale, hover - 0.62 * koScale, e.z + Math.sin(ang) * 0.36 * koScale, 0.05 * koScale, 0.07 * koScale, 0.95 * koScale, 6, bR, bG + 0.2, bB, 4, e.yaw);
          }
          this.addRing(e.x, hover + 0.08 * koScale, e.z, 0.74 * koScale, 0.92 * koScale, 16, gR, gG, gB, 3);
        } else if (faunaKit === 'pyroclastic-forge') {
          // Levitating Molten Crucible Censer with orbiting slag chains
          this.addSmoothCylinder(e.x, hover - 0.36 * koScale, e.z, 0.54 * koScale, 0.36 * koScale, 0.72 * koScale, 10, bR, bG, bB, 2, t * 0.8);
          this.addOctahedron(e.x, hover + 0.24 * koScale, e.z, 0.46 * koScale, 0.62 * koScale, -t * 2.1, gR, gG, gB, 3);
          this.addRing(e.x, hover + 0.02 * koScale, e.z, 0.82 * koScale, 1.0 * koScale, 16, gR, gG, gB, 3);
        } else if (faunaKit === 'pelagic-abyssal') {
          // Levitating Abyssal Manta Ray with sweeping bioluminescent wingtips
          this.addSmoothSphere(e.x, hover + 0.1 * koScale, e.z, 1.18 * koScale, 0.16 * koScale, 0.72 * koScale, bR, bG, bB, mat, e.yaw, 12, 5);
          this.addOctahedron(e.x, hover + 0.28 * koScale, e.z, 0.3 * koScale, 0.22 * koScale, e.yaw, gR, gG, gB, 3);
          this.addSmoothCylinder(e.x - sy * 0.8 * koScale, hover, e.z - cy * 0.8 * koScale, 0.05 * koScale, 0.1 * koScale, 0.85 * koScale, 6, gR, gG, gB, 3, e.yaw);
        } else if (faunaKit === 'dune-sandstrider') {
          // Swirling Sun-Djinn Brass Astrolabe Spirit with twin gyroscopic rings
          this.addOctahedron(e.x, hover + 0.12 * koScale, e.z, 0.38 * koScale, 0.78 * koScale, t * 2.6, gR, gG, gB, 3);
          this.addRing(e.x, hover + 0.12 * koScale, e.z, 0.76 * koScale, 0.94 * koScale, 18, fp.accent[0], fp.accent[1], fp.accent[2], 2);
          this.addRing(e.x, hover - 0.34 * koScale, e.z, 0.46 * koScale, 0.64 * koScale, 14, gR, gG, gB, 3);
        } else if (faunaKit === 'glacial-frostborn') {
          // Aurora Prism Wraith — tall floating diamond crystal spire with halo shards
          this.addOctahedron(e.x, hover + 0.15 * koScale, e.z, 0.44 * koScale, 1.18 * koScale, t * 1.4, gR, gG, gB, 3);
          this.addRing(e.x, hover + 0.55 * koScale, e.z, 0.7 * koScale, 0.86 * koScale, 16, fp.accent[0], fp.accent[1], fp.accent[2], 3);
        } else {
          // Highland Arcane Shardcaster
          this.addSmoothCylinder(e.x, hover - 0.8 * koScale, e.z, 0.18 * koScale, 0.42 * koScale, 1.18 * koScale, 12, bR, bG, bB, flash ? 3 : 4, e.yaw);
          this.addSmoothSphere(e.x, hover + 0.55 * koScale, e.z, 0.26 * koScale, 0.28 * koScale, 0.28 * koScale, bR * 0.85, bG * 0.85, bB * 0.9, flash ? 3 : 4, e.yaw, 10, 5);
          this.addOctahedron(e.x, hover + 0.05 * koScale, e.z, 0.26 * koScale, 0.42 * koScale, t * 2, gR, gG, gB, 3);
          this.addRing(e.x, hover - 0.1, e.z, 0.72 * koScale, 0.86 * koScale, 16, gR, gG, gB, 3);
        }
        // Orbiting harmonic shards for all caster families
        for (let s = 0; s < 3; s++) {
          const ang = t * 2.4 + (s * Math.PI * 2) / 3;
          this.addOctahedron(
            e.x + Math.cos(ang) * 1.08 * koScale,
            hover + 0.2 + Math.sin(t * 3 + s) * 0.1,
            e.z + Math.sin(ang) * 1.08 * koScale,
            0.2 * koScale,
            0.44 * koScale,
            -ang,
            gR,
            gG,
            gB,
            3,
          );
        }
      } else {
        // Massive Bespoke Ecosystem Apex Warden Colossus
        const s = 1.65 * koScale;
        const lift = tele ? 0.38 : 0;
        const bMat = flash ? 3 : fp.mat === 2 ? 2 : 0;
        // Legs
        for (const side of [-0.46, 0.46]) {
          this.addSmoothCylinder(e.x + side * s * cy, ey, e.z - side * s * sy, 0.34 * s, 0.4 * s, 0.92 * s, 10, bR, bG, bB, bMat, e.yaw);
        }
        // Biome-specific torso + crown
        this.addSmoothCylinder(e.x, ey + 0.72 * s, e.z, 0.62 * s, 0.86 * s, 1.18 * s, 12, bR, bG, bB, bMat, e.yaw, 0, 0, 0.78);
        this.addOctahedron(e.x, ey + 1.22 * s, e.z, 0.58 * s, 0.62 * s, t, gR, gG, gB, 3);
        if (faunaKit === 'verdant-mycelial') {
          // Giant Treant Canopy-Crown
          this.addSmoothSphere(e.x, ey + 2.38 * s, e.z, 1.15 * s, 0.58 * s, 1.05 * s, 0.18, 0.48, 0.24, 4, e.yaw, 10, 5);
        } else if (faunaKit === 'pyroclastic-forge') {
          // Twin Forge Smokestack Shoulders
          for (const side of [-0.66, 0.66]) {
            this.addSmoothCylinder(e.x + side * s * cy, ey + 1.85 * s, e.z - side * s * sy, 0.24 * s, 0.18 * s, 0.95 * s, 8, 0.14, 0.12, 0.14, 2, e.yaw);
            this.addOctahedron(e.x + side * s * cy, ey + 2.95 * s, e.z - side * s * sy, 0.24 * s, 0.42 * s, t * 2, gR, gG, gB, 3);
          }
        } else if (faunaKit === 'pelagic-abyssal') {
          // Coral Reef Spire Crest
          this.addOctahedron(e.x, ey + 2.55 * s, e.z, 0.52 * s, 0.86 * s, e.yaw, fp.accent[0], fp.accent[1], fp.accent[2], 3);
        } else if (faunaKit === 'dune-sandstrider') {
          // Golden Sun-Disk Halo behind sandstone colossus
          this.addRing(e.x, ey + 2.15 * s, e.z, 0.76 * s, 1.05 * s, 18, gR, gG, gB, 3);
        } else if (faunaKit === 'glacial-frostborn') {
          // Crown of Ice Obelisks
          for (let ci = 0; ci < 5; ci++) {
            const ang = (ci * Math.PI * 2) / 5;
            this.addOctahedron(e.x + Math.cos(ang) * 0.52 * s, ey + 2.35 * s, e.z + Math.sin(ang) * 0.52 * s, 0.18 * s, 0.62 * s, ang, gR, gG, gB, 3);
          }
        }
        // Sculpted shoulder pauldrons & slamming gauntlets
        for (const side of [-1, 1]) {
          const sx = e.x + side * 1.02 * s * cy;
          const sz = e.z - side * 1.02 * s * sy;
          this.addSmoothSphere(sx, ey + 1.72 * s, sz, 0.46 * s, 0.34 * s, 0.46 * s, fp.accent[0], fp.accent[1], fp.accent[2], 2, e.yaw, 10, 5);
          const fx = e.x + side * 1.08 * s * cy + 0.32 * s * sy;
          const fz = e.z - side * 1.08 * s * sy + 0.32 * s * cy;
          this.addSmoothCylinder(fx, ey + (0.68 + lift) * s, fz, 0.34 * s, 0.28 * s, 0.95 * s, 10, fp.accent[0] * 0.82, fp.accent[1] * 0.82, fp.accent[2] * 0.82, 2, e.yaw);
        }
        // Warden head + glowing visor slit
        this.addSmoothSphere(e.x, ey + 2.06 * s, e.z, 0.38 * s, 0.36 * s, 0.38 * s, bR, bG, bB, bMat, e.yaw, 10, 5);
        this.addBox(e.x + sy * 0.34 * s, ey + 2.08 * s, e.z + cy * 0.34 * s, 0.42 * s, 0.09 * s, 0.1 * s, e.yaw, gR, gG, gB, 3);
        if (tele) {
          this.addRing(e.x, ey + 0.15, e.z, 3.6, 4.35, 24, 0.98, 0.34, 0.12, 3);
        }
      }
    }

    // 6. Interactive Landmarks
    for (const item of input.interactables) {
      const [ix, iz] = item.position;
      const iy = hAt(ix, iz);
      const isHighlight = item.id === input.highlightInteractableId;
      const activeCol: [number, number, number] = item.activated ? [0.96, 0.78, 0.3] : [0.34, 0.88, 0.82];

      const ecoTint = input.ambientRgb ?? [0.95, 0.78, 0.32];
      const beaconCol: [number, number, number] = item.activated
        ? [ecoTint[0], ecoTint[1], ecoTint[2]]
        : [activeCol[0] * 0.65 + ecoTint[0] * 0.35, activeCol[1] * 0.65 + ecoTint[1] * 0.35, activeCol[2] * 0.65 + ecoTint[2] * 0.35];

      if (item.kind === 'waystone-beacon') {
        this.addSmoothCylinder(ix, iy, iz, 0.78, 0.66, 1.1, 8, 0.45, 0.42, 0.38, 0);
        this.addSmoothCylinder(ix, iy + 1.08, iz, 0.82, 0.82, 0.18, 8, 0.84, 0.66, 0.3, 2);
        const cy = iy + 2.55 + Math.sin(t * 2.2 + ix) * 0.22;
        this.addOctahedron(ix, cy, iz, 0.65, 1.15, t * 0.9, beaconCol[0], beaconCol[1], beaconCol[2], 3);
        this.addRing(ix, iy + 0.14, iz, 1.5, isHighlight ? 2.1 : 1.85, 18, beaconCol[0], beaconCol[1], beaconCol[2], 3);
      } else if (item.kind === 'forge-bell') {
        const swing = item.activated ? Math.sin(t * 5.0) * 0.22 : Math.sin(t * 1.1) * 0.04;
        this.addBox(ix, iy + 4.4, iz, 2.2, 0.35, 0.35, 0, 0.55, 0.38, 0.22, 0);
        this.addSmoothCylinder(ix, iy + 2.15, iz, 0.92, 0.54, 1.68, 14, 0.88, 0.66, 0.28, 2, swing);
        this.addRing(ix, iy + 0.14, iz, 1.8, 2.2, 18, beaconCol[0], beaconCol[1], beaconCol[2], 3);
      } else if (item.kind === 'resonance-pier') {
        this.addSmoothCylinder(ix, iy, iz, 1.15, 1.05, 0.24, 12, 0.88, 0.68, 0.32, 2);
        this.addRing(ix, iy + 0.26, iz, 0.85, 1.25, 16, beaconCol[0], beaconCol[1], beaconCol[2], 3);
      } else if (item.kind === 'silicate-relic' && !item.activated) {
        const pulse = 0.85 + Math.sin(t * 3.4 + ix) * 0.15;
        this.addOctahedron(ix, iy + 0.55, iz, 0.55, 0.65, t * 0.8, 0.32 * pulse, 0.92 * pulse, 0.72 * pulse, 3);
        this.addOctahedron(ix + 0.42, iy + 0.38, iz + 0.25, 0.35, 0.42, -t, 0.48 * pulse, 0.96 * pulse, 0.68 * pulse, 3);
      } else if (item.kind === 'dungeon-portal') {
        const pulse = 0.82 + Math.sin(t * 3.2 + ix) * 0.18;
        this.addBox(ix, iy + 2.8, iz, 3.1, 4.9, 0.16, 0, 0.28 * pulse, 0.78 * pulse, 0.96 * pulse, 3);
        this.addOctahedron(ix, iy + 3.1 + Math.sin(t * 2.4) * 0.24, iz, 0.68, 1.18, t * 1.4, 0.56, 0.92, 0.98, 3);
        this.addRing(ix, iy + 0.16, iz, 1.9, isHighlight ? 2.65 : 2.35, 20, 0.32, 0.85, 0.96, 3);
      } else if (item.kind === 'dungeon-exit') {
        const pulse = 0.84 + Math.sin(t * 2.8) * 0.16;
        this.addBox(ix, iy + 2.8, iz, 2.7, 4.8, 0.16, 0, 0.96 * pulse, 0.78 * pulse, 0.32, 3);
        this.addOctahedron(ix, iy + 3.2 + Math.sin(t * 2.6) * 0.2, iz, 0.62, 1.05, -t * 1.5, 0.98, 0.86, 0.42, 3);
        this.addRing(ix, iy + 0.16, iz, 1.75, isHighlight ? 2.45 : 2.15, 20, 0.96, 0.78, 0.32, 3);
      } else if (item.kind === 'vault-chest') {
        this.addBox(ix, iy + 0.42, iz, 1.5, 0.78, 0.96, 0.2, 0.36, 0.25, 0.16, 0);
        this.addBox(ix, iy + 0.42, iz, 1.56, 0.18, 1.02, 0.2, 0.86, 0.66, 0.28, 2);
        const lidLift = item.activated ? 0.42 : 0.0;
        const lidPitch = item.activated ? -0.75 : 0;
        this.addBox(ix, iy + 0.92 + lidLift, iz - (item.activated ? 0.22 : 0), 1.52, 0.28, 0.98, 0.2, 0.44, 0.3, 0.18, 0, lidPitch);
        if (!item.activated) {
          this.addOctahedron(ix, iy + 1.38 + Math.sin(t * 3.0 + ix) * 0.12, iz, 0.22, 0.32, t * 1.6, 0.98, 0.82, 0.32, 3);
          this.addRing(ix, iy + 0.1, iz, 1.05, isHighlight ? 1.55 : 1.32, 16, 0.95, 0.76, 0.3, 3);
        }
      } else if (item.kind === 'seal-brazier') {
        this.addSmoothCylinder(ix, iy, iz, 0.68, 0.52, 1.15, 10, 0.34, 0.35, 0.38, 0);
        this.addSmoothCylinder(ix, iy + 1.08, iz, 0.72, 0.84, 0.26, 10, 0.84, 0.64, 0.28, 2);
        const flameH = item.activated ? 1.35 + Math.sin(t * 7.2 + ix) * 0.18 : 0.38 + Math.sin(t * 3.2 + ix) * 0.06;
        const [fr, fg, fb]: [number, number, number] = item.activated ? [0.36, 0.96, 0.78] : [0.96, 0.56, 0.18];
        this.addOctahedron(ix, iy + 1.45 + flameH * 0.45, iz, item.activated ? 0.52 : 0.28, flameH, t * 2.4, fr, fg, fb, 3);
        this.addRing(ix, iy + 0.12, iz, 1.15, isHighlight ? 1.68 : 1.45, 16, fr, fg, fb, 3);
      }
    }

    // 7. Placed Federated Foundation Banners
    for (const banner of input.banners) {
      const [bx, bz] = banner.position;
      const by = hAt(bx, bz);
      const wave = Math.sin(t * 3.2 + bx) * 0.14;
      this.addSmoothCylinder(bx, by, bz, 0.08, 0.07, 4.2, 8, 0.85, 0.68, 0.32, 2);
      this.addOctahedron(bx, by + 4.35, bz, 0.24, 0.34, t, 0.95, 0.78, 0.32, 3);
      const [pr, pg, pb] = banner.remote ? [0.28, 0.68, 0.62] : [0.76, 0.28, 0.22];
      this.addBox(bx + 0.65, by + 3.25, bz + wave, 1.25, 1.45, 0.08, wave, pr, pg, pb, 4);
      this.addRing(bx, by + 0.1, bz, 1.0, 1.35, 14, 0.92, 0.76, 0.34, 3);
    }

    // 8. Live Remote Multiplayer Waywrights (Distinct Guild Attire)
    for (const rp of input.remotePlayers) {
      const ry = hAt(rp.x, rp.z);
      const pulsing = Boolean(rp.actionPulseAt && Date.now() - rp.actionPulseAt < 500);
      const peerApp = compileRemoteWaywrightAppearance(rp.id, rp.guildId, rp.activeGear || 'hookblade');
      this.addCompiledCharacter(
        rp.x,
        ry,
        rp.z,
        rp.yaw || 0,
        peerApp,
        t * 5.5,
        0.35,
        pulsing ? 0.65 : 0,
        t,
      );
      if (Math.hypot(rp.x - input.playerX, rp.z - input.playerZ) > 2.5) {
        this.addOctahedron(rp.x, ry + 2.42 + Math.sin(t * 3 + rp.x) * 0.08, rp.z, 0.10, 0.15, t * 2, 0.42, 0.92, 0.8, 3);
      }
    }

    // 9. Projectiles & Combat Slashes / Shockwave Rings
    for (const proj of input.projectiles) {
      this.addOctahedron(proj.x, proj.y, proj.z, 0.28, 0.28, t * 6, 0.96, 0.44, 0.18, 3);
    }
    for (const sl of input.slashes) {
      if (!sl.active) continue;
      const frac = sl.age / Math.max(0.01, sl.duration);
      if (sl.isRadial) {
        const rad = 0.8 + frac * 4.4;
        this.addRing(sl.x, sl.y + 0.18, sl.z, Math.max(0.2, rad - 0.55), rad, 22, sl.r, sl.g, sl.b, 3);
      } else {
        const sy = Math.sin(sl.yaw), cy = Math.cos(sl.yaw);
        const arc = (frac - 0.5) * 1.9;
        const ax = sl.x + Math.sin(sl.yaw + arc) * 2.1;
        const az = sl.z + Math.cos(sl.yaw + arc) * 2.1;
        this.addBox(ax, sl.y + 1.15, az, 1.55 * (1 - frac * 0.35), 0.14, 0.42, sl.yaw + arc + 0.4, sl.r, sl.g, sl.b, 3);
        this.addBox(sl.x + sy * 1.4, sl.y + 1.1, sl.z + cy * 1.4, 2.2 * (1 - frac * 0.4), 0.1, 0.28, sl.yaw, sl.r, sl.g, sl.b, 3);
      }
    }

    // 10. Tracked Objective Golden Sky Beacon Pillar
    if (input.trackedCoords) {
      const [tx, tz] = input.trackedCoords;
      const ty = hAt(tx, tz);
      const dist = Math.hypot(tx - input.playerX, tz - input.playerZ);
      if (dist > 4.5) {
        this.addBox(tx, ty + 7.5, tz, 0.24, 15.0, 0.24, t, 0.95, 0.78, 0.32, 3);
        this.addRing(tx, ty + 0.25, tz, 1.3, 1.75, 16, 0.95, 0.78, 0.32, 3);
      }
    }

    // 10b. Open Cardinal Frontier Border Waygates (N/S/E/W seamless UniverseCell crossings!)
    if (!input.isDungeon) {
      const gates: Array<[number, number, number]> = [
        [0, -93, 0],
        [0, 93, 0],
        [-93, 0, Math.PI * 0.5],
        [93, 0, Math.PI * 0.5],
      ];
      const pulse = 0.84 + Math.sin(t * 2.4) * 0.16;
      for (const [gx, gz, gyaw] of gates) {
        const gy = hAt(gx, gz);
        const cx = Math.cos(gyaw);
        const sx = Math.sin(gyaw);
        for (const side of [-4.6, 4.6]) {
          const px = gx + side * cx;
          const pz = gz - side * sx;
          this.addSmoothCylinder(px, gy, pz, 0.65, 0.48, 5.4, 8, 0.34, 0.36, 0.40, 0);
          this.addOctahedron(px, gy + 6.1, pz, 0.42, 0.72, t * 1.4, 0.36 * pulse, 0.88 * pulse, 0.82 * pulse, 3);
        }
        this.addRing(gx, gy + 0.16, gz, 2.8, 3.35, 18, 0.88 * pulse, 0.74 * pulse, 0.34 * pulse, 3);
      }
    }

    // 11. Active Particles + Bespoke Ecosystem Floating Atmospheric Ambience
    for (const p of input.particles) {
      if (!p.active) continue;
      const s = p.scale * (p.life / Math.max(0.01, p.maxLife));
      this.addOctahedron(p.x, p.y, p.z, s, s, t * 5 + p.x, p.r, p.g, p.b, p.matCode);
    }

    if (input.ambientParticleKind) {
      const [ar, ag, ab] = input.ambientRgb ?? [0.95, 0.82, 0.46];
      const kind = input.ambientParticleKind;
      const count = input.isDungeon ? 20 : 24;
      for (let i = 0; i < count; i++) {
        const ang = (i * 2.39996) + t * (kind === 'desert-sand' ? 0.55 : kind === 'volcanic-embers' ? 0.18 : 0.12);
        const rad = (input.isDungeon ? 3.5 : 5.5) + ((i * 7.13) % (input.isDungeon ? 11.5 : 16.5));
        const driftX = kind === 'desert-sand' ? Math.sin(t * 2.4 + i) * 3.8 : Math.cos(ang) * rad;
        const driftZ = kind === 'desert-sand' ? Math.cos(t * 1.9 + i) * 14.0 : Math.sin(ang) * rad;
        const ax = input.playerX + driftX;
        const az = input.playerZ + driftZ;
        // Keep the close third-person camera lens corridor clear so particles never photobomb the lens
        if (Math.abs(ax - input.playerX) < 3.4 && az > input.playerZ + 2.0 && az < input.playerZ + 12.5) {
          continue;
        }
        const baseY = hAt(ax, az);
        let ay = baseY + 1.5;
        let sz = 0.075;
        if (kind === 'volcanic-embers') {
          ay = baseY + 0.6 + ((t * 1.85 + i * 0.71) % 6.8);
          sz = 0.09;
        } else if (kind === 'aurora-snow') {
          ay = baseY + 7.2 - ((t * 1.35 + i * 0.83) % 6.6);
          sz = 0.08;
        } else if (kind === 'emerald-spores') {
          ay = baseY + 1.1 + Math.sin(t * 1.6 + i * 1.3) * 1.2 + (i % 3) * 0.8;
          sz = 0.095;
        } else if (kind === 'sea-mist') {
          ay = baseY + 0.9 + Math.sin(t * 1.2 + i) * 0.6 + (i % 3) * 0.65;
          sz = 0.10;
        } else if (kind === 'desert-sand') {
          ay = baseY + 0.45 + ((i * 0.47) % 2.4);
          sz = 0.07;
        } else {
          ay = baseY + 1.6 + Math.sin(t * 1.4 + i * 1.1) * 0.9 + (i % 4) * 0.7;
          sz = 0.08;
        }
        this.addOctahedron(ax, ay, az, sz, sz * 1.2, t * 2.2 + i, ar, ag, ab, 3);
      }

      // 12. High-Altitude Biome Sky Ambience (Overworld Polar Aurora Ribbons, Caldera Plumes, Solar Halo)
      if (!input.isDungeon) {
        if (kind === 'aurora-snow') {
          // Undulating Polar Aurora Borealis sky ribbons arcing high across Borealis Glacier's northern sky
          for (let band = 0; band < 2; band++) {
            const zBase = -52 - band * 24;
            const yBase = 29 + band * 6.5;
            for (let seg = 0; seg < 10; seg++) {
              const x0 = -64 + seg * 13.5;
              const x1 = x0 + 13.5;
              const z0 = zBase + Math.sin(t * 0.55 + seg * 0.65 + band * 1.8) * 7.5;
              const z1 = zBase + Math.sin(t * 0.55 + (seg + 1) * 0.65 + band * 1.8) * 7.5;
              const hWave0 = 4.2 + Math.cos(t * 0.8 + seg * 0.9) * 1.4;
              const hWave1 = 4.2 + Math.cos(t * 0.8 + (seg + 1) * 0.9) * 1.4;
              const glow = 0.76 + Math.sin(t * 1.1 + seg * 0.7 + band) * 0.22;
              const r = (band === 0 ? 0.24 : 0.46) * glow;
              const g = (band === 0 ? 0.96 : 0.78) * glow;
              const b = (band === 0 ? 0.74 : 0.98) * glow;
              this.addQuad(
                [x0, yBase, z0],
                [x1, yBase, z1],
                [x1, yBase + hWave1, z1],
                [x0, yBase + hWave0, z0],
                r,
                g,
                b,
                3,
              );
            }
          }
        } else if (kind === 'volcanic-embers') {
          // Glowing high-altitude volcanic caldera smoke & ember rings above the northern crater
          for (let r = 0; r < 3; r++) {
            const lift = 18 + ((t * 2.2 + r * 6.5) % 18);
            const rad = 6 + r * 3.8;
            this.addRing(0, lift, -28, rad - 0.55, rad, 18, 0.96, 0.36, 0.10, 3);
          }
        } else if (kind === 'desert-sand') {
          // Gleaming overhead golden solar zenith halo above the Caravan Ziggurat
          this.addRing(0, 29, -32, 11.5, 12.6, 24, 0.98, 0.82, 0.34, 3);
          this.addRing(0, 29.6, -32, 7.2, 7.8, 20, 0.96, 0.66, 0.24, 3);
        } else if (kind === 'emerald-spores') {
          // Floating luminous canopy spore rings drifting high over Oakhaven's aqueduct terraces
          for (let r = 0; r < 3; r++) {
            const ang = t * 0.22 + r * 2.1;
            this.addRing(Math.cos(ang) * 18, 17 + r * 2.4, -18 + Math.sin(ang) * 14, 2.4, 2.9, 16, 0.32, 0.94, 0.58, 3);
          }
        }
      }
    }

    return {
      pos: this.pos.subarray(0, this.vCount * 3),
      norm: this.norm.subarray(0, this.vCount * 3),
      col: this.col.subarray(0, this.vCount * 3),
      idx: this.idx.subarray(0, this.iCount),
    };
  }
}
