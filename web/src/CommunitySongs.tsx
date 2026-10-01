import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ApiError,
  fetchCommunitySongAudio,
  listCommunityExplore,
  rateCommunitySong,
  recordCommunityPlay,
  type CommunitySong,
  type CommunityVote,
  type ExploreKind,
  type ExploreRail,
  type ExploreRails,
} from './lib/api';
import { ShareMenu } from './ShareButton';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';

function coverSrc(song: CommunitySong) {
  return coverImageForTheme(resolveCoverTheme(song.coverTheme, song.title));
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export function sortTopSongs(songs: CommunitySong[]): CommunitySong[] {
  return [...songs].sort((left, right) => (
    right.likeCount - left.likeCount
    || right.viewCount - left.viewCount
    || right.publishedAt.localeCompare(left.publishedAt)
  ));
}

export function CommunitySongCard({
  song,
  playing,
  paused,
  progress,
  duration,
  onPlay,
  onSeek,
  onRate,
}: {
  song: CommunitySong;
  playing: boolean;
  paused: boolean;
  progress: number;
  duration: number;
  onPlay: (song: CommunitySong) => void;
  onSeek: (seconds: number) => void;
  onRate: (song: CommunitySong, vote: CommunityVote) => void;
}) {
  const active = playing || paused;
  return (
    <li className="community-song">
      <div className="community-song-art">
        <img src={coverSrc(song)} alt="" />
        <button
          type="button"
          className="song-library-play-overlay"
          onClick={() => onPlay(song)}
          aria-label={playing && !paused ? `Pause ${song.title}` : `Play ${song.title}`}
        >
          {playing && !paused ? '⏸' : '▶'}
        </button>
      </div>
      <div className="community-song-copy">
        <strong>{song.title}</strong>
        <span>{song.artistName}</span>
        <div className="community-song-votes">
          <button
            type="button"
            className={`community-vote-btn${song.myVote === 'like' ? ' selected' : ''}`}
            onClick={() => onRate(song, 'like')}
            aria-pressed={song.myVote === 'like'}
            aria-label={`Like ${song.title}`}
          >
            ▲ {song.likeCount}
          </button>
          <button
            type="button"
            className={`community-vote-btn down${song.myVote === 'dislike' ? ' selected' : ''}`}
            onClick={() => onRate(song, 'dislike')}
            aria-pressed={song.myVote === 'dislike'}
            aria-label={`Dislike ${song.title}`}
          >
            ▼ {song.dislikeCount}
          </button>
          <ShareMenu songId={song.id} title={song.title} className="community-share-menu" />
        </div>
        {active && (
          <div className="song-library-progress">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(progress, duration || 0)}
              disabled={!duration}
              aria-label={`Seek ${song.title}`}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
            <span>{formatPlaybackTime(progress)} / {formatPlaybackTime(duration)}</span>
          </div>
        )}
      </div>
    </li>
  );
}

