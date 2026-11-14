import * as THREE from 'three';
import { OBBCollider } from './kingdomVillage';
import { createBeachSandTexture, createWoodPlankTexture } from './textures';

const _shallowDayCol = new THREE.Color(0x28b8c9);
const _midDayCol = new THREE.Color(0x0c7ba8);
const _deepDayCol = new THREE.Color(0x083b66);
const _shallowNightCol = new THREE.Color(0x0d3247);
const _midNightCol = new THREE.Color(0x061f36);
const _deepNightCol = new THREE.Color(0x030e1c);

/**
 * Shared coastline curve along the Western border of the Kingdom.
 * Returns the X coordinate of the waterline (y = -0.18) for a given Z.
 * Everything west of this curve (x < getCoastlineX(z)) is the open Sea!
 */
export function getCoastlineX(z: number): number {
  return -61.5 + Math.sin(z * 0.048) * 3.8 + Math.cos(z * 0.095) * 1.4;
}

/**
 * Smooth ground elevation profile transitioning from flat kingdom grass (y = 0)
 * across a golden sandy beach down to the underwater seabed.
 */
export function getCoastGroundHeight(x: number, z: number): number {
  const shoreX = getCoastlineX(z);
  const d = x - shoreX; // > 0 is inland, 0 is waterline, < 0 is seabed

  if (d >= 5.2) return 0;

  if (d >= 0) {
    // Smooth rise onto low sandy berm (+0.04 at d ~ 2.6) then gentle slope to waterline (-0.18 at d = 0)
    if (d >= 2.6) {
      const t = (d - 2.6) / 2.6; // 0 -> 1
      const s = t * t * (3 - 2 * t);
      return 0.04 * (1 - s);
    }
    const t = d / 2.6; // 0 (waterline) -> 1 (berm)
    const s = t * t * (3 - 2 * t);
    return -0.18 + 0.22 * s;
  }

  // Underwater seabed slope from -0.18 down to -2.2
  const depthT = Math.min(1, -d / 16.0);
  const s = depthT * depthT * (3 - 2 * depthT);
  return -0.18 - 2.02 * s;
}

export class RoyalSea {
  public group: THREE.Group;
  public readonly pierCenterZ: number = 3.5;
  public readonly pierStartX: number;
  public readonly pierEndX: number;

  public boatPos = new THREE.Vector3(-68.5, -0.06, 6.9);
  public boatHeading: number = 0.28;
  public boatSpeed: number = 0;
  public isBoatOccupied: boolean = false;

  private disposables: { dispose: () => void }[] = [];
  private waterMaterial!: THREE.ShaderMaterial;
  private boatGroup: THREE.Group | null = null;
  private boatSeatAnchor: THREE.Object3D = new THREE.Object3D();
  private guardSeatAnchorR: THREE.Object3D = new THREE.Object3D();
  private guardSeatAnchorL: THREE.Object3D = new THREE.Object3D();
  private rudderPivot: THREE.Group | null = null;
  private oarPivotR: THREE.Group | null = null;
  private oarPivotL: THREE.Group | null = null;
  private oarSplashR: THREE.Mesh | null = null;
  private oarSplashL: THREE.Mesh | null = null;
  private oarSplashMat!: THREE.MeshBasicMaterial;
  private rowCycle: number = 0;
  private rowBlend: number = 0;
  private oarStowBlend: number = 1;
  private wakeMeshes: THREE.Mesh[] = [];
  private wakeMat!: THREE.MeshBasicMaterial;
  private mooringRope: THREE.Mesh | null = null;
  private boatBaseX: number = -68.5;
  private boatBaseZ: number = 6.9;
  private boatTurnVisual: number = 0;
  private lanternFlames: THREE.Mesh[] = [];
  private sailMesh: THREE.Mesh | null = null;

