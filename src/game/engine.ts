import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SultanCharacter, SultanState } from './sultan';
import { GrasslandEnvironment } from './environment';
import { FogBoundary } from './fogBoundary';
import { HorseManager, HorseEntity } from './horses';
import { CatManager } from './cats';
import { FarmManager, getFarmAnimalRadius } from './farm';
import {
  CitizenManager,
  ImprisonedCitizenInfo,
  ObstacleContext,
  PrisonEventInfo,
} from './citizens';
import { RomanBorderFence } from './borderFence';
import { LeadRopeVisual } from './ropeVisual';
import { getCoastlineX } from './sea';
import { soundManager } from './audio';
import { WeatherSystem } from './weather';
import { WarOutcomeEvent, WarPhase, WarSystem } from './warSystem';
import type { SavedPrisonerRecord } from './saveData';

// Pre-allocated vectors for zero GC in render loop
const _camOffset = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _lookTarget = new THREE.Vector3();
const _sultanHandPos = new THREE.Vector3();
const _horseHalterPos = new THREE.Vector3();

export interface EngineStats {
  speedKmh: number;
  isGrounded: boolean;
  proximityToFog: number;
  isBlockedByFog: boolean;
  fps: number;
  isMounted: boolean;
  isSailing: boolean;
  isNearBoat: boolean;
  mountedHorseLabel: string | null;
  nearbyHorseLabel: string | null;
  nearbyHorseHasCarriage: boolean;
  isLeadingHorse: boolean;
  ledHorseLabel: string | null;
  areGuardsFollowing: boolean;
  areGuardsProtecting: boolean;
  hasNearbyExecutable: boolean;
  isExecuting: boolean;
  executionPhaseLabel: string | null;
  executionCountdown: number | null;
  isNearRomanBorder: boolean;
  borderGuardMessage: string | null;
  isAtBorderGate: boolean;
  playerX: number;
  playerZ: number;
  playerFacing: number;
  isRidingCarriage: boolean;
  gpsTarget: { x: number; z: number } | null;
  gpsDistanceMeters: number;
  isAutoDrivingCarriage: boolean;
  gpsArrivedBanner: boolean;
  gameMinutes: number;
  isNight: boolean;
  nearbyMoneyCitizen: { id: string; labelAr: string; money: number } | null;
  nearbyImprisonTarget: { id: string; labelAr: string } | null;
  imprisonedCitizens: ImprisonedCitizenInfo[];
  isNearPrison: boolean;
  prisonEvent: PrisonEventInfo | null;
  isNearCannon: boolean;
  cannonCooldown: number;
  isRaining: boolean;
  isNearThrone: boolean;
  isSittingOnThrone: boolean;
  isNearRoyalBed: boolean;
  isSleepingInBed: boolean;
  isOnSpeechPodium: boolean;
  isNearVizier: boolean;
  vizierPhase: 'sleeping' | 'resting' | 'arriving' | 'bowing' | 'seated' | 'returning';
  isIntroTour: boolean;
  introTourLabel: string;
  warPhase: WarPhase;
  warPlayerRemaining: number;
  warRomanRemaining: number;
  warOutcomeEvent: WarOutcomeEvent | null;
}

export type CameraPreset = 'normal' | 'close' | 'wide';

export interface EngineInitOptions {
  lowQuality?: boolean;
  sultanName?: string;
  initialGameMinutes?: number;
  initialCitizenMoney?: Record<string, number>;
  initialPrisoners?: Record<string, SavedPrisonerRecord>;
  initialPlayerPos?: { x: number; y: number; z: number; facing: number };
  playIntroTour?: boolean;
  onIntroTourComplete?: () => void;
  signal?: AbortSignal;
  onProgress?: (progress: number, stageLabel: string) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 16));
  });
}

export class GameEngine {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public sultan!: SultanCharacter;
  public environment!: GrasslandEnvironment;
  public boundary!: FogBoundary;
  public borderFence!: RomanBorderFence;
  public horseManager!: HorseManager;
  public catManager!: CatManager;
  public farmManager!: FarmManager;
  public citizenManager!: CitizenManager;
  public warSystem!: WarSystem;
  private weather!: WeatherSystem;
  private readonly mapRadius: number = 90;

  // First-time aerial kingdom flyover tour
  private isIntroTour: boolean = false;
  private introTourElapsed: number = 0;
  private readonly introTourDuration: number = 14.0;
  private introPosCurve: THREE.CatmullRomCurve3 | null = null;
  private introLookCurve: THREE.CatmullRomCurve3 | null = null;
  private onIntroTourCompleteCb?: () => void;

  private container: HTMLElement;
  private animFrameId: number = 0;
  private softwareTimerId: number = 0;
  private isDestroyed: boolean = false;
  private isPaused: boolean = false;
  private clock: THREE.Clock;
  private isSoftwareGl: boolean = false;
  private isLowEndMobileGpu: boolean = false;
  private isLowQualityMode: boolean = false;
  private shadowFrameCounter: number = 0;
  private lowFpsStreak: number = 0;
  private highFpsStreak: number = 0;
  private adaptiveDprPenalty: number = 0;

  // Camera Orbit & Tracking
  public cameraPreset: CameraPreset = 'normal';
  public cameraYaw: number = 0; // horizontal orbit angle
  public cameraPitch: number = 0.24; // vertical orbit angle showing terrain, roads, and sky clouds
  private cameraDistance: number = 7.0;
  private targetCameraDistance: number = 7.0;

  // Player Physics & Movement State
  private sultanPos = new THREE.Vector3(0, 0, 0);
  private sultanVelocityY = 0;
  private isGrounded = true;
  private isRunning = false;
  private isWalkingLocked = false;
  private stickInput = { x: 0, y: 0 }; // x: -1 to 1, y: -1 to 1

  // Horse Riding, Boat Sailing & Rope Leading State
  private mountedHorse: HorseEntity | null = null;
  private isSailingBoat: boolean = false;
  private ledHorse: HorseEntity | null = null;
  private nearbyHorse: HorseEntity | null = null;
  private sultanRopeVisual!: LeadRopeVisual;

  // Royal Bodyguards, Throne & Bed State
  private guardsFollowing: boolean = true;
  private guardsProtectMode: boolean = false;
  private isSittingOnThrone: boolean = false;
  private isSleepingInBed: boolean = false;

  // Pre-allocated obstacle context for realistic citizen pathing (zero GC per frame)
  private citizenObstacles!: ObstacleContext;

  // Keyboard input fallback for desktop testing
  private keys = { w: false, a: false, s: false, d: false, shift: false, space: false };

  // Callbacks for UI updates
  public onStatsUpdate?: (stats: EngineStats) => void;
  private onContextLostCb?: () => void;
  private onContextRestoredCb?: () => void;
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 60;
  private lastHudEmitElapsed = -1;
  private lastHudFlagsKey = '';
  private lastHudHour = -1;

  // Lighting, Time-of-Day & Border Tracking
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private totalElapsed: number = 0;
  private gameMinutes: number = 8 * 60; // 08:00 AM Day 1 (1 real sec = 1 game min)
  private wasNearRomanBorder: boolean = false;
  private cameraShake: number = 0;

  // GPS Waypoint & Carriage Auto-Drive
  private gpsTarget: { x: number; z: number } | null = null;
  private gpsArrivedTimer: number = 0;
  private autoDriveStuckTimer: number = 0;
  private autoDriveLastPos = new THREE.Vector3();
  private autoDriveDetourTimer: number = 0;
  private autoDriveDetourDir: number = 1;
  private gpsBeaconGroup: THREE.Group | null = null;
  private gpsBeamMesh: THREE.Mesh | null = null;
  private gpsDiamondMesh: THREE.Mesh | null = null;
  private gpsRingMesh: THREE.Mesh | null = null;
  private gpsBaseDiamondY: number = 2.25;
  private gpsBeaconDisposables: { dispose: () => void }[] = [];

