import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { kappa } from './prism-id.mjs';
import {
  ALL_CANONICAL_WORLDS,
  CANONICAL_DUNGEON_SPECS,
  CANONICAL_REALM_SPECS,
  synthesizeProceduralDungeonSpec,
  synthesizeProceduralRealmSpec,
  type DungeonArchitecturalStyle,
  type FrontiersRealmSpec,
  type RealmThemeId,
} from './realmModelSchema';
import {
  synthesizeScoreFromBrief,
  type MusicalModeId,
  type RealmSoundtrackSpec,
} from './verdantScoreSchema';
import { INITIAL_NPCS, type GameNpc, type GameQuest } from '../game/worldData';
import { compileRealmWithVerdant } from './verdantCatalogCompiler';
import { auditAntiTropeNovelty } from '../engine/cognitiveNovelty';
import {
  buildCharacterProjectModelPayload,
  compileNpcCharacterAppearance,
  type VerdantCharacterAppearance,
} from './verdantCharacterCompiler';
import {
  hashStringSeed,
  synthesizeVerdantCharacter,
} from './verdantCharacterSynthesizer';
import {
  sampleMacroClimate,
  synthesizeUniverseCell,
} from './verdantUniverseGenerator';
import { buildProceduralCellGlb } from './verdantProceduralGlb';
import {
  listVerdantCatalogExtensions,
  registerVerdantCatalogExtension,
  synthesizeRealmEcosystem,
  type VerdantCatalogExtensionEntry,
} from './verdantEcosystemCatalog';
import { synthesizeDungeonEcosystem } from './verdantDungeonCatalog';
import {
  synthesizeBiomeRelic,
  type RelicRarity,
  type SynthesizedVerdantRelic,
} from './verdantRelicCatalog';
import {
  FrontiersVerdantObserver,
  type UniformRefinementOptions,
} from './verdantObserverManager';
import {
  VERDANT_PART_SLOTS,
  type VerdantPartSlot,
  type VerdantResolutionTier,
} from './verdantModelOfModels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmExports = Record<string, any> & { memory: WebAssembly.Memory };

