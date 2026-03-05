const db = require('../db');
const {
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry
} = require('../services/authToken.service');

exports.login = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await db.query(
      `
      SELECT id, email, full_name, role
      FROM app_users
      WHERE lower(email) = lower($1)
        AND is_active = TRUE
        AND password_digest = crypt($2, password_digest)
      LIMIT 1
      `,
      [email, password]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();

    await db.query(
      `
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );

    res.json({
      token: sessionToken,
      expires_at: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.logout = async (req, res) => {
  try {
    await db.query(
      `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE id = $1
      `,
      [req.auth.sessionId]
    );

    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
