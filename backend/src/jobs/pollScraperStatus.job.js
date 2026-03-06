const cron = require('node-cron');
const db = require('../db');
const scraper = require('../services/scraper.service');
const ingestion = require('../services/ingestion.service');

// Poll every minute for active scrape jobs
cron.schedule('* * * * *', async () => {
  console.log('[PollJob] Checking running scrape jobs...');

  let jobs;
  try {
    jobs = await db.query(
      `SELECT * FROM scrape_jobs WHERE status='running' OR status='ingesting'`
    );
  } catch (err) {
    console.error('[PollJob] Failed to fetch jobs:', err.message);
    return;
  }

  for (const job of jobs.rows) {
    try {
      // Skip if already ingesting (being processed)
      if (job.status === 'ingesting') {
        console.log(`[PollJob] Job ${job.id} is currently ingesting, skipping...`);
        continue;
      }

      const status = await scraper.getJobStatus(job.scraper_job_id);
      console.log(
        `[PollJob] Job ${job.id} (scraper ${job.scraper_job_id}) status: ${status}`
      );

      // ✅ FINISHED → LOCK → INGEST
      if (status === 'finished') {
        // 🔒 Lock the job (prevents double ingestion)
        const lockRes = await db.query(
          `UPDATE scrape_jobs
           SET status='ingesting'
           WHERE id=$1 AND status='running'
           RETURNING id`,
          [job.id]
        );

        // If another poll already locked it, skip
        if (lockRes.rowCount === 0) {
          continue;
        }

        console.log(`[PollJob] Ingesting job ${job.id}`);
        await ingestion.ingestScrapeJob(job);
        continue;
      }

      // ❌ FAILED / STOPPED
      if (status === 'failed' || status === 'stopped') {
        await db.query(
          `UPDATE scrape_jobs
           SET status='failed', finished_at=NOW()
           WHERE id=$1`,
          [job.id]
        );

        console.warn(`[PollJob] Job ${job.id} marked as failed`);
      }

    } catch (err) {
      console.error(
        `[PollJob] Error processing job ${job.id}:`,
        err.message
      );

      // Optional: mark as failed after repeated errors
    }
  }
});
