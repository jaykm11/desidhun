const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

export type YouTubePrivacy = 'private' | 'unlisted' | 'public';

export interface YouTubeUploadDetails {
  title: string;
  description: string;
  privacy: YouTubePrivacy;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; login_hint?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes: (response: TokenResponse, scope: string) => boolean;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleAccountsOAuth2 } };
  }
}

export function isYouTubeUploadConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
}

let gisScript: Promise<GoogleAccountsOAuth2> | null = null;

/** Loads Google Identity Services once; call early so the consent popup opens straight from the click. */
export function loadGoogleIdentityServices(): Promise<GoogleAccountsOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  gisScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error('Google sign-in for YouTube could not be loaded.'));
    };
    script.onerror = () => {
      gisScript = null;
      reject(new Error('Google sign-in for YouTube could not be loaded. Check any ad or tracker blocker and try again.'));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

/** Must be called synchronously from a click so browsers allow the consent popup. */
export function requestYouTubeAccess(oauth2: GoogleAccountsOAuth2, loginHint?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
      scope: YOUTUBE_UPLOAD_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error === 'access_denied'
            ? 'YouTube access was not granted.'
            : response.error_description || 'YouTube access could not be granted.'));
          return;
        }
        if (!oauth2.hasGrantedAllScopes(response, YOUTUBE_UPLOAD_SCOPE)) {
          reject(new Error('Allow Desi Dhun to upload videos to YouTube to continue.'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new Error(error.type === 'popup_closed'
          ? 'The YouTube permission window was closed.'
          : error.type === 'popup_failed_to_open'
            ? 'The YouTube permission window was blocked. Allow popups for desidhun.net and try again.'
            : error.message || 'YouTube access could not be granted.'));
      },
    });
    client.requestAccessToken({ login_hint: loginHint });
  });
}

/** YouTube rejects angle brackets in titles and descriptions. */
function cleanYouTubeText(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

async function youTubeErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as {
    error?: { message?: string; errors?: Array<{ reason?: string }> };
  };
  const reason = body.error?.errors?.[0]?.reason;
  if (reason === 'youtubeSignupRequired') return 'This Google account has no YouTube channel yet. Create one on youtube.com and try again.';
  if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded') return 'YouTube upload limit reached for today. Please try again tomorrow.';
  if (response.status === 401 || response.status === 403) return 'YouTube did not accept the upload permission. Please try again.';
  return body.error?.message || 'The song could not be uploaded to YouTube.';
}

/** Resumable upload straight from the browser; returns the new video ID. */
export async function uploadVideoToYouTube(accessToken: string, video: Blob, details: YouTubeUploadDetails): Promise<string> {
  const metadata = {
    snippet: {
      title: cleanYouTubeText(details.title, 100) || 'Desi Dhun song',
      description: cleanYouTubeText(details.description, 5000),
      categoryId: '10',
      tags: ['Desi Dhun', 'AI song', 'Hindi song', 'raga'],
    },
    status: {
      privacyStatus: details.privacy,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    },
  };

  const session = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(video.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!session.ok) throw new Error(await youTubeErrorMessage(session));
  const uploadUrl = session.headers.get('Location');
  if (!uploadUrl) throw new Error('YouTube did not start the upload. Please try again.');

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: video,
  });
  if (!upload.ok) throw new Error(await youTubeErrorMessage(upload));
  const created = await upload.json() as { id?: string };
  if (!created.id) throw new Error('YouTube did not return the new video.');
  return created.id;
}
