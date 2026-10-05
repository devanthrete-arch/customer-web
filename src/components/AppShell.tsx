import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import { ApiError, autoflex, profileComplete, type Profile } from '../lib/api';
import { getAccessToken } from '../lib/session';
import { LogoMark } from './LogoLockup';

const SIDE_NAV = [
  { to: '/home', label: 'Home', end: true },
  { to: '/vehicles', label: 'Vehicles', end: false },
  { to: '/services', label: 'Services', end: false },
  { to: '/documents', label: 'Documents', end: true },
  { to: '/maintenance', label: 'Maintenance', end: true },
  { to: '/history', label: 'Service history', end: true },
  { to: '/payments', label: 'Payments', end: true },
  { to: '/support', label: 'Support', end: true },
  { to: '/profile', label: 'Profile', end: true },
];

const MOBILE_NAV = [
  { to: '/home', label: 'Home', end: true },
  { to: '/vehicles', label: 'Vehicles', end: false },
  { to: '/services', label: 'Services', end: false },
  { to: '/notifications', label: 'Activity', end: true },
  { to: '/profile', label: 'Profile', end: false },
];

export function AppShell() {
  const { state } = useDomain();
  return (
    <div className="af-app">
      <aside className="af-side">
        <Link className="af-side-brand" to="/home">
          <LogoMark decorative className="af-logo af-logo-nav" />
          <span>Autoflex</span>
        </Link>
        <nav aria-label="Primary">
          {SIDE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'on' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="af-app-main">
        <Outlet />
      </div>
      <nav className="af-nav" aria-label="Primary">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'on' : undefined)}
          >
            {item.label}
            {item.to === '/notifications' && state.unreadCount ? ` (${state.unreadCount})` : ''}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function RequireProfile({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'ok' | 'setup'>('loading');

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    void autoflex<Profile>('/v1/me/profile', {}, true)
      .then((profile) => {
        if (cancelled) return;
        setState(profileComplete(profile) ? 'ok' : 'setup');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setState('setup');
        else navigate('/auth/sign-in', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!getAccessToken()) return <Navigate to="/auth/sign-in" replace />;
  if (state === 'loading') {
    return (
      <section className="af-screen">
        <p className="af-hint">Loading…</p>
      </section>
    );
  }
  if (state === 'setup') return <Navigate to="/profile/setup" replace />;
  return children;
}
