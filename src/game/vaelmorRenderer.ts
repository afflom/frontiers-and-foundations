import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GEAR_LOADOUT,
  getRegionAt,
  type FoundationBanner,
  type GameNpc,
  type GamePhase,
  type GearSlotId,
  type WorldInteractable,
  type WorldRegion,
} from './worldData';
import {
  resolvePlayerAttack,
  stepEnemies,
  type EnemyArchetype,
  type EnemyEntity,
  type ProjectileEntity,
} from './rpgLogic';
import type {
  ComputedCombatStats,
  ProjectedAllyScreenPos,
  RemotePlayerState,
} from './multiplayerTypes';

export interface ProximityPrompt {
  kind: 'npc' | 'interactable';
  id: string;
  label: string;
  sublabel: string;
  distance: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  region: WorldRegion;
  activeGear: GearSlotId;
  cooldowns: Record<GearSlotId, number>;
  proximity: ProximityPrompt | null;
  nearbyEnemies: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    archetype: EnemyArchetype;
    phase2?: boolean;
    bossTitle?: string;
    signatureMove?: string;
  }>;
  defeatedCount: number;
  waterPosture?: 'dry' | 'wading' | 'swimming';
  projectedAllies?: ProjectedAllyScreenPos[];
  ecosystemBadge?: {
    title: string;
    summary: string;
    layoutTitle: string;
  };
}

export interface EngineCallbacks {
  onHudUpdate: (snap: HudSnapshot) => void;
  onInteractNpc: (npcId: string) => void;
  onActivateInteractable: (item: WorldInteractable) => void;
  onEnemyDefeated: (archetype: EnemyArchetype, name: string) => void;
  onEnemyDamaged?: (payload: {
    enemyId: string;
    enemyName: string;
    archetype: EnemyArchetype;
    damage: number;
    maxHp: number;
    killed: boolean;
  }) => void;
  onCoopLanternCast?: (amount: number, x: number, z: number) => void;
  onPlayerDamaged: (newHp: number, defeated: boolean) => void;
  onBannerPlanted: (x: number, z: number) => void;
  onGearFeedback: (message: string) => void;
  onPlayerAction?: (gear: GearSlotId, x?: number, z?: number, yaw?: number) => void;
  onCombatCallout?: (text: string, tone: 'damage' | 'heavy' | 'heal' | 'gold') => void;
  onAudioEvent: (
    event:
      | { kind: 'region'; mood: WorldRegion['ambientMood'] }
      | { kind: 'swing' }
      | { kind: 'bell'; hz: number }
      | { kind: 'hit'; heavy: boolean }
      | { kind: 'jump' }
      | { kind: 'heal' }
      | { kind: 'telegraph' }
      | { kind: 'defeat' },
  ) => void;
}

export function vaelmorHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  const macro =
    Math.sin(x * 0.065) * Math.cos(z * 0.06) * 2.6 +
    Math.sin(x * 0.14 + 0.8) * Math.sin(z * 0.13 - 0.5) * 0.9;

  // River gorge running east-west near z = 5
  const riverZ = 5.0 + Math.sin(x * 0.075) * 2.8;
  const gorgeDist = Math.abs(z - riverZ);
  const gorgeCut = Math.exp(-(gorgeDist * gorgeDist) / 26) * -4.6;

  // Coastal inlet in southeast (Salt Loom Coast)
  const coastDist = Math.hypot(x - 32, z - 30);
  const coastDip = Math.exp(-(coastDist * coastDist) / 240) * -2.2;

  // Citadel plateau at north center (0, -18)
  const citDist = Math.hypot(x, z + 18);
  const citLift = Math.exp(-(citDist * citDist) / 180) * 3.8;

  // Southern approach plateau around spawn (0, 17)
  const spawnDist = Math.hypot(x, z - 17);
  const spawnFlat = Math.exp(-(spawnDist * spawnDist) / 95);

  // Foundry basin west (-26, -6)
  const foundryDist = Math.hypot(x + 26, z + 6);
  const foundryFlat = Math.exp(-(foundryDist * foundryDist) / 110);

  // Scenic mountain perimeter outside 52m radius (gentle rolling foothills)
  const rim = dist > 52 ? Math.pow((dist - 52) * 0.095, 1.55) * 2.4 : 0;

  let h = macro + gorgeCut + coastDip + citLift + rim;
  h = THREE.MathUtils.lerp(h, 0.9, spawnFlat * 0.88);
  h = THREE.MathUtils.lerp(h, 0.6, foundryFlat * 0.78);

  // Smooth causeway corridor leading to the bridge
  if (Math.abs(x) < 4.2 && z > 10.5 && z < 26) {
    h = THREE.MathUtils.lerp(h, 0.95, 0.88);
  }
  return h;
}

export function surfaceHeightAt(x: number, z: number): number {
  if (Math.abs(x) < 2.85 && z > -3.4 && z < 13.4) {
    return 1.55; // Parabolic Causeway Bridge deck
  }
  return vaelmorHeightAt(x, z);
}

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createSkyDomeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1e324a');
  grad.addColorStop(0.28, '#3f5f7d');
  grad.addColorStop(0.47, '#899ca8');
  grad.addColorStop(0.56, '#dfba86');
  grad.addColorStop(0.68, '#7a7770');
  grad.addColorStop(1.0, '#2a3038');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStoneTexture(maxAniso: number): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 256;
  const col = document.createElement('canvas');
  col.width = size;
  col.height = size;
  const c = col.getContext('2d')!;

  const bmp = document.createElement('canvas');
  bmp.width = size;
  bmp.height = size;
  const b = bmp.getContext('2d')!;

  c.fillStyle = '#383d44';
  c.fillRect(0, 0, size, size);
  b.fillStyle = '#707070';
  b.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  const cols = 4;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (colW * 0.5);
    for (let x = -1; x <= cols; x++) {
      const bx = x * colW + off;
      const by = r * rowH;
      const v = 56 + ((r * 19 + x * 29) % 24);
      c.fillStyle = `rgb(${v + 4}, ${v + 3}, ${v + 5})`;
      c.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
      const bv = 150 + ((r * 13 + x * 11) % 60);
      b.fillStyle = `rgb(${bv},${bv},${bv})`;
      b.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
    }
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.anisotropy = maxAniso;

  const bump = new THREE.CanvasTexture(bmp);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3, 3);
  bump.anisotropy = maxAniso;

  return { map, bump };
}

function createContactShadowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.68)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createCloakedActor(
  cloakHex: number,
  trimHex: number,
  shadowTex: THREE.CanvasTexture,
  isPlayer = false,
): {
  root: THREE.Group;
  body: THREE.Group;
  weaponPivot: THREE.Group;
  weaponMeshes: Record<GearSlotId, THREE.Group>;
  slashArc: THREE.Mesh;
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 18),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.65 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const cloakMat = new THREE.MeshStandardMaterial({ color: cloakHex, roughness: 0.82, metalness: 0.08 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.28, metalness: 0.84 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.86, metalness: 0.08 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xcca486, roughness: 0.65, metalness: 0.04 });

  // Boots
  const bootGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.44, 8);
  const bL = new THREE.Mesh(bootGeo, leatherMat);
  bL.position.set(-0.16, 0.22, 0);
  const bR = new THREE.Mesh(bootGeo, leatherMat);
  bR.position.set(0.16, 0.22, 0);
  body.add(bL, bR);

  // Cloaked torso + belted tunic
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 1.12, 12), cloakMat);
  robe.position.y = 0.92;
  robe.castShadow = true;
  body.add(robe);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.14, 12), leatherMat);
  belt.position.y = 1.05;
  body.add(belt);

  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.44, 0.32, 12), cloakMat);
  mantle.position.y = 1.44;
  body.add(mantle);

  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), trimMat);
  clasp.position.set(0, 1.45, 0.35);
  body.add(clasp);

  // Head + hood
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMat);
  head.position.y = 1.74;
  body.add(head);

  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.64),
    cloakMat,
  );
  hood.position.set(0, 1.77, -0.03);
  body.add(hood);

  // Weapon pivot on right hand
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.45, 1.12, 0.16);
  body.add(weaponPivot);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xbac4ce, roughness: 0.26, metalness: 0.88 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffd27d,
    emissive: 0xd99636,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const tealGlowMat = new THREE.MeshStandardMaterial({
    color: 0x8ef0cc,
    emissive: 0x4ca88a,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  // 1. Lodestone Hookblade
  const hookblade = new THREE.Group();
  const hbHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.45, 8), leatherMat);
  const hbBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.14), steelMat);
  hbBlade.position.set(0, 0.62, 0.04);
  const hbHook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.24), steelMat);
  hbHook.position.set(0, 1.04, 0.14);
  hbHook.rotation.x = 0.55;
  const hbInlay = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat);
  hbInlay.position.set(0, 0.52, 0.06);
  hookblade.add(hbHilt, hbBlade, hbHook, hbInlay);
  hookblade.rotation.x = 0.45;
  weaponPivot.add(hookblade);

  // 2. Resonance Bell-Hammer
  const bellhammer = new THREE.Group();
  const bhHaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.25, 8), leatherMat);
  bhHaft.position.y = 0.4;
  const bhBell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.46, 12), trimMat);
  bhBell.position.y = 1.02;
  bhBell.rotation.x = Math.PI / 2;
  bellhammer.add(bhHaft, bhBell);
  bellhammer.rotation.x = 0.35;
  bellhammer.visible = false;
  weaponPivot.add(bellhammer);

  // 3. Kiln-Glass Mortar Lantern
  const lantern = new THREE.Group();
  const lCage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 6, 1, true), trimMat);
  const lCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), tealGlowMat);
  lantern.add(lCage, lCore);
  lantern.position.set(0, 0.05, 0.24);
  lantern.visible = false;
  weaponPivot.add(lantern);

  // 4. Brass Way-Compass
  const compass = new THREE.Group();
  const cRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 18), trimMat);
  const cNeedle = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat);
  compass.add(cRing, cNeedle);
  compass.position.set(0, 0.08, 0.28);
  compass.visible = false;
  weaponPivot.add(compass);

  // If NPC, give a standing surveyor staff instead
  if (!isPlayer) {
    hookblade.visible = false;
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 8), trimMat);
    staff.position.set(0.04, 0.0, 0);
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
    finial.position.set(0.04, 1.0, 0);
    weaponPivot.add(staff, finial);
  }

  // Visible cleave / resonance slash arc
  const slashArc = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 2.75, 22, 1, -Math.PI * 0.45, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({
      color: 0xffcf73,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  slashArc.rotation.x = -Math.PI / 2;
  slashArc.position.y = 1.1;
  root.add(slashArc);

  return {
    root,
    body,
    weaponPivot,
    weaponMeshes: { hookblade, bellhammer, lantern, compass },
    slashArc,
  };
}

function createEnemyMesh(
  archetype: EnemyArchetype,
  shadowTex: THREE.CanvasTexture,
): {
  root: THREE.Group;
  body: THREE.Group;
  telegraphRing: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const materials: THREE.MeshStandardMaterial[] = [];

  const shadowRadius = archetype === 'colossus' ? 1.95 : 0.9;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(shadowRadius, 18),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const ringRadius = archetype === 'colossus' ? 4.8 : archetype === 'stalker' ? 2.4 : 1.6;
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(ringRadius * 0.78, ringRadius, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff7c38,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.08;
  root.add(telegraphRing);

  if (archetype === 'stalker') {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x353c45, roughness: 0.72, metalness: 0.25 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff9a3c,
      emissive: 0xe66a1c,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    materials.push(shellMat, eyeMat);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.45), shellMat);
    torso.position.y = 0.78;
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 5), shellMat);
    ridge.rotation.x = -Math.PI * 0.35;
    ridge.position.set(0, 1.12, -0.2);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), shellMat);
    head.rotation.x = Math.PI * 0.5;
    head.position.set(0, 0.88, 0.85);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eyeL.position.set(-0.14, 0.94, 0.96);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    const legGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.65, 6);
    for (const [lx, lz] of [[-0.4, 0.45], [0.4, 0.45], [-0.4, -0.45], [0.4, -0.45]]) {
      const leg = new THREE.Mesh(legGeo, shellMat);
      leg.position.set(lx, 0.32, lz);
      body.add(leg);
    }
    body.add(torso, ridge, head, eyeL, eyeR);
  } else if (archetype === 'shardcaster') {
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x222731, roughness: 0.25, metalness: 0.65 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x9cf0d4,
      emissive: 0x3fa88f,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    materials.push(obsidianMat, crystalMat);

    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), obsidianMat);
    spire.scale.set(0.8, 1.9, 0.8);
    spire.position.y = 1.65;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), crystalMat);
    core.position.y = 1.65;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 18), crystalMat);
    ring.position.y = 1.65;
    ring.rotation.x = Math.PI * 0.35;
    body.add(spire, core, ring);
  } else {
    // Basalt Tide-Colossus (towering multi-part monolith guardian)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.85, metalness: 0.14 });
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xffa64d,
      emissive: 0xd9611e,
      emissiveIntensity: 2.0,
      roughness: 0.25,
    });
    materials.push(rockMat, magmaMat);

    const legGeo = new THREE.BoxGeometry(0.85, 1.55, 0.9);
    const legL = new THREE.Mesh(legGeo, rockMat);
    legL.position.set(-0.75, 0.78, 0);
    const legR = new THREE.Mesh(legGeo, rockMat);
    legR.position.set(0.75, 0.78, 0);
    const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), rockMat);
    chest.position.y = 2.35;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), magmaMat);
    core.position.set(0, 2.35, 0.85);
    const armGeo = new THREE.BoxGeometry(0.7, 2.0, 0.75);
    const armL = new THREE.Mesh(armGeo, rockMat);
    armL.position.set(-1.65, 2.15, 0.2);
    armL.rotation.z = 0.18;
    const armR = new THREE.Mesh(armGeo, rockMat);
    armR.position.set(1.65, 2.15, 0.2);
    armR.rotation.z = -0.18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.8, 0.9), rockMat);
    head.position.y = 3.55;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.2), magmaMat);
    visor.position.set(0, 3.58, 0.44);
    body.add(legL, legR, chest, core, armL, armR, head, visor);
  }

  return { root, body, telegraphRing, materials };
}

interface ParticleSlot {
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
  colorHex: number;
}

