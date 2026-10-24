import { z } from "zod";

/**
 * Candidate profile: the shared data basis for interview, resume, jobs and
 * gamification. Stored as jsonb in candidate_profiles.data. Every value
 * records where it came from and whether the user confirmed it, so features
 * can follow the "invent nothing" rule. See docs/candidate-profile.example.json.
 */

export const PROFILE_SCHEMA_VERSION = 1;

export const profileSourceSchema = z.enum(["resume", "experience", "interview", "user"]);
export type ProfileSource = z.infer<typeof profileSourceSchema>;

/** Month in the form YYYY-MM, e.g. "2027-09". */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format JJJJ-MM");

export const trackValues = ["startup", "consulting", "finance"] as const;
export const employmentTypeValues = ["internship", "working_student", "entry"] as const;
export const degreeValues = ["bachelor", "master", "diplom", "staatsexamen", "phd", "other"] as const;
export const languageLevelValues = ["A1", "A2", "B1", "B2", "C1", "C2", "native"] as const;

const meta = {
  source: profileSourceSchema,
  /** Id of the row the value came from (resumes.id, experiences.id), else null. */
  sourceRef: z.string().max(100).nullable(),
  confirmed: z.boolean(),
  updatedAt: z.iso.datetime(),
};

/** A single value with its origin. */
const sourced = <T extends z.ZodType>(value: T) => z.object({ value, ...meta });
/** A list entry with its origin and a stable id (for confirming or removing it). */
const sourcedItem = <T extends z.ZodType>(value: T) => z.object({ id: z.uuid(), value, ...meta });

export const educationValueSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  degree: z.enum(degreeValues),
  field: z.string().trim().min(1).max(200),
  semester: z.number().int().min(1).max(20).nullable(),
  expectedGraduation: yearMonthSchema.nullable(),
});

export const languageValueSchema = z.object({
  language: z.string().trim().min(1).max(60),
  level: z.enum(languageLevelValues),
});

export const skillValueSchema = z.string().trim().min(1).max(100);

export const candidateProfileSchema = z.object({
  schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
  basics: z.object({
    /** Current city. */
    location: sourced(z.string().trim().min(1).max(100)).nullable(),
  }),
  education: z.array(sourcedItem(educationValueSchema)).max(20),
  skills: z.array(sourcedItem(skillValueSchema)).max(100),
  languages: z.array(sourcedItem(languageValueSchema)).max(30),
  goals: z.object({
    tracks: sourced(z.array(z.enum(trackValues)).max(3)).nullable(),
    employmentTypes: sourced(z.array(z.enum(employmentTypeValues)).max(3)).nullable(),
    preferredLocations: sourced(z.array(z.string().trim().min(1).max(100)).max(20)).nullable(),
    remoteOk: sourced(z.boolean()).nullable(),
    earliestStart: sourced(yearMonthSchema).nullable(),
  }),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type EducationValue = z.infer<typeof educationValueSchema>;
export type LanguageValue = z.infer<typeof languageValueSchema>;
export type ScalarField =
  | { section: "basics"; field: keyof CandidateProfile["basics"] }
  | { section: "goals"; field: keyof CandidateProfile["goals"] };
export type ListField = "education" | "skills" | "languages";

/**
 * Partial update from one source. Omitted keys stay unchanged.
 * Scalars: a value sets the field, null clears it (only for source "user").
 * Lists: see mergeProfile for how user lists replace and others suggest.
 */
export const candidateProfilePatchSchema = z.object({
  basics: z.object({ location: z.string().trim().min(1).max(100).nullable() }).partial().optional(),
  education: z.array(educationValueSchema).max(20).optional(),
  skills: z.array(skillValueSchema).max(100).optional(),
  languages: z.array(languageValueSchema).max(30).optional(),
  goals: z
    .object({
      tracks: z.array(z.enum(trackValues)).max(3).nullable(),
      employmentTypes: z.array(z.enum(employmentTypeValues)).max(3).nullable(),
      preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20).nullable(),
      remoteOk: z.boolean().nullable(),
      earliestStart: yearMonthSchema.nullable(),
    })
    .partial()
    .optional(),
});

export type CandidateProfilePatch = z.infer<typeof candidateProfilePatchSchema>;

/** Target of a confirm/reject action in the UI. */
export const profileTargetSchema = z.union([
  z.object({ section: z.literal("basics"), field: z.enum(["location"]) }),
  z.object({
    section: z.literal("goals"),
    field: z.enum(["tracks", "employmentTypes", "preferredLocations", "remoteOk", "earliestStart"]),
  }),
  z.object({ list: z.enum(["education", "skills", "languages"]), id: z.uuid() }),
]);

export type ProfileTarget = z.infer<typeof profileTargetSchema>;
