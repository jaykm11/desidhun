import { GoogleAuth } from 'google-auth-library';
import { transcribeGeneratedSpeech } from './gemini';
import { DIALOGUE_LANGUAGES, type DialogueLanguageOption } from '../../web/src/data/speechOptions';
import { clampTempoSpeed, tempoBand, tempoSpeakingRate } from '../../web/src/data/tempo';
import {
  clampPauseLevel,
  clampVoiceTone,
  pauseMarkupTag,
  voiceBassPromptLine,
  voicePitchPromptLine,
  voicePitchSemitones,
} from '../../web/src/data/voiceTone';

const TEXT_TO_SPEECH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const CHIRP_VOICE_SUFFIX = 'Aoede';
const MAX_CHIRP_SENTENCE_LENGTH = 48;
const GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-pro-tts',
];

const DIALOGUE_PROMPT = `You are a voice actor performing a fixed script.
Speak ONLY the exact words in the input text.
Do not translate, paraphrase, invent, expand, or replace any words.
Do not switch language. If the script is English, speak English. If it is Hindi, speak Hindi.
Act the line with emotion, bite, and a landing on the last words — but keep every word identical to the script.
Do not sound like an audiobook or news reader.
Do not imitate any real celebrity, actor, actress, or copyrighted performance.`;

const STRICT_SCRIPT_RULE = 'STRICT: Speak only the input text, word for word, once. Do not add greetings, intros, outros, reactions, extra sentences, or repeats. Stop as soon as the text ends.';

type DialogueTempo = 'slow' | 'medium' | 'fast';
type DialogueCharacter = 'hero' | 'villain' | 'comedian';
type SpokenMediaType = 'news' | 'documentary' | 'youtube-reels' | 'podcast';

const DIALOGUE_CHARACTER_PROMPT: Record<DialogueCharacter, string> = {
  hero: 'Delivery character is the Hero: commanding and righteous. Keep the script wording unchanged.',
  villain: 'Delivery character is the Villain: quiet threat with a sting on the last phrase. Keep the script wording unchanged.',
  comedian: 'Delivery character is the Comedian: light setup, sharp landing. Keep the script wording unchanged.',
};

const SPOKEN_MEDIA_PACE: Record<SpokenMediaType, { speakingRate: number; prompt: string }> = {
  news: {
    speakingRate: 1.05,
    prompt: 'Deliver this as a broadcast news report: clear, neutral, and authoritative. Do not sing. Do not act like a film character.',
  },
  documentary: {
    speakingRate: 0.94,
    prompt: 'Deliver this as documentary narration: calm, thoughtful, and explanatory. Do not sing.',
  },
  'youtube-reels': {
    speakingRate: 1.24,
    prompt: 'Deliver this as a YouTube Reels voiceover: high energy, hooky, and short-form. Do not sing.',
  },
  podcast: {
    speakingRate: 1.06,
    prompt: 'Deliver this as a podcast host: conversational, intimate, talking to one listener. Do not sing.',
  },
};

const DIALOGUE_PACE: Record<DialogueTempo, { speakingRate: number; prompt: string }> = {
  slow: {
    speakingRate: 0.88,
    prompt: 'Pacing is Slow / Vilambit: measured, spacious, and unhurried. Hold weight on key words.',
  },
  medium: {
    speakingRate: 1.08,
    prompt: 'Pacing is Medium / Madhya: natural conversational film-dialogue speed. Do not drag.',
  },
  fast: {
    speakingRate: 1.32,
    prompt: 'Pacing is Fast / Drut: quick, clipped, high-energy delivery. Speak faster than conversation. Keep pauses tiny or skip them. Do not linger, drawl, or stretch words.',
  },
};

function tempoSpeedFromStyle(style: string): number | undefined {
  const match = style.match(/TEMPO_SPEED=(\d+)/);
  return match ? clampTempoSpeed(Number(match[1])) : undefined;
}

function tempoFromStyle(style: string): DialogueTempo {
  const speed = tempoSpeedFromStyle(style);
  if (speed) return tempoBand(speed);
  const match = style.match(/DIALOGUE_TEMPO=(slow|medium|fast)/);
  return match?.[1] as DialogueTempo ?? 'medium';
}

function speakingRateFromStyle(style: string, fallback: number): number {
  const speed = tempoSpeedFromStyle(style);
  return speed ? tempoSpeakingRate(speed) : fallback;
}

