import { loadStoredUser } from '../types/user';

/**
 * In development Vite proxies /api to FastAPI.
 * In production FastAPI serves the built frontend from the same origin,
 * so API_BASE can stay empty.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const demoUser = loadStoredUser();
  let ownerPassword: string | null = null;
  if (demoUser.role === 'owner') {
    try {
      ownerPassword = sessionStorage.getItem('smartorderhub.ownerPassword');
    } catch {
      // sessionStorage may be unavailable in embedded/private contexts.
    }
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Role': demoUser.role,
      'X-Demo-Actor': demoUser.name,
      ...(ownerPassword ? { 'X-Owner-Password': ownerPassword } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((item: { msg?: string }) => item?.msg)
          .filter(Boolean)
          .join('; ');
      }
    } catch {
      // keep the status-based message
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
