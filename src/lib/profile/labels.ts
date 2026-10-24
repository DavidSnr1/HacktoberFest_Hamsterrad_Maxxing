import type {
  CandidateProfile,
  EducationValue,
  LanguageValue,
} from "@/lib/schemas/candidate-profile";

/** German display labels for profile values (UI and prompt text). */

export const TRACK_LABELS: Record<NonNullable<CandidateProfile["goals"]["tracks"]>["value"][number], string> = {
  consulting: "Consulting",
  finance: "Finance",
  startup: "Startup",
};

export const EMPLOYMENT_TYPE_LABELS: Record<
  NonNullable<CandidateProfile["goals"]["employmentTypes"]>["value"][number],
  string
> = {
  internship: "Praktikum",
  working_student: "Werkstudent",
  entry: "Berufseinstieg",
};

export const DEGREE_LABELS: Record<EducationValue["degree"], string> = {
  bachelor: "Bachelor",
  master: "Master",
  diplom: "Diplom",
  staatsexamen: "Staatsexamen",
  phd: "Promotion",
  other: "Sonstiges",
};

export const LANGUAGE_LEVEL_LABELS: Record<LanguageValue["level"], string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
  native: "Muttersprache",
};

const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2027-09" -> "September 2027". */
export function formatYearMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatEducation(e: EducationValue) {
  const parts = [`${DEGREE_LABELS[e.degree]} ${e.field}`, e.institution];
  if (e.semester) parts.push(`${e.semester}. Semester`);
  if (e.expectedGraduation) parts.push(`Abschluss ${formatYearMonth(e.expectedGraduation)}`);
  return parts.join(", ");
}

export function formatLanguage(l: LanguageValue) {
  return `${l.language} (${LANGUAGE_LEVEL_LABELS[l.level]})`;
}
