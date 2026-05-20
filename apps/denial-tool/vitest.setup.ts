import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import {
  buildDenialHandlers,
  resetMockDenialState,
} from '@tensaw/mock-server';

/**
 * Denial Tool — Vitest setup.
 *
 * Stub env vars BEFORE any module loads. The @tensaw/runtime config is
 * imported transitively whenever a test imports a page or action, and it
 * eagerly reads import.meta.env. Without these stubs, runtime startup
 * validation throws.
 *
 * MSW node-server wired against the denial handlers from @tensaw/mock-server.
 * State is reset after each test so test isolation is preserved.
 */
vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.tensaw.local');
vi.stubEnv('VITE_COGNITO_REGION', 'us-east-1');
vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_test');
vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'test-client-id');
vi.stubEnv('VITE_APP_ID', 'denial-tool-test');
vi.stubEnv('VITE_BUILD_VERSION', '0.0.0-test');
vi.stubEnv(
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'pk_test_unused_runtime_validation_only',
);

const server = setupServer(
  ...buildDenialHandlers('https://api.test.tensaw.local'),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDenialState();
});

afterAll(() => {
  server.close();
});
