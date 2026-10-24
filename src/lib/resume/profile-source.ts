import "server-only";

import { getCandidateProfileRecord } from "@/lib/profile/server";
import type { ResumeProfile } from "@/lib/schemas/resume";
import { createClient, type CurrentUser } from "@/lib/supabase/server";

import { parseCandidateProfile, toResumeProfile, type CandidateProfileFormat } from "./candidate-profile";
import exampleProfile from "./fixtures/candidate-profile.example.json";

/**
 * Where the onboarding profile (JSON, see `candidate-profile.ts`) is loaded
 * from. Swap `activeSource`, nothing else depends on it.
 */
export interface ProfileSource {
  load(userId: string): Promise<CandidateProfileFormat | null>;
}

/** Development source: every user gets the example profile. */
export const exampleProfileSource: ProfileSource = {
  async load() {
    return parseCandidateProfile(exampleProfile);
  },
};

/**
 * The profile stored by the onboarding chat (`candidate_profiles`), read via
 * the shared profile module. It always reads the signed-in user's row (RLS),
 * which is the user `getResumeProfile` is called with.
 */
export const onboardingProfileSource: ProfileSource = {
  async load() {
    const record = await getCandidateProfileRecord();
    if (!record?.available) return null;
    return parseCandidateProfile(record.profile);
  },
};

const activeSource: ProfileSource = onboardingProfileSource;

/** The account name lives in `profiles.display_name`; the candidate profile has none. */
async function accountName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name?.trim() || null;
}

/** The signed-in user's profile in the resume feature's format, or null if there is none. */
export async function getResumeProfile(user: CurrentUser): Promise<ResumeProfile | null> {
  const [profile, name] = await Promise.all([activeSource.load(user.id), accountName(user.id)]);
  if (!profile) return null;
  return toResumeProfile(profile, { name, email: user.email });
}
