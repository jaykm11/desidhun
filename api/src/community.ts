import { FieldValue, Timestamp, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { CoverTheme } from '../../web/src/lib/songIdentity';
import { resolveCoverTheme } from '../../web/src/lib/songIdentity';
import { PRESET_SONGS } from './presets';

export const COMMUNITY_SONGS = 'communitySongs';
export const SONG_LINKS = 'songLinks';

export type CommunitySort = 'featured' | 'top' | 'favorites';

export type CommunityVote = 'like' | 'dislike';

export type ExploreKind = 'songs' | 'reels' | 'music' | 'podcast';

export const EXPLORE_KINDS: readonly ExploreKind[] = ['songs', 'reels', 'music', 'podcast'];

export interface CommunitySong {
  id: string;
  title: string;
  artistName: string;
  coverTheme: CoverTheme;
  kind: ExploreKind;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  myVote: CommunityVote | null;
}

export interface ExploreRail {
  featured: CommunitySong[];
  top: CommunitySong[];
  favorites: CommunitySong[];
}

export type ExploreRails = Record<ExploreKind, ExploreRail>;

export function exploreKindFor(style: string, lyrics: string): ExploreKind {
  if (style.includes('DIALOGUE_PUNCHLINE_DELIVERY')) return 'reels';
  if (style.includes('SPOKEN_WORD_DELIVERY')) return 'podcast';
  if (/instrumental composition only/i.test(`${style}\n${lyrics}`)) return 'music';
  return 'songs';
}

function asExploreKind(value: unknown): ExploreKind | null {
  return value === 'songs' || value === 'reels' || value === 'music' || value === 'podcast' ? value : null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const withToDate = value as { toDate?: () => Date } | undefined;
  return withToDate?.toDate?.() instanceof Date ? withToDate.toDate() : null;
}

function artistNameFrom(displayName: unknown, email: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  if (typeof email === 'string' && email.includes('@')) return email.split('@')[0] || 'Desi Dhun artist';
  return 'Desi Dhun artist';
}

function countField(value: unknown): number {
  return typeof value === 'number' && value > 0 ? Math.floor(value) : 0;
}

export function serializeCommunitySong(
  id: string,
  data: { [field: string]: unknown },
  myVote: CommunityVote | null = null,
): CommunitySong {
  const published = asDate(data.publishedAt) ?? new Date();
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : 'Untitled',
    artistName: artistNameFrom(data.artistName, data.artistEmail),
    coverTheme: resolveCoverTheme(data.coverTheme, typeof data.title === 'string' ? data.title : ''),
    kind: asExploreKind(data.kind) ?? exploreKindFor(
      typeof data.style === 'string' ? data.style : '',
      typeof data.lyrics === 'string' ? data.lyrics : '',
    ),
    publishedAt: published.toISOString(),
    viewCount: countField(data.viewCount),
    likeCount: countField(data.likeCount),
    dislikeCount: countField(data.dislikeCount),
    myVote,
  };
}

export async function getCommunitySong(db: Firestore, songId: string): Promise<CommunitySong | null> {
  const snapshot = await db.collection(COMMUNITY_SONGS).doc(songId).get();
  if (!snapshot.exists) return null;
  return serializeCommunitySong(songId, snapshot.data() ?? {});
}

export async function getCommunitySongAudioPath(db: Firestore, songId: string): Promise<{ path: string; title: string } | null> {
  const snapshot = await db.collection(COMMUNITY_SONGS).doc(songId).get();
  if (!snapshot.exists) return null;
  const path = snapshot.data()?.gcsPath;
  if (typeof path !== 'string' || !path) return null;
  const title = typeof snapshot.data()?.title === 'string' ? snapshot.data()!.title : 'hindi-song';
  return { path, title };
}

