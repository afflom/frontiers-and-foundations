import { resolvePublicUrl } from '../utils/publicUrl';
import type { GameQuest, RegionId } from '../game/worldData';

export type JourneyFlowStateId =
  | 'title-screen'
  | 'save-slot-select'
  | 'new-game-prologue-cinematic'
  | 'directed-onboarding'
  | 'frontier-exploration'
  | 'guild-dialogue'
  | 'forge-and-atlas'
  | 'dungeon-delve'
  | 'fellowship-coop'
  | 'pause-menu'
  | 'defeat-recovery'
  | 'charter-victory';

export interface JourneyFlowStateNode {
  id: JourneyFlowStateId;
  category: 'menu' | 'cinematic' | 'gameplay' | 'modal' | 'outcome';
  label: string;
  playerIntent: string;
  primaryUiSurface: string;
  availableActions: string[];
}

export interface JourneyFlowEdge {
  from: JourneyFlowStateId;
  to: JourneyFlowStateId;
  trigger: string;
  guaranteesContext: boolean;
}

export type PrologueVfxPreset =
  | 'dusk-ferry'
  | 'pier-fracture'
  | 'vault-awakening'
  | 'workshop-oath'
  | 'causeway-dawn';

export type WaywrightOathId = 'bridges' | 'abyss' | 'fellowship';

export interface WaywrightOathChoice {
  id: WaywrightOathId;
  title: string;
  vowLine: string;
  orennaReply: string;
}

export interface PrologueCaptionCue {
  id: string;
  startPct: number; // 0..1
  endPct: number; // 0..1
  speaker: string;
  ambientSoundCue?: string;
  text: string;
}

export interface PrologueCinematicAct {
  actIndex: number;
  actId: string;
  chapterNumeral: string;
  shortLabel: string;
  title: string;
  subtitleLocation: string;
  durationMs: number;
  imageUrl: string;
  fallbackGradient: string;
  vfxPreset: PrologueVfxPreset;
  audioCueLabel: string;
  cameraTremorAtPct?: number;
  live3DReveal?: boolean;
  interactiveOathBeat?: boolean;
  kenBurns: {
    fromScale: number;
    toScale: number;
    fromX: number;
    toX: number;
    fromY: number;
    toY: number;
  };
  cameraEye: [number, number, number];
  cameraTarget: [number, number, number];
  linkedRealmSlugs: string[];
  linkedNpcIds: string[];
  captions: PrologueCaptionCue[];
}

export interface FieldManualEntry {
  heading: string;
  badge?: string;
  body: string;
}

export interface FieldManualSection {
  id: 'world' | 'instruments' | 'combat-forge' | 'vaults-coop';
  tabLabel: string;
  title: string;
  summary: string;
  entries: FieldManualEntry[];
}

export interface DirectedJourneyMilestone {
  id:
    | 'speak-orenna'
    | 'sound-pier'
    | 'first-skirmish'
    | 'raise-foundation'
    | 'forge-upgrade'
    | 'delve-vault';
  stepNumber: number;
  actLabel: string;
  title: string;
  storyContext: string;
  controlHint: string;
  keybindBadge: string;
  linkedQuestId?: string;
}

export interface JourneyProgressInput {
  quests: GameQuest[];
  defeatedCount: number;
  bannersCount: number;
  gearUpgradeTotal: number;
  hasVisitedDungeon: boolean;
  discoveredRegions: RegionId[];
  prologueCompleted: boolean;
}

export interface JourneyProgressSummary {
  completedIds: DirectedJourneyMilestone['id'][];
  completedCount: number;
  totalCount: number;
  completionPct: number;
  activeMilestone: DirectedJourneyMilestone | null;
  currentChapterTitle: string;
  allMilestonesComplete: boolean;
}

export interface GamerJourneyVerificationReport {
  passed: boolean;
  totalStates: number;
  reachableStates: number;
  unreachableStates: JourneyFlowStateId[];
  deadEndStates: JourneyFlowStateId[];
  prologueActCount: number;
  totalCaptionCues: number;
  milestoneCount: number;
  fieldManualSectionCount: number;
  oathChoiceCount: number;
  inWorldPrologueOnly: boolean;
  hasLive3DRevealScene: boolean;
  hasNewGameToPrologueEdge: boolean;
  hasSaveSlotResumeEdge: boolean;
  hasVictoryPath: boolean;
}

export const PROLOGUE_ACT_ART = {
  scene1: resolvePublicUrl('/src/assets/images/prologue_scene1_dusk_ferry_1795272780001.jpg'),
  scene2: resolvePublicUrl('/src/assets/images/prologue_scene2_pier_fracture_1795272781486.jpg'),
  scene3: resolvePublicUrl('/src/assets/images/prologue_scene3_vault_awakening_1795272781087.jpg'),
  scene4: resolvePublicUrl('/src/assets/images/prologue_act4_waywright_tools_1795271166846.jpg'),
  scene5: resolvePublicUrl('/src/assets/images/prologue_act5_fellowship_banner_1795271168614.jpg'),
} as const;

/**
 * Interactive Waywright Vow choices offered in Scene IV of the Prologue.
 * Personalizes Magistrate Orenna Vael's dawn greeting in Scene V and records the oath in the save slot.
 */
