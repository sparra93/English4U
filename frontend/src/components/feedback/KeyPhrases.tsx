import { Group, Stack, Text } from "@mantine/core";
import { parseKeyPhrases } from "../../utils/feedbackParsing";

interface KeyPhrasesProps {
  keyPhrasesText: string;
}

export function KeyPhrases({ keyPhrasesText }: KeyPhrasesProps) {
  const items = parseKeyPhrases(keyPhrasesText);

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing to flag from this turn.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {items.map((item, index) => (
        <Group key={`${item.phrase}-${index}`} gap={6} wrap="wrap" align="baseline">
          <Text size="sm" fw={600}>
            {item.phrase}
          </Text>
          <Text size="sm" c="dimmed">
            {item.meaning}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
