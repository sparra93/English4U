import { useEffect, useRef } from "react";

const SILENCE_THRESHOLD = 0.08;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 800;

/**
 * Watches the live mic level while recording and fires `onSilence` once the
 * student has been quiet for `SILENCE_DURATION_MS`, so they don't have to
 * tap the mic again to end their turn. `MIN_RECORDING_MS` guards against
 * firing immediately if the mic captures a moment of silence before the
 * student starts talking.
 */
export function useAutoStopOnSilence(
  level: number,
  isRecording: boolean,
  onSilence: () => void,
): void {
  const silenceTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRecording) {
      clearSilenceTimer();
      recordingStartedAtRef.current = 0;
      return;
    }
    recordingStartedAtRef.current = Date.now();
    return clearSilenceTimer;
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) return;

    const elapsedSinceStart = Date.now() - recordingStartedAtRef.current;
    const isSpeaking = level > SILENCE_THRESHOLD;

    if (isSpeaking || elapsedSinceStart < MIN_RECORDING_MS) {
      clearSilenceTimer();
      return;
    }

    if (silenceTimerRef.current === null) {
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        onSilenceRef.current();
      }, SILENCE_DURATION_MS);
    }
  }, [level, isRecording]);

  useEffect(() => clearSilenceTimer, []);
}