export const WAYWRIGHT_OATH_CHOICES: WaywrightOathChoice[] = [
  {
    id: 'bridges',
    title: 'For the Bridges & Those Who Cross',
    vowLine: 'I answer for the arches, the ferries, and every soul who trusts this stone.',
    orennaReply:
      '"You speak like a true Stonebinder, {waywrightName}. Look north to the Third Pier — let us steady its span before the morning caravans move."',
  },
  {
    id: 'abyss',
    title: 'To Face What Woke Beneath',
    vowLine: 'I answer to descend beneath the arch and silence whatever tore the foundation.',
    orennaReply:
      '"Bold words for a quiet dawn, {waywrightName}. The seals beneath Vaelmor are already groaning — come hear my sounding report first."',
  },
  {
    id: 'fellowship',
    title: 'So No Frontier Stands Alone',
    vowLine: 'I answer to keep the six valleys bound together, shoulder to shoulder.',
    orennaReply:
      '"Then our lanterns burn for the same horizon, {waywrightName}. Step up the causeway — Vaelmor needs a banner raised before noon."',
  },
];

/**
 * Complete canonical menu-to-gameplay Gamer Journey graph for Frontiers and Foundations.
 */
export const JOURNEY_FLOW_STATES: JourneyFlowStateNode[] = [
  {
    id: 'title-screen',
    category: 'menu',
    label: 'Title Screen & Meridian Vista',
    playerIntent: 'Orient to the world of Vaelmor, manage save slots, read the Field Manual, or watch the animated prologue.',
    primaryUiSurface: 'TitleOverlay over live golden-hour 3D Vaelmor flyover',
    availableActions: ['Continue Latest Save', 'Select / Manage Save Slots', 'Start New Journey', 'Watch Prologue', 'Field Manual'],
  },
  {
    id: 'save-slot-select',
    category: 'menu',
    label: 'Expedition Save Slot Ledger',
    playerIntent: 'Create a fresh Waywright expedition, resume saved progress, rename callsign, or clear an old slot.',
    primaryUiSurface: '3-Slot Expedition Charter panel on Title Screen',
    availableActions: ['Create New Expedition in Slot', 'Continue Saved Slot', 'Rename Waywright', 'Delete Slot', 'Replay Prologue'],
  },
  {
    id: 'new-game-prologue-cinematic',
    category: 'cinematic',
    label: 'Multi-Media Animated Opening Prologue (5 Scenes)',
    playerIntent: 'Experience Vaelmor at dusk, witness the Third Pier fracture, swear the Waywright Oath, and dissolve straight into the live 3D dawn causeway.',
    primaryUiSurface: 'Full-bleed widescreen PrologueCinematicOverlay with real-time VFX canvas, procedural audio cues, sound-design closed captions, and Scene V Live 3D Reveal',
    availableActions: ['Auto-Play / Pause', 'Next / Previous Scene', 'Choose Waywright Vow', 'Toggle Caption Size / Mute', 'Step Onto the Causeway'],
  },
  {
    id: 'directed-onboarding',
    category: 'gameplay',
    label: 'Southern Causeway Briefing & First Charter',
    playerIntent: 'Meet Magistrate Orenna Vael, test Resonance instruments, and learn movement, combat, and banners in context.',
    primaryUiSurface: '3D Vaelmor World + unobtrusive Waywright Field Guide & Compass Waypoint',
    availableActions: ['Move & Orbit Camera', 'Speak with Orenna [E]', 'Sound Pier', 'Plant Foundation Banner'],
  },
  {
    id: 'frontier-exploration',
    category: 'gameplay',
    label: 'Six Federated Frontiers Exploration',
    playerIntent: 'Survey bespoke biomes, calibrate waystone beacons, harvest silicate relics, and cross boundless frontier cells.',
    primaryUiSurface: 'Full-viewport WebGL2 3D World + Diegetic HUD',
    availableActions: ['Explore Realms', 'Combat Fauna', 'Harvest Relics', 'Cross Cardinal Waygates'],
  },
  {
    id: 'guild-dialogue',
    category: 'modal',
    label: 'Intelligent NPC & Guild Discourse',
    playerIntent: 'Uncover regional civic crises, concealed guild motives, and advance narrative charters through choices.',
    primaryUiSurface: 'DialogueOverlay with portrait, beliefs, and branching charter choices',
    availableActions: ['Choose Diplomatic or Technical Reply', 'Accept / Advance Charter', 'Return to World'],
  },
  {
    id: 'forge-and-atlas',
    category: 'modal',
    label: 'Field Atlas (Chronicle, Map, Vaults, Forge, Party, Codex)',
    playerIntent: 'Track quests, fast-travel across realms, temper gear, equip biome relics, manage co-op room, and inspect Verdant Codex.',
    primaryUiSurface: 'JournalMapModal (6 tabbed field ledger)',
    availableActions: ['Switch Tracked Charter', 'Fast Travel / Synthesize Realm', 'Upgrade Gear & Relics', 'Inspect Model Codex'],
  },
  {
    id: 'dungeon-delve',
    category: 'gameplay',
    label: 'Subterranean Vault Delve & Apex Colossus',
    playerIntent: 'Navigate distinct multi-chamber 3D dungeon floorplans, ignite seal braziers, open vault chests, and defeat biome bosses.',
    primaryUiSurface: '3D Dungeon Interior + Boss Telegraph HUD',
    availableActions: ['Ignite Seal Braziers', 'Unseal Vault Chests', 'Defeat Apex Colossus', 'Ascend to Overworld'],
  },
  {
    id: 'fellowship-coop',
    category: 'gameplay',
    label: 'Fellowship Co-op Expedition',
    playerIntent: 'Join a shared room code, drop 3D world pings, heal allies with the Meridian Lantern, and rally for boss fights.',
    primaryUiSurface: '3D Ally Nameplates + Party Drawer + Live World Chat',
    availableActions: ['Copy Invite Link', 'Switch Room Code', 'Summon / Warp to Ally', 'Drop Ping [G]', 'Co-op Heal [3]'],
  },
  {
    id: 'pause-menu',
    category: 'modal',
    label: 'Pause, Field Manual & Slot Persistence Menu',
    playerIntent: 'Review run progress, consult the Field Manual, replay the animated prologue, save & return to the Title Screen, or resume play.',
    primaryUiSurface: 'StatusModal (paused)',
    availableActions: ['Resume Journey', 'Field Manual', 'Replay Prologue', 'Restart Active Slot', 'Return to Title Screen'],
  },
  {
    id: 'defeat-recovery',
    category: 'outcome',
    label: 'Fallen on the Frontier Recovery',
    playerIntent: 'Recover at the Southern Causeway Citadel without losing save progress, or restart the charter.',
    primaryUiSurface: 'StatusModal (gameover)',
    availableActions: ['Rise at Citadel', 'Restart Journey', 'Return to Title Screen'],
  },
  {
    id: 'charter-victory',
    category: 'outcome',
    label: 'Meridian Foundations Secured',
    playerIntent: 'Celebrate completing all foundational charters while continuing open-ended exploration across boundless frontiers.',
    primaryUiSurface: 'StatusModal (victory)',
    availableActions: ['Continue Exploring Vaelmor', 'Play Again', 'Return to Title Screen'],
  },
];

