import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { ApiError, listCommunitySongs, type CommunitySong } from './lib/api';
import { CommunitySongCard, sortTopSongs, useCommunityPlayback } from './CommunitySongs';

type CommunitySort = 'featured' | 'top' | 'favorites';

function requestedSort(): CommunitySort {
  const sort = new URLSearchParams(window.location.search).get('sort');
  return sort === 'top' || sort === 'favorites' ? sort : 'featured';
}

export default function CommunityPage() {
  const { isLoading, user, signInWithGoogle } = useAuth();
  const sort = useMemo(requestedSort, []);
  const [songs, setSongs] = useState<CommunitySong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const playback = useCommunityPlayback(user);

  useEffect(() => {
    if (!user) return;
    setError(null);
    void listCommunitySongs(user, sort, 48)
      .then(({ songs: next }) => {
        setSongs(next);
        playback.remember(next);
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Community songs could not be loaded.'));
  }, [user, sort]);

  return (
    <main className="legal-page community-page">
      <p className="workflow-step">DESI DHUN COMMUNITY</p>
      <h1>{sort === 'top' ? 'Top Songs' : sort === 'favorites' ? 'My Favorites' : 'Featured Songs'}</h1>
      <p>
        {sort === 'top'
          ? 'Public songs with the most likes.'
          : sort === 'favorites'
            ? 'Public songs you have liked.'
            : 'The latest songs shared with the Desi Dhun Community.'}
      </p>
      <nav className="community-sort-nav" aria-label="Community lists">
        <a className={sort === 'featured' ? 'active' : undefined} href="/community?sort=featured">Featured</a>
        <a className={sort === 'top' ? 'active' : undefined} href="/community?sort=top">Top</a>
        <a className={sort === 'favorites' ? 'active' : undefined} href="/community?sort=favorites">My Favorites</a>
      </nav>
      {isLoading ? <p>Checking account…</p> : !user ? (
        <button className="google-button" onClick={() => void signInWithGoogle()}>Sign in to browse community songs</button>
      ) : error ? (
        <p className="compose-error">{error}</p>
      ) : songs.length === 0 ? (
        <p>{sort === 'favorites' ? 'Public songs you like will appear here.' : 'No public songs yet. Share one from your library to appear here.'}</p>
      ) : (
        <ul className="community-browse-list">
          {songs.map((song) => {
            const resolved = playback.resolve(song);
            return (
              <CommunitySongCard
                key={song.id}
                song={resolved}
                playing={playback.current?.id === song.id && playback.playing}
                paused={playback.current?.id === song.id && !playback.playing}
                progress={playback.current?.id === song.id ? playback.progress : 0}
                duration={playback.current?.id === song.id ? playback.duration : 0}
                onPlay={(next) => void playback.play(next)}
                onSeek={playback.seek}
                onRate={(next, vote) => {
                  void playback.rate(next, vote).then((updated) => {
                    if (!updated) return;
                    setSongs((current) => {
                      const mapped = current.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
                      if (sort === 'top') return sortTopSongs(mapped);
                      if (sort === 'favorites' && updated.myVote !== 'like') {
                        return mapped.filter((item) => item.id !== updated.id);
                      }
                      return mapped;
                    });
                  });
                }}
              />
            );
          })}
        </ul>
      )}
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
    </main>
  );
}
