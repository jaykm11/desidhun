# देसी धुन · Desi Dhun

*Create Best Prompts For AI Song Generation*

Turn Hindi lyrics and poetry into **raga-aware style prompts** and **structured lyrics** ready to paste into [Suno](https://suno.com), [Mureka](https://www.mureka.ai) and other AI song generation apps.

Paste lyrics in Devanagari (`तेरे बिना सावन...`) or Roman script (`Tere bina saawan...`) and get:

- **Rhyme & meter check** — syllabifies each line and counts matras the chhand-shastra way (laghu = 1, guru = 2), detects the rhyme scheme, radif and qaafiya, names known meters (Doha, Chaupai, Rola, Saar), and flags specific issues: lines that break the rhyme, lines that run heavy or light, inconsistent qaafiya under a radif. Fix them or proceed — your call.
- **Mood reading** — detects shringar, viraha, bhakti, sufi, karuna, utsav, saawan, desh-bhakti and more from a bilingual keyword lexicon
- **Raga recommendation** — ranks 21 Hindustani ragas (Yaman, Bhairavi, Bhimpalasi, Darbari, Malkauns, Megh Malhar, Bageshri, Shivranjani, Charukeshi, Kirwani, ...) by their traditional rasa, with reference songs to listen to for the mood
- **Three style prompts** — Traditional/Shastriya, Cinematic Bollywood, and Modern Fusion variants for Suno's "Style of Music" box, including raga, instrumentation, tempo and vocal direction
- **Formatted lyrics** — your poetry restructured with Suno arrangement tags: alap intro, mukhda detected as `[Chorus]`, antara verses, optional sargam interlude, and an alap outro
- **Membership controls** — authenticated accounts, three lifetime free song prompts, and Stripe or PayU checkout for INR memberships and credit packs

## Running

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

Local lyric analysis remains available only after Google authentication is
configured. Copy `.env.example` to `.env.local` and fill in the Firebase web
app values. Prompt composition also requires the deployed Cloud Run API URL.

## Production deployment

The production architecture is Firebase Hosting + Firebase Authentication +
Cloud Run + Firestore + Stripe + PayU. Follow the complete [GCP deployment
runbook](docs/GCP_DEPLOYMENT.md) to set up secrets, Google sign-in, quota
enforcement, recurring billing, backups, and deployment.

## Using with Suno

1. On Suno, switch to **Custom** mode.
2. Copy a style prompt into the **Style of Music** box.
3. Copy the formatted lyrics into the **Lyrics** box.
4. Generate a few takes — raga-flavoured results vary; keep the one where the mukhda lands sweetly.

## How it works

The poetry checker runs in the browser. Protected prompt composition runs
through Cloud Run so the free quota and subscription status are enforced
server-side:

- `src/data/lexicon.ts` — Hindi/Urdu mood lexicon (Devanagari + romanized variants)
- `src/data/ragas.ts` — raga knowledge base: thaat, time, rasa, mood affinities, reference songs, style keywords
- `src/data/genres.ts` — genre presets from ghazal and thumri to wedding anthems
- `src/lib/prosody.ts` — Devanagari & Roman syllabifiers, matra counting, rhyme scheme + radif/qaafiya detection, chhand naming
- `src/lib/analyze.ts` — script detection, mood scoring, raga/genre/tempo/vocal selection
- `src/lib/format.ts` — stanza splitting, refrain (mukhda) detection, Suno structure tags
- `src/lib/prompt.ts` — assembles the three style-prompt variants
- `api/src/index.ts` — Firebase-token verification, atomic lifetime quota,
  server-side generation, Stripe Checkout/Billing Portal, PayU Hosted
  Checkout, and verified payment callbacks

Quick engine checks live in `scripts/smoke.ts` and `scripts/prosody-smoke.ts` (run with `npx tsx <script>`).

Raga suggestions are heuristics rooted in Hindustani tradition — trust your ears above all.