export const JOURNEY_FLOW_EDGES: JourneyFlowEdge[] = [
  { from: 'title-screen', to: 'save-slot-select', trigger: 'Inspect or manage 3 expedition save slots', guaranteesContext: true },
  { from: 'title-screen', to: 'new-game-prologue-cinematic', trigger: 'Start New Journey or Watch Prologue', guaranteesContext: true },
  { from: 'title-screen', to: 'frontier-exploration', trigger: 'Continue existing saved slot', guaranteesContext: true },
  { from: 'save-slot-select', to: 'new-game-prologue-cinematic', trigger: 'Begin fresh expedition in chosen slot', guaranteesContext: true },
  { from: 'save-slot-select', to: 'frontier-exploration', trigger: 'Resume saved expedition slot', guaranteesContext: true },
  { from: 'save-slot-select', to: 'title-screen', trigger: 'Close slot management drawer', guaranteesContext: true },
  { from: 'new-game-prologue-cinematic', to: 'directed-onboarding', trigger: 'Complete Scene V Live Reveal or Skip Prologue', guaranteesContext: true },
  { from: 'new-game-prologue-cinematic', to: 'title-screen', trigger: 'Return to Title Screen during replay', guaranteesContext: true },
  { from: 'directed-onboarding', to: 'guild-dialogue', trigger: 'Press [E] near Magistrate Orenna Vael', guaranteesContext: true },
  { from: 'directed-onboarding', to: 'frontier-exploration', trigger: 'Complete opening survey step and roam Vaelmor', guaranteesContext: true },
  { from: 'directed-onboarding', to: 'pause-menu', trigger: 'Press [Esc] or [P]', guaranteesContext: true },
  { from: 'guild-dialogue', to: 'directed-onboarding', trigger: 'Close dialogue during onboarding', guaranteesContext: true },
  { from: 'guild-dialogue', to: 'frontier-exploration', trigger: 'Accept charter and resume exploration', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'guild-dialogue', trigger: 'Converse with any Frontier NPC [E]', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'forge-and-atlas', trigger: 'Open Atlas [J / M / V / I / U]', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'dungeon-delve', trigger: 'Enter Vault Portal [E] or travel via Vaults [V]', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'fellowship-coop', trigger: 'Drop Ping [G], open Chat [T], or join Room [U]', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'pause-menu', trigger: 'Press [Esc] or [P]', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'defeat-recovery', trigger: 'Vitality reaches 0 in combat', guaranteesContext: true },
  { from: 'frontier-exploration', to: 'charter-victory', trigger: 'Complete all foundational charters', guaranteesContext: true },
  { from: 'forge-and-atlas', to: 'frontier-exploration', trigger: 'Close Atlas [Esc] or Fast Travel', guaranteesContext: true },
  { from: 'forge-and-atlas', to: 'dungeon-delve', trigger: 'Launch Delve from Vaults tab', guaranteesContext: true },
  { from: 'dungeon-delve', to: 'frontier-exploration', trigger: 'Ascend Dungeon Exit Portal [E]', guaranteesContext: true },
  { from: 'dungeon-delve', to: 'defeat-recovery', trigger: 'Fall to Vault fauna or Apex Colossus', guaranteesContext: true },
  { from: 'dungeon-delve', to: 'pause-menu', trigger: 'Press [Esc] or [P]', guaranteesContext: true },
  { from: 'fellowship-coop', to: 'frontier-exploration', trigger: 'Continue exploring alongside party', guaranteesContext: true },
  { from: 'fellowship-coop', to: 'dungeon-delve', trigger: 'Summon party into Vault Delve', guaranteesContext: true },
  { from: 'pause-menu', to: 'frontier-exploration', trigger: 'Resume Journey', guaranteesContext: true },
  { from: 'pause-menu', to: 'new-game-prologue-cinematic', trigger: 'Replay Prologue Cinematic', guaranteesContext: true },
  { from: 'pause-menu', to: 'title-screen', trigger: 'Save & Return to Title Screen', guaranteesContext: true },
  { from: 'defeat-recovery', to: 'frontier-exploration', trigger: 'Rise at Southern Causeway Citadel', guaranteesContext: true },
  { from: 'defeat-recovery', to: 'title-screen', trigger: 'Return to Title Screen', guaranteesContext: true },
  { from: 'charter-victory', to: 'frontier-exploration', trigger: 'Continue Exploring Vaelmor', guaranteesContext: true },
  { from: 'charter-victory', to: 'title-screen', trigger: 'Return to Title Screen', guaranteesContext: true },
];