function voicePitchFromStyle(style: string): number | undefined {
  const match = style.match(/VOICE_PITCH=(\d+)/);
  return match ? voicePitchSemitones(Number(match[1])) : undefined;
}

function voiceToneFromStyle(style: string): string {
  const pitchMatch = style.match(/VOICE_PITCH=(\d+)/);
  const bassMatch = style.match(/VOICE_BASS=(\d+)/);
  if (!pitchMatch && !bassMatch) return '';
  const pitchLine = voicePitchPromptLine(clampVoiceTone(pitchMatch ? Number(pitchMatch[1]) : 5));
  return bassMatch ? `${pitchLine}; ${voiceBassPromptLine(clampVoiceTone(Number(bassMatch[1])))}` : pitchLine;
}

function pauseLevelFromStyle(style: string): number {
  const match = style.match(/PAUSE_LEVEL=(\d+)/);
  return match ? clampPauseLevel(Number(match[1])) : 0;
}

/** Chirp 3 HD rejects `pitch` ("This voice does not support pitch parameters"). */
function audioConfigFromStyle(
  style: string,
  speakingRate?: number,
  engine: 'gemini' | 'chirp' = 'gemini',
): { audioEncoding: 'MP3'; speakingRate?: number; pitch?: number } {
  const basePitch = voicePitchFromStyle(style) ?? 0;
  const pitch = engine === 'chirp'
    ? undefined
    : vocalFromStyle(style) === 'child' ? Math.min(basePitch + 4, 20) : basePitch;
  return {
    audioEncoding: 'MP3',
    ...(speakingRate == null ? {} : { speakingRate }),
    ...(pitch == null || pitch === 0 ? {} : { pitch }),
  };
}

interface SynthesizeResponse {
  audioContent?: string;
  error?: { message?: string };
}

function projectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'desidhun';
}

function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/u.test(text);
}

function languageCodeFor(text: string): string {
  return containsDevanagari(text) ? 'hi-IN' : 'en-IN';
}

function dialogueLanguageFromStyle(style: string): DialogueLanguageOption | undefined {
  const id = style.match(/DIALOGUE_LANGUAGE=([a-z-]+)/)?.[1];
  return DIALOGUE_LANGUAGES.find((language) => language.id === id);
}

function chirpVoiceFor(text: string, speaker?: string, localeOverride?: string): { languageCode: string; name: string } {
  const languageCode = localeOverride ?? languageCodeFor(text);
  const suffix = speaker && /^[A-Za-z]+$/.test(speaker) ? speaker : CHIRP_VOICE_SUFFIX;
  return {
    languageCode,
    name: `${languageCode}-Chirp3-HD-${suffix}`,
  };
}

function speakerFromStyle(style: string): string | undefined {
  return style.match(/(?:DIALOGUE_SPEAKER|SPOKEN_SPEAKER)=([A-Za-z]+)/)?.[1];
}

function vocalFromStyle(style: string): 'female' | 'male' | 'duet' | 'child' | undefined {
  const match = style.match(/(?:DIALOGUE_VOCAL|SPOKEN_VOCAL)=(female|male|duet|child)/);
  return match?.[1] as 'female' | 'male' | 'duet' | 'child' | undefined;
}

function defaultSpeakerFor(style: string, text: string): string {
  const vocal = vocalFromStyle(style);
  if (vocal === 'child') return 'Leda';
  if (vocal === 'female') return 'Kore';
  if (vocal === 'duet') return 'Aoede';
  if (vocal === 'male') return containsDevanagari(text) ? 'Fenrir' : 'Puck';
  return containsDevanagari(text) ? 'Fenrir' : 'Puck';
}

function genderDirection(style: string): string {
  const vocal = vocalFromStyle(style);
  if (vocal === 'female') return 'The speaking voice must be clearly female.';
  if (vocal === 'male') return 'The speaking voice must be clearly male.';
  if (vocal === 'duet') return 'Use a blended two-person spoken delivery.';
  if (vocal === 'child') return 'The speaking voice must sound like a young child of about eight: high, light, innocent, and playful.';
  return '';
}

function isDialogueRequest(style: string): boolean {
  return style.includes('DIALOGUE_PUNCHLINE_DELIVERY');
}