export class VaelmorGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private disposables: Array<{ dispose: () => void }> = [];

  private phase: GamePhase = 'title';
  private disposed = false;
  private frameId = 0;
  private lastNow = performance.now();
  private elapsed = 0;
  private lastHudPush = 0;

  // Player simulation state
  private playerPos = new THREE.Vector3(0, surfaceHeightAt(0, 17.5), 17.5);
  private playerVy = 0;
  private playerYaw = Math.PI; // Facing North toward the Bridge & Basalt Citadel
  private camYaw = Math.PI;
  private camPitch = 0.2;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private squashY = 1;
  private gaitPhase = 0;
  private hp = 100;
  private maxHp = 100;
  private stamina = 100;
  private maxStamina = 100;
  private invulnTimer = 0;
  private dodgeTimer = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private activeGear: GearSlotId = 'hookblade';
  private attackAnimTimer = 0;
  private cooldowns: Record<GearSlotId, number> = {
    hookblade: 0,
    bellhammer: 0,
    lantern: 0,
    compass: 0,
  };
  private completedQuestsCount = 0;
  private defeatedCount = 0;
  private lastRegionId: WorldRegion['id'] = 'southern-terrace';
  private combatStats: ComputedCombatStats = {
    maxHp: 100,
    damageMultiplier: 1,
    speedMultiplier: 1,
    staminaRegenMultiplier: 1,
    bellRangeBonus: 0,
    lanternHealAmount: 34,
    activePerks: [],
    relicAuraRgb: null,
    damageReductionPct: 0,
    killHealAmount: 0,
    reachBonus: 0,
    dodgeStaminaDiscount: 0,
    emberBonusPct: 0,
    frostSlowActive: false,
  };

  // Input state
  private keysHeld = new Set<string>();
  private pointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // World entities
  private npcs: GameNpc[];
  private interactables: WorldInteractable[];
  private enemies: EnemyEntity[];
  private projectiles: ProjectileEntity[] = [];
  private playerActor!: ReturnType<typeof createCloakedActor>;
  private enemyMeshes = new Map<string, ReturnType<typeof createEnemyMesh>>();
  private interactableMeshes = new Map<string, { group: THREE.Group; glowMat: THREE.MeshStandardMaterial }>();
  private remotePlayerMeshes = new Map<
    string,
    {
      actor: ReturnType<typeof createCloakedActor>;
      targetX: number;
      targetZ: number;
      targetYaw: number;
      pulseTimer: number;
      lastPulseAt: number;
    }
  >();
  private projectileMeshPool: THREE.Mesh[] = [];
  private bannerGroup = new THREE.Group();
  private animatedBeacons: THREE.Object3D[] = [];
  private objectiveBeam!: THREE.Group;
  private ambientMotes!: THREE.InstancedMesh;
  private ambientMoteSeeds: Array<{ x: number; y: number; z: number; phase: number; speed: number }> = [];
  private waterfallRibbon!: THREE.Mesh;
  private shadowTex!: THREE.CanvasTexture;

  // Pooled zero-GC particle system
  private readonly PARTICLE_CAP = 140;
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Reusable scratch objects (zero GC in loop)
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();

  constructor(
    container: HTMLElement,
    npcs: GameNpc[],
    interactables: WorldInteractable[],
    initialEnemies: EnemyEntity[],
    initialBanners: FoundationBanner[],
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.npcs = npcs;
    this.interactables = interactables.map((i) => ({ ...i }));
    this.enemies = initialEnemies.map((e) => ({ ...e }));
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x526a80);
    this.scene.fog = new THREE.FogExp2(0x7c878f, 0.0082);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.25, 280);
    this.camera.position.set(16, 11.5, 30);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // RoomEnvironment IBL reflections on all devices
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envTex.texture;
    this.disposables.push(envTex);
    pmrem.dispose();

    this.buildWorld(initialBanners);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.attachEvents();
    this.renderer.render(this.scene, this.camera);
    this.lastNow = performance.now();
    this.scheduleNextTick();
  }

  private track<T extends { dispose: () => void }>(res: T): T {
    this.disposables.push(res);
    return res;
  }

  private buildWorld(initialBanners: FoundationBanner[]): void {
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const stone = createStoneTexture(maxAniso);
    this.track(stone.map);
    this.track(stone.bump);
    this.shadowTex = this.track(createContactShadowTex());

    // 1. Atmospheric Gradient Sky Dome
    const skyTex = this.track(createSkyDomeTexture());
    const skyDome = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(210, 24, 16)),
      this.track(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })),
    );
    this.scene.add(skyDome);

    // 2. Warm Key Sun + Cool Sky/Ground Hemisphere Light
    const sun = new THREE.DirectionalLight(0xffd699, 3.1);
    sun.position.set(42, 34, 28);
    if (!this.isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 6;
      sun.shadow.camera.far = 140;
      const d = 52;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.025;
    }
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xa3c0dc, 0x45392a, 1.2));

    // Shared PBR Materials
    const basaltMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: stone.map,
        bumpMap: stone.bump,
        bumpScale: 0.2,
        roughness: 0.84,
        metalness: 0.12,
      }),
    );
    const darkSlateMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.78, metalness: 0.16 }),
    );
    const bronzeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc49552, roughness: 0.26, metalness: 0.86 }),
    );
    const copperMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x5ca18a, roughness: 0.34, metalness: 0.68 }),
    );
    const amberGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd584,
        emissive: 0xd99636,
        emissiveIntensity: 1.9,
        roughness: 0.2,
      }),
    );

    // 3. Biome-Painted 144m x 144m Sculpted Terrain
    const terrainGeo = this.track(new THREE.PlaneGeometry(144, 144, 84, 84));
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = vaelmorHeightAt(vx, vz);
      pos.setY(i, vy);

      // Biome vertex coloring for unmistakable visual identity across regions
      if (Math.abs(vx) < 4.5 && vz > -14 && vz < 26) {
        col.setHex(0x6e685c); // Stone causeway dust
      } else if (vx < -14 && vz < 4) {
        col.setHex(0x3f3936); // Cinder Fen & Ashen Kiln basalt
      } else if (vx > 12 && vz < 6) {
        col.setHex(0x525d42); // Amber Ironwood mossy loam
      } else if (vx > 12 && vz > 10) {
        col.setHex(0x5b615d); // Salt Loom coastal shale
      } else if (vy > 5.5) {
        col.setHex(0x585c63); // High mountain ridges
      } else {
        col.setHex(0x615947); // Golden frontier highland grass
      }
      // Subtle elevation shading
      const shade = THREE.MathUtils.clamp(0.84 + vy * 0.035, 0.72, 1.15);
      colors[i * 3] = col.r * shade;
      colors[i * 3 + 1] = col.g * shade;
      colors[i * 3 + 2] = col.b * shade;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(
      terrainGeo,
      this.track(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.92,
          metalness: 0.04,
        }),
      ),
    );
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // 4. Shimmering Canyon River & Salt Loom Coastal Water
    const waterMesh = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(144, 144, 1, 1)),
      this.track(
        new THREE.MeshStandardMaterial({
          color: 0x264b5c,
          roughness: 0.2,
          metalness: 0.42,
          transparent: true,
          opacity: 0.86,
        }),
      ),
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -1.65;
    this.scene.add(waterMesh);

    // 5. Landmark 1: High Basalt Citadel Keep (North Center, x=0, z=-20)
    const citadel = new THREE.Group();
    citadel.position.set(0, vaelmorHeightAt(0, -20) - 0.9, -20);
    const plinth = new THREE.Mesh(this.track(new THREE.CylinderGeometry(9.2, 11.0, 4.6, 8)), basaltMat);
    plinth.position.y = 2.3;
    plinth.castShadow = true;
    const bastion = new THREE.Mesh(this.track(new THREE.CylinderGeometry(6.6, 7.6, 6.8, 8)), basaltMat);
    bastion.position.y = 7.8;
    bastion.castShadow = true;
    const cornice = new THREE.Mesh(this.track(new THREE.TorusGeometry(6.75, 0.28, 10, 24)), bronzeMat);
    cornice.rotation.x = Math.PI / 2;
    cornice.position.y = 11.2;
    const keep = new THREE.Mesh(this.track(new THREE.CylinderGeometry(3.4, 4.3, 8.0, 8)), darkSlateMat);
    keep.position.y = 14.8;
    const roof = new THREE.Mesh(this.track(new THREE.ConeGeometry(4.0, 5.6, 8)), copperMat);
    roof.position.y = 21.5;
    citadel.add(plinth, bastion, cornice, keep, roof);

    const turretGeo = this.track(new THREE.CylinderGeometry(1.3, 1.6, 9.8, 8));
    const capGeo = this.track(new THREE.ConeGeometry(1.55, 2.5, 8));
    for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
      const tx = Math.cos(ang) * 7.2;
      const tz = Math.sin(ang) * 7.2;
      const t = new THREE.Mesh(turretGeo, basaltMat);
      t.position.set(tx, 6.8, tz);
      const cap = new THREE.Mesh(capGeo, darkSlateMat);
      cap.position.set(tx, 12.9, tz);
      citadel.add(t, cap);
    }
    const crownCrystal = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(1.05, 0)), amberGlowMat);
    crownCrystal.position.y = 25.4;
    const crownRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.85, 0.11, 8, 24)), bronzeMat);
    crownRing.position.y = 25.4;
    citadel.add(crownCrystal, crownRing);
    this.animatedBeacons.push(crownCrystal, crownRing);
    this.scene.add(citadel);

    // 6. Landmark 2: Twin-Arch Parabolic Causeway Bridge (z=-3.4 to z=13.4)
    const bridge = new THREE.Group();
    const deck = new THREE.Mesh(this.track(new THREE.BoxGeometry(6.0, 0.7, 17.0)), basaltMat);
    deck.position.set(0, 1.2, 5.0);
    deck.receiveShadow = true;
    const parapetGeo = this.track(new THREE.BoxGeometry(0.42, 0.8, 16.8));
    const pL = new THREE.Mesh(parapetGeo, darkSlateMat);
    pL.position.set(-2.78, 1.85, 5.0);
    const pR = new THREE.Mesh(parapetGeo, darkSlateMat);
    pR.position.set(2.78, 1.85, 5.0);
    bridge.add(deck, pL, pR);

    const pierGeo = this.track(new THREE.BoxGeometry(5.2, 7.6, 1.7));
    for (const pz of [-1.4, 5.0, 11.4]) {
      const pier = new THREE.Mesh(pierGeo, basaltMat);
      pier.position.set(0, -2.5, pz);
      bridge.add(pier);
    }

    const c1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -2.6, -1.0),
      new THREE.Vector3(0, 0.4, 2.0),
      new THREE.Vector3(0, -2.6, 5.0),
    ]);
    const c2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -2.6, 5.0),
      new THREE.Vector3(0, 0.4, 8.2),
      new THREE.Vector3(0, -2.6, 11.2),
    ]);
    const arch1 = this.track(new THREE.TubeGeometry(c1, 16, 0.4, 8, false));
    const arch2 = this.track(new THREE.TubeGeometry(c2, 16, 0.4, 8, false));
    for (const ax of [-2.2, 2.2]) {
      const a1 = new THREE.Mesh(arch1, bronzeMat);
      a1.position.x = ax;
      const a2 = new THREE.Mesh(arch2, bronzeMat);
      a2.position.x = ax;
      bridge.add(a1, a2);
    }

    const postGeo = this.track(new THREE.CylinderGeometry(0.11, 0.15, 1.45, 8));
    const orbGeo = this.track(new THREE.OctahedronGeometry(0.24, 0));
    for (const bx of [-2.78, 2.78]) {
      for (const bz of [-0.5, 5.0, 10.5]) {
        const post = new THREE.Mesh(postGeo, bronzeMat);
        post.position.set(bx, 2.9, bz);
        const orb = new THREE.Mesh(orbGeo, amberGlowMat);
        orb.position.set(bx, 3.8, bz);
        bridge.add(post, orb);
      }
    }

    // Citadel North Gatehouse Arch & Hanging Braziers framing the bridge exit
    const gatePillarGeo = this.track(new THREE.BoxGeometry(0.85, 6.2, 0.95));
    const gL = new THREE.Mesh(gatePillarGeo, basaltMat);
    gL.position.set(-3.1, 4.1, -3.2);
    const gR = new THREE.Mesh(gatePillarGeo, basaltMat);
    gR.position.set(3.1, 4.1, -3.2);
    const gateCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.1, 6.9, -3.2),
      new THREE.Vector3(0, 8.7, -3.2),
      new THREE.Vector3(3.1, 6.9, -3.2),
    ]);
    const gateArch = new THREE.Mesh(
      this.track(new THREE.TubeGeometry(gateCurve, 18, 0.42, 8, false)),
      bronzeMat,
    );
    const brazierGeo = this.track(new THREE.OctahedronGeometry(0.32, 0));
    const brL = new THREE.Mesh(brazierGeo, amberGlowMat);
    brL.position.set(-2.35, 6.3, -3.2);
    const brR = new THREE.Mesh(brazierGeo, amberGlowMat);
    brR.position.set(2.35, 6.3, -3.2);
    bridge.add(gL, gR, gateArch, brL, brR);
    this.scene.add(bridge);

    // Cascading Canyon Waterfall & Sculpted Basalt Crag east of the bridge
    const wfGroup = new THREE.Group();
    const cragMain = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(4.4, 1)), basaltMat);
    cragMain.scale.set(1.15, 1.45, 0.85);
    cragMain.position.set(16.2, 1.8, -0.4);
    const cragLeft = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(3.1, 0)), darkSlateMat);
    cragLeft.scale.set(1.0, 1.25, 0.9);
    cragLeft.position.set(13.2, 1.0, -0.2);
    const cragRight = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(3.4, 0)), basaltMat);
    cragRight.scale.set(1.1, 1.15, 0.85);
    cragRight.position.set(19.0, 1.1, 0.4);

    this.waterfallRibbon = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1.9, 6.2)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xaadfed,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        }),
      ),
    );
    this.waterfallRibbon.position.set(16.0, 1.6, 2.35);
    this.waterfallRibbon.rotation.x = -0.14;

    const wfSecondary = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.9, 5.4)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xd9f3fa,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
      ),
    );
    wfSecondary.position.set(16.2, 1.4, 2.48);
    wfSecondary.rotation.x = -0.14;

    const wfFoam = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(2.2, 2.8, 0.14, 18)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xd9f2f7,
          transparent: true,
          opacity: 0.52,
        }),
      ),
    );
    wfFoam.position.set(16.0, -1.55, 3.0);
    wfGroup.add(cragMain, cragLeft, cragRight, this.waterfallRibbon, wfSecondary, wfFoam);
    this.scene.add(wfGroup);

    // 7. Landmark 3: Ashen Kiln Foundry Pavilion (West, x=-26, z=-8)
    const foundry = new THREE.Group();
    foundry.position.set(-26, vaelmorHeightAt(-26, -8) - 0.3, -8);
    const fBase = new THREE.Mesh(this.track(new THREE.CylinderGeometry(5.2, 5.9, 1.3, 6)), basaltMat);
    fBase.position.y = 0.65;
    foundry.add(fBase);
    const fPillarGeo = this.track(new THREE.CylinderGeometry(0.32, 0.38, 4.8, 8));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const pil = new THREE.Mesh(fPillarGeo, darkSlateMat);
      pil.position.set(Math.cos(ang) * 4.1, 3.4, Math.sin(ang) * 4.1);
      foundry.add(pil);
    }
    const fRoof = new THREE.Mesh(this.track(new THREE.ConeGeometry(5.8, 2.7, 6)), copperMat);
    fRoof.position.y = 7.0;
    const fHearth = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.3, 1.5, 0.85, 12)), amberGlowMat);
    fHearth.position.y = 1.4;
    foundry.add(fRoof, fHearth);
    this.scene.add(foundry);

    // 8. Landmark 4: Salt Loom Coastal Triangulation Tower & Obsidian Sea-Stacks (South-East)
    const tower = new THREE.Group();
    tower.position.set(28, vaelmorHeightAt(28, 25) - 0.4, 25);
    const tBase = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.8, 3.6, 3.2, 6)), basaltMat);
    tBase.position.y = 1.6;
    const tSpire = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.3, 1.1, 8.0, 6)), copperMat);
    tSpire.position.y = 6.8;
    const tRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.2, 0.1, 8, 20)), bronzeMat);
    tRing.position.y = 8.4;
    tRing.rotation.x = Math.PI * 0.35;
    tower.add(tBase, tSpire, tRing);
    this.animatedBeacons.push(tRing);
    this.scene.add(tower);

    // Sea-stacks in the coastal inlet
    const stackGeo = this.track(new THREE.ConeGeometry(2.8, 9.5, 6));
    for (const [sx, sz, sScale] of [
      [35, 32, 1.15],
      [41, 24, 0.9],
      [23, 35, 0.85],
    ]) {
      const stack = new THREE.Mesh(stackGeo, darkSlateMat);
      stack.position.set(sx, 1.8, sz);
      stack.scale.set(sScale, sScale * 1.1, sScale);
      this.scene.add(stack);
    }

    // 9. Landmark 5: Instanced Amber Ironwood Groves (3-part composite trees: trunk + lower/upper layered canopy)
    const treeCoords: Array<[number, number, number]> = [];
    for (let i = 0; i < 82; i++) {
      const ang = i * 2.39996;
      const rad = 14 + (i % 9) * 4.2 + i * 0.25;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      if (Math.abs(tx) < 6.0 && tz > -28 && tz < 25) continue;
      if (Math.hypot(tx, tz + 20) < 13.5) continue;
      if (Math.hypot(tx + 26, tz + 8) < 9.5) continue;
      if (Math.hypot(tx - 28, tz - 25) < 8.0) continue;
      if (Math.abs(tz - 5) < 5.6) continue;
      const ty = vaelmorHeightAt(tx, tz);
      if (ty < -0.5) continue;
      treeCoords.push([tx, ty, tz]);
    }

    const trunkGeo = this.track(new THREE.CylinderGeometry(0.2, 0.44, 4.0, 7));
    trunkGeo.translate(0, 2.0, 0);
    const trunkMat = this.track(new THREE.MeshStandardMaterial({ color: 0x423226, roughness: 0.9 }));
    const crownLowerGeo = this.track(new THREE.ConeGeometry(2.35, 3.2, 7));
    crownLowerGeo.translate(0, 4.2, 0);
    const crownUpperGeo = this.track(new THREE.ConeGeometry(1.65, 2.8, 7));
    crownUpperGeo.translate(0, 6.1, 0);
    const crownMat = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 }));

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
    const crownsLow = new THREE.InstancedMesh(crownLowerGeo, crownMat, treeCoords.length);
    const crownsHigh = new THREE.InstancedMesh(crownUpperGeo, crownMat, treeCoords.length);
    const palette = [0xc97b32, 0xd89c45, 0x9c5b29, 0x567144, 0xba6f2b];

    treeCoords.forEach(([tx, ty, tz], idx) => {
      const s = 0.85 + ((idx * 37) % 32) / 100;
      this._dummy.position.set(tx, ty - 0.15, tz);
      this._dummy.rotation.set(0, (idx * 1.17) % (Math.PI * 2), 0);
      this._dummy.scale.set(s, s * (0.95 + ((idx * 17) % 24) / 100), s);
      this._dummy.updateMatrix();
      trunks.setMatrixAt(idx, this._dummy.matrix);
      crownsLow.setMatrixAt(idx, this._dummy.matrix);
      crownsHigh.setMatrixAt(idx, this._dummy.matrix);
      this._color.setHex(palette[idx % palette.length]);
      crownsLow.setColorAt(idx, this._color);
      this._color.offsetHSL(0.01, 0.04, 0.05);
      crownsHigh.setColorAt(idx, this._color);
    });
    trunks.computeBoundingSphere();
    crownsLow.computeBoundingSphere();
    crownsHigh.computeBoundingSphere();
    this.scene.add(trunks, crownsLow, crownsHigh);

    // 10. Instanced Basalt Outcrops (strictly outside causeway, bridge, and landmarks)
    const rockCoords: Array<[number, number, number]> = [];
    for (let i = 0; i < 64; i++) {
      const a = i * 1.83 + 0.4;
      const r = 13 + (i % 7) * 5.8;
      const rx = Math.cos(a) * r;
      const rz = Math.sin(a) * r;
      if (Math.abs(rx) < 6.8 && rz > -26 && rz < 26) continue; // Keep bridge & approach crystal clear
      if (Math.hypot(rx, rz + 20) < 13.5) continue;
      if (Math.hypot(rx + 26, rz + 8) < 9.0) continue;
      if (Math.hypot(rx - 28, rz - 25) < 7.5) continue;
      const ry = vaelmorHeightAt(rx, rz);
      rockCoords.push([rx, ry, rz]);
      if (rockCoords.length >= 38) break;
    }
    const rockGeo = this.track(new THREE.DodecahedronGeometry(1.15, 0));
    const rockMat = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }));
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCoords.length);
    rockCoords.forEach(([rx, ry, rz], i) => {
      this._dummy.position.set(rx, ry + 0.15, rz);
      this._dummy.rotation.set((i % 3) * 0.4, i * 0.8, 0.2);
      this._dummy.scale.set(1.0 + (i % 3) * 0.35, 0.6 + (i % 3) * 0.25, 0.95 + (i % 2) * 0.35);
      this._dummy.updateMatrix();
      rocks.setMatrixAt(i, this._dummy.matrix);
      this._color.setHex(i % 2 === 0 ? 0x454b54 : 0x52555a);
      rocks.setColorAt(i, this._color);
    });
    rocks.computeBoundingSphere();
    this.scene.add(rocks);

    // 11. World Interactables (Bridge Sounding Plate, Foundry Bell, Waystones, Silicate Relics)
    for (const item of this.interactables) {
      this.spawnInteractableMesh(item, basaltMat, bronzeMat);
    }

    // 12. Bespoke NPC Figures
    for (const npc of this.npcs) {
      const actor = createCloakedActor(npc.cloakHex, npc.trimHex, this.shadowTex, false);
      const ny = surfaceHeightAt(npc.position[0], npc.position[1]);
      actor.root.position.set(npc.position[0], ny, npc.position[1]);
      actor.root.rotation.y = Math.atan2(-npc.position[0], 17.5 - npc.position[1]);
      this.scene.add(actor.root);
    }

    // 13. Playable Waywright Hero
    this.playerActor = createCloakedActor(0x273545, 0xd9a64c, this.shadowTex, true);
    this.playerActor.root.position.copy(this.playerPos);
    this.playerActor.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerActor.root);

    // 14. Multi-Archetype Enemies
    for (const e of this.enemies) {
      const em = createEnemyMesh(e.archetype, this.shadowTex);
      em.root.position.set(e.x, surfaceHeightAt(e.x, e.z), e.z);
      this.enemyMeshes.set(e.id, em);
      this.scene.add(em.root);
    }

    // 15. Pooled Enemy Projectiles
    const projGeo = this.track(new THREE.OctahedronGeometry(0.28, 0));
    const projMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x9cf0d4,
        emissive: 0x3ec29e,
        emissiveIntensity: 2.2,
      }),
    );
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(projGeo, projMat);
      m.visible = false;
      this.scene.add(m);
      this.projectileMeshPool.push(m);
    }

    // 16. Foundation Banners Container
    this.scene.add(this.bannerGroup);
    for (const b of initialBanners) {
      this.addBannerMesh(b);
    }

    // 17. Zero-GC Pooled Particle Ring Buffer
    const pGeo = this.track(new THREE.OctahedronGeometry(0.14, 0));
    const pMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.PARTICLE_CAP);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.PARTICLE_CAP; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        colorHex: 0xffd584,
      });
      this._dummy.position.set(0, -50, 0);
      this._dummy.scale.setScalar(0.001);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, this._color.setHex(0xffd584));
    }
    this.scene.add(this.particleMesh);

    // 18. Instanced Highland Grass & Reed Tufts
    const grassCoords: Array<[number, number, number]> = [];
    for (let i = 0; i < 160; i++) {
      const a = i * 2.13 + 0.3;
      const r = 7 + (i % 14) * 3.1;
      const gx = Math.cos(a) * r;
      const gz = Math.sin(a) * r;
      if (Math.abs(gx) < 4.8 && gz > -6 && gz < 20) continue;
      if (Math.hypot(gx, gz + 20) < 11) continue;
      const gy = vaelmorHeightAt(gx, gz);
      if (gy < -1.1) continue;
      grassCoords.push([gx, gy, gz]);
    }
    const tuftGeo = this.track(new THREE.ConeGeometry(0.22, 0.72, 4));
    tuftGeo.translate(0, 0.36, 0);
    const tuftMat = this.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }));
    const grassMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, grassCoords.length);
    const grassPalette = [0x6d7c49, 0x857f47, 0x576b43, 0xa88a48];
    grassCoords.forEach(([gx, gy, gz], i) => {
      const s = 0.75 + (i % 5) * 0.14;
      this._dummy.position.set(gx, gy - 0.05, gz);
      this._dummy.rotation.set(0, i * 0.9, 0);
      this._dummy.scale.set(s, s * 1.1, s);
      this._dummy.updateMatrix();
      grassMesh.setMatrixAt(i, this._dummy.matrix);
      this._color.setHex(grassPalette[i % grassPalette.length]);
      grassMesh.setColorAt(i, this._color);
    });
    grassMesh.computeBoundingSphere();
    this.scene.add(grassMesh);

    // 19. Ambient Golden Valley Sun-Motes
    const moteCount = 48;
    const moteGeo = this.track(new THREE.OctahedronGeometry(0.11, 0));
    const moteMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xffe4a1, transparent: true, opacity: 0.65 }),
    );
    this.ambientMotes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    this.ambientMotes.frustumCulled = false;
    for (let i = 0; i < moteCount; i++) {
      const ang = i * 2.4;
      const rad = 5 + (i % 9) * 4.5;
      const mx = Math.cos(ang) * rad;
      const mz = Math.sin(ang) * rad;
      const my = vaelmorHeightAt(mx, mz) + 2.2 + (i % 5) * 1.2;
      this.ambientMoteSeeds.push({
        x: mx,
        y: my,
        z: mz,
        phase: i * 0.7,
        speed: 0.45 + (i % 4) * 0.15,
      });
    }
    this.scene.add(this.ambientMotes);

    // 20. Diegetic 3D Active Quest Waypoint Pillar
    this.objectiveBeam = new THREE.Group();
    const beamMesh = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.14, 0.35, 18, 12, 1, true)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xf0c76e,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    beamMesh.position.y = 9;
    const beamHalo = new THREE.Mesh(
      this.track(new THREE.RingGeometry(0.75, 1.05, 24)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0xf5d484,
          transparent: true,
          opacity: 0.68,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    beamHalo.rotation.x = -Math.PI / 2;
    beamHalo.position.y = 0.12;
    this.objectiveBeam.add(beamMesh, beamHalo);
    this.objectiveBeam.visible = false;
    this.scene.add(this.objectiveBeam);
  }

  private spawnInteractableMesh(
    item: WorldInteractable,
    basaltMat: THREE.Material,
    bronzeMat: THREE.Material,
  ): void {
    const group = new THREE.Group();
    const y = surfaceHeightAt(item.position[0], item.position[1]);
    group.position.set(item.position[0], y, item.position[1]);

    const glowColor =
      item.kind === 'silicate-relic'
        ? 0x62e8b8
        : item.kind === 'waystone-beacon'
          ? 0xf0be59
          : 0xe69c4c;
    const glowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: item.activated ? 2.4 : 1.1,
        roughness: 0.22,
      }),
    );

    if (item.kind === 'resonance-pier') {
      const plate = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.1, 1.25, 0.16, 12)), bronzeMat);
      plate.position.y = 0.08;
      const gem = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.32, 0)), glowMat);
      gem.position.y = 0.85;
      group.add(plate, gem);
      this.animatedBeacons.push(gem);
    } else if (item.kind === 'forge-bell') {
      const bell = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.7, 1.35, 2.0, 16)), bronzeMat);
      bell.position.y = 3.6;
      const clapper = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.32, 10, 10)), glowMat);
      clapper.position.y = 2.6;
      group.add(bell, clapper);
    } else if (item.kind === 'waystone-beacon') {
      const obelisk = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.45, 0.78, 3.2, 6)), basaltMat);
      obelisk.position.y = 1.6;
      const crystal = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.5, 0)), glowMat);
      crystal.position.y = 3.8;
      group.add(obelisk, crystal);
      this.animatedBeacons.push(crystal);
    } else {
      // Silicate Moss Relic cluster
      const c1 = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.42, 0)), glowMat);
      c1.position.y = 0.45;
      const c2 = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.28, 0)), glowMat);
      c2.position.set(0.38, 0.3, 0.2);
      const c3 = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.26, 0)), glowMat);
      c3.position.set(-0.34, 0.28, -0.2);
      group.add(c1, c2, c3);
      this.animatedBeacons.push(c1);
    }

    this.interactableMeshes.set(item.id, { group, glowMat });
    this.scene.add(group);
  }

  public addBannerMesh(banner: FoundationBanner): void {
    const g = new THREE.Group();
    const y = surfaceHeightAt(banner.position[0], banner.position[1]);
    g.position.set(banner.position[0], y, banner.position[1]);

    const pole = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 8)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xc99c52, roughness: 0.3, metalness: 0.85 })),
    );
    pole.position.y = 1.9;

    const cloth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.06, 1.35, 0.95)),
      this.track(
        new THREE.MeshStandardMaterial({
          color: banner.remote ? 0x5ea38c : 0xd4a253,
          emissive: banner.remote ? 0x265244 : 0x5c4116,
          emissiveIntensity: 0.65,
          roughness: 0.6,
        }),
      ),
    );
    cloth.position.set(0, 2.85, 0.5);

    const orb = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.22, 0)),
      this.track(
        new THREE.MeshStandardMaterial({
          color: 0xffe096,
          emissive: 0xd99636,
          emissiveIntensity: 2.0,
        }),
      ),
    );
    orb.position.y = 3.95;

    g.add(pole, cloth, orb);
    this.bannerGroup.add(g);
    this.spawnParticles(banner.position[0], y + 1.5, banner.position[1], 18, 0xffd584);
  }

  public spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 5.5,
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.PARTICLE_CAP;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(ang) * spd;
      slot.vy = 1.5 + Math.random() * speed * 0.7;
      slot.vz = Math.sin(ang) * spd;
      slot.life = 0.45 + Math.random() * 0.4;
      slot.maxLife = slot.life;
      slot.scale = 0.75 + Math.random() * 0.85;
      slot.colorHex = colorHex;
    }
  }

  public setPhase(phase: GamePhase): void {
    const prev = this.phase;
    this.phase = phase;
    if (phase === 'playing') {
      this.keysHeld.clear();
      this.pointerDragging = false;
      if (prev === 'title') {
        this.camYaw = this.playerYaw;
        this.camPitch = 0.2;
      }
      this.pushHudSnapshot();
    } else if (phase === 'paused' || phase === 'gameover' || phase === 'title') {
      this.keysHeld.clear();
      this.pointerDragging = false;
      document.exitPointerLock?.();
    }
  }

  public setCompletedQuestsCount(count: number): void {
    this.completedQuestsCount = count;
  }

  public setPlayerCombatStats(stats: ComputedCombatStats): void {
    const prevMax = this.maxHp;
    this.combatStats = stats;
    this.maxHp = stats.maxHp;
    if (stats.maxHp > prevMax) {
      this.hp = Math.min(this.maxHp, this.hp + (stats.maxHp - prevMax));
    } else {
      this.hp = Math.min(this.maxHp, this.hp);
    }
    this.pushHudSnapshot();
  }

  public setTrackedObjectiveCoords(coords: [number, number] | null): void {
    if (!this.objectiveBeam) return;
    if (!coords) {
      this.objectiveBeam.visible = false;
      return;
    }
    const y = surfaceHeightAt(coords[0], coords[1]);
    this.objectiveBeam.position.set(coords[0], y, coords[1]);
    this.objectiveBeam.visible = true;
  }

  public syncRemotePlayers(players: RemotePlayerState[]): void {
    const activeIds = new Set(players.map((p) => p.id));
    for (const [id, entry] of this.remotePlayerMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.actor.root);
        this.remotePlayerMeshes.delete(id);
      }
    }

    for (const p of players) {
      let entry = this.remotePlayerMeshes.get(p.id);
      if (!entry) {
        const cloakHex =
          p.guildId === 'guild-tideloom'
            ? 0x26544f
            : p.guildId === 'guild-kiln'
              ? 0x573428
              : 0x364a63;
        const trimHex =
          p.guildId === 'guild-tideloom'
            ? 0x76d6b8
            : p.guildId === 'guild-kiln'
              ? 0xe89456
              : 0xe6b95c;
        const actor = createCloakedActor(cloakHex, trimHex, this.shadowTex, true);
        const y = surfaceHeightAt(p.x, p.z);
        actor.root.position.set(p.x, y, p.z);
        actor.root.rotation.y = p.yaw;
        this.scene.add(actor.root);
        entry = {
          actor,
          targetX: p.x,
          targetZ: p.z,
          targetYaw: p.yaw,
          pulseTimer: 0,
          lastPulseAt: p.actionPulseAt ?? 0,
        };
        this.remotePlayerMeshes.set(p.id, entry);
      } else {
        entry.targetX = p.x;
        entry.targetZ = p.z;
        entry.targetYaw = p.yaw;
        if (p.actionPulseAt && p.actionPulseAt > entry.lastPulseAt) {
          entry.lastPulseAt = p.actionPulseAt;
          entry.pulseTimer = 0.28;
        }
      }
      (Object.keys(entry.actor.weaponMeshes) as GearSlotId[]).forEach((k) => {
        entry!.actor.weaponMeshes[k].visible = k === p.activeGear;
      });
    }
  }

  public selectGear(gear: GearSlotId): void {
    this.activeGear = gear;
    (Object.keys(this.playerActor.weaponMeshes) as GearSlotId[]).forEach((k) => {
      this.playerActor.weaponMeshes[k].visible = k === gear;
    });
    this.pushHudSnapshot();
  }

  public triggerPrimaryAction(): void {
    if (this.phase !== 'playing') return;
    const baseGear = GEAR_LOADOUT.find((g) => g.id === this.activeGear)!;
    if (this.cooldowns[baseGear.id] > 0) return;
    if (this.stamina < baseGear.staminaCost) {
      this.callbacks.onGearFeedback('Low Stamina — recover breath before striking.');
      return;
    }

    const gear = {
      ...baseGear,
      damage: Math.round(baseGear.damage * this.combatStats.damageMultiplier),
      range: baseGear.id === 'bellhammer' ? baseGear.range + this.combatStats.bellRangeBonus : baseGear.range,
    };

    this.cooldowns[gear.id] = gear.cooldownSec;
    this.stamina = Math.max(0, this.stamina - gear.staminaCost);
    this.attackAnimTimer = gear.id === 'bellhammer' ? 0.36 : 0.24;
    this.callbacks.onPlayerAction?.(gear.id);

    if (gear.id === 'hookblade' || gear.id === 'bellhammer') {
      if (gear.id === 'hookblade') {
        this.callbacks.onAudioEvent({ kind: 'swing' });
      } else {
        this.callbacks.onAudioEvent({ kind: 'bell', hz: 174 });
        this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.9, this.playerPos.z, 22, 0xf2b557, 7.5);
        this.callbacks.onCombatCallout?.('174 Hz RESONANCE', 'gold');
        // Check if player struck a resonance pier or forge bell nearby!
        for (const item of this.interactables) {
          if (
            !item.activated &&
            (item.kind === 'resonance-pier' || item.kind === 'forge-bell') &&
            Math.hypot(item.position[0] - this.playerPos.x, item.position[1] - this.playerPos.z) < 5.5
          ) {
            this.activateInteractableInternal(item);
          }
        }
      }

      const res = resolvePlayerAttack(
        this.playerPos.x,
        this.playerPos.z,
        this.playerYaw,
        gear,
        this.enemies,
      );
      if (res.hitEnemyIds.length > 0) {
        this.hitstopTimer = Math.max(this.hitstopTimer, res.hitstopSec);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + res.cameraTrauma);
        this.callbacks.onAudioEvent({ kind: 'hit', heavy: gear.id === 'bellhammer' || res.killedEnemyIds.length > 0 });
        this.callbacks.onCombatCallout?.(
          res.killedEnemyIds.length > 0
            ? `VANQUISHED (-${gear.damage})`
            : `-${gear.damage} ${gear.id === 'bellhammer' ? 'SHOCKWAVE' : 'STRIKE'}`,
          gear.id === 'bellhammer' ? 'heavy' : 'damage',
        );
        for (const id of res.hitEnemyIds) {
          const e = this.enemies.find((en) => en.id === id);
          if (e) {
            this.spawnParticles(
              e.x,
              surfaceHeightAt(e.x, e.z) + 1.2,
              e.z,
              res.killedEnemyIds.includes(id) ? 24 : 10,
              0xffb74d,
              6.5,
            );
          }
        }
        for (const killedId of res.killedEnemyIds) {
          const e = this.enemies.find((en) => en.id === killedId);
          if (e) {
            this.defeatedCount += 1;
            this.callbacks.onEnemyDefeated(e.archetype, e.name);
          }
        }
      }
    } else if (gear.id === 'lantern') {
      const healAmount = this.combatStats.lanternHealAmount;
      this.hp = Math.min(this.maxHp, this.hp + healAmount);
      this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z, 20, 0x62e8b8, 4.2);
      this.callbacks.onAudioEvent({ kind: 'heal' });
      this.callbacks.onCombatCallout?.(`+${healAmount} VITALITY`, 'heal');
      this.callbacks.onGearFeedback(`Silicate Lantern restored +${healAmount} Vitality.`);
    } else if (gear.id === 'compass') {
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 396 });
      this.callbacks.onCombatCallout?.('BANNER RAISED', 'gold');
      this.callbacks.onBannerPlanted(this.playerPos.x, this.playerPos.z);
    }

    this.pushHudSnapshot();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    const prox = this.findNearestProximity();
    if (!prox) return;

    if (prox.kind === 'npc') {
      this.callbacks.onInteractNpc(prox.id);
    } else {
      const item = this.interactables.find((i) => i.id === prox.id);
      if (item && !item.activated) {
        this.activateInteractableInternal(item);
      }
    }
  }

  private activateInteractableInternal(item: WorldInteractable): void {
    item.activated = true;
    const visual = this.interactableMeshes.get(item.id);
    if (visual) {
      visual.glowMat.emissiveIntensity = 3.0;
      if (item.kind === 'silicate-relic') {
        visual.group.visible = false;
      }
    }
    const y = surfaceHeightAt(item.position[0], item.position[1]);
    this.spawnParticles(item.position[0], y + 1.2, item.position[1], 24, 0x72f2c8, 6.2);
    if (item.kind === 'resonance-pier' || item.kind === 'forge-bell') {
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 174 });
    } else {
      this.callbacks.onAudioEvent({ kind: 'heal' });
    }
    this.callbacks.onActivateInteractable(item);
    this.pushHudSnapshot();
  }

  public teleportPlayer(x: number, z: number): void {
    const y = surfaceHeightAt(x, z);
    this.playerPos.set(x, y, z);
    this.playerVy = 0;
    this.grounded = true;
    this.spawnParticles(x, y + 1.0, z, 18, 0xd4a253, 5.0);
    this.pushHudSnapshot();
  }

  public revivePlayer(x: number, z: number): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.invulnTimer = 1.2;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.projectiles = [];
    this.teleportPlayer(x, z);
  }

  public spawnEmergentTarget(id: string, name: string, x: number, z: number): void {
    if (this.interactables.some((i) => i.id === id)) return;
    const item: WorldInteractable = {
      id,
      kind: 'waystone-beacon',
      name,
      promptVerb: `Survey ${name}`,
      regionId: getRegionAt(x, z).id,
      position: [x, z],
      activated: false,
    };
    this.interactables.push(item);
    const basaltMat = this.track(new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.84 }));
    const bronzeMat = this.track(new THREE.MeshStandardMaterial({ color: 0xc49552, roughness: 0.28, metalness: 0.85 }));
    this.spawnInteractableMesh(item, basaltMat, bronzeMat);
  }

  public resetRun(freshEnemies: EnemyEntity[], freshInteractables: WorldInteractable[]): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.defeatedCount = 0;
    this.playerPos.set(0, surfaceHeightAt(0, 17.5), 17.5);
    this.playerVy = 0;
    this.playerYaw = Math.PI;
    this.camYaw = Math.PI;
    this.camPitch = 0.2;
    this.invulnTimer = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.projectiles = [];
    this.cooldowns = { hookblade: 0, bellhammer: 0, lantern: 0, compass: 0 };

    // Reset enemies
    this.enemies = freshEnemies.map((e) => ({ ...e }));
    for (const e of this.enemies) {
      const m = this.enemyMeshes.get(e.id);
      if (m) {
        m.root.visible = true;
        m.root.scale.setScalar(1);
        m.root.position.set(e.x, surfaceHeightAt(e.x, e.z), e.z);
        (m.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    // Reset interactables
    this.interactables = freshInteractables.map((i) => ({ ...i }));
    for (const item of this.interactables) {
      const vis = this.interactableMeshes.get(item.id);
      if (vis) {
        vis.group.visible = true;
        vis.glowMat.emissiveIntensity = 1.1;
      }
    }
    this.pushHudSnapshot();
  }

  private findNearestProximity(): ProximityPrompt | null {
    let best: ProximityPrompt | null = null;

    for (const npc of this.npcs) {
      const d = Math.hypot(npc.position[0] - this.playerPos.x, npc.position[1] - this.playerPos.z);
      if (d < 4.2 && (!best || d < best.distance)) {
        best = {
          kind: 'npc',
          id: npc.id,
          label: `Speak with ${npc.name}`,
          sublabel: npc.title,
          distance: d,
        };
      }
    }

    for (const item of this.interactables) {
      if (item.activated) continue;
      const d = Math.hypot(item.position[0] - this.playerPos.x, item.position[1] - this.playerPos.z);
      if (d < 4.4 && (!best || d < best.distance)) {
        best = {
          kind: 'interactable',
          id: item.id,
          label: item.promptVerb,
          sublabel: item.name,
          distance: d,
        };
      }
    }

    return best;
  }

  private pushHudSnapshot(): void {
    const region = getRegionAt(this.playerPos.x, this.playerPos.z);
    if (region.id !== this.lastRegionId) {
      this.lastRegionId = region.id;
      this.callbacks.onAudioEvent({ kind: 'region', mood: region.ambientMood });
    }

    const nearbyEnemies = this.enemies
      .filter(
        (e) =>
          e.state !== 'ko' &&
          e.hp > 0 &&
          Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z) < 18,
      )
      .slice(0, 3)
      .map((e) => ({
        id: e.id,
        name: e.name,
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        archetype: e.archetype,
      }));

    this.callbacks.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      region,
      activeGear: this.activeGear,
      cooldowns: { ...this.cooldowns },
      proximity: this.findNearestProximity(),
      nearbyEnemies,
      defeatedCount: this.defeatedCount,
    });
  }

  private attachEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onBlur = () => {
    this.keysHeld.clear();
    this.pointerDragging = false;
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.keysHeld.clear();
      this.pointerDragging = false;
    }
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = Math.max(this.container.clientWidth, 320);
    const h = Math.max(this.container.clientHeight, 320);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    if (e.button === 0) {
      this.triggerPrimaryAction();
    } else if (e.button === 2) {
      this.pointerDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDragging || this.phase !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.camYaw -= dx * 0.006;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.16, 0.78);
  };

  private onPointerUp = () => {
    this.pointerDragging = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (this.phase !== 'playing') return;
    const wasHeld = this.keysHeld.has(e.code);
    this.keysHeld.add(e.code);

    if (!wasHeld) {
      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpBufferTimer = 0.12;
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        this.triggerPrimaryAction();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        this.triggerInteract();
      } else if (e.code === 'Digit1') {
        this.selectGear('hookblade');
      } else if (e.code === 'Digit2') {
        this.selectGear('bellhammer');
      } else if (e.code === 'Digit3') {
        this.selectGear('lantern');
      } else if (e.code === 'Digit4') {
        this.selectGear('compass');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (this.stamina >= 22 && this.dodgeTimer <= 0) {
          this.stamina -= 22;
          this.dodgeTimer = 0.28;
          this.invulnTimer = 0.34;
          this.callbacks.onAudioEvent({ kind: 'jump' });
        }
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
    // Variable jump height cut when Space released early while ascending
    if (e.code === 'Space' && this.playerVy > 2.5) {
      this.playerVy *= 0.48;
    }
  };

  private stepSimulation(dt: number): void {
    this.elapsed += dt;

    // Gentle ambient rotation on Citadel Lodestone Crown & Waystones
    this.animatedBeacons.forEach((b, i) => {
      b.rotation.y += dt * (i % 2 === 0 ? 0.6 : -0.45);
    });

    // Animate waterfall pulse, sun-motes, and objective waypoint halo
    if (this.waterfallRibbon) {
      const mat = this.waterfallRibbon.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.64 + Math.sin(this.elapsed * 5.2) * 0.1;
    }
    if (this.objectiveBeam && this.objectiveBeam.visible) {
      this.objectiveBeam.rotation.y += dt * 0.85;
      const haloScale = 1 + Math.sin(this.elapsed * 3.8) * 0.12;
      this.objectiveBeam.children[1]?.scale.setScalar(haloScale);
    }
    if (this.ambientMotes) {
      for (let i = 0; i < this.ambientMoteSeeds.length; i++) {
        const s = this.ambientMoteSeeds[i];
        this._dummy.position.set(
          s.x + Math.sin(this.elapsed * s.speed + s.phase) * 1.4,
          s.y + Math.cos(this.elapsed * s.speed * 0.9 + s.phase) * 0.9,
          s.z + Math.cos(this.elapsed * s.speed * 0.7 + s.phase) * 1.4,
        );
        this._dummy.rotation.set(0, this.elapsed + s.phase, 0);
        this._dummy.scale.setScalar(0.8 + Math.sin(this.elapsed * 2 + s.phase) * 0.3);
        this._dummy.updateMatrix();
        this.ambientMotes.setMatrixAt(i, this._dummy.matrix);
      }
      this.ambientMotes.instanceMatrix.needsUpdate = true;
    }

    // Smoothly interpolate live multiplayer remote avatars
    const remoteAlpha = 1 - Math.exp(-10 * dt);
    for (const entry of this.remotePlayerMeshes.values()) {
      const root = entry.actor.root;
      const ty = surfaceHeightAt(entry.targetX, entry.targetZ);
      root.position.x = THREE.MathUtils.lerp(root.position.x, entry.targetX, remoteAlpha);
      root.position.z = THREE.MathUtils.lerp(root.position.z, entry.targetZ, remoteAlpha);
      root.position.y = THREE.MathUtils.lerp(root.position.y, ty, remoteAlpha);
      const diff = Math.atan2(
        Math.sin(entry.targetYaw - root.rotation.y),
        Math.cos(entry.targetYaw - root.rotation.y),
      );
      root.rotation.y += diff * remoteAlpha;
      const slashMat = entry.actor.slashArc.material as THREE.MeshBasicMaterial;
      if (entry.pulseTimer > 0) {
        entry.pulseTimer = Math.max(0, entry.pulseTimer - dt);
        const t = 1 - entry.pulseTimer / 0.28;
        entry.actor.weaponPivot.rotation.x = 0.45 + Math.sin(t * Math.PI) * 1.4;
        slashMat.opacity = Math.sin(t * Math.PI) * 0.55;
      } else {
        entry.actor.weaponPivot.rotation.x = 0.45;
        slashMat.opacity = 0;
      }
    }

    // Update pooled particles in real time even during brief hitstop
    this.stepParticles(dt);

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    }

    if (this.phase === 'title') {
      // Smooth Live World Camera Tour framing Citadel, Parabolic Causeway, and Golden Horizon
      const angle = 0.42 + Math.sin(this.elapsed * 0.16) * 0.48;
      const cx = Math.sin(angle) * 28;
      const cz = Math.cos(angle) * 28 + 6;
      this.camera.position.set(cx, 11.4 + Math.sin(this.elapsed * 0.35) * 1.1, cz);
      this.camera.lookAt(-1.5, 8.8, -12);
      return;
    }

    if (this.phase !== 'playing') return;

    // Sim-level hitstop freeze on heavy hits & kills
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCameraFollow(dt);
      return;
    }

    // Cooldowns & regeneration
    (Object.keys(this.cooldowns) as GearSlotId[]).forEach((k) => {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    });
    this.stamina = Math.min(
      this.maxStamina,
      this.stamina + dt * 20 * this.combatStats.staminaRegenMultiplier,
    );
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);

    // Camera keyboard orbit (Q / R)
    if (this.keysHeld.has('KeyQ')) this.camYaw += 2.0 * dt;
    if (this.keysHeld.has('KeyR')) this.camYaw -= 2.0 * dt;

    // Player camera-relative movement
    let moveFwd = 0;
    let moveRight = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveFwd += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveFwd -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) moveRight += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) moveRight -= 1;

    const fwdX = Math.sin(this.camYaw);
    const fwdZ = Math.cos(this.camYaw);
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let mx = fwdX * moveFwd + rightX * moveRight;
    let mz = fwdZ * moveFwd + rightZ * moveRight;
    const mLen = Math.hypot(mx, mz);

    const baseSpeed = (this.dodgeTimer > 0 ? 15.5 : 8.6) * this.combatStats.speedMultiplier;
    if (mLen > 0.01) {
      mx /= mLen;
      mz /= mLen;
      const nextX = THREE.MathUtils.clamp(this.playerPos.x + mx * baseSpeed * dt, -46, 46);
      const nextZ = THREE.MathUtils.clamp(this.playerPos.z + mz * baseSpeed * dt, -34, 42);
      // Avoid clipping inside Citadel Keep core drum
      if (Math.hypot(nextX, nextZ + 20) > 8.6) {
        this.playerPos.x = nextX;
        this.playerPos.z = nextZ;
      }
      const targetYaw = Math.atan2(mx, mz);
      const diff = Math.atan2(Math.sin(targetYaw - this.playerYaw), Math.cos(targetYaw - this.playerYaw));
      this.playerYaw += diff * Math.min(1, 14 * dt);
      this.gaitPhase += baseSpeed * dt * 1.45;
    }

    // Coyote time & buffered jump physics
    const floorY = surfaceHeightAt(this.playerPos.x, this.playerPos.z);
    if (this.grounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      if (this.coyoteTimer > 0) {
        this.playerVy = 8.4;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.squashY = 1.18;
        this.callbacks.onAudioEvent({ kind: 'jump' });
      }
    }

    this.playerVy -= 22.0 * dt;
    this.playerPos.y += this.playerVy * dt;
    if (this.playerPos.y <= floorY) {
      if (!this.grounded && this.playerVy < -3.5) {
        this.squashY = 0.8;
      }
      this.playerPos.y = floorY;
      this.playerVy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Damped squash-and-stretch + attack swing animation
    this.squashY = THREE.MathUtils.lerp(this.squashY, 1, 1 - Math.exp(-12 * dt));
    const xzScale = 1 / Math.sqrt(this.squashY);
    this.playerActor.body.scale.set(xzScale, this.squashY, xzScale);
    this.playerActor.body.position.y = mLen > 0.01 && this.grounded ? Math.abs(Math.sin(this.gaitPhase)) * 0.12 : 0;
    this.playerActor.root.position.copy(this.playerPos);
    this.playerActor.root.rotation.y = this.playerYaw;

    // Weapon swing & slash arc feedback
    const slashMat = this.playerActor.slashArc.material as THREE.MeshBasicMaterial;
    if (this.attackAnimTimer > 0) {
      const t = 1 - this.attackAnimTimer / 0.28;
      this.playerActor.weaponPivot.rotation.x = 0.45 + Math.sin(t * Math.PI) * 1.45;
      this.playerActor.weaponPivot.rotation.y = -0.8 + t * 1.8;
      slashMat.opacity = Math.sin(t * Math.PI) * 0.65;
      slashMat.color.setHex(this.activeGear === 'bellhammer' ? 0xf2b557 : 0xffdf94);
    } else {
      this.playerActor.weaponPivot.rotation.x = 0.45;
      this.playerActor.weaponPivot.rotation.y = 0;
      slashMat.opacity = 0;
    }

    // Step 3 enemy archetypes with attack token pool
    const enemyEvents = stepEnemies(
      this.enemies,
      this.playerPos.x,
      this.playerPos.z,
      this.invulnTimer > 0,
      dt,
      this.completedQuestsCount,
    );

    if (enemyEvents.telegraphStartedIds.length > 0) {
      this.callbacks.onAudioEvent({ kind: 'telegraph' });
    }
    for (const [sx, sz] of enemyEvents.heavySlamPositions) {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
      this.callbacks.onAudioEvent({ kind: 'hit', heavy: true });
      this.spawnParticles(sx, surfaceHeightAt(sx, sz) + 0.4, sz, 24, 0xff7c38, 8.2);
    }
    for (const proj of enemyEvents.spawnedProjectiles) {
      this.projectiles.push(proj);
    }
    if (enemyEvents.playerDamaged > 0) {
      this.applyDamageToPlayer(enemyEvents.playerDamaged);
    }

    // Sync enemy 3D visuals (telegraph rings, hit flashes, KO dissolve)
    for (const e of this.enemies) {
      const m = this.enemyMeshes.get(e.id);
      if (!m) continue;
      if (e.state === 'ko') {
        const s = Math.max(0.01, e.koTimer / 0.45);
        m.root.scale.set(s, s, s);
        m.root.rotation.x = (1 - s) * 1.35;
        (m.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
        if (e.koTimer <= 0) m.root.visible = false;
        continue;
      }
      const ey = surfaceHeightAt(e.x, e.z);
      m.root.position.set(e.x, ey, e.z);
      m.root.rotation.set(0, e.yaw, 0);
      m.body.position.y =
        e.archetype === 'shardcaster' ? Math.sin(this.elapsed * 3.2 + e.x) * 0.25 : 0;

      // Visible telegraph glow ring & crouch/pulse
      const ringMat = m.telegraphRing.material as THREE.MeshBasicMaterial;
      if (e.state === 'telegraph') {
        const pulse = 0.55 + Math.sin(this.elapsed * 26) * 0.3;
        ringMat.opacity = pulse;
        m.body.scale.setScalar(1.0 + Math.sin(this.elapsed * 22) * 0.06);
      } else {
        ringMat.opacity = 0;
        m.body.scale.setScalar(1);
      }

      // Brief white hit flash
      m.materials.forEach((mat) => {
        if (e.hitFlashTimer > 0) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 1.6;
        } else {
          mat.emissiveIntensity = mat.color.getHex() === 0x353c45 || mat.color.getHex() === 0x3b3d42 ? 0 : 1.6;
        }
      });
    }

    // Step enemy projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const hitDist = Math.hypot(p.x - this.playerPos.x, p.z - this.playerPos.z);
      if (p.fromEnemy && hitDist < 1.05 && this.invulnTimer <= 0) {
        this.applyDamageToPlayer(p.damage);
        this.projectiles.splice(i, 1);
      } else if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = 0; i < this.projectileMeshPool.length; i++) {
      const mesh = this.projectileMeshPool[i];
      const p = this.projectiles[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.x, surfaceHeightAt(p.x, p.z) + 1.4, p.z);
        mesh.rotation.y += dt * 7;
      } else {
        mesh.visible = false;
      }
    }

    this.updateCameraFollow(dt);
  }

  private applyDamageToPlayer(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
    this.invulnTimer = 0.55;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z, 14, 0xe05858, 5.2);
    this.callbacks.onAudioEvent({ kind: 'hit', heavy: true });
    const defeated = this.hp <= 0;
    if (defeated) {
      this.callbacks.onAudioEvent({ kind: 'defeat' });
    }
    this.callbacks.onPlayerDamaged(Math.round(this.hp), defeated);
    this.pushHudSnapshot();
  }

  private updateCameraFollow(dt: number): void {
    const dist = 8.8;
    const desiredX = this.playerPos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const desiredZ = this.playerPos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const floorAtCam = surfaceHeightAt(desiredX, desiredZ);
    const desiredY = Math.max(floorAtCam + 1.6, this.playerPos.y + 2.25 + Math.sin(this.camPitch) * dist);

    const shake = this.cameraTrauma * this.cameraTrauma * 0.45;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    const alpha = 1 - Math.exp(-8.5 * dt);
    this._v1.set(desiredX + sx, desiredY + sy, desiredZ);
    this.camera.position.lerp(this._v1, alpha);

    this._v2.set(
      this.playerPos.x + Math.sin(this.camYaw) * 4.5,
      this.playerPos.y + 2.55,
      this.playerPos.z + Math.cos(this.camYaw) * 4.5,
    );
    this.camera.lookAt(this._v2);
  }

  private stepParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.PARTICLE_CAP; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummy.position.set(0, -50, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      p.vy -= 11.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const frac = p.life / p.maxLife;
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.scale.setScalar(p.scale * frac);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, this._color.setHex(p.colorHex));
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.004, (now - this.lastNow) / 1000));
    this.lastNow = now;

    this.stepSimulation(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.phase === 'playing' && now - this.lastHudPush > 110) {
      this.lastHudPush = now;
      this.pushHudSnapshot();
    }

    this.scheduleNextTick();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
