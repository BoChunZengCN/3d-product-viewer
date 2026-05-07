import * as THREE from 'three';

export class MeasureManager {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.mode = 'direct'; // direct | axis | angle | radius | area | volume
    this.points = [];
    this.markers = [];
    this.lines = [];
    this.result = null;
  }

  setMode(mode) { this.mode = mode; this.clear(); }

  toggle() {
    this.active = !this.active;
    if (!this.active) this.clear();
    return this.active;
  }

  addPoint(intersect) {
    if (!this.active) return null;
    const point = intersect.point.clone();

    // Marker
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf0883e })
    );
    marker.position.copy(point);
    this.scene.add(marker);
    this.markers.push(marker);
    this.points.push(point);

    const needed = this.mode === 'angle' ? 3 : (this.mode === 'radius' || this.mode === 'area' || this.mode === 'volume') ? 1 : 2;

    if (this.points.length >= needed) {
      this.result = this._calculate();
      return this.result;
    }
    return { partial: true, count: this.points.length, needed };
  }

  _calculate() {
    const [p1, p2, p3] = this.points;

    switch (this.mode) {
      case 'direct': {
        this._drawLine(p1, p2, 0xf0883e);
        const dist = p1.distanceTo(p2);
        return { type: 'distance', value: dist, unit: 'mm', points: [p1, p2] };
      }
      case 'axis': {
        this._drawLine(p1, p2, 0xf0883e);
        const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y), dz = Math.abs(p2.z - p1.z);
        // Axis dashed lines
        const colors = [0xff4444, 0x44ff44, 0x4444ff];
        const pts = [
          [p1, new THREE.Vector3(p2.x, p1.y, p1.z)],
          [new THREE.Vector3(p2.x, p1.y, p1.z), new THREE.Vector3(p2.x, p2.y, p1.z)],
          [new THREE.Vector3(p2.x, p2.y, p1.z), p2],
        ];
        pts.forEach((seg, i) => this._drawDashedLine(seg[0], seg[1], colors[i]));
        return { type: 'axis', value: p1.distanceTo(p2), dx, dy, dz, unit: 'mm', points: [p1, p2] };
      }
      case 'angle': {
        const v1 = new THREE.Vector3().subVectors(p1, p2).normalize();
        const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
        const angle = v1.angleTo(v2) * (180 / Math.PI);
        this._drawLine(p1, p2, 0x58a6ff);
        this._drawLine(p2, p3, 0x58a6ff);
        return { type: 'angle', value: angle, unit: '°', points: [p1, p2, p3] };
      }
      case 'radius': {
        return { type: 'radius', value: 0, unit: 'mm', note: '需要曲面拟合', points: [p1] };
      }
      case 'area':
      case 'volume':
        return { type: this.mode, value: 0, unit: this.mode === 'area' ? 'mm²' : 'mm³', note: '基于整体模型计算', points: [p1] };
      default:
        return null;
    }
  }

  _drawLine(p1, p2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
    this.scene.add(line);
    this.lines.push(line);
  }

  _drawDashedLine(p1, p2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.1, gapSize: 0.05 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.scene.add(line);
    this.lines.push(line);
  }

  clear() {
    this.markers.forEach(m => this.scene.remove(m));
    this.lines.forEach(l => this.scene.remove(l));
    this.markers = [];
    this.lines = [];
    this.points = [];
    this.result = null;
  }

  dispose() { this.clear(); }
}
