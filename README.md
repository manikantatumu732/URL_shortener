# URL Shortener

Full-stack URL shortener with authentication, click analytics, Redis
caching, and QR code generation.

## Features
- User registration/login with JWT stored in an httpOnly cookie
- Create short links (anonymously or while logged in), with optional
  custom aliases
- Redis cache-aside layer in front of MongoDB for fast redirects, with
  cache invalidation on edit/delete
- Rate limiting on link creation (10 requests/minute/IP)
- Per-link click analytics: timestamp, country, city, browser, OS,
  device, referrer
- QR code generation for any shortened link
- Ownership checks on every mutating endpoint — links can only be
  edited/deleted by the user who created them

## Stack
- **Backend:** Node.js, Express, Mongoose, MongoDB Atlas, Upstash Redis, JWT
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query,
  React Hook Form, Zod

## Getting started

```bash
# backend
cd backend
cp .env.example .env   # fill in MONGO_URI, UPSTASH_*, JWT_SECRET
npm install
npm run dev

# frontend
cd frontend
npm install
npm run dev
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full data model, API
reference, and the reasoning behind key design decisions (redirect
status codes, cookie config for local vs. production, cache
invalidation strategy, etc.).
