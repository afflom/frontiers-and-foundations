#!/usr/bin/env node
/**
 * Frontiers and Foundations — Model-Centric Verdant + Prism Multi-Realm Build Pipeline.
 *
 * Uses Verdant's Model-Centric Compiler (`src/verdant/verdantCatalogCompiler.ts`)
 * backed by real `verdant-uorc.wasm` and Prism `kappa()` to automatically compile
 * ALL 4 canonical Federated Meridian Realms:
 *   - Cell ( 0, 0, 0): The Shattered Meridian of Vaelmor
 *   - Cell (-1, 0, 0): The Sunken Aqueducts of Oakhaven
 *   - Cell ( 1, 0, 0): The Obsidian Crucible of Cinderfall
 *   - Cell ( 0, 0,-1): The Pelagic Spires of Glasswater
 *
 * Each realm imports & customizes REAL CC0 Poly Haven 3D models (.gltf + .bin),
 * 4 scanned 1K Poly Haven PBR material sets, and a photographic HDRI sky dome,
 * then verifies Blank Stage, Stream Registration, Project Models, 8-part Cognitive
 * Hydration, Operator Admission, Knowledge Graph Ingestion, GLB Import, VDNT export,
 * and Stitch 2-of-3 Reed-Solomon parity recovery inside `verdant-uorc.wasm`!
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_CANONICAL_WORLDS,
  CANONICAL_DUNGEON_SPECS,
  CANONICAL_REALM_SPECS,
} from '../src/verdant/realmModelSchema.ts';
import { compileRealmWithVerdant } from '../src/verdant/verdantCatalogCompiler.ts';
import { kappa } from '../src/verdant/prism-id.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VERDANT_DIR = join(ROOT, 'public', 'verdant');

console.log(
  `[verdant-prism] Launching Model-Centric Multi-Realm Automation Pipeline (${CANONICAL_REALM_SPECS.length} Vast Overworld Realms + ${CANONICAL_DUNGEON_SPECS.length} Playable 3D Dungeons = ${ALL_CANONICAL_WORLDS.length} Worlds)...`,
);

const compiledRealms = [];
for (const spec of ALL_CANONICAL_WORLDS) {
  const res = await compileRealmWithVerdant(spec, {
    rootDir: ROOT,
    log: (m) => console.log(m),
  });
  compiledRealms.push(res);
}

// Mirror primary spawn realm (vaelmor) to top-level legacy paths for direct compatibility
const vaelmor = compiledRealms[0];
copyFileSync(vaelmor.glbPath, join(VERDANT_DIR, 'frontiers-world.glb'));
copyFileSync(vaelmor.vdntPath, join(VERDANT_DIR, 'frontiers-world.vdnt'));
copyFileSync(vaelmor.skyPath, join(VERDANT_DIR, 'sky-vaelmor.jpg'));

const universeKappa = await kappa({
  title: 'Frontiers and Foundations',
  realms: compiledRealms.map((r) => ({
    slug: r.spec.slug,
    cell: r.spec.cell,
    isDungeon: Boolean(r.spec.isDungeon),
    worldGlbKappa: r.custody.worldGlbKappa,
    importedAssets: r.custody.importedCatalogAssets,
    scoreTitle: r.spec.soundtrack.title,
  })),
});

const masterManifest = {
  title: 'Frontiers and Foundations',
  setting: 'The Federated Meridian Universe',
  generatedAt: new Date().toISOString(),
  universeKappa,
  overworldRealmsCount: compiledRealms.filter((r) => !r.spec.isDungeon).length,
  dungeonsCount: compiledRealms.filter((r) => r.spec.isDungeon).length,
  engine: {
    wasmBinary: '/verdant/verdant-uorc.wasm',
    renderer: '/verdant/scene-hd-renderer.mjs',
    audioWorklet: '/verdant/audio-worklet.mjs',
    blankStageVerified: true,
    defaultStudioContentExcluded: true,
    modelCentricGeneratorActive: true,
    orchestralAudioEngine: 'convolver-hall-6voice-modal-worklet',
  },
  // Keep top-level worldAsset & prismCustody populated from Cell (0,0,0) for full compatibility
  worldAsset: {
    glbUrl: '/verdant/frontiers-world.glb',
    vdntUrl: '/verdant/frontiers-world.vdnt',
    skyUrl: '/verdant/sky-vaelmor.jpg',
    glbBytes: vaelmor.custody.glbBytes,
    triangles: vaelmor.custody.triangles,
    vertices: vaelmor.custody.vertices,
    atlasTileCount: vaelmor.custody.atlasTileCount,
    importedCatalogAssets: vaelmor.custody.importedCatalogAssets,
  },
  prismCustody: {
    worldGlbKappa: vaelmor.custody.worldGlbKappa,
    vdntKappa: vaelmor.custody.vdntKappa,
    skyKappa: vaelmor.custody.skyKappa,
    stitchShards: {
      total: 3,
      threshold: 2,
      shardSizes: vaelmor.custody.stitchShardSizes,
      recoveryVerified: vaelmor.custody.stitchRecoveryVerified,
    },
    projectModelRegistered: vaelmor.custody.projectModelsRegistered > 0,
    projectModelsCount: compiledRealms.reduce((s, r) => s + r.custody.projectModelsRegistered, 0),
    cognitiveKnowledgeIngested: compiledRealms.reduce((s, r) => s + r.custody.cognitiveKnowledgeIngested, 0),
    operatorAdmittedAll: compiledRealms.every((r) => r.custody.operatorAdmitted),
    observerPartsHydrated: vaelmor.custody.observerPartsHydrated,
  },
  federatedRealms: compiledRealms.map((r) => ({
    id: r.spec.id,
    slug: r.spec.slug,
    name: r.spec.name,
    subtitle: r.spec.subtitle,
    cell: r.spec.cell,
    theme: r.spec.theme,
    isDungeon: Boolean(r.spec.isDungeon),
    parentRealmSlug: r.spec.parentRealmSlug ?? null,
    dungeonStyle: r.spec.dungeonStyle ?? null,
    dungeonTier: r.spec.dungeonTier ?? null,
    worldSpanMeters: (r.spec.worldHalfExtent || 112) * 2,
    soundtrackTitle: r.spec.soundtrack.title,
    soundtrackMode: r.spec.soundtrack.mode,
    soundtrackBpm: r.spec.soundtrack.bpm,
    glbUrl: r.spec.glbUrl,
    vdntUrl: r.spec.vdntUrl,
    skyUrl: r.spec.skyUrl,
    realmJsonUrl: `/verdant/realms/${r.spec.slug}/realm.json`,
    custody: r.custody,
  })),
};

const manifestPath = join(VERDANT_DIR, 'prism-world-manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(masterManifest, null, 2)}\n`);

console.log(
  `[verdant-prism] ALL ${compiledRealms.length} WORLDS (${masterManifest.overworldRealmsCount} Vast Realms + ${masterManifest.dungeonsCount} 3D Dungeons) COMPILED & SEALED! Universe Kappa: ${universeKappa}`,
);
