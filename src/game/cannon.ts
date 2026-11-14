import * as THREE from 'three';
import { CylinderCollider, OBBCollider } from './kingdomVillage';
import { createStoneMasonryTexture, createWoodPlankTexture } from './textures';
import { soundManager } from './audio';

interface CannonProjectile {
  group: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  trailTimer: number;
  startX: number;
  startZ: number;
  active: boolean;
}

interface SkyParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  baseOpacity: number;
  gravity: number;
  active: boolean;
}

const _muzzleWorldPos = new THREE.Vector3();
const _launchDir = new THREE.Vector3();

/**
 * Heavy Royal Fortress Cannon ("المدفع السلطاني")
 * Mounted on a rotatable wheeled oak carriage atop a stone firing bastion.
 * Fires high-velocity iron cannonballs soaring 85m+ into the sky and 300m+ across the horizon
 * with recoil animation, muzzle flash, fiery smoke trail, and distant sky/horizon explosion.
 */
export class RoyalCannon {
  public group: THREE.Group;
  public readonly origin = new THREE.Vector3(-10.0, 0, -27.5);
  public cannonYaw: number = -Math.PI * 0.36; // Aimed West-South-West away from Palace grounds toward open sea
  public readonly elevationAngle: number = 0.68; // ~39° high skyward arc
  public cooldownRemaining: number = 0;

  private readonly cooldownDuration: number = 2.0;
  private readonly launchSpeed: number = 82.0;
  private readonly projectileGravity: number = 15.5;

  private disposables: { dispose: () => void }[] = [];
  private carriageGroup!: THREE.Group;
  private barrelPivot!: THREE.Group;
  private barrelBodyGroup!: THREE.Group;
  private muzzleTipAnchor: THREE.Object3D = new THREE.Object3D();
  private fuseSparkMesh!: THREE.Mesh;
  private wheels: THREE.Group[] = [];

  private recoilOffset: number = 0;
  private recoilVel: number = 0;
  private wheelSpinOffset: number = 0;
  private muzzleGlowTimer: number = 0;

