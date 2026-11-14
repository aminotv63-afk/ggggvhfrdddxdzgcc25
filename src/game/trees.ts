import * as THREE from 'three';
import { CylinderCollider } from './kingdomVillage';

export type TreeKind = 'pine' | 'oak' | 'blossom' | 'olive';

export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  kind: TreeKind;
}

export interface ForestPropSpot {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  kind: 'bush' | 'boulder' | 'log';
}

/**
 * Instanced Kingdom & Forest Trees (Pines, Oaks, Green Orchards, Gnarled Olive Trees)
 * plus instanced woodland undergrowth (bushes, mossy boulders, fallen logs) for high mobile FPS.
 */
export class KingdomTrees {
  public group: THREE.Group;
  public colliders: CylinderCollider[] = [];
  private disposables: { dispose: () => void }[] = [];

  constructor(spots: TreeSpot[], forestProps: ForestPropSpot[] = []) {
    this.group = new THREE.Group();
    this.group.name = 'KingdomTrees';
    this.buildTrees(spots);
    if (forestProps.length > 0) {
      this.buildForestProps(forestProps);
    }
    this.group.updateMatrixWorld(true);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.matrixAutoUpdate = false;
      }
    });
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildTrees(spots: TreeSpot[]) {
    const standardTrunks = spots.filter((s) => s.kind !== 'olive');
    const pines = spots.filter((s) => s.kind === 'pine');
    const oaks = spots.filter((s) => s.kind === 'oak');
    const blossoms = spots.filter((s) => s.kind === 'blossom');
    const olives = spots.filter((s) => s.kind === 'olive');

    const trunkMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x5c3c22, roughness: 0.9, metalness: 0.02 })
    );
    const oliveBarkMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x6b5640, roughness: 0.94, metalness: 0.02 })
    );
    const pineMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x265c36, roughness: 0.86, metalness: 0.02 })
    );
    const oakMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x3b7a3e, roughness: 0.85, metalness: 0.02 })
    );
    const blossomMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x4b8f3e, roughness: 0.84, metalness: 0.02 })
    );
    const oliveLeafMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x668449, roughness: 0.86, metalness: 0.02 })
    );
    const oliveFruitMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x2a301c, roughness: 0.48, metalness: 0.08 })
    );

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Standard Trunks (Pine, Oak, Green Orchard)
    if (standardTrunks.length > 0) {
      const trunkGeo = this.track(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 7));
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, standardTrunks.length);
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;

      standardTrunks.forEach((s, i) => {
        const hScale = s.kind === 'pine' ? s.scale * 1.15 : s.scale;
        dummy.position.set(s.x, 1.05 * hScale, s.z);
        dummy.rotation.set(0, (i * 1.37) % (Math.PI * 2), 0);
        dummy.scale.set(s.scale, hScale, s.scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        this.colliders.push({
          x: s.x,
          z: s.z,
          radius: 0.34 * s.scale,
          topY: 4.5 * s.scale,
          allowStand: false,
        });
      });

      trunkMesh.instanceMatrix.needsUpdate = true;
      this.group.add(trunkMesh);
    }

    // 2. Layered Pine / Cypress Trees (3 stacked cones per tree)
    if (pines.length > 0) {
      const coneGeo = this.track(new THREE.ConeGeometry(1.3, 2.1, 8));
      const pineMesh = new THREE.InstancedMesh(coneGeo, pineMat, pines.length * 3);
      pineMesh.castShadow = true;
      pineMesh.receiveShadow = true;

      let idx = 0;
      pines.forEach((p, pIdx) => {
        const tiers = [
          { y: 2.55, r: 1.05, h: 1.05 },
          { y: 3.7, r: 0.84, h: 0.98 },
          { y: 4.75, r: 0.58, h: 0.88 },
        ];
        tiers.forEach((t) => {
          dummy.position.set(p.x, t.y * p.scale, p.z);
          dummy.rotation.set(0, pIdx * 0.7, 0);
          dummy.scale.set(t.r * p.scale, t.h * p.scale, t.r * p.scale);
          dummy.updateMatrix();
          pineMesh.setMatrixAt(idx, dummy.matrix);

          const shade = 0.88 + (pIdx % 4) * 0.06;
          color.setRGB(shade * 0.92, shade, shade * 0.94);
          pineMesh.setColorAt(idx, color);
          idx++;
        });
      });

      pineMesh.instanceMatrix.needsUpdate = true;
      if (pineMesh.instanceColor) pineMesh.instanceColor.needsUpdate = true;
      this.group.add(pineMesh);
    }

    // 3. Lush Broadleaf Oak Trees (3 clustered puffs per canopy)
    if (oaks.length > 0) {
      const crownGeo = this.track(new THREE.DodecahedronGeometry(1.18, 1));
      const oakMesh = new THREE.InstancedMesh(crownGeo, oakMat, oaks.length * 3);
      oakMesh.castShadow = true;
      oakMesh.receiveShadow = true;

      let idx = 0;
      oaks.forEach((o, oIdx) => {
        const puffs = [
          { ox: 0, oy: 3.15, oz: 0, s: 1.12 },
          { ox: 0.55, oy: 2.75, oz: 0.32, s: 0.82 },
          { ox: -0.52, oy: 2.8, oz: -0.3, s: 0.84 },
        ];
        const ang = (oIdx * 1.9) % (Math.PI * 2);
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);

        puffs.forEach((pf) => {
          const rx = pf.ox * cosA - pf.oz * sinA;
          const rz = pf.ox * sinA + pf.oz * cosA;
          dummy.position.set(o.x + rx * o.scale, pf.oy * o.scale, o.z + rz * o.scale);
          dummy.rotation.set(0, ang, 0);
          dummy.scale.setScalar(pf.s * o.scale);
          dummy.updateMatrix();
          oakMesh.setMatrixAt(idx, dummy.matrix);

          const shade = 0.9 + (oIdx % 5) * 0.05;
          color.setRGB(shade, shade * 1.04, shade * 0.9);
          oakMesh.setColorAt(idx, color);
          idx++;
        });
      });

      oakMesh.instanceMatrix.needsUpdate = true;
      if (oakMesh.instanceColor) oakMesh.instanceColor.needsUpdate = true;
      this.group.add(oakMesh);
    }

    // 4. Lush Orchard & Garden Green Trees (3 puffs per canopy)
    if (blossoms.length > 0) {
      const crownGeo = this.track(new THREE.DodecahedronGeometry(1.05, 1));
      const blossomMesh = new THREE.InstancedMesh(crownGeo, blossomMat, blossoms.length * 3);
      blossomMesh.castShadow = true;
      blossomMesh.receiveShadow = true;

      let idx = 0;
      blossoms.forEach((b, bIdx) => {
        const puffs = [
          { ox: 0, oy: 2.95, oz: 0, s: 1.08 },
          { ox: 0.48, oy: 2.6, oz: -0.25, s: 0.78 },
          { ox: -0.45, oy: 2.65, oz: 0.28, s: 0.8 },
        ];
        const ang = (bIdx * 2.3) % (Math.PI * 2);
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);

        puffs.forEach((pf) => {
          const rx = pf.ox * cosA - pf.oz * sinA;
          const rz = pf.ox * sinA + pf.oz * cosA;
          dummy.position.set(b.x + rx * b.scale, pf.oy * b.scale, b.z + rz * b.scale);
          dummy.rotation.set(0, ang, 0);
          dummy.scale.setScalar(pf.s * b.scale);
          dummy.updateMatrix();
          blossomMesh.setMatrixAt(idx, dummy.matrix);

          const shade = 0.88 + (bIdx % 5) * 0.05;
          color.setRGB(shade * 0.94, shade * 1.05, shade * 0.88);
          blossomMesh.setColorAt(idx, color);
          idx++;
        });
      });

      blossomMesh.instanceMatrix.needsUpdate = true;
      if (blossomMesh.instanceColor) blossomMesh.instanceColor.needsUpdate = true;
      this.group.add(blossomMesh);
    }

    // 5. Mediterranean Olive Trees (Gnarled Forked Trunks + Broad Silvery-Green Canopies + Visible Olives)
    if (olives.length > 0) {
      const oliveBaseTrunkGeo = this.track(new THREE.CylinderGeometry(0.24, 0.38, 1.45, 7));
      const oliveBranchGeo = this.track(new THREE.CylinderGeometry(0.11, 0.19, 1.35, 6));
      const oliveCrownGeo = this.track(new THREE.DodecahedronGeometry(1.12, 1));
      const oliveFruitGeo = this.track(new THREE.SphereGeometry(0.085, 6, 5));
      oliveFruitGeo.scale(0.85, 1.25, 0.85);

      const baseTrunkMesh = new THREE.InstancedMesh(
        oliveBaseTrunkGeo,
        oliveBarkMat,
        olives.length
      );
      baseTrunkMesh.castShadow = true;
      baseTrunkMesh.receiveShadow = true;

      const branchMesh = new THREE.InstancedMesh(oliveBranchGeo, oliveBarkMat, olives.length * 2);
      branchMesh.castShadow = true;

      const crownMesh = new THREE.InstancedMesh(oliveCrownGeo, oliveLeafMat, olives.length * 4);
      crownMesh.castShadow = true;
      crownMesh.receiveShadow = true;

      const fruitMesh = new THREE.InstancedMesh(oliveFruitGeo, oliveFruitMat, olives.length * 8);

      let bIdx = 0;
      let cIdx = 0;
      let fIdx = 0;

      olives.forEach((ol, oIdx) => {
        const ang = (oIdx * 2.13) % (Math.PI * 2);
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);

        // Register solid gnarled trunk collider
        this.colliders.push({
          x: ol.x,
          z: ol.z,
          radius: 0.4 * ol.scale,
          topY: 4.2 * ol.scale,
          allowStand: false,
        });

        // Gnarled tilted lower trunk
        dummy.position.set(ol.x, 0.72 * ol.scale, ol.z);
        dummy.rotation.set(0.08, ang, -0.07);
        dummy.scale.set(ol.scale, ol.scale, ol.scale);
        dummy.updateMatrix();
        baseTrunkMesh.setMatrixAt(oIdx, dummy.matrix);

        // Two forked upper olive branches
        [-1, 1].forEach((side) => {
          const bx = side * 0.28;
          const rx = bx * cosA;
          const rz = bx * sinA;
          dummy.position.set(ol.x + rx * ol.scale, 1.72 * ol.scale, ol.z + rz * ol.scale);
          dummy.rotation.set(0, ang, -side * 0.44);
          dummy.scale.set(ol.scale, ol.scale, ol.scale);
          dummy.updateMatrix();
          branchMesh.setMatrixAt(bIdx++, dummy.matrix);
        });

        // Broad, airy 4-puff silvery-olive-green canopy
        const puffs = [
          { ox: 0.0, oy: 2.72, oz: 0.0, sx: 1.32, sy: 0.78, sz: 1.28 },
          { ox: 0.68, oy: 2.38, oz: 0.25, sx: 0.96, sy: 0.68, sz: 0.94 },
          { ox: -0.66, oy: 2.42, oz: -0.22, sx: 0.98, sy: 0.68, sz: 0.92 },
          { ox: 0.08, oy: 2.45, oz: -0.62, sx: 0.88, sy: 0.64, sz: 0.86 },
        ];

        puffs.forEach((pf, pSub) => {
          const rx = pf.ox * cosA - pf.oz * sinA;
          const rz = pf.ox * sinA + pf.oz * cosA;
          dummy.position.set(ol.x + rx * ol.scale, pf.oy * ol.scale, ol.z + rz * ol.scale);
          dummy.rotation.set(0, ang + pSub * 0.6, 0);
          dummy.scale.set(pf.sx * ol.scale, pf.sy * ol.scale, pf.sz * ol.scale);
          dummy.updateMatrix();
          crownMesh.setMatrixAt(cIdx, dummy.matrix);

          const shade = 0.88 + ((oIdx + pSub) % 5) * 0.045;
          color.setRGB(shade * 0.97, shade * 1.04, shade * 0.86);
          crownMesh.setColorAt(cIdx, color);
          cIdx++;
        });

        // 8 small olive clusters hanging around the lower rim of the olive canopy
        for (let k = 0; k < 8; k++) {
          const fAng = ang + (k / 8) * Math.PI * 2;
          const rad = (0.72 + (k % 2) * 0.36) * ol.scale;
          const fy = (2.02 + (k % 3) * 0.22) * ol.scale;
          dummy.position.set(ol.x + Math.cos(fAng) * rad, fy, ol.z + Math.sin(fAng) * rad);
          dummy.rotation.set(0.2, fAng, 0.15);
          dummy.scale.setScalar(ol.scale * (0.9 + (k % 2) * 0.25));
          dummy.updateMatrix();
          fruitMesh.setMatrixAt(fIdx, dummy.matrix);

          // Mix of ripe dark-purple/black olives and young green olives
          if (k % 3 === 0) {
            color.setHex(0x6e8c33);
          } else {
            color.setHex(0x282b1d);
          }
          fruitMesh.setColorAt(fIdx, color);
          fIdx++;
        }
      });

      baseTrunkMesh.instanceMatrix.needsUpdate = true;
      branchMesh.instanceMatrix.needsUpdate = true;
      crownMesh.instanceMatrix.needsUpdate = true;
      fruitMesh.instanceMatrix.needsUpdate = true;
      if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
      if (fruitMesh.instanceColor) fruitMesh.instanceColor.needsUpdate = true;

      this.group.add(baseTrunkMesh, branchMesh, crownMesh, fruitMesh);
    }
  }

  private buildForestProps(props: ForestPropSpot[]) {
    const bushes = props.filter((p) => p.kind === 'bush');
    const boulders = props.filter((p) => p.kind === 'boulder');
    const logs = props.filter((p) => p.kind === 'log');

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Wild Green Forest Bushes & Undergrowth Shrubs (3 puffs per bush, zero collision penalty)
    if (bushes.length > 0) {
      const bushGeo = this.track(new THREE.DodecahedronGeometry(0.48, 0));
      const bushMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x3f7836, roughness: 0.9, metalness: 0.01 })
      );
      const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length * 3);
      bushMesh.castShadow = true;
      bushMesh.receiveShadow = true;

      let idx = 0;
      bushes.forEach((b, bIdx) => {
        const lobes = [
          { ox: 0, oy: 0.34, oz: 0, s: 1.0 },
          { ox: 0.34, oy: 0.26, oz: 0.18, s: 0.76 },
          { ox: -0.32, oy: 0.25, oz: -0.15, s: 0.72 },
        ];
        const cosR = Math.cos(b.rotY);
        const sinR = Math.sin(b.rotY);
        lobes.forEach((lb) => {
          const rx = lb.ox * cosR - lb.oz * sinR;
          const rz = lb.ox * sinR + lb.oz * cosR;
          dummy.position.set(b.x + rx * b.scale, lb.oy * b.scale, b.z + rz * b.scale);
          dummy.rotation.set(0, b.rotY, 0);
          dummy.scale.set(lb.s * b.scale, lb.s * b.scale * 0.82, lb.s * b.scale);
          dummy.updateMatrix();
          bushMesh.setMatrixAt(idx, dummy.matrix);

          const shade = 0.85 + ((bIdx + idx) % 5) * 0.06;
          color.setRGB(shade * 0.92, shade * 1.06, shade * 0.88);
          bushMesh.setColorAt(idx, color);
          idx++;
        });
      });

      bushMesh.instanceMatrix.needsUpdate = true;
      if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
      this.group.add(bushMesh);
    }

    // 2. Mossy Forest Boulders (with solid collision)
    if (boulders.length > 0) {
      const rockGeo = this.track(new THREE.DodecahedronGeometry(0.72, 0));
      const rockMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x73776f, roughness: 0.94, metalness: 0.03 })
      );
      const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, boulders.length);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;

      boulders.forEach((r, rIdx) => {
        dummy.position.set(r.x, 0.36 * r.scale, r.z);
        dummy.rotation.set(0.18 * (rIdx % 3), r.rotY, 0.12 * ((rIdx + 1) % 3));
        dummy.scale.set(r.scale * 1.15, r.scale * 0.74, r.scale * 0.95);
        dummy.updateMatrix();
        rockMesh.setMatrixAt(rIdx, dummy.matrix);

        const shade = 0.84 + (rIdx % 4) * 0.07;
        color.setRGB(shade * 0.96, shade * 1.02, shade * 0.94);
        rockMesh.setColorAt(rIdx, color);

        this.colliders.push({
          x: r.x,
          z: r.z,
          radius: 0.72 * r.scale,
          topY: 0.8 * r.scale,
          allowStand: false,
        });
      });

      rockMesh.instanceMatrix.needsUpdate = true;
      if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
      this.group.add(rockMesh);
    }

    // 3. Fallen Woodland Logs
    if (logs.length > 0) {
      const logGeo = this.track(new THREE.CylinderGeometry(0.22, 0.27, 2.6, 7));
      logGeo.rotateZ(Math.PI / 2);
      const logMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x563b24, roughness: 0.95, metalness: 0.02 })
      );
      const logMesh = new THREE.InstancedMesh(logGeo, logMat, logs.length);
      logMesh.castShadow = true;
      logMesh.receiveShadow = true;

      logs.forEach((l, lIdx) => {
        dummy.position.set(l.x, 0.2 * l.scale, l.z);
        dummy.rotation.set(0, l.rotY, 0);
        dummy.scale.setScalar(l.scale);
        dummy.updateMatrix();
        logMesh.setMatrixAt(lIdx, dummy.matrix);

        // Register two end-to-center colliders along the fallen log so players step around it cleanly
        const cosR = Math.cos(l.rotY);
        const sinR = Math.sin(l.rotY);
        [-0.7, 0, 0.7].forEach((offset) => {
          this.colliders.push({
            x: l.x + offset * cosR * l.scale,
            z: l.z - offset * sinR * l.scale,
            radius: 0.34 * l.scale,
            topY: 0.45 * l.scale,
            allowStand: false,
          });
        });
      });

      logMesh.instanceMatrix.needsUpdate = true;
      this.group.add(logMesh);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
