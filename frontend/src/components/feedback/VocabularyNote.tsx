import { Badge, Stack, Text } from "@mantine/core";
import { parseVocabulary } from "../../utils/feedbackParsing";

interface VocabularyNoteProps {
  vocabularyText: string;
}

export function VocabularyNote({ vocabularyText }: VocabularyNoteProps) {
  const parsed = parseVocabulary(vocabularyText);

  if (!parsed) {
    return (
      <Text size="sm" c="dimmed">
        No new expression this turn.
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      <Badge color="amber" variant="light" radius="sm" size="sm" style={{ alignSelf: "flex-start" }}>
        {parsed.term}
      </Badge>
      <Text size="sm">{parsed.description}</Text>
    </Stack>
  );
}
