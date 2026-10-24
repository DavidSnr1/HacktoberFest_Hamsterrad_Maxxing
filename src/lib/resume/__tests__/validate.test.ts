import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveResume } from "../resolve";
import { validateResumeDraft } from "../validate";
import { lena, lenaDraft } from "./helpers";

describe("validateResumeDraft", () => {
  it("accepts a draft that only uses profile facts", () => {
    assert.deepEqual(validateResumeDraft(lenaDraft(), lena()), []);
  });

  it("rejects unknown sources", () => {
    const draft = lenaDraft();
    draft.sections[0].items[0].sourceRefs = ["exp-mckinsey"];
    const errors = validateResumeDraft(draft, lena());
    assert.equal(errors.length, 1);
    assert.match(errors[0], /unbekannte Quelle/);
  });

  it("rejects invented numbers in bullets", () => {
    const draft = lenaDraft();
    draft.sections[0].items[0].bullets = ["Umsatz des Kunden um 25 % gesteigert"];
    assert.match(validateResumeDraft(draft, lena()).join(), /25/);
  });

  it("accepts numbers from secondary sources and different number formats", () => {
    const draft = lenaDraft();
    draft.sections[0].items[0].sourceRefs = ["exp-strategy", "proj-case"];
    draft.sections[0].items[0].bullets = ["Platz 2 von 30 Teams in einer Case-Competition"];
    assert.deepEqual(validateResumeDraft(draft, lena()), []);
  });

  it("rejects invented numbers in the summary", () => {
    const draft = lenaDraft();
    draft.summary = "Mit 5 Jahren Berufserfahrung in der Beratung.";
    assert.match(validateResumeDraft(draft, lena()).join(), /Zusammenfassung/);
  });

  it("rejects wrong section types, duplicates and bullets in skills", () => {
    const draft = lenaDraft();
    draft.sections[1].items.push({ id: "i-x", sourceRefs: ["exp-cafe"], bullets: [] });
    draft.sections[0].items.push({ id: "i-dup", sourceRefs: ["exp-bank"], bullets: [] });
    draft.sections[2].items[0].bullets = ["Pivot-Tabellen"];
    draft.sections[2].items[1].id = "i-tum";
    const errors = validateResumeDraft(draft, lena()).join("\n");
    assert.match(errors, /passt nicht/);
    assert.match(errors, /mehrfach/);
    assert.match(errors, /keine Bulletpoints/);
    assert.match(errors, /Eintrags-ID ist doppelt/);
  });
});

describe("resolveResume", () => {
  it("takes facts from the profile, not from the draft", () => {
    const resume = resolveResume(lenaDraft(), lena(), { language: "de", targetRole: "X", gaps: ["a"] });
    const strategy = resume.sections[0].items[0];
    assert.equal(strategy.heading, "Praktikantin Strategieberatung");
    assert.equal(strategy.subheading, "Beispiel Strategy Partners GmbH · Praktikum");
    assert.deepEqual(strategy.period, { start: "2024-08", end: "2024-10" });
    const bachelor = resume.sections[1].items[1];
    assert.equal(bachelor.subheading, "Universität Mannheim · Note 1,7");
    assert.equal(resume.header.name, "Lena Becker");
    assert.deepEqual(resume.gaps, ["a"]);
  });

  it("uses English labels for English resumes", () => {
    const resume = resolveResume(lenaDraft(), lena(), { language: "en", targetRole: "X", gaps: [] });
    assert.match(resume.sections[1].items[1].subheading ?? "", /Grade 1,7/);
  });
});
