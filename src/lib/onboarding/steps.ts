import { z } from "zod";
import { DEGREE_LABELS, EMPLOYMENT_TYPE_LABELS, LANGUAGE_LEVEL_LABELS, TRACK_LABELS } from "@/lib/profile/labels";
import {
  degreeValues,
  educationValueSchema,
  employmentTypeValues,
  languageLevelValues,
  languageValueSchema,
  skillValueSchema,
  trackValues,
  yearMonthSchema,
  type CandidateProfile,
  type CandidateProfilePatch,
} from "@/lib/schemas/candidate-profile";

/**
 * Questions of the onboarding chat. Each step validates its answer and maps
 * it to a profile patch (stored with source "user"). Shared by the chat UI
 * (input type, prefill) and the server action (validation, patch).
 */

type Option = { value: string; label: string };

export type StepInput =
  | { kind: "education" }
  | { kind: "text"; placeholder: string }
  | { kind: "single"; options: Option[] }
  | { kind: "multi"; options: Option[] }
  | { kind: "tags"; placeholder: string; suggestions: string[] }
  | { kind: "month" }
  | { kind: "languages" };

const options = <T extends string>(labels: Record<T, string>, values: readonly T[]): Option[] =>
  values.map((value) => ({ value, label: labels[value] }));

const tagList = (max: number) =>
  z.array(z.string().trim().min(1).max(100)).min(1).max(max).transform((items) => [...new Set(items)]);

function defineStep<const Id extends string, S extends z.ZodType>(step: {
  id: Id;
  input: StepInput;
  schema: S;
  toPatch: (answer: z.infer<S>) => CandidateProfilePatch;
  /** Current user-entered value for prefilling, or undefined. */
  fromProfile: (profile: CandidateProfile) => z.infer<S> | undefined;
}) {
  return step;
}

export const ONBOARDING_STEPS = [
  defineStep({
    id: "education",
    input: { kind: "education" },
    schema: educationValueSchema,
    toPatch: (education) => ({ education: [education] }),
    fromProfile: (p) => p.education.find((e) => e.source === "user")?.value,
  }),
  defineStep({
    id: "location",
    input: { kind: "text", placeholder: "z. B. Mannheim" },
    schema: z.string().trim().min(1).max(100),
    toPatch: (location) => ({ basics: { location } }),
    fromProfile: (p) => (p.basics.location?.source === "user" ? p.basics.location.value : undefined),
  }),
  defineStep({
    id: "tracks",
    input: { kind: "multi", options: options(TRACK_LABELS, trackValues) },
    schema: z.array(z.enum(trackValues)).min(1).max(3),
    toPatch: (tracks) => ({ goals: { tracks } }),
    fromProfile: (p) => (p.goals.tracks?.source === "user" ? p.goals.tracks.value : undefined),
  }),
  defineStep({
    id: "employmentTypes",
    input: { kind: "multi", options: options(EMPLOYMENT_TYPE_LABELS, employmentTypeValues) },
    schema: z.array(z.enum(employmentTypeValues)).min(1).max(3),
    toPatch: (employmentTypes) => ({ goals: { employmentTypes } }),
    fromProfile: (p) => (p.goals.employmentTypes?.source === "user" ? p.goals.employmentTypes.value : undefined),
  }),
  defineStep({
    id: "preferredLocations",
    input: {
      kind: "tags",
      placeholder: "Stadt eingeben und Enter drücken",
      suggestions: ["Frankfurt am Main", "München", "Berlin", "Hamburg", "Düsseldorf", "Köln", "Stuttgart"],
    },
    schema: tagList(20),
    toPatch: (preferredLocations) => ({ goals: { preferredLocations } }),
    fromProfile: (p) =>
      p.goals.preferredLocations?.source === "user" ? p.goals.preferredLocations.value : undefined,
  }),
  defineStep({
    id: "remoteOk",
    input: {
      kind: "single",
      options: [
        { value: "yes", label: "Ja, gern" },
        { value: "no", label: "Lieber vor Ort" },
      ],
    },
    schema: z.enum(["yes", "no"]),
    toPatch: (answer) => ({ goals: { remoteOk: answer === "yes" } }),
    fromProfile: (p) =>
      p.goals.remoteOk?.source === "user" ? (p.goals.remoteOk.value ? "yes" : "no") : undefined,
  }),
  defineStep({
    id: "earliestStart",
    input: { kind: "month" },
    schema: yearMonthSchema,
    toPatch: (earliestStart) => ({ goals: { earliestStart } }),
    fromProfile: (p) => (p.goals.earliestStart?.source === "user" ? p.goals.earliestStart.value : undefined),
  }),
  defineStep({
    id: "skills",
    input: {
      kind: "tags",
      placeholder: "Skill eingeben und Enter drücken",
      suggestions: ["Excel", "PowerPoint", "SQL", "Python", "Financial Modeling", "Projektmanagement"],
    },
    schema: z.array(skillValueSchema).min(1).max(100).transform((items) => [...new Set(items)]),
    toPatch: (skills) => ({ skills }),
    fromProfile: (p) => {
      const skills = p.skills.filter((s) => s.source === "user").map((s) => s.value);
      return skills.length ? skills : undefined;
    },
  }),
  defineStep({
    id: "languages",
    input: { kind: "languages" },
    schema: z.array(languageValueSchema).min(1).max(30),
    toPatch: (languages) => ({ languages }),
    fromProfile: (p) => {
      const languages = p.languages.filter((l) => l.source === "user").map((l) => l.value);
      return languages.length ? languages : undefined;
    },
  }),
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const onboardingStepIdSchema = z.enum(
  ONBOARDING_STEPS.map((s) => s.id) as [OnboardingStepId, ...OnboardingStepId[]],
);

export const DEGREE_OPTIONS = options(DEGREE_LABELS, degreeValues);
export const LANGUAGE_LEVEL_OPTIONS = options(LANGUAGE_LEVEL_LABELS, languageLevelValues);

/** Prefill values for every step from the user's own (source "user") entries. */
export function getStepPrefill(profile: CandidateProfile): Partial<Record<OnboardingStepId, unknown>> {
  return Object.fromEntries(
    ONBOARDING_STEPS.map((step) => [step.id, step.fromProfile(profile)]).filter(([, v]) => v !== undefined),
  );
}
