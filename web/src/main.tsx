import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppShell } from './AppShell.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
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

const legalPage = legalPageForPath(window.location.pathname);
const shareSongPage = /^\/s\/[^/]+\/?$/.test(window.location.pathname);
const sandboxPaymentPage = window.location.pathname.replace(/\/+$/, '') === '/sandbox-payment';
const aboutPage = window.location.pathname.replace(/\/+$/, '') === '/about';
const accountPage = window.location.pathname.replace(/\/+$/, '') === '/account';
const membershipPage = window.location.pathname.replace(/\/+$/, '') === '/membership';
const communityPage = window.location.pathname.replace(/\/+$/, '') === '/community';
const explorePage = window.location.pathname.replace(/\/+$/, '') === '/explore';
const presetsPage = window.location.pathname.replace(/\/+$/, '') === '/presets';
const adminPage = window.location.pathname.replace(/\/+$/, '') === '/admin';
const paymentResultPage = window.location.pathname.replace(/\/+$/, '') === '/payment-result';

const landingPage = !legalPage && !shareSongPage && !membershipPage && !aboutPage && !accountPage
  && !explorePage && !presetsPage && !adminPage && !communityPage && !sandboxPaymentPage && !paymentResultPage;

function shellPage() {
  if (legalPage) return <LegalPage page={legalPage} />;
  if (shareSongPage) return <ShareSongPage />;
  if (membershipPage) return <MembershipPage />;
  if (aboutPage) return <AboutPage />;
  if (accountPage) return <AccountPage />;
  if (explorePage) return <ExplorePage />;
  if (presetsPage) return <PresetsPage />;
  if (adminPage) return <AdminPage />;
  if (communityPage) return <CommunityPage />;
  if (sandboxPaymentPage) return <SandboxPaymentPage />;
  if (paymentResultPage) return <PaymentResultPage />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppShell isLanding={landingPage}>
        {shellPage()}
      </AppShell>
    </AuthProvider>
  </StrictMode>,
)
