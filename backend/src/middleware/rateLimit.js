const redis = require('../utils/redis');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Fixed-window rate limiter for POST /api/shorten only.
 * Key: `ratelimit:<ip>`. INCR then, on the first request in the window
 * (result === 1), set a 60s expiry so the window resets on its own.
 *
 * Redis being unreachable must never take down link creation — any error
 * here is logged and swallowed, and the request is allowed through.
 */
async function rateLimitShorten(req, res, next) {
  try {
    const key = `ratelimit:${req.ip}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    return next();
  } catch (err) {
    console.error('[rateLimit] Redis error, allowing request through:', err.message);
    return next();
  }
}

module.exports = { rateLimitShorten };
