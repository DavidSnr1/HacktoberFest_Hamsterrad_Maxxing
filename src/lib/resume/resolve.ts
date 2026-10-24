import type {
  ResumeProfile,
  Resume,
  ResumeDraft,
  ResumeItem,
  ResumeLanguage,
} from "@/lib/schemas/resume";

import { indexProfile, type ProfileEntry } from "./profile";

function joinParts(parts: Array<string | null | undefined>, separator = " · "): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p && p.trim()));
  return filtered.length > 0 ? filtered.join(separator) : null;
}

const DEGREE_LABELS: Record<ResumeLanguage, Record<string, string | null>> = {
  de: { bachelor: "Bachelor", master: "Master", diplom: "Diplom", staatsexamen: "Staatsexamen", phd: "Promotion", other: null },
  en: { bachelor: "Bachelor", master: "Master", diplom: "Diplom", staatsexamen: "State Examination", phd: "PhD", other: null },
};

/** Employment type codes from onboarding; unknown values are shown as entered, null hides the type. */
const EMPLOYMENT_TYPE_LABELS: Record<ResumeLanguage, Record<string, string | null>> = {
  de: { internship: "Praktikum", working_student: "Werkstudent", full_time: "Vollzeit", part_time: "Teilzeit", other: null },
  en: { internship: "Internship", working_student: "Working Student", full_time: "Full-time", part_time: "Part-time", other: null },
};

const LEVEL_LABELS: Record<ResumeLanguage, Record<string, string>> = {
  de: { native: "Muttersprache" },
  en: { native: "Native" },
};

/** "Master BWL" / "Master in BWL"; free-text degrees are shown as "<degree>, <field>". */
function degreeHeading(degree: string, field: string | null, language: ResumeLanguage): string {
  const labels = DEGREE_LABELS[language];
  if (!Object.hasOwn(labels, degree)) return joinParts([degree, field], ", ") ?? degree;
  const label = labels[degree];
  if (!label) return field ?? degree;
  if (!field) return label;
  return language === "de" ? `${label} ${field}` : `${label} in ${field}`;
}

function employmentTypeLabel(type: string | null, language: ResumeLanguage): string | null {
  if (!type) return null;
  const labels = EMPLOYMENT_TYPE_LABELS[language];
  return Object.hasOwn(labels, type) ? labels[type] : type;
}

function levelLabel(level: string, language: ResumeLanguage): string {
  const labels = LEVEL_LABELS[language];
  return Object.hasOwn(labels, level) ? labels[level] : level;
}

/** Facts of an item, always taken from the profile – never from the LLM. */
function resolveFacts(
  source: ProfileEntry,
  language: ResumeLanguage,
): Pick<ResumeItem, "heading" | "subheading" | "period" | "location"> {
  switch (source.kind) {
    case "experience": {
      const e = source.entry;
      return {
        heading: e.role,
        subheading: joinParts([e.organization, employmentTypeLabel(e.employmentType, language)]),
        period: { start: e.start, end: e.end },
        location: e.location,
      };
    }
    case "education": {
      const e = source.entry;
      const grade = e.grade ? `${language === "de" ? "Note" : "Grade"} ${e.grade}` : null;
      return {
        heading: degreeHeading(e.degree, e.field, language),
        subheading: joinParts([e.institution, grade]),
        period: { start: e.start, end: e.end, endExpected: e.endExpected },
        location: e.location,
      };
    }
    case "projects": {
      const e = source.entry;
      return { heading: e.name, subheading: e.context, period: { start: e.start, end: e.end }, location: null };
    }
    case "other": {
      const e = source.entry;
      return { heading: e.title, subheading: e.organization, period: { start: e.start, end: e.end }, location: null };
    }
    case "skills":
      return { heading: source.entry.name, subheading: source.entry.level, period: null, location: null };
    case "languages": {
      const level = source.entry.level;
      return {
        heading: source.entry.name,
        subheading: level ? levelLabel(level, language) : null,
        period: null,
        location: null,
      };
    }
  }
}

/**
 * Turns a validated draft into the stored resume snapshot. Expects the draft
 * to have passed `validateResumeDraft`; items with unknown sources are dropped.
 */
export function resolveResume(
  draft: ResumeDraft,
  profile: ResumeProfile,
  meta: { language: ResumeLanguage; targetRole: string; gaps: string[] },
): Resume {
  const index = indexProfile(profile);
  const { personal } = profile;

  return {
    language: meta.language,
    targetRole: meta.targetRole,
    header: {
      name: personal.name,
      // The entered role is taken over as the headline of the resume.
      headline: meta.targetRole,
      email: personal.email,
      phone: personal.phone,
      location: personal.location,
      links: personal.links,
    },
    summary: draft.summary.trim(),
    sections: draft.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      title: section.title.trim(),
      items: section.items.flatMap((item) => {
        const source = index.get(item.sourceRefs[0]);
        if (!source) return [];
        return [
          {
            id: item.id,
            sourceRefs: item.sourceRefs,
            ...resolveFacts(source, meta.language),
            bullets: item.bullets.map((b) => b.trim()).filter(Boolean),
          },
        ];
      }),
    })),
    gaps: meta.gaps,
  };
}
