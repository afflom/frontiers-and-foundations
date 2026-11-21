import { resolvePublicUrl } from '../utils/publicUrl';
import type { VerdantCharacterAppearance } from '../verdant/verdantCharacterTypes';

export type GamePhase = 'title' | 'intro' | 'playing' | 'paused' | 'victory' | 'gameover';

export type GearSlotId = 'hookblade' | 'bellhammer' | 'lantern' | 'compass';

export type RegionId =
  | 'high-causeway'
  | 'southern-terrace'
  | 'ironwood-reaches'
  | 'ashen-kiln'
  | 'salt-loom'
  | 'northern-watch'
  | 'western-ruins'
  | 'eastern-ridge'
  | 'dungeon-sanctum'
  | 'boss-vault';

export interface WorldRegion {
  id: RegionId;
  name: string;
  subtitle: string;
  center: [number, number];
  radius: number;
  ambientMood: 'causeway' | 'ironwood' | 'foundry' | 'coast';
}

export interface GearDefinition {
  id: GearSlotId;
  slotKey: '1' | '2' | '3' | '4';
  name: string;
  roleClue: string;
  description: string;
  cooldownSec: number;
  staminaCost: number;
  damage: number;
  range: number;
  accentHex: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
  reply: string;
  thought: string;
  advancesQuestId?: string;
  renownGain?: number;
}

export interface GameNpc {
  id: string;
  name: string;
  title: string;
  guildId: string;
  guildName: string;
  regionId: RegionId;
  portraitUrl: string;
  position: [number, number]; // [x, z]
  cloakHex: number;
  trimHex: number;
  greeting: string;
  cognitiveDrive: string;
  concealedSecret: string;
  speechCadence: string;
  beliefs: string[];
  choices: DialogueChoice[];
  appearance?: VerdantCharacterAppearance;
}

export type QuestObjectiveKind =
  | 'talk-npc'
  | 'ring-bell'
  | 'collect-relics'
  | 'calibrate-beacon'
  | 'defeat-archetype'
  | 'plant-banner';

export interface QuestObjective {
  id: string;
  description: string;
  kind: QuestObjectiveKind;
  targetId: string; // npcId, interactableId, enemy archetype, or 'any'
  targetCoords: [number, number];
  requiredCount: number;
  currentCount: number;
}

export interface GameQuest {
  id: string;
  title: string;
  giverNpcId: string;
  guildId: string;
  regionId: RegionId;
  summary: string;
  motif: string;
  renownReward: number;
  status: 'active' | 'completed';
  objectives: QuestObjective[];
  isEmergent?: boolean;
}

export interface WorldInteractable {
  id: string;
  kind:
    | 'resonance-pier'
    | 'forge-bell'
    | 'waystone-beacon'
    | 'silicate-relic'
    | 'dungeon-portal'
    | 'dungeon-exit'
    | 'vault-chest'
    | 'seal-brazier';
  name: string;
  promptVerb: string;
  regionId: RegionId;
  position: [number, number];
  activated: boolean;
  requiredGear?: GearSlotId;
  targetRealmSlug?: string;
}

export interface FoundationBanner {
  id: string;
  name: string;
  guildId: string;
  builderName: string;
  position: [number, number];
  plantedAt: number;
  realmSlug?: string;
  remote?: boolean;
}

export interface GuildCharter {
  id: string;
  name: string;
  motto: string;
  homeRegion: RegionId;
  accentHex: string;
  prosperity: number;
  activeWaywrights: number;
  expeditionGoal: string;
}

export const WORLD_PANORAMA_URL = resolvePublicUrl('/src/assets/images/ff_world_panorama_1795129454132.jpg');
export const RELIC_ART_URL = resolvePublicUrl('/src/assets/images/ff_relic_lodestone_1795129453816.jpg');
export const PORTRAIT_ORENNA = resolvePublicUrl('/src/assets/images/ff_npc_orenna_1795129454002.jpg');
export const PORTRAIT_KAELEN = resolvePublicUrl('/src/assets/images/ff_npc_kaelen_1795129454573.jpg');
export const PORTRAIT_TARSIK = resolvePublicUrl('/src/assets/images/ff_npc_tarsik_1795130893764.jpg');
export const PORTRAIT_SERAIA = resolvePublicUrl('/src/assets/images/ff_npc_seraia_1795130893399.jpg');

