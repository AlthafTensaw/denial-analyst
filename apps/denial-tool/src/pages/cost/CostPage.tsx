/**
 * CostPage — manager-facing daily LLM spend (D-18 / D-19 cost tracking).
 *
 * PR-6: hand-rolled SVG chart → LineChart from @tensaw/visualization.
 * Card from @tensaw/design-system/layout for the totals strip;
 * SchemaDataGrid for the daily breakdown table. No inline styles.
 *
 * Defaults to the last 30 days. Date range picker would be a Phase 2
 * add — for now, the totals shown are computed from `data.days` so the
 * chart and the totals always agree without a second fetch.
 */

import { useMemo } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { LineChart } from '@tensaw/visualization/charts';
import { Card } from '@tensaw/design-system/layout';
import { SchemaDataGrid } from '@tensaw/composition/grids';
import type { SchemaDataGridColumn } from '@tensaw/composition/grids';
import { Spinner, Alert } from '@tensaw/design-system/feedback';
import type { CostSummary, DailyCostRow } from '../../actions/schemas';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatUsd(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `$${n.toFixed(2)}`;
}

const COST_COLUMNS: SchemaDataGridColumn<DailyCostRow>[] = [
  { id: 'date', header: 'Date', minWidth: 110, accessorKey: 'date' },
  {
    id: 'calls',
    header: 'LLM calls',
    width: 110,
    align: 'right',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.num_llm_calls.toLocaleString()}</span>
    ),
  },
  {
    id: 'tokens',
    header: 'Tokens',
    width: 130,
    align: 'right',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.total_tokens.toLocaleString()}</span>
    ),
  },
  {
    id: 'cost',
    header: 'Cost (USD)',
    width: 120,
    align: 'right',
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {formatUsd(row.total_cost_usd)}
      </span>
    ),
  },
];

export function CostPage() {
  const { data, isLoading, error } = useActionQuery<
    { start_date: string; end_date: string },
    CostSummary
  >('denial.cost-daily', {
    start_date: thirtyDaysAgoISO(),
    end_date: todayISO(),
  });

  const series = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => ({
      date: d.date,
      cost: Number(d.total_cost_usd),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2  p-6">
        <Spinner /> Loading cost data…
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" tone="solid" className="m-6">
        Failed to load cost data
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">LLM cost</h1>
        <p className="text-sm mt-1">
          Daily spend on the denial-classifier service. Last 30 days.
        </p>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="md">
          <div className="text-xs uppercase tracking-wide ">
            Total cost
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {formatUsd(data.total_cost_usd)}
          </div>
        </Card>
        <Card padding="md">
          <div className="text-xs uppercase tracking-wide ">
            LLM calls
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {data.total_llm_calls.toLocaleString()}
          </div>
        </Card>
        <Card padding="md">
          <div className="text-xs uppercase tracking-wide ">
            Avg cost / day
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {formatUsd(
              data.days.length > 0
                ? Number(data.total_cost_usd) / data.days.length
                : 0,
            )}
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card padding="md">
        <div className="text-sm font-medium mb-3">Daily cost trend</div>
        <LineChart
          data={series}
          xAxisKey="date"
          series={[
            {
              dataKey: 'cost',
              label: 'Cost (USD)',
              format: 'money',
            },
          ]}
          yAxisFormat="money"
          height={240}
          area
          smooth={false}
        />
      </Card>

      {/* Daily table */}
      <Card padding="none">
        <SchemaDataGrid<DailyCostRow>
          rows={data.days}
          columns={COST_COLUMNS}
          getRowId={(r) => r.date}
          density="compact"
        />
      </Card>
    </div>
  );
}
