import type { Genre, Raga, Tempo, Vocal } from '../types';

interface FormatContext {
  script: 'devanagari' | 'roman' | 'mixed';
  genre: Genre;
  includeAlap: boolean;
  includeOutro: boolean;
  includeSargam: boolean;
  includeInstruments: boolean;
  includeBridge: boolean;
  raga: Raga;
  tempo: Exclude<Tempo, 'auto'>;
  vocal: Exclude<Vocal, 'auto'>;
  variationIndex?: number;
  voiceStyle?: string;
}

const SARGAM_PATTERNS: Record<string, string> = {
  yaman: 'Ni Re Ga Ma Pa, Dha Ni Sa′ ... Sa′ Ni Dha Pa Ma Ga Re Sa',
  bhairavi: 'Sa re ga ma Pa, dha ni Sa′ ... Sa′ ni dha Pa ma ga re Sa',
  bhimpalasi: 'ni Sa ga ma Pa, ni Sa′ ... Sa′ ni Dha Pa ma ga Sa',
  darbari: 'Sa Re ga ma Pa, dha ni Sa′ ... Sa′ ni dha Pa ma ga Re Sa',
  malkauns: 'Sa ga ma dha ni Sa′ ... Sa′ ni dha ma ga Sa',
  pahadi: 'Sa Re Ga Pa Dha, Pa Ga Re Sa ... Re Ga Pa Dha Pa Ga Re Sa',
  khamaj: 'Sa Ga ma Pa Dha Ni Sa′ ... Sa′ ni Dha Pa ma Ga Re Sa',
  desh: 'Sa Re ma Pa Ni Sa′ ... Sa′ ni Dha Pa ma Ga Re Sa',
  megh: 'Sa Re ma Pa ni Sa′ ... Sa′ ni Pa ma Re Sa',
  bageshri: 'Sa ga ma Dha ni Sa′ ... Sa′ ni Dha ma ga Sa',
  pilu: 'Sa Re ga ma Pa Dha ni Sa′ ... Sa′ ni Dha Pa ma ga Re Sa',
  shivranjani: 'Sa Re ga Pa Dha Sa′ ... Sa′ Dha Pa ga Re Sa',
  charukeshi: 'Sa Re Ga ma Pa dha ni Sa′ ... Sa′ ni dha Pa ma Ga Re Sa',
  kirwani: 'Sa Re ga ma Pa dha Ni Sa′ ... Sa′ Ni dha Pa ma ga Re Sa',
  bhairav: 'Sa re Ga ma Pa dha Ni Sa′ ... Sa′ Ni dha Pa ma Ga re Sa',
  ahirbhairav: 'Sa re Ga ma Pa Dha ni Sa′ ... Sa′ ni Dha Pa ma Ga re Sa',
  jaijaiwanti: 'Re ga Re Sa, Ni Dha Pa ... Pa Dha ni Sa′, ni Dha Pa ma Ga Re Sa',
  todi: 'Sa re ga Ma Pa dha Ni Sa′ ... Sa′ Ni dha Pa Ma ga re Sa',
  kafi: 'Sa Re ga ma Pa Dha ni Sa′ ... Sa′ ni Dha Pa ma ga Re Sa',
  bihag: 'Ni Sa Ga ma Pa Ni Sa′ ... Sa′ Ni Dha Pa ma Ga ma Ga Re Sa',
  hamsadhwani: 'Sa Re Ga Pa Ni Sa′ ... Sa′ Ni Pa Ga Re Sa',
  mand: 'Sa Re Ga Pa Dha, Ni Dha Pa ... Ga Re Sa',
};

/** Solfege used as the Western counterpart to sargam for English / roman lyrics. */
const WESTERN_SOLFEGE = 'Do Re Mi Fa Sol La Ti Do′ ... Do′ Ti La Sol Fa Mi Re Do';

export const WESTERN_INSTRUMENTS = [
  'piano',
  'acoustic guitar',
  'electric guitar',
  'bass guitar',
  'drum kit',
  'synth pads',
  'string section',
] as const;

