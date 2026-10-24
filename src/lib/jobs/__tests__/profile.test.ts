import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { emptyInsights, type JobPosting } from "@/lib/schemas/job-posting";
import { computeFit, personalApplyWindow, rankByFit, type JobFit } from "../fit";
import { skillKeyword, toJobPreferences, type JobPreferences } from "../profile";

const example: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "fixtures", "candidate-profile.example.json"), "utf8"),
);

function posting(overrides: Partial<JobPosting>): JobPosting {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    source: "test",
    sourceUrl: "https://example.com/job/1",
    title: "Praktikum Strategy Consulting (m/w/d)",
    company: "Beispiel GmbH",
    location: "Frankfurt",
    track: "consulting",
    employmentType: "internship",
    description: "",
    publishedAt: "2026-10-20T00:00:00.000Z",
    insights: emptyInsights(),
    ...overrides,
  };
}

const preferences: JobPreferences = {
  locations: ["Frankfurt am Main", "München", "Mannheim"],
  tracks: ["consulting", "finance"],
  types: ["internship", "working_student"],
  remoteOk: true,
  earliestStart: "2027-03",
  skills: ["Excel", "PowerPoint"],
};

describe("toJobPreferences", () => {
  it("reads the final profile format", () => {
    // Unconfirmed skills (SQL, Python) are ignored; the home location is already a preferred one.
    assert.deepEqual(toJobPreferences(example), preferences);
  });

  it("ignores unconfirmed goals, unknown values and malformed sections", () => {
    const profile = {
      schemaVersion: 1,
      basics: { location: { value: "Köln", confirmed: true } },
      goals: {
        tracks: { value: ["consulting", "marketing"], confirmed: true },
        employmentTypes: { value: ["internship"], confirmed: false },
        preferredLocations: "kaputt",
        earliestStart: { value: "März 2027", confirmed: true },
      },
      skills: [{ value: "SQL", confirmed: true }, { nope: true }],
    };
    assert.deepEqual(toJobPreferences(profile), {
      locations: ["Köln"],
      tracks: ["consulting"],
      types: [],
      remoteOk: false,
      earliestStart: null,
      skills: ["SQL"],
    });
  });

  it("returns null for other formats or empty profiles", () => {
    assert.equal(toJobPreferences(null), null);
    assert.equal(toJobPreferences({ schemaVersion: 2 }), null);
    assert.equal(toJobPreferences({ schemaVersion: 1, goals: {} }), null);
  });

  it("shortens skills to a matchable keyword", () => {
    assert.equal(skillKeyword("Excel-Modellierung (DCF, Szenarioanalysen)"), "Excel");
    assert.equal(skillKeyword("PowerPoint (Storylining, Slide-Design)"), "PowerPoint");
    assert.equal(skillKeyword("Python (pandas)"), "Python");
    assert.equal(skillKeyword("R"), null);
  });
});

describe("computeFit", () => {
  it("rewards track, type, location and skills", () => {
    const fit = computeFit(posting({ description: "Du baust Modelle in Excel." }), preferences);
    assert.deepEqual(fit.matches, [
      { kind: "track", track: "consulting" },
      { kind: "type", type: "internship" },
      { kind: "location", location: "Frankfurt am Main" },
      { kind: "skills", skills: ["Excel"] },
    ]);
    assert.equal(fit.score, 9);
    assert.deepEqual(fit.warnings, []);
  });

  it("matches places with umlauts and remote postings", () => {
    assert.deepEqual(computeFit(posting({ location: "Muenchen, Bayern" }), preferences).matches[2], {
      kind: "location",
      location: "München",
    });
    const remote = computeFit(posting({ location: "Hamburg · Remote möglich" }), preferences);
    assert.ok(remote.matches.some((reason) => reason.kind === "remote"));
    const noRemote = computeFit(posting({ location: "Hamburg · Remote möglich" }), { ...preferences, remoteOk: false });
    assert.ok(!noRemote.matches.some((reason) => reason.kind === "remote"));
  });

  it("does not count words inside other words as skills", () => {
    const fit = computeFit(posting({ description: "Excellent communication skills" }), preferences);
    assert.ok(!fit.matches.some((reason) => reason.kind === "skills"));
  });

  it("warns about explicit start dates before the earliest start, but not about 'ab sofort'", () => {
    const early = computeFit(
      posting({ insights: { ...emptyInsights(), startDate: "2027-01-01T00:00:00.000Z" } }),
      preferences,
    );
    assert.deepEqual(early.warnings, [{ kind: "start", start: "2027-01", earliestStart: "2027-03" }]);

    const asap = computeFit(
      posting({ publishedAt: "2026-10-21T00:00:00.000Z", insights: { ...emptyInsights(), startDate: "2026-10-21T00:00:00.000Z" } }),
      preferences,
    );
    assert.deepEqual(asap.warnings, []);

    const later = computeFit(
      posting({ insights: { ...emptyInsights(), startDate: "2027-05-01T00:00:00.000Z" } }),
      preferences,
    );
    assert.ok(later.matches.some((reason) => reason.kind === "start"));
  });

  it("ranks by score and keeps the order of ties", () => {
    const items = [
      posting({ id: "a", track: null, location: "Hamburg" }),
      posting({ id: "b" }),
      posting({ id: "c", track: null, location: "Hamburg" }),
    ];
    const fits = new Map<string, JobFit>(items.map((item) => [item.id, computeFit(item, preferences)]));
    assert.deepEqual(
      rankByFit(items, fits).map((item) => item.id),
      ["b", "a", "c"],
    );
  });
});

describe("personalApplyWindow", () => {
  const today = new Date(2026, 9, 24); // 24.10.2026

  it("computes the window before the earliest start", () => {
    assert.deepEqual(personalApplyWindow("2027-03", { min: 6, max: 12 }, today), {
      start: "2027-03",
      from: "2026-03",
      to: "2026-09",
      status: "late",
    });
    assert.equal(personalApplyWindow("2027-03", { min: 3, max: 6 }, today)?.status, "now");
    assert.equal(personalApplyWindow("2028-03", { min: 6, max: 12 }, today)?.status, "early");
  });

  it("handles year boundaries and missing data", () => {
    assert.deepEqual(personalApplyWindow("2027-01", { min: 1, max: 2 }, today), {
      start: "2027-01",
      from: "2026-11",
      to: "2026-12",
      status: "early",
    });
    assert.equal(personalApplyWindow(null, { min: 6, max: 12 }, today), null);
    assert.equal(personalApplyWindow("2027-03", null, today), null);
  });
});
