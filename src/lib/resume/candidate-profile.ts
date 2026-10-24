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
      experience: [],
      projects: [],
      skills: profile.skills.filter(usable).map((entry) => ({ id: entry.id, name: entry.value.trim(), category: null, level: null })),
      languages: profile.languages
        .filter(usable)
        .map((entry) => ({ id: entry.id, name: entry.value.language.trim(), level: entry.value.level })),
      other: [],
    }),
  );
}
