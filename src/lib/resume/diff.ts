import type { Resume, ResumeItem, ResumeSection } from "@/lib/schemas/resume";

export type ResumeChange =
  | { id: "summary"; type: "summary"; before: string; after: string }
  | { id: string; type: "section-title"; before: string; after: string }
  | { id: string; type: "section-added"; section: ResumeSection }
  | { id: string; type: "section-removed"; section: ResumeSection }
  | { id: string; type: "item-added"; sectionTitle: string; item: ResumeItem }
  | { id: string; type: "item-removed"; sectionTitle: string; item: ResumeItem }
  | { id: string; type: "item-modified"; sectionTitle: string; before: ResumeItem; after: ResumeItem }
  | { id: string; type: "item-moved"; fromTitle: string; toTitle: string; before: ResumeItem; after: ResumeItem }
  | { id: "order"; type: "order" };

type ItemLocation = { section: ResumeSection; item: ResumeItem };

function itemLocations(resume: Resume): Map<string, ItemLocation> {
  const map = new Map<string, ItemLocation>();
  for (const section of resume.sections) for (const item of section.items) map.set(item.id, { section, item });
  return map;
}

function sameItem(a: ResumeItem, b: ResumeItem): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function commonOrder(a: string[], b: string[]): [string[], string[]] {
  const inB = new Set(b);
  const inA = new Set(a);
  return [a.filter((id) => inB.has(id)), b.filter((id) => inA.has(id))];
}

function sameSequence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function orderChanged(before: Resume, after: Resume): boolean {
  const [sa, sb] = commonOrder(
    before.sections.map((s) => s.id),
    after.sections.map((s) => s.id),
  );
  if (!sameSequence(sa, sb)) return true;
  const afterSections = new Map(after.sections.map((s) => [s.id, s]));
  return before.sections.some((section) => {
    const other = afterSections.get(section.id);
    if (!other) return false;
    const [ia, ib] = commonOrder(
      section.items.map((i) => i.id),
      other.items.map((i) => i.id),
    );
    return !sameSequence(ia, ib);
  });
}

/** All changes from `before` to `after`, each with a stable id that can be accepted or rejected. */
export function diffResumes(before: Resume, after: Resume): ResumeChange[] {
  const changes: ResumeChange[] = [];
  if (before.summary !== after.summary) {
    changes.push({ id: "summary", type: "summary", before: before.summary, after: after.summary });
  }

  const beforeSections = new Map(before.sections.map((s) => [s.id, s]));
  const afterSections = new Map(after.sections.map((s) => [s.id, s]));

  for (const section of after.sections) {
    const old = beforeSections.get(section.id);
    if (!old) changes.push({ id: `section-added:${section.id}`, type: "section-added", section });
    else if (old.title !== section.title) {
      changes.push({ id: `section-title:${section.id}`, type: "section-title", before: old.title, after: section.title });
    }
  }
  for (const section of before.sections) {
    if (!afterSections.has(section.id)) changes.push({ id: `section-removed:${section.id}`, type: "section-removed", section });
  }

  // Items inside added/removed sections are covered by the section change.
  const beforeItems = itemLocations(before);
  const afterItems = itemLocations(after);

  for (const [id, now] of afterItems) {
    const was = beforeItems.get(id);
    if (!was) {
      if (beforeSections.has(now.section.id)) {
        changes.push({ id: `item-added:${id}`, type: "item-added", sectionTitle: now.section.title, item: now.item });
      }
    } else if (was.section.id !== now.section.id) {
      changes.push({
        id: `item-moved:${id}`,
        type: "item-moved",
        fromTitle: was.section.title,
        toTitle: now.section.title,
        before: was.item,
        after: now.item,
      });
    } else if (!sameItem(was.item, now.item)) {
      changes.push({ id: `item-modified:${id}`, type: "item-modified", sectionTitle: now.section.title, before: was.item, after: now.item });
    }
  }
  for (const [id, was] of beforeItems) {
    if (!afterItems.has(id) && afterSections.has(was.section.id)) {
      changes.push({ id: `item-removed:${id}`, type: "item-removed", sectionTitle: was.section.title, item: was.item });
    }
  }

  if (orderChanged(before, after)) changes.push({ id: "order", type: "order" });
  return changes;
}

