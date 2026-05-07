import { SceneManager } from './core/SceneManager.js';
import { MaterialManager } from './core/MaterialManager.js';
import { MeasureManager } from './core/MeasureManager.js';
import { loadModelFromData, loadModelFromUrl } from './core/LoaderFactory.js';
import { isLoggedIn } from './api/client.js';
import * as authApi from './api/auth.js';
import { models, folders, convert } from './api/modules.js';
import { uploadWithProgress } from './api/client.js';
import { getState, setState, subscribe } from './store/index.js';
import { showToast } from './components/Toast/index.js';
import { renderAuth, renderUserBar } from './components/Auth/index.js';
import { openShareDialog } from './components/ShareDialog/index.js';
import { MATERIAL_LIBRARY, VIEW_PRESETS, NEEDS_SERVER_CONVERT } from './utils/constants.js';
import { formatFileSize, formatDate, getFileExt, getFormatFromExt } from './utils/helpers.js';

let sceneManager, materialManager, measureManager;

// ===== App Bootstrap =====
async function bootstrap() {
  buildAppShell();

  if (isLoggedIn()) {
    try {
      const user = await authApi.getProfile();
      setState({ user, isAuthenticated: true });
      initViewer();
      loadCloudData();
    } catch {
      // token invalid
      authApi.logout();
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }

  // 监听认证状态
  subscribe('isAuthenticated', (val) => {
    if (val) { initViewer(); loadCloudData(); }
  });
}

function showAuthScreen() {
  const authContainer = document.createElement('div');
  authContainer.id = 'auth-container';
  document.body.appendChild(authContainer);
  renderAuth(authContainer);
}

function buildAppShell() {
  document.getElementById('app').innerHTML = `
    <div class="app-container" id="main-app" style="display:none">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1>轻量化三维预览</h1>
              <div class="subtitle">数据可视化平台 V2.0</div>
            </div>
          </div>
        </div>
        <div class="sidebar-content" id="sidebar-content"></div>
        <div id="user-bar"></div>
      </aside>
      <main class="viewport">
        <div id="canvas-container"></div>
        <div class="viewport-overlay">
          <div class="placeholder" id="placeholder">
            <div style="width:80px;height:80px;margin:0 auto 20px;background:var(--bg-tertiary);border-radius:20px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-color)">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3>三维模型预览</h3>
            <p>导入文件或从模型库加载</p>
          </div>
          <div class="model-info-badge" id="model-info-badge">
            <div class="status-dot" style="width:8px;height:8px;background:var(--accent-green);border-radius:50%;box-shadow:0 0 8px var(--accent-green)"></div>
            <span id="model-info-text"></span>
          </div>
          <div class="coord-display" id="coord-display">
            <span style="color:var(--text-muted)">X:</span><span id="coord-x" style="color:var(--accent-cyan)">0.00</span>
            <span style="color:var(--text-muted);margin-left:12px">Y:</span><span id="coord-y" style="color:var(--accent-cyan)">0.00</span>
            <span style="color:var(--text-muted);margin-left:12px">Z:</span><span id="coord-z" style="color:var(--accent-cyan)">0.00</span>
          </div>
          <div id="toast-container" class="toast-container"></div>
        </div>
        <div class="loading-overlay" id="loading-overlay"><div class="spinner"></div><div class="loading-text" id="loading-text">正在加载模型...</div></div>
        <button class="btn-secondary" id="library-toggle" style="position:absolute;top:50%;right:0;transform:translateY(-50%);width:32px;height:64px;border-radius:8px 0 0 8px;border-right:none;z-index:25;pointer-events:auto">☰</button>
        <div class="model-library" id="model-library">
          <div style="padding:20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
            <h2 style="font-size:14px;font-weight:600">模型库</h2>
            <button class="file-remove" id="library-close" style="width:28px;height:28px">×</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:16px" id="library-content">
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <input class="auth-input" id="folder-create-input" placeholder="输入目录名称..." style="margin:0;flex:1">
              <button class="btn-primary" id="folder-create-btn" style="white-space:nowrap">+ 新建</button>
            </div>
            <div id="library-folders"></div>
          </div>
        </div>
      </main>
    </div>
  `;
}

// ===== Init Viewer =====
function initViewer() {
  const authContainer = document.getElementById('auth-container');
  if (authContainer) authContainer.remove();

  document.getElementById('main-app').style.display = 'flex';
  const user = getState().user;
  renderUserBar(document.getElementById('user-bar'), user);

  // Scene
  sceneManager = new SceneManager(document.getElementById('canvas-container'));
  materialManager = new MaterialManager();
  measureManager = new MeasureManager(sceneManager.scene);

  buildSidebarPanels();
  setupUploadZone();
  setupViewSwitcher();
  setupMeasurePanel();
  setupMaterialPanel();
  setupDisplayToggles();
  setupLibrary();
  setupKeyboard();
  setupCanvasEvents();
}

// ===== Cloud Data =====
async function loadCloudData() {
  try {
    const [foldersData, modelsData] = await Promise.all([
      folders.list(),
      models.list({ limit: 200 }),
    ]);
    setState({ folders: foldersData, models: modelsData.models });
    renderLibraryContent();
  } catch (err) {
    showToast('加载数据失败: ' + err.message, 'error');
  }
}

// ===== Sidebar Panels =====
function buildSidebarPanels() {
  document.getElementById('sidebar-content').innerHTML = `
    <!-- Upload -->
    <div class="panel">
      <div class="panel-header"><div class="panel-indicator"></div><h2>文件导入</h2></div>
      <div class="upload-zone" id="upload-zone">
        <div class="upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <p>拖拽文件到此处或点击上传</p>
        <p class="formats">.STL .OBJ .STEP .IGES .GLTF .GLB .FBX</p>
      </div>
      <input type="file" id="file-input" accept=".stl,.obj,.step,.stp,.iges,.igs,.gltf,.glb,.fbx,.dxf,.xyz,.ifc" style="display:none">
      <div id="upload-progress" class="upload-progress" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
        <div class="progress-text" id="progress-text">0%</div>
      </div>
      <div id="file-list"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <select class="auth-input" id="save-folder-select" style="flex:1;margin:0"><option value="">默认目录</option></select>
        <button class="btn-secondary" id="save-btn" disabled style="white-space:nowrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
          保存到云端
        </button>
      </div>
    </div>

    <!-- Material -->
    <div class="panel">
      <div class="panel-header"><div class="panel-indicator" style="background:var(--accent-orange)"></div><h2>材质库</h2></div>
      <div class="material-grid" id="material-grid"></div>
      <div class="material-row"><label>颜色</label><div class="color-input-wrapper"><input type="color" id="mat-color" value="#58a6ff"></div></div>
      <div class="material-row"><label>金属度</label><div class="slider-wrapper"><input type="range" id="mat-metalness" min="0" max="100" value="30"><span class="slider-value" id="mat-metalness-val">0.30</span></div></div>
      <div class="material-row"><label>粗糙度</label><div class="slider-wrapper"><input type="range" id="mat-roughness" min="0" max="100" value="40"><span class="slider-value" id="mat-roughness-val">0.40</span></div></div>
    </div>

    <!-- Display -->
    <div class="panel">
      <div class="panel-header"><div class="panel-indicator" style="background:var(--accent-green)"></div><h2>显示设置</h2></div>
      <div class="toggle-row"><span class="toggle-label">网格线</span><div class="toggle-switch active" id="toggle-grid"></div></div>
      <div class="toggle-row"><span class="toggle-label">坐标轴</span><div class="toggle-switch active" id="toggle-axes"></div></div>
      <div class="toggle-row"><span class="toggle-label">轮廓线</span><div class="toggle-switch" id="toggle-edges"></div></div>
    </div>

    <!-- Views -->
    <div class="panel">
      <div class="panel-header"><div class="panel-indicator" style="background:var(--accent-cyan)"></div><h2>视图切换</h2></div>
      <div class="view-grid" id="view-grid"></div>
    </div>

    <!-- Measure -->
    <div class="panel">
      <div class="panel-header"><div class="panel-indicator" style="background:var(--accent-orange)"></div><h2>测量工具</h2></div>
      <div class="measure-mode-select" id="measure-modes"></div>
      <button class="btn-secondary" id="measure-btn" style="width:100%">启用距离测量</button>
      <div class="measure-result" id="measure-result">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px" id="measure-label">测量距离</div>
        <span class="measure-result-value" id="measure-value">0.00</span>
        <span style="font-size:13px;color:var(--text-secondary);margin-left:4px" id="measure-unit">mm</span>
        <div id="measure-axis-detail" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);font-family:monospace;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">ΔX:</span><span style="color:var(--accent-cyan)" id="axis-dx">0.00 mm</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-muted)">ΔY:</span><span style="color:var(--accent-cyan)" id="axis-dy">0.00 mm</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ΔZ:</span><span style="color:var(--accent-cyan)" id="axis-dz">0.00 mm</span></div>
        </div>
      </div>
    </div>
  `;
}

// ===== Upload Zone (cloud upload) =====
function setupUploadZone() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  document.getElementById('save-btn').addEventListener('click', saveToCloud);
}

