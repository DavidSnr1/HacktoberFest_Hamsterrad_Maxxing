import type { Resume, ResumeItem, ResumeLanguage, ResumeSection } from "@/lib/schemas/resume";

// Shared by preview (client), DOCX and PDF so all three look the same.

const LABELS = {
  de: { present: "heute", expected: "voraussichtlich", summary: "Profil" },
  en: { present: "present", expected: "expected", summary: "Profile" },
} as const satisfies Record<ResumeLanguage, Record<string, string>>;

export function resumeLabels(language: ResumeLanguage) {
  return LABELS[language];
}

function formatDate(date: string): string {
  const [year, month] = date.split("-");
  return month ? `${month}/${year}` : year;
}

/** "08/2024 – 10/2024", "10/2025 – heute", "2024", "voraussichtlich 09/2027". */
export function formatPeriod(period: ResumeItem["period"], language: ResumeLanguage): string | null {
  if (!period || (!period.start && !period.end)) return null;
  const { start } = period;
  const end = period.end ? (period.endExpected ? `${LABELS[language].expected} ${formatDate(period.end)}` : formatDate(period.end)) : null;
  if (start && end) return start === period.end ? end : `${formatDate(start)} – ${end}`;
  if (start) return `${formatDate(start)} – ${LABELS[language].present}`;
  return end;
}

/** Skills and languages are rendered as one compact line instead of a list of items. */
export function isCompactSection(section: ResumeSection): boolean {
  return section.kind === "skills" || section.kind === "languages";
}

export function compactSectionText(section: ResumeSection): string {
  return section.items
    .map((item) => {
      if (!item.subheading) return item.heading;
      return item.heading.endsWith(")") ? `${item.heading} – ${item.subheading}` : `${item.heading} (${item.subheading})`;
    })
    .join(" · ");
}

export function itemMetaLine(item: ResumeItem): string | null {
  const parts = [item.subheading, item.location].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function contactLine(resume: Resume): string {
  const { header } = resume;
  return [header.location, header.email, header.phone, ...header.links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, ""))]
    .filter(Boolean)
    .join(" · ");
}

/** Visible sections only (empty ones are skipped in every output). */
export function visibleSections(resume: Resume): ResumeSection[] {
  return resume.sections.filter((s) => s.items.length > 0);
}

export function documentTitle(resume: Resume): string {
  return [resume.header.name, resume.targetRole].filter(Boolean).join(" – ");
}
