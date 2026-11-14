import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { OBBCollider, CylinderCollider } from './kingdomVillage';

export type CampDrillType = 'pushup' | 'run' | 'jump';

export interface CampSoldier {
  id: string;
  role: 'general' | 'general_guard' | 'camp_guard' | 'trainee';
  drill: CampDrillType;
  group: THREE.Group;
  modelRoot: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  pos: THREE.Vector3;
  homePos: THREE.Vector3;
  facingAngle: number;
  phaseOffset: number;
  runAngle: number;
}

export class MilitaryCamp {
  public readonly group = new THREE.Group();
  public readonly campCenter = new THREE.Vector3(0, 0, -76.0);
  public readonly generalPos = new THREE.Vector3(0, 0.04, -77.6);
  public soldiers: CampSoldier[] = [];

  private disposables: { dispose: () => void }[] = [];
  private knightTemplate: THREE.Group | null = null;
  private walkClip: THREE.AnimationClip | null = null;
  private idleClip: THREE.AnimationClip | null = null;
  private hasSpawnedSoldiers = false;
  private isNightHidden = false;
  private woodMat!: THREE.MeshStandardMaterial;
  private ironMat!: THREE.MeshStandardMaterial;
  private goldMat!: THREE.MeshStandardMaterial;
  private brazierFlames: THREE.Mesh[] = [];

