import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';
import { soundManager } from './audio';

export interface PrisonGuardPost {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

/**
 * Simple Stone & Iron Royal Prison ("السجن الملكي") with a hinged barred door
 * that opens and closes smoothly, interior cell slots for imprisoned citizens,
 * and perimeter guard posts surrounding all four sides of the building.
 */
export class RoyalPrison {
  public group: THREE.Group;
  public readonly origin = new THREE.Vector3(13.8, 0, -16.8);
  public readonly rotY: number;
  public readonly doorOutsidePos: THREE.Vector3;
  public readonly doorThresholdPos: THREE.Vector3;
  public readonly guardLockPos: THREE.Vector3;
  public readonly cellCenterPos: THREE.Vector3;

  private disposables: { dispose: () => void }[] = [];
  private doorPivot!: THREE.Group;
  private doorCollider!: OBBCollider;
  private doorOpenAmount: number = 0; // 0 = closed/locked, 1 = wide open
  private doorTargetOpen: number = 0;
  private lockHoldTimer: number = 0;
  private openHoldTimer: number = 0;
  private torchFlames: THREE.Mesh[] = [];
  private wasDoorOpenFlag: boolean = false;

  private readonly cosR: number;
  private readonly sinR: number;

  constructor(
    targetBoxColliders: OBBCollider[],
    targetFootprints?: { x: number; z: number; r: number }[]
  ) {
    this.rotY = Math.atan2(-this.origin.x, -this.origin.z); // Face toward Central Plaza (0, 0)
    this.cosR = Math.cos(this.rotY);
    this.sinR = Math.sin(this.rotY);

    this.group = new THREE.Group();
    this.group.name = 'RoyalPrison';
    this.group.position.copy(this.origin);
    this.group.rotation.y = this.rotY;

    this.doorOutsidePos = this.localToWorld(0, 0, 4.35);
    this.doorThresholdPos = this.localToWorld(0, 0, 2.55);
    this.guardLockPos = this.localToWorld(1.55, 0, 3.35);
    this.cellCenterPos = this.localToWorld(0, 0, -0.35);

    this.buildPrisonStructure(targetBoxColliders);

    if (targetFootprints) {
      targetFootprints.push({ x: this.origin.x, z: this.origin.z, r: 5.4 });
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  public localToWorld(lx: number, ly: number, lz: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.origin.x + lx * this.cosR + lz * this.sinR,
      ly,
      this.origin.z - lx * this.sinR + lz * this.cosR
    );
  }

  public worldToLocalXZ(wx: number, wz: number): { lx: number; lz: number } {
    const dx = wx - this.origin.x;
    const dz = wz - this.origin.z;
    return {
      lx: dx * this.cosR - dz * this.sinR,
      lz: dx * this.sinR + dz * this.cosR,
    };
  }

  public getCellSlot(slotIndex: number): THREE.Vector3 {
    const slots: [number, number][] = [
      [0.0, -0.6],
      [-1.55, -0.95],
      [1.55, -0.95],
      [-1.45, 0.55],
      [1.45, 0.55],
      [0.0, 0.45],
    ];
    const [lx, lz] = slots[slotIndex % slots.length];
    return this.localToWorld(lx, 0, lz);
  }

  public getGuardPosts(): PrisonGuardPost[] {
    const localPosts: { id: string; lx: number; lz: number; localRotY: number }[] = [
      { id: 'c_prison_guard_front_l', lx: -2.25, lz: 3.55, localRotY: 0 },
      { id: 'c_prison_guard_front_r', lx: 2.25, lz: 3.55, localRotY: 0 },
      { id: 'c_prison_guard_west', lx: -4.05, lz: -0.2, localRotY: -Math.PI / 2 },
      { id: 'c_prison_guard_east', lx: 4.05, lz: -0.2, localRotY: Math.PI / 2 },
      { id: 'c_prison_guard_back', lx: 0.0, lz: -3.65, localRotY: Math.PI },
    ];

    return localPosts.map((p) => {
      const worldPos = this.localToWorld(p.lx, 0, p.lz);
      return {
        id: p.id,
        x: worldPos.x,
        z: worldPos.z,
        rotY: this.rotY + p.localRotY,
      };
    });
  }

  private registerLocalOBB(
    targetBoxColliders: OBBCollider[],
    lx: number,
    lz: number,
    width: number,
    depth: number,
    topY: number
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
      allowStand: false,
    };
    targetBoxColliders.push(col);
    return col;
  }

