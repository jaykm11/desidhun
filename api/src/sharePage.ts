import type { CommunitySong } from './community';
import { coverImageForTheme } from '../../web/src/lib/songIdentity';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function sharedSongHtml(options: {
  song: CommunitySong;
  appBaseUrl: string;
  audioUrl: string;
  videoUrl: string;
}): string {
  const title = options.song.title.trim() || 'Untitled';
  const artist = options.song.artistName.trim() || 'Desi Dhun artist';
  const pageUrl = `${options.appBaseUrl.replace(/\/$/, '')}/s/${encodeURIComponent(options.song.id)}`;
  const imageUrl = `${options.appBaseUrl.replace(/\/$/, '')}${coverImageForTheme(options.song.coverTheme)}`;
  const description = `Listen to “${title}” by ${artist} on Desi Dhun.`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Desi Dhun</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="Desi Dhun">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:video" content="${escapeHtml(options.videoUrl)}">
  <meta property="og:video:secure_url" content="${escapeHtml(options.videoUrl)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: #f4efe5;
      background: linear-gradient(175deg, #100d21, #0b0917);
      font-family: Inter, "Noto Sans Devanagari", sans-serif;
    }
    main { max-width: 720px; margin: 0 auto; padding: 28px 20px 48px; }
    a { color: #d6a441; }
    .eyebrow { letter-spacing: .12em; color: #d6a441; font-size: .72rem; }
    .card {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 22px;
      margin-top: 18px;
      padding: 22px;
      background: #17132c;
      border: 1px solid rgba(214,164,65,.28);
      border-radius: 16px;
    }
    img { width: 160px; height: 160px; object-fit: cover; border-radius: 12px; }
    h1 { margin: 0 0 6px; font-size: 1.6rem; }
    p { margin: 0 0 16px; color: #b8b0c8; }
    audio, video { width: 100%; border-radius: 12px; background: #0b0917; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
    button, .home {
      display: inline-block;
      padding: 8px 14px;
      color: #f4efe5;
      background: #211a3d;
      border: 1px solid rgba(214,164,65,.4);
      border-radius: 999px;
      text-decoration: none;
      cursor: pointer;
      font: inherit;
    }
    @media (max-width: 640px) {
      .card { grid-template-columns: 1fr; }
      img { width: 100%; height: auto; aspect-ratio: 1; }
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">DESI DHUN</p>
    <article class="card">
      <img src="${escapeHtml(imageUrl)}" alt="">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(artist)}</p>
        <video controls playsinline preload="metadata" poster="${escapeHtml(imageUrl)}" src="${escapeHtml(options.videoUrl)}"></video>
        <div class="actions">
          <button type="button" id="share">Share</button>
          <a class="home" href="${escapeHtml(options.appBaseUrl)}">Open Desi Dhun</a>
        </div>
      </div>
    </article>
  </main>
  <script>
    const shareUrl = ${JSON.stringify(pageUrl)};
    const shareTitle = ${JSON.stringify(title)};
    document.getElementById('share')?.addEventListener('click', async () => {
      const button = document.getElementById('share');
      try {
        if (navigator.share) {
          await navigator.share({ title: shareTitle + ' · Desi Dhun', text: 'Listen to “' + shareTitle + '” on Desi Dhun', url: shareUrl });
          return;
        }
        await navigator.clipboard.writeText(shareUrl);
        if (button) button.textContent = 'Link copied';
      } catch (error) {
        if (error?.name === 'AbortError') return;
        if (button) button.textContent = 'Copy failed';
      }
    });
  </script>
</body>
</html>`;
}

export function missingSharedSongHtml(appBaseUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Song unavailable · Desi Dhun</title>
  <meta name="robots" content="noindex">
</head>
<body style="margin:0;background:#0b0917;color:#f4efe5;font-family:Inter,sans-serif;padding:32px 20px">
  <p style="color:#d6a441">DESI DHUN</p>
  <h1>Song unavailable</h1>
  <p>This song is no longer available.</p>
  <a href="${escapeHtml(appBaseUrl)}" style="color:#d6a441">Open Desi Dhun</a>
</body>
</html>`;
}
