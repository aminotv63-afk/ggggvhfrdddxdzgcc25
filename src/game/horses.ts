import * as THREE from 'three';

export type HorseCoat = 'white' | 'brown' | 'black';

export interface HorseSpawnConfig {
  id: string;
  coat: HorseCoat;
  x: number;
  z: number;
  rotY: number;
  hasCarriage: boolean;
  carriageStyle?: 'royal' | 'cart';
  wanderRadius?: number;
  ownerCitizenId?: string;
}

export interface HorseEntity {
  id: string;
  coat: HorseCoat;
  coatLabelAr: string;
  ownerCitizenId?: string;
  hasCarriage: boolean;
  carriageStyle?: 'royal' | 'cart';
  carriageDoorPivot?: THREE.Group;
  carriageSeatLocalOffset?: THREE.Vector3;
  carriageCompanionLocalOffset?: THREE.Vector3;
  carriageDriverLocalOffset?: THREE.Vector3;
  carriageDriverOnHorse?: boolean;
  halterAnchor: THREE.Object3D;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  neckGroup: THREE.Group;
  tailGroup: THREE.Group;
  legs: THREE.Group[]; // [frontL, frontR, backL, backR]
  knees: THREE.Group[]; // [frontL, frontR, backL, backR]
  wheels: THREE.Group[];
  facingAngle: number;
  pos: THREE.Vector3;
  velocityY: number;
  isGrounded: boolean;
  walkPhase: number;
  idlePhase: number;
  homeX: number;
  homeZ: number;
  wanderRadius: number;
  wanderAngle: number;
  wanderTimer: number;
  isWandering: boolean;
  accumDelta: number;
}

const COAT_LABELS_AR: Record<HorseCoat, string> = {
  white: 'الحصان الأبيض',
  brown: 'الحصان البني',
  black: 'الحصان الأسود',
};

export class HorseManager {
  public group: THREE.Group;
  public horses: HorseEntity[] = [];

  private disposables: { dispose: () => void }[] = [];
  private updateTickCount: number = 0;
  private movedFlags: Uint8Array = new Uint8Array(32);

  // Shared materials
  private coatMats!: Record<HorseCoat, THREE.MeshStandardMaterial>;
  private maneMats!: Record<HorseCoat, THREE.MeshStandardMaterial>;
  private saddleMats!: Record<HorseCoat, THREE.MeshStandardMaterial>;
  private hoofMat!: THREE.MeshStandardMaterial;
  private leatherMat!: THREE.MeshStandardMaterial;
  private goldMat!: THREE.MeshStandardMaterial;
  private eyeMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;
  private darkWoodMat!: THREE.MeshStandardMaterial;
  private ironMat!: THREE.MeshStandardMaterial;
  private crimsonMat!: THREE.MeshStandardMaterial;
  private creamMat!: THREE.MeshStandardMaterial;
  private velvetMat!: THREE.MeshStandardMaterial;

  // Shared sculpted anatomical & wheel geometries (zero duplicate allocations across 21 horses)
  private torsoGeo!: THREE.LatheGeometry;
  private withersGeo!: THREE.SphereGeometry;
  private blanketGeo!: THREE.CylinderGeometry;
  private saddleSeatGeo!: THREE.BoxGeometry;
  private pommelGeo!: THREE.TorusGeometry;
  private strapGeo!: THREE.BoxGeometry;
  private ironGeo!: THREE.TorusGeometry;
  private neckGeo!: THREE.CylinderGeometry;
  private lockGeo!: THREE.ConeGeometry;
  private craniumGeo!: THREE.SphereGeometry;
  private faceBridgeGeo!: THREE.CylinderGeometry;
  private muzzleTipGeo!: THREE.SphereGeometry;
  private halterRingGeo!: THREE.TorusGeometry;
  private forelockGeo!: THREE.ConeGeometry;
  private nosebandGeo!: THREE.TorusGeometry;
  private headstallGeo!: THREE.TorusGeometry;
  private bitGeo!: THREE.SphereGeometry;
  private earGeo!: THREE.ConeGeometry;
  private eyeGeo!: THREE.SphereGeometry;
  private reinGeo!: THREE.CylinderGeometry;
  private tailUpperGeo!: THREE.ConeGeometry;
  private tailLowerGeo!: THREE.ConeGeometry;
  private upperFrontGeo!: THREE.CylinderGeometry;
  private upperBackGeo!: THREE.CylinderGeometry;
  private lowerLegGeo!: THREE.CylinderGeometry;
  private fetlockGeo!: THREE.SphereGeometry;
  private hoofGeo!: THREE.CylinderGeometry;
  private wheelHubGeo!: THREE.CylinderGeometry;
  private wheelRimGeoCache = new Map<number, THREE.TorusGeometry>();
  private wheelSpokeGeoCache = new Map<number, THREE.BoxGeometry>();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'KingdomHorses';

