import { analyzePoem } from '../src/lib/prosody';

const samples: Record<string, string> = {
  'clean couplets (roman)': `Tere bina saawan bhi soona lage
Baadal barse magar man na bheege
Yaad teri rimjhim si aati rahe
Tere bina saawan bhi soona lage`,

  'broken rhyme (roman)': `Chand ki roshni mein tera chehra
Sitaron ne bhi dekha sapna sunehra
Raat dhal gayi aur subah ho gayi
Dil mein rahi bas teri ik tasveer`,

  'meter deviation (devanagari)': `तेरे बिना जीवन सूना है
मन का हर सपना अनकहा है
इस लंबी अंधेरी रात के सन्नाटे में तेरी याद है
तेरे बिना जीवन सूना है`,

  'doha (devanagari)': `बड़ा हुआ तो क्या हुआ जैसे पेड़ खजूर
पंथी को छाया नहीं फल लागे अति दूर`,

  'radif ghazal (roman)': `Dil ki baat labon pe aane do
Ishq ko ab zubaan pe aane do
Raaz jo chhupa hai seene mein
Aaj usse jahaan pe aane do`,
};

for (const [name, text] of Object.entries(samples)) {
  const p = analyzePoem(text);
  console.log('====', name, '====');
  console.log('verdict:', p.verdict);
  for (const st of p.stanzas) {
    console.log(
      ` stanza ${st.index + 1}: scheme=${st.scheme} matras=${st.matraCounts.join(',')} chhand=${st.chhand ?? '-'} radif=${st.radif ?? '-'} qaafiya=${st.qaafiya ?? '-'}`,
    );
    for (const ln of st.lines) console.log(`   [${ln.rhymeLetter}] ${ln.matras}m "-${ln.rime}"  ${ln.text}`);
    for (const iss of st.issues) console.log('   ISSUE:', iss);
    for (const n of st.notes) console.log('   note:', n);
  }
  console.log();
}
