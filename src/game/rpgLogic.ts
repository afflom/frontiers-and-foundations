import type { GameQuest, GearDefinition, QuestObjectiveKind } from './worldData';

export type EnemyArchetype =
  | 'stalker'
  | 'shardcaster'
  | 'colossus'
  | 'charger'
  | 'hexweaver'
  | 'skirmisher';

export type EnemyState = 'idle' | 'approach' | 'orbit' | 'telegraph' | 'attack' | 'recover' | 'ko';

export interface EnemyEntity {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  stateTimer: number;
  orbitSign: 1 | -1;
  hitFlashTimer: number;
  koTimer: number;
  attackDamage: number;
  attackRadius: number;
  moveSpeed: number;
  aggroRadius: number;
  preferredRange: number;
  telegraphDuration: number;
  hasAttackToken: boolean;
  phase2?: boolean;
  slowTimer?: number;
}

export interface ProjectileEntity {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  life: number;
  fromEnemy: boolean;
}

export interface BossSignatureCastEvent {
  enemyId: string;
  x: number;
  z: number;
  title: string;
  rgb: [number, number, number];
}

export interface EnemyStepEvents {
  playerDamaged: number;
  spawnedProjectiles: ProjectileEntity[];
  telegraphStartedIds: string[];
  heavySlamPositions: Array<[number, number]>;
  bossPhase2TriggeredIds: string[];
  bossSignatureCasts: BossSignatureCastEvent[];
}

export interface PlayerAttackResult {
  hitEnemyIds: string[];
  killedEnemyIds: string[];
  hitstopSec: number;
  cameraTrauma: number;
  knockbacks: Array<{ enemyId: string; kx: number; kz: number }>;
}

export const MAX_CONCURRENT_ATTACKERS = 2;

export function createInitialEnemies(): EnemyEntity[] {
  return [
    {
      id: 'enemy-stalker-1',
      name: 'Shale-Husk Stalker',
      archetype: 'stalker',
      x: 21,
      z: 27,
      homeX: 22,
      homeZ: 26,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 65,
      maxHp: 65,
      state: 'idle',
      stateTimer: 0,
      orbitSign: 1,
      hitFlashTimer: 0,
      koTimer: 0,
      attackDamage: 14,
      attackRadius: 2.7,
      moveSpeed: 6.4,
      aggroRadius: 17,
      preferredRange: 4.5,
      telegraphDuration: 0.48,
      hasAttackToken: false,
    },
    {
      id: 'enemy-stalker-2',
      name: 'Salt-Reef Stalker',
      archetype: 'stalker',
      x: 29,
      z: 19,
      homeX: 28,
      homeZ: 20,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 65,
      maxHp: 65,
      state: 'idle',
      stateTimer: 0,
      orbitSign: -1,
      hitFlashTimer: 0,
      koTimer: 0,
      attackDamage: 14,
      attackRadius: 2.7,
      moveSpeed: 6.4,
      aggroRadius: 17,
      preferredRange: 4.5,
      telegraphDuration: 0.48,
      hasAttackToken: false,
    },
    {
      id: 'enemy-shard-1',
      name: 'Cinder-Glass Shardcaster',
      archetype: 'shardcaster',
      x: 29,
      z: -10,
      homeX: 28,
      homeZ: -10,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 55,
      maxHp: 55,
      state: 'idle',
      stateTimer: 0,
      orbitSign: 1,
      hitFlashTimer: 0,
      koTimer: 0,
      attackDamage: 16,
      attackRadius: 1.4,
      moveSpeed: 4.6,
      aggroRadius: 20,
      preferredRange: 13.0,
      telegraphDuration: 0.65,
      hasAttackToken: false,
    },
    {
      id: 'enemy-shard-2',
      name: 'Amber-Ridge Shardcaster',
      archetype: 'shardcaster',
      x: -22,
      z: -15,
      homeX: -22,
      homeZ: -15,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 55,
      maxHp: 55,
      state: 'idle',
      stateTimer: 0,
      orbitSign: -1,
      hitFlashTimer: 0,
      koTimer: 0,
      attackDamage: 16,
      attackRadius: 1.4,
      moveSpeed: 4.6,
      aggroRadius: 20,
      preferredRange: 13.0,
      telegraphDuration: 0.65,
      hasAttackToken: false,
    },
    {
      id: 'enemy-colossus-1',
      name: 'Basalt Tide-Colossus',
      archetype: 'colossus',
      x: -31,
      z: -14,
      homeX: -31,
      homeZ: -14,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 165,
      maxHp: 165,
      state: 'idle',
      stateTimer: 0,
      orbitSign: 1,
      hitFlashTimer: 0,
      koTimer: 0,
      attackDamage: 26,
      attackRadius: 4.8,
      moveSpeed: 3.7,
      aggroRadius: 20,
      preferredRange: 4.2,
      telegraphDuration: 0.78,
      hasAttackToken: false,
    },
  ];
}

