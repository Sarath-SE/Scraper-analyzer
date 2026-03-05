const db = require('../db');

// Enable auto-scraping for a sitemap
exports.enableAutoScrape = async (req, res) => {
  try {
    const { sitemap_uid } = req.body;

    const result = await db.query(
      `UPDATE sitemaps 
       SET auto_scrape_enabled = true
       WHERE sitemap_uid = $1
       RETURNING id, sitemap_uid, auto_scrape_enabled`,
      [sitemap_uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sitemap not found' });
    }

    res.json({
      message: 'Auto-scraping enabled',
      sitemap: result.rows[0]
    });
  } catch (error) {
    console.error('Error enabling auto-scrape:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Disable auto-scraping for a sitemap
exports.disableAutoScrape = async (req, res) => {
  try {
    const { sitemap_uid } = req.body;

    const result = await db.query(
      `UPDATE sitemaps 
       SET auto_scrape_enabled = false
       WHERE sitemap_uid = $1
       RETURNING id, sitemap_uid, auto_scrape_enabled`,
      [sitemap_uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sitemap not found' });
    }

    res.json({
      message: 'Auto-scraping disabled',
      sitemap: result.rows[0]
    });
  } catch (error) {
    console.error('Error disabling auto-scrape:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all sitemaps with auto-scrape status
exports.getAutoScrapeStatus = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.sitemap_uid,
        s.auto_scrape_enabled,
        s.created_at,
        MAX(snap.snapshot_date) as last_scraped
      FROM sitemaps s
      LEFT JOIN snapshots snap ON s.id = snap.sitemap_id
      GROUP BY s.id, s.sitemap_uid, s.auto_scrape_enabled, s.created_at
      ORDER BY s.created_at DESC
    `);

    res.json({
      sitemaps: result.rows
    });
  } catch (error) {
    console.error('Error fetching auto-scrape status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bulk enable auto-scraping for multiple sitemaps
exports.bulkEnableAutoScrape = async (req, res) => {
  try {
    const { sitemap_uids } = req.body;

    if (!Array.isArray(sitemap_uids) || sitemap_uids.length === 0) {
      return res.status(400).json({ error: 'sitemap_uids array is required' });
    }

    const result = await db.query(
      `UPDATE sitemaps 
       SET auto_scrape_enabled = true
       WHERE sitemap_uid = ANY($1)
       RETURNING sitemap_uid`,
      [sitemap_uids]
    );

    res.json({
      message: `Auto-scraping enabled for ${result.rows.length} sitemaps`,
      enabled_sitemaps: result.rows.map(row => row.sitemap_uid)
    });
  } catch (error) {
    console.error('Error bulk enabling auto-scrape:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};