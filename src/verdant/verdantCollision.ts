import type { GameNpc, WorldInteractable } from '../game/worldData';
import type { EnemyArchetype, EnemyEntity } from '../game/rpgLogic';
import { realmTerrainHeightAt, type FrontiersRealmSpec } from './realmModelSchema';

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Optional minimum elevation for this obstacle to apply (e.g. bridge parapet only at deck height) */
  minY?: number;
  /** Optional maximum elevation (e.g. under-bridge piers only below deck height) */
  maxY?: number;
  /** Whether projectiles should be blocked by this collider (false for open pit/chasm barriers) */
  blocksProjectiles?: boolean;
  label: string;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  minY?: number;
  maxY?: number;
  blocksProjectiles?: boolean;
  label: string;
}

export interface WorldCollisionMap {
  realmSlug: string;
  isDungeon: boolean;
  boxes: BoxCollider[];
  circles: CircleCollider[];
}

export const PLAYER_COLLISION_RADIUS = 0.54;
export const NPC_COLLISION_RADIUS = 0.58;

export function getEnemyCollisionRadius(archetype: EnemyArchetype): number {
  if (archetype === 'colossus') return 1.48;
  if (archetype === 'shardcaster') return 0.72;
  return 0.76;
}

const NON_SOLID_CATALOG_ASSETS = new Set(['fern_02', 'potted_plant_04']);

function propFootprintRadius(assetId: string, targetHeight: number): number {
  if (assetId.includes('boulder') || assetId.includes('rock')) {
    return Math.max(0.65, Math.min(2.2, targetHeight * 0.52));
  }
  if (assetId.includes('statue') || assetId.includes('column') || assetId.includes('pillar')) {
    return Math.max(0.55, Math.min(1.5, targetHeight * 0.34));
  }
  if (assetId.includes('table') || assetId.includes('cart') || assetId.includes('crate')) {
    return Math.max(0.6, Math.min(1.6, targetHeight * 0.55));
  }
  if (assetId.includes('barrel') || assetId.includes('amphora') || assetId.includes('urn')) {
    return Math.max(0.42, Math.min(1.1, targetHeight * 0.42));
  }
  return Math.max(0.48, Math.min(1.35, targetHeight * 0.4));
}

function addCenteredBox(
  boxes: BoxCollider[],
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  label: string,
  opts?: { minY?: number; maxY?: number; blocksProjectiles?: boolean },
): void {
  boxes.push({
    minX: cx - sx * 0.5,
    maxX: cx + sx * 0.5,
    minZ: cz - sz * 0.5,
    maxZ: cz + sz * 0.5,
    minY: opts?.minY,
    maxY: opts?.maxY,
    blocksProjectiles: opts?.blocksProjectiles ?? true,
    label,
  });
}

// Exact same deterministic biome tree/formation coordinates as verdantCatalogCompiler.ts
const OVERWORLD_TREE_SPOTS: ReadonlyArray<[number, number]> = [
  [24, -10], [28, -13], [32, -9], [35, -4], [31, 1], [25, -1], [20, -11], [17, -14],
  [29, -16], [36, -12], [22, -17], [15, -9], [-12, 18], [-16, 12], [-14, 24],
  [11, 17], [14, 12], [10, 26], [-15, -18], [-19, -24], [15, -18], [19, -25],
  [-22, 15], [-30, 12], [-18, 28], [14, 34],
  [-42, -38], [-34, -48], [-22, -52], [20, -48], [32, -44], [44, -36],
  [-64, -10], [-68, -32], [-44, -6], [-48, 22], [-36, 36], [-24, 48],
  [42, -24], [52, -16], [66, -8], [64, 22], [46, 34], [34, 48],
  [-16, -68], [18, -68], [-58, -48], [58, -44], [-66, 26], [68, -28],
];

/**
 * Deterministically builds an exact 1:1 solid collision map matching the compiled
 * Verdant GLB geometry for both 224m overworld realms and multi-chamber 3D dungeons.
 */
