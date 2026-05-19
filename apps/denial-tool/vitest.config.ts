import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, '**/playwright/**'],
    // Integration tests import the full app graph (runtime → composition →
    // worklist → page). First-import compile is slow under jsdom; patient
    // hit 15s on cold start. Mirroring.
    testTimeout: 15000,
  },
});
