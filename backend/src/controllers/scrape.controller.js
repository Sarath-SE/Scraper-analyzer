const db = require('../db');
const scraper = require('../services/scraper.service');

exports.triggerScrape = async (req, res) => {
  try {
    const { sitemap_uid } = req.body;
    const triggeredBy = req.user?.email || 'user';

    // 1️⃣ Ensure sitemap exists
    const sitemapRes = await db.query(
      `
      INSERT INTO sitemaps (sitemap_uid)
      VALUES ($1)
      ON CONFLICT (sitemap_uid)
      DO UPDATE SET sitemap_uid = EXCLUDED.sitemap_uid
      RETURNING id
      `,
      [sitemap_uid]
    );

    const sitemapId = sitemapRes.rows[0].id;

    // 2️⃣ 🔥 CHECK: already scraped today?
    const snapshotCheck = await db.query(
      `
      SELECT id
      FROM snapshots
      WHERE sitemap_id = $1
        AND snapshot_date = CURRENT_DATE
      LIMIT 1
      `,
      [sitemapId]
    );

    if (snapshotCheck.rows.length > 0) {
      // ✅ Already scraped today → SKIP scraper
      return res.status(200).json({
        status: 'skipped',
        reason: 'Already scraped today',
        snapshot_id: snapshotCheck.rows[0].id,
        source: 'database'
      });
    }

    // 3️⃣ Create scrape job record
    const jobRes = await db.query(
      `
      INSERT INTO scrape_jobs (sitemap_id, status, triggered_by)
      VALUES ($1, 'requested', $2)
      RETURNING id
      `,
      [sitemapId, triggeredBy]
    );

    const scrapeJobId = jobRes.rows[0].id;

    // 4️⃣ Trigger WebScraper
    const scraperJobId = await scraper.startScrape(sitemap_uid);

    // 5️⃣ Update scrape job
    await db.query(
      `
      UPDATE scrape_jobs
      SET scraper_job_id = $1,
          status = 'running'
      WHERE id = $2
      `,
      [scraperJobId, scrapeJobId]
    );

    res.json({
      status: 'running',
      scrape_job_id: scrapeJobId,
      scraper_job_id: scraperJobId
    });
  } catch (error) {
    console.error('Error triggering scrape:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, status, finished_at FROM scrape_jobs WHERE id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
