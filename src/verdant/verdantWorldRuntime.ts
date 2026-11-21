import {
  GEAR_LOADOUT,
  type FoundationBanner,
  type GameNpc,
  type GamePhase,
  type GearSlotId,
  type WorldInteractable,
  type WorldRegion,
} from '../game/worldData';
import {
  getBossSignatureProfile,
  resolvePlayerAttack,
  stepEnemies,
  type EnemyEntity,
  type ProjectileEntity,
} from '../game/rpgLogic';
import type {
  EngineCallbacks,
  ProximityPrompt,
} from '../game/vaelmorRenderer';
import type {
  ComputedCombatStats,
  ProjectedAllyScreenPos,
  RemoteActionEvent,
  RemotePlayerState,
  SharedEnemyState,
  WorldPing,
} from '../game/multiplayerTypes';
import {
  computeCoopHealAmount,
  filterSameRealmBanners,
  filterSameRealmPlayers,
  interpolateRemotePlayer,
  projectWorldToScreen,
  pruneExpiredPings,
  type RemoteVisualPose,
} from '../game/multiplayerState';
import {
  VerdantDynamicBatcher,
  type DynamicParticle,
  type SlashEffect,
} from './verdantDynamicGeometry';
import { resolvePublicUrl } from '../utils/publicUrl';
import {
  CANONICAL_REALM_SPECS,
  CELL_BORDER_TRIGGER,
  getRealmRegionAt,
  realmSurfaceHeightAt,
  realmTerrainHeightAt,
  type FrontiersRealmSpec,
} from './realmModelSchema';
import {
  evaluateWaterImmersion,
  resolveTerrainSlopeStep,
  sampleTerrainClippedWaterQuads,
  sampleTerrainSlope,
  type WaterPosture,
  type WaterQuadTile,
} from './verdantEnvironmentPhysics';
import { buildProceduralCellGlb } from './verdantProceduralGlb';
import { getAdjacentCellsSummary } from './verdantUniverseGenerator';
import { createPrism, kappa } from './prism-id.mjs';
import {
  buildRealmCollisionMap,
  getEnemyCollisionRadius,
  isProjectileBlockedByWorld,
  PLAYER_COLLISION_RADIUS,
  resolveCircleVsWorld,
  resolveDynamicBodySeparation,
  type WorldCollisionMap,
} from './verdantCollision';
import {
  buildCharacterProjectModelPayload,
  compileNpcCharacterAppearance,
} from './verdantCharacterCompiler';
import {
  findSoftCombatTargetYaw,
  resolveSpringArmCamera,
  shortestAngleDelta,
  stepVelocityMovement,
} from './verdantControls';
import {
  synthesizeRealmEcosystem,
  type SynthesizedEcosystemPlan,
} from './verdantEcosystemCatalog';
import {
  synthesizeDungeonEcosystem,
  type SynthesizedDungeonPlan,
} from './verdantDungeonCatalog';
import {
  FrontiersVerdantObserver,
  type AutomateReport,
  type LifecycleGateReport,
  type MonotonicWatermarkState,
  type ObserverRefinementAgenda,
  type ObserverSnapshot,
  type RatchetCycleReport,
  type RefinementAuditEntry,
  type UniformRefinementOptions,
  type UniformRefinementReport,
  type VerdantVsmManagerSpec,
} from './verdantObserverManager';
import type {
  ModelLineageReport,
  ModelOfModelsBuildInput,
  VerdantModelGraph,
  VerdantModelNode,
  VerdantPartSlot,
  VerdantResolutionTier,
} from './verdantModelOfModels';

export interface VerdantWorldStatus {
  wasmActive: boolean;
  backend: string;
  activeRealmSlug: string;
  activeRealmName: string;
  activeCell: [number, number, number];
  worldTriangles: number;
  worldVertices: number;
  pbrAtlasTiles: number;
  pbrChannels: { albedo: boolean; metallicRoughness: boolean; normal: boolean };
  prismDid: string;
  worldKappa: string;
  knowledgeNodesIngested: number;
  projectModelsRegistered: number;
  importedCatalogAssets: string[];
  stitchShardsSealed: number;
  blankStageVerified: boolean;
  isDungeon: boolean;
  worldSpanMeters: number;
  soundtrackTitle: string;
}

interface VerdantGlRenderer {
  backend: string;
  isSoftware: boolean;
  maxTextureSize: number;
  setRenderScale: (pm: number, casPm?: number) => void;
  setCsmSplits: (splits: number[]) => void;
  setTex: (slot: number, source: unknown, w?: number, h?: number, epoch?: number) => void;
  uploadSplitBuffers: (
    sv: {
      epoch: number;
      pos: Float32Array;
      norm: Float32Array;
      col: Float32Array;
      uv?: Float32Array;
      idx: Uint32Array;
    } | null,
    dv: { pos: Float32Array; norm: Float32Array; col: Float32Array; idx: Uint32Array } | null,
    iv?: null,
  ) => void;
  render: (
    mvp: Float32Array,
    eye: number[],
    lodSpec: { rank: number; sky: number[]; fog: number[] },
    timeSec: number,
    lookTarget: number[],
    fovRad: number,
    forceSync: boolean,
  ) => void;
}

interface VerdantRendererModule {
  createBestRenderer: (canvas: HTMLCanvasElement) => Promise<VerdantGlRenderer | null>;
  mat4Perspective: (fv: number, as: number, n: number, f: number) => Float32Array;
  mat4LookAt: (e: number[], t: number[], u: number[]) => Float32Array;
  mat4Mul: (a: Float32Array, b: Float32Array) => Float32Array;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VerdantWasmExports = Record<string, any> & { memory: WebAssembly.Memory };

export class VerdantFrontiersRuntime {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: VerdantGlRenderer | null = null;
  private rendererMod: VerdantRendererModule | null = null;
  private wasm: VerdantWasmExports | null = null;
  private batcher = new VerdantDynamicBatcher();
  private callbacks: EngineCallbacks;
  private onVerdantReady?: (status: VerdantWorldStatus) => void;
  private onModelObserverChange?: (snapshot: ObserverSnapshot) => void;
  private onSpatialAudio?: (metrics: { pan: number; gain: number; itdMicros: number }) => void;
  private onCombatIntensity?: (intensity: number) => void;
  private onFootstep?: (surface: 'stone' | 'earth' | 'water') => void;
  private onCrossFrontierBorder?: (
    dir: 'N' | 'S' | 'E' | 'W',
    nextCell: [number, number, number],
    entryPos: [number, number],
    entryYaw: number,
  ) => void;
  private modelObserver: FrontiersVerdantObserver;
  private modelResolutionTier: VerdantResolutionTier = 3;
  private crossingBorder = false;
  private footstepTimer = 0;
  private smoothedCombatIntensity = 0;

  private phase: GamePhase = 'title';
  private introBackdropOpaque = false;
  private disposed = false;
  private frameId = 0;
  private lastNow = performance.now();
  private simTime = 0;
  private lastHudPush = 0;
  private isSoftwareGl = false;

  // Static world buffers extracted zero-copy from verdant-uorc.wasm
  private staticUploaded = false;
  private staticEpoch = 0;
  private staticViews: {
    epoch: number;
    pos: Float32Array;
    norm: Float32Array;
    col: Float32Array;
    uv?: Float32Array;
    idx: Uint32Array;
  } | null = null;

  // Active Federated Meridian Realm, Synthesized Overworld Ecosystem & Dungeon Plan
  private activeRealm: FrontiersRealmSpec = CANONICAL_REALM_SPECS[0];
  private ecosystemPlan: SynthesizedEcosystemPlan = synthesizeRealmEcosystem(CANONICAL_REALM_SPECS[0]);
  private dungeonPlan: SynthesizedDungeonPlan | null = null;
  private thermalVentCooldown = 0;

  private get activePhenomenon() {
    return this.dungeonPlan ? this.dungeonPlan.phenomenon : this.ecosystemPlan.phenomenon;
  }

  private get activeFaunaKit() {
    return this.dungeonPlan ? this.dungeonPlan.faunaKit : this.ecosystemPlan.faunaKit;
  }

  private get activeThermalVents() {
    return this.dungeonPlan ? this.dungeonPlan.thermalVents : this.ecosystemPlan.thermalVents;
  }

  // Verdant + Prism live custody status
  private status: VerdantWorldStatus = {
    wasmActive: false,
    backend: 'initializing',
    activeRealmSlug: CANONICAL_REALM_SPECS[0].slug,
    activeRealmName: CANONICAL_REALM_SPECS[0].name,
    activeCell: CANONICAL_REALM_SPECS[0].cell,
    worldTriangles: 0,
    worldVertices: 0,
    pbrAtlasTiles: 0,
    pbrChannels: { albedo: false, metallicRoughness: false, normal: false },
    prismDid: 'prism:initializing',
    worldKappa: 'sha256:pending',
    knowledgeNodesIngested: 0,
    projectModelsRegistered: 0,
    importedCatalogAssets: [],
    stitchShardsSealed: 0,
    blankStageVerified: false,
    isDungeon: false,
    worldSpanMeters: (CANONICAL_REALM_SPECS[0].worldHalfExtent || 112) * 2,
    soundtrackTitle: CANONICAL_REALM_SPECS[0].soundtrack.title,
  };

  // Player state
  private playerX = 0;
  private playerY = 0.95;
  private playerZ = 21.5;
  private playerVx = 0;
  private playerVz = 0;
  private playerVy = 0;
  private coyoteTimer = 0;
  private playerYaw = Math.PI; // facing north toward the Causeway & Citadel
  private playerSpeed = 0;
  private hp = 120;
  private maxHp = 120;
  private stamina = 100;
  private maxStamina = 100;
  private staminaRegenBonusPct = 0;
  private damageBonusPct = 0;
  private speedMultiplier = 1;
  private bellRangeBonus = 0;
  private reachBonus = 0;
  private lanternHealAmount = 34;
  private damageReductionPct = 0;
  private killHealAmount = 0;
  private dodgeStaminaDiscount = 0;
  private emberBonusPct = 0;
  private frostSlowActive = false;
  private playerRelicAuraRgb: [number, number, number] | null = null;
  private activeGear: GearSlotId = 'hookblade';
  private cooldowns: Record<GearSlotId, number> = {
    hookblade: 0,
    bellhammer: 0,
    lantern: 0,
    compass: 0,
  };
  private attackSwing = 0;
  private dodgeTimer = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = 0;
  private bufferedAction: 'primary' | 'dodge' | null = null;
  private bufferedActionTimer = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private defeatedCount = 0;
  private completedQuestsCount = 0;
  private lastRegionMood: WorldRegion['ambientMood'] = 'causeway';

  // Smooth damped spring-arm camera orbit & zoom
  private camYaw = Math.PI;
  private targetCamYaw = Math.PI;
  private camPitch = 0.30;
  private targetCamPitch = 0.30;
  private camDist = 8.4;
  private targetCamDist = 8.4;
  private camEye = [0, 7.2, 29.8];
  private camTarget = [0, 2.0, 16.0];
  private introCamEye: [number, number, number] = [-16, 13.5, 34];
  private introCamTarget: [number, number, number] = [0, 4.2, -10];
  private dragging = false;
  private dragButton = -1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownAt = 0;
  private pointerMovedDist = 0;
  private actionCount = 0;
  private lastActionGear: GearSlotId | null = null;

  // Entities & solid spatial collision map
  private npcs: GameNpc[];
  private enemies: EnemyEntity[];
  private interactables: WorldInteractable[];
  private banners: FoundationBanner[];
  private remotePlayers: RemotePlayerState[] = [];
  private remoteVisuals = new Map<string, RemoteVisualPose>();
  private worldPings: WorldPing[] = [];
  private projectedAllies: ProjectedAllyScreenPos[] = [];
  private projectiles: ProjectileEntity[] = [];
  private collisionMap: WorldCollisionMap;
  private waterTiles: WaterQuadTile[] = [];
  private waterPosture: WaterPosture = 'dry';
  private waterDepth = 0;
  private terrainSlope = 0;
  private waterSplashTimer = 0;
  private trackedCoords: [number, number] | null = [-3.4, 15.2];
  private keys = new Set<string>();

  // Particles & slashes
  private particles: DynamicParticle[] = [];
  private slashes: SlashEffect[] = [];

  constructor(
    container: HTMLElement,
    initialNpcs: GameNpc[],
    initialEnemies: EnemyEntity[],
    initialInteractables: WorldInteractable[],
    initialBanners: FoundationBanner[],
    callbacks: EngineCallbacks,
    hooks?: {
      onVerdantReady?: (status: VerdantWorldStatus) => void;
      onModelObserverChange?: (snapshot: ObserverSnapshot) => void;
      onSpatialAudio?: (metrics: { pan: number; gain: number; itdMicros: number }) => void;
      onCombatIntensity?: (intensity: number) => void;
      onFootstep?: (surface: 'stone' | 'earth' | 'water') => void;
      onCrossFrontierBorder?: (
        dir: 'N' | 'S' | 'E' | 'W',
        nextCell: [number, number, number],
        entryPos: [number, number],
        entryYaw: number,
      ) => void;
    },
  ) {
    this.container = container;
    this.npcs = initialNpcs;
    this.enemies = initialEnemies;
    this.interactables = initialInteractables;
    this.banners = initialBanners;
    this.callbacks = callbacks;
    this.onVerdantReady = hooks?.onVerdantReady;
    this.onModelObserverChange = hooks?.onModelObserverChange;
    this.onSpatialAudio = hooks?.onSpatialAudio;
    this.onCombatIntensity = hooks?.onCombatIntensity;
    this.onFootstep = hooks?.onFootstep;
    this.onCrossFrontierBorder = hooks?.onCrossFrontierBorder;
    this.modelObserver = new FrontiersVerdantObserver({ npcs: initialNpcs });
    this.modelObserver.subscribe((snap) => {
      this.modelResolutionTier = snap.renderProfile.resolutionTier;
      this.onModelObserverChange?.(snap);
    });

    for (let i = 0; i < 64; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0.14,
        r: 0.9,
        g: 0.75,
        b: 0.3,
        matCode: 3,
      });
    }

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'block w-full h-full outline-none';
    this.canvas.setAttribute('aria-label', 'Frontiers and Foundations — Verdant 3D Open World');
    this.container.appendChild(this.canvas);
    this.resizeCanvas();