/**
 * 5-Scene In-World Multi-Media Animated Prologue.
 * Strictly diegetic storytelling (zero fourth-wall keybinds or trailer feature lists):
 * drops the player directly into Vaelmor at dusk, witnesses the Third Pier fracture,
 * seals the Waywright Oath, and seamlessly dissolves into the live 3D world at dawn.
 */
export const PROLOGUE_CINEMATIC_ACTS: PrologueCinematicAct[] = [
  {
    actIndex: 0,
    actId: 'prologue-scene-1-dusk-ferry',
    chapterNumeral: 'Scene I',
    shortLabel: 'Dusk Crossing',
    title: 'Dusk Crossing to Vaelmor',
    subtitleLocation: 'Lower Gorge Ferry · Last Light',
    durationMs: 10500,
    imageUrl: PROLOGUE_ACT_ART.scene1,
    fallbackGradient: 'linear-gradient(135deg, #161d28 0%, #3d2c1b 55%, #0e131a 100%)',
    vfxPreset: 'dusk-ferry',
    audioCueLabel: 'Evening Cello & Distant Meridian Bell',
    kenBurns: { fromScale: 1.03, toScale: 1.12, fromX: -1.2, toX: 1.4, fromY: 0.6, toY: -0.9 },
    cameraEye: [-18, 12.5, 34],
    cameraTarget: [0, 4.4, -10],
    linkedRealmSlugs: ['vaelmor'],
    linkedNpcIds: ['npc-orenna'],
    captions: [
      {
        id: 'scene1-c1',
        startPct: 0.0,
        endPct: 0.36,
        speaker: 'Ferryman Corv',
        ambientSoundCue: '[Oars dip through dark gorge water; a distant bronze bell rings once]',
        text: '"Hear that, {waywrightName}? The evening bell on the Parabolic Arch is flat by a quarter-tone. Never heard Vaelmor sing flat in forty winters."',
      },
      {
        id: 'scene1-c2',
        startPct: 0.36,
        endPct: 0.72,
        speaker: 'Ferryman Corv',
        ambientSoundCue: '[Lantern brass creaks softly in the rising mist]',
        text: '"Every aqueduct in Oakhaven, every forge road past Cinderfall — they all ride on the balance of those three basalt piers up ahead."',
      },
      {
        id: 'scene1-c3',
        startPct: 0.72,
        endPct: 1.0,
        speaker: 'Ferryman Corv',
        ambientSoundCue: '[River current quickens beneath the hull]',
        text: '"Magistrate Orenna sent riders down the valley at noon calling for a sworn Waywright. Looks like you made the last boat before the storm."',
      },
    ],
  },
  {
    actIndex: 1,
    actId: 'prologue-scene-2-pier-fracture',
    chapterNumeral: 'Scene II',
    shortLabel: 'The Third Pier',
    title: 'The Night the Pier Slipped',
    subtitleLocation: 'Third Resonance Pier · Stormfall',
    durationMs: 11000,
    imageUrl: PROLOGUE_ACT_ART.scene2,
    fallbackGradient: 'linear-gradient(135deg, #101920 0%, #162e29 52%, #0c1117 100%)',
    vfxPreset: 'pier-fracture',
    audioCueLabel: 'Storm Rain & Subterranean Basalt Fracture',
    cameraTremorAtPct: 0.38,
    kenBurns: { fromScale: 1.05, toScale: 1.13, fromX: 1.2, toX: -1.4, fromY: -0.6, toY: 0.7 },
    cameraEye: [15, 8.2, 18],
    cameraTarget: [0, 1.5, -18],
    linkedRealmSlugs: ['vaelmor', 'vault-of-vaelmor'],
    linkedNpcIds: ['npc-orenna', 'npc-kaelen'],
    captions: [
      {
        id: 'scene2-c1',
        startPct: 0.0,
        endPct: 0.35,
        speaker: 'Magistrate Orenna Vael',
        ambientSoundCue: '[Cold rain lashes the basalt parapet; brass lantern glass rattles]',
        text: '"Hold the plumb line steady, Kaelen. The mortar isn’t crumbling from weather — something beneath the gorge is pulling the keystone downward."',
      },
      {
        id: 'scene2-c2',
        startPct: 0.35,
        endPct: 0.7,
        speaker: 'Magistrate Orenna Vael',
        ambientSoundCue: '[A deep seismic crack shudders through the Third Pier; emerald silicate dust hisses upward]',
        text: '"There—! Half a handbreadth in a single breath! Seal the upper gate before the northern viaduct loses its tension!"',
      },
      {
        id: 'scene2-c3',
        startPct: 0.7,
        endPct: 1.0,
        speaker: 'Magistrate Orenna Vael',
        ambientSoundCue: '[The fractured pier hums on a jagged, dissonant low pitch]',
        text: '"If the Meridian chord breaks here, the roads to every sister frontier will shear away before winter."',
      },
    ],
  },
  {
    actIndex: 2,
    actId: 'prologue-scene-3-vault-awakening',
    chapterNumeral: 'Scene III',
    shortLabel: 'Beneath the Arch',
    title: 'What Stirs Beneath the Arch',
    subtitleLocation: 'The Deep Sunken Vaults · Midnight',
    durationMs: 10500,
    imageUrl: PROLOGUE_ACT_ART.scene3,
    fallbackGradient: 'linear-gradient(135deg, #1b1210 0%, #3a1d13 52%, #0c0d12 100%)',
    vfxPreset: 'vault-awakening',
    audioCueLabel: 'Cavernous Horn Swell & Stone Colossus Breath',
    kenBurns: { fromScale: 1.11, toScale: 1.03, fromX: -1.4, toX: 1.6, fromY: 1.0, toY: -1.0 },
    cameraEye: [0, 17.5, 40],
    cameraTarget: [0, 1.5, -24],
    linkedRealmSlugs: ['vaelmor', 'oakhaven', 'cinderfall', 'glasswater', 'kar-veth', 'borealis'],
    linkedNpcIds: ['npc-seraia'],
    captions: [
      {
        id: 'scene3-c1',
        startPct: 0.0,
        endPct: 0.36,
        speaker: 'Archivist Seraia',
        ambientSoundCue: '[Grinding bronze plates echo from far below the viaduct]',
        text: '"Our founders did not build Vaelmor over empty rock. They pinned the six frontiers above chambers meant to stay sealed forever."',
      },
      {
        id: 'scene3-c2',
        startPct: 0.36,
        endPct: 0.72,
        speaker: 'Archivist Seraia',
        ambientSoundCue: '[Molten amber veins flare across the chasm walls; caravans halt overhead]',
        text: '"When the Third Pier slipped, the old ward-locks gave way. Beneath the aquifers, the calderas, and the sea spires, ancient guardians are waking."',
      },
      {
        id: 'scene3-c3',
        startPct: 0.72,
        endPct: 1.0,
        speaker: 'Archivist Seraia',
        ambientSoundCue: '[A colossal stone hand shifts against the cavern wall]',
        text: '"Resonance-warped beasts are already climbing onto the causeways — drawn like iron filings to every cracked stone."',
      },
    ],
  },
  {
    actIndex: 3,
    actId: 'prologue-scene-4-stonebinder-oath',
    chapterNumeral: 'Scene IV',
    shortLabel: 'The Waywright Oath',
    title: 'The Oath of the Stonebinders',
    subtitleLocation: 'Tarsik’s Citadel Workshop · Before Dawn',
    durationMs: 12200,
    imageUrl: PROLOGUE_ACT_ART.scene4,
    fallbackGradient: 'linear-gradient(135deg, #211810 0%, #372617 55%, #111318 100%)',
    vfxPreset: 'workshop-oath',
    audioCueLabel: 'Anvil Strike, Hearth Embers & Lydian Harp',
    interactiveOathBeat: true,
    kenBurns: { fromScale: 1.04, toScale: 1.13, fromX: 0.8, toX: -1.2, fromY: 0.7, toY: -0.6 },
    cameraEye: [-8.5, 5.4, 24.5],
    cameraTarget: [0, 2.2, 11.5],
    linkedRealmSlugs: ['vaelmor'],
    linkedNpcIds: ['npc-tarsik'],
    captions: [
      {
        id: 'scene4-c1',
        startPct: 0.0,
        endPct: 0.34,
        speaker: 'Artificer Tarsik',
        ambientSoundCue: '[A hammer rings once against tempered lodestone; hearth embers drift upward]',
        text: '"Take them off the bench, {waywrightName} — the Hookblade for close quarters, the Bellhammer to read the fault lines inside living stone."',
      },
      {
        id: 'scene4-c2',
        startPct: 0.34,
        endPct: 0.68,
        speaker: 'Artificer Tarsik',
        ambientSoundCue: '[An emerald lantern ignites with a clear, steady harmonic hum]',
        text: '"Keep the Meridian Lantern close when blood runs thin, and carry the Compass to plant our banner wherever the road is won back."',
      },
      {
        id: 'scene4-c3',
        startPct: 0.68,
        endPct: 1.0,
        speaker: 'Artificer Tarsik',
        ambientSoundCue: '[Quiet crackle of the forge fire as the brass seal cools]',
        text: '"Before the sun clears the ridge and Orenna calls your name — tell the stone why you answer this charter."',
      },
    ],
  },
  {
    actIndex: 4,
    actId: 'prologue-scene-5-causeway-dawn',
    chapterNumeral: 'Scene V',
    shortLabel: 'Dawn in Vaelmor',
    title: 'Dawn on the Southern Causeway',
    subtitleLocation: 'Vaelmor Citadel · First Light',
    durationMs: 9600,
    imageUrl: PROLOGUE_ACT_ART.scene5,
    fallbackGradient: 'linear-gradient(135deg, #1b2226 0%, #3a301e 55%, #12171d 100%)',
    vfxPreset: 'causeway-dawn',
    audioCueLabel: 'Sunrise Strings & Meridian Causeway Reveal',
    live3DReveal: true,
    kenBurns: { fromScale: 1.04, toScale: 1.1, fromX: -0.6, toX: 0.6, fromY: 0.3, toY: -0.5 },
    cameraEye: [0, 4.1, 23.4],
    cameraTarget: [0, 2.0, 12.2],
    linkedRealmSlugs: ['vaelmor'],
    linkedNpcIds: ['npc-orenna', 'npc-kaelen', 'npc-tarsik', 'npc-seraia'],
    captions: [
      {
        id: 'scene5-c1',
        startPct: 0.0,
        endPct: 0.48,
        speaker: 'Magistrate Orenna Vael',
        ambientSoundCue: '[Morning wind sweeps across the live basalt arch; mist lifts from the Southern Causeway]',
        text: '"The storm has broken, and the valley is awake. Come forward, {waywrightName} — the Citadel arch stands right before you."',
      },
      {
        id: 'scene5-c2',
        startPct: 0.48,
        endPct: 1.0,
        speaker: 'Magistrate Orenna Vael',
        ambientSoundCue: '[The Meridian chord steadies in the dawn light]',
        text: '{oathReply}',
      },
    ],
  },
];

