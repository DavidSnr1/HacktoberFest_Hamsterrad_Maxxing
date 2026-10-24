import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCandidateProfile, ProfileFormatError, toResumeProfile } from "../candidate-profile";
import example from "../fixtures/candidate-profile.example.json";
import { aliasProfile, indexProfile, isProfileEmpty, mapSourceRefs } from "../profile";
import { resolveResume } from "../resolve";
import { lenaDraft } from "./helpers";

const ACCOUNT = { name: "Mara Schulz", email: "mara@example.com" };
const NOW = new Date("2026-10-24T12:00:00Z");

function exampleProfile() {
  return toResumeProfile(parseCandidateProfile(example), ACCOUNT, NOW);
}

describe("parseCandidateProfile", () => {
  it("accepts the onboarding example", () => {
    assert.equal(parseCandidateProfile(JSON.stringify(example)).schemaVersion, 1);
  });

  it("rejects invalid input", () => {
    assert.throws(() => parseCandidateProfile("{nope"), ProfileFormatError);
    assert.throws(() => parseCandidateProfile({ schemaVersion: 2 }), ProfileFormatError);
    const wrongLevel = structuredClone(example);
    wrongLevel.languages[0].value.level = "fließend";
    assert.throws(() => parseCandidateProfile(wrongLevel), ProfileFormatError);
  });

  it("tolerates missing optional parts", () => {
    const parsed = parseCandidateProfile({ schemaVersion: 1 });
    assert.deepEqual(parsed.education, []);
    assert.equal(isProfileEmpty(toResumeProfile(parsed, ACCOUNT, NOW)), true);
  });
});

describe("toResumeProfile", () => {
  it("takes name and e-mail from the account, location from the profile", () => {
    const { personal } = exampleProfile();
    assert.equal(personal.name, "Mara Schulz");
    assert.equal(personal.email, "mara@example.com");
    assert.equal(personal.location, "Mannheim");
    assert.equal(personal.phone, null);
  });

  it("keeps the profile ids", () => {
    const profile = exampleProfile();
    assert.equal(profile.education[0].id, "0b9a3c7e-5d1f-4c2a-9e8b-1f2d3c4b5a60");
    assert.equal(profile.skills[0].id, "a1c4e7f0-2b5d-4e8a-9c1f-3e6b9d2a5c80");
  });

  it("only uses confirmed values", () => {
    const profile = exampleProfile();
    assert.deepEqual(
      profile.skills.map((s) => s.name),
      ["Excel-Modellierung (DCF, Szenarioanalysen)", "PowerPoint (Storylining, Slide-Design)"],
    );
    assert.deepEqual(
      profile.languages.map((l) => l.name),
      ["Deutsch", "Englisch"],
    );
  });

  it("marks future graduations as expected and keeps past ones", () => {
    const [master, bachelor] = exampleProfile().education;
    assert.equal(master.end, "2027-09");
    assert.equal(master.endExpected, true);
    assert.deepEqual(master.details, ["2. Fachsemester"]);
    assert.equal(bachelor.end, "2025-07");
    assert.equal(bachelor.endExpected, false);
    assert.deepEqual(bachelor.details, []);
  });

  it("maps experience, projects and volunteering with their ids", () => {
    const profile = exampleProfile();
    const [internship, workingStudent] = profile.experience;
    assert.equal(internship.id, "c3d2e1f0-7a6b-4c5d-8e9f-0a1b2c3d4e51");
    assert.equal(internship.role, "Praktikant Strategy Consulting");
    assert.equal(internship.employmentType, "internship");
    assert.deepEqual([internship.start, internship.end], ["2026-03", "2026-08"]);
    assert.equal(internship.details.length, 3);
    // No end with a start means "ongoing".
    assert.deepEqual([workingStudent.start, workingStudent.end], ["2025-10", null]);
    assert.equal(profile.projects[0].context, "Universität Mannheim");
    // Volunteering becomes the "other" kind, shown as "Engagement".
    assert.equal(profile.other[0].title, "Vorstand Finanzen");
    assert.equal(profile.other[0].organization, "Fachschaft VWL/BWL");
    assert.equal(indexProfile(profile).size, 2 + 2 + 1 + 2 + 2 + 1);
  });

  it("drops unconfirmed stations and dates the resume can't show", () => {
    const raw = structuredClone(example);
    raw.experience[0].confirmed = false;
    raw.projects[0].value.start = "Herbst 2025";
    const profile = toResumeProfile(parseCandidateProfile(raw), ACCOUNT, NOW);
    assert.equal(profile.experience.length, 1);
    assert.deepEqual([profile.projects[0].start, profile.projects[0].end], [null, null]);
  });
});

