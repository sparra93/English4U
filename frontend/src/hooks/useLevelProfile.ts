import { useCallback, useEffect, useState } from "react";
import { fetchLearner, updateLearnerLevel } from "../services/learnerApi";
import { DEFAULT_LEVEL } from "../types/level";

interface UseLevelProfileResult {
  activeLevel: string;
  selectLevel: (level: string) => Promise<void>;
  isLocked: boolean;
}

/**
 * Mirrors `useTutorProfile`: `lockedLevel` is the CEFR level already
 * committed to the *current* conversation (set once its first turn is
 * sent, or when a past session is loaded) — while it's set, `activeLevel`
 * reflects that locked choice and `selectLevel` is a no-op. With no active
 * conversation, this instead tracks the learner's standing preference for
 * whichever chat starts next.
 */
export function useLevelProfile(lockedLevel: string | null): UseLevelProfileResult {
  const [preferredLevel, setPreferredLevel] = useState<string>(DEFAULT_LEVEL);

  useEffect(() => {
    let cancelled = false;

    fetchLearner()
      .then((learner) => {
        if (cancelled) return;
        if (learner.level) {
          setPreferredLevel(learner.level);
        }
      })
      .catch(() => {
        // Non-critical: the UI just keeps the default level.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectLevel = useCallback(
    async (level: string) => {
      if (lockedLevel) return;
      setPreferredLevel(level);
      try {
        await updateLearnerLevel(level);
      } catch {
        // Leave the optimistic selection in place — it's a local preference,
        // and a failed write here isn't worth interrupting the lesson for.
      }
    },
    [lockedLevel],
  );

  return {
    activeLevel: lockedLevel ?? preferredLevel,
    selectLevel,
    isLocked: lockedLevel !== null,
  };
}