  private createPrisonSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#221c19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#f3f4f6';
    ctx.font = '800 84px "Marhey", "Tajawal", sans-serif';
    ctx.fillText('السجن الملكي', canvas.width / 2, canvas.height / 2 + 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildPrisonStructure(targetBoxColliders: OBBCollider[]) {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    const wallStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x918c84,
        roughness: 0.92,
        metalness: 0.06,
      })
    );
    const darkStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x57534d,
        roughness: 0.94,
        metalness: 0.08,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x22262d,
        roughness: 0.42,
        metalness: 0.82,
      })
    );
    const lockGoldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xd9a438,
        roughness: 0.3,
        metalness: 0.85,
      })
    );
    const woodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x6f4a2a,
        roughness: 0.85,
        metalness: 0.03,
      })
    );
    const flameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff771f,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );

    // 1. Dark Flagstone Floor Base (low 0.05m step so characters stand seamlessly)
    const floorMesh = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(6.6, 0.06, 5.6)),
      darkStoneMat
    );
    floorMesh.position.set(0, 0.03, 0);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // Subtle stone entrance apron in front of doorway
    const apron = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.4, 0.04, 1.8)),
      darkStoneMat
    );
    apron.position.set(0, 0.02, 3.45);
    apron.receiveShadow = true;
    this.group.add(apron);

    // 2. Back Solid Stone Wall (z = -2.5)
    const backWall = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(6.2, 3.35, 0.4)),
      wallStoneMat
    );
    backWall.position.set(0, 1.675, -2.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // 3. Helper to build a Stone Wall with a Barred Iron Window Opening
    const buildBarredWall = (
      cx: number,
      cz: number,
      rotY: number,
      totalLen: number,
      winWidth: number
    ) => {
      const wg = new THREE.Group();
      wg.position.set(cx, 0, cz);
      wg.rotation.y = rotY;

      const sidePierLen = (totalLen - winWidth) * 0.5;
      const pierGeo = this.track(new THREE.BoxGeometry(sidePierLen, 3.35, 0.4));
      [-1, 1].forEach((s) => {
        const pier = new THREE.Mesh(pierGeo, wallStoneMat);
        pier.position.set(s * (winWidth * 0.5 + sidePierLen * 0.5), 1.675, 0);
        pier.castShadow = true;
        pier.receiveShadow = true;
        wg.add(pier);
      });

      // Lower sill wall & upper header lintel around barred window
      const sill = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(winWidth, 1.05, 0.4)),
        wallStoneMat
      );
      sill.position.set(0, 0.525, 0);
      sill.castShadow = true;
      sill.receiveShadow = true;
      wg.add(sill);

      const header = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(winWidth, 0.95, 0.4)),
        wallStoneMat
      );
      header.position.set(0, 2.875, 0);
      header.castShadow = true;
      wg.add(header);

      // Vertical & horizontal iron bars inside window opening (y = 1.05..2.40)
      const barGeo = this.track(new THREE.CylinderGeometry(0.032, 0.032, 1.38, 6));
      const barCount = Math.max(3, Math.round(winWidth / 0.28));
      for (let i = 0; i < barCount; i++) {
        const bx = -winWidth * 0.42 + (i / (barCount - 1)) * (winWidth * 0.84);
        const bar = new THREE.Mesh(barGeo, ironMat);
        bar.position.set(bx, 1.72, 0);
        bar.castShadow = true;
        wg.add(bar);
      }
      const crossGeo = this.track(new THREE.BoxGeometry(winWidth + 0.04, 0.06, 0.06));
      const cross = new THREE.Mesh(crossGeo, ironMat);
      cross.position.set(0, 1.72, 0);
      wg.add(cross);

      this.group.add(wg);
    };

    // Left & Right Stone Walls with Barred Prison Windows
    buildBarredWall(-2.9, 0, Math.PI / 2, 5.2, 1.65);
    buildBarredWall(2.9, 0, Math.PI / 2, 5.2, 1.65);

    // Front Left & Right Wall Piers with large Barred Cell Windows (so prisoners inside are visible!)
    buildBarredWall(-2.08, 2.5, 0, 2.04, 1.15);
    buildBarredWall(2.08, 2.5, 0, 2.04, 1.15);

    // Front Stone Doorway Jambs & Overhead Arch Header (x in [-1.06 .. +1.06])
    const jambGeo = this.track(new THREE.BoxGeometry(0.22, 2.55, 0.48));
    [-1.12, 1.12].forEach((jx) => {
      const jamb = new THREE.Mesh(jambGeo, darkStoneMat);
      jamb.position.set(jx, 1.275, 2.5);
      jamb.castShadow = true;
      wgAddShadow(jamb);
      this.group.add(jamb);
    });

    function wgAddShadow(m: THREE.Mesh) {
      m.receiveShadow = true;
    }

    const doorHeader = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.5, 0.84, 0.48)),
      darkStoneMat
    );
    doorHeader.position.set(0, 2.93, 2.5);
    doorHeader.castShadow = true;
    doorHeader.receiveShadow = true;
    this.group.add(doorHeader);

    // Prison Title Signboard ("السجن الملكي") above the cell door
    const signTex = this.createPrisonSignTexture();
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xfff1d6),
        emissiveMap: signTex,
        emissiveIntensity: 0.25,
        roughness: 0.72,
      })
    );
    const signBoard = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.96, 0.56)), signMat);
    signBoard.position.set(0, 2.94, 2.76);
    this.group.add(signBoard);

    // 4. Hinged Swinging Iron-Barred Prison Door (pivots cleanly outward at left jamb x = -1.04, z = 2.5)
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-1.04, 0, 2.5);

    const doorW = 2.06;
    const doorH = 2.48;
    const frameThick = 0.1;

    // Iron outer door frame
    const leftStile = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(frameThick, doorH, 0.12)),
      ironMat
    );
    leftStile.position.set(frameThick * 0.5, doorH * 0.5, 0);
    leftStile.castShadow = true;
    this.doorPivot.add(leftStile);

    const rightStile = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(frameThick, doorH, 0.12)),
      ironMat
    );
    rightStile.position.set(doorW - frameThick * 0.5, doorH * 0.5, 0);
    rightStile.castShadow = true;
    this.doorPivot.add(rightStile);

    const railGeo = this.track(new THREE.BoxGeometry(doorW, 0.1, 0.12));
    [0.14, 1.24, doorH - 0.08].forEach((ry) => {
      const rail = new THREE.Mesh(railGeo, ironMat);
      rail.position.set(doorW * 0.5, ry, 0);
      rail.castShadow = true;
      this.doorPivot.add(rail);
    });

    // Vertical Prison Door Bars
    const doorBarGeo = this.track(new THREE.CylinderGeometry(0.034, 0.034, doorH - 0.16, 7));
    const doorBarCount = 7;
    for (let i = 1; i <= doorBarCount; i++) {
      const bx = (i / (doorBarCount + 1)) * doorW;
      const bar = new THREE.Mesh(doorBarGeo, ironMat);
      bar.position.set(bx, doorH * 0.5, 0);
      bar.castShadow = true;
      this.doorPivot.add(bar);
    }

    // Heavy Brass Padlock & Latch Box on right edge of door
    const lockPlate = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, 0.34, 0.16)),
      lockGoldMat
    );
    lockPlate.position.set(doorW - 0.14, 1.24, 0.04);
    this.doorPivot.add(lockPlate);

    this.group.add(this.doorPivot);

    // 5. Roof Slab & Stone Battlements
    const roofSlab = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(6.55, 0.28, 5.55)),
      darkStoneMat
    );
    roofSlab.position.set(0, 3.49, 0);
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    this.group.add(roofSlab);

    const merlonGeo = this.track(new THREE.BoxGeometry(0.55, 0.42, 0.38));
    [-2.7, -1.35, 0, 1.35, 2.7].forEach((mx) => {
      [-2.52, 2.52].forEach((mz) => {
        const m = new THREE.Mesh(merlonGeo, wallStoneMat);
        m.position.set(mx, 3.84, mz);
        m.castShadow = true;
        this.group.add(m);
      });
    });

    // 6. Simple Cell Interior Props (Wooden Bench & Water Barrel in back corners)
    const benchSeat = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.6, 0.1, 0.48)), woodMat);
    benchSeat.position.set(-1.75, 0.44, -1.9);
    benchSeat.castShadow = true;
    this.group.add(benchSeat);

    const legGeo = this.track(new THREE.BoxGeometry(0.12, 0.42, 0.42));
    [-2.35, -1.15].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, 0.21, -1.9);
      this.group.add(leg);
    });

    const barrel = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.28, 0.25, 0.65, 10)),
      woodMat
    );
    barrel.position.set(2.2, 0.36, -1.9);
    barrel.castShadow = true;
    this.group.add(barrel);

    // 7. Flaming Torches Flanking the Front Entrance
    const sconceGeo = this.track(new THREE.CylinderGeometry(0.06, 0.04, 0.42, 6));
    const flameGeo = this.track(new THREE.ConeGeometry(0.11, 0.28, 6));
    [-1.45, 1.45].forEach((tx) => {
      const sconce = new THREE.Mesh(sconceGeo, ironMat);
      sconce.position.set(tx, 2.15, 2.78);
      sconce.rotation.x = 0.28;
      this.group.add(sconce);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(tx, 2.46, 2.86);
      this.group.add(flame);
      this.torchFlames.push(flame);
    });

    // 8. Register Solid Stone Wall Colliders (leaving doorway openable!)
    // Back wall
    this.registerLocalOBB(targetBoxColliders, 0, -2.5, 6.2, 0.56, 3.6);
    // Left & Right walls
    this.registerLocalOBB(targetBoxColliders, -2.9, 0, 0.56, 5.2, 3.6);
    this.registerLocalOBB(targetBoxColliders, 2.9, 0, 0.56, 5.2, 3.6);
    // Front Left & Right piers
    this.registerLocalOBB(targetBoxColliders, -2.08, 2.5, 2.04, 0.56, 3.6);
    this.registerLocalOBB(targetBoxColliders, 2.08, 2.5, 2.04, 0.56, 3.6);
    // Dynamic Door Collider across doorway (enabled when closed, disabled when door opens)
    this.doorCollider = this.registerLocalOBB(targetBoxColliders, 0, 2.5, 2.24, 0.48, 2.6);
  }

  public lockDoorWithHold(holdSeconds: number = 6.0) {
    this.openHoldTimer = 0;
    this.doorTargetOpen = 0;
    this.lockHoldTimer = holdSeconds;
    soundManager.playBoundaryBump();
  }

  public pulseDoorOpen(openSeconds: number = 2.6) {
    this.lockHoldTimer = 0;
    this.openHoldTimer = Math.max(this.openHoldTimer, openSeconds);
    this.doorTargetOpen = 1;
  }

  public setGuardDoorOpen(open: boolean) {
    this.doorTargetOpen = open ? 1 : 0;
    if (!open) {
      this.lockHoldTimer = 5.5;
    }
  }

  public getDoorOpenAmount(): number {
    return this.doorOpenAmount;
  }

  public update(
    delta: number,
    elapsedTime: number,
    sultanPos?: THREE.Vector3,
    guardDoorControl: boolean | null = null
  ) {
    // Flicker entrance torches
    for (let i = 0; i < this.torchFlames.length; i++) {
      const p = 0.88 + Math.sin(elapsedTime * 10 + i * 2.3) * 0.16;
      this.torchFlames[i].scale.set(p, 0.92 + Math.cos(elapsedTime * 12 + i) * 0.18, p);
    }

    if (this.lockHoldTimer > 0) {
      this.lockHoldTimer = Math.max(0, this.lockHoldTimer - delta);
    }
    if (this.openHoldTimer > 0) {
      this.openHoldTimer = Math.max(0, this.openHoldTimer - delta);
    }

    // Determine target door state: guard arrest sequence overrides Sultan proximity
    if (guardDoorControl !== null) {
      this.doorTargetOpen = guardDoorControl ? 1 : 0;
    } else if (this.openHoldTimer > 0) {
      this.doorTargetOpen = 1;
    } else if (sultanPos && this.lockHoldTimer <= 0) {
      const distToDoor = Math.hypot(
        sultanPos.x - this.doorThresholdPos.x,
        sultanPos.z - this.doorThresholdPos.z
      );
      this.doorTargetOpen = distToDoor < 2.65 ? 1 : 0;
    } else if (this.lockHoldTimer > 0) {
      this.doorTargetOpen = 0;
    }

    const isOpenNow = this.doorTargetOpen > 0.5;
    if (isOpenNow !== this.wasDoorOpenFlag) {
      this.wasDoorOpenFlag = isOpenNow;
      if (isOpenNow) {
        soundManager.playJump();
      } else {
        soundManager.playBoundaryBump();
      }
    }

    this.doorOpenAmount = THREE.MathUtils.damp(this.doorOpenAmount, this.doorTargetOpen, 7.5, delta);
    // Swing door smoothly outward (-PI * 0.62)
    this.doorPivot.rotation.y = -this.doorOpenAmount * (Math.PI * 0.62);

    // Toggle doorway collision cleanly so prisoners cannot exit when locked
    if (this.doorOpenAmount > 0.55) {
      this.doorCollider.halfW = 0.01;
      this.doorCollider.halfD = 0.01;
    } else {
      this.doorCollider.halfW = 1.12;
      this.doorCollider.halfD = 0.24;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
