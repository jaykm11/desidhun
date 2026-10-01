import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthProvider';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { WorkspaceNav } from './WorkspaceNav';

export function AppShell({ children, isLanding = false }: { children: ReactNode; isLanding?: boolean }) {
  const { isLoading, user } = useAuth();
  const hideHeader = isLanding && !isLoading && !user;

  return (
    <div className="app app-shell">
      {!hideHeader && <SiteHeader />}
      <div className={`app-shell-body${user ? '' : ' no-nav'}`}>
        {user && <WorkspaceNav />}
        <div className="app-shell-main">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
