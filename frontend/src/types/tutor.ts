export interface TutorTimings {
  whisper: number;
  ollama: number;
  tts: number;
  total: number;
}

export interface TutorResponse {
  transcription: string;
  response: string;
  corrections: string;
  natural_version: string;
  vocabulary: string;
  session_id: string;
  timings: TutorTimings;
  audio_url: string;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  whisper: boolean;
  ollama: boolean;
  tts: boolean;
  database: boolean;
  startup_errors: Record<string, string | null>;
}

export type TutorPhase = "idle" | "recording" | "processing" | "playing" | "error";

export interface ConversationTurn {
  id: string;
  role: "student" | "teacher";
  text: string;
  audioUrl?: string;
}
