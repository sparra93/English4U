import { useCallback, useEffect, useState } from "react";
import { fetchLearner, fetchTutors, updateLearnerTutor } from "../services/learnerApi";
import type { TutorProfile } from "../types/tutor";

const DEFAULT_TUTOR_ID = "emma";
const FALLBACK_TUTOR: TutorProfile = {
  id: DEFAULT_TUTOR_ID,
  name: "Emma",
  accent: "American",
  specialty: "Relaxed Practice",
  tagline: "Build confidence through comfortable conversation.",
};

interface UseTutorProfileResult {
  tutors: TutorProfile[];
  activeTutor: TutorProfile;
  selectTutor: (tutorId: string) => Promise<void>;
}

export function useTutorProfile(): UseTutorProfileResult {
  const [tutors, setTutors] = useState<TutorProfile[]>([FALLBACK_TUTOR]);
  const [activeTutorId, setActiveTutorId] = useState<string>(DEFAULT_TUTOR_ID);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTutors(), fetchLearner()])
      .then(([catalog, learner]) => {
        if (cancelled) return;
        setTutors(catalog.length > 0 ? catalog : [FALLBACK_TUTOR]);
        if (learner.tutor_id) {
          setActiveTutorId(learner.tutor_id);
        }
      })
      .catch(() => {
        // Non-critical: the UI just keeps the default tutor.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectTutor = useCallback(async (tutorId: string) => {
    setActiveTutorId(tutorId);
    try {
      await updateLearnerTutor(tutorId);
    } catch {
      // Leave the optimistic selection in place — it's a local preference,
      // and a failed write here isn't worth interrupting the lesson for.
    }
  }, []);

  const activeTutor = tutors.find((tutor) => tutor.id === activeTutorId) ?? FALLBACK_TUTOR;

  return { tutors, activeTutor, selectTutor };
}
