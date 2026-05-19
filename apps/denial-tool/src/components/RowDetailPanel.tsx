/**
 * RowDetailPanel — expanded-row detail content (PR-5).
 *
 * Major rewrite from PR-4. Phase 1.5 surface:
 *
 *   - Fetches claim-detail (fat) + denial-events on expand, in parallel.
 *     `ClaimDetailHeader` renders patient/MRN (PHI) + provider + facility
 *     + financial breakdown + ICDs at the top.
 *
 *   - Three regions are back per §6.6 of the original spec:
 *     1. Classification reasoning (rule_id, summary, alternates)
 *     2. Source evidence — denial events with CARC/RARC codes + reason_text
 *        (PHI, audited via reveal-phi)
 *     3. Recommended action plan — `WorkflowStepsList` with checkbox per
 *        step. Each click dispatches step-complete; the response can
 *        auto-transition the parent classification.
 *
 *   - Complete button — when state is `accepted` or `overridden`, the
 *     Complete button appears in the action bar. Fires denial.complete.
 *     This closes the loop on the §1 handback item — analysts can now
 *     mark claims done in the normal flow.
 *
 *   - D-13 worked-outside-tool flow preserved for non-Denied current
 *     statuses, but now coexists with the standard accept/override/complete
 *     trio depending on state.
 *
 *   - Toast on `auto_completed_classification: true` from step-complete
 *     so the analyst knows why the row jumped to completed.
 */

import { useState } from 'react';
import { useActionMutation, useActionQuery } from '@tensaw/actions';
import { useAuthStore } from '@tensaw/runtime';
import type { ClaimDetail, DenialEvent, WorklistRow } from '../actions/schemas';
import { ClaimDetailHeader } from './ClaimDetailHeader';
import { DenialEventsList } from './DenialEventsList';
import { OverrideModal, type OverrideSubmission } from './OverrideModal';
import { RunClassifierNowButton } from './RunClassifierNowButton';
import { WorkflowStepsList } from './WorkflowStepsList';
import { friendlyErrorMessage } from '../lib/problem';

interface RowDetailPanelProps {
  row: WorklistRow;
  onMutationComplete: () => void;
}

