const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimitShorten } = require('../middleware/rateLimit'); // rate limiting middleware
const {
  shortenLink,
  getLinks,
  updateLink,
  deleteLink,
} = require('../controllers/linkController');
const { getLinkAnalytics } = require('../controllers/analyticsController'); // analytics controller

const router = express.Router();

// Public — auth optional (getOptionalUser is called inside the controller).
// rateLimitShorten applies ONLY here, not to the redirect
// route — visitors clicking a shared short link must never be rate limited.
router.post('/shorten', rateLimitShorten, shortenLink);

// Auth required for everything below
router.get('/links', requireAuth, getLinks);
router.get('/links/:id/analytics', requireAuth, getLinkAnalytics);
router.put('/links/:id', requireAuth, updateLink);
router.delete('/links/:id', requireAuth, deleteLink);

module.exports = router;
