export type StudioTab = 'world' | 'lore' | 'arsenal' | 'audio' | 'stitch';

export type AtmospherePreset = 'golden-meridian' | 'stormfront-coast' | 'ember-dusk' | 'high-dawn';

export interface WorldSector {
  id: string;
  name: string;
  regionType: 'Foundation' | 'Frontier' | 'Transition';
  elevationRange: string;
  biomeSummary: string;
  architecturalSignature: string;
  ecologicalHazard: string;
  stitchCellCoord: [number, number, number];
  landmarkCoords: [number, number, number];
}

export interface NpcProfile {
  id: string;
  name: string;
  epithet: string;
  faction: string;
  sectorId: string;
  portraitUrl?: string;
  cognitiveDrive: string;
  concealedSecret: string;
  speechCadence: string;
  beliefGraph: string[];
  antiTropeTags: string[];
  worldPosition: [number, number, number];
}

export interface ItemSpec {
  id: string;
  name: string;
  category: 'Tool-Weapon' | 'Survey Relic' | 'Acoustic Ward' | 'Charter Instrument';
  rarity: 'Chartered' | 'Artisan' | 'Meridian' | 'Sovereign';
  primaryFunction: string;
  frontierSynergy: string;
  materialFinish: string;
  weightKg: number;
  resonanceHz: number;
  craftedBy: string;
  imageUrl?: string;
}

export interface StoryNode {
  id: string;
  title: string;
  act: 1 | 2 | 3;
  kind: 'origin' | 'junction' | 'milestone' | 'resolution';
  sectorId: string;
  summary: string;
  motif: string;
  charterDelta: number;
  frontierEntropyDelta: number;
}

export interface StoryEdge {
  from: string;
  to: string;
  condition: string;
  cost: number;
}

export interface FederatedGuild {
  id: string;
  name: string;
  charterDomain: string;
  homeSectorId: string;
  activeMembers: number;
  federatedNodes: number;
  currentExpedition: string;
  custodyPolicy: '2-of-3 Stitch Parity' | '3-of-5 Quorum Ledger';
  conservationBalance: number;
}

export interface ImportedAssetRecord {
  id: string;
  name: string;
  format: 'glb' | 'gltf' | 'uorc' | 'procedural';
  sourceType: 'Custom Import' | 'Bespoke World Asset';
  triangleCount: number;
  lodTiers: string;
  position: [number, number, number];
  scale: number;
  materialPreset: string;
}

export interface DirectorShot {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  note: string;
}

export interface AudioRoomPreset {
  id: string;
  name: string;
  biome: string;
  bpm: number;
  rootHz: number;
  scaleIntervals: number[];
  reverbDecaySec: number;
  brightnessHz: number;
  droneLevel: number;
  bellLevel: number;
  drumLevel: number;
  windLevel: number;
}

export interface EngineAdapterConfig {
  targetEngine: 'threejs-webgl2' | 'verdant-wasm-tile' | 'bevy-rust-ecs' | 'godot4-gdextension';
  renderPipeline: 'ACES Filmic PBR' | '16x16 Software Tile PBR' | 'Deferred Cluster PBR';
  physicsSolver: 'Deterministic Fixed 60Hz' | 'Rollback 64-Frame Journal';
  networkTransport: 'Verdant Stitch 2-of-3 + WebRTC' | 'Federated Prism ID Broadcast';
  lodStreaming: 'Progressive UORC LOD0-LOD4' | 'Chunked GLB Streaming';
  customShadersEnabled: boolean;
  antiTropeDirectorMode: 'Strict Novelty Guard' | 'Adaptive Guild Chronicle';
}

export interface BrandTokens {
  gameTitle: string;
  subtitle: string;
  settingName: string;
  primaryAccent: string;
  secondaryAccent: string;
  canvasTone: string;
  surfaceTone: string;
  displayFont: string;
  bodyFont: string;
  visualPillars: string[];
}

export interface GameModelState {
  brand: BrandTokens;
  overarchingNarrative: {
    logline: string;
    foundationalTension: string;
    worldRules: string[];
    bannedTropes: string[];
    usedMotifs: string[];
  };
  sectors: WorldSector[];
  npcs: NpcProfile[];
  items: ItemSpec[];
  storyNodes: StoryNode[];
  storyEdges: StoryEdge[];
  guilds: FederatedGuild[];
  importedAssets: ImportedAssetRecord[];
  audioPresets: AudioRoomPreset[];
  engineAdapter: EngineAdapterConfig;
}

