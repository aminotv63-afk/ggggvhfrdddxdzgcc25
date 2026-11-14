import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRadialShadowTexture } from './textures';
import { soundManager } from './audio';

export interface SultanState {
  isMoving: boolean;
  isRunning: boolean;
  isGrounded: boolean;
  jumpVelocity: number;
  speed: number;
  isRiding?: boolean;
  isRidingCarriage?: boolean;
  isSailing?: boolean;
  isLeadingHorse?: boolean;
  isSittingOnThrone?: boolean;
  isSleepingInBed?: boolean;
  nightFactor?: number;
}

export type SultanAnimName = 'idle' | 'walk' | 'run' | 'jump' | 'wave';

export class SultanCharacter {
  public group: THREE.Group;
  public shadowMesh: THREE.Mesh;
  public facingAngle: number = 0;
  public isLoaded: boolean = false;

  private modelGroup: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<SultanAnimName, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentAnimName: SultanAnimName = 'idle';

  private animTime: number = 0;
  private isWaving: boolean = false;

  // Skeleton bones for seated horse-riding posture
  private spineBone: THREE.Object3D | null = null;
  private upperLegL: THREE.Object3D | null = null;
  private lowerLegL: THREE.Object3D | null = null;
  private upperLegR: THREE.Object3D | null = null;
  private lowerLegR: THREE.Object3D | null = null;
  private upperArmL: THREE.Object3D | null = null;
  private lowerArmL: THREE.Object3D | null = null;
  private upperArmR: THREE.Object3D | null = null;
  private lowerArmR: THREE.Object3D | null = null;
  private handAnchorR: THREE.Object3D | null = null;
  private restLegPosL = new THREE.Vector3(0.078, 0, 0);
  private restLegPosR = new THREE.Vector3(-0.078, 0, 0);

  // Precomputed riding, boat-sitting & leading bone quaternions (zero GC per frame)
  private readonly rideUpperLegQuatL: THREE.Quaternion;
  private readonly rideLowerLegQuatL: THREE.Quaternion;
  private readonly rideUpperLegQuatR: THREE.Quaternion;
  private readonly rideLowerLegQuatR: THREE.Quaternion;
  private readonly boatUpperLegQuatL: THREE.Quaternion;
  private readonly boatLowerLegQuatL: THREE.Quaternion;
  private readonly boatUpperLegQuatR: THREE.Quaternion;
  private readonly boatLowerLegQuatR: THREE.Quaternion;
  private rideUpperArmQuatL = new THREE.Quaternion();
  private rideLowerArmQuatL = new THREE.Quaternion();
  private rideUpperArmQuatR = new THREE.Quaternion();
  private rideLowerArmQuatR = new THREE.Quaternion();
  private boatUpperArmQuatL = new THREE.Quaternion();
  private boatLowerArmQuatL = new THREE.Quaternion();
  private boatUpperArmQuatR = new THREE.Quaternion();
  private boatLowerArmQuatR = new THREE.Quaternion();
  private leadUpperArmQuatR = new THREE.Quaternion();
  private leadLowerArmQuatR = new THREE.Quaternion();

  private sultanName: string = 'السلطان';
  private crownNameCanvas: HTMLCanvasElement | null = null;
  private crownNameTexture: THREE.CanvasTexture | null = null;

  // Handheld lantern night glow light & materials
  private lanternLight: THREE.PointLight | null = null;
  private lanternHaloMesh: THREE.Mesh | null = null;
  private lanternHaloMat: THREE.MeshBasicMaterial | null = null;
  private lanternFlameMats: THREE.MeshStandardMaterial[] = [];
  private lanternGlowMats: THREE.MeshStandardMaterial[] = [];

