import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppShell } from './AppShell.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { LibraryPlayerProvider } from './LibraryPlayer.tsx'
import { LegalPage, legalPageForPath } from './LegalPage.tsx'
import SandboxPaymentPage from './SandboxPaymentPage.tsx'
import AboutPage from './AboutPage.tsx'
import AccountPage from './AccountPage.tsx'
import MembershipPage from './MembershipPage.tsx'
import CommunityPage from './CommunityPage.tsx'
import ExplorePage from './ExplorePage.tsx'
import ShareSongPage from './ShareSongPage.tsx'
import PresetsPage from './PresetsPage.tsx'
import AdminPage from './AdminPage.tsx'
import PaymentResultPage from './PaymentResultPage.tsx'
import { NavigationProvider, useLocation } from './navigation.tsx'

function ShellPage() {
  const { pathname, search } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  const legalPage = legalPageForPath(pathname);
  let page: ReactNode;
  if (legalPage) page = <LegalPage page={legalPage} />;
  else if (/^\/s\/[^/]+\/?$/.test(pathname)) page = <ShareSongPage />;
  else if (path === '/membership') page = <MembershipPage />;
  else if (path === '/about') page = <AboutPage />;
  else if (path === '/account') page = <AccountPage />;
  else if (path === '/explore') page = <ExplorePage />;
  else if (path === '/presets') page = <PresetsPage />;
  else if (path === '/admin') page = <AdminPage />;
  else if (path === '/community') page = <CommunityPage />;
  else if (path === '/sandbox-payment') page = <SandboxPaymentPage />;
  else if (path === '/payment-result') page = <PaymentResultPage />;
  else page = <App />;
  return <div key={`${pathname}${search}`}>{page}</div>;
}

function Shell() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  const landingPage = path === '/' && !legalPageForPath(pathname);
  return (
    <AppShell isLanding={landingPage}>
      <ShellPage />
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NavigationProvider>
        <LibraryPlayerProvider>
          <Shell />
        </LibraryPlayerProvider>
      </NavigationProvider>
    </AuthProvider>
  </StrictMode>,
)
