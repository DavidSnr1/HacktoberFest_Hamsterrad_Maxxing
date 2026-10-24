import type {
  ResumeProfile,
  ProfileEducation,
  ProfileEntryKind,
  ProfileExperience,
  ProfileLanguage,
  ProfileOther,
  ProfileProject,
  ProfileSkill,
} from "@/lib/schemas/resume";

export type ProfileEntry =
  | { kind: "education"; entry: ProfileEducation }
  | { kind: "experience"; entry: ProfileExperience }
  | { kind: "projects"; entry: ProfileProject }
  | { kind: "skills"; entry: ProfileSkill }
  | { kind: "languages"; entry: ProfileLanguage }
  | { kind: "other"; entry: ProfileOther };

export type ProfileIndex = Map<string, ProfileEntry>;

/** Map of entry id → entry. Ids are unique across all kinds (see `ensureProfileIds`). */
export function indexProfile(profile: ResumeProfile): ProfileIndex {
  const index: ProfileIndex = new Map();
  for (const entry of profile.education) index.set(entry.id, { kind: "education", entry });
  for (const entry of profile.experience) index.set(entry.id, { kind: "experience", entry });
  for (const entry of profile.projects) index.set(entry.id, { kind: "projects", entry });
  for (const entry of profile.skills) index.set(entry.id, { kind: "skills", entry });
  for (const entry of profile.languages) index.set(entry.id, { kind: "languages", entry });
  for (const entry of profile.other) index.set(entry.id, { kind: "other", entry });
  return index;
}

const ID_PREFIX: Record<ProfileEntryKind, string> = {
  education: "edu",
  experience: "exp",
  projects: "proj",
  skills: "skill",
  languages: "lang",
  other: "other",
};

type WithOptionalId<T> = Omit<T, "id"> & { id?: string | null };

export type ResumeProfileWithoutIds = Omit<ResumeProfile, ProfileEntryKind> & {
  education: WithOptionalId<ProfileEducation>[];
  experience: WithOptionalId<ProfileExperience>[];
  projects: WithOptionalId<ProfileProject>[];
  skills: WithOptionalId<ProfileSkill>[];
  languages: WithOptionalId<ProfileLanguage>[];
  other: WithOptionalId<ProfileOther>[];
};

/**
 * Gives every entry a stable, profile-wide unique id. Existing ids are kept;
 * missing or duplicate ones are replaced by `<prefix>-<n>`.
 */
export function ensureProfileIds(profile: ResumeProfileWithoutIds): ResumeProfile {
  const used = new Set<string>();

  function assign<T extends { id?: string | null }>(kind: ProfileEntryKind, entries: T[]): (T & { id: string })[] {
    return entries.map((entry, i) => {
      let id = entry.id?.trim() || "";
      if (!id || used.has(id)) {
        let n = i + 1;
        id = `${ID_PREFIX[kind]}-${n}`;
        while (used.has(id)) id = `${ID_PREFIX[kind]}-${++n}`;
      }
      used.add(id);
      return { ...entry, id };
    });
  }

  return {
    personal: profile.personal,
    education: assign("education", profile.education),
    experience: assign("experience", profile.experience),
    projects: assign("projects", profile.projects),
    skills: assign("skills", profile.skills),
    languages: assign("languages", profile.languages),
    other: assign("other", profile.other),
  };
}

/** All text of an entry, used to verify that facts in bullets come from the source. */
export function entryText({ kind, entry }: ProfileEntry): string {
  switch (kind) {
    case "education":
      return [entry.institution, entry.degree, entry.field, entry.location, entry.grade, entry.start, entry.end, ...entry.details]
        .filter(Boolean)
        .join("\n");
    case "experience":
      return [entry.organization, entry.role, entry.employmentType, entry.location, entry.start, entry.end, ...entry.details]
        .filter(Boolean)
        .join("\n");
    case "projects":
      return [entry.name, entry.context, entry.start, entry.end, ...entry.details].filter(Boolean).join("\n");
    case "skills":
      return [entry.name, entry.category, entry.level].filter(Boolean).join("\n");
    case "languages":
      return [entry.name, entry.level].filter(Boolean).join("\n");
    case "other":
      return [entry.title, entry.organization, entry.start, entry.end, ...entry.details].filter(Boolean).join("\n");
  }
}

export function profileText(profile: ResumeProfile): string {
  const personal = profile.personal;
  const parts = [personal.name, personal.location];
  for (const entry of indexProfile(profile).values()) parts.push(entryText(entry));
  return parts.filter(Boolean).join("\n");
}

export function isProfileEmpty(profile: ResumeProfile): boolean {
  return (
    profile.education.length === 0 &&
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    profile.skills.length === 0 &&
    profile.other.length === 0
  );
}

export type ProfileAliases = {
  /** Copy of the profile with short ids ("p1", "p2", …). */
  profile: ResumeProfile;
  toAlias: (id: string) => string;
  fromAlias: (alias: string) => string;
};

/**
 * Long ids (UUIDs from onboarding) are error-prone for the model to copy.
 * It only ever sees short aliases; unknown values pass through unchanged
 * so validation can still flag them.
 */
export function aliasProfile(profile: ResumeProfile): ProfileAliases {
  const toAliasMap = new Map<string, string>();
  const fromAliasMap = new Map<string, string>();
  let n = 0;
  const alias = <T extends { id: string }>(entry: T): T => {
    const short = `p${++n}`;
    toAliasMap.set(entry.id, short);
    fromAliasMap.set(short, entry.id);
    return { ...entry, id: short };
  };

  return {
    profile: {
      personal: profile.personal,
      education: profile.education.map(alias),
      experience: profile.experience.map(alias),
      projects: profile.projects.map(alias),
      skills: profile.skills.map(alias),
      languages: profile.languages.map(alias),
      other: profile.other.map(alias),
    },
    toAlias: (id) => toAliasMap.get(id) ?? id,
    fromAlias: (short) => fromAliasMap.get(short) ?? short,
  };
}

/** Rewrites all `sourceRefs` of a draft or resume. */
export function mapSourceRefs<T extends { sections: { items: { sourceRefs: string[] }[] }[] }>(
  resume: T,
  map: (id: string) => string,
): T {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, sourceRefs: item.sourceRefs.map(map) })),
    })),
  };
}