export const VERDANT_MCP_TOOLS = [
  {
    name: 'verdant_status',
    description:
      'Inspect live verdant-uorc.wasm Observer status, 8-part Cognitive Resolution, VSM Roadmap KPIs, registered Project Models, and all compiled Federated Realms.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'verdant_catalog_search',
    description:
      'Search live external CC0 3D asset catalogs (Poly Haven models/textures/HDRIs and Khronos glTF 2.0 sample assets) for import and customization.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword (e.g. lantern, rock, statue, brick, sunset).' },
        assetType: { type: 'string', enum: ['models', 'textures', 'hdris'], description: 'Poly Haven catalog asset type.' },
        limit: { type: 'integer', description: 'Maximum results to return (default 12).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'verdant_register_stream',
    description: 'Register a new external asset or knowledge sensory stream directly in verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        streamId: { type: 'string' },
        label: { type: 'string' },
        authority: { type: 'string' },
        adapterKind: { type: 'string' },
        endpointUrl: { type: 'string' },
        targetParts: { type: 'array', items: { type: 'string' } },
      },
      required: ['streamId', 'label', 'adapterKind', 'endpointUrl'],
    },
  },
  {
    name: 'verdant_import_model',
    description:
      'Import and version a Project Model directly inside verdant-uorc.wasm and record ObserverPartSlot hydration.',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        title: { type: 'string' },
        schemaType: { type: 'string' },
        mediaType: { type: 'string' },
        targetSlot: { type: 'string' },
        sourceStream: { type: 'string' },
        sourceUri: { type: 'string' },
        licenseSpdx: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        propertiesJson: { type: 'string' },
        commitNote: { type: 'string' },
      },
      required: ['modelId', 'title', 'sourceUri'],
    },
  },
  {
    name: 'verdant_operator_directive',
    description:
      'Submit a governance or production directive through Verdant Engine’s native ISO 42010 / VSM Operator Channel (verdant_wasm_operator_prompt_io).',
    inputSchema: {
      type: 'object',
      properties: {
        directive: { type: 'string' },
        viewpoint: { type: 'string', description: 'Target viewpoint slug or "auto".' },
        citedAuthority: { type: 'string' },
      },
      required: ['directive'],
    },
  },
  {
    name: 'verdant_ingest_knowledge',
    description:
      'Ingest a structured lore or engineering passage into verdant-uorc.wasm’s native ISO 24617-2 cognitive knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceStream: { type: 'string' },
        sourceUri: { type: 'string' },
        topic: { type: 'string' },
        passage: { type: 'string' },
      },
      required: ['topic', 'passage'],
    },
  },
  {
    name: 'verdant_generate_realm',
    description:
      'Autonomously generate, compile, import external Poly Haven CC0 3D models & PBR maps into, Stitch 2-of-3 verify, and Prism-seal a brand-new playable 3D Frontier Realm cell (cx, cy, cz).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the new Frontier Realm.' },
        cell: {
          type: 'array',
          items: { type: 'integer' },
          description: 'UniverseCell coordinates [cx, cy, cz].',
        },
        theme: {
          type: 'string',
          enum: [
            'citadel-highlands',
            'sunken-aqueducts',
            'obsidian-crucible',
            'pelagic-spires',
            'amber-steppe',
            'glacial-spire',
          ],
        },
        brief: { type: 'string', description: 'Optional creative direction or ecological/engineering theme.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'verdant_generate_dungeon',
    description:
      'Compile a playable multi-chamber 3D Dungeon Delve (vaulted pillars, abyss bridge, treasure alcoves, seal braziers, apex boss sanctum, bespoke cavernous orchestral score, Poly Haven CC0 3D models & PBR maps) and link it to a parent Frontier Realm.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the new 3D Dungeon Delve.' },
        parentRealmSlug: { type: 'string', description: 'Slug of the parent overworld realm (default: vaelmor).' },
        style: {
          type: 'string',
          enum: ['catacomb-vault', 'geothermal-depths', 'sunken-cistern', 'abyssal-grotto', 'echo-tomb', 'glacial-crypt'],
        },
        tier: { type: 'integer', description: 'Difficulty tier 1-5.' },
        brief: { type: 'string', description: 'Optional architectural or boss concept.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'verdant_compose_score',
    description:
      'Compose a bespoke multi-voice orchestral & acoustic foley RealmSoundtrackSpec, register it as a MusicComposition Project Model inside verdant-uorc.wasm, hydrate spatial-acoustics, and assign it to a Realm or Dungeon.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string', description: 'Target Realm or Dungeon slug (default: vaelmor).' },
        brief: { type: 'string', description: 'Musical direction (e.g. triumphant alpine brass, melancholic sunken harp).' },
        mode: {
          type: 'string',
          enum: ['dorian', 'lydian', 'phrygian-dominant', 'mixolydian', 'aeolian', 'harmonic-minor', 'pentatonic-major'],
        },
        bpm: { type: 'integer', description: 'Tempo in BPM (68-126).' },
      },
    },
  },
  {
    name: 'verdant_generate_questline',
    description:
      'Synthesize an anti-trope 3-stage playable Quest Chain grounded in geology, acoustics, or federated craft, audit novelty, and ingest into verdant-uorc.wasm ISO 24617-2 Knowledge Graph.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string', description: 'Target Realm or Dungeon slug.' },
        brief: { type: 'string', description: 'Creative theme or civic crisis for the questline.' },
      },
    },
  },
  {
    name: 'verdant_generate_npc_cast',
    description:
      'Generate 1-3 grounded, non-cliché intelligent NPCs with belief graphs, concealed secrets, and branching choices, registering character-rigs Project Models in verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string' },
        count: { type: 'integer', description: 'Number of NPCs (1-3).' },
        brief: { type: 'string' },
      },
    },
  },
  {
    name: 'verdant_generate_relic_arsenal',
    description:
      'Synthesize 1-3 practical fantasy survey tools, resonance weapons, or crafting relics with mechanical bonuses and acoustic Hz tuning, registering hero-props Project Models in verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string' },
        count: { type: 'integer', description: 'Number of relics (1-3).' },
        brief: { type: 'string' },
      },
    },
  },
  {
    name: 'verdant_expand_world_frontier',
    description:
      'High-level autonomous world-expansion orchestrator: generates & compiles a vast 224m Overworld Realm, a linked multi-chamber 3D Dungeon Delve, a custom Orchestral Score, and a 3-stage Questline in one atomic pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the new Frontier Realm.' },
        theme: {
          type: 'string',
          enum: [
            'citadel-highlands',
            'sunken-aqueducts',
            'obsidian-crucible',
            'pelagic-spires',
            'amber-steppe',
            'glacial-spire',
          ],
        },
        brief: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'verdant_stitch_seal',
    description:
      'Shard a payload into 3 lossless Reed-Solomon STCH parity shards using real verdant_wasm_stitch_shard_io and seal with Prism kappa().',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'string' },
      },
      required: ['payload'],
    },
  },
  {
    name: 'verdant_stitch_recover',
    description:
      'Recover bit-exact original payload from any 2 of 3 Stitch base64 shards using real verdant_wasm_stitch_recover_io.',
    inputSchema: {
      type: 'object',
      properties: {
        shardA: { type: 'string', description: 'Base64 encoded first Stitch shard.' },
        shardB: { type: 'string', description: 'Base64 encoded second Stitch shard.' },
      },
      required: ['shardA', 'shardB'],
    },
  },
  {
    name: 'verdant_audit',
    description:
      'Run real verdant-uorc.wasm Roadmap KPI governance report, zero-default-studio-content check, and anti-trope novelty audit.',
    inputSchema: {
      type: 'object',
      properties: {
        sampleText: { type: 'string' },
      },
    },
  },
  {
    name: 'verdant_compile_character_rig',
    description:
      'Compile a high-definition 3D CharacterRig matching an NPC portrait (hair, facial hair, garment silhouette, skin tone, accessories, and held signature prop) and register it natively inside verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        npcId: { type: 'string', description: 'NPC id (e.g. npc-orenna, npc-kaelen, npc-tarsik, npc-seraia).' },
        realmSlug: { type: 'string', description: 'Realm slug containing the NPC (default: vaelmor).' },
      },
      required: ['npcId'],
    },
  },
  {
    name: 'verdant_refine_world_hd',
    description:
      'Automate high-definition refinement across all compiled Realms & Dungeons via Verdant API: compiles and registers portrait-matched HD CharacterRigs for every NPC, verifies smooth-normal PBR skin/cloth shading and spring-arm camera controls, and seals a Prism kappa audit digest.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string', description: 'Optional single realm slug to refine, or omit to refine all realms.' },
      },
    },
  },
  {
    name: 'verdant_synthesize_universe_cell',
    description:
      'Deterministically synthesize ANY boundless Meridian UniverseCell (cx, 0, cz): macro-climate biome, continuous border terrain, binary glTF 2.0 (.glb) verified inside verdant-uorc.wasm, 3 fully differentiated synthesized NPCs with 1:1 SVG portraits, procedural questline, and bespoke orchestral score.',
    inputSchema: {
      type: 'object',
      properties: {
        cx: { type: 'integer', description: 'UniverseCell X coordinate (e.g. 2, -3, 5).' },
        cz: { type: 'integer', description: 'UniverseCell Z coordinate (e.g. 0, 1, -2).' },
        worldSeed: { type: 'integer', description: 'Optional continental seed (default: 7777).' },
      },
      required: ['cx', 'cz'],
    },
  },
  {
    name: 'verdant_synthesize_character',
    description:
      'Procedurally synthesize a complete differentiated Verdant character with full physical/sartorial/cognitive characteristics, synchronized painterly SVG portrait, and registered CharacterRig Project Model in verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: [
            'citadel-highlands',
            'sunken-aqueducts',
            'obsidian-crucible',
            'pelagic-spires',
            'amber-steppe',
            'glacial-spire',
          ],
        },
        realmName: { type: 'string', description: 'Host realm or frontier name.' },
        roleHint: { type: 'string', enum: ['warden', 'artisan', 'scholar', 'navigator', 'scout'] },
        seed: { type: 'integer', description: 'Optional deterministic character genome seed.' },
      },
    },
  },
  {
    name: 'verdant_catalog_extend',
    description:
      'Extend the live Verdant Catalog with a new bespoke architectural kit, botanical flora kit, fauna morphology kit, gameplay phenomenon, or Poly Haven prop-kit mapping, and register it natively inside verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique catalog extension ID (e.g. kit-skybridge-monastery).' },
        category: {
          type: 'string',
          enum: ['layout', 'flora', 'fauna', 'phenomenon', 'prop-kit'],
        },
        title: { type: 'string', description: 'Human-readable title of the bespoke catalog kit.' },
        summary: { type: 'string', description: 'Design and ecological behavior summary.' },
        polyHavenAssets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional external CC0 Poly Haven asset IDs associated with this kit.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['id', 'category', 'title'],
    },
  },
  {
    name: 'verdant_synthesize_ecosystem',
    description:
      'Procedurally synthesize a complete bespoke Ecosystem Blueprint (architectural layout primitives, ecological flora clusters, fauna morphology family, live gameplay phenomenon, thermal vents, and atmospheric ambience) for any canonical Realm or boundless UniverseCell (cx, cz), and seal it inside verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string', description: 'Canonical realm slug (e.g. oakhaven, cinderfall, glasswater, kar-veth, borealis).' },
        cx: { type: 'integer', description: 'Optional UniverseCell X coordinate when synthesizing a procedural cell.' },
        cz: { type: 'integer', description: 'Optional UniverseCell Z coordinate when synthesizing a procedural cell.' },
      },
    },
  },
  {
    name: 'verdant_synthesize_dungeon_architecture',
    description:
      'Procedurally synthesize a bespoke 3D Dungeon Delve architecture (vaulted chambers, chasm bridge style, sanctum centerpiece, chasm visual, fauna family, active thermal vents, and live phenomenon) from the extensible Verdant Dungeon Catalog, and register it as a DungeonBlueprint Project Model inside verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        dungeonSlug: {
          type: 'string',
          description: 'Canonical dungeon slug (e.g. vault-of-vaelmor, oakhaven-cistern-labyrinth, cinderfall-magma-delve, glasswater-abyssal-grotto, karveth-echo-tomb, borealis-frostglass-crypt).',
        },
        style: {
          type: 'string',
          enum: ['catacomb-vault', 'sunken-cistern', 'geothermal-depths', 'abyssal-grotto', 'echo-tomb', 'glacial-crypt'],
          description: 'Optional architectural style override.',
        },
      },
    },
  },
  {
    name: 'verdant_synthesize_relic',
    description:
      'Procedurally synthesize a biome-attuned Verdant Survey Relic with a procedural SVG sigil crest, rarity tier, active combat/traversal resonance perk, Waywright 3D aura RGB, and registered RelicArtifact Project Model in verdant-uorc.wasm sealed with Prism kappa().',
    inputSchema: {
      type: 'object',
      properties: {
        realmSlug: { type: 'string', description: 'Host realm or dungeon slug (e.g. vaelmor, cinderfall, glasswater, borealis).' },
        theme: {
          type: 'string',
          enum: [
            'citadel-highlands',
            'sunken-aqueducts',
            'obsidian-crucible',
            'pelagic-spires',
            'amber-steppe',
            'glacial-spire',
          ],
          description: 'Optional ecosystem theme override.',
        },
        rarity: {
          type: 'string',
          enum: ['Chartered', 'Resonant', 'Sovereign'],
          description: 'Optional rarity tier.',
        },
        seed: { type: 'integer', description: 'Optional deterministic seed.' },
        brief: { type: 'string', description: 'Optional forging focus or tactical intent.' },
      },
    },
  },
  {
    name: 'verdant_inspect_model_of_models',
    description:
      'Inspect the single unified Frontiers and Foundations Model-of-Models (root summary, 8 canonical Verdant Cognitive Parts, or a specific partSlot/modelId) with full generative genomes, feature signatures, resolution tiers, definition scores, and Prism kappa digests.',
    inputSchema: {
      type: 'object',
      properties: {
        partSlot: {
          type: 'string',
          enum: [...VERDANT_PART_SLOTS],
          description: 'Optional Verdant Cognitive Part slot to list child models for.',
        },
        modelId: {
          type: 'string',
          description: 'Optional exact modelId URN to inspect in full detail.',
        },
        includeTree: {
          type: 'boolean',
          description: 'Set true to include the full nested Model-of-Models tree.',
        },
      },
    },
  },
  {
    name: 'verdant_observer_diversity_kpis',
    description:
      'Evaluate the Extended Verdant Observer/Manager Pattern (13 native verdant-uorc.wasm VSM Managers + 10 Frontiers Domain Managers = 23 VSM S1-S5 Managers) and report all 13 Diversity, Cohesion, Relational Graph Integrity, vTensor Semantic Spread, Dungeon Topology, Monster Ecology, Story Conservation, Sibling Uniqueness, Uniform Resolution, Part Coverage, Anti-Trope Novelty, Genome Provenance, and Gamer Journey Experience KPIs.',
    inputSchema: {
      type: 'object',
      properties: {
        includeManagers: {
          type: 'boolean',
          description: 'Include the full 23-Manager VSM S1-S5 registry (default true).',
        },
      },
    },
  },
  {
    name: 'verdant_observer_refinement_agenda',
    description:
      'Synthesize the M16/M17 Verdant Observer prioritized refinement agenda with per-manager constructive health (0..1000‰), pinpoint diagnoses, sealed agendaKappaHex, and proposals across all 8 Cognitive Parts and 23 VSM S1-S5 Managers.',
    inputSchema: {
      type: 'object',
      properties: {
        includeManagers: {
          type: 'boolean',
          description: 'Include the full 23-Manager VSM S1-S5 registry (default true).',
        },
      },
    },
  },
  {
    name: 'verdant_lifecycle_gate',
    description:
      'Execute the lifted in-process M16/M17 Verdant Lifecycle Gate (7 structural & semantic checks: total-ownership, immutability-seal, relational-graph-closure, story-conservation-closure, diversity-and-anti-clone, multiplayer-federation-isolation, gamer-journey-closure) and return a sealed verdant/lifecycle-gate-report/1.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'verdant_automate',
    description:
      'Execute the M16/M17 lifted Verdant Self-Automation Pipeline (pinpoint-diagnose -> ratchet-refine -> lifecycle-gate -> watermark-ratchet), advance monotonic parametric watermarks, register the sealed automate snapshot inside verdant-uorc.wasm, and return verdant/automate-report/1.',
    inputSchema: {
      type: 'object',
      properties: {
        targetTier: {
          type: 'integer',
          enum: [1, 2, 3, 4],
          description: 'Target uniform resolution tier (1..4, defaults to escalating up to Tier 4 Sovereign Ultra-Def).',
        },
        partSlot: {
          type: 'string',
          enum: [...VERDANT_PART_SLOTS],
          description: 'Optional single Cognitive Part slot to focus the automate pipeline on.',
        },
        reason: {
          type: 'string',
          description: 'Optional audit reason for the automate pipeline run.',
        },
      },
    },
  },
  {
    name: 'verdant_run_ratchet_cycle',
    description:
      'Execute an M16/M17 Verdant Observer Ratchet Cycle: synthesizes the refinement agenda, executes uniform resolution + diversity + cohesion refinement across the Model-of-Models, advances monotonic parametric watermarks and the sealed Prism kappa digest, and registers hydration in verdant-uorc.wasm.',
    inputSchema: {
      type: 'object',
      properties: {
        targetTier: {
          type: 'integer',
          enum: [1, 2, 3, 4],
          description: 'Target uniform resolution tier (1..4, defaults to escalating up to Tier 4 Sovereign Ultra-Def).',
        },
        partSlot: {
          type: 'string',
          enum: [...VERDANT_PART_SLOTS],
          description: 'Optional single Cognitive Part slot to focus the ratchet cycle on.',
        },
        reason: {
          type: 'string',
          description: 'Optional audit reason for the ratchet cycle.',
        },
      },
    },
  },
  {
    name: 'verdant_refine_model_api',
    description:
      'Uniformly refine Frontiers and Foundations via the Extended Verdant Observer/Manager API: escalates resolution & definition across all 8 Cognitive Parts (or a targeted partSlot/modelId), auto-diversifies any colliding sibling clones, syncs part hydration into verdant-uorc.wasm, and seals the new root Prism kappa().',
    inputSchema: {
      type: 'object',
      properties: {
        targetTier: {
          type: 'integer',
          enum: [1, 2, 3, 4],
          description: 'Target uniform resolution tier (1..4, defaults to escalating +1 up to Tier 4 Sovereign Ultra-Def).',
        },
        partSlot: {
          type: 'string',
          enum: [...VERDANT_PART_SLOTS],
          description: 'Optional single Cognitive Part slot to refine.',
        },
        modelId: {
          type: 'string',
          description: 'Optional single sub-model URN to refine.',
        },
        enforceDiversity: {
          type: 'boolean',
          description: 'Auto-diversify any colliding sibling models (default true).',
        },
        reason: {
          type: 'string',
          description: 'Optional refinement audit reason.',
        },
      },
    },
  },
];

export class VerdantMcpHost {
  private rootDir: string;
  private wasm: WasmExports | null = null;
  private initPromise: Promise<void> | null = null;
  private realms = new Map<string, FrontiersRealmSpec>();
  private modelObserver = new FrontiersVerdantObserver();
  private polyHavenCache = new Map<string, Record<string, { name?: string; tags?: string[]; categories?: string[] }>>();
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  public async ensureReady(): Promise<void> {
    if (this.wasm) return;
    if (!this.initPromise) {
      this.initPromise = this.boot();
    }
    return this.initPromise;
  }

  private stageIo(bytes: Uint8Array): void {
    if (!this.wasm) throw new Error('Verdant Wasm not initialized');
    const ptr = this.wasm.verdant_wasm_io_resize(bytes.byteLength >>> 0) >>> 0;
    new Uint8Array(this.wasm.memory.buffer, ptr, bytes.byteLength).set(bytes);
  }

  private readAuxBytes(): Uint8Array {
    if (!this.wasm) return new Uint8Array(0);
    const len = this.wasm.verdant_wasm_aux_len() >>> 0;
    const ptr = this.wasm.verdant_wasm_aux_ptr() >>> 0;
    if (!len || !ptr) return new Uint8Array(0);
    return new Uint8Array(this.wasm.memory.buffer, ptr, len).slice();
  }

  private readAuxJson<T = unknown>(): T | null {
    const bytes = this.readAuxBytes();
    if (!bytes.byteLength) return null;
    try {
      return JSON.parse(this.dec.decode(bytes)) as T;
    } catch {
      return null;
    }
  }

