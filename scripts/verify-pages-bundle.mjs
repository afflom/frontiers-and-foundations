#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = { dir: 'dist', base: '/' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      out.dir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--base' && argv[i + 1]) {
      out.base = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const { dir, base } = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(process.cwd(), dir);
const normalizedBase = base.endsWith('/') ? base : `${base}/`;

const realmSlugs = [
  'vaelmor',
  'oakhaven',
  'cinderfall',
  'glasswater',
  'kar-veth',
  'borealis',
  'vault-of-vaelmor',
  'oakhaven-cistern-labyrinth',
  'cinderfall-magma-delve',
  'glasswater-abyssal-grotto',
  'karveth-echo-tomb',
  'borealis-frostglass-crypt',
];

const requiredFiles = [
  'index.html',
  '404.html',
  '.nojekyll',
  'verdant/verdant-uorc.wasm',
  'verdant/scene-hd-renderer.mjs',
  'verdant/audio-worklet.mjs',
  'verdant/prism-world-manifest.json',
  'verdant/frontiers-world.glb',
  ...realmSlugs.flatMap((slug) => [
    `verdant/realms/${slug}/world.glb`,
    `verdant/realms/${slug}/sky.jpg`,
  ]),
];

const missing = [];
for (const rel of requiredFiles) {
  const full = path.join(rootDir, rel);
  if (!fs.existsSync(full)) {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  console.error('GitHub Pages bundle verification FAILED. Missing files:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const expectedPrefix = `${normalizedBase}assets/`;
if (!indexHtml.includes(expectedPrefix)) {
  console.error(
    `GitHub Pages bundle verification FAILED: index.html does not reference expected base prefix "${expectedPrefix}".`,
  );
  process.exit(1);
}

const imagesDir = path.join(rootDir, 'src/assets/images');
const imageCount = fs.existsSync(imagesDir)
  ? fs.readdirSync(imagesDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).length
  : 0;

if (imageCount === 0) {
  console.error('GitHub Pages bundle verification FAILED: no images found in dist/src/assets/images.');
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      dir: rootDir,
      base: normalizedBase,
      verifiedCoreFiles: requiredFiles.length,
      verifiedArtAssets: imageCount,
    },
    null,
    2,
  ),
);
