import { Divider, Stack, Text, Title } from "@mantine/core";
import { CorrectionFeedback } from "./CorrectionFeedback";
import { NaturalVersion } from "./NaturalVersion";
import { VocabularyNote } from "./VocabularyNote";
import { TechnicalDetails } from "./TechnicalDetails";
import type { TutorFeedback } from "../../hooks/useTutor";
import type { TutorTimings } from "../../types/tutor";

const SECTION_LABEL_STYLE = {
  letterSpacing: "0.06em",
} as const;

interface TeacherNotesProps {
  feedback: TutorFeedback | null;
  timings: TutorTimings | null;
}

export function TeacherNotes({ feedback, timings }: TeacherNotesProps) {
  return (
    <Stack gap="lg" h="100%">
      <Title order={4} fw={600}>
        Teacher Notes
      </Title>

      {feedback ? (
        <>
          <Stack gap="xs">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={SECTION_LABEL_STYLE}>
              Corrections
            </Text>
            <CorrectionFeedback correctionsText={feedback.corrections} />
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={SECTION_LABEL_STYLE}>
              More Natural
            </Text>
            <NaturalVersion text={feedback.naturalVersion} />
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={SECTION_LABEL_STYLE}>
              New Expression
            </Text>
            <VocabularyNote vocabularyText={feedback.vocabulary} />
          </Stack>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Speak your first turn and your teacher's notes will appear here.
        </Text>
      )}

      <div style={{ marginTop: "auto" }}>
        <Divider mb="xs" />
        <TechnicalDetails timings={timings} />
      </div>
    </Stack>
  );
}
