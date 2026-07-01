# Architecture & API Reference

This document describes the system design, data model, and API contract
for the URL shortener.

---

## Stack
- **Backend:** Node.js + Express + Mongoose
- **Database:** MongoDB Atlas
- **Cache / rate limiting:** Upstash Redis (`@upstash/redis` REST client)
- **Frontend:** React + Vite + TypeScript + Tailwind + TanStack Query + React Hook Form + Zod
- **Auth:** JWT stored in an httpOnly cookie

## Environment variables
```
MONGO_URI=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=
PORT=5000
BASE_URL=            # e.g. http://localhost:5000 locally; used to build shortUrl
```

## Repo structure
```
url-shortener/
├── backend/     # Express app, port 5000
├── frontend/    # Vite app, points to http://localhost:5000
└── ARCHITECTURE.md
```

---

## Data model (Mongoose schemas)

```js
// models/User.js
{
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  name: String,
  createdAt: { type: Date, default: Date.now }
}

// models/Link.js
{
  shortCode: { type: String, required: true, unique: true, index: true },
  originalUrl: { type: String, required: true },
  customAlias: { type: String, unique: true, sparse: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // optional, null if anonymous
  clicks: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

// models/AnalyticsEvent.js
{
  linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  country: String,
  city: String,
  browser: String,
  os: String,
  device: String,
  referrer: String,
  ipHash: String
}
```

---

## API reference

All responses are JSON. All errors: `{ "error": "message" }` with the status code shown.

### `POST /api/auth/register`
- Auth: none
- Body: `{ email: string, password: string, name?: string }`
- 201: `{ user: { id, email, name } }` + sets `accessToken` cookie
- 409 if email already exists

### `POST /api/auth/login`
- Auth: none
- Body: `{ email: string, password: string }`
- 200: `{ user: { id, email, name } }` + sets `accessToken` cookie
- 401 on bad credentials (generic message — doesn't reveal whether the email exists or the password was wrong)

### `POST /api/auth/logout`
- Auth: required
- 200: `{ success: true }`, clears cookie

### `GET /api/auth/me`
- Auth: required
- 200: `{ user: { id, email, name } }`
- 401 if no/invalid cookie

### `POST /api/shorten`
- Auth: optional (if logged in, the link gets `userId` set)
- Rate limit: 10 requests/minute/IP → 429 `{ error: "Too many requests" }`
- Body: `{ url: string, customAlias?: string }`
- 201: `{ shortCode, shortUrl, originalUrl, customAlias }`
- `shortCode` is always auto-generated, even when `customAlias` is provided — it's a permanent internal identifier, while `customAlias` is a separate, editable, human-facing label. `shortUrl` in responses uses `customAlias` when present, falling back to `shortCode` otherwise.
- 409 if `customAlias` is already taken (checked against both `customAlias` and `shortCode` on any existing link — a custom alias can't collide with someone else's auto-generated code either)
- 400 if `url` is invalid (must be http/https)

### `GET /api/links`
- Auth: required
- 200: `{ links: [{ id, shortCode, originalUrl, customAlias, clicks, active, createdAt, expiresAt }] }`
- Only returns links belonging to the authenticated user

### `GET /api/links/:id/analytics`
- Auth: required (and must own the link)
- 200: `{ link: {...}, analytics: [{ timestamp, country, city, browser, os, device, referrer }] }`
- 403 if link belongs to a different user
- 404 if link doesn't exist

### `PUT /api/links/:id`
- Auth: required (and must own the link)
- Body: `{ originalUrl?, active?, customAlias? }` (all optional, partial update)
- 200: `{ link: {...} }`
- 400 if `originalUrl` is provided and fails the same http(s) URL validation used in `/api/shorten` — a malformed URL should never reach the redirect logic
- 409 if `customAlias` is provided, changed, and already taken (same check as create)
- 403 if the link has no owner (`userId` is null/unset) — an anonymous link can't be edited via the authenticated routes, including by its original creator. There's no "claim a link" mechanism, so there's no legitimate owner to authorize the edit against.
- On update: invalidates the Redis cache key for the old short code, and for the new custom alias if changed

### `DELETE /api/links/:id`
- Auth: required (and must own the link)
- 200: `{ success: true }`
- 403 if the link has no owner — same rule as PUT
- Invalidates the Redis cache key on delete

### `GET /:shortCode`
- Auth: none
- **Redirect status: always 302**, both on cache hit and cache miss. Never 301 — a 301 gets cached client-side in the visitor's browser permanently, so if a link's destination is later edited, browsers that already visited would keep redirecting to the old URL forever regardless of server-side changes. 302 keeps redirect behavior fully governed by the server-side cache.
- Matches on either `shortCode` or `customAlias` — a link is reachable by both when both exist.
- Cache-aside strategy: check Redis key `short:<shortCode>` first.
  - Hit: redirect immediately (302); log analytics and increment clicks asynchronously without blocking the redirect.
  - Miss: query Mongo by `shortCode` or `customAlias`, populate Redis with a 3600s TTL, then redirect (302).
- 404 `{ error: "Not found" }` if the code doesn't exist
- 403 `{ error: "Link disabled" }` if `active: false`
- Redis cache value: `{ originalUrl, linkId }` (JSON string)

---

## Frontend API client

`frontend/src/api/client.ts` exports one typed function per endpoint above, e.g.:

```ts
shortenUrl(url: string, customAlias?: string): Promise<{ shortCode, shortUrl, originalUrl, customAlias: string | null }>
login(email: string, password: string): Promise<{ user: User }>
getMyLinks(): Promise<{ links: Link[] }>
// ... etc, matching the table above exactly
```

All calls use `fetch(..., { credentials: 'include' })` so the auth cookie is sent automatically. Local dev base URL: `http://localhost:5000`.

---

## Security & correctness decisions worth knowing

1. **Passwords** are bcrypt-hashed only, never logged or returned in any response.
2. **IPs** are hashed with SHA-256 before storage — raw IPs are never persisted.
3. Every mutating route on `/api/links/*` (except `/api/shorten`) checks `link.userId && link.userId.equals(req.user.id)` before allowing edit/delete. This correctly returns 403 both for "belongs to someone else" and "belongs to no one" (anonymous link).
4. **Cookie config differs between local dev and production:**
   - Local dev (frontend and backend on `localhost`, different ports):
     `{ httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*60*60*1000 }`
   - Production (frontend and backend on different domains, e.g. Vercel + Railway):
     `{ httpOnly: true, sameSite: 'none', secure: true, maxAge: 7*24*60*60*1000 }`
     With `sameSite: 'lax'` in production, the cookie silently stops being sent on cross-site requests — every authenticated call looks like an unexplained 401. `secure: true` is required whenever `sameSite: 'none'` is used, since browsers reject the cookie otherwise. This is gated on `process.env.NODE_ENV === 'production'` rather than hardcoded.
5. **Auth decoding has a single implementation**, exposed as two functions from `middleware/auth.js`:
   - `requireAuth(req, res, next)` — rejects with 401 if there's no valid cookie.
   - `getOptionalUser(req)` — same JWT verification, but returns `{ id: decoded.userId }` or `null` instead of throwing. Used by `/api/shorten`, which needs to know the user *if* they're logged in without requiring it.
   Keeping this to one implementation avoids the class of bugs where two slightly different auth-decoding code paths drift apart.
