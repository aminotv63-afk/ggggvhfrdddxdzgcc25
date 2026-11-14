import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createRadialShadowTexture } from './textures';

import { CylinderCollider, KingdomVillage, OBBCollider } from './kingdomVillage';
import { RoyalPrison } from './prison';
import { HorseEntity, HorseManager } from './horses';
import { LeadRopeVisual } from './ropeVisual';
import { soundManager } from './audio';
import { RoyalSea } from './sea';
import { formatRemainingPrisonTime } from './prisonTime';
import type { SavedPrisonerRecord } from './saveData';
import { CafeNpcKind, getCafeNpcSlots } from './cafe';

const _handWorldPos = new THREE.Vector3();
const _halterWorldPos = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _tmpTargetVec = new THREE.Vector3();

export type CitizenHatStyle =
  | 'turban'
  | 'wideHat'
  | 'hood'
  | 'helmet'
  | 'fez'
  | 'beret'
  | 'keffiyeh'
  | 'rainbowCap'
  | 'royalCrown'
  | 'sultanaCrown'
  | 'queenTiara'
  | 'princeCrown'
  | 'none';

export type CitizenBeardStyle = 'full' | 'mustache' | 'goatee' | 'none';
export type CitizenBackStyle = 'cape' | 'backpack' | 'satchel' | 'none';
export type CitizenRole =
  | 'walker'
  | 'merchant'
  | 'standing'
  | 'horse_leader'
  | 'horse_rider'
  | 'bodyguard'
  | 'child';

export interface ObstacleContext {
  boxes: OBBCollider[];
  cylinders: CylinderCollider[];
  trees: CylinderCollider[];
  horses: { pos: THREE.Vector3; group?: THREE.Group }[];
  farmAnimals?: { pos: THREE.Vector3; kind: 'cow' | 'sheep' | 'dog' }[];
  isPointBlockedStatic?: (x: number, z: number, radius: number, skipStandable?: boolean) => boolean;
}

const CITIZEN_LABELS_AR: Record<string, string> = {
  c_emerald: 'تاجر الزمرد',
  c_cobalt: 'الرحالة الملكي',
  c_saffron: 'تاجر الزعفران',
  c_plum: 'العالم المتجول',
  c_turquoise: 'تاجر القوافل',
  c_burgundy: 'بائع الأقمشة',
  c_forest: 'حطاب الغابة',
  c_terracotta: 'تاجر الحبوب',
  c_ivory: 'حكيم البئر',
  c_ochre: 'مزارع البساتين',
  c_coral: 'عابر السبيل',
  c_mint: 'عطار البهارات',
  c_cedar: 'نجار الأرز',
  c_leader_1: 'سائس الخيل الغربي',
  c_leader_2: 'سائس الخيل الشرقي',
  c_leader_3: 'سائس الساحة',
  c_rider_1: 'فارس البريد الملكي',
  c_rider_2: 'فارس الصحراء',
  c_rider_3: 'الرسول السريع',
  c_cafe_owner: 'صاحب المقهى',
  c_cafe_pat1: 'زبون المقهى (أبو طارق)',
  c_cafe_pat2: 'زبون المقهى (أبو سامي)',
  c_cafe_pat3: 'زبون المقهى (أبو كريم)',
  c_cafe_pat4: 'زبون المقهى (أبو فهد)',
  c_cafe_pat5: 'زبون المقهى (أبو وليد)',
  c_cafe_stand1: 'زبون المقهى (ضيف القهوة)',
  c_cafe_stand2: 'زبون المقهى (نديم الشاي)',
  c_child_1: 'الطفل زيد',
  c_child_2: 'الطفل عمر',
  c_child_3: 'الطفل سليم',
  c_child_4: 'الطفل طارق',
  c_child_5: 'الطفل بلال',
  c_child_6: 'الطفل مازن',
  c_palace_guard_l: 'حارس باب القصر الأيمن',
  c_palace_guard_r: 'حارس باب القصر الأيسر',
  c_palace_guard_front_w: 'حارس ساحة القصر الغربي',
  c_palace_guard_front_e: 'حارس ساحة القصر الشرقي',
  c_palace_guard_foyer_l: 'حارس بهو القصر الأيمن',
  c_palace_guard_foyer_r: 'حارس بهو القصر الأيسر',
  c_palace_guard_hall_w: 'حارس قاعة العرش الغربي',
  c_palace_guard_hall_e: 'حارس قاعة العرش الشرقي',
  c_palace_guard_throne_l: 'حارس منصة العرش الأيمن',
  c_palace_guard_throne_r: 'حارس منصة العرش الأيسر',
  c_palace_guard_corridor_w1: 'حارس الممر الغربي',
  c_palace_guard_corridor_w2: 'حارس الجناح الغربي',
  c_palace_guard_corridor_e1: 'حارس الممر الشرقي',
  c_palace_guard_corridor_e2: 'حارس الجناح الشرقي',
  c_palace_guard_ext_w: 'حارس سور القصر الغربي',
  c_palace_guard_ext_e: 'حارس سور القصر الشرقي',
  c_palace_guard_up_balc_c1: 'حارس الشرفة الملكية الأيمن',
  c_palace_guard_up_balc_c2: 'حارس الشرفة الملكية الأيسر',
  c_palace_guard_up_balc_w: 'حارس مطل الشرفة الغربي',
  c_palace_guard_up_balc_e: 'حارس مطل الشرفة الشرقي',
  c_palace_guard_up_stair_w: 'حارس درج الطابق الثاني الغربي',
  c_palace_guard_up_stair_e: 'حارس درج الطابق الثاني الشرقي',
  c_palace_guard_up_hall_w: 'حارس البهو العلوي الغربي',
  c_palace_guard_up_hall_e: 'حارس البهو العلوي الشرقي',
  c_palace_guard_up_diwan_l: 'حارس الديوان العلوي الأيمن',
  c_palace_guard_up_diwan_r: 'حارس الديوان العلوي الأيسر',
  c_royal_sultana: 'السلطانة',
  c_royal_vizier: 'الوزير',
  c_crown_prince: 'وريث العرش (الأمير الصغير)',
};

interface CitizenConfig {
  id: string;
  role: CitizenRole;
  guardSide?: -1 | 1;
  isArmoredGuard?: boolean;
  guardPalette?: 'royal' | 'roman' | 'prison' | 'palace';
  isBorderGuard?: boolean;
  isFemale?: boolean;
  isRoyalFamily?: boolean;
  isRoyalSultana?: boolean;
  isRoyalVizier?: boolean;
  isRoyalQueen?: boolean;
  isCrownPrince?: boolean;
  neverBowsToSultan?: boolean;
  startX: number;
  startY?: number;
  startZ: number;
  homeRotY?: number;
  scale: number;
  hatStyle: CitizenHatStyle;
  hatColor: number;
  hatAccent: number;
  beardStyle: CitizenBeardStyle;
  backStyle: CitizenBackStyle;
  backColor: number;
  showRightProp: boolean;
  showLeftProp: boolean;
  skinColor: number;
  hairColor: number;
  topPrimary: number;
  topSecondary: number;
  topAccent: number;
  bottomPrimary: number;
  sleeveColor: number;
  shoeColor: number;
  walkSpeed: number;
  isRainbow?: boolean;
  waypoints: [number, number][];
  playPartnerId?: string;
  isCafeNpc?: boolean;
  cafeKind?: CafeNpcKind;
  cafeSeatPos?: THREE.Vector3;
  cafeSeatFacing?: number;
  cafeStandPos?: THREE.Vector3;
  cafeHomeFacing?: number;
}

export interface ActionArmQuats {
  carryUpperL: THREE.Quaternion;
  carryLowerL: THREE.Quaternion;
  carryUpperR: THREE.Quaternion;
  carryLowerR: THREE.Quaternion;
  raiseUpperL: THREE.Quaternion;
  raiseLowerL: THREE.Quaternion;
  raiseUpperR: THREE.Quaternion;
  raiseLowerR: THREE.Quaternion;
  throwBackUpperL: THREE.Quaternion;
  throwBackUpperR: THREE.Quaternion;
  limpUpperL: THREE.Quaternion;
  limpUpperR: THREE.Quaternion;
  rowCatchUpperL: THREE.Quaternion;
  rowCatchLowerL: THREE.Quaternion;
  rowCatchUpperR: THREE.Quaternion;
  rowCatchLowerR: THREE.Quaternion;
  rowPullUpperL: THREE.Quaternion;
  rowPullLowerL: THREE.Quaternion;
  rowPullUpperR: THREE.Quaternion;
  rowPullLowerR: THREE.Quaternion;
  benchUpperL: THREE.Quaternion;
  benchLowerL: THREE.Quaternion;
  benchUpperR: THREE.Quaternion;
  benchLowerR: THREE.Quaternion;
}

export type ExecutionPhase =
  | 'rush_to_target'
  | 'grab_struggle'
  | 'escort_to_gallows'
  | 'climb_stairs'
  | 'place_in_noose'
  | 'hoist_up'
  | 'hanging_scream'
  | 'death_moment'
  | 'lower_and_pickup'
  | 'carry_to_well'
  | 'throw_into_well'
  | 'return_salute';

interface ExecutionState {
  phase: ExecutionPhase;
  timer: number;
  totalTime: number;
  victim: CitizenEntity;
  guardA: CitizenEntity; // Right-flank guard (escorts, places noose, carries & throws)
  guardB: CitizenEntity; // Left-flank guard (escorts, pulls lever & hoists, carries & throws)
  stairStage: number;
  escortStuckTimer: number;
  escortLastPos: THREE.Vector3;
  nextScreamAt: number;
  screamPhraseIdx: number;
  lastBubbleSec: number;
  lastBubbleText: string;
  throwStartPos: THREE.Vector3;
  splashTriggered: boolean;
  leverSoundPlayed: boolean;
  wellWaypointPassed: boolean;
}

export interface ExecutionStatus {
  isExecuting: boolean;
  phaseLabel: string | null;
  countdownSec: number | null;
}

export type ImprisonPhase =
  | 'rush_to_target'
  | 'grab_prisoner'
  | 'escort_to_prison'
  | 'open_door_and_enter'
  | 'lock_door'
  | 'return_salute';

interface ImprisonmentState {
  phase: ImprisonPhase;
  timer: number;
  totalTime: number;
  prisoner: CitizenEntity;
  guardA: CitizenEntity;
  guardB: CitizenEntity;
  cellSlot: THREE.Vector3;
  slotIndex: number;
  sentenceMinutes: number;
  escortStuckTimer: number;
  escortLastPos: THREE.Vector3;
  lastBubbleText: string;
}

export interface ImprisonedCitizenInfo {
  id: string;
  labelAr: string;
  remainingMinutes: number;
  sentenceMinutes: number;
  slotIndex: number;
}

export interface PrisonEventInfo {
  type: 'entered' | 'released';
  citizenId: string;
  labelAr: string;
  remainingMinutes: number;
}

export type FeedLionPhase =
  | 'rush_to_target'
  | 'grab_and_escort'
  | 'toss_into_lion_cage'
  | 'lion_devour_and_lock'
  | 'return_salute';

interface FeedLionState {
  phase: FeedLionPhase;
  timer: number;
  victim: CitizenEntity;
  guardA: CitizenEntity;
  guardB: CitizenEntity;
  waypoints: [number, number][];
  waypointIdx: number;
  tossedInCage: boolean;
  gateLocked: boolean;
  escortStuckTimer: number;
  escortLastPos: THREE.Vector3;
  progressCheckTimer: number;
  progressCheckPos: THREE.Vector3;
  totalEscortTime: number;
}

export interface CitizenEntity {
  id: string;
  displayNameAr: string;
  money: number;
  role: CitizenRole;
  originalRole: CitizenRole;
  isArmoredGuard: boolean;
  isBorderGuard: boolean;
  isDead: boolean;
  isImprisoned: boolean;
  prisonSlotIndex: number;
  prisonReleaseGameMinute: number;
  prisonSentenceMinutes: number;
  prisonLabelSprite?: THREE.Sprite | null;
  prisonLabelCanvas?: HTMLCanvasElement | null;
  prisonLabelTex?: THREE.CanvasTexture | null;
  lastPrisonLabelText?: string;
  titleSprite?: THREE.Sprite | null;
  scale: number;
  guardSide: number;
  bowTimer: number;
  proximityBowBlend: number;
  isDismountedForSultan: boolean;
  wasFarFromSultan: boolean;
  homeX: number;
  homeY: number;
  homeZ: number;
  homeRotY: number;
  playPartnerId?: string;
  playMode: 'chase' | 'roam' | 'hop';
  playStateTimer: number;
  sightBowCooldown: number;
  isRoyalFamily: boolean;
  isRoyalSultana: boolean;
  isRoyalVizier: boolean;
  isRoyalQueen: boolean;
  isCrownPrince: boolean;
  neverBowsToSultan: boolean;
  queenPhase: 'sleeping' | 'palace_patrol' | 'exiting' | 'strolling' | 'returning';
  queenPhaseTimer: number;
  queenRouteIdx: number;
  vizierPhase: 'sleeping' | 'resting' | 'arriving' | 'bowing' | 'seated' | 'returning';
  vizierPhaseTimer: number;
  vizierRouteIdx: number;
  vizierLastMorningDay: number;
  vizierDismissedBySultan: boolean;
  royalBowTimer: number;
  swordSwingTimer: number;
  isCafeNpc: boolean;
  cafeKind?: CafeNpcKind;
  cafeSeatPos: THREE.Vector3;
  cafeSeatFacing: number;
  cafeStandPos: THREE.Vector3;
  cafeHomeFacing: number;
  cafeStandUpBlend: number;
  group: THREE.Group;
  modelGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  handAnchorR: THREE.Object3D | null;
  pos: THREE.Vector3;
  facingAngle: number;
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction | null;
  idleAction: THREE.AnimationAction | null;
  waveAction: THREE.AnimationAction | null;
  currentAnim: 'walk' | 'idle' | 'wave';
  walkSpeed: number;
  waypoints: [number, number][];
  waypointIdx: number;
  pauseTimer: number;
  stuckTimer: number;
  lastProgressPos: THREE.Vector3;
  isRainbow: boolean;
  rainbowPhase: number;
  rainbowMats: { mat: THREE.MeshStandardMaterial; hueOffset: number; sat: number; light: number }[];
  // Horse companion & riding/leading skeletal state
  horse: HorseEntity | null;
  ropeVisual: LeadRopeVisual | null;
  rideBobTime: number;
  spineBone: THREE.Object3D | null;
  chestBone: THREE.Object3D | null;
  headBone: THREE.Object3D | null;
  upperLegL: THREE.Object3D | null;
  lowerLegL: THREE.Object3D | null;
  upperLegR: THREE.Object3D | null;
  lowerLegR: THREE.Object3D | null;
  upperArmL: THREE.Object3D | null;
  lowerArmL: THREE.Object3D | null;
  upperArmR: THREE.Object3D | null;
  lowerArmR: THREE.Object3D | null;
  rideUpperArmQuatL: THREE.Quaternion;
  rideLowerArmQuatL: THREE.Quaternion;
  rideUpperArmQuatR: THREE.Quaternion;
  rideLowerArmQuatR: THREE.Quaternion;
  leadUpperArmQuatR: THREE.Quaternion;
  leadLowerArmQuatR: THREE.Quaternion;
  actionQuats: ActionArmQuats;
  accumDelta: number;
}

export class CitizenManager {
  public group: THREE.Group;
  public citizens: CitizenEntity[] = [];

  private palaceDoorOpeners: THREE.Vector3[] = [];
  private disposables: { dispose: () => void }[] = [];
  private updateTickCount: number = 0;
  private elapsed: number = 0;
  private sharedShadowTex: THREE.CanvasTexture;
  private sharedShadowGeo: THREE.PlaneGeometry;

  private readonly rideUpperLegQuatL: THREE.Quaternion;
  private readonly rideLowerLegQuatL: THREE.Quaternion;
  private readonly rideUpperLegQuatR: THREE.Quaternion;
  private readonly rideLowerLegQuatR: THREE.Quaternion;
  private readonly boatUpperLegQuatL: THREE.Quaternion;
  private readonly boatLowerLegQuatL: THREE.Quaternion;
  private readonly boatUpperLegQuatR: THREE.Quaternion;
  private readonly boatLowerLegQuatR: THREE.Quaternion;

  private readonly kickFwdLegQuatL: THREE.Quaternion;
  private readonly kickBackLegQuatL: THREE.Quaternion;
  private readonly kickFwdLegQuatR: THREE.Quaternion;
  private readonly kickBackLegQuatR: THREE.Quaternion;
  private readonly kickBentShinQuatL: THREE.Quaternion;
  private readonly kickBentShinQuatR: THREE.Quaternion;
  private readonly limpLegQuatL: THREE.Quaternion;
  private readonly limpLegQuatR: THREE.Quaternion;
  private readonly crouchThighQuatL: THREE.Quaternion;
  private readonly crouchThighQuatR: THREE.Quaternion;
  private readonly crouchShinQuatL: THREE.Quaternion;
  private readonly crouchShinQuatR: THREE.Quaternion;

  private execution: ExecutionState | null = null;
  private imprisonment: ImprisonmentState | null = null;
  private feedLion: FeedLionState | null = null;
  private guardsProtectMode: boolean = false;
  private speechAudienceIds: Map<string, number> = new Map();
  private knightTemplateCache: {
    template: THREE.Group;
    walkClip: THREE.AnimationClip | null;
    idleClip: THREE.AnimationClip | null;
    waveClip: THREE.AnimationClip | null;
  } | null = null;
  private imprisonedCount: number = 0;
  private screamCanvas: HTMLCanvasElement | null = null;
  private screamTexture: THREE.CanvasTexture | null = null;
  private screamSprite: THREE.Sprite | null = null;

  private borderSpeechSprite: THREE.Sprite | null = null;
  private wasNearRomanBorder: boolean = false;

  private loadingManager?: THREE.LoadingManager;
  private onModelsLoaded?: () => void;
  private pendingMoneyMap: Record<string, number> = {};
  private pendingPrisonersMap: Record<string, SavedPrisonerRecord> = {};
  private recentPrisonEvent: PrisonEventInfo | null = null;

  constructor(loadingManager?: THREE.LoadingManager, onModelsLoaded?: () => void) {
    this.loadingManager = loadingManager;
    this.onModelsLoaded = onModelsLoaded;
    this.group = new THREE.Group();
    this.group.name = 'KingdomCitizens';

    const fwdZ = new THREE.Vector3(0, 0, 1);
    const shinWorldL = this.quatFromYZ(new THREE.Vector3(0.1, -0.99, -0.08), fwdZ);
    const shinWorldR = this.quatFromYZ(new THREE.Vector3(-0.1, -0.99, -0.08), fwdZ);
    this.rideUpperLegQuatL = this.quatFromYZ(new THREE.Vector3(0.62, -0.52, 0.58), fwdZ);
    this.rideUpperLegQuatR = this.quatFromYZ(new THREE.Vector3(-0.62, -0.52, 0.58), fwdZ);
    this.rideLowerLegQuatL = this.rideUpperLegQuatL.clone().invert().multiply(shinWorldL);
    this.rideLowerLegQuatR = this.rideUpperLegQuatR.clone().invert().multiply(shinWorldR);

    const boatThighL = this.quatFromYZ(new THREE.Vector3(0.08, -0.18, 0.98), fwdZ);
    const boatThighR = this.quatFromYZ(new THREE.Vector3(-0.08, -0.18, 0.98), fwdZ);
    const boatShinL = this.quatFromYZ(new THREE.Vector3(0.04, -0.99, 0.08), fwdZ);
    const boatShinR = this.quatFromYZ(new THREE.Vector3(-0.04, -0.99, 0.08), fwdZ);
    this.boatUpperLegQuatL = boatThighL;
    this.boatUpperLegQuatR = boatThighR;
    this.boatLowerLegQuatL = boatThighL.clone().invert().multiply(boatShinL);
    this.boatLowerLegQuatR = boatThighR.clone().invert().multiply(boatShinR);

    this.kickFwdLegQuatL = this.quatFromYZ(new THREE.Vector3(0.12, -0.58, 0.8), fwdZ);
    this.kickBackLegQuatL = this.quatFromYZ(new THREE.Vector3(0.12, -0.78, -0.61), fwdZ);
    this.kickFwdLegQuatR = this.quatFromYZ(new THREE.Vector3(-0.12, -0.58, 0.8), fwdZ);
    this.kickBackLegQuatR = this.quatFromYZ(new THREE.Vector3(-0.12, -0.78, -0.61), fwdZ);
    this.kickBentShinQuatL = this.kickFwdLegQuatL
      .clone()
      .invert()
      .multiply(this.quatFromYZ(new THREE.Vector3(0.08, -0.72, -0.68), fwdZ));
    this.kickBentShinQuatR = this.kickFwdLegQuatR
      .clone()
      .invert()
      .multiply(this.quatFromYZ(new THREE.Vector3(-0.08, -0.72, -0.68), fwdZ));

    this.limpLegQuatL = this.quatFromYZ(new THREE.Vector3(0.06, -0.99, -0.04), fwdZ);
    this.limpLegQuatR = this.quatFromYZ(new THREE.Vector3(-0.06, -0.99, -0.04), fwdZ);

    this.crouchThighQuatL = this.quatFromYZ(new THREE.Vector3(0.18, -0.45, 0.87), fwdZ);
    this.crouchThighQuatR = this.quatFromYZ(new THREE.Vector3(-0.18, -0.45, 0.87), fwdZ);
    this.crouchShinQuatL = this.crouchThighQuatL
      .clone()
      .invert()
      .multiply(this.quatFromYZ(new THREE.Vector3(0.08, -0.92, -0.38), fwdZ));
    this.crouchShinQuatR = this.crouchThighQuatR
      .clone()
      .invert()
      .multiply(this.quatFromYZ(new THREE.Vector3(-0.08, -0.92, -0.38), fwdZ));

    this.sharedShadowTex = createRadialShadowTexture();
    this.sharedShadowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    this.disposables.push(this.sharedShadowTex, this.sharedShadowGeo);

    this.initScreamBubble();
    this.loadAndSpawnCitizens();
  }

