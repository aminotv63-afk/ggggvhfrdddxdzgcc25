import * as THREE from 'three';
import { createSmokeParticleTexture } from './textures';
import { soundManager } from './audio';
import { getCoastlineX } from './sea';

const _zAxis = new THREE.Vector3(0, 0, 1);
const _zSpinQuat = new THREE.Quaternion();

export class FogBoundary {
  public group: THREE.Group;
  public readonly radius: number;
  private smokeMesh: THREE.InstancedMesh;
  private wallMesh: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private time = 0;
  private particleCount = 96;
  private landAngles: Float32Array;
  private landCos: Float32Array;
  private landSin: Float32Array;
  private disposables: { dispose: () => void }[] = [];
  private lastBumpSound = 0;
  private wallMat!: THREE.MeshBasicMaterial;
  private outerWallMat!: THREE.MeshBasicMaterial;
  private puffMat!: THREE.MeshBasicMaterial;

  constructor(radius: number = 62) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'FogBoundary';

    this.landAngles = new Float32Array(this.particleCount);
    this.landCos = new Float32Array(this.particleCount);
    this.landSin = new Float32Array(this.particleCount);

    const smokeTex = createSmokeParticleTexture();
    this.disposables.push(smokeTex);

    // Alpha mask along cylinder U so fog barrier thins gently over the Western Sea horizon
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = 256;
    alphaCanvas.height = 4;
    const actx = alphaCanvas.getContext('2d')!;
    const seaCutAngles: number[] = [];
    for (let i = 0; i < 256; i++) {
      // Three.js CylinderGeometry U=0 aligns with +Z (theta = u * 2*PI -> x = sin(theta), z = cos(theta))
      const theta = (i / 256) * Math.PI * 2;
      const px = Math.sin(theta) * radius;
      const pz = Math.cos(theta) * radius;
      const d = px - getCoastlineX(pz);
      const landFactor = Math.max(0.08, Math.min(1.0, (d + 8.0) / 14.0));
      const v = Math.round(landFactor * 255);
      actx.fillStyle = `rgb(${v},${v},${v})`;
      actx.fillRect(i, 0, 1, 4);
      if (d > -2.0) seaCutAngles.push(Math.atan2(pz, px));
    }
    const alphaTex = new THREE.CanvasTexture(alphaCanvas);
    alphaTex.wrapS = THREE.RepeatWrapping;
    this.disposables.push(alphaTex);