/** `primary` order, with ids only present in `secondary` inserted after their predecessor there. */
function mergeOrder(primary: string[], secondary: string[]): string[] {
  const result = [...primary];
  secondary.forEach((id, i) => {
    if (result.includes(id)) return;
    const predecessor = secondary.slice(0, i).reverse().find((p) => result.includes(p));
    result.splice(predecessor === undefined ? 0 : result.indexOf(predecessor) + 1, 0, id);
  });
  return result;
}

/**
 * Applies only the accepted changes of `diffResumes(before, after)` to `before`.
 * Header, language and target role come from `after` (they never differ between versions).
 */
export function mergeResumes(before: Resume, after: Resume, acceptedChangeIds: Iterable<string>): Resume {
  const accepted = new Set(acceptedChangeIds);
  const takeNew = (changeId: string) => accepted.has(changeId);

  const beforeSections = new Map(before.sections.map((s) => [s.id, s]));
  const afterSections = new Map(after.sections.map((s) => [s.id, s]));
  const beforeItems = itemLocations(before);
  const afterItems = itemLocations(after);
  const useNewOrder = takeNew("order");

  const sectionIncluded = (id: string): boolean => {
    const inBefore = beforeSections.has(id);
    const inAfter = afterSections.has(id);
    if (inBefore && inAfter) return true;
    return inAfter ? takeNew(`section-added:${id}`) : !takeNew(`section-removed:${id}`);
  };

  // Final placement of every item: [sectionId, item] or null (dropped).
  const placement = new Map<string, { sectionId: string; item: ResumeItem } | null>();
  for (const id of new Set([...beforeItems.keys(), ...afterItems.keys()])) {
    const was = beforeItems.get(id);
    const now = afterItems.get(id);
    let chosen: ItemLocation | undefined;
    if (was && now) {
      const moved = was.section.id !== now.section.id;
      const unchanged = !moved && sameItem(was.item, now.item);
      chosen = unchanged || takeNew(moved ? `item-moved:${id}` : `item-modified:${id}`) ? now : was;
      if (!sectionIncluded(chosen.section.id)) chosen = chosen === now ? was : now;
    } else if (now) {
      chosen = !beforeSections.has(now.section.id) || takeNew(`item-added:${id}`) ? now : undefined;
    } else if (was) {
      chosen = afterSections.has(was.section.id) && !takeNew(`item-removed:${id}`) ? was : undefined;
    }
    placement.set(id, chosen && sectionIncluded(chosen.section.id) ? { sectionId: chosen.section.id, item: chosen.item } : null);
  }

  const beforeOrder = before.sections.map((s) => s.id);
  const afterOrder = after.sections.map((s) => s.id);
  const sectionOrder = useNewOrder ? mergeOrder(afterOrder, beforeOrder) : mergeOrder(beforeOrder, afterOrder);

  const sections: ResumeSection[] = sectionOrder.filter(sectionIncluded).map((id) => {
    const old = beforeSections.get(id);
    const next = afterSections.get(id);
    const base = (old && next ? (takeNew(`section-title:${id}`) ? next : old) : (next ?? old)) as ResumeSection;
    const oldIds = old?.items.map((i) => i.id) ?? [];
    const newIds = next?.items.map((i) => i.id) ?? [];
    const candidates = useNewOrder ? mergeOrder(newIds, oldIds) : mergeOrder(oldIds, newIds);
    // Items moved into this section from elsewhere are appended if not yet ordered.
    for (const [itemId, place] of placement) {
      if (place?.sectionId === id && !candidates.includes(itemId)) candidates.push(itemId);
    }
    const items = candidates.flatMap((itemId) => {
      const place = placement.get(itemId);
      return place && place.sectionId === id ? [place.item] : [];
    });
    return { id, kind: base.kind, title: base.title, items };
  });

  return {
    ...after,
    summary: takeNew("summary") ? after.summary : before.summary,
    sections,
    gaps: before.gaps,
  };
}
