import * as THREE from 'three';
import {
  createRoofShingleTexture,
  createStoneMasonryTexture,
  createWellWaterTexture,
  createWoodPlankTexture,
} from './textures';
import { RoyalPrison } from './prison';
import { RoyalCemetery } from './cemetery';
import { RoyalCannon } from './cannon';
import { CAFE_ORIGIN, CAFE_ROT_Y, RoyalCafe } from './cafe';
import { RoyalPalace } from './palace';
import { RoyalLionCage } from './lionCage';
import { MilitaryCamp } from './militaryCamp';
import { RoyalSpeechPodium } from './speechPodium';

export interface OBBCollider {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cosY: number;
  sinY: number;
  topY: number;
  bottomY?: number;
  allowStand?: boolean;
}

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  topY: number;
  bottomY?: number;
  allowStand?: boolean;
}

export interface RoofVolume {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cosY: number;
  sinY: number;
  roofY: number;
  boundR: number;
}

export interface GallowsAnchor {
  deckCenter: THREE.Vector3;
  trapdoorWorldPos: THREE.Vector3;
  leverWorldPos: THREE.Vector3;
  rotY: number;
  deckHeight: number;
  ropeAnchorWorldY: number;
  trapdoorPivot: THREE.Group;
  leverPivot: THREE.Group;
  ropeGroup: THREE.Group;
  verticalRope: THREE.Mesh;
  knot: THREE.Mesh;
  nooseLoop: THREE.Mesh;
}

interface SplashDrop {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
}

export class KingdomVillage {
  public group: THREE.Group;
  public boxColliders: OBBCollider[] = [];
  public cylinderColliders: CylinderCollider[] = [];
  public buildingFootprints: { x: number; z: number; r: number }[] = [];
  public roofVolumes: RoofVolume[] = [];
  public gallowsAnchor: GallowsAnchor | null = null;
  public prison!: RoyalPrison;
  public cemetery!: RoyalCemetery;
  public cannon!: RoyalCannon;
  public cafe!: RoyalCafe;
  public palace!: RoyalPalace;
  public lionCage!: RoyalLionCage;
  public militaryCamp!: MilitaryCamp;
  public speechPodium!: RoyalSpeechPodium;
  public readonly wellCenter = new THREE.Vector3(0, 0, -9.5);
  public readonly wellWaterY = 0.78;

  private disposables: { dispose: () => void }[] = [];
  private wellWaterMesh: THREE.Mesh | null = null;
  private wellBucketGroup: THREE.Group | null = null;
  private bannerCloths: THREE.Mesh[] = [];
  private splashDrops: SplashDrop[] = [];
  private splashRipple: THREE.Mesh | null = null;
  private splashTimer: number = 0;
  private lastElapsedTime: number = 0;
  private executionRopeActive: boolean = false;
  private ropeMat!: THREE.MeshStandardMaterial;
  private dirtMat!: THREE.MeshStandardMaterial;
  private sackMat!: THREE.MeshStandardMaterial;

  // Shared materials for draw-call & memory efficiency
  private stoneMat!: THREE.MeshStandardMaterial;
  private darkStoneMat!: THREE.MeshStandardMaterial;
  private plasterMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;
  private darkWoodMat!: THREE.MeshStandardMaterial;
  private ironMat!: THREE.MeshStandardMaterial;
  private goldMat!: THREE.MeshStandardMaterial;
  private windowGlowMat!: THREE.MeshStandardMaterial;
  private lanternGlowMat!: THREE.MeshStandardMaterial;
  private crimsonFabricMat!: THREE.MeshStandardMaterial;
  private creamFabricMat!: THREE.MeshStandardMaterial;
  private cobaltFabricMat!: THREE.MeshStandardMaterial;
  private roofMats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'KingdomVillage';

