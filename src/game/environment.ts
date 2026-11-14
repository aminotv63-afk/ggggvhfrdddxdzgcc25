import * as THREE from 'three';
import {
  createBrokenGroundTexture,
  createCobblestoneTexture,
  createCrackedGreyTexture,
  createLushGrassTexture,
  createMoonGlowTexture,
  createOrchardLandTexture,
  createSunGlowTexture,
} from './textures';
import { KingdomVillage } from './kingdomVillage';
import { ForestPropSpot, KingdomTrees, TreeKind, TreeSpot } from './trees';
import { getCoastGroundHeight, getCoastlineX, RoyalSea } from './sea';
import type { FogBoundary } from './fogBoundary';

interface CloudData {
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  puffs: { ox: number; oy: number; oz: number; sx: number; sy: number; sz: number }[];
}

interface BirdData {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  baseY: number;
  angle: number;
  angularSpeed: number;
  flapSpeed: number;
  flapPhase: number;
  bobPhase: number;
}

const _cloudDummy = new THREE.Object3D();

// Pre-allocated colors & vectors for zero-GC day/night atmosphere cycle
const _colNight = new THREE.Color(0x0b1528);
const _colDawnRose = new THREE.Color(0xd96e6a);
const _colSunriseGold = new THREE.Color(0xf6b96c);
const _colDaySky = new THREE.Color(0xc2d8e8);
const _colSunsetGold = new THREE.Color(0xf3a35c);
const _colSunsetCrimson = new THREE.Color(0xba5362);
const _colTwilight = new THREE.Color(0x22264a);

const _colSunDay = new THREE.Color(0xffdc14);
const _colSunHorizon = new THREE.Color(0xff7722);
const _colHemiSkyDay = new THREE.Color(0xf0f6ff);
const _colHemiSkyNight = new THREE.Color(0x3a5280);
const _colHemiGroundDay = new THREE.Color(0x626468);
const _colHemiGroundNight = new THREE.Color(0x1b2333);
const _colDirDay = new THREE.Color(0xfff4db);
const _colDirWarm = new THREE.Color(0xffa96b);
const _colDirNight = new THREE.Color(0x88b0ee);
const _colFillDay = new THREE.Color(0xdfeeff);
const _colFillNight = new THREE.Color(0x455f8f);

const _colCloudDay = new THREE.Color(0xffffff);
const _colCloudWarm = new THREE.Color(0xffcfa6);
const _colCloudNight = new THREE.Color(0x283652);
const _colStormSkyDay = new THREE.Color(0x526375);
const _colStormSkyNight = new THREE.Color(0x0b1220);
const _colStormCloud = new THREE.Color(0x4b5563);
const _colLightningFlash = new THREE.Color(0xdbeafe);
const _colCloudEmissiveDay = new THREE.Color(0xe4eef7);
const _colCloudEmissiveNight = new THREE.Color(0x162033);

const _colSpecDay = new THREE.Color(0xfff5d6);
const _colSpecSunset = new THREE.Color(0xffae66);
const _colSpecMoon = new THREE.Color(0xbcd6ff);

const _tmpSky = new THREE.Color();
const _tmpSeaSky = new THREE.Color();
const _tmpSpec = new THREE.Color();
const _tmpSunDir = new THREE.Vector3();

