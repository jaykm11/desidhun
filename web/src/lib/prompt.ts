import type { DialogueCharacter, DialogueLanguage, Genre, MoodScore, RagaMatch, ResolvedVocal, SpokenMediaType, StylePrompt } from '../types';
import { dialogueCharacterById, dialogueLanguageById, spokenMediaById } from '../data/speechOptions';
import { speechTempoLine, tempoPromptLine } from '../data/tempo';
import { voicePitchPromptLine, voiceTonePromptBlock } from '../data/voiceTone';
import { WESTERN_INSTRUMENTS } from './format';
import { MOOD_LABELS } from '../types';
import { productionTreatment } from './productionVariation';

interface PromptContext {
  moods: MoodScore[];
  ragas: RagaMatch[];
  genre: Genre;
  tempo: 'slow' | 'medium' | 'fast';
  tempoSpeed?: number;
  voicePitch?: number;
  voiceBass?: number;
  vocal: ResolvedVocal;
  voiceStyle?: string;
  dialogueCharacter?: DialogueCharacter;
  dialogueLanguage?: DialogueLanguage;
  spokenMediaType?: SpokenMediaType;
  includeBackgroundMusic?: boolean;
  includeInstruments?: boolean;
  includeBridge?: boolean;
  variationIndex: number;
  script?: 'devanagari' | 'roman' | 'mixed';
}

function tempoLine(ctx: PromptContext): string {
  return typeof ctx.tempoSpeed === 'number' ? tempoPromptLine(ctx.tempoSpeed) : {
    slow: 'slow tempo around 65-75 BPM, spacious and breathing',
    medium: 'moderate tempo around 90-100 BPM, gentle sway',
    fast: 'upbeat tempo around 120-130 BPM, driving energy',
  }[ctx.tempo];
}

const VOCAL_TEXT: Record<ResolvedVocal, string> = {
  female: 'expressive female Hindi vocals with delicate murki ornaments',
  male: 'soulful male Hindi vocals with rich lower register',
  duet: 'male-female Hindi duet with call-and-response verses',
  child: 'bright young child Hindi vocal, innocent and sweet with simple melodic phrasing',
};

function toneLine(ctx: PromptContext): string {
  if (typeof ctx.voiceBass === 'number') return `, ${voiceTonePromptBlock(ctx.voicePitch ?? 5, ctx.voiceBass)}`;
  if (typeof ctx.voicePitch === 'number') return `, ${voicePitchPromptLine(ctx.voicePitch)}`;
  return '';
}

function speechVocalLine(ctx: PromptContext): string {
  const voice = {
    female: 'female voice',
    male: 'male voice',
    duet: 'two-person duet voice',
    child: "young child's voice, about eight years old",
  }[ctx.vocal];
  const tone = toneLine(ctx);
  return ctx.voiceStyle ? `${voice}, ${ctx.voiceStyle}${tone}` : `${voice}${tone}`;
}

function speechPace(ctx: PromptContext): string {
  if (typeof ctx.tempoSpeed === 'number') return speechTempoLine(ctx.tempoSpeed);
  return ctx.tempo === 'fast'
    ? 'fast Drut pacing, quick and clipped'
    : ctx.tempo === 'slow'
      ? 'slow Vilambit pacing, measured and spacious'
      : 'medium Madhya conversational pacing';
}

function vocalText(ctx: PromptContext): string {
  const vocals: Record<PromptContext['vocal'], string> = {
    female: 'expressive female lead vocal',
    male: 'soulful male lead vocal',
    duet: 'male-female duet with complementary lead parts',
    child: 'bright young child lead vocal, innocent and sweet',
  };

  const style = ctx.voiceStyle ? `, vocal character: ${ctx.voiceStyle}` : '';
  const tone = toneLine(ctx);
  if (ctx.genre.id === 'hip-hop-trap') {
    return ctx.vocal === 'duet'
      ? `male-female rap duet with a melodic shared hook${style}${tone}`
      : `${ctx.vocal} Hindi/Urdu rhythmic flow with a melodic hook${style}${tone}`;
  }
  if (ctx.genre.id === 'rnb-neo-soul') return `${vocals[ctx.vocal]}, close-mic and soulful with restrained vocal runs${style}${tone}`;
  if (ctx.genre.id === 'western-pop') return `${vocals[ctx.vocal]}, clean pop delivery with layered harmonies${style}${tone}`;
  if (ctx.genre.id === 'afrobeats') return `${vocals[ctx.vocal]}, warm melodic phrasing with a rhythmic call-and-response hook${style}${tone}`;
  if (ctx.genre.id === 'lofi-chill') return `${vocals[ctx.vocal]}, breathy and intimate with gentle ad-libs${style}${tone}`;
  return `${VOCAL_TEXT[ctx.vocal]}${style}${tone}`;
}

function ragaDirection(ctx: PromptContext, raga: RagaMatch['raga']): string {
  const contemporary = ['afrobeats', 'western-pop', 'rnb-neo-soul', 'hip-hop-trap', 'lofi-chill'].includes(ctx.genre.id);
  return contemporary
    ? `subtle melodic colour inspired by ${raga.styleKeywords[0]}, without changing the ${ctx.genre.name} groove`
    : `based on ${raga.styleKeywords[0]}`;
}

function moodPhrase(moods: MoodScore[]): string {
  const top = moods.slice(0, 2).map((m) => MOOD_LABELS[m.mood].en.split(' / ')[0].toLowerCase());
  return top.length ? `${top.join(' and ')} mood` : 'emotional mood';
}

