import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import Stripe from 'stripe';
import { analyzeLyrics } from '../../web/src/lib/analyze';
import { BILLING_OFFERS, billingOffer, FREE_PROMPT_LIMIT, FREE_SONG_LIMIT, FREE_VOCAL_LIMIT, type BillingOffer, type BillingOfferId, type MembershipPlan, type PaymentProvider } from '../../web/src/data/billing';
import { DIALOGUE_LANGUAGE_IDS } from '../../web/src/data/speechOptions';
import { clampTempoSpeed } from '../../web/src/data/tempo';
import { clampVoiceTone } from '../../web/src/data/voiceTone';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { analyzeRecordedSongStyle, generateLyricsFromImageWithGemini, generateLyricsWithGemini, transcribeRecordedLyrics, type LyricsKind, type LyricsLanguage } from './gemini';
import { sendCancellationEmail, sendPaymentReceipt, sendWelcomeEmail, usableEmail } from './email';
import { generateSongWithLyria } from './lyria';
import { cachedSongVideo, deleteSongAudio, readSongAudio, saveSongAudio } from './songLibrary';
import { enqueueSongRender } from './songRenderTasks';
import { generateSpokenNarration } from './tts';
import { coverThemeForSong, nextSongTitle, resolveCoverTheme, type CoverTheme } from '../../web/src/lib/songIdentity';
import { displaySongTitle } from '../../web/src/lib/songName';
import {
  deleteSongLink,
  getSharedSong,
  getSharedSongAudioPath,
  listCommunitySongs,
  listExploreRails,
  listFavoriteCommunitySongs,
  listPublicTopCommunitySongs,
  EXPLORE_KINDS,
  type ExploreKind,
  makeCommunitySongPrivate,
  publishCommunitySong,
  rateCommunitySong,
  recordCommunityPlay,
  renameCommunitySong,
  refreshSongLinkIfPresent,
  renameSongLink,
  unpublishCommunitySong,
  upsertSongLink,
} from './community';
import { missingSharedSongHtml, sharedSongHtml } from './sharePage';
import { getPresetAudioPath, getPresetDetail, likePresetSong, listPresetSongs, markPresetSong, setPresetCategory, setPresetFields, PRESET_SONGS, renamePresetSong, unmarkPresetSong } from './presets';
import type { AnalysisOptions, Tempo, Vocal } from '../../web/src/types';

const port = Number(process.env.PORT ?? 8080);
const appBaseUrl = requiredEnvironment('APP_BASE_URL');
const payuCallbackBaseUrl = requiredEnvironment('PAYU_CALLBACK_BASE_URL').replace(/\/$/, '');
const allowedOrigins = requiredEnvironment('ALLOWED_ORIGINS')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

const auth = getAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';

interface UserRecord {
  email: string | null;
  displayName: string | null;
  plan: MembershipPlan;
  lifetimePromptCount: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingProvider?: PaymentProvider;
  payuSubscriptionId?: string;
  payuMandateId?: string;
  payuMandateCommand?: 'mandate_revoke' | 'upi_mandate_revoke';
  payuTransactionId?: string;
  membershipOfferId?: BillingOfferId;
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Timestamp;
  stripePeriodStart?: Timestamp;
  subscriptionCreditsRemaining?: number;
  creditWindowStartedAt?: Timestamp;
  purchasedPromptCredits?: number;
  lifetimeSongCount?: number;
  songCreditsRemaining?: number;
  songWindowStartedAt?: Timestamp;
  purchasedSongCredits?: number;
  lifetimeVocalCount?: number;
  vocalCreditsRemaining?: number;
  vocalWindowStartedAt?: Timestamp;
  purchasedVocalCredits?: number;
  isAdmin?: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

const taskTokenClient = new OAuth2Client();

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isPaidMember(user: UserRecord): boolean {
  const isCurrent = !user.currentPeriodEnd || user.currentPeriodEnd.toMillis() > Date.now();
  return (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') && isCurrent;
}

const DEFAULT_ADMIN_EMAILS = [
  'jay.kr.mishra@gmail.com',
  'ajay.mishra@gmail.com',
  'mishra.vijayk@gmail.com',
  'swastikam11@gmail.com',
  'abhaymishra29@gmail.com',
];

async function isAdministrator(token: DecodedIdToken): Promise<boolean> {
  if (token.deshiDhunAdmin === true) return true;
  const administrators = [...DEFAULT_ADMIN_EMAILS, ...(process.env.ADMIN_EMAILS ?? '').split(',')]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = token.email ?? (await auth.getUser(token.uid)).email;
  return !!email && administrators.includes(email.toLowerCase());
}

async function isAdminUser(token: DecodedIdToken): Promise<boolean> {
  if (await isAdministrator(token)) return true;
  const snapshot = await db.collection('users').doc(token.uid).get();
  return snapshot.data()?.isAdmin === true;
}

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.user && await isAdminUser(req.user)) return next();
  } catch (error) {
    console.error('Admin check failed', { uid: req.user?.uid, error });
  }
  return res.status(403).json({ error: 'Only administrators can do that.' });
}

function defaultUser(token: DecodedIdToken): UserRecord {
  return {
    email: token.email ?? null,
    displayName: token.name ?? null,
    plan: 'free',
    lifetimePromptCount: 0,
    subscriptionStatus: 'none',
  };
}

function activeSubscriptionOffer(user: UserRecord): BillingOffer | undefined {
  const offer = billingOffer(user.membershipOfferId);
  if (offer?.kind === 'subscription') return offer;
  // Preserve the entitlement of members created under the original yearly plan.
  return isPaidMember(user) ? billingOffer('creator-yearly') : undefined;
}

function creditWindowIsExpired(start: Timestamp | undefined, period: BillingOffer['creditPeriod']): boolean {
  if (!start || period === 'lifetime') return false;
  const end = new Date(start.toMillis());
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  if (period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end.getTime() <= Date.now();
}

function subscriptionCredits(user: UserRecord, offer: BillingOffer | undefined): number | null {
  if (!offer || !isPaidMember(user)) return null;
  if (creditWindowIsExpired(user.creditWindowStartedAt, offer.creditPeriod)) return offer.credits;
  return user.subscriptionCreditsRemaining ?? offer.credits;
}

function subscriptionSongCredits(user: UserRecord, offer: BillingOffer | undefined): number | null {
  if (!offer || !isPaidMember(user)) return null;
  if (creditWindowIsExpired(user.songWindowStartedAt, offer.creditPeriod)) return offer.songCredits;
  return user.songCreditsRemaining ?? offer.songCredits;
}

function subscriptionVocalCredits(user: UserRecord, offer: BillingOffer | undefined): number | null {
  if (!offer || !isPaidMember(user)) return null;
  if (creditWindowIsExpired(user.vocalWindowStartedAt, offer.creditPeriod)) return offer.vocalCredits;
  return user.vocalCreditsRemaining ?? offer.vocalCredits;
}

function publicEntitlement(user: UserRecord, isAdmin = false) {
  if (isAdmin) {
    return {
      plan: 'admin' as const,
      isPaid: true,
      isAdmin: true,
      lifetimePromptCount: user.lifetimePromptCount,
      freePromptsRemaining: null,
      subscriptionCreditsRemaining: null,
      purchasedPromptCredits: null,
      freeSongsRemaining: null,
      subscriptionSongCreditsRemaining: null,
      purchasedSongCredits: null,
      freeVocalsRemaining: null,
      subscriptionVocalCreditsRemaining: null,
      purchasedVocalCredits: null,
      subscriptionStatus: 'admin',
      billingProvider: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      membershipOfferId: null,
    };
  }
  const paid = isPaidMember(user);
  const offer = activeSubscriptionOffer(user);
  return {
    plan: paid ? offer?.plan ?? 'creator' : 'free',
    isPaid: paid,
    isAdmin: false,
    lifetimePromptCount: user.lifetimePromptCount,
    freePromptsRemaining: paid ? null : Math.max(0, FREE_PROMPT_LIMIT - user.lifetimePromptCount),
    subscriptionCreditsRemaining: subscriptionCredits(user, offer),
    purchasedPromptCredits: user.purchasedPromptCredits ?? 0,
    freeSongsRemaining: paid ? null : Math.max(0, FREE_SONG_LIMIT - (user.lifetimeSongCount ?? 0)),
    subscriptionSongCreditsRemaining: subscriptionSongCredits(user, offer),
    purchasedSongCredits: user.purchasedSongCredits ?? 0,
    freeVocalsRemaining: paid ? null : Math.max(0, FREE_VOCAL_LIMIT - (user.lifetimeVocalCount ?? 0)),
    subscriptionVocalCreditsRemaining: subscriptionVocalCredits(user, offer),
    purchasedVocalCredits: user.purchasedVocalCredits ?? 0,
    subscriptionStatus: user.subscriptionStatus,
    billingProvider: paid ? user.billingProvider ?? 'stripe' : null,
    cancelAtPeriodEnd: paid && user.cancelAtPeriodEnd === true,
    currentPeriodEnd: user.currentPeriodEnd?.toDate().toISOString() ?? null,
    membershipOfferId: paid ? user.membershipOfferId ?? offer?.id ?? null : null,
  };
}

function parseOptions(value: unknown): AnalysisOptions {
  const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const asOneOf = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T): T =>
    typeof candidate === 'string' && allowed.includes(candidate as T) ? candidate as T : fallback;

  return {
    vocal: asOneOf<Vocal>(input.vocal, ['auto', 'female', 'male', 'duet', 'child'], 'auto'),
    voiceStyleId: typeof input.voiceStyleId === 'string' && input.voiceStyleId.length <= 100
      ? input.voiceStyleId
      : undefined,
    tempo: asOneOf<Tempo>(input.tempo, ['auto', 'slow', 'medium', 'fast'], 'auto'),
    tempoSpeed: input.tempoSpeed == null ? undefined : clampTempoSpeed(input.tempoSpeed),
    voicePitch: input.voicePitch == null ? undefined : clampVoiceTone(input.voicePitch),
    voiceBass: input.voiceBass == null ? undefined : clampVoiceTone(input.voiceBass),
    genreOverride: typeof input.genreOverride === 'string' ? input.genreOverride : 'auto',
    dialogueCharacter: asOneOf(input.dialogueCharacter, ['hero', 'villain', 'comedian'] as const, 'hero'),
    dialogueLanguage: asOneOf(input.dialogueLanguage, DIALOGUE_LANGUAGE_IDS, 'hindi'),
    spokenMediaType: asOneOf(input.spokenMediaType, ['news', 'documentary', 'youtube-reels', 'podcast'] as const, 'news'),
    includeBackgroundMusic: input.includeBackgroundMusic === true,
    includeAlap: input.includeAlap !== false,
    includeIntro: input.includeIntro === true,
    includeOutro: input.includeOutro === true,
    includeInstruments: input.includeInstruments === true,
    includeBridge: input.includeBridge === true,
    includeSargam: input.includeSargam !== false,
  };
}

function parseVariationIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(value, 20));
}

async function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Sign in is required.' });
    return;
  }

  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Your sign-in session is invalid or expired.' });
  }
}

async function requireSongRenderTask(req: Request, res: Response, next: NextFunction) {
  const bearer = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return res.status(401).json({ error: 'Missing task authentication.' });
  try {
    const taskTargetUrl = requiredEnvironment('CLOUD_RUN_TASK_URL').replace(/\/$/, '');
    const taskServiceAccount = requiredEnvironment('CLOUD_RUN_TASK_SERVICE_ACCOUNT');
    const ticket = await taskTokenClient.verifyIdToken({ idToken: bearer, audience: taskTargetUrl });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== taskServiceAccount) {
      return res.status(403).json({ error: 'Invalid task identity.' });
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid task authentication.' });
  }
}

