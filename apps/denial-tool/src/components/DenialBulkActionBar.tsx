/**
 * DenialBulkActionBar — Accept-all + CSV export over selected rows.
 *
 * PR-6: platform BulkActionBar from @tensaw/worklist; ActionButton
 * for the bulk-accept dispatch (handles loading + toasts automatically);
 * Button for CSV (no mutation — purely client-side).
 *
 * D-19 gate: client-side pre-check on every selected row. If any row
 * fails (low confidence / requires_human_review / state != recommended),
 * the Accept-all button is disabled with a tooltip explaining which row
 * tripped the gate. Backend will reject anyway with a per-row reason in
 * BulkAcceptResponse.rejected[], but client-side gate gives instant
 * feedback.
 */

import { BulkActionBar } from '@tensaw/worklist';
import { Button } from '@tensaw/design-system/primitives';
import { Tooltip } from '@tensaw/design-system/overlays';
import { ActionButton } from '@tensaw/wired-components';
import type { BulkAcceptResponse, WorklistRow } from '../actions/schemas';
import { evaluateD19Gate } from './d19Gate';
import { exportSelectedRowsToCSV } from '../lib/csvExport';

interface DenialBulkActionBarProps {
  selectedRows: WorklistRow[];
  onClear: () => void;
  onMutated: () => void;
}

export function DenialBulkActionBar({
  selectedRows,
  onClear,
  onMutated,
}: DenialBulkActionBarProps) {
  const gate = evaluateD19Gate(selectedRows);
  const ids = selectedRows.map((r) => r.classification.classification_id);

  return (
    <BulkActionBar
      selectedCount={selectedRows.length}
      onClear={onClear}
      label={`${selectedRows.length} selected`}
    >
      {gate.ok ? (
        <ActionButton<
          { classification_ids: string[] },
          BulkAcceptResponse
        >
          actionId="denial.bulk-accept"
          request={{ classification_ids: ids }}
          variant="primary"
          toastOnSuccess={(resp) =>
            `Accepted ${resp.accepted.length} of ${resp.requested}`
          }
          onSuccess={() => {
            onClear();
            onMutated();
          }}
        >
          Accept all ({selectedRows.length})
        </ActionButton>
      ) : (
        <Tooltip
          content={gate.reason}
        >
          <span>
            <Button variant="primary" disabled>
              Accept all ({selectedRows.length})
            </Button>
          </span>
        </Tooltip>
      )}

      <Button
        variant="ghost"
        onClick={() =>
          exportSelectedRowsToCSV(selectedRows, { user: undefined })
        }
      >
        Export CSV
      </Button>
    </BulkActionBar>
  );
}
