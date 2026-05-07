import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { getFileExt } from '../utils/helpers.js';

function normalizeAndCenter(object, material) {
  // BufferGeometry → 先包装成 Mesh 再计算包围盒
  if (object.isBufferGeometry) {
    const mesh = new THREE.Mesh(object, material);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4 / maxDim;
    object.scale(scale, scale, scale);
    center.multiplyScalar(scale);
    mesh.position.sub(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, size, center };
  }

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 4 / maxDim;

  object.scale.setScalar(scale);
  center.multiplyScalar(scale);
  object.position.sub(center);
  object.traverse(child => {
    if (child.isMesh) {
      if (material && !child.material?.map) child.material = material.clone();
      child.material.side = THREE.DoubleSide;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return { mesh: object, size, center };
}

function defaultMaterial(color = 0x58a6ff, metalness = 0.3, roughness = 0.4) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
}

// ===== 各格式加载器 =====

async function loadSTL(data) {
  const geometry = new STLLoader().parse(data);
  geometry.computeBoundingBox();
  return normalizeAndCenter(geometry, defaultMaterial());
}

async function loadOBJ(data) {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const object = new OBJLoader().parse(text);
  return normalizeAndCenter(object, defaultMaterial());
}

async function loadGLTF(data) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    new GLTFLoader().load(url, gltf => {
      URL.revokeObjectURL(url);
      resolve(normalizeAndCenter(gltf.scene, null));
    }, undefined, err => { URL.revokeObjectURL(url); reject(err); });
  });
}

async function loadFBX(data) {
  const object = new FBXLoader().parse(data, '');
  return normalizeAndCenter(object, defaultMaterial());
}

// 服务端转换后的 JSON 格式加载
async function loadConvertedJSON(jsonData) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  const group = new THREE.Group();

  for (const meshData of data.meshes) {
    if (!meshData.positions) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));
    if (meshData.indices) geo.setIndex(meshData.indices);
    if (meshData.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    else geo.computeVertexNormals();

    let color = 0x58a6ff;
    if (meshData.color?.length >= 3) color = new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2]);
    const mat = defaultMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return normalizeAndCenter(group, null);
}

// ===== 工厂入口 =====

const LOADERS = {
  stl: loadSTL,
  obj: loadOBJ,
  gltf: loadGLTF,
  glb: loadGLTF,
  fbx: loadFBX,
};

/**
 * 从 ArrayBuffer 或文本加载模型
 * @param {ArrayBuffer|string} data - 文件数据
 * @param {string} filename - 文件名
 * @returns {{ mesh: THREE.Object3D, size: THREE.Vector3 }}
 */
export async function loadModelFromData(data, filename) {
  const ext = getFileExt(filename);
  const loader = LOADERS[ext];
  if (!loader) throw new Error(`不支持的格式: ${ext}`);
  return loader(data);
}

/**
 * 从后端下载 URL 加载模型
 */
export async function loadModelFromUrl(url, filename) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);

  const ext = getFileExt(filename);

  // 服务端转换后的 JSON
  if (filename.endsWith('.json')) {
    const json = await res.json();
    return loadConvertedJSON(json);
  }

  if (ext === 'obj') {
    const text = await res.text();
    return loadOBJ(text);
  }

  const buffer = await res.arrayBuffer();
  return loadModelFromData(buffer, filename);
}

export { loadConvertedJSON };
