import * as THREE from 'three';
import { createRadialShadowTexture } from './textures';

export type CatCoat = 'white' | 'brown' | 'black';

interface CatSpawnConfig {
  id: string;
  coat: CatCoat;
  x: number;
  z: number;
  rotY: number;
  scale: number;
  isRoamer: boolean;
  roamPoints?: [number, number][];
}

export interface CatEntity {
  id: string;
  coat: CatCoat;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  legs: THREE.Group[]; // [frontL, frontR, backL, backR]
  pos: THREE.Vector3;
  facingAngle: number;
  scale: number;
  isRoamer: boolean;
  roamPoints: [number, number][];
  roamIdx: number;
  targetX: number;
  targetZ: number;
  homeX: number;
  homeZ: number;
  isMoving: boolean;
  stateTimer: number;
  walkPhase: number;
  idlePhase: number;
  stuckTimer: number;
  lastProgressPos: THREE.Vector3;
  speed: number;
  accumDelta: number;
}

const _lastPosCheck = new THREE.Vector3();

export class CatManager {
  public group: THREE.Group;
  public cats: CatEntity[] = [];
  private updateTickCount: number = 0;
  private movedFlags: Uint8Array = new Uint8Array(16);

  private disposables: { dispose: () => void }[] = [];

  // Shared materials
  private coatMats!: Record<CatCoat, THREE.MeshStandardMaterial>;
  private accentMats!: Record<CatCoat, THREE.MeshStandardMaterial>;
  private eyeMats!: Record<CatCoat, THREE.MeshStandardMaterial>;
  private pinkMat!: THREE.MeshStandardMaterial;
  private pupilMat!: THREE.MeshStandardMaterial;
  private whiskerMat!: THREE.MeshStandardMaterial;
  private shadowMat!: THREE.MeshBasicMaterial;

  // Shared geometries
  private shadowGeo!: THREE.PlaneGeometry;
  private torsoGeo!: THREE.LatheGeometry;
  private chestGeo!: THREE.SphereGeometry;
  private headGeo!: THREE.SphereGeometry;
  private muzzleGeo!: THREE.SphereGeometry;
  private noseGeo!: THREE.SphereGeometry;
  private earGeo!: THREE.ConeGeometry;
  private innerEarGeo!: THREE.ConeGeometry;
  private eyeGeo!: THREE.SphereGeometry;
  private pupilGeo!: THREE.BoxGeometry;
  private whiskerGeo!: THREE.BoxGeometry;
  private legGeo!: THREE.CylinderGeometry;
  private pawGeo!: THREE.SphereGeometry;
  private tailGeo!: THREE.TubeGeometry;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'KingdomCats';

