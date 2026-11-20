import {
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import { createSeededRng } from './verdantCharacterSynthesizer';

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
  const rng = createSeededRng(spec.seed ^ 0x51a9);

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
      if (onNsRoad || onEwRoad) {
        const distAxis = onNsRoad ? Math.abs(x) : Math.abs(z);
        c = mixRgb(c, pal.road, Math.max(0, 1 - distAxis / 4.0) * 0.92);
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

  // 2. Parabolic Causeway Stone Bridge across the gorge + Frontier Road Waymarker Lanterns
  const tp = spec.terrainProfile;
  if (tp.hasBridge) {
    const bLen = tp.bridgeZMax - tp.bridgeZMin;
    const bMidZ = (tp.bridgeZMin + tp.bridgeZMax) * 0.5;
    mb.addBox(0, tp.bridgeDeckY - 0.42, bMidZ, tp.bridgeHalfWidth * 2, 0.84, bLen, pal.road);
    // Low stone parapets + accent coping stones
    mb.addBox(-tp.bridgeHalfWidth + 0.22, tp.bridgeDeckY + 0.42, bMidZ, 0.42, 0.85, bLen, pal.masonry);
    mb.addBox(tp.bridgeHalfWidth - 0.22, tp.bridgeDeckY + 0.42, bMidZ, 0.42, 0.85, bLen, pal.masonry);
    mb.addBox(-tp.bridgeHalfWidth + 0.22, tp.bridgeDeckY + 0.92, bMidZ, 0.54, 0.16, bLen, pal.masonryAccent);
    mb.addBox(tp.bridgeHalfWidth - 0.22, tp.bridgeDeckY + 0.92, bMidZ, 0.54, 0.16, bLen, pal.masonryAccent);
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

  // 3. Northern Citadel / Biome-Differentiated Landmark Keep (aligned with verdantCollision.ts!)
  const keepY = realmTerrainHeightAt(spec, 0, -18);
  // Courtyard plinth
  mb.addBox(0, keepY - 0.15, -18.5, 25.5, 0.7, 15.5, pal.road);
  // Gatehouse flanking towers (leaving open center passage at x=0, z=-13.8)
  mb.addBox(-5.2, keepY + 3.4, -13.8, 3.2, 7.2, 3.0, pal.masonry);
  mb.addBox(5.2, keepY + 3.4, -13.8, 3.2, 7.2, 3.0, pal.masonry);
  mb.addBox(0, keepY + 6.4, -13.8, 12.6, 1.3, 2.4, pal.masonryAccent);
  // Crenellations along gatehouse lintel
  for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
    mb.addBox(cx, keepY + 7.45, -13.8, 1.1, 0.9, 1.4, pal.masonry);
  }

  // Outer bastion wings
  mb.addBox(-11.4, keepY + 4.8, -17.5, 4.6, 10.0, 4.6, pal.masonry);
  mb.addBox(11.4, keepY + 4.8, -17.5, 4.6, 10.0, 4.6, pal.masonry);
  mb.addBox(-11.4, keepY + 9.9, -17.5, 5.2, 0.6, 5.2, pal.masonryAccent);
  mb.addBox(11.4, keepY + 9.9, -17.5, 5.2, 0.6, 5.2, pal.masonryAccent);
  mb.addCylinder(-11.4, keepY + 10.2, -17.5, 2.9, 0.2, 4.2, 8, pal.roof);
  mb.addCylinder(11.4, keepY + 10.2, -17.5, 2.9, 0.2, 4.2, 8, pal.roof);

  if (spec.theme === 'pelagic-spires') {
    // Tall Coastal Lighthouse Spire with beacon gallery
    mb.addCylinder(0, keepY - 0.5, -21.8, 5.6, 3.9, 14.5, 10, pal.masonry);
    mb.addCylinder(0, keepY + 14.0, -21.8, 4.5, 4.5, 1.6, 10, pal.masonryAccent);
    mb.addCylinder(0, keepY + 15.6, -21.8, 3.4, 0.3, 4.8, 10, pal.roof);
  } else if (spec.theme === 'amber-steppe') {
    // Stepped Sandstone Ziggurat with gilded summit altar
    mb.addBox(0, keepY + 2.2, -21.8, 14.0, 4.8, 10.8, pal.masonry);
    mb.addBox(0, keepY + 6.0, -21.8, 10.4, 3.8, 8.0, pal.masonry);
    mb.addBox(0, keepY + 9.4, -21.8, 6.8, 3.2, 5.4, pal.masonryAccent);
    mb.addBox(0, keepY + 11.6, -21.8, 3.4, 1.8, 3.4, pal.roof);
  } else if (spec.theme === 'sunken-aqueducts') {
    // Aqueduct Rotunda & grand flanking colonnade arches
    mb.addCylinder(0, keepY - 0.4, -21.8, 6.5, 6.0, 9.2, 12, pal.masonry);
    mb.addCylinder(0, keepY + 8.8, -21.8, 6.8, 0.6, 4.8, 12, pal.roof);
    for (const ax of [-16, -22, 16, 22]) {
      const ay = realmTerrainHeightAt(spec, ax, -20);
      mb.addBox(ax, ay + 4.0, -20, 2.3, 8.4, 2.3, pal.masonry);
    }
    mb.addBox(-19, keepY + 7.8, -20, 12.6, 1.3, 2.2, pal.masonryAccent);
    mb.addBox(19, keepY + 7.8, -20, 12.6, 1.3, 2.2, pal.masonryAccent);
  } else if (spec.theme === 'glacial-spire') {
    // Faceted Frostglass Crystal Citadel
    mb.addCylinder(0, keepY - 0.4, -21.8, 6.4, 4.6, 12.0, 6, pal.masonry);
    mb.addCylinder(0, keepY + 11.6, -21.8, 4.8, 0.15, 8.2, 6, pal.masonryAccent);
  } else {
    // Octagonal Basalt Citadel / Obsidian Crucible Keep with crown buttresses
    mb.addCylinder(0, keepY - 0.5, -21.8, 6.6, 5.8, 11.6, 8, pal.masonry);
    mb.addCylinder(0, keepY + 11.1, -21.8, 6.5, 6.5, 0.9, 8, pal.masonryAccent);
    mb.addCylinder(0, keepY + 12.0, -21.8, 6.0, 0.4, 5.2, 8, pal.roof);
  }

  // 4. Outer Frontier Landmarks (aligned with verdantCollision.ts)
  // Northern Watchtower (0, -56)
  const nwY = realmTerrainHeightAt(spec, 0, -56);
  mb.addCylinder(0, nwY - 0.4, -56, 4.0, 3.3, 12.0, 8, pal.masonry);
  mb.addCylinder(0, nwY + 11.4, -56, 4.2, 4.2, 0.7, 8, pal.masonryAccent);
  mb.addCylinder(0, nwY + 12.1, -56, 3.8, 0.25, 3.8, 8, pal.roof);

  // Western Forge Pavilion (-26, -8)
  const fgY = realmTerrainHeightAt(spec, -26, -8);
  mb.addBox(-26, fgY + 0.1, -8, 8.6, 0.6, 8.6, pal.road);
  for (const [px, pz] of [[-29, -11], [-23, -11], [-29, -5], [-23, -5]]) {
    mb.addBox(px, fgY + 2.6, pz, 0.9, 5.4, 0.9, pal.masonry);
  }
  mb.addBox(-26, fgY + 5.5, -8, 8.2, 0.9, 8.2, pal.roof);
  mb.addBox(-26, fgY + 6.2, -8, 4.4, 0.6, 4.4, pal.masonryAccent);

  // Western Standing Monolith Ring (-54, -22)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const mx = -54 + Math.cos(a) * 8.4;
    const mz = -22 + Math.sin(a) * 8.4;
    const my = realmTerrainHeightAt(spec, mx, mz);
    mb.addBox(mx, my + 2.8, mz, 1.45, 6.2 + (i % 2) * 1.6, 1.2, i % 2 === 0 ? pal.masonry : pal.masonryAccent, a);
  }

  // Eastern Caravan Pavilion (54, 10)
  const ecY = realmTerrainHeightAt(spec, 54, 10);
  mb.addBox(54, ecY + 0.1, 10, 9.2, 0.5, 8.4, pal.road);
  for (const [px, pz] of [[50.5, 6.8], [57.5, 6.8], [50.5, 13.2], [57.5, 13.2]]) {
    mb.addBox(px, ecY + 2.3, pz, 0.75, 5.0, 0.75, pal.trunk);
  }
  mb.addBox(54, ecY + 5.0, 10, 8.8, 0.8, 8.0, pal.masonryAccent);

  // Dungeon Portal Arch (-14, -34)
  const dgY = realmTerrainHeightAt(spec, -14, -34);
  mb.addBox(-16.2, dgY + 2.7, -34, 1.5, 5.8, 1.7, pal.masonry);
  mb.addBox(-11.8, dgY + 2.7, -34, 1.5, 5.8, 1.7, pal.masonry);
  mb.addBox(-14, dgY + 5.8, -34, 6.6, 1.3, 2.0, pal.masonryAccent);

  // 5. Biome Flora, Spires, Rock Clusters & Landmarks scattered cleanly away from roads and plazas
  const propCount = 68;
  for (let i = 0; i < propCount; i++) {
    const px = (rng() - 0.5) * 172;
    const pz = (rng() - 0.5) * 172;
    // Keep cardinal roads, bridge, spawn plaza, keep, and landmarks unobstructed
    if (Math.abs(px) < 7.5 || Math.abs(pz) < 7.5) continue;
    if (Math.hypot(px, pz - 20) < 12) continue;
    if (Math.hypot(px, pz + 18) < 19) continue;
    if (Math.hypot(px + 26, pz + 8) < 10) continue;
    if (Math.hypot(px + 54, pz + 22) < 12) continue;
    if (Math.hypot(px - 54, pz - 10) < 11) continue;
    if (Math.hypot(px + 14, pz + 34) < 8) continue;

    const py = realmTerrainHeightAt(spec, px, pz);
    if (py < tp.waterLevel + 0.35) continue;
    // Skip steep mountain cliff faces so trees & spires never float on sheer rock
    const pSlope = Math.hypot(
      (realmTerrainHeightAt(spec, px + 1, pz) - realmTerrainHeightAt(spec, px - 1, pz)) * 0.5,
      (realmTerrainHeightAt(spec, px, pz + 1) - realmTerrainHeightAt(spec, px, pz - 1)) * 0.5,
    );
    if (pSlope > 0.48) continue;

    const scale = 0.85 + rng() * 1.05;
    if (spec.theme === 'obsidian-crucible') {
      // Dramatic clustered volcanic basalt spires with glowing magma veins & obsidian outcrops
      mb.addCylinder(px, py - 0.4, pz, 1.55 * scale, 0.55 * scale, 5.8 * scale, 6, pal.rock);
      mb.addCylinder(px + 1.2 * scale, py - 0.3, pz + 0.8 * scale, 0.95 * scale, 0.35 * scale, 3.4 * scale, 6, pal.masonry);
      if (rng() > 0.35) {
        mb.addCylinder(px - 0.8 * scale, py - 0.2, pz - 0.6 * scale, 0.55 * scale, 0.18 * scale, 2.2 * scale, 5, pal.masonryAccent);
      }
    } else if (spec.theme === 'amber-steppe') {
      // Sculpted layered sandstone hoodoo mesa & desert scrub
      mb.addCylinder(px, py - 0.4, pz, 1.4 * scale, 0.7 * scale, 4.6 * scale, 6, pal.rock);
      mb.addCylinder(px, py + 4.0 * scale, pz, 2.0 * scale, 1.3 * scale, 1.4 * scale, 6, pal.masonry);
      if (rng() > 0.5) {
        mb.addCylinder(px + 1.6 * scale, py - 0.2, pz + 1.1 * scale, 0.9 * scale, 0.4 * scale, 1.8 * scale, 6, pal.foliage);
      }
    } else if (spec.theme === 'glacial-spire') {
      // Faceted cyan crystal shard cluster + snow-laden alpine spruce
      if (rng() > 0.42) {
        mb.addCylinder(px, py - 0.2, pz, 0.36 * scale, 0.18 * scale, 3.0 * scale, 6, pal.trunk);
        mb.addCylinder(px, py + 2.0 * scale, pz, 2.5 * scale, 0.25 * scale, 4.6 * scale, 7, pal.foliage);
        mb.addCylinder(px, py + 4.4 * scale, pz, 1.6 * scale, 0.12 * scale, 3.0 * scale, 7, pal.groundHigh);
      } else {
        mb.addCylinder(px, py - 0.3, pz, 1.25 * scale, 0.14 * scale, 6.2 * scale, 5, pal.masonryAccent);
        mb.addCylinder(px + 0.9 * scale, py - 0.2, pz - 0.6 * scale, 0.75 * scale, 0.1 * scale, 3.6 * scale, 5, pal.masonry);
      }
    } else {
      // Sculpted multi-tiered highland/aqueduct/coastal trees & moss-draped boulders
      if (rng() > 0.26) {
        mb.addCylinder(px, py - 0.2, pz, 0.38 * scale, 0.22 * scale, 3.4 * scale, 6, pal.trunk);
        mb.addCylinder(px, py + 2.5 * scale, pz, 2.6 * scale, 0.4 * scale, 3.8 * scale, 7, pal.foliage);
        mb.addCylinder(px, py + 4.7 * scale, pz, 1.75 * scale, 0.2 * scale, 2.9 * scale, 7, mixRgb(pal.foliage, pal.groundHigh, 0.24));
      } else {
        mb.addCylinder(px, py - 0.3, pz, 1.8 * scale, 1.0 * scale, 2.1 * scale, 6, pal.rock);
        mb.addCylinder(px + 1.1 * scale, py - 0.3, pz + 0.8 * scale, 1.0 * scale, 0.55 * scale, 1.2 * scale, 6, pal.masonry);
      }
    }
  }
}