export function buildRealmCollisionMap(
  spec: FrontiersRealmSpec,
  interactables: WorldInteractable[] = [],
): WorldCollisionMap {
  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];

  if (spec.isDungeon) {
    // 1. Massive Subterranean Perimeter Walls & Wing Narrowing Walls
    addCenteredBox(boxes, 0, 34.5, 46.0, 3.2, 'dungeon-south-wall');
    addCenteredBox(boxes, 0, -38.5, 46.0, 3.4, 'dungeon-north-wall');
    addCenteredBox(boxes, -22.5, -2.0, 3.2, 76.0, 'dungeon-west-wall');
    addCenteredBox(boxes, 22.5, -2.0, 3.2, 76.0, 'dungeon-east-wall');

    for (const side of [-1, 1]) {
      // Vestibule narrowing curtain walls & boss wing narrowing walls
      addCenteredBox(boxes, side * 15.5, 26.0, 11.0, 16.0, 'dungeon-vestibule-wall');
      addCenteredBox(boxes, side * 16.5, -25.5, 9.0, 25.0, 'dungeon-boss-wing-wall');
      // Carved alcove archway jambs (leaving z: -8..0 alcove entrance open)
      addCenteredBox(boxes, side * 12.2, -9.2, 2.2, 2.2, 'dungeon-alcove-pillar-n');
      addCenteredBox(boxes, side * 12.2, 1.2, 2.2, 2.2, 'dungeon-alcove-pillar-s');
    }

    // 2. Abyss Chasm Pit Barriers (z: 4.0..18.0 everywhere outside the stone bridge |x| <= 2.35)
    // Allows projectiles to fly across the open chasm while preventing entities from walking on air!
    boxes.push({
      minX: -22.5,
      maxX: -2.4,
      minZ: 4.0,
      maxZ: 18.0,
      blocksProjectiles: false,
      label: 'dungeon-chasm-west',
    });
    boxes.push({
      minX: 2.4,
      maxX: 22.5,
      minZ: 4.0,
      maxZ: 18.0,
      blocksProjectiles: false,
      label: 'dungeon-chasm-east',
    });
    // Bridge lantern stone plinths along the bridge parapet
    for (const side of [-1, 1]) {
      addCenteredBox(boxes, side * 2.55, 11.0, 0.44, 14.8, 'dungeon-bridge-parapet');
    }

    // 3. Towering Octagonal Fluted Colonnade Pillars
    const ribZs = [26, 18.5, 3.2, -4.0, -12.0, -20.0, -28.0];
    for (const rz of ribZs) {
      const colX = rz > 14 ? 8.8 : 10.6;
      for (const side of [-1, 1]) {
        addCenteredBox(boxes, side * colX, rz, 2.15, 2.15, `dungeon-column-${rz}`);
      }
    }

    // 4. Boss Sanctum Semi-Circular Monolith Crown
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI;
      const mx = Math.cos(ang) * 9.8;
      const mz = -26.0 + Math.sin(ang) * 8.4;
      circles.push({
        x: mx,
        z: mz,
        radius: 1.0,
        blocksProjectiles: true,
        label: `dungeon-boss-monolith-${i}`,
      });
    }

    // 5. Ascend Portal Stone Archway Jambs (leaving central doorway clear!)
    for (const pz of [30.8, -33.8]) {
      addCenteredBox(boxes, -2.5, pz, 1.35, 1.55, `dungeon-portal-jamb-w-${pz}`);
      addCenteredBox(boxes, 2.5, pz, 1.35, 1.55, `dungeon-portal-jamb-e-${pz}`);
    }
  } else {
    // =========================================================================
    // OVERWORLD REALM STATIC COLLIDERS (1:1 WITH verdantCatalogCompiler.ts)
    // =========================================================================
    const tp = spec.terrainProfile;
    if (tp.hasBridge) {
      // Causeway bridge stone parapets (only active at bridge deck height)
      for (const side of [-1, 1]) {
        addCenteredBox(boxes, side * 2.65, 5.0, 0.55, 16.8, 'bridge-parapet', {
          minY: tp.bridgeDeckY - 0.75,
        });
      }
      // Massive stone piers under the bridge (only active below bridge deck height)
      for (const pz of [-2.4, 5.2, 12.6]) {
        addCenteredBox(boxes, 0, pz, 6.2, 1.9, 'bridge-pier', {
          maxY: tp.bridgeDeckY - 0.85,
        });
      }
    }

    // Theme-Driven Northern Monumental Keep / Landmark
    if (spec.theme === 'pelagic-spires') {
      circles.push({ x: 0, z: -20.0, radius: 4.85, blocksProjectiles: true, label: 'lighthouse-keep' });
    } else if (spec.theme === 'sunken-aqueducts') {
      for (let ax = -18; ax <= 18; ax += 6) {
        addCenteredBox(boxes, ax, -20.5, 2.15, 2.45, `aqueduct-pier-${ax}`);
      }
      circles.push({ x: 0, z: -18.0, radius: 5.8, blocksProjectiles: true, label: 'aqueduct-rotunda' });
    } else if (spec.theme === 'amber-steppe') {
      addCenteredBox(boxes, 0, -20.5, 15.0, 12.0, 'steppe-ziggurat');
      addCenteredBox(boxes, -12.5, -14.0, 1.85, 1.85, 'steppe-monolith-w');
      addCenteredBox(boxes, 12.5, -14.0, 1.85, 1.85, 'steppe-monolith-e');
    } else if (spec.theme === 'glacial-spire') {
      circles.push({ x: 0, z: -20.5, radius: 6.2, blocksProjectiles: true, label: 'glacial-fortress' });
      circles.push({ x: -5.2, z: -18.0, radius: 1.9, blocksProjectiles: true, label: 'glacial-spire-w' });
      circles.push({ x: 5.2, z: -18.0, radius: 1.9, blocksProjectiles: true, label: 'glacial-spire-e' });
    } else {
      // Octagonal Basalt Keep (Vaelmor & Cinderfall) — flat-face inradius leaves gatehouse portal open
      circles.push({ x: 0, z: -20.5, radius: 5.85, blocksProjectiles: true, label: 'citadel-keep' });
    }

    // Citadel Gatehouse Piers (open central portal x: -2.0..2.0) & Flanking Bastions
    addCenteredBox(boxes, -3.2, -14.0, 2.3, 2.4, 'citadel-gatehouse-w');
    addCenteredBox(boxes, 3.2, -14.0, 2.3, 2.4, 'citadel-gatehouse-e');
    for (const side of [-1, 1]) {
      circles.push({
        x: side * 9.8,
        z: -17.0,
        radius: 3.2,
        blocksProjectiles: true,
        label: `citadel-bastion-${side < 0 ? 'w' : 'e'}`,
      });
      addCenteredBox(boxes, side * 6.0, -17.8, 5.2, 2.0, `citadel-curtain-${side < 0 ? 'w' : 'e'}`);
    }

    // Sculpted Dungeon Vault Gateways (solid jambs + rear stone seal, open front threshold)
    for (const ent of spec.dungeonEntrances) {
      const [dx, dz] = ent.position;
      addCenteredBox(boxes, dx - 3.0, dz, 1.9, 2.8, `vault-gate-w-${ent.dungeonSlug}`);
      addCenteredBox(boxes, dx + 3.0, dz, 1.9, 2.8, `vault-gate-e-${ent.dungeonSlug}`);
      addCenteredBox(boxes, dx, dz - 1.6, 5.6, 1.4, `vault-gate-back-${ent.dungeonSlug}`);
    }

    // Outer Landmark 1: Northern Watchtower Spire (0, -56)
    circles.push({ x: 0, z: -56, radius: 4.9, blocksProjectiles: true, label: 'north-watchtower' });

    // Outer Landmark 2: Western Pre-Charter Monolith Stone Circle (-54, -22)
    addCenteredBox(boxes, -54, -22, 2.8, 2.8, 'west-circle-altar');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      circles.push({
        x: -54 + Math.cos(a) * 7.2,
        z: -22 + Math.sin(a) * 7.2,
        radius: 0.92,
        blocksProjectiles: true,
        label: `west-monolith-${i}`,
      });
    }

    // Outer Landmark 3: Eastern Caravan Bastion Corner Posts (54, 10)
    for (const [dx, dz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
      circles.push({ x: 54 + dx, z: 10 + dz, radius: 0.42, blocksProjectiles: true, label: 'east-pavilion-post' });
    }

    // Southern Surveyor Outpost Posts (-6.4, 16.6) & Twin Gateway Obelisks (±4.4, 14.0)
    for (const [dx, dz] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) {
      circles.push({ x: -6.4 + dx, z: 16.6 + dz, radius: 0.34, blocksProjectiles: true, label: 'outpost-post' });
    }
    addCenteredBox(boxes, -4.4, 14.0, 1.45, 1.45, 'south-obelisk-w');
    addCenteredBox(boxes, 4.4, 14.0, 1.45, 1.45, 'south-obelisk-e');

    // West Basin Bell Pavilion Pillars (-26, -8) & Smelter House (-29.5, -1.5)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      circles.push({
        x: -26 + Math.cos(a) * 4.8,
        z: -8 + Math.sin(a) * 4.8,
        radius: 0.46,
        blocksProjectiles: true,
        label: `foundry-pillar-${i}`,
      });
    }
    addCenteredBox(boxes, -29.5, -1.5, 6.2, 4.8, 'foundry-smelter');

    // East Shelter Posts (20.0, -3.5)
    for (const [dx, dz] of [[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.4], [1.8, 1.4]]) {
      circles.push({ x: 20.0 + dx, z: -3.5 + dz, radius: 0.32, blocksProjectiles: true, label: 'east-shelter-post' });
    }

    // Coastal Arch Jambs & Sea-Stacks
    addCenteredBox(boxes, 22.8, 23.8, 1.5, 1.5, 'coastal-arch-w');
    addCenteredBox(boxes, 26.2, 23.8, 1.5, 1.5, 'coastal-arch-e');
    for (const [sx, sz, sr] of [[33, 28, 2.4], [37, 32, 3.1], [29, 34, 2.0], [39, 24, 2.6]]) {
      circles.push({ x: sx, z: sz, radius: sr, blocksProjectiles: true, label: 'sea-stack' });
    }

    // Biome Groves / Volcanic Spires / Sandstone Hoodoos
    const trunkRadius =
      spec.theme === 'obsidian-crucible' || spec.theme === 'amber-steppe' ? 1.25 : 0.65;
    for (const [tx, tz] of OVERWORLD_TREE_SPOTS) {
      const ty = realmTerrainHeightAt(spec, tx, tz);
      const tSlope = Math.hypot(
        (realmTerrainHeightAt(spec, tx + 1, tz) - realmTerrainHeightAt(spec, tx - 1, tz)) * 0.5,
        (realmTerrainHeightAt(spec, tx, tz + 1) - realmTerrainHeightAt(spec, tx, tz - 1)) * 0.5,
      );
      if (ty < spec.terrainProfile.waterLevel + 0.25 || tSlope > 0.52) continue;
      circles.push({
        x: tx,
        z: tz,
        radius: trunkRadius,
        blocksProjectiles: true,
        label: `biome-tree-${tx}-${tz}`,
      });
    }
  }

  // Imported Poly Haven CC0 3D Props (shared for Overworld + Dungeons!)
  for (const prop of spec.importedCatalogProps) {
    if (NON_SOLID_CATALOG_ASSETS.has(prop.assetId)) continue;
    const rad = propFootprintRadius(prop.assetId, prop.targetHeight);
    circles.push({
      x: prop.position[0],
      z: prop.position[1],
      radius: rad,
      blocksProjectiles: true,
      label: `prop-${prop.assetId}`,
    });
  }

  // Solid Interactable Pedestals (keep portals & flat moss patches walkable/approachable)
  for (const item of interactables) {
    if (
      item.kind === 'waystone-beacon' ||
      item.kind === 'forge-bell' ||
      item.kind === 'vault-chest' ||
      item.kind === 'seal-brazier'
    ) {
      circles.push({
        x: item.position[0],
        z: item.position[1],
        radius: item.kind === 'forge-bell' ? 1.05 : 0.72,
        blocksProjectiles: true,
        label: `interactable-${item.id}`,
      });
    }
  }

  return {
    realmSlug: spec.slug,
    isDungeon: Boolean(spec.isDungeon),
    boxes,
    circles,
  };
}

