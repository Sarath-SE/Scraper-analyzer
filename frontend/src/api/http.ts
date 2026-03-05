import { API_BASE_URL } from '../config/api';
import { getAuthToken } from '../auth/storage';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${API_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers
  });

  if (response.status === 401) {
    let message = 'Unauthorized';
    try {
      const data = await response.json();
      if (typeof data?.error === 'string') {
        message = data.error;
      }
    } catch {
      // Ignore parse issues and keep fallback message.
    }
    throw new UnauthorizedError(message);
  }

  return response;
}