export function RowDetailPanel({
  row,
  onMutationComplete,
}: RowDetailPanelProps): JSX.Element {
  const c = row.classification;
  const claim = row.claim;
  const user = useAuthStore((s) => s.user);
  const canAct = user?.permissions.includes('denial.act') ?? false;

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideInitialReason, setOverrideInitialReason] = useState<
    'worked_outside_tool' | undefined
  >();
  const [toast, setToast] = useState<string | null>(null);

  // Phase 1.5 — fetch claim-detail + denial-events in parallel on expand.
  const claimDetail = useActionQuery<ClaimDetail>('denial.claim-detail', {
    claim_id: claim.claim_id,
  });
  const denialEvents = useActionQuery<DenialEvent[]>('denial.denial-events', {
    claim_id: claim.claim_id,
  });

  const [mutateAccept, { isLoading: acceptPending }] = useActionMutation('denial.accept');
  const [mutateOverride, { isLoading: overridePending }] = useActionMutation('denial.override');
  const [mutateComplete, { isLoading: completePending }] = useActionMutation('denial.complete');

  const isWorkedOutsideTool =
    claim.current_status_label !== null &&
    claim.current_status_label !== 'Denied';

  const canComplete = c.state === 'accepted' || c.state === 'overridden';
  const canAcceptOrOverride = c.state === 'recommended';

  // -------------------------------------------------------------------------
  // Mutation handlers
  // -------------------------------------------------------------------------

  const handleAccept = async () => {
    try {
      const res = await mutateAccept({ classification_id: c.classification_id });
      if (!res.ok) throw new Error(res.error.message);
      setToast(`Accepted recommendation for claim ${claim.claim_id}.`);
      onMutationComplete();
    } catch (err) {
      setToast(`Accept failed: ${friendlyErrorMessage(err)}`);
    }
  };

  const handleOverride = async (payload: OverrideSubmission) => {
    try {
      const res = await mutateOverride({
        classification_id: c.classification_id,
        reason: payload.reason,
        corrected_category: payload.corrected_category,
        corrected_branch: payload.corrected_branch,
        notes: payload.notes,
      });
      if (!res.ok) throw new Error(res.error.message);
      setOverrideOpen(false);
      // D-13 chained flow — if this was worked_outside_tool, also fire complete.
      if (payload.reason === 'worked_outside_tool') {
        try {
          const resComp = await mutateComplete({
            classification_id: c.classification_id,
            notes: 'Auto-complete after worked-outside-tool override.',
          });
          if (!resComp.ok) throw new Error(resComp.error.message);
          setToast(
            `Recorded as worked outside tool. Claim ${claim.claim_id} marked complete.`,
          );
        } catch (err) {
          setToast(
            `Override recorded but complete step failed: ${friendlyErrorMessage(err)}`,
          );
        }
      } else {
        setToast(`Override recorded for claim ${claim.claim_id}.`);
      }
      onMutationComplete();
    } catch (err) {
      setToast(`Override failed: ${friendlyErrorMessage(err)}`);
    }
  };

  const handleComplete = async () => {
    try {
      const res = await mutateComplete({ classification_id: c.classification_id });
      if (!res.ok) throw new Error(res.error.message);
      setToast(`Claim ${claim.claim_id} marked complete.`);
      onMutationComplete();
    } catch (err) {
      setToast(`Complete failed: ${friendlyErrorMessage(err)}`);
    }
  };

  const handleStepCompleted = () => {
    onMutationComplete();
  };

  const handleAutoComplete = () => {
    setToast(
      `Claim ${claim.claim_id} auto-completed — all workflow steps done.`,
    );
    onMutationComplete();
  };

  const openWorkedOutsideTool = () => {
    setOverrideInitialReason('worked_outside_tool');
    setOverrideOpen(true);
  };

  const openStandardOverride = () => {
    setOverrideInitialReason(undefined);
    setOverrideOpen(true);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* === Fat claim detail (Phase 1.5) =================================== */}
      {claimDetail.data && (
        <ClaimDetailHeader
          detail={claimDetail.data}
          classificationId={c.classification_id}
        />
      )}
      {claimDetail.isLoading && !claimDetail.data && (
        <ClaimDetailHeader
          detail={null as never}
          classificationId={c.classification_id}
          loading
        />
      )}
      {claimDetail.error && !claimDetail.data && (
        <ClaimDetailHeader
          detail={null as never}
          classificationId={c.classification_id}
          error={claimDetail.error}
        />
      )}

      {/* === Region 1: Classification reasoning ============================ */}
      <section style={regionStyle}>
        <h4 style={regionHeaderStyle}>Classification reasoning</h4>
        <div style={reasoningGridStyle}>
          <div>
            <div style={labelStyle}>Primary category</div>
            <div style={categoryStyle}>{c.primary_category}</div>
          </div>
          <div>
            <div style={labelStyle}>Source</div>
            <div style={valueStyle}>
              {c.classification_source === 'rule' ? 'Rule engine' : 'LLM (Stage 2)'}
              {c.rule_id && (
                <code style={ruleBadgeStyle}>{c.rule_id}</code>
              )}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Confidence</div>
            <div style={valueStyle}>{c.confidence}</div>
          </div>
        </div>
        <div style={summaryStyle}>{c.reasoning_summary}</div>
        {c.alternate_categories.length > 0 && (
          <div style={alternatesStyle}>
            <div style={labelStyle}>Alternates considered</div>
            <ul style={alternatesListStyle}>
              {c.alternate_categories.map((cat) => (
                <li key={cat} style={alternateItemStyle}>
                  {cat}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* === Region 2: Source evidence (Phase 1.5, restored) ============== */}
      <section style={regionStyle}>
        <h4 style={regionHeaderStyle}>Source evidence</h4>
        <DenialEventsList
          classificationId={c.classification_id}
          events={denialEvents.data ?? []}
          loading={denialEvents.isLoading}
          error={denialEvents.error ?? undefined}
        />
      </section>

      {/* === Region 3: Recommended action plan ============================ */}
      <section style={regionStyle}>
        <h4 style={regionHeaderStyle}>
          Recommended action plan
          <span style={ownerBadgeStyle}>{c.recommended_owner}</span>
        </h4>
        <WorkflowStepsList
          classificationId={c.classification_id}
          state={c.state}
          steps={c.workflow_steps}
          onStepCompleted={handleStepCompleted}
          onAutoComplete={handleAutoComplete}
        />
      </section>

      {/* === Action bar =================================================== */}
      {canAct && (
        <div style={actionBarStyle}>
          {/* D-13: worked-outside-tool path takes precedence when applicable */}
          {isWorkedOutsideTool && canAcceptOrOverride && (
            <>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={openWorkedOutsideTool}
                disabled={overridePending || completePending}
              >
                Mark as worked outside tool
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => { void handleAccept(); }}
                disabled={acceptPending}
              >
                Accept anyway
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={openStandardOverride}
                disabled={overridePending}
              >
                Override (other reason)
              </button>
            </>
          )}

          {/* Standard recommended-state actions */}
          {!isWorkedOutsideTool && canAcceptOrOverride && (
            <>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => { void handleAccept(); }}
                disabled={acceptPending}
              >
                {acceptPending ? 'Accepting…' : 'Accept recommendation'}
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={openStandardOverride}
                disabled={overridePending}
              >
                Override…
              </button>
            </>
          )}

          {/* Phase 1.5 §1: Complete button for accepted/overridden rows */}
          {canComplete && (
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => { void handleComplete(); }}
              disabled={completePending}
              data-testid="complete-button"
            >
              {completePending ? 'Completing…' : 'Mark complete'}
            </button>
          )}

          {/* Re-classify (D-18, MANAGER+) — available in all states */}
          <RunClassifierNowButton
            claimId={claim.claim_id}
            onSuccess={onMutationComplete}
          />

          {c.state === 'completed' && (
            <span style={completedNoticeStyle}>
              ✓ Claim worked. No further action.
            </span>
          )}
        </div>
      )}

      {overrideOpen && (
        <OverrideModal
          currentCategory={c.primary_category}
          currentBranch={c.branch_chosen}
          onCancel={() => { setOverrideOpen(false); }}
          onSubmit={handleOverride}
          initialReason={overrideInitialReason}
          submitting={overridePending}
        />
      )}

      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
          <button
            type="button"
            onClick={() => { setToast(null); }}
            style={toastCloseStyle}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  padding: 14,
  background: 'var(--tw-color-surface-muted, #FAFAFB)',
  display: 'grid',
  gap: 14,
};

