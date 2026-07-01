const UAParser = require('ua-parser-js');
const crypto = require('crypto');

/**
 * Parses a User-Agent string into { browser, os, device }.
 * device defaults to 'desktop' if the parser can't determine one (e.g. a
 * normal desktop browser UA has no device.type at all), not undefined —
 * per CONTRACT.md / Block C spec.
 * Never throws, even if uaString is missing/empty.
 */
function parseUserAgent(uaString) {
  const parser = new UAParser(uaString || '');
  const result = parser.getResult();

  return {
    browser: result.browser.name || null,
    os: result.os.name || null,
    device: result.device.type || 'desktop',
  };
}

/**
 * Hashes an IP address with SHA-256 so raw IPs are never stored.
 */
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex');
}

module.exports = { parseUserAgent, hashIp };
