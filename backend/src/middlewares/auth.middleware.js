const db = require('../db');
const { hashSessionToken } = require('../services/authToken.service');

module.exports = async function authenticateRequest(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tokenHash = hashSessionToken(token);

    const result = await db.query(
      `
      SELECT
        s.id AS session_id,
        s.expires_at,
        u.id AS user_id,
        u.email,
        u.full_name,
        u.role
      FROM auth_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.is_active = TRUE
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const session = result.rows[0];

    req.user = {
      id: session.user_id,
      email: session.email,
      full_name: session.full_name,
      role: session.role
    };
    req.auth = {
      sessionId: session.session_id,
      tokenHash
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
