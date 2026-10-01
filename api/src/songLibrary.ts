import { Storage } from '@google-cloud/storage';
import type { CoverTheme } from '../../web/src/lib/songIdentity';
import { renderSongVideo } from './youtubeVideo';

const storage = new Storage();

function bucketName(): string {
  return process.env.SONG_LIBRARY_BUCKET || 'desidhun-songs-365609890674';
}

export function songObjectPath(uid: string, songId: string): string {
  return `${uid}/${songId}.mp3`;
}

export async function saveSongAudio(uid: string, songId: string, audio: Buffer): Promise<string> {
  const path = songObjectPath(uid, songId);
  await storage.bucket(bucketName()).file(path).save(audio, {
    contentType: 'audio/mpeg',
    resumable: false,
    metadata: { cacheControl: 'private, max-age=3600' },
  });
  return path;
}

export async function readSongAudio(path: string): Promise<Buffer> {
  const [bytes] = await storage.bucket(bucketName()).file(path).download();
  return bytes;
}

export async function deleteSongAudio(path: string): Promise<void> {
  const bucket = storage.bucket(bucketName());
  await bucket.file(path).delete({ ignoreNotFound: true });
  await bucket.file(videoObjectPath(path)).delete({ ignoreNotFound: true });
}

function videoObjectPath(audioPath: string): string {
  return `${audioPath.replace(/\.mp3$/i, '')}.mp4`;
}

const videoRenders = new Map<string, Promise<Buffer>>();

/** Cover-art video for sharing. The first request encodes it; later requests reuse the file. */
export async function cachedSongVideo(audioPath: string, theme: CoverTheme): Promise<Buffer> {
  const videoPath = videoObjectPath(audioPath);
  const pending = videoRenders.get(videoPath);
  if (pending) return pending;
  const render = (async () => {
    const file = storage.bucket(bucketName()).file(videoPath);
    const [exists] = await file.exists();
    if (exists) {
      const [bytes] = await file.download();
      return bytes;
    }
    const audio = await readSongAudio(audioPath);
    const video = await renderSongVideo(audio, theme);
    await file.save(video, {
      contentType: 'video/mp4',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=86400' },
    });
    return video;
  })();
  videoRenders.set(videoPath, render);
  try {
    return await render;
  } finally {
    videoRenders.delete(videoPath);
  }
}
