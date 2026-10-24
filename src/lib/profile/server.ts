import "server-only";
import { cache } from "react";
import {
  candidateProfileSchema,
  type CandidateProfile,
  type CandidateProfilePatch,
  type ProfileSource,
  type ProfileTarget,
} from "@/lib/schemas/candidate-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { applyConfirmation, emptyProfile, mergeProfile } from "./merge";

/**
 * Shared access to the candidate profile. Every feature reads and writes the
 * profile only through these functions (never directly via .from(...)).
 * Profile contents must never be logged.
 */

export type ProfileRecord = {
  profile: CandidateProfile;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
  /** False if the profile could not be read (e.g. migration missing); callers must not block on it. */
  available: boolean;
};

const MAX_WRITE_ATTEMPTS = 4;

export class ProfileError extends Error {
  constructor(
    readonly code: "not_signed_in" | "not_configured" | "conflict" | "storage",
    message: string,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

/** Parses stored data; a broken row must not break the app, so fall back to empty. */
function parseStored(data: unknown): CandidateProfile {
  const parsed = candidateProfileSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  console.warn("profile: stored data is invalid, using an empty profile");
  return emptyProfile();
}

/**
 * Reads the current user's profile row (RLS). Null if not signed in.
 * Deduplicated per request.
 */
export const getCandidateProfileRecord = cache(async (): Promise<ProfileRecord | null> => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("data, onboarding_completed_at, onboarding_skipped_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) console.error("profile: read failed", error.code);
  if (!data) {
    return { profile: emptyProfile(), onboardingCompletedAt: null, onboardingSkippedAt: null, available: !error };
  }
  return {
    profile: parseStored(data.data),
    onboardingCompletedAt: data.onboarding_completed_at,
    onboardingSkippedAt: data.onboarding_skipped_at,
    available: true,
  };
});

/** The current user's profile; an empty profile if none exists yet or not signed in. */
export async function getCandidateProfile(): Promise<CandidateProfile> {
  return (await getCandidateProfileRecord())?.profile ?? emptyProfile();
}

/**
 * Read-modify-write with optimistic locking: the update only succeeds if the
 * row's version is unchanged since it was read; otherwise it retries.
 * `userId` must come from a verified session (getCurrentUser), never from input.
 */
async function writeProfile(
  userId: string,
  change: (profile: CandidateProfile) => CandidateProfile,
  extra: { onboarding_completed_at?: string; onboarding_skipped_at?: string } = {},
): Promise<CandidateProfile> {
  const admin = createAdminClient();
  if (!admin) throw new ProfileError("not_configured", "SUPABASE_SERVICE_ROLE_KEY is not set");

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const { data: row, error: readError } = await admin
      .from("candidate_profiles")
      .select("data, version")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new ProfileError("storage", `profile read failed (${readError.code})`);

    const next = candidateProfileSchema.parse(change(row ? parseStored(row.data) : emptyProfile()));
    const now = new Date().toISOString();

    if (!row) {
      const { error } = await admin
        .from("candidate_profiles")
        .insert({ user_id: userId, data: next, updated_at: now, ...extra });
      if (!error) return next;
      if (error.code !== "23505") throw new ProfileError("storage", `profile insert failed (${error.code})`);
      continue; // Created concurrently: retry as an update.
    }

    const { data: updated, error } = await admin
      .from("candidate_profiles")
      .update({ data: next, version: row.version + 1, updated_at: now, ...extra })
      .eq("user_id", userId)
      .eq("version", row.version)
      .select("user_id");
    if (error) throw new ProfileError("storage", `profile update failed (${error.code})`);
    if (updated.length === 1) return next;
    // Someone else wrote in between: read again and re-apply the change.
  }
  throw new ProfileError("conflict", "profile write conflicted too often");
}

async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) throw new ProfileError("not_signed_in", "not signed in");
  return user.id;
}

/**
 * Merges a partial update from one source into the current user's profile.
 * Values the user entered or confirmed are never overwritten by other
 * sources; those values are added as unconfirmed suggestions instead.
 */
export async function updateCandidateProfile(
  patch: CandidateProfilePatch,
  source: ProfileSource,
  sourceRef?: string,
): Promise<CandidateProfile> {
  return updateCandidateProfileForUser(await requireUserId(), patch, source, sourceRef);
}

/**
 * Same as updateCandidateProfile for server code without a session (e.g.
 * background work via after()). Only pass a user id that was verified before.
 */
export async function updateCandidateProfileForUser(
  userId: string,
  patch: CandidateProfilePatch,
  source: ProfileSource,
  sourceRef?: string,
): Promise<CandidateProfile> {
  return writeProfile(userId, (profile) => mergeProfile(profile, patch, { source, sourceRef: sourceRef ?? null }));
}

/** The user accepts (confirm) or rejects (remove) a suggested value. */
export async function confirmProfileValue(target: ProfileTarget, accept: boolean): Promise<CandidateProfile> {
  const userId = await requireUserId();
  return writeProfile(userId, (profile) => applyConfirmation(profile, target, accept));
}

/** Marks the onboarding chat as finished or skipped for the current user. */
export async function setOnboardingStatus(status: "completed" | "skipped"): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  await writeProfile(
    userId,
    (profile) => profile,
    status === "completed" ? { onboarding_completed_at: now } : { onboarding_skipped_at: now },
  );
}

/**
 * The signed-in user's name (profiles.display_name), shown in resumes and
 * exports. Null if not set or not signed in. Deduplicated per request.
 */
export const getDisplayName = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const { data, error } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  if (error) console.error("profile: display name read failed", error.code);
  return data?.display_name?.trim() || null;
});

/** Sets or (with null) removes the current user's name. Runs as the user (RLS). */
export async function setDisplayName(name: string | null): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();
  if (!supabase) throw new ProfileError("storage", "Supabase is not configured");

  const { data, error } = await supabase.from("profiles").update({ display_name: name }).eq("id", userId).select("id");
  if (error) throw new ProfileError("storage", `display name update failed (${error.code})`);
  if (data.length !== 1) throw new ProfileError("storage", "profiles row is missing");
}

/** True if the user should be sent to the onboarding chat (never if the profile is unavailable). */
export async function needsOnboarding(): Promise<boolean> {
  const record = await getCandidateProfileRecord();
  return Boolean(record?.available && !record.onboardingCompletedAt && !record.onboardingSkippedAt);
}
