/**
 * RowDetailPanel — expanded-row detail content.
 *
 * PR-4 changes from PR-3:
 *
 *   1. Two regions, not three. §6.6 region 2 ("source evidence") had no
 *      backend data source — the detail endpoint returns only the
 *      Classification, with no denial-event history. We drop region 2
 *      entirely until Phase 1.1 adds a denial-events endpoint.
 *
 *   2. D-13 "worked outside tool" flow: when `current_status_label !=
 *      "Denied"`, the primary action is "Mark as worked outside tool",
 *      which fires POST override (reason=worked_outside_tool) then POST
 *      complete in sequence. Regular Accept/Override... become secondary.
 *
 *   3. All button payloads use the backend's body shapes (notes, reason,
 *      corrected_category, corrected_branch). State-transition responses
 *      don't include the row, so callers refetch.
 *
 *   4. PrivacyField is NOT wired here — no PHI is rendered. The
 *      component remains in the codebase as defensive scaffolding.
 */

import { useState } from 'react';
import { useAuthStore } from '@tensaw/runtime';
import { useActionMutation } from '@tensaw/actions';
import type {
  StateTransitionResponse,
  WorklistRow,
} from '../actions/schemas';
import { OverrideModal, type OverrideSubmission } from './OverrideModal';
import { RunClassifierNowButton } from './RunClassifierNowButton';
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
  const canAct = user?.permissions?.includes('denial.act') ?? false;

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideInitialReason, setOverrideInitialReason] = useState<
    'worked_outside_tool' | undefined
  >();
  const [toast, setToast] = useState<string | null>(null);

  const [fireAccept, accept] = useActionMutation('denial.accept');
  const [fireOverride, override] = useActionMutation('denial.override');
  const [fireComplete, complete] = useActionMutation('denial.complete');

  const isWorkedOutsideTool =
    claim.current_status_label !== null &&
    claim.current_status_label !== 'Denied';

  const refreshAfterMutation = () => {
    onMutationComplete();
  };

  const handleAccept = async () => {
    try {
      const result = await fireAccept({
        classification_id: c.classification_id,
      });
      if (!result.ok) throw result.error;
      setToast(`Accepted recommendation for claim ${claim.claim_id}.`);
      refreshAfterMutation();
    } catch (err) {
      setToast(`Accept failed: ${friendlyErrorMessage(err)}`);
    }
  };

  const handleOverride = async (payload: OverrideSubmission) => {
    try {
      const result = await fireOverride({
        classification_id: c.classification_id,
        ...payload,
      });
      if (!result.ok) throw result.error;
      setOverrideOpen(false);
      setOverrideInitialReason(undefined);
      setToast(`Override recorded for claim ${claim.claim_id}.`);
      refreshAfterMutation();
    } catch (err) {
      setToast(`Override failed: ${friendlyErrorMessage(err)}`);
    }
  };

  /**
   * Worked-outside-tool flow per D-13: override (reason=worked_outside_tool)
   * then complete in sequence. Both transitions in one click.
   *
   * If the user wants to record corrected_branch / notes, they should
   * open the modal directly with the reason pre-selected — clicking
   * the primary button does the no-detail fast path.
   */
  const handleWorkedOutsideTool = async () => {
    const id = c.classification_id;
    try {
      const result = await fireOverride({
        classification_id: id,
        reason: 'worked_outside_tool',
      });
      if (!result.ok) throw result.error;
      const transition = result.data as StateTransitionResponse;
      // Only chain complete if the override succeeded (state moved to overridden).
      if (transition.new_state === 'overridden') {
        const completeResult = await fireComplete({ classification_id: id });
        if (!completeResult.ok) throw completeResult.error;
      }
      setToast(
        `Marked claim ${claim.claim_id} as worked outside tool and completed.`,
      );
      refreshAfterMutation();
    } catch (err) {
      setToast(
        `Worked-outside-tool flow failed: ${friendlyErrorMessage(err)}`,
      );
    }
  };

  return (
    <div style={panelStyle}>
      {/* REGION 1 — Classification reasoning */}
      <section>
        <div style={regionHeaderStyle}>Classification reasoning</div>
        <p style={reasoningStyle}>{c.reasoning_summary}</p>
        <dl style={metaGridStyle}>
          <dt style={metaTermStyle}>Source</dt>
          <dd style={metaDefStyle}>
            {c.classification_source === 'rule'
              ? `Rule · ${c.rule_id ?? '(no rule id)'}`
              : `LLM (Stage 2)`}
          </dd>
          {c.training_guide_section && (
            <>
              <dt style={metaTermStyle}>Training Guide</dt>
              <dd style={metaDefStyle}>
                §{c.training_guide_section} ({c.training_guide_version})
              </dd>
            </>
          )}
          {c.alternate_categories.length > 0 && (
            <>
              <dt style={metaTermStyle}>Alternates</dt>
              <dd style={metaDefStyle}>
                {c.alternate_categories.join(', ')}
              </dd>
            </>
          )}
          {c.priority_chips.length > 0 && (
            <>
              <dt style={metaTermStyle}>Priority chips</dt>
              <dd style={metaDefStyle}>{c.priority_chips.join(', ')}</dd>
            </>
          )}
          {c.risk_flags.length > 0 && (
            <>
              <dt style={metaTermStyle}>Risk flags</dt>
              <dd style={metaDefStyle}>{c.risk_flags.join(', ')}</dd>
            </>
          )}
          <dt style={metaTermStyle}>Classified at</dt>
          <dd style={metaDefStyle}>
            {new Date(c.classified_at).toLocaleString()}
          </dd>
        </dl>
        {isWorkedOutsideTool && (
          <div style={statusBannerStyle}>
            <strong>Current claim status: {claim.current_status_label}.</strong>{' '}
            This claim is no longer in <code>Denied</code> — it was likely
            worked outside the tool. Use the primary action below to mark
            this row and complete in one step.
          </div>
        )}
      </section>

      {/* REGION 3 — Recommended action plan (region 2 dropped; no backend data) */}
      <section>
        <div style={regionHeaderStyle}>Recommended action plan</div>
        {c.training_guide_section && (
          <div style={citationStyle}>
            Based on Training Guide §{c.training_guide_section} (
            {c.training_guide_version})
          </div>
        )}
        {c.workflow_steps.length === 0 ? (
          <p style={emptyStepsStyle}>
            No workflow steps defined for this category. Manual triage
            required.
          </p>
        ) : (
          <ol style={stepsStyle}>
            {c.workflow_steps.map((step) => (
              <li key={step.step} style={stepStyle}>
                <div style={stepActionStyle}>{step.action}</div>
                <div style={stepMetaStyle}>
                  Owner: <strong>{step.owner}</strong> · SLA:{' '}
                  <strong>{step.sla_days}d</strong> · {step.mode}
                  {step.day && <> · {step.day}</>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div style={d04NoteStyle}>
          Static reference per D-04 — analyst executes elsewhere.
        </div>
      </section>

      {/* Actions */}
      {canAct && c.state === 'recommended' && (
        <div style={actionsStyle}>
          {isWorkedOutsideTool ? (
            <>
              <button
                type="button"
                onClick={() => void handleWorkedOutsideTool()}
                disabled={override.isLoading || complete.isLoading}
                style={primaryBtnStyle}
              >
                Mark as worked outside tool
              </button>
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={accept.isLoading}
                style={secondaryBtnStyle}
              >
                {accept.isLoading ? 'Accepting…' : 'Accept anyway'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverrideInitialReason(undefined);
                  setOverrideOpen(true);
                }}
                style={secondaryBtnStyle}
              >
                Override…
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={accept.isLoading}
                style={primaryBtnStyle}
              >
                {accept.isLoading ? 'Accepting…' : 'Accept this recommendation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverrideInitialReason(undefined);
                  setOverrideOpen(true);
                }}
                style={secondaryBtnStyle}
              >
                Override…
              </button>
            </>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <RunClassifierNowButton
              claimId={claim.claim_id}
              onSuccess={refreshAfterMutation}
            />
          </span>
        </div>
      )}

      {/* Show current state for non-recommended rows */}
      {c.state !== 'recommended' && (
        <div style={stateBannerStyle}>
          This row is in state <strong>{c.state}</strong>. No further actions
          available from the worklist.
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastCloseStyle}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Override modal */}
      {overrideOpen && (
        <OverrideModal
          initialReason={overrideInitialReason}
          currentCategory={c.primary_category}
          currentBranch={c.branch_chosen}
          submitting={override.isLoading}
          onCancel={() => {
            setOverrideOpen(false);
            setOverrideInitialReason(undefined);
          }}
          onSubmit={handleOverride}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 22,
};

const regionHeaderStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--tw-color-text-muted)',
  marginBottom: 8,
};

const reasoningStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.5,
  fontSize: '0.875rem',
};

const metaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, max-content) 1fr',
  rowGap: 4,
  columnGap: 16,
  marginTop: 12,
  fontSize: '0.8125rem',
};

const metaTermStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
};

const metaDefStyle: React.CSSProperties = {
  margin: 0,
};

const statusBannerStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  background: 'var(--tw-color-status-warning-bg)',
  border: '1px solid var(--tw-color-amber-200, var(--tw-color-status-warning-bg))',
  borderRadius: 6,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-status-warning-fg)',
  lineHeight: 1.5,
};

const citationStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
  marginBottom: 8,
};

const stepsStyle: React.CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 22,
  display: 'grid',
  gap: 12,
};

const stepStyle: React.CSSProperties = {
  fontSize: '0.875rem',
};

const stepActionStyle: React.CSSProperties = {
  fontWeight: 500,
  lineHeight: 1.5,
};

const stepMetaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-muted)',
  marginTop: 4,
};

const emptyStepsStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-muted)',
  fontStyle: 'italic',
  margin: '4px 0 0',
};

const d04NoteStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--tw-color-text-muted)',
  marginTop: 10,
  fontStyle: 'italic',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  paddingTop: 12,
  borderTop: '1px solid var(--tw-color-border-default)',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--tw-color-brand-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: 'var(--tw-color-brand-header)',
  border: '1px solid var(--tw-color-brand-header)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const stateBannerStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--tw-color-surface-muted)',
  border: '1px solid var(--tw-color-border-default)',
  borderRadius: 6,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-secondary)',
};

const toastStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  right: 8,
  background: 'var(--tw-color-surface-overlay)',
  color: 'white',
  padding: '8px 32px 8px 12px',
  borderRadius: 6,
  fontSize: '0.8125rem',
  maxWidth: 480,
  zIndex: 25,
};

const toastCloseStyle: React.CSSProperties = {
  position: 'absolute',
  right: 4,
  top: 2,
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: '1.1rem',
  cursor: 'pointer',
  lineHeight: 1,
};