/**
 * Multi-knob difficulty multiplier scaling enemy toughness and aggression slightly
 * as the Waywright completes quests, while keeping the opening approachable.
 */
export function computeDifficultyMultiplier(completedQuests: number): {
  speedScale: number;
  damageScale: number;
  tokenBudget: number;
} {
  const tier = Math.max(0, Math.min(5, completedQuests));
  return {
    speedScale: 1 + tier * 0.05,
    damageScale: 1 + tier * 0.08,
    tokenBudget: Math.min(3, MAX_CONCURRENT_ATTACKERS + (tier >= 3 ? 1 : 0)),
  };
}

export interface FaunaCombatProfile {
  speedMult: number;
  damageMult: number;
  telegraphMult: number;
  regenPerSec: number;
}

export const FAUNA_COMBAT_PROFILES: Record<string, FaunaCombatProfile> = {
  'highland-ironclad': { speedMult: 1.0, damageMult: 1.0, telegraphMult: 1.0, regenPerSec: 0 },
  'verdant-mycelial': { speedMult: 0.92, damageMult: 0.94, telegraphMult: 1.08, regenPerSec: 1.4 },
  'pyroclastic-forge': { speedMult: 1.12, damageMult: 1.16, telegraphMult: 0.9, regenPerSec: 0 },
  'pelagic-abyssal': { speedMult: 1.18, damageMult: 0.96, telegraphMult: 0.94, regenPerSec: 0.4 },
  'dune-sandstrider': { speedMult: 1.22, damageMult: 1.04, telegraphMult: 0.88, regenPerSec: 0 },
  'glacial-frostborn': { speedMult: 0.95, damageMult: 1.14, telegraphMult: 1.12, regenPerSec: 0 },
};

export interface BossSignatureProfile {
  archetypeTitle: string;
  phase2Title: string;
  signatureMoveName: string;
  projectilePattern: 'radial' | 'fan' | 'charge-fan';
  projectileCount: number;
  projectileSpeed: number;
  slamRadiusBonus: number;
  phase2HealBurst: number;
  phase2SpeedBoost: number;
  phase2TelegraphMult: number;
  auraRgb: [number, number, number];
}