function characterFromStyle(style: string): DialogueCharacter {
  const match = style.match(/DIALOGUE_CHARACTER=(hero|villain|comedian)/);
  return (match?.[1] as DialogueCharacter) ?? 'hero';
}

function mediaFromStyle(style: string): SpokenMediaType | undefined {
  const match = style.match(/SPOKEN_MEDIA=(news|documentary|youtube-reels|podcast)/);
  return match?.[1] as SpokenMediaType | undefined;
}

/**
 * Chirp 3 HD rejects unusually long or punctuation-free sentences. Preserve
 * existing line breaks and add natural sentence breaks without truncating lyrics.
 */
function prepareChirpText(text: string): string {
  return chirpSentences(text).join(' ');
}

function chirpSentences(text: string): string[] {
  const sentenceEnding = containsDevanagari(text) ? '।' : /[\u4E00-\u9FFF]/u.test(text) ? '。' : '.';
  const chunks: string[] = [];

  for (const rawLine of text
    .replace(/[\u{1D100}-\u{1D1FF}]/gu, ' ')
    .replace(/\t/g, ' ')
    .split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || /^\[.*\]$/u.test(line)) continue;

    let remaining = line;
    while (remaining.length > MAX_CHIRP_SENTENCE_LENGTH) {
      const candidate = remaining.slice(0, MAX_CHIRP_SENTENCE_LENGTH + 1);
      const breakAt = Math.max(
        candidate.lastIndexOf('।'),
        candidate.lastIndexOf('。'),
        candidate.lastIndexOf('！'),
        candidate.lastIndexOf('？'),
        candidate.lastIndexOf('，'),
        candidate.lastIndexOf('.'),
        candidate.lastIndexOf('!'),
        candidate.lastIndexOf('?'),
        candidate.lastIndexOf(','),
        candidate.lastIndexOf(';'),
        candidate.lastIndexOf(' '),
      );
      const splitAt = breakAt > 0 ? breakAt + 1 : MAX_CHIRP_SENTENCE_LENGTH;
      const chunk = remaining.slice(0, splitAt).trim().replace(/[,;，]$/u, sentenceEnding);
      chunks.push(/[.!?।。！？]$/u.test(chunk) ? chunk : `${chunk}${sentenceEnding}`);
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) {
      chunks.push(/[.!?।。！？]$/u.test(remaining) ? remaining : `${remaining}${sentenceEnding}`);
    }
  }

  // Break chunks further at sentence endings so pauses land between sentences, not just lines.
  return chunks.flatMap((chunk) => chunk.split(/(?<=[.!?।])\s+|(?<=[。！？])/u)).filter(Boolean);
}

/** Chirp 3 HD markup with a pause tag between every sentence. */
function markupWithPauses(sentences: string[], level: number): string {
  const tag = pauseMarkupTag(level);
  const safe = sentences.map((sentence) => sentence.replace(/[[\]]/g, ''));
  return tag ? safe.join(` ${tag} `) : safe.join(' ');
}

function prepareDialogueText(text: string): string {
  return text
    .replace(/[\u{1D100}-\u{1D1FF}]/gu, ' ')
    .split(/\r?\n/u)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^\[.*\]$/u.test(line))
    .join('\n')
    .trim();
}

/** Chirp 3 HD markup pauses so the last line lands like a punchline. */
function prepareDialogueMarkup(
  text: string,
  tempo: DialogueTempo,
  pauseLevel = 0,
  language?: DialogueLanguageOption,
): string {
  if (pauseLevel > 0) return markupWithPauses(chirpSentences(prepareDialogueText(text)), pauseLevel);
  const lines = prepareDialogueText(text).split('\n').filter(Boolean);
  if (lines.length === 0) return '';
  if (tempo === 'fast') return lines.join(' ');
  const landingPause = tempo === 'slow' ? '[pause long]' : language?.landingPause ?? '[pause short]';
  if (lines.length === 1) {
    const parts = lines[0].split(/(?<=[,;:—–-])\s+/u);
    if (parts.length < 2) return lines[0];
    return `${parts.slice(0, -1).join(' ')} ${landingPause} ${parts[parts.length - 1]}`;
  }
  return `${lines.slice(0, -1).join(' [pause short] ')} ${landingPause} ${lines[lines.length - 1]}`;
}

