import * as THREE from 'three';
import type { RoofVolume } from './kingdomVillage';
import { getCoastlineX } from './sea';

const RAIN_DROP_COUNT = 820;
const SPLASH_COUNT = 110;
const PUDDLE_COUNT = 52;
const VOLUME_HALF_XZ = 24;
const VOLUME_HEIGHT = 22;

const _puddleDummy = new THREE.Object3D();

interface PuddleSlot {
  x: number;
  z: number;
  radius: number;
  stretchX: number;
  stretchZ: number;
  rotY: number;
  active: boolean;
}

/**
 * High-performance procedural Rain, Thunder/Lightning, Indoor Roof Exclusion,
 * and Outdoor Ground Rainwater Puddles (which accumulate during showers and dry up naturally).
 */
export class WeatherSystem {
  public readonly group: THREE.Group;
  public rainIntensity: number = 0; // 0 = clear, 1 = full rain
  public lightningFlash: number = 0; // 0..1 visual sky/light flash
  public groundWetness: number = 0; // 0 = dry ground, 1 = saturated puddles

  private targetRain: number = 0;
  private manualRainOverride: boolean | null = null;
  private nextWeatherSwitchTimer: number;
  private nextAutoThunderTimer: number;

  private flashAge: number = -1;
  private readonly flashDuration: number = 0.58;
  private pendingThunderAudio: boolean = false;

  private rainLines: THREE.LineSegments;
  private rainMat: THREE.LineBasicMaterial;
  private rainGeo: THREE.BufferGeometry;
  private rainPositions: Float32Array;
  private dropCoords: Float32Array; // [x, y, z, len, speedMul] * RAIN_DROP_COUNT

  private splashPoints: THREE.Points;
  private splashMat: THREE.PointsMaterial;
  private splashGeo: THREE.BufferGeometry;
  private splashPositions: Float32Array;
  private splashTimers: Float32Array;
  private splashTex: THREE.CanvasTexture;

  private puddleGeo: THREE.PlaneGeometry;
  private puddleTex: THREE.CanvasTexture;
  private puddleMat: THREE.MeshStandardMaterial;
  private puddleMesh: THREE.InstancedMesh;
  private puddles: PuddleSlot[] = [];
  private lastPuddleWetnessScale: number = -1;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'WeatherSystem';
    scene.add(this.group);

    // Occasional natural rain schedule (first natural shower after ~75-135s)
    this.nextWeatherSwitchTimer = 75 + Math.random() * 60;
    this.nextAutoThunderTimer = 10 + Math.random() * 14;

    // 1. Pre-allocated Rain Streaks LineSegments
    this.rainPositions = new Float32Array(RAIN_DROP_COUNT * 2 * 3);
    this.dropCoords = new Float32Array(RAIN_DROP_COUNT * 5);

    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      const rx = (Math.random() * 2 - 1) * VOLUME_HALF_XZ;
      const ry = Math.random() * VOLUME_HEIGHT;
      const rz = (Math.random() * 2 - 1) * VOLUME_HALF_XZ;
      const len = 0.65 + Math.random() * 0.48;
      const speedMul = 0.85 + Math.random() * 0.35;

      const cIdx = i * 5;
      this.dropCoords[cIdx] = rx;
      this.dropCoords[cIdx + 1] = ry;
      this.dropCoords[cIdx + 2] = rz;
      this.dropCoords[cIdx + 3] = len;
      this.dropCoords[cIdx + 4] = speedMul;
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xd4e9ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.group.add(this.rainLines);

