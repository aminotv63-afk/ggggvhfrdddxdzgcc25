import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';

export const CAFE_ORIGIN = { x: 22.0, z: 53.0 } as const;
export const CAFE_ROT_Y = -Math.PI * 0.88; // Faces North-West toward South Avenue & Farm Gate

export type CafeNpcKind = 'owner' | 'seated' | 'standing';

export interface CafeNpcSlot {
  id: string;
  labelAr: string;
  kind: CafeNpcKind;
  seatPos: THREE.Vector3;
  seatFacing: number;
  standPos: THREE.Vector3;
  standFacing: number;
}

function cafeLocalToWorld(lx: number, ly: number, lz: number): THREE.Vector3 {
  const cosR = Math.cos(CAFE_ROT_Y);
  const sinR = Math.sin(CAFE_ROT_Y);
  return new THREE.Vector3(
    CAFE_ORIGIN.x + lx * cosR + lz * sinR,
    ly,
    CAFE_ORIGIN.z - lx * sinR + lz * cosR
  );
}

/**
 * Deterministic world-space spawn/seat/stand coordinates for the Cafe Owner,
 * 5 seated patrons at interior tables, and 2 standing patrons inside the cafe.
 */
export function getCafeNpcSlots(): CafeNpcSlot[] {
  const seatY = 0.33; // Matches chair cushion top (0.46m) - 0.13m rig hip offset
  const floorY = 0.04;

  const specs: {
    id: string;
    labelAr: string;
    kind: CafeNpcKind;
    seatLocal: [number, number, number];
    seatLocalYaw: number;
    standLocal: [number, number, number];
    standLocalYaw: number;
  }[] = [
    // Cafe Owner behind the service counter
    {
      id: 'c_cafe_owner',
      labelAr: 'صاحب المقهى',
      kind: 'owner',
      seatLocal: [0, floorY, -2.98],
      seatLocalYaw: 0,
      standLocal: [0, floorY, -2.98],
      standLocalYaw: 0,
    },
    // Front-Left Table (-2.95, +1.35): Patron 1 (North chair) & Patron 2 (South chair)
    {
      id: 'c_cafe_pat1',
      labelAr: 'زبون المقهى (أبو طارق)',
      kind: 'seated',
      seatLocal: [-2.95, seatY, 0.52],
      seatLocalYaw: 0,
      standLocal: [-2.02, floorY, 0.52],
      standLocalYaw: 0.4,
    },
    {
      id: 'c_cafe_pat2',
      labelAr: 'زبون المقهى (أبو سامي)',
      kind: 'seated',
      seatLocal: [-2.95, seatY, 2.18],
      seatLocalYaw: Math.PI,
      standLocal: [-2.02, floorY, 2.18],
      standLocalYaw: Math.PI - 0.4,
    },
    // Back-Left Table (-2.95, -1.25): Patron 3 (South chair)
    {
      id: 'c_cafe_pat3',
      labelAr: 'زبون المقهى (أبو كريم)',
      kind: 'seated',
      seatLocal: [-2.95, seatY, -0.42],
      seatLocalYaw: Math.PI,
      standLocal: [-2.02, floorY, -0.42],
      standLocalYaw: Math.PI - 0.3,
    },
    // Front-Right Table (+2.95, +1.35): Patron 4 (North chair)
    {
      id: 'c_cafe_pat4',
      labelAr: 'زبون المقهى (أبو فهد)',
      kind: 'seated',
      seatLocal: [2.95, seatY, 0.52],
      seatLocalYaw: 0,
      standLocal: [2.02, floorY, 0.52],
      standLocalYaw: -0.4,
    },
    // Back-Right Table (+2.95, -1.25): Patron 5 (South chair)
    {
      id: 'c_cafe_pat5',
      labelAr: 'زبون المقهى (أبو وليد)',
      kind: 'seated',
      seatLocal: [2.95, seatY, -0.42],
      seatLocalYaw: Math.PI,
      standLocal: [2.02, floorY, -0.42],
      standLocalYaw: -Math.PI + 0.3,
    },
    // Two standing patrons chatting inside the cafe
    {
      id: 'c_cafe_stand1',
      labelAr: 'زبون المقهى (ضيف القهوة)',
      kind: 'standing',
      seatLocal: [-1.05, floorY, -1.12],
      seatLocalYaw: Math.PI * 0.85,
      standLocal: [-1.05, floorY, -1.12],
      standLocalYaw: Math.PI * 0.85,
    },
    {
      id: 'c_cafe_stand2',
      labelAr: 'زبون المقهى (نديم الشاي)',
      kind: 'standing',
      seatLocal: [1.55, floorY, 2.22],
      seatLocalYaw: -Math.PI * 0.65,
      standLocal: [1.55, floorY, 2.22],
      standLocalYaw: -Math.PI * 0.65,
    },
  ];

  return specs.map((s) => ({
    id: s.id,
    labelAr: s.labelAr,
    kind: s.kind,
    seatPos: cafeLocalToWorld(s.seatLocal[0], s.seatLocal[1], s.seatLocal[2]),
    seatFacing: s.seatLocalYaw + CAFE_ROT_Y,
    standPos: cafeLocalToWorld(s.standLocal[0], s.standLocal[1], s.standLocal[2]),
    standFacing: s.standLocalYaw + CAFE_ROT_Y,
  }));
}

