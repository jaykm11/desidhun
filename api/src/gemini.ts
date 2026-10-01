import { GoogleAuth } from 'google-auth-library';

const ATTEMPTS = [
  [process.env.GEMINI_MODEL ?? 'gemini-2.5-flash', process.env.GEMINI_LOCATION ?? 'global'],
  ['gemini-2.5-flash', 'us-central1'],
  ['gemini-2.5-flash-lite', 'global'],
].filter((attempt, index, list) => list.findIndex((item) => item[0] === attempt[0] && item[1] === attempt[1]) === index);

const REQUEST_TIMEOUT_MS = 16_000;

export type LyricsLanguage = 'hindi' | 'english' | 'other';
export type LyricsKind = 'song' | 'dialogue' | 'spoken';

function systemInstruction(language: LyricsLanguage, kind: LyricsKind = 'song'): string {
  const languageLine = language === 'english'
    ? kind === 'song'
      ? 'Write the lyrics in English.'
      : 'Write the spoken text in English.'
    : language === 'other'
      ? kind === 'song'
        ? 'Write the lyrics in the language the user asked for in the prompt. If they did not name a language, write in the same language as the prompt.'
        : 'Write the spoken text in the language the user asked for in the prompt. If they did not name a language, write in the same language as the prompt.'
    : kind === 'song'
      ? 'Write the lyrics in Hindi using Devanagari script, unless the user explicitly asks for Roman Hindi.'
      : 'Write the spoken text in Hindi using Devanagari script, unless the user explicitly asks for Roman Hindi.';

  if (kind === 'dialogue') {
    return `You write original film dialogue and punchlines for Desi Dhun.
Follow the user's request for mood, situation, and character (Hero, Villain, or Comedian).
${languageLine}
Write 1 to 6 spoken lines only. This must be dialogue to perform aloud, not a song.
Use short, actable lines with a landing or punchline in that character's voice. Do not imitate any real celebrity, actor, or copyrighted film line.
Return only the spoken text. No title, preface, commentary, or markdown fences.`;
  }

  if (kind === 'spoken') {
    return `You write original spoken-word scripts for Desi Dhun.
Follow the user's request for media type: News, Documentary, Youtube Reels, or Podcast.
${languageLine}
Write 2 to 8 spoken sentences only. This is narration to speak aloud, not a song. Do not write verses, choruses, or rhyme on purpose.
Match the pacing and tone of the selected media type. Do not imitate any real journalist, host, or copyrighted show.
Return only the spoken text. No title, preface, commentary, or markdown fences.`;
  }

  return `You write original song lyrics for Desi Dhun.
Follow the user's request for mood, genre, and structure.
${languageLine}
Write 2 to 4 short stanzas only. Keep the song compact.
Return only the lyrics. No title, preface, commentary, or markdown fences.
Separate paragraphs or stanzas with a blank line.`;
}

