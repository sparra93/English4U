export interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabularyItem {
  term: string;
  description: string;
}

const NO_CORRECTIONS_PATTERN = /^no important corrections\.?$/i;
const NO_VOCABULARY_PATTERN = /^no vocabulary suggestion provided\.?$/i;
const NO_KEY_PHRASES_PATTERN = /^no key phrases this turn\.?$/i;

export function isCleanCorrection(correctionsText: string | null | undefined): boolean {
  const normalized = (correctionsText ?? "").trim();
  return !normalized || NO_CORRECTIONS_PATTERN.test(normalized);
}

export function parseCorrections(correctionsText: string | null | undefined): CorrectionItem[] {
  if (isCleanCorrection(correctionsText)) {
    return [];
  }

  const lines = (correctionsText ?? "")
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: CorrectionItem[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const correctionLine = lines[i];
    const explanation = lines[i + 1] ?? "";

    if (!correctionLine || !(correctionLine.includes("->") || correctionLine.includes("→"))) {
      continue;
    }

    const [original, corrected] = correctionLine.split(/->|→/).map((part) => part.trim());
    items.push({ original: original ?? "", corrected: corrected ?? "", explanation });
  }

  return items;
}

export function parseVocabulary(vocabularyText: string | null | undefined): VocabularyItem | null {
  const normalized = (vocabularyText ?? "").trim();
  if (!normalized || NO_VOCABULARY_PATTERN.test(normalized)) {
    return null;
  }

  const [term, ...rest] = normalized.split(/\n+/).map((line) => line.trim());
  return { term: term ?? "", description: rest.join(" ") };
}

export interface KeyPhraseItem {
  phrase: string;
  meaning: string;
}

export function parseKeyPhrases(keyPhrasesText: string | null | undefined): KeyPhraseItem[] {
  const normalized = (keyPhrasesText ?? "").trim();
  if (!normalized || NO_KEY_PHRASES_PATTERN.test(normalized)) {
    return [];
  }

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phrase, ...rest] = line.split(":");
      return { phrase: (phrase ?? "").trim(), meaning: rest.join(":").trim() };
    })
    .filter((item) => item.phrase);
}

export interface VocabularyAggregate extends VocabularyItem {
  timesSeen: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export function aggregateVocabulary<T extends { created_at: string; vocabulary: string }>(
  turns: T[],
): VocabularyAggregate[] {
  const byTerm = new Map<string, VocabularyAggregate>();

  turns.forEach((turn) => {
    const parsed = parseVocabulary(turn.vocabulary);
    if (!parsed || !parsed.term) return;

    const key = parsed.term.toLowerCase();
    const existing = byTerm.get(key);

    if (!existing) {
      byTerm.set(key, {
        term: parsed.term,
        description: parsed.description,
        timesSeen: 1,
        firstSeenAt: turn.created_at,
        lastSeenAt: turn.created_at,
      });
      return;
    }

    existing.timesSeen += 1;
    if (turn.created_at < existing.firstSeenAt) existing.firstSeenAt = turn.created_at;
    if (turn.created_at > existing.lastSeenAt) existing.lastSeenAt = turn.created_at;
  });

  return Array.from(byTerm.values()).sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export interface CorrectionHistoryEntry extends CorrectionItem {
  createdAt: string;
}

export function aggregateCorrectionHistory<
  T extends { created_at: string; corrections: string },
>(turns: T[]): CorrectionHistoryEntry[] {
  const history: CorrectionHistoryEntry[] = [];

  turns.forEach((turn) => {
    parseCorrections(turn.corrections).forEach((item) => {
      history.push({ ...item, createdAt: turn.created_at });
    });
  });

  return history;
}
