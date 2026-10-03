import { isDialogueGenre, isSpeechGenre } from '@shared/data/genres';
import { spokenMediaById } from '@shared/data/speechOptions';
import { tempoBand, tempoPromptLine } from '@shared/data/tempo';
import { DIALOGUE_VOICE_PRESETS, VOICE_PRESETS, speakerForVocal } from '@shared/data/voicePresets';
import { pausePromptLine, voicePitchPromptLine } from '@shared/data/voiceTone';
import type {
  AnalysisOptions,
  DialogueCharacter,
  DialogueLanguage,
  ResolvedVocal,
  SpokenMediaType,
  Vocal,
} from '@shared/types';

export interface CompositionState {
  genre: string;
  vocal: Vocal;
  voicePresetId: string;
  tempoSpeed: number;
  voicePitch: number;
  pauseLevel: number;
  dialogueCharacter: DialogueCharacter;
  dialogueLanguage: DialogueLanguage;
  spokenMediaType: SpokenMediaType;
  includeBackgroundMusic: boolean;
  includeInstruments: boolean;
  includeIntro: boolean;
  includeOutro: boolean;
  includeSargam: boolean;
}

function voiceParts(state: CompositionState, resolvedVocal: ResolvedVocal) {
  const dialoguePreset = isDialogueGenre(state.genre)
    ? DIALOGUE_VOICE_PRESETS.find((preset) => preset.id === state.voicePresetId)
    : undefined;
  const voicePreset = isDialogueGenre(state.genre) || state.vocal === 'auto'
    ? undefined
    : VOICE_PRESETS[state.vocal].find((preset) => preset.id === state.voicePresetId);
  const dialogueVocal = state.vocal === 'auto' ? 'male' : state.vocal;
  const speaker = isDialogueGenre(state.genre)
    ? speakerForVocal(dialogueVocal)
    : voicePreset?.speaker ?? speakerForVocal(resolvedVocal);
  return { dialoguePreset, voicePreset, speaker, dialogueVocal };
}

export function resolveVocal(state: CompositionState, analysed: ResolvedVocal | undefined): ResolvedVocal {
  if (state.vocal !== 'auto') return state.vocal;
  return analysed ?? 'female';
}

export function buildAnalysisOptions(state: CompositionState): AnalysisOptions {
  const speech = isSpeechGenre(state.genre);
  const dialogue = isDialogueGenre(state.genre);
  return {
    vocal: dialogue && state.vocal === 'auto' ? 'male' : state.vocal,
    voiceStyleId: state.vocal === 'auto' && !dialogue ? undefined : state.voicePresetId || undefined,
    tempo: tempoBand(state.tempoSpeed),
    tempoSpeed: state.tempoSpeed,
    voicePitch: state.voicePitch,
    genreOverride: state.genre,
    dialogueCharacter: dialogue ? state.dialogueCharacter : undefined,
    dialogueLanguage: dialogue ? state.dialogueLanguage : undefined,
    spokenMediaType: state.genre === 'spoken-vocal' ? state.spokenMediaType : undefined,
    includeBackgroundMusic: speech ? false : state.includeBackgroundMusic,
    includeInstruments: speech ? false : state.includeInstruments,
    includeAlap: speech ? false : state.includeIntro,
    includeIntro: speech ? false : state.includeIntro,
    includeOutro: speech ? false : state.includeOutro,
    includeSargam: speech ? false : state.includeSargam,
  };
}

/** Readable half of the style prompt, shown to the user before generating. */
export function buildProseStyle(state: CompositionState, baseStyle: string, resolvedVocal: ResolvedVocal): string {
  const { dialoguePreset, voicePreset } = voiceParts(state, resolvedVocal);
  const speech = isSpeechGenre(state.genre);
  const dialogue = isDialogueGenre(state.genre);
  return [
    baseStyle.trim(),
    !speech && voicePreset ? `Vocal style: ${voicePreset.prompt}.` : '',
    dialogue && dialoguePreset ? dialoguePreset.prompt : '',
    !speech && state.vocal !== 'auto' ? `Voice: ${state.vocal}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * KEY=value tokens the API and the TTS layer parse with regexes. They are
 * appended at generate time and are deliberately not shown as editable prose.
 */
export function buildMachineStyleTags(state: CompositionState, resolvedVocal: ResolvedVocal): string {
  const { dialoguePreset, voicePreset, speaker, dialogueVocal } = voiceParts(state, resolvedVocal);

  if (isDialogueGenre(state.genre)) {
    return [
      'DIALOGUE_PUNCHLINE_DELIVERY',
      `DIALOGUE_SPEAKER=${speaker}`,
      `DIALOGUE_VOCAL=${dialogueVocal}`,
      `DIALOGUE_TEMPO=${tempoBand(state.tempoSpeed)}`,
      `TEMPO_SPEED=${state.tempoSpeed}`,
      `VOICE_PITCH=${state.voicePitch}`,
      `PAUSE_LEVEL=${state.pauseLevel}`,
      `DIALOGUE_CHARACTER=${state.dialogueCharacter}`,
      `DIALOGUE_LANGUAGE=${state.dialogueLanguage}`,
      dialoguePreset ? `DIALOGUE_STYLE=${dialoguePreset.id}` : '',
      dialoguePreset?.prompt ?? '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (state.genre === 'spoken-vocal') {
    const media = spokenMediaById(state.spokenMediaType);
    return [
      'SPOKEN_WORD_DELIVERY',
      `SPOKEN_MEDIA=${state.spokenMediaType}`,
      `SPOKEN_SPEAKER=${speaker}`,
      `SPOKEN_VOCAL=${resolvedVocal}`,
      `TEMPO_SPEED=${state.tempoSpeed}`,
      `VOICE_PITCH=${state.voicePitch}`,
      `PAUSE_LEVEL=${state.pauseLevel}`,
      `Read the lyrics as ${media.prompt}. Use a ${resolvedVocal} voice${voicePreset ? `, ${voicePreset.prompt}` : ''}. Match the selected tempo: ${tempoPromptLine(state.tempoSpeed)}. Voice tone: ${voicePitchPromptLine(state.voicePitch)}. Speak the provided text exactly. Do not translate or invent lines. Do not sing. Speech only, with no background music or instruments.`,
    ].join('\n');
  }

  return [
    `TEMPO_SPEED=${state.tempoSpeed}`,
    `VOICE_PITCH=${state.voicePitch}`,
    `PAUSE_LEVEL=${state.pauseLevel}`,
    state.pauseLevel > 0 ? `Phrasing: ${pausePromptLine(state.pauseLevel)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildStyle(state: CompositionState, baseStyle: string, resolvedVocal: ResolvedVocal): string {
  const prose = buildProseStyle(state, isSpeechGenre(state.genre) ? '' : baseStyle, resolvedVocal);
  return [prose, buildMachineStyleTags(state, resolvedVocal)].filter(Boolean).join('\n\n');
}

export const INSTRUMENTAL_LYRICS =
  '[Instrumental composition only. Do not include vocals, sung lyrics, spoken words, humming, chanting, or vocalisations.]';
