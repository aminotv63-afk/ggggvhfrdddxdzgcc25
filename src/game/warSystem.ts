import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { soundManager } from './audio';

export const ROMAN_ARMY_MAX = 5000;
export const WAR_UNLOCK_ARMY = 5000;
export const DAILY_ARMY_GROWTH = 100;

const FOUNTAIN_X = 0;
const FOUNTAIN_Z = -9.5;

export type WarPhase = 'idle' | 'fighting' | 'victory' | 'defeat';

export interface WarOutcomeEvent {
  id: number;
  victory: boolean;
  rewardGold: number;
  survivingArmy: number;
}

interface WarSoldier {
  side: 'royal' | 'roman';
  index: number;
  group: THREE.Group;
  modelRoot: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  pos: THREE.Vector3;
  facing: number;
  hp: number;
  fallTimer: number;
  attackCooldown: number;
  swingTimer: number;
  phaseOffset: number;
  isLeader: boolean;
}

export class WarSystem {
  public readonly group = new THREE.Group();

  private knightTemplate: THREE.Group | null = null;
  private walkClip: THREE.AnimationClip | null = null;
  private idleClip: THREE.AnimationClip | null = null;
  private hasSpawnedPool = false;

  private royalUnits: WarSoldier[] = [];
  private romanUnits: WarSoldier[] = [];
  private disposables: { dispose: () => void }[] = [];

  private phase: WarPhase = 'idle';
  private playerArmyRemaining = 0;
  private romanArmyRemaining = 0;
  private playerArmyInitial = 0;
  private battleElapsed = 0;
  private outcomeHoldTimer = 0;
  private soundCooldown = 0;
  private pendingOutcome: WarOutcomeEvent | null = null;
  private battleOutcomeBias = 0;

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  public isActive(): boolean {
    return this.phase === 'fighting';
  }

  public getPhase(): WarPhase {
    return this.phase;
  }

  public getSnapshot(): {
    phase: WarPhase;
    playerRemaining: number;
    romanRemaining: number;
  } {
    return {
      phase: this.phase,
      playerRemaining: Math.max(0, Math.round(this.playerArmyRemaining)),
      romanRemaining: Math.max(0, Math.round(this.romanArmyRemaining)),
    };
  }

  public consumeOutcomeEvent(): WarOutcomeEvent | null {
    const ev = this.pendingOutcome;
    this.pendingOutcome = null;
    return ev;
  }

  public attachKnightTemplate(
    template: THREE.Group,
    walkClip: THREE.AnimationClip | null,
    idleClip: THREE.AnimationClip | null
  ) {
    if (this.hasSpawnedPool) return;
    this.knightTemplate = template;
    this.walkClip = walkClip;
    this.idleClip = idleClip;
    this.hasSpawnedPool = true;
    this.buildArmyPools();
  }