export function useCommunityPlayback(user: User | null, pauseToken = 0) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [songsById, setSongsById] = useState<Record<string, CommunitySong>>({});
  const [current, setCurrent] = useState<CommunitySong | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
  }, [pauseToken]);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const updateSong = (song: CommunitySong) => {
    setSongsById((currentSongs) => ({ ...currentSongs, [song.id]: song }));
    setCurrent((playingSong) => playingSong?.id === song.id ? { ...playingSong, ...song } : playingSong);
  };

  const play = async (song: CommunitySong) => {
    const audio = audioRef.current;
    if (current?.id === song.id && audio) {
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          setError('The song could not be played.');
        }
      } else {
        audio.pause();
      }
      return;
    }
    if (!user) return;
    setError(null);
    setProgress(0);
    setDuration(0);
    try {
      const blob = await fetchCommunitySongAudio(user, song.id);
      const nextUrl = URL.createObjectURL(blob);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setCurrent(song);
      if (audio) {
        audio.src = nextUrl;
        audio.load();
        await audio.play();
      }
      void recordCommunityPlay(user, song.id)
        .then(({ viewCount }) => updateSong({ ...(songsById[song.id] ?? song), viewCount }))
        .catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The song could not be loaded.');
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  };

  const rate = async (song: CommunitySong, vote: CommunityVote) => {
    if (!user) return null;
    const nextVote = song.myVote === vote ? null : vote;
    try {
      const { song: updated } = await rateCommunitySong(user, song.id, nextVote);
      updateSong(updated);
      return updated;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The rating could not be saved.');
      return null;
    }
  };

  return {
    audioRef,
    current,
    playing,
    progress,
    duration,
    error,
    play,
    seek,
    rate,
    remember: (songs: CommunitySong[]) => {
      setSongsById((currentSongs) => {
        const next = { ...currentSongs };
        for (const song of songs) next[song.id] = song;
        return next;
      });
    },
    resolve: (song: CommunitySong) => songsById[song.id] ?? song,
    setPlaying,
    setProgress,
    setDuration,
    setError,
  };
}

const EXPLORE_SECTIONS: readonly {
  id: ExploreKind;
  title: string;
  featured: string;
  top: string;
  favorites: string;
  emptyFeatured: string;
  emptyTop: string;
}[] = [
  {
    id: 'songs',
    title: 'Songs',
    featured: 'Featured Songs',
    top: 'Top Songs',
    favorites: 'My Favorites',
    emptyFeatured: 'Share a song from your library to appear here.',
    emptyTop: 'The most liked public songs will appear here.',
  },
  {
    id: 'reels',
    title: 'Reels',
    featured: 'Featured Reels',
    top: 'Top Reels',
    favorites: 'My Favorites',
    emptyFeatured: 'Share a reel from your library to appear here.',
    emptyTop: 'The most liked public reels will appear here.',
  },
  {
    id: 'music',
    title: 'Music',
    featured: 'Featured Music',
    top: 'Top Music',
    favorites: 'My Favorites',
    emptyFeatured: 'Share instrumental music from your library to appear here.',
    emptyTop: 'The most liked public music will appear here.',
  },
  {
    id: 'podcast',
    title: 'Podcasts',
    featured: 'Featured Podcasts',
    top: 'Top Podcasts',
    favorites: 'My Favorites',
    emptyFeatured: 'Share a podcast from your library to appear here.',
    emptyTop: 'The most liked public podcasts will appear here.',
  },
];

const EMPTY_RAIL: ExploreRail = { featured: [], top: [], favorites: [] };

function rememberRails(rails: ExploreRails): CommunitySong[] {
  return EXPLORE_SECTIONS.flatMap((section) => [
    ...rails[section.id].featured,
    ...rails[section.id].top,
    ...rails[section.id].favorites,
  ]);
}

