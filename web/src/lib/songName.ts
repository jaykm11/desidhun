const PLACEHOLDER_TITLES = new Set(['', 'hindi song', 'untitled song', 'untitled']);

/** Visible name for a library song. Blank or old default titles show as Untitled. */
export function displaySongTitle(title: string | undefined): string {
  const cleaned = title?.trim() ?? '';
  return PLACEHOLDER_TITLES.has(cleaned.toLowerCase()) ? 'Untitled' : cleaned;
}

/** Title from the opening of the lyrics: first four words or first sentence, whichever is shorter. */
export function songNameFromLyrics(lyrics: string): string {
  const text = lyrics
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => isTitleSourceLine(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  const sentence = (text.match(/^.+?(?:[।.!?…]|$)/)?.[0] ?? text)
    .replace(/[।.!?…]+$/g, '')
    .trim();
  const fourWords = sentence.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
  const title = fourWords.length <= sentence.length ? fourWords : sentence;
  return title.slice(0, 80);
}

function isTitleSourceLine(line: string): boolean {
  if (!line || line.startsWith('[') || /^instruments?:/i.test(line)) return false;
  const compact = line.replace(/[~.…·,\s\-]/g, '');
  if (!compact) return false;
  if (/^[आअा]+$/.test(compact)) return false;
  if (/^(हम्म)+$/.test(compact)) return false;
  if (/^(hmm|aa)+$/i.test(compact)) return false;
  return true;
}
