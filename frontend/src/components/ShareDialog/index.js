import { share } from '../../api/modules.js';
import { showToast } from '../Toast/index.js';

export function openShareDialog(model) {
  const existing = document.getElementById('share-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'share-overlay';
  overlay.className = 'share-overlay';
  overlay.innerHTML = `
    <div class="share-dialog">
      <h3>分享模型: ${model.name}</h3>
      <div class="share-options">
        <div class="share-option">
          <label>过期时间（可选）</label>
          <input class="auth-input" type="datetime-local" id="share-expires" style="margin-bottom:0">
        </div>
        <div class="share-option">
          <label>访问密码（可选）</label>
          <input class="auth-input" type="text" id="share-password" placeholder="留空则无需密码" style="margin-bottom:0">
        </div>
        <div class="share-option">
          <label>最大查看次数（可选）</label>
          <input class="auth-input" type="number" id="share-max-views" placeholder="留空则不限" min="1" style="margin-bottom:0">
        </div>
      </div>
      <div id="share-link-area" style="display:none">
        <div class="share-link-display">
          <input class="share-link-input" id="share-link-value" readonly>
          <button class="btn-primary" id="share-copy-btn">复制</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-primary" id="share-create-btn" style="flex:1">生成分享链接</button>
        <button class="btn-secondary" id="share-close-btn" style="flex:1">关闭</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#share-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#share-create-btn').addEventListener('click', async () => {
    const btn = overlay.querySelector('#share-create-btn');
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const options = {};
      const expires = overlay.querySelector('#share-expires').value;
      const password = overlay.querySelector('#share-password').value;
      const maxViews = overlay.querySelector('#share-max-views').value;
      if (expires) options.expiresAt = new Date(expires).toISOString();
      if (password) options.password = password;
      if (maxViews) options.maxViews = parseInt(maxViews);

      const result = await share.create(model.id, options);

      const linkArea = overlay.querySelector('#share-link-area');
      linkArea.style.display = 'block';
      overlay.querySelector('#share-link-value').value = result.url;
      btn.textContent = '已生成';
      showToast('分享链接已生成', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '生成分享链接';
    }
  });

  overlay.querySelector('#share-copy-btn')?.addEventListener('click', () => {
    const input = overlay.querySelector('#share-link-value');
    navigator.clipboard.writeText(input.value).then(() => showToast('已复制到剪贴板', 'success'));
  });
}
