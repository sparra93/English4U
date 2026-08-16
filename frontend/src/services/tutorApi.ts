import { requestJson } from "./httpClient";
import type { HealthStatus, TutorResponse } from "../types/tutor";

export async function fetchHealth(): Promise<HealthStatus> {
  return requestJson<HealthStatus>("/api/health");
}

export async function submitRecording(
  audio: Blob,
  filename: string,
  sessionId: string | null,
): Promise<TutorResponse> {
  const formData = new FormData();
  formData.append("audio", audio, filename);
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  return requestJson<TutorResponse>("/api/tutor", {
    method: "POST",
    body: formData,
  });
}
