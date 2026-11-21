import type { GameNpc, WorldInteractable } from '../game/worldData';
import type { EnemyArchetype, EnemyEntity } from '../game/rpgLogic';
import { type FrontiersRealmSpec } from './realmModelSchema';
import { synthesizeRealmEcosystem } from './verdantEcosystemCatalog';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';

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
  if (archetype === 'charger') return 1.02;
  if (archetype === 'hexweaver') return 0.78;
  if (archetype === 'shardcaster') return 0.72;
  if (archetype === 'skirmisher') return 0.66;
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

// Overworld structures & flora colliders are synthesized 1:1 from verdantEcosystemCatalog.ts

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
    // 1. Topology-Driven Dungeon Hazard & Chasm Pit Barriers (1:1 with verdantUnifiedCharter.ts!)
    // Allows projectiles to fly across open pits/chasms while preventing entities from walking on air!
    const dgPlan = synthesizeDungeonEcosystem(spec);
    for (const hz of dgPlan.hazardZones) {
      if (!hz.blocksWalking) continue;
      boxes.push({
        minX: hz.minX,
        maxX: hz.maxX,
        minZ: hz.minZ,
        maxZ: hz.maxZ,
        blocksProjectiles: false,
        label: `dungeon-hazard-${hz.id}`,
      });
    }

    // 2. Bespoke 3D Dungeon Static Colliders (1:1 with verdantDungeonCatalog.ts, verdantCatalogCompiler.ts & verdantProceduralGlb.ts!)
    for (const part of dgPlan.structures) {
      if (part.collider === 'none') continue;
      if (part.collider === 'circle') {
        circles.push({
          x: part.x,
          z: part.z,
          radius: part.colliderRadius ?? part.sx,
          minY: part.minY,
          maxY: part.maxY,
          blocksProjectiles: true,
          label: part.id,
        });
      } else {
        addCenteredBox(boxes, part.x, part.z, part.sx, part.sz, part.id, {
          minY: part.minY,
          maxY: part.maxY,
          blocksProjectiles: true,
        });
      }
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

    // Bespoke Ecosystem-Synthesized Static Colliders (1:1 with verdantCatalogCompiler.ts & verdantProceduralGlb.ts!)
    const ecoPlan = synthesizeRealmEcosystem(spec);
    for (const part of ecoPlan.structures) {
      if (part.collider === 'none') continue;
      if (part.collider === 'circle') {
        circles.push({
          x: part.x,
          z: part.z,
          radius: part.colliderRadius ?? part.sx,
          minY: part.minY,
          maxY: part.maxY,
          blocksProjectiles: true,
          label: part.id,
        });
      } else {
        addCenteredBox(boxes, part.x, part.z, part.sx, part.sz, part.id, {
          minY: part.minY,
          maxY: part.maxY,
          blocksProjectiles: true,
        });
      }
    }

    // Ecological Flora / Botanical / Geological Solid Colliders (1:1 with synthesized flora instances)
    for (const f of ecoPlan.floraInstances) {
      circles.push({
        x: f.x,
        z: f.z,
        radius: f.colliderRadius,
        blocksProjectiles: true,
        label: f.id,
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
