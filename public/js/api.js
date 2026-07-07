// Helper de acesso as Supabase Edge Functions, usado pelo painel admin.
// Cada "recurso" (clients, charges, admin-login...) e uma Edge Function
// separada - por isso a base da URL vem de window.SMART_BILLING_CONFIG
// (ver public/js/config.js), em vez de um backend Express proprio.
const TOKEN_KEY = 'smartbilling_token';

function functionsBaseUrl() {
  const url = window.SMART_BILLING_CONFIG && window.SMART_BILLING_CONFIG.SUPABASE_FUNCTIONS_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_FUNCTIONS_URL nao configurado. Edite public/js/config.js.'
    );
  }
  return url.replace(/\/$/, '');
}

const Api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isAuthenticated() {
    return Boolean(this.getToken());
  },
  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = this.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${functionsBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && auth) {
      this.clearToken();
      window.location.href = 'login.html';
      return Promise.reject(new Error('Sessao expirada.'));
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Ocorreu um erro inesperado.');
    }

    return data;
  },
  get(path) {
    return this.request(path, { method: 'GET' });
  },
  post(path, body, opts = {}) {
    return this.request(path, { method: 'POST', body, ...opts });
  },
  put(path, body) {
    return this.request(path, { method: 'PUT', body });
  },
  delete(path) {
    return this.request(path, { method: 'DELETE' });
  },
};

function requireAdminAuth() {
  if (!Api.isAuthenticated()) {
    window.location.href = 'login.html';
  }
}

function formatCurrencyBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(isoDate) {
  if (!isoDate) return '-';
  const datePart = String(isoDate).substring(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}