    this.initSharedAssets();
    this.spawnAllHorses();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private initSharedAssets() {
    this.coatMats = {
      white: this.track(new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.65, metalness: 0.04 })),
      brown: this.track(new THREE.MeshStandardMaterial({ color: 0x7c4522, roughness: 0.68, metalness: 0.05 })),
      black: this.track(new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.6, metalness: 0.09 })),
    };

    this.maneMats = {
      white: this.track(new THREE.MeshStandardMaterial({ color: 0xd8d1c4, roughness: 0.84 })),
      brown: this.track(new THREE.MeshStandardMaterial({ color: 0x261409, roughness: 0.86 })),
      black: this.track(new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 0.84 })),
    };

    this.saddleMats = {
      white: this.track(new THREE.MeshStandardMaterial({ color: 0xb51d2e, roughness: 0.72 })),
      brown: this.track(new THREE.MeshStandardMaterial({ color: 0x1e5c45, roughness: 0.72 })),
      black: this.track(new THREE.MeshStandardMaterial({ color: 0xc29224, roughness: 0.56, metalness: 0.25 })),
    };

    this.hoofMat = this.track(new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.85 }));
    this.leatherMat = this.track(new THREE.MeshStandardMaterial({ color: 0x452513, roughness: 0.74 }));
    this.goldMat = this.track(new THREE.MeshStandardMaterial({ color: 0xe6b43c, roughness: 0.28, metalness: 0.84 }));
    this.eyeMat = this.track(new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.18 }));
    this.woodMat = this.track(new THREE.MeshStandardMaterial({ color: 0x9e6c3f, roughness: 0.8 }));
    this.darkWoodMat = this.track(new THREE.MeshStandardMaterial({ color: 0x523218, roughness: 0.84 }));
    this.ironMat = this.track(new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.48, metalness: 0.76 }));
    this.crimsonMat = this.track(new THREE.MeshStandardMaterial({ color: 0xa61c2c, roughness: 0.78, side: THREE.DoubleSide }));
    this.creamMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf0e4d0, roughness: 0.84, side: THREE.DoubleSide }));
    this.velvetMat = this.track(new THREE.MeshStandardMaterial({ color: 0x8f1626, roughness: 0.88 }));

    // Smooth sculpted equine barrel profile (Lathe around Y, then rotated along Z)
    const torsoPts = [
      new THREE.Vector2(0.01, -0.82),
      new THREE.Vector2(0.22, -0.74),
      new THREE.Vector2(0.35, -0.52), // hindquarters / croup
      new THREE.Vector2(0.34, -0.22),
      new THREE.Vector2(0.31, 0.06),  // natural waist / saddle dip
      new THREE.Vector2(0.35, 0.38),  // ribcage / withers
      new THREE.Vector2(0.32, 0.66),  // chest
      new THREE.Vector2(0.18, 0.8),
      new THREE.Vector2(0.01, 0.84),
    ];
    this.torsoGeo = this.track(new THREE.LatheGeometry(torsoPts, 16));
    this.torsoGeo.rotateX(Math.PI / 2);

    this.withersGeo = this.track(new THREE.SphereGeometry(0.24, 12, 10));
    this.blanketGeo = this.track(
      new THREE.CylinderGeometry(0.32, 0.34, 0.56, 12, 1, false, -Math.PI * 0.62, Math.PI * 1.24)
    );
    this.blanketGeo.rotateZ(Math.PI / 2);
    this.blanketGeo.rotateY(Math.PI / 2);
    this.saddleSeatGeo = this.track(new THREE.BoxGeometry(0.36, 0.08, 0.44));
    this.pommelGeo = this.track(new THREE.TorusGeometry(0.14, 0.032, 8, 12, Math.PI));
    this.strapGeo = this.track(new THREE.BoxGeometry(0.032, 0.26, 0.042));
    this.ironGeo = this.track(new THREE.TorusGeometry(0.06, 0.015, 6, 10));
    this.neckGeo = this.track(new THREE.CylinderGeometry(0.135, 0.26, 0.78, 12));
    this.lockGeo = this.track(new THREE.ConeGeometry(0.065, 0.22, 6));
    this.craniumGeo = this.track(new THREE.SphereGeometry(0.145, 12, 10));
    this.faceBridgeGeo = this.track(new THREE.CylinderGeometry(0.075, 0.125, 0.36, 10));
    this.faceBridgeGeo.rotateX(Math.PI / 2);
    this.muzzleTipGeo = this.track(new THREE.SphereGeometry(0.078, 10, 8));
    this.halterRingGeo = this.track(new THREE.TorusGeometry(0.026, 0.008, 6, 10));
    this.forelockGeo = this.track(new THREE.ConeGeometry(0.045, 0.18, 6));
    this.nosebandGeo = this.track(new THREE.TorusGeometry(0.095, 0.015, 6, 14));
    this.headstallGeo = this.track(new THREE.TorusGeometry(0.132, 0.015, 6, 14));
    this.bitGeo = this.track(new THREE.SphereGeometry(0.024, 6, 6));
    this.earGeo = this.track(new THREE.ConeGeometry(0.042, 0.17, 7));
    this.eyeGeo = this.track(new THREE.SphereGeometry(0.028, 8, 8));
    this.reinGeo = this.track(new THREE.CylinderGeometry(0.011, 0.011, 0.72, 5));
    this.reinGeo.rotateX(Math.PI / 2);
    this.tailUpperGeo = this.track(new THREE.ConeGeometry(0.095, 0.42, 8));
    this.tailLowerGeo = this.track(new THREE.ConeGeometry(0.115, 0.56, 8));
    this.tailLowerGeo.rotateX(Math.PI);
    this.upperFrontGeo = this.track(new THREE.CylinderGeometry(0.098, 0.068, 0.44, 9));
    this.upperBackGeo = this.track(new THREE.CylinderGeometry(0.125, 0.074, 0.46, 9));
    this.lowerLegGeo = this.track(new THREE.CylinderGeometry(0.056, 0.044, 0.4, 8));
    this.fetlockGeo = this.track(new THREE.SphereGeometry(0.048, 7, 7));
    this.hoofGeo = this.track(new THREE.CylinderGeometry(0.054, 0.068, 0.095, 9));
    this.wheelHubGeo = this.track(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10));
    this.wheelHubGeo.rotateZ(Math.PI / 2);
  }

  private spawnAllHorses() {
    const configs: HorseSpawnConfig[] = [
      { id: 'h1', coat: 'white', x: 3.9, z: -2.6, rotY: -0.75, hasCarriage: false, wanderRadius: 2.2 },
      { id: 'h2', coat: 'brown', x: -4.9, z: 2.2, rotY: 0.9, hasCarriage: false, wanderRadius: 2.4 },
      { id: 'h3', coat: 'black', x: 5.2, z: 11.5, rotY: Math.PI, hasCarriage: true, carriageStyle: 'royal' },
      { id: 'h4', coat: 'white', x: -5.4, z: -17.2, rotY: Math.PI * 0.5, hasCarriage: true, carriageStyle: 'royal' },

      { id: 'h5', coat: 'black', x: -14.2, z: 4.0, rotY: 1.4, hasCarriage: false, wanderRadius: 2.0 },
      { id: 'h6', coat: 'brown', x: 14.2, z: 4.0, rotY: -1.4, hasCarriage: false, wanderRadius: 2.0 },

      { id: 'h7', coat: 'white', x: -30.5, z: -4.0, rotY: 0.0, hasCarriage: true, carriageStyle: 'cart' },
      { id: 'h8', coat: 'brown', x: 30.5, z: -4.0, rotY: Math.PI, hasCarriage: true, carriageStyle: 'cart' },
      { id: 'h9', coat: 'black', x: -30.5, z: 16.0, rotY: Math.PI * 0.15, hasCarriage: true, carriageStyle: 'royal' },
      { id: 'h10', coat: 'brown', x: 30.5, z: 16.0, rotY: -Math.PI * 0.15, hasCarriage: false, wanderRadius: 3.0 },

      { id: 'h11', coat: 'white', x: 0.0, z: 24.5, rotY: Math.PI, hasCarriage: false, wanderRadius: 2.6 },
      { id: 'h12', coat: 'black', x: -30.5, z: -22.5, rotY: 0.65, hasCarriage: false, wanderRadius: 2.8 },
      { id: 'h13', coat: 'brown', x: 30.5, z: -22.5, rotY: -0.65, hasCarriage: false, wanderRadius: 2.8 },
      { id: 'h14', coat: 'white', x: -21.0, z: 36.0, rotY: 1.1, hasCarriage: false, wanderRadius: 2.8 },
      { id: 'h15', coat: 'black', x: 21.0, z: 36.0, rotY: -1.1, hasCarriage: true, carriageStyle: 'cart' },

      // Dedicated NPC-led horses (walked by citizens on lead ropes)
      { id: 'npc_lead_1', coat: 'brown', x: -30.5, z: 22.0, rotY: 0, hasCarriage: false, ownerCitizenId: 'c_leader_1' },
      { id: 'npc_lead_2', coat: 'white', x: 30.5, z: 5.2, rotY: 0, hasCarriage: false, ownerCitizenId: 'c_leader_2' },
      { id: 'npc_lead_3', coat: 'black', x: -4.8, z: 28.0, rotY: Math.PI * 0.5, hasCarriage: false, ownerCitizenId: 'c_leader_3' },

      // Dedicated NPC-ridden horses (mounted by riding citizens across the kingdom)
      { id: 'npc_ride_1', coat: 'white', x: 3.2, z: -16.2, rotY: Math.PI, hasCarriage: false, ownerCitizenId: 'c_rider_1' },
      { id: 'npc_ride_2', coat: 'black', x: -30.5, z: -18.0, rotY: 0, hasCarriage: false, ownerCitizenId: 'c_rider_2' },
      { id: 'npc_ride_3', coat: 'brown', x: 30.5, z: -14.0, rotY: 0, hasCarriage: false, ownerCitizenId: 'c_rider_3' },
    ];

    for (const cfg of configs) {
      const entity = this.createHorseEntity(cfg);
      this.horses.push(entity);
      this.group.add(entity.group);
    }
  }

  private createHorseEntity(cfg: HorseSpawnConfig): HorseEntity {
    const coatMat = this.coatMats[cfg.coat];
    const maneMat = this.maneMats[cfg.coat];
    const saddleMat = this.saddleMats[cfg.coat];

    const root = new THREE.Group();
    root.position.set(cfg.x, 0, cfg.z);
    root.rotation.y = cfg.rotY;

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // 1. Sleek Sculpted Torso (with athletic equine proportions)
    const torso = new THREE.Mesh(this.torsoGeo, coatMat);
    torso.position.set(0, 1.07, 0);
    torso.scale.set(0.68, 1.0, 1.04);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Subtle withers arch & shoulder swell
    const withers = new THREE.Mesh(this.withersGeo, coatMat);
    withers.position.set(0, 1.22, 0.42);
    withers.scale.set(0.7, 0.92, 1.15);
    withers.castShadow = true;
    bodyGroup.add(withers);

    // 2. Royal Contoured Saddle Blanket, Saddle, Pommel, Cantle & Stirrups
    const blanket = new THREE.Mesh(this.blanketGeo, saddleMat);
    blanket.position.set(0, 1.08, -0.02);
    blanket.scale.set(0.71, 0.96, 1.0);
    blanket.castShadow = true;
    bodyGroup.add(blanket);

    const saddleSeat = new THREE.Mesh(this.saddleSeatGeo, this.leatherMat);
    saddleSeat.position.set(0, 1.41, -0.02);
    bodyGroup.add(saddleSeat);

    const pommel = new THREE.Mesh(this.pommelGeo, this.goldMat);
    pommel.position.set(0, 1.42, 0.19);
    pommel.rotation.x = -0.18;
    bodyGroup.add(pommel);

    const cantle = new THREE.Mesh(this.pommelGeo, this.leatherMat);
    cantle.position.set(0, 1.43, -0.22);
    cantle.rotation.x = 0.25;
    bodyGroup.add(cantle);

    // Stirrup Leathers & Metal Stirrups aligned directly beneath Sultan's boots
    [-0.31, 0.31].forEach((sx) => {
      const strap = new THREE.Mesh(this.strapGeo, this.leatherMat);
      strap.position.set(sx, 1.31, 0.1);
      strap.rotation.z = sx > 0 ? -0.34 : 0.34;
      bodyGroup.add(strap);

      const stirrup = new THREE.Mesh(this.ironGeo, this.ironMat);
      stirrup.position.set(sx * 1.24, 1.18, 0.12);
      stirrup.rotation.y = Math.PI / 2;
      bodyGroup.add(stirrup);
    });

    // 3. Arched Equine Neck, Cascading Mane & Sculpted Tapered Head
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 1.16, 0.56);
    bodyGroup.add(neckGroup);

    const neck = new THREE.Mesh(this.neckGeo, coatMat);
    neck.position.set(0, 0.3, 0.16);
    neck.rotation.x = 0.52;
    neck.scale.set(0.76, 1, 1.08);
    neck.castShadow = true;
    neckGroup.add(neck);

    // Cascading Mane Locks along the back crest of the neck
    for (let m = 0; m < 6; m++) {
      const t = m / 5;
      const lock = new THREE.Mesh(this.lockGeo, maneMat);
      lock.position.set(0.025, 0.08 + t * 0.48, -0.02 + t * 0.28);
      lock.rotation.x = -0.75;
      lock.rotation.z = -0.35;
      neckGroup.add(lock);
    }

    // Refined Equine Head (tapered bridge + cheek + sculpted muzzle + jaw + bridle + reins)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.63, 0.36);
    neckGroup.add(headPivot);

    const cranium = new THREE.Mesh(this.craniumGeo, coatMat);
    cranium.position.set(0, 0.02, 0.04);
    cranium.scale.set(0.82, 0.95, 1.25);
    cranium.castShadow = true;
    headPivot.add(cranium);

    const faceBridge = new THREE.Mesh(this.faceBridgeGeo, coatMat);
    faceBridge.position.set(0, -0.09, 0.22);
    faceBridge.rotation.x = 0.44;
    faceBridge.scale.set(0.84, 0.96, 1.0);
    faceBridge.castShadow = true;
    headPivot.add(faceBridge);

    const muzzleTip = new THREE.Mesh(this.muzzleTipGeo, coatMat);
    muzzleTip.position.set(0, -0.17, 0.38);
    muzzleTip.scale.set(0.92, 0.85, 1.05);
    headPivot.add(muzzleTip);

    // Lead-rope Halter Ring & Anchor beneath the muzzle
    const halterRing = new THREE.Mesh(this.halterRingGeo, this.goldMat);
    halterRing.position.set(0, -0.21, 0.33);
    halterRing.rotation.y = Math.PI / 2;
    headPivot.add(halterRing);

    const halterAnchor = new THREE.Object3D();
    halterAnchor.position.set(0, -0.22, 0.33);
    headPivot.add(halterAnchor);

    // Forelock tuft between ears
    const forelock = new THREE.Mesh(this.forelockGeo, maneMat);
    forelock.position.set(0, 0.12, 0.14);
    forelock.rotation.x = 0.95;
    headPivot.add(forelock);

    // Leather Bridle straps, gold bit ring & reins leading back to pommel
    const noseband = new THREE.Mesh(this.nosebandGeo, this.leatherMat);
    noseband.position.set(0, -0.12, 0.29);
    noseband.rotation.x = 0.44;
    headPivot.add(noseband);

    const headstall = new THREE.Mesh(this.headstallGeo, this.leatherMat);
    headstall.position.set(0, 0.01, 0.08);
    headstall.rotation.x = 0.32;
    headPivot.add(headstall);

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(this.earGeo, coatMat);
      ear.position.set(side * 0.068, 0.17, 0.01);
      ear.rotation.z = side * -0.16;
      ear.rotation.x = 0.22;
      headPivot.add(ear);

      const eye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
      eye.position.set(side * 0.096, 0.03, 0.13);
      headPivot.add(eye);

      const bitRing = new THREE.Mesh(this.bitGeo, this.goldMat);
      bitRing.position.set(side * 0.085, -0.14, 0.31);
      headPivot.add(bitRing);

      const rein = new THREE.Mesh(this.reinGeo, this.leatherMat);
      rein.position.set(side * 0.13, -0.18, -0.02);
      rein.rotation.x = -0.14;
      rein.rotation.y = side * -0.16;
      headPivot.add(rein);
    });

    // 4. Graceful Curved Flowing Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.18, -0.76);
    bodyGroup.add(tailGroup);

    const tailUpper = new THREE.Mesh(this.tailUpperGeo, maneMat);
    tailUpper.position.set(0, -0.16, -0.09);
    tailUpper.rotation.x = -0.45;
    tailUpper.castShadow = true;
    tailGroup.add(tailUpper);

    const tailLower = new THREE.Mesh(this.tailLowerGeo, maneMat);
    tailLower.position.set(0, -0.48, -0.16);
    tailLower.rotation.x = -0.12;
    tailLower.castShadow = true;
    tailGroup.add(tailLower);

    // 5. Two-Segment Articulated Athletic Legs (Shoulder/Hip -> Upper Limb -> Knee/Hock -> Cannon -> Fetlock -> Hoof)
    const legConfigs: { x: number; z: number; isFront: boolean }[] = [
      { x: -0.2, z: 0.48, isFront: true },
      { x: 0.2, z: 0.48, isFront: true },
      { x: -0.21, z: -0.48, isFront: false },
      { x: 0.21, z: -0.48, isFront: false },
    ];

    const legs: THREE.Group[] = [];
    const knees: THREE.Group[] = [];

    for (const lc of legConfigs) {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(lc.x, 0.9, lc.z);

      const upper = new THREE.Mesh(lc.isFront ? this.upperFrontGeo : this.upperBackGeo, coatMat);
      upper.position.y = -0.21;
      upper.rotation.x = lc.isFront ? 0.05 : -0.08;
      upper.castShadow = true;
      hipPivot.add(upper);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.42, lc.isFront ? 0.01 : -0.03);
      hipPivot.add(kneePivot);

      const lower = new THREE.Mesh(this.lowerLegGeo, coatMat);
      lower.position.y = -0.2;
      lower.castShadow = true;
      kneePivot.add(lower);

      const fetlock = new THREE.Mesh(this.fetlockGeo, coatMat);
      fetlock.position.y = -0.4;
      kneePivot.add(fetlock);

      const hoof = new THREE.Mesh(this.hoofGeo, this.hoofMat);
      hoof.position.set(0, -0.44, 0.012);
      kneePivot.add(hoof);

      bodyGroup.add(hipPivot);
      legs.push(hipPivot);
      knees.push(kneePivot);
    }

    // 6. Optional Attached Carriage (Royal Carriage now features openable door, plush rear bench, & coachman front seat!)
    const wheels: THREE.Group[] = [];
    let carriageDoorPivot: THREE.Group | undefined;
    let carriageSeatLocalOffset: THREE.Vector3 | undefined;
    let carriageCompanionLocalOffset: THREE.Vector3 | undefined;
    let carriageDriverLocalOffset: THREE.Vector3 | undefined;
    let carriageDriverOnHorse: boolean | undefined;

    if (cfg.hasCarriage) {
      const result = this.attachCarriage(root, wheels, cfg.carriageStyle || 'royal');
      carriageDoorPivot = result.doorPivot;
      carriageSeatLocalOffset = result.seatOffset;
      carriageCompanionLocalOffset = result.companionOffset;
      carriageDriverLocalOffset = result.driverOffset;
      carriageDriverOnHorse = result.driverOnHorse;
    }

    return {
      id: cfg.id,
      coat: cfg.coat,
      coatLabelAr: COAT_LABELS_AR[cfg.coat],
      ownerCitizenId: cfg.ownerCitizenId,
      hasCarriage: cfg.hasCarriage,
      carriageStyle: cfg.carriageStyle,
      carriageDoorPivot,
      carriageSeatLocalOffset,
      carriageCompanionLocalOffset,
      carriageDriverLocalOffset,
      carriageDriverOnHorse,
      halterAnchor,
      group: root,
      bodyGroup,
      neckGroup,
      tailGroup,
      legs,
      knees,
      wheels,
      facingAngle: cfg.rotY,
      pos: new THREE.Vector3(cfg.x, 0, cfg.z),
      velocityY: 0,
      isGrounded: true,
      walkPhase: Math.random() * Math.PI * 2,
      idlePhase: Math.random() * Math.PI * 2,
      homeX: cfg.x,
      homeZ: cfg.z,
      wanderRadius: cfg.wanderRadius ?? 0,
      wanderAngle: cfg.rotY,
      wanderTimer: 1 + Math.random() * 4,
      isWandering: false,
      accumDelta: 0,
    };
  }

  private attachCarriage(
    horseRoot: THREE.Group,
    wheelsOut: THREE.Group[],
    style: 'royal' | 'cart'
  ): {
    doorPivot?: THREE.Group;
    seatOffset?: THREE.Vector3;
    companionOffset?: THREE.Vector3;
    driverOffset?: THREE.Vector3;
    driverOnHorse?: boolean;
  } {
    const carriageZ = -2.55;
    const carriage = new THREE.Group();
    carriage.position.set(0, 0, carriageZ);
    horseRoot.add(carriage);

    // Harness Collar & Curved Wooden Shafts connecting horse shoulders to carriage axle
    const shaftGeo = this.track(new THREE.BoxGeometry(0.065, 0.065, 2.35));
    [-0.4, 0.4].forEach((sx) => {
      const shaft = new THREE.Mesh(shaftGeo, this.darkWoodMat);
      shaft.position.set(sx, 0.9, 1.7);
      shaft.rotation.x = 0.08;
      shaft.castShadow = true;
      carriage.add(shaft);
    });

    const crossbarGeo = this.track(new THREE.BoxGeometry(0.96, 0.075, 0.085));
    const crossbar = new THREE.Mesh(crossbarGeo, this.ironMat);
    crossbar.position.set(0, 0.8, 1.02);
    carriage.add(crossbar);

    if (style === 'royal') {
      // =========================================================================
      // ROYAL PASSENGER CARRIAGE: Tall, spacious cabin clearing the Sultan's crown!
      // =========================================================================
      const cabinW = 1.62;
      const cabinL = 2.68;
      const cabinCenterZ = -0.35;
      const frontZ = cabinCenterZ + cabinL * 0.5; // +0.99
      const rearZ = cabinCenterZ - cabinL * 0.5;  // -1.69
      const floorY = 0.62;
      const postHeight = 2.24; // Roof eave at floorY + 2.26 = 2.88m (well above Sultan's crown ~2.72m)

      // Wooden Chassis & Floor Platform
      const floor = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.12, cabinL)),
        this.darkWoodMat
      );
      floor.position.set(0, floorY, cabinCenterZ);
      floor.castShadow = true;
      floor.receiveShadow = true;
      carriage.add(floor);

      // Crimson Royal Interior Carpet
      const carpet = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW - 0.16, 0.025, cabinL - 0.18)),
        this.velvetMat
      );
      carpet.position.set(0, floorY + 0.07, cabinCenterZ);
      carriage.add(carpet);

      // Interior Plush Passenger Bench Seat (crimson velvet cushion + padded backrest)
      const seatBench = new THREE.Group();
      seatBench.position.set(0, floorY + 0.08, -1.16);

      const seatBase = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.38, 0.22, 0.6)),
        this.darkWoodMat
      );
      seatBase.position.y = 0.11;
      seatBench.add(seatBase);

      const seatCushion = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.36, 0.1, 0.6)),
        this.velvetMat
      );
      seatCushion.position.y = 0.27;
      seatBench.add(seatCushion);

      const seatBackrest = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.36, 0.62, 0.14)),
        this.velvetMat
      );
      seatBackrest.position.set(0, 0.61, -0.24);
      seatBackrest.rotation.x = -0.1;
      seatBench.add(seatBackrest);

      const goldSeatTrim = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.38, 0.05, 0.62)),
        this.goldMat
      );
      goldSeatTrim.position.y = 0.22;
      seatBench.add(goldSeatTrim);

      carriage.add(seatBench);

      // Front & Rear Lower Walls + Upper Lintel Beams (tall open windows so Sultan is clearly visible)
      const frontLower = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.62, 0.09)),
        this.crimsonMat
      );
      frontLower.position.set(0, floorY + 0.36, frontZ - 0.045);
      frontLower.castShadow = true;
      carriage.add(frontLower);

      const frontUpperTrim = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.1, 0.1)),
        this.goldMat
      );
      frontUpperTrim.position.set(0, floorY + postHeight, frontZ - 0.045);
      carriage.add(frontUpperTrim);

      const rearLower = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.72, 0.09)),
        this.crimsonMat
      );
      rearLower.position.set(0, floorY + 0.41, rearZ + 0.045);
      rearLower.castShadow = true;
      carriage.add(rearLower);

      const rearUpperTrim = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.1, 0.1)),
        this.goldMat
      );
      rearUpperTrim.position.set(0, floorY + 0.8, rearZ + 0.045);
      carriage.add(rearUpperTrim);

      const rearRoofLintel = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(cabinW, 0.1, 0.1)),
        this.goldMat
      );
      rearRoofLintel.position.set(0, floorY + postHeight, rearZ + 0.045);
      carriage.add(rearRoofLintel);

      // 4 Tall Corner Roof Posts
      const postGeo = this.track(new THREE.BoxGeometry(0.11, postHeight, 0.11));
      [-cabinW * 0.5 + 0.055, cabinW * 0.5 - 0.055].forEach((px) => {
        [frontZ - 0.045, rearZ + 0.045].forEach((pz) => {
          const post = new THREE.Mesh(postGeo, this.darkWoodMat);
          post.position.set(px, floorY + postHeight * 0.5 + 0.04, pz);
          post.castShadow = true;
          carriage.add(post);
        });
      });

      // Side Wall Structural Panels beside the 1.0m Doorways + Upper Side Headers + Boarding Steps
      const frontSidePanelGeo = this.track(new THREE.BoxGeometry(0.08, 0.62, 0.52));
      const rearSidePanelGeo = this.track(new THREE.BoxGeometry(0.08, 0.62, 1.06));
      const sideRoofHeaderGeo = this.track(new THREE.BoxGeometry(0.09, 0.1, cabinL - 0.1));
      const stepGeo = this.track(new THREE.BoxGeometry(0.3, 0.07, 0.84));
      [-cabinW * 0.5 + 0.04, cabinW * 0.5 - 0.04].forEach((sx, sIdx) => {
        const fp = new THREE.Mesh(frontSidePanelGeo, this.crimsonMat);
        fp.position.set(sx, floorY + 0.36, 0.68);
        carriage.add(fp);

        const rp = new THREE.Mesh(rearSidePanelGeo, this.crimsonMat);
        rp.position.set(sx, floorY + 0.36, -1.11);
        carriage.add(rp);

        const sideHeader = new THREE.Mesh(sideRoofHeaderGeo, this.darkWoodMat);
        sideHeader.position.set(sx, floorY + postHeight, cabinCenterZ);
        carriage.add(sideHeader);

        // Boarding Step outside each doorway
        const step = new THREE.Mesh(stepGeo, this.ironMat);
        step.position.set(sIdx === 0 ? sx - 0.15 : sx + 0.15, floorY - 0.16, -0.08);
        carriage.add(step);
      });

      // Helper to build a tall Hinged Carriage Door with gold frame, window opening & handle
      const createDoor = (xEdge: number, isOpenRightDoor: boolean): THREE.Group => {
        const doorPivot = new THREE.Group();
        // Hinge positioned on the front edge of the doorway (z = 0.42)
        doorPivot.position.set(xEdge, floorY + 0.06, 0.42);

        const doorPanel = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.075, 0.64, 1.0)),
          this.crimsonMat
        );
        doorPanel.position.set(0, 0.32, -0.5);
        doorPanel.castShadow = true;
        doorPivot.add(doorPanel);

        const doorTrim = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.09, 0.08, 1.02)),
          this.goldMat
        );
        doorTrim.position.set(0, 0.64, -0.5);
        doorPivot.add(doorTrim);

        // Tall door upper window pillars + header
        const dPillarGeo = this.track(new THREE.BoxGeometry(0.075, 1.5, 0.085));
        [-0.045, -0.955].forEach((dz) => {
          const dp = new THREE.Mesh(dPillarGeo, this.darkWoodMat);
          dp.position.set(0, 1.4, dz);
          doorPivot.add(dp);
        });

        const dHeader = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.08, 0.09, 1.0)),
          this.darkWoodMat
        );
        dHeader.position.set(0, 2.16, -0.5);
        doorPivot.add(dHeader);

        // Golden Door Handle
        const handle = new THREE.Mesh(
          this.track(new THREE.SphereGeometry(0.048, 8, 8)),
          this.goldMat
        );
        handle.position.set(isOpenRightDoor ? 0.06 : -0.06, 0.58, -0.88);
        doorPivot.add(handle);

        // Swing the right-hand door open so interior passenger seat is inviting & visible
        if (isOpenRightDoor) {
          doorPivot.rotation.y = 0.64;
        }

        return doorPivot;
      };

      const leftDoor = createDoor(-cabinW * 0.5 + 0.04, false);
      carriage.add(leftDoor);

      const rightDoor = createDoor(cabinW * 0.5 - 0.04, true);
      carriage.add(rightDoor);

      // Tall Arched Cream Canopy Roof with Gold Trim (eave at 2.88m, peak at 3.38m)
      const roofGeo = this.track(new THREE.CylinderGeometry(0.9, 0.9, cabinL + 0.16, 14, 1, false, 0, Math.PI));
      roofGeo.rotateZ(Math.PI / 2);
      roofGeo.rotateY(Math.PI / 2);
      const roof = new THREE.Mesh(roofGeo, this.creamMat);
      roof.position.set(0, floorY + postHeight + 0.02, cabinCenterZ);
      roof.scale.set(1.0, 0.56, 1.0);
      roof.castShadow = true;
      carriage.add(roof);

      // Coachman Front Bench Seat + Crimson Cushion + Footboard + Driving Reins to Horse
      const coachSeat = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.24, 0.14, 0.44)),
        this.woodMat
      );
      coachSeat.position.set(0, floorY + 0.64, 1.24);
      carriage.add(coachSeat);

      const coachCushion = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.16, 0.06, 0.38)),
        this.velvetMat
      );
      coachCushion.position.set(0, floorY + 0.74, 1.24);
      carriage.add(coachCushion);

      const coachFootboard = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.18, 0.07, 0.34)),
        this.darkWoodMat
      );
      coachFootboard.position.set(0, floorY + 0.28, 1.58);
      coachFootboard.rotation.x = -0.22;
      carriage.add(coachFootboard);

      // Pair of slender leather reins stretching from coachman hands forward to horse harness collar
      const reinStart = new THREE.Vector3(0, floorY + 1.0, 1.5);
      const reinEnd = new THREE.Vector3(0, 1.38, 3.02);
      const reinLen = reinStart.distanceTo(reinEnd);
      const reinGeo = this.track(new THREE.CylinderGeometry(0.011, 0.011, reinLen, 5));
      reinGeo.rotateX(Math.PI / 2);
      [-0.16, 0.16].forEach((rx) => {
        const rein = new THREE.Mesh(reinGeo, this.leatherMat);
        rein.position.set(
          rx,
          (reinStart.y + reinEnd.y) * 0.5,
          (reinStart.z + reinEnd.z) * 0.5
        );
        rein.lookAt(rx * 1.1, reinEnd.y, reinEnd.z);
        carriage.add(rein);
      });

      // 4 Spoked Wheels
      const wheelSpecs: [number, number, number][] = [
        [-0.92, 0.62, 0.44],
        [0.92, 0.62, 0.44],
        [-0.94, -1.32, 0.58],
        [0.94, -1.32, 0.58],
      ];
      for (const [wx, wz, wr] of wheelSpecs) {
        const w = this.createSpokedWheel(wr);
        w.position.set(wx, wr, wz);
        carriage.add(w);
        wheelsOut.push(w);
      }

      return {
        doorPivot: rightDoor,
        seatOffset: new THREE.Vector3(-0.3, floorY + 0.28, carriageZ - 1.06),
        companionOffset: new THREE.Vector3(0.3, floorY + 0.28, carriageZ - 1.06),
        driverOffset: new THREE.Vector3(0, floorY + 0.62, carriageZ + 1.24),
        driverOnHorse: false,
      };
    } else {
      // Wooden Supply Cart (2 large spoked wheels, slatted bed, rear passenger bench + front cargo)
      const bedGeo = this.track(new THREE.BoxGeometry(1.56, 0.14, 2.45));
      const bed = new THREE.Mesh(bedGeo, this.woodMat);
      bed.position.set(0, 0.62, -0.25);
      bed.castShadow = true;
      bed.receiveShadow = true;
      carriage.add(bed);

      const sideRailGeo = this.track(new THREE.BoxGeometry(0.1, 0.54, 2.45));
      [-0.73, 0.73].forEach((rx) => {
        const rail = new THREE.Mesh(sideRailGeo, this.darkWoodMat);
        rail.position.set(rx, 0.94, -0.25);
        rail.castShadow = true;
        carriage.add(rail);
      });

      const backRailGeo = this.track(new THREE.BoxGeometry(1.52, 0.5, 0.1));
      const backRail = new THREE.Mesh(backRailGeo, this.darkWoodMat);
      backRail.position.set(0, 0.92, -1.43);
      carriage.add(backRail);

      // Rear wooden passenger bench inside cart for Sultan & companion guard
      const cartBench = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.32, 0.24, 0.48)),
        this.darkWoodMat
      );
      cartBench.position.set(0, 0.81, -1.04);
      cartBench.castShadow = true;
      carriage.add(cartBench);

      const barrelGeo = this.track(new THREE.CylinderGeometry(0.3, 0.26, 0.74, 10));
      const barrel = new THREE.Mesh(barrelGeo, this.darkWoodMat);
      barrel.position.set(-0.3, 1.04, 0.34);
      barrel.castShadow = true;
      carriage.add(barrel);

      const crateGeo = this.track(new THREE.BoxGeometry(0.56, 0.52, 0.56));
      const crate = new THREE.Mesh(crateGeo, this.woodMat);
      crate.position.set(0.3, 0.95, 0.36);
      crate.castShadow = true;
      carriage.add(crate);

      [-0.92, 0.92].forEach((wx) => {
        const w = this.createSpokedWheel(0.58);
        w.position.set(wx, 0.58, -0.25);
        carriage.add(w);
        wheelsOut.push(w);
      });

      return {
        seatOffset: new THREE.Vector3(-0.28, 0.77, carriageZ - 1.0),
        companionOffset: new THREE.Vector3(0.28, 0.77, carriageZ - 1.0),
        driverOffset: new THREE.Vector3(0, 1.19, -0.04),
        driverOnHorse: true,
      };
    }
  }

  public getCarriageSlotWorldPos(
    horse: HorseEntity,
    slot: 'sultan' | 'companion' | 'driver',
    out: THREE.Vector3
  ): THREE.Vector3 {
    const local =
      slot === 'sultan'
        ? horse.carriageSeatLocalOffset
        : slot === 'companion'
        ? horse.carriageCompanionLocalOffset
        : horse.carriageDriverLocalOffset;
    if (!local) {
      return out.set(
        horse.pos.x - Math.sin(horse.facingAngle) * 0.04,
        horse.pos.y + 1.19,
        horse.pos.z - Math.cos(horse.facingAngle) * 0.04
      );
    }
    const sinY = Math.sin(horse.facingAngle);
    const cosY = Math.cos(horse.facingAngle);
    return out.set(
      horse.pos.x + local.x * cosY + local.z * sinY,
      horse.pos.y + local.y,
      horse.pos.z - local.x * sinY + local.z * cosY
    );
  }

  private createSpokedWheel(radius: number): THREE.Group {
    const wheel = new THREE.Group();

    let rimGeo = this.wheelRimGeoCache.get(radius);
    if (!rimGeo) {
      rimGeo = this.track(new THREE.TorusGeometry(radius, 0.052, 8, 18));
      rimGeo.rotateY(Math.PI / 2);
      this.wheelRimGeoCache.set(radius, rimGeo);
    }
    const rim = new THREE.Mesh(rimGeo, this.ironMat);
    rim.castShadow = true;
    wheel.add(rim);

    const hub = new THREE.Mesh(this.wheelHubGeo, this.darkWoodMat);
    wheel.add(hub);

    let spokeGeo = this.wheelSpokeGeoCache.get(radius);
    if (!spokeGeo) {
      spokeGeo = this.track(new THREE.BoxGeometry(0.04, radius * 1.9, 0.042));
      this.wheelSpokeGeoCache.set(radius, spokeGeo);
    }
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(spokeGeo, this.woodMat);
      spoke.rotation.x = (s / 4) * Math.PI;
      wheel.add(spoke);
    }

    return wheel;
  }

  public findNearestMountable(pos: THREE.Vector3, maxDist: number = 3.2): HorseEntity | null {
    let best: HorseEntity | null = null;
    let bestDistSq = maxDist * maxDist;

    for (let i = 0; i < this.horses.length; i++) {
      const h = this.horses[i];
      if (h.ownerCitizenId) continue;
      const dx = pos.x - h.pos.x;
      const dz = pos.z - h.pos.z;
      let dSq = dx * dx + dz * dz;

      if (h.hasCarriage) {
        const cx = h.pos.x - Math.sin(h.facingAngle) * 2.75;
        const cz = h.pos.z - Math.cos(h.facingAngle) * 2.75;
        const cdx = pos.x - cx;
        const cdz = pos.z - cz;
        const cDistSq = cdx * cdx + cdz * cdz;
        if (cDistSq < dSq) dSq = cDistSq;
      }

      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = h;
      }
    }
    return best;
  }

  public animateHorse(horse: HorseEntity, delta: number, speed: number, isGrounded: boolean) {
    horse.idlePhase += delta * 2.2;

    if (speed > 0.25) {
      const freq = speed > 8 ? 11.5 : 7.5;
      horse.walkPhase += delta * freq;
      const swing = Math.min(0.65, 0.28 + speed * 0.03);

      const p1 = Math.sin(horse.walkPhase) * swing;
      const p2 = Math.sin(horse.walkPhase + Math.PI) * swing;

      if (!isGrounded) {
        horse.legs[0].rotation.x = -0.58;
        horse.legs[1].rotation.x = -0.42;
        horse.legs[2].rotation.x = 0.45;
        horse.legs[3].rotation.x = 0.56;
        horse.knees[0].rotation.x = 0.72;
        horse.knees[1].rotation.x = 0.62;
        horse.knees[2].rotation.x = -0.35;
        horse.knees[3].rotation.x = -0.45;
      } else {
        horse.legs[0].rotation.x = p1;
        horse.legs[1].rotation.x = p2;
        horse.legs[2].rotation.x = p2;
        horse.legs[3].rotation.x = p1;

        // Articulated knee & hock flexion during swing phase
        horse.knees[0].rotation.x = Math.max(0, -p1) * 0.75;
        horse.knees[1].rotation.x = Math.max(0, -p2) * 0.75;
        horse.knees[2].rotation.x = -Math.max(0, p2) * 0.48;
        horse.knees[3].rotation.x = -Math.max(0, p1) * 0.48;
      }

      horse.bodyGroup.position.y = Math.abs(Math.sin(horse.walkPhase)) * 0.048;
      horse.neckGroup.rotation.x = Math.sin(horse.walkPhase) * 0.075;
      horse.tailGroup.rotation.x = 0.28 + Math.sin(horse.walkPhase * 0.5) * 0.14;

      const wheelRot = (speed * delta) / 0.48;
      for (let w = 0; w < horse.wheels.length; w++) {
        horse.wheels[w].rotation.x += wheelRot;
      }
    } else {
      for (let l = 0; l < horse.legs.length; l++) {
        horse.legs[l].rotation.x *= Math.max(0, 1 - delta * 8);
        horse.knees[l].rotation.x *= Math.max(0, 1 - delta * 8);
      }
      horse.bodyGroup.position.y = Math.sin(horse.idlePhase) * 0.012;
      horse.neckGroup.rotation.x = Math.sin(horse.idlePhase * 0.65) * 0.055;
      horse.tailGroup.rotation.z = Math.sin(horse.idlePhase * 1.4) * 0.08;
      horse.tailGroup.rotation.x = 0;
    }

    horse.group.position.copy(horse.pos);
    horse.group.rotation.y = horse.facingAngle;
  }

  /**
   * Moves a horse smoothly behind a walking leader on a lead rope, preserving realistic tether distance,
   * facing direction, obstacle collision, and full leg/carriage wheel animation.
   */
  public updateLedHorseFollow(
    horse: HorseEntity,
    leaderPos: THREE.Vector3,
    leaderMaxSpeed: number,
    delta: number,
    resolveEnvCollisions: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary?: (pos: THREE.Vector3) => void
  ) {
    const dx = leaderPos.x - horse.pos.x;
    const dz = leaderPos.z - horse.pos.z;
    const dist = Math.hypot(dx, dz);

    const desiredAngle = dist > 0.05 ? Math.atan2(dx, dz) : horse.facingAngle;
    let diff = desiredAngle - horse.facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    horse.facingAngle += diff * Math.min(1.0, delta * 6.5);

    const followThreshold = 2.35;
    let speed = 0;

    if (dist > followThreshold) {
      const excess = dist - followThreshold;
      speed = Math.min(Math.max(leaderMaxSpeed, 2.2), 1.8 + excess * 3.8);
      const totalStep = Math.min(excess + 0.08, speed * delta);
      const colliderRadius = horse.hasCarriage ? 1.15 : 0.85;
      const subSteps = Math.max(1, Math.ceil(totalStep / 0.08));
      const stepLen = totalStep / subSteps;
      const dirX = dx / dist;
      const dirZ = dz / dist;

      for (let s = 0; s < subSteps; s++) {
        horse.pos.x += dirX * stepLen;
        horse.pos.z += dirZ * stepLen;
        horse.pos.y = resolveEnvCollisions(horse.pos, colliderRadius);
        if (enforceBoundary) enforceBoundary(horse.pos);
      }
    }

    if (horse.carriageDoorPivot) {
      horse.carriageDoorPivot.rotation.y = THREE.MathUtils.damp(
        horse.carriageDoorPivot.rotation.y,
        0.64,
        6.0,
        delta
      );
    }

    this.animateHorse(horse, delta, speed, true);
  }

  private isHorsePointBlocked(
    px: number,
    pz: number,
    selfIdx: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    sultanPos?: THREE.Vector3
  ): boolean {
    if (isStaticBlocked && isStaticBlocked(px, pz, 0.96, false)) {
      return true;
    }
    for (let j = 0; j < this.horses.length; j++) {
      if (j === selfIdx) continue;
      const o = this.horses[j];
      if (!o.group.visible) continue;
      const dx = px - o.pos.x;
      const dz = pz - o.pos.z;
      if (dx * dx + dz * dz < 1.95 * 1.95) return true;
      if (o.hasCarriage) {
        const cx = o.pos.x - Math.sin(o.facingAngle) * 2.55;
        const cz = o.pos.z - Math.cos(o.facingAngle) * 2.55;
        const cdx = px - cx;
        const cdz = pz - cz;
        if (cdx * cdx + cdz * cdz < 2.05 * 2.05) return true;
      }
    }
    if (farmAnimals) {
      for (let f = 0; f < farmAnimals.length; f++) {
        const fa = farmAnimals[f];
        const faR = fa.kind === 'cow' ? 0.8 : fa.kind === 'sheep' ? 0.48 : 0.42;
        const minD = 0.92 + faR;
        const dx = px - fa.pos.x;
        const dz = pz - fa.pos.z;
        if (dx * dx + dz * dz < minD * minD) return true;
      }
    }
    if (sultanPos) {
      const sdx = px - sultanPos.x;
      const sdz = pz - sultanPos.z;
      if (sdx * sdx + sdz * sdz < 1.45 * 1.45) return true;
    }
    return false;
  }

  private chooseWanderSteerAngle(
    h: HorseEntity,
    selfIdx: number,
    desiredAngle: number,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    sultanPos?: THREE.Vector3
  ): number {
    const offsets = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7];
    for (let i = 0; i < offsets.length; i++) {
      const ang = desiredAngle + offsets[i];
      const px = h.pos.x + Math.sin(ang) * 1.35;
      const pz = h.pos.z + Math.cos(ang) * 1.35;
      if (!this.isHorsePointBlocked(px, pz, selfIdx, isStaticBlocked, farmAnimals, sultanPos)) {
        return ang;
      }
    }
    return desiredAngle;
  }

  public updateUnmounted(
    delta: number,
    mountedHorseId: string | null,
    ledHorseId: string | null,
    resolveEnvCollisions: (pos: THREE.Vector3, radius: number) => number,
    sultanPos?: THREE.Vector3,
    enforceBoundary?: (pos: THREE.Vector3) => void,
    isStaticBlocked?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean,
    farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[],
    citizens?: { pos: THREE.Vector3; group?: THREE.Group }[]
  ) {
    this.updateTickCount++;
    const tick = this.updateTickCount;
    if (this.movedFlags.length < this.horses.length) {
      this.movedFlags = new Uint8Array(this.horses.length);
    }
    this.movedFlags.fill(0);

    for (let i = 0; i < this.horses.length; i++) {
      const h = this.horses[i];
      if (h.id === mountedHorseId || h.id === ledHorseId || h.ownerCitizenId) continue;
      if (!h.group.visible) continue;

      h.accumDelta += delta;
      if (sultanPos) {
        const dxS = h.pos.x - sultanPos.x;
        const dzS = h.pos.z - sultanPos.z;
        const distSq = dxS * dxS + dzS * dzS;
        if (distSq > 42 * 42) {
          if ((tick & 3) !== (i & 3)) continue;
        } else if (distSq > 24 * 24) {
          if ((tick & 1) !== (i & 1)) continue;
        }
      }
      const dt = Math.min(h.accumDelta, 0.16);
      h.accumDelta = 0;

      let speed = 0;

      if (!h.hasCarriage && h.wanderRadius > 0) {
        h.wanderTimer -= dt;
        if (h.wanderTimer <= 0) {
          h.isWandering = !h.isWandering;
          if (h.isWandering) {
            h.wanderAngle = Math.random() * Math.PI * 2;
            h.wanderTimer = 1.6 + Math.random() * 2.2;
          } else {
            h.wanderTimer = 2.5 + Math.random() * 4.0;
          }
        }

        if (h.isWandering) {
          const targetX = h.homeX + Math.cos(h.wanderAngle) * h.wanderRadius;
          const targetZ = h.homeZ + Math.sin(h.wanderAngle) * h.wanderRadius;
          const dx = targetX - h.pos.x;
          const dz = targetZ - h.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0.25) {
            speed = 1.65;
            const desiredAngle = this.chooseWanderSteerAngle(
              h,
              i,
              Math.atan2(dx, dz),
              isStaticBlocked,
              farmAnimals,
              sultanPos
            );
            let diff = desiredAngle - h.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            h.facingAngle += diff * Math.min(1, dt * 3.5);

            const totalMove = Math.min(dist, speed * dt);
            const subSteps = Math.max(1, Math.ceil(totalMove / 0.08));
            const stepLen = totalMove / subSteps;
            const dirX = Math.sin(h.facingAngle);
            const dirZ = Math.cos(h.facingAngle);

            for (let s = 0; s < subSteps; s++) {
              h.pos.x += dirX * stepLen;
              h.pos.z += dirZ * stepLen;
              resolveEnvCollisions(h.pos, 0.9);
              if (enforceBoundary) enforceBoundary(h.pos);
            }
          } else {
            h.isWandering = false;
            h.wanderTimer = 3.0 + Math.random() * 3.0;
          }
        }
      }

      if (h.carriageDoorPivot && Math.abs(h.carriageDoorPivot.rotation.y - 0.64) > 0.002) {
        h.carriageDoorPivot.rotation.y = THREE.MathUtils.damp(
          h.carriageDoorPivot.rotation.y,
          0.64,
          6.0,
          dt
        );
      }

      this.animateHorse(h, dt, speed, true);
    }

    // Un-throttled separation for wandering horses vs all other horses/carriages, farm animals, citizens, and Sultan
    const count = this.horses.length;
    for (let i = 0; i < count; i++) {
      const h = this.horses[i];
      if (!h.group.visible) continue;
      if (h.id === mountedHorseId || h.id === ledHorseId || h.ownerCitizenId) continue;
      if (h.hasCarriage || h.wanderRadius <= 0) continue;

      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const o = this.horses[j];
        if (!o.group.visible) continue;

        const isOtherFreeWanderer =
          !o.hasCarriage &&
          o.wanderRadius > 0 &&
          !o.ownerCitizenId &&
          o.id !== mountedHorseId &&
          o.id !== ledHorseId;

        const dx = h.pos.x - o.pos.x;
        const dz = h.pos.z - o.pos.z;
        const minR = 1.82;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = minR - d;
          const share = isOtherFreeWanderer ? 0.5 : 1.0;
          h.pos.x += (dx / d) * overlap * share;
          h.pos.z += (dz / d) * overlap * share;
          this.movedFlags[i] = 1;
          if (isOtherFreeWanderer) {
            o.pos.x -= (dx / d) * overlap * share;
            o.pos.z -= (dz / d) * overlap * share;
            this.movedFlags[j] = 1;
          }
        }

        if (o.hasCarriage) {
          const cx = o.pos.x - Math.sin(o.facingAngle) * 2.55;
          const cz = o.pos.z - Math.cos(o.facingAngle) * 2.55;
          const cdx = h.pos.x - cx;
          const cdz = h.pos.z - cz;
          const minC = 1.95;
          const cDistSq = cdx * cdx + cdz * cdz;
          if (cDistSq < minC * minC && cDistSq > 0.0001) {
            const d = Math.sqrt(cDistSq);
            const push = minC / d;
            h.pos.x = cx + cdx * push;
            h.pos.z = cz + cdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (farmAnimals) {
        for (let f = 0; f < farmAnimals.length; f++) {
          const fa = farmAnimals[f];
          const faR = fa.kind === 'cow' ? 0.78 : fa.kind === 'sheep' ? 0.45 : 0.38;
          const fdx = h.pos.x - fa.pos.x;
          const fdz = h.pos.z - fa.pos.z;
          const minF = 0.9 + faR + 0.06;
          const fDistSq = fdx * fdx + fdz * fdz;
          if (fDistSq < minF * minF && fDistSq > 0.0001) {
            const d = Math.sqrt(fDistSq);
            const push = minF / d;
            h.pos.x = fa.pos.x + fdx * push;
            h.pos.z = fa.pos.z + fdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (citizens) {
        for (let cIdx = 0; cIdx < citizens.length; cIdx++) {
          const c = citizens[cIdx];
          if (c.group && !c.group.visible) continue;
          const cdx = h.pos.x - c.pos.x;
          const cdz = h.pos.z - c.pos.z;
          const minCit = 1.32;
          const cDistSq = cdx * cdx + cdz * cdz;
          if (cDistSq < minCit * minCit && cDistSq > 0.0001) {
            const d = Math.sqrt(cDistSq);
            const push = minCit / d;
            h.pos.x = c.pos.x + cdx * push;
            h.pos.z = c.pos.z + cdz * push;
            this.movedFlags[i] = 1;
          }
        }
      }

      if (sultanPos) {
        const sdx = h.pos.x - sultanPos.x;
        const sdz = h.pos.z - sultanPos.z;
        const minS = mountedHorseId ? 1.85 : 1.35;
        const sDistSq = sdx * sdx + sdz * sdz;
        if (sDistSq < minS * minS && sDistSq > 0.0001) {
          const d = Math.sqrt(sDistSq);
          const push = minS / d;
          h.pos.x = sultanPos.x + sdx * push;
          h.pos.z = sultanPos.z + sdz * push;
          this.movedFlags[i] = 1;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      if (!this.movedFlags[i]) continue;
      const h = this.horses[i];
      resolveEnvCollisions(h.pos, 0.9);
      if (enforceBoundary) enforceBoundary(h.pos);
      h.group.position.copy(h.pos);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
