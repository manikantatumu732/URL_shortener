const express = require('express');
const { redirectShortCode } = require('../controllers/redirectController');

const router = express.Router();

// GET /:shortCode — must be mounted at the app root (not under /api),
// per CONTRACT.md's `GET /:shortCode` spec.
router.get('/:shortCode', redirectShortCode);

module.exports = router;
