import { ActionIcon, Box, Stack, Text } from "@mantine/core";
import { Loader2, Mic, Volume2 } from "lucide-react";
import type { TutorPhase } from "../../types/tutor";
import { RecordingTimer } from "./RecordingTimer";
import { RecordingVisualizer } from "./RecordingVisualizer";

interface SpeakingControlProps {
  phase: TutorPhase;
  elapsedSeconds: number;
  level: number;
  onToggle: () => void;
}

const PHASE_COPY: Record<TutorPhase, string> = {
  idle: "Tap to speak",
  recording: "Listening…",
  processing: "Emma is thinking…",
  playing: "Emma is speaking…",
  error: "Tap to try again",
};

const PHASE_COLOR: Record<TutorPhase, string> = {
  idle: "teal",
  recording: "red",
  processing: "academicBlue",
  playing: "academicBlue",
  error: "red",
};

export function SpeakingControl({ phase, elapsedSeconds, level, onToggle }: SpeakingControlProps) {
  const isBusy = phase === "processing" || phase === "playing";
  const isRecording = phase === "recording";

  return (
    <Stack align="center" gap="sm">
      <Box pos="relative" w={104} h={104}>
        {isRecording ? (
          <Box
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid var(--mantine-color-red-4)",
              animation: "mic-halo 1.5s infinite",
              pointerEvents: "none",
            }}
          />
        ) : null}
        <ActionIcon
          size={104}
          radius="xl"
          color={PHASE_COLOR[phase]}
          variant="filled"
          disabled={isBusy}
          onClick={onToggle}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          aria-pressed={isRecording}
        >
          {isRecording ? (
            <Box w={26} h={26} style={{ backgroundColor: "currentColor", borderRadius: 6 }} />
          ) : phase === "processing" ? (
            <Loader2
              size={34}
              aria-hidden="true"
              style={{ animation: "spin 0.9s linear infinite" }}
            />
          ) : phase === "playing" ? (
            <Volume2 size={34} aria-hidden="true" />
          ) : (
            <Mic size={34} aria-hidden="true" />
          )}
        </ActionIcon>
      </Box>

      <Text fw={600} size="sm">
        {PHASE_COPY[phase]}
      </Text>

      {isRecording ? (
        <Stack align="center" gap={4}>
          <RecordingTimer elapsedSeconds={elapsedSeconds} />
          <RecordingVisualizer level={level} active />
        </Stack>
      ) : null}
    </Stack>
  );
}