function dialoguePrompt(style: string, tempo: DialogueTempo): string {
  // Drop freeform style briefs that can make Gemini-TTS invent new lines.
  const extra = style
    .replace(/DIALOGUE_PUNCHLINE_DELIVERY/g, '')
    .replace(/DIALOGUE_SPEAKER=[A-Za-z]+/g, '')
    .replace(/DIALOGUE_VOCAL=(female|male|duet|child)/g, '')
    .replace(/DIALOGUE_TEMPO=(slow|medium|fast)/g, '')
    .replace(/TEMPO_SPEED=\d+/g, '')
    .replace(/VOICE_PITCH=\d+/g, '')
    .replace(/VOICE_BASS=\d+/g, '')
    .replace(/PAUSE_LEVEL=\d+/g, '')
    .replace(/DIALOGUE_CHARACTER=(hero|villain|comedian)/g, '')
    .replace(/DIALOGUE_LANGUAGE=[a-z-]+/g, '')
    .replace(/original [\w\s]*film dialogue[\s\S]*$/i, '')
    .replace(/Perform this as[\s\S]*$/i, '')
    .replace(/Voice tone:[^\n]*/gi, '')
    .replace(/Vocal style:[^\n]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const pace = DIALOGUE_PACE[tempo].prompt;
  const character = DIALOGUE_CHARACTER_PROMPT[characterFromStyle(style)];
  const language = dialogueLanguageFromStyle(style);
  const gender = genderDirection(style);
  const tone = voiceToneFromStyle(style);
  return [
    DIALOGUE_PROMPT,
    'CRITICAL: Speak the input text verbatim. Never invent a different dialogue.',
    language && `Performance tradition: ${language.prompt}. Speak with a native ${language.name} accent. Keep the script wording unchanged.`,
    character,
    gender,
    pace,
    tone && `Voice tone: ${tone}.`,
    extra && `Style note (never speak these words): ${extra.slice(0, 240)}`,
    STRICT_SCRIPT_RULE,
  ].filter(Boolean).join('\n');
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: [TEXT_TO_SPEECH_SCOPE] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Could not authenticate to Cloud Text-to-Speech.');
  return token.token;
}

async function synthesize(body: Record<string, unknown>): Promise<Buffer> {
  const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'x-goog-user-project': projectId(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as SynthesizeResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Text-to-speech could not synthesize this line.');
  }
  if (!payload.audioContent) throw new Error('Text-to-speech returned no audio.');
  const audio = Buffer.from(payload.audioContent, 'base64');
  if (audio.length === 0) throw new Error('Text-to-speech returned empty audio.');
  return audio;
}

function letterCount(text: string): number {
  return text.replace(/\[[^\]]*\]/g, '').match(/[\p{L}\p{M}\p{N}]/gu)?.length ?? 0;
}

/**
 * Gemini-TTS is generative and can add lines. Transcribe the take and reject it when it
 * says clearly more (or far less) than the script. Returns the reason, or null when it matches.
 */
async function verbatimProblem(audio: Buffer, expected: string): Promise<string | null> {
  let transcript: string;
  try {
    transcript = await transcribeGeneratedSpeech(audio, expected);
  } catch {
    return null;
  }
  const want = letterCount(expected);
  const got = letterCount(transcript);
  if (want === 0) return null;
  if (got > want * 1.3 + 8) return `spoke about ${got} letters for a ${want}-letter script`;
  if (got < want * 0.6 - 8) return `spoke only about ${got} of ${want} letters`;
  return null;
}

/** Synthesize with Gemini-TTS and throw if the take does not match the script. */
async function synthesizeVerbatim(body: Record<string, unknown>, expected: string, modelName: string): Promise<Buffer> {
  const audio = await synthesize(body);
  const problem = await verbatimProblem(audio, expected);
  if (problem) throw new Error(`${modelName} went off-script (${problem}).`);
  return audio;
}

