import {
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
} from './realmModelSchema';

export type WaterPosture = 'dry' | 'wading' | 'swimming';

export interface WaterImmersionState {
  posture: WaterPosture;
  /** Depth of water above the terrain floor at the entity's position (0 when dry or on bridge) */
  depth: number;
  /** Elevation of the water surface */
  waterSurfaceY: number;
  /** Vertical world Y where a swimming entity floats (torso/shoulders in water, head clear) */
  swimFloatY: number;
  /** Gentle buoyant bobbing offset for swimming animation */
  buoyantBobY: number;
  /** Horizontal movement speed multiplier due to hydrodynamic drag */
  speedMultiplier: number;
  /** Turn responsiveness multiplier (heavier turning in water) */
  turnResponsiveness: number;
  /** Dodge / surge burst distance multiplier */
  dodgeScale: number;
  /** Whether heavy melee weapons (Hookblade / Bell-Hammer) can swing normally */
  canHeavyMelee: boolean;
  /** Passive stamina regen multiplier (treading/wading uses slightly more effort) */
  staminaRegenMultiplier: number;
}

export interface TerrainSlopeInfo {
  gradX: number;
  gradZ: number;
  /** Rise over run magnitude: hypot(dh/dx, dh/dz) */
  slope: number;
  /** True when the slope is gentle enough to climb on foot */
  climbable: boolean;
  /** Steepness ratio 0..1 relative to the max climbable slope */
  steepnessRatio: number;
}

export interface SlopeStepResolution {
  x: number;
  z: number;
  slope: number;
  blockedByCliff: boolean;
  /** Speed factor applied for uphill climbing / downhill stride */
  slopeSpeedFactor: number;
}

export interface WaterQuadTile {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  /** Average water depth across the tile (used for deep vs shallow tinting) */
  avgDepth: number;
  /** True if at least one corner rises above waterLevel (shoreline bank edge) */
  isShoreline: boolean;
}

export const WATER_WADE_MIN_DEPTH = 0.08;
export const WATER_SWIM_MIN_DEPTH = 0.95;
/** Maximum rise-over-run slope a character can hike up directly (~36.5 degrees) */
export const MAX_CLIMBABLE_SLOPE = 0.74;

/**
 * Evaluates whether an entity at (terrainY) is dry, wading in shallow water, or swimming in deep water.
 * Standing on an elevated bridge deck always keeps the character dry.
 */
export function evaluateWaterImmersion(
  terrainY: number,
  waterLevel: number,
  onBridge: boolean,
  timeSec = 0,
): WaterImmersionState {
  if (onBridge) {
    return {
      posture: 'dry',
      depth: 0,
      waterSurfaceY: waterLevel,
      swimFloatY: terrainY,
      buoyantBobY: 0,
      speedMultiplier: 1.0,
      turnResponsiveness: 1.0,
      dodgeScale: 1.0,
      canHeavyMelee: true,
      staminaRegenMultiplier: 1.0,
    };
  }

  const depth = Math.max(0, waterLevel - terrainY);

  if (depth <= WATER_WADE_MIN_DEPTH) {
    return {
      posture: 'dry',
      depth: 0,
      waterSurfaceY: waterLevel,
      swimFloatY: terrainY,
      buoyantBobY: 0,
      speedMultiplier: 1.0,
      turnResponsiveness: 1.0,
      dodgeScale: 1.0,
      canHeavyMelee: true,
      staminaRegenMultiplier: 1.0,
    };
  }

  if (depth <= WATER_SWIM_MIN_DEPTH) {
    // Shallow-to-waist wading: hydrodynamic drag increases smoothly with depth
    const wadeFrac = Math.min(
      1,
      (depth - WATER_WADE_MIN_DEPTH) / (WATER_SWIM_MIN_DEPTH - WATER_WADE_MIN_DEPTH),
    );
    return {
      posture: 'wading',
      depth,
      waterSurfaceY: waterLevel,
      swimFloatY: terrainY,
      buoyantBobY: 0,
      speedMultiplier: 0.80 - wadeFrac * 0.24, // 0.80x at ankles -> 0.56x at waist
      turnResponsiveness: 0.84 - wadeFrac * 0.16,
      dodgeScale: 0.74 - wadeFrac * 0.12,
      canHeavyMelee: true,
      staminaRegenMultiplier: 0.82,
    };
  }

  // Deep swimming: buoyancy floats character so shoulders are at the waterline and head stays clear
  const bob = Math.sin(timeSec * 2.8) * 0.065;
  return {
    posture: 'swimming',
    depth,
    waterSurfaceY: waterLevel,
    swimFloatY: waterLevel - 1.04 + bob,
    buoyantBobY: bob,
    speedMultiplier: 0.54,
    turnResponsiveness: 0.62,
    dodgeScale: 0.84, // Swim Surge burst
    canHeavyMelee: false,
    staminaRegenMultiplier: 0.65,
  };
}

