/**
 * CostPage — Phase 1 manager-facing LLM spend monitor.
 *
 * Backend ships `/v1/cost/daily` with zero-filled daily rows; the FE
 * plots a continuous time series.
 *
 * Renders a small SVG line chart inline rather than pulling in a chart
 * library, to keep the page's dependency surface minimal for PR-4.
 * If the rest of the app already includes recharts (likely from
 * @tensaw/composition), a follow-up can swap to it for richer tooltips.
 */

import { useMemo, useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import type { CostSummary, DailyCostRow } from '../../actions/schemas';

const WINDOW_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
];

export function CostPage(): JSX.Element {
  const [windowDays, setWindowDays] = useState(30);

  const request = useMemo(() => {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - (windowDays - 1) * 86400000);
    return {
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    };
  }, [windowDays]);

  const query = useActionQuery<CostSummary>('denial.cost-daily', request);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>LLM Cost — daily</h1>
          <div style={subtitleStyle}>
            Stage-2 classifier spend rollups.
          </div>
        </div>
        <div style={windowSelectorStyle}>
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => { setWindowDays(opt.days); }}
              style={{
                ...windowBtnStyle,
                background:
                  opt.days === windowDays
                    ? 'var(--tw-color-brand-primary, #14B8A6)'
                    : 'transparent',
                color:
                  opt.days === windowDays
                    ? 'white'
                    : 'var(--tw-color-brand-header, #149A9A)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {query.isLoading && (
        <div style={loadingStyle}>Loading…</div>
      )}

      {query.error && (
        <div role="alert" style={errorStyle}>
          Failed to load cost data. {query.error.message}
        </div>
      )}

      {query.data && (
        <>
          <SummaryCards summary={query.data} />
          <ChartCard data={query.data.days} />
          <DailyTable rows={query.data.days} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function SummaryCards({ summary }: { summary: CostSummary }) {
  return (
    <div style={summaryGridStyle}>
      <SummaryCard label="Total cost" value={`$${summary.total_cost_usd}`} />
      <SummaryCard
        label="Total LLM calls"
        value={summary.total_llm_calls.toLocaleString()}
      />
      <SummaryCard
        label="Window"
        value={`${summary.start_date} → ${summary.end_date}`}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG line chart (lightweight, no external deps)
// ---------------------------------------------------------------------------

function ChartCard({ data }: { data: DailyCostRow[] }) {
  if (data.length === 0) return null;
  const W = 1200;
  const H = 240;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...data.map((d) => d.total_cost_cents));
  const xStep = innerW / Math.max(1, data.length - 1);

  const points = data
    .map((d, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + innerH - (d.total_cost_cents / max) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    (max * (i / yTicks)) / 100,
  ); // cents → dollars

  return (
    <div style={chartCardStyle}>
      <div style={chartTitleStyle}>Daily cost (USD)</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y axis grid + ticks */}
        {yTickValues.map((v, i) => {
          const y =
            PAD.top + innerH - (innerH * i) / yTicks;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--tw-color-border-default)"
                strokeWidth={0.5}
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                style={{
                  fontSize: 11,
                  fill: 'var(--tw-color-text-muted)',
                }}
              >
                ${v.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--tw-color-brand-primary, #14B8A6)"
          strokeWidth={2}
        />

        {/* X axis (date) labels: first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
          const d = data[i];
          if (!d) return null;
          const x = PAD.left + i * xStep;
          return (
            <text
              key={i}
              x={x}
              y={H - 10}
              textAnchor={
                i === 0
                  ? 'start'
                  : i === data.length - 1
                    ? 'end'
                    : 'middle'
              }
              style={{
                fontSize: 11,
                fill: 'var(--tw-color-text-muted)',
              }}
            >
              {d.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily table
// ---------------------------------------------------------------------------

function DailyTable({ rows }: { rows: DailyCostRow[] }) {
  if (rows.length === 0) return null;
  // Show most recent first for at-a-glance reading
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div style={tableCardStyle}>
      <div style={chartTitleStyle}>Daily breakdown</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>LLM calls</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Tokens</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.date}>
              <td style={tdStyle}>{d.date}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {d.num_llm_calls.toLocaleString()}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {d.total_tokens.toLocaleString()}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: d.num_llm_calls > 0 ? 500 : 400,
                  color:
                    d.num_llm_calls > 0
                      ? 'var(--tw-color-text-primary)'
                      : 'var(--tw-color-text-muted)',
                }}
              >
                ${d.total_cost_usd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 1440,
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 500,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
};

const windowSelectorStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
};

const windowBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  border: '1px solid var(--tw-color-brand-header, #149A9A)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
};

const summaryCardStyle: React.CSSProperties = {
  padding: 16,
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 12,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 500,
  marginTop: 4,
  fontVariantNumeric: 'tabular-nums',
};

const chartCardStyle: React.CSSProperties = {
  padding: 16,
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 12,
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  marginBottom: 8,
};

const tableCardStyle: React.CSSProperties = {
  padding: 16,
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 12,
  overflow: 'auto',
  maxHeight: 480,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8125rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--tw-color-border-default)',
  fontWeight: 500,
  color: 'var(--tw-color-text-secondary)',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--tw-color-border-default)',
  fontVariantNumeric: 'tabular-nums',
};

const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--tw-color-text-muted)',
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--tw-color-status-error-bg, #FEF2F2)',
  border: '1px solid var(--tw-color-status-error-fg, #FCA5A5)',
  borderRadius: 6,
  color: 'var(--tw-color-status-error-fg, #B91C1C)',
  fontSize: '0.8125rem',
};
