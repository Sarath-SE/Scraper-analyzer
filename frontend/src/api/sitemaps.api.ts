import { apiFetch } from './http';

export interface SitemapOption {
  sitemap_uid: string;
  name: string | null;
  last_snapshot_date: string | null;
  snapshot_count: number;
}

export async function fetchSitemaps(): Promise<SitemapOption[]> {
  const res = await apiFetch('/sitemaps');

  if (!res.ok) {
    throw new Error('Failed to load sitemaps');
  }

  const data = await res.json();
  return data.sitemaps ?? [];
}
