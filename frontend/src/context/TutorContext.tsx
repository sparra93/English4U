import { createContext, useContext, type ReactNode } from "react";
import { useTutor } from "../hooks/useTutor";
import { useSessions } from "../hooks/useSessions";
import { useTutorProfile } from "../hooks/useTutorProfile";
import { useLevelProfile } from "../hooks/useLevelProfile";

type TutorContextValue = ReturnType<typeof useTutor> & {
  sessions: ReturnType<typeof useSessions>;
  profile: ReturnType<typeof useTutorProfile>;
  level: ReturnType<typeof useLevelProfile>;
};

const TutorContext = createContext<TutorContextValue | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const tutor = useTutor();
  const sessions = useSessions();
  const profile = useTutorProfile(tutor.lockedTutorId);
  const level = useLevelProfile(tutor.lockedLevel);

  return (
    <TutorContext.Provider value={{ ...tutor, sessions, profile, level }}>
      {children}
    </TutorContext.Provider>
  );
}

export function useTutorContext(): TutorContextValue {
  const context = useContext(TutorContext);
  if (!context) {
    throw new Error("useTutorContext must be used within a TutorProvider");
  }
  return context;
}