describe("resolving stations", () => {
  it("shows organisation, employment type and volunteering per language", () => {
    const profile = exampleProfile();
    const [, workingStudent] = profile.experience;
    const volunteering = profile.other[0];
    const draft = {
      summary: "",
      sections: [
        { id: "s-experience", kind: "experience" as const, title: "Praxiserfahrung", items: [{ id: "i-1", sourceRefs: [workingStudent.id], bullets: [] }] },
        { id: "s-other", kind: "other" as const, title: "Engagement", items: [{ id: "i-2", sourceRefs: [volunteering.id], bullets: [] }] },
      ],
    };
    const de = resolveResume(draft, profile, { language: "de", targetRole: "Werkstudent", gaps: [] });
    assert.equal(de.sections[0].items[0].subheading, "SAP SE · Werkstudent");
    assert.deepEqual(de.sections[0].items[0].period, { start: "2025-10", end: null });
    assert.equal(de.sections[1].items[0].heading, "Vorstand Finanzen");
    assert.equal(de.sections[1].items[0].subheading, "Fachschaft VWL/BWL");
    const en = resolveResume(draft, profile, { language: "en", targetRole: "Working Student", gaps: [] });
    assert.equal(en.sections[0].items[0].subheading, "SAP SE · Working Student");
  });
});

describe("resolving the example", () => {
  it("renders degrees and language levels per language", () => {
    const profile = exampleProfile();
    const [master, bachelor] = profile.education;
    const draft = {
      summary: "",
      sections: [
        {
          id: "s-edu",
          kind: "education" as const,
          title: "Ausbildung",
          items: [
            { id: "i1", sourceRefs: [master.id], bullets: [] },
            { id: "i2", sourceRefs: [bachelor.id], bullets: [] },
          ],
        },
        { id: "s-lang", kind: "languages" as const, title: "Sprachen", items: [{ id: "i3", sourceRefs: [profile.languages[0].id], bullets: [] }] },
      ],
    };
    const de = resolveResume(draft, profile, { language: "de", targetRole: "X", gaps: [] });
    assert.equal(de.sections[0].items[0].heading, "Master BWL (Mannheim Master in Management)");
    assert.deepEqual(de.sections[0].items[0].period, { start: null, end: "2027-09", endExpected: true });
    assert.equal(de.sections[1].items[0].subheading, "Muttersprache");
    const en = resolveResume(draft, profile, { language: "en", targetRole: "X", gaps: [] });
    assert.equal(en.sections[0].items[1].heading, "Bachelor in Wirtschaftswissenschaften");
    assert.equal(en.sections[1].items[0].subheading, "Native");
  });
});

describe("aliasProfile", () => {
  it("replaces long ids with short aliases and maps them back", () => {
    const profile = exampleProfile();
    const aliases = aliasProfile(profile);
    const ids = [...indexProfile(aliases.profile).keys()];
    assert.deepEqual(ids, ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]);
    assert.equal(aliases.fromAlias("p1"), profile.education[0].id);
    assert.equal(aliases.toAlias(profile.skills[1].id), "p7");
    assert.equal(aliases.fromAlias("p99"), "p99");
  });

  it("rewrites source refs", () => {
    const mapped = mapSourceRefs(lenaDraft(), (id) => `x-${id}`);
    assert.equal(mapped.sections[0].items[0].sourceRefs[0], "x-exp-strategy");
    assert.equal(lenaDraft().sections[0].items[0].sourceRefs[0], "exp-strategy");
  });
});
