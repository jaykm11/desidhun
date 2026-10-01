import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export interface PlayableTrack {
  id: string;
  title: string;
  /** Resolves to a local file URI. Called lazily so audio downloads on demand. */
  resolve: () => Promise<string>;
}

interface PlayerContextValue {
  trackId: string | null;
  title: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  error: string | null;
  toggle: (track: PlayableTrack) => Promise<void>;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [track, setTrack] = useState<PlayableTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingId = useRef<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => undefined);
  }, []);

  const toggle = useCallback(
    async (next: PlayableTrack) => {
      setError(null);
      if (track?.id === next.id) {
        if (status.playing) player.pause();
        else player.play();
        return;
      }
      loadingId.current = next.id;
      setIsLoading(true);
      setTrack(next);
      try {
        const uri = await next.resolve();
        if (loadingId.current !== next.id) return;
        player.replace({ uri });
        player.play();
      } catch (cause) {
        if (loadingId.current !== next.id) return;
        setTrack(null);
        setError(cause instanceof Error ? cause.message : 'This audio could not be played.');
      } finally {
        if (loadingId.current === next.id) setIsLoading(false);
      }
    },
    [player, status.playing, track?.id],
  );

  const togglePlayPause = useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing]);

  const seekTo = useCallback(async (seconds: number) => {
    await player.seekTo(seconds);
  }, [player]);

  const stop = useCallback(() => {
    loadingId.current = null;
    player.pause();
    setTrack(null);
  }, [player]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      trackId: track?.id ?? null,
      title: track?.title ?? null,
      isPlaying: status.playing,
      isLoading,
      position: status.currentTime,
      duration: status.duration,
      error,
      toggle,
      togglePlayPause,
      seekTo,
      stop,
    }),
    [track, status.playing, status.currentTime, status.duration, isLoading, error, toggle, togglePlayPause, seekTo, stop],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside PlayerProvider.');
  return context;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