export const BOSS_SIGNATURE_PROFILES: Record<string, BossSignatureProfile> = {
  'highland-ironclad': {
    archetypeTitle: 'Basalt Meridian Warden',
    phase2Title: 'Overcharged Foundry Core',
    signatureMoveName: 'Seismic Basalt Quake',
    projectilePattern: 'radial',
    projectileCount: 4,
    projectileSpeed: 12.8,
    slamRadiusBonus: 1.5,
    phase2HealBurst: 0,
    phase2SpeedBoost: 1.15,
    phase2TelegraphMult: 0.86,
    auraRgb: [0.96, 0.62, 0.22],
  },
  'verdant-mycelial': {
    archetypeTitle: 'Canopy Treant Sovereign',
    phase2Title: 'Luminous Spore Awakening',
    signatureMoveName: 'Mycelial Spore Bloom',
    projectilePattern: 'radial',
    projectileCount: 5,
    projectileSpeed: 10.6,
    slamRadiusBonus: 0.9,
    phase2HealBurst: 18,
    phase2SpeedBoost: 1.12,
    phase2TelegraphMult: 0.9,
    auraRgb: [0.32, 0.96, 0.58],
  },
  'pyroclastic-forge': {
    archetypeTitle: 'Caldera Furnace Titan',
    phase2Title: 'Molten Crucible Breach',
    signatureMoveName: 'Caldera Magma Barrage',
    projectilePattern: 'radial',
    projectileCount: 6,
    projectileSpeed: 13.8,
    slamRadiusBonus: 1.2,
    phase2HealBurst: 0,
    phase2SpeedBoost: 1.18,
    phase2TelegraphMult: 0.82,
    auraRgb: [0.98, 0.36, 0.1],
  },
  'pelagic-abyssal': {
    archetypeTitle: 'Reef-Spire Leviathan',
    phase2Title: 'Abyssal Undertow Surge',
    signatureMoveName: 'Maelstrom Tide Volley',
    projectilePattern: 'fan',
    projectileCount: 5,
    projectileSpeed: 14.2,
    slamRadiusBonus: 1.0,
    phase2HealBurst: 10,
    phase2SpeedBoost: 1.2,
    phase2TelegraphMult: 0.85,
    auraRgb: [0.24, 0.92, 0.94],
  },
  'dune-sandstrider': {
    archetypeTitle: 'Sun-Disk Sandstone Colossus',
    phase2Title: 'Solar Zenith Overdrive',
    signatureMoveName: 'Mirage Sun-Lance Charge',
    projectilePattern: 'charge-fan',
    projectileCount: 3,
    projectileSpeed: 16.0,
    slamRadiusBonus: 1.1,
    phase2HealBurst: 0,
    phase2SpeedBoost: 1.28,
    phase2TelegraphMult: 0.8,
    auraRgb: [0.98, 0.78, 0.24],
  },
  'glacial-frostborn': {
    archetypeTitle: 'Aurora Obelisk Sovereign',
    phase2Title: 'Permafrost Prism Resonance',
    signatureMoveName: 'Frostglass Prism Fan',
    projectilePattern: 'fan',
    projectileCount: 5,
    projectileSpeed: 13.5,
    slamRadiusBonus: 1.4,
    phase2HealBurst: 0,
    phase2SpeedBoost: 1.12,
    phase2TelegraphMult: 0.88,
    auraRgb: [0.46, 0.92, 0.99],
  },
};

export function getBossSignatureProfile(faunaKit: string): BossSignatureProfile {
  return BOSS_SIGNATURE_PROFILES[faunaKit] ?? BOSS_SIGNATURE_PROFILES['highland-ironclad'];
}

/**
 * Steps all 3 distinct enemy behavior policies with attack token pooling, telegraphed strikes,
 * bespoke ecosystem fauna combat profiles, and Apex Colossus Phase-2 signature encounters!
 */
