import {
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import {
  synthesizeRealmEcosystem,
  type StructurePrimitive,
  type SynthesizedFloraInstance,
} from './verdantEcosystemCatalog';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';

type Rgb = [number, number, number];

class MeshBuilder {
  public pos: number[] = [];
  public norm: number[] = [];
  public col: number[] = [];
  public idx: number[] = [];

  public addVertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    r: number,
    g: number,
    b: number,
  ): number {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.norm.push(nx, ny, nz);
    this.col.push(r, g, b);
    return i;
  }

  public addTri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  public addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    c: Rgb,
  ): void {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0];
    const vy = p3[1] - p0[1];
    const vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const i0 = this.addVertex(p0[0], p0[1], p0[2], nx, ny, nz, c[0], c[1], c[2]);
    const i1 = this.addVertex(p1[0], p1[1], p1[2], nx, ny, nz, c[0], c[1], c[2]);
    const i2 = this.addVertex(p2[0], p2[1], p2[2], nx, ny, nz, c[0], c[1], c[2]);
    const i3 = this.addVertex(p3[0], p3[1], p3[2], nx, ny, nz, c[0], c[1], c[2]);
    this.addTri(i0, i1, i2);
    this.addTri(i0, i2, i3);
  }

  public addBox(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    c: Rgb,
    yaw = 0,
  ): void {
    const hx = sx * 0.5;
    const hy = sy * 0.5;
    const hz = sz * 0.5;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const pt = (lx: number, ly: number, lz: number): [number, number, number] => [
      cx + lx * cos + lz * sin,
      cy + ly,
      cz - lx * sin + lz * cos,
    ];
    const shade = (k: number): Rgb => [
      Math.min(1, c[0] * k),
      Math.min(1, c[1] * k),
      Math.min(1, c[2] * k),
    ];

    // +Y top
    this.addQuad(pt(-hx, hy, hz), pt(hx, hy, hz), pt(hx, hy, -hz), pt(-hx, hy, -hz), shade(1.08));
    // -Y bottom
    this.addQuad(pt(-hx, -hy, -hz), pt(hx, -hy, -hz), pt(hx, -hy, hz), pt(-hx, -hy, hz), shade(0.75));
    // +Z front
    this.addQuad(pt(-hx, -hy, hz), pt(hx, -hy, hz), pt(hx, hy, hz), pt(-hx, hy, hz), shade(0.98));
    // -Z back
    this.addQuad(pt(hx, -hy, -hz), pt(-hx, -hy, -hz), pt(-hx, hy, -hz), pt(hx, hy, -hz), shade(0.88));
    // +X right
    this.addQuad(pt(hx, -hy, hz), pt(hx, -hy, -hz), pt(hx, hy, -hz), pt(hx, hy, hz), shade(0.94));
    // -X left
    this.addQuad(pt(-hx, -hy, -hz), pt(-hx, -hy, hz), pt(-hx, hy, hz), pt(-hx, hy, -hz), shade(0.86));
  }

  public addCylinder(
    cx: number,
    baseY: number,
    cz: number,
    rBottom: number,
    rTop: number,
    height: number,
    segs: number,
    c: Rgb,
  ): void {
    const topY = baseY + height;
    const ringBot: number[] = [];
    const ringTop: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ringBot.push(
        this.addVertex(cx + ca * rBottom, baseY, cz + sa * rBottom, ca, 0.12, sa, c[0] * 0.9, c[1] * 0.9, c[2] * 0.9),
      );
      ringTop.push(
        this.addVertex(cx + ca * rTop, topY, cz + sa * rTop, ca, 0.12, sa, c[0] * 1.04, c[1] * 1.04, c[2] * 1.04),
      );
    }
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      this.addTri(ringBot[i], ringBot[j], ringTop[j]);
      this.addTri(ringBot[i], ringTop[j], ringTop[i]);
    }
    if (rTop > 0.04) {
      const capCenter = this.addVertex(cx, topY, cz, 0, 1, 0, c[0] * 1.08, c[1] * 1.08, c[2] * 1.08);
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        this.addTri(capCenter, ringTop[j], ringTop[i]);
      }
    }
  }
}

