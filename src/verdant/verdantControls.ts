import { resolveCircleVsWorld, type WorldCollisionMap } from './verdantCollision';
import type { EnemyEntity } from '../game/rpgLogic';

export interface MovementInputState {
  inForward: number; // -1..1
  inRight: number; // -1..1
  camYaw: number;
  vx: number;
  vz: number;
  playerYaw: number;
  maxSpeed: number;
  /** Optional acceleration rate override (e.g., hydrodynamic inertia while wading/swimming) */
  accelRate?: number;
  /** Optional deceleration/drag rate override (e.g., water glide when releasing keys) */
  decelRate?: number;
  /** Optional turning responsiveness override */
  turnRate?: number;
  dt: number;
}

export interface MovementStepResult {
  vx: number;
  vz: number;
  speed: number;
  playerYaw: number;
  hasInput: boolean;
  inputDirX: number;
  inputDirZ: number;
}

export function shortestAngleDelta(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Smooth velocity-based third-person action-RPG locomotion with crisp
 * acceleration, responsive stopping friction, and smooth shortest-arc turning.
 */
export function stepVelocityMovement(input: MovementInputState): MovementStepResult {
  const fwdX = Math.sin(input.camYaw);
  const fwdZ = Math.cos(input.camYaw);
  const rightX = -fwdZ;
  const rightZ = fwdX;

  let dirX = fwdX * input.inForward + rightX * input.inRight;
  let dirZ = fwdZ * input.inForward + rightZ * input.inRight;
  const rawLen = Math.hypot(dirX, dirZ);
  const hasInput = rawLen > 0.01;

  if (hasInput) {
    dirX /= rawLen;
    dirZ /= rawLen;
  } else {
    dirX = 0;
    dirZ = 0;
  }

  const targetVx = dirX * input.maxSpeed;
  const targetVz = dirZ * input.maxSpeed;
  const accelRate = hasInput ? (input.accelRate ?? 54.0) : (input.decelRate ?? 46.0);
  const maxStep = accelRate * input.dt;

  const dvx = targetVx - input.vx;
  const dvz = targetVz - input.vz;
  const dLen = Math.hypot(dvx, dvz);

  let vx = input.vx;
  let vz = input.vz;
  if (dLen <= maxStep || dLen < 1e-4) {
    vx = targetVx;
    vz = targetVz;
  } else {
    vx += (dvx / dLen) * maxStep;
    vz += (dvz / dLen) * maxStep;
  }

  const speed = Math.hypot(vx, vz);
  let playerYaw = input.playerYaw;
  if (hasInput) {
    const targetYaw = Math.atan2(dirX, dirZ);
    const diff = shortestAngleDelta(playerYaw, targetYaw);
    const turnRate = input.turnRate ?? 16.0;
    playerYaw += diff * (1 - Math.exp(-turnRate * input.dt));
  }

  return {
    vx,
    vz,
    speed,
    playerYaw,
    hasInput,
    inputDirX: dirX,
    inputDirZ: dirZ,
  };
}

/**
 * Soft combat assist: when the player triggers a melee strike, smoothly face
 * the closest living hostile within strike assist range so attacks connect crisply.
 */
export function findSoftCombatTargetYaw(
  playerX: number,
  playerZ: number,
  currentYaw: number,
  enemies: EnemyEntity[],
  maxRange = 5.4,
): number | null {
  let bestYaw: number | null = null;
  let bestScore = Infinity;

  for (const e of enemies) {
    if (e.state === 'ko' || e.hp <= 0) continue;
    const dx = e.x - playerX;
    const dz = e.z - playerZ;
    const dist = Math.hypot(dx, dz);
    if (dist > maxRange || dist < 0.05) continue;
    const angle = Math.atan2(dx, dz);
    const angleDiff = Math.abs(shortestAngleDelta(currentYaw, angle));
    // Prefer closer enemies in front of the player, while still snapping to close flankers
    const score = dist + angleDiff * 1.15;
    if (score < bestScore) {
      bestScore = score;
      bestYaw = angle;
    }
  }

  return bestYaw;
}

export interface SpringArmInput {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  camYaw: number;
  camPitch: number;
  desiredDist: number;
  isDungeon: boolean;
  collisionMap: WorldCollisionMap;
  groundAt: (x: number, z: number) => number;
}

export interface SpringArmResult {
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  resolvedDist: number;
  obstructed: boolean;
}

/**
 * Ray-marched third-person spring-arm camera that glides around solid keeps,
 * masonry pillars, and dungeon walls so the camera never clips into geometry.
 */
export function resolveSpringArmCamera(input: SpringArmInput): SpringArmResult {
  const effPitch = input.isDungeon ? Math.min(input.camPitch, 0.42) : input.camPitch;
  const dirX = -Math.sin(input.camYaw) * Math.cos(effPitch);
  const dirY = Math.sin(effPitch);
  const dirZ = -Math.cos(input.camYaw) * Math.cos(effPitch);

  const minDist = 1.35;
  const maxDist = Math.max(minDist, input.desiredDist);
  const steps = 14;
  let safeDist = maxDist;
  let obstructed = false;

  for (let i = 1; i <= steps; i++) {
    const t = 0.55 + ((maxDist - 0.55) * i) / steps;
    const px = input.anchorX + dirX * t;
    const py = input.anchorY + dirY * t;
    const pz = input.anchorZ + dirZ * t;

    const test = resolveCircleVsWorld(px, pz, 0.45, py, input.collisionMap);
    const pushed = Math.hypot(test.x - px, test.z - pz);
    if (pushed > 0.12) {
      safeDist = Math.max(minDist, t - 0.58);
      obstructed = true;
      break;
    }
  }

  let eyeX = input.anchorX + dirX * safeDist;
  let eyeZ = input.anchorZ + dirZ * safeDist;
  if (input.isDungeon) {
    eyeZ = Math.max(-34.2, Math.min(31.6, eyeZ));
    const camXLim = eyeZ > 18.2 || eyeZ < -13.2 ? 9.0 : 18.4;
    eyeX = Math.max(-camXLim, Math.min(camXLim, eyeX));
  }

  const floorCam = input.groundAt(eyeX, eyeZ);
  let eyeY = Math.max(floorCam + 1.55, -0.15, input.anchorY + dirY * safeDist);
  if (input.isDungeon) {
    eyeY = Math.min(11.6, eyeY);
  }

  return {
    eyeX,
    eyeY,
    eyeZ,
    resolvedDist: safeDist,
    obstructed,
  };
}