export function stepEnemies(
  enemies: EnemyEntity[],
  playerX: number,
  playerZ: number,
  playerInvuln: boolean,
  dt: number,
  completedQuests = 0,
  faunaKit = 'highland-ironclad',
): EnemyStepEvents {
  const events: EnemyStepEvents = {
    playerDamaged: 0,
    spawnedProjectiles: [],
    telegraphStartedIds: [],
    heavySlamPositions: [],
    bossPhase2TriggeredIds: [],
    bossSignatureCasts: [],
  };

  const diff = computeDifficultyMultiplier(completedQuests);
  const fProf = FAUNA_COMBAT_PROFILES[faunaKit] ?? FAUNA_COMBAT_PROFILES['highland-ironclad'];
  const bossProf = getBossSignatureProfile(faunaKit);
  let activeTokens = enemies.filter((e) => e.hasAttackToken && e.state !== 'ko').length;

  for (const e of enemies) {
    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    }
    if (e.slowTimer && e.slowTimer > 0) {
      e.slowTimer = Math.max(0, e.slowTimer - dt);
    }

    if (e.state === 'ko') {
      e.koTimer = Math.max(0, e.koTimer - dt);
      e.hasAttackToken = false;
      continue;
    }

    // Apex Colossus Phase-2 Awakening at <= 50% Vitality
    if (e.archetype === 'colossus' && !e.phase2 && e.hp > 0 && e.hp <= e.maxHp * 0.5) {
      e.phase2 = true;
      events.bossPhase2TriggeredIds.push(e.id);
      if (bossProf.phase2HealBurst > 0) {
        e.hp = Math.min(e.maxHp, e.hp + bossProf.phase2HealBurst);
      }
      events.bossSignatureCasts.push({
        enemyId: e.id,
        x: e.x,
        z: e.z,
        title: bossProf.phase2Title,
        rgb: bossProf.auraRgb,
      });
    }

    // Mycelial/aquatic fauna gently regenerate vitality if left unpressured
    if (fProf.regenPerSec > 0 && e.hp > 0 && e.hp < e.maxHp && e.hitFlashTimer <= 0) {
      e.hp = Math.min(e.maxHp, e.hp + fProf.regenPerSec * dt);
    }

    // Apply decaying knockback velocity
    e.x += e.vx * dt;
    e.z += e.vz * dt;
    const damp = Math.exp(-9 * dt);
    e.vx *= damp;
    e.vz *= damp;

    const dx = playerX - e.x;
    const dz = playerZ - e.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const dirX = dx / dist;
    const dirZ = dz / dist;

    if (dist > e.aggroRadius * 1.45 && e.state !== 'telegraph' && e.state !== 'attack') {
      e.state = 'idle';
      e.hasAttackToken = false;
      const hx = e.homeX - e.x;
      const hz = e.homeZ - e.z;
      const hDist = Math.hypot(hx, hz);
      if (hDist > 0.6) {
        e.x += (hx / hDist) * e.moveSpeed * 0.45 * dt;
        e.z += (hz / hDist) * e.moveSpeed * 0.45 * dt;
        e.yaw = Math.atan2(hx, hz);
      }
      continue;
    }

    e.yaw = Math.atan2(dirX, dirZ);
    const slowMult = e.slowTimer && e.slowTimer > 0 ? 0.52 : 1.0;
    const bossBoost = e.archetype === 'colossus' && e.phase2 ? bossProf.phase2SpeedBoost : 1.0;
    const moveSpd = e.moveSpeed * diff.speedScale * fProf.speedMult * slowMult * bossBoost;

    if (e.state === 'idle') {
      if (dist <= e.aggroRadius) {
        e.state = e.archetype === 'stalker' || e.archetype === 'skirmisher' ? 'orbit' : 'approach';
        e.stateTimer = 0.7 * fProf.telegraphMult;
      }
      continue;
    }

    if (e.state === 'recover') {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = e.archetype === 'stalker' || e.archetype === 'skirmisher' ? 'orbit' : 'approach';
        e.stateTimer = e.archetype === 'colossus' && e.phase2 ? 0.42 : e.archetype === 'skirmisher' ? 0.44 : 0.6;
      }
      continue;
    }

    if (e.state === 'telegraph') {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = 'attack';
        e.stateTimer = e.archetype === 'charger' ? 0.34 : 0.22;

        if (e.archetype === 'shardcaster') {
          events.spawnedProjectiles.push({
            id: `proj-${e.id}-${Date.now()}-${Math.round(Math.random() * 999)}`,
            x: e.x + dirX * 1.0,
            y: 1.6,
            z: e.z + dirZ * 1.0,
            vx: dirX * 15.5,
            vz: dirZ * 15.5,
            damage: Math.round(e.attackDamage * diff.damageScale * fProf.damageMult),
            life: 2.6,
            fromEnemy: true,
          });
        } else if (e.archetype === 'hexweaver') {
          // Area-denial 3-bolt harmonic fan spread forcing lateral evasion
          const baseAng = Math.atan2(dirX, dirZ);
          const dmg = Math.round(e.attackDamage * 0.78 * diff.damageScale * fProf.damageMult);
          for (let hi = -1; hi <= 1; hi++) {
            const ang = baseAng + hi * 0.28;
            const hx = Math.sin(ang);
            const hz = Math.cos(ang);
            events.spawnedProjectiles.push({
              id: `hex-${e.id}-${Date.now()}-${hi + 1}-${Math.round(Math.random() * 999)}`,
              x: e.x + hx * 1.1,
              y: 1.5,
              z: e.z + hz * 1.1,
              vx: hx * 12.6,
              vz: hz * 12.6,
              damage: dmg,
              life: 2.7,
              fromEnemy: true,
            });
          }
        } else {
          // Melee / Rush archetypes: stalker, skirmisher, charger, or Apex Colossus
          let effectiveAttackRadius = e.attackRadius;
          if (e.archetype === 'stalker') {
            e.vx += dirX * 11.5 * slowMult;
            e.vz += dirZ * 11.5 * slowMult;
          } else if (e.archetype === 'charger') {
            // High-momentum bull-rush slam straight along line of sight
            e.vx += dirX * 18.8 * slowMult;
            e.vz += dirZ * 18.8 * slowMult;
            effectiveAttackRadius += 0.7;
            events.heavySlamPositions.push([e.x + dirX * 2.2, e.z + dirZ * 2.2]);
          } else if (e.archetype === 'skirmisher') {
            // Agile dart-in slash immediately followed by an evasive backstep spring
            e.vx += dirX * 9.0 * slowMult;
            e.vz += dirZ * 9.0 * slowMult;
          } else if (e.archetype === 'colossus') {
            events.heavySlamPositions.push([e.x, e.z]);
            if (e.phase2) {
              effectiveAttackRadius += bossProf.slamRadiusBonus;
              events.bossSignatureCasts.push({
                enemyId: e.id,
                x: e.x,
                z: e.z,
                title: bossProf.signatureMoveName,
                rgb: bossProf.auraRgb,
              });
              const baseAngle = Math.atan2(dirX, dirZ);
              const count = bossProf.projectileCount;
              const projDmg = Math.round(e.attackDamage * 0.65 * diff.damageScale * fProf.damageMult);
              if (bossProf.projectilePattern === 'charge-fan') {
                e.vx += dirX * 14.0 * slowMult;
                e.vz += dirZ * 14.0 * slowMult;
              }
              for (let pi = 0; pi < count; pi++) {
                const ang =
                  bossProf.projectilePattern === 'radial'
                    ? baseAngle + (pi * Math.PI * 2) / count
                    : baseAngle + (pi - (count - 1) / 2) * 0.28;
                const px = Math.sin(ang);
                const pz = Math.cos(ang);
                events.spawnedProjectiles.push({
                  id: `boss-proj-${e.id}-${Date.now()}-${pi}-${Math.round(Math.random() * 999)}`,
                  x: e.x + px * 1.4,
                  y: 1.55,
                  z: e.z + pz * 1.4,
                  vx: px * bossProf.projectileSpeed,
                  vz: pz * bossProf.projectileSpeed,
                  damage: projDmg,
                  life: 2.5,
                  fromEnemy: true,
                });
              }
            }
          }
          if (!playerInvuln && dist <= effectiveAttackRadius + 0.85) {
            events.playerDamaged += Math.round(e.attackDamage * diff.damageScale * fProf.damageMult);
          }
          if (e.archetype === 'skirmisher') {
            // Backstep spring out of immediate counter-cleave range
            e.vx -= dirX * 10.5 * slowMult;
            e.vz -= dirZ * 10.5 * slowMult;
            e.orbitSign = e.orbitSign === 1 ? -1 : 1;
          }
        }
      }
      continue;
    }

    if (e.state === 'attack') {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = 'recover';
        const baseRec =
          e.archetype === 'colossus'
            ? e.phase2
              ? 0.85
              : 1.15
            : e.archetype === 'charger'
              ? 1.05
              : e.archetype === 'skirmisher'
                ? 0.55
                : 0.75;
        e.stateTimer = baseRec * (e.slowTimer && e.slowTimer > 0 ? 1.35 : 1.0);
        if (e.hasAttackToken) {
          e.hasAttackToken = false;
          activeTokens = Math.max(0, activeTokens - 1);
        }
      }
      continue;
    }

    // Distinct movement policies per archetype (all 6 tactical roles)
    if (e.archetype === 'stalker') {
      // Flanker / Orbiter policy: strafe tangentially while closing to flank distance
      const perpX = -dirZ * e.orbitSign;
      const perpZ = dirX * e.orbitSign;
      const radialPush = dist > e.preferredRange ? 0.65 : dist < 2.6 ? -0.35 : 0.1;
      const mx = perpX * 0.85 + dirX * radialPush;
      const mz = perpZ * 0.85 + dirZ * radialPush;
      const mLen = Math.hypot(mx, mz) || 1;
      e.x += (mx / mLen) * moveSpd * dt;
      e.z += (mz / mLen) * moveSpd * dt;

      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= e.preferredRange + 1.4 && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration;
        events.telegraphStartedIds.push(e.id);
      }
    } else if (e.archetype === 'skirmisher') {
      // Fast hit-and-run ambusher: wide aggressive weave then sudden close-in slash
      const perpX = -dirZ * e.orbitSign;
      const perpZ = dirX * e.orbitSign;
      const closeBias = dist > 4.2 ? 0.92 : 0.25;
      const mx = perpX * 0.68 + dirX * closeBias;
      const mz = perpZ * 0.68 + dirZ * closeBias;
      const mLen = Math.hypot(mx, mz) || 1;
      e.x += (mx / mLen) * moveSpd * 1.16 * dt;
      e.z += (mz / mLen) * moveSpd * 1.16 * dt;

      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= 4.4 && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration * 0.82;
        events.telegraphStartedIds.push(e.id);
      }
    } else if (e.archetype === 'charger') {
      // Armored bull-rush bruiser: squares up at mid-range then launches a telegraphed straight rush
      if (dist > 8.5) {
        e.x += dirX * moveSpd * 0.88 * dt;
        e.z += dirZ * moveSpd * 0.88 * dt;
      } else if (dist < 4.0) {
        e.x -= dirX * moveSpd * 0.4 * dt;
        e.z -= dirZ * moveSpd * 0.4 * dt;
      } else {
        const perpX = -dirZ * e.orbitSign;
        const perpZ = dirX * e.orbitSign;
        e.x += perpX * moveSpd * 0.35 * dt;
        e.z += perpZ * moveSpd * 0.35 * dt;
      }

      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= 11.5 && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration;
        events.telegraphStartedIds.push(e.id);
      }
    } else if (e.archetype === 'hexweaver') {
      // Area-denial tactical caster: orbits at 10-14m and fires 3-bolt harmonic fan spreads
      if (dist < 8.5) {
        e.x -= dirX * moveSpd * 0.82 * dt;
        e.z -= dirZ * moveSpd * 0.82 * dt;
      } else if (dist > 15.0) {
        e.x += dirX * moveSpd * 0.72 * dt;
        e.z += dirZ * moveSpd * 0.72 * dt;
      } else {
        const perpX = -dirZ * e.orbitSign;
        const perpZ = dirX * e.orbitSign;
        e.x += perpX * moveSpd * 0.65 * dt;
        e.z += perpZ * moveSpd * 0.65 * dt;
      }

      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= 17.5 && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration;
        events.telegraphStartedIds.push(e.id);
      }
    } else if (e.archetype === 'shardcaster') {
      // Kiter / Ranged policy: retreat if player closes under 8m, advance if > 16m, strafe otherwise
      if (dist < 8.0) {
        e.x -= dirX * moveSpd * 0.9 * dt;
        e.z -= dirZ * moveSpd * 0.9 * dt;
      } else if (dist > 16.5) {
        e.x += dirX * moveSpd * 0.75 * dt;
        e.z += dirZ * moveSpd * 0.75 * dt;
      } else {
        const perpX = -dirZ * e.orbitSign;
        const perpZ = dirX * e.orbitSign;
        e.x += perpX * moveSpd * 0.45 * dt;
        e.z += perpZ * moveSpd * 0.45 * dt;
      }

      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= 18.5 && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration;
        events.telegraphStartedIds.push(e.id);
      }
    } else {
      // Colossus: Heavy line-of-sight charger & bespoke ecosystem Apex Sentinel
      const engageRange = e.phase2 ? e.attackRadius + 3.2 : e.attackRadius + 0.5;
      if (dist > e.preferredRange - 0.6) {
        e.x += dirX * moveSpd * dt;
        e.z += dirZ * moveSpd * dt;
      }
      e.stateTimer -= dt;
      if (e.stateTimer <= 0 && dist <= engageRange && activeTokens < diff.tokenBudget) {
        e.hasAttackToken = true;
        activeTokens += 1;
        e.state = 'telegraph';
        e.stateTimer = e.telegraphDuration * (e.phase2 ? bossProf.phase2TelegraphMult : 1.0);
        events.telegraphStartedIds.push(e.id);
      }
    }
  }

  return events;
}

