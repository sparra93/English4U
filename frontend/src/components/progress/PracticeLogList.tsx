import { Paper, Stack, Text } from "@mantine/core";
import type { HistoryTurn } from "../../types/history";
import { formatDateTime } from "../../utils/format";

interface PracticeLogListProps {
  turns: HistoryTurn[];
}

export function PracticeLogList({ turns }: PracticeLogListProps) {
  if (turns.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing recorded in this range.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {turns.map((turn) => (
        <Paper key={turn.turn_id} withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            {formatDateTime(turn.created_at)}
          </Text>
          <Text component="div" size="sm">
            <Text component="span" fw={700}>
              You:{" "}
            </Text>
            {turn.transcription}
          </Text>
          <Text component="div" size="sm">
            <Text component="span" fw={700}>
              Emma:{" "}
            </Text>
            {turn.response}
          </Text>
        </Paper>
      ))}
    </Stack>
  );
}
