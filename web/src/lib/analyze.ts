import { LEXICON } from '../data/lexicon';
import { RAGAS } from '../data/ragas';
import { GENRES, isDialogueGenre, isSpeechGenre } from '../data/genres';
import { DIALOGUE_VOICE_PRESETS, VOICE_PRESETS } from '../data/voicePresets';
import { tempoBand } from '../data/tempo';
import type { AnalysisOptions, AnalysisResult, Genre, Mood, MoodScore, RagaMatch, ResolvedVocal } from '../types';
import { MOOD_LABELS } from '../types';
import { formatLyrics, shouldUseSargam } from './format';
import { buildPrompts } from './prompt';
import { buildChorusSuggestions } from './chorus';
import { buildMusicArrangement } from './arrangement';
import { buildSongStructure } from './songStructure';

const DEVANAGARI_RE = /[\u0900-\u097F]/g;

export function detectScript(text: string): 'devanagari' | 'roman' | 'mixed' {
  const dev = (text.match(DEVANAGARI_RE) || []).length;
  const roman = (text.match(/[a-zA-Z]/g) || []).length;
  if (dev > 0 && roman > dev * 0.3) return 'mixed';
  if (dev > 0) return 'devanagari';
  return 'roman';
}

function scoreMoods(text: string): MoodScore[] {
  const lower = text.toLowerCase().normalize('NFC');
  const romanTokens = new Set(lower.split(/[^a-z]+/).filter(Boolean));
  const scores = new Map<Mood, { score: number; matches: Set<string> }>();

  const add = (mood: Mood, weight: number, count: number, match: string) => {
    const entry = scores.get(mood) ?? { score: 0, matches: new Set<string>() };
    entry.score += weight * Math.min(count, 4); // cap repetition influence
    entry.matches.add(match);
    scores.set(mood, entry);
  };

  for (const entry of LEXICON) {
    let count = 0;
    let matched = '';
    for (const word of entry.roman) {
      if (romanTokens.has(word)) {
        count += 1;
        matched = word;
      }
    }
    for (const word of entry.dev) {
      let idx = lower.indexOf(word);
      while (idx !== -1) {
        count += 1;
        matched = word;
        idx = lower.indexOf(word, idx + word.length);
      }
    }
    if (count > 0) {
      for (const [mood, weight] of Object.entries(entry.moods)) {
        add(mood as Mood, weight as number, count, matched);
      }
    }
  }

  return [...scores.entries()]
    .map(([mood, { score, matches }]) => ({ mood, score, matches: [...matches] }))
    .sort((a, b) => b.score - a.score);
}

function rankRagas(moods: MoodScore[]): RagaMatch[] {
  const totalMoodScore = moods.reduce((sum, mood) => sum + mood.score, 0);
  const dominantMood = moods[0];
  const hasDominantMood = !!dominantMood && dominantMood.score / Math.max(totalMoodScore, 1) >= 0.6;
  const results: RagaMatch[] = RAGAS.map((raga) => {
    let score = 0;
    const reasons: string[] = [];
    for (const m of moods) {
      const affinity = raga.moods[m.mood];
      if (affinity) {
        score += m.score * affinity;
        if (m.score > 0.5) {
          reasons.push(`${MOOD_LABELS[m.mood].en.split(' / ')[0].toLowerCase()} in the lyrics suits its ${raga.rasa.split('–')[1]?.trim() ?? raga.rasa} character`);
        }
      }
    }
    if (hasDominantMood && dominantMood) {
      const dominantAffinity = raga.moods[dominantMood.mood] ?? 0;
      if (dominantAffinity >= 0.9) {
        score += dominantMood.score * 0.22;
        reasons.unshift(`its strong ${MOOD_LABELS[dominantMood.mood].en.split(' / ')[0].toLowerCase()} character closely matches the lyric’s main feeling`);
      }
    }
    return { raga, score, reasons: reasons.slice(0, 2) };
  });
  results.sort((a, b) => {
    const scoreDifference = b.score - a.score;
    if (Math.abs(scoreDifference) > 0.01) return scoreDifference;
    const aBreadth = Object.values(a.raga.moods).filter((weight) => (weight ?? 0) >= 0.5).length;
    const bBreadth = Object.values(b.raga.moods).filter((weight) => (weight ?? 0) >= 0.5).length;
    return aBreadth - bBreadth;
  });
  // Fallback when no keywords matched: default to versatile romantic ragas
  if (results[0].score === 0) {
    const defaults = ['yaman', 'pahadi', 'kirwani'];
    return defaults.map((id) => ({
      raga: RAGAS.find((r) => r.id === id)!,
      score: 1,
      reasons: ['versatile raga that flatters most Hindi lyrics'],
    }));
  }
  return results.slice(0, 5);
}

