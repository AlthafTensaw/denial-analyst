# PR-3 package.json patch

Apply the following diff to `apps/denial-tool/package.json`. New runtime
dep `uuid` is used by the bulk-action bar to generate idempotency keys.
Adds `@playwright/test` to devDependencies + an `e2e` script.

```diff
   "dependencies": {
     ...existing...
+    "uuid": "^9.0.1",
     ...existing...
   },
   "devDependencies": {
     ...existing...
+    "@playwright/test": "^1.49.0",
+    "@types/uuid": "^9.0.8",
     ...existing...
   },
   "scripts": {
     ...existing...
+    "e2e": "playwright test"
   }
```

After patching, run `pnpm install` to lock the new deps.
