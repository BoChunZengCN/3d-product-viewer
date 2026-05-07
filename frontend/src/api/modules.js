import { apiFetch, uploadWithProgress } from './client.js';

// ===== Models =====
export const models = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/models${qs ? '?' + qs : ''}`);
  },
  get: (id) => apiFetch(`/models/${id}`),
  upload: (file, folderId, onProgress) =>
    uploadWithProgress('/models/upload', file, { folderId }, onProgress),
  update: (id, data) => apiFetch(`/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  move: (id, folderId) => apiFetch(`/models/${id}/move`, { method: 'PUT', body: JSON.stringify({ folderId }) }),
  delete: (id) => apiFetch(`/models/${id}`, { method: 'DELETE' }),
  downloadUrl: (id, format) => `/api/models/${id}/download${format ? '?format=' + format : ''}`,
  thumbnailUrl: (id) => `/api/models/${id}/thumbnail`,
};

// ===== Folders =====
export const folders = {
  list: () => apiFetch('/folders'),
  create: (name, parentId) => apiFetch('/folders', { method: 'POST', body: JSON.stringify({ name, parentId }) }),
  rename: (id, name) => apiFetch(`/folders/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id) => apiFetch(`/folders/${id}`, { method: 'DELETE' }),
};

// ===== Share =====
export const share = {
  create: (modelId, options = {}) =>
    apiFetch('/share', { method: 'POST', body: JSON.stringify({ modelId, ...options }) }),
  list: () => apiFetch('/share'),
  access: (token, password) => {
    const qs = password ? `?password=${encodeURIComponent(password)}` : '';
    return apiFetch(`/share/${token}${qs}`);
  },
  downloadUrl: (token, password) =>
    `/api/share/${token}/download${password ? '?password=' + encodeURIComponent(password) : ''}`,
  delete: (id) => apiFetch(`/share/${id}`, { method: 'DELETE' }),
};

// ===== Convert =====
export const convert = {
  status: (jobId) => apiFetch(`/convert/${jobId}/status`),

  // 轮询转换状态，直到完成或失败
  pollStatus: (jobId, onProgress, interval = 1000) => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const job = await apiFetch(`/convert/${jobId}/status`);
          if (onProgress) onProgress(job.progress);
          if (job.status === 'completed') return resolve(job);
          if (job.status === 'failed') return reject(new Error(job.error || '转换失败'));
          setTimeout(poll, interval);
        } catch (err) { reject(err); }
      };
      poll();
    });
  },
};
