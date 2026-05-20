/**
 * RowDetailPanel — orchestrates claim header + 3 regions + action bar.
 *
 * PR-6 changes from PR-5:
 *   - ActionButton from @tensaw/wired-components for the mutation
 *     buttons (Accept, Complete, Re-classify, worked-outside-tool).
 *     The ActionButton automatically wires loading state, optimistic
 *     UI policy, error/success toast routing per the action's
 *     declaration. No more manual useActionMutation in this file.
 *   - Override is still a regular Button because it opens the modal
 *     (which then ActionForm-dispatches the override). Two-step UX.
 *   - Tailwind classes throughout. No inline styles.
 *   - ClaimDetail + DenialEvent fetching unchanged (still useActionQuery
 *     because reads through the data router for caching).
 *
 * State-aware action bar:
 *   recommended           → Accept · Override · Re-classify · worked-outside-tool*
 *   accepted | overridden → Complete · Re-classify
 *   completed             → (no action bar; shows "Completed N ago")
 *
 * *worked-outside-tool only shows when current_status_label != 'Denied'
 * per D-13.
 */

import { useState } from 'react';
import { useActionQuery } from '@tensaw/actions';
import { Button } from '@tensaw/design-system/primitives';
import { ActionButton } from '@tensaw/wired-components';
import { Pill } from '@tensaw/design-system/feedback';
import { usePermissions } from '../auth/permissions';
import type {
  ClaimDetail,
  DenialEvent,
  StateTransitionResponse,
  WorklistRow,
} from '../actions/schemas';
import { ClaimDetailHeader } from './ClaimDetailHeader';
import { DenialEventsList } from './DenialEventsList';
import { WorkflowStepsList } from './WorkflowStepsList';
import { OverrideModal } from './OverrideModal';

interface RowDetailPanelProps {
  row: WorklistRow;
  onMutated: () => void;
}

export function RowDetailPanel({ row, onMutated }: RowDetailPanelProps) {
  const { has } = usePermissions();
  const canAct = has('denial.act');
  const canReclassify = has('denial.classify_claim');
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { classification, claim } = row;
  const classificationId = classification.classification_id;
  const state = classification.state;

  // Phase 1.5 — fat claim detail + denial events fetched on expand
  const { data: claimDetail, isLoading: detailLoading } = useActionQuery<
    { claimId: number },
    ClaimDetail
  >('denial.claim-detail', { claimId: claim.claim_id });

  const { data: eventsData, isLoading: eventsLoading } = useActionQuery<
    { claimId: number },
    DenialEvent[]
  >('denial.denial-events', { claimId: claim.claim_id });

  const isWorkedOutsideTool =
    claim.current_status_label !== null &&
    claim.current_status_label !== 'Denied';

  return (
    <div className="bg-surface-sunken">
      <ClaimDetailHeader
        detail={claimDetail}
        loading={detailLoading}
        classificationId={classificationId}
      />

      {/* Region 1 + 2 side by side */}
      <div className="grid grid-cols-2 border-b border-tertiary">
        <div className="p-4 border-r border-tertiary">
          <div className="text-[10px] uppercase tracking-wide text-secondary font-medium mb-2">
            Classification reasoning
          </div>
          <div className="text-sm leading-relaxed mb-2">
            {classification.reasoning_summary}
          </div>
          <div className="flex gap-2 items-center text-xs text-secondary">
            {classification.rule_id ? (
              <Pill variant="subtle" tone="teal">
                <code className="font-mono text-xs">
                  {classification.rule_id}
                </code>
              </Pill>
            ) : (
              <Pill variant="subtle" tone="info">
                LLM-classified
              </Pill>
            )}
            <span className="flex items-center gap-1">
              <span
                className={[
                  'w-1.5 h-1.5 rounded-full inline-block',
                  classification.confidence === 'high'
                    ? 'bg-teal-600'
                    : classification.confidence === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                ].join(' ')}
              />
              {classification.confidence} confidence
            </span>
          </div>
        </div>

        <div className="p-4">
          <DenialEventsList
            events={eventsData}
            loading={eventsLoading}
            classificationId={classificationId}
          />
        </div>
      </div>

      {/* Region 3 — workflow steps */}
      <div className="p-4 border-b border-tertiary">
        <WorkflowStepsList
          classification={classification}
          canAct={canAct}
          onStepCompleted={() => onMutated()}
          onAutoComplete={() => onMutated()}
        />
      </div>

      {/* State-aware action bar */}
      <div className="px-4 py-3 bg-primary flex gap-2 items-center">
        {state === 'recommended' && canAct ? (
          isWorkedOutsideTool ? (
            <ActionButton<{ classificationId: string; body: { reason: string } }, StateTransitionResponse>
              actionId="denial.override"
              request={{
                classificationId,
                body: { reason: 'worked_outside_tool' },
              }}
              variant="primary"
              toastOnSuccess="Recorded as worked outside tool"
              onSuccess={onMutated}
            >
              Mark as worked outside tool
            </ActionButton>
          ) : (
            <ActionButton<{ classificationId: string; body: object }, StateTransitionResponse>
              actionId="denial.accept"
              request={{ classificationId, body: {} }}
              variant="primary"
              toastOnSuccess="Accepted"
              onSuccess={onMutated}
            >
              Accept
            </ActionButton>
          )
        ) : null}

        {state === 'recommended' && canAct ? (
          <Button
            variant="ghost"
            onClick={() => setOverrideOpen(true)}
          >
            Override…
          </Button>
        ) : null}

        {(state === 'accepted' || state === 'overridden') && canAct ? (
          <ActionButton<{ classificationId: string; body: object }, StateTransitionResponse>
            actionId="denial.complete"
            request={{ classificationId, body: {} }}
            variant="primary"
            toastOnSuccess="Marked complete"
            onSuccess={onMutated}
          >
            Complete
          </ActionButton>
        ) : null}

        {canReclassify && state !== 'completed' ? (
          <ActionButton<{ claimId: number }, unknown>
            actionId="denial.classify-claim"
            request={{ claimId: claim.claim_id }}
            variant="ghost"
            toastOnSuccess="Re-classified"
            onSuccess={onMutated}
          >
            Re-classify
          </ActionButton>
        ) : null}

        {state === 'completed' ? (
          <span className="text-sm text-secondary">
            Completed · classification finalized
          </span>
        ) : null}

        <span className="ml-auto text-xs text-tertiary">
          Classified {new Date(classification.classified_at).toLocaleString()}{' '}
          · tool {classification.tool_version}
        </span>
      </div>

      <OverrideModal
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        classification={classification}
        onSuccess={onMutated}
      />
    </div>
  );
}
