import { apiFetch } from './http';
import type { AuthUser } from '../auth/storage';

interface LoginResponse {
  token: string;
  expires_at: string;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await safeError(response, 'Login failed');
    throw new Error(error);
  }

  return response.json();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch('/auth/me');

  if (!response.ok) {
    const error = await safeError(response, 'Failed to fetch user');
    throw new Error(error);
  }

  const data = (await response.json()) as MeResponse;
  return data.user;
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/auth/logout', { method: 'POST' });

  if (!response.ok) {
    const error = await safeError(response, 'Logout failed');
    throw new Error(error);
  }
}

async function safeError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') {
      return data.error;
    }
  } catch {
    // Ignore parse issues and keep fallback.
  }
  return fallback;
}
