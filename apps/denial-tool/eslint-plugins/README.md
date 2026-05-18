# denial-tool eslint plugins

Local ESLint plugins specific to the denial tool. Lives in the app for
now; targeted for promotion to `@tensaw/platform-rules` per the platform
handback list (item #3).

## Rules

### `no-raw-phi`

Flags PHI field accesses (`reason_text`, `denial_reason`, `mrn`, …)
rendered inside JSX without `<PrivacyField>` wrapping. Tech spec §6.8 +
§6.9 acceptance criterion #5.

**Default PHI field list:**

```
reason_text         denial_reason
patient_first_name  patient_last_name   patient_full_name
mrn                 dob                 ssn
subscriber_id
```

**Options:**

```jsonc
{
  "denial-tool-phi/no-raw-phi": [
    "error",
    {
      // Add fields beyond the defaults
      "phiFields": ["reason_text", "denial_reason", "medication_name"],

      // Override the wrapper component name (default "PrivacyField")
      "wrapperComponentName": "PrivacyField",

      // Override which prop is treated as the safe channel (default "value")
      "wrapperValueAttr": "value"
    }
  ]
}
```

**Why a custom rule + not just a code review item:** PHI leaks are a
HIPAA reportable event; lint catches them before review. The pattern
also generalizes — once we have a Tenant Admin permission surface,
similar rules will protect tenant credentials, card numbers, etc.

## Wiring

The plugin is imported by the repo-root `eslint.config.js` and applied
to denial-tool source via a scoped config block. See
`apps/denial-tool/eslint.config.patch.md` for the diff.

## Promoting to `@tensaw/platform-rules`

When the platform package gets its Phase 8 implementation, lift `no-raw-phi.js`
verbatim and re-export it from `packages/platform-rules/src/rules/no-raw-phi.ts`
(rename the file but keep the rule code as-is; JSDoc types port cleanly
into a `.ts` module). Update `apps/denial-tool/eslint.config.js` to
import from `@tensaw/platform-rules` instead of `./eslint-plugins/`.