  private initScreamBubble() {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 200;
    this.screamCanvas = canvas;
    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    this.screamTexture = tex;

    const mat = this.track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.8, 0.88, 1);
    sprite.renderOrder = 999;
    sprite.visible = false;
    this.group.add(sprite);
    this.screamSprite = sprite;
  }

  private updateScreamBubble(text: string, countdownSec: number | null) {
    if (!this.screamCanvas || !this.screamTexture || !this.screamSprite) return;
    if (
      this.execution &&
      this.execution.lastBubbleText === text &&
      this.execution.lastBubbleSec === (countdownSec ?? -1)
    ) {
      return;
    }
    if (this.execution) {
      this.execution.lastBubbleText = text;
      this.execution.lastBubbleSec = countdownSec ?? -1;
    }

    const ctx = this.screamCanvas.getContext('2d');
    if (!ctx) return;
    const w = this.screamCanvas.width;
    const h = this.screamCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark crimson speech pill with gold border
    ctx.fillStyle = 'rgba(28, 10, 10, 0.92)';
    ctx.beginPath();
    ctx.roundRect(16, 18, w - 32, h - 48, 28);
    ctx.fill();

    ctx.strokeStyle = countdownSec !== null ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Small downward tail
    ctx.fillStyle = 'rgba(28, 10, 10, 0.92)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 18, h - 30);
    ctx.lineTo(w / 2 + 18, h - 30);
    ctx.lineTo(w / 2, h - 4);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fef2f2';
    ctx.font = '900 38px "Tajawal", sans-serif';
    ctx.fillText(text, w / 2, countdownSec !== null ? 68 : 88);

    if (countdownSec !== null) {
      ctx.fillStyle = '#fca5a5';
      ctx.font = '800 30px "Tajawal", sans-serif';
      ctx.fillText(`⏳ ${countdownSec} ث`, w / 2, 126);
    }

    this.screamTexture.needsUpdate = true;
  }

  private computeActionArmQuats(
    shoulderL: THREE.Object3D | null,
    shoulderR: THREE.Object3D | null
  ): ActionArmQuats {
    const upHint = new THREE.Vector3(0, 1, 0);
    const out: ActionArmQuats = {
      carryUpperL: new THREE.Quaternion(),
      carryLowerL: new THREE.Quaternion(),
      carryUpperR: new THREE.Quaternion(),
      carryLowerR: new THREE.Quaternion(),
      raiseUpperL: new THREE.Quaternion(),
      raiseLowerL: new THREE.Quaternion(),
      raiseUpperR: new THREE.Quaternion(),
      raiseLowerR: new THREE.Quaternion(),
      throwBackUpperL: new THREE.Quaternion(),
      throwBackUpperR: new THREE.Quaternion(),
      limpUpperL: new THREE.Quaternion(),
      limpUpperR: new THREE.Quaternion(),
      rowCatchUpperL: new THREE.Quaternion(),
      rowCatchLowerL: new THREE.Quaternion(),
      rowCatchUpperR: new THREE.Quaternion(),
      rowCatchLowerR: new THREE.Quaternion(),
      rowPullUpperL: new THREE.Quaternion(),
      rowPullLowerL: new THREE.Quaternion(),
      rowPullUpperR: new THREE.Quaternion(),
      rowPullLowerR: new THREE.Quaternion(),
      benchUpperL: new THREE.Quaternion(),
      benchLowerL: new THREE.Quaternion(),
      benchUpperR: new THREE.Quaternion(),
      benchLowerR: new THREE.Quaternion(),
    };

    if (shoulderL) {
      const shW = shoulderL.getWorldQuaternion(new THREE.Quaternion());
      const carryU = this.quatFromYZ(new THREE.Vector3(0.18, -0.18, 0.96), upHint);
      const carryL = this.quatFromYZ(new THREE.Vector3(-0.18, 0.12, 0.97), upHint);
      out.carryUpperL.copy(shW.clone().invert().multiply(carryU));
      out.carryLowerL.copy(carryU.clone().invert().multiply(carryL));

      const raiseU = this.quatFromYZ(new THREE.Vector3(0.32, 0.84, 0.44), upHint);
      const raiseL = this.quatFromYZ(new THREE.Vector3(-0.55, 0.42, 0.72), upHint);
      out.raiseUpperL.copy(shW.clone().invert().multiply(raiseU));
      out.raiseLowerL.copy(raiseU.clone().invert().multiply(raiseL));

      const backU = this.quatFromYZ(new THREE.Vector3(0.24, 0.68, -0.69), upHint);
      out.throwBackUpperL.copy(shW.clone().invert().multiply(backU));

      const limpU = this.quatFromYZ(new THREE.Vector3(0.14, -0.98, 0.08), upHint);
      out.limpUpperL.copy(shW.clone().invert().multiply(limpU));

      const rowCatchUL = this.quatFromYZ(new THREE.Vector3(0.16, -0.24, 0.95), upHint);
      const rowCatchLL = this.quatFromYZ(new THREE.Vector3(-0.08, -0.1, 0.99), upHint);
      out.rowCatchUpperL.copy(shW.clone().invert().multiply(rowCatchUL));
      out.rowCatchLowerL.copy(rowCatchUL.clone().invert().multiply(rowCatchLL));

      const rowPullUL = this.quatFromYZ(new THREE.Vector3(0.24, -0.74, -0.63), upHint);
      const rowPullLL = this.quatFromYZ(new THREE.Vector3(-0.12, -0.08, 0.99), upHint);
      out.rowPullUpperL.copy(shW.clone().invert().multiply(rowPullUL));
      out.rowPullLowerL.copy(rowPullUL.clone().invert().multiply(rowPullLL));

      const benchUL = this.quatFromYZ(new THREE.Vector3(0.22, -0.82, 0.52), upHint);
      const benchLL = this.quatFromYZ(new THREE.Vector3(-0.18, -0.45, 0.87), upHint);
      out.benchUpperL.copy(shW.clone().invert().multiply(benchUL));
      out.benchLowerL.copy(benchUL.clone().invert().multiply(benchLL));
    }
    if (shoulderR) {
      const shW = shoulderR.getWorldQuaternion(new THREE.Quaternion());
      const carryU = this.quatFromYZ(new THREE.Vector3(-0.18, -0.18, 0.96), upHint);
      const carryL = this.quatFromYZ(new THREE.Vector3(0.18, 0.12, 0.97), upHint);
      out.carryUpperR.copy(shW.clone().invert().multiply(carryU));
      out.carryLowerR.copy(carryU.clone().invert().multiply(carryL));

      const raiseU = this.quatFromYZ(new THREE.Vector3(-0.32, 0.84, 0.44), upHint);
      const raiseL = this.quatFromYZ(new THREE.Vector3(0.55, 0.42, 0.72), upHint);
      out.raiseUpperR.copy(shW.clone().invert().multiply(raiseU));
      out.raiseLowerR.copy(raiseU.clone().invert().multiply(raiseL));

      const backU = this.quatFromYZ(new THREE.Vector3(-0.24, 0.68, -0.69), upHint);
      out.throwBackUpperR.copy(shW.clone().invert().multiply(backU));

      const limpU = this.quatFromYZ(new THREE.Vector3(-0.14, -0.98, 0.08), upHint);
      out.limpUpperR.copy(shW.clone().invert().multiply(limpU));

      const rowCatchUR = this.quatFromYZ(new THREE.Vector3(-0.16, -0.24, 0.95), upHint);
      const rowCatchLR = this.quatFromYZ(new THREE.Vector3(0.08, -0.1, 0.99), upHint);
      out.rowCatchUpperR.copy(shW.clone().invert().multiply(rowCatchUR));
      out.rowCatchLowerR.copy(rowCatchUR.clone().invert().multiply(rowCatchLR));

      const rowPullUR = this.quatFromYZ(new THREE.Vector3(-0.24, -0.74, -0.63), upHint);
      const rowPullLR = this.quatFromYZ(new THREE.Vector3(0.12, -0.08, 0.99), upHint);
      out.rowPullUpperR.copy(shW.clone().invert().multiply(rowPullUR));
      out.rowPullLowerR.copy(rowPullUR.clone().invert().multiply(rowPullLR));

      const benchUR = this.quatFromYZ(new THREE.Vector3(-0.22, -0.82, 0.52), upHint);
      const benchLR = this.quatFromYZ(new THREE.Vector3(0.18, -0.45, 0.87), upHint);
      out.benchUpperR.copy(shW.clone().invert().multiply(benchUR));
      out.benchLowerR.copy(benchUR.clone().invert().multiply(benchLR));
    }

    return out;
  }

  private quatFromYZ(dirY: THREE.Vector3, hintZ: THREE.Vector3): THREE.Quaternion {
    const y = dirY.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, hintZ).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private getCitizenConfigs(): CitizenConfig[] {
    return [
      // 1. Emerald Market Merchant (standing right beside NW Market Stall & Goods)
      {
        id: 'c_emerald',
        role: 'merchant',
        startX: -11.0,
        startZ: -2.5,
        homeRotY: Math.PI / 2,
        scale: 1.34,
        hatStyle: 'turban',
        hatColor: 0xf5ecd8,
        hatAccent: 0xd4af37,
        beardStyle: 'full',
        backStyle: 'satchel',
        backColor: 0x734422,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe6b28a,
        hairColor: 0x261810,
        topPrimary: 0x1b7a4b,
        topSecondary: 0xe8ddc5,
        topAccent: 0xd9a834,
        bottomPrimary: 0x283b30,
        sleeveColor: 0x135936,
        shoeColor: 0x452a16,
        walkSpeed: 1.85,
        waypoints: [
          [-10.2, -2.5],
          [-10.2, 16.0],
          [0.0, 22.0],
          [10.2, 16.0],
          [10.2, -2.5],
          [0.0, -14.0],
        ],
      },
      // 3. Royal Cobalt Explorer (Walker patrolling main boulevards)
      {
        id: 'c_cobalt',
        role: 'walker',
        startX: 2.2,
        startZ: 17.5,
        scale: 1.38,
        hatStyle: 'hood',
        hatColor: 0x1f4985,
        hatAccent: 0xd9c282,
        beardStyle: 'goatee',
        backStyle: 'cape',
        backColor: 0x1a3b6e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf2c5a2,
        hairColor: 0x3b2618,
        topPrimary: 0x23549c,
        topSecondary: 0xe8e2d5,
        topAccent: 0x73a8e6,
        bottomPrimary: 0x1c2840,
        sleeveColor: 0x183d75,
        shoeColor: 0x2e2118,
        walkSpeed: 2.15,
        waypoints: [
          [2.2, 17.5],
          [2.0, 38.0],
          [-18.0, 24.5],
          [-29.0, 4.0],
          [-8.0, 3.5],
        ],
      },
      // 4. Desert Saffron Merchant (Standing beside NE Market Stall & Goods)
      {
        id: 'c_saffron',
        role: 'merchant',
        startX: 11.0,
        startZ: -2.5,
        homeRotY: -Math.PI / 2,
        scale: 1.32,
        hatStyle: 'wideHat',
        hatColor: 0xd6b065,
        hatAccent: 0x8a4221,
        beardStyle: 'full',
        backStyle: 'backpack',
        backColor: 0x6e4728,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xdea478,
        hairColor: 0x452b16,
        topPrimary: 0xd17e1d,
        topSecondary: 0xf5e8cf,
        topAccent: 0x782e18,
        bottomPrimary: 0x4d3724,
        sleeveColor: 0xa65d14,
        shoeColor: 0x3b2412,
        walkSpeed: 1.75,
        waypoints: [[11.0, -2.5]],
      },
      // 5. Plum Mystic / Scholar (Walker with Lantern patrolling East District)
      {
        id: 'c_plum',
        role: 'walker',
        startX: 10.5,
        startZ: -12.0,
        scale: 1.3,
        hatStyle: 'fez',
        hatColor: 0x7d1d3f,
        hatAccent: 0xe8c14a,
        beardStyle: 'goatee',
        backStyle: 'none',
        backColor: 0x4b1d5c,
        showRightProp: true,
        showLeftProp: false,
        skinColor: 0xf0c7a8,
        hairColor: 0x262229,
        topPrimary: 0x692b82,
        topSecondary: 0xebd9f2,
        topAccent: 0xe0b443,
        bottomPrimary: 0x2c1b38,
        sleeveColor: 0x4e1e63,
        shoeColor: 0x241729,
        walkSpeed: 1.7,
        waypoints: [
          [10.5, -12.0],
          [28.5, -12.0],
          [30.5, 4.0],
          [10.0, 3.5],
          [4.0, -18.0],
        ],
      },
      // 6. Turquoise Caravan Trader (Merchant standing beside SW Roadside Cargo & Goods)
      {
        id: 'c_turquoise',
        role: 'merchant',
        startX: -12.7,
        startZ: 26.8,
        homeRotY: -Math.PI * 0.58,
        scale: 1.36,
        hatStyle: 'keffiyeh',
        hatColor: 0xf5f0e6,
        hatAccent: 0x1a1a1a,
        beardStyle: 'mustache',
        backStyle: 'satchel',
        backColor: 0x5c361c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xd99e73,
        hairColor: 0x1f1916,
        topPrimary: 0x17828f,
        topSecondary: 0xf2dfc2,
        topAccent: 0xebb944,
        bottomPrimary: 0x1f3a40,
        sleeveColor: 0x115e69,
        shoeColor: 0x4a2c16,
        walkSpeed: 2.05,
        waypoints: [[-12.7, 26.8]],
      },
      // 7. Royal Palace Guard Captain (Standing Armored Guard at Palace Entrance)
      {
        id: 'c_guard_west',
        role: 'standing',
        isArmoredGuard: true,
        startX: -4.4,
        startZ: -19.5,
        homeRotY: 0,
        scale: 1.42,
        hatStyle: 'helmet',
        hatColor: 0x7c838e,
        hatAccent: 0xa4acb8,
        beardStyle: 'mustache',
        backStyle: 'cape',
        backColor: 0x5c636e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xedc09a,
        hairColor: 0x2b1e15,
        topPrimary: 0x7a828d,
        topSecondary: 0x949ca8,
        topAccent: 0xa6aeb9,
        bottomPrimary: 0x6c737e,
        sleeveColor: 0x626974,
        shoeColor: 0x353942,
        walkSpeed: 1.9,
        waypoints: [[-4.4, -19.5]],
      },
      // 8. Royal Execution Watch Guard (Standing Armored Guard beside the Royal Gallows)
      {
        id: 'c_guard_east',
        role: 'standing',
        isArmoredGuard: true,
        startX: -9.6,
        startZ: -15.8,
        homeRotY: -Math.PI * 0.65,
        scale: 1.4,
        hatStyle: 'helmet',
        hatColor: 0x747b86,
        hatAccent: 0xa4acb8,
        beardStyle: 'goatee',
        backStyle: 'cape',
        backColor: 0x555c66,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe3b189,
        hairColor: 0x332419,
        topPrimary: 0x737b86,
        topSecondary: 0x8e96a2,
        topAccent: 0xa0a8b3,
        bottomPrimary: 0x656c77,
        sleeveColor: 0x5c636e,
        shoeColor: 0x31353d,
        walkSpeed: 1.85,
        waypoints: [[-9.6, -15.8]],
      },
      // 9. Burgundy Goods Peddler (Merchant standing beside West Plaza Cargo & Silk Rolls)
      {
        id: 'c_burgundy',
        role: 'merchant',
        startX: -10.1,
        startZ: 12.6,
        homeRotY: Math.PI * 0.42,
        scale: 1.28,
        hatStyle: 'beret',
        hatColor: 0x611728,
        hatAccent: 0xebcf94,
        beardStyle: 'mustache',
        backStyle: 'none',
        backColor: 0x5c2e1c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf5ccb0,
        hairColor: 0x4f301b,
        topPrimary: 0x87223a,
        topSecondary: 0xf7edd9,
        topAccent: 0xd9bd82,
        bottomPrimary: 0x382026,
        sleeveColor: 0x63182a,
        shoeColor: 0x3b2217,
        walkSpeed: 1.8,
        waypoints: [[-10.1, 12.6]],
      },
      // 10. Forest Ranger (Walker patrolling Outer West & South Kingdoms)
      {
        id: 'c_forest',
        role: 'walker',
        startX: -30.5,
        startZ: 21.0,
        scale: 1.35,
        hatStyle: 'hood',
        hatColor: 0x3b5922,
        hatAccent: 0xa67c46,
        beardStyle: 'none',
        backStyle: 'backpack',
        backColor: 0x593a1e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xebbc96,
        hairColor: 0x593218,
        topPrimary: 0x4b6e2c,
        topSecondary: 0xd9ccaa,
        topAccent: 0xb88644,
        bottomPrimary: 0x33281b,
        sleeveColor: 0x37521f,
        shoeColor: 0x2e1f12,
        walkSpeed: 2.25,
        waypoints: [
          [-30.5, 21.0],
          [-30.5, 39.0],
          [-8.0, 44.0],
          [16.0, 35.0],
          [30.5, 24.5],
          [0.0, 24.5],
        ],
      },
      // 11. Terracotta Artisan Merchant (Standing beside East Plaza Cargo & Grain Sacks)
      {
        id: 'c_terracotta',
        role: 'merchant',
        startX: 10.1,
        startZ: 12.6,
        homeRotY: -Math.PI * 0.42,
        scale: 1.31,
        hatStyle: 'turban',
        hatColor: 0xe69f5c,
        hatAccent: 0x8f2d19,
        beardStyle: 'mustache',
        backStyle: 'satchel',
        backColor: 0x6b3b1e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xde9e71,
        hairColor: 0x211814,
        topPrimary: 0xb84a28,
        topSecondary: 0xf7e6cb,
        topAccent: 0xf0be59,
        bottomPrimary: 0x452a1e,
        sleeveColor: 0x8f361b,
        shoeColor: 0x331d12,
        walkSpeed: 1.9,
        waypoints: [[10.1, 12.6]],
      },
      // 12. Ivory Elder / Wise Scholar (Standing near the Central Royal Well)
      {
        id: 'c_ivory',
        role: 'standing',
        startX: -2.5,
        startZ: -11.4,
        homeRotY: Math.PI * 0.25,
        scale: 1.33,
        hatStyle: 'fez',
        hatColor: 0x1c456e,
        hatAccent: 0xf2d16b,
        beardStyle: 'full',
        backStyle: 'cape',
        backColor: 0xc2b9aa,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf2ccb0,
        hairColor: 0xd9d6d0,
        topPrimary: 0xe3dacb,
        topSecondary: 0x285685,
        topAccent: 0xd6a93c,
        bottomPrimary: 0x424752,
        sleeveColor: 0xc2b8a9,
        shoeColor: 0x453224,
        walkSpeed: 1.55,
        waypoints: [[-2.5, -11.4]],
      },
      // 13. Mustard Ochre Harvester (Walker patrolling East Avenue & Orchards)
      {
        id: 'c_ochre',
        role: 'walker',
        startX: 30.5,
        startZ: -26.0,
        scale: 1.29,
        hatStyle: 'wideHat',
        hatColor: 0xc9a353,
        hatAccent: 0x4a2f1c,
        beardStyle: 'none',
        backStyle: 'backpack',
        backColor: 0x704a26,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xebba94,
        hairColor: 0x5c361b,
        topPrimary: 0xc4911b,
        topSecondary: 0xf7ecd2,
        topAccent: 0x59341d,
        bottomPrimary: 0x3b2e23,
        sleeveColor: 0x996e11,
        shoeColor: 0x2e2116,
        walkSpeed: 1.95,
        waypoints: [
          [30.5, -26.0],
          [42.0, -24.0],
          [30.5, -4.0],
          [30.5, 16.0],
          [16.0, 3.5],
        ],
      },
      // 14. Coral Traveler (Walker patrolling West Avenue & Countryside)
      {
        id: 'c_coral',
        role: 'walker',
        startX: -30.5,
        startZ: -12.0,
        scale: 1.32,
        hatStyle: 'keffiyeh',
        hatColor: 0xf5ddd6,
        hatAccent: 0x59261b,
        beardStyle: 'goatee',
        backStyle: 'satchel',
        backColor: 0x523118,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe8b690,
        hairColor: 0x261a14,
        topPrimary: 0xc95540,
        topSecondary: 0xfce9d2,
        topAccent: 0x402620,
        bottomPrimary: 0x3d2a26,
        sleeveColor: 0x9c3e2d,
        shoeColor: 0x331f1a,
        walkSpeed: 2.1,
        waypoints: [
          [-30.5, -12.0],
          [-45.0, 3.5],
          [-30.5, 18.0],
          [-10.0, 3.5],
          [-17.5, -18.0],
        ],
      },
      // 15. Mint Jade Spice Peddler (Merchant standing beside East Avenue Cargo Depot)
      {
        id: 'c_mint',
        role: 'merchant',
        startX: 23.5,
        startZ: 11.2,
        homeRotY: Math.PI * 0.48,
        scale: 1.27,
        hatStyle: 'beret',
        hatColor: 0x246b56,
        hatAccent: 0xe6c367,
        beardStyle: 'none',
        backStyle: 'satchel',
        backColor: 0x6b4121,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf4c8a6,
        hairColor: 0x3b2516,
        topPrimary: 0x349477,
        topSecondary: 0xf2efe4,
        topAccent: 0xe3bd5d,
        bottomPrimary: 0x234037,
        sleeveColor: 0x256e57,
        shoeColor: 0x38271b,
        walkSpeed: 2.0,
        waypoints: [[23.5, 11.2]],
      },
      // 16. Cedar Woodsman (Standing inspecting the Ruined House & Shovel on Broken Ground)
      {
        id: 'c_cedar',
        role: 'standing',
        startX: 43.2,
        startZ: 24.4,
        homeRotY: Math.PI * 0.72,
        scale: 1.39,
        hatStyle: 'none',
        hatColor: 0x5c3b20,
        hatAccent: 0xd9b873,
        beardStyle: 'full',
        backStyle: 'backpack',
        backColor: 0x4d311a,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe0aa82,
        hairColor: 0x59341b,
        topPrimary: 0x6e4729,
        topSecondary: 0xd9cbb8,
        topAccent: 0x4c783e,
        bottomPrimary: 0x2e2319,
        sleeveColor: 0x4f321c,
        shoeColor: 0x241910,
        walkSpeed: 1.85,
        waypoints: [[43.2, 24.4]],
      },
      // 17. West Avenue Groom (Leading Brown Horse by Rope)
      {
        id: 'c_leader_1',
        role: 'horse_leader',
        startX: -30.5,
        startZ: 24.4,
        scale: 1.35,
        hatStyle: 'wideHat',
        hatColor: 0x9c7240,
        hatAccent: 0x3b2412,
        beardStyle: 'mustache',
        backStyle: 'satchel',
        backColor: 0x5c361c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe6b58c,
        hairColor: 0x3b2618,
        topPrimary: 0x8c5327,
        topSecondary: 0xf2e4cc,
        topAccent: 0xd9a834,
        bottomPrimary: 0x38281c,
        sleeveColor: 0x6b3d1a,
        shoeColor: 0x2b1b10,
        walkSpeed: 1.9,
        waypoints: [
          [-30.5, 24.4],
          [-30.5, 38.0],
          [-4.0, 44.0],
          [-8.0, 24.5],
          [-30.5, 12.0],
        ],
      },
      // 18. East Avenue Handler (Leading White Horse by Rope)
      {
        id: 'c_leader_2',
        role: 'horse_leader',
        startX: 30.5,
        startZ: 7.6,
        scale: 1.34,
        hatStyle: 'turban',
        hatColor: 0xf4ece0,
        hatAccent: 0x2b7a68,
        beardStyle: 'goatee',
        backStyle: 'none',
        backColor: 0x2b7a68,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xdca175,
        hairColor: 0x1f1916,
        topPrimary: 0x1e7a68,
        topSecondary: 0xf5ecd8,
        topAccent: 0xd9a834,
        bottomPrimary: 0x203833,
        sleeveColor: 0x15574a,
        shoeColor: 0x3d2817,
        walkSpeed: 1.85,
        waypoints: [
          [30.5, 7.6],
          [30.5, 25.0],
          [10.0, 24.5],
          [10.0, 3.5],
          [30.5, -9.0],
        ],
      },
      // 19. South Plaza Groom (Leading Black Horse by Rope)
      {
        id: 'c_leader_3',
        role: 'horse_leader',
        startX: -2.4,
        startZ: 28.0,
        scale: 1.33,
        hatStyle: 'beret',
        hatColor: 0x2c3c6b,
        hatAccent: 0xe6c15a,
        beardStyle: 'none',
        backStyle: 'backpack',
        backColor: 0x5c3a20,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf0c4a0,
        hairColor: 0x452b18,
        topPrimary: 0x384d85,
        topSecondary: 0xede6d8,
        topAccent: 0xe0b443,
        bottomPrimary: 0x22293d,
        sleeveColor: 0x273761,
        shoeColor: 0x2b2016,
        walkSpeed: 1.8,
        waypoints: [
          [-2.4, 28.0],
          [3.5, 39.0],
          [2.5, 16.0],
          [4.8, 3.5],
          [-3.0, 14.0],
        ],
      },
      // 20. Royal Outrider Captain (Riding White Horse across Kingdom Plazas)
      {
        id: 'c_rider_1',
        role: 'horse_rider',
        startX: 3.2,
        startZ: -16.2,
        scale: 1.38,
        hatStyle: 'helmet',
        hatColor: 0x9aa4b2,
        hatAccent: 0xe0b543,
        beardStyle: 'mustache',
        backStyle: 'cape',
        backColor: 0xa61c2c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf2c7a5,
        hairColor: 0x2b1e15,
        topPrimary: 0x424d5e,
        topSecondary: 0xf0eadc,
        topAccent: 0xe6b83e,
        bottomPrimary: 0x232933,
        sleeveColor: 0x2e3645,
        shoeColor: 0x1a1817,
        walkSpeed: 4.35,
        waypoints: [
          [3.2, -16.2],
          [5.2, -4.0],
          [28.5, 3.5],
          [30.5, -20.0],
          [4.0, -20.5],
        ],
      },
      // 21. Desert Noble Rider (Riding Black Horse through West & South Avenues)
      {
        id: 'c_rider_2',
        role: 'horse_rider',
        startX: -30.5,
        startZ: -18.0,
        scale: 1.38,
        hatStyle: 'turban',
        hatColor: 0xe8b948,
        hatAccent: 0xb51d2e,
        beardStyle: 'full',
        backStyle: 'cape',
        backColor: 0x1c4a3c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xdfa67b,
        hairColor: 0x241710,
        topPrimary: 0x1f5c49,
        topSecondary: 0xf7ecd2,
        topAccent: 0xe8bc46,
        bottomPrimary: 0x1e2c28,
        sleeveColor: 0x174536,
        shoeColor: 0x3b2314,
        walkSpeed: 4.6,
        waypoints: [
          [-30.5, -18.0],
          [-30.5, 3.5],
          [-30.5, 24.5],
          [-8.0, 39.0],
          [-2.0, 18.0],
          [-10.0, -19.0],
        ],
      },
      // 22. Royal Courier Rider (Riding Brown Horse through East & North-East Loops)
      {
        id: 'c_rider_3',
        role: 'horse_rider',
        startX: 30.5,
        startZ: -14.0,
        scale: 1.38,
        hatStyle: 'hood',
        hatColor: 0x6e2438,
        hatAccent: 0xd9b86c,
        beardStyle: 'goatee',
        backStyle: 'satchel',
        backColor: 0x5c361c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xebbc96,
        hairColor: 0x382315,
        topPrimary: 0x872d45,
        topSecondary: 0xf2e6d5,
        topAccent: 0xe0b543,
        bottomPrimary: 0x331b22,
        sleeveColor: 0x631f31,
        shoeColor: 0x2e1e14,
        walkSpeed: 4.45,
        waypoints: [
          [30.5, -14.0],
          [30.5, 22.0],
          [18.0, 34.0],
          [2.0, 22.0],
          [10.0, -14.0],
        ],
      },
      // 25. Royal Right-Flank Bodyguard (follows Sultan's right side)
      {
        id: 'c_bodyguard_right',
        role: 'bodyguard',
        guardSide: -1,
        isArmoredGuard: true,
        startX: -1.55,
        startZ: -0.45,
        homeRotY: 0,
        scale: 1.4,
        hatStyle: 'helmet',
        hatColor: 0x7c838e,
        hatAccent: 0xa4acb8,
        beardStyle: 'mustache',
        backStyle: 'cape',
        backColor: 0x5c636e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xedc09a,
        hairColor: 0x2b1e15,
        topPrimary: 0x7a828d,
        topSecondary: 0x949ca8,
        topAccent: 0xa6aeb9,
        bottomPrimary: 0x6c737e,
        sleeveColor: 0x626974,
        shoeColor: 0x353942,
        walkSpeed: 4.5,
        waypoints: [[-1.55, -0.45]],
      },
      // 26. Royal Left-Flank Bodyguard (follows Sultan's left side)
      {
        id: 'c_bodyguard_left',
        role: 'bodyguard',
        guardSide: 1,
        isArmoredGuard: true,
        startX: 1.55,
        startZ: -0.45,
        homeRotY: 0,
        scale: 1.4,
        hatStyle: 'helmet',
        hatColor: 0x747b86,
        hatAccent: 0xa4acb8,
        beardStyle: 'goatee',
        backStyle: 'cape',
        backColor: 0x555c66,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe3b189,
        hairColor: 0x332419,
        topPrimary: 0x737b86,
        topSecondary: 0x8e96a2,
        topAccent: 0xa0a8b3,
        bottomPrimary: 0x656c77,
        sleeveColor: 0x5c636e,
        shoeColor: 0x31353d,
        walkSpeed: 4.5,
        waypoints: [[1.55, -0.45]],
      },
      // 27. Roman Kingdom Border Gate Guard (North Post at x = 84.9, z = 1.45)
      {
        id: 'c_border_guard_north',
        role: 'standing',
        isArmoredGuard: true,
        guardPalette: 'roman',
        isBorderGuard: true,
        startX: 84.9,
        startZ: 1.45,
        homeRotY: -Math.PI * 0.48,
        scale: 1.44,
        hatStyle: 'helmet',
        hatColor: 0x8f1d24,
        hatAccent: 0xd4a438,
        beardStyle: 'full',
        backStyle: 'cape',
        backColor: 0x7d141d,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe6b68f,
        hairColor: 0x261810,
        topPrimary: 0x8c1d24,
        topSecondary: 0x631920,
        topAccent: 0xd4a438,
        bottomPrimary: 0x59181e,
        sleeveColor: 0x721922,
        shoeColor: 0x2d2420,
        walkSpeed: 1.8,
        waypoints: [[84.9, 1.45]],
      },
      // 28. Roman Kingdom Border Gate Guard (South Post at x = 84.9, z = 5.55)
      {
        id: 'c_border_guard_south',
        role: 'standing',
        isArmoredGuard: true,
        guardPalette: 'roman',
        isBorderGuard: true,
        startX: 84.9,
        startZ: 5.55,
        homeRotY: -Math.PI * 0.52,
        scale: 1.44,
        hatStyle: 'helmet',
        hatColor: 0x8f1d24,
        hatAccent: 0xd4a438,
        beardStyle: 'mustache',
        backStyle: 'cape',
        backColor: 0x7d141d,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xedc09a,
        hairColor: 0x332216,
        topPrimary: 0x8c1d24,
        topSecondary: 0x631920,
        topAccent: 0xd4a438,
        bottomPrimary: 0x59181e,
        sleeveColor: 0x721922,
        shoeColor: 0x2d2420,
        walkSpeed: 1.8,
        waypoints: [[84.9, 5.55]],
      },
      // 29-33. Royal Prison Perimeter Guards Surrounding All Sides of the Prison (at 13.8, -16.8)
      ...(() => {
        const pOriginX = 13.8;
        const pOriginZ = -16.8;
        const pRotY = Math.atan2(-pOriginX, -pOriginZ);
        const cosR = Math.cos(pRotY);
        const sinR = Math.sin(pRotY);
        const posts: { id: string; lx: number; lz: number; lRot: number; beard: CitizenBeardStyle }[] = [
          { id: 'c_prison_guard_front_l', lx: -2.25, lz: 3.55, lRot: 0, beard: 'mustache' },
          { id: 'c_prison_guard_front_r', lx: 2.25, lz: 3.55, lRot: 0, beard: 'goatee' },
          { id: 'c_prison_guard_west', lx: -4.05, lz: -0.2, lRot: -Math.PI / 2, beard: 'full' },
          { id: 'c_prison_guard_east', lx: 4.05, lz: -0.2, lRot: Math.PI / 2, beard: 'mustache' },
          { id: 'c_prison_guard_back', lx: 0.0, lz: -3.65, lRot: Math.PI, beard: 'goatee' },
        ];
        return posts.map(
          (p): CitizenConfig => {
            const wx = pOriginX + p.lx * cosR + p.lz * sinR;
            const wz = pOriginZ - p.lx * sinR + p.lz * cosR;
            return {
              id: p.id,
              role: 'standing',
              isArmoredGuard: true,
              guardPalette: 'prison',
              startX: wx,
              startZ: wz,
              homeRotY: pRotY + p.lRot,
              scale: 1.4,
              hatStyle: 'helmet',
              hatColor: 0x4b5563,
              hatAccent: 0xcba135,
              beardStyle: p.beard,
              backStyle: 'cape',
              backColor: 0x263244,
              showRightProp: false,
              showLeftProp: false,
              skinColor: 0xe6b68f,
              hairColor: 0x281b12,
              topPrimary: 0x3b485b,
              topSecondary: 0x2a3342,
              topAccent: 0xcba135,
              bottomPrimary: 0x2d3645,
              sleeveColor: 0x354052,
              shoeColor: 0x21242b,
              walkSpeed: 1.8,
              waypoints: [[wx, wz]],
            };
          }
        );
      })(),
      // 34-41. Royal Kingdom Cafe ("مقهى المملكة"): Cafe Owner + 5 Seated Patrons + 2 Standing Patrons
      ...(() => {
        const cafeLooks: {
          hatStyle: CitizenHatStyle;
          hatColor: number;
          hatAccent: number;
          beardStyle: CitizenBeardStyle;
          skinColor: number;
          hairColor: number;
          topPrimary: number;
          topSecondary: number;
          topAccent: number;
          bottomPrimary: number;
          sleeveColor: number;
          shoeColor: number;
          scale: number;
        }[] = [
          // Owner: Red fez, crisp cream shirt, crimson vest
          {
            hatStyle: 'fez',
            hatColor: 0xa11b24,
            hatAccent: 0xf4c430,
            beardStyle: 'mustache',
            skinColor: 0xeac096,
            hairColor: 0x2a1d14,
            topPrimary: 0x8f1d24,
            topSecondary: 0xf5efe2,
            topAccent: 0xd9a438,
            bottomPrimary: 0x2c2420,
            sleeveColor: 0xf0e8d8,
            shoeColor: 0x3b2416,
            scale: 1.38,
          },
          // Seated 1: White turban, emerald robe
          {
            hatStyle: 'turban',
            hatColor: 0xf5eedc,
            hatAccent: 0xd4af37,
            beardStyle: 'full',
            skinColor: 0xe3b18a,
            hairColor: 0x2c1e16,
            topPrimary: 0x1e6f4a,
            topSecondary: 0xebe3d1,
            topAccent: 0xcba135,
            bottomPrimary: 0x24342c,
            sleeveColor: 0x165438,
            shoeColor: 0x422a18,
            scale: 1.34,
          },
          // Seated 2: Keffiyeh, royal navy tunic
          {
            hatStyle: 'keffiyeh',
            hatColor: 0xfaf6ec,
            hatAccent: 0x1f1916,
            beardStyle: 'goatee',
            skinColor: 0xf0c29e,
            hairColor: 0x3a281a,
            topPrimary: 0x234c82,
            topSecondary: 0xe9e1cf,
            topAccent: 0xd4a442,
            bottomPrimary: 0x1e293b,
            sleeveColor: 0x1a3a66,
            shoeColor: 0x362419,
            scale: 1.33,
          },
          // Seated 3: Beret, warm ochre coat
          {
            hatStyle: 'beret',
            hatColor: 0x5c2e14,
            hatAccent: 0xd4a644,
            beardStyle: 'mustache',
            skinColor: 0xdfb088,
            hairColor: 0x4a3322,
            topPrimary: 0xb06c24,
            topSecondary: 0xf2e8d5,
            topAccent: 0xe6b84d,
            bottomPrimary: 0x3a2e25,
            sleeveColor: 0x8f561b,
            shoeColor: 0x2e1f14,
            scale: 1.35,
          },
          // Seated 4: Wide hat, burgundy tunic
          {
            hatStyle: 'wideHat',
            hatColor: 0x6b4628,
            hatAccent: 0xd9a438,
            beardStyle: 'full',
            skinColor: 0xedc19c,
            hairColor: 0x241912,
            topPrimary: 0x7c2233,
            topSecondary: 0xede2cf,
            topAccent: 0xd9a438,
            bottomPrimary: 0x2c2024,
            sleeveColor: 0x611926,
            shoeColor: 0x302018,
            scale: 1.34,
          },
          // Seated 5: Keffiyeh, teal tunic
          {
            hatStyle: 'keffiyeh',
            hatColor: 0xece3d0,
            hatAccent: 0x241c18,
            beardStyle: 'none',
            skinColor: 0xf3c9a6,
            hairColor: 0x342316,
            topPrimary: 0x1c6b72,
            topSecondary: 0xf3ead8,
            topAccent: 0xdfb148,
            bottomPrimary: 0x203236,
            sleeveColor: 0x155459,
            shoeColor: 0x3a281c,
            scale: 1.32,
          },
          // Standing 1: Turban, plum robe
          {
            hatStyle: 'turban',
            hatColor: 0xe9dec6,
            hatAccent: 0xc9962c,
            beardStyle: 'goatee',
            skinColor: 0xe7b68f,
            hairColor: 0x2a1c14,
            topPrimary: 0x63326e,
            topSecondary: 0xede3d2,
            topAccent: 0xd9a944,
            bottomPrimary: 0x2e2136,
            sleeveColor: 0x4d2557,
            shoeColor: 0x332117,
            scale: 1.36,
          },
          // Standing 2: Fez, olive-brown vest
          {
            hatStyle: 'fez',
            hatColor: 0x8c1b22,
            hatAccent: 0xe6b83a,
            beardStyle: 'mustache',
            skinColor: 0xefc29d,
            hairColor: 0x3d2a1c,
            topPrimary: 0x5c6830,
            topSecondary: 0xf0e7d4,
            topAccent: 0xd9a438,
            bottomPrimary: 0x2f3324,
            sleeveColor: 0x465024,
            shoeColor: 0x382517,
            scale: 1.35,
          },
        ];

        const slots = getCafeNpcSlots();
        return slots.map((slot, idx): CitizenConfig => {
          const look = cafeLooks[idx % cafeLooks.length];
          const initPos = slot.kind === 'seated' ? slot.seatPos : slot.standPos;
          const initYaw = slot.kind === 'seated' ? slot.seatFacing : slot.standFacing;
          return {
            id: slot.id,
            role: 'standing',
            startX: initPos.x,
            startZ: initPos.z,
            homeRotY: initYaw,
            scale: look.scale,
            hatStyle: look.hatStyle,
            hatColor: look.hatColor,
            hatAccent: look.hatAccent,
            beardStyle: look.beardStyle,
            backStyle: 'none',
            backColor: 0x000000,
            showRightProp: false,
            showLeftProp: false,
            skinColor: look.skinColor,
            hairColor: look.hairColor,
            topPrimary: look.topPrimary,
            topSecondary: look.topSecondary,
            topAccent: look.topAccent,
            bottomPrimary: look.bottomPrimary,
            sleeveColor: look.sleeveColor,
            shoeColor: look.shoeColor,
            walkSpeed: 1.9,
            waypoints: [[initPos.x, initPos.z]],
            isCafeNpc: true,
            cafeKind: slot.kind,
            cafeSeatPos: slot.seatPos.clone(),
            cafeSeatFacing: slot.seatFacing,
            cafeStandPos: slot.standPos.clone(),
            cafeHomeFacing: slot.standFacing,
          };
        });
      })(),
      // 42-47. Playful Kingdom Children (same design, slightly smaller scale, roaming & playing in pairs)
      {
        id: 'c_child_1',
        role: 'child',
        playPartnerId: 'c_child_2',
        startX: -3.2,
        startZ: -17.5,
        scale: 0.96,
        hatStyle: 'beret',
        hatColor: 0x2563eb,
        hatAccent: 0xfacc15,
        beardStyle: 'none',
        backStyle: 'none',
        backColor: 0x000000,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf0c29e,
        hairColor: 0x3b2618,
        topPrimary: 0x38bdf8,
        topSecondary: 0xfef3c7,
        topAccent: 0xf59e0b,
        bottomPrimary: 0x1e3a8a,
        sleeveColor: 0x0284c7,
        shoeColor: 0x451a03,
        walkSpeed: 2.65,
        waypoints: [
          [-3.2, -17.5],
          [3.4, -18.2],
          [3.6, -4.5],
          [-3.8, -3.5],
        ],
      },
      {
        id: 'c_child_2',
        role: 'child',
        playPartnerId: 'c_child_1',
        startX: 3.4,
        startZ: -15.5,
        scale: 0.94,
        hatStyle: 'none',
        hatColor: 0x000000,
        hatAccent: 0x000000,
        beardStyle: 'none',
        backStyle: 'none',
        backColor: 0x000000,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe8b58e,
        hairColor: 0x261810,
        topPrimary: 0xf97316,
        topSecondary: 0xfffbeb,
        topAccent: 0xfacc15,
        bottomPrimary: 0x7c2d12,
        sleeveColor: 0xea580c,
        shoeColor: 0x3b2314,
        walkSpeed: 2.75,
        waypoints: [
          [3.4, -15.5],
          [-3.4, -13.5],
          [3.2, 2.5],
          [-2.8, 3.2],
        ],
      },
      {
        id: 'c_child_3',
        role: 'child',
        playPartnerId: 'c_child_4',
        startX: -15.5,
        startZ: 12.2,
        scale: 0.97,
        hatStyle: 'rainbowCap',
        hatColor: 0x10b981,
        hatAccent: 0xfde047,
        beardStyle: 'none',
        backStyle: 'satchel',
        backColor: 0x854d0e,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xefc39e,
        hairColor: 0x4a311e,
        topPrimary: 0x10b981,
        topSecondary: 0xf8fafc,
        topAccent: 0xfbbf24,
        bottomPrimary: 0x064e3b,
        sleeveColor: 0x059669,
        shoeColor: 0x3f2414,
        walkSpeed: 2.6,
        waypoints: [
          [-15.5, 12.2],
          [-9.5, 11.4],
          [-8.8, 19.6],
          [-16.2, 20.4],
        ],
      },
      {
        id: 'c_child_4',
        role: 'child',
        playPartnerId: 'c_child_3',
        startX: -10.4,
        startZ: 18.0,
        scale: 0.95,
        hatStyle: 'none',
        hatColor: 0x000000,
        hatAccent: 0x000000,
        beardStyle: 'none',
        backStyle: 'none',
        backColor: 0x000000,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xe5b189,
        hairColor: 0x1f140e,
        topPrimary: 0xf43f5e,
        topSecondary: 0xfff1f2,
        topAccent: 0xfde047,
        bottomPrimary: 0x881337,
        sleeveColor: 0xe11d48,
        shoeColor: 0x3b2214,
        walkSpeed: 2.7,
        waypoints: [
          [-10.4, 18.0],
          [-16.0, 14.5],
          [-15.2, 22.0],
          [-9.6, 12.8],
        ],
      },
      {
        id: 'c_child_5',
        role: 'child',
        playPartnerId: 'c_child_6',
        startX: 11.0,
        startZ: 27.5,
        scale: 0.98,
        hatStyle: 'fez',
        hatColor: 0xb91c1c,
        hatAccent: 0xfacc15,
        beardStyle: 'none',
        backStyle: 'none',
        backColor: 0x000000,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xedc09a,
        hairColor: 0x2d1e14,
        topPrimary: 0x6366f1,
        topSecondary: 0xfaf5ff,
        topAccent: 0xf59e0b,
        bottomPrimary: 0x312e81,
        sleeveColor: 0x4f46e5,
        shoeColor: 0x362113,
        walkSpeed: 2.65,
        waypoints: [
          [11.0, 27.5],
          [18.2, 28.5],
          [18.0, 35.5],
          [10.2, 34.5],
        ],
      },
      {
        id: 'c_child_6',
        role: 'child',
        playPartnerId: 'c_child_5',
        startX: 17.5,
        startZ: 33.8,
        scale: 0.94,
        hatStyle: 'none',
        hatColor: 0x000000,
        hatAccent: 0x000000,
        beardStyle: 'none',
        backStyle: 'none',
        backColor: 0x000000,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf2c6a1,
        hairColor: 0x543620,
        topPrimary: 0xeab308,
        topSecondary: 0xfefce8,
        topAccent: 0xd97706,
        bottomPrimary: 0x713f12,
        sleeveColor: 0xca8a04,
        shoeColor: 0x3a2414,
        walkSpeed: 2.75,
        waypoints: [
          [17.5, 33.8],
          [10.8, 30.2],
          [12.4, 36.2],
          [18.2, 27.6],
        ],
      },
      // 48-73. Armored Palace Guards (16 Ground Floor + 10 Second Floor & Kingdom Overlook Balcony)
      ...([
        // Ground Floor
        { id: 'c_palace_guard_l', x: -4.2, y: 0.04, z: -27.4, rotY: 0, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_r', x: 4.2, y: 0.04, z: -27.4, rotY: 0, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_front_w', x: -20.5, y: 0.04, z: -29.0, rotY: 0, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_front_e', x: 20.5, y: 0.04, z: -29.0, rotY: 0, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_foyer_l', x: -4.6, y: 0.04, z: -34.2, rotY: Math.PI * 0.5, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_foyer_r', x: 4.6, y: 0.04, z: -34.2, rotY: -Math.PI * 0.5, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_hall_w', x: -5.4, y: 0.04, z: -42.5, rotY: Math.PI * 0.5, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_hall_e', x: 5.4, y: 0.04, z: -42.5, rotY: -Math.PI * 0.5, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_throne_l', x: -5.4, y: 0.04, z: -50.6, rotY: 0, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_throne_r', x: 5.4, y: 0.04, z: -50.6, rotY: 0, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_corridor_w1', x: -7.5, y: 0.04, z: -45.5, rotY: Math.PI * 0.5, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_corridor_w2', x: -11.4, y: 0.04, z: -54.5, rotY: Math.PI * 0.5, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_corridor_e1', x: 7.5, y: 0.04, z: -45.5, rotY: -Math.PI * 0.5, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_corridor_e2', x: 11.4, y: 0.04, z: -54.5, rotY: -Math.PI * 0.5, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_ext_w', x: -28.2, y: 0.04, z: -49.2, rotY: -Math.PI * 0.5, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_ext_e', x: 28.2, y: 0.04, z: -49.2, rotY: Math.PI * 0.5, beard: 'goatee' as CitizenBeardStyle },
        // Second Floor & Overlook Balcony (y = 4.50)
        { id: 'c_palace_guard_up_balc_c1', x: -3.6, y: 4.5, z: -27.8, rotY: 0, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_balc_c2', x: 3.6, y: 4.5, z: -27.8, rotY: 0, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_balc_w', x: -14.8, y: 4.5, z: -28.0, rotY: 0, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_balc_e', x: 14.8, y: 4.5, z: -28.0, rotY: 0, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_stair_w', x: -6.8, y: 4.5, z: -37.2, rotY: Math.PI * 0.5, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_stair_e', x: 6.8, y: 4.5, z: -37.2, rotY: -Math.PI * 0.5, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_hall_w', x: -6.8, y: 4.5, z: -50.2, rotY: Math.PI * 0.5, beard: 'full' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_hall_e', x: 6.8, y: 4.5, z: -50.2, rotY: -Math.PI * 0.5, beard: 'mustache' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_diwan_l', x: -3.2, y: 4.5, z: -54.5, rotY: 0, beard: 'goatee' as CitizenBeardStyle },
        { id: 'c_palace_guard_up_diwan_r', x: 3.2, y: 4.5, z: -54.5, rotY: 0, beard: 'full' as CitizenBeardStyle },
      ] as {
        id: string;
        x: number;
        y: number;
        z: number;
        rotY: number;
        beard: CitizenBeardStyle;
      }[]).map((gp) => ({
        id: gp.id,
        role: 'standing' as CitizenRole,
        isArmoredGuard: true,
        guardPalette: 'palace' as const,
        startX: gp.x,
        startY: gp.y,
        startZ: gp.z,
        homeRotY: gp.rotY,
        scale: 1.44,
        hatStyle: 'helmet' as CitizenHatStyle,
        hatColor: 0x64748b,
        hatAccent: 0xfbbf24,
        beardStyle: gp.beard,
        backStyle: 'cape' as CitizenBackStyle,
        backColor: 0x7f1d1d,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xeac096,
        hairColor: 0x261810,
        topPrimary: 0x991b1b,
        topSecondary: 0x475569,
        topAccent: 0xfbbf24,
        bottomPrimary: 0x334155,
        sleeveColor: 0x64748b,
        shoeColor: 0x292524,
        walkSpeed: 1.8,
        waypoints: [[gp.x, gp.z] as [number, number]],
      })),
      // 66. The Sultana ("السلطانة") — ONLY royal woman: roams inside the Palace halls by day, strolls outdoors at evening, sleeps in canopy bed at night; everyone who sees her bows
      {
        id: 'c_royal_sultana',
        role: 'walker',
        isFemale: true,
        isRoyalFamily: true,
        isRoyalSultana: true,
        neverBowsToSultan: true,
        startX: -6.0,
        startZ: -61.5,
        homeRotY: 0,
        scale: 1.35,
        hatStyle: 'sultanaCrown',
        hatColor: 0xffd633,
        hatAccent: 0xbe123c,
        beardStyle: 'none',
        backStyle: 'cape',
        backColor: 0x7c1438,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf5cdb2,
        hairColor: 0x24130c,
        topPrimary: 0x831843,
        topSecondary: 0xfdf2f8,
        topAccent: 0xfbbf24,
        bottomPrimary: 0x6b1035,
        sleeveColor: 0x9d174d,
        shoeColor: 0x3f1422,
        walkSpeed: 2.05,
        waypoints: [
          [0.0, -24.5],
          [0.0, -14.5],
          [-6.8, -5.0],
          [0.0, 4.5],
          [7.0, -5.0],
          [0.0, -16.5],
        ],
      },
      // 67. The Grand Vizier ("الوزير") — wakes from bed each morning, walks to dais, bows ONCE before Throne, sits beside it, and returns to bed to sleep when dismissed (60s) or at night
      {
        id: 'c_royal_vizier',
        role: 'standing',
        isRoyalFamily: true,
        isRoyalVizier: true,
        startX: 21.2,
        startZ: -40.3,
        homeRotY: 0,
        scale: 1.4,
        hatStyle: 'turban',
        hatColor: 0xfaf6ec,
        hatAccent: 0x10b981,
        beardStyle: 'full',
        backStyle: 'cape',
        backColor: 0x064e3b,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xeac096,
        hairColor: 0xa1a1aa,
        topPrimary: 0x065f46,
        topSecondary: 0xfef3c7,
        topAccent: 0xfbbf24,
        bottomPrimary: 0x043d2e,
        sleeveColor: 0x047857,
        shoeColor: 0x291a10,
        walkSpeed: 1.85,
        waypoints: [[21.2, -40.3]],
      },
      // 68. The Little Crown Prince ("وريث العرش (الأمير الصغير)") — accompanies & roams alongside his mother the Sultana
      {
        id: 'c_crown_prince',
        role: 'child',
        isRoyalFamily: true,
        isCrownPrince: true,
        startX: -4.85,
        startZ: -61.05,
        scale: 0.9,
        hatStyle: 'princeCrown',
        hatColor: 0xffd633,
        hatAccent: 0xdc2626,
        beardStyle: 'none',
        backStyle: 'cape',
        backColor: 0xb91c1c,
        showRightProp: false,
        showLeftProp: false,
        skinColor: 0xf4cbb0,
        hairColor: 0x2d1b10,
        topPrimary: 0x1d4ed8,
        topSecondary: 0xfef3c7,
        topAccent: 0xfbbf24,
        bottomPrimary: 0x1e3a8a,
        sleeveColor: 0x2563eb,
        shoeColor: 0x3b2214,
        walkSpeed: 1.55,
        waypoints: [
          [-3.0, -63.4],
          [-4.2, -59.2],
          [0.0, -58.3],
          [3.8, -59.8],
          [3.4, -62.4],
          [-3.2, -62.2],
        ],
      },
    ];
  }

  private loadAndSpawnCitizens() {
    const loader = new GLTFLoader(this.loadingManager);
    const configs = this.getCitizenConfigs();
    const citizenConfigs = configs.filter((cfg) => !cfg.isArmoredGuard);
    const guardConfigs = configs.filter((cfg) => cfg.isArmoredGuard);

    let pendingModels = 2;
    const markModelDone = () => {
      pendingModels -= 1;
      if (pendingModels <= 0 && this.onModelsLoaded) {
        this.onModelsLoaded();
      }
    };

    // 1. Load regular kingdom citizens from cozy-character
    loader.load(
      './grab3d-cozy-character.glb',
      (gltf) => {
        const template = gltf.scene;
        const walkClip = gltf.animations.find((c) => c.name.toLowerCase() === 'walk') || null;
        const idleClip = gltf.animations.find((c) => c.name.toLowerCase() === 'idle') || null;
        const waveClip = gltf.animations.find((c) => c.name.toLowerCase() === 'wave') || null;

        citizenConfigs.forEach((cfg, idx) => {
          const entity = this.createCitizenFromTemplate(
            template,
            cfg,
            walkClip,
            idleClip,
            waveClip,
            idx
          );
          this.citizens.push(entity);
          this.group.add(entity.group);
        });
        markModelDone();
      },
      undefined,
      (err) => {
        console.error('Failed to load citizen character model:', err);
        markModelDone();
      }
    );

    // 2. Load guards directly from grab3d-cozy-knight.glb completely untouched (armor, shield, sword, colors unchanged)
    loader.load(
      './grab3d-cozy-knight.glb',
      (gltf) => {
        const knightTemplate = gltf.scene;
        const walkClip = gltf.animations.find((c) => c.name.toLowerCase() === 'walk') || null;
        const idleClip = gltf.animations.find((c) => c.name.toLowerCase() === 'idle') || null;
        const waveClip = gltf.animations.find((c) => c.name.toLowerCase() === 'wave') || null;
        this.knightTemplateCache = { template: knightTemplate, walkClip, idleClip, waveClip };

        guardConfigs.forEach((cfg, idx) => {
          const entity = this.createUntouchedKnightGuard(
            knightTemplate,
            cfg,
            walkClip,
            idleClip,
            waveClip,
            idx
          );
          this.citizens.push(entity);
          this.group.add(entity.group);
        });
        markModelDone();
      },
      undefined,
      (err) => {
        console.error('Failed to load knight guard model:', err);
        markModelDone();
      }
    );
  }

  public getKnightTemplateData() {
    return this.knightTemplateCache;
  }

  private createUntouchedKnightGuard(
    template: THREE.Object3D,
    cfg: CitizenConfig,
    walkClip: THREE.AnimationClip | null,
    idleClip: THREE.AnimationClip | null,
    waveClip: THREE.AnimationClip | null,
    idx: number
  ): CitizenEntity {
    const startY = cfg.startY ?? 0;
    const rootGroup = new THREE.Group();
    rootGroup.position.set(cfg.startX, startY, cfg.startZ);

    const modelGroup = new THREE.Group();
    rootGroup.add(modelGroup);

    const shadowMat = this.track(
      new THREE.MeshBasicMaterial({
        map: this.sharedShadowTex,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    const shadowMesh = new THREE.Mesh(this.sharedShadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    rootGroup.add(shadowMesh);

    // Keep the exact grab3d-cozy-knight.glb design, armor, shield, sword, helmet, and cape untouched;
    // only replace anime facial overlays with masculine features and turn pink / cold-blue slots gray.
    const animeFaceMats = new Set(['eyes', 'fix_white', 'fix_mouth', 'fix_blush', 'fix_dark']);
    const grayRecolorMap: Record<string, number> =
      cfg.guardPalette === 'roman'
        ? {
            top_primary: 0x8f1d24, // Roman imperial crimson
            body_secondary: 0x59181e, // Dark crimson armor trim
            handl_primary: 0x9b222a, // Roman shield crimson
            hat_accent: 0xc9962c, // Bronze-gold helmet crest
            back_primary: 0x7a141c, // Crimson cape
          }
        : cfg.guardPalette === 'prison'
        ? {
            top_primary: 0x3f4c61, // Prison warden dark steel-slate
            body_secondary: 0x2a3342, // Deep iron trim
            handl_primary: 0x455369, // Prison guard shield
            hat_accent: 0xb89336, // Brass-gold crest
            back_primary: 0x2b3648, // Dark navy-iron cape
          }
        : cfg.guardPalette === 'palace'
        ? {
            top_primary: 0x991b1b, // Royal palace crimson tunic
            body_secondary: 0x475569, // Polished steel trim
            handl_primary: 0xb91c1c, // Crimson royal shield
            hat_accent: 0xfbbf24, // Gleaming gold helmet crest
            back_primary: 0x7f1d1d, // Deep crimson royal cape
          }
        : {
            top_primary: 0x757c87, // cold blue -> gray
            body_secondary: 0x6b727d, // cold blue -> gray
            handl_primary: 0x757c87, // cold blue shield -> gray
            hat_accent: 0x646b75, // pink plume -> gray
            back_primary: 0x5e6570, // pink cape -> gray
          };

    const clonedModel = SkeletonUtils.clone(template);
    clonedModel.scale.setScalar(cfg.scale);
    let skinMat: THREE.MeshStandardMaterial | null = null;

    clonedModel.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;

        const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const firstMatName = (matList[0]?.name || '').toLowerCase();
        if (matList.length === 1 && animeFaceMats.has(firstMatName)) {
          mesh.visible = false;
          return;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const cloneKnightMat = (orig: THREE.Material): THREE.Material => {
          const mat = orig.clone() as THREE.MeshStandardMaterial;
          this.track(mat);
          const mName = (mat.name || '').toLowerCase();
          if (mName === 'skin' && !skinMat) {
            skinMat = mat;
          } else if (mName in grayRecolorMap) {
            mat.color.setHex(grayRecolorMap[mName]);
          }
          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneKnightMat);
        } else if (mesh.material) {
          mesh.material = cloneKnightMat(mesh.material);
        }
      }
    });

    const headBone = clonedModel.getObjectByName('head');
    if (headBone) {
      const face = this.buildCitizenFace(skinMat, cfg.hairColor, cfg.beardStyle);
      headBone.add(face);
    }

    modelGroup.add(clonedModel);

    const getBone = (sanitized: string, raw: string) =>
      clonedModel.getObjectByName(sanitized) || clonedModel.getObjectByName(raw) || null;

    const spineBone = getBone('spine', 'spine');
    const chestBone = getBone('chest', 'chest');
    const headBoneRef = getBone('head', 'head');
    const upperLegL = getBone('upperLegL', 'upperLeg.L');
    const lowerLegL = getBone('lowerLegL', 'lowerLeg.L');
    const upperLegR = getBone('upperLegR', 'upperLeg.R');
    const lowerLegR = getBone('lowerLegR', 'lowerLeg.R');
    const upperArmL = getBone('upperArmL', 'upperArm.L');
    const lowerArmL = getBone('lowerArmL', 'lowerArm.L');
    const upperArmR = getBone('upperArmR', 'upperArm.R');
    const lowerArmR = getBone('lowerArmR', 'lowerArm.R');

    const handAnchorR = new THREE.Object3D();
    handAnchorR.position.set(0, 0.14, 0);
    if (lowerArmR) {
      lowerArmR.add(handAnchorR);
    } else {
      clonedModel.add(handAnchorR);
    }

    const shoulderL = getBone('shoulderL', 'shoulder.L');
    const shoulderR = getBone('shoulderR', 'shoulder.R');
    clonedModel.updateMatrixWorld(true);
    const actionQuats = this.computeActionArmQuats(shoulderL, shoulderR);
    const upHint = new THREE.Vector3(0, 1, 0);
    const rideUpperArmQuatL = new THREE.Quaternion();
    const rideLowerArmQuatL = new THREE.Quaternion();
    const rideUpperArmQuatR = new THREE.Quaternion();
    const rideLowerArmQuatR = new THREE.Quaternion();
    if (shoulderL) {
      const shWorldQL = shoulderL.getWorldQuaternion(new THREE.Quaternion());
      const armWorldQL = this.quatFromYZ(new THREE.Vector3(0.28, -0.62, 0.73), upHint);
      const foreWorldQL = this.quatFromYZ(new THREE.Vector3(-0.22, -0.25, 0.94), upHint);
      rideUpperArmQuatL.copy(shWorldQL.clone().invert().multiply(armWorldQL));
      rideLowerArmQuatL.copy(armWorldQL.clone().invert().multiply(foreWorldQL));
    }
    if (shoulderR) {
      const shWorldQR = shoulderR.getWorldQuaternion(new THREE.Quaternion());
      const armWorldQR = this.quatFromYZ(new THREE.Vector3(-0.28, -0.62, 0.73), upHint);
      const foreWorldQR = this.quatFromYZ(new THREE.Vector3(0.22, -0.25, 0.94), upHint);
      rideUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(armWorldQR));
      rideLowerArmQuatR.copy(armWorldQR.clone().invert().multiply(foreWorldQR));
    }

    const mixer = new THREE.AnimationMixer(clonedModel);
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const waveAction = waveClip ? mixer.clipAction(waveClip) : null;

    if (waveAction) {
      waveAction.loop = THREE.LoopOnce;
      waveAction.clampWhenFinished = true;
    }

    if (idleAction) idleAction.play();

    const initYaw = cfg.homeRotY !== undefined ? cfg.homeRotY : 0;
    modelGroup.rotation.y = initYaw;

    return {
      id: cfg.id,
      displayNameAr:
        CITIZEN_LABELS_AR[cfg.id] ||
        (cfg.guardPalette === 'palace' ? 'حارس القصر الملكي' : 'حارس المملكة'),
      money: 0,
      role: cfg.role,
      originalRole: cfg.role,
      isArmoredGuard: Boolean(cfg.isArmoredGuard),
      isBorderGuard: Boolean(cfg.isBorderGuard),
      isDead: false,
      isImprisoned: false,
      prisonSlotIndex: 0,
      prisonReleaseGameMinute: 0,
      prisonSentenceMinutes: 0,
      scale: cfg.scale,
      guardSide: cfg.guardSide ?? 0,
      bowTimer: 0,
      proximityBowBlend: 0,
      isDismountedForSultan: false,
      wasFarFromSultan: true,
      homeX: cfg.startX,
      homeY: startY,
      homeZ: cfg.startZ,
      homeRotY: initYaw,
      playPartnerId: cfg.playPartnerId,
      playMode: 'roam',
      playStateTimer: 3.5 + (idx % 4) * 1.1,
      sightBowCooldown: 0,
      isRoyalFamily: Boolean(cfg.isRoyalFamily),
      isRoyalSultana: Boolean(cfg.isRoyalSultana),
      isRoyalVizier: Boolean(cfg.isRoyalVizier),
      isRoyalQueen: Boolean(cfg.isRoyalQueen),
      isCrownPrince: Boolean(cfg.isCrownPrince),
      neverBowsToSultan: Boolean(cfg.neverBowsToSultan),
      queenPhase: 'sleeping',
      queenPhaseTimer: 0,
      queenRouteIdx: 0,
      vizierPhase: 'sleeping',
      vizierPhaseTimer: 0,
      vizierRouteIdx: 0,
      vizierLastMorningDay: -1,
      vizierDismissedBySultan: false,
      royalBowTimer: 0,
      swordSwingTimer: 0,
      isCafeNpc: false,
      cafeSeatPos: new THREE.Vector3(cfg.startX, startY, cfg.startZ),
      cafeSeatFacing: initYaw,
      cafeStandPos: new THREE.Vector3(cfg.startX, startY, cfg.startZ),
      cafeHomeFacing: initYaw,
      cafeStandUpBlend: 1,
      group: rootGroup,
      modelGroup,
      shadowMesh,
      handAnchorR,
      pos: new THREE.Vector3(cfg.startX, startY, cfg.startZ),
      facingAngle: initYaw,
      mixer,
      walkAction,
      idleAction,
      waveAction,
      currentAnim: 'idle',
      walkSpeed: cfg.walkSpeed,
      waypoints: cfg.waypoints,
      waypointIdx: 1 % cfg.waypoints.length,
      pauseTimer: 0,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(cfg.startX, 0, cfg.startZ),
      isRainbow: false,
      rainbowPhase: 0,
      rainbowMats: [],
      horse: null,
      ropeVisual: null,
      rideBobTime: idx * 0.7,
      spineBone,
      chestBone,
      headBone: headBoneRef,
      upperLegL,
      lowerLegL,
      upperLegR,
      lowerLegR,
      upperArmL,
      lowerArmL,
      upperArmR,
      lowerArmR,
      rideUpperArmQuatL,
      rideLowerArmQuatL,
      rideUpperArmQuatR,
      rideLowerArmQuatR,
      leadUpperArmQuatR: new THREE.Quaternion(),
      leadLowerArmQuatR: new THREE.Quaternion(),
      actionQuats,
      accumDelta: 0,
    };
  }

  private createCitizenFromTemplate(
    template: THREE.Object3D,
    cfg: CitizenConfig,
    walkClip: THREE.AnimationClip | null,
    idleClip: THREE.AnimationClip | null,
    waveClip: THREE.AnimationClip | null,
    idx: number
  ): CitizenEntity {
    const isCafeSeated = Boolean(cfg.isCafeNpc && cfg.cafeKind === 'seated');
    const isQueenSleepStart = false;
    const isVizierSleepStart = Boolean(cfg.isRoyalVizier);
    const startY =
      isCafeSeated && cfg.cafeSeatPos
        ? cfg.cafeSeatPos.y
        : isVizierSleepStart
        ? 0.72
        : cfg.isRoyalSultana || cfg.isCrownPrince
        ? 0.04
        : 0;
    const rootGroup = new THREE.Group();
    rootGroup.position.set(cfg.startX, startY, cfg.startZ);

    const modelGroup = new THREE.Group();
    rootGroup.add(modelGroup);

    // Contact shadow
    const shadowMat = this.track(
      new THREE.MeshBasicMaterial({
        map: this.sharedShadowTex,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    const shadowMesh = new THREE.Mesh(this.sharedShadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    if (cfg.role === 'child') {
      shadowMesh.scale.setScalar(cfg.scale / 1.35);
    }
    if (isCafeSeated || isQueenSleepStart || isVizierSleepStart) {
      shadowMesh.visible = false;
    }
    rootGroup.add(shadowMesh);

    let titleSprite: THREE.Sprite | null = null;
    if (cfg.isRoyalSultana) {
      titleSprite = this.createRoyalTitleSprite(
        'السلطانة',
        'rgba(91, 18, 40, 0.90)',
        '#f59e0b',
        '#fde68a'
      );
      if (titleSprite) {
        titleSprite.scale.set(1.55, 0.44, 1);
        titleSprite.position.set(0, cfg.scale * 1.94, 0);
        rootGroup.add(titleSprite);
      }
    } else if (cfg.isCrownPrince) {
      titleSprite = this.createRoyalTitleSprite(
        'الأمير',
        'rgba(23, 37, 84, 0.90)',
        '#f59e0b',
        '#fef08a'
      );
      if (titleSprite) {
        titleSprite.scale.set(1.25, 0.36, 1);
        titleSprite.position.set(0, cfg.scale * 2.02, 0);
        rootGroup.add(titleSprite);
      }
    }

    const clonedModel = SkeletonUtils.clone(template);
    clonedModel.scale.setScalar(cfg.scale);

    // Hide anime facial overlays (3..7) and original hat/crown (8..10)
    const hiddenMeshes = new Set([
      'character_3',
      'character_4',
      'character_5',
      'character_6',
      'character_7',
      'character_8',
      'character_9',
      'character_10',
    ]);

    // Optionally hide handheld lantern (20..23) or left-hand weapon/item (24..27)
    if (!cfg.showRightProp) {
      hiddenMeshes.add('character_20');
      hiddenMeshes.add('character_21');
      hiddenMeshes.add('character_22');
      hiddenMeshes.add('character_23');
    }
    if (!cfg.showLeftProp) {
      hiddenMeshes.add('character_24');
      hiddenMeshes.add('character_25');
      hiddenMeshes.add('character_26');
      hiddenMeshes.add('character_27');
    }

    let skinMat: THREE.MeshStandardMaterial | null = null;
    const rainbowMats: {
      mat: THREE.MeshStandardMaterial;
      hueOffset: number;
      sat: number;
      light: number;
    }[] = [];

    clonedModel.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (hiddenMeshes.has(mesh.name)) {
          mesh.visible = false;
          return;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const cloneAndStyle = (orig: THREE.Material): THREE.Material => {
          const mat = orig.clone() as THREE.MeshStandardMaterial;
          this.track(mat);
          const mName = (mat.name || '').toLowerCase();

          if (mName === 'skin') {
            mat.color.setHex(cfg.skinColor);
            skinMat = mat;
          } else if (mName === 'hair') {
            mat.color.setHex(cfg.hairColor);
          } else if (mName === 'top_primary') {
            mat.color.setHex(cfg.topPrimary);
            if (cfg.isArmoredGuard) {
              mat.metalness = 0.34;
              mat.roughness = 0.45;
            }
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.0, sat: 0.9, light: 0.52 });
          } else if (mName === 'top_secondary') {
            mat.color.setHex(cfg.topSecondary);
            if (cfg.isArmoredGuard) {
              mat.metalness = 0.34;
              mat.roughness = 0.45;
            }
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.22, sat: 0.92, light: 0.56 });
          } else if (mName === 'top_accent') {
            mat.color.setHex(cfg.topAccent);
            if (cfg.isArmoredGuard) {
              mat.metalness = 0.4;
              mat.roughness = 0.4;
            }
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.45, sat: 0.95, light: 0.54 });
          } else if (mName === 'bottom_primary') {
            mat.color.setHex(cfg.bottomPrimary);
            if (cfg.isArmoredGuard) {
              mat.metalness = 0.3;
              mat.roughness = 0.48;
            }
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.65, sat: 0.88, light: 0.48 });
          } else if (mName === 'bottom_secondary') {
            mat.color.setHex(cfg.topAccent);
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.12, sat: 0.92, light: 0.55 });
          } else if (mName === 'body_secondary' || mName === 'handl_primary') {
            mat.color.setHex(cfg.sleeveColor);
            if (cfg.isArmoredGuard) {
              mat.metalness = 0.32;
              mat.roughness = 0.48;
            }
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.8, sat: 0.88, light: 0.52 });
          } else if (mName === 'shoes_primary' || mName === 'shoes_secondary') {
            mat.color.setHex(cfg.shoeColor);
            if (cfg.isRainbow) rainbowMats.push({ mat, hueOffset: 0.33, sat: 0.85, light: 0.48 });
          }

          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneAndStyle);
        } else if (mesh.material) {
          mesh.material = cloneAndStyle(mesh.material);
        }
      }
    });

    // Attach clean masculine/feminine facial features + custom hat & beard to head bone
    const headBone = clonedModel.getObjectByName('head');
    if (headBone) {
      const face = this.buildCitizenFace(skinMat, cfg.hairColor, cfg.beardStyle, cfg.isFemale);
      headBone.add(face);

      if (cfg.hatStyle !== 'none') {
        const hat = this.buildCitizenHat(cfg, rainbowMats);
        headBone.add(hat);
      }
    }

    // Attach unique back/waist gear (cape, backpack, satchel), feminine royal gown skirt & Vizier decree staff
    if (cfg.backStyle === 'cape' || cfg.backStyle === 'backpack') {
      const chestBone = clonedModel.getObjectByName('chest');
      if (chestBone) {
        const gear = this.buildBackGear(cfg.backStyle, cfg.backColor, cfg.isRainbow, rainbowMats);
        chestBone.add(gear);
      }
    } else if (cfg.backStyle === 'satchel') {
      const hipsBone = clonedModel.getObjectByName('hips');
      if (hipsBone) {
        const satchel = this.buildBackGear('satchel', cfg.backColor, false, rainbowMats);
        hipsBone.add(satchel);
      }
    }

    if (cfg.isFemale) {
      const hipsBone = clonedModel.getObjectByName('hips');
      if (hipsBone) {
        const gown = this.buildFemaleRoyalGown(cfg.topPrimary, cfg.topAccent);
        hipsBone.add(gown);
      }
    }

    if (cfg.isRoyalVizier) {
      const handAnchorV = clonedModel.getObjectByName('handL') || clonedModel.getObjectByName('lowerArmL') || clonedModel.getObjectByName('lowerArm.L');
      if (handAnchorV) {
        const vizierStaff = this.buildVizierScepter();
        handAnchorV.add(vizierStaff);
      }
    }

    modelGroup.add(clonedModel);

    // Cache skeletal bones for horse riding & lead-rope arm grip
    const getBone = (sanitized: string, raw: string) =>
      clonedModel.getObjectByName(sanitized) || clonedModel.getObjectByName(raw) || null;

    const spineBone = getBone('spine', 'spine');
    const chestBone = getBone('chest', 'chest');
    const headBoneRef = getBone('head', 'head');
    const upperLegL = getBone('upperLegL', 'upperLeg.L');
    const lowerLegL = getBone('lowerLegL', 'lowerLeg.L');
    const upperLegR = getBone('upperLegR', 'upperLeg.R');
    const lowerLegR = getBone('lowerLegR', 'lowerLeg.R');
    const upperArmL = getBone('upperArmL', 'upperArm.L');
    const lowerArmL = getBone('lowerArmL', 'lowerArm.L');
    const upperArmR = getBone('upperArmR', 'upperArm.R');
    const lowerArmR = getBone('lowerArmR', 'lowerArm.R');

    const rideUpperArmQuatL = new THREE.Quaternion();
    const rideLowerArmQuatL = new THREE.Quaternion();
    const rideUpperArmQuatR = new THREE.Quaternion();
    const rideLowerArmQuatR = new THREE.Quaternion();
    const leadUpperArmQuatR = new THREE.Quaternion();
    const leadLowerArmQuatR = new THREE.Quaternion();

    const upHint = new THREE.Vector3(0, 1, 0);
    const shoulderL = getBone('shoulderL', 'shoulder.L');
    const shoulderR = getBone('shoulderR', 'shoulder.R');
    clonedModel.updateMatrixWorld(true);
    const actionQuats = this.computeActionArmQuats(shoulderL, shoulderR);
    if (shoulderL) {
      const shWorldQL = shoulderL.getWorldQuaternion(new THREE.Quaternion());
      const armWorldQL = this.quatFromYZ(new THREE.Vector3(0.28, -0.62, 0.73), upHint);
      const foreWorldQL = this.quatFromYZ(new THREE.Vector3(-0.22, -0.25, 0.94), upHint);
      rideUpperArmQuatL.copy(shWorldQL.clone().invert().multiply(armWorldQL));
      rideLowerArmQuatL.copy(armWorldQL.clone().invert().multiply(foreWorldQL));
    }
    if (shoulderR) {
      const shWorldQR = shoulderR.getWorldQuaternion(new THREE.Quaternion());
      const armWorldQR = this.quatFromYZ(new THREE.Vector3(-0.28, -0.62, 0.73), upHint);
      const foreWorldQR = this.quatFromYZ(new THREE.Vector3(0.22, -0.25, 0.94), upHint);
      rideUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(armWorldQR));
      rideLowerArmQuatR.copy(armWorldQR.clone().invert().multiply(foreWorldQR));

      const leadArmQR = this.quatFromYZ(new THREE.Vector3(-0.32, -0.82, -0.46), upHint);
      const leadForeQR = this.quatFromYZ(new THREE.Vector3(-0.18, -0.52, -0.83), upHint);
      leadUpperArmQuatR.copy(shWorldQR.clone().invert().multiply(leadArmQR));
      leadLowerArmQuatR.copy(leadArmQR.clone().invert().multiply(leadForeQR));
    }

    let handAnchorR: THREE.Object3D | null = null;
    let ropeVisual: LeadRopeVisual | null = null;
    if (cfg.role === 'horse_leader') {
      handAnchorR = new THREE.Object3D();
      handAnchorR.position.set(0, 0.14, 0);
      if (lowerArmR) {
        lowerArmR.add(handAnchorR);
      } else {
        clonedModel.add(handAnchorR);
      }
      ropeVisual = new LeadRopeVisual(10, 0xc9a063);
      ropeVisual.setVisible(true);
      this.group.add(ropeVisual.group);
    }

    if (cfg.role === 'horse_rider') {
      shadowMesh.visible = false;
    }

    // Setup independent AnimationMixer for this citizen
    const mixer = new THREE.AnimationMixer(clonedModel);
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const waveAction = waveClip ? mixer.clipAction(waveClip) : null;

    if (waveAction) {
      waveAction.loop = THREE.LoopOnce;
      waveAction.clampWhenFinished = true;
    }

    const isStationary =
      (cfg.role !== 'walker' && cfg.role !== 'horse_leader' && cfg.role !== 'child') ||
      Boolean(cfg.isRoyalSultana);
    if (isStationary) {
      if (idleAction) idleAction.play();
    } else if (walkAction) {
      walkAction.time = (idx * 0.43) % (walkClip?.duration || 1);
      walkAction.setEffectiveTimeScale(cfg.walkSpeed / 2.2);
      walkAction.play();
    }

    const firstWp = cfg.waypoints[1] || cfg.waypoints[0];
    const initYaw =
      cfg.homeRotY !== undefined
        ? cfg.homeRotY
        : Math.atan2(firstWp[0] - cfg.startX, firstWp[1] - cfg.startZ);
    if (cfg.isRoyalVizier) {
      modelGroup.rotation.set(-Math.PI / 2, 0, 0);
      shadowMesh.visible = false;
    } else {
      modelGroup.rotation.y = initYaw;
    }

    const isChild = cfg.role === 'child';
    const isExemptMoney =
      cfg.isArmoredGuard ||
      cfg.isBorderGuard ||
      cfg.role === 'bodyguard' ||
      isChild ||
      Boolean(cfg.isRoyalFamily);
    const savedAmount = this.pendingMoneyMap[cfg.id];
    const initialMoney = isExemptMoney
      ? 0
      : typeof savedAmount === 'number' && Number.isFinite(savedAmount)
      ? Math.max(0, Math.floor(savedAmount))
      : 400 + Math.floor(Math.random() * 41) * 50;
    if (!isExemptMoney) {
      this.pendingMoneyMap[cfg.id] = initialMoney;
    }

    return {
      id: cfg.id,
      displayNameAr: CITIZEN_LABELS_AR[cfg.id] || 'أحد الرعية',
      money: initialMoney,
      role: cfg.role,
      originalRole: cfg.role,
      isArmoredGuard: Boolean(cfg.isArmoredGuard),
      isBorderGuard: Boolean(cfg.isBorderGuard),
      isDead: false,
      isImprisoned: false,
      prisonSlotIndex: 0,
      prisonReleaseGameMinute: 0,
      prisonSentenceMinutes: 0,
      titleSprite,
      scale: cfg.scale,
      guardSide: cfg.guardSide ?? 0,
      bowTimer: 0,
      proximityBowBlend: 0,
      isDismountedForSultan: false,
      wasFarFromSultan: true,
      homeX: cfg.startX,
      homeY: cfg.startY ?? 0,
      homeZ: cfg.startZ,
      homeRotY: initYaw,
      playPartnerId: cfg.playPartnerId,
      playMode: cfg.isCrownPrince ? 'roam' : idx % 2 === 0 ? 'chase' : 'roam',
      playStateTimer: 3.5 + (idx % 4) * 1.1,
      sightBowCooldown: 0,
      isRoyalFamily: Boolean(cfg.isRoyalFamily),
      isRoyalSultana: Boolean(cfg.isRoyalSultana),
      isRoyalVizier: Boolean(cfg.isRoyalVizier),
      isRoyalQueen: Boolean(cfg.isRoyalQueen),
      isCrownPrince: Boolean(cfg.isCrownPrince),
      neverBowsToSultan: Boolean(cfg.neverBowsToSultan),
      queenPhase: cfg.isRoyalSultana ? 'palace_patrol' : 'sleeping',
      queenPhaseTimer: 0,
      queenRouteIdx: 0,
      vizierPhase: 'sleeping',
      vizierPhaseTimer: 0,
      vizierRouteIdx: 0,
      vizierLastMorningDay: -1,
      vizierDismissedBySultan: false,
      royalBowTimer: 0,
      swordSwingTimer: 0,
      isCafeNpc: Boolean(cfg.isCafeNpc),
      cafeKind: cfg.cafeKind,
      cafeSeatPos: cfg.cafeSeatPos ? cfg.cafeSeatPos.clone() : new THREE.Vector3(cfg.startX, 0, cfg.startZ),
      cafeSeatFacing: cfg.cafeSeatFacing ?? initYaw,
      cafeStandPos: cfg.cafeStandPos ? cfg.cafeStandPos.clone() : new THREE.Vector3(cfg.startX, 0, cfg.startZ),
      cafeHomeFacing: cfg.cafeHomeFacing ?? initYaw,
      cafeStandUpBlend: cfg.cafeKind === 'seated' ? 0 : 1,
      group: rootGroup,
      modelGroup,
      shadowMesh,
      handAnchorR,
      pos: new THREE.Vector3(
        cfg.startX,
        cfg.cafeKind === 'seated' && cfg.cafeSeatPos
          ? cfg.cafeSeatPos.y
          : cfg.isRoyalVizier
          ? 0.72
          : cfg.isRoyalSultana || cfg.isCrownPrince
          ? 0.04
          : 0,
        cfg.startZ
      ),
      facingAngle: initYaw,
      mixer,
      walkAction,
      idleAction,
      waveAction,
      currentAnim: isStationary ? 'idle' : 'walk',
      walkSpeed: cfg.walkSpeed,
      waypoints: cfg.waypoints,
      waypointIdx: 1 % cfg.waypoints.length,
      pauseTimer: 0,
      stuckTimer: 0,
      lastProgressPos: new THREE.Vector3(cfg.startX, 0, cfg.startZ),
      isRainbow: Boolean(cfg.isRainbow),
      rainbowPhase: 0,
      rainbowMats,
      horse: null,
      ropeVisual,
      rideBobTime: idx * 0.7,
      spineBone,
      chestBone,
      headBone: headBoneRef,
      upperLegL,
      lowerLegL,
      upperLegR,
      lowerLegR,
      upperArmL,
      lowerArmL,
      upperArmR,
      lowerArmR,
      rideUpperArmQuatL,
      rideLowerArmQuatL,
      rideUpperArmQuatR,
      rideLowerArmQuatR,
      leadUpperArmQuatR,
      leadLowerArmQuatR,
      actionQuats,
      accumDelta: 0,
    };
  }

  private buildCitizenFace(
    skinMaterial: THREE.MeshStandardMaterial | null,
    hairColor: number,
    beardStyle: CitizenBeardStyle,
    isFemale: boolean = false
  ): THREE.Group {
    const face = new THREE.Group();

    const skinMat =
      skinMaterial ||
      this.track(new THREE.MeshStandardMaterial({ color: 0xefc29e, roughness: 0.72 }));
    const scleraMat = this.track(new THREE.MeshStandardMaterial({ color: 0xfbfaf8, roughness: 0.32 }));
    const irisMat = this.track(new THREE.MeshStandardMaterial({ color: 0x2c2018, roughness: 0.28 }));
    const pupilMat = this.track(new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.2 }));
    const browMat = this.track(new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 }));
    const mouthMat = this.track(
      new THREE.MeshStandardMaterial({ color: isFemale ? 0xc2495b : 0x8f5046, roughness: 0.55 })
    );

    const eyeGeo = this.track(new THREE.SphereGeometry(0.019, 10, 8));
    eyeGeo.scale(1.05, isFemale ? 0.65 : 0.56, 0.42);
    const irisGeo = this.track(new THREE.SphereGeometry(0.0105, 8, 8));
    irisGeo.scale(1, 1, 0.45);
    const pupilGeo = this.track(new THREE.SphereGeometry(0.0055, 6, 6));
    pupilGeo.scale(1, 1, 0.45);
    const browGeo = this.track(
      new THREE.BoxGeometry(0.045, isFemale ? 0.0065 : 0.01, 0.014)
    );

    [-1, 1].forEach((side) => {
      const sock = new THREE.Group();
      sock.position.set(side * 0.068, 0.165, 0.194);
      sock.rotation.y = side * 0.24;

      sock.add(new THREE.Mesh(eyeGeo, scleraMat));
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.z = 0.005;
      sock.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.0075;
      sock.add(pupil);

      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(0, 0.028, 0.004);
      brow.rotation.z = side * (isFemale ? 0.12 : 0.06);
      sock.add(brow);

      face.add(sock);
    });

    // Natural nose
    const nose = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.015, 8, 8)), skinMat);
    nose.position.set(0, 0.128, 0.205);
    nose.scale.set(0.95, 1.12, 1.08);
    face.add(nose);

    // Mouth
    const mouth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(isFemale ? 0.036 : 0.044, isFemale ? 0.009 : 0.0065, 0.01)),
      mouthMat
    );
    mouth.position.set(0, 0.088, 0.182);
    face.add(mouth);

    if (isFemale) {
      const lashMat = this.track(new THREE.MeshStandardMaterial({ color: 0x160e0c, roughness: 0.5 }));
      const hairSideMat = this.track(
        new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.84, metalness: 0.04 })
      );
      const blushMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xee7b8c, roughness: 0.75 })
      );
      [-1, 1].forEach((side) => {
        const lash = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.042, 0.006, 0.014)), lashMat);
        lash.position.set(side * 0.068, 0.179, 0.201);
        lash.rotation.y = side * 0.24;
        lash.rotation.z = side * -0.14;
        face.add(lash);

        const blush = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.02, 8, 6)), blushMat);
        blush.scale.set(1.25, 0.72, 0.35);
        blush.position.set(side * 0.092, 0.118, 0.172);
        face.add(blush);

        // Long feminine braided hair framing left & right cheeks cleanly from the front
        const sideLock = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.036, 0.024, 0.3, 8)),
          hairSideMat
        );
        sideLock.position.set(side * 0.175, 0.07, 0.065);
        sideLock.rotation.z = side * 0.14;
        face.add(sideLock);
      });
    }

    // Optional Facial Hair (Beard / Mustache / Goatee)
    if (!isFemale && (beardStyle === 'mustache' || beardStyle === 'full')) {
      const stacheGeo = this.track(new THREE.BoxGeometry(0.036, 0.012, 0.016));
      [-1, 1].forEach((side) => {
        const stache = new THREE.Mesh(stacheGeo, browMat);
        stache.position.set(side * 0.018, 0.102, 0.194);
        stache.rotation.z = side * -0.18;
        face.add(stache);
      });
    }
    if (!isFemale && beardStyle === 'full') {
      const beard = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.115, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55)),
        browMat
      );
      beard.position.set(0, 0.085, 0.075);
      beard.scale.set(1.12, 0.95, 1.05);
      face.add(beard);
    } else if (!isFemale && beardStyle === 'goatee') {
      const goatee = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.028, 0.055, 7)), browMat);
      goatee.rotation.x = Math.PI;
      goatee.position.set(0, 0.062, 0.175);
      face.add(goatee);
    }

    return face;
  }

  private buildCitizenHat(
    cfg: CitizenConfig,
    rainbowMats: { mat: THREE.MeshStandardMaterial; hueOffset: number; sat: number; light: number }[]
  ): THREE.Group {
    const hat = new THREE.Group();
    const mainMat = this.track(
      new THREE.MeshStandardMaterial({ color: cfg.hatColor, roughness: 0.78, metalness: 0.06 })
    );
    const accentMat = this.track(
      new THREE.MeshStandardMaterial({ color: cfg.hatAccent, roughness: 0.55, metalness: 0.25 })
    );

    if (cfg.hatStyle === 'turban') {
      const wrap = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(0.195, 0.072, 10, 18)),
        mainMat
      );
      wrap.rotation.x = Math.PI / 2;
      wrap.position.set(0, 0.385, -0.01);
      hat.add(wrap);

      const dome = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.19, 12, 10)), mainMat);
      dome.position.set(0, 0.4, -0.01);
      dome.scale.set(1, 0.68, 1);
      hat.add(dome);

      const jewel = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.032, 0)), accentMat);
      jewel.position.set(0, 0.41, 0.235);
      hat.add(jewel);
    } else if (cfg.hatStyle === 'wideHat') {
      const brim = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.34, 0.36, 0.025, 16)),
        mainMat
      );
      brim.position.set(0, 0.385, -0.01);
      hat.add(brim);

      const top = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 14)),
        mainMat
      );
      top.position.set(0, 0.445, -0.01);
      hat.add(top);

      const band = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.194, 0.194, 0.032, 14)),
        accentMat
      );
      band.position.set(0, 0.405, -0.01);
      hat.add(band);
    } else if (cfg.hatStyle === 'hood') {
      const cowl = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.256, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.64)),
        mainMat
      );
      cowl.position.set(0, 0.235, -0.025);
      cowl.rotation.x = -0.22;
      hat.add(cowl);
    } else if (cfg.hatStyle === 'helmet') {
      mainMat.metalness = 0.72;
      mainMat.roughness = 0.35;
      const dome = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.252, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54)),
        mainMat
      );
      dome.position.set(0, 0.245, -0.01);
      hat.add(dome);

      const crest = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.045, 0.08, 0.34)), accentMat);
      crest.position.set(0, 0.505, -0.02);
      hat.add(crest);
    } else if (cfg.hatStyle === 'fez') {
      const cone = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.12, 0.16, 0.17, 14)),
        mainMat
      );
      cone.position.set(0, 0.44, -0.01);
      hat.add(cone);

      const tassel = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.016, 0.024, 0.11, 8)),
        accentMat
      );
      tassel.position.set(0.13, 0.44, 0.04);
      tassel.rotation.z = -0.35;
      hat.add(tassel);
    } else if (cfg.hatStyle === 'beret') {
      const cap = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.225, 14, 10)), mainMat);
      cap.position.set(0.03, 0.41, -0.01);
      cap.scale.set(1.12, 0.4, 1.06);
      cap.rotation.z = -0.18;
      hat.add(cap);
    } else if (cfg.hatStyle === 'keffiyeh') {
      const cloth = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.215, 0.255, 0.24, 14, 1, false, -0.6, Math.PI * 1.4)),
        mainMat
      );
      cloth.position.set(0, 0.28, -0.03);
      cloth.rotation.y = Math.PI - 0.1;
      hat.add(cloth);

      const crown = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.21, 12, 8)), mainMat);
      crown.position.set(0, 0.37, -0.01);
      crown.scale.set(1, 0.58, 1);
      hat.add(crown);

      const agal = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.205, 0.025, 8, 18)), accentMat);
      agal.rotation.x = Math.PI / 2;
      agal.position.set(0, 0.41, -0.01);
      hat.add(agal);
    } else if (cfg.hatStyle === 'rainbowCap') {
      // Multi-color festive jester/royal plume cap for the color-shifting character
      const bandColors = [0xff2e63, 0xffb800, 0x22c55e, 0x06b6d4, 0x8b5cf6];
      const segCount = 5;
      for (let s = 0; s < segCount; s++) {
        const sMat = this.track(
          new THREE.MeshStandardMaterial({ color: bandColors[s], roughness: 0.52 })
        );
        rainbowMats.push({ mat: sMat, hueOffset: s / segCount, sat: 0.94, light: 0.54 });
        const angle = (s / segCount) * Math.PI * 2;
        const cone = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.068, 0.18, 8)), sMat);
        cone.position.set(Math.sin(angle) * 0.115, 0.455, Math.cos(angle) * 0.115);
        cone.rotation.z = -Math.sin(angle) * 0.42;
        cone.rotation.x = Math.cos(angle) * 0.42;
        hat.add(cone);
      }
      const baseRing = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(0.2, 0.038, 8, 18)),
        accentMat
      );
      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.set(0, 0.38, -0.01);
      rainbowMats.push({ mat: accentMat, hueOffset: 0.55, sat: 0.95, light: 0.55 });
      hat.add(baseRing);
    } else if (cfg.hatStyle === 'royalCrown') {
      // Grand Majestic Golden King Crown with Velvet Cap & 8 Jewel-Tipped Spires
      const goldMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: 0.22, metalness: 0.88 })
      );
      const velvetMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x7c1123, roughness: 0.85, metalness: 0.05 })
      );
      const gemMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.15, metalness: 0.35 })
      );

      const band = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.225, 0.21, 0.085, 18)),
        goldMat
      );
      band.position.set(0, 0.39, -0.01);
      hat.add(band);

      const cap = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
        velvetMat
      );
      cap.position.set(0, 0.4, -0.01);
      hat.add(cap);

      for (let p = 0; p < 8; p++) {
        const ang = (p / 8) * Math.PI * 2;
        const px = Math.sin(ang) * 0.205;
        const pz = Math.cos(ang) * 0.205 - 0.01;
        const spike = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.036, 0.145, 6)), goldMat);
        spike.position.set(px, 0.495, pz);
        hat.add(spike);

        const pearl = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.022, 8, 6)), accentMat);
        pearl.position.set(px, 0.575, pz);
        hat.add(pearl);
      }

      const frontGem = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.036, 0)), gemMat);
      frontGem.position.set(0, 0.405, 0.215);
      hat.add(frontGem);
    } else if (cfg.hatStyle === 'sultanaCrown') {
      // Bold, unmistakable gleaming Golden Imperial Sultana Crown + Silk Royal Veil + Long Cascading Hair
      const goldMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xffd633,
          emissive: 0x3b2600,
          emissiveIntensity: 0.28,
          roughness: 0.2,
          metalness: 0.85,
        })
      );
      const velvetMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.82, metalness: 0.06 })
      );
      const rubyMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.14, metalness: 0.3 })
      );
      const veilMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xfff1f2,
          roughness: 0.72,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
      );
      const hairLockMat = this.track(
        new THREE.MeshStandardMaterial({ color: cfg.hairColor, roughness: 0.85, metalness: 0.04 })
      );

      const band = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.23, 0.215, 0.095, 20)),
        goldMat
      );
      band.position.set(0, 0.4, -0.01);
      hat.add(band);

      const velvetCap = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        velvetMat
      );
      velvetCap.position.set(0, 0.415, -0.01);
      hat.add(velvetCap);

      for (let p = 0; p < 8; p++) {
        const ang = (p / 8) * Math.PI * 2;
        const isFront = p === 0;
        const h = isFront ? 0.195 : p === 1 || p === 7 ? 0.155 : 0.125;
        const spike = new THREE.Mesh(
          this.track(new THREE.ConeGeometry(0.038, h, 6)),
          goldMat
        );
        spike.position.set(Math.sin(ang) * 0.21, 0.445 + h * 0.45, Math.cos(ang) * 0.21 - 0.01);
        hat.add(spike);

        const tipGem = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.022, 8, 6)), rubyMat);
        tipGem.position.set(Math.sin(ang) * 0.21, 0.445 + h * 0.92, Math.cos(ang) * 0.21 - 0.01);
        hat.add(tipGem);
      }

      const centerGem = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.046, 0)), rubyMat);
      centerGem.position.set(0, 0.425, 0.232);
      hat.add(centerGem);

      // Long hair + flowing translucent royal silk veil down the back
      const backHair = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.22, 0.26, 0.46, 12, 1, false, -1.0, Math.PI * 1.15)),
        hairLockMat
      );
      backHair.position.set(0, 0.13, -0.05);
      backHair.rotation.y = Math.PI;
      hat.add(backHair);

      const royalVeil = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.225, 0.31, 0.56, 12, 1, true, -0.9, Math.PI * 1.0)),
        veilMat
      );
      royalVeil.position.set(0, 0.11, -0.08);
      royalVeil.rotation.y = Math.PI;
      hat.add(royalVeil);
    } else if (cfg.hatStyle === 'queenTiara') {
      // Feminine Golden Queen Tiara + Flowing Long Hair Locks behind shoulders
      const goldMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xf7c948, roughness: 0.2, metalness: 0.9 })
      );
      const rubyMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.16, metalness: 0.3 })
      );
      const hairLockMat = this.track(
        new THREE.MeshStandardMaterial({ color: cfg.hairColor, roughness: 0.85, metalness: 0.04 })
      );

      const circlet = new THREE.Mesh(
        this.track(new THREE.TorusGeometry(0.205, 0.024, 8, 20)),
        goldMat
      );
      circlet.rotation.x = Math.PI / 2;
      circlet.position.set(0, 0.38, -0.01);
      hat.add(circlet);

      for (let p = -2; p <= 2; p++) {
        const ang = p * 0.36;
        const hScale = p === 0 ? 1.45 : Math.abs(p) === 1 ? 1.05 : 0.78;
        const tip = new THREE.Mesh(
          this.track(new THREE.ConeGeometry(0.026, 0.11 * hScale, 6)),
          goldMat
        );
        tip.position.set(Math.sin(ang) * 0.2, 0.425 + 0.025 * hScale, Math.cos(ang) * 0.2 - 0.01);
        hat.add(tip);
      }

      const jewel = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.034, 0)), rubyMat);
      jewel.position.set(0, 0.435, 0.215);
      hat.add(jewel);

      // Long cascading back hair & side curls
      const backHair = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.215, 0.25, 0.44, 12, 1, false, -0.95, Math.PI * 1.1)),
        hairLockMat
      );
      backHair.position.set(0, 0.14, -0.05);
      backHair.rotation.y = Math.PI;
      hat.add(backHair);
    } else if (cfg.hatStyle === 'princeCrown') {
      // Bright, unmistakable gleaming Golden Princely Crown with Velvet Cap for the Little Crown Prince
      const goldMat = this.track(
        new THREE.MeshStandardMaterial({
          color: 0xffd633,
          emissive: 0x3b2600,
          emissiveIntensity: 0.28,
          roughness: 0.18,
          metalness: 0.85,
        })
      );
      const velvetMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.82, metalness: 0.05 })
      );
      const gemMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.14, metalness: 0.35 })
      );

      const ring = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.235, 0.215, 0.105, 20)),
        goldMat
      );
      ring.position.set(0, 0.4, -0.01);
      hat.add(ring);

      const cap = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        velvetMat
      );
      cap.position.set(0, 0.415, -0.01);
      hat.add(cap);

      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.04, 0.165, 6)), goldMat);
        spike.position.set(Math.sin(ang) * 0.212, 0.52, Math.cos(ang) * 0.212 - 0.01);
        hat.add(spike);

        const tipGem = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.024, 6, 6)), gemMat);
        tipGem.position.set(Math.sin(ang) * 0.212, 0.605, Math.cos(ang) * 0.212 - 0.01);
        hat.add(tipGem);
      }

      const gem = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.045, 0)), gemMat);
      gem.position.set(0, 0.425, 0.235);
      hat.add(gem);
    }

    return hat;
  }

  private buildFemaleRoyalGown(primaryHex: number, trimGoldHex: number): THREE.Group {
    const g = new THREE.Group();
    const dressMat = this.track(
      new THREE.MeshStandardMaterial({
        color: primaryHex,
        roughness: 0.78,
        metalness: 0.06,
        side: THREE.DoubleSide,
      })
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: trimGoldHex,
        roughness: 0.25,
        metalness: 0.85,
      })
    );

    const skirt = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.185, 0.355, 0.43, 18, 1, false)),
      dressMat
    );
    skirt.position.set(0, -0.185, 0);
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    g.add(skirt);

    const belt = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.188, 0.024, 8, 18)),
      goldMat
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, 0.02, 0);
    g.add(belt);

    const hem = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.35, 0.365, 0.045, 18)),
      goldMat
    );
    hem.position.set(0, -0.39, 0);
    g.add(hem);

    return g;
  }

  private buildVizierScepter(): THREE.Group {
    const g = new THREE.Group();
    const staffMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x4b2c15, roughness: 0.65, metalness: 0.12 })
    );
    const goldMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 })
    );
    const gemMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.16, metalness: 0.35 })
    );

    const shaft = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.022, 0.018, 0.78, 8)),
      staffMat
    );
    shaft.position.set(0, 0.05, 0.06);
    shaft.rotation.x = 0.28;
    g.add(shaft);

    const finial = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.048, 10, 8)), goldMat);
    finial.position.set(0, 0.43, 0.17);
    g.add(finial);

    const gem = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.032, 0)), gemMat);
    gem.position.set(0, 0.49, 0.19);
    g.add(gem);
    return g;
  }

  private buildBackGear(
    style: CitizenBackStyle,
    color: number,
    isRainbow: boolean | undefined,
    rainbowMats: { mat: THREE.MeshStandardMaterial; hueOffset: number; sat: number; light: number }[]
  ): THREE.Group {
    const g = new THREE.Group();
    const mat = this.track(
      new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide })
    );
    if (isRainbow) {
      rainbowMats.push({ mat, hueOffset: 0.72, sat: 0.9, light: 0.5 });
    }

    if (style === 'cape') {
      const cape = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.28, 0.36, 0.025)), mat);
      cape.position.set(0, -0.09, -0.145);
      cape.rotation.x = 0.14;
      cape.castShadow = true;
      g.add(cape);
    } else if (style === 'backpack') {
      const pack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.2, 0.22, 0.11)), mat);
      pack.position.set(0, 0.02, -0.155);
      pack.castShadow = true;
      g.add(pack);
    } else if (style === 'satchel') {
      const bag = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.06, 0.11, 0.12)), mat);
      bag.position.set(0.18, -0.03, 0);
      bag.castShadow = true;
      g.add(bag);
    }
    return g;
  }

  private setCitizenAnim(c: CitizenEntity, next: 'walk' | 'idle' | 'wave') {
    if (c.currentAnim === next) return;
    const prevAction =
      c.currentAnim === 'walk'
        ? c.walkAction
        : c.currentAnim === 'idle'
        ? c.idleAction
        : c.waveAction;
    const nextAction =
      next === 'walk' ? c.walkAction : next === 'idle' ? c.idleAction : c.waveAction;

    if (prevAction) prevAction.fadeOut(0.22);
    if (nextAction) nextAction.reset().fadeIn(0.22).play();
    c.currentAnim = next;
  }

  private isPointObstructed(
    px: number,
    pz: number,
    selfIdx: number,
    sultanPos: THREE.Vector3,
    obstacles: ObstacleContext,
    margin: number = 0.85,
    ignoreHorsePos?: THREE.Vector3,
    ignoreCitizenAvoidance: boolean = false
  ): boolean {
    // 1–3. Spatial Hash check for OBB buildings/props, cylinders & tree trunks
    if (obstacles.isPointBlockedStatic) {
      if (obstacles.isPointBlockedStatic(px, pz, margin, false)) {
        return true;
      }
    } else {
      for (let i = 0; i < obstacles.boxes.length; i++) {
        const box = obstacles.boxes[i];
        if (box.bottomY !== undefined && box.bottomY >= 2.0) continue;
        const dx = px - box.cx;
        const dz = pz - box.cz;
        const lx = dx * box.cosY + dz * box.sinY;
        const lz = -dx * box.sinY + dz * box.cosY;
        if (Math.abs(lx) < box.halfW + margin && Math.abs(lz) < box.halfD + margin) {
          return true;
        }
      }

      for (let i = 0; i < obstacles.cylinders.length; i++) {
        const cyl = obstacles.cylinders[i];
        if (cyl.bottomY !== undefined && cyl.bottomY >= 2.0) continue;
        const dx = px - cyl.x;
        const dz = pz - cyl.z;
        const r = cyl.radius + margin;
        if (dx * dx + dz * dz < r * r) return true;
      }

      for (let i = 0; i < obstacles.trees.length; i++) {
        const t = obstacles.trees[i];
        const dx = px - t.x;
        const dz = pz - t.z;
        const r = t.radius + margin;
        if (dx * dx + dz * dz < r * r) return true;
      }
    }

    if (ignoreCitizenAvoidance) {
      return false;
    }

    // 4. Check Horses & Carriages (ignoring citizen's own led/ridden horse or night-hidden horses)
    for (let i = 0; i < obstacles.horses.length; i++) {
      const h = obstacles.horses[i];
      if (ignoreHorsePos && h.pos === ignoreHorsePos) continue;
      if (h.group && !h.group.visible) continue;
      const dx = px - h.pos.x;
      const dz = pz - h.pos.z;
      if (dx * dx + dz * dz < 1.85 * 1.85) return true;
    }

    // 4b. Check Farm Animals (cows, sheep, dogs) so citizens walk cleanly around them
    if (obstacles.farmAnimals) {
      for (let i = 0; i < obstacles.farmAnimals.length; i++) {
        const fa = obstacles.farmAnimals[i];
        const faR = fa.kind === 'cow' ? 0.78 : fa.kind === 'sheep' ? 0.45 : 0.38;
        const minD = faR + margin * 0.75;
        const dx = px - fa.pos.x;
        const dz = pz - fa.pos.z;
        if (dx * dx + dz * dz < minD * minD) return true;
      }
    }

    const selfRole = this.citizens[selfIdx]?.role;

    // 5. Check other Citizens (personal space!)
    for (let j = 0; j < this.citizens.length; j++) {
      if (j === selfIdx) continue;
      const other = this.citizens[j];
      if (!other.group.visible) continue;
      if (selfRole === 'bodyguard' && other.role === 'bodyguard') continue;
      const dx = px - other.pos.x;
      const dz = pz - other.pos.z;
      if (dx * dx + dz * dz < 1.15 * 1.15) return true;
    }

    // 6. Check Sultan (bodyguards stay flanking close to Sultan)
    if (selfRole !== 'bodyguard') {
      const dsx = px - sultanPos.x;
      const dsz = pz - sultanPos.z;
      if (dsx * dsx + dsz * dsz < 1.05 * 1.05) return true;
    }

    return false;
  }

  private chooseClearSteerAngle(
    originX: number,
    originZ: number,
    selfIdx: number,
    desiredAngle: number,
    sultanPos: THREE.Vector3,
    obstacles: ObstacleContext,
    ignoreHorsePos?: THREE.Vector3,
    baseMargin: number = 0.72,
    ignoreCitizenAvoidance: boolean = false
  ): number {
    // Test straight ahead first, then gentle -> wide left/right whisker probes
    const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8];
    for (let o = 0; o < offsets.length; o++) {
      const candAngle = desiredAngle + offsets[o];
      const dirX = Math.sin(candAngle);
      const dirZ = Math.cos(candAngle);

      // Probe both near (1.2m) and medium lookahead (2.4m) along candidate direction
      const blockedNear = this.isPointObstructed(
        originX + dirX * 1.2,
        originZ + dirZ * 1.2,
        selfIdx,
        sultanPos,
        obstacles,
        baseMargin,
        ignoreHorsePos,
        ignoreCitizenAvoidance
      );
      if (blockedNear) continue;

      const blockedFar = this.isPointObstructed(
        originX + dirX * 2.4,
        originZ + dirZ * 2.4,
        selfIdx,
        sultanPos,
        obstacles,
        baseMargin - 0.04,
        ignoreHorsePos,
        ignoreCitizenAvoidance
      );
      if (!blockedFar) {
        return candAngle;
      }
    }

    // If all far probes see something, pick whichever near probe is open
    for (let o = 1; o < offsets.length; o++) {
      const candAngle = desiredAngle + offsets[o];
      if (
        !this.isPointObstructed(
          originX + Math.sin(candAngle) * 1.05,
          originZ + Math.cos(candAngle) * 1.05,
          selfIdx,
          sultanPos,
          obstacles,
          baseMargin - 0.08,
          ignoreHorsePos,
          ignoreCitizenAvoidance
        )
      ) {
        return candAngle;
      }
    }
    return desiredAngle;
  }

  private applySeatedHorsePose(c: CitizenEntity, delta: number, isHorseMoving: boolean) {
    c.rideBobTime += delta;
    if (c.spineBone) c.spineBone.rotateX(0.06);

    if (c.upperLegL) {
      c.upperLegL.position.set(0.078 + 0.082, -0.02, 0.02);
      c.upperLegL.quaternion.copy(this.rideUpperLegQuatL);
      c.upperLegL.scale.set(1.02, 1.24, 1.02);
    }
    if (c.lowerLegL) {
      c.lowerLegL.quaternion.copy(this.rideLowerLegQuatL);
      c.lowerLegL.scale.set(1.0, 1.14, 1.0);
    }
    if (c.upperLegR) {
      c.upperLegR.position.set(-0.078 - 0.082, -0.02, 0.02);
      c.upperLegR.quaternion.copy(this.rideUpperLegQuatR);
      c.upperLegR.scale.set(1.02, 1.24, 1.02);
    }
    if (c.lowerLegR) {
      c.lowerLegR.quaternion.copy(this.rideLowerLegQuatR);
      c.lowerLegR.scale.set(1.0, 1.14, 1.0);
    }
    if (c.upperArmL) c.upperArmL.quaternion.copy(c.rideUpperArmQuatL);
    if (c.lowerArmL) c.lowerArmL.quaternion.copy(c.rideLowerArmQuatL);
    if (c.upperArmR) c.upperArmR.quaternion.copy(c.rideUpperArmQuatR);
    if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.rideLowerArmQuatR);

    c.modelGroup.position.y = isHorseMoving
      ? Math.abs(Math.sin(c.rideBobTime * 10.5)) * 0.032
      : Math.sin(c.rideBobTime * 2.2) * 0.01;
  }

  private resetStandingLimbs(c: CitizenEntity) {
    if (c.upperLegL) {
      c.upperLegL.position.set(0.078, 0, 0);
      c.upperLegL.scale.set(1, 1, 1);
    }
    if (c.lowerLegL) c.lowerLegL.scale.set(1, 1, 1);
    if (c.upperLegR) {
      c.upperLegR.position.set(-0.078, 0, 0);
      c.upperLegR.scale.set(1, 1, 1);
    }
    if (c.lowerLegR) c.lowerLegR.scale.set(1, 1, 1);
    c.modelGroup.position.y = 0;
  }

  public findNearestExecutable(pos: THREE.Vector3, maxDist: number = 3.6): CitizenEntity | null {
    if (this.execution || this.imprisonment || this.feedLion) return null;
    let best: CitizenEntity | null = null;
    let bestDistSq = maxDist * maxDist;

    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (!c.group.visible || c.isDead) continue;
      if (
        c.role === 'bodyguard' ||
        c.role === 'child' ||
        c.isArmoredGuard ||
        c.isRoyalFamily ||
        c.isImprisoned
      )
        continue;
      if (c.role === 'horse_rider' && !c.isDismountedForSultan) continue;
      if (c.isCafeNpc && c.cafeKind === 'seated' && c.cafeStandUpBlend < 0.8) continue;
      if (Math.abs(c.pos.y - pos.y) > 2.2) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = c;
      }
    }
    return best;
  }

  public setCitizenMoneyMap(map: Record<string, number>) {
    this.pendingMoneyMap = { ...map };
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (
        c.role === 'bodyguard' ||
        c.role === 'child' ||
        c.isArmoredGuard ||
        c.isBorderGuard ||
        c.isRoyalFamily
      )
        continue;
      if (typeof map[c.id] === 'number' && Number.isFinite(map[c.id])) {
        c.money = Math.max(0, Math.floor(map[c.id]));
      }
    }
  }

  public getCitizenMoneyMap(): Record<string, number> {
    const out: Record<string, number> = { ...this.pendingMoneyMap };
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (
        c.role === 'bodyguard' ||
        c.role === 'child' ||
        c.isArmoredGuard ||
        c.isBorderGuard ||
        c.isRoyalFamily
      )
        continue;
      out[c.id] = c.money;
    }
    return out;
  }

  public findNearestMoneyCitizen(
    pos: THREE.Vector3,
    maxDist: number = 3.6
  ): { id: string; labelAr: string; money: number } | null {
    let best: CitizenEntity | null = null;
    let bestDistSq = maxDist * maxDist;

    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (!c.group.visible) continue;
      if (
        c.role === 'bodyguard' ||
        c.role === 'child' ||
        c.isArmoredGuard ||
        c.isBorderGuard ||
        c.isRoyalFamily ||
        c.isImprisoned
      )
        continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = c;
      }
    }

    if (!best) return null;
    return {
      id: best.id,
      labelAr: best.displayNameAr,
      money: best.money,
    };
  }

  public takeMoneyFromCitizen(
    citizenId: string,
    requestedAmount: number
  ): { taken: number; remaining: number; labelAr: string } | null {
    const c = this.citizens.find((item) => item.id === citizenId);
    if (!c) return null;
    const safeReq = Number.isFinite(requestedAmount) ? Math.max(0, Math.floor(requestedAmount)) : 0;
    const taken = Math.min(c.money, safeReq);
    c.money -= taken;
    this.pendingMoneyMap[c.id] = c.money;
    if (taken > 0) {
      c.bowTimer = Math.max(c.bowTimer, 1.35);
    }
    return {
      taken,
      remaining: c.money,
      labelAr: c.displayNameAr,
    };
  }

  public distributeStipendToCitizens(amountPerCitizen: number): number {
    const add = Number.isFinite(amountPerCitizen) ? Math.max(0, Math.floor(amountPerCitizen)) : 0;
    if (add <= 0) return 0;
    let count = 0;
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (
        c.role === 'bodyguard' ||
        c.role === 'child' ||
        c.isArmoredGuard ||
        c.isBorderGuard ||
        c.isRoyalFamily
      )
        continue;
      c.money += add;
      this.pendingMoneyMap[c.id] = c.money;
      count++;
    }
    return count;
  }

  public findNearestExecutableInfo(
    pos: THREE.Vector3,
    maxDist: number = 3.6
  ): { id: string; labelAr: string } | null {
    const c = this.findNearestExecutable(pos, maxDist);
    if (!c) return null;
    return { id: c.id, labelAr: c.displayNameAr };
  }

  public getImprisonedCitizensInfo(currentGameMinutes: number): ImprisonedCitizenInfo[] {
    const list: ImprisonedCitizenInfo[] = [];
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (!c.isImprisoned) continue;
      const rem =
        c.prisonReleaseGameMinute > 0
          ? Math.max(0, c.prisonReleaseGameMinute - currentGameMinutes)
          : c.prisonSentenceMinutes;
      list.push({
        id: c.id,
        labelAr: c.displayNameAr,
        remainingMinutes: rem,
        sentenceMinutes: c.prisonSentenceMinutes,
        slotIndex: c.prisonSlotIndex,
      });
    }
    return list;
  }

  public releasePrisonerById(citizenId: string, prison?: RoyalPrison | null): boolean {
    const c = this.citizens.find((item) => item.id === citizenId);
    if (!c || !c.isImprisoned) return false;
    this.releasePrisonerInternal(c, prison || null);
    return true;
  }

  private releasePrisonerInternal(c: CitizenEntity, prison: RoyalPrison | null) {
    c.isImprisoned = false;
    c.prisonReleaseGameMinute = 0;
    c.prisonSentenceMinutes = 0;
    c.role =
      c.originalRole === 'horse_rider' || c.originalRole === 'horse_leader'
        ? 'walker'
        : c.originalRole;
    if (c.prisonLabelSprite) {
      c.prisonLabelSprite.visible = false;
    }
    delete this.pendingPrisonersMap[c.id];
    if (prison) {
      c.pos.copy(prison.doorOutsidePos);
      c.group.position.copy(c.pos);
      prison.pulseDoorOpen(2.8);
    }
    this.recentPrisonEvent = {
      type: 'released',
      citizenId: c.id,
      labelAr: c.displayNameAr,
      remainingMinutes: 0,
    };
  }

  public consumePrisonEvent(): PrisonEventInfo | null {
    const ev = this.recentPrisonEvent;
    this.recentPrisonEvent = null;
    return ev;
  }

  public getPrisonersSaveMap(currentGameMinutes: number): Record<string, SavedPrisonerRecord> {
    const out: Record<string, SavedPrisonerRecord> = {};
    for (const [k, v] of Object.entries(this.pendingPrisonersMap)) {
      if (v.releaseGameMinute > currentGameMinutes) {
        out[k] = v;
      }
    }
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (c.isImprisoned && c.prisonReleaseGameMinute > currentGameMinutes) {
        out[c.id] = {
          slotIndex: c.prisonSlotIndex,
          releaseGameMinute: c.prisonReleaseGameMinute,
          sentenceMinutes: c.prisonSentenceMinutes,
        };
      }
    }
    return out;
  }

  public setPrisonersSaveMap(
    map: Record<string, SavedPrisonerRecord>,
    prison: RoyalPrison | null,
    currentGameMinutes: number
  ) {
    this.pendingPrisonersMap = { ...map };
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      const rec = map[c.id];
      if (rec && rec.releaseGameMinute > currentGameMinutes) {
        if (c.ropeVisual) c.ropeVisual.setVisible(false);
        if (c.horse) {
          c.horse.ownerCitizenId = undefined;
          c.horse = null;
        }
        c.role = 'standing';
        c.isImprisoned = true;
        c.prisonSlotIndex = rec.slotIndex;
        c.prisonReleaseGameMinute = rec.releaseGameMinute;
        c.prisonSentenceMinutes = rec.sentenceMinutes;
        if (prison) {
          c.pos.copy(prison.getCellSlot(rec.slotIndex));
          c.group.position.copy(c.pos);
        }
        this.imprisonedCount = Math.max(this.imprisonedCount, rec.slotIndex + 1);
      } else if (c.isImprisoned) {
        this.releasePrisonerInternal(c, prison);
      }
    }
  }

  private createRoyalTitleSprite(
    titleAr: string,
    bgHex: string,
    borderHex: string,
    textHex: string
  ): THREE.Sprite | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = bgHex;
      ctx.beginPath();
      ctx.roundRect(18, 18, w - 36, h - 36, 36);
      ctx.fill();

      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillStyle = textHex;
      ctx.font = '900 58px "Tajawal", sans-serif';
      ctx.fillText(titleAr, w / 2, h / 2 + 2);
    }

    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const mat = this.track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 10;
    return sprite;
  }

  private updateCitizenPrisonLabel(c: CitizenEntity, remainingMinutes: number) {
    if (typeof document === 'undefined') return;
    if (!c.prisonLabelSprite || !c.prisonLabelCanvas || !c.prisonLabelTex) {
      const canvas = document.createElement('canvas');
      canvas.width = 560;
      canvas.height = 160;
      const tex = this.track(new THREE.CanvasTexture(canvas));
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = this.track(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
      );
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(2.5, 0.72, 1);
      sprite.renderOrder = 995;
      this.group.add(sprite);
      c.prisonLabelCanvas = canvas;
      c.prisonLabelTex = tex;
      c.prisonLabelSprite = sprite;
    }

    const remText = formatRemainingPrisonTime(remainingMinutes, 3);
    c.prisonLabelSprite.visible = true;
    c.prisonLabelSprite.position.set(c.pos.x, c.pos.y + 1.56 * c.scale, c.pos.z);

    if (c.lastPrisonLabelText === remText) return;
    c.lastPrisonLabelText = remText;

    const ctx = c.prisonLabelCanvas.getContext('2d');
    if (!ctx) return;
    const w = c.prisonLabelCanvas.width;
    const h = c.prisonLabelCanvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(10, 10, w - 20, h - 30, 22);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fcd34d';
    ctx.font = '800 30px "Tajawal", sans-serif';
    ctx.fillText(`⛓️ ${c.displayNameAr}`, w / 2, 52);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 31px "Tajawal", sans-serif';
    ctx.fillText(`المتبقي: ${remText}`, w / 2, 100);

    c.prisonLabelTex.needsUpdate = true;
  }

  public getExecutionStatus(): ExecutionStatus {
    if (this.feedLion) {
      let phaseLabel = 'الحراس ينفذون أمر الإلقاء للأسد';
      switch (this.feedLion.phase) {
        case 'rush_to_target':
          phaseLabel = 'الحراس يطوّقون الشخص للإمساك به';
          break;
        case 'grab_and_escort':
          phaseLabel = 'الحراس يمسكون الشخص وينقلونه لقفص الأسد';
          break;
        case 'toss_into_lion_cage':
          phaseLabel = 'فتح القفص وإدخال الشخص لقفص الأسد';
          break;
        case 'lion_devour_and_lock':
          phaseLabel = 'الأسد يلتهم الشخص بالكامل وإغلاق القفص';
          break;
        case 'return_salute':
          phaseLabel = 'التهم الأسد الشخص بالكامل';
          break;
      }
      return { isExecuting: true, phaseLabel, countdownSec: null };
    }

    if (this.imprisonment) {
      const imp = this.imprisonment;
      let phaseLabel = 'الحراس يأخذون المتهم إلى السجن';
      switch (imp.phase) {
        case 'rush_to_target':
        case 'grab_prisoner':
          phaseLabel = 'الحراس يقبضون على المتهم للسجن';
          break;
        case 'escort_to_prison':
          phaseLabel = 'اقتياد السجين إلى السجن الملكي';
          break;
        case 'open_door_and_enter':
          phaseLabel = 'فتح باب السجن وإدخال السجين';
          break;
        case 'lock_door':
          phaseLabel = 'إغلاق باب السجن على السجين';
          break;
        case 'return_salute':
          phaseLabel = 'تم سجن المتهم وإغلاق الباب عليه';
          break;
      }
      return { isExecuting: true, phaseLabel, countdownSec: null };
    }

    if (!this.execution) {
      return { isExecuting: false, phaseLabel: null, countdownSec: null };
    }
    const ex = this.execution;
    let phaseLabel = 'الحراس ينفذون أمر الإعدام';
    let countdownSec: number | null = null;
    switch (ex.phase) {
      case 'rush_to_target':
      case 'grab_struggle':
        phaseLabel = 'الحراس يقبضون على المتهم';
        break;
      case 'escort_to_gallows':
      case 'climb_stairs':
        phaseLabel = 'اقتياد المتهم إلى المعدمة';
        break;
      case 'place_in_noose':
      case 'hoist_up':
        phaseLabel = 'وضع الحبل في عنقه ورفعه';
        break;
      case 'hanging_scream':
        countdownSec = Math.max(1, Math.ceil(20 - ex.timer));
        phaseLabel = `تنفيذ الإعدام (${countdownSec} ث)`;
        break;
      case 'death_moment':
      case 'lower_and_pickup':
        phaseLabel = 'مات المتهم، الحراس يحملونه';
        break;
      case 'carry_to_well':
      case 'throw_into_well':
        phaseLabel = 'رمي الجثة في البئر';
        break;
      case 'return_salute':
        phaseLabel = 'اكتمل التنفيذ';
        break;
    }
    return { isExecuting: true, phaseLabel, countdownSec };
  }

  public getBorderGuardStatus(sultanPos: THREE.Vector3): {
    isNearRomanBorder: boolean;
    message: string | null;
  } {
    const borderGuards = this.citizens.filter((c) => c.isBorderGuard);
    let near = false;

    for (let i = 0; i < borderGuards.length; i++) {
      const g = borderGuards[i];
      if (Math.hypot(sultanPos.x - g.pos.x, sultanPos.z - g.pos.z) < 7.0) {
        near = true;
        break;
      }
    }

    if (!near && Math.hypot(sultanPos.x - 86.2, sultanPos.z - 3.5) < 7.2) {
      near = true;
    }

    return {
      isNearRomanBorder: near,
      message: near
        ? 'عذراً يا مولاي، لا يمكنك تجاوز هذه الحدود، فهي تابعة للملك الروماني، وإذا تجاوزتها فقد يعلن الحرب عليك.'
        : null,
    };
  }

  private ensureBorderSpeechSprite(): THREE.Sprite {
    if (this.borderSpeechSprite) return this.borderSpeechSprite;

    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    // Rounded dark imperial parchment speech bubble
    ctx.fillStyle = 'rgba(26, 14, 14, 0.92)';
    ctx.beginPath();
    ctx.roundRect(14, 14, canvas.width - 28, canvas.height - 46, 26);
    ctx.fill();

    ctx.strokeStyle = '#d4a644';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Pointer tail
    ctx.fillStyle = 'rgba(26, 14, 14, 0.92)';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 22, canvas.height - 34);
    ctx.lineTo(canvas.width / 2, canvas.height - 6);
    ctx.lineTo(canvas.width / 2 + 22, canvas.height - 34);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 36px "Tajawal", sans-serif';
    ctx.fillText('عذراً يا مولاي! هذه حدود الملك الروماني', canvas.width / 2, 68);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 30px "Tajawal", sans-serif';
    ctx.fillText('لا يمكنك التجاوز وإلا أعلن الحرب عليك', canvas.width / 2, 114);

    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.8, 0.95, 1);
    sprite.visible = false;
    this.group.add(sprite);
    this.borderSpeechSprite = sprite;
    return sprite;
  }

  public isPrisonDoorForcedOpen(): boolean | null {
    if (!this.imprisonment) return null;
    if (this.imprisonment.phase === 'open_door_and_enter') return true;
    if (this.imprisonment.phase === 'lock_door') return false;
    return null;
  }

  public startImprisonNear(
    sultanPos: THREE.Vector3,
    prison: RoyalPrison,
    sentenceMinutes: number = 60
  ): boolean {
    if (this.execution || this.imprisonment) return false;
    const prisoner = this.findNearestExecutable(sultanPos, 3.6);
    const guardA = this.citizens.find((c) => c.id === 'c_bodyguard_right');
    const guardB = this.citizens.find((c) => c.id === 'c_bodyguard_left');
    if (!prisoner || !guardA || !guardB) return false;

    if (prisoner.ropeVisual) {
      prisoner.ropeVisual.setVisible(false);
    }
    if (prisoner.horse) {
      prisoner.horse.ownerCitizenId = undefined;
      prisoner.horse = null;
    }
    prisoner.role = 'standing';
    prisoner.isCafeNpc = false;
    prisoner.cafeKind = undefined;
    prisoner.pos.y = 0;
    prisoner.isDismountedForSultan = false;
    prisoner.shadowMesh.visible = true;
    prisoner.proximityBowBlend = 0;
    this.resetStandingLimbs(prisoner);

    guardA.bowTimer = 0;
    guardA.proximityBowBlend = 0;
    guardB.bowTimer = 0;
    guardB.proximityBowBlend = 0;

    const slotIndex = this.imprisonedCount;
    const cellSlot = prison.getCellSlot(slotIndex);

    this.imprisonment = {
      phase: 'rush_to_target',
      timer: 0,
      totalTime: 0,
      prisoner,
      guardA,
      guardB,
      cellSlot,
      slotIndex,
      sentenceMinutes: Math.max(1, Math.floor(sentenceMinutes)),
      escortStuckTimer: 0,
      escortLastPos: prisoner.pos.clone(),
      lastBubbleText: '',
    };

    soundManager.playArrestOrder();
    return true;
  }

  public toggleGuardsProtectMode(forceState?: boolean): boolean {
    const next = typeof forceState === 'boolean' ? forceState : !this.guardsProtectMode;
    this.guardsProtectMode = next;
    return this.guardsProtectMode;
  }

  public isGuardsProtectMode(): boolean {
    return this.guardsProtectMode;
  }

  public startFeedLionNear(sultanPos: THREE.Vector3): boolean {
    if (this.execution || this.imprisonment || this.feedLion) return false;
    const victim = this.findNearestExecutable(sultanPos, 3.8);
    const guardA = this.citizens.find((c) => c.id === 'c_bodyguard_right');
    const guardB = this.citizens.find((c) => c.id === 'c_bodyguard_left');
    if (!victim || !guardA || !guardB) return false;

    if (victim.ropeVisual) victim.ropeVisual.setVisible(false);
    if (victim.horse) {
      victim.horse.ownerCitizenId = undefined;
      victim.horse = null;
    }
    victim.role = 'standing';
    victim.isCafeNpc = false;
    victim.cafeKind = undefined;
    if (victim.pos.y < 1.2) victim.pos.y = 0;
    victim.isDismountedForSultan = false;
    victim.shadowMesh.visible = true;
    victim.proximityBowBlend = 0;
    this.resetStandingLimbs(victim);

    guardA.bowTimer = 0;
    guardA.proximityBowBlend = 0;
    guardB.bowTimer = 0;
    guardB.proximityBowBlend = 0;

    // Remove victim from Speech Podium audience if present so they don't snap back
    this.speechAudienceIds.delete(victim.id);

    // Build clean static-wall-free waypoint route to the Lion Cage door (13.5, -23.1)
    const waypoints: [number, number][] = [];
    if (victim.pos.z < -30.4) {
      // Inside Palace grounds: route cleanly out of side wing -> center foyer -> main door -> courtyard
      if (Math.abs(victim.pos.x) > 13.0) {
        const sideSign = victim.pos.x < 0 ? -1 : 1;
        const doorZ = victim.pos.z > -43.7 ? -37.65 : victim.pos.z > -55.8 ? -49.75 : -61.9;
        waypoints.push([sideSign * 11.4, doorZ]);
      }
      waypoints.push([0, -33.2], [0, -28.0]);
    }
    waypoints.push([13.5, -23.1]);

    this.feedLion = {
      phase: 'rush_to_target',
      timer: 0,
      victim,
      guardA,
      guardB,
      waypoints,
      waypointIdx: 0,
      tossedInCage: false,
      gateLocked: false,
      escortStuckTimer: 0,
      escortLastPos: victim.pos.clone(),
      progressCheckTimer: 0,
      progressCheckPos: victim.pos.clone(),
      totalEscortTime: 0,
    };

    soundManager.playArrestOrder();
    return true;
  }

  public startExecutionNear(sultanPos: THREE.Vector3): boolean {
    if (this.execution || this.imprisonment || this.feedLion) return false;
    const victim = this.findNearestExecutable(sultanPos, 3.6);
    const guardA = this.citizens.find((c) => c.id === 'c_bodyguard_right');
    const guardB = this.citizens.find((c) => c.id === 'c_bodyguard_left');
    if (!victim || !guardA || !guardB) return false;

    // Detach any horse or lead rope from condemned citizen cleanly
    if (victim.ropeVisual) {
      victim.ropeVisual.setVisible(false);
    }
    if (victim.horse) {
      victim.horse.ownerCitizenId = undefined;
      victim.horse = null;
    }
    victim.role = 'standing';
    victim.isCafeNpc = false;
    victim.cafeKind = undefined;
    victim.pos.y = 0;
    victim.isDismountedForSultan = false;
    victim.shadowMesh.visible = true;
    victim.proximityBowBlend = 0;
    this.resetStandingLimbs(victim);

    guardA.bowTimer = 0;
    guardA.proximityBowBlend = 0;
    guardB.bowTimer = 0;
    guardB.proximityBowBlend = 0;

    this.execution = {
      phase: 'rush_to_target',
      timer: 0,
      totalTime: 0,
      victim,
      guardA,
      guardB,
      stairStage: 0,
      escortStuckTimer: 0,
      escortLastPos: victim.pos.clone(),
      nextScreamAt: 0.25,
      screamPhraseIdx: 0,
      lastBubbleSec: -1,
      lastBubbleText: '',
      throwStartPos: new THREE.Vector3(),
      splashTriggered: false,
      leverSoundPlayed: false,
      wellWaypointPassed: false,
    };

    soundManager.playArrestOrder();
    return true;
  }

  private isExecutionParticipant(c: CitizenEntity): boolean {
    if (
      this.feedLion &&
      (c === this.feedLion.victim || c === this.feedLion.guardA || c === this.feedLion.guardB)
    ) {
      return true;
    }
    if (
      this.execution &&
      (c === this.execution.victim || c === this.execution.guardA || c === this.execution.guardB)
    ) {
      return true;
    }
    if (
      this.imprisonment &&
      (c === this.imprisonment.prisoner ||
        c === this.imprisonment.guardA ||
        c === this.imprisonment.guardB)
    ) {
      return true;
    }
    return false;
  }

  private gallowsWorldPoint(village: KingdomVillage, lx: number, ly: number, lz: number): THREE.Vector3 {
    const g = village.gallowsAnchor;
    if (!g) return new THREE.Vector3(lx, ly, lz);
    return new THREE.Vector3(lx, ly, lz)
      .applyAxisAngle(_yAxis, g.rotY)
      .add(new THREE.Vector3(g.deckCenter.x, 0, g.deckCenter.z));
  }

  private turnTowards(c: CitizenEntity, targetYaw: number, speed: number, delta: number) {
    let diff = targetYaw - c.facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.facingAngle += diff * Math.min(1.0, delta * speed);
    c.modelGroup.rotation.y = c.facingAngle;
  }

  private moveCharacterAlongPath(
    c: CitizenEntity,
    selfIdx: number,
    targetX: number,
    targetZ: number,
    speed: number,
    delta: number,
    sultanPos: THREE.Vector3,
    obstacles: ObstacleContext,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    skipCollisionAvoidance: boolean = false,
    ignoreCitizenAvoidance: boolean = false
  ): number {
    const dx = targetX - c.pos.x;
    const dz = targetZ - c.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) return dist;

    this.setCitizenAnim(c, 'walk');
    const rawDesired = Math.atan2(dx, dz);
    const steerAngle =
      !skipCollisionAvoidance && dist > 1.35
        ? this.chooseClearSteerAngle(
            c.pos.x,
            c.pos.z,
            selfIdx,
            rawDesired,
            sultanPos,
            obstacles,
            undefined,
            ignoreCitizenAvoidance ? 0.45 : 0.72,
            ignoreCitizenAvoidance
          )
        : rawDesired;

    this.turnTowards(c, steerAngle, 10.5, delta);
    if (c.walkAction) {
      c.walkAction.setEffectiveTimeScale(Math.min(2.6, Math.max(0.95, speed / 2.2)));
    }
    const step = Math.min(dist, speed * delta);
    c.pos.x += Math.sin(c.facingAngle) * step;
    c.pos.z += Math.cos(c.facingAngle) * step;

    if (!skipCollisionAvoidance) {
      resolveCollision(c.pos, 0.42);
    }
    enforceBoundary(c.pos);
    return dist - step;
  }

  private updateExecution(
    delta: number,
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    obstacles: ObstacleContext,
    village: KingdomVillage
  ) {
    const ex = this.execution;
    if (!ex || !village.gallowsAnchor) return;

    ex.timer += delta;
    ex.totalTime += delta;
    const { victim, guardA, guardB } = ex;
    const gAnchor = village.gallowsAnchor;
    const deckH = gAnchor.deckHeight;
    const gRotY = gAnchor.rotY;
    const victimNeckOffsetY = 0.585 * victim.scale;

    const stairFoot = this.gallowsWorldPoint(village, 0, 0, 3.35);
    const deckTop = this.gallowsWorldPoint(village, 0, deckH, 1.35);
    const nooseSpot = this.gallowsWorldPoint(village, 0, deckH, 0.04);
    const guardANoosePos = this.gallowsWorldPoint(village, -0.78, deckH, 0.14);
    const guardBLeverPos = this.gallowsWorldPoint(village, 0.96, deckH, -0.28);
    const wellApproach = new THREE.Vector3(0, 0, -7.45);
    const wellDetour = new THREE.Vector3(-4.6, 0, -5.6);

    const guardAIdx = this.citizens.indexOf(guardA);
    const guardBIdx = this.citizens.indexOf(guardB);
    const victimIdx = this.citizens.indexOf(victim);

    const setGuardCarryArms = (g: CitizenEntity, blend: number = 1) => {
      if (g.upperArmL) g.upperArmL.quaternion.slerp(g.actionQuats.carryUpperL, blend);
      if (g.lowerArmL) g.lowerArmL.quaternion.slerp(g.actionQuats.carryLowerL, blend);
      if (g.upperArmR) g.upperArmR.quaternion.slerp(g.actionQuats.carryUpperR, blend);
      if (g.lowerArmR) g.lowerArmR.quaternion.slerp(g.actionQuats.carryLowerR, blend);
    };

    const setGuardRaiseArms = (g: CitizenEntity, blend: number = 1) => {
      if (g.upperArmL) g.upperArmL.quaternion.slerp(g.actionQuats.raiseUpperL, blend);
      if (g.lowerArmL) g.lowerArmL.quaternion.slerp(g.actionQuats.raiseLowerL, blend);
      if (g.upperArmR) g.upperArmR.quaternion.slerp(g.actionQuats.raiseUpperR, blend);
      if (g.lowerArmR) g.lowerArmR.quaternion.slerp(g.actionQuats.raiseLowerR, blend);
    };

    const setGuardThrowBackArms = (g: CitizenEntity) => {
      if (g.upperArmL) g.upperArmL.quaternion.copy(g.actionQuats.throwBackUpperL);
      if (g.upperArmR) g.upperArmR.quaternion.copy(g.actionQuats.throwBackUpperR);
    };

    const syncBubble = (show: boolean, text: string, countdown: number | null) => {
      if (!this.screamSprite) return;
      this.screamSprite.visible = show;
      if (show) {
        this.updateScreamBubble(text, countdown);
        const shakeX = countdown !== null ? Math.sin(ex.totalTime * 28) * 0.06 : 0;
        const shakeY = countdown !== null ? Math.cos(ex.totalTime * 22) * 0.04 : 0;
        this.screamSprite.position.set(
          victim.pos.x + shakeX,
          victim.pos.y + 1.48 * victim.scale + shakeY,
          victim.pos.z
        );
      }
    };

    // Reset victim root model tilt unless horizontally carried
    if (
      ex.phase !== 'carry_to_well' &&
      ex.phase !== 'lower_and_pickup' &&
      ex.phase !== 'throw_into_well'
    ) {
      victim.modelGroup.rotation.x = 0;
      victim.modelGroup.rotation.z = 0;
      victim.modelGroup.position.y = 0;
    }

    // --- PHASE 1: Guards rush forcefully to surround & seize the citizen ---
    if (ex.phase === 'rush_to_target') {
      const targetAngle = Math.atan2(
        sultanPos.x - victim.pos.x,
        sultanPos.z - victim.pos.z
      );
      this.turnTowards(victim, targetAngle, 6.0, delta);
      this.setCitizenAnim(victim, 'idle');
      victim.group.position.copy(victim.pos);
      victim.mixer.update(delta);

      // Victim raises hands nervously as guards sprint in
      if (victim.spineBone) victim.spineBone.rotateX(-0.12);
      setGuardRaiseArms(victim, 0.55);

      const rightX = Math.cos(victim.facingAngle) * 0.85;
      const rightZ = -Math.sin(victim.facingAngle) * 0.85;
      const remA = this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        victim.pos.x - rightX,
        victim.pos.z - rightZ,
        7.6,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );
      const remB = this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        victim.pos.x + rightX,
        victim.pos.z + rightZ,
        7.6,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );

      guardA.group.position.copy(guardA.pos);
      guardA.mixer.update(delta);
      guardB.group.position.copy(guardB.pos);
      guardB.mixer.update(delta);
      if (guardA.chestBone) guardA.chestBone.rotateX(0.24);
      if (guardB.chestBone) guardB.chestBone.rotateX(0.24);

      syncBubble(true, 'ماذا يحدث؟! لااا!! 😨', null);

      if ((remA < 0.55 && remB < 0.55) || ex.timer > 9.0) {
        guardA.pos.set(victim.pos.x - rightX * 0.9, 0, victim.pos.z - rightZ * 0.9);
        guardB.pos.set(victim.pos.x + rightX * 0.9, 0, victim.pos.z + rightZ * 0.9);
        ex.phase = 'grab_struggle';
        ex.timer = 0;
        soundManager.playScreamBurst();
      }
      return;
    }

    // --- PHASE 2: Dramatic grab & prisoner struggle ---
    if (ex.phase === 'grab_struggle') {
      const lookVictimA = Math.atan2(victim.pos.x - guardA.pos.x, victim.pos.z - guardA.pos.z);
      const lookVictimB = Math.atan2(victim.pos.x - guardB.pos.x, victim.pos.z - guardB.pos.z);
      this.turnTowards(guardA, lookVictimA, 12.0, delta);
      this.turnTowards(guardB, lookVictimB, 12.0, delta);

      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      this.setCitizenAnim(victim, 'idle');

      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.group.position.copy(victim.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      victim.mixer.update(delta);

      // Guards clamp aggressively onto victim shoulders
      if (guardA.spineBone) guardA.spineBone.rotateX(0.32);
      if (guardB.spineBone) guardB.spineBone.rotateX(0.32);
      setGuardCarryArms(guardA, 1);
      setGuardCarryArms(guardB, 1);

      // Victim twists violently trying to break free
      if (victim.spineBone) {
        victim.spineBone.rotateX(-0.22 + Math.sin(ex.timer * 15) * 0.18);
        victim.spineBone.rotateZ(Math.sin(ex.timer * 18) * 0.22);
      }
      if (victim.headBone) victim.headBone.rotateY(Math.sin(ex.timer * 20) * 0.48);
      setGuardRaiseArms(victim, 0.85);

      syncBubble(true, 'اتركوني!! أرجوكم لا!! 😱', null);

      if (ex.timer >= 1.45) {
        ex.phase = 'escort_to_gallows';
        ex.timer = 0;
        ex.escortStuckTimer = 0;
        ex.escortLastPos.copy(victim.pos);
      }
      return;
    }

    // --- PHASE 3: Escort forced-march toward Gallows staircase foot ---
    if (ex.phase === 'escort_to_gallows') {
      // Check if Royal Well (0, -9.5) blocks straight segment -> detour smoothly if needed
      let targetPt = stairFoot;
      const toStairX = stairFoot.x - victim.pos.x;
      const toStairZ = stairFoot.z - victim.pos.z;
      const segLenSq = toStairX * toStairX + toStairZ * toStairZ;
      if (segLenSq > 4 && victim.pos.z > -7.5 && victim.pos.x > -4.5) {
        const dot =
          ((village.wellCenter.x - victim.pos.x) * toStairX +
            (village.wellCenter.z - victim.pos.z) * toStairZ) /
          segLenSq;
        if (dot > 0.1 && dot < 0.9) {
          const px = victim.pos.x + toStairX * dot - village.wellCenter.x;
          const pz = victim.pos.z + toStairZ * dot - village.wellCenter.z;
          if (px * px + pz * pz < 3.6 * 3.6) {
            targetPt = wellDetour;
          }
        }
      }

      const rem = this.moveCharacterAlongPath(
        victim,
        victimIdx,
        targetPt.x,
        targetPt.z,
        3.9,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );

      // Position flanking guards locked on left & right of prisoner marching together
      const rightX = Math.cos(victim.facingAngle) * 0.72;
      const rightZ = -Math.sin(victim.facingAngle) * 0.72;
      const backX = -Math.sin(victim.facingAngle) * 0.14;
      const backZ = -Math.cos(victim.facingAngle) * 0.14;

      guardA.pos.set(victim.pos.x - rightX + backX, 0, victim.pos.z - rightZ + backZ);
      guardB.pos.set(victim.pos.x + rightX + backX, 0, victim.pos.z + rightZ + backZ);
      this.turnTowards(guardA, victim.facingAngle, 12.0, delta);
      this.turnTowards(guardB, victim.facingAngle, 12.0, delta);

      this.setCitizenAnim(guardA, 'walk');
      this.setCitizenAnim(guardB, 'walk');
      if (guardA.walkAction) guardA.walkAction.setEffectiveTimeScale(1.65);
      if (guardB.walkAction) guardB.walkAction.setEffectiveTimeScale(1.65);

      victim.group.position.copy(victim.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Strong escort grip + prisoner hunched trembling torso
      if (guardA.upperArmL) guardA.upperArmL.quaternion.copy(guardA.actionQuats.carryUpperL);
      if (guardA.lowerArmL) guardA.lowerArmL.quaternion.copy(guardA.actionQuats.carryLowerL);
      if (guardB.upperArmR) guardB.upperArmR.quaternion.copy(guardB.actionQuats.carryUpperR);
      if (guardB.lowerArmR) guardB.lowerArmR.quaternion.copy(guardB.actionQuats.carryLowerR);

      if (victim.spineBone) victim.spineBone.rotateX(0.28 + Math.sin(ex.totalTime * 8) * 0.08);
      if (victim.headBone) victim.headBone.rotateY(Math.sin(ex.totalTime * 6) * 0.35);

      syncBubble(true, 'الرحمة يا مولاي السلطان!! 😰', null);

      ex.escortStuckTimer += delta;
      if (ex.escortStuckTimer > 1.8) {
        const movedSq = victim.pos.distanceToSquared(ex.escortLastPos);
        ex.escortLastPos.copy(victim.pos);
        ex.escortStuckTimer = 0;
        if (movedSq < 0.35) {
          victim.pos.lerp(stairFoot, 0.32);
        }
      }

      if ((targetPt === stairFoot && rem < 0.65) || victim.pos.distanceTo(stairFoot) < 0.85 || ex.timer > 15.0) {
        victim.pos.copy(stairFoot);
        ex.phase = 'climb_stairs';
        ex.timer = 0;
        ex.stairStage = 0;
      }
      return;
    }

    // --- PHASE 4: Climb Gallows Stairs up onto Execution Deck ---
    if (ex.phase === 'climb_stairs') {
      this.setCitizenAnim(victim, 'walk');
      this.setCitizenAnim(guardA, 'walk');
      this.setCitizenAnim(guardB, 'walk');

      if (ex.stairStage === 0) {
        const t = Math.min(1, ex.timer / 1.05);
        victim.pos.lerpVectors(stairFoot, deckTop, t);
        victim.pos.y = t * deckH;
        const upYaw = Math.atan2(deckTop.x - stairFoot.x, deckTop.z - stairFoot.z);
        this.turnTowards(victim, upYaw, 10, delta);

        const rightX = Math.cos(upYaw) * 0.72;
        const rightZ = -Math.sin(upYaw) * 0.72;
        guardA.pos.set(victim.pos.x - rightX, victim.pos.y, victim.pos.z - rightZ);
        guardB.pos.set(victim.pos.x + rightX, victim.pos.y, victim.pos.z + rightZ);
        this.turnTowards(guardA, upYaw, 10, delta);
        this.turnTowards(guardB, upYaw, 10, delta);

        if (t >= 1) {
          ex.stairStage = 1;
          ex.timer = 0;
        }
      } else {
        const t = Math.min(1, ex.timer / 0.85);
        victim.pos.lerpVectors(deckTop, nooseSpot, t);
        victim.pos.y = deckH;
        this.turnTowards(victim, gRotY, 10, delta);

        guardA.pos.lerp(guardANoosePos, Math.min(1, delta * 5.0));
        guardA.pos.y = deckH;
        const lookPrisoner = Math.atan2(nooseSpot.x - guardA.pos.x, nooseSpot.z - guardA.pos.z);
        this.turnTowards(guardA, lookPrisoner, 10, delta);

        guardB.pos.lerp(guardBLeverPos, Math.min(1, delta * 5.0));
        guardB.pos.y = deckH;
        const lookLever = Math.atan2(
          gAnchor.leverWorldPos.x - guardB.pos.x,
          gAnchor.leverWorldPos.z - guardB.pos.z
        );
        this.turnTowards(guardB, lookLever, 10, delta);

        if (t >= 1) {
          victim.pos.copy(nooseSpot);
          guardA.pos.copy(guardANoosePos);
          guardB.pos.copy(guardBLeverPos);
          ex.phase = 'place_in_noose';
          ex.timer = 0;
          soundManager.playRopeCreak();
        }
      }

      victim.group.position.copy(victim.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      setGuardCarryArms(guardA, 1);
      setGuardCarryArms(guardB, 0.85);
      syncBubble(true, 'لا تعدموني!! أرجوكم!! 😭', null);
      return;
    }

    // --- PHASE 5: Guard A places rope loop around neck; Guard B grips lever ---
    if (ex.phase === 'place_in_noose') {
      const t = Math.min(1, ex.timer / 1.8);
      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');

      this.turnTowards(victim, gRotY, 10, delta);
      const lookPrisoner = Math.atan2(nooseSpot.x - guardA.pos.x, nooseSpot.z - guardA.pos.z);
      this.turnTowards(guardA, lookPrisoner, 10, delta);
      const lookLever = Math.atan2(
        gAnchor.leverWorldPos.x - guardB.pos.x,
        gAnchor.leverWorldPos.z - guardB.pos.z
      );
      this.turnTowards(guardB, lookLever, 10, delta);

      victim.group.position.copy(victim.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Guard A reaches UP placing noose gently over prisoner's head down to neck
      setGuardRaiseArms(guardA, Math.sin(t * Math.PI));
      setGuardCarryArms(guardB, 0.9);
      if (guardB.spineBone) guardB.spineBone.rotateX(0.24);

      // Prisoner trembles under the descending rope
      if (victim.spineBone) victim.spineBone.rotateX(0.14 + Math.sin(ex.timer * 24) * 0.04);
      if (victim.headBone) victim.headBone.rotateX(0.18);

      const restNooseY = gAnchor.ropeAnchorWorldY - 1.63;
      const neckWorldY = deckH + victimNeckOffsetY;
      const currentRopeY = THREE.MathUtils.lerp(restNooseY, neckWorldY, t);
      village.setExecutionGallowsState({
        active: true,
        ropeTargetWorldY: currentRopeY,
        nooseTight: t > 0.72,
        trapdoorOpen: 0,
        leverPulled: 0,
        swayZ: 0,
        swayX: 0,
      });

      syncBubble(true, 'لااا! الحبل في عنقي!! 😱', null);

      if (ex.timer >= 1.8) {
        ex.phase = 'hoist_up';
        ex.timer = 0;
        ex.leverSoundPlayed = false;
      }
      return;
    }

    // --- PHASE 6: Guard B pulls lever & hoists prisoner off the platform ---
    if (ex.phase === 'hoist_up') {
      const t = Math.min(1, ex.timer / 1.45);
      if (!ex.leverSoundPlayed && t > 0.08) {
        ex.leverSoundPlayed = true;
        soundManager.playLeverPull();
        soundManager.playRopeCreak();
        soundManager.playScreamBurst();
      }

      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');

      // Hoist prisoner upward smoothly from deckH (1.05) -> 1.72 suspended mid-air
      const liftY = THREE.MathUtils.lerp(deckH, deckH + 0.68, t * t * (3 - 2 * t));
      victim.pos.set(nooseSpot.x, liftY, nooseSpot.z);
      victim.group.position.copy(victim.pos);

      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Guard B heavy lever-pull + hauling motion
      if (guardB.spineBone) guardB.spineBone.rotateX(0.45 - t * 0.65);
      setGuardCarryArms(guardB, 0.95);
      setGuardRaiseArms(guardB, Math.sin(t * Math.PI) * 0.7);

      // Victim begins kicking & grabbing neck immediately as lifted!
      setGuardRaiseArms(victim, 0.9);
      if (victim.upperLegL) victim.upperLegL.quaternion.slerp(this.kickFwdLegQuatL, t);
      if (victim.upperLegR) victim.upperLegR.quaternion.slerp(this.kickBackLegQuatR, t);

      village.setExecutionGallowsState({
        active: true,
        ropeTargetWorldY: liftY + victimNeckOffsetY,
        nooseTight: true,
        trapdoorOpen: Math.min(1, t * 2.2),
        leverPulled: Math.min(1, t * 2.0),
        swayZ: Math.sin(t * Math.PI * 2) * 0.05,
        swayX: 0,
      });

      syncBubble(true, 'آاااااه!! أنزلوني!! 😱', 20);

      if (ex.timer >= 1.45) {
        ex.phase = 'hanging_scream';
        ex.timer = 0;
        ex.nextScreamAt = 0.2;
      }
      return;
    }

    // --- PHASE 7: 20 SECONDS of violent thrashing, kicking & screaming before death ---
    if (ex.phase === 'hanging_scream') {
      const remainingSec = Math.max(1, Math.ceil(20.0 - ex.timer));
      const t = ex.timer;

      const panicPhrases = [
        'آاااااه!! النجدة!! 😱',
        'أغيثوني!! لا أستطيع التنفس!! 😫',
        'رحماك أيها السلطان!! 😭',
        'أنزلوني!! أموووت!! 😖',
      ];
      if (t >= ex.nextScreamAt) {
        soundManager.playScreamBurst();
        if (Math.random() < 0.45) soundManager.playRopeCreak();
        ex.nextScreamAt = t + 1.55 + Math.random() * 0.65;
        ex.screamPhraseIdx = (ex.screamPhraseIdx + 1) % panicPhrases.length;
      }

      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');

      // Suspended bob + rope pendulum sway
      const swayZ = Math.sin(t * 3.8) * 0.08 + Math.sin(t * 11.2) * 0.025;
      const swayX = Math.cos(t * 2.9) * 0.055;
      const baseLiftY = deckH + 0.68 + Math.sin(t * 9.0) * 0.028;
      victim.pos.set(nooseSpot.x + swayZ * 0.85, baseLiftY, nooseSpot.z + swayX * 0.85);
      victim.group.position.copy(victim.pos);
      victim.modelGroup.rotation.y = gRotY + Math.sin(t * 4.5) * 0.36;
      victim.modelGroup.rotation.z = swayZ * 1.1;

      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Strong violent thrashing skeletal animation on victim
      const kickPhase = Math.sin(t * 14.5) * 0.5 + 0.5;
      if (victim.upperLegL) {
        victim.upperLegL.quaternion.copy(this.kickBackLegQuatL).slerp(this.kickFwdLegQuatL, kickPhase);
      }
      if (victim.upperLegR) {
        victim.upperLegR.quaternion.copy(this.kickFwdLegQuatR).slerp(this.kickBackLegQuatR, kickPhase);
      }
      if (victim.lowerLegL) {
        victim.lowerLegL.quaternion.slerp(this.kickBentShinQuatL, 0.45 + Math.abs(Math.cos(t * 14.5)) * 0.55);
      }
      if (victim.lowerLegR) {
        victim.lowerLegR.quaternion.slerp(this.kickBentShinQuatR, 0.45 + Math.abs(Math.sin(t * 14.5)) * 0.55);
      }

      // Arms alternate frantically clutching neck & flailing outward
      const flail = Math.sin(t * 10.5) * 0.5 + 0.5;
      if (victim.upperArmL) {
        victim.upperArmL.quaternion.copy(victim.actionQuats.raiseUpperL).slerp(victim.actionQuats.carryUpperL, flail * 0.55);
      }
      if (victim.lowerArmL) {
        victim.lowerArmL.quaternion.copy(victim.actionQuats.raiseLowerL);
      }
      if (victim.upperArmR) {
        victim.upperArmR.quaternion.copy(victim.actionQuats.raiseUpperR).slerp(victim.actionQuats.carryUpperR, (1 - flail) * 0.55);
      }
      if (victim.lowerArmR) {
        victim.lowerArmR.quaternion.copy(victim.actionQuats.raiseLowerR);
      }

      // Torso & head thrash back and forth screaming
      if (victim.spineBone) {
        victim.spineBone.rotateX(-0.18 + Math.sin(t * 12) * 0.22);
        victim.spineBone.rotateZ(Math.cos(t * 9.5) * 0.16);
      }
      if (victim.chestBone) victim.chestBone.rotateX(Math.sin(t * 13) * 0.18);
      if (victim.headBone) {
        victim.headBone.rotateX(-0.32 + Math.sin(t * 10) * 0.2);
        victim.headBone.rotateY(Math.sin(t * 8.2) * 0.42);
      }

      // Guard B maintains firm grip holding hoist lever steady
      if (guardB.spineBone) guardB.spineBone.rotateX(0.28);
      setGuardCarryArms(guardB, 0.9);

      village.setExecutionGallowsState({
        active: true,
        ropeTargetWorldY: baseLiftY + victimNeckOffsetY,
        nooseTight: true,
        trapdoorOpen: 1,
        leverPulled: 1,
        swayZ,
        swayX,
      });

      syncBubble(true, panicPhrases[ex.screamPhraseIdx], remainingSec);

      if (ex.timer >= 20.0) {
        ex.phase = 'death_moment';
        ex.timer = 0;
        soundManager.playDeathThud();
      }
      return;
    }

    // --- PHASE 8: Death moment (body suddenly goes limp and silent) ---
    if (ex.phase === 'death_moment') {
      const t = Math.min(1, ex.timer / 1.5);
      const decay = 1 - t;
      const swayZ = Math.sin(ex.timer * 3.0) * 0.04 * decay;
      const hangY = deckH + 0.61;
      victim.pos.set(nooseSpot.x + swayZ * 0.7, hangY, nooseSpot.z);
      victim.group.position.copy(victim.pos);
      victim.modelGroup.rotation.y = gRotY;
      victim.modelGroup.rotation.z = swayZ;

      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Completely limp dead posture
      if (victim.spineBone) victim.spineBone.rotateX(0.32);
      if (victim.chestBone) victim.chestBone.rotateX(0.25);
      if (victim.headBone) victim.headBone.rotateX(0.65);
      if (victim.upperArmL) victim.upperArmL.quaternion.copy(victim.actionQuats.limpUpperL);
      if (victim.upperArmR) victim.upperArmR.quaternion.copy(victim.actionQuats.limpUpperR);
      if (victim.upperLegL) victim.upperLegL.quaternion.copy(this.limpLegQuatL);
      if (victim.upperLegR) victim.upperLegR.quaternion.copy(this.limpLegQuatR);

      village.setExecutionGallowsState({
        active: true,
        ropeTargetWorldY: hangY + victimNeckOffsetY,
        nooseTight: true,
        trapdoorOpen: 1,
        leverPulled: 1,
        swayZ,
        swayX: 0,
      });

      syncBubble(t < 0.85, '💀 فارق الحياة...', null);

      if (ex.timer >= 1.5) {
        ex.phase = 'lower_and_pickup';
        ex.timer = 0;
        syncBubble(false, '', null);
      }
      return;
    }

    // --- PHASE 9: Lower body, release rope, crouch & lift limp horizontal body onto arms ---
    if (ex.phase === 'lower_and_pickup') {
      const t = Math.min(1, ex.timer / 2.2);
      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, t < 0.75 ? 'idle' : 'walk');
      this.setCitizenAnim(guardB, t < 0.75 ? 'idle' : 'walk');

      if (t < 0.4) {
        // Lower rope onto closing trapdoor
        const subT = t / 0.4;
        const currY = THREE.MathUtils.lerp(deckH + 0.61, deckH, subT);
        victim.pos.set(nooseSpot.x, currY, nooseSpot.z);
        village.setExecutionGallowsState({
          active: true,
          ropeTargetWorldY: currY + victimNeckOffsetY,
          nooseTight: subT < 0.8,
          trapdoorOpen: 1 - subT,
          leverPulled: 1 - subT,
          swayZ: 0,
          swayX: 0,
        });
        guardA.pos.lerp(this.gallowsWorldPoint(village, -0.72, deckH, 0.04), delta * 6);
        guardB.pos.lerp(this.gallowsWorldPoint(village, 0.72, deckH, 0.04), delta * 6);
      } else if (t < 0.75) {
        // Guards crouch & scoop dead body horizontally across arms
        village.setExecutionGallowsState({ active: false });
        const subT = (t - 0.4) / 0.35;
        victim.pos.set(nooseSpot.x, THREE.MathUtils.lerp(deckH, deckH + 0.9, subT), nooseSpot.z);
        victim.modelGroup.rotation.x = subT * (Math.PI * 0.48);
        victim.shadowMesh.visible = false;

        guardA.pos.lerp(this.gallowsWorldPoint(village, -0.68, deckH, 0.04), delta * 8);
        guardB.pos.lerp(this.gallowsWorldPoint(village, 0.68, deckH, 0.04), delta * 8);
      } else {
        // Descend stairs holding horizontal body
        const subT = (t - 0.75) / 0.25;
        victim.pos.lerpVectors(
          new THREE.Vector3(nooseSpot.x, deckH + 0.9, nooseSpot.z),
          new THREE.Vector3(stairFoot.x, 0.92, stairFoot.z),
          subT
        );
        victim.modelGroup.rotation.x = Math.PI * 0.48;
        const downYaw = Math.atan2(stairFoot.x - nooseSpot.x, stairFoot.z - nooseSpot.z);
        this.turnTowards(victim, downYaw, 10, delta);
        this.turnTowards(guardA, downYaw, 10, delta);
        this.turnTowards(guardB, downYaw, 10, delta);

        const rightX = Math.cos(downYaw) * 0.68;
        const rightZ = -Math.sin(downYaw) * 0.68;
        const groundY = THREE.MathUtils.lerp(deckH, 0, subT);
        guardA.pos.set(victim.pos.x - rightX, groundY, victim.pos.z - rightZ);
        guardB.pos.set(victim.pos.x + rightX, groundY, victim.pos.z + rightZ);
      }

      victim.group.position.copy(victim.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Limp body
      if (victim.headBone) victim.headBone.rotateX(0.45);
      if (victim.upperArmL) victim.upperArmL.quaternion.copy(victim.actionQuats.limpUpperL);
      if (victim.upperArmR) victim.upperArmR.quaternion.copy(victim.actionQuats.limpUpperR);

      // Crouch & strong carry pose on guards
      if (t >= 0.4 && t < 0.75) {
        const crouchAmt = Math.sin(((t - 0.4) / 0.35) * Math.PI);
        if (guardA.spineBone) guardA.spineBone.rotateX(0.55 * crouchAmt);
        if (guardB.spineBone) guardB.spineBone.rotateX(0.55 * crouchAmt);
        if (guardA.upperLegL) guardA.upperLegL.quaternion.slerp(this.crouchThighQuatL, crouchAmt);
        if (guardA.upperLegR) guardA.upperLegR.quaternion.slerp(this.crouchThighQuatR, crouchAmt);
        if (guardB.upperLegL) guardB.upperLegL.quaternion.slerp(this.crouchThighQuatL, crouchAmt);
        if (guardB.upperLegR) guardB.upperLegR.quaternion.slerp(this.crouchThighQuatR, crouchAmt);
      }
      setGuardCarryArms(guardA, 1);
      setGuardCarryArms(guardB, 1);

      if (ex.timer >= 2.2) {
        ex.phase = 'carry_to_well';
        ex.timer = 0;
        ex.wellWaypointPassed = false;
      }
      return;
    }

    // --- PHASE 10: Guards carry the dead body together across plaza to the Royal Well ---
    if (ex.phase === 'carry_to_well') {
      const targetPt = !ex.wellWaypointPassed && victim.pos.z < -7.6 ? wellDetour : wellApproach;
      const rem = this.moveCharacterAlongPath(
        victim,
        victimIdx,
        targetPt.x,
        targetPt.z,
        3.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );

      if (!ex.wellWaypointPassed && targetPt === wellDetour && rem < 1.1) {
        ex.wellWaypointPassed = true;
      }

      victim.pos.y = 0.94 + Math.abs(Math.sin(ex.totalTime * 6.5)) * 0.03;
      victim.modelGroup.rotation.x = Math.PI * 0.48;

      const rightX = Math.cos(victim.facingAngle) * 0.68;
      const rightZ = -Math.sin(victim.facingAngle) * 0.68;
      guardA.pos.set(victim.pos.x - rightX, 0, victim.pos.z - rightZ);
      guardB.pos.set(victim.pos.x + rightX, 0, victim.pos.z + rightZ);
      this.turnTowards(guardA, victim.facingAngle, 10, delta);
      this.turnTowards(guardB, victim.facingAngle, 10, delta);

      this.setCitizenAnim(victim, 'idle');
      this.setCitizenAnim(guardA, 'walk');
      this.setCitizenAnim(guardB, 'walk');
      if (guardA.walkAction) guardA.walkAction.setEffectiveTimeScale(1.45);
      if (guardB.walkAction) guardB.walkAction.setEffectiveTimeScale(1.45);

      victim.group.position.copy(victim.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      // Limp dead victim + strong carrying arms on guards
      if (victim.headBone) victim.headBone.rotateX(0.45);
      if (victim.upperArmL) victim.upperArmL.quaternion.copy(victim.actionQuats.limpUpperL);
      if (victim.upperArmR) victim.upperArmR.quaternion.copy(victim.actionQuats.limpUpperR);
      setGuardCarryArms(guardA, 1);
      setGuardCarryArms(guardB, 1);

      if ((targetPt === wellApproach && rem < 0.45) || Math.hypot(victim.pos.x - wellApproach.x, victim.pos.z - wellApproach.z) < 0.55 || ex.timer > 14.0) {
        victim.pos.set(wellApproach.x, 0.96, wellApproach.z);
        guardA.pos.set(wellApproach.x - 0.68, 0, wellApproach.z);
        guardB.pos.set(wellApproach.x + 0.68, 0, wellApproach.z);
        ex.throwStartPos.copy(victim.pos);
        ex.phase = 'throw_into_well';
        ex.timer = 0;
        ex.splashTriggered = false;
      }
      return;
    }

    // --- PHASE 11: Power wind-up & throw body inside the Royal Well + BIG SPLASH ---
    if (ex.phase === 'throw_into_well') {
      const lookWell = Math.atan2(
        village.wellCenter.x - wellApproach.x,
        village.wellCenter.z - wellApproach.z
      );
      this.turnTowards(guardA, lookWell, 14, delta);
      this.turnTowards(guardB, lookWell, 14, delta);
      this.turnTowards(victim, lookWell, 14, delta);

      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      this.setCitizenAnim(victim, 'idle');

      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      victim.mixer.update(delta);

      const t = ex.timer;
      if (t < 0.55) {
        // Strong backward swing wind-up
        const w = t / 0.55;
        if (guardA.spineBone) guardA.spineBone.rotateX(-0.36 * w);
        if (guardB.spineBone) guardB.spineBone.rotateX(-0.36 * w);
        setGuardThrowBackArms(guardA);
        setGuardThrowBackArms(guardB);
        victim.pos.set(
          wellApproach.x,
          0.96 + w * 0.28,
          wellApproach.z + w * 0.42
        );
        victim.modelGroup.rotation.x = Math.PI * (0.48 - w * 0.14);
      } else if (t < 1.45) {
        // Powerful heave forward -> parabolic arc over stone lip directly into well water!
        const f = Math.min(1, (t - 0.55) / 0.9);
        const heaveDecay = Math.max(0, 1 - f * 1.4);
        if (guardA.spineBone) guardA.spineBone.rotateX(0.62 * heaveDecay);
        if (guardB.spineBone) guardB.spineBone.rotateX(0.62 * heaveDecay);
        setGuardRaiseArms(guardA, 1);
        setGuardRaiseArms(guardB, 1);

        const startX = ex.throwStartPos.x;
        const startZ = ex.throwStartPos.z + 0.42;
        const endX = village.wellCenter.x;
        const endZ = village.wellCenter.z;
        const arcY =
          THREE.MathUtils.lerp(1.24, village.wellWaterY, f) + Math.sin(f * Math.PI) * 1.65;
        victim.pos.set(
          THREE.MathUtils.lerp(startX, endX, f),
          arcY,
          THREE.MathUtils.lerp(startZ, endZ, f)
        );
        victim.modelGroup.rotation.x = Math.PI * (0.34 + f * 1.1);
      } else {
        // Impact water splash & sink beneath the shimmering surface!
        if (!ex.splashTriggered) {
          ex.splashTriggered = true;
          village.triggerWellSplash();
          soundManager.playWaterSplash();
        }
        const s = Math.min(1, (t - 1.45) / 0.75);
        victim.pos.set(
          village.wellCenter.x,
          THREE.MathUtils.lerp(village.wellWaterY, 0.15, s),
          village.wellCenter.z
        );
        victim.modelGroup.rotation.x = Math.PI * 1.44;
        setGuardCarryArms(guardA, Math.max(0, 1 - s));
        setGuardCarryArms(guardB, Math.max(0, 1 - s));
      }

      victim.group.position.copy(victim.pos);
      if (victim.upperArmL) victim.upperArmL.quaternion.copy(victim.actionQuats.limpUpperL);
      if (victim.upperArmR) victim.upperArmR.quaternion.copy(victim.actionQuats.limpUpperR);

      if (t >= 2.2) {
        // Permanently remove executed body from well bottom & dispose cleanly
        victim.mixer.stopAllAction();
        this.group.remove(victim.group);
        const rmIdx = this.citizens.indexOf(victim);
        if (rmIdx !== -1) this.citizens.splice(rmIdx, 1);
        ex.phase = 'return_salute';
        ex.timer = 0;
      }
      return;
    }

    // --- PHASE 12: Guards stand tall & salute Sultan before resuming duty ---
    if (ex.phase === 'return_salute') {
      const lookSultanA = Math.atan2(sultanPos.x - guardA.pos.x, sultanPos.z - guardA.pos.z);
      const lookSultanB = Math.atan2(sultanPos.x - guardB.pos.x, sultanPos.z - guardB.pos.z);
      this.turnTowards(guardA, lookSultanA, 10, delta);
      this.turnTowards(guardB, lookSultanB, 10, delta);
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      const bowEnv = Math.sin(Math.min(1, ex.timer / 0.75) * Math.PI);
      this.applyBowPose(guardA, bowEnv);
      this.applyBowPose(guardB, bowEnv);

      if (ex.timer >= 0.75) {
        this.execution = null;
        village.setExecutionGallowsState({ active: false });
        syncBubble(false, '', null);
      }
    }
  }

  private updateFeedLion(
    delta: number,
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    obstacles: ObstacleContext,
    village: KingdomVillage
  ) {
    const fl = this.feedLion;
    if (!fl) return;

    fl.timer += delta;
    const { victim, guardA, guardB } = fl;
    const guardAIdx = this.citizens.indexOf(guardA);
    const guardBIdx = this.citizens.indexOf(guardB);

    const setCarryArms = (g: CitizenEntity) => {
      if (g.upperArmL) g.upperArmL.quaternion.copy(g.actionQuats.carryUpperL);
      if (g.lowerArmL) g.lowerArmL.quaternion.copy(g.actionQuats.carryLowerL);
      if (g.upperArmR) g.upperArmR.quaternion.copy(g.actionQuats.carryUpperR);
      if (g.lowerArmR) g.lowerArmR.quaternion.copy(g.actionQuats.carryLowerR);
    };

    // 1. Guards rush straight to the citizen (ignoring bystander crowding so they never spin in circles)
    if (fl.phase === 'rush_to_target') {
      const remA = this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        victim.pos.x - 0.72,
        victim.pos.z + 0.2,
        7.2,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        false,
        true
      );
      const remB = this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        victim.pos.x + 0.72,
        victim.pos.z + 0.2,
        7.2,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true,
        true
      );
      this.setCitizenAnim(victim, 'idle');
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      victim.group.position.copy(victim.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      victim.mixer.update(delta);

      if ((remA < 0.85 && remB < 0.85) || fl.timer > 2.6) {
        guardA.pos.set(victim.pos.x - 0.65, victim.pos.y, victim.pos.z);
        guardB.pos.set(victim.pos.x + 0.65, victim.pos.y, victim.pos.z);
        fl.phase = 'grab_and_escort';
        fl.timer = 0;
        fl.totalEscortTime = 0;
        fl.escortStuckTimer = 0;
        fl.progressCheckTimer = 0;
        fl.escortLastPos.copy(victim.pos);
        fl.progressCheckPos.copy(victim.pos);
        soundManager.playScreamBurst();
      }
      return;
    }

    // 2. Both guards escort the whole citizen cleanly along clear waypoints to the Lion Cage door
    if (fl.phase === 'grab_and_escort') {
      const cage = village.lionCage;
      fl.totalEscortTime += delta;
      const finalStandX = cage ? cage.feedDoorStandPos.x : 13.5;
      const finalStandZ = cage ? cage.feedDoorStandPos.z : -23.1;
      const activeWp =
        fl.waypointIdx < fl.waypoints.length
          ? fl.waypoints[fl.waypointIdx]
          : ([finalStandX, finalStandZ] as [number, number]);
      const tx = activeWp[0];
      const tz = activeWp[1];

      const isFinalApproach =
        fl.waypointIdx >= fl.waypoints.length - 1 &&
        Math.hypot(guardA.pos.x - finalStandX, guardA.pos.z - finalStandZ) < 4.2;

      const rem = this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        tx,
        tz,
        5.5,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        isFinalApproach,
        true
      );

      // Keep Guard B flanking cleanly to Guard A's right side without pushing or orbiting Guard A
      const flankRightX = guardA.pos.x + Math.cos(guardA.facingAngle) * 1.05;
      const flankRightZ = guardA.pos.z - Math.sin(guardA.facingAngle) * 1.05;
      this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        flankRightX,
        flankRightZ,
        6.4,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true,
        true
      );
      guardB.pos.y = guardA.pos.y;

      // Whole citizen is carried/dragged smoothly between both guards
      victim.pos.set(
        (guardA.pos.x + guardB.pos.x) * 0.5,
        Math.max(guardA.pos.y, guardB.pos.y) + 0.14,
        (guardA.pos.z + guardB.pos.z) * 0.5
      );
      victim.facingAngle = guardA.facingAngle;
      victim.modelGroup.rotation.y = victim.facingAngle;
      victim.group.position.copy(victim.pos);
      this.setCitizenAnim(victim, 'walk');

      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      victim.mixer.update(delta);
      setCarryArms(guardA);
      setCarryArms(guardB);

      if (rem < 1.15 && fl.waypointIdx < fl.waypoints.length - 1) {
        fl.waypointIdx++;
      }

      // Sliding-window progress monitor prevents circular jitter from ever defeating stuck detection
      fl.progressCheckTimer += delta;
      let stalled = false;
      if (fl.progressCheckTimer >= 1.5) {
        const netMoved = fl.progressCheckPos.distanceTo(victim.pos);
        fl.progressCheckPos.copy(victim.pos);
        fl.progressCheckTimer = 0;
        if (netMoved < 0.75) {
          if (fl.waypointIdx < fl.waypoints.length - 1) {
            fl.waypointIdx++;
          } else {
            stalled = true;
          }
        }
      }

      const arrivedAtCage =
        fl.waypointIdx >= fl.waypoints.length - 1 &&
        Math.hypot(guardA.pos.x - finalStandX, guardA.pos.z - finalStandZ) < 1.1;

      if (arrivedAtCage || stalled || fl.totalEscortTime > 9.5) {
        if (cage) {
          guardA.pos.set(cage.feedDoorStandPos.x - 0.55, 0, cage.feedDoorStandPos.z);
          guardB.pos.set(cage.feedDoorStandPos.x + 0.55, 0, cage.feedDoorStandPos.z);
          victim.pos.set(cage.feedDoorStandPos.x, 0.12, cage.feedDoorStandPos.z);
          guardA.group.position.copy(guardA.pos);
          guardB.group.position.copy(guardB.pos);
          victim.group.position.copy(victim.pos);
          cage.setGateOpen(true);
        }
        fl.phase = 'toss_into_lion_cage';
        fl.timer = 0;
      }
      return;
    }

    // 3. Guards open cage gate and place the whole citizen inside the Lion Cage
    if (fl.phase === 'toss_into_lion_cage') {
      const cage = village.lionCage;
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      this.setCitizenAnim(victim, 'idle');

      if (cage) {
        const lookA = Math.atan2(cage.origin.x - guardA.pos.x, cage.origin.z - guardA.pos.z);
        const lookB = Math.atan2(cage.origin.x - guardB.pos.x, cage.origin.z - guardB.pos.z);
        this.turnTowards(guardA, lookA, 10, delta);
        this.turnTowards(guardB, lookB, 10, delta);
      }

      if (fl.timer >= 0.45 && cage) {
        const t = Math.min(1, (fl.timer - 0.45) / 0.75);
        const targetInterior = cage.getCageInteriorPos(_tmpTargetVec);
        victim.pos.set(
          THREE.MathUtils.lerp(cage.feedDoorStandPos.x, targetInterior.x, t),
          THREE.MathUtils.lerp(0.12, targetInterior.y, t),
          THREE.MathUtils.lerp(cage.feedDoorStandPos.z, targetInterior.z, t)
        );
        victim.group.position.copy(victim.pos);
      }

      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      victim.mixer.update(delta);

      if (fl.timer >= 1.25) {
        cage?.feedWholeCitizen();
        soundManager.playLionRoar();
        soundManager.playScreamBurst();
        fl.phase = 'lion_devour_and_lock';
        fl.timer = 0;
      }
      return;
    }

    // 4. Lion devours the entire citizen inside the cage (no corpse, no burial), then gate locks
    if (fl.phase === 'lion_devour_and_lock') {
      const cage = village.lionCage;
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      if (fl.timer < 1.35) {
        const eatProg = fl.timer / 1.35;
        const shrink = Math.max(0.01, 1 - eatProg);
        victim.modelGroup.scale.setScalar(shrink);
        victim.group.position.copy(victim.pos);
      } else if (!fl.tossedInCage) {
        fl.tossedInCage = true;
        victim.modelGroup.scale.setScalar(1);
        victim.isDead = true;
        victim.group.visible = false;
        victim.shadowMesh.visible = false;
      }

      if (!fl.gateLocked && fl.timer >= 2.0) {
        fl.gateLocked = true;
        cage?.setGateOpen(false);
      }

      if (fl.timer >= 2.75) {
        fl.phase = 'return_salute';
        fl.timer = 0;
      }
      return;
    }

    // 5. Guards salute the Sultan cleanly
    if (fl.phase === 'return_salute') {
      const lookSA = Math.atan2(sultanPos.x - guardA.pos.x, sultanPos.z - guardA.pos.z);
      const lookSB = Math.atan2(sultanPos.x - guardB.pos.x, sultanPos.z - guardB.pos.z);
      this.turnTowards(guardA, lookSA, 10, delta);
      this.turnTowards(guardB, lookSB, 10, delta);
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      const bowEnv = Math.sin(Math.min(1, fl.timer / 0.75) * Math.PI);
      this.applyBowPose(guardA, bowEnv);
      this.applyBowPose(guardB, bowEnv);

      if (fl.timer >= 0.75) {
        this.feedLion = null;
      }
    }
  }

  private updateImprisonment(
    delta: number,
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    obstacles: ObstacleContext,
    village: KingdomVillage,
    currentGameMinutes: number
  ) {
    const imp = this.imprisonment;
    const prison = village.prison;
    if (!imp || !prison) return;

    imp.timer += delta;
    imp.totalTime += delta;
    const { prisoner, guardA, guardB } = imp;
    const guardAIdx = this.citizens.indexOf(guardA);
    const guardBIdx = this.citizens.indexOf(guardB);
    const prisonerIdx = this.citizens.indexOf(prisoner);

    const setCarryArms = (g: CitizenEntity, blend: number = 1) => {
      if (g.upperArmL) g.upperArmL.quaternion.slerp(g.actionQuats.carryUpperL, blend);
      if (g.lowerArmL) g.lowerArmL.quaternion.slerp(g.actionQuats.carryLowerL, blend);
      if (g.upperArmR) g.upperArmR.quaternion.slerp(g.actionQuats.carryUpperR, blend);
      if (g.lowerArmR) g.lowerArmR.quaternion.slerp(g.actionQuats.carryLowerR, blend);
    };

    const setRaiseArms = (g: CitizenEntity, blend: number = 1) => {
      if (g.upperArmL) g.upperArmL.quaternion.slerp(g.actionQuats.raiseUpperL, blend);
      if (g.lowerArmL) g.lowerArmL.quaternion.slerp(g.actionQuats.raiseLowerL, blend);
      if (g.upperArmR) g.upperArmR.quaternion.slerp(g.actionQuats.raiseUpperR, blend);
      if (g.lowerArmR) g.lowerArmR.quaternion.slerp(g.actionQuats.raiseLowerR, blend);
    };

    const syncPrisonBubble = (show: boolean, text: string) => {
      if (!this.screamSprite) {
        this.updateScreamBubble(text, null);
      }
      if (!this.screamSprite) return;
      this.screamSprite.visible = show;
      if (show) {
        if (imp.lastBubbleText !== text) {
          imp.lastBubbleText = text;
          this.updateScreamBubble(text, null);
        }
        this.screamSprite.position.set(
          prisoner.pos.x,
          prisoner.pos.y + 1.48 * prisoner.scale,
          prisoner.pos.z
        );
      }
    };

    // --- PHASE 1: Rush to seize the citizen ---
    if (imp.phase === 'rush_to_target') {
      const lookSultan = Math.atan2(sultanPos.x - prisoner.pos.x, sultanPos.z - prisoner.pos.z);
      this.turnTowards(prisoner, lookSultan, 6.0, delta);
      this.setCitizenAnim(prisoner, 'idle');
      prisoner.group.position.copy(prisoner.pos);
      prisoner.mixer.update(delta);
      if (prisoner.spineBone) prisoner.spineBone.rotateX(-0.1);
      setRaiseArms(prisoner, 0.55);

      const rightX = Math.cos(prisoner.facingAngle) * 0.85;
      const rightZ = -Math.sin(prisoner.facingAngle) * 0.85;
      const remA = this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        prisoner.pos.x - rightX,
        prisoner.pos.z - rightZ,
        7.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );
      const remB = this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        prisoner.pos.x + rightX,
        prisoner.pos.z + rightZ,
        7.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );

      guardA.group.position.copy(guardA.pos);
      guardA.mixer.update(delta);
      guardB.group.position.copy(guardB.pos);
      guardB.mixer.update(delta);
      syncPrisonBubble(true, 'لا! أرجوكم لا تسجنوني! 😰');

      if ((remA < 0.6 && remB < 0.6) || imp.timer > 8.5) {
        guardA.pos.set(prisoner.pos.x - rightX * 0.88, 0, prisoner.pos.z - rightZ * 0.88);
        guardB.pos.set(prisoner.pos.x + rightX * 0.88, 0, prisoner.pos.z + rightZ * 0.88);
        imp.phase = 'grab_prisoner';
        imp.timer = 0;
        soundManager.playScreamBurst();
      }
      return;
    }

    // --- PHASE 2: Guards grip the prisoner ---
    if (imp.phase === 'grab_prisoner') {
      const lookPA = Math.atan2(prisoner.pos.x - guardA.pos.x, prisoner.pos.z - guardA.pos.z);
      const lookPB = Math.atan2(prisoner.pos.x - guardB.pos.x, prisoner.pos.z - guardB.pos.z);
      this.turnTowards(guardA, lookPA, 12.0, delta);
      this.turnTowards(guardB, lookPB, 12.0, delta);

      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      this.setCitizenAnim(prisoner, 'idle');
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      prisoner.group.position.copy(prisoner.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      prisoner.mixer.update(delta);

      if (guardA.spineBone) guardA.spineBone.rotateX(0.3);
      if (guardB.spineBone) guardB.spineBone.rotateX(0.3);
      setCarryArms(guardA, 1);
      setCarryArms(guardB, 1);
      setRaiseArms(prisoner, 0.85);
      syncPrisonBubble(true, 'اتركوني!! أين تأخذونني؟! ⛓️');

      if (imp.timer >= 1.15) {
        imp.phase = 'escort_to_prison';
        imp.timer = 0;
        imp.escortStuckTimer = 0;
        imp.escortLastPos.copy(prisoner.pos);
      }
      return;
    }

    // --- PHASE 3: Guards escort prisoner cleanly to the prison doorway ---
    if (imp.phase === 'escort_to_prison') {
      const doorApproach = prison.doorOutsidePos;
      const rem = this.moveCharacterAlongPath(
        prisoner,
        prisonerIdx,
        doorApproach.x,
        doorApproach.z,
        4.6,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary
      );

      const rightX = Math.cos(prisoner.facingAngle) * 0.92;
      const rightZ = -Math.sin(prisoner.facingAngle) * 0.92;
      this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        prisoner.pos.x - rightX,
        prisoner.pos.z - rightZ,
        5.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true
      );
      this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        prisoner.pos.x + rightX,
        prisoner.pos.z + rightZ,
        5.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true
      );

      prisoner.group.position.copy(prisoner.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      prisoner.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      setCarryArms(guardA, 0.72);
      setCarryArms(guardB, 0.72);

      syncPrisonBubble(true, 'إلى السجن الملكي... لاا! ⛓️');

      // Anti-stuck safeguard for distant arrests
      imp.escortStuckTimer += delta;
      if (imp.escortStuckTimer > 2.2) {
        const movedSq =
          (prisoner.pos.x - imp.escortLastPos.x) ** 2 +
          (prisoner.pos.z - imp.escortLastPos.z) ** 2;
        imp.escortLastPos.copy(prisoner.pos);
        imp.escortStuckTimer = 0;
        if (movedSq < 0.45) {
          prisoner.pos.lerp(doorApproach, 0.35);
          guardA.pos.set(prisoner.pos.x - rightX, 0, prisoner.pos.z - rightZ);
          guardB.pos.set(prisoner.pos.x + rightX, 0, prisoner.pos.z + rightZ);
        }
      }

      if (rem < 0.85 || imp.timer > 18.0) {
        prisoner.pos.copy(doorApproach);
        prison.setGuardDoorOpen(true);
        imp.phase = 'open_door_and_enter';
        imp.timer = 0;
      }
      return;
    }

    // --- PHASE 4: Iron prison door swings open & guards march prisoner inside cell ---
    if (imp.phase === 'open_door_and_enter') {
      prison.setGuardDoorOpen(true);
      const doorOpened = prison.getDoorOpenAmount() > 0.62 || imp.timer > 0.85;

      // Guard A steps slightly right holding the open door
      this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        prison.guardLockPos.x,
        prison.guardLockPos.z,
        4.2,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true
      );

      if (!doorOpened) {
        this.setCitizenAnim(prisoner, 'idle');
        this.setCitizenAnim(guardB, 'idle');
        const lookCell = Math.atan2(
          imp.cellSlot.x - prisoner.pos.x,
          imp.cellSlot.z - prisoner.pos.z
        );
        this.turnTowards(prisoner, lookCell, 9.0, delta);
        this.turnTowards(guardB, lookCell, 9.0, delta);
      } else {
        // March prisoner cleanly through the open doorway into their cell slot (skip wall OBB snagging)
        const remCell = this.moveCharacterAlongPath(
          prisoner,
          prisonerIdx,
          imp.cellSlot.x,
          imp.cellSlot.z,
          3.4,
          delta,
          sultanPos,
          obstacles,
          resolveCollision,
          enforceBoundary,
          true
        );
        const behindX = prison.doorThresholdPos.x;
        const behindZ = prison.doorThresholdPos.z;
        this.moveCharacterAlongPath(
          guardB,
          guardBIdx,
          behindX,
          behindZ,
          3.2,
          delta,
          sultanPos,
          obstacles,
          resolveCollision,
          enforceBoundary,
          true
        );

        if (remCell < 0.45 || imp.timer > 3.6) {
          prisoner.pos.copy(imp.cellSlot);
          prisoner.isImprisoned = true;
          prisoner.prisonSlotIndex = imp.slotIndex;
          prisoner.prisonSentenceMinutes = imp.sentenceMinutes;
          prisoner.prisonReleaseGameMinute = currentGameMinutes + imp.sentenceMinutes;
          this.pendingPrisonersMap[prisoner.id] = {
            slotIndex: imp.slotIndex,
            releaseGameMinute: prisoner.prisonReleaseGameMinute,
            sentenceMinutes: imp.sentenceMinutes,
          };
          this.recentPrisonEvent = {
            type: 'entered',
            citizenId: prisoner.id,
            labelAr: prisoner.displayNameAr,
            remainingMinutes: imp.sentenceMinutes,
          };
          this.imprisonedCount++;
          prison.lockDoorWithHold(6.0);
          imp.phase = 'lock_door';
          imp.timer = 0;
        }
      }

      prisoner.group.position.copy(prisoner.pos);
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      prisoner.mixer.update(delta);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      syncPrisonBubble(true, 'افتحوا لي الباب!! ⛓️');
      return;
    }

    // --- PHASE 5: Guard B steps back outside & slams/locks the prison door ---
    if (imp.phase === 'lock_door') {
      prison.setGuardDoorOpen(false);
      const lookDoor = Math.atan2(
        prison.doorThresholdPos.x - prisoner.pos.x,
        prison.doorThresholdPos.z - prisoner.pos.z
      );
      this.turnTowards(prisoner, lookDoor, 9.0, delta);
      this.setCitizenAnim(prisoner, 'idle');
      prisoner.group.position.copy(prisoner.pos);
      prisoner.mixer.update(delta);
      setRaiseArms(prisoner, 0.7);

      const exitA = prison.localToWorld(-1.1, 0, 4.0);
      const exitB = prison.localToWorld(1.1, 0, 4.0);
      this.moveCharacterAlongPath(
        guardA,
        guardAIdx,
        exitA.x,
        exitA.z,
        3.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true
      );
      this.moveCharacterAlongPath(
        guardB,
        guardBIdx,
        exitB.x,
        exitB.z,
        3.8,
        delta,
        sultanPos,
        obstacles,
        resolveCollision,
        enforceBoundary,
        true
      );
      guardA.group.position.copy(guardA.pos);
      guardB.group.position.copy(guardB.pos);
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);
      syncPrisonBubble(
        true,
        `المتبقي في السجن: ${formatRemainingPrisonTime(imp.sentenceMinutes, 2)} ⛓️`
      );

      if (imp.timer >= 1.4) {
        imp.phase = 'return_salute';
        imp.timer = 0;
        syncPrisonBubble(false, '');
      }
      return;
    }

    // --- PHASE 6: Guards face Sultan and bow respectfully ---
    if (imp.phase === 'return_salute') {
      const lookSultanA = Math.atan2(sultanPos.x - guardA.pos.x, sultanPos.z - guardA.pos.z);
      const lookSultanB = Math.atan2(sultanPos.x - guardB.pos.x, sultanPos.z - guardB.pos.z);
      this.turnTowards(guardA, lookSultanA, 10, delta);
      this.turnTowards(guardB, lookSultanB, 10, delta);
      this.setCitizenAnim(guardA, 'idle');
      this.setCitizenAnim(guardB, 'idle');
      guardA.mixer.update(delta);
      guardB.mixer.update(delta);

      const bowEnv = Math.sin(Math.min(1, imp.timer / 0.75) * Math.PI);
      this.applyBowPose(guardA, bowEnv);
      this.applyBowPose(guardB, bowEnv);

      if (imp.timer >= 0.75) {
        this.imprisonment = null;
        syncPrisonBubble(false, '');
      }
    }
  }
  public bowBodyguards() {
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (c.role === 'bodyguard' && !this.isExecutionParticipant(c)) {
        c.bowTimer = 2.15;
      }
    }
  }

  private applyBowPose(c: CitizenEntity, bowAmount: number) {
    if (bowAmount <= 0.001) return;
    if (c.spineBone) c.spineBone.rotateX(0.56 * bowAmount);
    if (c.chestBone) c.chestBone.rotateX(0.36 * bowAmount);
    if (c.headBone) c.headBone.rotateX(0.24 * bowAmount);
    if (c.upperArmL) c.upperArmL.rotateX(-0.22 * bowAmount);
    if (c.upperArmR) c.upperArmR.rotateX(-0.22 * bowAmount);
  }

  public disembarkBodyguardsFromBoat(
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    sea: RoyalSea
  ) {
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (c.role !== 'bodyguard') continue;
      sea.getGuardDisembarkPos(c.guardSide, sultanPos, c.pos);
      const supportY = resolveCollision(c.pos, 0.42);
      c.pos.y = Math.max(c.pos.y, supportY);
      enforceBoundary(c.pos);
      c.shadowMesh.visible = true;
      this.resetStandingLimbs(c);
      c.group.position.copy(c.pos);
    }
  }

  public disembarkBodyguardsFromCarriage(
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void
  ) {
    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (c.role !== 'bodyguard') continue;
      const sideSign = c.guardSide >= 0 ? 1 : -1;
      c.pos.set(sultanPos.x + sideSign * 1.15, 0, sultanPos.z + 0.9);
      const supportY = resolveCollision(c.pos, 0.42);
      c.pos.y = Math.max(0, supportY);
      enforceBoundary(c.pos);
      c.shadowMesh.visible = true;
      this.resetStandingLimbs(c);
      c.group.position.copy(c.pos);
    }
  }

  private lastUpdateDay: number = 0;

  public getPalaceDoorOpeners(): THREE.Vector3[] {
    return this.palaceDoorOpeners;
  }

  public getVizierInteractionState(sultanPos: THREE.Vector3): {
    isNearVizier: boolean;
    vizierPhase: CitizenEntity['vizierPhase'];
  } {
    const v = this.citizens.find((c) => c.isRoyalVizier);
    if (!v) return { isNearVizier: false, vizierPhase: 'sleeping' };
    const dist = Math.hypot(sultanPos.x - v.pos.x, sultanPos.z - v.pos.z);
    const isNearVizier =
      dist < 4.5 && v.vizierPhase !== 'sleeping' && v.vizierPhase !== 'returning';
    return { isNearVizier, vizierPhase: v.vizierPhase };
  }

  public dismissVizier(village: KingdomVillage): boolean {
    const v = this.citizens.find((c) => c.isRoyalVizier);
    const palace = village.palace;
    if (!v || !palace) return false;
    if (v.vizierPhase === 'sleeping' || v.vizierPhase === 'returning') return false;

    v.vizierDismissedBySultan = true;
    v.vizierLastMorningDay = this.lastUpdateDay;
    this.resetStandingLimbs(v);
    v.modelGroup.rotation.x = 0;
    v.modelGroup.rotation.z = 0;
    v.shadowMesh.visible = true;

    if (v.vizierPhase === 'seated' || v.vizierPhase === 'bowing') {
      v.pos.copy(palace.vizierBowSpot);
      v.vizierRouteIdx = 0;
    } else {
      // Pick the nearest waypoint along vizierReturnPath heading toward his office bed
      let bestIdx = 0;
      let bestD = Infinity;
      const route = palace.vizierReturnPath;
      for (let k = 0; k < route.length; k++) {
        const d = Math.hypot(v.pos.x - route[k][0], v.pos.z - route[k][1]);
        if (d < bestD) {
          bestD = d;
          bestIdx = k;
        }
      }
      v.vizierRouteIdx = Math.min(route.length - 1, bestIdx);
    }

    v.vizierPhase = 'returning';
    v.vizierPhaseTimer = 0;
    v.group.position.copy(v.pos);
    return true;
  }

  public update(
    delta: number,
    sultanPos: THREE.Vector3,
    sultanFacingAngle: number,
    sultanIsRiding: boolean,
    guardsFollowing: boolean,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void,
    obstacles: ObstacleContext,
    horseManager: HorseManager,
    village: KingdomVillage,
    sultanIsSailing: boolean = false,
    sea?: RoyalSea,
    mountedHorse: HorseEntity | null = null,
    isNight: boolean = false,
    currentGameMinutes: number = 480,
    isSultanOnPodium: boolean = false,
    isWarActive: boolean = false,
    performanceStrideBoost: boolean = false
  ) {
    this.elapsed += delta;
    if (this.feedLion) {
      this.updateFeedLion(delta, sultanPos, resolveCollision, enforceBoundary, obstacles, village);
    } else if (this.execution) {
      this.updateExecution(delta, sultanPos, resolveCollision, enforceBoundary, obstacles, village);
    } else if (this.imprisonment) {
      this.updateImprisonment(
        delta,
        sultanPos,
        resolveCollision,
        enforceBoundary,
        obstacles,
        village,
        currentGameMinutes
      );
    }

    // Assign up to 18 free citizens to gather & bow in front of the Royal Speech Podium while Sultan stands on it;
    // clears immediately when Sultan steps off the podium so everyone stops bowing and resumes normal life.
    this.speechAudienceIds.clear();
    if (isSultanOnPodium && village.speechPodium) {
      const podiumOrigin = village.speechPodium.origin;
      const eligible: { id: string; distSq: number }[] = [];
      for (let k = 0; k < this.citizens.length; k++) {
        const c = this.citizens[k];
        if (!c.group.visible || c.isDead || c.isImprisoned) continue;
        if (
          c.role === 'bodyguard' ||
          c.isArmoredGuard ||
          c.isBorderGuard ||
          c.isRoyalFamily ||
          c.isCafeNpc ||
          c.role === 'horse_rider' ||
          this.isExecutionParticipant(c)
        ) {
          continue;
        }
        const dSq =
          (c.pos.x - podiumOrigin.x) * (c.pos.x - podiumOrigin.x) +
          (c.pos.z - podiumOrigin.z) * (c.pos.z - podiumOrigin.z);
        if (dSq <= 42 * 42) {
          eligible.push({ id: c.id, distSq: dSq });
        }
      }
      eligible.sort((a, b) => a.distSq - b.distSq);
      const maxAudience = Math.min(18, eligible.length);
      for (let a = 0; a < maxAudience; a++) {
        this.speechAudienceIds.set(eligible[a].id, a);
      }
    }

    const borderStatus = this.getBorderGuardStatus(sultanPos);
    const speechSprite = this.borderSpeechSprite || (borderStatus.isNearRomanBorder ? this.ensureBorderSpeechSprite() : null);
    if (speechSprite) {
      if (borderStatus.isNearRomanBorder) {
        speechSprite.position.set(84.9, 3.05, 3.5);
        speechSprite.visible = true;
      } else {
        speechSprite.visible = false;
      }
    }
    const enteredBorderZone = borderStatus.isNearRomanBorder && !this.wasNearRomanBorder;
    this.wasNearRomanBorder = borderStatus.isNearRomanBorder;

    this.updateTickCount++;
    const tick = this.updateTickCount;
    const isSultanInCafe = village.cafe ? village.cafe.isSultanInside(sultanPos) : false;

    const currentDay = Math.floor(currentGameMinutes / 1440);
    this.lastUpdateDay = currentDay;
    const hourFloat = (currentGameMinutes % 1440) / 60;
    const isSultanaEvening = hourFloat >= 17.0 && hourFloat < 21.5;
    const isSultanaNightSleep = hourFloat >= 21.5 || hourFloat < 6.5;
    const isVizierMorningWindow = hourFloat >= 6.0 && hourFloat < 18.0;

    let sultanaEntity: CitizenEntity | null = null;
    let princeEntity: CitizenEntity | null = null;
    this.palaceDoorOpeners.length = 0;
    for (let k = 0; k < this.citizens.length; k++) {
      const candidate = this.citizens[k];
      if (candidate.isDead) continue;
      if (candidate.isRoyalSultana) {
        sultanaEntity = candidate;
        if (candidate.queenPhase !== 'sleeping') {
          this.palaceDoorOpeners.push(candidate.pos);
        }
      } else if (candidate.isRoyalVizier) {
        if (candidate.vizierPhase === 'arriving' || candidate.vizierPhase === 'returning') {
          this.palaceDoorOpeners.push(candidate.pos);
        }
      } else if (candidate.isCrownPrince) {
        princeEntity = candidate;
      }
    }
    const awakeSultana =
      sultanaEntity && sultanaEntity.queenPhase !== 'sleeping' ? sultanaEntity : null;

    for (let i = 0; i < this.citizens.length; i++) {
      const c = this.citizens[i];
      if (c.isDead) continue;
      if (this.isExecutionParticipant(c)) continue;

      // Apply pending saved prisoner state if loaded before model spawned
      const pendingPrison = this.pendingPrisonersMap[c.id];
      if (pendingPrison && !c.isImprisoned && village.prison) {
        if (pendingPrison.releaseGameMinute > currentGameMinutes) {
          if (c.ropeVisual) c.ropeVisual.setVisible(false);
          if (c.horse) {
            c.horse.ownerCitizenId = undefined;
            c.horse = null;
          }
          c.role = 'standing';
          c.isImprisoned = true;
          c.prisonSlotIndex = pendingPrison.slotIndex;
          c.prisonReleaseGameMinute = pendingPrison.releaseGameMinute;
          c.prisonSentenceMinutes = pendingPrison.sentenceMinutes;
          c.pos.copy(village.prison.getCellSlot(pendingPrison.slotIndex));
          c.group.position.copy(c.pos);
          this.imprisonedCount = Math.max(this.imprisonedCount, pendingPrison.slotIndex + 1);
        } else {
          delete this.pendingPrisonersMap[c.id];
        }
      }

      // Lazily pair horse_leader / horse_rider citizens with their owned horse
      if ((c.role === 'horse_leader' || c.role === 'horse_rider') && !c.horse) {
        const match = horseManager.horses.find((h) => h.ownerCitizenId === c.id) || null;
        if (match) c.horse = match;
      }

      const isGuard = c.role === 'bodyguard' || c.isArmoredGuard || c.isBorderGuard;
      const isImprisonParticipant =
        this.imprisonment !== null &&
        (this.imprisonment.prisoner === c ||
          this.imprisonment.guardA === c ||
          this.imprisonment.guardB === c);

      // Nighttime rule: regular villagers disappear until morning while guards, prisoners, indoor cafe NPCs & royal family stay
      if (
        isNight &&
        !isGuard &&
        !isImprisonParticipant &&
        !c.isImprisoned &&
        !c.isCafeNpc &&
        !c.isRoyalFamily
      ) {
        if (c.group.visible) {
          c.group.visible = false;
          c.shadowMesh.visible = false;
          c.ropeVisual?.setVisible(false);
        }
        if (c.horse && c.horse.group.visible) {
          c.horse.group.visible = false;
        }
        continue;
      }

      if (!c.group.visible) {
        c.group.visible = true;
        c.shadowMesh.visible =
          !(c.role === 'horse_rider' && !c.isDismountedForSultan) &&
          !(c.isCafeNpc && c.cafeKind === 'seated' && c.cafeStandUpBlend <= 0.25) &&
          !(c.isRoyalSultana && c.queenPhase === 'sleeping') &&
          !(c.isRoyalVizier && (c.vizierPhase === 'seated' || c.vizierPhase === 'sleeping'));
        if (c.role === 'horse_leader') {
          c.ropeVisual?.setVisible(true);
        }
      }
      if (c.horse && !c.horse.group.visible) {
        c.horse.group.visible = true;
      }

      c.accumDelta += delta;

      const speechSlotIdx = this.speechAudienceIds.get(c.id);
      // Distance-based staggered update for non-guard / non-royal / non-imprison-participant NPCs (full 60Hz near Sultan, inside cafe, or attending Royal Speech)
      if (
        c.role !== 'bodyguard' &&
        !isImprisonParticipant &&
        !c.isBorderGuard &&
        !c.isRoyalFamily &&
        !(c.isCafeNpc && isSultanInCafe) &&
        speechSlotIdx === undefined
      ) {
        const refX = c.role === 'horse_rider' && c.horse ? c.horse.pos.x : c.pos.x;
        const refZ = c.role === 'horse_rider' && c.horse ? c.horse.pos.z : c.pos.z;
        const dxDist = refX - sultanPos.x;
        const dzDist = refZ - sultanPos.z;
        const distSq = dxDist * dxDist + dzDist * dzDist;
        const farSq = performanceStrideBoost ? 34 * 34 : 42 * 42;
        const midSq = performanceStrideBoost ? 18 * 18 : 22 * 22;
        if (performanceStrideBoost && distSq > 54 * 54) {
          if (tick % 6 !== i % 6) continue;
        } else if (distSq > farSq) {
          if ((tick & 3) !== (i & 3)) continue;
        } else if (distSq > midSq) {
          if ((tick & 1) !== (i & 1)) continue;
        }
      } else if (c.isBorderGuard) {
        const dxDist = c.pos.x - sultanPos.x;
        const dzDist = c.pos.z - sultanPos.z;
        const borderSq = performanceStrideBoost ? 20 * 20 : 26 * 26;
        if (dxDist * dxDist + dzDist * dzDist > borderSq && (tick & 3) !== (i & 3)) {
          continue;
        }
      }

      const dt = Math.min(c.accumDelta, performanceStrideBoost ? 0.28 : 0.22);
      c.accumDelta = 0;

      // Continuously shift all outfit colors across the spectrum for the ONE rainbow character
      if (c.isRainbow) {
        c.rainbowPhase = (c.rainbowPhase + dt * 0.28) % 1.0;
        for (let m = 0; m < c.rainbowMats.length; m++) {
          const entry = c.rainbowMats[m];
          entry.mat.color.setHSL((c.rainbowPhase + entry.hueOffset) % 1.0, entry.sat, entry.light);
        }
      }

      // A0. Imprisoned Citizens (remain locked behind the barred prison gate with live countdown)
      if (c.isImprisoned && village.prison) {
        const remainingMins =
          c.prisonReleaseGameMinute > 0
            ? Math.max(0, c.prisonReleaseGameMinute - currentGameMinutes)
            : c.prisonSentenceMinutes;

        if (c.prisonReleaseGameMinute > 0 && remainingMins <= 0) {
          this.releasePrisonerInternal(c, village.prison);
          resolveCollision(c.pos, 0.44);
          enforceBoundary(c.pos);
        } else {
          const slot = village.prison.getCellSlot(c.prisonSlotIndex);
          c.pos.lerp(slot, Math.min(1, dt * 3));
          const lookGate = Math.atan2(
            village.prison.doorThresholdPos.x - c.pos.x,
            village.prison.doorThresholdPos.z - c.pos.z
          );
          this.turnTowards(c, lookGate, 4.5, dt);
          this.setCitizenAnim(c, 'idle');
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          this.updateCitizenPrisonLabel(c, remainingMins);
          continue;
        }
      } else if (c.prisonLabelSprite && c.prisonLabelSprite.visible) {
        c.prisonLabelSprite.visible = false;
      }

      // A0b. Active War Panic Flee ("و سكان يهربون"): regular citizens sprint to western refuges away from Roman Red Army
      if (isWarActive && !isGuard && !c.isImprisoned && !c.isRoyalFamily && !c.isCafeNpc) {
        if (c.role === 'horse_rider' && c.horse && !c.isDismountedForSultan) {
          c.isDismountedForSultan = true;
          c.pos.set(c.horse.pos.x + 1.1, 0, c.horse.pos.z + 0.6);
          resolveCollision(c.pos, 0.42);
        }
        c.shadowMesh.visible = true;
        c.bowTimer = 0;
        c.proximityBowBlend = 0;
        const zone = i % 3;
        const safeX =
          zone === 0
            ? -43 - (i % 4) * 2.2
            : zone === 1
            ? -34 - (i % 4) * 2.0
            : -36 - (i % 3) * 2.5;
        const safeZ =
          zone === 0
            ? -14 + (i % 5) * 6.5
            : zone === 1
            ? -52 + (i % 4) * 5.0
            : 54 + (i % 4) * 3.0;
        const dxF = safeX - c.pos.x;
        const dzF = safeZ - c.pos.z;
        const distF = Math.hypot(dxF, dzF);
        if (distF > 1.8) {
          this.setCitizenAnim(c, 'walk');
          if (c.walkAction) c.walkAction.setEffectiveTimeScale(1.85);
          this.moveCharacterAlongPath(
            c,
            i,
            safeX,
            safeZ,
            4.85,
            dt,
            sultanPos,
            obstacles,
            resolveCollision,
            enforceBoundary,
            true
          );
          c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 12 + i)) * 0.05;
        } else {
          this.turnTowards(c, -Math.PI * 0.5, 6.0, dt);
          this.setCitizenAnim(c, c.waveAction ? 'wave' : 'idle');
          c.modelGroup.position.y = 0;
        }
        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        continue;
      }

      // A1. Royal Cafe Owner & Patrons (seated patrons sit in chairs; when Sultan enters cafe, EVERYONE stands & bows!)
      if (c.isCafeNpc) {
        if (c.cafeKind === 'seated') {
          if (isSultanInCafe) {
            c.cafeStandUpBlend = Math.min(1.0, c.cafeStandUpBlend + dt * 2.8);
            if (c.cafeStandUpBlend > 0.45) {
              c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.6);
            }
          } else {
            c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 3.4);
            if (c.proximityBowBlend < 0.25) {
              c.cafeStandUpBlend = Math.max(0.0, c.cafeStandUpBlend - dt * 2.2);
            }
          }

          const standT =
            c.cafeStandUpBlend * c.cafeStandUpBlend * (3 - 2 * c.cafeStandUpBlend);
          c.pos.lerpVectors(c.cafeSeatPos, c.cafeStandPos, standT);

          const targetYaw = isSultanInCafe
            ? Math.atan2(sultanPos.x - c.pos.x, sultanPos.z - c.pos.z)
            : c.cafeSeatFacing;
          this.turnTowards(c, targetYaw, isSultanInCafe ? 9.5 : 7.0, dt);

          c.shadowMesh.visible = c.cafeStandUpBlend > 0.25;
          this.setCitizenAnim(c, 'idle');
          c.group.position.copy(c.pos);
          c.mixer.update(dt);

          const seatWeight = 1.0 - standT;
          if (seatWeight <= 0.005) {
            this.resetStandingLimbs(c);
          } else if (seatWeight >= 0.995) {
            if (c.spineBone) c.spineBone.rotateX(0.05);
            if (c.upperLegL) {
              c.upperLegL.position.set(0.093, -0.03, 0.03);
              c.upperLegL.quaternion.copy(this.boatUpperLegQuatL);
              c.upperLegL.scale.set(1.0, 1.12, 1.0);
            }
            if (c.lowerLegL) {
              c.lowerLegL.quaternion.copy(this.boatLowerLegQuatL);
              c.lowerLegL.scale.set(1.0, 1.05, 1.0);
            }
            if (c.upperLegR) {
              c.upperLegR.position.set(-0.093, -0.03, 0.03);
              c.upperLegR.quaternion.copy(this.boatUpperLegQuatR);
              c.upperLegR.scale.set(1.0, 1.12, 1.0);
            }
            if (c.lowerLegR) {
              c.lowerLegR.quaternion.copy(this.boatLowerLegQuatR);
              c.lowerLegR.scale.set(1.0, 1.05, 1.0);
            }
            if (c.upperArmL) c.upperArmL.quaternion.copy(c.actionQuats.benchUpperL);
            if (c.lowerArmL) c.lowerArmL.quaternion.copy(c.actionQuats.benchLowerL);
            if (c.upperArmR) c.upperArmR.quaternion.copy(c.actionQuats.benchUpperR);
            if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.actionQuats.benchLowerR);
            c.modelGroup.position.y = 0;
          } else {
            if (c.spineBone) c.spineBone.rotateX(0.05 * seatWeight);
            if (c.upperLegL) {
              c.upperLegL.position.set(
                THREE.MathUtils.lerp(0.078, 0.093, seatWeight),
                THREE.MathUtils.lerp(0, -0.03, seatWeight),
                THREE.MathUtils.lerp(0, 0.03, seatWeight)
              );
              c.upperLegL.quaternion.slerp(this.boatUpperLegQuatL, seatWeight);
              c.upperLegL.scale.set(1.0, THREE.MathUtils.lerp(1.0, 1.12, seatWeight), 1.0);
            }
            if (c.lowerLegL) {
              c.lowerLegL.quaternion.slerp(this.boatLowerLegQuatL, seatWeight);
              c.lowerLegL.scale.set(1.0, THREE.MathUtils.lerp(1.0, 1.05, seatWeight), 1.0);
            }
            if (c.upperLegR) {
              c.upperLegR.position.set(
                THREE.MathUtils.lerp(-0.078, -0.093, seatWeight),
                THREE.MathUtils.lerp(0, -0.03, seatWeight),
                THREE.MathUtils.lerp(0, 0.03, seatWeight)
              );
              c.upperLegR.quaternion.slerp(this.boatUpperLegQuatR, seatWeight);
              c.upperLegR.scale.set(1.0, THREE.MathUtils.lerp(1.0, 1.12, seatWeight), 1.0);
            }
            if (c.lowerLegR) {
              c.lowerLegR.quaternion.slerp(this.boatLowerLegQuatR, seatWeight);
              c.lowerLegR.scale.set(1.0, THREE.MathUtils.lerp(1.0, 1.05, seatWeight), 1.0);
            }
            if (c.upperArmL) c.upperArmL.quaternion.slerp(c.actionQuats.benchUpperL, seatWeight);
            if (c.lowerArmL) c.lowerArmL.quaternion.slerp(c.actionQuats.benchLowerL, seatWeight);
            if (c.upperArmR) c.upperArmR.quaternion.slerp(c.actionQuats.benchUpperR, seatWeight);
            if (c.lowerArmR) c.lowerArmR.quaternion.slerp(c.actionQuats.benchLowerR, seatWeight);
            c.modelGroup.position.y = 0;
          }

          if (c.proximityBowBlend > 0.001) {
            const smoothBow =
              c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
            this.applyBowPose(c, smoothBow);
          }
          continue;
        }

        // Cafe Owner & Standing Patrons inside the cafe
        if (isSultanInCafe) {
          c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.5);
          const lookAtSultan = Math.atan2(sultanPos.x - c.pos.x, sultanPos.z - c.pos.z);
          this.turnTowards(c, lookAtSultan, 9.5, dt);
        } else {
          c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
          if (c.proximityBowBlend < 0.08) {
            this.turnTowards(c, c.cafeHomeFacing, 6.5, dt);
          }
        }

        c.shadowMesh.visible = true;
        this.setCitizenAnim(c, 'idle');
        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        if (c.proximityBowBlend > 0.001) {
          const smoothBow =
            c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
          this.applyBowPose(c, smoothBow);
        }
        continue;
      }

      // A2. The Sultana ("السلطانة") — roams Palace hallways during the day, strolls outdoors in evening (17:00-21:30), sleeps at night; all who see her bow; NEVER bows to Sultan
      if (c.isRoyalSultana && village.palace) {
        const palace = village.palace;
        c.proximityBowBlend = 0;
        c.bowTimer = 0;

        if (c.queenPhase === 'sleeping') {
          c.pos.copy(palace.sultanaBedSleepPos);
          c.group.position.copy(c.pos);
          c.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
          c.modelGroup.position.y = 0;
          c.shadowMesh.visible = false;
          if (c.titleSprite) {
            c.titleSprite.position.y = 1.25;
          }
          this.setCitizenAnim(c, 'idle');
          c.mixer.update(dt * 0.42);
          this.resetStandingLimbs(c);

          if (!isSultanaNightSleep) {
            c.queenPhase = isSultanaEvening ? 'exiting' : 'palace_patrol';
            c.queenPhaseTimer = 0;
            c.queenRouteIdx = 0;
            c.pos.copy(palace.sultanaBedStandPos);
            c.facingAngle = 0;
            c.modelGroup.rotation.set(0, c.facingAngle, 0);
            c.shadowMesh.visible = true;
            if (c.titleSprite) {
              c.titleSprite.position.y = c.scale * 1.94;
            }
            c.stuckTimer = 0;
            c.lastProgressPos.copy(c.pos);
          }
          continue;
        }

        if (c.titleSprite) {
          c.titleSprite.position.y = c.scale * 1.94;
        }
        c.shadowMesh.visible = true;
        c.modelGroup.rotation.x = 0;
        c.modelGroup.rotation.z = 0;

        if (c.queenPhase === 'palace_patrol') {
          if (isSultanaNightSleep) {
            c.queenPhase = 'returning';
            c.queenRouteIdx = 3;
            c.queenPhaseTimer = 0;
          } else if (isSultanaEvening) {
            c.queenPhase = 'exiting';
            c.queenRouteIdx = 1;
            c.queenPhaseTimer = 0;
          } else {
            const pPath = palace.sultanaPalacePatrolPath;
            const pt = pPath[Math.min(c.queenRouteIdx, pPath.length - 1)];
            const dxS = sultanPos.x - c.pos.x;
            const dzS = sultanPos.z - c.pos.z;
            if (dxS * dxS + dzS * dzS < 3.0 * 3.0) {
              this.turnTowards(c, Math.atan2(dxS, dzS), 7.5, dt);
              this.setCitizenAnim(c, 'idle');
            } else {
              const dx = pt[0] - c.pos.x;
              const dz = pt[1] - c.pos.z;
              const dist = Math.hypot(dx, dz);
              if (dist < 0.55) {
                c.queenRouteIdx = (c.queenRouteIdx + 1) % pPath.length;
              } else {
                this.setCitizenAnim(c, 'walk');
                this.turnTowards(c, Math.atan2(dx, dz), 7.5, dt);
                const step = Math.min(dist, c.walkSpeed * 0.92 * dt);
                c.pos.x += Math.sin(c.facingAngle) * step;
                c.pos.z += Math.cos(c.facingAngle) * step;
                c.pos.y = 0.04;
              }
            }
          }
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        if (c.queenPhase === 'exiting' || c.queenPhase === 'returning') {
          const route =
            c.queenPhase === 'exiting' ? palace.sultanaExitPath : palace.sultanaReturnPath;
          const pt = route[Math.min(c.queenRouteIdx, route.length - 1)];
          const dx = pt[0] - c.pos.x;
          const dz = pt[1] - c.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.48) {
            c.queenRouteIdx++;
            if (c.queenRouteIdx >= route.length) {
              if (c.queenPhase === 'exiting') {
                c.queenPhase = 'strolling';
                c.queenPhaseTimer = 0;
                c.waypointIdx = 0;
                c.pauseTimer = 0;
                c.stuckTimer = 0;
                c.lastProgressPos.copy(c.pos);
              } else if (isSultanaNightSleep) {
                c.queenPhase = 'sleeping';
                c.queenPhaseTimer = 0;
                c.queenRouteIdx = 0;
                c.pos.copy(palace.sultanaBedSleepPos);
                c.group.position.copy(c.pos);
                c.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
                c.shadowMesh.visible = false;
                continue;
              } else {
                c.queenPhase = 'palace_patrol';
                c.queenRouteIdx = 0;
                c.queenPhaseTimer = 0;
              }
            }
          } else {
            this.setCitizenAnim(c, 'walk');
            const targetYaw = Math.atan2(dx, dz);
            this.turnTowards(c, targetYaw, 8.5, dt);
            const step = Math.min(dist, c.walkSpeed * 1.08 * dt);
            c.pos.x += Math.sin(c.facingAngle) * step;
            c.pos.z += Math.cos(c.facingAngle) * step;
            c.pos.y = 0.04;
            enforceBoundary(c.pos);
          }

          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        // 'strolling' outdoors
        const dxS = sultanPos.x - c.pos.x;
        const dzS = sultanPos.z - c.pos.z;
        const nearSultan = dxS * dxS + dzS * dzS < 3.4 * 3.4;

        if (!isSultanaEvening || isWarActive) {
          c.queenPhase = 'returning';
          c.queenPhaseTimer = 0;
          c.queenRouteIdx = 0;
          c.stuckTimer = 0;
          c.lastProgressPos.copy(c.pos);
        } else if (nearSultan) {
          this.turnTowards(c, Math.atan2(dxS, dzS), 7.5, dt);
          this.setCitizenAnim(c, 'idle');
        } else if (c.pauseTimer > 0) {
          c.pauseTimer -= dt;
          this.setCitizenAnim(c, 'idle');
        } else {
          const wp = c.waypoints[c.waypointIdx];
          const dx = wp[0] - c.pos.x;
          const dz = wp[1] - c.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 1.2) {
            c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            c.pauseTimer = 1.1;
            c.stuckTimer = 0;
          } else {
            this.setCitizenAnim(c, 'walk');
            const rawDesired = Math.atan2(dx, dz);
            const steerAngle = this.chooseClearSteerAngle(
              c.pos.x,
              c.pos.z,
              i,
              rawDesired,
              sultanPos,
              obstacles,
              undefined,
              0.72
            );
            this.turnTowards(c, steerAngle, 7.0, dt);
            const step = Math.min(dist, c.walkSpeed * dt);
            c.pos.x += Math.sin(c.facingAngle) * step;
            c.pos.z += Math.cos(c.facingAngle) * step;
            resolveCollision(c.pos, 0.36);
            enforceBoundary(c.pos);

            c.stuckTimer += dt;
            if (c.stuckTimer > 2.2) {
              const movedSq =
                (c.pos.x - c.lastProgressPos.x) ** 2 + (c.pos.z - c.lastProgressPos.z) ** 2;
              c.lastProgressPos.copy(c.pos);
              c.stuckTimer = 0;
              if (movedSq < 0.35) {
                c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
              }
            }
          }
        }

        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        continue;
      }

      // A4. The Grand Vizier ("الوزير") — sleeps in his room bed (wakes 60s after dismissal or next morning), bows ONCE to Throne, sits beside it, walks back through room door when dismissed or at night
      if (c.isRoyalVizier && village.palace) {
        const palace = village.palace;

        if (c.vizierPhase === 'sleeping') {
          c.pos.copy(palace.vizierSleepPos);
          c.group.position.copy(c.pos);
          c.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
          c.modelGroup.position.y = 0;
          c.shadowMesh.visible = false;
          this.setCitizenAnim(c, 'idle');
          c.mixer.update(dt * 0.42);
          this.resetStandingLimbs(c);

          if (c.vizierDismissedBySultan) {
            c.vizierPhaseTimer += dt;
          }
          const dismissReady = c.vizierDismissedBySultan && c.vizierPhaseTimer >= 60.0;
          const morningReady =
            !c.vizierDismissedBySultan &&
            isVizierMorningWindow &&
            c.vizierLastMorningDay !== currentDay;

          if (dismissReady || morningReady) {
            c.vizierLastMorningDay = currentDay;
            c.vizierDismissedBySultan = false;
            c.vizierPhase = 'arriving';
            c.vizierRouteIdx = 0;
            c.vizierPhaseTimer = 0;
            c.pos.copy(palace.vizierBedStandPos);
            c.facingAngle = -Math.PI / 2;
            c.modelGroup.rotation.set(0, c.facingAngle, 0);
            c.shadowMesh.visible = true;
          }
          continue;
        }

        c.modelGroup.rotation.x = 0;
        c.modelGroup.rotation.z = 0;

        if (c.vizierPhase === 'resting') {
          c.pos.copy(palace.vizierOfficePos);
          this.turnTowards(c, -Math.PI / 2, 6.0, dt);
          c.shadowMesh.visible = true;
          this.setCitizenAnim(c, 'idle');
          this.resetStandingLimbs(c);
          c.group.position.copy(c.pos);
          c.mixer.update(dt);

          if (isVizierMorningWindow && c.vizierLastMorningDay !== currentDay && !c.vizierDismissedBySultan) {
            c.vizierLastMorningDay = currentDay;
            c.vizierPhase = 'arriving';
            c.vizierRouteIdx = 0;
            c.vizierPhaseTimer = 0;
          }
          continue;
        }

        if (c.vizierPhase === 'arriving' || c.vizierPhase === 'returning') {
          const route =
            c.vizierPhase === 'arriving' ? palace.vizierArrivePath : palace.vizierReturnPath;
          const pt = route[Math.min(c.vizierRouteIdx, route.length - 1)];
          const dx = pt[0] - c.pos.x;
          const dz = pt[1] - c.pos.z;
          const dist = Math.hypot(dx, dz);

          c.shadowMesh.visible = true;
          this.resetStandingLimbs(c);

          if (dist < 0.42) {
            c.vizierRouteIdx++;
            if (c.vizierRouteIdx >= route.length) {
              if (c.vizierPhase === 'arriving') {
                c.pos.copy(palace.vizierBowSpot);
                c.vizierPhase = 'bowing';
                c.vizierPhaseTimer = 0;
              } else {
                c.vizierPhase = 'sleeping';
                c.vizierPhaseTimer = 0;
                c.vizierRouteIdx = 0;
                c.pos.copy(palace.vizierSleepPos);
                c.group.position.copy(c.pos);
                c.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
                c.shadowMesh.visible = false;
                continue;
              }
            }
          } else {
            this.setCitizenAnim(c, 'walk');
            const targetYaw = Math.atan2(dx, dz);
            this.turnTowards(c, targetYaw, 8.5, dt);
            const step = Math.min(dist, c.walkSpeed * 1.1 * dt);
            c.pos.x += Math.sin(c.facingAngle) * step;
            c.pos.z += Math.cos(c.facingAngle) * step;

            let targetStepY = 0.04;
            if (Math.abs(c.pos.x) < 4.5) {
              if (c.pos.z < -51.25) targetStepY = 0.4;
              else if (c.pos.z < -50.5) targetStepY = 0.3;
              else if (c.pos.z < -49.8) targetStepY = 0.2;
              else if (c.pos.z < -49.1) targetStepY = 0.1;
            }
            c.pos.y = THREE.MathUtils.damp(c.pos.y, targetStepY, 12.0, dt);
          }

          if (c.vizierPhase === 'arriving' && !isVizierMorningWindow) {
            c.vizierPhase = 'returning';
            c.vizierRouteIdx = Math.max(0, route.length - 1 - c.vizierRouteIdx);
          }

          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        if (c.vizierPhase === 'bowing') {
          c.vizierPhaseTimer += dt;
          c.pos.copy(palace.vizierBowSpot);
          const lookThrone = Math.atan2(0 - c.pos.x, -54.35 - c.pos.z);
          this.turnTowards(c, lookThrone, 10.0, dt);
          c.shadowMesh.visible = true;
          this.setCitizenAnim(c, 'idle');
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          this.resetStandingLimbs(c);

          const bowEnv = Math.sin(Math.min(1, c.vizierPhaseTimer / 2.0) * Math.PI);
          this.applyBowPose(c, bowEnv);

          if (c.vizierPhaseTimer >= 2.0) {
            c.vizierPhase = 'seated';
            c.vizierPhaseTimer = 0;
            c.pos.copy(palace.vizierSeatPos);
            c.facingAngle = 0;
            c.modelGroup.rotation.y = 0;
            c.shadowMesh.visible = false;
          }
          continue;
        }

        // 'seated' on Vizier Chair beside the Throne
        c.pos.copy(palace.vizierSeatPos);
        this.turnTowards(c, 0, 8.5, dt);
        c.shadowMesh.visible = false;
        this.setCitizenAnim(c, 'idle');
        c.group.position.copy(c.pos);
        c.mixer.update(dt);

        if (c.spineBone) c.spineBone.rotateX(0.05);
        if (c.upperLegL) {
          c.upperLegL.position.set(0.093, -0.03, 0.03);
          c.upperLegL.quaternion.copy(this.boatUpperLegQuatL);
          c.upperLegL.scale.set(1.0, 1.12, 1.0);
        }
        if (c.lowerLegL) {
          c.lowerLegL.quaternion.copy(this.boatLowerLegQuatL);
          c.lowerLegL.scale.set(1.0, 1.05, 1.0);
        }
        if (c.upperLegR) {
          c.upperLegR.position.set(-0.093, -0.03, 0.03);
          c.upperLegR.quaternion.copy(this.boatUpperLegQuatR);
          c.upperLegR.scale.set(1.0, 1.12, 1.0);
        }
        if (c.lowerLegR) {
          c.lowerLegR.quaternion.copy(this.boatLowerLegQuatR);
          c.lowerLegR.scale.set(1.0, 1.05, 1.0);
        }
        if (c.upperArmL) c.upperArmL.quaternion.copy(c.actionQuats.benchUpperL);
        if (c.lowerArmL) c.lowerArmL.quaternion.copy(c.actionQuats.benchLowerL);
        if (c.upperArmR) c.upperArmR.quaternion.copy(c.actionQuats.benchUpperR);
        if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.actionQuats.benchLowerR);
        c.modelGroup.position.y = 0;

        if (!isVizierMorningWindow) {
          this.resetStandingLimbs(c);
          c.pos.copy(palace.vizierBowSpot);
          c.shadowMesh.visible = true;
          c.vizierPhase = 'returning';
          c.vizierRouteIdx = 0;
          c.vizierPhaseTimer = 0;
        }
        continue;
      }

      // A. Mounted Horse-Riding Citizens (dismount immediately to ground & bow when Sultan or Sultana approaches!)
      if (c.role === 'horse_rider') {
        const h = c.horse;
        if (!h) {
          c.mixer.update(dt);
          continue;
        }

        const dxHorseS = sultanPos.x - h.pos.x;
        const dzHorseS = sultanPos.z - h.pos.z;
        const distHorseToSultan = Math.hypot(dxHorseS, dzHorseS);
        const distHorseToSultana = awakeSultana
          ? Math.hypot(awakeSultana.pos.x - h.pos.x, awakeSultana.pos.z - h.pos.z)
          : 999;

        // Immediately dismount onto the ground beside their horse when Sultan or Sultana gets near
        if (!c.isDismountedForSultan && (distHorseToSultan < 5.2 || distHorseToSultana < 5.2)) {
          c.isDismountedForSultan = true;
          c.shadowMesh.visible = true;

          const targetX = distHorseToSultana < distHorseToSultan && awakeSultana ? awakeSultana.pos.x - h.pos.x : dxHorseS;
          const targetZ = distHorseToSultana < distHorseToSultan && awakeSultana ? awakeSultana.pos.z - h.pos.z : dzHorseS;
          const rightX = Math.cos(h.facingAngle);
          const rightZ = -Math.sin(h.facingAngle);
          const sideSign = targetX * rightX + targetZ * rightZ >= 0 ? 1 : -1;

          c.pos.set(
            h.pos.x + rightX * (sideSign * 1.15),
            0,
            h.pos.z + rightZ * (sideSign * 1.15)
          );
          resolveCollision(c.pos, 0.44);
          enforceBoundary(c.pos);
          this.resetStandingLimbs(c);
        }

        if (c.isDismountedForSultan) {
          horseManager.animateHorse(h, dt, 0, true);

          const dxS = sultanPos.x - c.pos.x;
          const dzS = sultanPos.z - c.pos.z;
          const distRiderToSultan = Math.hypot(dxS, dzS);
          const dxSu = awakeSultana ? awakeSultana.pos.x - c.pos.x : 0;
          const dzSu = awakeSultana ? awakeSultana.pos.z - c.pos.z : 0;
          const distRiderToSultana = awakeSultana ? Math.hypot(dxSu, dzSu) : 999;

          if (distRiderToSultan < 5.6 || distRiderToSultana < 5.6) {
            c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.8);
          } else {
            c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
          }

          // Smoothly remount horse once Sultan & Sultana move well away and bow concludes
          if (
            distRiderToSultan > 6.6 &&
            distHorseToSultan > 6.4 &&
            distRiderToSultana > 6.6 &&
            distHorseToSultana > 6.4 &&
            c.proximityBowBlend <= 0.02
          ) {
            c.isDismountedForSultan = false;
            c.proximityBowBlend = 0;
            c.shadowMesh.visible = false;
          } else {
            const lookAtX = distRiderToSultana < distRiderToSultan && awakeSultana ? dxSu : dxS;
            const lookAtZ = distRiderToSultana < distRiderToSultan && awakeSultana ? dzSu : dzS;
            const lookAtTarget = Math.atan2(lookAtX, lookAtZ);
            let diff = lookAtTarget - c.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            c.facingAngle += diff * Math.min(1.0, dt * 9.5);
            c.modelGroup.rotation.y = c.facingAngle;

            this.setCitizenAnim(c, 'idle');
            c.group.position.copy(c.pos);
            c.mixer.update(dt);
            this.resetStandingLimbs(c);

            const smoothBow =
              c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
            this.applyBowPose(c, smoothBow);
            continue;
          }
        }

        let horseSpeed = 0;
        if (c.pauseTimer > 0) {
          c.pauseTimer -= dt;
        } else {
          const target = c.waypoints[c.waypointIdx];
          const dx = target[0] - h.pos.x;
          const dz = target[1] - h.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 1.65) {
            c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            c.pauseTimer = 1.2 + ((i * 0.55) % 2.0);
            c.stuckTimer = 0;
          } else {
            const rawDesired = Math.atan2(dx, dz);
            const steerAngle = this.chooseClearSteerAngle(
              h.pos.x,
              h.pos.z,
              i,
              rawDesired,
              sultanPos,
              obstacles,
              h.pos,
              0.92
            );

            let diff = steerAngle - h.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            h.facingAngle += diff * Math.min(1.0, dt * 5.2);

            horseSpeed = c.walkSpeed;
            const step = Math.min(dist, horseSpeed * dt);
            h.pos.x += Math.sin(h.facingAngle) * step;
            h.pos.z += Math.cos(h.facingAngle) * step;

            resolveCollision(h.pos, 0.85);
            enforceBoundary(h.pos);

            c.stuckTimer += dt;
            if (c.stuckTimer > 2.2) {
              const movedSq =
                (h.pos.x - c.lastProgressPos.x) ** 2 + (h.pos.z - c.lastProgressPos.z) ** 2;
              c.lastProgressPos.copy(h.pos);
              c.stuckTimer = 0;
              if (movedSq < 0.5) {
                c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
              }
            }
          }
        }

        horseManager.animateHorse(h, dt, horseSpeed, true);

        c.pos.set(
          h.pos.x - Math.sin(h.facingAngle) * 0.04,
          h.pos.y + 1.19,
          h.pos.z - Math.cos(h.facingAngle) * 0.04
        );
        c.facingAngle = h.facingAngle;
        c.modelGroup.rotation.y = c.facingAngle;
        c.group.position.copy(c.pos);

        this.setCitizenAnim(c, 'idle');
        c.mixer.update(dt);
        this.applySeatedHorsePose(c, dt, horseSpeed > 0.25);
        continue;
      }

      // B0. Royal Bodyguards (sit and row oars on the boat while sailing; otherwise flank Sultan & bow)
      if (c.role === 'bodyguard') {
        if (sultanIsSailing && sea) {
          c.bowTimer = 0;
          c.proximityBowBlend = 0;
          c.shadowMesh.visible = false;

          const rowPose = sea.getGuardRowPose(c.guardSide, c.pos);
          c.facingAngle = rowPose.facingAngle;
          c.modelGroup.rotation.y = c.facingAngle;
          c.group.position.copy(c.pos);

          this.setCitizenAnim(c, 'idle');
          c.mixer.update(dt);

          // Seated bench posture with knees bent onto boat deck
          if (c.upperLegL) {
            c.upperLegL.position.set(0.078 + 0.015, -0.03, 0.03);
            c.upperLegL.quaternion.copy(this.boatUpperLegQuatL);
            c.upperLegL.scale.set(1.0, 1.12, 1.0);
          }
          if (c.lowerLegL) {
            c.lowerLegL.quaternion.copy(this.boatLowerLegQuatL);
            c.lowerLegL.scale.set(1.0, 1.05, 1.0);
          }
          if (c.upperLegR) {
            c.upperLegR.position.set(-0.078 - 0.015, -0.03, 0.03);
            c.upperLegR.quaternion.copy(this.boatUpperLegQuatR);
            c.upperLegR.scale.set(1.0, 1.12, 1.0);
          }
          if (c.lowerLegR) {
            c.lowerLegR.quaternion.copy(this.boatLowerLegQuatR);
            c.lowerLegR.scale.set(1.0, 1.05, 1.0);
          }

          // Synchronized rowing lean & dual-arm stroke matching the wooden oars
          const strokeWeight = THREE.MathUtils.lerp(
            0.58,
            0.5 + 0.5 * rowPose.rowCos,
            rowPose.rowBlend
          );
          const torsoLean = THREE.MathUtils.lerp(
            0.08,
            rowPose.rowCos * 0.28,
            rowPose.rowBlend
          );
          if (c.spineBone) c.spineBone.rotateX(0.05 + torsoLean * 0.65);
          if (c.chestBone) c.chestBone.rotateX(torsoLean * 0.45);

          const dipAdjust = rowPose.rowDip * 0.12 * rowPose.rowBlend;
          if (c.upperArmL) {
            c.upperArmL.quaternion
              .copy(c.actionQuats.rowPullUpperL)
              .slerp(c.actionQuats.rowCatchUpperL, strokeWeight);
            c.upperArmL.rotateX(dipAdjust);
          }
          if (c.lowerArmL) {
            c.lowerArmL.quaternion
              .copy(c.actionQuats.rowPullLowerL)
              .slerp(c.actionQuats.rowCatchLowerL, strokeWeight);
          }
          if (c.upperArmR) {
            c.upperArmR.quaternion
              .copy(c.actionQuats.rowPullUpperR)
              .slerp(c.actionQuats.rowCatchUpperR, strokeWeight);
            c.upperArmR.rotateX(dipAdjust);
          }
          if (c.lowerArmR) {
            c.lowerArmR.quaternion
              .copy(c.actionQuats.rowPullLowerR)
              .slerp(c.actionQuats.rowCatchLowerR, strokeWeight);
          }
          continue;
        }

        if (mountedHorse && mountedHorse.hasCarriage) {
          c.bowTimer = 0;
          c.proximityBowBlend = 0;
          c.shadowMesh.visible = false;

          const isDriver = c.guardSide >= 0;
          horseManager.getCarriageSlotWorldPos(
            mountedHorse,
            isDriver ? 'driver' : 'companion',
            c.pos
          );
          c.facingAngle = mountedHorse.facingAngle;
          c.modelGroup.rotation.y = c.facingAngle;
          c.group.position.copy(c.pos);

          this.setCitizenAnim(c, 'idle');
          c.mixer.update(dt);

          if (isDriver && mountedHorse.carriageDriverOnHorse) {
            this.applySeatedHorsePose(c, dt, true);
          } else {
            if (c.spineBone) c.spineBone.rotateX(0.05);
            if (c.upperLegL) {
              c.upperLegL.position.set(0.078 + 0.015, -0.03, 0.03);
              c.upperLegL.quaternion.copy(this.boatUpperLegQuatL);
              c.upperLegL.scale.set(1.0, 1.12, 1.0);
            }
            if (c.lowerLegL) {
              c.lowerLegL.quaternion.copy(this.boatLowerLegQuatL);
              c.lowerLegL.scale.set(1.0, 1.05, 1.0);
            }
            if (c.upperLegR) {
              c.upperLegR.position.set(-0.078 - 0.015, -0.03, 0.03);
              c.upperLegR.quaternion.copy(this.boatUpperLegQuatR);
              c.upperLegR.scale.set(1.0, 1.12, 1.0);
            }
            if (c.lowerLegR) {
              c.lowerLegR.quaternion.copy(this.boatLowerLegQuatR);
              c.lowerLegR.scale.set(1.0, 1.05, 1.0);
            }

            if (isDriver) {
              // Front coachman guard holds the carriage reins forward
              if (c.upperArmL) c.upperArmL.quaternion.copy(c.rideUpperArmQuatL);
              if (c.lowerArmL) c.lowerArmL.quaternion.copy(c.rideLowerArmQuatL);
              if (c.upperArmR) c.upperArmR.quaternion.copy(c.rideUpperArmQuatR);
              if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.rideLowerArmQuatR);
            } else {
              // Companion guard sits calmly next to the King in the back seat
              if (c.upperArmL) c.upperArmL.quaternion.copy(c.actionQuats.benchUpperL);
              if (c.lowerArmL) c.lowerArmL.quaternion.copy(c.actionQuats.benchLowerL);
              if (c.upperArmR) c.upperArmR.quaternion.copy(c.actionQuats.benchUpperR);
              if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.actionQuats.benchLowerR);
            }
            c.modelGroup.position.y = 0;
          }
          continue;
        }

        if (!c.shadowMesh.visible) {
          c.shadowMesh.visible = true;
          this.resetStandingLimbs(c);
        }

        const dxS = sultanPos.x - c.pos.x;
        const dzS = sultanPos.z - c.pos.z;
        const distToSultan = Math.hypot(dxS, dzS);

        let manualBow = 0;
        if (c.bowTimer > 0) {
          c.bowTimer = Math.max(0, c.bowTimer - dt);
          const elapsed = 2.15 - c.bowTimer;
          let bowAmount = 1.0;
          if (elapsed < 0.42) {
            bowAmount = elapsed / 0.42;
          } else if (c.bowTimer < 0.52) {
            bowAmount = c.bowTimer / 0.52;
          }
          manualBow = bowAmount * bowAmount * (3 - 2 * bowAmount);
        }

        const protectActive = this.guardsProtectMode || isWarActive;

        if (!guardsFollowing && !protectActive) {
          if (distToSultan > 5.8) c.wasFarFromSultan = true;
          if (distToSultan < 4.6 && c.wasFarFromSultan) {
            c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.8);
          } else if (distToSultan > 5.4) {
            c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
          }
        } else {
          c.wasFarFromSultan = false;
          c.proximityBowBlend = 0;
        }

        const proxBow =
          c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
        const totalBow = Math.max(manualBow, proxBow);

        if (c.bowTimer > 0 || totalBow > 0.01) {
          const lookAtSultan = Math.atan2(dxS, dzS);
          let diff = lookAtSultan - c.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.facingAngle += diff * Math.min(1.0, dt * 9.0);
          c.modelGroup.rotation.y = c.facingAngle;

          this.setCitizenAnim(c, 'idle');
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          this.applyBowPose(c, totalBow);
          continue;
        }

        if (!guardsFollowing && !protectActive) {
          const lookAtSultan = Math.atan2(dxS, dzS);
          let diff = lookAtSultan - c.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.facingAngle += diff * Math.min(1.0, dt * 5.0);
          c.modelGroup.rotation.y = c.facingAngle;

          this.setCitizenAnim(c, 'idle');
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        // Protection Mode ("حماية"): one guard stands directly in front of Sultan, the other behind Sultan
        // Otherwise standard escort flanking slots on right/left side
        let targetX: number;
        let targetZ: number;
        let idleFacing = sultanFacingAngle;
        if (protectActive) {
          const isFrontGuard = c.guardSide < 0;
          const protectOffset = (isFrontGuard ? 1 : -1) * (sultanIsRiding ? 2.35 : 1.75);
          targetX = sultanPos.x + Math.sin(sultanFacingAngle) * protectOffset;
          targetZ = sultanPos.z + Math.cos(sultanFacingAngle) * protectOffset;
          idleFacing = isFrontGuard ? sultanFacingAngle : sultanFacingAngle + Math.PI;
        } else {
          const sideDist = sultanIsRiding ? 2.1 : 1.55;
          const backDist = sultanIsRiding ? 0.95 : 0.42;
          targetX =
            sultanPos.x +
            Math.cos(sultanFacingAngle) * (c.guardSide * sideDist) -
            Math.sin(sultanFacingAngle) * backDist;
          targetZ =
            sultanPos.z -
            Math.sin(sultanFacingAngle) * (c.guardSide * sideDist) -
            Math.cos(sultanFacingAngle) * backDist;
        }

        const dx = targetX - c.pos.x;
        const dz = targetZ - c.pos.z;
        const dist = Math.hypot(dx, dz);
        const floorDiff = Math.abs(sultanPos.y - c.pos.y);

        if (dist > 28.0 || (floorDiff > 2.4 && dist > 6.5)) {
          c.pos.set(targetX, sultanPos.y, targetZ);
          c.pos.y = resolveCollision(c.pos, 0.44);
          enforceBoundary(c.pos);
        }

        if (dist > 0.42) {
          this.setCitizenAnim(c, 'walk');
          const rawDesired = Math.atan2(dx, dz);
          const steerAngle =
            dist > 2.2
              ? this.chooseClearSteerAngle(
                  c.pos.x,
                  c.pos.z,
                  i,
                  rawDesired,
                  sultanPos,
                  obstacles,
                  undefined,
                  0.66
                )
              : rawDesired;

          let diff = steerAngle - c.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.facingAngle += diff * Math.min(1.0, dt * 8.5);
          c.modelGroup.rotation.y = c.facingAngle;

          const moveSpeed =
            dist > 7.0
              ? sultanIsRiding
                ? 11.8
                : 9.0
              : dist > 2.5
              ? sultanIsRiding
                ? 8.5
                : 5.8
              : 4.55;

          if (c.walkAction) {
            c.walkAction.setEffectiveTimeScale(Math.min(2.6, Math.max(1.0, moveSpeed / 2.3)));
          }

          const step = Math.min(dist, moveSpeed * dt);
          c.pos.x += Math.sin(c.facingAngle) * step;
          c.pos.z += Math.cos(c.facingAngle) * step;

          c.pos.y = resolveCollision(c.pos, 0.42);
          enforceBoundary(c.pos);
        } else {
          this.setCitizenAnim(c, 'idle');
          let diff = idleFacing - c.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.facingAngle += diff * Math.min(1.0, dt * 6.5);
          c.modelGroup.rotation.y = c.facingAngle;
        }

        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        continue;
      }

      // B1. Roman Border Gate Guards (face Sultan firmly, raise respectful halt gesture, never bow submissively)
      if (c.isBorderGuard) {
        const dxS = sultanPos.x - c.pos.x;
        const dzS = sultanPos.z - c.pos.z;
        const targetYaw = borderStatus.isNearRomanBorder ? Math.atan2(dxS, dzS) : c.homeRotY;
        this.turnTowards(c, targetYaw, 7.5, dt);

        if (enteredBorderZone && c.waveAction) {
          this.setCitizenAnim(c, 'wave');
          c.bowTimer = 1.6;
        } else if (c.bowTimer > 0) {
          c.bowTimer = Math.max(0, c.bowTimer - dt);
          if (c.bowTimer <= 0) {
            this.setCitizenAnim(c, 'idle');
          }
        } else {
          this.setCitizenAnim(c, 'idle');
        }

        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        if (borderStatus.isNearRomanBorder) {
          this.applyBowPose(c, 0.16); // Slight respectful nod while holding the line
        }
        continue;
      }

      // B1b. Royal Speech Podium Audience — gather & bow in semicircle before Sultan while on podium, disperse immediately when Sultan leaves
      if (speechSlotIdx !== undefined && village.speechPodium) {
        const slot = village.speechPodium.getAudienceSlot(
          speechSlotIdx,
          this.speechAudienceIds.size,
          _tmpTargetVec
        );
        const rem = Math.hypot(slot.x - c.pos.x, slot.z - c.pos.z);
        if (rem > 0.52) {
          c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 3.5);
          const speed = Math.max(c.walkSpeed * 1.25, 2.75);
          this.moveCharacterAlongPath(
            c,
            i,
            slot.x,
            slot.z,
            speed,
            dt,
            sultanPos,
            obstacles,
            resolveCollision,
            enforceBoundary,
            true
          );
          if (c.walkAction) {
            c.walkAction.setEffectiveTimeScale(Math.min(2.1, speed / 1.8));
          }
        } else {
          const lookPodium = Math.atan2(
            village.speechPodium.origin.x - c.pos.x,
            village.speechPodium.origin.z - c.pos.z
          );
          this.turnTowards(c, lookPodium, 8.5, dt);
          this.setCitizenAnim(c, 'idle');
          c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.5);
        }
        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        if (c.proximityBowBlend > 0.001) {
          const smoothBow =
            c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
          this.applyBowPose(c, smoothBow);
        }
        if (c.role === 'horse_leader' && c.horse) {
          if (c.upperArmR) c.upperArmR.quaternion.copy(c.leadUpperArmQuatR);
          if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.leadLowerArmQuatR);
          horseManager.updateLedHorseFollow(
            c.horse,
            c.pos,
            c.walkSpeed * 1.15,
            dt,
            resolveCollision,
            enforceBoundary
          );
          if (c.ropeVisual) {
            c.group.updateMatrixWorld(true);
            c.horse.group.updateMatrixWorld(true);
            if (c.handAnchorR) {
              c.handAnchorR.getWorldPosition(_handWorldPos);
            } else {
              _handWorldPos.set(c.pos.x - 0.35, 0.9, c.pos.z);
            }
            c.horse.halterAnchor.getWorldPosition(_halterWorldPos);
            c.ropeVisual.updateEndpoints(_handWorldPos, _halterWorldPos);
          }
        }
        continue;
      }

      // B. Standing Citizens, Armored Watch Guards, Palace Guards & Merchants
      //    (bow to Sultan, anyone seeing the Sultana, or anyone approached by the Crown Prince)
      if (c.role !== 'walker' && c.role !== 'horse_leader' && c.role !== 'child') {
        const dxS = sultanPos.x - c.pos.x;
        const dzS = sultanPos.z - c.pos.z;
        const dyS = sultanPos.y - c.pos.y;
        const distSqToSultan = dxS * dxS + dzS * dzS;
        const nearSultan = distSqToSultan < 4.8 * 4.8 && Math.abs(dyS) < 2.2;

        let seesSultana = false;
        let qDx = 0;
        let qDz = 0;
        if (awakeSultana) {
          qDx = awakeSultana.pos.x - c.pos.x;
          qDz = awakeSultana.pos.z - c.pos.z;
          const distToQ = Math.hypot(qDx, qDz);
          if (distToQ < 5.2) {
            seesSultana = true;
          } else if (distToQ < 12.5) {
            const fwdX = Math.sin(c.facingAngle);
            const fwdZ = Math.cos(c.facingAngle);
            if ((fwdX * qDx + fwdZ * qDz) / Math.max(0.01, distToQ) > 0.16) {
              seesSultana = true;
            }
          }
        }

        let nearPrince = false;
        let pDx = 0;
        let pDz = 0;
        if (princeEntity) {
          pDx = princeEntity.pos.x - c.pos.x;
          pDz = princeEntity.pos.z - c.pos.z;
          nearPrince = pDx * pDx + pDz * pDz < 4.8 * 4.8;
        }

        const shouldBow = nearSultan || seesSultana || nearPrince;
        if (shouldBow) {
          c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.8);
        } else if (c.proximityBowBlend > 0) {
          c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
        }

        let targetYaw = c.homeRotY;
        if (nearSultan) {
          targetYaw = Math.atan2(dxS, dzS);
        } else if (seesSultana) {
          targetYaw = Math.atan2(qDx, qDz);
        } else if (nearPrince) {
          targetYaw = Math.atan2(pDx, pDz);
        } else if (c.proximityBowBlend > 0.05) {
          targetYaw = c.facingAngle;
        }

        let diff = targetYaw - c.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > 0.002) {
          c.facingAngle += diff * Math.min(1.0, dt * 8.5);
          c.modelGroup.rotation.y = c.facingAngle;
        }

        c.pos.y = c.homeY;
        this.setCitizenAnim(c, 'idle');
        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        if (c.proximityBowBlend > 0.001) {
          const smoothBow = c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
          this.applyBowPose(c, smoothBow);
        }
        continue;
      }

      // B2. Crown Prince ("الأمير الصغير") accompanies & roams alongside his mother the Sultana wherever she goes
      if (c.role === 'child') {
        const dxS = sultanPos.x - c.pos.x;
        const dzS = sultanPos.z - c.pos.z;
        const distToSultan = Math.hypot(dxS, dzS);

        if (c.isCrownPrince && village.palace) {
          const bounds = village.palace.bedroomBounds;
          c.shadowMesh.visible = true;

          const isSultanNear = distToSultan < 3.8 && Math.abs(sultanPos.y - c.pos.y) < 2.2;
          if (isSultanNear) {
            c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 5.0);
          } else if (c.proximityBowBlend > 0) {
            c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
          }

          if (c.proximityBowBlend > 0.015) {
            this.turnTowards(c, Math.atan2(dxS, dzS), 9.0, dt);
            this.setCitizenAnim(c, 'idle');
            c.modelGroup.position.y = 0;
            c.group.position.copy(c.pos);
            c.mixer.update(dt);
            const smoothBow =
              c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
            this.applyBowPose(c, smoothBow);
            continue;
          }

          if (awakeSultana) {
            // Walk cheerfully alongside the Sultana wherever she roams (Palace halls or outdoors!)
            const followX = awakeSultana.pos.x + Math.cos(awakeSultana.facingAngle) * 1.05;
            const followZ = awakeSultana.pos.z - Math.sin(awakeSultana.facingAngle) * 1.05;
            const dxM = followX - c.pos.x;
            const dzM = followZ - c.pos.z;
            const distM = Math.hypot(dxM, dzM);

            if (distM > 0.6) {
              this.setCitizenAnim(c, 'walk');
              const speedP = distM > 3.2 ? 3.2 : c.walkSpeed * 1.25;
              if (c.walkAction) {
                c.walkAction.setEffectiveTimeScale(Math.min(1.9, speedP / 1.55));
              }
              this.turnTowards(c, Math.atan2(dxM, dzM), 9.0, dt);
              const step = Math.min(distM, speedP * dt);
              c.pos.x += Math.sin(c.facingAngle) * step;
              c.pos.z += Math.cos(c.facingAngle) * step;
              c.pos.y = 0.04;
              enforceBoundary(c.pos);
              c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 9.5 + i)) * 0.035;
            } else {
              this.turnTowards(c, awakeSultana.facingAngle, 6.5, dt);
              if (c.waveAction && Math.sin(this.elapsed * 0.8) > 0.85) {
                this.setCitizenAnim(c, 'wave');
              } else {
                this.setCitizenAnim(c, 'idle');
              }
              c.modelGroup.position.y = 0;
            }
            c.group.position.copy(c.pos);
            c.mixer.update(dt);
            continue;
          }

          c.playStateTimer -= dt;
          if (c.playStateTimer <= 0) {
            if (c.playMode === 'hop') {
              c.playMode = 'roam';
              c.playStateTimer = 4.0 + Math.random() * 2.8;
              c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            } else {
              c.playMode = 'hop';
              c.playStateTimer = 1.6 + Math.random() * 1.4;
            }
          }

          if (c.playMode === 'hop') {
            if (sultanaEntity) {
              const mAngle = Math.atan2(
                sultanaEntity.pos.x - c.pos.x,
                sultanaEntity.pos.z - c.pos.z
              );
              this.turnTowards(c, mAngle, 7.5, dt);
            }
            if (c.waveAction) {
              this.setCitizenAnim(c, 'wave');
            } else {
              this.setCitizenAnim(c, 'idle');
            }
            c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 8.0 + i)) * 0.1;
            c.group.position.copy(c.pos);
            c.mixer.update(dt);
            continue;
          }

          const wp = c.waypoints[c.waypointIdx];
          const dx = wp[0] - c.pos.x;
          const dz = wp[1] - c.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.75) {
            c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            c.playMode = 'hop';
            c.playStateTimer = 1.8 + Math.random() * 1.2;
          } else {
            this.setCitizenAnim(c, 'walk');
            if (c.walkAction) {
              c.walkAction.setEffectiveTimeScale(1.1);
            }
            const steerAngle = this.chooseClearSteerAngle(
              c.pos.x,
              c.pos.z,
              i,
              Math.atan2(dx, dz),
              sultanPos,
              obstacles,
              undefined,
              0.42
            );
            this.turnTowards(c, steerAngle, 8.0, dt);
            const step = Math.min(dist, c.walkSpeed * dt);
            c.pos.x += Math.sin(c.facingAngle) * step;
            c.pos.z += Math.cos(c.facingAngle) * step;
            resolveCollision(c.pos, 0.34);
            c.pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, c.pos.x));
            c.pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, c.pos.z));
            c.pos.y = 0.04;
            c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 9.5 + i)) * 0.035;
          }

          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        // Approach proximity bow (sustained while Sultan stands close)
        const isSultanNear = distToSultan < 4.5;
        if (isSultanNear) {
          c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 5.0);
        } else if (c.proximityBowBlend > 0) {
          c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
        }

        // Visual sight bow when spotting Sultan from a distance in their forward field of view
        if (c.sightBowCooldown > 0) {
          c.sightBowCooldown = Math.max(0, c.sightBowCooldown - dt);
        }

        let lookTargetX = dxS;
        let lookTargetZ = dzS;

        if (distToSultan >= 4.5 && distToSultan < 10.5 && c.sightBowCooldown <= 0 && c.bowTimer <= 0) {
          const fwdX = Math.sin(c.facingAngle);
          const fwdZ = Math.cos(c.facingAngle);
          const dot = (fwdX * dxS + fwdZ * dzS) / Math.max(0.01, distToSultan);
          if (dot > 0.35) {
            c.bowTimer = 1.85;
            c.sightBowCooldown = 6.5;
          }
        }

        // Non-prince children bow when spotting Sultana
        let seesSultanaChild = false;
        let qDx = 0;
        let qDz = 0;

        if (awakeSultana) {
          qDx = awakeSultana.pos.x - c.pos.x;
          qDz = awakeSultana.pos.z - c.pos.z;
          const dQ = Math.hypot(qDx, qDz);
          if (dQ < 4.8) {
            seesSultanaChild = true;
          } else if (dQ < 11.5) {
            const fwdX = Math.sin(c.facingAngle);
            const fwdZ = Math.cos(c.facingAngle);
            if ((fwdX * qDx + fwdZ * qDz) / Math.max(0.01, dQ) > 0.2) {
              seesSultanaChild = true;
            }
          }
        }
        if (seesSultanaChild && !isSultanNear && c.sightBowCooldown <= 0 && c.bowTimer <= 0) {
          c.bowTimer = 1.65;
          c.sightBowCooldown = 6.0;
        }

        if (!isSultanNear && seesSultanaChild) {
          lookTargetX = qDx;
          lookTargetZ = qDz;
        }

        let sightBow = 0;
        if (c.bowTimer > 0) {
          c.bowTimer = Math.max(0, c.bowTimer - dt);
          const elapsed = 1.85 - c.bowTimer;
          let bAmt = 1.0;
          if (elapsed < 0.36) {
            bAmt = elapsed / 0.36;
          } else if (c.bowTimer < 0.48) {
            bAmt = c.bowTimer / 0.48;
          }
          sightBow = bAmt * bAmt * (3 - 2 * bAmt);
        }

        const proxBow =
          c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
        const totalBow = Math.max(sightBow, proxBow);

        if (c.bowTimer > 0 || totalBow > 0.015) {
          const lookAngle = Math.atan2(lookTargetX, lookTargetZ);
          this.turnTowards(c, lookAngle, 9.0, dt);
          this.setCitizenAnim(c, 'idle');
          c.modelGroup.position.y = 0;
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          this.applyBowPose(c, totalBow);
          continue;
        }

        // Playful chase / roam / hop cycle with playmate
        let partner = c.playPartnerId
          ? this.citizens.find((item) => item.id === c.playPartnerId) || null
          : null;
        if (partner && !partner.group.visible) {
          partner = null;
        }

        c.playStateTimer -= dt;
        if (c.playStateTimer <= 0) {
          if (c.playMode === 'hop') {
            c.playMode = partner && Math.random() < 0.6 ? 'chase' : 'roam';
            c.playStateTimer = 4.2 + Math.random() * 3.4;
          } else if (c.playMode === 'chase') {
            c.playMode = 'roam';
            c.playStateTimer = 4.5 + Math.random() * 3.0;
            c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
          } else {
            c.playMode = partner && Math.random() < 0.72 ? 'chase' : 'hop';
            c.playStateTimer = c.playMode === 'hop' ? 1.15 : 4.2 + Math.random() * 3.0;
          }
        }

        if (c.playMode === 'hop') {
          if (partner) {
            const pAngle = Math.atan2(partner.pos.x - c.pos.x, partner.pos.z - c.pos.z);
            this.turnTowards(c, pAngle, 8.0, dt);
          }
          if (c.waveAction) {
            this.setCitizenAnim(c, 'wave');
          } else {
            this.setCitizenAnim(c, 'idle');
          }
          c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 9.5 + i)) * 0.14;
          c.group.position.copy(c.pos);
          c.mixer.update(dt);
          continue;
        }

        let targetX = c.waypoints[c.waypointIdx][0];
        let targetZ = c.waypoints[c.waypointIdx][1];
        let desiredSpeed = c.walkSpeed * 1.15;

        if (c.playMode === 'chase' && partner && partner.bowTimer <= 0 && partner.proximityBowBlend < 0.1) {
          const pDx = partner.pos.x - c.pos.x;
          const pDz = partner.pos.z - c.pos.z;
          const pDist = Math.hypot(pDx, pDz);
          if (pDist < 1.55) {
            // Tagged partner! Do a joyful little hop and let partner run away
            c.playMode = 'hop';
            c.playStateTimer = 1.05;
            if (partner.playMode !== 'hop') {
              partner.playMode = 'roam';
              partner.playStateTimer = 4.5;
              partner.waypointIdx = (partner.waypointIdx + 1) % partner.waypoints.length;
            }
            c.modelGroup.position.y = 0;
            c.group.position.copy(c.pos);
            c.mixer.update(dt);
            continue;
          }
          targetX = partner.pos.x;
          targetZ = partner.pos.z;
          desiredSpeed = c.walkSpeed * 1.38;
        }

        const dx = targetX - c.pos.x;
        const dz = targetZ - c.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.1 && c.playMode === 'roam') {
          c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
          c.playMode = Math.random() < 0.45 ? 'hop' : 'chase';
          c.playStateTimer = c.playMode === 'hop' ? 1.0 : 4.5;
          c.stuckTimer = 0;
        } else {
          this.setCitizenAnim(c, 'walk');
          if (c.walkAction) {
            c.walkAction.setEffectiveTimeScale(Math.min(2.1, desiredSpeed / 1.85));
          }

          const rawDesired = Math.atan2(dx, dz);
          const steerAngle = this.chooseClearSteerAngle(
            c.pos.x,
            c.pos.z,
            i,
            rawDesired,
            sultanPos,
            obstacles,
            undefined,
            0.55
          );
          this.turnTowards(c, steerAngle, 8.2, dt);

          const step = Math.min(dist, desiredSpeed * dt);
          c.pos.x += Math.sin(c.facingAngle) * step;
          c.pos.z += Math.cos(c.facingAngle) * step;

          resolveCollision(c.pos, 0.36);
          enforceBoundary(c.pos);

          c.modelGroup.position.y = Math.abs(Math.sin(this.elapsed * 11.0 + i * 1.3)) * 0.045;

          c.stuckTimer += dt;
          if (c.stuckTimer > 1.8) {
            const movedSq =
              (c.pos.x - c.lastProgressPos.x) ** 2 + (c.pos.z - c.lastProgressPos.z) ** 2;
            c.lastProgressPos.copy(c.pos);
            c.stuckTimer = 0;
            if (movedSq < 0.35) {
              c.playMode = 'roam';
              c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            }
          }
        }

        c.group.position.copy(c.pos);
        c.mixer.update(dt);
        continue;
      }

      // C. Walking Citizens & Horse-Leading Citizens (stop & bow to Sultan, Sultana on sight, or Crown Prince on approach)
      const isLeader = c.role === 'horse_leader';
      const ignoreHorsePos = isLeader && c.horse ? c.horse.pos : undefined;

      const dxS = sultanPos.x - c.pos.x;
      const dzS = sultanPos.z - c.pos.z;
      const distSqToSultan = dxS * dxS + dzS * dzS;
      const isSultanNear = distSqToSultan < 4.8 * 4.8;

      let seesSultanaW = false;
      let wQDx = 0;
      let wQDz = 0;
      if (awakeSultana) {
        wQDx = awakeSultana.pos.x - c.pos.x;
        wQDz = awakeSultana.pos.z - c.pos.z;
        const distToQ = Math.hypot(wQDx, wQDz);
        if (distToQ < 5.2) {
          seesSultanaW = true;
        } else if (distToQ < 12.5) {
          const fwdX = Math.sin(c.facingAngle);
          const fwdZ = Math.cos(c.facingAngle);
          if ((fwdX * wQDx + fwdZ * wQDz) / Math.max(0.01, distToQ) > 0.16) {
            seesSultanaW = true;
          }
        }
      }

      let nearPrinceW = false;
      let wPDx = 0;
      let wPDz = 0;
      if (princeEntity) {
        wPDx = princeEntity.pos.x - c.pos.x;
        wPDz = princeEntity.pos.z - c.pos.z;
        nearPrinceW = wPDx * wPDx + wPDz * wPDz < 4.8 * 4.8;
      }

      const shouldWalkerBow = isSultanNear || seesSultanaW || nearPrinceW;

      if (shouldWalkerBow) {
        c.proximityBowBlend = Math.min(1.0, c.proximityBowBlend + dt * 4.8);
      } else if (c.proximityBowBlend > 0) {
        c.proximityBowBlend = Math.max(0.0, c.proximityBowBlend - dt * 2.8);
      }

      if (shouldWalkerBow || c.proximityBowBlend > 0.02) {
        let lookAngle = c.facingAngle;
        if (isSultanNear) {
          lookAngle = Math.atan2(dxS, dzS);
        } else if (seesSultanaW) {
          lookAngle = Math.atan2(wQDx, wQDz);
        } else if (nearPrinceW) {
          lookAngle = Math.atan2(wPDx, wPDz);
        }
        let diff = lookAngle - c.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.facingAngle += diff * Math.min(1.0, dt * 9.0);
        c.modelGroup.rotation.y = c.facingAngle;
        this.setCitizenAnim(c, 'idle');
      } else if (c.pauseTimer > 0) {
        c.pauseTimer -= dt;
        this.setCitizenAnim(c, 'idle');
      } else {
        const target = c.waypoints[c.waypointIdx];
        const dx = target[0] - c.pos.x;
        const dz = target[1] - c.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.25) {
          c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
          c.pauseTimer = 0.9 + ((i * 0.61) % 2.1);
          c.stuckTimer = 0;
        } else {
          this.setCitizenAnim(c, 'walk');
          const rawDesired = Math.atan2(dx, dz);
          const steerAngle = this.chooseClearSteerAngle(
            c.pos.x,
            c.pos.z,
            i,
            rawDesired,
            sultanPos,
            obstacles,
            ignoreHorsePos,
            0.72
          );

          let diff = steerAngle - c.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.facingAngle += diff * Math.min(1.0, dt * 6.5);
          c.modelGroup.rotation.y = c.facingAngle;

          // Walk forward naturally in facing direction (no sideways ice-skating)
          const step = Math.min(dist, c.walkSpeed * dt);
          c.pos.x += Math.sin(c.facingAngle) * step;
          c.pos.z += Math.cos(c.facingAngle) * step;

          resolveCollision(c.pos, 0.44);
          enforceBoundary(c.pos);

          // Anti-stuck safeguard: advance waypoint if progress stalled
          c.stuckTimer += dt;
          if (c.stuckTimer > 2.0) {
            const movedSq =
              (c.pos.x - c.lastProgressPos.x) ** 2 + (c.pos.z - c.lastProgressPos.z) ** 2;
            c.lastProgressPos.copy(c.pos);
            c.stuckTimer = 0;
            if (movedSq < 0.45) {
              c.waypointIdx = (c.waypointIdx + 1) % c.waypoints.length;
            }
          }
        }
      }

      c.group.position.copy(c.pos);
      c.mixer.update(dt);

      if (c.proximityBowBlend > 0.001) {
        const smoothBow = c.proximityBowBlend * c.proximityBowBlend * (3 - 2 * c.proximityBowBlend);
        this.applyBowPose(c, smoothBow);
      }

      // Update right-hand rope grip, led horse follow motion, and sagging 3D rope visual
      if (isLeader && c.horse) {
        if (c.upperArmR) c.upperArmR.quaternion.copy(c.leadUpperArmQuatR);
        if (c.lowerArmR) c.lowerArmR.quaternion.copy(c.leadLowerArmQuatR);

        horseManager.updateLedHorseFollow(
          c.horse,
          c.pos,
          c.walkSpeed * 1.15,
          dt,
          resolveCollision,
          enforceBoundary
        );

        if (c.ropeVisual) {
          c.group.updateMatrixWorld(true);
          c.horse.group.updateMatrixWorld(true);
          if (c.handAnchorR) {
            c.handAnchorR.getWorldPosition(_handWorldPos);
          } else {
            _handWorldPos.set(c.pos.x - 0.35, 0.9, c.pos.z);
          }
          c.horse.halterAnchor.getWorldPosition(_halterWorldPos);
          c.ropeVisual.updateEndpoints(_handWorldPos, _halterWorldPos);
        }
      }
    }
  }

  public dispose() {
    for (const c of this.citizens) {
      c.mixer.stopAllAction();
      if (c.ropeVisual) c.ropeVisual.dispose();
      c.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
