import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import { ApiError, autoflex, profileComplete, type Profile } from '../lib/api';
import { getAccessToken } from '../lib/session';
import { Icon, type IconName } from './Icons';
import { LogoMark } from './LogoLockup';

const SIDE_NAV: { to: string; label: string; end: boolean; icon: IconName }[] = [
  { to: '/home', label: 'Home', end: true, icon: 'home' },
  { to: '/vehicles', label: 'Vehicles', end: false, icon: 'vehicle' },
  { to: '/services', label: 'Services', end: false, icon: 'wrench' },
  { to: '/documents', label: 'Documents', end: true, icon: 'file' },
  { to: '/maintenance', label: 'Maintenance', end: true, icon: 'calendar' },
  { to: '/history', label: 'Service history', end: true, icon: 'history' },
  { to: '/payments', label: 'Payments', end: true, icon: 'card' },
  { to: '/support', label: 'Support', end: true, icon: 'support' },
  { to: '/profile', label: 'Profile', end: true, icon: 'user' },
];

const MOBILE_NAV: { to: string; label: string; end: boolean; icon: IconName }[] = [
  { to: '/home', label: 'Home', end: true, icon: 'home' },
  { to: '/vehicles', label: 'Vehicles', end: false, icon: 'vehicle' },
  { to: '/services', label: 'Services', end: false, icon: 'wrench' },
  { to: '/notifications', label: 'Activity', end: true, icon: 'bell' },
  { to: '/profile', label: 'Profile', end: false, icon: 'user' },
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
              <Icon name={item.icon} />
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
            <Icon name={item.icon} />
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
