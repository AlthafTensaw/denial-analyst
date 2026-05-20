/**
 * AppLayout — outer chrome via platform AppShell + TopNav.
 *
 * TopNav gets a teal brand-header background + white text via className
 * override. TopNavItem active/hover colors are inverted for the dark bg.
 * Cost nav link gated by denial.view_cost permission.
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@tensaw/design-system/layout';
import { TopNav, TopNavItem, TopNavUserMenu } from '@tensaw/design-system/navigation';
import { useAuthStore } from '@tensaw/runtime';
import { usePermissions } from './auth/permissions';

export function AppLayout() {
  const { user, signOut } = useAuthStore();
  const { has } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isWorklist = location.pathname.startsWith('/worklist');
  const isCost = location.pathname.startsWith('/cost');

  const topNav = (
    <div
      style={{ background: '#fff', borderBottom: '1px solid var(--tw-color-border)' }}
      className="w-full"
    >
      <TopNav
        className="bg-transparent border-b-0"
        logo={
        <span
          className="flex items-center gap-2 font-semibold text-sm tracking-tight"
          style={{ color: 'var(--tw-color-text-primary)' }}
        >
          {/* Medical cross icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <rect width="20" height="20" rx="5" fill="rgba(20,125,122,0.14)" />
            <path
              d="M8 5h4v4h4v4h-4v4H8v-4H4V9h4V5z"
              fill="rgb(20,125,122)"
            />
          </svg>
          Tensaw — Denial Analysis
        </span>
      }
      primaryNav={
        <>
          <TopNavItem
            to="/worklist"
            active={isWorklist}
              className={
                isWorklist
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }
            >
            Worklist
          </TopNavItem>
          {has('denial.view_cost') && (
            <TopNavItem
              to="/cost"
              active={isCost}
              className={
                isCost
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }
            >
              Cost
            </TopNavItem>
          )}
        </>
      }
      utilityNav={
        user ? (
          <TopNavUserMenu
            user={{
              name: user.fullName,
              email: user.email,
            }}
            items={[
              {
                label: `Role: ${user.roles?.[0] ?? 'USER'}`,
                onSelect: () => { /* display only */ },
                disabled: true,
              },
              {
                label: 'Sign out',
                variant: 'destructive',
                onSelect: () => {
                  signOut();
                  navigate('/sign-in');
                },
              },
            ]}
          />
        ) : undefined
      }
      />
    </div>
  );

  return (
    <AppShell topNav={topNav}>
      <Outlet />
    </AppShell>
  );
}
