import type { Vocal } from '../types';

export interface VoicePreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  speaker: string;
}

export const VOICE_PRESETS: Record<Exclude<Vocal, 'auto'>, readonly VoicePreset[]> = {
  male: [
    { id: 'male-thin-tenor', label: 'Thin tenor', description: 'Light, intimate high tenor', prompt: 'a light, intimate thin tenor vocal with clear diction', speaker: 'Puck' },
    { id: 'male-bright-tenor', label: 'Bright tenor', description: 'Clear and youthful', prompt: 'a bright, youthful tenor vocal with sparkling clarity', speaker: 'Algieba' },
    { id: 'male-smooth-tenor', label: 'Smooth tenor', description: 'Polished and melodic', prompt: 'a smooth, melodic tenor vocal with polished phrasing', speaker: 'Iapetus' },
    { id: 'male-soulful-tenor', label: 'Soulful tenor', description: 'Emotive and expressive', prompt: 'an emotive, soulful tenor vocal with expressive dynamics', speaker: 'Enceladus' },
    { id: 'male-warm-baritone', label: 'Warm baritone', description: 'Rich and reassuring', prompt: 'a warm, rich baritone vocal with reassuring presence', speaker: 'Fenrir' },
    { id: 'male-classic-baritone', label: 'Classic baritone', description: 'Full and cinematic', prompt: 'a full, classic baritone vocal with cinematic character', speaker: 'Orus' },
    { id: 'male-deep-baritone', label: 'Deep baritone', description: 'Dark and resonant', prompt: 'a deep, resonant baritone vocal with dramatic weight', speaker: 'Charon' },
    { id: 'male-indie-male', label: 'Indie', description: 'Breathy, modern edge', prompt: 'a breathy modern indie vocal with an understated edge', speaker: 'Algenib' },
    { id: 'male-sufi-male', label: 'Sufi', description: 'Textured and devotional', prompt: 'a textured, devotional vocal with Sufi-influenced ornamentation', speaker: 'Schedar' },
    { id: 'male-folk-male', label: 'Folk', description: 'Earthy and direct', prompt: 'an earthy, direct folk vocal with natural emotion', speaker: 'Umbriel' },
  ],
  female: [
    { id: 'female-breathy-alto', label: 'Breathy alto', description: 'Soft and intimate', prompt: 'a soft, intimate breathy alto vocal', speaker: 'Aoede' },
    { id: 'female-warm-alto', label: 'Warm alto', description: 'Rich and grounded', prompt: 'a warm, rich alto vocal with grounded tone', speaker: 'Gacrux' },
    { id: 'female-soulful-mezzo', label: 'Soulful mezzo', description: 'Expressive mid-range', prompt: 'an expressive soulful mezzo-soprano vocal', speaker: 'Callirrhoe' },
    { id: 'female-smooth-mezzo', label: 'Smooth mezzo', description: 'Polished and elegant', prompt: 'a smooth, elegant mezzo-soprano vocal with polished phrasing', speaker: 'Laomedeia' },
    { id: 'female-bright-soprano', label: 'Bright soprano', description: 'Clear and luminous', prompt: 'a bright, luminous soprano vocal with clear diction', speaker: 'Kore' },
    { id: 'female-power-soprano', label: 'Power soprano', description: 'Strong and cinematic', prompt: 'a powerful cinematic soprano vocal with controlled intensity', speaker: 'Zephyr' },
    { id: 'female-indie-female', label: 'Indie', description: 'Airy and contemporary', prompt: 'an airy contemporary indie vocal', speaker: 'Leda' },
    { id: 'female-bollywood-female', label: 'Bollywood', description: 'Versatile and emotive', prompt: 'a versatile, emotive Bollywood-style lead vocal', speaker: 'Autonoe' },
    { id: 'female-sufi-female', label: 'Sufi', description: 'Haunting and devotional', prompt: 'a haunting, devotional vocal with Sufi-influenced ornamentation', speaker: 'Erinome' },
    { id: 'female-folk-female', label: 'Folk', description: 'Earthy and natural', prompt: 'an earthy, natural folk vocal with expressive inflections', speaker: 'Despina' },
  ],
  duet: [
    { id: 'duet-soft-dialogue', label: 'Soft dialogue', description: 'Intimate call and response', prompt: 'an intimate duet with gentle call-and-response', speaker: 'Aoede' },
    { id: 'duet-romantic', label: 'Romantic leads', description: 'Warm cinematic pairing', prompt: 'a warm cinematic romantic duet', speaker: 'Kore' },
    { id: 'duet-tenor-soprano', label: 'Tenor & soprano', description: 'Bright vocal contrast', prompt: 'a bright tenor and soprano duet with clear vocal contrast', speaker: 'Kore' },
    { id: 'duet-baritone-alto', label: 'Baritone & alto', description: 'Deep, rich harmony', prompt: 'a deep baritone and warm alto duet with rich harmony', speaker: 'Fenrir' },
    { id: 'duet-bollywood', label: 'Bollywood', description: 'Expressive film-song style', prompt: 'an expressive Bollywood duet with alternating leads', speaker: 'Autonoe' },
    { id: 'duet-sufi', label: 'Sufi', description: 'Devotional exchanges', prompt: 'a devotional Sufi duet with textured vocal exchanges', speaker: 'Erinome' },
    { id: 'duet-folk', label: 'Folk', description: 'Earthy paired voices', prompt: 'an earthy folk duet with natural paired voices', speaker: 'Despina' },
    { id: 'duet-indie', label: 'Indie', description: 'Airy contemporary blend', prompt: 'an airy contemporary indie duet with blended harmonies', speaker: 'Leda' },
    { id: 'duet-playful', label: 'Playful exchange', description: 'Lively back-and-forth', prompt: 'a lively playful duet with conversational phrasing', speaker: 'Puck' },
    { id: 'duet-grand-finale', label: 'Grand finale', description: 'Big cinematic harmonies', prompt: 'a grand cinematic duet with soaring harmonies', speaker: 'Zephyr' },
  ],
  child: [
    { id: 'child-sweet', label: 'Sweet', description: 'Innocent and gentle', prompt: 'a sweet, innocent young child vocal with gentle phrasing', speaker: 'Leda' },
    { id: 'child-playful', label: 'Playful', description: 'Bouncy and cheerful', prompt: 'a playful, cheerful young child vocal with bouncy energy', speaker: 'Puck' },
    { id: 'child-lullaby', label: 'Lullaby', description: 'Soft and dreamy', prompt: 'a soft, dreamy young child vocal suited to a lullaby', speaker: 'Aoede' },
    { id: 'child-choir', label: 'Choir', description: 'Bright school-choir tone', prompt: 'a bright, clear children\'s choir tone singing together', speaker: 'Zephyr' },
  ],
};

