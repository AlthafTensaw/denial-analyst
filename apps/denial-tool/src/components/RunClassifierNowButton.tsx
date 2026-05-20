/**
 * RunClassifierNowButton — manager-only per-claim re-classify (D-18).
 *
 * PR-6: platform ActionButton from @tensaw/wired-components with the
 * permission gate inline. If the user lacks denial.classify_claim, the
 * button doesn't render at all (no disabled-state tease — the action
 * just isn't visible).
 *
 * Kept as a standalone component (rather than inlined in
 * RowDetailPanel only) so future surfaces — e.g. an admin per-claim
 * inspector — can reuse it.
 */

import { ActionButton } from '@tensaw/wired-components';
import { usePermissions } from '../auth/permissions';
import type { Classification } from '../actions/schemas';

interface RunClassifierNowButtonProps {
  claimId: number;
  onClassified?: (next: Classification) => void;
}

export function RunClassifierNowButton({
  claimId,
  onClassified,
}: RunClassifierNowButtonProps) {
  const { has } = usePermissions();
  if (!has('denial.classify_claim')) return null;

  return (
    <ActionButton<{ claimId: number }, Classification>
      actionId="denial.classify-claim"
      request={{ claimId }}
      variant="ghost"
      toastOnSuccess="Re-classified"
      onSuccess={onClassified}
    >
      Re-classify
    </ActionButton>
  );
}
