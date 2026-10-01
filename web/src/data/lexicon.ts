import type { Mood } from '../types';

/**
 * Keyword lexicon mapping Hindi/Urdu words (romanized variants + Devanagari)
 * to moods. Roman entries are matched on word boundaries; Devanagari entries
 * are matched as substrings (Hindi is agglutinative with postpositions
 * written separately, so substring works well).
 */
export interface LexEntry {
  roman: string[];
  dev: string[];
  moods: Partial<Record<Mood, number>>;
}

export const LEXICON: LexEntry[] = [
  // ---- Romance / Shringar ----
  { roman: ['pyar', 'pyaar', 'piya', 'piyu'], dev: ['प्यार', 'पिया'], moods: { romance: 3 } },
  { roman: ['ishq', 'ishk'], dev: ['इश्क़', 'इश्क'], moods: { romance: 3, sufi: 1.5 } },
  { roman: ['mohabbat', 'muhabbat', 'mohabbatein'], dev: ['मोहब्बत', 'मुहब्बत'], moods: { romance: 3 } },
  { roman: ['prem', 'preet', 'prit'], dev: ['प्रेम', 'प्रीत'], moods: { romance: 3 } },
  { roman: ['dil', 'dilbar', 'dildaar'], dev: ['दिल'], moods: { romance: 1.5 } },
  { roman: ['sanam', 'saajan', 'sajan', 'sajna', 'sajni'], dev: ['सनम', 'साजन', 'सजना', 'सजनी'], moods: { romance: 2.5 } },
  { roman: ['mehboob', 'mehbooba', 'mahiya', 'mahi'], dev: ['महबूब', 'महबूबा', 'माही'], moods: { romance: 2.5 } },
  { roman: ['deewana', 'deewani', 'diwana', 'diwani'], dev: ['दीवाना', 'दीवानी'], moods: { romance: 2, energetic: 0.5 } },
  { roman: ['husn', 'haseen', 'haseena'], dev: ['हुस्न', 'हसीन', 'हसीना'], moods: { romance: 2 } },
  { roman: ['nain', 'naina', 'nazar', 'nigahen', 'nigahein', 'aankhen', 'aankhein', 'ankhiyan', 'akhiyan'], dev: ['नैन', 'नैना', 'नज़र', 'निगाह', 'आँख', 'आंख', 'अँखिय', 'अखिय'], moods: { romance: 1.5, viraha: 0.5 } },
  { roman: ['zulf', 'zulfein', 'gesu'], dev: ['ज़ुल्फ़', 'जुल्फ', 'गेसू'], moods: { romance: 2 } },
  { roman: ['baahon', 'bahon', 'aagosh', 'aghosh'], dev: ['बाहों', 'आगोश'], moods: { romance: 2 } },
  { roman: ['shringar', 'singaar', 'shrungar'], dev: ['श्रृंगार', 'सिंगार'], moods: { romance: 2.5 } },
  { roman: ['honth', 'hothon', 'labon', 'lab'], dev: ['होंठ', 'होठों', 'लबों'], moods: { romance: 2 } },

  // ---- Viraha / longing / separation ----
  { roman: ['judai', 'judaai', 'juda'], dev: ['जुदाई', 'जुदा'], moods: { viraha: 3, sorrow: 1.5 } },
  { roman: ['bichhad', 'bichad', 'bichhde', 'bichde'], dev: ['बिछड़', 'बिछुड़'], moods: { viraha: 3, sorrow: 1 } },
  { roman: ['intezaar', 'intzaar', 'intazar', 'intezar'], dev: ['इंतज़ार', 'इंतजार', 'इन्तज़ार'], moods: { viraha: 3 } },
  { roman: ['yaad', 'yaadein', 'yaadon'], dev: ['याद'], moods: { viraha: 2.5 } },
  { roman: ['tanha', 'tanhai', 'tanhaai', 'akela', 'akeli', 'akelapan'], dev: ['तन्हा', 'तनहा', 'अकेल'], moods: { viraha: 2.5, sorrow: 1 } },
  { roman: ['door', 'doori', 'dooriyan', 'faasla', 'fasla', 'faasle'], dev: ['दूरी', 'दूरियाँ', 'फ़ासल', 'फासल'], moods: { viraha: 2 } },
  { roman: ['pardes', 'pardesi', 'pardesiya'], dev: ['परदेस', 'परदेसी', 'प्रदेस'], moods: { viraha: 2.5, folk: 1 } },
  { roman: ['tadap', 'tadpe', 'tarpat', 'tarap'], dev: ['तड़प', 'तरपत', 'तड़पत'], moods: { viraha: 3, sorrow: 1 } },
  { roman: ['birha', 'viraha', 'virah', 'viyog'], dev: ['बिरहा', 'विरह', 'वियोग'], moods: { viraha: 3.5 } },
  { roman: ['adhoora', 'adhuri', 'adhura'], dev: ['अधूर'], moods: { viraha: 2, sorrow: 1 } },

  // ---- Sorrow / Karuna ----
  { roman: ['dard', 'dard-e'], dev: ['दर्द'], moods: { sorrow: 3 } },
  { roman: ['gham', 'gam', 'ghamon'], dev: ['ग़म', 'गम'], moods: { sorrow: 3 } },
  { roman: ['aansu', 'aansoo', 'ansoo', 'ashk'], dev: ['आँसू', 'आंसू', 'अश्क'], moods: { sorrow: 3 } },
  { roman: ['rona', 'roye', 'roye', 'roti', 'rota', 'rulaya'], dev: ['रोना', 'रोये', 'रोए', 'रुला'], moods: { sorrow: 2.5 } },
  { roman: ['bewafa', 'bewafai', 'dhoka', 'dhokha'], dev: ['बेवफ़ा', 'बेवफा', 'धोखा'], moods: { sorrow: 3, viraha: 1 } },
  { roman: ['toota', 'toote', 'tootke', 'shikast'], dev: ['टूट'], moods: { sorrow: 2 } },
  { roman: ['zakhm', 'zakham', 'ghaav', 'ghav'], dev: ['ज़ख़्म', 'जख्म', 'घाव'], moods: { sorrow: 2.5 } },
  { roman: ['maut', 'majboor', 'majboori', 'bebas', 'bebasi'], dev: ['मौत', 'मजबूर', 'बेबस'], moods: { sorrow: 2.5 } },
  { roman: ['udaas', 'udaasi', 'mayoos'], dev: ['उदास', 'मायूस'], moods: { sorrow: 2.5 } },

  // ---- Devotion / Bhakti ----
  { roman: ['bhagwan', 'ishwar', 'prabhu', 'hari', 'narayan'], dev: ['भगवान', 'ईश्वर', 'प्रभु', 'हरि', 'नारायण'], moods: { devotion: 3 } },
  { roman: ['krishna', 'kanha', 'kanhaiya', 'shyam', 'murari', 'girdhar', 'gopala', 'govind', 'madhav', 'mohan'], dev: ['कृष्ण', 'कान्हा', 'कन्हैया', 'श्याम', 'मुरारी', 'गिरधर', 'गोपाल', 'गोविंद', 'माधव', 'मोहन'], moods: { devotion: 3, romance: 0.5 } },
  { roman: ['ram', 'raghuvar', 'raghupati', 'sita', 'siya'], dev: ['राम', 'रघुवर', 'रघुपति', 'सीता', 'सिया'], moods: { devotion: 3 } },
  { roman: ['shiv', 'shiva', 'bholenath', 'mahadev', 'shankar'], dev: ['शिव', 'भोलेनाथ', 'महादेव', 'शंकर'], moods: { devotion: 3 } },
  { roman: ['radha', 'radhe', 'meera', 'mira'], dev: ['राधा', 'राधे', 'मीरा'], moods: { devotion: 2.5, romance: 1 } },
  { roman: ['bhajan', 'kirtan', 'aarti', 'arti', 'pooja', 'puja', 'mandir'], dev: ['भजन', 'कीर्तन', 'आरती', 'पूजा', 'मंदिर'], moods: { devotion: 3 } },
  { roman: ['bhakti', 'bhakt', 'darshan', 'charan', 'charnon'], dev: ['भक्ति', 'भक्त', 'दर्शन', 'चरण'], moods: { devotion: 3 } },
  { roman: ['maiya', 'mata', 'devi', 'durga', 'ganpati', 'ganesh'], dev: ['मैया', 'माता', 'देवी', 'दुर्गा', 'गणपति', 'गणेश'], moods: { devotion: 3 } },

  // ---- Sufi / mystic ----
  { roman: ['allah', 'khuda', 'maula', 'moula', 'rab', 'rabba', 'parvardigar'], dev: ['अल्लाह', 'ख़ुदा', 'खुदा', 'मौला', 'रब', 'रब्बा'], moods: { sufi: 3, devotion: 1 } },
  { roman: ['sajda', 'sajde', 'ibadat', 'dua', 'duaein', 'duayen'], dev: ['सजदा', 'सज्दा', 'इबादत', 'दुआ'], moods: { sufi: 3 } },
  { roman: ['fakir', 'faqir', 'faqeer', 'dervish', 'darvesh', 'malang'], dev: ['फ़क़ीर', 'फकीर', 'दरवेश', 'मलंग'], moods: { sufi: 3, philosophical: 1 } },
  { roman: ['rooh', 'ruh', 'noor', 'nur'], dev: ['रूह', 'नूर'], moods: { sufi: 2.5 } },
  { roman: ['kalandar', 'qalandar', 'qawwali', 'dargah', 'mazaar'], dev: ['क़लंदर', 'कलंदर', 'क़व्वाली', 'कव्वाली', 'दरगाह', 'मज़ार'], moods: { sufi: 3.5 } },
  { roman: ['saaqi', 'saqi', 'maikhana', 'maikada', 'jaam', 'paimana', 'paimane'], dev: ['साक़ी', 'साकी', 'मैख़ाना', 'मयखाना', 'जाम', 'पैमान'], moods: { sufi: 2.5, philosophical: 1 } },

  // ---- Monsoon ----
  { roman: ['sawan', 'saawan', 'shravan'], dev: ['सावन', 'श्रावण'], moods: { monsoon: 3.5, viraha: 1 } },
  { roman: ['barish', 'baarish', 'barsaat', 'barsat', 'barse', 'barse', 'baras'], dev: ['बारिश', 'बरसात', 'बरस'], moods: { monsoon: 3.5 } },
  { roman: ['badal', 'baadal', 'badra', 'badarwa', 'ghata', 'ghataayen'], dev: ['बादल', 'बदरा', 'बदरवा', 'घटा'], moods: { monsoon: 3 } },
  { roman: ['rimjhim', 'rim-jhim', 'boondein', 'boonden', 'boond', 'bundan'], dev: ['रिमझिम', 'बूँद', 'बूंद'], moods: { monsoon: 3 } },
  { roman: ['papiha', 'papihara', 'more', 'mora', 'morni', 'koyal', 'koel'], dev: ['पपीहा', 'मोर', 'कोयल'], moods: { monsoon: 2, folk: 1 } },
  { roman: ['bijli', 'bijuriya', 'garaj', 'garje'], dev: ['बिजली', 'बिजुरिया', 'गरज'], moods: { monsoon: 2.5 } },

  // ---- Night / moon ----
  { roman: ['chand', 'chanda', 'chandni', 'chaand', 'mahtab'], dev: ['चाँद', 'चांद', 'चंदा', 'चाँदनी', 'चांदनी'], moods: { night: 3, romance: 1 } },
  { roman: ['raat', 'raatein', 'raaton', 'shab', 'raina', 'rain'], dev: ['रात', 'रैना', 'शब'], moods: { night: 3 } },
  { roman: ['sitare', 'sitaron', 'taare', 'taaron', 'tare'], dev: ['सितार', 'तारे', 'तारों'], moods: { night: 2.5 } },
  { roman: ['khwab', 'khwaab', 'sapna', 'sapne', 'sapnon', 'swapna'], dev: ['ख़्वाब', 'ख्वाब', 'सपन', 'स्वप्न'], moods: { night: 1.5, romance: 1 } },
  { roman: ['neend', 'nindiya'], dev: ['नींद', 'निंदिया'], moods: { night: 2 } },

  // ---- Dawn ----
  { roman: ['subah', 'subha', 'savera', 'savere', 'bhor', 'prabhat'], dev: ['सुबह', 'सवेरा', 'सवेरे', 'भोर', 'प्रभात'], moods: { dawn: 3 } },
  { roman: ['suraj', 'sooraj', 'kiran', 'kiranein', 'ujala', 'ujaala'], dev: ['सूरज', 'किरण', 'उजाला'], moods: { dawn: 2.5 } },

  // ---- Celebration ----
  { roman: ['jashn', 'jashan', 'mehfil', 'shaadi', 'shadi', 'byah', 'vivah'], dev: ['जश्न', 'महफ़िल', 'महफिल', 'शादी', 'ब्याह', 'विवाह'], moods: { celebration: 3 } },
  { roman: ['naach', 'nach', 'naache', 'nache', 'thumka', 'jhoom', 'jhoome', 'jhume'], dev: ['नाच', 'नाचे', 'ठुमका', 'झूम'], moods: { celebration: 3, energetic: 1.5 } },
  { roman: ['dhol', 'dholak', 'shehnai', 'baraat', 'barat'], dev: ['ढोल', 'ढोलक', 'शहनाई', 'बारात'], moods: { celebration: 3, folk: 1 } },
  { roman: ['holi', 'rang', 'rangon', 'gulal', 'gulaal', 'diwali', 'deepawali'], dev: ['होली', 'रंग', 'गुलाल', 'दिवाली', 'दीपावली'], moods: { celebration: 3, folk: 1 } },
  { roman: ['mehndi', 'mehendi', 'choodi', 'chudi', 'churiyan', 'kangna', 'bindiya', 'payal', 'jhumka'], dev: ['मेहंदी', 'मेहँदी', 'चूड़ी', 'चूड़िय', 'कंगना', 'बिंदिया', 'पायल', 'झुमका'], moods: { celebration: 2, folk: 1.5, romance: 0.5 } },
  { roman: ['khushi', 'khushiyan', 'mubarak', 'badhai', 'badhaai'], dev: ['ख़ुशी', 'खुशी', 'खुशियाँ', 'मुबारक', 'बधाई'], moods: { celebration: 2.5 } },

  // ---- Patriotic ----
  { roman: ['desh', 'watan', 'vatan', 'bharat', 'hindustan', 'hindostan'], dev: ['देश', 'वतन', 'भारत', 'हिंदुस्तान', 'हिन्दुस्तान'], moods: { patriotic: 3 } },
  { roman: ['tiranga', 'jhanda', 'shaheed', 'shahid', 'kurbani', 'qurbani'], dev: ['तिरंगा', 'झंडा', 'शहीद', 'क़ुर्बानी', 'कुर्बानी'], moods: { patriotic: 3.5 } },
  { roman: ['janani', 'janmabhoomi', 'matrubhoomi', 'maati', 'mitti'], dev: ['जननी', 'जन्मभूमि', 'मातृभूमि', 'माटी', 'मिट्टी'], moods: { patriotic: 2, folk: 1 } },
  { roman: ['veer', 'vir', 'jawan', 'sena', 'sarhad'], dev: ['वीर', 'जवान', 'सेना', 'सरहद'], moods: { patriotic: 2.5, energetic: 1 } },

  // ---- Philosophical ----
  { roman: ['zindagi', 'zindagani', 'jeevan', 'jivan'], dev: ['ज़िंदगी', 'जिंदगी', 'जीवन'], moods: { philosophical: 2 } },
  { roman: ['safar', 'raah', 'raahein', 'rasta', 'raaste', 'manzil', 'manzilein'], dev: ['सफ़र', 'सफर', 'राह', 'रास्त', 'मंज़िल', 'मंजिल'], moods: { philosophical: 2 } },
  { roman: ['waqt', 'vaqt', 'samay', 'pal', 'lamha', 'lamhe', 'lamhon'], dev: ['वक़्त', 'वक्त', 'समय', 'लम्हा', 'लम्हे'], moods: { philosophical: 1.5 } },
  { roman: ['duniya', 'jahaan', 'jahan', 'jag', 'sansaar', 'sansar'], dev: ['दुनिया', 'जहाँ', 'जहान', 'संसार'], moods: { philosophical: 1.5 } },
  { roman: ['maya', 'moh', 'moksha', 'mukti', 'aatma', 'atma'], dev: ['माया', 'मोह', 'मोक्ष', 'मुक्ति', 'आत्मा'], moods: { philosophical: 2.5, devotion: 1 } },
  { roman: ['kismat', 'qismat', 'taqdeer', 'takdir', 'naseeb', 'nasib'], dev: ['क़िस्मत', 'किस्मत', 'तक़दीर', 'तकदीर', 'नसीब'], moods: { philosophical: 2, sorrow: 0.5 } },

  // ---- Folk / pastoral ----
  { roman: ['gaon', 'gaanv', 'panghat', 'kuan', 'khet', 'kheton'], dev: ['गाँव', 'गांव', 'पनघट', 'कुआँ', 'खेत'], moods: { folk: 3 } },
  { roman: ['nadiya', 'nadi', 'kinara', 'kinare', 'ghaat', 'ghat', 'naiya', 'majhi', 'kashti'], dev: ['नदिया', 'नदी', 'किनार', 'घाट', 'नैया', 'माझी', 'कश्ती'], moods: { folk: 2.5, philosophical: 0.5 } },
  { roman: ['ghunghat', 'ghoonghat', 'chunari', 'chunariya', 'odhni', 'aanchal', 'anchal'], dev: ['घूँघट', 'घूंघट', 'चुनरी', 'चुनरिया', 'ओढ़नी', 'आँचल', 'आंचल'], moods: { folk: 2.5, romance: 1 } },
  { roman: ['banjara', 'banjaran', 'gori', 'gujariya', 'balam', 'balma', 'saiyan', 'saiyaan'], dev: ['बंजारा', 'गोरी', 'गुजरिया', 'बलम', 'बालमा', 'सैयां', 'सइयां'], moods: { folk: 2.5, romance: 1.5 } },

  // ---- Energetic ----
  { roman: ['aag', 'sholay', 'shola', 'toofan', 'tufan', 'aandhi'], dev: ['आग', 'शोला', 'तूफ़ान', 'तूफान', 'आँधी', 'आंधी'], moods: { energetic: 2.5 } },
  { roman: ['jeet', 'jung', 'jang', 'ladai', 'takraar', 'lalkaar', 'lalkar'], dev: ['जीत', 'जंग', 'लड़ाई', 'ललकार'], moods: { energetic: 2.5, patriotic: 1 } },
  { roman: ['josh', 'junoon', 'junun', 'himmat', 'hausla', 'hosla'], dev: ['जोश', 'जुनून', 'हिम्मत', 'हौसला'], moods: { energetic: 3 } },
];
