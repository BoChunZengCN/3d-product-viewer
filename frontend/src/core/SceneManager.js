import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(5, 5, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.currentMesh = null;
    this.gridHelper = null;
    this.axesHelper = null;
    this.edgeLinesGroup = null;

    this._setupLights();
    this._setupGrid();
    this._setupResize();
    this._applyDefaultGradient();

    this._updateCallbacks = [];
    this._animate();
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0x404060, 1.2));
    const main = new THREE.DirectionalLight(0xffffff, 1.5);
    main.position.set(5, 10, 7);
    main.castShadow = true;
    this.scene.add(main);
    const fill = new THREE.DirectionalLight(0x58a6ff, 0.5);
    fill.position.set(-5, 0, -5);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xbc8cff, 0.3);
    rim.position.set(0, -5, 5);
    this.scene.add(rim);
  }

  _setupGrid() {
    this.gridHelper = new THREE.GridHelper(20, 20, 0x58a6ff, 0x484f58);
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(3);
    this.axesHelper.position.y = 0.02;
    this.scene.add(this.axesHelper);
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });
  }

  _applyDefaultGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#2d3b55');
    grad.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    this.scene.background = tex;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateCallbacks.forEach(fn => fn());
  }

  onUpdate(fn) { this._updateCallbacks.push(fn); }

  setMesh(mesh, filename, originalSize, format) {
    if (this.currentMesh) this.scene.remove(this.currentMesh);
    if (this.edgeLinesGroup) { this.scene.remove(this.edgeLinesGroup); this.edgeLinesGroup = null; }

    this.currentMesh = mesh;
    this.scene.add(mesh);
    return { filename, originalSize, format };
  }

  removeMesh() {
    if (this.currentMesh) { this.scene.remove(this.currentMesh); this.currentMesh = null; }
    if (this.edgeLinesGroup) { this.scene.remove(this.edgeLinesGroup); this.edgeLinesGroup = null; }
  }

  toggleGrid(visible) { if (this.gridHelper) this.gridHelper.visible = visible; }
  toggleAxes(visible) { if (this.axesHelper) this.axesHelper.visible = visible; }

  toggleEdgeLines(visible) {
    if (this.edgeLinesGroup) { this.scene.remove(this.edgeLinesGroup); this.edgeLinesGroup = null; }
    if (!visible || !this.currentMesh) return;

    this.edgeLinesGroup = new THREE.Group();
    this.currentMesh.traverse(child => {
      if (!child.isMesh || !child.geometry) return;
      if (child.geometry.attributes.position.count > 500000) return;
      const edges = new THREE.EdgesGeometry(child.geometry, 30);
      if (!edges.attributes.position?.count) { edges.dispose(); return; }
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
      line.position.copy(child.position);
      line.rotation.copy(child.rotation);
      line.scale.copy(child.scale);
      this.edgeLinesGroup.add(line);
    });
    this.scene.add(this.edgeLinesGroup);
  }

  setView(position, target = [0, 0, 0], duration = 500) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos = new THREE.Vector3(...position);
    const endTarget = new THREE.Vector3(...target);
    const startTime = performance.now();

    const anim = (time) => {
      const t = Math.min((time - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(startPos, endPos, e);
      this.controls.target.lerpVectors(startTarget, endTarget, e);
      this.controls.update();
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  fitToModel() {
    if (!this.currentMesh) return;
    const box = new THREE.Box3().setFromObject(this.currentMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    this.setView(
      [center.x + maxDim * 1.5, center.y + maxDim * 1.5, center.z + maxDim * 1.5],
      [center.x, center.y, center.z]
    );
  }

  raycast(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.currentMesh) return [];
    return this.raycaster.intersectObject(this.currentMesh, true);
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
  }
}
