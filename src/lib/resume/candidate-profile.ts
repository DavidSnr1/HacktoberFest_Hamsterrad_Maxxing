import { z } from "zod";

import { partialDateSchema, resumeProfileSchema, type ResumeProfile } from "@/lib/schemas/resume";

import { ensureProfileIds } from "./profile";

// ---------------------------------------------------------------------------
// Candidate profile as delivered by onboarding (final format, schemaVersion 1).
// Every value carries its origin and whether the user confirmed it.
// ---------------------------------------------------------------------------

const sourced = <T extends z.ZodType>(value: T) =>
  z.object({
    id: z.string().max(64).nullish(),
    value,
    source: z.string(),
    sourceRef: z.string().nullable(),
    confirmed: z.boolean(),
    updatedAt: z.string(),
  });

/** Period and details shared by experience, projects and volunteering. */
const stationFields = {
  start: z.string().nullish(),
  end: z.string().nullish(),
  details: z.array(z.string()).default([]),
};

export const DEGREES = ["bachelor", "master", "diplom", "staatsexamen", "phd", "other"] as const;
export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "native"] as const;

export const candidateProfileFormatSchema = z.object({
  schemaVersion: z.literal(1),
  basics: z
    .object({
      displayName: sourced(z.string()).nullish(),
      location: sourced(z.string()).nullish(),
    })
    .default({}),
  education: z
    .array(
      sourced(
        z.object({
          institution: z.string().min(1),
          degree: z.enum(DEGREES),
          field: z.string(),
          semester: z.number().int().min(1).max(20).nullable(),
          expectedGraduation: z.string().nullable(),
        }),
      ),
    )
    .default([]),
  skills: z.array(sourced(z.string().min(1))).default([]),
  languages: z.array(sourced(z.object({ language: z.string().min(1), level: z.enum(LANGUAGE_LEVELS) }))).default([]),
  experience: z
    .array(
      sourced(
        z.object({
          organization: z.string().min(1),
          role: z.string().min(1),
          type: z.string().nullish(),
          location: z.string().nullish(),
          ...stationFields,
        }),
      ),
    )
    .default([]),
  projects: z
    .array(sourced(z.object({ name: z.string().min(1), context: z.string().nullish(), ...stationFields })))
    .default([]),
  volunteering: z
    .array(sourced(z.object({ organization: z.string().min(1), role: z.string().min(1), ...stationFields })))
    .default([]),
  // Job preferences – not resume content, kept loose on purpose.
  goals: z.unknown().optional(),
});
export type CandidateProfileFormat = z.infer<typeof candidateProfileFormatSchema>;

/**
 * Only values the user confirmed end up in a resume. Unconfirmed values are
 * automatic suggestions (e.g. extracted from an old CV) the person hasn't
 * checked yet – putting them into an application would be "inventing".
 */
export const INCLUDE_UNCONFIRMED = false;

function usable<T extends { confirmed: boolean }>(entry: T | null | undefined): entry is T {
  return Boolean(entry && (entry.confirmed || INCLUDE_UNCONFIRMED));
}

export type AccountInfo = { name: string | null; email: string | null };

function currentMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Dates the resume can't show (wrong format) are dropped; a missing end with a start means "ongoing". */
function period(value: { start?: string | null; end?: string | null }) {
  const valid = (date: string | null | undefined) => (date && partialDateSchema.safeParse(date).success ? date : null);
  const start = valid(value.start);
  return { start, end: start ? valid(value.end) : null };
}

const cleanDetails = (details: string[]) => details.map((d) => d.trim()).filter(Boolean);

export class ProfileFormatError extends Error {}

/** Parses the onboarding JSON. Throws `ProfileFormatError` if it doesn't match the format. */
export function parseCandidateProfile(json: unknown): CandidateProfileFormat {
  let raw = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch {
      throw new ProfileFormatError("Profil ist kein gültiges JSON.");
    }
  }
  const parsed = candidateProfileFormatSchema.safeParse(raw);
  if (!parsed.success) throw new ProfileFormatError("Profil hat nicht das erwartete Format.");
  return parsed.data;
}

/**
 * Maps the onboarding profile to the resume feature's internal profile.
 * Name and e-mail come from the account; the profile has no contact data.
 */
export function toResumeProfile(profile: CandidateProfileFormat, account: AccountInfo, now = new Date()): ResumeProfile {
  const month = currentMonth(now);
  const displayName = usable(profile.basics.displayName) ? profile.basics.displayName.value.trim() : "";
  const location = usable(profile.basics.location) ? profile.basics.location.value.trim() : "";

  const education = profile.education.filter(usable).map((entry) => {
    const { institution, degree, field, semester, expectedGraduation } = entry.value;
    const end = expectedGraduation && partialDateSchema.safeParse(expectedGraduation).success ? expectedGraduation : null;
    const ongoing = end === null || end > month;
    return {
      id: entry.id,
      institution,
      degree,
      field: field.trim() || null,
      location: null,
      grade: null,
      start: null,
      end,
      endExpected: end !== null && ongoing,
      details: ongoing && semester ? [`${semester}. Fachsemester`] : [],
    };
  });

  return resumeProfileSchema.parse(
    ensureProfileIds({
      personal: {
        name: displayName || account.name?.trim() || null,
        email: account.email,
        phone: null,
        location: location || null,
        links: [],
      },
      education,
      experience: profile.experience.filter(usable).map((entry) => ({
        id: entry.id,
        organization: entry.value.organization.trim(),
        role: entry.value.role.trim(),
        // Code ("internship" …); `resolveResume` shows it in the resume's language.
        employmentType: entry.value.type ?? null,
        location: entry.value.location?.trim() || null,
        ...period(entry.value),
        details: cleanDetails(entry.value.details),
      })),
      projects: profile.projects.filter(usable).map((entry) => ({
        id: entry.id,
        name: entry.value.name.trim(),
        context: entry.value.context?.trim() || null,
        ...period(entry.value),
        details: cleanDetails(entry.value.details),
      })),
      skills: profile.skills.filter(usable).map((entry) => ({ id: entry.id, name: entry.value.trim(), category: null, level: null })),
      languages: profile.languages
        .filter(usable)
        .map((entry) => ({ id: entry.id, name: entry.value.language.trim(), level: entry.value.level })),
      // Volunteering is the "other" kind; the tracks show it as "Engagement".
      other: profile.volunteering.filter(usable).map((entry) => ({
        id: entry.id,
        title: entry.value.role.trim(),
        organization: entry.value.organization.trim(),
        ...period(entry.value),
        details: cleanDetails(entry.value.details),
      })),
    }),
  );
}