export const WORLD_PANORAMA_IMG = '/src/assets/images/ff_world_panorama_1795129454132.jpg';
export const NPC_ORENNA_IMG = '/src/assets/images/ff_npc_orenna_1795129454002.jpg';
export const NPC_KAELEN_IMG = '/src/assets/images/ff_npc_kaelen_1795129454573.jpg';
export const RELIC_LODESTONE_IMG = '/src/assets/images/ff_relic_lodestone_1795129453816.jpg';

export const DIRECTOR_SHOTS: DirectorShot[] = [
  {
    id: 'citadel-vista',
    label: '01. Basalt Citadel Vista',
    position: [26, 18, 34],
    target: [0, 7, -8],
    fov: 46,
    note: 'Establishing frame over the High Basalt Keep and terraced valley.',
  },
  {
    id: 'parabolic-bridge',
    label: '02. Parabolic Arch Crossing',
    position: [-14, 7.5, 22],
    target: [4, 3.2, 6],
    fov: 44,
    note: 'Low-angle architectural study of the canyon stone causeway.',
  },
  {
    id: 'waywright-follow',
    label: '03. Waywright Close Follow',
    position: [3.5, 4.6, 20.5],
    target: [0, 2.2, 11],
    fov: 50,
    note: 'Over-the-shoulder exploration framing on the southern approach.',
  },
  {
    id: 'ironwood-grove',
    label: '04. Amber Ironwood Ridge',
    position: [24, 9, 10],
    target: [12, 3, -2],
    fov: 48,
    note: 'Surveyor sightline through instanced amber-canopy frontier timber.',
  },
  {
    id: 'foundry-pavilion',
    label: '05. Lodestone Forge Basin',
    position: [-21, 10, -4],
    target: [-10, 3.5, -10],
    fov: 45,
    note: 'Acoustic kiln forge and resonant bell foundry overlooking the gorge.',
  },
  {
    id: 'frontier-aerial',
    label: '06. Meridian Survey Aerial',
    position: [0, 38, 42],
    target: [0, 2, -2],
    fov: 52,
    note: 'Topographic overview of chartered foundations and unmapped borderlands.',
  },
];

