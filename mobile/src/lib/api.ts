import type { User } from 'firebase/auth';
import type { AnalysisOptions, AnalysisResult } from '@shared/types';
import type { PaymentProvider } from '@shared/data/billing';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function apiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
  const baseUrl = raw.replace(/\/$/, '');
  if (!baseUrl) {
    throw new ApiError(
      'The app is not connected to a backend yet. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env and restart Expo.',
      503,
      'API_NOT_CONFIGURED',
    );
  }
  return baseUrl;
}

export function isApiConfigured(): boolean {
  return !!(process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL);
}

async function apiFetch<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string } & T;
  if (!response.ok) {
    throw new ApiError(body.error ?? 'The request could not be completed.', response.status, body.code);
  }
  return body;
}

/** Aborts a request after `ms` so a stalled render never hangs the screen forever. */
function timeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface Entitlement {
  plan: 'free' | 'creator' | 'pro' | 'studio' | 'admin';
  isPaid: boolean;
  isAdmin: boolean;
  lifetimePromptCount: number;
  freePromptsRemaining: number | null;
  subscriptionCreditsRemaining: number | null;
  purchasedPromptCredits: number | null;
  freeSongsRemaining: number | null;
  subscriptionSongCreditsRemaining: number | null;
  purchasedSongCredits: number | null;
  freeVocalsRemaining: number | null;
  subscriptionVocalCreditsRemaining: number | null;
  purchasedVocalCredits: number | null;
  subscriptionStatus: string;
  billingProvider: PaymentProvider | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  membershipOfferId: string | null;
}

export interface AccountHistoryEntry {
  id: string;
  category: 'payment' | 'membership';
  provider: PaymentProvider;
  offerId: string;
  status: string;
  occurredAt: string | null;
  amountPaise?: number;
  reference?: string;
}

export interface AccountDetails {
  name: string | null;
  email: string | null;
  membership: {
    plan: Entitlement['plan'];
    offerId: string | null;
    status: string;
    provider: PaymentProvider | null;
    periodEnd: string | null;
  };
  history: AccountHistoryEntry[];
}

export type LibrarySongStatus = 'generating' | 'rendering' | 'ready' | 'failed';

export interface LibrarySong {
  id: string;
  title: string;
  style: string;
  lyrics: string;
  notes?: string;
  error?: string;
  coverTheme?: string;
  status?: LibrarySongStatus;
  rating?: number;
  visibility?: 'private' | 'public';
  preset?: boolean;
  createdAt: string;
}

export type CommunityVote = 'like' | 'dislike';

export interface CommunitySong {
  id: string;
  title: string;
  artistName: string;
  coverTheme?: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  myVote: CommunityVote | null;
}

export type SongGenerator = 'lyria' | 'chirp-3-hd';
export type LyricsLanguage = 'hindi' | 'english' | 'other';
export type LyricsKind = 'song' | 'dialogue' | 'spoken';
export type BillingCountry = 'US' | 'GB' | 'OTHER';

export function songIsPending(song: LibrarySong): boolean {
  return song.status === 'generating' || song.status === 'rendering';
}

export function displaySongError(message: string): string {
  if (/lyria(?: 3\.5)? returned no audio/i.test(message)) {
    return 'Inappropriate lyrics. Try something else.';
  }
  return message;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return displaySongError(error.message);
  if (error instanceof Error && error.name === 'AbortError') return 'The request timed out. Please try again.';
  if (error instanceof Error && error.message) return displaySongError(error.message);
  return fallback;
}

export function getEntitlement(user: User) {
  return apiFetch<{ entitlement: Entitlement }>(user, '/api/v1/me');
}

export function getAccountDetails(user: User) {
  return apiFetch<AccountDetails>(user, '/api/v1/account');
}

export function generateCustomLyrics(
  user: User,
  prompt: string,
  language: LyricsLanguage = 'hindi',
  kind: LyricsKind = 'song',
) {
  return apiFetch<{ lyrics: string }>(user, '/api/v1/lyrics/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, language, kind }),
    signal: timeout(40_000),
  });
}