    this.initSharedMaterials();
    this.buildLayout();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private initSharedMaterials() {
    const stoneTex = this.track(createStoneMasonryTexture());
    const woodTex = this.track(createWoodPlankTexture());

    this.stoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xd6d1c9,
        roughness: 0.88,
        metalness: 0.05,
      })
    );

    this.darkStoneMat = this.track(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x76726d,
        roughness: 0.92,
        metalness: 0.06,
      })
    );

    this.plasterMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xeae1d3,
        roughness: 0.86,
        metalness: 0.02,
      })
    );

    this.woodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0xb88658,
        roughness: 0.8,
        metalness: 0.04,
      })
    );

    this.darkWoodMat = this.track(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0x5c3a21,
        roughness: 0.84,
        metalness: 0.05,
      })
    );

    this.ironMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x2c3038,
        roughness: 0.52,
        metalness: 0.72,
      })
    );

    this.goldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe6b43c,
        roughness: 0.3,
        metalness: 0.84,
      })
    );

    this.windowGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffe49e,
        emissive: 0xffb845,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      })
    );

    this.lanternGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfff0b3,
        emissive: 0xffb732,
        emissiveIntensity: 1.15,
        roughness: 0.2,
      })
    );

    this.crimsonFabricMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xb51d2e,
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );

    this.creamFabricMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf2e7d5,
        roughness: 0.85,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    );

    this.cobaltFabricMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x244673,
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );

    const roofColors = ['#8c2a24', '#2d4b6e', '#a34c2b', '#265c4a'];
    this.roofMats = roofColors.map((hex) => {
      const tex = this.track(createRoofShingleTexture(hex));
      return this.track(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.84,
          metalness: 0.06,
        })
      );
    });

    this.ropeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.92, metalness: 0.02 })
    );
    this.dirtMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x5c4430, roughness: 0.96, metalness: 0.01 })
    );
    this.sackMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc8b08a, roughness: 0.9, metalness: 0.01 })
    );
  }

  private addOBB(
    cx: number,
    cz: number,
    width: number,
    depth: number,
    rotY: number,
    topY: number,
    allowStand: boolean = false
  ) {
    this.boxColliders.push({
      cx,
      cz,
      halfW: width * 0.5,
      halfD: depth * 0.5,
      cosY: Math.cos(-rotY),
      sinY: Math.sin(-rotY),
      topY,
      allowStand,
    });
  }

  private addCylinder(
    x: number,
    z: number,
    radius: number,
    topY: number,
    allowStand: boolean = false
  ) {
    this.cylinderColliders.push({ x, z, radius, topY, allowStand });
  }

  private registerRoofVolume(
    cx: number,
    cz: number,
    width: number,
    depth: number,
    rotY: number,
    roofY: number
  ) {
    const halfW = width * 0.5;
    const halfD = depth * 0.5;
    this.roofVolumes.push({
      cx,
      cz,
      halfW,
      halfD,
      cosY: Math.cos(-rotY),
      sinY: Math.sin(-rotY),
      roofY,
      boundR: Math.hypot(halfW, halfD) + 0.5,
    });
  }

  private buildLayout() {
    // =========================================================================
    // RESERVED PALACE GROUNDS: x in [-18, +18], z in [-54, -22]
    // Intentionally kept open and flat for constructing the Royal Palace later!
    // =========================================================================

    // 1. Centerpiece Stone Well with Water in the Central Kingdom Square
    this.createRoyalWell(0, -9.5);

    // 2. Central Well Courtyard Benches & Street Lanterns
    this.createRoyalBench(-4.1, -9.5, Math.PI / 2);
    this.createRoyalBench(4.1, -9.5, -Math.PI / 2);
    this.createRoyalBench(-3.2, -5.6, Math.PI * 0.76);
    this.createRoyalBench(3.2, -5.6, -Math.PI * 0.76);

    this.createStreetLantern(-5.6, -4.5);
    this.createStreetLantern(5.6, -4.5);
    this.createStreetLantern(-5.6, -14.5);
    this.createStreetLantern(5.6, -14.5);

    // 3. Inner West Wing Houses (varied styles facing East toward central plaza)
    this.createTwoStoryManor(-21.5, -11.0, Math.PI / 2, 0);
    this.createKingdomHouse(-21.5, 3.5, Math.PI / 2, 1, 5.4, 4.3, 3.1);
    this.createLShapedVilla(-21.5, 18.0, Math.PI / 2, 2);
    this.createRoundTowerHouse(-13.5, 31.0, Math.PI * 0.78, 3);
    this.createKingdomHouse(-13.5, 44.5, Math.PI * 0.85, 0, 5.6, 4.4, 3.1);

    // 4. Inner East Wing Houses (varied styles facing West toward central plaza)
    this.createTwoStoryManor(21.5, -11.0, -Math.PI / 2, 1);
    this.createKingdomHouse(21.5, 3.5, -Math.PI / 2, 2, 5.4, 4.3, 3.1);
    this.createLShapedVilla(21.5, 18.0, -Math.PI / 2, 0);
    this.createRoundTowerHouse(13.5, 31.0, -Math.PI * 0.78, 0);
    this.createKingdomHouse(13.5, 44.5, -Math.PI * 0.85, 2, 5.6, 4.4, 3.1);

    // 5. Outer West District (along x = -40.5, leaving x = -30.5 open as carriage avenue)
    this.createLShapedVilla(-40.5, -24.5, Math.PI * 0.4, 2);
    this.createRoundTowerHouse(-41.0, -11.5, Math.PI * 0.45, 0);
    this.createRoyalStableBarn(-41.0, 1.5, Math.PI / 2, 2);
    this.createTwoStoryManor(-41.0, 15.0, Math.PI / 2, 3);
    this.createKingdomHouse(-38.0, 28.5, Math.PI * 0.65, 1, 5.6, 4.4, 3.1);
    this.createLShapedVilla(-27.0, 40.5, Math.PI * 0.8, 3);

    // 6. Outer East District (along x = +40.5, leaving x = +30.5 open as carriage avenue)
    this.createLShapedVilla(40.5, -24.5, -Math.PI * 0.4, 1);
    this.createRoundTowerHouse(41.0, -11.5, -Math.PI * 0.45, 1);
    this.createRoyalStableBarn(41.0, 1.5, -Math.PI / 2, 0);
    this.createTwoStoryManor(41.0, 15.0, -Math.PI / 2, 2);
    this.createKingdomHouse(38.0, 28.5, -Math.PI * 0.65, 3, 5.6, 4.4, 3.1);
    this.createLShapedVilla(27.0, 40.5, -Math.PI * 0.8, 0);

    // 7. Far Outer West & East Country Cottages (x = +-51)
    this.createKingdomHouse(-51.0, -6.0, Math.PI / 2, 3, 5.2, 4.2, 3.0);
    this.createKingdomHouse(-51.0, 9.0, Math.PI / 2, 0, 5.2, 4.2, 3.0);
    this.createKingdomHouse(51.0, -6.0, -Math.PI / 2, 2, 5.2, 4.2, 3.0);
    this.createKingdomHouse(51.0, 9.0, -Math.PI / 2, 1, 5.2, 4.2, 3.0);

    // 8. North-West & North-East Estates (completely outside Expanded Reserved Palace Plot [-27.5..27.5, -70..-20.5])
    this.createTwoStoryManor(-38.5, -37.0, Math.PI * 0.28, 0);
    this.createKingdomHouse(-32.5, -52.5, Math.PI * 0.25, 3, 5.6, 4.4, 3.1);
    this.createRoundTowerHouse(-32.0, -64.5, Math.PI * 0.22, 1);

    this.createTwoStoryManor(38.5, -37.0, -Math.PI * 0.28, 2);
    this.createKingdomHouse(32.5, -52.5, -Math.PI * 0.25, 1, 5.6, 4.4, 3.1);
    this.createRoundTowerHouse(32.0, -64.5, -Math.PI * 0.22, 3);

    // 9. Kingdom Market Stalls flanking the central square & south boulevard
    this.createMarketStall(-13.2, -2.5, Math.PI / 2, true);
    this.createMarketStall(13.2, -2.5, -Math.PI / 2, false);
    this.createMarketStall(-13.2, 16.5, Math.PI / 2, false);
    this.createMarketStall(13.2, 16.5, -Math.PI / 2, true);

    // 10. Outdoor Royal Feast Tables & Chairs near residences
    this.createFeastTableSet(-13.2, 9.5, Math.PI / 2);
    this.createFeastTableSet(13.2, 9.5, -Math.PI / 2);
    this.createFeastTableSet(-13.2, 23.0, Math.PI / 2);
    this.createFeastTableSet(13.2, 23.0, -Math.PI / 2);
    this.createFeastTableSet(-34.5, 11.5, Math.PI / 2);
    this.createFeastTableSet(34.5, 11.5, -Math.PI / 2);

    // 11. Additional Avenue Benches & Street Lanterns
    this.createRoyalBench(-9.2, 16.0, Math.PI / 2);
    this.createRoyalBench(9.2, 16.0, -Math.PI / 2);
    this.createRoyalBench(-34.5, 3.5, Math.PI / 2);
    this.createRoyalBench(34.5, 3.5, -Math.PI / 2);
    this.createRoyalBench(-6.5, 34.0, Math.PI / 2);
    this.createRoyalBench(6.5, 34.0, -Math.PI / 2);

    this.createStreetLantern(-8.5, 6.0);
    this.createStreetLantern(8.5, 6.0);
    this.createStreetLantern(-8.5, 19.5);
    this.createStreetLantern(8.5, 19.5);
    this.createStreetLantern(-8.5, 33.0);
    this.createStreetLantern(8.5, 33.0);
    this.createStreetLantern(-26.5, -12.0);
    this.createStreetLantern(26.5, -12.0);
    this.createStreetLantern(-26.5, 12.0);
    this.createStreetLantern(26.5, 12.0);

    // 12. Neat Clusters of Oak Barrels & Supply Crates near houses and stalls
    this.createPropCluster(-16.6, -6.8, 0.2);
    this.createPropCluster(16.6, -6.8, -0.2);
    this.createPropCluster(-16.8, 6.2, 0.4);
    this.createPropCluster(16.8, 6.2, -0.4);
    this.createPropCluster(-35.2, -8.5, 0.3);
    this.createPropCluster(35.2, -8.5, -0.3);

    // 13. Low Wooden Orchard / Garden Fences around countryside plots
    this.createWoodenFence(-45.5, -31.5, 6.2, Math.PI * 0.14);
    this.createWoodenFence(45.5, -31.5, 6.2, -Math.PI * 0.14);

    // 14. Grand Entrance Banners & Lanterns marking the Reserved Palace Plot at z = -21.5
    this.createRoyalBanner(-6.2, -21.5, 0);
    this.createRoyalBanner(6.2, -21.5, 0);
    this.createStreetLantern(-8.4, -21.5);
    this.createStreetLantern(8.4, -21.5);

    // 15. Royal Gallows Platform in West Central Plaza (ready for future execution interaction)
    this.createRoyalGallows(-13.5, -14.8, Math.PI * 0.34);

    // 16. Shattered / Ruined House, Broken Wooden Carts & Shovels on Broken Ground
    this.createRuinedHouse(48.5, 21.5, -Math.PI * 0.65);
    this.createBrokenCart(25.2, -3.5, -0.45);
    this.createBrokenCart(-34.0, 36.5, 0.72);
    this.createBrokenCart(42.5, 19.5, 2.2);

    this.createShovelTool(23.8, -5.0, 0.35, true);
    this.createShovelTool(45.2, 23.2, -0.8, true);
    this.createShovelTool(-32.2, 35.6, 1.1, true);
    this.createShovelTool(-11.4, -0.4, 0.5, false);
    this.createShovelTool(11.4, 18.2, -0.4, false);

    // 17. Rich Roadside Cargo & Goods Depots (Crates, Rolled Fabrics, Grain Sacks, Amphoras)
    this.createCargoDepot(-12.2, 12.6, Math.PI * 0.5);
    this.createCargoDepot(12.2, 12.6, -Math.PI * 0.5);
    this.createCargoDepot(-14.8, 26.8, Math.PI * 0.48);
    this.createCargoDepot(25.6, 11.2, -Math.PI * 0.48);

    // 18. Handwritten Arabic Kingdom Law Decree Signboard (Central Plaza, clearly readable)
    this.createRoyalLawSignboard(-3.4, 2.2, 0.24);

    // 19. Handwritten Arabic Directional Ground Signposts pointing accurately toward landmarks
    this.createDirectionalSignpost(3.4, 2.2, [
      { label: 'في ذلك الاتجاه ⟵ قصر السلطان', targetX: 0, targetZ: -32 },
      { label: 'في ذلك الاتجاه ⟵ المعدمة لإعدام الناس', targetX: -13.5, targetZ: -14.8 },
      { label: 'في ذلك الاتجاه ⟵ البحر والميناء الملكي', targetX: -64, targetZ: 3.5 },
      { label: 'في ذلك الاتجاه ⟵ سوق المملكة', targetX: 13.2, targetZ: 6.0 },
    ]);

    this.createDirectionalSignpost(-5.2, -2.0, [
      { label: 'في ذلك الاتجاه ⟵ المعدمة لإعدام المخالفين', targetX: -13.5, targetZ: -14.8 },
      { label: 'في ذلك الاتجاه ⟵ قصر السلطان', targetX: 0, targetZ: -32 },
      { label: 'في ذلك الاتجاه ⟵ بئر المملكة', targetX: 0, targetZ: -9.5 },
    ]);

    this.createDirectionalSignpost(4.6, -15.6, [
      { label: 'في ذلك الاتجاه ⟵ بوابة قصر السلطان', targetX: 0, targetZ: -36 },
      { label: 'في ذلك الاتجاه ⟵ المدفع السلطاني', targetX: -10.0, targetZ: -27.5 },
      { label: 'في ذلك الاتجاه ⟵ السجن الملكي', targetX: 13.8, targetZ: -16.8 },
      { label: 'في ذلك الاتجاه ⟵ ساحة المعدمة', targetX: -13.5, targetZ: -14.8 },
    ]);

    this.createDirectionalSignpost(3.6, 19.5, [
      { label: 'في ذلك الاتجاه ⟵ البئر وقصر السلطان', targetX: 0, targetZ: -28 },
      { label: 'في ذلك الاتجاه ⟵ مقهى المملكة', targetX: 22.0, targetZ: 53.0 },
      { label: 'في ذلك الاتجاه ⟵ مقبرة المملكة', targetX: -25.0, targetZ: 56.0 },
      { label: 'في ذلك الاتجاه ⟵ الغابة الكبرى وبوابة الرومان', targetX: 87.5, targetZ: 3.5 },
      { label: 'في ذلك الاتجاه ⟵ المزارع والإسطبلات', targetX: -41.0, targetZ: 1.5 },
    ]);

    this.createDirectionalSignpost(44.5, 7.2, [
      { label: 'في ذلك الاتجاه ⟵ بوابة الحدود الرومانية', targetX: 87.5, targetZ: 3.5 },
      { label: 'في ذلك الاتجاه ⟵ الغابة الكبرى وأشجار الزيتون', targetX: 68.0, targetZ: -16.0 },
      { label: 'في ذلك الاتجاه ⟵ وسط المملكة', targetX: 0, targetZ: -5.5 },
    ]);

    // 20. Dedicated Gallows ("المعدمة") Ground Sign beside the execution platform
    this.createGallowsGroundSign(-10.2, -12.0, Math.PI * 0.28);

    // 21. Royal Stone & Iron Prison ("السجن الملكي") with Swinging Open/Close Door
    this.prison = new RoyalPrison(this.boxColliders, this.buildingFootprints);
    this.group.add(this.prison.group);
    this.registerRoofVolume(
      this.prison.origin.x,
      this.prison.origin.z,
      6.8,
      5.8,
      this.prison.rotY,
      4.1
    );

    // 22. Royal Cemetery ("مقبرة المملكة") with 7 Closed Graves & 1 Open Empty Grave
    this.cemetery = new RoyalCemetery(this.boxColliders, this.buildingFootprints);
    this.group.add(this.cemetery.group);

    // 23. Royal Heavy Cannon ("المدفع السلطاني") firing high & far into the sky
    this.cannon = new RoyalCannon(
      this.boxColliders,
      this.cylinderColliders,
      this.buildingFootprints
    );
    this.group.add(this.cannon.group);

    // 24. Royal Kingdom Cafe ("مقهى المملكة") with seated & standing patrons who stand & bow to Sultan
    this.cafe = new RoyalCafe(this.boxColliders, this.buildingFootprints);
    this.group.add(this.cafe.group);
    this.registerRoofVolume(CAFE_ORIGIN.x, CAFE_ORIGIN.z, 9.8, 8.0, CAFE_ROT_Y, 5.4);

    // 25. Royal Kingdom Palace ("القصر الملكي") on reserved northern grounds
    this.palace = new RoyalPalace(
      this.boxColliders,
      this.cylinderColliders,
      this.buildingFootprints
    );
    this.group.add(this.palace.group);
    // Main 2-story enclosed Palace interior (both Floor 1 and Floor 2 stay completely dry)
    this.registerRoofVolume(0, -49.25, 55.0, 38.4, 0, 9.4);
    // Ground-floor portico sheltered beneath the open-air South Overlook Balcony
    this.registerRoofVolume(0, -28.45, 35.6, 4.3, 0, 4.55);

    // 26. Royal Lion Cage at the East Palace Carriage Bay ("الكارش الملكي — قفص الأسد")
    this.lionCage = new RoyalLionCage(
      this.boxColliders,
      this.cylinderColliders,
      this.stoneMat,
      this.darkStoneMat,
      this.woodMat,
      this.ironMat,
      this.goldMat
    );
    this.group.add(this.lionCage.group);

    // 27. Military Training Camp ("معسكر الجيش الملكي") behind the Palace
    this.militaryCamp = new MilitaryCamp(
      this.boxColliders,
      this.cylinderColliders,
      this.stoneMat,
      this.darkStoneMat,
      this.woodMat,
      this.ironMat,
      this.goldMat,
      this.crimsonFabricMat
    );
    this.group.add(this.militaryCamp.group);
    // General's Command Pavilion Roof
    this.registerRoofVolume(0, -78.4, 5.8, 4.6, 0, 4.8);

    // 28. Royal Speech Podium ("منصة الخطاب الملكي") on West Palace Forecourt
    this.speechPodium = new RoyalSpeechPodium(
      this.boxColliders,
      this.cylinderColliders,
      this.buildingFootprints,
      this.stoneMat,
      this.darkStoneMat,
      this.woodMat,
      this.goldMat,
      this.crimsonFabricMat
    );
    this.group.add(this.speechPodium.group);

    // Royal Well Canopy Roof
    this.registerRoofVolume(0, -9.5, 3.1, 3.1, 0, 4.1);
  }

  /**
   * Custom-designed Royal Stone Well with hollow shaft, shimmering blue water, winch, hanging bucket, and shingled roof
   */
  private createRoyalWell(x: number, z: number) {
    const well = new THREE.Group();
    well.position.set(x, 0, z);

    // Stepped octagonal/circular stone base plinth
    const plinthGeo = this.track(new THREE.CylinderGeometry(1.72, 1.86, 0.16, 20));
    const plinth = new THREE.Mesh(plinthGeo, this.darkStoneMat);
    plinth.position.y = 0.08;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    well.add(plinth);

    // Hollow stone curb ring (using ExtrudeGeometry with circular inner hole so water is clearly visible inside)
    const outerR = 1.42;
    const innerR = 1.04;
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    ringShape.holes.push(holePath);

    const curbGeo = this.track(
      new THREE.ExtrudeGeometry(ringShape, {
        depth: 0.88,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2,
        curveSegments: 24,
      })
    );
    curbGeo.rotateX(-Math.PI / 2);
    const curb = new THREE.Mesh(curbGeo, this.stoneMat);
    curb.position.y = 0.14;
    curb.castShadow = true;
    curb.receiveShadow = true;
    well.add(curb);

    // Carved coping top stone lip
    const lipGeo = this.track(new THREE.TorusGeometry(1.23, 0.16, 10, 24));
    lipGeo.rotateX(Math.PI / 2);
    const lip = new THREE.Mesh(lipGeo, this.darkStoneMat);
    lip.position.y = 1.05;
    lip.scale.set(1, 1, 0.55);
    lip.castShadow = true;
    lip.receiveShadow = true;
    well.add(lip);

    // Dark cylindrical inner shaft backing beneath water
    const shaftGeo = this.track(new THREE.CylinderGeometry(innerR + 0.02, innerR + 0.02, 0.65, 20));
    const shaftMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x102836,
        roughness: 0.95,
      })
    );
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.42;
    well.add(shaft);

    // Visible shimmering blue water inside the well
    const waterTex = this.track(createWellWaterTexture());
    const waterGeo = this.track(new THREE.CircleGeometry(innerR + 0.01, 24));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = this.track(
      new THREE.MeshStandardMaterial({
        map: waterTex,
        color: 0x7dd3fc,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.25,
        roughness: 0.14,
        metalness: 0.35,
      })
    );
    this.wellWaterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.wellWaterMesh.position.y = 0.78;
    well.add(this.wellWaterMesh);

    // Two heavy oak side posts supporting the well roof
    const postGeo = this.track(new THREE.BoxGeometry(0.18, 1.75, 0.18));
    [-1.24, 1.24].forEach((px) => {
      const post = new THREE.Mesh(postGeo, this.darkWoodMat);
      post.position.set(px, 1.82, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      well.add(post);
    });

    // Horizontal timber winch axle & brass crank handle
    const axleGeo = this.track(new THREE.CylinderGeometry(0.075, 0.075, 2.68, 10));
    axleGeo.rotateZ(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeo, this.woodMat);
    axle.position.y = 2.02;
    axle.castShadow = true;
    well.add(axle);

    const crankGeo = this.track(new THREE.BoxGeometry(0.06, 0.28, 0.06));
    const crank = new THREE.Mesh(crankGeo, this.ironMat);
    crank.position.set(1.42, 1.9, 0.06);
    well.add(crank);

    // Hanging wooden bucket & rope above water
    const bucketGroup = new THREE.Group();
    bucketGroup.position.set(0, 1.98, 0);

    const ropeGeo = this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6));
    const ropeMat = this.track(new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.9 }));
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.y = -0.31;
    bucketGroup.add(rope);

    const bucketBodyGeo = this.track(new THREE.CylinderGeometry(0.21, 0.16, 0.32, 12));
    const bucketBody = new THREE.Mesh(bucketBodyGeo, this.woodMat);
    bucketBody.position.y = -0.74;
    bucketBody.castShadow = true;
    bucketGroup.add(bucketBody);

    const bucketWaterGeo = this.track(new THREE.CircleGeometry(0.18, 12));
    bucketWaterGeo.rotateX(-Math.PI / 2);
    const bucketWater = new THREE.Mesh(bucketWaterGeo, waterMat);
    bucketWater.position.y = -0.6;
    bucketGroup.add(bucketWater);

    this.wellBucketGroup = bucketGroup;
    well.add(bucketGroup);

    // Pitched wooden shingled roof canopy over the well
    const roofSlopeGeo = this.track(new THREE.BoxGeometry(3.1, 0.12, 1.58));
    [-1, 1].forEach((side) => {
      const slope = new THREE.Mesh(roofSlopeGeo, this.roofMats[0]);
      slope.position.set(0, 2.95, side * 0.6);
      slope.rotation.x = side * 0.62;
      slope.castShadow = true;
      slope.receiveShadow = true;
      well.add(slope);
    });

    const ridgeGeo = this.track(new THREE.BoxGeometry(3.2, 0.16, 0.2));
    const ridge = new THREE.Mesh(ridgeGeo, this.darkWoodMat);
    ridge.position.y = 3.42;
    ridge.castShadow = true;
    well.add(ridge);

    // Gold royal finial on top of the well canopy
    const finialGeo = this.track(new THREE.SphereGeometry(0.13, 10, 10));
    const finial = new THREE.Mesh(finialGeo, this.goldMat);
    finial.position.y = 3.62;
    well.add(finial);

    this.group.add(well);
    this.addCylinder(x, z, 1.75, 1.1, false);
  }

  /**
   * Half-timbered Royal Kingdom House with stone base, pitched shingled roof, chimney, arched doorway & glowing windows
   */
  private createKingdomHouse(
    x: number,
    z: number,
    rotY: number,
    roofIdx: number,
    width: number,
    depth: number,
    wallHeight: number
  ) {
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rotY;

    const plinthH = 0.34;

    // 1. Stone Foundation Plinth
    const plinthGeo = this.track(new THREE.BoxGeometry(width + 0.34, plinthH, depth + 0.34));
    const plinth = new THREE.Mesh(plinthGeo, this.darkStoneMat);
    plinth.position.y = plinthH * 0.5;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    house.add(plinth);

    // 2. Main Stucco Plaster Body
    const bodyGeo = this.track(new THREE.BoxGeometry(width, wallHeight, depth));
    const body = new THREE.Mesh(bodyGeo, this.plasterMat);
    body.position.y = plinthH + wallHeight * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // 3. Corner & Horizontal Dark Oak Timber Framing Beams
    const postGeo = this.track(new THREE.BoxGeometry(0.22, wallHeight + 0.04, 0.22));
    [-width * 0.5, width * 0.5].forEach((cx) => {
      [-depth * 0.5, depth * 0.5].forEach((cz) => {
        const post = new THREE.Mesh(postGeo, this.darkWoodMat);
        post.position.set(cx, plinthH + wallHeight * 0.5, cz);
        post.castShadow = true;
        house.add(post);
      });
    });

    const beamFBGeo = this.track(new THREE.BoxGeometry(width + 0.14, 0.18, 0.16));
    const beamLRGeo = this.track(new THREE.BoxGeometry(0.16, 0.18, depth + 0.14));
    [plinthH + wallHeight * 0.55, plinthH + wallHeight].forEach((by) => {
      [-depth * 0.5, depth * 0.5].forEach((bz) => {
        const b = new THREE.Mesh(beamFBGeo, this.darkWoodMat);
        b.position.set(0, by, bz);
        house.add(b);
      });
      [-width * 0.5, width * 0.5].forEach((bx) => {
        const b = new THREE.Mesh(beamLRGeo, this.darkWoodMat);
        b.position.set(bx, by, 0);
        house.add(b);
      });
    });

    // 4. Pitched Gable Roof + Gable End Triangles
    const roofH = 1.95;
    const roofOverhang = 0.45;
    const roofBaseY = plinthH + wallHeight;

    // Triangular gable walls at left/right ends
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-depth * 0.5, 0);
    gableShape.lineTo(depth * 0.5, 0);
    gableShape.lineTo(0, roofH);
    gableShape.closePath();

    const gableGeo = this.track(
      new THREE.ExtrudeGeometry(gableShape, {
        depth: width,
        bevelEnabled: false,
      })
    );
    gableGeo.rotateY(Math.PI / 2);
    const gableMesh = new THREE.Mesh(gableGeo, this.plasterMat);
    gableMesh.position.set(-width * 0.5, roofBaseY, 0);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    house.add(gableMesh);

    // Two pitched shingled roof slopes
    const halfSpan = depth * 0.5 + roofOverhang;
    const slopeLen = Math.hypot(halfSpan, roofH + 0.18);
    const slopeAngle = Math.atan2(roofH, depth * 0.5);
    const slopeGeo = this.track(new THREE.BoxGeometry(width + roofOverhang * 2, 0.18, slopeLen));
    const roofMat = this.roofMats[roofIdx % this.roofMats.length];

    [-1, 1].forEach((side) => {
      const slope = new THREE.Mesh(slopeGeo, roofMat);
      slope.position.set(0, roofBaseY + roofH * 0.48, side * (halfSpan * 0.5 - 0.06));
      slope.rotation.x = side * slopeAngle;
      slope.castShadow = true;
      slope.receiveShadow = true;
      house.add(slope);
    });

    // Ridge beam
    const ridgeGeo = this.track(new THREE.BoxGeometry(width + roofOverhang * 2 + 0.14, 0.22, 0.24));
    const ridge = new THREE.Mesh(ridgeGeo, this.darkWoodMat);
    ridge.position.set(0, roofBaseY + roofH + 0.05, 0);
    ridge.castShadow = true;
    house.add(ridge);

    // Stone Chimney rising out of roof
    const chimneyGeo = this.track(new THREE.BoxGeometry(0.72, 1.55, 0.72));
    const chimney = new THREE.Mesh(chimneyGeo, this.darkStoneMat);
    chimney.position.set(width * 0.28, roofBaseY + roofH * 0.85, -depth * 0.22);
    chimney.castShadow = true;
    house.add(chimney);

    const capGeo = this.track(new THREE.BoxGeometry(0.88, 0.14, 0.88));
    const cap = new THREE.Mesh(capGeo, this.stoneMat);
    cap.position.set(width * 0.28, roofBaseY + roofH * 0.85 + 0.82, -depth * 0.22);
    house.add(cap);

    // 5. Front Porch Step, Timber Door & Brass Knob (+Z face of house)
    const frontZ = depth * 0.5;
    const stepGeo = this.track(new THREE.BoxGeometry(1.55, 0.2, 0.55));
    const step = new THREE.Mesh(stepGeo, this.stoneMat);
    step.position.set(0, 0.1, frontZ + 0.36);
    step.receiveShadow = true;
    house.add(step);

    const doorFrameGeo = this.track(new THREE.BoxGeometry(1.32, 2.24, 0.14));
    const doorFrame = new THREE.Mesh(doorFrameGeo, this.darkWoodMat);
    doorFrame.position.set(0, plinthH + 1.12, frontZ + 0.04);
    house.add(doorFrame);

    const doorGeo = this.track(new THREE.BoxGeometry(1.06, 2.08, 0.18));
    const door = new THREE.Mesh(doorGeo, this.woodMat);
    door.position.set(0, plinthH + 1.04, frontZ + 0.06);
    house.add(door);

    const knobGeo = this.track(new THREE.SphereGeometry(0.06, 8, 8));
    const knob = new THREE.Mesh(knobGeo, this.goldMat);
    knob.position.set(0.36, plinthH + 1.0, frontZ + 0.17);
    house.add(knob);

    // 6. Warm Glowing Windows with Timber Frames (Front & Sides)
    const winFrameGeo = this.track(new THREE.BoxGeometry(0.95, 0.95, 0.12));
    const winGlassGeo = this.track(new THREE.BoxGeometry(0.76, 0.76, 0.15));

    // Front flanking windows
    [-width * 0.3, width * 0.3].forEach((wx) => {
      const wf = new THREE.Mesh(winFrameGeo, this.darkWoodMat);
      wf.position.set(wx, plinthH + 1.65, frontZ + 0.03);
      house.add(wf);

      const wg = new THREE.Mesh(winGlassGeo, this.windowGlowMat);
      wg.position.set(wx, plinthH + 1.65, frontZ + 0.05);
      house.add(wg);
    });

    // Side windows
    [-width * 0.5, width * 0.5].forEach((sx) => {
      const wf = new THREE.Mesh(winFrameGeo, this.darkWoodMat);
      wf.rotation.y = Math.PI / 2;
      wf.position.set(sx + (sx > 0 ? 0.03 : -0.03), plinthH + 1.65, 0);
      house.add(wf);

      const wg = new THREE.Mesh(winGlassGeo, this.windowGlowMat);
      wg.rotation.y = Math.PI / 2;
      wg.position.set(sx + (sx > 0 ? 0.05 : -0.05), plinthH + 1.65, 0);
      house.add(wg);
    });

    this.group.add(house);
    this.addOBB(x, z, width + 0.45, depth + 0.6, rotY, roofBaseY + roofH, false);
    this.registerRoofVolume(x, z, width + 1.0, depth + 1.0, rotY, roofBaseY + roofH);
    this.buildingFootprints.push({ x, z, r: Math.hypot(width, depth) * 0.55 + 1.2 });
  }

  /**
   * Type 2: Tall Two-Story Royal Manor with flush stone & timbered upper story and front balcony
   */
  private createTwoStoryManor(x: number, z: number, rotY: number, roofIdx: number) {
    const manor = new THREE.Group();
    manor.position.set(x, 0, z);
    manor.rotation.y = rotY;

    const w = 6.0;
    const d = 4.6;
    const h1 = 2.8;
    const h2 = 2.6;
    const plinthH = 0.35;

    const plinth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.36, plinthH, d + 0.36)),
      this.darkStoneMat
    );
    plinth.position.y = plinthH * 0.5;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    manor.add(plinth);

    const floor1 = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h1, d)), this.stoneMat);
    floor1.position.y = plinthH + h1 * 0.5;
    floor1.castShadow = true;
    floor1.receiveShadow = true;
    manor.add(floor1);

    // Flush upper plaster story aligned cleanly with ground floor walls
    const floor2Base = plinthH + h1;
    const floor2 = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h2, d)), this.plasterMat);
    floor2.position.y = floor2Base + h2 * 0.5;
    floor2.castShadow = true;
    floor2.receiveShadow = true;
    manor.add(floor2);

    // Continuous Timber Framing Posts & Horizontal Floor Belt
    const belt = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.16, 0.2, d + 0.16)),
      this.darkWoodMat
    );
    belt.position.y = floor2Base;
    manor.add(belt);

    const cornerGeo = this.track(new THREE.BoxGeometry(0.22, h1 + h2 + 0.04, 0.22));
    [-w * 0.5, w * 0.5].forEach((cx) => {
      [-d * 0.5, d * 0.5].forEach((cz) => {
        const p = new THREE.Mesh(cornerGeo, this.darkWoodMat);
        p.position.set(cx, plinthH + (h1 + h2) * 0.5, cz);
        manor.add(p);
      });
    });

    // Steep Unified Pitched Roof
    const roofBaseY = floor2Base + h2;
    const roofH = 2.05;
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-d * 0.5, 0);
    gableShape.lineTo(d * 0.5, 0);
    gableShape.lineTo(0, roofH);
    gableShape.closePath();

    const gableGeo = this.track(
      new THREE.ExtrudeGeometry(gableShape, { depth: w, bevelEnabled: false })
    );
    gableGeo.rotateY(Math.PI / 2);
    const gable = new THREE.Mesh(gableGeo, this.plasterMat);
    gable.position.set(-w * 0.5, roofBaseY, 0);
    gable.castShadow = true;
    manor.add(gable);

    const halfSpan = d * 0.5 + 0.48;
    const slopeLen = Math.hypot(halfSpan, roofH + 0.2);
    const slopeAngle = Math.atan2(roofH, d * 0.5);
    const slopeGeo = this.track(new THREE.BoxGeometry(w + 0.9, 0.2, slopeLen));
    const roofMat = this.roofMats[roofIdx % this.roofMats.length];

    [-1, 1].forEach((side) => {
      const slope = new THREE.Mesh(slopeGeo, roofMat);
      slope.position.set(0, roofBaseY + roofH * 0.48, side * (halfSpan * 0.5 - 0.06));
      slope.rotation.x = side * slopeAngle;
      slope.castShadow = true;
      slope.receiveShadow = true;
      manor.add(slope);
    });

    // Front Balcony & Grand Doorway
    const frontZ = d * 0.5;
    const balconyFloor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.5, 0.14, 0.85)),
      this.darkWoodMat
    );
    balconyFloor.position.set(0, floor2Base + 0.08, frontZ + 0.4);
    balconyFloor.castShadow = true;
    manor.add(balconyFloor);

    const rail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.5, 0.52, 0.09)),
      this.woodMat
    );
    rail.position.set(0, floor2Base + 0.4, frontZ + 0.78);
    manor.add(rail);

    const doorFrame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.5, 2.3, 0.16)),
      this.darkWoodMat
    );
    doorFrame.position.set(0, plinthH + 1.15, frontZ + 0.04);
    manor.add(doorFrame);

    const door = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.24, 2.12, 0.2)),
      this.woodMat
    );
    door.position.set(0, plinthH + 1.06, frontZ + 0.06);
    manor.add(door);

    const winF = this.track(new THREE.BoxGeometry(0.9, 0.95, 0.12));
    const winG = this.track(new THREE.BoxGeometry(0.72, 0.76, 0.16));
    [-1.9, 1.9].forEach((wx) => {
      const wf1 = new THREE.Mesh(winF, this.darkWoodMat);
      wf1.position.set(wx, plinthH + 1.48, frontZ + 0.04);
      manor.add(wf1);
      const wg1 = new THREE.Mesh(winG, this.windowGlowMat);
      wg1.position.set(wx, plinthH + 1.48, frontZ + 0.06);
      manor.add(wg1);

      const wf2 = new THREE.Mesh(winF, this.darkWoodMat);
      wf2.position.set(wx, floor2Base + 1.38, frontZ + 0.04);
      manor.add(wf2);
      const wg2 = new THREE.Mesh(winG, this.windowGlowMat);
      wg2.position.set(wx, floor2Base + 1.38, frontZ + 0.06);
      manor.add(wg2);
    });

    this.group.add(manor);
    this.addOBB(x, z, w + 0.4, d + 0.6, rotY, roofBaseY + roofH, false);
    this.registerRoofVolume(x, z, w + 1.0, d + 1.1, rotY, roofBaseY + roofH);
    this.buildingFootprints.push({ x, z, r: Math.hypot(w, d) * 0.55 + 1.2 });
  }

  /**
   * Type 3: Courtyard Porch Villa (Main hall + attached timber veranda wing with clean lean-to roof)
   */
  private createLShapedVilla(x: number, z: number, rotY: number, roofIdx: number) {
    const villa = new THREE.Group();
    villa.position.set(x, 0, z);
    villa.rotation.y = rotY;

    const w = 5.4;
    const d = 4.2;
    const h = 3.25;
    const plinthH = 0.32;
    const roofMat = this.roofMats[roofIdx % this.roofMats.length];

    // Main Hall Body offset slightly to -X so side porch fits cleanly at +X
    const mainShiftX = -0.9;
    const plinth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.3, plinthH, d + 0.3)),
      this.darkStoneMat
    );
    plinth.position.set(mainShiftX, plinthH * 0.5, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    villa.add(plinth);

    const body = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w, h, d)),
      this.plasterMat
    );
    body.position.set(mainShiftX, plinthH + h * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    villa.add(body);

    // Pitched Roof on Main Hall
    const roofBaseY = plinthH + h;
    const roofH = 1.9;
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-d * 0.5, 0);
    gableShape.lineTo(d * 0.5, 0);
    gableShape.lineTo(0, roofH);
    gableShape.closePath();

    const gableGeo = this.track(
      new THREE.ExtrudeGeometry(gableShape, { depth: w, bevelEnabled: false })
    );
    gableGeo.rotateY(Math.PI / 2);
    const gable = new THREE.Mesh(gableGeo, this.plasterMat);
    gable.position.set(mainShiftX - w * 0.5, roofBaseY, 0);
    gable.castShadow = true;
    villa.add(gable);

    const halfSpan = d * 0.5 + 0.42;
    const slopeLen = Math.hypot(halfSpan, roofH + 0.18);
    const slopeAngle = Math.atan2(roofH, d * 0.5);
    const slopeGeo = this.track(new THREE.BoxGeometry(w + 0.7, 0.18, slopeLen));

    [-1, 1].forEach((side) => {
      const slope = new THREE.Mesh(slopeGeo, roofMat);
      slope.position.set(mainShiftX, roofBaseY + roofH * 0.48, side * (halfSpan * 0.5 - 0.05));
      slope.rotation.x = side * slopeAngle;
      slope.castShadow = true;
      slope.receiveShadow = true;
      villa.add(slope);
    });

    // Attached Wooden Side Veranda Porch Wing (cleanly abutting at +X = mainShiftX + w/2)
    const porchW = 2.4;
    const porchD = 3.8;
    const porchCenterX = mainShiftX + w * 0.5 + porchW * 0.5;

    const deck = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(porchW, 0.28, porchD)),
      this.woodMat
    );
    deck.position.set(porchCenterX, 0.14, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    villa.add(deck);

    // Corner Timber Posts & Railing
    const pPostGeo = this.track(new THREE.BoxGeometry(0.16, 2.35, 0.16));
    [-porchD * 0.44, porchD * 0.44].forEach((pz) => {
      const post = new THREE.Mesh(pPostGeo, this.darkWoodMat);
      post.position.set(porchCenterX + porchW * 0.42, 0.28 + 1.17, pz);
      post.castShadow = true;
      villa.add(post);
    });

    // Clean Sloped Lean-To Porch Roof below main eave
    const porchRoof = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(porchW + 0.35, 0.14, porchD + 0.4)),
      roofMat
    );
    porchRoof.position.set(porchCenterX + 0.08, 2.82, 0);
    porchRoof.rotation.z = -0.28;
    porchRoof.castShadow = true;
    villa.add(porchRoof);

    // Front Door & Glowing Windows
    const frontZ = d * 0.5;
    const door = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.12, 2.1, 0.18)),
      this.woodMat
    );
    door.position.set(mainShiftX - 0.7, plinthH + 1.05, frontZ + 0.05);
    villa.add(door);

    const win = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.9, 0.9, 0.16)),
      this.windowGlowMat
    );
    win.position.set(mainShiftX + 1.25, plinthH + 1.65, frontZ + 0.04);
    villa.add(win);

    this.group.add(villa);
    this.addOBB(x + 0.15, z, w + porchW + 0.4, d + 0.5, rotY, roofBaseY + roofH, false);
    this.registerRoofVolume(x + 0.15, z, w + porchW + 0.9, d + 1.0, rotY, roofBaseY + roofH);
    this.buildingFootprints.push({ x, z, r: 5.0 });
  }

  /**
   * Type 4: Circular/Octagonal Stone Watchtower House with wooden upper battlement & conical shingled spire
   */
  private createRoundTowerHouse(x: number, z: number, rotY: number, roofIdx: number) {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    tower.rotation.y = rotY;

    const r = 2.35;
    const h = 5.4;
    const roofMat = this.roofMats[roofIdx % this.roofMats.length];

    // Stepped Stone Base
    const base = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(r + 0.28, r + 0.42, 0.55, 10)),
      this.darkStoneMat
    );
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;
    tower.add(base);

    // Tall Cylindrical/Decagonal Stone Tower Shaft
    const shaft = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(r * 0.94, r, h, 10)),
      this.stoneMat
    );
    shaft.position.y = 0.55 + h * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    tower.add(shaft);

    // Upper Timber Overhang Guard Gallery
    const gallery = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(r + 0.36, r + 0.18, 1.25, 10)),
      this.darkWoodMat
    );
    gallery.position.y = 0.55 + h + 0.4;
    gallery.castShadow = true;
    tower.add(gallery);

    // Tall Conical Shingled Roof + Golden Spire Finial
    const coneH = 2.75;
    const roof = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(r + 0.72, coneH, 10)),
      roofMat
    );
    roof.position.y = 0.55 + h + 1.02 + coneH * 0.5;
    roof.castShadow = true;
    tower.add(roof);

    const spire = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.22, 0)),
      this.goldMat
    );
    spire.position.y = 0.55 + h + 1.02 + coneH + 0.2;
    tower.add(spire);

    // Arched Front Door & Glowing Tower Windows
    const door = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.1, 2.05, 0.28)),
      this.woodMat
    );
    door.position.set(0, 0.55 + 1.02, r - 0.08);
    tower.add(door);

    [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5].forEach((wa) => {
      const wg = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.68, 0.85, 0.16)),
        this.windowGlowMat
      );
      wg.position.set(Math.sin(wa) * (r - 0.04), 3.65, Math.cos(wa) * (r - 0.04));
      wg.rotation.y = wa;
      tower.add(wg);
    });

    this.group.add(tower);
    this.addCylinder(x, z, r + 0.45, 9.5, false);
    this.registerRoofVolume(x, z, (r + 0.7) * 2, (r + 0.7) * 2, rotY, 9.5);
    this.buildingFootprints.push({ x, z, r: r + 1.6 });
  }

  /**
   * Type 5: Wide Timber & Stone Royal Stable / Barn with large double doors & hay bales
   */
  private createRoyalStableBarn(x: number, z: number, rotY: number, roofIdx: number) {
    const barn = new THREE.Group();
    barn.position.set(x, 0, z);
    barn.rotation.y = rotY;

    const w = 6.8;
    const d = 5.0;
    const h = 3.2;
    const roofMat = this.roofMats[roofIdx % this.roofMats.length];

    const plinth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3)),
      this.darkStoneMat
    );
    plinth.position.y = 0.15;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    barn.add(plinth);

    const walls = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, d)), this.woodMat);
    walls.position.y = 0.3 + h * 0.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    barn.add(walls);

    // Pitched Barn Roof
    const roofH = 2.05;
    const roofBaseY = 0.3 + h;
    const halfSpan = d * 0.5 + 0.45;
    const slopeLen = Math.hypot(halfSpan, roofH + 0.18);
    const slopeAngle = Math.atan2(roofH, d * 0.5);
    const slopeGeo = this.track(new THREE.BoxGeometry(w + 0.8, 0.18, slopeLen));

    [-1, 1].forEach((side) => {
      const slope = new THREE.Mesh(slopeGeo, roofMat);
      slope.position.set(0, roofBaseY + roofH * 0.48, side * (halfSpan * 0.5 - 0.06));
      slope.rotation.x = side * slopeAngle;
      slope.castShadow = true;
      barn.add(slope);
    });

    // Large Double Stable Doors (+Z)
    const door = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.5, 2.45, 0.2)),
      this.darkWoodMat
    );
    door.position.set(0, 0.3 + 1.22, d * 0.5 + 0.05);
    barn.add(door);

    // Hay Bales beside Stable Entrance
    const hayMat = this.goldMat;
    const hayGeo = this.track(new THREE.BoxGeometry(0.95, 0.62, 0.68));
    [-2.4, 2.4].forEach((hx) => {
      const hay = new THREE.Mesh(hayGeo, hayMat);
      hay.position.set(hx, 0.31, d * 0.5 + 0.52);
      hay.castShadow = true;
      barn.add(hay);
    });

    this.group.add(barn);
    this.addOBB(x, z, w + 0.45, d + 0.7, rotY, roofBaseY + roofH, false);
    this.registerRoofVolume(x, z, w + 0.9, d + 1.0, rotY, roofBaseY + roofH);
    this.buildingFootprints.push({ x, z, r: Math.hypot(w, d) * 0.55 + 1.4 });
  }

  private createWoodenFence(x: number, z: number, length: number, rotY: number) {
    const fence = new THREE.Group();
    fence.position.set(x, 0, z);
    fence.rotation.y = rotY;

    const postCount = Math.max(3, Math.round(length / 2.2) + 1);
    const postGeo = this.track(new THREE.BoxGeometry(0.14, 0.95, 0.14));
    for (let i = 0; i < postCount; i++) {
      const px = -length * 0.5 + (i / (postCount - 1)) * length;
      const post = new THREE.Mesh(postGeo, this.darkWoodMat);
      post.position.set(px, 0.475, 0);
      post.castShadow = true;
      fence.add(post);
    }

    const railGeo = this.track(new THREE.BoxGeometry(length, 0.1, 0.07));
    [0.36, 0.74].forEach((ry) => {
      const rail = new THREE.Mesh(railGeo, this.woodMat);
      rail.position.set(0, ry, 0);
      rail.castShadow = true;
      fence.add(rail);
    });

    this.group.add(fence);
    this.addOBB(x, z, length + 0.2, 0.36, rotY, 0.95, false);
  }

  /**
   * Royal Plaza Bench with timber slats and wrought-iron/gold trim
   */
  private createRoyalBench(x: number, z: number, rotY: number) {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotY;

    const seatGeo = this.track(new THREE.BoxGeometry(2.1, 0.1, 0.62));
    const seat = new THREE.Mesh(seatGeo, this.woodMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);

    const backGeo = this.track(new THREE.BoxGeometry(2.1, 0.44, 0.09));
    const back = new THREE.Mesh(backGeo, this.woodMat);
    back.position.set(0, 0.78, -0.26);
    back.rotation.x = -0.14;
    back.castShadow = true;
    bench.add(back);

    const legGeo = this.track(new THREE.BoxGeometry(0.12, 0.46, 0.56));
    const armGeo = this.track(new THREE.BoxGeometry(0.1, 0.24, 0.6));
    [-0.92, 0.92].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, this.ironMat);
      leg.position.set(lx, 0.23, 0);
      leg.castShadow = true;
      bench.add(leg);

      const arm = new THREE.Mesh(armGeo, this.darkWoodMat);
      arm.position.set(lx, 0.62, -0.02);
      bench.add(arm);
    });

    this.group.add(bench);
    this.addOBB(x, z, 2.2, 0.74, rotY, 0.52, true);
  }

  /**
   * Outdoor Royal Dining Table with Flanking Wooden Chairs & Golden Goblets
   */
  private createFeastTableSet(x: number, z: number, rotY: number) {
    const setGroup = new THREE.Group();
    setGroup.position.set(x, 0, z);
    setGroup.rotation.y = rotY;

    // Tabletop
    const topGeo = this.track(new THREE.BoxGeometry(2.15, 0.12, 1.15));
    const top = new THREE.Mesh(topGeo, this.woodMat);
    top.position.y = 0.84;
    top.castShadow = true;
    top.receiveShadow = true;
    setGroup.add(top);

    // Table legs
    const legGeo = this.track(new THREE.BoxGeometry(0.14, 0.82, 0.14));
    [-0.86, 0.86].forEach((lx) => {
      [-0.42, 0.42].forEach((lz) => {
        const leg = new THREE.Mesh(legGeo, this.darkWoodMat);
        leg.position.set(lx, 0.41, lz);
        leg.castShadow = true;
        setGroup.add(leg);
      });
    });

    // Golden Goblets & Plates on table
    const plateGeo = this.track(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 12));
    const gobletGeo = this.track(new THREE.CylinderGeometry(0.06, 0.04, 0.16, 10));
    [-0.55, 0.55].forEach((gx) => {
      const plate = new THREE.Mesh(plateGeo, this.creamFabricMat);
      plate.position.set(gx, 0.915, 0.18);
      setGroup.add(plate);

      const goblet = new THREE.Mesh(gobletGeo, this.goldMat);
      goblet.position.set(gx + 0.16, 0.98, -0.1);
      setGroup.add(goblet);
    });

    // Two Chairs on opposite long sides
    const chairSeatGeo = this.track(new THREE.BoxGeometry(0.52, 0.08, 0.5));
    const chairBackGeo = this.track(new THREE.BoxGeometry(0.52, 0.48, 0.08));
    const chairLegGeo = this.track(new THREE.BoxGeometry(0.08, 0.46, 0.46));

    [
      { cx: -0.45, cz: -0.82, ry: 0 },
      { cx: 0.45, cz: -0.82, ry: 0 },
      { cx: -0.45, cz: 0.82, ry: Math.PI },
      { cx: 0.45, cz: 0.82, ry: Math.PI },
    ].forEach((c) => {
      const chair = new THREE.Group();
      chair.position.set(c.cx, 0, c.cz);
      chair.rotation.y = c.ry;

      const cSeat = new THREE.Mesh(chairSeatGeo, this.woodMat);
      cSeat.position.y = 0.46;
      cSeat.castShadow = true;
      chair.add(cSeat);

      const cBack = new THREE.Mesh(chairBackGeo, this.darkWoodMat);
      cBack.position.set(0, 0.72, -0.21);
      chair.add(cBack);

      [-0.2, 0.2].forEach((clx) => {
        const cLeg = new THREE.Mesh(chairLegGeo, this.darkWoodMat);
        cLeg.position.set(clx, 0.23, 0);
        chair.add(cLeg);
      });

      setGroup.add(chair);
    });

    this.group.add(setGroup);
    this.addOBB(x, z, 2.3, 2.25, rotY, 0.92, true);
  }

  /**
   * Royal Market Stall with striped awning, wooden counter & display crates
   */
  private createMarketStall(x: number, z: number, rotY: number, crimsonTheme: boolean) {
    const stall = new THREE.Group();
    stall.position.set(x, 0, z);
    stall.rotation.y = rotY;

    // Counter base
    const counterGeo = this.track(new THREE.BoxGeometry(3.2, 0.96, 1.35));
    const counter = new THREE.Mesh(counterGeo, this.darkWoodMat);
    counter.position.y = 0.48;
    counter.castShadow = true;
    counter.receiveShadow = true;
    stall.add(counter);

    const counterTopGeo = this.track(new THREE.BoxGeometry(3.38, 0.1, 1.52));
    const counterTop = new THREE.Mesh(counterTopGeo, this.woodMat);
    counterTop.position.y = 1.0;
    counterTop.castShadow = true;
    stall.add(counterTop);

    // 4 Corner Posts
    const postGeo = this.track(new THREE.BoxGeometry(0.14, 2.65, 0.14));
    [-1.48, 1.48].forEach((px) => {
      [-0.6, 0.6].forEach((pz) => {
        const post = new THREE.Mesh(postGeo, this.darkWoodMat);
        post.position.set(px, 1.32, pz);
        post.castShadow = true;
        stall.add(post);
      });
    });

    // Striped Fabric Canopy Awning
    const stripeCount = 7;
    const stripeW = 3.4 / stripeCount;
    const stripeGeo = this.track(new THREE.BoxGeometry(stripeW, 0.08, 1.85));
    const primaryMat = crimsonTheme ? this.crimsonFabricMat : this.cobaltFabricMat;

    for (let s = 0; s < stripeCount; s++) {
      const stripe = new THREE.Mesh(stripeGeo, s % 2 === 0 ? primaryMat : this.creamFabricMat);
      stripe.position.set(-1.7 + stripeW * (s + 0.5), 2.55, 0.08);
      stripe.rotation.x = 0.22;
      stripe.castShadow = true;
      stall.add(stripe);
    }

    // Small display crates on the counter
    const trayGeo = this.track(new THREE.BoxGeometry(0.75, 0.18, 0.52));
    const orbGeo = this.track(new THREE.SphereGeometry(0.09, 8, 8));
    const goldGoodsMat = this.goldMat;
    const redGoodsMat = this.crimsonFabricMat;

    [-0.85, 0, 0.85].forEach((tx, idx) => {
      const tray = new THREE.Mesh(trayGeo, this.woodMat);
      tray.position.set(tx, 1.14, 0.05);
      stall.add(tray);

      const goodMat = idx === 1 ? goldGoodsMat : redGoodsMat;
      for (let g = 0; g < 3; g++) {
        const orb = new THREE.Mesh(orbGeo, goodMat);
        orb.position.set(tx + (g - 1) * 0.2, 1.26, 0.05);
        stall.add(orb);
      }
    });

    this.group.add(stall);
    this.addOBB(x, z, 3.45, 1.65, rotY, 2.6, false);
    this.registerRoofVolume(x, z, 3.6, 2.0, rotY, 2.8);
  }

  /**
   * Kingdom Street Lantern Pillar with glowing golden amber lamp
   */
  private createStreetLantern(x: number, z: number) {
    const lantern = new THREE.Group();
    lantern.position.set(x, 0, z);

    const baseGeo = this.track(new THREE.CylinderGeometry(0.24, 0.34, 0.42, 8));
    const base = new THREE.Mesh(baseGeo, this.darkStoneMat);
    base.position.y = 0.21;
    base.castShadow = true;
    lantern.add(base);

    const poleGeo = this.track(new THREE.CylinderGeometry(0.06, 0.09, 2.75, 8));
    const pole = new THREE.Mesh(poleGeo, this.ironMat);
    pole.position.y = 1.78;
    pole.castShadow = true;
    lantern.add(pole);

    const coreGeo = this.track(new THREE.CylinderGeometry(0.17, 0.13, 0.34, 6));
    const core = new THREE.Mesh(coreGeo, this.lanternGlowMat);
    core.position.y = 3.25;
    lantern.add(core);

    const capGeo = this.track(new THREE.ConeGeometry(0.26, 0.22, 6));
    const cap = new THREE.Mesh(capGeo, this.ironMat);
    cap.position.y = 3.52;
    lantern.add(cap);

    this.group.add(lantern);
    this.addCylinder(x, z, 0.36, 3.6, false);
  }

  /**
   * Cluster of Wooden Barrels and Supply Crates
   */
  private createPropCluster(x: number, z: number, rotY: number) {
    const cluster = new THREE.Group();
    cluster.position.set(x, 0, z);
    cluster.rotation.y = rotY;

    // Banded Wooden Crate
    const crateGeo = this.track(new THREE.BoxGeometry(0.86, 0.86, 0.86));
    const crate = new THREE.Mesh(crateGeo, this.woodMat);
    crate.position.set(-0.42, 0.43, 0);
    crate.castShadow = true;
    crate.receiveShadow = true;
    cluster.add(crate);

    // Oak Barrel
    const barrelGeo = this.track(new THREE.CylinderGeometry(0.36, 0.32, 0.94, 12));
    const barrel = new THREE.Mesh(barrelGeo, this.darkWoodMat);
    barrel.position.set(0.45, 0.47, 0.2);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    cluster.add(barrel);

    const hoopGeo = this.track(new THREE.TorusGeometry(0.355, 0.024, 6, 14));
    hoopGeo.rotateX(Math.PI / 2);
    [0.24, 0.72].forEach((hy) => {
      const hoop = new THREE.Mesh(hoopGeo, this.ironMat);
      hoop.position.set(0.45, hy, 0.2);
      cluster.add(hoop);
    });

    this.group.add(cluster);
    this.addCylinder(x, z, 1.02, 0.95, true);
  }

  /**
   * Tall Royal Crimson & Gold Banner Pole marking the reserved Palace entrance
   */
  private createRoyalBanner(x: number, z: number, rotY: number) {
    const banner = new THREE.Group();
    banner.position.set(x, 0, z);
    banner.rotation.y = rotY;

    const plinthGeo = this.track(new THREE.CylinderGeometry(0.3, 0.4, 0.35, 8));
    const plinth = new THREE.Mesh(plinthGeo, this.stoneMat);
    plinth.position.y = 0.175;
    plinth.castShadow = true;
    banner.add(plinth);

    const poleGeo = this.track(new THREE.CylinderGeometry(0.055, 0.075, 4.2, 8));
    const pole = new THREE.Mesh(poleGeo, this.darkWoodMat);
    pole.position.y = 2.28;
    pole.castShadow = true;
    banner.add(pole);

    const crossbarGeo = this.track(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6));
    crossbarGeo.rotateZ(Math.PI / 2);
    const crossbar = new THREE.Mesh(crossbarGeo, this.goldMat);
    crossbar.position.set(0, 4.0, 0.14);
    banner.add(crossbar);

    const finialGeo = this.track(new THREE.OctahedronGeometry(0.16, 0));
    const finial = new THREE.Mesh(finialGeo, this.goldMat);
    finial.position.y = 4.46;
    banner.add(finial);

    const clothGeo = this.track(new THREE.PlaneGeometry(0.95, 2.25, 1, 6));
    const cloth = new THREE.Mesh(clothGeo, this.crimsonFabricMat);
    cloth.position.set(0, 2.86, 0.16);
    cloth.castShadow = true;
    banner.add(cloth);
    this.bannerCloths.push(cloth);

    const trimGeo = this.track(new THREE.BoxGeometry(0.98, 0.14, 0.04));
    const trim = new THREE.Mesh(trimGeo, this.goldMat);
    trim.position.set(0, 1.78, 0.16);
    banner.add(trim);

    this.group.add(banner);
    this.addCylinder(x, z, 0.42, 4.5, false);
  }

  /**
   * Tall Raised Wooden Royal Gallows with Stairs, Hinged Trapdoor, Lever & Hanging Noose Rope
   */
  private createRoyalGallows(x: number, z: number, rotY: number) {
    const gallows = new THREE.Group();
    gallows.position.set(x, 0, z);
    gallows.rotation.y = rotY;

    const deckW = 3.8;
    const deckD = 3.4;
    const deckH = 1.05;

    // 4 Corner stone piers supporting the wooden deck
    const pierGeo = this.track(new THREE.BoxGeometry(0.45, deckH - 0.14, 0.45));
    [-1.6, 1.6].forEach((px) => {
      [-1.4, 1.4].forEach((pz) => {
        const pier = new THREE.Mesh(pierGeo, this.darkStoneMat);
        pier.position.set(px, (deckH - 0.14) * 0.5, pz);
        pier.castShadow = true;
        pier.receiveShadow = true;
        gallows.add(pier);
      });
    });

    // Heavy timber deck surrounding central trapdoor opening (0.95 x 0.95 hole in center)
    const sideDeckGeo = this.track(new THREE.BoxGeometry(1.42, 0.18, deckD));
    [-1.19, 1.19].forEach((dx) => {
      const part = new THREE.Mesh(sideDeckGeo, this.darkWoodMat);
      part.position.set(dx, deckH - 0.09, 0);
      part.castShadow = true;
      part.receiveShadow = true;
      gallows.add(part);
    });
    const fbDeckGeo = this.track(new THREE.BoxGeometry(0.96, 0.18, 1.22));
    [-1.09, 1.09].forEach((dz) => {
      const part = new THREE.Mesh(fbDeckGeo, this.darkWoodMat);
      part.position.set(0, deckH - 0.09, dz);
      part.castShadow = true;
      part.receiveShadow = true;
      gallows.add(part);
    });

    // Hinged Trapdoor inside the center opening
    const trapdoorPivot = new THREE.Group();
    trapdoorPivot.position.set(0, deckH - 0.02, -0.46);
    const trapLeaf = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.92, 0.08, 0.92)),
      this.woodMat
    );
    trapLeaf.position.set(0, 0, 0.46);
    trapLeaf.castShadow = true;
    trapLeaf.receiveShadow = true;
    trapdoorPivot.add(trapLeaf);

    const hingeGeo = this.track(new THREE.BoxGeometry(0.14, 0.05, 0.18));
    [-0.28, 0.28].forEach((hx) => {
      const hinge = new THREE.Mesh(hingeGeo, this.ironMat);
      hinge.position.set(hx, 0.03, 0.06);
      trapdoorPivot.add(hinge);
    });
    gallows.add(trapdoorPivot);

    // Wide Front Wooden Staircase (+Z side) so Sultan/NPCs can step onto the deck
    const stepCount = 4;
    const stepW = 1.6;
    const stepD = 0.34;
    for (let s = 0; s < stepCount; s++) {
      const sh = ((s + 1) / stepCount) * (deckH - 0.1);
      const sz = deckD * 0.5 + (stepCount - s - 0.5) * stepD;
      const stepMesh = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(stepW, sh, stepD + 0.04)),
        this.woodMat
      );
      stepMesh.position.set(0, sh * 0.5, sz);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      gallows.add(stepMesh);

      const ws = new THREE.Vector3(0, 0, sz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      this.addOBB(x + ws.x, z + ws.z, stepW, stepD + 0.04, rotY, sh, true);
    }

    // Back & Side Wooden Guard Rails
    const railPostGeo = this.track(new THREE.BoxGeometry(0.12, 0.95, 0.12));
    [-1.75, 1.75].forEach((rx) => {
      [-1.55, 0, 1.55].forEach((rz) => {
        const post = new THREE.Mesh(railPostGeo, this.darkWoodMat);
        post.position.set(rx, deckH + 0.47, rz);
        post.castShadow = true;
        gallows.add(post);
      });
      const sideRail = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.1, 0.1, 3.2)),
        this.woodMat
      );
      sideRail.position.set(rx, deckH + 0.85, 0);
      gallows.add(sideRail);
    });
    const backRail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.6, 0.1, 0.1)),
      this.woodMat
    );
    backRail.position.set(0, deckH + 0.85, -1.55);
    gallows.add(backRail);

    // Tall Heavy Upright Timber Gallows Frame (-Z / left-back corner & overhead beam)
    const beamPostH = 3.55;
    const mainPost = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, beamPostH, 0.24)),
      this.darkWoodMat
    );
    mainPost.position.set(0, deckH + beamPostH * 0.5, -1.32);
    mainPost.castShadow = true;
    gallows.add(mainPost);

    // Overhead Cantilever Arm extending straight over the trapdoor at z = 0
    const armBeam = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.22, 0.22, 1.95)),
      this.darkWoodMat
    );
    armBeam.position.set(0, deckH + beamPostH - 0.1, -0.5);
    armBeam.castShadow = true;
    gallows.add(armBeam);

    // Diagonal Structural Timber Brace
    const brace = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.14, 1.15, 0.14)),
      this.woodMat
    );
    brace.position.set(0, deckH + beamPostH - 0.55, -0.92);
    brace.rotation.x = Math.PI / 4;
    brace.castShadow = true;
    gallows.add(brace);

    // Iron Hanging Hook & Noose Rope Assembly above the Trapdoor
    const ropeGroup = new THREE.Group();
    ropeGroup.position.set(0, deckH + beamPostH - 0.2, 0.04);

    const ironRing = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.08, 0.02, 8, 12)),
      this.ironMat
    );
    ropeGroup.add(ironRing);

    const dropLen = 1.45;
    const verticalRope = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.028, 0.028, dropLen, 8)),
      this.ropeMat
    );
    verticalRope.position.y = -dropLen * 0.5;
    verticalRope.castShadow = true;
    ropeGroup.add(verticalRope);

    // Coiled rope knot & noose loop at bottom
    const knot = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8)),
      this.ropeMat
    );
    knot.position.y = -dropLen;
    ropeGroup.add(knot);

    const nooseLoop = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.16, 0.026, 8, 16)),
      this.ropeMat
    );
    nooseLoop.position.y = -dropLen - 0.18;
    ropeGroup.add(nooseLoop);
    gallows.add(ropeGroup);

    // Side Execution Pull Lever
    const leverPivot = new THREE.Group();
    leverPivot.position.set(1.15, deckH, -0.35);
    const leverBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, 0.14, 0.36)),
      this.ironMat
    );
    leverBase.position.y = 0.07;
    leverPivot.add(leverBase);

    const leverArm = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.032, 0.04, 0.95, 8)),
      this.ironMat
    );
    leverArm.position.y = 0.52;
    leverArm.rotation.x = -0.35;
    leverArm.castShadow = true;
    leverPivot.add(leverArm);

    const leverKnob = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.065, 8, 8)),
      this.goldMat
    );
    leverKnob.position.set(0, 0.94, -0.17);
    leverPivot.add(leverKnob);
    gallows.add(leverPivot);

    this.group.add(gallows);

    // Walkable deck collider + solid upright post collider
    this.addOBB(x, z, deckW, deckD, rotY, deckH, true);
    const postWorld = new THREE.Vector3(0, 0, -1.32)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      .add(new THREE.Vector3(x, 0, z));
    this.addCylinder(postWorld.x, postWorld.z, 0.35, deckH + beamPostH, false);
    this.buildingFootprints.push({ x, z, r: 3.4 });

    const trapWorld = new THREE.Vector3(0, deckH, 0.04)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      .add(new THREE.Vector3(x, 0, z));
    const leverWorld = new THREE.Vector3(1.15, deckH, -0.35)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      .add(new THREE.Vector3(x, 0, z));

    this.gallowsAnchor = {
      deckCenter: new THREE.Vector3(x, deckH, z),
      trapdoorWorldPos: trapWorld,
      leverWorldPos: leverWorld,
      rotY,
      deckHeight: deckH,
      ropeAnchorWorldY: deckH + beamPostH - 0.2,
      trapdoorPivot,
      leverPivot,
      ropeGroup,
      verticalRope,
      knot,
      nooseLoop,
    };
  }

  /**
   * Crumbling Ruined House with Jagged Half-Walls, Snapped Beams, Fallen Shingles & Rubble
   */
  private createRuinedHouse(x: number, z: number, rotY: number) {
    const ruin = new THREE.Group();
    ruin.position.set(x, 0, z);
    ruin.rotation.y = rotY;

    const w = 5.4;
    const d = 4.4;

    // Cracked Foundation Plinth
    const plinth = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w + 0.3, 0.28, d + 0.3)),
      this.darkStoneMat
    );
    plinth.position.y = 0.14;
    plinth.receiveShadow = true;
    ruin.add(plinth);

    // Jagged Standing Left & Back Half-Walls
    const leftWall = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.42, 2.7, d * 0.72)),
      this.stoneMat
    );
    leftWall.position.set(-w * 0.5 + 0.21, 1.35, -d * 0.12);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    ruin.add(leftWall);

    const backWallLeft = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w * 0.62, 3.05, 0.42)),
      this.plasterMat
    );
    backWallLeft.position.set(-w * 0.19, 1.52, -d * 0.5 + 0.21);
    backWallLeft.castShadow = true;
    backWallLeft.receiveShadow = true;
    ruin.add(backWallLeft);

    const backWallRight = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(w * 0.34, 1.45, 0.42)),
      this.stoneMat
    );
    backWallRight.position.set(w * 0.33, 0.72, -d * 0.5 + 0.21);
    backWallRight.castShadow = true;
    ruin.add(backWallRight);

    // Shattered Front Doorway Stub & Right Stump Wall
    const frontLeft = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.75, 1.95, 0.38)),
      this.plasterMat
    );
    frontLeft.position.set(-1.75, 0.98, d * 0.5 - 0.19);
    frontLeft.castShadow = true;
    ruin.add(frontLeft);

    const rightStump = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.42, 1.15, 2.2)),
      this.darkStoneMat
    );
    rightStump.position.set(w * 0.5 - 0.21, 0.58, -0.6);
    rightStump.castShadow = true;
    ruin.add(rightStump);

    // Intact Partial Shingle Roof Fragment sagging down on left corner
    const roofFrag = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(2.9, 0.18, 3.1)),
      this.roofMats[2]
    );
    roofFrag.position.set(-1.25, 2.85, -0.55);
    roofFrag.rotation.z = -0.38;
    roofFrag.rotation.x = -0.18;
    roofFrag.castShadow = true;
    ruin.add(roofFrag);

    // Broken & Fallen Charred Roof Rafters sticking out / collapsed across floor
    const beamGeo = this.track(new THREE.BoxGeometry(0.18, 0.18, 3.6));
    [
      { x: -0.4, y: 2.1, z: 0.2, rx: 0.55, rz: 0.22 },
      { x: 0.9, y: 1.05, z: -0.2, rx: -0.48, rz: -0.32 },
      { x: 1.4, y: 0.48, z: 0.9, rx: 0.15, rz: 1.35 },
    ].forEach((b) => {
      const beam = new THREE.Mesh(beamGeo, this.darkWoodMat);
      beam.position.set(b.x, b.y, b.z);
      beam.rotation.set(b.rx, 0.2, b.rz);
      beam.castShadow = true;
      ruin.add(beam);
    });

    // Scattered Stone Masonry Rubble Blocks around interior & outside breach
    const stoneChunkGeo = this.track(new THREE.DodecahedronGeometry(0.42, 0));
    [
      [0.6, 0.35, 0.4, 1.2, 0.7, 1.0],
      [1.8, 0.3, 1.4, 1.0, 0.65, 1.3],
      [2.3, 0.28, -0.4, 1.1, 0.6, 0.9],
      [-0.8, 0.32, 1.6, 0.95, 0.7, 1.1],
      [1.2, 0.34, -1.2, 1.15, 0.65, 0.95],
    ].forEach(([rx, ry, rz, sx, sy, sz], i) => {
      const chunk = new THREE.Mesh(stoneChunkGeo, i % 2 === 0 ? this.stoneMat : this.darkStoneMat);
      chunk.position.set(rx, ry, rz);
      chunk.scale.set(sx, sy, sz);
      chunk.rotation.set(i * 0.7, i * 1.1, i * 0.4);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      ruin.add(chunk);
    });

    this.group.add(ruin);
    this.addOBB(x, z, w + 0.5, d + 0.5, rotY, 3.2, false);
    this.buildingFootprints.push({ x, z, r: Math.hypot(w, d) * 0.55 + 1.4 });
  }

  /**
   * Wrecked Tilted Wooden Cart with Detached Broken Wheel & Spilled Barrels/Sacks
   */
  private createBrokenCart(x: number, z: number, rotY: number) {
    const cart = new THREE.Group();
    cart.position.set(x, 0, z);
    cart.rotation.y = rotY;

    // Tilted Wagon Bed resting on collapsed axle
    const bedGroup = new THREE.Group();
    bedGroup.position.set(0, 0.52, 0);
    bedGroup.rotation.z = 0.28;
    bedGroup.rotation.x = -0.1;

    const floor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.55, 0.12, 2.35)),
      this.woodMat
    );
    floor.castShadow = true;
    floor.receiveShadow = true;
    bedGroup.add(floor);

    // Side splintered slats (right rail broken shorter)
    const leftRail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.1, 0.56, 2.35)),
      this.darkWoodMat
    );
    leftRail.position.set(-0.72, 0.32, 0);
    leftRail.castShadow = true;
    bedGroup.add(leftRail);

    const rightBrokenRail = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.1, 0.48, 1.35)),
      this.darkWoodMat
    );
    rightBrokenRail.position.set(0.72, 0.25, -0.45);
    rightBrokenRail.rotation.x = 0.12;
    rightBrokenRail.castShadow = true;
    bedGroup.add(rightBrokenRail);

    // Broken Hitch Shafts pointing down into dirt
    const shaftGeo = this.track(new THREE.BoxGeometry(0.08, 0.08, 1.25));
    [-0.36, 0.36].forEach((sx) => {
      const shaft = new THREE.Mesh(shaftGeo, this.darkWoodMat);
      shaft.position.set(sx, -0.08, 1.65);
      shaft.rotation.x = 0.28;
      shaft.castShadow = true;
      bedGroup.add(shaft);
    });

    // Intact Remaining Left Wheel
    const rimGeo = this.track(new THREE.TorusGeometry(0.46, 0.055, 7, 14));
    rimGeo.rotateY(Math.PI / 2);
    const leftWheel = new THREE.Mesh(rimGeo, this.darkWoodMat);
    leftWheel.position.set(-0.88, -0.05, 0);
    leftWheel.castShadow = true;
    bedGroup.add(leftWheel);

    const spokeGeo = this.track(new THREE.BoxGeometry(0.05, 0.9, 0.05));
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(spokeGeo, this.woodMat);
      spoke.position.set(-0.88, -0.05, 0);
      spoke.rotation.x = (s / 4) * Math.PI;
      bedGroup.add(spoke);
    }

    cart.add(bedGroup);

    // Detached Broken Wheel lying flat on the ground beside the wreck
    const fallenWheelGroup = new THREE.Group();
    fallenWheelGroup.position.set(1.22, 0.09, 0.55);
    fallenWheelGroup.rotation.z = Math.PI / 2 - 0.15;
    fallenWheelGroup.rotation.y = 0.6;
    const fallenRim = new THREE.Mesh(rimGeo, this.darkWoodMat);
    fallenRim.castShadow = true;
    fallenWheelGroup.add(fallenRim);
    for (let s = 0; s < 3; s++) {
      const sp = new THREE.Mesh(spokeGeo, this.woodMat);
      sp.rotation.x = (s / 3) * Math.PI;
      fallenWheelGroup.add(sp);
    }
    cart.add(fallenWheelGroup);

    // Spilled Barrel & Grain Sack beside cart
    const spilledBarrel = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.28, 0.25, 0.72, 10)),
      this.darkWoodMat
    );
    spilledBarrel.position.set(0.95, 0.28, -0.82);
    spilledBarrel.rotation.z = Math.PI / 2 - 0.1;
    spilledBarrel.rotation.y = 0.45;
    spilledBarrel.castShadow = true;
    cart.add(spilledBarrel);

    const spilledSack = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.32, 10, 8)),
      this.sackMat
    );
    spilledSack.scale.set(1.2, 0.65, 0.95);
    spilledSack.position.set(-0.35, 0.2, 1.35);
    spilledSack.castShadow = true;
    cart.add(spilledSack);

    this.group.add(cart);
    this.addOBB(x, z, 2.75, 2.95, rotY, 1.1, false);
    this.buildingFootprints.push({ x, z, r: 2.3 });
  }

  /**
   * Forged Iron & Ashwood Spade Shovel (stuck upright in soil mound or leaned near cargo)
   */
  private createShovelTool(x: number, z: number, rotY: number, stuckInMound: boolean) {
    const toolGroup = new THREE.Group();
    toolGroup.position.set(x, 0, z);
    toolGroup.rotation.y = rotY;

    if (stuckInMound) {
      const mound = new THREE.Mesh(
        this.track(new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        this.dirtMat
      );
      mound.scale.set(1.1, 0.42, 1.0);
      mound.receiveShadow = true;
      toolGroup.add(mound);
    }

    const shovel = new THREE.Group();
    shovel.position.set(0, stuckInMound ? 0.16 : 0.05, 0);
    shovel.rotation.x = stuckInMound ? 0.22 : 1.18;
    shovel.rotation.z = stuckInMound ? -0.14 : 0.18;

    // Forged Iron Spade Blade
    const blade = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.24, 0.3, 0.028)),
      this.ironMat
    );
    blade.position.y = 0.04;
    blade.castShadow = true;
    shovel.add(blade);

    const bladeTip = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(0.12, 0.12, 4)),
      this.ironMat
    );
    bladeTip.scale.set(1.0, 1.0, 0.24);
    bladeTip.rotation.z = Math.PI;
    bladeTip.rotation.y = Math.PI / 4;
    bladeTip.position.y = -0.16;
    shovel.add(bladeTip);

    // Hardwood Shaft + Top T-Grip
    const shaft = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 7)),
      this.woodMat
    );
    shaft.position.y = 0.72;
    shaft.castShadow = true;
    shovel.add(shaft);

    const grip = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 6)),
      this.darkWoodMat
    );
    grip.rotation.z = Math.PI / 2;
    grip.position.y = 1.3;
    shovel.add(grip);

    toolGroup.add(shovel);
    this.group.add(toolGroup);
    this.addCylinder(x, z, 0.5, 1.35, false);
  }

  /**
   * Kingdom Merchant Cargo Pile (Crates, Grain Sacks, Rolled Carpets/Fabrics & Amphoras)
   */
  private createCargoDepot(x: number, z: number, rotY: number) {
    const depot = new THREE.Group();
    depot.position.set(x, 0, z);
    depot.rotation.y = rotY;

    // Stacked wooden crates
    const crateA = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.9, 0.75, 0.9)),
      this.woodMat
    );
    crateA.position.set(-0.55, 0.375, -0.2);
    crateA.castShadow = true;
    crateA.receiveShadow = true;
    depot.add(crateA);

    const crateB = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.68, 0.56, 0.68)),
      this.darkWoodMat
    );
    crateB.position.set(-0.55, 1.03, -0.2);
    crateB.rotation.y = 0.25;
    crateB.castShadow = true;
    depot.add(crateB);

    // Rolled Colorful Silk / Carpet Bolts
    const rollGeo = this.track(new THREE.CylinderGeometry(0.13, 0.13, 0.92, 10));
    rollGeo.rotateZ(Math.PI / 2);
    [
      { x: 0.42, y: 0.13, z: 0.22, mat: this.crimsonFabricMat },
      { x: 0.42, y: 0.13, z: -0.05, mat: this.cobaltFabricMat },
      { x: 0.42, y: 0.35, z: 0.08, mat: this.goldMat },
    ].forEach((r) => {
      const roll = new THREE.Mesh(rollGeo, r.mat);
      roll.position.set(r.x, r.y, r.z);
      roll.castShadow = true;
      depot.add(roll);
    });

    // Tied Burlap Grain Sacks
    const sackGeo = this.track(new THREE.SphereGeometry(0.3, 10, 8));
    [
      [0.45, 0.26, -0.52],
      [0.95, 0.24, -0.32],
    ].forEach(([sx, sy, sz]) => {
      const sack = new THREE.Mesh(sackGeo, this.sackMat);
      sack.scale.set(0.95, 1.15, 0.85);
      sack.position.set(sx, sy, sz);
      sack.castShadow = true;
      depot.add(sack);
    });

    // Clay Amphora Jar
    const jar = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.14, 0.22, 0.62, 10)),
      this.roofMats[2]
    );
    jar.position.set(-0.35, 0.31, 0.55);
    jar.castShadow = true;
    depot.add(jar);

    this.group.add(depot);
    this.addOBB(x, z, 2.35, 1.65, rotY, 1.32, false);
    this.buildingFootprints.push({ x, z, r: 1.8 });
  }

  /**
   * Helper: creates a crisp high-res CanvasTexture using clear Arabic handwriting ("Marhey") and refreshes once loaded
   */
  private createHandwrittenTexture(
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx, width, height);
    }
    const texture = this.track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([
        document.fonts.load('700 64px "Marhey"').catch(() => []),
        document.fonts.ready,
      ]).then(() => {
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          drawFn(ctx, width, height);
          texture.needsUpdate = true;
        }
      });
    }

    return texture;
  }

  /**
   * Large Prominent Royal Law Decree Board in Crisp, Easy-to-Read Arabic Handwriting
   */
  private createRoyalLawSignboard(x: number, z: number, rotY: number) {
    const signGroup = new THREE.Group();
    signGroup.position.set(x, 0, z);
    signGroup.rotation.y = rotY;

    const boardW = 3.25;
    const boardH = 2.02;
    const postH = 2.85;
    const boardCenterY = 1.72;

    // Stone footings & twin oak posts
    const footGeo = this.track(new THREE.CylinderGeometry(0.18, 0.24, 0.24, 10));
    const postGeo = this.track(new THREE.BoxGeometry(0.16, postH, 0.16));
    const finialGeo = this.track(new THREE.OctahedronGeometry(0.12, 0));

    [-boardW * 0.5 - 0.09, boardW * 0.5 + 0.09].forEach((px) => {
      const foot = new THREE.Mesh(footGeo, this.darkStoneMat);
      foot.position.set(px, 0.12, 0);
      foot.receiveShadow = true;
      signGroup.add(foot);

      const post = new THREE.Mesh(postGeo, this.darkWoodMat);
      post.position.set(px, postH * 0.5, 0);
      post.castShadow = true;
      signGroup.add(post);

      const finial = new THREE.Mesh(finialGeo, this.goldMat);
      finial.position.set(px, postH + 0.1, 0);
      signGroup.add(finial);
    });

    // Timber Frame & Pitched Mini Roof Overhang
    const frame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(boardW + 0.18, boardH + 0.16, 0.12)),
      this.darkWoodMat
    );
    frame.position.set(0, boardCenterY, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    signGroup.add(frame);

    const miniRoof = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(boardW + 0.56, 0.11, 0.54)),
      this.roofMats[0]
    );
    miniRoof.position.set(0, boardCenterY + boardH * 0.5 + 0.14, 0);
    miniRoof.castShadow = true;
    signGroup.add(miniRoof);

    // Ultra-crisp 2048x1280 Royal Law Parchment Texture
    const lawTex = this.createHandwrittenTexture(2048, 1280, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#fdf7e7');
      grad.addColorStop(0.5, '#f9efd5');
      grad.addColorStop(1, '#f0e0ba');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decorative double border
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 18;
      ctx.strokeRect(32, 32, w - 64, h - 64);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 6;
      ctx.strokeRect(56, 56, w - 112, h - 112);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';

      // Header Banner
      ctx.fillStyle = '#8b1111';
      ctx.font = '700 84px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('قوانين المملكة', w / 2, 145);

      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w * 0.24, 220);
      ctx.lineTo(w * 0.76, 220);
      ctx.stroke();

      // Paragraph 1 — large, spacious, ultra-clear dark ink
      ctx.fillStyle = '#140e09';
      ctx.font = '700 66px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('يمنع افتعال المشكلات أو الشجار داخل المملكة،', w / 2, 345);
      ctx.fillText('ويجب على الجميع احترام بعضهم البعض', w / 2, 465);
      ctx.fillText('والالتزام بالنظام.', w / 2, 585);

      // Paragraph 2 — large, crisp crimson warning ink
      ctx.fillStyle = '#8b1111';
      ctx.font = '700 66px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('كل من يخالف هذه القوانين سيتم نقله إلى', w / 2, 760);
      ctx.fillText('سجن المملكة أو إعدامه وفقا لقرار الملك.', w / 2, 885);

      // Royal Seal stamp at bottom
      ctx.beginPath();
      ctx.arc(w / 2, 1085, 76, 0, Math.PI * 2);
      ctx.fillStyle = '#991b1b';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '700 46px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('الملك', w / 2, 1088);
    });

    const boardFaceMat = this.track(
      new THREE.MeshStandardMaterial({
        map: lawTex,
        emissive: new THREE.Color(0xfff9ea),
        emissiveMap: lawTex,
        emissiveIntensity: 0.26,
        roughness: 0.78,
        metalness: 0.02,
      })
    );

    const planeGeo = this.track(new THREE.PlaneGeometry(boardW, boardH));
    const frontBoard = new THREE.Mesh(planeGeo, boardFaceMat);
    frontBoard.position.set(0, boardCenterY, 0.064);
    signGroup.add(frontBoard);

    const backBoard = new THREE.Mesh(planeGeo, boardFaceMat);
    backBoard.rotation.y = Math.PI;
    backBoard.position.set(0, boardCenterY, -0.064);
    signGroup.add(backBoard);

    this.group.add(signGroup);
    this.addOBB(x, z, boardW + 0.55, 0.55, rotY, postH, false);
    this.buildingFootprints.push({ x, z, r: 2.0 });
  }

  /**
   * Wooden Ground Signpost with Wide Pointed Arrow Planks aimed directly at Kingdom Landmarks
   */
  private createDirectionalSignpost(
    x: number,
    z: number,
    arrows: { label: string; targetX: number; targetZ: number }[]
  ) {
    const postGroup = new THREE.Group();
    postGroup.position.set(x, 0, z);

    const collar = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.24, 0.32, 0.24, 10)),
      this.darkStoneMat
    );
    collar.position.y = 0.12;
    collar.receiveShadow = true;
    postGroup.add(collar);

    const postH = 2.65;
    const post = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.088, 0.105, postH, 10)),
      this.darkWoodMat
    );
    post.position.y = postH * 0.5;
    post.castShadow = true;
    postGroup.add(post);

    const topCap = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.115, 10, 8)),
      this.goldMat
    );
    topCap.position.y = postH + 0.06;
    postGroup.add(topCap);

    // Wide pointed wooden arrow shape mounted cleanly beside the post (starting at x = 0.08, zero post overlap)
    const plankLen = 2.05;
    const plankH = 0.44;
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0.06, -plankH * 0.5);
    arrowShape.lineTo(plankLen - 0.3, -plankH * 0.5);
    arrowShape.lineTo(plankLen, 0);
    arrowShape.lineTo(plankLen - 0.3, plankH * 0.5);
    arrowShape.lineTo(0.06, plankH * 0.5);
    arrowShape.closePath();

    const plankGeo = this.track(
      new THREE.ExtrudeGeometry(arrowShape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 1,
      })
    );
    plankGeo.translate(0, 0, -0.03);

    const labelPlaneGeo = this.track(new THREE.PlaneGeometry(1.58, 0.36));

    const yStep = arrows.length > 4 ? 0.42 : 0.5;
    arrows.forEach((item, idx) => {
      const arrowHolder = new THREE.Group();
      const yPos = postH - 0.3 - idx * yStep;
      arrowHolder.position.y = yPos;

      const dx = item.targetX - x;
      const dz = item.targetZ - z;
      arrowHolder.rotation.y = Math.atan2(-dz, dx);

      const plank = new THREE.Mesh(plankGeo, this.woodMat);
      plank.castShadow = true;
      plank.receiveShadow = true;
      arrowHolder.add(plank);

      const drawArrowBoard = (arrowGlyph: string) =>
        this.createHandwrittenTexture(1024, 224, (ctx, w, h) => {
          ctx.fillStyle = '#fbf2dc';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#6b4226';
          ctx.lineWidth = 10;
          ctx.strokeRect(10, 10, w - 20, h - 20);

          ctx.fillStyle = '#120c06';
          ctx.font = '700 52px "Marhey", "Tajawal", cursive, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.direction = 'rtl';
          const textWithTip = item.label.replace('⟵', arrowGlyph);
          ctx.fillText(textWithTip, w / 2, h / 2 + 3);
        });

      const frontTex = drawArrowBoard('⟶');
      const backTex = drawArrowBoard('⟵');

      const frontMat = this.track(
        new THREE.MeshStandardMaterial({
          map: frontTex,
          emissive: new THREE.Color(0xfff9ea),
          emissiveMap: frontTex,
          emissiveIntensity: 0.26,
          roughness: 0.78,
          metalness: 0.02,
        })
      );
      const backMat = this.track(
        new THREE.MeshStandardMaterial({
          map: backTex,
          emissive: new THREE.Color(0xfff9ea),
          emissiveMap: backTex,
          emissiveIntensity: 0.26,
          roughness: 0.78,
          metalness: 0.02,
        })
      );

      const frontFace = new THREE.Mesh(labelPlaneGeo, frontMat);
      frontFace.position.set(0.95, 0, 0.042);
      arrowHolder.add(frontFace);

      const backFace = new THREE.Mesh(labelPlaneGeo, backMat);
      backFace.rotation.y = Math.PI;
      backFace.position.set(0.95, 0, -0.042);
      arrowHolder.add(backFace);

      postGroup.add(arrowHolder);
    });

    this.group.add(postGroup);
    this.addCylinder(x, z, 0.36, postH, false);
  }

  /**
   * Dedicated Ground Sign right beside the Royal Gallows ("المعدمة")
   * Mounted cleanly above its support post so the post never blocks any words.
   */
  private createGallowsGroundSign(x: number, z: number, rotY: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const stoneBase = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 10)),
      this.darkStoneMat
    );
    stoneBase.position.y = 0.1;
    stoneBase.receiveShadow = true;
    g.add(stoneBase);

    // Support post terminates cleanly at y = 1.04 right under the sign frame (no overlap!)
    const postTopY = 1.04;
    const post = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.15, postTopY, 0.15)),
      this.darkWoodMat
    );
    post.position.y = postTopY * 0.5;
    post.castShadow = true;
    g.add(post);

    const mountBracket = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.68, 0.09, 0.18)),
      this.darkWoodMat
    );
    mountBracket.position.set(0, postTopY, 0);
    mountBracket.castShadow = true;
    g.add(mountBracket);

    // Board pivots from top of the post so the entire board sits above y = 1.04
    const boardPivot = new THREE.Group();
    boardPivot.position.set(0, postTopY + 0.03, 0);
    boardPivot.rotation.x = -0.14;
    g.add(boardPivot);

    const boardH = 1.02;
    const backing = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.78, boardH, 0.08)),
      this.darkWoodMat
    );
    backing.position.set(0, boardH * 0.5, 0);
    backing.castShadow = true;
    backing.receiveShadow = true;
    boardPivot.add(backing);

    const tex = this.createHandwrittenTexture(1024, 576, (ctx, w, h) => {
      ctx.fillStyle = '#fbf2dc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 14;
      ctx.strokeRect(18, 18, w - 36, h - 36);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';

      ctx.fillStyle = '#8b1111';
      ctx.font = '700 84px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('ساحة المعدمة', w / 2, 155);

      ctx.fillStyle = '#120c06';
      ctx.font = '700 58px "Marhey", "Tajawal", cursive, sans-serif';
      ctx.fillText('مكان تنفيذ الإعدام بحق', w / 2, 320);
      ctx.fillText('المخالفين لأمر السلطان', w / 2, 430);
    });

    const faceMat = this.track(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(0xfff9ea),
        emissiveMap: tex,
        emissiveIntensity: 0.26,
        roughness: 0.76,
        metalness: 0.02,
      })
    );
    const face = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.66, 0.92)), faceMat);
    face.position.set(0, boardH * 0.5, 0.044);
    boardPivot.add(face);

    const backFace = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.66, 0.92)), faceMat);
    backFace.position.set(0, boardH * 0.5, -0.044);
    backFace.rotation.y = Math.PI;
    boardPivot.add(backFace);

    this.group.add(g);
    this.addCylinder(x, z, 0.45, 2.08, false);
  }

  public setExecutionGallowsState(opts: {
    active: boolean;
    ropeTargetWorldY?: number | null;
    nooseTight?: boolean;
    trapdoorOpen?: number;
    leverPulled?: number;
    swayZ?: number;
    swayX?: number;
  }) {
    const g = this.gallowsAnchor;
    if (!g) return;
    this.executionRopeActive = opts.active;

    if (!opts.active) {
      g.verticalRope.scale.y = 1;
      g.verticalRope.position.y = -0.725;
      g.knot.position.y = -1.45;
      g.nooseLoop.position.y = -1.63;
      g.nooseLoop.rotation.x = 0;
      g.nooseLoop.scale.setScalar(1);
      g.trapdoorPivot.rotation.x = 0;
      g.leverPivot.rotation.x = 0;
      return;
    }

    if (opts.ropeTargetWorldY !== undefined && opts.ropeTargetWorldY !== null) {
      const dropLen = THREE.MathUtils.clamp(g.ropeAnchorWorldY - opts.ropeTargetWorldY, 0.4, 3.6);
      g.verticalRope.scale.y = dropLen / 1.45;
      g.verticalRope.position.y = -dropLen * 0.5;
      g.knot.position.y = -dropLen + 0.08;
      g.nooseLoop.position.y = -dropLen - (opts.nooseTight ? 0.02 : 0.14);
      g.nooseLoop.rotation.x = opts.nooseTight ? Math.PI / 2 : 0;
      g.nooseLoop.scale.setScalar(opts.nooseTight ? 0.84 : 1.0);
    }

    g.trapdoorPivot.rotation.x = (opts.trapdoorOpen ?? 0) * (Math.PI * 0.44);
    g.leverPivot.rotation.x = (opts.leverPulled ?? 0) * 0.85;
    if (opts.swayZ !== undefined) g.ropeGroup.rotation.z = opts.swayZ;
    if (opts.swayX !== undefined) g.ropeGroup.rotation.x = opts.swayX;
  }

  public triggerWellSplash() {
    this.splashTimer = 1.65;
    if (!this.splashDrops.length) {
      const dropGeo = this.track(new THREE.SphereGeometry(0.075, 8, 6));
      const dropMat = this.track(
        new THREE.MeshBasicMaterial({ color: 0xe0f7ff, transparent: true, opacity: 0.92 })
      );
      for (let i = 0; i < 18; i++) {
        const mesh = new THREE.Mesh(dropGeo, dropMat);
        mesh.visible = false;
        this.group.add(mesh);
        this.splashDrops.push({ mesh, vel: new THREE.Vector3() });
      }

      const rippleGeo = this.track(new THREE.RingGeometry(0.18, 0.28, 24));
      rippleGeo.rotateX(-Math.PI / 2);
      const rippleMat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0xe0f7ff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      this.splashRipple = new THREE.Mesh(rippleGeo, rippleMat);
      this.splashRipple.visible = false;
      this.group.add(this.splashRipple);
    }

    for (let i = 0; i < this.splashDrops.length; i++) {
      const d = this.splashDrops[i];
      const ang = (i / this.splashDrops.length) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 0.7 + Math.random() * 1.1;
      d.mesh.position.set(
        this.wellCenter.x + Math.cos(ang) * 0.14,
        this.wellWaterY + 0.08,
        this.wellCenter.z + Math.sin(ang) * 0.14
      );
      d.vel.set(Math.cos(ang) * spd, 2.8 + Math.random() * 1.9, Math.sin(ang) * spd);
      d.mesh.scale.setScalar(0.8 + Math.random() * 0.7);
      d.mesh.visible = true;
    }

    if (this.splashRipple) {
      this.splashRipple.position.set(this.wellCenter.x, this.wellWaterY + 0.03, this.wellCenter.z);
      this.splashRipple.scale.setScalar(0.35);
      this.splashRipple.visible = true;
    }
  }

  public update(elapsedTime: number) {
    const dt = Math.min(0.1, Math.max(0.001, elapsedTime - this.lastElapsedTime));
    this.lastElapsedTime = elapsedTime;

    if (this.wellWaterMesh) {
      this.wellWaterMesh.rotation.y = elapsedTime * 0.18;
      this.wellWaterMesh.position.y =
        this.wellWaterY +
        Math.sin(elapsedTime * 2.1) * 0.014 +
        (this.splashTimer > 0 ? Math.sin(elapsedTime * 24) * 0.035 * (this.splashTimer / 1.65) : 0);
    }

    if (this.wellBucketGroup) {
      this.wellBucketGroup.rotation.z = Math.sin(elapsedTime * 1.15) * 0.035;
    }

    if (this.gallowsAnchor && !this.executionRopeActive) {
      this.gallowsAnchor.ropeGroup.rotation.z = Math.sin(elapsedTime * 1.4) * 0.025;
      this.gallowsAnchor.ropeGroup.rotation.x = Math.cos(elapsedTime * 1.1) * 0.018;
    }

    if (this.splashTimer > 0) {
      this.splashTimer = Math.max(0, this.splashTimer - dt);
      for (let i = 0; i < this.splashDrops.length; i++) {
        const d = this.splashDrops[i];
        d.vel.y -= 9.8 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < this.wellWaterY) {
          d.mesh.visible = false;
        }
      }
      if (this.splashRipple) {
        const prog = 1 - this.splashTimer / 1.65;
        this.splashRipple.scale.setScalar(0.35 + prog * 3.1);
        const rMat = this.splashRipple.material as THREE.MeshBasicMaterial;
        rMat.opacity = Math.max(0, (1 - prog) * 0.85);
        if (this.splashTimer <= 0) this.splashRipple.visible = false;
      }
    }

    for (let i = 0; i < this.bannerCloths.length; i++) {
      this.bannerCloths[i].rotation.x = Math.sin(elapsedTime * 1.9 + i * 1.2) * 0.05;
    }

    this.cannon?.update(dt, elapsedTime);
    this.lionCage?.update(dt, elapsedTime);
    this.speechPodium?.update(elapsedTime);
  }

  public setNightAmount(nightAmount: number) {
    const n = Math.max(0, Math.min(1, nightAmount));
    if (this.lanternGlowMat) {
      this.lanternGlowMat.emissiveIntensity = 0.85 + n * 2.15;
    }
    if (this.windowGlowMat) {
      this.windowGlowMat.emissiveIntensity = 0.35 + n * 1.75;
    }
    this.cemetery?.setNightAmount(n);
    this.cafe?.setNightAmount(n);
    this.palace?.setNightAmount(n);
  }

  public dispose() {
    this.prison?.dispose();
    this.cemetery?.dispose();
    this.cannon?.dispose();
    this.cafe?.dispose();
    this.palace?.dispose();
    this.lionCage?.dispose();
    this.militaryCamp?.dispose();
    this.speechPodium?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
