import { Group, Paper, Stack, Text } from "@mantine/core";
import { ArrowRight } from "lucide-react";
import type { CorrectionHistoryEntry } from "../../utils/feedbackParsing";
import { formatDateTime } from "../../utils/format";

interface CorrectionHistoryListProps {
  history: CorrectionHistoryEntry[];
}

export function CorrectionHistoryList({ history }: CorrectionHistoryListProps) {
  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No corrections in this range — great sentences!
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {history.map((item, index) => (
        <Paper key={`${item.original}-${index}`} withBorder p="sm" radius="md">
          <Group gap={6} wrap="wrap" align="center">
            <Text size="sm" td="line-through" c="dimmed">
              {item.original}
            </Text>
            <ArrowRight size={14} color="var(--mantine-color-amber-6)" aria-hidden="true" />
            <Text size="sm" fw={600}>
              {item.corrected}
            </Text>
          </Group>
          {item.explanation ? (
            <Text size="sm" mt={6}>
              {item.explanation}
            </Text>
          ) : null}
          <Text size="xs" c="dimmed" mt={6}>
            {formatDateTime(item.createdAt)}
          </Text>
        </Paper>
      ))}
    </Stack>
  );
}