    this.initSharedAssets();
    this.spawnCats();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private initSharedAssets() {
    this.coatMats = {
      white: this.track(
        new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.72, metalness: 0.02 })
      ),
      brown: this.track(
        new THREE.MeshStandardMaterial({ color: 0x8b522c, roughness: 0.76, metalness: 0.03 })
      ),
      black: this.track(
        new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.68, metalness: 0.06 })
      ),
    };

    // Subtle chest/paw markings for natural contrast
    this.accentMats = {
      white: this.track(
        new THREE.MeshStandardMaterial({ color: 0xeae2d4, roughness: 0.78, metalness: 0.02 })
      ),
      brown: this.track(
        new THREE.MeshStandardMaterial({ color: 0xe6d6be, roughness: 0.78, metalness: 0.02 })
      ),
      black: this.track(
        new THREE.MeshStandardMaterial({ color: 0xdcd8cf, roughness: 0.76, metalness: 0.02 })
      ),
    };

    this.eyeMats = {
      white: this.track(
        new THREE.MeshStandardMaterial({ color: 0x48b878, roughness: 0.18, metalness: 0.05 })
      ),
      brown: this.track(
        new THREE.MeshStandardMaterial({ color: 0xe0a124, roughness: 0.18, metalness: 0.05 })
      ),
      black: this.track(
        new THREE.MeshStandardMaterial({ color: 0x62cf5e, roughness: 0.16, metalness: 0.05 })
      ),
    };

    this.pinkMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xec9ca4, roughness: 0.65, metalness: 0.02 })
    );
    this.pupilMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.25 })
    );
    this.whiskerMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.85 })
    );

    const shadowTex = this.track(createRadialShadowTexture());
    this.shadowMat = this.track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    this.shadowGeo = this.track(new THREE.PlaneGeometry(0.62, 0.74));

    // Sleek sculpted feline body
    const torsoPts = [
      new THREE.Vector2(0.008, -0.23),
      new THREE.Vector2(0.068, -0.19),
      new THREE.Vector2(0.088, -0.11),
      new THREE.Vector2(0.078, 0.0),
      new THREE.Vector2(0.082, 0.11),
      new THREE.Vector2(0.068, 0.19),
      new THREE.Vector2(0.008, 0.22),
    ];
    this.torsoGeo = this.track(new THREE.LatheGeometry(torsoPts, 12));
    this.torsoGeo.rotateX(Math.PI / 2);

    this.chestGeo = this.track(new THREE.SphereGeometry(0.066, 10, 8));
    this.headGeo = this.track(new THREE.SphereGeometry(0.084, 14, 12));
    this.muzzleGeo = this.track(new THREE.SphereGeometry(0.036, 10, 8));
    this.noseGeo = this.track(new THREE.SphereGeometry(0.013, 8, 6));
    this.earGeo = this.track(new THREE.ConeGeometry(0.032, 0.078, 4));
    this.innerEarGeo = this.track(new THREE.ConeGeometry(0.019, 0.052, 4));
    this.eyeGeo = this.track(new THREE.SphereGeometry(0.016, 8, 8));
    this.pupilGeo = this.track(new THREE.BoxGeometry(0.005, 0.018, 0.008));
    this.whiskerGeo = this.track(new THREE.BoxGeometry(0.068, 0.003, 0.003));
    this.legGeo = this.track(new THREE.CylinderGeometry(0.022, 0.017, 0.145, 8));
    this.pawGeo = this.track(new THREE.SphereGeometry(0.021, 8, 6));

    // Graceful curved feline tail
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.055, -0.075),
      new THREE.Vector3(0, 0.155, -0.115),
      new THREE.Vector3(0, 0.235, -0.085),
      new THREE.Vector3(0, 0.275, -0.045),
    ]);
    this.tailGeo = this.track(new THREE.TubeGeometry(tailCurve, 12, 0.015, 7, false));
  }

  private spawnCats() {
    // 9 cats total (3 white, 3 brown, 3 black): a few roam around the village & plaza, others lounge nearby
    const configs: CatSpawnConfig[] = [
      // Roaming cats (4 roamers across white, brown, and black)
      {
        id: 'cat_roam_white',
        coat: 'white',
        x: -3.2,
        z: -3.4,
        rotY: 0.8,
        scale: 1.0,
        isRoamer: true,
        roamPoints: [
          [-3.2, -3.4],
          [3.6, -5.8],
          [4.2, -11.5],
          [-4.5, -10.8],
          [-6.2, -2.5],
        ],
      },
      {
        id: 'cat_roam_brown',
        coat: 'brown',
        x: 4.5,
        z: -4.2,
        rotY: -1.1,
        scale: 1.04,
        isRoamer: true,
        roamPoints: [
          [4.5, -4.2],
          [8.5, 2.2],
          [2.4, 7.6],
          [-5.2, 5.4],
          [-1.5, -2.2],
        ],
      },
      {
        id: 'cat_roam_black',
        coat: 'black',
        x: -2.4,
        z: 4.4,
        rotY: 2.1,
        scale: 0.98,
        isRoamer: true,
        roamPoints: [
          [-2.4, 4.4],
          [-11.0, 2.5],
          [-14.5, -6.0],
          [-8.0, -10.0],
          [0.5, -1.8],
        ],
      },
      {
        id: 'cat_roam_white_2',
        coat: 'white',
        x: 11.5,
        z: -10.2,
        rotY: -2.4,
        scale: 0.92,
        isRoamer: true,
        roamPoints: [
          [11.5, -10.2],
          [14.0, 1.5],
          [6.5, 4.0],
          [3.5, -8.5],
        ],
      },

      // Cozy village cats that mostly sit/rest and take short gentle steps near their spot
      { id: 'cat_rest_black_1', coat: 'black', x: -5.8, z: -6.5, rotY: 0.5, scale: 1.0, isRoamer: false },
      { id: 'cat_rest_brown_1', coat: 'brown', x: 6.4, z: -13.0, rotY: -0.9, scale: 0.96, isRoamer: false },
      { id: 'cat_rest_white_1', coat: 'white', x: -13.5, z: -3.2, rotY: 1.4, scale: 1.02, isRoamer: false },
      { id: 'cat_rest_brown_2', coat: 'brown', x: 13.8, z: 10.5, rotY: 2.6, scale: 0.94, isRoamer: false },
      { id: 'cat_rest_black_2', coat: 'black', x: -15.2, z: 12.2, rotY: -1.7, scale: 1.05, isRoamer: false },
    ];

    configs.forEach((cfg, idx) => {
      const entity = this.createCatEntity(cfg, idx);
      this.cats.push(entity);
      this.group.add(entity.group);
    });
  }

  private createCatEntity(cfg: CatSpawnConfig, idx: number): CatEntity {
    const coatMat = this.coatMats[cfg.coat];
    const accentMat = this.accentMats[cfg.coat];
    const eyeMat = this.eyeMats[cfg.coat];

    const root = new THREE.Group();
    root.position.set(cfg.x, 0, cfg.z);
    root.rotation.y = cfg.rotY;
    root.scale.setScalar(cfg.scale);

    // Contact shadow
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    root.add(shadow);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // 1. Torso & Chest
    const torso = new THREE.Mesh(this.torsoGeo, coatMat);
    torso.position.set(0, 0.21, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    const chest = new THREE.Mesh(this.chestGeo, cfg.coat === 'white' ? coatMat : accentMat);
    chest.position.set(0, 0.205, 0.16);
    chest.scale.set(0.86, 0.92, 0.85);
    chest.castShadow = true;
    bodyGroup.add(chest);

    // 2. Head Group (head, muzzle, nose, ears, eyes, whiskers)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.295, 0.215);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(this.headGeo, coatMat);
    head.scale.set(1.08, 0.96, 0.98);
    head.castShadow = true;
    headGroup.add(head);

    const muzzle = new THREE.Mesh(this.muzzleGeo, cfg.coat === 'black' ? coatMat : accentMat);
    muzzle.position.set(0, -0.02, 0.068);
    muzzle.scale.set(1.15, 0.82, 0.9);
    headGroup.add(muzzle);

    const nose = new THREE.Mesh(this.noseGeo, this.pinkMat);
    nose.position.set(0, -0.008, 0.102);
    headGroup.add(nose);

    // Pointed triangular ears
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(this.earGeo, coatMat);
      ear.position.set(side * 0.052, 0.088, 0.008);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = -side * 0.22;
      ear.castShadow = true;
      headGroup.add(ear);

      const innerEar = new THREE.Mesh(this.innerEarGeo, this.pinkMat);
      innerEar.position.set(side * 0.052, 0.083, 0.021);
      innerEar.rotation.y = Math.PI / 4;
      innerEar.rotation.z = -side * 0.22;
      headGroup.add(innerEar);

      // Expressive cat eyes + vertical pupil slits
      const eye = new THREE.Mesh(this.eyeGeo, eyeMat);
      eye.position.set(side * 0.036, 0.012, 0.068);
      eye.scale.set(1.0, 1.05, 0.72);
      headGroup.add(eye);

      const pupil = new THREE.Mesh(this.pupilGeo, this.pupilMat);
      pupil.position.set(side * 0.037, 0.012, 0.078);
      headGroup.add(pupil);

      // Delicate whiskers
      for (let w = -1; w <= 1; w += 2) {
        const whisker = new THREE.Mesh(this.whiskerGeo, this.whiskerMat);
        whisker.position.set(side * 0.058, -0.02 + w * 0.008, 0.076);
        whisker.rotation.z = side * w * 0.12;
        whisker.rotation.y = -side * 0.2;
        headGroup.add(whisker);
      }
    });

    // 3. Curved Articulated Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.23, -0.2);
    bodyGroup.add(tailGroup);

    const tail = new THREE.Mesh(this.tailGeo, coatMat);
    tail.castShadow = true;
    tailGroup.add(tail);

    // 4. Four Articulated Legs + Paws
    const legSpecs: [number, number][] = [
      [0.052, 0.135],  // frontL
      [-0.052, 0.135], // frontR
      [0.052, -0.135], // backL
      [-0.052, -0.135],// backR
    ];
    const legs: THREE.Group[] = [];
    legSpecs.forEach(([lx, lz]) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, 0.165, lz);

      const limb = new THREE.Mesh(this.legGeo, coatMat);
      limb.position.y = -0.075;
      limb.castShadow = true;
      legPivot.add(limb);

      const pawMat = cfg.coat === 'white' ? coatMat : accentMat;
      const paw = new THREE.Mesh(this.pawGeo, pawMat);
      paw.position.set(0, -0.148, 0.014);
      paw.scale.set(0.95, 0.75, 1.25);
      paw.castShadow = true;
      legPivot.add(paw);

      bodyGroup.add(legPivot);
      legs.push(legPivot);
    });

    const roamPoints = cfg.roamPoints || [[cfg.x, cfg.z]];
    const nextPt = roamPoints.length > 1 ? roamPoints[1] : [cfg.x, cfg.z];

    return {
      id: cfg.id,
      coat: cfg.coat,
      group: root,
      bodyGroup,
      headGroup,
      tailGroup,
      legs,
      pos: new THREE.Vector3(cfg.x, 0, cfg.z),
      facingAngle: cfg.rotY,
      scale: cfg.scale,
      isRoamer: cfg.isRoamer,
      roamPoints,
      roamIdx: roamPoints.length > 1 ? 1 : 0,
      targetX: nextPt[0],
      targetZ: nextPt[1],
      homeX: cfg.x,
      homeZ: cfg.z,
      isMoving: cfg.isRoamer,
      stateTimer: cfg.isRoamer ? 4.0 + idx * 0.9 : 2.5 + idx * 1.1,
      walkPhase: idx * 1.3,
      idlePhase: idx * 1.7,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(cfg.x, 0, cfg.z),
      speed: cfg.isRoamer ? 1.25 + (idx % 2) * 0.2 : 0.9,
      accumDelta: 0,
    };
  }

  private getCatRadius(cat: CatEntity): number {
    return 0.28 * cat.scale;
  }

  private isCatPointBlocked(
    px: number,
    pz: number,
    selfIdx: number,
    r: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    horses?: { pos: THREE.Vector3; group?: THREE.Group }[]
  ): boolean {
    if (isStaticBlocked && isStaticBlocked(px, pz, r + 0.06, false)) {
      return true;
    }
    for (let j = 0; j < this.cats.length; j++) {
      if (j === selfIdx) continue;
      const other = this.cats[j];
      const minD = r + this.getCatRadius(other) + 0.1;
      const dx = px - other.pos.x;
      const dz = pz - other.pos.z;
      if (dx * dx + dz * dz < minD * minD) return true;
    }
    if (farmAnimals) {
      for (let k = 0; k < farmAnimals.length; k++) {
        const fa = farmAnimals[k];
        const faR = fa.kind === 'cow' ? 0.82 : fa.kind === 'sheep' ? 0.48 : 0.42;
        const minD = r + faR + 0.1;
        const dx = px - fa.pos.x;
        const dz = pz - fa.pos.z;
        if (dx * dx + dz * dz < minD * minD) return true;
      }
    }
    if (horses) {
      for (let h = 0; h < horses.length; h++) {
        const ho = horses[h];
        if (ho.group && !ho.group.visible) continue;
        const minD = r + 0.95;
        const dx = px - ho.pos.x;
        const dz = pz - ho.pos.z;
        if (dx * dx + dz * dz < minD * minD) return true;
      }
    }
    return false;
  }

  private pickNextTarget(
    cat: CatEntity,
    selfIdx: number = -1,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean
  ) {
    const r = this.getCatRadius(cat);
    if (cat.isRoamer && cat.roamPoints.length > 1) {
      cat.roamIdx = (cat.roamIdx + 1) % cat.roamPoints.length;
      const [nx, nz] = cat.roamPoints[cat.roamIdx];
      for (let attempt = 0; attempt < 6; attempt++) {
        const tx = nx + (Math.random() - 0.5) * 1.8;
        const tz = nz + (Math.random() - 0.5) * 1.8;
        if (!isStaticBlocked || !isStaticBlocked(tx, tz, r + 0.12, false)) {
          cat.targetX = tx;
          cat.targetZ = tz;
          return;
        }
      }
      cat.targetX = nx;
      cat.targetZ = nz;
    } else {
      for (let attempt = 0; attempt < 6; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 0.9 + Math.random() * 1.8;
        const tx = cat.homeX + Math.cos(ang) * dist;
        const tz = cat.homeZ + Math.sin(ang) * dist;
        if (!isStaticBlocked || !isStaticBlocked(tx, tz, r + 0.12, false)) {
          cat.targetX = tx;
          cat.targetZ = tz;
          return;
        }
      }
      cat.targetX = cat.homeX;
      cat.targetZ = cat.homeZ;
    }
  }

  private chooseSteerAngle(
    cat: CatEntity,
    selfIdx: number,
    desiredAngle: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    horses?: { pos: THREE.Vector3; group?: THREE.Group }[]
  ): number {
    const r = this.getCatRadius(cat);
    const probeDist = 0.72;
    const offsets = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6];
    for (let i = 0; i < offsets.length; i++) {
      const ang = desiredAngle + offsets[i];
      const px = cat.pos.x + Math.sin(ang) * probeDist;
      const pz = cat.pos.z + Math.cos(ang) * probeDist;
      if (!this.isCatPointBlocked(px, pz, selfIdx, r, isStaticBlocked, farmAnimals, horses)) {
        return ang;
      }
    }
    return desiredAngle;
  }

  public update(
    delta: number,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    sultanPos: THREE.Vector3,
    isMounted: boolean,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    horses?: { pos: THREE.Vector3; facingAngle: number; hasCarriage: boolean; group?: THREE.Group }[],
    citizens?: { pos: THREE.Vector3; group?: THREE.Group }[],
    mountedHorseHasCarriage?: boolean
  ) {
    this.updateTickCount++;
    if (this.movedFlags.length < this.cats.length) {
      this.movedFlags = new Uint8Array(this.cats.length);
    }
    this.movedFlags.fill(0);

    for (let i = 0; i < this.cats.length; i++) {
      const cat = this.cats[i];
      cat.accumDelta += delta;

      const sdx = cat.pos.x - sultanPos.x;
      const sdz = cat.pos.z - sultanPos.z;
      const distToSultanSq = sdx * sdx + sdz * sdz;
      const stride = distToSultanSq > 42 * 42 ? 4 : distToSultanSq > 24 * 24 ? 2 : 1;

      if (stride > 1 && (this.updateTickCount + i) % stride !== 0 && cat.accumDelta < 0.16) {
        continue;
      }

      const dt = Math.min(cat.accumDelta, 0.2);
      cat.accumDelta = 0;

      cat.idlePhase += dt;
      cat.stateTimer -= dt;

      if (cat.stateTimer <= 0) {
        if (cat.isMoving) {
          // Pause to sit/look around
          cat.isMoving = false;
          cat.stateTimer = cat.isRoamer ? 1.4 + Math.random() * 2.2 : 4.5 + Math.random() * 5.0;
        } else {
          // Start roaming to next point
          this.pickNextTarget(cat, i, isStaticBlocked);
          cat.isMoving = true;
          cat.stuckTimer = 0;
          cat.lastProgressPos.copy(cat.pos);
          cat.stateTimer = cat.isRoamer ? 6.0 + Math.random() * 4.5 : 1.8 + Math.random() * 1.6;
        }
      }

      let activeSpeed = 0;
      const catRadius = this.getCatRadius(cat);

      if (cat.isMoving) {
        const dx = cat.targetX - cat.pos.x;
        const dz = cat.targetZ - cat.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.35) {
          cat.isMoving = false;
          cat.stateTimer = cat.isRoamer ? 1.2 + Math.random() * 2.0 : 4.0 + Math.random() * 4.5;
        } else {
          const desiredAngle = this.chooseSteerAngle(
            cat,
            i,
            Math.atan2(dx, dz),
            isStaticBlocked,
            farmAnimals,
            horses
          );
          let diff = desiredAngle - cat.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          cat.facingAngle += diff * Math.min(1.0, dt * 7.5);

          activeSpeed = cat.speed;
          const totalMove = Math.min(dist, activeSpeed * dt);
          const subSteps = Math.max(1, Math.ceil(totalMove / 0.06));
          const stepLen = totalMove / subSteps;
          const dirX = Math.sin(cat.facingAngle);
          const dirZ = Math.cos(cat.facingAngle);

          _lastPosCheck.copy(cat.pos);
          for (let s = 0; s < subSteps; s++) {
            cat.pos.x += dirX * stepLen;
            cat.pos.z += dirZ * stepLen;
            resolveCollision(cat.pos, catRadius);
            enforceBoundary(cat.pos);
          }

          const movedSq = cat.pos.distanceToSquared(cat.lastProgressPos);
          if (movedSq > 0.04) {
            cat.lastProgressPos.copy(cat.pos);
            cat.stuckTimer = 0;
          } else {
            cat.stuckTimer += dt;
            if (cat.stuckTimer > 0.9) {
              this.pickNextTarget(cat, i, isStaticBlocked);
              cat.stuckTimer = 0;
            }
          }
        }
      }

      // Sync group transform
      cat.group.position.set(cat.pos.x, 0, cat.pos.z);
      cat.group.rotation.y = cat.facingAngle;

      // Animate feline gait, head curiosity, and swaying tail
      if (activeSpeed > 0.05) {
        cat.walkPhase += dt * activeSpeed * 9.5;
        const strideSin = Math.sin(cat.walkPhase) * 0.55;
        const strideOpp = Math.sin(cat.walkPhase + Math.PI) * 0.55;

        cat.legs[0].rotation.x = strideSin;
        cat.legs[1].rotation.x = strideOpp;
        cat.legs[2].rotation.x = strideOpp * 0.92;
        cat.legs[3].rotation.x = strideSin * 0.92;

        cat.bodyGroup.position.y = Math.abs(Math.sin(cat.walkPhase)) * 0.018;
        cat.headGroup.rotation.y = Math.sin(cat.idlePhase * 1.4) * 0.08;
        cat.headGroup.rotation.x = 0.04;
        cat.tailGroup.rotation.z = Math.sin(cat.walkPhase * 0.6) * 0.24;
        cat.tailGroup.rotation.x = Math.sin(cat.idlePhase * 2.0) * 0.08;
      } else {
        // Smoothly settle legs & sway tail lazily
        for (let l = 0; l < 4; l++) {
          cat.legs[l].rotation.x = THREE.MathUtils.damp(cat.legs[l].rotation.x, 0, 10, dt);
        }
        cat.bodyGroup.position.y = THREE.MathUtils.damp(cat.bodyGroup.position.y, 0, 10, dt);
        cat.headGroup.rotation.y = Math.sin(cat.idlePhase * 0.85) * 0.22;
        cat.headGroup.rotation.x = Math.sin(cat.idlePhase * 1.3) * 0.06;
        cat.tailGroup.rotation.z = Math.sin(cat.idlePhase * 2.1) * 0.28;
        cat.tailGroup.rotation.x = Math.cos(cat.idlePhase * 1.4) * 0.07;
      }
    }

    // Un-throttled pairwise cat-to-cat separation across all cats
    const count = this.cats.length;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < count; i++) {
        const a = this.cats[i];
        const rA = this.getCatRadius(a);
        for (let j = i + 1; j < count; j++) {
          const b = this.cats[j];
          const rB = this.getCatRadius(b);
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const minR = rA + rB + 0.06;
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
            const half = (minR - dist) * 0.5;
            a.pos.x -= nx * half;
            a.pos.z -= nz * half;
            b.pos.x += nx * half;
            b.pos.z += nz * half;
            this.movedFlags[i] = 1;
            this.movedFlags[j] = 1;
          }
        }
      }
    }

    // Cross-entity separation for cats: Sultan (foot or mounted), Horses/Carriages, Farm Animals, Citizens
    const sultanRadius = isMounted ? (mountedHorseHasCarriage ? 1.2 : 0.92) : 0.45;
    for (let i = 0; i < count; i++) {
      const cat = this.cats[i];
      const catRadius = this.getCatRadius(cat);

      const sdx = cat.pos.x - sultanPos.x;
      const sdz = cat.pos.z - sultanPos.z;
      const minSultan = catRadius + sultanRadius;
      const sDistSq = sdx * sdx + sdz * sdz;
      if (sDistSq < minSultan * minSultan && sDistSq > 0.0001) {
        const d = Math.sqrt(sDistSq);
        const push = minSultan / d;
        cat.pos.x = sultanPos.x + sdx * push;
        cat.pos.z = sultanPos.z + sdz * push;
        this.movedFlags[i] = 1;
      }

      if (farmAnimals) {
        for (let f = 0; f < farmAnimals.length; f++) {
          const fa = farmAnimals[f];
          const faR = fa.kind === 'cow' ? 0.78 : fa.kind === 'sheep' ? 0.45 : 0.38;
          const fdx = cat.pos.x - fa.pos.x;
          const fdz = cat.pos.z - fa.pos.z;
          const minF = catRadius + faR + 0.06;
          const fDistSq = fdx * fdx + fdz * fdz;
          if (fDistSq < minF * minF && fDistSq > 0.0001) {
            const d = Math.sqrt(fDistSq);
            const push = minF / d;
            cat.pos.x = fa.pos.x + fdx * push;
            cat.pos.z = fa.pos.z + fdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (horses) {
        for (let hIdx = 0; hIdx < horses.length; hIdx++) {
          const h = horses[hIdx];
          if (h.group && !h.group.visible) continue;

          const hdx = cat.pos.x - h.pos.x;
          const hdz = cat.pos.z - h.pos.z;
          const minH = catRadius + 0.9;
          const hDistSq = hdx * hdx + hdz * hdz;
          if (hDistSq < minH * minH && hDistSq > 0.0001) {
            const d = Math.sqrt(hDistSq);
            const push = minH / d;
            cat.pos.x = h.pos.x + hdx * push;
            cat.pos.z = h.pos.z + hdz * push;
            this.movedFlags[i] = 1;
          }

          if (h.hasCarriage) {
            const cx = h.pos.x - Math.sin(h.facingAngle) * 2.55;
            const cz = h.pos.z - Math.cos(h.facingAngle) * 2.55;
            const cdx = cat.pos.x - cx;
            const cdz = cat.pos.z - cz;
            const minC = catRadius + 1.05;
            const cDistSq = cdx * cdx + cdz * cdz;
            if (cDistSq < minC * minC && cDistSq > 0.0001) {
              const d = Math.sqrt(cDistSq);
              const push = minC / d;
              cat.pos.x = cx + cdx * push;
              cat.pos.z = cz + cdz * push;
              this.movedFlags[i] = 1;
            }
          }
        }
      }

      if (citizens) {
        for (let cIdx = 0; cIdx < citizens.length; cIdx++) {
          const c = citizens[cIdx];
          if (c.group && !c.group.visible) continue;
          const cdx = cat.pos.x - c.pos.x;
          const cdz = cat.pos.z - c.pos.z;
          const minCit = catRadius + 0.42;
          const cDistSq = cdx * cdx + cdz * cdz;
          if (cDistSq < minCit * minCit && cDistSq > 0.0001) {
            const d = Math.sqrt(cDistSq);
            const push = minCit / d;
            cat.pos.x = c.pos.x + cdx * push;
            cat.pos.z = c.pos.z + cdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (this.movedFlags[i]) {
        resolveCollision(cat.pos, catRadius);
        enforceBoundary(cat.pos);
        cat.group.position.set(cat.pos.x, 0, cat.pos.z);
      }
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
