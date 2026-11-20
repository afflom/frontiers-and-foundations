import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_GAME_MODEL } from './verdantModel';
import { sealStitchParityBundle, recoverFromStitchShards } from './stitchParity';
import { verifyStoryAutomaton, auditAntiTropeNovelty } from './cognitiveNovelty';

test('Stitch 2-of-3 parity bundle recovers bit-exact payload when any single shard is dropped', async () => {
  const payload = JSON.stringify({
    game: INITIAL_GAME_MODEL.brand.gameTitle,
    sectors: INITIAL_GAME_MODEL.sectors.length,
    guilds: INITIAL_GAME_MODEL.guilds.map((g) => g.name),
  });

  const bundle = await sealStitchParityBundle(payload);
  assert.equal(bundle.shards.length, 3);
  assert.equal(bundle.shards[0].magic, 'STCH');

  // Drop Shard A -> recover from B + P
  const recDropA = await recoverFromStitchShards([bundle.shards[1], bundle.shards[2]]);
  assert.equal(recDropA.ok, true);
  assert.equal(recDropA.droppedSlot, 'A');
  assert.equal(recDropA.recoveredText, payload);

  // Drop Shard B -> recover from A + P
  const recDropB = await recoverFromStitchShards([bundle.shards[0], bundle.shards[2]]);
  assert.equal(recDropB.ok, true);
  assert.equal(recDropB.droppedSlot, 'B');
  assert.equal(recDropB.recoveredText, payload);

  // Drop Parity P -> recover from A + B
  const recDropP = await recoverFromStitchShards([bundle.shards[0], bundle.shards[1]]);
  assert.equal(recDropP.ok, true);
  assert.equal(recDropP.droppedSlot, 'P');
  assert.equal(recDropP.recoveredText, payload);
});

test('Stitch recovery rejects tampered shard bytes', async () => {
  const bundle = await sealStitchParityBundle('Frontiers and Foundations sovereign charter state');
  const tampered = {
    ...bundle.shards[0],
    dataHex:
      (bundle.shards[0].dataHex.startsWith('00') ? 'ff' : '00') +
      bundle.shards[0].dataHex.slice(2),
  };

  const result = await recoverFromStitchShards([tampered, bundle.shards[2]]);
  assert.equal(result.ok, false);
  assert.match(result.diagnostic, /Tamper detected/i);
});

test('StoryAutomaton proves deadlock-freedom and balanced conservation on initial Frontiers and Foundations chronicle', () => {
  const report = verifyStoryAutomaton(
    INITIAL_GAME_MODEL.storyNodes,
    INITIAL_GAME_MODEL.storyEdges,
  );
  assert.equal(report.deadlockFree, true);
  assert.equal(report.conservationLawValid, true);
  assert.equal(report.deadEndNodes.length, 0);
  assert.equal(report.unreachableNodes.length, 0);
  assert.equal(report.shortestPathToResolution['node-charter-arrival'], 8);
});

test('StoryAutomaton detects dead-end nodes when edges do not reach a resolution', () => {
  const brokenNodes = [
    ...INITIAL_GAME_MODEL.storyNodes,
    {
      id: 'node-trap',
      title: 'Collapsed Tunnel Dead-End',
      act: 2 as const,
      kind: 'junction' as const,
      sectorId: 'sec-cinder-fen',
      summary: 'A branch with no outgoing edge.',
      motif: 'Deadlock Test',
      charterDelta: 0,
      frontierEntropyDelta: 0,
    },
  ];
  const brokenEdges = [
    ...INITIAL_GAME_MODEL.storyEdges,
    { from: 'node-charter-arrival', to: 'node-trap', condition: 'Enter unstable drift', cost: 1 },
  ];
  const report = verifyStoryAutomaton(brokenNodes, brokenEdges);
  assert.equal(report.deadlockFree, false);
  assert.deepEqual(report.deadEndNodes, ['node-trap']);
});

test('Anti-trope cognitive auditor catches fantasy clichés and approves bespoke Frontiers & Foundations lore', () => {
  const clicheAudit = auditAntiTropeNovelty(
    'An amnesiac chosen one reads a prophecy scroll to defeat a dark lord in a volcano.',
    INITIAL_GAME_MODEL.overarchingNarrative.bannedTropes,
    INITIAL_GAME_MODEL.overarchingNarrative.usedMotifs,
  );
  assert.equal(clicheAudit.verdict, 'needs_revision');
  assert.ok(clicheAudit.clicheHits.includes('amnesiac chosen one'));
  assert.ok(clicheAudit.clicheHits.includes('prophecy scroll'));

  const freshAudit = auditAntiTropeNovelty(
    'A tide-surveyor negotiates basalt quarry quotas using a tuned acoustic lodestone astrolabe across federated charters.',
    INITIAL_GAME_MODEL.overarchingNarrative.bannedTropes,
    INITIAL_GAME_MODEL.overarchingNarrative.usedMotifs,
  );
  assert.equal(freshAudit.verdict, 'original');
  assert.equal(freshAudit.clicheHits.length, 0);
  assert.ok(freshAudit.distinctiveSignals.length >= 4);
});
