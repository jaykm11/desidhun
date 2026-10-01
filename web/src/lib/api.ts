import type { User } from 'firebase/auth';
import type { AnalysisOptions, AnalysisResult } from '../types';
import type { PaymentProvider } from '../data/billing';

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

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new ApiError(
      'Prompt generation is not configured yet. Add VITE_API_BASE_URL when the Cloud Run API is deployed.',
      503,
      'API_NOT_CONFIGURED',
    );
  }
  return baseUrl;
}

async function apiFetch<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({})) as { error?: string; code?: string } & T;
  if (!response.ok) {
    throw new ApiError(body.error ?? 'The request could not be completed.', response.status, body.code);
  }
  return body;
}

export function getEntitlement(user: User) {
  return apiFetch<{ entitlement: Entitlement }>(user, '/api/v1/me');
}

export function getAccountDetails(user: User) {
  return apiFetch<AccountDetails>(user, '/api/v1/account');
}

export type LyricsLanguage = 'hindi' | 'english' | 'other';

export function generateCustomLyrics(
  user: User,
  prompt: string,
  language: LyricsLanguage = 'hindi',
  kind: 'song' | 'dialogue' | 'spoken' = 'song',
) {
  return apiFetch<{ lyrics: string }>(user, '/api/v1/lyrics/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, language, kind }),
    signal: AbortSignal.timeout(40_000),
  });
}

export function generateLyricsFromImage(
  user: User,
  prompt: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png',
  kind: 'song' | 'dialogue' | 'spoken' = 'song',
) {
  return apiFetch<{ lyrics: string }>(user, '/api/v1/lyrics/generate-from-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, imageBase64, mimeType, kind }),
    signal: AbortSignal.timeout(40_000),
  });
}

async function audioAsBase64(audio: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read recording.'));
    reader.onerror = () => reject(new Error('Could not read recording.'));
    reader.readAsDataURL(audio);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export async function analyzeRecordedStyle(user: User, audio: Blob): Promise<{ style: string }> {
  const audioBase64 = await audioAsBase64(audio);
  return apiFetch<{ style: string }>(user, '/api/v1/style-recordings/analyze', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, mimeType: audio.type || 'audio/webm' }),
    signal: AbortSignal.timeout(40_000),
  });
}

export async function transcribeRecordedLyrics(user: User, audio: Blob): Promise<{ lyrics: string; language: 'hindi' | 'english' }> {
  const audioBase64 = await audioAsBase64(audio);
  return apiFetch<{ lyrics: string; language: 'hindi' | 'english' }>(user, '/api/v1/lyrics/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, mimeType: audio.type || 'audio/webm' }),
    signal: AbortSignal.timeout(45_000),
  });
}

export function generateSongPrompt(user: User, lyrics: string, options: AnalysisOptions, variationIndex = 0) {
  return apiFetch<{ result: AnalysisResult; entitlement: Entitlement }>(user, '/api/v1/generations', {
    method: 'POST',
    body: JSON.stringify({ lyrics, options, variationIndex }),
  });
}

export type CheckoutResponse =
  | { provider: 'stripe'; url: string }
  | { provider: 'payu'; url: string; fields: Record<string, string> };

export type BillingCountry = 'US' | 'GB' | 'OTHER';

export function getBillingCountry(user: User) {
  return apiFetch<{ billingCountry: BillingCountry }>(user, '/api/v1/billing/country');
}

export function startCheckout(user: User, offerId: string, provider: PaymentProvider, phone?: string, replaceMembership = false) {
  return apiFetch<CheckoutResponse>(user, '/api/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ offerId, provider, phone, replaceMembership }),
  });
}

