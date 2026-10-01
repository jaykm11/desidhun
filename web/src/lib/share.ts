export function songSharePath(songId: string): string {
  return `/s/${encodeURIComponent(songId)}`;
}

export function songShareUrl(songId: string): string {
  const origin = window.location.origin.replace(/\/$/, '');
  return `${origin}${songSharePath(songId)}`;
}

export function songShareText(title: string): string {
  const name = title.trim() || 'Untitled';
  return `Listen to “${name}” on Desi Dhun`;
}

export async function copyShareableLink(songId: string): Promise<string> {
  const url = songShareUrl(songId);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt('Copy this Desi Dhun link', url);
  }
  return url;
}

export function whatsAppShareUrl(songId: string, title: string): string {
  const url = songShareUrl(songId);
  const text = `${songShareText(title)}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function emailShareUrl(songId: string, title: string): string {
  const url = songShareUrl(songId);
  const name = title.trim() || 'Untitled';
  const subject = `${name} · Desi Dhun`;
  const body = `${songShareText(title)}\n\n${url}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function canUseSystemShare(): boolean {
  return typeof navigator.share === 'function';
}

export async function shareDesiDhunLink(song: { id: string; title: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = songShareUrl(song.id);
  const title = song.title.trim() || 'Untitled';
  const text = songShareText(title);
  if (canUseSystemShare()) {
    try {
      await navigator.share({ title: `${title} · Desi Dhun`, text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  await copyShareableLink(song.id);
  return 'copied';
}