  private createArmyBadgeSprite(
    label: string,
    bgColor: string,
    borderColor: string,
    textColor: string
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(14, 14, canvas.width - 28, canvas.height - 28, 30);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillStyle = textColor;
      ctx.font = '900 50px "Tajawal", sans-serif';
      ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
    }
    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.1, 0.56, 1);
    sprite.position.set(0, 2.75, 0);
    sprite.renderOrder = 12;
    return sprite;
  }

  private buildArmyPools() {
    if (!this.knightTemplate) return;

    const animeFaceMats = new Set(['eyes', 'fix_white', 'fix_mouth', 'fix_blush', 'fix_dark']);
    const royalMap: Record<string, number> = {
      top_primary: 0x1d4ed8,
      body_secondary: 0x1e3a8a,
      handl_primary: 0x2563eb,
      hat_accent: 0xfbbf24,
      back_primary: 0x1e40af,
    };
    const romanMap: Record<string, number> = {
      top_primary: 0xdc2626,
      body_secondary: 0x7f1d1d,
      handl_primary: 0xef4444,
      hat_accent: 0xfbbf24,
      back_primary: 0x991b1b,
    };

    const romanCrestGeo = this.track(new THREE.BoxGeometry(0.14, 0.28, 0.42));
    const romanCrestMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    const royalCrestMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35, metalness: 0.45 })
    );

    const createSoldier = (side: 'royal' | 'roman', idx: number): WarSoldier => {
      const wrapper = new THREE.Group();
      wrapper.visible = false;

      const model = cloneSkinned(this.knightTemplate!) as THREE.Group;
      const scale = idx === 0 ? 1.44 : 1.32;
      model.scale.setScalar(scale);

      const palette = side === 'royal' ? royalMap : romanMap;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const matList = Array.isArray(m.material) ? m.material : [m.material];
          const firstMatName = (matList[0]?.name || '').toLowerCase();
          if (matList.length === 1 && animeFaceMats.has(firstMatName)) {
            m.visible = false;
            return;
          }
          m.castShadow = false;
          m.receiveShadow = true;

          const cloneMat = (orig: THREE.Material): THREE.Material => {
            const mat = orig.clone() as THREE.MeshStandardMaterial;
            this.track(mat);
            const mName = (mat.name || '').toLowerCase();
            if (mName in palette) {
              mat.color.setHex(palette[mName]);
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

      const crest = new THREE.Mesh(
        romanCrestGeo,
        side === 'roman' ? romanCrestMat : royalCrestMat
      );
      crest.position.set(0, 1.54 * scale, 0);
      wrapper.add(crest);

      if (idx === 0) {
        const badge =
          side === 'roman'
            ? this.createArmyBadgeSprite('جيش رومان', 'rgba(127, 29, 29, 0.92)', '#ef4444', '#fecaca')
            : this.createArmyBadgeSprite('جيش المملكة', 'rgba(30, 58, 138, 0.92)', '#fbbf24', '#fef08a');
        wrapper.add(badge);
      }

      const mixer = new THREE.AnimationMixer(model);
      if (this.walkClip) {
        const act = mixer.clipAction(this.walkClip);
        act.timeScale = 1.45;
        act.time = (idx * 0.27) % Math.max(0.2, this.walkClip.duration);
        act.play();
      } else if (this.idleClip) {
        mixer.clipAction(this.idleClip).play();
      }

      this.group.add(wrapper);
      return {
        side,
        index: idx,
        group: wrapper,
        modelRoot: model,
        mixer,
        pos: new THREE.Vector3(),
        facing: side === 'royal' ? Math.PI * 0.5 : -Math.PI * 0.5,
        hp: 100,
        fallTimer: 0,
        attackCooldown: (idx % 5) * 0.14,
        swingTimer: 0,
        phaseOffset: idx * 0.7,
        isLeader: idx === 0,
      };
    };

    for (let i = 0; i < 20; i++) {
      this.royalUnits.push(createSoldier('royal', i));
    }
    for (let i = 0; i < 24; i++) {
      this.romanUnits.push(createSoldier('roman', i));
    }
  }

  private placeRoyalAtStage(u: WarSoldier, i: number) {
    // Deploy Royal Kingdom Army right on the West/North-West/South-West flank of the Central Fountain (0, -9.5)
    const row = Math.floor(i / 4);
    const col = i % 4;
    let x = -8.6 + col * 1.65;
    let z = -16.8 + row * 3.65;
    // Keep clear of the fountain plinth itself (radius ~2.4m around 0, -9.5)
    const dxF = x - FOUNTAIN_X;
    const dzF = z - FOUNTAIN_Z;
    const dF = Math.hypot(dxF, dzF);
    if (dF < 2.55) {
      x = FOUNTAIN_X - 2.9;
      z = FOUNTAIN_Z + (i % 2 === 0 ? -2.2 : 2.2);
    }
    u.pos.set(x, 0, z);
    u.facing = Math.PI * 0.5;
    u.hp = 100;
    u.fallTimer = 0;
    u.swingTimer = 0;
    u.modelRoot.rotation.set(0, 0, 0);
    u.modelRoot.position.y = 0;
    u.group.position.copy(u.pos);
    u.group.rotation.y = u.facing;
    u.group.visible = true;
  }

  private placeRomanAtEastFront(u: WarSoldier, i: number, waveSpawn: boolean) {
    // Roman Red Army faces Royal Army right next to the Central Fountain (East flank & immediate reinforcement edge)
    const row = Math.floor(i / 4);
    const col = i % 4;
    let x = waveSpawn ? 11.8 + col * 1.9 : 3.8 + col * 1.8;
    let z = -16.5 + row * 3.1 + ((i % 3) - 1) * 0.45;
    const dxF = x - FOUNTAIN_X;
    const dzF = z - FOUNTAIN_Z;
    const dF = Math.hypot(dxF, dzF);
    if (dF < 2.65) {
      x = FOUNTAIN_X + 3.1;
      z = FOUNTAIN_Z + (i % 2 === 0 ? -2.2 : 2.2);
    }
    u.pos.set(x, 0, z);
    u.facing = -Math.PI * 0.5;
    u.hp = 100;
    u.fallTimer = 0;
    u.swingTimer = 0;
    u.modelRoot.rotation.set(0, 0, 0);
    u.modelRoot.position.y = 0;
    u.group.position.copy(u.pos);
    u.group.rotation.y = u.facing;
    u.group.visible = true;
  }

  public declareWar(playerArmyCount: number): boolean {
    if (this.phase !== 'idle') return false;
    if (playerArmyCount < WAR_UNLOCK_ARMY) return false;

    this.phase = 'fighting';
    this.playerArmyInitial = Math.max(WAR_UNLOCK_ARMY, Math.floor(playerArmyCount));
    this.playerArmyRemaining = this.playerArmyInitial;
    this.romanArmyRemaining = ROMAN_ARMY_MAX;
    this.battleElapsed = 0;
    this.outcomeHoldTimer = 0;
    this.pendingOutcome = null;
    // Slight tactical edge for equal 5000 vs 5000, decisive win above ~5300, slight defeat chance if even
    this.battleOutcomeBias = Math.random() < 0.68 ? 1.08 : 0.92;

    for (let i = 0; i < this.royalUnits.length; i++) {
      this.placeRoyalAtStage(this.royalUnits[i], i);
    }
    for (let i = 0; i < this.romanUnits.length; i++) {
      this.placeRomanAtEastFront(this.romanUnits[i], i, false);
    }

    soundManager.playWarHorn();
    return true;
  }

  public applyCannonBlast(impactX: number, impactZ: number, radius = 9.0) {
    if (this.phase !== 'fighting') return;
    let hits = 0;
    for (let i = 0; i < this.romanUnits.length; i++) {
      const u = this.romanUnits[i];
      if (!u.group.visible || u.fallTimer > 0) continue;
      const d = Math.hypot(u.pos.x - impactX, u.pos.z - impactZ);
      if (d <= radius) {
        u.hp = 0;
        u.fallTimer = 0.85;
        hits++;
      }
    }
    const lost = hits * 55 + 220;
    this.romanArmyRemaining = Math.max(0, this.romanArmyRemaining - lost);
  }

  public update(
    dt: number,
    elapsed: number,
    sultanPos: THREE.Vector3,
    resolveCollision: (pos: THREE.Vector3, radius: number) => number,
    enforceBoundary: (pos: THREE.Vector3) => void
  ) {
    if (this.phase === 'idle') return;

    if (this.soundCooldown > 0) {
      this.soundCooldown = Math.max(0, this.soundCooldown - dt);
    }

    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.outcomeHoldTimer += dt;
      const isWin = this.phase === 'victory';

      for (let i = 0; i < this.royalUnits.length; i++) {
        const u = this.royalUnits[i];
        u.mixer?.update(dt);
        if (isWin) {
          u.modelRoot.rotation.set(0, 0, 0);
          u.pos.y = Math.max(0, Math.sin(elapsed * 8 + i)) * 0.22;
          u.group.position.copy(u.pos);
        } else {
          u.group.visible = false;
        }
      }
      for (let i = 0; i < this.romanUnits.length; i++) {
        const u = this.romanUnits[i];
        u.mixer?.update(dt);
        if (isWin) {
          // Roman survivors flee eastward back to border
          u.pos.x = Math.min(82, u.pos.x + 8.5 * dt);
          u.facing = Math.PI * 0.5;
          u.modelRoot.rotation.set(0, 0, 0);
          u.group.position.copy(u.pos);
          u.group.rotation.y = u.facing;
          if (u.pos.x >= 80) u.group.visible = false;
        } else {
          u.pos.x = Math.min(82, u.pos.x + 5.0 * dt);
          u.facing = Math.PI * 0.5;
          u.group.position.copy(u.pos);
          u.group.rotation.y = u.facing;
        }
      }

      if (this.outcomeHoldTimer >= 4.2) {
        this.phase = 'idle';
        for (let i = 0; i < this.royalUnits.length; i++) this.royalUnits[i].group.visible = false;
        for (let i = 0; i < this.romanUnits.length; i++) this.romanUnits[i].group.visible = false;
      }
      return;
    }

    // Active 'fighting' phase
    this.battleElapsed += dt;

    // 1. Update casualty attrition across the 5,000+ reserve armies
    const playerRatio = Math.max(0.25, this.playerArmyRemaining / ROMAN_ARMY_MAX);
    const romanRatio = Math.max(0.25, this.romanArmyRemaining / ROMAN_ARMY_MAX);
    const sway = 1 + Math.sin(this.battleElapsed * 0.9) * 0.12;
    const romanAttrition = (158 * Math.pow(playerRatio / romanRatio, 0.7) * this.battleOutcomeBias * sway) * dt;
    const playerAttrition = (152 * Math.pow(romanRatio / playerRatio, 0.65) / this.battleOutcomeBias / sway) * dt;

    this.romanArmyRemaining = Math.max(0, this.romanArmyRemaining - romanAttrition);
    this.playerArmyRemaining = Math.max(0, this.playerArmyRemaining - playerAttrition);

    if (this.romanArmyRemaining <= 0) {
      const survivingArmy = Math.max(500, Math.round(this.playerArmyRemaining));
      this.phase = 'victory';
      this.outcomeHoldTimer = 0;
      this.pendingOutcome = {
        id: Date.now(),
        victory: true,
        rewardGold: 150000,
        survivingArmy,
      };
      soundManager.playBattleOutcome(true);
      return;
    }

    if (this.playerArmyRemaining <= 0) {
      this.phase = 'defeat';
      this.outcomeHoldTimer = 0;
      this.pendingOutcome = {
        id: Date.now(),
        victory: false,
        rewardGold: 0,
        survivingArmy: 200,
      };
      soundManager.playBattleOutcome(false);
      return;
    }

    // 2. Step all 44 articulated 3D battle units
    const stepArmy = (units: WarSoldier[], enemies: WarSoldier[], isRoman: boolean) => {
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        u.mixer?.update(dt);

        if (u.fallTimer > 0) {
          u.fallTimer -= dt;
          u.modelRoot.rotation.set(-Math.PI * 0.45, 0, 0);
          u.modelRoot.position.y = 0.25;
          if (u.fallTimer <= 0) {
            if (isRoman) {
              this.placeRomanAtEastFront(u, i, true);
            } else {
              this.placeRoyalAtStage(u, i);
            }
          }
          continue;
        }

        u.modelRoot.rotation.set(0, 0, 0);
        u.modelRoot.position.y = 0;
        if (u.attackCooldown > 0) u.attackCooldown -= dt;
        if (u.swingTimer > 0) {
          u.swingTimer -= dt;
          const lunge = Math.sin((1 - u.swingTimer / 0.26) * Math.PI);
          u.modelRoot.rotation.x = lunge * 0.34;
          u.modelRoot.position.y = lunge * 0.08;
        }

        // Keep Sultan strictly protected: Roman units repel outside 5.4m guard ring around Sultan
        if (isRoman) {
          const dxS = u.pos.x - sultanPos.x;
          const dzS = u.pos.z - sultanPos.z;
          const distS = Math.hypot(dxS, dzS);
          if (distS < 5.4 && distS > 0.01) {
            u.pos.x = sultanPos.x + (dxS / distS) * 5.6;
            u.pos.z = sultanPos.z + (dzS / distS) * 5.6;
          }
        }

        // Find nearest standing enemy
        let bestEnemy: WarSoldier | null = null;
        let bestDistSq = Infinity;
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.group.visible || e.fallTimer > 0) continue;
          const dx = e.pos.x - u.pos.x;
          const dz = e.pos.z - u.pos.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestEnemy = e;
          }
        }

        if (bestEnemy) {
          const dx = bestEnemy.pos.x - u.pos.x;
          const dz = bestEnemy.pos.z - u.pos.z;
          const dist = Math.sqrt(bestDistSq);
          const targetYaw = Math.atan2(dx, dz);
          u.facing = targetYaw;
          u.group.rotation.y = targetYaw;

          if (dist > 1.55) {
            const speed = isRoman ? 4.8 : 5.0;
            const step = Math.min(dist - 1.35, speed * dt);
            u.pos.x += (dx / dist) * step;
            u.pos.z += (dz / dist) * step;
          } else if (u.attackCooldown <= 0) {
            u.attackCooldown = 0.52 + (i % 3) * 0.11;
            u.swingTimer = 0.26;
            bestEnemy.hp -= isRoman ? 28 : 34;
            if (bestEnemy.hp <= 0) {
              bestEnemy.fallTimer = 0.65;
            }
            if (this.soundCooldown <= 0 && Math.hypot(u.pos.x - sultanPos.x, u.pos.z - sultanPos.z) < 42) {
              soundManager.playSwordSlash();
              this.soundCooldown = 0.28;
            }
          }
        }

        // Keep battle clustered right around the Central Fountain (0, -9.5) and clear of its stone curb
        const dxCenter = u.pos.x - FOUNTAIN_X;
        const dzCenter = u.pos.z - FOUNTAIN_Z;
        const distCenter = Math.hypot(dxCenter, dzCenter);
        if (distCenter < 2.35 && distCenter > 0.001) {
          u.pos.x = FOUNTAIN_X + (dxCenter / distCenter) * 2.35;
          u.pos.z = FOUNTAIN_Z + (dzCenter / distCenter) * 2.35;
        } else if (distCenter > 15.5) {
          const pull = Math.min(distCenter - 12.0, 5.5 * dt);
          u.pos.x -= (dxCenter / distCenter) * pull;
          u.pos.z -= (dzCenter / distCenter) * pull;
        }

        resolveCollision(u.pos, 0.42);
        enforceBoundary(u.pos);
        u.pos.y = 0;
        u.group.position.copy(u.pos);
      }
    };

    stepArmy(this.royalUnits, this.romanUnits, false);
    stepArmy(this.romanUnits, this.royalUnits, true);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