let pendingFile = null;

async function handleFile(file) {
  pendingFile = file;
  const ext = getFileExt(file.name);
  const format = getFormatFromExt(ext);

  // 本地预览
  showLoading(true, '正在解析模型...');
  try {
    // 对于需要服务端转换的格式，先上传后端
    if (NEEDS_SERVER_CONVERT.has(format)) {
      showLoading(true, '上传到服务器转换中...');
      await uploadAndConvert(file);
      return;
    }

    const data = ext === 'obj' ? await file.text() : await file.arrayBuffer();
    const { mesh, size } = await loadModelFromData(data, file.name);
    sceneManager.setMesh(mesh, file.name, size, format);
    sceneManager.fitToModel();

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('model-info-badge').classList.add('show');
    document.getElementById('model-info-text').textContent = `${file.name} (${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} mm)`;
    document.getElementById('coord-display').classList.add('show');
    document.getElementById('save-btn').disabled = false;

    addFileToList(file.name, format);
    showToast('模型加载成功', 'success');
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function uploadAndConvert(file) {
  const progressEl = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  progressEl.style.display = 'block';

  try {
    // 上传
    const result = await uploadWithProgress('/models/upload', file,
      { folderId: document.getElementById('save-folder-select').value },
      (pct) => { fill.style.width = pct + '%'; text.textContent = `上传 ${pct}%`; }
    );

    // 如果有转换任务，轮询
    if (result.convertJobId) {
      text.textContent = '服务端转换中...';
      const job = await convert.pollStatus(result.convertJobId, (p) => {
        fill.style.width = p + '%';
        text.textContent = `转换 ${p}%`;
      });

      // 下载转换结果并加载
      const downloadUrl = models.downloadUrl(result.model.id, 'converted');
      const { mesh, size } = await loadModelFromUrl(downloadUrl, result.model.name + '.json');
      sceneManager.setMesh(mesh, file.name, size, getFormatFromExt(getFileExt(file.name)));
      sceneManager.fitToModel();
    }

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('model-info-badge').classList.add('show');
    document.getElementById('model-info-text').textContent = file.name;
    document.getElementById('coord-display').classList.add('show');
    pendingFile = null; // 已上传到云端

    showToast('模型已上传并转换完成', 'success');
    loadCloudData();
  } catch (err) {
    showToast('上传/转换失败: ' + err.message, 'error');
  } finally {
    progressEl.style.display = 'none';
    showLoading(false);
  }
}

async function saveToCloud() {
  if (!pendingFile) { showToast('没有待保存的文件', 'error'); return; }
  const folderId = document.getElementById('save-folder-select').value;

  const progressEl = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  progressEl.style.display = 'block';

  try {
    await uploadWithProgress('/models/upload', pendingFile, { folderId },
      (pct) => { fill.style.width = pct + '%'; text.textContent = `上传 ${pct}%`; }
    );
    showToast('模型已保存到云端', 'success');
    document.getElementById('save-btn').disabled = true;
    pendingFile = null;
    loadCloudData();
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  } finally {
    progressEl.style.display = 'none';
  }
}

function addFileToList(filename, format) {
  const list = document.getElementById('file-list');
  list.innerHTML = `
    <div class="file-item">
      <div class="file-icon">${format}</div>
      <div class="file-info"><div class="file-name">${filename}</div><div class="file-meta">${format} · 当前预览</div></div>
      <button class="file-remove" id="file-remove-btn">×</button>
    </div>
  `;
  document.getElementById('file-remove-btn').addEventListener('click', () => {
    sceneManager.removeMesh();
    list.innerHTML = '';
    document.getElementById('placeholder').classList.remove('hidden');
    document.getElementById('model-info-badge').classList.remove('show');
    document.getElementById('coord-display').classList.remove('show');
    document.getElementById('save-btn').disabled = true;
    pendingFile = null;
  });
}

// ===== View Switcher =====
function setupViewSwitcher() {
  const grid = document.getElementById('view-grid');
  const icons = { front: '+', back: '○', left: '◁', right: '▷', top: '△', bottom: '▽', iso: '⬡' };
  grid.innerHTML = Object.entries(VIEW_PRESETS).map(([key, v]) =>
    `<button class="view-btn${key === 'iso' ? ' active' : ''}" data-view="${key}"><span style="font-size:16px">${icons[key]}</span><span>${v.label}</span></button>`
  ).join('');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    grid.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = VIEW_PRESETS[btn.dataset.view];
    sceneManager.setView(preset.pos);
  });
}

