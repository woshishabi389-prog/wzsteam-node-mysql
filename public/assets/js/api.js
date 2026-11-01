/**
 * WZSteam 前端接口交互与会话管理模块
 * 所有页面均通过本模块的 fetch() 封装与 Node.js 服务器进行 JSON 数据交互
 */
window.WZApi = (function () {
  const TOKEN_KEY = 'wzsteam_auth_token';
  const USER_KEY = 'wzsteam_auth_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(user, token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getCachedUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function request(url, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      options.headers || {}
    );
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    const payload = await res.json().catch(() => ({
      code: res.status,
      message: '服务器响应格式异常',
      data: null
    }));

    if (res.status === 401 && !options.skipAuthRedirect) {
      clearSession();
      if (!location.pathname.endsWith('/login.html') && !location.pathname.endsWith('/register.html')) {
        location.href = '/login.html';
      }
    }

    if (!res.ok || (payload.code && payload.code !== 200)) {
      const err = new Error(payload.message || `请求失败 (${res.status})`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload.data;
  }

  async function ensureLoggedIn() {
    try {
      const data = await request('/api/auth/me', { method: 'GET' });
      if (data && data.user) {
        setSession(data.user, getToken());
        renderHeaderUser(data.user);
        return data.user;
      }
    } catch (_) {
      clearSession();
      location.href = '/login.html';
    }
    return null;
  }

  function renderHeaderUser(user) {
    const nameEl = document.getElementById('nav-user-name');
    const emailEl = document.getElementById('nav-user-email');
    if (nameEl) nameEl.textContent = user.username || '管理员';
    if (emailEl) emailEl.textContent = user.email || '';
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch (_) {
      // ignore
    }
    clearSession();
    location.href = '/login.html';
  }

  function showToast(message, type = 'success') {
    let container = document.getElementById('wz-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'wz-toast-container';
      container.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:360px;';
      document.body.appendChild(container);
    }

    const item = document.createElement('div');
    const isErr = type === 'error';
    item.style.cssText = `
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.12);
      border: 1px solid ${isErr ? '#fecaca' : '#bfdbfe'};
      background: ${isErr ? '#fef2f2' : '#eff6ff'};
      color: ${isErr ? '#b91c1c' : '#1d4ed8'};
      transition: all 0.2s ease;
    `;
    item.textContent = message;
    container.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(-6px)';
      setTimeout(() => item.remove(), 220);
    }, 2800);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    request,
    getToken,
    setSession,
    clearSession,
    getCachedUser,
    ensureLoggedIn,
    logout,
    showToast,
    escapeHtml
  };
})();
