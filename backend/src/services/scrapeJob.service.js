const db = require('../db');
const scraper = require('./scraper.service');
const ingestion = require('./ingestion.service');

async function getJobById(jobId) {
  const result = await db.query(
    `SELECT * FROM scrape_jobs WHERE id = $1`,
    [jobId]
  );

  return result.rows[0] ?? null;
}

async function syncScrapeJob(jobOrId) {
  const job = typeof jobOrId === 'object' && jobOrId !== null
    ? jobOrId
    : await getJobById(jobOrId);

  if (!job) {
    return null;
  }

  if (job.status === 'finished' || job.status === 'failed' || job.status === 'ingesting') {
    return getJobById(job.id);
  }

  if (!job.scraper_job_id) {
    return getJobById(job.id);
  }

  const scraperStatus = await scraper.getJobStatus(job.scraper_job_id);

  if (scraperStatus === 'finished') {
    const lockRes = await db.query(
      `UPDATE scrape_jobs
       SET status = 'ingesting'
       WHERE id = $1 AND status = 'running'
       RETURNING *`,
      [job.id]
    );

    if (lockRes.rowCount > 0) {
      await ingestion.ingestScrapeJob(lockRes.rows[0]);
    }

    return getJobById(job.id);
  }

  if (scraperStatus === 'failed' || scraperStatus === 'stopped') {
    await db.query(
      `UPDATE scrape_jobs
       SET status = 'failed',
           finished_at = NOW()
       WHERE id = $1`,
      [job.id]
    );
  }

  return getJobById(job.id);
}

module.exports = {
  getJobById,
  syncScrapeJob,
};