export const WORLD_REGIONS: WorldRegion[] = [
  {
    id: 'high-causeway',
    name: 'High Basalt Citadel',
    subtitle: 'Chartered Stone Foundations',
    center: [0, -18],
    radius: 20,
    ambientMood: 'causeway',
  },
  {
    id: 'ashen-kiln',
    name: 'Ashen Kiln Foundry',
    subtitle: 'Geothermal Bell Basin',
    center: [-26, -6],
    radius: 22,
    ambientMood: 'foundry',
  },
  {
    id: 'ironwood-reaches',
    name: 'Amber Ironwood Reaches',
    subtitle: 'Living Silicate Timberlands',
    center: [26, -6],
    radius: 24,
    ambientMood: 'ironwood',
  },
  {
    id: 'salt-loom',
    name: 'Salt Loom Coast',
    subtitle: 'Tidal Obsidian Sea-Stacks',
    center: [24, 24],
    radius: 22,
    ambientMood: 'coast',
  },
  {
    id: 'southern-terrace',
    name: 'Southern Causeway',
    subtitle: 'Frontier Gateway',
    center: [0, 20],
    radius: 26,
    ambientMood: 'causeway',
  },
];

export function getRegionAt(x: number, z: number): WorldRegion {
  let closest = WORLD_REGIONS[4];
  let bestDist = Infinity;
  for (const r of WORLD_REGIONS) {
    const d = Math.hypot(x - r.center[0], z - r.center[1]);
    if (d < r.radius && d < bestDist) {
      bestDist = d;
      closest = r;
    }
  }
  return closest;
}

export const GEAR_LOADOUT: GearDefinition[] = [
  {
    id: 'hookblade',
    slotKey: '1',
    name: 'Lodestone Hookblade',
    roleClue: 'Swift Steel Cleave',
    description: 'Curved forged-steel surveyor blade inlaid with amber lodestone. Fast sweeping strikes.',
    cooldownSec: 0.36,
    staminaCost: 12,
    damage: 24,
    range: 3.6,
    accentHex: '#D4A253',
  },
  {
    id: 'bellhammer',
    slotKey: '2',
    name: 'Resonance Bell-Hammer',
    roleClue: '174 Hz Heavy Shockwave',
    description: 'Cast-bronze maul that rings at 174 Hz—stuns foes with heavy knockback and activates structural bells.',
    cooldownSec: 0.92,
    staminaCost: 26,
    damage: 44,
    range: 4.9,
    accentHex: '#E09F5A',
  },
  {
    id: 'lantern',
    slotKey: '3',
    name: 'Mortar Lantern',
    roleClue: 'Silicate Mend & Ward',
    description: 'Channels living bioluminescent moss light to restore Vitality and pulse hidden frontier trails.',
    cooldownSec: 2.2,
    staminaCost: 20,
    damage: 0,
    range: 7.0,
    accentHex: '#5EA38C',
  },
  {
    id: 'compass',
    slotKey: '4',
    name: 'Brass Way-Compass',
    roleClue: 'Raise Foundation Banner',
    description: 'Plants a federated Foundation Banner at your feet, claiming frontier ground and rallying guild allies.',
    cooldownSec: 3.0,
    staminaCost: 15,
    damage: 0,
    range: 8.0,
    accentHex: '#C9B27C',
  },
];

export const INITIAL_GUILDS: GuildCharter[] = [
  {
    id: 'guild-causeway',
    name: 'Charter of the Southern Causeway',
    motto: 'What stone bears together, no tide unmakes.',
    homeRegion: 'high-causeway',
    accentHex: '#D4A253',
    prosperity: 64,
    activeWaywrights: 148,
    expeditionGoal: 'Reinforce the Third Viaduct Pier before the winter caravans.',
  },
  {
    id: 'guild-tideloom',
    name: 'Tide-Loom Cartographers',
    motto: 'Ink lies by solstice; copper wire remembers the sea.',
    homeRegion: 'salt-loom',
    accentHex: '#5EA38C',
    prosperity: 52,
    activeWaywrights: 94,
    expeditionGoal: 'Triangulate the outer obsidian sea-stacks at low water.',
  },
  {
    id: 'guild-kiln',
    name: 'Ashen Kiln Conclave',
    motto: 'Strike true bronze, and the mist parts.',
    homeRegion: 'ashen-kiln',
    accentHex: '#D98657',
    prosperity: 58,
    activeWaywrights: 76,
    expeditionGoal: 'Harmonize the canyon fog-bells against tectonic tremors.',
  },
];

