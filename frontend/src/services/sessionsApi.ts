import { requestJson } from "./httpClient";
import type {
  DeleteSessionResponse,
  SessionsResponse,
  SessionTurnsResponse,
} from "../types/session";

export async function fetchSessions(): Promise<SessionsResponse> {
  return requestJson<SessionsResponse>("/api/sessions");
}

export async function fetchSessionTurns(sessionId: string): Promise<SessionTurnsResponse> {
  return requestJson<SessionTurnsResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/turns`,
  );
}

export async function deleteSession(sessionId: string): Promise<DeleteSessionResponse> {
  return requestJson<DeleteSessionResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}
