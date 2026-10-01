import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import type { CoverTheme } from '../../web/src/lib/songIdentity';

function coverImagePath(theme: CoverTheme): string {
  const candidates = [
    resolve(process.cwd(), 'public/covers', `${theme}.jpg`),
    resolve(process.cwd(), '../public/covers', `${theme}.jpg`),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Cover image for ${theme} is missing.`);
  return found;
}

function runFfmpeg(args: string[], allowFailure = false): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg is not available on this server.'));
      return;
    }
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4_000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolvePromise(stderr);
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

/** ffmpeg-static ships without ffprobe, so read the duration from ffmpeg's input banner. */
async function audioDurationSeconds(audioPath: string): Promise<number | null> {
  const banner = await runFfmpeg(['-hide_banner', '-i', audioPath], true);
  const match = banner.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/**
 * YouTube only accepts video, so pair the song with its cover art: a blurred,
 * darkened fill behind the square cover, at 1 fps to keep encoding fast.
 */
export async function renderSongVideo(audio: Buffer, theme: CoverTheme): Promise<Buffer> {
  const workDir = await mkdtemp(join(tmpdir(), 'desidhun-video-'));
  try {
    const audioPath = join(workDir, 'song.mp3');
    const videoPath = join(workDir, 'song.mp4');
    await writeFile(audioPath, audio);
    const duration = await audioDurationSeconds(audioPath);
    await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-loop', '1',
      '-framerate', '1',
      '-i', coverImagePath(theme),
      '-i', audioPath,
      '-filter_complex',
      '[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=20:2,eq=brightness=-0.18[bg];'
        + '[0:v]scale=-2:720[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]',
      '-map', '[v]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'stillimage',
      '-r', '1',
      '-c:a', 'aac',
      '-b:a', '192k',
      ...(duration ? ['-t', duration.toFixed(2)] : ['-shortest']),
      '-movflags', '+faststart',
      videoPath,
    ]);
    return await readFile(videoPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
