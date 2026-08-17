export interface SessionSummary {
  session_id: string;
  started_at: string;
  last_active_at: string;
  turn_count: number;
  title: string | null;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface SessionTurn {
  turn_id: number;
  created_at: string;
  transcription: string;
  response: string;
  corrections: string;
  natural_version: string;
  vocabulary: string;
  key_phrases: string;
}

export interface SessionTurnsResponse {
  session_id: string;
  tutor_id: string;
  level: string;
  turns: SessionTurn[];
}

export interface DeleteSessionResponse {
  session_id: string;
  deleted: boolean;
}
