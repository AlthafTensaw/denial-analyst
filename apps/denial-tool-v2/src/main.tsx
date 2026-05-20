import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@tensaw/runtime';
import { ToastHost } from '@tensaw/wired-components';
import '@tensaw/design-system/styles/global.css';
import './theme-compat.css';

import { AppThemeProvider } from './AppTheme';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { bootstrap } from './bootstrap';

/**
 * Denial Analysis Tool entry point. Mirrors apps/operations-console/main.tsx.
 *
 * Composition primitives chosen by what the screen actually needs:
 *   - <SurfaceHost> NOT mounted — denial-tool modals (BulkOverrideModal,
 *     SingleOverrideModal, RunClassifierNowButton confirm) are local React
 *     state. Matches ops-console pattern.
 *   - <DirtyStateGuard> NOT mounted — D-04 makes the row-detail action
 *     plan display-only; there are no edit-in-place fields anywhere on
 *     the worklist to guard.
 *   - <ToastHost> mounted for action-error toasts (RFC 7807 surfacing)
 *     and partial-success bulk-accept messaging (Q #11 resolution).
 *
 * bootstrap() fires-and-forgets: it registers actions and starts MSW in
 * dev. The router-level auth gate + page-query suspension give it enough
 * time to settle before any action dispatches.
 */
void bootstrap();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <ToastHost />
      </AppThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