function clamp(parts: string[], maxLen = 950): string {
  let result = '';
  for (const part of parts) {
    const next = result ? `${result}, ${part}` : part;
    if (next.length > maxLen) break;
    result = next;
  }
  return result;
}

function nonInstrumentalKeywords(keywords: string[]): string[] {
  return keywords.filter((keyword) => !/\b(instrument|strings?|orchestra|drums?|bass|guitar|piano|synth|percussion|tabla|sitar|sarangi|flute|harmonium)\b/i.test(keyword));
}

/** Builds three style-prompt variants for the Suno "Style of Music" box. */
export function buildPrompts(ctx: PromptContext): StylePrompt[] {
  const raga = ctx.ragas[0].raga;
  const altRaga = ctx.ragas[1]?.raga;
  const mood = moodPhrase(ctx.moods);
  const treatment = productionTreatment(ctx.variationIndex);
  const styleKeywords = ctx.includeInstruments ? ctx.genre.styleKeywords : nonInstrumentalKeywords(ctx.genre.styleKeywords);
  const instrumentList = ctx.script === 'roman' ? WESTERN_INSTRUMENTS.slice(0, 4) : ctx.genre.instruments.slice(0, 4);
  const instruments = ctx.includeInstruments ? instrumentList.join(', ') : 'no musical instruments';
  const bridgeDirection = ctx.includeBridge ? 'include a distinct bridge section' : 'do not add a bridge section';
  if (ctx.genre.id === 'spoken-vocal') {
    const accompaniment = ctx.includeBackgroundMusic
      ? ctx.includeInstruments
        ? `soft, unobtrusive background music beneath the voice using ${instrumentList.slice(0, 3).join(', ')}`
        : 'soft, unobtrusive non-instrumental ambient background bed beneath the voice'
      : 'voice only; no background music, instruments, melody, humming, or vocalisations';
    const media = spokenMediaById(ctx.spokenMediaType);
    const prompt = `${media.prompt}, ${speechVocalLine(ctx)}, ${speechPace(ctx)}, clear spoken delivery of the lyrics, do not sing, ${accompaniment}, ${bridgeDirection}, ${mood}`;
    return [
      { title: `${media.name} · Clear`, description: `${media.name} spoken delivery`, prompt },
      { title: `${media.name} · Intimate`, description: `Closer ${media.name.toLowerCase()} delivery`, prompt: `${prompt}, close and intimate voice recording` },
      { title: `${media.name} · Dramatic`, description: `Emphatic ${media.name.toLowerCase()} delivery`, prompt: `${prompt}, measured dramatic emphasis` },
    ];
  }
  if (ctx.genre.id === 'dialogue-punchline') {
    const pace = speechPace(ctx);
    const character = dialogueCharacterById(ctx.dialogueCharacter);
    const language = dialogueLanguageById(ctx.dialogueLanguage);
    const prompt = `original ${language.tradition} film dialogue or punchline performance in ${language.name} as a ${character.name}, ${language.prompt}, ${character.prompt}, ${speechVocalLine(ctx)}, acted delivery with a landing, ${pace}, vocal only, do not sing, do not read it like a narrator, do not imitate any real celebrity, ${mood}`;
    return [
      { title: 'Dialogue · Punchline', description: 'Acted punchline landing', prompt },
      { title: 'Dialogue · Face-off', description: 'Pointed film-dialogue delivery', prompt: `${prompt}, tense face-off energy` },
      { title: 'Dialogue · Declaration', description: 'Climactic spoken verdict', prompt: `${prompt}, climactic declaration` },
    ];
  }

  const signature = clamp([
    ...styleKeywords,
    ragaDirection(ctx, raga),
    ...raga.styleKeywords.slice(1),
    ...treatment.promptModifiers,
    vocalText(ctx),
    instruments,
    tempoLine(ctx),
    mood,
    bridgeDirection,
    `keep the rhythm, vocal phrasing, and arrangement firmly in ${ctx.genre.name}`,
  ]);

  const polished = clamp([
    `${ctx.genre.name} production, professionally mixed`,
    ...styleKeywords.slice(0, 2),
    ...treatment.promptModifiers,
    ragaDirection(ctx, raga),
    vocalText(ctx),
    'clear focal vocal, controlled dynamics, and a polished wide mix',
    instruments,
    tempoLine(ctx),
    mood,
    bridgeDirection,
    `do not turn this into Bollywood, orchestral, or a different genre`,
  ]);

  const ragaToned = clamp([
    `${ctx.genre.name} with a subtle Indian melodic accent`,
    ...treatment.promptModifiers,
    ragaDirection(ctx, altRaga ?? raga),
    vocalText(ctx),
    ...styleKeywords.slice(1),
    instruments,
    tempoLine(ctx),
    mood,
    bridgeDirection,
    `preserve a recognisable ${ctx.genre.name} rhythm section and song form`,
  ]);

  return [
    {
      title: `${ctx.genre.name} · Signature`,
      description: `${treatment.name} variation · ${raga.name} in the ${ctx.genre.name} idiom`,
      prompt: signature,
    },
    {
      title: `${ctx.genre.name} · Polished`,
      description: `${treatment.name} variation · production-led mix without leaving the selected genre`,
      prompt: polished,
    },
    {
      title: `${ctx.genre.name} · Raga-Tinted`,
      description: altRaga
        ? `${treatment.name} variation · alternate ${altRaga.name} melodic colour within the chosen genre`
        : `${treatment.name} variation · subtle raga colour within the chosen genre`,
      prompt: ragaToned,
    },
  ];
}
