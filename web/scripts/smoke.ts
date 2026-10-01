import { analyzeLyrics } from '../src/lib/analyze';

const opts = { vocal: 'auto', tempo: 'auto', genreOverride: 'auto', includeAlap: true, includeSargam: true } as const;

const samples: Record<string, string> = {
  'saawan-viraha (devanagari)': `तेरे बिना सावन भी सूना लगे
बादल बरसे मगर मन ना भीगे
याद तेरी रिमझिम सी आती रहे
तेरे बिना सावन भी सूना लगे

पनघट पे अब जाऊँ तो किससे मिलूँ
आँसू छुपा के मैं किसको हँसूँ
इंतज़ार में नैना बिछाए हुए
तेरे बिना सावन भी सूना लगे`,
  'sufi (roman)': `Maula mere maula, tu hi meri manzil
Ishq ka ye safar, teri hi mehfil
Sajde mein jhuk gaya, dil ye deewana
Maula mere maula, tu hi meri manzil`,
  'bhajan (roman)': `Kanha teri murli ki dhun sun ke
Radha naache mandir ke aangan mein
Bhakti mein doobe sab bhakt tere
Darshan de do hey Girdhar Gopala`,
  'wedding (roman)': `Dhol baaje shehnai gaaye
Aaj meri banno ki shaadi hai
Naacho jhoomo khushiyan manao
Mehndi ke rang sang doli sajao`,
};

for (const [name, text] of Object.entries(samples)) {
  const r = analyzeLyrics(text, opts);
  console.log('====', name, '====');
  console.log('moods:', r.moods.map((m) => `${m.mood}:${m.score.toFixed(1)}`).join(', '));
  console.log('ragas:', r.ragas.map((x) => x.raga.name).join(' | '));
  console.log('genre:', r.genre.name, '| tempo:', r.tempo, '| vocal:', r.vocal);
  console.log('prompt[0]:', r.prompts[0].prompt.slice(0, 160), '...');
  console.log(r.formattedLyrics.split('\n').filter((l) => l.startsWith('[')).join('\n'));
  console.log();
}
