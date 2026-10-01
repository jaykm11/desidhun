import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import {
  ApiError,
  cancelMembership,
  getBillingCountry,
  getEntitlement,
  resumeMembership,
  startCheckout,
  type BillingCountry,
  type Entitlement,
} from './lib/api';
import { billingOffer } from './data/billing';
import { CREDIT_PACKS, MEMBERSHIP_OFFERS } from './data/membership';
import type { PaymentProvider } from './data/billing';

function title(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'the end of the paid period';
}

export default function MembershipPage() {
  const { user, isLoading, signInWithGoogle } = useAuth();
  const [country, setCountry] = useState<BillingCountry | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [phone, setPhone] = useState('');
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPayU, setPendingPayU] = useState<{ offerId: string; name: string; replaceMembership: boolean } | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const usesPayU = country === 'OTHER';
  const phoneValid = /^\d{10,15}$/.test(phone.replace(/\D/g, ''));
  const currentOffer = billingOffer(entitlement?.membershipOfferId ?? undefined);
  const currentPlan = currentOffer
    ? MEMBERSHIP_OFFERS.find((offer) => offer.id === currentOffer.plan)
    : MEMBERSHIP_OFFERS.find((offer) => offer.id === entitlement?.plan);

  useEffect(() => {
    if (!user) return;
    void getBillingCountry(user).then(({ billingCountry }) => setCountry(billingCountry)).catch(() => setCountry(null));
    const refresh = () => getEntitlement(user)
      .then(({ entitlement: next }) => setEntitlement(next))
      .catch(() => setEntitlement(null));
    void refresh();
    if (new URLSearchParams(window.location.search).get('checkout') !== 'success') return;
    const retry = window.setTimeout(() => void refresh(), 2_000);
    return () => window.clearTimeout(retry);
  }, [user]);

  useEffect(() => {
    if (!pendingPayU) return;
    phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    phoneInputRef.current?.focus({ preventScroll: true });
  }, [pendingPayU]);

  const requestCheckout = (offerId: string, provider: PaymentProvider, name: string, replaceMembership = false) => {
    if (provider === 'payu') {
      setError(null);
      setPendingPayU({ offerId, name, replaceMembership });
      return;
    }
    void checkout(offerId, provider, replaceMembership);
  };

  const checkout = async (offerId: string, provider: PaymentProvider, replaceMembership = false) => {
    if (!user) return;
    if (provider === 'payu' && !phoneValid) {
      setError('Enter a valid mobile number to continue with PayU.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await startCheckout(user, offerId, provider, provider === 'payu' ? phone : undefined, replaceMembership);
      if (response.provider === 'stripe') return window.location.assign(response.url);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = response.url;
      Object.entries(response.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      });
      document.body.append(form);
      form.submit();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Checkout could not be opened.');
      setBusy(false);
    }
  };

  const subscribe = (offerId: string, provider: PaymentProvider, offerName: string) => {
    const switching = !!entitlement?.isPaid && !entitlement.isAdmin && entitlement.membershipOfferId !== offerId;
    if (switching) {
      const currentName = currentPlan?.name ?? title(entitlement.plan);
      const confirmed = window.confirm(
        `You currently have the ${currentName} membership. Cancel it and switch to ${offerName}? Your current membership will be cancelled before checkout opens.`,
      );
      if (!confirmed) return;
    }
    requestCheckout(offerId, provider, offerName, switching);
  };

  const handleCancel = async () => {
    if (!user) return;
    const endsOn = formatDate(entitlement?.currentPeriodEnd ?? null);
    if (!window.confirm(`Cancel auto-renewal? You will not be charged again. Because you have already paid for this period, your membership stays usable until ${endsOn} and then ends automatically.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { entitlement: next } = await cancelMembership(user);
      setEntitlement(next);
      setNotice(`Your membership has been cancelled and will not renew. You can keep using it until ${formatDate(next.currentPeriodEnd)}. A confirmation email is on its way.`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Your membership could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { entitlement: next } = await resumeMembership(user);
      setEntitlement(next);
      setNotice('Auto-renewal is back on. Your membership will renew as normal.');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Your membership could not be resumed.');
    } finally {
      setBusy(false);
    }
  };

  const provider = usesPayU ? 'payu' : country ? 'stripe' : null;
  const showCurrent = !!entitlement && !entitlement.isAdmin && entitlement.isPaid;
  return (
    <main className="legal-page membership-page">
      <p className="workflow-step">DESI DHUN MEMBERSHIP</p>
      <p className="muted">Every account begins with 3 free lifetime prompts. Memberships renew automatically; credit packs never expire.</p>
      {isLoading ? <p>Checking account…</p> : !user ? (
        <button className="google-button" onClick={() => void signInWithGoogle()}>Sign in to choose a plan</button>
      ) : (
        <>
          {showCurrent && (
            <section className={`current-membership${entitlement.cancelAtPeriodEnd ? ' current-membership-ending' : ''}`}>
              <p className="membership-card-label">{entitlement.cancelAtPeriodEnd ? 'CANCELLED MEMBERSHIP' : 'CURRENT MEMBERSHIP'}</p>
              <h2>{currentPlan?.name ?? title(entitlement.plan)}</h2>
              <p>
                {currentOffer ? title(currentOffer.id) : title(entitlement.plan)} ·{' '}
                {entitlement.cancelAtPeriodEnd
                  ? <span className="membership-status-ending">Cancelled · usable until {formatDate(entitlement.currentPeriodEnd)}</span>
                  : title(entitlement.subscriptionStatus)}
              </p>
              <p>
                {entitlement.cancelAtPeriodEnd
                  ? `Auto-renewal is off and you will not be charged again. You already paid for the current period, so you can keep using your membership until ${formatDate(entitlement.currentPeriodEnd)}. After that your account moves to the free tier automatically.`
                  : `Renews automatically on ${formatDate(entitlement.currentPeriodEnd)}.`}
              </p>
              {entitlement.cancelAtPeriodEnd && entitlement.billingProvider === 'payu' && (
                <p className="muted">To continue after that date, subscribe again from the plans below.</p>
              )}
              {entitlement.cancelAtPeriodEnd && entitlement.billingProvider !== 'payu' ? (
                <button className="membership-checkout-button" disabled={busy} onClick={() => void handleResume()}>
                  {busy ? 'Updating…' : 'Resume auto-renewal'}
                </button>
              ) : !entitlement.cancelAtPeriodEnd ? (
                <button className="membership-cancel-button" disabled={busy} onClick={() => void handleCancel()}>
                  {busy ? 'Updating…' : 'Cancel membership'}
                </button>
              ) : null}
            </section>
          )}
          <div className="membership-cadence" role="group" aria-label="Membership billing frequency">
            <button className={cadence === 'monthly' ? 'selected' : ''} onClick={() => setCadence('monthly')}>Monthly</button>
            <button className={cadence === 'yearly' ? 'selected' : ''} onClick={() => setCadence('yearly')}>Yearly</button>
          </div>
          {usesPayU && pendingPayU && (
            <div className="payu-phone-step">
              <label className={`payu-phone-field${phoneValid ? '' : ' payu-phone-blink'}`}>
                <span>Mobile number for {pendingPayU.name}</span>
                <input ref={phoneInputRef} value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="9876543210" />
                <small>{phoneValid ? 'Ready for PayU checkout.' : 'Enter your mobile number to continue to PayU checkout.'}</small>
              </label>
              <div className="payu-phone-actions">
                <button className="membership-checkout-button" disabled={busy || !phoneValid} onClick={() => void checkout(pendingPayU.offerId, 'payu', pendingPayU.replaceMembership)}>
                  {busy ? 'Opening checkout…' : 'Continue to PayU'}
                </button>
                <button className="membership-cancel-button" disabled={busy} onClick={() => setPendingPayU(null)}>Cancel</button>
              </div>
            </div>
          )}
          {notice && <p className="membership-notice" role="status">{notice}</p>}
          {error && <p className="compose-error">{error}</p>}
          <div className="membership-grid">
            {MEMBERSHIP_OFFERS.map((offer) => {
              const option = offer.checkoutOptions.find((item) => item.offerId.endsWith(cadence));
              if (!option) return null;
              const isCurrent = entitlement?.membershipOfferId === option.offerId;
              return <article key={offer.id} className={`membership-card ${offer.featured ? 'membership-card-featured' : ''} ${isCurrent ? 'membership-card-current' : ''}`}>
                {isCurrent
                  ? <span className="membership-badge">{entitlement?.cancelAtPeriodEnd ? 'CANCELLED' : 'CURRENT MEMBERSHIP'}</span>
                  : offer.featured && <span className="membership-badge">BEST VALUE</span>}
                <p className="membership-card-label">MEMBERSHIP</p><h3>{offer.name}</h3>
                <p className="membership-price">{option.label.split(' /')[0]} <span>per {cadence === 'monthly' ? 'month' : 'year'}</span></p>
                <p className="membership-allowance">{offer.promptAllowance}</p>
                <p className="membership-allowance">{offer.vocalAllowance}</p>
                <p className="membership-allowance">{offer.songAllowance[cadence] ?? offer.songAllowance.yearly}</p>
                <p className="membership-description">{offer.description}</p>
                {isCurrent ? (
                  <button className="membership-checkout-button" disabled>
                    {entitlement?.cancelAtPeriodEnd ? `Ends ${formatDate(entitlement.currentPeriodEnd)}` : 'Current membership'}
                  </button>
                ) : (
                  <button className="membership-checkout-button" disabled={!provider || busy} onClick={() => provider && subscribe(option.offerId, provider, offer.name)}>
                    {busy ? 'Opening checkout…' : entitlement?.isPaid && !entitlement.isAdmin ? 'Switch plan' : 'Subscribe'}
                  </button>
                )}
              </article>;
            })}
          </div>
          <section className="membership-credit-section">
            <h2>One-time credits</h2>
            <div className="credit-pack-list">
              {CREDIT_PACKS.map((pack) => <article className="credit-pack" key={pack.id}>
                <strong>{pack.name}</strong><span>{pack.prompts}</span><span>{pack.vocals}</span><span>{pack.songs}</span><em>{pack.price}</em>
                <button className="credit-pack-button" disabled={!provider || busy} onClick={() => provider && requestCheckout(pack.id, provider, pack.name)}>{busy ? 'Opening…' : 'Buy'}</button>
              </article>)}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
