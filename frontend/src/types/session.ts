export interface SessionSummary {
  session_id: string;
  started_at: string;
  last_active_at: string;
  turn_count: number;
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
}

export interface SessionTurnsResponse {
  session_id: string;
  turns: SessionTurn[];
}

export interface DeleteSessionResponse {
  session_id: string;
  deleted: boolean;
}
