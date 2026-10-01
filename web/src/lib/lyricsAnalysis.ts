import { analyzeLyrics } from './analyze';
import { analyzePoem } from './prosody';
import type { AnalysisOptions } from '../types';
import { MOOD_LABELS } from '../types';

export function formatLyricsAnalysis(text: string, options: AnalysisOptions): string {
  const poem = analyzePoem(text);
  const reading = analyzeLyrics(text, options);
  const moods = reading.moods
    .map((mood) => `${MOOD_LABELS[mood.mood].hi} · ${MOOD_LABELS[mood.mood].en.split(' / ')[0]}`)
    .join(', ');
  const raga = reading.ragas[0]?.raga;
  const lines = [
    'LYRICS ANALYSIS',
    poem.verdict,
    '',
    `Style / mood: ${moods || 'No strong mood keywords found'}`,
    `Genre: ${reading.genre.name}`,
    `Suggested raga: ${raga ? `Raag ${raga.name} (${raga.thaat} thaat · ${raga.rasa})` : 'None'}`,
    `Tempo: ${reading.tempo} · Vocals: ${reading.vocal} · Script: ${reading.script}`,
  ];

  for (const stanza of poem.stanzas) {
    lines.push('');
    lines.push(`STANZA ${stanza.index + 1}`);
    lines.push(`Rhyme scheme: ${stanza.scheme}`);
    lines.push(`Meter: ${stanza.matraCounts.join(' · ')} matras`);
    if (stanza.chhand) lines.push(`Chhand: ${stanza.chhand}`);
    if (stanza.radif) {
      lines.push(`Radif: “${stanza.radif}”${stanza.qaafiya ? ` · Qaafiya: “${stanza.qaafiya}”` : ''}`);
    }
    lines.push('');
    for (const line of stanza.lines) {
      lines.push(`${line.rhymeLetter}  ${line.text}`);
      lines.push(`   ${line.matras} matras · “-${line.rime}”`);
    }
    if (stanza.issues.length) {
      lines.push('');
      lines.push('Issues:');
      for (const issue of stanza.issues) lines.push(`- ${issue}`);
    }
    if (stanza.notes.length) {
      lines.push('');
      lines.push('Notes:');
      for (const note of stanza.notes) lines.push(`- ${note}`);
    }
  }

  return lines.join('\n');
}
