import { useCallback, useState } from "react";
import { Alert, Box } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { TeacherPresence } from "../components/teacher/TeacherPresence";
import { ConversationTimeline } from "../components/conversation/ConversationTimeline";
import { TeacherNotes } from "../components/feedback/TeacherNotes";
import { SpeakingControl } from "../components/recorder/SpeakingControl";
import { useTutorContext } from "../context/TutorContext";
import { useRecorder } from "../hooks/useRecorder";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useRecordingLevel } from "../hooks/useRecordingLevel";
import { useAutoStopOnSilence } from "../hooks/useAutoStopOnSilence";
import { ApiError } from "../services/httpClient";
import type { TutorPhase } from "../types/tutor";

export function TutorSessionPage() {
  const { turns, feedback, timings, submit, sessions } = useTutorContext();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleError = useCallback((message: string) => setErrorMessage(message), []);
  const recorder = useRecorder(handleError);
  const audioPlayback = useAudioPlayback(handleError);
  const level = useRecordingLevel(recorder.stream);

  const phase: TutorPhase = errorMessage
    ? "error"
    : recorder.isRecording
      ? "recording"
      : isProcessing
        ? "processing"
        : audioPlayback.isPlaying
          ? "playing"
          : "idle";

  const handleToggle = useCallback(async () => {
    if (recorder.isRecording) {
      const recording = await recorder.stop();
      if (!recording) {
        return;
      }

      setErrorMessage(null);
      setIsProcessing(true);
      try {
        const data = await submit(recording);
        void sessions.refresh();
        if (data.audio_url) {
          await audioPlayback.play(data.audio_url);
        }
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "The tutor request failed.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (isProcessing || audioPlayback.isPlaying) {
      return;
    }

    setErrorMessage(null);
    await recorder.start();
  }, [recorder, submit, sessions, audioPlayback, isProcessing]);

  useAutoStopOnSilence(level, recorder.isRecording, () => void handleToggle());

  const handleReplay = useCallback(
    (audioUrl: string) => {
      void audioPlayback.play(audioUrl);
    },
    [audioPlayback],
  );

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: "24px 32px",
      }}
    >
      {errorMessage ? (
        <Alert
          icon={<AlertCircle size={16} aria-hidden="true" />}
          color="red"
          variant="light"
          withCloseButton
          onClose={() => setErrorMessage(null)}
          mb="md"
        >
          {errorMessage}
        </Alert>
      ) : null}

      <div className="lesson-grid">
        <div className="lesson-grid__teacher">
          <TeacherPresence phase={phase} />
        </div>

        <Box className="lesson-grid__conversation">
          <ConversationTimeline turns={turns} isProcessing={isProcessing} onReplay={handleReplay} />
        </Box>

        <Box className="lesson-grid__notes">
          <TeacherNotes feedback={feedback} timings={timings} />
        </Box>

        <Box className="lesson-grid__speaking" pt="md">
          <SpeakingControl
            phase={phase}
            elapsedSeconds={recorder.elapsedSeconds}
            level={level}
            onToggle={() => void handleToggle()}
          />
        </Box>
      </div>

      <audio ref={audioPlayback.audioRef} hidden />
    </Box>
  );
}
