import { z } from "zod";

// ---------------------------------------------------------------------------
// Candidate profile – the facts about a person, collected during onboarding.
// This is the ONLY source a resume may be built from.
// ---------------------------------------------------------------------------

/** "YYYY" or "YYYY-MM". */
export const partialDateSchema = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Datum als JJJJ oder JJJJ-MM");

const periodFields = {
  start: partialDateSchema.nullable().default(null),
  /** null = ongoing ("heute"). */
  end: partialDateSchema.nullable().default(null),
};

const idField = z.string().min(1).max(64);

export const profileLinkSchema = z.object({
  label: z.string().min(1).max(60),
  url: z.url(),
});

export const profilePersonalSchema = z.object({
  /** From the account – the candidate profile itself has no name. */
  name: z.string().min(1).max(120).nullable().default(null),
  email: z.email().nullable().default(null),
  phone: z.string().max(40).nullable().default(null),
  location: z.string().max(120).nullable().default(null),
  links: z.array(profileLinkSchema).max(10).default([]),
});

export const profileEducationSchema = z.object({
  id: idField,
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  field: z.string().max(200).nullable().default(null),
  location: z.string().max(120).nullable().default(null),
  grade: z.string().max(40).nullable().default(null),
  ...periodFields,
  /** `end` is the expected graduation, not yet reached. */
  endExpected: z.boolean().default(false),
  details: z.array(z.string().max(1000)).max(30).default([]),
});

export const profileExperienceSchema = z.object({
  id: idField,
  organization: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  employmentType: z.string().max(60).nullable().default(null),
  location: z.string().max(120).nullable().default(null),
  ...periodFields,
  details: z.array(z.string().max(1000)).max(30).default([]),
});

export const profileProjectSchema = z.object({
  id: idField,
  name: z.string().min(1).max(200),
  context: z.string().max(200).nullable().default(null),
  ...periodFields,
  details: z.array(z.string().max(1000)).max(30).default([]),
});

export const profileSkillSchema = z.object({
  id: idField,
  name: z.string().min(1).max(100),
  category: z.string().max(60).nullable().default(null),
  level: z.string().max(60).nullable().default(null),
});

export const profileLanguageSchema = z.object({
  id: idField,
  name: z.string().min(1).max(60),
  level: z.string().max(60).nullable().default(null),
});

export const profileOtherSchema = z.object({
  id: idField,
  title: z.string().min(1).max(200),
  /** E.g. the club or initiative of a volunteering role. */
  organization: z.string().max(200).nullable().default(null),
  ...periodFields,
  details: z.array(z.string().max(1000)).max(30).default([]),
});

