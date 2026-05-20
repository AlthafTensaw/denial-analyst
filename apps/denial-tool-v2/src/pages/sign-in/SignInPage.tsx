/**
 * SignInPage — mock sign-in for dev + tests.
 *
 * Real auth lands later via Cognito Hosted UI or a custom screen against
 * the configured user pool. For now: a role picker that calls
 * useAuthStore.signIn() with mock identity + the resolved permissions
 * for the chosen role.
 *
 * The dispatcher's permission gate works identically against either
 * source — `user.permissions[]` is the only contract.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@tensaw/runtime';
import {
  ALL_ROLES,
  resolvePermissions,
  type Role,
} from '../../auth/permissions';

export function SignInPage(): JSX.Element {
  const [role, setRole] = useState<Role>('ANALYST');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = () => {
    const fullName =
      role === 'ANALYST' ? 'Renita K.' : role === 'MANAGER' ? 'Roopa M.' : 'Vijaya R.';
    const clinicIds = ['1001'];

    signIn({
      user: {
        userId: `mock-${role.toLowerCase()}-sub`,
        username: role.toLowerCase(),
        email: `${role.toLowerCase()}@primrose.dev`,
        fullName,
        roles: [role],
        permissions: resolvePermissions([role]),
        clinicIds,
      },
      clinicId: clinicIds[0],
    });
    const next = params.get('next') ?? '/worklist';
    navigate(next, { replace: true });
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Tensaw — Denial Analysis</h1>
        <p style={subtitleStyle}>
          Mock sign-in (development). Production uses Cognito Hosted UI.
        </p>

        <label style={labelStyle}>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={selectStyle}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div style={permsHintStyle}>
          Grants: {resolvePermissions([role]).join(', ')}
        </div>

        <button type="button" onClick={handleSubmit} style={buttonStyle}>
          Sign in as {role}
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--tw-color-page-background, #FAFAFB)',
};

const cardStyle: React.CSSProperties = {
  width: 380,
  padding: 28,
  background: 'white',
  borderRadius: 12,
  border: '1px solid var(--tw-color-border)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 500,
  color: 'var(--tw-color-teal-700)',
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  color: 'var(--tw-color-text-muted)',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.875rem',
  fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--tw-color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
};

const permsHintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--tw-color-text-muted)',
  fontFamily: 'ui-monospace, monospace',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'var(--tw-color-teal-600)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
};
