import * as authApi from '../../api/auth.js';
import { setState } from '../../store/index.js';
import { showToast } from '../Toast/index.js';

export function renderAuth(container) {
  let isLogin = true;

  function render() {
    container.innerHTML = `
      <div class="auth-overlay">
        <div class="auth-card">
          <h2>${isLogin ? '登录' : '注册'}</h2>
          <p class="subtitle">轻量化三维预览 · 数据可视化平台</p>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          ${!isLogin ? '<input class="auth-input" id="auth-name" placeholder="用户名" autocomplete="name">' : ''}
          <input class="auth-input" id="auth-email" type="email" placeholder="邮箱" autocomplete="email">
          <input class="auth-input" id="auth-password" type="password" placeholder="密码" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
          <button class="auth-submit" id="auth-submit">${isLogin ? '登 录' : '注 册'}</button>
          <div class="auth-switch">
            ${isLogin ? '没有账号？' : '已有账号？'}
            <a id="auth-toggle">${isLogin ? '立即注册' : '去登录'}</a>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#auth-toggle').addEventListener('click', () => {
      isLogin = !isLogin;
      render();
    });

    container.querySelector('#auth-submit').addEventListener('click', handleSubmit);
    container.querySelectorAll('.auth-input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(); });
    });
  }

  async function handleSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name')?.value.trim();
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');

    if (!email || !password) {
      errEl.textContent = '请填写邮箱和密码';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = '请稍候...';
    errEl.style.display = 'none';

    try {
      const user = isLogin
        ? await authApi.login(email, password)
        : await authApi.register(email, password, name);

      setState({ user, isAuthenticated: true });
      container.innerHTML = '';
      showToast(`欢迎, ${user.name || user.email}`, 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = isLogin ? '登 录' : '注 册';
    }
  }

  render();
}

export function renderUserBar(container, user) {
  container.innerHTML = `
    <div class="auth-user-bar">
      <span>👤 ${user.name || user.email}</span>
      <button id="logout-btn">退出</button>
    </div>
  `;
  container.querySelector('#logout-btn').addEventListener('click', () => {
    authApi.logout();
    setState({ user: null, isAuthenticated: false });
    location.reload();
  });
}
