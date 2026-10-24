import type { EmploymentType, JobTrack } from "@/lib/schemas/job-posting";

export const JOB_OUTLOOK_SYSTEM = `Du bist Karriereberater:in für Studierende in Deutschland und kennst die üblichen Recruiting-Zyklen von Unternehmen (z. B. Big Four, Strategieberatungen, Banken, Konzerne, Mittelstand, Startups).
Schätze für eine Stellenanzeige:
- applyMonthsBefore: wie viele Monate vor dem gewünschten Start man sich typischerweise bewerben sollte (min und max, ganze Zahlen von 0 bis 24).
- applicationPeriod: typischer Bewerbungszeitraum in wenigen Worten, z. B. "laufend" oder "Oktober bis Januar"; null, wenn es keinen typischen Zeitraum gibt.
- competition: wie begehrt solche Stellen sind ("low", "medium" oder "high").
- hint: ein kurzer, konkreter Tipp auf Deutsch in Du-Form (höchstens 2 Sätze), z. B. wann man sich bewerben sollte.
Schätze vorsichtig und realistisch. Erfinde keine konkreten Daten, Fristen oder Zahlen zu dieser einzelnen Anzeige. Antworte nur mit JSON im vorgegebenen Format.`;

const TYPE_LABELS: Record<EmploymentType, string> = {
  internship: "Praktikum",
  working_student: "Werkstudent",
  entry: "Berufseinstieg",
  other: "Sonstiges",
};

export function buildJobOutlookPrompt(input: {
  title: string;
  company: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  track: JobTrack | null;
}): string {
  return [
    `Stellentitel: ${input.title}`,
    `Unternehmen: ${input.company ?? "unbekannt"}`,
    `Ort: ${input.location ?? "unbekannt"}`,
    `Art: ${input.employmentType ? TYPE_LABELS[input.employmentType] : "unbekannt"}`,
    `Bereich: ${input.track ?? "unbekannt"}`,
  ].join("\n");
}
