import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// Where the holo's page loads the game's textures, models and sounds: the live
// Pages site. A holo's page is at most 4 MiB and runs in a sandboxed frame
// with no files beside it, so the assets stay on the site.
const holoAssetBase = process.env.HOLO_ASSET_BASE ?? 'https://afflom.github.io/frontiers-and-foundations/';

export default defineConfig(({mode}) => {
  const rawBase = process.env.VITE_BASE_PATH || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  // `vite build --mode holo` writes the game into prism/view/, the page of the
  // Prism holo: one self-contained script and stylesheet, no chunks, no public
  // files, built as the static Pages game.
  const holo = mode === 'holo';

  return {
    base: holo ? './' : base,
    ...(holo
      ? {
          define: {
            'import.meta.env.BASE_URL': JSON.stringify(holoAssetBase),
            'import.meta.env.VITE_STATIC_PAGES': JSON.stringify('true'),
          },
          build: {
            outDir: 'prism/view',
            emptyOutDir: true,
            copyPublicDir: false,
            cssCodeSplit: false,
            modulePreload: false,
            assetsInlineLimit: 0,
            chunkSizeWarningLimit: 4096,
            rollupOptions: {
              output: {
                codeSplitting: false,
                entryFileNames: 'game.js',
                assetFileNames: 'game[extname]',
              },
            },
          },
        }
      : {}),
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds, and writes GitHub Pages static artifacts.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          if (fs.existsSync(distDir)) {
            fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
            const indexPath = path.join(distDir, 'index.html');
            const fallbackPath = path.join(distDir, '404.html');
            if (fs.existsSync(indexPath)) {
              fs.copyFileSync(indexPath, fallbackPath);
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
