import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHistory } from "../services/historyApi";
import type { DateRangeOption, HistoryTurn } from "../types/history";
import {
  aggregateCorrectionHistory,
  aggregateVocabulary,
  isCleanCorrection,
} from "../utils/feedbackParsing";
import { buildBuckets, computeStreaks, filterTurnsByRange } from "../utils/dateBuckets";

export interface ProgressStats {
  turnCount: number;
  sessionCount: number;
  cleanRate: number;
  vocabCount: number;
  streak: number;
}

interface UseProgressHistoryResult {
  isLoading: boolean;
  errorMessage: string | null;
  range: DateRangeOption;
  setRange: (range: DateRangeOption) => void;
  filteredTurns: HistoryTurn[];
  stats: ProgressStats;
  buckets: ReturnType<typeof buildBuckets>;
  vocabulary: ReturnType<typeof aggregateVocabulary>;
  correctionHistory: ReturnType<typeof aggregateCorrectionHistory>;
}

export function useProgressHistory(): UseProgressHistoryResult {
  const [allTurns, setAllTurns] = useState<HistoryTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeOption>("all");

  useEffect(() => {
    let cancelled = false;

    fetchHistory(500)
      .then((data) => {
        if (!cancelled) {
          setAllTurns(data.turns);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load your learning history.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTurns = useMemo(() => filterTurnsByRange(allTurns, range), [allTurns, range]);

  const stats = useMemo<ProgressStats>(() => {
    const vocabCount = aggregateVocabulary(filteredTurns).length;
    const sessionCount = new Set(filteredTurns.map((turn) => turn.session_id)).size;
    const cleanCount = filteredTurns.filter((turn) => isCleanCorrection(turn.corrections)).length;
    const cleanRate =
      filteredTurns.length > 0 ? Math.round((cleanCount / filteredTurns.length) * 100) : 0;
    const { current } = computeStreaks(allTurns);

    return {
      turnCount: filteredTurns.length,
      sessionCount,
      cleanRate,
      vocabCount,
      streak: current,
    };
  }, [filteredTurns, allTurns]);

  const buckets = useMemo(
    () => buildBuckets(filteredTurns, allTurns, range),
    [filteredTurns, allTurns, range],
  );

  const vocabulary = useMemo(() => aggregateVocabulary(filteredTurns), [filteredTurns]);
  const correctionHistory = useMemo(
    () => aggregateCorrectionHistory(filteredTurns),
    [filteredTurns],
  );

  const setRangeCallback = useCallback((next: DateRangeOption) => setRange(next), []);

  return {
    isLoading,
    errorMessage,
    range,
    setRange: setRangeCallback,
    filteredTurns,
    stats,
    buckets,
    vocabulary,
    correctionHistory,
  };
}
