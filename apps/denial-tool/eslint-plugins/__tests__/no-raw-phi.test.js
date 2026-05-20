// @ts-check
/**
 * no-raw-phi rule tests.
 *
 * Uses the built-in ESLint RuleTester. Covers:
 *   - Direct JSX text expression: <span>{x.reason_text}</span>          → INVALID
 *   - Direct attribute pass-through (title, aria-label, …)              → INVALID
 *   - Nested in array.map callbacks                                     → INVALID
 *   - Wrapped in <PrivacyField value={...}>                             → VALID
 *   - Bound to a const used outside JSX                                 → VALID
 *   - Property access that isn't a PHI field                            → VALID
 *   - Custom wrapper name + custom phiFields option                     → exercised
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import plugin, { noRawPhi } from '../no-raw-phi.js';

// Wire vitest as the test backend for RuleTester so output integrates
// with the rest of the denial-tool test runs.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('no-raw-phi', () => {
  ruleTester.run('no-raw-phi', noRawPhi, {
    valid: [
      {
        name: 'wrapped in PrivacyField',
        code: `
          function C({ remark, id }) {
            return <PrivacyField value={remark.reason_text} recommendationId={id} fieldPath="x" />;
          }
        `,
      },
      {
        name: 'PHI bound to a local used outside JSX',
        code: `
          function log(remark) {
            const text = remark.reason_text;
            send(text);
            return null;
          }
        `,
      },
      {
        name: 'unrelated property access',
        code: `
          function C({ row }) {
            return <span>{row.payer}</span>;
          }
        `,
      },
      {
        name: 'PrivacyField with computed value expression',
        code: `
          function C({ event }) {
            return <PrivacyField value={event.remark_codes[0].reason_text} recommendationId={1} fieldPath="x" />;
          }
        `,
      },
      {
        name: 'custom wrapper name honored',
        code: `
          function C({ p }) { return <MaskedText value={p.denial_reason} />; }
        `,
        options: [{ wrapperComponentName: 'MaskedText' }],
      },
    ],

    invalid: [
      {
        name: 'raw render of reason_text in element body',
        code: `
          function C({ remark }) {
            return <span>{remark.reason_text}</span>;
          }
        `,
        errors: [
          {
            messageId: 'rawPhi',
            data: { path: 'reason_text' },
          },
        ],
      },
      {
        name: 'PHI in title attribute',
        code: `
          function C({ denial }) {
            return <div title={denial.denial_reason} />;
          }
        `,
        errors: [{ messageId: 'rawPhi', data: { path: 'denial_reason' } }],
      },
      {
        name: 'PHI in aria-label',
        code: `
          function C({ patient }) {
            return <button aria-label={patient.patient_first_name} />;
          }
        `,
        errors: [
          { messageId: 'rawPhi', data: { path: 'patient_first_name' } },
        ],
      },
      {
        name: 'PHI inside array.map callback rendering JSX',
        code: `
          function C({ events }) {
            return (
              <ul>
                {events.map(e => <li key={e.id}>{e.remark_codes[0].reason_text}</li>)}
              </ul>
            );
          }
        `,
        errors: [{ messageId: 'rawPhi', data: { path: 'reason_text' } }],
      },
      {
        name: 'PHI passed as non-value prop to PrivacyField',
        code: `
          function C({ remark }) {
            return <PrivacyField label={remark.reason_text} value="masked" recommendationId={1} fieldPath="x" />;
          }
        `,
        errors: [{ messageId: 'rawPhi', data: { path: 'reason_text' } }],
      },
      {
        name: 'multiple PHI accesses in one JSX block report individually',
        code: `
          function C({ p }) {
            return <div>{p.patient_first_name} {p.patient_last_name}</div>;
          }
        `,
        errors: [
          { messageId: 'rawPhi', data: { path: 'patient_first_name' } },
          { messageId: 'rawPhi', data: { path: 'patient_last_name' } },
        ],
      },
      {
        name: 'custom phiFields option flags configured field',
        code: `
          function C({ p }) { return <span>{p.medication_name}</span>; }
        `,
        options: [{ phiFields: ['medication_name'] }],
        errors: [{ messageId: 'rawPhi', data: { path: 'medication_name' } }],
      },
    ],
  });

  it('plugin default export exposes the rule', () => {
    if (plugin.rules['no-raw-phi'] !== noRawPhi) {
      throw new Error('plugin.rules["no-raw-phi"] does not match named export');
    }
  });
});
