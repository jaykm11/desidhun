interface TagGroup {
  /** Hindi label, then English label. These are shown on the preset. */
  labels: [string, string];
  /** If any of these appear in the title or lyrics, the group is applied. */
  match: string[];
  /** Extra words that should find this audio, including Roman Hindi. */
  aliases?: string[];
}

const GROUPS: readonly TagGroup[] = [
  { labels: ['सुप्रभात', 'good morning'], match: ['सुप्रभात', 'good morning'], aliases: ['suprabhat', 'shubh prabhat'] },
  { labels: ['शुभ रात्रि', 'good night'], match: ['शुभ रात्रि', 'good night'], aliases: ['shubh ratri', 'goodnight'] },
  { labels: ['कैसे हो', 'how are you'], match: ['कैसे हो', 'how are you'], aliases: ['kaise ho'] },
  { labels: ['जन्मदिन', 'birthday'], match: ['जन्मदिन', 'birthday', 'happy returns'], aliases: ['janamdin', 'janmdin', 'happy birthday'] },
  { labels: ['सालगिरह', 'anniversary'], match: ['सालगिरह', 'anniversary'], aliases: ['saalgirah', 'salgirah'] },
  { labels: ['नया साल', 'new year'], match: ['नया साल', 'नए साल', 'new year'], aliases: ['naya saal', 'naya sal', 'happy new year'] },
  { labels: ['दीपावली', 'diwali'], match: ['दीपावली', 'diwali', 'deepavali'], aliases: ['deepawali'] },
  { labels: ['क्रिसमस', 'christmas'], match: ['क्रिसमस', 'christmas'], aliases: ['merry christmas'] },
  { labels: ['होली', 'holi'], match: ['होली', 'holi'], aliases: ['happy holi'] },
  { labels: ['बधाई', 'congratulations'], match: ['बधाई', 'congratulations'], aliases: ['badhai', 'congrats'] },
  { labels: ['धन्यवाद', 'thank you'], match: ['धन्यवाद', 'शुक्रिया', 'thank you'], aliases: ['dhanyavad', 'dhanyavaad', 'shukriya', 'thanks'] },
  { labels: ['माफ़ी', 'sorry'], match: ['माफ़', 'माफी', 'माफ़ी', 'sorry'], aliases: ['maafi', 'mafi', 'apology'] },
  { labels: ['प्यार', 'love'], match: ['प्यार', 'i love you', 'love you'], aliases: ['pyaar', 'pyar'] },
  { labels: ['याद', 'missing you'], match: ['याद आ', 'याद अचानक', 'सोच रहा', 'missing you', 'thinking of you'], aliases: ['yaad', 'miss you'] },
  { labels: ['ख्याल रखना', 'take care'], match: ['ख्याल रखना', 'take care'], aliases: ['khayal rakhna'] },
  { labels: ['जल्दी ठीक हो', 'get well'], match: ['ठीक हो', 'स्वस्थ', 'get well'], aliases: ['get well soon'] },
  { labels: ['ऑल द बेस्ट', 'all the best'], match: ['ऑल द बेस्ट', 'all the best'], aliases: ['all the best'] },
  { labels: ['शुभकामनाएँ', 'best wishes'], match: ['शुभकामना', 'best wishes'], aliases: ['shubhkamnayein', 'shubhkamna'] },
  { labels: ['स्वागत', 'welcome'], match: ['स्वागत', 'welcome'], aliases: ['swagat', 'swagatam'] },
  { labels: ['शादी', 'wedding'], match: ['शादी', 'wedding'], aliases: ['shaadi', 'shaadi mubarak'] },
  { labels: ['बच्चा', 'baby'], match: ['नन्हे', 'नन्हा', 'baby'], aliases: ['baccha', 'newborn'] },
  { labels: ['रक्षा बंधन', 'rakhi'], match: ['रक्षा बंधन', 'rakhi', 'raksha bandhan'], aliases: ['raksha bandhan', 'rakshabandhan'] },
  { labels: ['ईद', 'eid'], match: ['ईद', 'eid'], aliases: ['eid mubarak'] },
  { labels: ['नवरात्रि', 'navratri'], match: ['नवरात्रि', 'navratri'], aliases: ['navratri'] },
  { labels: ['गणेश', 'ganesh'], match: ['गणपति', 'गणेश', 'ganesh', 'ganpati'], aliases: ['ganpati bappa', 'ganesh chaturthi'] },
  { labels: ['करवा चौथ', 'karwa chauth'], match: ['करवा चौथ', 'karwa chauth', 'karva chauth'], aliases: ['karwachauth'] },
  { labels: ['भाई दूज', 'bhai dooj'], match: ['भाई दूज', 'bhai dooj'], aliases: ['bhaidooj'] },
  { labels: ['शुभ दिन', 'great day'], match: ['दिन शुभ', 'दिन मज़ेदार', 'great day'], aliases: ['have a great day'] },
  { labels: ['निकल पड़ा', 'on my way'], match: ['निकल पड़ा', 'on my way', 'on the way'], aliases: ['omw'] },
  { labels: ['पहुँच गया', 'reached'], match: ['पहुँच', 'reached safely', 'reached'], aliases: ['pahunch gaya'] },
  { labels: ['फ़ोन करना', 'call me'], match: ['फ़ोन करना', 'फोन करना', 'call me', 'call when'], aliases: ['phone'] },
  { labels: ['गर्व', 'proud'], match: ['गर्व', 'proud of you', 'proud'], aliases: ['garv'] },
  { labels: ['दिन बना दिया', 'made my day'], match: ['दिन बना', 'made my day'], aliases: ['made my day'] },
  { labels: ['आशीर्वाद', 'god bless'], match: ['भला करे', 'god bless'], aliases: ['ashirvad', 'bless you'] },
  { labels: ['खुश रहो', 'stay happy'], match: ['खुश रहो', 'stay happy'], aliases: ['khush raho'] },
  { labels: ['खाना', 'eat'], match: ['खाना खा', 'खा लेना', 'खाली पेट', 'forget to eat', 'eat on time', 'do not forget to eat'], aliases: ['khana khao'] },
  { labels: ['मीठे सपने', 'sweet dreams'], match: ['मीठे सपने', 'sweet dreams'], aliases: ['meethe sapne'] },
  { labels: ['यात्रा', 'safe journey'], match: ['यात्रा', 'सफ़र', 'सफर', 'safe journey', 'safe travels'], aliases: ['safar', 'yatra'] },
  { labels: ['घर वापसी', 'welcome home'], match: ['घर वापसी', 'welcome home', 'घर पर स्वागत'], aliases: ['ghar wapsi'] },
  { labels: ['सेवानिवृत्ति', 'retirement'], match: ['सेवानिवृत्ति', 'रिटायर', 'retirement'], aliases: ['retirement'] },
  { labels: ['गृहप्रवेश', 'housewarming'], match: ['गृहप्रवेश', 'housewarming'], aliases: ['griha pravesh', 'grihapravesh'] },
  { labels: ['सगाई', 'engagement'], match: ['सगाई', 'engagement'], aliases: ['sagai'] },
  { labels: ['कामयाबी', 'success'], match: ['कामयाबी', 'success'], aliases: ['kamyabi', 'kaamyabi'] },
  { labels: ['देर से', 'running late'], match: ['देर के लिए', 'लेट हूँ', 'i am late', "i'm late", 'sorry i am late'], aliases: ['late'] },
  { labels: ['जल्दी मिलते हैं', 'see you soon'], match: ['जल्दी मिलते', 'see you soon'], aliases: ['jaldi milte'] },
  { labels: ['दुआ', 'prayers'], match: ['दुआ', 'prayer'], aliases: ['dua', 'prayers'] },
  { labels: ['मुस्कान', 'smile'], match: ['मुस्कुरा', 'smiling', 'keep smiling'], aliases: ['muskurahat', 'smile'] },
  { labels: ['डायलॉग', 'dialogue'], match: ['डायलॉग'], aliases: ['dialogue', 'reel', 'रील', 'punchline'] },
  { labels: ['पुरुष', 'male'], match: ['· पुरुष'], aliases: ['male voice', 'aadmi'] },
  { labels: ['महिला', 'female'], match: ['· महिला'], aliases: ['female voice', 'aurat'] },
  { labels: ['बच्चा', 'child'], match: ['· बच्चा'], aliases: ['child voice', 'kid', 'baccha'] },
  { labels: ['हिम्मत', 'courage'], match: ['हिम्मत'], aliases: ['himmat', 'courage'] },
  { labels: ['दोस्ती', 'friendship'], match: ['दोस्ती', 'दोस्त'], aliases: ['dosti', 'friend'] },
  { labels: ['इज़्ज़त', 'respect'], match: ['इज़्ज़त', 'इज्जत'], aliases: ['izzat', 'respect'] },
  { labels: ['जवाब', 'comeback'], match: ['जवाब'], aliases: ['jawab', 'comeback'] },
  { labels: ['घर', 'home'], match: ['घर की देहरी', 'घर ·'], aliases: ['ghar', 'home'] },
  { labels: ['सपना', 'dream'], match: ['सपना'], aliases: ['sapna', 'dream'] },
  { labels: ['वक़्त', 'time'], match: ['वक़्त', 'वक्त'], aliases: ['waqt', 'time'] },
  { labels: ['दिल', 'heart'], match: ['दिल ·', 'दिल टूटा'], aliases: ['dil', 'heart'] },
  { labels: ['मेहनत', 'hard work'], match: ['मेहनत'], aliases: ['mehnat', 'hard work'] },
  { labels: ['सच', 'truth'], match: ['सच ·', 'सच छोटा'], aliases: ['sach', 'truth'] },
];

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = value.normalize('NFC').trim();
    const key = normalize(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export interface PresetTagSet {
  /** Hindi and English labels shown on the preset. */
  tagLabels: string[];
  /** Every Hindi, English, and Roman word that should find this audio. */
  tags: string[];
}

export function presetTagSet(title: string, lyrics = ''): PresetTagSet {
  const haystack = normalize(`${title}\n${lyrics}`);
  const labels: string[] = [];
  const tags: string[] = [];
  for (const group of GROUPS) {
    const matched = group.match.some((term) => haystack.includes(normalize(term)));
    if (!matched) continue;
    labels.push(...group.labels);
    tags.push(...group.labels, ...group.match, ...(group.aliases ?? []));
  }
  return { tagLabels: unique(labels), tags: unique(tags) };
}

export function presetMatchesSearch(fields: {
  title?: string;
  artistName?: string;
  lyrics?: string;
  lyricsExcerpt?: string;
  tags?: string[];
}, needle: string): boolean {
  const query = normalize(needle);
  if (!query) return true;
  const values = [fields.title, fields.artistName, fields.lyrics, fields.lyricsExcerpt, ...(fields.tags ?? [])];
  return values.some((value) => typeof value === 'string' && normalize(value).includes(query));
}