export interface DialogueVoicePreset extends VoicePreset {
  vocal: Exclude<Vocal, 'auto'>;
}

export const DIALOGUE_VOICE_PRESETS: readonly DialogueVoicePreset[] = [
  { id: 'dialogue-film-punch-male', vocal: 'male', speaker: 'Fenrir', label: 'Film punchline', description: 'Pause, then land the line', prompt: 'Deliver this as a film punchline: hold a beat, then hit the last words with weight. Act the provided script only. Do not translate or invent lines. Do not read it like a narrator or audiobook.' },
  { id: 'dialogue-hero-entry', vocal: 'male', speaker: 'Orus', label: 'Hero entry', description: 'Commanding and measured', prompt: 'Deliver this as a commanding hero entry line. Slow, sure, and larger than conversation. Act the provided script only. Do not translate or invent lines. Do not imitate any real actor.' },
  { id: 'dialogue-villain', vocal: 'male', speaker: 'Charon', label: 'Villain taunt', description: 'Slow and cutting', prompt: 'Deliver this as a villain taunt: quiet threat, relish, and a sting on the last phrase. Act the provided script only. Do not translate or invent lines. Do not imitate any real actor.' },
  { id: 'dialogue-comic-male', vocal: 'male', speaker: 'Puck', label: 'Comic timing', description: 'Setup and snap', prompt: 'Deliver this as a comic punchline: light setup, then a sharp snap. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-street', vocal: 'male', speaker: 'Puck', label: 'Street one-liner', description: 'Crisp and street-smart', prompt: 'Deliver this as a street-smart one-liner: dry, quick, and sure of itself. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-declaration', vocal: 'male', speaker: 'Fenrir', label: 'Declaration', description: 'Grand and final', prompt: 'Deliver this as a courtroom or climax declaration. Build, then land the last sentence like a verdict. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-film-punch-female', vocal: 'female', speaker: 'Kore', label: 'Film punchline', description: 'Pause, then land the line', prompt: 'Deliver this as a film punchline: hold a beat, then hit the last words with fire. Act the provided script only. Do not translate or invent lines. Do not read it like a narrator.' },
  { id: 'dialogue-heroine', vocal: 'female', speaker: 'Zephyr', label: 'Heroine retort', description: 'Sharp and proud', prompt: 'Deliver this as a proud heroine retort: clear, cutting, and in control. Act the provided script only. Do not translate or invent lines. Do not imitate any real actress.' },
  { id: 'dialogue-romance', vocal: 'female', speaker: 'Aoede', label: 'Romantic line', description: 'Intimate and loaded', prompt: 'Deliver this as a loaded romantic film line: close, warm, and emotionally charged. Act the provided script only. Do not translate or invent lines. Do not whisper-read.' },
  { id: 'dialogue-comic-female', vocal: 'female', speaker: 'Callirrhoe', label: 'Comic timing', description: 'Setup and snap', prompt: 'Deliver this as a comic punchline: playful setup, then a bright snap. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-child-cute', vocal: 'child', speaker: 'Leda', label: 'Cute kid', description: 'Innocent and funny', prompt: 'Deliver this as a young child of about eight: innocent, curious, and unintentionally funny. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-child-sassy', vocal: 'child', speaker: 'Puck', label: 'Sassy kid', description: 'Cheeky comeback', prompt: 'Deliver this as a cheeky young child of about eight with a sassy comeback. Act the provided script only. Do not translate or invent lines.' },
  { id: 'dialogue-duet-exchange', vocal: 'duet', speaker: 'Fenrir', label: 'Face-off line', description: 'Two-person tension, one voice', prompt: 'Deliver this as a face-off dialogue line: tense, pointed, and meant for someone standing opposite you. Act the provided script only. Do not translate or invent lines.' },
];

export function dialoguePresetsFor(vocal: Vocal): readonly DialogueVoicePreset[] {
  if (vocal === 'auto') return DIALOGUE_VOICE_PRESETS;
  return DIALOGUE_VOICE_PRESETS.filter((preset) => preset.vocal === vocal);
}

export function speakerForVocal(vocal: Exclude<Vocal, 'auto'>): string {
  if (vocal === 'child') return 'Leda';
  if (vocal === 'female') return 'Kore';
  if (vocal === 'duet') return 'Aoede';
  return 'Fenrir';
}
