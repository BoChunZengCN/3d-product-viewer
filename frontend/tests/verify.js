#!/usr/bin/env node
/**
 * 前端集成验证测试
 * 验证：模块结构、API 对接层、Three.js 核心模块、组件完整性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0, failed = 0;
const errors = [];

function assert(cond, name) {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}`); failed++; errors.push(name); }
}
function section(t) { console.log(`\n━━━ ${t} ━━━`); }

// ===== 1. 文件完整性 =====
section('1. 文件完整性');

const required = [
  'index.html', 'vite.config.js', 'package.json',
  'src/main.js', 'src/store/index.js',
  'src/api/client.js', 'src/api/auth.js', 'src/api/modules.js',
  'src/core/SceneManager.js', 'src/core/LoaderFactory.js',
  'src/core/MaterialManager.js', 'src/core/MeasureManager.js',
  'src/components/Auth/index.js', 'src/components/Toast/index.js',
  'src/components/ShareDialog/index.js',
  'src/styles/variables.css', 'src/styles/layout.css',
  'src/styles/components.css', 'src/styles/animations.css',
  'src/utils/constants.js', 'src/utils/helpers.js',
];
for (const f of required) {
  assert(fs.existsSync(path.join(ROOT, f)), `文件存在: ${f}`);
}

// ===== 2. API Client =====
section('2. API Client (client.js)');

const client = fs.readFileSync(path.join(ROOT, 'src/api/client.js'), 'utf8');
assert(client.includes('setTokens'), 'export setTokens');
assert(client.includes('getToken'), 'export getToken');
assert(client.includes('isLoggedIn'), 'export isLoggedIn');
assert(client.includes('clearTokens'), 'export clearTokens');
assert(client.includes('apiFetch'), 'export apiFetch');
assert(client.includes('uploadWithProgress'), 'export uploadWithProgress');
assert(client.includes("Bearer"), 'Bearer token 注入');
assert(client.includes('tryRefresh'), 'token 自动刷新');
assert(client.includes('localStorage'), 'token 持久化');
assert(client.includes('FormData'), 'FormData 上传支持');
assert(client.includes('XMLHttpRequest'), 'XHR 进度上传');
assert(client.includes('onProgress'), '上传进度回调');

// ===== 3. API Auth Module =====
section('3. API Auth (auth.js)');

const authApi = fs.readFileSync(path.join(ROOT, 'src/api/auth.js'), 'utf8');
assert(authApi.includes('/auth/register'), '对接 POST /auth/register');
assert(authApi.includes('/auth/login'), '对接 POST /auth/login');
assert(authApi.includes('/auth/me'), '对接 GET /auth/me');
assert(authApi.includes('setTokens'), '登录后设置 token');
assert(authApi.includes('clearTokens'), '退出清除 token');

// ===== 4. API Modules =====
section('4. API Modules (modules.js)');

const modules = fs.readFileSync(path.join(ROOT, 'src/api/modules.js'), 'utf8');

// Models API
assert(modules.includes('/models'), 'models.list');
assert(modules.includes('/models/upload'), 'models.upload');
assert(modules.includes('/models/${id}'), 'models.get/update/delete');
assert(modules.includes('/models/${id}/download'), 'models.downloadUrl');
assert(modules.includes('/models/${id}/thumbnail'), 'models.thumbnailUrl');
assert(modules.includes('/models/${id}/move'), 'models.move');

// Folders API
assert(modules.includes('/folders'), 'folders.list/create');
assert(modules.includes("method: 'DELETE'"), 'folders.delete');

// Share API
assert(modules.includes('/share'), 'share.create/list');
assert(modules.includes('/share/${token}'), 'share.access');
assert(modules.includes('/share/${token}/download'), 'share.downloadUrl');

// Convert API
assert(modules.includes('/convert/'), 'convert.status');
assert(modules.includes('pollStatus'), 'convert.pollStatus 轮询');
assert(modules.includes('completed'), '轮询完成检测');
assert(modules.includes('failed'), '轮询失败检测');

// ===== 5. Store =====
section('5. 状态管理 (store)');

const store = fs.readFileSync(path.join(ROOT, 'src/store/index.js'), 'utf8');
assert(store.includes('getState'), 'export getState');
assert(store.includes('setState'), 'export setState');
assert(store.includes('subscribe'), 'export subscribe');
assert(store.includes('isAuthenticated'), 'state.isAuthenticated');
assert(store.includes('currentModel'), 'state.currentModel');
assert(store.includes('uploadProgress'), 'state.uploadProgress');
assert(store.includes('measureMode'), 'state.measureMode');
assert(store.includes('shareDialogModel'), 'state.shareDialogModel');

// ===== 6. Three.js Core =====
section('6. SceneManager');

const sceneManager = fs.readFileSync(path.join(ROOT, 'src/core/SceneManager.js'), 'utf8');
assert(sceneManager.includes("import * as THREE from 'three'"), 'Three.js import');
assert(sceneManager.includes('OrbitControls'), 'OrbitControls');
assert(sceneManager.includes('PerspectiveCamera'), '透视相机');
assert(sceneManager.includes('WebGLRenderer'), 'WebGL渲染器');
assert(sceneManager.includes('AmbientLight'), '环境光');
assert(sceneManager.includes('DirectionalLight'), '方向光');
assert(sceneManager.includes('GridHelper'), '网格辅助');
assert(sceneManager.includes('AxesHelper'), '坐标轴辅助');
assert(sceneManager.includes('Raycaster'), '射线拾取');
assert(sceneManager.includes('setMesh'), 'setMesh 方法');
assert(sceneManager.includes('removeMesh'), 'removeMesh 方法');
assert(sceneManager.includes('toggleGrid'), 'toggleGrid 方法');
assert(sceneManager.includes('toggleAxes'), 'toggleAxes 方法');
assert(sceneManager.includes('toggleEdgeLines'), 'toggleEdgeLines 方法');
assert(sceneManager.includes('setView'), 'setView 方法');
assert(sceneManager.includes('fitToModel'), 'fitToModel 方法');
assert(sceneManager.includes('raycast'), 'raycast 方法');
assert(sceneManager.includes('dispose'), 'dispose 方法');
assert(sceneManager.includes('fill.position.set'), '灯光位置正确设置');

// ===== 7. LoaderFactory =====
section('7. LoaderFactory');

const loader = fs.readFileSync(path.join(ROOT, 'src/core/LoaderFactory.js'), 'utf8');
assert(loader.includes('STLLoader'), 'STL 加载');
assert(loader.includes('OBJLoader'), 'OBJ 加载');
assert(loader.includes('GLTFLoader'), 'GLTF 加载');
assert(loader.includes('FBXLoader'), 'FBX 加载');
assert(loader.includes('loadConvertedJSON'), '服务端转换JSON加载');
assert(loader.includes('normalizeAndCenter'), '归一化居中');
assert(loader.includes('loadModelFromData'), 'export loadModelFromData');
assert(loader.includes('loadModelFromUrl'), 'export loadModelFromUrl');
assert(loader.includes('Authorization'), '下载时附加 token');
// Bug fix verification
assert(loader.includes('new THREE.Mesh(object, material)') && loader.includes('isBufferGeometry'), 'BufferGeometry 先包成 Mesh 再计算包围盒（已修复）');

// ===== 8. MaterialManager =====
section('8. MaterialManager');

const matMgr = fs.readFileSync(path.join(ROOT, 'src/core/MaterialManager.js'), 'utf8');
assert(matMgr.includes('MeshStandardMaterial'), 'PBR 材质');
assert(matMgr.includes('setPreset'), 'setPreset');
assert(matMgr.includes('setColor'), 'setColor');
assert(matMgr.includes('setMetalness'), 'setMetalness');
assert(matMgr.includes('setRoughness'), 'setRoughness');
assert(matMgr.includes('setTexture'), 'setTexture');
assert(matMgr.includes('applyTo'), 'applyTo');
assert(matMgr.includes('clippingPlanes'), '截面裁剪支持');

// ===== 9. MeasureManager =====
section('9. MeasureManager');

const measure = fs.readFileSync(path.join(ROOT, 'src/core/MeasureManager.js'), 'utf8');
assert(measure.includes("'direct'"), '距离测量模式');
assert(measure.includes("'axis'"), '轴向测量模式');
assert(measure.includes("'angle'"), '角度测量模式');
assert(measure.includes("'radius'"), '半径测量模式');
assert(measure.includes("'area'"), '面积测量模式');
assert(measure.includes("'volume'"), '体积测量模式');
assert(measure.includes('addPoint'), 'addPoint 方法');
assert(measure.includes('clear'), 'clear 方法');
assert(measure.includes('distanceTo'), '距离计算');
assert(measure.includes('angleTo'), '角度计算');

// ===== 10. Components =====
section('10. 组件');

const auth = fs.readFileSync(path.join(ROOT, 'src/components/Auth/index.js'), 'utf8');
assert(auth.includes('renderAuth'), 'export renderAuth');
assert(auth.includes('renderUserBar'), 'export renderUserBar');
assert(auth.includes('auth-overlay'), '登录覆盖层');
assert(auth.includes('logout'), '退出登录');

const toast = fs.readFileSync(path.join(ROOT, 'src/components/Toast/index.js'), 'utf8');
assert(toast.includes('showToast'), 'export showToast');
assert(toast.includes('success'), 'success 类型');
assert(toast.includes('error'), 'error 类型');

const shareDlg = fs.readFileSync(path.join(ROOT, 'src/components/ShareDialog/index.js'), 'utf8');
assert(shareDlg.includes('openShareDialog'), 'export openShareDialog');
assert(shareDlg.includes('share-password'), '密码输入框');
assert(shareDlg.includes('share-max-views'), '最大次数输入');
assert(shareDlg.includes('datetime-local'), '过期时间选择');
assert(shareDlg.includes('clipboard'), '复制到剪贴板');

// ===== 11. main.js 对接完整性 =====
section('11. main.js 对接完整性');

const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
assert(main.includes('bootstrap'), '应用启动入口');
assert(main.includes('isLoggedIn'), '检查登录状态');
assert(main.includes('getProfile'), '获取用户信息');
assert(main.includes('loadCloudData'), '加载云端数据');
assert(main.includes('renderAuth'), '渲染认证界面');
assert(main.includes('renderUserBar'), '渲染用户栏');
assert(main.includes('SceneManager'), '初始化场景');
assert(main.includes('MaterialManager'), '初始化材质');
assert(main.includes('MeasureManager'), '初始化测量');
assert(main.includes('loadModelFromData'), '本地文件加载');
assert(main.includes('loadModelFromUrl'), '云端文件加载');
assert(main.includes('uploadWithProgress'), '带进度上传');
assert(main.includes('openShareDialog'), '分享功能');
assert(main.includes('folders.list'), '加载目录列表');
assert(main.includes('models.list'), '加载模型列表');
assert(main.includes('models.delete'), '删除模型');
assert(main.includes('folders.create'), '创建目录');
assert(main.includes('folders.delete'), '删除目录');
assert(main.includes('folders.rename'), '重命名目录');
assert(main.includes('convert.pollStatus'), '格式转换轮询');
assert(main.includes('NEEDS_SERVER_CONVERT'), 'STEP/IGES 走服务端');
assert(main.includes('handleFile'), '文件处理入口');
assert(main.includes('saveToCloud'), '保存到云端');
assert(main.includes('loadCloudModel'), '加载云端模型');
assert(main.includes('escape'), 'ESC 退出测量');
assert(main.includes('setupKeyboard'), '键盘快捷键');

// ===== 12. Vite Config =====
section('12. 构建配置');

const vite = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
assert(vite.includes("manualChunks"), 'Three.js 代码分割');
assert(vite.includes("'/api'"), 'API 代理配置');
assert(vite.includes('localhost:3000'), '代理指向后端');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(pkg.dependencies?.three, '依赖: three');
assert(pkg.devDependencies?.vite, 'devDep: vite');

// ===== 13. CSS 样式完整性 =====
section('13. CSS 样式');

const vars = fs.readFileSync(path.join(ROOT, 'src/styles/variables.css'), 'utf8');
assert(vars.includes('--bg-primary'), 'CSS 变量: --bg-primary');
assert(vars.includes('--accent-cyan'), 'CSS 变量: --accent-cyan');

const layout = fs.readFileSync(path.join(ROOT, 'src/styles/layout.css'), 'utf8');
assert(layout.includes('.auth-overlay'), '认证覆盖层样式');
assert(layout.includes('.sidebar'), '侧栏样式');
assert(layout.includes('.viewport'), '视口样式');
assert(layout.includes('.model-library'), '模型库样式');

const components = fs.readFileSync(path.join(ROOT, 'src/styles/components.css'), 'utf8');
assert(components.includes('.upload-zone'), '上传区样式');
assert(components.includes('.material-grid'), '材质网格样式');
assert(components.includes('.measure-result'), '测量结果样式');
assert(components.includes('.share-dialog'), '分享对话框样式');
assert(components.includes('.toast'), 'Toast 样式');
assert(components.includes('.progress-bar'), '上传进度条样式');

// ===== 14. HTML 入口 =====
section('14. HTML 入口');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(html.includes('type="module"'), 'ESM 模块加载');
assert(html.includes('/src/main.js'), '指向 main.js');
assert(html.includes('variables.css'), '引入 CSS 变量');
assert(html.includes('id="app"'), '应用挂载点');

// ===== Result =====
console.log(`\n${'━'.repeat(40)}`);
console.log(`总计: ${passed + failed} 项  ✅ ${passed} 通过  ❌ ${failed} 失败`);
if (errors.length) {
  console.log(`\n失败项:`);
  errors.forEach(e => console.log(`  - ${e}`));
}
console.log(`${'━'.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
