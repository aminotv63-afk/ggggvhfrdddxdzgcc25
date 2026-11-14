import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';

/**
 * Royal Cemetery ("مقبرة المملكة") featuring a stone-walled courtyard,
 * wrought-iron perimeter fence, lantern-lit entrance arch, 7 sealed/closed graves,
 * and 1 open & empty excavated grave with displaced stone lid, dug earth mound, and shovel.
 */
export class RoyalCemetery {
  public group: THREE.Group;
  public readonly origin = new THREE.Vector3(-25.0, 0, 56.0);
  public readonly rotY: number = Math.PI; // Faces North (-Z world) toward the village

  private disposables: { dispose: () => void }[] = [];
  private lanternGlowMat!: THREE.MeshStandardMaterial;
  private displacedLidMesh: THREE.Mesh | null = null;
  private shovelGroup: THREE.Group | null = null;
  private dirtFillMesh: THREE.Mesh | null = null;
  private dirtMoundMesh: THREE.Mesh | null = null;
  private readonly openPitLocal = new THREE.Vector3(1.45, 0, 1.7);

  private readonly cosR: number;
  private readonly sinR: number;

  constructor(
    targetBoxColliders: OBBCollider[],
    targetFootprints?: { x: number; z: number; r: number }[]
  ) {
    this.cosR = Math.cos(this.rotY);
    this.sinR = Math.sin(this.rotY);

    this.group = new THREE.Group();
    this.group.name = 'RoyalCemetery';
    this.group.position.copy(this.origin);
    this.group.rotation.y = this.rotY;

    this.buildCemetery(targetBoxColliders);

    this.group.updateMatrixWorld(true);
    const dynamicSet = new Set<THREE.Object3D>();
    if (this.displacedLidMesh) dynamicSet.add(this.displacedLidMesh);
    if (this.shovelGroup) dynamicSet.add(this.shovelGroup);
    if (this.dirtFillMesh) dynamicSet.add(this.dirtFillMesh);
    if (this.dirtMoundMesh) dynamicSet.add(this.dirtMoundMesh);

    this.group.traverse((obj) => {
      if (dynamicSet.has(obj)) return;
      let p = obj.parent;
      while (p && p !== this.group) {
        if (dynamicSet.has(p)) return;
        p = p.parent;
      }
      if ((obj as THREE.Mesh).isMesh) {
        obj.matrixAutoUpdate = false;
      }
    });

    if (targetFootprints) {
      targetFootprints.push({ x: this.origin.x, z: this.origin.z, r: 9.2 });
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

  private createSignTexture(
    title: string,
    subtitle: string | null,
    width: number = 768,
    height: number = 240
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    if (subtitle) {
      ctx.fillStyle = '#f5e6c8';
      ctx.font = '800 72px "Marhey", "Tajawal", sans-serif';
      ctx.fillText(title, width / 2, height * 0.38);

      ctx.fillStyle = '#d6d3d1';
      ctx.font = '700 44px "Tajawal", sans-serif';
      ctx.fillText(subtitle, width / 2, height * 0.74);
    } else {
      ctx.fillStyle = '#f5e6c8';
      ctx.font = '800 84px "Marhey", "Tajawal", sans-serif';
      ctx.fillText(title, width / 2, height / 2 + 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildCemetery(targetBoxColliders: OBBCollider[]) {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    const stoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xa8a29e,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    const darkStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x625e59,
        roughness: 0.93,
        metalness: 0.06,
      })
    );
    const slabMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xbab4ac,
        roughness: 0.86,
        metalness: 0.06,
      })
    );
    const turfMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x3b5836,
        roughness: 0.96,
        metalness: 0.02,
      })
    );
    const pathStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x8f8980,
        roughness: 0.9,
        metalness: 0.04,
      })
    );
    const dirtMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x453120,
        roughness: 0.98,
        metalness: 0.01,
      })
    );
    const deepPitMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1e150e,
        roughness: 1.0,
        metalness: 0.0,
      })
    );
    const woodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x6d4b2d,
        roughness: 0.86,
        metalness: 0.03,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x242830,
        roughness: 0.44,
        metalness: 0.82,
      })
    );
    this.lanternGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfff0b3,
        emissive: 0xffad33,
        emissiveIntensity: 0.95,
        roughness: 0.2,
      })
    );

    const terraceH = 0.48;
    const courtW = 13.0;
    const courtD = 10.6;

    // Open grave pit cavity bounds in local space (front-center right slot)
    const pitCx = 1.45;
    const pitCz = 1.7;
    const pitW = 1.24;
    const pitD = 2.24;
    const pitMinX = pitCx - pitW * 0.5; // +0.83
    const pitMaxX = pitCx + pitW * 0.5; // +2.07
    const pitMinZ = pitCz - pitD * 0.5; // +0.58
    const pitMaxZ = pitCz + pitD * 0.5; // +2.82

    // 1. Stone Terrace Perimeter Base Skirt & 4 Walkable Terrace Slabs leaving the Open Grave Pit hollow!
    const buildTerraceSlab = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;

      const baseBlock = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, terraceH - 0.04, d)),
        darkStoneMat
      );
      baseBlock.position.set(cx, (terraceH - 0.04) * 0.5, cz);
      baseBlock.receiveShadow = true;
      baseBlock.castShadow = true;
      this.group.add(baseBlock);

      const turfTop = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, 0.04, d)),
        turfMat
      );
      turfTop.position.set(cx, terraceH - 0.02, cz);
      turfTop.receiveShadow = true;
      this.group.add(turfTop);

      this.registerLocalOBB(targetBoxColliders, cx, cz, w, d, terraceH, true);
    };

    // Left, Right, Back-strip, Front-strip slabs around open grave pit
    buildTerraceSlab(-courtW * 0.5, pitMinX, -courtD * 0.5, courtD * 0.5);
    buildTerraceSlab(pitMaxX, courtW * 0.5, -courtD * 0.5, courtD * 0.5);
    buildTerraceSlab(pitMinX, pitMaxX, -courtD * 0.5, pitMinZ);
    buildTerraceSlab(pitMinX, pitMaxX, pitMaxZ, courtD * 0.5);

    // 2. Entrance Stone Steps & Flagstone Approach Path (lx in [-1.7..+1.7], lz > +5.3)
    const step1 = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.5, 0.16, 0.64)),
      stoneMat
    );
    step1.position.set(0, 0.08, 6.24);
    step1.receiveShadow = true;
    step1.castShadow = true;
    this.group.add(step1);
    this.registerLocalOBB(targetBoxColliders, 0, 6.24, 3.5, 0.64, 0.16, true);

    const step2 = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.4, 0.32, 0.64)),
      stoneMat
    );
    step2.position.set(0, 0.16, 5.6);
    step2.receiveShadow = true;
    step2.castShadow = true;
    this.group.add(step2);
    this.registerLocalOBB(targetBoxColliders, 0, 5.6, 3.4, 0.64, 0.32, true);

    // Flat paved forecourt path outside gate
    const approachPath = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(3.8, 3.6)),
      pathStoneMat
    );
    approachPath.rotation.x = -Math.PI / 2;
    approachPath.position.set(0, 0.015, 8.2);
    approachPath.receiveShadow = true;
    this.group.add(approachPath);

    // Interior stone central & cross walkways flush with terrace top (y = terraceH + 0.01)
    const centralWalk = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1.36, 9.6)),
      pathStoneMat
    );
    centralWalk.rotation.x = -Math.PI / 2;
    centralWalk.position.set(0, terraceH + 0.012, 0.25);
    centralWalk.receiveShadow = true;
    this.group.add(centralWalk);

    const crossWalk = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(11.4, 1.05)),
      pathStoneMat
    );
    crossWalk.rotation.x = -Math.PI / 2;
    crossWalk.position.set(0, terraceH + 0.012, -0.25);
    crossWalk.receiveShadow = true;
    this.group.add(crossWalk);

    // 3. Stone Perimeter Walls + Wrought-Iron Spiked Fence (Instanced) + Gate Pillars
    const wallTopY = 1.42;
    const barGeo = this.track(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 6));
    const tipGeo = this.track(new THREE.ConeGeometry(0.036, 0.1, 4));
    const fenceBarTransforms: { x: number; y: number; z: number }[] = [];

    const addStoneFenceSegment = (
      cx: number,
      cz: number,
      len: number,
      rotY: number
    ) => {
      const seg = new THREE.Group();
      seg.position.set(cx, 0, cz);
      seg.rotation.y = rotY;

      const lowWall = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(len, 0.96, 0.34)),
        darkStoneMat
      );
      lowWall.position.y = 0.48;
      lowWall.castShadow = true;
      lowWall.receiveShadow = true;
      seg.add(lowWall);

      const coping = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(len + 0.08, 0.1, 0.42)),
        stoneMat
      );
      coping.position.y = 0.98;
      coping.castShadow = true;
      seg.add(coping);

      // Wrought-iron top rail
      const topRail = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(len - 0.12, 0.05, 0.05)),
        ironMat
      );
      topRail.position.y = 1.48;
      seg.add(topRail);

      const barCount = Math.max(4, Math.floor(len / 0.48));
      const cosSeg = Math.cos(rotY);
      const sinSeg = Math.sin(rotY);
      for (let i = 0; i < barCount; i++) {
        const bx = -len * 0.46 + (i / Math.max(1, barCount - 1)) * (len * 0.92);
        fenceBarTransforms.push({
          x: cx + bx * cosSeg,
          y: 1.28,
          z: cz - bx * sinSeg,
        });
      }

      this.group.add(seg);

      // Register world OBB collider
      const w = Math.abs(Math.cos(rotY)) > 0.5 ? len : 0.42;
      const d = Math.abs(Math.cos(rotY)) > 0.5 ? 0.42 : len;
      this.registerLocalOBB(targetBoxColliders, cx, cz, w, d, wallTopY, false);
    };

    // Back, Left, Right, Front-Left & Front-Right wall segments
    addStoneFenceSegment(0, -5.3, 13.3, 0);
    addStoneFenceSegment(-6.5, 0, 10.6, Math.PI / 2);
    addStoneFenceSegment(6.5, 0, 10.6, Math.PI / 2);
    addStoneFenceSegment(-4.15, 5.3, 4.7, 0);
    addStoneFenceSegment(4.15, 5.3, 4.7, 0);

    // Build all wrought-iron bars and spear tips in 2 instanced draw calls
    if (fenceBarTransforms.length > 0) {
      const barsInst = new THREE.InstancedMesh(barGeo, ironMat, fenceBarTransforms.length);
      const tipsInst = new THREE.InstancedMesh(tipGeo, ironMat, fenceBarTransforms.length);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < fenceBarTransforms.length; i++) {
        const t = fenceBarTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        barsInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, t.y + 0.3, t.z);
        dummy.updateMatrix();
        tipsInst.setMatrixAt(i, dummy.matrix);
      }
      barsInst.instanceMatrix.needsUpdate = true;
      tipsInst.instanceMatrix.needsUpdate = true;
      barsInst.computeBoundingSphere();
      tipsInst.computeBoundingSphere();
      this.group.add(barsInst, tipsInst);
    }

    // Entrance Gate Pillars, Iron Archway & "مقبرة المملكة" Signboard + Glowing Lanterns
    const pillarGeo = this.track(new THREE.BoxGeometry(0.62, 2.75, 0.62));
    const capGeo = this.track(new THREE.BoxGeometry(0.76, 0.18, 0.76));
    const lanternGlassGeo = this.track(new THREE.BoxGeometry(0.22, 0.28, 0.22));
    const lanternCapGeo = this.track(new THREE.ConeGeometry(0.2, 0.16, 4));

    [-1.78, 1.78].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(px, 1.375, 5.3);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);

      const cap = new THREE.Mesh(capGeo, darkStoneMat);
      cap.position.set(px, 2.82, 5.3);
      this.group.add(cap);

      const lantern = new THREE.Mesh(lanternGlassGeo, this.lanternGlowMat);
      lantern.position.set(px, 3.06, 5.3);
      this.group.add(lantern);

      const lCap = new THREE.Mesh(lanternCapGeo, ironMat);
      lCap.position.set(px, 3.28, 5.3);
      lCap.rotation.y = Math.PI / 4;
      this.group.add(lCap);

      this.registerLocalOBB(targetBoxColliders, px, 5.3, 0.68, 0.68, 2.9, false);
    });

    // Overhead Arch Beam & Signboard above Entrance Gate
    const lintelBeam = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.1, 0.28, 0.38)),
      ironMat
    );
    lintelBeam.position.set(0, 2.72, 5.3);
    lintelBeam.castShadow = true;
    this.group.add(lintelBeam);

    const signTex = this.createSignTexture('مقبرة المملكة', null, 768, 200);
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xfff1d6),
        emissiveMap: signTex,
        emissiveIntensity: 0.24,
        roughness: 0.74,
      })
    );
    const gateSign = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.4, 0.64)), signMat);
    gateSign.position.set(0, 2.76, 5.51);
    this.group.add(gateSign);

    const gateSignBack = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.4, 0.64)), signMat);
    gateSignBack.position.set(0, 2.76, 5.09);
    gateSignBack.rotation.y = Math.PI;
    this.group.add(gateSignBack);

    // 4. Build the 7 Closed/Sealed Graves ("الباقي مغلقين")
    const closedGraveCoords: [number, number][] = [
      [-4.4, 1.7],
      [-1.55, 1.7],
      [4.4, 1.7],
      [-4.4, -2.2],
      [-1.55, -2.2],
      [1.45, -2.2],
      [4.4, -2.2],
    ];

    const curbWGeo = this.track(new THREE.BoxGeometry(1.48, 0.2, 2.46));
    const lidGeo = this.track(new THREE.BoxGeometry(1.26, 0.14, 2.24));
    const ridgeGeo = this.track(new THREE.BoxGeometry(0.62, 0.1, 1.76));
    const headstoneBaseGeo = this.track(new THREE.BoxGeometry(0.96, 0.18, 0.34));
    const headstoneGeo = this.track(new THREE.BoxGeometry(0.76, 0.92, 0.18));
    const headArchGeo = this.track(new THREE.CylinderGeometry(0.38, 0.38, 0.18, 12));
    headArchGeo.rotateX(Math.PI / 2);

    closedGraveCoords.forEach(([gx, gz], idx) => {
      const grave = new THREE.Group();
      grave.position.set(gx, terraceH, gz);

      // Outer stone border frame
      const curb = new THREE.Mesh(curbWGeo, darkStoneMat);
      curb.position.y = 0.1;
      curb.castShadow = true;
      curb.receiveShadow = true;
      grave.add(curb);

      // Heavy sealed stone lid completely closing the grave
      const lid = new THREE.Mesh(lidGeo, slabMat);
      lid.position.y = 0.23;
      lid.castShadow = true;
      lid.receiveShadow = true;
      grave.add(lid);

      // Top carved ridge on sealed stone slab
      const ridge = new THREE.Mesh(ridgeGeo, idx % 2 === 0 ? stoneMat : darkStoneMat);
      ridge.position.y = 0.33;
      ridge.castShadow = true;
      grave.add(ridge);

      // Upright carved headstone at the head end (-Z local of grave)
      const hBase = new THREE.Mesh(headstoneBaseGeo, darkStoneMat);
      hBase.position.set(0, 0.09, -1.36);
      hBase.castShadow = true;
      grave.add(hBase);

      const hBody = new THREE.Mesh(headstoneGeo, stoneMat);
      hBody.position.set(0, 0.62, -1.36);
      hBody.castShadow = true;
      hBody.receiveShadow = true;
      grave.add(hBody);

      const hArch = new THREE.Mesh(headArchGeo, stoneMat);
      hArch.position.set(0, 1.08, -1.36);
      hArch.castShadow = true;
      grave.add(hArch);

      this.group.add(grave);

      // Low walkable grave slab collider & solid upright headstone collider
      this.registerLocalOBB(targetBoxColliders, gx, gz, 1.48, 2.46, terraceH + 0.3, true);
      this.registerLocalOBB(targetBoxColliders, gx, gz - 1.36, 0.96, 0.36, terraceH + 1.45, false);
    });

    // 5. Build the 1 Open & Empty Grave ("قبر مفتوح و فارغ") at (pitCx = 1.45, pitCz = 1.70)
    const openGrave = new THREE.Group();
    openGrave.position.set(pitCx, 0, pitCz);

    // Deep dark soil pit bottom at y = 0.02 (completely hollow & empty!)
    const pitFloor = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(pitW, pitD)),
      deepPitMat
    );
    pitFloor.rotation.x = -Math.PI / 2;
    pitFloor.position.y = 0.02;
    pitFloor.receiveShadow = true;
    openGrave.add(pitFloor);

    // Inner excavated earth pit walls + timber shoring planks lining all 4 inner edges
    const wallNS = this.track(new THREE.BoxGeometry(pitW, terraceH, 0.06));
    const wallEW = this.track(new THREE.BoxGeometry(0.06, terraceH, pitD));

    [-pitD * 0.5 + 0.03, pitD * 0.5 - 0.03].forEach((wz) => {
      const w = new THREE.Mesh(wallNS, dirtMat);
      w.position.set(0, terraceH * 0.5, wz);
      w.receiveShadow = true;
      openGrave.add(w);
    });
    [-pitW * 0.5 + 0.03, pitW * 0.5 - 0.03].forEach((wx) => {
      const w = new THREE.Mesh(wallEW, dirtMat);
      w.position.set(wx, terraceH * 0.5, 0);
      w.receiveShadow = true;
      openGrave.add(w);
    });

    // Timber shoring beams near top rim of open empty pit
    const rimPlankNS = this.track(new THREE.BoxGeometry(pitW + 0.04, 0.11, 0.08));
    const rimPlankEW = this.track(new THREE.BoxGeometry(0.08, 0.11, pitD + 0.04));
    [-pitD * 0.5, pitD * 0.5].forEach((rz) => {
      const p = new THREE.Mesh(rimPlankNS, woodMat);
      p.position.set(0, terraceH - 0.04, rz);
      openGrave.add(p);
    });
    [-pitW * 0.5, pitW * 0.5].forEach((rx) => {
      const p = new THREE.Mesh(rimPlankEW, woodMat);
      p.position.set(rx, terraceH - 0.04, 0);
      openGrave.add(p);
    });

    // Outer stone grave rim frame around the open pit (leaving top completely open!)
    const rimSideGeo = this.track(new THREE.BoxGeometry(0.16, 0.14, pitD + 0.32));
    const rimEndGeo = this.track(new THREE.BoxGeometry(pitW + 0.32, 0.14, 0.16));
    [-pitW * 0.5 - 0.08, pitW * 0.5 + 0.08].forEach((rx) => {
      const r = new THREE.Mesh(rimSideGeo, darkStoneMat);
      r.position.set(rx, terraceH + 0.07, 0);
      r.castShadow = true;
      r.receiveShadow = true;
      openGrave.add(r);
    });
    [-pitD * 0.5 - 0.08, pitD * 0.5 + 0.08].forEach((rz) => {
      const r = new THREE.Mesh(rimEndGeo, darkStoneMat);
      r.position.set(0, terraceH + 0.07, rz);
      r.castShadow = true;
      r.receiveShadow = true;
      openGrave.add(r);
    });

    // Upright carved headstone at the head end of the open grave
    const ohBase = new THREE.Mesh(headstoneBaseGeo, darkStoneMat);
    ohBase.position.set(0, terraceH + 0.09, -1.36);
    ohBase.castShadow = true;
    openGrave.add(ohBase);

    const ohBody = new THREE.Mesh(headstoneGeo, stoneMat);
    ohBody.position.set(0, terraceH + 0.62, -1.36);
    ohBody.castShadow = true;
    openGrave.add(ohBody);

    const ohArch = new THREE.Mesh(headArchGeo, stoneMat);
    ohArch.position.set(0, terraceH + 1.08, -1.36);
    ohArch.castShadow = true;
    openGrave.add(ohArch);

    // Dynamic dirt fill layer inside the open pit (rises during burial animation)
    const dirtFill = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(pitW - 0.08, terraceH, pitD - 0.08)),
      dirtMat
    );
    dirtFill.position.set(0, -terraceH * 0.5, 0);
    dirtFill.scale.y = 0.01;
    dirtFill.visible = false;
    openGrave.add(dirtFill);
    this.dirtFillMesh = dirtFill;

    // Heavy stone lid slab slid off to the right side of the open pit
    const displacedLid = new THREE.Mesh(lidGeo, slabMat);
    displacedLid.position.set(1.38, terraceH + 0.09, 0.06);
    displacedLid.rotation.set(0.02, 0.18, -0.05);
    displacedLid.castShadow = true;
    displacedLid.receiveShadow = true;
    openGrave.add(displacedLid);
    this.displacedLidMesh = displacedLid;

    // Freshly excavated dirt mound piled to the left side of the open grave
    const moundGeo = this.track(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52));
    const dirtMound = new THREE.Mesh(moundGeo, dirtMat);
    dirtMound.position.set(-1.18, terraceH - 0.02, 0.45);
    dirtMound.scale.set(0.88, 0.68, 1.35);
    dirtMound.castShadow = true;
    dirtMound.receiveShadow = true;
    openGrave.add(dirtMound);
    this.dirtMoundMesh = dirtMound;

    // Grave-digger's wooden & iron shovel planted into the dug earth mound
    const shovelGroup = new THREE.Group();
    shovelGroup.position.set(-1.12, terraceH + 0.24, 0.45);
    shovelGroup.rotation.set(-0.26, 0.4, 0.22);

    const blade = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, 0.3, 0.03)),
      ironMat
    );
    blade.position.y = 0.05;
    shovelGroup.add(blade);

    const shaft = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.024, 0.024, 1.15, 7)),
      woodMat
    );
    shaft.position.y = 0.72;
    shaft.castShadow = true;
    shovelGroup.add(shaft);

    const handle = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 7)),
      woodMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.y = 1.3;
    shovelGroup.add(handle);

    openGrave.add(shovelGroup);
    this.shovelGroup = shovelGroup;

    // Small wooden plaque near headstone indicating "قبر مفتوح وفارغ"
    const openSignPost = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.08, 0.78, 0.08)),
      woodMat
    );
    openSignPost.position.set(-0.88, terraceH + 0.39, -1.25);
    openGrave.add(openSignPost);

    const openSignTex = this.createSignTexture('قبر مفتوح', 'فارغ', 512, 224);
    const openSignMat = this.track(
      new THREE.MeshStandardMaterial({
        map: openSignTex,
        emissive: new THREE.Color(0xfff1d6),
        emissiveMap: openSignTex,
        emissiveIntensity: 0.22,
        roughness: 0.78,
      })
    );
    const openSignBoard = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.86, 0.42, 0.05)),
      woodMat
    );
    openSignBoard.position.set(-0.88, terraceH + 0.86, -1.25);
    openGrave.add(openSignBoard);

    const openSignFace = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.8, 0.36)),
      openSignMat
    );
    openSignFace.position.set(-0.88, terraceH + 0.86, -1.22);
    openGrave.add(openSignFace);

    this.group.add(openGrave);

    // Headstone solid collider for the open grave
    this.registerLocalOBB(
      targetBoxColliders,
      pitCx,
      pitCz - 1.36,
      0.96,
      0.36,
      terraceH + 1.45,
      false
    );
  }

  public getPitWorldCenter(out: THREE.Vector3): THREE.Vector3 {
    out.set(
      this.origin.x + this.openPitLocal.x * this.cosR + this.openPitLocal.z * this.sinR,
      0.04,
      this.origin.z - this.openPitLocal.x * this.sinR + this.openPitLocal.z * this.cosR
    );
    return out;
  }

  public getBurialApproachPos(out: THREE.Vector3): THREE.Vector3 {
    const lx = this.openPitLocal.x - 1.15;
    const lz = this.openPitLocal.z + 1.5;
    out.set(
      this.origin.x + lx * this.cosR + lz * this.sinR,
      0.24,
      this.origin.z - lx * this.sinR + lz * this.cosR
    );
    return out;
  }

  public setOpenGraveBurialState(fill01: number, lidClose01: number, shovelSwing: number) {
    const terraceH = 0.24;
    const f = Math.max(0, Math.min(1, fill01));
    const l = Math.max(0, Math.min(1, lidClose01));

    if (this.dirtFillMesh) {
      this.dirtFillMesh.visible = f > 0.01;
      const h = Math.max(0.01, f * terraceH);
      this.dirtFillMesh.scale.y = Math.max(0.01, f);
      this.dirtFillMesh.position.y = h * 0.5;
    }
    if (this.dirtMoundMesh) {
      const mScale = 1 - f * 0.65;
      this.dirtMoundMesh.scale.set(0.88 * mScale, 0.68 * mScale, 1.35 * mScale);
    }
    if (this.displacedLidMesh) {
      this.displacedLidMesh.position.set(
        THREE.MathUtils.lerp(1.38, 0, l),
        THREE.MathUtils.lerp(terraceH + 0.09, terraceH + 0.23, l),
        THREE.MathUtils.lerp(0.06, 0, l)
      );
      this.displacedLidMesh.rotation.set(
        THREE.MathUtils.lerp(0.02, 0, l),
        THREE.MathUtils.lerp(0.18, 0, l),
        THREE.MathUtils.lerp(-0.05, 0, l)
      );
    }
    if (this.shovelGroup) {
      this.shovelGroup.rotation.set(-0.26 + shovelSwing * 0.42, 0.4, 0.22 - shovelSwing * 0.35);
      this.shovelGroup.position.set(
        -1.12 + Math.max(0, shovelSwing) * 0.52,
        terraceH + 0.24 + Math.max(0, shovelSwing) * 0.22,
        0.45 - Math.max(0, shovelSwing) * 0.22
      );
    }
  }

  public resetOpenGrave() {
    this.setOpenGraveBurialState(0, 0, 0);
  }

  public setNightAmount(nightAmount: number) {
    const n = Math.max(0, Math.min(1, nightAmount));
    if (this.lanternGlowMat) {
      this.lanternGlowMat.emissiveIntensity = 0.85 + n * 2.2;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
