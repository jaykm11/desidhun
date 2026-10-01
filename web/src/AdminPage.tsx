import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import {
  ApiError,
  listAdminUsers,
  listPresetSongs,
  removePresetSong,
  savePresetCategory,
  type AdminUserSummary,
  type PresetCategory,
  type PresetSong,
} from './lib/api';
import { useIsAdmin } from './lib/useIsAdmin';
import { PRESET_CATEGORY_LABELS, PresetCard, togglePresetLike, usePresetPlayback } from './PresetSongs';
import { PresetFieldsEditor, PresetShareDialog } from './PresetDialogs';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminPage() {
  const { isLoading, user, signInWithGoogle } = useAuth();
  const isAdmin = useIsAdmin(user);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [presets, setPresets] = useState<PresetSong[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<PresetSong | null>(null);
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<PresetSong | null>(null);
  const playback = usePresetPlayback(user);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listAdminUsers(user), listPresetSongs(user)])
      .then(([usersResult, presetsResult]) => {
        if (cancelled) return;
        setUsers(usersResult.users);
        setPresets(presetsResult.presets);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'Admin data could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((item) => [item.email, item.displayName, item.membership]
      .some((field) => field?.toLowerCase().includes(needle)));
  }, [users, userSearch]);

  const changeCategory = async (preset: PresetSong, category: PresetCategory) => {
    if (!user || category === preset.category) return;
    setCategorySavingId(preset.id);
    setPresets((current) => current.map((item) => item.id === preset.id ? { ...item, category } : item));
    try {
      const { preset: saved } = await savePresetCategory(user, preset.id, category);
      setPresets((current) => current.map((item) => item.id === saved.id ? { ...item, category: saved.category } : item));
    } catch (reason) {
      setPresets((current) => current.map((item) => item.id === preset.id ? { ...item, category: preset.category } : item));
      setError(reason instanceof ApiError ? reason.message : 'The category could not be saved.');
    } finally {
      setCategorySavingId(null);
    }
  };

  const removePreset = async (preset: PresetSong) => {
    if (!user) return;
    if (!window.confirm(`Remove “${preset.title}” from Presets?`)) return;
    setRemovingId(preset.id);
    try {
      await removePresetSong(user, preset.id);
      setPresets((current) => current.filter((item) => item.id !== preset.id));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The preset could not be removed.');
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading || (user && isAdmin === null)) {
    return <main className="legal-page admin-page"><p>Checking account…</p></main>;
  }
  if (!user) {
    return (
      <main className="legal-page admin-page">
        <h1>Admin</h1>
        <button className="google-button" onClick={() => void signInWithGoogle()}>Sign in</button>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main className="legal-page admin-page">
        <h1>Admin</h1>
        <p>This page is only available to administrators.</p>
      </main>
    );
  }

  return (
    <main className="legal-page admin-page">
      <p className="workflow-step">ADMIN</p>
      <h1>Admin</h1>
      {error && <p className="community-error" role="alert">{error}</p>}
      <div className="admin-grid">
        <section className="admin-panel" aria-label="Users">
          <header className="community-column-header">
            <h2>Users</h2>
            <span className="preset-count">{users.length}</span>
          </header>
          <input
            type="search"
            className="preset-search"
            placeholder="Filter by email, name, or membership…"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            aria-label="Filter users"
          />
          {loading ? (
            <p className="community-empty">Loading…</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Membership</th>
                    <th>Member since</th>
                    <th className="numeric">Generations</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.uid}>
                      <td>
                        <strong>{item.displayName || item.email || item.uid}</strong>
                        {item.displayName && item.email && <span>{item.email}</span>}
                      </td>
                      <td>{item.membership}</td>
                      <td>{formatDate(item.memberSince)}</td>
                      <td className="numeric">{item.generationCount}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={4} className="community-empty">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="admin-panel" aria-label="Presets marked by admins">
          <header className="community-column-header">
            <h2>Presets</h2>
            <span className="preset-count">{presets.length}</span>
          </header>
          {loading ? (
            <p className="community-empty">Loading…</p>
          ) : presets.length === 0 ? (
            <p className="community-empty">No presets yet. Mark audio as a preset from the ••• menu in your song library.</p>
          ) : (
            <ul className="community-browse-list admin-preset-list">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  playback={playback}
                  showCategory
                  onLike={(item) => void togglePresetLike(user, item, setPresets, playback.setError)}
                  onShare={setSharing}
                  actions={(
                    <>
                    <select
                      className="preset-category-select"
                      value={preset.category}
                      disabled={categorySavingId === preset.id}
                      aria-label={`Category for ${preset.title}`}
                      onChange={(event) => void changeCategory(preset, event.target.value as PresetCategory)}
                    >
                      {(['songs', 'messages', 'reels'] as const).map((category) => (
                        <option key={category} value={category}>{PRESET_CATEGORY_LABELS[category]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="community-vote-btn preset-edit-btn"
                      onClick={() => setEditingFields(preset)}
                    >
                      Edit fields{preset.fieldCount > 0 ? ` (${preset.fieldCount})` : ''}
                    </button>
                    <button
                      type="button"
                      className="community-vote-btn down"
                      onClick={() => void removePreset(preset)}
                      disabled={removingId === preset.id}
                    >
                      {removingId === preset.id ? 'Removing…' : 'Remove preset'}
                    </button>
                    </>
                  )}
                />
              ))}
            </ul>
          )}
          {playback.error && <p className="community-error" role="alert">{playback.error}</p>}
          {playback.engine}
        </section>
      </div>
      {editingFields && (
        <PresetFieldsEditor
          user={user}
          preset={editingFields}
          onClose={() => setEditingFields(null)}
          onSaved={(fieldCount) => setPresets((current) => current.map((item) => (
            item.id === editingFields.id ? { ...item, fieldCount } : item
          )))}
        />
      )}
      {sharing && <PresetShareDialog user={user} preset={sharing} onClose={() => setSharing(null)} />}
    </main>
  );
}
