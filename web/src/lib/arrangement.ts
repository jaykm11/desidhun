import type {
  ArrangementSection,
  Genre,
  MoodScore,
  MusicArrangement,
  Raga,
  Tempo,
  Vocal,
} from '../types';
import { productionTreatment } from './productionVariation';

interface RagaProfile {
  alapLead: string;
  lead: string[];
  support: string[];
  percussion: string[];
  taals: Record<Exclude<Tempo, 'auto'>, string>;
  color: string;
  mix: string[];
}

const PROFILES: Record<string, RagaProfile> = {
  yaman: {
    alapLead: 'bansuri answering a soft sitar alap',
    lead: ['sitar', 'bansuri flute'],
    support: ['santoor', 'warm violin ensemble'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Ektaal (12 beats)', medium: 'madhya Teentaal (16 beats)', fast: 'light Keharwa (8 beats)' },
    color: 'luminous teevra-Ma glides, never rushed',
    mix: ['leave a long tail on flute phrases', 'let strings enter only after the first chorus'],
  },
  bhairavi: {
    alapLead: 'sarangi in a plaintive free-rhythm alap',
    lead: ['sarangi', 'bansuri flute'],
    support: ['harmonium', 'soft cello'],
    percussion: ['tabla', 'gentle manjira'],
    taals: { slow: 'vilambit Dadra (6 beats)', medium: 'Dadra (6 beats)', fast: 'light Keharwa (8 beats)' },
    color: 'sweet komal-swara bends with a farewell-like descent',
    mix: ['keep sarangi close and intimate', 'avoid dense low-end percussion'],
  },
  bhimpalasi: {
    alapLead: 'bansuri exploring the Ma-centered resting phrases',
    lead: ['bansuri flute', 'sarangi'],
    support: ['tanpura', 'muted santoor'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Jhaptal (10 beats)', medium: 'Dadra (6 beats)', fast: 'Keharwa (8 beats)' },
    color: 'late-afternoon longing with tender komal Ga and Ni',
    mix: ['give vocal phrases room before each sarangi answer', 'keep the chorus warmer than the verses'],
  },
  darbari: {
    alapLead: 'low sarangi with very slow andolan on komal Ga and Dha',
    lead: ['sarangi', 'bass-register sitar'],
    support: ['tanpura', 'cello'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Jhumra (14 beats)', medium: 'slow Teentaal (16 beats)', fast: 'restrained Keharwa (8 beats)' },
    color: 'deep midnight gravity and regal restraint',
    mix: ['keep the arrangement sparse below the vocal', 'use silence before chorus entries'],
  },
  malkauns: {
    alapLead: 'rudra veena or low santoor strokes over a deep tanpura',
    lead: ['rudra veena', 'bansuri flute'],
    support: ['tanpura', 'low cello drone'],
    percussion: ['pakhawaj', 'tabla'],
    taals: { slow: 'vilambit Jhaptal (10 beats)', medium: 'Chautaal-inspired 12-beat pulse', fast: 'measured Teentaal (16 beats)' },
    color: 'hypnotic pentatonic depth with weight on each note',
    mix: ['favor low-mid warmth over bright highs', 'reserve pakhawaj for the chorus lift'],
  },
  pahadi: {
    alapLead: 'bansuri with a light folk-sitar pickup',
    lead: ['bansuri flute', 'mandolin or acoustic guitar'],
    support: ['santoor', 'light strings'],
    percussion: ['dholak', 'tabla'],
    taals: { slow: 'slow Dadra (6 beats)', medium: 'Keharwa (8 beats)', fast: 'upbeat Keharwa (8 beats)' },
    color: 'breezy Himalayan folk lilt',
    mix: ['pan flute and mandolin gently apart', 'keep dholak dry and close'],
  },
  khamaj: {
    alapLead: 'sitar and sarangi in playful thumri-style exchanges',
    lead: ['sitar', 'sarangi'],
    support: ['harmonium', 'bansuri flute'],
    percussion: ['tabla', 'dholak'],
    taals: { slow: 'Dadra (6 beats)', medium: 'Dadra (6 beats)', fast: 'Keharwa (8 beats)' },
    color: 'playful, flirtatious thumri ornamentation',
    mix: ['use quick sarangi responses only at line endings', 'let dholak join on the second chorus'],
  },
  desh: {
    alapLead: 'bansuri tracing a monsoon-like ascent over tanpura',
    lead: ['bansuri flute', 'sitar'],
    support: ['santoor', 'violin ensemble'],
    percussion: ['tabla', 'dholak'],
    taals: { slow: 'slow Keharwa (8 beats)', medium: 'Keharwa (8 beats)', fast: 'driving Keharwa (8 beats)' },
    color: 'swaying monsoon warmth and open-hearted lift',
    mix: ['use santoor droplets between vocal lines', 'let strings widen only at the final chorus'],
  },
  megh: {
    alapLead: 'bansuri and low tanpura with rumbling Re–Ma meends',
    lead: ['bansuri flute', 'santoor'],
    support: ['sarangi', 'deep ambient drone'],
    percussion: ['tabla', 'pakhawaj accents'],
    taals: { slow: 'slow Rupak (7 beats)', medium: 'Rupak (7 beats)', fast: 'Keharwa with thunder-like accents (8 beats)' },
    color: 'rainfall cascades and distant thunder without literal sound effects',
    mix: ['use santoor sparingly as rain droplets', 'keep the first verse nearly percussion-free'],
  },
  bageshri: {
    alapLead: 'sarangi outlining the Ma–Dha axis in the low register',
    lead: ['sarangi', 'bansuri flute'],
    support: ['tanpura', 'soft piano felt layer'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Jhaptal (10 beats)', medium: 'Dadra (6 beats)', fast: 'light Keharwa (8 beats)' },
    color: 'midnight yearning, tender but never theatrical',
    mix: ['keep vocals front-most and close-miked', 'fade flute in after the verse ending'],
  },
  pilu: {
    alapLead: 'harmonium and sarangi in an expressive light-classical prelude',
    lead: ['harmonium', 'sarangi'],
    support: ['sitar', 'bansuri flute'],
    percussion: ['tabla', 'dholak'],
    taals: { slow: 'Dadra (6 beats)', medium: 'Dadra (6 beats)', fast: 'Keharwa (8 beats)' },
    color: 'mishra-raga playfulness with bittersweet turns',
    mix: ['allow ornamented vocal turns to lead', 'keep harmonium as a cushion, not a lead wall'],
  },
  shivranjani: {
    alapLead: 'lonely bansuri on the pentatonic scale',
    lead: ['bansuri flute', 'sarangi'],
    support: ['cello', 'soft piano'],
    percussion: ['tabla'],
    taals: { slow: 'slow Dadra (6 beats)', medium: 'Dadra (6 beats)', fast: 'restrained Keharwa (8 beats)' },
    color: 'haunting pentatonic ache with a clean, memorable contour',
    mix: ['use a wide but quiet reverb on bansuri', 'do not over-orchestrate the verse'],
  },
  charukeshi: {
    alapLead: 'violin and sitar unfolding the bright-to-dark scale contrast',
    lead: ['violin', 'sitar'],
    support: ['santoor', 'cello'],
    percussion: ['tabla', 'mridangam accents'],
    taals: { slow: 'slow Adi-inspired 8-beat cycle', medium: 'Adi-inspired 8-beat cycle', fast: 'energetic 8-beat cycle' },
    color: 'bittersweet major-minor drama',
    mix: ['let violin carry the ascent and cello the descent', 'expand harmony only under the chorus'],
  },
  kirwani: {
    alapLead: 'violin in a cinematic harmonic-minor alap',
    lead: ['violin', 'sitar'],
    support: ['cello', 'soft piano'],
    percussion: ['tabla', 'subtle frame drum'],
    taals: { slow: 'slow Rupak (7 beats)', medium: 'Rupak (7 beats)', fast: 'Teentaal (16 beats)' },
    color: 'lush night-time melancholy with cinematic contour',
    mix: ['use cello ostinato only after the first chorus', 'keep piano felted and minimal'],
  },
  bhairav: {
    alapLead: 'rudra veena and bansuri with solemn komal Re and Dha oscillations',
    lead: ['rudra veena', 'bansuri flute'],
    support: ['tanpura', 'harmonium'],
    percussion: ['tabla', 'pakhawaj'],
    taals: { slow: 'vilambit Ektaal (12 beats)', medium: 'Jhaptal (10 beats)', fast: 'measured Teentaal (16 beats)' },
    color: 'austere dawn stillness, like distant temple bells',
    mix: ['start with drone alone', 'use pakhawaj only for devotional emphasis'],
  },
  ahirbhairav: {
    alapLead: 'bansuri over a gentle folk-tinged dawn drone',
    lead: ['bansuri flute', 'harmonium'],
    support: ['ektara', 'sarangi'],
    percussion: ['tabla', 'manjira'],
    taals: { slow: 'slow Dadra (6 beats)', medium: 'Keharwa (8 beats)', fast: 'light Keharwa (8 beats)' },
    color: 'tender morning hope with folk sweetness',
    mix: ['keep ektara understated', 'bring manjira in only for the final refrain'],
  },
  jaijaiwanti: {
    alapLead: 'sarangi shaping the signature sighing phrase',
    lead: ['sarangi', 'sitar'],
    support: ['bansuri flute', 'tanpura'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Ektaal (12 beats)', medium: 'Teentaal (16 beats)', fast: 'light Teentaal (16 beats)' },
    color: 'regal romance with intricate, gently complaining turns',
    mix: ['let sarangi answer each mukhda line', 'avoid thick orchestration'],
  },
  todi: {
    alapLead: 'sarangi moving slowly through plaintive Todi ornaments',
    lead: ['sarangi', 'bansuri flute'],
    support: ['tanpura', 'harmonium'],
    percussion: ['tabla'],
    taals: { slow: 'vilambit Jhumra (14 beats)', medium: 'Jhaptal (10 beats)', fast: 'Teentaal (16 beats)' },
    color: 'morning supplication with delicate tension',
    mix: ['keep all phrasing spacious', 'place percussion late and quietly'],
  },
  kafi: {
    alapLead: 'bansuri opening into earthy folk phrases',
    lead: ['bansuri flute', 'sitar'],
    support: ['harmonium', 'ektara'],
    percussion: ['dholak', 'tabla'],
    taals: { slow: 'slow Keharwa (8 beats)', medium: 'Keharwa (8 beats)', fast: 'lively Keharwa (8 beats)' },
    color: 'earthy festive folk color with komal Ga and Ni',
    mix: ['dholak leads the groove', 'use group claps in the final chorus only'],
  },
  bihag: {
    alapLead: 'sitar sparkle with santoor replies',
    lead: ['sitar', 'santoor'],
    support: ['violin ensemble', 'bansuri flute'],
    percussion: ['tabla'],
    taals: { slow: 'slow Teentaal (16 beats)', medium: 'Teentaal (16 beats)', fast: 'bright Keharwa (8 beats)' },
    color: 'auspicious night romance with a shining upper register',
    mix: ['let santoor announce the chorus', 'use strings as a gentle halo, not a wall'],
  },
  hamsadhwani: {
    alapLead: 'bright violin or veena invocation',
    lead: ['violin', 'veena'],
    support: ['bansuri flute', 'tanpura'],
    percussion: ['mridangam', 'tabla'],
    taals: { slow: 'slow Adi tala (8 beats)', medium: 'Adi tala (8 beats)', fast: 'brisk Adi tala (8 beats)' },
    color: 'bright auspicious pentatonic energy',
    mix: ['keep attacks clear and clean', 'use mridangam for lift without overpowering the vocal'],
  },
  mand: {
    alapLead: 'kamaicha or ravanhatta over a desert-like drone',
    lead: ['kamaicha', 'bansuri flute'],
    support: ['sitar', 'harmonium'],
    percussion: ['dholak', 'khartal'],
    taals: { slow: 'slow Dadra (6 beats)', medium: 'Rajasthani Keharwa (8 beats)', fast: 'lively Rajasthani Keharwa (8 beats)' },
    color: 'open-throated Rajasthani desert sway',
    mix: ['place khartal wide but soft', 'allow kamaicha phrases to answer the vocal'],
  },
};

function profileFor(raga: Raga): RagaProfile {
  if (PROFILES[raga.id]) return PROFILES[raga.id];

  const moods = raga.moods;
  if (moods.monsoon || moods.folk) {
    return {
      alapLead: 'bansuri tracing the raga’s characteristic phrases over tanpura',
      lead: ['bansuri flute', 'sitar'],
      support: ['santoor', 'harmonium'],
      percussion: ['tabla', 'dholak'],
      taals: { slow: 'slow Dadra (6 beats)', medium: 'Keharwa (8 beats)', fast: 'lively Keharwa (8 beats)' },
      color: `${raga.name}'s earthy melodic contour and folk-tinged ornaments`,
      mix: ['keep the melodic phrases distinct from the vocal', 'let percussion enter gradually after the first verse'],
    };
  }
  if (moods.devotion || moods.dawn || moods.philosophical) {
    return {
      alapLead: 'a spacious tanpura-and-bansuri alap using the raga’s signature notes',
      lead: ['bansuri flute', 'sarangi'],
      support: ['tanpura', 'harmonium'],
      percussion: ['tabla', 'manjira'],
      taals: { slow: 'vilambit Ektaal (12 beats)', medium: 'Jhaptal (10 beats)', fast: 'measured Teentaal (16 beats)' },
      color: `${raga.name}'s contemplative, prayerful character`,
      mix: ['begin with drone and melody alone', 'leave generous silence around the vocal phrasing'],
    };
  }
  return {
    alapLead: 'sarangi and sitar introducing the raga’s signature melodic movement',
    lead: ['sarangi', 'sitar'],
    support: ['tanpura', 'soft violin ensemble'],
    percussion: ['tabla'],
    taals: { slow: 'slow Dadra (6 beats)', medium: 'Teentaal (16 beats)', fast: 'light Keharwa (8 beats)' },
    color: `${raga.name}'s characteristic melodic colour without borrowing another raga’s phrases`,
    mix: ['keep the lead instrument in conversation with the singer', 'add supporting strings only at emotional lifts'],
  };
}

function bpmFor(tempo: Exclude<Tempo, 'auto'>): string {
  if (tempo === 'slow') return '64–74 BPM';
  if (tempo === 'fast') return '116–128 BPM';
  return '88–100 BPM';
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function sectionCues(profile: RagaProfile, tempo: Exclude<Tempo, 'auto'>, taal: string): ArrangementSection[] {
  return [
    {
      section: 'Intro / Alap',
      instruments: ['tanpura drone', profile.alapLead],
      direction: `Free rhythm for 8–16 bars; establish ${profile.color} before the groove enters.`,
    },
    {
      section: 'Verse / Antara',
      instruments: unique([profile.lead[0], ...profile.support.slice(0, 1), `very light ${profile.percussion[0]}`]),
      direction: `Keep the ${taal} cycle understated; leave an instrumental answer after every second vocal line.`,
    },
    {
      section: 'Chorus / Mukhda',
      instruments: unique([...profile.lead, ...profile.support.slice(0, 2), ...profile.percussion]),
      direction: `Bring the full ${tempo} arrangement in; double the final mukhda phrase with a short instrumental response.`,
    },
    {
      section: 'Sargam / Interlude',
      instruments: unique([profile.lead[0], profile.support[0], ...profile.percussion.slice(0, 1)]),
      direction: 'Trade short sargam phrases between voice and lead instrument; avoid a busy solo over the lyric.',
    },
    {
      section: 'Outro',
      instruments: ['tanpura drone', profile.lead[0]],
      direction: 'Strip the pulse away and resolve with a slow descending phrase into silence.',
    },
  ];
}

interface ContemporaryArrangementProfile {
  lead: string[];
  support: string[];
  percussion: string[];
  groove: Record<Exclude<Tempo, 'auto'>, string>;
  bpm: Record<Exclude<Tempo, 'auto'>, string>;
  intro: string;
  verse: string;
  chorus: string;
  bridge: string;
  outro: string;
  mix: string[];
}

const CONTEMPORARY_PROFILES: Record<string, ContemporaryArrangementProfile> = {
  afrobeats: {
    lead: ['clean guitar plucks', 'vocal hook'],
    support: ['round electric bass', 'log drum', 'subtle bansuri phrases'],
    percussion: ['Afrobeats percussion', 'shaker', 'rim clicks'],
    groove: { slow: 'laid-back Afrobeats pocket', medium: 'syncopated Afrobeats bounce', fast: 'high-energy Afrobeats drive' },
    bpm: { slow: '88–94 BPM', medium: '98–108 BPM', fast: '110–118 BPM' },
    intro: 'Start with guitar plucks and a filtered percussion pickup; bring the vocal hook in after four bars.',
    verse: 'Keep the bass and syncopated percussion light; leave room for the rhythmic vocal phrasing.',
    chorus: 'Open the groove with log drum and backing responses; keep the hook danceable and uncluttered.',
    bridge: 'Pull the kick back for a short vocal-and-percussion break before the final hook.',
    outro: 'Let guitar plucks and percussion resolve beneath the final repeated hook.',
    mix: ['keep the low end rounded and rhythmic, not sub-heavy', 'use short, bright delays on hook responses'],
  },
  'western-pop': {
    lead: ['bright piano', 'electric guitar'],
    support: ['synth bass', 'stacked backing vocals', 'subtle synth pad'],
    percussion: ['punchy pop drums', 'claps'],
    groove: { slow: 'spacious pop pulse', medium: 'driving contemporary pop groove', fast: 'upbeat pop drive' },
    bpm: { slow: '72–82 BPM', medium: '96–108 BPM', fast: '118–128 BPM' },
    intro: 'Open with piano or guitar motif, then tease the chorus melody before drums arrive.',
    verse: 'Use a lean piano-and-bass bed with a clear vocal in front; save the full drums for the lift.',
    chorus: 'Bring in full pop drums, bass, and stacked harmonies for a clean, wide hook.',
    bridge: 'Strip to piano and lead vocal, then build a short riser into the final chorus.',
    outro: 'End on a final title phrase with piano/guitar decay and a clean stop or short tail.',
    mix: ['keep the lead vocal crisp and centered', 'make backing vocals wide only in the chorus'],
  },
  'rnb-neo-soul': {
    lead: ['electric piano', 'muted guitar'],
    support: ['rounded sub bass', 'airy background vocals', 'subtle raga-inspired vocal texture'],
    percussion: ['soft R&B drum kit', 'finger snaps'],
    groove: { slow: 'behind-the-beat neo-soul pocket', medium: 'laid-back R&B groove', fast: 'up-tempo R&B bounce' },
    bpm: { slow: '66–76 BPM', medium: '82–94 BPM', fast: '102–112 BPM' },
    intro: 'Open with electric-piano voicings and a quiet vocal ad-lib; avoid a classical alap or drone.',
    verse: 'Keep drums sparse and behind the beat; let the close-mic lead vocal carry the emotion.',
    chorus: 'Add the full pocket, warm bass, and soft stacked harmonies without turning orchestral.',
    bridge: 'Drop to electric piano and vocal runs, then return with a slightly fuller final hook.',
    outro: 'Let electric piano, breathy ad-libs, and delayed guitar fade naturally.',
    mix: ['keep the vocal intimate and warm with restrained reverb', 'preserve space between bass notes and kick hits'],
  },
  'hip-hop-trap': {
    lead: ['sparse piano motif', 'vocal hook'],
    support: ['dark synth pad', '808 sub bass', 'vocal chops'],
    percussion: ['trap drum kit', 'crisp hi-hats', 'snare/clap'],
    groove: { slow: 'half-time trap pocket', medium: 'head-nod hip-hop groove', fast: 'driving double-time trap energy' },
    bpm: { slow: '70–78 BPM', medium: '86–96 BPM', fast: '130–145 BPM' },
    intro: 'Start with a filtered piano motif, atmosphere, and vocal tag before the beat drops.',
    verse: 'Use a sparse beat and deliberate 808 placement so the rhythmic lyrical flow stays intelligible.',
    chorus: 'Widen the hook with a stronger kick, bass, and vocal doubles; keep the arrangement minimal.',
    bridge: 'Use a brief half-time beat switch or percussion drop before the final hook.',
    outro: 'Leave a final hook or spoken title phrase over the beat, then cut cleanly.',
    mix: ['keep 808 bass mono and controlled', 'leave the midrange clear for Hindi/Urdu consonants'],
  },
  'lofi-chill': {
    lead: ['soft electric piano', 'distant bansuri phrase'],
    support: ['warm synth pad', 'vinyl texture', 'soft bass'],
    percussion: ['lo-fi drum loop', 'brush percussion'],
    groove: { slow: 'unhurried lo-fi pocket', medium: 'gentle chill-electronic groove', fast: 'light upbeat chill groove' },
    bpm: { slow: '64–74 BPM', medium: '78–90 BPM', fast: '96–106 BPM' },
    intro: 'Begin with tape-textured keys and ambient room tone; let one distant melodic phrase set the mood.',
    verse: 'Keep the drum loop filtered and quiet beneath breathy, intimate vocal phrasing.',
    chorus: 'Open the pad and add soft backing whispers while preserving the relaxed late-night feel.',
    bridge: 'Remove the drums for a few bars of keys, texture, and a restrained melodic response.',
    outro: 'Let humming or the title phrase dissolve into tape texture and electric-piano decay.',
    mix: ['soften high frequencies and preserve gentle tape warmth', 'keep all transitions subtle, without dramatic drops'],
  },
};

function rotated<T>(items: readonly T[], seed: number, count: number): T[] {
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(seed + index) % items.length]);
}

function contemporarySections(profile: ContemporaryArrangementProfile, ctx: ArrangementContext): ArrangementSection[] {
  const seed = [...ctx.formattedLyrics].reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, ctx.variationIndex);
  const lead = rotated(profile.lead, seed, Math.min(2, profile.lead.length));
  const support = rotated(profile.support, seed >>> 3, Math.min(2, profile.support.length));
  const percussion = rotated(profile.percussion, seed >>> 6, Math.min(2, profile.percussion.length));
  return [
    { section: 'Intro / Alap', instruments: unique([lead[0], support[0]]), direction: profile.intro },
    { section: 'Verse / Antara', instruments: unique([lead[0], support[0], `light ${percussion[0]}`]), direction: profile.verse },
    { section: 'Chorus / Mukhda', instruments: unique([...lead, ...support, ...percussion]), direction: profile.chorus },
    { section: 'Sargam / Interlude', instruments: unique([lead.at(-1)!, support.at(-1)!, percussion[0]]), direction: profile.bridge },
    { section: 'Outro', instruments: unique([lead.at(-1)!, support[0]]), direction: profile.outro },
  ];
}

function contemporaryArrangement(ctx: ArrangementContext, profile: ContemporaryArrangementProfile): MusicArrangement {
  const baseSections = contemporarySections(profile, ctx);
  const sections = ctx.script === 'roman' ? westernizeSections(baseSections) : baseSections;
  const mood = ctx.moods.slice(0, 2).map((item) => item.mood).join(' and ') || 'emotional';
  const vocal = ctx.vocal === 'duet'
    ? 'male-female duet with complementary lead parts and a shared hook'
    : `${ctx.vocal} lead vocal, genre-appropriate phrasing`;
  const western = ctx.script === 'roman';
  const productionPrompt = [
    `${ctx.genre.name} production`,
    ...ctx.genre.styleKeywords,
    `${profile.bpm[ctx.tempo]}, ${profile.groove[ctx.tempo]}`,
    `mood: ${mood}`,
    `lead: ${(western ? WESTERN_SECTION_INSTRUMENTS.chorus.slice(0, 2) : profile.lead).join(' and ')}`,
    `support: ${(western ? WESTERN_SECTION_INSTRUMENTS.verse : profile.support).join(', ')}`,
    `rhythm: ${(western ? ['drum kit', 'bass guitar'] : profile.percussion).join(' and ')}`,
    `${vocal}${ctx.voiceStyle ? `, vocal character: ${ctx.voiceStyle}` : ''}`,
    western
      ? 'English-language western pop instrumentation with piano, guitars, bass, drums, and pads; use western solfege instead of Indian sargam'
      : `subtle melodic colour inspired by ${ctx.raga.styleKeywords[0]}`,
    western
      ? 'preserve a western production palette; no tabla, tanpura, sitar, or classical alap unless explicitly requested'
      : `preserve the ${ctx.genre.name} groove; no Bollywood orchestration, tabla, tanpura drone, or classical alap unless explicitly requested`,
    ...profile.mix,
  ].join(', ');

  return {
    title: `${ctx.genre.name} Instrumentation Blueprint`,
    summary: western
      ? `${ctx.genre.name} arrangement with western instruments for English lyrics.`
      : `${ctx.genre.name} arrangement built around ${profile.groove[ctx.tempo]} with ${profile.lead.join(' and ')} and ${profile.percussion.join(' and ')}.`,
    tempoBpm: profile.bpm[ctx.tempo],
    taal: profile.groove[ctx.tempo],
    drone: western ? `Foundation: ${WESTERN_SECTION_INSTRUMENTS.intro.join(' and ')}` : `Foundation: ${profile.support[0]}`,
    melodicLead: western ? [...WESTERN_SECTION_INSTRUMENTS.chorus.slice(0, 2)] : profile.lead,
    supportingInstruments: western ? [...WESTERN_SECTION_INSTRUMENTS.verse] : profile.support,
    rhythmSection: western ? ['drum kit', 'bass guitar'] : profile.percussion,
    mixNotes: profile.mix,
    sections,
    productionPrompt,
    instrumentedLyrics: instrumentLyrics(ctx.formattedLyrics, sections),
  };
}

function instrumentLyrics(formattedLyrics: string, sections: ArrangementSection[]): string {
  const cues = {
    intro: sections[0],
    verse: sections[1],
    chorus: sections[2],
    sargam: sections[3],
    outro: sections[4],
  };

  return formattedLyrics
    .split('\n')
    .flatMap((line) => {
      const lower = line.toLowerCase();
      let cue: ArrangementSection | undefined;
      if (lower.startsWith('[intro') || lower.startsWith('[short instrumental intro')) cue = cues.intro;
      else if (lower.startsWith('[verse')) cue = cues.verse;
      else if (lower.startsWith('[chorus') || lower.startsWith('[final chorus')) cue = cues.chorus;
      else if (lower.startsWith('[sargam') || lower.startsWith('[western sargam') || lower.includes('solfege')) cue = cues.sargam;
      else if (lower.startsWith('[outro')) cue = cues.outro;
      if (!cue || cue.instruments.length === 0) return [line];
      return [line, `[Instruments: ${cue.instruments.join(', ')} — ${cue.direction}]`];
    })
    .join('\n');
}

interface ArrangementContext {
  raga: Raga;
  genre: Genre;
  moods: MoodScore[];
  tempo: Exclude<Tempo, 'auto'>;
  vocal: Vocal;
  voiceStyle?: string;
  formattedLyrics: string;
  variationIndex: number;
  includeInstruments?: boolean;
  script?: 'devanagari' | 'roman' | 'mixed';
}

const WESTERN_SECTION_INSTRUMENTS = {
  intro: ['piano', 'soft synth pad'],
  verse: ['acoustic guitar', 'electric bass', 'light drum kit'],
  chorus: ['piano', 'electric guitar', 'bass guitar', 'full drum kit', 'synth pads'],
  sargam: ['piano', 'string section', 'clean electric guitar'],
  outro: ['piano', 'soft pads', 'light strings'],
} as const;

function westernizeSections(sections: ArrangementSection[]): ArrangementSection[] {
  const map = [
    WESTERN_SECTION_INSTRUMENTS.intro,
    WESTERN_SECTION_INSTRUMENTS.verse,
    WESTERN_SECTION_INSTRUMENTS.chorus,
    WESTERN_SECTION_INSTRUMENTS.sargam,
    WESTERN_SECTION_INSTRUMENTS.outro,
  ];
  return sections.map((section, index) => ({
    ...section,
    instruments: [...(map[index] ?? WESTERN_SECTION_INSTRUMENTS.verse)],
    direction: section.section.toLowerCase().includes('sargam')
      ? section.direction.replace(/sargam/gi, 'western solfege / sargam')
      : section.direction,
  }));
}

export function buildMusicArrangement(ctx: ArrangementContext): MusicArrangement {
  if (!ctx.includeInstruments) {
    return {
      title: `${ctx.genre.name} Vocal Blueprint`,
      summary: 'Voice-only delivery with no musical instruments.',
      tempoBpm: '',
      taal: '',
      drone: '',
      melodicLead: [],
      supportingInstruments: [],
      rhythmSection: [],
      mixNotes: ['No background music or instruments.'],
      sections: [
        { section: 'Intro / Alap', instruments: [], direction: 'Begin with the voice only; no instrumental introduction.' },
        { section: 'Verse / Antara', instruments: [], direction: 'Keep the voice unaccompanied and clear.' },
        { section: 'Chorus / Mukhda', instruments: [], direction: 'Keep the voice unaccompanied; build intensity through delivery only.' },
        { section: 'Sargam / Interlude', instruments: [], direction: 'No instrumental interlude.' },
        { section: 'Outro', instruments: [], direction: 'End with the voice only and no instrumental outro.' },
      ],
      productionPrompt: 'Voice-only delivery. Do not add musical instruments.',
      instrumentedLyrics: ctx.formattedLyrics,
    };
  }
  const contemporaryProfile = CONTEMPORARY_PROFILES[ctx.genre.id];
  if (contemporaryProfile) return contemporaryArrangement(ctx, contemporaryProfile);

  const baseProfile = profileFor(ctx.raga);
  const treatment = productionTreatment(ctx.variationIndex);
  const profile: RagaProfile = {
    ...baseProfile,
    support: unique([...baseProfile.support, ...treatment.supportingInstruments]),
    percussion: unique([...baseProfile.percussion, ...treatment.rhythmAdditions]),
    mix: [...baseProfile.mix, ...treatment.mixNotes],
  };
  const taal = profile.taals[ctx.tempo];
  const baseSections = sectionCues(profile, ctx.tempo, taal);
  const western = ctx.script === 'roman';
  const sections = western ? westernizeSections(baseSections) : baseSections;
  const mood = ctx.moods.slice(0, 2).map((item) => item.mood).join(' and ') || 'emotional';
  const productionPrompt = western
    ? [
        `English-language arrangement inspired by ${ctx.raga.name}`,
        treatment.name,
        `${bpmFor(ctx.tempo)}`,
        `mood: ${mood}`,
        `western instruments: ${WESTERN_SECTION_INSTRUMENTS.chorus.join(', ')}`,
        'use western solfege / sargam for melodic interludes',
        'piano, guitars, bass, drums, and pads — no tabla, tanpura, or sitar unless requested',
        ...(ctx.voiceStyle ? [`vocal character: ${ctx.voiceStyle}`] : []),
      ].join(', ')
    : [
      `Raag ${ctx.raga.name} arranged as ${ctx.genre.name}`,
      treatment.name,
      ...treatment.promptModifiers,
      `${bpmFor(ctx.tempo)}, ${taal}`,
      `mood: ${mood}`,
      `tanpura drone; lead: ${profile.lead.join(' and ')}`,
      `support: ${profile.support.join(', ')}`,
      `rhythm: ${profile.percussion.join(' and ')}`,
      profile.color,
      ctx.vocal === 'duet'
        ? 'male-female call-and-response verses, merge voices only for the mukhda'
        : 'keep lead vocal above every instrumental response',
      ...(ctx.voiceStyle ? [`vocal character: ${ctx.voiceStyle}`] : []),
      'alap intro, sparse verses, full chorus lift, instrumental sargam answer, stripped-down drone outro',
      'authentic meend and murki, no copied song melody or lyrics',
    ].join(', ');

  return {
    title: western
      ? `Western Instrumentation Blueprint · ${treatment.name}`
      : `${ctx.raga.name} Instrumentation Blueprint · ${treatment.name}`,
    summary: western
      ? `${treatment.name} western arrangement with piano, guitars, bass, and drums for English lyrics.`
      : `${treatment.name} ${ctx.genre.name} arrangement centered on ${profile.lead.join(' and ')} with ${profile.percussion.join(' and ')} in ${taal}.`,
    tempoBpm: bpmFor(ctx.tempo),
    taal: western ? 'western pop groove' : taal,
    drone: western
      ? `Foundation: ${WESTERN_SECTION_INSTRUMENTS.intro.join(' and ')}`
      : 'Tanpura tuned to the singer’s comfortable Sa–Pa (or Sa–Ma when the arranger prefers it).',
    melodicLead: western ? [...WESTERN_SECTION_INSTRUMENTS.chorus.slice(0, 2)] : profile.lead,
    supportingInstruments: western
      ? [...WESTERN_SECTION_INSTRUMENTS.verse]
      : unique([...profile.support, ...ctx.genre.instruments.slice(0, 2)]),
    rhythmSection: western ? ['drum kit', 'bass guitar'] : profile.percussion,
    mixNotes: profile.mix,
    sections,
    productionPrompt,
    instrumentedLyrics: instrumentLyrics(ctx.formattedLyrics, sections),
  };
}
