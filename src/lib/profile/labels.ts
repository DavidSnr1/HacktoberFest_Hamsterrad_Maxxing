import type {
  CandidateProfile,
  EducationValue,
  ExperienceValue,
  LanguageValue,
  ProjectValue,
  VolunteeringValue,
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

export const EXPERIENCE_TYPE_LABELS: Record<NonNullable<ExperienceValue["type"]>, string> = {
  internship: "Praktikum",
  working_student: "Werkstudent",
  full_time: "Festanstellung",
  part_time: "Nebenjob",
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

/** "09/2025 – heute", "03/2024 – 08/2024", or null without dates. */
export function formatPeriod({ start, end }: { start: string | null; end: string | null }) {
  const short = (value: string) => value.split("-").reverse().join("/");
  if (!start) return null;
  return `${short(start)} – ${end ? short(end) : "heute"}`;
}

const withPeriod = (text: string, period: { start: string | null; end: string | null }) => {
  const formatted = formatPeriod(period);
  return formatted ? `${text} (${formatted})` : text;
};

export function formatExperience(e: ExperienceValue) {
  const type = e.type && e.type !== "other" ? `, ${EXPERIENCE_TYPE_LABELS[e.type]}` : "";
  return withPeriod(`${e.role} bei ${e.organization}${type}`, e);
}

export function formatProject(p: ProjectValue) {
  return withPeriod(p.context ? `${p.name}, ${p.context}` : p.name, p);
}

export function formatVolunteering(v: VolunteeringValue) {
  return withPeriod(`${v.role} bei ${v.organization}`, v);
}
