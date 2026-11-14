import * as THREE from 'three';
import type { OBBCollider, CylinderCollider } from './kingdomVillage';

export class RoyalLionCage {
  public readonly group = new THREE.Group();
  public readonly origin = new THREE.Vector3(13.5, 0, -26.2);
  public readonly feedDoorStandPos = new THREE.Vector3(13.5, 0.04, -23.1);
  public readonly feedDropLocalPos = new THREE.Vector3(0, 0.44, 0.55);

  private disposables: { dispose: () => void }[] = [];
  private gatePivot = new THREE.Group();
  private lionGroup = new THREE.Group();
  private lionHeadGroup = new THREE.Group();
  private lionJawPivot = new THREE.Group();
  private lionTailPivot = new THREE.Group();
  private lionLegs: THREE.Group[] = [];
  private doorOpenTarget = 0;
  private doorOpenCurrent = 0;
  private lionState: 'prowl' | 'pounce' | 'eating' = 'prowl';
  private eatTimer = 0;
  private prowlPhase = 0;

  constructor(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial
  ) {
    this.group.position.copy(this.origin);
    this.buildCarriageBayAndCage(
      boxColliders,
      cylinderColliders,
      stoneMat,
      darkStoneMat,
      woodMat,
      ironMat,
      goldMat
    );
    this.buildLion();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private createSignTexture(title: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#23160c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fcd34d';
    ctx.font = '800 44px "Marhey", "Tajawal", sans-serif';
    ctx.fillText(title, canvas.width / 2, 82);

    ctx.fillStyle = '#fde68a';
    ctx.font = '700 30px "Tajawal", sans-serif';
    ctx.fillText(subtitle, canvas.width / 2, 152);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildCarriageBayAndCage(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial
  ) {
    const bayFloor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.6, 0.1, 5.2)),
      stoneMat
    );
    bayFloor.position.set(0, 0.05, 0);
    bayFloor.receiveShadow = true;
    this.group.add(bayFloor);

