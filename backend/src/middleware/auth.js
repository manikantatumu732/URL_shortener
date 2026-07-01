const jwt = require('jsonwebtoken');

/**
 * Shared verification logic. Reads the accessToken cookie and verifies it.
 * Returns the decoded payload on success, or null on any failure/absence.
 * Never throws — callers decide how to react to a null result.
 */
function verifyCookie(req) {
  const token = req.cookies && req.cookies.accessToken;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Rejects with 401 if no valid cookie. Attaches req.user = { id } on success.
 */
function requireAuth(req, res, next) {
  const decoded = verifyCookie(req);

  if (!decoded) {
    // Same message whether the token is missing, malformed, or expired —
    // distinguishing these is an information leak.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = { id: decoded.userId };
  next();
}

/**
 * Same verification logic, but returns { id } or null instead of
 * throwing/rejecting. Used by routes like /api/shorten that want to know
 * the user *if* logged in, without requiring it.
 */
function getOptionalUser(req) {
  const decoded = verifyCookie(req);
  if (!decoded) return null;
  return { id: decoded.userId };
}

module.exports = { requireAuth, getOptionalUser };
