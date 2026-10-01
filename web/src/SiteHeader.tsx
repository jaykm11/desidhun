import { useEffect, useState } from 'react';
import { SignInAbortedError, useAuth } from './auth/AuthProvider';
import { getEntitlement, type Entitlement } from './lib/api';

function remainingLabel(count: number, unit: 'prompt' | 'vocal' | 'song'): string {
  const plural = count === 1 ? unit : `${unit}s`;
  return `${count} ${plural}`;
}

function entitlementStatus(entitlement: Entitlement): string {
  if (entitlement.isAdmin) return 'Administrator · unlimited prompts, vocals, and songs';

  const purchased = entitlement.purchasedPromptCredits ?? 0;
  const purchasedSongs = entitlement.purchasedSongCredits ?? 0;
  const purchasedVocals = entitlement.purchasedVocalCredits ?? 0;
  if (entitlement.isPaid) {
    const membership = entitlement.subscriptionCreditsRemaining;
    const songs = entitlement.subscriptionSongCreditsRemaining;
    const vocals = entitlement.subscriptionVocalCreditsRemaining;
    const planName = entitlement.plan.charAt(0).toUpperCase() + entitlement.plan.slice(1);
    const parts = [`${planName} membership active`];
    if (membership != null) parts.push(remainingLabel(membership, 'prompt'));
    if (vocals != null) parts.push(`${remainingLabel(vocals, 'vocal')} left`);
    if (songs != null) parts.push(remainingLabel(songs, 'song'));
    if (purchased > 0 || purchasedVocals > 0 || purchasedSongs > 0) {
      parts.push(`pack: ${purchased} prompts, ${purchasedVocals} vocals, ${purchasedSongs} songs`);
    }
    return parts.join(' · ');
  }

  const free = entitlement.freePromptsRemaining ?? 0;
  const freeSongs = entitlement.freeSongsRemaining ?? 0;
  const freeVocals = entitlement.freeVocalsRemaining ?? 0;
  if (purchased > 0 || purchasedSongs > 0 || purchasedVocals > 0) {
    return `${free} free prompts + ${purchased} pack · ${freeVocals} free vocals + ${purchasedVocals} pack · ${freeSongs} free songs + ${purchasedSongs} pack`;
  }
  return `${free} free prompts · ${remainingLabel(freeVocals, 'vocal')} left · ${freeSongs} free ${freeSongs === 1 ? 'song' : 'songs'} remaining`;
}

export function SiteHeader() {
  const { isConfigured, isLoading, user, signInWithGoogle, signOutUser } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let lastLoadedAt = 0;
    const load = () => {
      lastLoadedAt = Date.now();
      void getEntitlement(user)
        .then(({ entitlement: next }) => {
          if (!cancelled) setEntitlement(next);
        })
        .catch(() => {
          if (!cancelled) setEntitlement(null);
        });
    };
    load();
    const onFocus = () => {
      if (Date.now() - lastLoadedAt > 60_000) load();
    };
    const onRefresh = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('desidhun:entitlement', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('desidhun:entitlement', onRefresh);
    };
  }, [user]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('.account-menu-wrap')) return;
      setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [accountMenuOpen]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      if (error instanceof SignInAbortedError) return;
      setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.');
    }
  };

  return (
    <header className="header site-header">
      <a className="logo-link" href="/" aria-label="Desi Dhun home">
        <img src="/logo.png" alt="Desi Dhun logo" className="logo" />
      </a>
      <div className="header-inner">
        <div className="brand-line">
          <h1>
            <span className="hi">देसी धुन</span> <span className="en">Desi Dhun</span>
          </h1>
          <span className="studio-stamp">AI RAGA STUDIO</span>
        </div>
      </div>
      <aside className="header-account">
        <div className="header-account-row">
          {isLoading ? (
            <span className="account-muted">Checking account…</span>
          ) : user ? (
            <div className="account-menu-wrap">
              <button
                className="account-menu-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
                  : <span className="avatar avatar-fallback">{(user.displayName ?? user.email ?? 'U').charAt(0)}</span>}
                <span>{user.displayName ?? user.email}</span>
                <span className="account-caret" aria-hidden="true">⌄</span>
              </button>
              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <strong>{user.displayName ?? user.email}</strong>
                  <span className="account-menu-status">
                    {entitlement ? entitlementStatus(entitlement) : 'Checking prompt allowance…'}
                  </span>
                  <button
                    className="account-menu-item signout-item"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void signOutUser();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : isConfigured ? (
            <button className="google-button" onClick={() => void handleGoogleSignIn()}>
              <span className="google-mark" aria-hidden="true">G</span>
              Continue with Google
            </button>
          ) : (
            <span className="account-muted">Google sign-in will be enabled during GCP setup.</span>
          )}
        </div>
        {authError && <p className="auth-error" role="alert">{authError}</p>}
        <p className="header-tagline">FASTEST AND MOST ADVANCED AUDIO GENERATION</p>
      </aside>
    </header>
  );
}
