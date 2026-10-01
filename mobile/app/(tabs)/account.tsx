import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import {
  Banner,
  Button,
  Caption,
  Card,
  Heading,
  Loading,
  ScreenScroll,
  Section,
  Title,
  styles,
} from '@/components/ui';
import {
  cancelMembership,
  errorMessage,
  getAccountDetails,
  getBillingCountry,
  getEntitlement,
  openBillingPortal,
  resumeMembership,
  startCheckout,
  type AccountDetails,
  type BillingCountry,
  type Entitlement,
} from '@/lib/api';
import { colors, spacing, typography } from '@/theme';
import { CREDIT_PACKS, MEMBERSHIP_OFFERS } from '@shared/data/membership';

function creditLine(label: string, free: number | null, subscription: number | null, purchased: number | null): string {
  const parts = [
    free == null ? null : `${free} free`,
    subscription == null ? null : `${subscription} included`,
    purchased ? `${purchased} purchased` : null,
  ].filter(Boolean);
  return `${label}: ${parts.length ? parts.join(' · ') : 'unlimited'}`;
}

export default function AccountScreen() {
  const { user, signOutUser } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [country, setCountry] = useState<BillingCountry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [entitlementResponse, accountResponse, countryResponse] = await Promise.all([
        getEntitlement(user),
        getAccountDetails(user),
        getBillingCountry(user).catch(() => ({ billingCountry: null as BillingCountry | null })),
      ]);
      setEntitlement(entitlementResponse.entitlement);
      setAccount(accountResponse);
      setCountry(countryResponse.billingCountry);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Your account could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkout = async (offerId: string) => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      // PayU needs a phone number and an HTML form post, so those buyers finish in the browser.
      const provider = country === 'OTHER' ? 'payu' : 'stripe';
      const response = await startCheckout(user, offerId, provider);
      await WebBrowser.openBrowserAsync(response.url);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, 'Checkout could not be started.'));
    } finally {
      setBusy(false);
    }
  };

  const portal = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { url } = await openBillingPortal(user);
      await WebBrowser.openBrowserAsync(url);
    } catch (cause) {
      setError(errorMessage(cause, 'The billing portal could not be opened.'));
    } finally {
      setBusy(false);
    }
  };

  const changeMembership = async (action: 'cancel' | 'resume') => {
    if (!user) return;
    setBusy(true);
    try {
      const { entitlement: next } =
        action === 'cancel' ? await cancelMembership(user) : await resumeMembership(user);
      setEntitlement(next);
    } catch (cause) {
      setError(errorMessage(cause, 'Your membership could not be updated.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Loading label="Loading your account…" />
      </View>
    );
  }

  return (
    <ScreenScroll>
      <Title>Account</Title>
      {error ? <Banner tone="error" message={error} /> : null}

      <Card>
        <Heading>{account?.name ?? user?.email ?? 'Signed in'}</Heading>
        <Caption>{account?.email ?? user?.email ?? ''}</Caption>
        {entitlement ? (
          <View style={{ gap: 4 }}>
            <Text style={{ ...typography.body, color: colors.text }}>
              Plan: {entitlement.plan}
              {entitlement.cancelAtPeriodEnd ? ' (ends at period end)' : ''}
            </Text>
            <Caption>
              {creditLine(
                'Prompts',
                entitlement.freePromptsRemaining,
                entitlement.subscriptionCreditsRemaining,
                entitlement.purchasedPromptCredits,
              )}
            </Caption>
            <Caption>
              {creditLine(
                'Songs',
                entitlement.freeSongsRemaining,
                entitlement.subscriptionSongCreditsRemaining,
                entitlement.purchasedSongCredits,
              )}
            </Caption>
            <Caption>
              {creditLine(
                'Vocals',
                entitlement.freeVocalsRemaining,
                entitlement.subscriptionVocalCreditsRemaining,
                entitlement.purchasedVocalCredits,
              )}
            </Caption>
          </View>
        ) : null}
      </Card>

      {entitlement?.isPaid ? (
        <Card>
          <Heading>Membership</Heading>
          <Caption>
            {entitlement.currentPeriodEnd
              ? `Renews ${new Date(entitlement.currentPeriodEnd).toLocaleDateString()}`
              : 'Active'}
          </Caption>
          <Button label="Manage billing" variant="secondary" icon="card" busy={busy} onPress={() => void portal()} />
          {entitlement.cancelAtPeriodEnd ? (
            <Button label="Resume membership" variant="secondary" busy={busy} onPress={() => void changeMembership('resume')} />
          ) : (
            <Button
              label="Cancel membership"
              variant="danger"
              busy={busy}
              onPress={() =>
                Alert.alert('Cancel membership', 'Your credits stay available until the end of the period.', [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Cancel', style: 'destructive', onPress: () => void changeMembership('cancel') },
                ])
              }
            />
          )}
        </Card>
      ) : (
        <Section label="Memberships" hint="Checkout opens in your browser and returns here when it is done.">
          {MEMBERSHIP_OFFERS.map((offer) => (
            <Card key={offer.id}>
              <Heading>
                {offer.name} · {offer.price} {offer.cadence}
              </Heading>
              <Caption>{offer.description}</Caption>
              <Caption>
                {offer.promptAllowance} · {offer.songAllowance.yearly} · {offer.vocalAllowance}
              </Caption>
              {offer.checkoutOptions.map((option) => (
                <Button
                  key={option.offerId}
                  label={option.label}
                  variant="secondary"
                  busy={busy}
                  onPress={() => void checkout(option.offerId)}
                />
              ))}
            </Card>
          ))}
        </Section>
      )}

      <Section label="Credit packs">
        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.id}>
            <Heading>
              {pack.name} · {pack.price}
            </Heading>
            <Caption>
              {pack.prompts} · {pack.songs} · {pack.vocals}
            </Caption>
            <Button label={`Buy ${pack.name}`} variant="secondary" busy={busy} onPress={() => void checkout(pack.id)} />
          </Card>
        ))}
      </Section>

      <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={() => void signOutUser()} />
      <View style={{ height: spacing.xl }} />
    </ScreenScroll>
  );
}
