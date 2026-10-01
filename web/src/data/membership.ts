import type { BillingOfferId } from './billing';

interface CheckoutOption {
  offerId: BillingOfferId;
  label: string;
}

export interface MembershipOffer {
  id: 'creator' | 'pro' | 'studio';
  name: string;
  price: string;
  cadence: string;
  promptAllowance: string;
  vocalAllowance: string;
  songAllowance: {
    monthly?: string;
    yearly: string;
  };
  downloadAllowance: string;
  fairUse: string;
  description: string;
  featured?: boolean;
  checkoutOptions: CheckoutOption[];
}

export interface CreditPack {
  id: 'pack-50' | 'pack-150';
  name: string;
  price: string;
  prompts: string;
  vocals: string;
  songs: string;
}

export const MEMBERSHIP_OFFERS: MembershipOffer[] = [
  {
    id: 'creator',
    name: 'Creator',
    price: '₹1,699',
    cadence: 'per year',
    promptAllowance: '500 prompts per year',
    vocalAllowance: '250 vocals per year',
    songAllowance: {
      yearly: '175 songs per year',
    },
    downloadAllowance: 'Unlimited song downloads',
    fairUse: 'Up to 30 generations per day',
    description: 'For occasional writers who want a year of thoughtful raga, structure, and production exploration.',
    featured: true,
    checkoutOptions: [{ offerId: 'creator-yearly', label: '₹1,699 / year' }],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹699',
    cadence: 'per month · or ₹5,999/year',
    promptAllowance: '300 prompts per month',
    vocalAllowance: '150 vocals per month',
    songAllowance: {
      monthly: '70 songs per month',
      yearly: '52 songs per month',
    },
    downloadAllowance: 'Unlimited song downloads',
    fairUse: 'Up to 10 generations per minute',
    description: 'For regular songwriters developing multiple lyric and production directions every month.',
    checkoutOptions: [
      { offerId: 'pro-monthly', label: '₹699 / month' },
      { offerId: 'pro-yearly', label: '₹5,999 / year' },
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '₹1,699',
    cadence: 'per month · or ₹14,999/year',
    promptAllowance: '1,000 prompts per month',
    vocalAllowance: '500 vocals per month',
    songAllowance: {
      monthly: '175 songs per month',
      yearly: '130 songs per month',
    },
    downloadAllowance: 'Unlimited song downloads',
    fairUse: 'Up to 10 generations per minute',
    description: 'For prolific creators, producers, and teams iterating at a high volume.',
    checkoutOptions: [
      { offerId: 'studio-monthly', label: '₹1,699 / month' },
      { offerId: 'studio-yearly', label: '₹14,999 / year' },
    ],
  },
];

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack-50', name: 'Starter pack', price: '₹349', prompts: '50 extra prompts', vocals: '25 extra vocals', songs: '35 extra songs' },
  { id: 'pack-150', name: 'Writer pack', price: '₹749', prompts: '150 extra prompts', vocals: '75 extra vocals', songs: '75 extra songs' },
];
