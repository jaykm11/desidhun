import { useEffect, useRef, useState } from 'react';
import { listPublicTopSongs, publicSongAudioUrl, type CommunitySong } from './lib/api';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';

export function LoginTopSongs({ alignBottomTo }: { alignBottomTo?: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [songs, setSongs] = useState<CommunitySong[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicTopSongs(12)
      .then((loaded) => { if (!cancelled) setSongs(loaded); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!alignBottomTo || !section) return;
    let offset = 0;
    let frame = 0;
    const align = () => {
      const target = document.querySelector(alignBottomTo);
      const desktop = window.matchMedia('(min-width: 981px)').matches;
      const naturalBottom = section.getBoundingClientRect().bottom - offset;
      let targetBottom: number | null = null;
      if (target) {
        const range = document.createRange();
        range.selectNodeContents(target);
        targetBottom = range.getBoundingClientRect().bottom || target.getBoundingClientRect().bottom;
      }
      const next = desktop && targetBottom !== null ? Math.max(0, Math.round(targetBottom - naturalBottom)) : 0;
      if (next === offset) return;
      offset = next;
      section.style.transform = offset ? `translateY(${offset}px)` : '';
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(section);
    const target = document.querySelector(alignBottomTo);
    const targetBox = target?.closest('section') ?? target;
    if (targetBox) observer.observe(targetBox);
    if (section.parentElement) observer.observe(section.parentElement);
    window.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      section.style.transform = '';
    };
  }, [alignBottomTo, songs.length]);

  const toggle = (song: CommunitySong) => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    if (playingId === song.id) {
      if (audio.paused) void audio.play().catch(() => setError('The song could not be played.'));
      else audio.pause();
      return;
    }
    setPlayingId(song.id);
    setLoadingId(song.id);
    audio.src = publicSongAudioUrl(song.id);
    void audio.play().catch(() => {
      setLoadingId(null);
      setPlayingId(null);
      setError('The song could not be played.');
    });
  };

  if (songs.length === 0) return null;
  const loop = songs.length > 2 ? [...songs, ...songs] : songs;
  const playingNow = playingId !== null && isPlaying;

  return (
    <section ref={sectionRef} className="login-top-songs" aria-label="Top songs">
      <p className="login-top-songs-title">Top songs · tap to listen</p>
      <div className="login-top-songs-viewport">
        <ul
          className={`login-top-songs-track${songs.length > 2 ? ' animated' : ''}${playingNow ? ' paused' : ''}`}
          style={{ animationDuration: `${Math.max(24, songs.length * 5)}s` }}
        >
          {loop.map((song, index) => {
            const active = playingId === song.id;
            const duplicate = index >= songs.length;
            return (
              <li key={`${song.id}-${index}`} className={`login-top-song${active ? ' active' : ''}`} aria-hidden={duplicate || undefined}>
                <button
                  type="button"
                  className="login-top-song-button"
                  onClick={() => toggle(song)}
                  tabIndex={duplicate ? -1 : undefined}
                  aria-label={active && playingNow ? `Pause ${song.title}` : `Play ${song.title}`}
                >
                  <span className="login-top-song-art">
                    <img src={coverImageForTheme(resolveCoverTheme(song.coverTheme, song.title))} alt="" />
                    <span className="login-top-song-play">
                      {loadingId === song.id ? '…' : active && playingNow ? '⏸' : '▶'}
                    </span>
                  </span>
                  <strong>{song.title}</strong>
                  <span className="login-top-song-artist">{song.artistName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {error && <p className="login-top-songs-error" role="alert">{error}</p>}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          setLoadingId(null);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setPlayingId(null);
        }}
        onError={() => {
          if (!audioRef.current?.getAttribute('src')) return;
          setLoadingId(null);
          setIsPlaying(false);
          setPlayingId(null);
          setError('The song could not be played.');
        }}
      />
    </section>
  );
}
