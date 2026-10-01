/**
 * Rhyme & meter (chhand / behr) analysis for Hindi–Urdu poetry,
 * in Devanagari or Roman script.
 *
 * Meter is measured in matras the way Hindi chhand-shastra counts them:
 * laghu (short) syllable = 1, guru (long/closed) syllable = 2.
 * Counts are approximations — schwa deletion and gaayaki liberties mean a
 * singer can absorb ±1 matra easily, so only larger deviations are flagged.
 */

export interface Syllable {
  onset: string;
  nucleus: string;
  coda: string;
  weight: 1 | 2;
}

export interface LineProsody {
  text: string;
  matras: number;
  syllableCount: number;
  /** normalized ending sound used for rhyme, e.g. "ge", "aar" */
  rime: string;
  lastWord: string;
  rhymeLetter: string; // A, B, C... within the stanza
}

export interface StanzaProsody {
  index: number;
  lines: LineProsody[];
  scheme: string;
  matraCounts: number[];
  dominantMatra: number;
  chhand: string | null;
  radif: string | null;
  qaafiya: string | null;
  issues: string[];
  notes: string[];
}

export interface PoemProsody {
  stanzas: StanzaProsody[];
  verdict: string;
  issueCount: number;
}

/* ------------------------------------------------------------------ */
/*  Devanagari syllabifier                                             */
/* ------------------------------------------------------------------ */

const DEV_CONS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'झ़': 'zh',
  'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
};

const DEV_IND_VOWEL: Record<string, { ph: string; w: 1 | 2 }> = {
  'अ': { ph: 'a', w: 1 }, 'आ': { ph: 'aa', w: 2 }, 'इ': { ph: 'i', w: 1 },
  'ई': { ph: 'ii', w: 2 }, 'उ': { ph: 'u', w: 1 }, 'ऊ': { ph: 'uu', w: 2 },
  'ऋ': { ph: 'ri', w: 1 }, 'ए': { ph: 'e', w: 2 }, 'ऐ': { ph: 'ai', w: 2 },
  'ओ': { ph: 'o', w: 2 }, 'औ': { ph: 'au', w: 2 }, 'ऍ': { ph: 'e', w: 1 },
  'ऑ': { ph: 'o', w: 2 },
};

const DEV_MATRA: Record<string, { ph: string; w: 1 | 2 }> = {
  'ा': { ph: 'aa', w: 2 }, 'ि': { ph: 'i', w: 1 }, 'ी': { ph: 'ii', w: 2 },
  'ु': { ph: 'u', w: 1 }, 'ू': { ph: 'uu', w: 2 }, 'ृ': { ph: 'ri', w: 1 },
  'े': { ph: 'e', w: 2 }, 'ै': { ph: 'ai', w: 2 }, 'ो': { ph: 'o', w: 2 },
  'ौ': { ph: 'au', w: 2 }, 'ॉ': { ph: 'o', w: 2 }, 'ॅ': { ph: 'e', w: 1 },
};

const HALANT = '\u094D';
const ANUSVARA = '\u0902';
const CHANDRABINDU = '\u0901';
const VISARGA = '\u0903';
const NUKTA = '\u093C';

function syllabifyDevanagari(word: string): Syllable[] {
  const sylls: Syllable[] = [];
  let onsetAcc = '';
  const chars = [...word.normalize('NFC')];
  let i = 0;

  const push = (onset: string, nucleus: string, w: 1 | 2) => {
    sylls.push({ onset, nucleus, coda: '', weight: w });
  };

  while (i < chars.length) {
    let ch = chars[i];
    // fold nukta into the consonant
    if (chars[i + 1] === NUKTA) {
      ch = ch + NUKTA;
      i += 1;
    }
    const cons = DEV_CONS[ch] ?? DEV_CONS[ch.normalize('NFC')];

    if (cons !== undefined) {
      const next = chars[i + 1];
      if (next === HALANT) {
        // conjunct: consonant joins the next syllable's onset,
        // and the preceding syllable becomes guru
        onsetAcc += cons;
        if (sylls.length > 0) sylls[sylls.length - 1].weight = 2;
        i += 2;
        continue;
      }
      const matra = next !== undefined ? DEV_MATRA[next] : undefined;
      if (matra) {
        push(onsetAcc + cons, matra.ph, matra.w);
        onsetAcc = '';
        i += 2;
        continue;
      }
      const isLast = i === chars.length - 1;
      if (isLast && sylls.length > 0) {
        // word-final bare consonant: schwa deletion → coda of previous syllable
        const last = sylls[sylls.length - 1];
        last.coda += cons;
        last.weight = 2;
        i += 1;
        continue;
      }
      // inherent schwa
      push(onsetAcc + cons, 'a', 1);
      onsetAcc = '';
      i += 1;
      continue;
    }

    const vowel = DEV_IND_VOWEL[ch];
    if (vowel) {
      push(onsetAcc, vowel.ph, vowel.w);
      onsetAcc = '';
      i += 1;
      continue;
    }

    if (ch === ANUSVARA || ch === CHANDRABINDU) {
      if (sylls.length > 0) {
        const last = sylls[sylls.length - 1];
        last.coda += 'n';
        if (ch === ANUSVARA) last.weight = 2; // chandrabindu nasalizes without adding weight
      }
      i += 1;
      continue;
    }
    if (ch === VISARGA) {
      if (sylls.length > 0) {
        const last = sylls[sylls.length - 1];
        last.coda += 'h';
        last.weight = 2;
      }
      i += 1;
      continue;
    }
    i += 1; // skip anything else (digits, ZWJ, avagraha...)
  }
  return sylls;
}

