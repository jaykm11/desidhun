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

/** Reel delivery. The selected voice, character, and language choose who speaks; the style only sets the emotion. */
export interface DialogueVoicePreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

const ACT_THE_LINE = 'Act the provided script only. Do not translate, add words, or sing. Do not imitate any real person.';

function dialogueStyle(id: string, label: string, description: string, direction: string): DialogueVoicePreset {
  return { id: `dialogue-${id}`, label, description, prompt: `${direction} ${ACT_THE_LINE}` };
}

export const DIALOGUE_VOICE_PRESETS: readonly DialogueVoicePreset[] = [
  dialogueStyle('angry', 'Angry', 'Heat under control', 'Deliver this angrily: clipped, heated, and holding the fury in. Hit the last words harder.'),
  dialogueStyle('romantic', 'Romantic', 'Close and loaded', 'Deliver this as a romantic line: close, warm, and emotionally charged. Do not whisper-read.'),
  dialogueStyle('sad', 'Sad', 'Heavy and quiet', 'Deliver this sadly: heavy, quiet, and almost breaking. Do not add sobs or extra words.'),
  dialogueStyle('scared', 'Scared', 'Breath caught', 'Deliver this as frightened: unsteady, breath caught, still saying every word.'),
  dialogueStyle('excited', 'Excited', 'Bright lift', 'Deliver this excitedly: bright, quick, and delighted, with a lift into the last phrase.'),
  dialogueStyle('calm', 'Calm', 'Steady and low', 'Deliver this calmly: steady, low, and unhurried.'),
  dialogueStyle('whisper', 'Whisper', 'Close and quiet', 'Deliver this in a clear whisper: close and quiet, every word still understandable.'),
  dialogueStyle('sarcastic', 'Sarcastic', 'Dry twist', 'Deliver this sarcastically: dry, pointed, with a twist on the last phrase.'),
  dialogueStyle('tender', 'Tender', 'Soft and careful', 'Deliver this tenderly: soft, affectionate, and careful.'),
  dialogueStyle('menacing', 'Menacing', 'Cold threat', 'Deliver this menacingly: slow, cold, with threat under the words and a sting on the last phrase.'),
  dialogueStyle('shouting', 'Shouting', 'Raised and clear', 'Deliver this as a shout: raised and urgent, still intelligible. Do not add screams or extra words.'),
  dialogueStyle('cold', 'Cold', 'Flat and distant', 'Deliver this coldly: flat, distant, and unsmiling.'),
  dialogueStyle('hopeful', 'Hopeful', 'Open and lifting', 'Deliver this hopefully: open, lifting, believing the last line.'),
  dialogueStyle('desperate', 'Desperate', 'Urgent plea', 'Deliver this desperately: an urgent plea, strained, without adding words.'),
  dialogueStyle('playful', 'Playful', 'Teasing grin', 'Deliver this playfully: light, teasing, with a grin in the voice.'),
  dialogueStyle('comic', 'Comic', 'Setup and snap', 'Deliver this as a comic punchline: light setup, then a sharp snap.'),
  dialogueStyle('film-punch', 'Film punchline', 'Pause, then land it', 'Deliver this as a film punchline: hold a beat, then land the last words. Do not read it like a narrator.'),
  dialogueStyle('hero-entry', 'Hero entry', 'Commanding and measured', 'Deliver this as a commanding hero entry: slow, sure, and larger than conversation.'),
  dialogueStyle('villain', 'Villain taunt', 'Slow and cutting', 'Deliver this as a villain taunt: quiet threat, relish, and a sting on the last phrase.'),
  dialogueStyle('street', 'Street one-liner', 'Crisp and sure', 'Deliver this as a street-smart one-liner: dry, quick, and sure of itself.'),
  dialogueStyle('declaration', 'Declaration', 'Grand and final', 'Deliver this as a climax declaration: build, then land the last sentence like a verdict.'),
  dialogueStyle('face-off', 'Face-off', 'Pointed tension', 'Deliver this as a face-off line: tense, pointed, and meant for someone standing opposite you.'),
  dialogueStyle('sassy', 'Sassy', 'Cheeky comeback', 'Deliver this as a sassy comeback: cheeky, quick, and pleased with itself.'),
  dialogueStyle('cute', 'Cute', 'Innocent and funny', 'Deliver this cutely: innocent, warm, and unintentionally funny.'),
];

/** Every reel style is available for every voice, character, and language. */
export function dialoguePresetsFor(_vocal?: Vocal): readonly DialogueVoicePreset[] {
  return DIALOGUE_VOICE_PRESETS;
}

export function dialogueStyleById(id: string | undefined): DialogueVoicePreset | undefined {
  if (!id) return undefined;
  return DIALOGUE_VOICE_PRESETS.find((preset) => preset.id === id);
}

export function speakerForVocal(vocal: Exclude<Vocal, 'auto'>): string {
  if (vocal === 'child') return 'Leda';
  if (vocal === 'female') return 'Kore';
  if (vocal === 'duet') return 'Aoede';
  return 'Fenrir';
}