/**
 * Resolves melee cleave (Hookblade) or 360-degree resonance shockwave (Bell-Hammer) against enemies.
 */
export function resolvePlayerAttack(
  playerX: number,
  playerZ: number,
  playerYaw: number,
  gear: GearDefinition,
  enemies: EnemyEntity[],
): PlayerAttackResult {
  const hitEnemyIds: string[] = [];
  const killedEnemyIds: string[] = [];
  const knockbacks: Array<{ enemyId: string; kx: number; kz: number }> = [];

  if (gear.damage <= 0) {
    return { hitEnemyIds, killedEnemyIds, hitstopSec: 0, cameraTrauma: 0, knockbacks };
  }

  const forwardX = Math.sin(playerYaw);
  const forwardZ = Math.cos(playerYaw);
  const isRadial = gear.id === 'bellhammer';

  for (const e of enemies) {
    if (e.state === 'ko' || e.hp <= 0) continue;
    const dx = e.x - playerX;
    const dz = e.z - playerZ;
    const dist = Math.hypot(dx, dz) || 0.0001;
    if (dist > gear.range) continue;

    if (!isRadial) {
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;
      if (dot < 0.15 && dist > 1.5) continue;
    }

    e.hp = Math.max(0, e.hp - gear.damage);
    e.hitFlashTimer = 0.08;
    const impulse = isRadial ? 12.5 : 6.8;
    const kx = (dx / dist) * impulse;
    const kz = (dz / dist) * impulse;
    e.vx += kx;
    e.vz += kz;
    knockbacks.push({ enemyId: e.id, kx, kz });
    hitEnemyIds.push(e.id);

    if (e.hp <= 0) {
      e.state = 'ko';
      e.koTimer = 0.45;
      e.hasAttackToken = false;
      killedEnemyIds.push(e.id);
    }
  }

  const hitstopSec =
    killedEnemyIds.length > 0 ? 0.065 : hitEnemyIds.length > 0 ? (isRadial ? 0.055 : 0.035) : 0;
  const cameraTrauma =
    killedEnemyIds.length > 0 ? 0.52 : hitEnemyIds.length > 0 ? (isRadial ? 0.42 : 0.22) : isRadial ? 0.26 : 0;

  return { hitEnemyIds, killedEnemyIds, hitstopSec, cameraTrauma, knockbacks };
}

