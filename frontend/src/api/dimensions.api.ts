import { apiFetch } from './http';
export interface FetchDimensionsFilters {
  sitemap_uid: string;
  start_date?: string;
  end_date?: string;
  month?: string;
}

export async function fetchPivotDimensions(
  filters: FetchDimensionsFilters
): Promise<string[]> {
  const query = new URLSearchParams({ sitemap_uid: filters.sitemap_uid });

  if (filters.start_date) {
    query.set('start_date', filters.start_date);
  }

  if (filters.end_date) {
    query.set('end_date', filters.end_date);
  }

  if (filters.month) {
    query.set('month', filters.month);
  }

  const res = await apiFetch(`/pivot/dimensions?${query.toString()}`);

  if (!res.ok) {
    let message = 'Failed to load pivot dimensions';
    try {
      const err = await res.json();
      if (typeof err?.error === 'string') {
        message = err.error;
      }
    } catch {
      // Keep default message
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data.dimensions ?? [];
}
