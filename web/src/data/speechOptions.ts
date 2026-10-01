import type { DialogueCharacter, DialogueLanguage, SpokenMediaType } from '../types';

export interface DialogueLanguageOption {
  id: DialogueLanguage;
  name: string;
  /** Chirp 3 HD / Gemini-TTS locale. */
  languageCode: string;
  /** Gemini-TTS locale when it differs from Chirp's. */
  geminiLanguageCode?: string;
  tradition: string;
  /** Delivery direction for the style prompt and TTS. */
  prompt: string;
  /** Instruction for AI-written dialogue. */
  writing: string;
  /** Multiplier on the tempo-derived speaking rate. */
  rateFactor: number;
  /** Chirp markup pause before the final punchline. */
  landingPause: '[pause short]' | '[pause]' | '[pause long]';
}

export const DIALOGUE_LANGUAGES: readonly DialogueLanguageOption[] = [
  {
    id: 'hindi',
    name: 'Hindi',
    languageCode: 'hi-IN',
    tradition: 'Bollywood',
    prompt: 'Bollywood film-dialogue style: dramatic, larger-than-life, emotional build with a punchy filmi landing',
    writing: 'Write in Hindi (Devanagari script) as Bollywood film dialogue: dramatic, rhythmic, quotable filmi lines with a punchy landing.',
    rateFactor: 0.97,
    landingPause: '[pause long]',
  },
  {
    id: 'english-us',
    name: 'American English',
    languageCode: 'en-US',
    tradition: 'Hollywood',
    prompt: 'Hollywood western film-dialogue style: naturalistic, understated, confident American delivery with a crisp one-liner landing',
    writing: 'Write in American English as Hollywood movie dialogue: natural, understated, witty one-liners with American idioms. Not Indian film style.',
    rateFactor: 1.04,
    landingPause: '[pause short]',
  },
  {
    id: 'english-uk',
    name: 'British English',
    languageCode: 'en-GB',
    tradition: 'British cinema',
    prompt: 'British film and TV drama style: dry, clipped, understated menace or wit, precise British delivery',
    writing: 'Write in British English as British film or TV drama dialogue: dry wit, understatement, British idioms and spelling. Not Indian film style.',
    rateFactor: 1.0,
    landingPause: '[pause]',
  },
  {
    id: 'chinese',
    name: 'Chinese',
    languageCode: 'cmn-CN',
    tradition: 'Chinese cinema',
    prompt: 'Chinese cinema style (Mandarin wuxia and Hong Kong action drama): poised, measured, proverb-like gravitas with a sharp final line',
    writing: 'Write in Mandarin Chinese (Simplified characters) as Chinese cinema dialogue: poised, measured lines with proverb-like gravitas, in the spirit of wuxia and Hong Kong action films.',
    rateFactor: 0.98,
    landingPause: '[pause]',
  },
  {
    id: 'telugu',
    name: 'Telugu',
    languageCode: 'te-IN',
    tradition: 'Tollywood',
    prompt: 'Tollywood (Telugu cinema) mass-dialogue style: high-voltage, swaggering hero punch, rhythmic build and explosive landing',
    writing: 'Write in Telugu (Telugu script) as Tollywood mass film dialogue: swaggering, high-voltage punch dialogues with a rhythmic build and explosive landing.',
    rateFactor: 1.02,
    landingPause: '[pause long]',
  },
  {
    id: 'bengali',
    name: 'Bengali',
    languageCode: 'bn-IN',
    geminiLanguageCode: 'bn-BD',
    tradition: 'Bengali cinema',
    prompt: 'Bengali cinema (Tollygunge) style: literary, emotive, witty adda-flavoured delivery with a heartfelt or sly landing',
    writing: 'Write in Bengali (Bengali script) as Bengali cinema dialogue from Tollygunge: literary, emotive, and witty lines with a heartfelt or sly landing.',
    rateFactor: 0.98,
    landingPause: '[pause]',
  },
];

export const DIALOGUE_LANGUAGE_IDS = DIALOGUE_LANGUAGES.map((language) => language.id);

export function dialogueLanguageById(id: string | undefined): DialogueLanguageOption {
  return DIALOGUE_LANGUAGES.find((language) => language.id === id) ?? DIALOGUE_LANGUAGES[0];
}

export const DIALOGUE_CHARACTERS: readonly { id: DialogueCharacter; name: string; prompt: string }[] = [
  {
    id: 'hero',
    name: 'Hero',
    prompt: 'hero character: commanding, righteous, larger-than-life delivery with a sure landing',
  },
  {
    id: 'villain',
    name: 'Villain',
    prompt: 'villain character: quiet threat, relish, and a sting on the last phrase',
  },
  {
    id: 'comedian',
    name: 'Comedian',
    prompt: 'comedian character: light setup, then a sharp snap on the punchline',
  },
];

export const SPOKEN_MEDIA_TYPES: readonly { id: SpokenMediaType; name: string; prompt: string }[] = [
  {
    id: 'news',
    name: 'News',
    prompt: 'broadcast news delivery: clear, neutral, and authoritative',
  },
  {
    id: 'documentary',
    name: 'Documentary',
    prompt: 'documentary narration: calm, thoughtful, and explanatory',
  },
  {
    id: 'youtube-reels',
    name: 'Youtube Reels',
    prompt: 'YouTube Reels voiceover: high-energy, hooky, short-form delivery',
  },
  {
    id: 'podcast',
    name: 'Podcast',
    prompt: 'podcast-host delivery: conversational, intimate, talking to one listener',
  },
];

export function dialogueCharacterById(id: string | undefined) {
  return DIALOGUE_CHARACTERS.find((character) => character.id === id) ?? DIALOGUE_CHARACTERS[0];
}

export function spokenMediaById(id: string | undefined) {
  return SPOKEN_MEDIA_TYPES.find((media) => media.id === id) ?? SPOKEN_MEDIA_TYPES[0];
}
