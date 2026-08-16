import { useCallback, useRef, useState } from "react";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function detectMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

export function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export interface RecordingResult {
  blob: Blob;
  extension: string;
}

interface UseRecorderResult {
  isRecording: boolean;
  elapsedSeconds: number;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => Promise<RecordingResult | null>;
}

export function useRecorder(onError: (message: string) => void): UseRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("This browser does not support microphone recording.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      onError("This browser does not support MediaRecorder.");
      return;
    }

    const mimeType = detectMimeType();
    if (!mimeType) {
      onError("This browser does not support a compatible recording format.");
      return;
    }

    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone permission was denied.");
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(mediaStream, { mimeType });
    } catch {
      mediaStream.getTracks().forEach((track) => track.stop());
      onError("The microphone recording format is not supported.");
      return;
    }

    chunksRef.current = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    streamRef.current = mediaStream;
    setStream(mediaStream);
    mediaRecorderRef.current = recorder;
    recorder.start();

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);

    setIsRecording(true);
  }, [onError, stopTimer]);

  const stop = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      stopTimer();
      setIsRecording(false);

      if (!recorder || recorder.state === "inactive") {
        stopStreamTracks();
        resolve(null);
        return;
      }

      recorder.addEventListener(
        "stop",
        () => {
          stopStreamTracks();
          setElapsedSeconds(0);

          if (!chunksRef.current.length) {
            onError("The recording was empty.");
            resolve(null);
            return;
          }

          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          chunksRef.current = [];
          mediaRecorderRef.current = null;

          if (blob.size === 0) {
            onError("The recording was empty.");
            resolve(null);
            return;
          }

          resolve({ blob, extension: extensionFromMimeType(recorder.mimeType) });
        },
        { once: true },
      );

      recorder.stop();
    });
  }, [onError, stopStreamTracks, stopTimer]);

  return { isRecording, elapsedSeconds, stream, start, stop };
}
