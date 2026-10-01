import type { Genre } from '../types';

export const GENRES: Genre[] = [
  {
    id: 'filmi-ballad',
    name: 'Bollywood Ballad',
    description: 'Lush cinematic love ballad in the classic Hindi film tradition',
    moods: { romance: 1.0, viraha: 0.6, night: 0.5 },
    styleKeywords: ['romantic Bollywood ballad', 'lush cinematic strings', 'soaring emotional chorus'],
    instruments: ['strings section', 'bansuri flute', 'tabla', 'santoor', 'soft piano'],
    tempoHint: 'slow',
  },
  {
    id: 'ghazal',
    name: 'Ghazal',
    description: 'Intimate poetry-forward ghazal with delicate ornamentation',
    moods: { viraha: 1.0, sorrow: 0.9, romance: 0.6, philosophical: 0.6, night: 0.5 },
    styleKeywords: ['intimate Hindustani ghazal', 'delicate vocal ornamentation and murki', 'poetry-forward phrasing'],
    instruments: ['harmonium', 'tabla', 'sarangi', 'acoustic guitar', 'tanpura drone'],
    tempoHint: 'slow',
  },
  {
    id: 'sufi',
    name: 'Sufi / Qawwali',
    description: 'Ecstatic sufi qawwali building from meditative to rapturous',
    moods: { sufi: 1.0, devotion: 0.6, philosophical: 0.5, energetic: 0.5 },
    styleKeywords: ['ecstatic sufi qawwali', 'hypnotic claps and chorus repetitions', 'building spiritual intensity'],
    instruments: ['harmonium', 'dholak', 'tabla', 'group claps', 'chorus backing vocals'],
    tempoHint: 'medium',
  },
  {
    id: 'bhajan',
    name: 'Bhajan / Devotional',
    description: 'Serene devotional bhajan with traditional temple instrumentation',
    moods: { devotion: 1.0, dawn: 0.6, philosophical: 0.5 },
    styleKeywords: ['serene Hindu devotional bhajan', 'meditative kirtan warmth', 'temple atmosphere'],
    instruments: ['harmonium', 'tabla', 'manjira hand cymbals', 'bansuri flute', 'tanpura drone'],
    tempoHint: 'medium',
  },
  {
    id: 'thumri',
    name: 'Thumri / Semi-classical',
    description: 'Expressive semi-classical thumri with bol-banao embellishment',
    moods: { viraha: 0.9, romance: 0.8, monsoon: 0.6, folk: 0.5 },
    styleKeywords: ['expressive semi-classical thumri', 'bol-banao vocal embellishments', 'khayal-influenced improvisation'],
    instruments: ['sarangi', 'tabla', 'harmonium', 'tanpura drone', 'sitar'],
    tempoHint: 'slow',
  },
  {
    id: 'retro',
    name: 'Retro Bollywood (60s–70s)',
    description: 'Golden-era Hindi film orchestra — vintage warmth and grandeur',
    moods: { romance: 0.8, sorrow: 0.7, night: 0.6, viraha: 0.6 },
    styleKeywords: ['vintage 1960s Bollywood orchestra', 'golden-era analog warmth', 'grand violin ensembles and echo vocals'],
    instruments: ['full string orchestra', 'sitar flourishes', 'accordion', 'vintage percussion', 'vibraphone'],
    tempoHint: 'medium',
  },
  {
    id: 'folk',
    name: 'Desi Folk',
    description: 'Earthy Indian folk — dholak grooves and open-throated singing',
    moods: { folk: 1.0, celebration: 0.7, monsoon: 0.5, romance: 0.4 },
    styleKeywords: ['earthy Indian folk', 'open-throated rustic vocals', 'village celebration energy'],
    instruments: ['dholak', 'ektara', 'been', 'khartal', 'algoza flute', 'matka percussion'],
    tempoHint: 'medium',
  },
  {
    id: 'wedding',
    name: 'Shaadi / Celebration',
    description: 'Big festive wedding number with dhol and brass',
    moods: { celebration: 1.0, energetic: 0.8, folk: 0.6 },
    styleKeywords: ['festive Indian wedding anthem', 'dhol-driven dance groove', 'joyous group vocals'],
    instruments: ['dhol', 'shehnai', 'brass section', 'dholak', 'claps'],
    tempoHint: 'fast',
  },
  {
    id: 'patriotic',
    name: 'Desh-bhakti Anthem',
    description: 'Stirring patriotic anthem with martial orchestration',
    moods: { patriotic: 1.0, energetic: 0.6, philosophical: 0.4 },
    styleKeywords: ['stirring Indian patriotic anthem', 'martial snare and swelling brass', 'choral grandeur'],
    instruments: ['military snare', 'brass section', 'string orchestra', 'choir', 'bansuri flute'],
    tempoHint: 'medium',
  },
  {
    id: 'fusion',
    name: 'Indo-Fusion / Modern',
    description: 'Contemporary fusion — classical soul over modern production',
    moods: { romance: 0.6, energetic: 0.6, sufi: 0.5, philosophical: 0.5, night: 0.4 },
    styleKeywords: ['modern Indo-fusion production', 'classical vocals over ambient electronic textures', 'cinematic contemporary blend'],
    instruments: ['electronic pads', 'sitar', 'tabla with drum kit', 'bass guitar', 'atmospheric synths'],
    tempoHint: 'medium',
  },
  {
    id: 'classical',
    name: 'Shastriya / Classical Khayal',
    description: 'Pure Hindustani classical presentation with full alap and taans',
    moods: { devotion: 0.7, philosophical: 0.7, dawn: 0.6, night: 0.5, sorrow: 0.5 },
    styleKeywords: ['pure Hindustani classical khayal', 'extended alap and intricate taans', 'traditional raga performance'],
    instruments: ['tanpura drone', 'tabla', 'harmonium', 'sarangi'],
    tempoHint: 'slow',
  },
  {
    id: 'afrobeats',
    name: 'Afrobeats / Indo-Afrobeats',
    description: 'Warm, danceable Afro rhythm with an Indian melodic identity',
    moods: { celebration: 0.9, energetic: 0.9, romance: 0.5, night: 0.4 },
    styleKeywords: ['modern Afrobeats groove', 'syncopated percussion and rolling bass', 'Indian melodic vocal phrasing', 'sunlit, danceable energy'],
    instruments: ['Afrobeats percussion', 'log drum', 'round electric bass', 'clean guitar plucks', 'bansuri or vocal hooks'],
    tempoHint: 'medium',
  },
  {
    id: 'western-pop',
    name: 'Western Pop',
    description: 'Polished contemporary pop with a clean hook and global radio energy',
    moods: { romance: 0.8, celebration: 0.7, energetic: 0.6, sorrow: 0.4 },
    styleKeywords: ['contemporary global pop', 'immediate melodic hook', 'crisp modern drums', 'wide vocal harmonies', 'polished radio-ready production'],
    instruments: ['punchy pop drums', 'synth bass', 'bright piano', 'electric guitar', 'stacked backing vocals'],
    tempoHint: 'medium',
  },
  {
    id: 'rnb-neo-soul',
    name: 'R&B / Neo-Soul',
    description: 'Velvet, intimate R&B with soulful chords and room for expressive vocals',
    moods: { romance: 0.9, night: 0.8, sorrow: 0.6, viraha: 0.6 },
    styleKeywords: ['sultry contemporary R&B', 'neo-soul chord voicings', 'intimate close-mic vocal', 'laid-back pocket', 'subtle Indian melodic ornamentation'],
    instruments: ['electric piano', 'rounded sub bass', 'muted guitar', 'soft R&B drum kit', 'airy background vocals'],
    tempoHint: 'slow',
  },
  {
    id: 'hip-hop-trap',
    name: 'Hip-Hop / Trap',
    description: 'Modern hip-hop cadence with deep bass, sharp drums, and lyrical focus',
    moods: { energetic: 1.0, philosophical: 0.6, night: 0.6, celebration: 0.5 },
    styleKeywords: ['Indian hip-hop and trap', 'precise rhythmic vocal cadence', 'deep 808 bass', 'crisp hi-hat patterns', 'cinematic atmospheric hook'],
    instruments: ['808 sub bass', 'trap drum kit', 'sparse piano motif', 'dark synth pad', 'vocal chops'],
    tempoHint: 'medium',
  },
  {
    id: 'lofi-chill',
    name: 'Lo-fi / Chill Electronic',
    description: 'A soft, late-night electronic space for reflective poetry and gentle hooks',
    moods: { night: 0.9, philosophical: 0.8, sorrow: 0.5, romance: 0.5, dawn: 0.4 },
    styleKeywords: ['warm lo-fi electronic production', 'dusty relaxed drums', 'tape-worn texture', 'dreamy ambient space', 'restrained Indian melodic colour'],
    instruments: ['lo-fi drum loop', 'soft electric piano', 'warm synth pad', 'vinyl texture', 'distant bansuri or santoor'],
    tempoHint: 'slow',
  },
  {
    id: 'spoken-vocal',
    name: 'Vocal / Spoken Word',
    description: 'Clear spoken-word reading with optional understated musical accompaniment',
    moods: {},
    styleKeywords: ['expressive spoken-word delivery', 'clear lyrical recitation', 'natural conversational pacing'],
    instruments: ['subtle ambient bed', 'soft piano accents', 'minimal percussion'],
    tempoHint: 'medium',
  },
  {
    id: 'dialogue-punchline',
    name: 'Dialogue / Punchline',
    description: 'Vocal-only film-dialogue and punchline delivery — acted, not read',
    moods: {},
    styleKeywords: ['dramatic film dialogue delivery', 'punchline timing', 'acted spoken performance'],
    instruments: [],
    tempoHint: 'medium',
  },
];

export function isSpeechGenre(id: string | undefined): boolean {
  return id === 'spoken-vocal' || id === 'dialogue-punchline';
}

export function isDialogueGenre(id: string | undefined): boolean {
  return id === 'dialogue-punchline';
}

export const SONG_GENRES = GENRES.filter((genre) => !isSpeechGenre(genre.id));

export const COMPOSITION_KINDS = [
  { id: 'songs', name: 'Song' },
  { id: 'music', name: 'Music' },
  { id: 'spoken-vocal', name: 'Podcast' },
  { id: 'dialogue-punchline', name: 'Reels' },
] as const;

export type CompositionKind = (typeof COMPOSITION_KINDS)[number]['id'];

export function isMusicalComposition(kind: CompositionKind | '' | undefined): boolean {
  return kind === 'songs' || kind === 'music';
}
