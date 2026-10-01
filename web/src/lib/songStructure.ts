import type {
  ChorusSuggestion,
  Genre,
  MusicArrangement,
  Raga,
  SongStructureRecommendation,
  SongStructureSection,
  Tempo,
} from '../types';

interface StructureContext {
  raga: Raga;
  genre: Genre;
  tempo: Exclude<Tempo, 'auto'>;
  arrangement: MusicArrangement;
  chorusSuggestions: ChorusSuggestion[];
}

function section(
  id: string,
  title: string,
  timing: string,
  lyricDirection: string,
  arrangementDirection: string,
): SongStructureSection {
  return { id, title, timing, lyricDirection, arrangementDirection };
}

function filmStructure(ctx: StructureContext): SongStructureSection[] {
  const chorusDirection = ctx.chorusSuggestions.some((item) => item.id === 'detected-mukhda')
    ? 'Use the detected mukhda exactly; repeat its strongest final line on the second pass.'
    : 'Use the suggested original raga hook as the mukhda; make the first and third lines identical for recall.';

  return [
    section('intro', 'Intro / Alap', '0:00–0:16', 'No full lyric yet; use a breath, humming, or one title phrase only.', ctx.arrangement.sections[0].direction),
    section('verse-1', 'Verse 1 / Antara', '0:16–0:48', 'Establish the scene, speaker, and emotional question without revealing the final resolution.', ctx.arrangement.sections[1].direction),
    section('pre-chorus', 'Pre-chorus / Uthaan', '0:48–1:00', 'Shorten the phrases and raise emotional pressure; end on an unresolved thought that points to the mukhda.', 'Thin the rhythm for the final two bars, then use a rising lead-in to the chorus.'),
    section('chorus-1', 'Chorus / Mukhda', '1:00–1:28', chorusDirection, ctx.arrangement.sections[2].direction),
    section('verse-2', 'Verse 2 / Antara', '1:28–2:00', 'Add a new image or memory; do not repeat Verse 1 word-for-word.', 'Return to the sparse verse palette, but add one extra supporting voice or instrument.'),
    section('bridge', 'Bridge / Sargam Interlude', '2:00–2:20', 'Use wordless sargam, a brief vow/prayer, or the poem’s most reflective line once.', ctx.arrangement.sections[3].direction),
    section('final-chorus', 'Final Chorus / Mukhda Reprise', '2:20–2:52', 'Repeat the mukhda twice; alter only the final line to give a feeling of arrival or release.', 'Full arrangement on first pass; drop percussion for the final held phrase.'),
    section('outro', 'Outro', '2:52–3:06', 'One final title phrase, humming, or silence after the last word.', ctx.arrangement.sections[4].direction),
  ];
}

function qawwaliStructure(ctx: StructureContext): SongStructureSection[] {
  return [
    section('intro', 'Intro / Free Alap', '0:00–0:14', 'Open with a short invocation or title phrase; no complete verse.', ctx.arrangement.sections[0].direction),
    section('mukhda', 'Mukhda / Refrain', '0:14–0:38', 'State the core line clearly, then repeat it with group response.', 'Introduce harmonium and claps gradually; keep the first repetition restrained.'),
    section('verse-1', 'Verse 1 / Sher', '0:38–1:04', 'Deliver the first poetic image as a solo line, followed by a brief refrain answer.', 'Dholak/tabla settle into the cycle; harmonium supports the vocal.'),
    section('call-response', 'Call & Response Lift', '1:04–1:32', 'Lead voice asks; chorus answers with the mukhda’s key phrase.', 'Build claps and unison backing vocals on each answer.'),
    section('verse-2', 'Verse 2 / Sher', '1:32–1:58', 'Move from personal longing toward spiritual or emotional surrender.', 'Add sarangi or flute fills only between complete lines.'),
    section('bridge', 'Bridge / Sargam Build', '1:58–2:20', 'Use sargam or repeated title words; avoid adding a new long verse here.', 'Increase density in two stages, then leave a one-beat breath before final refrain.'),
    section('final-refrain', 'Final Refrain', '2:20–2:56', 'Repeat the mukhda with ad-libs, then end on a unison final line.', 'Full group vocals, claps, and percussion; resolve cleanly rather than fading mid-cycle.'),
    section('outro', 'Outro / Dua', '2:56–3:08', 'Return to one soft title phrase or a short blessing.', ctx.arrangement.sections[4].direction),
  ];
}

