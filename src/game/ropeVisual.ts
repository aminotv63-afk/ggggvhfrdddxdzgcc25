import * as THREE from 'three';

const _segStart = new THREE.Vector3();
const _segEnd = new THREE.Vector3();
const _segMid = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _segQuat = new THREE.Quaternion();

/**
 * Reusable zero-GC segmented 3D hemp lead rope connecting a hand anchor to a horse's halter ring.
 */
export class LeadRopeVisual {
  public readonly group: THREE.Group;
  private readonly segments: THREE.Mesh[] = [];
  private readonly sharedGeo: THREE.CylinderGeometry;
  private readonly sharedMat: THREE.MeshStandardMaterial;
  private readonly segmentCount: number;

  constructor(segmentCount: number = 10, color: number = 0xc9a063) {
    this.segmentCount = segmentCount;
    this.group = new THREE.Group();
    this.group.name = 'LeadRopeVisual';
    this.group.visible = false;

    this.sharedGeo = new THREE.CylinderGeometry(0.017, 0.017, 1.0, 6);
    this.sharedMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.04,
    });

    for (let i = 0; i < segmentCount; i++) {
      const seg = new THREE.Mesh(this.sharedGeo, this.sharedMat);
      seg.castShadow = true;
      this.segments.push(seg);
      this.group.add(seg);
    }
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /**
   * Positions and bends the 3D rope segments along a natural sagging catenary curve
   * between startWorld (character hand) and endWorld (horse muzzle halter).
   */
  public updateEndpoints(startWorld: THREE.Vector3, endWorld: THREE.Vector3) {
    if (!this.group.visible) {
      this.group.visible = true;
    }

    const totalDist = startWorld.distanceTo(endWorld);
    // Rope droops slightly when slack and tightens smoothly when pulling taut
    const sagAmount =
      totalDist < 2.15
        ? Math.min(0.46, 0.14 + (2.15 - totalDist) * 0.24)
        : Math.max(0.04, 0.14 - (totalDist - 2.15) * 0.08);

    for (let i = 0; i < this.segmentCount; i++) {
      const t0 = i / this.segmentCount;
      const t1 = (i + 1) / this.segmentCount;

      _segStart.lerpVectors(startWorld, endWorld, t0);
      _segStart.y = Math.max(0.05, _segStart.y - 4 * t0 * (1 - t0) * sagAmount);

      _segEnd.lerpVectors(startWorld, endWorld, t1);
      _segEnd.y = Math.max(0.05, _segEnd.y - 4 * t1 * (1 - t1) * sagAmount);

      _segMid.addVectors(_segStart, _segEnd).multiplyScalar(0.5);
      _segDir.subVectors(_segEnd, _segStart);
      const segLen = _segDir.length();

      const segMesh = this.segments[i];
      if (segLen > 0.0001) {
        _segDir.divideScalar(segLen);
        _segQuat.setFromUnitVectors(_worldUp, _segDir);
        segMesh.position.copy(_segMid);
        segMesh.quaternion.copy(_segQuat);
        segMesh.scale.set(1, segLen * 1.12, 1);
      }
    }
  }

  public dispose() {
    this.sharedGeo.dispose();
    this.sharedMat.dispose();
  }
}
