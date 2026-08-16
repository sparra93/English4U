import { Avatar, Group, Stack, Text } from "@mantine/core";
import { TeacherStatus } from "./TeacherStatus";
import type { TutorPhase } from "../../types/tutor";

interface TeacherPresenceProps {
  phase: TutorPhase;
}

export function TeacherPresence({ phase }: TeacherPresenceProps) {
  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="md">
      <Group gap="sm">
        <Avatar radius="xl" size={44} color="navy" variant="filled">
          EM
        </Avatar>
        <Stack gap={0}>
          <Text fw={600} size="md">
            Emma
          </Text>
          <Text size="xs" c="dimmed">
            Private English Tutor
          </Text>
        </Stack>
      </Group>
      <TeacherStatus phase={phase} />
    </Group>
  );
}