const RAGA_VOCALISES: Record<string, { devanagari: string[]; roman: string[] }> = {
  yaman: { devanagari: ['नि~ रे गा~ म^ ... प~ म^ गा रे', 'गा म^ धा~ नि ... सां~ नि धा प'], roman: ['Ni~ Re Ga~ Ma^ ... Pa~ Ma^ Ga Re', 'Ga Ma^ Dha~ Ni ... Sa~ Ni Dha Pa'] },
  bhairavi: { devanagari: ['सा~ रे गा~ म ... प धा नि सां', 'नि~ धा प~ म गा रे सा'], roman: ['Sa~ re ga~ ma ... Pa dha ni Sa', 'ni~ dha Pa~ ma ga re Sa'] },
  bhimpalasi: { devanagari: ['नि~ सा गा~ म ... प नि सां', 'सां~ नि धा प~ म गा सा'], roman: ['ni~ Sa ga~ ma ... Pa ni Sa', 'Sa~ ni Dha Pa~ ma ga Sa'] },
  darbari: { devanagari: ['सा~ रे गा(अंदोलन) ... म प धा~', 'धा~ प म~ गा रे सा'], roman: ['Sa~ Re ga (andolan) ... ma Pa Dha~', 'Dha~ Pa ma~ ga Re Sa'] },
  malkauns: { devanagari: ['सा~ गा म~ धा नि ... सां', 'सां~ नि धा~ म गा सा'], roman: ['Sa~ ga ma~ dha ni ... Sa', 'Sa~ ni dha~ ma ga Sa'] },
  megh: { devanagari: ['सा रे~ म प ... नि प म रे', 'म~ रे सा ... रे म प'], roman: ['Sa Re~ ma Pa ... ni Pa ma Re', 'ma~ Re Sa ... Re ma Pa'] },
  bageshri: { devanagari: ['सा~ गा म धा~ नि ... सां', 'सां~ नि धा म~ गा सा'], roman: ['Sa~ ga ma Dha~ ni ... Sa', 'Sa~ ni Dha ma~ ga Sa'] },
  shivranjani: { devanagari: ['सा रे गा~ प धा ... सां', 'सां~ धा प~ गा रे सा'], roman: ['Sa Re ga~ Pa Dha ... Sa', 'Sa~ Dha Pa~ ga Re Sa'] },
  kirwani: { devanagari: ['सा रे गा म~ प धा नि', 'सां~ नि धा प~ म गा रे सा'], roman: ['Sa Re ga ma~ Pa dha Ni', 'Sa~ Ni dha Pa~ ma ga Re Sa'] },
  bhairav: { devanagari: ['सा~ रे(अंदोलन) गा म ... प धा नि', 'नि~ धा प म~ गा रे सा'], roman: ['Sa~ re (andolan) Ga ma ... Pa dha Ni', 'Ni~ dha Pa ma~ Ga re Sa'] },
};

const OPENING_FORMS = {
  devanagari: [
    'मंद आलाप — {motif}', 'साँस भरी हमिंग — हम्म~ {motif}', 'खुली स्वर-लहर — आह~ {motif}',
    'सरगम उठान — {motif}', 'कोमल मींड से प्रवेश — {motif}', 'धीमी तान का संकेत — ता ना~ {motif}',
    'सूफ़ियाना पुकार — ओ रे~ {motif}', 'मृदु बोल-आलाप — ना रे ना~ {motif}',
    'प्रतिध्वनि वाली हमिंग — हूँ~ {motif}', 'मुक्त लय स्वर-विस्तार — {motif}',
    'तानाना पिकअप — ता ना ना~ {motif}', 'बाँसुरी-जैसी स्वर-रेखा — {motif}',
    'अंतरंग फुसफुसाती हमिंग — हम्म~ {motif}', 'उज्ज्वल ऊपरी-सप्तक स्पर्श — आ~ {motif}',
    'निम्न स्वर से उठान — हूँ~ {motif}', 'लय से पहले स्वर-संवाद — ना~ {motif}',
    'कोमल सिसकी-जैसा आलाप — आह~ {motif}', 'उत्सवी स्वर-पुकार — हे~ {motif}',
    'लहराती मुरकी का प्रवेश — {motif}', 'सादा एकल स्वर-पिकअप — आ~ {motif}',
    'जवाब देती स्वर-पंक्ति — ना रे~ {motif}', 'धीमा ध्यानमय जप — ओम~ {motif}',
    'रसीली ठुमरी-छुअन — आओ रे~ {motif}', 'खामोश शुरुआत के बाद स्वर — {motif}',
  ],
  roman: [
    'gentle alap — {motif}', 'breathy humming — hmm~ {motif}', 'open vowel glide — aah~ {motif}',
    'sargam pickup — {motif}', 'soft meend entry — {motif}', 'restrained taan cue — ta na~ {motif}',
    'Sufi-style call — o re~ {motif}', 'quiet bol-alap — na re na~ {motif}',
    'echoed humming — hum~ {motif}', 'free-rhythm vocal expansion — {motif}',
    'tarana-style pickup — ta na na~ {motif}', 'flute-like vocal contour — {motif}',
    'intimate whispered hum — hmm~ {motif}', 'bright upper-register touch — aah~ {motif}',
    'low-register rise — hum~ {motif}', 'vocal conversation before the beat — na~ {motif}',
    'aching sigh-like alap — aah~ {motif}', 'celebratory vocal call — hey~ {motif}',
    'ornamented murki entry — {motif}', 'simple solo vowel pickup — aa~ {motif}',
    'answering vocal phrase — na re~ {motif}', 'meditative drone hum — om~ {motif}',
    'light thumri inflection — aao re~ {motif}', 'silence, then a vocal entry — {motif}',
  ],
} as const;

