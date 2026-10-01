import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { NowPlayingBar } from '@/components/NowPlayingBar';
import { Banner, Caption, ChipRow, EmptyState, Loading, Title, styles } from '@/components/ui';
import {
  errorMessage,
  listCommunitySongs,
  rateCommunitySong,
  recordCommunityPlay,
  type CommunitySong,
  type CommunityVote,
} from '@/lib/api';
import { communitySongFile, shareSongLink } from '@/lib/media';
import { usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/theme';
import { displaySongTitle } from '@shared/lib/songName';

const SORTS = [
  { id: 'featured', name: 'Featured' },
  { id: 'top', name: 'Top' },
  { id: 'favorites', name: 'Favourites' },
] as const;

type Sort = (typeof SORTS)[number]['id'];

export default function ExploreScreen() {
  const { user } = useAuth();
  const player = usePlayer();
  const [sort, setSort] = useState<Sort>('featured');
  const [songs, setSongs] = useState<CommunitySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { songs: next } = await listCommunitySongs(user, sort, 30);
      setSongs(next);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Community songs could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, sort]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const play = async (song: CommunitySong) => {
    if (!user) return;
    await player.toggle({
      id: song.id,
      title: displaySongTitle(song.title),
      resolve: () => communitySongFile(user, song.id),
    });
    void recordCommunityPlay(user, song.id).catch(() => undefined);
  };

  const vote = async (song: CommunitySong, next: CommunityVote) => {
    if (!user) return;
    try {
      const { song: updated } = await rateCommunitySong(user, song.id, song.myVote === next ? null : next);
      setSongs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cause) {
      setError(errorMessage(cause, 'Your vote could not be saved.'));
    }
  };

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
          <View style={{ gap: spacing.md }}>
            <Title>Explore</Title>
            <ChipRow options={SORTS} value={sort} onChange={setSort} />
            {error ? <Banner tone="error" message={error} /> : null}
            {loading ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="compass-outline"
              title="Nothing here yet"
              message="Published community songs will show up in this list."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => {
          const isCurrent = player.trackId === item.id;
          return (
            <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isCurrent && player.isPlaying ? 'Pause' : 'Play'}
                onPress={() => void play(item)}
                hitSlop={6}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                }}
              >
                <Ionicons
                  name={isCurrent && player.isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={colors.background}
                />
              </Pressable>

              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ ...typography.subheading, color: colors.text }}>
                  {displaySongTitle(item.title)}
                </Text>
                <Caption>
                  {item.artistName} · {item.viewCount} plays
                </Caption>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Like"
                hitSlop={6}
                onPress={() => void vote(item, 'like')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons
                  name={item.myVote === 'like' ? 'heart' : 'heart-outline'}
                  size={20}
                  color={item.myVote === 'like' ? colors.accent : colors.textMuted}
                />
                <Text style={{ ...typography.caption, color: colors.textMuted }}>{item.likeCount}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share"
                hitSlop={6}
                onPress={() => void shareSongLink(item.id, item.title)}
              >
                <Ionicons name="share-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        }}
      />
      <NowPlayingBar />
    </View>
  );
}