export const INITIAL_GAME_MODEL: GameModelState = {
  brand: {
    gameTitle: 'Frontiers and Foundations',
    subtitle: 'A Federated 3D Open-World Fantasy RPG on the Verdant Stitch Network',
    settingName: 'The Shattered Meridian of Vaelmor',
    primaryAccent: '#D4A253',
    secondaryAccent: '#5EA38C',
    canvasTone: '#0D1014',
    surfaceTone: '#141920',
    displayFont: 'Cinzel',
    bodyFont: 'Plus Jakarta Sans',
    visualPillars: [
      'Monolithic Basalt Masonry Anchored Over Living Geology',
      'Practical Brass & Lodestone Survey Craftsmanship Over Neon Magic',
      'Weather-Carved Frontier Horizons With Federated Player Monuments',
    ],
  },
  overarchingNarrative: {
    logline:
      'Across the tectonic borderlands of Vaelmor, Charter-Bearers venture beyond stabilizing stone citadels to chart living frontiers—raising federated settlements whose histories are cryptographically shared across guilds rather than ruled by any single throne.',
    foundationalTension:
      'Every deep masonry foundation draws harmonic resonance from subterranean lodestone veins; expand too rapidly and the unmapped frontier shifts its faultlines, forcing communities to negotiate between permanence and adaptation.',
    worldRules: [
      'No absolute empire or omnipotent villain exists; conflicts arise from competing civic charters, scarce resonant stone, and migrating biomes.',
      'Every player-built outpost persists across Stitch 2-of-3 parity shards—if a frontier falls to storm or neglect, its ruins remain traversable.',
      'Tools double as diplomatic and traversal instruments; combat is decisive, weighty, and grounded in terrain acoustics.',
    ],
    bannedTropes: [
      'amnesiac chosen one',
      'dark lord in a volcano',
      'ancient evil awakening',
      'fetch ten pelts',
      'tavern rat cellar',
      'prophecy scroll',
      'generic goblin horde',
      'princess kidnapping',
    ],
    usedMotifs: [
      'Sinking Aquifer Pillar Audit',
      'Woven Copper Tide-Charting',
      'Harmonic Bridge Resonance',
      'Bioluminescent Silicate Mortar',
    ],
  },
  sectors: [
    {
      id: 'sec-high-causeway',
      name: 'High Basalt Causeway',
      regionType: 'Foundation',
      elevationRange: '140m – 420m',
      biomeSummary: 'Terraced cliffside citadel spanning a mist-filled tidal canyon via twin parabolic stone bridges.',
      architecturalSignature: 'Dry-fitted hexagonal basalt piers reinforced with bronze tension rods.',
      ecologicalHazard: 'Harmonic crosswinds during spring equinox tides.',
      stitchCellCoord: [0, 1, 0],
      landmarkCoords: [0, 14, -14],
    },
    {
      id: 'sec-ironwood-reaches',
      name: 'Amber Ironwood Reaches',
      regionType: 'Transition',
      elevationRange: '60m – 190m',
      biomeSummary: 'Dense mineral-rich timber ridges whose amber bark rings like cast iron when struck.',
      architecturalSignature: 'Suspended survey walkways bolted directly into petrified root arches.',
      ecologicalHazard: 'Magnetic spore drifts that skew uncalibrated iron compasses.',
      stitchCellCoord: [1, 0, 0],
      landmarkCoords: [14, 3, -2],
    },
    {
      id: 'sec-salt-loom',
      name: 'The Salt Loom Archipelago',
      regionType: 'Frontier',
      elevationRange: '-10m – 85m',
      biomeSummary: 'Shifting obsidian sea-stacks and tide-submerged causeways revealed only during neap low water.',
      architecturalSignature: 'Woven copper-wire triangulation beacons anchored to basalt reefs.',
      ecologicalHazard: 'Rapid bore-tide surges every six hours.',
      stitchCellCoord: [2, 0, -1],
      landmarkCoords: [24, 1, 18],
    },
    {
      id: 'sec-cinder-fen',
      name: 'Cinder Fen Basin',
      regionType: 'Frontier',
      elevationRange: '25m – 110m',
      biomeSummary: 'Geothermal peat marshes laced with vitrified glass streams and luminous silicate moss.',
      architecturalSignature: 'Cantilevered kiln-brick piers raised on floating pumice pontoons.',
      ecologicalHazard: 'Sudden steam vents that crystallize exposed leather and steel.',
      stitchCellCoord: [-1, 0, 1],
      landmarkCoords: [-14, 2, -10],
    },
  ],
  npcs: [
    {
      id: 'npc-orenna',
      name: 'Magistrate Orenna Vael',
      epithet: 'Chief Surveyor of the Basalt Charter',
      faction: 'Charter of the Southern Causeway',
      sectorId: 'sec-high-causeway',
      portraitUrl: NPC_ORENNA_IMG,
      cognitiveDrive: 'Stabilize the sinking third pier of the High Causeway before the winter equinox caravan arrives.',
      concealedSecret: 'She discovered the charter ledger understated the aquifer hollow by forty meters to prevent guild panic.',
      speechCadence: 'Measured, architectural, quotes load tolerances rather than proverbs.',
      beliefGraph: [
        'Uncharted expansion without stone bracing invites collapse.',
        'Federated guilds must audit each other’s structural ledgers.',
        'Kaelen’s tidal charts are dangerously brilliant but ignore weight loads.',
      ],
      antiTropeTags: ['Civic pragmatist', 'Technical dilemma', 'No mystical mentor clichés'],
      worldPosition: [-2.5, 0, 8.5],
    },
    {
      id: 'npc-kaelen',
      name: 'Kaelen of the Salt Loom',
      epithet: 'Exiled Tide-Cartographer',
      faction: 'Tide-Loom Cartographers',
      sectorId: 'sec-salt-loom',
      portraitUrl: NPC_KAELEN_IMG,
      cognitiveDrive: 'Prove that the frontier sea-stacks move on an eleven-year tectonic cycle predictable via copper astrolabes.',
      concealedSecret: 'He deliberately destroyed his old guild’s ink charts so merchant syndicates could not monopolize the barrier shoals.',
      speechCadence: 'Brisk, rhythmic, frames time in tidal intervals and wire tension.',
      beliefGraph: [
        'Maps drawn in ink lie by the next solstice; only live Stitch beacons stay true.',
        'The Citadel over-harvests lodestone from coastal shelves.',
        'Independent waywrights deserve open navigation corridors.',
      ],
      antiTropeTags: ['Craft-driven rebel', 'Zero brooding lone-wolf clichés', 'Empirical worldview'],
      worldPosition: [5.2, 0, 10.2],
    },
    {
      id: 'npc-tarsik',
      name: 'Tarsik Iron-Kiln',
      epithet: 'Master Siege-Bell Founder',
      faction: 'Ashen Kiln Conclave',
      sectorId: 'sec-cinder-fen',
      cognitiveDrive: 'Tune a network of frontier bronze bells capable of guiding caravans through zero-visibility steam fog.',
      concealedSecret: 'One of his early bell alloys accidentally cracked a canyon shale shelf, burying a rival surveyor’s camp.',
      speechCadence: 'Sparse, resonant, listens to ambient acoustics before answering.',
      beliefGraph: [
        'Sound travels where sight fails across the frontier.',
        'A hammer forged only for war wastes good bronze.',
        'Seraia’s silicate mortar could silence bridge vibrations permanently.',
      ],
      antiTropeTags: ['Acoustic artisan', 'Haunted by engineering error', 'Non-violent craft legacy'],
      worldPosition: [-9.5, 0, -6.5],
    },
    {
      id: 'npc-seraia',
      name: 'Seraia Glass-Weaver',
      epithet: 'Silicate Botanist of Cinder Fen',
      faction: 'Fen-Glass Collective',
      sectorId: 'sec-ironwood-reaches',
      cognitiveDrive: 'Cultivate bioluminescent moss strains that self-seal hairline fractures in stone viaducts overnight.',
      concealedSecret: 'Her strongest strain feeds slowly on bronze fasteners, forcing a trade-off between stone strength and metal lifespan.',
      speechCadence: 'Inquisitive, tactile, frequently tests soil samples mid-conversation.',
      beliefGraph: [
        'Living foundations outlast dead masonry.',
        'Frontier ecosystems adapt faster than charter law.',
        'Orenna’s steel braces can be replaced with grown silicate trusses.',
      ],
      antiTropeTags: ['Ecological engineer', 'Material trade-off', 'No passive healer stereotype'],
      worldPosition: [11.5, 0, -1.5],
    },
  ],
  items: [
    {
      id: 'item-hookblade',
      name: "Surveyor's Lodestone Hookblade",
      category: 'Tool-Weapon',
      rarity: 'Meridian',
      primaryFunction: 'Curved forged-steel climbing hook and parrying blade with inlaid amber lodestone sensor.',
      frontierSynergy: 'Grapples fractured basalt ledges and hums softly within 12m of hollow subterranean vaults.',
      materialFinish: 'Hammered carbon steel, amber lodestone crystal, waxed ironwood grip',
      weightKg: 1.85,
      resonanceHz: 216,
      craftedBy: 'Southern Causeway Forge',
      imageUrl: RELIC_LODESTONE_IMG,
    },
    {
      id: 'item-bellhammer',
      name: 'Resonance Bell-Hammer',
      category: 'Acoustic Ward',
      rarity: 'Artisan',
      primaryFunction: 'Hollow cast-bronze striking maul tuned to 174Hz structural harmonics.',
      frontierSynergy: 'Shatters brittle vitrified glass barriers on strike and projects a 40m acoustic rally beacon in dense fog.',
      materialFinish: 'Patinated bell-bronze head, ashwood haft, rawhide counter-wrap',
      weightKg: 3.4,
      resonanceHz: 174,
      craftedBy: 'Tarsik Iron-Kiln',
      imageUrl: RELIC_LODESTONE_IMG,
    },
    {
      id: 'item-waycompass',
      name: "Cartographer's Brass Way-Compass",
      category: 'Charter Instrument',
      rarity: 'Sovereign',
      primaryFunction: 'Gimballed copper-wire compass synchronized with Verdant Stitch cell coordinates.',
      frontierSynergy: 'Drops persistent 2-of-3 parity route anchors so federated party members share live trails across tide shifts.',
      materialFinish: 'Machined naval brass, sapphire reticle glass, braided copper ring',
      weightKg: 0.42,
      resonanceHz: 396,
      craftedBy: 'Tide-Loom Cartographers',
      imageUrl: RELIC_LODESTONE_IMG,
    },
    {
      id: 'item-silicate-lantern',
      name: 'Kiln-Glass Mortar Lantern',
      category: 'Survey Relic',
      rarity: 'Chartered',
      primaryFunction: 'Shielded lantern housing living bioluminescent silicate moss spores.',
      frontierSynergy: 'Refracts narrow-band amber light to expose hidden charter benchmarks and cures temporary cliff handholds.',
      materialFinish: 'Smoked kiln-glass ribs, riveted iron cage, ceramic spore reservoir',
      weightKg: 1.15,
      resonanceHz: 285,
      craftedBy: 'Seraia Glass-Weaver',
    },
  ],
  storyNodes: [
    {
      id: 'node-charter-arrival',
      title: 'Charter Oath at the Southern Arch',
      act: 1,
      kind: 'origin',
      sectorId: 'sec-high-causeway',
      summary: 'Waywrights inspect hairline vibrations across the third basalt pier and choose an initial survey coalition.',
      motif: 'Structural Civic Audit',
      charterDelta: 0,
      frontierEntropyDelta: 0,
    },
    {
      id: 'node-aquifer-descent',
      title: 'Sounding the Sunken Aquifer',
      act: 1,
      kind: 'junction',
      sectorId: 'sec-high-causeway',
      summary: 'Use the Lodestone Hookblade to descend beneath the viaduct and verify Orenna’s concealed cavity readings.',
      motif: 'Subterranean Engineering Truth',
      charterDelta: 12,
      frontierEntropyDelta: -12,
    },
    {
      id: 'node-salt-triangulation',
      title: 'Low-Water Wire Triangulation',
      act: 2,
      kind: 'junction',
      sectorId: 'sec-salt-loom',
      summary: 'Race the six-hour neap tide with Kaelen to anchor three copper Stitch beacons on migrating sea-stacks.',
      motif: 'Ephemeral Cartography',
      charterDelta: -8,
      frontierEntropyDelta: 8,
    },
    {
      id: 'node-silicate-graft',
      title: 'The Living Truss Compromise',
      act: 2,
      kind: 'milestone',
      sectorId: 'sec-cinder-fen',
      summary: 'Broker a material pact between Seraia’s self-healing moss and Tarsik’s acoustic bronze pins to brace the bridge.',
      motif: 'Ecological Material Trade-off',
      charterDelta: 10,
      frontierEntropyDelta: -10,
    },
    {
      id: 'node-federated-compact',
      title: 'Ratification of the Twin Horizon Compact',
      act: 3,
      kind: 'resolution',
      sectorId: 'sec-high-causeway',
      summary: 'Seal the new frontier charter across federated guilds via 2-of-3 Stitch custody, opening the Outer Meridian.',
      motif: 'Federated Governance Settlement',
      charterDelta: -14,
      frontierEntropyDelta: 14,
    },
  ],
  storyEdges: [
    { from: 'node-charter-arrival', to: 'node-aquifer-descent', condition: 'Audit Orenna’s load ledger', cost: 2 },
    { from: 'node-charter-arrival', to: 'node-salt-triangulation', condition: 'Follow Kaelen’s tidal wire reading', cost: 3 },
    { from: 'node-aquifer-descent', to: 'node-silicate-graft', condition: 'Bring cavity core sample to Cinder Fen', cost: 2 },
    { from: 'node-salt-triangulation', to: 'node-silicate-graft', condition: 'Relay sea-stack tremor timing', cost: 2 },
    { from: 'node-silicate-graft', to: 'node-federated-compact', condition: 'Ring the 174Hz test chord across both arches', cost: 4 },
  ],
  guilds: [
    {
      id: 'guild-causeway',
      name: 'Charter of the Southern Causeway',
      charterDomain: 'Viaduct Masonry & Caravan Tolls',
      homeSectorId: 'sec-high-causeway',
      activeMembers: 148,
      federatedNodes: 12,
      currentExpedition: 'Pier-Three Load Reinforcement',
      custodyPolicy: '2-of-3 Stitch Parity',
      conservationBalance: 420,
    },
    {
      id: 'guild-tideloom',
      name: 'Tide-Loom Cartographers',
      charterDomain: 'Open Sea-Stack Navigation & Beacon Mesh',
      homeSectorId: 'sec-salt-loom',
      activeMembers: 94,
      federatedNodes: 19,
      currentExpedition: 'Neap-Tide Obsidian Crossing',
      custodyPolicy: '2-of-3 Stitch Parity',
      conservationBalance: 315,
    },
    {
      id: 'guild-kiln',
      name: 'Ashen Kiln Conclave',
      charterDomain: 'Acoustic Foundry & Fog-Bell Telemetry',
      homeSectorId: 'sec-cinder-fen',
      activeMembers: 76,
      federatedNodes: 9,
      currentExpedition: 'Canyon Echo Calibration',
      custodyPolicy: '3-of-5 Quorum Ledger',
      conservationBalance: 265,
    },
  ],
  importedAssets: [
    {
      id: 'asset-citadel-keep',
      name: 'Vaelmor High Basalt Keep',
      format: 'procedural',
      sourceType: 'Bespoke World Asset',
      triangleCount: 18420,
      lodTiers: 'LOD0-LOD3',
      position: [0, 0, -14],
      scale: 1,
      materialPreset: 'Carved Basalt + Gilded Lodestone',
    },
    {
      id: 'asset-parabolic-bridge',
      name: 'Southern Parabolic Causeway',
      format: 'procedural',
      sourceType: 'Bespoke World Asset',
      triangleCount: 11240,
      lodTiers: 'LOD0-LOD3',
      position: [0, 0, 5],
      scale: 1,
      materialPreset: 'Weathered Granite + Bronze Rods',
    },
    {
      id: 'asset-foundry-pavilion',
      name: 'Ashen Kiln Forge Pavilion',
      format: 'procedural',
      sourceType: 'Bespoke World Asset',
      triangleCount: 7680,
      lodTiers: 'LOD0-LOD2',
      position: [-11, 0, -9],
      scale: 1,
      materialPreset: 'Kiln Brick + Cast Bronze Bell',
    },
    {
      id: 'asset-ironwood-grove',
      name: 'Amber Ironwood Canopy Cluster (Instanced)',
      format: 'procedural',
      sourceType: 'Bespoke World Asset',
      triangleCount: 14800,
      lodTiers: 'LOD0-LOD4 Instanced',
      position: [13, 0, -2],
      scale: 1,
      materialPreset: 'Mineral Bark + Amber Foliage',
    },
  ],
  audioPresets: [
    {
      id: 'room-causeway-dawn',
      name: 'Basalt Causeway Dawn',
      biome: 'High Basalt Causeway',
      bpm: 74,
      rootHz: 146.83, // D3
      scaleIntervals: [0, 2, 3, 7, 9, 12, 14], // D Dorian
      reverbDecaySec: 2.8,
      brightnessHz: 2400,
      droneLevel: 0.55,
      bellLevel: 0.65,
      drumLevel: 0.35,
      windLevel: 0.3,
    },
    {
      id: 'room-cinder-fen',
      name: 'Cinder Fen Dusk',
      biome: 'Cinder Fen Basin',
      bpm: 62,
      rootHz: 110.0, // A2
      scaleIntervals: [0, 1, 5, 7, 8, 12], // Phrygian acoustic
      reverbDecaySec: 3.6,
      brightnessHz: 1550,
      droneLevel: 0.72,
      bellLevel: 0.48,
      drumLevel: 0.25,
      windLevel: 0.45,
    },
    {
      id: 'room-lodestone-forge',
      name: 'Ashen Kiln Foundry',
      biome: 'Foundry Vault',
      bpm: 92,
      rootHz: 130.81, // C3
      scaleIntervals: [0, 2, 5, 7, 10, 12],
      reverbDecaySec: 1.9,
      brightnessHz: 3100,
      droneLevel: 0.45,
      bellLevel: 0.82,
      drumLevel: 0.68,
      windLevel: 0.15,
    },
    {
      id: 'room-salt-storm',
      name: 'Salt Loom Bore-Tide',
      biome: 'The Salt Loom Archipelago',
      bpm: 84,
      rootHz: 164.81, // E3
      scaleIntervals: [0, 3, 5, 7, 10, 12, 15],
      reverbDecaySec: 3.1,
      brightnessHz: 2100,
      droneLevel: 0.6,
      bellLevel: 0.52,
      drumLevel: 0.55,
      windLevel: 0.7,
    },
  ],
  engineAdapter: {
    targetEngine: 'threejs-webgl2',
    renderPipeline: 'ACES Filmic PBR',
    physicsSolver: 'Rollback 64-Frame Journal',
    networkTransport: 'Verdant Stitch 2-of-3 + WebRTC',
    lodStreaming: 'Progressive UORC LOD0-LOD4',
    customShadersEnabled: true,
    antiTropeDirectorMode: 'Strict Novelty Guard',
  },
};
