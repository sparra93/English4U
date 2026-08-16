import { useCallback, useEffect, useRef, useState } from "react";

interface UseAudioPlaybackResult {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  play: (url: string) => Promise<void>;
}

export function useAudioPlayback(onError: (message: string) => void): UseAudioPlaybackResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handleStop = () => setIsPlaying(false);
    const handleError = () => {
      setIsPlaying(false);
      onError("The browser could not play the tutor response audio.");
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleStop);
    audio.addEventListener("pause", handleStop);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleStop);
      audio.removeEventListener("pause", handleStop);
      audio.removeEventListener("error", handleError);
    };
  }, [onError]);

  const play = useCallback(async (url: string) => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    audio.src = url;
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      // Autoplay can be blocked by the browser policy; the user can press replay.
    }
  }, []);

  return { audioRef, isPlaying, play };
}
