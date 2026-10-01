import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { ApiError, getAccountDetails, type AccountDetails } from './lib/api';

function title(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

function amount(value: number | undefined): string {
  return value == null ? '' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}

export default function AccountPage() {
  const { user, isLoading, signInWithGoogle } = useAuth();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setError(null);
    void getAccountDetails(user)
      .then(setAccount)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Could not load your account.'));
  }, [user]);

  return (
    <main className="legal-page account-page">
      <p className="workflow-step">ACCOUNT</p>
      {isLoading ? <p>Loading account…</p> : !user ? (
        <button className="google-button" onClick={() => void signInWithGoogle()}>Sign in to view your account</button>
      ) : error ? <p className="compose-error">{error}</p> : !account ? <p>Loading membership details…</p> : (
        <>
          <section className="account-summary">
            <div>
              <span>Name</span>
              <strong>{account.name ?? '—'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{account.email ?? '—'}</strong>
            </div>
            <div>
              <span>Membership</span>
              <strong>{title(account.membership.plan)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{title(account.membership.status)}</strong>
            </div>
            <div>
              <span>Membership duration</span>
              <strong>{account.membership.periodEnd ? `Through ${date(account.membership.periodEnd)}` : 'No active membership period'}</strong>
            </div>
            <div className="account-summary-spacer" aria-hidden="true" />
          </section>
          <section>
            <h2>Membership and payment history</h2>
            {account.history.length === 0 ? <p>No payment or membership history is available yet.</p> : (
              <div className="account-history">
                {account.history.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.category === 'payment' ? 'Payment' : 'Membership'} · {title(entry.offerId)}</strong>
                      <span>{title(entry.status)} · {entry.provider === 'payu' ? 'PayU' : 'Stripe'}</span>
                      {entry.reference && <small>Reference: {entry.reference}</small>}
                    </div>
                    <div className="account-history-date">
                      <strong>{amount(entry.amountPaise)}</strong>
                      <span>{date(entry.occurredAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
