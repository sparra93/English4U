import { useEffect, useRef } from "react";
import { Box, Stack, Text, Title } from "@mantine/core";
import { StudentTurn } from "./StudentTurn";
import { TeacherTurn } from "./TeacherTurn";
import { TypingIndicator } from "./TypingIndicator";
import { useTutorContext } from "../../context/TutorContext";
import type { ConversationTurn } from "../../types/tutor";

interface ConversationTimelineProps {
  turns: ConversationTurn[];
  isProcessing: boolean;
  onReplay: (audioUrl: string) => void;
}

export function ConversationTimeline({
  turns,
  isProcessing,
  onReplay,
}: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { profile } = useTutorContext();
  const teacherName = profile.activeTutor.name;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, isProcessing]);

  if (turns.length === 0 && !isProcessing) {
    return (
      <Stack align="center" ta="center" py="xl" gap="xs" maw={420} mx="auto">
        <Title order={3} fw={600}>
          Ready when you are
        </Title>
        <Text size="sm" c="dimmed">
          Press the microphone below and start talking. Your conversation will
          appear here as it happens.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {turns.map((turn) =>
        turn.role === "student" ? (
          <StudentTurn key={turn.id} text={turn.text} />
        ) : (
          <TeacherTurn
            key={turn.id}
            text={turn.text}
            audioUrl={turn.audioUrl}
            teacherName={teacherName}
            onReplay={onReplay}
          />
        ),
      )}
      {isProcessing ? <TypingIndicator teacherName={teacherName} /> : null}
      <Box ref={bottomRef} />
    </Stack>
  );
}
