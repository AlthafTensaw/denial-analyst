# Root `eslint.config.js` patch

Append the block below to the array passed to `tseslint.config(...)` in
the repo-root `eslint.config.js`. It imports the local plugin and applies
the `no-raw-phi` rule only to denial-tool source files so existing apps
aren't affected.

```diff
 import eslint from '@eslint/js';
 import tseslint from 'typescript-eslint';
 import reactPlugin from 'eslint-plugin-react';
 import reactHooksPlugin from 'eslint-plugin-react-hooks';
 import prettierConfig from 'eslint-config-prettier';
+import denialPhiPlugin from './apps/denial-tool/eslint-plugins/no-raw-phi.js';

 export default tseslint.config(
   ...existing blocks...
+  // Denial-tool-only: PHI rendering must go through <PrivacyField>.
+  // Promotes to @tensaw/platform-rules per handback list #3.
+  {
+    files: ['apps/denial-tool/src/**/*.{ts,tsx}'],
+    plugins: {
+      'denial-tool-phi': denialPhiPlugin,
+    },
+    rules: {
+      'denial-tool-phi/no-raw-phi': 'error',
+    },
+  },
 );
```

Verification:

```bash
pnpm --filter @tensaw/app-denial-tool lint
```

Should pass cleanly against the PR-3 codebase. The current `RowDetailPanel`
already wraps `reason_text` in `<PrivacyField>`; if anyone regresses,
the rule catches it before review.

A quick smoke test — temporarily replace `<PrivacyField value={remark.reason_text} ... />`
with `<span>{remark.reason_text}</span>` in `RowDetailPanel.tsx` and rerun
`pnpm lint`. Should emit:

```
src/components/RowDetailPanel.tsx
  173:24  error  PHI field 'reason_text' must be rendered through <PrivacyField>, not directly in JSX. See tech spec §6.8.  denial-tool-phi/no-raw-phi
```

Then revert.