const regionStyle: React.CSSProperties = {
  padding: 12,
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 8,
};

const regionHeaderStyle: React.CSSProperties = {
  margin: '0 0 10px 0',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--tw-color-text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const ownerBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 400,
  background: 'var(--tw-color-table-header-bg, #EBF7F6)',
  color: 'var(--tw-color-brand-header, #149A9A)',
  padding: '2px 6px',
  borderRadius: 4,
};

const reasoningGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--tw-color-text-muted)',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-primary)',
};

const categoryStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--tw-color-text-primary)',
};

const ruleBadgeStyle: React.CSSProperties = {
  marginLeft: 6,
  background: 'var(--tw-color-border-muted, #E5E7EB)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: '0.75rem',
};

const summaryStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  color: 'var(--tw-color-text-primary)',
  background: 'var(--tw-color-surface-muted, #F9FAFB)',
  padding: 10,
  borderRadius: 6,
};

const alternatesStyle: React.CSSProperties = {
  marginTop: 10,
};

const alternatesListStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const alternateItemStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  background: 'var(--tw-color-border-muted, #E5E7EB)',
  padding: '2px 8px',
  borderRadius: 4,
};

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  padding: 12,
  background: 'white',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 8,
  alignItems: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--tw-color-brand-primary, #14B8A6)',
  color: 'white',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'white',
  color: 'var(--tw-color-text-primary)',
  border: '1px solid var(--tw-color-border-default)',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const completedNoticeStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--tw-color-brand-header, #149A9A)',
  fontWeight: 500,
};

const toastStyle: React.CSSProperties = {
  position: 'relative',
  padding: '10px 36px 10px 12px',
  background: '#111827',
  color: 'white',
  borderRadius: 6,
  fontSize: '0.8125rem',
};

const toastCloseStyle: React.CSSProperties = {
  position: 'absolute',
  right: 6,
  top: 4,
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  fontSize: '1.25rem',
  cursor: 'pointer',
  lineHeight: 1,
};