export const resumeProfileSchema = z.object({
  personal: profilePersonalSchema,
  education: z.array(profileEducationSchema).max(20).default([]),
  experience: z.array(profileExperienceSchema).max(40).default([]),
  projects: z.array(profileProjectSchema).max(40).default([]),
  skills: z.array(profileSkillSchema).max(100).default([]),
  languages: z.array(profileLanguageSchema).max(20).default([]),
  other: z.array(profileOtherSchema).max(40).default([]),
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export type ProfileEducation = z.infer<typeof profileEducationSchema>;
export type ProfileExperience = z.infer<typeof profileExperienceSchema>;
export type ProfileProject = z.infer<typeof profileProjectSchema>;
export type ProfileSkill = z.infer<typeof profileSkillSchema>;
export type ProfileLanguage = z.infer<typeof profileLanguageSchema>;
export type ProfileOther = z.infer<typeof profileOtherSchema>;

export const PROFILE_ENTRY_KINDS = ["education", "experience", "projects", "skills", "languages", "other"] as const;
export type ProfileEntryKind = (typeof PROFILE_ENTRY_KINDS)[number];

// ---------------------------------------------------------------------------
// Drafts. The LLM only SELECTS profile entries (by id), orders them and writes
// bullets and the summary. Hard facts (organisation, role, dates, degree) are
// never written by the LLM, they are copied from the profile in `resolveResume`.
// ---------------------------------------------------------------------------

/** Every user has at most one resume per track; structure and tailoring depend on it. */
export const RESUME_TRACKS = ["finance", "consulting", "startup"] as const;
export const resumeTrackSchema = z.enum(RESUME_TRACKS);
export type ResumeTrack = z.infer<typeof resumeTrackSchema>;

export const RESUME_LANGUAGES = ["de", "en"] as const;
export const resumeLanguageSchema = z.enum(RESUME_LANGUAGES);
export type ResumeLanguage = z.infer<typeof resumeLanguageSchema>;

export const RESUME_SECTION_KINDS = ["experience", "education", "projects", "skills", "languages", "other"] as const;
export const resumeSectionKindSchema = z.enum(RESUME_SECTION_KINDS);
export type ResumeSectionKind = z.infer<typeof resumeSectionKindSchema>;

const draftItemSchema = z.object({
  id: z.string().min(1).max(64),
  sourceRefs: z.array(z.string().min(1).max(64)).min(1).max(20),
  bullets: z.array(z.string().min(1).max(300)).max(8),
});

/** Internal draft after `applyTrackTemplate`: fixed sections of the track, items from the LLM. */
export type ResumeDraft = {
  summary: string;
  sections: Array<{ id: string; kind: ResumeSectionKind; title: string; items: z.infer<typeof draftItemSchema>[] }>;
};

/**
 * What the LLM returns: items grouped by section kind. Section order, ids and
 * titles are fixed per track (`applyTrackTemplate`), so the model can't change
 * the structure.
 */
export const llmResumeDraftSchema = z.object({
  summary: z.string().max(700),
  sections: z
    .array(
      z.object({
        kind: resumeSectionKindSchema,
        items: z.array(draftItemSchema).max(30),
      }),
    )
    .max(10),
});
export type LlmResumeDraft = z.infer<typeof llmResumeDraftSchema>;

/** LLM output for creating a resume. */
export const resumeGenerationSchema = z.object({
  resume: llmResumeDraftSchema,
  /** What the profile lacks for the track – shown as hints, never filled in. */
  gaps: z.array(z.string().min(1).max(300)).max(8),
});

/** LLM output for revising a resume via chat instruction. */
export const resumeRevisionSchema = z.object({
  resume: llmResumeDraftSchema,
  /** One or two sentences, addressed to the user ("du"), describing what was changed. */
  note: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Resolved resume – stored in `resume_versions.content`, used for preview,
// diff and export. A snapshot: later profile changes don't alter it.
// ---------------------------------------------------------------------------

export const resumeItemSchema = z.object({
  id: z.string(),
  sourceRefs: z.array(z.string()),
  heading: z.string(),
  subheading: z.string().nullable(),
  period: z
    .object({ start: partialDateSchema.nullable(), end: partialDateSchema.nullable(), endExpected: z.boolean().optional() })
    .nullable(),
  location: z.string().nullable(),
  bullets: z.array(z.string()),
});
export type ResumeItem = z.infer<typeof resumeItemSchema>;

export const resumeSectionSchema = z.object({
  id: z.string(),
  kind: resumeSectionKindSchema,
  title: z.string(),
  items: z.array(resumeItemSchema),
});
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const resumeSchema = z.object({
  language: resumeLanguageSchema,
  targetRole: z.string(),
  header: z.object({
    name: z.string().nullable(),
    headline: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.array(profileLinkSchema),
  }),
  summary: z.string(),
  sections: z.array(resumeSectionSchema),
  gaps: z.array(z.string()),
});
export type Resume = z.infer<typeof resumeSchema>;

// ---------------------------------------------------------------------------
// API inputs
// ---------------------------------------------------------------------------

/** The role the user applies for; shown as headline in the resume. */
export const targetRoleSchema = z
  .string()
  .transform((role) => role.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(3, "Bitte gib die Rolle etwas genauer an.").max(120, "Die Rolle ist zu lang (max. 120 Zeichen)."));

export const generateResumeInputSchema = z.object({
  track: resumeTrackSchema,
  targetRole: targetRoleSchema,
  language: resumeLanguageSchema.default("de"),
});
export type GenerateResumeInput = z.infer<typeof generateResumeInputSchema>;

export const reviseResumeInputSchema = z.object({
  instruction: z.string().trim().min(3, "Bitte beschreib kurz, was geändert werden soll.").max(1000),
});

export const decideRevisionInputSchema = z.object({
  /** Ids from `diffResumes`; everything not listed is rejected. */
  acceptedChangeIds: z.array(z.string().max(200)).max(200),
});

export const updateResumeDocumentInputSchema = z
  .object({
    targetRole: targetRoleSchema.optional(),
    activeVersion: z.int().min(1).optional(),
  })
  .refine((v) => (v.targetRole === undefined) !== (v.activeVersion === undefined), "Gib entweder die Rolle oder die Version an.");

export const exportFormatSchema = z.enum(["docx", "pdf"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;