/**
 * Computes exact finite-difference terrain gradient and slope magnitude at (x, z).
 */
export function sampleTerrainSlope(
  heightAt: (x: number, z: number) => number,
  x: number,
  z: number,
  eps = 0.65,
): TerrainSlopeInfo {
  const hL = heightAt(x - eps, z);
  const hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps);
  const hU = heightAt(x, z + eps);
  const gradX = (hR - hL) / (2 * eps);
  const gradZ = (hU - hD) / (2 * eps);
  const slope = Math.hypot(gradX, gradZ);
  return {
    gradX,
    gradZ,
    slope,
    climbable: slope <= MAX_CLIMBABLE_SLOPE,
    steepnessRatio: Math.min(1, slope / MAX_CLIMBABLE_SLOPE),
  };
}

/**
 * Resolves a character or creature horizontal movement step against integrated mountain terrain:
 * - On climbable foothills & mountain ridges (slope <= MAX_CLIMBABLE_SLOPE), allows smooth hiking UP
 *   into mountain ranges with realistic uphill resistance and brisk downhill stride.
 * - On sheer cliff crags (slope > MAX_CLIMBABLE_SLOPE when moving uphill), prevents clipping through
 *   or walking vertically up sheer rock walls by projecting motion smoothly along the contour tangent.
 */
export function resolveTerrainSlopeStep(
  heightAt: (x: number, z: number) => number,
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
): SlopeStepResolution {
  const dx = nextX - prevX;
  const dz = nextZ - prevZ;
  const stepDist = Math.hypot(dx, dz);
  if (stepDist < 1e-5) {
    const info = sampleTerrainSlope(heightAt, prevX, prevZ);
    return {
      x: nextX,
      z: nextZ,
      slope: info.slope,
      blockedByCliff: false,
      slopeSpeedFactor: 1.0,
    };
  }

  const hPrev = heightAt(prevX, prevZ);
  const hNext = heightAt(nextX, nextZ);
  const stepGrade = (hNext - hPrev) / stepDist;
  const targetSlope = sampleTerrainSlope(heightAt, nextX, nextZ);

  // Moving downhill or level is always permitted (so characters can descend safely off ridges)
  if (stepGrade <= 0.04) {
    const downhillBoost = stepGrade < -0.18 ? 1.08 : 1.0;
    return {
      x: nextX,
      z: nextZ,
      slope: targetSlope.slope,
      blockedByCliff: false,
      slopeSpeedFactor: downhillBoost,
    };
  }

  // Sheer cliff wall check: prevent walking straight into/through un-climbable vertical crags
  if (targetSlope.slope > MAX_CLIMBABLE_SLOPE && stepGrade > MAX_CLIMBABLE_SLOPE * 0.85) {
    const gLen = Math.hypot(targetSlope.gradX, targetSlope.gradZ) || 1;
    // Unit uphill normal
    const ux = targetSlope.gradX / gLen;
    const uz = targetSlope.gradZ / gLen;
    const uphillDot = dx * ux + dz * uz;
    if (uphillDot > 0) {
      // Remove the uphill component so the player slides cleanly around the mountain face along the contour
      const slideX = prevX + (dx - ux * uphillDot);
      const slideZ = prevZ + (dz - uz * uphillDot);
      const slideGrade = (heightAt(slideX, slideZ) - hPrev) / Math.max(0.05, Math.hypot(slideX - prevX, slideZ - prevZ));
      if (slideGrade <= MAX_CLIMBABLE_SLOPE) {
        return {
          x: slideX,
          z: slideZ,
          slope: targetSlope.slope,
          blockedByCliff: true,
          slopeSpeedFactor: 0.72,
        };
      }
      return {
        x: prevX,
        z: prevZ,
        slope: targetSlope.slope,
        blockedByCliff: true,
        slopeSpeedFactor: 0.0,
      };
    }
  }

  // Walkable uphill mountain slope: modulate speed smoothly by incline so climbing feels tactile
  const climbT = Math.max(0, Math.min(1, stepGrade / MAX_CLIMBABLE_SLOPE));
  const uphillFactor = 1.0 - climbT * 0.34; // 1.0 on flat -> 0.66 on steep climbable ridge
  const adjustedX = prevX + dx * uphillFactor;
  const adjustedZ = prevZ + dz * uphillFactor;
  return {
    x: adjustedX,
    z: adjustedZ,
    slope: targetSlope.slope,
    blockedByCliff: false,
    slopeSpeedFactor: uphillFactor,
  };
}

