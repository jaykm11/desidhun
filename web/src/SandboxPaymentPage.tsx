import { useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { ApiError, startPayUTestCheckout } from './lib/api';
import { BILLING_OFFERS } from './data/billing';

function inr(amountPaise: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountPaise / 100);
}

export default function SandboxPaymentPage() {
  const { isLoading, user, signInWithGoogle } = useAuth();
  const [phone, setPhone] = useState('');
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (offerId: string) => {
    if (!user) return;
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
      setError('Enter a valid sandbox mobile number for PayU.');
      return;
    }
    setError(null);
    setBusyOffer(offerId);
    try {
      const response = await startPayUTestCheckout(user, offerId, phone);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = response.url;
      for (const [name, value] of Object.entries(response.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    } catch (checkoutError) {
      setError(checkoutError instanceof ApiError ? checkoutError.message : 'Sandbox checkout could not be opened.');
      setBusyOffer(null);
    }
  };

  return (
    <main className="sandbox-payment-page">
      <section className="sandbox-payment-card">
        <p className="workflow-step">PAYU TEST ENVIRONMENT</p>
        <h1>Sandbox payments</h1>
        <p className="muted">Use PayU test-mode payment details only. No payment here grants production credits or membership access.</p>
        {isLoading ? (
          <p>Checking access…</p>
        ) : !user ? (
          <button className="google-button" onClick={() => void signInWithGoogle()}>Sign in with your test administrator account</button>
        ) : (
          <>
            <label className="sandbox-phone">
              Test mobile number
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="9876543210" />
            </label>
            {error && <p className="compose-error" role="alert">{error}</p>}
            <div className="sandbox-offers">
              {BILLING_OFFERS.filter((offer) => offer.kind === 'credit-pack').map((offer) => (
                <article key={offer.id}>
                  <span>{offer.kind === 'subscription' ? 'Subscription' : 'One-time payment'}</span>
                  <strong>{offer.id}</strong>
                  <em>{inr(offer.amountPaise)}</em>
                  <button disabled={busyOffer !== null} onClick={() => void checkout(offer.id)}>
                    {busyOffer === offer.id ? 'Opening…' : offer.kind === 'subscription' ? 'Test subscribe' : 'Test buy'}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