interface GeminiResponse {
  error?: { message?: string; status?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

function projectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'desidhun';
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Could not authenticate to Gemini.');
  return token.token;
}

function modelUrl(location: string, model: string): string {
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId()}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

async function generateWithModel(
  model: string,
  location: string,
  prompt: string,
  language: LyricsLanguage,
  token: string,
  image?: { data: string; mimeType: string },
  kind: LyricsKind = 'song',
): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.8,
    maxOutputTokens: 768,
  };
  if (model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(modelUrl(location, model), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction(language, kind) }] },
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : []),
        ],
      }],
      generationConfig,
    }),
  });

  const body = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Gemini model ${model} did not return lyrics.`);
  }

  const lyrics = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!lyrics) throw new Error('Gemini returned empty lyrics. Try a more specific prompt.');
  return lyrics;
}

export async function generateLyricsWithGemini(
  prompt: string,
  language: LyricsLanguage = 'hindi',
  kind: LyricsKind = 'song',
): Promise<string> {
  const token = await accessToken();
  let lastError: Error | undefined;
  for (const [model, location] of ATTEMPTS) {
    try {
      return await generateWithModel(model, location, prompt, language, token, undefined, kind);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini did not return lyrics.');
    }
  }
  throw lastError ?? new Error('Gemini did not return lyrics.');
}

export async function generateLyricsFromImageWithGemini(
  prompt: string,
  image: { data: string; mimeType: string },
  language: LyricsLanguage = 'hindi',
  kind: LyricsKind = 'song',
): Promise<string> {
  const token = await accessToken();
  let lastError: Error | undefined;
  for (const [model, location] of ATTEMPTS) {
    try {
      return await generateWithModel(model, location, prompt, language, token, image, kind);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini did not return lyrics from the image.');
    }
  }
  throw lastError ?? new Error('Gemini did not return lyrics from the image.');
}

export async function analyzeRecordedSongStyle(audioBase64: string, mimeType: string): Promise<string> {
  const token = await accessToken();
  const prompt = `Analyze this user-provided audio as a music-production reference. Return one concise paragraph covering genre, tempo/BPM range, rhythmic feel, instrumentation, vocal character, mood, and arrangement. Do not identify, name, imitate, or reference any artist, song, or copyrighted melody. Describe only general musical attributes that can guide an original new composition.`;
  let lastError: Error | undefined;
  for (const [model, location] of ATTEMPTS) {
    try {
      const response = await fetch(modelUrl(location, model), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: audioBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 320 },
        }),
      });
      const body = await response.json() as GeminiResponse;
      if (!response.ok) throw new Error(body.error?.message ?? `Gemini model ${model} could not analyze the recording.`);
      const analysis = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
      if (!analysis) throw new Error('Gemini returned no musical-style analysis.');
      return analysis;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not analyze the recording.');
    }
  }
  throw lastError ?? new Error('Could not analyze the recording.');
}

function writingSystemOf(text: string): string {
  if (/[\u0900-\u097F]/u.test(text)) return 'Devanagari script';
  if (/[\u0C00-\u0C7F]/u.test(text)) return 'Telugu script';
  if (/[\u0980-\u09FF]/u.test(text)) return 'Bengali script';
  if (/[\u4E00-\u9FFF]/u.test(text)) return 'Simplified Chinese characters';
  return 'Latin letters (romanize any non-English words)';
}

/** Verbatim transcript of generated speech, used to catch TTS takes that add or drop lines. */
export async function transcribeGeneratedSpeech(audio: Buffer, referenceText: string): Promise<string> {
  const token = await accessToken();
  const prompt = `Transcribe every word spoken in this audio, verbatim, in the order spoken.
Write the transcript using ${writingSystemOf(referenceText)}.
Include every spoken word, even extra or repeated ones. Do not correct, summarize, translate, or add anything.
Return only the transcript text.`;
  let lastError: Error | undefined;
  for (const [model, location] of ATTEMPTS) {
    try {
      const response = await fetch(modelUrl(location, model), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      const body = await response.json() as GeminiResponse;
      if (!response.ok) throw new Error(body.error?.message ?? `Gemini model ${model} could not transcribe the speech.`);
      return body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The generated speech could not be transcribed.');
    }
  }
  throw lastError ?? new Error('The generated speech could not be transcribed.');
}

function parseTranscript(text: string): { lyrics: string; language: LyricsLanguage } {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { lyrics?: unknown; language?: unknown };
    const lyrics = typeof parsed.lyrics === 'string' ? parsed.lyrics.trim() : '';
    const language: LyricsLanguage = parsed.language === 'english' ? 'english' : 'hindi';
    return { lyrics, language };
  } catch {
    const hindi = /[\u0900-\u097F]/.test(cleaned);
    return { lyrics: cleaned, language: hindi ? 'hindi' : 'english' };
  }
}

export async function transcribeRecordedLyrics(
  audioBase64: string,
  mimeType: string,
): Promise<{ lyrics: string; language: LyricsLanguage }> {
  const token = await accessToken();
  const prompt = `Transcribe the singing or speech in this recording as song lyrics.
Detect whether the words are mainly Hindi or English.
If Hindi is the main language, write the lyrics in Devanagari. Do not romanize Hindi.
If English is the main language, write the lyrics in English.
If the recording mixes both, follow the dominant language and keep any clearly spoken words in their original language.
Preserve natural line breaks for verses. Do not translate. Do not invent words that were not sung or spoken.
If there are no words, return empty lyrics.
Return only JSON with this shape: {"language":"hindi"|"english","lyrics":"..."}`;
  let lastError: Error | undefined;
  for (const [model, location] of ATTEMPTS) {
    try {
      const response = await fetch(modelUrl(location, model), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: audioBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      });
      const body = await response.json() as GeminiResponse;
      if (!response.ok) throw new Error(body.error?.message ?? `Gemini model ${model} could not transcribe the recording.`);
      const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
      if (!text) throw new Error('Gemini returned no transcript.');
      const result = parseTranscript(text);
      if (!result.lyrics) throw new Error('No words were detected in that recording. Try again a little closer to the microphone.');
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The recording could not be transcribed.');
    }
  }
  throw lastError ?? new Error('The recording could not be transcribed.');
}
