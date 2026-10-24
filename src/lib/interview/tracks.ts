import type { Enums } from "@/lib/supabase/database.types";

export type InterviewTrack = Enums<"interview_track">;

export type TrackConfig = {
  label: string;
  tagline: string;
  topics: string[];
  /** Tracks are switched on one by one as their agent and rubric are ready. */
  enabled: boolean;
  interviewer: { name: string; role: string; initials: string };
};

export const TRACKS: Record<InterviewTrack, TrackConfig> = {
  consulting: {
    label: "Consulting",
    tagline: "Fit-Fragen und ein Case wie bei einer Strategieberatung.",
    topics: ["Motivation und Fit", "Führung und Teamarbeit", "Case: Markt oder Profitabilität"],
    enabled: true,
    interviewer: { name: "Lena Hartmann", role: "Principal, Strategieberatung", initials: "LH" },
  },
  finance: {
    label: "Finance",
    tagline: "Fit-Fragen und Technicals für Investment Banking und PE.",
    topics: ["Accounting-Grundlagen", "Bewertung, DCF und Multiples", "Deal- und Pitch-Fragen"],
    enabled: false,
    interviewer: { name: "Markus Weber", role: "Vice President, Investment Banking", initials: "MW" },
  },
  startup: {
    label: "Startup",
    tagline: "Ownership, Produktdenken und Umgang mit Unsicherheit.",
    topics: ["Motivation für Startups", "Ownership und Priorisierung", "Produkt- oder Growth-Szenario"],
    enabled: false,
    interviewer: { name: "Jonas Becker", role: "Head of Product, Series-B-Startup", initials: "JB" },
  },
};

/** Display order on the track selection page. */
export const TRACK_ORDER: InterviewTrack[] = ["consulting", "finance", "startup"];
