import { apiFetch } from './http';

export interface TriggerScrapeResponse {
  scrape_job_id?: number;
  status: string;
  reason?: string;
  snapshot_id?: number;
  source?: string;
  scraper_job_id?: number;
}

export interface JobStatusResponse {
  id: number;
  status: 'requested' | 'running' | 'ingesting' | 'finished' | 'failed';
  finished_at: string | null;
}

export async function triggerScrape(sitemapUid: string): Promise<TriggerScrapeResponse> {
  const response = await apiFetch('/scrapes/trigger', {
    method: 'POST',
    body: JSON.stringify({ sitemap_uid: sitemapUid }),
  });

  if (!response.ok) {
    throw new Error('Failed to trigger scrape');
  }

  return response.json();
}

export async function getJobStatus(jobId: number): Promise<JobStatusResponse> {
  const response = await apiFetch(`/scrapes/status/${jobId}`);

  if (!response.ok) {
    throw new Error('Failed to get job status');
  }

  return response.json();
}