export function startPayUTestCheckout(user: User, offerId: string, phone: string) {
  return apiFetch<Extract<CheckoutResponse, { provider: 'payu' }>>(user, '/api/v1/billing/test-payu-checkout', {
    method: 'POST',
    body: JSON.stringify({ offerId, phone }),
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

export function songIsPending(song: LibrarySong) {
  return song.status === 'generating' || song.status === 'rendering';
}

export function displaySongError(message: string): string {
  if (/lyria(?: 3\.5)? returned no audio/i.test(message)) {
    return 'Inappropriate lyrics. Try something else.';
  }
  return message;
}

export function prepareLyriaSong(
  user: User,
  style: string,
  lyrics: string,
  title?: string,
  generator: SongGenerator = 'lyria',
) {
  return apiFetch<{ song: LibrarySong }>(user, '/api/v1/songs/prepare', {
    method: 'POST',
    body: JSON.stringify({ style, lyrics, title, generator }),
  });
}

export function renderLyriaSong(user: User, songId: string) {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/render`, {
    method: 'POST',
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(270_000),
  });
}

export function generateLyriaSong(
  user: User,
  style: string,
  lyrics: string,
  title?: string,
  generator: SongGenerator = 'lyria',
) {
  return apiFetch<{ song: LibrarySong }>(user, '/api/v1/songs/generate', {
    method: 'POST',
    body: JSON.stringify({ style, lyrics, title, generator }),
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

export function saveSongFeedback(user: User, songId: string, feedback: { rating: number }) {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

export async function fetchSongAudio(user: User, songId: string): Promise<Blob> {
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/songs/${songId}/audio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? 'The song audio could not be loaded.', response.status);
  }
  return response.blob();
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

export function listCommunitySongs(user: User, sort: 'featured' | 'top' | 'favorites', limit = 6) {
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

export interface PublicSharedSong {
  id: string;
  title: string;
  artistName: string;
  coverTheme?: string;
}

export async function fetchPublicSong(songId: string): Promise<PublicSharedSong> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/public/songs/${encodeURIComponent(songId)}`);
  const body = await response.json().catch(() => ({})) as { song?: PublicSharedSong; error?: string };
  if (!response.ok || !body.song) {
    throw new ApiError(body.error ?? 'This song is no longer available.', response.status);
  }
  return body.song;
}

export async function listPublicTopSongs(limit = 12): Promise<CommunitySong[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/public/community/top?limit=${limit}`);
  const body = await response.json().catch(() => ({})) as { songs?: CommunitySong[]; error?: string };
  if (!response.ok) throw new ApiError(body.error ?? 'Top songs could not be loaded.', response.status);
  return body.songs ?? [];
}

export function publicSongAudioUrl(songId: string): string {
  return `${getApiBaseUrl()}/api/v1/public/songs/${encodeURIComponent(songId)}/audio`;
}

export async function fetchPublicSongAudio(songId: string): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/public/songs/${encodeURIComponent(songId)}/audio`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? 'The shared song could not be loaded.', response.status);
  }
  return response.blob();
}

export async function fetchCommunitySongAudio(user: User, songId: string): Promise<Blob> {
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/community/songs/${songId}/audio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? 'The community song could not be loaded.', response.status);
  }
  return response.blob();
}

export type PresetCategory = 'songs' | 'messages' | 'reels';

export interface PresetSong {
  id: string;
  title: string;
  category: PresetCategory;
  coverTheme?: string;
  artistName: string;
  markedByEmail: string | null;
  markedAt: string;
  lyricsExcerpt: string;
  likeCount: number;
  liked: boolean;
  fieldCount: number;
}

export interface PresetDetail extends PresetSong {
  style: string;
  lyrics: string;
  fieldTokens: number[];
}

export function savePresetCategory(user: User, songId: string, category: PresetCategory) {
  return apiFetch<{ preset: PresetSong }>(user, `/api/v1/admin/presets/${encodeURIComponent(songId)}/category`, {
    method: 'POST',
    body: JSON.stringify({ category }),
  });
}

export function savePresetFields(user: User, songId: string, fieldTokens: number[]) {
  return apiFetch<{ preset: PresetDetail }>(user, `/api/v1/admin/presets/${encodeURIComponent(songId)}/fields`, {
    method: 'POST',
    body: JSON.stringify({ fieldTokens }),
  });
}

export interface AdminUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  membership: string;
  isAdmin: boolean;
  memberSince: string | null;
  generationCount: number;
  librarySongCount: number;
  promptCount: number;
}

export function setSongPreset(user: User, songId: string, preset: boolean) {
  return apiFetch<{ song: LibrarySong }>(user, `/api/v1/songs/${songId}/preset`, {
    method: 'POST',
    body: JSON.stringify({ preset }),
  });
}

export function listPresetSongs(user: User, search = '') {
  const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
  return apiFetch<{ presets: PresetSong[] }>(user, `/api/v1/presets${query}`);
}

export function getPresetDetail(user: User, songId: string) {
  return apiFetch<{ preset: PresetDetail }>(user, `/api/v1/presets/${encodeURIComponent(songId)}`);
}

export function likePresetSong(user: User, songId: string, liked: boolean) {
  return apiFetch<{ preset: PresetSong }>(user, `/api/v1/presets/${encodeURIComponent(songId)}/like`, {
    method: 'POST',
    body: JSON.stringify({ liked }),
  });
}

export async function fetchPresetAudio(user: User, songId: string): Promise<Blob> {
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/presets/${encodeURIComponent(songId)}/audio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? 'The preset audio could not be loaded.', response.status);
  }
  return response.blob();
}

export function removePresetSong(user: User, songId: string) {
  return apiFetch<{ ok: true }>(user, `/api/v1/admin/presets/${encodeURIComponent(songId)}`, { method: 'DELETE' });
}

export function listAdminUsers(user: User) {
  return apiFetch<{ users: AdminUserSummary[] }>(user, '/api/v1/admin/users');
}

export async function fetchSongVideo(user: User, songId: string): Promise<Blob> {
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/songs/${songId}/video`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? 'The video for YouTube could not be prepared.', response.status);
  }
  return response.blob();
}
