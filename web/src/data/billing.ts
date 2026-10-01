export type MembershipPlan = 'free' | 'creator' | 'pro' | 'studio' | 'admin';
export type PaymentProvider = 'stripe' | 'payu';

export type BillingOfferId =
  | 'creator-yearly'
  | 'pro-monthly'
  | 'pro-yearly'
  | 'studio-monthly'
  | 'studio-yearly'
  | 'pack-50'
  | 'pack-150';

export interface BillingOffer {
  id: BillingOfferId;
  plan: Exclude<MembershipPlan, 'free' | 'admin'> | null;
  kind: 'subscription' | 'credit-pack';
  /** Server-authoritative INR amount in paise, shared by every provider. */
  amountPaise: number;
  priceEnvironmentVariable: string;
  credits: number;
  /**
   * Songs included per credit period. Lyria bills $0.08 (about ₹7.58) per
   * song, so each allowance is set to keep Lyria at or below 80% of the
   * offer price, leaving a 20% margin before Stripe fees and tax.
   */
  songCredits: number;
  /** Vocal and dialogue generations included per credit period. Half of `credits`. */
  vocalCredits: number;
  creditPeriod: 'month' | 'year' | 'lifetime';
}

/** Songs a signed-out-of-billing account may generate before paying. */
export const FREE_SONG_LIMIT = 3;

/** Vocal or dialogue generations a free account may make before paying. */
export const FREE_VOCAL_LIMIT = 10;

/** Lifetime free prompt generations for accounts with no membership. */
export const FREE_PROMPT_LIMIT = 3;

export const BILLING_OFFERS: readonly BillingOffer[] = [
  {
    id: 'creator-yearly',
    plan: 'creator',
    kind: 'subscription',
    amountPaise: 169_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_CREATOR_YEARLY',
    credits: 500,
    songCredits: 175,
    vocalCredits: 250,
    creditPeriod: 'year',
  },
  {
    id: 'pro-monthly',
    plan: 'pro',
    kind: 'subscription',
    amountPaise: 69_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_PRO_MONTHLY',
    credits: 300,
    songCredits: 70,
    vocalCredits: 150,
    creditPeriod: 'month',
  },
  {
    id: 'pro-yearly',
    plan: 'pro',
    kind: 'subscription',
    amountPaise: 599_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_PRO_YEARLY',
    credits: 300,
    songCredits: 52,
    vocalCredits: 150,
    creditPeriod: 'month',
  },
  {
    id: 'studio-monthly',
    plan: 'studio',
    kind: 'subscription',
    amountPaise: 169_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_STUDIO_MONTHLY',
    credits: 1_000,
    songCredits: 175,
    vocalCredits: 500,
    creditPeriod: 'month',
  },
  {
    id: 'studio-yearly',
    plan: 'studio',
    kind: 'subscription',
    amountPaise: 1_499_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_STUDIO_YEARLY',
    credits: 1_000,
    songCredits: 130,
    vocalCredits: 500,
    creditPeriod: 'month',
  },
  {
    id: 'pack-50',
    plan: null,
    kind: 'credit-pack',
    amountPaise: 34_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_PACK_50',
    credits: 50,
    songCredits: 35,
    vocalCredits: 25,
    creditPeriod: 'lifetime',
  },
  {
    id: 'pack-150',
    plan: null,
    kind: 'credit-pack',
    amountPaise: 74_900,
    priceEnvironmentVariable: 'STRIPE_PRICE_PACK_150',
    credits: 150,
    songCredits: 75,
    vocalCredits: 75,
    creditPeriod: 'lifetime',
  },
] as const;

export function billingOffer(id: string | undefined): BillingOffer | undefined {
  return BILLING_OFFERS.find((offer) => offer.id === id);
}
