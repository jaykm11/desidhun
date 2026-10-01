const BASE_COVER_THEMES = [
  'monsoon',
  'romantic',
  'sufi',
  'ghazal',
  'bhajan',
  'folk',
  'celebration',
  'classical',
  'neon',
  'urban',
  'studio',
  'cinematic',
] as const;

type BaseCoverTheme = (typeof BASE_COVER_THEMES)[number];

/** Cover file name (without .jpg) in public/covers. */
export type CoverTheme = BaseCoverTheme | `${BaseCoverTheme}-${2 | 3 | 4 | 5}`;

/** Only files that exist in public/covers — keep in sync when adding images. */
const COVER_POOLS: Record<BaseCoverTheme, readonly CoverTheme[]> = {
  monsoon: ['monsoon', 'monsoon-2', 'monsoon-3', 'monsoon-4', 'monsoon-5'],
  romantic: ['romantic', 'romantic-2', 'romantic-3', 'romantic-4', 'romantic-5'],
  sufi: ['sufi', 'sufi-2', 'sufi-3', 'sufi-4', 'sufi-5'],
  ghazal: ['ghazal', 'ghazal-2', 'ghazal-3', 'ghazal-4', 'ghazal-5'],
  bhajan: ['bhajan', 'bhajan-2', 'bhajan-4', 'bhajan-5'],
  folk: ['folk', 'folk-2', 'folk-3', 'folk-4', 'folk-5'],
  celebration: ['celebration', 'celebration-2', 'celebration-3', 'celebration-4', 'celebration-5'],
  classical: ['classical', 'classical-2', 'classical-3', 'classical-4', 'classical-5'],
  neon: ['neon', 'neon-2', 'neon-3', 'neon-5'],
  urban: ['urban', 'urban-2', 'urban-3', 'urban-5'],
  studio: ['studio', 'studio-2', 'studio-3', 'studio-4', 'studio-5'],
  // Plus moody, dramatic art from other sets so Reels rarely repeat.
  cinematic: ['cinematic', 'cinematic-2', 'cinematic-3', 'cinematic-4', 'cinematic-5', 'urban-2', 'neon-5', 'ghazal-4', 'monsoon-5'],
};

export const COVER_THEMES: readonly CoverTheme[] = [...new Set(Object.values(COVER_POOLS).flat())];

const COVER_RULES: Array<[BaseCoverTheme, RegExp]> = [
  ['studio', /podcast|spoken|narrat|documentary|news\b|youtube.?reels|SPOKEN_WORD|SPOKEN_MEDIA/i],
  ['cinematic', /dialogue|punchline|DIALOGUE_|film.?line|hero.?entry|villain|comedian|retort|taunt/i],
  ['neon', /edm|electronic|club|disco|synth|bass.?drop|techno|trance|neon|party.?mix|dj\b/i],
  ['urban', /hip.?hop|rap\b|trap|street|urban|desi.?hip|lofi|lo-fi|drill/i],
  ['monsoon', /सावन|sawan|barish|baarish|rain|monsoon|बादल|rimjhim|रिमझिम|boondein/i],
  ['sufi', /sufi|qawwali|maula|fakir|dervish|सूफ़ी|सूफी|kawwali/i],
  ['bhajan', /bhajan|krishna|kanha|ram |rama|bhakt|mandir|भजन|devotional|radha|girdhar/i],
  ['ghazal', /ghazal|shayari|ग़ज़ल|गजल|mehfil|sher /i],
  ['celebration', /shaadi|wedding|dhol|celebration|festive|शादी|sangeet|baraat/i],
  ['folk', /folk|desi folk|punjabi|rajasthani|लोक|bhangra/i],
  ['romantic', /romantic|ishq|pyar|pyaar|love|dil |चाँद|chand|moon|ballad|प्रेम|mohabbat/i],
  ['classical', /raga|raag|classical|thumri|alap|sitar|hindustani|राग|instrumental|music.?only/i],
];

function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function variantOf(theme: BaseCoverTheme, hash: number): CoverTheme {
  const pool = COVER_POOLS[theme];
  return pool[hash % pool.length];
}

export function isCoverTheme(value: unknown): value is CoverTheme {
  return typeof value === 'string' && (COVER_THEMES as readonly string[]).includes(value);
}

/** Stored theme when it is a specific variant; older base-only themes are spread across their variants. */
export function resolveCoverTheme(stored: unknown, title: string, style = '', lyrics = ''): CoverTheme {
  if (!isCoverTheme(stored)) return coverThemeForSong(title, style, lyrics);
  if (!(BASE_COVER_THEMES as readonly string[]).includes(stored)) return stored;
  return variantOf(stored as BaseCoverTheme, stableHash(`${title}\n${lyrics}`.trim() || 'desidhun'));
}

export function coverImageForTheme(theme: CoverTheme): string {
  return `/covers/${theme}.jpg`;
}

export function coverThemeForSong(title: string, style = '', lyrics = ''): CoverTheme {
  const text = `${title}\n${style}\n${lyrics}`;
  // Title + lyrics pick the variant so versions of the same theme still look different.
  const hash = stableHash(`${title}\n${lyrics}`.trim() || text.trim() || 'desidhun');
  for (const [theme, pattern] of COVER_RULES) {
    if (pattern.test(text)) return variantOf(theme, hash);
  }
  return COVER_THEMES[hash % COVER_THEMES.length];
}

export function nextSongTitle(requested: string, existingTitles: string[]): string {
  const cleaned = requested.trim() || 'Untitled';
  const base = cleaned.replace(/\s+v\d+$/i, '').trim() || cleaned;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(?: v(\\d+))?$`, 'i');
  let maxVersion = 0;
  for (const title of existingTitles) {
    const match = title.trim().match(pattern);
    if (!match) continue;
    maxVersion = Math.max(maxVersion, match[1] ? Number(match[1]) : 1);
  }
  if (maxVersion === 0) return base;
  return `${base} v${maxVersion + 1}`;
}
