import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createOrchardLandTexture, createRadialShadowTexture, createWoodPlankTexture } from './textures';

export type AnimalKind = 'cow' | 'sheep' | 'dog';
type CowVariant = 'holstein' | 'brown';
type SheepVariant = 'white' | 'brown';
type DogVariant = 'golden' | 'collie' | 'blacktan';

export function getFarmAnimalRadius(kind: AnimalKind): number {
  return kind === 'cow' ? 0.78 : kind === 'sheep' ? 0.45 : 0.38;
}

function getAnimalMass(kind: AnimalKind): number {
  return kind === 'cow' ? 3.0 : kind === 'sheep' ? 1.0 : 0.85;
}

const _snoutProbe = new THREE.Vector3();

export interface FarmAnimal {
  id: string;
  kind: AnimalKind;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  legs: THREE.Group[];
  pos: THREE.Vector3;
  facingAngle: number;
  targetX: number;
  targetZ: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  isMoving: boolean;
  isGrazing: boolean;
  stateTimer: number;
  walkPhase: number;
  idlePhase: number;
  speed: number;
  stuckTimer: number;
  lastProgressPos: THREE.Vector3;
  accumDelta: number;
}

export class FarmManager {
  public group: THREE.Group;
  public boxColliders: OBBCollider[] = [];
  public animals: FarmAnimal[] = [];
  private updateTickCount: number = 0;
  private movedFlags: Uint8Array = new Uint8Array(32);

  private disposables: { dispose: () => void }[] = [];

  // Shared materials
  private woodMat!: THREE.MeshStandardMaterial;
  private darkWoodMat!: THREE.MeshStandardMaterial;
  private roofMat!: THREE.MeshStandardMaterial;
  private hayMat!: THREE.MeshStandardMaterial;
  private waterMat!: THREE.MeshStandardMaterial;
  private shadowMat!: THREE.MeshBasicMaterial;
  private shadowGeo!: THREE.PlaneGeometry;

  // Animal materials
  private cowWhiteMat!: THREE.MeshStandardMaterial;
  private cowBlackSpotMat!: THREE.MeshStandardMaterial;
  private cowBrownMat!: THREE.MeshStandardMaterial;
  private pinkSnoutMat!: THREE.MeshStandardMaterial;
  private hornMat!: THREE.MeshStandardMaterial;
  private hoofMat!: THREE.MeshStandardMaterial;
  private darkEyeMat!: THREE.MeshStandardMaterial;

  private sheepWoolWhiteMat!: THREE.MeshStandardMaterial;
  private sheepWoolBrownMat!: THREE.MeshStandardMaterial;
  private sheepFaceDarkMat!: THREE.MeshStandardMaterial;

  private dogGoldenMat!: THREE.MeshStandardMaterial;
  private dogCollieBrownMat!: THREE.MeshStandardMaterial;
  private dogBlackMat!: THREE.MeshStandardMaterial;
  private dogCreamMat!: THREE.MeshStandardMaterial;
  private dogCollarMat!: THREE.MeshStandardMaterial;

  // Shared sculpted geometries
  private cowTorsoGeo!: THREE.LatheGeometry;
  private dogTorsoGeo!: THREE.LatheGeometry;

