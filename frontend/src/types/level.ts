export interface LevelOption {
  code: string;
  label: string;
}

export const DEFAULT_LEVEL = "B1";

export const CEFR_LEVELS: LevelOption[] = [
  { code: "A1", label: "Beginner" },
  { code: "A2", label: "Elementary" },
  { code: "B1", label: "Intermediate" },
  { code: "B2", label: "Upper-Intermediate" },
  { code: "C1", label: "Advanced" },
  { code: "C2", label: "Proficient" },
];
