const ACTOR_KEY = 'orderpilot.actor';
const DEFAULT_ACTOR = 'u-aina';

// The Replit deployment serves the API under /orderpilot-api; local development
// uses /api. A custom deployment can override this with
// window.__ORDERPILOT_API_MOUNT__ before the app loads.
const API_MOUNT = window.__ORDERPILOT_API_MOUNT__
  ?? (window.location.hostname.endsWith('.replit.app') ? '/orderpilot-api' : '');

function apiUrl(path) {
  return path.startsWith('/api') ? `${API_MOUNT}${path}` : path;
}

export function getActorId() {
  try {
    return localStorage.getItem(ACTOR_KEY) || DEFAULT_ACTOR;
  } catch {
    return DEFAULT_ACTOR;
  }
}

export function setActorId(id) {
  try {
    localStorage.setItem(ACTOR_KEY, id);
  } catch {
    /* localStorage can be unavailable in private mode; the demo still works. */
  }
}

async function request(path, { method = 'GET', body = null, timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'X-OrderPilot-User': getActorId() };
  if (body !== null) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      cache: 'no-store',
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw { status: 0, code: 'TIMEOUT', message: 'The request took too long. Please try again.' };
    }
    throw { status: 0, code: 'NETWORK', message: 'Could not reach the OrderPilot server.' };
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = data && typeof data === 'object' ? data.error : null;
    throw {
      status: response.status,
      code: error?.code || 'REQUEST_FAILED',
      message: error?.message || `Request failed (${response.status})`,
      details: error?.details || null,
    };
  }
  return data;
}

export const api = {
  getActorId,
  setActorId,

  bootstrap: () => request('/api/bootstrap'),
  stats: () => request('/api/stats'),
  health: () => request('/api/health'),

  orders: (status = 'pending') => request(`/api/orders?status=${encodeURIComponent(status)}`),
  order: (id) => request(`/api/orders/${encodeURIComponent(id)}`),
  approve: (id, note = null) =>
    request(`/api/orders/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: { note },
    }),
  reject: (id, reason) =>
    request(`/api/orders/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: { reason },
    }),
  requestInfo: (id, note = null) =>
    request(`/api/orders/${encodeURIComponent(id)}/request-info`, {
      method: 'POST',
      body: { note },
    }),
  updateOrder: (id, patch) =>
    request(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),

  messages: (status = 'all', limit = 200) =>
    request(`/api/messages?status=${encodeURIComponent(status)}&limit=${limit}`),
  importMessage: (payload) =>
    request('/api/messages/import', { method: 'POST', body: payload }),
  importAndAnalyze: (payload) =>
    request('/api/messages/import-and-analyze', { method: 'POST', body: payload, timeoutMs: 90_000 }),
  triage: (mode = 'auto') =>
    request('/api/triage/run', { method: 'POST', body: { mode }, timeoutMs: 120_000 }),
  triageMessage: (id, mode = 'auto') =>
    request(`/api/triage/messages/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: { mode },
      timeoutMs: 90_000,
    }),

  purchaseDrafts: () => request('/api/purchase-drafts'),
  receiveDraft: (id) =>
    request(`/api/purchase-drafts/${encodeURIComponent(id)}/receive`, { method: 'POST' }),

  activity: ({ limit = 200, type = null, orderId = null } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (type) params.set('type', type);
    if (orderId) params.set('orderId', orderId);
    return request(`/api/activity?${params.toString()}`);
  },

  catalog: () => request('/api/catalog'),
  aiStatus: () => request('/api/ai/status'),
  testAI: () => request('/api/ai/test', { method: 'POST', timeoutMs: 45_000 }),
  resetDemo: (confirm = 'RESET') =>
    request('/api/demo/reset', { method: 'POST', body: { confirm }, timeoutMs: 60_000 }),

  exportUrl(type, format, status = 'all') {
    const actor = encodeURIComponent(getActorId());
    if (type === 'activity') {
      return `/api/activity/export?format=${encodeURIComponent(format)}&as=${actor}`;
    }
    return `/api/orders/export?format=${encodeURIComponent(format)}&status=${encodeURIComponent(status)}&as=${actor}`;
  },
};