/**
 * Generates terrain-clipped water tiles directly from the realm's exact terrain elevation field.
 * Only emits tiles where terrain dips below `waterLevel`, guaranteeing water NEVER floats above
 * dry land and NEVER cuts off abruptly in mid-air.
 */
export function sampleTerrainClippedWaterQuads(
  spec: FrontiersRealmSpec,
  halfExtent = 104,
  cellSize = 4,
): WaterQuadTile[] {
  if (spec.isDungeon) return [];

  const waterY = spec.terrainProfile.waterLevel;
  const count = Math.floor((halfExtent * 2) / cellSize);
  const cols = count + 1;
  const heights = new Float32Array(cols * cols);

  for (let iz = 0; iz <= count; iz++) {
    const z = -halfExtent + iz * cellSize;
    for (let ix = 0; ix <= count; ix++) {
      const x = -halfExtent + ix * cellSize;
      heights[iz * cols + ix] = realmTerrainHeightAt(spec, x, z);
    }
  }

  const tiles: WaterQuadTile[] = [];
  for (let iz = 0; iz < count; iz++) {
    const z0 = -halfExtent + iz * cellSize;
    const z1 = z0 + cellSize;
    for (let ix = 0; ix < count; ix++) {
      const x0 = -halfExtent + ix * cellSize;
      const x1 = x0 + cellSize;
      const h00 = heights[iz * cols + ix];
      const h10 = heights[iz * cols + ix + 1];
      const h01 = heights[(iz + 1) * cols + ix];
      const h11 = heights[(iz + 1) * cols + ix + 1];

      const minH = Math.min(h00, h10, h01, h11);
      const maxH = Math.max(h00, h10, h01, h11);

      // Only emit water where terrain actually forms a submerged channel/basin!
      if (minH >= waterY - 0.02) continue;

      const d00 = Math.max(0, waterY - h00);
      const d10 = Math.max(0, waterY - h10);
      const d01 = Math.max(0, waterY - h01);
      const d11 = Math.max(0, waterY - h11);
      const avgDepth = (d00 + d10 + d01 + d11) * 0.25;
      const isShoreline = maxH >= waterY - 0.14;

      tiles.push({
        x0,
        z0,
        x1,
        z1,
        y: waterY,
        avgDepth,
        isShoreline,
      });
    }
  }

  return tiles;
}