    // Precompute exact land boundary arc angles once for per-frame smoke updates
    let landSlot = 0;
    for (let i = 0; i < this.particleCount; i++) {
      let baseAngle = (i / this.particleCount) * Math.PI * 2;
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = ((landSlot++ % 160) / 160) * Math.PI * 2;
        const cx = Math.cos(candidate) * radius;
        const cz = Math.sin(candidate) * radius;
        if (cx >= getCoastlineX(cz) - 1.5) {
          baseAngle = candidate;
          break;
        }
      }
      this.landAngles[i] = baseAngle;
      this.landCos[i] = Math.cos(baseAngle);
      this.landSin[i] = Math.sin(baseAngle);
    }

    // 1. Ethereal Cylindrical Mist Wall (Translucent smoke veil on land, open horizon over sea)
    const wallGeo = new THREE.CylinderGeometry(radius, radius, 7.5, 64, 1, true);
    this.wallMat = new THREE.MeshBasicMaterial({
      color: 0xcbd8e2,
      transparent: true,
      opacity: 0.36,
      alphaMap: alphaTex,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(wallGeo, this.wallMat);

    this.wallMesh = new THREE.Mesh(wallGeo, this.wallMat);
    this.wallMesh.position.y = 3.75;
    this.wallMesh.updateMatrix();
    this.wallMesh.matrixAutoUpdate = false;
    this.group.add(this.wallMesh);

    // 2. Secondary outer dense fog wall around land perimeter
    const outerWallGeo = new THREE.CylinderGeometry(radius + 1.8, radius + 1.8, 9.5, 64, 1, true);
    this.outerWallMat = new THREE.MeshBasicMaterial({
      color: 0xbfd0de,
      transparent: true,
      opacity: 0.52,
      alphaMap: alphaTex,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(outerWallGeo, this.outerWallMat);
    const outerWallMesh = new THREE.Mesh(outerWallGeo, this.outerWallMat);
    outerWallMesh.position.y = 4.75;
    outerWallMesh.updateMatrix();
    outerWallMesh.matrixAutoUpdate = false;
    this.group.add(outerWallMesh);

    // 3. Instanced billboard smoke puffs circling the land boundary (Single draw call)
    const puffGeo = new THREE.PlaneGeometry(7.0, 7.0);
    this.puffMat = new THREE.MeshBasicMaterial({
      map: smokeTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.disposables.push(puffGeo, this.puffMat);

    this.smokeMesh = new THREE.InstancedMesh(puffGeo, this.puffMat, this.particleCount);
    this.smokeMesh.frustumCulled = false;

    for (let i = 0; i < this.particleCount; i++) {
      const angIndex = Math.floor((i / this.particleCount) * seaCutAngles.length);
      const angle = seaCutAngles[angIndex] ?? (i / this.particleCount) * Math.PI * 2;
      const r = radius - 0.5 + (Math.random() - 0.5) * 1.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = 1.0 + Math.random() * 2.5;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.z = Math.random() * Math.PI * 2;
      const s = 1.0 + Math.random() * 0.6;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();

      this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.smokeMesh);
  }

  /**
   * Updates smoke movement and makes billboards face camera
   */
  public update(delta: number, camera: THREE.Camera) {
    this.time += delta;

    // Billboard alignment for instanced smoke puffs around precomputed land arc
    const camQuat = camera.quaternion;
    const t = this.time;
    const rBase = this.radius - 0.5;
    for (let i = 0; i < this.particleCount; i++) {
      const r = rBase + Math.sin(t * 0.6 + i) * 0.8;
      const x = this.landCos[i] * r;
      const z = this.landSin[i] * r;
      const y = 1.6 + Math.sin(t * 0.8 + i * 2) * 0.6;

      this.dummy.position.set(x, y, z);
      this.dummy.quaternion.copy(camQuat);
      _zSpinQuat.setFromAxisAngle(_zAxis, Math.sin(t * 0.5 + i) * 0.3);
      this.dummy.quaternion.multiply(_zSpinQuat);
      const s = 1.1 + Math.sin(t + i) * 0.2;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();

      this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Hard collision clamp so player cannot leave map
   * Returns proximity (0 to 1) for UI feedback
   */
  public enforceBoundary(pos: THREE.Vector3): { isBlocked: boolean; proximity: number } {
    const dist = Math.hypot(pos.x, pos.z);
    const maxAllowed = this.radius - 3.0;

    let isBlocked = false;
    let proximity = 0;

    if (dist >= this.radius - 7.5) {
      proximity = Math.min(1.0, (dist - (this.radius - 7.5)) / 4.5);
    }

    if (dist >= maxAllowed) {
      isBlocked = true;
      // Clamp strictly within perimeter fence & fog boundary
      const factor = maxAllowed / dist;
      pos.x *= factor;
      pos.z *= factor;

      // Play audio cue with throttle
      const now = performance.now();
      if (now - this.lastBumpSound > 750) {
        this.lastBumpSound = now;
        soundManager.playBoundaryBump();
      }
    }

    return { isBlocked, proximity };
  }

  public setAtmosphere(fogColor: THREE.Color, nightFactor: number) {
    this.wallMat.color.copy(fogColor);
    this.outerWallMat.color.copy(fogColor);
    this.puffMat.color.copy(fogColor);
    this.puffMat.opacity = 0.4 - nightFactor * 0.14;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
