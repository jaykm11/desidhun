import type { User } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { ApiError, fetchSongVideo, type LibrarySong } from './lib/api';
import {
  loadGoogleIdentityServices,
  requestYouTubeAccess,
  uploadVideoToYouTube,
  type YouTubePrivacy,
} from './lib/youtube';

type UploadStep = 'idle' | 'authorizing' | 'rendering' | 'uploading' | 'done';

const STEP_LABELS: Record<UploadStep, string> = {
  idle: '',
  authorizing: 'Waiting for YouTube permission…',
  rendering: 'Preparing the video…',
  uploading: 'Uploading to YouTube…',
  done: '',
};

function defaultDescription(song: LibrarySong): string {
  const lyrics = song.lyrics.trim();
  return [lyrics, 'Created with Desi Dhun — https://desidhun.net'].filter(Boolean).join('\n\n');
}

export function YouTubeUploadDialog({ song, user, onClose }: { song: LibrarySong; user: User; onClose: () => void }) {
  const [title, setTitle] = useState(song.title);
  const [description, setDescription] = useState(() => defaultDescription(song));
  const [privacy, setPrivacy] = useState<YouTubePrivacy>('private');
  const [step, setStep] = useState<UploadStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [oauthReady, setOauthReady] = useState(false);
  const oauth2 = useRef<Awaited<ReturnType<typeof loadGoogleIdentityServices>> | null>(null);
  const busy = step === 'authorizing' || step === 'rendering' || step === 'uploading';

  useEffect(() => {
    loadGoogleIdentityServices()
      .then((loaded) => {
        oauth2.current = loaded;
        setOauthReady(true);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : String(loadError)));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const startUpload = async () => {
    if (!oauth2.current) {
      setError('Google sign-in for YouTube is still loading. Please try again in a moment.');
      return;
    }
    setError(null);
    setStep('authorizing');
    const access = requestYouTubeAccess(oauth2.current, user.email ?? undefined);
    const video = fetchSongVideo(user, song.id);
    video.catch(() => undefined);
    try {
      const accessToken = await access;
      setStep('rendering');
      const file = await video;
      setStep('uploading');
      setVideoId(await uploadVideoToYouTube(accessToken, file, { title, description, privacy }));
      setStep('done');
    } catch (uploadError) {
      setStep('idle');
      setError(uploadError instanceof ApiError || uploadError instanceof Error
        ? uploadError.message
        : 'The song could not be uploaded to YouTube.');
    }
  };

  return (
    <div className="youtube-dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div
        className="youtube-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="youtube-dialog-title">Upload to YouTube</h2>
        {step === 'done' && videoId ? (
          <>
            <p>
              Your song is on YouTube. It can take a few minutes for YouTube to finish processing it.
            </p>
            <div className="youtube-dialog-actions">
              <a className="youtube-dialog-primary" href={`https://youtu.be/${videoId}`} target="_blank" rel="noreferrer">
                Open on YouTube
              </a>
              <button type="button" className="youtube-dialog-secondary" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <label className="youtube-dialog-field">
              <span>Title</span>
              <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
            </label>
            <label className="youtube-dialog-field">
              <span>Description</span>
              <textarea
                value={description}
                rows={6}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="youtube-dialog-field">
              <span>Visibility</span>
              <select value={privacy} onChange={(event) => setPrivacy(event.target.value as YouTubePrivacy)} disabled={busy}>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <p className="youtube-dialog-note">
              The video uses the song's cover art and is marked as AI-generated. Google will ask you to allow
              Desi Dhun to upload to your YouTube channel.
            </p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {busy && <p className="youtube-dialog-status" role="status">{STEP_LABELS[step]}</p>}
            <div className="youtube-dialog-actions">
              <button type="button" className="youtube-dialog-primary" onClick={() => void startUpload()} disabled={busy || !oauthReady}>
                {busy ? 'Uploading…' : oauthReady ? 'Upload' : 'Loading…'}
              </button>
              <button type="button" className="youtube-dialog-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
