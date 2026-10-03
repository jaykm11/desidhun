import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { CoverTheme } from '../../web/src/lib/songIdentity';
import { resolveCoverTheme } from '../../web/src/lib/songIdentity';
import { presetSegments, sanitizeFieldTokens } from '../../web/src/lib/presetFields';
import { presetMatchesSearch, presetTagSet } from '../../web/src/lib/presetTags';

export const PRESET_SONGS = 'presetSongs';

export type PresetCategory = 'songs' | 'messages' | 'reels';

export interface PresetSong {
  id: string;
  title: string;
  category: PresetCategory;
  coverTheme: CoverTheme;
  artistName: string;
  markedByEmail: string | null;
  markedAt: string;
  lyricsExcerpt: string;
  tagLabels: string[];
  tags: string[];
  likeCount: number;
  liked: boolean;
  fieldCount: number;
}

export interface PresetDetail extends PresetSong {
  style: string;
  lyrics: string;
  fieldTokens: number[];
}

export function presetCategoryFor(style: string): PresetCategory {
  if (style.includes('DIALOGUE_PUNCHLINE_DELIVERY')) return 'reels';
  if (style.includes('SPOKEN_WORD_DELIVERY')) return 'messages';
  return 'songs';
}

function asIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const withToDate = value as { toDate?: () => Date } | undefined;
  const date = withToDate?.toDate?.();
  return date instanceof Date ? date.toISOString() : new Date().toISOString();
}

function artistNameFrom(displayName: unknown, email: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  if (typeof email === 'string' && email.includes('@')) return email.split('@')[0] || 'Desi Dhun artist';
  return 'Desi Dhun artist';
}

function storedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}

function tagsFor(title: string, lyrics: string, data: { [field: string]: unknown }): { tagLabels: string[]; tags: string[] } {
  const storedTags = storedStrings(data.tags);
  const storedLabels = storedStrings(data.tagLabels);
  if (storedTags.length > 0) {
    return { tagLabels: storedLabels.length > 0 ? storedLabels : storedTags.slice(0, 2), tags: storedTags };
  }
  return presetTagSet(title, lyrics);
}

function serializePreset(id: string, data: { [field: string]: unknown }, liked = false): PresetSong {
  const title = typeof data.title === 'string' && data.title.trim() ? data.title : 'Untitled';
  const lyrics = typeof data.lyrics === 'string' ? data.lyrics : '';
  const category = data.category === 'messages' || data.category === 'reels' ? data.category : 'songs';
  const tags = tagsFor(title, lyrics, data);
  return {
    id,
    title,
    category,
    coverTheme: resolveCoverTheme(data.coverTheme, title),
    artistName: artistNameFrom(data.artistName, data.artistEmail),
    markedByEmail: typeof data.markedByEmail === 'string' ? data.markedByEmail : null,
    markedAt: asIso(data.markedAt),
    lyricsExcerpt: lyrics.replace(/\[(?:male|female|child)\]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 160),
    tagLabels: tags.tagLabels,
    tags: tags.tags,
    likeCount: typeof data.likeCount === 'number' && data.likeCount > 0 ? Math.floor(data.likeCount) : 0,
    liked,
    fieldCount: presetSegments(lyrics, sanitizeFieldTokens(lyrics, data.fieldTokens))
      .filter((segment) => segment.kind === 'field').length,
  };
}

function presetLikesRef(db: Firestore, viewerUid: string) {
  return db.collection('users').doc(viewerUid).collection('presetLikes');
}

