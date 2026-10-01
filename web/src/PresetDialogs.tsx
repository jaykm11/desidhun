import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ApiError,
  createShareableLink,
  displaySongError,
  getPresetDetail,
  listLibrarySongs,
  prepareLyriaSong,
  savePresetFields,
  type PresetDetail,
  type PresetSong,
} from './lib/api';
import { fillPresetFields, isFieldableToken, presetSegments, tokenizePresetText } from './lib/presetFields';
import {
  canUseSystemShare,
  copyShareableLink,
  emailShareUrl,
  shareDesiDhunLink,
  whatsAppShareUrl,
} from './lib/share';

function usePresetDetail(user: User, presetId: string) {
  const [detail, setDetail] = useState<PresetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPresetDetail(user, presetId)
      .then(({ preset }) => { if (!cancelled) setDetail(preset); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'The preset could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [user, presetId]);
  return { detail, error, setError };
}

function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}

export function PresetFieldsEditor({
  user,
  preset,
  onClose,
  onSaved,
}: {
  user: User;
  preset: PresetSong;
  onClose: () => void;
  onSaved: (fieldCount: number) => void;
}) {
  const { detail, error, setError } = usePresetDetail(user, preset.id);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  useEscapeToClose(onClose, !saving);

  useEffect(() => {
    if (detail) setSelected(new Set(detail.fieldTokens));
  }, [detail]);

  const tokens = useMemo(() => tokenizePresetText(detail?.lyrics ?? ''), [detail]);
  const fieldCount = useMemo(() => presetSegments(detail?.lyrics ?? '', [...selected])
    .filter((segment) => segment.kind === 'field').length, [detail, selected]);

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { preset: saved } = await savePresetFields(user, preset.id, [...selected]);
      onSaved(saved.fieldCount);
      onClose();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The fields could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="youtube-dialog-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="youtube-dialog preset-dialog" role="dialog" aria-modal="true" aria-label="Edit preset fields" onClick={(event) => event.stopPropagation()}>
        <h2>Edit fields · {preset.title}</h2>
        <p className="youtube-dialog-note">
          Click the words listeners should be able to change before sharing, like a name. Neighbouring words become one field.
        </p>
        {error && <p className="compose-error">{error}</p>}
        {!detail ? (
          !error && <p className="youtube-dialog-status">Loading…</p>
        ) : !detail.lyrics.trim() ? (
          <p className="youtube-dialog-status">This preset has no text, so it has no fields.</p>
        ) : (
          <div className="preset-token-text">
            {tokens.map((token, index) => (
              isFieldableToken(token) ? (
                <button
                  key={index}
                  type="button"
                  className={`preset-token${selected.has(index) ? ' selected' : ''}`}
                  onClick={() => toggle(index)}
                  aria-pressed={selected.has(index)}
                >
                  {token}
                </button>
              ) : (
                <span key={index}>{token}</span>
              )
            ))}
          </div>
        )}
        <p className="youtube-dialog-status">{fieldCount === 1 ? '1 field' : `${fieldCount} fields`}</p>
        <div className="youtube-dialog-actions">
          <button type="button" className="youtube-dialog-secondary" onClick={() => setSelected(new Set())} disabled={saving || selected.size === 0}>
            Clear all
          </button>
          <button type="button" className="youtube-dialog-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="youtube-dialog-primary" onClick={() => void save()} disabled={saving || !detail}>
            {saving ? 'Saving…' : 'Save fields'}
          </button>
        </div>
      </div>
    </div>
  );
}

type SharePhase =
  | { kind: 'edit' }
  | { kind: 'generating' }
  | { kind: 'ready'; target: { id: string; title: string }; personalized: boolean };

const RENDER_TIMEOUT_MS = 6 * 60_000;

