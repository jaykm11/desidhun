import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { getEntitlement, type Entitlement } from './lib/api';
import { billingOffer } from './data/billing';
import { CREDIT_PACKS, MEMBERSHIP_OFFERS } from './data/membership';

type CheckoutStatus = 'success' | 'canceled' | 'failed';

function offerName(offerId: string | null): string | null {
  if (!offerId) return null;
  const pack = CREDIT_PACKS.find((item) => item.id === offerId);
  if (pack) return pack.name;
  const offer = billingOffer(offerId);
  const plan = MEMBERSHIP_OFFERS.find((item) => item.id === offer?.plan);
  if (!plan) return null;
  return `${plan.name} membership (${offerId.endsWith('monthly') ? 'monthly' : 'yearly'})`;
}

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;
}

export default function PaymentResultPage() {
  const { user, isLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const rawStatus = params.get('checkout');
  const status: CheckoutStatus = rawStatus === 'success' ? 'success' : rawStatus === 'failed' ? 'failed' : 'canceled';
  const offerId = params.get('offer');
  const reference = params.get('ref');
  const isSubscription = billingOffer(offerId ?? undefined)?.kind === 'subscription';
  const name = offerName(offerId);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [confirming, setConfirming] = useState(status === 'success');

  useEffect(() => {
    if (!user || status !== 'success') return;
    let cancelled = false;
    let attempt = 0;
    const check = async () => {
      attempt += 1;
      const next = await getEntitlement(user).then((result) => result.entitlement).catch(() => null);
      if (cancelled) return;
      if (next) setEntitlement(next);
      const applied = !isSubscription || (next?.isPaid && (!offerId || next.membershipOfferId === offerId));
      if (applied || attempt >= 6) {
        setConfirming(false);
        return;
      }
      window.setTimeout(() => void check(), 2_000);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [user, status, offerId, isSubscription]);

  const renewsOn = formatDate(entitlement?.currentPeriodEnd ?? null);

  return (
    <main className="legal-page payment-result-page">
      <section className={`payment-result-card payment-result-${status}`}>
        <div className="payment-result-icon" aria-hidden="true">{status === 'success' ? '✓' : status === 'failed' ? '!' : '×'}</div>
        {status === 'success' ? (
          <>
            <h1>Payment successful</h1>
            <p>
              Thank you! {name ? <>Your <strong>{name}</strong> purchase is complete.</> : 'Your purchase is complete.'}
            </p>
            {isLoading || confirming ? (
              <p className="muted">Confirming your account update…</p>
            ) : isSubscription && entitlement?.isPaid ? (
              <p className="muted">Your membership is active{renewsOn ? ` until ${renewsOn}` : ''}. A receipt has been sent to your email.</p>
            ) : isSubscription ? (
              <p className="muted">Your payment was received. It can take a minute for the membership to appear; refresh the membership page shortly.</p>
            ) : (
              <p className="muted">Your credits have been added. A receipt has been sent to your email.</p>
            )}
            <div className="payment-result-actions">
              <a className="membership-checkout-button" href="/">Start creating</a>
              <a className="membership-cancel-button" href="/membership">View membership</a>
            </div>
          </>
        ) : status === 'failed' ? (
          <>
            <h1>Payment failed</h1>
            <p>{name ? <>We could not complete payment for <strong>{name}</strong>.</> : 'We could not complete your payment.'} No membership or credits were added.</p>
            <p className="muted">If money was deducted, it is usually refunded automatically by your bank within 5–7 working days. Contact us with the reference below if it isn't.</p>
            <div className="payment-result-actions">
              <a className="membership-checkout-button" href="/membership">Try again</a>
              <a className="membership-cancel-button" href="/">Back to studio</a>
            </div>
          </>
        ) : (
          <>
            <h1>Payment cancelled</h1>
            <p>{name ? <>Checkout for <strong>{name}</strong> was cancelled.</> : 'Checkout was cancelled.'} You have not been charged.</p>
            <div className="payment-result-actions">
              <a className="membership-checkout-button" href="/membership">Back to membership</a>
              <a className="membership-cancel-button" href="/">Back to studio</a>
            </div>
          </>
        )}
        {reference && <p className="payment-result-ref">Reference: {reference}</p>}
      </section>
    </main>
  );
}
