import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { ApiError, fetchPresetAudio, likePresetSong, type PresetCategory, type PresetSong } from './lib/api';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';
import { ShareMenu } from './ShareButton';

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  songs: 'Songs',
  messages: 'Messages',
  reels: 'Reels',
};

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export function usePresetPlayback(user: User | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const play = async (preset: PresetSong) => {
    const audio = audioRef.current;
    if (currentId === preset.id && audio) {
      if (audio.paused) await audio.play().catch(() => setError('The audio could not be played.'));
      else audio.pause();
      return;
    }
    if (!user) return;
    setError(null);
    setProgress(0);
    setDuration(0);
    setLoadingId(preset.id);
    try {
      const blob = await fetchPresetAudio(user, preset.id);
      const nextUrl = URL.createObjectURL(blob);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setCurrentId(preset.id);
      if (audio) {
        audio.src = nextUrl;
        audio.load();
        await audio.play();
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The preset could not be loaded.');
    } finally {
      setLoadingId(null);
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  };

  const engine = (
    <audio
      ref={audioRef}
      className="song-library-audio-engine"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
    />
  );

  return { currentId, playing, progress, duration, loadingId, error, setError, play, seek, engine };
}

export async function togglePresetLike(
  user: User | null,
  preset: PresetSong,
  apply: (updater: (current: PresetSong[]) => PresetSong[]) => void,
  onError: (message: string) => void,
) {
  if (!user) return;
  const liked = !preset.liked;
  const optimistic = { ...preset, liked, likeCount: Math.max(0, preset.likeCount + (liked ? 1 : -1)) };
  const replace = (next: PresetSong) => apply((current) => current.map((item) => item.id === next.id ? next : item));
  replace(optimistic);
  try {
    const { preset: saved } = await likePresetSong(user, preset.id, liked);
    replace(saved);
  } catch (reason) {
    replace(preset);
    onError(reason instanceof ApiError ? reason.message : 'The like could not be saved.');
  }
}

export function PresetCard({
  preset,
  playback,
  showCategory = false,
  onLike,
  onShare,
  actions,
}: {
  preset: PresetSong;
  playback: ReturnType<typeof usePresetPlayback>;
  showCategory?: boolean;
  onLike?: (preset: PresetSong) => void;
  onShare?: (preset: PresetSong) => void;
  actions?: ReactNode;
}) {
  const active = playback.currentId === preset.id;
  const isPlaying = active && playback.playing;
  return (
    <li className="community-song preset-song">
      <div className="community-song-art">
        <img src={coverImageForTheme(resolveCoverTheme(preset.coverTheme, preset.title))} alt="" />
        <button
          type="button"
          className="song-library-play-overlay"
          onClick={() => void playback.play(preset)}
          disabled={playback.loadingId === preset.id}
          aria-label={isPlaying ? `Pause ${preset.title}` : `Play ${preset.title}`}
        >
          {playback.loadingId === preset.id ? '…' : isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      <div className="community-song-copy">
        <strong>{preset.title}</strong>
        {showCategory && <span>{PRESET_CATEGORY_LABELS[preset.category]}</span>}
        {preset.lyricsExcerpt && <span className="preset-excerpt">{preset.lyricsExcerpt}</span>}
        {showCategory && preset.markedByEmail && (
          <span className="preset-meta">Marked by {preset.markedByEmail} · {new Date(preset.markedAt).toLocaleDateString()}</span>
        )}
        <div className="community-song-votes">
          {onLike && (
            <button
              type="button"
              className={`community-vote-btn${preset.liked ? ' selected' : ''}`}
              onClick={() => onLike(preset)}
              aria-pressed={preset.liked}
              aria-label={preset.liked ? `Unlike ${preset.title}` : `Like ${preset.title}`}
            >
              {preset.liked ? '♥' : '♡'} {preset.likeCount}
            </button>
          )}
          {onShare && preset.fieldCount > 0 ? (
            <button type="button" className="community-vote-btn preset-edit-btn" onClick={() => onShare(preset)}>
              Share
            </button>
          ) : (
            <ShareMenu songId={preset.id} title={preset.title} className="community-share-menu" />
          )}
          {actions}
        </div>
        {active && (
          <div className="song-library-progress">
            <input
              type="range"
              min="0"
              max={playback.duration || 0}
              step="0.1"
              value={Math.min(playback.progress, playback.duration || 0)}
              disabled={!playback.duration}
              aria-label={`Seek ${preset.title}`}
              onChange={(event) => playback.seek(Number(event.target.value))}
            />
            <span>{formatPlaybackTime(playback.progress)} / {formatPlaybackTime(playback.duration)}</span>
          </div>
        )}
      </div>
    </li>
  );
}
