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

    // Abyss Chasm Flagstone Bridge (z: 3.6 .. 18.4)
    const DECK_Y = spec.terrainProfile.bridgeDeckY;
    for (let seg = 0; seg < 6; seg++) {
      const zs = 3.6 + seg * (14.8 / 6);
      const ze = zs + 14.8 / 6;
      addTiledBox(cobbleBucket, 0, DECK_Y - 0.25, (zs + ze) * 0.5, 5.4, 0.52, ze - zs + 0.05, 2.4);
    }
    for (const side of [-1, 1]) {
      const px = side * 2.55;
      addTiledBox(stoneBucket, px, DECK_Y + 0.42, 11.0, 0.38, 0.85, 14.8, 2.4);
      for (const bz of [4.2, 8.8, 13.4, 17.8]) {
        addBox(stoneBucket, px, DECK_Y + 0.88, bz, 0.68, 1.75, 0.68);
        addBox(accentBucket, px, DECK_Y + 1.9, bz, 0.36, 0.38, 0.36, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      }
    }
    for (const pz of [5.2, 11.0, 16.8]) {
      addTiledBox(stoneBucket, 0, -2.1, pz, 5.6, 6.2, 1.6, 2.4);
    }

    // Massive Subterranean Perimeter Walls & Buttresses
    // South Entry Wall (z = 34.5) and North Boss Sanctum Wall (z = -38.5)
    addTiledBox(stoneBucket, 0, 7.5, 34.5, 46.0, 17.0, 3.2, 3.2);
    addTiledBox(stoneBucket, 0, 8.2, -38.5, 46.0, 18.5, 3.4, 3.2);

    // Outer West & East Hall Enclosures (x = ±22.5)
    addTiledBox(stoneBucket, -22.5, 7.8, -2.0, 3.2, 17.5, 76.0, 3.2);
    addTiledBox(stoneBucket, 22.5, 7.8, -2.0, 3.2, 17.5, 76.0, 3.2);

    // Vestibule Narrowing Curtain Walls (x = ±12.5, z: 18..34) & Boss Wing Walls (z: -38..-13)
    for (const side of [-1, 1]) {
      addTiledBox(stoneBucket, side * 15.5, 7.0, 26.0, 11.0, 15.5, 16.0, 3.0);
      addTiledBox(stoneBucket, side * 16.5, 7.5, -25.5, 9.0, 16.5, 25.0, 3.0);
      // Carved Alcove Archways framing East & West Treasure Alcoves (x = ±12.5, z = -4)
      addTiledBox(stoneBucket, side * 12.2, 4.8, -9.2, 2.2, 9.6, 2.2, 2.4);
      addTiledBox(stoneBucket, side * 12.2, 4.8, 1.2, 2.2, 9.6, 2.2, 2.4);
      addTiledBox(stoneBucket, side * 12.2, 9.8, -4.0, 2.4, 2.2, 12.6, 2.4);
      // Alcove Timber Ribbing & Relic Pedestal
      addTiledBox(timberBucket, side * 16.8, 8.2, -4.0, 8.5, 0.5, 10.0, 2.6);
      addTiledBox(stoneBucket, side * 16.5, 1.35, -4.0, 3.2, 0.7, 3.2, 2.0);
    }

    // Towering Octagonal Fluted Columns + High Vaulted Transverse Stone Ribs (z = 26, 18, 3, -4, -12, -20, -28)
    const ribZs = [26, 18.5, 3.2, -4.0, -12.0, -20.0, -28.0];
    for (const rz of ribZs) {
      const floorY = realmTerrainHeightAt(spec, 0, rz);
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        const cx = side * colX;
        addBox(stoneBucket, cx, floorY + 0.55, rz, 2.1, 1.1, 2.1);
        addCylinder(stoneBucket, cx, floorY + 1.1, rz, 0.88, 0.78, 12.2, 8, 1, 1, 1, true);
        addBox(stoneBucket, cx, floorY + 13.5, rz, 2.2, 1.0, 2.2);
        // Hanging Guild/Vault Banners on inner columns
        addBox(accentBucket, cx - side * 0.95, floorY + 6.2, rz, 0.14, 3.8, 1.25, 0, bannerRgb[0], bannerRgb[1], bannerRgb[2]);
        addBox(accentBucket, cx - side * 0.92, floorY + 8.15, rz, 0.24, 0.24, 1.65, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      }
      // High vaulted transverse stone arch beam (y = 14.5..16.2m so camera never clips!)
      addTiledBox(stoneBucket, 0, floorY + 14.8, rz, colX * 2 + 2.6, 1.6, 1.45, 2.6);
      addBox(accentBucket, 0, floorY + 13.8, rz, 1.4, 0.7, 1.6, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // Stepped Boss Sanctum Amphitheater Dais (z = -26) & Semi-Circular Monolith Crown
    const bossY = realmTerrainHeightAt(spec, 0, -26);
    addCylinder(stoneBucket, 0, bossY - 0.5, -26.0, 9.6, 9.2, 0.85, 12);
    addCylinder(cobbleBucket, 0, bossY + 0.35, -26.0, 7.6, 7.4, 0.22, 12);
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 9.8;
      const mz = -26.0 + Math.sin(ang) * 8.4;
      addCylinder(stoneBucket, mx, bossY, mz, 0.95, 0.72, 7.8, 8, 1, 1, 1, true);
      addCone(accentBucket, mx, bossY + 7.8, mz, 0.82, 1.6, 6, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // Sculpted Ascend Portal Stone Arches at Entry (z = 30.8) & Boss Sanctum (z = -33.8)
    for (const [pz, py] of [[30.8, 1.0], [-33.8, realmTerrainHeightAt(spec, 0, -33.8)]] as Array<[number, number]>) {
      addTiledBox(stoneBucket, -2.5, py + 2.8, pz, 1.35, 5.6, 1.55, 2.2);
      addTiledBox(stoneBucket, 2.5, py + 2.8, pz, 1.35, 5.6, 1.55, 2.2);
      addTiledBox(stoneBucket, 0, py + 5.9, pz, 6.8, 1.3, 1.8, 2.2);
      addCone(accentBucket, 0, py + 6.55, pz, 0.75, 1.3, 4, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // Crystalline / Geothermal / Cistern accent formations along the chasm walls
    const randD = mulberry32(spec.seed + 55);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fx = side * (6.2 + randD() * 11.0);
      const fz = 5.5 + randD() * 10.5;
      const fy = realmTerrainHeightAt(spec, fx, fz) - 0.5;
      const fh = 3.2 + randD() * 4.5;
      addCylinder(accentBucket, fx, fy, fz, 0.75, 0.25, fh, 6, spireRgb[0], spireRgb[1], spireRgb[2]);
      addCone(accentBucket, fx, fy + fh, fz, 0.3, 1.1, 6, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }
  } else {
    // =========================================================================
    // 3B. VAST 224m x 224m OPEN-WORLD FRONTIER REALM BUILDER
    // =========================================================================
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
        const onCitadelPlaza = Math.hypot(xm, zm + 16) < 11.0;
        const onSouthPlaza = Math.hypot(xm, zm - 17) < 7.2;
        const onWestRoad = Math.abs(zm + 5.5 + Math.sin(xm * 0.1) * 3.0) < 2.4 && xm < -2 && xm > -56;
        const onEastRoad = Math.abs(zm - 2.0 + Math.sin(xm * 0.09) * 3.4) < 2.3 && xm > 2 && xm < 56;
        const onCoastRoad = Math.abs((xm - 12) - (zm - 12) * 0.9) < 2.4 && xm > 3 && xm < 28 && zm > 12 && zm < 28;
        const onDungeonPath = spec.dungeonEntrances.some(
          (ent) => Math.hypot(xm - ent.position[0], zm - ent.position[1]) < 6.5,
        );
        const onWestCircle = Math.hypot(xm + 54, zm + 22) < 9.5;
        const onEastCamp = Math.hypot(xm - 54, zm - 10) < 8.5;
        const onNorthWatch = Math.hypot(xm, zm + 56) < 8.5;
        // Steep mountain cliff strata & high alpine ridges wear natural granite/basalt/snow mineral strata
        // (never castle brick masonry!)
        const isAlpineRock = avgY > 8.6 || (avgY > 3.6 && avgNy < 0.85);
        const onRoadOrPlaza =
          onCausewayRoad ||
          onEwFrontierRoad ||
          onCitadelPlaza ||
          onSouthPlaza ||
          onWestRoad ||
          onEastRoad ||
          onCoastRoad ||
          onDungeonPath ||
          onWestCircle ||
          onEastCamp ||
          onNorthWatch;

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

    // Parabolic Causeway Bridge
    const DECK_Y = spec.terrainProfile.bridgeDeckY;
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

    // Theme-Driven Northern Monumental Landmark
    const citBaseY = realmTerrainHeightAt(spec, 0, -18);
    addTiledBox(stoneBucket, 0, citBaseY + 0.5, -18.5, 19.5, 2.6, 15.0, 3.0);
    for (let s = 0; s < 4; s++) {
      addTiledBox(cobbleBucket, 0, citBaseY - 0.55 + s * 0.36, -10.5 - s * 0.9, 7.6 - s * 0.4, 0.42, 1.05, 2.4);
    }

    if (spec.theme === 'pelagic-spires') {
      addCylinder(stoneBucket, 0, citBaseY + 1.5, -20.0, 4.8, 4.2, 5.5, 10, 1, 1, 1, false);
      addCylinder(stoneBucket, 0, citBaseY + 7.0, -20.0, 4.2, 3.6, 5.5, 10, 1, 1, 1, false);
      addCylinder(stoneBucket, 0, citBaseY + 12.5, -20.0, 3.6, 3.2, 5.2, 10, 1, 1, 1, true);
      addCylinder(accentBucket, 0, citBaseY + 17.7, -20.0, 2.7, 2.7, 2.4, 10, 0.94, 0.82, 0.46, true);
      addCone(accentBucket, 0, citBaseY + 20.1, -20.0, 3.8, 4.2, 10, spireRgb[0], spireRgb[1], spireRgb[2]);
    } else if (spec.theme === 'sunken-aqueducts') {
      for (let ax = -18; ax <= 18; ax += 6) {
        const ay = realmTerrainHeightAt(spec, ax, -20.5);
        addTiledBox(stoneBucket, ax, ay + 5.8, -20.5, 2.1, 11.6, 2.4, 2.4);
      }
      addTiledBox(stoneBucket, 0, citBaseY + 10.6, -20.5, 38.0, 2.2, 2.8, 2.8);
      addCylinder(stoneBucket, 0, citBaseY + 1.5, -18.0, 5.8, 5.5, 5.4, 8, 1, 1, 1, true);
      addCone(accentBucket, 0, citBaseY + 6.9, -18.0, 5.7, 4.5, 8, spireRgb[0], spireRgb[1], spireRgb[2]);
    } else if (spec.theme === 'amber-steppe') {
      // Stepped Sandstone Ziggurat + Twin Bronze Wind-Harp Monoliths
      addTiledBox(stoneBucket, 0, citBaseY + 3.2, -20.5, 15.0, 3.8, 12.0, 2.8);
      addTiledBox(stoneBucket, 0, citBaseY + 6.8, -20.5, 11.2, 3.4, 9.2, 2.6);
      addTiledBox(stoneBucket, 0, citBaseY + 10.1, -20.5, 7.6, 3.2, 6.8, 2.4);
      addCylinder(accentBucket, 0, citBaseY + 11.7, -20.5, 2.6, 1.4, 6.5, 6, 0.86, 0.66, 0.30, true);
      addCone(accentBucket, 0, citBaseY + 18.2, -20.5, 1.6, 3.4, 6, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      for (const side of [-1, 1]) {
        addTiledBox(stoneBucket, side * 12.5, citBaseY + 5.8, -14.0, 1.8, 12.0, 1.8, 2.2);
        addBox(accentBucket, side * 12.5, citBaseY + 12.2, -14.0, 0.6, 2.4, 0.6, 0, 0.92, 0.72, 0.30);
      }
    } else if (spec.theme === 'glacial-spire') {
      // Dark Slate Aurora Fortress + Faceted Crystalline Frostglass Needle Spires
      addCylinder(stoneBucket, 0, citBaseY + 1.5, -20.5, 6.2, 5.4, 8.8, 8, 1, 1, 1, true);
      addCone(accentBucket, 0, citBaseY + 10.3, -20.5, 5.2, 12.5, 6, 0.56, 0.82, 0.96);
      for (const side of [-1, 1]) {
        addCylinder(accentBucket, side * 5.2, citBaseY + 1.5, -18.0, 1.9, 0.9, 10.5, 6, 0.48, 0.76, 0.92);
        addCone(accentBucket, side * 5.2, citBaseY + 12.0, -18.0, 1.0, 5.8, 6, 0.72, 0.94, 1.0);
      }
    } else {
      // Monumental Octagonal Basalt Keep (Vaelmor & Cinderfall Anvil Keep)
      addCylinder(stoneBucket, 0, citBaseY + 1.5, -20.5, 6.4, 6.2, 4.1, 8, 1, 1, 1, false);
      addCylinder(stoneBucket, 0, citBaseY + 5.6, -20.5, 6.2, 6.0, 4.1, 8, 1, 1, 1, false);
      addCylinder(stoneBucket, 0, citBaseY + 9.7, -20.5, 6.0, 5.8, 4.0, 8, 1, 1, 1, true);
      addCylinder(stoneBucket, 0, citBaseY + 13.4, -20.5, 6.2, 6.2, 1.5, 8);
      addCone(accentBucket, 0, citBaseY + 14.9, -20.5, 6.0, 6.8, 8, spireRgb[0], spireRgb[1], spireRgb[2]);
      addCone(accentBucket, 0, citBaseY + 21.3, -20.5, 0.55, 2.4, 6, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // Gatehouse & Flanking Bastions
    addTiledBox(stoneBucket, -3.2, citBaseY + 4.4, -14.0, 2.3, 6.6, 2.4, 2.4);
    addTiledBox(stoneBucket, 3.2, citBaseY + 4.4, -14.0, 2.3, 6.6, 2.4, 2.4);
    addTiledBox(stoneBucket, 0, citBaseY + 7.6, -14.0, 9.2, 2.0, 2.6, 2.5);
    for (const side of [-1, 1]) {
      const tx = side * 9.8, tz = -17.0;
      const ty = realmTerrainHeightAt(spec, tx, tz);
      addCylinder(stoneBucket, tx, ty - 0.8, tz, 3.2, 3.1, 3.8, 8, 1, 1, 1, false);
      addCylinder(stoneBucket, tx, ty + 3.0, tz, 3.1, 3.0, 3.8, 8, 1, 1, 1, false);
      addCylinder(stoneBucket, tx, ty + 6.8, tz, 3.0, 2.9, 3.6, 8, 1, 1, 1, true);
      addCylinder(stoneBucket, tx, ty + 10.2, tz, 3.3, 3.3, 1.2, 8);
      addCone(accentBucket, tx, ty + 11.4, tz, 3.4, 4.4, 8, spireRgb[0], spireRgb[1], spireRgb[2]);
      addTiledBox(stoneBucket, side * 6.0, ty + 3.4, -17.8, 5.2, 6.8, 2.0, 2.6);
      addBox(accentBucket, tx, ty + 6.4, tz + 3.05, 1.4, 3.8, 0.14, 0, bannerRgb[0], bannerRgb[1], bannerRgb[2]);
      addBox(accentBucket, tx, ty + 8.35, tz + 3.1, 1.8, 0.22, 0.22, 0, 0.85, 0.66, 0.30);
    }

    // Sculpted Carved Dungeon Vault Gateways for every linked Dungeon Entrance!
    for (const ent of spec.dungeonEntrances) {
      const [dx, dz] = ent.position;
      const dy = realmTerrainHeightAt(spec, dx, dz);
      // Heavy buttressed stone portal arch + recessed dark threshold + glowing rune keystone
      addTiledBox(stoneBucket, dx - 3.0, dy + 3.2, dz, 1.9, 6.8, 2.8, 2.2);
      addTiledBox(stoneBucket, dx + 3.0, dy + 3.2, dz, 1.9, 6.8, 2.8, 2.2);
      addTiledBox(stoneBucket, dx, dy + 6.9, dz, 8.6, 2.0, 3.2, 2.2);
      addTiledBox(stoneBucket, dx, dy + 3.2, dz - 1.6, 5.6, 6.4, 1.4, 2.2);
      addCone(accentBucket, dx, dy + 7.9, dz, 1.05, 2.2, 4, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      addBox(accentBucket, dx - 3.0, dy + 6.9, dz + 1.5, 0.65, 0.65, 0.45, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      addBox(accentBucket, dx + 3.0, dy + 6.9, dz + 1.5, 0.65, 0.65, 0.45, 0, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // OUTER FRONTIER LANDMARK 1: Northern Watchtower Spire (0, -56)
    const nwY = realmTerrainHeightAt(spec, 0, -56);
    addCylinder(stoneBucket, 0, nwY - 0.6, -56, 5.2, 4.6, 2.0, 8);
    addCylinder(stoneBucket, 0, nwY + 1.4, -56, 3.6, 3.0, 12.0, 8);
    addCylinder(stoneBucket, 0, nwY + 13.4, -56, 3.8, 3.8, 1.4, 8);
    addCone(accentBucket, 0, nwY + 14.8, -56, 4.0, 5.2, 8, spireRgb[0], spireRgb[1], spireRgb[2]);
    addCone(accentBucket, 0, nwY + 19.6, -56, 0.6, 1.8, 6, lanternRgb[0], lanternRgb[1], lanternRgb[2]);

    // OUTER FRONTIER LANDMARK 2: Western Pre-Charter Monolith Stone Circle (-54, -22)
    const wcY = realmTerrainHeightAt(spec, -54, -22);
    addCylinder(cobbleBucket, -54, wcY - 0.2, -22, 8.2, 8.0, 0.55, 12);
    addTiledBox(stoneBucket, -54, wcY + 0.6, -22, 2.8, 1.0, 2.8, 2.0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const mx = -54 + Math.cos(a) * 7.2;
      const mz = -22 + Math.sin(a) * 7.2;
      const my = realmTerrainHeightAt(spec, mx, mz);
      const mh = 5.2 + (i % 3) * 1.4;
      addTiledBox(stoneBucket, mx, my + mh * 0.5, mz, 1.45, mh, 1.05, 2.2, a);
      if (i % 2 === 0) {
        addCone(accentBucket, mx, my + mh, mz, 0.52, 1.1, 4, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
      }
    }

    // OUTER FRONTIER LANDMARK 3: Eastern Caravan Bastion & Timber Pavilion (54, 10)
    const ecY = realmTerrainHeightAt(spec, 54, 10);
    addTiledBox(stoneBucket, 54, ecY + 0.4, 10, 10.5, 1.2, 8.5, 2.6);
    for (const [dx, dz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
      addBox(timberBucket, 54 + dx, ecY + 3.2, 10 + dz, 0.42, 4.6, 0.42);
    }
    addTiledBox(timberBucket, 54, ecY + 5.6, 10, 10.8, 0.45, 8.8, 2.6);
    addCone(accentBucket, 54, ecY + 5.8, 10, 5.8, 2.8, 4, spireRgb[0], spireRgb[1], spireRgb[2]);
    addBox(accentBucket, 54 - 4.5, ecY + 4.4, 10 + 3.4, 0.14, 3.2, 1.2, 0, bannerRgb[0], bannerRgb[1], bannerRgb[2]);

    // Southern Surveyor Outpost & Gateway Obelisks
    const outY = realmTerrainHeightAt(spec, -6.2, 16.5);
    addTiledBox(stoneBucket, -6.4, outY + 0.3, 16.6, 5.4, 0.9, 4.4, 2.4);
    for (const [dx, dz] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) {
      addBox(timberBucket, -6.4 + dx, outY + 2.3, 16.6 + dz, 0.32, 3.6, 0.32);
    }
    addTiledBox(timberBucket, -6.4, outY + 4.2, 15.6, 5.8, 0.28, 2.6, 2.4);
    addTiledBox(timberBucket, -6.4, outY + 4.2, 17.6, 5.8, 0.28, 2.6, 2.4);
    for (const side of [-1, 1]) {
      const gx = side * 4.4, gz = 14.0;
      const gy = realmTerrainHeightAt(spec, gx, gz);
      addTiledBox(stoneBucket, gx, gy + 2.1, gz, 1.4, 4.6, 1.4, 2.2);
      addCone(accentBucket, gx, gy + 4.4, gz, 0.85, 1.1, 4, lanternRgb[0], lanternRgb[1], lanternRgb[2]);
    }

    // West Basin Bell Pavilion & Smelter / Mill
    const kilnY = realmTerrainHeightAt(spec, -26, -8);
    addCylinder(stoneBucket, -26, kilnY - 0.6, -8, 6.8, 6.5, 1.2, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      addBox(timberBucket, -26 + Math.cos(a) * 4.8, kilnY + 3.8, -8 + Math.sin(a) * 4.8, 0.52, 6.8, 0.52);
    }
    addCylinder(timberBucket, -26, kilnY + 6.9, -8, 5.6, 5.4, 0.65, 6);
    addCone(accentBucket, -26, kilnY + 7.5, -8, 6.1, 3.6, 6, 0.34, 0.22, 0.17);
    const smY = realmTerrainHeightAt(spec, -29.5, -1.5);
    addTiledBox(stoneBucket, -29.5, smY + 2.5, -1.5, 6.2, 5.4, 4.8, 2.5);
    addCylinder(stoneBucket, -31.2, smY + 5.0, -2.5, 1.25, 0.9, 6.2, 8);

    // East Shelter + Vast Biome Groves Across the 224m Landscape
    const shY = realmTerrainHeightAt(spec, 20.0, -3.5);
    addBox(timberBucket, 20.0, shY + 0.2, -3.5, 4.4, 0.6, 3.6);
    for (const [dx, dz] of [[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.4], [1.8, 1.4]]) {
      addBox(timberBucket, 20.0 + dx, shY + 1.9, -3.5 + dz, 0.28, 3.2, 0.28);
    }
    addBox(timberBucket, 20.0, shY + 3.6, -3.5, 4.8, 0.25, 4.0);

    const rand = mulberry32(spec.seed + 101);
    const treeSpots = [
      // Inner groves
      [24, -10], [28, -13], [32, -9], [35, -4], [31, 1], [25, -1], [20, -11], [17, -14],
      [29, -16], [36, -12], [22, -17], [15, -9], [-12, 18], [-16, 12], [-14, 24],
      [11, 17], [14, 12], [10, 26], [-15, -18], [-19, -24], [15, -18], [19, -25],
      [-22, 15], [-30, 12], [-18, 28], [14, 34],
      // Outer frontier forests & formations (spanning +-82m)
      [-42, -38], [-34, -48], [-22, -52], [20, -48], [32, -44], [44, -36],
      [-64, -10], [-68, -32], [-44, -6], [-48, 22], [-36, 36], [-24, 48],
      [42, -24], [52, -16], [66, -8], [64, 22], [46, 34], [34, 48],
      [-16, -68], [18, -68], [-58, -48], [58, -44], [-66, 26], [68, -28],
    ];
    for (const [tx, tz] of treeSpots) {
      const ty = realmTerrainHeightAt(spec, tx, tz);
      const tNorm = terrainNormalAt(spec, tx, tz);
      if (ty < spec.terrainProfile.waterLevel + 0.25 || tNorm[1] < 0.82) continue;
      const hScale = 0.85 + rand() * 0.72;
      const isEastBiome = tx > 12 && tz < 10;
      if (spec.theme === 'obsidian-crucible') {
        addCylinder(accentBucket, tx, ty - 0.6, tz, 1.45 * hScale, 0.55 * hScale, 5.6 * hScale, 6, 0.19, 0.17, 0.19);
        addCone(accentBucket, tx, ty + 5.0 * hScale, tz, 0.55 * hScale, 1.8 * hScale, 6, 0.38, 0.22, 0.16);
        continue;
      }
      if (spec.theme === 'amber-steppe') {
        // Ochre Sandstone Hoodoo Pillars & Desert Juniper
        addCylinder(accentBucket, tx, ty - 0.5, tz, 1.35 * hScale, 0.85 * hScale, 4.6 * hScale, 7, 0.62, 0.44, 0.26);
        addCone(accentBucket, tx, ty + 4.1 * hScale, tz, 1.6 * hScale, 1.2 * hScale, 7, 0.72, 0.52, 0.30);
        continue;
      }
      if (spec.theme === 'glacial-spire') {
        // Frost-Rimed Alpine Pines & Crystalline Ice-Spires
        if (rand() > 0.68) {
          addCylinder(accentBucket, tx, ty - 0.5, tz, 1.1 * hScale, 0.45 * hScale, 5.2 * hScale, 6, 0.48, 0.74, 0.90);
          addCone(accentBucket, tx, ty + 4.7 * hScale, tz, 0.5 * hScale, 2.8 * hScale, 6, 0.74, 0.92, 1.0);
        } else {
          const trunkH = 3.2 * hScale;
          addCylinder(accentBucket, tx, ty - 0.5, tz, 0.42 * hScale, 0.2 * hScale, trunkH, 7, 0.22, 0.20, 0.22);
          addCone(accentBucket, tx, ty + trunkH * 0.5, tz, 2.4 * hScale, 2.8 * hScale, 8, 0.20, 0.34, 0.38);
          addCone(accentBucket, tx, ty + trunkH * 0.9, tz, 1.8 * hScale, 2.6 * hScale, 8, 0.54, 0.68, 0.76);
          addCone(accentBucket, tx, ty + trunkH * 1.25, tz, 1.1 * hScale, 2.2 * hScale, 8, 0.80, 0.88, 0.94);
        }
        continue;
      }
      const trunkH = (isEastBiome ? 4.2 : 3.1) * hScale;
      const trunkR = (isEastBiome ? 0.5 : 0.36) * hScale;
      addCylinder(accentBucket, tx, ty - 0.5, tz, trunkR * 1.5, trunkR * 0.62, trunkH, 7, 0.27, 0.19, 0.13);
      const shade = 0.88 + rand() * 0.22;
      const c1 =
        spec.theme === 'sunken-aqueducts'
          ? [0.12 * shade, 0.38 * shade, 0.24 * shade]
          : isEastBiome
            ? [0.74 * shade, 0.42 * shade, 0.14]
            : [0.15 * shade, 0.32 * shade, 0.19 * shade];
      const c2 =
        spec.theme === 'sunken-aqueducts'
          ? [0.18 * shade, 0.48 * shade, 0.30 * shade]
          : isEastBiome
            ? [0.85 * shade, 0.55 * shade, 0.18]
            : [0.20 * shade, 0.40 * shade, 0.23 * shade];
      const c3 =
        spec.theme === 'sunken-aqueducts'
          ? [0.26 * shade, 0.58 * shade, 0.36 * shade]
          : isEastBiome
            ? [0.92 * shade, 0.67 * shade, 0.25]
            : [0.26 * shade, 0.48 * shade, 0.27 * shade];
      const rBase = (isEastBiome ? 3.2 : 2.5) * hScale;
      addCone(accentBucket, tx, ty + trunkH * 0.54, tz, rBase, 2.7 * hScale, 8, c1[0], c1[1], c1[2]);
      addCone(accentBucket, tx + (rand() - 0.5) * 0.6, ty + trunkH * 0.82, tz + (rand() - 0.5) * 0.6, rBase * 0.78, 2.5 * hScale, 8, c2[0], c2[1], c2[2]);
      addCone(accentBucket, tx + (rand() - 0.5) * 0.4, ty + trunkH * 1.1, tz + (rand() - 0.5) * 0.4, rBase * 0.52, 2.1 * hScale, 8, c3[0], c3[1], c3[2]);
    }

    // Coastal Arch, Grounded Timber Wharf (with pilings into cove bed) & Sea-Stacks
    const slY = realmTerrainHeightAt(spec, 24.5, 22.0);
    addTiledBox(stoneBucket, 22.8, slY + 2.2, 23.8, 1.5, 5.2, 1.5, 2.2);
    addTiledBox(stoneBucket, 26.2, slY + 2.2, 23.8, 1.5, 5.2, 1.5, 2.2);
    addTiledBox(stoneBucket, 24.5, slY + 4.9, 23.8, 5.2, 1.2, 1.7, 2.2);
    const pierY = Math.max(spec.terrainProfile.waterLevel + 0.55, realmTerrainHeightAt(spec, 19.5, 22.5));
    addTiledBox(timberBucket, 20.5, pierY + 0.2, 24.0, 2.6, 0.35, 6.2, 2.4, 0.35);
    for (const [px, pz] of [[19.4, 21.8], [21.6, 21.8], [19.4, 26.2], [21.6, 26.2]]) {
      const bedY = realmTerrainHeightAt(spec, px, pz) - 0.6;
      const hP = Math.max(0.8, pierY + 0.2 - bedY);
      addCylinder(timberBucket, px, bedY, pz, 0.18, 0.16, hP, 6);
    }
    for (const [sx, sz, sr, sh] of [[33, 28, 2.4, 7.8], [37, 32, 3.1, 11.4], [29, 34, 2.0, 6.2], [39, 24, 2.6, 9.0]]) {
      const sy = realmTerrainHeightAt(spec, sx, sz) - 1.5;
      addCylinder(accentBucket, sx, sy, sz, sr, sr * 0.72, sh, 6, 0.15, 0.18, 0.22);
      addCone(accentBucket, sx, sy + sh, sz, sr * 0.72, sh * 0.22, 6, 0.20, 0.25, 0.30);
    }
    // Mountain ranges are now sculpted directly into the continuous terrain mesh (realmTerrainHeightAt)
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
