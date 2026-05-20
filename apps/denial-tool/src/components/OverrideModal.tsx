/**
 * OverrideModal — wraps the platform <Dialog> + <ActionForm>.
 *
 * PR-6: replaces the custom modal markup + manual mutation wiring
 * with platform primitives. Form state goes through ActionForm's
 * react-hook-form integration; the dispatch is automatic on submit.
 *
 * Form shape matches OverrideRequest (Zod): reason + optional
 * corrected_category + optional corrected_branch + optional notes.
 * When reason === 'tool_wrong', corrected_category becomes required
 * and is validated client-side before dispatch (the platform's
 * react-hook-form `setError` is wired to surface the message).
 *
 * The "Worked outside tool" reason is selectable here too — analysts
 * can override with that reason directly from the modal, not only
 * via the worked-outside-tool shortcut button on the row detail.
 */

import { Dialog } from '@tensaw/design-system/overlays';
import { ActionForm } from '@tensaw/wired-components';
import { Button } from '@tensaw/design-system/primitives';
import { Select } from '@tensaw/design-system/forms';
import { Textarea } from '@tensaw/design-system/primitives';
import { Alert } from '@tensaw/design-system/feedback';
import { z } from 'zod';
import {
  CATEGORY_VALUES,
  OVERRIDE_REASON_COPY,
  OverrideRequestSchema,
  type OverrideReason,
  type OverrideRequest,
  type Classification,
  type StateTransitionResponse,
} from '../actions/schemas';

interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classification: Classification;
  onSuccess?: () => void;
}

const REASON_OPTIONS: { value: OverrideReason; label: string }[] = (
  Object.keys(OVERRIDE_REASON_COPY) as OverrideReason[]
).map((key) => ({ value: key, label: OVERRIDE_REASON_COPY[key].label }));

const CATEGORY_OPTIONS = CATEGORY_VALUES.map((v) => ({ value: v, label: v }));

export function OverrideModal({
  open,
  onOpenChange,
  classification,
  onSuccess,
}: OverrideModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Override classification"
      description={`Current: ${classification.primary_category}`}
      size="md"
    >
      <ActionForm<OverrideRequest & { classification_id: string }, StateTransitionResponse>
        actionId="denial.override"
        schema={OverrideRequestSchema.extend({
          classification_id: z.string().uuid(),
        })}
        defaultValues={{
          classification_id: classification.classification_id,
          reason: undefined,
          corrected_category: undefined,
          corrected_branch: undefined,
          notes: undefined,
        }}
        toastOnSuccess="Override recorded"
        onSuccess={() => {
          onSuccess?.();
          onOpenChange(false);
        }}
      >
        {(methods) => {
          const reason = methods.watch('reason');
          const correctedCategory = methods.watch('corrected_category');
          const reasonCopy = reason ? OVERRIDE_REASON_COPY[reason] : null;
          const requiresCategory = reasonCopy?.requiresCategory ?? false;
          const categoryMatchesCurrent =
            correctedCategory === classification.primary_category;

          return (
            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium text-foreground">
                Reason <span className="text-destructive">*</span>
              </label>
              <Select
                aria-label="Reason"
                value={reason ?? null}
                onValueChange={(v) =>
                  methods.setValue('reason', v as OverrideReason, {
                    shouldValidate: true,
                  })
                }
                options={REASON_OPTIONS}
                placeholder="Pick a reason…"
              />

              {reasonCopy ? (
                <Alert variant="info" tone="subtle">
                  {reasonCopy.description}
                </Alert>
              ) : null}

              {requiresCategory ? (
                <>
                  <label className="text-sm font-medium text-foreground">
                    Corrected category <span className="text-destructive">*</span>
                  </label>
                  <Select
                    aria-label="Corrected category"
                    value={correctedCategory ?? null}
                    onValueChange={(v) =>
                      methods.setValue('corrected_category', v, {
                        shouldValidate: true,
                      })
                    }
                    options={CATEGORY_OPTIONS}
                    placeholder="Pick the correct category…"
                    error={categoryMatchesCurrent}
                  />
                  {categoryMatchesCurrent ? (
                    <p className="text-xs text-destructive">
                      Pick a category different from the current one
                    </p>
                  ) : null}
                </>
              ) : null}

              <Textarea
                label="Notes (optional)"
                rows={3}
                placeholder="Context for the audit trail…"
                {...methods.register('notes')}
              />

              <div className="flex gap-2 justify-end pt-2 border-t border-tertiary">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !reason ||
                    (requiresCategory &&
                      (!correctedCategory || categoryMatchesCurrent))
                  }
                  loading={methods.formState.isSubmitting}
                >
                  Submit override
                </Button>
              </div>
            </div>
          );
        }}
      </ActionForm>
    </Dialog>
  );
}
