import type { PivotRequest, PivotResponse } from '../types/pivot';
import { apiFetch } from './http';

export async function runPivot(
  req: PivotRequest
): Promise<PivotResponse> {
  const res = await apiFetch('/pivot/run', {
    method: 'POST',
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let message = 'Pivot API failed';
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

  const json = await res.json();

  // ✅ unwrap backend response
  return json.data as PivotResponse;
}
