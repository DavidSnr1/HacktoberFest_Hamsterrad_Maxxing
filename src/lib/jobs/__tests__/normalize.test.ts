import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyInsights, type JobPostingDraft } from "@/lib/schemas/job-posting";
import { extractJsonAfter } from "../embedded-json";
import { mergeResults } from "../merge";
import { buildKeywords, dedupeKey, detectEmploymentType, detectTrack, matchesQuery } from "../normalize";
import { combineOutlook, competitionFromInsights, observedLeadMonths } from "../outlook-rules";
import { mergeInsights } from "../repository";
import { htmlToText, toIsoDate } from "../text";

function draft(overrides: Partial<JobPostingDraft>): JobPostingDraft {
  return {
    source: "test",
    sourceId: "1",
    sourceUrl: "https://example.com/job/1",
    title: "Praktikum Strategy Consulting (m/w/d)",
    company: "Beispiel GmbH",
    location: "München",
    track: null,
    employmentType: null,
    description: "",
    publishedAt: "2026-10-20T00:00:00.000Z",
    insights: emptyInsights(),
    ...overrides,
  };
}

describe("heuristics", () => {
  it("detects employment types", () => {
    assert.equal(detectEmploymentType("Werkstudent (m/w/d) Controlling"), "working_student");
    assert.equal(detectEmploymentType("Pflichtpraktikum Marketing"), "internship");
    assert.equal(detectEmploymentType("Intern Capital Markets"), "internship");
    assert.equal(detectEmploymentType("International Sales Manager"), null);
    assert.equal(detectEmploymentType("Junior Consultant"), "entry");
  });

  it("detects tracks", () => {
    assert.equal(detectTrack("Founders Associate"), "startup");
    assert.equal(detectTrack("Praktikum Unternehmensberatung"), "consulting");
    assert.equal(detectTrack("Werkstudent Corporate Finance"), "finance");
    assert.equal(detectTrack("Pflegefachkraft"), null);
  });

  it("adds type and track keywords only when needed", () => {
    assert.equal(buildKeywords({ q: "Marketing", type: "internship" }), "Marketing Praktikum");
    assert.equal(buildKeywords({ q: "Praktikum Marketing", type: "internship" }), "Praktikum Marketing");
    assert.equal(buildKeywords({ track: "consulting" }), "Consulting");
    assert.equal(buildKeywords({ q: "Data", track: "consulting" }), "Data");
  });

  it("builds the same dedupe key across portals", () => {
    assert.equal(
      dedupeKey({ title: "Praktikum Strategy (m/w/d)", company: "Beispiel GmbH", location: "München, Bayern" }),
      dedupeKey({ title: "Praktikum Strategy (w/m/d)", company: "Beispiel", location: "München" }),
    );
  });
});

describe("matchesQuery", () => {
  it("requires every term and tolerates word endings", () => {
    assert.ok(matchesQuery("Junior Consultant Banking", "Consulting"));
    assert.ok(matchesQuery("Werkstudent Unternehmensberater", "Beratung"));
    assert.ok(matchesQuery("Praktikum bei PwC Deutschland", "pwc praktikum"));
    assert.ok(!matchesQuery("Praktikum Linienreederei", "PwC"));
    assert.ok(!matchesQuery("Data Analyst", "Data Engineer"));
  });
});

