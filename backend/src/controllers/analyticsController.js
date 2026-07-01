const Link = require('../models/Link');
const AnalyticsEvent = require('../models/AnalyticsEvent');

/**
 * GET /api/links/:id/analytics
 * Auth required, and caller must own the link.
 *
 * Reuses the existing AnalyticsEvent model (see CONTRACT.md /
 * models/AnalyticsEvent.js) — no new model is introduced, per instruction.
 */
async function getLinkAnalytics(req, res) {
  try {
    const { id } = req.params;
    const link = await Link.findById(id);

    if (!link) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Same ownership check already used in linkController.js's
    // updateLink/deleteLink: 403 both when the link belongs to a
    // different user AND when it has no owner at all (anonymous link).
    // CONTRACT.md's Resolved Ambiguities Log entry 2 establishes that an
    // anonymous link has no legitimate owner to authorize edits against;
    // the same reasoning applies here — nobody is authorized to view
    // analytics for a link they don't own, and an anonymous link is
    // owned by no one. CONTRACT.md's own text for this endpoint only
    // says "403 if link belongs to a different user," so this extends
    // that slightly for the anonymous case by analogy with PUT/DELETE
    // rather than from an explicit rule for this endpoint. Flagging this
    // assumption — happy to change if a different behavior is intended.
    if (!link.userId || !link.userId.equals(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const events = await AnalyticsEvent.find({ linkId: link._id }).sort({ timestamp: -1 });

    return res.status(200).json({
      link: {
        id: link._id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        customAlias: link.customAlias,
        clicks: link.clicks,
        active: link.active,
      },
      analytics: events.map((event) => ({
        timestamp: event.timestamp,
        country: event.country,
        city: event.city,
        browser: event.browser,
        os: event.os,
        device: event.device,
        referrer: event.referrer,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { getLinkAnalytics };
