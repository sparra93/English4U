import { useCallback, useEffect, useState } from "react";
import { deleteSession, fetchSessions, fetchSessionTurns } from "../services/sessionsApi";
import type { SessionSummary, SessionTurn } from "../types/session";
import { ApiError } from "../services/httpClient";

interface UseSessionsResult {
  sessions: SessionSummary[];
  refresh: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<SessionTurn[]>;
  removeSession: (sessionId: string) => Promise<void>;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSessions();
      setSessions(data.sessions);
    } catch {
      // Non-critical: the sidebar just keeps whatever it last showed.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchSession = useCallback(async (sessionId: string): Promise<SessionTurn[]> => {
    const data = await fetchSessionTurns(sessionId);
    return data.turns;
  }, []);

  const removeSession = useCallback(async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
    setSessions((current) => current.filter((session) => session.session_id !== sessionId));
  }, []);

  return { sessions, refresh, switchSession, removeSession };
}
