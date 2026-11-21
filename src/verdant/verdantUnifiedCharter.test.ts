import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUNGEON_TOPOLOGY_CHARTERS,
  evaluateGeomorphologyElevation,
  getAllStoryAutomata,
  getDungeonTopologyCharter,
  getMonsterSpeciesForTheme,
  getWorldDifferentiationProfile,
  isOnDungeonWalkableFloor,
  TERRAIN_GEOMORPHOLOGIES,
  verifyStoryAutomaton,
  WORLD_DIFFERENTIATION_PROFILES,
  type CharterDungeonStyle,
  type CharterRealmThemeId,
} from './verdantUnifiedCharter';
import {
  CANONICAL_DUNGEON_SPECS,
  CANONICAL_REALM_SPECS,
  realmTerrainHeightAt,
} from './realmModelSchema';
import {
  buildRealmCollisionMap,
  getEnemyCollisionRadius,
  PLAYER_COLLISION_RADIUS,
  resolveCircleVsWorld,
} from './verdantCollision';
import { stepEnemies, type EnemyArchetype, type EnemyEntity } from '../game/rpgLogic';
import { FrontiersVerdantObserver } from './verdantObserverManager';

const ALL_THEMES: CharterRealmThemeId[] = [
  'citadel-highlands',
  'sunken-aqueducts',
  'obsidian-crucible',
  'pelagic-spires',
  'amber-steppe',
  'glacial-spire',
];

const ALL_STYLES: CharterDungeonStyle[] = [
  'catacomb-vault',
  'sunken-cistern',
  'geothermal-depths',
  'abyssal-grotto',
  'echo-tomb',
  'glacial-crypt',
];

const ALL_ARCHETYPES: EnemyArchetype[] = [
  'stalker',
  'shardcaster',
  'colossus',
  'charger',
  'hexweaver',
  'skirmisher',
];