export const INITIAL_NPCS: GameNpc[] = [
  {
    id: 'npc-orenna',
    name: 'Magistrate Orenna Vael',
    title: 'Chief Surveyor of the Basalt Charter',
    guildId: 'guild-causeway',
    guildName: 'Charter of the Southern Causeway',
    regionId: 'southern-terrace',
    portraitUrl: PORTRAIT_ORENNA,
    position: [-3.4, 15.2],
    cloakHex: 0x3b4958,
    trimHex: 0xd4a253,
    greeting:
      'Hold a moment, Waywright. Hear that low hum beneath the flagstones? The third pier of the Causeway is losing bearing weight—and the equinox caravan arrives within three tides.',
    cognitiveDrive: 'Stabilize the sinking third pier of the High Causeway before the winter equinox caravan arrives.',
    concealedSecret: 'She discovered the charter ledger understated the aquifer hollow by forty meters to prevent guild panic.',
    speechCadence: 'Measured, architectural, quotes load tolerances rather than proverbs.',
    beliefs: [
      'Uncharted expansion without stone bracing invites collapse.',
      'Federated guilds must audit each other’s structural ledgers.',
      'Kaelen’s tidal charts are dangerously brilliant but ignore weight loads.',
    ],
    choices: [
      {
        id: 'orenna-inspect',
        label: 'I have the Bell-Hammer. Tell me where to sound the third pier.',
        reply:
          'Walk onto the center span of the Parabolic Causeway just north of us. Strike the bronze sounding plate with your Resonance Bell-Hammer [2]—if the echo returns flat, the hollow runs deeper than my ledgers admit.',
        thought: 'Finally someone who trusts measurement over rumor.',
        advancesQuestId: 'quest-sinking-pier',
        renownGain: 15,
      },
      {
        id: 'orenna-secret',
        label: 'Your survey calipers are notched twice. Are the aquifer ledgers incomplete?',
        reply:
          'Sharp eyes. The council wanted confidence, not forty meters of empty limestone beneath the central arch. Verify the sounding for me, and I will lay the true figures before every federated guild.',
        thought: 'They noticed the calibration notch—better to enlist them honestly.',
        advancesQuestId: 'quest-sinking-pier',
        renownGain: 25,
      },
    ],
  },
  {
    id: 'npc-kaelen',
    name: 'Kaelen of the Salt Loom',
    title: 'Exiled Tide-Cartographer',
    guildId: 'guild-tideloom',
    guildName: 'Tide-Loom Cartographers',
    regionId: 'salt-loom',
    portraitUrl: PORTRAIT_KAELEN,
    position: [20.5, 20.5],
    cloakHex: 0x2c5652,
    trimHex: 0xc9824f,
    greeting:
      'Mind your boots on the wet obsidian, Waywright. The sea-stacks shifted half a league east since autumn—and Shale-Husk Stalkers have nested around my triangulation tower.',
    cognitiveDrive: 'Prove that the frontier sea-stacks move on an eleven-year tectonic cycle predictable via copper astrolabes.',
    concealedSecret: 'He deliberately destroyed his old guild’s ink charts so merchant syndicates could not monopolize the barrier shoals.',
    speechCadence: 'Brisk, rhythmic, frames time in tidal intervals and wire tension.',
    beliefs: [
      'Maps drawn in ink lie by the next solstice; only live waystones stay true.',
      'The Citadel over-harvests lodestone from coastal shelves.',
      'Independent waywrights deserve open navigation corridors.',
    ],
    choices: [
      {
        id: 'kaelen-beacon',
        label: 'I will clear the coast and tune your Salt Loom Waystone.',
        reply:
          'Good! Watch how the Stalkers circle before they lunge—sidestep their amber crouch, then bring the Coastal Waystone online. Every navigator across the Meridian will feel the lock.',
        thought: 'One clean triangulation lock will silence the ink-merchants for good.',
        advancesQuestId: 'quest-copper-wires',
        renownGain: 20,
      },
      {
        id: 'kaelen-charts',
        label: 'Why weave copper wire instead of drafting parchment charts?',
        reply:
          'Parchment gets locked in toll-house vaults. Tuned copper resonates across every Way-Compass on the frontier—no syndicate can hoard the tide.',
        thought: 'They understand why open navigation matters.',
        renownGain: 15,
      },
    ],
  },
  {
    id: 'npc-tarsik',
    name: 'Tarsik Iron-Kiln',
    title: 'Master Siege-Bell Founder',
    guildId: 'guild-kiln',
    guildName: 'Ashen Kiln Conclave',
    regionId: 'ashen-kiln',
    portraitUrl: PORTRAIT_TARSIK,
    position: [-21.5, -5.0],
    cloakHex: 0x4c372f,
    trimHex: 0xc6954f,
    greeting:
      'Step close to the hearth—mind the slag. A Basalt Tide-Colossus crawled up from the fissure last dusk and rattled my foundry bell clean out of tune.',
    cognitiveDrive: 'Tune a network of frontier bronze bells capable of guiding caravans through zero-visibility steam fog.',
    concealedSecret: 'One of his early bell alloys accidentally cracked a canyon shale shelf, burying a rival surveyor’s camp.',
    speechCadence: 'Sparse, resonant, listens to ambient acoustics before answering.',
    beliefs: [
      'Sound travels where sight fails across the frontier.',
      'A hammer forged only for war wastes good bronze.',
      'Seraia’s silicate mortar could silence bridge vibrations permanently.',
    ],
    choices: [
      {
        id: 'tarsik-bell',
        label: 'Let me strike the Great Foundry Bell and drive off the Colossus.',
        reply:
          'Give the bell inside the pavilion one heavy ring with your Bell-Hammer [2], then watch the Colossus’s glowing slam ring—dodge outside the amber circle before it drops.',
        thought: 'If this Waywright holds steady under a Colossus strike, the forge will sing again.',
        advancesQuestId: 'quest-ashen-kiln',
        renownGain: 20,
      },
      {
        id: 'tarsik-alloy',
        label: 'Seraia thinks silicate moss could brace the bridge without straining your bronze.',
        reply:
          'Hah—tell her I respect living stone, provided her moss stops chewing through my bronze pins. Still... a hybrid truss might save Orenna’s third pier.',
        thought: 'Maybe the Conclave and the Fen Collective belong at the same drafting table.',
        renownGain: 15,
      },
    ],
  },
  {
    id: 'npc-seraia',
    name: 'Seraia Glass-Weaver',
    title: 'Silicate Botanist of Ironwood Reaches',
    guildId: 'guild-causeway',
    guildName: 'Fen-Glass Collective',
    regionId: 'ironwood-reaches',
    portraitUrl: PORTRAIT_SERAIA,
    position: [22.0, -5.5],
    cloakHex: 0x355040,
    trimHex: 0x82c7a7,
    greeting:
      'Tread softly among the root arches. Three luminous silicate moss clusters bloomed along the Ironwood Ridge—harvest them and raise a Foundation Banner so our mortar kilns can hold this grove.',
    cognitiveDrive: 'Cultivate bioluminescent moss strains that self-seal hairline fractures in stone viaducts overnight.',
    concealedSecret: 'Her strongest strain feeds slowly on bronze fasteners, forcing a trade-off between stone strength and metal lifespan.',
    speechCadence: 'Inquisitive, tactile, frequently tests soil samples mid-conversation.',
    beliefs: [
      'Living foundations outlast dead masonry.',
      'Frontier ecosystems adapt faster than charter law.',
      'Orenna’s steel braces can be replaced with grown silicate trusses.',
    ],
    choices: [
      {
        id: 'seraia-moss',
        label: 'I will gather the three Silicate Moss Relics and plant a Foundation Banner.',
        reply:
          'Look for the turquoise-gold glow beneath the largest Ironwood trunks. Once you gather them, equip your Brass Way-Compass [4] to plant a Foundation Banner here.',
        thought: 'With a guild banner anchored, the lumber syndicates cannot clear-cut the ridge.',
        advancesQuestId: 'quest-living-mortar',
        renownGain: 20,
      },
      {
        id: 'seraia-mortar',
        label: 'Does your silicate mortar corrode bronze masonry ties?',
        reply:
          'Only if left unsealed! Mix Tarsik’s kiln ash into the binder and the moss hardens into translucent basalt within six hours. Bring me the specimens and I will prove it.',
        thought: 'An observant traveler—rare on the outer frontier.',
        renownGain: 15,
      },
    ],
  },
];

