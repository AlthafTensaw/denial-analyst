/**
 * Daily LLM-cost fixture for GET /v1/cost/daily.
 *
 * Backend emits one row per day in the requested window (zero-filled when
 * a day had no calls). Cost is decimal-string + integer cents per the
 * Pydantic schema. We mirror that shape.
 */

import type { CostSummary, DailyCostRow } from '../../schemas/denial';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a synthetic 30-day series ending today (UTC). The signal mixes:
 *   - 70% of days have moderate traffic (50-200 LLM calls)
 *   - 20% are quiet (5-20 calls)
 *   - 10% have a spike (300-500 calls)
 * Cost ~ $0.002 per 1k tokens at ~1k tokens/call.
 */
export function buildCostSummary(
  startDate?: string,
  endDate?: string,
): CostSummary {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate + 'T00:00:00Z') : today;
  const start = startDate
    ? new Date(startDate + 'T00:00:00Z')
    : new Date(end.getTime() - 29 * 86400000);

  const days: DailyCostRow[] = [];
  let totalCalls = 0;
  let totalCents = 0;

  // Deterministic pseudo-random based on the date so the fixture is stable.
  const seedAt = (d: Date) => {
    const n = Math.floor(d.getTime() / 86400000);
    return ((n * 2654435761) >>> 0) / 0xffffffff;
  };

  for (
    let cur = new Date(start);
    cur.getTime() <= end.getTime();
    cur = new Date(cur.getTime() + 86400000)
  ) {
    const r = seedAt(cur);
    let calls: number;
    if (r < 0.1) calls = Math.round(300 + r * 2000); // spike
    else if (r < 0.3) calls = Math.round(5 + r * 60); // quiet
    else calls = Math.round(50 + r * 150); // moderate

    const tokens = calls * 1000;
    const cents = Math.round(calls * 0.2); // $0.002/call
    totalCalls += calls;
    totalCents += cents;

    days.push({
      date: isoDate(cur),
      num_llm_calls: calls,
      total_tokens: tokens,
      total_cost_cents: cents,
      total_cost_usd: (cents / 100).toFixed(2),
    });
  }

  return {
    start_date: isoDate(start),
    end_date: isoDate(end),
    total_cost_cents: totalCents,
    total_cost_usd: (totalCents / 100).toFixed(2),
    total_llm_calls: totalCalls,
    days,
  };
}
