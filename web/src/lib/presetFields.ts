export function tokenizePresetText(text: string): string[] {
  return text.split(/(\[(?:male|female|child)\]|\s+|[.,!?;:"“”()[\]।॥…—–]+)/iu).filter((token) => token !== '');
}

export function isFieldableToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token) && !/^\s+$/.test(token) && !token.startsWith('[');
}

export function sanitizeFieldTokens(text: string, candidate: unknown): number[] {
  if (!Array.isArray(candidate)) return [];
  const tokens = tokenizePresetText(text);
  const valid = new Set<number>();
  for (const value of candidate) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < tokens.length && isFieldableToken(tokens[value])) {
      valid.add(value);
    }
  }
  return [...valid].sort((left, right) => left - right);
}

export type PresetSegment =
  | { kind: 'text'; text: string }
  | { kind: 'field'; id: number; tokenIndexes: number[]; text: string };

/** Adjacent field words separated only by whitespace become a single editable field. */
export function presetSegments(text: string, fieldTokens: number[]): PresetSegment[] {
  const tokens = tokenizePresetText(text);
  const fields = new Set(fieldTokens);
  const segments: PresetSegment[] = [];
  let index = 0;
  while (index < tokens.length) {
    if (!fields.has(index)) {
      const last = segments[segments.length - 1];
      if (last?.kind === 'text') last.text += tokens[index];
      else segments.push({ kind: 'text', text: tokens[index] });
      index += 1;
      continue;
    }
    const group = [index];
    let end = index;
    while (end + 2 < tokens.length && /^\s+$/.test(tokens[end + 1]) && !tokens[end + 1].includes('\n') && fields.has(end + 2)) {
      group.push(end + 1, end + 2);
      end += 2;
    }
    segments.push({
      kind: 'field',
      id: index,
      tokenIndexes: group,
      text: group.map((tokenIndex) => tokens[tokenIndex]).join(''),
    });
    index = end + 1;
  }
  return segments;
}

export function fillPresetFields(text: string, fieldTokens: number[], values: Record<number, string>): string {
  return presetSegments(text, fieldTokens)
    .map((segment) => {
      if (segment.kind === 'text') return segment.text;
      const value = values[segment.id];
      return typeof value === 'string' && value.trim() ? value.trim() : segment.text;
    })
    .join('');
}
