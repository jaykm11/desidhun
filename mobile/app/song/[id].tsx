import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import {
  Banner,
  Button,
  Caption,
  Card,
  Heading,
  Input,
  Loading,
  ScreenScroll,
  Section,
  SliderRow,
  Title,
  styles,
} from '@/components/ui';
import {
  createShareableLink,
  errorMessage,
  listLibrarySongs,
  renameLibrarySong,
  saveSongFeedback,
  setSongVisibility,
  songIsPending,
  songShareUrl,
  type LibrarySong,
} from '@/lib/api';
import { librarySongFile, librarySongVideoFile, shareSongLink, shareVideoFile } from '@/lib/media';
import { formatPlaybackTime, usePlayer } from '@/player/PlayerProvider';
import { colors, spacing, typography } from '@/theme';
import { displaySongTitle } from '@shared/lib/songName';

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const player = usePlayer();
  const [song, setSong] = useState<LibrarySong | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const { songs } = await listLibrarySongs(user);
      const found = songs.find((item) => item.id === id) ?? null;
      setSong(found);
      setTitle(found ? displaySongTitle(found.title) : '');
      setError(found ? null : 'This song is no longer in your library.');
    } catch (cause) {
      setError(errorMessage(cause, 'The song could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Loading />
      </View>
    );
  }

  if (!song) {
    return (
      <ScreenScroll>
        <Banner tone="error" message={error ?? 'This song could not be found.'} />
      </ScreenScroll>
    );
  }

  const pending = songIsPending(song);
  const isCurrent = player.trackId === song.id;

  const rename = async () => {
    if (!user) return;
    const next = title.trim();
    if (!next || next === displaySongTitle(song.title)) return;
    try {
      const { song: updated } = await renameLibrarySong(user, song.id, next);
      setSong(updated);
      setNotice('Title saved.');
    } catch (cause) {
      setError(errorMessage(cause, 'The song could not be renamed.'));
    }
  };

  const rate = async (rating: number) => {
    if (!user) return;
    try {
      const { song: updated } = await saveSongFeedback(user, song.id, rating);
      setSong(updated);
    } catch (cause) {
      setError(errorMessage(cause, 'Your rating could not be saved.'));
    }
  };

  const publish = async () => {
    if (!user) return;
    try {
      const { song: updated } = await setSongVisibility(
        user,
        song.id,
        song.visibility === 'public' ? 'private' : 'public',
      );
      setSong(updated);
      setNotice(updated.visibility === 'public' ? 'Published to the community.' : 'This song is private again.');
    } catch (cause) {
      setError(errorMessage(cause, 'The visibility could not be changed.'));
    }
  };

  const copyLink = async () => {
    if (!user) return;
    try {
      await createShareableLink(user, song.id);
      await Clipboard.setStringAsync(songShareUrl(song.id));
      setNotice('Link copied to the clipboard.');
    } catch (cause) {
      setError(errorMessage(cause, 'The link could not be created.'));
    }
  };

  const shareFile = async () => {
    if (!user) return;
    try {
      const uri = await librarySongVideoFile(user, song.id);
      await shareVideoFile(uri, displaySongTitle(song.title));
    } catch (cause) {
      setError(errorMessage(cause, 'The video could not be shared.'));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: displaySongTitle(song.title) }} />
      <ScreenScroll>
        <Title>{displaySongTitle(song.title)}</Title>
        {error ? <Banner tone="error" message={error} /> : null}
        {notice ? <Banner tone="success" message={notice} /> : null}

        <Card>
          <Button
            label={pending ? 'Still composing…' : isCurrent && player.isPlaying ? 'Pause' : 'Play'}
            icon={isCurrent && player.isPlaying ? 'pause' : 'play'}
            busy={isCurrent && player.isLoading}
            disabled={pending || song.status === 'failed'}
            onPress={() =>
              void player.toggle({
                id: song.id,
                title: displaySongTitle(song.title),
                resolve: () => librarySongFile(user!, song.id),
              })
            }
          />
          {isCurrent && player.duration > 0 ? (
            <SliderRow
              label="Position"
              value={Math.floor(player.position)}
              min={0}
              max={Math.max(1, Math.floor(player.duration))}
              onChange={(next) => void player.seekTo(next)}
              hint={`${formatPlaybackTime(player.position)} / ${formatPlaybackTime(player.duration)}`}
            />
          ) : null}
          {song.status === 'failed' ? <Banner tone="error" message={song.error ?? 'This song failed.'} /> : null}
        </Card>

        <Card>
          <Heading>Share</Heading>
          <Button label="Share a video" variant="secondary" icon="share" disabled={pending} onPress={() => void shareFile()} />
          <Button
            label="Share a link"
            variant="secondary"
            icon="link"
            disabled={pending}
            onPress={() => void shareSongLink(song.id, song.title)}
          />
          <Button label="Copy link" variant="ghost" icon="copy" disabled={pending} onPress={() => void copyLink()} />
          <Button
            label={song.visibility === 'public' ? 'Make private' : 'Publish to community'}
            variant="ghost"
            icon={song.visibility === 'public' ? 'lock-closed' : 'globe'}
            disabled={pending}
            onPress={() => void publish()}
          />
        </Card>

        <Card>
          <Heading>Title</Heading>
          <Input value={title} onChangeText={setTitle} maxLength={80} onBlur={() => void rename()} />
          <Caption>Tap outside the field to save.</Caption>
        </Card>

        <Card>
          <SliderRow
            label="Your rating"
            value={song.rating ?? 0}
            min={0}
            max={5}
            onChange={(next) => void rate(next)}
            hint={`${song.rating ?? 0}/5`}
          />
        </Card>

        <Section label="Lyrics">
          <Card>
            <Text style={{ ...typography.body, color: colors.textMuted, lineHeight: 22 }}>
              {song.lyrics?.trim() || 'This track has no lyrics.'}
            </Text>
          </Card>
        </Section>

        <Section label="Style prompt">
          <Card>
            <Text style={{ ...typography.caption, color: colors.textFaint }}>{song.style}</Text>
          </Card>
        </Section>

        <View style={{ height: spacing.xl }} />
      </ScreenScroll>
    </>
  );
}
