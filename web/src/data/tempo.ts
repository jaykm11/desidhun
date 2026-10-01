export const TEMPO_SPEED_MIN = 1;
export const TEMPO_SPEED_MAX = 10;
export const DEFAULT_TEMPO_SPEED = 5;

export type TempoBand = 'slow' | 'medium' | 'fast';

export function clampTempoSpeed(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TEMPO_SPEED;
  return Math.min(TEMPO_SPEED_MAX, Math.max(TEMPO_SPEED_MIN, Math.round(parsed)));
}

export function tempoBand(speed: unknown): TempoBand {
  const value = clampTempoSpeed(speed);
  if (value <= 3) return 'slow';
  if (value <= 7) return 'medium';
  return 'fast';
}

export function tempoBpm(speed: unknown): number {
  return 60 + (clampTempoSpeed(speed) - 1) * 9;
}

export function tempoSpeakingRate(speed: unknown): number {
  return Number((0.7 + (clampTempoSpeed(speed) - 1) * 0.09).toFixed(2));
}

export function tempoPromptLine(speed: unknown): string {
  const bpm = tempoBpm(speed);
  const band = tempoBand(speed);
  if (band === 'slow') return `slow Vilambit tempo around ${bpm} BPM, spacious and unhurried`;
  if (band === 'fast') return `fast Drut tempo around ${bpm} BPM, driving energy`;
  return `medium Madhya tempo around ${bpm} BPM, natural sway`;
}

export function speechTempoLine(speed: unknown): string {
  const bpm = tempoBpm(speed);
  const band = tempoBand(speed);
  if (band === 'slow') return `slow Vilambit pacing around ${bpm} BPM, measured and spacious`;
  if (band === 'fast') return `fast Drut pacing around ${bpm} BPM, quick and clipped`;
  return `medium Madhya conversational pacing around ${bpm} BPM`;
}