export async function markPresetSong(
  db: Firestore,
  songId: string,
  ownerUid: string,
  song: { [field: string]: unknown },
  admin: { uid: string; email: string | null },
  owner: { displayName?: string | null; email?: string | null },
): Promise<PresetSong> {
  const gcsPath = song.gcsPath;
  if (typeof gcsPath !== 'string' || !gcsPath) {
    throw Object.assign(new Error('Generate the audio before marking it as a preset.'), { status: 400 });
  }
  if (song.status === 'failed' || song.status === 'generating' || song.status === 'rendering') {
    throw Object.assign(new Error('Only finished audio can be marked as a preset.'), { status: 400 });
  }
  const title = typeof song.title === 'string' && song.title.trim() ? song.title.trim() : 'Untitled';
  const style = typeof song.style === 'string' ? song.style : '';
  const lyrics = typeof song.lyrics === 'string' ? song.lyrics : '';
  const tags = presetTagSet(title, lyrics);
  const existing = (await db.collection(PRESET_SONGS).doc(songId).get()).data();
  const existingCategory = existing?.category;
  const record = {
    ownerUid,
    title,
    titleLower: title.toLowerCase(),
    style,
    lyrics,
    category: existingCategory === 'songs' || existingCategory === 'messages' || existingCategory === 'reels'
      ? existingCategory
      : presetCategoryFor(style),
    coverTheme: resolveCoverTheme(song.coverTheme, title, style, lyrics),
    artistName: artistNameFrom(owner.displayName, owner.email),
    artistEmail: owner.email ?? null,
    tagLabels: tags.tagLabels,
    tags: tags.tags,
    gcsPath,
    markedByUid: admin.uid,
    markedByEmail: admin.email,
    markedAt: FieldValue.serverTimestamp(),
  };
  await db.collection(PRESET_SONGS).doc(songId).set(record, { merge: true });
  await db.collection('users').doc(ownerUid).collection('songs').doc(songId).set({
    preset: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return serializePreset(songId, { ...existing, ...record, markedAt: new Date() });
}

export async function unmarkPresetSong(db: Firestore, songId: string): Promise<void> {
  const ref = db.collection(PRESET_SONGS).doc(songId);
  const snapshot = await ref.get();
  const ownerUid = snapshot.data()?.ownerUid;
  await ref.delete();
  if (typeof ownerUid === 'string' && ownerUid) {
    const songRef = db.collection('users').doc(ownerUid).collection('songs').doc(songId);
    if ((await songRef.get()).exists) {
      await songRef.set({ preset: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
}

export async function renamePresetSong(db: Firestore, songId: string, title: string): Promise<void> {
  const ref = db.collection(PRESET_SONGS).doc(songId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const lyrics = typeof snapshot.data()?.lyrics === 'string' ? snapshot.data()!.lyrics as string : '';
  const tags = presetTagSet(title, lyrics);
  await ref.set({ title, titleLower: title.toLowerCase(), tagLabels: tags.tagLabels, tags: tags.tags }, { merge: true });
}

export async function listPresetSongs(db: Firestore, viewerUid: string, search = ''): Promise<PresetSong[]> {
  const [snapshot, likes] = await Promise.all([
    db.collection(PRESET_SONGS).orderBy('markedAt', 'desc').limit(500).get(),
    presetLikesRef(db, viewerUid).select().get(),
  ]);
  const likedIds = new Set(likes.docs.map((doc) => doc.id));
  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      const title = typeof data.title === 'string' ? data.title : '';
      const lyrics = typeof data.lyrics === 'string' ? data.lyrics : '';
      const tags = tagsFor(title, lyrics, data);
      return presetMatchesSearch({
        title,
        artistName: typeof data.artistName === 'string' ? data.artistName : '',
        lyrics,
        tags: [...tags.tags, ...(typeof data.markedByEmail === 'string' ? [data.markedByEmail] : [])],
      }, search);
    })
    .map((doc) => serializePreset(doc.id, doc.data(), likedIds.has(doc.id)));
}

export async function getPresetDetail(db: Firestore, songId: string, viewerUid: string): Promise<PresetDetail | null> {
  const [snapshot, like] = await Promise.all([
    db.collection(PRESET_SONGS).doc(songId).get(),
    presetLikesRef(db, viewerUid).doc(songId).get(),
  ]);
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  const lyrics = typeof data.lyrics === 'string' ? data.lyrics : '';
  return {
    ...serializePreset(songId, data, like.exists),
    style: typeof data.style === 'string' ? data.style : '',
    lyrics,
    fieldTokens: sanitizeFieldTokens(lyrics, data.fieldTokens),
  };
}

export async function setPresetCategory(db: Firestore, songId: string, category: unknown, viewerUid: string): Promise<PresetSong> {
  if (category !== 'songs' && category !== 'messages' && category !== 'reels') {
    throw Object.assign(new Error('Choose Songs, Messages, or Reels.'), { status: 400 });
  }
  const ref = db.collection(PRESET_SONGS).doc(songId);
  if (!(await ref.get()).exists) throw Object.assign(new Error('That preset is no longer available.'), { status: 404 });
  await ref.set({ category }, { merge: true });
  return (await getPresetDetail(db, songId, viewerUid))!;
}

export async function setPresetFields(db: Firestore, songId: string, candidate: unknown, viewerUid: string): Promise<PresetDetail> {
  const ref = db.collection(PRESET_SONGS).doc(songId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error('That preset is no longer available.'), { status: 404 });
  const lyrics = typeof snapshot.data()?.lyrics === 'string' ? snapshot.data()!.lyrics as string : '';
  await ref.set({ fieldTokens: sanitizeFieldTokens(lyrics, candidate) }, { merge: true });
  return (await getPresetDetail(db, songId, viewerUid))!;
}

export async function likePresetSong(db: Firestore, songId: string, viewerUid: string, liked: boolean): Promise<PresetSong> {
  const presetRef = db.collection(PRESET_SONGS).doc(songId);
  const likeRef = presetLikesRef(db, viewerUid).doc(songId);
  return db.runTransaction(async (transaction) => {
    const [presetSnap, likeSnap] = await Promise.all([transaction.get(presetRef), transaction.get(likeRef)]);
    if (!presetSnap.exists) {
      throw Object.assign(new Error('That preset is no longer available.'), { status: 404 });
    }
    const data = presetSnap.data() ?? {};
    const current = typeof data.likeCount === 'number' && data.likeCount > 0 ? Math.floor(data.likeCount) : 0;
    if (likeSnap.exists === liked) return serializePreset(songId, data, liked);
    const delta = liked ? 1 : -1;
    if (liked) transaction.set(likeRef, { likedAt: FieldValue.serverTimestamp() });
    else transaction.delete(likeRef);
    transaction.update(presetRef, { likeCount: FieldValue.increment(delta) });
    return serializePreset(songId, { ...data, likeCount: Math.max(0, current + delta) }, liked);
  });
}


export async function getPresetAudioPath(db: Firestore, songId: string): Promise<{ path: string; title: string } | null> {
  const snapshot = await db.collection(PRESET_SONGS).doc(songId).get();
  const path = snapshot.data()?.gcsPath;
  if (!snapshot.exists || typeof path !== 'string' || !path) return null;
  const title = typeof snapshot.data()?.title === 'string' ? snapshot.data()!.title : 'desi-dhun-preset';
  return { path, title };
}
