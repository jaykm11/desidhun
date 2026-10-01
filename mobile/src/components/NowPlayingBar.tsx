import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { formatPlaybackTime, usePlayer } from '@/player/PlayerProvider';
import { colors, radius, spacing, typography } from '@/theme';

/** Sits above the tab bar so playback survives while the user moves between tabs. */
export function NowPlayingBar() {
  const { title, trackId, isPlaying, isLoading, position, duration, stop, togglePlayPause } = usePlayer();
  if (!trackId || !title) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceRaised,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.border, borderRadius: radius.pill }}>
        <View
          style={{
            height: 3,
            width: `${progress * 100}%`,
            backgroundColor: colors.accent,
            borderRadius: radius.pill,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={8}
          onPress={togglePlayPause}
        >
          <Ionicons
            name={isLoading ? 'ellipsis-horizontal' : isPlaying ? 'pause' : 'play'}
            size={22}
            color={colors.accent}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ ...typography.subheading, color: colors.text }}>
            {title}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            {formatPlaybackTime(position)} / {formatPlaybackTime(duration)}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Stop playback" hitSlop={8} onPress={stop}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
