import type { XpEventType } from "./xp-labels";

/**
 * Badges are derived from the user's activity on every page view, never
 * stored. Add or remove entries here; the page lists them in this order.
 */
export type BadgeStats = {
  eventTypes: ReadonlySet<XpEventType>;
  /** Highest overall feedback score of any interview (1-5), null if none. */
  bestFeedbackScore: number | null;
  /** Distinct tracks with a finished interview. */
  finishedTracks: number;
  longestStreak: number;
};

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: "mic" | "layers" | "flame" | "star" | "file" | "user";
  earned: (stats: BadgeStats) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: "first_interview",
    title: "Erstes Interview",
    description: "Ein Mock-Interview abgeschlossen.",
    icon: "mic",
    earned: (s) => s.eventTypes.has("interview_finished"),
  },
  {
    id: "all_tracks",
    title: "Allrounder",
    description: "In allen drei Tracks ein Interview abgeschlossen.",
    icon: "layers",
    earned: (s) => s.finishedTracks >= 3,
  },
  {
    id: "streak_7",
    title: "Sieben Tage am Stück",
    description: "Sieben Tage in Folge aktiv gewesen.",
    icon: "flame",
    earned: (s) => s.longestStreak >= 7,
  },
  {
    id: "top_score",
    title: "Top-Score",
    description: "Ein Interview mit Gesamtscore ab 4 von 5.",
    icon: "star",
    earned: (s) => s.bestFeedbackScore !== null && s.bestFeedbackScore >= 4,
  },
  {
    id: "first_resume",
    title: "Maßgeschneidert",
    description: "Den ersten Lebenslauf auf eine Stelle zugeschnitten.",
    icon: "file",
    earned: (s) => s.eventTypes.has("resume_tailored"),
  },
  {
    id: "profile_complete",
    title: "Profil komplett",
    description: "Das Onboarding-Gespräch abgeschlossen.",
    icon: "user",
    earned: (s) => s.eventTypes.has("profile_completed"),
  },
];
