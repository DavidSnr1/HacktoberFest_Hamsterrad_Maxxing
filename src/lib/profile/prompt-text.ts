import type { CandidateProfile } from "@/lib/schemas/candidate-profile";
import {
  EMPLOYMENT_TYPE_LABELS,
  formatEducation,
  formatLanguage,
  formatYearMonth,
  TRACK_LABELS,
} from "./labels";

type Meta = { confirmed: boolean; source: string };

/**
 * Plain-text (Markdown) view of the profile for LLM prompts.
 * By default only values the user entered or confirmed are included, which
 * is what the "invent nothing" rule requires. No ids, no internal fields.
 */
export function profileToPromptText(
  profile: CandidateProfile,
  options: { onlyConfirmed?: boolean } = {},
): string {
  const onlyConfirmed = options.onlyConfirmed ?? true;
  const include = (meta: Meta | null): boolean => meta !== null && (!onlyConfirmed || meta.confirmed);
  const lines: string[] = ["## Profil des Kandidaten"];

  const { location } = profile.basics;
  if (location && include(location)) lines.push(`- Wohnort: ${location.value}`);

  const education = profile.education.filter(include);
  if (education.length) {
    lines.push("", "### Ausbildung", ...education.map((e) => `- ${formatEducation(e.value)}`));
  }

  const skills = profile.skills.filter(include);
  if (skills.length) lines.push("", "### Fähigkeiten", `- ${skills.map((s) => s.value).join(", ")}`);

  const languages = profile.languages.filter(include);
  if (languages.length) {
    lines.push("", "### Sprachen", `- ${languages.map((l) => formatLanguage(l.value)).join(", ")}`);
  }

  const g = profile.goals;
  const goals: string[] = [];
  if (g.tracks && include(g.tracks)) goals.push(`- Bereiche: ${g.tracks.value.map((t) => TRACK_LABELS[t]).join(", ")}`);
  if (g.employmentTypes && include(g.employmentTypes)) {
    goals.push(`- Art der Stelle: ${g.employmentTypes.value.map((t) => EMPLOYMENT_TYPE_LABELS[t]).join(", ")}`);
  }
  if (g.preferredLocations && include(g.preferredLocations)) {
    goals.push(`- Wunschorte: ${g.preferredLocations.value.join(", ")}`);
  }
  if (g.remoteOk && include(g.remoteOk)) goals.push(`- Remote/hybrid: ${g.remoteOk.value ? "ja" : "nein"}`);
  if (g.earliestStart && include(g.earliestStart)) {
    goals.push(`- Frühester Start: ${formatYearMonth(g.earliestStart.value)}`);
  }
  if (goals.length) lines.push("", "### Ziele", ...goals);

  return lines.length > 1 ? lines.join("\n") : "## Profil des Kandidaten\n- (keine Angaben)";
}