export function PresetShareDialog({
  user,
  preset,
  onClose,
}: {
  user: User;
  preset: PresetSong;
  onClose: () => void;
}) {
  const { detail, error, setError } = usePresetDetail(user, preset.id);
  const [values, setValues] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<SharePhase>({ kind: 'edit' });
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  useEscapeToClose(onClose, phase.kind !== 'generating');

  const segments = useMemo(
    () => (detail ? presetSegments(detail.lyrics, detail.fieldTokens) : []),
    [detail],
  );

  const changed = segments.some((segment) => (
    segment.kind === 'field'
    && typeof values[segment.id] === 'string'
    && values[segment.id].trim() !== ''
    && values[segment.id].trim() !== segment.text.trim()
  ));

  const waitForSong = async (songId: string) => {
    const started = Date.now();
    while (Date.now() - started < RENDER_TIMEOUT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, 3_000));
      const { songs } = await listLibrarySongs(user);
      const song = songs.find((item) => item.id === songId);
      if (song?.status === 'ready' || (song && !song.status)) return song;
      if (song?.status === 'failed') throw new Error(displaySongError(song.error ?? 'The audio could not be generated.'));
    }
    throw new Error('The audio is taking longer than usual. It will appear in your song library when it is ready.');
  };

  const continueToShare = async () => {
    if (!detail) return;
    setError(null);
    if (!changed) {
      setPhase({ kind: 'ready', target: { id: preset.id, title: preset.title }, personalized: false });
      return;
    }
    setPhase({ kind: 'generating' });
    try {
      const lyrics = fillPresetFields(detail.lyrics, detail.fieldTokens, values);
      const generator = detail.category === 'songs' ? 'lyria' : 'chirp-3-hd';
      const { song } = await prepareLyriaSong(user, detail.style, lyrics, preset.title, generator);
      await waitForSong(song.id);
      await createShareableLink(user, song.id);
      setPhase({ kind: 'ready', target: { id: song.id, title: preset.title }, personalized: true });
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : 'The audio could not be generated.');
      setPhase({ kind: 'edit' });
    }
  };

  const runShare = async (action: () => Promise<string>) => {
    try {
      setShareStatus(await action());
    } catch {
      setShareStatus('Could not share');
    }
  };

  return (
    <div className="youtube-dialog-backdrop" role="presentation" onClick={() => phase.kind !== 'generating' && onClose()}>
      <div className="youtube-dialog preset-dialog" role="dialog" aria-modal="true" aria-label={`Share ${preset.title}`} onClick={(event) => event.stopPropagation()}>
        <h2>Share · {preset.title}</h2>
        {error && <p className="compose-error">{error}</p>}
        {!detail ? (
          !error && <p className="youtube-dialog-status">Loading…</p>
        ) : phase.kind === 'ready' ? (
          <>
            <p>
              {phase.personalized
                ? 'Your personalised audio is ready. It is also saved in your song library.'
                : 'Share this preset as it is.'}
            </p>
            <div className="preset-share-options">
              <button type="button" className="youtube-dialog-secondary" onClick={() => void runShare(async () => {
                await copyShareableLink(phase.target.id);
                return 'Link copied';
              })}>
                Copy link
              </button>
              <button type="button" className="youtube-dialog-secondary" onClick={() => void runShare(async () => {
                window.open(whatsAppShareUrl(phase.target.id, phase.target.title), '_blank', 'noopener,noreferrer');
                return 'Opened WhatsApp';
              })}>
                WhatsApp
              </button>
              <button type="button" className="youtube-dialog-secondary" onClick={() => void runShare(async () => {
                window.location.assign(emailShareUrl(phase.target.id, phase.target.title));
                return 'Opened email';
              })}>
                Email
              </button>
              {canUseSystemShare() && (
                <button type="button" className="youtube-dialog-secondary" onClick={() => void runShare(async () => {
                  const result = await shareDesiDhunLink(phase.target);
                  return result === 'shared' ? 'Shared' : result === 'copied' ? 'Link copied' : '';
                })}>
                  More apps…
                </button>
              )}
            </div>
            {shareStatus && <p className="youtube-dialog-status">{shareStatus}</p>}
            <div className="youtube-dialog-actions">
              {phase.personalized && (
                <button type="button" className="youtube-dialog-secondary" onClick={() => setPhase({ kind: 'edit' })}>
                  Edit again
                </button>
              )}
              <button type="button" className="youtube-dialog-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="youtube-dialog-note">
              Change the highlighted words, then share. Changing a word creates a new audio in your library and uses one generation credit.
            </p>
            <div className="preset-token-text preset-fill-text">
              {segments.map((segment, index) => (
                segment.kind === 'text' ? (
                  <span key={index}>{segment.text}</span>
                ) : (
                  <input
                    key={index}
                    type="text"
                    className="preset-field-input"
                    value={values[segment.id] ?? segment.text}
                    size={Math.max(4, (values[segment.id] ?? segment.text).length + 1)}
                    maxLength={60}
                    disabled={phase.kind === 'generating'}
                    aria-label={`Replace “${segment.text}”`}
                    onChange={(event) => {
                      const next = event.target.value;
                      setValues((current) => ({ ...current, [segment.id]: next }));
                    }}
                  />
                )
              ))}
            </div>
            {phase.kind === 'generating' && (
              <p className="youtube-dialog-status">Creating your personalised audio… this can take a minute or two.</p>
            )}
            <div className="youtube-dialog-actions">
              <button type="button" className="youtube-dialog-secondary" onClick={onClose} disabled={phase.kind === 'generating'}>
                Cancel
              </button>
              <button
                type="button"
                className="youtube-dialog-primary"
                onClick={() => void continueToShare()}
                disabled={phase.kind === 'generating'}
              >
                {phase.kind === 'generating' ? 'Generating…' : changed ? 'Generate & Share' : 'Share'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