interface BiomeVisualPalette {
  groundLow: Rgb;
  groundMid: Rgb;
  groundHigh: Rgb;
  rock: Rgb;
  road: Rgb;
  masonry: Rgb;
  masonryAccent: Rgb;
  roof: Rgb;
  trunk: Rgb;
  foliage: Rgb;
}

const BIOME_PALETTES: Record<RealmThemeId, BiomeVisualPalette> = {
  'citadel-highlands': {
    groundLow: [0.16, 0.30, 0.16],
    groundMid: [0.24, 0.40, 0.19],
    groundHigh: [0.40, 0.43, 0.32],
    rock: [0.30, 0.33, 0.38],
    road: [0.56, 0.50, 0.39],
    masonry: [0.42, 0.44, 0.48],
    masonryAccent: [0.84, 0.68, 0.34],
    roof: [0.18, 0.28, 0.38],
    trunk: [0.28, 0.19, 0.12],
    foliage: [0.12, 0.36, 0.15],
  },
  'sunken-aqueducts': {
    groundLow: [0.12, 0.32, 0.18],
    groundMid: [0.18, 0.44, 0.22],
    groundHigh: [0.30, 0.48, 0.26],
    rock: [0.28, 0.38, 0.32],
    road: [0.54, 0.52, 0.42],
    masonry: [0.48, 0.51, 0.44],
    masonryAccent: [0.24, 0.64, 0.42],
    roof: [0.14, 0.38, 0.28],
    trunk: [0.30, 0.20, 0.12],
    foliage: [0.10, 0.46, 0.19],
  },
  'obsidian-crucible': {
    groundLow: [0.11, 0.10, 0.12],
    groundMid: [0.19, 0.16, 0.17],
    groundHigh: [0.30, 0.23, 0.20],
    rock: [0.10, 0.10, 0.13],
    road: [0.34, 0.28, 0.25],
    masonry: [0.15, 0.15, 0.19],
    masonryAccent: [0.96, 0.48, 0.14],
    roof: [0.42, 0.16, 0.12],
    trunk: [0.14, 0.12, 0.13],
    foliage: [0.84, 0.34, 0.12],
  },
  'pelagic-spires': {
    groundLow: [0.64, 0.58, 0.44],
    groundMid: [0.32, 0.48, 0.30],
    groundHigh: [0.62, 0.60, 0.52],
    rock: [0.44, 0.49, 0.52],
    road: [0.68, 0.63, 0.52],
    masonry: [0.76, 0.73, 0.66],
    masonryAccent: [0.16, 0.58, 0.72],
    roof: [0.16, 0.42, 0.58],
    trunk: [0.38, 0.26, 0.16],
    foliage: [0.16, 0.44, 0.26],
  },
  'amber-steppe': {
    groundLow: [0.54, 0.36, 0.20],
    groundMid: [0.68, 0.48, 0.26],
    groundHigh: [0.80, 0.60, 0.34],
    rock: [0.50, 0.30, 0.18],
    road: [0.72, 0.58, 0.38],
    masonry: [0.74, 0.56, 0.34],
    masonryAccent: [0.92, 0.72, 0.24],
    roof: [0.58, 0.28, 0.16],
    trunk: [0.36, 0.22, 0.12],
    foliage: [0.44, 0.50, 0.18],
  },
  'glacial-spire': {
    groundLow: [0.52, 0.66, 0.78],
    groundMid: [0.74, 0.83, 0.91],
    groundHigh: [0.88, 0.93, 0.97],
    rock: [0.34, 0.44, 0.56],
    road: [0.46, 0.56, 0.68],
    masonry: [0.54, 0.65, 0.78],
    masonryAccent: [0.28, 0.78, 0.96],
    roof: [0.18, 0.36, 0.56],
    trunk: [0.24, 0.18, 0.15],
    foliage: [0.14, 0.36, 0.38],
  },
};

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function buildOverworldMesh(spec: FrontiersRealmSpec, mb: MeshBuilder): void {
  const pal = BIOME_PALETTES[spec.theme] ?? BIOME_PALETTES['citadel-highlands'];
  const ecoPlan = synthesizeRealmEcosystem(spec);

  // 1. Continuous 64×64 terrain grid covering [-108..+108] with integrated mountain ranges & riverbanks
  const gridN = 64;
  const span = 216;
  const half = span * 0.5;
  const step = span / gridN;
  const baseIdx = mb.pos.length / 3;
  const waterY = spec.terrainProfile.waterLevel;
  const bankColor: Rgb = mixRgb(pal.road, pal.rock, 0.35);
  const peakSnowColor: Rgb =
    spec.theme === 'obsidian-crucible'
      ? [0.46, 0.32, 0.28]
      : spec.theme === 'amber-steppe'
        ? [0.88, 0.76, 0.54]
        : [0.84, 0.89, 0.94];

  for (let iz = 0; iz <= gridN; iz++) {
    const z = -half + iz * step;
    for (let ix = 0; ix <= gridN; ix++) {
      const x = -half + ix * step;
      const y = realmTerrainHeightAt(spec, x, z);

      // Finite-difference smooth terrain normal
      const eps = 1.0;
      const hL = realmTerrainHeightAt(spec, x - eps, z);
      const hR = realmTerrainHeightAt(spec, x + eps, z);
      const hD = realmTerrainHeightAt(spec, x, z - eps);
      const hU = realmTerrainHeightAt(spec, x, z + eps);
      let nx = hL - hR;
      let ny = 2 * eps;
      let nz = hD - hU;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      // Rich biome elevation stratification: wet shoreline banks -> valley meadows -> rocky foothills -> alpine peaks
      let c = y < 0.8 ? mixRgb(pal.groundLow, pal.groundMid, (y + 2) / 2.8) : mixRgb(pal.groundMid, pal.groundHigh, (y - 0.8) / 4.2);

      // Wet shoreline sand/pebble transition right along waterLevel so water meets land seamlessly
      const distToWater = Math.abs(y - waterY);
      if (y < waterY + 0.85) {
        const wetT = y < waterY ? 0.85 : Math.max(0, 1 - distToWater / 0.85) * 0.65;
        const wetBed = y < waterY ? mixRgb(pal.rock, [0.09, 0.14, 0.17], 0.55) : bankColor;
        c = mixRgb(c, wetBed, wetT);
      }

      // Exposed cliff strata on steeper mountain slopes
      const slope = 1 - ny;
      if (slope > 0.06) {
        c = mixRgb(c, pal.rock, Math.min(1, (slope - 0.06) * 4.4));
      }

      // High alpine mountain ridges & snow/mineral-dusted summits (y > 6.5m)
      if (y > 6.5) {
        const rockBand = Math.min(1, (y - 6.5) / 4.5);
        c = mixRgb(c, pal.rock, rockBand * 0.72);
        if (y > 10.5 && ny > 0.76) {
          const capT = Math.min(1, (y - 10.5) / 5.5);
          c = mixRgb(c, peakSnowColor, capT * 0.78);
        }
      }

      const onNsRoad = Math.abs(x) < 4.0 && y > waterY + 0.3;
      const onEwRoad = Math.abs(z) < 4.0 && Math.abs(x) > 10 && y > waterY + 0.3;
      const onPlaza = ecoPlan.plazaZones.some((pz) => Math.hypot(x - pz.x, z - pz.z) < pz.radius);
      if (onNsRoad || onEwRoad || onPlaza) {
        const distAxis = onNsRoad ? Math.abs(x) : Math.abs(z);
        const roadWeight = onPlaza ? 0.78 : Math.max(0, 1 - distAxis / 4.0) * 0.92;
        c = mixRgb(c, pal.road, roadWeight);
      }

      mb.addVertex(x, y, z, nx, ny, nz, c[0], c[1], c[2]);
    }
  }

  const row = gridN + 1;
  for (let iz = 0; iz < gridN; iz++) {
    for (let ix = 0; ix < gridN; ix++) {
      const a = baseIdx + iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      mb.addTri(a, c, b);
      mb.addTri(b, c, d);
    }
  }

  // 2. Bespoke Ecosystem Crossing Bridge across the gorge
  const tp = spec.terrainProfile;
  if (tp.hasBridge) {
    const bLen = tp.bridgeZMax - tp.bridgeZMin;
    const bMidZ = (tp.bridgeZMin + tp.bridgeZMax) * 0.5;
    if (ecoPlan.layoutId === 'aqueduct-terraces') {
      mb.addBox(0, tp.bridgeDeckY - 0.35, bMidZ, tp.bridgeHalfWidth * 2, 0.7, bLen, pal.trunk);
      for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
        mb.addCylinder(-2.65, tp.bridgeDeckY, z, 0.24, 0.2, 4.3, 7, pal.trunk);
        mb.addCylinder(2.65, tp.bridgeDeckY, z, 0.24, 0.2, 4.3, 7, pal.trunk);
        mb.addBox(0, tp.bridgeDeckY + 4.35, z, 6.0, 0.34, 0.36, pal.trunk);
      }
    } else if (ecoPlan.layoutId === 'caldera-amphitheater') {
      mb.addBox(0, tp.bridgeDeckY - 0.38, bMidZ, tp.bridgeHalfWidth * 2, 0.76, bLen, [0.16, 0.15, 0.17]);
      for (const side of [-1, 1]) {
        mb.addBox(side * 2.65, tp.bridgeDeckY + 0.45, bMidZ, 0.34, 0.88, bLen, [0.19, 0.17, 0.19]);
        for (const z of [-2.8, 5.0, 12.8]) {
          mb.addBox(side * 2.65, tp.bridgeDeckY + 1.1, z, 0.85, 2.1, 0.85, [0.22, 0.18, 0.20]);
          mb.addCylinder(side * 2.65, tp.bridgeDeckY + 2.2, z, 0.45, 0.12, 0.9, 6, [0.98, 0.44, 0.12]);
        }
      }
    } else if (ecoPlan.layoutId === 'archipelago-atolls') {
      mb.addBox(0, tp.bridgeDeckY - 0.32, bMidZ, tp.bridgeHalfWidth * 2, 0.56, bLen, pal.trunk);
      for (const side of [-1, 1]) {
        mb.addBox(side * 2.65, tp.bridgeDeckY + 0.65, bMidZ, 0.18, 0.22, bLen, pal.trunk);
        for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
          mb.addCylinder(side * 2.65, tp.bridgeDeckY - 2.8, z, 0.32, 0.28, 4.4, 8, pal.trunk);
          mb.addBox(side * 2.65, tp.bridgeDeckY + 1.65, z, 0.36, 0.42, 0.36, [0.22, 0.86, 0.84]);
        }
      }
    } else if (ecoPlan.layoutId === 'caravan-ziggurat') {
      mb.addBox(0, tp.bridgeDeckY - 0.4, bMidZ, tp.bridgeHalfWidth * 2, 0.8, bLen, pal.road);
      for (const side of [-1, 1]) {
        mb.addBox(side * 2.65, tp.bridgeDeckY + 0.38, bMidZ, 0.46, 0.78, bLen, pal.masonry);
        for (const z of [-2.8, 5.0, 12.8]) {
          mb.addBox(side * 2.65, tp.bridgeDeckY + 1.4, z, 0.74, 2.7, 0.74, [0.78, 0.58, 0.34]);
          mb.addCylinder(side * 2.65, tp.bridgeDeckY + 2.75, z, 0.52, 0.08, 0.95, 4, [0.96, 0.78, 0.28]);
        }
      }
    } else if (ecoPlan.layoutId === 'aurora-observatory') {
      mb.addBox(0, tp.bridgeDeckY - 0.36, bMidZ, tp.bridgeHalfWidth * 2, 0.72, bLen, [0.58, 0.80, 0.94]);
      for (const side of [-1, 1]) {
        mb.addBox(side * 2.65, tp.bridgeDeckY + 0.46, bMidZ, 0.34, 0.86, bLen, [0.46, 0.74, 0.92]);
        for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
          mb.addCylinder(side * 2.65, tp.bridgeDeckY, z, 0.46, 0.14, 3.2, 6, [0.56, 0.88, 0.98]);
        }
      }
    } else {
      mb.addBox(0, tp.bridgeDeckY - 0.42, bMidZ, tp.bridgeHalfWidth * 2, 0.84, bLen, pal.road);
      mb.addBox(-tp.bridgeHalfWidth + 0.22, tp.bridgeDeckY + 0.42, bMidZ, 0.42, 0.85, bLen, pal.masonry);
      mb.addBox(tp.bridgeHalfWidth - 0.22, tp.bridgeDeckY + 0.42, bMidZ, 0.42, 0.85, bLen, pal.masonry);
      mb.addBox(-tp.bridgeHalfWidth + 0.22, tp.bridgeDeckY + 0.92, bMidZ, 0.54, 0.16, bLen, pal.masonryAccent);
      mb.addBox(tp.bridgeHalfWidth - 0.22, tp.bridgeDeckY + 0.92, bMidZ, 0.54, 0.16, bLen, pal.masonryAccent);
    }
    // Support piers into gorge
    for (const pz of [tp.bridgeZMin + 2.5, bMidZ, tp.bridgeZMax - 2.5]) {
      mb.addBox(-2.1, tp.bridgeDeckY - 3.2, pz, 1.1, 5.6, 1.4, pal.masonry);
      mb.addBox(2.1, tp.bridgeDeckY - 3.2, pz, 1.1, 5.6, 1.4, pal.masonry);
    }
  }

  // Sculpted stone road bollards & beacon plinths along cardinal frontier roads
  for (const rz of [28, 46, 68, -42, -72]) {
    for (const side of [-4.6, 4.6]) {
      const ry = realmTerrainHeightAt(spec, side, rz);
      mb.addBox(side, ry + 0.85, rz, 0.65, 1.9, 0.65, pal.masonry);
      mb.addBox(side, ry + 1.95, rz, 0.45, 0.45, 0.45, pal.masonryAccent);
    }
  }
  for (const rx of [-72, -40, 40, 72]) {
    for (const side of [-4.6, 4.6]) {
      const ry = realmTerrainHeightAt(spec, rx, side);
      mb.addBox(rx, ry + 0.85, side, 0.65, 1.9, 0.65, pal.masonry);
      mb.addBox(rx, ry + 1.95, side, 0.45, 0.45, 0.45, pal.masonryAccent);
    }
  }

  // 3. Bespoke Ecosystem-Synthesized Architecture (aligned 1:1 with verdantCollision.ts — ZERO cloned layouts!)
  const colorForPart = (p: StructurePrimitive): Rgb => {
    if (p.rgb) return p.rgb;
    if (p.material === 'stone') return pal.masonry;
    if (p.material === 'cobble') return pal.road;
    if (p.material === 'timber') return pal.trunk;
    return pal.masonryAccent;
  };

  for (const part of ecoPlan.structures) {
    const baseY = part.useAbsoluteY ? part.yOffset : realmTerrainHeightAt(spec, part.x, part.z) + part.yOffset;
    const col = colorForPart(part);
    if (part.kind === 'box') {
      mb.addBox(part.x, baseY, part.z, part.sx, part.sy, part.sz, col, part.yaw ?? 0);
    } else if (part.kind === 'cylinder') {
      mb.addCylinder(part.x, baseY, part.z, part.sx, part.sz, part.sy, part.segs ?? 8, col);
    } else if (part.kind === 'cone') {
      mb.addCylinder(part.x, baseY, part.z, part.sx, 0.08, part.sy, part.segs ?? 8, col);
    }
  }

  // 4. Bespoke Ecosystem-Synthesized Flora (8 distinct procedural botanical/geological kits!)
  const stampFloraProc = (f: SynthesizedFloraInstance): void => {
    const py = realmTerrainHeightAt(spec, f.x, f.z);
    const s = f.scale;
    const shade = 0.88 + f.variant * 0.24;

    switch (f.kit) {
      case 'weeping-banyan': {
        const th = 3.5 * s;
        mb.addCylinder(f.x, py - 0.4, f.z, 0.68 * s, 0.38 * s, th, 7, pal.trunk);
        mb.addCylinder(f.x, py + th * 0.8, f.z, 3.4 * s, 2.3 * s, 1.5 * s, 8, [0.12 * shade, 0.44 * shade, 0.24 * shade]);
        mb.addCylinder(f.x, py + th * 0.8 + 1.4 * s, f.z, 2.4 * s, 0.3 * s, 1.5 * s, 8, [0.20 * shade, 0.56 * shade, 0.32 * shade]);
        for (let v = 0; v < 4; v++) {
          const a = f.yaw + (v * Math.PI) / 2;
          mb.addCylinder(f.x + Math.cos(a) * 2.3 * s, py + th * 0.2, f.z + Math.sin(a) * 2.3 * s, 0.12 * s, 0.16 * s, th * 0.65, 5, [0.24 * shade, 0.64 * shade, 0.36 * shade]);
        }
        break;
      }
      case 'obsidian-vent-spires': {
        mb.addCylinder(f.x, py - 0.5, f.z, 1.35 * s, 0.38 * s, 5.4 * s, 6, pal.rock);
        mb.addCylinder(f.x + Math.cos(f.yaw) * 1.1 * s, py - 0.3, f.z + Math.sin(f.yaw) * 1.1 * s, 0.85 * s, 0.22 * s, 3.4 * s, 6, pal.masonry);
        mb.addCylinder(f.x - Math.cos(f.yaw) * 0.7 * s, py - 0.1, f.z - Math.sin(f.yaw) * 0.7 * s, 0.58 * s, 0.12 * s, 1.8 * s, 5, pal.masonryAccent);
        break;
      }
      case 'coral-palm-atoll': {
        if (py < waterY + 0.45 || f.variant > 0.65) {
          const cc: Rgb = f.variant > 0.82 ? [0.88, 0.40, 0.46] : [0.22, 0.74, 0.72];
          mb.addCylinder(f.x, py - 0.3, f.z, 0.6 * s, 1.15 * s, 1.8 * s, 7, cc);
        } else {
          const lx = Math.cos(f.yaw) * 0.42 * s;
          const lz = Math.sin(f.yaw) * 0.42 * s;
          mb.addCylinder(f.x, py - 0.3, f.z, 0.36 * s, 0.28 * s, 1.85 * s, 7, pal.trunk);
          mb.addCylinder(f.x + lx * 0.35, py + 1.5 * s, f.z + lz * 0.35, 0.28 * s, 0.22 * s, 1.75 * s, 7, pal.trunk);
          mb.addCylinder(f.x + lx * 0.75, py + 3.15 * s, f.z + lz * 0.75, 0.22 * s, 0.18 * s, 1.6 * s, 7, pal.trunk);
          const topX = f.x + lx * 0.9;
          const topZ = f.z + lz * 0.9;
          for (let fr = 0; fr < 6; fr++) {
            const a = f.yaw + (fr * Math.PI * 2) / 6;
            mb.addBox(topX + Math.cos(a) * 1.05 * s, py + 4.72 * s, topZ + Math.sin(a) * 1.05 * s, 2.0 * s, 0.18 * s, 0.66 * s, pal.foliage, -a);
            mb.addBox(topX + Math.cos(a) * 1.98 * s, py + 4.58 * s, topZ + Math.sin(a) * 1.98 * s, 1.35 * s, 0.15 * s, 0.52 * s, pal.foliage, -a);
          }
        }
        break;
      }
      case 'mesa-hoodoo-juniper': {
        if (f.variant < 0.52) {
          mb.addCylinder(f.x, py - 0.4, f.z, 1.25 * s, 0.62 * s, 3.8 * s, 7, pal.rock);
          mb.addCylinder(f.x, py + 3.3 * s, f.z, 1.85 * s, 1.35 * s, 1.35 * s, 7, pal.masonry);
        } else {
          mb.addCylinder(f.x, py - 0.3, f.z, 0.34 * s, 0.24 * s, 2.5 * s, 6, pal.trunk);
          mb.addCylinder(f.x, py + 2.1 * s, f.z, 2.5 * s, 2.1 * s, 0.85 * s, 7, pal.foliage);
        }
        break;
      }
      case 'frostglass-crystal-pine': {
        if (f.variant > 0.55) {
          mb.addCylinder(f.x, py - 0.4, f.z, 1.05 * s, 0.14 * s, 6.2 * s, 6, pal.masonryAccent);
          mb.addCylinder(f.x + Math.cos(f.yaw) * 0.9 * s, py - 0.2, f.z + Math.sin(f.yaw) * 0.9 * s, 0.62 * s, 0.1 * s, 3.4 * s, 5, pal.masonry);
        } else {
          mb.addCylinder(f.x, py - 0.2, f.z, 0.36 * s, 0.18 * s, 3.0 * s, 6, pal.trunk);
          mb.addCylinder(f.x, py + 2.0 * s, f.z, 2.4 * s, 0.25 * s, 4.4 * s, 7, pal.foliage);
          mb.addCylinder(f.x, py + 4.3 * s, f.z, 1.55 * s, 0.12 * s, 2.9 * s, 7, pal.groundHigh);
        }
        break;
      }
      case 'giant-fungal-canopy': {
        const stH = 4.0 * s;
        mb.addCylinder(f.x, py - 0.3, f.z, 0.58 * s, 0.34 * s, stH, 7, [0.76, 0.74, 0.66]);
        const cap: Rgb = f.variant > 0.5 ? [0.22 * shade, 0.72 * shade, 0.60 * shade] : [0.48 * shade, 0.34 * shade, 0.70 * shade];
        mb.addCylinder(f.x, py + stH - 0.25 * s, f.z, 3.1 * s, 2.2 * s, 1.0 * s, 9, cap);
        mb.addCylinder(f.x, py + stH + 0.7 * s, f.z, 2.3 * s, 0.25 * s, 1.2 * s, 9, cap);
        break;
      }
      case 'petrified-amber-grove': {
        const th = 4.4 * s;
        mb.addCylinder(f.x, py - 0.4, f.z, 0.78 * s, 0.42 * s, th, 7, pal.rock);
        mb.addCylinder(f.x, py + th * 0.45, f.z, 0.7 * s, 0.68 * s, 0.45 * s, 7, pal.masonryAccent);
        mb.addCylinder(f.x, py + th, f.z, 1.4 * s, 0.15 * s, 2.2 * s, 6, pal.masonryAccent);
        break;
      }
      default: {
        mb.addCylinder(f.x, py - 0.2, f.z, 0.38 * s, 0.22 * s, 3.4 * s, 6, pal.trunk);
        mb.addCylinder(f.x, py + 2.5 * s, f.z, 2.5 * s, 0.38 * s, 3.7 * s, 7, pal.foliage);
        mb.addCylinder(f.x, py + 4.6 * s, f.z, 1.7 * s, 0.18 * s, 2.8 * s, 7, mixRgb(pal.foliage, pal.groundHigh, 0.24));
        break;
      }
    }
  };

  for (const f of ecoPlan.floraInstances) {
    stampFloraProc(f);
  }
}