describe("outlook rules", () => {
  const estimate = {
    applyMonthsBefore: { min: 6, max: 12 },
    applicationPeriod: "laufend",
    competition: "medium" as const,
    hint: "Bewirb dich früh.",
  };

  it("derives competition from applicant data", () => {
    assert.equal(competitionFromInsights({ ...emptyInsights(), applicantCount: 117 }), "high");
    assert.equal(competitionFromInsights({ ...emptyInsights(), applicantCount: 71 }), "medium");
    assert.equal(competitionFromInsights({ ...emptyInsights(), applicantCount: 12 }), "low");
    assert.equal(competitionFromInsights({ ...emptyInsights(), applicantText: "Gehören Sie zu den ersten 25" }), "low");
    assert.equal(competitionFromInsights(emptyInsights()), null);
  });

  it("only uses lead times that are clearly ahead of the start", () => {
    assert.equal(observedLeadMonths("2025-08-06T00:00:00.000Z", "2027-05-01T00:00:00.000Z"), 21);
    assert.equal(observedLeadMonths("2026-10-21T00:00:00.000Z", "2026-11-21T00:00:00.000Z"), null);
    assert.equal(observedLeadMonths(null, "2027-05-01T00:00:00.000Z"), null);
  });

  it("prefers portal data and fills gaps with the estimate", () => {
    const facts = {
      publishedAt: "2025-08-06T00:00:00.000Z",
      insights: { ...emptyInsights(), startDate: "2027-05-01T00:00:00.000Z", applicantCount: 150 },
    };
    assert.deepEqual(combineOutlook(facts, estimate), {
      applyMonthsBefore: { min: 21, max: 21 },
      applicationPeriod: "laufend",
      competition: "high",
      applicantCount: 150,
      hint: "Bewirb dich früh.",
    });
    const onlyEstimate = combineOutlook({ publishedAt: null, insights: emptyInsights() }, estimate);
    assert.deepEqual(onlyEstimate.applyMonthsBefore, { min: 6, max: 12 });
    assert.equal(onlyEstimate.competition, "medium");
    assert.equal(combineOutlook({ publishedAt: null, insights: emptyInsights() }, null).competition, null);
  });

  it("lets detail facts override search facts only where set", () => {
    const merged = mergeInsights(
      { ...emptyInsights(), startDate: "2027-01-01T00:00:00.000Z", noCoverLetter: true },
      { applicantCount: 40, startDate: null },
    );
    assert.equal(merged.applicantCount, 40);
    assert.equal(merged.startDate, "2027-01-01T00:00:00.000Z");
    assert.equal(merged.noCoverLetter, true);
  });
});

describe("mergeResults", () => {
  it("drops duplicates, keeps the earlier source and applies filters", () => {
    const merged = mergeResults(
      [
        [draft({ source: "arbeitsagentur", sourceId: "a" })],
        [
          draft({ source: "stepstone", sourceId: "b", title: "Praktikum Strategy Consulting (w/m/d)" }),
          draft({ source: "stepstone", sourceId: "c", title: "Senior Accountant", publishedAt: null }),
        ],
      ],
      { type: "internship" },
    );
    assert.deepEqual(
      merged.map((item) => item.sourceId),
      ["a"],
    );
    assert.equal(merged[0]?.track, "consulting");
    assert.equal(merged[0]?.employmentType, "internship");
  });

  it("prefers the title over the source category", () => {
    const [merged] = mergeResults([[draft({ title: "Werkstudent Finance", employmentType: "internship" })]], {});
    assert.equal(merged?.employmentType, "working_student");
  });

  it("drops invalid entries and sorts newest first", () => {
    const merged = mergeResults(
      [
        [
          draft({ sourceId: "old", title: "Werkstudent A", publishedAt: "2026-01-01T00:00:00.000Z" }),
          draft({ sourceId: "new", title: "Werkstudent B", publishedAt: "2026-10-01T00:00:00.000Z" }),
          draft({ sourceId: "bad", title: "Werkstudent C", sourceUrl: "not a url" }),
        ],
      ],
      {},
    );
    assert.deepEqual(
      merged.map((item) => item.sourceId),
      ["new", "old"],
    );
  });
});

describe("text helpers", () => {
  it("converts HTML to readable text", () => {
    assert.equal(htmlToText("<p>Hallo&nbsp;Welt</p><ul><li>A &amp; B</li><li>C</li></ul>"), "Hallo Welt\n\n• A & B\n• C");
  });

  it("parses dates in seconds, milliseconds and ISO", () => {
    assert.equal(toIsoDate(1792837841), "2026-10-24T10:30:41.000Z");
    assert.equal(toIsoDate(1792837841000), "2026-10-24T10:30:41.000Z");
    assert.equal(toIsoDate("2026-09-03"), "2026-09-03T00:00:00.000Z");
    assert.equal(toIsoDate("kaputt"), null);
  });

  it("extracts embedded JSON with braces inside strings", () => {
    const html = 'x = {"a":"}{","b":[1,{"c":"\\"]"}]}; more';
    assert.deepEqual(extractJsonAfter(html, "x = "), { a: "}{", b: [1, { c: '"]' }] });
  });
});