function lyricSeed(text: string): number {
  return [...text.normalize('NFC')].reduce((seed, char) => (seed * 31 + char.codePointAt(0)!) >>> 0, 7);
}

function ragaVocalise(raga: Raga, script: FormatContext['script'], lyrics: string, offset = 0): string {
  const presets = RAGA_VOCALISES[raga.id];
  const roman = script === 'roman';
  const choices = presets?.[roman ? 'roman' : 'devanagari']
    ?? (roman ? ['Aa~ re~ ga~ ... pa~ ma~ ga re sa'] : ['आ~ रे~ गा~ ... प~ म~ गा रे सा']);
  const seed = lyricSeed(lyrics) + offset;
  const motif = choices[seed % choices.length];
  const form = OPENING_FORMS[roman ? 'roman' : 'devanagari'][seed % OPENING_FORMS[roman ? 'roman' : 'devanagari'].length];
  // The description belongs in a section direction, not in the singable lyric.
  // Keep only the wordless vocal phrase after the em dash.
  return form.split('—').at(-1)!.trim().replace('{motif}', motif);
}

interface LyricProfile {
  intro: string;
  verse: string;
  chorus: string;
  bridge: string;
  outro: string;
}

const GENRE_LYRIC_PROFILES: Record<string, LyricProfile> = {
  afrobeats: {
    intro: 'percussion pickup, warm rhythmic pocket',
    verse: 'rhythmic, conversational phrasing',
    chorus: 'catchy call-and-response hook',
    bridge: 'percussion and vocal-hook break',
    outro: 'percussion fades under a final vocal hook',
  },
  'western-pop': {
    intro: 'clean instrumental pickup',
    verse: 'clear, intimate pop phrasing',
    chorus: 'wide, memorable pop hook with harmonies',
    bridge: 'stripped-back lift into the final hook',
    outro: 'final title phrase over a polished pop release',
  },
  'rnb-neo-soul': {
    intro: 'electric piano and intimate vocal ad-libs',
    verse: 'close-mic, behind-the-beat soul phrasing',
    chorus: 'melismatic neo-soul hook with soft harmonies',
    bridge: 'open-space vocal runs and chord change',
    outro: 'gentle vocal runs over fading electric piano',
  },
  'hip-hop-trap': {
    intro: 'atmospheric beat drop and vocal tag',
    verse: 'rhythmic lyrical flow with deliberate pauses',
    chorus: 'short melodic hook, direct and repeatable',
    bridge: 'half-time beat switch or instrumental reset',
    outro: 'final hook or spoken title phrase over the beat',
  },
  'lofi-chill': {
    intro: 'soft tape-textured instrumental pickup',
    verse: 'breathy, unhurried late-night phrasing',
    chorus: 'gentle floating hook with layered whispers',
    bridge: 'instrumental breathing space',
    outro: 'soft humming and ambient fade',
  },
};

