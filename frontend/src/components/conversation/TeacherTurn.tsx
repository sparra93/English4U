import { Avatar, Box, Group, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { Volume2 } from "lucide-react";

interface TeacherTurnProps {
  text: string;
  audioUrl?: string;
  onReplay: (audioUrl: string) => void;
}

export function TeacherTurn({ text, audioUrl, onReplay }: TeacherTurnProps) {
  return (
    <Group align="flex-start" wrap="nowrap" gap="xs">
      <Avatar radius="xl" size={32} color="navy" variant="filled" mt={2}>
        EM
      </Avatar>
      <Box maw="72%">
        <Text size="xs" fw={600} c="dimmed" mb={4}>
          Emma
        </Text>
        <Box
          px="md"
          py="sm"
          style={{
            borderRadius: "var(--mantine-radius-md)",
            borderBottomLeftRadius: 4,
            backgroundColor: "var(--mantine-color-academicBlue-0)",
            border: "1px solid var(--mantine-color-academicBlue-2)",
          }}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Text>
        </Box>
        {audioUrl ? (
          <Tooltip label="Replay response" position="bottom-start">
            <UnstyledButton
              onClick={() => onReplay(audioUrl)}
              mt={6}
              aria-label="Replay tutor response"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--mantine-color-academicBlue-7)",
                fontSize: "var(--mantine-font-size-xs)",
                fontWeight: 600,
              }}
            >
              <Volume2 size={14} aria-hidden="true" />
              Replay
            </UnstyledButton>
          </Tooltip>
        ) : null}
      </Box>
    </Group>
  );
}