export const INITIAL_INTERACTABLES: WorldInteractable[] = [
  {
    id: 'int-bridge-pier',
    kind: 'resonance-pier',
    name: 'Third Pier Sounding Plate',
    promptVerb: 'Sound Pier (Bell-Hammer)',
    regionId: 'high-causeway',
    position: [0, 5.2],
    activated: false,
    requiredGear: 'bellhammer',
  },
  {
    id: 'int-forge-bell',
    kind: 'forge-bell',
    name: 'Great Foundry Resonance Bell',
    promptVerb: 'Ring 174 Hz Forge Bell',
    regionId: 'ashen-kiln',
    position: [-26, -8],
    activated: false,
    requiredGear: 'bellhammer',
  },
  {
    id: 'int-coastal-beacon',
    kind: 'waystone-beacon',
    name: 'Salt Loom Triangulation Waystone',
    promptVerb: 'Calibrate Coastal Waystone',
    regionId: 'salt-loom',
    position: [28, 25],
    activated: false,
  },
  {
    id: 'int-citadel-beacon',
    kind: 'waystone-beacon',
    name: 'High Citadel Charter Waystone',
    promptVerb: 'Attune Citadel Waystone',
    regionId: 'high-causeway',
    position: [0, -10.5],
    activated: false,
  },
  {
    id: 'int-relic-1',
    kind: 'silicate-relic',
    name: 'Amber Root Silicate Cluster',
    promptVerb: 'Harvest Silicate Moss',
    regionId: 'ironwood-reaches',
    position: [26, -12],
    activated: false,
  },
  {
    id: 'int-relic-2',
    kind: 'silicate-relic',
    name: 'Hollow Arch Moss Specimen',
    promptVerb: 'Harvest Silicate Moss',
    regionId: 'ironwood-reaches',
    position: [33, -2],
    activated: false,
  },
  {
    id: 'int-relic-3',
    kind: 'silicate-relic',
    name: 'Canyon Rim Bioluminescent Vein',
    promptVerb: 'Harvest Silicate Moss',
    regionId: 'ironwood-reaches',
    position: [19, -15],
    activated: false,
  },
  {
    id: 'int-vaelmor-dungeon-portal',
    kind: 'dungeon-portal',
    name: 'The Sunken Meridian Vault',
    promptVerb: 'Descend into Sunken Meridian Vault',
    regionId: 'northern-watch',
    position: [-14, -34],
    activated: false,
    targetRealmSlug: 'vault-of-vaelmor',
  },
  {
    id: 'int-vaelmor-north-beacon',
    kind: 'waystone-beacon',
    name: 'Northern Watch Meridian Spire',
    promptVerb: 'Attune Northern Watch Spire',
    regionId: 'northern-watch',
    position: [0, -54],
    activated: false,
  },
  {
    id: 'int-vaelmor-west-chest',
    kind: 'vault-chest',
    name: 'West Ruin Survey Coffer',
    promptVerb: 'Unseal Survey Coffer',
    regionId: 'western-ruins',
    position: [-54, -22],
    activated: false,
  },
  {
    id: 'int-vaelmor-east-chest',
    kind: 'vault-chest',
    name: 'Ironwood Caravan Reliquary',
    promptVerb: 'Unseal Caravan Reliquary',
    regionId: 'eastern-ridge',
    position: [54, 10],
    activated: false,
  },
];