async function loadUser(token: DecodedIdToken): Promise<UserRecord> {
  const ref = db.collection('users').doc(token.uid);
  const snapshot = await ref.get();
  if (snapshot.exists) return snapshot.data() as UserRecord;

  const grantRef = token.email ? db.collection('membershipGrants').doc(token.email.toLowerCase()) : null;
  const grant = grantRef ? await grantRef.get() : null;
  const offer = grant?.exists ? billingOffer(grant.data()?.offerId) : undefined;
  const periodEnd = grant?.data()?.currentPeriodEnd;
  const record = {
    ...defaultUser(token),
    ...(offer?.kind === 'subscription' && periodEnd instanceof Timestamp && periodEnd.toMillis() > Date.now()
      ? {
        plan: offer.plan ?? 'creator',
        membershipOfferId: offer.id,
        subscriptionStatus: 'active' as const,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        complimentaryMembership: true,
      }
      : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.create(record);
  if (grant?.exists) await grantRef!.set({ appliedToUid: token.uid, appliedAt: FieldValue.serverTimestamp() }, { merge: true });
  const email = await resolveAccountEmail(token.uid, token.email, null);
  await sendWelcomeEmail(email, token.name ?? null).catch((error) => {
    console.error('Welcome email failed after account creation', {
      uid: token.uid,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  return record;
}

async function resolveAccountEmail(
  uid: string,
  ...candidates: Array<string | null | undefined>
): Promise<string | null> {
  for (const candidate of candidates) {
    const email = usableEmail(candidate);
    if (email) return email;
  }
  try {
    const authUser = await auth.getUser(uid);
    const email = usableEmail(authUser.email);
    if (email) return email;
  } catch {
    // Auth lookup is best-effort for receipt/welcome delivery.
  }
  try {
    const user = await db.collection('users').doc(uid).get();
    return usableEmail(user.data()?.email as string | null | undefined);
  } catch {
    return null;
  }
}

function stripeRequired(): Stripe {
  if (!stripe) throw new Error('Billing is not configured.');
  return stripe;
}

interface PayUCheckout {
  provider: 'payu';
  url: string;
  fields: Record<string, string>;
}

function payuEnvironment(): 'test' | 'production' {
  return process.env.PAYU_ENVIRONMENT === 'production' ? 'production' : 'test';
}

function sandboxPaymentMode(): boolean {
  return process.env.SANDBOX_PAYMENT_MODE === 'true';
}

function payuPaymentUrl(): string {
  return payuEnvironment() === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
}

function payuPostServiceUrl(): string {
  return payuEnvironment() === 'production'
    ? 'https://info.payu.in/merchant/postservice?form=2'
    : 'https://test.payu.in/merchant/postservice?form=2';
}

function payuRequired(name: 'PAYU_MERCHANT_KEY' | 'PAYU_MERCHANT_SALT'): string {
  return requiredEnvironment(name);
}

function payuTestRequired(name: 'PAYU_TEST_MERCHANT_KEY' | 'PAYU_TEST_MERCHANT_SALT'): string {
  return requiredEnvironment(name);
}

function sha512(value: string): string {
  return createHash('sha512').update(value, 'utf8').digest('hex');
}

function fixedAmount(amountPaise: number): string {
  return (amountPaise / 100).toFixed(2);
}

function payuHash(fields: Record<string, string>, salt = payuRequired('PAYU_MERCHANT_SALT')): string {
  const sequence = [
    fields.key, fields.txnid, fields.amount, fields.productinfo, fields.firstname, fields.email,
    fields.udf1, fields.udf2, fields.udf3, fields.udf4, fields.udf5, '', '', '', '', '',
    // si_details is part of the API v7 subscription hash only. Including an
    // empty si_details slot for one-time payments adds a delimiter and makes
    // PayU reject the standard-payment hash.
    ...(fields.si_details ? [fields.si_details] : []),
    salt,
  ];
  return sha512(sequence.join('|'));
}

function payuCallbackHash(fields: Record<string, string>, salt = payuRequired('PAYU_MERCHANT_SALT')): string {
  const sequence = [
    ...(fields.additional_charges ? [fields.additional_charges] : []),
    salt, fields.status ?? '', '', '', '', '', '',
    fields.udf5 ?? '', fields.udf4 ?? '', fields.udf3 ?? '', fields.udf2 ?? '', fields.udf1 ?? '',
    fields.email ?? '', fields.firstname ?? '', fields.productinfo ?? '', fields.amount ?? '',
    fields.txnid ?? '', fields.key ?? '',
  ];
  return sha512(sequence.join('|'));
}

function safelyMatchesHash(actual: string | undefined, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function payuSubscriptionDetails(offer: BillingOffer): string {
  const now = new Date();
  const end = new Date(now);
  if (offer.creditPeriod === 'month') end.setUTCFullYear(end.getUTCFullYear() + 10);
  else end.setUTCFullYear(end.getUTCFullYear() + 10);
  return JSON.stringify({
    billingAmount: fixedAmount(offer.amountPaise),
    billingCurrency: 'INR',
    billingCycle: offer.creditPeriod === 'month' ? 'MONTHLY' : 'YEARLY',
    billingInterval: 1,
    paymentStartDate: now.toISOString().slice(0, 10),
    paymentEndDate: end.toISOString().slice(0, 10),
  });
}

function payuMobileNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? digits : undefined;
}

function payuCheckout(offer: BillingOffer, token: DecodedIdToken, phone: string): PayUCheckout {
  if (offer.kind === 'subscription' && process.env.PAYU_SUBSCRIPTIONS_ENABLED !== 'true') {
    throw new Error('PayU subscriptions are not enabled yet. Ask support to enable recurring mandates for this merchant account.');
  }
  const email = usableEmail(token.email);
  if (!email) {
    throw new Error('A verified email address is required before PayU checkout.');
  }
  const transactionId = `dd${randomUUID().replaceAll('-', '').slice(0, 23)}`;
  const fields: Record<string, string> = {
    key: payuRequired('PAYU_MERCHANT_KEY'),
    txnid: transactionId,
    amount: fixedAmount(offer.amountPaise),
    // PayU limits productinfo to 24 characters for this merchant account.
    // Merchant identity is configured in the PayU dashboard.
    productinfo: `DD-${offer.id}`,
    firstname: token.name?.slice(0, 60) || 'Desi Dhun member',
    email,
    phone,
    udf1: token.uid,
    udf2: offer.id,
    udf3: '',
    udf4: '',
    udf5: '',
    surl: `${payuCallbackBaseUrl}/api/v1/billing/payu/callback`,
    furl: `${payuCallbackBaseUrl}/api/v1/billing/payu/callback`,
  };
  if (offer.kind === 'subscription') {
    // Required by PayU Hosted Checkout subscription registration.
    fields.api_version = '7';
    fields.si = '1';
    fields.si_details = payuSubscriptionDetails(offer);
  }
  fields.hash = payuHash(fields);
  return { provider: 'payu', url: payuPaymentUrl(), fields };
}

async function rememberPayUCheckout(fields: Record<string, string>, offer: BillingOffer, token: DecodedIdToken): Promise<void> {
  await db.collection('payuPendingPayments').doc(fields.txnid).set({
    uid: token.uid,
    offerId: offer.id,
    amount: fields.amount,
    email: fields.email || token.email || null,
    firstname: fields.firstname || token.name || null,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
}

function payuTestCheckout(offer: BillingOffer, token: DecodedIdToken, phone: string): PayUCheckout {
  if (offer.kind === 'subscription') {
    throw new Error('The PayU test page supports one-time payments only.');
  }
  const email = usableEmail(token.email);
  if (!email) {
    throw new Error('A verified email address is required before PayU checkout.');
  }
  const fields: Record<string, string> = {
    key: payuTestRequired('PAYU_TEST_MERCHANT_KEY'),
    txnid: `ddtest${randomUUID().replaceAll('-', '').slice(0, 19)}`,
    amount: fixedAmount(offer.amountPaise),
    productinfo: `DDTEST-${offer.id}`,
    firstname: token.name?.slice(0, 60) || 'Desi Dhun tester',
    email,
    phone,
    udf1: token.uid,
    udf2: offer.id,
    udf3: '',
    udf4: '',
    udf5: 'desidhun-payu-test',
    surl: `${payuCallbackBaseUrl}/api/v1/billing/payu/callback`,
    furl: `${payuCallbackBaseUrl}/api/v1/billing/payu/callback`,
  };
  fields.hash = payuHash(fields, payuTestRequired('PAYU_TEST_MERCHANT_SALT'));
  return { provider: 'payu', url: 'https://test.payu.in/_payment', fields };
}

const api = express();
api.set('trust proxy', 1);
const payuOrigins = new Set(['https://secure.payu.in', 'https://test.payu.in', 'https://payu.in']);
api.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || payuOrigins.has(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed.'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

type BillingCountry = 'US' | 'GB' | 'OTHER';
const countryCache = new Map<string, { value: BillingCountry; expiresAt: number }>();
const COUNTRY_CACHE_MS = 15 * 60_000;

function clientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.ip || '';
}

async function billingCountryForRequest(req: Request): Promise<BillingCountry> {
  const ip = clientIp(req);
  if (!ip) throw new Error('Could not determine your network location.');
  const cached = countryCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error('Could not determine your billing country.');
  const result = await response.json() as { success?: boolean; country_code?: string };
  if (result.success !== true || typeof result.country_code !== 'string') {
    throw new Error('Could not determine your billing country.');
  }
  const countryCode = result.country_code.toUpperCase();
  const value: BillingCountry = countryCode === 'US' || countryCode === 'GB' ? countryCode : 'OTHER';
  countryCache.set(ip, { value, expiresAt: Date.now() + COUNTRY_CACHE_MS });
  return value;
}

// Stripe signs the exact raw body, so this handler must precede express.json().
api.post('/v1/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = requiredEnvironment('STRIPE_WEBHOOK_SECRET');
    const signature = req.header('stripe-signature');
    if (!signature) return res.status(400).send('Missing Stripe signature.');

    const event = stripeRequired().webhooks.constructEvent(req.body, signature, webhookSecret);
    await handleStripeEvent(event);
    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed.';
    return res.status(400).send(message);
  }
});

// PayU posts form data to both its success and failure URLs. It must be parsed
// before the JSON middleware and is verified again against PayU's API below.
api.post('/v1/billing/payu/callback', express.urlencoded({ extended: false }), async (req, res) => {
  const fields = Object.fromEntries(
    Object.entries(req.body ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
  const paymentSucceeded = fields.status === 'success';
  const testPayment = fields.udf5 === 'desidhun-payu-test';
  try {
    const callbackHash = testPayment
      ? payuCallbackHash(fields, payuTestRequired('PAYU_TEST_MERCHANT_SALT'))
      : payuCallbackHash(fields);
    if (!safelyMatchesHash(fields.hash, callbackHash)) {
      throw new Error('PayU callback signature is invalid.');
    }
    if (paymentSucceeded && !testPayment && !sandboxPaymentMode()) {
      try {
        await verifyAndFulfillPayUPayment(fields);
      } catch (error) {
        console.error('PayU payment succeeded but membership could not be applied immediately', {
          txnid: fields.txnid,
          uid: fields.udf1,
          error,
        });
      }
    }
    const status = paymentSucceeded ? 'success' : fields.status === 'failure' ? 'failed' : 'canceled';
    const returnUrl = testPayment ? new URL('/sandbox-payment', appBaseUrl) : new URL('/payment-result', appBaseUrl);
    returnUrl.searchParams.set('checkout', status);
    if (fields.udf2) returnUrl.searchParams.set('offer', fields.udf2);
    if (fields.txnid) returnUrl.searchParams.set('ref', fields.txnid);
    return res.redirect(303, returnUrl.toString());
  } catch (error) {
    console.error('PayU callback could not be verified', { txnid: fields.txnid, error });
    const returnUrl = fields.udf5 === 'desidhun-payu-test'
      ? new URL('/sandbox-payment', appBaseUrl)
      : new URL('/payment-result', appBaseUrl);
    returnUrl.searchParams.set('checkout', 'failed');
    if (fields.udf2) returnUrl.searchParams.set('offer', fields.udf2);
    if (fields.txnid) returnUrl.searchParams.set('ref', fields.txnid);
    return res.redirect(303, returnUrl.toString());
  }
});

// Configure this as the PayU server-to-server webhook when it is available for
// the account. Its fulfillment path is identical to the browser return path.
api.post('/v1/webhooks/payu', express.urlencoded({ extended: false }), async (req, res) => {
  const fields = Object.fromEntries(
    Object.entries(req.body ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
  const testPayment = fields.udf5 === 'desidhun-payu-test';
  try {
    const callbackHash = testPayment
      ? payuCallbackHash(fields, payuTestRequired('PAYU_TEST_MERCHANT_SALT'))
      : payuCallbackHash(fields);
    if (fields.status !== 'success' || !safelyMatchesHash(fields.hash, callbackHash)) {
      return res.status(400).json({ error: 'Invalid PayU notification.' });
    }
    if (!testPayment && !sandboxPaymentMode()) await verifyAndFulfillPayUPayment(fields);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayU webhook could not be verified', { txnid: fields.txnid, error });
    return res.status(400).json({ error: 'PayU notification could not be verified.' });
  }
});

// Audio-style analysis accepts a short base64-encoded recording. All routes
// remain authenticated where needed, while this allows the 30-second capture.
api.use(express.json({ limit: '6mb' }));

api.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

api.get('/v1/me', requireUser, async (req: AuthenticatedRequest, res) => {
  await recoverPayUPayments(req.user!.uid);
  const user = await loadUser(req.user!);
  res.json({ entitlement: publicEntitlement(user, await isAdministrator(req.user!) || user.isAdmin === true) });
});

api.get('/v1/account', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    await recoverPayUPayments(req.user!.uid);
    const [user, payuEvents, stripeEvents, membershipEvents] = await Promise.all([
      loadUser(req.user!),
      db.collection('payuWebhookEvents').where('uid', '==', req.user!.uid).limit(100).get(),
      db.collection('stripeWebhookEvents').where('uid', '==', req.user!.uid).limit(100).get(),
      db.collection('membershipHistory').where('uid', '==', req.user!.uid).limit(100).get(),
    ]);
    const timestamp = (value: unknown): string | null => {
      if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
      }
      return null;
    };
    const payuHistory = payuEvents.docs.map((snapshot) => {
      const event = snapshot.data();
      const offer = billingOffer(typeof event.billingOfferId === 'string' ? event.billingOfferId : undefined);
      return {
        id: `payu-${snapshot.id}`,
        category: offer?.kind === 'subscription' ? 'membership' as const : 'payment' as const,
        provider: 'payu' as const,
        offerId: offer?.id ?? 'Unknown offer',
        status: 'Paid',
        occurredAt: timestamp(event.createdAt),
        amountPaise: offer?.amountPaise,
        reference: typeof event.providerPaymentId === 'string' ? event.providerPaymentId : snapshot.id,
      };
    });
    const stripeHistory = stripeEvents.docs.map((snapshot) => {
      const event = snapshot.data();
      const offer = billingOffer(typeof event.billingOfferId === 'string' ? event.billingOfferId : undefined);
      return {
        id: `stripe-${snapshot.id}`,
        category: 'payment' as const,
        provider: 'stripe' as const,
        offerId: offer?.id ?? 'Unknown offer',
        status: 'Paid',
        occurredAt: timestamp(event.createdAt),
        amountPaise: offer?.amountPaise,
        reference: snapshot.id,
      };
    });
    const membershipHistory = membershipEvents.docs.map((snapshot) => {
      const event = snapshot.data();
      return {
        id: `membership-${snapshot.id}`,
        category: 'membership' as const,
        provider: 'stripe' as const,
        offerId: typeof event.billingOfferId === 'string' ? event.billingOfferId : 'Unknown offer',
        status: event.cancelAtPeriodEnd === true ? 'Cancels at period end' : String(event.status ?? 'Updated'),
        occurredAt: timestamp(event.createdAt),
      };
    });
    const history = [...payuHistory, ...stripeHistory, ...membershipHistory]
      .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));
    const entitlement = publicEntitlement(user, await isAdministrator(req.user!) || user.isAdmin === true);
    return res.json({
      name: user.displayName ?? req.user!.name ?? null,
      email: user.email ?? req.user!.email ?? null,
      membership: {
        plan: entitlement.plan,
        offerId: user.membershipOfferId ?? null,
        status: entitlement.subscriptionStatus,
        provider: entitlement.billingProvider,
        periodEnd: entitlement.currentPeriodEnd,
      },
      history,
    });
  } catch (error) {
    console.error('Could not load account details', error);
    return res.status(503).json({ error: 'Could not load account details.' });
  }
});

api.get('/v1/billing/country', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json({ billingCountry: await billingCountryForRequest(req) });
  } catch (error) {
    console.error('Could not resolve billing country', error);
    return res.status(503).json({ error: 'Payment options are temporarily unavailable. Please try again.' });
  }
});

function parseLyricsLanguage(value: unknown): LyricsLanguage {
  if (value === 'english' || value === 'other') return value;
  return 'hindi';
}

function parseLyricsKind(value: unknown): LyricsKind {
  if (value === 'dialogue' || value === 'spoken') return value;
  return 'song';
}

api.post('/v1/lyrics/generate', requireUser, async (req: AuthenticatedRequest, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 4_000) {
    return res.status(400).json({ error: 'Describe the lyrics you want in 1 to 4,000 characters.' });
  }

  try {
    const lyrics = await generateLyricsWithGemini(prompt, parseLyricsLanguage(req.body?.language), parseLyricsKind(req.body?.kind));
    return res.json({ lyrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lyrics could not be generated.';
    return res.status(503).json({ error: message });
  }
});

api.post('/v1/lyrics/generate-from-image', requireUser, async (req: AuthenticatedRequest, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
  if (!prompt || prompt.length > 4_000) {
    return res.status(400).json({ error: 'Add an image description in 1 to 4,000 characters.' });
  }
  if (!/^image\/(?:jpeg|png)$/i.test(mimeType) || !imageBase64 || imageBase64.length > 5_400_000) {
    return res.status(400).json({ error: 'Upload a JPG or PNG image smaller than 4 MB.' });
  }

  try {
    const lyrics = await generateLyricsFromImageWithGemini(
      prompt,
      { data: imageBase64, mimeType },
      parseLyricsLanguage(req.body?.language),
      parseLyricsKind(req.body?.kind),
    );
    return res.json({ lyrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lyrics could not be generated from the image.';
    return res.status(503).json({ error: message });
  }
});

function isAllowedAudioMime(mimeType: string): boolean {
  return /^audio\/(?:webm|ogg|mpeg|mp3|wav|x-wav|m4a|mp4)(?:;.*)?$/i.test(mimeType);
}

api.post('/v1/lyrics/transcribe', express.json({ limit: '5mb' }), requireUser, async (req: AuthenticatedRequest, res) => {
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
  if (!isAllowedAudioMime(mimeType) || !audioBase64 || audioBase64.length > 4_000_000) {
    return res.status(400).json({ error: 'Record up to 60 seconds of audio, then try again.' });
  }
  try {
    return res.json(await transcribeRecordedLyrics(audioBase64, mimeType.split(';')[0]));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The recording could not be turned into lyrics.';
    return res.status(503).json({ error: message });
  }
});

api.post('/v1/style-recordings/analyze', express.json({ limit: '3mb' }), requireUser, async (req: AuthenticatedRequest, res) => {
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
  if (!isAllowedAudioMime(mimeType) || !audioBase64 || audioBase64.length > 2_500_000) {
    return res.status(400).json({ error: 'Record up to 30 seconds of audio, then try again.' });
  }
  try {
    const style = await analyzeRecordedSongStyle(audioBase64, mimeType);
    return res.json({ style });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The recording could not be analyzed.';
    return res.status(503).json({ error: message });
  }
});

type SongStatus = 'generating' | 'rendering' | 'ready' | 'failed';

interface LibrarySong {
  id: string;
  title: string;
  style: string;
  lyrics: string;
  notes?: string;
  error?: string;
  coverTheme?: string;
  status: SongStatus;
  rating: number;
  visibility: 'private' | 'public';
  preset: boolean;
  createdAt: string;
}

function songRating(value: unknown): number {
  const rating = typeof value === 'number' ? Math.round(value) : 0;
  return rating >= 1 && rating <= 5 ? rating : 0;
}

function songStatus(value: unknown): SongStatus {
  return value === 'generating' || value === 'rendering' || value === 'failed' ? value : 'ready';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicSongError(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if (/lyria(?: 3\.5)? returned no audio/i.test(value)) {
    return 'Inappropriate lyrics. Try something else.';
  }
  return value;
}

function publicSong(id: string, data: { [field: string]: unknown }): LibrarySong {
  const created = data.createdAt as { toDate?: () => Date } | undefined;
  const createdAt = created?.toDate?.() instanceof Date
    ? created.toDate().toISOString()
    : new Date().toISOString();
  return {
    id,
    title: displaySongTitle(typeof data.title === 'string' ? data.title : ''),
    style: typeof data.style === 'string' ? data.style : '',
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    error: publicSongError(data.error),
    coverTheme: resolveCoverTheme(
      data.coverTheme,
      typeof data.title === 'string' ? data.title : '',
      typeof data.style === 'string' ? data.style : '',
      typeof data.lyrics === 'string' ? data.lyrics : '',
    ),
    status: songStatus(data.status),
    rating: songRating(data.rating),
    visibility: data.visibility === 'public' ? 'public' : 'private',
    preset: data.preset === true,
    createdAt,
  };
}

type SongGenerator = 'lyria' | 'chirp-3-hd';

function resolveSongGenerator(style: string): SongGenerator {
  return style.includes('DIALOGUE_PUNCHLINE_DELIVERY') || style.includes('SPOKEN_WORD_DELIVERY')
    ? 'chirp-3-hd'
    : 'lyria';
}

function parseSongRequest(body: { style?: unknown; lyrics?: unknown; title?: unknown; generator?: unknown }) {
  const style = typeof body.style === 'string' ? body.style.trim() : '';
  const lyrics = typeof body.lyrics === 'string' ? body.lyrics.trim() : '';
  const requestedTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const generator = resolveSongGenerator(style);
  if (!style || style.length > 8_000) {
    return { error: 'Paste a style prompt of 1 to 8,000 characters.' };
  }
  if (!lyrics || lyrics.length > 12_000) {
    return { error: 'Paste lyrics of 1 to 12,000 characters.' };
  }
  if (requestedTitle.length > 80) {
    return { error: 'Keep the song name to 80 characters or fewer.' };
  }
  return { style, lyrics, requestedTitle, generator };
}

const RENDER_STALE_MS = 4.5 * 60_000;

type SongCreditSource = 'admin' | 'free' | 'subscription' | 'credit-pack';

/**
 * Reserves one song before Lyria is called. Every generated song costs real
 * money, so the allowance is claimed atomically the same way prompt credits
 * are. Charging at prepare time also means a resumed render never pays twice.
 */
async function chargeSongCredit(token: DecodedIdToken, admin: boolean): Promise<SongCreditSource> {
  const userRef = db.collection('users').doc(token.uid);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const user = snapshot.exists ? snapshot.data() as UserRecord : defaultUser(token);
    if (admin || user.isAdmin === true) return 'admin';

    const offer = activeSubscriptionOffer(user);
    const paid = isPaidMember(user) && offer !== undefined;
    const expiredWindow = paid && creditWindowIsExpired(user.songWindowStartedAt, offer.creditPeriod);
    const availableSongCredits = paid
      ? expiredWindow ? offer.songCredits : user.songCreditsRemaining ?? offer.songCredits
      : 0;
    const purchasedSongCredits = user.purchasedSongCredits ?? 0;
    const lifetimeSongCount = user.lifetimeSongCount ?? 0;

    let nextSongCredits = user.songCreditsRemaining;
    let nextPurchased = purchasedSongCredits;
    let nextLifetime = lifetimeSongCount;
    let source: SongCreditSource;

    if (paid && availableSongCredits > 0) {
      nextSongCredits = availableSongCredits - 1;
      source = 'subscription';
    } else if (paid && purchasedSongCredits > 0) {
      nextPurchased -= 1;
      source = 'credit-pack';
    } else if (!paid && lifetimeSongCount < FREE_SONG_LIMIT) {
      source = 'free';
    } else if (!paid && purchasedSongCredits > 0) {
      nextPurchased -= 1;
      source = 'credit-pack';
    } else {
      const exhausted = new Error(paid ? 'SONG_CREDIT_LIMIT_REACHED' : 'FREE_SONG_LIMIT_REACHED');
      exhausted.name = paid ? 'SongCreditLimitReached' : 'FreeSongLimitReached';
      throw exhausted;
    }
    nextLifetime += 1;

    transaction.set(userRef, {
      ...user,
      lifetimeSongCount: nextLifetime,
      purchasedSongCredits: nextPurchased,
      ...(paid
        ? {
            songCreditsRemaining: nextSongCredits,
            songWindowStartedAt: expiredWindow || !user.songWindowStartedAt
              ? Timestamp.now()
              : user.songWindowStartedAt,
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return source;
  });
}

async function chargeVocalCredit(token: DecodedIdToken, admin: boolean): Promise<SongCreditSource> {
  const userRef = db.collection('users').doc(token.uid);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const user = snapshot.exists ? snapshot.data() as UserRecord : defaultUser(token);
    if (admin || user.isAdmin === true) return 'admin';

    const offer = activeSubscriptionOffer(user);
    const paid = isPaidMember(user) && offer !== undefined;
    const expiredWindow = paid && creditWindowIsExpired(user.vocalWindowStartedAt, offer.creditPeriod);
    const availableVocalCredits = paid
      ? expiredWindow ? offer.vocalCredits : user.vocalCreditsRemaining ?? offer.vocalCredits
      : 0;
    const purchasedVocalCredits = user.purchasedVocalCredits ?? 0;
    const lifetimeVocalCount = user.lifetimeVocalCount ?? 0;

    let nextVocalCredits = user.vocalCreditsRemaining;
    let nextPurchased = purchasedVocalCredits;
    let nextLifetime = lifetimeVocalCount;
    let source: SongCreditSource;

    if (paid && availableVocalCredits > 0) {
      nextVocalCredits = availableVocalCredits - 1;
      source = 'subscription';
    } else if (paid && purchasedVocalCredits > 0) {
      nextPurchased -= 1;
      source = 'credit-pack';
    } else if (!paid && lifetimeVocalCount < FREE_VOCAL_LIMIT) {
      source = 'free';
    } else if (!paid && purchasedVocalCredits > 0) {
      nextPurchased -= 1;
      source = 'credit-pack';
    } else {
      const exhausted = new Error(paid ? 'VOCAL_CREDIT_LIMIT_REACHED' : 'FREE_VOCAL_LIMIT_REACHED');
      exhausted.name = paid ? 'VocalCreditLimitReached' : 'FreeVocalLimitReached';
      throw exhausted;
    }
    nextLifetime += 1;

    transaction.set(userRef, {
      ...user,
      lifetimeVocalCount: nextLifetime,
      purchasedVocalCredits: nextPurchased,
      ...(paid
        ? {
            vocalCreditsRemaining: nextVocalCredits,
            vocalWindowStartedAt: expiredWindow || !user.vocalWindowStartedAt
              ? Timestamp.now()
              : user.vocalWindowStartedAt,
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return source;
  });
}

function isVocalGeneration(_generator: SongGenerator, style: string): boolean {
  return resolveSongGenerator(style) === 'chirp-3-hd';
}

/** Gives the credit back when generation never produced audio. */
async function refundSongCredit(uid: string, songId: string): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  const songRef = userRef.collection('songs').doc(songId);
  try {
    await db.runTransaction(async (transaction) => {
      const songSnapshot = await transaction.get(songRef);
      if (!songSnapshot.exists) return;
      const song = songSnapshot.data() ?? {};
      if (song.songCreditRefunded === true) return;
      const source = song.songCreditSource as SongCreditSource | undefined;
      if (source === 'admin' || source === undefined) return;

      const userSnapshot = await transaction.get(userRef);
      const user = (userSnapshot.data() ?? {}) as UserRecord;
      const creditKind = song.creditKind === 'vocal' ? 'vocal' : 'song';
      const refund: Partial<UserRecord> = creditKind === 'vocal'
        ? { lifetimeVocalCount: Math.max(0, (user.lifetimeVocalCount ?? 1) - 1) }
        : { lifetimeSongCount: Math.max(0, (user.lifetimeSongCount ?? 1) - 1) };
      if (source === 'subscription') {
        const offer = activeSubscriptionOffer(user);
        if (creditKind === 'vocal') {
          refund.vocalCreditsRemaining = (user.vocalCreditsRemaining ?? offer?.vocalCredits ?? 1) + 1;
        } else {
          refund.songCreditsRemaining = (user.songCreditsRemaining ?? offer?.songCredits ?? 1) + 1;
        }
      } else if (source === 'credit-pack') {
        if (creditKind === 'vocal') {
          refund.purchasedVocalCredits = (user.purchasedVocalCredits ?? 0) + 1;
        } else {
          refund.purchasedSongCredits = (user.purchasedSongCredits ?? 0) + 1;
        }
      }

      transaction.set(userRef, { ...refund, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.update(songRef, { songCreditRefunded: true });
    });
  } catch (error) {
    console.error('Failed to refund song credit', { uid, songId, error });
  }
}

function songCreditError(error: unknown): { status: number; body: { error: string; code: string } } | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.name === 'FreeSongLimitReached') {
    return {
      status: 402,
      body: {
        error: `You have used your ${FREE_SONG_LIMIT} free songs. Choose a membership or add a credit pack to generate more.`,
        code: 'FREE_SONG_LIMIT_REACHED',
      },
    };
  }
  if (error.name === 'SongCreditLimitReached') {
    return {
      status: 402,
      body: {
        error: 'Your song allowance for this period has been used. It renews automatically, or you can add a credit pack.',
        code: 'SONG_CREDIT_LIMIT_REACHED',
      },
    };
  }
  if (error.name === 'FreeVocalLimitReached') {
    return {
      status: 402,
      body: {
        error: `You have used your ${FREE_VOCAL_LIMIT} free podcast and reel generations. Choose a membership or add a credit pack to generate more.`,
        code: 'FREE_VOCAL_LIMIT_REACHED',
      },
    };
  }
  if (error.name === 'VocalCreditLimitReached') {
    return {
      status: 402,
      body: {
        error: 'Your vocal allowance for this period has been used. Dialogue and spoken generations count as vocals. It renews automatically, or you can add a credit pack.',
        code: 'VOCAL_CREDIT_LIMIT_REACHED',
      },
    };
  }
  return undefined;
}

async function prepareLibrarySong(
  uid: string,
  style: string,
  lyrics: string,
  requestedTitle: string,
  songCreditSource: SongCreditSource,
  generator: SongGenerator,
  creditKind: 'song' | 'vocal' = 'song',
): Promise<LibrarySong> {
  const existing = await db.collection('users').doc(uid).collection('songs').select('title').get();
  const title = nextSongTitle(
    requestedTitle || 'Untitled',
    existing.docs.map((doc) => (typeof doc.data().title === 'string' ? doc.data().title : '')),
  );
  const coverTheme = coverThemeForSong(title, style, lyrics);
  const songId = randomUUID();
  const createdAt = new Date().toISOString();
  await db.collection('users').doc(uid).collection('songs').doc(songId).set({
    title,
    style,
    lyrics,
    generator,
    coverTheme,
    status: 'generating',
    rating: 0,
    visibility: 'private',
    songCreditSource,
    creditKind,
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    id: songId,
    title,
    style,
    lyrics,
    coverTheme,
    status: 'generating',
    rating: 0,
    visibility: 'private',
    preset: false,
    createdAt,
  };
}

async function renderLibrarySong(uid: string, songId: string): Promise<LibrarySong> {
  const songRef = db.collection('users').doc(uid).collection('songs').doc(songId);

  for (;;) {
    const decision = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(songRef);
      if (!snapshot.exists) throw new Error('That song was not found in your library.');
      const data = snapshot.data() ?? {};
      if (songStatus(data.status) === 'ready' && typeof data.gcsPath === 'string') {
        return { action: 'ready' as const, data };
      }
      if (songStatus(data.status) === 'failed') {
        throw new Error(typeof data.error === 'string' ? data.error : 'The song could not be generated.');
      }
      const started = (data.renderStartedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      if (data.status === 'rendering' && Date.now() - started < RENDER_STALE_MS) {
        return { action: 'wait' as const };
      }
      transaction.update(songRef, {
        status: 'rendering',
        renderStartedAt: FieldValue.serverTimestamp(),
        error: FieldValue.delete(),
      });
      return { action: 'start' as const, data };
    });

    if (decision.action === 'ready') return publicSong(songId, decision.data);
    if (decision.action === 'wait') {
      await sleep(2500);
      continue;
    }

    const style = typeof decision.data.style === 'string' ? decision.data.style : '';
    const lyrics = typeof decision.data.lyrics === 'string' ? decision.data.lyrics : '';
    try {
      const generator = resolveSongGenerator(style);
      const generated = generator === 'chirp-3-hd'
        ? await generateSpokenNarration(lyrics, style)
        : await generateSongWithLyria(style, lyrics);
      const latest = await songRef.get();
      if (!latest.exists) throw new Error('That song was deleted.');
      const gcsPath = await saveSongAudio(uid, songId, generated.audio);
      await songRef.set({
        notes: generated.notes || null,
        coverTheme: latest.data()?.coverTheme ?? coverThemeForSong(
          typeof latest.data()?.title === 'string' ? latest.data()!.title : '',
          style,
          lyrics,
        ),
        gcsPath,
        status: 'ready',
        error: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      const ready = await songRef.get();
      await refreshSongLinkIfPresent(db, songId, uid, ready.data() ?? {}).catch(() => undefined);
      return publicSong(songId, ready.data() ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The song could not be generated.';
      const latest = await songRef.get();
      if (latest.exists) {
        await songRef.set({
          status: 'failed',
          error: message,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

async function removeLibrarySong(uid: string, songId: string): Promise<void> {
  const songRef = db.collection('users').doc(uid).collection('songs').doc(songId);
  const snapshot = await songRef.get();
  if (!snapshot.exists) throw Object.assign(new Error('That song was not found in your library.'), { status: 404 });
  const path = snapshot.data()?.gcsPath;
  if (typeof path === 'string' && path) await deleteSongAudio(path);
  await unpublishCommunitySong(db, songId);
  await deleteSongLink(db, songId);
  await db.collection(PRESET_SONGS).doc(songId).delete().catch(() => undefined);
  await songRef.delete();
}

async function queueLibrarySongRender(uid: string, song: LibrarySong): Promise<void> {
  try {
    await enqueueSongRender(uid, song.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The song could not be queued for generation.';
    await db.collection('users').doc(uid).collection('songs').doc(song.id).set({
      status: 'failed',
      error: message,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await refundSongCredit(uid, song.id);
    throw error;
  }
}

api.post('/v1/songs/prepare', requireUser, async (req: AuthenticatedRequest, res) => {
  const parsed = parseSongRequest(req.body ?? {});
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const admin = await isAdministrator(req.user!);
    const creditKind = isVocalGeneration(parsed.generator, parsed.style) ? 'vocal' : 'song';
    const source = creditKind === 'vocal'
      ? await chargeVocalCredit(req.user!, admin)
      : await chargeSongCredit(req.user!, admin);
    const song = await prepareLibrarySong(
      req.user!.uid,
      parsed.style,
      parsed.lyrics,
      parsed.requestedTitle,
      source,
      parsed.generator,
      creditKind,
    );
    await queueLibrarySongRender(req.user!.uid, song);
    return res.json({ song });
  } catch (error) {
    const limit = songCreditError(error);
    if (limit) return res.status(limit.status).json(limit.body);
    const message = error instanceof Error ? error.message : 'The song could not be started.';
    return res.status(503).json({ error: message });
  }
});

api.post('/v1/songs/:songId/render', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    const song = await renderLibrarySong(req.user!.uid, songId);
    return res.json({ song });
  } catch (error) {
    await refundSongCredit(req.user!.uid, songId);
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error ? error.message : 'The song could not be generated.';
    return res.status(status).json({ error: message });
  }
});

api.post('/v1/internal/songs/:uid/:songId/render', requireSongRenderTask, async (req: Request, res) => {
  const uid = String(req.params.uid ?? '');
  const songId = String(req.params.songId ?? '');
  try {
    const song = await renderLibrarySong(uid, songId);
    return res.json({ song });
  } catch (error) {
    await refundSongCredit(uid, songId);
    const message = error instanceof Error ? error.message : 'The song could not be generated.';
    console.error('Asynchronous song render failed', { uid, songId, error });
    // The renderer has recorded a terminal failure; acknowledge the task so it
    // is not retried against a failed record.
    return res.status(200).json({ error: message });
  }
});

api.post('/v1/songs/generate', requireUser, async (req: AuthenticatedRequest, res) => {
  const parsed = parseSongRequest(req.body ?? {});
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  let pendingId: string | undefined;
  try {
    const admin = await isAdministrator(req.user!);
    const creditKind = isVocalGeneration(parsed.generator, parsed.style) ? 'vocal' : 'song';
    const source = creditKind === 'vocal'
      ? await chargeVocalCredit(req.user!, admin)
      : await chargeSongCredit(req.user!, admin);
    const pending = await prepareLibrarySong(
      req.user!.uid,
      parsed.style,
      parsed.lyrics,
      parsed.requestedTitle,
      source,
      parsed.generator,
      creditKind,
    );
    pendingId = pending.id;
    await queueLibrarySongRender(req.user!.uid, pending);
    return res.json({ song: pending });
  } catch (error) {
    const limit = songCreditError(error);
    if (limit) return res.status(limit.status).json(limit.body);
    if (pendingId) await refundSongCredit(req.user!.uid, pendingId);
    const message = error instanceof Error ? error.message : 'The song could not be generated.';
    return res.status(503).json({ error: message });
  }
});

api.get('/v1/songs', requireUser, async (req: AuthenticatedRequest, res) => {
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) ? Math.min(24, Math.max(1, Math.floor(requested))) : 50;
  const songs = db.collection('users').doc(req.user!.uid).collection('songs');
  let query = songs.orderBy('createdAt', 'desc');
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
  if (cursor) {
    const cursorDoc = await songs.doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }
  const snapshot = await query.limit(limit + 1).get();
  const page = snapshot.docs.slice(0, limit);
  const hasMore = snapshot.docs.length > limit;
  return res.json({
    songs: page.map((doc) => publicSong(doc.id, doc.data())),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
});

function sendMedia(
  req: Request,
  res: Response,
  bytes: Buffer,
  contentType: string,
  filename: string,
  cacheControl: string,
) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Accept-Ranges', 'bytes');
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.header('range') ?? '');
  if (range && (range[1] || range[2])) {
    const size = bytes.length;
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    start = Math.max(0, start);
    end = Math.max(start, end);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    return res.status(206).send(bytes.subarray(start, end + 1));
  }
  return res.send(bytes);
}

function audioDownloadName(title: string): { ascii: string; encoded: string } {
  const trimmed = title.trim() || 'hindi-song';
  const ascii = `${trimmed.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'hindi-song'}.mp3`;
  const encoded = encodeURIComponent(`${trimmed.replace(/[\\/]+/g, '-').replace(/^-|-$/g, '') || 'hindi-song'}.mp3`);
  return { ascii, encoded };
}

api.get('/v1/songs/:songId/audio', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const snapshot = await db.collection('users').doc(req.user!.uid).collection('songs').doc(songId).get();
  if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
  const path = snapshot.data()?.gcsPath;
  if (typeof path !== 'string') return res.status(404).json({ error: 'That song has no audio file.' });

  try {
    const audio = await readSongAudio(path);
    const title = typeof snapshot.data()?.title === 'string' ? snapshot.data()!.title : 'hindi-song';
    const filename = audioDownloadName(title);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename.ascii}"; filename*=UTF-8''${filename.encoded}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(audio);
  } catch (error) {
    console.error('Failed to read song audio', { songId, path, error });
    return res.status(404).json({ error: 'The audio file could not be read.' });
  }
});

api.get('/v1/songs/:songId/video', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const snapshot = await db.collection('users').doc(req.user!.uid).collection('songs').doc(songId).get();
  if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
  const data = snapshot.data()!;
  if (typeof data.gcsPath !== 'string') return res.status(404).json({ error: 'That song has no audio file.' });

  try {
    const video = await cachedSongVideo(data.gcsPath, publicSong(songId, data).coverTheme as CoverTheme);
    return sendMedia(req, res, video, 'video/mp4', `${audioDownloadName(typeof data.title === 'string' ? data.title : 'song').ascii.replace(/\.mp3$/, '.mp4')}`, 'private, max-age=3600');
  } catch (error) {
    console.error('Failed to render song video', { songId, error });
    return res.status(503).json({ error: 'The video for YouTube could not be prepared. Please try again.' });
  }
});

async function handleDeleteSong(req: AuthenticatedRequest, res: Response) {
  const songId = String(req.params.songId ?? '');
  try {
    await removeLibrarySong(req.user!.uid, songId);
    return res.json({ ok: true });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error && status === 404
      ? error.message
      : 'The song could not be deleted. Please try again.';
    if (status !== 404) console.error('Failed to delete song', { songId, error });
    return res.status(status).json({ error: message });
  }
}

api.delete('/v1/songs/:songId', requireUser, handleDeleteSong);
api.post('/v1/songs/:songId/delete', requireUser, handleDeleteSong);

api.post('/v1/songs/:songId/title', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const requested = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!requested || requested.length > 80) {
    return res.status(400).json({ error: 'Enter a song name of 1 to 80 characters.' });
  }

  const songRef = db.collection('users').doc(req.user!.uid).collection('songs').doc(songId);
  try {
    const snapshot = await songRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
    const existing = await db.collection('users').doc(req.user!.uid).collection('songs').select('title').get();
    const title = nextSongTitle(
      requested,
      existing.docs
        .filter((doc) => doc.id !== songId)
        .map((doc) => (typeof doc.data().title === 'string' ? doc.data().title : '')),
    );
    await songRef.set({ title, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (snapshot.data()?.visibility === 'public') await renameCommunitySong(db, songId, title);
    await renameSongLink(db, songId, title);
    await renamePresetSong(db, songId, title);
    return res.json({ song: publicSong(songId, { ...snapshot.data(), title }) });
  } catch (error) {
    console.error('Failed to rename song', { songId, error });
    return res.status(503).json({ error: 'The song could not be renamed. Please try again.' });
  }
});

api.post('/v1/songs/:songId/feedback', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const rating = req.body?.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 0 to 5.' });
  }
  const update = { rating };

  const songRef = db.collection('users').doc(req.user!.uid).collection('songs').doc(songId);
  try {
    const snapshot = await songRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
    await songRef.update(update);
    return res.json({ song: publicSong(songId, { ...snapshot.data(), ...update }) });
  } catch (error) {
    console.error('Failed to save song feedback', { songId, error });
    return res.status(503).json({ error: 'Your rating could not be saved. Please try again.' });
  }
});

api.post('/v1/songs/:songId/share-link', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const songRef = db.collection('users').doc(req.user!.uid).collection('songs').doc(songId);
  try {
    const snapshot = await songRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
    const data = snapshot.data() ?? {};
    await upsertSongLink(db, songId, req.user!.uid, data, {
      displayName: req.user!.name ?? null,
      email: req.user!.email ?? null,
    });
    return res.json({ songId, sharePath: `/s/${songId}` });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error ? error.message : 'The shareable link could not be created.';
    if (status >= 500) console.error('Failed to create shareable link', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.post('/v1/songs/:songId/visibility', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const visibility = req.body?.visibility === 'public' ? 'public' : req.body?.visibility === 'private' ? 'private' : null;
  if (!visibility) return res.status(400).json({ error: 'Choose public or private.' });

  const songRef = db.collection('users').doc(req.user!.uid).collection('songs').doc(songId);
  try {
    const snapshot = await songRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
    const data = snapshot.data() ?? {};
    if (visibility === 'public') {
      const owner = await db.collection('users').doc(req.user!.uid).get();
      await publishCommunitySong(db, songId, req.user!.uid, data, {
        displayName: (owner.data()?.displayName as string | null | undefined) ?? req.user!.name ?? null,
        email: (owner.data()?.email as string | null | undefined) ?? req.user!.email ?? null,
      });
    } else {
      await makeCommunitySongPrivate(db, req.user!.uid, songId);
    }
    const updated = await songRef.get();
    return res.json({ song: publicSong(songId, updated.data() ?? { ...data, visibility }) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error ? error.message : 'The song visibility could not be updated.';
    if (status >= 500) console.error('Failed to update song visibility', { songId, error });
    return res.status(status).json({ error: message });
  }
});

function requestedExploreKind(value: unknown): ExploreKind | undefined {
  return EXPLORE_KINDS.find((kind) => kind === value);
}

api.get('/v1/community/explore', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json({ rails: await listExploreRails(db, req.user!.uid, 6) });
  } catch (error) {
    console.error('Failed to list explore rails', { error });
    return res.status(503).json({ error: 'Community songs could not be loaded. Please try again.' });
  }
});

api.get('/v1/community/songs', requireUser, async (req: AuthenticatedRequest, res) => {
  const sort = req.query.sort === 'top' || req.query.sort === 'favorites' ? req.query.sort : 'featured';
  const kind = requestedExploreKind(req.query.kind);
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) ? Math.min(48, Math.max(1, Math.floor(requested))) : 6;
  try {
    const songs = sort === 'favorites'
      ? (await listFavoriteCommunitySongs(db, req.user!.uid, kind ? 48 : limit)).filter((song) => !kind || song.kind === kind).slice(0, limit)
      : await listCommunitySongs(db, sort, limit, req.user!.uid, kind);
    return res.json({ songs });
  } catch (error) {
    console.error('Failed to list community songs', { sort, error });
    return res.status(503).json({ error: 'Community songs could not be loaded. Please try again.' });
  }
});

api.post('/v1/community/songs/:songId/play', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    return res.json({ viewCount: await recordCommunityPlay(db, songId, req.user!.uid) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error ? error.message : 'The play could not be recorded.';
    if (status >= 500) console.error('Failed to record community play', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.post('/v1/community/songs/:songId/vote', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const vote = req.body?.vote === 'like' || req.body?.vote === 'dislike' || req.body?.vote === null
    ? req.body.vote
    : undefined;
  if (vote === undefined) return res.status(400).json({ error: 'Choose like, dislike, or clear the vote.' });
  try {
    return res.json({ song: await rateCommunitySong(db, songId, req.user!.uid, vote) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error ? error.message : 'The rating could not be saved.';
    if (status >= 500) console.error('Failed to rate community song', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.get('/v1/public/community/top', async (req, res) => {
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) ? Math.min(24, Math.max(1, Math.floor(requested))) : 12;
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ songs: await listPublicTopCommunitySongs(db, limit) });
  } catch (error) {
    console.error('Failed to list public top songs', { error });
    return res.status(503).json({ error: 'Top songs could not be loaded.' });
  }
});

api.get('/v1/public/songs/:songId', async (req, res) => {
  const songId = String(req.params.songId ?? '');
  const song = await getSharedSong(db, songId);
  if (!song) return res.status(404).json({ error: 'This song is no longer available.' });
  return res.json({ song });
});

api.get('/v1/public/songs/:songId/audio', async (req, res) => {
  const songId = String(req.params.songId ?? '');
  const file = await getSharedSongAudioPath(db, songId);
  if (!file) return res.status(404).json({ error: 'This song is no longer available.' });
  try {
    const audio = await readSongAudio(file.path);
    const filename = audioDownloadName(file.title);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename.ascii}"; filename*=UTF-8''${filename.encoded}`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.header('range') ?? '');
    if (range && (range[1] || range[2])) {
      const size = audio.length;
      let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      start = Math.max(0, start);
      end = Math.max(start, end);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      return res.status(206).send(audio.subarray(start, end + 1));
    }
    return res.send(audio);
  } catch (error) {
    console.error('Failed to read shared song audio', { songId, path: file.path, error });
    return res.status(404).json({ error: 'The audio file could not be read.' });
  }
});

async function sendSharedSongVideo(songId: string, req: Request, res: Response) {
  const song = await getSharedSong(db, songId);
  const file = await getSharedSongAudioPath(db, songId);
  if (!song || !file) return res.status(404).json({ error: 'This song is no longer available.' });
  try {
    const video = await cachedSongVideo(file.path, song.coverTheme);
    const filename = audioDownloadName(file.title).ascii.replace(/\.mp3$/, '.mp4');
    return sendMedia(req, res, video, 'video/mp4', filename, 'public, max-age=86400');
  } catch (error) {
    console.error('Failed to render shared song video', { songId, error });
    return res.status(503).json({ error: 'The video could not be prepared. Please try again.' });
  }
}

api.get('/v1/public/songs/:songId/video', async (req, res) => {
  return sendSharedSongVideo(String(req.params.songId ?? ''), req, res);
});

api.get('/v1/community/songs/:songId/audio', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const snapshot = await db.collection('communitySongs').doc(songId).get();
  if (!snapshot.exists) return res.status(404).json({ error: 'That song is not in the community library.' });
  const path = snapshot.data()?.gcsPath;
  if (typeof path !== 'string') return res.status(404).json({ error: 'That song has no audio file.' });

  try {
    const audio = await readSongAudio(path);
    const title = typeof snapshot.data()?.title === 'string' ? snapshot.data()!.title : 'hindi-song';
    const filename = audioDownloadName(title);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename.ascii}"; filename*=UTF-8''${filename.encoded}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(audio);
  } catch (error) {
    console.error('Failed to read community song audio', { songId, path, error });
    return res.status(404).json({ error: 'The audio file could not be read.' });
  }
});

api.post('/v1/songs/:songId/preset', requireUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const preset = req.body?.preset === true ? true : req.body?.preset === false ? false : null;
  if (preset === null) return res.status(400).json({ error: 'Choose whether this audio is a preset.' });

  const songRef = db.collection('users').doc(req.user!.uid).collection('songs').doc(songId);
  try {
    const snapshot = await songRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'That song was not found in your library.' });
    const data = snapshot.data() ?? {};
    if (preset) {
      const owner = await db.collection('users').doc(req.user!.uid).get();
      await markPresetSong(db, songId, req.user!.uid, data, {
        uid: req.user!.uid,
        email: req.user!.email ?? null,
      }, {
        displayName: (owner.data()?.displayName as string | null | undefined) ?? req.user!.name ?? null,
        email: (owner.data()?.email as string | null | undefined) ?? req.user!.email ?? null,
      });
    } else {
      await unmarkPresetSong(db, songId);
    }
    const updated = await songRef.get();
    return res.json({ song: publicSong(songId, updated.data() ?? { ...data, preset }) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error && status < 500 ? error.message : 'The preset could not be updated.';
    if (status >= 500) console.error('Failed to update preset', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.get('/v1/presets', requireUser, async (req: AuthenticatedRequest, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
  try {
    return res.json({ presets: await listPresetSongs(db, req.user!.uid, search) });
  } catch (error) {
    console.error('Failed to list presets', { error });
    return res.status(503).json({ error: 'Presets could not be loaded. Please try again.' });
  }
});

api.get('/v1/presets/:songId', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    const preset = await getPresetDetail(db, songId, req.user!.uid);
    if (!preset) return res.status(404).json({ error: 'That preset is no longer available.' });
    return res.json({ preset });
  } catch (error) {
    console.error('Failed to load preset', { songId, error });
    return res.status(503).json({ error: 'The preset could not be loaded. Please try again.' });
  }
});

api.post('/v1/presets/:songId/like', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  if (typeof req.body?.liked !== 'boolean') return res.status(400).json({ error: 'Choose like or unlike.' });
  try {
    return res.json({ preset: await likePresetSong(db, songId, req.user!.uid, req.body.liked) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error && status < 500 ? error.message : 'The like could not be saved.';
    if (status >= 500) console.error('Failed to like preset', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.get('/v1/presets/:songId/audio', requireUser, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  const file = await getPresetAudioPath(db, songId);
  if (!file) return res.status(404).json({ error: 'That preset is no longer available.' });
  try {
    const audio = await readSongAudio(file.path);
    const filename = audioDownloadName(file.title);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename.ascii}"; filename*=UTF-8''${filename.encoded}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(audio);
  } catch (error) {
    console.error('Failed to read preset audio', { songId, path: file.path, error });
    return res.status(404).json({ error: 'The audio file could not be read.' });
  }
});

api.post('/v1/admin/presets/:songId/category', requireUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    return res.json({ preset: await setPresetCategory(db, songId, req.body?.category, req.user!.uid) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error && status < 500 ? error.message : 'The preset category could not be saved.';
    if (status >= 500) console.error('Failed to save preset category', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.post('/v1/admin/presets/:songId/fields', requireUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    return res.json({ preset: await setPresetFields(db, songId, req.body?.fieldTokens, req.user!.uid) });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 503;
    const message = error instanceof Error && status < 500 ? error.message : 'The preset fields could not be saved.';
    if (status >= 500) console.error('Failed to save preset fields', { songId, error });
    return res.status(status).json({ error: message });
  }
});

api.delete('/v1/admin/presets/:songId', requireUser, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const songId = String(req.params.songId ?? '');
  try {
    await unmarkPresetSong(db, songId);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to remove preset', { songId, error });
    return res.status(503).json({ error: 'The preset could not be removed.' });
  }
});

function membershipLabel(user: UserRecord, admin: boolean): string {
  if (admin) return 'Admin';
  if (!isPaidMember(user)) {
    return user.subscriptionStatus && user.subscriptionStatus !== 'none' ? `Free (${user.subscriptionStatus})` : 'Free';
  }
  const offer = activeSubscriptionOffer(user);
  const plan = offer?.plan ?? user.plan ?? 'creator';
  const name = plan.charAt(0).toUpperCase() + plan.slice(1);
  return offer?.id ? `${name} · ${offer.id}` : name;
}

api.get('/v1/admin/users', requireUser, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await db.collection('users').limit(1000).get();
    const adminEmails = new Set([...DEFAULT_ADMIN_EMAILS, ...(process.env.ADMIN_EMAILS ?? '').split(',')]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean));
    const users = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data() as UserRecord & { createdAt?: Timestamp };
      const songCount = await doc.ref.collection('songs').count().get()
        .then((result) => result.data().count)
        .catch(() => 0);
      const admin = data.isAdmin === true || (!!data.email && adminEmails.has(data.email.toLowerCase()));
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : doc.createTime?.toDate().toISOString() ?? null;
      return {
        uid: doc.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        membership: membershipLabel(data, admin),
        isAdmin: admin,
        memberSince: createdAt,
        generationCount: Math.max(songCount, (data.lifetimeSongCount ?? 0) + (data.lifetimeVocalCount ?? 0)),
        librarySongCount: songCount,
        promptCount: data.lifetimePromptCount ?? 0,
      };
    }));
    users.sort((left, right) => (right.memberSince ?? '').localeCompare(left.memberSince ?? ''));
    return res.json({ users });
  } catch (error) {
    console.error('Failed to list users for admin', { error });
    return res.status(503).json({ error: 'Users could not be loaded. Please try again.' });
  }
});

api.post('/v1/generations', requireUser, async (req: AuthenticatedRequest, res) => {
  const lyrics = typeof req.body?.lyrics === 'string' ? req.body.lyrics.trim() : '';
  if (!lyrics || lyrics.length > 20_000) {
    return res.status(400).json({ error: 'Lyrics must contain between 1 and 20,000 characters.' });
  }

  // Calculate before the transaction. The result is only returned after the
  // transaction atomically confirms this account is entitled to it.
  const result = analyzeLyrics(
    lyrics,
    parseOptions(req.body?.options),
    parseVariationIndex(req.body?.variationIndex),
  );
  const userRef = db.collection('users').doc(req.user!.uid);
  const tokenAdmin = await isAdministrator(req.user!);

  try {
    const entitlement = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const user = snapshot.exists ? snapshot.data() as UserRecord : defaultUser(req.user!);
      const admin = tokenAdmin || user.isAdmin === true;
      const offer = activeSubscriptionOffer(user);
      const paid = !admin && isPaidMember(user) && offer !== undefined;
      const expiredWindow = paid && creditWindowIsExpired(user.creditWindowStartedAt, offer.creditPeriod);
      const availableSubscriptionCredits = paid
        ? expiredWindow ? offer.credits : user.subscriptionCreditsRemaining ?? offer.credits
        : 0;
      const purchasedPromptCredits = user.purchasedPromptCredits ?? 0;
      let nextCount = user.lifetimePromptCount;
      let nextSubscriptionCredits = user.subscriptionCreditsRemaining;
      let nextPurchasedCredits = purchasedPromptCredits;
      let usageSource: 'admin' | 'free' | 'subscription' | 'credit-pack' = 'admin';

      if (!admin && paid && availableSubscriptionCredits > 0) {
        nextSubscriptionCredits = availableSubscriptionCredits - 1;
        usageSource = 'subscription';
      } else if (!admin && paid && purchasedPromptCredits > 0) {
        nextPurchasedCredits -= 1;
        usageSource = 'credit-pack';
      } else if (!admin && !paid && nextCount < FREE_PROMPT_LIMIT) {
        nextCount += 1;
        usageSource = 'free';
      } else if (!admin && !paid && purchasedPromptCredits > 0) {
        nextPurchasedCredits -= 1;
        usageSource = 'credit-pack';
      } else {
        const exhausted = new Error(paid ? 'PROMPT_CREDIT_LIMIT_REACHED' : 'FREE_PROMPT_LIMIT_REACHED');
        exhausted.name = paid ? 'PromptCreditLimitReached' : 'FreePromptLimitReached';
        throw exhausted;
      }

      transaction.set(userRef, {
        ...user,
        lifetimePromptCount: nextCount,
        ...(paid
          ? {
              subscriptionCreditsRemaining: nextSubscriptionCredits,
              creditWindowStartedAt: expiredWindow || !user.creditWindowStartedAt
                ? Timestamp.now()
                : user.creditWindowStartedAt,
            }
          : {}),
        purchasedPromptCredits: nextPurchasedCredits,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const eventRef = db.collection('generationEvents').doc();
      transaction.set(eventRef, {
        uid: req.user!.uid,
        createdAt: FieldValue.serverTimestamp(),
        plan: admin ? 'admin' : paid ? offer.plan : 'free',
        usageSource,
        lifetimePromptCountAfter: nextCount,
      });

      return publicEntitlement({
        ...user,
        lifetimePromptCount: nextCount,
        subscriptionCreditsRemaining: nextSubscriptionCredits,
        purchasedPromptCredits: nextPurchasedCredits,
        creditWindowStartedAt: paid && (expiredWindow || !user.creditWindowStartedAt)
          ? Timestamp.now()
          : user.creditWindowStartedAt,
      }, admin);
    });

    return res.json({ result, entitlement });
  } catch (error) {
    if (error instanceof Error && error.name === 'FreePromptLimitReached') {
      return res.status(402).json({
        error: 'You have used all 3 lifetime free song prompts. Choose a membership or purchase a credit pack to continue.',
        code: 'FREE_PROMPT_LIMIT_REACHED',
      });
    }
    if (error instanceof Error && error.name === 'PromptCreditLimitReached') {
      return res.status(402).json({
        error: 'Your current prompt allowance has been used. Your next allowance will renew automatically, or you can add a credit pack.',
        code: 'PROMPT_CREDIT_LIMIT_REACHED',
      });
    }
    throw error;
  }
});

api.post('/v1/billing/checkout', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const offer = billingOffer(typeof req.body?.offerId === 'string' ? req.body.offerId : undefined);
    if (!offer) return res.status(400).json({ error: 'Choose a valid membership or credit pack.' });
    const provider = req.body?.provider === 'payu' ? 'payu' : req.body?.provider === 'stripe' ? 'stripe' : undefined;
    if (!provider) return res.status(400).json({ error: 'Choose PayU or Stripe.' });
    const sandboxAdmin = sandboxPaymentMode() && await isAdministrator(req.user!);
    const billingCountry = await billingCountryForRequest(req);
    const stripeCountry = billingCountry === 'US' || billingCountry === 'GB';
    if (!sandboxAdmin && !stripeCountry && provider !== 'payu') {
      return res.status(400).json({ error: 'PayU is the available payment provider for your billing country.' });
    }
    if (!sandboxAdmin && stripeCountry && provider !== 'stripe') {
      return res.status(400).json({ error: 'Stripe is the available payment provider for billing in the US and UK.' });
    }
    const userRef = db.collection('users').doc(req.user!.uid);
    const user = await loadUser(req.user!);
    if (offer.kind === 'subscription' && isPaidMember(user) && user.membershipOfferId !== offer.id) {
      if (req.body?.replaceMembership !== true) {
        return res.status(409).json({
          error: 'You already have a membership. Confirm that you want to cancel it before switching.',
          code: 'MEMBERSHIP_CHANGE_REQUIRED',
        });
      }
      await endActiveMembershipForSwitch(user, req.user!.uid);
    }
    if (provider === 'payu') {
      const phone = payuMobileNumber(req.body?.phone);
      if (!phone) {
        return res.status(400).json({ error: 'Enter a valid mobile number, including country code where needed, to pay with PayU.' });
      }
      const checkout = payuCheckout(offer, req.user!, phone);
      await rememberPayUCheckout(checkout.fields, offer, req.user!);
      return res.json(checkout);
    }

    const billing = stripeRequired();
    const priceId = requiredEnvironment(offer.priceEnvironmentVariable);
    const customerId = user.stripeCustomerId ?? (await billing.customers.create({
      email: user.email ?? undefined,
      name: user.displayName ?? undefined,
      metadata: { firebaseUid: req.user!.uid },
    })).id;

    if (!user.stripeCustomerId) {
      await userRef.set({ stripeCustomerId: customerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    const session = await billing.checkout.sessions.create({
      mode: offer.kind === 'subscription' ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBaseUrl}/payment-result?checkout=success&offer=${encodeURIComponent(offer.id)}`,
      cancel_url: `${appBaseUrl}/payment-result?checkout=canceled&offer=${encodeURIComponent(offer.id)}`,
      client_reference_id: req.user!.uid,
      metadata: { firebaseUid: req.user!.uid, billingOfferId: offer.id },
      ...(offer.kind === 'subscription'
        ? { subscription_data: { metadata: { firebaseUid: req.user!.uid, billingOfferId: offer.id } } }
        : {}),
      allow_promotion_codes: true,
    });
    if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
    return res.json({ provider: 'stripe', url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start checkout.';
    return res.status(503).json({ error: message });
  }
});

api.post('/v1/billing/test-payu-checkout', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const offer = billingOffer(typeof req.body?.offerId === 'string' ? req.body.offerId : undefined);
    if (!offer || offer.kind !== 'credit-pack') {
      return res.status(400).json({ error: 'Choose a one-time credit pack to test PayU.' });
    }
    const phone = payuMobileNumber(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid mobile number to test PayU.' });
    }
    return res.json(payuTestCheckout(offer, req.user!, phone));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start test checkout.';
    return res.status(503).json({ error: message });
  }
});

let portalConfigurationId: string | undefined;
const PORTAL_CONFIGURATION_TAG = 'desi-dhun-portal-v1';

/**
 * The portal refuses to open unless the account has a configuration. Creating
 * one from here means the feature works without anyone visiting the Stripe
 * dashboard, and it pins cancellation to the end of the paid period.
 */
async function billingPortalConfiguration(billing: Stripe): Promise<string> {
  if (portalConfigurationId) return portalConfigurationId;

  // Matched by tag rather than by "default", so a container cold start reuses
  // the existing configuration instead of creating another one.
  const existing = await billing.billingPortal.configurations.list({ active: true, limit: 100 });
  const reusable = existing.data.find((configuration) => configuration.metadata?.tag === PORTAL_CONFIGURATION_TAG);
  if (reusable) {
    portalConfigurationId = reusable.id;
    return portalConfigurationId;
  }

  const configuration = await billing.billingPortal.configurations.create({
    metadata: { tag: PORTAL_CONFIGURATION_TAG },
    business_profile: { headline: 'Desi Dhun — manage your membership' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'unused', 'customer_service', 'other'],
        },
      },
    },
    default_return_url: appBaseUrl,
  });
  portalConfigurationId = configuration.id;
  return portalConfigurationId;
}

api.post('/v1/billing/portal', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await loadUser(req.user!);
    if (user.billingProvider === 'payu') {
      return res.status(409).json({ error: 'PayU memberships are managed through PayU until mandate management is configured.' });
    }
    const billing = stripeRequired();
    if (!user.stripeCustomerId) return res.status(400).json({ error: 'No billing account exists yet.' });
    const session = await billing.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      configuration: await billingPortalConfiguration(billing),
      return_url: appBaseUrl,
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('Failed to open billing portal', error);
    return res.status(503).json({ error: 'The billing portal could not be opened. Please try again.' });
  }
});

async function endActiveMembershipForSwitch(user: UserRecord, uid: string): Promise<void> {
  if (user.billingProvider === 'payu') {
    await revokePayUMandate(user);
    await db.collection('users').doc(uid).set({
      plan: 'free',
      subscriptionStatus: 'canceled',
      cancelAtPeriodEnd: false,
      payuSubscriptionId: FieldValue.delete(),
      payuMandateId: FieldValue.delete(),
      payuMandateCommand: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  const billing = stripeRequired();
  const subscriptionId = await activeSubscriptionId(billing, user);
  if (!subscriptionId) return;
  const subscription = await billing.subscriptions.cancel(subscriptionId);
  await syncSubscription(subscription);
}

async function activeSubscriptionId(billing: Stripe, user: UserRecord): Promise<string | undefined> {
  if (user.stripeSubscriptionId) return user.stripeSubscriptionId;
  if (!user.stripeCustomerId) return undefined;
  const subscriptions = await billing.subscriptions.list({
    customer: user.stripeCustomerId,
    status: 'active',
    limit: 1,
  });
  return subscriptions.data[0]?.id;
}

/**
 * Cancels at the end of the paid period rather than immediately, so the member
 * keeps the allowance they already paid for and is simply not renewed.
 */
api.post('/v1/billing/cancel', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await loadUser(req.user!);
    if (user.billingProvider === 'payu') {
      await revokePayUMandate(user);
      await db.collection('users').doc(req.user!.uid).set({
        cancelAtPeriodEnd: true,
        payuMandateId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      const updatedUser = await loadUser(req.user!);
      await sendCancellationEmail(updatedUser.email, updatedUser.displayName, updatedUser.currentPeriodEnd?.toDate());
      return res.json({ entitlement: publicEntitlement(updatedUser, await isAdministrator(req.user!)) });
    }
    const billing = stripeRequired();
    const subscriptionId = await activeSubscriptionId(billing, user);
    if (!subscriptionId) return res.status(400).json({ error: 'No active membership to cancel.' });

    const subscription = await billing.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    await syncSubscription(subscription);
    const updatedUser = await loadUser(req.user!);
    await sendCancellationEmail(updatedUser.email, updatedUser.displayName, updatedUser.currentPeriodEnd?.toDate());
    return res.json({ entitlement: publicEntitlement(updatedUser, await isAdministrator(req.user!)) });
  } catch (error) {
    console.error('Failed to cancel membership', error);
    return res.status(503).json({ error: 'Your membership could not be cancelled. Please try again.' });
  }
});

/** Undoes a scheduled cancellation while the period is still running. */
api.post('/v1/billing/resume', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await loadUser(req.user!);
    if (user.billingProvider === 'payu') {
      return res.status(409).json({ error: 'A cancelled PayU mandate cannot be resumed. Subscribe again to set up a new mandate.' });
    }
    const billing = stripeRequired();
    const subscriptionId = user.stripeSubscriptionId;
    if (!subscriptionId) return res.status(400).json({ error: 'No membership to resume.' });

    const subscription = await billing.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    await syncSubscription(subscription);
    return res.json({ entitlement: publicEntitlement(await loadUser(req.user!), await isAdministrator(req.user!)) });
  } catch (error) {
    console.error('Failed to resume membership', error);
    return res.status(503).json({ error: 'Your membership could not be resumed. Please try again.' });
  }
});

async function verifyPayUPayment(transactionId: string): Promise<Record<string, unknown>> {
  const key = payuRequired('PAYU_MERCHANT_KEY');
  const command = 'verify_payment';
  const body = new URLSearchParams({
    key,
    command,
    var1: transactionId,
    hash: sha512(`${key}|${command}|${transactionId}|${payuRequired('PAYU_MERCHANT_SALT')}`),
  });
  const response = await fetch(payuPostServiceUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PayU verification returned ${response.status}.`);
  const result = await response.json() as { status?: number; transaction_details?: Record<string, Record<string, unknown>> };
  const transaction = result.transaction_details?.[transactionId];
  if (result.status !== 1 || !transaction) throw new Error('PayU did not confirm this transaction.');
  return transaction;
}

function payuString(transaction: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = transaction[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function payuMandateCommand(transaction: Record<string, unknown>): 'mandate_revoke' | 'upi_mandate_revoke' {
  const paymentMethod = [
    payuString(transaction, 'payment_source'),
    payuString(transaction, 'mode'),
    payuString(transaction, 'bankcode'),
    payuString(transaction, 'PG_TYPE'),
  ].filter(Boolean).join(' ').toLowerCase();
  return /\bupi\b/.test(paymentMethod) ? 'upi_mandate_revoke' : 'mandate_revoke';
}

function payuMandateAlreadyInactive(message: string | undefined): boolean {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('mandate entry not found')
    || normalized.includes('mandate is not active')
    || normalized.includes('consent is not mandated')
    || normalized.includes('already revoked')
    || normalized.includes('already cancelled')
    || normalized.includes('already canceled')
  );
}

/**
 * Stops future PayU renewals. Some UPI Intent checkouts never create a mandate
 * even when si=1 was sent, so "not found" / "not mandated" is treated as
 * already non-renewing rather than a hard failure.
 */
async function revokePayUMandate(user: UserRecord): Promise<'revoked' | 'already-inactive'> {
  const mandateId = user.payuMandateId ?? user.payuSubscriptionId;
  let command = user.payuMandateCommand;
  let resolvedMandateId = mandateId;

  if (user.payuTransactionId) {
    try {
      const transaction = await verifyPayUPayment(user.payuTransactionId);
      command ??= payuMandateCommand(transaction);
      resolvedMandateId = user.payuMandateId
        ?? payuString(transaction, 'authpayuid', 'authPayuId', 'auth_payu_id', 'mihpayid')
        ?? user.payuSubscriptionId;
    } catch (error) {
      console.warn('PayU mandate lookup via verify_payment failed', {
        txnid: user.payuTransactionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!resolvedMandateId) {
    console.warn('PayU mandate id missing; marking membership non-renewing without a revoke call');
    return 'already-inactive';
  }

  command ??= 'upi_mandate_revoke';
  const requestId = `dd-revoke-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const var1 = JSON.stringify({ authPayuId: resolvedMandateId, requestId });
  const key = payuRequired('PAYU_MERCHANT_KEY');
  const body = new URLSearchParams({
    key,
    command,
    var1,
    form: '2',
    hash: sha512(`${key}|${command}|${var1}|${payuRequired('PAYU_MERCHANT_SALT')}`),
  });
  const response = await fetch(payuPostServiceUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({})) as { status?: number | string; message?: string; Message?: string };
  if (Number(result.status) === 1) return 'revoked';
  const message = result.message ?? result.Message;
  if (payuMandateAlreadyInactive(message)) {
    console.warn('PayU mandate already inactive or was never registered', {
      mandateId: resolvedMandateId,
      command,
      message,
    });
    return 'already-inactive';
  }
  throw new Error(message ?? 'PayU could not revoke the recurring mandate.');
}

function periodEndFor(offer: BillingOffer): Timestamp {
  const end = new Date();
  if (offer.creditPeriod === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  if (offer.creditPeriod === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  return Timestamp.fromDate(end);
}

async function sendPaymentReceiptOnce(
  receiptId: string,
  email: string | null | undefined,
  name: string | null | undefined,
  offer: BillingOffer,
  provider: 'Stripe' | 'PayU',
  transactionId: string,
): Promise<void> {
  const recipient = usableEmail(email);
  if (!recipient) {
    console.error('Payment receipt skipped because no usable email was available', {
      receiptId,
      provider,
      transactionId,
      billingOfferId: offer.id,
    });
    return;
  }
  const receiptRef = db.collection('paymentReceiptEmails').doc(receiptId);
  try {
    await receiptRef.create({
      email: recipient,
      billingOfferId: offer.id,
      provider,
      transactionId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Provider webhooks are delivered more than once; send exactly one receipt.
    return;
  }
  const sent = await sendPaymentReceipt(recipient, name, offer, provider, transactionId);
  if (!sent) {
    await receiptRef.set({ deliveryFailed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

async function markPayUCheckout(txnid: string, status: 'fulfilled' | 'abandoned'): Promise<void> {
  await db.collection('payuPendingPayments').doc(txnid).set({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function recoverPayUPayments(uid: string): Promise<void> {
  const pending = await db.collection('payuPendingPayments').where('uid', '==', uid).limit(20).get();
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const snapshot of pending.docs) {
    const data = snapshot.data() as {
      status?: string;
      offerId?: string;
      amount?: string;
      email?: string | null;
      firstname?: string | null;
      createdAt?: Timestamp;
    };
    if (data.status === 'fulfilled' || data.status === 'abandoned') continue;
    if (data.createdAt && data.createdAt.toMillis() < twoWeeksAgo) {
      await markPayUCheckout(snapshot.id, 'abandoned');
      continue;
    }
    try {
      await verifyAndFulfillPayUPayment({
        txnid: snapshot.id,
        udf1: uid,
        udf2: data.offerId ?? '',
        amount: data.amount ?? '',
        email: data.email ?? '',
        firstname: data.firstname ?? '',
      });
    } catch (error) {
      console.warn('PayU checkout recovery skipped', { uid, txnid: snapshot.id, error });
    }
  }
}

async function verifyAndFulfillPayUPayment(fields: Record<string, string>): Promise<void> {
  const uid = fields.udf1;
  const offer = billingOffer(fields.udf2);
  if (!uid || !offer || !fields.txnid) throw new Error('PayU callback is missing billing metadata.');
  if (fields.amount !== fixedAmount(offer.amountPaise)) throw new Error('PayU callback amount does not match the selected offer.');

  const transaction = await verifyPayUPayment(fields.txnid);
  const verifiedStatus = typeof transaction.status === 'string' ? transaction.status.toLowerCase() : '';
  const verifiedAmount = typeof transaction.amt === 'string' ? transaction.amt : String(transaction.amt ?? '');
  if (verifiedStatus !== 'success' || verifiedAmount !== fixedAmount(offer.amountPaise)) {
    if (verifiedStatus && verifiedStatus !== 'success') await markPayUCheckout(fields.txnid, 'abandoned');
    throw new Error('PayU did not verify a successful payment for the selected amount.');
  }

  const providerPaymentId = typeof transaction.mihpayid === 'string' ? transaction.mihpayid : fields.txnid;
  const mandateId = payuString(transaction, 'authpayuid', 'authPayuId', 'auth_payu_id')
    ?? (fields.authpayuid || fields.authPayuId || fields.mihpayid || undefined);
  const mandateCommand = payuMandateCommand({ ...transaction, ...fields });
  const eventRef = db.collection('payuWebhookEvents').doc(providerPaymentId);
  const userRef = db.collection('users').doc(uid);
  const fulfilled = await db.runTransaction(async (transactionWriter) => {
    if ((await transactionWriter.get(eventRef)).exists) return false;
    const userSnapshot = await transactionWriter.get(userRef);
    const user = userSnapshot.exists ? userSnapshot.data() as UserRecord : null;
    const baseUser = user ?? {
      email: fields.email || null,
      displayName: fields.firstname || null,
      plan: 'free' as MembershipPlan,
      lifetimePromptCount: 0,
      subscriptionStatus: 'none' as SubscriptionStatus,
    };
    const update: Record<string, unknown> = {
      billingProvider: 'payu',
      payuTransactionId: fields.txnid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (offer.kind === 'credit-pack') {
      update.purchasedPromptCredits = (user?.purchasedPromptCredits ?? 0) + offer.credits;
      update.purchasedSongCredits = (user?.purchasedSongCredits ?? 0) + offer.songCredits;
      update.purchasedVocalCredits = (user?.purchasedVocalCredits ?? 0) + offer.vocalCredits;
    } else if (offer.plan) {
      update.plan = offer.plan;
      update.membershipOfferId = offer.id;
      update.subscriptionStatus = 'active';
      update.cancelAtPeriodEnd = false;
      update.currentPeriodEnd = periodEndFor(offer);
      if (user?.stripePeriodStart) update.stripePeriodStart = FieldValue.delete();
      update.subscriptionCreditsRemaining = offer.credits;
      update.creditWindowStartedAt = Timestamp.now();
      update.songCreditsRemaining = offer.songCredits;
      update.songWindowStartedAt = Timestamp.now();
      update.vocalCreditsRemaining = offer.vocalCredits;
      update.vocalWindowStartedAt = Timestamp.now();
      update.payuSubscriptionId = providerPaymentId;
      update.payuMandateCommand = mandateCommand;
      // PayU UPI docs: authPayuId is the registration mihpayid.
      update.payuMandateId = mandateId || providerPaymentId;
    }
    transactionWriter.set(userRef, { ...baseUser, ...update }, { merge: true });
    transactionWriter.set(eventRef, {
      type: 'payment.verified',
      uid,
      billingOfferId: offer.id,
      transactionId: fields.txnid,
      providerPaymentId,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (offer.kind === 'subscription') {
      transactionWriter.set(db.collection('membershipHistory').doc(`payu-${providerPaymentId}-${offer.id}-active`), {
        uid,
        provider: 'payu',
        billingOfferId: offer.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        periodEnd: periodEndFor(offer),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return true;
  });
  await markPayUCheckout(fields.txnid, 'fulfilled');
  if (fulfilled) {
    const pending = await db.collection('payuPendingPayments').doc(fields.txnid).get();
    const pendingEmail = pending.data()?.email as string | null | undefined;
    const pendingName = pending.data()?.firstname as string | null | undefined;
    const email = await resolveAccountEmail(uid, fields.email, pendingEmail);
    const name = (fields.firstname || pendingName || null) as string | null;
    await sendPaymentReceiptOnce(
      `payu-${providerPaymentId}`,
      email,
      name,
      offer,
      'PayU',
      fields.txnid,
    );
  }
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Staging uses real Firebase identities in the same project. Never grant
  // production credits or send receipts for a sandbox gateway transaction.
  if (sandboxPaymentMode()) {
    console.info('Sandbox Stripe event received', { type: event.type, id: event.id });
    return;
  }
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.firebaseUid ?? session.client_reference_id;
      const offer = billingOffer(session.metadata?.billingOfferId);
      if (uid && typeof session.customer === 'string') {
        await db.collection('users').doc(uid).set({
          billingProvider: 'stripe',
          stripeCustomerId: session.customer,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (uid && offer?.kind === 'credit-pack' && session.payment_status === 'paid') {
        const eventRef = db.collection('stripeWebhookEvents').doc(event.id);
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (transaction) => {
          const processed = await transaction.get(eventRef);
          if (processed.exists) return;
          const userSnapshot = await transaction.get(userRef);
          const user = userSnapshot.exists ? userSnapshot.data() as UserRecord : null;
          transaction.set(userRef, {
            ...(user ?? {
              email: null,
              displayName: null,
              plan: 'free',
              lifetimePromptCount: 0,
              subscriptionStatus: 'none',
            }),
            purchasedPromptCredits: (user?.purchasedPromptCredits ?? 0) + offer.credits,
            purchasedSongCredits: (user?.purchasedSongCredits ?? 0) + offer.songCredits,
            purchasedVocalCredits: (user?.purchasedVocalCredits ?? 0) + offer.vocalCredits,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          transaction.set(eventRef, {
            type: event.type,
            uid,
            billingOfferId: offer.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        });
      }
      if (uid && offer && session.payment_status === 'paid') {
        await db.collection('stripeWebhookEvents').doc(event.id).set({
          type: event.type,
          uid,
          billingOfferId: offer.id,
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (uid && offer && session.payment_status === 'paid') {
        const firebaseUser = await auth.getUser(uid).catch(() => undefined);
        await sendPaymentReceiptOnce(
          `stripe-${event.id}`,
          await resolveAccountEmail(
            uid,
            session.customer_details?.email,
            session.customer_email,
            firebaseUser?.email,
          ),
          session.customer_details?.name ?? firebaseUser?.displayName,
          offer,
          'Stripe',
          session.payment_intent?.toString() ?? session.id,
        );
      }
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    }
    default:
      return;
  }
}

function stripeSubscriptionPeriod(subscription: Stripe.Subscription): { start: number; end: number } {
  const raw = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
  };
  const item = raw.items?.data?.[0];
  const start = raw.current_period_start ?? item?.current_period_start;
  const end = raw.current_period_end ?? item?.current_period_end;
  if (start && end && Number.isFinite(start) && Number.isFinite(end)) return { start, end };
  const now = Math.floor(Date.now() / 1000);
  return { start: now, end: now + 30 * 24 * 60 * 60 };
}

async function userDocForStripeCustomer(customerId: string, firebaseUid?: string) {
  const byCustomer = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (!byCustomer.empty) return byCustomer.docs[0];
  if (firebaseUid) {
    const byUid = await db.collection('users').doc(firebaseUid).get();
    if (byUid.exists) return byUid;
  }
  return undefined;
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const subscriptionData = subscription as unknown as {
    status: SubscriptionStatus;
    metadata: { billingOfferId?: string; firebaseUid?: string };
    items: { data: Array<{ price: { id: string } }> };
    cancel_at_period_end?: boolean;
  };
  const userDoc = await userDocForStripeCustomer(customerId, subscriptionData.metadata.firebaseUid);
  if (!userDoc) {
    console.error('Stripe subscription had no matching Desi Dhun user', {
      subscriptionId: subscription.id,
      customerId,
      firebaseUid: subscriptionData.metadata.firebaseUid,
    });
    return;
  }

  const offer = billingOffer(subscriptionData.metadata.billingOfferId)
    ?? BILLING_OFFERS.find((candidate) => process.env[candidate.priceEnvironmentVariable] === subscriptionData.items.data[0]?.price.id);
  if (!offer || offer.kind !== 'subscription' || !offer.plan) return;

  const period = stripeSubscriptionPeriod(subscription);
  const currentUser = userDoc.data() as UserRecord;
  const active = subscriptionData.status === 'active' || subscriptionData.status === 'trialing';
  const periodStart = Timestamp.fromMillis(period.start * 1000);
  const periodEnd = Timestamp.fromMillis(period.end * 1000);
  const isNewBillingPeriod = currentUser.stripePeriodStart?.toMillis() !== periodStart.toMillis();
  await userDoc.ref.set({
    billingProvider: 'stripe',
    stripeCustomerId: customerId,
    plan: active ? offer.plan : 'free',
    membershipOfferId: offer.id,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscriptionData.status,
    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end === true,
    currentPeriodEnd: periodEnd,
    stripePeriodStart: periodStart,
    ...(active && (isNewBillingPeriod || currentUser.membershipOfferId !== offer.id)
      ? {
          subscriptionCreditsRemaining: offer.credits,
          creditWindowStartedAt: Timestamp.now(),
          songCreditsRemaining: offer.songCredits,
          songWindowStartedAt: Timestamp.now(),
          vocalCreditsRemaining: offer.vocalCredits,
          vocalWindowStartedAt: Timestamp.now(),
        }
      : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection('membershipHistory').doc(
    `stripe-${subscription.id}-${period.start}-${subscriptionData.status}-${subscriptionData.cancel_at_period_end === true ? 'ending' : 'active'}`,
  ).set({
    uid: userDoc.id,
    provider: 'stripe',
    billingOfferId: offer.id,
    status: subscriptionData.status,
    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end === true,
    periodEnd,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function publicApiBaseUrl(): string {
  return (process.env.CLOUD_RUN_TASK_URL || process.env.PAYU_CALLBACK_BASE_URL || '')
    .replace(/\/$/, '')
    || 'https://deshi-dhun-api-365609890674.us-central1.run.app';
}

const server = express();
server.get('/s/:songId/video.mp4', async (req, res) => {
  return sendSharedSongVideo(String(req.params.songId ?? ''), req, res);
});

server.get('/s/:songId', async (req, res) => {
  const song = await getSharedSong(db, String(req.params.songId ?? ''));
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (!song) return res.status(404).send(missingSharedSongHtml(appBaseUrl));
  const id = encodeURIComponent(song.id);
  return res
    .type('html')
    .send(sharedSongHtml({
      song,
      appBaseUrl,
      audioUrl: `${publicApiBaseUrl()}/api/v1/public/songs/${id}/audio`,
      videoUrl: `${appBaseUrl.replace(/\/$/, '')}/s/${id}/video.mp4`,
    }));
});
server.use('/api', api);
server.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

server.listen(port, () => console.log(`Desi Dhun API listening on port ${port}`));
