import { apiFetch } from './http';

export interface SitemapOption {
  sitemap_uid: string;
  description: string | null;
  last_snapshot_date: string | null;
  snapshot_count: number;
}

export async function fetchSitemaps(): Promise<SitemapOption[]> {
  const res = await apiFetch('/sitemaps');

  if (!res.ok) {
    throw new Error('Failed to load sitemaps');
  }

  const data = await res.json();
  const rawList = Array.isArray(data?.sitemaps) ? data.sitemaps : [];

  return rawList.map((item: any) => ({
    sitemap_uid: String(item.sitemap_uid ?? ''),
    // Backward-compatible with older API shape that returns `name`.
    description: item.description ?? item.name ?? null,
    last_snapshot_date: item.last_snapshot_date ?? null,
    snapshot_count: Number(item.snapshot_count ?? 0),
  }));
}
