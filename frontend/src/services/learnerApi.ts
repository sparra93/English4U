import { requestJson } from "./httpClient";
import type { LearnerProfile, TutorProfile } from "../types/tutor";

export async function fetchTutors(): Promise<TutorProfile[]> {
  const data = await requestJson<{ tutors: TutorProfile[] }>("/api/tutors");
  return data.tutors;
}

export async function fetchLearner(): Promise<LearnerProfile> {
  return requestJson<LearnerProfile>("/api/learner");
}

export async function updateLearnerTutor(tutorId: string): Promise<LearnerProfile> {
  return requestJson<LearnerProfile>("/api/learner/tutor", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tutor_id: tutorId }),
  });
}
