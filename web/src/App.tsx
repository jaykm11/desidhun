import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { SignInAbortedError, useAuth } from './auth/AuthProvider';
import {
  ApiError,
  analyzeRecordedStyle,
  deleteLibrarySong,
  fetchSongAudio,
  generateCustomLyrics,
  type LyricsLanguage,
  generateLyricsFromImage,
  generateSongPrompt,
  transcribeRecordedLyrics,
  getBillingCountry,
  listLibrarySongs,
  prepareLyriaSong,
  renameLibrarySong,
  saveSongFeedback,
  setSongVisibility,
  setSongPreset,
  getPresetDetail,
  createShareableLink,
  displaySongError,
  songIsPending,
  startCheckout,
  type LibrarySong,
  type BillingCountry,
} from './lib/api';
import {
  CustomLyricsIcon,
  DialogueKindIcon,
  GenerateLyricsIcon,
  ImageLyricsIcon,
  InstrumentalLyricsIcon,
  MusicKindIcon,
  PodcastKindIcon,
  RecordLyricsIcon,
  SongKindIcon,
  VariationLyricsIcon,
} from './ModeIcons';
import { COMPOSITION_KINDS, SONG_GENRES, isDialogueGenre, isMusicalComposition, isSpeechGenre, type CompositionKind } from './data/genres';
import { DEFAULT_TEMPO_SPEED, TEMPO_SPEED_MAX, TEMPO_SPEED_MIN, clampTempoSpeed, tempoBand, tempoPromptLine } from './data/tempo';
import {
  DEFAULT_PAUSE_LEVEL,
  DEFAULT_VOICE_TONE,
  PAUSE_LEVEL_LABELS,
  PAUSE_LEVEL_MAX,
  PAUSE_LEVEL_MIN,
  VOICE_TONE_MAX,
  VOICE_TONE_MIN,
  clampPauseLevel,
  clampVoiceTone,
  pausePromptLine,
  voicePitchPromptLine,
} from './data/voiceTone';
import { CREDIT_PACKS, MEMBERSHIP_OFFERS } from './data/membership';
import { DIALOGUE_CHARACTERS, DIALOGUE_LANGUAGES, SPOKEN_MEDIA_TYPES, dialogueCharacterById, dialogueLanguageById, spokenMediaById } from './data/speechOptions';
import { DIALOGUE_VOICE_PRESETS, VOICE_PRESETS, dialoguePresetsFor, speakerForVocal } from './data/voicePresets';
import type { PaymentProvider } from './data/billing';
import type { AnalysisOptions, AnalysisResult, DialogueCharacter, DialogueLanguage, ResolvedVocal, SpokenMediaType, Vocal } from './types';
import { coverImageForTheme, resolveCoverTheme } from './lib/songIdentity';
import { analyzeLyrics } from './lib/analyze';
import { useIsAdmin } from './lib/useIsAdmin';
import { LoginTopSongs } from './LoginTopSongs';
import { displaySongTitle, songNameFromLyrics } from './lib/songName';
import { loadGoogleIdentityServices } from './lib/youtube';
import { YouTubeUploadDialog } from './YouTubeUploadDialog';
import {
  canUseSystemShare,
  copyShareableLink,
  emailShareUrl,
  shareDesiDhunLink,
  whatsAppShareUrl,
} from './lib/share';

const DEFAULT_LYRICS_PROMPT = 'Write a prompt to generate lyrics using AI';
const MAX_LYRICS_IMAGE_BYTES = 4_000_000;
const SONG_STATUS_STEPS = [
  'Preparing your song…',
  'Composing vocals and music…',
  'Mixing the final take…',
];
const SONG_IMAGE_STATUS_STEPS = ['Starting', 'Composing', 'Mixing'];

const VOICE_TAGS = ['Male', 'Female', 'Child'] as const;
const VOICE_TAG_MIME = 'application/x-desidhun-voice-tag';

/** Puts every [Male] / [Female] / [Child] tag on its own line so the text after it belongs to that voice. */
function normalizeVoiceTags(text: string): string {
  return text
    .replace(/[ \t]*(\[(?:male|female|child)\])[ \t]*/gi, '\n$1\n')
    .replace(/\n+(\[(?:male|female|child)\])\n+/gi, '\n$1\n')
    .replace(/^\n+/, '');
}

function songCoverSrc(song: { title: string; style?: string; lyrics?: string; coverTheme?: string }) {
  return coverImageForTheme(resolveCoverTheme(song.coverTheme, song.title, song.style ?? '', song.lyrics ?? ''));
}

