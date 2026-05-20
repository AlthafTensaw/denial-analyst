/**
 * Worklist column schema for SchemaDataGrid (via DataExplorer).
 *
 * PR-6: switched to platform SchemaDataGridColumn<WorklistRow> shape.
 * Column ids stable for column-visibility persistence. Claim+patient
 * marked `required: true` so the visibility menu keeps it visible.
 *
 * Sort: none. Backend imposes the order (recommended first, then
 * classified_at desc). Headers are non-sortable by design — adding
 * sort affordances here would mislead analysts about server behavior.
 */

import type { SchemaDataGridColumn } from '@tensaw/composition/grids';
import type { WorklistRow } from '../../actions/schemas';
import {
  ClaimPatientCell,
  CategoryCell,
  NetPendingCell,
  StateCell,
  NextActionCell,
  CurrentStatusCell,
  AgingCell,
} from './cells';

export const WORKLIST_COLUMNS: SchemaDataGridColumn<WorklistRow>[] = [
  {
    id: 'claim_patient',
    header: 'Claim · Patient',
    required: true,
    minWidth: 200,
    cell: ({ row }) => <ClaimPatientCell row={row} />,
  },
  {
    id: 'category',
    header: 'Recommended category',
    minWidth: 260,
    cell: ({ row }) => <CategoryCell row={row} />,
  },
  {
    id: 'aging',
    header: 'Aging',
    width: 110,
    defaultHidden: true, // exposed via visibility menu; collapsed by default since claim cell already shows bucket
    cell: ({ row }) => <AgingCell row={row} />,
  },
  {
    id: 'next_action',
    header: 'Next action',
    minWidth: 220,
    cell: ({ row }) => <NextActionCell row={row} />,
  },
  {
    id: 'current_status',
    header: 'Status',
    width: 120,
    cell: ({ row }) => <CurrentStatusCell row={row} />,
  },
  {
    id: 'net_pending',
    header: 'Net pending',
    width: 110,
    align: 'right',
    cell: ({ row }) => <NetPendingCell row={row} />,
  },
  {
    id: 'state',
    header: 'State',
    width: 110,
    cell: ({ row }) => <StateCell row={row} />,
  },
];
