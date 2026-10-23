/**
 * In development Vite proxies /api to FastAPI.
 * In production FastAPI serves the built frontend from the same origin,
 * so API_BASE can stay empty.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // keep the status-based message
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