function wavBlob(audio: AudioBuffer): Blob {
  const channels = Math.min(audio.numberOfChannels, 2);
  const frames = audio.length;
  const buffer = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + frames * channels * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function formatSongDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function EditableSongTitle({
  song,
  onRename,
  onToggleVisibility,
  visibilityBusy,
}: {
  song: LibrarySong;
  onRename: (title: string) => Promise<void>;
  onToggleVisibility?: () => void;
  visibilityBusy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const visibleTitle = displaySongTitle(song.title);
  const [draft, setDraft] = useState(visibleTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(displaySongTitle(song.title));
  }, [song.title]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const finish = async () => {
    const next = draft.trim();
    if (!next || next === visibleTitle) {
      setDraft(visibleTitle);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <strong className="song-title-wrap">
      {editing ? (
        <input
          ref={inputRef}
          className="song-title-input"
          value={draft}
          maxLength={80}
          disabled={saving}
          aria-label={`Rename ${visibleTitle}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void finish()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void finish();
            }
            if (event.key === 'Escape') {
              setDraft(visibleTitle);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="song-title-btn"
          onClick={() => setEditing(true)}
          title="Click to rename"
        >
          {visibleTitle}
        </button>
      )}
      {onToggleVisibility ? (
        <button
          type="button"
          className={`song-visibility-btn${song.visibility === 'public' ? ' public' : ' private'}`}
          onClick={onToggleVisibility}
          disabled={visibilityBusy || songIsPending(song) || song.status === 'failed'}
          title={song.visibility === 'public' ? 'Make this song private' : 'Make this song public'}
        >
          {visibilityBusy ? 'Updating…' : song.visibility === 'public' ? 'Public' : 'Private'}
        </button>
      ) : song.visibility === 'public' ? (
        <span className="song-public-badge">Public</span>
      ) : null}
      {song.preset && (
        <a className="song-preset-badge" href="/presets" title="This audio is listed on the Presets page">
          Preset
        </a>
      )}
    </strong>
  );
}

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
}) {
  return (
    <span className="star-rating" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn${star <= value ? ' filled' : ''}`}
          // Clicking the current rating clears it, so a rating can be undone.
          onClick={() => onChange(star === value ? 0 : star)}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={star <= value}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function compositionKindName(kind: CompositionKind | ''): string {
  return COMPOSITION_KINDS.find((item) => item.id === kind)?.name ?? 'song';
}

function notifyEntitlementChanged() {
  window.dispatchEvent(new Event('desidhun:entitlement'));
}

export default function App() {
  const { isConfigured, isLoading, user, signInWithEmail, signInWithGoogle, registerWithEmail } = useAuth();
  const [lyrics, setLyrics] = useState('');
  const [vocal, setVocal] = useState<Vocal>('auto');
  const [voicePresetId, setVoicePresetId] = useState('');
  const [recordingStyle, setRecordingStyle] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [recordSongStyleEnabled, setRecordSongStyleEnabled] = useState(false);
  const [recordedStyleAnalysis, setRecordedStyleAnalysis] = useState<string | null>(null);
  const [recordedStyleAudioUrl, setRecordedStyleAudioUrl] = useState<string | null>(null);
  const [isAnalyzingRecordedStyle, setIsAnalyzingRecordedStyle] = useState(false);
  const [tempoSpeed, setTempoSpeed] = useState(DEFAULT_TEMPO_SPEED);
  const [voicePitch, setVoicePitch] = useState(DEFAULT_VOICE_TONE);
  const [pauseLevel, setPauseLevel] = useState(DEFAULT_PAUSE_LEVEL);
  const lyricsLanguage: LyricsLanguage = /[\u0900-\u097F]/.test(lyrics)
    ? 'hindi'
    : /[A-Za-z]{3,}/.test(lyrics)
      ? 'english'
      : 'hindi';
  const [compositionKind, setCompositionKind] = useState<CompositionKind | ''>('');
  const [dialogueCharacter, setDialogueCharacter] = useState<DialogueCharacter>('hero');
  const [chosenDialogueLanguage, setChosenDialogueLanguage] = useState<DialogueLanguage | null>('hindi');
  const dialogueLanguage: DialogueLanguage = chosenDialogueLanguage ?? (
    /[\u0C00-\u0C7F]/.test(lyrics) ? 'telugu'
      : /[\u0980-\u09FF]/.test(lyrics) ? 'bengali'
        : /[\u4E00-\u9FFF]/.test(lyrics) ? 'chinese'
          : lyricsLanguage === 'english' ? 'english-us'
            : 'hindi'
  );
  const [spokenMediaType, setSpokenMediaType] = useState<SpokenMediaType>('news');
  const [genreOverride, setGenreOverride] = useState<string>('auto');
  const [includeBackgroundMusic, setIncludeBackgroundMusic] = useState(true);
  const [includeInstruments, setIncludeInstruments] = useState(false);
  const [includeIntro, setIncludeIntro] = useState(false);
  const [includeOutro, setIncludeOutro] = useState(false);
  const [includeSargam, setIncludeSargam] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isBillingBusy, setIsBillingBusy] = useState(false);
  const [billingCountry, setBillingCountry] = useState<BillingCountry | null>(null);
  const [payuPhone, setPayuPhone] = useState('');
  const [hasComposedPrompt, setHasComposedPrompt] = useState(false);
  const [enhanceSourceLyrics, setEnhanceSourceLyrics] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [shareMenuSongId, setShareMenuSongId] = useState<string | null>(null);
  const [membershipCadence, setMembershipCadence] = useState<'monthly' | 'yearly'>('yearly');
  const previousUserId = useRef<string | null | undefined>(undefined);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const voiceTagDropped = useRef(false);
  const styleRecorderRef = useRef<MediaRecorder | null>(null);
  const styleRecordingTimerRef = useRef<number | null>(null);
  const lyricsRecorderRef = useRef<MediaRecorder | null>(null);
  const lyricsRecordingTimerRef = useRef<number | null>(null);
  const [emailAuthMode, setEmailAuthMode] = useState<'sign-in' | 'register'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isEmailAuthBusy, setIsEmailAuthBusy] = useState(false);
  const [lyricsMode, setLyricsMode] = useState<'custom' | 'generate' | 'image' | 'instrumental' | 'variation' | 'record' | ''>('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [recordingLyrics, setRecordingLyrics] = useState(false);
  const [isTranscribingLyrics, setIsTranscribingLyrics] = useState(false);
  const [recordedLyricsLanguage, setRecordedLyricsLanguage] = useState<'hindi' | 'english' | null>(null);
  const [lyricsImage, setLyricsImage] = useState<{ name: string; data: string; mimeType: 'image/jpeg' | 'image/png' } | null>(null);
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([]);
  const [libraryMinRating, setLibraryMinRating] = useState(0);
  const [currentLibrarySong, setCurrentLibrarySong] = useState<LibrarySong | null>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);
  const [isLibrarySongPlaying, setIsLibrarySongPlaying] = useState(false);
  const [libraryPlaybackProgress, setLibraryPlaybackProgress] = useState(0);
  const [libraryPlaybackDuration, setLibraryPlaybackDuration] = useState(0);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [songError, setSongError] = useState<string | null>(null);
  const [variationSourceSong, setVariationSourceSong] = useState<LibrarySong | null>(null);
  const [openSongMenuId, setOpenSongMenuId] = useState<string | null>(null);
  const [songMenuAnchor, setSongMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [copyingShareLinkId, setCopyingShareLinkId] = useState<string | null>(null);
  const [youtubeUploadSong, setYoutubeUploadSong] = useState<LibrarySong | null>(null);
  const [sharingSongId, setSharingSongId] = useState<string | null>(null);
  const [presetSongId, setPresetSongId] = useState<string | null>(null);
  const isAdmin = useIsAdmin(user);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [downloadingSongId, setDownloadingSongId] = useState<string | null>(null);
  const [songName, setSongName] = useState('');
  const [songNameEdited, setSongNameEdited] = useState(false);
  const [songStatusIndex, setSongStatusIndex] = useState(0);
  const [selectedLyrics, setSelectedLyrics] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [styleManuallyEdited, setStyleManuallyEdited] = useState(false);

  const compositionGenre = !compositionKind || isMusicalComposition(compositionKind) ? genreOverride : compositionKind;
  const hasLyricsContent = lyrics.trim().length > 0;
  const [guideFinished, setGuideFinished] = useState(false);
  const guideStep: 'kind' | 'mode' | 'text' | 'finish' | null = !compositionKind
    ? 'kind'
    : !lyricsMode
      ? 'mode'
      : !hasLyricsContent
        ? 'text'
        : guideFinished ? null : 'finish';

  useEffect(() => {
    setGuideFinished(false);
  }, [lyrics, compositionKind]);
  const options: AnalysisOptions = useMemo(
    () => ({
      vocal: compositionKind === 'dialogue-punchline' && vocal === 'auto' ? 'male' : vocal,
      voiceStyleId: vocal === 'auto' && !isDialogueGenre(compositionGenre) ? undefined : voicePresetId || undefined,
      tempo: tempoBand(tempoSpeed),
      tempoSpeed,
      voicePitch,
      genreOverride: compositionGenre,
      dialogueCharacter: compositionKind === 'dialogue-punchline' ? dialogueCharacter : undefined,
      dialogueLanguage: compositionKind === 'dialogue-punchline' ? dialogueLanguage : undefined,
      spokenMediaType: compositionKind === 'spoken-vocal' ? spokenMediaType : undefined,
      includeBackgroundMusic,
      includeInstruments,
      includeAlap: isSpeechGenre(compositionGenre) ? false : includeIntro,
      includeIntro,
      includeOutro,
      includeSargam: isSpeechGenre(compositionGenre) ? false : includeSargam,
    }),
    [vocal, voicePresetId, tempoSpeed, voicePitch, compositionGenre, compositionKind, dialogueCharacter, dialogueLanguage, spokenMediaType, includeBackgroundMusic, includeInstruments, includeIntro, includeOutro, includeSargam],
  );
  const usesPayU = billingCountry === 'OTHER';
  const payuPhoneIsValid = /^\d{10,15}$/.test(payuPhone.replace(/\D/g, ''));

  useEffect(() => {
    if (!user) return;
    void loadGoogleIdentityServices().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBillingCountry(null);
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!user || !plansOpen || billingCountry) return;
    void getBillingCountry(user)
      .then(({ billingCountry: country }) => setBillingCountry(country))
      .catch(() => setBillingCountry(null));
  }, [user, plansOpen, billingCountry]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('checkout')) return;
    window.location.replace(`/payment-result${window.location.search}`);
  }, []);

  useEffect(() => {
    if (!user) {
      setLibrarySongs([]);
      setIsGeneratingSong(false);
      return;
    }
    let cancelled = false;
    const loadTimer = window.setTimeout(() => void listLibrarySongs(user)
      .then(async ({ songs }) => {
        if (cancelled) return;
        setLibrarySongs(songs);
      })
      .catch(() => {
        if (!cancelled) setLibrarySongs([]);
      }), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
    };
  }, [user]);

  const hasPendingSongs = librarySongs.some(songIsPending);

  useEffect(() => {
    if (!user || !hasPendingSongs) {
      setIsGeneratingSong(false);
      return;
    }

    setIsGeneratingSong(true);
    let cancelled = false;
    const refresh = () => {
      void listLibrarySongs(user)
        .then(({ songs }) => {
          if (!cancelled) setLibrarySongs(songs);
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 2_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, hasPendingSongs]);

  useEffect(() => {
    return () => {
      if (currentSongUrl) URL.revokeObjectURL(currentSongUrl);
    };
  }, [currentSongUrl]);

  useEffect(() => {
    if (!isGeneratingSong) {
      setSongStatusIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSongStatusIndex((current) => (current + 1) % SONG_STATUS_STEPS.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isGeneratingSong]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        setOpenSongMenuId(null);
        setSongMenuAnchor(null);
        setShareMenuSongId(null);
        return;
      }
      if (!event.target.closest('.song-menu')) {
        setOpenSongMenuId(null);
        setSongMenuAnchor(null);
        setShareMenuSongId(null);
      }
    };
    document.addEventListener('pointerdown', closeMenus);
    return () => document.removeEventListener('pointerdown', closeMenus);
  }, []);

  useEffect(() => {
    if (!openSongMenuId) return;
    const repositionOrClose = () => {
      setOpenSongMenuId(null);
      setSongMenuAnchor(null);
      setShareMenuSongId(null);
    };
    window.addEventListener('resize', repositionOrClose);
    window.addEventListener('scroll', repositionOrClose, true);
    return () => {
      window.removeEventListener('resize', repositionOrClose);
      window.removeEventListener('scroll', repositionOrClose, true);
    };
  }, [openSongMenuId]);

  useEffect(() => {
    const currentUserId = user?.uid ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== currentUserId) {
      setLyrics('');
      setResult(null);
      setComposeError(null);
      setSelectedLyrics('');
      setSelectedStyle('');
      setSongName('');
      setSongNameEdited(false);
      setSongError(null);
      setVariationSourceSong(null);
      setOpenSongMenuId(null);
      setShareMenuSongId(null);
      setLyricsImage(null);
    }
    previousUserId.current = currentUserId;
  }, [user?.uid]);

  useEffect(() => {
    if (songNameEdited) return;
    const next = songNameFromLyrics(lyrics);
    if (next) setSongName(next);
  }, [lyrics, songNameEdited]);

  const selectCompositionKind = (nextKind: CompositionKind) => {
    setCompositionKind(nextKind);
    setVoicePresetId('');
    if (isMusicalComposition(nextKind)) {
      if (nextKind === 'music') {
        if (lyricsMode !== 'instrumental') startInstrumental();
      } else if (lyricsMode === 'instrumental') {
        setLyricsMode('custom');
      }
    } else {
      setIncludeInstruments(false);
      setIncludeIntro(false);
      setIncludeOutro(false);
      setIncludeSargam(false);
      setIncludeBackgroundMusic(false);
      if (lyricsMode === 'instrumental') setLyricsMode('custom');
      if (nextKind === 'spoken-vocal') setSpokenMediaType('podcast');
    }
    setHasComposedPrompt(false);
    setEnhanceSourceLyrics('');
    setSelectedStyle('');
    setSelectedLyrics('');
  };

  useEffect(() => {
    if (!user) return;
    const presetId = new URLSearchParams(window.location.search).get('preset');
    if (!presetId) return;
    let cancelled = false;
    window.history.replaceState(null, '', window.location.pathname);
    void getPresetDetail(user, presetId)
      .then(({ preset }) => {
        if (cancelled) return;
        const tags = new Map<string, string>();
        const proseBlocks: string[] = [];
        for (const block of preset.style.split(/\n{2,}/)) {
          if (/^[A-Z][A-Z_]+(?:=|$)/m.test(block.trim())) {
            for (const line of block.split('\n')) {
              const match = line.trim().match(/^([A-Z][A-Z_]+)(?:=(.*))?$/);
              if (match) tags.set(match[1], match[2] ?? '');
            }
          } else if (block.trim()) {
            proseBlocks.push(block.trim());
          }
        }
        const kind: CompositionKind = preset.category === 'reels'
          ? 'dialogue-punchline'
          : preset.category === 'messages'
            ? 'spoken-vocal'
            : /\[Instrumental composition only/i.test(preset.lyrics) ? 'music' : 'songs';
        selectCompositionKind(kind);
        const numberTag = (name: string) => {
          const value = Number(tags.get(name));
          return Number.isFinite(value) && tags.has(name) ? value : null;
        };
        const tempo = numberTag('TEMPO_SPEED');
        if (tempo !== null) setTempoSpeed(clampTempoSpeed(tempo));
        const pitch = numberTag('VOICE_PITCH');
        if (pitch !== null) setVoicePitch(clampVoiceTone(pitch));
        const pause = numberTag('PAUSE_LEVEL');
        if (pause !== null) setPauseLevel(clampPauseLevel(pause));
        const character = tags.get('DIALOGUE_CHARACTER');
        if (DIALOGUE_CHARACTERS.some((item) => item.id === character)) setDialogueCharacter(character as DialogueCharacter);
        const language = tags.get('DIALOGUE_LANGUAGE');
        if (DIALOGUE_LANGUAGES.some((item) => item.id === language)) setChosenDialogueLanguage(language as DialogueLanguage);
        const media = tags.get('SPOKEN_MEDIA');
        if (SPOKEN_MEDIA_TYPES.some((item) => item.id === media)) setSpokenMediaType(media as SpokenMediaType);
        const styleId = tags.get('DIALOGUE_STYLE');
        if (DIALOGUE_VOICE_PRESETS.some((preset) => preset.id === styleId)) setVoicePresetId(styleId ?? '');
        const presetVocal = tags.get('DIALOGUE_VOCAL') ?? tags.get('SPOKEN_VOCAL');
        if (presetVocal && ['female', 'male', 'duet', 'child'].includes(presetVocal)) setVocal(presetVocal as Vocal);

        if (kind === 'music') {
          setLyricsMode('instrumental');
          setLyrics('');
        } else {
          setLyricsMode('custom');
          setLyrics(preset.lyrics);
        }
        setVariationSourceSong(null);
        setResult(null);
        setSongName(`${preset.title}`.slice(0, 80));
        setSongNameEdited(true);
        const prose = proseBlocks.join('\n\n');
        if (prose && !isSpeechGenre(kind)) {
          setEditStyle(prose);
          setStyleManuallyEdited(true);
        }
        setComposeError(null);
        setSongError(null);
        window.setTimeout(() => {
          promptInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          promptInputRef.current?.focus();
        }, 300);
      })
      .catch((error) => {
        if (!cancelled) setComposeError(error instanceof ApiError ? error.message : 'The preset could not be opened for editing.');
      });
    return () => { cancelled = true; };
  }, [user]);

  const composeSongPrompt = async (sourceText: string, optionOverrides?: Partial<AnalysisOptions>): Promise<{
    songLyrics: string;
    style: string;
    title: string;
    analysis: AnalysisResult | null;
  }> => {
    const composeOptions: AnalysisOptions = { ...options, ...optionOverrides };
    // Dialogue / podcast custom text must stay exactly as written — no song structure.
    if (isSpeechGenre(compositionKind)) {
      if (!user) throw new Error('Sign in to compose a song prompt.');
      const response = await generateSongPrompt(user, sourceText, {
        ...composeOptions,
        includeInstruments: false,
        includeIntro: false,
        includeOutro: false,
        includeSargam: false,
        includeAlap: false,
        includeBridge: false,
        includeBackgroundMusic: false,
      });
      const nextResult = response.result;
      const firstStyle = nextResult.prompts[0];
      return {
        songLyrics: sourceText.trim(),
        style: firstStyle?.prompt ?? '',
        title: songNameFromLyrics(sourceText) || nextResult.songTitle,
        analysis: nextResult,
      };
    }
    if (lyricsMode === 'variation' && !isSpeechGenre(compositionKind)) {
      if (!variationSourceSong) throw new Error('Choose a song to vary from your Song library first.');
      const sourceLyrics = variationSourceSong.lyrics.trim()
        || '[Instrumental composition only. Do not include vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.]';
      const sourceStyle = variationSourceSong.style.trim() || 'Create a polished musical arrangement.';
      return {
        songLyrics: sourceLyrics,
        style: `${sourceStyle}\n\nCreate a new variation of this song. Preserve its overall identity where appropriate, and apply this requested change: ${sourceText.trim()}`,
        title: `${variationSourceSong.title} variation`.slice(0, 80),
        analysis: null,
      };
    }
    if (lyricsMode === 'instrumental' && !isSpeechGenre(compositionKind)) {
      return {
        songLyrics: '[Instrumental composition only. Do not include vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.]',
        style: sourceText.trim(),
        title: 'Instrumental',
        analysis: null,
      };
    }
    if (!user) throw new Error('Sign in to compose a song prompt.');
    const response = await generateSongPrompt(user, sourceText, composeOptions);
    const nextResult = response.result;
    const firstStyle = nextResult.prompts[0];
    return {
      songLyrics: nextResult.arrangement.instrumentedLyrics,
      style: firstStyle?.prompt ?? '',
      title: songNameFromLyrics(sourceText) || nextResult.songTitle,
      analysis: nextResult,
    };
  };

  const applyEnhancedLyrics = async (sourceText: string, optionOverrides?: Partial<AnalysisOptions>) => {
    setComposeError(null);
    setIsComposing(true);
    try {
      const composed = await composeSongPrompt(sourceText, optionOverrides);
      setResult(composed.analysis);
      if (composed.analysis) notifyEntitlementChanged();
      setLyrics(composed.songLyrics);
      setLyricsMode(lyricsMode === 'instrumental' ? 'instrumental' : 'custom');
      setSelectedLyrics(composed.songLyrics);
      setSelectedStyle(composed.style);
      if (!songNameEdited) setSongName(composed.title);
      setHasComposedPrompt(true);
    } catch (error) {
      setResult(null);
      setComposeError(
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Song prompt composition could not be completed. Please try again.',
      );
    } finally {
      setIsComposing(false);
    }
  };

  const toggleEnhanceOption = (
    key: 'includeInstruments' | 'includeIntro' | 'includeOutro' | 'includeSargam',
    nextValue: boolean,
  ) => {
    if (key === 'includeInstruments') {
      setIncludeInstruments(nextValue);
      if (nextValue && isSpeechGenre(compositionGenre)) setIncludeBackgroundMusic(true);
    } else if (key === 'includeIntro') setIncludeIntro(nextValue);
    else if (key === 'includeOutro') setIncludeOutro(nextValue);
    else setIncludeSargam(nextValue);

    const nextOptions: Partial<AnalysisOptions> = {
      includeInstruments: key === 'includeInstruments' ? nextValue : includeInstruments,
      includeIntro: key === 'includeIntro' ? nextValue : includeIntro,
      includeOutro: key === 'includeOutro' ? nextValue : includeOutro,
      includeSargam: key === 'includeSargam' ? nextValue : includeSargam,
      includeAlap: key === 'includeIntro' ? nextValue : includeIntro,
    };
    if (nextValue && key === 'includeInstruments' && isSpeechGenre(compositionGenre)) {
      nextOptions.includeBackgroundMusic = true;
    }

    if (!user || !lyricsMode || !compositionKind) return;
    const source = enhanceSourceLyrics.trim() || lyrics;
    if (!source.trim()) return;
    if (!enhanceSourceLyrics.trim()) setEnhanceSourceLyrics(source);
    void applyEnhancedLyrics(source, nextOptions);
  };

  const styleVoiceParts = (resolvedVocal: ResolvedVocal) => {
    const dialoguePreset = isDialogueGenre(compositionGenre)
      ? DIALOGUE_VOICE_PRESETS.find((preset) => preset.id === voicePresetId)
      : undefined;
    const voicePreset = isDialogueGenre(compositionGenre) || vocal === 'auto'
      ? undefined
      : VOICE_PRESETS[vocal].find((preset) => preset.id === voicePresetId);
    const dialogueVocal = vocal === 'auto' ? 'male' : vocal;
    const speaker = isDialogueGenre(compositionGenre)
      ? speakerForVocal(dialogueVocal)
      : voicePreset?.speaker ?? speakerForVocal(resolvedVocal);
    return { dialoguePreset, voicePreset, speaker, dialogueVocal };
  };

  /** Human-readable style shown in Edit Style — driven by lyric analysis + composition choices. */
  const buildProseStyle = (baseStyle: string, resolvedVocal: ResolvedVocal) => {
    const { dialoguePreset, voicePreset } = styleVoiceParts(resolvedVocal);
    return [
      baseStyle.trim(),
      !isDialogueGenre(compositionGenre) && !isSpeechGenre(compositionGenre) && voicePreset
        ? `Vocal style: ${voicePreset.prompt}.`
        : '',
      isDialogueGenre(compositionGenre) && dialoguePreset ? dialoguePreset.prompt : '',
      !isSpeechGenre(compositionGenre) && vocal !== 'auto' ? `Voice: ${vocal}.` : '',
      recordSongStyleEnabled && recordedStyleAnalysis && !isSpeechGenre(compositionGenre)
        ? `Use this as a general production reference only; create an original composition without copying its melody or lyrics: ${recordedStyleAnalysis}`
        : '',
    ].filter(Boolean).join('\n\n');
  };

  /** Machine tags the API/TTS parsers need — appended at generate time, not shown in Edit Style. */
  const buildMachineStyleTags = (resolvedVocal: ResolvedVocal) => {
    const { dialoguePreset, voicePreset, speaker, dialogueVocal } = styleVoiceParts(resolvedVocal);
    if (isDialogueGenre(compositionGenre)) {
      return [
        'DIALOGUE_PUNCHLINE_DELIVERY',
        `DIALOGUE_SPEAKER=${speaker}`,
        `DIALOGUE_VOCAL=${dialogueVocal}`,
        `DIALOGUE_TEMPO=${tempoBand(tempoSpeed)}`,
        `TEMPO_SPEED=${tempoSpeed}`,
        `VOICE_PITCH=${voicePitch}`,
        `PAUSE_LEVEL=${pauseLevel}`,
        `DIALOGUE_CHARACTER=${dialogueCharacter}`,
        `DIALOGUE_LANGUAGE=${dialogueLanguage}`,
        dialoguePreset ? `DIALOGUE_STYLE=${dialoguePreset.id}` : '',
        dialoguePreset?.prompt ?? '',
      ].filter(Boolean).join('\n');
    }
    if (compositionGenre === 'spoken-vocal') {
      return [
        'SPOKEN_WORD_DELIVERY',
        `SPOKEN_MEDIA=${spokenMediaType}`,
        `SPOKEN_SPEAKER=${speaker}`,
        `SPOKEN_VOCAL=${resolvedVocal}`,
        `TEMPO_SPEED=${tempoSpeed}`,
        `VOICE_PITCH=${voicePitch}`,
        `PAUSE_LEVEL=${pauseLevel}`,
        `Read the lyrics as ${spokenMediaById(spokenMediaType).prompt}. Use a ${resolvedVocal} voice${voicePreset ? `, ${voicePreset.prompt}` : ''}. Match the selected tempo: ${tempoPromptLine(tempoSpeed)}. Voice tone: ${voicePitchPromptLine(voicePitch)}. Speak the provided text exactly. Do not translate or invent lines. Do not sing. Speech only, with no background music or instruments.`,
      ].join('\n');
    }
    return [
      `TEMPO_SPEED=${tempoSpeed}`,
      `VOICE_PITCH=${voicePitch}`,
      `PAUSE_LEVEL=${pauseLevel}`,
      pauseLevel > 0 ? `Phrasing: ${pausePromptLine(pauseLevel)}.` : '',
    ].filter(Boolean).join('\n');
  };

  useEffect(() => {
    if (!compositionKind) {
      setEditStyle('');
      setStyleManuallyEdited(false);
      return;
    }
    if (styleManuallyEdited) return;

    const timer = window.setTimeout(() => {
      const resolved = vocal === 'auto' ? (result?.vocal ?? 'female') : vocal;
      if (!lyrics.trim()) {
        setEditStyle('');
        return;
      }
      if (lyricsMode === 'instrumental') {
        setEditStyle(buildProseStyle(lyrics.trim(), resolved));
        return;
      }
      if (lyricsMode === 'variation' && variationSourceSong) {
        const variationStyle = [
          variationSourceSong.style.trim() || 'Create a polished musical arrangement.',
          `Create a new variation of this song. Preserve its overall identity where appropriate, and apply this requested change: ${lyrics.trim()}`,
        ].join('\n\n');
        setEditStyle(buildProseStyle(variationStyle, resolved));
        return;
      }
      try {
        const analysis = analyzeLyrics(lyrics, options);
        const prompt = analysis.prompts[0]?.prompt ?? '';
        setEditStyle(buildProseStyle(prompt, resolved));
      } catch {
        setEditStyle(buildProseStyle('', resolved));
      }
    }, 320);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compositionKind,
    compositionGenre,
    vocal,
    voicePresetId,
    tempoSpeed,
    voicePitch,
    pauseLevel,
    genreOverride,
    dialogueCharacter,
    dialogueLanguage,
    spokenMediaType,
    lyrics,
    lyricsMode,
    variationSourceSong,
    recordSongStyleEnabled,
    recordedStyleAnalysis,
    options,
    styleManuallyEdited,
    result?.vocal,
  ]);

  const resetEditStyleFromSelections = () => {
    setStyleManuallyEdited(false);
    const resolved = vocal === 'auto' ? (result?.vocal ?? 'female') : vocal;
    if (!lyrics.trim()) {
      setEditStyle('');
      return;
    }
    if (lyricsMode === 'instrumental') {
      setEditStyle(buildProseStyle(lyrics.trim(), resolved));
      return;
    }
    if (lyricsMode === 'variation' && variationSourceSong) {
      const variationStyle = [
        variationSourceSong.style.trim() || 'Create a polished musical arrangement.',
        `Create a new variation of this song. Preserve its overall identity where appropriate, and apply this requested change: ${lyrics.trim()}`,
      ].join('\n\n');
      setEditStyle(buildProseStyle(variationStyle, resolved));
      return;
    }
    try {
      const analysis = analyzeLyrics(lyrics, options);
      setEditStyle(buildProseStyle(analysis.prompts[0]?.prompt ?? '', resolved));
    } catch {
      setEditStyle(buildProseStyle(selectedStyle, resolved));
    }
  };

  const clearLyrics = () => {
    setLyrics('');
    setHasComposedPrompt(false);
    setEnhanceSourceLyrics('');
    setSelectedStyle('');
    setSelectedLyrics('');
    setStyleManuallyEdited(false);
    setEditStyle('');
    setComposeError(null);
    setSongError(null);
    setLyricsImage(null);
    setRecordedLyricsLanguage(null);
  };

  const showVoiceTags = (compositionKind === 'dialogue-punchline' || compositionKind === 'songs' || compositionKind === 'spoken-vocal')
    && vocal === 'duet'
    && !!lyricsMode
    && lyricsMode !== 'generate'
    && lyricsMode !== 'image';

  /** Click fallback for touch screens: tag goes at the start of the line holding the cursor. */
  const insertVoiceTagAtCursor = (tag: (typeof VOICE_TAGS)[number]) => {
    const input = promptInputRef.current;
    const caret = input?.selectionStart ?? lyrics.length;
    const lineStart = lyrics.lastIndexOf('\n', caret - 1) + 1;
    const next = normalizeVoiceTags(`${lyrics.slice(0, lineStart)}[${tag}]\n${lyrics.slice(lineStart)}`);
    setLyrics(next);
    setHasComposedPrompt(false);
    setSelectedStyle('');
    setSelectedLyrics('');
    requestAnimationFrame(() => {
      if (!input) return;
      const position = next.indexOf(`[${tag}]`, Math.max(0, lineStart - 1)) + tag.length + 3;
      input.focus();
      input.setSelectionRange(position, position);
    });
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      if (error instanceof SignInAbortedError) return;
      setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.');
    }
  };

  const handleEmailAuthentication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    if (emailAuthMode === 'register' && password !== passwordConfirmation) {
      setAuthError('The passwords do not match. Please enter the same password twice.');
      return;
    }
    setIsEmailAuthBusy(true);
    try {
      if (emailAuthMode === 'register') {
        await registerWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Email sign-in could not be completed.');
    } finally {
      setIsEmailAuthBusy(false);
    }
  };

  const startCustomLyrics = () => {
    setComposeError(null);
    setLyricsMode('custom');
    setVariationSourceSong(null);
    setHasComposedPrompt(false);
    setLyrics((current) => (current.trim() === DEFAULT_LYRICS_PROMPT ? '' : current));
  };

  const startLyricsGeneration = () => {
    setComposeError(null);
    setLyrics((current) => (current.trim() === DEFAULT_LYRICS_PROMPT ? '' : current));
    setLyricsMode('generate');
    setVariationSourceSong(null);
    setHasComposedPrompt(false);
  };

  const startImageLyricsGeneration = () => {
    setComposeError(null);
    setLyrics((current) => (current.trim() === DEFAULT_LYRICS_PROMPT ? '' : current));
    setLyricsMode('image');
    setVariationSourceSong(null);
    setHasComposedPrompt(false);
  };

  const startInstrumental = () => {
    setComposeError(null);
    setLyricsMode('instrumental');
    setVariationSourceSong(null);
    setHasComposedPrompt(false);
    setLyrics((current) => (current.trim() === DEFAULT_LYRICS_PROMPT ? '' : current));
  };

  const stopLyricsRecording = () => {
    lyricsRecorderRef.current?.stop();
  };

  const startRecordLyrics = () => {
    setComposeError(null);
    setLyricsMode('record');
    setVariationSourceSong(null);
    setHasComposedPrompt(false);
    setRecordedLyricsLanguage(null);
    setLyrics((current) => (current.trim() === DEFAULT_LYRICS_PROMPT ? '' : current));
  };

  const startSongVariation = (song: LibrarySong) => {
    const sourceLyrics = song.lyrics.trim()
      || '[Instrumental composition only. Do not include vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.]';
    const sourceStyle = song.style.trim() || 'Create a polished musical arrangement.';
    setVariationSourceSong(song);
    setLyricsMode('variation');
    setLyrics('');
    setSelectedLyrics(sourceLyrics);
    setSelectedStyle(sourceStyle);
    setResult(null);
    setSongNameEdited(true);
    setSongName(`${song.title} variation`.slice(0, 80));
    setHasComposedPrompt(true);
    setComposeError(null);
    setSongError(null);
    setOpenSongMenuId(null);
  };

  const selectLyricsMode = (nextMode: 'custom' | 'generate' | 'image' | 'instrumental' | 'variation' | 'record') => {
    if (!compositionKind) return;
    if (nextMode === 'generate') startLyricsGeneration();
    else if (nextMode === 'image') startImageLyricsGeneration();
    else if (nextMode === 'instrumental') startInstrumental();
    else if (nextMode === 'record') startRecordLyrics();
    else if (nextMode === 'variation') {
      if (!variationSourceSong) return;
      startSongVariation(variationSourceSong);
    } else {
      startCustomLyrics();
    }
    if (nextMode !== 'record') stopLyricsRecording();
  };

  const recordLyricsAudio = async () => {
    if (recordingLyrics) {
      stopLyricsRecording();
      return;
    }
    if (!user) {
      setAuthError('Sign in before recording lyrics.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      lyricsRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (lyricsRecordingTimerRef.current) window.clearTimeout(lyricsRecordingTimerRef.current);
        lyricsRecordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        lyricsRecorderRef.current = null;
        setRecordingLyrics(false);
        const recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!recording.size) return;
        setIsTranscribingLyrics(true);
        setComposeError(null);
        void transcribeRecordedLyrics(user, recording)
          .then(({ lyrics: nextLyrics, language }) => {
            setLyrics(nextLyrics);
            setRecordedLyricsLanguage(language);
            setHasComposedPrompt(false);
          })
          .catch((error) => setComposeError(error instanceof ApiError ? error.message : 'The recording could not be turned into lyrics.'))
          .finally(() => setIsTranscribingLyrics(false));
      };
      recorder.start();
      setRecordingLyrics(true);
      setRecordedLyricsLanguage(null);
      lyricsRecordingTimerRef.current = window.setTimeout(() => recorder.stop(), 60_000);
    } catch {
      setComposeError('Microphone access is required to record lyrics.');
    }
  };

  const selectLyricsImage = (file: File | undefined) => {
    if (!file) return;
    const mimeType = file.type === 'image/png' || /\.png$/i.test(file.name)
      ? 'image/png'
      : file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
        ? 'image/jpeg'
        : undefined;
    if (!mimeType || file.size > MAX_LYRICS_IMAGE_BYTES) {
      setLyricsImage(null);
      setComposeError('Upload a JPG or PNG image smaller than 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setLyricsImage({
        name: file.name,
        data: reader.result.slice(reader.result.indexOf(',') + 1),
        mimeType,
      });
      setComposeError(null);
    };
    reader.onerror = () => setComposeError('The image could not be read. Please try another JPG or PNG.');
    reader.readAsDataURL(file);
  };

  const handleGenerateLyrics = async () => {
    if (!user) {
      setAuthError('Sign in before generating lyrics.');
      return;
    }
    const spokenMedia = spokenMediaById(spokenMediaType);
    const prompt = [
      lyrics.trim(),
      isDialogueGenre(compositionGenre) ? `Character: ${dialogueCharacterById(dialogueCharacter).name}. Write the line in that character's voice.` : '',
      isDialogueGenre(compositionGenre) ? `Language: ${dialogueLanguageById(dialogueLanguage).name}. ${dialogueLanguageById(dialogueLanguage).writing}` : '',
      vocal === 'duet' && compositionKind !== 'music'
        ? `Write it for two voices. Put [Male] or [Female] (or [Child] if a child ${compositionKind === 'songs' ? 'sings' : 'speaks'}) on its own line before each voice's lines. Do not write speaker names.`
        : '',
      compositionKind === 'spoken-vocal' ? `Media type: ${spokenMedia.name}. Write a spoken ${spokenMedia.name} script.` : '',
    ].filter(Boolean).join('\n');
    const lyricsKind = isDialogueGenre(compositionGenre) ? 'dialogue' : compositionKind === 'spoken-vocal' ? 'spoken' : 'song';
    if (!prompt) {
      setComposeError(isDialogueGenre(compositionGenre)
        ? 'Describe the dialogue or punchline you want, then press Generate.'
        : 'Describe the lyrics you want, then press Generate.');
      return;
    }
    if (lyricsMode === 'image' && !lyricsImage) {
      setComposeError('Upload a JPG or PNG image before generating lyrics.');
      return;
    }
    setComposeError(null);
    setIsGeneratingLyrics(true);
    try {
      const response = lyricsMode === 'image'
        ? await generateLyricsFromImage(user, prompt, lyricsImage!.data, lyricsImage!.mimeType, lyricsKind)
        : await generateCustomLyrics(user, prompt, lyricsKind === 'dialogue' ? 'other' : lyricsLanguage, lyricsKind);
      setLyrics(response.lyrics);
      setLyricsMode('custom');
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof DOMException && error.name === 'TimeoutError'
          ? 'Lyrics generation timed out. Please try again.'
          : 'Lyrics could not be generated. Please try again.';
      setComposeError(message);
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const recordSongStyle = async () => {
    if (recordingStyle) {
      styleRecorderRef.current?.stop();
      return;
    }
    if (!recordingConsent) {
      setComposeError('Confirm that you have permission to use this recording before recording a song style.');
      return;
    }
    if (!user) {
      setAuthError('Sign in before recording a song style.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      styleRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (styleRecordingTimerRef.current) window.clearTimeout(styleRecordingTimerRef.current);
        styleRecordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        styleRecorderRef.current = null;
        setRecordingStyle(false);
        const recording = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!recording.size) return;
        const audioUrl = URL.createObjectURL(recording);
        setRecordedStyleAudioUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return audioUrl;
        });
        setIsAnalyzingRecordedStyle(true);
        void analyzeRecordedStyle(user, recording)
          .then(({ style }) => {
            setRecordedStyleAnalysis(style);
          })
          .catch((error) => setComposeError(error instanceof ApiError ? error.message : 'The recording could not be analyzed.'))
          .finally(() => setIsAnalyzingRecordedStyle(false));
      };
      recorder.start();
      setRecordedStyleAnalysis(null);
      setRecordingStyle(true);
      styleRecordingTimerRef.current = window.setTimeout(() => recorder.stop(), 30_000);
    } catch {
      setComposeError('Microphone access is required to record a song style.');
    }
  };

  const playLibrarySong = async (song: LibrarySong) => {
    if (!user || songIsPending(song) || song.status === 'failed') return;
      setVariationSourceSong(null);
    setSongError(null);
    try {
      const blob = await fetchSongAudio(user, song.id);
      const nextUrl = URL.createObjectURL(blob);
      setCurrentSongUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setCurrentLibrarySong(song);
      setIsLibrarySongPlaying(false);
      setLibraryPlaybackProgress(0);
      setLibraryPlaybackDuration(0);
      const audio = libraryAudioRef.current;
      if (audio) {
        audio.src = nextUrl;
        audio.load();
        await audio.play();
      }
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The song could not be loaded.');
    }
  };

  const toggleLibrarySongPlayback = async (song: LibrarySong) => {
    const audio = libraryAudioRef.current;
    if (currentLibrarySong?.id === song.id && audio) {
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          setSongError('The song could not be played.');
        }
      } else {
        audio.pause();
      }
      return;
    }
    await playLibrarySong(song);
  };

  const downloadLibrarySong = async (song: LibrarySong, format: 'mp3' | 'wav') => {
    if (!user) return;
    setSongError(null);
    setDownloadingSongId(song.id);
    try {
      const mp3 = await fetchSongAudio(user, song.id);
      let file = mp3;
      if (format === 'wav') {
        const AudioContextClass = window.AudioContext;
        const context = new AudioContextClass();
        try {
          file = wavBlob(await context.decodeAudioData(await mp3.arrayBuffer()));
        } finally {
          await context.close();
        }
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${song.title.replace(/[^\w\u0900-\u097F-]+/g, '-').replace(/^-|-$/g, '') || 'desi-dhun-song'}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The song could not be downloaded.');
    } finally {
      setDownloadingSongId(null);
    }
  };

  const handleGenerateSong = async () => {
    if (!user) {
      setAuthError('Sign in before generating a song.');
      return;
    }
    if (!lyricsMode) {
      setSongError('Select a lyrics mode first.');
      return;
    }
    if (!compositionKind) {
      setSongError('Select Song, Music, Podcast, or Reels first.');
      return;
    }
    if (!lyrics.trim()) {
      setSongError('Add lyrics or a prompt before generating.');
      return;
    }

    setSongError(null);
    setComposeError(null);
    setIsGeneratingSong(true);
    let pendingId: string | undefined;
    const styleSnapshot = editStyle.trim();
    const useEditedStyle = styleManuallyEdited && styleSnapshot.length > 0;
    try {
      let songLyrics = hasComposedPrompt ? (selectedLyrics.trim() || lyrics.trim()) : '';
      let baseStyle = hasComposedPrompt ? selectedStyle.trim() : '';
      if (isSpeechGenre(compositionKind)) {
        // Custom dialogue / podcast text is performed as-is — never rewrite via the song composer.
        songLyrics = lyrics.trim();
        baseStyle = baseStyle || ' ';
        setSelectedLyrics(songLyrics);
        setSelectedStyle(baseStyle.trim());
        setHasComposedPrompt(true);
      } else if (!songLyrics || !baseStyle) {
        setIsComposing(true);
        try {
          const composed = await composeSongPrompt(lyrics);
          songLyrics = composed.songLyrics;
          baseStyle = composed.style;
          setResult(composed.analysis);
          if (composed.analysis) notifyEntitlementChanged();
          setSelectedLyrics(songLyrics);
          setSelectedStyle(baseStyle);
          if (!songNameEdited) setSongName(composed.title);
          setHasComposedPrompt(true);
        } finally {
          setIsComposing(false);
        }
      }
      if (!songLyrics.trim() || (isSpeechGenre(compositionKind) ? false : !baseStyle.trim())) {
        throw new Error('The song prompt could not be prepared.');
      }

      const resolvedVocal = vocal === 'auto' ? (result?.vocal ?? 'female') : vocal;
      const prose = useEditedStyle
        ? styleSnapshot
        : buildProseStyle(isSpeechGenre(compositionKind) ? '' : baseStyle, resolvedVocal);
      const style = [prose, buildMachineStyleTags(resolvedVocal)].filter(Boolean).join('\n\n');
      if (!useEditedStyle) {
        setEditStyle(prose);
        setStyleManuallyEdited(false);
      }
      if (!style.trim() && !isSpeechGenre(compositionKind)) {
        throw new Error('The song prompt could not be prepared.');
      }
      const nextLyrics = lyricsMode === 'instrumental'
        ? '[Instrumental composition only. Do not include vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.]'
        : songLyrics;
      const generator = isSpeechGenre(compositionGenre) ? 'chirp-3-hd' : 'lyria';
      const { song: pending } = await prepareLyriaSong(user, style, nextLyrics, songName.trim() || 'Untitled', generator);
      pendingId = pending.id;
      setLibrarySongs((current) => [pending, ...current.filter((item) => item.id !== pending.id)]);
    } catch (error) {
      const message = displaySongError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The song could not be generated. Please try again.',
      );
      setSongError(message);
      if (pendingId) {
        setLibrarySongs((current) => current.map((item) => (
          item.id === pendingId ? { ...item, status: 'failed', error: message } : item
        )));
      }
    } finally {
      setIsGeneratingSong(false);
      notifyEntitlementChanged();
    }
  };

  const applyLibrarySongUpdate = (updated: LibrarySong) => {
    setLibrarySongs((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    setCurrentLibrarySong((current) => current?.id === updated.id ? { ...current, ...updated } : current);
    setVariationSourceSong((current) => current?.id === updated.id ? { ...current, ...updated } : current);
  };

  const handleRenameSong = async (song: LibrarySong, title: string) => {
    if (!user) return;
    setSongError(null);
    try {
      const { song: updated } = await renameLibrarySong(user, song.id, title);
      applyLibrarySongUpdate(updated);
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The song could not be renamed.');
      throw error;
    }
  };

  const prepareShareLink = async (song: LibrarySong) => {
    if (!user || songIsPending(song) || song.status === 'failed') {
      throw new Error('This song cannot be shared yet.');
    }
    await createShareableLink(user, song.id);
  };

  const finishShareMenu = (songId: string, status: 'copied' | 'shared' | 'opened') => {
    setCopyingShareLinkId(`${status}:${songId}`);
    window.setTimeout(() => {
      setCopyingShareLinkId((current) => current?.endsWith(`:${songId}`) ? null : current);
      setShareMenuSongId(null);
      setOpenSongMenuId((current) => current === songId ? null : current);
    }, 1_200);
  };

  const handleShareCopyLink = async (song: LibrarySong) => {
    setSongError(null);
    setCopyingShareLinkId(song.id);
    try {
      await prepareShareLink(song);
      await copyShareableLink(song.id);
      finishShareMenu(song.id, 'copied');
    } catch (error) {
      setCopyingShareLinkId(null);
      setSongError(error instanceof ApiError ? error.message : 'The shareable link could not be copied.');
    }
  };

  const handleShareViaSystem = async (song: LibrarySong) => {
    setSongError(null);
    setCopyingShareLinkId(song.id);
    try {
      await prepareShareLink(song);
      const result = await shareDesiDhunLink(song);
      if (result === 'cancelled') {
        setCopyingShareLinkId(null);
        return;
      }
      finishShareMenu(song.id, result === 'shared' ? 'shared' : 'copied');
    } catch (error) {
      setCopyingShareLinkId(null);
      setSongError(error instanceof ApiError ? error.message : 'The song could not be shared.');
    }
  };

  const handleShareViaWhatsApp = async (song: LibrarySong) => {
    setSongError(null);
    setCopyingShareLinkId(song.id);
    try {
      await prepareShareLink(song);
      window.open(whatsAppShareUrl(song.id, song.title), '_blank', 'noopener,noreferrer');
      finishShareMenu(song.id, 'opened');
    } catch (error) {
      setCopyingShareLinkId(null);
      setSongError(error instanceof ApiError ? error.message : 'WhatsApp sharing could not be opened.');
    }
  };

  const handleShareViaEmail = async (song: LibrarySong) => {
    setSongError(null);
    setCopyingShareLinkId(song.id);
    try {
      await prepareShareLink(song);
      window.location.assign(emailShareUrl(song.id, song.title));
      finishShareMenu(song.id, 'opened');
    } catch (error) {
      setCopyingShareLinkId(null);
      setSongError(error instanceof ApiError ? error.message : 'Email sharing could not be opened.');
    }
  };

  const handleShareWithCommunity = async (song: LibrarySong) => {
    if (!user || songIsPending(song) || song.status === 'failed') return;
    const makingPublic = song.visibility !== 'public';
    const confirmed = window.confirm(
      makingPublic
        ? `Make “${song.title}” public? Other signed-in listeners can play it, and it will appear under Explore Repository.`
        : `Make “${song.title}” private? It will be removed from Explore Repository.`,
    );
    if (!confirmed) return;
    setSongError(null);
    setSharingSongId(song.id);
    setOpenSongMenuId(null);
    try {
      const { song: updated } = await setSongVisibility(user, song.id, makingPublic ? 'public' : 'private');
      applyLibrarySongUpdate(updated);
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The song could not be shared with the community.');
    } finally {
      setSharingSongId(null);
    }
  };

  const handleTogglePreset = async (song: LibrarySong) => {
    if (!user || !isAdmin || songIsPending(song) || song.status === 'failed') return;
    setSongError(null);
    setPresetSongId(song.id);
    setOpenSongMenuId(null);
    try {
      const { song: updated } = await setSongPreset(user, song.id, !song.preset);
      applyLibrarySongUpdate(updated);
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The preset could not be updated.');
    } finally {
      setPresetSongId(null);
    }
  };

  const handleDeleteSong = async (song: LibrarySong) => {
    if (!user) return;
    if (!window.confirm(`Delete “${song.title}” from your song library? This cannot be undone.`)) return;
    setSongError(null);
    setDeletingSongId(song.id);
    try {
      await deleteLibrarySong(user, song.id);
      setLibrarySongs((current) => current.filter((item) => item.id !== song.id));
      setVariationSourceSong((current) => current?.id === song.id ? null : current);
      setOpenSongMenuId((current) => current === song.id ? null : current);
      if (currentLibrarySong?.id === song.id) {
        setCurrentLibrarySong(null);
        setCurrentSongUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      }
    } catch (error) {
      setSongError(error instanceof ApiError ? error.message : 'The song could not be deleted.');
    } finally {
      setDeletingSongId(null);
    }
  };

  const visibleLibrarySongs = useMemo(
    () =>
      librarySongs.filter(
        (song) => (song.rating ?? 0) >= libraryMinRating,
      ),
    [librarySongs, libraryMinRating],
  );

  const applySongFeedback = async (song: LibrarySong, feedback: { rating: number }) => {
    if (!user) return;
    const previous = librarySongs;
    setLibrarySongs((current) =>
      current.map((item) => (item.id === song.id ? { ...item, ...feedback } : item)),
    );
    try {
      await saveSongFeedback(user, song.id, feedback);
    } catch (error) {
      setLibrarySongs(previous);
      setSongError(error instanceof ApiError ? error.message : 'Your rating could not be saved.');
    }
  };

  const handleCheckout = async (offerId: string, provider: PaymentProvider) => {
    if (!user) {
      setAuthError('Sign in with Google before choosing a membership or credit pack.');
      return;
    }
    if (provider === 'payu' && !/^\d{10,15}$/.test(payuPhone.replace(/\D/g, ''))) {
      setComposeError('Enter a valid mobile number, including country code where needed, to pay with PayU.');
      return;
    }
    setComposeError(null);
    setIsBillingBusy(true);
    try {
      const response = await startCheckout(user, offerId, provider, provider === 'payu' ? payuPhone : undefined);
      if (response.provider === 'stripe') {
        window.location.assign(response.url);
        return;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = response.url;
      for (const [name, value] of Object.entries(response.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    } catch (error) {
      setComposeError(error instanceof ApiError ? error.message : 'Checkout could not be opened. Please try again.');
      setIsBillingBusy(false);
    }
  };

  if (!isLoading && !user) {
    return (
      <main className="login-page">
        <div className="login-logo-column">
          <img src="/logo.png" alt="Desi Dhun logo" className="login-logo" />
        </div>
        <section className="login-brand" aria-labelledby="login-title">
          <p className="login-eyebrow">AI RAGA STUDIO</p>
          <h1 id="login-title">
            <span className="hi">देसी धुन</span>
            <span className="en">Desi Dhun</span>
          </h1>
          <p>Raga-aware prompts and AI audio creation</p>
        </section>
        <div className="login-free-offer">
          <p>Create your own songs, music, podcasts, and reels</p>
          <p>Free-tier available</p>
        </div>
        <LoginTopSongs alignBottomTo=".login-action .email-auth-switch" />
        <section className="login-action" aria-label="Sign in">
          <h2>
            <span>FASTEST AND MOST ADVANCED</span>
            <span>AUDIO GENERATION.</span>
          </h2>
          <p>Sign in to create your song.</p>
          {isConfigured ? (
            <>
              <button className="google-button login-google-button" onClick={() => void handleGoogleSignIn()}>
                <span className="google-mark" aria-hidden="true">G</span>
                Continue with Google
              </button>
              <div className="login-divider"><span>or</span></div>
              <form className="email-auth-form" onSubmit={(event) => void handleEmailAuthentication(event)}>
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={emailAuthMode === 'register' ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                  />
                </label>
                {emailAuthMode === 'register' && (
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>
                )}
                <button className="email-auth-submit" type="submit" disabled={isEmailAuthBusy}>
                  {isEmailAuthBusy
                    ? 'Please wait…'
                    : emailAuthMode === 'register'
                      ? 'Create account'
                      : 'Sign in with email'}
                </button>
              </form>
              <button
                className="email-auth-switch"
                onClick={() => {
                  setEmailAuthMode((mode) => mode === 'register' ? 'sign-in' : 'register');
                  setPasswordConfirmation('');
                  setAuthError(null);
                }}
              >
                {emailAuthMode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </button>
            </>
          ) : (
            <p className="account-muted">Google sign-in will be enabled during GCP setup.</p>
          )}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="main">
        {plansOpen && (
          <section className="panel membership-panel" aria-label="Membership plans">
            <div className="panel-title-row membership-heading">
              <div>
                <p className="workflow-step">DESHI DHUN MEMBERSHIP</p>
                <p className="muted">Every account begins with 3 free lifetime prompts. Memberships renew automatically; credit packs never expire.</p>
              </div>
              <span className="billing-country">
                {billingCountry === 'US' ? 'US billing' : billingCountry === 'GB' ? 'UK billing' : billingCountry === 'OTHER' ? 'PayU billing' : 'Checking billing country…'}
              </span>
              <button className="membership-close" onClick={() => setPlansOpen(false)} aria-label="Close membership plans">×</button>
            </div>

            <div className="membership-cadence" role="group" aria-label="Membership billing frequency">
              <button
                className={membershipCadence === 'monthly' ? 'selected' : ''}
                onClick={() => setMembershipCadence('monthly')}
                aria-pressed={membershipCadence === 'monthly'}
              >
                Monthly
              </button>
              <button
                className={membershipCadence === 'yearly' ? 'selected' : ''}
                onClick={() => setMembershipCadence('yearly')}
                aria-pressed={membershipCadence === 'yearly'}
              >
                Yearly
              </button>
            </div>

            {usesPayU && (
              <label className={`payu-phone-field ${payuPhone && !payuPhoneIsValid ? 'invalid' : ''}`}>
                <span>Mobile number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Include country code if outside India"
                  value={payuPhone}
                  onChange={(event) => setPayuPhone(event.target.value)}
                  aria-invalid={payuPhone.length > 0 && !payuPhoneIsValid}
                  required
                />
                <small>{payuPhoneIsValid ? 'Ready for PayU checkout.' : 'Required before you can continue to PayU checkout.'}</small>
              </label>
            )}

            <div className="membership-grid">
              <article className="membership-card free-membership-card">
                <p className="membership-card-label">START HERE</p>
                <h3>Free</h3>
                <p className="membership-price">₹0 <span>forever</span></p>
                <p className="membership-allowance">3 prompts, lifetime total</p>
                <p className="membership-description">A small set of complete prompt explorations to try Desi Dhun.</p>
              </article>
              {MEMBERSHIP_OFFERS.map((offer) => {
                const cadenceOptions = offer.checkoutOptions.filter((option) => option.offerId.endsWith(membershipCadence));
                if (!cadenceOptions.length) return null;
                const selectedPrice = cadenceOptions[0].label.split(' /')[0];
                return (
                  <article key={offer.id} className={`membership-card ${offer.featured ? 'membership-card-featured' : ''}`}>
                    {offer.featured && <span className="membership-badge">BEST VALUE</span>}
                    <p className="membership-card-label">MEMBERSHIP</p>
                    <h3>{offer.name}</h3>
                    <p className="membership-price">{selectedPrice} <span>per {membershipCadence === 'monthly' ? 'month' : 'year'}</span></p>
                    <p className="membership-allowance">{offer.promptAllowance}</p>
                    <p className="membership-allowance">{offer.vocalAllowance}</p>
                    <p className="membership-allowance">{offer.songAllowance[membershipCadence] ?? offer.songAllowance.yearly}</p>
                    <p className="membership-allowance">{offer.downloadAllowance}</p>
                    <p className="membership-description">{offer.description}</p>
                    <p className="membership-fair-use">{offer.fairUse}</p>
                    <div className="membership-checkout-options">
                      {cadenceOptions.map((option) => (
                      <div className="payment-provider-options" key={option.offerId}>
                        {usesPayU ? (
                          <button
                            className="membership-checkout-button"
                            onClick={() => void handleCheckout(option.offerId, 'payu')}
                            disabled={isBillingBusy || !payuPhoneIsValid}
                            title={!payuPhoneIsValid ? 'Enter your mobile number to continue with PayU.' : undefined}
                          >
                            {isBillingBusy ? 'Opening checkout…' : 'Subscribe'}
                          </button>
                        ) : billingCountry === 'US' || billingCountry === 'GB' ? (
                          <button
                            className="membership-checkout-button"
                            onClick={() => void handleCheckout(option.offerId, 'stripe')}
                            disabled={isBillingBusy}
                          >
                            {isBillingBusy ? 'Opening checkout…' : 'Subscribe'}
                          </button>
                        ) : null}
                      </div>
                    ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="credit-pack-row">
              <div>
                <p className="membership-card-label">ONE-TIME CREDITS</p>
                <h3>Need a little more room?</h3>
                <p className="muted">Credit packs never expire and can be used without a membership.</p>
              </div>
              <div className="credit-pack-list">
                {CREDIT_PACKS.map((pack) => (
                  <div className="credit-pack" key={pack.id}>
                    <strong>{pack.name}</strong>
                    <span>{pack.prompts}</span>
                    <span>{pack.vocals}</span>
                    <span>{pack.songs}</span>
                    <em>{pack.price}</em>
                    <button
                      className="credit-pack-button"
                      onClick={() => billingCountry && void handleCheckout(pack.id, usesPayU ? 'payu' : 'stripe')}
                      disabled={isBillingBusy || !billingCountry || (usesPayU && !payuPhoneIsValid)}
                      title={usesPayU && !payuPhoneIsValid ? 'Enter your mobile number to continue with PayU.' : undefined}
                    >
                      {isBillingBusy ? 'Opening…' : billingCountry ? 'Buy' : 'Checking payment options…'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {usesPayU && (
              <p className="payu-merchant-name">
                Payments processed by YSCHOLAR TECHNOLOGY LLP via PayU. Support: <a href="mailto:contact.yscholar@gmail.com">contact.yscholar@gmail.com</a>
              </p>
            )}
          </section>
        )}

        <section className="panel input-panel" id="compose-workspace">
          <div className="lyrics-workspace sliding-workspace">
            <div className="lyrics-editor">
              <div className="lyrics-compose-grid">
                <div className="workflow-main">
                <div className="workspace-intro">
                  <p className={`workflow-step${guideStep === 'kind' ? ' guide-blink' : ''}`}>WHAT DO YOU WANT TO CREATE</p>
                  <div className="composition-kind-buttons" role="group" aria-label="Composition type">
                    {COMPOSITION_KINDS.map((kind) => {
                      const Icon = kind.id === 'songs'
                        ? SongKindIcon
                        : kind.id === 'music'
                          ? MusicKindIcon
                          : kind.id === 'spoken-vocal'
                            ? PodcastKindIcon
                            : DialogueKindIcon;
                      return (
                        <button
                          key={kind.id}
                          type="button"
                          className={`mode-icon-btn${compositionKind === kind.id ? ' active' : ''}`}
                          aria-pressed={compositionKind === kind.id}
                          onClick={() => selectCompositionKind(kind.id)}
                        >
                          <Icon className="mode-icon-btn-glyph" />
                          <span>{kind.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="write-column workflow-panel active">
                  <div className="lyrics-title-row" role="group" aria-label="Lyrics">
                    <div className="composer-heading lyrics-mode-heading">
                      <h2 className={guideStep === 'mode' ? 'guide-blink' : undefined}>Add Lyrics</h2>
                      <div className="lyrics-mode-row">
                        <div className="lyrics-mode-buttons" role="group" aria-label="Choose lyrics mode">
                          <button
                            type="button"
                            className={`mode-icon-btn${lyricsMode === 'generate' ? ' active' : ''}`}
                            aria-pressed={lyricsMode === 'generate'}
                            disabled={!compositionKind}
                            title={!compositionKind ? 'Select Song, Music, Podcast, or Reels first.' : undefined}
                            onClick={() => selectLyricsMode('generate')}
                          >
                            <GenerateLyricsIcon className="mode-icon-btn-glyph" />
                            <span>{isDialogueGenre(compositionGenre) ? 'Generate' : 'AI lyrics'}</span>
                          </button>
                          <button
                            type="button"
                            className={`mode-icon-btn${lyricsMode === 'custom' ? ' active' : ''}`}
                            aria-pressed={lyricsMode === 'custom'}
                            disabled={!compositionKind}
                            title={!compositionKind ? 'Select Song, Music, Podcast, or Reels first.' : undefined}
                            onClick={() => selectLyricsMode('custom')}
                          >
                            <CustomLyricsIcon className="mode-icon-btn-glyph" />
                            <span>{isDialogueGenre(compositionGenre) ? 'Custom text' : 'Custom'}</span>
                          </button>
                          <button
                            type="button"
                            className={`mode-icon-btn${lyricsMode === 'image' ? ' active' : ''}`}
                            aria-pressed={lyricsMode === 'image'}
                            disabled={!compositionKind}
                            title={!compositionKind ? 'Select Song, Music, Podcast, or Reels first.' : undefined}
                            onClick={() => selectLyricsMode('image')}
                          >
                            <ImageLyricsIcon className="mode-icon-btn-glyph" />
                            <span>From image</span>
                          </button>
                          <button
                            type="button"
                            className={`mode-icon-btn${lyricsMode === 'record' ? ' active' : ''}`}
                            aria-pressed={lyricsMode === 'record'}
                            disabled={!compositionKind}
                            title={!compositionKind ? 'Select Song, Music, Podcast, or Reels first.' : undefined}
                            onClick={() => selectLyricsMode('record')}
                          >
                            <RecordLyricsIcon className="mode-icon-btn-glyph" />
                            <span>Record</span>
                          </button>
                          {compositionKind === 'music' && (
                            <button
                              type="button"
                              className={`mode-icon-btn${lyricsMode === 'instrumental' ? ' active' : ''}`}
                              aria-pressed={lyricsMode === 'instrumental'}
                              onClick={() => selectLyricsMode('instrumental')}
                            >
                              <InstrumentalLyricsIcon className="mode-icon-btn-glyph" />
                              <span>Instrumental</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className={`mode-icon-btn${lyricsMode === 'variation' ? ' active' : ''}`}
                            aria-pressed={lyricsMode === 'variation'}
                            disabled={!compositionKind || !variationSourceSong}
                            title={
                              !compositionKind
                                ? 'Select Song, Music, Podcast, or Reels first.'
                                : !variationSourceSong
                                  ? 'Choose a song from your library to vary first.'
                                  : undefined
                            }
                            onClick={() => selectLyricsMode('variation')}
                          >
                            <VariationLyricsIcon className="mode-icon-btn-glyph" />
                            <span>Variation</span>
                          </button>
                        </div>
                        {lyricsMode === 'image' && (
                          <label className="lyrics-image-upload">
                            <span>{lyricsImage ? lyricsImage.name : 'Upload image'}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              onChange={(event) => selectLyricsImage(event.target.files?.[0])}
                            />
                          </label>
                        )}
                        {lyricsMode === 'record' && (
                          <button
                            type="button"
                            className={`record-lyrics-btn${recordingLyrics ? ' recording' : ''}`}
                            onClick={() => void recordLyricsAudio()}
                            disabled={isTranscribingLyrics}
                          >
                            {recordingLyrics ? 'Stop recording' : isTranscribingLyrics ? 'Transcribing…' : 'Record'}
                          </button>
                        )}
                      </div>
                    </div>
                    {lyricsMode === 'variation' && variationSourceSong && (
                      <span className="lyrics-variation-source">Song: {variationSourceSong.title}</span>
                    )}
                    {lyricsMode === 'record' && (recordingLyrics || isTranscribingLyrics || recordedLyricsLanguage) && (
                      <p className="lyrics-record-hint">
                        {recordingLyrics
                          ? 'Listening… sing or speak, then stop. Up to 60 seconds.'
                          : isTranscribingLyrics
                            ? 'Detecting the language and writing the lyrics…'
                            : `Detected ${recordedLyricsLanguage === 'hindi' ? 'Hindi' : 'English'}. You can edit the lyrics below.`}
                      </p>
                    )}
                  </div>
                  <div className={`lyrics-input-wrap${(lyricsMode === 'generate' || lyricsMode === 'image') ? ' has-generate-btn' : ''}${guideStep === 'text' ? ' guide-blink-box' : ''}`}>
                    {showVoiceTags && (
                      <div className="voice-tag-bar" role="group" aria-label="Voice type tags">
                        {VOICE_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            draggable
                            className={`voice-tag-chip voice-tag-${tag.toLowerCase()}`}
                            onDragStart={(event) => {
                              event.dataTransfer.setData('text/plain', `[${tag}]`);
                              event.dataTransfer.setData(VOICE_TAG_MIME, tag);
                              event.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => insertVoiceTagAtCursor(tag)}
                            title={`Drag onto the script (or click) — text after it is spoken by a ${tag.toLowerCase()} voice`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={promptInputRef}
                      className="lyrics-input"
                      value={lyrics}
                      disabled={!lyricsMode}
                      onDrop={(event) => {
                        if (event.dataTransfer.types.includes(VOICE_TAG_MIME)) voiceTagDropped.current = true;
                      }}
                      onChange={(e) => {
                        const dropped = voiceTagDropped.current;
                        voiceTagDropped.current = false;
                        setLyrics(dropped ? normalizeVoiceTags(e.target.value) : e.target.value);
                        setHasComposedPrompt(false);
                        setEnhanceSourceLyrics('');
                        setSelectedStyle('');
                        setSelectedLyrics('');
                      }}
                      placeholder={!compositionKind
                        ? 'Select Song, Music, Podcast, or Reels above first'
                        : !lyricsMode
                        ? 'Choose a lyrics mode above to write here'
                        : lyricsMode === 'generate'
                        ? isDialogueGenre(compositionGenre)
                          ? 'Describe the dialogue or punchline you want written'
                          : 'Write a prompt to generate lyrics using AI'
                        : lyricsMode === 'image'
                          ? 'Add some image description...'
                        : lyricsMode === 'variation'
                          ? 'Add comments to modify this song...'
                        : lyricsMode === 'instrumental'
                          ? 'Describe the instrumental music you want to create'
                          : lyricsMode === 'record'
                            ? isDialogueGenre(compositionGenre)
                              ? 'Record the line, or edit the transcribed dialogue here'
                              : 'Record your voice, or edit the transcribed lyrics here'
                            : isDialogueGenre(compositionGenre)
                              ? 'Paste the dialogue or punchline to perform'
                              : 'Paste your lyrics'}
                      rows={10}
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="lyrics-input-clear-btn"
                      onClick={clearLyrics}
                      disabled={!lyricsMode || !lyrics.trim()}
                      title="Clear lyrics"
                      aria-label="Clear lyrics"
                    >
                      Clear
                    </button>
                    {(lyricsMode === 'generate' || lyricsMode === 'image') && (
                      <>
                        <button
                          type="button"
                          className="generate-lyrics-btn lyrics-input-generate-btn"
                          onClick={() => void handleGenerateLyrics()}
                          disabled={!lyrics.trim() || !user || isGeneratingLyrics}
                          title="Send prompt"
                          aria-label="Send prompt"
                        >
                          ↑
                        </button>
                        {isGeneratingLyrics && (
                          <span className="muted small lyrics-generating-hint">Writing lyrics… this usually takes a few seconds.</span>
                        )}
                      </>
                    )}
                  </div>
                  {isMusicalComposition(compositionKind) && (
                    <div className={`enhance-lyrics-box${hasLyricsContent ? ' ready' : ''}`}>
                      <div className="enhance-lyrics-header">
                        <h2 className={guideStep === 'finish' ? 'guide-blink' : undefined}>Enhance Lyrics</h2>
                        {isComposing && <span className="muted small">Updating…</span>}
                      </div>
                      <div className="enhance-lyrics-options" role="group" aria-label="Enhance lyrics options">
                        <button
                          type="button"
                          className={`enhance-option-btn${includeInstruments ? ' active' : ''}`}
                          aria-pressed={includeInstruments}
                          disabled={!hasLyricsContent || isComposing || !user || !lyricsMode}
                          onClick={() => toggleEnhanceOption('includeInstruments', !includeInstruments)}
                        >
                          Add instruments
                        </button>
                        <button
                          type="button"
                          className={`enhance-option-btn${includeIntro ? ' active' : ''}`}
                          aria-pressed={includeIntro}
                          disabled={!hasLyricsContent || isComposing || !user || !lyricsMode}
                          onClick={() => toggleEnhanceOption('includeIntro', !includeIntro)}
                        >
                          Add intro
                        </button>
                        <button
                          type="button"
                          className={`enhance-option-btn${includeOutro ? ' active' : ''}`}
                          aria-pressed={includeOutro}
                          disabled={!hasLyricsContent || isComposing || !user || !lyricsMode}
                          onClick={() => toggleEnhanceOption('includeOutro', !includeOutro)}
                        >
                          Add outro
                        </button>
                        {compositionKind === 'songs' && (
                          <button
                            type="button"
                            className={`enhance-option-btn${includeSargam ? ' active' : ''}`}
                            aria-pressed={includeSargam}
                            disabled={!hasLyricsContent || isComposing || !user || !lyricsMode}
                            onClick={() => toggleEnhanceOption('includeSargam', !includeSargam)}
                          >
                            Add Sargam when suited
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="composer-controls">
                    <div className="composer-heading">
                      <h2 className={guideStep === 'finish' ? 'guide-blink' : undefined}>Composition</h2>
                    </div>
                    {compositionKind && hasLyricsContent && (
                    <div className="options">
                      <label>
                        Voice
                        <select value={vocal} onChange={(e) => {
                          setVocal(e.target.value as Vocal);
                          if (!isDialogueGenre(compositionGenre)) setVoicePresetId('');
                        }}>
                          <option value="auto">Auto</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="duet">Duet</option>
                          <option value="child">Child</option>
                        </select>
                      </label>
                      <label>
                        Voice style
                        <select
                          value={vocal === 'auto' && !isDialogueGenre(compositionGenre) ? '' : voicePresetId}
                          onChange={(e) => setVoicePresetId(e.target.value)}
                          disabled={vocal === 'auto' && !isDialogueGenre(compositionGenre)}
                        >
                          <option value="">Auto</option>
                          {isDialogueGenre(compositionGenre)
                            ? dialoguePresetsFor(vocal).map((preset) => (
                              <option key={preset.id} value={preset.id}>{preset.label} — {preset.description}</option>
                            ))
                            : vocal !== 'auto' && VOICE_PRESETS[vocal].map((preset) => (
                              <option key={preset.id} value={preset.id}>{preset.label} — {preset.description}</option>
                            ))}
                        </select>
                      </label>
                      {isMusicalComposition(compositionKind) && (
                      <label>
                        Genre
                        <select value={genreOverride} onChange={(e) => {
                          setGenreOverride(e.target.value);
                          setVoicePresetId('');
                          setHasComposedPrompt(false);
                        }}>
                          <option value="auto">Auto-detect</option>
                          {SONG_GENRES.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </label>
                      )}
                      {compositionKind === 'dialogue-punchline' && (
                      <label>
                        Character
                        <select value={dialogueCharacter} onChange={(e) => {
                          setDialogueCharacter(e.target.value as DialogueCharacter);
                          setHasComposedPrompt(false);
                        }}>
                          {DIALOGUE_CHARACTERS.map((character) => (
                            <option key={character.id} value={character.id}>{character.name}</option>
                          ))}
                        </select>
                      </label>
                      )}
                      {compositionKind === 'dialogue-punchline' && (
                      <label>
                        Language
                        <select value={dialogueLanguage} onChange={(e) => {
                          setChosenDialogueLanguage(e.target.value as DialogueLanguage);
                          setHasComposedPrompt(false);
                        }}>
                          {DIALOGUE_LANGUAGES.map((language) => (
                            <option key={language.id} value={language.id}>{language.name}</option>
                          ))}
                        </select>
                      </label>
                      )}
                      {compositionKind === 'spoken-vocal' && (
                      <label>
                        Media Type
                        <select value={spokenMediaType} onChange={(e) => {
                          setSpokenMediaType(e.target.value as SpokenMediaType);
                          setHasComposedPrompt(false);
                        }}>
                          {SPOKEN_MEDIA_TYPES.map((media) => (
                            <option key={media.id} value={media.id}>{media.name}</option>
                          ))}
                        </select>
                      </label>
                      )}
                      <div className={`composition-sliders${!lyricsMode || !hasLyricsContent ? ' inactive' : ''}`}>
                        <label className="composition-slider">
                          <span className="composition-slider-title">Tempo</span>
                          <span className="tempo-slider">
                            <span>Slow</span>
                            <input
                              type="range"
                              min={TEMPO_SPEED_MIN}
                              max={TEMPO_SPEED_MAX}
                              step="1"
                              value={tempoSpeed}
                              disabled={!lyricsMode || !hasLyricsContent}
                              onChange={(event) => setTempoSpeed(clampTempoSpeed(Number(event.target.value)))}
                              aria-label="Tempo from slow to fast"
                            />
                            <span>Fast</span>
                          </span>
                        </label>
                        <label className="composition-slider">
                          <span className="composition-slider-title">Voice pitch</span>
                          <span className="tempo-slider">
                            <span>Low</span>
                            <input
                              type="range"
                              min={VOICE_TONE_MIN}
                              max={VOICE_TONE_MAX}
                              step="1"
                              value={voicePitch}
                              disabled={!lyricsMode || !hasLyricsContent || compositionKind === 'music'}
                              onChange={(event) => setVoicePitch(clampVoiceTone(Number(event.target.value)))}
                              aria-label="Voice pitch from low to high"
                            />
                            <span>High</span>
                          </span>
                        </label>
                        <label className="composition-slider">
                          <span className="composition-slider-title">Pause · {PAUSE_LEVEL_LABELS[pauseLevel]}</span>
                          <span className="tempo-slider">
                            <span>None</span>
                            <input
                              type="range"
                              min={PAUSE_LEVEL_MIN}
                              max={PAUSE_LEVEL_MAX}
                              step="1"
                              value={pauseLevel}
                              disabled={!lyricsMode || !hasLyricsContent || compositionKind === 'music'}
                              onChange={(event) => setPauseLevel(clampPauseLevel(Number(event.target.value)))}
                              aria-label="Pause between sentences from none to long"
                              aria-valuetext={PAUSE_LEVEL_LABELS[pauseLevel]}
                            />
                            <span>Long</span>
                          </span>
                        </label>
                      </div>
                      <div className="record-song-style">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={recordSongStyleEnabled}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              setRecordSongStyleEnabled(enabled);
                              if (!enabled && recordingStyle) styleRecorderRef.current?.stop();
                            }}
                          />
                          Record style
                        </label>
                        {recordSongStyleEnabled && (
                          <>
                            <button type="button" className="record-song-style-btn" onClick={() => void recordSongStyle()} disabled={isAnalyzingRecordedStyle}>
                              {isAnalyzingRecordedStyle ? 'Analyzing recording…' : recordingStyle ? 'Stop recording' : 'Record'}
                            </button>
                            <label className="check recording-permission">
                              <input type="checkbox" checked={recordingConsent} onChange={(e) => setRecordingConsent(e.target.checked)} />
                              I have permission to use this recording
                            </label>
                            {recordedStyleAudioUrl && (
                              <audio className="recorded-style-player" controls src={recordedStyleAudioUrl}>
                                Your browser cannot play this recording.
                              </audio>
                            )}
                            {recordedStyleAnalysis && <p className="recorded-style-summary">{recordedStyleAnalysis}</p>}
                          </>
                        )}
                      </div>
                    </div>
                    )}

                    {compositionKind && (
                      <div className={`edit-style-box${hasLyricsContent ? ' ready' : ''}`}>
                        <div className="edit-style-header">
                          <h2>Edit Style</h2>
                          {styleManuallyEdited && (
                            <button
                              type="button"
                              className="edit-style-reset-btn"
                              onClick={resetEditStyleFromSelections}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <textarea
                          className="edit-style-input"
                          value={editStyle}
                          onChange={(event) => {
                            setStyleManuallyEdited(true);
                            setEditStyle(event.target.value);
                          }}
                          rows={7}
                          spellCheck={false}
                          disabled={!hasLyricsContent}
                          placeholder={hasLyricsContent
                            ? 'Style updates from your lyrics and Composition choices. Edit freely before GENERATE.'
                            : 'Add lyrics to unlock style editing'}
                          aria-label="Edit generation style"
                        />
                      </div>
                    )}

                    {!user && <p className="muted small hint">Sign in with Google to generate a song.</p>}
                    {composeError && <p className="compose-error" role="alert">{composeError}</p>}
                    {songError && <p className="compose-error" role="alert">{songError}</p>}
                  </div>
                  <div className="compose-action-column">
                    <label className="song-name-field compose-song-name">
                      <span>Audio Name</span>
                      <input
                        type="text"
                        value={songName}
                        onChange={(event) => {
                          setSongNameEdited(true);
                          setSongName(event.target.value);
                        }}
                        maxLength={80}
                        placeholder="Name this audio"
                      />
                    </label>
                    <button
                      className={`analyze-btn${guideStep === 'finish' && !isGeneratingSong && !isComposing ? ' guide-blink-button' : ''}`}
                      onClick={() => {
                        setGuideFinished(true);
                        void handleGenerateSong();
                      }}
                      disabled={!lyrics.trim() || !user || isComposing || isGeneratingSong || !lyricsMode || !compositionKind}
                    >
                      {isGeneratingSong || isComposing
                        ? (isComposing ? 'PREPARING…' : `Generating ${compositionKindName(compositionKind)}…`)
                        : 'GENERATE'}
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <aside className="song-studio">
              <div className="song-library-header">
                <h2 className="song-library-title">Song library</h2>
                {librarySongs.length > 0 && (
                  <span className="library-filter-rating">
                    <span className="muted small">Rated</span>
                    <StarRating
                      value={libraryMinRating}
                      onChange={setLibraryMinRating}
                      label="Filter by minimum rating"
                    />
                    {libraryMinRating > 0 && <span className="muted small">&amp; up</span>}
                  </span>
                )}
              </div>
              {songError && <p className="song-status error" role="status">{songError}</p>}
              {librarySongs.length === 0 ? (
                <p className="muted small song-studio-empty">Generated songs will appear here so you can play or download them later.</p>
              ) : (
                <>
                  {visibleLibrarySongs.length === 0 ? (
                    <p className="muted small song-library-empty">No songs match this filter.</p>
                  ) : (
                    <ul className="song-library">
                      {visibleLibrarySongs.map((song) => (
                        <li key={song.id}>
                          <div className="song-library-art">
                            <img className="song-cover-thumb" src={songCoverSrc(song)} alt="" />
                            {songIsPending(song) && (
                              <div className="song-library-generation-overlay" role="status">
                                <span className="song-generation-spinner" aria-hidden="true" />
                                <span>{song.status === 'rendering' ? 'Rendering' : SONG_IMAGE_STATUS_STEPS[songStatusIndex]}</span>
                              </div>
                            )}
                            {song.status !== 'failed' && !songIsPending(song) && (
                              <button
                                type="button"
                                className="song-library-play-overlay"
                                onClick={() => void toggleLibrarySongPlayback(song)}
                                aria-label={
                                  currentLibrarySong?.id === song.id && isLibrarySongPlaying
                                    ? `Pause ${song.title}`
                                    : `Play ${song.title}`
                                }
                              >
                                {currentLibrarySong?.id === song.id && isLibrarySongPlaying ? '⏸' : '▶'}
                              </button>
                            )}
                          </div>
                          <div className="song-library-details">
                            <EditableSongTitle
                              song={song}
                              onRename={(title) => handleRenameSong(song, title)}
                              onToggleVisibility={() => void handleShareWithCommunity(song)}
                              visibilityBusy={sharingSongId === song.id}
                            />
                            <span className="muted small">{formatSongDate(song.createdAt)}</span>
                            {song.status === 'failed' && song.error && (
                              <span className="song-library-error">{displaySongError(song.error)}</span>
                            )}
                            {currentLibrarySong?.id === song.id && currentSongUrl && variationSourceSong?.id !== song.id && (
                              <div className="song-library-progress">
                                <input
                                  type="range"
                                  min="0"
                                  max={libraryPlaybackDuration || 0}
                                  step="0.1"
                                  value={Math.min(libraryPlaybackProgress, libraryPlaybackDuration || 0)}
                                  disabled={!libraryPlaybackDuration}
                                  aria-label={`Seek ${song.title}`}
                                  onChange={(event) => {
                                    const nextTime = Number(event.target.value);
                                    if (libraryAudioRef.current) libraryAudioRef.current.currentTime = nextTime;
                                    setLibraryPlaybackProgress(nextTime);
                                  }}
                                />
                                <span>{formatPlaybackTime(libraryPlaybackProgress)} / {formatPlaybackTime(libraryPlaybackDuration)}</span>
                              </div>
                            )}
                          </div>
                          <div className="song-library-actions">
                            {song.status !== 'failed' && !songIsPending(song) && (
                              <div className="song-library-rating">
                                <StarRating
                                  value={song.rating ?? 0}
                                  onChange={(rating) => void applySongFeedback(song, { rating })}
                                  label={`Rate ${song.title}`}
                                />
                              </div>
                            )}
                            <div className="song-menu">
                              <button
                                type="button"
                                className="song-menu-trigger"
                                onClick={(event) => {
                                  const closing = openSongMenuId === song.id;
                                  if (closing) {
                                    setOpenSongMenuId(null);
                                    setSongMenuAnchor(null);
                                  } else {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    setSongMenuAnchor({
                                      top: rect.bottom + 6,
                                      right: Math.max(8, window.innerWidth - rect.right),
                                    });
                                    setOpenSongMenuId(song.id);
                                  }
                                  setShareMenuSongId(null);
                                }}
                                aria-label={`Options for ${song.title}`}
                                aria-expanded={openSongMenuId === song.id}
                              >
                                •••
                              </button>
                              {openSongMenuId === song.id && songMenuAnchor && (
                                <div
                                  className="song-menu-options"
                                  style={{ top: songMenuAnchor.top, right: songMenuAnchor.right }}
                                >
                                  {song.status !== 'failed' && !songIsPending(song) && (
                                    <>
                                      <div className="song-share-menu">
                                        <button
                                          type="button"
                                          onClick={() => setShareMenuSongId((current) => current === song.id ? null : song.id)}
                                          disabled={copyingShareLinkId === song.id}
                                          aria-expanded={shareMenuSongId === song.id}
                                        >
                                          {copyingShareLinkId === song.id
                                            ? 'Preparing…'
                                            : copyingShareLinkId === `copied:${song.id}`
                                              ? 'Link copied'
                                              : copyingShareLinkId === `shared:${song.id}`
                                                ? 'Shared'
                                                : copyingShareLinkId === `opened:${song.id}`
                                                  ? 'Opened'
                                                  : 'Share'}
                                        </button>
                                        {shareMenuSongId === song.id && (
                                          <div className="song-share-options" role="menu">
                                            <button type="button" role="menuitem" onClick={() => void handleShareCopyLink(song)}>
                                              Copy shareable link
                                            </button>
                                            <button type="button" role="menuitem" onClick={() => void handleShareViaWhatsApp(song)}>
                                              WhatsApp
                                            </button>
                                            <button type="button" role="menuitem" onClick={() => void handleShareViaEmail(song)}>
                                              Email
                                            </button>
                                            {canUseSystemShare() && (
                                              <button type="button" role="menuitem" onClick={() => void handleShareViaSystem(song)}>
                                                More apps…
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className={`variation-select-btn${variationSourceSong?.id === song.id ? ' selected' : ''}`}
                                        onClick={() => startSongVariation(song)}
                                      >
                                        {variationSourceSong?.id === song.id ? 'Variation selected' : 'Create variation'}
                                      </button>
                                      <button type="button" onClick={() => void downloadLibrarySong(song, 'mp3')} disabled={downloadingSongId === song.id}>
                                        {downloadingSongId === song.id ? 'Preparing download…' : 'Download MP3'}
                                      </button>
                                      <button type="button" onClick={() => void downloadLibrarySong(song, 'wav')} disabled={downloadingSongId === song.id}>
                                        {downloadingSongId === song.id ? 'Preparing download…' : 'Download WAV'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setYoutubeUploadSong(song);
                                          setOpenSongMenuId(null);
                                        }}
                                      >
                                        Upload to YouTube
                                      </button>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          className={`song-preset-btn${song.preset ? ' selected' : ''}`}
                                          onClick={() => void handleTogglePreset(song)}
                                          disabled={presetSongId === song.id}
                                        >
                                          {presetSongId === song.id
                                            ? 'Updating…'
                                            : song.preset ? 'Remove from Presets' : 'Mark as Preset'}
                                        </button>
                                      )}
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="song-delete-btn"
                                    onClick={() => void handleDeleteSong(song)}
                                    disabled={deletingSongId === song.id}
                                  >
                                    {deletingSongId === song.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </aside>
          </div>
        </section>

      </main>

      <audio
        ref={libraryAudioRef}
        className="song-library-audio-engine"
        onPlay={() => setIsLibrarySongPlaying(true)}
        onPause={() => setIsLibrarySongPlaying(false)}
        onEnded={() => setIsLibrarySongPlaying(false)}
        onLoadedMetadata={(event) => setLibraryPlaybackDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setLibraryPlaybackProgress(event.currentTarget.currentTime)}
      >
        Your browser cannot play this song.
      </audio>

      {youtubeUploadSong && user && (
        <YouTubeUploadDialog song={youtubeUploadSong} user={user} onClose={() => setYoutubeUploadSong(null)} />
      )}
    </>
  );
}