function smoothstepRange(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class GrasslandEnvironment {
  public group: THREE.Group;
  public village: KingdomVillage;
  public sea: RoyalSea;
  public trees: KingdomTrees;
  private disposables: { dispose: () => void }[] = [];
  private cloudsMesh: THREE.InstancedMesh | null = null;
  private cloudPuffMat: THREE.MeshStandardMaterial | null = null;
  private cloudData: CloudData[] = [];
  private skyWrapLimit: number = 110;

  private sunGroup: THREE.Group | null = null;
  private sunCoreMat: THREE.MeshBasicMaterial | null = null;
  private sunHaloMesh: THREE.Mesh | null = null;
  private sunHaloMat: THREE.MeshBasicMaterial | null = null;

  private moonGroup: THREE.Group | null = null;
  private moonCoreMat: THREE.MeshBasicMaterial | null = null;
  private moonHaloMesh: THREE.Mesh | null = null;
  private moonHaloMat: THREE.MeshBasicMaterial | null = null;

  private starsPoints: THREE.Points | null = null;
  private starsMat: THREE.PointsMaterial | null = null;

  private birdGroupContainer: THREE.Group | null = null;
  private birds: BirdData[] = [];
  private elapsedTime: number = 0;

  // 2D Uniform Spatial Hash Grid for ~425 colliders (zero-GC query via Uint32Array visit stamps)
  private readonly gridHalfExtent = 120;
  private readonly gridCellSize = 10;
  private readonly gridDim = 24; // (120 * 2) / 10
  private boxCells: Int32Array[] | null = null;
  private cylCells: Int32Array[] | null = null;
  private treeCells: Int32Array[] | null = null;
  private boxVisited = new Uint32Array(0);
  private cylVisited = new Uint32Array(0);
  private treeVisited = new Uint32Array(0);
  private visitStamp = 1;
  private gridColliderSignature = '';

  constructor(mapRadius: number = 90) {
    this.group = new THREE.Group();
    this.group.name = 'KingdomPlains';
    this.skyWrapLimit = mapRadius * 3.0;

    // 1. Lush Emerald Kingdom Meadow Ground Plane (Flat y = 0 inland, slopes down beneath the Western Sea)
    const lushGrassTex = createLushGrassTexture();
    this.disposables.push(lushGrassTex);

    const groundSize = mapRadius * 5.0;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 100, 100);
    const gPos = groundGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const wx = gPos.getX(i);
      const wz = -gPos.getY(i); // Plane will be rotated -PI/2 around X
      const d = wx - getCoastlineX(wz);
      if (d < 2.2) {
        const t = Math.max(0, Math.min(1, (2.2 - d) / 6.0));
        const s = t * t * (3 - 2 * t);
        gPos.setZ(i, -2.8 * s);
      }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: lushGrassTex,
      roughness: 0.94,
      metalness: 0.02,
    });
    this.disposables.push(groundGeo, groundMat);

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    groundMesh.updateMatrix();
    groundMesh.matrixAutoUpdate = false;
    this.group.add(groundMesh);

    // 2. Zoned Kingdom Lands: Cobblestone Boulevards, Plazas, Orchards, Forest Clearings & Reserved Palace Terrace
    this.createDesignedKingdomLands();
    const lands = this.group.getObjectByName('KingdomLands');
    if (lands) {
      lands.updateMatrixWorld(true);
      lands.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.matrixAutoUpdate = false;
        }
      });
    }

    // 3. Kingdom Houses, Furniture, Market Stalls, Royal Stone Well & Reserved Palace Plot
    this.village = new KingdomVillage();
    this.group.add(this.village.group);

    // 4. Western Royal Sea, Golden Beach, Walkable Harbor Pier & Moored Sailboat
    this.sea = new RoyalSea(this.village.boxColliders);
    this.group.add(this.sea.group);

    // 5. Full-Map Instanced Kingdom & Grand Olive Forest (Olive Trees, Pines, Oaks, Bushes, Rocks & Logs)
    const treeSpots = this.generateKingdomTreeSpots(mapRadius);
    const forestProps = this.generateForestProps(mapRadius, treeSpots);
    this.trees = new KingdomTrees(treeSpots, forestProps);
    this.group.add(this.trees.group);

    // 6. Glowing Sun, Glowing Moon & Twinkling Night Stars
    this.createSun();
    this.createMoon();
    this.createStars();

    // 7. Fluffy Drifting Clouds in the Sky
    this.createSkyClouds(mapRadius);

    // 8. Soaring Animated Birds in the Sky
    this.createFlyingBirds(mapRadius);
  }

  private createDesignedKingdomLands() {
    const landsGroup = new THREE.Group();
    landsGroup.name = 'KingdomLands';

    // Shared Royal Stone Texture (Central Square & Reserved Palace Terrace)
    const plazaStoneTex = createCrackedGreyTexture();
    plazaStoneTex.repeat.set(7, 7);
    this.disposables.push(plazaStoneTex);

    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaStoneTex,
      color: 0xd0cec9,
      roughness: 0.9,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const borderStoneMat = new THREE.MeshStandardMaterial({
      color: 0xa69f93,
      roughness: 0.88,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.disposables.push(plazaMat, borderStoneMat);

    // A. Central Royal Well Square (radius 14.5 around central square)
    const squareGeo = new THREE.CircleGeometry(14.5, 48);
    squareGeo.rotateX(-Math.PI / 2);
    const squareMesh = new THREE.Mesh(squareGeo, plazaMat);
    squareMesh.position.set(0, 0.014, -5.5);
    squareMesh.receiveShadow = true;
    landsGroup.add(squareMesh);

    const ringGeo = new THREE.RingGeometry(14.25, 14.85, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, borderStoneMat);
    ringMesh.position.set(0, 0.017, -5.5);
    ringMesh.receiveShadow = true;
    landsGroup.add(ringMesh);
    this.disposables.push(squareGeo, ringGeo);

    // B. Expanded Reserved Palace Courtyard Terrace (x in [-28.5, +28.5], z in [-69, -22])
    const palacePlotGeo = new THREE.PlaneGeometry(57.0, 47.0);
    palacePlotGeo.rotateX(-Math.PI / 2);
    const palacePlotMesh = new THREE.Mesh(palacePlotGeo, plazaMat);
    palacePlotMesh.position.set(0, 0.014, -45.5);
    palacePlotMesh.receiveShadow = true;
    landsGroup.add(palacePlotMesh);
    this.disposables.push(palacePlotGeo);

    // Crisp flat stone border strips framing the Reserved Palace Grounds
    const hTrimGeo = new THREE.PlaneGeometry(57.8, 0.7);
    hTrimGeo.rotateX(-Math.PI / 2);
    const backTrim = new THREE.Mesh(hTrimGeo, borderStoneMat);
    backTrim.position.set(0, 0.018, -69);
    backTrim.receiveShadow = true;
    landsGroup.add(backTrim);

    const vTrimGeo = new THREE.PlaneGeometry(0.7, 47.4);
    vTrimGeo.rotateX(-Math.PI / 2);
    [-28.5, 28.5].forEach((tx) => {
      const sideTrim = new THREE.Mesh(vTrimGeo, borderStoneMat);
      sideTrim.position.set(tx, 0.018, -45.5);
      sideTrim.receiveShadow = true;
      landsGroup.add(sideTrim);
    });

    const frontFlankGeo = new THREE.PlaneGeometry(21.1, 0.7);
    frontFlankGeo.rotateX(-Math.PI / 2);
    [-17.95, 17.95].forEach((fx) => {
      const fTrim = new THREE.Mesh(frontFlankGeo, borderStoneMat);
      fTrim.position.set(fx, 0.018, -22);
      fTrim.receiveShadow = true;
      landsGroup.add(fTrim);
    });
    this.disposables.push(hTrimGeo, vTrimGeo, frontFlankGeo);

    // C. Cobblestone Boulevards linking all village quarters
    const baseCobbleTex = createCobblestoneTexture();
    this.disposables.push(baseCobbleTex);

    const addRoad = (cx: number, cz: number, w: number, len: number, rotY: number = 0) => {
      const tex = baseCobbleTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, w / 3.8), Math.max(1, len / 3.8));
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xcfc7ba,
        roughness: 0.9,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const geo = new THREE.PlaneGeometry(w, len);
      geo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(geo, mat);
      road.position.set(cx, 0.012, cz);
      road.rotation.y = rotY;
      road.receiveShadow = true;
      landsGroup.add(road);
      this.disposables.push(tex, mat, geo);
    };

    // Grand North-South Avenue (from Reserved Palace entrance down to the Southern Farm Gate)
    addRoad(0, 11.75, 7.6, 67.5);
    // Cross East-West Avenue extended eastward straight through the Grand Forest to the Roman Border Gate
    addRoad(20.5, 3.5, 6.2, 134.0, Math.PI / 2);
    // Western Harbor Promenade connecting Boulevard cleanly to the Seaside Wooden Pier
    addRoad(-51.8, 3.5, 5.2, 11.4, Math.PI / 2);
    // Outer West & East Carriage Boulevards
    addRoad(-30.5, 2.0, 5.8, 80.0);
    addRoad(30.5, 2.0, 5.8, 80.0);
    // Southern Market Boulevard
    addRoad(0, 24.5, 5.4, 62.0, Math.PI / 2);

    // D. Designed Countryside Orchard & Olive Forest Floor Patches
    const orchardTex = createOrchardLandTexture();
    this.disposables.push(orchardTex);
    const orchardMat = new THREE.MeshStandardMaterial({
      map: orchardTex,
      roughness: 0.95,
      metalness: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.disposables.push(orchardMat);

    const orchardPlots = [
      { x: -45.5, z: -28.0, w: 9.5, d: 8.2, ry: 0.14 },
      { x: 45.5, z: -28.0, w: 9.5, d: 8.2, ry: -0.14 },
      { x: -43.5, z: 36.0, w: 9.0, d: 8.0, ry: 0.2 },
      { x: 43.5, z: 36.0, w: 9.0, d: 8.0, ry: -0.2 },
      // Grand Eastern & South-Eastern Olive Forest Clearings
      { x: 67.0, z: -18.0, w: 22.0, d: 24.0, ry: 0.12 },
      { x: 67.0, z: 26.0, w: 22.0, d: 24.0, ry: -0.1 },
      { x: 42.0, z: -60.0, w: 24.0, d: 18.0, ry: 0.22 },
      { x: 32.0, z: 64.0, w: 24.0, d: 18.0, ry: -0.18 },
      { x: -45.5, z: -48.0, w: 18.0, d: 16.0, ry: -0.2 },
      { x: -45.5, z: 48.0, w: 18.0, d: 16.0, ry: 0.18 },
    ];

    orchardPlots.forEach((p) => {
      const geo = new THREE.PlaneGeometry(p.w, p.d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, orchardMat);
      mesh.position.set(p.x, 0.01, p.z);
      mesh.rotation.y = p.ry;
      mesh.receiveShadow = true;
      landsGroup.add(mesh);
      this.disposables.push(geo);
    });

    // E. Shattered / Broken Ground Patches under Ruined House, Broken Carts & Shovel Sites
    const brokenTex = createBrokenGroundTexture();
    this.disposables.push(brokenTex);
    const brokenMat = new THREE.MeshStandardMaterial({
      map: brokenTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.96,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x7a746c,
      roughness: 0.92,
      metalness: 0.04,
    });
    this.disposables.push(brokenMat, slabMat);

    const brokenSpots = [
      { x: 46.5, z: 21.0, size: 12.5, ry: 0.4 },  // Ruined House + nearby Broken Cart & Shovel
      { x: 24.8, z: -4.0, size: 8.5, ry: -0.3 },  // East Central Broken Cart & Dig Mound
      { x: -33.5, z: 36.2, size: 7.5, ry: 0.8 },  // SW Broken Cart Wreck
      { x: 24.5, z: 29.0, size: 6.2, ry: 0.15 }, // Shattered Cobble Patch near SE Quarter
    ];

    const slabGeo = new THREE.BoxGeometry(0.65, 0.09, 0.48);
    this.disposables.push(slabGeo);

    brokenSpots.forEach((b, bIdx) => {
      const patchGeo = new THREE.PlaneGeometry(b.size, b.size);
      patchGeo.rotateX(-Math.PI / 2);
      const patch = new THREE.Mesh(patchGeo, brokenMat);
      patch.position.set(b.x, 0.016, b.z);
      patch.rotation.y = b.ry;
      patch.receiveShadow = true;
      landsGroup.add(patch);
      this.disposables.push(patchGeo);

      // Low fractured stone slab chips around the crater/cracks
      for (let s = 0; s < 5; s++) {
        const ang = (s / 5) * Math.PI * 2 + bIdx * 0.7;
        const rad = b.size * 0.24 + (s % 2) * 0.65;
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(b.x + Math.cos(ang) * rad, 0.045, b.z + Math.sin(ang) * rad);
        slab.rotation.set((s % 2 === 0 ? 1 : -1) * 0.14, ang * 1.4, (s % 3 - 1) * 0.12);
        slab.scale.set(0.8 + (s % 3) * 0.25, 0.85, 0.85 + (s % 2) * 0.3);
        slab.receiveShadow = true;
        slab.castShadow = true;
        landsGroup.add(slab);
      }
    });

    this.group.add(landsGroup);
  }

  private isClearOfVillageAndRoads(
    x: number,
    z: number,
    maxR: number,
    extraMargin: number = 0
  ): boolean {
    // 1. Inside playable perimeter fence with safe margin & inland from the Western Sea & Beach
    if (Math.hypot(x, z) > maxR) return false;
    if (x < getCoastlineX(z) + 4.2 + extraMargin) return false;

    // 2. Keep Roman Border Gate courtyard & guard approach clear (around x ~ 87.5, z ~ 3.5)
    if (Math.hypot(x - 85.2, z - 3.5) < 8.2 + extraMargin) return false;

    // 3. Keep Expanded Reserved Palace Plot, Military Camp behind Palace & Royal Speech Podium clear
    if (x > -29.0 - extraMargin && x < 29.0 + extraMargin && z > -70.0 - extraMargin && z < -20.5 + extraMargin) {
      return false;
    }
    if (x > -22.0 - extraMargin && x < 22.0 + extraMargin && z > -85.0 - extraMargin && z < -68.5 + extraMargin) {
      return false;
    }
    if (x > -24.5 - extraMargin && x < -14.5 + extraMargin && z > -29.0 - extraMargin && z < -19.5 + extraMargin) {
      return false;
    }

    // 4. Keep Central Royal Well Square clear
    if (Math.hypot(x, z + 5.5) < 15.6 + extraMargin) return false;

    // 5. Keep Southern Livestock Farm Pasture clear (x in [-9.6..+9.6], z in [44.0..57.5])
    if (x > -9.6 - extraMargin && x < 9.6 + extraMargin && z > 44.0 - extraMargin && z < 57.5 + extraMargin) {
      return false;
    }

    // 6. Keep Cobblestone Boulevards (including extended East Border Gate road & West Harbor approach) open
    if (Math.abs(x) < 5.3 + extraMargin && z > -23 && z < 53) return false;
    if (Math.abs(z - 3.5) < 4.7 + extraMargin && x > -62 && x < 89) return false;
    if (Math.abs(Math.abs(x) - 30.5) < 4.4 + extraMargin && z > -40 && z < 44) return false;
    if (Math.abs(z - 24.5) < 4.2 + extraMargin && Math.abs(x) < 33) return false;

    // 7. Avoid all houses, stalls, tables, fences & buildings
    for (const fp of this.village.buildingFootprints) {
      if (Math.hypot(x - fp.x, z - fp.z) < fp.r + 2.2 + extraMargin) return false;
    }

    // 8. Avoid street lanterns, benches, barrels, banners, signposts
    for (const box of this.village.boxColliders) {
      const dx = x - box.cx;
      const dz = z - box.cz;
      const lx = Math.abs(dx * box.cosY + dz * box.sinY);
      const lz = Math.abs(-dx * box.sinY + dz * box.cosY);
      if (lx < box.halfW + 2.0 + extraMargin && lz < box.halfD + 2.0 + extraMargin) return false;
    }
    for (const cyl of this.village.cylinderColliders) {
      if (Math.hypot(x - cyl.x, z - cyl.z) < cyl.radius + 2.1 + extraMargin) return false;
    }

    return true;
  }

  private generateKingdomTreeSpots(mapRadius: number): TreeSpot[] {
    const spots: TreeSpot[] = [];
    const maxTreeR = mapRadius - 5.2; // 84.8m — cleanly inside perimeter fence (87.6m)

    // Deterministic LCG PRNG so layout is always lush, balanced & reproducible
    let seed = 429173;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const isSpotClear = (x: number, z: number, minTreeSpacing: number = 4.2): boolean => {
      if (!this.isClearOfVillageAndRoads(x, z, maxTreeR)) return false;

      // Avoid crowding another tree
      for (const t of spots) {
        if (Math.hypot(x - t.x, z - t.z) < minTreeSpacing) return false;
      }

      return true;
    };

    const tryAdd = (x: number, z: number, kind: TreeKind, scale: number, spacing: number = 4.2) => {
      if (isSpotClear(x, z, spacing)) {
        spots.push({ x, z, kind, scale });
      }
    };

    // 1. Orchard Olive & Fruit Garden Trees
    const orchardCenters = [
      { x: -47.0, z: -27.5 },
      { x: 47.0, z: -27.5 },
      { x: -44.5, z: 36.0 },
      { x: 44.5, z: 36.0 },
      { x: -4.2, z: 47.0 },
      { x: 4.2, z: 47.0 },
    ];
    orchardCenters.forEach((oc, idx) => {
      tryAdd(oc.x - 2.6, oc.z - 1.8, idx % 2 === 0 ? 'olive' : 'blossom', 0.94 + rand() * 0.2, 3.6);
      tryAdd(oc.x + 2.6, oc.z + 1.6, 'olive', 0.96 + rand() * 0.2, 3.6);
    });

    // 2. Boulevard & Pocket-Park Ornamental Green Trees
    const boulevardPockets: [number, number, TreeKind][] = [
      [-10.5, -16.8, 'blossom'],
      [10.5, -16.8, 'blossom'],
      [-16.5, -18.5, 'oak'],
      [16.5, -18.5, 'oak'],
      [-21.5, -2.5, 'oak'],
      [21.5, -2.5, 'oak'],
      [-21.5, 10.5, 'blossom'],
      [21.5, 10.5, 'blossom'],
      [-21.5, 25.0, 'oak'],
      [21.5, 25.0, 'oak'],
      [-29.5, -43.5, 'pine'],
      [29.5, -43.5, 'pine'],
      [-42.0, -60.5, 'oak'],
      [42.0, -60.5, 'oak'],
      [-35.0, -17.5, 'oak'],
      [35.0, -17.5, 'oak'],
      [-35.5, 20.5, 'blossom'],
      [35.5, 20.5, 'blossom'],
      [-10.2, 39.5, 'blossom'],
      [10.2, 39.5, 'blossom'],
    ];
    boulevardPockets.forEach(([px, pz, kind]) => {
      tryAdd(px, pz, kind, 0.9 + rand() * 0.25, 3.8);
    });

    // 3. Dedicated Grand Eastern Olive Grove & Forest Flanking the Border Road (x in [54..83], z in [-55..55])
    for (let attempt = 0; attempt < 240; attempt++) {
      const gx = 54.0 + rand() * 29.5;
      const gz = -56.0 + rand() * 112.0;
      const roll = rand();
      // Rich olive-heavy forest with mixed oaks & tall pines
      const kind: TreeKind =
        roll < 0.56 ? 'olive' : roll < 0.78 ? 'oak' : roll < 0.92 ? 'pine' : 'blossom';
      tryAdd(gx, gz, kind, 0.95 + rand() * 0.42, 4.35);
    }

    // 4. Grand Outer Woodland Forest Ring (r = 56 .. 84.5 around the entire kingdom!)
    const ringCount = 115;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 + (rand() - 0.5) * 0.08;
      const dist = 56.0 + rand() * 28.0;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const roll = rand();
      const kind: TreeKind =
        roll < 0.38 ? 'olive' : roll < 0.68 ? 'pine' : roll < 0.9 ? 'oak' : 'blossom';
      tryAdd(x, z, kind, 0.95 + rand() * 0.48, 4.4);
    }

    // 5. Additional Dense Forest & Village Garden Fill
    for (let attempt = 0; attempt < 460 && spots.length < 285; attempt++) {
      const angle = rand() * Math.PI * 2;
      // Bias heavily toward the outer Grand Forest (52..84.5m) while still keeping nice inner groves
      const inOuterForest = rand() < 0.76;
      const dist = inOuterForest
        ? 53.0 + rand() * (maxTreeR - 53.0)
        : 16.5 + Math.sqrt(rand()) * 36.0;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const roll = rand();
      const kind: TreeKind = inOuterForest
        ? roll < 0.44
          ? 'olive'
          : roll < 0.72
          ? 'oak'
          : 'pine'
        : roll < 0.34
        ? 'pine'
        : roll < 0.72
        ? 'oak'
        : 'blossom';
      tryAdd(x, z, kind, 0.88 + rand() * 0.44, 4.3);
    }

    return spots;
  }

  private generateForestProps(mapRadius: number, treeSpots: TreeSpot[]): ForestPropSpot[] {
    const props: ForestPropSpot[] = [];
    const maxPropR = mapRadius - 5.4;

    let seed = 813491;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const isPropClear = (x: number, z: number, spacingToTrees: number, spacingToProps: number) => {
      if (!this.isClearOfVillageAndRoads(x, z, maxPropR, 0.4)) return false;

      for (let i = 0; i < treeSpots.length; i++) {
        if (Math.hypot(x - treeSpots[i].x, z - treeSpots[i].z) < spacingToTrees) return false;
      }
      for (let i = 0; i < props.length; i++) {
        if (Math.hypot(x - props[i].x, z - props[i].z) < spacingToProps) return false;
      }
      return true;
    };

    // 1. Wild Green Forest Bushes scattered throughout the Outer Forest & Olive Groves
    for (let attempt = 0; attempt < 340 && props.length < 155; attempt++) {
      const ang = rand() * Math.PI * 2;
      const dist = 54.0 + rand() * (maxPropR - 54.0);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isPropClear(x, z, 1.5, 2.2)) {
        props.push({
          x,
          z,
          scale: 0.85 + rand() * 0.55,
          rotY: rand() * Math.PI * 2,
          kind: 'bush',
        });
      }
    }

    // 2. Mossy Forest Boulders
    let boulderCount = 0;
    for (let attempt = 0; attempt < 150 && boulderCount < 32; attempt++) {
      const ang = rand() * Math.PI * 2;
      const dist = 56.5 + rand() * (maxPropR - 57.0);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isPropClear(x, z, 2.6, 3.8)) {
        props.push({
          x,
          z,
          scale: 0.85 + rand() * 0.65,
          rotY: rand() * Math.PI * 2,
          kind: 'boulder',
        });
        boulderCount++;
      }
    }

    // 3. Fallen Woodland Logs
    let logCount = 0;
    for (let attempt = 0; attempt < 100 && logCount < 14; attempt++) {
      const ang = rand() * Math.PI * 2;
      const dist = 58.0 + rand() * (maxPropR - 59.0);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isPropClear(x, z, 3.0, 4.5)) {
        props.push({
          x,
          z,
          scale: 0.9 + rand() * 0.35,
          rotY: rand() * Math.PI * 2,
          kind: 'log',
        });
        logCount++;
      }
    }

    return props;
  }

  private ensureCollisionGrid() {
    const boxes = this.village.boxColliders;
    const cylinders = this.village.cylinderColliders;
    const trees = this.trees.colliders;
    const sig = `${boxes.length}:${cylinders.length}:${trees.length}`;
    if (this.boxCells && this.gridColliderSignature === sig) return;
    this.rebuildCollisionGrid();
  }

  public rebuildCollisionGrid() {
    const boxes = this.village.boxColliders;
    const cylinders = this.village.cylinderColliders;
    const trees = this.trees.colliders;
    const totalCells = this.gridDim * this.gridDim;

    const tmpBoxes: number[][] = Array.from({ length: totalCells }, () => []);
    const tmpCyls: number[][] = Array.from({ length: totalCells }, () => []);
    const tmpTrees: number[][] = Array.from({ length: totalCells }, () => []);

    const clampCell = (v: number) => Math.max(0, Math.min(this.gridDim - 1, v));
    const toCell = (coord: number) => Math.floor((coord + this.gridHalfExtent) / this.gridCellSize);

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      // World-space AABB extent of oriented box (+ extra padding for dynamic door collider resize)
      const extX = Math.abs(box.cosY) * Math.max(box.halfW, 1.2) + Math.abs(box.sinY) * Math.max(box.halfD, 1.2);
      const extZ = Math.abs(box.sinY) * Math.max(box.halfW, 1.2) + Math.abs(box.cosY) * Math.max(box.halfD, 1.2);
      const minX = clampCell(toCell(box.cx - extX));
      const maxX = clampCell(toCell(box.cx + extX));
      const minZ = clampCell(toCell(box.cz - extZ));
      const maxZ = clampCell(toCell(box.cz + extZ));
      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * this.gridDim;
        for (let gx = minX; gx <= maxX; gx++) {
          tmpBoxes[row + gx].push(i);
        }
      }
    }

    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      const minX = clampCell(toCell(c.x - c.radius));
      const maxX = clampCell(toCell(c.x + c.radius));
      const minZ = clampCell(toCell(c.z - c.radius));
      const maxZ = clampCell(toCell(c.z + c.radius));
      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * this.gridDim;
        for (let gx = minX; gx <= maxX; gx++) {
          tmpCyls[row + gx].push(i);
        }
      }
    }

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const minX = clampCell(toCell(t.x - t.radius));
      const maxX = clampCell(toCell(t.x + t.radius));
      const minZ = clampCell(toCell(t.z - t.radius));
      const maxZ = clampCell(toCell(t.z + t.radius));
      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * this.gridDim;
        for (let gx = minX; gx <= maxX; gx++) {
          tmpTrees[row + gx].push(i);
        }
      }
    }

    this.boxCells = tmpBoxes.map((arr) => new Int32Array(arr));
    this.cylCells = tmpCyls.map((arr) => new Int32Array(arr));
    this.treeCells = tmpTrees.map((arr) => new Int32Array(arr));

    if (this.boxVisited.length < boxes.length) this.boxVisited = new Uint32Array(boxes.length);
    if (this.cylVisited.length < cylinders.length) this.cylVisited = new Uint32Array(cylinders.length);
    if (this.treeVisited.length < trees.length) this.treeVisited = new Uint32Array(trees.length);
    this.gridColliderSignature = `${boxes.length}:${cylinders.length}:${trees.length}`;
  }

  private nextVisitStamp(): number {
    this.visitStamp++;
    if (this.visitStamp >= 0xfffffffe) {
      this.boxVisited.fill(0);
      this.cylVisited.fill(0);
      this.treeVisited.fill(0);
      this.visitStamp = 1;
    }
    return this.visitStamp;
  }

  /**
   * Solid collision resolution for houses, stone well, tree trunks, and kingdom furniture/props.
   * Uses a 2D spatial hash grid for O(1) cell-local collision checks with zero allocations.
   */
  public resolveCollisions(pos: THREE.Vector3, playerRadius: number = 0.45): number {
    let supportY = getCoastGroundHeight(pos.x, pos.z);

    this.ensureCollisionGrid();
    const boxCells = this.boxCells!;
    const cylCells = this.cylCells!;
    const treeCells = this.treeCells!;
    const boxes = this.village.boxColliders;
    const cylinders = this.village.cylinderColliders;
    const treeCyls = this.trees.colliders;

    const pad = playerRadius + 0.55;
    const playerRadiusSq = playerRadius * playerRadius;

    // Run 2 resolution iterations so corner intersections (e.g. fence + fence or barn + fence)
    // never push an entity back into an adjacent barrier.
    for (let iter = 0; iter < 2; iter++) {
      // Keep characters & animals cleanly on dry sand / pier and never wading into deep water
      this.sea.resolveSeaBoundary(pos, playerRadius);

      const stamp = this.nextVisitStamp();
      const minX = Math.max(0, Math.min(this.gridDim - 1, Math.floor((pos.x - pad + this.gridHalfExtent) / this.gridCellSize)));
      const maxX = Math.max(0, Math.min(this.gridDim - 1, Math.floor((pos.x + pad + this.gridHalfExtent) / this.gridCellSize)));
      const minZ = Math.max(0, Math.min(this.gridDim - 1, Math.floor((pos.z - pad + this.gridHalfExtent) / this.gridCellSize)));
      const maxZ = Math.max(0, Math.min(this.gridDim - 1, Math.floor((pos.z + pad + this.gridHalfExtent) / this.gridCellSize)));

      let adjusted = false;

      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * this.gridDim;
        for (let gx = minX; gx <= maxX; gx++) {
          const cellIdx = row + gx;

          // 1. Oriented Bounding Boxes
          const bIds = boxCells[cellIdx];
          for (let k = 0; k < bIds.length; k++) {
            const i = bIds[k];
            if (this.boxVisited[i] === stamp) continue;
            this.boxVisited[i] = stamp;

            const box = boxes[i];

            // Skip overhead second-story slabs/walls when character is underneath, and ground-floor furniture when upstairs
            if (box.bottomY !== undefined && pos.y + 1.85 <= box.bottomY) continue;
            if (!box.allowStand && pos.y >= box.topY - 0.05 && pos.y > 1.2) continue;

            const dx = pos.x - box.cx;
            const dz = pos.z - box.cz;

            const lx = dx * box.cosY + dz * box.sinY;
            const lz = -dx * box.sinY + dz * box.cosY;

            const clampedX = Math.max(-box.halfW, Math.min(box.halfW, lx));
            const clampedZ = Math.max(-box.halfD, Math.min(box.halfD, lz));

            const ox = lx - clampedX;
            const oz = lz - clampedZ;
            const distSq = ox * ox + oz * oz;

            if (distSq < playerRadiusSq) {
              if (box.allowStand && pos.y >= box.topY - 0.34) {
                if (
                  Math.abs(lx) <= box.halfW + playerRadius * 0.35 &&
                  Math.abs(lz) <= box.halfD + playerRadius * 0.35
                ) {
                  supportY = Math.max(supportY, box.topY);
                }
              } else {
                let newLx = lx;
                let newLz = lz;

                if (distSq > 0.00001) {
                  const dist = Math.sqrt(distSq);
                  const scale = playerRadius / dist;
                  newLx = clampedX + ox * scale;
                  newLz = clampedZ + oz * scale;
                } else {
                  const penX = box.halfW - Math.abs(lx);
                  const penZ = box.halfD - Math.abs(lz);
                  if (penX < penZ) {
                    newLx = (lx >= 0 ? 1 : -1) * (box.halfW + playerRadius);
                  } else {
                    newLz = (lz >= 0 ? 1 : -1) * (box.halfD + playerRadius);
                  }
                }

                pos.x = box.cx + (newLx * box.cosY - newLz * box.sinY);
                pos.z = box.cz + (newLx * box.sinY + newLz * box.cosY);
                adjusted = true;
              }
            }
          }

          // 2. Cylinder Colliders
          const cIds = cylCells[cellIdx];
          for (let k = 0; k < cIds.length; k++) {
            const i = cIds[k];
            if (this.cylVisited[i] === stamp) continue;
            this.cylVisited[i] = stamp;

            const cyl = cylinders[i];
            if (cyl.bottomY !== undefined && pos.y + 1.85 <= cyl.bottomY) continue;
            if (!cyl.allowStand && pos.y >= cyl.topY - 0.05 && pos.y > 1.2) continue;

            const dx = pos.x - cyl.x;
            const dz = pos.z - cyl.z;
            const distSq = dx * dx + dz * dz;
            const minDist = cyl.radius + playerRadius;

            if (distSq < minDist * minDist) {
              if (cyl.allowStand && pos.y >= cyl.topY - 0.34) {
                if (distSq < (cyl.radius + playerRadius * 0.35) ** 2) {
                  supportY = Math.max(supportY, cyl.topY);
                }
              } else {
                const dist = Math.sqrt(distSq);
                if (dist > 0.0001) {
                  const push = minDist / dist;
                  pos.x = cyl.x + dx * push;
                  pos.z = cyl.z + dz * push;
                } else {
                  pos.x = cyl.x + minDist;
                }
                adjusted = true;
              }
            }
          }

          // 3. Tree Trunk Colliders
          const tIds = treeCells[cellIdx];
          for (let k = 0; k < tIds.length; k++) {
            const i = tIds[k];
            if (this.treeVisited[i] === stamp) continue;
            this.treeVisited[i] = stamp;

            const cyl = treeCyls[i];
            const dx = pos.x - cyl.x;
            const dz = pos.z - cyl.z;
            const distSq = dx * dx + dz * dz;
            const minDist = cyl.radius + playerRadius;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq);
              if (dist > 0.0001) {
                const push = minDist / dist;
                pos.x = cyl.x + dx * push;
                pos.z = cyl.z + dz * push;
              } else {
                pos.x = cyl.x + minDist;
              }
              adjusted = true;
            }
          }
        }
      }

      if (!adjusted) break;
    }

    this.sea.resolveSeaBoundary(pos, playerRadius);
    return supportY;
  }

  public isStaticPointObstructed(
    x: number,
    z: number,
    radius: number = 0.85,
    skipStandable: boolean = false
  ): boolean {
    this.ensureCollisionGrid();
    const boxCells = this.boxCells!;
    const cylCells = this.cylCells!;
    const treeCells = this.treeCells!;
    const boxes = this.village.boxColliders;
    const cylinders = this.village.cylinderColliders;
    const treeCyls = this.trees.colliders;

    const stamp = this.nextVisitStamp();
    const pad = radius + 0.5;
    const minX = Math.max(0, Math.min(this.gridDim - 1, Math.floor((x - pad + this.gridHalfExtent) / this.gridCellSize)));
    const maxX = Math.max(0, Math.min(this.gridDim - 1, Math.floor((x + pad + this.gridHalfExtent) / this.gridCellSize)));
    const minZ = Math.max(0, Math.min(this.gridDim - 1, Math.floor((z - pad + this.gridHalfExtent) / this.gridCellSize)));
    const maxZ = Math.max(0, Math.min(this.gridDim - 1, Math.floor((z + pad + this.gridHalfExtent) / this.gridCellSize)));
    const rSq = radius * radius;

    for (let gz = minZ; gz <= maxZ; gz++) {
      const row = gz * this.gridDim;
      for (let gx = minX; gx <= maxX; gx++) {
        const cellIdx = row + gx;

        const bIds = boxCells[cellIdx];
        for (let k = 0; k < bIds.length; k++) {
          const i = bIds[k];
          if (this.boxVisited[i] === stamp) continue;
          this.boxVisited[i] = stamp;

          const box = boxes[i];
          if (box.bottomY !== undefined && box.bottomY >= 2.0) continue;
          if (skipStandable && box.allowStand) continue;
          const dx = x - box.cx;
          const dz = z - box.cz;
          const lx = dx * box.cosY + dz * box.sinY;
          const lz = -dx * box.sinY + dz * box.cosY;
          if (skipStandable) {
            const cx = Math.max(-box.halfW, Math.min(box.halfW, lx));
            const cz = Math.max(-box.halfD, Math.min(box.halfD, lz));
            const ox = lx - cx;
            const oz = lz - cz;
            if (ox * ox + oz * oz < rSq) return true;
          } else {
            if (Math.abs(lx) < box.halfW + radius && Math.abs(lz) < box.halfD + radius) {
              return true;
            }
          }
        }

        const cIds = cylCells[cellIdx];
        for (let k = 0; k < cIds.length; k++) {
          const i = cIds[k];
          if (this.cylVisited[i] === stamp) continue;
          this.cylVisited[i] = stamp;

          const cyl = cylinders[i];
          if (cyl.bottomY !== undefined && cyl.bottomY >= 2.0) continue;
          if (skipStandable && cyl.allowStand) continue;
          const dx = x - cyl.x;
          const dz = z - cyl.z;
          const minDist = cyl.radius + radius;
          if (dx * dx + dz * dz < minDist * minDist) return true;
        }

        const tIds = treeCells[cellIdx];
        for (let k = 0; k < tIds.length; k++) {
          const i = tIds[k];
          if (this.treeVisited[i] === stamp) continue;
          this.treeVisited[i] = stamp;

          const cyl = treeCyls[i];
          const dx = x - cyl.x;
          const dz = z - cyl.z;
          const minDist = cyl.radius + radius;
          if (dx * dx + dz * dz < minDist * minDist) return true;
        }
      }
    }

    return false;
  }

  public isPointBlocked(x: number, z: number, radius: number = 1.25): boolean {
    if (x * x + z * z > 85.8 * 85.8) return true;
    if (x < getCoastlineX(z) + radius + 0.65) return true;
    return this.isStaticPointObstructed(x, z, radius, true);
  }

  private createSun() {
    const sunGroup = new THREE.Group();
    sunGroup.name = 'SkySun';
    // Positioned far away in the upper-right forward sky
    sunGroup.position.set(42, 56, -220);

    const sunCoreGeo = new THREE.SphereGeometry(8.5, 20, 16);
    this.sunCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffdc14,
      toneMapped: false,
      fog: false,
    });
    const sunCore = new THREE.Mesh(sunCoreGeo, this.sunCoreMat);
    sunGroup.add(sunCore);

    const sunGlowTex = createSunGlowTexture();
    const haloGeo = new THREE.PlaneGeometry(54, 54);
    this.sunHaloMat = new THREE.MeshBasicMaterial({
      map: sunGlowTex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.sunHaloMesh = new THREE.Mesh(haloGeo, this.sunHaloMat);
    sunGroup.add(this.sunHaloMesh);

    this.disposables.push(sunCoreGeo, this.sunCoreMat, sunGlowTex, haloGeo, this.sunHaloMat);
    this.sunGroup = sunGroup;
    this.group.add(sunGroup);
  }

  private createMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.name = 'SkyMoon';
    moonGroup.position.set(-40, 62, -200);
    moonGroup.visible = false;

    const moonCoreGeo = new THREE.SphereGeometry(6.8, 20, 16);
    this.moonCoreMat = new THREE.MeshBasicMaterial({
      color: 0xf4f9ff,
      transparent: true,
      opacity: 1.0,
      toneMapped: false,
      fog: false,
    });
    const moonCore = new THREE.Mesh(moonCoreGeo, this.moonCoreMat);
    moonGroup.add(moonCore);

    const moonGlowTex = createMoonGlowTexture();
    const haloGeo = new THREE.PlaneGeometry(48, 48);
    this.moonHaloMat = new THREE.MeshBasicMaterial({
      map: moonGlowTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.moonHaloMesh = new THREE.Mesh(haloGeo, this.moonHaloMat);
    moonGroup.add(this.moonHaloMesh);

    this.disposables.push(moonCoreGeo, this.moonCoreMat, moonGlowTex, haloGeo, this.moonHaloMat);
    this.moonGroup = moonGroup;
    this.group.add(moonGroup);
  }

  private createStars() {
    const starCount = 720;
    const positions = new Float32Array(starCount * 3);
    let seed = 918273;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      // Distribute in upper sky hemisphere above horizon
      const phi = Math.acos(0.14 + rand() * 0.86);
      const r = 215 + rand() * 45;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.starsMat = new THREE.PointsMaterial({
      color: 0xeef6ff,
      size: 1.45,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    this.starsPoints = new THREE.Points(starGeo, this.starsMat);
    this.starsPoints.name = 'SkyStars';
    this.starsPoints.visible = false;
    this.starsPoints.frustumCulled = false;

    this.disposables.push(starGeo, this.starsMat);
    this.group.add(this.starsPoints);
  }

  private createSkyClouds(mapRadius: number) {
    const cloudCount = 20;
    const puffsPerCloud = 5;
    const totalPuffs = cloudCount * puffsPerCloud;

    const puffGeo = new THREE.SphereGeometry(1.0, 10, 8);
    this.cloudPuffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe4eef7,
      emissiveIntensity: 0.4,
      roughness: 0.95,
      metalness: 0.0,
      fog: false,
    });
    this.disposables.push(puffGeo, this.cloudPuffMat);

    this.cloudsMesh = new THREE.InstancedMesh(puffGeo, this.cloudPuffMat, totalPuffs);
    this.cloudsMesh.frustumCulled = false;

    this.cloudData = [];
    for (let c = 0; c < cloudCount; c++) {
      const angle = (c / cloudCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
      // Place clouds far beyond the playable map boundary in the distant sky
      const dist = mapRadius * 1.55 + Math.random() * mapRadius * 1.35;
      const baseX = Math.cos(angle) * dist;
      const baseZ = Math.sin(angle) * dist;
      const baseY = 26.0 + Math.random() * 16.0;

      const puffs = [];
      const baseSize = 4.6 + Math.random() * 2.8;
      for (let p = 0; p < puffsPerCloud; p++) {
        const isCenter = p === 0;
        const offsetAngle = (p / (puffsPerCloud - 1)) * Math.PI * 2;
        puffs.push({
          ox: isCenter ? 0 : Math.cos(offsetAngle) * baseSize * 1.05,
          oy: isCenter ? 0.9 : (Math.random() - 0.3) * 1.1,
          oz: isCenter ? 0 : Math.sin(offsetAngle) * baseSize * 0.65,
          sx: baseSize * (isCenter ? 1.45 : 0.85 + Math.random() * 0.35),
          sy: baseSize * (isCenter ? 0.8 : 0.55 + Math.random() * 0.2),
          sz: baseSize * (isCenter ? 1.1 : 0.75 + Math.random() * 0.25),
        });
      }

      this.cloudData.push({
        baseX,
        baseY,
        baseZ,
        speed: 0.9 + Math.random() * 0.9,
        puffs,
      });
    }

    this.updateCloudMatrices(0);
    this.group.add(this.cloudsMesh);
  }

  private createFlyingBirds(mapRadius: number) {
    const birdGroupContainer = new THREE.Group();
    birdGroupContainer.name = 'FlyingBirds';

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x262b33,
      roughness: 0.75,
      metalness: 0.05,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x353b45,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const bodyGeo = new THREE.ConeGeometry(0.09, 0.52, 6);
    bodyGeo.rotateX(Math.PI / 2);

    const leftWingGeo = new THREE.BufferGeometry();
    const lwVerts = new Float32Array([
      0.0, 0.0, 0.14,
      -0.55, 0.02, -0.05,
      0.0, 0.0, -0.1,
    ]);
    leftWingGeo.setAttribute('position', new THREE.BufferAttribute(lwVerts, 3));
    leftWingGeo.computeVertexNormals();

    const rightWingGeo = new THREE.BufferGeometry();
    const rwVerts = new Float32Array([
      0.0, 0.0, 0.14,
      0.0, 0.0, -0.1,
      0.55, 0.02, -0.05,
    ]);
    rightWingGeo.setAttribute('position', new THREE.BufferAttribute(rwVerts, 3));
    rightWingGeo.computeVertexNormals();

    this.disposables.push(bodyMat, wingMat, bodyGeo, leftWingGeo, rightWingGeo);

    const birdCount = 14;
    this.birds = [];

    for (let i = 0; i < birdCount; i++) {
      const birdGroup = new THREE.Group();

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      birdGroup.add(body);

      const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
      leftWing.position.set(-0.04, 0.02, 0.03);
      birdGroup.add(leftWing);

      const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
      rightWing.position.set(0.04, 0.02, 0.03);
      birdGroup.add(rightWing);

      const scale = 0.85 + Math.random() * 0.45;
      birdGroup.scale.setScalar(scale);

      const isForwardFlock = i < 6;
      const centerX = isForwardFlock ? (Math.random() - 0.5) * 18 : (Math.random() - 0.5) * mapRadius * 0.7;
      const centerZ = isForwardFlock ? -24 - Math.random() * 14 : (Math.random() - 0.5) * mapRadius * 0.7;

      const bird: BirdData = {
        group: birdGroup,
        leftWing,
        rightWing,
        centerX,
        centerZ,
        radiusX: isForwardFlock ? 12 + Math.random() * 12 : 16 + Math.random() * 24,
        radiusZ: isForwardFlock ? 9 + Math.random() * 10 : 14 + Math.random() * 22,
        baseY: isForwardFlock ? 8.5 + Math.random() * 5.0 : 10.0 + Math.random() * 8.5,
        angle: (i / birdCount) * Math.PI * 2,
        angularSpeed: (i % 2 === 0 ? 1 : -1) * (0.22 + Math.random() * 0.16),
        flapSpeed: 8.5 + Math.random() * 3.5,
        flapPhase: Math.random() * Math.PI * 2,
        bobPhase: Math.random() * Math.PI * 2,
      };

      this.birds.push(bird);
      birdGroupContainer.add(birdGroup);
    }

    this.updateBirds(0);
    this.birdGroupContainer = birdGroupContainer;
    this.group.add(birdGroupContainer);
  }

  private updateBirds(delta: number) {
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.angle += b.angularSpeed * delta;

      const cosA = Math.cos(b.angle);
      const sinA = Math.sin(b.angle);

      const x = b.centerX + cosA * b.radiusX;
      const z = b.centerZ + sinA * b.radiusZ;
      const y = b.baseY + Math.sin(this.elapsedTime * 0.9 + b.bobPhase) * 0.9;

      const vx = -sinA * b.radiusX * b.angularSpeed;
      const vz = cosA * b.radiusZ * b.angularSpeed;

      b.group.position.set(x, y, z);
      b.group.rotation.y = Math.atan2(vx, vz);
      b.group.rotation.z = b.angularSpeed > 0 ? -0.22 : 0.22;

      const glideMod = 0.55 + 0.45 * Math.sin(this.elapsedTime * 0.7 + b.flapPhase);
      const flapAngle = Math.sin(this.elapsedTime * b.flapSpeed + b.flapPhase) * 0.65 * glideMod;
      b.leftWing.rotation.z = flapAngle;
      b.rightWing.rotation.z = -flapAngle;
    }
  }

  private cloudMatrixAccum: number = 0;

  private updateCloudMatrices(delta: number) {
    if (!this.cloudsMesh) return;
    this.cloudMatrixAccum += delta;
    if (delta > 0 && this.cloudMatrixAccum < 0.05) {
      return;
    }
    const stepDelta = delta === 0 ? 0 : this.cloudMatrixAccum;
    this.cloudMatrixAccum = 0;

    let idx = 0;
    const limit = this.skyWrapLimit;

    for (let c = 0; c < this.cloudData.length; c++) {
      const cloud = this.cloudData[c];
      cloud.baseX += cloud.speed * stepDelta;
      if (cloud.baseX > limit) {
        cloud.baseX = -limit;
      }

      for (let p = 0; p < cloud.puffs.length; p++) {
        const puff = cloud.puffs[p];
        _cloudDummy.position.set(
          cloud.baseX + puff.ox,
          cloud.baseY + puff.oy,
          cloud.baseZ + puff.oz
        );
        _cloudDummy.scale.set(puff.sx, puff.sy, puff.sz);
        _cloudDummy.updateMatrix();
        this.cloudsMesh.setMatrixAt(idx++, _cloudDummy.matrix);
      }
    }
    this.cloudsMesh.instanceMatrix.needsUpdate = true;
  }

  public updateTimeOfDay(
    hourFloat: number,
    scene: THREE.Scene,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    fillLight: THREE.DirectionalLight,
    playerPos: THREE.Vector3,
    fogBoundary?: FogBoundary,
    camera?: THREE.Camera,
    weatherRain: number = 0,
    lightningFlash: number = 0
  ) {
    // Normalize hour into [0, 24)
    const h = ((hourFloat % 24) + 24) % 24;
    const rainAmt = Math.max(0, Math.min(1, weatherRain));
    const flashAmt = Math.max(0, Math.min(1, lightningFlash));

    // 1. Night intensity factor (0 = full day, 1 = deep night)
    let nightFactor = 0;
    if (h < 5.25 || h >= 19.25) {
      nightFactor = 1;
    } else if (h < 6.75) {
      nightFactor = 1 - smoothstepRange(5.25, 6.75, h);
    } else if (h >= 17.75) {
      nightFactor = smoothstepRange(17.75, 19.25, h);
    }

    // 2. Ordered Sky Color Cycle (Night -> Dawn Rose -> Golden Sunrise -> Day -> Golden Sunset -> Crimson -> Twilight -> Night)
    if (h < 5.25 || h >= 19.35) {
      _tmpSky.copy(_colNight);
    } else if (h < 6.05) {
      _tmpSky.copy(_colNight).lerp(_colDawnRose, smoothstepRange(5.25, 6.05, h));
    } else if (h < 6.85) {
      _tmpSky.copy(_colDawnRose).lerp(_colSunriseGold, smoothstepRange(6.05, 6.85, h));
    } else if (h < 7.75) {
      _tmpSky.copy(_colSunriseGold).lerp(_colDaySky, smoothstepRange(6.85, 7.75, h));
    } else if (h < 16.75) {
      _tmpSky.copy(_colDaySky);
    } else if (h < 17.85) {
      _tmpSky.copy(_colDaySky).lerp(_colSunsetGold, smoothstepRange(16.75, 17.85, h));
    } else if (h < 18.55) {
      _tmpSky.copy(_colSunsetGold).lerp(_colSunsetCrimson, smoothstepRange(17.85, 18.55, h));
    } else if (h < 19.05) {
      _tmpSky.copy(_colSunsetCrimson).lerp(_colTwilight, smoothstepRange(18.55, 19.05, h));
    } else {
      _tmpSky.copy(_colTwilight).lerp(_colNight, smoothstepRange(19.05, 19.35, h));
    }

    if (rainAmt > 0.005) {
      _tmpSpec.copy(_colStormSkyDay).lerp(_colStormSkyNight, nightFactor);
      _tmpSky.lerp(_tmpSpec, rainAmt * 0.72);
    }
    if (flashAmt > 0.005) {
      _tmpSky.lerp(_colLightningFlash, flashAmt * 0.78);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_tmpSky);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(_tmpSky);
      // Slightly denser atmospheric mist at night/dawn and during rain
      scene.fog.density = 0.0085 + nightFactor * 0.0018 + rainAmt * 0.0044;
    }

    // 3. Sun Trajectory (East +X at 05:30 -> Zenith at 12:15 -> West -X over Sea at 19:00; hidden at night)
    const daySpan = 13.5;
    const dayT = (h - 5.5) / daySpan;
    const isSunUp = h >= 5.35 && h <= 19.15;

    let sunElevation = 0;
    let sunX = 16;
    let sunY = 32;
    let sunZ = -180;

    if (isSunUp && this.sunGroup) {
      const clampedT = Math.max(0, Math.min(1, dayT));
      const theta = clampedT * Math.PI;
      sunX = Math.cos(theta) * 185;
      sunY = Math.sin(theta) * 104 - 5;
      sunZ = -185;
      sunElevation = Math.max(0, Math.sin(theta));

      this.sunGroup.position.set(sunX, sunY, sunZ);
      const horizonFade = smoothstepRange(5.35, 5.95, h) * (1 - smoothstepRange(18.55, 19.15, h));
      this.sunGroup.visible = horizonFade > 0.02;

      const warmth = 1 - Math.min(1, sunElevation * 2.2);
      if (this.sunCoreMat) {
        this.sunCoreMat.color.copy(_colSunDay).lerp(_colSunHorizon, warmth * 0.78);
      }
      if (this.sunHaloMat) {
        this.sunHaloMat.opacity = 0.9 * horizonFade;
      }
    } else if (this.sunGroup) {
      this.sunGroup.visible = false;
    }

    // 4. Glowing Moon Trajectory (18:30 -> 06:00)
    const moonElapsed = h >= 18.5 ? h - 18.5 : h <= 6.0 ? h + 5.5 : -1;
    let moonX = -35;
    let moonY = 70;
    let moonZ = -180;
    if (moonElapsed >= 0 && moonElapsed <= 11.5 && this.moonGroup) {
      const mT = moonElapsed / 11.5;
      const mTheta = mT * Math.PI;
      moonX = Math.cos(mTheta) * 165;
      moonY = Math.sin(mTheta) * 86 + 10;
      moonZ = -180;
      const moonFade = smoothstepRange(0, 0.1, mT) * (1 - smoothstepRange(0.9, 1.0, mT));

      this.moonGroup.position.set(moonX, moonY, moonZ);
      this.moonGroup.visible = moonFade > 0.02;
      if (this.moonCoreMat) this.moonCoreMat.opacity = moonFade;
      if (this.moonHaloMat) {
        this.moonHaloMat.opacity = (0.78 + Math.sin(this.elapsedTime * 1.4) * 0.08) * moonFade;
      }
      if (this.moonHaloMesh && camera) {
        this.moonHaloMesh.lookAt(camera.position);
      }
    } else if (this.moonGroup) {
      this.moonGroup.visible = false;
    }

    // 5. Twinkling Stars at Night
    if (this.starsPoints && this.starsMat) {
      this.starsPoints.visible = nightFactor > 0.04;
      if (this.starsPoints.visible) {
        this.starsMat.opacity = nightFactor * (0.86 + Math.sin(this.elapsedTime * 1.9) * 0.08);
        this.starsPoints.rotation.y = this.elapsedTime * 0.003;
      }
    }

    // 6. Birds appear during Day and disappear at Night
    const isDaytimeForBirds = h >= 5.75 && h < 19.0;
    if (this.birdGroupContainer) {
      this.birdGroupContainer.visible = isDaytimeForBirds;
    }

    // 7. Directional, Hemisphere & Fill Lights
    const sunWarmFactor =
      isSunUp ? (1 - Math.min(1, sunElevation * 2.4)) * (1 - nightFactor) : 0;

    hemiLight.color.copy(_colHemiSkyDay).lerp(_colHemiSkyNight, nightFactor);
    hemiLight.groundColor.copy(_colHemiGroundDay).lerp(_colHemiGroundNight, nightFactor);
    hemiLight.intensity =
      THREE.MathUtils.lerp(0.92, 0.42, nightFactor) * (1 - rainAmt * 0.25) + flashAmt * 1.45;

    if (nightFactor < 0.72 && isSunUp) {
      _tmpSunDir.set(sunX, Math.max(22, sunY), sunZ).normalize();
      dirLight.color.copy(_colDirDay).lerp(_colDirWarm, sunWarmFactor * 0.8);
      dirLight.intensity = THREE.MathUtils.lerp(1.55, 0.45, nightFactor / 0.72);
    } else {
      _tmpSunDir.set(moonX, Math.max(30, moonY), moonZ).normalize();
      dirLight.color.copy(_colDirNight);
      dirLight.intensity = 0.56;
    }
    dirLight.intensity = dirLight.intensity * (1 - rainAmt * 0.48) + flashAmt * 2.35;
    if (flashAmt > 0.01) {
      dirLight.color.lerp(_colLightningFlash, flashAmt * 0.85);
    }

    dirLight.position.set(
      playerPos.x + _tmpSunDir.x * 58,
      Math.max(24, _tmpSunDir.y * 58),
      playerPos.z + _tmpSunDir.z * 58
    );
    dirLight.target.position.copy(playerPos);
    dirLight.target.updateMatrixWorld();

    fillLight.color.copy(_colFillDay).lerp(_colFillNight, nightFactor);
    fillLight.intensity =
      THREE.MathUtils.lerp(0.72, 0.34, nightFactor) * (1 - rainAmt * 0.22) + flashAmt * 0.95;

    // 8. Cloud Atmosphere Tinting
    if (this.cloudPuffMat) {
      this.cloudPuffMat.color
        .copy(_colCloudDay)
        .lerp(_colCloudWarm, sunWarmFactor * 0.75)
        .lerp(_colCloudNight, nightFactor * 0.92)
        .lerp(_colStormCloud, rainAmt * 0.78)
        .lerp(_colLightningFlash, flashAmt * 0.65);
      this.cloudPuffMat.emissive
        .copy(_colCloudEmissiveDay)
        .lerp(_colCloudWarm, sunWarmFactor * 0.55)
        .lerp(_colCloudEmissiveNight, nightFactor * 0.95)
        .lerp(_colLightningFlash, flashAmt * 0.55);
      this.cloudPuffMat.emissiveIntensity =
        THREE.MathUtils.lerp(0.4, 0.14, nightFactor) * (1 - rainAmt * 0.4) + flashAmt * 0.85;
    }

    // 9. Synchronize Water Reflections, Horizon Fog Boundary & Glowing Village Lanterns
    _tmpSeaSky.copy(_tmpSky);
    _tmpSpec.copy(_colSpecDay).lerp(_colSpecSunset, sunWarmFactor * 0.85).lerp(_colSpecMoon, nightFactor);
    this.sea.setAtmosphere(_tmpSeaSky, _tmpSky, _tmpSunDir, _tmpSpec, nightFactor);
    fogBoundary?.setAtmosphere(_tmpSky, nightFactor);
    this.village.setNightAmount(nightFactor);
  }

  public update(delta: number, camera?: THREE.Camera) {
    this.elapsedTime += delta;
    this.village.update(this.elapsedTime);
    this.sea.update(this.elapsedTime, delta);
    this.updateCloudMatrices(delta);
    if (!this.birdGroupContainer || this.birdGroupContainer.visible) {
      this.updateBirds(delta);
    }

    if (this.sunHaloMesh && camera) {
      this.sunHaloMesh.lookAt(camera.position);
    }
    if (this.moonHaloMesh && camera) {
      this.moonHaloMesh.lookAt(camera.position);
    }
  }

  public dispose() {
    this.village.dispose();
    this.sea.dispose();
    this.trees.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
