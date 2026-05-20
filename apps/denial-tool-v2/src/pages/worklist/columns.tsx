/**
 * Worklist column definitions.
 *
 * PR-4 note: backend imposes a fixed sort (state=recommended floats first,
 * then classified_at desc). No client-side sort affordances — every column
 * is non-sortable. The original RecommendationGrid `sortable` prop is no
 * longer consulted.
 */

import type { WorklistRow } from '../../actions/schemas';
import {
  ClaimIdCell,
  DosAgingCell,
  NetPendingCell,
  NextActionCell,
  PayerCell,
  PriorityCell,
  RecommendationCell,
} from './cells';

export interface WorklistColumn {
  id: string;
  header: string;
  width: string; // e.g. "120px" or "1fr"
  align?: 'left' | 'right' | 'center';
  /** Render the cell for the given row. */
  render: (row: WorklistRow) => JSX.Element;
}

export const WORKLIST_COLUMNS: WorklistColumn[] = [
  {
    id: 'priority',
    header: 'Priority',
    width: '150px',
    render: (row) => <PriorityCell row={row} />,
  },
  {
    id: 'claim',
    header: 'Claim',
    width: '110px',
    render: (row) => <ClaimIdCell row={row} />,
  },
  {
    id: 'payer',
    header: 'Payer',
    width: '160px',
    render: (row) => <PayerCell row={row} />,
  },
  {
    id: 'net_pending',
    header: 'Net pending',
    width: '120px',
    align: 'right',
    render: (row) => <NetPendingCell row={row} />,
  },
  {
    id: 'dos_aging',
    header: 'DOS / aging',
    width: '110px',
    render: (row) => <DosAgingCell row={row} />,
  },
  {
    id: 'recommendation',
    header: 'Recommendation',
    width: '1.4fr',
    render: (row) => <RecommendationCell row={row} />,
  },
  {
    id: 'next_action',
    header: 'Next action',
    width: '1.6fr',
    render: (row) => <NextActionCell row={row} />,
  },
];