const DEFAULT_PROFILE: LyricProfile = {
  intro: 'soulful alap, free rhythm',
  verse: 'gentle, intimate',
  chorus: 'mukhda, full emotion',
  bridge: 'vocal notes with instruments',
  outro: 'fading alap and humming',
};

function profileFor(genre: Genre): LyricProfile {
  return GENRE_LYRIC_PROFILES[genre.id] ?? DEFAULT_PROFILE;
}

function vocalDirection(vocal: FormatContext['vocal']): string {
  if (vocal === 'duet') return 'male-female duet';
  return `${vocal} lead vocal`;
}

function tempoDirection(tempo: FormatContext['tempo']): string {
  if (tempo === 'slow') return 'slow and spacious';
  if (tempo === 'fast') return 'fast and energetic';
  return 'mid-tempo';
}

export function shouldUseSargam(text: string, genre: Genre, raga: Raga, allowed: boolean): boolean {
  if (!allowed) return false;
  const lineCount = text.split('\n').filter((line) => line.trim()).length;
  const stanzaCount = text.split(/\n\s*\n/).filter((stanza) => stanza.trim()).length;
  const hasSpaceForInterlude = lineCount >= 7 || stanzaCount >= 2;
  if (!hasSpaceForInterlude) return false;

  // Sargam is most natural in semi-classical or classical arrangements. A few
  // improvisation-forward ragas also sustain a short sargam bridge in bhajan.
  if (genre.id === 'classical' || genre.id === 'thumri' || genre.id === 'fusion') return true;
  if (genre.id === 'bhajan') {
    return ['yaman', 'bhairav', 'ahirbhairav', 'malkauns', 'hamsadhwani', 'todi'].includes(raga.id);
  }
  return false;
}

/**
 * Structures raw lyrics into a Suno-friendly arrangement:
 * - splits stanzas on blank lines (or groups of 4 lines when none exist)
 * - detects the mukhda (refrain) by finding the most-repeated stanza/line
 * - inserts meta tags Suno understands: [Intro], [Verse], [Chorus], etc.
 * - optionally adds an alap intro/outro and a sargam interlude
 */
