export const VOICE_TONE_MIN = 1;
export const VOICE_TONE_MAX = 10;
export const DEFAULT_VOICE_TONE = 5;

export function clampVoiceTone(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_VOICE_TONE;
  return Math.min(VOICE_TONE_MAX, Math.max(VOICE_TONE_MIN, Math.round(parsed)));
}

/** Maps the 1–10 UI slider to Cloud TTS pitch semitones (−8 … +8). */
export function voicePitchSemitones(pitch: unknown): number {
  return Number((((clampVoiceTone(pitch) - 5) / 4) * 8).toFixed(2));
}

export function voicePitchPromptLine(pitch: unknown): string {
  const value = clampVoiceTone(pitch);
  if (value <= 3) return 'lower vocal pitch, deeper placement';
  if (value >= 8) return 'higher vocal pitch, brighter placement';
  if (value <= 4) return 'slightly lower vocal pitch';
  if (value >= 7) return 'slightly higher vocal pitch';
  return 'natural mid vocal pitch';
}

export function voiceBassPromptLine(bass: unknown): string {
  const value = clampVoiceTone(bass);
  if (value <= 3) return 'lighter bass presence, thinner low end in the voice';
  if (value >= 8) return 'stronger bass presence, warmer chest resonance and deeper low end';
  if (value <= 4) return 'slightly lighter vocal bass';
  if (value >= 7) return 'slightly warmer, bassier vocal tone';
  return 'balanced vocal bass and midrange';
}

export function voiceTonePromptBlock(pitch: unknown, bass: unknown): string {
  return `${voicePitchPromptLine(pitch)}; ${voiceBassPromptLine(bass)}`;
}

export const PAUSE_LEVEL_MIN = 0;
export const PAUSE_LEVEL_MAX = 3;
export const DEFAULT_PAUSE_LEVEL = 0;
export const PAUSE_LEVEL_LABELS = ['None', 'Short', 'Medium', 'Long'] as const;

export function clampPauseLevel(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAUSE_LEVEL;
  return Math.min(PAUSE_LEVEL_MAX, Math.max(PAUSE_LEVEL_MIN, Math.round(parsed)));
}

/** Chirp 3 HD `input.markup` pause tag inserted between sentences. */
export function pauseMarkupTag(level: unknown): string {
  return ['', '[pause short]', '[pause]', '[pause long]'][clampPauseLevel(level)];
}

export function pausePromptLine(level: unknown): string {
  return [
    '',
    'leave short rests between vocal lines',
    'leave clear rests between vocal lines',
    'leave long, spacious rests between vocal lines',
  ][clampPauseLevel(level)];
}
