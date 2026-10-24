import type { CandidateProfile } from "@/lib/schemas/candidate-profile";

/**
 * CV milestones. Most are read from the candidate profile; the ones the
 * profile cannot hold are confirmed once by the user. Each is stored as a
 * "milestone" xp_event whose ref_id is the fixed id below, so the unique
 * index awards it at most once.
 */
export type MilestoneId = "bachelor" | "master" | "spring_week" | "internship" | "full_time_offer";

export type Milestone = {
  id: MilestoneId;
  /** ref_id of the xp_event. Never change: awarded events reference it. */
  refId: string;
  title: string;
  description: string;
  xp: number;
  /** "profile": derived from the candidate profile; "claim": confirmed by the user. */
  source: "profile" | "claim";
};

export const MILESTONES: Milestone[] = [
  {
    id: "bachelor",
    refId: "564e90e6-46d4-4219-a16d-9f4961a1f1ab",
    title: "Bachelor begonnen",
    description: "Ein bestätigtes Bachelorstudium in deinem Profil.",
    xp: 50,
    source: "profile",
  },
  {
    id: "master",
    refId: "e0f6c6e2-07d9-4307-8455-a45eb5b361b6",
    title: "Master begonnen",
    description: "Ein bestätigtes Masterstudium in deinem Profil.",
    xp: 100,
    source: "profile",
  },
  {
    id: "spring_week",
    refId: "20d96eec-3ec3-44c7-a2ad-e44543d68940",
    title: "Spring Week / Short Program",
    description: "Einblicke in die Branche gesammelt.",
    xp: 100,
    source: "claim",
  },
  {
    id: "internship",
    refId: "aa65f21b-eb83-4741-9544-cf4eb15ec9af",
    title: "Praktikum ab 3 Monaten",
    description: "Ein bestätigtes Praktikum von mindestens drei Monaten in deinem Profil.",
    xp: 250,
    source: "profile",
  },
  {
    id: "full_time_offer",
    refId: "9859ec1f-79fa-41ac-9b34-c002b7a8f638",
    title: "Full-Time Offer",
    description: "Dein Einstieg in den Job.",
    xp: 500,
    source: "claim",
  },
];

export const MIN_INTERNSHIP_MONTHS = 3;

/** Months covered by YYYY-MM start and end, both inclusive. */
function monthsBetween(start: string, end: string): number {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

function currentYearMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Milestones the profile proves; claim milestones are never returned. Like the
 * resume, only confirmed values count, so an unconfirmed suggestion earns nothing.
 */
export function profileMilestones(profile: CandidateProfile, now: Date = new Date()): Set<MilestoneId> {
  const reached = new Set<MilestoneId>();
  const degrees = new Set(profile.education.filter((e) => e.confirmed).map((e) => e.value.degree));
  if (degrees.has("bachelor")) reached.add("bachelor");
  if (degrees.has("master")) reached.add("master");

  const longInternship = profile.experience.some(({ value, confirmed }) => {
    if (!confirmed || value.type !== "internship" || value.start === null) return false;
    // An ongoing internship counts with the months so far.
    return monthsBetween(value.start, value.end ?? currentYearMonth(now)) >= MIN_INTERNSHIP_MONTHS;
  });
  if (longInternship) reached.add("internship");

  return reached;
}

export function milestoneByRefId(refId: string | null): Milestone | undefined {
  return MILESTONES.find((m) => m.refId === refId);
}
