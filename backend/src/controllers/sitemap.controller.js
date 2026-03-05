const db = require('../db');

exports.listSitemaps = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        s.sitemap_uid,
        s.name,
        MAX(sn.snapshot_date) AS last_snapshot_date,
        COUNT(sn.id)::int AS snapshot_count
      FROM sitemaps s
      LEFT JOIN snapshots sn ON sn.sitemap_id = s.id
      GROUP BY s.id, s.sitemap_uid, s.name, s.created_at
      ORDER BY MAX(sn.snapshot_date) DESC NULLS LAST, s.created_at DESC
    `);

    res.json({ sitemaps: result.rows });
  } catch (error) {
    console.error('Error fetching sitemaps:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
