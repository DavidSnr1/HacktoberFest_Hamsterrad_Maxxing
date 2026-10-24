import type { LlmResumeDraft, ProfileEntryKind, ResumeDraft, ResumeProfile, ResumeSectionKind } from "@/lib/schemas/resume";

import { entryText, indexProfile, profileText } from "./profile";

/** Which profile entry kinds may be the primary source (first `sourceRef`) of an item in a section. */
const ALLOWED_PRIMARY: Record<ResumeSectionKind, readonly ProfileEntryKind[]> = {
  experience: ["experience", "projects", "other"],
  education: ["education"],
  projects: ["projects", "experience", "other"],
  skills: ["skills"],
  languages: ["languages"],
  other: ["other", "projects", "experience"],
};

const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;

/** Normalised numbers in a text ("1.000" and "1,000" → "1000", "1,7" → "1.7"). */
function extractNumbers(text: string): Set<string> {
  const result = new Set<string>();
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const raw = match[0];
    result.add(raw.replace(/[.,]/g, ""));
    result.add(raw.replace(",", "."));
  }
  return result;
}

function numbersMissingIn(text: string, source: Set<string>): string[] {
  const missing: string[] = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const raw = match[0];
    if (!source.has(raw.replace(/[.,]/g, "")) && !source.has(raw.replace(",", "."))) missing.push(raw);
  }
  return missing;
}

/**
 * Checks an LLM resume draft against the profile. Returns a list of problems
 * (German, fed back to the model on retry); empty means valid.
 *
 * Guards against invented content: unknown sources, wrong section types,
 * duplicated stations and numbers that don't appear in the referenced sources.
 */
export function validateResumeDraft(draft: ResumeDraft, profile: ResumeProfile): string[] {
  const errors: string[] = [];
  const index = indexProfile(profile);
  const sectionIds = new Set<string>();
  const itemIds = new Set<string>();
  const usedPrimary = new Set<string>();

  const summaryMissing = numbersMissingIn(draft.summary, extractNumbers(profileText(profile)));
  if (summaryMissing.length > 0) {
    errors.push(`Zusammenfassung enthält Zahlen, die nicht im Profil stehen: ${summaryMissing.join(", ")}.`);
  }

  for (const section of draft.sections) {
    if (sectionIds.has(section.id)) errors.push(`Abschnitts-ID "${section.id}" ist doppelt.`);
    sectionIds.add(section.id);

    for (const item of section.items) {
      const where = `Abschnitt "${section.title}", Eintrag "${item.id}"`;
      if (itemIds.has(item.id)) errors.push(`${where}: Eintrags-ID ist doppelt.`);
      itemIds.add(item.id);

      const unknown = item.sourceRefs.filter((ref) => !index.has(ref));
      if (unknown.length > 0) {
        errors.push(`${where}: unbekannte Quelle(n) ${unknown.join(", ")}. Nutze nur IDs aus dem Profil.`);
        continue;
      }

      const primaryId = item.sourceRefs[0];
      const primary = index.get(primaryId);
      if (!primary) continue;
      if (!ALLOWED_PRIMARY[section.kind].includes(primary.kind)) {
        errors.push(`${where}: Quelle "${primaryId}" (${primary.kind}) passt nicht in einen Abschnitt vom Typ ${section.kind}.`);
      }
      if (usedPrimary.has(primaryId)) errors.push(`${where}: Quelle "${primaryId}" wird mehrfach als Station verwendet.`);
      usedPrimary.add(primaryId);

      if ((section.kind === "skills" || section.kind === "languages") && item.bullets.length > 0) {
        errors.push(`${where}: In Abschnitten vom Typ ${section.kind} sind keine Bulletpoints erlaubt.`);
      }

      const sourceNumbers = new Set<string>();
      for (const ref of item.sourceRefs) {
        const entry = index.get(ref);
        if (entry) for (const n of extractNumbers(entryText(entry))) sourceNumbers.add(n);
      }
      for (const bullet of item.bullets) {
        const missing = numbersMissingIn(bullet, sourceNumbers);
        if (missing.length > 0) {
          errors.push(`${where}: Bulletpoint enthält Zahlen, die nicht in den Quellen stehen (${missing.join(", ")}): "${bullet}"`);
        }
      }
    }
  }

  return errors;
}

/**
 * Fixes slips the model makes without reasoning (thinking "minimal") by only
 * REMOVING content, so nothing can be invented: items with unknown or
 * misplaced sources, repeated stations, bullets in skills/languages and
 * bullets with numbers that are not in their sources. Duplicate item ids get
 * a suffix. Asking the model again would cost another call; the summary is
 * not repaired and still goes through `validateResumeDraft`.
 */
export function repairDraft(draft: ResumeDraft, profile: ResumeProfile): ResumeDraft {
  const index = indexProfile(profile);
  const usedPrimary = new Set<string>();
  const itemIds = new Set<string>();

  const sections = draft.sections.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      const sourceRefs = item.sourceRefs.filter((ref) => index.has(ref));
      const primary = index.get(item.sourceRefs[0]);
      if (!primary || !ALLOWED_PRIMARY[section.kind].includes(primary.kind)) return [];
      if (usedPrimary.has(item.sourceRefs[0])) return [];
      usedPrimary.add(item.sourceRefs[0]);

      let id = item.id;
      for (let n = 2; itemIds.has(id); n++) id = `${item.id}-${n}`;
      itemIds.add(id);

      if (section.kind === "skills" || section.kind === "languages") return [{ ...item, id, sourceRefs, bullets: [] }];
      const sourceNumbers = new Set<string>();
      for (const ref of sourceRefs) {
        const entry = index.get(ref);
        if (entry) for (const n of extractNumbers(entryText(entry))) sourceNumbers.add(n);
      }
      const bullets = item.bullets.filter((bullet) => numbersMissingIn(bullet, sourceNumbers).length === 0);
      return [{ ...item, id, sourceRefs, bullets }];
    }),
  }));

  // Education, skills and languages are plain facts every resume shows; add
  // the ones the model left out (no bullets, so nothing is formulated).
  for (const section of sections) {
    if (section.kind !== "education" && section.kind !== "skills" && section.kind !== "languages") continue;
    for (const entry of profile[section.kind]) {
      if (usedPrimary.has(entry.id)) continue;
      usedPrimary.add(entry.id);
      let id = `i-${entry.id}`;
      for (let n = 2; itemIds.has(id); n++) id = `i-${entry.id}-${n}`;
      itemIds.add(id);
      section.items.push({ id, sourceRefs: [entry.id], bullets: [] });
    }
  }
  return { ...draft, sections };
}

/** Adapter for the `check` option of `generateJson`; `build` turns the model output into the internal draft. */
export function draftCheck(profile: ResumeProfile, build: (draft: LlmResumeDraft) => ResumeDraft) {
  return (value: { resume: LlmResumeDraft }): string | null => {
    const errors = validateResumeDraft(build(value.resume), profile);
    return errors.length > 0 ? errors.join("\n") : null;
  };
}
