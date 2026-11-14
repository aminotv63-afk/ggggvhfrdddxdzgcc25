import * as THREE from 'three';
import { CylinderCollider, OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';
import { soundManager } from './audio';

export interface PalaceDoorActor {
  hingePivot: THREE.Group;
  hingePivotRight?: THREE.Group;
  worldPos: THREE.Vector3;
  collider: OBBCollider;
  closedHalfW: number;
  closedHalfD: number;
  openAngle: number;
  openAmount: number;
  targetOpen: number;
  openRadius: number;
  isDouble?: boolean;
}

export interface PalaceGuardPost {
  id: string;
  x: number;
  y?: number;
  z: number;
  rotY: number;
}

interface PalaceWallBox {
  col: OBBCollider;
  minY: number;
  maxY: number;
}

export const PALACE_FLOOR2_Y = 4.5;

/**
 * Enlarged Two-Story Royal Kingdom Palace ("القصر الملكي")
 * Footprint: x in [-27.0..+27.0] (54m wide), z in [-68.0..-30.5] (37.5m deep), 2 full floors + roof domes.
 * Features:
 *  - Rich warm royal travertine/sandstone materials & calibrated interior lighting (no blinding white flash)
 *  - Grand 4.6m-wide double entrance archway & portico
 *  - Twin Monumental Walkable Switchback Staircases ("درج الطابق الثاني") rising gently (0.15m steps, zero jump needed)
 *  - Ground Floor: Central Throne Hall ("درج العرش" + Golden Throne + Vizier Chair), Royal Bedroom, 6 spacious Wing Rooms
 *  - Second Floor ("الطابق الثاني"): Upper Gallery, Upper Royal Diwan, Treasury, Library, Lounge, Armory, Observatory, Suite
 *  - Panoramic South Overlook Balcony ("شرفة الإطلالة الملكية") overlooking the Kingdom Plaza, citizens, sea & forest
 *  - 26 Armored Royal Palace Guards (16 Ground Floor + 10 Second Floor & Overlook Balcony)
 */
export class RoyalPalace {
  public group: THREE.Group;
  public readonly origin = new THREE.Vector3(0, 0, -49.25);
  public readonly entranceWorldPos = new THREE.Vector3(0, 0, -30.5);
  public readonly throneWorldPos = new THREE.Vector3(0, 0.4, -54.27);
  public readonly floor2Y = PALACE_FLOOR2_Y;

  // Sultan Throne sit / stand anchors
  public readonly throneSeatPos = new THREE.Vector3(0, 0.89, -54.23);
  public readonly throneStandPos = new THREE.Vector3(0, 0.4, -52.85);

  // Grand Vizier office, bed sleep anchor, single-bow spot, throne-side chair & routes
  public readonly vizierOfficePos = new THREE.Vector3(16.2, 0.04, -37.65);
  public readonly vizierBedStandPos = new THREE.Vector3(19.0, 0.04, -40.8);
  public readonly vizierSleepPos = new THREE.Vector3(21.2, 0.68, -40.3);
  public readonly vizierBowSpot = new THREE.Vector3(-2.35, 0.4, -52.85);
  public readonly vizierSeatPos = new THREE.Vector3(-2.35, 0.73, -54.21);
  public readonly vizierArrivePath: [number, number][] = [
    [19.0, -40.8],
    [16.2, -37.65],
    [12.0, -37.65],
    [7.4, -37.65],
    [1.6, -46.8],
    [0.0, -48.6],
    [0.0, -52.35],
    [-2.35, -52.85],
  ];
  public readonly vizierReturnPath: [number, number][] = [
    [-2.35, -52.85],
    [0.0, -52.35],
    [0.0, -48.6],
    [1.6, -46.8],
    [7.4, -37.65],
    [12.0, -37.65],
    [16.2, -37.65],
    [19.0, -40.8],
  ];

  // Sultana & Sultan bedroom sleep anchors, daytime Palace patrol & evening outdoor stroll routes
  public readonly sultanaBedSleepPos = new THREE.Vector3(0.95, 0.68, -63.75);
  public readonly sultanaBedStandPos = new THREE.Vector3(-3.1, 0.04, -63.2);
  public readonly sultanBedSleepPos = new THREE.Vector3(-0.95, 0.68, -63.75);
  public readonly sultanBedStandPos = new THREE.Vector3(-2.9, 0.04, -63.6);
  public readonly sultanaPalacePatrolPath: [number, number][] = [
    [-6.0, -61.5],
    [-11.2, -61.5],
    [-11.2, -52.2],
    [-7.4, -49.2],
    [-7.4, -33.6],
    [-3.6, -33.6],
    [3.6, -33.6],
    [7.4, -33.6],
    [7.4, -49.2],
    [11.2, -52.2],
    [11.2, -61.5],
    [6.0, -61.5],
  ];
  public readonly sultanaExitPath: [number, number][] = [
    [-3.1, -63.2],
    [-6.2, -62.0],
    [-11.2, -62.0],
    [-11.2, -52.2],
    [-7.4, -49.2],
    [-7.4, -33.6],
    [-1.8, -32.2],
    [0.0, -30.5],
    [0.0, -26.5],
  ];
  public readonly sultanaReturnPath: [number, number][] = [
    [0.0, -26.5],
    [0.0, -30.5],
    [-1.8, -32.2],
    [-7.4, -33.6],
    [-7.4, -49.2],
    [-11.2, -52.2],
    [-11.2, -62.0],
    [-6.2, -62.0],
    [-3.1, -63.2],
  ];

  // Enlarged Royal Bedroom bounds for Crown Prince & Sultana
  public readonly bedroomBounds = {
    minX: -8.0,
    maxX: 8.0,
    minZ: -66.6,
    maxZ: -57.2,
    playSpot: new THREE.Vector3(3.8, 0.04, -59.8),
    besideMotherSpot: new THREE.Vector3(-3.0, 0.04, -63.6),
  };

  private disposables: { dispose: () => void }[] = [];
  private doors: PalaceDoorActor[] = [];
  private wallBoxes: PalaceWallBox[] = [];
  private throneCollider: OBBCollider | null = null;
  private palaceRatActors: {
    group: THREE.Group;
    tail: THREE.Mesh;
    x: number;
    z: number;
    angle: number;
    speed: number;
    timer: number;
    state: 'hidden' | 'roaming';
    stateTimer: number;
  }[] = [];
  private roofGroup!: THREE.Group;
  private wasSultanInside: boolean = false;

  private interiorLights: THREE.PointLight[] = [];
  private glowMaterials: THREE.MeshStandardMaterial[] = [];
  private bathWaterMat: THREE.MeshStandardMaterial | null = null;
  private waterAnimTime: number = 0;

  constructor(
    targetBoxColliders: OBBCollider[],
    targetCylinderColliders: CylinderCollider[],
    targetFootprints?: { x: number; z: number; r: number }[]
  ) {
    this.group = new THREE.Group();
    this.group.name = 'RoyalPalace';

    this.buildPalace(targetBoxColliders, targetCylinderColliders);

    // Freeze static sub-meshes for optimal CPU performance; keep doors, roofGroup & rats dynamic
    this.group.updateMatrixWorld(true);
    const dynamicRoots = new Set<THREE.Object3D>([this.roofGroup]);
    for (const r of this.palaceRatActors) dynamicRoots.add(r.group);
    for (const d of this.doors) {
      dynamicRoots.add(d.hingePivot);
      if (d.hingePivotRight) dynamicRoots.add(d.hingePivotRight);
    }

    this.group.traverse((obj) => {
      if (dynamicRoots.has(obj)) return;
      let p = obj.parent;
      while (p && p !== this.group) {
        if (dynamicRoots.has(p)) return;
        p = p.parent;
      }
      if ((obj as THREE.Mesh).isMesh) {
        obj.matrixAutoUpdate = false;
      }
    });

    if (targetFootprints) {
      targetFootprints.push({ x: 0, z: -49.25, r: 29.5 });
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  public getPalaceGuardPosts(): PalaceGuardPost[] {
    return [
      // Ground Floor: Gate & outer facade
      { id: 'c_palace_guard_l', x: -4.2, y: 0.04, z: -27.4, rotY: 0 },
      { id: 'c_palace_guard_r', x: 4.2, y: 0.04, z: -27.4, rotY: 0 },
      { id: 'c_palace_guard_front_w', x: -20.5, y: 0.04, z: -29.0, rotY: 0 },
      { id: 'c_palace_guard_front_e', x: 20.5, y: 0.04, z: -29.0, rotY: 0 },
      // Ground Floor: Entrance foyer
      { id: 'c_palace_guard_foyer_l', x: -4.6, y: 0.04, z: -34.2, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_foyer_r', x: 4.6, y: 0.04, z: -34.2, rotY: -Math.PI * 0.5 },
      // Ground Floor: Mid Throne Hall
      { id: 'c_palace_guard_hall_w', x: -5.4, y: 0.04, z: -42.5, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_hall_e', x: 5.4, y: 0.04, z: -42.5, rotY: -Math.PI * 0.5 },
      // Ground Floor: Throne dais flanks
      { id: 'c_palace_guard_throne_l', x: -5.4, y: 0.04, z: -50.6, rotY: 0 },
      { id: 'c_palace_guard_throne_r', x: 5.4, y: 0.04, z: -50.6, rotY: 0 },
      // Ground Floor: West & East Interior Corridors (clear of colonnade & stairs)
      { id: 'c_palace_guard_corridor_w1', x: -7.5, y: 0.04, z: -45.5, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_corridor_w2', x: -11.4, y: 0.04, z: -54.5, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_corridor_e1', x: 7.5, y: 0.04, z: -45.5, rotY: -Math.PI * 0.5 },
      { id: 'c_palace_guard_corridor_e2', x: 11.4, y: 0.04, z: -54.5, rotY: -Math.PI * 0.5 },
      // Ground Floor: Outer side watch
      { id: 'c_palace_guard_ext_w', x: -28.2, y: 0.04, z: -49.2, rotY: -Math.PI * 0.5 },
      { id: 'c_palace_guard_ext_e', x: 28.2, y: 0.04, z: -49.2, rotY: Math.PI * 0.5 },

      // Second Floor & Grand Kingdom Overlook Balcony (y = PALACE_FLOOR2_Y = 4.50)
      { id: 'c_palace_guard_up_balc_c1', x: -3.6, y: PALACE_FLOOR2_Y, z: -27.8, rotY: 0 },
      { id: 'c_palace_guard_up_balc_c2', x: 3.6, y: PALACE_FLOOR2_Y, z: -27.8, rotY: 0 },
      { id: 'c_palace_guard_up_balc_w', x: -14.8, y: PALACE_FLOOR2_Y, z: -28.0, rotY: 0 },
      { id: 'c_palace_guard_up_balc_e', x: 14.8, y: PALACE_FLOOR2_Y, z: -28.0, rotY: 0 },
      { id: 'c_palace_guard_up_stair_w', x: -6.8, y: PALACE_FLOOR2_Y, z: -37.2, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_up_stair_e', x: 6.8, y: PALACE_FLOOR2_Y, z: -37.2, rotY: -Math.PI * 0.5 },
      { id: 'c_palace_guard_up_hall_w', x: -6.8, y: PALACE_FLOOR2_Y, z: -50.2, rotY: Math.PI * 0.5 },
      { id: 'c_palace_guard_up_hall_e', x: 6.8, y: PALACE_FLOOR2_Y, z: -50.2, rotY: -Math.PI * 0.5 },
      { id: 'c_palace_guard_up_diwan_l', x: -3.2, y: PALACE_FLOOR2_Y, z: -54.5, rotY: 0 },
      { id: 'c_palace_guard_up_diwan_r', x: 3.2, y: PALACE_FLOOR2_Y, z: -54.5, rotY: 0 },
    ];
  }

  public getEntranceGuardPosts(): PalaceGuardPost[] {
    return this.getPalaceGuardPosts();
  }

  public isSultanNearThrone(worldPos: THREE.Vector3, maxDist: number = 2.95): boolean {
    return (
      Math.hypot(worldPos.x, worldPos.z + 53.65) <= maxDist &&
      worldPos.z >= -55.6 &&
      worldPos.y >= 0.05 &&
      worldPos.y < 2.5
    );
  }

  public isSultanNearRoyalBed(worldPos: THREE.Vector3, maxDist: number = 3.35): boolean {
    return (
      worldPos.y > -0.2 &&
      worldPos.y < 2.2 &&
      Math.hypot(worldPos.x - (-0.95), worldPos.z - (-64.1)) <= maxDist
    );
  }

  public setThroneColliderActive(active: boolean) {
    if (!this.throneCollider) return;
    if (active) {
      this.throneCollider.halfW = 0.875;
      this.throneCollider.halfD = 0.7;
    } else {
      this.throneCollider.halfW = 0.005;
      this.throneCollider.halfD = 0.005;
    }
  }

  /**
   * Returns true while the Sultan is inside the enclosed Palace interior
   * (returns false on the open-air South Overlook Balcony so the camera opens out over the Kingdom).
   */
  public isSultanInside(worldPos: THREE.Vector3): boolean {
    // Open-air South Overlook Balcony -> treat as scenic overlook outdoors!
    if (worldPos.y >= 3.8 && worldPos.z > -30.25) {
      this.wasSultanInside = false;
      return false;
    }

    if (this.wasSultanInside) {
      if (
        worldPos.x < -27.4 ||
        worldPos.x > 27.4 ||
        worldPos.z < -68.45 ||
        worldPos.z > -30.0
      ) {
        this.wasSultanInside = false;
      }
    } else {
      if (
        worldPos.x >= -26.7 &&
        worldPos.x <= 26.7 &&
        worldPos.z >= -67.7 &&
        worldPos.z <= -30.8
      ) {
        this.wasSultanInside = true;
      }
    }
    return this.wasSultanInside;
  }

  /**
   * Floor-aware, doorway-safe camera wall clamping.
   * Uses exact unpadded wall slabs + smooth world-space pullback so entering doorways
   * never slams the lens into bright front walls or inside the Sultan's robes.
   */
  public clampCameraPos(lookTarget: THREE.Vector3, camPos: THREE.Vector3): void {
    const dirX = camPos.x - lookTarget.x;
    const dirY = camPos.y - lookTarget.y;
    const dirZ = camPos.z - lookTarget.z;
    const rayLen = Math.hypot(dirX, dirY, dirZ);
    if (rayLen < 0.05) return;

    const minYSpan = Math.min(lookTarget.y, camPos.y) - 0.35;
    const maxYSpan = Math.max(lookTarget.y, camPos.y) + 0.35;
    const inMainDoorCorridor =
      Math.abs(lookTarget.x) < 2.2 && lookTarget.z > -33.2 && lookTarget.z < -28.8;

    let bestT = 1.0;

    for (let i = 0; i < this.wallBoxes.length; i++) {
      const wb = this.wallBoxes[i];
      if (wb.maxY < minYSpan || wb.minY > maxYSpan) continue;

      const b = wb.col;
      // Exempt flanking front exterior walls while walking straight through the wide main entrance archway
      if (inMainDoorCorridor && Math.abs(b.cz + 30.5) < 0.4 && Math.abs(b.cx) > 2.2) {
        continue;
      }

      const minX = b.cx - b.halfW;
      const maxX = b.cx + b.halfW;
      const minZ = b.cz - b.halfD;
      const maxZ = b.cz + b.halfD;

      let tMin = 0.0;
      let tMax = bestT;

      if (Math.abs(dirX) < 1e-5) {
        if (lookTarget.x < minX || lookTarget.x > maxX) continue;
      } else {
        const invX = 1.0 / dirX;
        let t1 = (minX - lookTarget.x) * invX;
        let t2 = (maxX - lookTarget.x) * invX;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      if (Math.abs(dirZ) < 1e-5) {
        if (lookTarget.z < minZ || lookTarget.z > maxZ) continue;
      } else {
        const invZ = 1.0 / dirZ;
        let t1 = (minZ - lookTarget.z) * invZ;
        let t2 = (maxZ - lookTarget.z) * invZ;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      if (tMin > 0.01 && tMin < bestT) {
        bestT = tMin;
      }
    }

    if (bestT < 1.0) {
      const hitDist = bestT * rayLen;
      const clampedDist = Math.max(1.35, hitDist - 0.42);
      const safeT = Math.min(1.0, clampedDist / rayLen);
      camPos.x = lookTarget.x + dirX * safeT;
      camPos.y = lookTarget.y + dirY * safeT;
      camPos.z = lookTarget.z + dirZ * safeT;
      if (hitDist < 1.8) {
        camPos.y += (1.8 - hitDist) * 0.35;
      }
    }

    // Keep camera smoothly beneath the ceiling of the current story when inside roofed footprint
    if (camPos.x >= -27.2 && camPos.x <= 27.2 && camPos.z >= -68.2 && camPos.z <= -30.6) {
      const onSecondFloor = lookTarget.y >= PALACE_FLOOR2_Y + 0.5;
      if (onSecondFloor) {
        camPos.y = Math.min(camPos.y, 8.35);
      } else {
        camPos.y = Math.min(camPos.y, 3.85);
      }
    }
  }

  private addOBB(
    target: OBBCollider[],
    cx: number,
    cz: number,
    width: number,
    depth: number,
    topY: number,
    allowStand: boolean = false,
    bottomY?: number
  ): OBBCollider {
    const col: OBBCollider = {
      cx,
      cz,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      cosY: 1,
      sinY: 0,
      topY,
      bottomY,
      allowStand,
    };
    target.push(col);
    return col;
  }

  private addCylinder(
    target: CylinderCollider[],
    x: number,
    z: number,
    radius: number,
    topY: number,
    bottomY?: number
  ) {
    target.push({ x, z, radius, topY, bottomY, allowStand: false });
  }

  private createArabicPlaqueTexture(
    title: string,
    bgHex: string = '#2a1810',
    borderHex: string = '#eab308',
    textHex: string = '#fef3c7',
    width: number = 512,
    height: number = 128
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.strokeStyle = '#926728';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = textHex;
    ctx.font = '800 42px "Marhey", "Tajawal", sans-serif';
    ctx.fillText(title, width / 2, height * 0.52);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private createRoyalCarpetTexture(primaryHex: string, borderHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 28;
    ctx.strokeRect(22, 22, 468, 468);

    ctx.strokeStyle = '#f5e1b8';
    ctx.lineWidth = 8;
    ctx.strokeRect(52, 52, 408, 408);

    ctx.fillStyle = borderHex;
    ctx.beginPath();
    ctx.moveTo(256, 130);
    ctx.lineTo(356, 256);
    ctx.lineTo(256, 382);
    ctx.lineTo(156, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = primaryHex;
    ctx.beginPath();
    ctx.moveTo(256, 175);
    ctx.lineTo(318, 256);
    ctx.lineTo(256, 337);
    ctx.lineTo(194, 256);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private createPlanningMapTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e7d7b1';
    ctx.fillRect(0, 0, 512, 384);

    ctx.fillStyle = '#256c8f';
    ctx.fillRect(0, 0, 120, 384);
    ctx.fillStyle = '#d4b475';
    ctx.fillRect(114, 0, 18, 384);

    ctx.strokeStyle = '#785a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(280, 40);
    ctx.lineTo(280, 340);
    ctx.moveTo(132, 192);
    ctx.lineTo(475, 192);
    ctx.stroke();

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(256, 62, 48, 36);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(415, 120, 34, 0, Math.PI * 2);
    ctx.arc(425, 265, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(92, 60, 30, 0.25)';
    ctx.lineWidth = 1.5;
    for (let x = 64; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 384);
      ctx.stroke();
    }
    for (let y = 64; y < 384; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 500, 372);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildPalace(
    targetBoxColliders: OBBCollider[],
    targetCylinderColliders: CylinderCollider[]
  ) {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    // Calibrated warm limestone & travertine palette (low envMapIntensity eliminates blinding white blowout)
    const palaceWallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xd6c19f,
        roughness: 0.88,
        metalness: 0.03,
        envMapIntensity: 0.3,
      })
    );
    const trimStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xab9678,
        roughness: 0.9,
        metalness: 0.05,
        envMapIntensity: 0.32,
      })
    );
    const marbleMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xd0be9f,
        roughness: 0.68,
        metalness: 0.04,
        envMapIntensity: 0.25,
      })
    );
    const floorMarbleMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xcfbda0,
        roughness: 0.65,
        metalness: 0.04,
        envMapIntensity: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const darkWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x4f2e17,
        roughness: 0.78,
        metalness: 0.06,
      })
    );
    const oakWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x87542b,
        roughness: 0.76,
        metalness: 0.05,
      })
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2b138,
        roughness: 0.28,
        metalness: 0.85,
      })
    );
    const crimsonVelvetMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x9b1826,
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );
    const emeraldFabricMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x166549,
        roughness: 0.82,
        metalness: 0.04,
      })
    );
    const creamFabricMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xeae0ce,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x333942,
        roughness: 0.44,
        metalness: 0.78,
      })
    );
    const copperMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xc26c38,
        roughness: 0.32,
        metalness: 0.82,
      })
    );
    const glowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffebb0,
        emissive: 0xffb338,
        emissiveIntensity: 0.85,
        roughness: 0.28,
      })
    );
    this.glowMaterials.push(glowMat);

    const floor1H = PALACE_FLOOR2_Y; // 4.50m
    const floor2H = 4.4;
    const roofBaseY = floor1H + floor2H; // 8.90m
    const wallT = 0.42;

    // -------------------------------------------------------------------------
    // 1. Solid Ground Floor Marble Slab & Front Entrance Portico
    // -------------------------------------------------------------------------
    const floorPiece = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(54.4, 0.05, 37.9)),
      floorMarbleMat
    );
    floorPiece.position.set(0, 0.02, -49.25);
    floorPiece.receiveShadow = true;
    this.group.add(floorPiece);

    // Compact carved-stone threshold sill & royal welcome carpet leading up to the double doors
    const entranceSill = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.0, 0.032, 0.9)),
      trimStoneMat
    );
    entranceSill.position.set(0, 0.016, -30.5);
    entranceSill.receiveShadow = true;
    this.group.add(entranceSill);

    const entranceCarpetTex = this.createRoyalCarpetTexture('#8f1422', '#e0a934');
    const entranceCarpetMat = this.track(
      new THREE.MeshStandardMaterial({
        map: entranceCarpetTex,
        roughness: 0.88,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    const entranceCarpet = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(3.4, 3.6)),
      entranceCarpetMat
    );
    entranceCarpet.rotation.x = -Math.PI / 2;
    entranceCarpet.position.set(0, 0.04, -28.6);
    entranceCarpet.receiveShadow = true;
    this.group.add(entranceCarpet);

    // Grand Support Columns holding up the Overlook Balcony along z = -26.9
    // Spaced cleanly clear of Royal Cannon (-10.0, -27.5), Lion Cage (13.5, -26.2) & Podium (-19.5, -25.2)
    [-3.4, 3.4, -6.6, 6.6, -17.0, 17.0].forEach((px) => {
      const colMesh = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.32, 0.38, floor1H - 0.2, 12)),
        marbleMat
      );
      colMesh.position.set(px, (floor1H - 0.2) * 0.5, -26.9);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      this.group.add(colMesh);

      const base = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.92, 0.32, 0.92)), trimStoneMat);
      base.position.set(px, 0.16, -26.9);
      this.group.add(base);

      const cap = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.94, 0.24, 0.94)), goldMat);
      cap.position.set(px, floor1H - 0.28, -26.9);
      this.group.add(cap);

      this.addCylinder(targetCylinderColliders, px, -26.9, 0.45, floor1H - 0.1, 0);
    });

    // Main Royal Palace Signboard mounted proudly above the Overlook Balcony Arch
    const mainSignTex = this.createArabicPlaqueTexture(
      'القصر الملكي',
      '#3a1118',
      '#eab308',
      '#fef3c7',
      1024,
      256
    );
    const mainSignMat = this.track(
      new THREE.MeshStandardMaterial({ map: mainSignTex, roughness: 0.48, metalness: 0.12 })
    );
    const mainSignBoard = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(6.2, 1.32, 0.16)),
      darkWoodMat
    );
    mainSignBoard.position.set(0, roofBaseY + 0.95, -30.25);
    this.group.add(mainSignBoard);
    const mainSignFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(5.95, 1.15)), mainSignMat);
    mainSignFace.position.set(0, roofBaseY + 0.95, -30.16);
    this.group.add(mainSignFace);

    // Entrance Brass Lanterns
    [-2.55, 2.55].forEach((lx) => {
      const lan = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.12, 0.08, 0.34, 6)), glowMat);
      lan.position.set(lx, 3.25, -30.15);
      this.group.add(lan);
    });

    // -------------------------------------------------------------------------
    // 2. Floor-Aware Solid Wall & Hinged Room Door Helpers
    // -------------------------------------------------------------------------
    const addWallSegment = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      thickness: number = wallT,
      height: number = floor1H,
      baseY: number = 0
    ) => {
      const cx = (x1 + x2) * 0.5;
      const cz = (z1 + z2) * 0.5;
      const dx = Math.abs(x2 - x1);
      const dz = Math.abs(z2 - z1);
      const w = dx >= dz ? Math.max(thickness, dx) : thickness;
      const d = dz > dx ? Math.max(thickness, dz) : thickness;

      const dado = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 1.15, d)), trimStoneMat);
      dado.position.set(cx, baseY + 0.575, cz);
      dado.castShadow = true;
      dado.receiveShadow = true;
      this.group.add(dado);

      const upperH = Math.max(0.2, height - 1.15);
      const upper = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, upperH, d)),
        palaceWallMat
      );
      upper.position.set(cx, baseY + 1.15 + upperH * 0.5, cz);
      upper.castShadow = true;
      upper.receiveShadow = true;
      this.group.add(upper);

      const wallCol = this.addOBB(targetBoxColliders, cx, cz, w, d, baseY + height, false, baseY);
      this.wallBoxes.push({ col: wallCol, minY: baseY, maxY: baseY + height });
    };

    const addRoomDoor = (
      doorX: number,
      doorZ: number,
      axis: 'xWall' | 'zWall',
      swingDir: 1 | -1,
      roomTitleAr: string,
      plaqueFaceDir: 1 | -1,
      baseY: number = 0,
      storyHeight: number = floor1H
    ) => {
      const doorW = 2.0;
      const doorH = 2.85;

      const lintelW = axis === 'xWall' ? doorW + 0.16 : wallT + 0.04;
      const lintelD = axis === 'xWall' ? wallT + 0.04 : doorW + 0.16;
      const lintelH = Math.max(0.3, storyHeight - doorH);
      const lintel = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(lintelW, lintelH, lintelD)),
        palaceWallMat
      );
      lintel.position.set(doorX, baseY + doorH + lintelH * 0.5, doorZ);
      lintel.castShadow = true;
      this.group.add(lintel);

      const frameTop = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(lintelW + 0.06, 0.14, lintelD + 0.06)),
        goldMat
      );
      frameTop.position.set(doorX, baseY + doorH + 0.04, doorZ);
      this.group.add(frameTop);

      const plaqueTex = this.createArabicPlaqueTexture(roomTitleAr);
      const plaqueMat = this.track(
        new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.45, metalness: 0.12 })
      );
      const plaqueMesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.85, 0.46)), plaqueMat);
      if (axis === 'zWall') {
        plaqueMesh.position.set(doorX + plaqueFaceDir * (wallT * 0.5 + 0.03), baseY + 3.4, doorZ);
        plaqueMesh.rotation.y = plaqueFaceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        plaqueMesh.position.set(doorX, baseY + 3.4, doorZ + plaqueFaceDir * (wallT * 0.5 + 0.03));
        plaqueMesh.rotation.y = plaqueFaceDir > 0 ? 0 : Math.PI;
      }
      this.group.add(plaqueMesh);

      const hingePivot = new THREE.Group();
      if (axis === 'zWall') {
        hingePivot.position.set(doorX, baseY + 0.04, doorZ - doorW * 0.5);
      } else {
        hingePivot.position.set(doorX - doorW * 0.5, baseY + 0.04, doorZ);
      }

      const leafW = axis === 'zWall' ? 0.1 : doorW - 0.08;
      const leafD = axis === 'zWall' ? doorW - 0.08 : 0.1;
      const leaf = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(leafW, doorH - 0.08, leafD)),
        oakWoodMat
      );
      if (axis === 'zWall') {
        leaf.position.set(0, (doorH - 0.08) * 0.5, doorW * 0.5 - 0.02);
      } else {
        leaf.position.set(doorW * 0.5 - 0.02, (doorH - 0.08) * 0.5, 0);
      }
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      hingePivot.add(leaf);

      const bandW = axis === 'zWall' ? 0.12 : doorW * 0.72;
      const bandD = axis === 'zWall' ? doorW * 0.72 : 0.12;
      const band = new THREE.Mesh(this.track(new THREE.BoxGeometry(bandW, 0.12, bandD)), goldMat);
      if (axis === 'zWall') {
        band.position.set(0, 1.38, doorW * 0.5);
      } else {
        band.position.set(doorW * 0.5, 1.38, 0);
      }
      hingePivot.add(band);

      const handle = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.065, 8, 8)), goldMat);
      if (axis === 'zWall') {
        handle.position.set(plaqueFaceDir * 0.08, 1.2, doorW * 0.85);
      } else {
        handle.position.set(doorW * 0.85, 1.2, plaqueFaceDir * 0.08);
      }
      hingePivot.add(handle);

      this.group.add(hingePivot);

      const closedW = axis === 'xWall' ? doorW : 0.36;
      const closedD = axis === 'xWall' ? 0.36 : doorW;
      const col = this.addOBB(
        targetBoxColliders,
        doorX,
        doorZ,
        closedW,
        closedD,
        baseY + doorH,
        false,
        baseY
      );

      this.doors.push({
        hingePivot,
        worldPos: new THREE.Vector3(doorX, baseY, doorZ),
        collider: col,
        closedHalfW: closedW * 0.5,
        closedHalfD: closedD * 0.5,
        openAngle: swingDir * (Math.PI * 0.5),
        openAmount: 0,
        targetOpen: 0,
        openRadius: 4.1,
      });
    };

    // -------------------------------------------------------------------------
    // 3. Ground Floor Perimeter Walls & Wide 4.6m Grand Double Entrance
    // -------------------------------------------------------------------------
    addWallSegment(-27.0, -68.0, -27.0, -30.5, wallT, floor1H, 0); // West outer wall
    addWallSegment(27.0, -68.0, 27.0, -30.5, wallT, floor1H, 0);   // East outer wall
    addWallSegment(-27.2, -68.0, 27.2, -68.0, wallT, floor1H, 0);  // North back wall
    addWallSegment(-27.2, -30.5, -2.3, -30.5, wallT, floor1H, 0);  // South-West front wall
    addWallSegment(2.3, -30.5, 27.2, -30.5, wallT, floor1H, 0);    // South-East front wall

    // Wide Main Entrance Doorway Overhead Lintel & Double Doors (x in [-2.3..+2.3], z = -30.5)
    const mainLintel = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.8, floor1H - 3.55, wallT + 0.04)),
      palaceWallMat
    );
    mainLintel.position.set(0, 3.55 + (floor1H - 3.55) * 0.5, -30.5);
    this.group.add(mainLintel);

    const archGoldTrim = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.9, 0.16, wallT + 0.1)),
      goldMat
    );
    archGoldTrim.position.set(0, 3.55, -30.5);
    this.group.add(archGoldTrim);

    const leftDoorPivot = new THREE.Group();
    leftDoorPivot.position.set(-2.28, 0.04, -30.5);
    const leftLeaf = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.26, 3.48, 0.14)),
      darkWoodMat
    );
    leftLeaf.position.set(1.13, 1.74, 0);
    leftLeaf.castShadow = true;
    leftDoorPivot.add(leftLeaf);
    const leftGold = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.75, 0.2, 0.17)), goldMat);
    leftGold.position.set(1.13, 1.75, 0);
    leftDoorPivot.add(leftGold);
    this.group.add(leftDoorPivot);

    const rightDoorPivot = new THREE.Group();
    rightDoorPivot.position.set(2.28, 0.04, -30.5);
    const rightLeaf = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.26, 3.48, 0.14)),
      darkWoodMat
    );
    rightLeaf.position.set(-1.13, 1.74, 0);
    rightLeaf.castShadow = true;
    rightDoorPivot.add(rightLeaf);
    const rightGold = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.75, 0.2, 0.17)), goldMat);
    rightGold.position.set(-1.13, 1.75, 0);
    rightDoorPivot.add(rightGold);
    this.group.add(rightDoorPivot);

    const mainDoorCol = this.addOBB(targetBoxColliders, 0, -30.5, 4.6, 0.44, 3.5, false, 0);
    this.doors.push({
      hingePivot: leftDoorPivot,
      hingePivotRight: rightDoorPivot,
      worldPos: new THREE.Vector3(0, 0, -30.5),
      collider: mainDoorCol,
      closedHalfW: 2.3,
      closedHalfD: 0.22,
      openAngle: Math.PI * 0.52,
      openAmount: 0,
      targetOpen: 0,
      openRadius: 4.5,
      isDouble: true,
    });

    // Decorative Glowing Windows on Both Floors (Front & Sides)
    [-21.5, -10.5, 10.5, 21.5].forEach((wx) => {
      const win1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.5, 2.0, 0.52)), glowMat);
      win1.position.set(wx, 2.45, -30.5);
      this.group.add(win1);
    });
    [-21.5, -15.5, 15.5, 21.5].forEach((wx) => {
      const win2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.5, 2.0, 0.52)), glowMat);
      win2.position.set(wx, floor1H + 2.35, -30.5);
      this.group.add(win2);
    });
    [-37.2, -49.2, -61.5].forEach((wz) => {
      [-27.0, 27.0].forEach((wx) => {
        const win1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.52, 2.0, 1.45)), glowMat);
        win1.position.set(wx, 2.45, wz);
        this.group.add(win1);
        const win2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.52, 2.0, 1.45)), glowMat);
        win2.position.set(wx, floor1H + 2.35, wz);
        this.group.add(win2);
      });
    });

    // -------------------------------------------------------------------------
    // 4. Ground Floor Interior Room Walls & Doors (7 Large Spacious Rooms)
    // -------------------------------------------------------------------------
    // West Wing Partition Wall (x = -13.6) + cross walls
    addWallSegment(-13.6, -36.65, -13.6, -30.5, wallT, floor1H, 0);
    addWallSegment(-13.6, -48.75, -13.6, -38.65, wallT, floor1H, 0);
    addWallSegment(-13.6, -60.9, -13.6, -50.75, wallT, floor1H, 0);
    addWallSegment(-13.6, -68.0, -13.6, -62.9, wallT, floor1H, 0);
    addWallSegment(-27.0, -43.7, -13.6, -43.7, wallT, floor1H, 0);
    addWallSegment(-27.0, -55.8, -13.6, -55.8, wallT, floor1H, 0);

    addRoomDoor(-13.6, -37.65, 'zWall', -1, 'غرفة الضيوف', 1, 0, floor1H);
    addRoomDoor(-13.6, -49.75, 'zWall', -1, 'غرفة المطبع', 1, 0, floor1H);
    addRoomDoor(-13.6, -61.9, 'zWall', -1, 'غرفة الحمام', 1, 0, floor1H);

    // East Wing Partition Wall (x = +13.6) + cross walls
    addWallSegment(13.6, -36.65, 13.6, -30.5, wallT, floor1H, 0);
    addWallSegment(13.6, -48.75, 13.6, -38.65, wallT, floor1H, 0);
    addWallSegment(13.6, -60.9, 13.6, -50.75, wallT, floor1H, 0);
    addWallSegment(13.6, -68.0, 13.6, -62.9, wallT, floor1H, 0);
    addWallSegment(13.6, -43.7, 27.0, -43.7, wallT, floor1H, 0);
    addWallSegment(13.6, -55.8, 27.0, -55.8, wallT, floor1H, 0);

    addRoomDoor(13.6, -37.65, 'zWall', 1, 'غرفة الوزير', -1, 0, floor1H);
    addRoomDoor(13.6, -49.75, 'zWall', 1, 'غرفة الجنرال', -1, 0, floor1H);
    addRoomDoor(13.6, -61.9, 'zWall', 1, 'غرفة التخطيط', -1, 0, floor1H);

    // Enlarged Royal Bedroom (x in [-9.2..+9.2], z in [-68.0..-56.0])
    addWallSegment(-9.2, -56.0, 9.2, -56.0, wallT, floor1H, 0);
    addWallSegment(-9.2, -61.0, -9.2, -56.0, wallT, floor1H, 0);
    addWallSegment(-9.2, -68.0, -9.2, -63.0, wallT, floor1H, 0);
    addWallSegment(9.2, -61.0, 9.2, -56.0, wallT, floor1H, 0);
    addWallSegment(9.2, -68.0, 9.2, -63.0, wallT, floor1H, 0);

    addRoomDoor(-9.2, -62.0, 'zWall', 1, 'غرفة النوم الملكية', -1, 0, floor1H);
    addRoomDoor(9.2, -62.0, 'zWall', -1, 'غرفة النوم الملكية', 1, 0, floor1H);

    // -------------------------------------------------------------------------
    // 5. Ground Floor Grand Throne Hall, Carpeted Throne Steps, Throne & Vizier Chair
    // -------------------------------------------------------------------------
    const runnerTex = this.createRoyalCarpetTexture('#8f1422', '#e0a934');
    const runnerMat = this.track(
      new THREE.MeshStandardMaterial({
        map: runnerTex,
        roughness: 0.88,
        metalness: 0.03,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    const runner = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.8, 18.4)), runnerMat);
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.048, -39.9);
    runner.receiveShadow = true;
    this.group.add(runner);

    // Colonnade Marble Pillars flanking Throne Hall (positioned cleanly at x = +-6.4)
    [-6.4, 6.4].forEach((px) => {
      [-35.6, -42.2, -48.8].forEach((pz) => {
        const pillar = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.3, 0.36, floor1H - 0.15, 12)),
          marbleMat
        );
        pillar.position.set(px, (floor1H - 0.15) * 0.5, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.group.add(pillar);

        const cap = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.84, 0.22, 0.84)), goldMat);
        cap.position.set(px, floor1H - 0.16, pz);
        this.group.add(cap);

        this.addCylinder(targetCylinderColliders, px, pz, 0.42, floor1H, 0);
      });
    });

    // Stepped Throne Dais
    const addDaisPiece = (
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
      baseY: number,
      h: number
    ) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const mesh = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, d)), marbleMat);
      mesh.position.set(cx, baseY + h * 0.5, cz);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.addOBB(targetBoxColliders, cx, cz, w, d, baseY + h, true, baseY);
    };
    addDaisPiece(-4.8, 4.8, -55.6, -51.0, 0, 0.2);
    addDaisPiece(-3.8, 3.8, -55.6, -52.2, 0.2, 0.2);

    // Grand 4-Step Carpeted Throne Staircase ("درج العرش")
    const stairTreads = [
      { cz: -49.45, depth: 0.72, topY: 0.1 },
      { cz: -50.15, depth: 0.72, topY: 0.2 },
      { cz: -50.85, depth: 0.72, topY: 0.3 },
      { cz: -51.7, depth: 1.02, topY: 0.4 },
    ];
    stairTreads.forEach((st) => {
      const stoneStep = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(4.0, st.topY, st.depth)),
        marbleMat
      );
      stoneStep.position.set(0, st.topY * 0.5, st.cz);
      stoneStep.receiveShadow = true;
      stoneStep.castShadow = true;
      this.group.add(stoneStep);

      const carpetStrip = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(3.4, 0.014, st.depth * 0.94)),
        crimsonVelvetMat
      );
      carpetStrip.position.set(0, st.topY + 0.004, st.cz);
      carpetStrip.receiveShadow = true;
      this.group.add(carpetStrip);

      const goldNos = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(3.52, 0.018, 0.05)),
        goldMat
      );
      goldNos.position.set(0, st.topY + 0.006, st.cz + st.depth * 0.46);
      this.group.add(goldNos);

      this.addOBB(targetBoxColliders, 0, st.cz, 4.0, st.depth, st.topY, true, 0);
    });

    [-2.08, 2.08].forEach((bx) => {
      const curb = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.24, 0.56, 3.15)), trimStoneMat);
      curb.position.set(bx, 0.28, -50.65);
      curb.castShadow = true;
      this.group.add(curb);
      const post = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.32, 0.85, 0.32)), marbleMat);
      post.position.set(bx, 0.425, -49.1);
      this.group.add(post);
      const finial = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.14, 0)), goldMat);
      finial.position.set(bx, 0.96, -49.1);
      this.group.add(finial);
      this.addOBB(targetBoxColliders, bx, -50.65, 0.26, 3.2, 0.85, false, 0);
    });

    // Ornate Golden Royal Throne
    const throneGroup = new THREE.Group();
    throneGroup.position.set(0, 0.4, -54.35);

    const thronePlinth = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.75, 0.12, 1.38)), goldMat);
    thronePlinth.position.y = 0.06;
    throneGroup.add(thronePlinth);

    const throneBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.4, 0.36, 1.08)), goldMat);
    throneBase.position.y = 0.3;
    throneBase.castShadow = true;
    throneGroup.add(throneBase);

    const throneCushion = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.16, 0.14, 0.92)),
      crimsonVelvetMat
    );
    throneCushion.position.set(0, 0.55, 0.04);
    throneGroup.add(throneCushion);

    const throneBack = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.44, 1.85, 0.2)), goldMat);
    throneBack.position.set(0, 1.35, -0.44);
    throneBack.castShadow = true;
    throneGroup.add(throneBack);

    const throneBackVelvet = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.08, 1.48, 0.08)),
      crimsonVelvetMat
    );
    throneBackVelvet.position.set(0, 1.34, -0.32);
    throneGroup.add(throneBackVelvet);

    const throneCrest = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.26, 0)),
      goldMat
    );
    throneCrest.position.set(0, 2.48, -0.42);
    throneGroup.add(throneCrest);

    [-0.66, 0.66].forEach((ax) => {
      const arm = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.16, 0.44, 0.96)), goldMat);
      arm.position.set(ax, 0.78, -0.02);
      throneGroup.add(arm);
    });
    this.group.add(throneGroup);
    this.throneCollider = this.addOBB(targetBoxColliders, 0, -54.35, 1.75, 1.4, 2.8, false, 0);

    // -------------------------------------------------------------------------
    // 5a. Twin Monumental Walkable Staircases to Second Floor ("درج الطابق الثاني")
    // -------------------------------------------------------------------------
    const stairSignTex = this.createArabicPlaqueTexture(
      'درج الطابق الثاني',
      '#3a1118',
      '#eab308',
      '#fef3c7',
      512,
      128
    );
    const stairSignMat = this.track(
      new THREE.MeshStandardMaterial({ map: stairSignTex, roughness: 0.45 })
    );

    ([-1, 1] as const).forEach((side) => {
      const lowerX = side * 11.9; // Outer flight: x in [±10.8 .. ±13.0]
      const upperX = side * 9.4;  // Inner flight: x in [±8.3 .. ±10.5]
      const dividerX = side * 10.65;
      const stairW = 2.2;
      const stepsPerFlight = 15;
      const stepRise = 0.15; // 15 * 0.15 = 2.25m per flight -> 4.50m Floor 2!
      const stepPitch = 0.46; // z from -39.35 to -45.79

      // Lower Flight: climbs North (-Z) from z = -39.35 (y = 0.15) up to z = -45.79 (y = 2.25)
      for (let s = 0; s < stepsPerFlight; s++) {
        const topY = (s + 1) * stepRise;
        const cz = -39.35 - s * stepPitch;
        const visH = s < 5 ? topY : 0.28;
        const visY = s < 5 ? topY * 0.5 : topY - visH * 0.5;

        const stepMesh = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW, visH, stepPitch + 0.06)),
          marbleMat
        );
        stepMesh.position.set(lowerX, visY, cz);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        this.group.add(stepMesh);

        const carpet = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW * 0.72, 0.016, stepPitch * 0.94)),
          crimsonVelvetMat
        );
        carpet.position.set(lowerX, topY + 0.008, cz);
        carpet.receiveShadow = true;
        this.group.add(carpet);

        const nosing = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW * 0.82, 0.02, 0.045)),
          goldMat
        );
        nosing.position.set(lowerX, topY + 0.009, cz + stepPitch * 0.46);
        this.group.add(nosing);

        const bottomY = s < 5 ? 0 : Math.max(0, topY - 0.38);
        this.addOBB(targetBoxColliders, lowerX, cz, stairW, stepPitch + 0.1, topY, true, bottomY);
      }

      // Mid-Landing at North End of Stairwell (y = 2.25m, z in [-48.2..-46.0], x spans both flights)
      const landW = 5.0;
      const landD = 2.2;
      const landCX = side * 10.65;
      const landCZ = -47.1;
      const landMesh = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(landW, 0.28, landD)),
        marbleMat
      );
      landMesh.position.set(landCX, 2.25 - 0.14, landCZ);
      landMesh.castShadow = true;
      landMesh.receiveShadow = true;
      this.group.add(landMesh);

      const landCarpet = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(landW - 0.7, 0.016, landD - 0.5)),
        crimsonVelvetMat
      );
      landCarpet.position.set(landCX, 2.258, landCZ);
      landCarpet.receiveShadow = true;
      this.group.add(landCarpet);

      this.addOBB(targetBoxColliders, landCX, landCZ, landW, landD, 2.25, true, 1.97);

      // Mid-Landing Back Guardrail (z = -48.1) & Outer Cheek
      const landBackRail = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(landW, 0.95, 0.18)),
        trimStoneMat
      );
      landBackRail.position.set(landCX, 2.25 + 0.475, -48.12);
      this.group.add(landBackRail);
      const landBackCap = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(landW + 0.06, 0.08, 0.24)),
        goldMat
      );
      landBackCap.position.set(landCX, 3.24, -48.12);
      this.group.add(landBackCap);
      this.addOBB(targetBoxColliders, landCX, -48.12, landW, 0.22, 3.3, false, 2.25);

      // Upper Flight: climbs South (+Z) from z = -45.79 (y = 2.40) up to z = -39.35 (y = 4.50)
      for (let s = 0; s < stepsPerFlight; s++) {
        const topY = 2.25 + (s + 1) * stepRise;
        const cz = -45.79 + s * stepPitch;
        const visH = 0.28;
        const visY = topY - visH * 0.5;

        const stepMesh = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW, visH, stepPitch + 0.06)),
          marbleMat
        );
        stepMesh.position.set(upperX, visY, cz);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        this.group.add(stepMesh);

        const carpet = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW * 0.72, 0.016, stepPitch * 0.94)),
          crimsonVelvetMat
        );
        carpet.position.set(upperX, topY + 0.008, cz);
        carpet.receiveShadow = true;
        this.group.add(carpet);

        const nosing = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(stairW * 0.82, 0.02, 0.045)),
          goldMat
        );
        nosing.position.set(upperX, topY + 0.009, cz - stepPitch * 0.46);
        this.group.add(nosing);

        this.addOBB(targetBoxColliders, upperX, cz, stairW, stepPitch + 0.1, topY, true, topY - 0.36);
      }

      // Center Divider Balustrade separating lower & upper flights
      const divRail = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.18, 4.9, 6.8)),
        trimStoneMat
      );
      divRail.position.set(dividerX, 2.45, -42.65);
      this.group.add(divRail);
      this.addOBB(targetBoxColliders, dividerX, -42.65, 0.22, 6.8, 5.2, false, 0);

      // Sloped Inner/Outer Gold Handrails & Entry Archway Sign
      const entryPost = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.36, 3.1, 0.36)),
        marbleMat
      );
      entryPost.position.set(side * 10.65, 1.55, -39.05);
      this.group.add(entryPost);
      const entryFinial = new THREE.Mesh(
        this.track(new THREE.OctahedronGeometry(0.16, 0)),
        goldMat
      );
      entryFinial.position.set(side * 10.65, 3.22, -39.05);
      this.group.add(entryFinial);
      this.addOBB(targetBoxColliders, side * 10.65, -39.05, 0.4, 0.4, 3.3, false, 0);

      const plaque = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.9, 0.48)), stairSignMat);
      plaque.position.set(lowerX, 2.75, -39.02);
      this.group.add(plaque);
    });

    // -------------------------------------------------------------------------
    // 5b. Intermittent Small Palace Rats scurrying along Palace floors
    // -------------------------------------------------------------------------
    const ratMat = this.track(new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.85 }));
    const ratNoseMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf4a3b4, roughness: 0.7 }));
    const ratBodyGeo = this.track(new THREE.SphereGeometry(0.11, 8, 6));
    const ratHeadGeo = this.track(new THREE.SphereGeometry(0.068, 7, 6));
    const ratEarGeo = this.track(new THREE.SphereGeometry(0.032, 6, 5));
    const ratSnoutGeo = this.track(new THREE.SphereGeometry(0.025, 5, 5));
    const ratTailGeo = this.track(new THREE.CylinderGeometry(0.013, 0.007, 0.24, 5));

    const ratSpawns: { x: number; z: number; ang: number; startRoaming: boolean }[] = [
      { x: -6.8, z: -37.2, ang: 0.6, startRoaming: true },
      { x: 7.2, z: -43.2, ang: -1.1, startRoaming: true },
      { x: -7.5, z: -49.5, ang: 2.1, startRoaming: false },
      { x: 7.2, z: -35.5, ang: 1.4, startRoaming: false },
      { x: -3.2, z: -44.8, ang: -2.4, startRoaming: false },
    ];
    ratSpawns.forEach((sp, idx) => {
      const rg = new THREE.Group();
      const body = new THREE.Mesh(ratBodyGeo, ratMat);
      body.scale.set(0.85, 0.72, 1.5);
      body.position.y = 0.08;

      const head = new THREE.Mesh(ratHeadGeo, ratMat);
      head.position.set(0, 0.095, 0.17);
      const earL = new THREE.Mesh(ratEarGeo, ratMat);
      earL.position.set(-0.048, 0.145, 0.155);
      const earR = new THREE.Mesh(ratEarGeo, ratMat);
      earR.position.set(0.048, 0.145, 0.155);
      const snout = new THREE.Mesh(ratSnoutGeo, ratNoseMat);
      snout.position.set(0, 0.085, 0.235);

      const tail = new THREE.Mesh(ratTailGeo, ratNoseMat);
      tail.rotation.x = Math.PI * 0.45;
      tail.position.set(0, 0.065, -0.22);

      rg.add(body, head, earL, earR, snout, tail);
      rg.position.set(sp.x, 0.045, sp.z);
      rg.visible = sp.startRoaming;
      this.group.add(rg);
      this.palaceRatActors.push({
        group: rg,
        tail,
        x: sp.x,
        z: sp.z,
        angle: sp.ang,
        speed: 1.7 + (idx % 3) * 0.35,
        timer: 1.2 + idx * 0.6,
        state: sp.startRoaming ? 'roaming' : 'hidden',
        stateTimer: sp.startRoaming ? 12 + idx * 3 : 6 + idx * 3.5,
      });
    });

    // Ornate Grand Vizier Chair beside the Throne
    const vizChairGroup = new THREE.Group();
    vizChairGroup.position.set(-2.35, 0.4, -54.28);

    const vBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.82, 0.34, 0.78)), darkWoodMat);
    vBase.position.y = 0.17;
    vBase.castShadow = true;
    vizChairGroup.add(vBase);

    const vCushion = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.72, 0.12, 0.7)),
      emeraldFabricMat
    );
    vCushion.position.set(0, 0.4, 0.02);
    vizChairGroup.add(vCushion);

    const vBack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.8, 1.15, 0.12)), darkWoodMat);
    vBack.position.set(0, 0.88, -0.34);
    vBack.castShadow = true;
    vizChairGroup.add(vBack);

    const vBackCloth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.62, 0.88, 0.06)),
      emeraldFabricMat
    );
    vBackCloth.position.set(0, 0.86, -0.26);
    vizChairGroup.add(vBackCloth);

    const vCrest = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.11, 0)), goldMat);
    vCrest.position.set(0, 1.54, -0.34);
    vizChairGroup.add(vCrest);

    [-0.38, 0.38].forEach((ax) => {
      const arm = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.28, 0.7)), goldMat);
      arm.position.set(ax, 0.56, 0);
      vizChairGroup.add(arm);
    });
    this.group.add(vizChairGroup);
    this.addOBB(targetBoxColliders, -2.35, -54.28, 0.86, 0.82, 1.8, false, 0);

    // Throne Backdrop Banners & Sign
    const throneSignTex = this.createArabicPlaqueTexture('قاعة العرش الملكي', '#4a0d17', '#eab308', '#fef3c7');
    const throneSignMat = this.track(new THREE.MeshStandardMaterial({ map: throneSignTex, roughness: 0.45 }));
    const throneSign = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.2, 0.78)), throneSignMat);
    throneSign.position.set(0, 3.7, -55.76);
    this.group.add(throneSign);

    [-3.6, 3.6].forEach((bx) => {
      const banner = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(1.15, 2.9, 0.06)),
        crimsonVelvetMat
      );
      banner.position.set(bx, 2.35, -55.74);
      this.group.add(banner);
    });

    // -------------------------------------------------------------------------
    // 6. Furnishings Helpers (Support Ground Floor y=0 & Floor 2 y=4.50)
    // -------------------------------------------------------------------------
    const addRug = (cx: number, cz: number, w: number, d: number, c1: string, c2: string, baseY: number = 0) => {
      const tex = this.createRoyalCarpetTexture(c1, c2);
      const mat = this.track(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.9,
          metalness: 0.02,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      const m = new THREE.Mesh(this.track(new THREE.PlaneGeometry(w, d)), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, baseY + 0.048, cz);
      m.receiveShadow = true;
      this.group.add(m);
    };

    const addBed = (
      cx: number,
      cz: number,
      w: number,
      d: number,
      blanketMat: THREE.MeshStandardMaterial,
      canopy: boolean = false,
      baseY: number = 0
    ) => {
      const frame = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 0.34, d)), darkWoodMat);
      frame.position.set(cx, baseY + 0.21, cz);
      frame.castShadow = true;
      frame.receiveShadow = true;
      this.group.add(frame);

      const mattress = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w - 0.16, 0.26, d - 0.16)),
        creamFabricMat
      );
      mattress.position.set(cx, baseY + 0.51, cz);
      this.group.add(mattress);

      const blanket = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w - 0.12, 0.14, d * 0.62)),
        blanketMat
      );
      blanket.position.set(cx, baseY + 0.62, cz + d * 0.15);
      this.group.add(blanket);

      const headboard = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w + 0.08, 1.35, 0.16)),
        darkWoodMat
      );
      headboard.position.set(cx, baseY + 0.72, cz - d * 0.5 + 0.08);
      headboard.castShadow = true;
      this.group.add(headboard);

      const pillowCount = w > 2.2 ? 2 : 1;
      for (let p = 0; p < pillowCount; p++) {
        const px = pillowCount === 2 ? cx + (p === 0 ? -0.78 : 0.78) : cx;
        const pillow = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.78, 0.16, 0.46)),
          creamFabricMat
        );
        pillow.position.set(px, baseY + 0.72, cz - d * 0.5 + 0.42);
        this.group.add(pillow);
      }

      if (canopy) {
        [
          [-w * 0.48, -d * 0.48],
          [w * 0.48, -d * 0.48],
          [-w * 0.48, d * 0.48],
          [w * 0.48, d * 0.48],
        ].forEach(([ox, oz]) => {
          const post = new THREE.Mesh(
            this.track(new THREE.CylinderGeometry(0.06, 0.07, 2.75, 8)),
            goldMat
          );
          post.position.set(cx + ox, baseY + 1.4, cz + oz);
          this.group.add(post);
        });
        const canopyTop = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16)),
          crimsonVelvetMat
        );
        canopyTop.position.set(cx, baseY + 2.78, cz);
        this.group.add(canopyTop);
      }

      this.addOBB(targetBoxColliders, cx, cz, w + 0.1, d + 0.1, baseY + 1.4, false, baseY);
    };

    // --- Ground Floor Room Furnishings ---
    // Room 1: غرفة النوم الملكية (x in [-9.2..+9.2], z in [-68.0..-56.0])
    addRug(0, -61.2, 11.4, 7.6, '#7c1220', '#e6b53b');
    addBed(0, -64.4, 4.2, 3.1, crimsonVelvetMat, true);
    [-3.0, 3.0].forEach((nx) => {
      const stand = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.76, 0.64, 0.66)), oakWoodMat);
      stand.position.set(nx, 0.36, -65.5);
      this.group.add(stand);
      const lamp = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.16, 8, 8)), glowMat);
      lamp.position.set(nx, 0.86, -65.5);
      this.group.add(lamp);
      this.addOBB(targetBoxColliders, nx, -65.5, 0.8, 0.7, 0.9, false, 0);
    });
    const wardrobe = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.8, 2.7, 0.8)), darkWoodMat);
    wardrobe.position.set(-6.8, 1.39, -67.0);
    wardrobe.castShadow = true;
    this.group.add(wardrobe);
    this.addOBB(targetBoxColliders, -6.8, -67.0, 2.85, 0.84, 2.7, false, 0);

    const vanity = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.2, 0.84, 0.72)), oakWoodMat);
    vanity.position.set(6.8, 0.46, -67.0);
    this.group.add(vanity);
    const mirror = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 1.35, 0.08)), goldMat);
    mirror.position.set(6.8, 1.55, -67.3);
    this.group.add(mirror);
    this.addOBB(targetBoxColliders, 6.8, -67.0, 2.25, 0.76, 1.8, false, 0);

    addRug(4.2, -59.5, 3.8, 3.2, '#1e40af', '#fbbf24');
    const toyChest = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.25, 0.62, 0.72)), oakWoodMat);
    toyChest.position.set(7.2, 0.35, -57.8);
    toyChest.castShadow = true;
    this.group.add(toyChest);
    const chestTrim = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 0.1, 0.76)), goldMat);
    chestTrim.position.set(7.2, 0.64, -57.8);
    this.group.add(chestTrim);
    this.addOBB(targetBoxColliders, 7.2, -57.8, 1.3, 0.76, 0.72, false, 0);

    // Room 2: غرفة الضيوف (West South: x in [-27.0..-13.6], z in [-43.7..-30.5])
    addRug(-20.2, -37.2, 8.8, 7.8, '#1f4e5f', '#e6b53b');
    addBed(-24.2, -33.4, 2.9, 1.7, emeraldFabricMat, false);
    addBed(-24.2, -40.8, 2.9, 1.7, emeraldFabricMat, false);
    const guestTable = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.95, 0.95, 0.56, 12)), oakWoodMat);
    guestTable.position.set(-19.8, 0.32, -37.2);
    this.group.add(guestTable);
    const teaTray = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.42, 0.36, 0.05, 12)), goldMat);
    teaTray.position.set(-19.8, 0.63, -37.2);
    this.group.add(teaTray);
    this.addCylinder(targetCylinderColliders, -19.8, -37.2, 1.0, 0.7, 0);
    const guestSofa = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.4, 0.76, 0.96)), crimsonVelvetMat);
    guestSofa.position.set(-19.2, 0.42, -31.8);
    this.group.add(guestSofa);
    this.addOBB(targetBoxColliders, -19.2, -31.8, 3.45, 1.0, 0.85, false, 0);

    // Room 3: غرفة المطبع (West Mid: x in [-27.0..-13.6], z in [-55.8..-43.7])
    const hearth = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.9, 2.6, 2.5)), trimStoneMat);
    hearth.position.set(-25.4, 1.34, -46.2);
    this.group.add(hearth);
    const fireEmber = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.65, 0.65, 1.2)), glowMat);
    fireEmber.position.set(-24.65, 0.62, -46.2);
    this.group.add(fireEmber);
    this.addOBB(targetBoxColliders, -25.4, -46.2, 1.95, 2.55, 2.6, false, 0);

    const prepTable = new THREE.Mesh(this.track(new THREE.BoxGeometry(4.8, 0.88, 1.2)), oakWoodMat);
    prepTable.position.set(-20.4, 0.48, -54.5);
    this.group.add(prepTable);
    [-21.9, -20.4, -18.9].forEach((px, idx) => {
      const pot = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.24 + idx * 0.03, 0.17, 0.4, 10)),
        copperMat
      );
      pot.position.set(px, 1.12, -54.5);
      this.group.add(pot);
    });
    this.addOBB(targetBoxColliders, -20.4, -54.5, 4.85, 1.25, 1.2, false, 0);

    const pressBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.9, 0.94, 1.35)), darkWoodMat);
    pressBase.position.set(-24.4, 0.51, -51.2);
    this.group.add(pressBase);
    const pressFrame = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.28, 1.35, 1.12)), darkWoodMat);
    pressFrame.position.set(-24.4, 1.58, -51.2);
    this.group.add(pressFrame);
    const pressWheel = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.34, 0.048, 8, 14)), ironMat);
    pressWheel.position.set(-23.9, 1.8, -51.2);
    pressWheel.rotation.y = Math.PI / 2;
    this.group.add(pressWheel);
    const paperStack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.68, 0.22, 0.52)), creamFabricMat);
    paperStack.position.set(-24.2, 1.08, -50.8);
    this.group.add(paperStack);
    this.addOBB(targetBoxColliders, -24.4, -51.2, 1.95, 1.4, 2.2, false, 0);

    // Room 4: غرفة الحمام (West North: x in [-27.0..-13.6], z in [-68.0..-55.8])
    const bathRimMat = marbleMat;
    this.bathWaterMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x22b8cf,
        emissive: 0x0b4f6c,
        emissiveIntensity: 0.35,
        roughness: 0.14,
        metalness: 0.2,
      })
    );
    const poolOuter = new THREE.Mesh(this.track(new THREE.BoxGeometry(5.2, 0.58, 5.2)), bathRimMat);
    poolOuter.position.set(-21.2, 0.33, -61.9);
    this.group.add(poolOuter);
    const poolWater = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.5, 0.08, 4.5)),
      this.bathWaterMat
    );
    poolWater.position.set(-21.2, 0.62, -61.9);
    this.group.add(poolWater);
    const spout = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.1, 0.14, 0.78, 8)), goldMat);
    spout.position.set(-23.65, 0.94, -61.9);
    this.group.add(spout);
    this.addOBB(targetBoxColliders, -21.2, -61.9, 5.25, 5.25, 0.7, false, 0);

    const washStand = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.45, 0.9, 0.85)), bathRimMat);
    washStand.position.set(-24.8, 0.49, -57.2);
    this.group.add(washStand);
    const ewer = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.13, 0.19, 0.42, 8)), copperMat);
    ewer.position.set(-24.8, 1.15, -57.2);
    this.group.add(ewer);
    this.addOBB(targetBoxColliders, -24.8, -57.2, 1.5, 0.9, 1.2, false, 0);

    const towelBench = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.6, 0.48, 0.78)), oakWoodMat);
    towelBench.position.set(-20.2, 0.28, -66.8);
    this.group.add(towelBench);
    [-20.8, -19.6].forEach((tx) => {
      const towel = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.58, 0.16, 0.5)), creamFabricMat);
      towel.position.set(tx, 0.6, -66.8);
      this.group.add(towel);
    });
    this.addOBB(targetBoxColliders, -20.2, -66.8, 2.65, 0.82, 0.64, false, 0);

    // Room 5: غرفة الوزير (East South: x in [+13.6..+27.0], z in [-43.7..-30.5])
    addRug(20.2, -37.2, 8.8, 7.8, '#134e4a', '#eab308');
    const vizierDesk = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.35, 0.86, 2.8)), darkWoodMat);
    vizierDesk.position.set(17.8, 0.47, -34.2);
    vizierDesk.castShadow = true;
    this.group.add(vizierDesk);
    const ledger = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.5, 0.1, 0.66)), creamFabricMat);
    ledger.position.set(17.68, 0.95, -33.8);
    this.group.add(ledger);
    const inkwell = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 8)), goldMat);
    inkwell.position.set(17.62, 0.97, -34.8);
    this.group.add(inkwell);
    this.addOBB(targetBoxColliders, 17.8, -34.2, 1.4, 2.85, 1.0, false, 0);

    const vizierChair = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.76, 1.32, 0.76)), crimsonVelvetMat);
    vizierChair.position.set(19.2, 0.7, -34.2);
    this.group.add(vizierChair);
    this.addOBB(targetBoxColliders, 19.2, -34.2, 0.8, 0.8, 1.32, false, 0);

    addBed(21.2, -41.3, 2.8, 2.35, emeraldFabricMat, false);
    const vizierStand = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.68, 0.6, 0.62)), oakWoodMat);
    vizierStand.position.set(23.6, 0.34, -41.9);
    this.group.add(vizierStand);
    const vizierLamp = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.14, 8, 8)), glowMat);
    vizierLamp.position.set(23.6, 0.78, -41.9);
    this.group.add(vizierLamp);
    this.addOBB(targetBoxColliders, 23.6, -41.9, 0.72, 0.66, 0.85, false, 0);

    const vShelf1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.74, 2.9, 2.4)), darkWoodMat);
    vShelf1.position.set(26.1, 1.49, -34.6);
    this.group.add(vShelf1);
    this.addOBB(targetBoxColliders, 26.1, -34.6, 0.78, 2.45, 2.9, false, 0);

    const vShelf2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.6, 2.9, 0.74)), darkWoodMat);
    vShelf2.position.set(16.2, 1.49, -31.5);
    this.group.add(vShelf2);
    this.addOBB(targetBoxColliders, 16.2, -31.5, 2.65, 0.78, 2.9, false, 0);

    // Room 6: غرفة الجنرال (East Mid: x in [+13.6..+27.0], z in [-55.8..-43.7])
    addRug(20.2, -49.75, 8.2, 7.4, '#7f1d1d', '#d4af37');
    const genDesk = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.35, 0.86, 2.8)), oakWoodMat);
    genDesk.position.set(19.8, 0.47, -47.8);
    this.group.add(genDesk);
    this.addOBB(targetBoxColliders, 19.8, -47.8, 1.4, 2.85, 0.9, false, 0);

    const rack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.66, 2.1, 3.0)), darkWoodMat);
    rack.position.set(26.1, 1.09, -50.4);
    this.group.add(rack);
    [-51.4, -50.4, -49.4].forEach((sz) => {
      const spear = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6)), ironMat);
      spear.position.set(25.9, 1.3, sz);
      this.group.add(spear);
    });
    const shield = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.48, 0.48, 0.09, 12)), goldMat);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(25.65, 1.4, -50.4);
    this.group.add(shield);
    this.addOBB(targetBoxColliders, 26.1, -50.4, 0.72, 3.05, 2.2, false, 0);

    const warChest = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.75, 0.76, 0.98)), ironMat);
    warChest.position.set(19.8, 0.42, -54.2);
    this.group.add(warChest);
    this.addOBB(targetBoxColliders, 19.8, -54.2, 1.8, 1.02, 0.84, false, 0);

    // Room 7: غرفة التخطيط (East North: x in [+13.6..+27.0], z in [-68.0..-55.8])
    const mapTex = this.createPlanningMapTexture();
    const mapMat = this.track(new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.6 }));

    const planTable = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.8, 0.9, 2.6)), darkWoodMat);
    planTable.position.set(20.2, 0.49, -61.9);
    planTable.castShadow = true;
    this.group.add(planTable);

    const tableMapPlane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.45, 2.25)), mapMat);
    tableMapPlane.rotation.x = -Math.PI / 2;
    tableMapPlane.position.set(20.2, 0.95, -61.9);
    this.group.add(tableMapPlane);

    const tokenCoords: [number, number, number][] = [
      [19.4, -62.4, 0xdc2626],
      [20.3, -61.7, 0xeab308],
      [21.1, -61.2, 0x2563eb],
      [19.6, -61.3, 0x16a34a],
    ];
    tokenCoords.forEach(([tx, tz, col]) => {
      const tMat = this.track(new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 }));
      const pawn = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.1, 0.26, 8)), tMat);
      pawn.position.set(tx, 1.08, tz);
      this.group.add(pawn);
    });
    this.addOBB(targetBoxColliders, 20.2, -61.9, 3.88, 2.68, 1.1, false, 0);

    const wallMapBoard = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.14, 2.1, 3.4)), darkWoodMat);
    wallMapBoard.position.set(26.6, 2.55, -61.9);
    this.group.add(wallMapBoard);
    const wallMapFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.15, 1.85)), mapMat);
    wallMapFace.rotation.y = -Math.PI / 2;
    wallMapFace.position.set(26.5, 2.55, -61.9);
    this.group.add(wallMapFace);

    // -------------------------------------------------------------------------
    // 7. Second Floor Slab ("الطابق الثاني") with Stairwell Cutouts & Overlook Balcony
    // -------------------------------------------------------------------------
    const addFloor2Slab = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const slabMesh = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, 0.24, d)),
        floorMarbleMat
      );
      slabMesh.position.set(cx, floor1H - 0.12, cz);
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      this.group.add(slabMesh);
      this.addOBB(targetBoxColliders, cx, cz, w, d, floor1H, true, floor1H - 0.24);
    };

    // North Rear Floor 2 Wing (covers z in [-68.0 .. -48.2])
    addFloor2Slab(-27.0, 27.0, -68.0, -48.2);
    // South Front Floor 2 Wing (covers z in [-39.1 .. -30.5])
    addFloor2Slab(-27.0, 27.0, -39.1, -30.5);
    // Middle Strips leaving West & East Stairwell Holes open (x in [-13.2..-8.2] & [+8.2..+13.2], z in [-48.2..-39.1])
    addFloor2Slab(-8.2, 8.2, -48.2, -39.1);
    addFloor2Slab(-27.0, -13.2, -48.2, -39.1);
    addFloor2Slab(13.2, 27.0, -48.2, -39.1);

    // Panoramic South Kingdom Overlook Balcony ("شرفة الإطلالة الملكية": x in [-17.6..+17.6], z in [-30.5..-26.4])
    addFloor2Slab(-17.6, 17.6, -30.5, -26.4);
    addRug(0, -28.4, 24.0, 2.8, '#8f1422', '#eab308', floor1H);

    // Ornate Stone & Gold Overlook Balcony Balustrades (height 0.95m -> crystal clear Kingdom view)
    const addBalustrade = (cx: number, cz: number, w: number, d: number, baseY: number) => {
      const wall = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 0.85, d)), trimStoneMat);
      wall.position.set(cx, baseY + 0.425, cz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      const rail = new THREE.Mesh(this.track(new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06)), goldMat);
      rail.position.set(cx, baseY + 0.9, cz);
      this.group.add(rail);

      this.addOBB(targetBoxColliders, cx, cz, w + 0.06, d + 0.06, baseY + 0.98, false, baseY);
    };
    // Overlook Balcony Front & Side Balustrades
    addBalustrade(0, -26.48, 35.2, 0.24, floor1H);
    addBalustrade(-17.48, -28.45, 0.24, 4.1, floor1H);
    addBalustrade(17.48, -28.45, 0.24, 4.1, floor1H);

    // Stairwell Hole Guardrails on Floor 2 (framing North, Inner & Outer edges; South mouth z = -39.1 stays open!)
    ([-1, 1] as const).forEach((side) => {
      addBalustrade(side * 10.7, -48.18, 5.1, 0.2, floor1H); // North edge
      addBalustrade(side * 8.18, -43.65, 0.2, 9.1, floor1H); // Inner edge facing central hall
      addBalustrade(side * 13.18, -43.65, 0.2, 9.1, floor1H); // Outer edge near wing walls
    });

    // Balcony Signboard ("شرفة الإطلالة الملكية") facing back into Floor 2 Gallery & outward
    const balcSignTex = this.createArabicPlaqueTexture('شرفة الإطلالة الملكية', '#3a1118', '#eab308', '#fef3c7');
    const balcSignMat = this.track(new THREE.MeshStandardMaterial({ map: balcSignTex, roughness: 0.45 }));
    const balcSign = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.4, 0.72)), balcSignMat);
    balcSign.position.set(0, floor1H + 3.65, -30.22);
    this.group.add(balcSign);

    // -------------------------------------------------------------------------
    // 8. Second Floor Perimeter Walls, Balcony Archways, Upper Rooms & Furnishings
    // -------------------------------------------------------------------------
    // Floor 2 Outer Perimeter Walls (y = floor1H .. roofBaseY)
    addWallSegment(-27.0, -68.0, -27.0, -30.5, wallT, floor2H, floor1H); // West
    addWallSegment(27.0, -68.0, 27.0, -30.5, wallT, floor2H, floor1H);   // East
    addWallSegment(-27.2, -68.0, 27.2, -68.0, wallT, floor2H, floor1H);  // North
    // Floor 2 South Facade with 3 wide open Archways out onto the Overlook Balcony:
    // Center arch: [-2.4..+2.4], Side arches: [-12.4..-10.0] and [+10.0..+12.4]
    addWallSegment(-27.2, -30.5, -12.4, -30.5, wallT, floor2H, floor1H);
    addWallSegment(-10.0, -30.5, -2.4, -30.5, wallT, floor2H, floor1H);
    addWallSegment(2.4, -30.5, 10.0, -30.5, wallT, floor2H, floor1H);
    addWallSegment(12.4, -30.5, 27.2, -30.5, wallT, floor2H, floor1H);

    // Overhead lintels for the 3 open Balcony Archways
    [
      { cx: 0, w: 5.0 },
      { cx: -11.2, w: 2.6 },
      { cx: 11.2, w: 2.6 },
    ].forEach(({ cx, w }) => {
      const lintel = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, 1.0, wallT + 0.04)),
        palaceWallMat
      );
      lintel.position.set(cx, roofBaseY - 0.5, -30.5);
      this.group.add(lintel);
      const trim = new THREE.Mesh(this.track(new THREE.BoxGeometry(w + 0.08, 0.14, wallT + 0.1)), goldMat);
      trim.position.set(cx, roofBaseY - 1.0, -30.5);
      this.group.add(trim);
    });

    // Floor 2 Wing Partition Walls (x = ±13.6) + cross walls & doors
    addWallSegment(-13.6, -33.8, -13.6, -30.5, wallT, floor2H, floor1H);
    addWallSegment(-13.6, -51.2, -13.6, -35.8, wallT, floor2H, floor1H);
    addWallSegment(-13.6, -60.9, -13.6, -53.2, wallT, floor2H, floor1H);
    addWallSegment(-13.6, -68.0, -13.6, -62.9, wallT, floor2H, floor1H);
    addWallSegment(-27.0, -43.7, -13.6, -43.7, wallT, floor2H, floor1H);
    addWallSegment(-27.0, -55.8, -13.6, -55.8, wallT, floor2H, floor1H);

    addRoomDoor(-13.6, -34.8, 'zWall', -1, 'قاعة الخزينة الملكية', 1, floor1H, floor2H);
    addRoomDoor(-13.6, -52.2, 'zWall', -1, 'المكتبة الملكية', 1, floor1H, floor2H);
    addRoomDoor(-13.6, -61.9, 'zWall', -1, 'مقصورة الراحة العليا', 1, floor1H, floor2H);

    addWallSegment(13.6, -33.8, 13.6, -30.5, wallT, floor2H, floor1H);
    addWallSegment(13.6, -51.2, 13.6, -35.8, wallT, floor2H, floor1H);
    addWallSegment(13.6, -60.9, 13.6, -53.2, wallT, floor2H, floor1H);
    addWallSegment(13.6, -68.0, 13.6, -62.9, wallT, floor2H, floor1H);
    addWallSegment(13.6, -43.7, 27.0, -43.7, wallT, floor2H, floor1H);
    addWallSegment(13.6, -55.8, 27.0, -55.8, wallT, floor2H, floor1H);

    addRoomDoor(13.6, -34.8, 'zWall', 1, 'قاعة الدروع والأوسمة', -1, floor1H, floor2H);
    addRoomDoor(13.6, -52.2, 'zWall', 1, 'مرصد المملكة والفلك', -1, floor1H, floor2H);
    addRoomDoor(13.6, -61.9, 'zWall', 1, 'جناح الضيافة العلوي', -1, floor1H, floor2H);

    // Central Upper Royal Diwan (x in [-13.6..+13.6], z in [-68.0..-55.8])
    addWallSegment(-13.6, -55.8, -1.0, -55.8, wallT, floor2H, floor1H);
    addWallSegment(1.0, -55.8, 13.6, -55.8, wallT, floor2H, floor1H);
    addRoomDoor(0, -55.8, 'xWall', -1, 'ديوان السلطان العلوي', 1, floor1H, floor2H);

    // Upper Gallery Carpet & Pillars
    addRug(0, -39.5, 5.4, 15.0, '#7c1220', '#e6b53b', floor1H);
    [-5.8, 5.8].forEach((px) => {
      [-34.5, -51.5].forEach((pz) => {
        const upPillar = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.28, 0.32, floor2H - 0.12, 12)),
          marbleMat
        );
        upPillar.position.set(px, floor1H + (floor2H - 0.12) * 0.5, pz);
        upPillar.castShadow = true;
        this.group.add(upPillar);
        this.addCylinder(targetCylinderColliders, px, pz, 0.38, roofBaseY, floor1H);
      });
    });

    // Upper Diwan Council Hall Furniture (x in [-13.6..13.6], z in [-68.0..-55.8])
    addRug(0, -61.8, 14.0, 8.6, '#134e4a', '#eab308', floor1H);
    const diwanTable = new THREE.Mesh(this.track(new THREE.CylinderGeometry(2.6, 2.4, 0.82, 16)), darkWoodMat);
    diwanTable.position.set(0, floor1H + 0.41, -61.8);
    diwanTable.castShadow = true;
    this.group.add(diwanTable);
    const diwanCenterPiece = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.45, 0.35, 0.45, 10)), goldMat);
    diwanCenterPiece.position.set(0, floor1H + 1.05, -61.8);
    this.group.add(diwanCenterPiece);
    this.addCylinder(targetCylinderColliders, 0, -61.8, 2.65, floor1H + 1.2, floor1H);

    // Emerald Council Cushions around Diwan walls
    const diwanBenchN = new THREE.Mesh(this.track(new THREE.BoxGeometry(10.0, 0.65, 1.1)), emeraldFabricMat);
    diwanBenchN.position.set(0, floor1H + 0.325, -67.0);
    this.group.add(diwanBenchN);
    this.addOBB(targetBoxColliders, 0, -67.0, 10.1, 1.15, floor1H + 0.75, false, floor1H);

    // West Upper 1: قاعة الخزينة الملكية
    addRug(-20.2, -37.2, 8.2, 7.6, '#4c1d95', '#f59e0b', floor1H);
    [[-24.2, -33.2], [-24.2, -40.2], [-19.8, -32.2]].forEach(([cx, cz]) => {
      const chest = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.7, 0.9, 1.0)), darkWoodMat);
      chest.position.set(cx, floor1H + 0.45, cz);
      this.group.add(chest);
      const goldTrim = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.76, 0.16, 1.06)), goldMat);
      goldTrim.position.set(cx, floor1H + 0.82, cz);
      this.group.add(goldTrim);
      this.addOBB(targetBoxColliders, cx, cz, 1.78, 1.08, floor1H + 1.0, false, floor1H);
    });

    // West Upper 2: المكتبة الملكية
    addRug(-20.2, -49.75, 8.0, 7.2, '#1e3a8a', '#eab308', floor1H);
    [-46.2, -50.0, -53.8].forEach((bz) => {
      const shelf = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.8, 2.9, 2.8)), darkWoodMat);
      shelf.position.set(-25.8, floor1H + 1.45, bz);
      this.group.add(shelf);
      this.addOBB(targetBoxColliders, -25.8, bz, 0.86, 2.86, floor1H + 2.9, false, floor1H);
    });
    const libTable = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.6, 0.84, 1.5)), oakWoodMat);
    libTable.position.set(-20.0, floor1H + 0.42, -49.5);
    this.group.add(libTable);
    this.addOBB(targetBoxColliders, -20.0, -49.5, 2.66, 1.56, floor1H + 0.9, false, floor1H);

    // West Upper 3: مقصورة الراحة العليا
    addRug(-20.2, -61.9, 8.0, 7.4, '#7c1220', '#e6b53b', floor1H);
    const loungeSofa = new THREE.Mesh(this.track(new THREE.BoxGeometry(4.4, 0.78, 1.15)), crimsonVelvetMat);
    loungeSofa.position.set(-22.5, floor1H + 0.39, -66.8);
    this.group.add(loungeSofa);
    this.addOBB(targetBoxColliders, -22.5, -66.8, 4.46, 1.2, floor1H + 0.85, false, floor1H);

    // East Upper 1: قاعة الدروع والأوسمة
    addRug(20.2, -37.2, 8.2, 7.6, '#7f1d1d', '#eab308', floor1H);
    [-33.5, -37.2, -40.8].forEach((az) => {
      const stand = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.45, 0.55, 1.8, 10)), ironMat);
      stand.position.set(25.4, floor1H + 0.9, az);
      this.group.add(stand);
      const crest = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.24, 0)), goldMat);
      crest.position.set(25.4, floor1H + 1.98, az);
      this.group.add(crest);
      this.addCylinder(targetCylinderColliders, 25.4, az, 0.6, floor1H + 2.1, floor1H);
    });

    // East Upper 2: مرصد المملكة والفلك
    const obsTable = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.4, 1.4, 0.88, 16)), darkWoodMat);
    obsTable.position.set(20.2, floor1H + 0.44, -49.8);
    this.group.add(obsTable);
    const globe = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.65, 16, 12)), goldMat);
    globe.position.set(20.2, floor1H + 1.5, -49.8);
    this.group.add(globe);
    this.addCylinder(targetCylinderColliders, 20.2, -49.8, 1.46, floor1H + 2.1, floor1H);

    // East Upper 3: جناح الضيافة العلوي
    addRug(20.2, -61.9, 8.4, 7.6, '#1f4e5f', '#eab308', floor1H);
    addBed(23.0, -64.4, 3.2, 2.2, emeraldFabricMat, true, floor1H);

    // -------------------------------------------------------------------------
    // 9. Calibrated Interior Lighting (gentle daytime fill, cozy warm night glow)
    // -------------------------------------------------------------------------
    const lightPositions: [number, number, number, number][] = [
      // Ground floor
      [0, floor1H - 0.5, -42.0, 26.0],
      [0, floor1H - 0.5, -62.0, 20.0],
      [-20.2, floor1H - 0.5, -49.2, 24.0],
      [20.2, floor1H - 0.5, -49.2, 24.0],
      // Second floor
      [0, roofBaseY - 0.5, -42.0, 26.0],
      [0, roofBaseY - 0.5, -62.0, 22.0],
      [-20.2, roofBaseY - 0.5, -49.2, 24.0],
      [20.2, roofBaseY - 0.5, -49.2, 24.0],
    ];
    lightPositions.forEach(([lx, ly, lz, dist]) => {
      const pl = new THREE.PointLight(0xffbe63, 0.16, dist, 1.6);
      pl.position.set(lx, ly, lz);
      pl.castShadow = false;
      this.group.add(pl);
      this.interiorLights.push(pl);
    });

    // -------------------------------------------------------------------------
    // 10. Second-Floor Roof, Battlements, Corner Watchtowers & Grand Golden Domes
    // -------------------------------------------------------------------------
    this.roofGroup = new THREE.Group();
    this.roofGroup.name = 'PalaceRoofCutaway';

    const roofStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xcab99c,
        roughness: 0.85,
        metalness: 0.04,
        envMapIntensity: 0.3,
      })
    );
    const roofGoldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2b138,
        roughness: 0.28,
        metalness: 0.85,
      })
    );
    const roofCrimsonMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x8f1622,
        roughness: 0.78,
        metalness: 0.06,
      })
    );

    const roofSlab = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(54.8, 0.38, 38.2)),
      roofStoneMat
    );
    roofSlab.position.set(0, roofBaseY + 0.19, -49.25);
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    this.roofGroup.add(roofSlab);

    const ceilingMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xc4af8e,
        roughness: 0.85,
        metalness: 0.03,
        envMapIntensity: 0.25,
      })
    );
    const interiorCeiling = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(53.4, 0.08, 36.8)),
      ceilingMat
    );
    interiorCeiling.position.set(0, roofBaseY - 0.03, -49.25);
    interiorCeiling.receiveShadow = true;
    this.roofGroup.add(interiorCeiling);

    [-34.5, -42.0, -49.25, -56.5, -64.0].forEach((bz) => {
      const beam = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(53.2, 0.2, 0.34)),
        darkWoodMat
      );
      beam.position.set(0, roofBaseY - 0.13, bz);
      this.roofGroup.add(beam);
    });

    // Hanging Royal Gold Chandeliers on Both Floors
    [-39.0, -47.0].forEach((cz) => {
      [floor1H, roofBaseY].forEach((ceilY) => {
        const chain = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6)),
          roofGoldMat
        );
        chain.position.set(0, ceilY - 0.45, cz);
        this.group.add(chain);
        const ring = new THREE.Mesh(
          this.track(new THREE.TorusGeometry(0.72, 0.055, 8, 16)),
          roofGoldMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, ceilY - 0.9, cz);
        this.group.add(ring);
        const bulb = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.2, 8, 8)), glowMat);
        bulb.position.set(0, ceilY - 0.9, cz);
        this.group.add(bulb);
      });
    });

    // Front, Back & Side Roof Battlements
    for (let bx = -25.0; bx <= 25.0; bx += 2.5) {
      [-30.3, -68.2].forEach((bz) => {
        const merlon = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(1.2, 0.76, 0.5)),
          roofStoneMat
        );
        merlon.position.set(bx, roofBaseY + 0.74, bz);
        this.roofGroup.add(merlon);
      });
    }
    for (let bz = -65.5; bz <= -33.0; bz += 2.6) {
      [-26.8, 26.8].forEach((bx) => {
        const merlon = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.5, 0.76, 1.2)),
          roofStoneMat
        );
        merlon.position.set(bx, roofBaseY + 0.74, bz);
        this.roofGroup.add(merlon);
      });
    }

    // Central Grand Golden Dome atop Floor 2
    const domeDrum = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(6.0, 6.3, 1.75, 22)),
      roofStoneMat
    );
    domeDrum.position.set(0, roofBaseY + 1.2, -46.5);
    this.roofGroup.add(domeDrum);

    const centralDome = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(5.9, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      roofGoldMat
    );
    centralDome.position.set(0, roofBaseY + 2.0, -46.5);
    centralDome.castShadow = true;
    this.roofGroup.add(centralDome);

    const centralFinial = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(0.32, 1.65, 8)),
      roofGoldMat
    );
    centralFinial.position.set(0, roofBaseY + 8.35, -46.5);
    this.roofGroup.add(centralFinial);

    // 4 Corner Royal Turrets with Crimson-Gold Domes
    [
      [-26.2, -31.2],
      [26.2, -31.2],
      [-26.2, -67.3],
      [26.2, -67.3],
    ].forEach(([tx, tz]) => {
      const turret = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(1.85, 2.0, 2.8, 12)),
        roofStoneMat
      );
      turret.position.set(tx, roofBaseY + 1.4, tz);
      this.roofGroup.add(turret);

      const turretDome = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(1.95, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        roofCrimsonMat
      );
      turretDome.position.set(tx, roofBaseY + 2.75, tz);
      this.roofGroup.add(turretDome);

      const spire = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.22, 1.0, 8)), roofGoldMat);
      spire.position.set(tx, roofBaseY + 5.05, tz);
      this.roofGroup.add(spire);
    });

    this.group.add(this.roofGroup);
  }

  public update(delta: number, sultanPos: THREE.Vector3, extraOpeners?: THREE.Vector3[]) {
    this.waterAnimTime += delta;
    if (this.bathWaterMat) {
      this.bathWaterMat.emissiveIntensity = 0.32 + Math.sin(this.waterAnimTime * 2.2) * 0.06;
    }

    // Animate intermittent small rats scurrying inside the Palace ground halls
    for (let i = 0; i < this.palaceRatActors.length; i++) {
      const r = this.palaceRatActors[i];
      r.stateTimer -= delta;
      if (r.stateTimer <= 0) {
        if (r.state === 'roaming') {
          r.state = 'hidden';
          r.stateTimer = 8 + Math.random() * 9;
          r.group.visible = false;
        } else {
          r.state = 'roaming';
          r.stateTimer = 12 + Math.random() * 9;
          r.x = (i % 2 === 0 ? -1 : 1) * (4.0 + Math.random() * 3.0);
          r.z = -46.5 + Math.random() * 13.0;
          r.angle = (r.x < 0 ? 1 : -1) * (0.4 + Math.random() * 1.6);
          r.group.position.set(r.x, 0.045, r.z);
          r.group.visible = true;
        }
      }
      if (r.state !== 'roaming') continue;

      r.timer -= delta;
      if (r.timer <= 0) {
        r.timer = 1.2 + Math.random() * 2.2;
        r.angle += (Math.random() - 0.5) * 2.1;
      }
      r.x += Math.sin(r.angle) * r.speed * delta;
      r.z += Math.cos(r.angle) * r.speed * delta;
      if (r.x < -7.6 || r.x > 7.6) {
        r.angle = -r.angle;
        r.x = Math.max(-7.4, Math.min(7.4, r.x));
      }
      if (r.z < -48.0 || r.z > -32.2) {
        r.angle = Math.PI - r.angle;
        r.z = Math.max(-47.8, Math.min(-32.4, r.z));
      }
      r.group.position.set(r.x, 0.045, r.z);
      r.group.rotation.y = r.angle;
      r.tail.rotation.y = Math.sin(this.waterAnimTime * 16 + i) * 0.45;
    }

    if (!this.roofGroup.visible) {
      this.roofGroup.visible = true;
    }

    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      let shouldOpen =
        Math.abs(sultanPos.y - d.worldPos.y) < 2.6 &&
        Math.hypot(sultanPos.x - d.worldPos.x, sultanPos.z - d.worldPos.z) < d.openRadius;

      if (!shouldOpen && extraOpeners) {
        for (let k = 0; k < extraOpeners.length; k++) {
          const ep = extraOpeners[k];
          if (
            Math.abs(ep.y - d.worldPos.y) < 2.6 &&
            Math.hypot(ep.x - d.worldPos.x, ep.z - d.worldPos.z) < d.openRadius
          ) {
            shouldOpen = true;
            break;
          }
        }
      }

      const prevTarget = d.targetOpen;
      d.targetOpen = shouldOpen ? 1 : 0;
      if (
        d.targetOpen !== prevTarget &&
        Math.abs(sultanPos.y - d.worldPos.y) < 2.6 &&
        Math.hypot(sultanPos.x - d.worldPos.x, sultanPos.z - d.worldPos.z) < 7.5
      ) {
        if (d.targetOpen > 0.5) {
          soundManager.playJump();
        }
      }

      d.openAmount = THREE.MathUtils.damp(d.openAmount, d.targetOpen, 8.0, delta);
      if (d.isDouble && d.hingePivotRight) {
        d.hingePivot.rotation.y = d.openAmount * d.openAngle;
        d.hingePivotRight.rotation.y = -d.openAmount * d.openAngle;
      } else {
        d.hingePivot.rotation.y = d.openAmount * d.openAngle;
      }

      if (d.openAmount > 0.48) {
        d.collider.halfW = 0.01;
        d.collider.halfD = 0.01;
      } else {
        d.collider.halfW = d.closedHalfW;
        d.collider.halfD = d.closedHalfD;
      }
    }
  }

  public setNightAmount(nightAmount: number) {
    const n = Math.max(0, Math.min(1, nightAmount));
    for (let i = 0; i < this.glowMaterials.length; i++) {
      this.glowMaterials[i].emissiveIntensity = 0.65 + n * 1.9;
    }
    for (let i = 0; i < this.interiorLights.length; i++) {
      this.interiorLights[i].intensity = 0.16 + n * 1.75;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.interiorLights = [];
    this.glowMaterials = [];
    this.doors = [];
    this.wallBoxes = [];
    this.throneCollider = null;
  }
}
