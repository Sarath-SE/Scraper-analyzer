const cron = require('node-cron');
const db = require('../db');
const scrapeJobService = require('../services/scrapeJob.service');

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
      const syncedJob = await scrapeJobService.syncScrapeJob(job);
      console.log(
        `[PollJob] Job ${job.id} synced to local status: ${syncedJob?.status ?? 'missing'}`
      );
    } catch (err) {
      console.error(
        `[PollJob] Error processing job ${job.id}:`,
        err.message
      );
    }
  }
});
