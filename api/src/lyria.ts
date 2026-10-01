import { GoogleAuth } from 'google-auth-library';

// lyria-3.5 is only served by the Gemini API, which authenticates with an API key.
// Vertex serves lyria-3-pro-preview under the caller's service account.
const GEMINI_LYRIA_MODEL = process.env.LYRIA_MODEL || 'lyria-3.5';
const VERTEX_LYRIA_MODEL = 'lyria-3-pro-preview';

interface InteractionOutput {
  type?: string;
  text?: string;
  mime_type?: string;
  mimeType?: string;
  data?: string;
}

interface InteractionStep {
  type?: string;
  content?: InteractionOutput[];
  outputs?: InteractionOutput[];
}

interface InteractionResponse {
  error?: { message?: string };
  outputs?: InteractionOutput[];
  steps?: InteractionStep[];
  status?: string;
}

interface GenerateContentResponse {
  error?: { message?: string };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
}

function projectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'desidhun';
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Could not authenticate to Lyria.');
  return token.token;
}

function buildPrompt(style: string, lyrics: string): string {
  const arrangement: string[] = [];
  const singable: string[] = [];
  let hasVoiceTags = false;
  for (const line of lyrics.normalize('NFC').split('\n')) {
    const trimmed = line.trim();
    if (/^\[(male|female|child)\]$/i.test(trimmed)) {
      // Voice tags stay in place: they mark who sings the lines that follow.
      hasVoiceTags = true;
      singable.push(trimmed);
    } else if (/^\[.*\]$/.test(trimmed)) {
      arrangement.push(trimmed.slice(1, -1));
    } else {
      singable.push(line);
    }
  }
  const singableLyrics = singable.join('\n').trim();
  const spokenWord = /\bspoken[- ]word\b|voice only|do not sing/i.test(style);
  const vocalDirection = spokenWord
    ? 'This is continuous, unaccompanied spoken narration for the entire track. Recite every lyric with natural speech rhythm. Never sing, hum, chant, vocalise, rap melodically, add melody, or transition into musical phrasing at any point.'
    : singableLyrics
    ? 'Do not sing section labels, instrument names, production notes, or any text inside square brackets.'
    : 'Create a strictly instrumental track: no vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.';
  return `${style}

Arrangement directions (do not sing these words; use them only to guide the music):
${arrangement.join('\n') || 'Use a clear verse-and-chorus structure.'}

Singable lyrics only:
${singableLyrics}

${vocalDirection}${hasVoiceTags
    ? '\nVoice labels [Male], [Female], and [Child] mark who sings the lines after them: switch to a male vocalist, a female vocalist, or a young child vocalist exactly at each label, and keep that voice until the next label. Never sing the labels themselves.'
    : ''}`;
}

function audioFromBase64(data: string | undefined): Buffer | undefined {
  if (!data) return undefined;
  const bytes = Buffer.from(data, 'base64');
  return bytes.length > 0 ? bytes : undefined;
}

function interactionOutputs(body: InteractionResponse): InteractionOutput[] {
  const fromOutputs = body.outputs ?? [];
  const fromSteps = (body.steps ?? []).flatMap((step) => step.content ?? step.outputs ?? []);
  return [...fromOutputs, ...fromSteps];
}

const INAPPROPRIATE_LYRICS_ERROR = 'Inappropriate lyrics. Try something else.';

function parseInteractionAudio(body: InteractionResponse): { audio?: Buffer; notes: string } {
  const outputs = interactionOutputs(body);
  const notes = outputs
    .map((output) => output.text?.trim())
    .filter((text): text is string => !!text)
    .join('\n\n');
  const audioOutputs = outputs.filter((output) => {
    const mime = output.mime_type ?? output.mimeType ?? '';
    return output.type === 'audio' || mime.startsWith('audio/');
  });
  return { audio: audioFromBase64(audioOutputs.at(-1)?.data), notes };
}

function parseGenerateContentAudio(body: GenerateContentResponse): { audio?: Buffer; notes: string } {
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const notes = parts
    .map((part) => part.text?.trim())
    .filter((text): text is string => !!text)
    .join('\n\n');
  for (const part of parts) {
    const audio = audioFromBase64(part.inlineData?.data ?? part.inline_data?.data);
    if (audio) return { audio, notes };
  }
  return { notes };
}

async function generateViaInteractions(prompt: string, token: string, model: string): Promise<{ audio: Buffer; notes: string }> {
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1beta1/projects/${projectId()}/locations/global/interactions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [{ type: 'text', text: prompt }],
      }),
    },
  );
  const body = await response.json() as InteractionResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Lyria did not generate a song.');
  }
  const parsed = parseInteractionAudio(body);
  if (!parsed.audio) throw new Error(INAPPROPRIATE_LYRICS_ERROR);
  return { audio: parsed.audio, notes: parsed.notes };
}

async function generateViaGeminiApi(prompt: string, model: string): Promise<{ audio: Buffer; notes: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: prompt }),
  });
  const body = await response.json() as InteractionResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `${model} did not generate a song.`);
  }
  const parsed = parseInteractionAudio(body);
  if (!parsed.audio) throw new Error(INAPPROPRIATE_LYRICS_ERROR);
  return { audio: parsed.audio, notes: parsed.notes };
}

async function generateViaContent(prompt: string, token: string, model: string): Promise<{ audio: Buffer; notes: string }> {
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1beta1/projects/${projectId()}/locations/global/publishers/google/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['AUDIO', 'TEXT'] },
      }),
    },
  );
  const body = await response.json() as GenerateContentResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Lyria did not generate a song.');
  }
  const parsed = parseGenerateContentAudio(body);
  if (!parsed.audio) throw new Error(INAPPROPRIATE_LYRICS_ERROR);
  return { audio: parsed.audio, notes: parsed.notes };
}

export async function generateSongWithLyria(style: string, lyrics: string): Promise<{ audio: Buffer; notes: string }> {
  const prompt = buildPrompt(style, lyrics);
  let lastError: Error | undefined;
  const attempts = [
    () => generateViaGeminiApi(prompt, GEMINI_LYRIA_MODEL),
    async () => generateViaInteractions(prompt, await accessToken(), VERTEX_LYRIA_MODEL),
    async () => generateViaContent(prompt, await accessToken(), VERTEX_LYRIA_MODEL),
  ];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Lyria did not generate a song.');
    }
  }
  throw lastError ?? new Error('Lyria did not generate a song.');
}
