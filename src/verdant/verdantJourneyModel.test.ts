import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTED_JOURNEY_MILESTONES,
  FIELD_MANUAL_SECTIONS,
  JOURNEY_FLOW_EDGES,
  JOURNEY_FLOW_STATES,
  PROLOGUE_CINEMATIC_ACTS,
  WAYWRIGHT_OATH_CHOICES,
  evaluateJourneyProgress,
  resolvePrologueCaptionAt,
  verifyGamerJourneyGraph,
} from './verdantJourneyModel';
import {
  LEGACY_SAVE_STORAGE_KEY,
  SAVE_SLOTS_STORAGE_KEY,
  countOccupiedSaveSlots,
  createFreshJourneyPayload,
  createNewSaveSlot,
  deleteSaveSlot,
  formatPlayTime,
  formatSaveTimestamp,
  getFirstEmptySaveSlotId,
  getMostRecentSaveSlot,
  loadSaveSlotStore,
  renameSaveSlot,
  updateSaveSlotProgress,
  type StorageLike,
} from '../game/saveSlotStorage';
import { INITIAL_GUILDS, INITIAL_QUESTS } from '../game/worldData';
import { buildFrontiersModelOfModels, getModelById } from './verdantModelOfModels';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('Verdant Gamer Journey Model, Multi-Media Animated Prologue, Field Manual & 3-Slot Expedition Save Storage', () => {
  it('formally verifies 100% reachability, zero deadlocks, in-world Prologue immersion, Live 3D Reveal, and Field Manual separation', () => {
    const report = verifyGamerJourneyGraph();
    assert.equal(report.passed, true);
    assert.equal(report.totalStates, 12);
    assert.equal(report.reachableStates, 12);
    assert.deepEqual(report.unreachableStates, []);
    assert.deepEqual(report.deadEndStates, []);
    assert.equal(report.prologueActCount, 5);
    assert.ok(report.totalCaptionCues >= 12);
    assert.equal(report.milestoneCount, 6);
    assert.equal(report.fieldManualSectionCount, 4);
    assert.equal(report.oathChoiceCount, 3);
    assert.equal(report.inWorldPrologueOnly, true);
    assert.equal(report.hasLive3DRevealScene, true);
    assert.equal(report.hasNewGameToPrologueEdge, true);
    assert.equal(report.hasSaveSlotResumeEdge, true);
    assert.equal(report.hasVictoryPath, true);
    assert.equal(JOURNEY_FLOW_STATES.length, 12);
    assert.ok(JOURNEY_FLOW_EDGES.length >= 30);
  });

  it('delivers pure in-world multi-media Prologue scenes (zero keybinds/trailer copy), sound-design captions, dynamic Oath personalization, and Scene V Live 3D Reveal', () => {
    assert.equal(PROLOGUE_CINEMATIC_ACTS.length, 5);
    const forbiddenKeybind = /\[[1-4UEGMVI]\]|\bWASD\b|\bShift Dodge\b/i;

    for (const act of PROLOGUE_CINEMATIC_ACTS) {
      assert.ok(act.imageUrl.includes('/src/assets/images/prologue_'));
      assert.ok(act.vfxPreset.length > 0);
      assert.ok(act.audioCueLabel.length > 5);
      assert.ok(act.captions.length >= 2);
      for (const cue of act.captions) {
        assert.ok(cue.ambientSoundCue && cue.ambientSoundCue.startsWith('['), `${cue.id} should include sound-design caption cue`);
        assert.equal(forbiddenKeybind.test(cue.text), false, `Found fourth-wall keybind in ${cue.id}`);
      }
      const firstCue = resolvePrologueCaptionAt(act, 0.08, { waywrightName: 'Lyra' });
      const lastCue = resolvePrologueCaptionAt(act, 0.92, { waywrightName: 'Lyra' });
      assert.notEqual(firstCue.id, lastCue.id, `${act.actId} should advance captions across scene duration`);
      assert.ok(firstCue.speaker.length > 0 && lastCue.text.length > 20);
    }

    // Scene I interpolates player's Waywright name
    const s1 = resolvePrologueCaptionAt(PROLOGUE_CINEMATIC_ACTS[0], 0.1, { waywrightName: 'Maren' });
    assert.ok(s1.text.includes('Maren'));

    // Scene II carries timed seismic fracture tremor
    assert.ok(typeof PROLOGUE_CINEMATIC_ACTS[1].cameraTremorAtPct === 'number');

    // Scene IV carries interactive Waywright Oath beat & Scene V carries Live 3D Reveal
    assert.equal(PROLOGUE_CINEMATIC_ACTS[3].interactiveOathBeat, true);
    assert.equal(PROLOGUE_CINEMATIC_ACTS[4].live3DReveal, true);

    // Selecting distinct Waywright Oaths changes Orenna's Dawn reply in Scene V
    assert.equal(WAYWRIGHT_OATH_CHOICES.length, 3);
    const replyBridges = resolvePrologueCaptionAt(PROLOGUE_CINEMATIC_ACTS[4], 0.8, {
      waywrightName: 'Maren',
      oathId: 'bridges',
    });
    const replyAbyss = resolvePrologueCaptionAt(PROLOGUE_CINEMATIC_ACTS[4], 0.8, {
      waywrightName: 'Maren',
      oathId: 'abyss',
    });
    assert.ok(replyBridges.text.includes('Maren'));
    assert.ok(replyAbyss.text.includes('Maren'));
    assert.notEqual(replyBridges.text, replyAbyss.text);
  });

  it('provides a complete out-of-world Field Manual separated from the Prologue', () => {
    assert.equal(FIELD_MANUAL_SECTIONS.length, 4);
    for (const sec of FIELD_MANUAL_SECTIONS) {
      assert.ok(sec.tabLabel.length > 2);
      assert.ok(sec.entries.length >= 3, `${sec.id} should contain at least 3 guide entries`);
    }
  });

  it('tracks the 6 Directed Journey Milestones cleanly from fresh arrival to sovereign completion', () => {
    const freshQuests = INITIAL_QUESTS.map((q) => ({
      ...q,
      objectives: q.objectives.map((o) => ({ ...o, currentCount: 0 })),
    }));
    const start = evaluateJourneyProgress({
      quests: freshQuests,
      defeatedCount: 0,
      bannersCount: 0,
      gearUpgradeTotal: 0,
      hasVisitedDungeon: false,
      discoveredRegions: ['southern-terrace'],
      prologueCompleted: true,
    });
    assert.equal(start.completedCount, 0);
    assert.equal(start.totalCount, DIRECTED_JOURNEY_MILESTONES.length);
    assert.equal(start.activeMilestone?.id, 'speak-orenna');
    assert.equal(start.allMilestonesComplete, false);

    // Advance Orenna dialogue + Pier ringing + combat + banner + forge + dungeon delve
    const advancedQuests = freshQuests.map((q) =>
      q.id === 'quest-sinking-pier'
        ? {
            ...q,
            objectives: q.objectives.map((o) => ({ ...o, currentCount: o.requiredCount })),
          }
        : q,
    );
    const complete = evaluateJourneyProgress({
      quests: advancedQuests,
      defeatedCount: 2,
      bannersCount: 1,
      gearUpgradeTotal: 1,
      hasVisitedDungeon: true,
      discoveredRegions: ['southern-terrace', 'dungeon-sanctum'],
      prologueCompleted: true,
    });
    assert.equal(complete.completedCount, 6);
    assert.equal(complete.completionPct, 100);
    assert.equal(complete.activeMilestone, null);
    assert.equal(complete.allMilestonesComplete, true);
  });

  it('registers all 5 Prologue Scenes, Field Manual, 6 Journey Milestones, Gamer Journey Flow, and Multi-Slot Save Charter in the unified Model-of-Models', () => {
    const root = buildFrontiersModelOfModels();
    assert.ok(getModelById(root, 'frontiers:journey:experience-flow'));
    assert.ok(getModelById(root, 'frontiers:journey:field-manual'));
    assert.ok(getModelById(root, 'frontiers:framework:multi-slot-save-charter'));
    for (const act of PROLOGUE_CINEMATIC_ACTS) {
      assert.ok(getModelById(root, `frontiers:prologue:${act.actId}`), `Missing ${act.actId} in Model-of-Models`);
    }
    for (const m of DIRECTED_JOURNEY_MILESTONES) {
      assert.ok(
        getModelById(root, `frontiers:journey:milestone:${m.id}`),
        `Missing milestone ${m.id} in Model-of-Models`,
      );
    }
  });

  it('persists, updates (including Waywright Oath), renames, deletes, and migrates 3 Expedition Save Slots deterministically', () => {
    const storage = createMemoryStorage();
    const empty = loadSaveSlotStore(storage, 'Alden');
    assert.equal(countOccupiedSaveSlots(empty), 0);
    assert.equal(getMostRecentSaveSlot(empty), null);
    assert.equal(getFirstEmptySaveSlotId(empty), 'slot-1');

    // Create Slot 1 and Slot 2
    const c1 = createNewSaveSlot(
      empty,
      { slotId: 'slot-1', waywrightName: 'Kaelen-V', pledgedGuildId: INITIAL_GUILDS[0].id, now: 1000 },
      storage,
    );
    assert.equal(countOccupiedSaveSlots(c1.store), 1);
    assert.equal(getFirstEmptySaveSlotId(c1.store), 'slot-2');

    const c2 = createNewSaveSlot(
      c1.store,
      { slotId: 'slot-2', waywrightName: 'Seraia-M', pledgedGuildId: INITIAL_GUILDS[1].id, now: 2000 },
      storage,
    );
    assert.equal(countOccupiedSaveSlots(c2.store), 2);
    assert.equal(getMostRecentSaveSlot(c2.store)?.slotId, 'slot-2');

    // Progress update on Slot 1 makes Slot 1 most recent + increments play time + records Waywright Oath
    const updatedJourney = createFreshJourneyPayload(INITIAL_GUILDS[0].id);
    updatedJourney.renown = 175;
    updatedJourney.regionName = 'Third Resonance Pier';
    const afterUpdate = updateSaveSlotProgress(
      c2.store,
      {
        slotId: 'slot-1',
        waywrightName: 'Kaelen-V',
        journey: updatedJourney,
        playTimeDeltaSec: 125,
        prologueCompleted: true,
        waywrightOath: 'abyss',
        journeyChapterTitle: 'Survey: Sound a Resonance Pier or Beacon',
        now: 3500,
      },
      storage,
    );
    assert.equal(getMostRecentSaveSlot(afterUpdate)?.slotId, 'slot-1');
    assert.equal(afterUpdate.slots['slot-1']?.renown, 175);
    assert.equal(afterUpdate.slots['slot-1']?.playTimeSec, 125);
    assert.equal(afterUpdate.slots['slot-1']?.prologueCompleted, true);
    assert.equal(afterUpdate.slots['slot-1']?.waywrightOath, 'abyss');
    assert.equal(formatPlayTime(125), '2m');
    assert.equal(formatPlayTime(3725), '1h 2m');
    assert.equal(formatSaveTimestamp(3500, 3530 * 1000), formatSaveTimestamp(3500, 3530 * 1000));

    // Rename Slot 1 & reload from storage
    const renamed = renameSaveSlot(afterUpdate, 'slot-1', 'Tarsik Prime', storage);
    const reloaded = loadSaveSlotStore(storage, 'Fallback');
    assert.equal(reloaded.slots['slot-1']?.waywrightName, 'Tarsik Prime');
    assert.equal(reloaded.slots['slot-1']?.waywrightOath, 'abyss');
    assert.equal(reloaded.slots['slot-2']?.waywrightName, 'Seraia-M');
    assert.equal(reloaded.slots['slot-3'], null);

    // Delete Slot 1 -> Slot 2 becomes active
    const afterDelete = deleteSaveSlot(renamed, 'slot-1', storage);
    assert.equal(afterDelete.slots['slot-1'], null);
    assert.equal(afterDelete.activeSlotId, 'slot-2');
    assert.equal(countOccupiedSaveSlots(afterDelete), 1);

    // Verify seamless legacy v3 migration into Slot 1
    const legacyStorage = createMemoryStorage();
    const legacyPayload = createFreshJourneyPayload(INITIAL_GUILDS[2].id);
    legacyPayload.renown = 420;
    legacyStorage.setItem(LEGACY_SAVE_STORAGE_KEY, JSON.stringify(legacyPayload));
    const migrated = loadSaveSlotStore(legacyStorage, 'LegacyScout');
    assert.equal(countOccupiedSaveSlots(migrated), 1);
    assert.equal(migrated.slots['slot-1']?.waywrightName, 'LegacyScout');
    assert.equal(migrated.slots['slot-1']?.renown, 420);
    assert.ok(legacyStorage.getItem(SAVE_SLOTS_STORAGE_KEY));
  });
});
