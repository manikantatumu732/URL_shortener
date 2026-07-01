const { nanoid } = require('nanoid');
// NOTE: nanoid v4+ ships as ESM-only. If this backend is CommonJS (no
// "type": "module" in package.json) and `require('nanoid')` blows up,
// pin `nanoid@^3` in package.json instead — that major is CJS-compatible.

/**
 * Generate a random short code for a Link.
 * @param {number} length
 * @returns {string}
 */
function generateShortCode(length = 7) {
  return nanoid(length);
}

/**
 * Validate that a string is a well-formed http(s) URL.
 * @param {string} str
 * @returns {boolean}
 */
function isValidUrl(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { generateShortCode, isValidUrl };
