import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResumeGeneratePrompt } from "@/lib/prompts/resume-generate";
import { buildResumeRevisePrompt } from "@/lib/prompts/resume-revise";

import { profileForPrompt } from "../generate";
import { toLlmDraft } from "../tracks";
import { lena, lenaResume } from "./helpers";

const CONTACT = ["Lena Becker", "lena.becker@example.com", "+49 151", "linkedin.com/in/example-lena-becker"];

describe("prompts", () => {
  it("never contain contact data or the entered role", () => {
    const profile = profileForPrompt(lena());
    const resume = lenaResume();
    const prompts = [
      buildResumeGeneratePrompt({ profile, track: "consulting", language: "de" }),
      buildResumeRevisePrompt({ profile, current: toLlmDraft(resume), instruction: "Kürzer", track: "consulting", language: "de" }),
    ];
    for (const prompt of prompts) {
      for (const value of [...CONTACT, resume.targetRole]) assert.ok(!prompt.includes(value), value);
    }
  });

  it("keep all profile entries and ids", () => {
    const prompt = buildResumeGeneratePrompt({ profile: profileForPrompt(lena()), track: "finance", language: "en" });
    for (const id of ["exp-strategy", "edu-tum", "skill-excel", "lang-es", "other-finance-club"]) assert.ok(prompt.includes(id));
    assert.match(prompt, /Englisch/);
  });

  it("name the track, its focus and the fixed sections", () => {
    const prompt = buildResumeGeneratePrompt({ profile: profileForPrompt(lena()), track: "startup", language: "de" });
    assert.match(prompt, /Bereich: Startup/);
    assert.match(prompt, /Eigeninitiative/);
    assert.match(prompt, /experience \(„Praxiserfahrung“\), projects \(„Projekte“\), skills \(„Skills & Tools“\)/);
  });
});