    // 2. Ground Splash Droplets Points
    this.splashPositions = new Float32Array(SPLASH_COUNT * 3);
    this.splashTimers = new Float32Array(SPLASH_COUNT);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashPositions[i * 3] = (Math.random() * 2 - 1) * 16;
      this.splashPositions[i * 3 + 1] = -50;
      this.splashPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 16;
      this.splashTimers[i] = Math.random();
    }

    this.splashGeo = new THREE.BufferGeometry();
    this.splashGeo.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));

    this.splashTex = this.createSplashTexture();
    this.splashMat = new THREE.PointsMaterial({
      map: this.splashTex,
      color: 0xdbeafe,
      size: 0.36,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.splashPoints = new THREE.Points(this.splashGeo, this.splashMat);
    this.splashPoints.frustumCulled = false;
    this.splashPoints.visible = false;
    this.group.add(this.splashPoints);

    // 3. Outdoor Ground Rainwater Puddles (single InstancedMesh draw call)
    this.puddleGeo = new THREE.PlaneGeometry(1, 1);
    this.puddleGeo.rotateX(-Math.PI / 2);
    this.puddleTex = this.createPuddleTexture();
    this.puddleMat = new THREE.MeshStandardMaterial({
      map: this.puddleTex,
      color: 0x5c859e,
      roughness: 0.08,
      metalness: 0.38,
      envMapIntensity: 1.15,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.puddleMesh = new THREE.InstancedMesh(this.puddleGeo, this.puddleMat, PUDDLE_COUNT);
    this.puddleMesh.frustumCulled = false;
    this.puddleMesh.receiveShadow = true;
    this.puddleMesh.visible = false;

    for (let i = 0; i < PUDDLE_COUNT; i++) {
      this.puddles.push({
        x: 0,
        z: 0,
        radius: 1.8 + Math.random() * 2.1,
        stretchX: 0.85 + Math.random() * 0.48,
        stretchZ: 0.82 + Math.random() * 0.45,
        rotY: Math.random() * Math.PI * 2,
        active: false,
      });
      _puddleDummy.position.set(0, -50, 0);
      _puddleDummy.scale.set(0, 0, 0);
      _puddleDummy.updateMatrix();
      this.puddleMesh.setMatrixAt(i, _puddleDummy.matrix);
    }
    this.puddleMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.puddleMesh);
  }

  private createSplashTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(220, 238, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(32, 32, 5, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createPuddleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    // Organic overlapping lobes to form a natural irregular rainwater puddle silhouette
    const lobes = [
      { x: 64, y: 64, rx: 44, ry: 34, rot: 0.2 },
      { x: 46, y: 58, rx: 28, ry: 22, rot: -0.4 },
      { x: 84, y: 70, rx: 26, ry: 20, rot: 0.5 },
      { x: 60, y: 80, rx: 24, ry: 18, rot: 0.1 },
    ];

    // Subtle damp dark perimeter ring where soil/stone absorbs the puddle edge
    for (const l of lobes) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(1, l.ry / l.rx);
      const dampGrad = ctx.createRadialGradient(0, 0, l.rx * 0.55, 0, 0, l.rx);
      dampGrad.addColorStop(0, 'rgba(30, 52, 68, 0.25)');
      dampGrad.addColorStop(0.78, 'rgba(22, 38, 48, 0.34)');
      dampGrad.addColorStop(1, 'rgba(22, 38, 48, 0)');
      ctx.fillStyle = dampGrad;
      ctx.beginPath();
      ctx.arc(0, 0, l.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Translucent glossy rainwater pool core
    for (const l of lobes) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(1, l.ry / l.rx);
      const waterGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, l.rx * 0.86);
      waterGrad.addColorStop(0, 'rgba(130, 182, 214, 0.72)');
      waterGrad.addColorStop(0.68, 'rgba(98, 152, 186, 0.58)');
      waterGrad.addColorStop(0.92, 'rgba(65, 112, 142, 0.28)');
      waterGrad.addColorStop(1, 'rgba(65, 112, 142, 0)');
      ctx.fillStyle = waterGrad;
      ctx.beginPath();
      ctx.arc(0, 0, l.rx * 0.86, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Soft sky-glint highlight arc
    ctx.strokeStyle = 'rgba(224, 244, 255, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(62, 60, 19, 11, 0.2, 0.15, 2.1);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Returns the highest roof Y covering (wx, wz) or -1 if open to the sky.
   */
  public getRoofHeightAt(
    wx: number,
    wz: number,
    roofVolumes?: RoofVolume[],
    margin: number = 0
  ): number {
    if (!roofVolumes || roofVolumes.length === 0) return -1;
    let highest = -1;
    for (let i = 0; i < roofVolumes.length; i++) {
      const rv = roofVolumes[i];
      const dx = wx - rv.cx;
      const dz = wz - rv.cz;
      const limit = rv.boundR + margin;
      if (Math.abs(dx) > limit || Math.abs(dz) > limit) continue;
      const lx = dx * rv.cosY + dz * rv.sinY;
      const lz = -dx * rv.sinY + dz * rv.cosY;
      if (Math.abs(lx) <= rv.halfW + margin && Math.abs(lz) <= rv.halfD + margin) {
        if (rv.roofY > highest) highest = rv.roofY;
      }
    }
    return highest;
  }

  /**
   * True when an entity (e.g., Sultan) stands beneath an overhead roof (e.g., inside Palace, Cafe, Prison, or Ground Portico).
   * Returns false when standing outdoors on top of the open-air 2nd-floor Overlook Balcony.
   */
  public isPositionUnderRoof(pos: THREE.Vector3, roofVolumes?: RoofVolume[]): boolean {
    const roofY = this.getRoofHeightAt(pos.x, pos.z, roofVolumes, 0);
    return roofY > pos.y + 0.6;
  }

  private isValidOutdoorGroundSpot(
    x: number,
    z: number,
    roofVolumes?: RoofVolume[],
    margin: number = 1.15
  ): boolean {
    if (Math.hypot(x, z) > 82.0) return false;
    if (x < getCoastlineX(z) + 5.0) return false;
    // Keep out of the hollow Royal Well center
    if (Math.hypot(x, z + 9.5) < 2.6) return false;
    if (this.getRoofHeightAt(x, z, roofVolumes, margin) > 0) return false;
    return true;
  }

  public isRaining(): boolean {
    return this.targetRain > 0.5;
  }

  public setRainEnabled(enabled: boolean) {
    this.manualRainOverride = enabled;
    this.targetRain = enabled ? 1 : 0;
    if (enabled) {
      this.nextAutoThunderTimer = Math.min(this.nextAutoThunderTimer, 6 + Math.random() * 8);
    }
  }

  public toggleManualRain(): boolean {
    const next = !this.isRaining();
    this.setRainEnabled(next);
    return next;
  }

  public triggerThunder() {
    this.flashAge = 0;
    this.lightningFlash = 1.0;
    this.pendingThunderAudio = true;
  }

  public consumeThunderTrigger(): boolean {
    if (this.pendingThunderAudio) {
      this.pendingThunderAudio = false;
      return true;
    }
    return false;
  }

  public update(delta: number, playerPos: THREE.Vector3, roofVolumes?: RoofVolume[]) {
    // 1. Natural Weather Cycle (when not manually locked)
    if (this.manualRainOverride === null) {
      this.nextWeatherSwitchTimer -= delta;
      if (this.nextWeatherSwitchTimer <= 0) {
        if (this.targetRain < 0.5) {
          this.targetRain = 1;
          this.nextWeatherSwitchTimer = 38 + Math.random() * 28; // Rain lasts 38-66s
          this.nextAutoThunderTimer = 7 + Math.random() * 10;
        } else {
          this.targetRain = 0;
          this.nextWeatherSwitchTimer = 95 + Math.random() * 85; // Clear sky 95-180s
        }
      }
    }

    // 2. Smooth Rain Transition
    this.rainIntensity = THREE.MathUtils.damp(this.rainIntensity, this.targetRain, 1.35, delta);
    if (this.rainIntensity < 0.004 && this.targetRain === 0) {
      this.rainIntensity = 0;
    }

    // 3. Occasional Thunder & Lightning during active rain
    if (this.rainIntensity > 0.55) {
      this.nextAutoThunderTimer -= delta;
      if (this.nextAutoThunderTimer <= 0) {
        this.triggerThunder();
        this.nextAutoThunderTimer = 14 + Math.random() * 16;
      }
    }

    // 4. Lightning Flash Envelope (double-strike flicker)
    if (this.flashAge >= 0) {
      this.flashAge += delta;
      const t = this.flashAge / this.flashDuration;
      if (t >= 1) {
        this.flashAge = -1;
        this.lightningFlash = 0;
      } else if (t < 0.14) {
        this.lightningFlash = 1.0 - (t / 0.14) * 0.65;
      } else if (t < 0.24) {
        this.lightningFlash = 0.35 + ((t - 0.14) / 0.1) * 0.58;
      } else {
        const decay = (t - 0.24) / 0.76;
        this.lightningFlash = 0.93 * (1 - decay) * (1 - decay);
      }
    } else {
      this.lightningFlash = 0;
    }

    // 5. Outdoor Rainwater Puddle Accumulation & Evaporation Lifecycle
    if (this.rainIntensity > 0.22) {
      // Accumulates gradually over ~13s of steady rain
      this.groundWetness = Math.min(1, this.groundWetness + delta * 0.078 * this.rainIntensity);
    } else if (this.targetRain < 0.5) {
      // Dries up naturally over ~32s after rain stops
      this.groundWetness = Math.max(0, this.groundWetness - delta * 0.031);
    }

    const showPuddles = this.groundWetness > 0.005;
    this.puddleMesh.visible = showPuddles;
    if (showPuddles) {
      const wetnessScale = Math.min(1, Math.pow(this.groundWetness, 0.7) * 1.08);
      this.puddleMat.opacity = Math.min(0.72, this.groundWetness * 0.88);
      let anyRelocated = false;

      for (let i = 0; i < PUDDLE_COUNT; i++) {
        const p = this.puddles[i];
        const distSq = (p.x - playerPos.x) * (p.x - playerPos.x) + (p.z - playerPos.z) * (p.z - playerPos.z);

        // Spawn/relocate outdoor puddles around the player while it is actively raining
        if (this.rainIntensity > 0.25 && (!p.active || distSq > 54 * 54)) {
          for (let attempt = 0; attempt < 6; attempt++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = 5.0 + Math.random() * 38.0;
            const px = playerPos.x + Math.cos(ang) * rad;
            const pz = playerPos.z + Math.sin(ang) * rad;
            if (this.isValidOutdoorGroundSpot(px, pz, roofVolumes, 1.35)) {
              p.x = px;
              p.z = pz;
              p.active = true;
              anyRelocated = true;
              break;
            }
          }
        }
      }

      if (anyRelocated || Math.abs(wetnessScale - this.lastPuddleWetnessScale) > 0.012) {
        this.lastPuddleWetnessScale = wetnessScale;
        for (let i = 0; i < PUDDLE_COUNT; i++) {
          const p = this.puddles[i];
          if (p.active) {
            const sx = p.radius * p.stretchX * wetnessScale;
            const sz = p.radius * p.stretchZ * wetnessScale;
            _puddleDummy.position.set(p.x, 0.022, p.z);
            _puddleDummy.rotation.set(0, p.rotY, 0);
            _puddleDummy.scale.set(sx, 1, sz);
          } else {
            _puddleDummy.position.set(0, -50, 0);
            _puddleDummy.scale.set(0, 0, 0);
          }
          _puddleDummy.updateMatrix();
          this.puddleMesh.setMatrixAt(i, _puddleDummy.matrix);
        }
        this.puddleMesh.instanceMatrix.needsUpdate = true;
      }
    } else if (this.puddles[0]?.active) {
      for (let i = 0; i < PUDDLE_COUNT; i++) {
        this.puddles[i].active = false;
      }
      this.lastPuddleWetnessScale = -1;
    }

    // 6. Rain Particle Motion around player (strictly excluded from inside buildings & roofs)
    const showRain = this.rainIntensity > 0.015;
    this.rainLines.visible = showRain;
    this.splashPoints.visible = showRain;
    if (!showRain) return;

    this.rainMat.opacity = this.rainIntensity * 0.54;
    this.splashMat.opacity = this.rainIntensity * 0.42;

    const windVx = -3.6;
    const windVz = 1.5;
    const baseFallSpeed = 23.0;
    const cx = playerPos.x;
    const cz = playerPos.z;
    const spanXZ = VOLUME_HALF_XZ * 2;
    const onOpenBalcony =
      playerPos.y >= 4.2 &&
      Math.abs(playerPos.x) <= 17.6 &&
      playerPos.z >= -30.5 &&
      playerPos.z <= -26.4;

    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      const cIdx = i * 5;
      let rx = this.dropCoords[cIdx] + windVx * delta;
      let ry = this.dropCoords[cIdx + 1] - baseFallSpeed * this.dropCoords[cIdx + 4] * delta;
      let rz = this.dropCoords[cIdx + 2] + windVz * delta;
      const len = this.dropCoords[cIdx + 3];

      if (ry < 0) {
        ry += VOLUME_HEIGHT;
        rx = (Math.random() * 2 - 1) * VOLUME_HALF_XZ;
        rz = (Math.random() * 2 - 1) * VOLUME_HALF_XZ;
      }
      if (rx < -VOLUME_HALF_XZ) rx += spanXZ;
      else if (rx > VOLUME_HALF_XZ) rx -= spanXZ;
      if (rz < -VOLUME_HALF_XZ) rz += spanXZ;
      else if (rz > VOLUME_HALF_XZ) rz -= spanXZ;

      this.dropCoords[cIdx] = rx;
      this.dropCoords[cIdx + 1] = ry;
      this.dropCoords[cIdx + 2] = rz;

      const wx = cx + rx;
      const wz = cz + rz;
      const roofY = this.getRoofHeightAt(wx, wz, roofVolumes, 0.08);
      const pIdx = i * 6;

      if (roofY > 0 && ry <= roofY + 0.05) {
        // Streak is underneath a roof/inside a house or palace: collapse segment so zero rain renders indoors
        this.rainPositions[pIdx] = wx;
        this.rainPositions[pIdx + 1] = -50;
        this.rainPositions[pIdx + 2] = wz;
        this.rainPositions[pIdx + 3] = wx;
        this.rainPositions[pIdx + 4] = -50;
        this.rainPositions[pIdx + 5] = wz;
      } else {
        const minTipY = roofY > 0 ? roofY : 0;
        const bx = wx + windVx * (len / baseFallSpeed);
        const by = Math.max(minTipY, ry - len);
        const bz = wz + windVz * (len / baseFallSpeed);

        this.rainPositions[pIdx] = wx;
        this.rainPositions[pIdx + 1] = ry;
        this.rainPositions[pIdx + 2] = wz;
        this.rainPositions[pIdx + 3] = bx;
        this.rainPositions[pIdx + 4] = by;
        this.rainPositions[pIdx + 5] = bz;
      }
    }
    this.rainGeo.attributes.position.needsUpdate = true;

    // 7. Ground & Puddle Splashes strictly outdoors (zero splashes inside houses/palace/cafe/prison)
    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashTimers[i] -= delta * 4.2;
      if (this.splashTimers[i] <= 0) {
        this.splashTimers[i] = 0.4 + Math.random() * 0.6;

        let sx = cx + (Math.random() * 2 - 1) * 16;
        let sz = cz + (Math.random() * 2 - 1) * 16;
        let sy = 0.04;

        if (
          onOpenBalcony &&
          i % 4 === 0 &&
          Math.abs(sx) <= 17.3 &&
          sz >= -30.2 &&
          sz <= -26.6
        ) {
          // Raindrop splashes visibly on the open-air 2nd-floor Overlook Balcony
          sy = 4.55;
        } else {
          // Ensure ground splash lands outside roofs & inland on roads/grass/puddles
          let valid = false;
          for (let attempt = 0; attempt < 4; attempt++) {
            if (
              sx >= getCoastlineX(sz) - 0.5 &&
              this.getRoofHeightAt(sx, sz, roofVolumes, 0.25) < 0
            ) {
              valid = true;
              break;
            }
            sx = cx + (Math.random() * 2 - 1) * 16;
            sz = cz + (Math.random() * 2 - 1) * 16;
          }
          if (!valid) {
            sy = -50;
          }
        }

        this.splashPositions[i * 3] = sx;
        this.splashPositions[i * 3 + 1] = sy;
        this.splashPositions[i * 3 + 2] = sz;
      }
    }
    this.splashGeo.attributes.position.needsUpdate = true;
  }

  public dispose() {
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
    this.splashTex.dispose();
    this.puddleGeo.dispose();
    this.puddleMat.dispose();
    this.puddleTex.dispose();
    this.group.parent?.remove(this.group);
  }
}