function bhajanStructure(ctx: StructureContext): SongStructureSection[] {
  return [
    section('intro', 'Invocation / Alap', '0:00–0:14', 'Sing the deity/name or core prayer once, gently and unhurried.', ctx.arrangement.sections[0].direction),
    section('sthayi', 'Sthayi / Mukhda', '0:14–0:40', 'State the devotional refrain; keep language direct and easy for listeners to repeat.', 'Bring in the primary groove and a light response from harmonium or flute.'),
    section('antara-1', 'Antara 1', '0:40–1:08', 'Describe the devotee’s longing, praise, or request.', ctx.arrangement.sections[1].direction),
    section('mukhda-return', 'Mukhda Return', '1:08–1:28', 'Repeat the full refrain once.', 'Add manjira or a soft group response on the final phrase.'),
    section('antara-2', 'Antara 2', '1:28–1:56', 'Move toward surrender, grace, or a blessing.', 'Add a little more rhythmic motion, but keep the vocal leading.'),
    section('bridge', 'Sargam / Naam-jap Bridge', '1:56–2:16', 'Use sargam or repeat the divine name in a simple call-and-response.', ctx.arrangement.sections[3].direction),
    section('final-mukhda', 'Final Mukhda', '2:16–2:46', 'Repeat the refrain twice, with the final pass softer and slower.', 'Full warmth on first pass; return to drone and voice for the close.'),
    section('outro', 'Prayer Outro', '2:46–3:00', 'Leave a final held name or gentle hum.', ctx.arrangement.sections[4].direction),
  ];
}

function folkStructure(ctx: StructureContext): SongStructureSection[] {
  return [
    section('intro', 'Groove Intro', '0:00–0:12', 'Use a short shouted title phrase, hum, or instrumental pickup.', 'Establish dholak/folk pulse immediately, with a one-bar melodic pickup.'),
    section('hook', 'Hook / Mukhda', '0:12–0:34', 'State the most singable line and repeat it after one response line.', ctx.arrangement.sections[2].direction),
    section('verse-1', 'Verse 1', '0:34–1:00', 'Set the place, season, or relationship in concrete visual language.', ctx.arrangement.sections[1].direction),
    section('hook-return', 'Hook Return', '1:00–1:18', 'Repeat the mukhda; invite a group answer on the last phrase.', 'Add claps or khartal only here.'),
    section('verse-2', 'Verse 2', '1:18–1:44', 'Escalate the celebration, journey, teasing, or longing.', 'Add the second melodic instrument in short fills.'),
    section('bridge', 'Dance / Instrumental Bridge', '1:44–2:04', 'No dense lyric; use short calls, vocables, or sargam.', 'Feature the folk rhythm for eight to sixteen bars.'),
    section('final-hook', 'Final Hook', '2:04–2:34', 'Repeat the mukhda twice; last pass can be group unison.', 'Full rhythm and all melodic instruments; finish with a clear stop.'),
    section('outro', 'Outro', '2:34–2:44', 'One final title call.', ctx.arrangement.sections[4].direction),
  ];
}

function classicalStructure(ctx: StructureContext): SongStructureSection[] {
  return [
    section('alap', 'Alap', '0:00–0:28', 'No fixed lyric; introduce the raga through vowel sounds or the title phrase.', ctx.arrangement.sections[0].direction),
    section('sthayi', 'Sthayi / Mukhda', '0:28–0:58', 'State the central lyric with clear, unornamented diction on the first pass.', 'Tabla enters gently; establish the taal without crowding the vocal.'),
    section('antara', 'Antara', '0:58–1:34', 'Take the narrative or emotional thought upward, then return to the sthayi.', ctx.arrangement.sections[1].direction),
    section('sargam', 'Sargam / Bol-alap', '1:34–1:58', 'Use a short original sargam or stretch one key lyric phrase.', ctx.arrangement.sections[3].direction),
    section('drut', 'Drut Development', '1:58–2:24', 'Return to the mukhda with shorter, more energetic phrases.', 'Increase tabla activity but preserve the raga’s characteristic notes.'),
    section('final-sthayi', 'Final Sthayi', '2:24–2:48', 'Deliver the mukhda one last time with a calm final resolution.', 'Release percussion after the last sam and let the drone remain.'),
    section('outro', 'Drone Outro', '2:48–3:00', 'No further lyric needed.', ctx.arrangement.sections[4].direction),
  ];
}

function structureFor(ctx: StructureContext): SongStructureSection[] {
  if (ctx.genre.id === 'sufi') return qawwaliStructure(ctx);
  if (ctx.genre.id === 'bhajan') return bhajanStructure(ctx);
  if (ctx.genre.id === 'folk' || ctx.genre.id === 'wedding') return folkStructure(ctx);
  if (ctx.genre.id === 'classical') return classicalStructure(ctx);
  return filmStructure(ctx);
}

function outline(sections: SongStructureSection[]): string {
  return sections
    .map((item) => `[${item.title} — ${item.timing}]\nLyrics: ${item.lyricDirection}\nMusic: ${item.arrangementDirection}`)
    .join('\n\n');
}

export function buildSongStructure(ctx: StructureContext): SongStructureRecommendation {
  const sections = structureFor(ctx);
  return {
    title: `${ctx.raga.name} ${ctx.genre.name} Song Structure`,
    rationale: `Built around ${ctx.raga.name}'s ${ctx.raga.rasa.toLowerCase()} character and the sectional conventions of ${ctx.genre.name}. The references below are listening guides for pacing and emotional arc, not templates to copy.`,
    listeningReferences: ctx.raga.referenceSongs.slice(0, 2),
    sections,
    formattedOutline: outline(sections),
  };
}