function dialogueContext(style: string, text: string) {
  const language = dialogueLanguageFromStyle(style);
  const languageCode = language?.languageCode ?? languageCodeFor(text);
  const tempo = tempoFromStyle(style);
  const speakingRate = Number(
    (speakingRateFromStyle(style, DIALOGUE_PACE[tempo].speakingRate) * (language?.rateFactor ?? 1)).toFixed(2),
  );
  const pauseLevel = pauseLevelFromStyle(style);
  // Gemini-TTS ignores Chirp markup, so the pause slider becomes a spoken direction.
  const pauseDirection = pauseLevel > 0
    ? `Leave a ${['', 'short', 'clear', 'long, dramatic'][pauseLevel]} pause between sentences.`
    : '';
  const geminiPrompt = [
    dialoguePrompt(style, tempo),
    pauseDirection,
    language && `The script is in ${language.name}. Speak it in ${language.name} exactly as written.`,
  ].filter(Boolean).join('\n');
  return {
    language,
    languageCode,
    geminiLanguageCode: language?.geminiLanguageCode ?? languageCode,
    tempo,
    speakingRate,
    pauseLevel,
    geminiPrompt,
    tradition: language ? `, ${language.tradition} style` : '',
  };
}

type VoiceTag = 'male' | 'female' | 'child' | 'lead';

const VOICE_TAG_PATTERN = /\[(male|female|child)\]/gi;

const VOICE_TAG_SPEAKERS: Record<Exclude<VoiceTag, 'lead'>, string> = {
  male: 'Fenrir',
  female: 'Kore',
  child: 'Leda',
};

const VOICE_TAG_DIRECTIONS: Record<VoiceTag, string> = {
  male: 'Male speaks with a clearly adult male voice.',
  female: 'Female speaks with a clearly adult female voice.',
  child: 'Child speaks like a young child of about eight: high, light, innocent, and playful.',
  lead: '',
};

/** Splits a script at [Male] / [Female] / [Child] tags; null when the script has no tags. */
function parseVoiceSegments(raw: string): Array<{ voice: VoiceTag; text: string }> | null {
  if (!new RegExp(VOICE_TAG_PATTERN.source, 'i').test(raw)) return null;
  const segments: Array<{ voice: VoiceTag; text: string }> = [];
  let voice: VoiceTag = 'lead';
  let last = 0;
  for (const match of raw.matchAll(VOICE_TAG_PATTERN)) {
    const text = prepareDialogueText(raw.slice(last, match.index));
    if (text) segments.push({ voice, text });
    voice = match[1].toLowerCase() as VoiceTag;
    last = (match.index ?? 0) + match[0].length;
  }
  const tail = prepareDialogueText(raw.slice(last));
  if (tail) segments.push({ voice, text: tail });
  return segments.length ? segments : null;
}

function speakerForTag(voice: VoiceTag, style: string, text: string): string {
  return voice === 'lead' ? speakerFromStyle(style) ?? defaultSpeakerFor(style, text) : VOICE_TAG_SPEAKERS[voice];
}

