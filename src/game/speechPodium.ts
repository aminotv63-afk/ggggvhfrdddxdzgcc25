import * as THREE from 'three';
import type { OBBCollider, CylinderCollider } from './kingdomVillage';

/**
 * Royal Speech Podium ("منصة الخطاب الملكي")
 * Positioned cleanly on the West Forecourt Plaza in front of the Royal Palace.
 * Sultan walks up the stepped crimson-carpeted stairs onto the dais (y = 0.42m);
 * free citizens gather in front of the podium and bow while Sultan stands there,
 * and disperse immediately once Sultan steps off.
 */
export class RoyalSpeechPodium {
  public readonly group = new THREE.Group();
  public readonly origin = new THREE.Vector3(-19.5, 0, -25.2);

  private disposables: { dispose: () => void }[] = [];
  private banners: THREE.Mesh[] = [];
  private flameMeshes: THREE.Mesh[] = [];
  private glowMat!: THREE.MeshStandardMaterial;

  constructor(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    buildingFootprints: { x: number; z: number; r: number }[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial,
    crimsonMat: THREE.MeshStandardMaterial
  ) {
    this.group.name = 'RoyalSpeechPodium';
    this.group.position.copy(this.origin);

    this.buildPodium(
      boxColliders,
      cylinderColliders,
      stoneMat,
      darkStoneMat,
      woodMat,
      goldMat,
      crimsonMat
    );

    buildingFootprints.push({ x: this.origin.x, z: this.origin.z, r: 3.4 });
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private createPlaqueTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3b0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde047';
    ctx.font = '800 44px "Marhey", "Tajawal", sans-serif';
    ctx.fillText('منصة الخطاب الملكي', canvas.width / 2, 70);

    ctx.fillStyle = '#fef2f2';
    ctx.font = '700 28px "Tajawal", sans-serif';
    ctx.fillText('اصعد هنا لتجتمع الرعية أمامك', canvas.width / 2, 134);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildPodium(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial,
    crimsonMat: THREE.MeshStandardMaterial
  ) {
    this.glowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd27d,
        emissive: new THREE.Color(0xff9429),
        emissiveIntensity: 1.4,
        roughness: 0.4,
      })
    );