export const INITIAL_QUESTS: GameQuest[] = [
  {
    id: 'quest-sinking-pier',
    title: 'The Sinking Third Pier',
    giverNpcId: 'npc-orenna',
    guildId: 'guild-causeway',
    regionId: 'high-causeway',
    summary:
      'Speak with Magistrate Orenna at the Southern Approach, sound the Third Pier on the Parabolic Causeway with your Bell-Hammer, and attune the High Citadel Waystone.',
    motif: 'Structural Civic Audit',
    renownReward: 120,
    status: 'active',
    objectives: [
      {
        id: 'obj-talk-orenna',
        description: 'Speak with Magistrate Orenna Vael',
        kind: 'talk-npc',
        targetId: 'npc-orenna',
        targetCoords: [-3.4, 15.2],
        requiredCount: 1,
        currentCount: 0,
      },
      {
        id: 'obj-sound-pier',
        description: 'Sound the Third Pier Plate on the Bridge',
        kind: 'ring-bell',
        targetId: 'int-bridge-pier',
        targetCoords: [0, 5.2],
        requiredCount: 1,
        currentCount: 0,
      },
      {
        id: 'obj-citadel-waystone',
        description: 'Attune the High Citadel Charter Waystone',
        kind: 'calibrate-beacon',
        targetId: 'int-citadel-beacon',
        targetCoords: [0, -10.5],
        requiredCount: 1,
        currentCount: 0,
      },
    ],
  },
  {
    id: 'quest-copper-wires',
    title: 'Copper Wires at Low Water',
    giverNpcId: 'npc-kaelen',
    guildId: 'guild-tideloom',
    regionId: 'salt-loom',
    summary:
      'Assist Kaelen at the Salt Loom Coast by clearing encroaching Shale-Husk Stalkers and calibrating the Coastal Triangulation Waystone.',
    motif: 'Ephemeral Tide Cartography',
    renownReward: 150,
    status: 'active',
    objectives: [
      {
        id: 'obj-clear-stalkers',
        description: 'Defeat Shale-Husk Stalkers along the Frontier',
        kind: 'defeat-archetype',
        targetId: 'stalker',
        targetCoords: [24, 22],
        requiredCount: 2,
        currentCount: 0,
      },
      {
        id: 'obj-salt-beacon',
        description: 'Calibrate the Salt Loom Triangulation Waystone',
        kind: 'calibrate-beacon',
        targetId: 'int-coastal-beacon',
        targetCoords: [28, 25],
        requiredCount: 1,
        currentCount: 0,
      },
    ],
  },
  {
    id: 'quest-ashen-kiln',
    title: 'Song of the Ashen Kiln',
    giverNpcId: 'npc-tarsik',
    guildId: 'guild-kiln',
    regionId: 'ashen-kiln',
    summary:
      'Travel west to Tarsik’s Foundry Pavilion, ring the Great Resonance Bell at 174 Hz, and topple the Basalt Tide-Colossus threatening the basin.',
    motif: 'Acoustic Foundry Defense',
    renownReward: 180,
    status: 'active',
    objectives: [
      {
        id: 'obj-ring-foundry',
        description: 'Ring the Great Foundry Resonance Bell',
        kind: 'ring-bell',
        targetId: 'int-forge-bell',
        targetCoords: [-26, -8],
        requiredCount: 1,
        currentCount: 0,
      },
      {
        id: 'obj-slay-colossus',
        description: 'Defeat the Basalt Tide-Colossus in Cinder Fen',
        kind: 'defeat-archetype',
        targetId: 'colossus',
        targetCoords: [-31, -14],
        requiredCount: 1,
        currentCount: 0,
      },
    ],
  },
  {
    id: 'quest-living-mortar',
    title: 'Roots of Living Mortar',
    giverNpcId: 'npc-seraia',
    guildId: 'guild-causeway',
    regionId: 'ironwood-reaches',
    summary:
      'Harvest 3 Bioluminescent Silicate Moss clusters in the Amber Ironwood Reaches and raise a Federated Foundation Banner using your Brass Way-Compass [4].',
    motif: 'Ecological Material Trade-off',
    renownReward: 160,
    status: 'active',
    objectives: [
      {
        id: 'obj-harvest-moss',
        description: 'Harvest Silicate Moss Clusters in Ironwood Reaches',
        kind: 'collect-relics',
        targetId: 'silicate-relic',
        targetCoords: [26, -12],
        requiredCount: 3,
        currentCount: 0,
      },
      {
        id: 'obj-plant-banner',
        description: 'Plant a Foundation Banner with the Brass Way-Compass [4]',
        kind: 'plant-banner',
        targetId: 'any',
        targetCoords: [22, -5.5],
        requiredCount: 1,
        currentCount: 0,
      },
    ],
  },
];