export async function upsertSongLink(
  db: Firestore,
  songId: string,
  ownerUid: string,
  song: { [field: string]: unknown },
  owner?: { displayName?: string | null; email?: string | null },
): Promise<void> {
  const gcsPath = song.gcsPath;
  if (typeof gcsPath !== 'string' || !gcsPath) {
    throw Object.assign(new Error('Generate the song before creating a shareable link.'), { status: 400 });
  }
  if (song.status === 'failed' || song.status === 'generating' || song.status === 'rendering') {
    throw Object.assign(new Error('Only a finished song can be shared with a link.'), { status: 400 });
  }

  let displayName = owner?.displayName ?? null;
  let email = owner?.email ?? null;
  if (!displayName && !email) {
    const user = await db.collection('users').doc(ownerUid).get();
    displayName = (user.data()?.displayName as string | null | undefined) ?? null;
    email = (user.data()?.email as string | null | undefined) ?? null;
  }

  const title = typeof song.title === 'string' && song.title.trim() ? song.title.trim() : 'Untitled';
  await db.collection(SONG_LINKS).doc(songId).set({
    ownerUid,
    title,
    artistName: artistNameFrom(displayName, email),
    artistEmail: email,
    coverTheme: resolveCoverTheme(song.coverTheme, title),
    gcsPath,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function refreshSongLinkIfPresent(
  db: Firestore,
  songId: string,
  ownerUid: string,
  song: { [field: string]: unknown },
): Promise<void> {
  const snapshot = await db.collection(SONG_LINKS).doc(songId).get();
  if (!snapshot.exists) return;
  await upsertSongLink(db, songId, ownerUid, song);
}

export async function renameSongLink(db: Firestore, songId: string, title: string): Promise<void> {
  const snapshot = await db.collection(SONG_LINKS).doc(songId).get();
  if (!snapshot.exists) return;
  await snapshot.ref.set({ title, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteSongLink(db: Firestore, songId: string): Promise<void> {
  await db.collection(SONG_LINKS).doc(songId).delete().catch(() => undefined);
}

export async function getSharedSong(db: Firestore, songId: string): Promise<CommunitySong | null> {
  const published = await getCommunitySong(db, songId);
  if (published) return published;
  const snapshot = await db.collection(SONG_LINKS).doc(songId).get();
  if (snapshot.exists) return serializeCommunitySong(songId, snapshot.data() ?? {});
  const preset = await db.collection(PRESET_SONGS).doc(songId).get();
  if (!preset.exists) return null;
  return serializeCommunitySong(songId, { ...preset.data(), publishedAt: preset.data()?.markedAt });
}

export async function getSharedSongAudioPath(db: Firestore, songId: string): Promise<{ path: string; title: string } | null> {
  const published = await getCommunitySongAudioPath(db, songId);
  if (published) return published;
  let snapshot = await db.collection(SONG_LINKS).doc(songId).get();
  if (!snapshot.exists) snapshot = await db.collection(PRESET_SONGS).doc(songId).get();
  if (!snapshot.exists) return null;
  const path = snapshot.data()?.gcsPath;
  if (typeof path !== 'string' || !path) return null;
  const title = typeof snapshot.data()?.title === 'string' ? snapshot.data()!.title : 'hindi-song';
  return { path, title };
}

export async function unpublishCommunitySong(db: Firestore, songId: string): Promise<void> {
  await db.collection(COMMUNITY_SONGS).doc(songId).delete();
}

export async function renameCommunitySong(db: Firestore, songId: string, title: string): Promise<void> {
  const snapshot = await db.collection(COMMUNITY_SONGS).doc(songId).get();
  if (!snapshot.exists) return;
  await snapshot.ref.set({ title, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function publishCommunitySong(
  db: Firestore,
  songId: string,
  ownerUid: string,
  song: { [field: string]: unknown },
  owner: { displayName?: string | null; email?: string | null },
): Promise<CommunitySong> {
  const gcsPath = song.gcsPath;
  if (typeof gcsPath !== 'string' || !gcsPath) {
    throw Object.assign(new Error('Generate the song before sharing it with the community.'), { status: 400 });
  }
  if (song.status === 'failed' || song.status === 'generating' || song.status === 'rendering') {
    throw Object.assign(new Error('Only a finished song can be shared with the community.'), { status: 400 });
  }

  const title = typeof song.title === 'string' && song.title.trim() ? song.title.trim() : 'Untitled';
  const style = typeof song.style === 'string' ? song.style : '';
  const lyrics = typeof song.lyrics === 'string' ? song.lyrics : '';
  const coverTheme = resolveCoverTheme(song.coverTheme, title, style, lyrics);
  const artistName = artistNameFrom(owner.displayName, owner.email);
  const kind = exploreKindFor(style, lyrics);
  const existing = await db.collection(COMMUNITY_SONGS).doc(songId).get();
  const publishedAt = existing.exists
    ? (existing.data()?.publishedAt ?? FieldValue.serverTimestamp())
    : FieldValue.serverTimestamp();
  const previous = existing.data() ?? {};
  const viewCount = countField(previous.viewCount);
  const likeCount = countField(previous.likeCount);
  const dislikeCount = countField(previous.dislikeCount);

  await db.collection(COMMUNITY_SONGS).doc(songId).set({
    ownerUid,
    title,
    artistName,
    artistEmail: owner.email ?? null,
    coverTheme,
    kind,
    style,
    lyrics,
    gcsPath,
    publishedAt,
    viewCount,
    likeCount,
    dislikeCount,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('users').doc(ownerUid).collection('songs').doc(songId).set({
    visibility: 'public',
    publishedAt: existing.exists ? publishedAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const saved = await db.collection(COMMUNITY_SONGS).doc(songId).get();
  return serializeCommunitySong(songId, saved.data() ?? {
    title, artistName, coverTheme, viewCount, likeCount, dislikeCount, publishedAt: new Date(),
  });
}

export async function makeCommunitySongPrivate(db: Firestore, ownerUid: string, songId: string): Promise<void> {
  await unpublishCommunitySong(db, songId);
  const songRef = db.collection('users').doc(ownerUid).collection('songs').doc(songId);
  const snapshot = await songRef.get();
  if (snapshot.exists) {
    await songRef.set({
      visibility: 'private',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function resolvedExploreKind(
  db: Firestore,
  songId: string,
  data: { [field: string]: unknown },
): Promise<ExploreKind> {
  const stored = asExploreKind(data.kind);
  if (stored) return stored;
  let style = typeof data.style === 'string' ? data.style : '';
  let lyrics = typeof data.lyrics === 'string' ? data.lyrics : '';
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : '';
  if (!style && !lyrics && ownerUid) {
    const source = await db.collection('users').doc(ownerUid).collection('songs').doc(songId).get();
    const sourceData = source.data() ?? {};
    style = typeof sourceData.style === 'string' ? sourceData.style : '';
    lyrics = typeof sourceData.lyrics === 'string' ? sourceData.lyrics : '';
  }
  const kind = exploreKindFor(style, lyrics);
  await db.collection(COMMUNITY_SONGS).doc(songId).set({ kind }, { merge: true }).catch(() => undefined);
  return kind;
}

async function songsWithKind(
  db: Firestore,
  docs: QueryDocumentSnapshot[],
): Promise<CommunitySong[]> {
  const songs: CommunitySong[] = [];
  for (let index = 0; index < docs.length; index += 20) {
    const chunk = docs.slice(index, index + 20);
    songs.push(...await Promise.all(chunk.map(async (doc) => {
      const data = doc.data();
      const kind = await resolvedExploreKind(db, doc.id, data);
      return serializeCommunitySong(doc.id, { ...data, kind });
    })));
  }
  return songs;
}

function byPopularity(left: CommunitySong, right: CommunitySong): number {
  return right.likeCount - left.likeCount
    || right.viewCount - left.viewCount
    || right.publishedAt.localeCompare(left.publishedAt);
}

async function attachVotes(db: Firestore, songs: CommunitySong[], viewerUid: string): Promise<CommunitySong[]> {
  const votes = await Promise.all(songs.map((song) => (
    db.collection(COMMUNITY_SONGS).doc(song.id).collection('votes').doc(viewerUid).get()
  )));
  return songs.map((song, index) => {
    const vote = votes[index].data()?.vote;
    return { ...song, myVote: vote === 'like' || vote === 'dislike' ? vote : null };
  });
}

export async function listCommunitySongs(
  db: Firestore,
  sort: CommunitySort,
  limit: number,
  viewerUid: string,
  kind?: ExploreKind,
): Promise<CommunitySong[]> {
  const snapshot = await db
    .collection(COMMUNITY_SONGS)
    .orderBy('publishedAt', 'desc')
    .limit(kind ? 240 : sort === 'top' ? Math.max(limit, 48) : limit)
    .get();
  const songs = kind
    ? (await songsWithKind(db, snapshot.docs)).filter((song) => song.kind === kind)
    : snapshot.docs.map((doc) => serializeCommunitySong(doc.id, doc.data()));
  if (sort === 'top') songs.sort(byPopularity);
  const page = songs.slice(0, limit);
  return attachVotes(db, page, viewerUid);
}

export async function listExploreRails(db: Firestore, viewerUid: string, limit = 6): Promise<ExploreRails> {
  const snapshot = await db.collection(COMMUNITY_SONGS).orderBy('publishedAt', 'desc').limit(240).get();
  const songs = await songsWithKind(db, snapshot.docs);
  const favorites = await listFavoriteCommunitySongs(db, viewerUid, 48);
  const rails = {} as ExploreRails;
  for (const kind of EXPLORE_KINDS) {
    const matching = songs.filter((song) => song.kind === kind);
    const featured = matching.slice(0, limit);
    const top = [...matching].sort(byPopularity).slice(0, limit);
    const liked = favorites.filter((song) => song.kind === kind).slice(0, limit);
    rails[kind] = {
      featured: await attachVotes(db, featured, viewerUid),
      top: await attachVotes(db, top, viewerUid),
      favorites: liked,
    };
  }
  return rails;
}

export async function listPublicTopCommunitySongs(db: Firestore, limit: number): Promise<CommunitySong[]> {
  const snapshot = await db.collection(COMMUNITY_SONGS).orderBy('publishedAt', 'desc').limit(80).get();
  const songs = snapshot.docs.map((doc) => serializeCommunitySong(doc.id, doc.data()));
  songs.sort((left, right) => (
    right.likeCount - left.likeCount
    || right.viewCount - left.viewCount
    || right.publishedAt.localeCompare(left.publishedAt)
  ));
  return songs.slice(0, limit);
}

export async function rateCommunitySong(
  db: Firestore,
  songId: string,
  viewerUid: string,
  nextVote: CommunityVote | null,
): Promise<CommunitySong> {
  const songRef = db.collection(COMMUNITY_SONGS).doc(songId);
  const voteRef = songRef.collection('votes').doc(viewerUid);
  const saved = await db.runTransaction(async (transaction) => {
    const [songSnap, voteSnap] = await Promise.all([
      transaction.get(songRef),
      transaction.get(voteRef),
    ]);
    if (!songSnap.exists) {
      throw Object.assign(new Error('That song is not in the community library.'), { status: 404 });
    }
    const previous = voteSnap.data()?.vote === 'like' || voteSnap.data()?.vote === 'dislike'
      ? voteSnap.data()!.vote as CommunityVote
      : null;
    if (previous === nextVote) {
      return serializeCommunitySong(songId, songSnap.data() ?? {}, previous);
    }
    const likeDelta = (nextVote === 'like' ? 1 : 0) - (previous === 'like' ? 1 : 0);
    const dislikeDelta = (nextVote === 'dislike' ? 1 : 0) - (previous === 'dislike' ? 1 : 0);
    if (nextVote) {
      transaction.set(voteRef, { vote: nextVote, viewerUid, updatedAt: FieldValue.serverTimestamp() });
    } else {
      transaction.delete(voteRef);
    }
    transaction.update(songRef, {
      likeCount: FieldValue.increment(likeDelta),
      dislikeCount: FieldValue.increment(dislikeDelta),
    });
    const data = songSnap.data() ?? {};
    return serializeCommunitySong(songId, {
      ...data,
      likeCount: countField(data.likeCount) + likeDelta,
      dislikeCount: countField(data.dislikeCount) + dislikeDelta,
    }, nextVote);
  });
  const favoriteRef = db.collection('users').doc(viewerUid).collection('favoriteSongs').doc(songId);
  if (saved.myVote === 'like') {
    await favoriteRef.set({ songId, likedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await favoriteRef.delete().catch(() => undefined);
  }
  return saved;
}

export async function listFavoriteCommunitySongs(
  db: Firestore,
  viewerUid: string,
  limit: number,
): Promise<CommunitySong[]> {
  const favoritesRef = db.collection('users').doc(viewerUid).collection('favoriteSongs');
  let favoriteIds: string[];
  try {
    favoriteIds = (await favoritesRef.orderBy('likedAt', 'desc').limit(limit).get()).docs.map((doc) => doc.id);
  } catch {
    favoriteIds = (await favoritesRef.limit(limit).get()).docs.map((doc) => doc.id);
  }

  if (favoriteIds.length < limit) {
    const recent = await db.collection(COMMUNITY_SONGS).orderBy('publishedAt', 'desc').limit(80).get();
    const votes = await Promise.all(recent.docs.map((doc) => (
      db.collection(COMMUNITY_SONGS).doc(doc.id).collection('votes').doc(viewerUid).get()
    )));
    const liked = recent.docs.flatMap((doc, index) => (
      votes[index].data()?.vote === 'like' && !favoriteIds.includes(doc.id)
        ? [{ id: doc.id, votedAt: votes[index].updateTime }]
        : []
    ));
    await Promise.all(liked.map((item) => (
      favoritesRef.doc(item.id).set({
        songId: item.id,
        likedAt: item.votedAt ?? FieldValue.serverTimestamp(),
      }, { merge: true })
    )));
    favoriteIds = [...favoriteIds, ...liked.map((item) => item.id)].slice(0, limit);
  }

  const songs = await Promise.all(favoriteIds.map(async (songId) => {
    const snapshot = await db.collection(COMMUNITY_SONGS).doc(songId).get();
    if (!snapshot.exists) {
      await favoritesRef.doc(songId).delete().catch(() => undefined);
      return null;
    }
    const data = snapshot.data() ?? {};
    const kind = await resolvedExploreKind(db, songId, data);
    return serializeCommunitySong(songId, { ...data, kind }, 'like');
  }));
  return songs.filter((song): song is CommunitySong => song !== null);
}

export async function recordCommunityPlay(db: Firestore, songId: string, viewerUid: string): Promise<number> {
  const songRef = db.collection(COMMUNITY_SONGS).doc(songId);
  const viewerRef = songRef.collection('viewers').doc(viewerUid);
  return db.runTransaction(async (transaction) => {
    const [songSnap, viewerSnap] = await Promise.all([
      transaction.get(songRef),
      transaction.get(viewerRef),
    ]);
    if (!songSnap.exists) {
      throw Object.assign(new Error('That song is not in the community library.'), { status: 404 });
    }
    const last = asDate(viewerSnap.data()?.viewedAt);
    const alreadyCounted = last !== null && Date.now() - last.getTime() < 60 * 60_000;
    if (!alreadyCounted) {
      transaction.set(viewerRef, { viewedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.update(songRef, { viewCount: FieldValue.increment(1) });
    }
    const current = typeof songSnap.data()?.viewCount === 'number' ? songSnap.data()!.viewCount : 0;
    return alreadyCounted ? current : current + 1;
  });
}
