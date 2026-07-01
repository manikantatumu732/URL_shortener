const Link = require('../models/Link');
const { generateShortCode, isValidUrl } = require('../utils/shortCode');
const { getOptionalUser } = require('../middleware/auth');
const redis = require('../utils/redis'); // cache invalidation helper

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const MAX_SHORTCODE_ATTEMPTS = 3;

/**
 * POST /api/shorten
 * Auth optional. Public route — must work with or without a session cookie.
 */
async function shortenLink(req, res) {
  try {
    const { url, customAlias } = req.body;

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Alias must be free against BOTH shortCode and customAlias fields.
    if (customAlias) {
      const existing = await Link.findOne({
        $or: [{ customAlias }, { shortCode: customAlias }],
      });
      if (existing) {
        return res.status(409).json({ error: 'Alias already taken' });
      }
    }

    // Never write custom JWT-decoding logic here — reuse the shared
    // shared implementation so there's exactly one auth-decoding path.
    const user = getOptionalUser(req);

    // A generated shortCode is always created, even when customAlias is
    // supplied — per project decision, the link is reachable via either
    // value. shortCode collisions are rare but possible; retry a few times.
    let link;
    for (let attempt = 0; attempt < MAX_SHORTCODE_ATTEMPTS; attempt++) {
      try {
        link = await Link.create({
          shortCode: generateShortCode(),
          originalUrl: url,
          customAlias: customAlias || undefined,
          userId: user ? user.id : undefined,
        });
        break;
      } catch (err) {
        if (err && err.code === 11000) {
          // Duplicate-key error — figure out which unique field collided.
          if (err.keyPattern && err.keyPattern.customAlias) {
            // A race: someone else grabbed this alias between our check
            // above and this insert. Correct response is 409, not a retry.
            return res.status(409).json({ error: 'Alias already taken' });
          }
          // Otherwise it was the random shortCode — roll again.
          continue;
        }
        throw err;
      }
    }

    if (!link) {
      return res.status(500).json({ error: 'Could not generate a unique short code' });
    }

    // If the user set a custom alias, that's the value they want to share.
    const publicCode = link.customAlias || link.shortCode;

    return res.status(201).json({
      shortCode: link.shortCode,
      shortUrl: `${BASE_URL}/${publicCode}`,
      originalUrl: link.originalUrl,
      customAlias: link.customAlias || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * GET /api/links
 * Auth required. Returns only the authenticated user's own links.
 */
async function getLinks(req, res) {
  try {
    const links = await Link.find({ userId: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      links: links.map((link) => ({
        id: link._id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        customAlias: link.customAlias,
        clicks: link.clicks,
        active: link.active,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * PUT /api/links/:id
 * Auth required, and caller must own the link.
 */
async function updateLink(req, res) {
  try {
    const { id } = req.params;
    const link = await Link.findById(id);

    if (!link) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 403, not 404, once we know the resource exists — 404 here would let
    // an authenticated user probe which link IDs exist.
    if (!link.userId || !link.userId.equals(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { originalUrl, active, customAlias } = req.body;

    // Capture pre-update state so cache invalidation below knows what
    // actually changed and what the OLD customAlias was (its Redis key
    // still points at the stale originalUrl/active until we clear it).
    const oldCustomAlias = link.customAlias;
    let changed = false;

    if (customAlias !== undefined && customAlias !== link.customAlias) {
      const existing = await Link.findOne({
        _id: { $ne: link._id },
        $or: [{ customAlias }, { shortCode: customAlias }],
      });
      if (existing) {
        return res.status(409).json({ error: 'Alias already taken' });
      }
      link.customAlias = customAlias;
      changed = true;
    }

    if (originalUrl !== undefined) {
      if (!isValidUrl(originalUrl)) {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      link.originalUrl = originalUrl;
      changed = true;
    }

    if (active !== undefined) {
      link.active = active;
      changed = true;
    }

    link.updatedAt = new Date();
    await link.save();

    // Invalidate the Redis cache so a stale entry (old
    // originalUrl or a since-disabled link) doesn't keep serving from
    // cache after this edit. A visitor could have reached this link via
    // either its shortCode or its (old) customAlias, so both cache keys
    // need clearing — the new customAlias, if any, doesn't have a cache
    // entry yet since nobody could have visited it before this update.
    if (changed) {
      try {
        const keysToDelete = [`short:${link.shortCode}`];
        if (oldCustomAlias) {
          keysToDelete.push(`short:${oldCustomAlias}`);
        }
        await Promise.all(keysToDelete.map((key) => redis.del(key)));
      } catch (err) {
        // A failed cache invalidation must never fail the edit itself —
        // the DB write already succeeded. Log and move on; the stale
        // entry will still expire via its 3600s TTL.
        console.error('[linkController] Redis invalidation error (update):', err.message);
      }
    }

    return res.status(200).json({
      link: {
        id: link._id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        customAlias: link.customAlias,
        userId: link.userId,
        clicks: link.clicks,
        active: link.active,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * DELETE /api/links/:id
 * Auth required, and caller must own the link.
 */
async function deleteLink(req, res) {
  try {
    const { id } = req.params;
    const link = await Link.findById(id);

    if (!link) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!link.userId || !link.userId.equals(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Link.deleteOne({ _id: link._id });

    // Clear both possible cache entries so a deleted link
    // can't keep resolving to its old destination from a stale cache hit.
    try {
      const keysToDelete = [`short:${link.shortCode}`];
      if (link.customAlias) {
        keysToDelete.push(`short:${link.customAlias}`);
      }
      await Promise.all(keysToDelete.map((key) => redis.del(key)));
    } catch (err) {
      console.error('[linkController] Redis invalidation error (delete):', err.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { shortenLink, getLinks, updateLink, deleteLink };