  private constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
  }

  public static async createAsync(
    container: HTMLElement,
    options: EngineInitOptions = {}
  ): Promise<GameEngine | null> {
    const engine = new GameEngine(container);
    const {
      lowQuality = false,
      sultanName = 'السلطان',
      initialGameMinutes,
      initialCitizenMoney,
      initialPrisoners,
      initialPlayerPos,
      playIntroTour = false,
      onIntroTourComplete,
      signal,
      onProgress,
      onContextLost,
      onContextRestored,
    } = options;

    if (typeof initialGameMinutes === 'number' && Number.isFinite(initialGameMinutes)) {
      engine.gameMinutes = Math.max(0, initialGameMinutes);
    }

    engine.onContextLostCb = onContextLost;
    engine.onContextRestoredCb = onContextRestored;
    engine.onIntroTourCompleteCb = onIntroTourComplete;

    const report = (pct: number, label: string) => {
      if (!signal?.aborted && !engine.isDestroyed) {
        onProgress?.(Math.min(100, Math.max(0, Math.round(pct))), label);
      }
    };

    const isAborted = () => Boolean(signal?.aborted || engine.isDestroyed);

    try {
      report(8, 'تهيئة محرك العرض ثلاثي الأبعاد...');
      await yieldToBrowser();
      if (isAborted()) {
        engine.destroy();
        return null;
      }

      engine.initRendererAndScene(lowQuality);
      report(24, 'إعداد الإضاءة والسماء والضباب...');
      await yieldToBrowser();
      if (isAborted()) {
        engine.destroy();
        return null;
      }

      engine.environment = new GrasslandEnvironment(engine.mapRadius);
      engine.scene.add(engine.environment.group);
      report(42, 'بناء السهول العشبية والبحر والقرية الملكية...');
      await yieldToBrowser();
      if (isAborted()) {
        engine.destroy();
        return null;
      }

      engine.boundary = new FogBoundary(engine.mapRadius);
      engine.scene.add(engine.boundary.group);

      engine.borderFence = new RomanBorderFence(
        engine.mapRadius,
        engine.environment.village.boxColliders
      );
      engine.scene.add(engine.borderFence.group);

      engine.weather = new WeatherSystem(engine.scene);

      engine.horseManager = new HorseManager();
      engine.scene.add(engine.horseManager.group);

      engine.catManager = new CatManager();
      engine.scene.add(engine.catManager.group);

      engine.farmManager = new FarmManager(engine.environment.village.boxColliders);
      engine.scene.add(engine.farmManager.group);

      // Build 2D spatial hash grid once all static world colliders are registered
      engine.environment.rebuildCollisionGrid();
      report(58, 'تجهيز السياج والغابة والمزرعة والخيول...');
      await yieldToBrowser();
      if (isAborted()) {
        engine.destroy();
        return null;
      }

      // Track real GLB model downloads & initialization via THREE.LoadingManager
      const loadingManager = new THREE.LoadingManager();
      loadingManager.onProgress = (_url, loaded, total) => {
        if (total > 0) {
          const ratio = Math.min(1, loaded / total);
          report(62 + ratio * 24, 'تحميل مجسمات السلطان والحرس والمواطنين...');
        }
      };

      report(62, 'تحميل مجسمات السلطان والحرس والمواطنين...');

      let sultanDone = false;
      let citizensDone = false;
      let resolveModels!: () => void;
      const modelsReadyPromise = new Promise<void>((resolve) => {
        resolveModels = resolve;
      });
      const checkAllModelsDone = () => {
        if (sultanDone && citizensDone) {
          resolveModels();
        }
      };

      engine.citizenManager = new CitizenManager(loadingManager, () => {
        citizensDone = true;
        checkAllModelsDone();
      });
      if (initialCitizenMoney) {
        engine.citizenManager.setCitizenMoneyMap(initialCitizenMoney);
      }
      if (initialPrisoners) {
        engine.citizenManager.setPrisonersSaveMap(
          initialPrisoners,
          engine.environment.village.prison,
          engine.gameMinutes
        );
      }
      engine.scene.add(engine.citizenManager.group);

      engine.citizenObstacles = {
        boxes: engine.environment.village.boxColliders,
        cylinders: engine.environment.village.cylinderColliders,
        trees: engine.environment.trees.colliders,
        horses: engine.horseManager.horses,
        farmAnimals: engine.farmManager.animals,
        isPointBlockedStatic: (x, z, radius, skipStandable) =>
          engine.environment.isStaticPointObstructed(x, z, radius, skipStandable),
      };

      engine.sultan = new SultanCharacter(
        () => {
          sultanDone = true;
          checkAllModelsDone();
        },
        loadingManager,
        () => {
          sultanDone = true;
          checkAllModelsDone();
        }
      );
      engine.sultan.setSultanName(sultanName);
      if (initialPlayerPos) {
        engine.sultanPos.set(initialPlayerPos.x, initialPlayerPos.y, initialPlayerPos.z);
        engine.sultan.facingAngle = initialPlayerPos.facing || 0;
        engine.environment.resolveCollisions(engine.sultanPos, 0.45);
        engine.boundary.enforceBoundary(engine.sultanPos);
      } else {
        engine.sultanPos.set(0, 0, 0);
      }
      engine.sultan.group.position.copy(engine.sultanPos);
      engine.scene.add(engine.sultan.group);

      engine.sultanRopeVisual = new LeadRopeVisual(10, 0xd4aa6a);
      engine.scene.add(engine.sultanRopeVisual.group);
      engine.initGpsBeacon();

      engine.warSystem = new WarSystem();
      engine.scene.add(engine.warSystem.group);

      // Wait for all GLB models (with safety timeout so a slow/blocked asset never hangs indefinitely)
      await Promise.race([
        modelsReadyPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 18000)),
      ]);

      const kt = engine.citizenManager.getKnightTemplateData();
      if (kt) {
        engine.environment.village.militaryCamp.attachKnightTemplate(
          kt.template,
          kt.walkClip,
          kt.idleClip
        );
        engine.warSystem.attachKnightTemplate(kt.template, kt.walkClip, kt.idleClip);
      }

      if (isAborted()) {
        engine.destroy();
        return null;
      }

      report(90, 'تحضير المظللات وتثبيت الإطارات...');
      await yieldToBrowser();
      if (isAborted()) {
        engine.destroy();
        return null;
      }

      if (playIntroTour) {
        engine.initIntroTour();
      } else {
        // Initialize camera placement immediately so frame 1 direction matches screen space
        engine.camera.position.set(
          engine.sultanPos.x +
            engine.cameraDistance * Math.cos(engine.cameraPitch) * Math.sin(engine.cameraYaw),
          engine.sultanPos.y +
            engine.cameraDistance * Math.sin(engine.cameraPitch) +
            1.2,
          engine.sultanPos.z +
            engine.cameraDistance * Math.cos(engine.cameraPitch) * Math.cos(engine.cameraYaw)
        );
        engine.camera.lookAt(engine.sultanPos.x, engine.sultanPos.y + 1.45, engine.sultanPos.z);
      }

      if (!engine.isSoftwareGl) {
        if (typeof engine.renderer.compileAsync === 'function') {
          await engine.renderer.compileAsync(engine.scene, engine.camera);
        } else {
          engine.renderer.compile(engine.scene, engine.camera);
        }
      }

      // Render 2 silent warmup frames so GPU buffers settle before user can interact
      const initHour = (engine.gameMinutes % 1440) / 60;
      for (let i = 0; i < 2; i++) {
        if (isAborted()) {
          engine.destroy();
          return null;
        }
        engine.environment.update(0.016, engine.camera);
        engine.environment.updateTimeOfDay(
          initHour,
          engine.scene,
          engine.hemiLight,
          engine.dirLight,
          engine.fillLight,
          engine.sultanPos,
          engine.boundary,
          engine.camera
        );
        engine.boundary.update(0.016, engine.camera);
        engine.borderFence.update(0.016 * (i + 1));
        engine.renderer.render(engine.scene, engine.camera);
        await yieldToBrowser();
      }

      if (isAborted()) {
        engine.destroy();
        return null;
      }

      report(100, 'العالم جاهز! تم التحميل بنجاح');
      engine.attachListenersAndStartLoop();
      return engine;
    } catch (err) {
      engine.destroy();
      throw err;
    }
  }

  private getEffectivePixelRatio(lowQuality: boolean): number {
    if (this.isSoftwareGl) return 1;
    const rawDpr = window.devicePixelRatio || 1;
    if (lowQuality) {
      return this.isLowEndMobileGpu ? 0.9 : 0.95;
    }
    if (this.isLowEndMobileGpu) {
      return Math.max(0.95, Math.min(rawDpr, 1.25) - this.adaptiveDprPenalty);
    }
    return Math.min(rawDpr, 1.75);
  }

  private initRendererAndScene(lowQuality: boolean) {
    this.isLowQualityMode = lowQuality;

    // 1. Detect software WebGL & tile-based entry-level mobile GPUs (e.g., PowerVR GE8320, Mali-G31/T, Adreno 3xx/4xx/50x)
    const gpuProfile = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return { software: true, lowMobile: false };
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        const software = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
        const isMobileTouch =
          typeof window !== 'undefined' &&
          ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
            /Android|Mobile/i.test(navigator.userAgent || ''));
        const devMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
        const lowGpuMatch =
          /PowerVR|GE83|Mali-G31|Mali-G51|Mali-T|Adreno\s*\(?(TM)?\s*(3\d\d|4\d\d|50\d)|VideoCore/i.test(
            gpu
          );
        const lowMobile =
          !software &&
          (lowGpuMatch || (isMobileTouch && typeof devMem === 'number' && devMem <= 4));
        return { software, lowMobile };
      } catch {
        return { software: false, lowMobile: false };
      }
    })();

    this.isSoftwareGl = gpuProfile.software;
    this.isLowEndMobileGpu = gpuProfile.lowMobile;

    // 2. WebGL Renderer (disable costly tile MSAA & stencil buffer on low-end mobile GPUs while keeping full visuals)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !lowQuality && !this.isLowEndMobileGpu,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.getEffectivePixelRatio(lowQuality));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && !lowQuality;
    this.renderer.shadowMap.type = this.isLowEndMobileGpu
      ? THREE.BasicShadowMap
      : THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    // 3. Scene Setup & Sky Fog
    this.scene = new THREE.Scene();
    const skyFogColor = new THREE.Color(0xc2d8e8);
    this.scene.background = skyFogColor;
    // Horizon Fog seamlessly blending with the mist boundary while keeping clouds clear
    this.scene.fog = new THREE.FogExp2(skyFogColor, 0.0085);

    // 4. Camera (Optimized field of view for vertical portrait screens + tight far clip matching fog)
    const isPortrait = height > width;
    const fov = isPortrait ? 60 : 50;
    const farClip = this.isLowEndMobileGpu ? 220 : 265;
    this.camera = new THREE.PerspectiveCamera(fov, width / height, 0.2, farClip);
    this.updateCameraPresetDistance();
    this.cameraDistance = this.targetCameraDistance;

    // 5. Studio Environment Map (PMREMGenerator)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // RoomEnvironment fallback safe
    }

    // 6. 3-Point Studio & Sun Lighting
    this.hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0x626468, 0.92);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff4db, 1.55);
    this.dirLight.position.set(16, 32, -48);
    if (!this.isSoftwareGl && !lowQuality) {
      const shadowRes = this.isLowEndMobileGpu ? 768 : 1024;
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = shadowRes;
      this.dirLight.shadow.mapSize.height = shadowRes;
      this.dirLight.shadow.camera.near = 10;
      this.dirLight.shadow.camera.far = 110;
      const d = 28;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    // Soft Fill Light illuminating Sultan's face and front crown plaque
    this.fillLight = new THREE.DirectionalLight(0xdfeeff, 0.72);
    this.fillLight.position.set(-16, 16, 28);
    this.scene.add(this.fillLight);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.isPaused = true;
    this.onContextLostCb?.();
  };

  private handleContextRestored = () => {
    this.isPaused = false;
    this.clock.getDelta();
    this.onContextRestoredCb?.();
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.clock.getDelta();
      this.lastFpsTime = performance.now();
      this.frameCount = 0;
    }
  };

  private attachListenersAndStartLoop() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.clock.getDelta();
    this.lastFpsTime = performance.now();
    this.tick();
  }

  private updateCameraPresetDistance() {
    if (this.cameraPreset === 'close') {
      this.targetCameraDistance = 4.5;
    } else if (this.cameraPreset === 'wide') {
      this.targetCameraDistance = 10.0;
    } else {
      this.targetCameraDistance = 6.8;
    }
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraPreset = preset;
    this.updateCameraPresetDistance();
  }

  public resetCameraBehindSultan() {
    // Smoothly align camera yaw behind current Sultan facing angle
    this.cameraYaw = this.sultan.facingAngle + Math.PI;
    this.cameraPitch = 0.24;
  }

  public refreshViewportSize() {
    this.onResize();
  }

  public setPerformanceMode(lowQuality: boolean) {
    this.isLowQualityMode = lowQuality;
    this.adaptiveDprPenalty = 0;
    this.renderer.shadowMap.enabled = !lowQuality && !this.isSoftwareGl;
    this.renderer.setPixelRatio(this.getEffectivePixelRatio(lowQuality));
    this.dirLight.castShadow = !lowQuality && !this.isSoftwareGl;
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  public setStickInput(x: number, y: number) {
    this.stickInput.x = x;
    this.stickInput.y = y;
  }

  public setRunning(running: boolean) {
    this.isRunning = running;
  }

  public toggleWalkingLock() {
    this.isWalkingLocked = !this.isWalkingLocked;
  }

  public jump() {
    if (this.isSittingOnThrone) {
      this.sitOrStandFromThrone();
      return;
    }
    if (this.isSleepingInBed) {
      this.toggleSleepInRoyalBed();
      return;
    }
    if (this.isSailingBoat) return;

    if (this.mountedHorse) {
      if (this.mountedHorse.isGrounded) {
        this.mountedHorse.isGrounded = false;
        this.mountedHorse.velocityY = 8.4;
        soundManager.playJump();
      }
      return;
    }

    if (this.isGrounded) {
      this.isGrounded = false;
      this.sultanVelocityY = 8.6; // initial jump impulse
      soundManager.playJump();
    }
  }

  public sitOrStandFromThrone() {
    const palace = this.environment?.village?.palace;
    if (!palace) return;

    if (this.isSittingOnThrone) {
      this.isSittingOnThrone = false;
      palace.setThroneColliderActive(true);
      this.sultanPos.copy(palace.throneStandPos);
      this.environment.resolveCollisions(this.sultanPos, 0.45);
      this.boundary.enforceBoundary(this.sultanPos);
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      this.lastHudEmitElapsed = -1;
      soundManager.playLand();
      return;
    }

    if (
      this.mountedHorse ||
      this.isSailingBoat ||
      this.isSleepingInBed ||
      this.citizenManager?.getExecutionStatus().isExecuting
    ) {
      return;
    }

    if (!palace.isSultanNearThrone(this.sultanPos)) return;

    this.ledHorse = null;
    this.sultanRopeVisual.setVisible(false);
    this.isSittingOnThrone = true;
    palace.setThroneColliderActive(false);
    this.sultanPos.copy(palace.throneSeatPos);
    this.sultan.facingAngle = 0;
    this.sultanVelocityY = 0;
    this.isGrounded = true;
    this.lastHudEmitElapsed = -1;
    soundManager.playJump();
  }

  public mountOrDismount() {
    if (this.isSittingOnThrone) {
      this.sitOrStandFromThrone();
      return;
    }
    if (this.isSleepingInBed) {
      this.toggleSleepInRoyalBed();
      return;
    }
    if (this.isSailingBoat) {
      this.environment.sea.getBoatDisembarkTarget(this.sultanPos);
      this.environment.resolveCollisions(this.sultanPos, 0.45);
      this.boundary.enforceBoundary(this.sultanPos);
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      this.isSailingBoat = false;
      this.environment.sea.setBoatOccupied(false);
      this.citizenManager.disembarkBodyguardsFromBoat(
        this.sultanPos,
        (p, r) => this.environment.resolveCollisions(p, r),
        (p) => this.boundary.enforceBoundary(p),
        this.environment.sea
      );
      soundManager.playLand();
      return;
    }

    if (this.mountedHorse) {
      // Dismount smoothly onto dry ground beside the carriage door or horse right side
      const h = this.mountedHorse;
      const wasCarriage = h.hasCarriage;
      const sideAngle = h.facingAngle + Math.PI / 2;
      if (wasCarriage) {
        this.sultanPos.set(
          h.pos.x - Math.sin(h.facingAngle) * 2.65 + Math.sin(sideAngle) * 1.55,
          0,
          h.pos.z - Math.cos(h.facingAngle) * 2.65 + Math.cos(sideAngle) * 1.55
        );
      } else {
        this.sultanPos.set(
          h.pos.x + Math.sin(sideAngle) * 1.35,
          0,
          h.pos.z + Math.cos(sideAngle) * 1.35
        );
      }
      this.environment.resolveCollisions(this.sultanPos, 0.45);
      this.boundary.enforceBoundary(this.sultanPos);
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      this.mountedHorse = null;
      if (wasCarriage) {
        this.citizenManager.disembarkBodyguardsFromCarriage(
          this.sultanPos,
          (p, r) => this.environment.resolveCollisions(p, r),
          (p) => this.boundary.enforceBoundary(p)
        );
      }
      soundManager.playLand();
      return;
    }

    // Check Royal Sailboat boarding first when near the harbor boat
    if (
      !this.citizenManager.getExecutionStatus().isExecuting &&
      this.environment.sea.isSultanNearBoat(this.sultanPos, 5.4)
    ) {
      this.ledHorse = null;
      this.sultanRopeVisual.setVisible(false);
      this.isSailingBoat = true;
      this.environment.sea.setBoatOccupied(true);
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      soundManager.playJump();
      return;
    }

    const candidate = this.ledHorse || this.horseManager.findNearestMountable(this.sultanPos, 3.2);
    if (candidate) {
      this.ledHorse = null;
      this.sultanRopeVisual.setVisible(false);
      this.mountedHorse = candidate;
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      soundManager.playJump();
    }
  }

  public toggleLeadHorse() {
    if (this.mountedHorse || this.isSailingBoat || this.isSittingOnThrone) return;

    if (this.ledHorse) {
      this.ledHorse = null;
      this.sultanRopeVisual.setVisible(false);
      soundManager.playLand();
      return;
    }

    const candidate = this.horseManager.findNearestMountable(this.sultanPos, 3.4);
    if (candidate) {
      this.ledHorse = candidate;
      this.sultanRopeVisual.setVisible(true);
      soundManager.playJump();
    }
  }

  public wave() {
    this.sultan.wave();
  }

  public toggleGuardsFollow() {
    this.guardsFollowing = !this.guardsFollowing;
  }

  public triggerGuardsBow() {
    this.citizenManager.bowBodyguards();
  }

  public toggleGuardsProtectMode(): boolean {
    if (!this.citizenManager) return false;
    this.guardsProtectMode = this.citizenManager.toggleGuardsProtectMode();
    if (this.guardsProtectMode) {
      this.guardsFollowing = true;
    }
    soundManager.playJump();
    this.lastHudEmitElapsed = -1;
    return this.guardsProtectMode;
  }

  public dismissVizier(): boolean {
    if (!this.citizenManager || !this.environment?.village) return false;
    const ok = this.citizenManager.dismissVizier(this.environment.village);
    if (ok) {
      this.lastHudEmitElapsed = -1;
      soundManager.playJump();
    }
    return ok;
  }

  public executeNearestCitizen() {
    this.citizenManager.startExecutionNear(this.sultanPos);
  }

  public feedNearestCitizenToLion(): boolean {
    if (!this.citizenManager) return false;
    const ok = this.citizenManager.startFeedLionNear(this.sultanPos);
    if (ok) {
      this.lastHudEmitElapsed = -1;
    }
    return ok;
  }

  public toggleSleepInRoyalBed(): boolean {
    const palace = this.environment?.village?.palace;
    if (!palace) return false;

    if (this.isSleepingInBed) {
      this.isSleepingInBed = false;
      this.sultanPos.copy(palace.sultanBedStandPos);
      this.environment.resolveCollisions(this.sultanPos, 0.45);
      this.boundary.enforceBoundary(this.sultanPos);
      this.sultanVelocityY = 0;
      this.isGrounded = true;
      this.lastHudEmitElapsed = -1;
      soundManager.playLand();
      return true;
    }

    if (
      this.mountedHorse ||
      this.isSailingBoat ||
      this.isSittingOnThrone ||
      this.citizenManager?.getExecutionStatus().isExecuting
    ) {
      return false;
    }

    if (!palace.isSultanNearRoyalBed(this.sultanPos)) return false;

    this.ledHorse = null;
    this.sultanRopeVisual.setVisible(false);
    this.isSleepingInBed = true;
    this.sultanPos.copy(palace.sultanBedSleepPos);
    this.sultan.facingAngle = 0;
    this.sultanVelocityY = 0;
    this.isGrounded = true;
    this.lastHudEmitElapsed = -1;
    soundManager.playLand();
    return true;
  }

  public imprisonNearestCitizen(sentenceMinutes: number = 60) {
    this.citizenManager.startImprisonNear(
      this.sultanPos,
      this.environment.village.prison,
      sentenceMinutes
    );
  }

  public fireCannon(): boolean {
    const cannon = this.environment?.village?.cannon;
    if (!cannon || !cannon.isSultanNear(this.sultanPos, 6.2)) return false;
    const fired = cannon.fire();
    if (fired) {
      this.cameraShake = 0.55;
      this.sultan.wave();
      if (this.warSystem?.isActive()) {
        this.warSystem.applyCannonBlast(2, -9.5, 30);
      }
      this.lastHudEmitElapsed = -1;
    }
    return fired;
  }

  public declareWar(playerArmyCount: number): boolean {
    if (this.isIntroTour) return false;
    const ok = this.warSystem ? this.warSystem.declareWar(playerArmyCount) : false;
    if (ok) {
      this.lastHudEmitElapsed = -1;
    }
    return ok;
  }

  private initIntroTour() {
    this.isIntroTour = true;
    this.introTourElapsed = 0;

    const endYaw = this.sultan.facingAngle + Math.PI;
    this.cameraYaw = endYaw;
    this.cameraPitch = 0.24;
    const endDist = this.targetCameraDistance;
    const endCamX =
      this.sultanPos.x + endDist * Math.cos(this.cameraPitch) * Math.sin(endYaw);
    const endCamY =
      this.sultanPos.y + endDist * Math.sin(this.cameraPitch) + 1.2;
    const endCamZ =
      this.sultanPos.z + endDist * Math.cos(this.cameraPitch) * Math.cos(endYaw);

    this.introPosCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-62, 26, 22),
      new THREE.Vector3(-24, 24, 62),
      new THREE.Vector3(26, 22, 56),
      new THREE.Vector3(64, 24, 16),
      new THREE.Vector3(20, 22, -6),
      new THREE.Vector3(-24, 21, -82),
      new THREE.Vector3(22, 18, -32),
      new THREE.Vector3(endCamX, endCamY, endCamZ),
    ]);

    this.introLookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-42, 1.5, 4),
      new THREE.Vector3(-4, 2.0, 44),
      new THREE.Vector3(18, 2.0, 46),
      new THREE.Vector3(68, 2.8, 3.5),
      new THREE.Vector3(4, 2.4, -14),
      new THREE.Vector3(0, 2.6, -75),
      new THREE.Vector3(0, 4.2, -46),
      new THREE.Vector3(this.sultanPos.x, this.sultanPos.y + 1.45, this.sultanPos.z),
    ]);

    const startPos = this.introPosCurve.getPointAt(0);
    const startLook = this.introLookCurve.getPointAt(0);
    this.camera.position.copy(startPos);
    this.camera.lookAt(startLook);
  }

  private getIntroTourLabel(t: number): string {
    if (t < 0.16) return 'الميناء والبحر الملكي';
    if (t < 0.32) return 'المزرعة والمقبرة والمقهى الملكي';
    if (t < 0.48) return 'غابة الزيتون والحدود الرومانية';
    if (t < 0.65) return 'ساحة المملكة والسجن والأسد';
    if (t < 0.80) return 'معسكر الجيش الملكي';
    if (t < 0.92) return 'القصر الملكي';
    return 'السلطان — تبدأ المغامرة!';
  }

  private finishIntroTour() {
    if (!this.isIntroTour) return;
    this.isIntroTour = false;
    this.introPosCurve = null;
    this.introLookCurve = null;
    this.cameraYaw = this.sultan.facingAngle + Math.PI;
    this.cameraPitch = 0.24;
    this.lastHudEmitElapsed = -1;
    soundManager.playCoinChime();
    this.onIntroTourCompleteCb?.();
  }

  public skipIntroTour() {
    if (!this.isIntroTour) return;
    const endDist = this.targetCameraDistance;
    const endYaw = this.sultan.facingAngle + Math.PI;
    this.camera.position.set(
      this.sultanPos.x + endDist * Math.cos(0.24) * Math.sin(endYaw),
      this.sultanPos.y + endDist * Math.sin(0.24) + 1.2,
      this.sultanPos.z + endDist * Math.cos(0.24) * Math.cos(endYaw)
    );
    this.camera.lookAt(this.sultanPos.x, this.sultanPos.y + 1.45, this.sultanPos.z);
    this.finishIntroTour();
  }

  public rotateCannonAim(deltaYaw: number) {
    const cannon = this.environment?.village?.cannon;
    if (!cannon || !cannon.isSultanNear(this.sultanPos, 6.2)) return;
    cannon.rotateAim(deltaYaw);
  }

  public releasePrisoner(citizenId: string): boolean {
    if (!this.citizenManager) return false;
    return this.citizenManager.releasePrisonerById(
      citizenId,
      this.environment.village.prison
    );
  }

  public getPrisonersSaveMap(): Record<string, SavedPrisonerRecord> {
    return this.citizenManager
      ? this.citizenManager.getPrisonersSaveMap(this.gameMinutes)
      : {};
  }

  public setPrisonersSaveMap(map: Record<string, SavedPrisonerRecord>) {
    this.citizenManager?.setPrisonersSaveMap(
      map,
      this.environment.village.prison,
      this.gameMinutes
    );
  }

  public setSultanName(name: string) {
    this.sultan.setSultanName(name);
  }

  public getGameMinutes(): number {
    return this.gameMinutes;
  }

  public setGameMinutes(minutes: number) {
    if (Number.isFinite(minutes)) {
      this.gameMinutes = Math.max(0, minutes);
      this.lastHudEmitElapsed = -1;
    }
  }

  public isRaining(): boolean {
    return this.weather ? this.weather.isRaining() : false;
  }

  public toggleRain(): boolean {
    if (!this.weather) return false;
    const next = this.weather.toggleManualRain();
    this.lastHudEmitElapsed = -1;
    return next;
  }

  public setRainEnabled(enabled: boolean) {
    if (!this.weather) return;
    this.weather.setRainEnabled(enabled);
    this.lastHudEmitElapsed = -1;
  }

  public triggerThunder() {
    if (!this.weather) return;
    this.weather.triggerThunder();
    if (this.weather.consumeThunderTrigger()) {
      soundManager.playThunder();
      this.cameraShake = Math.max(this.cameraShake, 0.08);
    }
  }

  public setCitizenMoneyMap(map: Record<string, number>) {
    this.citizenManager?.setCitizenMoneyMap(map);
  }

  public getCitizenMoneyMap(): Record<string, number> {
    return this.citizenManager ? this.citizenManager.getCitizenMoneyMap() : {};
  }

  public takeMoneyFromCitizen(citizenId: string, amount: number) {
    return this.citizenManager ? this.citizenManager.takeMoneyFromCitizen(citizenId, amount) : null;
  }

  public distributeStipendToCitizens(amountPerCitizen: number): number {
    return this.citizenManager ? this.citizenManager.distributeStipendToCitizens(amountPerCitizen) : 0;
  }

  public getPlayerTransform(): { x: number; y: number; z: number; facing: number } {
    return {
      x: this.sultanPos.x,
      y: this.sultanPos.y,
      z: this.sultanPos.z,
      facing: this.sultan.facingAngle,
    };
  }

  public setPlayerTransform(x: number, y: number, z: number, facing: number) {
    if (this.isSittingOnThrone) {
      this.isSittingOnThrone = false;
      this.environment?.village?.palace?.setThroneColliderActive(true);
    }
    if (this.mountedHorse) {
      this.mountedHorse = null;
    }
    if (this.isSailingBoat) {
      this.isSailingBoat = false;
      this.environment.sea.setBoatOccupied(false);
    }
    this.sultanPos.set(x, y, z);
    this.sultan.facingAngle = facing;
    this.environment.resolveCollisions(this.sultanPos, 0.45);
    this.boundary.enforceBoundary(this.sultanPos);
    this.sultan.group.position.copy(this.sultanPos);
  }

  private initGpsBeacon() {
    const g = new THREE.Group();
    g.visible = false;

    const ringGeo = new THREE.RingGeometry(0.95, 1.32, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.05;
    g.add(ring);

    const beamGeo = new THREE.CylinderGeometry(0.12, 0.28, 3.8, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.9;
    g.add(beam);

    const diamondGeo = new THREE.OctahedronGeometry(0.42, 0);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.7,
    });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.y = 2.25;
    g.add(diamond);

    this.gpsBeaconDisposables.push(
      ringGeo,
      ringMat,
      beamGeo,
      beamMat,
      diamondGeo,
      diamondMat
    );
    this.gpsRingMesh = ring;
    this.gpsBeamMesh = beam;
    this.gpsDiamondMesh = diamond;
    this.gpsBeaconGroup = g;
    this.scene.add(g);
  }

  public setGpsTarget(rawX: number, rawZ: number) {
    let z = Math.max(-84, Math.min(84, rawZ));
    const minLandX = getCoastlineX(z) + 2.4;
    let x = Math.max(minLandX, Math.min(84, rawX));
    const distR = Math.hypot(x, z);
    if (distR > 84.5) {
      const s = 84.5 / distR;
      x *= s;
      z *= s;
      x = Math.max(getCoastlineX(z) + 2.4, x);
    }

    this.gpsTarget = { x, z };
    this.gpsArrivedTimer = 0;
    this.autoDriveStuckTimer = 0;
    this.autoDriveDetourTimer = 0;
    if (this.mountedHorse) {
      this.autoDriveLastPos.copy(this.mountedHorse.pos);
    }

    const roofY = this.weather
      ? this.weather.getRoofHeightAt(x, z, this.environment.village.roofVolumes, 0.45)
      : -1;
    if (roofY > 0.6) {
      this.gpsBaseDiamondY = Math.max(1.25, Math.min(2.25, roofY - 1.45));
      if (this.gpsBeamMesh) {
        const maxBeamTop = Math.max(1.0, roofY - 0.35);
        const beamScaleY = Math.min(1, maxBeamTop / 3.8);
        this.gpsBeamMesh.scale.y = beamScaleY;
        this.gpsBeamMesh.position.y = 1.9 * beamScaleY;
      }
    } else {
      this.gpsBaseDiamondY = 2.25;
      if (this.gpsBeamMesh) {
        this.gpsBeamMesh.scale.y = 1;
        this.gpsBeamMesh.position.y = 1.9;
      }
    }
    if (this.gpsDiamondMesh) {
      this.gpsDiamondMesh.position.y = this.gpsBaseDiamondY;
    }

    if (this.gpsBeaconGroup) {
      this.gpsBeaconGroup.position.set(x, 0, z);
      this.gpsBeaconGroup.visible = true;
    }
    soundManager.playJump();
  }

  public getCanvasElement(): HTMLCanvasElement | null {
    return this.renderer ? this.renderer.domElement : null;
  }

  public teleportSultanTo(rawX: number, rawZ: number) {
    if (this.isSittingOnThrone) {
      this.isSittingOnThrone = false;
      this.environment?.village?.palace?.setThroneColliderActive(true);
    }
    if (this.isSleepingInBed) {
      this.isSleepingInBed = false;
    }
    if (this.mountedHorse) {
      this.mountedHorse = null;
    }
    if (this.isSailingBoat) {
      this.isSailingBoat = false;
      this.environment.sea.setBoatOccupied(false);
    }
    if (this.ledHorse) {
      this.ledHorse = null;
      this.sultanRopeVisual.setVisible(false);
    }

    let z = Math.max(-85.5, Math.min(85.5, rawZ));
    const minLandX = getCoastlineX(z) + 2.2;
    const isOnPier = z >= 1.2 && z <= 6.2 && rawX >= -71.0 && rawX <= minLandX + 0.5;
    let x = isOnPier
      ? Math.max(-71.0, Math.min(85.5, rawX))
      : Math.max(minLandX, Math.min(85.5, rawX));

    const distR = Math.hypot(x, z);
    if (distR > 85.5 && !isOnPier) {
      const s = 85.5 / distR;
      x *= s;
      z *= s;
      x = Math.max(getCoastlineX(z) + 2.2, x);
    }

    this.sultanPos.set(x, 0, z);
    this.environment.resolveCollisions(this.sultanPos, 0.45);
    this.boundary.enforceBoundary(this.sultanPos);
    const supportY = this.environment.resolveCollisions(this.sultanPos, 0.45);
    this.sultanPos.y = Math.max(0, supportY);
    this.sultanVelocityY = 0;
    this.isGrounded = true;
    this.sultan.group.position.copy(this.sultanPos);

    if (this.citizenManager && (this.guardsFollowing || this.guardsProtectMode)) {
      for (let i = 0; i < this.citizenManager.citizens.length; i++) {
        const c = this.citizenManager.citizens[i];
        if (c.role === 'bodyguard' && !c.isDead && !c.isImprisoned) {
          c.pos.set(
            this.sultanPos.x + (c.guardSide || 1) * 1.35,
            this.sultanPos.y,
            this.sultanPos.z + 1.15
          );
          this.environment.resolveCollisions(c.pos, 0.4);
          this.boundary.enforceBoundary(c.pos);
          c.group.position.copy(c.pos);
        }
      }
    }

    this.lastHudEmitElapsed = -1;
    soundManager.playJump();
  }

  public clearGpsTarget() {
    this.gpsTarget = null;
    this.autoDriveDetourTimer = 0;
    this.autoDriveStuckTimer = 0;
    if (this.gpsBeaconGroup) {
      this.gpsBeaconGroup.visible = false;
    }
  }

  public getCarriagePositions(): { x: number; z: number; style: 'royal' | 'cart' }[] {
    const list: { x: number; z: number; style: 'royal' | 'cart' }[] = [];
    for (let i = 0; i < this.horseManager.horses.length; i++) {
      const h = this.horseManager.horses[i];
      if (h.hasCarriage) {
        list.push({
          x: h.pos.x,
          z: h.pos.z,
          style: h.carriageStyle || 'royal',
        });
      }
    }
    return list;
  }

  private chooseCarriageGpsAngle(
    hx: number,
    hz: number,
    desiredAngle: number,
    curAngle: number
  ): number {
    const probeOffsets =
      this.autoDriveDetourTimer > 0
        ? [
            this.autoDriveDetourDir * 1.15,
            this.autoDriveDetourDir * 0.78,
            this.autoDriveDetourDir * 1.55,
            0,
            -this.autoDriveDetourDir * 0.78,
            -this.autoDriveDetourDir * 1.35,
          ]
        : [0, 0.36, -0.36, 0.72, -0.72, 1.12, -1.12, 1.55, -1.55, 2.05, -2.05];

    let bestAngle = desiredAngle;
    let bestScore = -Infinity;

    for (let i = 0; i < probeOffsets.length; i++) {
      const ang = desiredAngle + probeOffsets[i];
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const blockedNear = this.environment.isPointBlocked(hx + sinA * 2.3, hz + cosA * 2.3, 1.28);
      const blockedMid = this.environment.isPointBlocked(hx + sinA * 4.6, hz + cosA * 4.6, 1.22);
      const blockedFar = this.environment.isPointBlocked(hx + sinA * 7.0, hz + cosA * 7.0, 1.15);

      if (!blockedNear && !blockedMid && !blockedFar) {
        if (probeOffsets[i] === 0 && this.autoDriveDetourTimer <= 0) {
          return desiredAngle;
        }
      }

      let diffTarget = Math.abs(ang - desiredAngle);
      while (diffTarget > Math.PI) diffTarget = Math.abs(diffTarget - Math.PI * 2);

      let diffTurn = Math.abs(ang - curAngle);
      while (diffTurn > Math.PI) diffTurn = Math.abs(diffTurn - Math.PI * 2);

      const penalty =
        (blockedNear ? 120 : 0) +
        (blockedMid ? 45 : 0) +
        (blockedFar ? 14 : 0) +
        diffTarget * 3.5 +
        diffTurn * 0.9;
      const score = -penalty;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = ang;
      }
    }

    return bestAngle;
  }

  public rotateCameraByDelta(deltaYaw: number, deltaPitch: number) {
    this.cameraYaw -= deltaYaw;
    this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + deltaPitch));
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const isPortrait = height > width;
    this.camera.fov = isPortrait ? 60 : 50;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    soundManager.unlock();
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') this.keys.w = true;
    if (k === 's' || k === 'arrowdown') this.keys.s = true;
    if (k === 'a' || k === 'arrowleft') this.keys.a = true;
    if (k === 'd' || k === 'arrowright') this.keys.d = true;
    if (e.shiftKey) this.keys.shift = true;
    if (k === 'e') {
      if (
        this.isSittingOnThrone ||
        (!this.mountedHorse &&
          !this.isSailingBoat &&
          this.environment?.village?.palace?.isSultanNearThrone(this.sultanPos))
      ) {
        this.sitOrStandFromThrone();
      } else {
        this.mountOrDismount();
      }
    }
    if (k === 't') this.sitOrStandFromThrone();
    if (k === 'f') this.toggleLeadHorse();
    if (k === 'g') this.toggleGuardsFollow();
    if (k === 'b') this.triggerGuardsBow();
    if (k === 'x') this.executeNearestCitizen();
    if (k === 'p') this.imprisonNearestCitizen();
    if (k === 'c') this.fireCannon();
    if (e.code === 'Space') {
      e.preventDefault();
      this.jump();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') this.keys.w = false;
    if (k === 's' || k === 'arrowdown') this.keys.s = false;
    if (k === 'a' || k === 'arrowleft') this.keys.a = false;
    if (k === 'd' || k === 'arrowright') this.keys.d = false;
    if (!e.shiftKey) this.keys.shift = false;
  };

  /**
   * Main game tick
   */
  private tick = () => {
    if (this.isDestroyed) return;
    if (this.isPaused) {
      this.animFrameId = requestAnimationFrame(this.tick);
      return;
    }

    const rawDelta = this.clock.getDelta();
    // Cap delta time to prevent physics tunneling or stutter on background tab
    const delta = Math.min(rawDelta, 0.1);
    this.totalElapsed += delta;
    // 1 real second = 1 in-game minute (60 real seconds = 1 in-game hour)
    this.gameMinutes += delta;
    const hourFloat = (this.gameMinutes % 1440) / 60;
    const isNight = hourFloat >= 19.0 || hourFloat < 5.75;
    let nightFactor = 0;
    if (hourFloat < 5.25 || hourFloat >= 19.25) {
      nightFactor = 1;
    } else if (hourFloat < 6.75) {
      const t = Math.max(0, Math.min(1, (hourFloat - 5.25) / 1.5));
      nightFactor = 1 - t * t * (3 - 2 * t);
    } else if (hourFloat >= 17.75) {
      const t = Math.max(0, Math.min(1, (hourFloat - 17.75) / 1.5));
      nightFactor = t * t * (3 - 2 * t);
    }

    // FPS calculation & adaptive DPR tuning on mobile GPUs without altering visual style
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.isLowEndMobileGpu && !this.isLowQualityMode && !this.isSoftwareGl) {
        if (this.currentFps < 47) {
          this.lowFpsStreak++;
          this.highFpsStreak = 0;
          if (this.lowFpsStreak >= 2 && this.adaptiveDprPenalty < 0.28) {
            this.adaptiveDprPenalty = Math.min(0.28, this.adaptiveDprPenalty + 0.14);
            this.renderer.setPixelRatio(this.getEffectivePixelRatio(false));
            this.lowFpsStreak = 0;
          }
        } else if (this.currentFps >= 57) {
          this.highFpsStreak++;
          this.lowFpsStreak = 0;
          if (this.highFpsStreak >= 4 && this.adaptiveDprPenalty > 0) {
            this.adaptiveDprPenalty = Math.max(0, this.adaptiveDprPenalty - 0.14);
            this.renderer.setPixelRatio(this.getEffectivePixelRatio(false));
            this.highFpsStreak = 0;
          }
        } else {
          this.lowFpsStreak = 0;
          this.highFpsStreak = 0;
        }
      }
    }

    // 1. Process Input Vector (frozen during first-time Aerial Intro Tour)
    let inputX = this.isIntroTour ? 0 : this.stickInput.x;
    let inputY = this.isIntroTour ? 0 : this.stickInput.y;

    // Merge keyboard if active
    if (!this.isIntroTour) {
      if (this.keys.w) inputY -= 1;
      if (this.keys.s) inputY += 1;
      if (this.keys.a) inputX -= 1;
      if (this.keys.d) inputX += 1;
    }

    const inputLen = Math.hypot(inputX, inputY);
    let normX = 0;
    let normY = 0;
    if (inputLen > 0.05) {
      normX = inputX / Math.max(1, inputLen);
      normY = inputY / Math.max(1, inputLen);
    }

    const isMoving = inputLen > 0.1;
    if (this.isSittingOnThrone && isMoving) {
      this.sitOrStandFromThrone();
    }
    if (this.isSleepingInBed && inputLen > 0.32) {
      this.toggleSleepInRoyalBed();
    }
    const shouldRun = (this.isRunning || this.keys.shift) && !this.isWalkingLocked;
    const isMounted = this.mountedHorse !== null;
    const isSailing = this.isSailingBoat;

    // Movement speeds in meters/second (boats & horses move faster than on foot)
    const baseSpeed = isSailing
      ? shouldRun
        ? 15.6
        : 8.8
      : isMounted
      ? shouldRun
        ? this.mountedHorse!.hasCarriage
          ? 11.8
          : 14.2
        : 7.4
      : shouldRun
      ? 9.2
      : 4.4;
    const currentSpeed = isMoving ? baseSpeed * Math.min(1.0, inputLen) : 0;

    // Convert input relative to active screen camera heading
    let moveWorldX = 0;
    let moveWorldZ = 0;
    if (isMoving) {
      this.camera.getWorldDirection(_camForward);
      _camForward.y = 0;
      if (_camForward.lengthSq() > 0.0001) {
        _camForward.normalize();
      } else {
        _camForward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)).normalize();
      }
      _camRight.crossVectors(_camForward, _worldUp).normalize();

      // In joystick/screen space: +X is screen right, -Y is screen forward
      moveWorldX = normX * _camRight.x - normY * _camForward.x;
      moveWorldZ = normX * _camRight.z - normY * _camForward.z;
    }

    let boundaryResult = { isBlocked: false, proximity: 0 };

    let effectiveIsMoving = isMoving;
    let effectiveSpeed = currentSpeed;
    let isAutoDrivingCarriage = false;

    if (this.gpsArrivedTimer > 0) {
      this.gpsArrivedTimer = Math.max(0, this.gpsArrivedTimer - delta);
    }

    if (this.gpsBeaconGroup && this.gpsTarget) {
      this.gpsBeaconGroup.visible = true;
      if (this.gpsDiamondMesh) {
        this.gpsDiamondMesh.rotation.y += delta * 2.2;
        this.gpsDiamondMesh.position.y =
          this.gpsBaseDiamondY + Math.sin(this.totalElapsed * 3.2) * 0.18;
      }
      if (this.gpsRingMesh) {
        const pulse = 1.0 + Math.sin(this.totalElapsed * 3.8) * 0.12;
        this.gpsRingMesh.scale.setScalar(pulse);
      }
    }

    if (this.isSailingBoat) {
      boundaryResult = this.environment.sea.moveBoat(
        delta,
        moveWorldX,
        moveWorldZ,
        currentSpeed,
        isMoving
      );
      this.sultan.facingAngle = this.environment.sea.boatHeading;
      this.isGrounded = true;
      this.sultanVelocityY = 0;
      this.nearbyHorse = null;
    } else if (this.mountedHorse) {
      const h = this.mountedHorse;
      const colliderRadius = h.hasCarriage ? 1.15 : 0.85;

      // Guard auto-drives carriage to GPS destination whenever a GPS pin is active and Sultan isn't manually steering
      if (h.hasCarriage && this.gpsTarget && inputLen <= 0.45) {
        const dxGps = this.gpsTarget.x - h.pos.x;
        const dzGps = this.gpsTarget.z - h.pos.z;
        const distGps = Math.hypot(dxGps, dzGps);

        if (distGps <= 2.9) {
          this.clearGpsTarget();
          this.gpsArrivedTimer = 3.6;
          effectiveIsMoving = false;
          effectiveSpeed = 0;
          soundManager.playLand();
        } else {
          isAutoDrivingCarriage = true;
          effectiveIsMoving = true;
          effectiveSpeed = shouldRun ? 10.8 : 7.4;

          if (this.autoDriveDetourTimer > 0) {
            this.autoDriveDetourTimer = Math.max(0, this.autoDriveDetourTimer - delta);
          }

          const rawDesired = Math.atan2(dxGps, dzGps);
          const steerAngle = this.chooseCarriageGpsAngle(
            h.pos.x,
            h.pos.z,
            rawDesired,
            h.facingAngle
          );

          let diff = steerAngle - h.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          h.facingAngle += diff * Math.min(1.0, delta * 5.8);

          const step = Math.min(distGps, effectiveSpeed * delta);
          h.pos.x += Math.sin(h.facingAngle) * step;
          h.pos.z += Math.cos(h.facingAngle) * step;

          this.autoDriveStuckTimer += delta;
          if (this.autoDriveStuckTimer > 1.25) {
            const movedSq =
              (h.pos.x - this.autoDriveLastPos.x) ** 2 +
              (h.pos.z - this.autoDriveLastPos.z) ** 2;
            this.autoDriveLastPos.copy(h.pos);
            this.autoDriveStuckTimer = 0;
            if (movedSq < 0.85) {
              this.autoDriveDetourDir *= -1;
              this.autoDriveDetourTimer = 1.65;
            }
          }
        }
      } else if (isMoving) {
        const targetAngle = Math.atan2(moveWorldX, moveWorldZ);
        let diff = targetAngle - h.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        h.facingAngle += diff * Math.min(1.0, delta * 9.0);

        h.pos.x += moveWorldX * currentSpeed * delta;
        h.pos.z += moveWorldZ * currentSpeed * delta;
      }

      // Horse collision & vertical jump physics
      let horseSupportY = this.environment.resolveCollisions(h.pos, colliderRadius);
      if (!h.isGrounded || h.pos.y > horseSupportY + 0.14) {
        h.isGrounded = false;
        h.velocityY -= 22.0 * delta;
        h.pos.y += h.velocityY * delta;
        if (h.pos.y <= horseSupportY) {
          h.pos.y = horseSupportY;
          h.velocityY = 0;
          h.isGrounded = true;
          soundManager.playLand();
        }
      } else {
        h.pos.y = horseSupportY;
      }

      // Separate mounted horse from other horses/carriages and farm animals
      const allHorses = this.horseManager.horses;
      for (let i = 0; i < allHorses.length; i++) {
        const other = allHorses[i];
        if (other === h || !other.group.visible) continue;
        const dx = h.pos.x - other.pos.x;
        const dz = h.pos.z - other.pos.z;
        const minR = colliderRadius + (other.hasCarriage ? 1.15 : 0.9);
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = minR / d;
          h.pos.x = other.pos.x + dx * push;
          h.pos.z = other.pos.z + dz * push;
        }
        if (other.hasCarriage) {
          const cx = other.pos.x - Math.sin(other.facingAngle) * 2.55;
          const cz = other.pos.z - Math.cos(other.facingAngle) * 2.55;
          const cdx = h.pos.x - cx;
          const cdz = h.pos.z - cz;
          const minC = colliderRadius + 1.08;
          const cSq = cdx * cdx + cdz * cdz;
          if (cSq < minC * minC && cSq > 0.0001) {
            const d = Math.sqrt(cSq);
            const push = minC / d;
            h.pos.x = cx + cdx * push;
            h.pos.z = cz + cdz * push;
          }
        }
      }
      const farmAnimals = this.farmManager.animals;
      for (let i = 0; i < farmAnimals.length; i++) {
        const fa = farmAnimals[i];
        const faR = getFarmAnimalRadius(fa.kind);
        const dx = h.pos.x - fa.pos.x;
        const dz = h.pos.z - fa.pos.z;
        const minR = colliderRadius + faR;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = minR - d;
          const horseShare = fa.kind === 'cow' ? 0.55 : 0.25;
          h.pos.x += (dx / d) * overlap * horseShare;
          h.pos.z += (dz / d) * overlap * horseShare;
        }
      }

      boundaryResult = this.boundary.enforceBoundary(h.pos);
      horseSupportY = this.environment.resolveCollisions(h.pos, colliderRadius);
      if (h.isGrounded && h.pos.y < horseSupportY) {
        h.pos.y = horseSupportY;
      }

      this.horseManager.animateHorse(h, delta, effectiveSpeed, h.isGrounded);

      // Smoothly close royal carriage door while riding
      if (h.carriageDoorPivot) {
        h.carriageDoorPivot.rotation.y = THREE.MathUtils.damp(
          h.carriageDoorPivot.rotation.y,
          0,
          8.0,
          delta
        );
      }

      // Seat Sultan inside rear carriage bench when riding a carriage, or on saddle for bare horses
      if (h.hasCarriage) {
        this.horseManager.getCarriageSlotWorldPos(h, 'sultan', this.sultanPos);
      } else {
        this.sultanPos.set(
          h.pos.x - Math.sin(h.facingAngle) * 0.04,
          h.pos.y + 1.19,
          h.pos.z - Math.cos(h.facingAngle) * 0.04
        );
      }
      this.sultan.facingAngle = h.facingAngle;
      this.isGrounded = h.isGrounded;
      this.sultanVelocityY = h.velocityY;
      this.nearbyHorse = null;
    } else if (this.isSittingOnThrone) {
      const palace = this.environment.village.palace;
      this.sultanPos.copy(palace.throneSeatPos);
      this.sultan.facingAngle = 0;
      this.isGrounded = true;
      this.sultanVelocityY = 0;
      effectiveIsMoving = false;
      effectiveSpeed = 0;
      this.nearbyHorse = null;
    } else if (this.isSleepingInBed) {
      const palace = this.environment.village.palace;
      this.sultanPos.copy(palace.sultanBedSleepPos);
      this.sultan.facingAngle = 0;
      this.isGrounded = true;
      this.sultanVelocityY = 0;
      effectiveIsMoving = false;
      effectiveSpeed = 0;
      this.nearbyHorse = null;
    } else {
      if (isMoving) {
        this.sultanPos.x += moveWorldX * currentSpeed * delta;
        this.sultanPos.z += moveWorldZ * currentSpeed * delta;
      }

      // 2. Solid Village Collision Resolution (Houses, Stone Well, Benches, Tables, Market Stalls)
      let supportY = this.environment.resolveCollisions(this.sultanPos, 0.45);

      // Solid collision around parked/unmounted horses & carriages so Sultan walks cleanly around them
      const horses = this.horseManager.horses;
      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        if (!h.group.visible) continue;
        const dx = this.sultanPos.x - h.pos.x;
        const dz = this.sultanPos.z - h.pos.z;
        const minR = 1.05;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = minR / d;
          this.sultanPos.x = h.pos.x + dx * push;
          this.sultanPos.z = h.pos.z + dz * push;
        }
        if (h.hasCarriage) {
          const cx = h.pos.x - Math.sin(h.facingAngle) * 2.55;
          const cz = h.pos.z - Math.cos(h.facingAngle) * 2.55;
          const cdx = this.sultanPos.x - cx;
          const cdz = this.sultanPos.z - cz;
          const minC = 1.45;
          const cSq = cdx * cdx + cdz * cdz;
          if (cSq < minC * minC && cSq > 0.0001) {
            const d = Math.sqrt(cSq);
            const push = minC / d;
            this.sultanPos.x = cx + cdx * push;
            this.sultanPos.z = cz + cdz * push;
          }
        }
      }

      // Solid collision between on-foot Sultan and farm cows, sheep & dogs
      const farmAnimals = this.farmManager.animals;
      for (let i = 0; i < farmAnimals.length; i++) {
        const fa = farmAnimals[i];
        const faR = getFarmAnimalRadius(fa.kind);
        const dx = this.sultanPos.x - fa.pos.x;
        const dz = this.sultanPos.z - fa.pos.z;
        const minR = 0.45 + faR;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const overlap = minR - d;
          const sultanShare = fa.kind === 'cow' ? 0.72 : 0.45;
          this.sultanPos.x += (dx / d) * overlap * sultanShare;
          this.sultanPos.z += (dz / d) * overlap * sultanShare;
        }
      }

      // 3. Vertical Physics (Gravity, Jump, Beach Slope, Harbor Pier & Furniture Top Landing)
      if (!this.isGrounded || this.sultanPos.y > supportY + 0.24) {
        this.isGrounded = false;
        this.sultanVelocityY -= 22.0 * delta; // Gravity
        this.sultanPos.y += this.sultanVelocityY * delta;

        if (this.sultanPos.y <= supportY) {
          this.sultanPos.y = supportY;
          this.sultanVelocityY = 0;
          this.isGrounded = true;
          soundManager.playLand();
        }
      } else {
        this.sultanPos.y = supportY;
      }

      // 4. Strict Boundary Enforcement (Cannot leave map, ground stays flat at y=0)
      boundaryResult = this.boundary.enforceBoundary(this.sultanPos);

      // Re-check obstacle collision after boundary clamp so player cannot be pushed into a structure
      supportY = this.environment.resolveCollisions(this.sultanPos, 0.45);
      if (this.sultanPos.y < supportY) {
        this.sultanPos.y = supportY;
      }

      this.nearbyHorse = this.ledHorse
        ? this.ledHorse
        : this.horseManager.findNearestMountable(this.sultanPos, 3.3);
    }

    // Update Sultan's rope-led horse if active
    if (this.ledHorse && !isMounted) {
      this.horseManager.updateLedHorseFollow(
        this.ledHorse,
        this.sultanPos,
        Math.max(currentSpeed * 1.12, 4.5),
        delta,
        (p, r) => this.environment.resolveCollisions(p, r),
        (p) => this.boundary.enforceBoundary(p)
      );
    }

    // Update Sky Clouds, Sun Halo, Flying Birds, Ocean Waves & Boat Rowing Cycle BEFORE syncing Sultan & Guards
    this.environment.update(delta, this.camera);
    this.environment.village.prison.update(
      delta,
      this.totalElapsed,
      this.sultanPos,
      this.citizenManager.isPrisonDoorForcedOpen()
    );
    this.environment.village.cafe.update(delta, this.sultanPos);
    this.environment.village.palace.update(
      delta,
      this.sultanPos,
      this.citizenManager.getPalaceDoorOpeners()
    );
    this.weather?.update(delta, this.sultanPos, this.environment.village.roofVolumes);
    if (this.weather?.consumeThunderTrigger()) {
      soundManager.playThunder();
      this.cameraShake = Math.max(this.cameraShake, 0.08);
    }
    this.boundary.update(delta, this.camera);
    this.borderFence.update(this.totalElapsed);

    // Sync Sultan directly onto the wave-bobbed Royal Boat captain's bench when sailing
    if (isSailing) {
      this.environment.sea.getBoatSeatWorldPos(this.sultanPos);
      this.sultan.facingAngle = this.environment.sea.boatHeading;
    }

    // Update all unmounted horses & roaming citizens (plus rowing bodyguards on the boat)
    const isStaticBlocked = (x: number, z: number, radius: number, skipStandable?: boolean) =>
      this.environment.isStaticPointObstructed(x, z, radius, skipStandable);
    const enforceBoundary = (p: THREE.Vector3) => this.boundary.enforceBoundary(p);

    this.horseManager.updateUnmounted(
      delta,
      this.mountedHorse ? this.mountedHorse.id : null,
      this.ledHorse ? this.ledHorse.id : null,
      (p, r) => this.environment.resolveCollisions(p, r),
      this.sultanPos,
      enforceBoundary,
      isStaticBlocked,
      this.farmManager.animals,
      this.citizenManager.citizens
    );
    const isRainingNow = this.weather ? this.weather.isRaining() : false;
    const isOnSpeechPodium =
      !isSailing &&
      !isMounted &&
      !this.isSittingOnThrone &&
      !this.isSleepingInBed &&
      !this.citizenManager.getExecutionStatus().isExecuting &&
      Boolean(this.environment.village.speechPodium?.isSultanOnPodium(this.sultanPos));

    const isWarActive = this.warSystem ? this.warSystem.isActive() : false;

    this.environment.village.militaryCamp.update(
      delta,
      this.totalElapsed,
      isNight,
      isWarActive,
      this.sultanPos
    );

    this.citizenManager.update(
      delta,
      this.sultanPos,
      this.sultan.facingAngle,
      isMounted || isSailing,
      this.guardsFollowing && !isSailing,
      (p, r) => this.environment.resolveCollisions(p, r),
      enforceBoundary,
      this.citizenObstacles,
      this.horseManager,
      this.environment.village,
      isSailing,
      this.environment.sea,
      this.mountedHorse,
      isNight,
      this.gameMinutes,
      isOnSpeechPodium,
      isWarActive,
      this.isLowEndMobileGpu || this.isLowQualityMode
    );

    this.warSystem?.update(
      delta,
      this.totalElapsed,
      this.sultanPos,
      (p, r) => this.environment.resolveCollisions(p, r),
      enforceBoundary
    );
    this.farmManager.update(
      delta,
      (p, r) => this.environment.resolveCollisions(p, r),
      this.sultanPos,
      isMounted || isSailing,
      enforceBoundary,
      isStaticBlocked,
      this.horseManager.horses,
      this.citizenManager.citizens,
      Boolean(this.mountedHorse?.hasCarriage)
    );
    this.catManager.update(
      delta,
      (p, r) => this.environment.resolveCollisions(p, r),
      enforceBoundary,
      this.sultanPos,
      isMounted || isSailing,
      isStaticBlocked,
      this.farmManager.animals,
      this.horseManager.horses,
      this.citizenManager.citizens,
      Boolean(this.mountedHorse?.hasCarriage)
    );

    // Soft separation between on-foot Sultan and strolling visible citizens
    if (!isMounted && !isSailing && !this.isSittingOnThrone) {
      const citizens = this.citizenManager.citizens;
      for (let i = 0; i < citizens.length; i++) {
        const c = citizens[i];
        if (!c.group.visible) continue;
        if (c.role === 'horse_rider' && !c.isDismountedForSultan) continue;
        const dx = this.sultanPos.x - c.pos.x;
        const dz = this.sultanPos.z - c.pos.z;
        const minR = 0.78;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = (minR - d) * 0.5;
          this.sultanPos.x += (dx / d) * push;
          this.sultanPos.z += (dz / d) * push;
        }
      }
    }

    // Apply final position to Sultan
    this.sultan.group.position.copy(this.sultanPos);

    // Update Sultan Character Procedural Animation
    const sultanState: SultanState = {
      isMoving: effectiveIsMoving,
      isRunning: shouldRun,
      isGrounded: this.isGrounded,
      jumpVelocity: this.sultanVelocityY,
      speed: effectiveSpeed,
      isRiding: isMounted,
      isRidingCarriage: Boolean(this.mountedHorse?.hasCarriage),
      isSailing,
      isLeadingHorse: this.ledHorse !== null && !isMounted && !isSailing,
      isSittingOnThrone: this.isSittingOnThrone,
      isSleepingInBed: this.isSleepingInBed,
      nightFactor,
    };
    this.sultan.update(delta, sultanState, moveWorldX, moveWorldZ);

    // Update 3D sagging rope connecting Sultan's right hand to led horse's muzzle halter
    if (this.ledHorse && !isMounted && !isSailing) {
      this.sultan.group.updateMatrixWorld(true);
      this.ledHorse.group.updateMatrixWorld(true);
      this.sultan.getRightHandWorldPos(_sultanHandPos);
      this.ledHorse.halterAnchor.getWorldPosition(_horseHalterPos);
      this.sultanRopeVisual.updateEndpoints(_sultanHandPos, _horseHalterPos);
    } else if (this.sultanRopeVisual.group.visible) {
      this.sultanRopeVisual.setVisible(false);
    }

    const isInsidePalace = this.environment.village.palace.isSultanInside(this.sultanPos);

    // 6. Camera: First-Time Aerial Flyover Tour OR Smooth Third-Person Follow
    if (this.isIntroTour && this.introPosCurve && this.introLookCurve) {
      this.introTourElapsed += delta;
      const rawT = Math.min(1, this.introTourElapsed / this.introTourDuration);
      const easedT = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
      this.introPosCurve.getPointAt(easedT, _desiredCamPos);
      this.introLookCurve.getPointAt(easedT, _lookTarget);
      this.camera.position.copy(_desiredCamPos);
      this.camera.lookAt(_lookTarget);
      if (rawT >= 1) {
        this.finishIntroTour();
      }
    } else {
      const isUpperFloorPalace = isInsidePalace && this.sultanPos.y >= 3.6;
      const isApproachingPalaceDoor =
        !isInsidePalace &&
        Math.abs(this.sultanPos.x) < 3.4 &&
        this.sultanPos.z > -32.0 &&
        this.sultanPos.z < -27.8;

      const baseDesiredDistance =
        this.targetCameraDistance +
        (isSailing
          ? 3.2
          : this.mountedHorse
          ? this.mountedHorse.hasCarriage
            ? 3.5
            : 1.5
          : 0);
      const desiredDistance = isInsidePalace
        ? Math.min(baseDesiredDistance, isUpperFloorPalace ? 4.4 : 3.65)
        : isApproachingPalaceDoor
        ? Math.min(baseDesiredDistance, 4.6)
        : baseDesiredDistance;
      this.cameraDistance = THREE.MathUtils.damp(
        this.cameraDistance,
        desiredDistance,
        7.5,
        delta
      );

      const effectivePitch = isInsidePalace
        ? Math.min(this.cameraPitch, isUpperFloorPalace ? 0.28 : 0.22)
        : this.cameraPitch;
      const cosPitch = Math.cos(effectivePitch);
      const sinPitch = Math.sin(effectivePitch);
      const sinCamYaw = Math.sin(this.cameraYaw);
      const cosCamYaw = Math.cos(this.cameraYaw);

      _camOffset.set(
        this.cameraDistance * cosPitch * sinCamYaw,
        this.cameraDistance * sinPitch +
          (isMounted || isSailing ? 1.55 : isInsidePalace ? (isUpperFloorPalace ? 1.08 : 0.95) : 1.2),
        this.cameraDistance * cosPitch * cosCamYaw
      );

      _desiredCamPos.copy(this.sultanPos).add(_camOffset);

      // Camera looks slightly above Sultan's chest/head
      _lookTarget.copy(this.sultanPos);
      _lookTarget.y += isMounted ? 1.42 : 1.45;

      const shouldClampPalaceCam =
        isInsidePalace ||
        (this.sultanPos.y < 3.6 &&
          Math.abs(this.sultanPos.x) < 27.4 &&
          this.sultanPos.z < -29.8 &&
          this.sultanPos.z > -68.4);

      if (shouldClampPalaceCam) {
        this.environment.village.palace.clampCameraPos(_lookTarget, _desiredCamPos);
      }

      // Exponential camera smoothing
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _desiredCamPos.x, 9.0, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _desiredCamPos.y, 9.0, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _desiredCamPos.z, 9.0, delta);

      if (shouldClampPalaceCam) {
        this.environment.village.palace.clampCameraPos(_lookTarget, this.camera.position);
      }

      // Concussive cannon blast camera shake
      if (this.cameraShake > 0.002) {
        this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 7.5, delta);
        const sx = (Math.random() - 0.5) * this.cameraShake;
        const sy = (Math.random() - 0.5) * this.cameraShake * 0.85;
        const sz = (Math.random() - 0.5) * this.cameraShake;
        this.camera.position.x += sx;
        this.camera.position.y += sy;
        this.camera.position.z += sz;
        _lookTarget.x += sx * 0.45;
        _lookTarget.y += sy * 0.45;
      }

      this.camera.lookAt(_lookTarget);
    }

    const isUpperFloorPalace = isInsidePalace && this.sultanPos.y >= 3.6;

    // Update 24h Day/Night Sky Cycle, Sun/Moon/Stars, Storm Weather, Fog, Sea & Village Lanterns
    this.environment.updateTimeOfDay(
      hourFloat,
      this.scene,
      this.hemiLight,
      this.dirLight,
      this.fillLight,
      this.sultanPos,
      this.boundary,
      this.camera,
      this.weather ? this.weather.rainIntensity : 0,
      this.weather ? this.weather.lightningFlash : 0
    );

    // Soften midday directional & fill light when inside enclosed Ground Floor halls to prevent bright wall glare
    if (isInsidePalace && !isUpperFloorPalace) {
      this.dirLight.intensity *= 0.65;
      this.fillLight.intensity *= 0.55;
    }

    // Update continuous procedural audio landscape (Wind, Ocean Surf, Unintelligible Crowd Chatter, Rain)
    const coastX = getCoastlineX(this.sultanPos.z);
    const seaProximity = isSailing
      ? 1.0
      : Math.max(0, Math.min(1, 1 - (this.sultanPos.x - coastX) / 34));
    let crowdWeight = 0;
    const allCitizens = this.citizenManager.citizens;
    for (let i = 0; i < allCitizens.length; i++) {
      const c = allCitizens[i];
      if (!c.group.visible) continue;
      if (c.role === 'bodyguard' || c.isArmoredGuard || c.isBorderGuard) continue;
      const dx = c.pos.x - this.sultanPos.x;
      const dz = c.pos.z - this.sultanPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 22 * 22) {
        crowdWeight += 1 - Math.sqrt(distSq) / 22;
      }
    }
    const crowdProximity = Math.max(0, Math.min(1, (crowdWeight - 0.35) / 3.8));
    const rainAmt = this.weather ? this.weather.rainIntensity : 0;
    const isUnderRoof = this.weather
      ? this.weather.isPositionUnderRoof(this.sultanPos, this.environment.village.roofVolumes)
      : false;
    const rainAudioAmt = isUnderRoof ? rainAmt * 0.25 : rainAmt;
    soundManager.updateAmbience(delta, {
      seaProximity,
      crowdProximity,
      rainIntensity: rainAudioAmt,
      windBoost: rainAudioAmt * 0.65 + (isSailing ? 0.35 : 0),
    });

    // 7. Render frame (throttle shadow-map re-rasterization to every 2nd frame on low-end mobile GPUs for 60Hz frame pacing)
    this.shadowFrameCounter++;
    if (this.renderer.shadowMap.enabled) {
      if (!this.isLowEndMobileGpu || (this.shadowFrameCounter & 1) === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    this.renderer.render(this.scene, this.camera);

    const borderStatus = this.citizenManager.getBorderGuardStatus(this.sultanPos);
    if (borderStatus.isNearRomanBorder && !this.wasNearRomanBorder) {
      soundManager.playBoundaryBump();
    }
    this.wasNearRomanBorder = borderStatus.isNearRomanBorder;

    // 8. Smart HUD reporting (~9Hz for continuous telemetry, immediate on any discrete state change or hour tick)
    if (this.onStatsUpdate) {
      const prisonEvent = this.citizenManager.consumePrisonEvent();
      const execStatus = this.citizenManager.getExecutionStatus();
      const nearbyImprisonTarget =
        !execStatus.isExecuting
          ? this.citizenManager.findNearestExecutableInfo(this.sultanPos, 3.6)
          : null;
      const hasNearbyExecutable = !execStatus.isExecuting && Boolean(nearbyImprisonTarget);
      const nearbyMoneyCitizen =
        !execStatus.isExecuting && !isSailing
          ? this.citizenManager.findNearestMoneyCitizen(this.sultanPos, 3.6)
          : null;
      const cannon = this.environment.village.cannon;
      const isNearCannon =
        !isSailing &&
        !this.isSittingOnThrone &&
        !this.isSleepingInBed &&
        !execStatus.isExecuting &&
        Boolean(cannon?.isSultanNear(this.sultanPos, 6.2));
      const cannonCooldown = cannon ? cannon.cooldownRemaining : 0;
      const prisonOrigin = this.environment.village.prison.origin;
      const isNearPrison =
        Math.hypot(this.sultanPos.x - prisonOrigin.x, this.sultanPos.z - prisonOrigin.z) < 9.5;
      const isAtBorderGate =
        borderStatus.isNearRomanBorder &&
        (boundaryResult.isBlocked || Math.hypot(this.sultanPos.x - 86.4, this.sultanPos.z - 3.5) < 3.6);
      const isNearBoat =
        !isSailing &&
        !isMounted &&
        !this.isSittingOnThrone &&
        !execStatus.isExecuting &&
        this.environment.sea.isSultanNearBoat(this.sultanPos, 5.4);
      const palace = this.environment.village.palace;
      const isNearThrone =
        !isSailing &&
        !isMounted &&
        !this.isSleepingInBed &&
        !execStatus.isExecuting &&
        palace.isSultanNearThrone(this.sultanPos);
      const isNearRoyalBed =
        !isSailing &&
        !isMounted &&
        !this.isSittingOnThrone &&
        !execStatus.isExecuting &&
        (this.isSleepingInBed || palace.isSultanNearRoyalBed(this.sultanPos));
      const areGuardsProtecting = this.citizenManager.isGuardsProtectMode();
      const vizierState =
        !isSailing && !isMounted && !execStatus.isExecuting
          ? this.citizenManager.getVizierInteractionState(this.sultanPos)
          : { isNearVizier: false, vizierPhase: 'sleeping' as const };

      const warSnap = this.warSystem
        ? this.warSystem.getSnapshot()
        : { phase: 'idle' as WarPhase, playerRemaining: 0, romanRemaining: 0 };
      const warOutcomeEvent = this.warSystem ? this.warSystem.consumeOutcomeEvent() : null;
      const introTourLabel = this.isIntroTour
        ? this.getIntroTourLabel(Math.min(1, this.introTourElapsed / this.introTourDuration))
        : '';

      const currentHour = Math.floor(this.gameMinutes / 60);
      const flagsKey = `${isMounted ? 1 : 0}|${isSailing ? 1 : 0}|${isNearBoat ? 1 : 0}|${isNearThrone ? 1 : 0}|${this.isSittingOnThrone ? 1 : 0}|${isNearRoyalBed ? 1 : 0}|${this.isSleepingInBed ? 1 : 0}|${isOnSpeechPodium ? 1 : 0}|${areGuardsProtecting ? 1 : 0}|${vizierState.isNearVizier ? 1 : 0}|${vizierState.vizierPhase}|${this.nearbyHorse ? this.nearbyHorse.id : ''}|${this.ledHorse ? this.ledHorse.id : ''}|${this.guardsFollowing ? 1 : 0}|${hasNearbyExecutable ? 1 : 0}|${execStatus.isExecuting ? 1 : 0}|${execStatus.phaseLabel || ''}|${execStatus.countdownSec ?? ''}|${borderStatus.isNearRomanBorder ? 1 : 0}|${isAtBorderGate ? 1 : 0}|${this.gpsTarget ? 1 : 0}|${isAutoDrivingCarriage ? 1 : 0}|${this.gpsArrivedTimer > 0 ? 1 : 0}|${isNight ? 1 : 0}|${isRainingNow ? 1 : 0}|${nearbyMoneyCitizen ? `${nearbyMoneyCitizen.id}:${nearbyMoneyCitizen.money}` : ''}|${nearbyImprisonTarget ? nearbyImprisonTarget.id : ''}|${isNearPrison ? 1 : 0}|${isNearCannon ? 1 : 0}|${Math.ceil(cannonCooldown * 10)}|${boundaryResult.isBlocked ? 1 : 0}|${this.isGrounded ? 1 : 0}|${this.isIntroTour ? introTourLabel : ''}|${warSnap.phase}`;

      const hudInterval = effectiveIsMoving || this.isIntroTour || isWarActive ? 0.11 : 0.18;
      const shouldEmit =
        this.lastHudEmitElapsed < 0 ||
        this.totalElapsed - this.lastHudEmitElapsed >= hudInterval ||
        prisonEvent !== null ||
        warOutcomeEvent !== null ||
        currentHour !== this.lastHudHour ||
        flagsKey !== this.lastHudFlagsKey;

      if (shouldEmit) {
        this.lastHudEmitElapsed = this.totalElapsed;
        this.lastHudHour = currentHour;
        this.lastHudFlagsKey = flagsKey;

        const imprisonedCitizens = this.citizenManager.getImprisonedCitizensInfo(this.gameMinutes);
        const refX = this.mountedHorse ? this.mountedHorse.pos.x : this.sultanPos.x;
        const refZ = this.mountedHorse ? this.mountedHorse.pos.z : this.sultanPos.z;
        const gpsDistanceMeters = this.gpsTarget
          ? Math.round(Math.hypot(this.gpsTarget.x - refX, this.gpsTarget.z - refZ))
          : 0;

        this.onStatsUpdate({
          speedKmh: Math.round((isSailing ? this.environment.sea.boatSpeed : effectiveSpeed) * 3.6),
          isGrounded: this.isGrounded,
          proximityToFog: boundaryResult.proximity,
          isBlockedByFog: boundaryResult.isBlocked,
          fps: this.currentFps,
          isMounted,
          isSailing,
          isNearBoat,
          mountedHorseLabel: this.mountedHorse ? this.mountedHorse.coatLabelAr : null,
          nearbyHorseLabel: this.nearbyHorse ? this.nearbyHorse.coatLabelAr : null,
          nearbyHorseHasCarriage: this.nearbyHorse ? this.nearbyHorse.hasCarriage : false,
          isLeadingHorse: this.ledHorse !== null,
          ledHorseLabel: this.ledHorse ? this.ledHorse.coatLabelAr : null,
          areGuardsFollowing: this.guardsFollowing,
          areGuardsProtecting,
          hasNearbyExecutable,
          isExecuting: execStatus.isExecuting,
          executionPhaseLabel: execStatus.phaseLabel,
          executionCountdown: execStatus.countdownSec,
          isNearRomanBorder: borderStatus.isNearRomanBorder,
          borderGuardMessage: borderStatus.message,
          isAtBorderGate,
          playerX: this.sultanPos.x,
          playerZ: this.sultanPos.z,
          playerFacing: this.sultan.facingAngle,
          isRidingCarriage: Boolean(this.mountedHorse?.hasCarriage),
          gpsTarget: this.gpsTarget,
          gpsDistanceMeters,
          isAutoDrivingCarriage,
          gpsArrivedBanner: this.gpsArrivedTimer > 0,
          gameMinutes: this.gameMinutes,
          isNight,
          nearbyMoneyCitizen,
          nearbyImprisonTarget,
          imprisonedCitizens,
          isNearPrison,
          prisonEvent,
          isNearCannon,
          cannonCooldown,
          isRaining: isRainingNow,
          isNearThrone,
          isSittingOnThrone: this.isSittingOnThrone,
          isNearRoyalBed,
          isSleepingInBed: this.isSleepingInBed,
          isOnSpeechPodium,
          isNearVizier: vizierState.isNearVizier,
          vizierPhase: vizierState.vizierPhase,
          isIntroTour: this.isIntroTour,
          introTourLabel,
          warPhase: warSnap.phase,
          warPlayerRemaining: warSnap.playerRemaining,
          warRomanRemaining: warSnap.romanRemaining,
          warOutcomeEvent,
        });
      }
    }

    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (sync) {
        gl.flush();
        const poll = () => {
          if (this.isDestroyed) {
            gl.deleteSync(sync);
            return;
          }
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.softwareTimerId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            this.softwareTimerId = window.setTimeout(this.tick, 80);
          }
        };
        this.softwareTimerId = window.setTimeout(poll, 5);
      } else {
        this.softwareTimerId = window.setTimeout(this.tick, 80);
      }
    } else {
      this.animFrameId = requestAnimationFrame(this.tick);
    }
  };

  public destroy() {
    this.isDestroyed = true;
    soundManager.stopAmbience();
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.softwareTimerId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    this.sultan?.dispose();
    this.sultanRopeVisual?.dispose();
    this.gpsBeaconDisposables.forEach((d) => d.dispose());
    this.horseManager?.dispose();
    this.catManager?.dispose();
    this.farmManager?.dispose();
    this.citizenManager?.dispose();
    this.warSystem?.dispose();
    this.environment?.dispose();
    this.weather?.dispose();
    this.boundary?.dispose();
    this.borderFence?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
