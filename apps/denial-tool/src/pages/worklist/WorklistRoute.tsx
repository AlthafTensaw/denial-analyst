/**
 * WorklistRoute — route wrapper.
 *
 * Thin layer between the router and the page so route-level setup
 * (data preload, telemetry, breadcrumbs) has a single home if needed
 * later.
 */

import { WorklistPage } from './WorklistPage';

export function WorklistRoute(): JSX.Element {
  return <WorklistPage />;
}
