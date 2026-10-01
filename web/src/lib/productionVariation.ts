export interface ProductionTreatment {
  name: string;
  promptModifiers: string[];
  supportingInstruments: string[];
  rhythmAdditions: string[];
  mixNotes: string[];
}

const TREATMENTS: ProductionTreatment[] = [
  {
    name: 'Acoustic Raga Chamber',
    promptModifiers: [
      'intimate acoustic raga chamber arrangement',
      'natural room ambience',
      'uncompressed dynamic vocal performance',
      'no electronic drums',
    ],
    supportingInstruments: [],
    rhythmAdditions: [],
    mixNotes: [
      'preserve natural dynamics and small pauses between phrases',
      'keep the acoustic room sound warm and close rather than glossy',
    ],
  },
  {
    name: 'Cinematic Orchestral',
    promptModifiers: [
      'cinematic Hindi-film orchestral treatment',
      'wide string orchestra and felt piano',
      'dramatic but restrained low-percussion swells',
      'large-screen emotional dynamics',
    ],
    supportingInstruments: ['felt piano', 'wide violin and cello ensemble'],
    rhythmAdditions: ['cinematic low-drum swells'],
    mixNotes: [
      'expand strings only in the chorus and final reprise',
      'keep the verses intimate before opening into a wide stereo chorus',
    ],
  },
  {
    name: 'Modern Indo-Fusion',
    promptModifiers: [
      'modern Indo-fusion production',
      'warm ambient pads and understated electric bass',
      'subtle brushed drum-kit layer beneath tabla',
      'contemporary spacious mix with classical vocal ornaments',
    ],
    supportingInstruments: ['warm ambient pads', 'subtle electric bass'],
    rhythmAdditions: ['brushed drum kit'],
    mixNotes: [
      'keep electronic layers below the raga instruments',
      'use filtered pads only at transitions and the chorus lift',
    ],
  },
];

export function productionTreatment(variationIndex: number): ProductionTreatment {
  return TREATMENTS[Math.max(0, Math.floor(variationIndex)) % TREATMENTS.length];
}
