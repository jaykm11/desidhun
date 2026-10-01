import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { NowPlayingBar } from '@/components/NowPlayingBar';
import { Banner, Caption, Heading, Loading, Title, styles } from '@/components/ui';
import {
  errorMessage,
  listCommunityExplore,
  rateCommunitySong,
  recordCommunityPlay,
  type CommunitySong,
  type CommunityVote,
  type ExploreKind,
  type ExploreRail,
  type ExploreRails,
} from '@/lib/api';
import { communitySongFile, shareSongVideo } from '@/lib/media';
import { usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/theme';
import { displaySongTitle } from '@shared/lib/songName';

const SECTIONS: readonly { id: ExploreKind; title: string }[] = [
  { id: 'songs', title: 'Songs' },
  { id: 'reels', title: 'Reels' },
  { id: 'music', title: 'Music' },
  { id: 'podcast', title: 'Podcasts' },
];

const LISTS: readonly { id: keyof ExploreRail; title: string }[] = [
  { id: 'featured', title: 'Featured' },
  { id: 'top', title: 'Top' },
  { id: 'favorites', title: 'Favorites' },
];

const EMPTY_RAIL: ExploreRail = { featured: [], top: [], favorites: [] };

export default function ExploreScreen() {
  const { user } = useAuth();
  const player = usePlayer();
  const [rails, setRails] = useState<ExploreRails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { rails: next } = await listCommunityExplore(user);
      setRails(next);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Community songs could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
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
    if (!user || !rails) return;
    try {
      const { song: updated } = await rateCommunitySong(user, song.id, song.myVote === next ? null : next);
      const kind = updated.kind ?? song.kind ?? 'songs';
      setRails((current) => {
        if (!current) return current;
        const mapped = { ...current };
        for (const section of SECTIONS) {
          const rail = current[section.id];
          const mapSong = (item: CommunitySong) => item.id === song.id ? { ...item, ...updated } : item;
          mapped[section.id] = {
            featured: rail.featured.map(mapSong),
            top: rail.top.map(mapSong),
            favorites: section.id !== kind
              ? rail.favorites.filter((item) => item.id !== updated.id)
              : updated.myVote === 'like'
                ? (rail.favorites.some((item) => item.id === updated.id)
                  ? rail.favorites.map(mapSong)
                  : [updated, ...rail.favorites].slice(0, 6))
                : rail.favorites.filter((item) => item.id !== updated.id),
          };
        }
        return mapped;
      });
    } catch (cause) {
      setError(errorMessage(cause, 'Your vote could not be saved.'));
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
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
      >
        <Title>Explore</Title>
        {error ? <Banner tone="error" message={error} /> : null}
        {loading ? <Loading /> : null}
        {SECTIONS.map((section) => {
          const rail = rails?.[section.id] ?? EMPTY_RAIL;
          return (
            <View key={section.id} style={{ gap: spacing.md, marginTop: spacing.lg }}>
              <Heading>{section.title}</Heading>
              {LISTS.map((list) => {
                const songs = rail[list.id];
                return (
                  <View key={list.id} style={{ gap: spacing.sm }}>
                    <Caption>{list.title}</Caption>
                    {songs.length === 0 ? (
                      <Caption>Nothing in {list.title.toLowerCase()} yet.</Caption>
                    ) : songs.map((item) => {
                      const isCurrent = player.trackId === item.id;
                      return (
                        <View key={`${list.id}-${item.id}`} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
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
                            <Caption>{item.viewCount} plays</Caption>
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
                            onPress={() => void shareSongVideo(item.id, item.title)}
                          >
                            <Ionicons name="share-outline" size={20} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      <NowPlayingBar />
    </View>
  );
}
