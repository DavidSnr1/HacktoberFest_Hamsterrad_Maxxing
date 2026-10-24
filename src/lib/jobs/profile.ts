import { z } from "zod";

import { JOB_TRACKS, type EmploymentType, type JobTrack } from "@/lib/schemas/job-posting";
import { isRecord } from "./embedded-json";

// What job search takes from the onboarding profile (final format, schemaVersion 1,
// see fixtures/candidate-profile.example.json). Safe to use on the client.
export type JobPreferences = {
  locations: string[]; // preferred locations first, then the home location
  tracks: JobTrack[];
  types: Exclude<EmploymentType, "other">[];
  remoteOk: boolean;
  earliestStart: string | null; // "YYYY-MM"
  skills: string[]; // short skill names for matching, e.g. "Excel"
};

const SEARCHABLE_TYPES = ["internship", "working_student", "entry"] as const;

// Same rule as the resume feature: only values the user confirmed are used.
function confirmedValue<T>(schema: z.ZodType<T>, entry: unknown): T | null {
  const parsed = z.object({ value: schema, confirmed: z.boolean() }).safeParse(entry);
  return parsed.success && parsed.data.confirmed ? parsed.data.value : null;
}

function oneOf<T extends string>(values: readonly T[], input: string[] | null): T[] {
  return (input ?? []).filter((value): value is T => (values as readonly string[]).includes(value));
}

// "Excel-Modellierung (DCF, Szenarioanalysen)" -> "Excel", "Python (pandas)" -> "Python".
export function skillKeyword(skill: string): string | null {
  const keyword = skill.split("(")[0]?.trim().split(/[\s/-]+/)[0]?.trim() ?? "";
  return keyword.length >= 2 ? keyword : null;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Lenient on purpose: a malformed section is skipped instead of discarding the whole profile.
export function toJobPreferences(raw: unknown): JobPreferences | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const basics = isRecord(raw.basics) ? raw.basics : {};
  const goals = isRecord(raw.goals) ? raw.goals : {};
  const strings = z.array(z.string().trim().min(1));

  const home = confirmedValue(z.string().trim().min(1), basics.location);
  const start = confirmedValue(z.string().regex(/^\d{4}-\d{2}$/), goals.earliestStart);
  const skills = Array.isArray(raw.skills) ? raw.skills.map((entry) => confirmedValue(z.string(), entry)) : [];

  const preferences: JobPreferences = {
    locations: unique([...(confirmedValue(strings, goals.preferredLocations) ?? []), ...(home ? [home] : [])]),
    tracks: oneOf(JOB_TRACKS, confirmedValue(strings, goals.tracks)),
    types: oneOf(SEARCHABLE_TYPES, confirmedValue(strings, goals.employmentTypes)),
    remoteOk: confirmedValue(z.boolean(), goals.remoteOk) ?? false,
    earliestStart: start,
    skills: unique(skills.flatMap((skill) => (skill ? (skillKeyword(skill) ?? []) : []))),
  };

  const empty =
    !preferences.locations.length &&
    !preferences.tracks.length &&
    !preferences.types.length &&
    !preferences.earliestStart &&
    !preferences.skills.length;
  return empty ? null : preferences;
}
