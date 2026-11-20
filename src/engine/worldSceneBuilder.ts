import * as THREE from 'three';
import type { AtmospherePreset, NpcProfile } from './verdantModel';

export interface AtmospherePalette {
  skyHex: number;
  fogHex: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
  lanternEmissive: number;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePreset, AtmospherePalette> = {
  'golden-meridian': {
    skyHex: 0x3b4a5c,
    fogHex: 0x525a64,
    fogDensity: 0.0068,
    sunColor: 0xffd79b,
    sunIntensity: 3.2,
    sunPosition: [34, 30, 24],
    hemiSky: 0xa4c0db,
    hemiGround: 0x4b3f30,
    hemiIntensity: 1.25,
    exposure: 1.18,
    lanternEmissive: 1.8,
  },
  'high-dawn': {
    skyHex: 0x6f8ca6,
    fogHex: 0x8da4b8,
    fogDensity: 0.0068,
    sunColor: 0xfff1d6,
    sunIntensity: 3.1,
    sunPosition: [42, 40, 14],
    hemiSky: 0xbcd4eb,
    hemiGround: 0x4b4338,
    hemiIntensity: 1.25,
    exposure: 1.08,
    lanternEmissive: 0.8,
  },
  'ember-dusk': {
    skyHex: 0x1a1721,
    fogHex: 0x2a2026,
    fogDensity: 0.0098,
    sunColor: 0xf28c52,
    sunIntensity: 2.25,
    sunPosition: [-36, 14, -18],
    hemiSky: 0x6a5c7a,
    hemiGround: 0x2b1d17,
    hemiIntensity: 0.9,
    exposure: 1.05,
    lanternEmissive: 2.4,
  },
  'stormfront-coast': {
    skyHex: 0x1e2830,
    fogHex: 0x2a3740,
    fogDensity: 0.0115,
    sunColor: 0xc2d8e8,
    sunIntensity: 1.9,
    sunPosition: [18, 34, -26],
    hemiSky: 0x7391a6,
    hemiGround: 0x232a2c,
    hemiIntensity: 1.15,
    exposure: 1.04,
    lanternEmissive: 2.1,
  },
};

/**
 * Deterministic multi-octave terrain elevation for the Vaelmor frontier valley.
 * Keeps a flat, clear causeway corridor along x in [-4, 4] and a carved river gorge around z = 5.
 */
export function groundHeightAt(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  const ridge =
    Math.sin(x * 0.085) * Math.cos(z * 0.075) * 2.4 +
    Math.sin(x * 0.19 + 1.1) * Math.sin(z * 0.17 - 0.6) * 0.85;

  // River canyon running east-west near z = 5
  const gorgeDist = Math.abs(z - 5.0 - Math.sin(x * 0.09) * 2.2);
  const gorgeCut = Math.exp(-(gorgeDist * gorgeDist) / 28) * -4.2;

  // Citadel plateau north of the gorge (around x=0, z=-14)
  const citadelDist = Math.hypot(x, z + 14);
  const citadelPlateau = Math.exp(-(citadelDist * citadelDist) / 145) * 3.8;

  // Southern approach terrace around spawn (x=0, z=16)
  const southDist = Math.hypot(x, z - 16);
  const southFlatten = Math.exp(-(southDist * southDist) / 70);

  // Perimeter mountain rim outside 46m radius so outdoor world never drops into an empty void
  const rim = distFromCenter > 42 ? Math.pow((distFromCenter - 42) * 0.14, 1.85) * 3.4 : 0;

  let h = ridge + gorgeCut + citadelPlateau + rim;
  h = THREE.MathUtils.lerp(h, 0.8, southFlatten * 0.82);

  // Smooth the north-south stone causeway approach outside the bridge deck
  if (Math.abs(x) < 3.5 && z > 10.5 && z < 26) {
    h = THREE.MathUtils.lerp(h, 0.9, 0.85);
  }
  return h;
}

/**
 * Procedural CanvasTexture generator for basalt masonry, frontier earth, and water sheen.
 */
function createProceduralTexture(
  kind: 'basalt' | 'terrain' | 'water',
  maxAnisotropy: number,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  if (kind === 'basalt') {
    cCtx.fillStyle = '#3a3f46';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 4;
      const colW = size / cols;
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * colW + offset;
        const by = r * rowH;
        const shade = 52 + ((r * 17 + c * 31) % 22);
        cCtx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 7})`;
        cCtx.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
        bCtx.fillStyle = `rgb(${155 + ((r * 13 + c * 7) % 50)}, ${155 + ((r * 13 + c * 7) % 50)}, ${155 + ((r * 13 + c * 7) % 50)})`;
        bCtx.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
      }
    }
    // Fine mineral speckle
    for (let i = 0; i < 900; i++) {
      const px = (i * 73) % size;
      const py = (i * 137) % size;
      cCtx.fillStyle = i % 3 === 0 ? 'rgba(212,162,83,0.08)' : 'rgba(20,24,28,0.18)';
      cCtx.fillRect(px, py, 2, 2);
    }
  } else if (kind === 'terrain') {
    cCtx.fillStyle = '#4c493c';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#7e7e7e';
    bCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1600; i++) {
      const px = (i * 97) % size;
      const py = (i * 53) % size;
      const w = 4 + (i % 10);
      const h = 3 + ((i * 3) % 8);
      cCtx.fillStyle =
        i % 4 === 0
          ? 'rgba(84, 92, 64, 0.25)'
          : i % 4 === 1
            ? 'rgba(116, 86, 54, 0.22)'
            : 'rgba(54, 52, 46, 0.24)';
      cCtx.fillRect(px, py, w, h);
      const bv = 100 + (i % 70);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(px, py, w, h);
    }
  } else {
    cCtx.fillStyle = '#203b4a';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#7f7f7f';
    bCtx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 6) {
      cCtx.fillStyle = 'rgba(130, 178, 198, 0.12)';
      cCtx.fillRect(0, y, size, 2);
      bCtx.fillStyle = 'rgba(210, 210, 210, 0.25)';
      bCtx.fillRect(0, y, size, 2);
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Multi-part composite articulated figure (cloaked Waywright or bespoke NPC) pivoted at bottom-center.
 */
function buildCloakedFigure(
  cloakHex: number,
  trimHex: number,
  shadowTex: THREE.CanvasTexture,
): THREE.Group {
  const group = new THREE.Group();

  const cloakMat = new THREE.MeshStandardMaterial({
    color: cloakHex,
    roughness: 0.82,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimHex,
    roughness: 0.28,
    metalness: 0.82,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc9a386,
    roughness: 0.65,
    metalness: 0.04,
  });

  // 1. Contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 20),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  // 2. Boots / base stance
  const bootGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.45, 8);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x26211d, roughness: 0.85, metalness: 0.1 });
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(-0.16, 0.225, 0);
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0.16, 0.225, 0);
  group.add(leftBoot, rightBoot);

  // 3. Tapered surveyor cloak body
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.44, 1.12, 12), cloakMat);
  cloak.position.y = 0.92;
  cloak.castShadow = true;
  group.add(cloak);

  // 4. Shoulder mantle + brass clasp
  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 12), cloakMat);
  mantle.position.y = 1.42;
  group.add(mantle);

  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), trimMat);
  clasp.position.set(0, 1.43, 0.34);
  group.add(clasp);

  // 5. Head + hood rim
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat);
  head.position.y = 1.72;
  group.add(head);

  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    cloakMat,
  );
  hood.position.set(0, 1.75, -0.03);
  group.add(hood);

  // 6. Surveyor brass staff with glowing lodestone finial
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.95, 8), trimMat);
  staff.position.set(0.46, 0.98, 0.12);
  staff.rotation.z = -0.08;
  group.add(staff);

  const finial = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({
      color: 0xf4c46a,
      emissive: 0xd49635,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.5,
    }),
  );
  finial.position.set(0.53, 2.02, 0.12);
  group.add(finial);

  return group;
}

export interface BuiltVaelmorWorld {
  worldGroup: THREE.Group;
  customImportGroup: THREE.Group;
  playerGroup: THREE.Group;
  animatedBeacons: THREE.Object3D[];
  lanternMaterials: THREE.MeshStandardMaterial[];
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  waterMesh: THREE.Mesh;
  dispose: () => void;
}

export function buildVaelmorWorld(
  scene: THREE.Scene,
  maxAnisotropy: number,
  npcs: NpcProfile[],
  isSoftwareGl: boolean,
): BuiltVaelmorWorld {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(res: T): T => {
    disposables.push(res);
    return res;
  };

  const worldGroup = new THREE.Group();
  const customImportGroup = new THREE.Group();
  const animatedBeacons: THREE.Object3D[] = [];
  const lanternMaterials: THREE.MeshStandardMaterial[] = [];

  const basaltTex = createProceduralTexture('basalt', maxAnisotropy);
  basaltTex.map.repeat.set(3, 3);
  basaltTex.bumpMap.repeat.set(3, 3);
  track(basaltTex.map);
  track(basaltTex.bumpMap);

  const terrainTex = createProceduralTexture('terrain', maxAnisotropy);
  terrainTex.map.repeat.set(16, 16);
  terrainTex.bumpMap.repeat.set(16, 16);
  track(terrainTex.map);
  track(terrainTex.bumpMap);

  const waterTex = createProceduralTexture('water', maxAnisotropy);
  waterTex.map.repeat.set(12, 3);
  waterTex.bumpMap.repeat.set(12, 3);
  track(waterTex.map);
  track(waterTex.bumpMap);

  const shadowTex = track(createContactShadowTexture());

  // Shared PBR Materials (varied roughness & metalness)
  const basaltMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: basaltTex.map,
      bumpMap: basaltTex.bumpMap,
      bumpScale: 0.18,
      roughness: 0.84,
      metalness: 0.1,
    }),
  );
  const darkSlateMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      roughness: 0.78,
      metalness: 0.16,
    }),
  );
  const bronzeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xb88b4a,
      roughness: 0.28,
      metalness: 0.86,
    }),
  );
  const copperMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x5ea38c,
      roughness: 0.36,
      metalness: 0.68,
    }),
  );
  const lodestoneGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffd27d,
      emissive: 0xd99636,
      emissiveIntensity: 1.6,
      roughness: 0.18,
      metalness: 0.35,
    }),
  );
  lanternMaterials.push(lodestoneGlowMat);

  // 1. Lighting Rig (Warm Directional Key + Cool Hemisphere Fill)
  const sunLight = new THREE.DirectionalLight(0xffd296, 2.8);
  sunLight.position.set(34, 28, 22);
  if (!isSoftwareGl) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 110;
    const d = 38;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
  }
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x8eaac7, 0x3b3126, 1.05);
  scene.add(hemiLight);

  // 2. Sculpted Multi-Octave Frontier Terrain Mesh
  const terrainGeo = track(new THREE.PlaneGeometry(130, 130, 72, 72));
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(vx, vz));
  }
  terrainGeo.computeVertexNormals();
  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: terrainTex.map,
      bumpMap: terrainTex.bumpMap,
      bumpScale: 0.25,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  worldGroup.add(terrainMesh);

  // 3. Canyon River Water Plane (seated inside the gorge around z=5)
  const waterGeo = track(new THREE.PlaneGeometry(130, 26, 1, 1));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: waterTex.map,
      bumpMap: waterTex.bumpMap,
      bumpScale: 0.08,
      roughness: 0.22,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -1.55, 5);
  worldGroup.add(waterMesh);

  // 4. Hero Landmark: High Basalt Citadel Keep (8-part composite architectural group)
  const citadel = new THREE.Group();
  const citadelY = groundHeightAt(0, -14);
  citadel.position.set(0, citadelY - 0.8, -14);

  // Tier 1 plinth
  const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(8.5, 10.2, 4.4, 8)), basaltMat);
  plinth.position.y = 2.2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  citadel.add(plinth);

  // Tier 2 bastion drum
  const bastion = new THREE.Mesh(track(new THREE.CylinderGeometry(6.2, 7.1, 6.2, 8)), basaltMat);
  bastion.position.y = 7.4;
  bastion.castShadow = true;
  citadel.add(bastion);

  // Tier 3 gilded bronze cornice ring
  const cornice = new THREE.Mesh(track(new THREE.TorusGeometry(6.35, 0.26, 10, 24)), bronzeMat);
  cornice.rotation.x = Math.PI / 2;
  cornice.position.y = 10.5;
  citadel.add(cornice);

  // Central Meridian Spire Keep
  const spireBase = new THREE.Mesh(track(new THREE.CylinderGeometry(3.2, 4.1, 7.5, 8)), darkSlateMat);
  spireBase.position.y = 14.0;
  spireBase.castShadow = true;
  citadel.add(spireBase);

  const spireRoof = new THREE.Mesh(track(new THREE.ConeGeometry(3.7, 5.2, 8)), copperMat);
  spireRoof.position.y = 20.2;
  spireRoof.castShadow = true;
  citadel.add(spireRoof);

  // 4 Corner Buttress Turrets
  const turretGeo = track(new THREE.CylinderGeometry(1.25, 1.55, 9.2, 8));
  const turretCapGeo = track(new THREE.ConeGeometry(1.5, 2.4, 8));
  const turretAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const ang of turretAngles) {
    const tx = Math.cos(ang) * 6.8;
    const tz = Math.sin(ang) * 6.8;
    const tMesh = new THREE.Mesh(turretGeo, basaltMat);
    tMesh.position.set(tx, 6.5, tz);
    tMesh.castShadow = true;
    citadel.add(tMesh);

    const cap = new THREE.Mesh(turretCapGeo, darkSlateMat);
    cap.position.set(tx, 12.2, tz);
    citadel.add(cap);
  }

  // Citadel Lodestone Beacon Crown
  const crownCrystal = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.95, 0)), lodestoneGlowMat);
  crownCrystal.position.y = 23.8;
  citadel.add(crownCrystal);
  animatedBeacons.push(crownCrystal);

  const crownRing = new THREE.Mesh(track(new THREE.TorusGeometry(1.65, 0.1, 8, 24)), bronzeMat);
  crownRing.position.y = 23.8;
  citadel.add(crownRing);
  animatedBeacons.push(crownRing);

  worldGroup.add(citadel);

  // 5. Southern Parabolic Basalt Causeway Bridge (spans z = -3 to z = 13 over the gorge)
  const bridgeGroup = new THREE.Group();
  const deckGeo = track(new THREE.BoxGeometry(5.6, 0.7, 16.4));
  const deck = new THREE.Mesh(deckGeo, basaltMat);
  deck.position.set(0, 1.15, 5.0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridgeGroup.add(deck);

  // Parapets + bronze tie rods + 4 bridge lanterns
  const parapetGeo = track(new THREE.BoxGeometry(0.45, 0.85, 16.2));
  const leftParapet = new THREE.Mesh(parapetGeo, darkSlateMat);
  leftParapet.position.set(-2.58, 1.85, 5.0);
  const rightParapet = new THREE.Mesh(parapetGeo, darkSlateMat);
  rightParapet.position.set(2.58, 1.85, 5.0);
  bridgeGroup.add(leftParapet, rightParapet);

  // 3 Grounded Stone Piers plunging deep into the riverbed
  const pierGeo = track(new THREE.BoxGeometry(4.8, 7.4, 1.6));
  for (const pz of [-1.2, 5.0, 11.2]) {
    const pier = new THREE.Mesh(pierGeo, basaltMat);
    pier.position.set(0, -2.5, pz);
    pier.castShadow = true;
    bridgeGroup.add(pier);
  }

  // Twin Parabolic Stone Arches beneath the deck
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -2.6, -0.8),
    new THREE.Vector3(0, 0.3, 2.1),
    new THREE.Vector3(0, -2.6, 5.0),
  ]);
  const archGeo1 = track(new THREE.TubeGeometry(archCurve, 18, 0.42, 8, false));
  const archCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -2.6, 5.0),
    new THREE.Vector3(0, 0.3, 8.1),
    new THREE.Vector3(0, -2.6, 11.0),
  ]);
  const archGeo2 = track(new THREE.TubeGeometry(archCurve2, 18, 0.42, 8, false));
  for (const ax of [-2.1, 2.1]) {
    const a1 = new THREE.Mesh(archGeo1, bronzeMat);
    a1.position.x = ax;
    const a2 = new THREE.Mesh(archGeo2, bronzeMat);
    a2.position.x = ax;
    bridgeGroup.add(a1, a2);
  }

  // Bridge Braziers
  const postGeo = track(new THREE.CylinderGeometry(0.12, 0.16, 1.5, 8));
  const orbGeo = track(new THREE.OctahedronGeometry(0.24, 0));
  for (const bx of [-2.58, 2.58]) {
    for (const bz of [0.2, 9.8]) {
      const post = new THREE.Mesh(postGeo, bronzeMat);
      post.position.set(bx, 2.9, bz);
      const orb = new THREE.Mesh(orbGeo, lodestoneGlowMat);
      orb.position.set(bx, 3.8, bz);
      bridgeGroup.add(post, orb);
    }
  }
  worldGroup.add(bridgeGroup);

  // 6. Ashen Kiln Forge Pavilion (Western Ridge landmark at x=-12, z=-8)
  const forgeGroup = new THREE.Group();
  const forgeY = groundHeightAt(-12, -8);
  forgeGroup.position.set(-12, forgeY - 0.25, -8);

  const forgeBase = new THREE.Mesh(track(new THREE.CylinderGeometry(4.4, 5.0, 1.2, 6)), basaltMat);
  forgeBase.position.y = 0.6;
  forgeGroup.add(forgeBase);

  const pillarGeo = track(new THREE.CylinderGeometry(0.28, 0.34, 4.2, 8));
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(pillarGeo, darkSlateMat);
    p.position.set(Math.cos(ang) * 3.4, 3.0, Math.sin(ang) * 3.4);
    forgeGroup.add(p);
  }
  const forgeRoof = new THREE.Mesh(track(new THREE.ConeGeometry(4.9, 2.4, 6)), copperMat);
  forgeRoof.position.y = 6.2;
  forgeGroup.add(forgeRoof);

  // Suspended Cast-Bronze Resonance Bell inside the pavilion
  const bellBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 1.15, 1.6, 16)), bronzeMat);
  bellBody.position.y = 3.5;
  forgeGroup.add(bellBody);

  const kilnCore = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.3, 0.85, 12)), lodestoneGlowMat);
  kilnCore.position.y = 1.4;
  forgeGroup.add(kilnCore);

  worldGroup.add(forgeGroup);

  // 7. Instanced Amber-Canopy Ironwood Grove (composite trunks + layered crowns with tint variation)
  const treeCoords: Array<[number, number, number]> = [];
  for (let i = 0; i < 58; i++) {
    const angle = i * 2.39996; // Golden angle scatter
    const radius = 13 + (i % 7) * 4.4 + (i * 0.35);
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    // Keep clear of causeway corridor, citadel footprint, and forge pavilion
    if (Math.abs(tx) < 5.5 && tz > -20 && tz < 24) continue;
    if (Math.hypot(tx, tz + 14) < 12.5) continue;
    if (Math.hypot(tx + 12, tz + 8) < 7.5) continue;
    if (Math.abs(tz - 5) < 5.2) continue;
    const ty = groundHeightAt(tx, tz);
    if (ty < -0.6) continue;
    treeCoords.push([tx, ty, tz]);
  }

  const trunkGeo = track(new THREE.CylinderGeometry(0.22, 0.42, 3.6, 7));
  trunkGeo.translate(0, 1.8, 0);
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x453528, roughness: 0.9, metalness: 0.05 }));
  const canopyGeo = track(new THREE.DodecahedronGeometry(1.9, 1));
  canopyGeo.translate(0, 4.3, 0);
  const canopyMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.04 }));

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCoords.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const canopyPalette = [0xc97b32, 0xd89b44, 0x9e5e2b, 0x5c7347, 0xb86f2c];

  treeCoords.forEach(([tx, ty, tz], idx) => {
    const s = 0.85 + ((idx * 37) % 30) / 100;
    dummy.position.set(tx, ty - 0.15, tz);
    dummy.rotation.set(0, (idx * 1.13) % (Math.PI * 2), 0);
    dummy.scale.set(s, s * (0.95 + ((idx * 19) % 25) / 100), s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    canopyInst.setMatrixAt(idx, dummy.matrix);

    color.setHex(canopyPalette[idx % canopyPalette.length]);
    canopyInst.setColorAt(idx, color);
  });
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst);

  // 8. Instanced Basalt Frontier Outcrops (natural rock clusters)
  const rockGeo = track(new THREE.DodecahedronGeometry(1.2, 0));
  const rockMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.1 }));
  const rockCount = 34;
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  for (let i = 0; i < rockCount; i++) {
    const a = i * 1.9 + 0.5;
    const r = 10 + (i % 6) * 6.5;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = groundHeightAt(rx, rz);
    dummy.position.set(rx, ry + 0.25, rz);
    dummy.rotation.set((i % 3) * 0.4, i * 0.9, 0.2);
    dummy.scale.set(1.1 + (i % 4) * 0.35, 0.65 + (i % 3) * 0.3, 1.0 + (i % 2) * 0.4);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    color.setHex(i % 2 === 0 ? 0x454a52 : 0x52555a);
    rockInst.setColorAt(i, color);
  }
  rockInst.computeBoundingSphere();
  worldGroup.add(rockInst);

  // 9. Bespoke NPC Figures grounded along the world
  const npcColors: Array<[number, number]> = [
    [0x404c5c, 0xd4a253], // Magistrate Orenna Vael
    [0x2f5a55, 0xc77e4c], // Kaelen of the Salt Loom
    [0x4e3730, 0xb88b4a], // Tarsik Iron-Kiln
    [0x3a5444, 0x89c7aa], // Seraia Glass-Weaver
  ];
  npcs.forEach((npc, idx) => {
    const [cloakHex, trimHex] = npcColors[idx % npcColors.length];
    const fig = buildCloakedFigure(cloakHex, trimHex, shadowTex);
    const [nx, , nz] = npc.worldPosition;
    const ny = Math.abs(nx) < 2.8 && nz > -3 && nz < 13 ? 1.5 : groundHeightAt(nx, nz);
    fig.position.set(nx, ny, nz);
    fig.rotation.y = Math.atan2(-nx, 16 - nz);
    worldGroup.add(fig);
  });

  // 10. Playable Waywright Explorer Avatar spawned on open southern causeway facing the Citadel
  const playerGroup = buildCloakedFigure(0x2a3644, 0xe0ae58, shadowTex);
  playerGroup.position.set(0, groundHeightAt(0, 16), 16);
  playerGroup.rotation.y = Math.PI; // Facing north (-Z) directly toward Parabolic Bridge & Citadel Keep
  worldGroup.add(playerGroup);

  worldGroup.add(customImportGroup);
  scene.add(worldGroup);

  return {
    worldGroup,
    customImportGroup,
    playerGroup,
    animatedBeacons,
    lanternMaterials,
    sunLight,
    hemiLight,
    waterMesh,
    dispose: () => {
      scene.remove(worldGroup);
      scene.remove(sunLight);
      scene.remove(hemiLight);
      disposables.forEach((d) => d.dispose());
    },
  };
}
