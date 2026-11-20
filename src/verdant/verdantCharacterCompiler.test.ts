import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_NPCS } from '../game/worldData';
import { ALL_CANONICAL_WORLDS } from './realmModelSchema';
import {
  buildCharacterProjectModelPayload,
  compileNpcCharacterAppearance,
  compilePlayerCharacterAppearance,
  compileRemoteWaywrightAppearance,
} from './verdantCharacterCompiler';
import {
  findSoftCombatTargetYaw,
  resolveSpringArmCamera,
  shortestAngleDelta,
  stepVelocityMovement,
} from './verdantControls';
import { buildRealmCollisionMap } from './verdantCollision';
import { createInitialEnemies } from '../game/rpgLogic';

describe('Verdant Portrait-to-3D Character Compiler & Fluid Action-RPG Controls', () => {
  it('compiles all 4 canonical Vaelmor NPCs into distinct portrait-matched 3D rigs', () => {
    const rigs = INITIAL_NPCS.map((npc) => ({
      npc,
      rig: compileNpcCharacterAppearance(npc),
    }));
    assert.equal(rigs.length, 4);

    const byId = new Map(rigs.map((r) => [r.npc.id, r.rig]));

    // Orenna Vael: silver braided crown, dark hooded cloak, gold runic clasp, twin scroll satchels, brass dividers
    const orenna = byId.get('npc-orenna');
    assert.ok(orenna);
    assert.equal(orenna.portraitArchetype, 'orenna');
    assert.equal(orenna.garmentStyle, 'hooded-cloak');
    assert.equal(orenna.hairStyle, 'braided-crown');
    assert.equal(orenna.beardStyle, 'none');
    assert.equal(orenna.signatureProp, 'brass-dividers');
    assert.equal(orenna.claspKind, 'runic-gold');

    // Kaelen: windswept grey hair + trimmed beard, sea-green oilskin trench coat, chart satchel, ledger & quill
    const kaelen = byId.get('npc-kaelen');
    assert.ok(kaelen);
    assert.equal(kaelen.portraitArchetype, 'kaelen');
    assert.equal(kaelen.garmentStyle, 'oilskin-coat');
    assert.equal(kaelen.hairStyle, 'windswept');
    assert.equal(kaelen.beardStyle, 'trimmed-grey');
    assert.equal(kaelen.signatureProp, 'ledger-quill');

    // Tarsik: stocky broad build, cropped grey hair, full smith beard, bare muscular forearms, chestnut apron, tuning fork
    const tarsik = byId.get('npc-tarsik');
    assert.ok(tarsik);
    assert.equal(tarsik.portraitArchetype, 'tarsik');
    assert.equal(tarsik.garmentStyle, 'smith-apron');
    assert.equal(tarsik.hairStyle, 'cropped-grey');
    assert.equal(tarsik.beardStyle, 'full-smith');
    assert.equal(tarsik.bareForearms, true);
    assert.ok(tarsik.buildScale[0] > 1.1, 'Tarsik must have broad blacksmith shoulder proportions');
    assert.equal(tarsik.signatureProp, 'tuning-fork');

    // Seraia: deep warm umber skin, braided locs, sage herbalist coat, emerald leaf clasp, glowing specimen jar
    const seraia = byId.get('npc-seraia');
    assert.ok(seraia);
    assert.equal(seraia.portraitArchetype, 'seraia');
    assert.equal(seraia.garmentStyle, 'herbalist-coat');
    assert.equal(seraia.hairStyle, 'braided-locs');
    assert.equal(seraia.beardStyle, 'none');
    assert.equal(seraia.claspKind, 'leaf-emerald');
    assert.equal(seraia.signatureProp, 'specimen-jar');
    assert.ok(seraia.skinRgb[0] < orenna.skinRgb[0] - 0.25, 'Seraia skin tone must match deep warm portrait complexion');

    // Ensure every canonical NPC has a unique garment, hair, and held prop
    assert.equal(new Set(rigs.map((r) => r.rig.garmentStyle)).size, 4);
    assert.equal(new Set(rigs.map((r) => r.rig.hairStyle)).size, 4);
    assert.equal(new Set(rigs.map((r) => r.rig.signatureProp)).size, 4);
  });

  it('compiles distinct Player Waywright and Remote Guild Peer appearances and valid Verdant WASM CharacterRig payloads across all 12 realms', () => {
    const hero = compilePlayerCharacterAppearance('bellhammer', false);
    assert.equal(hero.portraitArchetype, 'waywright-hero');
    assert.equal(hero.garmentStyle, 'waywright-longcoat');
    assert.equal(hero.signatureProp, 'bellhammer');
    assert.equal(hero.hasPauldrons, true);

    const peer = compileRemoteWaywrightAppearance('peer-1', 'guild-kiln', 'lantern');
    assert.equal(peer.portraitArchetype, 'waywright-peer');
    assert.equal(peer.signatureProp, 'lantern');

    let totalCompiled = 0;
    for (const world of ALL_CANONICAL_WORLDS) {
      const npcs = world.slug === 'vaelmor' ? INITIAL_NPCS : world.npcs;
      for (const npc of npcs) {
        const rig = compileNpcCharacterAppearance(npc);
        const payload = buildCharacterProjectModelPayload(npc, rig, world.slug);
        assert.equal(payload.schemaType, 'CharacterRig');
        assert.equal(payload.targetSlot, 'character-actor');
        assert.ok(typeof payload.modelId === 'string' && payload.modelId.includes(world.slug));
        totalCompiled += 1;
      }
    }
    assert.ok(totalCompiled >= 10, `Expected >=10 compiled NPC rigs across 12 realms, got ${totalCompiled}`);
  });

  it('smoothly accelerates, turns along shortest arc, and decelerates cleanly in stepVelocityMovement', () => {
    let vx = 0;
    let vz = 0;
    let yaw = Math.PI;

    // Step forward (W) for 8 frames at 60Hz -> smooth acceleration ramp
    const speeds: number[] = [];
    for (let i = 0; i < 8; i++) {
      const step = stepVelocityMovement({
        inForward: 1,
        inRight: 0,
        camYaw: Math.PI,
        vx,
        vz,
        playerYaw: yaw,
        maxSpeed: 8.6,
        dt: 1 / 60,
      });
      vx = step.vx;
      vz = step.vz;
      yaw = step.playerYaw;
      speeds.push(step.speed);
    }
    assert.ok(speeds[0] > 0.5 && speeds[0] < 2.0, 'First frame must accelerate smoothly instead of snapping instantly');
    assert.ok(speeds[7] > speeds[0], 'Speed must ramp up smoothly across frames');

    // Release input -> smooth crisp deceleration to zero
    for (let i = 0; i < 16; i++) {
      const step = stepVelocityMovement({
        inForward: 0,
        inRight: 0,
        camYaw: Math.PI,
        vx,
        vz,
        playerYaw: yaw,
        maxSpeed: 8.6,
        dt: 1 / 60,
      });
      vx = step.vx;
      vz = step.vz;
    }
    assert.ok(Math.hypot(vx, vz) < 0.01, 'Releasing keys must settle cleanly to zero velocity');

    // Shortest angle delta wraps cleanly across +/- PI
    assert.ok(Math.abs(shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-6);
  });

  it('finds closest enemy for soft combat aim-assist and pulls spring-arm camera forward when obstructed by walls', () => {
    const enemies = createInitialEnemies();
    const target = enemies[0];
    // Position player 3m south of first enemy facing away -> aim-assist should return yaw toward enemy
    const assistYaw = findSoftCombatTargetYaw(target.x, target.z + 3.0, 0, enemies, 5.4);
    assert.ok(assistYaw !== null, 'Soft combat aim-assist must locate nearby enemy');
    assert.ok(Math.abs(shortestAngleDelta(assistYaw, Math.PI)) < 0.05, 'Aim-assist yaw must face north toward target');

    // Far away -> returns null
    const noAssist = findSoftCombatTargetYaw(target.x + 50, target.z + 50, 0, enemies, 5.4);
    assert.equal(noAssist, null);

    // Spring-arm collision pulls camera closer when a solid box sits directly behind the player
    const vaelmor = ALL_CANONICAL_WORLDS[0];
    const colMap = buildRealmCollisionMap(vaelmor, vaelmor.interactables);
    const keepBox = colMap.boxes.find((b) => b.label.toLowerCase().includes('citadel') || b.label.toLowerCase().includes('keep')) ?? colMap.boxes[0];
    assert.ok(keepBox, 'Expected at least one solid box collider in Vaelmor');

    const anchorX = (keepBox.minX + keepBox.maxX) * 0.5;
    const anchorZ = keepBox.maxZ + 1.5;
    // Camera facing south (yaw = 0) puts camera eye north (toward -Z, right into keepBox!)
    const spring = resolveSpringArmCamera({
      anchorX,
      anchorY: 2.5,
      anchorZ,
      camYaw: 0,
      camPitch: 0.22,
      desiredDist: 10.0,
      isDungeon: false,
      collisionMap: colMap,
      groundAt: () => 0.9,
    });
    assert.equal(spring.obstructed, true, 'Spring-arm must detect masonry wall directly behind player');
    assert.ok(spring.resolvedDist < 9.5, `Spring-arm must shorten distance (${spring.resolvedDist}) to avoid wall clipping`);
  });
});
