import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { ArrowRight, Check } from "lucide-react";
import { isCleanCorrection, parseCorrections } from "../../utils/feedbackParsing";

interface CorrectionFeedbackProps {
  correctionsText: string;
}

export function CorrectionFeedback({ correctionsText }: CorrectionFeedbackProps) {
  if (isCleanCorrection(correctionsText)) {
    return (
      <Group gap={8} wrap="nowrap">
        <ThemeIcon size={20} radius="xl" color="success" variant="light">
          <Check size={13} aria-hidden="true" />
        </ThemeIcon>
        <Text size="sm" fw={500} c="var(--mantine-color-success-7)">
          No important corrections
        </Text>
      </Group>
    );
  }

  const items = parseCorrections(correctionsText);

  return (
    <Stack gap="md">
      {items.map((item, index) => (
        <Stack key={`${item.original}-${index}`} gap={4}>
          <Group gap={6} wrap="wrap" align="center">
            <Text size="sm" td="line-through" c="dimmed">
              {item.original}
            </Text>
            <ArrowRight
              size={14}
              color="var(--mantine-color-amber-6)"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            />
            <Text size="sm" fw={600}>
              {item.corrected}
            </Text>
          </Group>
          {item.explanation ? (
            <Text size="xs" c="dimmed">
              {item.explanation}
            </Text>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