/** Voices each tagged part with its own speaker, keeping the rest of the composition settings. */
async function generateVoiceTaggedDialogue(
  segments: Array<{ voice: VoiceTag; text: string }>,
  style: string,
  media?: SpokenMediaType,
): Promise<{ audio: Buffer; notes: string }> {
  const fullText = segments.map((segment) => segment.text).join('\n');
  const ctx = dialogueContext(style, fullText);
  if (media) {
    const spoken = spokenMediaPrompt(style, media, false);
    ctx.geminiPrompt = spoken.prompt;
    ctx.speakingRate = spoken.speakingRate;
  }
  const voices = [...new Set(segments.map((segment) => segment.voice))];
  const alias = (voice: VoiceTag) => (voice === 'lead' ? 'Lead' : voice[0].toUpperCase() + voice.slice(1));
  const directions = voices.map((voice) => VOICE_TAG_DIRECTIONS[voice]).filter(Boolean).join(' ');
  const cast = voices.map((voice) => `${alias(voice)}=${speakerForTag(voice, style, fullText)}`).join(', ');
  let lastError: Error | undefined;

  // Gemini-TTS multi-speaker handles up to two voices in one natural take.
  if (voices.length === 2) {
    for (const modelName of GEMINI_TTS_MODELS) {
      try {
        const audio = await synthesizeVerbatim({
          input: {
            prompt: [ctx.geminiPrompt, directions].filter(Boolean).join('\n'),
            multiSpeakerMarkup: {
              turns: segments.map((segment) => ({ speaker: alias(segment.voice), text: segment.text })),
            },
          },
          voice: {
            languageCode: ctx.geminiLanguageCode,
            modelName,
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: voices.map((voice) => ({
                speakerAlias: alias(voice),
                speakerId: speakerForTag(voice, style, fullText),
              })),
            },
          },
          audioConfig: audioConfigFromStyle(style, ctx.speakingRate),
        }, fullText, modelName);
        return { audio, notes: `Multi-voice dialogue generated with ${modelName} (${ctx.languageCode}, ${cast}, ${ctx.tempo} pace${ctx.tradition}).` };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Gemini-TTS could not perform this multi-voice dialogue.');
      }
    }
  }

  // One voice, three voices, or multi-speaker failure: voice each part and join the clips.
  const clips: Buffer[] = [];
  const pitch = voicePitchFromStyle(style) ?? 0;
  for (const segment of segments) {
    const speaker = speakerForTag(segment.voice, style, fullText);
    const prompt = [ctx.geminiPrompt, VOICE_TAG_DIRECTIONS[segment.voice]].filter(Boolean).join('\n');
    const childPitch = segment.voice === 'child' ? Math.min(pitch + 4, 20) : pitch;
    let clip: Buffer | undefined;
    for (const modelName of GEMINI_TTS_MODELS) {
      try {
        clip = await synthesizeVerbatim({
          input: { text: segment.text, prompt },
          voice: { languageCode: ctx.geminiLanguageCode, name: speaker, modelName },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: ctx.speakingRate,
            ...(childPitch ? { pitch: childPitch } : {}),
          },
        }, segment.text, modelName);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Gemini-TTS could not perform this line.');
      }
    }
    if (!clip) {
      try {
        clip = await synthesize({
          input: { markup: prepareDialogueMarkup(segment.text, ctx.tempo, ctx.pauseLevel, ctx.language) },
          voice: chirpVoiceFor(segment.text, speaker, ctx.languageCode),
          audioConfig: audioConfigFromStyle(style, ctx.speakingRate, 'chirp'),
        });
      } catch (error) {
        const chirpMessage = error instanceof Error ? error.message : 'Chirp could not perform this line.';
        throw new Error(lastError ? `${lastError.message} Chirp fallback: ${chirpMessage}` : chirpMessage);
      }
    }
    clips.push(clip);
  }
  return {
    audio: Buffer.concat(clips),
    notes: `Multi-voice dialogue generated line by line (${ctx.languageCode}, ${cast}, ${ctx.tempo} pace${ctx.tradition}).`,
  };
}

async function generateDialogueAudio(text: string, style: string): Promise<{ audio: Buffer; notes: string }> {
  const speaker = speakerFromStyle(style) ?? defaultSpeakerFor(style, text);
  const { language, languageCode, tempo, speakingRate, pauseLevel, geminiPrompt, tradition } = dialogueContext(style, text);
  let lastError: Error | undefined;

  for (const modelName of GEMINI_TTS_MODELS) {
    try {
      const audio = await synthesizeVerbatim({
        input: { text, prompt: geminiPrompt },
        voice: { languageCode: language?.geminiLanguageCode ?? languageCode, name: speaker, modelName },
        audioConfig: audioConfigFromStyle(style, speakingRate),
      }, text, modelName);
      return { audio, notes: `Dialogue delivery generated with ${modelName} (${languageCode}, ${speaker}, ${tempo} pace, pause ${pauseLevel}${tradition}).` };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini-TTS could not perform this dialogue.');
    }
  }

  const voice = chirpVoiceFor(text, speaker, languageCode);
  try {
    const audio = await synthesize({
      input: { markup: prepareDialogueMarkup(text, tempo, pauseLevel, language) },
      voice,
      audioConfig: audioConfigFromStyle(style, speakingRate, 'chirp'),
    });
    return { audio, notes: `Dialogue delivery generated with Chirp 3 HD markup (${voice.languageCode}, ${voice.name}, ${tempo} pace, pause ${pauseLevel}${tradition}).` };
  } catch (error) {
    const chirpMessage = error instanceof Error ? error.message : 'Chirp could not perform this dialogue.';
    throw new Error(lastError ? `${lastError.message} Chirp fallback: ${chirpMessage}` : chirpMessage);
  }
}

/**
 * Creates deterministic spoken narration using Google Cloud Chirp 3 HD.
 * Dialogue/Punchline uses Gemini-TTS first so the line is acted, not read.
 */
