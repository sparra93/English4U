import { useState } from "react";
import { Collapse, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import type { TutorTimings } from "../../types/tutor";
import { formatTiming } from "../../utils/format";

interface TechnicalDetailsProps {
  timings: TutorTimings | null;
}

export function TechnicalDetails({ timings }: TechnicalDetailsProps) {
  const [opened, setOpened] = useState(false);

  if (!timings) {
    return null;
  }

  return (
    <div>
      <UnstyledButton
        onClick={() => setOpened((current) => !current)}
        aria-expanded={opened}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
          Technical details
        </Text>
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">
            {formatTiming(timings.total)}
          </Text>
          <ChevronDown
            size={14}
            aria-hidden="true"
            style={{
              transform: opened ? "rotate(180deg)" : undefined,
              transition: "transform 150ms ease",
            }}
          />
        </Group>
      </UnstyledButton>

      <Collapse expanded={opened}>
        <Stack gap={6} mt="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Speech recognition
            </Text>
            <Text size="xs">{formatTiming(timings.whisper)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              AI response
            </Text>
            <Text size="xs">{formatTiming(timings.ollama)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Voice generation
            </Text>
            <Text size="xs">{formatTiming(timings.tts)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" fw={600}>
              Total response
            </Text>
            <Text size="xs" fw={600}>
              {formatTiming(timings.total)}
            </Text>
          </Group>
        </Stack>
      </Collapse>
    </div>
  );
}
