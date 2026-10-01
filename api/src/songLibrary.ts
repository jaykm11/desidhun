import { Storage } from '@google-cloud/storage';

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
  await storage.bucket(bucketName()).file(path).delete({ ignoreNotFound: true });
}
