import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { User } from 'firebase/auth';
import { Share } from 'react-native';
import { communitySongAudioUrl, librarySongAudioUrl, librarySongVideoUrl, songShareUrl, songVideoShareUrl } from './api';

const CACHE_FOLDER = 'songs';

function cacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, CACHE_FOLDER);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function safeName(songId: string, extension = 'mp3'): string {
  return `${songId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
}

/**
 * Song audio is behind a bearer token, so it is downloaded to the cache first
 * and played from disk. The cached copy is what gets shared to other apps.
 */
async function downloadAudio(url: string, songId: string, token?: string, extension = 'mp3'): Promise<string> {
  const target = new File(cacheDirectory(), safeName(songId, extension));
  if (target.exists && target.size > 0) return target.uri;
  const file = await File.downloadFileAsync(url, target, {
    idempotent: true,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  return file.uri;
}

export async function librarySongFile(user: User, songId: string): Promise<string> {
  return downloadAudio(librarySongAudioUrl(songId), songId, await user.getIdToken());
}

export async function librarySongVideoFile(user: User, songId: string): Promise<string> {
  return downloadAudio(librarySongVideoUrl(songId), `${songId}-video`, await user.getIdToken(), 'mp4');
}

export async function communitySongFile(user: User, songId: string): Promise<string> {
  return downloadAudio(communitySongAudioUrl(songId), `community-${songId}`, await user.getIdToken());
}

export function forgetCachedAudio(songId: string): void {
  for (const name of [safeName(songId), safeName(`${songId}-video`, 'mp4')]) {
    const target = new File(cacheDirectory(), name);
    if (target.exists) target.delete();
  }
}

/** Hands a cover-art video to WhatsApp and other apps so it plays inline. */
export async function shareVideoFile(fileUri: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    await shareSongLink('', title);
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'video/mp4',
    dialogTitle: `Share ${title}`,
    UTI: 'public.mpeg-4',
  });
}

/** Hands the audio file itself to WhatsApp, Instagram, Files, and so on. */
export async function shareAudioFile(fileUri: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    await shareSongLink('', title);
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'audio/mpeg',
    dialogTitle: `Share ${title}`,
    UTI: 'public.mp3',
  });
}

export async function shareSongLink(songId: string, title: string): Promise<void> {
  const name = title.trim() || 'Untitled';
  const url = songId ? songShareUrl(songId) : '';
  const message = url ? `Listen to “${name}” on Desi Dhun\n${url}` : `Listen to “${name}” on Desi Dhun`;
  await Share.share({ message, ...(url ? { url } : {}) }, { dialogTitle: `Share ${name}` });
}

export async function shareSongVideo(songId: string, title: string): Promise<void> {
  const name = title.trim() || 'Untitled';
  const url = songVideoShareUrl(songId);
  const message = `Listen to “${name}” on Desi Dhun\n${url}`;
  await Share.share({ message, url }, { dialogTitle: `Share ${name}` });
}
