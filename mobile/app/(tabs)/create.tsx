import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { NowPlayingBar } from '@/components/NowPlayingBar';
import {
  Banner,
  Button,
  Caption,
  Card,
  ChipRow,
  Heading,
  Input,
  Section,
  SliderRow,
  SwitchRow,
  Title,
  styles,
} from '@/components/ui';
import {
  errorMessage,
  generateCustomLyrics,
  generateLyricsFromImage,
  generateSongPrompt,
  listLibrarySongs,
  prepareSong,
  songIsPending,
  type LibrarySong,
  type LyricsLanguage,
} from '@/lib/api';
import {
  INSTRUMENTAL_LYRICS,
  buildAnalysisOptions,
  buildStyle,
  resolveVocal,
  type CompositionState,
} from '@/lib/composeStyle';
import { colors, spacing } from '@/theme';
import { COMPOSITION_KINDS, SONG_GENRES, isDialogueGenre, isSpeechGenre, type CompositionKind } from '@shared/data/genres';
import {
  DIALOGUE_CHARACTERS,
  DIALOGUE_LANGUAGES,
  SPOKEN_MEDIA_TYPES,
  dialogueCharacterById,
  dialogueLanguageById,
  spokenMediaById,
} from '@shared/data/speechOptions';
import { DEFAULT_TEMPO_SPEED, TEMPO_SPEED_MAX, TEMPO_SPEED_MIN, tempoBand } from '@shared/data/tempo';
import { DIALOGUE_VOICE_PRESETS, VOICE_PRESETS, dialoguePresetsFor } from '@shared/data/voicePresets';
import {
  DEFAULT_PAUSE_LEVEL,
  DEFAULT_VOICE_TONE,
  PAUSE_LEVEL_LABELS,
  PAUSE_LEVEL_MAX,
  PAUSE_LEVEL_MIN,
  VOICE_TONE_MAX,
  VOICE_TONE_MIN,
  voicePitchPromptLine,
} from '@shared/data/voiceTone';
import { songNameFromLyrics } from '@shared/lib/songName';
import type { DialogueCharacter, DialogueLanguage, SpokenMediaType, Vocal } from '@shared/types';

type LyricsMode = 'custom' | 'generate' | 'image' | 'instrumental';

const VOCALS: readonly { id: Vocal; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'female', name: 'Female' },
  { id: 'male', name: 'Male' },
  { id: 'duet', name: 'Duet' },
  { id: 'child', name: 'Child' },
];

const LYRICS_LANGUAGES: readonly { id: LyricsLanguage; name: string }[] = [
  { id: 'hindi', name: 'Hindi' },
  { id: 'english', name: 'English' },
  { id: 'other', name: 'Other' },
];

const STATUS_STEPS = ['Preparing your song…', 'Composing vocals and music…', 'Mixing the final take…'];

