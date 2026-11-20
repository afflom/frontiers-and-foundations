import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { kappa } from './prism-id.mjs';
import {
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
  type ImportedCatalogPropPlacement,
  type RealmPrismCustody,
} from './realmModelSchema';
import {
  synthesizeRealmEcosystem,
  type StructurePrimitive,
  type SynthesizedFloraInstance,
} from './verdantEcosystemCatalog';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';

export interface ParsedExternalMesh {
  assetId: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  sourceUri: string;
}

interface MeshBucket {
  name: string;
  materialIndex: number;
  textured: boolean;
  pos: number[];
  norm: number[];
  uv: number[];
  col: number[];
  idx: number[];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMeshBucket(name: string, materialIndex: number, textured = true): MeshBucket {
  return { name, materialIndex, textured, pos: [], norm: [], uv: [], col: [], idx: [] };
}

function pushVertex(
  b: MeshBucket,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
  r = 1,
  g = 1,
  bl = 1,
): number {
  const i = b.pos.length / 3;
  b.pos.push(x, y, z);
  const nl = Math.hypot(nx, ny, nz) || 1;
  b.norm.push(nx / nl, ny / nl, nz / nl);
  if (b.textured) {
    b.uv.push(Math.max(0.02, Math.min(0.98, u)), Math.max(0.02, Math.min(0.98, v)));
  } else {
    b.col.push(r, g, bl);
  }
  return i;
}

function addQuad(
  b: MeshBucket,
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  r = 1,
  g = 1,
  bl = 1,
): void {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const i0 = pushVertex(b, p0[0], p0[1], p0[2], nx, ny, nz, 0.02, 0.02, r, g, bl);
  const i1 = pushVertex(b, p1[0], p1[1], p1[2], nx, ny, nz, 0.98, 0.02, r, g, bl);
  const i2 = pushVertex(b, p2[0], p2[1], p2[2], nx, ny, nz, 0.98, 0.98, r, g, bl);
  const i3 = pushVertex(b, p3[0], p3[1], p3[2], nx, ny, nz, 0.02, 0.98, r, g, bl);
  b.idx.push(i0, i1, i2, i0, i2, i3);
}

function addBox(
  b: MeshBucket,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
  r = 1,
  g = 1,
  bl = 1,
): void {
  const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const xf = (lx: number, ly: number, lz: number) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
  const p000 = xf(-hx, -hy, -hz), p100 = xf(hx, -hy, -hz), p110 = xf(hx, hy, -hz), p010 = xf(-hx, hy, -hz);
  const p001 = xf(-hx, -hy, hz), p101 = xf(hx, -hy, hz), p111 = xf(hx, hy, hz), p011 = xf(-hx, hy, hz);
  addQuad(b, p001, p101, p111, p011, r, g, bl);
  addQuad(b, p100, p000, p010, p110, r, g, bl);
  addQuad(b, p101, p100, p110, p111, r, g, bl);
  addQuad(b, p000, p001, p011, p010, r, g, bl);
  addQuad(b, p011, p111, p110, p010, r, g, bl);
  addQuad(b, p000, p100, p101, p001, r, g, bl);
}

function addTiledBox(
  b: MeshBucket,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  tileSize = 3.0,
  yaw = 0,
  r = 1,
  g = 1,
  bl = 1,
): void {
  const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const xf = (lx: number, ly: number, lz: number) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
  const nx = Math.max(1, Math.min(8, Math.round(sx / tileSize)));
  const ny = Math.max(1, Math.min(6, Math.round(sy / tileSize)));
  const nz = Math.max(1, Math.min(8, Math.round(sz / tileSize)));
  const emitGrid = (uSegs: number, vSegs: number, sampleFn: (u: number, v: number) => number[]) => {
    for (let iv = 0; iv < vSegs; iv++) {
      const v0 = iv / vSegs, v1 = (iv + 1) / vSegs;
      for (let iu = 0; iu < uSegs; iu++) {
        const u0 = iu / uSegs, u1 = (iu + 1) / uSegs;
        addQuad(b, sampleFn(u0, v0), sampleFn(u1, v0), sampleFn(u1, v1), sampleFn(u0, v1), r, g, bl);
      }
    }
  };
  emitGrid(nx, ny, (u, v) => xf(lerp(-hx, hx, u), lerp(-hy, hy, v), hz));
  emitGrid(nx, ny, (u, v) => xf(lerp(hx, -hx, u), lerp(-hy, hy, v), -hz));
  emitGrid(nz, ny, (u, v) => xf(hx, lerp(-hy, hy, v), lerp(hz, -hz, u)));
  emitGrid(nz, ny, (u, v) => xf(-hx, lerp(-hy, hy, v), lerp(-hz, hz, u)));
  emitGrid(nx, nz, (u, v) => xf(lerp(-hx, hx, u), hy, lerp(hz, -hz, v)));
  emitGrid(nx, nz, (u, v) => xf(lerp(-hx, hx, u), -hy, lerp(-hz, hz, v)));
}

function addCylinder(
  b: MeshBucket,
  cx: number,
  y0: number,
  cz: number,
  rBot: number,
  rTop: number,
  height: number,
  segs = 8,
  r = 1,
  g = 1,
  bl = 1,
  capTop = true,
): void {
  const y1 = y0 + height;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = [cx + c0 * rBot, y0, cz + s0 * rBot];
    const b1 = [cx + c1 * rBot, y0, cz + s1 * rBot];
    const t1 = [cx + c1 * rTop, y1, cz + s1 * rTop];
    const t0 = [cx + c0 * rTop, y1, cz + s0 * rTop];
    addQuad(b, b1, b0, t0, t1, r, g, bl);
    if (capTop && rTop > 0.01) {
      const iC = pushVertex(b, cx, y1, cz, 0, 1, 0, 0.5, 0.5, r, g, bl);
      const iA = pushVertex(b, t0[0], t0[1], t0[2], 0, 1, 0, 0.5 + c0 * 0.45, 0.5 + s0 * 0.45, r, g, bl);
      const iB = pushVertex(b, t1[0], t1[1], t1[2], 0, 1, 0, 0.5 + c1 * 0.45, 0.5 + s1 * 0.45, r, g, bl);
      b.idx.push(iC, iB, iA);
    }
  }
}

function addCone(
  b: MeshBucket,
  cx: number,
  y0: number,
  cz: number,
  radius: number,
  height: number,
  segs = 8,
  r = 1,
  g = 1,
  bl = 1,
): void {
  const tipY = y0 + height;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const nx = Math.cos(am) * height, ny = radius, nz = Math.sin(am) * height;
    const i0 = pushVertex(b, cx + c1 * radius, y0, cz + s1 * radius, nx, ny, nz, 0.05, 0.05, r, g, bl);
    const i1 = pushVertex(b, cx + c0 * radius, y0, cz + s0 * radius, nx, ny, nz, 0.95, 0.05, r, g, bl);
    const i2 = pushVertex(b, cx, tipY, cz, nx, ny, nz, 0.5, 0.95, r, g, bl);
    b.idx.push(i0, i1, i2);
  }
}

