import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Denial Analysis Tool — Vite config.
 *
 * Mirrors apps/patient (production-grade Cognito-from-day-one) rather than
 * operations-console (mocked sign-in). Tech spec §16.1 requires Cognito
 * JWT on every API call from day one.
 *
 * Env validation: dev mode is permissive (placeholder .env.local works for
 * MSW-only development); production builds fail fast on any missing key.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (mode !== 'test') {
    const required = [
      'VITE_API_BASE_URL',
      'VITE_COGNITO_REGION',
      'VITE_COGNITO_USER_POOL_ID',
      'VITE_COGNITO_CLIENT_ID',
      'VITE_APP_ID',
      'VITE_BUILD_VERSION',
      // Required by @tensaw/runtime's config schema even though we have
      // no billing surface. See README.md "Platform handback list" #2.
      'VITE_STRIPE_PUBLISHABLE_KEY',
    ];
    const missing = required.filter((k) => !env[k]);
    if (missing.length > 0 && mode === 'production') {
      throw new Error(
        `Missing required env vars for production build: ${missing.join(', ')}. ` +
          `Copy .env.example to .env.local and fill in values.`,
      );
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5175,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      outDir: 'dist',
    },
  };
});