/**
 * Out-of-world Waywright's Field Manual (strictly separated from the in-world Prologue).
 * Accessible from the Title Screen and Pause Menu so gameplay info never turns the intro into a trailer.
 */
export const FIELD_MANUAL_SECTIONS: FieldManualSection[] = [
  {
    id: 'world',
    tabLabel: 'Setting & Realms',
    title: 'The Shattered Meridian & Six Federated Frontiers',
    summary:
      'Vaelmor is the central load-bearing citadel of a six-frontier world held in harmonic equilibrium by ancient subterranean piers.',
    entries: [
      {
        heading: 'The Crisis of the Third Pier',
        badge: 'Main Charter',
        body: 'Vaelmor’s Third Pier has slipped out of harmonic phase. Speak with Magistrate Orenna Vael on the Southern Causeway to sound failing piers, stabilize waystone beacons, and push back resonance-warped fauna.',
      },
      {
        heading: 'Six Distinct Overworld Realms',
        badge: 'Map [M]',
        body: 'Travel via the Field Atlas between Vaelmor’s basalt highlands, Oakhaven’s sunken aqueducts, Cinderfall’s obsidian caldera, Glasswater’s sea spires, Kar-Veth’s amber steppes, and Borealis’s glacial cliffs — or walk through cardinal border waygates into newly synthesized frontier cells.',
      },
      {
        heading: '3 Expedition Save Slots',
        badge: 'Title Ledger',
        body: 'Each Expedition Slot persists your Waywright callsign, sworn Vow, guild allegiance, quests, forged relics, Foundation Banners, and current realm automatically.',
      },
    ],
  },
  {
    id: 'instruments',
    tabLabel: 'Instruments & Controls',
    title: 'The Four Waywright Instruments & Navigation',
    summary:
      'Every Waywright carries four multi-purpose tools for exploration, combat, healing, and territory building.',
    entries: [
      {
        heading: '[1] Lodestone Hookblade',
        badge: 'Swift Melee',
        body: 'Fast three-step slash arcs with low stamina drain for clearing agile stalkers and weaving between enemy strikes.',
      },
      {
        heading: '[2] Resonance Bellhammer',
        badge: 'Heavy Stagger',
        body: 'High-impact concussion strikes that shatter armored constructs, ring Resonance Piers, and interrupt boss telegraphs.',
      },
      {
        heading: '[3] Meridian Lantern',
        badge: 'Co-op Mend',
        body: 'Restores your own Vitality and projects a golden harmonic pulse that heals nearby fellow Waywrights in your room.',
      },
      {
        heading: '[4] Waystone Compass',
        badge: 'Foundations',
        body: 'Plants permanent Foundation Banners for your pledged Guild, expanding guild prosperity and marking rally footholds across the frontier.',
      },
      {
        heading: 'Movement & Camera Controls',
        badge: 'Core Input',
        body: 'WASD moves, Space jumps, Shift dodges with invulnerability frames, Left Click or F uses your active instrument, E interacts with NPCs/piers/portals, and Mouse Drag / Scroll / C orbits, zooms, and centers the spring-arm camera.',
      },
    ],
  },
  {
    id: 'combat-forge',
    tabLabel: 'Combat & Forge',
    title: 'Field Crafting, Relics & Tempered Gear',
    summary:
      'Harvest frontier resources from beacons, relics, and vanquished fauna to strengthen your Waywright kit.',
    entries: [
      {
        heading: 'Tempering Instruments',
        badge: 'Forge [I]',
        body: 'Combine Silicate Moss, Lodestone Shards, and Foundry Slag in the Field Forge to upgrade your Hookblade, Bellhammer, Lantern, and Compass through higher mastery tiers.',
      },
      {
        heading: 'Biome-Attuned Relics',
        badge: 'Active Perks',
        body: 'Unseal Vault Chests, fell Apex Colossi, or forge new relics attuned to your current realm’s biome school for custom resonance perks (damage, vitality, frost slow, ember surge, or ward mitigation).',
      },
      {
        heading: 'Reading Enemy Telegraphs',
        badge: 'Dodge [Shift]',
        body: 'Heavy foes and Apex Colossi project luminous ground telegraphs before slamming or firing resonance barrages. Time a Shift dodge or strike with the Bellhammer to break their stance.',
      },
    ],
  },
  {
    id: 'vaults-coop',
    tabLabel: 'Vaults & Co-op',
    title: 'Subterranean Vault Delves & Fellowship Co-op',
    summary:
      'Delve beneath every frontier alone or share a live expedition room with friends.',
    entries: [
      {
        heading: 'Multi-Chamber 3D Vault Delves',
        badge: 'Vaults [V]',
        body: 'Each realm conceals a distinct subterranean dungeon floorplan with seal braziers, vault chests, hazards, and a biome-specific Apex Colossus. Enter glowing Vault Portals [E] or deploy directly from the Vaults tab.',
      },
      {
        heading: 'Shared Fellowship Rooms',
        badge: 'Party [U]',
        body: 'Share your room code or invite link from the Party tab to explore the same realm together with synchronized 3D avatars, shared enemy health, cooperative boss assists, and Lantern healing.',
      },
      {
        heading: '3D Rally Pings & World Chat',
        badge: '[G] Ping · [T] Chat',
        body: 'Press G to drop a 3D Rally Beacon visible to every ally in your realm, summon your party to your current delve from the Party drawer, or press T for live expedition chat.',
      },
    ],
  },
];