export function generateLyricsFromImage(
  user: User,
  prompt: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png',
  kind: LyricsKind = 'song',
) {
  return apiFetch<{ lyrics: string }>(user, '/api/v1/lyrics/generate-from-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, imageBase64, mimeType, kind }),
    signal: timeout(45_000),
  });
}

export function generateSongPrompt(user: User, lyrics: string, options: AnalysisOptions, variationIndex = 0) {
  return apiFetch<{ result: AnalysisResult; entitlement: Entitlement }>(user, '/api/v1/generations', {
    method: 'POST',
    body: JSON.stringify({ lyrics, options, variationIndex }),
    signal: timeout(60_000),
  });
}

/** Charges a credit, creates the pending song and queues the render on the server. */
export function prepareSong(
  user: User,
  style: string,
  lyrics: string,
  title: string,
  generator: SongGenerator,
) {
  return apiFetch<{ song: LibrarySong }>(user, '/api/v1/songs/prepare', {
    method: 'POST',
    body: JSON.stringify({ style, lyrics, title, generator }),
    signal: timeout(60_000),
  });
}

export function listLibrarySongs(user: User) {
  return apiFetch<{ songs: LibrarySong[] }>(user, '/api/v1/songs');
}

export function deleteLibrarySong(user: User, songId: string) {
  return apiFetch<{ ok: true }>(user, `/api/v1/songs/${songId}/delete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function renameLibrarySong(user: User, songId: string, title: string) {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/title`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function saveSongFeedback(user: User, songId: string, rating: number) {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });
}

export function setSongVisibility(user: User, songId: string, visibility: 'private' | 'public') {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
}

export function createShareableLink(user: User, songId: string) {
  return apiFetch<{ songId: string; sharePath: string }>(user, `/api/v1/songs/${songId}/share-link`, {
    method: 'POST',
  });
}

export function listCommunitySongs(user: User, sort: 'featured' | 'top' | 'favorites', limit = 20) {
  return apiFetch<{ songs: CommunitySong[] }>(user, `/api/v1/community/songs?sort=${sort}&limit=${limit}`);
}

export function recordCommunityPlay(user: User, songId: string) {
  return apiFetch<{ viewCount: number }>(user, `/api/v1/community/songs/${songId}/play`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rateCommunitySong(user: User, songId: string, vote: CommunityVote | null) {
  return apiFetch<{ song: CommunitySong }>(user, `/api/v1/community/songs/${songId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

export function getBillingCountry(user: User) {
  return apiFetch<{ billingCountry: BillingCountry }>(user, '/api/v1/billing/country');
}

export type CheckoutResponse =
  | { provider: 'stripe'; url: string }
  | { provider: 'payu'; url: string; fields: Record<string, string> };

export function startCheckout(user: User, offerId: string, provider: PaymentProvider, phone?: string) {
  return apiFetch<CheckoutResponse>(user, '/api/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ offerId, provider, phone }),
  });
}

export function openBillingPortal(user: User) {
  return apiFetch<{ url: string }>(user, '/api/v1/billing/portal', { method: 'POST' });
}

export function cancelMembership(user: User) {
  return apiFetch<{ entitlement: Entitlement }>(user, '/api/v1/billing/cancel', { method: 'POST' });
}

export function resumeMembership(user: User) {
  return apiFetch<{ entitlement: Entitlement }>(user, '/api/v1/billing/resume', { method: 'POST' });
}

export function librarySongAudioUrl(songId: string): string {
  return `${apiBaseUrl()}/api/v1/songs/${encodeURIComponent(songId)}/audio`;
}

export function communitySongAudioUrl(songId: string): string {
  return `${apiBaseUrl()}/api/v1/community/songs/${encodeURIComponent(songId)}/audio`;
}

export function songShareUrl(songId: string): string {
  const appBase = (process.env.EXPO_PUBLIC_APP_BASE_URL ?? 'https://desidhun.net').replace(/\/$/, '');
  return `${appBase}/s/${encodeURIComponent(songId)}`;
}
