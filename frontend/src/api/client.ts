import type {
  AuthResponse,
  MeResponse,
  LogoutResponse,
  ShortenResponse,
  GetLinksResponse,
  UpdateLinkResponse,
  DeleteLinkResponse,
  LinkAnalyticsResponse,
  RegisterRequest,
  LoginRequest,
  ShortenRequest,
  UpdateLinkRequest,
  ApiErrorBody,
} from '../types';

// Local dev backend, per CONTRACT.md ("Base URL: http://localhost:5000
// for local dev"). Read from an env var if present so a production build
// can point elsewhere without code changes.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Thrown on any non-2xx response. Carries the HTTP status alongside the
 * backend's error message so callers (e.g. useAuth's "don't retry on
 * 401" rule) can branch on status without re-parsing the message string.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Shared request helper. Every call:
 * - sends credentials: 'include' so the httpOnly auth cookie is attached
 * - throws new Error(body.error) on any non-2xx response
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  // Some error responses (e.g. a proxy 502, or a non-JSON 500 page) may
  // not be valid JSON. Fall back to a generic message rather than
  // letting JSON.parse throw a confusing secondary error.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in (body as ApiErrorBody)
        ? (body as ApiErrorBody).error
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

// ---- Auth ----

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logout(): Promise<LogoutResponse> {
  return request<LogoutResponse>('/api/auth/logout', {
    method: 'POST',
  });
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/api/auth/me', {
    method: 'GET',
  });
}

// ---- Links ----
// (Full implementations live here so other pages can
// import them directly; the dashboard/link-table UI that CALLS these is
// out of scope for this block.)

export function shortenUrl(payload: ShortenRequest): Promise<ShortenResponse> {
  return request<ShortenResponse>('/api/shorten', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyLinks(): Promise<GetLinksResponse> {
  return request<GetLinksResponse>('/api/links', {
    method: 'GET',
  });
}

export function getLinkAnalytics(id: string): Promise<LinkAnalyticsResponse> {
  return request<LinkAnalyticsResponse>(`/api/links/${id}/analytics`, {
    method: 'GET',
  });
}

export function updateLink(id: string, payload: UpdateLinkRequest): Promise<UpdateLinkResponse> {
  return request<UpdateLinkResponse>(`/api/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteLink(id: string): Promise<DeleteLinkResponse> {
  return request<DeleteLinkResponse>(`/api/links/${id}`, {
    method: 'DELETE',
  });
}

// NOTE on GET /:shortCode: CONTRACT.md defines this as a server-side 302
// redirect, not a JSON endpoint — the browser is meant to navigate to it
// directly (e.g. `window.location.href = shortUrl`), not fetch() it as
// data. There is intentionally no wrapper function for it here; the
// shortUrl string returned by shortenUrl() above is what should be used
// as a plain link/navigation target wherever E2's UI needs it.