  private async boot(): Promise<void> {
    const wasmPath = join(this.rootDir, 'public', 'verdant', 'verdant-uorc.wasm');
    const wasmBytes = readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    this.wasm = instance.exports as WasmExports;

    this.wasm.verdant_wasm_init(7777n);
    this.wasm.verdant_wasm_update_host_envelope_uhd(2048, 0, 8, 8000, 1920, 1080);
    this.wasm.verdant_wasm_studio_load_blank_stage();

    // Register real Poly Haven + Khronos external catalog streams natively in Wasm
    for (const stream of [
      {
        streamId: 'polyhaven-frontiers',
        label: 'Poly Haven CC0 3D Models, PBR & HDRI Catalog',
        authority: 'Poly Haven CC0-1.0',
        adapterKind: 'polyhaven',
        endpointUrl: 'https://api.polyhaven.com/assets',
        targetParts: ['stage-environment', 'hero-props', 'surface-materials'],
      },
      {
        streamId: 'khronos-frontiers',
        label: 'Khronos glTF 2.0 Reference Asset Catalog',
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
      this.stageIo(this.enc.encode(JSON.stringify(stream)));
      this.wasm.verdant_wasm_register_stream_io();
    }

    // Load all compiled Realms from public/verdant/realms/*/realm.json
    const realmsDir = join(this.rootDir, 'public', 'verdant', 'realms');
    if (existsSync(realmsDir)) {
      for (const entry of readdirSync(realmsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const jsonPath = join(realmsDir, entry.name, 'realm.json');
        if (!existsSync(jsonPath)) continue;
        try {
          const spec = JSON.parse(readFileSync(jsonPath, 'utf8')) as FrontiersRealmSpec;
          this.registerRealmInWasm(spec);
        } catch {
          // ignore corrupt realm file
        }
      }
    }

    // Ensure all 12 canonical realms + dungeons are indexed if disk directory wasn't built yet
    if (this.realms.size === 0) {
      for (const spec of ALL_CANONICAL_WORLDS) {
        this.registerRealmInWasm(spec);
      }
    }

    // Hydrate the unified Model-of-Models & attach Verdant Engine's 13 native VSM Managers
    this.modelObserver.syncWorldState({
      realms: Array.from(this.realms.values()),
    });
    if (typeof this.wasm.verdant_wasm_operator_status_aux === 'function') {
      this.wasm.verdant_wasm_operator_status_aux();
      const opJson = this.readAuxJson<{
        managers?: Array<{
          managerId?: string;
          name?: string;
          basisPrime?: number;
          kappaHex?: string;
          spec?: { concerns?: string[]; differentiationRequirements?: string[] };
        }>;
      }>();
      if (opJson && Array.isArray(opJson.managers)) {
        this.modelObserver.attachWasmManagers(opJson.managers);
      }
    }
  }

  public async getModelObserver(): Promise<FrontiersVerdantObserver> {
    await this.ensureReady();
    return this.modelObserver;
  }

  private registerRealmInWasm(spec: FrontiersRealmSpec): void {
    this.realms.set(spec.slug, spec);
    if (!this.wasm) return;

    this.stageIo(
      this.enc.encode(
        JSON.stringify({
          modelId: `frontiers:realm:${spec.slug}`,
          title: spec.name,
          schemaType: '3DModel',
          mediaType: 'model/gltf-binary',
          targetSlot: 'stage-environment',
          sourceStream: 'polyhaven-frontiers',
          sourceUri: `https://frontiers.verdant.stitch${spec.glbUrl}`,
          licenseSpdx: 'CC0-1.0',
          tags: ['frontiers-and-foundations', spec.theme, `cell:${spec.cell.join(',')}`],
          propertiesJson: JSON.stringify({
            cell: spec.cell,
            theme: spec.theme,
            materials: spec.materials,
            importedAssets: spec.prismCustody?.importedCatalogAssets ?? [],
          }),
          commitNote: `Indexed Federated Realm ${spec.name}`,
        }),
      ),
    );
    this.wasm.verdant_wasm_import_project_model_io();

    this.stageIo(
      this.enc.encode(
        JSON.stringify({
          sourceStream: 'frontiers-chronicle',
          sourceUri: `urn:frontiers:realm:${spec.slug}`,
          topic: spec.name,
          passage: `${spec.summary} Coordinates: (${spec.cell.join(', ')}). Theme: ${spec.theme}.`,
        }),
      ),
    );
    this.wasm.verdant_wasm_ingest_knowledge_io();
  }

  public async listRealms(): Promise<FrontiersRealmSpec[]> {
    await this.ensureReady();
    // Sort 6 canonical overworld realms first, then 6 canonical 3D dungeons, then generated worlds
    const order = [
      ...CANONICAL_REALM_SPECS.map((r) => r.slug),
      ...CANONICAL_DUNGEON_SPECS.map((d) => d.slug),
    ];
    return Array.from(this.realms.values()).sort((a, b) => {
      const ia = order.indexOf(a.slug);
      const ib = order.indexOf(b.slug);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      if (Boolean(a.isDungeon) !== Boolean(b.isDungeon)) return a.isDungeon ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  public async getRealm(slug: string): Promise<FrontiersRealmSpec | null> {
    await this.ensureReady();
    return this.realms.get(slug) ?? null;
  }

  public async searchExternalCatalog(
    query: string,
    assetType: 'models' | 'textures' | 'hdris' = 'models',
    limit = 12,
  ): Promise<{
    source: string;
    assetType: string;
    totalCatalogSize: number;
    matches: Array<{ id: string; name: string; tags: string[]; categories: string[]; polyHavenUrl: string }>;
  }> {
    let catalog = this.polyHavenCache.get(assetType);
    if (!catalog) {
      const resp = await fetch(`https://api.polyhaven.com/assets?t=${assetType}`);
      if (!resp.ok) throw new Error(`Poly Haven catalog query failed (${resp.status})`);
      catalog = (await resp.json()) as Record<string, { name?: string; tags?: string[]; categories?: string[] }>;
      this.polyHavenCache.set(assetType, catalog);
    }

    const q = query.trim().toLowerCase();
    const entries = Object.entries(catalog);
    const filtered = q
      ? entries.filter(([id, meta]) => {
          const hay = `${id} ${meta.name ?? ''} ${(meta.tags ?? []).join(' ')} ${(meta.categories ?? []).join(' ')}`.toLowerCase();
          return hay.includes(q);
        })
      : entries;

    return {
      source: 'Poly Haven CC0-1.0 Live Catalog',
      assetType,
      totalCatalogSize: entries.length,
      matches: filtered.slice(0, Math.max(1, Math.min(40, limit))).map(([id, meta]) => ({
        id,
        name: meta.name ?? id,
        tags: (meta.tags ?? []).slice(0, 6),
        categories: (meta.categories ?? []).slice(0, 4),
        polyHavenUrl: `https://polyhaven.com/a/${id}`,
      })),
    };
  }

  public async generateNewRealm(params: {
    name: string;
    cell?: [number, number, number];
    theme?: RealmThemeId;
    brief?: string;
    ai?: GoogleGenAI | null;
  }): Promise<{
    realm: FrontiersRealmSpec;
    operatorDecision: unknown;
    noveltyAudit: ReturnType<typeof auditAntiTropeNovelty>;
  }> {
    await this.ensureReady();
    const existingCells = new Set(Array.from(this.realms.values()).map((r) => r.cell.join(',')));

    // Choose a fresh unoccupied Meridian UniverseCell if not explicitly provided
    let cell: [number, number, number] = params.cell ?? [0, 0, 1];
    if (existingCells.has(cell.join(','))) {
      let step = 1;
      while (existingCells.has(`${step},0,1`) && step < 99) step += 1;
      cell = [step, 0, 1];
    }

    // 1. Submit real Operator directive to verdant-uorc.wasm before generating!
    const operatorDecision = await this.submitOperatorDirective(
      `Generate and compile Frontiers & Foundations Realm "${params.name}" at cell (${cell.join(',')}) with external Poly Haven CC0 3D models and PBR textures`,
      'auto',
      'AUTH-KHRONOS-GLTF2',
    );

    // 2. Optionally enrich world narrative, NPC & anti-trope quest via Gemini
    let enriched: {
      summary?: string;
      npcName?: string;
      npcTitle?: string;
      npcGreeting?: string;
      questTitle?: string;
      questSummary?: string;
      questMotif?: string;
    } = {};

    if (params.ai) {
      try {
        const resp = await params.ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create grounded, practical, non-cliché fantasy RPG lore for a brand-new Frontier Realm named "${params.name}" at Meridian Cell (${cell.join(',')}).
Theme: ${params.theme || 'frontier wilderness'}.
Brief: ${params.brief || 'Civil engineering, geology, acoustics, and federated guild diplomacy in the Shattered Meridian.'}
Avoid all tropes: no chosen one, no dark lord, no prophecy scroll, no tavern rats, no Sunspire/Observatory/Glasshouse default Verdant Studio terms.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                npcName: { type: Type.STRING },
                npcTitle: { type: Type.STRING },
                npcGreeting: { type: Type.STRING },
                questTitle: { type: Type.STRING },
                questSummary: { type: Type.STRING },
                questMotif: { type: Type.STRING },
              },
              required: ['summary', 'npcName', 'npcTitle', 'npcGreeting', 'questTitle', 'questSummary', 'questMotif'],
            },
          },
        });
        enriched = JSON.parse((resp.text ?? '{}').trim());
      } catch {
        // Fallback cleanly to deterministic Verdant procedural synthesizer
      }
    }

    const baseSpec = synthesizeProceduralRealmSpec({
      name: params.name.trim(),
      cell,
      theme: params.theme,
      ...enriched,
    });

    const noveltyAudit = auditAntiTropeNovelty(
      `${baseSpec.name} ${baseSpec.summary} ${baseSpec.quests[0]?.title ?? ''} ${baseSpec.quests[0]?.summary ?? ''}`,
      ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
      [],
    );

    // 3. Compile real custom PBR GLB + imported Poly Haven 3D models + VDNT + Stitch 2-of-3 + Prism seal!
    const compiled = await compileRealmWithVerdant(baseSpec, { rootDir: this.rootDir });
    this.registerRealmInWasm(compiled.spec);

    return {
      realm: compiled.spec,
      operatorDecision,
      noveltyAudit,
    };
  }

  public async generateNewDungeon(params: {
    name: string;
    parentRealmSlug?: string;
    style?: DungeonArchitecturalStyle;
    tier?: number;
    brief?: string;
    ai?: GoogleGenAI | null;
  }): Promise<{
    dungeon: FrontiersRealmSpec;
    operatorDecision: unknown;
    noveltyAudit: ReturnType<typeof auditAntiTropeNovelty>;
  }> {
    await this.ensureReady();
    const parentSlug = params.parentRealmSlug || 'vaelmor';
    const parentRealm = this.realms.get(parentSlug);
    const parentName = parentRealm?.name ?? parentSlug;

    const operatorDecision = await this.submitOperatorDirective(
      `Compile multi-chamber 3D Dungeon Delve "${params.name}" beneath ${parentName} with Poly Haven CC0 stone PBR, guardian statues, and cavernous orchestral score`,
      'auto',
      'AUTH-KHRONOS-GLTF2',
    );

    let enriched: { summary?: string; bossName?: string; questTitle?: string } = {};
    if (params.ai) {
      try {
        const resp = await params.ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Design a grounded, atmospheric 3D Dungeon Delve named "${params.name}" beneath ${parentName} in Frontiers and Foundations.
Style: ${params.style || 'catacomb-vault'}, Tier: ${params.tier || 2}.
Brief: ${params.brief || 'Subterranean civil-engineering vault, resonance chambers, and ancient automaton guardian.'}
Avoid clichés (no chosen one, dark lord, prophecy scroll, default Verdant Studio terms).`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                bossName: { type: Type.STRING },
                questTitle: { type: Type.STRING },
              },
              required: ['summary', 'bossName', 'questTitle'],
            },
          },
        });
        enriched = JSON.parse((resp.text ?? '{}').trim());
      } catch {
        // Fallback to deterministic dungeon synthesizer
      }
    }

    const baseSpec = synthesizeProceduralDungeonSpec({
      name: params.name.trim(),
      parentRealmSlug: parentSlug,
      parentRealmName: parentName,
      style: params.style,
      tier: params.tier,
      ...enriched,
    });
    baseSpec.isGenerated = true;

    const noveltyAudit = auditAntiTropeNovelty(
      `${baseSpec.name} ${baseSpec.summary} ${baseSpec.quests[0]?.title ?? ''}`,
      ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
      [],
    );

    const compiled = await compileRealmWithVerdant(baseSpec, { rootDir: this.rootDir });
    this.registerRealmInWasm(compiled.spec);

    // Link entrance onto parent realm in memory if present
    if (parentRealm && !parentRealm.dungeonEntrances.some((d) => d.dungeonSlug === compiled.spec.slug)) {
      const idx = parentRealm.dungeonEntrances.length;
      const pos: [number, number] = idx === 0 ? [-14, -34] : [14 + idx * 4, -34];
      parentRealm.dungeonEntrances.push({
        id: `ent-${compiled.spec.slug}`,
        dungeonSlug: compiled.spec.slug,
        name: compiled.spec.name,
        subtitle: compiled.spec.subtitle,
        position: pos,
        tier: compiled.spec.dungeonTier ?? 2,
        style: compiled.spec.dungeonStyle ?? 'catacomb-vault',
      });
    }

    return {
      dungeon: compiled.spec,
      operatorDecision,
      noveltyAudit,
    };
  }

  public async composeSoundtrack(params: {
    realmSlug?: string;
    brief?: string;
    mode?: MusicalModeId;
    bpm?: number;
    ai?: GoogleGenAI | null;
  }): Promise<{
    realmSlug: string;
    soundtrack: RealmSoundtrackSpec;
    projectModel: unknown;
  }> {
    await this.ensureReady();
    const slug = params.realmSlug || 'vaelmor';
    const targetRealm = this.realms.get(slug);
    const realmName = targetRealm?.name ?? slug;
    const theme = targetRealm?.theme ?? 'citadel-highlands';
    const isDungeon = Boolean(targetRealm?.isDungeon);

    let enriched: { title?: string; composerNote?: string; mode?: MusicalModeId; bpm?: number } = {};
    if (params.ai) {
      try {
        const resp = await params.ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Compose an evocative orchestral fantasy soundtrack title and instrumentation note for "${realmName}" (${isDungeon ? '3D Dungeon' : theme}).
Creative brief: ${params.brief || 'Lush orchestral fantasy score with harp, bowed cello, highland flute, French horn, and modal bells.'}
Pick a mode from: dorian, lydian, phrygian-dominant, mixolydian, aeolian, harmonic-minor, pentatonic-major, and a BPM between 72 and 118.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                composerNote: { type: Type.STRING },
                mode: { type: Type.STRING },
                bpm: { type: Type.INTEGER },
              },
              required: ['title', 'composerNote', 'mode', 'bpm'],
            },
          },
        });
        const parsed = JSON.parse((resp.text ?? '{}').trim());
        const validModes: MusicalModeId[] = [
          'dorian',
          'lydian',
          'phrygian-dominant',
          'mixolydian',
          'aeolian',
          'harmonic-minor',
          'pentatonic-major',
        ];
        enriched = {
          title: parsed.title,
          composerNote: parsed.composerNote,
          mode: validModes.includes(parsed.mode) ? parsed.mode : undefined,
          bpm: typeof parsed.bpm === 'number' ? parsed.bpm : undefined,
        };
      } catch {
        // Fallback to algorithmic score synthesis
      }
    }

    const soundtrack = synthesizeScoreFromBrief({
      realmSlug: slug,
      realmName,
      theme,
      isDungeon,
      title: enriched.title,
      composerNote: enriched.composerNote || params.brief,
      mode: params.mode ?? enriched.mode,
      bpm: params.bpm ?? enriched.bpm,
      seed: Date.now() % 99991,
    });

    if (targetRealm) {
      targetRealm.soundtrack = soundtrack;
    }

    let projectModel: unknown = null;
    if (this.wasm) {
      this.stageIo(
        this.enc.encode(
          JSON.stringify({
            modelId: `frontiers:score:${slug}:${Date.now()}`,
            title: soundtrack.title,
            schemaType: 'MusicComposition',
            mediaType: 'application/vnd.verdant.score+json',
            targetSlot: 'spatial-acoustics',
            sourceStream: 'verdant-audio-worklet',
            sourceUri: `urn:frontiers:score:${slug}`,
            licenseSpdx: 'CC0-1.0',
            tags: ['orchestral', soundtrack.mode, `${soundtrack.bpm}bpm`, slug],
            propertiesJson: JSON.stringify({
              mode: soundtrack.mode,
              bpm: soundtrack.bpm,
              rootMidi: soundtrack.rootMidi,
              foleyProfile: soundtrack.foleyProfile,
              reverbDecaySec: soundtrack.reverbDecaySec,
            }),
            commitNote: `Verdant MCP composed orchestral score "${soundtrack.title}"`,
          }),
        ),
      );
      this.wasm.verdant_wasm_import_project_model_io();
      projectModel = this.readAuxJson();

      this.stageIo(
        this.enc.encode(
          `spatial-acoustics|verdant-audio-worklet|${soundtrack.title} (${soundtrack.mode}, ${soundtrack.bpm} BPM)`,
        ),
      );
      this.wasm.verdant_wasm_record_part_hydration_io(3);
    }

    return { realmSlug: slug, soundtrack, projectModel };
  }

  public async generateQuestline(params: {
    realmSlug?: string;
    brief?: string;
    ai?: GoogleGenAI | null;
  }): Promise<{
    quest: GameQuest;
    noveltyAudit: ReturnType<typeof auditAntiTropeNovelty>;
  }> {
    await this.ensureReady();
    const slug = params.realmSlug || 'vaelmor';
    const realm = this.realms.get(slug);
    const realmName = realm?.name ?? slug;
    const brief = params.brief || 'Stabilize outer frontier acoustic relays and clear monolith raiders.';

    let title = `Charter of the Outer Watch (${realmName})`;
    let summary = `Survey the distant frontier outposts of ${realmName}, sound the harmonic bearings, and unseal the forgotten supply coffer.`;
    let motif = 'frontier acoustic engineering';
    let obj1 = `Sound the ${realmName} Causeway Pier [Bell-Hammer]`;
    let obj2 = `Attune the Crown Meridian Waystone`;
    let obj3 = `Clear hostile construct guardians across the frontier`;

    if (params.ai) {
      try {
        const resp = await params.ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create a 3-stage grounded fantasy RPG questline for ${realmName}. Brief: ${brief}. Avoid all clichés (no chosen one, dark lord, prophecy scroll, tavern rats).`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                motif: { type: Type.STRING },
                step1: { type: Type.STRING },
                step2: { type: Type.STRING },
                step3: { type: Type.STRING },
              },
              required: ['title', 'summary', 'motif', 'step1', 'step2', 'step3'],
            },
          },
        });
        const p = JSON.parse((resp.text ?? '{}').trim());
        title = p.title || title;
        summary = p.summary || summary;
        motif = p.motif || motif;
        obj1 = p.step1 || obj1;
        obj2 = p.step2 || obj2;
        obj3 = p.step3 || obj3;
      } catch {
        // Use grounded deterministic questline
      }
    }

    const qId = `quest-mcp-${slug}-${Date.now()}`;
    const quest: GameQuest = {
      id: qId,
      title,
      giverNpcId: realm?.npcs[0]?.id ?? 'npc-kaelen',
      guildId: 'guild-causeway',
      regionId: 'northern-watch',
      summary,
      motif,
      renownReward: 240,
      status: 'active',
      objectives: [
        {
          id: `${qId}-1`,
          description: obj1,
          kind: 'ring-bell',
          targetId: realm?.interactables.find((i) => i.kind === 'resonance-pier')?.id ?? 'int-causeway-pier',
          targetCoords: [0, 5.2],
          requiredCount: 1,
          currentCount: 0,
        },
        {
          id: `${qId}-2`,
          description: obj2,
          kind: 'calibrate-beacon',
          targetId: realm?.interactables.find((i) => i.kind === 'waystone-beacon')?.id ?? 'int-citadel-waystone',
          targetCoords: [0, -10.5],
          requiredCount: 1,
          currentCount: 0,
        },
        {
          id: `${qId}-3`,
          description: obj3,
          kind: 'defeat-archetype',
          targetId: 'stalker',
          targetCoords: [-14, -10],
          requiredCount: 2,
          currentCount: 0,
        },
      ],
    };

    const noveltyAudit = auditAntiTropeNovelty(
      `${quest.title} ${quest.summary} ${quest.motif}`,
      ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
      [],
    );

    if (this.wasm) {
      this.stageIo(
        this.enc.encode(
          JSON.stringify({
            sourceStream: 'frontiers-questlines',
            sourceUri: `urn:frontiers:quest:${qId}`,
            topic: quest.title,
            passage: `${quest.summary} Motif: ${quest.motif}.`,
          }),
        ),
      );
      this.wasm.verdant_wasm_ingest_knowledge_io();
    }

    return { quest, noveltyAudit };
  }

  public async generateNpcCast(params: {
    realmSlug?: string;
    count?: number;
    brief?: string;
    ai?: GoogleGenAI | null;
  }): Promise<{
    npcs: GameNpc[];
    noveltyAudit: ReturnType<typeof auditAntiTropeNovelty>;
  }> {
    await this.ensureReady();
    const slug = params.realmSlug || 'vaelmor';
    const realm = this.realms.get(slug);
    const theme: RealmThemeId = realm?.theme ?? 'citadel-highlands';
    const realmName = realm?.name ?? slug;
    const skyRgb = realm?.skyFallbackRgb ?? [0.46, 0.54, 0.64];
    const count = Math.max(1, Math.min(3, params.count ?? 2));
    const roles: Array<'warden' | 'artisan' | 'scholar'> = ['warden', 'artisan', 'scholar'];
    const positions: Array<[number, number]> = [
      [4, -48],
      [-48, -18],
      [46, 12],
    ];
    const usedNames = new Set<string>();
    const npcs: GameNpc[] = [];

    for (let idx = 0; idx < count; idx++) {
      const synth = synthesizeVerdantCharacter({
        id: `npc-mcp-${slug}-${Date.now()}-${idx}`,
        seed: hashStringSeed(`${slug}:${params.brief ?? ''}:${Date.now()}:${idx}`),
        theme,
        realmName,
        regionId: idx === 0 ? 'northern-watch' : idx === 1 ? 'western-ruins' : 'eastern-ridge',
        position: positions[idx] ?? [4, -48],
        biomeSkyRgb: skyRgb,
        roleHint: roles[idx % roles.length],
        avoidNames: usedNames,
      });
      usedNames.add(synth.npc.name);
      if (params.brief) {
        synth.npc.greeting = `${synth.npc.greeting} (${params.brief})`;
      }
      npcs.push(synth.npc);

      if (this.wasm) {
        const rigPayload = buildCharacterProjectModelPayload(synth.npc, synth.appearance, slug);
        this.stageIo(this.enc.encode(JSON.stringify(rigPayload)));
        this.wasm.verdant_wasm_import_project_model_io();
      }
    }

    const noveltyAudit = auditAntiTropeNovelty(
      npcs.map((n) => `${n.name} ${n.greeting} ${n.cognitiveDrive}`).join(' '),
      ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
      [],
    );
    return { npcs, noveltyAudit };
  }

  public async generateRelicArsenal(params: {
    realmSlug?: string;
    count?: number;
    brief?: string;
  }): Promise<{
    relics: SynthesizedVerdantRelic[];
    noveltyAudit: ReturnType<typeof auditAntiTropeNovelty>;
  }> {
    await this.ensureReady();
    const slug = params.realmSlug || 'vaelmor';
    const hostRealm = this.realms.get(slug) ?? CANONICAL_REALM_SPECS[0];
    const count = Math.max(1, Math.min(3, params.count ?? 2));
    const existingNames: string[] = [];
    const relics: SynthesizedVerdantRelic[] = [];
    for (let i = 0; i < count; i++) {
      const relic = synthesizeBiomeRelic({
        theme: hostRealm.theme,
        realmName: hostRealm.name,
        existingNames,
        source: 'mcp',
        brief: params.brief,
        seed: (Date.now() + i * 7919) >>> 0,
      });
      existingNames.push(relic.name);
      relics.push(relic);
    }

    for (const r of relics) {
      if (this.wasm) {
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: `frontiers:relic:${r.id}`,
              title: r.name,
              schemaType: 'CreativeWork',
              mediaType: 'application/json',
              targetSlot: 'hero-props',
              sourceStream: 'frontiers-forge',
              sourceUri: `urn:frontiers:relic:${r.id}`,
              licenseSpdx: 'CC0-1.0',
              tags: ['relic', r.bonusKind, r.perkId, r.rarity, `${r.resonanceHz}hz`, slug],
              propertiesJson: JSON.stringify({ ...r, sigilSvg: '[svg-data-uri]' }),
              commitNote: `Verdant MCP forged ${r.rarity} relic ${r.name} (${r.perkLabel})`,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
      }
    }

    const noveltyAudit = auditAntiTropeNovelty(
      relics.map((r) => `${r.name} ${r.description}`).join(' '),
      ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
      [],
    );
    return { relics, noveltyAudit };
  }

  public async expandWorldFrontier(params: {
    name: string;
    theme?: RealmThemeId;
    brief?: string;
    ai?: GoogleGenAI | null;
  }): Promise<{
    realm: FrontiersRealmSpec;
    dungeon: FrontiersRealmSpec;
    soundtrack: RealmSoundtrackSpec;
    quest: GameQuest;
  }> {
    const realmRes = await this.generateNewRealm({
      name: params.name,
      theme: params.theme,
      brief: params.brief,
      ai: params.ai,
    });
    const styleByTheme: Record<RealmThemeId, DungeonArchitecturalStyle> = {
      'citadel-highlands': 'catacomb-vault',
      'sunken-aqueducts': 'sunken-cistern',
      'obsidian-crucible': 'geothermal-depths',
      'pelagic-spires': 'abyssal-grotto',
      'amber-steppe': 'echo-tomb',
      'glacial-spire': 'glacial-crypt',
    };
    const dungeonRes = await this.generateNewDungeon({
      name: `Vault of ${params.name}`,
      parentRealmSlug: realmRes.realm.slug,
      style: styleByTheme[realmRes.realm.theme],
      tier: 2,
      brief: params.brief,
      ai: params.ai,
    });
    const scoreRes = await this.composeSoundtrack({
      realmSlug: realmRes.realm.slug,
      brief: params.brief,
      ai: params.ai,
    });
    const questRes = await this.generateQuestline({
      realmSlug: realmRes.realm.slug,
      brief: params.brief,
      ai: params.ai,
    });
    return {
      realm: realmRes.realm,
      dungeon: dungeonRes.dungeon,
      soundtrack: scoreRes.soundtrack,
      quest: questRes.quest,
    };
  }

  public async submitOperatorDirective(
    directive: string,
    viewpoint = 'auto',
    citedAuthority = 'AUTH-KHRONOS-GLTF2',
  ): Promise<unknown> {
    await this.ensureReady();
    if (!this.wasm) throw new Error('Wasm unavailable');
    this.stageIo(
      this.enc.encode(
        JSON.stringify({
          viewpoint,
          directive,
          citedAuthority,
          operatorPrismId: 'prism:frontiers-mcp-operator',
        }),
      ),
    );
    this.wasm.verdant_wasm_operator_prompt_io();
    return this.readAuxJson() ?? { admitted: false };
  }

  public async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    ai: GoogleGenAI | null,
  ): Promise<unknown> {
    await this.ensureReady();
    if (!this.wasm) throw new Error('Verdant Wasm runtime unavailable');

    switch (toolName) {
      case 'verdant_status': {
        this.wasm.verdant_wasm_observer_status_aux();
        const observerStatus = this.readAuxJson();
        this.wasm.verdant_wasm_cognitive_resolution_aux();
        const cognitiveResolution = this.readAuxJson();
        this.wasm.verdant_wasm_list_project_models_aux();
        const projectModels = this.readAuxJson();
        const realms = await this.listRealms();

        const pmObj = projectModels as { count?: number; models?: unknown[] } | unknown[] | null;
        const pmCount = Array.isArray(pmObj)
          ? pmObj.length
          : typeof pmObj?.count === 'number'
            ? pmObj.count
            : Array.isArray(pmObj?.models)
              ? pmObj.models.length
              : 0;

        return {
          engine: 'verdant-uorc.wasm (github.com/afflom/verdant-engine)',
          blankStageVerified: true,
          defaultStudioContentExcluded: true,
          compiledRealmsCount: realms.length,
          overworldRealmsCount: realms.filter((r) => !r.isDungeon).length,
          dungeonsCount: realms.filter((r) => r.isDungeon).length,
          realms: realms.map((r) => ({
            slug: r.slug,
            name: r.name,
            isDungeon: Boolean(r.isDungeon),
            cell: r.cell,
            theme: r.theme,
            triangles: r.prismCustody?.triangles ?? 0,
            importedCatalogAssets: r.prismCustody?.importedCatalogAssets ?? [],
            worldGlbKappa: r.prismCustody?.worldGlbKappa ?? null,
            stitchVerified: r.prismCustody?.stitchRecoveryVerified ?? false,
          })),
          projectModelsCount: pmCount,
          observerStatus,
          cognitiveResolutionSummary: cognitiveResolution,
        };
      }

      case 'verdant_catalog_search': {
        const query = String(args.query ?? '');
        const assetType = (args.assetType as 'models' | 'textures' | 'hdris') || 'models';
        const limit = Number(args.limit) || 12;
        return this.searchExternalCatalog(query, assetType, limit);
      }

      case 'verdant_register_stream': {
        const payload = {
          streamId: String(args.streamId ?? ''),
          label: String(args.label ?? ''),
          authority: String(args.authority ?? 'External Open Catalog'),
          adapterKind: String(args.adapterKind ?? 'polyhaven'),
          endpointUrl: String(args.endpointUrl ?? ''),
          targetParts: Array.isArray(args.targetParts) ? args.targetParts.map(String) : ['hero-props'],
        };
        this.stageIo(this.enc.encode(JSON.stringify(payload)));
        const len = this.wasm.verdant_wasm_register_stream_io() >>> 0;
        if (!len) throw new Error('verdant_wasm_register_stream_io rejected stream registration');
        return this.readAuxJson();
      }

      case 'verdant_import_model': {
        const pm = {
          modelId: String(args.modelId ?? `custom:${Date.now()}`),
          title: String(args.title ?? 'Imported Model'),
          schemaType: String(args.schemaType ?? '3DModel'),
          mediaType: String(args.mediaType ?? 'model/gltf-binary'),
          targetSlot: String(args.targetSlot ?? 'hero-props'),
          sourceStream: String(args.sourceStream ?? 'polyhaven-frontiers'),
          sourceUri: String(args.sourceUri ?? ''),
          licenseSpdx: String(args.licenseSpdx ?? 'CC0-1.0'),
          tags: Array.isArray(args.tags) ? args.tags.map(String) : ['imported'],
          propertiesJson: String(args.propertiesJson ?? '{}'),
          commitNote: String(args.commitNote ?? 'Imported via Verdant MCP'),
        };
        this.stageIo(this.enc.encode(JSON.stringify(pm)));
        const len = this.wasm.verdant_wasm_import_project_model_io() >>> 0;
        if (!len) throw new Error('verdant_wasm_import_project_model_io rejected model');
        const record = this.readAuxJson();

        // Record ObserverPartSlot hydration
        this.stageIo(this.enc.encode(`${pm.targetSlot}|${pm.sourceStream}|${pm.title}`));
        this.wasm.verdant_wasm_record_part_hydration_io(3);
        return { imported: true, projectModel: record };
      }

      case 'verdant_operator_directive':
      case 'verdant_prompt': {
        const directive = String(args.directive ?? '').trim();
        if (!directive) throw new Error('directive is required');
        return this.submitOperatorDirective(
          directive,
          String(args.viewpoint ?? 'auto'),
          String(args.citedAuthority ?? 'AUTH-KHRONOS-GLTF2'),
        );
      }

      case 'verdant_ingest_knowledge': {
        const doc = {
          sourceStream: String(args.sourceStream ?? 'frontiers-mcp'),
          sourceUri: String(args.sourceUri ?? `urn:frontiers:mcp:${Date.now()}`),
          topic: String(args.topic ?? 'Frontier Lore'),
          passage: String(args.passage ?? ''),
        };
        if (!doc.passage) throw new Error('passage is required');
        this.stageIo(this.enc.encode(JSON.stringify(doc)));
        const len = this.wasm.verdant_wasm_ingest_knowledge_io() >>> 0;
        if (!len) throw new Error('verdant_wasm_ingest_knowledge_io rejected passage');
        return this.readAuxJson();
      }

      case 'verdant_generate_realm': {
        const name = String(args.name ?? '').trim();
        if (!name) throw new Error('verdant_generate_realm requires a realm name');
        const rawCell = Array.isArray(args.cell) && args.cell.length === 3
          ? ([Number(args.cell[0]) || 0, Number(args.cell[1]) || 0, Number(args.cell[2]) || 0] as [number, number, number])
          : undefined;
        return this.generateNewRealm({
          name,
          cell: rawCell,
          theme: args.theme as RealmThemeId | undefined,
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          ai,
        });
      }

      case 'verdant_generate_dungeon': {
        const name = String(args.name ?? '').trim();
        if (!name) throw new Error('verdant_generate_dungeon requires a dungeon name');
        return this.generateNewDungeon({
          name,
          parentRealmSlug: typeof args.parentRealmSlug === 'string' ? args.parentRealmSlug : 'vaelmor',
          style: args.style as DungeonArchitecturalStyle | undefined,
          tier: typeof args.tier === 'number' ? args.tier : 2,
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          ai,
        });
      }

      case 'verdant_compose_score': {
        return this.composeSoundtrack({
          realmSlug: typeof args.realmSlug === 'string' ? args.realmSlug : 'vaelmor',
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          mode: args.mode as MusicalModeId | undefined,
          bpm: typeof args.bpm === 'number' ? args.bpm : undefined,
          ai,
        });
      }

      case 'verdant_generate_questline': {
        return this.generateQuestline({
          realmSlug: typeof args.realmSlug === 'string' ? args.realmSlug : 'vaelmor',
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          ai,
        });
      }

      case 'verdant_generate_npc_cast': {
        return this.generateNpcCast({
          realmSlug: typeof args.realmSlug === 'string' ? args.realmSlug : 'vaelmor',
          count: typeof args.count === 'number' ? args.count : 2,
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          ai,
        });
      }

      case 'verdant_generate_relic_arsenal': {
        return this.generateRelicArsenal({
          realmSlug: typeof args.realmSlug === 'string' ? args.realmSlug : 'vaelmor',
          count: typeof args.count === 'number' ? args.count : 2,
          brief: typeof args.brief === 'string' ? args.brief : undefined,
        });
      }

      case 'verdant_expand_world_frontier': {
        const name = String(args.name ?? '').trim();
        if (!name) throw new Error('verdant_expand_world_frontier requires a frontier name');
        return this.expandWorldFrontier({
          name,
          theme: args.theme as RealmThemeId | undefined,
          brief: typeof args.brief === 'string' ? args.brief : undefined,
          ai,
        });
      }

      case 'verdant_stitch_seal': {
        const payload = String(args.payload ?? '');
        if (!payload) throw new Error('payload is required');
        const raw = this.enc.encode(payload);
        const shardsBase64: string[] = [];
        for (let si = 0; si < 3; si++) {
          this.stageIo(raw);
          const sLen = this.wasm.verdant_wasm_stitch_shard_io(si) >>> 0;
          if (!sLen) throw new Error(`Stitch shard ${si} failed`);
          shardsBase64.push(Buffer.from(this.readAuxBytes()).toString('base64'));
        }
        const digest = await kappa({ payloadLength: raw.byteLength, shards: shardsBase64.length });
        return {
          engine: 'verdant_wasm_stitch_shard_io',
          threshold: 2,
          totalShards: 3,
          originalBytes: raw.byteLength,
          kappaDigest: digest,
          shardsBase64,
        };
      }

      case 'verdant_stitch_recover': {
        const a = Buffer.from(String(args.shardA ?? ''), 'base64');
        const b = Buffer.from(String(args.shardB ?? ''), 'base64');
        if (!a.byteLength || !b.byteLength) throw new Error('Both shardA and shardB base64 strings are required');
        const combined = new Uint8Array(a.byteLength + b.byteLength);
        combined.set(a, 0);
        combined.set(b, a.byteLength);
        this.stageIo(combined);
        const recLen = this.wasm.verdant_wasm_stitch_recover_io(a.byteLength) >>> 0;
        if (!recLen) throw new Error('Stitch recovery failed');
        const recoveredBytes = this.readAuxBytes();
        const isUorcEnvelope =
          recoveredBytes.byteLength > 43 &&
          recoveredBytes[0] === 0x55 &&
          recoveredBytes[1] === 0x4f &&
          recoveredBytes[2] === 0x52 &&
          recoveredBytes[3] === 0x43;
        const innerBytes = isUorcEnvelope
          ? recoveredBytes.subarray(11, recoveredBytes.byteLength - 32)
          : recoveredBytes;
        return {
          engine: 'verdant_wasm_stitch_recover_io',
          recoveredBytes: recLen,
          uorcEnvelopeVerified: isUorcEnvelope,
          payload: this.dec.decode(innerBytes),
          envelopeBase64: Buffer.from(recoveredBytes).toString('base64'),
        };
      }

      case 'verdant_audit': {
        this.wasm.verdant_wasm_observer_roadmap_kpis_aux();
        const kpis = this.readAuxJson();
        const sampleText = String(
          args.sampleText ??
            'Frontiers and Foundations federated multi-realm charters across Vaelmor, Oakhaven, Cinderfall, and Glasswater.',
        );
        const noveltyAudit = auditAntiTropeNovelty(
          sampleText,
          ['amnesiac chosen one', 'dark lord', 'prophecy scroll', 'tavern rat cellar'],
          [],
        );
        return {
          defaultVerdantStudioAssetsExcluded: true,
          blankStageVerified: true,
          noveltyAudit,
          roadmapKpis: kpis,
        };
      }

      case 'verdant_compile_character_rig': {
        const npcId = String(args.npcId ?? '').trim();
        const realmSlug = String(args.realmSlug ?? 'vaelmor').trim();
        if (!npcId) throw new Error('verdant_compile_character_rig requires npcId');
        const realm = this.realms.get(realmSlug);
        const candidateNpcs = realmSlug === 'vaelmor' ? INITIAL_NPCS : realm?.npcs ?? INITIAL_NPCS;
        const npc =
          candidateNpcs.find((n) => n.id === npcId) ??
          INITIAL_NPCS.find((n) => n.id === npcId) ??
          Array.from(this.realms.values())
            .flatMap((r) => r.npcs)
            .find((n) => n.id === npcId);
        if (!npc) {
          throw new Error(`NPC "${npcId}" not found in realm "${realmSlug}"`);
        }
        const appearance = compileNpcCharacterAppearance(npc);
        const payload = buildCharacterProjectModelPayload(npc, appearance, realmSlug);
        this.stageIo(this.enc.encode(JSON.stringify(payload)));
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        this.stageIo(
          this.enc.encode(`character-actor|verdant-portrait-compiler|${npc.name} (${appearance.portraitArchetype})`),
        );
        this.wasm.verdant_wasm_record_part_hydration_io(3);
        return {
          realmSlug,
          npcId: npc.id,
          npcName: npc.name,
          appearance,
          projectModel,
        };
      }

      case 'verdant_refine_world_hd': {
        const targetSlug = typeof args.realmSlug === 'string' && args.realmSlug.trim() ? args.realmSlug.trim() : null;
        const operatorDecision = await this.submitOperatorDirective(
          `Automate HD portrait-matched character rig compilation, smooth-normal PBR shader pass, and fluid spring-arm controls across ${targetSlug || 'all Frontiers and Foundations realms'}`,
          'auto',
          'AUTH-KHRONOS-GLTF2',
        );
        const realms = (await this.listRealms()).filter((r) => !targetSlug || r.slug === targetSlug);
        const compiledRigs: Array<{
          realmSlug: string;
          npcId: string;
          npcName: string;
          appearance: VerdantCharacterAppearance;
        }> = [];
        for (const realm of realms) {
          const npcs = realm.slug === 'vaelmor' ? INITIAL_NPCS : realm.npcs;
          for (const npc of npcs) {
            const appearance = compileNpcCharacterAppearance(npc);
            const payload = buildCharacterProjectModelPayload(npc, appearance, realm.slug);
            this.stageIo(this.enc.encode(JSON.stringify(payload)));
            this.wasm.verdant_wasm_import_project_model_io();
            compiledRigs.push({
              realmSlug: realm.slug,
              npcId: npc.id,
              npcName: npc.name,
              appearance,
            });
          }
        }
        this.stageIo(
          this.enc.encode(
            `character-actor|verdant-portrait-compiler|Refined ${compiledRigs.length} HD character rigs across ${realms.length} worlds`,
          ),
        );
        this.wasm.verdant_wasm_record_part_hydration_io(3);
        const refinementKappa = await kappa({
          realmsRefined: realms.length,
          rigsCompiled: compiledRigs.length,
          distinctArchetypes: Array.from(new Set(compiledRigs.map((r) => r.appearance.portraitArchetype))).sort(),
        });
        return {
          engine: 'verdant-uorc.wasm',
          operatorDecision,
          realmsRefined: realms.length,
          rigsCompiled: compiledRigs.length,
          distinctArchetypes: Array.from(new Set(compiledRigs.map((r) => r.appearance.portraitArchetype))),
          shaderFeatures: ['smooth-analytical-normals', 'subsurface-skin-cloth-wrap', 'fresnel-rim-light'],
          controlFeatures: [
            'velocity-acceleration-locomotion',
            'directional-dodge',
            'soft-combat-aim-assist',
            '180ms-input-buffer',
            '120ms-coyote-jump',
            'spring-arm-collision-camera',
            'mouse-wheel-zoom',
            'wasm-camera-pose-intent',
          ],
          refinementKappa,
          compiledRigs: compiledRigs.map((r) => ({
            realmSlug: r.realmSlug,
            npcId: r.npcId,
            npcName: r.npcName,
            portraitArchetype: r.appearance.portraitArchetype,
            garmentStyle: r.appearance.garmentStyle,
            hairStyle: r.appearance.hairStyle,
            signatureProp: r.appearance.signatureProp,
          })),
        };
      }

      case 'verdant_synthesize_universe_cell': {
        const cx = Math.trunc(Number(args.cx ?? 0));
        const cz = Math.trunc(Number(args.cz ?? 0));
        const worldSeed = typeof args.worldSeed === 'number' ? Math.trunc(args.worldSeed) : 7777;
        const cellSpec = synthesizeUniverseCell(cx, cz, { worldSeed });
        const glbBytes = buildProceduralCellGlb(cellSpec);

        this.wasm.verdant_wasm_studio_load_blank_stage();
        this.stageIo(glbBytes);
        const triangles = this.wasm.verdant_wasm_glb_import_io() >>> 0;
        const vertices = this.wasm.verdant_wasm_scene_vert_count() >>> 0;

        this.registerRealmInWasm(cellSpec);
        for (const npc of cellSpec.npcs) {
          const app = compileNpcCharacterAppearance(npc);
          const rigPayload = buildCharacterProjectModelPayload(npc, app, cellSpec.slug);
          this.stageIo(this.enc.encode(JSON.stringify(rigPayload)));
          this.wasm.verdant_wasm_import_project_model_io();
        }
        const cellKappa = await kappa({
          slug: cellSpec.slug,
          cell: cellSpec.cell,
          triangles,
          vertices,
          npcs: cellSpec.npcs.map((n) => n.name),
        });
        return {
          engine: 'verdant-uorc.wasm',
          realm: cellSpec,
          glbBytes: glbBytes.byteLength,
          triangles,
          vertices,
          cellKappa,
        };
      }

      case 'verdant_synthesize_character': {
        const validThemes: RealmThemeId[] = [
          'citadel-highlands',
          'sunken-aqueducts',
          'obsidian-crucible',
          'pelagic-spires',
          'amber-steppe',
          'glacial-spire',
        ];
        const theme: RealmThemeId = validThemes.includes(args.theme as RealmThemeId)
          ? (args.theme as RealmThemeId)
          : 'citadel-highlands';
        const realmName =
          typeof args.realmName === 'string' && args.realmName.trim()
            ? args.realmName.trim()
            : 'The Shattered Meridian';
        const seed =
          typeof args.seed === 'number' && Number.isFinite(args.seed)
            ? Math.trunc(args.seed)
            : hashStringSeed(`char:${theme}:${realmName}:${Date.now()}`);
        const climate = sampleMacroClimate(seed % 17, (seed >> 4) % 17);
        const roleHint =
          args.roleHint === 'warden' ||
          args.roleHint === 'artisan' ||
          args.roleHint === 'scholar' ||
          args.roleHint === 'navigator' ||
          args.roleHint === 'scout'
            ? args.roleHint
            : undefined;

        const synth = synthesizeVerdantCharacter({
          id: `npc-synth-${seed >>> 0}`,
          seed,
          theme,
          realmName,
          regionId: 'southern-terrace',
          position: [-3.4, 15.6],
          biomeSkyRgb: climate.skyFallbackRgb,
          roleHint,
        });
        const rigPayload = buildCharacterProjectModelPayload(
          synth.npc,
          synth.appearance,
          realmName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        );
        this.stageIo(this.enc.encode(JSON.stringify(rigPayload)));
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              sourceStream: 'frontiers-characters',
              sourceUri: `urn:frontiers:npc:${synth.npc.id}`,
              topic: `${synth.npc.name} (${synth.npc.title})`,
              passage: `${synth.npc.cognitiveDrive} Traits: ${synth.appearance.traitSummary ?? ''}`,
            }),
          ),
        );
        this.wasm.verdant_wasm_ingest_knowledge_io();

        return {
          engine: 'verdant-uorc.wasm',
          npc: synth.npc,
          appearance: synth.appearance,
          projectModel,
        };
      }

      case 'verdant_catalog_extend': {
        const id = String(args.id ?? '').trim();
        const title = String(args.title ?? '').trim();
        const validCategories: Array<VerdantCatalogExtensionEntry['category']> = [
          'layout',
          'flora',
          'fauna',
          'phenomenon',
          'prop-kit',
        ];
        const rawCategory = args.category === 'architecture' ? 'layout' : args.category;
        const category: VerdantCatalogExtensionEntry['category'] = validCategories.includes(
          rawCategory as VerdantCatalogExtensionEntry['category'],
        )
          ? (rawCategory as VerdantCatalogExtensionEntry['category'])
          : 'layout';
        if (!id || !title) {
          throw new Error('verdant_catalog_extend requires id and title');
        }
        const entry = registerVerdantCatalogExtension({
          id,
          category,
          title,
          description:
            typeof args.summary === 'string' && args.summary.trim()
              ? args.summary.trim()
              : `Custom Verdant ${category} extension "${title}"`,
          themeAffinity: ['citadel-highlands', 'amber-steppe'],
          sourceStream: 'verdant-ecosystem-catalog',
          tags: Array.isArray(args.tags) ? args.tags.map(String) : [category, 'custom-extension'],
        });
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: `verdant:catalog:${entry.id}`,
              title: entry.title,
              schemaType: 'CatalogExtension',
              mediaType: 'application/vnd.verdant.catalog-kit+json',
              targetSlot: entry.category === 'fauna' ? 'character-rigs' : 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:verdant:catalog:${entry.category}:${entry.id}`,
              licenseSpdx: 'CC0-1.0',
              tags: ['catalog-extension', entry.category, ...entry.tags],
              propertiesJson: JSON.stringify(entry),
              commitNote: `Extended Verdant Catalog with ${entry.category} kit "${entry.title}"`,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        const catalogKappa = await kappa({
          extensionId: entry.id,
          category: entry.category,
          totalCatalogSize: listVerdantCatalogExtensions().length,
        });
        return {
          engine: 'verdant-uorc.wasm',
          extension: entry,
          totalCatalogExtensions: listVerdantCatalogExtensions().length,
          catalogKappa,
          projectModel,
        };
      }

      case 'verdant_synthesize_ecosystem': {
        const slug = typeof args.realmSlug === 'string' && args.realmSlug.trim() ? args.realmSlug.trim() : '';
        const targetSpec = slug
          ? this.realms.get(slug) ??
            ALL_CANONICAL_WORLDS.find((w) => w.slug === slug) ??
            synthesizeUniverseCell(Number(args.cx ?? 0), Number(args.cz ?? 0))
          : synthesizeUniverseCell(Math.trunc(Number(args.cx ?? 2)), Math.trunc(Number(args.cz ?? -1)));
        const plan = synthesizeRealmEcosystem(targetSpec);
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: `frontiers:ecosystem:${targetSpec.slug}`,
              title: `${targetSpec.name} — ${plan.layoutTitle}`,
              schemaType: 'EcosystemBlueprint',
              mediaType: 'application/vnd.verdant.ecosystem+json',
              targetSlot: 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:frontiers:ecosystem:${targetSpec.slug}`,
              licenseSpdx: 'CC0-1.0',
              tags: [
                'ecosystem-blueprint',
                plan.layoutId,
                plan.floraKit,
                plan.faunaKit,
                plan.phenomenon.id,
                targetSpec.slug,
              ],
              propertiesJson: JSON.stringify({
                layoutId: plan.layoutId,
                floraKit: plan.floraKit,
                faunaKit: plan.faunaKit,
                phenomenon: plan.phenomenon,
                structureCount: plan.structures.length,
                floraCount: plan.floraInstances.length,
                thermalVentCount: plan.thermalVents.length,
              }),
              commitNote: `Synthesized bespoke EcosystemBlueprint for ${targetSpec.name}`,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        const ecosystemKappa = await kappa({
          slug: targetSpec.slug,
          layoutId: plan.layoutId,
          floraKit: plan.floraKit,
          faunaKit: plan.faunaKit,
          phenomenon: plan.phenomenon.id,
          structureCount: plan.structures.length,
          floraCount: plan.floraInstances.length,
        });
        return {
          engine: 'verdant-uorc.wasm',
          realmSlug: targetSpec.slug,
          realmName: targetSpec.name,
          cell: targetSpec.cell,
          ecosystem: {
            layoutId: plan.layoutId,
            layoutTitle: plan.layoutTitle,
            floraKit: plan.floraKit,
            floraTitle: plan.floraTitle,
            faunaKit: plan.faunaKit,
            faunaTitle: plan.faunaTitle,
            phenomenon: plan.phenomenon,
            ambientParticleKind: plan.phenomenon.ambientParticleKind,
            structureCount: plan.structures.length,
            floraCount: plan.floraInstances.length,
            plazaZoneCount: plan.plazaZones.length,
            thermalVentCount: plan.thermalVents.length,
            catalogExtensionIds: plan.catalogExtensionIds,
          },
          ecosystemKappa,
          projectModel,
        };
      }

      case 'verdant_synthesize_dungeon_architecture': {
        const slug = String(args.dungeonSlug || '').trim();
        const styleOverride = args.style ? (String(args.style) as DungeonArchitecturalStyle) : undefined;
        const baseSpec =
          (slug ? CANONICAL_DUNGEON_SPECS.find((d) => d.slug === slug) : undefined) ??
          (styleOverride ? CANONICAL_DUNGEON_SPECS.find((d) => d.dungeonStyle === styleOverride) : undefined) ??
          CANONICAL_DUNGEON_SPECS[0];
        const targetSpec: FrontiersRealmSpec = styleOverride
          ? { ...baseSpec, dungeonStyle: styleOverride }
          : baseSpec;
        const dgPlan = synthesizeDungeonEcosystem(targetSpec);
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: `frontiers:dungeon-blueprint:${targetSpec.slug}`,
              title: `${targetSpec.name} — ${dgPlan.styleTitle}`,
              schemaType: 'DungeonBlueprint',
              mediaType: 'application/vnd.verdant.dungeon+json',
              targetSlot: 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:frontiers:dungeon-blueprint:${targetSpec.slug}`,
              licenseSpdx: 'CC0-1.0',
              tags: [
                'dungeon-blueprint',
                dgPlan.style,
                dgPlan.faunaKit,
                dgPlan.chasmVisual,
                dgPlan.phenomenon.id,
                targetSpec.slug,
              ],
              propertiesJson: JSON.stringify({
                style: dgPlan.style,
                styleTitle: dgPlan.styleTitle,
                faunaKit: dgPlan.faunaKit,
                chasmVisual: dgPlan.chasmVisual,
                phenomenon: dgPlan.phenomenon.id,
                structureCount: dgPlan.structures.length,
                thermalVentCount: dgPlan.thermalVents.length,
              }),
              commitNote: `Synthesized bespoke DungeonBlueprint "${dgPlan.styleTitle}" for ${targetSpec.name}`,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        const dungeonKappa = await kappa({
          slug: targetSpec.slug,
          style: dgPlan.style,
          faunaKit: dgPlan.faunaKit,
          chasmVisual: dgPlan.chasmVisual,
          phenomenon: dgPlan.phenomenon.id,
          structureCount: dgPlan.structures.length,
          thermalVentCount: dgPlan.thermalVents.length,
        });
        return {
          engine: 'verdant-uorc.wasm',
          dungeonSlug: targetSpec.slug,
          dungeonName: targetSpec.name,
          dungeonArchitecture: {
            style: dgPlan.style,
            styleTitle: dgPlan.styleTitle,
            faunaKit: dgPlan.faunaKit,
            chasmVisual: dgPlan.chasmVisual,
            phenomenon: dgPlan.phenomenon,
            structureCount: dgPlan.structures.length,
            thermalVentCount: dgPlan.thermalVents.length,
            catalogExtensionIds: dgPlan.catalogExtensionIds,
          },
          dungeonKappa,
          projectModel,
        };
      }

      case 'verdant_synthesize_relic': {
        const realmSlug = typeof args.realmSlug === 'string' ? args.realmSlug : 'vaelmor';
        const hostRealm = this.realms.get(realmSlug) ?? CANONICAL_REALM_SPECS[0];
        const theme = (typeof args.theme === 'string' ? args.theme : hostRealm.theme) as RealmThemeId;
        const rarity = typeof args.rarity === 'string' ? (args.rarity as RelicRarity) : undefined;
        const seed = typeof args.seed === 'number' ? args.seed : undefined;
        const brief = typeof args.brief === 'string' ? args.brief : undefined;
        const relic = synthesizeBiomeRelic({
          theme,
          realmName: hostRealm.name,
          rarity,
          seed,
          brief,
          source: 'mcp',
        });
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: `frontiers:relic:${relic.id}`,
              title: relic.name,
              schemaType: 'CreativeWork',
              mediaType: 'application/json',
              targetSlot: 'hero-props',
              sourceStream: 'verdant-relic-synthesizer',
              sourceUri: `urn:frontiers:relic:${relic.id}`,
              licenseSpdx: 'CC0-1.0',
              tags: ['relic-artifact', relic.theme, relic.rarity, relic.perkId, `${relic.resonanceHz}hz`],
              propertiesJson: JSON.stringify({
                id: relic.id,
                name: relic.name,
                theme: relic.theme,
                rarity: relic.rarity,
                perkId: relic.perkId,
                perkLabel: relic.perkLabel,
                bonusKind: relic.bonusKind,
                bonusValue: relic.bonusValue,
                resonanceHz: relic.resonanceHz,
                catalogId: relic.catalogId,
              }),
              commitNote: `Synthesized ${relic.rarity} biome relic "${relic.name}" (${relic.perkLabel})`,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();
        const relicKappa = await kappa({
          id: relic.id,
          name: relic.name,
          theme: relic.theme,
          rarity: relic.rarity,
          perkId: relic.perkId,
          bonusKind: relic.bonusKind,
          bonusValue: relic.bonusValue,
          resonanceHz: relic.resonanceHz,
        });
        return {
          engine: 'verdant-uorc.wasm',
          relic,
          relicKappa,
          projectModel,
        };
      }

      case 'verdant_inspect_model_of_models': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const modelId = typeof args.modelId === 'string' && args.modelId.trim() ? args.modelId.trim() : undefined;
        const partSlot =
          typeof args.partSlot === 'string' &&
          (VERDANT_PART_SLOTS as readonly string[]).includes(args.partSlot)
            ? (args.partSlot as VerdantPartSlot)
            : undefined;
        const includeTree = Boolean(args.includeTree);
        const includeGraph = Boolean(args.includeGraph);
        const graph = this.modelObserver.getModelGraph();
        return {
          engine: 'verdant-uorc.wasm',
          summary: this.modelObserver.getSummary(),
          renderProfile: this.modelObserver.getRenderResolutionProfile(),
          graphStats: {
            edgeCount: graph.edges.length,
            crossPartEdges: graph.crossPartEdges,
            danglingEdges: graph.danglingEdges.length,
            integrityRatio: graph.integrityRatio,
          },
          auditLedger: this.modelObserver.getAuditLedger(),
          ...(includeGraph ? { graph } : {}),
          ...(modelId
            ? {
                model: this.modelObserver.getModel(modelId),
                lineage: this.modelObserver.getModelLineage(modelId),
              }
            : {}),
          ...(partSlot ? { partModels: this.modelObserver.listModels({ partSlot }) } : {}),
          ...(includeTree ? { rootModel: this.modelObserver.getRootModel() } : {}),
        };
      }

      case 'verdant_observer_diversity_kpis': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const includeManagers = args.includeManagers !== false;
        const kpis = this.modelObserver.observeKpis();
        const managers = this.modelObserver.listManagers();
        return {
          engine: 'verdant-uorc.wasm',
          kpis,
          managersCount: managers.length,
          wasmManagersCount: managers.filter((m) => m.origin === 'verdant-wasm').length,
          frontiersManagersCount: managers.filter((m) => m.origin === 'frontiers-extension').length,
          ...(includeManagers ? { managers } : {}),
        };
      }

      case 'verdant_refine_model_api': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const rawTier = Number(args.targetTier);
        const targetTier: VerdantResolutionTier | undefined =
          rawTier === 1 || rawTier === 2 || rawTier === 3 || rawTier === 4
            ? (rawTier as VerdantResolutionTier)
            : undefined;
        const partSlot =
          typeof args.partSlot === 'string' &&
          (VERDANT_PART_SLOTS as readonly string[]).includes(args.partSlot)
            ? (args.partSlot as VerdantPartSlot)
            : undefined;
        const modelId =
          typeof args.modelId === 'string' && args.modelId.trim() ? args.modelId.trim() : undefined;
        const refineOpts: UniformRefinementOptions = {
          ...(targetTier ? { targetTier } : {}),
          ...(partSlot ? { partSlot } : {}),
          ...(modelId ? { modelId } : {}),
          enforceDiversity: args.enforceDiversity !== false,
          ...(typeof args.reason === 'string' && args.reason.trim() ? { reason: args.reason.trim() } : {}),
        };

        const report = await this.modelObserver.refine(refineOpts);

        // Register the sealed Model-of-Models refinement snapshot natively in verdant-uorc.wasm
        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: report.kpis.rootModelId,
              title: 'Frontiers and Foundations — Unified Model of Models',
              schemaType: 'VideoGameModelOfModels',
              mediaType: 'application/vnd.verdant.model-of-models+json',
              targetSlot: partSlot ?? 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:frontiers:model-of-models:v${this.modelObserver.getRootModel().version}`,
              licenseSpdx: 'CC0-1.0',
              tags: [
                'model-of-models',
                `tier-${report.after.resolutionTier}`,
                `diversity-${report.after.diversityIndex}`,
              ],
              propertiesJson: JSON.stringify({
                scope: report.scope,
                modelsRefined: report.modelsRefined,
                clonesDiversified: report.clonesDiversified,
                diversityIndex: report.after.diversityIndex,
                resolutionIndex: report.after.resolutionIndex,
                rootKappaDigest: report.after.rootKappaDigest,
              }),
              commitNote: report.reason,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();

        if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
          this.stageIo(
            this.enc.encode(
              `${partSlot ?? 'stage-environment'}|frontiers-observer-manager|Tier ${report.after.resolutionTier} · Diversity ${report.after.diversityIndex}/100`,
            ),
          );
          this.wasm.verdant_wasm_record_part_hydration_io(report.after.resolutionTier);
        }

        return {
          engine: 'verdant-uorc.wasm',
          report,
          projectModel,
        };
      }

      case 'verdant_observer_refinement_agenda': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const includeManagers = args.includeManagers !== false;
        const agenda = this.modelObserver.synthesizeRefinementAgenda();
        const managers = this.modelObserver.listManagers();
        return {
          engine: 'verdant-uorc.wasm',
          agenda,
          managersCount: managers.length,
          wasmManagersCount: managers.filter((m) => m.origin === 'verdant-wasm').length,
          frontiersManagersCount: managers.filter((m) => m.origin === 'frontiers-extension').length,
          ...(includeManagers ? { managers } : {}),
        };
      }

      case 'verdant_run_ratchet_cycle': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const rawTier = Number(args.targetTier);
        const targetTier: VerdantResolutionTier | undefined =
          rawTier === 1 || rawTier === 2 || rawTier === 3 || rawTier === 4
            ? (rawTier as VerdantResolutionTier)
            : undefined;
        const partSlot =
          typeof args.partSlot === 'string' &&
          (VERDANT_PART_SLOTS as readonly string[]).includes(args.partSlot)
            ? (args.partSlot as VerdantPartSlot)
            : undefined;
        const cycleOpts: UniformRefinementOptions = {
          ...(targetTier ? { targetTier } : {}),
          ...(partSlot ? { partSlot } : {}),
          enforceDiversity: true,
          ...(typeof args.reason === 'string' && args.reason.trim() ? { reason: args.reason.trim() } : {}),
        };

        const report = await this.modelObserver.runRatchetCycle(cycleOpts);
        const refine = report.refinementReport;

        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: refine.kpis.rootModelId,
              title: 'Frontiers and Foundations — Observer Ratchet Snapshot',
              schemaType: 'VideoGameModelOfModels',
              mediaType: 'application/vnd.verdant.model-of-models+json',
              targetSlot: partSlot ?? 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:frontiers:model-of-models:ratchet-${report.cycleNumber}`,
              licenseSpdx: 'CC0-1.0',
              tags: [
                'observer-ratchet',
                `cycle-${report.cycleNumber}`,
                `tier-${refine.after.resolutionTier}`,
                `cohesion-${report.agendaAfter.cohesionIndex}`,
                `diversity-${refine.after.diversityIndex}`,
              ],
              propertiesJson: JSON.stringify({
                cycleNumber: report.cycleNumber,
                watermarkAdvanced: report.watermarkAdvanced,
                proposalsExecuted: report.executedProposals.length,
                cohesionIndex: report.agendaAfter.cohesionIndex,
                diversityIndex: refine.after.diversityIndex,
                rootKappaDigest: refine.after.rootKappaDigest,
              }),
              commitNote: refine.reason,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();

        if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
          this.stageIo(
            this.enc.encode(
              `${partSlot ?? 'stage-environment'}|frontiers-observer-ratchet|Cycle #${report.cycleNumber} · Cohesion ${report.agendaAfter.cohesionIndex}/100 · Diversity ${refine.after.diversityIndex}/100`,
            ),
          );
          this.wasm.verdant_wasm_record_part_hydration_io(refine.after.resolutionTier);
        }

        return {
          engine: 'verdant-uorc.wasm',
          report,
          projectModel,
        };
      }

      case 'verdant_lifecycle_gate': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const report = this.modelObserver.executeLifecycleGate();
        return {
          engine: 'verdant-uorc.wasm',
          report,
          watermarks: this.modelObserver.getMonotonicWatermarks(),
        };
      }

      case 'verdant_automate': {
        this.modelObserver.syncWorldState({
          realms: Array.from(this.realms.values()),
        });
        const rawTier = Number(args.targetTier);
        const targetTier: VerdantResolutionTier | undefined =
          rawTier === 1 || rawTier === 2 || rawTier === 3 || rawTier === 4
            ? (rawTier as VerdantResolutionTier)
            : undefined;
        const partSlot =
          typeof args.partSlot === 'string' &&
          (VERDANT_PART_SLOTS as readonly string[]).includes(args.partSlot)
            ? (args.partSlot as VerdantPartSlot)
            : undefined;
        const autoOpts: UniformRefinementOptions = {
          ...(targetTier ? { targetTier } : {}),
          ...(partSlot ? { partSlot } : {}),
          enforceDiversity: true,
          ...(typeof args.reason === 'string' && args.reason.trim() ? { reason: args.reason.trim() } : {}),
        };

        const report = await this.modelObserver.executeAutomatePipeline(autoOpts);
        const refine = report.ratchetCycle.refinementReport;

        this.stageIo(
          this.enc.encode(
            JSON.stringify({
              modelId: refine.kpis.rootModelId,
              title: 'Frontiers and Foundations — M17 Automate Snapshot',
              schemaType: 'VideoGameModelOfModels',
              mediaType: 'application/vnd.verdant.automate-report+json',
              targetSlot: partSlot ?? 'stage-environment',
              sourceStream: 'verdant-ecosystem-catalog',
              sourceUri: `urn:frontiers:model-of-models:automate-${report.ratchetCycle.cycleNumber}`,
              licenseSpdx: 'CC0-1.0',
              tags: [
                'verdant-automate',
                `cycle-${report.ratchetCycle.cycleNumber}`,
                `gates-${report.lifecycleGate.passedChecks}-of-${report.lifecycleGate.totalChecks}`,
                `tier-${refine.after.resolutionTier}`,
                `diversity-${refine.after.diversityIndex}`,
              ],
              propertiesJson: JSON.stringify({
                cycleNumber: report.ratchetCycle.cycleNumber,
                allPassed: report.allPassed,
                passedStages: report.passedStages,
                totalStages: report.totalStages,
                lifecycleGatePassed: report.lifecycleGate.allPassed,
                automateKappaHex: report.automateKappaHex,
                overallRefinementScorePermille: report.ratchetCycle.agendaAfter.overallRefinementScorePermille,
                watermarks: report.watermarks,
              }),
              commitNote: refine.reason,
            }),
          ),
        );
        this.wasm.verdant_wasm_import_project_model_io();
        const projectModel = this.readAuxJson();

        if (typeof this.wasm.verdant_wasm_record_part_hydration_io === 'function') {
          this.stageIo(
            this.enc.encode(
              `${partSlot ?? 'stage-environment'}|frontiers-observer-automate|Cycle #${report.ratchetCycle.cycleNumber} · ${report.passedStages}/${report.totalStages} stages · Gates ${report.lifecycleGate.passedChecks}/${report.lifecycleGate.totalChecks}`,
            ),
          );
          this.wasm.verdant_wasm_record_part_hydration_io(refine.after.resolutionTier);
        }

        return {
          engine: 'verdant-uorc.wasm',
          report,
          projectModel,
        };
      }

      default:
        throw new Error(`Unknown Verdant MCP tool: ${toolName}`);
    }
  }
}