function pickGenre(moods: MoodScore[], override: string | 'auto'): Genre {
  if (override !== 'auto') {
    const g = GENRES.find((g) => g.id === override);
    if (g) return g;
  }
  let best: Genre = GENRES[0];
  let bestScore = -1;
  for (const genre of GENRES) {
    let score = 0;
    for (const m of moods) {
      const affinity = genre.moods[m.mood];
      if (affinity) score += m.score * affinity;
    }
    if (score > bestScore) {
      bestScore = score;
      best = genre;
    }
  }
  return best;
}

function pickTempo(
  moods: MoodScore[],
  genre: Genre,
  override: AnalysisOptions['tempo'],
  tempoSpeed?: number,
): 'slow' | 'medium' | 'fast' {
  if (typeof tempoSpeed === 'number') return tempoBand(tempoSpeed);
  if (override !== 'auto') return override;
  const top = new Map(moods.map((m) => [m.mood, m.score]));
  const fastScore = (top.get('celebration') ?? 0) + (top.get('energetic') ?? 0) * 1.2;
  const slowScore =
    (top.get('sorrow') ?? 0) + (top.get('viraha') ?? 0) + (top.get('night') ?? 0) * 0.5 + (top.get('philosophical') ?? 0) * 0.5;
  if (fastScore > slowScore && fastScore > 6) return 'fast';
  if (slowScore > 2) return 'slow';
  return genre.tempoHint;
}

function pickVocal(moods: MoodScore[], override: AnalysisOptions['vocal']): ResolvedVocal {
  if (override !== 'auto') return override;
  const top = moods[0]?.mood;
  // Light heuristic; user can always override
  if (top === 'viraha' || top === 'monsoon') return 'female';
  if (top === 'sufi' || top === 'patriotic' || top === 'philosophical') return 'male';
  if (top === 'romance' || top === 'celebration') return 'duet';
  return 'female';
}

export function analyzeLyrics(text: string, options: AnalysisOptions, variationIndex = 0): AnalysisResult {
  const script = detectScript(text);
  const moods = scoreMoods(text);
  const rankedRagas = rankRagas(moods);
  const normalizedVariation = Math.max(0, Math.floor(variationIndex)) % rankedRagas.length;
  const ragas = [
    ...rankedRagas.slice(normalizedVariation),
    ...rankedRagas.slice(0, normalizedVariation),
  ];
  const genre = pickGenre(moods, options.genreOverride);
  const tempo = pickTempo(moods, genre, options.tempo, options.tempoSpeed);
  const spokenVocal = isSpeechGenre(genre.id);
  const vocal = pickVocal(moods, options.vocal);
  const voiceStyle = isDialogueGenre(genre.id)
    ? DIALOGUE_VOICE_PRESETS.find((preset) => preset.id === options.voiceStyleId)?.prompt
    : options.vocal === 'auto'
      ? undefined
      : VOICE_PRESETS[options.vocal].find((preset) => preset.id === options.voiceStyleId)?.prompt;
  const includeSargam = !spokenVocal && shouldUseSargam(text, genre, ragas[0].raga, options.includeSargam);
  const formattedLyrics = formatLyrics(text, {
    script,
    genre,
    includeAlap: !spokenVocal && options.includeIntro === true,
    includeOutro: !spokenVocal && options.includeOutro === true,
    includeSargam,
    includeInstruments: options.includeInstruments === true,
    includeBridge: options.includeBridge === true,
    raga: ragas[0].raga,
    tempo,
    vocal,
    variationIndex: normalizedVariation,
    voiceStyle,
  });
  const arrangement = buildMusicArrangement({
    raga: ragas[0].raga,
    genre,
    moods,
    tempo,
    vocal,
    formattedLyrics,
    variationIndex: normalizedVariation,
    voiceStyle,
    includeInstruments: options.includeInstruments,
    script,
  });
  const prompts = buildPrompts({
    moods,
    ragas,
    genre,
    tempo,
    tempoSpeed: options.tempoSpeed,
    voicePitch: options.voicePitch,
    voiceBass: options.voiceBass,
    vocal,
    voiceStyle,
    dialogueCharacter: options.dialogueCharacter,
    dialogueLanguage: options.dialogueLanguage,
    spokenMediaType: options.spokenMediaType,
    includeBackgroundMusic: options.includeBackgroundMusic,
    includeInstruments: options.includeInstruments,
    variationIndex: normalizedVariation,
    script,
  });
  const chorusSuggestions = buildChorusSuggestions(text, {
    script,
    moods,
    raga: ragas[0].raga,
    genre,
    vocal,
  });
  const songStructure = buildSongStructure({
    raga: ragas[0].raga,
    genre,
    tempo,
    arrangement,
    chorusSuggestions,
  });
  const songTitle = deriveTitle(text);
  return {
    script,
    moods: moods.slice(0, 5),
    ragas,
    genre,
    tempo,
    vocal,
    prompts,
    chorusSuggestions,
    arrangement,
    songStructure,
    formattedLyrics,
    songTitle,
  };
}

function deriveTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return 'Untitled';
  const words = firstLine.split(/\s+/).slice(0, 4).join(' ');
  return words.replace(/[,।|.!?-]+$/g, '');
}
