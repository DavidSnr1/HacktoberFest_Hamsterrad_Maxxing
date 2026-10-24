import type {
  LlmResumeDraft,
  Resume,
  ResumeDraft,
  ResumeLanguage,
  ResumeSectionKind,
  ResumeTrack,
} from "@/lib/schemas/resume";

// Every user has at most three resumes – one per track. The track fixes the
// structure (section order and titles) and the tailoring focus; the role the
// user enters only appears as the headline.

type SectionTemplate = { kind: ResumeSectionKind; title: Record<ResumeLanguage, string> };

export type TrackTemplate = {
  label: string;
  description: string;
  /** Fixed section order; empty sections are hidden in preview and export. */
  sections: SectionTemplate[];
  /** Tailoring guidance for the model (German). */
  focus: string;
};

const EDUCATION: SectionTemplate = { kind: "education", title: { de: "Ausbildung", en: "Education" } };
const EXPERIENCE: SectionTemplate = { kind: "experience", title: { de: "Praxiserfahrung", en: "Experience" } };
const LANGUAGES: SectionTemplate = { kind: "languages", title: { de: "Sprachen", en: "Languages" } };

export const TRACK_TEMPLATES: Record<ResumeTrack, TrackTemplate> = {
  finance: {
    label: "Finance",
    description: "Investment Banking, M&A, Private Equity, Corporate Finance, Audit",
    sections: [
      EDUCATION,
      EXPERIENCE,
      { kind: "projects", title: { de: "Projekte", en: "Projects" } },
      { kind: "skills", title: { de: "Fachkenntnisse", en: "Technical Skills" } },
      LANGUAGES,
      { kind: "other", title: { de: "Engagement", en: "Activities" } },
    ],
    focus:
      "Analytische und quantitative Stärke, Finanzmodellierung und Bewertung, Genauigkeit, Belastbarkeit und akademische Leistungen. Ton: sachlich, präzise, zurückhaltend.",
  },
  consulting: {
    label: "Consulting",
    description: "Strategie- und Managementberatung",
    sections: [
      EDUCATION,
      EXPERIENCE,
      { kind: "projects", title: { de: "Projekte & Cases", en: "Projects & Cases" } },
      { kind: "other", title: { de: "Engagement & Leadership", en: "Leadership & Activities" } },
      { kind: "skills", title: { de: "Methoden & Tools", en: "Methods & Tools" } },
      LANGUAGES,
    ],
    focus:
      "Strukturiertes Problemlösen, Analytik, Kommunikation und Präsentation, Teamarbeit, messbare Wirkung sowie Verantwortung und Leadership. Ton: ergebnisorientiert, klar, prägnant.",
  },
  startup: {
    label: "Startup",
    description: "Founder's Associate, Business Development, Growth, Operations, Product",
    sections: [
      EXPERIENCE,
      { kind: "projects", title: { de: "Projekte", en: "Projects" } },
      { kind: "skills", title: { de: "Skills & Tools", en: "Skills & Tools" } },
      EDUCATION,
      LANGUAGES,
      { kind: "other", title: { de: "Engagement", en: "Activities" } },
    ],
    focus:
      "Eigeninitiative, Hands-on-Mentalität, Umsetzungsstärke, Vielseitigkeit, Tools und Tech-Skills sowie eigene Projekte. Ton: direkt und aktiv, ohne Übertreibung.",
  },
};

/** Builds the internal draft: fixed section order, ids and titles of the track; items from the model. */
export function applyTrackTemplate(draft: LlmResumeDraft, track: ResumeTrack, language: ResumeLanguage): ResumeDraft {
  const itemsByKind = new Map<ResumeSectionKind, LlmResumeDraft["sections"][number]["items"]>();
  for (const section of draft.sections) {
    itemsByKind.set(section.kind, [...(itemsByKind.get(section.kind) ?? []), ...section.items]);
  }
  return {
    summary: draft.summary,
    sections: TRACK_TEMPLATES[track].sections.map((template) => ({
      id: `s-${template.kind}`,
      kind: template.kind,
      title: template.title[language],
      items: itemsByKind.get(template.kind) ?? [],
    })),
  };
}

/** Current state of a resume in the shape the model works with. */
export function toLlmDraft(resume: Resume): LlmResumeDraft {
  return {
    summary: resume.summary,
    sections: resume.sections
      .filter((section) => section.items.length > 0)
      .map((section) => ({
        kind: section.kind,
        items: section.items.map((item) => ({ id: item.id, sourceRefs: item.sourceRefs, bullets: item.bullets })),
      })),
  };
}

/** Takes over a new role: it is the headline of the resume, nothing else changes. */
export function withRole(resume: Resume, targetRole: string): Resume {
  return { ...resume, targetRole, header: { ...resume.header, headline: targetRole } };
}

/**
 * Shows the account's current name. The name is account data, not resume
 * content, so a name set after creating the resume appears without regenerating it.
 */
export function withName(resume: Resume, name: string | null): Resume {
  return { ...resume, header: { ...resume.header, name } };
}

const TRACK_KEYWORDS: Record<ResumeTrack, RegExp[]> = {
  finance: [
    /financ/,
    /finanz/,
    /\bbank/,
    /invest/,
    /\bm&a\b/,
    /mergers/,
    /private equity/,
    /\bpe\b/,
    /venture capital/,
    /\bvc\b/,
    /asset management/,
    /wealth/,
    /audit/,
    /wirtschaftsprüf/,
    /controlling/,
    /accounting/,
    /rechnungswesen/,
    /treasury/,
    /\brisk/,
    /risiko/,
    /trading/,
    /equity research/,
    /kredit/,
    /credit/,
    /valuation/,
    /transaction/,
  ],
  consulting: [
    /consult/,
    /berat/,
    /\bstrateg/,
    /mckinsey/,
    /\bbcg\b/,
    /boston consulting/,
    /\bbain\b/,
    /roland berger/,
    /oliver wyman/,
    /kearney/,
    /advisory/,
  ],
  startup: [
    /start-?up/,
    /founder/,
    /gründer/,
    /venture build/,
    /company build/,
    /growth/,
    /business development/,
    /\bbizdev/,
    /\bproduct/,
    /produktmanag/,
    /\boperations\b/,
    /scale-?up/,
    /\bseed\b/,
    /early[- ]stage/,
    /entrepreneur/,
  ],
};

/** Suggests the track for a role from keywords; null if there is no clear match. */
export function suggestTrack(role: string): ResumeTrack | null {
  const text = role.toLowerCase();
  const scores = (Object.keys(TRACK_KEYWORDS) as ResumeTrack[]).map((track) => ({
    track,
    score: TRACK_KEYWORDS[track].filter((pattern) => pattern.test(text)).length,
  }));
  const best = Math.max(...scores.map((s) => s.score));
  const leaders = scores.filter((s) => s.score === best);
  return best > 0 && leaders.length === 1 ? leaders[0].track : null;
}
