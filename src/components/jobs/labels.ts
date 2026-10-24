import type { ApplyWindow, FitReason } from "@/lib/jobs/fit";
import type { CompetitionLevel, EmploymentType, JobInsights, JobTrack } from "@/lib/schemas/job-posting";

export const TRACK_LABELS: Record<JobTrack, string> = {
  startup: "Startup",
  consulting: "Consulting",
  finance: "Finance",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  internship: "Praktikum",
  working_student: "Werkstudent",
  entry: "Einstieg",
  other: "Sonstiges",
};

export const SOURCE_LABELS: Record<string, string> = {
  arbeitsagentur: "Bundesagentur für Arbeit",
  arbeitnow: "Arbeitnow",
  adzuna: "Adzuna",
  stepstone: "StepStone",
  linkedin: "LinkedIn",
  indeed: "Indeed",
};

export const COMPETITION_LABELS: Record<CompetitionLevel, string> = {
  low: "gering",
  medium: "mittel",
  high: "hoch",
};

const SALARY_PERIOD_LABELS: Record<NonNullable<JobInsights["salary"]>["period"], string> = {
  year: "pro Jahr",
  month: "pro Monat",
  hour: "pro Stunde",
};

const moneyFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

export function formatSalary(salary: JobInsights["salary"]): string | null {
  if (!salary) return null;
  const currency = salary.currency === "EUR" ? "€" : salary.currency;
  const amount = (value: number) => `${moneyFormat.format(value)} ${currency}`;
  const single = salary.min ?? salary.max;
  if (single === null) return null;
  const range =
    salary.min !== null && salary.max !== null && salary.min !== salary.max
      ? `${amount(salary.min)} – ${amount(salary.max)}`
      : amount(single);
  return `ca. ${range} ${SALARY_PERIOD_LABELS[salary.period]}`;
}

export function formatMonthsBefore(range: { min: number; max: number } | null): string | null {
  if (!range) return null;
  if (range.max === 0) return "kurzfristig, kurz vor Start";
  const span = range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  return `ca. ${span} ${range.max === 1 ? "Monat" : "Monate"} vor Start`;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

// "2027-03" -> "03/2027"
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${monthNumber}/${year}`;
}

export function fitReasonLabel(reason: FitReason): string {
  switch (reason.kind) {
    case "track":
      return TRACK_LABELS[reason.track];
    case "type":
      return EMPLOYMENT_TYPE_LABELS[reason.type];
    case "location":
      return reason.location;
    case "remote":
      return "Remote möglich";
    case "start":
      return reason.start >= reason.earliestStart
        ? `Start ${formatMonth(reason.start)} passt`
        : `Start ${formatMonth(reason.start)} – vor deinem Wunschstart ${formatMonth(reason.earliestStart)}`;
    case "skills":
      return reason.skills.join(", ");
  }
}

const APPLY_STATUS_LABELS: Record<ApplyWindow["status"], string> = {
  early: "noch früh – merk dir die Stelle vor",
  now: "jetzt ist ein guter Zeitpunkt",
  late: "eher spät – bewirb dich zeitnah",
};

export function applyWindowLabel(applyWindow: ApplyWindow): string {
  const { from, to, start, status } = applyWindow;
  const range = from === to ? formatMonth(from) : `${formatMonth(from)}–${formatMonth(to)}`;
  return `Für deinen Start ab ${formatMonth(start)}: ca. ${range} bewerben (${APPLY_STATUS_LABELS[status]})`;
}
