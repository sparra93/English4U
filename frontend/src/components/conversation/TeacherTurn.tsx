import { Avatar, Box, Group, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { Volume2 } from "lucide-react";
import { initialsFor } from "../../utils/format";
import { isCleanCorrection } from "../../utils/feedbackParsing";
import { CorrectionFeedback } from "../feedback/CorrectionFeedback";

interface TeacherTurnProps {
  text: string;
  audioUrl?: string;
  corrections?: string;
  teacherName: string;
  onReplay: (audioUrl: string) => void;
}

export function TeacherTurn({ text, audioUrl, corrections, teacherName, onReplay }: TeacherTurnProps) {
  const hasCorrection = !!corrections && !isCleanCorrection(corrections);
  return (
    <Group align="flex-start" wrap="nowrap" gap="xs">
      <Avatar radius="xl" size={32} color="navy" variant="filled" mt={2}>
        {initialsFor(teacherName)}
      </Avatar>
      <Box maw="72%">
        <Text size="xs" fw={600} c="dimmed" mb={4}>
          {teacherName}
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
        {hasCorrection ? (
          <Box
            mt={6}
            px="md"
            py="sm"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              backgroundColor: "var(--mantine-color-amber-0)",
              border: "1px solid var(--mantine-color-amber-2)",
            }}
          >
            <CorrectionFeedback correctionsText={corrections!} />
          </Box>
        ) : null}
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
