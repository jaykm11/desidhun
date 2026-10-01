import type { ChorusSuggestion, Genre, Mood, MoodScore, Raga, Vocal } from '../types';
import { findDetectedMukhda } from './format';

interface ChorusContext {
  script: 'devanagari' | 'roman' | 'mixed';
  moods: MoodScore[];
  raga: Raga;
  genre: Genre;
  vocal: Vocal;
}

interface HookLines {
  first: string;
  second: string;
}

const DEV_HOOKS: Record<Mood, HookLines> = {
  romance: { first: 'दिल की धुन तेरा नाम पुकारे', second: 'हर धड़कन में तेरा रंग उतरे' },
  viraha: { first: 'आ जा पिया, दिल तुझे पुकारे', second: 'सूनी राहों में तेरा नाम सँवरे' },
  devotion: { first: 'तेरे चरणों में मन ये हारे', second: 'तेरी ज्योति से अँधियारा हारे' },
  sufi: { first: 'रूह मेरी तेरा नाम पुकारे', second: 'इश्क़ में हर रंग निखरे' },
  sorrow: { first: 'आँखों में तेरा दर्द उतरे', second: 'टूटा दिल फिर तुझको पुकारे' },
  celebration: { first: 'संग तेरे आज दिल ये नाचे', second: 'रंगों में हर सपना साचे' },
  monsoon: { first: 'बरसे बादल, मनवा तरसे', second: 'तेरी याद की बूँदें बरसें' },
  night: { first: 'चाँदनी में तेरा नाम पुकारे', second: 'रात हमारी धुन सँवारे' },
  dawn: { first: 'नई किरण तेरे रंग में जागे', second: 'मन का सूरज संग तेरे लागे' },
  patriotic: { first: 'माटी का हर रंग पुकारे', second: 'देश की धुन दिल में उतरे' },
  philosophical: { first: 'चलते चलें, ये राह पुकारे', second: 'हर मोड़ नया अर्थ सँवारे' },
  energetic: { first: 'दिल में जोश नया जग जाए', second: 'हर कदम अब गीत बनाए' },
  folk: { first: 'ढोलक बोले, मनवा नाचे', second: 'सजना संग हर रुत साचे' },
};

const ROMAN_HOOKS: Record<Mood, HookLines> = {
  romance: { first: 'Dil ki dhun tera naam pukaare', second: 'Har dhadkan mein tera rang utare' },
  viraha: { first: 'Aa ja piya, dil tujhe pukaare', second: 'Sooni raahon mein tera naam sanware' },
  devotion: { first: 'Tere charanon mein man yeh haare', second: 'Teri jyoti se andhiyaara haare' },
  sufi: { first: 'Rooh meri tera naam pukaare', second: 'Ishq mein har rang nikhare' },
  sorrow: { first: 'Aankhon mein tera dard utare', second: 'Toota dil phir tujhko pukaare' },
  celebration: { first: 'Sang tere aaj dil yeh naache', second: 'Rangon mein har sapna saache' },
  monsoon: { first: 'Barse baadal, manwa tarse', second: 'Teri yaad ki boondein barse' },
  night: { first: 'Chaandni mein tera naam pukaare', second: 'Raat hamaari dhun sanware' },
  dawn: { first: 'Nayi kiran tere rang mein jaage', second: 'Man ka sooraj sang tere laage' },
  patriotic: { first: 'Maati ka har rang pukaare', second: 'Desh ki dhun dil mein utare' },
  philosophical: { first: 'Chalte chalein, yeh raah pukaare', second: 'Har mod naya arth sanware' },
  energetic: { first: 'Dil mein josh naya jag jaaye', second: 'Har kadam ab geet banaaye' },
  folk: { first: 'Dholak bole, manwa naache', second: 'Sajna sang har rut saache' },
};

function firstPoemLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
}

function selectedMood(moods: MoodScore[]): Mood {
  return moods[0]?.mood ?? 'romance';
}

function cleanAnchor(text: string): string {
  const line = firstPoemLine(text);
  return line.length > 84 ? line.slice(0, 84).replace(/\s+\S*$/, '') : line;
}

/**
 * Builds hooks from the poet's own anchor and the selected raga's emotional
 * character. Reference recordings guide mood and arrangement only; no lyrics
 * or recognizable phrasing from them are used here.
 */
export function buildChorusSuggestions(text: string, ctx: ChorusContext): ChorusSuggestion[] {
  const mukhda = findDetectedMukhda(text);
  const mood = selectedMood(ctx.moods);
  const hooks = ctx.script === 'roman' ? ROMAN_HOOKS[mood] : DEV_HOOKS[mood];
  const anchor = cleanAnchor(text) || hooks.first;
  const suggestions: ChorusSuggestion[] = [];

  if (mukhda) {
    suggestions.push({
      id: 'detected-mukhda',
      title: 'Detected Mukhda',
      description: 'Your repeated line/stanza is already the strongest natural chorus.',
      lyrics: ['[Chorus - mukhda, full emotion]', ...mukhda].join('\n'),
      arrangementNote: `Repeat the final line after a ${ctx.raga.name} melodic rise; add harmonies on the second pass.`,
      source: 'from-poem',
    });
  }

  suggestions.push({
    id: 'raga-hook',
    title: `${ctx.raga.name} Hook`,
    description: `A concise original hook shaped for ${ctx.raga.name}'s ${ctx.raga.rasa.toLowerCase()} character.`,
    lyrics: [
      '[Chorus - suggested original hook]',
      anchor,
      hooks.first,
      anchor,
      hooks.second,
    ].join('\n'),
    arrangementNote: `Hold the final word of “${anchor}” with a gentle meend, then resolve into the mukhda on the next cycle.`,
    source: 'original-suggestion',
  });

  const duetLabels = ctx.vocal === 'duet'
    ? ctx.script === 'roman'
      ? ['[Male]', '[Female]']
      : ['[पुरुष]', '[महिला]']
    : ['', ''];

  suggestions.push({
    id: 'call-response',
    title: ctx.vocal === 'duet' ? 'Call & Response Chorus' : 'Echo Chorus',
    description: ctx.vocal === 'duet'
      ? `A duet-friendly exchange in the ${ctx.genre.name} arrangement.`
      : `An echo-style chorus that lets the melody breathe in ${ctx.genre.name}.`,
    lyrics: [
      '[Chorus - suggested original call and response]',
      `${duetLabels[0]} ${anchor}`.trim(),
      `${duetLabels[1]} ${hooks.first}`.trim(),
      `${duetLabels[0]} ${anchor}`.trim(),
      `${duetLabels[1]} ${hooks.second}`.trim(),
    ].join('\n'),
    arrangementNote: ctx.vocal === 'duet'
      ? 'Let the two voices overlap only on the last phrase, then land together on Sa.'
      : 'Sing the second and fourth lines as soft backing-vocal echoes.',
    source: 'original-suggestion',
  });

  return suggestions;
}
