export type Mood =
  | 'romance'
  | 'viraha' // separation, longing
  | 'devotion'
  | 'sufi'
  | 'sorrow'
  | 'celebration'
  | 'monsoon'
  | 'night'
  | 'dawn'
  | 'patriotic'
  | 'philosophical'
  | 'energetic'
  | 'folk';

export const MOOD_LABELS: Record<Mood, { en: string; hi: string }> = {
  romance: { en: 'Romance / Shringar', hi: 'श्रृंगार' },
  viraha: { en: 'Longing / Viraha', hi: 'विरह' },
  devotion: { en: 'Devotion / Bhakti', hi: 'भक्ति' },
  sufi: { en: 'Sufi / Mystic', hi: 'सूफ़ी' },
  sorrow: { en: 'Sorrow / Karuna', hi: 'करुण' },
  celebration: { en: 'Celebration / Utsav', hi: 'उत्सव' },
  monsoon: { en: 'Monsoon / Saawan', hi: 'सावन' },
  night: { en: 'Night / Raatri', hi: 'रात्रि' },
  dawn: { en: 'Dawn / Prabhat', hi: 'प्रभात' },
  patriotic: { en: 'Patriotic / Desh-bhakti', hi: 'देशभक्ति' },
  philosophical: { en: 'Philosophical / Chintan', hi: 'चिंतन' },
  energetic: { en: 'Energetic / Veer', hi: 'वीर' },
  folk: { en: 'Folk / Lok', hi: 'लोक' },
};

export interface Raga {
  id: string;
  name: string;
  nameHi: string;
  thaat: string;
  time: string; // traditional performance time
  rasa: string; // emotional essence
  description: string;
  /** affinity of this raga for each mood, 0–1 */
  moods: Partial<Record<Mood, number>>;
  /** iconic film/classical songs based on this raga, for inspiration */
  referenceSongs: string[];
  /** phrases to feed the Suno style box */
  styleKeywords: string[];
  /** characteristic swaras, shown to the user */
  keyNotes: string;
}

export interface Genre {
  id: string;
  name: string;
  description: string;
  moods: Partial<Record<Mood, number>>;
  styleKeywords: string[];
  instruments: string[];
  tempoHint: 'slow' | 'medium' | 'fast';
}

export type Vocal = 'auto' | 'female' | 'male' | 'duet' | 'child';
export type ResolvedVocal = Exclude<Vocal, 'auto'>;
export type Tempo = 'auto' | 'slow' | 'medium' | 'fast';
export type DialogueCharacter = 'hero' | 'villain' | 'comedian';
export type SpokenMediaType = 'news' | 'documentary' | 'youtube-reels' | 'podcast';
export type DialogueLanguage = 'hindi' | 'english-us' | 'english-uk' | 'chinese' | 'telugu' | 'bengali';

export interface AnalysisOptions {
  vocal: Vocal;
  voiceStyleId?: string;
  tempo: Tempo;
  /** Slider speed from 1 (slowest) to 10 (fastest). */
  tempoSpeed?: number;
  /** Voice pitch from 1 (lowest) to 10 (highest). */
  voicePitch?: number;
  /** Voice bass / low-end presence from 1 (light) to 10 (heavy). */
  voiceBass?: number;
  genreOverride: string | 'auto';
  dialogueCharacter?: DialogueCharacter;
  dialogueLanguage?: DialogueLanguage;
  spokenMediaType?: SpokenMediaType;
  includeBackgroundMusic?: boolean;
  includeInstruments?: boolean;
  includeBridge?: boolean;
  includeIntro?: boolean;
  includeOutro?: boolean;
  includeAlap: boolean;
  includeSargam: boolean;
}

export interface MoodScore {
  mood: Mood;
  score: number;
  matches: string[];
}

export interface RagaMatch {
  raga: Raga;
  score: number;
  reasons: string[];
}

export interface StylePrompt {
  title: string;
  description: string;
  prompt: string;
}

export interface ChorusSuggestion {
  id: 'detected-mukhda' | 'raga-hook' | 'call-response';
  title: string;
  description: string;
  lyrics: string;
  arrangementNote: string;
  source: 'from-poem' | 'original-suggestion';
}

export interface ArrangementSection {
  section: 'Intro / Alap' | 'Verse / Antara' | 'Chorus / Mukhda' | 'Sargam / Interlude' | 'Outro';
  instruments: string[];
  direction: string;
}

export interface MusicArrangement {
  title: string;
  summary: string;
  tempoBpm: string;
  taal: string;
  drone: string;
  melodicLead: string[];
  supportingInstruments: string[];
  rhythmSection: string[];
  mixNotes: string[];
  sections: ArrangementSection[];
  productionPrompt: string;
  instrumentedLyrics: string;
}

export interface SongStructureSection {
  id: string;
  title: string;
  timing: string;
  lyricDirection: string;
  arrangementDirection: string;
}

export interface SongStructureRecommendation {
  title: string;
  rationale: string;
  listeningReferences: string[];
  sections: SongStructureSection[];
  formattedOutline: string;
}

export interface AnalysisResult {
  script: 'devanagari' | 'roman' | 'mixed';
  moods: MoodScore[];
  ragas: RagaMatch[];
  genre: Genre;
  tempo: 'slow' | 'medium' | 'fast';
  vocal: ResolvedVocal;
  prompts: StylePrompt[];
  chorusSuggestions: ChorusSuggestion[];
  arrangement: MusicArrangement;
  songStructure: SongStructureRecommendation;
  formattedLyrics: string;
  songTitle: string;
}