function genreForKind(kind: CompositionKind, songGenre: string): string {
  if (kind === 'spoken-vocal' || kind === 'dialogue-punchline') return kind;
  if (kind === 'music') return songGenre;
  return songGenre;
}

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [kind, setKind] = useState<CompositionKind>('songs');
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>('custom');
  const [lyrics, setLyrics] = useState('');
  const [songName, setSongName] = useState('');
  const [lyricsLanguage, setLyricsLanguage] = useState<LyricsLanguage>('hindi');
  const [image, setImage] = useState<{ data: string; mimeType: 'image/jpeg' | 'image/png' } | null>(null);

  const [songGenre, setSongGenre] = useState<string>('auto');
  const [vocal, setVocal] = useState<Vocal>('auto');
  const [voicePresetId, setVoicePresetId] = useState('');
  const [tempoSpeed, setTempoSpeed] = useState(DEFAULT_TEMPO_SPEED);
  const [voicePitch, setVoicePitch] = useState(DEFAULT_VOICE_TONE);
  const [pauseLevel, setPauseLevel] = useState(DEFAULT_PAUSE_LEVEL);
  const [dialogueCharacter, setDialogueCharacter] = useState<DialogueCharacter>('hero');
  const [dialogueLanguage, setDialogueLanguage] = useState<DialogueLanguage>('hindi');
  const [spokenMediaType, setSpokenMediaType] = useState<SpokenMediaType>('news');
  const [includeBackgroundMusic, setIncludeBackgroundMusic] = useState(false);
  const [includeInstruments, setIncludeInstruments] = useState(true);
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeOutro, setIncludeOutro] = useState(false);
  const [includeSargam, setIncludeSargam] = useState(false);

  const [showOptions, setShowOptions] = useState(false);
  const [busyLyrics, setBusyLyrics] = useState(false);
  const [busySong, setBusySong] = useState(false);
  const [statusStep, setStatusStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<LibrarySong | null>(null);

  const genre = genreForKind(kind, songGenre);
  const speech = isSpeechGenre(genre);
  const dialogue = isDialogueGenre(genre);

  const state = useMemo<CompositionState>(
    () => ({
      genre,
      vocal,
      voicePresetId,
      tempoSpeed,
      voicePitch,
      pauseLevel,
      dialogueCharacter,
      dialogueLanguage,
      spokenMediaType,
      includeBackgroundMusic,
      includeInstruments,
      includeIntro,
      includeOutro,
      includeSargam,
    }),
    [
      genre,
      vocal,
      voicePresetId,
      tempoSpeed,
      voicePitch,
      pauseLevel,
      dialogueCharacter,
      dialogueLanguage,
      spokenMediaType,
      includeBackgroundMusic,
      includeInstruments,
      includeIntro,
      includeOutro,
      includeSargam,
    ],
  );

  useEffect(() => {
    setVoicePresetId('');
  }, [vocal, kind]);

  useEffect(() => {
    if (kind === 'music') setLyricsMode('instrumental');
    else if (lyricsMode === 'instrumental') setLyricsMode('custom');
    // Only react to the composition kind; the lyric mode is the user's choice otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (!busySong) {
      setStatusStep(0);
      return;
    }
    const timer = setInterval(() => setStatusStep((current) => (current + 1) % STATUS_STEPS.length), 7_000);
    return () => clearInterval(timer);
  }, [busySong]);

  // Renders happen on the server, so the pending song is polled until it settles.
  useEffect(() => {
    if (!user || !pending || !songIsPending(pending)) return;
    let cancelled = false;
    const poll = setInterval(() => {
      void listLibrarySongs(user)
        .then(({ songs }) => {
          if (cancelled) return;
          const updated = songs.find((song) => song.id === pending.id);
          if (!updated) return;
          setPending(updated);
          if (!songIsPending(updated)) {
            setBusySong(false);
            if (updated.status === 'failed') setError(updated.error ?? 'The song could not be generated.');
            else setNotice('Your song is ready. Open it in the Library tab.');
          }
        })
        .catch(() => undefined);
    }, 2_500);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [user, pending]);

  const voicePresets = dialogue
    ? dialoguePresetsFor(vocal)
    : vocal === 'auto'
      ? []
      : VOICE_PRESETS[vocal];

  const pickImage = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to write lyrics from a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setImage({
      data: asset.base64!,
      mimeType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
    });
    setLyricsMode('image');
  }, []);

  const generateLyrics = async () => {
    if (!user) return;
    setError(null);
    setNotice(null);
    const media = spokenMediaById(spokenMediaType);
    const prompt = [
      lyrics.trim(),
      dialogue ? `Character: ${dialogueCharacterById(dialogueCharacter).name}. Write the line in that character's voice.` : '',
      dialogue ? `Language: ${dialogueLanguageById(dialogueLanguage).name}. ${dialogueLanguageById(dialogueLanguage).writing}` : '',
      vocal === 'duet' && kind !== 'music'
        ? `Write it for two voices. Put [Male] or [Female] (or [Child] if a child ${kind === 'songs' ? 'sings' : 'speaks'}) on its own line before each voice's lines. Do not write speaker names.`
        : '',
      kind === 'spoken-vocal' ? `Media type: ${media.name}. Write a spoken ${media.name} script.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (!prompt) {
      setError(dialogue ? 'Describe the dialogue or punchline you want.' : 'Describe the lyrics you want.');
      return;
    }
    if (lyricsMode === 'image' && !image) {
      setError('Choose a picture before generating lyrics from it.');
      return;
    }

    const lyricsKind = dialogue ? 'dialogue' : kind === 'spoken-vocal' ? 'spoken' : 'song';
    setBusyLyrics(true);
    try {
      const response =
        lyricsMode === 'image' && image
          ? await generateLyricsFromImage(user, prompt, image.data, image.mimeType, lyricsKind)
          : await generateCustomLyrics(user, prompt, lyricsKind === 'dialogue' ? 'other' : lyricsLanguage, lyricsKind);
      setLyrics(response.lyrics);
      setLyricsMode('custom');
      setImage(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Lyrics could not be generated. Please try again.'));
    } finally {
      setBusyLyrics(false);
    }
  };

  const createSong = async () => {
    if (!user) return;
    setError(null);
    setNotice(null);
    const source = lyrics.trim();
    if (lyricsMode !== 'instrumental' && !source) {
      setError(speech ? 'Write the script you want spoken.' : 'Write or generate the lyrics first.');
      return;
    }
    if (lyricsMode === 'instrumental' && !source) {
      setError('Describe the instrumental you want.');
      return;
    }

    setBusySong(true);
    setPending(null);
    try {
      let songLyrics = source;
      let baseStyle = source;
      let analysedVocal: 'female' | 'male' | 'duet' | 'child' | undefined;
      let title = songNameFromLyrics(source) || 'Untitled';

      if (lyricsMode === 'instrumental') {
        songLyrics = INSTRUMENTAL_LYRICS;
        title = 'Instrumental';
      } else {
        const { result } = await generateSongPrompt(user, source, buildAnalysisOptions(state));
        analysedVocal = result.vocal;
        baseStyle = result.prompts[0]?.prompt ?? '';
        // Dialogue and podcast scripts must be spoken exactly as written.
        songLyrics = speech ? source : result.arrangement.instrumentedLyrics;
        title = songNameFromLyrics(source) || result.songTitle;
      }

      const style = buildStyle(state, baseStyle, resolveVocal(state, analysedVocal));
      const { song } = await prepareSong(
        user,
        style,
        songLyrics,
        songName.trim() || title,
        speech ? 'chirp-3-hd' : 'lyria',
      );
      setPending(song);
    } catch (cause) {
      setBusySong(false);
      setError(errorMessage(cause, 'The song could not be generated. Please try again.'));
    }
  };

  const lyricsLabel = speech ? 'Script' : kind === 'music' ? 'Describe the music' : 'Lyrics';
  const lyricsPlaceholder =
    lyricsMode === 'generate'
      ? 'Describe what the song should be about…'
      : lyricsMode === 'instrumental'
        ? 'A calm santoor and tabla piece for a rainy evening…'
        : speech
          ? 'Type the exact words to be spoken…'
          : 'Paste or write your lyrics…';

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Title>Create</Title>

          {error ? <Banner tone="error" message={error} /> : null}
          {notice ? <Banner tone="success" message={notice} /> : null}

          <Section label="What are you making?">
            <ChipRow options={COMPOSITION_KINDS} value={kind} onChange={setKind} />
          </Section>

          {kind !== 'music' ? (
            <Section label="Words">
              <ChipRow
                options={[
                  { id: 'custom', name: 'Write my own' },
                  { id: 'generate', name: 'Generate with AI' },
                  { id: 'image', name: 'From a picture' },
                ] as const}
                value={lyricsMode === 'instrumental' ? 'custom' : lyricsMode}
                onChange={(next) => setLyricsMode(next)}
              />
            </Section>
          ) : null}

          <Card>
            <Heading>{lyricsLabel}</Heading>
            <Input
              multiline
              value={lyrics}
              onChangeText={setLyrics}
              placeholder={lyricsPlaceholder}
              autoCapitalize="sentences"
            />
            {lyricsMode === 'generate' || lyricsMode === 'image' ? (
              <>
                {!dialogue ? (
                  <Section label="Language">
                    <ChipRow options={LYRICS_LANGUAGES} value={lyricsLanguage} onChange={setLyricsLanguage} />
                  </Section>
                ) : null}
                {lyricsMode === 'image' ? (
                  <Button
                    label={image ? 'Picture selected — choose another' : 'Choose a picture'}
                    variant="secondary"
                    icon="image"
                    onPress={() => void pickImage()}
                  />
                ) : null}
                <Button
                  label={dialogue ? 'Generate dialogue' : 'Generate lyrics'}
                  variant="secondary"
                  icon="sparkles"
                  busy={busyLyrics}
                  onPress={() => void generateLyrics()}
                />
              </>
            ) : null}
            <Input value={songName} onChangeText={setSongName} placeholder="Title (optional)" maxLength={80} />
          </Card>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowOptions((open) => !open)}
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          >
            <View>
              <Heading>Sound options</Heading>
              <Caption>
                {dialogue
                  ? `${dialogueLanguageById(dialogueLanguage).name} · ${dialogueCharacterById(dialogueCharacter).name}`
                  : kind === 'spoken-vocal'
                    ? spokenMediaById(spokenMediaType).name
                    : `${songGenre === 'auto' ? 'Auto genre' : SONG_GENRES.find((item) => item.id === songGenre)?.name ?? 'Auto genre'} · ${tempoBand(tempoSpeed)} tempo`}
              </Caption>
            </View>
            <Ionicons name={showOptions ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>

          {showOptions ? (
            <Card>
              {dialogue ? (
                <>
                  <Section label="Language">
                    <ChipRow
                      options={DIALOGUE_LANGUAGES.map((item) => ({ id: item.id, name: item.name }))}
                      value={dialogueLanguage}
                      onChange={setDialogueLanguage}
                    />
                  </Section>
                  <Section label="Character">
                    <ChipRow options={DIALOGUE_CHARACTERS} value={dialogueCharacter} onChange={setDialogueCharacter} />
                  </Section>
                </>
              ) : null}

              {kind === 'spoken-vocal' ? (
                <Section label="Media type">
                  <ChipRow options={SPOKEN_MEDIA_TYPES} value={spokenMediaType} onChange={setSpokenMediaType} />
                </Section>
              ) : null}

              {!speech ? (
                <Section label="Genre">
                  <ChipRow
                    options={[{ id: 'auto', name: 'Auto' }, ...SONG_GENRES.map((item) => ({ id: item.id, name: item.name }))]}
                    value={songGenre}
                    onChange={setSongGenre}
                  />
                </Section>
              ) : null}

              <Section label="Voice">
                <ChipRow options={VOCALS} value={vocal} onChange={setVocal} />
              </Section>

              {voicePresets.length > 0 ? (
                <Section label="Voice character">
                  <ChipRow
                    options={[
                      { id: '', name: 'Default' },
                      ...voicePresets.map((preset) => ({ id: preset.id, name: preset.label })),
                    ]}
                    value={voicePresetId}
                    onChange={setVoicePresetId}
                  />
                </Section>
              ) : null}

              <SliderRow
                label="Tempo"
                value={tempoSpeed}
                min={TEMPO_SPEED_MIN}
                max={TEMPO_SPEED_MAX}
                onChange={setTempoSpeed}
                hint={`${tempoBand(tempoSpeed)} (${tempoSpeed}/10)`}
              />
              <SliderRow
                label="Voice tone"
                value={voicePitch}
                min={VOICE_TONE_MIN}
                max={VOICE_TONE_MAX}
                onChange={setVoicePitch}
                hint={voicePitchPromptLine(voicePitch)}
              />
              <SliderRow
                label="Pauses"
                value={pauseLevel}
                min={PAUSE_LEVEL_MIN}
                max={PAUSE_LEVEL_MAX}
                onChange={setPauseLevel}
                hint={PAUSE_LEVEL_LABELS[pauseLevel]}
              />

              {speech ? (
                <SwitchRow
                  label="Background music"
                  value={includeBackgroundMusic}
                  onValueChange={setIncludeBackgroundMusic}
                  hint="A soft bed under the voice."
                />
              ) : (
                <>
                  <SwitchRow label="Instruments" value={includeInstruments} onValueChange={setIncludeInstruments} />
                  <SwitchRow label="Intro / alap" value={includeIntro} onValueChange={setIncludeIntro} />
                  <SwitchRow label="Outro" value={includeOutro} onValueChange={setIncludeOutro} />
                  <SwitchRow label="Sargam interlude" value={includeSargam} onValueChange={setIncludeSargam} />
                </>
              )}
            </Card>
          ) : null}

          <Button
            label={busySong ? STATUS_STEPS[statusStep] : speech ? 'Create audio' : 'Create song'}
            icon="musical-note"
            busy={busySong}
            onPress={() => void createSong()}
          />

          {pending && !songIsPending(pending) && pending.status === 'ready' ? (
            <Button
              label="Open in Library"
              variant="secondary"
              icon="albums"
              onPress={() => router.push(`/song/${pending.id}`)}
            />
          ) : null}

          <Text style={{ ...styles.caption, textAlign: 'center' }}>
            Every track is original. Do not imitate a real person or copy an existing song.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <NowPlayingBar />
    </View>
  );
}
