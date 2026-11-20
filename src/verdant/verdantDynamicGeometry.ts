import { surfaceHeightAt, vaelmorHeightAt } from '../game/vaelmorRenderer';
import type { EnemyEntity, ProjectileEntity } from '../game/rpgLogic';
import type { FoundationBanner, GameNpc, GearSlotId, WorldInteractable } from '../game/worldData';
import type { RemotePlayerState } from '../game/multiplayerTypes';

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
  matCode: number; // 0 matte, 2 metal, 3 emissive
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
  gorgeZ?: number;
  gorgeWaveAmp?: number;
  showMagmaSeams?: boolean;
  showCoastalInlet?: boolean;
  isDungeon?: boolean;
  dungeonStyle?: string;
}

export interface DynamicBuffers {
  pos: Float32Array;
  norm: Float32Array;
  col: Float32Array;
  idx: Uint32Array;
}

/**
 * Reusable zero-GC dynamic mesh packer targeting Verdant's `scene-hd-renderer.mjs`
 * WebGL2 3-pass CSM/GGX/ACES shader.
 *
 * Encodes Verdant material classes directly into vertex color `r` channel:
 *  - `mat = 0`: matte stone/cloth/leather
 *  - `mat = 1`: animated reflective Fresnel water (`v_m == 1.0`)
 *  - `mat = 2`: metallic bronze/gold/steel armor (`v_m == 2.0`)
 *  - `mat = 3`: luminous emissive runes/magma/crystals/VFX (`v_m == 3.0`)
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

  constructor(maxVerts = 36000, maxIdx = 68000) {
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
    // Clamp base R to [0.01, 0.985] before adding integer material class
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
  ): void {
    if (!this.ensureSpace(24, 36)) return;
    const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const cpi = Math.cos(pitch), spi = Math.sin(pitch);
    const xf = (lx: number, ly: number, lz: number): [number, number, number] => {
      const py = ly * cpi - lz * spi;
      const pz = ly * spi + lz * cpi;
      return [cx + lx * cyw + pz * syw, cy + py, cz - lx * syw + pz * cyw];
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

  private hexToRgb(hex: number): [number, number, number] {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  private addCylinder(
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
    matCode = 0,
    yaw = 0,
    tiltX = 0,
  ): void {
    if (!this.ensureSpace(segs * 4, segs * 6)) return;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const ct = Math.cos(tiltX), st = Math.sin(tiltX);
    const xf = (lx: number, ly: number, lz: number): [number, number, number] => {
      const ty = ly * ct - lz * st;
      const tz = ly * st + lz * ct;
      return [cx + lx * cyw + tz * syw, y0 + ty, cz - lx * syw + tz * cyw];
    };
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const b0 = xf(c0 * rBot, 0, s0 * rBot);
      const b1 = xf(c1 * rBot, 0, s1 * rBot);
      const t1 = xf(c1 * rTop, height, s1 * rTop);
      const t0 = xf(c0 * rTop, height, s0 * rTop);
      this.addQuad(b1, b0, t0, t1, r, g, b, matCode);
    }
  }

  private addSphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    r: number,
    g: number,
    b: number,
    matCode = 0,
  ): void {
    const segs = 8;
    const rings = 4;
    if (!this.ensureSpace(segs * rings * 4, segs * rings * 6)) return;
    for (let ri = 0; ri < rings; ri++) {
      const p0 = -Math.PI * 0.5 + (ri / rings) * Math.PI;
      const p1 = -Math.PI * 0.5 + ((ri + 1) / rings) * Math.PI;
      const y0 = cy + Math.sin(p0) * ry;
      const y1 = cy + Math.sin(p1) * ry;
      const rad0 = Math.cos(p0);
      const rad1 = Math.cos(p1);
      for (let si = 0; si < segs; si++) {
        const a0 = (si / segs) * Math.PI * 2;
        const a1 = ((si + 1) / segs) * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const v00: [number, number, number] = [cx + c0 * rad0 * rx, y0, cz + s0 * rad0 * rz];
        const v10: [number, number, number] = [cx + c1 * rad0 * rx, y0, cz + s1 * rad0 * rz];
        const v11: [number, number, number] = [cx + c1 * rad1 * rx, y1, cz + s1 * rad1 * rz];
        const v01: [number, number, number] = [cx + c0 * rad1 * rx, y1, cz + s0 * rad1 * rz];
        this.addQuad(v10, v00, v01, v11, r, g, b, matCode);
      }
    }
  }

  private addHumanoid(
    x: number,
    y: number,
    z: number,
    yaw: number,
    tunicRgb: [number, number, number],
    trimRgb: [number, number, number],
    stridePhase: number,
    strideAmp: number,
    swingAmt: number,
    weaponKind: 'hookblade' | 'bellhammer' | 'lantern' | 'compass' | 'staff' | 'halberd' | 'none',
    scale = 1.0,
  ): void {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const local = (lx: number, ly: number, lz: number): [number, number, number] => [
      x + (lx * cyw + lz * syw) * scale,
      y + ly * scale,
      z + (-lx * syw + lz * cyw) * scale,
    ];
    const legSwing = Math.sin(stridePhase) * 0.42 * strideAmp;
    const armSwing = -legSwing * 0.75;
    const bob = Math.abs(Math.sin(stridePhase)) * 0.06 * strideAmp;

    // Sculpted Tapered Boots & Greaves
    const lLeg = local(-0.15, 0.0 + bob, legSwing * 0.22);
    const rLeg = local(0.15, 0.0 + bob, -legSwing * 0.22);
    this.addCylinder(lLeg[0], lLeg[1], lLeg[2], 0.11 * scale, 0.13 * scale, 0.74 * scale, 7, 0.16, 0.14, 0.12, 0, yaw, legSwing * 0.5);
    this.addCylinder(rLeg[0], rLeg[1], rLeg[2], 0.11 * scale, 0.13 * scale, 0.74 * scale, 7, 0.16, 0.14, 0.12, 0, yaw, -legSwing * 0.5);

    // Flared Armored Coat Skirt & Tapered Cuirass Torso
    const skirt = local(0, 0.52 + bob, 0);
    this.addCylinder(skirt[0], skirt[1], skirt[2], 0.36 * scale, 0.26 * scale, 0.38 * scale, 8, tunicRgb[0] * 0.85, tunicRgb[1] * 0.85, tunicRgb[2] * 0.9, 0, yaw);
    const torso = local(0, 0.84 + bob, 0);
    this.addCylinder(torso[0], torso[1], torso[2], 0.25 * scale, 0.33 * scale, 0.62 * scale, 8, tunicRgb[0], tunicRgb[1], tunicRgb[2], 0, yaw);
    // Metallic Belt & Breastplate Trim
    const belt = local(0, 0.8 + bob, 0);
    this.addCylinder(belt[0], belt[1], belt[2], 0.28 * scale, 0.28 * scale, 0.12 * scale, 8, trimRgb[0], trimRgb[1], trimRgb[2], 2, yaw);

    // Rounded Sculpted Metallic Pauldrons (Shoulders)
    const lPauld = local(-0.36, 1.38 + bob, 0);
    const rPauld = local(0.36, 1.38 + bob, 0);
    this.addSphere(lPauld[0], lPauld[1], lPauld[2], 0.18 * scale, 0.14 * scale, 0.19 * scale, trimRgb[0], trimRgb[1], trimRgb[2], 2);
    this.addSphere(rPauld[0], rPauld[1], rPauld[2], 0.18 * scale, 0.14 * scale, 0.19 * scale, trimRgb[0], trimRgb[1], trimRgb[2], 2);

    // Flowing Tapered Traveler Cape
    const capeSway = 0.24 + strideAmp * 0.34 + Math.sin(stridePhase * 0.65) * 0.08;
    const cape = local(0, 0.98 + bob, -0.25 - capeSway * 0.22);
    this.addBox(cape[0], cape[1], cape[2], 0.56 * scale, 0.96 * scale, 0.06 * scale, yaw, tunicRgb[0] * 0.76, tunicRgb[1] * 0.78, tunicRgb[2] * 0.85, 0, -capeSway);

    // Sculpted Rounded Head + Layered Traveler Hood & Mantle Collar
    const collar = local(0, 1.44 + bob, 0);
    this.addCylinder(collar[0], collar[1], collar[2], 0.3 * scale, 0.22 * scale, 0.14 * scale, 8, trimRgb[0] * 0.85, trimRgb[1] * 0.85, trimRgb[2] * 0.85, 0, yaw);
    const head = local(0, 1.67 + bob, 0.02);
    this.addSphere(head[0], head[1], head[2], 0.19 * scale, 0.22 * scale, 0.2 * scale, 0.78, 0.64, 0.53, 0);
    const hood = local(0, 1.72 + bob, -0.04);
    this.addSphere(hood[0], hood[1], hood[2], 0.23 * scale, 0.23 * scale, 0.24 * scale, tunicRgb[0] * 0.88, tunicRgb[1] * 0.88, tunicRgb[2] * 0.92, 0);

    // Sculpted Cylindrical Arms
    const lArm = local(-0.37, 0.82 + bob, armSwing * 0.18);
    this.addCylinder(lArm[0], lArm[1], lArm[2], 0.085 * scale, 0.105 * scale, 0.54 * scale, 6, tunicRgb[0] * 0.9, tunicRgb[1] * 0.9, tunicRgb[2] * 0.9, 0, yaw, armSwing);
    const wPitch = swingAmt > 0 ? -1.15 + swingAmt * 2.4 : -armSwing - 0.3;
    const rArm = local(0.37, 0.84 + bob, 0.1 + swingAmt * 0.24);
    this.addCylinder(rArm[0], rArm[1], rArm[2], 0.085 * scale, 0.105 * scale, 0.54 * scale, 6, tunicRgb[0] * 0.9, tunicRgb[1] * 0.9, tunicRgb[2] * 0.9, 0, yaw, wPitch);

    // Equipped Fantasy Weapon / Tool
    const wHand = local(0.45, 0.96 + bob + (swingAmt > 0 ? 0.22 : 0), 0.52 + swingAmt * 0.3);
    if (weaponKind === 'hookblade') {
      const bYaw = yaw + swingAmt * 1.65 - 0.45;
      this.addBox(wHand[0], wHand[1], wHand[2], 0.06 * scale, 0.14 * scale, 1.38 * scale, bYaw, 0.84, 0.72, 0.45, 2);
      // Curved lodestone edge inlay
      this.addBox(wHand[0], wHand[1] + 0.05, wHand[2], 0.03 * scale, 0.05 * scale, 1.15 * scale, bYaw, 0.96, 0.76, 0.3, 3);
    } else if (weaponKind === 'bellhammer') {
      this.addCylinder(wHand[0], wHand[1] - 0.35, wHand[2], 0.045 * scale, 0.05 * scale, 1.25 * scale, 6, 0.44, 0.31, 0.2, 0, yaw, 0.95);
      const headPos = local(0.46, 1.04 + bob, 0.98);
      this.addCylinder(headPos[0], headPos[1] - 0.2, headPos[2], 0.24 * scale, 0.16 * scale, 0.46 * scale, 8, 0.88, 0.64, 0.28, 2, yaw);
    } else if (weaponKind === 'lantern') {
      this.addOctahedron(wHand[0], wHand[1] + 0.12, wHand[2], 0.21 * scale, 0.3 * scale, yaw, 0.38, 0.9, 0.76, 3);
    } else if (weaponKind === 'compass') {
      this.addOctahedron(wHand[0], wHand[1] + 0.1, wHand[2], 0.2 * scale, 0.2 * scale, yaw, 0.92, 0.76, 0.38, 2);
    } else if (weaponKind === 'staff' || weaponKind === 'halberd') {
      const st = local(0.5, 0.1 + bob, 0.24);
      this.addCylinder(st[0], st[1], st[2], 0.04 * scale, 0.045 * scale, 2.25 * scale, 6, 0.5, 0.38, 0.24, 0, yaw);
      this.addOctahedron(st[0], st[1] + 2.32 * scale, st[2], 0.18 * scale, 0.28 * scale, yaw, trimRgb[0], trimRgb[1], trimRgb[2], weaponKind === 'staff' ? 3 : 2);
    }
  }

  public build(input: DynamicSceneInput): DynamicBuffers {
    this.reset();
    const t = input.timeSec;
    const hAt = input.heightAt ?? surfaceHeightAt;
    const waterY = input.waterLevel ?? -1.75;
    const gorgeZ = input.gorgeZ ?? 5.0;
    const gorgeWave = input.gorgeWaveAmp ?? 2.8;

    // 1. Animated Reflective Water / Dungeon Abyss Chasm (v_m = 1.0 or 3.0)
    if (input.isDungeon) {
      const style = input.dungeonStyle ?? 'catacomb-vault';
      const isMagma = style === 'geothermal-depths';
      const isGlacial = style === 'glacial-crypt';
      const chasmMat = isMagma || isGlacial ? 3 : 1;
      const pulse = 0.86 + Math.sin(t * 2.2) * 0.14;
      const [cr, cg, cb]: [number, number, number] = isMagma
        ? [0.96 * pulse, 0.34 * pulse, 0.08]
        : isGlacial
          ? [0.22 * pulse, 0.72 * pulse, 0.96]
          : style === 'sunken-cistern'
            ? [0.1, 0.42, 0.48]
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
    } else {
      for (let gx = -104; gx < 104; gx += 8) {
        const rz0 = gorgeZ + Math.sin(gx * 0.075) * gorgeWave;
        const rz1 = gorgeZ + Math.sin((gx + 8) * 0.075) * gorgeWave;
        this.addQuad(
          [gx, waterY, rz0 - 8.5],
          [gx, waterY, rz0 + 8.5],
          [gx + 8, waterY, rz1 + 8.5],
          [gx + 8, waterY, rz1 - 8.5],
          0.11,
          0.34,
          0.44,
          1,
        );
      }
      if (input.showCoastalInlet !== false) {
        const coastY = Math.max(waterY, waterY + 0.35);
        for (let x = 14; x < 94; x += 10) {
          for (let z = 14; z < 94; z += 10) {
            this.addQuad(
              [x, coastY, z],
              [x, coastY, z + 10],
              [x + 10, coastY, z + 10],
              [x + 10, coastY, z],
              0.09,
              0.29,
              0.41,
              1,
            );
          }
        }
      }
    }

    // 2. Geothermal Magma Fissure Seams (for Vaelmor Ashen Kiln & Obsidian Crucible realms)
    if (input.showMagmaSeams !== false) {
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

    // 3. Articulated Waywright Player Character
    const strideAmp = Math.min(1, input.playerSpeed / 7.5);
    const stridePhase = t * 11.5;
    const dodgeGlow = input.dodgeTimer > 0;
    this.addHumanoid(
      input.playerX,
      input.playerY,
      input.playerZ,
      input.playerYaw,
      dodgeGlow ? [0.42, 0.65, 0.72] : [0.22, 0.36, 0.44],
      [0.86, 0.68, 0.34],
      stridePhase,
      strideAmp,
      input.attackSwing,
      input.activeGear,
      1.06,
    );

    // 4. Bespoke Articulated Realm NPCs
    for (const npc of input.npcs) {
      const [nx, nz] = npc.position;
      const ny = hAt(nx, nz);
      const toPlayer = Math.atan2(input.playerX - nx, input.playerZ - nz);
      const tunic = this.hexToRgb(npc.cloakHex);
      const trim = this.hexToRgb(npc.trimHex);
      const wKind =
        npc.id === 'npc-tarsik'
          ? 'bellhammer'
          : npc.id === 'npc-kaelen'
            ? 'halberd'
            : npc.id === 'npc-seraia'
              ? 'lantern'
              : 'staff';
      this.addHumanoid(nx, ny, nz, toPlayer, tunic, trim, t * 1.4, 0.06, 0, wKind, 1.05);
      // Floating golden dialogue beacon diamond overhead
      const bobY = ny + 2.55 + Math.sin(t * 2.8 + nx) * 0.14;
      this.addOctahedron(nx, bobY, nz, 0.24, 0.36, t * 1.5, 0.96, 0.78, 0.32, 3);
    }

    // 5. Hostile Frontier Creatures (Stalkers, Shardcasters, Basalt Tide-Colossus)
    for (const e of input.enemies) {
      if (e.state === 'ko' && e.koTimer <= 0) continue;
      const ey = hAt(e.x, e.z);
      const flash = e.hitFlashTimer > 0;
      const tele = e.state === 'telegraph';
      const koScale = e.state === 'ko' ? Math.max(0.15, e.koTimer / 0.45) : 1.0;

      if (e.archetype === 'stalker') {
        const bodyR = flash ? 0.98 : tele ? 0.96 : 0.24;
        const bodyG = flash ? 0.96 : tele ? 0.46 : 0.27;
        const bodyB = flash ? 0.9 : tele ? 0.16 : 0.32;
        const crouch = tele ? -0.18 : Math.sin(t * 9 + e.x) * 0.06;
        // Quadruped armored hound silhouette
        this.addBox(e.x, ey + (0.68 + crouch) * koScale, e.z, 0.72 * koScale, 0.56 * koScale, 1.38 * koScale, e.yaw, bodyR, bodyG, bodyB, flash ? 3 : 0);
        // Glowing dorsal crystalline spine plates
        this.addOctahedron(e.x, ey + (1.12 + crouch) * koScale, e.z, 0.24 * koScale, 0.42 * koScale, e.yaw, 0.95, 0.58, 0.22, 3);
        // Legs
        const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
        for (const [lx, lz] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]]) {
          this.addBox(e.x + lx * cy + lz * sy, ey + 0.3 * koScale, e.z - lx * sy + lz * cy, 0.16 * koScale, 0.62 * koScale, 0.18 * koScale, e.yaw, 0.18, 0.19, 0.22, 0);
        }
        if (tele) {
          this.addRing(e.x, ey + 0.12, e.z, 1.2, 1.65, 14, 0.96, 0.42, 0.14, 3);
        }
      } else if (e.archetype === 'shardcaster') {
        const hover = ey + 1.35 + Math.sin(t * 3.1 + e.z) * 0.22;
        this.addOctahedron(e.x, hover, e.z, 0.56 * koScale, 1.15 * koScale, e.yaw + t, flash ? 0.98 : 0.32, flash ? 0.96 : 0.48, flash ? 0.9 : 0.62, flash ? 3 : 2);
        // 3 Orbiting luminous crystal shards
        for (let s = 0; s < 3; s++) {
          const ang = t * 2.4 + (s * Math.PI * 2) / 3;
          this.addOctahedron(
            e.x + Math.cos(ang) * 1.05 * koScale,
            hover + 0.15,
            e.z + Math.sin(ang) * 1.05 * koScale,
            0.2 * koScale,
            0.42 * koScale,
            -ang,
            tele ? 0.98 : 0.36,
            tele ? 0.54 : 0.92,
            tele ? 0.22 : 0.86,
            3,
          );
        }
      } else {
        // Massive Basalt Tide-Colossus Boss
        const s = 1.65 * koScale;
        const lift = tele ? 0.35 : 0;
        this.addBox(e.x, ey + 0.9 * s, e.z, 1.45 * s, 1.65 * s, 1.15 * s, e.yaw, flash ? 0.98 : 0.22, flash ? 0.95 : 0.23, flash ? 0.88 : 0.26, flash ? 3 : 0);
        // Massive magma heart core
        this.addOctahedron(e.x, ey + 1.05 * s, e.z, 0.62 * s, 0.68 * s, t, 0.98, 0.44, 0.14, 3);
        // Armored shoulders & raised slamming fists
        const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
        for (const side of [-1, 1]) {
          const fx = e.x + side * 1.05 * s * cy + 0.3 * s * sy;
          const fz = e.z - side * 1.05 * s * sy + 0.3 * s * cy;
          this.addBox(fx, ey + (1.1 + lift) * s, fz, 0.55 * s, 1.15 * s, 0.55 * s, e.yaw, 0.32, 0.28, 0.26, 2);
        }
        // Head monolith
        this.addBox(e.x, ey + 1.98 * s, e.z, 0.72 * s, 0.62 * s, 0.72 * s, e.yaw, 0.28, 0.29, 0.33, 0);
        if (tele) {
          // Dramatic glowing heavy slam danger ring!
          this.addRing(e.x, ey + 0.15, e.z, 3.6, 4.35, 22, 0.98, 0.34, 0.12, 3);
        }
      }
    }

    // 6. Interactive Landmarks (Waystones, 174 Hz Resonance Bell, Sounding Plate, Silicate Moss)
    for (const item of input.interactables) {
      const [ix, iz] = item.position;
      const iy = hAt(ix, iz);
      const isHighlight = item.id === input.highlightInteractableId;
      const activeCol: [number, number, number] = item.activated ? [0.96, 0.78, 0.3] : [0.34, 0.88, 0.82];

      if (item.kind === 'waystone-beacon') {
        // Carved bronze pedestal + levitating rotating Waystone crystal + runic halo
        this.addBox(ix, iy + 0.55, iz, 1.35, 1.1, 1.35, 0.4, 0.45, 0.42, 0.38, 0);
        this.addBox(ix, iy + 1.15, iz, 1.5, 0.18, 1.5, 0.4, 0.82, 0.64, 0.3, 2);
        const cy = iy + 2.55 + Math.sin(t * 2.2 + ix) * 0.22;
        this.addOctahedron(ix, cy, iz, 0.65, 1.15, t * 0.9, activeCol[0], activeCol[1], activeCol[2], 3);
        this.addRing(ix, iy + 0.14, iz, 1.5, isHighlight ? 2.1 : 1.85, 16, activeCol[0], activeCol[1], activeCol[2], 3);
      } else if (item.kind === 'forge-bell') {
        // Great 174 Hz Cast-Bronze Foundry Resonance Bell suspended inside the timber pavilion
        const swing = item.activated ? Math.sin(t * 5.0) * 0.22 : Math.sin(t * 1.1) * 0.04;
        this.addBox(ix, iy + 4.4, iz, 2.2, 0.35, 0.35, 0, 0.55, 0.38, 0.22, 0);
        this.addBox(ix, iy + 2.95, iz, 1.45, 1.65, 1.45, swing, 0.86, 0.64, 0.28, 2);
        this.addRing(ix, iy + 0.14, iz, 1.8, 2.2, 16, activeCol[0], activeCol[1], activeCol[2], 3);
      } else if (item.kind === 'resonance-pier') {
        // Bronze Third Pier Sounding Plate on the Parabolic Bridge Deck
        this.addBox(ix, iy + 0.12, iz, 1.85, 0.24, 1.85, Math.PI / 4, 0.88, 0.68, 0.32, 2);
        this.addRing(ix, iy + 0.26, iz, 0.85, 1.25, 14, activeCol[0], activeCol[1], activeCol[2], 3);
      } else if (item.kind === 'silicate-relic' && !item.activated) {
        // Bioluminescent Silicate Moss Cluster
        const pulse = 0.85 + Math.sin(t * 3.4 + ix) * 0.15;
        this.addOctahedron(ix, iy + 0.55, iz, 0.55, 0.65, t * 0.8, 0.32 * pulse, 0.92 * pulse, 0.72 * pulse, 3);
        this.addOctahedron(ix + 0.42, iy + 0.38, iz + 0.25, 0.35, 0.42, -t, 0.48 * pulse, 0.96 * pulse, 0.68 * pulse, 3);
      } else if (item.kind === 'dungeon-portal') {
        // Swirling Meridian Dungeon Descent Veil + Levitating Cyan/Violet Seal Crystal
        const pulse = 0.82 + Math.sin(t * 3.2 + ix) * 0.18;
        this.addBox(ix, iy + 2.8, iz, 3.1, 4.9, 0.16, 0, 0.28 * pulse, 0.78 * pulse, 0.96 * pulse, 3);
        this.addOctahedron(ix, iy + 3.1 + Math.sin(t * 2.4) * 0.24, iz, 0.68, 1.18, t * 1.4, 0.56, 0.92, 0.98, 3);
        this.addRing(ix, iy + 0.16, iz, 1.9, isHighlight ? 2.65 : 2.35, 18, 0.32, 0.85, 0.96, 3);
      } else if (item.kind === 'dungeon-exit') {
        // Ascending Golden Return Portal Column
        const pulse = 0.84 + Math.sin(t * 2.8) * 0.16;
        this.addBox(ix, iy + 2.8, iz, 2.7, 4.8, 0.16, 0, 0.96 * pulse, 0.78 * pulse, 0.32, 3);
        this.addOctahedron(ix, iy + 3.2 + Math.sin(t * 2.6) * 0.2, iz, 0.62, 1.05, -t * 1.5, 0.98, 0.86, 0.42, 3);
        this.addRing(ix, iy + 0.16, iz, 1.75, isHighlight ? 2.45 : 2.15, 18, 0.96, 0.78, 0.32, 3);
      } else if (item.kind === 'vault-chest') {
        // Banded Bronze-and-Oak Frontier Treasure Coffer
        this.addBox(ix, iy + 0.42, iz, 1.5, 0.78, 0.96, 0.2, 0.36, 0.25, 0.16, 0);
        this.addBox(ix, iy + 0.42, iz, 1.56, 0.18, 1.02, 0.2, 0.86, 0.66, 0.28, 2);
        const lidLift = item.activated ? 0.42 : 0.0;
        const lidPitch = item.activated ? -0.75 : 0;
        this.addBox(ix, iy + 0.92 + lidLift, iz - (item.activated ? 0.22 : 0), 1.52, 0.28, 0.98, 0.2, 0.44, 0.3, 0.18, 0, lidPitch);
        if (!item.activated) {
          this.addOctahedron(ix, iy + 1.38 + Math.sin(t * 3.0 + ix) * 0.12, iz, 0.22, 0.32, t * 1.6, 0.98, 0.82, 0.32, 3);
          this.addRing(ix, iy + 0.1, iz, 1.05, isHighlight ? 1.55 : 1.32, 14, 0.95, 0.76, 0.3, 3);
        }
      } else if (item.kind === 'seal-brazier') {
        // Vault Seal Brazier Pedestal + Ignitable Flame Column
        this.addCylinder(ix, iy, iz, 0.68, 0.52, 1.15, 8, 0.34, 0.35, 0.38, 0);
        this.addCylinder(ix, iy + 1.08, iz, 0.72, 0.84, 0.26, 8, 0.84, 0.64, 0.28, 2);
        const flameH = item.activated ? 1.35 + Math.sin(t * 7.2 + ix) * 0.18 : 0.38 + Math.sin(t * 3.2 + ix) * 0.06;
        const [fr, fg, fb]: [number, number, number] = item.activated ? [0.36, 0.96, 0.78] : [0.96, 0.56, 0.18];
        this.addOctahedron(ix, iy + 1.45 + flameH * 0.45, iz, item.activated ? 0.52 : 0.28, flameH, t * 2.4, fr, fg, fb, 3);
        this.addRing(ix, iy + 0.12, iz, 1.15, isHighlight ? 1.68 : 1.45, 14, fr, fg, fb, 3);
      }
    }

    // 7. Placed Federated Foundation Banners (Local + Live Multiplayer Peers!)
    for (const banner of input.banners) {
      const [bx, bz] = banner.position;
      const by = hAt(bx, bz);
      const wave = Math.sin(t * 3.2 + bx) * 0.14;
      // Bronze banner pole & finial
      this.addBox(bx, by + 2.1, bz, 0.16, 4.2, 0.16, 0, 0.85, 0.68, 0.32, 2);
      this.addOctahedron(bx, by + 4.35, bz, 0.24, 0.34, t, 0.95, 0.78, 0.32, 3);
      // Pennant cloth
      const [pr, pg, pb] = banner.remote ? [0.28, 0.68, 0.62] : [0.76, 0.28, 0.22];
      this.addBox(bx + 0.65, by + 3.25, bz + wave, 1.25, 1.45, 0.08, wave, pr, pg, pb, 0);
      this.addRing(bx, by + 0.1, bz, 1.0, 1.35, 12, 0.92, 0.76, 0.34, 3);
    }

    // 8. Live Remote Multiplayer Waywrights (via /ws/realm + Verdant Stitch)
    for (const rp of input.remotePlayers) {
      const ry = hAt(rp.x, rp.z);
      const pulsing = Boolean(rp.actionPulseAt && Date.now() - rp.actionPulseAt < 500);
      this.addHumanoid(
        rp.x,
        ry,
        rp.z,
        rp.yaw || 0,
        [0.24, 0.54, 0.48],
        [0.88, 0.74, 0.38],
        t * 5.5,
        0.35,
        pulsing ? 0.65 : 0,
        rp.activeGear || 'hookblade',
        1.04,
      );
      this.addOctahedron(rp.x, ry + 2.45 + Math.sin(t * 3 + rp.x) * 0.1, rp.z, 0.18, 0.26, t * 2, 0.42, 0.92, 0.8, 3);
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
        this.addRing(sl.x, sl.y + 0.18, sl.z, Math.max(0.2, rad - 0.55), rad, 20, sl.r, sl.g, sl.b, 3);
      } else {
        const sy = Math.sin(sl.yaw), cy = Math.cos(sl.yaw);
        const arc = (frac - 0.5) * 1.9;
        const ax = sl.x + Math.sin(sl.yaw + arc) * 2.1;
        const az = sl.z + Math.cos(sl.yaw + arc) * 2.1;
        this.addBox(ax, sl.y + 1.15, az, 1.55 * (1 - frac * 0.35), 0.14, 0.42, sl.yaw + arc + 0.4, sl.r, sl.g, sl.b, 3);
        this.addBox(sl.x + sy * 1.4, sl.y + 1.1, sl.z + cy * 1.4, 2.2 * (1 - frac * 0.4), 0.1, 0.28, sl.yaw, sl.r, sl.g, sl.b, 3);
      }
    }

    // 10. Tracked Objective Golden Sky Beacon Pillar (subtle guiding landmark on horizon)
    if (input.trackedCoords) {
      const [tx, tz] = input.trackedCoords;
      const ty = hAt(tx, tz);
      const dist = Math.hypot(tx - input.playerX, tz - input.playerZ);
      if (dist > 4.5) {
        this.addBox(tx, ty + 7.5, tz, 0.24, 15.0, 0.24, t, 0.95, 0.78, 0.32, 3);
        this.addRing(tx, ty + 0.25, tz, 1.3, 1.75, 16, 0.95, 0.78, 0.32, 3);
      }
    }

    // 11. Active Particles (sparks, heal motes, shatter fragments)
    for (const p of input.particles) {
      if (!p.active) continue;
      const s = p.scale * (p.life / Math.max(0.01, p.maxLife));
      this.addOctahedron(p.x, p.y, p.z, s, s, t * 5 + p.x, p.r, p.g, p.b, p.matCode);
    }

    return {
      pos: this.pos.subarray(0, this.vCount * 3),
      norm: this.norm.subarray(0, this.vCount * 3),
      col: this.col.subarray(0, this.vCount * 3),
      idx: this.idx.subarray(0, this.iCount),
    };
  }
}
