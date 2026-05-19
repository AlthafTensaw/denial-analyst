/**
 * Top-level routes for the denial-tool app.
 *
 * Layout:
 *   /sign-in                (public)
 *   /                       → redirect to /worklist
 *   /worklist               (auth + denial.read)
 *   /cost                   (auth + denial.view_cost — manager/admin only)
 *
 * Permission gating done by RequireAuth / RequirePermission outlets.
 */

import { Navigate, Route, Routes, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequirePermission } from './auth/RequireAuth';
import { SignInPage } from './pages/sign-in/SignInPage';
import { WorklistRoute } from './pages/worklist/WorklistRoute';
import { CostRoute } from './pages/cost/CostRoute';

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/worklist" replace />} />
          <Route
            element={<RequirePermission permission="denial.read" />}
          >
            <Route path="/worklist" element={<WorklistRoute />} />
          </Route>
          <Route
            element={<RequirePermission permission="denial.view_cost" />}
          >
            <Route path="/cost" element={<CostRoute />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/worklist" replace />} />
    </Routes>
  );
}

const router = createBrowserRouter([
  {
    path: '*',
    element: <AppRoutes />,
  },
]);

export function AppRouter(): JSX.Element {
  return <RouterProvider router={router} />;
}
