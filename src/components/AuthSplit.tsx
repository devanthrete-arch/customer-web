import type { ReactNode } from 'react';
import { LogoMark } from './LogoLockup';

export function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="af-auth-layout">
      <aside className="af-auth-brand">
        <LogoMark className="af-logo af-logo-hero" />
        <p className="af-auth-word">Autoflex</p>
        <p className="af-auth-tag">Care you can trust</p>
      </aside>
      {children}
    </div>
  );
}
