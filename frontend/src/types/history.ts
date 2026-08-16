export interface HistoryTurn {
  turn_id: number;
  session_id: string;
  created_at: string;
  transcription: string;
  response: string;
  corrections: string;
  natural_version: string;
  vocabulary: string;
}

export interface HistoryResponse {
  learner_id: string;
  turns: HistoryTurn[];
}

export type DateRangeOption = "7" | "30" | "90" | "all";
