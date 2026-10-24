import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INDEED_DEMO_SOURCE, jobPostingDraftSchema } from "@/lib/schemas/job-posting";
import { SourceError } from "../http";
import { mergeResults } from "../merge";
import * as arbeitnow from "../sources/arbeitnow";
import * as arbeitsagentur from "../sources/arbeitsagentur";
import * as indeed from "../sources/indeed";
import { buildMockResults } from "../sources/indeed-mock";
import * as linkedin from "../sources/linkedin";
import * as stepstone from "../sources/stepstone";
import { fixture, jsonFixture } from "./helpers";

function assertValidDrafts(drafts: unknown[]) {
  assert.ok(drafts.length > 0, "expected at least one posting");
  for (const draft of drafts) assert.ok(jobPostingDraftSchema.safeParse(draft).success, JSON.stringify(draft));
}

function assertBlocked(fn: () => unknown) {
  assert.throws(fn, (error) => error instanceof SourceError && error.reason === "blocked");
}

describe("arbeitsagentur", () => {
  it("parses the v6 search response", () => {
    const drafts = arbeitsagentur.parseSearchResponse(jsonFixture("arbeitsagentur-search.json"));
    assertValidDrafts(drafts);
    const first = drafts[0];
    assert.equal(first?.source, "arbeitsagentur");
    assert.equal(first?.company, "zeb");
    assert.equal(first?.location, "München");
    assert.equal(first?.employmentType, "internship");
    assert.match(first?.sourceUrl ?? "", /^https:\/\/www\.arbeitsagentur\.de\/jobsuche\/jobdetail\//);
    assert.match(first?.insights.startDate ?? "", /^\d{4}-\d{2}-\d{2}T/);
  });

  it("parses the detail response", () => {
    const text = arbeitsagentur.parseDetailResponse(jsonFixture("arbeitsagentur-detail.json"))?.description;
    assert.ok(text && text.length > 100 && !text.includes("&amp;"));
  });

  it("maps internships to angebotsart 34 without adding the keyword", () => {
    const url = new URL(arbeitsagentur.buildSearchUrl({ q: "Consulting", location: "München", type: "internship" }));
    assert.equal(url.searchParams.get("angebotsart"), "34");
    assert.equal(url.searchParams.get("was"), "Consulting");
    assert.equal(url.searchParams.get("wo"), "München");
  });

  it("rejects an unexpected response", () => {
    assert.throws(() => arbeitsagentur.parseSearchResponse("nope"), SourceError);
  });
});

describe("arbeitnow", () => {
  it("filters locally by keywords and location", () => {
    const data = jsonFixture("arbeitnow.json");
    const all = arbeitnow.parseResponse(data, {});
    assertValidDrafts(all);
    const berlin = arbeitnow.parseResponse(data, { location: "Berlin" });
    assert.ok(berlin.length > 0 && berlin.length < all.length);
    assert.ok(berlin.every((draft) => /berlin|remote/i.test(draft.location ?? "")));
    const students = arbeitnow.parseResponse(data, { q: "Werkstudent" });
    assert.ok(students.every((draft) => /werkstudent/i.test(draft.title)));
  });

  it("strips HTML from descriptions", () => {
    const [first] = arbeitnow.parseResponse(jsonFixture("arbeitnow.json"), {});
    assert.ok(first && !/<[a-z]/i.test(first.description));
  });
});

describe("stepstone", () => {
  it("parses the embedded result list", () => {
    const drafts = stepstone.parseSearchPage(fixture("stepstone-search.html"));
    assertValidDrafts(drafts);
    assert.equal(drafts.length, 4);
    assert.ok(drafts.every((draft) => !draft.sourceUrl.includes("?")), "tracking parameters removed");
  });

  it("reads salary, listing expiry and labels", () => {
    const drafts = stepstone.parseSearchPage(fixture("stepstone-search.html"));
    const banking = drafts.find((draft) => draft.title.includes("Banking"));
    assert.deepEqual(banking?.insights.salary, { min: 47000, max: 73000, currency: "EUR", period: "year" });
    assert.equal(banking?.insights.quickApply, true);
    assert.equal(drafts.find((draft) => draft.title.includes("MINT"))?.insights.salary?.period, "month");
    assert.equal(drafts.find((draft) => draft.title.includes("Rating"))?.insights.noCoverLetter, true);
    assert.ok(drafts.every((draft) => draft.insights.validThrough));
  });

  it("drops generic fallback results that do not match the query", () => {
    assert.equal(stepstone.parseSearchPage(fixture("stepstone-search.html"), { q: "PwC" }).length, 0);
    const consulting = stepstone.parseSearchPage(fixture("stepstone-search.html"), { q: "Consulting" });
    // "Consultant" matches "Consulting"; "Rating Advisory" does not.
    assert.deepEqual(
      consulting.map((draft) => draft.title.slice(0, 20)),
      ["Praktikum / Masterarb", "Praktikum im IT-Cons", "Junior Consultant (w"].map((t) => t.slice(0, 20)),
    );
  });

  it("reads the description from JSON-LD", () => {
    const details = stepstone.parseDetailPage(fixture("stepstone-detail.html"));
    const text = details?.description;
    assert.ok(text && text.length > 100 && !/<[a-z]/i.test(text));
    assert.ok(details?.insights?.validThrough);
  });

  it("builds slug URLs", () => {
    assert.equal(
      stepstone.buildSearchUrl({ q: "Praktikum Consulting", location: "München" }),
      "https://www.stepstone.de/jobs/praktikum-consulting/in-muenchen",
    );
  });

  it("reports a bot challenge as blocked", () => {
    assertBlocked(() => stepstone.parseSearchPage(fixture("indeed-challenge.html")));
  });
});

describe("linkedin", () => {
  it("parses guest search cards and skips broken ones", () => {
    const drafts = linkedin.parseSearchPage(fixture("linkedin-search.synthetic.html"));
    assertValidDrafts(drafts);
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0]?.sourceUrl, "https://www.linkedin.com/jobs/view/4012345678");
    assert.equal(drafts[1]?.title, "Werkstudent Corporate Finance & M&A");
  });

  it("parses description and applicant count", () => {
    const details = linkedin.parseDetailPage(fixture("linkedin-detail.synthetic.html"));
    assert.match(details?.description ?? "", /• Marktanalysen erstellen/);
    assert.equal(details?.insights?.applicantCount, 71);
  });

  it("parses applicant captions", () => {
    assert.equal(linkedin.parseApplicants("Mehr als 200 Bewerber:innen").applicantCount, 200);
    assert.equal(linkedin.parseApplicants("1.234 Bewerbungen").applicantCount, 1234);
    const early = linkedin.parseApplicants("Gehören Sie zu den ersten 25 Bewerber:innen.");
    assert.equal(early.applicantCount, null);
    assert.match(early.applicantText ?? "", /ersten 25/);
    assert.deepEqual(linkedin.parseApplicants(""), { applicantCount: null, applicantText: null });
  });

  it("restricts searches without location to Germany", () => {
    const url = new URL(linkedin.buildSearchUrl({ q: "KPMG" }));
    assert.equal(url.searchParams.get("geoId"), "101282230");
    const local = new URL(linkedin.buildSearchUrl({ q: "KPMG", location: "München" }));
    assert.equal(local.searchParams.get("location"), "München, Deutschland");
    assert.equal(local.searchParams.get("geoId"), null);
  });

  it("reports the JS challenge as blocked", () => {
    assertBlocked(() => linkedin.parseSearchPage(fixture("linkedin-challenge.html")));
  });
});