/**
 * Iterative multi-pass Circle-vs-AABB and Circle-vs-Circle solid push-out solver.
 * Guarantees smooth wall sliding without pass-through, snagging, or corner tunneling.
 */
export function resolveCircleVsWorld(
  x: number,
  z: number,
  radius: number,
  y: number,
  map: WorldCollisionMap,
): { x: number; z: number; collided: boolean } {
  let rx = x;
  let rz = z;
  let collided = false;

  for (let pass = 0; pass < 3; pass++) {
    let movedInPass = false;

    for (let i = 0; i < map.boxes.length; i++) {
      const b = map.boxes[i];
      if (b.minY !== undefined && y < b.minY) continue;
      if (b.maxY !== undefined && y > b.maxY) continue;

      const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        collided = true;
        movedInPass = true;
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist + 0.002;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Center is inside box — push out along the shortest axis to exit cleanly
          const penLeft = Math.abs(rx - b.minX);
          const penRight = Math.abs(b.maxX - rx);
          const penTop = Math.abs(rz - b.minZ);
          const penBot = Math.abs(b.maxZ - rz);
          const minPen = Math.min(penLeft, penRight, penTop, penBot);
          if (minPen === penLeft) rx = b.minX - radius - 0.002;
          else if (minPen === penRight) rx = b.maxX + radius + 0.002;
          else if (minPen === penTop) rz = b.minZ - radius - 0.002;
          else rz = b.maxZ + radius + 0.002;
        }
      }
    }

    for (let i = 0; i < map.circles.length; i++) {
      const c = map.circles[i];
      if (c.minY !== undefined && y < c.minY) continue;
      if (c.maxY !== undefined && y > c.maxY) continue;

      const dx = rx - c.x;
      const dz = rz - c.z;
      const minDist = radius + c.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        collided = true;
        movedInPass = true;
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = minDist - dist + 0.002;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          rx += minDist + 0.002;
        }
      }
    }

    if (!movedInPass) break;
  }

  return { x: rx, z: rz, collided };
}