/**
 * 6 progressive milestones guiding players clearly from arrival into the full gameplay loop.
 */
export const DIRECTED_JOURNEY_MILESTONES: DirectedJourneyMilestone[] = [
  {
    id: 'speak-orenna',
    stepNumber: 1,
    actLabel: 'Arrival',
    title: 'Briefing with Magistrate Orenna Vael',
    storyContext: 'Learn why Vaelmor’s Third Pier is slipping out of harmonic phase and claim your Waywright survey charter.',
    controlHint: 'Move forward with WASD and press E beside Magistrate Orenna Vael.',
    keybindBadge: 'WASD · E',
    linkedQuestId: 'quest-sinking-pier',
  },
  {
    id: 'sound-pier',
    stepNumber: 2,
    actLabel: 'Survey',
    title: 'Sound a Resonance Pier or Beacon',
    storyContext: 'Test the Citadel’s load-bearing arches so the Stonebinders can measure the fault depth.',
    controlHint: 'Follow the golden compass diamond to a Resonance Pier or Beacon and press E.',
    keybindBadge: 'Compass · E',
    linkedQuestId: 'quest-sinking-pier',
  },
  {
    id: 'first-skirmish',
    stepNumber: 3,
    actLabel: 'Defense',
    title: 'Repel Resonance-Warped Fauna',
    storyContext: 'Clear hostile stalkers and kiln constructs drawn out by the fracturing foundations.',
    controlHint: 'Select Hookblade [1] or Bellhammer [2], strike with Click/F, and dodge with Shift.',
    keybindBadge: '1-2 · Click · Shift',
    linkedQuestId: 'quest-copper-wires',
  },
  {
    id: 'raise-foundation',
    stepNumber: 4,
    actLabel: 'Foundations',
    title: 'Plant a Living Foundation Banner',
    storyContext: 'Anchor your guild’s claim on reclaimed stone so fellow Waywrights can rally to your foothold.',
    controlHint: 'Switch to Waystone Compass [4] and press F or Click to plant a Foundation Banner.',
    keybindBadge: '4 · F',
  },
  {
    id: 'forge-upgrade',
    stepNumber: 5,
    actLabel: 'Craft',
    title: 'Temper an Instrument at the Forge',
    storyContext: 'Spend harvested Silicate Moss, Lodestone Shards, and Foundry Slag to empower your Waywright kit.',
    controlHint: 'Open the Field Forge with I and upgrade any instrument to Tier II.',
    keybindBadge: 'I · Forge',
  },
  {
    id: 'delve-vault',
    stepNumber: 6,
    actLabel: 'Delve',
    title: 'Enter a Subterranean Vault Delve',
    storyContext: 'Descend beneath the Citadel (or any sister frontier) to ignite seal braziers and confront the Apex Colossus.',
    controlHint: 'Open Vault Delves with V or activate a glowing Vault Portal with E.',
    keybindBadge: 'V · Delve',
  },
];