/**
 * Royal Kingdom Cafe ("مقهى المملكة")
 * Features a walkable interior with stone & woven-rug floors, open arched display windows,
 * service counter with brass coffee pots (dallah) & teacup racks, 4 tables with chairs,
 * warm lanterns, overhead Arabic signboard, and automatic roof cutaway when the Sultan enters
 * so the player sees everyone inside stand up and bow to him clearly.
 */
export class RoyalCafe {
  public group: THREE.Group;
  public readonly origin = new THREE.Vector3(CAFE_ORIGIN.x, 0, CAFE_ORIGIN.z);
  public readonly rotY: number = CAFE_ROT_Y;

  private readonly cosR: number;
  private readonly sinR: number;
  private disposables: { dispose: () => void }[] = [];

  private lanternGlowMat!: THREE.MeshStandardMaterial;
  private interiorLight: THREE.PointLight | null = null;
  private roofGroup!: THREE.Group;
  private roofMaterials: THREE.MeshStandardMaterial[] = [];
  private roofFade: number = 1;
  private wasSultanInside: boolean = false;
  private currentNightAmount: number = 0;

  constructor(
    targetBoxColliders: OBBCollider[],
    targetFootprints?: { x: number; z: number; r: number }[]
  ) {
    this.cosR = Math.cos(this.rotY);
    this.sinR = Math.sin(this.rotY);

    this.group = new THREE.Group();
    this.group.name = 'RoyalCafe';
    this.group.position.copy(this.origin);
    this.group.rotation.y = this.rotY;

    this.buildCafe(targetBoxColliders);

    this.group.updateMatrixWorld(true);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.matrixAutoUpdate = false;
      }
    });

    if (targetFootprints) {
      targetFootprints.push({ x: this.origin.x, z: this.origin.z, r: 7.4 });
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private localToWorld(lx: number, ly: number, lz: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.origin.x + lx * this.cosR + lz * this.sinR,
      ly,
      this.origin.z - lx * this.sinR + lz * this.cosR
    );
  }

  private registerLocalOBB(
    targetBoxColliders: OBBCollider[],
    lx: number,
    lz: number,
    width: number,
    depth: number,
    topY: number,
    allowStand: boolean = false
  ): OBBCollider {
    const worldPos = this.localToWorld(lx, 0, lz);
    const col: OBBCollider = {
      cx: worldPos.x,
      cz: worldPos.z,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      cosY: Math.cos(-this.rotY),
      sinY: Math.sin(-this.rotY),
      topY,
      allowStand,
    };
    targetBoxColliders.push(col);
    return col;
  }

  /**
   * Returns true while the Sultan is inside the cafe interior (with doorway hysteresis).
   */
  public isSultanInside(worldPos: THREE.Vector3): boolean {
    const dx = worldPos.x - this.origin.x;
    const dz = worldPos.z - this.origin.z;
    const lx = dx * this.cosR - dz * this.sinR;
    const lz = dx * this.sinR + dz * this.cosR;

    if (this.wasSultanInside) {
      if (Math.abs(lx) > 4.65 || lz < -3.7 || lz > 3.85) {
        this.wasSultanInside = false;
      }
    } else {
      if (Math.abs(lx) <= 4.35 && lz >= -3.45 && lz <= 3.35) {
        this.wasSultanInside = true;
      }
    }
    return this.wasSultanInside;
  }

  private createSignTexture(
    title: string,
    subtitle: string | null,
    bgHex: string,
    borderHex: string,
    titleHex: string,
    subHex: string,
    width: number = 1024,
    height: number = 256
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    ctx.strokeStyle = '#926728';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    if (subtitle) {
      ctx.fillStyle = titleHex;
      ctx.font = '800 84px "Marhey", "Tajawal", sans-serif';
      ctx.fillText(title, width / 2, height * 0.38);

      ctx.fillStyle = subHex;
      ctx.font = '700 42px "Tajawal", sans-serif';
      ctx.fillText(subtitle, width / 2, height * 0.74);
    } else {
      ctx.fillStyle = titleHex;
      ctx.font = '800 88px "Marhey", "Tajawal", sans-serif';
      ctx.fillText(title, width / 2, height / 2 + 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private createRugTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#7c1d24';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#d4a644';
    ctx.lineWidth = 22;
    ctx.strokeRect(22, 22, 468, 468);

    ctx.strokeStyle = '#f3e3bd';
    ctx.lineWidth = 8;
    ctx.strokeRect(50, 50, 412, 412);

    ctx.fillStyle = '#531319';
    ctx.fillRect(72, 72, 368, 368);

    // Ornate central diamond medallion
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(256, 120);
    ctx.lineTo(360, 256);
    ctx.lineTo(256, 392);
    ctx.lineTo(152, 256);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#7c1d24';
    ctx.beginPath();
    ctx.moveTo(256, 175);
    ctx.lineTo(315, 256);
    ctx.lineTo(256, 337);
    ctx.lineTo(197, 256);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildCafe(targetBoxColliders: OBBCollider[]) {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    const floorStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xd8cdb8,
        roughness: 0.88,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const terraceMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xbcb19f,
        roughness: 0.92,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const wallPlasterMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe9dcc2,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    const stoneTrimMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x9b8f7e,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    const woodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x7c4e29,
        roughness: 0.8,
        metalness: 0.04,
      })
    );
    const darkWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x4b2c15,
        roughness: 0.84,
        metalness: 0.05,
      })
    );
    const marbleMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf1ece2,
        roughness: 0.34,
        metalness: 0.08,
      })
    );
    const brassMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xdba83e,
        roughness: 0.24,
        metalness: 0.88,
      })
    );
    const copperMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xc26c38,
        roughness: 0.3,
        metalness: 0.84,
      })
    );
    const ceramicMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf6f3ea,
        roughness: 0.32,
        metalness: 0.04,
      })
    );
    const teaGlassMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xb44318,
        roughness: 0.18,
        metalness: 0.12,
      })
    );
    const cushionMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x8b1e28,
        roughness: 0.85,
        metalness: 0.02,
      })
    );
    const awningRedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x9a2029,
        roughness: 0.86,
        metalness: 0.02,
      })
    );
    const awningCreamMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf3e4c3,
        roughness: 0.86,
        metalness: 0.02,
      })
    );
    const rugMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.createRugTexture(),
        roughness: 0.92,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    this.lanternGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffe49e,
        emissive: 0xffa436,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );

    // 1. Walkable Exterior Stone Apron & Interior Floor (low step, zero blocking collider)
    const apron = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.6, 0.03, 2.5)), terraceMat);
    apron.position.set(0, 0.015, 4.9);
    apron.receiveShadow = true;
    this.group.add(apron);

    const floorMesh = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(9.2, 0.04, 7.4)),
      floorStoneMat
    );
    floorMesh.position.set(0, 0.02, 0);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // Central woven crimson runner rug leading from doorway toward counter
    const rug = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.3, 5.1)), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.046, 0.75);
    rug.receiveShadow = true;
    this.group.add(rug);

    // 2. Walls (Back Solid Wall, Open-Window Side Walls, Front Entrance Facade with 2.9m Doorway)
    const wallH = 3.45;

    // Back wall (z = -3.56)
    const backDado = new THREE.Mesh(this.track(new THREE.BoxGeometry(9.2, 1.15, 0.3)), stoneTrimMat);
    backDado.position.set(0, 0.575, -3.56);
    backDado.castShadow = true;
    backDado.receiveShadow = true;
    this.group.add(backDado);

    const backUpper = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(9.2, wallH - 1.15, 0.28)),
      wallPlasterMat
    );
    backUpper.position.set(0, 1.15 + (wallH - 1.15) * 0.5, -3.56);
    backUpper.castShadow = true;
    backUpper.receiveShadow = true;
    this.group.add(backUpper);
    this.registerLocalOBB(targetBoxColliders, 0, -3.56, 9.2, 0.36, wallH);

    // Side walls (x = -4.46 and x = +4.46) with twin wide open cafe windows
    const buildWindowedSideWall = (sx: number) => {
      const sideG = new THREE.Group();
      sideG.position.set(sx, 0, 0);

      const dado = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.3, 1.05, 7.4)), stoneTrimMat);
      dado.position.y = 0.525;
      dado.castShadow = true;
      dado.receiveShadow = true;
      sideG.add(dado);

      const header = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.28, 0.85, 7.4)),
        wallPlasterMat
      );
      header.position.y = 2.6 + 0.425;
      header.castShadow = true;
      sideG.add(header);

      const pillarGeo = this.track(new THREE.BoxGeometry(0.3, 1.55, 0.7));
      [-3.35, 0, 3.35].forEach((pz) => {
        const pillar = new THREE.Mesh(pillarGeo, wallPlasterMat);
        pillar.position.set(0, 1.05 + 0.775, pz);
        pillar.castShadow = true;
        sideG.add(pillar);
      });

      const sillGeo = this.track(new THREE.BoxGeometry(0.36, 0.08, 2.75));
      [-1.68, 1.68].forEach((wz) => {
        const sill = new THREE.Mesh(sillGeo, darkWoodMat);
        sill.position.set(0, 1.08, wz);
        sideG.add(sill);

        // Decorative wooden lattice mullions near top of open window
        for (let m = -1; m <= 1; m++) {
          const bar = new THREE.Mesh(
            this.track(new THREE.BoxGeometry(0.06, 1.5, 0.06)),
            woodMat
          );
          bar.position.set(0, 1.82, wz + m * 0.76);
          sideG.add(bar);
        }
      });

      this.group.add(sideG);
      this.registerLocalOBB(targetBoxColliders, sx, 0, 0.36, 7.4, wallH);
    };

    buildWindowedSideWall(-4.46);
    buildWindowedSideWall(4.46);

    // Front Facade (z = +3.56) with central 2.9m open arched doorway (lx in [-1.45, +1.45])
    const buildFrontWing = (cx: number) => {
      const wg = new THREE.Group();
      wg.position.set(cx, 0, 3.56);

      const dado = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.15, 1.05, 0.3)), stoneTrimMat);
      dado.position.y = 0.525;
      dado.castShadow = true;
      dado.receiveShadow = true;
      wg.add(dado);

      const header = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(3.15, 0.85, 0.28)),
        wallPlasterMat
      );
      header.position.y = 2.6 + 0.425;
      header.castShadow = true;
      wg.add(header);

      const outerPillar = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.55, 1.55, 0.3)),
        wallPlasterMat
      );
      outerPillar.position.set(cx < 0 ? -1.3 : 1.3, 1.05 + 0.775, 0);
      outerPillar.castShadow = true;
      wg.add(outerPillar);

      const innerPillar = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.45, 1.55, 0.3)),
        wallPlasterMat
      );
      innerPillar.position.set(cx < 0 ? 1.35 : -1.35, 1.05 + 0.775, 0);
      innerPillar.castShadow = true;
      wg.add(innerPillar);

      const sill = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(2.2, 0.08, 0.38)),
        darkWoodMat
      );
      sill.position.set(cx < 0 ? 0.05 : -0.05, 1.08, 0);
      wg.add(sill);

      this.group.add(wg);
      this.registerLocalOBB(targetBoxColliders, cx, 3.56, 3.15, 0.36, wallH);
    };

    buildFrontWing(-3.025);
    buildFrontWing(3.025);

    // Grand Doorway Timber Frame & Overhead Lintel (x in [-1.45, +1.45])
    const doorPostGeo = this.track(new THREE.BoxGeometry(0.18, 2.7, 0.34));
    [-1.45, 1.45].forEach((px) => {
      const post = new THREE.Mesh(doorPostGeo, darkWoodMat);
      post.position.set(px, 1.35, 3.56);
      post.castShadow = true;
      this.group.add(post);
    });

    const doorHeader = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.2, 0.82, 0.32)),
      wallPlasterMat
    );
    doorHeader.position.set(0, 3.04, 3.56);
    doorHeader.castShadow = true;
    this.group.add(doorHeader);

    const doorBeam = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.26, 0.16, 0.38)),
      darkWoodMat
    );
    doorBeam.position.set(0, 2.66, 3.56);
    this.group.add(doorBeam);

    // Striped Crimson & Cream Entrance Awning above doorway
    const stripeCount = 9;
    const awningW = 4.6;
    const stripeW = awningW / stripeCount;
    const stripeGeo = this.track(new THREE.BoxGeometry(stripeW, 0.07, 1.35));
    for (let s = 0; s < stripeCount; s++) {
      const stripe = new THREE.Mesh(stripeGeo, s % 2 === 0 ? awningRedMat : awningCreamMat);
      stripe.position.set(-awningW * 0.5 + stripeW * (s + 0.5), 2.52, 4.24);
      stripe.rotation.x = 0.28;
      stripe.castShadow = true;
      this.group.add(stripe);
    }

    // Overhead Royal Arabic Signboard ("مقهى المملكة")
    const signFrame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.6, 0.92, 0.14)),
      darkWoodMat
    );
    signFrame.position.set(0, 3.32, 3.8);
    signFrame.castShadow = true;
    this.group.add(signFrame);

    const signTex = this.createSignTexture(
      'مقهى المملكة',
      'قهوة عربية • شاي بالنعناع • ضيافة ملكية',
      '#24140b',
      '#e3b247',
      '#fef3c7',
      '#fcd34d'
    );
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xfff4d6),
        emissiveMap: signTex,
        emissiveIntensity: 0.25,
        roughness: 0.6,
      })
    );
    const signFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.42, 0.78)), signMat);
    signFace.position.set(0, 3.32, 3.88);
    this.group.add(signFace);

    // 3. Interior Service Counter (back center z = -2.15) & Menu Board
    const counterBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.55, 0.98, 0.76)),
      woodMat
    );
    counterBase.position.set(0, 0.49, -2.15);
    counterBase.castShadow = true;
    counterBase.receiveShadow = true;
    this.group.add(counterBase);

    const counterTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.72, 0.09, 0.9)),
      marbleMat
    );
    counterTop.position.set(0, 1.02, -2.15);
    counterTop.castShadow = true;
    counterTop.receiveShadow = true;
    this.group.add(counterTop);
    this.registerLocalOBB(targetBoxColliders, 0, -2.15, 3.7, 0.9, 1.15);

    // Back wall wooden shelf & hanging Arabic menu plaque behind owner
    const backShelf = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.4, 0.08, 0.36)),
      darkWoodMat
    );
    backShelf.position.set(0, 1.45, -3.25);
    this.group.add(backShelf);

    const jarGeo = this.track(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10));
    [-1.2, -0.75, 0.75, 1.2].forEach((jx, idx) => {
      const jar = new THREE.Mesh(jarGeo, idx % 2 === 0 ? copperMat : ceramicMat);
      jar.position.set(jx, 1.6, -3.25);
      this.group.add(jar);
    });

    const menuTex = this.createSignTexture(
      'قائمة المقهى الملكي',
      'قهوة عربية بالهيل • شاي بالنعناع • تمر وحلوى',
      '#1c120c',
      '#d4a644',
      '#fde68a',
      '#e7e5e4',
      896,
      240
    );
    const menuMat = this.track(
      new THREE.MeshStandardMaterial({
        map: menuTex,
        emissive: new THREE.Color(0xfff0cc),
        emissiveMap: menuTex,
        emissiveIntensity: 0.2,
        roughness: 0.65,
      })
    );
    const menuBoard = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.3, 0.62)), menuMat);
    menuBoard.position.set(0, 2.38, -3.4);
    this.group.add(menuBoard);

    // Brass Arabic Coffee Pot (Dallah) & Copper Samovar on the Service Counter
    const buildDallah = (dx: number, dy: number, dz: number, s: number = 1) => {
      const dg = new THREE.Group();
      dg.position.set(dx, dy, dz);
      dg.scale.setScalar(s);
      const belly = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.11, 10, 8)), brassMat);
      belly.position.y = 0.11;
      belly.scale.set(1, 1.2, 1);
      dg.add(belly);
      const neck = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.045, 0.075, 0.14, 10)),
        brassMat
      );
      neck.position.y = 0.24;
      dg.add(neck);
      const lid = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.055, 0.09, 10)), brassMat);
      lid.position.y = 0.34;
      dg.add(lid);
      const spout = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.012, 0.025, 0.18, 6)),
        brassMat
      );
      spout.position.set(0.11, 0.2, 0);
      spout.rotation.z = -0.82;
      dg.add(spout);
      this.group.add(dg);
    };
    buildDallah(-0.95, 1.065, -2.08, 1.0);
    buildDallah(0.85, 1.065, -2.18, 0.9);

    const samovar = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.14, 0.17, 0.38, 12)),
      copperMat
    );
    samovar.position.set(1.32, 1.25, -2.15);
    this.group.add(samovar);

    // Tray with 4 little tea glasses on counter
    const counterTray = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.28, 0.25, 0.03, 14)),
      brassMat
    );
    counterTray.position.set(0, 1.08, -2.06);
    this.group.add(counterTray);

    const glassGeo = this.track(new THREE.CylinderGeometry(0.034, 0.026, 0.08, 8));
    [
      [-0.1, -0.06],
      [0.1, -0.06],
      [-0.08, 0.09],
      [0.08, 0.09],
    ].forEach(([gx, gz]) => {
      const glass = new THREE.Mesh(glassGeo, teaGlassMat);
      glass.position.set(gx, 1.135, -2.06 + gz);
      this.group.add(glass);
    });

    // 4. 4 Cafe Tables with Brass Trays, Cups & Chairs (2 per wing, wide 3m central aisle!)
    const tableTopGeo = this.track(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16));
    const tableLegGeo = this.track(new THREE.CylinderGeometry(0.055, 0.08, 0.72, 10));
    const tableBaseGeo = this.track(new THREE.CylinderGeometry(0.28, 0.34, 0.07, 12));
    const trayGeo = this.track(new THREE.CylinderGeometry(0.22, 0.19, 0.025, 12));
    const cupGeo = this.track(new THREE.CylinderGeometry(0.032, 0.024, 0.065, 8));

    const buildTable = (tx: number, tz: number) => {
      const tg = new THREE.Group();
      tg.position.set(tx, 0.04, tz);

      const base = new THREE.Mesh(tableBaseGeo, darkWoodMat);
      base.position.y = 0.035;
      base.castShadow = true;
      tg.add(base);

      const leg = new THREE.Mesh(tableLegGeo, darkWoodMat);
      leg.position.y = 0.38;
      leg.castShadow = true;
      tg.add(leg);

      const top = new THREE.Mesh(tableTopGeo, woodMat);
      top.position.y = 0.73;
      top.castShadow = true;
      top.receiveShadow = true;
      tg.add(top);

      const tray = new THREE.Mesh(trayGeo, brassMat);
      tray.position.y = 0.77;
      tg.add(tray);

      const pot = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.04, 0.065, 0.15, 8)), copperMat);
      pot.position.set(-0.04, 0.85, -0.02);
      tg.add(pot);

      const cup1 = new THREE.Mesh(cupGeo, teaGlassMat);
      cup1.position.set(0.08, 0.81, 0.05);
      tg.add(cup1);

      const cup2 = new THREE.Mesh(cupGeo, ceramicMat);
      cup2.position.set(0.05, 0.81, -0.08);
      tg.add(cup2);

      this.group.add(tg);
      this.registerLocalOBB(targetBoxColliders, tx, tz, 1.0, 1.0, 0.85);
    };

    const chairSeatGeo = this.track(new THREE.BoxGeometry(0.44, 0.06, 0.44));
    const chairCushionGeo = this.track(new THREE.BoxGeometry(0.4, 0.04, 0.4));
    const chairLegGeo = this.track(new THREE.BoxGeometry(0.055, 0.4, 0.055));
    const chairBackPostGeo = this.track(new THREE.BoxGeometry(0.055, 0.5, 0.055));
    const chairBackRailGeo = this.track(new THREE.BoxGeometry(0.42, 0.14, 0.05));

    const buildChair = (cx: number, cz: number, yaw: number) => {
      const cg = new THREE.Group();
      cg.position.set(cx, 0.04, cz);
      cg.rotation.y = yaw;

      const seat = new THREE.Mesh(chairSeatGeo, woodMat);
      seat.position.y = 0.39;
      seat.castShadow = true;
      seat.receiveShadow = true;
      cg.add(seat);

      const cushion = new THREE.Mesh(chairCushionGeo, cushionMat);
      cushion.position.y = 0.43;
      cg.add(cushion);

      [
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(chairLegGeo, darkWoodMat);
        leg.position.set(lx, 0.2, lz);
        leg.castShadow = true;
        cg.add(leg);
      });

      // Backrest on local -Z so seated person faces local +Z toward the table
      [-0.17, 0.17].forEach((bx) => {
        const post = new THREE.Mesh(chairBackPostGeo, darkWoodMat);
        post.position.set(bx, 0.65, -0.18);
        post.castShadow = true;
        cg.add(post);
      });
      const topRail = new THREE.Mesh(chairBackRailGeo, woodMat);
      topRail.position.set(0, 0.82, -0.18);
      topRail.castShadow = true;
      cg.add(topRail);

      const midRail = new THREE.Mesh(chairBackRailGeo, woodMat);
      midRail.position.set(0, 0.61, -0.18);
      cg.add(midRail);

      this.group.add(cg);
      this.registerLocalOBB(targetBoxColliders, cx, cz, 0.48, 0.48, 0.92);
    };

    // Left Tables & Chairs
    buildTable(-2.95, 1.35);
    buildChair(-2.95, 0.52, 0);
    buildChair(-2.95, 2.18, Math.PI);

    buildTable(-2.95, -1.25);
    buildChair(-2.95, -0.42, Math.PI);
    buildChair(-2.95, -2.08, 0);

    // Right Tables & Chairs
    buildTable(2.95, 1.35);
    buildChair(2.95, 0.52, 0);
    buildChair(2.95, 2.18, Math.PI);

    buildTable(2.95, -1.25);
    buildChair(2.95, -0.42, Math.PI);
    buildChair(2.95, -2.08, 0);

    // 5. Warm Brass Lanterns (interior + doorway entrance brackets) & Cozy Interior Light
    const lanternCapGeo = this.track(new THREE.ConeGeometry(0.16, 0.14, 6));
    const lanternGlassGeo = this.track(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 6));
    const chainGeo = this.track(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6));

    const addHangingLantern = (lx: number, ly: number, lz: number, parent: THREE.Object3D) => {
      const lg = new THREE.Group();
      lg.position.set(lx, ly, lz);

      const chain = new THREE.Mesh(chainGeo, darkWoodMat);
      chain.position.y = 0.34;
      lg.add(chain);

      const cap = new THREE.Mesh(lanternCapGeo, brassMat);
      cap.position.y = 0.12;
      lg.add(cap);

      const glass = new THREE.Mesh(lanternGlassGeo, this.lanternGlowMat);
      glass.position.y = -0.02;
      lg.add(glass);

      const base = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.09, 0.04, 0.06, 6)),
        brassMat
      );
      base.position.y = -0.15;
      lg.add(base);

      parent.add(lg);
    };

    // Exterior doorway lanterns stay visible at all times
    [-1.72, 1.72].forEach((lx) => {
      const bracket = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.08, 0.08, 0.36)),
        darkWoodMat
      );
      bracket.position.set(lx, 2.48, 3.74);
      this.group.add(bracket);
      addHangingLantern(lx, 2.22, 3.88, this.group);
    });

    // Subtle non-shadowed point light inside the cafe for warm interior glow
    this.interiorLight = new THREE.PointLight(0xffb85c, 0.65, 12.5, 1.8);
    this.interiorLight.position.set(0, 2.75, 0.2);
    this.interiorLight.castShadow = false;
    this.group.add(this.interiorLight);

    // 6. Pitched Timber & Terracotta Roof + Exposed Rafters (fades away cleanly when Sultan enters!)
    this.roofGroup = new THREE.Group();
    this.roofGroup.name = 'CafeRoofCutaway';

    const roofTileMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x8d3527,
        roughness: 0.84,
        metalness: 0.04,
      })
    );
    const roofBeamMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x4b2c15,
        roughness: 0.84,
        metalness: 0.05,
      })
    );
    const roofCeilingMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x7c4e29,
        roughness: 0.82,
        metalness: 0.04,
      })
    );
    this.roofMaterials = [roofTileMat, roofBeamMat, roofCeilingMat];

    // Ceiling timber cross-beams
    const beamGeo = this.track(new THREE.BoxGeometry(9.0, 0.16, 0.18));
    [-2.4, -0.8, 0.8, 2.4].forEach((bz) => {
      const beam = new THREE.Mesh(beamGeo, roofBeamMat);
      beam.position.set(0, wallH - 0.04, bz);
      this.roofGroup.add(beam);
    });

    // Interior hanging lanterns attached to roofGroup so they don't float awkwardly when roof cuts away
    [
      [-2.35, 2.86, 1.2],
      [2.35, 2.86, 1.2],
      [-2.35, 2.86, -1.35],
      [2.35, 2.86, -1.35],
    ].forEach(([lx, ly, lz]) => addHangingLantern(lx, ly, lz, this.roofGroup));

    // Pitched roof slopes (left & right slopes over 9.8 x 8.0 footprint)
    const slopeGeo = this.track(new THREE.BoxGeometry(5.15, 0.16, 8.1));
    const leftSlope = new THREE.Mesh(slopeGeo, roofTileMat);
    leftSlope.position.set(-2.35, wallH + 0.56, 0);
    leftSlope.rotation.z = 0.28;
    leftSlope.castShadow = true;
    leftSlope.receiveShadow = true;
    this.roofGroup.add(leftSlope);

    const rightSlope = new THREE.Mesh(slopeGeo, roofTileMat);
    rightSlope.position.set(2.35, wallH + 0.56, 0);
    rightSlope.rotation.z = -0.28;
    rightSlope.castShadow = true;
    rightSlope.receiveShadow = true;
    this.roofGroup.add(rightSlope);

    const ridgeCap = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.42, 0.22, 8.2)),
      roofBeamMat
    );
    ridgeCap.position.set(0, wallH + 1.24, 0);
    this.roofGroup.add(ridgeCap);

    // Gable end triangles (front & back)
    const gableGeo = this.track(new THREE.ConeGeometry(4.65, 1.26, 4));
    gableGeo.rotateY(Math.PI / 4);
    const gable = new THREE.Mesh(gableGeo, roofCeilingMat);
    gable.scale.set(1.42, 1.0, 1.12);
    gable.position.set(0, wallH + 0.62, 0);
    this.roofGroup.add(gable);

    this.group.add(this.roofGroup);
  }

  public update(delta: number, sultanPos: THREE.Vector3) {
    const inside = this.isSultanInside(sultanPos);
    const targetFade = inside ? 0 : 1;
    const speed = inside ? 7.5 : 5.0;
    this.roofFade = THREE.MathUtils.damp(this.roofFade, targetFade, speed, delta);

    const showRoof = this.roofFade > 0.03;
    if (this.roofGroup.visible !== showRoof) {
      this.roofGroup.visible = showRoof;
    }

    if (showRoof) {
      const isTranslucent = this.roofFade < 0.99;
      for (let i = 0; i < this.roofMaterials.length; i++) {
        const m = this.roofMaterials[i];
        if (m.transparent !== isTranslucent) {
          m.transparent = isTranslucent;
          m.depthWrite = !isTranslucent;
          m.needsUpdate = true;
        }
        m.opacity = this.roofFade;
      }
    }
  }

  public setNightAmount(nightAmount: number) {
    const n = Math.max(0, Math.min(1, nightAmount));
    this.currentNightAmount = n;
    if (this.lanternGlowMat) {
      this.lanternGlowMat.emissiveIntensity = 0.95 + n * 2.1;
    }
    if (this.interiorLight) {
      this.interiorLight.intensity = 0.65 + n * 2.15;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.roofMaterials = [];
  }
}
