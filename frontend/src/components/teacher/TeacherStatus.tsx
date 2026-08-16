import { Box, Group, Text } from "@mantine/core";
import type { TutorPhase } from "../../types/tutor";

const STATUS_CONFIG: Record<TutorPhase, { label: string; dotColor: string }> = {
  idle: { label: "Ready when you are", dotColor: "var(--mantine-color-success-6)" },
  recording: { label: "Listening…", dotColor: "var(--mantine-color-red-6)" },
  processing: { label: "Emma is thinking…", dotColor: "var(--mantine-color-teal-6)" },
  playing: { label: "Emma is speaking…", dotColor: "var(--mantine-color-academicBlue-6)" },
  error: { label: "Let's try again", dotColor: "var(--mantine-color-red-6)" },
};

interface TeacherStatusProps {
  phase: TutorPhase;
}

export function TeacherStatus({ phase }: TeacherStatusProps) {
  const config = STATUS_CONFIG[phase];

  return (
    <Group gap={8} wrap="nowrap" aria-live="polite">
      <Box
        w={8}
        h={8}
        style={{
          flexShrink: 0,
          borderRadius: "50%",
          backgroundColor: config.dotColor,
        }}
      />
      <Text size="sm" fw={500} c="dimmed">
        {config.label}
      </Text>
    </Group>
  );
}