/* ------------------------------------------------------------------ */
/*  Roman (transliterated Hindi) syllabifier                           */
/* ------------------------------------------------------------------ */

const ROMAN_LONG_V = new Set(['aa', 'ai', 'au', 'ee', 'ei', 'ii', 'oo', 'ou', 'uu', 'e', 'o']);
const ROMAN_V_DIGRAPHS = ['aa', 'ai', 'au', 'ee', 'ei', 'ii', 'oo', 'ou', 'uu'];
const ROMAN_C_DIGRAPHS = ['chh', 'bh', 'ch', 'dh', 'gh', 'jh', 'kh', 'ph', 'sh', 'th', 'zh'];

type Unit = { type: 'C' | 'V'; ph: string };

function tokenizeRoman(word: string): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  const s = word.toLowerCase();
  while (i < s.length) {
    let matched = false;
    for (const vd of ROMAN_V_DIGRAPHS) {
      if (s.startsWith(vd, i)) {
        units.push({ type: 'V', ph: vd });
        i += vd.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if ('aeiou'.includes(s[i])) {
      units.push({ type: 'V', ph: s[i] });
      i += 1;
      continue;
    }
    for (const cd of ROMAN_C_DIGRAPHS) {
      if (s.startsWith(cd, i)) {
        units.push({ type: 'C', ph: cd });
        i += cd.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (/[a-z]/.test(s[i])) {
      units.push({ type: 'C', ph: s[i] });
    }
    i += 1;
  }
  return units;
}

function syllabifyRoman(word: string): Syllable[] {
  const units = tokenizeRoman(word);
  const sylls: Syllable[] = [];
  let onset: string[] = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.type === 'C') {
      onset.push(u.ph);
      continue;
    }
    // vowel: close the syllable
    const weight: 1 | 2 = ROMAN_LONG_V.has(u.ph) ? 2 : 1;
    sylls.push({ onset: onset.join(''), nucleus: u.ph, coda: '', weight });
    onset = [];
  }

  // distribute trailing/intervocalic consonants as codas
  // rebuild pass: walk again to assign codas for clusters
  if (sylls.length === 0) return sylls;

  // Count consonant units between vowels to decide closed syllables
  let sylIdx = -1;
  let consRun: string[] = [];
  const flushRun = (isEnd: boolean) => {
    if (sylIdx >= 0 && consRun.length > 0) {
      const keepForNextOnset = isEnd ? 0 : 1;
      const codaUnits = consRun.slice(0, consRun.length - keepForNextOnset);
      if (codaUnits.length > 0) {
        sylls[sylIdx].coda = codaUnits.join('');
        sylls[sylIdx].weight = 2;
      }
    }
    consRun = [];
  };
  for (const u of units) {
    if (u.type === 'V') {
      flushRun(false);
      sylIdx += 1;
    } else if (sylIdx >= 0) {
      consRun.push(u.ph);
    }
  }
  flushRun(true);
  return sylls;
}

/* ------------------------------------------------------------------ */
/*  Line analysis                                                      */
/* ------------------------------------------------------------------ */

const DEVANAGARI_RE = /[\u0900-\u097F]/;

function cleanWord(w: string): string {
  return w.replace(/[।|,.!?;:'"“”‘’()\[\]{}~*_\-–—]/g, '').trim();
}

export function syllabifyWord(word: string): Syllable[] {
  const w = cleanWord(word);
  if (!w) return [];
  return DEVANAGARI_RE.test(w) ? syllabifyDevanagari(w) : syllabifyRoman(w);
}

function syllableText(syllable: Syllable): string {
  return `${syllable.onset}${syllable.nucleus}${syllable.coda}`;
}

const SIMPLE_ONSETS = new Set([
  'k', 'kh', 'g', 'gh', 'n', 'ch', 'chh', 'j', 'jh',
  't', 'th', 'd', 'dh', 'p', 'ph', 'b', 'bh', 'm',
  'y', 'r', 'l', 'v', 'sh', 's', 'h', 'q', 'z', 'zh', 'f',
]);

function isSimpleOnset(onset: string): boolean {
  return SIMPLE_ONSETS.has(onset);
}

const SPOKEN_HINDI: Record<string, string> = {
  कहा: 'ka-ha',
  यह: 'yeh',
  वह: 'woh',
  है: 'hai',
  हैं: 'hain',
  मैं: 'main',
  में: 'mein',
  पे: 'pe',
  नहीं: 'na-hin',
  और: 'aur',
  क्या: 'kya',
  क्यों: 'kyon',
  लिए: 'li-ye',
  गया: 'ga-ya',
  गई: 'ga-yi',
  गये: 'ga-ye',
  गए: 'ga-ye',
  हुआ: 'hu-a',
  हुई: 'hu-i',
  हुए: 'hu-e',
  मुझे: 'mu-jhe',
  मुझसे: 'mujh-se',
  तुझे: 'tu-jhe',
  तुझसे: 'tujh-se',
  तुमसे: 'tum-se',
  उससे: 'us-se',
  इससे: 'is-se',
  छुपे: 'chhu-pe',
  छुपा: 'chhu-pa',
  छुपी: 'chhu-pi',
};

function spokenToken(token: string, hyphenate: boolean): string {
  const bare = token.replace(/^[^\u0900-\u097F]+|[^\u0900-\u097F]+$/g, '');
  if (bare && SPOKEN_HINDI[bare]) {
    const mapped = hyphenate ? SPOKEN_HINDI[bare] : SPOKEN_HINDI[bare].replace(/-/g, '');
    return token.replace(bare, mapped);
  }
  const syllables = applyHindiSchwaDeletion(syllabifyWord(token));
  if (!syllables.length) return token;
  const parts = syllables.map(syllableText);
  return hyphenate && parts.length > 1 ? parts.join('-') : parts.join('');
}

/** Spoken Hindi schwa deletion: कह → kah, मुझसे → mujhse, not kaha / mujhase. */
function applyHindiSchwaDeletion(syllables: Syllable[]): Syllable[] {
  const out = syllables.map((syllable) => ({ ...syllable }));
  if (out.length > 1) {
    const last = out[out.length - 1];
    if (last.nucleus === 'a' && !last.coda && isSimpleOnset(last.onset)) {
      const previous = out[out.length - 2];
      previous.coda += last.onset;
      previous.weight = 2;
      out.pop();
    }
  }
  for (let index = out.length - 2; index >= 1; index -= 1) {
    const current = out[index];
    const previous = out[index - 1];
    const next = out[index + 1];
    if (current.nucleus !== 'a' || current.coda || !isSimpleOnset(current.onset)) continue;
    if (previous.coda || (next && !isSimpleOnset(next.onset))) continue;
    previous.coda += current.onset;
    previous.weight = 2;
    out.splice(index, 1);
  }
  return out;
}

/** Romanize a Hindi phrase with spoken schwa deletion for singing. */
export function romanizeHindiPhrase(line: string, hyphenate = false): string {
  return line.replace(/[^\s\[\].,!?;:'"“”‘’।|~()]+/g, (token) => {
    if (!DEVANAGARI_RE.test(token)) return token;
    return spokenToken(token, hyphenate);
  });
}

/** Merge long/short vowel pairs so "gayi/gayee" rhyme strongly. */
function normNucleus(n: string, strict: boolean): string {
  const merged: Record<string, string> = { ee: 'ii', ou: 'au', ei: 'ai' };
  let out = merged[n] ?? n;
  if (!strict) {
    const loose: Record<string, string> = { i: 'ii', u: 'uu', a: 'aa' };
    out = loose[out] ?? out;
  }
  return out;
}

/** De-aspirate consonants for loose rhyme comparison (bh ≈ b). */
function normCons(c: string, strict: boolean): string {
  if (strict) return c;
  return c.replace(/([bcdgjkpt])h/g, '$1').replace(/chh/g, 'ch');
}

function rimeOf(sylls: Syllable[], strict: boolean): string {
  if (sylls.length === 0) return '';
  const last = sylls[sylls.length - 1];
  const nucleus = normNucleus(last.nucleus, strict);
  const coda = normCons(last.coda, strict);
  // open final syllable: include its onset so "suna/mana" ≠ "suna/gaya"
  if (coda === '') {
    return normCons(last.onset, strict) + nucleus;
  }
  return nucleus + coda;
}

export function analyzeLine(text: string): Omit<LineProsody, 'rhymeLetter'> {
  const words = text.split(/\s+/).map(cleanWord).filter(Boolean);
  const allSylls: Syllable[] = [];
  let lastWordSylls: Syllable[] = [];
  for (const w of words) {
    const s = syllabifyWord(w);
    allSylls.push(...s);
    if (s.length > 0) lastWordSylls = s;
  }
  return {
    text,
    matras: allSylls.reduce((sum, s) => sum + s.weight, 0),
    syllableCount: allSylls.length,
    rime: rimeOf(lastWordSylls, true),
    lastWord: words[words.length - 1] ?? '',
  };
}

/* ------------------------------------------------------------------ */
/*  Stanza analysis: rhyme scheme, radif, meter, issues                */
/* ------------------------------------------------------------------ */

function looseRime(text: string): string {
  const words = text.split(/\s+/).map(cleanWord).filter(Boolean);
  if (words.length === 0) return '';
  const sylls = syllabifyWord(words[words.length - 1]);
  return rimeOf(sylls, false);
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = nums[0];
  let bestCount = 0;
  for (const [n, c] of counts) {
    if (c > bestCount || (c === bestCount && Math.abs(n - median(nums)) < Math.abs(best - median(nums)))) {
      best = n;
      bestCount = c;
    }
  }
  return best;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function detectChhand(counts: number[]): string | null {
  if (counts.length < 2) return null;
  const within = (arr: number[], target: number, tol = 1) => arr.every((n) => Math.abs(n - target) <= tol);
  const odd = counts.filter((_, i) => i % 2 === 0);
  const even = counts.filter((_, i) => i % 2 === 1);
  if (counts.length >= 2 && within(odd, 13) && within(even, 11)) return 'Doha (दोहा) — 13/11 matras';
  if (counts.length === 2 && within(counts, 24, 2)) return 'Doha-like (दोहा) — 13+11 matras per line';
  if (within(counts, 16)) return 'Chaupai (चौपाई) — 16 matras';
  if (within(counts, 24)) return 'Rola (रोला) — 24 matras';
  if (within(counts, 28)) return 'Saar Chhand (सार छन्द) — 28 matras';
  if (within(counts, 14)) return 'Manharan-like — 14 matras';
  return null;
}

function detectRadif(lines: { text: string; lastWord: string }[]): { radif: string | null; qaafiyaWords: string[] } {
  const wordLists = lines.map((l) =>
    l.text.split(/\s+/).map((w) => cleanWord(w).toLowerCase()).filter(Boolean),
  );
  const lastWords = wordLists.map((ws) => ws[ws.length - 1] ?? '');
  const counts = new Map<string, number>();
  for (const w of lastWords) if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  let radifWord: string | null = null;
  for (const [w, c] of counts) {
    if (c >= 2 && lines.length >= 2 && c >= Math.ceil(lines.length / 2)) radifWord = w;
  }
  if (!radifWord) return { radif: null, qaafiyaWords: [] };

  const radifLines = wordLists.filter((ws) => ws[ws.length - 1] === radifWord);
  // identical whole lines are a refrain (mukhda), not a radif
  const joined = radifLines.map((ws) => ws.join(' '));
  if (joined.every((l) => l === joined[0])) return { radif: null, qaafiyaWords: [] };
  // extend the radif backwards while all matching lines share the same word
  // and at least one word remains before it (the qaafiya); cap at 3 words
  let depth = 1;
  while (
    depth < 3 &&
    radifLines.every((ws) => ws.length > depth + 1 && ws[ws.length - 1 - depth] === radifLines[0][radifLines[0].length - 1 - depth])
  ) {
    depth += 1;
  }
  const radif = radifLines[0].slice(radifLines[0].length - depth).join(' ');
  const qaafiyaWords = radifLines
    .map((ws) => ws[ws.length - 1 - depth])
    .filter((w): w is string => Boolean(w));
  return { radif, qaafiyaWords };
}

export function analyzeStanza(lines: string[], index: number): StanzaProsody {
  const analyzed = lines.map((l) => analyzeLine(l));
  const looseRimes = lines.map((l) => looseRime(l));

  // rhyme letters via loose rhyme classes
  const letters: string[] = [];
  const classMap = new Map<string, string>();
  let nextLetter = 0;
  for (const r of looseRimes) {
    if (!classMap.has(r)) {
      classMap.set(r, String.fromCharCode(65 + nextLetter));
      nextLetter += 1;
    }
    letters.push(classMap.get(r)!);
  }

  const matraCounts = analyzed.map((a) => a.matras);
  const dominant = mode(matraCounts);
  const chhand = detectChhand(matraCounts);
  const { radif, qaafiyaWords } = detectRadif(analyzed);

  const issues: string[] = [];
  const notes: string[] = [];

  // ---- meter issues ----
  matraCounts.forEach((m, i) => {
    const diff = m - dominant;
    if (Math.abs(diff) >= 2) {
      issues.push(
        `Line ${i + 1} has ${m} matras against the stanza's ${dominant} — ${Math.abs(diff)} ${diff > 0 ? 'over' : 'short'}. ` +
          (diff > 0
            ? 'Consider dropping a filler word or shortening a long vowel.'
            : 'Consider adding a small word (to, hi, re) or stretching a vowel.'),
      );
    } else if (Math.abs(diff) === 1) {
      notes.push(`Line ${i + 1} runs 1 matra ${diff > 0 ? 'heavy' : 'light'} — a singer can absorb this with vowel stretch.`);
    }
  });

  // ---- rhyme issues ----
  const letterCounts = new Map<string, number>();
  for (const L of letters) letterCounts.set(L, (letterCounts.get(L) ?? 0) + 1);
  const hasRepeats = [...letterCounts.values()].some((c) => c >= 2);

  if (lines.length >= 2) {
    if (!hasRepeats) {
      issues.push(
        `No end-rhyme detected in this stanza (endings: ${looseRimes.map((r) => `“-${r}”`).join(', ')}). Fine for free verse (azaad nazm), but songs usually want a rhyming mukhda.`,
      );
    } else {
      letters.forEach((L, i) => {
        if (letterCounts.get(L) === 1) {
          const dominantLetter = [...letterCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
          const targetIdx = letters.findIndex((x) => x === dominantLetter);
          issues.push(
            `Line ${i + 1} (“…${analyzed[i].lastWord}”) doesn't rhyme with the rest — it ends in “-${looseRimes[i]}” while line ${targetIdx + 1} ends in “-${looseRimes[targetIdx]}”.`,
          );
        }
      });
    }
  }

  // radif / qaafiya check
  let qaafiya: string | null = null;
  if (radif) {
    const qRimes = qaafiyaWords.map((w) => rimeOf(syllabifyWord(w), false)).filter(Boolean);
    const allRhyme = qRimes.length >= 2 && qRimes.every((r) => r === qRimes[0]);
    qaafiya = allRhyme ? qRimes[0] : null;
    if (qRimes.length >= 2 && !allRhyme) {
      issues.push(
        `Radif “${radif}” detected, but the qaafiya (word before it) doesn't rhyme consistently: ${qaafiyaWords.join(', ')}.`,
      );
    }
  }

  return {
    index,
    lines: analyzed.map((a, i) => ({ ...a, rhymeLetter: letters[i] })),
    scheme: letters.join(''),
    matraCounts,
    dominantMatra: dominant,
    chhand,
    radif,
    qaafiya: qaafiya ? `-${qaafiya}` : null,
    issues,
    notes,
  };
}

/* ------------------------------------------------------------------ */
/*  Poem analysis                                                      */
/* ------------------------------------------------------------------ */

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
  if (stanzas.length === 1 && stanzas[0].length > 6) {
    const all = stanzas[0];
    const chunked: string[][] = [];
    for (let i = 0; i < all.length; i += 4) chunked.push(all.slice(i, i + 4));
    return chunked;
  }
  return stanzas;
}

export function analyzePoem(text: string): PoemProsody {
  const stanzas = splitStanzas(text).map((lines, i) => analyzeStanza(lines, i));
  const issueCount = stanzas.reduce((n, s) => n + s.issues.length, 0);

  let verdict: string;
  if (stanzas.length === 0) {
    verdict = 'Nothing to analyze yet.';
  } else if (issueCount === 0) {
    verdict = 'Meter is consistent and end-rhymes are clean — this will sit beautifully on a melody.';
  } else if (issueCount <= 2) {
    verdict = `${issueCount} small ${issueCount === 1 ? 'issue' : 'issues'} found. Singable as-is, but fixing them will make the composition tighter.`;
  } else {
    verdict = `${issueCount} issues found across ${stanzas.length} stanza${stanzas.length > 1 ? 's' : ''}. Worth a revision pass — or embrace free verse and lean on the arrangement.`;
  }

  return { stanzas, verdict, issueCount };
}
