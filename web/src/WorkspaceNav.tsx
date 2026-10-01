import { useAuth } from './auth/AuthProvider';
import { useIsAdmin } from './lib/useIsAdmin';

const TABS = [
  { id: 'generate', label: 'Generate', href: '/' },
  { id: 'explore', label: 'Explore', href: '/explore' },
  { id: 'presets', label: 'Presets', href: '/presets' },
  { id: 'membership', label: 'Membership', href: '/membership' },
  { id: 'account', label: 'Account', href: '/account' },
  { id: 'admin', label: 'Admin', href: '/admin' },
] as const;

function activeTabId(pathname: string): (typeof TABS)[number]['id'] {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/explore' || path.startsWith('/community')) return 'explore';
  if (path === '/presets') return 'presets';
  if (path === '/membership') return 'membership';
  if (path === '/account') return 'account';
  if (path === '/admin') return 'admin';
  return 'generate';
}

export function WorkspaceNav() {
  const active = activeTabId(window.location.pathname);
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user);

  return (
    <nav className="workspace-nav" aria-label="Workspace">
      {TABS.filter((tab) => tab.id !== 'admin' || isAdmin).map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          className={`workspace-nav-tab${active === tab.id ? ' active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
