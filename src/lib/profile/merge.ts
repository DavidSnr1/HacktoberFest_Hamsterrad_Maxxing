import {
  PROFILE_SCHEMA_VERSION,
  type CandidateProfile,
  type CandidateProfilePatch,
  type ProfileSource,
  type ProfileTarget,
} from "@/lib/schemas/candidate-profile";

/**
 * Pure merge logic for the candidate profile (no I/O, unit-tested).
 *
 * Rules:
 * - Source "user" always wins and is stored as confirmed.
 * - Other sources never overwrite values that the user entered or confirmed;
 *   they are stored as unconfirmed suggestions instead.
 * - Lists: a "user" list replaces all user-entered items of that list (items
 *   from other sources stay); matching suggestions become confirmed.
 *   Other sources only add items that are not in the list yet.
 */

export function emptyProfile(): CandidateProfile {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    basics: { location: null },
    education: [],
    skills: [],
    languages: [],
    experience: [],
    projects: [],
    volunteering: [],
    goals: {
      tracks: null,
      employmentTypes: null,
      preferredLocations: null,
      remoteOk: null,
      earliestStart: null,
    },
  };
}

type Meta = { source: ProfileSource; sourceRef: string | null; confirmed: boolean; updatedAt: string };
type Sourced<T> = Meta & { value: T };
type Item<T> = Sourced<T> & { id: string };

type MergeContext = {
  source: ProfileSource;
  sourceRef: string | null;
  now: string;
  newId: () => string;
};

/** A value the user entered or confirmed is protected from automatic changes. */
function isProtected(meta: Meta | null) {
  return meta !== null && (meta.source === "user" || meta.confirmed);
}

function mergeScalar<T>(current: Sourced<T> | null, next: T | null | undefined, ctx: MergeContext): Sourced<T> | null {
  if (next === undefined) return current;
  if (ctx.source === "user") {
    return next === null ? null : { value: next, source: "user", sourceRef: null, confirmed: true, updatedAt: ctx.now };
  }
  // Automatic sources never clear or overwrite protected values.
  if (next === null || isProtected(current)) return current;
  return { value: next, source: ctx.source, sourceRef: ctx.sourceRef, confirmed: false, updatedAt: ctx.now };
}

function mergeList<T>(
  current: Item<T>[],
  next: T[] | undefined,
  key: (value: T) => string,
  ctx: MergeContext,
): Item<T>[] {
  if (next === undefined) return current;

  if (ctx.source === "user") {
    const wanted = new Map(next.map((value) => [key(value), value]));
    // Keep non-user items that the user did not just re-enter; drop old user items.
    const kept = current.filter((item) => item.source !== "user" && !wanted.has(key(item.value)));
    const fromUser = [...wanted.values()].map((value): Item<T> => {
      const existing = current.find((item) => key(item.value) === key(value));
      return {
        id: existing?.id ?? ctx.newId(),
        value,
        source: "user",
        sourceRef: null,
        confirmed: true,
        updatedAt: ctx.now,
      };
    });
    return [...fromUser, ...kept];
  }

  const known = new Set(current.map((item) => key(item.value)));
  const added: Item<T>[] = [];
  for (const value of next) {
    const k = key(value);
    if (known.has(k)) continue;
    known.add(k);
    added.push({ id: ctx.newId(), value, source: ctx.source, sourceRef: ctx.sourceRef, confirmed: false, updatedAt: ctx.now });
  }
  return [...current, ...added];
}

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export function mergeProfile(
  profile: CandidateProfile,
  patch: CandidateProfilePatch,
  options: { source: ProfileSource; sourceRef?: string | null; now?: Date; newId?: () => string },
): CandidateProfile {
  const ctx: MergeContext = {
    source: options.source,
    sourceRef: options.sourceRef ?? null,
    now: (options.now ?? new Date()).toISOString(),
    newId: options.newId ?? (() => crypto.randomUUID()),
  };
  const goals = patch.goals ?? {};

  return {
    ...profile,
    basics: {
      location: mergeScalar(profile.basics.location, patch.basics?.location, ctx),
    },
    education: mergeList(
      profile.education,
      patch.education,
      (e) => `${normalize(e.institution)}|${e.degree}|${normalize(e.field)}`,
      ctx,
    ),
    skills: mergeList(profile.skills, patch.skills, normalize, ctx),
    languages: mergeList(profile.languages, patch.languages, (l) => normalize(l.language), ctx),
    experience: mergeList(
      profile.experience,
      patch.experience,
      (e) => `${normalize(e.organization)}|${normalize(e.role)}|${e.start ?? ""}`,
      ctx,
    ),
    projects: mergeList(profile.projects, patch.projects, (p) => normalize(p.name), ctx),
    volunteering: mergeList(
      profile.volunteering,
      patch.volunteering,
      (v) => `${normalize(v.organization)}|${normalize(v.role)}|${v.start ?? ""}`,
      ctx,
    ),
    goals: {
      tracks: mergeScalar(profile.goals.tracks, goals.tracks, ctx),
      employmentTypes: mergeScalar(profile.goals.employmentTypes, goals.employmentTypes, ctx),
      preferredLocations: mergeScalar(profile.goals.preferredLocations, goals.preferredLocations, ctx),
      remoteOk: mergeScalar(profile.goals.remoteOk, goals.remoteOk, ctx),
      earliestStart: mergeScalar(profile.goals.earliestStart, goals.earliestStart, ctx),
    },
  };
}

/**
 * Confirms a suggestion (accept) or removes it (reject).
 * Returns the profile unchanged if the target does not exist.
 */
export function applyConfirmation(
  profile: CandidateProfile,
  target: ProfileTarget,
  accept: boolean,
  now: Date = new Date(),
): CandidateProfile {
  const updatedAt = now.toISOString();

  if ("list" in target) {
    const list = profile[target.list] as Item<unknown>[];
    const next = accept
      ? list.map((item) => (item.id === target.id ? { ...item, confirmed: true, updatedAt } : item))
      : list.filter((item) => item.id !== target.id);
    return { ...profile, [target.list]: next };
  }

  const section = profile[target.section] as Record<string, Sourced<unknown> | null>;
  const current = section[target.field];
  if (!current) return profile;
  const next = accept ? { ...current, confirmed: true, updatedAt } : null;
  return { ...profile, [target.section]: { ...section, [target.field]: next } };
}

/** Share of the onboarding fields the user has filled (0..1), e.g. for a badge. */
export function profileCompleteness(profile: CandidateProfile): number {
  const checks = [
    profile.basics.location !== null,
    profile.education.length > 0,
    profile.skills.length > 0,
    profile.languages.length > 0,
    // One check for the whole track record: not everyone has projects or volunteering.
    profile.experience.length + profile.projects.length + profile.volunteering.length > 0,
    profile.goals.tracks !== null,
    profile.goals.employmentTypes !== null,
    profile.goals.preferredLocations !== null,
    profile.goals.remoteOk !== null,
    profile.goals.earliestStart !== null,
  ];
  return checks.filter(Boolean).length / checks.length;
}