export function formatLyrics(text: string, ctx: FormatContext): string {
  const stanzas = splitStanzas(text);
  if (stanzas.length === 0) return '';
  // Dialogue and spoken scripts must stay as the user's text — never wrap them in song structure.
  if (ctx.genre.id === 'spoken-vocal' || ctx.genre.id === 'dialogue-punchline') return text.trim();

  const refrainKey = findRefrain(stanzas);
  const useWestern = ctx.script === 'roman';
  const sargam = useWestern
    ? WESTERN_SOLFEGE
    : (SARGAM_PATTERNS[ctx.raga.id] ?? 'Sa Re Ga Ma Pa ... Pa Ma Ga Re Sa');
  const variation = ctx.variationIndex ?? 0;
  const alapLine = ragaVocalise(ctx.raga, ctx.script, text, variation);
  const humming = ragaVocalise(ctx.raga, ctx.script, text, variation + 1);
  const profile = profileFor(ctx.genre);
  const vocal = `${vocalDirection(ctx.vocal)}${ctx.voiceStyle ? `, ${ctx.voiceStyle}` : ''}`;
  const tempo = tempoDirection(ctx.tempo);
  const isContemporary = GENRE_LYRIC_PROFILES[ctx.genre.id] !== undefined;

  const out: string[] = [];

  if (ctx.includeAlap) {
    out.push(
      isContemporary || useWestern
        ? `[Intro - ${useWestern ? 'western pop-inspired' : `${ctx.raga.name}-inspired`} wordless vocal motif, ${profile.intro}, ${vocal}, ${tempo}]`
        : `[Intro - ${profile.intro}, ${ctx.raga.name} mood, ${vocal}, ${tempo}]`,
    );
    // Raga-note / solfege vocal phrases are Sargam content and must only be included
    // when the user explicitly selected the Sargam option.
    if (ctx.includeSargam) out.push(alapLine);
    out.push('');
  } else if (ctx.includeInstruments) {
    out.push(`[Short Instrumental Intro - ${profile.intro}, ${tempo}]`);
    out.push('');
  }

  let verseNum = 0;
  let chorusShown = false;
  let sargamInserted = !ctx.includeSargam;
  let bridgeInserted = !ctx.includeBridge;

  stanzas.forEach((stanza, i) => {
    const isRefrain = refrainKey !== null && stanzaKey(stanza) === refrainKey;

    if (isRefrain) {
      out.push(chorusShown ? `[Chorus - ${profile.chorus}]` : `[Chorus - ${profile.chorus}, ${vocal}]`);
      chorusShown = true;
    } else {
      verseNum += 1;
      out.push(
        verseNum === 1
          ? `[Verse 1 - ${profile.verse}, ${vocal}]`
          : `[Verse ${verseNum} - ${profile.verse}, building energy]`,
      );
    }
    out.push(...stanza);
    out.push('');

    // drop a sargam/solfege or instrumental break roughly mid-song
    const midpoint = Math.floor(stanzas.length / 2);
    if (!sargamInserted && i === Math.max(0, midpoint - 1) && stanzas.length > 1) {
      out.push(useWestern
        ? `[Western Sargam / Solfege Interlude - ${profile.bridge}]`
        : `[Sargam Interlude - ${profile.bridge}]`);
      out.push(sargam);
      out.push('');
      sargamInserted = true;
    }
    if (!bridgeInserted && i === Math.max(0, midpoint - 1) && stanzas.length > 1) {
      out.push(
        ctx.includeInstruments
          ? `[Bridge - ${profile.bridge}]`
          : '[Bridge - brief vocal transition, no instruments]',
      );
      out.push('');
      bridgeInserted = true;
    }
  });

  // Reprise the refrain at the end if we found one and it doesn't already end the song
  if (refrainKey !== null && stanzaKey(stanzas[stanzas.length - 1]) !== refrainKey) {
    const refrain = stanzas.find((s) => stanzaKey(s) === refrainKey)!;
    out.push(`[Final Chorus - ${profile.chorus}, fullest delivery]`);
    out.push(...refrain);
    out.push('');
  }

  if (ctx.includeOutro && ctx.includeAlap) {
    out.push(`[Outro - ${profile.outro}]`);
    if (ctx.includeSargam) out.push(humming);
  } else if (ctx.includeOutro && ctx.includeInstruments) {
    out.push(`[Outro - ${profile.outro}]`);
  }

  return out.join('\n').trim();
}

/** Returns the repeated mukhda/refrain exactly as supplied by the poet. */
export function findDetectedMukhda(text: string): string[] | null {
  const stanzas = splitStanzas(text);
  const refrainKey = findRefrain(stanzas);
  if (refrainKey === null) return null;
  return stanzas.find((stanza) => stanzaKey(stanza) === refrainKey) ?? null;
}

function splitStanzas(text: string): string[][] {
  const lines = text.split('\n').map((l) => l.trim());
  const stanzas: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line === '') {
      if (current.length) stanzas.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) stanzas.push(current);

  // No blank-line separation: chunk into stanzas of 4 lines
  if (stanzas.length === 1 && stanzas[0].length > 6) {
    const all = stanzas[0];
    const chunked: string[][] = [];
    for (let i = 0; i < all.length; i += 4) chunked.push(all.slice(i, i + 4));
    return chunked;
  }
  return stanzas;
}

function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stanzaKey(stanza: string[]): string {
  return stanza.map(normalizeLine).join(' / ');
}

/** The refrain is the stanza whose (normalized) content appears more than once,
 *  or failing that, the stanza containing the single most-repeated line. */
function findRefrain(stanzas: string[][]): string | null {
  const counts = new Map<string, number>();
  for (const s of stanzas) {
    const key = stanzaKey(s);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  if (best) return best;

  // fall back to most repeated single line
  const lineCounts = new Map<string, number>();
  for (const s of stanzas) {
    for (const line of s) {
      const key = normalizeLine(line);
      if (key.length < 4) continue;
      lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
    }
  }
  let bestLine: string | null = null;
  let bestLineCount = 1;
  for (const [key, count] of lineCounts) {
    if (count > bestLineCount) {
      bestLine = key;
      bestLineCount = count;
    }
  }
  if (bestLine) {
    for (const s of stanzas) {
      if (s.some((l) => normalizeLine(l) === bestLine)) return stanzaKey(s);
    }
  }
  return null;
}