    // 1. Main Raised Marble Platform (4.6m x 3.2m, height = 0.42m, walkable allowStand)
    const stageMesh = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.6, 0.42, 3.2)),
      stoneMat
    );
    stageMesh.position.set(0, 0.21, 0);
    stageMesh.castShadow = true;
    stageMesh.receiveShadow = true;
    this.group.add(stageMesh);

    const stageCarpet = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.1, 0.02, 2.75)),
      crimsonMat
    );
    stageCarpet.position.set(0, 0.428, 0);
    stageCarpet.receiveShadow = true;
    this.group.add(stageCarpet);

    const goldBorderF = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.68, 0.06, 0.1)),
      goldMat
    );
    goldBorderF.position.set(0, 0.42, 1.56);
    this.group.add(goldBorderF);

    boxColliders.push({
      cx: this.origin.x,
      cz: this.origin.z,
      halfW: 2.3,
      halfD: 1.6,
      cosY: 1,
      sinY: 0,
      topY: 0.42,
      allowStand: true,
    });

    // 2. Walkable 2-step Stairway on the Front (+Z) side facing audience (plus wide approach)
    const steps = [
      { zLocal: 2.35, depth: 0.78, topY: 0.14 },
      { zLocal: 1.78, depth: 0.72, topY: 0.28 },
    ];
    for (const s of steps) {
      const stepStone = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(3.2, s.topY, s.depth)),
        darkStoneMat
      );
      stepStone.position.set(0, s.topY * 0.5, s.zLocal);
      stepStone.receiveShadow = true;
      stepStone.castShadow = true;
      this.group.add(stepStone);

      const stepCarpet = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(2.6, 0.016, s.depth * 0.92)),
        crimsonMat
      );
      stepCarpet.position.set(0, s.topY + 0.004, s.zLocal);
      this.group.add(stepCarpet);

      boxColliders.push({
        cx: this.origin.x,
        cz: this.origin.z + s.zLocal,
        halfW: 1.6,
        halfD: s.depth * 0.5,
        cosY: 1,
        sinY: 0,
        topY: s.topY,
        allowStand: true,
      });
    }

    // 3. Ornamental Back Balustrade (-Z) behind Sultan so audience focuses forward
    const backWall = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(4.5, 0.96, 0.22)),
      darkStoneMat
    );
    backWall.position.set(0, 0.42 + 0.48, -1.48);
    backWall.castShadow = true;
    this.group.add(backWall);

    boxColliders.push({
      cx: this.origin.x,
      cz: this.origin.z - 1.48,
      halfW: 2.25,
      halfD: 0.16,
      cosY: 1,
      sinY: 0,
      topY: 1.45,
      allowStand: false,
    });

    // Arabic Plaque mounted cleanly on the back marble wall facing the crowd (+Z)
    const plaqueTex = this.createPlaqueTexture();
    const plaqueMat = this.track(
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        emissive: new THREE.Color(0xfff1c9),
        emissiveMap: plaqueTex,
        emissiveIntensity: 0.25,
        roughness: 0.72,
      })
    );
    const plaqueFrame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.75, 0.96, 0.12)),
      woodMat
    );
    plaqueFrame.position.set(0, 2.02, -1.46);
    plaqueFrame.castShadow = true;
    this.group.add(plaqueFrame);

    const plaqueFace = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(2.58, 0.84)),
      plaqueMat
    );
    plaqueFace.position.set(0, 2.02, -1.39);
    this.group.add(plaqueFace);

    const plaquePosts = [-1.25, 1.25];
    for (const px of plaquePosts) {
      const p = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.06, 0.08, 1.35, 8)),
        goldMat
      );
      p.position.set(px, 1.38, -1.46);
      this.group.add(p);
    }

    // 4. Corner Torch Pillars & Royal Crimson Banners flanking stage
    const cornerXs = [-2.12, 2.12];
    for (const cx of cornerXs) {
      // Back banner poles
      const pole = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.055, 0.07, 2.85, 8)),
        goldMat
      );
      pole.position.set(cx, 0.42 + 1.425, -1.42);
      pole.castShadow = true;
      this.group.add(pole);

      const finial = new THREE.Mesh(
        this.track(new THREE.OctahedronGeometry(0.14, 0)),
        goldMat
      );
      finial.position.set(cx, 0.42 + 2.94, -1.42);
      this.group.add(finial);

      const banner = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(0.56, 1.45)),
        this.track(
          new THREE.MeshStandardMaterial({
            color: 0x991b1b,
            roughness: 0.82,
            side: THREE.DoubleSide,
          })
        )
      );
      banner.position.set(cx + (cx < 0 ? 0.34 : -0.34), 0.42 + 1.85, -1.42);
      this.group.add(banner);
      this.banners.push(banner);

      // Front corner brazier posts
      const fPost = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.1, 0.14, 1.15, 8)),
        darkStoneMat
      );
      fPost.position.set(cx, 0.42 + 0.575, 1.35);
      fPost.castShadow = true;
      this.group.add(fPost);

      const flame = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.14, 8, 8)),
        this.glowMat
      );
      flame.position.set(cx, 0.42 + 1.24, 1.35);
      this.group.add(flame);
      this.flameMeshes.push(flame);

      cylinderColliders.push({
        x: this.origin.x + cx,
        z: this.origin.z + 1.35,
        radius: 0.22,
        topY: 1.7,
      });
    }

    // 5. Royal Speech Lectern ("منبر الخطاب") near front-center rim of platform
    const lecternBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.68, 0.88, 0.46)),
      woodMat
    );
    lecternBase.position.set(0, 0.42 + 0.44, 0.88);
    lecternBase.castShadow = true;
    this.group.add(lecternBase);

    const lecternTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.84, 0.08, 0.56)),
      goldMat
    );
    lecternTop.position.set(0, 0.42 + 0.9, 0.88);
    lecternTop.rotation.x = 0.22;
    this.group.add(lecternTop);

    const scrollPaper = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.46, 0.03, 0.32)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 }))
    );
    scrollPaper.position.set(0, 0.42 + 0.95, 0.88);
    scrollPaper.rotation.x = 0.22;
    this.group.add(scrollPaper);

    boxColliders.push({
      cx: this.origin.x,
      cz: this.origin.z + 0.88,
      halfW: 0.44,
      halfD: 0.28,
      cosY: 1,
      sinY: 0,
      topY: 1.45,
      allowStand: false,
    });
  }

  public isSultanOnPodium(pos: THREE.Vector3): boolean {
    return (
      Math.abs(pos.x - this.origin.x) <= 2.35 &&
      pos.z >= this.origin.z - 1.65 &&
      pos.z <= this.origin.z + 1.65 &&
      pos.y >= 0.20
    );
  }

  /**
   * Computes clean semicircular audience standing slots directly in front (+Z) of the podium,
   * staying well inside the West Forecourt clear of Cannon, Palace, and Gallows.
   */
  public getAudienceSlot(index: number, total: number, out: THREE.Vector3): THREE.Vector3 {
    const perRow = 9;
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const rowCount = Math.min(perRow, Math.max(1, total - row * perRow));
    const t = rowCount <= 1 ? 0 : col / (rowCount - 1) - 0.5;
    const radius = 3.8 + row * 1.45;
    const angle = t * Math.PI * 0.68; // Wide arc facing -Z toward podium

    const sx = this.origin.x + Math.sin(angle) * radius;
    const sz = this.origin.z + 1.2 + Math.cos(angle) * radius;
    return out.set(sx, 0, sz);
  }

  public update(elapsed: number) {
    for (let i = 0; i < this.banners.length; i++) {
      this.banners[i].rotation.x = Math.sin(elapsed * 2.1 + i * 1.3) * 0.07;
    }
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const s = 0.9 + Math.sin(elapsed * 8.5 + i * 2.1) * 0.16;
      this.flameMeshes[i].scale.setScalar(s);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
