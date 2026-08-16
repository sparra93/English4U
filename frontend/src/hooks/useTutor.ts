import { useCallback, useState } from "react";
import { submitRecording as postRecording } from "../services/tutorApi";
import type { ConversationTurn, TutorResponse, TutorTimings } from "../types/tutor";
import type { SessionTurn } from "../types/session";
import type { RecordingResult } from "./useRecorder";

const SESSION_STORAGE_KEY = "english-ai-tutor-session";

export interface TutorFeedback {
  corrections: string;
  naturalVersion: string;
  vocabulary: string;
}

interface PersistedSession {
  sessionId: string;
  turns: ConversationTurn[];
  feedback: TutorFeedback | null;
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId) return null;
    return {
      sessionId: parsed.sessionId,
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      feedback: parsed.feedback ?? null,
    };
  } catch {
    return null;
  }
}

function persistSession(session: PersistedSession): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures — the lesson still works for this page view.
  }
}

function newSessionId(): string {
  return window.crypto.randomUUID();
}

function turnToMessages(turn: SessionTurn): ConversationTurn[] {
  return [
    { id: `student-${turn.turn_id}`, role: "student", text: turn.transcription },
    { id: `teacher-${turn.turn_id}`, role: "teacher", text: turn.response },
  ];
}

interface UseTutorResult {
  sessionId: string;
  turns: ConversationTurn[];
  feedback: TutorFeedback | null;
  timings: TutorTimings | null;
  submit: (recording: RecordingResult) => Promise<TutorResponse>;
  startNewSession: () => void;
  loadSessionTurns: (sessionId: string, sessionTurns: SessionTurn[]) => void;
}

export function useTutor(): UseTutorResult {
  const initial = loadPersistedSession();

  const [sessionId, setSessionId] = useState<string>(initial?.sessionId ?? newSessionId());
  const [turns, setTurns] = useState<ConversationTurn[]>(initial?.turns ?? []);
  const [feedback, setFeedback] = useState<TutorFeedback | null>(initial?.feedback ?? null);
  const [timings, setTimings] = useState<TutorTimings | null>(null);

  const submit = useCallback(
    async (recording: RecordingResult): Promise<TutorResponse> => {
      const data = await postRecording(
        recording.blob,
        `recording.${recording.extension}`,
        sessionId,
      );

      const resolvedSessionId = data.session_id || sessionId;
      const nextTurns: ConversationTurn[] = [
        ...turns,
        { id: `student-${Date.now()}`, role: "student", text: data.transcription },
        {
          id: `teacher-${Date.now()}`,
          role: "teacher",
          text: data.response,
          audioUrl: data.audio_url,
        },
      ];
      const nextFeedback: TutorFeedback = {
        corrections: data.corrections,
        naturalVersion: data.natural_version,
        vocabulary: data.vocabulary,
      };

      setSessionId(resolvedSessionId);
      setTurns(nextTurns);
      setFeedback(nextFeedback);
      setTimings(data.timings);
      persistSession({ sessionId: resolvedSessionId, turns: nextTurns, feedback: nextFeedback });

      return data;
    },
    [sessionId, turns],
  );

  const startNewSession = useCallback(() => {
    const id = newSessionId();
    setSessionId(id);
    setTurns([]);
    setFeedback(null);
    setTimings(null);
    persistSession({ sessionId: id, turns: [], feedback: null });
  }, []);

  const loadSessionTurns = useCallback((id: string, sessionTurns: SessionTurn[]) => {
    const nextTurns = sessionTurns.flatMap(turnToMessages);
    const lastTurn = sessionTurns[sessionTurns.length - 1];
    const nextFeedback: TutorFeedback | null = lastTurn
      ? {
          corrections: lastTurn.corrections,
          naturalVersion: lastTurn.natural_version,
          vocabulary: lastTurn.vocabulary,
        }
      : null;

    setSessionId(id);
    setTurns(nextTurns);
    setFeedback(nextFeedback);
    setTimings(null);
    persistSession({ sessionId: id, turns: nextTurns, feedback: nextFeedback });
  }, []);

  return { sessionId, turns, feedback, timings, submit, startNewSession, loadSessionTurns };
}