/**
 * Resolves solid physical separation between Player, NPCs, living Enemies, and remote allies
 * so characters and creatures can never clip or walk through one another.
 */
export function resolveDynamicBodySeparation(
  player: { x: number; z: number; radius?: number },
  enemies: EnemyEntity[],
  npcs: GameNpc[],
  remoteBodies: Array<{ x: number; z: number }> = [],
): { playerX: number; playerZ: number } {
  let px = player.x;
  let pz = player.z;
  const pRad = player.radius ?? PLAYER_COLLISION_RADIUS;

  // 1. Player vs NPCs (NPCs are rooted; player smoothly slides around)
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const dx = px - npc.position[0];
    const dz = pz - npc.position[1];
    const minDist = pRad + NPC_COLLISION_RADIUS;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist) {
      if (dSq > 1e-8) {
        const d = Math.sqrt(dSq);
        const push = minDist - d + 0.002;
        px += (dx / d) * push;
        pz += (dz / d) * push;
      } else {
        pz += minDist + 0.002;
      }
    }
  }

  // 2. Player vs Remote Multiplayer Avatars
  for (let i = 0; i < remoteBodies.length; i++) {
    const rb = remoteBodies[i];
    const dx = px - rb.x;
    const dz = pz - rb.z;
    const minDist = pRad * 2;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist && dSq > 1e-8) {
      const d = Math.sqrt(dSq);
      const push = (minDist - d) * 0.65;
      px += (dx / d) * push;
      pz += (dz / d) * push;
    }
  }

  // 3. Player vs Living Enemies (weighted solid push-out)
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.state === 'ko' || e.hp <= 0) continue;
    const eRad = getEnemyCollisionRadius(e.archetype);
    const dx = px - e.x;
    const dz = pz - e.z;
    const minDist = pRad + eRad;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist) {
      const playerWeight = e.archetype === 'colossus' ? 0.9 : 0.65;
      const enemyWeight = 1 - playerWeight;
      if (dSq > 1e-8) {
        const d = Math.sqrt(dSq);
        const overlap = minDist - d + 0.002;
        const nx = dx / d;
        const nz = dz / d;
        px += nx * overlap * playerWeight;
        pz += nz * overlap * playerWeight;
        e.x -= nx * overlap * enemyWeight;
        e.z -= nz * overlap * enemyWeight;
      } else {
        px += minDist * playerWeight;
        e.x -= minDist * enemyWeight;
      }
    }
  }

  // 4. Enemy vs Enemy mutual separation (prevents enemy stacking)
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.state === 'ko' || a.hp <= 0) continue;
    const rA = getEnemyCollisionRadius(a.archetype);

    // Also keep enemies from walking through NPCs
    for (let n = 0; n < npcs.length; n++) {
      const npc = npcs[n];
      const dx = a.x - npc.position[0];
      const dz = a.z - npc.position[1];
      const minD = rA + NPC_COLLISION_RADIUS;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD && dSq > 1e-8) {
        const d = Math.sqrt(dSq);
        const push = minD - d + 0.002;
        a.x += (dx / d) * push;
        a.z += (dz / d) * push;
      }
    }

    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.state === 'ko' || b.hp <= 0) continue;
      const rB = getEnemyCollisionRadius(b.archetype);
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const minD = rA + rB;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD) {
        if (dSq > 1e-8) {
          const d = Math.sqrt(dSq);
          const half = (minD - d + 0.002) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x += nx * half;
          a.z += nz * half;
          b.x -= nx * half;
          b.z -= nz * half;
        } else {
          a.x += minD * 0.5;
          b.x -= minD * 0.5;
        }
      }
    }
  }

  return { playerX: px, playerZ: pz };
}

/**
 * Checks whether a flying projectile has impacted any solid wall, pillar, building, or boulder.
 */
export function isProjectileBlockedByWorld(
  x: number,
  z: number,
  y: number,
  radius: number,
  map: WorldCollisionMap,
): boolean {
  for (let i = 0; i < map.boxes.length; i++) {
    const b = map.boxes[i];
    if (b.blocksProjectiles === false) continue;
    if (b.minY !== undefined && y < b.minY) continue;
    if (b.maxY !== undefined && y > b.maxY) continue;
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  for (let i = 0; i < map.circles.length; i++) {
    const c = map.circles[i];
    if (c.blocksProjectiles === false) continue;
    if (c.minY !== undefined && y < c.minY) continue;
    if (c.maxY !== undefined && y > c.maxY) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const r = radius + c.radius;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
