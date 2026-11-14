import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';
import { getCoastlineX } from './sea';

/**
 * Perimeter Border Fence ("سياج الحدود") circling the fog boundary
 * with a locked Roman Kingdom Border Gate ("بوابة الحدود الرومانية")
 * guarded by two Roman King's guards.
 */
export class RomanBorderFence {
  public group: THREE.Group;
  public boxColliders: OBBCollider[] = [];
  public readonly fenceRadius: number;
  public readonly gateAngle: number;
  public readonly gatePos: THREE.Vector3;
  public readonly guardNorthPos: THREE.Vector3;
  public readonly guardSouthPos: THREE.Vector3;

  private disposables: { dispose: () => void }[] = [];
  private bannerCloths: THREE.Mesh[] = [];
  private torchFlames: THREE.Mesh[] = [];
  private elapsed = 0;

  constructor(mapRadius: number = 90, targetBoxColliders?: OBBCollider[]) {
    this.group = new THREE.Group();
    this.group.name = 'RomanBorderFenceAndGate';

    this.fenceRadius = mapRadius - 2.4; // 87.6m — sits cleanly just inside the fog wall
    // Align border gate directly with the East-West Cobblestone Avenue (z = 3.5)
    this.gateAngle = Math.atan2(3.5, this.fenceRadius);

    const gateX = Math.cos(this.gateAngle) * this.fenceRadius;
    const gateZ = Math.sin(this.gateAngle) * this.fenceRadius;
    this.gatePos = new THREE.Vector3(gateX, 0, gateZ);

    // Position 2 guards just inside the closed gate, flanking the entrance
    const inwardX = -Math.cos(this.gateAngle);
    const inwardZ = -Math.sin(this.gateAngle);
    const tangentX = -Math.sin(this.gateAngle);
    const tangentZ = Math.cos(this.gateAngle);

    this.guardNorthPos = new THREE.Vector3(
      gateX + inwardX * 2.55 - tangentX * 2.05,
      0,
      gateZ + inwardZ * 2.55 - tangentZ * 2.05
    );
    this.guardSouthPos = new THREE.Vector3(
      gateX + inwardX * 2.55 + tangentX * 2.05,
      0,
      gateZ + inwardZ * 2.55 + tangentZ * 2.05
    );

    this.buildPerimeterFence();
    this.buildRomanBorderGate();

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

  private addOBB(
    cx: number,
    cz: number,
    width: number,
    depth: number,
    rotY: number,
    topY: number
  ) {
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

  private buildPerimeterFence() {
    const woodTex = this.track(createWoodPlankTexture());
    const darkWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x5c3c22,
        roughness: 0.88,
        metalness: 0.04,
      })
    );
    const railWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x875c36,
        roughness: 0.85,
        metalness: 0.03,
      })
    );
    const stoneBaseMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x6f6b64,
        roughness: 0.92,
        metalness: 0.05,
      })
    );
    const ironCapMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x2c3038,
        roughness: 0.5,
        metalness: 0.72,
      })
    );

    const circumference = Math.PI * 2 * this.fenceRadius;
    const targetSpacing = 2.8;
    const totalSlots = Math.round(circumference / targetSpacing);
    const stepAngle = (Math.PI * 2) / totalSlots;

    // Leave clean opening around the gate for the twin watchtower pillars & gate leaves
    const gateClearHalfAngle = 3.25 / this.fenceRadius;

    const postAngles: number[] = [];
    const railSpans: { a1: number; a2: number }[] = [];

    const isInsideGate = (ang: number) => {
      let diff = ang - this.gateAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) < gateClearHalfAngle;
    };

    // Do not place wooden fence posts/rails out inside the Western Sea
    const isOverSea = (ang: number) => {
      const px = Math.cos(ang) * this.fenceRadius;
      const pz = Math.sin(ang) * this.fenceRadius;
      return px < getCoastlineX(pz) + 0.5;
    };

    const shoreBastions: { x: number; z: number }[] = [];

    for (let i = 0; i < totalSlots; i++) {
      const a1 = i * stepAngle;
      const a2 = ((i + 1) % totalSlots) * stepAngle;
      const a1Sea = isOverSea(a1);
      const a2Sea = isOverSea(a2);

      if (!isInsideGate(a1) && !a1Sea) {
        postAngles.push(a1);
        if (!isInsideGate(a2) && !a2Sea) {
          railSpans.push({ a1, a2 });
        }
      }

      if (a1Sea !== a2Sea) {
        const landAng = a1Sea ? a2 : a1;
        shoreBastions.push({
          x: Math.cos(landAng) * this.fenceRadius,
          z: Math.sin(landAng) * this.fenceRadius,
        });
      }
    }

    // Coastal Stone End-Bastions anchoring the border fence neatly at the sea shore
    if (shoreBastions.length > 0) {
      const bastionGeo = this.track(new THREE.BoxGeometry(1.15, 2.35, 1.15));
      const bastionCapGeo = this.track(new THREE.BoxGeometry(1.35, 0.28, 1.35));
      shoreBastions.forEach((b) => {
        const pillar = new THREE.Mesh(bastionGeo, stoneBaseMat);
        pillar.position.set(b.x, 1.175, b.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.group.add(pillar);

        const cap = new THREE.Mesh(bastionCapGeo, ironCapMat);
        cap.position.set(b.x, 2.48, b.z);
        cap.castShadow = true;
        this.group.add(cap);

        this.addOBB(b.x, b.z, 1.3, 1.3, 0, 2.6);
      });
    }

    const dummy = new THREE.Object3D();

    // 1. Fence Posts (InstancedMesh)
    if (postAngles.length > 0) {
      const postGeo = this.track(new THREE.BoxGeometry(0.22, 1.78, 0.22));
      const postMesh = new THREE.InstancedMesh(postGeo, darkWoodMat, postAngles.length);
      postMesh.castShadow = true;
      postMesh.receiveShadow = true;

      const capGeo = this.track(new THREE.ConeGeometry(0.16, 0.28, 4));
      capGeo.rotateY(Math.PI / 4);
      const capMesh = new THREE.InstancedMesh(capGeo, ironCapMat, postAngles.length);
      capMesh.castShadow = true;

      const collarGeo = this.track(new THREE.BoxGeometry(0.36, 0.24, 0.36));
      const collarMesh = new THREE.InstancedMesh(collarGeo, stoneBaseMat, postAngles.length);
      collarMesh.receiveShadow = true;

      postAngles.forEach((ang, idx) => {
        const px = Math.cos(ang) * this.fenceRadius;
        const pz = Math.sin(ang) * this.fenceRadius;
        const rotY = -ang + Math.PI / 2;

        dummy.position.set(px, 0.89, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        postMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(px, 1.91, pz);
        dummy.updateMatrix();
        capMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(px, 0.12, pz);
        dummy.updateMatrix();
        collarMesh.setMatrixAt(idx, dummy.matrix);
      });

      postMesh.instanceMatrix.needsUpdate = true;
      capMesh.instanceMatrix.needsUpdate = true;
      collarMesh.instanceMatrix.needsUpdate = true;
      this.group.add(postMesh, capMesh, collarMesh);
    }

    // 2. Double Horizontal Fence Rails + Angled Border Palisade Stakes (InstancedMesh)
    if (railSpans.length > 0) {
      const railGeo = this.track(new THREE.BoxGeometry(1.0, 0.13, 0.09));
      const railMesh = new THREE.InstancedMesh(railGeo, railWoodMat, railSpans.length * 2);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;

      const stakeGeo = this.track(new THREE.CylinderGeometry(0.035, 0.055, 1.05, 5));
      const stakeMesh = new THREE.InstancedMesh(stakeGeo, railWoodMat, railSpans.length * 2);
      stakeMesh.castShadow = true;

      let rIdx = 0;
      let sIdx = 0;
      const heights = [0.58, 1.24];

      railSpans.forEach((span) => {
        const x1 = Math.cos(span.a1) * this.fenceRadius;
        const z1 = Math.sin(span.a1) * this.fenceRadius;
        const x2 = Math.cos(span.a2) * this.fenceRadius;
        const z2 = Math.sin(span.a2) * this.fenceRadius;

        const mx = (x1 + x2) * 0.5;
        const mz = (z1 + z2) * 0.5;
        const dx = x2 - x1;
        const dz = z2 - z1;
        const chordLen = Math.hypot(dx, dz) + 0.08;
        const yaw = Math.atan2(-dz, dx);

        heights.forEach((ry) => {
          dummy.position.set(mx, ry, mz);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(chordLen, 1, 1);
          dummy.updateMatrix();
          railMesh.setMatrixAt(rIdx++, dummy.matrix);
        });

        // Two angled warning palisade stakes per span
        [-0.26, 0.26].forEach((offsetFrac) => {
          const sx = mx + dx * offsetFrac;
          const sz = mz + dz * offsetFrac;
          const radialOutAngle = Math.atan2(sz, sx);
          dummy.position.set(sx, 0.92, sz);
          dummy.rotation.set(0, -radialOutAngle, 0);
          dummy.rotateZ(0.45);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          stakeMesh.setMatrixAt(sIdx++, dummy.matrix);
        });
      });

      railMesh.instanceMatrix.needsUpdate = true;
      stakeMesh.instanceMatrix.needsUpdate = true;
      this.group.add(railMesh, stakeMesh);
    }
  }

  private createBorderPlaqueTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    // Deep imperial parchment / crimson trim plaque
    ctx.fillStyle = '#291513';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#d4a644';
    ctx.lineWidth = 16;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 6;
    ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde68a';
    ctx.font = '800 72px "Marhey", "Tajawal", sans-serif';
    ctx.fillText('حدود الملك الروماني', canvas.width / 2, 130);

    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 48px "Tajawal", sans-serif';
    ctx.fillText('ممنوع الخروج أو تجاوز البوابة', canvas.width / 2, 245);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildRomanBorderGate() {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    const stoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xc8c0b4,
        roughness: 0.88,
        metalness: 0.05,
      })
    );
    const darkStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x69645e,
        roughness: 0.92,
        metalness: 0.06,
      })
    );
    const gateOakMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x4f3018,
        roughness: 0.84,
        metalness: 0.05,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x262930,
        roughness: 0.45,
        metalness: 0.78,
      })
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2b13b,
        roughness: 0.28,
        metalness: 0.85,
      })
    );
    const romanCrimsonMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.78,
        metalness: 0.06,
        side: THREE.DoubleSide,
      })
    );
    const flameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff6b1a,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );

    // Gate group oriented so local -Z faces inward toward the kingdom (West)
    // Wait: at gateAngle ≈ 0 (+X), outward radial direction is (+cos(a), +sin(a)) -> +X.
    // If local +Z points outward along radial vector, then local -Z points inward toward the Sultan!
    const gateGroup = new THREE.Group();
    gateGroup.position.copy(this.gatePos);
    const gateRotY = -this.gateAngle + Math.PI / 2;
    gateGroup.rotation.y = gateRotY;

    // 1. Stone Threshold Paving under the gate
    const thresholdGeo = this.track(new THREE.BoxGeometry(9.2, 0.08, 3.2));
    const threshold = new THREE.Mesh(thresholdGeo, darkStoneMat);
    threshold.position.set(0, 0.04, 0);
    threshold.receiveShadow = true;
    gateGroup.add(threshold);

    // 2. Twin Stone Watchtower Gate Pillars (x = +-3.35)
    const pillarGeo = this.track(new THREE.BoxGeometry(1.75, 4.4, 1.75));
    const basePlinthGeo = this.track(new THREE.BoxGeometry(2.15, 0.45, 2.15));
    const capSlabGeo = this.track(new THREE.BoxGeometry(2.05, 0.28, 2.05));
    const merlonGeo = this.track(new THREE.BoxGeometry(0.45, 0.42, 0.45));
    const brazierBowlGeo = this.track(new THREE.CylinderGeometry(0.26, 0.14, 0.25, 8));
    const flameGeo = this.track(new THREE.ConeGeometry(0.16, 0.42, 7));

    [-3.35, 3.35].forEach((px, pIdx) => {
      const base = new THREE.Mesh(basePlinthGeo, darkStoneMat);
      base.position.set(px, 0.225, 0);
      base.castShadow = true;
      base.receiveShadow = true;
      gateGroup.add(base);

      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(px, 2.4, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      gateGroup.add(pillar);

      const cap = new THREE.Mesh(capSlabGeo, darkStoneMat);
      cap.position.set(px, 4.72, 0);
      cap.castShadow = true;
      gateGroup.add(cap);

      // Corner crenellations
      [-0.72, 0.72].forEach((mx) => {
        [-0.72, 0.72].forEach((mz) => {
          const merlon = new THREE.Mesh(merlonGeo, stoneMat);
          merlon.position.set(px + mx, 5.05, mz);
          merlon.castShadow = true;
          gateGroup.add(merlon);
        });
      });

      // Roman Crimson & Gold Border Banner on the front (kingdom-facing -Z) side of each pillar
      const poleGeo = this.track(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6));
      poleGeo.rotateZ(Math.PI / 2);
      const crossBar = new THREE.Mesh(poleGeo, goldMat);
      crossBar.position.set(px, 3.85, -0.96);
      gateGroup.add(crossBar);

      const bannerGeo = this.track(new THREE.PlaneGeometry(1.05, 2.15, 1, 5));
      const banner = new THREE.Mesh(bannerGeo, romanCrimsonMat);
      banner.position.set(px, 2.75, -0.96);
      banner.rotation.y = Math.PI;
      banner.castShadow = true;
      gateGroup.add(banner);
      this.bannerCloths.push(banner);

      // Gold Roman Shield Emblem on banner
      const emblem = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.28, 12)), goldMat);
      emblem.position.set(px, 2.95, -0.985);
      emblem.rotation.y = Math.PI;
      gateGroup.add(emblem);

      // Torch Brazier mounted on inward face beside guards
      const brazier = new THREE.Mesh(brazierBowlGeo, ironMat);
      brazier.position.set(px + (pIdx === 0 ? 0.55 : -0.55), 2.1, -1.06);
      gateGroup.add(brazier);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(px + (pIdx === 0 ? 0.55 : -0.55), 2.38, -1.06);
      gateGroup.add(flame);
      this.torchFlames.push(flame);
    });

    // 3. Heavy Overhead Stone & Timber Archway Lintel spanning the gate
    const lintelBeam = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(6.8, 0.72, 1.35)),
      darkStoneMat
    );
    lintelBeam.position.set(0, 4.05, 0);
    lintelBeam.castShadow = true;
    lintelBeam.receiveShadow = true;
    gateGroup.add(lintelBeam);

    const upperParapet = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.6, 0.48, 1.05)),
      stoneMat
    );
    upperParapet.position.set(0, 4.65, 0);
    upperParapet.castShadow = true;
    gateGroup.add(upperParapet);

    // Golden Roman Eagle / Crest finial on top center of the archway
    const crestPedestal = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.95, 0.35, 0.6)),
      darkStoneMat
    );
    crestPedestal.position.set(0, 5.05, 0);
    gateGroup.add(crestPedestal);

    const eagleBody = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.28, 10, 8)), goldMat);
    eagleBody.scale.set(0.85, 1.25, 0.75);
    eagleBody.position.set(0, 5.48, 0);
    gateGroup.add(eagleBody);

    const wingGeo = this.track(new THREE.BoxGeometry(0.85, 0.22, 0.1));
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(wingGeo, goldMat);
      wing.position.set(side * 0.52, 5.58, 0);
      wing.rotation.z = side * 0.32;
      gateGroup.add(wing);
    });

    // Arabic Border Signboard mounted cleanly on the front (-Z) of the lintel facing the kingdom
    const plaqueTex = this.createBorderPlaqueTexture();
    const plaqueMat = this.track(
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        emissive: new THREE.Color(0xffe8b8),
        emissiveMap: plaqueTex,
        emissiveIntensity: 0.24,
        roughness: 0.7,
      })
    );
    const plaqueFrame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.2, 1.38, 0.1)),
      ironMat
    );
    plaqueFrame.position.set(0, 4.18, -0.72);
    gateGroup.add(plaqueFrame);

    const plaqueFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.96, 1.22)), plaqueMat);
    plaqueFace.position.set(0, 4.18, -0.78);
    plaqueFace.rotation.y = Math.PI;
    gateGroup.add(plaqueFace);

    // 4. CLOSED & LOCKED Heavy Double Wooden Gate Doors (impossible to pass through!)
    const doorLeafGeo = this.track(new THREE.BoxGeometry(2.44, 3.65, 0.28));
    const strapGeo = this.track(new THREE.BoxGeometry(2.38, 0.14, 0.32));
    const ringGeo = this.track(new THREE.TorusGeometry(0.16, 0.035, 8, 14));

    [-1.24, 1.24].forEach((dx, idx) => {
      const leaf = new THREE.Mesh(doorLeafGeo, gateOakMat);
      leaf.position.set(dx, 1.85, 0);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      gateGroup.add(leaf);

      [0.65, 1.85, 3.05].forEach((sy) => {
        const strap = new THREE.Mesh(strapGeo, ironMat);
        strap.position.set(dx, sy, 0);
        gateGroup.add(strap);
      });

      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.set(idx === 0 ? -0.35 : 0.35, 1.55, -0.17);
      gateGroup.add(ring);
    });

    // Heavy iron-and-oak locking crossbar spanning both closed doors
    const lockBeam = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.3, 0.24, 0.16)),
      ironMat
    );
    lockBeam.position.set(0, 1.62, -0.2);
    gateGroup.add(lockBeam);

    // Low wooden guard barrier posts flanking the gate approach
    const barrierPostGeo = this.track(new THREE.BoxGeometry(0.16, 0.9, 0.16));
    const barrierRailGeo = this.track(new THREE.BoxGeometry(1.4, 0.12, 0.1));
    [-2.75, 2.75].forEach((bx) => {
      const bp = new THREE.Mesh(barrierPostGeo, gateOakMat);
      bp.position.set(bx, 0.45, -1.65);
      bp.castShadow = true;
      gateGroup.add(bp);

      const br = new THREE.Mesh(barrierRailGeo, gateOakMat);
      br.position.set(bx + (bx < 0 ? 0.5 : -0.5), 0.72, -1.65);
      br.castShadow = true;
      gateGroup.add(br);
    });

    this.group.add(gateGroup);

    // 5. Register Solid OBB Colliders in World Coordinates (Closed Gate + Twin Pillars)
    const cosR = Math.cos(gateRotY);
    const sinR = Math.sin(gateRotY);
    const addLocalOBB = (lx: number, lz: number, width: number, depth: number, topY: number) => {
      const wx = this.gatePos.x + lx * cosR + lz * sinR;
      const wz = this.gatePos.z - lx * sinR + lz * cosR;
      this.addOBB(wx, wz, width, depth, gateRotY, topY);
    };

    // Main closed gate wall collider (wide enough to seal gap between towers completely)
    addLocalOBB(0, 0, 5.4, 0.85, 3.7);
    // Twin stone gate watch-pillars
    addLocalOBB(-3.35, 0, 2.05, 2.05, 4.8);
    addLocalOBB(3.35, 0, 2.05, 2.05, 4.8);
  }

  public update(elapsedTime: number) {
    this.elapsed = elapsedTime;
    for (let i = 0; i < this.bannerCloths.length; i++) {
      this.bannerCloths[i].rotation.x = Math.sin(this.elapsed * 2.2 + i * 1.4) * 0.05;
    }
    for (let i = 0; i < this.torchFlames.length; i++) {
      const pulse = 0.88 + Math.sin(this.elapsed * 9.5 + i * 2.1) * 0.16;
      this.torchFlames[i].scale.set(pulse, 0.92 + Math.cos(this.elapsed * 11 + i) * 0.18, pulse);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
