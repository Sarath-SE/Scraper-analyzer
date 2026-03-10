const db = require('../db');
const scraper = require('../services/scraper.service');
const scrapeJobService = require('../services/scrapeJob.service');

exports.triggerScrape = async (req, res) => {
  try {
    const { sitemap_uid } = req.body;
    const triggeredBy = req.user?.email || 'user';
    let sitemapName = null;

    try {
      const metadata = await scraper.getSitemapMetadata(sitemap_uid);
      sitemapName = metadata.name;
    } catch (metadataError) {
      console.warn(
        `[Scrape Trigger] Failed to fetch sitemap metadata for ${sitemap_uid}:`,
        metadataError.message
      );
    }

    // 1️⃣ Ensure sitemap exists
    const sitemapRes = await db.query(
      `
      INSERT INTO sitemaps (sitemap_uid, name)
      VALUES ($1, $2)
      ON CONFLICT (sitemap_uid)
      DO UPDATE SET
        sitemap_uid = EXCLUDED.sitemap_uid,
        name = COALESCE(EXCLUDED.name, sitemaps.name)
      RETURNING id
      `,
      [sitemap_uid, sitemapName]
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
    const job = await scrapeJobService.syncScrapeJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      status: job.status,
      finished_at: job.finished_at,
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
