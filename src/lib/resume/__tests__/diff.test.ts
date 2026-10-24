import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Resume } from "@/lib/schemas/resume";

import { diffResumes, mergeResumes } from "../diff";
import { lenaResume } from "./helpers";

function revised(): Resume {
  const next = structuredClone(lenaResume());
  next.summary = "Neue Zusammenfassung";
  next.sections[0].items[0].bullets = ["Nur noch ein Punkt"];
  next.sections[0].items.splice(1, 1); // remove i-bank
  next.sections[2].title = "Tools";
  next.sections.push({ id: "s-lang", kind: "languages", title: "Sprachen", items: [] });
  next.sections.reverse();
  return next;
}

describe("diffResumes", () => {
  it("finds no changes between identical versions", () => {
    assert.deepEqual(diffResumes(lenaResume(), lenaResume()), []);
  });

  it("lists every change with a stable id", () => {
    const ids = diffResumes(lenaResume(), revised()).map((c) => c.id).sort();
    assert.deepEqual(ids, [
      "item-modified:i-strategy",
      "item-removed:i-bank",
      "order",
      "section-added:s-lang",
      "section-title:s-skills",
      "summary",
    ]);
  });

  it("detects moved items", () => {
    const next = structuredClone(lenaResume());
    const [moved] = next.sections[0].items.splice(1, 1);
    next.sections[2].items.push(moved);
    const changes = diffResumes(lenaResume(), next);
    assert.deepEqual(
      changes.map((c) => c.id),
      ["item-moved:i-bank"],
    );
  });
});

describe("mergeResumes", () => {
  it("accepting all changes yields the new version", () => {
    const before = lenaResume();
    const after = revised();
    const all = diffResumes(before, after).map((c) => c.id);
    assert.deepEqual(mergeResumes(before, after, all), after);
  });

  it("rejecting all changes yields the old version", () => {
    const before = lenaResume();
    assert.deepEqual(mergeResumes(before, revised(), []), before);
  });

  it("applies only the accepted changes", () => {
    const before = lenaResume();
    const merged = mergeResumes(before, revised(), ["summary", "item-removed:i-bank"]);
    assert.equal(merged.summary, "Neue Zusammenfassung");
    assert.deepEqual(
      merged.sections.map((s) => s.id),
      ["s-exp", "s-edu", "s-skills"],
    );
    assert.deepEqual(
      merged.sections[0].items.map((i) => i.id),
      ["i-strategy"],
    );
    assert.deepEqual(merged.sections[0].items[0].bullets, before.sections[0].items[0].bullets);
    assert.equal(merged.sections[2].title, "Kenntnisse");
  });

  it("keeps a rejected move in the old section", () => {
    const before = lenaResume();
    const next = structuredClone(before);
    const [moved] = next.sections[0].items.splice(1, 1);
    next.sections[2].items.push(moved);
    assert.deepEqual(mergeResumes(before, next, []), before);
    assert.deepEqual(mergeResumes(before, next, ["item-moved:i-bank"]), next);
  });
});