describe("indeed", () => {
  it("parses embedded job cards", () => {
    const drafts = indeed.parseSearchPage(fixture("indeed-search.synthetic.html"));
    assertValidDrafts(drafts);
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0]?.sourceUrl, "https://de.indeed.com/viewjob?jk=a1b2c3d4e5f6");
  });

  it("parses the description", () => {
    assert.match(indeed.parseDetailPage(fixture("indeed-detail.synthetic.html"))?.description ?? "", /Spannende Projekte/);
  });

  it("reports the security check as blocked", () => {
    assertBlocked(() => indeed.parseSearchPage(fixture("indeed-challenge.html")));
  });
});

describe("indeed mock", () => {
  const url = "https://de.indeed.com/jobs?q=Praktikum";

  it("builds labelled example postings that survive the merge filters", () => {
    const params = { q: "Praktikum Consulting", location: "Frankfurt am Main", track: "consulting", type: "internship" } as const;
    const drafts = buildMockResults(params, url);
    assertValidDrafts(drafts);
    assert.ok(drafts.every((draft) => draft.source === INDEED_DEMO_SOURCE && draft.sourceUrl === url));
    assert.ok(drafts.every((draft) => draft.company?.startsWith("Muster")));
    assert.equal(drafts[0]?.title, "Praktikum Consulting (m/w/d)");
    assert.equal(mergeResults([drafts], params).length, drafts.length);
  });

  it("takes type and track from the query when no filter is set", () => {
    const drafts = mergeResults([buildMockResults({ q: "Praktikum Consulting" }, url)], {});
    assert.equal(drafts.length, 5);
    assert.ok(drafts.every((draft) => draft.employmentType === "internship" && draft.track === "consulting"));
  });

  it("varies the job type when none is chosen", () => {
    const drafts = mergeResults([buildMockResults({}, url)], {});
    assert.deepEqual(new Set(drafts.map((draft) => draft.employmentType)), new Set(["internship", "working_student", "entry"]));
  });

  it("keeps ids stable per query", () => {
    const ids = (q: string) => buildMockResults({ q }, url).map((draft) => draft.sourceId);
    assert.deepEqual(ids("Finance"), ids("finance"));
    assert.notDeepEqual(ids("Finance"), ids("Strategy"));
  });
});
