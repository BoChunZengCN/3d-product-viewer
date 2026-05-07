const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-icon" style="
    width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;
    background:${type === 'success' ? 'var(--glow-green)' : type === 'error' ? 'rgba(248,81,73,.15)' : 'var(--glow-cyan)'};
    color:${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-cyan)'};
  ">${ICONS[type] || 'ℹ'}</div><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