// ===== Measure Panel =====
function setupMeasurePanel() {
  const modes = ['direct', 'axis', 'angle', 'radius', 'area', 'volume'];
  const labels = { direct: '距离', axis: '轴向', angle: '角度', radius: '半径', area: '面积', volume: '体积' };
  document.getElementById('measure-modes').innerHTML = modes.map(m =>
    `<button class="measure-mode-btn${m === 'direct' ? ' active' : ''}" data-mode="${m}">${labels[m]}</button>`
  ).join('');

  document.getElementById('measure-modes').addEventListener('click', e => {
    const btn = e.target.closest('.measure-mode-btn');
    if (!btn) return;
    document.querySelectorAll('.measure-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    measureManager.setMode(btn.dataset.mode);
  });

  document.getElementById('measure-btn').addEventListener('click', () => {
    const active = measureManager.toggle();
    document.getElementById('measure-btn').classList.toggle('active', active);
    document.getElementById('measure-btn').style.background = active ? 'var(--accent-orange)' : '';
    document.getElementById('measure-btn').style.color = active ? 'var(--bg-primary)' : '';
    document.getElementById('measure-btn').textContent = active ? '停止测量 (ESC)' : '启用距离测量';
    if (!active) document.getElementById('measure-result').classList.remove('show');
    showToast(active ? '点击模型选取测量点' : '测量已停止', 'info');
  });
}

// ===== Material Panel =====
function setupMaterialPanel() {
  const grid = document.getElementById('material-grid');
  grid.innerHTML = MATERIAL_LIBRARY.map((m, i) => {
    const hex = '#' + m.color.toString(16).padStart(6, '0');
    return `<div class="material-item${i === 0 ? ' active' : ''}" data-index="${i}" data-name="${m.name}" style="background:${hex}"></div>`;
  }).join('');

  grid.addEventListener('click', e => {
    const item = e.target.closest('.material-item');
    if (!item) return;
    grid.querySelectorAll('.material-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const mat = materialManager.setPreset(parseInt(item.dataset.index));
    materialManager.applyTo(sceneManager.currentMesh);
    showToast(`材质: ${mat.name}`, 'success');
  });

  document.getElementById('mat-color').addEventListener('input', e => {
    materialManager.setColor(e.target.value);
    materialManager.applyTo(sceneManager.currentMesh);
  });
  document.getElementById('mat-metalness').addEventListener('input', e => {
    const v = e.target.value / 100;
    document.getElementById('mat-metalness-val').textContent = v.toFixed(2);
    materialManager.setMetalness(v);
    materialManager.applyTo(sceneManager.currentMesh);
  });
  document.getElementById('mat-roughness').addEventListener('input', e => {
    const v = e.target.value / 100;
    document.getElementById('mat-roughness-val').textContent = v.toFixed(2);
    materialManager.setRoughness(v);
    materialManager.applyTo(sceneManager.currentMesh);
  });
}

// ===== Display Toggles =====
function setupDisplayToggles() {
  const bind = (id, initial, fn) => {
    const el = document.getElementById(id);
    let on = initial;
    if (on) el.classList.add('active');
    el.addEventListener('click', () => { on = !on; el.classList.toggle('active', on); fn(on); });
  };
  bind('toggle-grid', true, v => sceneManager.toggleGrid(v));
  bind('toggle-axes', true, v => sceneManager.toggleAxes(v));
  bind('toggle-edges', false, v => sceneManager.toggleEdgeLines(v));
}

// ===== Model Library =====
function setupLibrary() {
  document.getElementById('library-toggle').addEventListener('click', () => {
    document.getElementById('model-library').classList.toggle('open');
  });
  document.getElementById('library-close').addEventListener('click', () => {
    document.getElementById('model-library').classList.remove('open');
  });

  document.getElementById('folder-create-btn').addEventListener('click', async () => {
    const input = document.getElementById('folder-create-input');
    const name = input.value.trim();
    if (!name) return;
    try {
      await folders.create(name);
      input.value = '';
      showToast('目录已创建', 'success');
      loadCloudData();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function renderLibraryContent() {
  const state = getState();
  const container = document.getElementById('library-folders');
  const folderSelect = document.getElementById('save-folder-select');

  // 更新目录下拉
  folderSelect.innerHTML = '<option value="">默认目录</option>';
  state.folders.forEach(f => {
    folderSelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
  });

  if (!state.models.length && !state.folders.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px"><p>暂无保存的模型</p></div>';
    return;
  }

  let html = '';

  // 渲染每个目录
  state.folders.forEach(folder => {
    const folderModels = state.models.filter(m => m.folderId === folder.id);
    html += `<div class="folder-section">
      <div class="folder-header" data-folder-id="${folder.id}">
        <span style="color:var(--accent-yellow)">📁</span>
        <div class="folder-name">${folder.name}</div>
        <div class="folder-count">${folderModels.length}</div>
        <button class="file-remove" data-rename="${folder.id}" style="width:22px;height:22px;font-size:11px">✎</button>
        <button class="file-remove" data-delete-folder="${folder.id}" style="width:22px;height:22px">×</button>
      </div>
      <div class="folder-models">${folderModels.map(m => modelItemHtml(m)).join('')}</div>
    </div>`;
  });

  // 未分类
  const uncategorized = state.models.filter(m => !m.folderId);
  if (uncategorized.length) {
    html += `<div class="folder-section">
      <div class="folder-header"><span style="color:var(--accent-yellow)">📁</span><div class="folder-name">默认目录</div><div class="folder-count">${uncategorized.length}</div></div>
      <div class="folder-models">${uncategorized.map(m => modelItemHtml(m)).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;

  // 事件绑定
  container.querySelectorAll('[data-load-model]').forEach(el => {
    el.addEventListener('click', () => loadCloudModel(el.dataset.loadModel));
  });
  container.querySelectorAll('[data-share-model]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const model = state.models.find(m => m.id === el.dataset.shareModel);
      if (model) openShareDialog(model);
    });
  });
  container.querySelectorAll('[data-delete-model]').forEach(el => {
    el.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('确定删除此模型？')) return;
      try { await models.delete(el.dataset.deleteModel); showToast('已删除', 'info'); loadCloudData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
  container.querySelectorAll('[data-delete-folder]').forEach(el => {
    el.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('删除此目录？模型将移至默认目录')) return;
      try { await folders.delete(el.dataset.deleteFolder); showToast('目录已删除', 'info'); loadCloudData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
  container.querySelectorAll('[data-rename]').forEach(el => {
    el.addEventListener('click', async e => {
      e.stopPropagation();
      const folder = state.folders.find(f => f.id === el.dataset.rename);
      const name = prompt('新目录名称:', folder?.name);
      if (!name?.trim()) return;
      try { await folders.rename(el.dataset.rename, name.trim()); loadCloudData(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
}

function modelItemHtml(m) {
  return `
    <div class="folder-model-item" data-load-model="${m.id}">
      <div class="file-icon" style="width:28px;height:28px;font-size:9px;border-radius:5px">${m.format}</div>
      <div style="flex:1;min-width:0">
        <div class="file-name" style="font-size:12px">${m.name}</div>
        <div class="file-meta">${formatDate(m.createdAt)} · ${formatFileSize(m.originalSize)}</div>
      </div>
      <button class="file-remove" data-share-model="${m.id}" style="width:22px;height:22px;font-size:11px" title="分享">🔗</button>
      <button class="file-remove" data-delete-model="${m.id}" style="width:22px;height:22px" title="删除">×</button>
    </div>
  `;
}

async function loadCloudModel(modelId) {
  showLoading(true, '正在下载模型...');
  try {
    const model = await models.get(modelId);
    const useConverted = model.convertedPath && NEEDS_SERVER_CONVERT.has(model.format);
    const url = models.downloadUrl(modelId, useConverted ? 'converted' : undefined);
    const filename = useConverted ? model.name + '.json' : model.name;

    const { mesh, size } = await loadModelFromUrl(url, filename);
    sceneManager.setMesh(mesh, model.name, size, model.format);
    sceneManager.fitToModel();

    document.getElementById('placeholder').classList.add('hidden');
    document.getElementById('model-info-badge').classList.add('show');
    document.getElementById('model-info-text').textContent = `${model.name} (${model.format})`;
    document.getElementById('coord-display').classList.add('show');

    addFileToList(model.name, model.format);
    showToast(`已加载: ${model.name}`, 'success');
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ===== Canvas Events =====
function setupCanvasEvents() {
  const canvas = document.getElementById('canvas-container');
  canvas.addEventListener('click', e => {
    if (!measureManager.active) return;
    const intersects = sceneManager.raycast(e);
    if (!intersects.length) return;

    const result = measureManager.addPoint(intersects[0]);
    if (!result) return;

    if (result.partial) {
      showToast(`已选取第 ${result.count} 个点，共需 ${result.needed} 个`, 'info');
      return;
    }

    // 显示结果
    document.getElementById('measure-value').textContent = result.value.toFixed(2);
    document.getElementById('measure-unit').textContent = result.unit;
    document.getElementById('measure-result').classList.add('show');

    if (result.type === 'axis') {
      document.getElementById('measure-axis-detail').style.display = 'block';
      document.getElementById('axis-dx').textContent = result.dx.toFixed(2) + ' mm';
      document.getElementById('axis-dy').textContent = result.dy.toFixed(2) + ' mm';
      document.getElementById('axis-dz').textContent = result.dz.toFixed(2) + ' mm';
    } else {
      document.getElementById('measure-axis-detail').style.display = 'none';
    }

    showToast(`${result.type}: ${result.value.toFixed(2)} ${result.unit}`, 'success');
    setTimeout(() => measureManager.clear(), 5000);
  });

  // 坐标追踪
  canvas.addEventListener('mousemove', e => {
    if (!sceneManager.currentMesh) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    document.getElementById('coord-x').textContent = x.toFixed(2);
    document.getElementById('coord-y').textContent = y.toFixed(2);
  });
}

// ===== Keyboard Shortcuts =====
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    if (k === 'escape' && measureManager.active) {
      measureManager.toggle();
      document.getElementById('measure-btn').classList.remove('active');
      document.getElementById('measure-btn').style.background = '';
      document.getElementById('measure-btn').style.color = '';
      document.getElementById('measure-btn').textContent = '启用距离测量';
      document.getElementById('measure-result').classList.remove('show');
    }
    if (k === 'r' && !ctrl) sceneManager.fitToModel();
    if (ctrl && k === 'g') { e.preventDefault(); document.getElementById('toggle-grid').click(); }
    if (ctrl && k === 'l') { e.preventDefault(); document.getElementById('library-toggle').click(); }
    if (k === 'm' && !ctrl) document.getElementById('measure-btn').click();
    if (k >= '1' && k <= '7' && !ctrl) {
      const views = Object.keys(VIEW_PRESETS);
      const preset = VIEW_PRESETS[views[parseInt(k) - 1]];
      if (preset) sceneManager.setView(preset.pos);
    }
  });
}

// ===== Helpers =====
function showLoading(show, text = '正在加载模型...') {
  const el = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-text');
  if (textEl) textEl.textContent = text;
  el.classList.toggle('show', show);
}

// ===== Start =====
bootstrap();