    // Timber carriage bay canopy behind & beside cage
    const roof = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.4, 0.16, 4.6)),
      woodMat
    );
    roof.position.set(0, 3.08, -0.2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.group.add(roof);

    const bayPostGeo = this.track(new THREE.BoxGeometry(0.24, 3.05, 0.24));
    [
      [-2.5, -2.3],
      [2.5, -2.3],
      [-2.5, 2.0],
      [2.5, 2.0],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(bayPostGeo, darkStoneMat);
      post.position.set(px, 1.52, pz);
      post.castShadow = true;
      this.group.add(post);
      cylinderColliders.push({
        x: this.origin.x + px,
        z: this.origin.z + pz,
        radius: 0.28,
        topY: 3.1,
      });
    });

    // Carriage hitch rail to the left side of the bay
    const hitchPost = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 8)),
      woodMat
    );
    hitchPost.position.set(-2.95, 0.58, 1.15);
    hitchPost.castShadow = true;
    this.group.add(hitchPost);
    cylinderColliders.push({
      x: this.origin.x - 2.95,
      z: this.origin.z + 1.15,
      radius: 0.25,
      topY: 1.2,
    });

    // Iron Lion Cage (3.2m x 3.0m) centered on the platform
    const cageW = 3.2;
    const cageD = 3.0;
    const cageH = 2.15;

    const cageBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(cageW + 0.2, 0.24, cageD + 0.2)),
      darkStoneMat
    );
    cageBase.position.set(0, 0.22, 0);
    cageBase.castShadow = true;
    cageBase.receiveShadow = true;
    this.group.add(cageBase);

    const cageTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(cageW + 0.2, 0.16, cageD + 0.2)),
      ironMat
    );
    cageTop.position.set(0, 0.34 + cageH, 0);
    cageTop.castShadow = true;
    this.group.add(cageTop);

    // Finials
    const finialGeo = this.track(new THREE.ConeGeometry(0.11, 0.24, 8));
    [
      [-cageW * 0.5, -cageD * 0.5],
      [cageW * 0.5, -cageD * 0.5],
      [-cageW * 0.5, cageD * 0.5],
      [cageW * 0.5, cageD * 0.5],
    ].forEach(([cx, cz]) => {
      const f = new THREE.Mesh(finialGeo, goldMat);
      f.position.set(cx, 0.34 + cageH + 0.18, cz);
      this.group.add(f);
    });

    const barGeo = this.track(new THREE.CylinderGeometry(0.032, 0.032, cageH, 8));
    // Back bars (-Z)
    for (let x = -cageW * 0.45; x <= cageW * 0.46; x += 0.28) {
      const b = new THREE.Mesh(barGeo, ironMat);
      b.position.set(x, 0.34 + cageH * 0.5, -cageD * 0.5);
      b.castShadow = true;
      this.group.add(b);
    }
    // Side bars (-X, +X)
    for (let z = -cageD * 0.45; z <= cageD * 0.46; z += 0.28) {
      const bl = new THREE.Mesh(barGeo, ironMat);
      bl.position.set(-cageW * 0.5, 0.34 + cageH * 0.5, z);
      bl.castShadow = true;
      this.group.add(bl);

      const br = new THREE.Mesh(barGeo, ironMat);
      br.position.set(cageW * 0.5, 0.34 + cageH * 0.5, z);
      br.castShadow = true;
      this.group.add(br);
    }
    // Front frame bars flanking the 1.2m door opening (+Z)
    [-1.4, -1.12, -0.84, 0.84, 1.12, 1.4].forEach((x) => {
      const bf = new THREE.Mesh(barGeo, ironMat);
      bf.position.set(x, 0.34 + cageH * 0.5, cageD * 0.5);
      bf.castShadow = true;
      this.group.add(bf);
    });

    // Hinged front iron cage gate (+Z, hinge at x = -0.62)
    this.gatePivot.position.set(-0.62, 0.34, cageD * 0.5);
    const gateFrameTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.24, 0.08, 0.08)),
      ironMat
    );
    gateFrameTop.position.set(0.62, cageH - 0.05, 0);
    this.gatePivot.add(gateFrameTop);
    const gateFrameBot = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.24, 0.08, 0.08)),
      ironMat
    );
    gateFrameBot.position.set(0.62, 0.05, 0);
    this.gatePivot.add(gateFrameBot);
    for (let bx = 0.08; bx <= 1.18; bx += 0.22) {
      const gb = new THREE.Mesh(barGeo, ironMat);
      gb.position.set(bx, cageH * 0.5, 0);
      this.gatePivot.add(gb);
    }
    const lockPlate = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.14, 0.22, 0.1)),
      goldMat
    );
    lockPlate.position.set(1.16, 1.05, 0.02);
    this.gatePivot.add(lockPlate);
    this.group.add(this.gatePivot);

    // Sign above front entrance
    const signTex = this.createSignTexture('الكارش الملكي', 'قفص الأسد');
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xfff1c9),
        emissiveMap: signTex,
        emissiveIntensity: 0.28,
        roughness: 0.72,
      })
    );
    const signBacking = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.15, 0.88, 0.12)),
      woodMat
    );
    signBacking.position.set(0, 3.45, 2.02);
    this.group.add(signBacking);
    const signFace = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(2.02, 0.78)),
      signMat
    );
    signFace.position.set(0, 3.45, 2.09);
    this.group.add(signFace);

    // Water bowl inside cage
    const bowl = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.28, 0.22, 0.16, 12)),
      ironMat
    );
    bowl.position.set(-0.95, 0.42, 0.85);
    this.group.add(bowl);

    // Solid OBB collider for cage box (blocks players & guards from walking inside cage)
    boxColliders.push({
      cx: this.origin.x,
      cz: this.origin.z,
      halfW: cageW * 0.5 + 0.15,
      halfD: cageD * 0.5 + 0.15,
      cosY: 1,
      sinY: 0,
      topY: 2.6,
      allowStand: false,
    });
  }

  private buildLion() {
    const furMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd9963e, roughness: 0.82 })
    );
    const bellyMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xf0c784, roughness: 0.85 })
    );
    const maneMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x5c2c10, roughness: 0.92 })
    );
    const noseMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x26140c, roughness: 0.65 })
    );
    const eyeMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );

    this.lionGroup.position.set(0, 0.34, -0.15);

    // Torso
    const chest = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.62, 0.56, 0.78)),
      furMat
    );
    chest.position.set(0, 0.68, 0.22);
    chest.castShadow = true;
    this.lionGroup.add(chest);

    const hips = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.52, 0.48, 0.66)),
      furMat
    );
    hips.position.set(0, 0.64, -0.35);
    hips.castShadow = true;
    this.lionGroup.add(hips);

    const belly = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.46, 0.2, 0.95)),
      bellyMat
    );
    belly.position.set(0, 0.48, -0.05);
    this.lionGroup.add(belly);

    // Mane & Head
    this.lionHeadGroup.position.set(0, 0.86, 0.66);
    const mane = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.42, 12, 10)),
      maneMat
    );
    mane.scale.set(1.05, 1.08, 0.95);
    mane.castShadow = true;
    this.lionHeadGroup.add(mane);

    const head = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.4, 0.36, 0.42)),
      furMat
    );
    head.position.set(0, 0.02, 0.18);
    head.castShadow = true;
    this.lionHeadGroup.add(head);

    const muzzle = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, 0.16, 0.22)),
      bellyMat
    );
    muzzle.position.set(0, -0.04, 0.42);
    this.lionHeadGroup.add(muzzle);

    const nose = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.11, 0.08, 0.06)),
      noseMat
    );
    nose.position.set(0, 0.02, 0.53);
    this.lionHeadGroup.add(nose);

    [-0.12, 0.12].forEach((ex) => {
      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.036, 6, 6)), eyeMat);
      eye.position.set(ex, 0.09, 0.38);
      this.lionHeadGroup.add(eye);

      const ear = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.12, 0.06)), furMat);
      ear.position.set(ex * 1.45, 0.24, 0.12);
      this.lionHeadGroup.add(ear);
    });

    // Articulated Jaw
    this.lionJawPivot.position.set(0, -0.1, 0.3);
    const jaw = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.2, 0.08, 0.2)),
      bellyMat
    );
    jaw.position.set(0, -0.03, 0.1);
    this.lionJawPivot.add(jaw);
    this.lionHeadGroup.add(this.lionJawPivot);
    this.lionGroup.add(this.lionHeadGroup);

    // 4 Legs
    const legGeo = this.track(new THREE.BoxGeometry(0.18, 0.52, 0.18));
    const pawGeo = this.track(new THREE.BoxGeometry(0.2, 0.1, 0.24));
    [
      [-0.22, 0.46, 0.42],
      [0.22, 0.46, 0.42],
      [-0.2, 0.46, -0.45],
      [0.2, 0.46, -0.45],
    ].forEach(([lx, ly, lz]) => {
      const legP = new THREE.Group();
      legP.position.set(lx, ly, lz);
      const leg = new THREE.Mesh(legGeo, furMat);
      leg.position.y = -0.22;
      leg.castShadow = true;
      const paw = new THREE.Mesh(pawGeo, bellyMat);
      paw.position.set(0, -0.44, 0.03);
      legP.add(leg, paw);
      this.lionGroup.add(legP);
      this.lionLegs.push(legP);
    });

    // Tail
    this.lionTailPivot.position.set(0, 0.72, -0.68);
    const tailShaft = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.035, 0.025, 0.72, 7)),
      furMat
    );
    tailShaft.rotation.x = Math.PI * 0.36;
    tailShaft.position.set(0, -0.14, -0.32);
    const tailTuft = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.085, 8, 7)),
      maneMat
    );
    tailTuft.position.set(0, -0.32, -0.64);
    this.lionTailPivot.add(tailShaft, tailTuft);
    this.lionGroup.add(this.lionTailPivot);

    this.group.add(this.lionGroup);
  }

  public setGateOpen(open: boolean) {
    this.doorOpenTarget = open ? 1 : 0;
  }

  public getGateOpenAmount(): number {
    return this.doorOpenCurrent;
  }

  public feedWholeCitizen() {
    this.lionState = 'pounce';
    this.eatTimer = 3.4;
  }

  public getCageInteriorPos(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.origin.x, 0.36, this.origin.z + 0.55);
  }

  public getFeedDropWorldPos(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.feedDropLocalPos).add(this.origin);
    return out;
  }

  public update(dt: number, elapsed: number) {
    this.doorOpenCurrent = THREE.MathUtils.damp(
      this.doorOpenCurrent,
      this.doorOpenTarget,
      5.5,
      dt
    );
    this.gatePivot.rotation.y = -this.doorOpenCurrent * (Math.PI * 0.62);

    if (this.lionState === 'pounce' || this.lionState === 'eating') {
      this.eatTimer = Math.max(0, this.eatTimer - dt);
      const dx = this.feedDropLocalPos.x - this.lionGroup.position.x;
      const dz = this.feedDropLocalPos.z - 0.35 - this.lionGroup.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.14) {
        this.lionState = 'pounce';
        const yaw = Math.atan2(dx, dz);
        this.lionGroup.rotation.y = yaw;
        const step = Math.min(dist, dt * 3.8);
        this.lionGroup.position.x += (dx / dist) * step;
        this.lionGroup.position.z += (dz / dist) * step;
        this.lionGroup.position.y = 0.34 + Math.abs(Math.sin(elapsed * 14)) * 0.14;
        this.lionHeadGroup.rotation.x = 0.25;
        this.lionJawPivot.rotation.x = 0.42;
      } else {
        this.lionState = 'eating';
        this.lionGroup.position.y = 0.34;
        this.lionGroup.rotation.y = 0;
        // Gnawing & chomping animation while devouring the whole citizen inside cage
        this.lionHeadGroup.rotation.x = 0.56 + Math.sin(elapsed * 16) * 0.16;
        this.lionJawPivot.rotation.x = 0.28 + Math.abs(Math.sin(elapsed * 16)) * 0.38;
      }
      if (this.eatTimer <= 0) {
        this.lionState = 'prowl';
      }
    } else {
      // Calm pacing prowl inside cage
      this.prowlPhase += dt * 0.72;
      const px = Math.sin(this.prowlPhase) * 0.58;
      const pz = Math.cos(this.prowlPhase * 0.7) * 0.32 - 0.12;
      const vx = Math.cos(this.prowlPhase) * 0.58 * 0.72;
      const vz = -Math.sin(this.prowlPhase * 0.7) * 0.32 * 0.7 * 0.72;
      this.lionGroup.position.set(px, 0.34, pz);
      this.lionGroup.rotation.y = Math.atan2(vx, vz);
      this.lionHeadGroup.rotation.x = Math.sin(elapsed * 1.6) * 0.08;
      this.lionJawPivot.rotation.x = Math.max(0, Math.sin(elapsed * 0.9) * 0.14);

      const walkSin = Math.sin(elapsed * 5.2);
      for (let i = 0; i < this.lionLegs.length; i++) {
        this.lionLegs[i].rotation.x = (i % 2 === 0 ? 1 : -1) * walkSin * 0.3;
      }
    }

    this.lionTailPivot.rotation.y = Math.sin(elapsed * 3.4) * 0.38;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
