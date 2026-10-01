import { useEffect, useRef, useState } from 'react';
import { fetchPublicSong, fetchPublicSongAudio, type PublicSharedSong } from './lib/api';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';
import { ShareButton } from './ShareButton';

function songIdFromPath(): string {
  const match = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function coverSrc(song: PublicSharedSong) {
  return coverImageForTheme(resolveCoverTheme(song.coverTheme, song.title));
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export default function ShareSongPage() {
  const songId = songIdFromPath();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [song, setSong] = useState<PublicSharedSong | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!songId) {
      setError('This share link is missing a song.');
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchPublicSong(songId)
      .then(async (next) => {
        if (cancelled) return;
        setSong(next);
        const blob = await fetchPublicSongAudio(songId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError('This song is no longer available.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [songId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.src = audioUrl;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
    };
  }, [audioUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  return (
    <main className="legal-page share-song-page">
      <p className="workflow-step">SHARED SONG</p>
      {error ? (
        <>
          <h1>Song unavailable</h1>
          <p>{error}</p>
        </>
      ) : !song ? (
        <p>Loading song…</p>
      ) : (
        <article className="share-song-card">
          <img className="share-song-cover" src={coverSrc(song)} alt="" />
          <div>
            <h1>{song.title}</h1>
            <p className="muted">{song.artistName}</p>
            <div className="share-song-controls">
              <button type="button" className="share-song-play" onClick={toggle} disabled={!audioUrl}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <ShareButton songId={song.id} title={song.title} className="share-song-again" />
            </div>
            <div className="song-library-progress">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(progress, duration || 0)}
                disabled={!duration}
                aria-label={`Seek ${song.title}`}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = nextTime;
                  setProgress(nextTime);
                }}
              />
              <span>{formatPlaybackTime(progress)} / {formatPlaybackTime(duration)}</span>
            </div>
          </div>
        </article>
      )}
      <audio
        ref={audioRef}
        className="song-library-audio-engine"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
      />
    </main>
  );
}
