/**
 * AppLayout — shell with header + nav.
 *
 * The header surfaces:
 *   - App title + breadcrumb
 *   - Nav links: Worklist / Cost (Cost shown only when user has denial.view_cost)
 *   - User identity badge
 *   - Sign-out
 */

import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@tensaw/runtime';

export function AppLayout(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const canViewCost = user?.permissions?.includes('denial.view_cost') ?? false;

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <span style={brandStyle}>Tensaw</span>
        <span style={crumbsStyle}>· Denial Analysis</span>

        <nav style={navStyle}>
          <NavLink to="/worklist" style={navLinkStyle}>
            {({ isActive }: { isActive: boolean }) => (
              <span
                style={{
                  ...navLinkInnerStyle,
                  color: isActive
                    ? 'var(--tw-color-brand-header)'
                    : 'var(--tw-color-text-secondary)',
                  borderBottomColor: isActive
                    ? 'var(--tw-color-brand-primary)'
                    : 'transparent',
                }}
              >
                Worklist
              </span>
            )}
          </NavLink>
          {canViewCost && (
            <NavLink to="/cost" style={navLinkStyle}>
              {({ isActive }: { isActive: boolean }) => (
                <span
                  style={{
                    ...navLinkInnerStyle,
                    color: isActive
                      ? 'var(--tw-color-brand-header)'
                      : 'var(--tw-color-text-secondary)',
                    borderBottomColor: isActive
                      ? 'var(--tw-color-brand-primary)'
                      : 'transparent',
                  }}
                >
                  Cost
                </span>
              )}
            </NavLink>
          )}
        </nav>

        <div style={userBadgeStyle}>
          {user && (
            <>
              <span>{user.email}</span>
              <span style={roleStyle}>{user.roles?.join('/')}</span>
              <button type="button" onClick={signOut} style={signOutBtnStyle}>
                Sign out
              </button>
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--tw-color-surface-bg)',
};

const headerStyle: React.CSSProperties = {
  height: 44,
  background: 'white',
  borderBottom: '1px solid var(--tw-color-border-default)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 20px',
  gap: 8,
};

const brandStyle: React.CSSProperties = {
  fontWeight: 500,
  color: 'var(--tw-color-brand-header)',
};

const crumbsStyle: React.CSSProperties = {
  color: 'var(--tw-color-text-muted)',
  fontSize: '0.875rem',
  marginRight: 24,
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  height: '100%',
  alignItems: 'stretch',
};

const navLinkStyle = { textDecoration: 'none' };

const navLinkInnerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  height: '100%',
  fontSize: '0.875rem',
  fontWeight: 500,
  borderBottom: '2px solid transparent',
};

const userBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: '0.8125rem',
  color: 'var(--tw-color-text-muted)',
};

const roleStyle: React.CSSProperties = {
  padding: '2px 8px',
  background: 'var(--tw-color-input-disabled-bg)',
  borderRadius: 4,
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'var(--tw-color-text-primary)',
};

const signOutBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--tw-color-brand-header)',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  textDecoration: 'underline',
};