  private projectiles: CannonProjectile[] = [];
  private particles: SkyParticle[] = [];
  private particleGeo!: THREE.SphereGeometry;
  private ringGeo!: THREE.RingGeometry;
  private shockwaveRings: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    age: number;
    maxAge: number;
    maxScale: number;
    active: boolean;
  }[] = [];

  constructor(
    targetBoxColliders: OBBCollider[],
    targetCylinderColliders: CylinderCollider[],
    targetFootprints?: { x: number; z: number; r: number }[]
  ) {
    this.group = new THREE.Group();
    this.group.name = 'RoyalCannon';

    this.buildCannonStructure(targetBoxColliders, targetCylinderColliders);
    this.initParticlePools();

    if (targetFootprints) {
      targetFootprints.push({ x: this.origin.x, z: this.origin.z, r: 4.4 });
    }
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private createCannonPlaqueTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#221710';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#d9a438';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde68a';
    ctx.font = '800 72px "Marhey", "Tajawal", sans-serif';
    ctx.fillText('المدفع السلطاني', canvas.width / 2, canvas.height / 2 + 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildCannonStructure(
    _targetBoxColliders: OBBCollider[],
    targetCylinderColliders: CylinderCollider[]
  ) {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    const stoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xa59f96,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    const darkStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x625d56,
        roughness: 0.92,
        metalness: 0.06,
      })
    );
    const oakMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x6d4222,
        roughness: 0.82,
        metalness: 0.05,
      })
    );
    const bronzeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x453a2c,
        roughness: 0.34,
        metalness: 0.82,
      })
    );
    const brassTrimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xd9a438,
        roughness: 0.28,
        metalness: 0.88,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1d2026,
        roughness: 0.45,
        metalness: 0.84,
      })
    );
    const boreMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x060608,
        roughness: 0.95,
        metalness: 0.1,
      })
    );

    const station = new THREE.Group();
    station.position.copy(this.origin);
    this.group.add(station);

    // 1. Octagonal Carved Stone Firing Bastion Pad (low walkable step y = 0.24)
    const padOuter = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(2.65, 2.88, 0.24, 8)),
      darkStoneMat
    );
    padOuter.position.y = 0.12;
    padOuter.receiveShadow = true;
    padOuter.castShadow = true;
    station.add(padOuter);

    const padDeck = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(2.38, 2.38, 0.04, 8)),
      stoneMat
    );
    padDeck.position.y = 0.25;
    padDeck.receiveShadow = true;
    station.add(padDeck);

    // Walkable deck collider so Sultan steps smoothly up onto the bastion
    targetCylinderColliders.push({
      x: this.origin.x,
      z: this.origin.z,
      radius: 2.7,
      topY: 0.27,
      allowStand: true,
    });

    // Solid inner carriage core collider so player stands behind/beside cannon without clipping through
    targetCylinderColliders.push({
      x: this.origin.x,
      z: this.origin.z,
      radius: 1.05,
      topY: 1.9,
      allowStand: false,
    });

    // 2. Stacked Cast-Iron Cannonball Pyramid & Gunpowder Barrel on East/South side of pad
    const ballGeo = this.track(new THREE.SphereGeometry(0.16, 12, 10));
    const ballOffsets: [number, number, number][] = [
      // Bottom 3x3 layer (9 balls)
      [-0.32, 0.16, -0.32],
      [0, 0.16, -0.32],
      [0.32, 0.16, -0.32],
      [-0.32, 0.16, 0],
      [0, 0.16, 0],
      [0.32, 0.16, 0],
      [-0.32, 0.16, 0.32],
      [0, 0.16, 0.32],
      [0.32, 0.16, 0.32],
      // Middle 2x2 layer (4 balls)
      [-0.16, 0.42, -0.16],
      [0.16, 0.42, -0.16],
      [-0.16, 0.42, 0.16],
      [0.16, 0.42, 0.16],
      // Apex ball
      [0, 0.66, 0],
    ];
    const pyramidGroup = new THREE.Group();
    pyramidGroup.position.set(1.55, 0.27, 0.65);
    const rack = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.05, 0.08, 1.05)),
      oakMat
    );
    rack.position.y = 0.04;
    pyramidGroup.add(rack);
    ballOffsets.forEach(([bx, by, bz]) => {
      const b = new THREE.Mesh(ballGeo, ironMat);
      b.position.set(bx, by + 0.06, bz);
      b.castShadow = true;
      pyramidGroup.add(b);
    });
    station.add(pyramidGroup);

    // Gunpowder Barrel beside cannon
    const kegGroup = new THREE.Group();
    kegGroup.position.set(-1.55, 0.27, 0.72);
    const kegBody = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.32, 0.3, 0.78, 12)),
      oakMat
    );
    kegBody.position.y = 0.39;
    kegBody.castShadow = true;
    kegGroup.add(kegBody);

    const hoopGeo = this.track(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 12));
    [0.14, 0.64].forEach((hy) => {
      const hoop = new THREE.Mesh(hoopGeo, ironMat);
      hoop.position.y = hy;
      kegGroup.add(hoop);
    });
    station.add(kegGroup);

    // Plaque facing the front plaza (+Z/+X approach)
    const plaquePost = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.14, 0.95, 0.14)),
      oakMat
    );
    plaquePost.position.set(1.85, 0.48, 1.95);
    plaquePost.castShadow = true;
    station.add(plaquePost);

    const plaqueTex = this.createCannonPlaqueTexture();
    const plaqueMat = this.track(
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        emissive: new THREE.Color(0xfff1d6),
        emissiveMap: plaqueTex,
        emissiveIntensity: 0.25,
        roughness: 0.72,
      })
    );
    const plaqueBack = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.38, 0.46, 0.08)),
      oakMat
    );
    plaqueBack.position.set(1.85, 1.05, 1.95);
    plaqueBack.rotation.y = 0.38;
    station.add(plaqueBack);

    const plaqueFace = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(1.3, 0.4)),
      plaqueMat
    );
    plaqueFace.position.set(0, 0, 0.045);
    plaqueBack.add(plaqueFace);

    // 3. Rotatable Naval/Siege Cannon Carriage Assembly (elevated on padDeck at y = 0.27)
    this.carriageGroup = new THREE.Group();
    this.carriageGroup.position.set(0, 0.27, 0);
    this.carriageGroup.rotation.y = this.cannonYaw;
    station.add(this.carriageGroup);

    // Carriage Cheek Side Beams (+Z is forward firing direction)
    const cheekGeo = this.track(new THREE.BoxGeometry(0.18, 0.62, 2.05));
    [-0.44, 0.44].forEach((cx) => {
      const cheek = new THREE.Mesh(cheekGeo, oakMat);
      cheek.position.set(cx, 0.56, -0.1);
      cheek.castShadow = true;
      cheek.receiveShadow = true;
      this.carriageGroup.add(cheek);

      const cheekCap = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.2, 0.08, 2.08)),
        ironMat
      );
      cheekCap.position.set(cx, 0.88, -0.1);
      this.carriageGroup.add(cheekCap);
    });

    // Cross Axles & Transom
    const axleGeo = this.track(new THREE.CylinderGeometry(0.08, 0.08, 1.48, 10));
    axleGeo.rotateZ(Math.PI / 2);
    [0.58, -0.78].forEach((az) => {
      const axle = new THREE.Mesh(axleGeo, ironMat);
      axle.position.set(0, 0.36, az);
      axle.castShadow = true;
      this.carriageGroup.add(axle);
    });

    const bedBlock = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.74, 0.22, 1.55)),
      oakMat
    );
    bedBlock.position.set(0, 0.42, -0.15);
    this.carriageGroup.add(bedBlock);

    // 4 Spoked Oak & Iron-Rimmed Siege Wheels
    const createWheel = (radius: number) => {
      const wg = new THREE.Group();
      const rim = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(radius, 0.055, 8, 18)),
        ironMat
      );
      rim.rotation.y = Math.PI / 2;
      rim.castShadow = true;
      wg.add(rim);

      const woodRim = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(radius - 0.05, 0.045, 7, 18)),
        oakMat
      );
      woodRim.rotation.y = Math.PI / 2;
      wg.add(woodRim);

      const hub = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10)),
        brassTrimMat
      );
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);

      const spokeGeo = this.track(new THREE.BoxGeometry(0.045, radius * 1.85, 0.045));
      for (let s = 0; s < 4; s++) {
        const sp = new THREE.Mesh(spokeGeo, oakMat);
        sp.rotation.x = (s * Math.PI) / 4;
        wg.add(sp);
      }
      return wg;
    };

    const wheelSpecs: [number, number, number, number][] = [
      [-0.65, 0.38, 0.58, 0.36],
      [0.65, 0.38, 0.58, 0.36],
      [-0.65, 0.33, -0.78, 0.31],
      [0.65, 0.33, -0.78, 0.31],
    ];
    wheelSpecs.forEach(([wx, wy, wz, wr]) => {
      const w = createWheel(wr);
      w.position.set(wx, wy, wz);
      this.wheels.push(w);
      this.carriageGroup.add(w);
    });

    // 4. Heavy Cast-Bronze/Iron Cannon Barrel (LatheGeometry profile around +Z)
    this.barrelPivot = new THREE.Group();
    this.barrelPivot.position.set(0, 0.94, 0.18);
    // Negative X rotation tilts +Z barrel upward toward +Y (into the sky!)
    this.barrelPivot.rotation.x = -this.elevationAngle;
    this.carriageGroup.add(this.barrelPivot);

    this.barrelBodyGroup = new THREE.Group();
    this.barrelPivot.add(this.barrelBodyGroup);

    // Lathe profile along Y then rotated +90 deg on X so axis aligns with +Z
    const lathePoints = [
      new THREE.Vector2(0.01, -1.28), // Cascabel tip
      new THREE.Vector2(0.15, -1.24),
      new THREE.Vector2(0.16, -1.12),
      new THREE.Vector2(0.09, -1.04),
      new THREE.Vector2(0.39, -0.96), // Breech base
      new THREE.Vector2(0.41, -0.82),
      new THREE.Vector2(0.37, -0.35), // First reinforce
      new THREE.Vector2(0.34, 0.15),  // Second reinforce
      new THREE.Vector2(0.28, 0.85),  // Chase taper
      new THREE.Vector2(0.26, 1.38),  // Neck
      new THREE.Vector2(0.35, 1.56),  // Muzzle swell
      new THREE.Vector2(0.32, 1.68),  // Muzzle face outer
      new THREE.Vector2(0.21, 1.68),  // Bore lip
      new THREE.Vector2(0.19, 1.45),  // Inner bore cavity
      new THREE.Vector2(0.01, 1.45),
    ];
    const barrelGeo = this.track(new THREE.LatheGeometry(lathePoints, 24));
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, bronzeMat);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    this.barrelBodyGroup.add(barrelMesh);

    // Golden/brass decorative reinforcing bands along the barrel
    const bandGeo1 = this.track(new THREE.TorusGeometry(0.395, 0.032, 8, 24));
    const band1 = new THREE.Mesh(bandGeo1, brassTrimMat);
    band1.position.z = -0.85;
    this.barrelBodyGroup.add(band1);

    const bandGeo2 = this.track(new THREE.TorusGeometry(0.35, 0.028, 8, 24));
    const band2 = new THREE.Mesh(bandGeo2, brassTrimMat);
    band2.position.z = 0.05;
    this.barrelBodyGroup.add(band2);

    const bandGeo3 = this.track(new THREE.TorusGeometry(0.335, 0.03, 8, 24));
    const band3 = new THREE.Mesh(bandGeo3, brassTrimMat);
    band3.position.z = 1.56;
    this.barrelBodyGroup.add(band3);

    // Dark recessed bore disc at muzzle
    const boreDisc = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(0.2, 16)),
      boreMat
    );
    boreDisc.position.z = 1.66;
    this.barrelBodyGroup.add(boreDisc);

    // Trunnions attaching barrel to carriage cheeks
    const trunnion = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.11, 0.11, 1.12, 12)),
      brassTrimMat
    );
    trunnion.rotation.z = Math.PI / 2;
    trunnion.position.set(0, 0.94, 0.18);
    this.carriageGroup.add(trunnion);

    // Glowing fuse spark at breech touch-hole
    const fuseMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xffb703, fog: false })
    );
    this.fuseSparkMesh = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.065, 8, 6)),
      fuseMat
    );
    this.fuseSparkMesh.position.set(0, 0.42, -0.84);
    this.barrelBodyGroup.add(this.fuseSparkMesh);

    // Muzzle anchor right at tip of cannon barrel (+Z = 1.72)
    this.muzzleTipAnchor.position.set(0, 0, 1.74);
    this.barrelBodyGroup.add(this.muzzleTipAnchor);
  }

  private initParticlePools() {
    this.particleGeo = this.track(new THREE.SphereGeometry(1, 10, 8));
    this.ringGeo = this.track(new THREE.RingGeometry(0.65, 1.0, 28));

    // Pre-allocate sky smoke, ember & explosion fireball particles (zero GC per frame)
    for (let i = 0; i < 72; i++) {
      const mat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          fog: false,
        })
      );
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        startScale: 0.4,
        endScale: 1.5,
        baseOpacity: 0.85,
        gravity: 0,
        active: false,
      });
    }

    // Shockwave expansion rings (muzzle blast + distant sky explosion)
    for (let i = 0; i < 6; i++) {
      const mat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0xffd166,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
        })
      );
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.shockwaveRings.push({
        mesh,
        mat,
        age: 0,
        maxAge: 0.7,
        maxScale: 8,
        active: false,
      });
    }

    // Projectile pool (up to 4 concurrent soaring cannonballs in the sky)
    const shellGeo = this.track(new THREE.SphereGeometry(0.36, 14, 12));
    const shellMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x1e1e22,
        emissive: 0xff5a1f,
        emissiveIntensity: 1.8,
        roughness: 0.35,
        metalness: 0.8,
        fog: false,
      })
    );
    const coronaGeo = this.track(new THREE.SphereGeometry(0.72, 12, 10));
    const coronaMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xff9f1c,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        fog: false,
      })
    );

    for (let i = 0; i < 4; i++) {
      const pg = new THREE.Group();
      pg.visible = false;
      pg.add(new THREE.Mesh(shellGeo, shellMat));
      pg.add(new THREE.Mesh(coronaGeo, coronaMat));
      this.group.add(pg);
      this.projectiles.push({
        group: pg,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        trailTimer: 0,
        startX: 0,
        startZ: 0,
        active: false,
      });
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    maxAge: number,
    baseOpacity: number = 0.85,
    gravity: number = 0
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.maxAge = maxAge;
        p.startScale = startScale;
        p.endScale = endScale;
        p.baseOpacity = baseOpacity;
        p.gravity = gravity;
        p.vel.set(vx, vy, vz);
        p.mat.color.setHex(colorHex);
        p.mat.opacity = baseOpacity;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(startScale);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private spawnShockwaveRing(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    maxScale: number,
    maxAge: number,
    rotX: number = Math.PI / 2,
    rotY: number = 0
  ) {
    for (let i = 0; i < this.shockwaveRings.length; i++) {
      const r = this.shockwaveRings[i];
      if (!r.active) {
        r.active = true;
        r.age = 0;
        r.maxAge = maxAge;
        r.maxScale = maxScale;
        r.mat.color.setHex(colorHex);
        r.mat.opacity = 0.92;
        r.mesh.position.set(x, y, z);
        r.mesh.rotation.set(rotX, rotY, 0);
        r.mesh.scale.setScalar(0.5);
        r.mesh.visible = true;
        return;
      }
    }
  }

  public isSultanNear(pos: THREE.Vector3, maxDist: number = 6.0): boolean {
    return Math.hypot(pos.x - this.origin.x, pos.z - this.origin.z) <= maxDist;
  }

  public rotateAim(deltaYaw: number) {
    this.cannonYaw += deltaYaw;
    if (this.carriageGroup) {
      this.carriageGroup.rotation.y = this.cannonYaw;
    }
  }

  public fire(): boolean {
    if (this.cooldownRemaining > 0) return false;

    this.cooldownRemaining = this.cooldownDuration;
    this.muzzleGlowTimer = 0.45;
    this.recoilOffset = -0.68;
    this.recoilVel = 1.65;
    this.wheelSpinOffset = -0.9;

    this.group.updateMatrixWorld(true);
    this.muzzleTipAnchor.getWorldPosition(_muzzleWorldPos);

    // Exact skyward-forward launch direction from cannon yaw & elevation
    const cosEl = Math.cos(this.elevationAngle);
    const sinEl = Math.sin(this.elevationAngle);
    _launchDir.set(
      Math.sin(this.cannonYaw) * cosEl,
      sinEl,
      Math.cos(this.cannonYaw) * cosEl
    ).normalize();

    // Launch projectile high & far into the sky
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) {
        proj.active = true;
        proj.age = 0;
        proj.trailTimer = 0;
        proj.startX = _muzzleWorldPos.x;
        proj.startZ = _muzzleWorldPos.z;
        proj.pos.copy(_muzzleWorldPos);
        proj.vel.copy(_launchDir).multiplyScalar(this.launchSpeed);
        proj.group.position.copy(proj.pos);
        proj.group.visible = true;
        break;
      }
    }

    // Muzzle blast flash, shockwave & heavy gunpowder smoke cloud
    this.spawnParticle(
      _muzzleWorldPos.x,
      _muzzleWorldPos.y,
      _muzzleWorldPos.z,
      _launchDir.x * 5,
      _launchDir.y * 5,
      _launchDir.z * 5,
      0xfff3b0,
      1.35,
      3.2,
      0.24,
      0.98,
      0
    );

    this.spawnShockwaveRing(
      _muzzleWorldPos.x + _launchDir.x * 0.5,
      _muzzleWorldPos.y + _launchDir.y * 0.5,
      _muzzleWorldPos.z + _launchDir.z * 0.5,
      0xffb703,
      5.2,
      0.48,
      -this.elevationAngle,
      this.cannonYaw
    );

    // Billowing white/grey cannon smoke clouds & fiery sparks bursting forward
    for (let s = 0; s < 16; s++) {
      const spread = 1.0 + Math.random() * 5.0;
      const rx = (Math.random() - 0.5) * 4.5;
      const ry = (Math.random() - 0.25) * 3.8 + 1.2;
      const rz = (Math.random() - 0.5) * 4.5;
      const smokeCol = s < 5 ? 0xf8f9fa : s < 11 ? 0xd1d5db : 0x9ca3af;
      this.spawnParticle(
        _muzzleWorldPos.x + (Math.random() - 0.5) * 0.4,
        _muzzleWorldPos.y + (Math.random() - 0.5) * 0.4,
        _muzzleWorldPos.z + (Math.random() - 0.5) * 0.4,
        _launchDir.x * spread + rx,
        _launchDir.y * spread + ry,
        _launchDir.z * spread + rz,
        smokeCol,
        0.55 + Math.random() * 0.35,
        2.6 + Math.random() * 1.4,
        1.1 + Math.random() * 0.85,
        0.78,
        -0.5
      );
    }

    for (let e = 0; e < 12; e++) {
      const spd = 8 + Math.random() * 14;
      this.spawnParticle(
        _muzzleWorldPos.x,
        _muzzleWorldPos.y,
        _muzzleWorldPos.z,
        _launchDir.x * spd + (Math.random() - 0.5) * 6,
        _launchDir.y * spd + (Math.random() - 0.5) * 6,
        _launchDir.z * spd + (Math.random() - 0.5) * 6,
        e % 2 === 0 ? 0xff7b00 : 0xffd166,
        0.16,
        0.04,
        0.42 + Math.random() * 0.28,
        0.98,
        12.0
      );
    }

    soundManager.playCannonBlast();
    return true;
  }

  private triggerDistantExplosion(x: number, y: number, z: number) {
    const expY = Math.max(0.6, y);
    const hitSea = x < -60 && y <= 0.5;
    // Bright massive fireball core & outer orange blast visible across the sky/horizon
    this.spawnParticle(x, expY, z, 0, 2.5, 0, hitSea ? 0xe0f7ff : 0xfff8cc, 3.2, 13.5, 0.72, 1.0, 0);
    this.spawnParticle(x, expY + 1.2, z, 0, 3.5, 0, hitSea ? 0x7dd3fc : 0xff6d00, 4.4, 16.5, 0.95, 0.92, 0);

    this.spawnShockwaveRing(x, expY + 0.5, z, hitSea ? 0xbae6fd : 0xffb703, 22.0, 0.9, Math.PI / 2, 0);
    this.spawnShockwaveRing(x, expY + 0.5, z, 0xff5400, 18.0, 0.75, 0.35, this.cannonYaw);

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const radSpd = 6 + Math.random() * 14;
      const col = hitSea
        ? i % 2 === 0
          ? 0xf0f9ff
          : 0xbae6fd
        : i % 3 === 0
        ? 0xff9e00
        : i % 3 === 1
        ? 0x6b7280
        : 0x374151;
      this.spawnParticle(
        x + (Math.random() - 0.5) * 2.5,
        expY + Math.random() * 2.0,
        z + (Math.random() - 0.5) * 2.5,
        Math.cos(ang) * radSpd,
        4 + Math.random() * 12,
        Math.sin(ang) * radSpd,
        col,
        1.8,
        7.5 + Math.random() * 4.5,
        1.6 + Math.random() * 0.9,
        0.82,
        1.2
      );
    }

    soundManager.playDistantExplosion();
  }

  public update(delta: number, elapsedTime: number) {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
    }

    // Fuse spark flicker at touch-hole when loaded and ready
    if (this.fuseSparkMesh) {
      const ready = this.cooldownRemaining <= 0.1;
      this.fuseSparkMesh.visible = ready;
      if (ready) {
        const s = 0.75 + Math.sin(elapsedTime * 22) * 0.35;
        this.fuseSparkMesh.scale.setScalar(s);
      }
    }

    // Spring-damped recoil & carriage rollback
    if (Math.abs(this.recoilOffset) > 0.001 || Math.abs(this.recoilVel) > 0.001) {
      this.recoilOffset += this.recoilVel * delta;
      this.recoilVel = THREE.MathUtils.damp(this.recoilVel, 0, 5.5, delta);
      this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 4.2, delta);
      this.barrelBodyGroup.position.z = this.recoilOffset * 0.65;
      this.carriageGroup.position.z =
        Math.cos(this.cannonYaw) * this.recoilOffset * 0.32;
      this.carriageGroup.position.x =
        Math.sin(this.cannonYaw) * this.recoilOffset * 0.32;
    } else {
      this.barrelBodyGroup.position.z = 0;
      this.carriageGroup.position.x = 0;
      this.carriageGroup.position.z = 0;
    }

    if (Math.abs(this.wheelSpinOffset) > 0.001) {
      this.wheelSpinOffset = THREE.MathUtils.damp(this.wheelSpinOffset, 0, 4.2, delta);
      for (let i = 0; i < this.wheels.length; i++) {
        this.wheels[i].rotation.x = this.wheelSpinOffset;
      }
    }

    if (this.muzzleGlowTimer > 0) {
      this.muzzleGlowTimer = Math.max(0, this.muzzleGlowTimer - delta);
    }

    // Update soaring sky cannonballs & leave glowing smoke/ember streaks
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      p.age += delta;
      p.vel.y -= this.projectileGravity * delta;
      p.pos.addScaledVector(p.vel, delta);
      p.group.position.copy(p.pos);

      p.trailTimer += delta;
      if (p.trailTimer >= 0.032) {
        p.trailTimer = 0;
        // Fiery ember core + trailing white sky smoke puff along flight arc
        this.spawnParticle(
          p.pos.x,
          p.pos.y,
          p.pos.z,
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4,
          0xff9f1c,
          0.42,
          0.12,
          0.36,
          0.95,
          0
        );
        this.spawnParticle(
          p.pos.x,
          p.pos.y,
          p.pos.z,
          (Math.random() - 0.5) * 1.2,
          0.8 + Math.random() * 1.1,
          (Math.random() - 0.5) * 1.2,
          0xe5e7eb,
          0.62,
          2.8,
          1.45,
          0.62,
          -0.25
        );
      }

      const horizDist = Math.hypot(p.pos.x - p.startX, p.pos.z - p.startZ);
      // Detonate far across the sky/horizon or on impact with distant ground/sea
      if (p.pos.y <= 0.1 || horizDist >= 320 || p.age >= 6.4) {
        p.active = false;
        p.group.visible = false;
        this.triggerDistantExplosion(p.pos.x, p.pos.y, p.pos.z);
      }
    }

    // Update smoke/ember/explosion particles
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      pt.age += delta;
      if (pt.age >= pt.maxAge) {
        pt.active = false;
        pt.mesh.visible = false;
        continue;
      }
      const t = pt.age / pt.maxAge;
      pt.vel.y -= pt.gravity * delta;
      pt.mesh.position.addScaledVector(pt.vel, delta);
      const scale = THREE.MathUtils.lerp(pt.startScale, pt.endScale, t);
      pt.mesh.scale.setScalar(scale);
      pt.mat.opacity = pt.baseOpacity * (1 - t) * (1 - t * 0.35);
    }

    // Update expanding shockwave rings
    for (let i = 0; i < this.shockwaveRings.length; i++) {
      const r = this.shockwaveRings[i];
      if (!r.active) continue;
      r.age += delta;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.age / r.maxAge;
      r.mesh.scale.setScalar(THREE.MathUtils.lerp(0.6, r.maxScale, t));
      r.mat.opacity = 0.92 * (1 - t);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