export function CommunityRail({
  user,
  refreshToken = 0,
  pauseToken = 0,
  onPlayStart,
}: {
  user: User;
  refreshToken?: number;
  pauseToken?: number;
  onPlayStart?: () => void;
}) {
  const [rails, setRails] = useState<ExploreRails | null>(null);
  const playback = useCommunityPlayback(user, pauseToken);

  useEffect(() => {
    let cancelled = false;
    listCommunityExplore(user)
      .then(({ rails: loaded }) => {
        if (cancelled) return;
        setRails(loaded);
        playback.remember(rememberRails(loaded));
      })
      .catch((reason) => {
        if (!cancelled) playback.setError(reason instanceof ApiError ? reason.message : 'Community songs could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [user, refreshToken]);

  const play = (song: CommunitySong) => {
    onPlayStart?.();
    void playback.play(song);
  };

  const applyRated = (song: CommunitySong, vote: CommunityVote) => {
    void playback.rate(song, vote).then((updated) => {
      if (!updated) return;
      const kind = updated.kind ?? song.kind ?? 'songs';
      setRails((current) => {
        if (!current) return current;
        const next = { ...current };
        for (const section of EXPLORE_SECTIONS) {
          const rail = current[section.id];
          const mapSong = (item: CommunitySong) => item.id === song.id ? { ...item, ...updated, kind: item.kind ?? kind } : item;
          next[section.id] = {
            featured: rail.featured.map(mapSong),
            top: sortTopSongs(rail.top.map(mapSong)),
            favorites: section.id !== kind
              ? rail.favorites.filter((item) => item.id !== updated.id)
              : updated.myVote === 'like'
                ? (rail.favorites.some((item) => item.id === updated.id)
                  ? rail.favorites.map(mapSong)
                  : [{ ...updated, kind }, ...rail.favorites].slice(0, 6))
                : rail.favorites.filter((item) => item.id !== updated.id),
          };
        }
        return next;
      });
    });
  };

  const columnProps = {
    currentId: playback.current?.id ?? null,
    playing: playback.playing,
    progress: playback.progress,
    duration: playback.duration,
    onPlay: play,
    onSeek: playback.seek,
    onRate: applyRated,
    resolve: playback.resolve,
  };

  return (
    <div className="explore-sections">
      {EXPLORE_SECTIONS.map((section) => {
        const rail = rails?.[section.id] ?? EMPTY_RAIL;
        return (
          <section key={section.id} className="explore-section" aria-label={section.title}>
            <h2 className="explore-section-title">{section.title}</h2>
            <div className="community-box">
              <CommunityColumn
                title={section.featured}
                browseHref={`/community?sort=featured&kind=${section.id}`}
                songs={rail.featured}
                empty={section.emptyFeatured}
                {...columnProps}
              />
              <CommunityColumn
                title={section.top}
                browseHref={`/community?sort=top&kind=${section.id}`}
                songs={rail.top}
                empty={section.emptyTop}
                {...columnProps}
              />
              <CommunityColumn
                title={section.favorites}
                browseHref={`/community?sort=favorites&kind=${section.id}`}
                songs={rail.favorites}
                empty="Pieces you like will appear here."
                {...columnProps}
              />
            </div>
          </section>
        );
      })}
      {playback.error && <p className="community-error" role="alert">{playback.error}</p>}
      <audio
        ref={playback.audioRef}
        className="song-library-audio-engine"
        onPlay={() => playback.setPlaying(true)}
        onPause={() => playback.setPlaying(false)}
        onEnded={() => playback.setPlaying(false)}
        onLoadedMetadata={(event) => playback.setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => playback.setProgress(event.currentTarget.currentTime)}
      />
    </div>
  );
}

function CommunityColumn({
  title,
  browseHref,
  songs,
  empty,
  currentId,
  playing,
  progress,
  duration,
  onPlay,
  onSeek,
  onRate,
  resolve,
}: {
  title: string;
  browseHref: string;
  songs: CommunitySong[];
  empty: string;
  currentId: string | null;
  playing: boolean;
  progress: number;
  duration: number;
  onPlay: (song: CommunitySong) => void;
  onSeek: (seconds: number) => void;
  onRate: (song: CommunitySong, vote: CommunityVote) => void;
  resolve: (song: CommunitySong) => CommunitySong;
}) {
  return (
    <div className="community-column">
      <header className="community-column-header">
        <h2>{title}</h2>
        <a href={browseHref}>Browse all</a>
      </header>
      {songs.length === 0 ? (
        <p className="community-empty">{empty}</p>
      ) : (
        <ul className="community-song-list">
          {songs.map((song) => {
            const resolved = resolve(song);
            return (
              <CommunitySongCard
                key={song.id}
                song={resolved}
                playing={currentId === song.id && playing}
                paused={currentId === song.id && !playing}
                progress={currentId === song.id ? progress : 0}
                duration={currentId === song.id ? duration : 0}
                onPlay={onPlay}
                onSeek={onSeek}
                onRate={onRate}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
