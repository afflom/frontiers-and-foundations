import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaticPagesHost, resolvePublicUrl } from './publicUrl';

test('resolvePublicUrl preserves root paths when base is "/"', () => {
  assert.equal(resolvePublicUrl('/verdant/verdant-uorc.wasm', '/'), '/verdant/verdant-uorc.wasm');
  assert.equal(resolvePublicUrl('verdant/audio-worklet.mjs', '/'), '/verdant/audio-worklet.mjs');
});

test('resolvePublicUrl prefixes GitHub Pages project subpaths cleanly without double prefixing', () => {
  assert.equal(
    resolvePublicUrl('/verdant/realms/vaelmor/world.glb', '/frontiers-and-foundations'),
    '/frontiers-and-foundations/verdant/realms/vaelmor/world.glb',
  );
  assert.equal(
    resolvePublicUrl('/src/assets/images/ff_world_panorama.jpg', '/frontiers-and-foundations/'),
    '/frontiers-and-foundations/src/assets/images/ff_world_panorama.jpg',
  );
  // Idempotent if already prefixed
  assert.equal(
    resolvePublicUrl(
      '/frontiers-and-foundations/verdant/verdant-uorc.wasm',
      '/frontiers-and-foundations/',
    ),
    '/frontiers-and-foundations/verdant/verdant-uorc.wasm',
  );
});

test('resolvePublicUrl leaves absolute, data, and blob URLs untouched', () => {
  assert.equal(
    resolvePublicUrl('https://example.com/sky.jpg', '/frontiers-and-foundations/'),
    'https://example.com/sky.jpg',
  );
  assert.equal(
    resolvePublicUrl('data:image/png;base64,abc', '/frontiers-and-foundations/'),
    'data:image/png;base64,abc',
  );
  assert.equal(
    resolvePublicUrl('blob:https://example.com/123', '/frontiers-and-foundations/'),
    'blob:https://example.com/123',
  );
});

test('isStaticPagesHost detects static Pages env flag and github.io domains', () => {
  assert.equal(isStaticPagesHost('localhost', undefined), false);
  assert.equal(isStaticPagesHost('localhost', 'true'), true);
  assert.equal(isStaticPagesHost('afflom.github.io', undefined), true);
  assert.equal(isStaticPagesHost('play.example.com', 'false'), false);
});
