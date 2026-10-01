import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { ApiError, listPresetSongs, type PresetCategory, type PresetSong } from './lib/api';
import { PresetShareDialog } from './PresetDialogs';
import { PRESET_CATEGORY_LABELS, PresetCard, togglePresetLike, usePresetPlayback } from './PresetSongs';

const CATEGORIES: PresetCategory[] = ['songs', 'messages', 'reels'];

const EMPTY_TEXT: Record<PresetCategory, string> = {
  songs: 'No preset songs yet.',
  messages: 'No preset messages yet.',
  reels: 'No preset reels yet.',
};

function matches(preset: PresetSong, needle: string): boolean {
  if (!needle) return true;
  return [preset.title, preset.artistName, preset.lyricsExcerpt]
    .some((field) => field.toLowerCase().includes(needle));
}

export default function PresetsPage() {
  const { isLoading, user, signInWithGoogle } = useAuth();
  const [presets, setPresets] = useState<PresetSong[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<PresetSong | null>(null);
  const playback = usePresetPlayback(user);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    listPresetSongs(user)
      .then(({ presets: loaded }) => { if (!cancelled) setPresets(loaded); })
      .catch((reason) => {
        if (!cancelled) playback.setError(reason instanceof ApiError ? reason.message : 'Presets could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const needle = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    const filtered = presets.filter((preset) => matches(preset, needle));
    return Object.fromEntries(CATEGORIES.map((category) => [
      category,
      filtered.filter((preset) => preset.category === category),
    ])) as Record<PresetCategory, PresetSong[]>;
  }, [presets, needle]);

  return (
    <main className="legal-page explore-page presets-page">
      <p className="workflow-step">PRESETS</p>
      {isLoading ? (
        <p>Checking account…</p>
      ) : !user ? (
        <button className="google-button" onClick={() => void signInWithGoogle()}>
          Sign in to browse presets
        </button>
      ) : (
        <>
          <input
            type="search"
            className="preset-search"
            placeholder="Search presets by title, artist, or words…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search presets"
          />
          <section className="community-box" aria-label="Presets">
            {CATEGORIES.map((category) => (
              <div key={category} className="community-column">
                <header className="community-column-header">
                  <h2>{PRESET_CATEGORY_LABELS[category]}</h2>
                  <span className="preset-count">{grouped[category].length}</span>
                </header>
                {loading ? (
                  <p className="community-empty">Loading…</p>
                ) : grouped[category].length === 0 ? (
                  <p className="community-empty">{needle ? 'No matches.' : EMPTY_TEXT[category]}</p>
                ) : (
                  <ul className="community-song-list preset-song-list">
                    {grouped[category].map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        playback={playback}
                        onLike={(item) => void togglePresetLike(user, item, setPresets, playback.setError)}
                        onShare={setSharing}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {playback.error && <p className="community-error" role="alert">{playback.error}</p>}
            {playback.engine}
          </section>
          {sharing && <PresetShareDialog user={user} preset={sharing} onClose={() => setSharing(null)} />}
        </>
      )}
    </main>
  );
}
