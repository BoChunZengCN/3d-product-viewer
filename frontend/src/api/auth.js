import { apiFetch, setTokens, clearTokens } from './client.js';

export async function register(email, password, name) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data.user;
}

export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data.user;
}

export async function getProfile() {
  return apiFetch('/auth/me');
}

export function logout() {
  clearTokens();
}