function buildDungeonMesh(spec: FrontiersRealmSpec, mb: MeshBuilder): void {
  const pal = BIOME_PALETTES[spec.theme] ?? BIOME_PALETTES['citadel-highlands'];
  const wallCol: Rgb = mixRgb(pal.masonry, [0.16, 0.18, 0.22], 0.55);
  const floorCol: Rgb = mixRgb(pal.road, [0.18, 0.20, 0.24], 0.52);

  // Entry vestibule floor (z: 18..34)
  mb.addBox(0, 0.5, 26, 22, 1.0, 16, floorCol);
  // Central chasm bridge (z: 3.6..18.4)
  mb.addBox(0, 0.65, 11, 5.8, 0.8, 15.2, pal.road);
  // Central rotunda floor (z: -14..4)
  mb.addBox(0, 0.5, -5, 42, 1.0, 18, floorCol);
  // Boss sanctum stepped amphitheater (z: -38..-14)
  mb.addBox(0, 1.0, -26, 22, 2.0, 24, floorCol);

  // Perimeter stone walls
  mb.addBox(-11, 5.5, 26, 2.0, 11, 16, wallCol);
  mb.addBox(11, 5.5, 26, 2.0, 11, 16, wallCol);
  mb.addBox(0, 5.5, 34, 24, 11, 2.0, wallCol);
  mb.addBox(-21, 5.5, -5, 2.0, 11, 20, wallCol);
  mb.addBox(21, 5.5, -5, 2.0, 11, 20, wallCol);
  mb.addBox(-11, 6.0, -26, 2.0, 12, 24, wallCol);
  mb.addBox(11, 6.0, -26, 2.0, 12, 24, wallCol);
  mb.addBox(0, 6.0, -38, 24, 12, 2.0, wallCol);

  // Vaulted columns inside rotunda & sanctum
  for (const [cx, cz] of [[-8, -10], [8, -10], [-8, 1], [8, 1], [-7, -22], [7, -22], [-7, -31], [7, -31]]) {
    mb.addCylinder(cx, 1.0, cz, 1.15, 0.95, 9.6, 8, pal.masonry);
    mb.addBox(cx, 10.6, cz, 2.6, 0.8, 2.6, pal.masonryAccent);
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
