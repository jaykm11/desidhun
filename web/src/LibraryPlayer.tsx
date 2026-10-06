import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth/AuthProvider';
import { fetchSongAudio, type LibrarySong } from './lib/api';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';
import { displaySongTitle } from './lib/songName';

interface LibraryPlayerValue {
  current: LibrarySong | null;
  playing: boolean;
  progress: number;
  duration: number;
  play: (song: LibrarySong) => Promise<void>;
  toggle: (song: LibrarySong) => Promise<void>;
  seek: (time: number) => void;
  stopIf: (songId: string) => void;
  replaceSong: (song: LibrarySong) => void;
}

const LibraryPlayerContext = createContext<LibraryPlayerValue | null>(null);

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function coverSrc(song: LibrarySong): string {
  return coverImageForTheme(resolveCoverTheme(song.coverTheme, song.title, song.style ?? '', song.lyrics ?? ''));
}

export function LibraryPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const currentRef = useRef<LibrarySong | null>(null);
  const [current, setCurrent] = useState<LibrarySong | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (user) return;
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (audioRef.current) audioRef.current.removeAttribute('src');
    setCurrent(null);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [user]);

  const play = async (song: LibrarySong) => {
    if (!user) throw new Error('Sign in to play this audio.');
    const blob = await fetchSongAudio(user, song.id);
    const nextUrl = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = nextUrl;
    setCurrent(song);
    currentRef.current = song;
    setProgress(0);
    setDuration(0);
    setPlaying(false);
    const audio = audioRef.current;
    if (!audio) throw new Error('The song could not be played.');
    audio.src = nextUrl;
    audio.load();
    await audio.play();
  };

  const toggle = async (song: LibrarySong) => {
    const audio = audioRef.current;
    if (currentRef.current?.id === song.id && audio?.src) {
      if (audio.paused) await audio.play();
      else audio.pause();
      return;
    }
    await play(song);
  };

  const seek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setProgress(time);
  };

  const stopIf = (songId: string) => {
    if (currentRef.current?.id !== songId) return;
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (audioRef.current) audioRef.current.removeAttribute('src');
    currentRef.current = null;
    setCurrent(null);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  };

  const replaceSong = (song: LibrarySong) => {
    setCurrent((item) => item?.id === song.id ? { ...item, ...song } : item);
  };

  const value: LibraryPlayerValue = {
    current,
    playing,
    progress,
    duration,
    play,
    toggle,
    seek,
    stopIf,
    replaceSong,
  };

  return (
    <LibraryPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        className="song-library-audio-engine"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
      />
    </LibraryPlayerContext.Provider>
  );
}

export function useLibraryPlayer(): LibraryPlayerValue {
  const value = useContext(LibraryPlayerContext);
  if (!value) throw new Error('Library playback is unavailable.');
  return value;
}

export function PersistentLibraryPlayer() {
  const player = useLibraryPlayer();
  const song = player.current;
  if (!song) return null;
  const title = displaySongTitle(song.title);
  return (
    <div className="persistent-player" role="region" aria-label="Now playing">
      <img className="persistent-player-art" src={coverSrc(song)} alt="" />
      <div className="persistent-player-copy">
        <strong>{title}</strong>
        <div className="song-library-progress">
          <input
            type="range"
            min="0"
            max={player.duration || 0}
            step="0.1"
            value={Math.min(player.progress, player.duration || 0)}
            disabled={!player.duration}
            aria-label={`Seek ${title}`}
            onChange={(event) => player.seek(Number(event.target.value))}
          />
          <span>{formatPlaybackTime(player.progress)} / {formatPlaybackTime(player.duration)}</span>
        </div>
      </div>
      <button
        type="button"
        className="persistent-player-toggle"
        onClick={() => void player.toggle(song)}
        aria-label={player.playing ? `Pause ${title}` : `Play ${title}`}
      >
        {player.playing ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}