/**
 * Pure quest progression reducer: increments matching active objectives and marks quests completed.
 */
export function advanceQuests(
  quests: GameQuest[],
  kind: QuestObjectiveKind,
  targetId: string,
  amount = 1,
): { quests: GameQuest[]; newlyCompleted: GameQuest[]; progressed: boolean } {
  let progressed = false;
  const newlyCompleted: GameQuest[] = [];

  const updated = quests.map((q) => {
    if (q.status === 'completed') return q;
    let changed = false;
    const nextObjectives = q.objectives.map((obj) => {
      if (obj.currentCount >= obj.requiredCount) return obj;
      const matches = obj.kind === kind && (obj.targetId === targetId || obj.targetId === 'any');
      if (!matches) return obj;
      changed = true;
      progressed = true;
      return {
        ...obj,
        currentCount: Math.min(obj.requiredCount, obj.currentCount + amount),
      };
    });

    if (!changed) return q;
    const allDone = nextObjectives.every((o) => o.currentCount >= o.requiredCount);
    const nextQuest: GameQuest = {
      ...q,
      objectives: nextObjectives,
      status: allDone ? 'completed' : 'active',
    };
    if (allDone) {
      newlyCompleted.push(nextQuest);
    }
    return nextQuest;
  });

  return { quests: updated, newlyCompleted, progressed };
}

/**
 * Apply player damage cleanly without any hidden invulnerability HP floor.
 */
export function applyPlayerDamage(currentHp: number, incomingDamage: number): {
  nextHp: number;
  defeated: boolean;
} {
  const nextHp = Math.max(0, currentHp - Math.max(0, incomingDamage));
  return { nextHp, defeated: nextHp <= 0 };
}
