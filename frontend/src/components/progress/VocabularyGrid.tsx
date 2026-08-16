import { Badge, Paper, SimpleGrid, Text } from "@mantine/core";
import type { VocabularyAggregate } from "../../utils/feedbackParsing";
import { formatDateTime } from "../../utils/format";

interface VocabularyGridProps {
  vocabulary: VocabularyAggregate[];
}

export function VocabularyGrid({ vocabulary }: VocabularyGridProps) {
  if (vocabulary.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No new vocabulary in this range — it will show up here after your tutor suggests one.
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
      {vocabulary.map((item) => (
        <Paper key={item.term} withBorder p="sm" radius="md">
          <Badge color="amber" variant="light" radius="sm" size="sm" mb={6}>
            {item.term}
          </Badge>
          <Text size="sm">{item.description}</Text>
          <Text size="xs" c="dimmed" mt={6}>
            {item.timesSeen > 1
              ? `Seen ${item.timesSeen} times · last on ${formatDateTime(item.lastSeenAt)}`
              : `Learned on ${formatDateTime(item.firstSeenAt)}`}
          </Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