export interface PrologueCaptionContext {
  waywrightName?: string;
  oathId?: WaywrightOathId | null;
}

export function resolvePrologueCaptionAt(
  act: PrologueCinematicAct,
  progress01: number,
  context: PrologueCaptionContext = {},
): PrologueCaptionCue {
  const clamped = Math.max(0, Math.min(0.9999, progress01));
  const raw =
    act.captions.find((c) => clamped >= c.startPct && clamped < c.endPct) ??
    act.captions[act.captions.length - 1];

  const name = (context.waywrightName || 'Waywright').trim() || 'Waywright';
  const oath =
    WAYWRIGHT_OATH_CHOICES.find((o) => o.id === context.oathId) ?? WAYWRIGHT_OATH_CHOICES[0];

  const hydratedText = raw.text
    .replaceAll('{oathReply}', oath.orennaReply)
    .replaceAll('{waywrightName}', name);

  return {
    ...raw,
    text: hydratedText,
  };
}

export function evaluateJourneyProgress(input: JourneyProgressInput): JourneyProgressSummary {
  const completedIds: DirectedJourneyMilestone['id'][] = [];

  const talkedToOrenna = Boolean(
    input.quests.some((q) =>
      q.objectives.some(
        (o) =>
          o.kind === 'talk-npc' &&
          (o.targetId === 'npc-orenna' || q.id === 'quest-sinking-pier') &&
          o.currentCount >= o.requiredCount,
      ),
    ),
  );
  const soundedPier = Boolean(
    input.quests.some((q) =>
      q.objectives.some(
        (o) =>
          (o.kind === 'ring-bell' || o.kind === 'calibrate-beacon') &&
          o.currentCount > 0,
      ),
    ),
  );

  if (talkedToOrenna) completedIds.push('speak-orenna');
  if (soundedPier) completedIds.push('sound-pier');
  if (input.defeatedCount > 0) completedIds.push('first-skirmish');
  if (input.bannersCount > 0) completedIds.push('raise-foundation');
  if (input.gearUpgradeTotal > 0) completedIds.push('forge-upgrade');
  if (
    input.hasVisitedDungeon ||
    input.discoveredRegions.includes('dungeon-sanctum') ||
    input.discoveredRegions.includes('boss-vault')
  ) {
    completedIds.push('delve-vault');
  }

  const totalCount = DIRECTED_JOURNEY_MILESTONES.length;
  const completedCount = completedIds.length;
  const completionPct = Math.round((completedCount / totalCount) * 100);
  const activeMilestone =
    DIRECTED_JOURNEY_MILESTONES.find((m) => !completedIds.includes(m.id)) ?? null;
  const currentChapterTitle = activeMilestone
    ? `${activeMilestone.actLabel}: ${activeMilestone.title}`
    : 'Sovereign Waywright: Boundless Frontiers Open';

  return {
    completedIds,
    completedCount,
    totalCount,
    completionPct,
    activeMilestone,
    currentChapterTitle,
    allMilestonesComplete: completedCount === totalCount,
  };
}

