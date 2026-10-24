import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RESUME_TRACKS, type LlmResumeDraft } from "@/lib/schemas/resume";

import { resolveResume } from "../resolve";
import { applyTrackTemplate, suggestTrack, toLlmDraft, TRACK_TEMPLATES, withName, withRole } from "../tracks";
import { validateResumeDraft } from "../validate";
import { lena, lenaResume } from "./helpers";

function llmDraft(): LlmResumeDraft {
  return {
    summary: "Zusammenfassung",
    sections: [
      { kind: "skills", items: [{ id: "i-excel", sourceRefs: ["skill-excel"], bullets: [] }] },
      { kind: "education", items: [{ id: "i-tum", sourceRefs: ["edu-tum"], bullets: [] }] },
      { kind: "experience", items: [{ id: "i-bank", sourceRefs: ["exp-bank"], bullets: ["Reporting automatisiert"] }] },
      { kind: "skills", items: [{ id: "i-ppt", sourceRefs: ["skill-ppt"], bullets: [] }] },
    ],
  };
}

describe("track templates", () => {
  it("cover every section kind exactly once", () => {
    for (const track of RESUME_TRACKS) {
      const kinds = TRACK_TEMPLATES[track].sections.map((s) => s.kind).sort();
      assert.deepEqual(kinds, ["education", "experience", "languages", "other", "projects", "skills"], track);
    }
  });
});

describe("applyTrackTemplate", () => {
  it("imposes the track's section order and titles, whatever order the model used", () => {
    const finance = applyTrackTemplate(llmDraft(), "finance", "de");
    assert.deepEqual(
      finance.sections.map((s) => s.kind),
      ["education", "experience", "projects", "skills", "languages", "other"],
    );
    assert.equal(finance.sections.find((s) => s.kind === "skills")?.title, "Fachkenntnisse");

    const startup = applyTrackTemplate(llmDraft(), "startup", "en");
    assert.deepEqual(
      startup.sections.map((s) => s.kind),
      ["experience", "projects", "skills", "education", "languages", "other"],
    );
    assert.equal(startup.sections[0].title, "Experience");
  });

  it("merges items of repeated kinds and uses stable section ids", () => {
    const draft = applyTrackTemplate(llmDraft(), "consulting", "de");
    const skills = draft.sections.find((s) => s.kind === "skills");
    assert.equal(skills?.id, "s-skills");
    assert.deepEqual(
      skills?.items.map((i) => i.id),
      ["i-excel", "i-ppt"],
    );
    assert.deepEqual(draft.sections.find((s) => s.kind === "projects")?.items, []);
  });

  it("produces drafts that pass validation and survive a round trip", () => {
    const draft = applyTrackTemplate(llmDraft(), "consulting", "de");
    assert.deepEqual(validateResumeDraft(draft, lena()), []);
    const resume = resolveResume(draft, lena(), { language: "de", targetRole: "Werkstudent Strategy", gaps: [] });
    assert.deepEqual(applyTrackTemplate(toLlmDraft(resume), "consulting", "de").sections.map((s) => s.items.length), draft.sections.map((s) => s.items.length));
  });
});

describe("role", () => {
  it("is the headline of the resume", () => {
    const resume = resolveResume(applyTrackTemplate(llmDraft(), "finance", "de"), lena(), {
      language: "de",
      targetRole: "Werkstudent M&A",
      gaps: [],
    });
    assert.equal(resume.header.headline, "Werkstudent M&A");
  });

  it("withRole only changes role and headline", () => {
    const before = lenaResume();
    const after = withRole(before, "Praktikum Private Equity");
    assert.equal(after.targetRole, "Praktikum Private Equity");
    assert.equal(after.header.headline, "Praktikum Private Equity");
    assert.deepEqual({ ...after, targetRole: before.targetRole, header: before.header }, before);
  });
});

describe("name", () => {
  it("withName only changes the name in the header", () => {
    const before = lenaResume();
    const after = withName(before, "Lena M. Becker");
    assert.equal(after.header.name, "Lena M. Becker");
    assert.deepEqual({ ...after, header: { ...after.header, name: before.header.name } }, before);
    assert.equal(withName(before, null).header.name, null);
  });
});

describe("suggestTrack", () => {
  const cases: Array<[string, string | null]> = [
    ["Werkstudent M&A", "finance"],
    ["Praktikum Investment Banking in Frankfurt", "finance"],
    ["Intern Private Equity", "finance"],
    ["Werkstudent Strategy Consulting", "consulting"],
    ["Praktikum Unternehmensberatung", "consulting"],
    ["Founder's Associate", "startup"],
    ["Growth Intern bei einem Seed-Startup", "startup"],
    ["Business Development Werkstudent", "startup"],
    ["Business Analyst", null],
    ["Financial Advisory", null],
    ["", null],
  ];
  for (const [role, expected] of cases) {
    it(`${role || "(leer)"} → ${expected}`, () => assert.equal(suggestTrack(role), expected));
  }
});
