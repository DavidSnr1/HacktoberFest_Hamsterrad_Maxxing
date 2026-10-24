"use server";

import { z } from "zod";
import { awardXp, XP_REWARDS } from "@/lib/gamification/xp";
import { ONBOARDING_STEPS, onboardingStepIdSchema } from "@/lib/onboarding/steps";
import { profileTargetSchema, type CandidateProfilePatch } from "@/lib/schemas/candidate-profile";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  confirmProfileValue,
  ProfileError,
  setDisplayName,
  setOnboardingStatus,
  updateCandidateProfile,
} from "./server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** profiles.display_name allows at most 80 characters; whitespace is collapsed. */
const displayNameSchema = z
  .string()
  .max(200)
  .transform((name) => name.trim().replace(/\s+/g, " "))
  .pipe(z.string().max(80));

function failure(error: unknown): ActionResult {
  if (error instanceof ProfileError && error.code === "not_signed_in") {
    return { ok: false, error: "Bitte melde dich erneut an." };
  }
  if (error instanceof ProfileError && error.code === "not_configured") {
    return { ok: false, error: "Das Profil ist noch nicht eingerichtet (SUPABASE_SERVICE_ROLE_KEY fehlt)." };
  }
  // Code only: profile contents must not be logged.
  console.error("profile action failed:", error instanceof ProfileError ? error.code : "unknown");
  return { ok: false, error: "Deine Angabe konnte nicht gespeichert werden. Bitte versuche es erneut." };
}

/** Validates one onboarding answer and stores it as a confirmed user value. */
export async function saveOnboardingAnswer(stepId: unknown, answer: unknown): Promise<ActionResult> {
  const id = onboardingStepIdSchema.safeParse(stepId);
  const step = id.success ? ONBOARDING_STEPS.find((s) => s.id === id.data) : undefined;
  if (!step) return { ok: false, error: "Ungültige Anfrage." };

  const parsed = step.schema.safeParse(answer);
  if (!parsed.success) return { ok: false, error: "Bitte prüfe deine Angabe." };

  try {
    // Each step's schema matches its toPatch; TypeScript cannot correlate them in a union.
    const toPatch = step.toPatch as (value: unknown) => CandidateProfilePatch;
    await updateCandidateProfile(toPatch(parsed.data), "user");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Finishes the onboarding chat and awards XP once. */
export async function completeOnboarding(): Promise<ActionResult> {
  try {
    await setOnboardingStatus("completed");
    const user = await getCurrentUser();
    if (user) await awardXp(user.id, "profile_completed", XP_REWARDS.profileCompleted, user.id);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** "Later": the chat is not shown again automatically; it can be restarted from the profile page. */
export async function skipOnboarding(): Promise<ActionResult> {
  try {
    await setOnboardingStatus("skipped");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Saves the name shown in resumes; an empty name removes it. */
export async function saveDisplayName(name: unknown): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Bitte gib einen Namen mit höchstens 80 Zeichen an." };
  try {
    await setDisplayName(parsed.data || null);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Accepts or rejects a suggested profile value (e.g. taken from the resume). */
export async function confirmSuggestion(target: unknown, accept: unknown): Promise<ActionResult> {
  const parsedTarget = profileTargetSchema.safeParse(target);
  if (!parsedTarget.success || typeof accept !== "boolean") return { ok: false, error: "Ungültige Anfrage." };
  try {
    await confirmProfileValue(parsedTarget.data, accept);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