const FOURTH_WALL_KEYBIND_PATTERN = /\[[1-4UEGMVI]\]|\bWASD\b|\bShift Dodge\b/i;

/**
 * Formally verifies reachability, non-deadlock closure, in-world Prologue immersion,
 * Live 3D Reveal presence, and Field Manual separation across the Gamer Journey graph.
 */
export function verifyGamerJourneyGraph(): GamerJourneyVerificationReport {
  const stateIds = new Set(JOURNEY_FLOW_STATES.map((s) => s.id));
  const adjacency = new Map<JourneyFlowStateId, JourneyFlowStateId[]>();
  for (const id of stateIds) adjacency.set(id, []);
  for (const edge of JOURNEY_FLOW_EDGES) {
    if (stateIds.has(edge.from) && stateIds.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
    }
  }

  // BFS reachability from title-screen
  const visited = new Set<JourneyFlowStateId>();
  const queue: JourneyFlowStateId[] = ['title-screen'];
  visited.add('title-screen');
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nxt of adjacency.get(cur) ?? []) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }

  const unreachableStates = JOURNEY_FLOW_STATES.map((s) => s.id).filter((id) => !visited.has(id));
  const deadEndStates = JOURNEY_FLOW_STATES.map((s) => s.id).filter(
    (id) => (adjacency.get(id)?.length ?? 0) === 0,
  );

  const hasNewGameToPrologueEdge = JOURNEY_FLOW_EDGES.some(
    (e) =>
      (e.from === 'title-screen' || e.from === 'save-slot-select') &&
      e.to === 'new-game-prologue-cinematic',
  );
  const hasSaveSlotResumeEdge = JOURNEY_FLOW_EDGES.some(
    (e) => e.from === 'save-slot-select' && e.to === 'frontier-exploration',
  );
  const hasVictoryPath = visited.has('charter-victory');
  const totalCaptionCues = PROLOGUE_CINEMATIC_ACTS.reduce((acc, a) => acc + a.captions.length, 0);

  // Verify the Prologue contains zero fourth-wall keybind/tutorial leaks
  const inWorldPrologueOnly = PROLOGUE_CINEMATIC_ACTS.every((act) =>
    act.captions.every((c) => !FOURTH_WALL_KEYBIND_PATTERN.test(c.text)),
  );
  const hasLive3DRevealScene = PROLOGUE_CINEMATIC_ACTS.some((act) => Boolean(act.live3DReveal));

  const passed =
    unreachableStates.length === 0 &&
    deadEndStates.length === 0 &&
    PROLOGUE_CINEMATIC_ACTS.length === 5 &&
    totalCaptionCues >= 12 &&
    DIRECTED_JOURNEY_MILESTONES.length === 6 &&
    FIELD_MANUAL_SECTIONS.length >= 4 &&
    WAYWRIGHT_OATH_CHOICES.length >= 3 &&
    inWorldPrologueOnly &&
    hasLive3DRevealScene &&
    hasNewGameToPrologueEdge &&
    hasSaveSlotResumeEdge &&
    hasVictoryPath;

  return {
    passed,
    totalStates: JOURNEY_FLOW_STATES.length,
    reachableStates: visited.size,
    unreachableStates,
    deadEndStates,
    prologueActCount: PROLOGUE_CINEMATIC_ACTS.length,
    totalCaptionCues,
    milestoneCount: DIRECTED_JOURNEY_MILESTONES.length,
    fieldManualSectionCount: FIELD_MANUAL_SECTIONS.length,
    oathChoiceCount: WAYWRIGHT_OATH_CHOICES.length,
    inWorldPrologueOnly,
    hasLive3DRevealScene,
    hasNewGameToPrologueEdge,
    hasSaveSlotResumeEdge,
    hasVictoryPath,
  };
}
