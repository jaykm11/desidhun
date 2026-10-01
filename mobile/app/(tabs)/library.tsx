import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { NowPlayingBar } from '@/components/NowPlayingBar';
import { Banner, Caption, EmptyState, IconButton, Loading, Title, styles } from '@/components/ui';
import {
  deleteLibrarySong,
  errorMessage,
  listLibrarySongs,
  setSongVisibility,
  songIsPending,
  type LibrarySong,
} from '@/lib/api';
import { forgetCachedAudio, librarySongFile, librarySongVideoFile, shareVideoFile } from '@/lib/media';
import { usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/theme';
import { displaySongTitle } from '@shared/lib/songName';

function statusLabel(song: LibrarySong): string {
  if (song.status === 'generating') return 'Preparing…';
  if (song.status === 'rendering') return 'Composing…';
  if (song.status === 'failed') return song.error ?? 'Failed';
  return new Date(song.createdAt).toLocaleDateString();
}

export default function LibraryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const player = usePlayer();
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { songs: next } = await listLibrarySongs(user);
      setSongs(next);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Your songs could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep polling only while something is still rendering on the server.
  useEffect(() => {
    if (!songs.some(songIsPending)) return;
    const timer = setInterval(() => void load(), 3_000);
    return () => clearInterval(timer);
  }, [songs, load]);

  const play = async (song: LibrarySong) => {
    if (!user) return;
    await player.toggle({
      id: song.id,
      title: displaySongTitle(song.title),
      resolve: () => librarySongFile(user, song.id),
    });
  };

  const share = async (song: LibrarySong) => {
    if (!user) return;
    try {
      const uri = await librarySongVideoFile(user, song.id);
      await shareVideoFile(uri, displaySongTitle(song.title));
    } catch (cause) {
      setError(errorMessage(cause, 'The video could not be shared.'));
    }
  };

  const remove = (song: LibrarySong) => {
    Alert.alert('Delete song', `Delete “${displaySongTitle(song.title)}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!user) return;
          void deleteLibrarySong(user, song.id)
            .then(() => {
              forgetCachedAudio(song.id);
              setSongs((current) => current.filter((item) => item.id !== song.id));
            })
            .catch((cause) => setError(errorMessage(cause, 'The song could not be deleted.')));
        },
      },
    ]);
  };

  const toggleVisibility = async (song: LibrarySong) => {
    if (!user) return;
    try {
      const { song: updated } = await setSongVisibility(
        user,
        song.id,
        song.visibility === 'public' ? 'private' : 'public',
      );
      setSongs((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch (cause) {
      setError(errorMessage(cause, 'The song visibility could not be changed.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Loading label="Loading your songs…" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={songs}
        keyExtractor={(song) => song.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <Title>Library</Title>
            {error ? <Banner tone="error" message={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="albums-outline"
            title="No songs yet"
            message="Head to the Create tab to make your first track."
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => {
          const pendingItem = songIsPending(item);
          const failed = item.status === 'failed';
          const isCurrent = player.trackId === item.id;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/song/${item.id}`)}
              style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isCurrent && player.isPlaying ? 'Pause' : 'Play'}
                disabled={pendingItem || failed}
                onPress={() => void play(item)}
                hitSlop={6}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pendingItem || failed ? colors.border : colors.accent,
                }}
              >
                <Ionicons
                  name={pendingItem ? 'hourglass' : failed ? 'alert' : isCurrent && player.isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={pendingItem || failed ? colors.textMuted : colors.background}
                />
              </Pressable>

              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ ...typography.subheading, color: colors.text }}>
                  {displaySongTitle(item.title)}
                </Text>
                <Caption>{statusLabel(item)}</Caption>
              </View>

              <IconButton
                icon={item.visibility === 'public' ? 'globe' : 'lock-closed'}
                label="Toggle visibility"
                disabled={pendingItem || failed}
                onPress={() => void toggleVisibility(item)}
              />
              <IconButton
                icon="share-outline"
                label="Share"
                disabled={pendingItem || failed}
                onPress={() => void share(item)}
              />
              <IconButton icon="trash-outline" label="Delete" tint={colors.danger} onPress={() => remove(item)} />
            </Pressable>
          );
        }}
      />
      <NowPlayingBar />
    </View>
  );
}
