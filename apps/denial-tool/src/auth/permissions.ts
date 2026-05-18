/**
 * Denial Tool — permission resolver.
 *
 * Maps Cognito role groups → denial-tool permission strings. The action
 * dispatcher checks `useAuthStore.getState().user.permissions` against
 * each action's `permission` field; sign-in flow populates this list
 * from the JWT's role groups.
 *
 * Backend's expected Cognito group conventions (per handoff doc):
 *   - Role groups (one per user, pick most-privileged): ANALYST, MANAGER, ADMIN
 *   - Clinic groups: CLINIC_<id> (e.g., CLINIC_1001) — drives backend's
 *     row-level scoping. Not interpreted on the FE; passed through in the JWT.
 *
 * Permissions on the FE:
 *   - denial.read              : worklist + detail + cost surface visibility
 *   - denial.act               : accept / override / complete / bulk-accept
 *   - denial.classify_claim    : POST /v1/claims/{id}/classify (D-18: manager+)
 *   - denial.view_cost         : GET /v1/cost/daily (manager+)
 *
 * Permission resolution:
 *   ANALYST  → denial.read, denial.act
 *   MANAGER  → denial.read, denial.act, denial.classify_claim, denial.view_cost
 *   ADMIN    → all
 */

export const ALL_ROLES = ['ANALYST', 'MANAGER', 'ADMIN'] as const;
export type Role = (typeof ALL_ROLES)[number];

export const ALL_PERMISSIONS = [
  'denial.read',
  'denial.act',
  'denial.classify_claim',
  'denial.view_cost',
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ANALYST: ['denial.read', 'denial.act'],
  MANAGER: [
    'denial.read',
    'denial.act',
    'denial.classify_claim',
    'denial.view_cost',
  ],
  ADMIN: [
    'denial.read',
    'denial.act',
    'denial.classify_claim',
    'denial.view_cost',
  ],
};

export function resolvePermissions(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) set.add(perm);
  }
  return Array.from(set);
}

/**
 * Parse the role from a list of Cognito groups. Picks the most-
 * privileged role when multiple are present. Defaults to null (no role)
 * so the user falls through to the "insufficient access" surface.
 */
export function pickHighestRole(cognitoGroups: readonly string[]): Role | null {
  const groups = new Set(cognitoGroups);
  if (groups.has('ADMIN')) return 'ADMIN';
  if (groups.has('MANAGER')) return 'MANAGER';
  if (groups.has('ANALYST')) return 'ANALYST';
  return null;
}

/**
 * Extract clinic ids from Cognito groups. `CLINIC_1001` → 1001.
 * Not used to gate UI (the backend handles row scoping), but exposed
 * for display ("Showing claims for clinic 1001, 1002") and any future
 * client-side filter affordance.
 */
export function extractClinicIds(
  cognitoGroups: readonly string[],
): number[] {
  const out: number[] = [];
  for (const g of cognitoGroups) {
    const m = /^CLINIC_(\d+)$/.exec(g);
    if (m) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}