function buildDungeonMesh(spec: FrontiersRealmSpec, mb: MeshBuilder): void {
  const pal = BIOME_PALETTES[spec.theme] ?? BIOME_PALETTES['citadel-highlands'];
  const floorCol: Rgb = mixRgb(pal.road, [0.18, 0.20, 0.24], 0.48);
  const dgPlan = synthesizeDungeonEcosystem(spec);

  // Topology-driven walkable floor slabs matching each bespoke dungeon floorplan
  for (const w of dgPlan.walkableZones) {
    const cx = (w.minX + w.maxX) * 0.5;
    const cz = (w.minZ + w.maxZ) * 0.5;
    const sx = Math.max(0.8, w.maxX - w.minX);
    const sz = Math.max(0.8, w.maxZ - w.minZ);
    const sy = Math.max(0.9, w.elevation + 0.6);
    const col = w.material === 'timber' ? pal.trunk : w.material === 'stone' ? pal.masonry : floorCol;
    mb.addBox(cx, w.elevation - sy * 0.5, cz, sx, sy, sz, col);
  }

  const colorForPart = (p: StructurePrimitive): Rgb => {
    if (p.rgb) return p.rgb;
    if (p.material === 'stone') return mixRgb(pal.masonry, [0.16, 0.18, 0.22], 0.42);
    if (p.material === 'cobble') return pal.road;
    if (p.material === 'timber') return pal.trunk;
    return dgPlan.accentRgb;
  };

  for (const part of dgPlan.structures) {
    const baseY = part.useAbsoluteY ? part.yOffset : realmTerrainHeightAt(spec, part.x, part.z) + part.yOffset;
    const col = colorForPart(part);
    if (part.kind === 'box') {
      mb.addBox(part.x, baseY, part.z, part.sx, part.sy, part.sz, col, part.yaw ?? 0);
    } else if (part.kind === 'cylinder') {
      mb.addCylinder(part.x, baseY, part.z, part.sx, part.sz, part.sy, part.segs ?? 8, col);
    } else if (part.kind === 'cone') {
      mb.addCylinder(part.x, baseY, part.z, part.sx, 0.08, part.sy, part.segs ?? 8, col);
    }
  }
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

/**
 * Pure TypeScript binary Khronos glTF 2.0 (.glb) compiler for synthesized Verdant UniverseCells.
 * Runs identically in Browser and Node.js with zero external I/O and imports directly into
 * `verdant-uorc.wasm` via `verdant_wasm_glb_import_io()`.
 */
export function buildProceduralCellGlb(spec: FrontiersRealmSpec): Uint8Array {
  const mb = new MeshBuilder();
  if (spec.isDungeon) {
    buildDungeonMesh(spec, mb);
  } else {
    buildOverworldMesh(spec, mb);
  }

  const posArr = new Float32Array(mb.pos);
  const normArr = new Float32Array(mb.norm);
  const colArr = new Float32Array(mb.col);
  const idxArr = new Uint32Array(mb.idx);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < posArr.length; i += 3) {
    const x = posArr[i], y = posArr[i + 1], z = posArr[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const posBytes = new Uint8Array(posArr.buffer);
  const normBytes = new Uint8Array(normArr.buffer);
  const colBytes = new Uint8Array(colArr.buffer);
  const idxBytes = new Uint8Array(idxArr.buffer);

  const offPos = 0;
  const offNorm = align4(offPos + posBytes.byteLength);
  const offCol = align4(offNorm + normBytes.byteLength);
  const offIdx = align4(offCol + colBytes.byteLength);
  const binLen = align4(offIdx + idxBytes.byteLength);

  const binBuf = new Uint8Array(binLen);
  binBuf.set(posBytes, offPos);
  binBuf.set(normBytes, offNorm);
  binBuf.set(colBytes, offCol);
  binBuf.set(idxBytes, offIdx);

  const vertCount = posArr.length / 3;
  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'Verdant-Procedural-UniverseCell-Compiler',
    },
    scene: 0,
    scenes: [{ name: spec.name, nodes: [0] }],
    nodes: [{ name: spec.slug, mesh: 0 }],
    materials: [
      {
        name: `${spec.theme}-pbr`,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.08,
          roughnessFactor: 0.86,
        },
        doubleSided: false,
      },
    ],
    meshes: [
      {
        name: `${spec.slug}-mesh`,
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              COLOR_0: 2,
            },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    buffers: [{ byteLength: binLen }],
    bufferViews: [
      { buffer: 0, byteOffset: offPos, byteLength: posBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offNorm, byteLength: normBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offCol, byteLength: colBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offIdx, byteLength: idxBytes.byteLength, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertCount,
        type: 'VEC3',
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: vertCount,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: vertCount,
        type: 'VEC3',
      },
      {
        bufferView: 3,
        componentType: 5125,
        count: idxArr.length,
        type: 'SCALAR',
      },
    ],
  };

  const enc = new TextEncoder();
  const rawJson = enc.encode(JSON.stringify(gltfJson));
  const jsonLen = align4(rawJson.byteLength);
  const jsonChunk = new Uint8Array(jsonLen);
  jsonChunk.fill(0x20); // space padding per glTF 2.0 GLB spec
  jsonChunk.set(rawJson, 0);

  const totalLen = 12 + 8 + jsonLen + 8 + binLen;
  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);

  // GLB Header
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true); // version 2
  dv.setUint32(8, totalLen, true);

  // JSON Chunk
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonChunk, 20);

  // BIN Chunk
  const binOff = 20 + jsonLen;
  dv.setUint32(binOff, binLen, true);
  dv.setUint32(binOff + 4, 0x004e4942, true); // 'BIN\0'
  out.set(binBuf, binOff + 8);

  return out;
}