  constructor(
    onLoadCallback?: () => void,
    loadingManager?: THREE.LoadingManager,
    onErrorCallback?: (err: unknown) => void
  ) {
    this.group = new THREE.Group();
    this.group.name = 'SultanCharacter';

    // Precompute seated horseback riding quaternions so thighs splay cleanly outside horse barrel
    // and lower legs + boots hang vertically forward into the stirrups
    const fwdZ = new THREE.Vector3(0, 0, 1);
    const shinWorldL = this.quatFromYZ(new THREE.Vector3(0.1, -0.99, -0.08), fwdZ);
    const shinWorldR = this.quatFromYZ(new THREE.Vector3(-0.1, -0.99, -0.08), fwdZ);
    this.rideUpperLegQuatL = this.quatFromYZ(new THREE.Vector3(0.62, -0.52, 0.58), fwdZ);
    this.rideUpperLegQuatR = this.quatFromYZ(new THREE.Vector3(-0.62, -0.52, 0.58), fwdZ);
    this.rideLowerLegQuatL = this.rideUpperLegQuatL.clone().invert().multiply(shinWorldL);
    this.rideLowerLegQuatR = this.rideUpperLegQuatR.clone().invert().multiply(shinWorldR);

    // Precompute neat seated bench pose for riding the Royal Sailboat
    const boatThighL = this.quatFromYZ(new THREE.Vector3(0.08, -0.18, 0.98), fwdZ);
    const boatThighR = this.quatFromYZ(new THREE.Vector3(-0.08, -0.18, 0.98), fwdZ);
    const boatShinL = this.quatFromYZ(new THREE.Vector3(0.04, -0.99, 0.08), fwdZ);
    const boatShinR = this.quatFromYZ(new THREE.Vector3(-0.04, -0.99, 0.08), fwdZ);
    this.boatUpperLegQuatL = boatThighL;
    this.boatUpperLegQuatR = boatThighR;
    this.boatLowerLegQuatL = boatThighL.clone().invert().multiply(boatShinL);
    this.boatLowerLegQuatR = boatThighR.clone().invert().multiply(boatShinR);

    this.modelGroup = new THREE.Group();
    this.group.add(this.modelGroup);

    // 1. Soft grounded contact shadow
    const shadowTex = createRadialShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.02;
    this.group.add(this.shadowMesh);

    // Prepare crown nameplate texture
    this.initCrownNameTexture();

    // 2. Load the exact character 3D model without replacing it
    const loader = new GLTFLoader(loadingManager);
    loader.load(
      './grab3d-cozy-character.glb',
      (gltf) => {
        const root = gltf.scene;

        const RED_PRIMARY = new THREE.Color(0xc9182b); // Royal crimson red
        const RED_DEEP = new THREE.Color(0xa31322); // Deep red for secondary clothing
        let skinMaterial: THREE.MeshStandardMaterial | null = null;
        let lanternFlameMesh: THREE.Mesh | null = null;
        let lanternGlowMesh: THREE.Mesh | null = null;

        // Hide original anime/cute facial overlays & original small hat, keep red clothing only
        const hiddenMeshes = new Set([
          'character_4', // giant anime eyes
          'character_5', // anime eye white highlights
          'character_6', // cute tiny mouth
          'character_7', // cute pink cheek blush
          'character_8', // anime eyelashes/dark eye outline
          'character_9', // old hat secondary
          'character_10', // old hat accent
          'character_11', // old tiny crown
        ]);

        root.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;

            if (hiddenMeshes.has(mesh.name)) {
              mesh.visible = false;
              return;
            }

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const processMat = (mat: THREE.Material) => {
              const standardMat = mat as THREE.MeshStandardMaterial;
              const name = (standardMat.name || '').toLowerCase();

              if (name === 'skin' && !skinMaterial) {
                skinMaterial = standardMat;
              }

              // Keep ONLY his clothing red (top, bottom pants, sleeve)
              if (name === 'top_primary' || name === 'bottom_primary') {
                standardMat.color.copy(RED_PRIMARY);
              } else if (name === 'body_secondary' || name === 'handl_primary') {
                standardMat.color.copy(RED_DEEP);
              } else if (name === 'fix_flame') {
                this.lanternFlameMats.push(standardMat);
                if (!lanternFlameMesh) lanternFlameMesh = mesh;
              } else if (name === 'fix_glow') {
                this.lanternGlowMats.push(standardMat);
                if (!lanternGlowMesh) lanternGlowMesh = mesh;
              }
            };

            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(processMat);
            } else if (mesh.material) {
              processMat(mesh.material);
            }
          }
        });

        // Attach new inscribed royal crown (no heart/dome) and masculine face features to head bone
        const headBone = root.getObjectByName('head');
        if (headBone) {
          const crown = this.createInscribedRoyalCrown();
          crown.position.set(0, 0.352, -0.02);
          crown.rotation.x = -0.04;
          headBone.add(crown);

          const face = this.createMasculineFaceFeatures(skinMaterial);
          headBone.add(face);
        }

        // Cache skeletal limbs using Three.js sanitized bone names (dots stripped by PropertyBinding)
        const getBone = (sanitized: string, raw: string) =>
          root.getObjectByName(sanitized) || root.getObjectByName(raw) || null;

        this.spineBone = getBone('spine', 'spine');
        this.upperLegL = getBone('upperLegL', 'upperLeg.L');
        this.lowerLegL = getBone('lowerLegL', 'lowerLeg.L');
        this.upperLegR = getBone('upperLegR', 'upperLeg.R');
        this.lowerLegR = getBone('lowerLegR', 'lowerLeg.R');
        this.upperArmL = getBone('upperArmL', 'upperArm.L');
        this.lowerArmL = getBone('lowerArmL', 'lowerArm.L');
        this.upperArmR = getBone('upperArmR', 'upperArm.R');
        this.lowerArmR = getBone('lowerArmR', 'lowerArm.R');
        if (this.upperLegL) this.restLegPosL.copy(this.upperLegL.position);
        if (this.upperLegR) this.restLegPosR.copy(this.upperLegR.position);

        // Precompute natural forward reins-holding arm quaternions relative to loaded shoulder bones
        const upHint = new THREE.Vector3(0, 1, 0);
        const shoulderL = getBone('shoulderL', 'shoulder.L');
        const shoulderR = getBone('shoulderR', 'shoulder.R');
        root.updateMatrixWorld(true);
        if (shoulderL) {
          const shWorldQL = shoulderL.getWorldQuaternion(new THREE.Quaternion());
          const armWorldQL = this.quatFromYZ(new THREE.Vector3(0.28, -0.62, 0.73), upHint);
          const foreWorldQL = this.quatFromYZ(new THREE.Vector3(-0.22, -0.25, 0.94), upHint);
          this.rideUpperArmQuatL.copy(shWorldQL.clone().invert().multiply(armWorldQL));
          this.rideLowerArmQuatL.copy(armWorldQL.clone().invert().multiply(foreWorldQL));

          const boatArmQL = this.quatFromYZ(new THREE.Vector3(0.22, -0.82, 0.52), upHint);
          const boatForeQL = this.quatFromYZ(new THREE.Vector3(-0.18, -0.45, 0.87), upHint);
          this.boatUpperArmQuatL.copy(shWorldQL.clone().invert().multiply(boatArmQL));
          this.boatLowerArmQuatL.copy(boatArmQL.clone().invert().multiply(boatForeQL));
        }
        if (shoulderR) {
          const shWorldQR = shoulderR.getWorldQuaternion(new THREE.Quaternion());
          const armWorldQR = this.quatFromYZ(new THREE.Vector3(-0.28, -0.62, 0.73), upHint);
          const foreWorldQR = this.quatFromYZ(new THREE.Vector3(0.22, -0.25, 0.94), upHint);
          this.rideUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(armWorldQR));
          this.rideLowerArmQuatR.copy(armWorldQR.clone().invert().multiply(foreWorldQR));

          const boatArmQR = this.quatFromYZ(new THREE.Vector3(-0.22, -0.82, 0.52), upHint);
          const boatForeQR = this.quatFromYZ(new THREE.Vector3(0.18, -0.45, 0.87), upHint);
          this.boatUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(boatArmQR));
          this.boatLowerArmQuatR.copy(boatArmQR.clone().invert().multiply(boatForeQR));

          // Natural right arm grip extending slightly outward/back when leading a horse by rope
          const leadArmQR = this.quatFromYZ(new THREE.Vector3(-0.32, -0.82, -0.46), upHint);
          const leadForeQR = this.quatFromYZ(new THREE.Vector3(-0.18, -0.52, -0.83), upHint);
          this.leadUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(leadArmQR));
          this.leadLowerArmQuatR.copy(leadArmQR.clone().invert().multiply(leadForeQR));
        }

        // Attach hand anchor at the end of right forearm for exact rope-to-hand & sword attachment
        this.handAnchorR = new THREE.Object3D();
        this.handAnchorR.position.set(0, 0.14, 0);
        if (this.lowerArmR) {
          this.lowerArmR.add(this.handAnchorR);
        } else {
          root.add(this.handAnchorR);
        }

        // Attach dynamic handheld lantern glow light & halo centered inside the lantern flame chamber (not at the hand)
        const handR = getBone('handR', 'hand.R');
        const lanternHost = handR || this.handAnchorR;
        const flameBindCenter = new THREE.Vector3(-0.3061, 0.171, 0);
        const lanternRefMesh =
          (lanternFlameMesh as THREE.Mesh | null) ||
          (lanternGlowMesh as THREE.Mesh | null);
        if (lanternRefMesh) {
          if (!lanternRefMesh.geometry.boundingBox) {
            lanternRefMesh.geometry.computeBoundingBox();
          }
          if (lanternRefMesh.geometry.boundingBox) {
            lanternRefMesh.geometry.boundingBox.getCenter(flameBindCenter);
            flameBindCenter.applyMatrix4(lanternRefMesh.matrixWorld);
          }
        }
        lanternHost.updateWorldMatrix(true, false);
        const lanternLocalPos = lanternHost.worldToLocal(flameBindCenter.clone());

        this.lanternLight = new THREE.PointLight(0xffb44c, 0, 14, 1.55);
        this.lanternLight.castShadow = false;
        this.lanternLight.visible = false;
        this.lanternLight.position.copy(lanternLocalPos);
        lanternHost.add(this.lanternLight);

        this.lanternHaloMat = new THREE.MeshBasicMaterial({
          color: 0xffc857,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        this.lanternHaloMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.088, 10, 8),
          this.lanternHaloMat
        );
        this.lanternHaloMesh.position.copy(lanternLocalPos);
        this.lanternHaloMesh.visible = false;
        lanternHost.add(this.lanternHaloMesh);

        // Set scale for natural height
        root.scale.set(1.4, 1.4, 1.4);
        root.position.set(0, 0, 0);

        this.modelGroup.add(root);

        // 3. Setup AnimationMixer with the model's native skeletal animations
        this.mixer = new THREE.AnimationMixer(root);

        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          const name = clip.name.toLowerCase() as SultanAnimName;
          this.actions.set(name, action);

          if (name === 'jump') {
            action.loop = THREE.LoopRepeat;
            action.clampWhenFinished = false;
          } else if (name === 'wave') {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
          }
        });

        // Start with idle animation
        const idleAction = this.actions.get('idle');
        if (idleAction) {
          idleAction.play();
          this.currentAction = idleAction;
          this.currentAnimName = 'idle';
        }

        // Listen for wave completion
        this.mixer.addEventListener('finished', (e: { action: THREE.AnimationAction }) => {
          if (e.action === this.actions.get('wave')) {
            this.isWaving = false;
            this.playAnimation('idle', 0.25);
          }
        });

        this.isLoaded = true;
        if (onLoadCallback) onLoadCallback();
      },
      undefined,
      (err) => {
        console.error('Failed to load character model:', err);
        if (onErrorCallback) onErrorCallback(err);
      }
    );
  }

  private quatFromYZ(dirY: THREE.Vector3, hintZ: THREE.Vector3): THREE.Quaternion {
    const y = dirY.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, hintZ).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  /**
   * Initializes the dynamic canvas texture used to engrave the Sultan's name on the crown
   */
  private initCrownNameTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    this.crownNameCanvas = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.crownNameTexture = tex;

    this.redrawCrownName();
  }

  /**
   * Updates the Sultan's name printed on the royal crown in real time
   */
  public setSultanName(name: string) {
    const cleaned = name.trim() || 'السلطان';
    if (this.sultanName === cleaned) return;
    this.sultanName = cleaned;
    this.redrawCrownName();
  }

  private redrawCrownName() {
    if (!this.crownNameCanvas || !this.crownNameTexture) return;
    const ctx = this.crownNameCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.crownNameCanvas.width;
    const h = this.crownNameCanvas.height;

    // High-contrast deep royal dark plaque background for crisp readability (no hearts)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1d120a');
    bgGrad.addColorStop(0.5, '#2b190d');
    bgGrad.addColorStop(1, '#160d06');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Crisp royal golden frame borders
    ctx.strokeStyle = '#ffd966';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.strokeStyle = '#c89628';
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // Render the Sultan's name large, bold, and clearly centered
    const text = this.sultanName;
    let fontSize = 144;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Support both Arabic RTL and Latin smoothly
    const isArabic = /[\u0600-\u06FF]/.test(text);
    this.crownNameCanvas.dir = isArabic ? 'rtl' : 'ltr';

    while (fontSize > 48) {
      ctx.font = `900 ${fontSize}px 'Tajawal', system-ui, sans-serif`;
      if (ctx.measureText(text).width <= w - 130) break;
      fontSize -= 6;
    }

    // Thick dark outline for maximum legibility
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#090502';
    ctx.lineWidth = 12;
    ctx.strokeText(text, w / 2, h / 2 + 4);

    // High-contrast bright cream-gold lettering
    const textGrad = ctx.createLinearGradient(0, h / 2 - fontSize / 2, 0, h / 2 + fontSize / 2);
    textGrad.addColorStop(0, '#fffbe0');
    textGrad.addColorStop(0.5, '#ffe175');
    textGrad.addColorStop(1, '#f0b835');
    ctx.fillStyle = textGrad;
    ctx.fillText(text, w / 2, h / 2 + 4);

    this.crownNameTexture.needsUpdate = true;
  }

  /**
   * Builds a taller, majestic royal crown (NO heart/velvet dome) with a clear front-only nameplate
   */
  private createInscribedRoyalCrown(): THREE.Group {
    const crownGroup = new THREE.Group();
    crownGroup.name = 'InscribedRoyalCrown';

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe8c15a,
      roughness: 0.25,
      metalness: 0.82,
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8d874,
      roughness: 0.2,
      metalness: 0.88,
    });

    const innerCapMat = new THREE.MeshStandardMaterial({
      color: 0x3a2410,
      roughness: 0.65,
      metalness: 0.35,
    });

    // 1. Taller sculpted royal golden circlet band
    const bandHeight = 0.145;
    const bandGeo = new THREE.CylinderGeometry(0.232, 0.212, bandHeight, 28);
    const band = new THREE.Mesh(bandGeo, goldMat);
    band.position.y = bandHeight / 2;
    band.castShadow = true;
    crownGroup.add(band);

    // Flat metallic inner crown cap (prevents hollow view from above, no velvet dome/heart)
    const capGeo = new THREE.CircleGeometry(0.228, 28);
    const cap = new THREE.Mesh(capGeo, innerCapMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = bandHeight - 0.002;
    crownGroup.add(cap);

    // 2. Lower & Upper solid golden rim rings
    const lowerRimGeo = new THREE.TorusGeometry(0.213, 0.013, 8, 28);
    const lowerRim = new THREE.Mesh(lowerRimGeo, goldTrimMat);
    lowerRim.rotation.x = Math.PI / 2;
    lowerRim.position.y = 0.006;
    crownGroup.add(lowerRim);

    const upperRimGeo = new THREE.TorusGeometry(0.233, 0.014, 8, 28);
    const upperRim = new THREE.Mesh(upperRimGeo, goldTrimMat);
    upperRim.rotation.x = Math.PI / 2;
    upperRim.position.y = bandHeight;
    crownGroup.add(upperRim);

    // 3. Curved Front-Only Engraved Nameplate Plaque (large & clearly legible)
    const arcLength = Math.PI * 0.64;
    const plaqueGeo = new THREE.CylinderGeometry(
      0.235,
      0.219,
      0.114,
      28,
      1,
      true,
      -arcLength / 2,
      arcLength
    );
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: this.crownNameTexture,
      emissiveMap: this.crownNameTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.38,
      roughness: 0.55,
      metalness: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Front nameplate ONLY (+Z)
    const frontPlaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    frontPlaque.position.y = bandHeight / 2;
    crownGroup.add(frontPlaque);

    // 4. Eight taller architectural golden crown points (faceted spears + small gold spheres)
    const pointCount = 8;
    const pointGeo = new THREE.ConeGeometry(0.034, 0.125, 4);
    const finialGeo = new THREE.SphereGeometry(0.018, 8, 8);

    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const isCardinal = i % 2 === 0;
      const r = 0.232;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;

      const point = new THREE.Mesh(pointGeo, goldTrimMat);
      const heightScale = isCardinal ? 1.28 : 0.96;
      point.scale.set(1.0, heightScale, 0.72);
      point.position.set(x, bandHeight + 0.056 + (heightScale - 1) * 0.05, z);
      point.rotation.y = angle;
      point.rotation.x = Math.cos(angle) * 0.11;
      point.rotation.z = -Math.sin(angle) * 0.11;
      point.castShadow = true;
      crownGroup.add(point);

      const orb = new THREE.Mesh(finialGeo, goldTrimMat);
      const orbR = 0.242;
      orb.position.set(
        Math.sin(angle) * orbR,
        bandHeight + 0.116 + (heightScale - 1) * 0.11,
        Math.cos(angle) * orbR
      );
      crownGroup.add(orb);
    }

    return crownGroup;
  }

  /**
   * Builds clean, normal masculine facial features (small normal eyes, strong brows, normal nose & normal mouth)
   * attached directly to the character's head bone without altering the character body/style.
   */
  private createMasculineFaceFeatures(skinMaterial: THREE.MeshStandardMaterial | null): THREE.Group {
    const faceGroup = new THREE.Group();
    faceGroup.name = 'MasculineFaceFeatures';

    const skinMat =
      skinMaterial ||
      new THREE.MeshStandardMaterial({
        color: 0xf8cfb2,
        roughness: 0.7,
        metalness: 0.0,
      });

    const eyelidShadeMat = new THREE.MeshStandardMaterial({
      color: 0xd9a888,
      roughness: 0.75,
      metalness: 0.0,
    });

    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xf2efe9,
      roughness: 0.4,
      metalness: 0.0,
    });

    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x2c2018, // Natural dark brown manly eye color
      roughness: 0.3,
      metalness: 0.05,
    });

    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x101012,
      roughness: 0.25,
      metalness: 0.0,
    });

    const browMat = new THREE.MeshStandardMaterial({
      color: 0x855a2b, // Natural masculine brow tone matching golden-blond hair
      roughness: 0.85,
      metalness: 0.0,
    });

    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0x99584f, // Calm natural mouth tone
      roughness: 0.65,
      metalness: 0.0,
    });

    const lowerLipMat = new THREE.MeshStandardMaterial({
      color: 0xc98b79,
      roughness: 0.7,
      metalness: 0.0,
    });

    // 1. Small Normal Eyes & Strong Masculine Eyebrows (head bone local Y = y_world - 0.640)
    const eyeScleraGeo = new THREE.SphereGeometry(0.02, 12, 10);
    eyeScleraGeo.scale(1.05, 0.56, 0.42); // Small horizontal oval, normal human proportion

    const irisGeo = new THREE.SphereGeometry(0.011, 10, 10);
    irisGeo.scale(1.0, 1.0, 0.45);

    const pupilGeo = new THREE.SphereGeometry(0.0058, 8, 8);
    pupilGeo.scale(1.0, 1.0, 0.45);

    const upperLidGeo = new THREE.BoxGeometry(0.044, 0.006, 0.014);
    const browGeo = new THREE.BoxGeometry(0.048, 0.011, 0.015);

    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      // Left/Right eye placement flush on front face curve
      eyeSocket.position.set(side * 0.068, 0.165, 0.194);
      eyeSocket.rotation.y = side * 0.24;

      const sclera = new THREE.Mesh(eyeScleraGeo, scleraMat);
      eyeSocket.add(sclera);

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(0, 0, 0.0052);
      eyeSocket.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, 0.0078);
      eyeSocket.add(pupil);

      // Subtle natural upper eyelid line (no anime lashes)
      const upperLid = new THREE.Mesh(upperLidGeo, eyelidShadeMat);
      upperLid.position.set(0, 0.011, 0.002);
      upperLid.rotation.z = side * -0.04;
      eyeSocket.add(upperLid);

      // Straight, decisive masculine eyebrow
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(0, 0.029, 0.004);
      brow.rotation.z = side * 0.09; // Slight inward resolute angle
      eyeSocket.add(brow);

      faceGroup.add(eyeSocket);
    });

    // 2. Normal Sculpted Masculine Nose (matched to character skin material)
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, 0.132, 0.198);

    const noseBridgeGeo = new THREE.BoxGeometry(0.02, 0.044, 0.022);
    const noseBridge = new THREE.Mesh(noseBridgeGeo, skinMat);
    noseBridge.position.set(0, 0.014, 0.005);
    noseBridge.rotation.x = -0.22; // Slopes outward cleanly from brow bridge to nose tip
    noseGroup.add(noseBridge);

    const noseTipGeo = new THREE.SphereGeometry(0.014, 10, 10);
    noseTipGeo.scale(1.08, 0.86, 1.0);
    const noseTip = new THREE.Mesh(noseTipGeo, skinMat);
    noseTip.position.set(0, -0.006, 0.014);
    noseGroup.add(noseTip);

    const nostrilWingGeo = new THREE.SphereGeometry(0.0085, 8, 8);
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(nostrilWingGeo, skinMat);
      wing.position.set(side * 0.011, -0.009, 0.008);
      noseGroup.add(wing);
    });

    faceGroup.add(noseGroup);

    // 3. Normal Calm Masculine Mouth
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, 0.088, 0.181);

    const mouthLineGeo = new THREE.BoxGeometry(0.046, 0.0065, 0.01);
    const mouthLine = new THREE.Mesh(mouthLineGeo, mouthMat);
    mouthGroup.add(mouthLine);

    const lowerLipGeo = new THREE.BoxGeometry(0.032, 0.0055, 0.009);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lowerLipMat);
    lowerLip.position.set(0, -0.006, -0.001);
    mouthGroup.add(lowerLip);

    faceGroup.add(mouthGroup);

    return faceGroup;
  }

  /**
   * Smoothly crossfades between animations
   */
  public playAnimation(name: SultanAnimName, duration: number = 0.2) {
    if (!this.mixer || this.currentAnimName === name) return;

    const nextAction = this.actions.get(name);
    if (!nextAction) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(duration);
    }

    nextAction.reset().fadeIn(duration).play();
    this.currentAction = nextAction;
    this.currentAnimName = name;
  }

  /**
   * Trigger royal wave greeting
   */
  public wave() {
    if (!this.isLoaded || this.isWaving) return;
    this.isWaving = true;
    this.playAnimation('wave', 0.15);
  }

  public getRightHandWorldPos(out: THREE.Vector3): THREE.Vector3 {
    if (this.handAnchorR) {
      return this.handAnchorR.getWorldPosition(out);
    }
    return out.set(this.group.position.x - 0.35, this.group.position.y + 0.9, this.group.position.z);
  }

  /**
   * Update character rotation, animations, and shadows
   */
  public update(delta: number, state: SultanState, moveX: number, moveZ: number) {
    this.animTime += delta;

    if (state.isSleepingInBed) {
      this.isWaving = false;
      this.facingAngle = 0;
      this.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
      this.modelGroup.position.y = 0;
      this.shadowMesh.visible = false;
      if (this.isLoaded && this.mixer) {
        this.playAnimation('idle', 0.18);
        this.mixer.update(delta * 0.42);
      }
      if (this.upperLegL) {
        this.upperLegL.position.copy(this.restLegPosL);
        this.upperLegL.scale.set(1, 1, 1);
      }
      if (this.lowerLegL) this.lowerLegL.scale.set(1, 1, 1);
      if (this.upperLegR) {
        this.upperLegR.position.copy(this.restLegPosR);
        this.upperLegR.scale.set(1, 1, 1);
      }
      if (this.lowerLegR) this.lowerLegR.scale.set(1, 1, 1);
      if (this.lanternLight) this.lanternLight.visible = false;
      if (this.lanternHaloMesh) this.lanternHaloMesh.visible = false;
      return;
    }

    const isSeated = Boolean(state.isRiding || state.isSailing || state.isSittingOnThrone);

    // 1. Smooth rotation towards movement direction (locked to mount/boat angle when riding)
    if (!isSeated && state.isMoving && (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01)) {
      const targetAngle = Math.atan2(moveX, moveZ);
      let angleDiff = targetAngle - this.facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.facingAngle += angleDiff * Math.min(1.0, delta * 15.0);
    }
    this.modelGroup.rotation.set(0, this.facingAngle, 0);

    // 2. Play procedural footstep audio only when walking on foot
    if (!isSeated && state.isMoving && state.isGrounded) {
      soundManager.playFootstep(state.isRunning);
    }

    // 3. Animation state machine
    if (this.isLoaded && this.mixer) {
      if (isSeated) {
        this.isWaving = false;
        this.playAnimation('idle', 0.18);
      } else if (!state.isGrounded) {
        // Jumping state
        this.isWaving = false;
        this.playAnimation('jump', 0.12);
      } else if (this.isWaving) {
        // Continue waving unless player starts moving
        if (state.isMoving) {
          this.isWaving = false;
          if (state.isRunning) {
            this.playAnimation('run', 0.15);
          } else {
            this.playAnimation('walk', 0.15);
          }
        }
      } else if (state.isMoving) {
        if (state.isRunning) {
          this.playAnimation('run', 0.18);
        } else {
          this.playAnimation('walk', 0.18);
        }
      } else {
        this.playAnimation('idle', 0.25);
      }

      this.mixer.update(delta);

      // Apply clean seated riding pose AFTER mixer update when mounted on horse, carriage bench, boat, or royal throne
      if (state.isSailing || state.isRidingCarriage || state.isSittingOnThrone) {
        if (this.spineBone) {
          this.spineBone.rotateX(0.05);
        }
        if (this.upperLegL) {
          this.upperLegL.position.set(this.restLegPosL.x + 0.015, this.restLegPosL.y - 0.03, 0.03);
          this.upperLegL.quaternion.copy(this.boatUpperLegQuatL);
          this.upperLegL.scale.set(1.0, 1.12, 1.0);
        }
        if (this.lowerLegL) {
          this.lowerLegL.quaternion.copy(this.boatLowerLegQuatL);
          this.lowerLegL.scale.set(1.0, 1.05, 1.0);
        }
        if (this.upperLegR) {
          this.upperLegR.position.set(this.restLegPosR.x - 0.015, this.restLegPosR.y - 0.03, 0.03);
          this.upperLegR.quaternion.copy(this.boatUpperLegQuatR);
          this.upperLegR.scale.set(1.0, 1.12, 1.0);
        }
        if (this.lowerLegR) {
          this.lowerLegR.quaternion.copy(this.boatLowerLegQuatR);
          this.lowerLegR.scale.set(1.0, 1.05, 1.0);
        }
        if (this.upperArmL) this.upperArmL.quaternion.copy(this.boatUpperArmQuatL);
        if (this.lowerArmL) this.lowerArmL.quaternion.copy(this.boatLowerArmQuatL);
        if (this.upperArmR) this.upperArmR.quaternion.copy(this.boatUpperArmQuatR);
        if (this.lowerArmR) this.lowerArmR.quaternion.copy(this.boatLowerArmQuatR);
        this.modelGroup.position.y =
          state.isRidingCarriage && state.isMoving
            ? Math.abs(Math.sin(this.animTime * 11.0)) * 0.016
            : 0;
      } else if (state.isRiding) {
        if (this.spineBone) {
          this.spineBone.rotateX(0.06);
        }
        // Orient thighs outward/forward around horse saddle & drop shins+boots down outside the flanks
        if (this.upperLegL) {
          this.upperLegL.position.set(this.restLegPosL.x + 0.082, this.restLegPosL.y - 0.02, 0.02);
          this.upperLegL.quaternion.copy(this.rideUpperLegQuatL);
          this.upperLegL.scale.set(1.02, 1.24, 1.02);
        }
        if (this.lowerLegL) {
          this.lowerLegL.quaternion.copy(this.rideLowerLegQuatL);
          this.lowerLegL.scale.set(1.0, 1.14, 1.0);
        }
        if (this.upperLegR) {
          this.upperLegR.position.set(this.restLegPosR.x - 0.082, this.restLegPosR.y - 0.02, 0.02);
          this.upperLegR.quaternion.copy(this.rideUpperLegQuatR);
          this.upperLegR.scale.set(1.02, 1.24, 1.02);
        }
        if (this.lowerLegR) {
          this.lowerLegR.quaternion.copy(this.rideLowerLegQuatR);
          this.lowerLegR.scale.set(1.0, 1.14, 1.0);
        }
        // Bring arms forward smoothly to hold the horse reins
        if (this.upperArmL) {
          this.upperArmL.quaternion.copy(this.rideUpperArmQuatL);
        }
        if (this.lowerArmL) {
          this.lowerArmL.quaternion.copy(this.rideLowerArmQuatL);
        }
        if (this.upperArmR) {
          this.upperArmR.quaternion.copy(this.rideUpperArmQuatR);
        }
        if (this.lowerArmR) {
          this.lowerArmR.quaternion.copy(this.rideLowerArmQuatR);
        }
        this.modelGroup.position.y = state.isMoving
          ? Math.abs(Math.sin(this.animTime * 10.5)) * 0.032
          : Math.sin(this.animTime * 2.2) * 0.01;
      } else {
        if (this.upperLegL) {
          this.upperLegL.position.copy(this.restLegPosL);
          this.upperLegL.scale.set(1, 1, 1);
        }
        if (this.lowerLegL) this.lowerLegL.scale.set(1, 1, 1);
        if (this.upperLegR) {
          this.upperLegR.position.copy(this.restLegPosR);
          this.upperLegR.scale.set(1, 1, 1);
        }
        if (this.lowerLegR) this.lowerLegR.scale.set(1, 1, 1);

        // Hold right arm naturally out/back when leading a horse by the rope
        if (state.isLeadingHorse) {
          if (this.upperArmR) this.upperArmR.quaternion.copy(this.leadUpperArmQuatR);
          if (this.lowerArmR) this.lowerArmR.quaternion.copy(this.leadLowerArmQuatR);
        }

        this.modelGroup.position.y = 0;
      }
    }

    // 4. Contact shadow grounding adjustment (hidden while seated on horse or boat)
    this.shadowMesh.visible = !isSeated;
    if (!isSeated) {
      if (!state.isGrounded) {
        const shadowScale = Math.max(0.4, 1.0 - this.group.position.y * 0.25);
        this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
        (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.15,
          0.55 - this.group.position.y * 0.15
        );
      } else {
        this.shadowMesh.scale.set(1.0, 1.0, 1.0);
        (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.55;
      }
    }

    // 5. Handheld Lantern Illumination at Night
    const night = Math.max(0, Math.min(1, state.nightFactor ?? 0));
    const flicker =
      1 + Math.sin(this.animTime * 11.5) * 0.06 + Math.sin(this.animTime * 23.0) * 0.035;
    const isLit = night > 0.03;

    if (this.lanternLight) {
      this.lanternLight.visible = isLit;
      this.lanternLight.intensity = isLit ? night * 4.4 * flicker : 0;
    }
    if (this.lanternHaloMesh && this.lanternHaloMat) {
      this.lanternHaloMesh.visible = isLit;
      this.lanternHaloMat.opacity = isLit ? night * 0.34 * flicker : 0;
    }
    for (let i = 0; i < this.lanternFlameMats.length; i++) {
      const mat = this.lanternFlameMats[i];
      if (isLit) {
        mat.emissive.setHex(0xffc94d);
        mat.emissiveIntensity = night * 3.6 * flicker;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
    for (let i = 0; i < this.lanternGlowMats.length; i++) {
      const mat = this.lanternGlowMats[i];
      if (isLit) {
        mat.emissive.setHex(0xff9e2c);
        mat.emissiveIntensity = night * 2.5 * flicker;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  }

  public dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    if (this.crownNameTexture) {
      this.crownNameTexture.dispose();
    }
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  }
}
