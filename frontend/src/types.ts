// Shared types, mirroring CONTRACT.md exactly. Do not rename fields here
// without updating CONTRACT.md and the backend to match.

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Link {
  id: string;
  shortCode: string;
  originalUrl: string;
  customAlias: string | null;
  clicks: number;
  active: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

export interface AnalyticsEventSummary {
  timestamp: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
  referrer?: string;
}

// ---- Request bodies ----

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ShortenRequest {
  url: string;
  customAlias?: string;
}

export interface UpdateLinkRequest {
  originalUrl?: string;
  active?: boolean;
  customAlias?: string;
}

// ---- Response bodies ----

export interface AuthResponse {
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface LogoutResponse {
  success: true;
}

export interface ShortenResponse {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  customAlias: string | null;
}

export interface GetLinksResponse {
  links: Link[];
}

export interface UpdateLinkResponse {
  link: Link;
}

export interface DeleteLinkResponse {
  success: true;
}

export interface LinkAnalyticsResponse {
  link: Link;
  analytics: AnalyticsEventSummary[];
}

export interface ApiErrorBody {
  error: string;
}
