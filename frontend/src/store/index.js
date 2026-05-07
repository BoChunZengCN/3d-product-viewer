// 简易发布-订阅状态管理
const state = {
  user: null,
  isAuthenticated: false,
  currentModel: null,       // { id, name, format, mesh }
  folders: [],
  models: [],
  uploadProgress: 0,
  isUploading: false,
  convertJobId: null,
  measureMode: false,
  measureType: 'direct',
  clipEnabled: false,
  edgeLinesVisible: false,
  gridVisible: true,
  axesVisible: true,
  libraryOpen: false,
  shareDialogModel: null,   // 当前正在分享的模型
};

const listeners = new Map();

export function getState() { return state; }

export function setState(patch) {
  const changed = [];
  for (const key of Object.keys(patch)) {
    if (state[key] !== patch[key]) {
      state[key] = patch[key];
      changed.push(key);
    }
  }
  // 通知订阅者
  for (const key of changed) {
    const subs = listeners.get(key);
    if (subs) subs.forEach(fn => fn(state[key], state));
  }
}

// 订阅某个 key 的变化
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn); // unsubscribe
}

// 批量订阅
export function subscribeMany(keys, fn) {
  const unsubs = keys.map(k => subscribe(k, () => fn(state)));
  return () => unsubs.forEach(u => u());
}
