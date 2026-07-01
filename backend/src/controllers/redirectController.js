const Link = require('../models/Link');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const redis = require('../utils/redis');
const { parseUserAgent, hashIp } = require('../utils/analytics');

/**
 * Fires analytics logging + click increment without blocking the redirect.
 * Called AFTER res.redirect() has already been invoked, and never awaited
 * by the caller. Any failure here is caught and logged — it must never
 * affect the redirect that already went out.
 */
async function logAnalyticsAsync(linkId, req) {
  try {
    const { browser, os, device } = parseUserAgent(req.headers['user-agent']);
    const ipHash = hashIp(req.ip || req.headers['x-forwarded-for']);

    await Promise.all([
      Link.updateOne({ _id: linkId }, { $inc: { clicks: 1 } }),
      AnalyticsEvent.create({
        linkId,
        country: null,
        city: null,
        browser,
        os,
        device,
        referrer: req.headers.referer || null,
        ipHash,
      }),
    ]);
  } catch (err) {
    console.error('[redirect] Analytics logging failed (non-fatal):', err.message);
  }
}

/**
 * GET /:shortCode
 * Cache-aside redirect. ALWAYS 302 (see CONTRACT.md — 301 would be cached
 * client-side by the visitor's browser forever, breaking link edits).
 */
async function redirectShortCode(req, res) {
  const { shortCode } = req.params;
  const cacheKey = `short:${shortCode}`;

  // --- Try Redis first. A Redis outage must NOT break redirects, so any
  // error here just falls through to the Mongo lookup below. ---
  let cached = null;
  try {
    cached = await redis.get(cacheKey);
  } catch (err) {
    console.error('[redirect] Redis get failed, falling back to Mongo:', err.message);
    cached = null;
  }

  if (cached) {
    // @upstash/redis auto-deserializes JSON values on get(), but we handle
    // the plain-string case too in case that behavior ever changes.
    let data;
    try {
      data = typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch (err) {
      // Corrupt cache value — treat as a miss rather than crashing.
      data = null;
    }

    if (data && data.originalUrl) {
      res.redirect(302, data.originalUrl);
      logAnalyticsAsync(data.linkId, req);
      return;
    }
  }

  // --- Cache miss (or corrupt cache entry): fall back to Mongo. ---
  let link;
  try {
    link = await Link.findOne({
      $or: [{ shortCode }, { customAlias: shortCode }],
    });
  } catch (err) {
    console.error('[redirect] Mongo lookup failed:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!link) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!link.active) {
    return res.status(403).json({ error: 'Link disabled' });
  }

  const linkId = link._id.toString();

  // Populate the cache for next time. A failure to write to Redis is
  // non-fatal — the redirect still succeeds, it'll just miss cache again
  // next time until Redis is healthy.
  try {
    await redis.set(
      cacheKey,
      JSON.stringify({ originalUrl: link.originalUrl, linkId }),
      { ex: 3600 }
    );
  } catch (err) {
    console.error('[redirect] Redis set failed (non-fatal):', err.message);
  }

  res.redirect(302, link.originalUrl);
  logAnalyticsAsync(linkId, req);
}

module.exports = { redirectShortCode };