  constructor(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial,
    crimsonMat: THREE.MeshStandardMaterial
  ) {
    this.woodMat = woodMat;
    this.ironMat = ironMat;
    this.goldMat = goldMat;

    this.buildCampStructures(
      boxColliders,
      cylinderColliders,
      stoneMat,
      darkStoneMat,
      woodMat,
      ironMat,
      goldMat,
      crimsonMat
    );
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private createBannerTexture(title: string, sub: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3f0c0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde047';
    ctx.font = '800 46px "Marhey", "Tajawal", sans-serif';
    ctx.fillText(title, canvas.width / 2, 82);

    ctx.fillStyle = '#fecaca';
    ctx.font = '700 30px "Tajawal", sans-serif';
    ctx.fillText(sub, canvas.width / 2, 152);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private createDrillPlaqueTexture(title: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 42px "Marhey", "Tajawal", sans-serif';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildCampStructures(
    boxColliders: OBBCollider[],
    cylinderColliders: CylinderCollider[],
    stoneMat: THREE.MeshStandardMaterial,
    darkStoneMat: THREE.MeshStandardMaterial,
    woodMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    goldMat: THREE.MeshStandardMaterial,
    crimsonMat: THREE.MeshStandardMaterial
  ) {
    const yardMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x8a7554, roughness: 0.94 })
    );
    const matFabric = this.track(
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.88 })
    );
    const palisadeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 })
    );
    const flameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd27d,
        emissive: new THREE.Color(0xff8c24),
        emissiveIntensity: 1.5,
        roughness: 0.35,
      })
    );

    // 1. Compact packed-dirt drill ground behind Palace (-19..19, -82.5..-69.5)
    const drillGround = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(38.0, 0.06, 13.2)),
      yardMat
    );
    drillGround.position.set(0, 0.03, -76.0);
    drillGround.receiveShadow = true;
    this.group.add(drillGround);

    // 2. Perimeter Defensive Wooden Palisade Walls + Front Gate Opening (x in [-2.6, 2.6], z = -69.5)
    const addPalisadeSegment = (cx: number, cz: number, w: number, d: number, h: number = 1.95) => {
      const wall = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(w, h, d)),
        palisadeMat
      );
      wall.position.set(cx, h * 0.5, cz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Decorative sharpened wooden stakes along top rail
      const isHoriz = w > d;
      const span = isHoriz ? w : d;
      const step = 0.9;
      const stakeGeo = this.track(new THREE.ConeGeometry(0.16, 0.45, 5));
      for (let s = -span * 0.5 + 0.45; s <= span * 0.5 - 0.45; s += step) {
        const stake = new THREE.Mesh(stakeGeo, palisadeMat);
        stake.position.set(cx + (isHoriz ? s : 0), h + 0.2, cz + (isHoriz ? 0 : s));
        this.group.add(stake);
      }

      boxColliders.push({
        cx,
        cz,
        halfW: w * 0.5,
        halfD: d * 0.5,
        cosY: 1,
        sinY: 0,
        topY: h + 0.4,
        allowStand: false,
      });
    };

    // North Back Palisade (z = -82.5)
    addPalisadeSegment(0, -82.5, 38.0, 0.42);
    // West & East Side Palisades (x = +-19.0)
    addPalisadeSegment(-19.0, -76.0, 0.42, 13.0);
    addPalisadeSegment(19.0, -76.0, 0.42, 13.0);
    // South Front Palisades flanking Entrance Gate at z = -69.5 (open gap x in [-2.6, 2.6])
    addPalisadeSegment(-10.8, -69.5, 16.4, 0.42);
    addPalisadeSegment(10.8, -69.5, 16.4, 0.42);

    // 3. Four Corner Timber Guard Watchtowers with Braziers
    const towerSpots: [number, number][] = [
      [-18.2, -70.3],
      [18.2, -70.3],
      [-18.2, -81.7],
      [18.2, -81.7],
    ];
    const towerPostGeo = this.track(new THREE.BoxGeometry(0.24, 3.6, 0.24));
    const towerDeckGeo = this.track(new THREE.BoxGeometry(2.1, 0.22, 2.1));
    const towerRailGeo = this.track(new THREE.BoxGeometry(2.1, 0.65, 0.14));
    for (const [tx, tz] of towerSpots) {
      for (const ox of [-0.85, 0.85]) {
        for (const oz of [-0.85, 0.85]) {
          const leg = new THREE.Mesh(towerPostGeo, darkStoneMat);
          leg.position.set(tx + ox, 1.8, tz + oz);
          leg.castShadow = true;
          this.group.add(leg);
        }
      }
      const deck = new THREE.Mesh(towerDeckGeo, woodMat);
      deck.position.set(tx, 3.3, tz);
      deck.castShadow = true;
      this.group.add(deck);

      const railN = new THREE.Mesh(towerRailGeo, palisadeMat);
      railN.position.set(tx, 3.72, tz - 0.98);
      const railS = new THREE.Mesh(towerRailGeo, palisadeMat);
      railS.position.set(tx, 3.72, tz + 0.98);
      this.group.add(railN, railS);

      const flame = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.19, 8, 8)), flameMat);
      flame.position.set(tx, 4.1, tz);
      this.group.add(flame);
      this.brazierFlames.push(flame);

      boxColliders.push({
        cx: tx,
        cz: tz,
        halfW: 1.05,
        halfD: 1.05,
        cosY: 1,
        sinY: 0,
        topY: 3.8,
        allowStand: false,
      });
    }

    // 4. General's Command Pavilion at center-north of camp (0, 0, -78.4)
    const dais = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.6, 0.16, 4.4)),
      stoneMat
    );
    dais.position.set(0, 0.08, -78.4);
    dais.receiveShadow = true;
    this.group.add(dais);

    const canopy = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(3.4, 2.1, 4)),
      crimsonMat
    );
    canopy.rotation.y = Math.PI / 4;
    canopy.position.set(0, 4.15, -78.4);
    canopy.castShadow = true;
    this.group.add(canopy);

    const poleGeo = this.track(new THREE.CylinderGeometry(0.1, 0.12, 3.3, 8));
    [
      [-2.2, -76.6],
      [2.2, -76.6],
      [-2.2, -80.2],
      [2.2, -80.2],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(poleGeo, darkStoneMat);
      p.position.set(px, 1.65, pz);
      p.castShadow = true;
      this.group.add(p);
      cylinderColliders.push({ x: px, z: pz, radius: 0.25, topY: 3.3 });
    });

    // Command War Table inside General's Pavilion
    const tableTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.7, 0.12, 1.0)),
      woodMat
    );
    tableTop.position.set(0, 0.92, -79.4);
    tableTop.castShadow = true;
    this.group.add(tableTop);
    const tableBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.3, 0.78, 0.7)),
      darkStoneMat
    );
    tableBase.position.set(0, 0.47, -79.4);
    this.group.add(tableBase);
    boxColliders.push({
      cx: 0,
      cz: -79.4,
      halfW: 0.9,
      halfD: 0.55,
      cosY: 1,
      sinY: 0,
      topY: 1.05,
    });

    // 5. Soldiers' Wooden Barracks Benches flanking back of camp (x = +-10.5, z = -80.2)
    [-10.5, 10.5].forEach((bx) => {
      const bunk = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(2.6, 0.45, 1.5)),
        woodMat
      );
      bunk.position.set(bx, 0.225, -80.2);
      bunk.castShadow = true;
      bunk.receiveShadow = true;
      this.group.add(bunk);

      boxColliders.push({
        cx: bx,
        cz: -80.2,
        halfW: 1.4,
        halfD: 0.85,
        cosY: 1,
        sinY: 0,
        topY: 0.55,
      });
    });

    // 6. Camp Entrance Arch Sign at z = -69.5
    const signTex = this.createBannerTexture('معسكر الجيش الملكي', 'حماية وتدريب العسكر');
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xfff1c9),
        emissiveMap: signTex,
        emissiveIntensity: 0.24,
        roughness: 0.74,
      })
    );
    const archBack = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.8, 1.15, 0.14)),
      woodMat
    );
    archBack.position.set(0, 3.25, -69.5);
    this.group.add(archBack);
    const archFace = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(3.6, 1.02)),
      signMat
    );
    archFace.position.set(0, 3.25, -69.41);
    this.group.add(archFace);
    const archFaceBack = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(3.6, 1.02)),
      signMat
    );
    archFaceBack.position.set(0, 3.25, -69.59);
    archFaceBack.rotation.y = Math.PI;
    this.group.add(archFaceBack);

    [-2.1, 2.1].forEach((ax) => {
      const post = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.12, 0.15, 3.45, 8)),
        woodMat
      );
      post.position.set(ax, 1.72, -69.5);
      post.castShadow = true;
      this.group.add(post);
      cylinderColliders.push({ x: ax, z: -69.5, radius: 0.24, topY: 3.45 });
    });

    // 7. Arabic Zone Plaques ("الضغط", "الجري", "القفز")
    const zoneLabels: { x: number; z: number; title: string }[] = [
      { x: -11.5, z: -76.5, title: 'الضغط' },
      { x: 0, z: -75.0, title: 'الجري' },
      { x: 11.4, z: -76.5, title: 'القفز' },
    ];
    zoneLabels.forEach((zl) => {
      const zTex = this.createDrillPlaqueTexture(zl.title);
      const zMat = this.track(
        new THREE.MeshStandardMaterial({
          map: zTex,
          emissive: new THREE.Color(0xfff1c9),
          emissiveMap: zTex,
          emissiveIntensity: 0.22,
          roughness: 0.75,
        })
      );
      const post = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.05, 0.06, 1.85, 6)),
        woodMat
      );
      post.position.set(zl.x, 0.925, zl.z);
      this.group.add(post);
      const board = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.5, 0.58, 0.08)), woodMat);
      board.position.set(zl.x, 1.95, zl.z);
      this.group.add(board);
      const front = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.4, 0.5)), zMat);
      front.position.set(zl.x, 1.95, zl.z + 0.045);
      this.group.add(front);
      const back = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.4, 0.5)), zMat);
      back.position.set(zl.x, 1.95, zl.z - 0.045);
      back.rotation.y = Math.PI;
      this.group.add(back);
    });

    // 8. Left Zone (x in -15..-6): Push-up training mats (الضغط)
    const matGeo = this.track(new THREE.BoxGeometry(1.1, 0.05, 2.2));
    [-14.0, -11.5, -9.0].forEach((mx) => {
      const m = new THREE.Mesh(matGeo, matFabric);
      m.position.set(mx, 0.08, -74.0);
      m.receiveShadow = true;
      this.group.add(m);
    });

    // 9. Right Zone (x in 6..15): Jump hurdles (القفز)
    const hurdleBarGeo = this.track(new THREE.BoxGeometry(2.1, 0.1, 0.1));
    const hurdleLegGeo = this.track(new THREE.BoxGeometry(0.1, 0.56, 0.1));
    [8.2, 11.4, 14.5].forEach((hx) => {
      const hBar = new THREE.Mesh(hurdleBarGeo, goldMat);
      hBar.position.set(hx, 0.55, -74.0);
      hBar.castShadow = true;
      this.group.add(hBar);
      [-0.95, 0.95].forEach((lx) => {
        const leg = new THREE.Mesh(hurdleLegGeo, woodMat);
        leg.position.set(hx + lx, 0.28, -74.0);
        this.group.add(leg);
      });
    });

    // 10. Weapon racks at back corners
    [-16.0, 16.0].forEach((rx) => {
      const rack = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(2.2, 1.4, 0.45)),
        woodMat
      );
      rack.position.set(rx, 0.7, -80.4);
      rack.castShadow = true;
      this.group.add(rack);
      boxColliders.push({
        cx: rx,
        cz: -80.4,
        halfW: 1.15,
        halfD: 0.3,
        cosY: 1,
        sinY: 0,
        topY: 1.4,
      });
      for (let s = -0.7; s <= 0.71; s += 0.35) {
        const blade = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.05, 0.9, 0.03)),
          ironMat
        );
        blade.position.set(rx + s, 0.95, -80.32);
        this.group.add(blade);
      }
    });
  }

  public attachKnightTemplate(
    template: THREE.Group,
    walkClip: THREE.AnimationClip | null,
    idleClip: THREE.AnimationClip | null
  ) {
    if (this.hasSpawnedSoldiers) return;
    this.knightTemplate = template;
    this.walkClip = walkClip;
    this.idleClip = idleClip;
    this.hasSpawnedSoldiers = true;
    this.spawnAllSoldiers();
  }

  private spawnSoldierModel(
    id: string,
    role: CampSoldier['role'],
    drill: CampDrillType,
    x: number,
    z: number,
    facing: number,
    scale: number,
    palette: 'general' | 'guard' | 'trainee',
    phaseOffset: number,
    runAngle = 0
  ) {
    if (!this.knightTemplate) return;
    const wrapper = new THREE.Group();
    wrapper.position.set(x, 0.04, z);
    wrapper.rotation.y = facing;

    const animeFaceMats = new Set(['eyes', 'fix_white', 'fix_mouth', 'fix_blush', 'fix_dark']);
    const recolorMap: Record<string, number> =
      palette === 'general'
        ? {
            top_primary: 0x991b1b,
            body_secondary: 0x7f1d1d,
            handl_primary: 0xb91c1c,
            hat_accent: 0xfbbf24,
            back_primary: 0x7f1d1d,
          }
        : palette === 'guard'
        ? {
            top_primary: 0x1e3a8a,
            body_secondary: 0x334155,
            handl_primary: 0x1d4ed8,
            hat_accent: 0xd97706,
            back_primary: 0x1e40af,
          }
        : {
            top_primary: 0x475569,
            body_secondary: 0x334155,
            handl_primary: 0x64748b,
            hat_accent: 0x94a3b8,
            back_primary: 0x334155,
          };

    const model = cloneSkinned(this.knightTemplate) as THREE.Group;
    model.scale.setScalar(scale);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const matList = Array.isArray(m.material) ? m.material : [m.material];
        const firstMatName = (matList[0]?.name || '').toLowerCase();
        if (matList.length === 1 && animeFaceMats.has(firstMatName)) {
          m.visible = false;
          return;
        }
        m.castShadow = true;
        m.receiveShadow = true;

        const cloneMat = (orig: THREE.Material): THREE.Material => {
          const mat = orig.clone() as THREE.MeshStandardMaterial;
          this.track(mat);
          const mName = (mat.name || '').toLowerCase();
          if (mName in recolorMap) {
            mat.color.setHex(recolorMap[mName]);
          }
          return mat;
        };
        if (Array.isArray(m.material)) {
          m.material = m.material.map(cloneMat);
        } else if (m.material) {
          m.material = cloneMat(m.material);
        }
      }
    });
    wrapper.add(model);

    // Gold crown/plume accent on the General
    if (role === 'general') {
      const crest = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.14, 0.26, 0.34)),
        this.goldMat
      );
      crest.position.set(0, 1.56 * scale, 0);
      wrapper.add(crest);
    }

    const mixer = new THREE.AnimationMixer(model);
    if (drill === 'run' && this.walkClip) {
      const act = mixer.clipAction(this.walkClip);
      act.timeScale = 1.4;
      act.play();
    } else if (this.idleClip) {
      const act = mixer.clipAction(this.idleClip);
      act.play();
    }

    this.group.add(wrapper);
    this.soldiers.push({
      id,
      role,
      drill,
      group: wrapper,
      modelRoot: model,
      mixer,
      pos: new THREE.Vector3(x, 0.04, z),
      homePos: new THREE.Vector3(x, 0.04, z),
      facingAngle: facing,
      phaseOffset,
      runAngle,
    });
  }

  private spawnAllSoldiers() {
    // 1. General inside his pavilion
    this.spawnSoldierModel(
      'camp_general',
      'general',
      'jump',
      0,
      -77.8,
      0,
      1.48,
      'general',
      0
    );

    // 2. Two Guards strictly guarding the General
    this.spawnSoldierModel(
      'camp_gen_guard_l',
      'general_guard',
      'jump',
      -1.85,
      -77.2,
      0.15,
      1.36,
      'guard',
      0.5
    );
    this.spawnSoldierModel(
      'camp_gen_guard_r',
      'general_guard',
      'jump',
      1.85,
      -77.2,
      -0.15,
      1.36,
      'guard',
      1.2
    );

    // 3. Four Perimeter & Entrance Camp Protection Guards
    this.spawnSoldierModel(
      'camp_gate_guard_l',
      'camp_guard',
      'jump',
      -2.65,
      -69.1,
      0,
      1.36,
      'guard',
      0.2
    );
    this.spawnSoldierModel(
      'camp_gate_guard_r',
      'camp_guard',
      'jump',
      2.65,
      -69.1,
      0,
      1.36,
      'guard',
      0.9
    );
    this.spawnSoldierModel(
      'camp_watch_guard_w',
      'camp_guard',
      'jump',
      -16.8,
      -71.4,
      0.45,
      1.34,
      'guard',
      1.7
    );
    this.spawnSoldierModel(
      'camp_watch_guard_e',
      'camp_guard',
      'jump',
      16.8,
      -71.4,
      -0.45,
      1.34,
      'guard',
      2.3
    );

    // 4. Push-up Trainees (الضغط)
    [-14.0, -11.5, -9.0].forEach((x, idx) => {
      this.spawnSoldierModel(
        `camp_pushup_${idx}`,
        'trainee',
        'pushup',
        x,
        -73.6,
        0,
        1.32,
        'trainee',
        idx * 1.1
      );
    });

    // 5. Running Lap Trainees (الجري)
    [0, Math.PI * 0.66, Math.PI * 1.33].forEach((ang, idx) => {
      this.spawnSoldierModel(
        `camp_runner_${idx}`,
        'trainee',
        'run',
        Math.cos(ang) * 4.5,
        -72.8 + Math.sin(ang) * 1.8,
        0,
        1.32,
        'trainee',
        idx * 0.9,
        ang
      );
    });

    // 6. Jumping Drill Trainees (القفز)
    [8.2, 11.4, 14.5].forEach((x, idx) => {
      this.spawnSoldierModel(
        `camp_jumper_${idx}`,
        'trainee',
        'jump',
        x,
        -73.4,
        Math.PI,
        1.32,
        'trainee',
        idx * 1.4
      );
    });
  }

  private wasWarActive = false;
  private distantCampAccumDt = 0;
  private campTickCount = 0;

  public update(
    dt: number,
    elapsed: number,
    isNight: boolean,
    isWarActive: boolean = false,
    sultanPos?: THREE.Vector3
  ) {
    // Animate watchtower brazier flames even at night
    for (let i = 0; i < this.brazierFlames.length; i++) {
      this.brazierFlames[i].scale.setScalar(0.88 + Math.sin(elapsed * 8.0 + i * 1.5) * 0.16);
    }

    // Disappear at night ("العسكر يتدربون و فاليل يختفون"), except when rallying to War!
    const shouldHideForNight = isNight && !isWarActive;
    if (shouldHideForNight !== this.isNightHidden) {
      this.isNightHidden = shouldHideForNight;
      for (let i = 0; i < this.soldiers.length; i++) {
        this.soldiers[i].group.visible = !shouldHideForNight;
      }
    }

    if (this.wasWarActive && !isWarActive) {
      for (let i = 0; i < this.soldiers.length; i++) {
        const s = this.soldiers[i];
        s.pos.copy(s.homePos);
        s.group.position.copy(s.homePos);
        s.group.rotation.y = s.facingAngle;
        if (s.modelRoot) {
          s.modelRoot.rotation.set(0, 0, 0);
          s.modelRoot.position.y = 0;
        }
      }
    }
    this.wasWarActive = isWarActive;

    if (shouldHideForNight) return;

    this.campTickCount++;
    let stepDt = dt;
    if (!isWarActive && sultanPos) {
      const dSq = sultanPos.x * sultanPos.x + (sultanPos.z + 78) * (sultanPos.z + 78);
      if (dSq > 44 * 44) {
        this.distantCampAccumDt += dt;
        if ((this.campTickCount & 3) !== 0 && this.distantCampAccumDt < 0.14) {
          return;
        }
        stepDt = Math.min(this.distantCampAccumDt, 0.2);
        this.distantCampAccumDt = 0;
      } else {
        this.distantCampAccumDt = 0;
      }
    }

    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      s.mixer?.update(stepDt);

      if (s.role === 'general' || s.role === 'general_guard' || s.role === 'camp_guard') {
        s.pos.copy(s.homePos);
        s.group.position.copy(s.pos);
        s.group.rotation.y = s.facingAngle + Math.sin(elapsed * 0.8 + s.phaseOffset) * 0.14;
        continue;
      }

      if (isWarActive) {
        // Training soldiers stop drills, exit camp gate (0,-69.5), skirt East around Palace wall (x=30.5), and charge to the Fountain battleground (0, -9.5)
        if (s.modelRoot) {
          s.modelRoot.rotation.set(0, 0, 0);
          s.modelRoot.position.y = 0;
        }
        const slotIdx = i % 9;
        const ringAngle = -Math.PI * 0.85 + (slotIdx / 8) * Math.PI * 1.4;
        const targetX = Math.cos(ringAngle) * 4.4;
        const targetZ = -9.5 + Math.sin(ringAngle) * 4.8;
        let waypointX = targetX;
        let waypointZ = targetZ;
        if (s.pos.z < -69.0 && Math.abs(s.pos.x) > 2.2) {
          waypointX = 0;
          waypointZ = -68.2;
        } else if (s.pos.z < -26.0 && s.pos.x < 28.5) {
          waypointX = 30.5;
          waypointZ = -66.5;
        } else if (s.pos.z < -23.5) {
          waypointX = 30.5;
          waypointZ = -21.5;
        } else if (s.pos.x > 10.5 && s.pos.z < -16.0) {
          waypointX = 6.5;
          waypointZ = -18.5;
        }
        const dx = waypointX - s.pos.x;
        const dz = waypointZ - s.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.65) {
          const step = Math.min(dist, 6.8 * dt);
          s.pos.x += (dx / dist) * step;
          s.pos.z += (dz / dist) * step;
          s.pos.y = 0.04 + Math.abs(Math.sin(elapsed * 11 + i)) * 0.06;
          s.group.rotation.y = Math.atan2(dx, dz);
        } else {
          // Battle combat lunge right next to the Fountain facing Roman units on the East side
          const swayX = Math.sin(elapsed * 2.8 + i) * 0.9;
          const swayZ = Math.cos(elapsed * 2.4 + i) * 0.6;
          s.pos.x = targetX + swayX;
          s.pos.z = targetZ + swayZ;
          s.group.rotation.y = Math.PI * 0.5 + Math.sin(elapsed * 5.5 + i) * 0.35;
          s.pos.y = 0.04 + Math.max(0, Math.sin(elapsed * 8.5 + i)) * 0.12;
        }
        s.group.position.copy(s.pos);
        continue;
      }

      // Daytime training drills (Pushups, Running, Jumping)
      if (s.drill === 'pushup') {
        const pushPhase = (Math.sin(elapsed * 4.2 + s.phaseOffset) + 1) * 0.5;
        if (s.modelRoot) {
          s.modelRoot.rotation.set(Math.PI * 0.44, 0, 0);
          s.modelRoot.position.y = 0.24 + pushPhase * 0.26;
        }
        s.pos.copy(s.homePos);
        s.group.position.copy(s.pos);
        s.group.rotation.y = 0;
      } else if (s.drill === 'run') {
        s.runAngle += dt * 1.55;
        const rx = 4.6;
        const rz = 2.0;
        const nx = Math.cos(s.runAngle) * rx;
        const nz = -72.8 + Math.sin(s.runAngle) * rz;
        const vx = -Math.sin(s.runAngle) * rx;
        const vz = Math.cos(s.runAngle) * rz;
        s.pos.set(nx, 0.04, nz);
        s.facingAngle = Math.atan2(vx, vz);
        s.group.position.copy(s.pos);
        s.group.rotation.y = s.facingAngle;
      } else if (s.drill === 'jump') {
        const cycle = Math.sin(elapsed * 5.2 + s.phaseOffset);
        const hopH = Math.max(0, cycle) * 0.7;
        s.pos.set(s.homePos.x, 0.04 + hopH, s.homePos.z);
        s.group.position.copy(s.pos);
        s.group.rotation.y = Math.PI;
      }
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