    this.collisionMap = buildRealmCollisionMap(this.activeRealm, this.interactables);
    this.waterTiles = sampleTerrainClippedWaterQuads(this.activeRealm, 104, 2.5);
    const resolvedSpawn = resolveCircleVsWorld(
      this.playerX,
      this.playerZ,
      PLAYER_COLLISION_RADIUS,
      this.groundAt(this.playerX, this.playerZ),
      this.collisionMap,
    );
    this.playerX = resolvedSpawn.x;
    this.playerZ = resolvedSpawn.z;
    this.playerY = this.groundAt(this.playerX, this.playerZ);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    void this.bootVerdantEngine();
  }

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1 : 1.5);
    const w = Math.max(320, Math.round((rect.width || window.innerWidth) * dpr));
    const h = Math.max(240, Math.round((rect.height || window.innerHeight) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private stageIo(bytes: Uint8Array): boolean {
    if (!this.wasm) return false;
    const ptr = this.wasm.verdant_wasm_io_resize(bytes.byteLength >>> 0) >>> 0;
    if (!ptr) return false;
    new Uint8Array(this.wasm.memory.buffer, ptr, bytes.byteLength).set(bytes);
    return true;
  }

  private readAux(): Uint8Array {
    if (!this.wasm) return new Uint8Array(0);
    const len = this.wasm.verdant_wasm_aux_len() >>> 0;
    const ptr = this.wasm.verdant_wasm_aux_ptr() >>> 0;
    if (!len || !ptr) return new Uint8Array(0);
    return new Uint8Array(this.wasm.memory.buffer, ptr, len).slice();
  }

  private groundAt(x: number, z: number): number {
    return realmSurfaceHeightAt(this.activeRealm, x, z);
  }

  private isOnBridge(x: number, z: number, y: number): boolean {
    const tp = this.activeRealm.terrainProfile;
    return (
      tp.hasBridge &&
      Math.abs(x) <= tp.bridgeHalfWidth + 0.15 &&
      z >= tp.bridgeZMin - 0.2 &&
      z <= tp.bridgeZMax + 0.2 &&
      y >= tp.bridgeDeckY - 0.55
    );
  }

  private async loadRealmGlbAndSky(realm: FrontiersRealmSpec): Promise<{
    tris: number;
    verts: number;
    atlasTiles: number;
    worldKappa: string;
    blankOk: boolean;
  }> {
    if (!this.wasm || !this.renderer) {
      throw new Error('Verdant engine not initialized');
    }
    const ex = this.wasm;
    const blankOk = (ex.verdant_wasm_studio_load_blank_stage() >>> 0) > 0;

    // Synthesize binary GLB directly on-demand for procedural UniverseCells, or fetch compiled GLB for canonical realms
    let glbBytes: Uint8Array;
    if (realm.isProceduralCell) {
      glbBytes = buildProceduralCellGlb(realm);
    } else {
      const realmGlbUrl = resolvePublicUrl(realm.glbUrl);
      let glbResp = await fetch(realmGlbUrl).catch(() => null);
      if ((!glbResp || !glbResp.ok) && realm.slug === 'vaelmor') {
        glbResp = await fetch(resolvePublicUrl('/verdant/frontiers-world.glb')).catch(() => null);
      }
      if (glbResp && glbResp.ok) {
        const glbBuf = await glbResp.arrayBuffer();
        glbBytes = new Uint8Array(glbBuf);
      } else {
        glbBytes = buildProceduralCellGlb(realm);
      }
    }
    if (this.disposed) {
      return { tris: 0, verts: 0, atlasTiles: 0, worldKappa: 'disposed', blankOk };
    }

    this.stageIo(glbBytes);
    const tris = ex.verdant_wasm_glb_import_io() >>> 0;
    const verts = ex.verdant_wasm_scene_vert_count() >>> 0;
    const idxCount = ex.verdant_wasm_scene_idx_count() >>> 0;
    const posPtr = ex.verdant_wasm_scene_pos_ptr() >>> 0;
    const normPtr = ex.verdant_wasm_scene_norm_ptr() >>> 0;
    const colPtr = ex.verdant_wasm_scene_col_ptr() >>> 0;
    const uvPtr = ex.verdant_wasm_scene_uv_ptr() >>> 0;
    const idxPtr = ex.verdant_wasm_scene_idx_ptr() >>> 0;

    if (tris > 0 && verts > 0 && idxCount > 0 && posPtr && idxPtr) {
      const mem = ex.memory.buffer;
      this.staticEpoch = (this.staticEpoch + 1) >>> 0;
      this.staticViews = {
        epoch: this.staticEpoch,
        pos: new Float32Array(mem, posPtr, verts * 3).slice(),
        norm: new Float32Array(mem, normPtr, verts * 3).slice(),
        col: new Float32Array(mem, colPtr, verts * 3).slice(),
        uv: uvPtr ? new Float32Array(mem, uvPtr, verts * 2).slice() : undefined,
        idx: new Uint32Array(mem, idxPtr, idxCount).slice(),
      };
      this.staticUploaded = false;

      // Upload Verdant's decoded multi-tile PBR Atlas (Albedo, Metallic-Roughness, Normal) to WebGL2
      const te = ex.verdant_wasm_scene_tex_epoch() >>> 0;
      const aPtr = ex.verdant_wasm_scene_tex_ptr() >>> 0;
      const aW = ex.verdant_wasm_scene_tex_width() >>> 0;
      const aH = ex.verdant_wasm_scene_tex_height() >>> 0;
      if (aPtr && aW && aH) {
        this.renderer.setTex(1, new Uint8Array(mem, aPtr, aW * aH * 4).slice(), aW, aH, te);
        for (const [ch, slot] of [
          [1, 3],
          [2, 4],
          [3, 5],
        ] as const) {
          const p = ex.verdant_wasm_scene_pbr_tex_ptr(ch) >>> 0;
          const pw = ex.verdant_wasm_scene_pbr_tex_width(ch) >>> 0;
          const ph = ex.verdant_wasm_scene_pbr_tex_height(ch) >>> 0;
          if (p && pw && ph) {
            this.renderer.setTex(slot, new Uint8Array(mem, p, pw * ph * 4).slice(), pw, ph);
          } else {
            this.renderer.setTex(slot, null, 0, 0);
          }
        }
      } else {
        this.renderer.setTex(1, null, 0, 0);
      }
    }

    // Load Poly Haven photographic HDRI sky dome for canonical realms; procedural cells use atmospheric biome shader
    if (realm.skyUrl) {
      const skyImg = new Image();
      skyImg.crossOrigin = 'anonymous';
      skyImg.onload = () => {
        if (!this.disposed && this.renderer) {
          this.renderer.setTex(2, skyImg);
        }
      };
      skyImg.src = resolvePublicUrl(realm.skyUrl);
    } else {
      this.renderer.setTex(2, null);
    }

    // Register Realm Project Model using exact Verdant camelCase schema
    const enc = new TextEncoder();
    const pmBytes = enc.encode(
      JSON.stringify({
        modelId: `frontiers:realm:${realm.slug}`,
        title: realm.name,
        schemaType: '3DModel',
        mediaType: 'model/gltf-binary',
        targetSlot: 'stage-environment',
        sourceStream: 'polyhaven-frontiers',
        sourceUri: `https://frontiers.verdant.stitch${realm.glbUrl}`,
        licenseSpdx: 'CC0-1.0',
        tags: ['frontiers-and-foundations', realm.theme, `cell:${realm.cell.join(',')}`],
        propertiesJson: JSON.stringify({
          cell: realm.cell,
          materials: realm.materials,
          importedCatalogProps: realm.importedCatalogProps.length,
        }),
        commitNote: `Loaded ${realm.name} in browser runtime`,
      }),
    );
    this.stageIo(pmBytes);
    const pmLen = ex.verdant_wasm_import_project_model_io() >>> 0;
    if (pmLen > 0) {
      this.status.projectModelsRegistered += 1;
    }

    // Automatically compile & register HD portrait-matched CharacterRig Project Models in verdant-uorc.wasm
    for (const npc of this.npcs) {
      const appearance = compileNpcCharacterAppearance(npc);
      const rigPayload = buildCharacterProjectModelPayload(npc, appearance, realm.slug);
      this.stageIo(enc.encode(JSON.stringify(rigPayload)));
      const rigLen = ex.verdant_wasm_import_project_model_io() >>> 0;
      if (rigLen > 0) {
        this.status.projectModelsRegistered += 1;
      }
    }
    if (typeof ex.verdant_wasm_record_part_hydration_io === 'function') {
      this.stageIo(
        enc.encode(
          `character-actor|verdant-portrait-compiler|${this.npcs.length} HD portrait-matched character rigs`,
        ),
      );
      ex.verdant_wasm_record_part_hydration_io(3);
    }

    if (typeof ex.verdant_wasm_stitch_boundary_seal_io === 'function') {
      this.stageIo(
        enc.encode(
          JSON.stringify({
            cell: realm.cell,
            slug: realm.slug,
            triangles: tris,
            npcs: this.npcs.length,
          }),
        ),
      );
      ex.verdant_wasm_stitch_boundary_seal_io();
    }

    const atlasTiles = ex.verdant_wasm_glb_atlas_tile_count() >>> 0;
    const worldKappa = realm.prismCustody?.worldGlbKappa || (await kappa({ slug: realm.slug, cell: realm.cell, tris, verts }));
    return { tris, verts, atlasTiles, worldKappa, blankOk };
  }

  private async bootVerdantEngine(): Promise<void> {
    try {
      // 1. Load real Verdant HD WebGL2 CSM/GGX/ACES Renderer module
      const modUrl = resolvePublicUrl('/verdant/scene-hd-renderer.mjs');
      const mod = (await import(/* @vite-ignore */ modUrl)) as VerdantRendererModule;
      if (this.disposed) return;
      this.rendererMod = mod;
      this.renderer = await mod.createBestRenderer(this.canvas);
      if (!this.renderer || this.disposed) return;

      this.isSoftwareGl = Boolean(this.renderer.isSoftware);
      this.resizeCanvas();
      this.renderer.setRenderScale(this.isSoftwareGl ? 850 : 1000, 320);
      this.renderer.setCsmSplits([0.25, 48.0, 115.0, 220.0]);

      // 2. Parallel-fetch real verdant-uorc.wasm, Prism world manifest, and browser Prism identity
      const [wasmResp, manifestResp, prismIdentity] = await Promise.all([
        fetch(resolvePublicUrl('/verdant/verdant-uorc.wasm')),
        fetch(resolvePublicUrl('/verdant/prism-world-manifest.json')).catch(() => null),
        createPrism({ deviceClass: 'browser', protection: 'software' }).catch(() => null),
      ]);
      if (this.disposed) return;

      const [wasmBuf, manifestJson] = await Promise.all([
        wasmResp.arrayBuffer(),
        manifestResp && manifestResp.ok ? manifestResp.json().catch(() => null) : null,
      ]);
      if (this.disposed) return;

      const { instance } = await WebAssembly.instantiate(wasmBuf, {});
      if (this.disposed) return;
      const ex = instance.exports as VerdantWasmExports;
      this.wasm = ex;

      // 3. Boot Verdant Engine strictly on Blank Stage & register external catalog stream
      ex.verdant_wasm_init(7777n);
      ex.verdant_wasm_update_host_envelope_uhd(
        Math.min(2048, this.renderer.maxTextureSize || 2048),
        this.isSoftwareGl ? 1 : 0,
        navigator.hardwareConcurrency || 4,
        8000,
        this.canvas.width,
        this.canvas.height,
      );

      this.stageIo(
        new TextEncoder().encode(
          JSON.stringify({
            streamId: 'polyhaven-frontiers',
            label: 'Poly Haven CC0 3D Models, PBR & HDRI Catalog',
            authority: 'Poly Haven CC0-1.0',
            adapterKind: 'polyhaven-rest',
            endpointUrl: 'https://api.polyhaven.com',
            targetParts: ['stage-environment', 'hero-props', 'surface-materials', 'visual-identity'],
          }),
        ),
      );
      ex.verdant_wasm_register_stream_io();

      // 4. Load active Realm GLB + PBR Atlas + HDRI Sky Dome
      const loaded = await this.loadRealmGlbAndSky(this.activeRealm);
      if (this.disposed) return;

      // 5. Ingest live world lore into Wasm cognitive knowledge graph
      let ingested = 0;
      for (const npc of this.npcs) {
        if (
          this.ingestKnowledgePassage(
            'vaelmor-characters',
            `urn:vaelmor:npc:${npc.id}`,
            `${npc.name} (${npc.title})`,
            `${npc.cognitiveDrive} Secret: ${npc.concealedSecret}`,
          )
        ) {
          ingested += 1;
        }
      }

      const prismDid =
        typeof prismIdentity?.prism === 'string'
          ? `prism:${prismIdentity.prism}`
          : `prism:${await kappa({ seed: 7777, role: 'waywright' })}`;

      const uniqueCatalogAssets = Array.from(
        new Set(this.activeRealm.importedCatalogProps.map((p) => p.assetId)),
      );

      this.status = {
        wasmActive: true,
        backend: this.renderer.backend,
        activeRealmSlug: this.activeRealm.slug,
        activeRealmName: this.activeRealm.name,
        activeCell: this.activeRealm.cell,
        worldTriangles: loaded.tris,
        worldVertices: loaded.verts,
        pbrAtlasTiles: loaded.atlasTiles,
        pbrChannels: {
          albedo: (ex.verdant_wasm_scene_pbr_tex_width(0) >>> 0) > 0,
          metallicRoughness: (ex.verdant_wasm_scene_pbr_tex_width(1) >>> 0) > 0,
          normal: (ex.verdant_wasm_scene_pbr_tex_width(2) >>> 0) > 0,
        },
        prismDid,
        worldKappa: manifestJson?.prismCustody?.worldGlbKappa || loaded.worldKappa,
        knowledgeNodesIngested: ingested,
        projectModelsRegistered: Math.max(1, this.status.projectModelsRegistered),
        importedCatalogAssets: uniqueCatalogAssets,
        stitchShardsSealed: manifestJson?.prismCustody?.stitchShards?.total ?? 3,
        blankStageVerified: loaded.blankOk,
        isDungeon: Boolean(this.activeRealm.isDungeon),
        worldSpanMeters: (this.activeRealm.worldHalfExtent || 112) * 2,
        soundtrackTitle: this.activeRealm.soundtrack.title,
      };

      // Attach Verdant Engine's 13 native VSM Managers into the unified Frontiers Observer
      this.modelObserver.setSoftwareGl(this.isSoftwareGl);
      if (typeof ex.verdant_wasm_operator_status_aux === 'function') {
        try {
          ex.verdant_wasm_operator_status_aux();
          const opBytes = this.readAux();
          if (opBytes.byteLength > 0) {
            const opJson = JSON.parse(new TextDecoder().decode(opBytes)) as {
              managers?: Array<{
                managerId?: string;
                name?: string;
                basisPrime?: number;
                kappaHex?: string;
                spec?: { concerns?: string[]; differentiationRequirements?: string[] };
              }>;
            };
            if (Array.isArray(opJson.managers)) {
              this.modelObserver.attachWasmManagers(opJson.managers);
            }
          }
        } catch {
          // keep Frontiers domain managers active even if WASM operator JSON fails
        }
      }

      // Expose uniform Model-of-Models & Extended Observer/Manager API on window
      (window as unknown as Record<string, unknown>).__VERDANT_MODEL_API__ = {
        getRootModel: () => this.modelObserver.getRootModel(),
        getModel: (modelId: string) => this.modelObserver.getModel(modelId),
        getModelGraph: () => this.modelObserver.getModelGraph(),
        getModelLineage: (modelId: string) => this.modelObserver.getModelLineage(modelId),
        getAuditLedger: () => this.modelObserver.getAuditLedger(),
        listModels: (filter?: { partSlot?: string; kind?: string }) =>
          this.modelObserver.listModels(
            filter as Parameters<FrontiersVerdantObserver['listModels']>[0],
          ),
        listManagers: () => this.modelObserver.listManagers(),
        observeKpis: () => this.modelObserver.observeKpis(),
        getSummary: () => this.modelObserver.getSummary(),
        getSnapshot: () => this.modelObserver.getSnapshot(),
        getObserverSnapshot: () => this.modelObserver.getSnapshot(),
        getRefinementAgenda: () => this.modelObserver.synthesizeRefinementAgenda(),
        getRenderResolutionProfile: () => this.modelObserver.getRenderResolutionProfile(),
        executeLifecycleGate: () => this.modelObserver.executeLifecycleGate(),
        getWatermarks: () => this.modelObserver.getMonotonicWatermarks(),
        refine: (opts?: UniformRefinementOptions) => this.refineWorldModel(opts),
        runRatchetCycle: (opts?: UniformRefinementOptions) => this.runRatchetCycle(opts),
        automate: (opts?: UniformRefinementOptions) => this.runAutomatePipeline(opts),
      };

      this.onVerdantReady?.({ ...this.status });
      this.onModelObserverChange?.(this.modelObserver.getSnapshot());
      this.pushHudSnapshot();
      this.lastNow = performance.now();
      this.tick();
    } catch (err) {
      console.error('[VerdantFrontiersRuntime] Engine boot error:', err);
    }
  }

  /**
   * Seamless Meridian Portal travel: hot-swaps the active Realm's compiled GLB,
   * PBR texture atlas, HDRI sky dome, parametric height field, NPCs, enemies, and interactables!
   */
  public async loadRealm(
    realm: FrontiersRealmSpec,
    nextNpcs: GameNpc[],
    nextEnemies: EnemyEntity[],
    nextInteractables: WorldInteractable[],
    spawnOverride?: { x: number; z: number; yaw?: number },
  ): Promise<void> {
    this.activeRealm = realm;
    this.ecosystemPlan = synthesizeRealmEcosystem(realm);
    this.dungeonPlan = realm.isDungeon ? synthesizeDungeonEcosystem(realm) : null;
    this.thermalVentCooldown = 0;
    this.npcs = nextNpcs;
    this.enemies = nextEnemies;
    this.interactables = nextInteractables;
    this.projectiles = [];
    this.slashes = [];
    this.collisionMap = buildRealmCollisionMap(realm, nextInteractables);
    this.waterTiles = sampleTerrainClippedWaterQuads(realm, 104, 2.5);
    this.waterPosture = 'dry';
    this.waterDepth = 0;
    this.terrainSlope = 0;

    this.banners = [];
    const [rawSx, rawSz] = spawnOverride ? [spawnOverride.x, spawnOverride.z] : realm.spawnPoint;
    const sx = rawSx;
    const sz = realm.isDungeon ? Math.min(23.5, rawSz) : rawSz;
    const resolvedSpawn = resolveCircleVsWorld(
      sx,
      sz,
      PLAYER_COLLISION_RADIUS,
      this.groundAt(sx, sz),
      this.collisionMap,
    );
    const entryYaw = spawnOverride?.yaw ?? Math.PI;
    this.playerX = resolvedSpawn.x;
    this.playerZ = resolvedSpawn.z;
    this.playerY = this.groundAt(this.playerX, this.playerZ);
    this.playerVx = 0;
    this.playerVz = 0;
    this.playerVy = 0;
    this.coyoteTimer = 0.12;
    this.playerYaw = entryYaw;
    this.camYaw = entryYaw;
    this.targetCamYaw = entryYaw;
    this.camPitch = realm.isDungeon ? 0.24 : 0.30;
    this.targetCamPitch = this.camPitch;
    this.camDist = realm.isDungeon ? 6.2 : 8.4;
    this.targetCamDist = this.camDist;
    this.camEye = realm.isDungeon
      ? [sx, this.playerY + 3.6, Math.min(31.2, sz + 6.2)]
      : [
          this.playerX - Math.sin(entryYaw) * this.camDist,
          this.playerY + 4.6,
          this.playerZ - Math.cos(entryYaw) * this.camDist,
        ];
    this.camTarget = [
      this.playerX + Math.sin(entryYaw) * 5.0,
      this.playerY + 1.8,
      this.playerZ + Math.cos(entryYaw) * 5.0,
    ];

    if (this.wasm && this.renderer) {
      const loaded = await this.loadRealmGlbAndSky(realm);
      let newlyIngested = 0;
      for (const npc of nextNpcs) {
        if (
          this.ingestKnowledgePassage(
            `realm-${realm.slug}`,
            `urn:frontiers:${realm.slug}:npc:${npc.id}`,
            `${npc.name} (${npc.title})`,
            `${npc.cognitiveDrive} Secret: ${npc.concealedSecret}`,
          )
        ) {
          newlyIngested += 1;
        }
      }
      const uniqueCatalogAssets = Array.from(
        new Set(realm.importedCatalogProps.map((p) => p.assetId)),
      );
      this.status = {
        ...this.status,
        activeRealmSlug: realm.slug,
        activeRealmName: realm.name,
        activeCell: realm.cell,
        worldTriangles: loaded.tris,
        worldVertices: loaded.verts,
        pbrAtlasTiles: loaded.atlasTiles,
        worldKappa: loaded.worldKappa,
        knowledgeNodesIngested: this.status.knowledgeNodesIngested + newlyIngested,
        importedCatalogAssets: uniqueCatalogAssets,
        blankStageVerified: loaded.blankOk,
        isDungeon: Boolean(realm.isDungeon),
        worldSpanMeters: (realm.worldHalfExtent || 112) * 2,
        soundtrackTitle: realm.soundtrack.title,
      };
      this.onVerdantReady?.({ ...this.status });
    }

    this.crossingBorder = false;
    this.spawnParticles(this.playerX, this.playerY + 1.4, this.playerZ, 22, 0xd4a253, 5.5);
    this.pushHudSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Live Verdant + Prism + Stitch Cognitive, Model-of-Models & Custody Hooks
  // ---------------------------------------------------------------------------
  public getVerdantStatus(): VerdantWorldStatus {
    return { ...this.status };
  }

  public getModelObserverSnapshot(): ObserverSnapshot {
    return this.modelObserver.getSnapshot();
  }

  public getRefinementAgenda(): ObserverRefinementAgenda {
    return this.modelObserver.synthesizeRefinementAgenda();
  }

  public listManagers(): VerdantVsmManagerSpec[] {
    return this.modelObserver.listManagers();
  }

  public getModelGraph(): VerdantModelGraph {
    return this.modelObserver.getModelGraph();
  }

  public getModelLineage(modelId: string): ModelLineageReport | null {
    return this.modelObserver.getModelLineage(modelId);
  }

  public listModelsByPart(partSlot: VerdantPartSlot): VerdantModelNode[] {
    return this.modelObserver.listModels({ partSlot });
  }

  public getAuditLedger(): RefinementAuditEntry[] {
    return this.modelObserver.getAuditLedger();
  }

  public syncWorldModelState(input: ModelOfModelsBuildInput): ObserverSnapshot {
    return this.modelObserver.syncWorldState(input);
  }

  public async refineWorldModel(
    options: UniformRefinementOptions = {},
  ): Promise<UniformRefinementReport> {
    const report = await this.modelObserver.refine(options);
    const prof = report.renderProfile;
    this.modelResolutionTier = prof.resolutionTier;

    if (this.renderer) {
      this.renderer.setRenderScale(prof.renderScalePermille, prof.casSharpnessPermille);
    }

    if (this.wasm) {
      const enc = new TextEncoder();
      if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
        const slot = options.partSlot ?? 'stage-environment';
        this.stageIo(
          enc.encode(
            `${slot}|frontiers-observer-manager|Tier ${prof.resolutionTier} (${prof.resolutionLabel}) · Diversity ${report.after.diversityIndex}/100 · ${report.modelsRefined} models`,
          ),
        );
        this.wasm.verdant_wasm_record_part_hydration_io(prof.resolutionTier);
      }
      if (typeof this.wasm.verdant_wasm_step_observer === 'function') {
        try {
          this.wasm.verdant_wasm_step_observer();
        } catch {
          // some builds require tick args; ignore gracefully
        }
      }
      if (typeof this.wasm.verdant_wasm_set_lod_rank === 'function') {
        try {
          this.wasm.verdant_wasm_set_lod_rank(prof.lodRank);
        } catch {
          // ignore
        }
      }
    }

    if (this.phase === 'playing') {
      this.spawnParticles(this.playerX, this.playerY + 1.6, this.playerZ, 20, 0xe8c468, 5.2);
    }
    return report;
  }

  public async runRatchetCycle(
    options: UniformRefinementOptions = {},
  ): Promise<RatchetCycleReport> {
    const cycle = await this.modelObserver.runRatchetCycle(options);
    const prof = cycle.refinementReport.renderProfile;
    this.modelResolutionTier = prof.resolutionTier;

    if (this.renderer) {
      this.renderer.setRenderScale(prof.renderScalePermille, prof.casSharpnessPermille);
    }

    if (this.wasm) {
      const enc = new TextEncoder();
      if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
        const slot = options.partSlot ?? 'stage-environment';
        this.stageIo(
          enc.encode(
            `${slot}|frontiers-observer-ratchet|Cycle #${cycle.cycleNumber} · Tier ${prof.resolutionTier} · Cohesion ${cycle.agendaAfter.cohesionIndex}/100 · Diversity ${cycle.agendaAfter.diversityIndex}/100`,
          ),
        );
        this.wasm.verdant_wasm_record_part_hydration_io(prof.resolutionTier);
      }
      if (typeof this.wasm.verdant_wasm_step_observer === 'function') {
        try {
          this.wasm.verdant_wasm_step_observer();
        } catch {
          // ignore
        }
      }
      if (typeof this.wasm.verdant_wasm_set_lod_rank === 'function') {
        try {
          this.wasm.verdant_wasm_set_lod_rank(prof.lodRank);
        } catch {
          // ignore
        }
      }
    }

    if (this.phase === 'playing') {
      this.spawnParticles(this.playerX, this.playerY + 1.6, this.playerZ, 24, 0x66dc9d, 5.6);
    }
    return cycle;
  }

  public executeLifecycleGate(): LifecycleGateReport {
    return this.modelObserver.executeLifecycleGate();
  }

  public getMonotonicWatermarks(): MonotonicWatermarkState {
    return this.modelObserver.getMonotonicWatermarks();
  }

  public async runAutomatePipeline(
    options: UniformRefinementOptions = {},
  ): Promise<AutomateReport> {
    const report = await this.modelObserver.executeAutomatePipeline(options);
    const prof = report.ratchetCycle.refinementReport.renderProfile;
    this.modelResolutionTier = prof.resolutionTier;

    if (this.renderer) {
      this.renderer.setRenderScale(prof.renderScalePermille, prof.casSharpnessPermille);
    }

    if (this.wasm) {
      const enc = new TextEncoder();
      if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
        const slot = options.partSlot ?? 'stage-environment';
        this.stageIo(
          enc.encode(
            `${slot}|frontiers-observer-automate|Cycle #${report.ratchetCycle.cycleNumber} · ${report.passedStages}/${report.totalStages} stages · Gates ${report.lifecycleGate.passedChecks}/${report.lifecycleGate.totalChecks} · Tier ${prof.resolutionTier}`,
          ),
        );
        this.wasm.verdant_wasm_record_part_hydration_io(prof.resolutionTier);
      }
      if (typeof this.wasm.verdant_wasm_step_observer === 'function') {
        try {
          this.wasm.verdant_wasm_step_observer();
        } catch {
          // ignore
        }
      }
      if (typeof this.wasm.verdant_wasm_set_lod_rank === 'function') {
        try {
          this.wasm.verdant_wasm_set_lod_rank(prof.lodRank);
        } catch {
          // ignore
        }
      }
    }

    if (this.phase === 'playing') {
      this.spawnParticles(this.playerX, this.playerY + 1.6, this.playerZ, 28, 0x7ad4f7, 6.0);
    }
    return report;
  }

  private ingestKnowledgePassage(
    sourceStream: string,
    sourceUri: string,
    topic: string,
    passage: string,
  ): boolean {
    if (!this.wasm) return false;
    const payload = JSON.stringify({
      sourceStream,
      sourceUri,
      topic,
      passage,
    });
    this.stageIo(new TextEncoder().encode(payload));
    return (this.wasm.verdant_wasm_ingest_knowledge_io() >>> 0) > 0;
  }

  public recordNpcDialogue(npcId: string, playerUtterance: string, npcReply: string): void {
    if (!this.wasm) return;
    const enc = new TextEncoder();
    // Observe PlayerToAgent (2) and AgentToPlayer (3) comms in Wasm Observer bus
    this.stageIo(enc.encode(`waywright|${npcId}|${playerUtterance}`));
    this.wasm.verdant_wasm_observe_comm_io(2);
    this.stageIo(enc.encode(`${npcId}|waywright|${npcReply}`));
    this.wasm.verdant_wasm_observe_comm_io(3);
    // Ingest new memory back into Verdant's live cognitive knowledge graph
    if (
      this.ingestKnowledgePassage(
        'vaelmor-dialogue',
        `urn:vaelmor:dialogue:${npcId}:${Date.now()}`,
        `Dialogue with ${npcId}`,
        `Waywright: ${playerUtterance} | ${npcId}: ${npcReply}`,
      )
    ) {
      this.status.knowledgeNodesIngested += 1;
      this.onVerdantReady?.({ ...this.status });
    }
  }

  public ingestEmergentLore(id: string, summary: string): void {
    if (!this.wasm) return;
    if (
      this.ingestKnowledgePassage(
        'vaelmor-emergent',
        `urn:vaelmor:emergent:${id}`,
        id,
        summary,
      )
    ) {
      this.status.knowledgeNodesIngested += 1;
      this.onVerdantReady?.({ ...this.status });
    }
  }

  private toCanonicalPrismValue(value: unknown): unknown {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0;
      return Number.isInteger(value) ? value : Math.round(value * 1000);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toCanonicalPrismValue(item));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) out[k] = this.toCanonicalPrismValue(v);
      }
      return out;
    }
    return value;
  }

  public async sealStitchPayload(payload: Record<string, unknown>): Promise<{
    kappaDigest: string;
    shardBytes: number[];
    prismDid: string;
  }> {
    const canonicalPayload = this.toCanonicalPrismValue(payload) as Record<string, unknown>;
    const kappaDigest = await kappa(canonicalPayload);
    const shardBytes: number[] = [];
    if (this.wasm) {
      const raw = new TextEncoder().encode(JSON.stringify(canonicalPayload));
      for (let i = 0; i < 3; i++) {
        this.stageIo(raw);
        const len = this.wasm.verdant_wasm_stitch_shard_io(i) >>> 0;
        shardBytes.push(len);
      }
      this.status.stitchShardsSealed += 3;
      this.onVerdantReady?.({ ...this.status });
    }
    return { kappaDigest, shardBytes, prismDid: this.status.prismDid };
  }

  // ---------------------------------------------------------------------------
  // Public Game Engine API (1:1 compatibility with App.tsx)
  // ---------------------------------------------------------------------------
  public addBannerMesh(banner: FoundationBanner): void {
    if (!this.banners.some((b) => b.id === banner.id)) {
      this.banners.push(banner);
    }
    const [bx, bz] = banner.position;
    this.spawnParticles(bx, this.groundAt(bx, bz) + 1.4, bz, 14, 0xe8c468, 4.6);
  }

  public spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed: number,
  ): void {
    const r = ((colorHex >> 16) & 255) / 255;
    const g = ((colorHex >> 8) & 255) / 255;
    const b = (colorHex & 255) / 255;
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 0.65) * speed;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vy = 2.0 + Math.random() * speed * 0.75;
      p.vz = Math.sin(a) * sp;
      p.maxLife = 0.35 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.scale = 0.14 + Math.random() * 0.12;
      p.r = r;
      p.g = g;
      p.b = b;
      p.matCode = 3;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase !== 'intro') {
      this.introBackdropOpaque = false;
    }
    if (phase !== 'playing') {
      this.keys.clear();
      this.dragging = false;
    }
    this.pushHudSnapshot();
  }

  public setIntroCameraTarget(
    eye: [number, number, number],
    target: [number, number, number],
    live3DVisible = true,
  ): void {
    this.introCamEye = [eye[0], eye[1], eye[2]];
    this.introCamTarget = [target[0], target[1], target[2]];
    this.introBackdropOpaque = !live3DVisible;
    if (live3DVisible) {
      // Snap near target shot so Scene V reveals Vaelmor immediately on frame 1
      this.camEye = [eye[0], eye[1], eye[2]];
      this.camTarget = [target[0], target[1], target[2]];
    }
  }

  public setCompletedQuestsCount(count: number): void {
    this.completedQuestsCount = count;
  }

  public setPlayerCombatStats(stats: ComputedCombatStats): void {
    const prevMax = this.maxHp;
    this.maxHp = stats.maxHp;
    this.staminaRegenBonusPct = Math.round((stats.staminaRegenMultiplier - 1) * 100);
    this.damageBonusPct = Math.round((stats.damageMultiplier - 1) * 100);
    this.speedMultiplier = stats.speedMultiplier;
    this.bellRangeBonus = stats.bellRangeBonus;
    this.reachBonus = stats.reachBonus ?? 0;
    this.lanternHealAmount = stats.lanternHealAmount;
    this.damageReductionPct = stats.damageReductionPct ?? 0;
    this.killHealAmount = stats.killHealAmount ?? 0;
    this.dodgeStaminaDiscount = stats.dodgeStaminaDiscount ?? 0;
    this.emberBonusPct = stats.emberBonusPct ?? 0;
    this.frostSlowActive = Boolean(stats.frostSlowActive);
    this.playerRelicAuraRgb = stats.relicAuraRgb ?? null;
    if (stats.maxHp > prevMax) {
      this.hp = Math.min(this.maxHp, this.hp + (stats.maxHp - prevMax));
    }
    this.pushHudSnapshot();
  }

  public setTrackedObjectiveCoords(coords: [number, number] | null): void {
    this.trackedCoords = coords;
  }

  public syncRemotePlayers(players: RemotePlayerState[]): void {
    this.remotePlayers = players;
    const activeIds = new Set(players.map((p) => p.id));
    for (const id of Array.from(this.remoteVisuals.keys())) {
      if (!activeIds.has(id)) {
        this.remoteVisuals.delete(id);
      }
    }
  }

  public syncWorldPings(pings: WorldPing[]): void {
    this.worldPings = pruneExpiredPings(pings, Date.now());
  }

  public replaceBanners(nextBanners: FoundationBanner[]): void {
    this.banners = nextBanners.slice();
  }

  public spawnRemoteActionVfx(ev: RemoteActionEvent): void {
    if (ev.realmSlug !== this.activeRealm.slug) return;
    const pose = this.remoteVisuals.get(ev.playerId);
    const rx = pose ? pose.x : ev.x;
    const rz = pose ? pose.z : ev.z;
    const ry = this.groundAt(rx, rz);
    const isRadial = ev.activeGear === 'bellhammer' || ev.activeGear === 'lantern';
    if (ev.activeGear === 'lantern') {
      this.slashes.push({
        active: true,
        x: rx,
        y: ry,
        z: rz,
        yaw: ev.yaw,
        age: 0,
        duration: 0.48,
        isRadial: true,
        r: 0.34,
        g: 0.92,
        b: 0.74,
      });
      this.spawnParticles(rx, ry + 1.2, rz, 14, 0x5ea38c, 4.0);
    } else if (ev.activeGear === 'bellhammer') {
      this.slashes.push({
        active: true,
        x: rx,
        y: ry,
        z: rz,
        yaw: ev.yaw,
        age: 0,
        duration: 0.44,
        isRadial: true,
        r: 0.96,
        g: 0.70,
        b: 0.30,
      });
      this.spawnParticles(rx, ry + 0.7, rz, 14, 0xe09f5a, 5.2);
    } else if (ev.activeGear === 'hookblade') {
      this.slashes.push({
        active: true,
        x: rx,
        y: ry,
        z: rz,
        yaw: ev.yaw,
        age: 0,
        duration: 0.28,
        isRadial: false,
        r: 0.48,
        g: 0.90,
        b: 0.98,
      });
      this.spawnParticles(rx + Math.sin(ev.yaw) * 1.3, ry + 1.1, rz + Math.cos(ev.yaw) * 1.3, 8, 0x78d5f5, 3.8);
    } else if (isRadial) {
      this.spawnParticles(rx, ry + 1.0, rz, 10, 0xd4a253, 3.6);
    }
  }

  public applyRemoteEnemySync(
    shared: SharedEnemyState,
    attackerName?: string,
  ): { killedLocally: boolean; enemy?: EnemyEntity } {
    const enemy = this.enemies.find((e) => e.id === shared.id);
    if (!enemy) return { killedLocally: false };
    const wasAlive = enemy.state !== 'ko' && enemy.hp > 0;
    const nextHp = shared.defeated ? 0 : Math.min(enemy.hp, shared.hp);
    const dmgDelta = Math.max(0, enemy.hp - nextHp);
    enemy.hp = nextHp;
    if (dmgDelta > 0) {
      enemy.hitFlashTimer = 0.22;
      if (enemy.archetype === 'colossus' && !enemy.phase2 && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
        enemy.phase2 = true;
      }
      this.spawnParticles(
        enemy.x,
        this.groundAt(enemy.x, enemy.z) + 1.0,
        enemy.z,
        shared.defeated ? 20 : 10,
        0x78d5f5,
        4.8,
      );
      if (attackerName && Math.hypot(enemy.x - this.playerX, enemy.z - this.playerZ) < 28) {
        this.callbacks.onCombatCallout?.(`-${Math.round(dmgDelta)} (${attackerName})`, 'damage');
      }
    }
    let killedLocally = false;
    if (wasAlive && (shared.defeated || enemy.hp <= 0)) {
      enemy.hp = 0;
      enemy.state = 'ko';
      enemy.koTimer = 0.01;
      this.defeatedCount += 1;
      killedLocally = true;
    }
    this.pushHudSnapshot();
    return { killedLocally, enemy };
  }

  public applyRemoteInteractableActivated(interactableId: string): WorldInteractable | null {
    const item = this.interactables.find((i) => i.id === interactableId);
    if (!item || item.activated) return null;
    if (item.kind === 'dungeon-portal' || item.kind === 'dungeon-exit') return null;
    item.activated = true;
    this.spawnParticles(
      item.position[0],
      this.groundAt(item.position[0], item.position[1]) + 1.2,
      item.position[1],
      18,
      0x78d5f5,
      5.0,
    );
    this.pushHudSnapshot();
    return item;
  }

  public applyCoopHeal(amount: number, healerName: string): void {
    if (this.phase !== 'playing' || this.hp <= 0) return;
    const applied = Math.max(1, Math.round(amount));
    this.hp = Math.min(this.maxHp, this.hp + applied);
    this.spawnParticles(this.playerX, this.playerY + 1.2, this.playerZ, 18, 0x5ea38c, 4.4);
    this.slashes.push({
      active: true,
      x: this.playerX,
      y: this.playerY,
      z: this.playerZ,
      yaw: this.playerYaw,
      age: 0,
      duration: 0.45,
      isRadial: true,
      r: 0.38,
      g: 0.94,
      b: 0.78,
    });
    this.callbacks.onAudioEvent({ kind: 'heal' });
    this.callbacks.onCombatCallout?.(`+${applied} Vitality (${healerName})`, 'heal');
    this.pushHudSnapshot();
  }

  public selectGear(gear: GearSlotId): void {
    this.activeGear = gear;
    this.pushHudSnapshot();
  }

  public activateGear(gear: GearSlotId): void {
    this.activeGear = gear;
    this.triggerPrimaryAction();
  }

  public triggerDodge(): void {
    if (this.phase !== 'playing') return;
    if (this.dodgeTimer > 0.04 || this.hitstopTimer > 0) {
      this.bufferedAction = 'dodge';
      this.bufferedActionTimer = 0.18;
      return;
    }
    const dodgeCost = Math.round(16 * (1 - this.dodgeStaminaDiscount));
    if (this.stamina < dodgeCost) {
      this.callbacks.onGearFeedback('Low Stamina — recover breath before dodging.');
      return;
    }
    this.stamina -= dodgeCost;
    this.dodgeTimer = 0.28;

    // Directional dodge: roll cleanly toward held WASD direction (or facing direction if stationary)
    let inFwd = 0;
    let inRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inFwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inFwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inRight -= 1;

    const fwdX = Math.sin(this.camYaw);
    const fwdZ = Math.cos(this.camYaw);
    const rightX = -fwdZ;
    const rightZ = fwdX;
    let dx = fwdX * inFwd + rightX * inRight;
    let dz = fwdZ * inFwd + rightZ * inRight;
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      dx /= len;
      dz /= len;
      this.playerYaw = Math.atan2(dx, dz);
    } else {
      dx = Math.sin(this.playerYaw);
      dz = Math.cos(this.playerYaw);
    }
    this.dodgeDirX = dx;
    this.dodgeDirZ = dz;
    const isSwim = this.waterPosture === 'swimming';
    const isWade = this.waterPosture === 'wading';
    const phen = this.activePhenomenon;
    const tidalBoost = this.dodgeStaminaDiscount > 0 ? 1.18 : 1.0;
    const surgeSpeed =
      (isSwim ? 9.6 * phen.swimSpeedMult : isWade ? 10.2 : 12.5) * phen.dodgeDistMult * tidalBoost;
    this.playerVx = dx * surgeSpeed;
    this.playerVz = dz * surgeSpeed;
    this.actionCount += 1;
    if (isSwim || isWade) {
      const wY = this.activeRealm.terrainProfile.waterLevel;
      this.spawnParticles(this.playerX, wY + 0.25, this.playerZ, 14, 0x8be2f2, 4.4);
      this.onFootstep?.('water');
    } else {
      this.callbacks.onAudioEvent({ kind: 'swing' });
    }
    this.pushHudSnapshot();
  }

  public setCameraPose(yaw: number, pitch: number, dist: number): void {
    this.camYaw = yaw;
    this.targetCamYaw = yaw;
    this.camPitch = Math.max(0.08, Math.min(0.84, pitch));
    this.targetCamPitch = this.camPitch;
    this.camDist = Math.max(3.4, Math.min(14.0, dist));
    this.targetCamDist = this.camDist;
  }

  public setPlayerYaw(yaw: number): void {
    this.playerYaw = yaw;
  }

  public getDebugSnapshot() {
    return {
      realmSlug: this.activeRealm.slug,
      realmName: this.activeRealm.name,
      activeCell: this.activeRealm.cell,
      isProceduralCell: Boolean(this.activeRealm.isProceduralCell),
      isDungeon: Boolean(this.activeRealm.isDungeon),
      ecosystem: {
        layoutId: this.ecosystemPlan.layoutId,
        layoutTitle: this.ecosystemPlan.layoutTitle,
        floraKit: this.ecosystemPlan.floraKit,
        floraTitle: this.ecosystemPlan.floraTitle,
        faunaKit: this.activeFaunaKit,
        faunaTitle: this.ecosystemPlan.faunaTitle,
        phenomenonId: this.activePhenomenon.id,
        phenomenonTitle: this.activePhenomenon.title,
        structureCount: this.dungeonPlan ? this.dungeonPlan.structures.length : this.ecosystemPlan.structures.length,
        floraCount: this.dungeonPlan ? 0 : this.ecosystemPlan.floraInstances.length,
        thermalVentCount: this.activeThermalVents.length,
      },
      dungeonArchitecture: this.dungeonPlan
        ? {
            style: this.dungeonPlan.style,
            styleTitle: this.dungeonPlan.styleTitle,
            chasmVisual: this.dungeonPlan.chasmVisual,
            faunaKit: this.dungeonPlan.faunaKit,
            phenomenonId: this.dungeonPlan.phenomenon.id,
            phenomenonTitle: this.dungeonPlan.phenomenon.title,
            structureCount: this.dungeonPlan.structures.length,
            thermalVentCount: this.dungeonPlan.thermalVents.length,
          }
        : null,
      worldTriangles: this.status.worldTriangles,
      adjacentCells: this.activeRealm.isDungeon
        ? []
        : getAdjacentCellsSummary(this.activeRealm.cell[0], this.activeRealm.cell[2]),
      playerX: Number(this.playerX.toFixed(3)),
      playerY: Number(this.playerY.toFixed(3)),
      playerZ: Number(this.playerZ.toFixed(3)),
      playerYaw: Number(this.playerYaw.toFixed(3)),
      waterPosture: this.waterPosture,
      waterDepth: Number(this.waterDepth.toFixed(2)),
      terrainSlope: Number(this.terrainSlope.toFixed(3)),
      waterTileCount: this.waterTiles.length,
      velocity: [Number(this.playerVx.toFixed(2)), Number(this.playerVz.toFixed(2))],
      cameraYaw: Number(this.camYaw.toFixed(3)),
      cameraPitch: Number(this.camPitch.toFixed(3)),
      cameraDist: Number(this.camDist.toFixed(2)),
      activeGear: this.activeGear,
      actionCount: this.actionCount,
      lastActionGear: this.lastActionGear,
      cooldowns: { ...this.cooldowns },
      hp: Math.round(this.hp),
      stamina: Math.round(this.stamina),
      bannerCount: this.banners.length,
      staticBoxColliders: this.collisionMap.boxes.length,
      staticCircleColliders: this.collisionMap.circles.length,
      characterRigs: this.npcs.map((n) => {
        const rig = compileNpcCharacterAppearance(n);
        return {
          id: n.id,
          name: n.name,
          portraitArchetype: rig.portraitArchetype,
          garmentStyle: rig.garmentStyle,
          hairStyle: rig.hairStyle,
          beardStyle: rig.beardStyle,
          bareForearms: rig.bareForearms,
          signatureProp: rig.signatureProp,
        };
      }),
      npcs: this.npcs.map((n) => ({ id: n.id, x: n.position[0], z: n.position[1] })),
      enemies: this.enemies.map((e) => ({
        id: e.id,
        name: e.name,
        archetype: e.archetype,
        x: Number(e.x.toFixed(2)),
        z: Number(e.z.toFixed(2)),
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        phase2: Boolean(e.phase2),
      })),
      playerRelicAuraRgb: this.playerRelicAuraRgb,
      modelOfModels: this.modelObserver.getSnapshot(),
    };
  }

  public triggerPrimaryAction(): void {
    if (this.phase !== 'playing') return;
    if (this.hitstopTimer > 0 || this.dodgeTimer > 0.08) {
      this.bufferedAction = 'primary';
      this.bufferedActionTimer = 0.18;
      return;
    }
    const gear = GEAR_LOADOUT.find((g) => g.id === this.activeGear) ?? GEAR_LOADOUT[0];
    if (this.cooldowns[gear.id] > 0) {
      if (this.cooldowns[gear.id] <= 0.16) {
        this.bufferedAction = 'primary';
        this.bufferedActionTimer = 0.18;
      } else {
        this.callbacks.onGearFeedback(
          `${gear.name} recharging (${this.cooldowns[gear.id].toFixed(1)}s)...`,
        );
      }
      return;
    }
    if (this.stamina < gear.staminaCost) {
      this.callbacks.onGearFeedback('Low Stamina — recover breath before striking.');
      return;
    }

    this.stamina = Math.max(0, this.stamina - gear.staminaCost);
    this.cooldowns[gear.id] = gear.cooldownSec * this.activePhenomenon.cooldownMult;
    this.actionCount += 1;
    this.lastActionGear = gear.id;
    this.callbacks.onPlayerAction?.(gear.id, this.playerX, this.playerZ, this.playerYaw);

    // Soft melee aim-assist: smoothly turn toward nearest living threat inside strike arc
    if (gear.id === 'hookblade' || gear.id === 'bellhammer') {
      const assistYaw = findSoftCombatTargetYaw(
        this.playerX,
        this.playerZ,
        this.playerYaw,
        this.enemies,
        gear.id === 'bellhammer' ? 5.6 : 4.8,
      );
      if (assistYaw !== null) {
        this.playerYaw = assistYaw;
      }
    }

    if (gear.id === 'lantern') {
      const heal = this.lanternHealAmount;
      this.hp = Math.min(this.maxHp, this.hp + heal);
      this.spawnParticles(this.playerX, this.playerY + 1.2, this.playerZ, 18, 0x5ea38c, 4.2);
      this.slashes.push({
        active: true,
        x: this.playerX,
        y: this.playerY,
        z: this.playerZ,
        yaw: this.playerYaw,
        age: 0,
        duration: 0.45,
        isRadial: true,
        r: 0.36,
        g: 0.9,
        b: 0.72,
      });
      this.callbacks.onAudioEvent({ kind: 'heal' });
      this.callbacks.onCombatCallout?.(`+${heal} Vitality`, 'heal');
      this.callbacks.onCoopLanternCast?.(computeCoopHealAmount(heal), this.playerX, this.playerZ);
      this.callbacks.onGearFeedback('Mortar Lantern mends you and nearby allies.');
      this.pushHudSnapshot();
      return;
    }

    if (gear.id === 'compass') {
      if (this.waterPosture === 'swimming') {
        this.callbacks.onGearFeedback('Step onto solid ground or shallows to plant a Foundation Banner.');
        this.pushHudSnapshot();
        return;
      }
      const forwardX = this.playerX + Math.sin(this.playerYaw) * 1.85;
      const forwardZ = this.playerZ + Math.cos(this.playerYaw) * 1.85;
      const resolvedBanner = resolveCircleVsWorld(
        forwardX,
        forwardZ,
        0.55,
        this.groundAt(forwardX, forwardZ),
        this.collisionMap,
      );
      this.callbacks.onBannerPlanted(resolvedBanner.x, resolvedBanner.z);
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 220 });
      this.callbacks.onCombatCallout?.('Foundation Raised', 'gold');
      this.pushHudSnapshot();
      return;
    }

    // Deep-water interaction: heavy weapons are sheathed while swimming -> perform a Hydro-Surge Splash instead!
    if (this.waterPosture === 'swimming') {
      const wY = this.activeRealm.terrainProfile.waterLevel;
      const fx = Math.sin(this.playerYaw);
      const fz = Math.cos(this.playerYaw);
      this.playerVx += fx * 5.2;
      this.playerVz += fz * 5.2;
      this.spawnParticles(this.playerX + fx * 0.6, wY + 0.25, this.playerZ + fz * 0.6, 18, 0x7be0f4, 5.2);
      this.slashes.push({
        active: true,
        x: this.playerX,
        y: wY + 0.05,
        z: this.playerZ,
        yaw: this.playerYaw,
        age: 0,
        duration: 0.42,
        isRadial: true,
        r: 0.42,
        g: 0.88,
        b: 0.96,
      });
      this.onFootstep?.('water');
      this.callbacks.onGearFeedback('Heavy weapons sheathed in deep water — surging through the current!');
      this.pushHudSnapshot();
      return;
    }

    // Combat strike (Hookblade cleave or 174 Hz Bell-Hammer radial shockwave)
    this.attackSwing = 1.0;
    const isRadial = gear.id === 'bellhammer';
    const inWater = this.waterPosture === 'wading';
    this.slashes.push({
      active: true,
      x: this.playerX,
      y: inWater ? this.activeRealm.terrainProfile.waterLevel + 0.08 : this.playerY,
      z: this.playerZ,
      yaw: this.playerYaw,
      age: 0,
      duration: isRadial ? 0.44 : 0.26,
      isRadial,
      r: inWater ? 0.46 : isRadial ? 0.96 : 0.98,
      g: inWater ? 0.88 : isRadial ? 0.68 : 0.84,
      b: inWater ? 0.94 : isRadial ? 0.28 : 0.38,
    });

    if (inWater) {
      this.spawnParticles(
        this.playerX,
        this.activeRealm.terrainProfile.waterLevel + 0.2,
        this.playerZ,
        isRadial ? 22 : 12,
        0x7edef2,
        isRadial ? 6.2 : 4.4,
      );
      this.onFootstep?.('water');
    }

    if (isRadial) {
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 174 });
      this.spawnParticles(this.playerX, this.playerY + 0.6, this.playerZ, 16, 0xe09f5a, 5.8);
      // Automatically activate any nearby bell-hammer interactable!
      for (const item of this.interactables) {
        if (item.activated || item.requiredGear !== 'bellhammer') continue;
        const d = Math.hypot(item.position[0] - this.playerX, item.position[1] - this.playerZ);
        if (d < 5.5) {
          item.activated = true;
          this.callbacks.onActivateInteractable(item);
          this.spawnParticles(item.position[0], this.groundAt(item.position[0], item.position[1]) + 1.2, item.position[1], 22, 0xd4a253, 6.4);
        }
      }
    } else {
      this.callbacks.onAudioEvent({ kind: 'swing' });
    }

    const effectiveGear = {
      ...gear,
      range: gear.range + (isRadial ? this.bellRangeBonus : this.reachBonus),
      damage: Math.round(
        gear.damage * (1 + this.damageBonusPct / 100) * this.activePhenomenon.strikeDamageMult,
      ),
    };
    const res = resolvePlayerAttack(
      this.playerX,
      this.playerZ,
      this.playerYaw,
      effectiveGear,
      this.enemies,
    );

    if (res.hitEnemyIds.length > 0) {
      this.hitstopTimer = res.hitstopSec;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + res.cameraTrauma);
      this.callbacks.onAudioEvent({ kind: 'hit', heavy: isRadial || res.killedEnemyIds.length > 0 });
      const emberTag = this.emberBonusPct > 0 ? ' · EMBER' : '';
      const frostTag = isRadial && this.frostSlowActive ? ' · CHILLED' : '';
      this.callbacks.onCombatCallout?.(
        res.killedEnemyIds.length > 0
          ? `Felled! -${effectiveGear.damage}${emberTag}`
          : `-${effectiveGear.damage}${emberTag}${frostTag}`,
        isRadial ? 'heavy' : 'damage',
      );
      for (const id of res.hitEnemyIds) {
        const enemy = this.enemies.find((e) => e.id === id);
        if (enemy) {
          const killed = res.killedEnemyIds.includes(id);
          this.callbacks.onEnemyDamaged?.({
            enemyId: enemy.id,
            enemyName: enemy.name,
            archetype: enemy.archetype,
            damage: effectiveGear.damage,
            maxHp: enemy.maxHp,
            killed,
          });
          if (isRadial && this.frostSlowActive && enemy.hp > 0) {
            enemy.slowTimer = 3.5;
          }
          const hitColor =
            isRadial && this.frostSlowActive
              ? 0x74e5ff
              : this.emberBonusPct > 0
                ? 0xff6b2b
                : 0xe09f5a;
          this.spawnParticles(
            enemy.x,
            this.groundAt(enemy.x, enemy.z) + 1.0,
            enemy.z,
            killed ? 20 : 12,
            hitColor,
            5.4,
          );
        }
      }
      for (const id of res.killedEnemyIds) {
        const enemy = this.enemies.find((e) => e.id === id);
        if (enemy) {
          this.defeatedCount += 1;
          if (this.killHealAmount > 0 && this.hp > 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.killHealAmount);
            this.spawnParticles(this.playerX, this.playerY + 1.2, this.playerZ, 12, 0x4ee896, 3.8);
            this.callbacks.onCombatCallout?.(`+${this.killHealAmount} Spore Siphon`, 'heal');
          }
          this.callbacks.onEnemyDefeated(enemy.archetype, enemy.name);
        }
      }
    }
    this.pushHudSnapshot();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    const prox = this.findNearestPrompt();
    if (!prox) return;

    if (prox.kind === 'npc') {
      this.callbacks.onInteractNpc(prox.id);
      return;
    }

    const item = this.interactables.find((i) => i.id === prox.id);
    if (!item) return;

    const isRepeatablePortal = item.kind === 'dungeon-portal' || item.kind === 'dungeon-exit';
    if (!isRepeatablePortal && item.activated) return;

    if (item.requiredGear && this.activeGear !== item.requiredGear) {
      // Auto-equip required gear and strike cleanly for smooth RPG UX
      this.activeGear = item.requiredGear;
      this.triggerPrimaryAction();
      return;
    }

    if (!isRepeatablePortal) {
      item.activated = true;
    }
    this.spawnParticles(
      item.position[0],
      this.groundAt(item.position[0], item.position[1]) + 1.2,
      item.position[1],
      22,
      item.kind === 'dungeon-portal' ? 0x52d6f4 : item.kind === 'vault-chest' ? 0xf2c96b : 0x5ea38c,
      5.5,
    );
    if (!isRepeatablePortal) {
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 261 });
    }
    this.callbacks.onActivateInteractable(item);
    this.pushHudSnapshot();
  }

  public teleportPlayer(x: number, z: number): void {
    this.playerX = x;
    this.playerZ = z;
    const tp = this.activeRealm.terrainProfile;
    const terrainY = realmTerrainHeightAt(this.activeRealm, x, z);
    const surfaceY = this.groundAt(x, z);
    const onBridge =
      tp.hasBridge &&
      Math.abs(x) <= 2.95 &&
      z >= tp.bridgeZMin &&
      z <= tp.bridgeZMax;
    const waterState = this.activeRealm.isDungeon
      ? evaluateWaterImmersion(surfaceY, -999, false, this.simTime)
      : evaluateWaterImmersion(terrainY, tp.waterLevel, onBridge, this.simTime);
    this.waterPosture = waterState.posture;
    this.waterDepth = waterState.depth;
    this.terrainSlope = this.activeRealm.isDungeon
      ? 0
      : sampleTerrainSlope((sx, sz) => realmTerrainHeightAt(this.activeRealm, sx, sz), x, z).slope;
    this.playerY = waterState.posture === 'swimming' ? waterState.swimFloatY : surfaceY;
    this.playerVy = 0;
    this.pushHudSnapshot();
  }

  public revivePlayer(x: number, z: number): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.teleportPlayer(x, z);
    this.phase = 'playing';
    this.pushHudSnapshot();
  }

  public spawnEmergentTarget(id: string, name: string, x: number, z: number): void {
    if (this.interactables.some((i) => i.id === id)) return;
    this.interactables.push({
      id,
      kind: 'waystone-beacon',
      name,
      promptVerb: 'Investigate Emergent Waystone',
      regionId: getRealmRegionAt(this.activeRealm, x, z).id,
      position: [x, z],
      activated: false,
    });
    this.collisionMap = buildRealmCollisionMap(this.activeRealm, this.interactables);
  }

  public resetRun(freshEnemies: EnemyEntity[], freshInteractables: WorldInteractable[]): void {
    this.enemies = freshEnemies;
    this.interactables = freshInteractables;
    this.collisionMap = buildRealmCollisionMap(this.activeRealm, this.interactables);
    this.projectiles = [];
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.defeatedCount = 0;
    const [sx, sz] = this.activeRealm.spawnPoint;
    this.playerX = sx;
    this.playerZ = sz;
    this.playerY = this.groundAt(sx, sz);
    this.playerVx = 0;
    this.playerVz = 0;
    this.playerVy = 0;
    this.coyoteTimer = 0.12;
    this.playerYaw = Math.PI;
    this.camYaw = Math.PI;
    this.targetCamYaw = Math.PI;
    this.camPitch = 0.30;
    this.targetCamPitch = 0.30;
    this.camDist = this.activeRealm.isDungeon ? 6.2 : 8.4;
    this.targetCamDist = this.camDist;
    this.phase = 'playing';
    this.pushHudSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Input Handlers (Fluid Action-RPG Controls: Velocity, Coyote Jump, Buffer, Zoom, Orbit)
  // ---------------------------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.phase !== 'playing') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const code = e.code;
    this.keys.add(code);
    if (code === 'Digit1') this.selectGear('hookblade');
    else if (code === 'Digit2') this.selectGear('bellhammer');
    else if (code === 'Digit3') this.selectGear('lantern');
    else if (code === 'Digit4') this.selectGear('compass');
    else if (code === 'KeyE' || code === 'Enter') this.triggerInteract();
    else if (code === 'KeyF') this.triggerPrimaryAction();
    else if (code === 'KeyC') {
      // Smoothly re-center camera behind the Waywright
      this.targetCamYaw = this.playerYaw;
    } else if (code === 'Equal' || code === 'NumpadAdd') {
      this.targetCamDist = Math.max(3.8, this.targetCamDist - 1.1);
    } else if (code === 'Minus' || code === 'NumpadSubtract') {
      this.targetCamDist = Math.min(13.5, this.targetCamDist + 1.1);
    } else if (code === 'Space') {
      e.preventDefault();
      const jumpMult = this.activePhenomenon.jumpBoostMult;
      if (this.waterPosture === 'swimming') {
        // Surface breach leap to vault smoothly onto riverbanks or piers!
        this.playerVy = 6.4 * jumpMult;
        this.coyoteTimer = 0;
        const wY = this.activeRealm.terrainProfile.waterLevel;
        this.spawnParticles(this.playerX, wY + 0.2, this.playerZ, 12, 0x8be2f2, 4.2);
        this.onFootstep?.('water');
        this.callbacks.onAudioEvent({ kind: 'jump' });
      } else if (this.coyoteTimer > 0) {
        this.playerVy = (this.waterPosture === 'wading' ? 6.4 : 7.6) * jumpMult;
        this.coyoteTimer = 0;
        this.callbacks.onAudioEvent({ kind: 'jump' });
      }
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.triggerDodge();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
    this.dragButton = -1;
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.dragging = false;
      this.dragButton = -1;
    } else {
      this.lastNow = performance.now();
    }
  };

  private onResize = (): void => {
    this.resizeCanvas();
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing') return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * Math.min(1.4, Math.max(0.45, Math.abs(e.deltaY) * 0.008));
    this.targetCamDist = Math.max(3.8, Math.min(13.5, this.targetCamDist + delta));
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.button === 1) {
      e.preventDefault();
      this.targetCamYaw = this.playerYaw;
      return;
    }
    if (e.button === 0 || e.button === 2) {
      this.dragging = true;
      this.dragButton = e.button;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
      this.pointerDownAt = performance.now();
      this.pointerMovedDist = 0;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || this.phase !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.pointerMovedDist += Math.hypot(dx, dy);
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.targetCamYaw -= dx * 0.0062;
    this.targetCamPitch = Math.max(0.09, Math.min(0.84, this.targetCamPitch + dy * 0.0046));
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    if (e.button === this.dragButton) {
      const wasLeft = this.dragButton === 0;
      this.dragging = false;
      this.dragButton = -1;
      const totalDist = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
      const elapsed = performance.now() - this.pointerDownAt;
      // Crisp left-click on the 3D world canvas (not an orbit drag) executes the equipped gear action!
      if (wasLeft && totalDist < 6 && this.pointerMovedDist < 8 && elapsed < 320 && this.phase === 'playing') {
        this.triggerPrimaryAction();
      }
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  // ---------------------------------------------------------------------------
  // Simulation & Rendering Loop (Real Verdant Wasm + scene-hd-renderer.mjs)
  // ---------------------------------------------------------------------------
  private findNearestPrompt(): ProximityPrompt | null {
    let best: ProximityPrompt | null = null;
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.position[0] - this.playerX, npc.position[1] - this.playerZ);
      if (d < 4.4 && (!best || d < best.distance)) {
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
      const isPortal = item.kind === 'dungeon-portal' || item.kind === 'dungeon-exit';
      if (item.activated && !isPortal) continue;
      const d = Math.hypot(item.position[0] - this.playerX, item.position[1] - this.playerZ);
      if (d < (isPortal ? 5.2 : 4.6) && (!best || d < best.distance)) {
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
    const region = getRealmRegionAt(this.activeRealm, this.playerX, this.playerZ);
    if (region.ambientMood !== this.lastRegionMood) {
      this.lastRegionMood = region.ambientMood;
      this.callbacks.onAudioEvent({ kind: 'region', mood: region.ambientMood });
    }
    const bossProf = getBossSignatureProfile(this.activeFaunaKit);
    const nearbyEnemies = this.enemies
      .filter((e) => e.state !== 'ko' && e.hp > 0 && Math.hypot(e.x - this.playerX, e.z - this.playerZ) < 22)
      .sort((a, b) => {
        if (a.archetype === 'colossus' && b.archetype !== 'colossus') return -1;
        if (b.archetype === 'colossus' && a.archetype !== 'colossus') return 1;
        return Math.hypot(a.x - this.playerX, a.z - this.playerZ) - Math.hypot(b.x - this.playerX, b.z - this.playerZ);
      })
      .slice(0, 3)
      .map((e) => ({
        id: e.id,
        name: e.name,
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        archetype: e.archetype,
        phase2: Boolean(e.phase2),
        bossTitle: e.archetype === 'colossus' ? (e.phase2 ? bossProf.phase2Title : bossProf.archetypeTitle) : undefined,
        signatureMove: e.archetype === 'colossus' && e.phase2 ? bossProf.signatureMoveName : undefined,
      }));

    this.callbacks.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerYaw: this.playerYaw,
      region,
      activeGear: this.activeGear,
      cooldowns: { ...this.cooldowns },
      proximity: this.findNearestPrompt(),
      nearbyEnemies,
      defeatedCount: this.defeatedCount,
      waterPosture: this.waterPosture,
      projectedAllies: this.projectedAllies,
      ecosystemBadge: {
        title: this.activePhenomenon.title,
        summary: this.activePhenomenon.effectSummary,
        layoutTitle: this.dungeonPlan ? this.dungeonPlan.styleTitle : this.ecosystemPlan.layoutTitle,
      },
    });
  }

  private stepSimulation(dt: number): void {
    this.simTime += dt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
    }
    if (this.attackSwing > 0) {
      this.attackSwing = Math.max(0, this.attackSwing - dt * 3.8);
    }

    const tp = this.activeRealm.terrainProfile;
    const prevWaterPosture = this.waterPosture;
    const curTerrainY = realmTerrainHeightAt(this.activeRealm, this.playerX, this.playerZ);
    const onBridgeNow = this.isOnBridge(this.playerX, this.playerZ, this.playerY);
    const waterState = this.activeRealm.isDungeon
      ? evaluateWaterImmersion(curTerrainY, -999, true, this.simTime)
      : evaluateWaterImmersion(curTerrainY, tp.waterLevel, onBridgeNow, this.simTime);
    this.waterPosture = waterState.posture;
    this.waterDepth = waterState.depth;

    if (prevWaterPosture === 'dry' && this.waterPosture !== 'dry') {
      this.spawnParticles(this.playerX, tp.waterLevel + 0.2, this.playerZ, 14, 0x8be2f2, 4.2);
      this.onFootstep?.('water');
    }

    // Cooldowns, stamina regeneration, and live Ecosystem/Dungeon Phenomenon buffs (spores, updrafts, aurora)
    const phen = this.activePhenomenon;
    for (const k of ['hookblade', 'bellhammer', 'lantern', 'compass'] as GearSlotId[]) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    const regenRate =
      24 * (1 + this.staminaRegenBonusPct / 100) * waterState.staminaRegenMultiplier * phen.staminaRegenMult;
    this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
    if (phen.passiveHpPerSec > 0 && this.hp > 0 && this.hp < this.maxHp && this.phase === 'playing') {
      this.hp = Math.min(this.maxHp, this.hp + phen.passiveHpPerSec * dt);
    }
    if (this.thermalVentCooldown > 0) {
      this.thermalVentCooldown = Math.max(0, this.thermalVentCooldown - dt);
    }

    // Step particles & slash rings
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy -= 11.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].age += dt;
      if (this.slashes[i].age >= this.slashes[i].duration) {
        this.slashes.splice(i, 1);
      }
    }

    // Smoothly interpolate same-realm remote Waywright poses & prune expired world pings
    const sameRealmPeers = filterSameRealmPlayers(this.remotePlayers, this.activeRealm.slug);
    for (const rp of sameRealmPeers) {
      const nextPose = interpolateRemotePlayer(
        this.remoteVisuals.get(rp.id),
        { x: rp.x, z: rp.z, yaw: rp.yaw || 0 },
        dt,
      );
      this.remoteVisuals.set(rp.id, nextPose);
    }
    if (this.worldPings.length > 0) {
      this.worldPings = pruneExpiredPings(this.worldPings, Date.now());
    }

    if (this.phase === 'title') {
      // Sweeping golden-hour aerial camera showcasing the Parabolic Bridge, Basalt Citadel,
      // Ironwood canopy, and Southern Causeway!
      const orbit = Math.sin(this.simTime * 0.16) * 0.34;
      this.camEye = [Math.sin(orbit) * 18.5, 9.8 + Math.sin(this.simTime * 0.25) * 0.7, 30.5];
      this.camTarget = [0, 3.6, -4.0];
      return;
    }

    if (this.phase === 'intro') {
      const alpha = Math.min(1, dt * 1.45);
      const swayX = Math.sin(this.simTime * 0.24) * 0.72;
      const swayY = Math.cos(this.simTime * 0.19) * 0.22;
      this.camEye[0] += (this.introCamEye[0] + swayX - this.camEye[0]) * alpha;
      this.camEye[1] += (this.introCamEye[1] + swayY - this.camEye[1]) * alpha;
      this.camEye[2] += (this.introCamEye[2] - this.camEye[2]) * alpha;
      this.camTarget[0] += (this.introCamTarget[0] - this.camTarget[0]) * alpha;
      this.camTarget[1] += (this.introCamTarget[1] - this.camTarget[1]) * alpha;
      this.camTarget[2] += (this.introCamTarget[2] - this.camTarget[2]) * alpha;
      return;
    }

    if (this.phase !== 'playing') return;

    // Drain 180ms action input buffer so clicks/dodges pressed mid-recovery fire cleanly
    if (this.bufferedActionTimer > 0) {
      this.bufferedActionTimer = Math.max(0, this.bufferedActionTimer - dt);
      if (this.bufferedActionTimer <= 0) {
        this.bufferedAction = null;
      } else if (this.dodgeTimer <= 0.04 && this.hitstopTimer <= 0) {
        const queued = this.bufferedAction;
        if (queued === 'dodge') {
          this.bufferedAction = null;
          this.bufferedActionTimer = 0;
          this.triggerDodge();
        } else if (queued === 'primary' && this.cooldowns[this.activeGear] <= 0) {
          this.bufferedAction = null;
          this.bufferedActionTimer = 0;
          this.triggerPrimaryAction();
        }
      }
    }

    // Camera keyboard yaw (Q / R) + smooth damping toward target orbit & zoom
    if (this.keys.has('KeyQ')) this.targetCamYaw += 2.2 * dt;
    if (this.keys.has('KeyR')) this.targetCamYaw -= 2.2 * dt;

    // Movement vector relative to camera heading
    let inFwd = 0;
    let inRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inFwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inFwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inRight -= 1;

    // Gentle auto-follow camera curve when strafing freely (never fights manual mouse drag)
    if (!this.dragging && inRight !== 0 && inFwd >= 0) {
      this.targetCamYaw -= inRight * 0.42 * dt;
    }

    const camSmooth = 1 - Math.exp(-15.0 * dt);
    this.camYaw += shortestAngleDelta(this.camYaw, this.targetCamYaw) * camSmooth;
    this.camPitch += (this.targetCamPitch - this.camPitch) * camSmooth;
    this.camDist += (this.targetCamDist - this.camDist) * (1 - Math.exp(-12.0 * dt));

    const prevX = this.playerX;
    const prevZ = this.playerZ;
    let candX = prevX;
    let candZ = prevZ;
    const ecoSpeedMult =
      waterState.posture === 'swimming' ? phen.swimSpeedMult : phen.landSpeedMult;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      const dodgeSpeed = 14.2 * waterState.dodgeScale * phen.dodgeDistMult;
      this.playerVx = this.dodgeDirX * dodgeSpeed;
      this.playerVz = this.dodgeDirZ * dodgeSpeed;
      candX = prevX + this.playerVx * dt;
      candZ = prevZ + this.playerVz * dt;
      this.playerSpeed = dodgeSpeed;
    } else {
      const move = stepVelocityMovement({
        inForward: inFwd,
        inRight,
        camYaw: this.camYaw,
        vx: this.playerVx,
        vz: this.playerVz,
        playerYaw: this.playerYaw,
        maxSpeed: 8.6 * waterState.speedMultiplier * ecoSpeedMult * this.speedMultiplier,
        accelRate: 16.5 * waterState.turnResponsiveness,
        decelRate: waterState.posture === 'swimming' ? 6.5 : 14.5,
        turnRate: 14.0 * waterState.turnResponsiveness,
        dt,
      });
      this.playerVx = move.vx;
      this.playerVz = move.vz;
      this.playerSpeed = move.speed;
      this.playerYaw = move.playerYaw;
      candX = prevX + this.playerVx * dt;
      candZ = prevZ + this.playerVz * dt;
    }

    // Integrated mountain range slope climbing & sheer cliff deflection (walkable foothills vs solid crags)
    if (!this.activeRealm.isDungeon && !onBridgeNow) {
      const slopeRes = resolveTerrainSlopeStep(
        (x, z) => this.groundAt(x, z),
        prevX,
        prevZ,
        candX,
        candZ,
      );
      this.playerX = slopeRes.x;
      this.playerZ = slopeRes.z;
      this.terrainSlope = slopeRes.slope;
      if (slopeRes.blockedByCliff) {
        this.playerVx *= 0.45;
        this.playerVz *= 0.45;
      }
    } else {
      this.playerX = candX;
      this.playerZ = candZ;
      this.terrainSlope = 0;
    }

    // Parabolic Causeway Bridge stone parapet guardrails when active realm has a bridge
    if (
      tp.hasBridge &&
      this.playerZ > tp.bridgeZMin - 0.4 &&
      this.playerZ < tp.bridgeZMax + 0.4 &&
      this.playerY >= tp.bridgeDeckY - 0.45 &&
      this.playerY < tp.bridgeDeckY + 1.2 &&
      Math.abs(prevX) <= tp.bridgeHalfWidth + 0.2
    ) {
      const lim = tp.bridgeHalfWidth - 0.25;
      this.playerX = Math.max(-lim, Math.min(lim, this.playerX));
    }

    // Solid Static Collision Resolution (buildings, walls, pillars, trees, chasm edges, props)
    const staticPlayer = resolveCircleVsWorld(
      this.playerX,
      this.playerZ,
      PLAYER_COLLISION_RADIUS,
      this.playerY,
      this.collisionMap,
    );
    this.playerX = staticPlayer.x;
    this.playerZ = staticPlayer.z;

    // Playable bounds: vaulted 3D dungeon chambers vs boundless open UniverseCell border crossing
    if (this.activeRealm.isDungeon) {
      this.playerZ = Math.max(-35.0, Math.min(31.5, this.playerZ));
      const xLim = this.playerZ > 18.0 || this.playerZ < -13.0 ? 9.6 : 19.5;
      this.playerX = Math.max(-xLim, Math.min(xLim, this.playerX));
    } else if (!this.crossingBorder && this.onCrossFrontierBorder) {
      const [cx, cy, cz] = this.activeRealm.cell;
      const clampLateral = (v: number) => Math.max(-72, Math.min(72, v));
      if (this.playerX > CELL_BORDER_TRIGGER) {
        this.crossingBorder = true;
        this.onCrossFrontierBorder('E', [cx + 1, cy, cz], [-86, clampLateral(this.playerZ)], this.playerYaw);
      } else if (this.playerX < -CELL_BORDER_TRIGGER) {
        this.crossingBorder = true;
        this.onCrossFrontierBorder('W', [cx - 1, cy, cz], [86, clampLateral(this.playerZ)], this.playerYaw);
      } else if (this.playerZ < -CELL_BORDER_TRIGGER) {
        this.crossingBorder = true;
        this.onCrossFrontierBorder('N', [cx, cy, cz - 1], [clampLateral(this.playerX), 86], this.playerYaw);
      } else if (this.playerZ > CELL_BORDER_TRIGGER) {
        this.crossingBorder = true;
        this.onCrossFrontierBorder('S', [cx, cy, cz + 1], [clampLateral(this.playerX), -86], this.playerYaw);
      }
    }

    // Re-evaluate water immersion at post-step position for smooth vertical buoyancy vs gravity
    const postTerrainY = realmTerrainHeightAt(this.activeRealm, this.playerX, this.playerZ);
    const postOnBridge = this.isOnBridge(this.playerX, this.playerZ, this.playerY);
    const postWater = this.activeRealm.isDungeon
      ? evaluateWaterImmersion(postTerrainY, -999, true, this.simTime)
      : evaluateWaterImmersion(postTerrainY, tp.waterLevel, postOnBridge, this.simTime);
    this.waterPosture = postWater.posture;
    this.waterDepth = postWater.depth;

    const floor = this.groundAt(this.playerX, this.playerZ);
    let grounded = false;
    if (postWater.posture === 'swimming') {
      // Buoyant swimming float: smoothly settle at waterline unless mid-breach leap
      if (this.playerVy > 0.2) {
        this.playerVy -= 18.0 * dt;
        this.playerY += this.playerVy * dt;
        if (this.playerY <= postWater.swimFloatY) {
          this.playerY = postWater.swimFloatY;
          this.playerVy = 0;
        }
      } else {
        const buoyBlend = 1 - Math.exp(-9.5 * dt);
        this.playerY += (postWater.swimFloatY - this.playerY) * buoyBlend;
        this.playerVy = 0;
      }
      if (this.playerY < floor) {
        this.playerY = floor;
      }
      grounded = true;
      this.coyoteTimer = 0.12;
    } else {
      // Gravity & surface height following (with 120ms coyote jump grace window)
      this.playerVy -= 20.0 * dt;
      this.playerY += this.playerVy * dt;
      grounded = this.playerY <= floor + 0.06;
      if (this.playerY < floor) {
        this.playerY = floor;
        this.playerVy = 0;
      }
      this.coyoteTimer = grounded ? 0.12 : Math.max(0, this.coyoteTimer - dt);
    }

    // Active Thermal Vent Updraft Launch in volcanic/caldera overworlds & geothermal 3D dungeons!
    const vents = this.activeThermalVents;
    if (
      this.thermalVentCooldown <= 0 &&
      vents.length > 0 &&
      grounded
    ) {
      for (const [vx, vz] of vents) {
        if (Math.hypot(this.playerX - vx, this.playerZ - vz) < 1.95) {
          this.playerVy = 11.4 * phen.jumpBoostMult;
          this.coyoteTimer = 0;
          this.thermalVentCooldown = 1.6;
          this.spawnParticles(vx, this.playerY + 0.5, vz, 20, 0xf2762e, 6.2);
          this.callbacks.onAudioEvent({ kind: 'jump' });
          this.callbacks.onCombatCallout?.('Thermal Updraft!', 'gold');
          break;
        }
      }
    }

    // Environmental footstep & aquatic swimming/wading foley + water splash droplets
    if (grounded && this.playerSpeed > 1.1 && this.dodgeTimer <= 0) {
      this.footstepTimer += dt;
      const cadence = this.waterPosture === 'swimming' ? 0.56 : this.waterPosture === 'wading' ? 0.44 : 0.37;
      if (this.footstepTimer >= cadence) {
        this.footstepTimer = 0;
        const onStone =
          this.activeRealm.isDungeon ||
          (tp.hasBridge && Math.abs(this.playerX) < tp.bridgeHalfWidth + 0.5 && this.playerZ > tp.bridgeZMin - 2 && this.playerZ < tp.bridgeZMax + 2) ||
          Math.hypot(this.playerX, this.playerZ + 12) < 14;
        const inWater = !this.activeRealm.isDungeon && this.waterPosture !== 'dry';
        this.onFootstep?.(inWater ? 'water' : onStone ? 'stone' : 'earth');
      }
      if (!this.activeRealm.isDungeon && this.waterPosture !== 'dry') {
        this.waterSplashTimer += dt;
        if (this.waterSplashTimer >= 0.24) {
          this.waterSplashTimer = 0;
          this.spawnParticles(this.playerX, tp.waterLevel + 0.12, this.playerZ, 4, 0x8be2f2, 2.4);
        }
      }
    } else {
      this.footstepTimer = Math.min(this.footstepTimer, 0.22);
    }

    // Step hostile frontier creatures & projectiles with bespoke ecosystem fauna AI personalities
    const ev = stepEnemies(
      this.enemies,
      this.playerX,
      this.playerZ,
      this.dodgeTimer > 0,
      dt,
      this.completedQuestsCount,
      this.activeFaunaKit,
    );
    if (ev.telegraphStartedIds.length > 0) {
      this.callbacks.onAudioEvent({ kind: 'telegraph' });
    }
    for (const slamPos of ev.heavySlamPositions) {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.38);
      this.slashes.push({
        active: true,
        x: slamPos[0],
        y: this.groundAt(slamPos[0], slamPos[1]),
        z: slamPos[1],
        yaw: 0,
        age: 0,
        duration: 0.48,
        isRadial: true,
        r: 0.98,
        g: 0.36,
        b: 0.14,
      });
    }
    if (ev.bossPhase2TriggeredIds.length > 0) {
      const bossProf = getBossSignatureProfile(this.activeFaunaKit);
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
      this.callbacks.onAudioEvent({ kind: 'bell', hz: 138 });
      this.callbacks.onCombatCallout?.(`PHASE II · ${bossProf.phase2Title.toUpperCase()}`, 'heavy');
      this.pushHudSnapshot();
    }
    for (const cast of ev.bossSignatureCasts) {
      this.slashes.push({
        active: true,
        x: cast.x,
        y: this.groundAt(cast.x, cast.z) + 0.12,
        z: cast.z,
        yaw: 0,
        age: 0,
        duration: 0.62,
        isRadial: true,
        r: cast.rgb[0],
        g: cast.rgb[1],
        b: cast.rgb[2],
      });
      const hexCol =
        (Math.round(cast.rgb[0] * 255) << 16) |
        (Math.round(cast.rgb[1] * 255) << 8) |
        Math.round(cast.rgb[2] * 255);
      this.spawnParticles(cast.x, this.groundAt(cast.x, cast.z) + 1.6, cast.z, 22, hexCol, 6.8);
    }
    if (ev.spawnedProjectiles.length > 0) {
      this.projectiles.push(...ev.spawnedProjectiles);
    }
    if (ev.playerDamaged > 0) {
      this.applyPlayerHit(ev.playerDamaged);
    }

    // Solid Dynamic Body Separation (Player <-> NPCs <-> Enemies <-> Enemies <-> Same-Realm Allies)
    const sameRealmAllies = filterSameRealmPlayers(this.remotePlayers, this.activeRealm.slug);
    const sep = resolveDynamicBodySeparation(
      { x: this.playerX, z: this.playerZ, radius: PLAYER_COLLISION_RADIUS },
      this.enemies,
      this.npcs,
      sameRealmAllies,
    );
    // Final static containment pass so dynamic separation can never push player or enemies into walls
    const finalPlayer = resolveCircleVsWorld(
      sep.playerX,
      sep.playerZ,
      PLAYER_COLLISION_RADIUS,
      this.playerY,
      this.collisionMap,
    );
    this.playerX = finalPlayer.x;
    this.playerZ = finalPlayer.z;

    for (const e of this.enemies) {
      if (e.state === 'ko' || e.hp <= 0) continue;
      const eY = this.groundAt(e.x, e.z);
      // Prevent enemies from clipping into sheer cliff walls or marching effortlessly through deep water
      if (!this.activeRealm.isDungeon) {
        const eSlope = sampleTerrainSlope((x, z) => this.groundAt(x, z), e.x, e.z);
        if (!eSlope.climbable) {
          const gl = Math.hypot(eSlope.gradX, eSlope.gradZ) || 1;
          e.x -= (eSlope.gradX / gl) * 0.25;
          e.z -= (eSlope.gradZ / gl) * 0.25;
        }
      }
      const resE = resolveCircleVsWorld(
        e.x,
        e.z,
        getEnemyCollisionRadius(e.archetype),
        eY,
        this.collisionMap,
      );
      e.x = resE.x;
      e.z = resE.z;
    }

    // Step enemy projectiles & shatter against solid walls, pillars, and masonry
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y = this.groundAt(p.x, p.z) + 1.1;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      if (isProjectileBlockedByWorld(p.x, p.z, p.y, 0.35, this.collisionMap)) {
        this.spawnParticles(p.x, p.y, p.z, 10, 0x52d6f4, 4.4);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.fromEnemy && Math.hypot(p.x - this.playerX, p.z - this.playerZ) < 1.15) {
        this.projectiles.splice(i, 1);
        if (this.dodgeTimer <= 0) {
          this.applyPlayerHit(p.damage);
        }
      }
    }

    // Ray-marched third-person spring-arm camera (wall/pillar occlusion avoidance + zoom + Verdant WASM sync)
    const isDg = Boolean(this.activeRealm.isDungeon);
    const desiredDist = isDg ? Math.min(this.camDist, 7.6) : this.camDist;
    const anchorY = this.playerY + 1.58;
    const spring = resolveSpringArmCamera({
      anchorX: this.playerX,
      anchorY,
      anchorZ: this.playerZ,
      camYaw: this.camYaw,
      camPitch: this.camPitch,
      desiredDist,
      isDungeon: isDg,
      collisionMap: this.collisionMap,
      groundAt: (x, z) => this.groundAt(x, z),
    });

    // Feed live anchor & pose intent into Verdant Engine WASM Camera API
    if (this.wasm) {
      if (typeof this.wasm.verdant_wasm_camera_set_anchor === 'function') {
        this.wasm.verdant_wasm_camera_set_anchor(this.playerX, anchorY, this.playerZ, 0);
      }
      if (typeof this.wasm.verdant_wasm_camera_set_pose_intent === 'function') {
        this.wasm.verdant_wasm_camera_set_pose_intent(
          this.camYaw,
          this.camPitch,
          spring.resolvedDist,
        );
      }
    }

    const shake = this.cameraTrauma * this.cameraTrauma * 0.42;
    const alpha = 1 - Math.exp(-(spring.obstructed ? 18.0 : 12.5) * dt);
    this.camEye[0] += (spring.eyeX + (Math.random() - 0.5) * shake - this.camEye[0]) * alpha;
    this.camEye[1] += (spring.eyeY + (Math.random() - 0.5) * shake - this.camEye[1]) * alpha;
    this.camEye[2] += (spring.eyeZ - this.camEye[2]) * alpha;

    // Look ahead slightly when zoomed out, and focus crisply at head/chest height when zoomed in
    const lookLead = Math.max(0.8, (spring.resolvedDist - 3.6) * 0.42);
    this.camTarget[0] = this.playerX + Math.sin(this.camYaw) * lookLead;
    this.camTarget[1] = this.playerY + 1.56 + Math.min(0.45, (spring.resolvedDist - 4.0) * 0.06);
    this.camTarget[2] = this.playerZ + Math.cos(this.camYaw) * lookLead;

    // Feed live spatial listener pose to Verdant Wasm binaural engine -> AudioWorklet!
    if (this.wasm && this.onSpatialAudio) {
      const dx = this.camTarget[0] - this.camEye[0];
      const dz = this.camTarget[2] - this.camEye[2];
      const l = Math.hypot(dx, dz) || 1;
      // Sound source anchored at Great Foundry Bell / Citadel Waystone
      const pan = this.wasm.verdant_wasm_binaural_pan(
        0,
        2.5,
        -10.5,
        this.camEye[0],
        this.camEye[1],
        this.camEye[2],
        dx / l,
        0,
        dz / l,
      );
      const gain = this.wasm.verdant_wasm_binaural_gain();
      const itdMicros = this.wasm.verdant_wasm_binaural_itd_micros();
      this.onSpatialAudio({ pan, gain, itdMicros });
    }

    // Drive dynamic orchestral combat intensity from nearby hostile engagement
    if (this.onCombatIntensity) {
      let targetIntensity = 0;
      for (const e of this.enemies) {
        if (e.state === 'ko' || e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.playerX, e.z - this.playerZ);
        if (d < 18) {
          const proximity = Math.max(0, 1 - d / 18);
          const aggression =
            e.state === 'telegraph' || e.state === 'attack'
              ? 1.0
              : e.state === 'approach' || e.state === 'recover'
                ? 0.72
                : 0.35;
          targetIntensity = Math.max(targetIntensity, Math.min(1, proximity * 0.65 + aggression * 0.45));
        }
      }
      this.smoothedCombatIntensity += (targetIntensity - this.smoothedCombatIntensity) * Math.min(1, dt * 2.2);
      this.onCombatIntensity(this.smoothedCombatIntensity);
    }
  }

  private applyPlayerHit(dmg: number): void {
    const mitigated =
      this.damageReductionPct > 0
        ? Math.max(1, Math.round(dmg * (1 - this.damageReductionPct / 100)))
        : dmg;
    this.hp = Math.max(0, this.hp - mitigated);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.46);
    this.spawnParticles(
      this.playerX,
      this.playerY + 1.1,
      this.playerZ,
      12,
      this.damageReductionPct > 0 ? 0xe5be6a : 0xe05858,
      4.8,
    );
    this.callbacks.onAudioEvent({ kind: 'hit', heavy: true });
    this.callbacks.onCombatCallout?.(
      this.damageReductionPct > 0 ? `-${Math.round(mitigated)} (Warded)` : `-${Math.round(mitigated)}`,
      'damage',
    );
    const defeated = this.hp <= 0;
    if (defeated) {
      this.callbacks.onAudioEvent({ kind: 'defeat' });
    }
    this.callbacks.onPlayerDamaged(Math.round(this.hp), defeated);
    this.pushHudSnapshot();
  }

  private renderFrame(): void {
    if (!this.renderer || !this.rendererMod || !this.staticViews) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= 0 || h <= 0) return;

    const sameRealmPlayers = filterSameRealmPlayers(this.remotePlayers, this.activeRealm.slug);
    const sameRealmBanners = filterSameRealmBanners(this.banners, this.activeRealm.slug);
    const sameRealmPings = this.worldPings.filter((p) => p.realmSlug === this.activeRealm.slug);

    const prox = this.findNearestPrompt();
    const dynViews = this.batcher.build({
      timeSec: this.simTime,
      playerX: this.playerX,
      playerY: this.playerY,
      playerZ: this.playerZ,
      playerYaw: this.playerYaw,
      playerSpeed: this.playerSpeed,
      attackSwing: this.attackSwing,
      activeGear: this.activeGear,
      dodgeTimer: this.dodgeTimer,
      npcs: this.npcs,
      enemies: this.enemies,
      interactables: this.interactables,
      banners: sameRealmBanners,
      remotePlayers: sameRealmPlayers,
      remoteVisualPoses: this.remoteVisuals,
      worldPings: sameRealmPings,
      projectiles: this.projectiles,
      particles: this.particles,
      slashes: this.slashes,
      trackedCoords: this.phase === 'playing' ? this.trackedCoords : null,
      highlightInteractableId: prox?.kind === 'interactable' ? prox.id : null,
      heightAt: (x, z) => this.groundAt(x, z),
      waterLevel: this.activeRealm.terrainProfile.waterLevel,
      waterTiles: this.waterTiles,
      playerWaterPosture: this.waterPosture,
      gorgeZ: this.activeRealm.terrainProfile.gorgeZ,
      gorgeWaveAmp: this.activeRealm.terrainProfile.gorgeWaveAmp,
      showMagmaSeams: this.activeRealm.slug === 'vaelmor',
      showCoastalInlet:
        !this.activeRealm.isDungeon &&
        (this.activeRealm.theme === 'citadel-highlands' ||
          this.activeRealm.theme === 'pelagic-spires' ||
          this.activeRealm.theme === 'sunken-aqueducts'),
      isDungeon: Boolean(this.activeRealm.isDungeon),
      dungeonStyle: this.activeRealm.dungeonStyle,
      faunaKit: this.activeFaunaKit,
      thermalVents: this.activeThermalVents,
      ambientParticleKind: this.activePhenomenon.ambientParticleKind,
      ambientRgb: this.activePhenomenon.ambientRgb,
      playerRelicAuraRgb: this.playerRelicAuraRgb,
      modelResolutionTier: this.modelResolutionTier,
    });

    this.renderer.uploadSplitBuffers(
      this.staticUploaded ? null : this.staticViews,
      dynViews,
      null,
    );
    this.staticUploaded = true;

    const fov = Math.PI / 3.35;
    const aspect = w / h;
    const proj = this.rendererMod.mat4Perspective(fov, aspect, 0.25, 360.0);
    const view = this.rendererMod.mat4LookAt(this.camEye, this.camTarget, [0, 1, 0]);
    const mvp = this.rendererMod.mat4Mul(proj, view);

    // Project same-realm ally world positions into CSS viewport pixels for crisp 3D floating nameplates
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    if (sameRealmPlayers.length > 0) {
      const nextProjected: ProjectedAllyScreenPos[] = [];
      for (const rp of sameRealmPlayers) {
        const pose = this.remoteVisuals.get(rp.id);
        const rx = pose ? pose.x : rp.x;
        const rz = pose ? pose.z : rp.z;
        const groundY = this.groundAt(rx, rz);
        const realmWaterLevel = this.activeRealm.terrainProfile.waterLevel;
        const isSwim =
          !this.activeRealm.isDungeon &&
          rp.waterPosture === 'swimming' &&
          typeof realmWaterLevel === 'number';
        const ry = isSwim ? (realmWaterLevel as number) - 0.92 : groundY;
        const dist = Math.hypot(rx - this.playerX, rz - this.playerZ);
        const labelOffset = dist <= 2.6 ? 2.08 : 2.38;
        const projected = projectWorldToScreen([rx, ry + labelOffset, rz], mvp, cssW, cssH);
        nextProjected.push({
          id: rp.id,
          name: rp.name,
          guildId: rp.guildId,
          hp: rp.hp ?? 100,
          maxHp: rp.maxHp ?? 100,
          screenX: projected.screenX,
          screenY: projected.screenY,
          distance: Math.round(dist),
          visible: projected.visible && dist < 85,
          activeGear: rp.activeGear,
          actionPulseAt: rp.actionPulseAt,
        });
      }
      this.projectedAllies = nextProjected;
    } else if (this.projectedAllies.length > 0) {
      this.projectedAllies = [];
    }

    const renderProf = this.modelObserver.getRenderResolutionProfile();
    const lodSpec = {
      rank: renderProf.lodRank,
      sky: this.activeRealm.skyFallbackRgb,
      fog: this.activeRealm.fogRgb,
    };

    this.renderer.render(
      mvp,
      this.camEye,
      lodSpec,
      this.simTime,
      this.camTarget,
      fov,
      false,
    );
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.004, (now - this.lastNow) / 1000));
    this.lastNow = now;

    // Skip expensive 3D WebGL2 rasterization while Scenes I-IV opaque paintings cover 100% of viewport
    if (this.phase === 'intro' && this.introBackdropOpaque) {
      this.frameId = window.setTimeout(this.tick, 220);
      return;
    }

    this.stepSimulation(dt);
    this.renderFrame();

    if (this.phase === 'playing' && now - this.lastHudPush > 110) {
      this.lastHudPush = now;
      this.pushHudSnapshot();
    }

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(this.tick, 64);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
    delete (window as unknown as Record<string, unknown>).__VERDANT_MODEL_API__;
  }
}
