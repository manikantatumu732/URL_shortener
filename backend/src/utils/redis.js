const { Redis } = require('@upstash/redis');

// REST-based client (not ioredis / TCP) per CONTRACT.md.
// Upstash's SDK reads these automatically if named exactly this way, but we
// pass them explicitly so a missing env var fails loudly at startup instead
// of silently at first request.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = redis;
