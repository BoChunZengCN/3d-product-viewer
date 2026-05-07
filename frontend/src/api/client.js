// 带自动 token 注入和刷新的 fetch 封装
const BASE = '/api';

let accessToken = localStorage.getItem('token') || null;
let refreshTokenVal = localStorage.getItem('refreshToken') || null;

export function setTokens(access, refresh) {
  accessToken = access;
  refreshTokenVal = refresh;
  if (access) localStorage.setItem('token', access);
  else localStorage.removeItem('token');
  if (refresh) localStorage.setItem('refreshToken', refresh);
  else localStorage.removeItem('refreshToken');
}

export function getToken() { return accessToken; }
export function isLoggedIn() { return !!accessToken; }

export function clearTokens() {
  accessToken = null;
  refreshTokenVal = null;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

async function tryRefresh() {
  if (!refreshTokenVal) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenVal }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch { return false; }
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = { ...(options.headers || {}) };

  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, { ...options, headers });

  // 401 → 尝试刷新 token
  if (res.status === 401 && refreshTokenVal) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = errBody;
    throw err;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return res.json();
  return res;
}

// 带进度的文件上传
export function uploadWithProgress(path, file, extraFields = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);

    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status}`));
      } catch { reject(new Error(`HTTP ${xhr.status}`)); }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));

    const formData = new FormData();
    formData.append('file', file);
    Object.entries(extraFields).forEach(([k, v]) => {
      if (v != null) formData.append(k, v);
    });

    xhr.send(formData);
  });
}
