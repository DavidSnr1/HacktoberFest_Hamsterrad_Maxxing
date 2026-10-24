import "server-only";

import { getCandidateProfileRecord } from "@/lib/profile/server";
import exampleProfile from "./fixtures/candidate-profile.example.json";
import { toJobPreferences, type JobPreferences } from "./profile";

/**
 * Where the onboarding profile (final format, schemaVersion 1) comes from. Same pattern as
 * `src/lib/resume/profile-source.ts` in feature A – swap `activeSource`, nothing else depends on it.
 */
export interface ProfileSource {
  load(userId: string): Promise<unknown | null>;
}

/** Development source: every user gets the example profile. */
export const exampleProfileSource: ProfileSource = {
  async load() {
    return exampleProfile;
  },
};

/**
 * The profile stored by the onboarding chat (`candidate_profiles`), read via the shared
 * profile module. It always reads the signed-in user's row (RLS).
 */
export const onboardingProfileSource: ProfileSource = {
  async load() {
    const record = await getCandidateProfileRecord();
    return record?.available ? record.profile : null;
  },
};

const activeSource: ProfileSource = onboardingProfileSource;

/** Job search preferences of the signed-in user, or null without a (usable) profile. */
export async function getJobPreferences(userId: string): Promise<JobPreferences | null> {
  try {
    return toJobPreferences(await activeSource.load(userId));
  } catch {
    // A broken profile must not break job search; it just runs without defaults.
    return null;
  }
}