function terrainNormalAt(spec: FrontiersRealmSpec, x: number, z: number): [number, number, number] {
  const e = 0.5;
  const hL = realmTerrainHeightAt(spec, x - e, z);
  const hR = realmTerrainHeightAt(spec, x + e, z);
  const hD = realmTerrainHeightAt(spec, x, z - e);
  const hU = realmTerrainHeightAt(spec, x, z + e);
  const nx = hL - hR, ny = 2 * e, nz = hD - hU;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

// ---------------------------------------------------------------------------
// 1. Live External Asset Catalog Hydration (Poly Haven PBR, HDRI & 3D glTF!)
// ---------------------------------------------------------------------------
async function fetchCachedBytes(
  url: string,
  localPath: string,
  resizeGeometry: string | null = null,
): Promise<Uint8Array> {
  if (existsSync(localPath)) {
    return new Uint8Array(readFileSync(localPath));
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Catalog stream fetch failed (${resp.status}): ${url}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  writeFileSync(localPath, bytes);
  if (resizeGeometry) {
    try {
      execFileSync('convert', [localPath, '-resize', resizeGeometry, '-quality', '85', localPath], {
        stdio: 'ignore',
      });
      return new Uint8Array(readFileSync(localPath));
    } catch {
      // keep downloaded image if ImageMagick is absent
    }
  }
  return bytes;
}

const parsedModelCache = new Map<string, ParsedExternalMesh | null>();

/**
 * Fetches a real CC0 Poly Haven 1K glTF 2.0 3D model (.gltf + .bin), decodes its
 * binary vertex & index buffers, normalizes height to 1.0m grounded at y=0, and
 * caches the geometry for fast multi-realm instancing & customization!
 */
export async function importExternalPolyHavenModel(
  assetId: string,
  modelCacheDir: string,
): Promise<ParsedExternalMesh | null> {
  if (parsedModelCache.has(assetId)) {
    return parsedModelCache.get(assetId) ?? null;
  }
  mkdirSync(modelCacheDir, { recursive: true });
  const gltfPath = join(modelCacheDir, `${assetId}.gltf`);
  const binPath = join(modelCacheDir, `${assetId}.bin`);
  let sourceUri = `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`;

  try {
    if (!existsSync(gltfPath) || !existsSync(binPath)) {
      const metaResp = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
      if (!metaResp.ok) throw new Error(`Poly Haven metadata failed for ${assetId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (await metaResp.json()) as any;
      const g = meta?.gltf?.['1k']?.gltf;
      if (!g?.url) throw new Error(`No 1k glTF entry for ${assetId}`);
      sourceUri = g.url;
      const includeEntries = Object.entries(g.include || {}) as Array<[string, { url: string }]>;
      const binEntry = includeEntries.find(([k]) => k.endsWith('.bin'));
      if (!binEntry) throw new Error(`No .bin entry for ${assetId}`);
      await Promise.all([
        fetchCachedBytes(g.url, gltfPath),
        fetchCachedBytes(binEntry[1].url, binPath),
      ]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gltf = JSON.parse(readFileSync(gltfPath, 'utf8')) as any;
    const binBuf = readFileSync(binPath);

    const readFloatAccessor = (accIdx: number, compCount: number): Float32Array => {
      const acc = gltf.accessors[accIdx];
      const bv = gltf.bufferViews[acc.bufferView];
      const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const stride = bv.byteStride || compCount * 4;
      const out = new Float32Array(acc.count * compCount);
      const dv = new DataView(binBuf.buffer, binBuf.byteOffset, binBuf.byteLength);
      for (let i = 0; i < acc.count; i++) {
        const base = byteOffset + i * stride;
        for (let c = 0; c < compCount; c++) {
          out[i * compCount + c] = dv.getFloat32(base + c * 4, true);
        }
      }
      return out;
    };

    const readIndexAccessor = (accIdx: number): Uint32Array => {
      const acc = gltf.accessors[accIdx];
      const bv = gltf.bufferViews[acc.bufferView];
      const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const out = new Uint32Array(acc.count);
      const dv = new DataView(binBuf.buffer, binBuf.byteOffset, binBuf.byteLength);
      if (acc.componentType === 5123) {
        for (let i = 0; i < acc.count; i++) out[i] = dv.getUint16(byteOffset + i * 2, true);
      } else if (acc.componentType === 5125) {
        for (let i = 0; i < acc.count; i++) out[i] = dv.getUint32(byteOffset + i * 4, true);
      } else {
        for (let i = 0; i < acc.count; i++) out[i] = dv.getUint8(byteOffset + i);
      }
      return out;
    };

    const allPos: number[] = [];
    const allNorm: number[] = [];
    const allIdx: number[] = [];
    let vertOffset = 0;

    for (const mesh of gltf.meshes || []) {
      for (const prim of mesh.primitives || []) {
        if (prim.attributes?.POSITION === undefined) continue;
        const pos = readFloatAccessor(prim.attributes.POSITION, 3);
        const norm =
          prim.attributes.NORMAL !== undefined
            ? readFloatAccessor(prim.attributes.NORMAL, 3)
            : new Float32Array(pos.length);
        const idx =
          prim.indices !== undefined
            ? readIndexAccessor(prim.indices)
            : Uint32Array.from({ length: pos.length / 3 }, (_, k) => k);

        for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
        for (let i = 0; i < norm.length; i++) allNorm.push(norm[i]);
        for (let i = 0; i < idx.length; i++) allIdx.push(idx[i] + vertOffset);
        vertOffset += pos.length / 3;
      }
    }

    if (allIdx.length < 3) {
      parsedModelCache.set(assetId, null);
      return null;
    }

    // Normalize bounding box: center X/Z at 0, ground bottom at Y=0, scale max Y height to 1.0
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < allPos.length; i += 3) {
      if (allPos[i] < minX) minX = allPos[i];
      if (allPos[i] > maxX) maxX = allPos[i];
      if (allPos[i + 1] < minY) minY = allPos[i + 1];
      if (allPos[i + 1] > maxY) maxY = allPos[i + 1];
      if (allPos[i + 2] < minZ) minZ = allPos[i + 2];
      if (allPos[i + 2] > maxZ) maxZ = allPos[i + 2];
    }
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const height = Math.max(0.001, maxY - minY);
    const invH = 1 / height;

    const normPos = new Float32Array(allPos.length);
    for (let i = 0; i < allPos.length; i += 3) {
      normPos[i] = (allPos[i] - cx) * invH;
      normPos[i + 1] = (allPos[i + 1] - minY) * invH;
      normPos[i + 2] = (allPos[i + 2] - cz) * invH;
    }

    const parsed: ParsedExternalMesh = {
      assetId,
      positions: normPos,
      normals: new Float32Array(allNorm),
      indices: new Uint32Array(allIdx),
      sourceUri,
    };
    parsedModelCache.set(assetId, parsed);
    return parsed;
  } catch {
    parsedModelCache.set(assetId, null);
    return null;
  }
}

const simplifiedCache = new Map<
  string,
  { pos: Float32Array; norm: Float32Array; idx: Uint32Array }
>();

/**
 * Rossignac-Borrel spatial vertex-grid clustering decimation.
 * Welds nearby vertices into a uniform 3D voxel grid while preserving manifold
 * surface connectivity — eliminating gaps/confetti when reducing photogrammetry meshes.
 */
function simplifyByVertexClustering(
  mesh: ParsedExternalMesh,
  targetTris: number,
): { pos: Float32Array; norm: Float32Array; idx: Uint32Array } {
  const key = `${mesh.assetId}:${targetTris}`;
  const cached = simplifiedCache.get(key);
  if (cached) return cached;

  const srcTris = Math.floor(mesh.indices.length / 3);
  if (srcTris <= targetTris) {
    const out = { pos: mesh.positions, norm: mesh.normals, idx: mesh.indices };
    simplifiedCache.set(key, out);
    return out;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  const vCount = mesh.positions.length / 3;
  for (let i = 0; i < vCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const span = Math.max(0.001, maxX - minX, maxY - minY, maxZ - minZ);

  // Pick finest grid resolution that keeps the silhouette solid within ~targetTris
  const gridCandidates = [24, 20, 16, 13, 10, 8];
  let bestResult: { pos: Float32Array; norm: Float32Array; idx: Uint32Array } | null = null;

  for (const grid of gridCandidates) {
    const invCell = grid / span;
    const cellMap = new Map<number, number>();
    const sumX: number[] = [];
    const sumY: number[] = [];
    const sumZ: number[] = [];
    const sumNx: number[] = [];
    const sumNy: number[] = [];
    const sumNz: number[] = [];
    const counts: number[] = [];
    const remap = new Uint32Array(vCount);

    for (let i = 0; i < vCount; i++) {
      const x = mesh.positions[i * 3];
      const y = mesh.positions[i * 3 + 1];
      const z = mesh.positions[i * 3 + 2];
      const gx = Math.min(grid, Math.max(0, Math.floor((x - minX) * invCell)));
      const gy = Math.min(grid, Math.max(0, Math.floor((y - minY) * invCell)));
      const gz = Math.min(grid, Math.max(0, Math.floor((z - minZ) * invCell)));
      const cellKey = gx + gy * 64 + gz * 4096;
      let cid = cellMap.get(cellKey);
      if (cid === undefined) {
        cid = sumX.length;
        cellMap.set(cellKey, cid);
        sumX.push(0);
        sumY.push(0);
        sumZ.push(0);
        sumNx.push(0);
        sumNy.push(0);
        sumNz.push(0);
        counts.push(0);
      }
      remap[i] = cid;
      sumX[cid] += x;
      sumY[cid] += y;
      sumZ[cid] += z;
      sumNx[cid] += mesh.normals[i * 3] || 0;
      sumNy[cid] += mesh.normals[i * 3 + 1] || 0;
      sumNz[cid] += mesh.normals[i * 3 + 2] || 0;
      counts[cid] += 1;
    }

    const outIdx: number[] = [];
    const seen = new Set<string>();
    for (let t = 0; t < srcTris; t++) {
      const a = remap[mesh.indices[t * 3]];
      const b = remap[mesh.indices[t * 3 + 1]];
      const c = remap[mesh.indices[t * 3 + 2]];
      if (a === b || b === c || c === a) continue;
      const triKey = `${a},${b},${c}`;
      if (seen.has(triKey)) continue;
      seen.add(triKey);
      outIdx.push(a, b, c);
    }

    const numClusters = sumX.length;
    const outPos = new Float32Array(numClusters * 3);
    const outNorm = new Float32Array(numClusters * 3);
    for (let i = 0; i < numClusters; i++) {
      const inv = 1 / Math.max(1, counts[i]);
      outPos[i * 3] = sumX[i] * inv;
      outPos[i * 3 + 1] = sumY[i] * inv;
      outPos[i * 3 + 2] = sumZ[i] * inv;
      const nl = Math.hypot(sumNx[i], sumNy[i], sumNz[i]) || 1;
      outNorm[i * 3] = sumNx[i] / nl;
      outNorm[i * 3 + 1] = sumNy[i] / nl;
      outNorm[i * 3 + 2] = sumNz[i] / nl;
    }

    const candidate = { pos: outPos, norm: outNorm, idx: new Uint32Array(outIdx) };
    bestResult = candidate;
    if (outIdx.length / 3 <= targetTris * 1.45 && outIdx.length >= 36) {
      break;
    }
  }

  const finalMesh = bestResult ?? { pos: mesh.positions, norm: mesh.normals, idx: mesh.indices };
  simplifiedCache.set(key, finalMesh);
  return finalMesh;
}

/**
 * Customizes & stamps an imported Poly Haven 3D mesh into the Realm's geometry bucket
 * with height-grounded placement, rotation, weathered directional shading, and
 * watertight Rossignac-Borrel vertex-clustered decimation.
 */
function stampCustomizedCatalogMesh(
  bucket: MeshBucket,
  mesh: ParsedExternalMesh,
  placement: ImportedCatalogPropPlacement,
  groundY: number,
): number {
  const [px, pz] = placement.position;
  const py = groundY + (placement.yOffset ?? 0);
  const sc = placement.targetHeight;
  const c = Math.cos(placement.yaw);
  const s = Math.sin(placement.yaw);
  const [tr, tg, tb] = placement.tintRgb;

  const budget = placement.maxTriangles ?? 420;
  const simp = simplifyByVertexClustering(mesh, budget);
  const vCount = simp.pos.length / 3;
  const baseVert = bucket.pos.length / 3;

  for (let vi = 0; vi < vCount; vi++) {
    const lx = simp.pos[vi * 3] * sc;
    const ly = simp.pos[vi * 3 + 1] * sc;
    const lz = simp.pos[vi * 3 + 2] * sc;

    const wx = px + lx * c + lz * s;
    const wy = py + ly;
    const wz = pz - lx * s + lz * c;

    const lnx = simp.norm[vi * 3] || 0;
    const lny = simp.norm[vi * 3 + 1] || 1;
    const lnz = simp.norm[vi * 3 + 2] || 0;
    const wnx = lnx * c + lnz * s;
    const wny = lny;
    const wnz = -lnx * s + lnz * c;

    // Subtle vertical weathering gradient for artisanal fantasy material polish
    const vertGrad = 0.84 + Math.min(0.24, Math.max(0, simp.pos[vi * 3 + 1] * 0.24));
    pushVertex(
      bucket,
      wx,
      wy,
      wz,
      wnx,
      wny,
      wnz,
      0.5,
      0.5,
      Math.min(1, tr * vertGrad),
      Math.min(1, tg * vertGrad),
      Math.min(1, tb * vertGrad),
    );
  }

  for (let i = 0; i < simp.idx.length; i++) {
    bucket.idx.push(baseVert + simp.idx[i]);
  }
  return Math.floor(simp.idx.length / 3);
}

// ---------------------------------------------------------------------------
// 2. Pack Spec-Compliant glTF 2.0 Binary (.glb)
// ---------------------------------------------------------------------------
function pad4(buf: Uint8Array): Uint8Array {
  const rem = buf.byteLength % 4;
  if (rem === 0) return buf;
  const out = new Uint8Array(buf.byteLength + (4 - rem));
  out.set(buf);
  return out;
}

function packGlbWorld(
  realmName: string,
  buckets: MeshBucket[],
  materialImages: Array<{
    id: string;
    name: string;
    diffBytes: Uint8Array;
    armBytes: Uint8Array;
    norBytes: Uint8Array;
    roughnessFactor: number;
    metallicFactor: number;
  }>,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const bufferViews: Array<Record<string, unknown>> = [];
  const accessors: Array<Record<string, unknown>> = [];
  const images: Array<Record<string, unknown>> = [];
  const textures: Array<Record<string, unknown>> = [];
  const materials: Array<Record<string, unknown>> = [];
  const meshes: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];
  let byteOffset = 0;

  const appendBufferView = (bytes: Uint8Array, target?: number): number => {
    const padded = pad4(bytes);
    const viewIdx = bufferViews.length;
    const view: Record<string, unknown> = { buffer: 0, byteOffset, byteLength: bytes.byteLength };
    if (target !== undefined) view.target = target;
    bufferViews.push(view);
    chunks.push(padded);
    byteOffset += padded.byteLength;
    return viewIdx;
  };

  const addAccessor = (
    typedArray: Float32Array | Uint32Array,
    componentType: number,
    type: 'VEC3' | 'VEC2' | 'SCALAR',
    target: number,
    computeMinMax = false,
  ): number => {
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const bv = appendBufferView(bytes, target);
    const compPerElem = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
    const count = typedArray.length / compPerElem;
    const acc: Record<string, unknown> = { bufferView: bv, componentType, count, type };
    if (computeMinMax && compPerElem === 3) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < typedArray.length; i += 3) {
        if (typedArray[i] < min[0]) min[0] = typedArray[i];
        if (typedArray[i + 1] < min[1]) min[1] = typedArray[i + 1];
        if (typedArray[i + 2] < min[2]) min[2] = typedArray[i + 2];
        if (typedArray[i] > max[0]) max[0] = typedArray[i];
        if (typedArray[i + 1] > max[1]) max[1] = typedArray[i + 1];
        if (typedArray[i + 2] > max[2]) max[2] = typedArray[i + 2];
      }
      acc.min = min;
      acc.max = max;
    }
    const idx = accessors.length;
    accessors.push(acc);
    return idx;
  };

  for (const mat of materialImages) {
    const diffBv = appendBufferView(mat.diffBytes);
    const diffImgIdx = images.length;
    images.push({ bufferView: diffBv, mimeType: 'image/jpeg', name: `${mat.id}_diff` });
    const diffTexIdx = textures.length;
    textures.push({ source: diffImgIdx, sampler: 0 });

    const armBv = appendBufferView(mat.armBytes);
    const armImgIdx = images.length;
    images.push({ bufferView: armBv, mimeType: 'image/jpeg', name: `${mat.id}_arm` });
    const armTexIdx = textures.length;
    textures.push({ source: armImgIdx, sampler: 0 });

    const norBv = appendBufferView(mat.norBytes);
    const norImgIdx = images.length;
    images.push({ bufferView: norBv, mimeType: 'image/jpeg', name: `${mat.id}_nor` });
    const norTexIdx = textures.length;
    textures.push({ source: norImgIdx, sampler: 0 });

    materials.push({
      name: mat.name,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: diffTexIdx },
        metallicFactor: mat.metallicFactor,
        roughnessFactor: mat.roughnessFactor,
        metallicRoughnessTexture: { index: armTexIdx },
      },
      normalTexture: { index: norTexIdx, scale: 1.0 },
    });
  }

  materials.push({
    name: 'FrontiersImportedCatalogSurface',
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0.14,
      roughnessFactor: 0.68,
    },
  });

  for (const b of buckets) {
    if (b.idx.length === 0) continue;
    const posAcc = addAccessor(new Float32Array(b.pos), 5126, 'VEC3', 34962, true);
    const normAcc = addAccessor(new Float32Array(b.norm), 5126, 'VEC3', 34962, false);
    const attributes: Record<string, number> = { POSITION: posAcc, NORMAL: normAcc };
    if (b.textured) {
      attributes.TEXCOORD_0 = addAccessor(new Float32Array(b.uv), 5126, 'VEC2', 34962, false);
    } else {
      attributes.COLOR_0 = addAccessor(new Float32Array(b.col), 5126, 'VEC3', 34962, false);
    }
    const idxAcc = addAccessor(new Uint32Array(b.idx), 5125, 'SCALAR', 34963, false);
    const meshIdx = meshes.length;
    meshes.push({
      name: b.name,
      primitives: [{ attributes, indices: idxAcc, material: b.materialIndex }],
    });
    nodes.push({ name: b.name, mesh: meshIdx });
  }

  const binBuffer = new Uint8Array(byteOffset);
  let cursor = 0;
  for (const c of chunks) {
    binBuffer.set(c, cursor);
    cursor += c.byteLength;
  }

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'Verdant Engine + Prism Automated Model-Centric World Generator (Frontiers & Foundations)',
    },
    scene: 0,
    scenes: [{ name: realmName.replace(/[^A-Za-z0-9]/g, ''), nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    textures,
    images,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }],
  };

  let jsonBytes = new TextEncoder().encode(JSON.stringify(gltfJson));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  if (jsonPad > 0) {
    const paddedJson = new Uint8Array(jsonBytes.byteLength + jsonPad);
    paddedJson.set(jsonBytes);
    paddedJson.fill(0x20, jsonBytes.byteLength);
    jsonBytes = paddedJson;
  }

  const totalLen = 12 + 8 + jsonBytes.byteLength + 8 + binBuffer.byteLength;
  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonBytes, 20);
  const binStart = 20 + jsonBytes.byteLength;
  dv.setUint32(binStart, binBuffer.byteLength, true);
  dv.setUint32(binStart + 4, 0x004e4942, true);
  glb.set(binBuffer, binStart + 8);
  return glb;
}

// ---------------------------------------------------------------------------
// 3. Full Model-Centric Realm Compiler + Real verdant-uorc.wasm Verification
// ---------------------------------------------------------------------------
export async function compileRealmWithVerdant(
  spec: FrontiersRealmSpec,
  options: { rootDir: string; cacheDir?: string; log?: (msg: string) => void },
): Promise<{
  spec: FrontiersRealmSpec;
  custody: RealmPrismCustody;
  glbPath: string;
  vdntPath: string;
  skyPath: string;
  realmJsonPath: string;
}> {
  const log = options.log ?? (() => {});
  const rootDir = options.rootDir;
  const cacheDir = options.cacheDir ?? join(rootDir, '.verdant-cache');
  const texCache = join(cacheDir, 'textures');
  const modelCache = join(cacheDir, 'models');
  const skyCache = join(cacheDir, 'skies');
  const verdantDir = join(rootDir, 'public', 'verdant');
  const realmOutDir = join(verdantDir, 'realms', spec.slug);

  mkdirSync(texCache, { recursive: true });
  mkdirSync(modelCache, { recursive: true });
  mkdirSync(skyCache, { recursive: true });
  mkdirSync(realmOutDir, { recursive: true });

  // 1. Hydrate Poly Haven CC0 photographic HDRI sky dome
  const skyUrlRemote = `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${spec.skyAssetId}.jpg`;
  const skyCachedPath = join(skyCache, `${spec.skyAssetId}.jpg`);
  const skyBytes = await fetchCachedBytes(skyUrlRemote, skyCachedPath, '2048x1024>');
  const skyPath = join(realmOutDir, 'sky.jpg');
  writeFileSync(skyPath, skyBytes);

  // 2. Hydrate 4 Poly Haven CC0 PBR texture sets (Diff + ARM + Normal)
  const matDefs = [
    { id: spec.materials.terrain, name: `${spec.slug}_terrain`, roughnessFactor: 0.92, metallicFactor: 0.04 },
    { id: spec.materials.masonry, name: `${spec.slug}_masonry`, roughnessFactor: 0.86, metallicFactor: 0.08 },
    { id: spec.materials.road, name: `${spec.slug}_road`, roughnessFactor: 0.82, metallicFactor: 0.06 },
    { id: spec.materials.timber, name: `${spec.slug}_timber`, roughnessFactor: 0.78, metallicFactor: 0.05 },
  ];

  const materialImages = [];
  for (const m of matDefs) {
    const base = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${m.id}/${m.id}`;
    const [diffBytes, armBytes, norBytes] = await Promise.all([
      fetchCachedBytes(`${base}_diff_1k.jpg`, join(texCache, `${m.id}_diff.jpg`), '512x512!'),
      fetchCachedBytes(`${base}_arm_1k.jpg`, join(texCache, `${m.id}_arm.jpg`), '512x512!'),
      fetchCachedBytes(`${base}_nor_gl_1k.jpg`, join(texCache, `${m.id}_nor.jpg`), '512x512!'),
    ]);
    materialImages.push({ ...m, diffBytes, armBytes, norBytes });
  }

  // 3. Construct parametric world terrain + theme-specific architectural structures
  const terrainBucket = createMeshBucket(`${spec.slug}_Terrain`, 0, true);
  const stoneBucket = createMeshBucket(`${spec.slug}_Masonry`, 1, true);
  const cobbleBucket = createMeshBucket(`${spec.slug}_Roads`, 2, true);
  const timberBucket = createMeshBucket(`${spec.slug}_Timber`, 3, true);
  const accentBucket = createMeshBucket(`${spec.slug}_ImportedCatalogAndFlora`, 4, false);

  const lanternRgb: [number, number, number] =
    spec.theme === 'obsidian-crucible'
      ? [0.96, 0.44, 0.18]
      : spec.theme === 'sunken-aqueducts'
        ? [0.36, 0.86, 0.64]
        : spec.theme === 'glacial-spire'
          ? [0.54, 0.88, 0.98]
          : spec.theme === 'pelagic-spires'
            ? [0.42, 0.82, 0.92]
            : [0.90, 0.70, 0.32];

  const spireRgb: [number, number, number] =
    spec.theme === 'obsidian-crucible'
      ? [0.20, 0.16, 0.17]
      : spec.theme === 'sunken-aqueducts'
        ? [0.22, 0.38, 0.30]
        : spec.theme === 'pelagic-spires'
          ? [0.24, 0.42, 0.50]
          : spec.theme === 'glacial-spire'
            ? [0.44, 0.64, 0.78]
            : spec.theme === 'amber-steppe'
              ? [0.64, 0.46, 0.28]
              : [0.24, 0.31, 0.38];

  const bannerRgb: [number, number, number] =
    spec.theme === 'sunken-aqueducts'
      ? [0.20, 0.56, 0.42]
      : spec.theme === 'obsidian-crucible'
        ? [0.82, 0.32, 0.14]
        : spec.theme === 'pelagic-spires'
          ? [0.18, 0.46, 0.64]
          : spec.theme === 'glacial-spire'
            ? [0.28, 0.62, 0.82]
            : spec.theme === 'amber-steppe'
              ? [0.80, 0.50, 0.18]
              : [0.68, 0.22, 0.18];

  if (spec.isDungeon) {
    // =========================================================================
    // 3A. DEDICATED MULTI-CHAMBER 3D DUNGEON DELVE ARCHITECTURE BUILDER
    // =========================================================================
    const GRID_N = 56;
    const WORLD_HALF = spec.worldHalfExtent || 46;
    const STEP = (WORLD_HALF * 2) / GRID_N;

    for (let gz = 0; gz < GRID_N; gz++) {
      for (let gx = 0; gx < GRID_N; gx++) {
        const x0 = -WORLD_HALF + gx * STEP;
        const z0 = -WORLD_HALF + gz * STEP;
        const x1 = x0 + STEP;
        const z1 = z0 + STEP;
        const xm = (x0 + x1) * 0.5;
        const zm = (z0 + z1) * 0.5;

        const y00 = realmTerrainHeightAt(spec, x0, z0);
        const y10 = realmTerrainHeightAt(spec, x1, z0);
        const y11 = realmTerrainHeightAt(spec, x1, z1);
        const y01 = realmTerrainHeightAt(spec, x0, z1);
        const n00 = terrainNormalAt(spec, x0, z0);
        const n10 = terrainNormalAt(spec, x1, z0);
        const n11 = terrainNormalAt(spec, x1, z1);
        const n01 = terrainNormalAt(spec, x0, z1);

        const inChasm = zm > 4.2 && zm < 17.8;
        const onHallFloor =
          !inChasm &&
          ((Math.abs(xm) < 12.5 && zm > -37 && zm < 33) ||
            (Math.abs(xm) < 21.0 && zm > -11.5 && zm < 3.5));

        const target = onHallFloor ? cobbleBucket : terrainBucket;
        const i0 = pushVertex(target, x0, y00, z0, n00[0], n00[1], n00[2], 0.02, 0.02);
        const i1 = pushVertex(target, x0, y01, z1, n01[0], n01[1], n01[2], 0.02, 0.98);
        const i2 = pushVertex(target, x1, y11, z1, n11[0], n11[1], n11[2], 0.98, 0.98);
        const i3 = pushVertex(target, x1, y10, z0, n10[0], n10[1], n10[2], 0.98, 0.02);
        target.idx.push(i0, i1, i2, i0, i2, i3);
      }
    }

    // Bespoke 3D Dungeon Architecture (6 Distinct Architectural Styles from Extended Verdant Catalog!)
    const dgPlan = synthesizeDungeonEcosystem(spec);
    const dgBucketFor = (mat: StructurePrimitive['material']): MeshBucket =>
      mat === 'stone'
        ? stoneBucket
        : mat === 'cobble'
          ? cobbleBucket
          : mat === 'timber'
            ? timberBucket
            : accentBucket;

    for (const part of dgPlan.structures) {
      const target = dgBucketFor(part.material);
      const baseY = part.useAbsoluteY ? part.yOffset : realmTerrainHeightAt(spec, part.x, part.z) + part.yOffset;
      const [cr, cg, cb] = part.rgb ?? [1, 1, 1];
      if (part.kind === 'box') {
        if (target.textured) {
          addTiledBox(target, part.x, baseY, part.z, part.sx, part.sy, part.sz, 2.5, part.yaw ?? 0);
        } else {
          addBox(target, part.x, baseY, part.z, part.sx, part.sy, part.sz, part.yaw ?? 0, cr, cg, cb);
        }
      } else if (part.kind === 'cylinder') {
        addCylinder(target, part.x, baseY, part.z, part.sx, part.sz, part.sy, part.segs ?? 8, cr, cg, cb, true);
      } else if (part.kind === 'cone') {
        addCone(target, part.x, baseY, part.z, part.sx, part.sy, part.segs ?? 8, cr, cg, cb);
      }
    }
  } else {
    // =========================================================================
    // 3B. VAST 224m x 224m BESPOKE ECOSYSTEM-SYNTHESIZED FRONTIER REALM BUILDER
    // =========================================================================
    const ecoPlan = synthesizeRealmEcosystem(spec);
    const GRID_N = 96;
    const WORLD_HALF = spec.worldHalfExtent || 112;
    const STEP = (WORLD_HALF * 2) / GRID_N;

    for (let gz = 0; gz < GRID_N; gz++) {
      for (let gx = 0; gx < GRID_N; gx++) {
        const x0 = -WORLD_HALF + gx * STEP;
        const z0 = -WORLD_HALF + gz * STEP;
        const x1 = x0 + STEP;
        const z1 = z0 + STEP;
        const xm = (x0 + x1) * 0.5;
        const zm = (z0 + z1) * 0.5;

        const y00 = realmTerrainHeightAt(spec, x0, z0);
        const y10 = realmTerrainHeightAt(spec, x1, z0);
        const y11 = realmTerrainHeightAt(spec, x1, z1);
        const y01 = realmTerrainHeightAt(spec, x0, z1);
        const n00 = terrainNormalAt(spec, x0, z0);
        const n10 = terrainNormalAt(spec, x1, z0);
        const n11 = terrainNormalAt(spec, x1, z1);
        const n01 = terrainNormalAt(spec, x0, z1);
        const avgY = (y00 + y10 + y11 + y01) * 0.25;
        const avgNy = (n00[1] + n10[1] + n11[1] + n01[1]) * 0.25;

        const onCausewayRoad = Math.abs(xm) < 3.6 && ((zm > 12 && zm < 92) || (zm > -92 && zm < -2.5));
        const onEwFrontierRoad = Math.abs(zm) < 3.4 && Math.abs(xm) > 14 && Math.abs(xm) < 92 && avgY > spec.terrainProfile.waterLevel + 0.35;
        const onEcoPlaza = ecoPlan.plazaZones.some((pz) => Math.hypot(xm - pz.x, zm - pz.z) < pz.radius);
        const onDungeonPath = spec.dungeonEntrances.some(
          (ent) => Math.hypot(xm - ent.position[0], zm - ent.position[1]) < 6.5,
        );
        // Steep mountain cliff strata & high alpine ridges wear natural granite/basalt/snow mineral strata
        // (never castle brick masonry!)
        const isAlpineRock = avgY > 8.6 || (avgY > 3.6 && avgNy < 0.85);
        const onRoadOrPlaza =
          onCausewayRoad ||
          onEwFrontierRoad ||
          onEcoPlaza ||
          onDungeonPath;

        const target = onRoadOrPlaza
          ? cobbleBucket
          : isAlpineRock
            ? accentBucket
            : terrainBucket;

        const alpineRgb = (vy: number, vny: number): [number, number, number] => {
          const snowT = Math.max(0, Math.min(1, (vy - 11.2) / 5.2)) * Math.max(0, Math.min(1, (vny - 0.55) / 0.35));
          const rockBase: [number, number, number] =
            spec.theme === 'obsidian-crucible'
              ? [0.22, 0.20, 0.21]
              : spec.theme === 'amber-steppe'
                ? [0.54, 0.42, 0.30]
                : spec.theme === 'glacial-spire'
                  ? [0.46, 0.54, 0.62]
                  : [0.38, 0.40, 0.43];
          const strataVar = Math.sin(vy * 1.45) * 0.04;
          const sr = spec.theme === 'obsidian-crucible' ? 0.62 : 0.86;
          const sg = spec.theme === 'obsidian-crucible' ? 0.52 : 0.89;
          const sb = spec.theme === 'obsidian-crucible' ? 0.48 : 0.93;
          return [
            rockBase[0] * (1 - snowT) + sr * snowT + strataVar,
            rockBase[1] * (1 - snowT) + sg * snowT + strataVar,
            rockBase[2] * (1 - snowT) + sb * snowT + strataVar,
          ];
        };

        const c0 = target === accentBucket ? alpineRgb(y00, n00[1]) : ([1, 1, 1] as [number, number, number]);
        const c1 = target === accentBucket ? alpineRgb(y01, n01[1]) : ([1, 1, 1] as [number, number, number]);
        const c2 = target === accentBucket ? alpineRgb(y11, n11[1]) : ([1, 1, 1] as [number, number, number]);
        const c3 = target === accentBucket ? alpineRgb(y10, n10[1]) : ([1, 1, 1] as [number, number, number]);

        const i0 = pushVertex(target, x0, y00, z0, n00[0], n00[1], n00[2], 0.02, 0.02, c0[0], c0[1], c0[2]);
        const i1 = pushVertex(target, x0, y01, z1, n01[0], n01[1], n01[2], 0.02, 0.98, c1[0], c1[1], c1[2]);
        const i2 = pushVertex(target, x1, y11, z1, n11[0], n11[1], n11[2], 0.98, 0.98, c2[0], c2[1], c2[2]);
        const i3 = pushVertex(target, x1, y10, z0, n10[0], n10[1], n10[2], 0.98, 0.02, c3[0], c3[1], c3[2]);
        target.idx.push(i0, i1, i2, i0, i2, i3);
      }
    }

    // Bespoke Ecosystem Crossing Architecture (6 distinct foreground bridges — zero cloned spans!)
    const DECK_Y = spec.terrainProfile.bridgeDeckY;
    if (ecoPlan.layoutId === 'aqueduct-terraces') {
      // Oakhaven: Moss-Covered Timber Footbridge with Overhead Living-Vine Pergola Arches
      for (let seg = 0; seg < 8; seg++) {
        const zs = -3.4 + seg * (16.8 / 8);
        const ze = zs + 16.8 / 8;
        addTiledBox(timberBucket, 0, DECK_Y - 0.22, (zs + ze) * 0.5, 5.7, 0.44, ze - zs - 0.04, 2.2);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.68;
        addTiledBox(timberBucket, px, DECK_Y + 0.52, 5.0, 0.28, 0.32, 16.8, 2.2);
        for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
          addCylinder(timberBucket, px, DECK_Y - 0.2, z, 0.24, 0.20, 4.4, 7, 1, 1, 1, true);
          addBox(accentBucket, px, DECK_Y + 3.4, z, 0.32, 0.45, 0.32, 0, 0.22, 0.88, 0.56);
        }
      }
      // Overhead timber pergola cross-beams & hanging emerald moss drapes
      for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
        addTiledBox(timberBucket, 0, DECK_Y + 4.35, z, 6.2, 0.34, 0.36, 2.2);
        addBox(accentBucket, 0, DECK_Y + 4.62, z, 5.8, 0.22, 0.68, 0, 0.16, 0.50, 0.26);
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.32 - baseH;
        addCylinder(stoneBucket, -2.1, baseH, pz, 0.82, 0.68, pierH, 8, 1, 1, 1, true);
        addCylinder(stoneBucket, 2.1, baseH, pz, 0.82, 0.68, pierH, 8, 1, 1, 1, true);
      }
    } else if (ecoPlan.layoutId === 'caldera-amphitheater') {
      // Cinderfall: Forged Obsidian & Iron-Grate Foundry Span with Flaming Crucible Braziers
      for (let seg = 0; seg < 6; seg++) {
        const zs = -3.4 + seg * (16.8 / 6);
        const ze = zs + 16.8 / 6;
        addBox(accentBucket, 0, DECK_Y - 0.24, (zs + ze) * 0.5, 5.8, 0.48, ze - zs + 0.04, 0, 0.16, 0.15, 0.17);
        // Glowing forge-seam trim strips along deck edges
        addBox(accentBucket, -2.52, DECK_Y + 0.04, (zs + ze) * 0.5, 0.16, 0.08, ze - zs - 0.2, 0, 0.96, 0.38, 0.10);
        addBox(accentBucket, 2.52, DECK_Y + 0.04, (zs + ze) * 0.5, 0.16, 0.08, ze - zs - 0.2, 0, 0.96, 0.38, 0.10);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.68;
        addBox(accentBucket, px, DECK_Y + 0.52, 5.0, 0.32, 0.88, 16.8, 0, 0.18, 0.16, 0.18);
        for (const z of [-2.8, 5.0, 12.8]) {
          addBox(accentBucket, px, DECK_Y + 1.1, z, 0.88, 2.2, 0.88, 0, 0.20, 0.18, 0.20);
          addCylinder(accentBucket, px, DECK_Y + 2.2, z, 0.62, 0.78, 0.42, 8, 0.28, 0.20, 0.16);
          addCone(accentBucket, px, DECK_Y + 2.62, z, 0.44, 0.92, 6, 0.98, 0.44, 0.12);
        }
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.35 - baseH;
        addBox(accentBucket, 0, baseH + pierH * 0.5, pz, 6.2, pierH, 1.9, 0, 0.14, 0.13, 0.15);
      }
    } else if (ecoPlan.layoutId === 'archipelago-atolls') {
      // Glasswater: Weathered Driftwood Atoll Pier with Round Mooring Pilings & Turquoise Sea-Beacons
      for (let seg = 0; seg < 12; seg++) {
        const zs = -3.4 + seg * (16.8 / 12);
        const ze = zs + 16.8 / 12;
        addTiledBox(timberBucket, 0, DECK_Y - 0.2, (zs + ze) * 0.5, 5.75, 0.36, ze - zs - 0.08, 2.0);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.68;
        // Twin timber rope rails
        addTiledBox(timberBucket, px, DECK_Y + 0.45, 5.0, 0.16, 0.14, 16.8, 2.0);
        addTiledBox(timberBucket, px, DECK_Y + 0.85, 5.0, 0.16, 0.14, 16.8, 2.0);
        for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
          const baseH = realmTerrainHeightAt(spec, px, z) - 1.5;
          const pileH = DECK_Y + 1.45 - baseH;
          addCylinder(timberBucket, px, baseH, z, 0.32, 0.28, pileH, 8, 1, 1, 1, true);
          addBox(accentBucket, px, DECK_Y + 1.65, z, 0.36, 0.42, 0.36, 0, 0.22, 0.86, 0.84);
        }
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.3 - baseH;
        addCylinder(timberBucket, -1.5, baseH, pz, 0.46, 0.40, pierH, 8, 1, 1, 1, true);
        addCylinder(timberBucket, 1.5, baseH, pz, 0.46, 0.40, pierH, 8, 1, 1, 1, true);
      }
    } else if (ecoPlan.layoutId === 'caravan-ziggurat') {
      // Kar-Veth: Stepped Sandstone Sun-Causeway flanked by Ochre Obelisks & Gilded Solar Discs
      for (let seg = 0; seg < 6; seg++) {
        const zs = -3.4 + seg * (16.8 / 6);
        const ze = zs + 16.8 / 6;
        addTiledBox(cobbleBucket, 0, DECK_Y - 0.25, (zs + ze) * 0.5, 5.8, 0.52, ze - zs + 0.05, 2.6);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.68;
        addTiledBox(stoneBucket, px, DECK_Y + 0.38, 5.0, 0.46, 0.78, 16.8, 2.4);
        for (const z of [-2.8, 5.0, 12.8]) {
          addBox(accentBucket, px, DECK_Y + 1.4, z, 0.76, 2.8, 0.76, 0, 0.78, 0.58, 0.34);
          addCone(accentBucket, px, DECK_Y + 2.8, z, 0.54, 0.95, 4, 0.96, 0.78, 0.28);
        }
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.35 - baseH;
        addTiledBox(stoneBucket, 0, baseH + pierH * 0.5, pz, 6.0, pierH, 2.1, 2.6);
      }
    } else if (ecoPlan.layoutId === 'aurora-observatory') {
      // Borealis: Translucent Frostglass Crystal Prism Bridge with Faceted Ice-Shard Pylons
      for (let seg = 0; seg < 6; seg++) {
        const zs = -3.4 + seg * (16.8 / 6);
        const ze = zs + 16.8 / 6;
        addBox(accentBucket, 0, DECK_Y - 0.22, (zs + ze) * 0.5, 5.7, 0.44, ze - zs + 0.04, 0, 0.58, 0.80, 0.94);
        addBox(accentBucket, 0, DECK_Y + 0.02, (zs + ze) * 0.5, 3.8, 0.06, ze - zs - 0.25, 0, 0.74, 0.92, 0.99);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.68;
        addBox(accentBucket, px, DECK_Y + 0.46, 5.0, 0.34, 0.86, 16.8, 0, 0.46, 0.74, 0.92);
        for (const z of [-2.8, 1.2, 5.2, 9.2, 12.8]) {
          addCylinder(accentBucket, px, DECK_Y - 0.1, z, 0.48, 0.22, 2.4, 6, 0.56, 0.84, 0.96);
          addCone(accentBucket, px, DECK_Y + 2.3, z, 0.28, 1.05, 6, 0.44, 0.96, 0.98);
        }
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.35 - baseH;
        addCylinder(accentBucket, -1.9, baseH, pz, 0.95, 0.55, pierH, 6, 0.48, 0.74, 0.90);
        addCylinder(accentBucket, 1.9, baseH, pz, 0.95, 0.55, pierH, 6, 0.48, 0.74, 0.90);
      }
    } else {
      // Vaelmor Citadel: Classic Parabolic Basalt Causeway Bridge
      for (let seg = 0; seg < 6; seg++) {
        const zs = -3.4 + seg * (16.8 / 6);
        const ze = zs + 16.8 / 6;
        addTiledBox(cobbleBucket, 0, DECK_Y - 0.25, (zs + ze) * 0.5, 5.7, 0.5, ze - zs + 0.05, 2.6);
      }
      for (const side of [-1, 1]) {
        const px = side * 2.65;
        addTiledBox(stoneBucket, px, DECK_Y + 0.48, 5.0, 0.42, 0.95, 16.8, 2.4);
        for (let z = -3.0; z <= 13.0; z += 4.0) {
          addBox(stoneBucket, px, DECK_Y + 0.85, z, 0.72, 1.7, 0.72);
          addBox(accentBucket, px, DECK_Y + 1.82, z, 0.36, 0.34, 0.36, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
        }
      }
      for (const pz of [-2.4, 5.2, 12.6]) {
        const baseH = realmTerrainHeightAt(spec, 0, pz) - 1.5;
        const pierH = DECK_Y - 0.35 - baseH;
        addTiledBox(stoneBucket, 0, baseH + pierH * 0.5, pz, 5.9, pierH, 1.85, 2.4);
        addTiledBox(stoneBucket, -3.2, baseH + pierH * 0.35, pz, 0.9, pierH * 0.7, 1.35, 2.2);
        addTiledBox(stoneBucket, 3.2, baseH + pierH * 0.35, pz, 0.9, pierH * 0.7, 1.35, 2.2);
      }
      for (const archCenterZ of [1.4, 8.9]) {
        for (let i = 0; i < 10; i++) {
          const t = -1 + (2 * (i + 0.5)) / 10;
          addTiledBox(stoneBucket, 0, DECK_Y - 0.6 - t * t * 2.25, archCenterZ + t * 3.4, 5.1, 0.65, 0.85, 2.4);
        }
      }
    }

    // Bespoke Ecosystem-Synthesized Architecture (from Extended Verdant Catalog — ZERO cloned layouts!)
    const bucketFor = (mat: StructurePrimitive['material']): MeshBucket =>
      mat === 'stone'
        ? stoneBucket
        : mat === 'cobble'
          ? cobbleBucket
          : mat === 'timber'
            ? timberBucket
            : accentBucket;

    for (const part of ecoPlan.structures) {
      const target = bucketFor(part.material);
      const baseY = part.useAbsoluteY ? part.yOffset : realmTerrainHeightAt(spec, part.x, part.z) + part.yOffset;
      const [cr, cg, cb] = part.rgb ?? [1, 1, 1];
      if (part.kind === 'box') {
        if (target.textured) {
          addTiledBox(target, part.x, baseY, part.z, part.sx, part.sy, part.sz, 2.5, part.yaw ?? 0);
        } else {
          addBox(target, part.x, baseY, part.z, part.sx, part.sy, part.sz, part.yaw ?? 0, cr, cg, cb);
        }
      } else if (part.kind === 'cylinder') {
        addCylinder(target, part.x, baseY, part.z, part.sx, part.sz, part.sy, part.segs ?? 8, cr, cg, cb, true);
      } else if (part.kind === 'cone') {
        addCone(target, part.x, baseY, part.z, part.sx, part.sy, part.segs ?? 8, cr, cg, cb);
      }
    }

    // Bespoke Ecosystem-Synthesized Flora & Botanical/Geological Morphologies (8 Distinct Kits!)
    const stampFlora = (f: SynthesizedFloraInstance): void => {
      const ty = realmTerrainHeightAt(spec, f.x, f.z);
      const s = f.scale;
      const shade = 0.88 + f.variant * 0.24;

      switch (f.kit) {
        case 'weeping-banyan': {
          // Broad moss-draped banyan/willow with flared buttress roots, wide umbrella dome, & hanging vine curtains
          const th = 3.6 * s;
          addCylinder(accentBucket, f.x, ty - 0.5, f.z, 0.72 * s, 0.42 * s, th, 7, 0.28, 0.22, 0.16);
          for (let r = 0; r < 3; r++) {
            const a = f.yaw + (r * Math.PI * 2) / 3;
            addCylinder(accentBucket, f.x + Math.cos(a) * 0.58 * s, ty - 0.4, f.z + Math.sin(a) * 0.58 * s, 0.34 * s, 0.12 * s, 1.8 * s, 5, 0.25, 0.20, 0.14);
          }
          addCylinder(accentBucket, f.x, ty + th * 0.82, f.z, 3.6 * s, 2.5 * s, 1.5 * s, 9, 0.12 * shade, 0.42 * shade, 0.24 * shade);
          addCone(accentBucket, f.x, ty + th * 0.82 + 1.45 * s, f.z, 2.7 * s, 1.55 * s, 9, 0.18 * shade, 0.54 * shade, 0.30 * shade);
          // Hanging bioluminescent moss-vine strands
          for (let v = 0; v < 5; v++) {
            const a = f.yaw + (v * Math.PI * 2) / 5;
            const vx = f.x + Math.cos(a) * 2.55 * s;
            const vz = f.z + Math.sin(a) * 2.55 * s;
            addCylinder(accentBucket, vx, ty + th * 0.22, vz, 0.11 * s, 0.16 * s, th * 0.65, 5, 0.22 * shade, 0.62 * shade, 0.36 * shade);
          }
          break;
        }
        case 'obsidian-vent-spires': {
          // Clustered angled hexagonal obsidian crystals + glowing magma fumarole throat
          addCylinder(accentBucket, f.x, ty - 0.6, f.z, 1.35 * s, 0.45 * s, 5.4 * s, 6, 0.16, 0.14, 0.17);
          addCone(accentBucket, f.x, ty + 4.8 * s, f.z, 0.48 * s, 2.1 * s, 6, 0.24, 0.18, 0.20);
          const ox = Math.cos(f.yaw) * 1.15 * s;
          const oz = Math.sin(f.yaw) * 1.15 * s;
          addCylinder(accentBucket, f.x + ox, ty - 0.4, f.z + oz, 0.82 * s, 0.26 * s, 3.4 * s, 6, 0.20, 0.17, 0.19);
          addCone(accentBucket, f.x - ox * 0.7, ty + 0.1, f.z - oz * 0.7, 0.65 * s, 1.45 * s, 5, 0.96, 0.42, 0.14);
          break;
        }
        case 'coral-palm-atoll': {
          if (ty < spec.terrainProfile.waterLevel + 0.45 || f.variant > 0.65) {
            // Branching rose-gold & turquoise reef-coral polyp formation
            const coralCol: [number, number, number] = f.variant > 0.82 ? [0.88, 0.40, 0.46] : [0.22, 0.74, 0.72];
            addCylinder(accentBucket, f.x, ty - 0.3, f.z, 0.62 * s, 1.15 * s, 1.8 * s, 7, coralCol[0], coralCol[1], coralCol[2]);
            for (let b = 0; b < 4; b++) {
              const a = f.yaw + (b * Math.PI) / 2;
              addCylinder(accentBucket, f.x + Math.cos(a) * 0.85 * s, ty + 0.4 * s, f.z + Math.sin(a) * 0.85 * s, 0.26 * s, 0.48 * s, 1.6 * s, 6, coralCol[0] * 1.08, coralCol[1] * 1.08, coralCol[2] * 1.05);
            }
          } else {
            // Smooth 3-segment gently curved coastal sea-palm with 6 radiating arched sun-fronds
            const leanX = Math.cos(f.yaw) * 0.45 * s;
            const leanZ = Math.sin(f.yaw) * 0.45 * s;
            addCylinder(accentBucket, f.x, ty - 0.4, f.z, 0.38 * s, 0.30 * s, 1.9 * s, 8, 0.42, 0.30, 0.19);
            addCylinder(accentBucket, f.x + leanX * 0.35, ty + 1.45 * s, f.z + leanZ * 0.35, 0.30 * s, 0.24 * s, 1.8 * s, 8, 0.44, 0.31, 0.20);
            addCylinder(accentBucket, f.x + leanX * 0.75, ty + 3.15 * s, f.z + leanZ * 0.75, 0.24 * s, 0.19 * s, 1.65 * s, 8, 0.46, 0.33, 0.21);
            const topX = f.x + leanX * 0.92;
            const topZ = f.z + leanZ * 0.92;
            const topY = ty + 4.75 * s;
            // Coconut cluster crown hub
            addCylinder(accentBucket, topX, topY - 0.32 * s, topZ, 0.32 * s, 0.28 * s, 0.42 * s, 7, 0.34, 0.24, 0.14);
            for (let fr = 0; fr < 6; fr++) {
              const a = f.yaw + (fr * Math.PI * 2) / 6;
              // Inner arched frond leaf + overlapping outer drooping tip leaf
              addBox(accentBucket, topX + Math.cos(a) * 1.05 * s, topY + 0.06 * s, topZ + Math.sin(a) * 1.05 * s, 2.05 * s, 0.18 * s, 0.68 * s, -a, 0.16 * shade, 0.54 * shade, 0.26 * shade);
              addBox(accentBucket, topX + Math.cos(a) * 1.98 * s, topY - 0.08 * s, topZ + Math.sin(a) * 1.98 * s, 1.35 * s, 0.15 * s, 0.54 * s, -a, 0.20 * shade, 0.60 * shade, 0.30 * shade);
            }
          }
          break;
        }
        case 'mesa-hoodoo-juniper': {
          if (f.variant < 0.52) {
            // Wind-eroded banded ochre sandstone mushroom hoodoo
            addCylinder(accentBucket, f.x, ty - 0.5, f.z, 1.25 * s, 0.62 * s, 3.8 * s, 7, 0.66, 0.44, 0.25);
            addCylinder(accentBucket, f.x, ty + 3.3 * s, f.z, 1.85 * s, 1.45 * s, 1.25 * s, 7, 0.78, 0.54, 0.30);
            addCone(accentBucket, f.x, ty + 4.55 * s, f.z, 1.45 * s, 0.75 * s, 7, 0.84, 0.62, 0.36);
          } else {
            // Flat wind-sheared desert iron-juniper & ribbed saguaro succulent
            addCylinder(accentBucket, f.x, ty - 0.4, f.z, 0.34 * s, 0.24 * s, 2.6 * s, 6, 0.38, 0.25, 0.16);
            addCylinder(accentBucket, f.x, ty + 2.2 * s, f.z, 2.6 * s, 2.2 * s, 0.85 * s, 8, 0.44 * shade, 0.52 * shade, 0.20 * shade);
            addCylinder(accentBucket, f.x + 1.2 * s, ty - 0.2, f.z + 0.6 * s, 0.32 * s, 0.26 * s, 2.1 * s, 6, 0.26 * shade, 0.48 * shade, 0.24 * shade);
          }
          break;
        }
        case 'frostglass-crystal-pine': {
          if (f.variant > 0.55) {
            // Translucent faceted polar frostglass crystal shard cluster
            addCylinder(accentBucket, f.x, ty - 0.5, f.z, 1.05 * s, 0.38 * s, 4.8 * s, 6, 0.48, 0.78, 0.94);
            addCone(accentBucket, f.x, ty + 4.3 * s, f.z, 0.42 * s, 2.8 * s, 6, 0.76, 0.95, 1.0);
            const sx = Math.cos(f.yaw) * 0.95 * s;
            const sz = Math.sin(f.yaw) * 0.95 * s;
            addCylinder(accentBucket, f.x + sx, ty - 0.3, f.z + sz, 0.58 * s, 0.2 * s, 2.8 * s, 5, 0.58, 0.84, 0.98);
          } else {
            // Snow-laden boreal rime-spruce
            const trunkH = 3.2 * s;
            addCylinder(accentBucket, f.x, ty - 0.5, f.z, 0.42 * s, 0.2 * s, trunkH, 7, 0.22, 0.20, 0.22);
            addCone(accentBucket, f.x, ty + trunkH * 0.48, f.z, 2.4 * s, 2.7 * s, 8, 0.18, 0.34, 0.38);
            addCone(accentBucket, f.x, ty + trunkH * 0.88, f.z, 1.8 * s, 2.5 * s, 8, 0.56, 0.72, 0.80);
            addCone(accentBucket, f.x, ty + trunkH * 1.24, f.z, 1.15 * s, 2.1 * s, 8, 0.84, 0.91, 0.97);
          }
          break;
        }
        case 'giant-fungal-canopy': {
          // Towering bioluminescent fluted mushroom tree + glowing shelf spores
          const stH = 4.2 * s;
          addCylinder(accentBucket, f.x, ty - 0.4, f.z, 0.62 * s, 0.36 * s, stH, 8, 0.76, 0.74, 0.66);
          const capCol: [number, number, number] = f.variant > 0.5 ? [0.20, 0.68, 0.58] : [0.46, 0.32, 0.68];
          addCylinder(accentBucket, f.x, ty + stH - 0.3 * s, f.z, 3.2 * s, 2.4 * s, 0.95 * s, 10, capCol[0] * shade, capCol[1] * shade, capCol[2] * shade);
          addCone(accentBucket, f.x, ty + stH + 0.65 * s, f.z, 2.5 * s, 1.35 * s, 10, capCol[0] * 1.15, capCol[1] * 1.15, capCol[2] * 1.15);
          // Smaller glowing toadstool buddy
          addCylinder(accentBucket, f.x + 1.5 * s, ty - 0.2, f.z + 0.9 * s, 0.24 * s, 0.18 * s, 1.4 * s, 6, 0.74, 0.72, 0.64);
          addCone(accentBucket, f.x + 1.5 * s, ty + 1.15 * s, f.z + 0.9 * s, 0.95 * s, 0.75 * s, 8, 0.36, 0.92, 0.74);
          break;
        }
        case 'petrified-amber-grove': {
          // Spiral-fluted petrified stone trunk inlaid with luminous amber resin rings
          const th = 4.6 * s;
          addCylinder(accentBucket, f.x, ty - 0.5, f.z, 0.82 * s, 0.44 * s, th, 7, 0.36, 0.32, 0.30);
          addCylinder(accentBucket, f.x, ty + th * 0.45, f.z, 0.72 * s, 0.68 * s, 0.45 * s, 7, 0.94, 0.66, 0.18);
          addCone(accentBucket, f.x, ty + th, f.z, 1.45 * s, 2.2 * s, 6, 0.92, 0.64, 0.20);
          break;
        }
        default: {
          // Highland Amber Ironwood & Alpine Conifers
          const isAmberGrove = f.x > 10 && f.z < 12;
          const trunkH = (isAmberGrove ? 4.2 : 3.1) * s;
          const trunkR = (isAmberGrove ? 0.48 : 0.36) * s;
          addCylinder(accentBucket, f.x, ty - 0.5, f.z, trunkR * 1.5, trunkR * 0.62, trunkH, 7, 0.27, 0.19, 0.13);
          const c1 = isAmberGrove ? [0.74 * shade, 0.42 * shade, 0.14] : [0.15 * shade, 0.32 * shade, 0.19 * shade];
          const c2 = isAmberGrove ? [0.85 * shade, 0.55 * shade, 0.18] : [0.20 * shade, 0.40 * shade, 0.23 * shade];
          const c3 = isAmberGrove ? [0.92 * shade, 0.67 * shade, 0.25] : [0.26 * shade, 0.48 * shade, 0.27 * shade];
          const rBase = (isAmberGrove ? 3.1 : 2.45) * s;
          addCone(accentBucket, f.x, ty + trunkH * 0.54, f.z, rBase, 2.7 * s, 8, c1[0], c1[1], c1[2]);
          addCone(accentBucket, f.x + 0.22 * Math.cos(f.yaw), ty + trunkH * 0.82, f.z + 0.22 * Math.sin(f.yaw), rBase * 0.78, 2.5 * s, 8, c2[0], c2[1], c2[2]);
          addCone(accentBucket, f.x - 0.15 * Math.sin(f.yaw), ty + trunkH * 1.1, f.z + 0.15 * Math.cos(f.yaw), rBase * 0.52, 2.1 * s, 8, c3[0], c3[1], c3[2]);
          break;
        }
      }
    };

    for (const f of ecoPlan.floraInstances) {
      stampFlora(f);
    }
    // Mountain ranges are sculpted directly into the continuous terrain mesh (realmTerrainHeightAt)
    // with zero floating perimeter cone meshes, allowing players to walk around or climb up into them!
  }

  // 4. IMPORT & CUSTOMIZE REAL EXTERNAL POLY HAVEN CC0 3D MODELS INTO THIS REALM!
  const importedAssetIds = new Set<string>();
  const importedSourceMap = new Map<string, string>();
  let importedPropInstances = 0;
  let importedPropTris = 0;

  for (const prop of spec.importedCatalogProps) {
    const parsed = await importExternalPolyHavenModel(prop.assetId, modelCache);
    if (!parsed) continue;
    const groundY = realmTerrainHeightAt(spec, prop.position[0], prop.position[1]);
    const tris = stampCustomizedCatalogMesh(accentBucket, parsed, prop, groundY);
    importedPropInstances += 1;
    importedPropTris += tris;
    importedAssetIds.add(prop.assetId);
    importedSourceMap.set(prop.assetId, parsed.sourceUri);
  }
  log(
    `[verdant-compiler:${spec.slug}] Imported & customized ${importedPropInstances} external CC0 3D models (${importedAssetIds.size} unique Poly Haven assets, ${importedPropTris} tris).`,
  );

  // 5. Pack compiled glTF 2.0 binary (.glb)
  const glb = packGlbWorld(
    spec.name,
    [terrainBucket, stoneBucket, cobbleBucket, timberBucket, accentBucket],
    materialImages,
  );
  const glbPath = join(realmOutDir, 'world.glb');
  writeFileSync(glbPath, glb);

  // 6. Boot REAL verdant-uorc.wasm on Blank Stage — Register Streams, Project Models,
  //    Operator Directive, Cognitive Knowledge, GLB Import, VDNT & Stitch 2-of-3 Verification!
  const wasmBytes = readFileSync(join(verdantDir, 'verdant-uorc.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = instance.exports as Record<string, any> & { memory: WebAssembly.Memory };
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stageIo = (bytes: Uint8Array) => {
    const ptr = ex.verdant_wasm_io_resize(bytes.byteLength >>> 0) >>> 0;
    new Uint8Array(ex.memory.buffer, ptr, bytes.byteLength).set(bytes);
  };
  const readAux = (): Uint8Array => {
    const len = ex.verdant_wasm_aux_len() >>> 0;
    const ptr = ex.verdant_wasm_aux_ptr() >>> 0;
    return new Uint8Array(ex.memory.buffer, ptr, len).slice();
  };

  ex.verdant_wasm_init(BigInt(spec.seed));
  ex.verdant_wasm_update_host_envelope_uhd(2048, 0, 8, 8000, 1920, 1080);
  const blankOk = (ex.verdant_wasm_studio_load_blank_stage() >>> 0) > 0;
  if (!blankOk) throw new Error(`Blank stage verification failed for ${spec.slug}`);

  // Register live Poly Haven & Khronos catalog streams in Wasm Observer Holon
  for (const stream of [
    {
      streamId: 'polyhaven-frontiers',
      label: 'Poly Haven CC0 3D Models, PBR & HDRI Stream',
      authority: 'Poly Haven CC0-1.0',
      adapterKind: 'polyhaven',
      endpointUrl: 'https://api.polyhaven.com/assets',
      targetParts: ['stage-environment', 'hero-props', 'surface-materials'],
    },
    {
      streamId: 'khronos-frontiers',
      label: 'Khronos glTF 2.0 Sample Asset Stream',
      authority: 'Khronos Group glTF 2.0',
      adapterKind: 'khronos-index',
      endpointUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/model-index.json',
      targetParts: ['hero-props', 'character-rigs'],
    },
    {
      streamId: 'verdant-ecosystem-catalog',
      label: 'Verdant Extensible Ecosystem & Procedural Synthesis Catalog',
      authority: 'Frontiers and Foundations Procedural Catalog',
      adapterKind: 'verdant-catalog',
      endpointUrl: 'urn:verdant:catalog:ecosystems',
      targetParts: ['stage-environment', 'hero-props', 'character-rigs'],
    },
  ]) {
    stageIo(enc.encode(JSON.stringify(stream)));
    ex.verdant_wasm_register_stream_io();
  }

  // Register versioned Prism Project Models (the Realm + every imported external 3D asset!)
  let projectModelsRegistered = 0;
  const registerPm = (pm: Record<string, unknown>) => {
    stageIo(enc.encode(JSON.stringify(pm)));
    if ((ex.verdant_wasm_import_project_model_io() >>> 0) > 0) projectModelsRegistered += 1;
  };
  registerPm({
    modelId: `frontiers:realm:${spec.slug}`,
    title: spec.name,
    schemaType: '3DModel',
    mediaType: 'model/gltf-binary',
    targetSlot: 'stage-environment',
    sourceStream: 'polyhaven-frontiers',
    sourceUri: `https://frontiers.verdant.stitch/realms/${spec.slug}/world.glb`,
    licenseSpdx: 'CC0-1.0',
    tags: ['frontiers-and-foundations', spec.theme, `cell:${spec.cell.join(',')}`],
    propertiesJson: JSON.stringify({ cell: spec.cell, theme: spec.theme, materials: spec.materials }),
    commitNote: `Automated Verdant Realm synthesis for ${spec.name}`,
  });
  for (const assetId of importedAssetIds) {
    registerPm({
      modelId: `polyhaven:${assetId}`,
      title: `Customized ${assetId} (${spec.name})`,
      schemaType: '3DModel',
      mediaType: 'model/gltf+json',
      targetSlot: 'hero-props',
      sourceStream: 'polyhaven-frontiers',
      sourceUri: importedSourceMap.get(assetId) || `https://polyhaven.com/a/${assetId}`,
      licenseSpdx: 'CC0-1.0',
      tags: ['polyhaven', 'cc0', 'customized-prop', spec.slug],
      propertiesJson: JSON.stringify({ realm: spec.slug, assetId }),
      commitNote: `Imported & customized Poly Haven CC0 model ${assetId} into ${spec.slug}`,
    });
  }

  if (spec.isDungeon) {
    const compiledDg = synthesizeDungeonEcosystem(spec);
    registerPm({
      modelId: `frontiers:dungeon-blueprint:${spec.slug}`,
      title: `${spec.name} — ${compiledDg.styleTitle}`,
      schemaType: 'DungeonBlueprint',
      mediaType: 'application/vnd.verdant.dungeon+json',
      targetSlot: 'stage-environment',
      sourceStream: 'verdant-ecosystem-catalog',
      sourceUri: `urn:frontiers:dungeon-blueprint:${spec.slug}`,
      licenseSpdx: 'CC0-1.0',
      tags: [
        'dungeon-blueprint',
        compiledDg.style,
        compiledDg.faunaKit,
        compiledDg.chasmVisual,
        compiledDg.phenomenon.id,
        spec.slug,
      ],
      propertiesJson: JSON.stringify({
        style: compiledDg.style,
        styleTitle: compiledDg.styleTitle,
        faunaKit: compiledDg.faunaKit,
        chasmVisual: compiledDg.chasmVisual,
        phenomenon: compiledDg.phenomenon.id,
        structureCount: compiledDg.structures.length,
        thermalVentCount: compiledDg.thermalVents.length,
        catalogExtensions: compiledDg.catalogExtensionIds,
      }),
      commitNote: `Synthesized bespoke 3D dungeon "${compiledDg.styleTitle}" for ${spec.name}`,
    });
  } else {
    const compiledEco = synthesizeRealmEcosystem(spec);
    registerPm({
      modelId: `frontiers:ecosystem:${spec.slug}`,
      title: `${spec.name} — ${compiledEco.layoutTitle} (${compiledEco.floraTitle})`,
      schemaType: 'EcosystemBlueprint',
      mediaType: 'application/vnd.verdant.ecosystem+json',
      targetSlot: 'stage-environment',
      sourceStream: 'verdant-ecosystem-catalog',
      sourceUri: `urn:frontiers:ecosystem:${spec.slug}`,
      licenseSpdx: 'CC0-1.0',
      tags: [
        'ecosystem-blueprint',
        compiledEco.layoutId,
        compiledEco.floraKit,
        compiledEco.faunaKit,
        compiledEco.phenomenon.id,
        spec.slug,
      ],
      propertiesJson: JSON.stringify({
        layoutId: compiledEco.layoutId,
        floraKit: compiledEco.floraKit,
        faunaKit: compiledEco.faunaKit,
        phenomenon: compiledEco.phenomenon.id,
        structureCount: compiledEco.structures.length,
        floraCount: compiledEco.floraInstances.length,
        catalogExtensions: compiledEco.catalogExtensionIds,
      }),
      commitNote: `Synthesized bespoke ecosystem "${compiledEco.layoutTitle}" with ${compiledEco.floraTitle} for ${spec.name}`,
    });
  }

  registerPm({
    modelId: `frontiers:score:${spec.slug}`,
    title: spec.soundtrack.title,
    schemaType: 'MusicComposition',
    mediaType: 'application/vnd.verdant.score+json',
    targetSlot: 'spatial-acoustics',
    sourceStream: 'verdant-audio-worklet',
    sourceUri: `urn:frontiers:score:${spec.slug}`,
    licenseSpdx: 'CC0-1.0',
    tags: ['orchestral-score', spec.soundtrack.mode, `${spec.soundtrack.bpm}bpm`, spec.slug],
    propertiesJson: JSON.stringify({
      title: spec.soundtrack.title,
      mode: spec.soundtrack.mode,
      bpm: spec.soundtrack.bpm,
      rootMidi: spec.soundtrack.rootMidi,
      reverbDecaySec: spec.soundtrack.reverbDecaySec,
      foleyProfile: spec.soundtrack.foleyProfile,
    }),
    commitNote: `Composed orchestral score "${spec.soundtrack.title}" for ${spec.name}`,
  });

  // Hydrate all 8 ObserverPartSlots for full cognitive resolution telemetry
  const hydrationDescriptors = [
    ['stage-environment', 'polyhaven-frontiers', `${spec.name} (${spec.isDungeon ? '3D Dungeon Delve' : `${(spec.worldHalfExtent || 112) * 2}m Frontier`})`],
    ['hero-props', 'polyhaven-frontiers', `${importedAssetIds.size} Imported CC0 3D Models`],
    ['surface-materials', 'polyhaven-frontiers', `${Object.values(spec.materials).join(', ')}`],
    ['character-rigs', 'frontiers-runtime', 'Sculpted Waywright & Frontier NPCs'],
    ['spatial-acoustics', 'verdant-audio-worklet', `${spec.soundtrack.title} (${spec.soundtrack.mode}, ${spec.soundtrack.bpm} BPM, Hall Reverb + Modal Worklet)`],
    ['visual-identity', 'frontiers-theme', 'Vaelmor Brass & Basalt Typography'],
    ['cognitive-language', 'verdant-iso24617', `${spec.name} World Lore & Anti-Trope Knowledge`],
    ['runtime-frameworks', 'verdant-uorc-wasm', 'WebGL2 CSM/GGX/ACES + Stitch 2-of-3'],
  ];
  let observerPartsHydrated = 0;
  for (const [slot, stream, title] of hydrationDescriptors) {
    stageIo(enc.encode(`${slot}|${stream}|${title}`));
    if ((ex.verdant_wasm_record_part_hydration_io(3) >>> 0) > 0) observerPartsHydrated += 1;
  }

  // Submit formal Operator Directive through Verdant's S1-S5 Governance Channel
  stageIo(
    enc.encode(
      JSON.stringify({
        viewpoint: 'auto',
        directive: `Synthesize and seal Frontiers & Foundations realm ${spec.name} at cell (${spec.cell.join(',')}) using imported Poly Haven CC0 3D models and PBR textures`,
        citedAuthority: 'AUTH-KHRONOS-GLTF2',
        operatorPrismId: `prism:frontiers-generator:${spec.slug}`,
      }),
    ),
  );
  const opLen = ex.verdant_wasm_operator_prompt_io() >>> 0;
  const opReply = opLen > 0 ? JSON.parse(dec.decode(readAux())) : null;
  const operatorAdmitted = Boolean(opReply?.admitted);

  // Ingest Realm & Region & NPC Lore into Verdant's native ISO 24617-2 Cognitive Knowledge Graph
  let cognitiveKnowledgeIngested = 0;
  const lorePassages = [
    {
      sourceStream: 'frontiers-chronicle',
      sourceUri: `urn:frontiers:realm:${spec.slug}`,
      topic: spec.name,
      passage: `${spec.summary} Sky: ${spec.skyAssetId}. Imported artifacts: ${Array.from(importedAssetIds).join(', ')}.`,
    },
    ...spec.regions.map((r) => ({
      sourceStream: 'frontiers-chronicle',
      sourceUri: `urn:frontiers:realm:${spec.slug}:region:${r.id}`,
      topic: `${r.name} (${spec.name})`,
      passage: `${r.name} — ${r.subtitle}. Ambient acoustic mood: ${r.ambientMood}.`,
    })),
    ...spec.npcs.map((n) => ({
      sourceStream: 'frontiers-characters',
      sourceUri: `urn:frontiers:realm:${spec.slug}:npc:${n.id}`,
      topic: `${n.name} (${n.title})`,
      passage: `${n.greeting} Drive: ${n.cognitiveDrive} Secret: ${n.concealedSecret}`,
    })),
  ];
  for (const doc of lorePassages) {
    stageIo(enc.encode(JSON.stringify(doc)));
    if ((ex.verdant_wasm_ingest_knowledge_io() >>> 0) > 0) cognitiveKnowledgeIngested += 1;
  }

  // Import GLB into verdant-uorc.wasm and emit authenticated .vdnt UORC snapshot
  stageIo(glb);
  const importedTris = ex.verdant_wasm_glb_import_io() >>> 0;
  if (importedTris === 0) throw new Error(`verdant_wasm_glb_import_io failed for ${spec.slug}`);
  const vdntSnapshot = readAux();
  const vdntPath = join(realmOutDir, 'world.vdnt');
  writeFileSync(vdntPath, vdntSnapshot);

  const importedVerts = ex.verdant_wasm_scene_vert_count() >>> 0;
  const atlasTileCount = ex.verdant_wasm_glb_atlas_tile_count() >>> 0;

  // Verify lossless Stitch 2-of-3 Reed-Solomon parity recovery on the .vdnt snapshot
  const shards: Uint8Array[] = [];
  for (let si = 0; si < 3; si++) {
    stageIo(vdntSnapshot);
    const sLen = ex.verdant_wasm_stitch_shard_io(si) >>> 0;
    if (!sLen) throw new Error(`Stitch shard ${si} failed for ${spec.slug}`);
    shards.push(readAux());
  }
  const combined = new Uint8Array(shards[0].byteLength + shards[2].byteLength);
  combined.set(shards[0], 0);
  combined.set(shards[2], shards[0].byteLength);
  stageIo(combined);
  const recLen = ex.verdant_wasm_stitch_recover_io(shards[0].byteLength) >>> 0;
  const recovered = readAux();
  const stitchRecoveryVerified =
    recLen === vdntSnapshot.byteLength && recovered.every((b, idx) => b === vdntSnapshot[idx]);
  if (!stitchRecoveryVerified) {
    throw new Error(`Stitch 2-of-3 parity recovery failed for ${spec.slug}`);
  }

  // Seal with real Prism kappa() content-addressed SHA-256 digests
  const [worldGlbKappa, vdntKappa, skyKappa] = await Promise.all([
    kappa({ realm: spec.slug, file: 'world.glb', bytes: glb.byteLength, tris: importedTris, verts: importedVerts }),
    kappa({ realm: spec.slug, file: 'world.vdnt', bytes: vdntSnapshot.byteLength, shards: shards.map((s) => s.byteLength) }),
    kappa({ realm: spec.slug, skyAssetId: spec.skyAssetId, bytes: skyBytes.byteLength }),
  ]);

  const custody: RealmPrismCustody = {
    worldGlbKappa,
    vdntKappa,
    skyKappa,
    triangles: importedTris,
    vertices: importedVerts,
    glbBytes: glb.byteLength,
    atlasTileCount,
    importedCatalogModelsCount: importedPropInstances,
    importedCatalogAssets: Array.from(importedAssetIds),
    projectModelsRegistered,
    cognitiveKnowledgeIngested,
    operatorAdmitted,
    stitchRecoveryVerified,
    stitchShardSizes: shards.map((s) => s.byteLength),
    observerPartsHydrated,
  };

  const sealedSpec: FrontiersRealmSpec = { ...spec, prismCustody: custody };
  const realmJsonPath = join(realmOutDir, 'realm.json');
  writeFileSync(realmJsonPath, `${JSON.stringify(sealedSpec, null, 2)}\n`);

  log(
    `[verdant-compiler:${spec.slug}] OK: ${importedTris} tris, ${(glb.byteLength / 1024 / 1024).toFixed(2)} MB, ${projectModelsRegistered} PMs, ${cognitiveKnowledgeIngested} lore nodes, Stitch 2-of-3 VERIFIED.`,
  );

  return { spec: sealedSpec, custody, glbPath, vdntPath, skyPath, realmJsonPath };
}
