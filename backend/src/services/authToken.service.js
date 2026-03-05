const crypto = require('crypto');

const DEFAULT_SESSION_HOURS = 12;

function getSessionTtlHours() {
  const value = Number(process.env.SESSION_TTL_HOURS);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SESSION_HOURS;
  }
  return value;
}

function generateSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSessionExpiry() {
  const ttlHours = getSessionTtlHours();
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

module.exports = {
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry
};
