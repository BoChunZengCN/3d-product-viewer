import * as THREE from 'three';
import { MATERIAL_LIBRARY } from '../utils/constants.js';

export class MaterialManager {
  constructor() {
    this.current = { color: 0x58a6ff, metalness: 0.3, roughness: 0.4 };
    this.texture = null;
    this.customMaterials = [];
  }

  createMaterial(clipPlanes = []) {
    const params = {
      color: this.current.color,
      metalness: this.current.metalness,
      roughness: this.current.roughness,
      side: THREE.DoubleSide,
    };
    if (this.texture) params.map = this.texture;
    if (clipPlanes.length) params.clippingPlanes = clipPlanes;
    return new THREE.MeshStandardMaterial(params);
  }

  applyTo(mesh, clipPlanes = []) {
    if (!mesh) return;
    const apply = child => {
      if (child.isMesh) child.material = this.createMaterial(clipPlanes);
    };
    if (mesh.isMesh) apply(mesh);
    else mesh.traverse(apply);
  }

  setPreset(index) {
    const mat = MATERIAL_LIBRARY[index];
    if (!mat) return;
    this.current = { color: mat.color, metalness: mat.metalness, roughness: mat.roughness };
    return mat;
  }

  setColor(hex) { this.current.color = parseInt(hex.replace('#', '0x')); }
  setMetalness(v) { this.current.metalness = v; }
  setRoughness(v) { this.current.roughness = v; }

  setTexture(texture) { this.texture = texture; }
  clearTexture() { this.texture = null; }

  saveCustom(name) {
    const mat = { name, ...this.current, timestamp: Date.now() };
    this.customMaterials.push(mat);
    return mat;
  }
}