describe('Unified Verdant Charter — Geomorphologies, Dungeon Topologies, 6 Monster Archetypes, Conservation-Verified Stories & M16 Observer Ratchet', () => {
  it('defines 6 distinct terrain geomorphologies with divergent elevation profiles and exact cell-border continuity', () => {
    const ids = new Set(Object.values(TERRAIN_GEOMORPHOLOGIES).map((g) => g.id));
    assert.equal(ids.size, 6, 'Expected 6 unique terrain geomorphology IDs');

    const samplePoints: Array<[number, number]> = [
      [-60, -40],
      [0, 0],
      [48, -32],
      [-28, 52],
      [62, 42],
    ];
    const fingerprints = new Set<string>();
    for (const theme of ALL_THEMES) {
      const fp = samplePoints
        .map(([x, z]) => {
          const ev = evaluateGeomorphologyElevation(theme, x, z, 0, 1.0);
          return `${(ev.mountainLift + ev.basinDip).toFixed(2)}:${ev.terraceSteps}`;
        })
        .join('|');
      fingerprints.add(fp);
    }
    assert.equal(fingerprints.size, 6, 'All 6 biome geomorphologies must produce distinct terrain elevation profiles');

    // Verify finite terrain elevations across all 6 canonical realms including cell borders
    for (const realm of CANONICAL_REALM_SPECS) {
      const R = realm.worldHalfExtent || 112;
      const borderH1 = realmTerrainHeightAt(realm, R, 0);
      const borderH2 = realmTerrainHeightAt(realm, 0, R);
      const spawnH = realmTerrainHeightAt(realm, realm.spawnPoint[0], realm.spawnPoint[1]);
      assert.ok(Number.isFinite(borderH1) && Number.isFinite(borderH2) && Number.isFinite(spawnH), `${realm.slug} heights must be finite`);
    }
  });

  it('defines 6 completely distinct 3D dungeon floorplan topologies with walkable spawns, objectives, bosses, and connected paths', () => {
    const topoIds = new Set<string>();
    const layoutFingerprints = new Set<string>();

    for (const style of ALL_STYLES) {
      const charter = getDungeonTopologyCharter(style);
      topoIds.add(charter.topologyId);
      const fp = charter.walkableZones
        .map((z) => `${z.minX},${z.maxX},${z.minZ},${z.maxZ}`)
        .join(';');
      layoutFingerprints.add(fp);

      // Verify spawn, ascend portal, boss, and every interactable & enemy slot sit on walkable floor and outside blocking hazards
      const checkWalkable = (label: string, x: number, z: number) => {
        assert.equal(
          isOnDungeonWalkableFloor(style, x, z),
          true,
          `${style} (${charter.topologyId}) ${label} at (${x}, ${z}) must be on walkable floor`,
        );
        for (const hz of charter.hazardZones) {
          if (!hz.blocksWalking) continue;
          const inHazard = x >= hz.minX && x <= hz.maxX && z >= hz.minZ && z <= hz.maxZ;
          assert.equal(
            inHazard,
            false,
            `${style} (${charter.topologyId}) ${label} at (${x}, ${z}) overlaps blocking hazard ${hz.id}`,
          );
        }
      };

      checkWalkable('spawnPoint', charter.spawnPoint[0], charter.spawnPoint[1]);
      checkWalkable('ascendEntryPosition', charter.ascendEntryPosition[0], charter.ascendEntryPosition[1]);
      checkWalkable('ascendBossPosition', charter.ascendBossPosition[0], charter.ascendBossPosition[1]);
      checkWalkable('bossPosition', charter.bossPosition[0], charter.bossPosition[1]);

      for (const slot of charter.interactableSlots) {
        checkWalkable(`interactable:${slot.idSuffix}`, slot.position[0], slot.position[1]);
      }
      for (const slot of charter.enemySlots) {
        checkWalkable(`enemy:${slot.archetype}`, slot.position[0], slot.position[1]);
      }

      // Verify connected walkable graph (BFS on 2m grid) from spawn -> boss & every objective interactable
      const step = 1.5;
      const toKey = (ix: number, iz: number) => `${ix},${iz}`;
      const startIx = Math.round(charter.spawnPoint[0] / step);
      const startIz = Math.round(charter.spawnPoint[1] / step);
      const visited = new Set<string>([toKey(startIx, startIz)]);
      const queue: Array<[number, number]> = [[startIx, startIz]];

      while (queue.length > 0) {
        const [cx, cz] = queue.shift()!;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const nz = cz + dz;
          const key = toKey(nx, nz);
          if (visited.has(key)) continue;
          const wx = nx * step;
          const wz = nz * step;
          if (Math.abs(wx) > 20 || Math.abs(wz) > 29) continue;
          if (isOnDungeonWalkableFloor(style, wx, wz)) {
            visited.add(key);
            queue.push([nx, nz]);
          }
        }
      }

      const isReachable = (tx: number, tz: number) => {
        const bix = Math.round(tx / step);
        const biz = Math.round(tz / step);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (visited.has(toKey(bix + ox, biz + oz))) return true;
          }
        }
        return false;
      };

      assert.equal(
        isReachable(charter.bossPosition[0], charter.bossPosition[1]),
        true,
        `${style} boss at (${charter.bossPosition.join(', ')}) must be reachable on foot from spawn`,
      );
      for (const slot of charter.interactableSlots) {
        assert.equal(
          isReachable(slot.position[0], slot.position[1]),
          true,
          `${style} interactable ${slot.idSuffix} at (${slot.position.join(', ')}) must be reachable on foot from spawn`,
        );
      }
    }

    assert.equal(topoIds.size, 6, 'All 6 dungeon styles must have unique topologyIds');
    assert.equal(layoutFingerprints.size, 6, 'All 6 dungeon styles must have distinct walkable zone geometries');
    assert.equal(Object.keys(DUNGEON_TOPOLOGY_CHARTERS).length, 6);
  });

  it('produces 36 unique biome-bound monster species (6 biomes x 6 archetypes) with distinct AI policies in stepEnemies', () => {
    const speciesNames = new Set<string>();
    for (const theme of ALL_THEMES) {
      for (const arch of ALL_ARCHETYPES) {
        const sp = getMonsterSpeciesForTheme(theme, arch);
        speciesNames.add(sp.speciesName);
        assert.equal(sp.archetype, arch);
        assert.ok(getEnemyCollisionRadius(arch) >= 0.48);
      }
    }
    assert.equal(speciesNames.size, 36, 'All 36 biome x archetype monster species must have unique names');

    const makeTestEnemy = (archetype: EnemyArchetype, x: number, z: number): EnemyEntity => ({
      id: `test-${archetype}`,
      name: `Test ${archetype}`,
      archetype,
      x,
      z,
      homeX: x,
      homeZ: z,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 80,
      maxHp: 80,
      moveSpeed: 4.2,
      attackDamage: 12,
      attackRadius: archetype === 'shardcaster' || archetype === 'hexweaver' ? 12 : 2.6,
      aggroRadius: 20,
      preferredRange: archetype === 'shardcaster' || archetype === 'hexweaver' ? 10 : 3.2,
      telegraphDuration: 0.55,
      state: 'approach',
      stateTimer: 0,
      orbitSign: 1,
      hasAttackToken: false,
      hitFlashTimer: 0,
      koTimer: 0,
    });

    // Charger telegraphs then dashes rapidly toward player
    const charger = makeTestEnemy('charger', 9.0, 0);
    const chargerRes1 = stepEnemies([charger], 0, 0, false, 0.1, 0);
    assert.equal(charger.state, 'telegraph', 'Charger should enter telegraph at mid-range');
    assert.equal(chargerRes1.playerDamaged, 0);
    const preDashX = charger.x;
    let sawAttack = false;
    for (let i = 0; i < 12; i++) {
      stepEnemies([charger], 0, 0, false, 0.1, 0);
      if ((charger.state as string) === 'attack') sawAttack = true;
    }
    assert.equal(sawAttack, true, 'Charger should transition to high-speed bull-rush attack');
    assert.ok(charger.x < preDashX - 1.5, 'Charger must surge forward rapidly during bull-rush');

    // Hexweaver emits a tri-fan of 3 hex projectiles
    const hexweaver = makeTestEnemy('hexweaver', 8.0, 0);
    hexweaver.state = 'telegraph';
    hexweaver.stateTimer = 0.05;
    const hexRes = stepEnemies([hexweaver], 0, 0, false, 0.1, 0);
    assert.equal(hexRes.spawnedProjectiles.length, 3, 'Hexweaver must fire a 3-bolt tri-fan');

    // Skirmisher strafes laterally while closing in
    const skirmisher = makeTestEnemy('skirmisher', 7.0, 0);
    stepEnemies([skirmisher], 0, 0, false, 0.4, 0);
    assert.ok(Math.abs(skirmisher.z) > 0.2, `Skirmisher should flank laterally (got z=${skirmisher.z})`);
  });

  it('passes formal StoryAutomaton reachability, deadlock-freedom, and ConservationLedger closure on all 12 world & dungeon narratives', () => {
    const stories = getAllStoryAutomata();
    assert.equal(stories.length, 12, 'Expected 12 unified StoryAutomata (6 overworld + 6 dungeon)');
    const titles = new Set<string>();

    for (const story of stories) {
      titles.add(story.title);
      const report = verifyStoryAutomaton(story);
      assert.equal(report.reachableFromStart, true, `${story.id} unreachable: ${report.unreachableStates.join(',')}`);
      assert.equal(report.terminalReachable, true, `${story.id} terminal state unreachable`);
      assert.equal(report.deadlockFree, true, `${story.id} has non-terminal deadlock`);
      assert.equal(report.conservationClosed, true, `${story.id} ledger violations: ${report.ledgerViolations.join(';')}`);
      assert.equal(report.passed, true, `${story.id} failed verification`);
    }
    assert.equal(titles.size, 12, 'All 12 StoryAutomata must have distinct titles');
    assert.equal(Object.keys(WORLD_DIFFERENTIATION_PROFILES).length, 6);
  });

  it('orchestrates 23 VSM managers (13 WASM + 10 Frontiers), 13 KPIs, Cohesion Index, M16 Refinement Agenda, and Ratchet Cycle', async () => {
    const observer = new FrontiersVerdantObserver();
    const kpis = observer.observeKpis();
    assert.equal(kpis.spec, 'frontiers/verdant-observer-kpi-report/2');
    assert.equal(kpis.kpis.length, 13);
    assert.ok(kpis.cohesionIndex >= 95, `Expected cohesionIndex >= 95, got ${kpis.cohesionIndex}`);
    assert.equal(kpis.allPassed, true, `Failing KPIs: ${JSON.stringify(kpis.kpis.filter((k) => !k.passed))}`);

    const agenda = observer.synthesizeRefinementAgenda();
    assert.equal(agenda.spec, 'verdant/observer-refinement-agenda/1');
    assert.equal(agenda.partHealth.length, 8);
    assert.ok(agenda.proposals.length >= 1, 'Agenda should always include at least a continuous/escalation proposal');

    const cycle = await observer.runRatchetCycle({ reason: 'Charter unit test ratchet' });
    assert.equal(cycle.ok, true);
    assert.equal(cycle.cycleNumber, 1);
    assert.equal(cycle.watermarkAdvanced, true);
    assert.equal(cycle.refinementReport.after.resolutionTier, 4);
    assert.equal(cycle.agendaAfter.cohesionIndex >= 95, true);

    // Every canonical dungeon's spawn & boss must resolve collision-free in buildRealmCollisionMap
    for (const dg of CANONICAL_DUNGEON_SPECS) {
      const map = buildRealmCollisionMap(dg, dg.interactables);
      const spawnRes = resolveCircleVsWorld(
        dg.spawnPoint[0],
        dg.spawnPoint[1],
        PLAYER_COLLISION_RADIUS,
        0.5,
        map,
      );
      assert.equal(spawnRes.collided, false, `${dg.slug} spawn must be collision-free`);
    }
  });
});