  constructor(targetBoxColliders?: OBBCollider[]) {
    this.group = new THREE.Group();
    this.group.name = 'RoyalLivestockFarm';

    this.initSharedAssets();
    this.buildFarmEnclosure();
    // Freeze static enclosure, barn, fences, signboard, hay bales, and water trough transforms
    this.group.updateMatrixWorld(true);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.matrixAutoUpdate = false;
      }
    });
    this.spawnFarmAnimals();

    if (targetBoxColliders) {
      for (let i = 0; i < this.boxColliders.length; i++) {
        targetBoxColliders.push(this.boxColliders[i]);
      }
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private addOBB(cx: number, cz: number, width: number, depth: number, rotY: number, topY: number) {
    this.boxColliders.push({
      cx,
      cz,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      cosY: Math.cos(-rotY),
      sinY: Math.sin(-rotY),
      topY,
      allowStand: false,
    });
  }

  private initSharedAssets() {
    const woodTex = this.track(createWoodPlankTexture());
    this.woodMat = this.track(
      new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb68250, roughness: 0.84, metalness: 0.03 })
    );
    this.darkWoodMat = this.track(
      new THREE.MeshStandardMaterial({ map: woodTex, color: 0x5d3b22, roughness: 0.88, metalness: 0.04 })
    );
    this.roofMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x8f3428, roughness: 0.85, metalness: 0.04 })
    );
    this.hayMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd9b35b, roughness: 0.94, metalness: 0.01 })
    );
    this.waterMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x2f8eb8, roughness: 0.16, metalness: 0.12 })
    );

    const shadowTex = this.track(createRadialShadowTexture());
    this.shadowMat = this.track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    this.shadowGeo = this.track(new THREE.PlaneGeometry(1, 1));

    // Animal materials
    this.cowWhiteMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.78 }));
    this.cowBlackSpotMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.8 }));
    this.cowBrownMat = this.track(new THREE.MeshStandardMaterial({ color: 0x8d4f28, roughness: 0.78 }));
    this.pinkSnoutMat = this.track(new THREE.MeshStandardMaterial({ color: 0xe9a3ab, roughness: 0.7 }));
    this.hornMat = this.track(new THREE.MeshStandardMaterial({ color: 0xe8ddc2, roughness: 0.55 }));
    this.hoofMat = this.track(new THREE.MeshStandardMaterial({ color: 0x181615, roughness: 0.85 }));
    this.darkEyeMat = this.track(new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.2 }));

    this.sheepWoolWhiteMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.96 }));
    this.sheepWoolBrownMat = this.track(new THREE.MeshStandardMaterial({ color: 0x7b5c43, roughness: 0.96 }));
    this.sheepFaceDarkMat = this.track(new THREE.MeshStandardMaterial({ color: 0x262426, roughness: 0.84 }));

    this.dogGoldenMat = this.track(new THREE.MeshStandardMaterial({ color: 0xc98a42, roughness: 0.76 }));
    this.dogCollieBrownMat = this.track(new THREE.MeshStandardMaterial({ color: 0x7b4725, roughness: 0.78 }));
    this.dogBlackMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.72 }));
    this.dogCreamMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf0e4cf, roughness: 0.8 }));
    this.dogCollarMat = this.track(new THREE.MeshStandardMaterial({ color: 0xb81f2e, roughness: 0.6 }));

    // Cow sculpted barrel
    const cowPts = [
      new THREE.Vector2(0.01, -0.78),
      new THREE.Vector2(0.24, -0.7),
      new THREE.Vector2(0.37, -0.45),
      new THREE.Vector2(0.39, 0.0),
      new THREE.Vector2(0.37, 0.44),
      new THREE.Vector2(0.31, 0.68),
      new THREE.Vector2(0.01, 0.76),
    ];
    this.cowTorsoGeo = this.track(new THREE.LatheGeometry(cowPts, 14));
    this.cowTorsoGeo.rotateX(Math.PI / 2);

    // Dog sculpted torso
    const dogPts = [
      new THREE.Vector2(0.01, -0.34),
      new THREE.Vector2(0.09, -0.29),
      new THREE.Vector2(0.115, -0.14),
      new THREE.Vector2(0.105, 0.02),
      new THREE.Vector2(0.13, 0.18),
      new THREE.Vector2(0.1, 0.3),
      new THREE.Vector2(0.01, 0.34),
    ];
    this.dogTorsoGeo = this.track(new THREE.LatheGeometry(dogPts, 12));
    this.dogTorsoGeo.rotateX(Math.PI / 2);
  }

  private buildFarmEnclosure() {
    // Farm bounds: x in [-8.2 .. +8.2], z in [45.4 .. 56.2]
    const pastureTex = this.track(createOrchardLandTexture());
    pastureTex.repeat.set(2.5, 1.8);
    const pastureMat = this.track(
      new THREE.MeshStandardMaterial({
        map: pastureTex,
        color: 0xc2b98f,
        roughness: 0.95,
        metalness: 0.01,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const pastureGeo = this.track(new THREE.PlaneGeometry(16.6, 11.0));
    pastureGeo.rotateX(-Math.PI / 2);
    const pastureMesh = new THREE.Mesh(pastureGeo, pastureMat);
    pastureMesh.position.set(0, 0.011, 50.8);
    pastureMesh.receiveShadow = true;
    this.group.add(pastureMesh);

    // Helper for wooden fence segments with posts & rails
    const addFenceSegment = (cx: number, cz: number, length: number, rotY: number) => {
      const fence = new THREE.Group();
      fence.position.set(cx, 0, cz);
      fence.rotation.y = rotY;

      const postCount = Math.max(2, Math.round(length / 1.8) + 1);
      const postGeo = this.track(new THREE.BoxGeometry(0.14, 0.95, 0.14));
      for (let i = 0; i < postCount; i++) {
        const px = -length * 0.5 + (i / (postCount - 1)) * length;
        const post = new THREE.Mesh(postGeo, this.darkWoodMat);
        post.position.set(px, 0.475, 0);
        post.castShadow = true;
        post.receiveShadow = true;
        fence.add(post);
      }

      const railGeo = this.track(new THREE.BoxGeometry(length, 0.08, 0.06));
      [0.36, 0.72].forEach((ry) => {
        const rail = new THREE.Mesh(railGeo, this.woodMat);
        rail.position.set(0, ry, 0);
        rail.castShadow = true;
        fence.add(rail);
      });

      this.group.add(fence);
      this.addOBB(cx, cz, length + 0.16, 0.38, rotY, 0.95);
    };

    // North fence with central 3.8m open gate at x in [-1.9..+1.9]
    addFenceSegment(-5.05, 45.4, 6.3, 0);
    addFenceSegment(5.05, 45.4, 6.3, 0);
    // South fence
    addFenceSegment(0, 56.2, 16.4, 0);
    // West & East fences
    addFenceSegment(-8.2, 50.8, 10.8, Math.PI / 2);
    addFenceSegment(8.2, 50.8, 10.8, Math.PI / 2);

    // Tall wooden gate posts framing entrance
    const gatePostGeo = this.track(new THREE.BoxGeometry(0.24, 2.2, 0.24));
    [-1.95, 1.95].forEach((gx) => {
      const gp = new THREE.Mesh(gatePostGeo, this.darkWoodMat);
      gp.position.set(gx, 1.1, 45.4);
      gp.castShadow = true;
      this.group.add(gp);
      this.addOBB(gx, 45.4, 0.36, 0.38, 0, 2.2);
    });
    const lintelGeo = this.track(new THREE.BoxGeometry(4.4, 0.22, 0.26));
    const lintel = new THREE.Mesh(lintelGeo, this.darkWoodMat);
    lintel.position.set(0, 2.18, 45.4);
    lintel.castShadow = true;
    this.group.add(lintel);

    // Arabic Farm Signboard on top of the gate arch
    this.createFarmSignboard(0, 2.52, 45.4);

    // Open-front Rustic Wooden Barn Shelter in SW corner (-5.4, 53.8)
    this.createFarmBarn(-5.4, 53.8);

    // Hay Bales around the barn and pasture
    this.createHayBale(-1.8, 54.4, 0.3);
    this.createHayBale(-2.5, 53.5, -0.4);
    this.createHayBale(5.6, 47.4, 0.6);

    // Wooden Water Trough on East side (5.8, 52.8)
    this.createWaterTrough(5.8, 52.8);
  }

  private createFarmSignboard(x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#d9a848';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      ctx.fillStyle = '#fef3d0';
      ctx.font = 'bold 58px Tajawal, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('المزرعة الملكية', canvas.width / 2, 72);

      ctx.fillStyle = '#f2c864';
      ctx.font = 'bold 34px Tajawal, sans-serif';
      ctx.fillText('بقر  ·  خراف  ·  كلاب', canvas.width / 2, 134);
    }

    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const signMat = this.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 }));
    const boardGeo = this.track(new THREE.BoxGeometry(3.2, 0.78, 0.12));
    const board = new THREE.Mesh(boardGeo, [
      this.darkWoodMat,
      this.darkWoodMat,
      this.darkWoodMat,
      this.darkWoodMat,
      signMat,
      signMat,
    ]);
    board.position.set(x, y, z);
    board.castShadow = true;
    this.group.add(board);
  }

  private createFarmBarn(x: number, z: number) {
    const barn = new THREE.Group();
    barn.position.set(x, 0, z);

    const w = 4.2;
    const d = 3.0;
    const h = 2.25;

    // Back & Side wooden walls (open front facing North toward the farm pasture)
    const backWallGeo = this.track(new THREE.BoxGeometry(w, h, 0.18));
    const backWall = new THREE.Mesh(backWallGeo, this.woodMat);
    backWall.position.set(0, h / 2, d / 2 - 0.09);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    barn.add(backWall);

    const sideWallGeo = this.track(new THREE.BoxGeometry(0.18, h, d));
    [-w / 2 + 0.09, w / 2 - 0.09].forEach((sx) => {
      const sw = new THREE.Mesh(sideWallGeo, this.woodMat);
      sw.position.set(sx, h / 2, 0);
      sw.castShadow = true;
      sw.receiveShadow = true;
      barn.add(sw);
    });

    // Timber corner posts
    const postGeo = this.track(new THREE.BoxGeometry(0.22, h + 0.1, 0.22));
    [
      [-w / 2 + 0.1, -d / 2 + 0.1],
      [w / 2 - 0.1, -d / 2 + 0.1],
      [-w / 2 + 0.1, d / 2 - 0.1],
      [w / 2 - 0.1, d / 2 - 0.1],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, this.darkWoodMat);
      p.position.set(px, h / 2, pz);
      p.castShadow = true;
      barn.add(p);
    });

    // Pitched roof slopes
    const roofSlopeGeo = this.track(new THREE.BoxGeometry(w + 0.6, 0.14, d * 0.68));
    const frontSlope = new THREE.Mesh(roofSlopeGeo, this.roofMat);
    frontSlope.position.set(0, h + 0.36, -d * 0.26);
    frontSlope.rotation.x = -0.38;
    frontSlope.castShadow = true;
    barn.add(frontSlope);

    const backSlope = new THREE.Mesh(roofSlopeGeo, this.roofMat);
    backSlope.position.set(0, h + 0.36, d * 0.26);
    backSlope.rotation.x = 0.38;
    backSlope.castShadow = true;
    barn.add(backSlope);

    this.group.add(barn);

    // Colliders for back and side walls (so animals/player can walk inside the open shelter)
    this.addOBB(x, z + d / 2 - 0.1, w, 0.34, 0, h);
    this.addOBB(x - w / 2 + 0.1, z, 0.34, d, 0, h);
    this.addOBB(x + w / 2 - 0.1, z, 0.34, d, 0, h);
  }

  private createHayBale(x: number, z: number, rotY: number) {
    const baleGeo = this.track(new THREE.CylinderGeometry(0.42, 0.42, 0.78, 12));
    baleGeo.rotateZ(Math.PI / 2);
    const bale = new THREE.Mesh(baleGeo, this.hayMat);
    bale.position.set(x, 0.42, z);
    bale.rotation.y = rotY;
    bale.castShadow = true;
    bale.receiveShadow = true;
    this.group.add(bale);
    this.addOBB(x, z, 0.85, 0.85, rotY, 0.84);
  }

  private createWaterTrough(x: number, z: number) {
    const trough = new THREE.Group();
    trough.position.set(x, 0, z);

    const baseGeo = this.track(new THREE.BoxGeometry(1.1, 0.42, 2.2));
    const base = new THREE.Mesh(baseGeo, this.darkWoodMat);
    base.position.y = 0.21;
    base.castShadow = true;
    base.receiveShadow = true;
    trough.add(base);

    const waterGeo = this.track(new THREE.PlaneGeometry(0.84, 1.92));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.position.y = 0.43;
    trough.add(water);

    this.group.add(trough);
    this.addOBB(x, z, 1.16, 2.24, 0, 0.45);
  }

  private createCow(id: string, variant: CowVariant, x: number, z: number, rotY: number, idx: number): FarmAnimal {
    const baseMat = variant === 'holstein' ? this.cowWhiteMat : this.cowBrownMat;
    const spotMat = variant === 'holstein' ? this.cowBlackSpotMat : this.cowWhiteMat;

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.25, 1.75, 1);
    shadow.position.y = 0.018;
    root.add(shadow);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Torso
    const torso = new THREE.Mesh(this.cowTorsoGeo, baseMat);
    torso.position.set(0, 0.88, 0);
    torso.scale.set(0.86, 0.96, 1.0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Organic Holstein/Brown spots
    const spotGeo = this.track(new THREE.SphereGeometry(0.24, 10, 8));
    [
      [0.2, 0.96, 0.16, 0.85, 0.72, 1.1],
      [-0.21, 0.92, -0.22, 0.85, 0.78, 1.05],
      [0.05, 1.08, -0.1, 0.95, 0.65, 1.15],
    ].forEach(([sx, sy, sz, scx, scy, scz]) => {
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.set(sx, sy, sz);
      spot.scale.set(scx, scy, scz);
      bodyGroup.add(spot);
    });

    // Udder
    const udderGeo = this.track(new THREE.SphereGeometry(0.13, 10, 8));
    const udder = new THREE.Mesh(udderGeo, this.pinkSnoutMat);
    udder.position.set(0, 0.56, -0.3);
    udder.scale.set(1.0, 0.82, 1.1);
    bodyGroup.add(udder);

    // Neck & Broad Cow Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.98, 0.62);
    bodyGroup.add(headGroup);

    const neckGeo = this.track(new THREE.CylinderGeometry(0.18, 0.25, 0.44, 10));
    const neck = new THREE.Mesh(neckGeo, baseMat);
    neck.position.set(0, 0.04, 0.08);
    neck.rotation.x = 0.55;
    neck.castShadow = true;
    headGroup.add(neck);

    const skullGeo = this.track(new THREE.BoxGeometry(0.32, 0.3, 0.36));
    const skull = new THREE.Mesh(skullGeo, baseMat);
    skull.position.set(0, 0.12, 0.28);
    skull.rotation.x = 0.28;
    skull.castShadow = true;
    headGroup.add(skull);

    const snoutGeo = this.track(new THREE.BoxGeometry(0.28, 0.18, 0.22));
    const snout = new THREE.Mesh(snoutGeo, this.pinkSnoutMat);
    snout.position.set(0, 0.02, 0.46);
    snout.rotation.x = 0.25;
    headGroup.add(snout);

    // Curved Horns & Floppy Ears
    const hornGeo = this.track(new THREE.ConeGeometry(0.036, 0.2, 8));
    const earGeo = this.track(new THREE.BoxGeometry(0.16, 0.07, 0.09));
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(hornGeo, this.hornMat);
      horn.position.set(side * 0.14, 0.28, 0.22);
      horn.rotation.z = -side * 0.65;
      horn.rotation.x = 0.2;
      headGroup.add(horn);

      const ear = new THREE.Mesh(earGeo, spotMat);
      ear.position.set(side * 0.2, 0.17, 0.21);
      ear.rotation.z = -side * 0.24;
      headGroup.add(ear);

      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.03, 8, 8)), this.darkEyeMat);
      eye.position.set(side * 0.155, 0.16, 0.36);
      headGroup.add(eye);
    });

    // Swishing Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.0, -0.74);
    bodyGroup.add(tailGroup);

    const tailStemGeo = this.track(new THREE.CylinderGeometry(0.022, 0.016, 0.56, 6));
    const tailStem = new THREE.Mesh(tailStemGeo, baseMat);
    tailStem.position.set(0, -0.26, -0.04);
    tailStem.rotation.x = 0.14;
    tailGroup.add(tailStem);

    const tailTuft = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.048, 8, 6)), spotMat);
    tailTuft.position.set(0, -0.54, -0.08);
    tailTuft.scale.set(0.85, 1.4, 0.85);
    tailGroup.add(tailTuft);

    // 4 Sturdy Cow Legs
    const legGeo = this.track(new THREE.CylinderGeometry(0.068, 0.052, 0.66, 8));
    const hoofGeo = this.track(new THREE.CylinderGeometry(0.058, 0.064, 0.09, 8));
    const legPositions: [number, number][] = [
      [0.19, 0.43],
      [-0.19, 0.43],
      [0.19, -0.45],
      [-0.19, -0.45],
    ];
    const legs: THREE.Group[] = [];
    legPositions.forEach(([lx, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.68, lz);
      const leg = new THREE.Mesh(legGeo, baseMat);
      leg.position.y = -0.32;
      leg.castShadow = true;
      lp.add(leg);

      const hoof = new THREE.Mesh(hoofGeo, this.hoofMat);
      hoof.position.y = -0.635;
      lp.add(hoof);

      bodyGroup.add(lp);
      legs.push(lp);
    });

    return {
      id,
      kind: 'cow',
      group: root,
      bodyGroup,
      headGroup,
      tailGroup,
      legs,
      pos: new THREE.Vector3(x, 0, z),
      facingAngle: rotY,
      targetX: x,
      targetZ: z,
      bounds: { minX: -6.8, maxX: 6.8, minZ: 46.7, maxZ: 54.6 },
      isMoving: idx % 2 === 0,
      isGrazing: idx % 2 === 1,
      stateTimer: 2.5 + idx * 1.1,
      walkPhase: idx * 1.4,
      idlePhase: idx * 1.8,
      speed: 0.95,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(x, 0, z),
      accumDelta: 0,
    };
  }

  private createSheep(
    id: string,
    variant: SheepVariant,
    x: number,
    z: number,
    rotY: number,
    scale: number,
    idx: number
  ): FarmAnimal {
    const woolMat = variant === 'white' ? this.sheepWoolWhiteMat : this.sheepWoolBrownMat;

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    root.scale.setScalar(scale);

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(0.85, 1.1, 1);
    shadow.position.y = 0.016;
    root.add(shadow);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Puffy clustered wool fleece
    const puffGeo = this.track(new THREE.SphereGeometry(0.24, 10, 8));
    [
      [0, 0.48, 0, 1.05, 0.95, 1.35],
      [0.12, 0.5, 0.1, 0.8, 0.78, 0.85],
      [-0.12, 0.5, -0.1, 0.8, 0.78, 0.85],
      [0.1, 0.47, -0.16, 0.76, 0.75, 0.8],
      [-0.1, 0.47, 0.16, 0.76, 0.75, 0.8],
      [0, 0.56, 0.02, 0.88, 0.74, 1.1],
    ].forEach(([px, py, pz, sx, sy, sz]) => {
      const puff = new THREE.Mesh(puffGeo, woolMat);
      puff.position.set(px, py, pz);
      puff.scale.set(sx, sy, sz);
      puff.castShadow = true;
      puff.receiveShadow = true;
      bodyGroup.add(puff);
    });

    // Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.56, 0.34);
    bodyGroup.add(headGroup);

    const headGeo = this.track(new THREE.SphereGeometry(0.14, 10, 8));
    const head = new THREE.Mesh(headGeo, this.sheepFaceDarkMat);
    head.scale.set(0.85, 0.88, 1.28);
    head.position.set(0, 0.02, 0.08);
    head.castShadow = true;
    headGroup.add(head);

    // Wool crown tuft on sheep forehead
    const crownTuft = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.11, 8, 8)), woolMat);
    crownTuft.position.set(0, 0.1, 0.02);
    headGroup.add(crownTuft);

    // Drooping sheep ears & eyes
    const earGeo = this.track(new THREE.BoxGeometry(0.12, 0.05, 0.06));
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(earGeo, this.sheepFaceDarkMat);
      ear.position.set(side * 0.13, 0.03, 0.04);
      ear.rotation.z = -side * 0.35;
      headGroup.add(ear);

      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.022, 8, 8)), this.cowWhiteMat);
      eye.position.set(side * 0.085, 0.05, 0.17);
      headGroup.add(eye);
    });

    // Fluffy short tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.5, -0.34);
    bodyGroup.add(tailGroup);

    const tail = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.075, 8, 6)), woolMat);
    tail.position.set(0, -0.04, -0.04);
    tailGroup.add(tail);

    // 4 Slender Dark Legs
    const legGeo = this.track(new THREE.CylinderGeometry(0.038, 0.03, 0.34, 8));
    const legs: THREE.Group[] = [];
    [
      [0.12, 0.18],
      [-0.12, 0.18],
      [0.12, -0.18],
      [-0.12, -0.18],
    ].forEach(([lx, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.34, lz);
      const leg = new THREE.Mesh(legGeo, this.sheepFaceDarkMat);
      leg.position.y = -0.17;
      leg.castShadow = true;
      lp.add(leg);
      bodyGroup.add(lp);
      legs.push(lp);
    });

    return {
      id,
      kind: 'sheep',
      group: root,
      bodyGroup,
      headGroup,
      tailGroup,
      legs,
      pos: new THREE.Vector3(x, 0, z),
      facingAngle: rotY,
      targetX: x,
      targetZ: z,
      bounds: { minX: -7.1, maxX: 7.1, minZ: 46.4, maxZ: 54.9 },
      isMoving: idx % 2 === 0,
      isGrazing: idx % 2 === 1,
      stateTimer: 1.8 + idx * 0.85,
      walkPhase: idx * 1.1,
      idlePhase: idx * 1.5,
      speed: 1.15,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(x, 0, z),
      accumDelta: 0,
    };
  }

  private createDog(id: string, variant: DogVariant, x: number, z: number, rotY: number, idx: number): FarmAnimal {
    const coatMat =
      variant === 'golden'
        ? this.dogGoldenMat
        : variant === 'collie'
        ? this.dogCollieBrownMat
        : this.dogBlackMat;
    const accentMat = variant === 'golden' ? this.dogCreamMat : variant === 'collie' ? this.dogCreamMat : this.dogGoldenMat;

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(0.68, 0.96, 1);
    shadow.position.y = 0.016;
    root.add(shadow);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const torso = new THREE.Mesh(this.dogTorsoGeo, coatMat);
    torso.position.set(0, 0.36, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Chest ruff & Collar
    const chest = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.115, 10, 8)), accentMat);
    chest.position.set(0, 0.37, 0.22);
    chest.scale.set(0.9, 1.05, 0.9);
    bodyGroup.add(chest);

    const collar = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.098, 0.018, 6, 12)), this.dogCollarMat);
    collar.position.set(0, 0.46, 0.27);
    collar.rotation.x = Math.PI * 0.38;
    bodyGroup.add(collar);

    // Canine Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.51, 0.31);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.11, 12, 10)), coatMat);
    head.scale.set(0.95, 0.92, 1.05);
    head.castShadow = true;
    headGroup.add(head);

    const snout = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.088, 0.072, 0.13)), accentMat);
    snout.position.set(0, -0.025, 0.115);
    headGroup.add(snout);

    const nose = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.022, 8, 6)), this.darkEyeMat);
    nose.position.set(0, -0.005, 0.182);
    headGroup.add(nose);

    // Pointed shepherd ears & bright eyes
    const earGeo = this.track(new THREE.ConeGeometry(0.038, 0.1, 4));
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(earGeo, coatMat);
      ear.position.set(side * 0.068, 0.105, -0.01);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = -side * 0.18;
      ear.castShadow = true;
      headGroup.add(ear);

      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.018, 8, 8)), this.darkEyeMat);
      eye.position.set(side * 0.052, 0.025, 0.085);
      headGroup.add(eye);
    });

    // Upward Wagging Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.4, -0.31);
    bodyGroup.add(tailGroup);

    const tail = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.028, 0.25, 8)), coatMat);
    tail.position.set(0, 0.1, -0.07);
    tail.rotation.x = -0.62;
    tail.castShadow = true;
    tailGroup.add(tail);

    // 4 Articulated Legs
    const legGeo = this.track(new THREE.CylinderGeometry(0.032, 0.024, 0.28, 8));
    const pawGeo = this.track(new THREE.SphereGeometry(0.028, 8, 6));
    const legs: THREE.Group[] = [];
    [
      [0.082, 0.21],
      [-0.082, 0.21],
      [0.082, -0.21],
      [-0.082, -0.21],
    ].forEach(([lx, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.29, lz);
      const leg = new THREE.Mesh(legGeo, coatMat);
      leg.position.y = -0.14;
      leg.castShadow = true;
      lp.add(leg);

      const paw = new THREE.Mesh(pawGeo, accentMat);
      paw.position.set(0, -0.275, 0.015);
      paw.scale.set(0.95, 0.7, 1.25);
      lp.add(paw);

      bodyGroup.add(lp);
      legs.push(lp);
    });

    return {
      id,
      kind: 'dog',
      group: root,
      bodyGroup,
      headGroup,
      tailGroup,
      legs,
      pos: new THREE.Vector3(x, 0, z),
      facingAngle: rotY,
      targetX: x,
      targetZ: z,
      bounds:
        id === 'dog_1'
          ? { minX: -6.4, maxX: 6.4, minZ: 41.8, maxZ: 44.65 }
          : { minX: -7.1, maxX: 7.1, minZ: 46.3, maxZ: 54.85 },
      isMoving: idx !== 2,
      isGrazing: false,
      stateTimer: 2.0 + idx * 0.9,
      walkPhase: idx * 1.3,
      idlePhase: idx * 2.1,
      speed: 2.15,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(x, 0, z),
      accumDelta: 0,
    };
  }

  private spawnFarmAnimals() {
    // 4 Cows inside the pasture
    const cowConfigs: [string, CowVariant, number, number, number][] = [
      ['cow_1', 'holstein', -3.6, 49.0, 0.6],
      ['cow_2', 'brown', 2.6, 51.8, -1.2],
      ['cow_3', 'holstein', -0.8, 52.8, 2.2],
      ['cow_4', 'holstein', 4.1, 48.8, -2.5],
    ];
    cowConfigs.forEach(([id, v, x, z, r], idx) => {
      const cow = this.createCow(id, v, x, z, r, idx);
      this.pickTarget(cow);
      this.animals.push(cow);
      this.group.add(cow.group);
    });

    // 5 Sheep (4 white + 1 brown, including 1 smaller lamb)
    const sheepConfigs: [string, SheepVariant, number, number, number, number][] = [
      ['sheep_1', 'white', 1.4, 48.2, 1.1, 1.0],
      ['sheep_2', 'white', -4.8, 51.2, -0.7, 0.96],
      ['sheep_3', 'brown', 3.4, 53.6, 2.8, 1.02],
      ['sheep_4', 'white', 0.4, 50.4, -2.1, 0.98],
      ['sheep_5', 'white', 1.0, 49.4, 0.4, 0.74],
    ];
    sheepConfigs.forEach(([id, v, x, z, r, sc], idx) => {
      const sheep = this.createSheep(id, v, x, z, r, sc, idx);
      this.pickTarget(sheep);
      this.animals.push(sheep);
      this.group.add(sheep.group);
    });

    // 3 Farm Dogs (2 patrolling around gate & pasture, 1 guarding by the barn)
    const dogConfigs: [string, DogVariant, number, number, number][] = [
      ['dog_1', 'golden', -1.8, 44.0, 0.4],
      ['dog_2', 'collie', 2.4, 46.8, -1.8],
      ['dog_3', 'blacktan', -2.6, 51.4, 0.15],
    ];
    dogConfigs.forEach(([id, v, x, z, r], idx) => {
      const dog = this.createDog(id, v, x, z, r, idx);
      this.pickTarget(dog);
      this.animals.push(dog);
      this.group.add(dog.group);
    });
  }

  private isPointBlockedForAnimal(
    px: number,
    pz: number,
    selfIdx: number,
    a: FarmAnimal,
    r: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean
  ): boolean {
    if (
      px < a.bounds.minX ||
      px > a.bounds.maxX ||
      pz < a.bounds.minZ ||
      pz > a.bounds.maxZ
    ) {
      return true;
    }
    if (isStaticBlocked && isStaticBlocked(px, pz, r + 0.08, false)) {
      return true;
    }
    for (let j = 0; j < this.animals.length; j++) {
      if (j === selfIdx) continue;
      const other = this.animals[j];
      const minD = r + getFarmAnimalRadius(other.kind) + 0.16;
      const dx = px - other.pos.x;
      const dz = pz - other.pos.z;
      if (dx * dx + dz * dz < minD * minD) return true;
    }
    return false;
  }

  private pickTarget(
    a: FarmAnimal,
    selfIdx: number = -1,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean
  ) {
    const { minX, maxX, minZ, maxZ } = a.bounds;
    const r = getFarmAnimalRadius(a.kind);
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = minX + Math.random() * (maxX - minX);
      const tz = minZ + Math.random() * (maxZ - minZ);
      if (!this.isPointBlockedForAnimal(tx, tz, selfIdx, a, r, isStaticBlocked)) {
        a.targetX = tx;
        a.targetZ = tz;
        return;
      }
    }
    a.targetX = minX + Math.random() * (maxX - minX);
    a.targetZ = minZ + Math.random() * (maxZ - minZ);
  }

  private chooseSteerAngle(
    a: FarmAnimal,
    selfIdx: number,
    desiredAngle: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean
  ): number {
    const r = getFarmAnimalRadius(a.kind);
    const probeDist = a.kind === 'cow' ? 1.15 : 0.9;
    const offsets = [0, 0.5, -0.5, 1.0, -1.0, 1.55, -1.55, 2.2, -2.2];
    for (let i = 0; i < offsets.length; i++) {
      const ang = desiredAngle + offsets[i];
      const px = a.pos.x + Math.sin(ang) * probeDist;
      const pz = a.pos.z + Math.cos(ang) * probeDist;
      if (!this.isPointBlockedForAnimal(px, pz, selfIdx, a, r, isStaticBlocked)) {
        return ang;
      }
    }
    return desiredAngle;
  }

  private resolveAnimalBarriers(
    a: FarmAnimal,
    colRadius: number,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary?: (pos: THREE.Vector3) => void
  ) {
    resolveCollision(a.pos, colRadius);

    // Cows have an elongated body & head/horns; also resolve forward snout probe so
    // their head never clips through fences, barn walls, or the water trough.
    if (a.kind === 'cow') {
      const sinF = Math.sin(a.facingAngle);
      const cosF = Math.cos(a.facingAngle);
      const snoutOffset = 0.42;
      _snoutProbe.set(a.pos.x + sinF * snoutOffset, a.pos.y, a.pos.z + cosF * snoutOffset);
      const preX = _snoutProbe.x;
      const preZ = _snoutProbe.z;
      resolveCollision(_snoutProbe, 0.46);
      const pushX = _snoutProbe.x - preX;
      const pushZ = _snoutProbe.z - preZ;
      if (pushX !== 0 || pushZ !== 0) {
        a.pos.x += pushX;
        a.pos.z += pushZ;
        resolveCollision(a.pos, colRadius);
      }
    }

    if (enforceBoundary) {
      enforceBoundary(a.pos);
    }

    a.pos.x = Math.max(a.bounds.minX, Math.min(a.bounds.maxX, a.pos.x));
    a.pos.z = Math.max(a.bounds.minZ, Math.min(a.bounds.maxZ, a.pos.z));
  }

  public update(
    delta: number,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    sultanPos: THREE.Vector3,
    isMounted: boolean,
    enforceBoundary?: (pos: THREE.Vector3) => void,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    horses?: { pos: THREE.Vector3; facingAngle: number; hasCarriage: boolean; group?: THREE.Group }[],
    citizens?: { pos: THREE.Vector3; group?: THREE.Group }[],
    mountedHorseHasCarriage?: boolean
  ) {
    this.updateTickCount++;
    if (this.movedFlags.length < this.animals.length) {
      this.movedFlags = new Uint8Array(this.animals.length);
    }
    this.movedFlags.fill(0);

    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      a.accumDelta += delta;

      const sdx = a.pos.x - sultanPos.x;
      const sdz = a.pos.z - sultanPos.z;
      const distToSultanSq = sdx * sdx + sdz * sdz;
      const stride = distToSultanSq > 42 * 42 ? 4 : distToSultanSq > 24 * 24 ? 2 : 1;

      if (stride > 1 && (this.updateTickCount + i) % stride !== 0 && a.accumDelta < 0.16) {
        continue;
      }

      const dt = Math.min(a.accumDelta, 0.2);
      a.accumDelta = 0;

      a.idlePhase += dt;
      a.stateTimer -= dt;

      if (a.stateTimer <= 0) {
        if (a.isMoving) {
          a.isMoving = false;
          a.isGrazing = a.kind !== 'dog';
          a.stateTimer = a.kind === 'dog' ? 2.0 + Math.random() * 2.5 : 3.2 + Math.random() * 3.8;
        } else {
          this.pickTarget(a, i, isStaticBlocked);
          a.isMoving = true;
          a.isGrazing = false;
          a.stuckTimer = 0;
          a.lastProgressPos.copy(a.pos);
          a.stateTimer = a.kind === 'dog' ? 4.2 + Math.random() * 3.2 : 3.5 + Math.random() * 4.0;
        }
      }

      let activeSpeed = 0;
      const colRadius = getFarmAnimalRadius(a.kind);

      if (a.isMoving) {
        const dx = a.targetX - a.pos.x;
        const dz = a.targetZ - a.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.45) {
          a.isMoving = false;
          a.isGrazing = a.kind !== 'dog';
          a.stateTimer = 2.5 + Math.random() * 3.5;
        } else {
          const desiredAngle = this.chooseSteerAngle(a, i, Math.atan2(dx, dz), isStaticBlocked);
          let diff = desiredAngle - a.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.facingAngle += diff * Math.min(1.0, dt * (a.kind === 'dog' ? 7.0 : 4.0));

          activeSpeed = a.speed;
          const totalMove = Math.min(dist, activeSpeed * dt);
          // Sub-step movement (max ~0.06m per step) so thin fences can never be tunneled
          const subSteps = Math.max(1, Math.ceil(totalMove / 0.06));
          const stepLen = totalMove / subSteps;
          const dirX = Math.sin(a.facingAngle);
          const dirZ = Math.cos(a.facingAngle);

          for (let s = 0; s < subSteps; s++) {
            a.pos.x += dirX * stepLen;
            a.pos.z += dirZ * stepLen;
            this.resolveAnimalBarriers(a, colRadius, resolveCollision, enforceBoundary);
          }

          if (a.pos.distanceToSquared(a.lastProgressPos) > 0.04) {
            a.lastProgressPos.copy(a.pos);
            a.stuckTimer = 0;
          } else {
            a.stuckTimer += dt;
            if (a.stuckTimer > 0.9) {
              this.pickTarget(a, i, isStaticBlocked);
              a.stuckTimer = 0;
            }
          }
        }
      }

      // Animate legs, head grazing, and tail wag/swish
      if (activeSpeed > 0.05) {
        const freq = a.kind === 'cow' ? 4.8 : a.kind === 'sheep' ? 6.5 : 7.8;
        a.walkPhase += dt * activeSpeed * freq;
        const amp = a.kind === 'cow' ? 0.38 : 0.48;
        const s1 = Math.sin(a.walkPhase) * amp;
        const s2 = Math.sin(a.walkPhase + Math.PI) * amp;

        a.legs[0].rotation.x = s1;
        a.legs[1].rotation.x = s2;
        a.legs[2].rotation.x = s2 * 0.9;
        a.legs[3].rotation.x = s1 * 0.9;

        a.bodyGroup.position.y = Math.abs(Math.sin(a.walkPhase)) * (a.kind === 'dog' ? 0.024 : 0.016);
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, 0.05, 6, dt);
        a.headGroup.rotation.y = Math.sin(a.idlePhase * 1.4) * 0.08;
      } else {
        for (let l = 0; l < 4; l++) {
          a.legs[l].rotation.x = THREE.MathUtils.damp(a.legs[l].rotation.x, 0, 8, dt);
        }
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, 0, 8, dt);

        const targetHeadPitch = a.isGrazing
          ? (a.kind === 'cow' ? 0.56 : 0.62) + Math.sin(a.idlePhase * 3.2) * 0.06
          : Math.sin(a.idlePhase * 1.1) * 0.06;
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, targetHeadPitch, 5, dt);
        a.headGroup.rotation.y = a.isGrazing
          ? Math.sin(a.idlePhase * 1.3) * 0.1
          : Math.sin(a.idlePhase * 0.9) * 0.24;
      }

      // Tail animation (dogs wag fast, cows & sheep swish calmly)
      if (a.kind === 'dog') {
        a.tailGroup.rotation.z = Math.sin(a.idlePhase * 9.5) * 0.42;
      } else {
        a.tailGroup.rotation.z = Math.sin(a.idlePhase * 2.4) * 0.22;
      }

      a.group.position.set(a.pos.x, 0, a.pos.z);
      a.group.rotation.y = a.facingAngle;
    }

    // Un-throttled pairwise separation across ALL farm animals every frame (2 passes for crisp spacing)
    const count = this.animals.length;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < count; i++) {
        const a = this.animals[i];
        const rA = getFarmAnimalRadius(a.kind);
        const mA = getAnimalMass(a.kind);

        for (let j = i + 1; j < count; j++) {
          const b = this.animals[j];
          const rB = getFarmAnimalRadius(b.kind);
          const mB = getAnimalMass(b.kind);

          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const minR = rA + rB + 0.08;
          const dSq = dx * dx + dz * dz;

          if (dSq < minR * minR) {
            let nx = 1;
            let nz = 0;
            let dist = 0;
            if (dSq > 0.0001) {
              dist = Math.sqrt(dSq);
              nx = dx / dist;
              nz = dz / dist;
            }
            const overlap = minR - dist;
            const totalMass = mA + mB;
            const shareA = mB / totalMass;
            const shareB = mA / totalMass;

            a.pos.x -= nx * overlap * shareA;
            a.pos.z -= nz * overlap * shareA;
            b.pos.x += nx * overlap * shareB;
            b.pos.z += nz * overlap * shareB;

            this.movedFlags[i] = 1;
            this.movedFlags[j] = 1;
          }
        }
      }
    }

    // Separate farm animals from Sultan (on foot OR mounted), Horses/Carriages, and Citizens
    const sultanRadius = isMounted ? (mountedHorseHasCarriage ? 1.2 : 0.92) : 0.48;
    for (let i = 0; i < count; i++) {
      const a = this.animals[i];
      const rA = getFarmAnimalRadius(a.kind);

      // Sultan separation
      const sdx = a.pos.x - sultanPos.x;
      const sdz = a.pos.z - sultanPos.z;
      const minSultan = rA + sultanRadius;
      const sDistSq = sdx * sdx + sdz * sdz;
      if (sDistSq < minSultan * minSultan && sDistSq > 0.0001) {
        const d = Math.sqrt(sDistSq);
        const push = minSultan / d;
        a.pos.x = sultanPos.x + sdx * push;
        a.pos.z = sultanPos.z + sdz * push;
        this.movedFlags[i] = 1;
      }

      // Visible horses & carriages separation
      if (horses) {
        for (let hIdx = 0; hIdx < horses.length; hIdx++) {
          const h = horses[hIdx];
          if (h.group && !h.group.visible) continue;

          const hdx = a.pos.x - h.pos.x;
          const hdz = a.pos.z - h.pos.z;
          const minH = rA + 0.92;
          const hDistSq = hdx * hdx + hdz * hdz;
          if (hDistSq < minH * minH && hDistSq > 0.0001) {
            const d = Math.sqrt(hDistSq);
            const push = minH / d;
            a.pos.x = h.pos.x + hdx * push;
            a.pos.z = h.pos.z + hdz * push;
            this.movedFlags[i] = 1;
          }

          if (h.hasCarriage) {
            const cx = h.pos.x - Math.sin(h.facingAngle) * 2.55;
            const cz = h.pos.z - Math.cos(h.facingAngle) * 2.55;
            const cdx = a.pos.x - cx;
            const cdz = a.pos.z - cz;
            const minC = rA + 1.08;
            const cDistSq = cdx * cdx + cdz * cdz;
            if (cDistSq < minC * minC && cDistSq > 0.0001) {
              const d = Math.sqrt(cDistSq);
              const push = minC / d;
              a.pos.x = cx + cdx * push;
              a.pos.z = cz + cdz * push;
              this.movedFlags[i] = 1;
            }
          }
        }
      }

      // Visible citizens separation
      if (citizens) {
        for (let cIdx = 0; cIdx < citizens.length; cIdx++) {
          const c = citizens[cIdx];
          if (c.group && !c.group.visible) continue;
          const cdx = a.pos.x - c.pos.x;
          const cdz = a.pos.z - c.pos.z;
          const minCit = rA + 0.44;
          const cDistSq = cdx * cdx + cdz * cdz;
          if (cDistSq < minCit * minCit && cDistSq > 0.0001) {
            const d = Math.sqrt(cDistSq);
            const push = minCit / d;
            a.pos.x = c.pos.x + cdx * push;
            a.pos.z = c.pos.z + cdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (this.movedFlags[i]) {
        this.resolveAnimalBarriers(a, rA, resolveCollision, enforceBoundary);
        a.group.position.set(a.pos.x, 0, a.pos.z);
      }
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