export async function generateSpokenNarration(
  lyrics: string,
  style = '',
): Promise<{ audio: Buffer; notes: string }> {
  if (isDialogueRequest(style)) {
    const segments = parseVoiceSegments(lyrics);
    if (segments) return generateVoiceTaggedDialogue(segments, style);
    const text = prepareDialogueText(lyrics);
    if (!text) throw new Error('Enter the dialogue or punchline to perform.');
    return generateDialogueAudio(text, style);
  }

  const media = mediaFromStyle(style);
  const taggedSegments = parseVoiceSegments(lyrics);
  if (taggedSegments) return generateVoiceTaggedDialogue(taggedSegments, style, media ?? 'podcast');
  const sentences = chirpSentences(lyrics);
  const narration = sentences.join(' ');
  if (!narration) throw new Error('Enter the spoken text to perform.');
  const pauseLevel = pauseLevelFromStyle(style);
  if (media) {
    return generateSpokenMediaAudio(narration, sentences, style, media, pauseLevel);
  }

  const voice = chirpVoiceFor(narration);
  const audio = await synthesize({
    input: pauseLevel > 0 ? { markup: markupWithPauses(sentences, pauseLevel) } : { text: narration },
    voice,
    audioConfig: audioConfigFromStyle(style, undefined, 'chirp'),
  });
  return { audio, notes: `Spoken narration generated with Chirp 3 HD (${voice.languageCode}, pause ${pauseLevel}).` };
}

function spokenMediaPrompt(style: string, media: SpokenMediaType, includeGender: boolean) {
  const pace = SPOKEN_MEDIA_PACE[media];
  const extra = style
    .replace(/SPOKEN_WORD_DELIVERY/g, '')
    .replace(/SPOKEN_MEDIA=(news|documentary|youtube-reels|podcast)/g, '')
    .replace(/SPOKEN_SPEAKER=[A-Za-z]+/g, '')
    .replace(/SPOKEN_VOCAL=(female|male|duet|child)/g, '')
    .replace(/TEMPO_SPEED=\d+/g, '')
    .replace(/VOICE_PITCH=\d+/g, '')
    .replace(/VOICE_BASS=\d+/g, '')
    .replace(/PAUSE_LEVEL=\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tone = voiceToneFromStyle(style);
  const prompt = [
    pace.prompt,
    includeGender ? genderDirection(style) : '',
    tone && `Voice tone: ${tone}.`,
    extra && `Style note (never speak these words): ${extra.slice(0, 240)}`,
    STRICT_SCRIPT_RULE,
  ].filter(Boolean).join('\n');
  return { prompt, speakingRate: speakingRateFromStyle(style, pace.speakingRate) };
}

async function generateSpokenMediaAudio(
  text: string,
  sentences: string[],
  style: string,
  media: SpokenMediaType,
  pauseLevel: number,
): Promise<{ audio: Buffer; notes: string }> {
  const speaker = speakerFromStyle(style) ?? defaultSpeakerFor(style, text);
  const languageCode = languageCodeFor(text);
  const { prompt, speakingRate } = spokenMediaPrompt(style, media, true);
  const audioConfig = audioConfigFromStyle(style, speakingRate);
  const voice = chirpVoiceFor(text, speaker);
  let lastError: Error | undefined;

  const tryChirp = async (): Promise<{ audio: Buffer; notes: string } | undefined> => {
    try {
      const audio = await synthesize({
        input: pauseLevel > 0 ? { markup: markupWithPauses(sentences, pauseLevel) } : { text },
        voice,
        audioConfig: audioConfigFromStyle(style, speakingRate, 'chirp'),
      });
      return { audio, notes: `${media} narration generated with Chirp 3 HD (${voice.languageCode}, ${voice.name}, pause ${pauseLevel}).` };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Chirp could not perform this spoken text.');
      return undefined;
    }
  };

  // Gemini-TTS ignores markup, so sentence pauses need Chirp 3 HD first.
  if (pauseLevel > 0) {
    const chirp = await tryChirp();
    if (chirp) return chirp;
  }

  for (const modelName of GEMINI_TTS_MODELS) {
    try {
      const audio = await synthesizeVerbatim({
        input: { text, prompt },
        voice: { languageCode, name: speaker, modelName },
        audioConfig,
      }, text, modelName);
      return { audio, notes: `${media} delivery generated with ${modelName} (${languageCode}, ${speaker}).` };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini-TTS could not perform this spoken text.');
    }
  }

  if (pauseLevel === 0) {
    const chirp = await tryChirp();
    if (chirp) return chirp;
  }
  throw lastError ?? new Error('The spoken text could not be performed.');
}
