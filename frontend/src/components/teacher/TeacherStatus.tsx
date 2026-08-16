import { Box, Group, Text } from "@mantine/core";
import type { TutorPhase } from "../../types/tutor";
import { useTutorContext } from "../../context/TutorContext";

const DOT_COLOR: Record<TutorPhase, string> = {
  idle: "var(--mantine-color-success-6)",
  recording: "var(--mantine-color-red-6)",
  processing: "var(--mantine-color-teal-6)",
  playing: "var(--mantine-color-academicBlue-6)",
  error: "var(--mantine-color-red-6)",
};

function labelFor(phase: TutorPhase, teacherName: string): string {
  switch (phase) {
    case "idle":
      return "Ready when you are";
    case "recording":
      return "Listening…";
    case "processing":
      return `${teacherName} is thinking…`;
    case "playing":
      return `${teacherName} is speaking…`;
    case "error":
      return "Let's try again";
  }
}

interface TeacherStatusProps {
  phase: TutorPhase;
}

export function TeacherStatus({ phase }: TeacherStatusProps) {
  const { profile } = useTutorContext();

  return (
    <Group gap={8} wrap="nowrap" aria-live="polite">
      <Box
        w={8}
        h={8}
        style={{
          flexShrink: 0,
          borderRadius: "50%",
          backgroundColor: DOT_COLOR[phase],
        }}
      />
      <Text size="sm" fw={500} c="dimmed">
        {labelFor(phase, profile.activeTutor.name)}
      </Text>
    </Group>
  );
}
