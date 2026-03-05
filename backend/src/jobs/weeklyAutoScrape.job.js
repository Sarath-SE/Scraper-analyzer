const cron = require('node-cron');
const db = require('../db');
const scraper = require('../services/scraper.service');

// Run every Sunday at 2 AM (weekly)
cron.schedule('0 2 * * 0', async () => {
  console.log('[WeeklyAutoScrape] Starting weekly auto-scraping...');

  try {
    // Get all sitemaps that need weekly scraping
    const sitemapsToScrape = await db.query(`
      SELECT s.id, s.sitemap_uid
      FROM sitemaps s
      WHERE s.auto_scrape_enabled = true
        AND (
          -- Never scraped before
          NOT EXISTS (
            SELECT 1 FROM snapshots snap 
            WHERE snap.sitemap_id = s.id
          )
          OR
          -- Last scraped more than 7 days ago
          NOT EXISTS (
            SELECT 1 FROM snapshots snap 
            WHERE snap.sitemap_id = s.id 
              AND snap.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
          )
        )
    `);

    console.log(`[WeeklyAutoScrape] Found ${sitemapsToScrape.rows.length} sitemaps to scrape`);

    for (const sitemap of sitemapsToScrape.rows) {
      try {
        console.log(`[WeeklyAutoScrape] Starting scrape for sitemap: ${sitemap.sitemap_uid}`);

        // Create scrape job record
        const jobRes = await db.query(
          `INSERT INTO scrape_jobs (sitemap_id, status, triggered_by)
           VALUES ($1, 'requested', 'auto_weekly')
           RETURNING id`,
          [sitemap.id]
        );

        const scrapeJobId = jobRes.rows[0].id;

        // Trigger WebScraper
        const scraperJobId = await scraper.startScrape(sitemap.sitemap_uid);

        // Update scrape job with scraper job ID
        await db.query(
          `UPDATE scrape_jobs
           SET scraper_job_id = $1, status = 'running'
           WHERE id = $2`,
          [scraperJobId, scrapeJobId]
        );

        console.log(`[WeeklyAutoScrape] Scrape job ${scrapeJobId} started for sitemap ${sitemap.sitemap_uid}`);

        // Add small delay between scrapes to avoid overwhelming the scraper service
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

      } catch (error) {
        console.error(`[WeeklyAutoScrape] Failed to start scrape for sitemap ${sitemap.sitemap_uid}:`, error.message);
        
        // Mark as failed if job was created
        await db.query(
          `UPDATE scrape_jobs 
           SET status = 'failed', error_message = $1
           WHERE sitemap_id = $2 AND status = 'requested'`,
          [error.message, sitemap.id]
        );
      }
    }

    console.log('[WeeklyAutoScrape] Weekly auto-scraping completed');

  } catch (error) {
    console.error('[WeeklyAutoScrape] Error in weekly auto-scraping:', error.message);
  }
});

console.log('[WeeklyAutoScrape] Weekly auto-scraping job scheduled (Sundays at 2 AM)');