  constructor(targetBoxColliders?: OBBCollider[]) {
    this.group = new THREE.Group();
    this.group.name = 'RoyalWesternSea';

    const coastAtPier = getCoastlineX(this.pierCenterZ); // ~ -59.55
    this.pierStartX = coastAtPier + 2.3; // ~ -57.25 (on dry sand meeting cobble road)
    this.pierEndX = coastAtPier - 11.8; // ~ -71.35 (over shallow-deep water)

    this.buildSandyShoreAndSeabed();
    this.buildAnimatedOceanSurface();
    this.buildHarborPier(targetBoxColliders);
    this.buildMooredRoyalBoat();
    this.buildCoastalBoulders(targetBoxColliders);
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildSandyShoreAndSeabed() {
    const sandTex = this.track(createBeachSandTexture());

    // Build a custom high-resolution contoured ribbon hugging getCoastlineX(z)
    // z spans [-235..+235] so it extends seamlessly into the horizon fog
    const zMin = -235;
    const zMax = 235;
    const zSegs = 136;

    // Cross-shore offsets d = x - shoreX(z), from inland grass edge (+6.5) out to deep seabed (-185)
    const dOffsets = [
      6.5, 4.6, 3.2, 2.1, 1.1, 0.3, -0.4, -1.4, -3.0, -5.5, -9.5, -16.0, -32.0, -85.0, -185.0,
    ];
    const xCols = dOffsets.length;
    const vertCount = (zSegs + 1) * xCols;

    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const colors = new Float32Array(vertCount * 3);

    const cGrassBlend = new THREE.Color(0x8bb064);
    const cDrySand = new THREE.Color(0xf6e6be);
    const cWetSand = new THREE.Color(0xb89660);
    const cShallowBed = new THREE.Color(0x529aa0);
    const cDeepBed = new THREE.Color(0x133c59);
    const tmpCol = new THREE.Color();

    let vIdx = 0;
    for (let zi = 0; zi <= zSegs; zi++) {
      const vFrac = zi / zSegs;
      const z = zMin + vFrac * (zMax - zMin);
      const shoreX = getCoastlineX(z);

      for (let xi = 0; xi < xCols; xi++) {
        const d = dOffsets[xi];
        const x = shoreX + d;

        // Elevation: tuck outer edge at d=+6.5 slightly under y=0 so grass seam never Z-fights
        let y: number;
        if (d >= 5.2) {
          y = -0.025;
        } else {
          y = getCoastGroundHeight(x, z) + 0.015;
        }

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[vIdx * 2] = d * 0.05;
        uvs[vIdx * 2 + 1] = vFrac * 18.0;

        if (d > 4.2) {
          tmpCol.copy(cDrySand).lerp(cGrassBlend, Math.min(1, (d - 4.2) / 2.3));
        } else if (d > 1.0) {
          tmpCol.copy(cDrySand);
        } else if (d > -1.0) {
          tmpCol.copy(cWetSand).lerp(cDrySand, (d + 1.0) * 0.5);
        } else if (d > -6.0) {
          tmpCol.copy(cShallowBed).lerp(cWetSand, Math.min(1, (d + 6.0) / 5.0));
        } else {
          tmpCol.copy(cDeepBed).lerp(cShallowBed, Math.max(0, 1 - (-d - 6.0) / 20.0));
        }

        colors[vIdx * 3] = tmpCol.r;
        colors[vIdx * 3 + 1] = tmpCol.g;
        colors[vIdx * 3 + 2] = tmpCol.b;
        vIdx++;
      }
    }

    const indices: number[] = [];
    for (let zi = 0; zi < zSegs; zi++) {
      for (let xi = 0; xi < xCols - 1; xi++) {
        const a = zi * xCols + xi;
        const b = a + 1;
        const c = (zi + 1) * xCols + xi;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const beachGeo = this.track(new THREE.BufferGeometry());
    beachGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    beachGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    beachGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    beachGeo.setIndex(indices);
    beachGeo.computeVertexNormals();

    const beachMat = this.track(
      new THREE.MeshStandardMaterial({
        map: sandTex,
        vertexColors: true,
        roughness: 0.93,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );

    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    beachMesh.receiveShadow = true;
    this.group.add(beachMesh);
  }

  private buildAnimatedOceanSurface() {
    // Non-uniform ocean grid: high vertex density near coast & pier, stretching cleanly to x = -255
    const zMin = -255;
    const zMax = 255;
    const zSegs = 120;

    const dStops = [
      2.2, 0.8, 0.0, -0.8, -1.8, -3.2, -5.0, -7.5, -11.0, -15.5, -21.0, -28.0, -38.0, -52.0,
      -72.0, -100.0, -140.0, -195.0,
    ];
    const xCols = dStops.length;
    const vertCount = (zSegs + 1) * xCols;

    const positions = new Float32Array(vertCount * 3);
    const shoreDistAttr = new Float32Array(vertCount); // negative = seaward distance

    let idx = 0;
    for (let zi = 0; zi <= zSegs; zi++) {
      const z = zMin + (zi / zSegs) * (zMax - zMin);
      const shoreX = getCoastlineX(z);
      for (let xi = 0; xi < xCols; xi++) {
        const d = dStops[xi];
        positions[idx * 3] = shoreX + d;
        positions[idx * 3 + 1] = -0.18;
        positions[idx * 3 + 2] = z;
        shoreDistAttr[idx] = -d; // positive out at sea, negative inland
        idx++;
      }
    }

    const indices: number[] = [];
    for (let zi = 0; zi < zSegs; zi++) {
      for (let xi = 0; xi < xCols - 1; xi++) {
        const a = zi * xCols + xi;
        const b = a + 1;
        const c = (zi + 1) * xCols + xi;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const oceanGeo = this.track(new THREE.BufferGeometry());
    oceanGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    oceanGeo.setAttribute('aShoreDist', new THREE.BufferAttribute(shoreDistAttr, 1));
    oceanGeo.setIndex(indices);

    this.waterMaterial = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: true,
        uniforms: {
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3(0.24, 0.44, -0.86).normalize() },
          uFogColor: { value: new THREE.Color(0xc2d8e8) },
          uFogDensity: { value: 0.0085 },
          uShallowColor: { value: new THREE.Color(0x28b8c9) },
          uMidColor: { value: new THREE.Color(0x0c7ba8) },
          uDeepColor: { value: new THREE.Color(0x083b66) },
          uSkyColor: { value: new THREE.Color(0xa9d4ef) },
          uSpecColor: { value: new THREE.Color(0xfff5d6) },
          uNightFactor: { value: 0.0 },
        },
        vertexShader: `
          attribute float aShoreDist;
          uniform float uTime;
          varying vec3 vWorldPos;
          varying vec3 vViewPos;
          varying float vShoreDist;
          varying float vWaveCrest;

          float waveHeight(vec2 p, float shoreFade, float t) {
            float w1 = sin(p.x * 0.28 + p.y * 0.09 + t * 1.45) * 0.095;
            float w2 = cos(p.x * 0.44 - p.y * 0.22 + t * 1.9) * 0.055;
            float w3 = sin(p.y * 0.36 + p.x * 0.16 - t * 1.25) * 0.04;
            // Gentle surf swash right along the beach edge
            float swash = sin(p.x * 0.85 + t * 2.2) * 0.025;
            return (w1 + w2 + w3) * shoreFade + swash;
          }

          void main() {
            vShoreDist = aShoreDist;
            float shoreFade = smoothstep(-0.6, 5.5, aShoreDist);

            vec3 pos = position;
            float h = waveHeight(pos.xz, shoreFade, uTime);
            pos.y += h;
            vWaveCrest = clamp((h + 0.08) * 3.8, 0.0, 1.0);

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vec4 mvPos = viewMatrix * worldPos;
            vViewPos = mvPos.xyz;
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uSunDir;
          uniform vec3 uFogColor;
          uniform float uFogDensity;
          uniform vec3 uShallowColor;
          uniform vec3 uMidColor;
          uniform vec3 uDeepColor;
          uniform vec3 uSkyColor;
          uniform vec3 uSpecColor;
          uniform float uNightFactor;

          varying vec3 vWorldPos;
          varying vec3 vViewPos;
          varying float vShoreDist;
          varying float vWaveCrest;

          void main() {
            // Fine procedural ripple normal perturbation for sunlit sparkles
            float t = uTime;
            vec2 p = vWorldPos.xz;
            float nx =
              cos(p.x * 0.65 + p.y * 0.32 + t * 2.1) * 0.11 +
              sin(p.x * 1.35 - p.y * 0.78 + t * 2.8) * 0.055;
            float nz =
              sin(p.y * 0.72 - p.x * 0.28 + t * 1.85) * 0.11 +
              cos(p.y * 1.45 + p.x * 0.64 - t * 2.4) * 0.055;
            vec3 normal = normalize(vec3(-nx, 1.0, -nz));

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndotv = max(dot(viewDir, normal), 0.02);
            float fresnel = pow(1.0 - ndotv, 3.2);

            // Depth-based Mediterranean water color gradient
            float midMix = smoothstep(0.5, 9.5, vShoreDist);
            float deepMix = smoothstep(9.0, 36.0, vShoreDist);
            vec3 baseWater = mix(uShallowColor, uMidColor, midMix);
            baseWater = mix(baseWater, uDeepColor, deepMix);

            // Subtle wave crest translucency tint
            baseWater += vec3(0.04, 0.13, 0.14) * vWaveCrest * (1.0 - deepMix * 0.6);

            // Sky reflection via Fresnel
            vec3 waterColor = mix(baseWater, uSkyColor, clamp(fresnel * 0.68, 0.0, 0.65));

            // Crisp solar / lunar specular glints dancing across ripples
            vec3 halfVec = normalize(uSunDir + viewDir);
            float spec = pow(max(dot(normal, halfVec), 0.0), 110.0);
            float broadSpec = pow(max(dot(normal, halfVec), 0.0), 18.0) * 0.16;
            waterColor += uSpecColor * (spec * 1.15 + broadSpec);

            // Animated curling white sea foam along shoreline
            float surfWave = sin(vShoreDist * 3.1 - t * 2.6 + sin(p.y * 0.38) * 1.4);
            float shoreFoamBand = (1.0 - smoothstep(0.0, 2.35, abs(vShoreDist - 0.55)));
            float foamLine = smoothstep(0.25, 0.85, surfWave) * shoreFoamBand;
            float edgeFoam = (1.0 - smoothstep(0.0, 0.65, abs(vShoreDist))) * 0.82;
            // Subtle distant whitecaps on higher crests
            float whitecap = smoothstep(0.76, 0.96, vWaveCrest + sin(p.x * 0.5 + p.y * 0.4 + t * 2.0) * 0.15) * smoothstep(5.0, 20.0, vShoreDist) * 0.25;
            float totalFoam = clamp(max(foamLine * 0.72, edgeFoam) + whitecap, 0.0, 0.92);

            vec3 foamTint = mix(vec3(0.95, 0.98, 1.0), vec3(0.32, 0.42, 0.56), uNightFactor);
            waterColor = mix(waterColor, foamTint, totalFoam);

            // Soft translucent alpha at very edge so water laps gently onto wet sand
            float edgeAlpha = smoothstep(-0.35, 0.9, vShoreDist);
            float alpha = mix(0.32, 0.97, max(edgeAlpha, totalFoam * 0.85));

            // Match scene FogExp2 seamlessly out to the horizon
            float fogDepth = length(vViewPos);
            float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * fogDepth * fogDepth);
            waterColor = mix(waterColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

            gl_FragColor = vec4(waterColor, alpha);
          }
        `,
      })
    );

    const oceanMesh = new THREE.Mesh(oceanGeo, this.waterMaterial);
    oceanMesh.renderOrder = 1;
    this.group.add(oceanMesh);
  }

  private createHarborSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#3b2414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#d4a644';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde68a';
    ctx.font = '800 58px "Marhey", "Tajawal", sans-serif';
    ctx.fillText('الميناء الملكي', canvas.width / 2, 74);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 34px "Tajawal", sans-serif';
    ctx.fillText('شاطئ وبحر المملكة', canvas.width / 2, 134);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.track(tex);
  }

  private buildHarborPier(targetBoxColliders?: OBBCollider[]) {
    const pierGroup = new THREE.Group();
    pierGroup.name = 'RoyalHarborPier';

    const woodTex = this.track(createWoodPlankTexture());
    const deckWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0xa6784e,
        roughness: 0.85,
        metalness: 0.03,
      })
    );
    const pilingWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x5c3c22,
        roughness: 0.9,
        metalness: 0.04,
      })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x2c3038,
        roughness: 0.45,
        metalness: 0.78,
      })
    );
    const flameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffdf78,
        emissive: 0xff8a1f,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );
    const ropeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc29e65, roughness: 0.92, metalness: 0.02 })
    );

    const startX = this.pierStartX; // ~ -57.25
    const endX = this.pierEndX; // ~ -71.35
    const length = startX - endX; // ~ 14.1m
    const centerX = (startX + endX) * 0.5;
    const cz = this.pierCenterZ; // 3.5
    const pierW = 3.6;
    const deckTopY = 0.44;

    // 1. Entrance Timber Approach Steps (so Sultan smoothly steps from sand onto y = 0.44 pier deck)
    const step1 = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.95, 0.16, pierW - 0.1)),
      deckWoodMat
    );
    step1.position.set(startX + 0.95, 0.08, cz);
    step1.receiveShadow = true;
    step1.castShadow = true;
    pierGroup.add(step1);

    const step2 = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.95, 0.3, pierW - 0.1)),
      deckWoodMat
    );
    step2.position.set(startX + 0.2, 0.15, cz);
    step2.receiveShadow = true;
    step2.castShadow = true;
    pierGroup.add(step2);

    // 2. Main Plank Pier Deck & Under-Structure Longitudinal Stringers
    const deckMesh = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(length, 0.14, pierW)),
      deckWoodMat
    );
    deckMesh.position.set(centerX, deckTopY - 0.07, cz);
    deckMesh.receiveShadow = true;
    deckMesh.castShadow = true;
    pierGroup.add(deckMesh);

    // Longitudinal timber curb beams
    const curbGeo = this.track(new THREE.BoxGeometry(length, 0.12, 0.18));
    [-pierW * 0.5 + 0.09, pierW * 0.5 - 0.09].forEach((oz) => {
      const curb = new THREE.Mesh(curbGeo, pilingWoodMat);
      curb.position.set(centerX, deckTopY + 0.04, cz + oz);
      curb.castShadow = true;
      pierGroup.add(curb);
    });

    // Crosswise decorative plank seam trim slats
    const seamGeo = this.track(new THREE.BoxGeometry(0.06, 0.01, pierW - 0.28));
    const seamCount = 24;
    for (let i = 0; i < seamCount; i++) {
      const sx = endX + 0.35 + (i / (seamCount - 1)) * (length - 0.7);
      const seam = new THREE.Mesh(seamGeo, pilingWoodMat);
      seam.position.set(sx, deckTopY + 0.004, cz);
      pierGroup.add(seam);
    }

    // 3. Heavy Seabed Wooden Pilings + Rope Bollards + Harbor Lantern Posts
    const pilingGeo = this.track(new THREE.CylinderGeometry(0.14, 0.16, 3.2, 8));
    const bollardGeo = this.track(new THREE.CylinderGeometry(0.16, 0.18, 0.72, 10));
    const ropeCoilGeo = this.track(new THREE.TorusGeometry(0.19, 0.04, 6, 12));
    ropeCoilGeo.rotateX(Math.PI / 2);

    const pilingCount = 6;
    for (let i = 0; i < pilingCount; i++) {
      const px = endX + 0.45 + (i / (pilingCount - 1)) * (length - 0.9);
      [-pierW * 0.5 + 0.22, pierW * 0.5 - 0.22].forEach((oz) => {
        const piling = new THREE.Mesh(pilingGeo, pilingWoodMat);
        piling.position.set(px, deckTopY - 0.85, cz + oz);
        piling.castShadow = true;
        pierGroup.add(piling);
      });

      // Side mooring bollards at outer stations
      if (i === 0 || i === 2) {
        [-pierW * 0.5 + 0.24, pierW * 0.5 - 0.24].forEach((oz) => {
          const b = new THREE.Mesh(bollardGeo, pilingWoodMat);
          b.position.set(px, deckTopY + 0.36, cz + oz);
          b.castShadow = true;
          pierGroup.add(b);

          const coil = new THREE.Mesh(ropeCoilGeo, ropeMat);
          coil.position.set(px, deckTopY + 0.48, cz + oz);
          pierGroup.add(coil);
        });
      }
    }

    // Side rope handrails along pier edges (skip entry opening at startX)
    const railGeo = this.track(new THREE.CylinderGeometry(0.035, 0.035, length - 0.6, 6));
    railGeo.rotateZ(Math.PI / 2);
    [-pierW * 0.5 + 0.22, pierW * 0.5 - 0.22].forEach((oz) => {
      const rail = new THREE.Mesh(railGeo, ropeMat);
      rail.position.set(centerX, deckTopY + 0.72, cz + oz);
      pierGroup.add(rail);
    });
    // End rail bar
    const endRailGeo = this.track(new THREE.BoxGeometry(0.14, 0.14, pierW - 0.3));
    const endRail = new THREE.Mesh(endRailGeo, pilingWoodMat);
    endRail.position.set(endX + 0.35, deckTopY + 0.76, cz);
    endRail.castShadow = true;
    pierGroup.add(endRail);

    // 4. Twin Harbor Lanterns at Pier Head & Shore Entrance
    const postGeo = this.track(new THREE.BoxGeometry(0.16, 2.15, 0.16));
    const cageGeo = this.track(new THREE.BoxGeometry(0.28, 0.34, 0.28));
    const lanternPositions = [
      { x: endX + 0.45, z: cz - pierW * 0.5 + 0.22 },
      { x: endX + 0.45, z: cz + pierW * 0.5 - 0.22 },
      { x: startX - 0.35, z: cz - pierW * 0.5 + 0.22 },
    ];
    lanternPositions.forEach((lp) => {
      const post = new THREE.Mesh(postGeo, pilingWoodMat);
      post.position.set(lp.x, deckTopY + 1.07, lp.z);
      post.castShadow = true;
      pierGroup.add(post);

      const cap = new THREE.Mesh(cageGeo, ironMat);
      cap.position.set(lp.x, deckTopY + 2.22, lp.z);
      pierGroup.add(cap);

      const glow = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.11, 8, 8)), flameMat);
      glow.position.set(lp.x, deckTopY + 2.2, lp.z);
      pierGroup.add(glow);
      this.lanternFlames.push(glow);
    });

    // 5. Harbor Signboard ("الميناء الملكي") beside shore entrance facing eastward toward approaching Sultan
    const signTex = this.createHarborSignTexture();
    const signMat = this.track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffe4b3,
        emissiveMap: signTex,
        emissiveIntensity: 0.18,
        roughness: 0.72,
      })
    );
    const signBoard = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.85, 2.0)), pilingWoodMat);
    signBoard.position.set(startX - 0.35, deckTopY + 1.58, cz - pierW * 0.5 - 0.45);
    signBoard.castShadow = true;
    pierGroup.add(signBoard);

    const signFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.86, 0.72)), signMat);
    signFace.position.set(startX - 0.29, deckTopY + 1.58, cz - pierW * 0.5 - 0.45);
    signFace.rotation.y = Math.PI / 2;
    pierGroup.add(signFace);

    this.group.add(pierGroup);

    // 6. Register Walkable Colliders so Sultan can walk right out onto the pier over the waves!
    if (targetBoxColliders) {
      const pushOBB = (
        cx: number,
        czPos: number,
        w: number,
        d: number,
        topY: number,
        allowStand: boolean
      ) => {
        targetBoxColliders.push({
          cx,
          cz: czPos,
          halfW: w * 0.5,
          halfD: d * 0.5,
          cosY: 1,
          sinY: 0,
          topY,
          allowStand,
        });
      };

      // Entrance steps & main walkable deck
      pushOBB(startX + 0.95, cz, 0.95, pierW - 0.1, 0.16, true);
      pushOBB(startX + 0.2, cz, 0.95, pierW - 0.1, 0.3, true);
      pushOBB(centerX, cz, length, pierW, deckTopY, true);

      // Solid safety railings on pier sides & far end (prevent walking off deck into deep ocean)
      pushOBB(centerX - 0.3, cz - pierW * 0.5 + 0.12, length - 0.6, 0.28, deckTopY + 1.2, false);
      pushOBB(centerX - 0.3, cz + pierW * 0.5 - 0.12, length - 0.6, 0.28, deckTopY + 1.2, false);
      pushOBB(endX + 0.28, cz, 0.34, pierW, deckTopY + 1.2, false);
    }
  }

  private buildMooredRoyalBoat() {
    this.boatBaseX = this.pierEndX + 2.8; // ~ -68.55
    this.boatBaseZ = this.pierCenterZ + 3.4; // ~ +6.9 (moored right alongside the pier)
    this.boatPos.set(this.boatBaseX, -0.06, this.boatBaseZ);
    this.boatHeading = 0.28;

    const boatGroup = new THREE.Group();
    boatGroup.name = 'RoyalHarborSailboat';
    boatGroup.position.copy(this.boatPos);
    boatGroup.rotation.y = this.boatHeading;

    const woodTex = this.track(createWoodPlankTexture());
    const hullMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x734525,
        roughness: 0.78,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    const trimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x452814,
        roughness: 0.85,
        metalness: 0.06,
      })
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe6b43c,
        roughness: 0.28,
        metalness: 0.84,
      })
    );
    const sailMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf4ebd9,
        roughness: 0.84,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    );
    const emeraldTrimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x0f5c44,
        roughness: 0.8,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );
    const flameMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffe58f,
        emissive: 0xff8c1a,
        emissiveIntensity: 1.45,
        roughness: 0.2,
      })
    );

    // 1. Sculpted Tapered Wooden Hull (curved elongated boat shape)
    const hullPoints = [
      new THREE.Vector2(0.0, -2.5),
      new THREE.Vector2(0.42, -1.9),
      new THREE.Vector2(0.95, -0.8),
      new THREE.Vector2(1.06, 0.2),
      new THREE.Vector2(0.85, 1.3),
      new THREE.Vector2(0.32, 2.25),
      new THREE.Vector2(0.0, 2.6),
    ];
    const hullLathe = this.track(new THREE.LatheGeometry(hullPoints, 12, 0, Math.PI));
    hullLathe.rotateZ(-Math.PI / 2);
    hullLathe.rotateY(Math.PI / 2);
    hullLathe.scale(1.0, 0.68, 1.0);
    const hullMesh = new THREE.Mesh(hullLathe, hullMat);
    hullMesh.position.y = 0.42;
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    boatGroup.add(hullMesh);

    // 2. Deck Plank Floor & Wooden Gunwale Trim
    const deckFloor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.55, 0.08, 3.6)),
      trimMat
    );
    deckFloor.position.set(0, 0.16, 0.0);
    boatGroup.add(deckFloor);

    // 3. Thwart Rowing Benches (Rear Captain Bench for Sultan, Middle Rowing Bench for Two Guards, Front Bench)
    const rearBench = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.54, 0.08, 0.36)),
      hullMat
    );
    rearBench.position.set(0, 0.34, -1.0);
    rearBench.castShadow = true;
    boatGroup.add(rearBench);

    const midRowBench = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.68, 0.08, 0.38)),
      hullMat
    );
    midRowBench.position.set(0, 0.34, 0.08);
    midRowBench.castShadow = true;
    boatGroup.add(midRowBench);

    const frontBench = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.36, 0.08, 0.32)),
      hullMat
    );
    frontBench.position.set(0, 0.34, 1.12);
    frontBench.castShadow = true;
    boatGroup.add(frontBench);

    // 4. Tall Timber Mast + Cross Yardarm + Furled Emerald-Trimmed Sultan Sail (placed forward of rowers)
    const mast = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.065, 0.095, 4.4, 8)),
      trimMat
    );
    mast.position.set(0, 2.32, 0.72);
    mast.castShadow = true;
    boatGroup.add(mast);

    const yard = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.04, 0.045, 2.75, 8)),
      trimMat
    );
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 3.72, 0.72);
    boatGroup.add(yard);

    // Slightly curved triangular/square lateen-inspired sail
    const sailGeo = this.track(new THREE.PlaneGeometry(2.45, 2.15, 8, 6));
    const sPos = sailGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const u = sPos.getX(i) / 2.45;
      const v = sPos.getY(i) / 2.15;
      // Billowing outward curve toward -Z
      const bulge = Math.cos(u * Math.PI) * Math.cos(v * Math.PI) * 0.28;
      sPos.setZ(i, -bulge);
    }
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 2.6, 0.61);
    sail.castShadow = true;
    boatGroup.add(sail);
    this.sailMesh = sail;

    // Royal Emerald Banner Pennant at masthead
    const pennant = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.9, 0.32)), emeraldTrimMat);
    pennant.position.set(0.45, 4.38, 0.72);
    boatGroup.add(pennant);

    // 5. Golden Bow Crest & Hanging Bow Lantern
    const bowPost = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 8)),
      goldMat
    );
    bowPost.position.set(0, 0.6, 2.35);
    bowPost.rotation.x = 0.35;
    boatGroup.add(bowPost);

    const bowLantern = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.11, 8, 8)), flameMat);
    bowLantern.position.set(0, 0.94, 2.5);
    boatGroup.add(bowLantern);
    this.lanternFlames.push(bowLantern);

    // 6. Captain's Seat Anchor on Rear Bench (for Sultan) & Rowing Seat Anchors on Middle Bench (for Two Guards)
    this.boatSeatAnchor.position.set(0, 0.26, -1.0);
    boatGroup.add(this.boatSeatAnchor);

    this.guardSeatAnchorR.position.set(-0.43, 0.25, 0.14);
    boatGroup.add(this.guardSeatAnchorR);

    this.guardSeatAnchorL.position.set(0.43, 0.25, 0.14);
    boatGroup.add(this.guardSeatAnchorL);

    // 6b. Twin Brass Oarlocks & Sculpted Wooden Rowing Oars for the Two Royal Guards
    const oarHandleMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x3b2210, roughness: 0.78, metalness: 0.05 })
    );
    const oarlockStemGeo = this.track(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6));
    const oarlockRingGeo = this.track(new THREE.TorusGeometry(0.055, 0.014, 6, 12, Math.PI * 1.25));
    const shaftGeo = this.track(new THREE.CylinderGeometry(0.024, 0.03, 2.45, 8));
    shaftGeo.rotateZ(Math.PI / 2);
    const gripGeo = this.track(new THREE.CylinderGeometry(0.036, 0.032, 0.34, 8));
    gripGeo.rotateZ(Math.PI / 2);
    const bladeGeo = this.track(new THREE.BoxGeometry(0.54, 0.026, 0.19));

    const buildOarAssembly = (side: -1 | 1): THREE.Group => {
      // Brass oarlock mounted on the gunwale
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 1.04, 0.47, -0.18);
      const stem = new THREE.Mesh(oarlockStemGeo, goldMat);
      stem.position.y = -0.04;
      lockGroup.add(stem);
      const ring = new THREE.Mesh(oarlockRingGeo, goldMat);
      ring.position.y = 0.04;
      ring.rotation.y = Math.PI / 2;
      ring.rotation.z = -Math.PI * 0.12;
      lockGroup.add(ring);
      boatGroup.add(lockGroup);

      // Pivoting wooden oar centered at the oarlock (handle reaches inboard toward guard, blade extends outboard)
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.04, 0.51, -0.18);

      const shaft = new THREE.Mesh(shaftGeo, hullMat);
      // Center of 2.45m shaft shifted outboard so inboard is ~0.78m and outboard is ~1.67m
      shaft.position.x = side * 0.45;
      shaft.castShadow = true;
      pivot.add(shaft);

      const grip = new THREE.Mesh(gripGeo, oarHandleMat);
      grip.position.x = -side * 0.62;
      pivot.add(grip);

      const blade = new THREE.Mesh(bladeGeo, trimMat);
      blade.position.x = side * 1.62;
      blade.rotation.x = 0.28; // angled slightly to catch water cleanly
      blade.castShadow = true;
      pivot.add(blade);

      boatGroup.add(pivot);
      return pivot;
    };

    this.oarPivotR = buildOarAssembly(-1);
    this.oarPivotL = buildOarAssembly(1);

    // Subtle water splash foam rings beneath left & right oar blades
    this.oarSplashMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xf8fdff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const splashGeo = this.track(new THREE.RingGeometry(0.14, 0.42, 16));
    splashGeo.rotateX(-Math.PI / 2);

    this.oarSplashR = new THREE.Mesh(splashGeo, this.oarSplashMat);
    this.oarSplashR.position.set(-2.55, -0.04, -0.2);
    boatGroup.add(this.oarSplashR);

    this.oarSplashL = new THREE.Mesh(splashGeo, this.oarSplashMat);
    this.oarSplashL.position.set(2.55, -0.04, -0.2);
    boatGroup.add(this.oarSplashL);

    // 7. Stern Rudder & Steering Tiller Arm
    const rudderPivot = new THREE.Group();
    rudderPivot.position.set(0, 0.26, -2.28);
    const rudderBlade = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.08, 0.72, 0.42)),
      trimMat
    );
    rudderBlade.position.set(0, -0.18, -0.14);
    rudderPivot.add(rudderBlade);

    const tillerArm = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.032, 0.04, 0.95, 6)),
      hullMat
    );
    tillerArm.rotation.x = Math.PI / 2 - 0.12;
    tillerArm.position.set(0, 0.24, 0.42);
    rudderPivot.add(tillerArm);
    boatGroup.add(rudderPivot);
    this.rudderPivot = rudderPivot;

    // 8. Water Wake Foam Strips behind stern when sailing
    this.wakeMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xf0f9ff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    const wakeGeo = this.track(new THREE.PlaneGeometry(0.45, 3.6));
    wakeGeo.rotateX(-Math.PI / 2);
    [-0.55, 0.55].forEach((wx, idx) => {
      const wake = new THREE.Mesh(wakeGeo, this.wakeMat);
      wake.position.set(wx, 0.04, -3.55);
      wake.rotation.y = idx === 0 ? -0.22 : 0.22;
      boatGroup.add(wake);
      this.wakeMeshes.push(wake);
    });

    // 9. Mooring Rope tying boat to the nearest pier bollard when parked beside pier
    const mooringMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc29e65, roughness: 0.92 })
    );
    const ropePts = [
      new THREE.Vector3(this.pierEndX + 0.45, 0.88, this.pierCenterZ + 1.58),
      new THREE.Vector3(this.pierEndX + 1.5, 0.36, this.pierCenterZ + 2.55),
      new THREE.Vector3(this.boatBaseX, 0.45, this.boatBaseZ - 1.9),
    ];
    const ropeCurve = new THREE.CatmullRomCurve3(ropePts);
    const mooringRope = new THREE.Mesh(
      this.track(new THREE.TubeGeometry(ropeCurve, 12, 0.032, 6, false)),
      mooringMat
    );
    this.mooringRope = mooringRope;
    this.group.add(mooringRope);

    this.boatGroup = boatGroup;
    this.group.add(boatGroup);
  }

  private buildCoastalBoulders(targetBoxColliders?: OBBCollider[]) {
    // Natural coastal rock outcrops scattered along the sandy shoreline & headlands
    const rockGeo = this.track(new THREE.DodecahedronGeometry(1.0, 1));
    const rockMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x77736c,
        roughness: 0.92,
        metalness: 0.04,
      })
    );

    const spots: { z: number; d: number; scale: number; ry: number }[] = [
      { z: -58.5, d: 0.6, scale: 1.35, ry: 0.4 },
      { z: -55.2, d: -0.7, scale: 0.95, ry: 1.1 },
      { z: -42.0, d: 1.4, scale: 1.15, ry: 2.2 },
      { z: -38.5, d: -0.3, scale: 0.82, ry: 0.9 },
      { z: -22.5, d: 1.2, scale: 1.1, ry: 1.7 },
      { z: -12.0, d: -0.5, scale: 0.9, ry: 2.8 },
      { z: 16.5, d: 1.1, scale: 1.25, ry: 0.6 },
      { z: 21.0, d: -0.6, scale: 0.92, ry: 1.9 },
      { z: 36.0, d: 1.3, scale: 1.3, ry: 2.5 },
      { z: 48.0, d: -0.4, scale: 1.05, ry: 0.3 },
      { z: 58.0, d: 0.8, scale: 1.4, ry: 1.4 },
      // Far coastal headlands outside boundary fog for scenic silhouettes
      { z: -78.0, d: -1.8, scale: 2.1, ry: 0.7 },
      { z: 76.0, d: -1.6, scale: 2.0, ry: 2.1 },
    ];

    const instMesh = new THREE.InstancedMesh(rockGeo, rockMat, spots.length);
    instMesh.castShadow = true;
    instMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    spots.forEach((s, i) => {
      const x = getCoastlineX(s.z) + s.d;
      const groundY = getCoastGroundHeight(x, s.z);
      dummy.position.set(x, groundY + s.scale * 0.25, s.z);
      dummy.rotation.set(0.15 * (i % 3), s.ry, 0.1 * ((i + 1) % 2));
      dummy.scale.set(s.scale * 1.25, s.scale * 0.65, s.scale * 1.1);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      tint.setHSL(0.09, 0.08, 0.42 + (i % 4) * 0.05);
      instMesh.setColorAt(i, tint);

      if (targetBoxColliders && Math.abs(s.z) < 62 && s.scale >= 1.0) {
        targetBoxColliders.push({
          cx: x,
          cz: s.z,
          halfW: s.scale * 1.0,
          halfD: s.scale * 0.9,
          cosY: 1,
          sinY: 0,
          topY: groundY + s.scale * 0.85,
          allowStand: false,
        });
      }
    });

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
    instMesh.computeBoundingSphere();
    this.group.add(instMesh);
  }

  /**
   * Prevents players, horses, cats, and citizens from wading past the sandy waterline
   * while allowing full access out onto the Wooden Harbor Pier!
   */
  public resolveSeaBoundary(pos: THREE.Vector3, radius: number = 0.45): boolean {
    const onPierDeck =
      pos.z >= this.pierCenterZ - 1.75 &&
      pos.z <= this.pierCenterZ + 1.75 &&
      pos.x <= this.pierStartX + 1.5 &&
      pos.x >= this.pierEndX + 0.5;

    if (onPierDeck) return false;

    const shoreX = getCoastlineX(pos.z);
    const minLandX = shoreX - 0.15 + radius;
    if (pos.x < minLandX) {
      pos.x = minLandX;
      return true;
    }
    return false;
  }

  public isSultanNearBoat(sultanPos: THREE.Vector3, maxDist: number = 5.4): boolean {
    return (
      Math.hypot(sultanPos.x - this.boatPos.x, sultanPos.z - this.boatPos.z) <= maxDist
    );
  }

  public setBoatOccupied(occupied: boolean) {
    this.isBoatOccupied = occupied;
    if (occupied) {
      if (this.mooringRope) this.mooringRope.visible = false;
    } else {
      this.boatSpeed = 0;
      if (this.mooringRope) {
        const distToMoor = Math.hypot(
          this.boatPos.x - this.boatBaseX,
          this.boatPos.z - this.boatBaseZ
        );
        this.mooringRope.visible = distToMoor < 2.6;
      }
    }
  }

  public getBoatSeatWorldPos(out: THREE.Vector3): THREE.Vector3 {
    if (this.boatGroup) {
      this.boatGroup.updateMatrixWorld(true);
      return this.boatSeatAnchor.getWorldPosition(out);
    }
    return out.copy(this.boatPos);
  }

  public getGuardRowPose(
    guardSide: number,
    outPos: THREE.Vector3
  ): { facingAngle: number; rowCos: number; rowDip: number; rowBlend: number } {
    if (this.boatGroup) {
      this.boatGroup.updateMatrixWorld(true);
      const anchor = guardSide < 0 ? this.guardSeatAnchorR : this.guardSeatAnchorL;
      anchor.getWorldPosition(outPos);
      return {
        facingAngle: this.boatGroup.rotation.y + Math.PI,
        rowCos: Math.cos(this.rowCycle),
        rowDip: Math.sin(this.rowCycle),
        rowBlend: this.rowBlend,
      };
    }
    outPos.copy(this.boatPos);
    return {
      facingAngle: this.boatHeading + Math.PI,
      rowCos: 0,
      rowDip: 0,
      rowBlend: 0,
    };
  }

  public getGuardDisembarkPos(
    guardSide: number,
    sultanPos: THREE.Vector3,
    out: THREE.Vector3
  ) {
    const onPier =
      sultanPos.x <= this.pierStartX + 1.5 &&
      sultanPos.x >= this.pierEndX + 0.5 &&
      Math.abs(sultanPos.z - this.pierCenterZ) <= 2.2;

    if (onPier) {
      const targetX = Math.max(
        this.pierEndX + 1.0,
        Math.min(this.pierStartX - 0.5, sultanPos.x + 1.15)
      );
      out.set(targetX, 0.44, this.pierCenterZ + (guardSide < 0 ? -0.95 : 0.95));
      return;
    }

    const tz = Math.max(-78, Math.min(78, sultanPos.z + (guardSide < 0 ? -1.45 : 1.45)));
    const tx = getCoastlineX(tz) + 1.25;
    out.set(tx, getCoastGroundHeight(tx, tz), tz);
  }

  public getBoatDisembarkTarget(out: THREE.Vector3) {
    // 1. If close to the Wooden Harbor Pier, step neatly onto the pier deck
    const nearPier =
      this.boatPos.x >= this.pierEndX - 3.6 &&
      this.boatPos.x <= this.pierStartX + 1.5 &&
      Math.abs(this.boatPos.z - this.pierCenterZ) <= 8.5;

    if (nearPier) {
      const targetX = Math.max(
        this.pierEndX + 1.3,
        Math.min(this.pierStartX - 0.8, this.boatPos.x)
      );
      out.set(targetX, 0.44, this.pierCenterZ);
      return;
    }

    // 2. Otherwise step safely onto the nearest sandy beach point & anchor boat just offshore
    const clampedZ = Math.max(-80, Math.min(80, this.boatPos.z));
    const shoreX = getCoastlineX(clampedZ);
    const landX = shoreX + 1.15;
    out.set(landX, getCoastGroundHeight(landX, clampedZ), clampedZ);

    if (this.boatPos.x < shoreX - 5.5) {
      this.boatPos.x = shoreX - 2.45;
      this.boatPos.z = clampedZ;
    }
  }

  public moveBoat(
    delta: number,
    moveWorldX: number,
    moveWorldZ: number,
    targetSpeed: number,
    isMoving: boolean
  ): { isBlocked: boolean; proximity: number } {
    this.boatSpeed = THREE.MathUtils.damp(this.boatSpeed, isMoving ? targetSpeed : 0, 5.0, delta);

    let turnDelta = 0;
    if (isMoving && (Math.abs(moveWorldX) > 0.01 || Math.abs(moveWorldZ) > 0.01)) {
      const targetAngle = Math.atan2(moveWorldX, moveWorldZ);
      let diff = targetAngle - this.boatHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      turnDelta = Math.max(-1, Math.min(1, diff));
      this.boatHeading += diff * Math.min(1.0, delta * 4.2);

      this.boatPos.x += Math.sin(this.boatHeading) * this.boatSpeed * delta;
      this.boatPos.z += Math.cos(this.boatHeading) * this.boatSpeed * delta;
    } else if (this.boatSpeed > 0.15) {
      this.boatPos.x += Math.sin(this.boatHeading) * this.boatSpeed * delta;
      this.boatPos.z += Math.cos(this.boatHeading) * this.boatSpeed * delta;
    }

    this.boatTurnVisual = THREE.MathUtils.damp(this.boatTurnVisual, turnDelta, 6.0, delta);

    // Prevent boat from running onto dry shore (keep in navigable water west of shoreline)
    const maxWaterX = getCoastlineX(this.boatPos.z) - 2.25;
    if (this.boatPos.x > maxWaterX) {
      this.boatPos.x = maxWaterX;
    }

    // Keep clear of Wooden Harbor Pier pilings so hull glides cleanly around the dock
    const pierMinX = this.pierEndX - 1.45;
    const pierMaxX = this.pierStartX + 1.0;
    const pierMinZ = this.pierCenterZ - 2.9;
    const pierMaxZ = this.pierCenterZ + 2.9;
    if (
      this.boatPos.x > pierMinX &&
      this.boatPos.x < pierMaxX &&
      this.boatPos.z > pierMinZ &&
      this.boatPos.z < pierMaxZ
    ) {
      const dLeft = this.boatPos.x - pierMinX;
      const dTop = this.boatPos.z - pierMinZ;
      const dBottom = pierMaxZ - this.boatPos.z;
      if (dLeft <= dTop && dLeft <= dBottom) {
        this.boatPos.x = pierMinX;
      } else if (dTop < dBottom) {
        this.boatPos.z = pierMinZ;
      } else {
        this.boatPos.z = pierMaxZ;
      }
    }

    // Enforce generous Royal Sea Sailing Zone limits (x >= -145, z in [-95, +95])
    let isBlocked = false;
    let proximity = 0;

    const minSeaX = -145;
    const maxAbsZ = 95;
    const distWestEdge = this.boatPos.x - minSeaX;
    const distNorthSouthEdge = maxAbsZ - Math.abs(this.boatPos.z);
    const minEdgeDist = Math.min(distWestEdge, distNorthSouthEdge);

    if (minEdgeDist < 10) {
      proximity = Math.min(1, Math.max(0, (10 - minEdgeDist) / 10));
    }

    if (this.boatPos.x <= minSeaX) {
      this.boatPos.x = minSeaX;
      isBlocked = true;
    }
    if (this.boatPos.z > maxAbsZ) {
      this.boatPos.z = maxAbsZ;
      isBlocked = true;
    } else if (this.boatPos.z < -maxAbsZ) {
      this.boatPos.z = -maxAbsZ;
      isBlocked = true;
    }

    if (this.boatGroup) {
      this.boatGroup.position.x = this.boatPos.x;
      this.boatGroup.position.z = this.boatPos.z;
      this.boatGroup.rotation.y = this.boatHeading;
    }

    return { isBlocked, proximity };
  }

  public update(elapsedTime: number, delta: number = 0.016) {
    this.waterMaterial.uniforms.uTime.value = elapsedTime;

    // Advance guard rowing cycle & oar stowing smoothly
    const isActivelyRowing = this.isBoatOccupied && this.boatSpeed > 0.25;
    this.rowBlend = THREE.MathUtils.damp(this.rowBlend, isActivelyRowing ? 1.0 : 0.0, 5.5, delta);
    this.oarStowBlend = THREE.MathUtils.damp(
      this.oarStowBlend,
      this.isBoatOccupied ? 0.0 : 1.0,
      5.0,
      delta
    );
    if (isActivelyRowing || this.rowBlend > 0.02) {
      const rowFreq = 3.2 + Math.min(1, this.boatSpeed / 15.6) * 2.8;
      this.rowCycle += delta * rowFreq;
    }

    // Compute synchronized oar sweep (yaw) & water dip (roll) for both guards
    const strokeSweep = Math.cos(this.rowCycle) * 0.44;
    const strokeDip = Math.sin(this.rowCycle) * 0.28 + 0.06;
    const poisedSweep = 0.06;
    const poisedDip = -0.05;
    const activeSweep = THREE.MathUtils.lerp(poisedSweep, strokeSweep, this.rowBlend);
    const activeDip = THREE.MathUtils.lerp(poisedDip, strokeDip, this.rowBlend);

    // Stow oars neatly backward along the gunwales when boat is unoccupied at pier
    const finalSweep = THREE.MathUtils.lerp(activeSweep, -1.28, this.oarStowBlend);
    const finalDip = THREE.MathUtils.lerp(activeDip, -0.1, this.oarStowBlend);

    if (this.oarPivotR) {
      this.oarPivotR.rotation.y = finalSweep;
      this.oarPivotR.rotation.z = finalDip;
    }
    if (this.oarPivotL) {
      this.oarPivotL.rotation.y = -finalSweep;
      this.oarPivotL.rotation.z = -finalDip;
    }

    // Water splash rings beneath oar blades during the submerged power stroke
    const splashPulse = Math.max(0, Math.sin(this.rowCycle)) * this.rowBlend;
    this.oarSplashMat.opacity = splashPulse * 0.55;
    const splashZ = -0.18 + Math.sin(finalSweep) * 1.55;
    const splashScale = 0.65 + splashPulse * 0.85;
    if (this.oarSplashR) {
      this.oarSplashR.position.z = splashZ;
      this.oarSplashR.scale.setScalar(splashScale);
    }
    if (this.oarSplashL) {
      this.oarSplashL.position.z = splashZ;
      this.oarSplashL.scale.setScalar(splashScale);
    }

    // Ocean wave bobbing, sailing pitch & turn bank for the Royal Sailboat
    if (this.boatGroup) {
      const waveBob = Math.sin(elapsedTime * 1.45) * 0.085;
      const speedRatio = Math.min(1, this.boatSpeed / 14);
      this.boatGroup.position.x = this.boatPos.x;
      this.boatGroup.position.z = this.boatPos.z;
      this.boatGroup.position.y = -0.06 + waveBob + speedRatio * 0.04;
      this.boatGroup.rotation.y =
        this.boatHeading + (this.isBoatOccupied ? 0 : Math.sin(elapsedTime * 0.55) * 0.035);
      this.boatGroup.rotation.z =
        Math.sin(elapsedTime * 1.2 + 0.4) * 0.045 - this.boatTurnVisual * 0.14;
      this.boatGroup.rotation.x =
        Math.cos(elapsedTime * 1.55) * 0.03 -
        speedRatio * 0.055 +
        Math.cos(this.rowCycle) * 0.014 * this.rowBlend;
    }

    if (this.rudderPivot) {
      this.rudderPivot.rotation.y = -this.boatTurnVisual * 0.55;
    }

    const wakeAlpha = Math.min(0.65, this.boatSpeed / 16);
    this.wakeMat.opacity = wakeAlpha;
    for (let i = 0; i < this.wakeMeshes.length; i++) {
      const pulse = 0.85 + Math.sin(elapsedTime * 7.5 + i * 1.7) * 0.15;
      this.wakeMeshes[i].scale.set(1, 1, (0.4 + wakeAlpha * 1.1) * pulse);
    }

    if (this.sailMesh) {
      this.sailMesh.rotation.y = Math.sin(elapsedTime * 1.3) * 0.045;
    }

    for (let i = 0; i < this.lanternFlames.length; i++) {
      const f = 0.9 + Math.sin(elapsedTime * 9.0 + i * 2.1) * 0.15;
      this.lanternFlames[i].scale.setScalar(f);
    }
  }

  public setAtmosphere(
    skyColor: THREE.Color,
    fogColor: THREE.Color,
    sunDir: THREE.Vector3,
    specColor: THREE.Color,
    nightFactor: number
  ) {
    if (!this.waterMaterial) return;
    const u = this.waterMaterial.uniforms;
    u.uSkyColor.value.copy(skyColor);
    u.uFogColor.value.copy(fogColor);
    u.uSunDir.value.copy(sunDir).normalize();
    u.uSpecColor.value.copy(specColor);
    u.uNightFactor.value = nightFactor;

    u.uShallowColor.value.copy(_shallowDayCol).lerp(_shallowNightCol, nightFactor);
    u.uMidColor.value.copy(_midDayCol).lerp(_midNightCol, nightFactor);
    u.uDeepColor.value.copy(_deepDayCol).lerp(_deepNightCol, nightFactor);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