export const BANNED_FANTASY_TROPES = [
  'amnesiac chosen one',
  'dark lord in a volcano',
  'ancient evil awakening',
  'fetch ten pelts',
  'tavern rat cellar',
  'prophecy scroll',
  'generic goblin horde',
  'princess kidnapping',
];

export interface CodexEntry {
  id: string;
  regionId: RegionId;
  title: string;
  eraLabel: string;
  body: string;
  artUrl?: string;
}

export const CODEX_ENTRIES: CodexEntry[] = [
  {
    id: 'codex-meridian',
    regionId: 'southern-terrace',
    title: 'The Compact of the Shattered Meridian',
    eraLabel: 'Foundation Charter I',
    artUrl: WORLD_PANORAMA_URL,
    body:
      'Vaelmor endures along a fracture line where dressed basalt masonry meets a living, shifting frontier. Rather than crown a single monarch, the federated guilds bound themselves to load tolerances, open triangulation wire, and shared acoustic bells.',
  },
  {
    id: 'codex-citadel',
    regionId: 'high-causeway',
    title: 'The Parabolic Causeway & Third Pier',
    eraLabel: 'Basalt Engineering Ledger',
    body:
      'Spanning the gorge between the Southern Approach and the High Basalt Citadel, the twin parabolic arches were cast to carry winter salt caravans. When the limestone aquifer hollows beneath the river, only 174 Hz bronze soundings reveal the true stress before stone gives way.',
  },
  {
    id: 'codex-kiln',
    regionId: 'ashen-kiln',
    title: 'Bronze Harmonics of the Ashen Kiln',
    eraLabel: 'Conclave Foundry Note',
    artUrl: RELIC_ART_URL,
    body:
      'Tarsik Iron-Kiln’s Conclave casts bells tuned to cut through canyon steam fog. Every alloy carries memory: when geothermal tremors stir the Cinder Fen, slumbering Basalt Tide-Colossi climb toward the resonance hearths.',
  },
  {
    id: 'codex-ironwood',
    regionId: 'ironwood-reaches',
    title: 'Living Silicate Mortar of the Ironwood Reaches',
    eraLabel: 'Fen-Glass Botanical Fieldbook',
    body:
      'Beneath the amber canopies east of the gorge grows a bioluminescent moss that drinks limestone dust and hardens into translucent basalt overnight. Blended with kiln ash, it seals viaduct fractures—though left unsealed it slowly feasts on bronze pins.',
  },
  {
    id: 'codex-saltloom',
    regionId: 'salt-loom',
    title: 'Eleven-Year Drift of the Salt Loom Coast',
    eraLabel: 'Tide-Loom Navigation Wire',
    body:
      'No parchment chart survives a decade on the southeastern shoals. The obsidian sea-stacks creep half a league on an eleven-year tectonic rhythm, tracked solely by Kaelen’s tensioned copper waystones.',
  },
];

export const INITIAL_RELICS = [
  {
    id: 'relic-surveyor-plumb',
    name: 'Basalt Surveyor’s Plumb',
    origin: 'Charter of the Southern Causeway',
    description: 'Weighted lodestone pendant that steadies footing across canyon bridges and rocky slopes.',
    bonusKind: 'maxHp' as const,
    bonusValue: 20,
    equipped: true,
  },
  {
    id: 'relic-copper-coil',
    name: 'Tide-Loom Copper Coil',
    origin: 'Salt Loom Coast',
    description: 'Tensioned copper wire loop that quickens breathing and stamina recovery during prolonged duels.',
    bonusKind: 'staminaRegenPct' as const,
    bonusValue: 20,
    equipped: true,
  },
];

